# Non-Production Integration Testing

Updated: 2026-06-15
Status: Complete

## Purpose

本番Spreadsheet、Calendar、Drive、Chat、メールへ触れずに、Googleサービスを
使用するL3統合テストを実行する。

## Required Script Properties

| Key | Resource | Rule |
| --- | --- | --- |
| `TEST_SPREADSHEET_ID` | 専用Spreadsheet | 本番Spreadsheet IDは禁止 |
| `TEST_CALENDAR_ID` | 専用Calendar | 本番Calendarは禁止 |
| `TEST_EVALUATION_FOLDER_ID` | 専用Drive folder | `[TEST]`作成物だけを格納 |
| `TEST_CHAT_WEBHOOK_URL` | 専用Chat space | 本番Webhookは禁止 |
| `TEST_MAIL_RECIPIENT` | テスト受信箱 | 実申込者は禁止 |

値はScript Propertiesだけへ保存する。ドキュメント、ソース、ログ、テスト証跡へ
ID、Webhook URL、メールアドレスを記録しない。

## Safety Contract

- すべての生成物へ`[TEST][TEST_RUN_ID]`を付ける。
- `TEST_RUN_ID`は`YYYYMMDDTHHMMSSZ-suffix`形式とする。
- `preview`は外部書き込みを行わない。
- `execute`には`RUN:{TEST_RUN_ID}`と完全一致する`confirmToken`が必要。
- cleanupは同じ`TEST_RUN_ID`、marker、台帳を持つ作成物だけを対象にする。
- Chatとメールは送信後に取り消せないため、専用宛先以外では実行しない。
- 本番Spreadsheet IDはコード側でも拒否する。

## Verification

```bash
clasp run runIntegrationTestSuite \
  --params '[{"mode":"preview","testRunId":"20260615T112000Z-smoke01"}]' \
  --user gaosys
```

2026-06-15の結果:

- preview: success、external writes 0
- execute: 5 passed、0 failed
- Spreadsheet: テストシート作成・読取・削除成功
- Calendar: テスト予定作成・確認・削除成功
- Drive: テストファイル作成・確認・ゴミ箱移動成功
- Chat: 非公開テストスペースで1件受信確認
- Mail: 組織アカウントのテスト受信箱で1件受信確認
- 本番Spreadsheet、Calendar、Drive、Chat、申込者メールは未使用

実行コマンド:

```bash
clasp run runIntegrationTestSuite \
  --params '[{"mode":"execute","testRunId":"TEST_RUN_ID","confirmToken":"RUN:TEST_RUN_ID"}]' \
  --user gaosys
```

同じ`TEST_RUN_ID`を安易に再利用しない。Chatとメールは取り消せないため、
実行前に必ずpreviewを行う。

## TST-002 Partial Verification

Date: 2026-06-16 JST.

- Production deployment was not changed; it remains on version 86.
- TEST_RUN_ID: `20260616T090000Z-tst002`.
- Preview result: `ok: true`, five planned targets, external writes 0.
- Execute result: 5 passed, 0 failed.
- Spreadsheet, Calendar, and Drive test artifacts were cleaned by the test
  adapter.
- Chat and Mail were sent only to configured non-production destinations.
- Filtered logs were saved under `output/test-results/`; full logs were not
  saved to avoid personal-data leakage.
- Evidence files:
  - `output/test-results/TST-002-preview.json`
  - `output/test-results/TST-002-execute.json`
  - `output/test-results/TST-002-logs-filtered.txt`

Limitation: this verifies the existing non-production service adapters on the
current Apps Script project. It does not execute the local IMP-006
`saveFormData()` orchestration because production safety rules prohibit pushing
or deploying that change to the production-bound project. Full TST-002 coverage
requires an isolated Apps Script copy bound to non-production resources.

## Isolated Apps Script Copy Attempt

Date: 2026-06-16 JST.

- A temporary standalone Apps Script project was created only to test whether an
  isolated copy could be executed through the Apps Script API.
- Creating content, version, and an `MYSELF` Execution API deployment succeeded.
- `scripts.run` failed with `NOT_FOUND` or `PERMISSION_DENIED`; this indicates
  the new project still needs the standard GCP/API executable setup that the
  production-bound project already has.
- Creating the isolated project with the runtime `gaosys` credential was not
  possible because that credential intentionally lacks Apps Script project
  management scopes.
- The temporary project `[TEST] GAOSYS Isolated Smoke 20260616` was moved to
  trash after the check.

Conclusion: full IMP-006 E2E testing remains blocked until an isolated Apps
Script project is manually associated with the standard GCP project or another
non-production bound project with Execution API access is provided.

## Test GCP Project Setup

Date: 2026-06-16 JST.

