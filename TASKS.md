# Implementation Tasks

Updated: 2026-08-08

## Purpose

このファイルをオンボーディング自動化の実行管理表とする。実装は、仕様の確定、テスト基盤、セキュリティ対応、TDDによる機能実装、実機検証、リリースの順に進める。

仕様の基準は次の順で扱う。

1. 本ファイルで承認済みとなった決定事項
2. `architecture.html` の追加仕様・検収条件
3. 現行の `code.js`、`index.html`、`チャット通知Bot.js`
4. `SESSION_HANDOFF.md`
5. 旧仕様・レガシーファイル

旧仕様にある申込リストのJ/K列は使用せず、現行のH列「カレンダーID」、I列「開催日時Data」を正とする。

## Status

- `[ ]` 未着手
- `[-]` 進行中
- `[x]` 完了
- `[!]` 要判断・ブロック中

タスクを完了にする際は、関連ドキュメントと手動テスト結果も同時に更新する。コード変更のみでは完了としない。

すべての実装タスクは `TESTING.md` の Red-Green-Refactor とCompletion Gateに従う。

## Phase 0: Baseline

### DOC-001 現行仕様のベースラインを固定する

- Status: `[x]`
- Priority: P0
- Source: `architecture.html` セクション01〜03、`SESSION_HANDOFF.md`
- Deliverables:
  - `CURRENT_STATE.md`
- Acceptance:
  - `getMasterData()`、申込保存、Calendar、Meet、Chatの現行動作が文書化されている
  - `申込リスト` H/I列を正とすることが明記されている

### DOC-002 未決定事項を決定記録にする

- Status: `[x]`
- Priority: P0
- Source: `architecture.html` セクション04〜05
- Dependencies: DOC-001
- Decisions required:
  - 評価シートの保存先をマイドライブ、管理フォルダ、共有ドライブのどれにするか
  - 評価シート名に使用する値を「お名前」「タダスクネーム」のどちらにするか
  - `index` A〜F列へ設定する初期値
  - メール本文の置換タグ名と未設定時の扱い
  - 評価シート発行失敗時にメールを送るか
  - 同一人物・同一日時の再申込時の扱い
- Deliverables:
  - `DECISIONS.md`
- Acceptance:
  - 各項目に決定内容、理由、決定日、影響範囲が記録されている
  - 後続実装が推測なしで着手できる

### DOC-003 データ・設定・インターフェース仕様を確定する

- Status: `[x]`
- Priority: P0
- Source: `architecture.html` の追加設定と検収条件
- Dependencies: DOC-002
- Deliverables:
  - `SPEC.md`
- Required content:
  - `設定用!A2:G2` の項目、型、必須条件、既定値
  - `申込リスト` と `index` の書込列定義
  - メール置換タグ一覧
  - Chat通知フォーマット
  - 追加処理の成功・部分成功・失敗レスポンス
- Acceptance:
  - 入出力例が1件以上ある
  - 個人情報と秘密情報の保存場所が区別されている

## Phase 1: Test Infrastructure

### TDD-001 テストケースを仕様へ紐づける

- Status: `[x]`
- Priority: P0
- Source: `SPEC.md`、`TESTING.md`
- Dependencies: DOC-003
- Deliverables:
  - `TEST_CASES.md`
- Acceptance:
  - 各P0/P1要件に正常系と異常系のテストがある
  - 自動化できない項目に理由と手動手順がある

### TDD-002 ローカル単体テスト基盤を作る

- Status: `[x]`
- Priority: P0
- Source: `TESTING.md` L0〜L1
- Dependencies: TDD-001
- Scope:
  - Node.js組み込みテストランナー
  - GAS APIに依存しない純粋関数の分離
  - `tests/*.test.mjs`
  - `.claspignore`
- Acceptance:
  - `node --test tests/*.test.mjs` をAIが実行して結果を取得できる
  - 失敗テストが非0終了コードを返す
  - テストファイルと証跡が`clasp push`対象外である
