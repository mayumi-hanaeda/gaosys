# Onboarding Automation Specification

Updated: 2026-08-08
Status: Approved for implementation

## 1. Scope

既存の申込受付、Calendar予定作成・更新、Meet追加、申込リスト保存を維持したまま、次を追加する。

- F-01 評価シートの複製と編集権限付与
- F-02 `index`への初期登録
- F-03 Google Chat通知の拡張
- F-04 申込者への自動返信メール
- F-05 冪等性、部分成功、構造化ログ
- F-06 AIが実行結果を取得できるドライテスト

フロントエンドの入力項目と基本表示は変更対象外とする。内部レスポンスは拡張してよいが、UIは既存の`success`と`message`を使用する。

## 2. Source of Truth

The canonical specification is the Google Docs document:

- Title: `タダスク講師を始めてみたい人の申込みフォーム・仕様書`
- URL: `https://docs.google.com/document/d/12HICKl_Ir8VnAF-D1ZymDU0Qs3fLEYAunEpm0uEM15M/edit?tab=t.xcggp02bny59`
- Document ID: `12HICKl_Ir8VnAF-D1ZymDU0Qs3fLEYAunEpm0uEM15M`
- Tabs:
  - `追加仕様書`（ルート。運用上の正本・GCPプロジェクト情報・Script Properties仕様）
    - `作業範囲記述書（SOW）` → 本リポジトリの`SOW.md`に対応
    - `要件定義書（RD）` → 本リポジトリの`RD.md`に対応
    - `技術要件定義書（TRD）` → 本リポジトリの`TRD.md`に対応
    - `データ・インターフェース定義書` → 本書`SPEC.md`に対応
    - `メール本文` → 実体は本番`設定用!F2:G2`（実値はGitHubに置かない）
  - `ファイル`（付随ファイル、仕様の直接の正ではない）
  - `旧仕様書（2025）`（`仕様書`、`技術仕様書`。レガシー、現行仕様の基準にしない）

このGoogleドキュメントをGAOSYS開発仕様書の正本とする。本リポジトリの`SPEC.md`、
`SOW.md`、`RD.md`、`TRD.md`、`CURRENT_STATE.md`、`DECISIONS.md`、`architecture.html`、
`DEPLOYMENT.md`などは、この正本から派生した作業文書である。正本とGitHub側文書に
差分が出た場合は、内容を確認したうえで明示的にマージし、必要な設計判断・実装仕様・
運用変更を記録する。どちらか一方を無断で上書きしない。

Repository-side priority after canonical merge:

1. Google Docs canonical specification after confirmed merge review
2. `DECISIONS.md`のAccepted ADR
3. 本書、`SOW.md`、`RD.md`、`TRD.md`
4. `CURRENT_STATE.md`
5. `architecture.html`
6. 現行コード

競合時は上位文書を優先する。`申込リスト`のCalendar IDはH列、開催日時DataはI列を正とする。

## 2.1 Runtime Authority

The production and test web apps must run as the deploying user
(`executeAs: USER_DEPLOYING`), not as the accessing user. Calendar, Drive, and
Mail operations run under the deploying user's authority.

Current production deploying account: システム管理・運用責任者のアカウント。

Reason: the application creates and updates events on the deployer's Calendar
and provisions Drive/Mail resources under the same operational authority. If
the web app runs as the accessing user, Calendar creation/update can fail when
the applicant does not have write access to the deployer's Calendar.

Web app access is restricted to users in the Tadakayo domain.

## 3. Identifiers

### 3.1 submissionId

- Format: `Utilities.getUuid()`が返すUUID文字列
- Generation: `saveFormData()`受付開始後、外部操作前にサーバー側で生成
- Purpose:
  - ログ相関ID
  - 評価シート、index、Chat、メールの冪等性キー
  - 障害復旧時の対象識別
- Storage: `申込リスト!P`
- Header: `申込ID`
- Security: 個人情報ではないが、外部公開しない

同じ`submissionId`の再実行では、完了済み操作を重複実行しない。

## 4. Configuration

### 4.1 設定用シート

既存のA〜D列を維持し、E〜G列を追加する。

| Cell | Header | Type | Required | Default | Validation |
| --- | --- | --- | --- | --- | --- |
| A1/A2 | カレンダータイトル | string | yes | none | non-empty |
| B1/B2 | カレンダータグID | string | yes | none | non-empty |
| C1/C2 | MTG時間 | number | yes | none | integer, `> 0` |
| D1/D2 | 開始時刻 | Date/string | no | `20:00` | valid `HH:mm` |
| E1/E2 | 評価シートテンプレートID | string | yes | none | accessible Drive file ID |
| F1/F2 | 自動返信メール件名 | string | yes | none | non-empty after replacement |
| G1/G2 | 自動返信メール本文 | string | yes | none | no unresolved tags after replacement |

