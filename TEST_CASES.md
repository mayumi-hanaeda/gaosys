# Test Cases and Traceability

Updated: 2026-08-08
Status: Approved for TDD

## Purpose

`SPEC.md`の要件を、実装前に失敗を確認できるテストケースへ変換する。各実装タスクは本書の対応テストをRedにしてから着手し、Greenになった証跡を残す。

## Test Layers

| Layer | Execution | External writes |
| --- | --- | --- |
| L0 | 静的検査、構文、秘密情報検索、`clasp status` | none |
| L1 | Node.js `node:test`による純粋関数テスト | none |
| L2 | `clasp run runDryTestSuite`によるGASドライラン | none |
| L3 | 非本番Googleリソースによる統合テスト | test resources only |
| L4 | PlaywrightによるWeb UI E2E | test submission only |
| L5 | 本番スモークテスト | one controlled submission |

## Requirement Catalog

| Requirement ID | Priority | Requirement | Source |
| --- | --- | --- | --- |
| REQ-ID-001 | P0 | UUIDの`submissionId`を外部操作前に生成しP列へ保存する | SPEC 3, 5 |
| REQ-ID-002 | P0 | 同一`submissionId`の完了済み操作を重複実行しない | SPEC 3, 7〜9 |
| REQ-CFG-001 | P0 | `設定用!A2:G2`と必須Script Propertiesを型・必須条件で検証する | SPEC 4 |
| REQ-CFG-002 | P0 | D2空欄時は開始時刻`20:00`を使用する | SPEC 4 |
| REQ-SEC-001 | P0 | 秘密情報と個人情報をログ・戻り値・証跡へ含めない | SPEC 4, 11 |
| REQ-SCHEMA-001 | P0 | 申込リストA〜I、P、Qへ規定値を書き、J〜Oを変更しない | SPEC 5 |
| REQ-IDX-001 | P0 | indexのA列を変更せず、B〜F列を仕様どおり設定する | SPEC 5.2 |
| REQ-IDX-002 | P0 | G列以降の既存数式を維持し、必要時だけ数式を複製する | SPEC 5.2 |
| REQ-IDX-003 | P0 | indexの行確保をLockService内で行う | SPEC 5.2 |
| REQ-VAL-001 | P0 | すべての入力をサーバー側で検証し、不正時は外部操作しない | SPEC 6 |
| REQ-EVAL-001 | P1 | 指定テンプレートを指定フォルダへ規定名で複製する | SPEC 7 |
| REQ-EVAL-002 | P1 | 申込者へ評価シートの編集権限を付与する | SPEC 7 |
| REQ-EVAL-003 | P1 | 評価シート作成を冪等にする | SPEC 7.3 |
| REQ-CHAT-001 | P1 | 申込ID、申込内容、評価シート状態を含むChat本文を生成する | SPEC 8 |
| REQ-CHAT-002 | P1 | HTTP 2xxだけをChat送信成功として扱う | SPEC 8.2 |
| REQ-CHAT-003 | P1 | Chat送信を冪等にする | SPEC 8.2 |
| REQ-MAIL-001 | P1 | 定義済みタグをすべて置換したメールを作成する | SPEC 9 |
| REQ-MAIL-002 | P1 | 未解決タグまたは必須値欠落時は送信しない | SPEC 9 |
| REQ-MAIL-003 | P1 | 評価シートと権限付与成功時だけメール送信する | SPEC 9.3 |
| REQ-MAIL-004 | P1 | メール送信を冪等にする | SPEC 9.3 |
| REQ-FLOW-001 | P0 | Calendarと申込保存を主要受付成功条件とする | SPEC 10, 11 |
| REQ-FLOW-002 | P0 | 追加処理失敗時も受付成功を維持し、操作別状態を返す | SPEC 10, 11 |
| REQ-LOG-001 | P0 | `submissionId`付き構造化ログで処理結果を追跡できる | SPEC 11.3 |
| REQ-DRY-001 | P0 | GASドライランが外部変更なしでJSON結果を返す | SPEC 12 |
| REQ-REG-001 | P0 | 現行のマスター、UI、Calendar、Meet、H/I列、Chat動作を維持する | CURRENT_STATE |

## Configuration Tests

