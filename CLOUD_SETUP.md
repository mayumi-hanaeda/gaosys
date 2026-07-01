# Apps Script Remote Test Setup

Updated: 2026-06-16
Status: Complete

## Goal

`clasp run runDryTestSuite`と`clasp logs`を、`YOUR_GOOGLE_WORKSPACE_ACCOUNT@example.com`の組織アカウントかつ最小公開範囲で利用できるようにする。

## Confirmed State

- Dedicated standard GCP project `GAOSYS GAS Runtime` was created in the
  `tadakayo.jp` organization.
- GCP project ID: `gaosys-gas-runtime`.
- GCP project number: `191275116698`.
- Google Apps Script API and Google Calendar API are enabled.
- Cloud Logging API was enabled by default and verified.
- Google Auth Platform setup is configured as internal, with
  `YOUR_GOOGLE_WORKSPACE_ACCOUNT@example.com` as the support and contact address.
- The account owner accepted the Google API Services User Data Policy.
- The Apps Script project is associated with standard GCP project number
  `191275116698`.
- `.clasp.json` contains project ID `gaosys-gas-runtime`.
- The Apps Script API account setting is enabled.
- A Desktop OAuth client named `GAOSYS clasp CLI` is stored outside the
  repository and the named clasp user `gaosys` is authenticated.
- The API executable deployment is version 86 and access is restricted to
  `MYSELF`.
- `clasp run runDryTestSuite --params '[{"suite":"all"}]' --user gaosys`
  returns 12 passed, 0 failed.
- `clasp logs --simplified --user default` returns the structured dry-test
  summary from Cloud Logging.
- The installed `gcloud` CLI is authenticated as an unrelated personal account and must not be used for this project.
- Google Cloud first-use Terms were accepted by the account owner.

## Security Decisions

- Use a dedicated standard GCP project owned by the `tadakayo.jp` organization.
- Do not reuse personal GCP projects.
- API executable access is `MYSELF`.
- Existing web app access remains `DOMAIN`.
- Use a dedicated OAuth Desktop client in the same GCP project.
- Never commit OAuth client secrets or clasp auth files.
- Explicit project scopes are limited to:
  - `userinfo.email`
  - `script.external_request`
  - `script.send_mail`
  - `drive`
  - `spreadsheets`
  - `calendar`

## Completed Setup

The following setup is complete:

```bash
clasp run runDryTestSuite --params '[{"suite":"all"}]' --user gaosys
clasp logs --simplified --user default
```

The runtime credential intentionally has only project execution scopes. The
default clasp credential is used for deployment administration and log reads.
OAuth client files and clasp credentials remain outside the repository.

## Verification Evidence

- Date: 2026-06-14 JST.
- Local tests: 16 passed, 0 failed.
- Remote dry suite: 12 passed, 0 failed.
- External writes: Spreadsheet, Drive, Calendar, Chat, Mail, and Properties are
  all zero.
- Cloud log marker: `GAOSYS_DRY_TEST_SUMMARY`.
- API executable access: `MYSELF`; organization-external execution is excluded
  by deployment configuration.
- Existing web app access remains `DOMAIN`.
- Logs and returned JSON contain no personal data, OAuth values, webhook URLs,
  or other secrets.
- `clasp run --nondev` does not resolve this API deployment with clasp 3.2.0;
  the verified TDD path uses the default development-mode invocation above.

## Chat Webhook Rotation Record

- Date: 2026-06-15 JST.
- Executor: Codex automation using the account-owner authenticated session.
- Target: production GAOSYS notification webhook.
- New webhook: stored only in Script Property `CHAT_WEBHOOK_URL`.
- Old webhook: deleted from Google Chat and invalidated.
- Source scan: no complete Chat webhook URL, API key, or token remains.
- Smoke test: `runProductionChatWebhookSmokeTest` returned HTTP 200.
- API executable: version 86, access `MYSELF`.
- Secret values are intentionally omitted from this record.