E1〜G1の正確な値:

```text
評価シートテンプレートID
自動返信メール件名
自動返信メール本文
```

### 4.2 Script Properties

| Key | Required | Secret | Purpose |
| --- | --- | --- | --- |
| `GAOSYS_SPREADSHEET_ID` | yes | no | 本番スプレッドシートID |
| `GAOSYS_SPREADSHEET_ID_OVERRIDE` | isolated test only | no | 隔離検証時のSpreadsheet差し替え |
| `CHAT_WEBHOOK_URL` | yes | yes | Google Chat Incoming Webhook |
| `EVALUATION_SHEET_FOLDER_ID` | yes | no | 評価シート保存先 |
| `LOGO_IMAGE_URL` | recommended | no | フォーム上部ロゴ画像URL |
| `SUPPORT_STATUS_SPREADSHEET_URL` | recommended | no | Chat通知に含める管理シートURL |
| `TEST_SPREADSHEET_ID` | integration only | no | 非本番統合テスト |
| `TEST_CALENDAR_ID` | integration only | no | 非本番統合テスト |
| `TEST_EVALUATION_FOLDER_ID` | integration only | no | 非本番統合テスト |
| `TEST_CHAT_WEBHOOK_URL` | integration only | yes | 非本番Chat |
| `TEST_MAIL_RECIPIENT` | integration only | personal | 非本番メール宛先 |

秘密値と個人情報をログ、戻り値、テスト証跡へ含めない。

### 4.3 Configuration Result

```javascript
{
  calendarTitle: string,
  calendarId: string,
  durationMinutes: number,
  startTime: string,
  evaluationTemplateId: string,
  mailSubjectTemplate: string,
  mailBodyTemplate: string,
  chatWebhookUrl: string,
  evaluationFolderId: string
}
```

設定不備は`CONFIG_INVALID`として、欠落した設定名だけを返す。設定値そのものはエラーへ含めない。

## 5. Spreadsheet Schema

### 5.1 申込リスト

| Column | Header | Type | Writer |
| --- | --- | --- | --- |
| A | タイムスタンプ | Date | GAS |
| B | 申込者メールアドレス | string | GAS |
| C | お名前 | string | GAS |
| D | タダスクネーム | string | GAS |
| E | 希望開始時期 | string | GAS |
| F | チャレンジ講師 | string | GAS |
| G | 自由記載 | string | GAS |
| H | カレンダーID | string | GAS |
| I | 開催日時Data | Date | GAS |
| J〜O | 既存運用予約列 | existing | existing process |
| P | 申込ID | UUID string | GAS |
| Q | オンボーディング状態 | JSON string | GAS |

J〜O列は、現行実シートでは空欄でも`initializeSubmissionSheet()`の既存ヘッダー定義があるため再利用しない。

Q列の例:

```json
{
  "evaluationSheet": "success",
  "index": "success",
  "chat": "success",
  "mail": "success"
}
```

許可値:

- `pending`
- `success`
- `failed`
- `skipped`

エラー本文、メールアドレス、Webhook URLはQ列へ保存しない。

### 5.2 index

対象行はB列の最初の空行とする。検索と書き込みは`LockService.getScriptLock()`内で行う。

| Column | Write behavior |
| --- | --- |
| A | 書き込み禁止。A1のArrayFormulaを維持 |
| B | `formData.tadasukeName` |
| C | 空欄 |
| D | 空欄 |
| E | 空欄 |
| F | 評価シートへの表示名付きRichTextリンク |
| G以降 | GASからは一切操作しない |

F列の表示文字列は生成した評価シートのファイル名とする。

G列以降の数式は、GASによる行追加後も対象行へ自動的に反映されるよう、スプレッドシート側の
MAP関数（運用者が設定するスプレッドシート数式）で維持する。GAS側で数式を複製する実装は行わない。

同一`submissionId`で登録済みの場合、同じ行を返し新規行を作成しない。`submissionId`とindex行の対応はScript Propertiesの`INDEX_ROW_{submissionId}`へ保存する。

## 6. Input Validation

サーバー側で次を検証する。フロントエンド検証だけに依存しない。