| Test ID | Requirement | Type | Layer | Setup / Input | Expected |
| --- | --- | --- | --- | --- | --- |
| CFG-001 | REQ-CFG-001 | normal | L1/L2 | A2:G2と必須Propertiesが有効 | 正規化済み設定オブジェクトを返す |
| CFG-002 | REQ-CFG-002 | normal | L1/L2 | D2が空欄 | `startTime`が`20:00`になる |
| CFG-003 | REQ-CFG-001 | abnormal | L1/L2 | E2、F2、G2をそれぞれ欠落 | `CONFIG_INVALID`と欠落した設定名だけを返す |
| CFG-004 | REQ-CFG-001 | abnormal | L1/L2 | C2が0、負数、小数、文字列 | `CONFIG_INVALID`、外部操作0件 |
| CFG-005 | REQ-CFG-001 | abnormal | L1/L2 | D2が不正時刻 | `CONFIG_INVALID`、既定値へ黙って変換しない |
| CFG-006 | REQ-CFG-001 / REQ-SEC-001 | abnormal | L1/L2 | Webhookまたは保存先Property欠落 | 設定名だけを返し、値や他の秘密情報を出力しない |
| CFG-007 | REQ-CFG-001 | normal | L1/L3 | GASでA2:G2とPropertiesを読み込み | 正規化済み設定を返す |
| CFG-008 | REQ-CFG-001 / REQ-SEC-001 | abnormal | L1/L3 | GAS設定に欠落あり | キー名だけを構造化ログへ記録 |
| CFG-009 | REQ-SEC-001 | security | L1/L3 | 公開設定状態を取得 | 設定値・秘密値を返さない |
| CFG-010 | REQ-CFG-001 | abnormal | L1/L3 | `設定用`シートなし | `CONFIG_SOURCE_UNAVAILABLE` |

## Input Validation Tests

| Test ID | Requirement | Type | Layer | Setup / Input | Expected |
| --- | --- | --- | --- | --- | --- |
| VAL-001 | REQ-VAL-001 | normal | L1/L2 | 全項目が有効、氏名がマスター一致 | 正規化済み入力を返す |
| VAL-002 | REQ-VAL-001 | abnormal | L1/L2 | `name`空またはマスター不一致 | `VALIDATION_ERROR`、外部操作0件 |
| VAL-003 | REQ-VAL-001 | abnormal | L1/L2 | `tadasukeName`空または101文字 | `VALIDATION_ERROR` |
| VAL-004 | REQ-VAL-001 | abnormal | L1/L2 | 日付形式不正または存在しない日 | `VALIDATION_ERROR` |
| VAL-005 | REQ-VAL-001 | abnormal | L1/L2 | `challenge`がboolean以外 | `VALIDATION_ERROR` |
| VAL-006 | REQ-VAL-001 / REQ-SEC-001 | abnormal | L1/L2 | `freeText`が5001文字、email空または不正 | `VALIDATION_ERROR`、入力値をログへ出さない |

## Evaluation Sheet Tests

| Test ID | Requirement | Type | Layer | Setup / Input | Expected |
| --- | --- | --- | --- | --- | --- |
| EVAL-001 | REQ-EVAL-001 | normal | L1 | タダスクネーム` たろう ` | `★【たろう】評価項目チェックシート` |
| EVAL-002 | REQ-EVAL-001 | normal | L1 | 改行、タブ、連続空白を含む名前 | 制御文字を除去し空白を1文字へ圧縮 |
| EVAL-003 | REQ-EVAL-001 | edge | L1 | 正規化後のタダスクネームが空 | `name`へフォールバック |
| EVAL-004 | REQ-EVAL-001 / REQ-EVAL-002 | normal | L2/L3 | 有効なテンプレート、フォルダ、email | 1ファイル作成、規定名、editor付与、URL返却 |
| EVAL-005 | REQ-EVAL-001 | abnormal | L2/L3 | テンプレートID不正 | `EVALUATION_COPY_FAILED`、後続は部分成功規則に従う |
| EVAL-006 | REQ-EVAL-002 | abnormal | L2/L3 | editor追加をadapterで失敗 | `EVALUATION_PERMISSION_FAILED`、メールはskipped |
| EVAL-007 | REQ-EVAL-003 / REQ-ID-002 | retry | L2/L3 | 同一`submissionId`で2回実行 | 2回目は既存file IDを返し、追加コピー0件 |
| EVAL-008 | REQ-EVAL-003 | abnormal | L2/L3 | Propertyにfile IDがあるがアクセス不能 | failedとして記録し、無条件に再作成しない |
| EVAL-009 | REQ-EVAL-003 | regression | L1 | 別`submissionId`だが保存先に同名ファイル（ゴミ箱内）が存在 | 名前だけで流用せず新規コピーを作成する |
| EVAL-010 | REQ-EVAL-003 | regression | L1 | 別`submissionId`だが保存先に同名の既存ファイルが存在 | 常に新規コピーを作成し、既存ファイルへは触れない |
| EVAL-011 | REQ-EVAL-003 | abnormal | L1 | 冪等キーが指すファイルがゴミ箱にある | `EVALUATION_COPY_FAILED`として失敗し、再利用しない |
| EVAL-012 | REQ-EVAL-003 / REQ-ID-002 | retry | L1 | 権限付与失敗後、同一`submissionId`で再実行 | 同じコピーを再利用し、追加コピーを作らない |

