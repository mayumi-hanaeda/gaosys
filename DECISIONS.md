# Design Decisions

Updated: 2026-06-13
Status: Accepted

## Purpose

オンボーディング自動化の実装前に必要な判断を記録する。`Proposed`は推奨案であり、承認されるまで実装仕様として扱わない。

Status:

- `Proposed`: 推奨案を提示済み、未承認
- `Accepted`: 承認済み、実装の基準
- `Rejected`: 不採用、代替案を記録
- `Superseded`: 後続決定で置換済み

## ADR-001 Evaluation Sheet Storage

- Status: `Accepted`
- Decision: 評価シートは運営管理用の専用フォルダへ作成し、フォルダIDをScript Propertiesの`EVALUATION_SHEET_FOLDER_ID`で管理する。
- Recommended location: 組織管理下の共有ドライブ内フォルダ。共有ドライブを利用できない場合は、運営用アカウントが所有する専用マイドライブフォルダ。
- Reason:
  - 実行ユーザーのマイドライブ直下では、担当者変更やアカウント停止時の継続管理が弱い。
  - 保存先を設定化すれば非本番フォルダへ安全に切り替えられる。
  - フォルダIDは運用設定であり、シート上へ露出させる必要がない。
- Rejected alternative:
  - 実行ユーザーのマイドライブ直下へ無条件で作成する。
- Impact:
  - Drive権限と共有ドライブ対応を統合テストする。
  - フォルダ未設定・アクセス拒否の異常系テストが必要。

## ADR-002 Evaluation Sheet Naming

- Status: `Accepted`
- Decision: ファイル名は`★【{タダスクネーム}】評価項目チェックシート`とする。タダスクネームが空の場合のみ`お名前`へフォールバックする。
- Reason:
  - 実シートの最新行で使われている命名と、テンプレート名「★【新フォーマット】評価項目チェックシート」に合わせる。
  - 現行フォームではタダスクネームが必須だが、サーバー側再実行や旧データにも耐えられる。
- Compatibility note:
  - 古い行には`[名前]評価項目チェックシート`形式もある。
  - `architecture.html`には先頭の`★`なしの表記もあるため、承認時に最終確認する。
- Constraint:
  - ファイル名に利用できない、または運用上問題となる制御文字と前後空白を除去する。
- Impact:
  - 正常値、前後空白、空値、同名申込のテストが必要。

## ADR-003 index Initial Values

- Status: `Accepted`
- Decision: `index`の最初の空行へB〜F列を1回の`setValues()`で書き込む。A列には書き込まない。

| Column | Value |
| --- | --- |
| A 卒業 | 書き込み禁止。A1の`ArrayFormula`に任せる |
| B 名前 | `formData.tadasukeName` |
| C 就任年月 | 初期値は空欄 |
| D サポーター | 空欄 |
| E サブ | 空欄 |
| F 評価シート | 生成した評価シートURL |

- Reason:
  - 実シートのB列はタダスクネームで運用されている。
  - A1は`ArrayFormula`で卒業表示を生成しており、A列データ行への書き込みは数式を壊す可能性がある。
  - C列は「新講師就任年月」であり、申込日やMTG参加日と同義とは限らないため自動確定しない。
  - B〜Fを一括設定し、D/Eを空欄として初期状態を明示する。
- Detail:
  - C列は空欄で開始する。
  - F列は表示名付きRichTextリンクで設定する。
- Impact:
  - `LockService`を使用する。
  - G列以降の数式が対象行に存在することを検証し、なければ直前行から必要な数式だけを複製する。
  - 配列数式を壊さないこと、数式・入力規則の継承を統合テストする。

## ADR-004 Mail Template Tags

- Status: `Accepted`
- Decision: 件名と本文で次の二重波括弧タグを使用する。

| Tag | Value |
| --- | --- |
| `{{name}}` | お名前 |
| `{{tadasukeName}}` | タダスクネーム |
| `{{startDate}}` | 表示用参加日 |
| `{{challenge}}` | チャレンジ講師の選択結果 |
| `{{freeText}}` | 自由記載。空の場合は`なし` |
| `{{evaluationSheetUrl}}` | 評価シートURL |
| `{{responseSummary}}` | フォーム回答控えの整形済み本文 |

