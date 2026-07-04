# 次作業ハンドオフ

更新日: 2026-07-05 JST
対象: タダスク講師を始めてみたい人の申込みフォーム

## 現在の基準

- 現在の本番 Web アプリは `@96`。
- 本番 URL は `.local/OPERATIONS.md` と `DEPLOYMENT.md` を参照する。
- 仕様書 Google ドキュメントは既存の正本を維持する。
- 運用者向け Google ドキュメントは以下。
  - `タダスク講師を始めてみたい人の申込みフォーム 運用マニュアル`
  - URL: `https://docs.google.com/document/d/1x1DZ4d-gZ266_QfK-YXer5XMIgXO3tcr-nFL5DkDJAA/edit?tab=t.0`
- Google ドキュメントへ反映した元原稿は `docs/OPERATIONS_MANUAL_GOOGLE_DOC.md`。

## 1. 不要ファイル削除の道しるべ

### 現状

Apps Script プロジェクト内に、現行アプリ本体以外のコードや古い検証ファイルが混在している。

`clasp status --user default` で現在 push 対象になるファイルは以下。

- Active:
  - `appsscript.json`
  - `code.js`
  - `domain.js`
  - `dry_run.js`
  - `index.html`
  - `integration_test.js`
  - `チャット通知Bot.js`
- Protected / legacy:
  - `architecture.html`
  - `のぐっちさんcss.html`
  - `のぐっちさんindex.html`
  - `ヤススさんcode.js`
  - `ヤススさんindex.html`
  - `仕様確認.js`
  - `無題.js`

`DEPLOYMENT.md` と `ops/deployment-policy.json` では、legacy 系は「既にリモートへ存在するため、通常作業で変更しない protected deployed files」として扱っている。

### 削除時の注意

- `clasp push` は、ローカルから外したファイルを Apps Script 側から削除する可能性がある。
- そのため、不要そうに見えるファイルも即削除しない。
- 削除する場合は、必ず次の順で進める。

1. `clasp pull` ではなく、まず `clasp status --user default` と `clasp deployments --user default` を確認する。
2. 削除候補が現在の `@96` 実行に不要であることを確認する。
3. `ops/deployment-policy.json` の分類を更新する。
4. `.claspignore` へ入れるだけでよいのか、Apps Script 側から本当に削除するのかを分ける。
5. 本番へ影響する削除は、ユーザー承認後に version 作成と既存 deployment 更新で行う。

### 優先削除候補

- `のぐっちさんcss.html`
- `のぐっちさんindex.html`
- `ヤススさんcode.js`
- `ヤススさんindex.html`
- `無題.js`

上記は legacy / experimental と記録されている。削除候補ではあるが、リモート削除リスクがあるため、次回は「削除してよいか」ではなく「削除すると現行 deployment の動作に影響しないか」を確認する。

### 要判断ファイル

- `architecture.html`
  - 参照資料。アプリ実行には不要と思われるが、既にリモートにある protected file。
- `仕様確認.js`
  - 仕様書 export / 管理用の可能性がある。用途確認後に判断。
- `dry_run.js`
  - 本番アプリ画面には不要だが、検証用関数として使う可能性がある。
- `integration_test.js`
  - 本番運用には不要だが、非本番統合テストの再実行に必要。
- `チャット通知Bot.js`
  - 旧方式の Chat 通知または補助通知の可能性がある。現在トリガーが残っていないか確認してから判断。

### 今回対応済み

- `temp/**` を `.claspignore` へ追加した。
- Google Docs 整形作業用の一時ファイル `temp/operations_manual_rendered.html` と `temp/serve-manual.ps1` は削除した。
- `clasp status --user default` で `temp` 配下が push 対象から外れたことを確認済み。

## 2. Script Properties 整理の道しるべ

### 現状

Script Properties には、本番用、テスト用、実行済み処理の記録用キーが混在している。

値の中には秘密値や個人情報に近いものがあるため、棚卸し時も値をログや文書へ貼らない。キー名と用途だけで整理する。

### 本番で必要なキー

以下は現行 @96 の本番動作に必要または推奨。

| Key | 用途 | 扱い |
| --- | --- | --- |
| `GAOSYS_SPREADSHEET_ID` | 管理スプレッドシート ID | 必須 |
| `CHAT_WEBHOOK_URL` | Google Chat 通知先 | 必須・秘密 |
| `EVALUATION_SHEET_FOLDER_ID` | 評価シート保存先フォルダ ID | 必須 |
| `LOGO_IMAGE_URL` | フォーム上部ロゴ | 任意 |
| `SUPPORT_STATUS_SPREADSHEET_URL` | Chat 通知に添える管理表 URL | 任意 |

評価シートのコピー元テンプレート ID は Script Properties ではなく、管理スプレッドシートの `設定用!E2`。

### 本番では通常不要または要確認のキー

