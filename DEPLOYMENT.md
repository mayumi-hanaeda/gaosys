# Deployment Policy

Updated: 2026-06-15

## File Classification

### Active application files

These files may be changed by implementation tasks and are deployed by
`clasp push`.

- `appsscript.json`
- `code.js`
- `domain.js`
- `dry_run.js`
- `index.html`
- `integration_test.js`
- `チャット通知Bot.js`

### Protected deployed files

These files already exist in the bound Apps Script project, so they remain in
the deployment set. They must not be changed by ordinary implementation work.

- `architecture.html`: reference document, not an application entry point
- `仕様確認.js`: administrative specification-export function
- `ヤススさんcode.js`
- `ヤススさんindex.html`
- `のぐっちさんcss.html`
- `のぐっちさんindex.html`
- `無題.js`

The last five entries are legacy or experimental implementations. Protected
file hashes are stored in `ops/deployment-policy.json`.

Do not add protected files to `.claspignore`: removing an existing remote file
from the push set can delete it from the Apps Script project. If a task
explicitly changes a protected file, document the reason, review the diff, and
update its approved hash in the policy.

### Local-only files

Tests, scripts, policies, evidence, Playwright artifacts, credentials, and
Markdown documentation are not application source. `tests/`, `scripts/`,
`ops/`, `output/`, `.playwright-mcp/`, and `.playwright-cli/` must remain
excluded.

## Current Web App Environments

Confirmed on 2026-07-03 JST with `clasp deployments --user default`.

| Environment | Deployment version | Web app URL |
| --- | ---: | --- |
| Production | 96 | `https://script.google.com/a/macros/tadakayo.jp/s/AKfycbysLvEjo3I8UBne-auGMNCpm9atyTty6MF0xrgSem6WyyN41cCNec4fKGYz9IxZDM9g1g/exec` |
| Test | 98 | `https://script.google.com/a/macros/tadakayo.jp/s/AKfycbwdzqmaUHl9iqJaqlGIWPSv1HbEPelCqn5NanbHplV-nbqGzeIuBqV-f7ZJ8Zqv0pGiCA/exec` |

Notes:

- Production currently points to version 96, `fix evaluation sheet reuse for repeat submissions`.
- Production must run as the deploying user. The current intended production
  deploying account is `yukihiro-ogata@tadakayo.jp`.
- Calendar, Drive, and Mail operations must use the same deploying-user
  authority. Do not update the production deployment from another account unless
  the Calendar/Drive/Mail permission impact has been reviewed and approved.
- Web app access is restricted to Tadakayo domain users.
- Production Calendar registration worked when checked after the 2026-06-30 deployment.
- The current production issue is that Calendar registration now fails when running the production web app.
- Test currently points to version 98, `runtime properties externalization test deployment`.
- Test is expected not to work yet because its Script Properties are not configured.
- `clasp deployments` exposes deployment ID, version, and description, but does not show the last deployer.
- To identify the last deployer, use Google Workspace/Admin audit logs or Apps Script project activity records if available.

## Pre-Push Checklist

Run from the repository root:

```bash
node --test tests/*.test.mjs
node scripts/check-deployment.mjs
clasp status --user default
```

Proceed only when:

1. All tests pass.
2. Preflight returns `"ok": true`.
3. `clasp status` lists exactly the 14 approved tracked files.
4. No protected-file hash changed unexpectedly.
5. `appsscript.json` scope and deployment access changes were reviewed.

Then push and inspect status again:

```bash
clasp push --force --user default
clasp status --user default
```

## Release Evidence

For each push or deployment, record the following without secrets or personal
data:

- date and operator
- task or release identifier
- local test totals
- preflight result
- complete `clasp status` tracked-file list
- deployment ID category and resulting version
- configuration or OAuth scope changes
- smoke-test result

Store machine-readable evidence under `output/test-results/`. Never save raw
`clasp logs`; existing application logs can contain personal data.