- A test-only standard GCP project was created for isolated verification.
- Project ID: `gaosys-gas-test-runtime`.
- Project number: `769410976001`.
- Parent organization: `tadakayo.jp` (`797660187808`).
- Enabled APIs:
  - Apps Script API
  - Google Calendar API
  - Cloud Logging API
  - Cloud Resource Manager API
- A new isolated Apps Script project was created:
  `[TEST] GAOSYS IMP-006 Isolated`
  (`YOUR_ISOLATED_APPS_SCRIPT_ID`).
- No production Apps Script push or deployment was performed.
- Production remains on deployment version 86.

Current state:

- The isolated Apps Script project was associated with standard GCP project
  number `769410976001`.
- Local IMP-006 files were pushed only to the isolated Apps Script project.
- Isolated deployment `@1` was created with description
  `TST-002 isolated IMP-006 smoke`.
- 2026-06-17 JST update: the Desktop OAuth client
  `GAOSYS clasp CLI Test` was created in `gaosys-gas-test-runtime`, local clasp
  auth was completed with client ID prefix `769410976001`, and isolated
  `scripts.run` dry smoke passed with 12 passed / 0 failed and external writes
  0.
- 2026-06-17 JST update: test OAuth authorization was extended with
  `logging.read`, and `clasp logs --simplified --user default` returned the
  sanitized `GAOSYS_DRY_TEST_SUMMARY` evidence.
- Integration preview against the isolated script correctly reports missing
  test Script Properties with external writes 0.
- `provisionIntegrationTestResources` is blocked because `Service Usage API` is
  not enabled in `gaosys-gas-test-runtime`; until that API is enabled, Drive and
  Sheets APIs cannot be enabled from the CLI and test resource provisioning
  cannot create Drive-backed resources.
- 2026-06-18 JST update: after enabling the missing APIs in
  `gaosys-gas-test-runtime`, `provisionIntegrationTestResources` succeeded.
  Spreadsheet and Calendar test properties were already present from the prior
  partial attempt; Drive folder and mail recipient were created in the isolated
  environment. The only remaining missing property is
  `TEST_CHAT_WEBHOOK_URL`.
- 2026-06-18 JST update: a non-production Google Chat webhook was configured
  only in the isolated script. Isolated preview passed with external writes 0,
  and isolated execute passed 5 / 5 against dedicated test Spreadsheet,
  Calendar, Drive, Chat, and Mail targets. Spreadsheet, Calendar, and Drive
  artifacts were cleaned by the test adapter. Chat and Mail were intentionally
  sent only to non-production destinations.

Current evidence:

- `output/test-results/TST-002-isolated-dry-run-20260617.json`
- `output/test-results/TST-002-isolated-logs-20260617.txt`
- `output/test-results/TST-002-isolated-provision-20260618.json`
- `output/test-results/TST-002-isolated-fullflow-20260618.json`
- `output/test-results/TST-002-isolated-fullflow-logs-20260618.txt`

Remaining safety boundary:

- 2026-06-18 JST update: a test-only spreadsheet override path was added via
  Script Property `GAOSYS_SPREADSHEET_ID_OVERRIDE`. With that property set only
  on the isolated script, `saveFormData()` was executed against the test
  Spreadsheet and dedicated test Calendar, Drive, Chat, and Mail targets.
- Isolated `saveFormData()` smoke passed for calendar, submission,
  evaluationSheet, index, chat, and mail operations.
- The created submission row, Calendar event, evaluation sheet file, and index
  row were cleaned by the isolated test helper.
- The production default Spreadsheet ID remains unchanged when
  `GAOSYS_SPREADSHEET_ID_OVERRIDE` is absent.
- Additional evidence:
  - `output/test-results/TST-002-isolated-saveformdata-20260618.json`
  - `output/test-results/TST-002-isolated-saveformdata-logs-20260618.txt`

## TST-003 Isolated Abnormal And Retry Verification

Date: 2026-06-18 JST.

- Production Apps Script was not pushed or deployed.
- Target environment: isolated Apps Script
  `[TEST] GAOSYS IMP-006 Isolated` bound to test GCP project
  `gaosys-gas-test-runtime`.
- A first isolated abnormal run found that same-`submissionId` retry appended a
  duplicate `申込リスト` row.
- The implementation was updated so `saveFormData()` reuses an existing P-column
  `submissionId` row instead of appending a second row.
- Local regression coverage was added as
  `IDEM-004: same submissionId does not append a second submission row`.
- Final isolated abnormal suite passed 7 / 7:
  - invalid evaluation template ID
  - evaluation editor permission failure
  - missing `index` sheet
  - Chat fetch failure
  - invalid mail template
  - same-`submissionId` retry
  - two submissions for the same date
- Created test artifacts were cleaned by the isolated helper where applicable.
- Evidence:
  - `output/test-results/TST-003-isolated-abnormal-20260618.json`
  - `output/test-results/TST-003-isolated-abnormal-logs-20260618.txt`
