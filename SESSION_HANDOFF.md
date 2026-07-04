# Session Handoff

> Current next-work handoff: `NEXT_WORK_HANDOFF.md` (updated 2026-07-05 JST).
> It records the current cleanup direction: scattered Apps Script files,
> Script Properties整理, and unresolved issues. Prefer that file for the next
> session before relying on older notes below.

Updated: 2026-06-16

## Repository

- Workspace: `/Users/mayumihanaeda/gaosys`
- Apps Script ID: `YOUR_PRODUCTION_APPS_SCRIPT_ID`
- Bound spreadsheet ID: `YOUR_PRODUCTION_SPREADSHEET_ID`
- `clasp` account used: `YOUR_GOOGLE_WORKSPACE_ACCOUNT@example.com`
- This directory is not currently a Git repository.

## Canonical Specification

- Canonical Google Docs specification: `タダスク講師を始めてみたい人の申込みフォーム・仕様書`
- URL: `https://docs.google.com/document/d/12HICKl_Ir8VnAF-D1ZymDU0Qs3fLEYAunEpm0uEM15M/edit?tab=t.xcggp02bny59`
- Document ID: `12HICKl_Ir8VnAF-D1ZymDU0Qs3fLEYAunEpm0uEM15M`
- Tabs: `追加仕様書`, `ファイル`, `旧仕様書（2025）`

This Google Docs document is the canonical specification. Repository documents
such as `SPEC.md`, `CURRENT_STATE.md`, `DECISIONS.md`, and `architecture.html`
are derived working documents. When the canonical document changes, merge the
change into repository documents explicitly and record any implementation
decision that differs from the source document.

Runtime authority decision: web apps run as the deploying user. Current
production deploying account is `yukihiro-ogata@tadakayo.jp`; Calendar, Drive,
and Mail operations use that same authority. Web app access is limited to
Tadakayo domain users.

## Completed

- Pulled the container-bound GAS project with `clasp clone`.
- Inspected all spreadsheet sheets:
  - `index`
  - `申込リスト`
  - `設定用`
  - hidden `名前リスト`
- Read the Google Docs specification, including SOW, RD, TRD, data/interface definitions, email body, and legacy specifications.
- Created `architecture.html`, covering:
  - current architecture and data flow
  - spreadsheet/GAS structure
  - current data counts
  - planned onboarding automation
  - current-vs-planned gaps
  - risks and acceptance criteria
- Verified four Mermaid diagrams, desktop/mobile layouts, and zero page console errors with Playwright MCP.
- Created `AGENTS.md` as the repository contributor guide.

## Planned but Not Implemented

The specification calls for these GAS additions:

1. Copy an evaluation-sheet template with `DriveApp`.
2. Grant the applicant edit permission.
3. Write the applicant name to `index!B` and sheet URL to `index!F`.
4. Add the generated URL to Google Chat notifications.
5. Send a templated acknowledgment email.
6. Add template ID, email subject, and email body to `設定用`, proposed as E2:G2.

`SEC-001` is complete. The production Chat webhook is stored in Script
Property `CHAT_WEBHOOK_URL`; the old webhook was deleted, and no complete
webhook URL remains in source.

## Implementation Plan

- Use `TASKS.md` as the execution tracker for document-driven development.
- Use `TESTING.md` as the TDD and automated-test strategy.
- Use `CURRENT_STATE.md` as the pre-change behavioral baseline and regression checklist.
- Use accepted `DECISIONS.md` and `SPEC.md` as the implementation contract.
- Use `TEST_CASES.md` as the requirement-to-test traceability matrix.
- `TDD-002` is complete: local tests load GAS-compatible pure logic from `domain.js` and write JUnit evidence under `output/test-results/`.
- `TDD-003` is complete: `dry_run.js` exposes `runDryTestSuite()`, with 12 dry
  checks, zero external writes, JSON evidence, and four contract tests.
- `TDD-004` is complete. Standard GCP project `gaosys-gas-runtime`
  (`191275116698`) is associated; Apps Script, Calendar, and Cloud Logging APIs
  are enabled; internal OAuth uses explicit project scopes; API executable v81
  is restricted to `MYSELF`.
- Remote verification returned 12 passed, 0 failed, all external-write counters
  zero. `clasp logs` returned `GAOSYS_DRY_TEST_SUMMARY`.
- Do not use the personal `gcloud` account currently configured on this machine.
- Complete the specification decisions and interface documentation before implementation.
- Do not mark an implementation task complete until its automated tests, documentation, and any remaining manual test evidence are updated.
- Use named clasp user `gaosys` for runtime execution and `default` for
  deployment administration and log retrieval. See `CLOUD_SETUP.md`.
- `TDD-005` is complete. Dedicated Spreadsheet, Calendar, Drive folder,
  private Chat space/webhook, and test inbox are configured in Script
  Properties. The verified smoke run returned 5 passed, 0 failed; temporary
  Spreadsheet, Calendar, and Drive artifacts were cleaned. See
  `INTEGRATION_TESTING.md`.