- Evidence:
  - Red: `domain.js`未実装で`ENOENT`、終了コード1
  - Green: 12 tests passed、終了コード0
  - Result: `output/test-results/TDD-002-unit.xml`
  - `clasp status`: `domain.js`のみtracked、`tests/`と`output/`はuntracked

### TDD-003 GASドライランテスト基盤を作る

- Status: `[x]`
- Priority: P0
- Source: `TESTING.md` L2
- Dependencies: TDD-002
- Scope:
  - 外部操作adapter
  - 書き込みを行わないdry-run adapter
  - `runDryTestSuite(options)`
  - JSON形式のテスト結果
- Acceptance:
  - GAS互換の公開関数`runDryTestSuite(options)`を実装している
  - ローカルVMでSpreadsheet、Drive、Calendar、Chat、Mailを変更せず実行できる
  - 結果JSONから成功・失敗ケースを識別できる
  - 戻り値とログに個人情報・秘密情報を含まない
- Evidence:
  - Red: `dry_run.js`未実装でDRY-001〜004が4件失敗、終了コード1
  - Green: 全16 tests passed、終了コード0
  - Dry suite: 12 passed / 0 failed / external writes all zero
  - Results:
    - `output/test-results/TDD-003-tests.xml`
    - `output/test-results/TDD-003-dry-run.json`
  - Remote verification: `clasp run`はTDD-004のAPI executable設定後に実施

### TDD-004 claspによるリモート実行基盤を整備する

- Status: `[x]`
- Priority: P0
- Source: `TESTING.md` L2、Logs and Evidence
- Dependencies: TDD-003
- Scope:
  - Apps Script APIの有効化
  - 最小権限のAPI executableデプロイ
  - 標準GCPプロジェクトの関連付け
  - Cloud Logging設定
- Acceptance:
  - `clasp run runDryTestSuite` をAIが実行できる
  - `clasp logs` をAIが取得できる
  - API executableが組織外へ公開されていない
  - 設定変更と必要権限が文書化されている
- Evidence:
  - 標準GCPプロジェクト: `gaosys-gas-runtime`（`191275116698`）
  - Apps Script API、Calendar API、Cloud Logging APIを有効化
  - OAuthは組織内部向け、明示した6スコープのみを使用
  - API executable v79、アクセス範囲`MYSELF`
  - Remote dry suite: 12 passed / 0 failed / external writes all zero
  - `clasp logs`で`GAOSYS_DRY_TEST_SUMMARY`を取得
  - 既存Webアプリの`DOMAIN`公開範囲は変更なし
  - 詳細は`CLOUD_SETUP.md`を参照

### TDD-005 非本番統合テスト環境を用意する

- Status: `[x]`
- Priority: P0
- Source: `TESTING.md` L3
- Dependencies: TDD-004
- Scope:
  - テスト用Spreadsheet、Calendar、Driveフォルダ、Chat、メール宛先
  - `TEST_RUN_ID`による生成物識別
  - cleanup処理と誤実行防止
- Acceptance:
  - 本番データへ触れずに外部連携を実行できる
  - 作成物をテスト単位で追跡・削除できる
  - 破壊的テストは明示確認なしに開始しない
- Progress:
  - `integration_test.js`へ設定検証、確認トークン、`TEST_RUN_ID`、
    cleanup所有権判定を実装
  - INTG-001〜005を追加し、全21ローカルテスト成功
  - GAS上の`preview`で外部書き込み0を確認
  - 専用Spreadsheet、Calendar、Drive folder、非公開Chat space、受信箱を設定
  - 確認トークン付き実行で5 passed / 0 failed
  - Spreadsheet、Calendar、Driveのテスト生成物をcleanup済み
  - Chatメッセージと受信メールをPlaywrightで確認
  - 設定・安全手順は`INTEGRATION_TESTING.md`を参照
- Evidence:
  - `output/test-results/TDD-005-tests.xml`
  - `output/test-results/TDD-005-integration.json`

## Phase 2: Security and Operations

### SEC-001 Chat Webhookをローテーションする

