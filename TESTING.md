# Testing Strategy

Updated: 2026-06-13

## Goal

AIが可能な限り自律的に Red-Green-Refactor を実行し、テスト結果をコマンドから取得できる状態を作る。

ブラウザ操作だけに依存せず、次の順で速く安全なテストから実行する。

1. ローカル純粋関数テスト
2. GASドライラン
3. 非本番GAS統合テスト
4. Web UI E2Eテスト
5. 本番スモークテスト

## TDD Rule

各実装タスクは次のサイクルで進める。

1. 仕様の受入条件をテストケースへ変換する
2. 失敗するテストを追加し、失敗理由を確認する
3. 最小限の実装でテストを通す
4. 回帰テストを維持したままリファクタリングする
5. テストコマンド、結果、実行日時を証跡へ残す

テスト未作成の機能実装、失敗を確認していないテスト、手動確認だけの完了判定は原則として認めない。Googleの権限や外部サービスの制約で自動化できない項目は、理由と手動確認手順を記録する。

## Test Layers

### L0 Static Checks

対象:

- JavaScript構文
- 秘密情報の直書き
- 意図しないレガシーファイル変更
- `clasp status` の同期対象

想定コマンド:

```bash
node --check code.js
node --check チャット通知Bot.js
rg -n "chat.googleapis.com|key=|token=" .
node scripts/check-deployment.mjs
clasp status --user default
```

### L1 Local Unit Tests

日付生成、設定検証、テンプレート置換、通知本文生成、行データ生成、結果集約などをGAS APIから分離した純粋関数としてテストする。

- Node.js組み込みの `node:test` と `assert` を使い、依存パッケージを増やさない
- テストは `tests/*.test.mjs` に配置する
- GASへpushされないことを `.claspignore` と `clasp status` で保証する
- `DEPLOYMENT.md`と`ops/deployment-policy.json`に従い、tracked一覧と
  保護ファイルのハッシュがpreflightを通過すること
- `Date.now()`、タイムゾーン、メール送信などは引数またはadapterとして注入する

想定コマンド:

```bash
node --test tests/*.test.mjs
```

### L2 GAS Dry-Run Tests

GASランタイム上で動作させるが、Spreadsheet、Drive、Calendar、Chat、Mailへ変更を加えない。

公開テスト関数:

```javascript
function runDryTestSuite(options) {
  // JSON serializableなテスト結果を返す
}
```

要件:

- 外部操作はadapter経由にし、dry-run adapterは操作内容を記録するだけにする
- テストケースごとに `id`、`status`、`expected`、`actual`、`durationMs` を返す
- 全体結果に `passed`、`failed`、`startedAt`、`finishedAt` を含める
- 個人情報、Webhook、アクセストークンを戻り値やログへ含めない
- 失敗が1件でもあれば全体を失敗として判定できる形式にする

実行経路:

```bash
clasp run runDryTestSuite --params '[{"suite":"all"}]'
```

前提:

- Apps Script APIを有効化する
- API executableデプロイを作成する
- 実行者を最小権限に制限する

2026-06-14時点でAPI executableを`MYSELF`として設定済み。GASドライテストは
次のコマンドで実行できる。

```bash
clasp run runDryTestSuite --params '[{"suite":"all"}]' --user gaosys
```

### L3 Non-Production Integration Tests

実際のGoogleサービスへ接続するが、本番データから分離する。

- テスト用Spreadsheet、Calendar、Driveフォルダ、Chatスペース、メール宛先を使う
- 生成物には一意な `TEST_RUN_ID` と接頭辞 `[TEST]` を付ける
- テスト終了後に作成物を削除または専用領域へ隔離する
- 本番Webhook、本番申込者、本番カレンダーを使用しない
- 作成、更新、再実行、部分失敗、同時実行を検証する

公開テスト関数例:

```javascript
function runIntegrationTestSuite(options) {
  // 許可された非本番設定だけを使う
}
```

破壊的な統合テストは明示的な `confirmToken` がなければ開始しない。

`runIntegrationTestSuite(options)`はまず`preview`で設定を検証する。

```bash
clasp run runIntegrationTestSuite \
  --params '[{"mode":"preview","testRunId":"20260614T000000Z-preflight"}]' \
  --user gaosys
```

安全契約、必要なScript Properties、実行ゲートは
`INTEGRATION_TESTING.md`を参照する。

### L4 UI E2E Tests

Playwrightは次を担当する。

- Webアプリの表示と入力検証
- 名前サジェスト
- 送信中、成功、失敗表示
- 二重送信防止
- デスクトップ・モバイル表示

GAS内部テスト結果の取得は原則として `clasp run` を使う。API executableを利用できない場合のみ、管理者限定のテストUIまたはApps Script IDEをPlaywrightで操作する。

テストUIを設ける場合も、本番Webアプリには公開せず、管理者判定とdry-run固定を必須とする。

### L5 Production Smoke Test

本番反映後に管理者のテストアカウントで1件だけ実行する。通常の自動テストではなく、リリース判定の最終確認として扱う。

## Logs and Evidence

優先順位:

1. `clasp run` のJSON戻り値
2. `clasp logs` の構造化ログ
3. Playwrightの画面・コンソール・ネットワーク記録
4. 手動確認記録

標準GCPプロジェクト`gaosys-gas-runtime`を関連付け済みであり、次のコマンドで
構造化ログを取得できる。

```bash
clasp logs --simplified --user default
```

成功時は`GAOSYS_DRY_TEST_SUMMARY`として、合格数、失敗数、外部書き込み数だけを
記録する。

既存アプリの生ログには個人情報を含む行があるため、統合テスト証跡には
`GAOSYS_INTEGRATION_`で始まる構造化ログだけを抽出し、`clasp logs`の全出力を
保存しない。

テスト証跡は `output/test-results/` に保存し、個人情報と秘密情報を含めない。最低限、次を記録する。

- テストスイート名
- 対象バージョンまたは日時
- 実行コマンド
- 成功件数と失敗件数
- 失敗内容
- 手動確認が残る項目

## Required Test Cases

### Settings

- 必須設定が揃っている
- テンプレートID、メール件名、本文が欠落している
- Webhookが未設定
- 秘密情報がログへ出ない

### Evaluation Sheet

- 正しい名前と保存先で1件作成する
- 編集権限を付与する
- コピー失敗、権限付与失敗を部分失敗として記録する
- 再実行で重複作成しない

### index

- A列のArrayFormulaを保護し、B〜F列を仕様どおり設定する
- G列以降の既存数式を維持する
- 同時実行で行を上書きしない
- URLなしの場合を仕様どおり処理する

### Chat

- 評価シートURLを含む本文を生成する
- 非2xx応答を失敗として記録する
- Webhookを本文・ログへ出さない

### Mail

- すべての置換タグを解決する
- 未知または未設定タグを仕様どおり処理する
- 送信失敗でも申込受付を成功として維持する

### Existing Regression

- 名前マスターを取得する
- `申込リスト` H/I列を維持する
- Calendar予定を作成または更新する
- 新規予定だけMeetを追加する
- フォームの必須入力と名前照合が動作する

## Completion Gate

実装タスクを完了にするには、次をすべて満たす。

- 対応する失敗テストを先に確認している
- L1テストがすべて成功している
- 対象機能のL2ドライランが成功している
- 外部連携を変更した場合はL3統合テストが成功している
- UIを変更した場合はL4 E2Eテストが成功している
- テスト結果と未自動化項目が記録されている
