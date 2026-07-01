import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDir, '..');
const source = fs.readFileSync(
  path.join(repositoryRoot, 'チャット通知Bot.js'),
  'utf8'
);
const domainSource = fs.readFileSync(
  path.join(repositoryRoot, 'domain.js'),
  'utf8'
);

function loadScript({
  webhookUrl = '',
  responseCode = 200,
  initialProperties = {}
} = {}) {
  const fetchCalls = [];
  const storedProperties = { ...initialProperties };
  if (webhookUrl) {
    storedProperties.CHAT_WEBHOOK_URL = webhookUrl;
  }
  const sandbox = {
    console,
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(key) {
            return Object.hasOwn(storedProperties, key)
              ? storedProperties[key]
              : null;
          },
          setProperty(key, value) {
            storedProperties[key] = value;
          }
        };
      }
    },
    UrlFetchApp: {
      fetch(url, options) {
        fetchCalls.push({ url, options });
        return {
          getResponseCode() {
            return responseCode;
          }
        };
      }
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(domainSource, sandbox, { filename: 'domain.js' });
  vm.runInContext(source, sandbox, { filename: 'チャット通知Bot.js' });

  return { sandbox, fetchCalls, storedProperties };
}

test('SEC-001: production source contains no Chat webhook URL', () => {
  assert.equal(
    /https:\/\/chat\.googleapis\.com\/v1\/spaces\//.test(source),
    false
  );
});

test('CHAT-004: webhook is loaded from Script Properties', () => {
  const webhookUrl = 'https://example.invalid/chat-webhook';
  const { sandbox, fetchCalls } = loadScript({ webhookUrl });

  const result = sandbox.sendNotificationToChat_('test message');

  assert.equal(result.ok, true);
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, webhookUrl);
});

test('CHAT-005: missing webhook and non-2xx responses fail safely', () => {
  const missing = loadScript();
  const missingResult = missing.sandbox.sendNotificationToChat_('test');

  assert.deepEqual(
    JSON.parse(JSON.stringify(missingResult)),
    { ok: false, errorCode: 'CHAT_WEBHOOK_NOT_CONFIGURED' }
  );
  assert.equal(missing.fetchCalls.length, 0);

  const rejected = loadScript({
    webhookUrl: 'https://example.invalid/chat-webhook',
    responseCode: 500
  });
  const rejectedResult = rejected.sandbox.sendNotificationToChat_('test');

  assert.deepEqual(
    JSON.parse(JSON.stringify(rejectedResult)),
    { ok: false, errorCode: 'CHAT_HTTP_ERROR', responseCode: 500 }
  );
});

test('CHAT-005b: support spreadsheet URL is loaded from Script Properties', () => {
  const { sandbox } = loadScript({
    initialProperties: {
      SUPPORT_STATUS_SPREADSHEET_URL: 'https://sheets.example.invalid/control'
    }
  });

  assert.equal(
    sandbox.getDefaultSpreadsheetUrl_(),
    'https://sheets.example.invalid/control'
  );
  assert.equal(
    sandbox.getAdditionalNotificationMessage_(),
    'サポート状況＆新講師申込フォーム：https://sheets.example.invalid/control'
  );
});

test('SEC-002: production webhook configuration requires confirmation', () => {
  const { sandbox, storedProperties } = loadScript();
  const webhookUrl = [
    'https://chat.googleapis.com',
    'v1',
    'spaces',
    'example',
    'messages'
  ].join('/');

  const rejected = sandbox.configureProductionChatWebhook({
    confirmToken: 'wrong',
    webhookUrl
  });
  assert.equal(rejected.ok, false);
  assert.equal(storedProperties.CHAT_WEBHOOK_URL, undefined);

  const configured = sandbox.configureProductionChatWebhook({
    confirmToken: 'CONFIGURE:SEC-001-CHAT',
    webhookUrl
  });
  assert.deepEqual(
    JSON.parse(JSON.stringify(configured)),
    { ok: true, propertyKey: 'CHAT_WEBHOOK_URL' }
  );
  assert.equal(storedProperties.CHAT_WEBHOOK_URL, webhookUrl);
  assert.equal(JSON.stringify(configured).includes(webhookUrl), false);
});

test('CHAT-006: onboarding notification includes evaluation URL and is idempotent', () => {
  const { sandbox, fetchCalls, storedProperties } = loadScript({
    webhookUrl: 'https://example.invalid/chat-webhook'
  });
  const submission = {
    submissionId: 'submission-001',
    email: 'member@example.com',
    name: '山田 太郎',
    tadasukeName: 'たろう',
    startDate: '2026年07月20日（月）',
    challenge: 'チャレンジ講師を希望する',
    freeText: ''
  };
  const evaluationSheet = {
    url: 'https://docs.example.invalid/evaluation',
    name: '★【たろう】評価項目チェックシート'
  };

  const result = sandbox.notifyOnboardingChat_(submission, evaluationSheet, {
    spreadsheetUrl: 'https://sheets.example.invalid/control'
  });

  assert.deepEqual(
    JSON.parse(JSON.stringify(result)),
    {
      status: 'success',
      errorCode: null,
      responseCode: 200,
      reused: false
    }
  );
  assert.equal(fetchCalls.length, 1);
  const payload = JSON.parse(fetchCalls[0].options.payload);
  assert.match(payload.text, /\*申込ID\*: submission-001/);
  assert.match(payload.text, /評価項目チェックシート.*https:\/\/docs\.example\.invalid\/evaluation/);
  assert.equal(payload.text.includes('*自由記載*:'), false);
  assert.match(storedProperties.CHAT_SENT_submission_001, /^\d{4}-\d{2}-\d{2}T/);

  const reused = sandbox.notifyOnboardingChat_(submission, evaluationSheet, {
    spreadsheetUrl: 'https://sheets.example.invalid/control'
  });
  assert.equal(reused.status, 'success');
  assert.equal(reused.reused, true);
  assert.equal(fetchCalls.length, 1);
});

test('CHAT-007: failed onboarding notification does not mark sent', () => {
  const { sandbox, storedProperties } = loadScript({
    webhookUrl: 'https://example.invalid/chat-webhook',
    responseCode: 500
  });

  const result = sandbox.notifyOnboardingChat_(
    {
      submissionId: 'submission-002',
      email: 'member@example.com',
      name: '山田 太郎',
      tadasukeName: 'たろう',
      startDate: '2026年07月20日（月）',
      challenge: 'チャレンジ講師を希望しない',
      freeText: '確認事項あり'
    },
    { url: 'https://docs.example.invalid/evaluation' },
    { spreadsheetUrl: 'https://sheets.example.invalid/control' }
  );

  assert.deepEqual(
    JSON.parse(JSON.stringify(result)),
    {
      status: 'failed',
      errorCode: 'CHAT_FAILED',
      responseCode: 500,
      reused: false
    }
  );
  assert.equal(storedProperties.CHAT_SENT_submission_002, undefined);
});