## index Tests

| Test ID | Requirement | Type | Layer | Setup / Input | Expected |
| --- | --- | --- | --- | --- | --- |
| IDX-001 | REQ-IDX-001 | normal | L1/L2 | 空行、タダスクネーム、評価シート情報 | Bに名前、C〜E空欄、Fに表示名とURL |
| IDX-002 | REQ-IDX-001 | normal | L2/L3 | 空行、タダスクネーム、評価シートURL | B〜Fを設定し、FはRichTextリンク |
| IDX-003 | REQ-ID-002 | retry | L2/L3 | 同一`submissionId`で再実行 | `INDEX_ROW_...`の既存行を返し新規行0件 |
| IDX-004 | REQ-IDX-001 | abnormal | L2/L3 | 評価シートURL欠落 | 未書込で`INDEX_WRITE_FAILED` |
| IDX-005 | REQ-IDX-003 | abnormal | L2/L3 | `index`シート欠落 | failedを返しLockを解放 |
| IDX-006 | REQ-IDX-003 | concurrency | L2/L3 | B列に既存行あり | Lock内で先頭空行を確保し上書きしない |

## Chat Tests

| Test ID | Requirement | Type | Layer | Setup / Input | Expected |
| --- | --- | --- | --- | --- | --- |
| CHAT-001 | REQ-CHAT-001 | normal | L1 | 全項目と評価シートURLあり | 規定ラベル、申込ID、URL、管理表URLを含む |
| CHAT-002 | REQ-CHAT-001 | partial | L1 | 評価シート発行失敗 | `発行失敗・要手動対応`を含みURLを含まない |
| CHAT-003 | REQ-CHAT-001 | edge | L1 | 自由記載空欄 | 空の項目を仕様どおり省略または空表示する |
| CHAT-004 | REQ-CHAT-002 | normal | L2/L3 | HTTP 200または204 | successとして記録 |
| CHAT-005 | REQ-CHAT-002 / REQ-SEC-001 | abnormal | L2/L3 | HTTP 400、500、例外 | `CHAT_FAILED`、Webhookとレスポンス本文をログへ出さない |
| CHAT-006 | REQ-CHAT-003 / REQ-ID-002 | retry | L2/L3 | 初回成功後に同じ`submissionId`で再実行 | `CHAT_SENT_...`を再利用しChat再送0件 |
| CHAT-007 | REQ-CHAT-002 / REQ-ID-002 | abnormal | L2/L3 | HTTP 500 | `CHAT_FAILED`を返し`CHAT_SENT_...`を保存しない |

## Mail Tests

| Test ID | Requirement | Type | Layer | Setup / Input | Expected |
| --- | --- | --- | --- | --- | --- |
| MAIL-001 | REQ-MAIL-001 | normal | L1 | 全タグを含む件名・本文 | 全タグが対応値へ置換される |
| MAIL-002 | REQ-MAIL-001 | edge | L1 | `freeText`空欄 | `なし`へ置換される |
| MAIL-003 | REQ-MAIL-001 | normal | L1 | 回答データ一式 | 規定形式の`responseSummary`を生成 |
| MAIL-004 | REQ-MAIL-002 | abnormal | L1/L2 | 未知タグが残る | `MAIL_TEMPLATE_INVALID`、送信0件 |
| MAIL-005 | REQ-MAIL-002 | abnormal | L1/L2 | 必須置換値が欠落 | `MAIL_TEMPLATE_INVALID`、送信0件 |
| MAIL-006 | REQ-MAIL-003 | normal | L2/L3 | 評価シートURLと有効な件名・本文 | 宛先、件名、本文を解決して送信し`MAIL_SENT_...`を保存 |
| MAIL-007 | REQ-MAIL-003 | partial | L2/L3 | 評価シートまたは権限付与失敗 | mail=`skipped`、送信0件 |
| MAIL-008 | REQ-MAIL-003 / REQ-FLOW-002 | abnormal | L2/L3 | MailApp送信例外 | `MAIL_FAILED`だが受付`success: true`、`MAIL_SENT_...`未保存 |
| MAIL-009 | REQ-MAIL-004 / REQ-ID-002 | retry | L2/L3 | 成功済み`submissionId`で再実行 | メール再送0件 |