- Status: `[x]`
- Priority: P0
- Source: `architecture.html` セクション08、`SESSION_HANDOFF.md`
- Dependencies: DOC-003
- Deliverables:
  - 新しいWebhookをScript Propertiesへ登録
  - 旧Webhookを失効
  - ソースコードからWebhook URLを削除
- Acceptance:
  - リポジトリ内を検索してWebhook URLやトークンが存在しない
  - Script Propertiesから取得したURLでテスト通知が成功する
  - ローテーション日時と実施者が運用記録に残る
- Evidence:
  - 2026-06-15 JSTに新Webhookを`CHAT_WEBHOOK_URL`へ登録
  - 旧WebhookをGoogle Chatから削除
  - `runProductionChatWebhookSmokeTest`: HTTP 200
  - ローカルテスト: 29 passed / 0 failed
  - API executable v81、アクセス範囲`MYSELF`
  - 詳細は`CLOUD_SETUP.md`を参照

### OPS-001 デプロイ対象を明確化する

- Status: `[x]`
- Priority: P0
- Source: `AGENTS.md`、`.clasp.json`
- Deliverables:
  - 現行ファイルとレガシーファイルの区分
  - `clasp push`前チェックリスト
- Acceptance:
  - `architecture.html` やレガシー実装を誤って本番変更しない手順がある
  - `clasp status` の確認結果をリリース記録へ残す運用が定義されている
- Evidence:
  - `DEPLOYMENT.md`に現行7件、保護7件、ローカル専用を分類
  - `scripts/check-deployment.mjs`でtracked一覧、保護ファイルの存在、ignoreを検査
  - 実環境preflight: `ok: true`、tracked 14件、errors 0件
  - ローカルテスト: 33 passed / 0 failed
  - `output/test-results/OPS-001-preflight.json`
  - `output/test-results/OPS-001-tests.xml`

### OPS-002 障害時の回復手順を定義する

- Status: `[x]`
- Priority: P0
- Source: `architecture.html` の部分成功設計・高リスク項目
- Dependencies: DOC-003
- Deliverables:
  - `RUNBOOK.md`
- Required content:
  - Calendarのみ作成された場合
  - 申込保存後に評価シート発行が失敗した場合
  - index、Chat、メールの各処理が失敗した場合
  - 再実行時の重複確認方法
- Acceptance:
  - 運営担当者がコードを変更せず復旧または開発者へ連携できる
- Evidence:
  - `RUNBOOK.md`に現行本番の制約と実装後の復旧手順を分離
  - Calendar孤立、評価シート、index、Chat、メール、再実行を網羅
  - 削除前確認、バックアップ、同一`submissionId`再実行を必須化
  - ローカルテスト: 36 passed / 0 failed
  - `output/test-results/OPS-002-tests.xml`

## Phase 3: Implementation

### IMP-001 設定値の読み込みと検証を実装する

- Status: `[x]`
- Priority: P1
- Source: `SPEC.md`
- Dependencies: DOC-003
- Scope:
  - `設定用!E2`: 評価シートテンプレートID
  - `設定用!F2`: メール件名
  - `設定用!G2`: メール本文
  - Script Properties: Chat Webhook
- Acceptance:
  - 設定欠落の失敗テストを先に追加している
  - 必須設定の欠落を構造化ログで特定できる
  - 秘密情報をログへ出力しない
- Evidence:
  - Red: 設定ローダー未実装でCFG-007〜010が4件失敗
  - Green: 全40件成功
  - `設定用!A2:G2`を1回で読み、Script Properties 2キーと統合
  - リモート状態確認で不足4項目を値なしで特定
  - 構造化ログに`CONFIG_INVALID`と不足キー名だけを記録
  - API executable v82、アクセス範囲`MYSELF`
  - `output/test-results/IMP-001-tests.xml`
  - `output/test-results/IMP-001-preflight.json`
  - `output/test-results/IMP-001-remote.json`

### IMP-002 評価シート発行を実装する