| Field | Rule |
| --- | --- |
| `name` | non-empty、名前リストA列と完全一致 |
| `tadasukeName` | non-empty、最大100文字 |
| `startTime` | `YYYY-MM-DD`、実在日 |
| `challenge` | boolean |
| `freeText` | string、最大5000文字 |
| active user email | non-empty、メール形式 |

不正入力は外部操作を開始せず、`VALIDATION_ERROR`を返す。

## 7. Evaluation Sheet Provisioning

### 7.1 File Creation

1. `EVALUATION_SHEET_FOLDER_ID`のフォルダを取得する。
2. `設定用!E2`のテンプレートファイルを取得する。
3. 保存先フォルダへコピーする。
4. ファイル名を`★【{sanitizedTadasukeName}】評価項目チェックシート`とする。
5. 申込者メールをeditorとして追加する。
6. ファイルIDとURLを返す。

### 7.2 Name Sanitization

- 前後空白を除去
- 改行、タブ、制御文字を半角スペースへ置換
- 連続空白を1文字へ圧縮
- 空になった場合は`name`を使用

### 7.3 Idempotency

Script Properties:

```text
EVALUATION_FILE_{submissionId} = fileId
```

プロパティにfile IDがあり、ファイルへアクセスできる場合は既存ファイルを再利用する。アクセス不能、またはゴミ箱にある場合は失敗として記録し、無条件で再作成しない。

冪等性キーはテンプレート複製の成功直後（申込者への編集権限付与の前）に保存する。権限付与が失敗しても、再実行時は同じコピーを再利用して権限付与のみ再試行し、コピーが増殖しないようにする。既存ファイルを再利用する場合も、毎回編集権限の有無を確認し、必要なら再付与する。

同一`submissionId`でファイル名が重複する状況（同一講師の再申込など）は許容する。ファイル名だけを手掛かりに既存ファイルを探して流用することはしない。

### 7.4 Result

```javascript
{
  status: "success",
  fileId: string,
  fileName: string,
  url: string,
  reused: boolean
}
```

## 8. Chat Notification

### 8.1 Message

成功例:

```text
新しい申し込みがありました。

*申込ID*: {submissionId}
*申込者メールアドレス*: {email}
*お名前*: {name}
*タダスクネーム*: {tadasukeName}
*オリエンテーション参加日*: {startDate}
*チャレンジ講師*: {challenge}
*自由記載*: {freeText}
*評価項目チェックシート*: {evaluationSheetUrl}

サポート状況＆新講師申込フォーム：{spreadsheetUrl}
```

評価シート失敗例ではURL行を次へ置換する。

```text
*評価項目チェックシート*: 発行失敗・要手動対応
```

### 8.2 Delivery

- Webhookは`CHAT_WEBHOOK_URL`から取得
- `muteHttpExceptions: true`
- HTTP 200〜299だけ成功
- レスポンス本文にWebhookや入力データをログ出力しない
- 同一`submissionId`で成功済みなら再送しない

Script Property:

```text
CHAT_SENT_{submissionId} = ISO timestamp
```

## 9. Mail

### 9.1 Tags

| Tag | Replacement |
| --- | --- |
| `{{name}}` | お名前 |
| `{{tadasukeName}}` | タダスクネーム |
| `{{startDate}}` | 表示用参加日 |
| `{{challenge}}` | チャレンジ講師の選択結果 |
| `{{freeText}}` | 自由記載、空なら`なし` |
| `{{evaluationSheetUrl}}` | 評価シートURL |
| `{{responseSummary}}` | 回答控え |

置換後に`{{...}}`が残れば`MAIL_TEMPLATE_INVALID`とし送信しない。

### 9.2 Response Summary

```text
お名前: {name}
タダスクネーム: {tadasukeName}
参加希望日: {startDate}
チャレンジ講師: {challenge}
自由記載: {freeTextOrNone}
```

### 9.3 Delivery

- `MailApp.sendEmail()`を使用する
- 宛先はactive user email
- 評価シート発行・権限付与成功時のみ送信する
- 同一`submissionId`で成功済みなら再送しない

Script Property:

```text
MAIL_SENT_{submissionId} = ISO timestamp
```

## 10. Processing Order

1. `submissionId`生成
2. 入力検証
3. 設定取得・検証
4. Calendar予定作成または更新
5. 新規Calendar予定ならMeet追加
6. `申込リスト!A:I`とP/Q列へ保存
7. 評価シート発行・権限付与
8. `index`登録
9. Chat通知
10. 自動返信メール
11. Q列の状態更新
12. UIレスポンス返却

