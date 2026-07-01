import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDir, '..');

function forbiddenService(name) {
  return new Proxy({}, {
    get() {
      throw new Error(`${name} must not be used by dry-run tests`);
    }
  });
}

function loadDryRunSandbox() {
  const sandbox = {
    SpreadsheetApp: forbiddenService('SpreadsheetApp'),
    DriveApp: forbiddenService('DriveApp'),
    CalendarApp: forbiddenService('CalendarApp'),
    CalendarHandler: forbiddenService('CalendarHandler'),
    UrlFetchApp: forbiddenService('UrlFetchApp'),
    MailApp: forbiddenService('MailApp'),
    GmailApp: forbiddenService('GmailApp'),
    PropertiesService: forbiddenService('PropertiesService')
  };

  vm.createContext(sandbox);
  for (const fileName of ['domain.js', 'dry_run.js']) {
    const source = fs.readFileSync(
      path.join(repositoryRoot, fileName),
      'utf8'
    );
    vm.runInContext(source, sandbox, { filename: fileName });
  }

  return sandbox;
}

test('DRY-001: dry-run performs no external writes', () => {
  const sandbox = loadDryRunSandbox();
  const result = sandbox.runDryTestSuite({
    suite: 'all',
    now: '2026-06-13T12:00:00+09:00'
  });

  assert.deepEqual(
    JSON.parse(JSON.stringify(result.diagnostics.externalWrites)),
    {
      spreadsheet: 0,
      drive: 0,
      calendar: 0,
      chat: 0,
      mail: 0,
      properties: 0
    }
  );
});

test('DRY-002: dry-run returns a JSON serializable summary', () => {
  const sandbox = loadDryRunSandbox();
  const result = sandbox.runDryTestSuite({
    suite: 'all',
    now: '2026-06-13T12:00:00+09:00'
  });
  const serialized = JSON.stringify(result);
  const parsed = JSON.parse(serialized);

  assert.equal(parsed.suite, 'all');
  assert.equal(parsed.passed > 0, true);
  assert.equal(parsed.failed, 0);
  assert.equal(parsed.tests.length, parsed.passed);
  assert.match(parsed.startedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(parsed.finishedAt, /^\d{4}-\d{2}-\d{2}T/);
  for (const item of parsed.tests) {
    assert.match(item.id, /^[A-Z]+-\d{3}$/);
    assert.equal(item.status, 'passed');
    assert.equal(typeof item.expected, 'string');
    assert.equal(typeof item.actual, 'string');
    assert.equal(Number.isInteger(item.durationMs), true);
  }
});

test('DRY-003: a forced failure is counted and identifiable', () => {
  const sandbox = loadDryRunSandbox();
  const result = sandbox.runDryTestSuite({
    suite: 'all',
    testIds: ['CFG-001', 'VAL-001'],
    forceFailureTestId: 'VAL-001',
    now: '2026-06-13T12:00:00+09:00'
  });

  assert.equal(result.passed, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.tests.length, 2);
  assert.equal(
    result.tests.find(item => item.id === 'VAL-001').status,
    'failed'
  );
});

test('DRY-004: results do not expose secrets or personal data', () => {
  const sandbox = loadDryRunSandbox();
  const sensitiveValues = [
    'secret-webhook-token',
    'private@example.com',
    '個人名テスト',
    'confidential free text'
  ];
  const result = sandbox.runDryTestSuite({
    suite: 'all',
    now: '2026-06-13T12:00:00+09:00',
    chatWebhookUrl: sensitiveValues[0],
    email: sensitiveValues[1],
    name: sensitiveValues[2],
    freeText: sensitiveValues[3]
  });
  const serialized = JSON.stringify(result);

  for (const sensitiveValue of sensitiveValues) {
    assert.equal(serialized.includes(sensitiveValue), false);
  }
  assert.equal(serialized.includes('https://chat.googleapis.com'), false);
  assert.equal(serialized.includes('token='), false);
});