- Status: `[x]`
- Priority: P1
- Source: F-01、`SPEC.md`
- Dependencies: IMP-001
- Scope:
  - `DriveApp`によるテンプレート複製
  - 決定済み命名規則の適用
  - 申込者への編集権限付与
  - 評価シートURLの返却
- Acceptance:
  - コピー、権限付与、再実行の失敗テストを先に追加している
  - 正しいテンプレート、ファイル名、保存先で1ファイル生成される
  - 申込者が編集権限を持つ
  - 失敗時に既存の申込受付結果を取り消さない
- Evidence:
  - Red: `provisionEvaluationSheet_`未実装でEVAL-004〜008が5件失敗
  - Green: 全45件成功
  - `DriveApp`でテンプレートを保存先フォルダへコピー
  - ファイル名は`★【{タダスクネーム}】評価項目チェックシート`
  - 申込者メールをeditorへ追加
  - `EVALUATION_FILE_{submissionId}`で冪等に再利用
  - 既存file IDがアクセス不能な場合は無条件再作成しない
  - 既存申込フローへは未接続のため受付動作への影響なし
  - 実Drive作成は本番設定未完了のため未実行
  - `output/test-results/IMP-002-tests.xml`
  - `output/test-results/IMP-002-preflight.json`
- 2026-08-08 JST 不具合修正:
  - 不具合: 同一講師の連続申込で、ファイル名一致による探索（`findEvaluationFileByName_`、未仕様）が過去の評価シート（ゴミ箱内も含む）を誤って発見し、権限付与に失敗して`EVALUATION_PERMISSION_FAILED`になっていた
  - 対応: `findEvaluationFileByName_`を削除し、`submissionId`のみを冪等キーとする仕様（`SPEC.md` 7.3節）どおりに一本化。申込単位で新しい評価シートを作成する（同名ファイルの重複を許容）
  - 追加修正: 冪等性キーをコピー成功直後（権限付与前）に保存し、権限付与だけが失敗した場合の孤立コピー増殖を防止。既存ファイル再利用時も毎回権限を再確認・再付与。冪等性キーが指すファイルがゴミ箱にある場合は再利用せず失敗として扱う
  - Red→Green: `tests/evaluation_provisioning.test.mjs`にEVAL-009〜012を追加、ローカル全69件成功
  - E2E回帰: `tests/flow_orchestration.test.mjs`にE2E-EVAL-001/002を追加し、実装（スタブでない）`provisionEvaluationSheet_`を`saveFormData`全体フローで実行。Calendar・申込保存・Chatへの影響がないことを確認、ローカル全71件成功
  - `SPEC.md` 7.3節、`RUNBOOK.md`（評価シート発行失敗・再実行前の重複確認）を実装と一致するよう更新
  - 本番未反映（`@86`は無影響）。index G列以降の数式複製漏れ（別件）はスプレッドシート側のMAP関数で対応予定のためコード変更なし

### IMP-003 index自動転記を実装する

- Status: `[x]`
- Priority: P1
- Source: F-02、`SPEC.md`
- Dependencies: IMP-002
- Scope:
  - A〜F列の一括書き込み
  - B列への決定済み氏名、F列への評価シートURL設定
  - `LockService`による同時実行対策
- Acceptance:
  - 行生成、同時実行、URL欠落の失敗テストを先に追加している
  - 最終行の次へ1行だけ追加される
  - 同時実行でも同じ行を上書きしない
  - URLが発行できなかった場合の値が仕様どおりである
- Evidence:
  - Red: `registerIndexRow_`未実装でIDX-002〜006が5件失敗
  - Green: 全50件成功
  - `index`シートのB〜F列へ1回の`setValues`で転記
  - F列は評価シート名を表示し、評価シートURLをRichTextリンクへ設定
  - `LockService`内で空行を確保し、B列の先頭空行を使用
  - `INDEX_ROW_{submissionId}`で冪等に既存行を再利用
  - 評価シートURL欠落時は未書込で`INDEX_WRITE_FAILED`
  - 既存申込フローへは未接続のため受付動作への影響なし
  - `output/test-results/IMP-003-tests.xml`
  - `output/test-results/IMP-003-preflight.json`