## Flow and Partial Success Tests

| Test ID | Requirement | Type | Layer | Setup / Input | Expected |
| --- | --- | --- | --- | --- | --- |
| FLOW-001 | REQ-FLOW-001 | normal | L2/L3 | 全adapter成功 | 全operations=`success`、受付成功 |
| FLOW-002 | REQ-FLOW-001 | abnormal | L2/L3 | Calendar失敗 | `success: false`、申込保存以降を実行しない |
| FLOW-003 | REQ-FLOW-001 | abnormal | L2/L3 | 申込保存失敗 | `success: false`、`SUBMISSION_WRITE_FAILED` |
| FLOW-004 | REQ-FLOW-002 | partial | L2/L3 | 評価シートまたはindex失敗 | 受付成功、失敗操作を`failed`で返す |
| FLOW-005 | REQ-FLOW-002 | partial | L2/L3 | Chatまたはmail失敗 | 受付成功、他の独立処理を継続 |
| FLOW-006 | REQ-LOG-001 / REQ-SEC-001 | normal | L2 | 複数操作を実行 | 全ログを同じ`submissionId`で追跡でき、禁止情報0件 |
| FLOW-007 | REQ-VAL-001 / REQ-FLOW-001 | abnormal | L2 | サーバー側検証で未登録氏名 | `VALIDATION_ERROR`、設定取得・Calendar・申込保存0件 |

## Idempotency Tests

| Test ID | Requirement | Type | Layer | Setup / Input | Expected |
| --- | --- | --- | --- | --- | --- |
| IDEM-001 | REQ-ID-001 | normal | L1/L2 | 新規受付 | UUID形式のIDを外部操作前に1件生成 |
| IDEM-002 | REQ-SCHEMA-001 | normal | L2/L3 | 申込保存 | P列へID、Q列へ許可状態だけをJSON保存 |
| IDEM-003 | REQ-SCHEMA-001 | regression | L2/L3 | J〜Oに既存値を配置 | 保存後もJ〜Oが不変 |
| IDEM-004 | REQ-ID-002 | retry | L2 | 全処理成功後に同一IDで再実行 | 完了済み外部操作0件、同じ結果を返す |
| IDEM-005 | REQ-ID-002 / REQ-FLOW-002 | retry | L2 | Chatだけ失敗後に同一IDで再実行 | 完了済み操作を飛ばしChatだけ再試行 |
| IDEM-006 | REQ-IDX-003 / REQ-ID-002 | concurrency | L2/L3 | 同一IDを同時実行 | 評価シート、index、Chat、mailが各最大1件 |

## Existing Regression Tests

| Test ID | Requirement | Type | Layer | Setup / Input | Expected |
| --- | --- | --- | --- | --- | --- |
| REG-001 | REQ-REG-001 | normal | L2/L3 | 名前リストにデータあり | 氏名、ひらがな、ニックネームを返す |
| REG-002 | REQ-REG-001 | edge | L2 | 名前リストがヘッダーのみ | 空配列を返す |
| REG-003 | REQ-REG-001 | UI | L4 | 氏名またはフリガナを入力 | 最大5件の候補を表示 |
| REG-004 | REQ-REG-001 | UI | L4 | マスター外の氏名 | 警告表示、送信不可 |
| REG-005 | REQ-REG-001 | UI | L1/L4 | 固定した現在日時 | 未来の第3月曜日を3件生成 |
| REG-006 | REQ-REG-001 | normal | L2/L3 | 新規開催日時 | Calendar予定を新規作成しMeetを追加 |
| REG-007 | REQ-REG-001 | normal | L2/L3 | H/Iに同一日時のevent IDあり | 既存予定を更新しMeet追加を行わない |
| REG-008 | REQ-REG-001 / REQ-SCHEMA-001 | regression | L2/L3 | 有効な申込 | Hにevent ID、IにDateを保存 |
| REG-009 | REQ-REG-001 | UI | L4 | 送信開始、成功、失敗 | 二重送信防止と規定メッセージ表示 |
| REG-010 | REQ-REG-001 | regression | L2/L3/L4 | 有効な申込 | 既存Chat通知とフォーム受付が継続動作 |