主要受付成功条件はCalendar処理と申込リスト保存の成功。7〜10の失敗は受付成功を取り消さない。

## 11. Error and Partial Success

### 11.1 Error Codes

| Code | Meaning | User success |
| --- | --- | --- |
| `VALIDATION_ERROR` | 入力不正 | no |
| `CONFIG_INVALID` | 必須設定不備 | no |
| `CALENDAR_FAILED` | Calendar/Meet失敗 | no |
| `SUBMISSION_WRITE_FAILED` | 申込保存失敗 | no |
| `EVALUATION_COPY_FAILED` | テンプレート複製失敗 | yes |
| `EVALUATION_PERMISSION_FAILED` | 編集権限付与失敗 | yes |
| `INDEX_WRITE_FAILED` | index登録失敗 | yes |
| `CHAT_FAILED` | Chat通知失敗 | yes |
| `MAIL_TEMPLATE_INVALID` | メールテンプレート不正 | yes |
| `MAIL_FAILED` | メール送信失敗 | yes |

### 11.2 Public Response

```javascript
{
  success: boolean,
  message: string,
  submissionId: string,
  operations: {
    calendar: "success" | "failed" | "skipped",
    submission: "success" | "failed" | "skipped",
    evaluationSheet: "success" | "failed" | "skipped",
    index: "success" | "failed" | "skipped",
    chat: "success" | "failed" | "skipped",
    mail: "success" | "failed" | "skipped"
  }
}
```

UIは`success`と`message`のみ表示する。

### 11.3 Structured Log

```javascript
{
  message: string,
  functionName: string,
  status: "START" | "SUCCESS" | "INFO" | "ERROR",
  submissionId: string,
  operation: string,
  errorCode: string,
  durationMs: number
}
```

ログ禁止項目:

- 氏名
- メールアドレス
- 自由記載
- Webhook URL
- メール本文
- OAuth token

## 12. Dry-Run Interface

### 12.1 Function

```javascript
function runDryTestSuite(options)
```

Input:

```json
{
  "suite": "all",
  "testIds": [],
  "now": "2026-06-13T12:00:00+09:00"
}
```

Output:

```json
{
  "suite": "all",
  "passed": 12,
  "failed": 0,
  "startedAt": "ISO timestamp",
  "finishedAt": "ISO timestamp",
  "tests": [
    {
      "id": "CFG-001",
      "status": "passed",
      "expected": "valid",
      "actual": "valid",
      "durationMs": 2
    }
  ]
}
```

dry-run adapterはSpreadsheet、Drive、Calendar、Chat、Mailへ書き込まず、予定された操作をメモリ上へ記録する。

## 13. Test Traceability

| Requirement | Test IDs | Layer |
| --- | --- | --- |
| 設定検証 | CFG-001〜CFG-006 | L1/L2 |
| 入力検証 | VAL-001〜VAL-006 | L1/L2 |
| ファイル命名 | EVAL-001〜EVAL-003 | L1 |
| 評価シート複製・権限 | EVAL-004〜EVAL-008 | L2/L3 |
| index登録 | IDX-001〜IDX-006 | L1/L2/L3 |
| Chat本文・HTTP判定 | CHAT-001〜CHAT-007 | L1/L2/L3 |
| メール置換・送信 | MAIL-001〜MAIL-009 | L1/L2/L3 |
| 部分成功 | FLOW-001〜FLOW-006 | L2/L3 |
| 冪等性・再実行 | IDEM-001〜IDEM-006 | L2/L3 |
| 既存回帰 | REG-001〜REG-010 | L2/L3/L4 |

具体ケースと要件対応は`TEST_CASES.md`を正とする。

## 14. Acceptance Example

Input:

```json
{
  "name": "山田 太郎",
  "tadasukeName": "たろう",
  "startTime": "2026-07-20",
  "challenge": false,
  "freeText": "よろしくお願いします。"
}
```

Expected:

- `申込リスト`へA〜I、P、Q列が保存される
- P列にUUIDが入る
- Calendar予定が作成または更新される
- 新規時だけMeetが追加される
- `★【たろう】評価項目チェックシート`が指定フォルダへ作成される
- 申込者へ編集権限が付与される
- `index`の新規行B列が`たろう`、F列が評価シートリンクになる
- Chatに申込IDと評価シートURLが含まれる
- 全タグ置換済みメールが届く
- 同じ`submissionId`の再実行で追加生成・再送しない