### IMP-004 Chat通知を拡張する

- Status: `[x]`
- Priority: P1
- Source: F-03、`SPEC.md`
- Dependencies: SEC-001、IMP-002
- Scope:
  - 評価シートURLを通知へ追加
  - WebhookをScript Propertiesから取得
  - HTTPステータスとレスポンスの検証
- Acceptance:
  - 本文生成と非2xx応答の失敗テストを先に追加している
  - 通知に申込内容と評価シートURLが含まれる
  - 非2xx応答を成功扱いにせず構造化ログへ記録する
  - Webhook URLをログへ出力しない
- Evidence:
  - Red: `notifyOnboardingChat_`未実装でCHAT-006〜007が2件失敗
  - Green: 全52件成功
  - `GaosysDomain.buildChatMessage()`で申込ID、申込内容、評価シートURL、管理表URLを生成
  - Webhook URLはScript Propertiesの`CHAT_WEBHOOK_URL`から取得
  - HTTP 200〜299のみ成功扱い
  - 成功時だけ`CHAT_SENT_{submissionId}`を保存し、再実行では再送しない
  - 非2xx時は`CHAT_FAILED`を返し送信済みPropertyを保存しない
  - Webhook URLやレスポンス本文を戻り値へ含めない
  - 既存申込フローへは未接続のため受付動作への影響なし
  - `output/test-results/IMP-004-tests.xml`
  - `output/test-results/IMP-004-preflight.json`

### IMP-005 自動返信メールを実装する

- Status: `[x]`
- Priority: P1
- Source: F-04、`SPEC.md`
- Dependencies: IMP-001、IMP-002
- Scope:
  - 設定用シートから件名・本文を取得
  - 名前、評価シートURL、フォーム回答控えを置換
  - 申込者メールアドレスへ送信
- Acceptance:
  - テンプレート置換と送信失敗のテストを先に追加している
  - すべての置換タグが解決されたメールが届く
  - 宛先、件名、本文が仕様例と一致する
  - メール失敗時も既存の申込受付は成功として維持される
- Evidence:
  - Red: `sendAcknowledgementMail_`未実装でMAIL-006〜009が4件失敗
  - Green: 全56件成功
  - `GaosysDomain.renderMailTemplate()`で件名・本文のタグを解決
  - `MailApp.sendEmail()`へ宛先、件名、本文を渡す
  - 評価シートURL欠落時は`skipped`で送信しない
  - テンプレート不正時は`MAIL_TEMPLATE_INVALID`で送信しない
  - 送信成功時だけ`MAIL_SENT_{submissionId}`を保存し、再実行では再送しない
  - MailApp例外時は`MAIL_FAILED`を返し送信済みPropertyを保存しない
  - 既存申込フローへは未接続のため受付動作への影響なし
  - `output/test-results/IMP-005-tests.xml`
  - `output/test-results/IMP-005-preflight.json`

### IMP-006 追加処理を申込フローへ統合する

- Status: `[!]`
- Priority: P1
- Source: `architecture.html` の部分成功フロー
- Dependencies: IMP-002、IMP-003、IMP-004、IMP-005
- Scope:
  - 各追加処理を独立したエラー境界で実行
  - 処理結果を申込単位で追跡できる構造化ログ
  - 二重送信・再実行に対する冪等性
- Acceptance:
  - 部分失敗と再実行のシナリオテストを先に追加している
  - 追加機能1件の失敗で既存の申込保存を失敗扱いにしない
  - どの処理が成功・失敗したかログから追跡できる
  - 再実行で評価シート、index行、メールが意図せず重複しない
- Evidence:
  - Red: `saveFormData()`未接続でFLOW-001〜006相当が5件失敗
  - Green: ローカル全61件成功
  - `submissionId`を外部処理前に生成
  - `申込リスト` P列へ申込ID、Q列へ許可状態だけのJSONを保存
  - 評価シート、index、Chat、メールを独立した失敗境界で実行
  - 追加処理の部分失敗時も受付`success: true`を維持
  - Calendar失敗、設定不備、申込保存失敗は受付失敗として返却
  - 構造化ログは同じ`submissionId`で追跡し、Webhook URLやメールアドレスを含めない
  - `output/test-results/IMP-006-tests.xml`
  - `output/test-results/IMP-006-preflight.json`