- `SEC-001` is complete. The production webhook was rotated on 2026-06-15 JST,
  stored in Script Properties, smoke-tested with HTTP 200, and the old webhook
  was deleted. See `CLOUD_SETUP.md`.
- `OPS-001` is complete. `DEPLOYMENT.md` classifies seven active and seven
  protected deployed files. Run `node scripts/check-deployment.mjs` before
  every push; it verifies the exact `clasp status` set, protected hashes, and
  local-only ignore rules.
- `OPS-002` is complete. `RUNBOOK.md` covers orphan Calendar events and
  evaluation-sheet, index, Chat, and mail partial failures. It distinguishes
  current production limitations from the `submissionId` recovery behavior
  planned for `IMP-006`.
- `IMP-001` is complete. `loadApplicationConfiguration_()` reads
  `設定用!A2:G2` and the two production Script Properties, validates through
  `GaosysDomain`, and logs key names only. The production onboarding settings
  were added on 2026-06-16 JST; the safe remote status now returns `ok: true`.
  The deployed submission flow is not yet wired to this validation, so
  production reception remains unchanged.
- `IMP-002` is complete locally and deployed. `provisionEvaluationSheet_()`
  copies the configured template to the configured folder, names it with the
  accepted `★【タダスクネーム】評価項目チェックシート` format, grants applicant
  edit access, and reuses `EVALUATION_FILE_{submissionId}`. It is not yet wired
  into the deployed `saveFormData()`.
- `IMP-003` is complete locally. `registerIndexRow_()` writes B-F on the
  `index` sheet, sets the evaluation-sheet rich text link in F, allocates the
  first empty B row under `LockService`, and reuses `INDEX_ROW_{submissionId}`.
  It is not yet wired into `saveFormData()`, so production reception remains
  unchanged until the orchestration task.
- `IMP-004` is complete locally. `notifyOnboardingChat_()` builds the
  onboarding notification through `GaosysDomain.buildChatMessage()`, sends via
  `CHAT_WEBHOOK_URL`, accepts only HTTP 2xx, and stores
  `CHAT_SENT_{submissionId}` only after success. It is not yet wired into
  `saveFormData()`.
- `IMP-005` is complete locally. `sendAcknowledgementMail_()` renders the
  configured subject and body through `GaosysDomain.renderMailTemplate()`, sends
  with `MailApp.sendEmail()`, skips when the evaluation-sheet URL is missing,
  and stores `MAIL_SENT_{submissionId}` only after success. It is not yet wired
  into `saveFormData()`.
- `IMP-006` is implemented locally but intentionally not pushed/deployed.
  `saveFormData()` now generates a `submissionId`, writes P/Q, executes
  evaluation-sheet, index, Chat, and mail steps behind independent error
  boundaries, and updates Q with operation statuses. Local tests pass. Do not
  deploy this change while the user requires production to remain on the current
  working deployment.
- Absolute production safety rule from the user: do not deploy changes that can
  break current production reception. Additive data/configuration work may
  continue only after checking impact and preserving existing references.
- `TST-002` is partially verified without deployment. Existing non-production
  integration adapters passed preview and execute with TEST_RUN_ID
  `20260616T090000Z-tst002` using only dedicated test resources. Full IMP-006
  end-to-end verification still requires an isolated Apps Script copy because
  pushing local IMP-006 to the production-bound project could affect production
  triggers or future executions.
- An isolated Apps Script smoke project was created to test API execution, but
  `scripts.run` failed until a standard GCP/API executable setup is available.
  The temporary project `[TEST] GAOSYS Isolated Smoke 20260616` was moved to
  trash. Do not continue by pushing local IMP-006 to the production-bound
  project; prepare an isolated non-production Apps Script project instead.
- A test-only standard GCP project now exists for that purpose:
  `gaosys-gas-test-runtime` / project number `769410976001` under organization
  `797660187808`. Apps Script API, Calendar API, Cloud Logging API, and Cloud
  Resource Manager API are enabled.
- The isolated Apps Script project `[TEST] GAOSYS IMP-006 Isolated`
  (`YOUR_ISOLATED_APPS_SCRIPT_ID`) was created.
  It still needs manual association to standard GCP project number
  `769410976001` in the Apps Script Project Settings UI. The public Apps Script
  API does not expose this association method, and browser automation was not
  authenticated enough to complete it.
- After that manual association, continue by uploading local IMP-006 only to
  the isolated script, creating an `MYSELF` API executable deployment there,
  running `scripts.run` smoke, and then running the isolated full-flow test.

## Important Compatibility Note

Legacy documentation says calendar event ID/date are in columns J/K. The current code and actual `申込リスト` use H/I. Base future changes on the current sheet and code, not the legacy column positions.

## Resume Commands

```bash
cd /Users/mayumihanaeda/gaosys
clasp status
clasp pull
```

Review local changes before `clasp pull` because `architecture.html`, `AGENTS.md`, and this handoff file are local documentation and may be affected by clasp file selection.

To preview the architecture document:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8765/architecture.html`.