| Key | 用途 | 次の扱い |
| --- | --- | --- |
| `GAOSYS_SPREADSHEET_ID_OVERRIDE` | 隔離検証時だけ Spreadsheet を差し替える | 本番では空または未設定にする。設定されていたら危険。 |
| `TEST_SPREADSHEET_ID` | 非本番統合テスト | 本番 Script では不要。テスト deployment を残すかで判断。 |
| `TEST_CALENDAR_ID` | 非本番統合テスト | 同上 |
| `TEST_EVALUATION_FOLDER_ID` | 非本番統合テスト | 同上 |
| `TEST_CHAT_WEBHOOK_URL` | 非本番 Chat | 同上・秘密 |
| `TEST_MAIL_RECIPIENT` | 非本番メール送信先 | 同上・個人情報に注意 |
| `LAST_PROCESSED_ROW` | 旧 Chat 通知 Bot の最終処理行 | `チャット通知Bot.js` のトリガー有無確認後に判断 |

`@98` のテスト deployment は Script Properties 未設定で動かない想定、と `DEPLOYMENT.md` に記録されている。テスト deployment を廃止するなら、関連 `TEST_*` は削除候補。

### 実行済み処理の記録キー

以下はファイル作成や通知の冪等性を保つために作られる実行記録。

| Key pattern | 用途 |
| --- | --- |
| `EVALUATION_FILE_{submissionId}` | 申込ごとの評価シートファイル ID |
| `INDEX_ROW_{submissionId}` | 申込ごとの index 行番号 |
| `CHAT_SENT_{submissionId}` | Chat 通知済み記録 |
| `MAIL_SENT_{submissionId}` | 自動返信メール送信済み記録 |

これらは「作ったファイルの保存」に見えるが、同じ `submissionId` の再実行で二重作成・二重通知を避けるための記録でもある。

ただし長期運用では Script Properties が肥大化する。次回の設計課題:

- これらを Script Properties に永続保存し続けるか。
- 申込リストの Q列 JSON または別の台帳シートへ寄せるか。
- 一定期間後に削除してよいか。
- 削除するなら、どの証跡を残すか。

現時点では、実行記録キーを一括削除しない。削除する場合は、対象 `submissionId` と申込リスト Q列、index、Drive ファイル、送信済み通知の関係を確認してから行う。

### 整理手順案

1. Apps Script 画面で Script Properties のキー名だけを一覧化する。
2. 値はコピーしない。秘密値は表示しない。
3. 上記表の `必須`, `任意`, `テスト`, `実行記録`, `用途不明` に分類する。
4. `GAOSYS_SPREADSHEET_ID_OVERRIDE` が本番に入っていないことを最優先で確認する。
5. `TEST_*` は @98 / 非本番テストを継続するか決めてから削除する。
6. `EVALUATION_FILE_*`, `INDEX_ROW_*`, `CHAT_SENT_*`, `MAIL_SENT_*` は保持方針を決めてから削除または移行する。

## 3. 中断・未解決課題

- 本番 @96 で Calendar 登録が現在も失敗するか、最新状態の再確認が必要。
- `設定用!B2` の Calendar ID と、本番 deployment 実行アカウントの書き込み権限が一致しているか未確認。
- 本番 deployment の最終デプロイ者は `clasp deployments` では分からない。必要なら Google Workspace / Admin 監査ログまたは Apps Script 側の活動履歴で確認する。
- @96 での「同じタダスクネームの2回目以降申込」が、実フォームで成功するか未検証。
- `@90/@92` など調査用 deployment の扱いが未決定。不要なら undeploy 候補だが、本番影響確認と承認が必要。
- `@98` テスト deployment は Script Properties 未設定で動かない想定。残すか削除するか未決定。
- Google Docs 運用マニュアルは作成済みだが、運用者レビューは未実施。
- Google Docs 運用マニュアルと GitHub 側 `docs/OPERATIONS_MANUAL_GOOGLE_DOC.md` の同期ルールが未決定。
- `docs/SETTINGS_SHEET_MANUAL.md` は `C:\GAOSYS２\docs` 側に作成済みで、`gaosys-github` 側にはまだ統合していない。必要なら統合先を決める。
- `SESSION_HANDOFF.md` は古い情報が多い。今回の `NEXT_WORK_HANDOFF.md` を基準に整理し直す必要がある。
- ルート `C:\GAOSYS２\HANDOVER.md` と `gaosys-github\SESSION_HANDOFF.md` のどちらを正とするか未整理。
- `ops/deployment-policy.json` と `DEPLOYMENT.md` は active/protected files を管理しているが、実際の不要ファイル削除方針はまだ未反映。
- `clasp status` は `.claspignore` の対象外にしたものを push 対象にする。作業用ディレクトリを作る場合は必ず `.claspignore` を先に確認する。

## 4. 次回最初にやること

1. `git status --short` でユーザー変更と今回のハンドオフ変更を確認する。
2. `npx clasp deployments --user default` で @96 / @98 / 調査用 deployment の現状を再確認する。
3. `npx clasp status --user default` で push 対象に不要ファイルが混ざっていないか確認する。
4. Script Properties は値を出さず、キー名だけを分類する。
5. 削除作業へ進む前に、削除候補リストと影響範囲をユーザーへ提示して承認を得る。