- Deploy Gate:
  - 未反映。ユーザー指示により、本番稼働維持を最優先しdeployしない
  - 2026-06-16 JSTに不足設定を追加し、`getApplicationConfigurationStatus`は`ok: true`
  - 反映は別途、本番停止リスクのレビューと明示承認後に行う

## Phase 4: Verification

### TST-001 静的レビューを実施する

- Status: `[x]`
- Priority: P1
- Dependencies: IMP-006
- Checks:
  - 秘密情報・個人情報のログ出力
  - H/I列互換性
  - レガシーファイルへの意図しない変更
  - Apps Script権限スコープの増加
  - タイムゾーンと日付変換
- Acceptance:
  - 指摘事項が解消済み、または受容理由付きで記録されている
- Evidence:
  - 指摘: ローカルIMP-006の`saveFormData()`がサーバー側入力検証を呼んでいなかった
  - 対応: `GaosysDomain.validateFormInput()`を外部書込前に接続
  - 対応: FLOW-007を追加し、検証失敗時に設定取得・Calendar・申込保存が走らないことを確認
  - 秘密情報・個人情報ログ: 新規オンボーディングログは`submissionId`、operation、errorCodeのみ
  - H/I列互換性: 既存Calendar検索はH/I列のまま維持
  - レガシーファイル: `ヤススさん*`、`のぐっちさん*`、`無題.js`への編集なし
  - Apps Script権限スコープ: `appsscript.json`のOAuth scope変更なし
  - タイムゾーン: `Asia/Tokyo`と既存`Utilities.formatDate()`運用を維持
  - deployなし。現行本番deployment `@86`を維持
  - ローカルテスト: 62 passed / 0 failed
  - preflight: `ok: true`

### TST-002 非本番で正常系を実機確認する

- Status: `[x]`
- Priority: P1
- Source: `architecture.html` の検収条件
- Dependencies: TST-001
- Acceptance:
  - 氏名サジェストが取得できる
  - `申込リスト`へ正しい値が保存される
  - Calendar予定とMeetが作成または更新される
  - 評価シートが正しい名前で作成され編集できる
  - `index` B・F列へ正しく転記される
  - Chat通知に評価シートURLが含まれる
  - 置換済みメールが申込者へ届く
  - Apps Script実行ログに未処理エラーがない
  - `clasp run`の結果JSONと`clasp logs`をテスト証跡として保存している
- Evidence:
  - deployなし。現行本番deployment `@86`を維持
  - 非本番統合preview: `ok: true`、planned targets 5件、external writes 0
  - 非本番統合execute: 5 passed / 0 failed
  - Spreadsheet、Calendar、Driveはテスト作成物をcleanup済み
  - Chat、Mailは専用非本番宛先へ送信
  - フィルタ済みログにTEST_RUN_IDと統合サマリを保存
  - 証跡にWebhook URL、メールアドレス、OAuth値なし
  - ローカルテスト: 62 passed / 0 failed
  - preflight: `ok: true`
  - `output/test-results/TST-002-preview.json`
  - `output/test-results/TST-002-execute.json`
  - `output/test-results/TST-002-logs-filtered.txt`
