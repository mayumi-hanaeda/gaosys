import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDir, '..');
const domainSource = fs.readFileSync(
  path.join(repositoryRoot, 'domain.js'),
  'utf8'
);
const codeSource = fs.readFileSync(
  path.join(repositoryRoot, 'code.js'),
  'utf8'
);

function loadSandbox({
  settingsRow,
  properties = {},
  includeSettingsSheet = true
}) {
  const logs = [];
  const ranges = [];
  const openedSpreadsheetIds = [];
  const settingsSheet = includeSettingsSheet
    ? {
        getRange(a1Notation) {
          ranges.push(a1Notation);
          return {
            getValues() {
              return [settingsRow];
            }
          };
        }
      }
    : null;
  const sandbox = {
    console: {
      log(message) {
        logs.push({ level: 'log', message });
      },
      error(message) {
        logs.push({ level: 'error', message });
      }
    },
    SpreadsheetApp: {
      openById(spreadsheetId) {
        openedSpreadsheetIds.push(spreadsheetId);
        return {
          getSheetByName() {
            return settingsSheet;
          }
        };
      }
    },
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(key) {
            return properties[key] || '';
          }
        };
      }
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(domainSource, sandbox, { filename: 'domain.js' });
  vm.runInContext(codeSource, sandbox, { filename: 'code.js' });

  return { sandbox, logs, ranges, openedSpreadsheetIds };
}

const validSettingsRow = [
  'Startup MTG',
  'calendar@example.com',
  60,
  '20:30',
  'template-id',
  'Hello {{name}}',
  'Sheet: {{evaluationSheetUrl}}'
];
const validProperties = {
  GAOSYS_SPREADSHEET_ID: 'configured-spreadsheet-id',
  CHAT_WEBHOOK_URL: 'https://example.invalid/chat-secret',
  EVALUATION_SHEET_FOLDER_ID: 'folder-id'
};

test('CFG-007: GAS configuration loader reads A2:G2 and Script Properties', () => {
  const { sandbox, ranges } = loadSandbox({
    settingsRow: validSettingsRow,
    properties: validProperties
  });

  const result = sandbox.loadApplicationConfiguration_();

  assert.equal(result.ok, true);
  assert.deepEqual(ranges, ['A2:G2']);
  assert.equal(result.value.evaluationTemplateId, 'template-id');
  assert.equal(result.value.mailSubjectTemplate, 'Hello {{name}}');
  assert.equal(result.value.mailBodyTemplate, 'Sheet: {{evaluationSheetUrl}}');
  assert.equal(result.value.chatWebhookUrl, validProperties.CHAT_WEBHOOK_URL);
  assert.equal(result.value.evaluationFolderId, 'folder-id');
});

test('CFG-008: missing settings are logged by key without secret values', () => {
  const secret = 'secret-value-that-must-not-be-logged';
  const { sandbox, logs } = loadSandbox({
    settingsRow: [
      'Startup MTG',
      'calendar@example.com',
      60,
      '',
      '',
      '',
      ''
    ],
    properties: {
      GAOSYS_SPREADSHEET_ID: 'configured-spreadsheet-id',
      CHAT_WEBHOOK_URL: secret,
      EVALUATION_SHEET_FOLDER_ID: ''
    }
  });

  const result = sandbox.loadApplicationConfiguration_();
  const serializedLogs = JSON.stringify(logs);

  assert.equal(result.ok, false);
  assert.equal(result.errorCode, 'CONFIG_INVALID');
  assert.deepEqual(
    Array.from(result.missing).sort(),
    [
      'EVALUATION_SHEET_FOLDER_ID',
      'evaluationTemplateId',
      'mailBodyTemplate',
      'mailSubjectTemplate'
    ]
  );
  assert.equal(serializedLogs.includes('CONFIG_INVALID'), true);
  assert.equal(serializedLogs.includes(secret), false);
});

test('CFG-009: public status never returns configuration values', () => {
  const { sandbox } = loadSandbox({
    settingsRow: validSettingsRow,
    properties: validProperties
  });

  const result = sandbox.getApplicationConfigurationStatus();
  const serialized = JSON.stringify(result);

  assert.deepEqual(
    JSON.parse(serialized),
    { ok: true, errorCode: null, missing: [], invalid: [] }
  );
  assert.equal(serialized.includes('chat-secret'), false);
  assert.equal(serialized.includes('template-id'), false);
  assert.equal(serialized.includes('folder-id'), false);
});

test('CFG-010: a missing settings sheet returns a safe error', () => {
  const { sandbox, logs } = loadSandbox({
    settingsRow: validSettingsRow,
    properties: validProperties,
    includeSettingsSheet: false
  });

  const result = sandbox.loadApplicationConfiguration_();
  const serialized = JSON.stringify({ result, logs });

  assert.deepEqual(
    JSON.parse(JSON.stringify(result)),
    {
      ok: false,
      errorCode: 'CONFIG_SOURCE_UNAVAILABLE',
      missing: ['SETTINGS_SHEET'],
      invalid: []
    }
  );
  assert.equal(serialized.includes(validProperties.CHAT_WEBHOOK_URL), false);
});

test('CFG-011: spreadsheet id override is opt-in through Script Properties', () => {
  const defaultRun = loadSandbox({
    settingsRow: validSettingsRow,
    properties: validProperties
  });
  const overrideRun = loadSandbox({
    settingsRow: validSettingsRow,
    properties: {
      ...validProperties,
      GAOSYS_SPREADSHEET_ID_OVERRIDE: 'test-spreadsheet-id'
    }
  });

  defaultRun.sandbox.loadApplicationConfiguration_();
  overrideRun.sandbox.loadApplicationConfiguration_();

  assert.deepEqual(defaultRun.openedSpreadsheetIds, [
    'configured-spreadsheet-id'
  ]);
  assert.deepEqual(overrideRun.openedSpreadsheetIds, [
    'test-spreadsheet-id'
  ]);
});