- Unknown tag policy: 未知のタグまたは置換後に残った`{{...}}`があれば送信せず、メール処理を失敗として記録する。
- Missing optional value policy: 自由記載だけ`なし`へ変換する。必須値欠落は送信失敗とする。
- Reason:
  - タグの誤記をそのまま申込者へ送信しない。
  - テンプレート置換を純粋関数としてローカルテストできる。
- Impact:
  - 全タグ置換、未知タグ、必須値欠落、任意値欠落をテストする。

## ADR-005 Mail Behavior When Sheet Provisioning Fails

- Status: `Accepted`
- Decision: 評価シート発行または編集権限付与に失敗した場合、自動返信メールは送信しない。
- Behavior:
  - 既存の申込受付とCalendar処理は成功として維持する。
  - Chat通知へ「評価シート発行失敗・要手動対応」を含める。
  - 構造化ログへ失敗段階と申込追跡IDを記録する。
  - 運営が復旧後にメールだけ再実行できるようにする。
- Reason:
  - 無効またはアクセス不能なURLを申込者へ案内する方が危険。
  - 申込受付自体を取り消さず、運営へ明示的にエスカレーションできる。
- Impact:
  - 部分成功結果と再送関数が必要。

## ADR-006 Duplicate and Retry Policy

- Status: `Accepted`
- Decision: 1回の送信に`submissionId`を発行し、追加処理の冪等性キーとして使用する。同一`submissionId`の再実行では評価シート、index行、メールを重複作成しない。
- Current compatibility:
  - Calendarの既存仕様である「同一開催日時なら既存イベントを更新」は維持する。
  - 別の`submissionId`で同一人物・同一日時が送信された場合、申込履歴は別行として保存するが、追加処理前に重複警告を記録する。
- Recommended key:
  - UUIDを申込受付時に生成し、申込リストの新規管理列またはScript Propertiesへ保存する。
- Detail:
  - 申込リストの未使用管理列へ`submissionId`を保存する。具体列は`SPEC.md`で定義する。
- Reason:
  - 氏名や日時だけでは同姓同名、再申込、複数登壇希望を区別できない。
  - AIによる再試行と障害復旧を安全にするため、明示的な冪等性キーが必要。
- Impact:
  - スキーマ変更、再実行、同時実行のテストが必要。

## ADR-007 Partial Success Response

- Status: `Accepted`
- Decision: 申込保存とCalendar処理が成功した時点で受付は成功とする。評価シート、index、Chat、メールの失敗は部分成功として記録し、利用者向けには受付成功を返す。
- Response extension:

```json
{
  "success": true,
  "message": "申し込みを受け付けました。ありがとうございます。",
  "submissionId": "server-generated-id",
  "operations": {
    "calendar": "success",
    "submission": "success",
    "evaluationSheet": "success",
    "index": "success",
    "chat": "success",
    "mail": "success"
  }
}
```

- Client policy:
  - UIは`success`と`message`だけを使用し、内部処理状態は申込者へ表示しない。
- Logging policy:
  - `submissionId`で全処理を追跡し、個人情報と秘密情報をログへ含めない。
- Reason:
  - 現行の受付体験を維持しつつ、AIと運営が部分失敗を検出できる。

## ADR-008 Test Execution Boundary

- Status: `Accepted`
- Decision: GAS内部テスト結果は`clasp run`を第一経路とし、PlaywrightはWeb UI E2Eへ限定する。
- Fallback:
  - API executableを組織ポリシー上利用できない場合、管理者限定かつdry-run固定のテスト画面を別デプロイで用意する。
- Reason:
  - ブラウザ操作よりJSON戻り値の方が安定し、失敗判定と証跡保存を自動化しやすい。
  - 本番Webフォームへテスト機能を露出させない。
- Impact:
  - API executable、標準GCPプロジェクト、Cloud Loggingの設定承認が必要。

## Approval Checklist

- [x] ADR-001 保存先
- [x] ADR-002 ファイル名
- [x] ADR-003 index初期値
- [x] ADR-004 メールタグ
- [x] ADR-005 評価シート失敗時のメール
- [x] ADR-006 重複・再実行
- [x] ADR-007 部分成功レスポンス
- [x] ADR-008 テスト実行境界

全項目が`Accepted`または代替案付きの`Rejected`になるまで、DOC-002は完了としない。