- Isolated service-flow Evidence:
  - テスト専用GCPプロジェクト`gaosys-gas-test-runtime`（project number `769410976001`）を`tadakayo.jp`組織配下に作成済み
  - 隔離Apps Scriptプロジェクト`[TEST] GAOSYS IMP-006 Isolated`（`YOUR_ISOLATED_APPS_SCRIPT_ID`）を作成済み
  - 2026-06-18 JST: 隔離Apps Scriptをテスト用GCPへ関連付け済み
  - 2026-06-18 JST: 隔離`runDryTestSuite`は12 passed / 0 failed、external writes 0
  - 2026-06-18 JST: 隔離`clasp logs`取得成功
  - 2026-06-18 JST: 隔離統合previewは`ok: true`、external writes 0
  - 2026-06-18 JST: 隔離統合executeは5 passed / 0 failed
  - 2026-06-18 JST: Spreadsheet、Calendar、Driveのテスト作成物はcleanup済み
  - 2026-06-18 JST: Chat、Mailは専用非本番宛先への送信のみ
  - 2026-06-18 JST: `GAOSYS_SPREADSHEET_ID_OVERRIDE`を使い、隔離Apps Scriptのみテスト用Spreadsheetへ参照を差し替え
  - 2026-06-18 JST: 隔離`saveFormData()` smokeはcalendar、submission、evaluationSheet、index、chat、mailすべてsuccess
  - 2026-06-18 JST: 隔離`saveFormData()` smokeの申込行、Calendar予定、評価シート、index行はcleanup済み
  - 証跡:
    - `output/test-results/TST-002-isolated-dry-run-20260617.json`
    - `output/test-results/TST-002-isolated-logs-20260617.txt`
    - `output/test-results/TST-002-isolated-provision-20260618.json`
    - `output/test-results/TST-002-isolated-fullflow-20260618.json`
    - `output/test-results/TST-002-isolated-fullflow-logs-20260618.txt`
    - `output/test-results/TST-002-isolated-saveformdata-20260618.json`
    - `output/test-results/TST-002-isolated-saveformdata-logs-20260618.txt`
- Remaining:
  - なし。TST-002の非本番正常系確認は完了

### TST-003 異常系と再実行を実機確認する

- Status: `[x]`
- Priority: P1
- Dependencies: TST-002、OPS-002
- Scenarios:
  - テンプレートID不正
  - 編集権限付与失敗
  - index書き込み失敗
  - Chat非2xx応答
  - メール送信失敗
  - 同一申込の再実行
  - 2件の同時申込
- Acceptance:
  - 各ケースが`SPEC.md`と`RUNBOOK.md`どおりに処理される
  - 既存申込、Calendar、Meetに予期しない回帰がない
- Evidence:
  - deployなし。現行本番deployment `@86`を維持
  - 隔離Apps Scriptとテスト専用GCP/Spreadsheet/Calendar/Drive/Chat/Mailのみ使用
  - テンプレートID不正: evaluationSheet failed、index/mail skipped
  - 編集権限付与失敗: evaluationSheet failed、index/mail skipped
  - indexシート欠落: index failed、Chat/Mail継続
  - Chat送信失敗: chat failed、Mail継続
  - メールテンプレート不正: mail failed
  - 同一submissionId再実行: 申込行1件、index行1件、成功済み後続処理はreused
  - 同一日時2申込: 各submissionIdの申込行1件ずつ、データ破壊なし
  - TST-003初回実行で同一submissionId再実行時に申込行が2行になる不具合を検出し、P列`submissionId`既存行再利用で修正
  - ローカルテスト: 64 passed / 0 failed
  - preflight: `ok: true`
  - `output/test-results/TST-003-isolated-abnormal-20260618.json`
  - `output/test-results/TST-003-isolated-abnormal-logs-20260618.txt`

### TST-004 PlaywrightでWeb UI回帰テストを実施する

- Status: `[x]`
- Priority: P1
- Dependencies: TST-002
- Scope:
  - 初期表示、名前サジェスト、必須入力
  - 送信中、成功、失敗表示
  - 二重送信防止
  - デスクトップ・モバイル表示
- Acceptance:
  - UI変更がある場合は対象シナリオが自動実行される
  - コンソールエラーと失敗したネットワークリクエストがない
  - スクリーンショットまたは実行結果が証跡として保存されている