## Production Onboarding Configuration

- Date: 2026-06-16 JST.
- Deployment status: not deployed; production remains on API executable version
  86.
- Safety rule: do not deploy changes that can stop production reception. Keep
  the current production deployment running unless an explicit release decision
  is made after risk review.
- Template file: `【みずいろ】評価項目チェックシートフォーマット`
  (`YOUR_TEST_SPREADSHEET_ID`).
- Evaluation output folder: `GAOSYS 評価シート保存先`
  (`YOUR_TEST_FOLDER_ID`), created under the shared-drive folder
  `評価項目チェックシート`.
- `設定用!E1:G1` was populated with the approved headers.
- `設定用!E2:G2` was populated with the template ID and mail templates.
- Script Property `EVALUATION_SHEET_FOLDER_ID` was populated with the output
  folder ID.
- Existing `設定用!A2:D2` values were verified as preserved.
- Safe remote status: `getApplicationConfigurationStatus` returned
  `{ ok: true, missing: [], invalid: [] }`.
- A temporary Apps Script setup function was used without deployment and then
  removed from HEAD; verification found no temporary function marker remaining.

## Test GCP Runtime Configuration

- Date: 2026-06-16 JST.
- Purpose: isolated IMP-006 full-flow verification without pushing or deploying
  local changes to the production-bound Apps Script project.
- Test GCP project ID: `gaosys-gas-test-runtime`.
- Test GCP project name: `GAOSYS GAS Test Runtime`.
- Test GCP project number: `769410976001`.
- Parent organization: `tadakayo.jp` (`797660187808`).
- Enabled APIs:
  - Apps Script API (`script.googleapis.com`)
  - Google Calendar API (`calendar-json.googleapis.com`)
  - Cloud Logging API (`logging.googleapis.com`)
  - Cloud Resource Manager API (`cloudresourcemanager.googleapis.com`)
- Management prerequisite: Cloud Resource Manager API was also enabled on
  `gaosys-gas-runtime` so the existing owner credential can create and inspect
  organization-owned projects. No Apps Script deployment or source push was
  performed.
- Isolated Apps Script project created:
  `[TEST] GAOSYS IMP-006 Isolated`
  (`YOUR_ISOLATED_APPS_SCRIPT_ID`).
- The isolated Apps Script project was manually associated with standard GCP
  project number `769410976001`.
- Local IMP-006 files were pushed only to the isolated Apps Script project from
  `/private/tmp/gaosys-isolated-imp006`.
- Isolated deployment `@1` was created with description
  `TST-002 isolated IMP-006 smoke`.
- A Desktop OAuth client named `GAOSYS clasp CLI Test` was created in
  `gaosys-gas-test-runtime` and used for local clasp authorization.
- Isolated `clasp run runDryTestSuite` passed with 12 passed / 0 failed and
  external writes 0.
- Isolated `clasp logs --simplified` returned the sanitized
  `GAOSYS_DRY_TEST_SUMMARY` evidence after adding `logging.read` to the local
  test authorization path.
- After enabling the missing test GCP APIs, `provisionIntegrationTestResources`
  succeeded in the isolated environment. Spreadsheet and Calendar properties
  were already present from a previous partial attempt; Drive folder and mail
  recipient were created.
- A non-production Google Chat webhook was configured only in the isolated
  script.
- The isolated service-flow preview and execute passed against test resources.
- A test-only spreadsheet override path was added via
  `GAOSYS_SPREADSHEET_ID_OVERRIDE`; the production default spreadsheet ID is
  still used when this property is absent.
- Isolated `saveFormData()` smoke passed against test Spreadsheet, Calendar,
  Drive, Chat, and Mail targets. Created Spreadsheet row, Calendar event,
  evaluation sheet file, and index row were cleaned by the isolated helper.
- Production status: unchanged. Production remains on deployment version 86;
  no production deploy or push was performed.
