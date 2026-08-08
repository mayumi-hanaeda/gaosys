# Technical Requirements Document (TRD)

Updated: 2026-08-08
Source of truth: Google Docs 正本「タダスク講師を始めてみたい人の申込みフォーム・仕様書」の
`技術要件定義書（TRD）`タブ。本ファイルはその派生であり、Google Docs側と乖離した場合は
Google Docs側を正として明示的にマージする。実装の詳細な確定仕様は`SPEC.md`を正とする。

## 1. システムアーキテクチャ・実行環境

- プラットフォーム: Google Apps Script (V8ランタイム)
- 実行コンテキスト: デプロイ担当者（`USER_DEPLOYING`）の権限で実行
- 利用する主要Googleサービス（API）:
  - `SpreadsheetApp`（スプレッドシートへのデータ読み書き）
  - `CalendarApp` / Advanced Calendar Service（カレンダー予定作成・更新）
  - `DriveApp`（評価シートのコピー、権限付与）
  - `MailApp`（自動返信メール送信）
  - `UrlFetchApp`（Google Chat WebhookへのHTTP POSTリクエスト）

## 2. 追加モジュールの技術設計方針

`saveFormData`関数から呼び出される独立した関数として、以下の処理モジュールを実装する。

### 2.1 評価シート生成モジュール

- 使用API: `DriveApp`
- 処理フロー:
  1. 設定用シートから「テンプレートファイルID」を取得。
  2. `DriveApp.getFileById(TEMPLATE_ID).makeCopy(newFileName, folder)` でファイルを複製（`folder`は`EVALUATION_SHEET_FOLDER_ID`が指す共有フォルダ）。
     - `newFileName = ★【${formData.tadasukeName}】評価項目チェックシート`
  3. コピーしたFileオブジェクトに対し、`.addEditor(email)`を実行して申込者に編集権限を付与。同一`submissionId`での再実行時は既存コピーを再利用し、権限を再確認・再付与する。
  4. `.getUrl()`メソッドでファイルのURL文字列を取得し、戻り値とする。
- 例外処理: 権限エラー（Drive API制限等）発生時はtry-catchで捕捉し、構造化エラーコード（`EVALUATION_COPY_FAILED`または`EVALUATION_PERMISSION_FAILED`）を呼び出し元へ返す。

### 2.2 indexシート連携（自動転記）モジュール

- 使用API: `SpreadsheetApp`、`LockService`
- 処理フロー:
  1. `LockService.getScriptLock()`内で`index`シートのB列の最初の空行を特定する。
  2. `getRange(targetRow, 2, 1, 5).setValues([[ formData.tadasukeName, "", "", "", fileName ]])`でB〜F列（5列）だけを書き込む。
  3. F列はさらに`RichTextValue`で評価シートへのハイパーリンクに設定する。
- 制約: A列には既存のArrayFormulaが入っているため、GASから一切書き込まない。`appendRow()`は使用せず、書き込み対象の列を明示して`setValues`を使用すること。

### 2.3 自動返信メール送信モジュール

- 使用API: `MailApp`
- 処理フロー:
  1. 設定用シートから「件名テンプレート」と「本文テンプレート」を取得。
  2. テンプレート内のプレースホルダ（`{{tadasukeName}}`、`{{evaluationSheetUrl}}`、`{{responseSummary}}`等）を実データへ置換。
  3. `MailApp.sendEmail({ to: email, subject: subject, body: body })`を実行。
- 例外処理: 未解決タグが残る場合は`MAIL_TEMPLATE_INVALID`として送信しない。送信失敗時は`MAIL_FAILED`を返す。

### 2.4 Google Chat通知拡張モジュール

- 使用API: `UrlFetchApp`
- 処理フロー: 既存の通知ペイロード構築処理を改修し、申込内容と評価シートの状態（URLまたは「発行失敗・要手動対応」）を含めて送信する。

## 3. 設定値の外部化要件（ハードコーディング禁止）

保守性確保のため、コード内に直接以下の値を記述することを禁止する。「設定用」シートまたはScript Propertiesに記載し、プログラムから動的に取得する。

| 設定項目 | 格納先（推奨） | データ型 |
| --- | --- | --- |
| テンプレートファイルID | 設定用シート（E2セル） | String |
| メール件名 | 設定用シート（F2セル） | String |
| メール本文 | 設定用シート（G2セル） | String |
| Webhook URL | Script Property `CHAT_WEBHOOK_URL` | String |
| 評価シート保存先フォルダID | Script Property `EVALUATION_SHEET_FOLDER_ID` | String |

## 4. エラーハンドリングとロギング戦略

- 独立したTry-Catch: 追加される各モジュール（シート作成、転記、メール送信）は、それぞれ独立したtry-catchブロックで囲む。これにより、例えば「メール送信に失敗したが、シート作成とカレンダー登録は成功した」という部分的な成功状態を維持し、全体がロールバックされるのを防ぐ。
- 構造化ログ: エラー発生時は`console.error(JSON.stringify({ ... }))`を使用し、エラー箇所、エラーメッセージ、`submissionId`（申込単位の相関ID）を構造化ログとして出力する。メールアドレス等の個人情報や秘密値はログへ出力しない。
- フェイルセーフなUI応答: バックエンドで「メール送信」や「シートコピー」に失敗した場合でも、主要な受付（カレンダー登録、申込リストへの記録）が完了していれば、フロントエンドには`success: true`を返す。システム管理者はGASのログを確認して手動フォローを行う。