- Evidence:
  - deployなし。現行本番deployment `@86`を維持
  - ローカル生成ページ `output/playwright/tst004/index.html` を使用し、本番Apps Scriptは呼び出しなし
  - 初期表示、必須入力、未登録名警告、名前サジェスト、日付選択、送信成功、送信失敗、モバイル表示を確認
  - コンソールエラー: 0
  - 失敗ネットワークリクエスト: 0
  - `output/test-results/TST-004-playwright-ui-20260618.json`
  - `output/playwright/tst004/mobile-initial.png`
  - `output/playwright/tst004/mobile-success.png`
  - `output/playwright/tst004/desktop-success.yml`
  - `output/playwright/tst004/desktop-failure.yml`

## Phase 5: Release

### REL-001 リリース判定を行う

- Status: `[x]`
- Priority: P1
- Dependencies: TST-002、TST-003
- Deliverables:
  - テスト証跡
  - 変更ファイル一覧
  - 設定変更一覧
  - 既知の制約とロールバック手順
- Acceptance:
  - 検収条件5点がすべて合格している
  - P0/P1の未解決ブロッカーがない
  - `clasp status` のpush対象がレビュー済みである
- Evidence:
  - deployなし。現行本番deployment `@86`を維持
  - 判定: 明示承認がある場合のみ本番反映へ進める条件付きGo
  - 検収条件5点: Calendar/Meet、評価シート発行と権限、index B/F転記、URL付きChat、置換済みメールは非本番実機で合格
  - ローカルテスト: 64 passed / 0 failed
  - preflight: `ok: true`
  - `clasp status`: push対象14件を確認済み
  - `tests/`、`scripts/`、`ops/`、`output/`、ドキュメント類は`.claspignore`でpush対象外
  - `output/test-results/REL-001-release-readiness-20260618.json`

### REL-002 本番反映とスモークテストを行う

- Status: `[!]`
- Priority: P1
- Dependencies: REL-001
- Acceptance:
  - `clasp push`後に対象デプロイが更新されている
  - 本番で管理者による1件のスモークテストが成功する
  - Calendar、Meet、評価シート、index、Chat、メールを確認する
  - 実行ログと運用記録を保存する
- Blocker:
  - 2026-06-18 JSTに明示承認を受け、version 87を既存deploymentへ反映した
  - 本番スモークを`clasp run saveFormData --user gaosys`で実施したところ、Calendar更新が`CALENDAR_FAILED`になった
  - 指示どおり即時rollbackし、既存deploymentをversion 86へ戻した
  - 失敗時点で申込行、評価シート、index、Chat、メールはすべて未実行/skippedのため追加生成物なし
  - 原因評価: Webアプリ本体の不具合確定ではなく、API executable経由スモークがCalendarを実行者権限でpatchしたことによる検証経路の問題
  - 追加診断: 現在の実行アカウントで設定カレンダー確認が`Not Found`となり、CalendarAppからも参照不可
  - 共有権限変更後、設定カレンダーは参照可能になったが、既存申込行のイベントIDが現在の設定カレンダー上で`Not Found`となり再度rollback
  - 再反映ブロック条件: `設定用!B2`を既存イベントIDを所有する元の本番カレンダーへ戻し、その同じカレンダーをdeployment実行アカウントへ共有する必要がある
  - ロールバック後のdry-run: 12 passed / 0 failed、external writes 0
  - ブロッカー対応手順: `RELEASE_BLOCKER_CALENDAR_ACCESS.md`
  - `output/test-results/REL-002-production-attempt-rollback-20260618.json`

### DOC-004 実装後ドキュメントを同期する

- Status: `[ ]`
- Priority: P1
- Dependencies: REL-002
- Scope:
  - `architecture.html`
  - `SPEC.md`
  - `RUNBOOK.md`
  - `SESSION_HANDOFF.md`
  - 本ファイル
- Acceptance:
  - To-Be表記が実装済みの状態へ更新されている
  - 実際の設定セル、処理順、失敗時挙動と文書が一致する

## Recommended Execution Order

1. DOC-001
2. DOC-002
3. DOC-003
4. TDD-001〜TDD-005
5. SEC-001、OPS-001、OPS-002
6. IMP-001〜IMP-006を各々Red-Green-Refactorで実施
7. TST-001〜TST-004
8. REL-001、REL-002
9. DOC-004
