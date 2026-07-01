import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDir, '..');

function loadIntegrationSandbox() {
  const storedProperties = {
    GAOSYS_SPREADSHEET_ID: 'production-spreadsheet-id'
  };
  const sandbox = {
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(key) {
            return storedProperties[key] || '';
          }
        };
      }
    }
  };
  vm.createContext(sandbox);
  for (const fileName of ['integration_test.js']) {
    const source = fs.readFileSync(
      path.join(repositoryRoot, fileName),
      'utf8'
    );
    vm.runInContext(source, sandbox, { filename: fileName });
  }
  return sandbox;
}

function validConfiguration() {
  return {
    TEST_SPREADSHEET_ID: 'test-spreadsheet-id',
    TEST_CALENDAR_ID: 'test-calendar-id',
    TEST_EVALUATION_FOLDER_ID: 'test-folder-id',
    TEST_CHAT_WEBHOOK_URL: 'https://example.invalid/test-webhook',
    TEST_MAIL_RECIPIENT: 'integration@example.invalid'
  };
}

function createTestChatWebhookUrl() {
  return [
    'https://chat.googleapis.com',
    'v1',
    'spaces',
    'test',
    'messages?key=x&token=y'
  ].join('/');
}

test('INTG-001: execution requires an exact confirmation token', () => {
  const sandbox = loadIntegrationSandbox();
  const result = sandbox.GaosysIntegrationTest.prepareRun(
    {
      mode: 'execute',
      testRunId: '20260614T090000Z-abc123',
      confirmToken: 'wrong-token'
    },
    validConfiguration()
  );

  assert.equal(result.ok, false);
  assert.equal(result.errorCode, 'CONFIRMATION_REQUIRED');
  assert.equal(result.externalWrites, 0);
});

test('INTG-002: missing configuration returns key names only', () => {
  const sandbox = loadIntegrationSandbox();
  const configuration = validConfiguration();
  configuration.TEST_CHAT_WEBHOOK_URL = 'secret-chat-value';
  configuration.TEST_MAIL_RECIPIENT = '';

  const result = sandbox.GaosysIntegrationTest.prepareRun(
    { mode: 'preview', testRunId: '20260614T090000Z-abc123' },
    configuration
  );
  const serialized = JSON.stringify(result);

  assert.equal(result.ok, false);
  assert.equal(result.errorCode, 'INTEGRATION_CONFIG_INVALID');
  assert.deepEqual(
    Array.from(result.missing),
    ['TEST_MAIL_RECIPIENT']
  );
  assert.equal(serialized.includes('secret-chat-value'), false);
});

test('INTG-003: preview builds a TEST_RUN_ID-scoped operation plan', () => {
  const sandbox = loadIntegrationSandbox();
  const result = sandbox.GaosysIntegrationTest.prepareRun(
    { mode: 'preview', testRunId: '20260614T090000Z-abc123' },
    validConfiguration()
  );

  assert.equal(result.ok, true);
  assert.equal(result.mode, 'preview');
  assert.equal(result.testRunId, '20260614T090000Z-abc123');
  assert.equal(result.prefix, '[TEST][20260614T090000Z-abc123]');
  assert.equal(result.externalWrites, 0);
  assert.deepEqual(
    Array.from(result.plannedTargets),
    ['spreadsheet', 'calendar', 'drive', 'chat', 'mail']
  );
});

test('INTG-004: cleanup accepts only resources owned by the run', () => {
  const sandbox = loadIntegrationSandbox();
  const owned = sandbox.GaosysIntegrationTest.buildResourceRecord(
    '20260614T090000Z-abc123',
    'drive',
    'file-id'
  );
  const foreign = {
    testRunId: 'different-run',
    target: 'drive',
    resourceId: 'production-file-id',
    marker: '[TEST][different-run]'
  };

  assert.equal(
    sandbox.GaosysIntegrationTest.canCleanupResource(
      '20260614T090000Z-abc123',
      owned
    ),
    true
  );
  assert.equal(
    sandbox.GaosysIntegrationTest.canCleanupResource(
      '20260614T090000Z-abc123',
      foreign
    ),
    false
  );
});

