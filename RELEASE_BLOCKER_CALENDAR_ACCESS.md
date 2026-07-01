# Release Blocker: Calendar Access

Date: 2026-06-18

## Current Status

Production web app deployment is rolled back to version 86.

The release candidate version 87 passed local tests, deployment preflight,
non-production full-flow tests, production configuration check, and production
dry-run. Production release is blocked by Calendar configuration/access
alignment.

## What Happened

During production smoke after deploying version 87, `saveFormData` stopped at
the Calendar step with `CALENDAR_FAILED`.

No submission row, evaluation sheet, index row, Chat message, or mail was
created by the failed smoke because the flow stops before those writes when
Calendar fails.

The first access probe showed that the current execution account could not see
the configured production Calendar. After sharing was changed, the Calendar was
visible, but the production smoke still failed because the existing event ID
stored for the selected date was not found in the currently configured Calendar.

This indicates that `設定用!B2` may have been changed to a different Calendar.
That is not safe because existing rows in `申込リスト` already store event IDs
for the original production Calendar.

## Required Fix Before Retrying Release

Restore `設定用!B2` to the original production Calendar that owns the existing
event IDs in `申込リスト!H:H`.

Then grant the deployment execution account write access to that same Calendar.

Required Calendar permission:

- `予定の変更` or stronger

Do not replace `設定用!B2` with a different personal Calendar. The Calendar ID
must continue to match the existing Calendar event IDs already stored in the
submission sheet.

Alternative:

- Redeploy the web app using an account that already has write access to the
  Calendar configured in `設定用!B2`.

## Safe Retry Sequence

1. Restore `設定用!B2` to the original production Calendar.
2. Share that original Calendar with the deployment execution account.
3. Confirm production deployment is still version 86.
4. Confirm local tests pass.
5. Confirm deployment preflight is `ok: true`.
6. Confirm production configuration status is `ok: true`.
7. Confirm production dry-run passes with external writes all zero.
8. Deploy version 87 to the existing production deployment.
9. Run one production smoke through the real web app path.
10. If Calendar, submission, evaluation sheet, index, Chat, or mail fails,
   immediately redeploy version 86.

## Evidence

- `output/test-results/REL-002-production-attempt-rollback-20260618.json`
- `TASKS.md` REL-002 section
