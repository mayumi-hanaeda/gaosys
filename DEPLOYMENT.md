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