## Dry-Run Contract Tests

`REQ-DRY-001`はTDD-003で次を追加する。既存の62件とは別にテストランナー自身を検証する。

| Test ID | Type | Layer | Expected |
| --- | --- | --- | --- |
| DRY-001 | normal | L2 | 外部adapterのwrite countがすべて0 |
| DRY-002 | normal | L2 | `passed`、`failed`、時刻、tests配列を返す |
| DRY-003 | abnormal | L2 | 1件失敗時にfailedが増え、対象IDを識別できる |
| DRY-004 | security | L2 | 戻り値とログに秘密情報・個人情報がない |

## Integration Harness Contract Tests

| Test ID | Type | Layer | Expected |
| --- | --- | --- | --- |
| INTG-001 | security | L1/L3 | `execute`は完全一致する確認トークンなしで外部操作0件 |
| INTG-002 | abnormal | L1/L3 | 設定不備は不足キー名だけを返し、値を返さない |
| INTG-003 | normal | L1/L3 | 全操作計画に`[TEST][TEST_RUN_ID]`を付与 |
| INTG-004 | security | L1/L3 | cleanupは同一実行が所有する台帳項目だけを許可 |
| INTG-005 | security | L1/L3 | 本番Spreadsheet IDをテスト設定として拒否 |
| INTG-006 | security | L1/L3 | provisioningは確認トークンなしで外部操作0件 |
| INTG-007 | normal | L1/L3 | provisioning計画はテスト専用リソースだけを含む |
| INTG-008 | security | L1/L3 | Chat設定は確認トークンとWebhook形式を検証 |
| INTG-009 | normal | L1/L3 | executeはテストadapterだけを実行し生成物をcleanup |

## Deployment Preflight Tests

| Test ID | Type | Layer | Expected |
| --- | --- | --- | --- |
| DEP-001 | normal | L0 | 承認済みtracked 14件と保護ハッシュでpreflight成功 |
| DEP-002 | abnormal | L0 | 想定外のdeployableファイルを検出して失敗 |
| DEP-003 | security | L0 | 保護ファイルの変更を検出して失敗 |
| DEP-004 | security | L0 | 必須ignoreルール欠落を検出して失敗 |

## Runbook Contract Tests

| Test ID | Type | Layer | Expected |
| --- | --- | --- | --- |
| RUN-001 | documentation | L0 | 必須の6障害・再実行シナリオを網羅 |
| RUN-002 | compatibility | L0 | 現行本番と`IMP-006`後の手順を区別 |
| RUN-003 | safety | L0 | 削除前確認、バックアップ、同一ID再実行を要求 |

## Manual and Approval-Gated Checks

可能な限りL3で機械検証するが、次はGoogle側の権限・配信・組織設定を含むため完全自動化しない。

| Manual ID | Related tests | Reason | Procedure | Pass condition |
| --- | --- | --- | --- | --- |
| MAN-001 | EVAL-004 | editor設定だけでは実利用者の有効アクセスを完全保証できない | 非本番申込者アカウントで評価シートURLを開き、セルを編集して破棄 | 閲覧・編集できる |
| MAN-002 | REG-006 | Meet URLの存在と実際の参加可否は別 | 非本番CalendarイベントからMeetを開き、テストアカウントで参加画面まで進む | Meet参加画面が表示される |
| MAN-003 | MAIL-007 | MailApp成功と受信・迷惑メール判定は別 | テスト受信箱で件名、本文、URLを確認 | 1通だけ受信し内容一致 |
| MAN-004 | TDD-004 | API executableとGCP Projectの公開範囲は管理設定 | Apps Script/GCP管理画面で実行者・アクセス範囲を確認 | 組織外から実行不可 |
| MAN-005 | REL-002 | 本番環境の最終的なサービス間連携 | 管理者テストアカウントで1件だけ送信し全成果物を確認 | 検収条件がすべて成功 |

手動確認は実行日時、実行者、対象テストID、結果だけを記録し、個人情報やURLトークンを証跡へ保存しない。

## Coverage Gate

TDD-001完了条件:

- P0/P1要件25件に少なくとも正常系と異常系または境界系が紐づいている
- SPECで予約した62件のテストIDがすべて具体化されている
- ドライラン基盤自身の4件が定義されている
- 完全自動化しない5件に理由と手動手順がある
- 各テストに実行層と期待結果がある