test('INTG-005: production-looking resource identifiers are rejected', () => {
  const sandbox = loadIntegrationSandbox();
  const configuration = validConfiguration();
  configuration.TEST_SPREADSHEET_ID =
    'production-spreadsheet-id';

  const result = sandbox.GaosysIntegrationTest.prepareRun(
    { mode: 'preview', testRunId: '20260614T090000Z-abc123' },
    configuration
  );

  assert.equal(result.ok, false);
  assert.equal(result.errorCode, 'PRODUCTION_RESOURCE_REJECTED');
  assert.deepEqual(
    Array.from(result.rejected),
    ['TEST_SPREADSHEET_ID']
  );
});

test('INTG-006: provisioning requires an exact confirmation token', () => {
  const sandbox = loadIntegrationSandbox();
  const result = sandbox.GaosysIntegrationTest.prepareProvision({
    confirmToken: 'wrong-token'
  });

  assert.equal(result.ok, false);
  assert.equal(result.errorCode, 'PROVISION_CONFIRMATION_REQUIRED');
  assert.equal(result.externalWrites, 0);
});

test('INTG-007: provisioning plan contains only test resources', () => {
  const sandbox = loadIntegrationSandbox();
  const result = sandbox.GaosysIntegrationTest.prepareProvision({
    confirmToken: 'PROVISION:TDD-005'
  });

  assert.equal(result.ok, true);
  assert.equal(result.prefix, '[TEST] GAOSYS Integration');
  assert.deepEqual(
    Array.from(result.resources),
    ['spreadsheet', 'calendar', 'driveFolder', 'mailRecipient']
  );
  assert.equal(result.externalWrites, 0);
});

test('INTG-008: Chat webhook configuration validates token and URL', () => {
  const sandbox = loadIntegrationSandbox();
  const denied = sandbox.GaosysIntegrationTest.prepareChatWebhook({
    confirmToken: 'wrong-token',
    webhookUrl: createTestChatWebhookUrl()
  });
  const accepted = sandbox.GaosysIntegrationTest.prepareChatWebhook({
    confirmToken: 'CONFIGURE:TDD-005-CHAT',
    webhookUrl: createTestChatWebhookUrl()
  });

  assert.equal(denied.ok, false);
  assert.equal(denied.errorCode, 'CHAT_CONFIG_CONFIRMATION_REQUIRED');
  assert.equal(accepted.ok, true);
  assert.equal(Object.hasOwn(accepted, 'webhookUrl'), false);
});

test('INTG-009: execute runs only test adapters and cleans resources', () => {
  const sandbox = loadIntegrationSandbox();
  const calls = [];
  const adapter = {};
  for (const target of [
    'spreadsheet',
    'calendar',
    'drive',
    'chat',
    'mail'
  ]) {
    adapter[target] = testRunId => {
      calls.push(`${target}:${testRunId}`);
      return {
        status: 'passed',
        cleaned: ['spreadsheet', 'calendar', 'drive'].includes(target)
      };
    };
  }

  const result = sandbox.GaosysIntegrationTest.executeWithAdapter(
    {
      mode: 'execute',
      testRunId: '20260615T120000Z-smoke01',
      confirmToken: 'RUN:20260615T120000Z-smoke01'
    },
    validConfiguration(),
    adapter
  );

  assert.equal(result.ok, true);
  assert.equal(result.passed, 5);
  assert.equal(result.failed, 0);
  assert.deepEqual(
    Array.from(calls),
    [
      'spreadsheet:20260615T120000Z-smoke01',
      'calendar:20260615T120000Z-smoke01',
      'drive:20260615T120000Z-smoke01',
      'chat:20260615T120000Z-smoke01',
      'mail:20260615T120000Z-smoke01'
    ]
  );
  assert.equal(JSON.stringify(result).includes('example.invalid'), false);
});
