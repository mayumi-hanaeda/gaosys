# Deployment Policy

Updated: 2026-08-08

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

The last five entries are legacy or experimental implementations. Their file
names are stored in `ops/deployment-policy.json` for existence checks.

Do not add protected files to `.claspignore`: removing an existing remote file
from the push set can delete it from the Apps Script project. If a task
explicitly changes a protected file, document the reason and review the diff.

### Local-only files

Tests, scripts, policies, evidence, Playwright artifacts, credentials, and
Markdown documentation are not application source. `tests/`, `scripts/`,
`ops/`, `output/`, `.playwright-mcp/`, and `.playwright-cli/` must remain
excluded.

## Current Web App Environments

Deployment ID、URL、実アカウント、実設定値は GitHub に記録しない。作業時は
`.local/OPERATIONS.md` の記録と `clasp deployments` の実測結果を照合する。

2026-07-03 JST 時点の記録では、production は version 96、test は version 98 だった。
これは現在値ではない。デプロイ、設定変更、障害調査、または作業再開時は、必ず
実環境を再確認してから判断する。

Calendar、Drive、Mail の操作権限は web app のデプロイ実行者に依存する。担当者は
経験を積むためにデプロイ操作を行ってよいが、production の実行者・影響範囲・
ロールバック方法を事前に確認し、AGENTS.md が求めるユーザー承認を得る。

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
4. Any protected-file change is explicitly authorized and reviewed in `git diff`.
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
