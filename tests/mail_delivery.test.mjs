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

function loadSandbox({ failSend = false, initialProperties = {} } = {}) {
  const sentEmails = [];
  const properties = { ...initialProperties };
  const sandbox = {
    console,
    MailApp: {
      sendEmail(message) {
        if (failSend) throw new Error('mail failed');
        sentEmails.push(message);
      }
    },
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(key) {
            return Object.hasOwn(properties, key) ? properties[key] : '';
          },
          setProperty(key, value) {
            properties[key] = value;
          }
        };
      }
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(domainSource, sandbox, { filename: 'domain.js' });
  vm.runInContext(codeSource, sandbox, { filename: 'code.js' });

  return { sandbox, sentEmails, properties };
}

const submission = {
  submissionId: 'submission-001',
  email: 'member@example.com',
  name: '山田 太郎',
  tadasukeName: 'たろう',
  startDate: '2026年07月20日（月）',
  challenge: 'チャレンジ講師を希望しない',
  freeText: ''
};

const evaluationSheet = {
  url: 'https://docs.example.invalid/evaluation'
};

const configuration = {
  mailSubjectTemplate: '【タダスク】{{name}}さん 申込受付',
  mailBodyTemplate: [
    '{{name}}さん',
    '',
    '申込を受け付けました。',
    '{{responseSummary}}',
    '',
    '評価シート: {{evaluationSheetUrl}}'
  ].join('\n')
};

test('MAIL-006: acknowledgement mail is sent and tracked', () => {
  const { sandbox, sentEmails, properties } = loadSandbox();

  const result = sandbox.sendAcknowledgementMail_(
    submission,
    evaluationSheet,
    configuration
  );

  assert.deepEqual(
    JSON.parse(JSON.stringify(result)),
    { status: 'success', errorCode: null, reused: false }
  );
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].to, 'member@example.com');
  assert.equal(sentEmails[0].subject, '【タダスク】山田 太郎さん 申込受付');
  assert.match(sentEmails[0].body, /自由記載: なし/);
  assert.match(sentEmails[0].body, /https:\/\/docs\.example\.invalid\/evaluation/);
  assert.equal(sentEmails[0].body.includes('{{'), false);
  assert.match(properties.MAIL_SENT_submission_001, /^\d{4}-\d{2}-\d{2}T/);
});

test('MAIL-007: invalid template and missing evaluation URL skip sending', () => {
  const invalidTemplate = loadSandbox();
  const invalidResult = invalidTemplate.sandbox.sendAcknowledgementMail_(
    submission,
    evaluationSheet,
    {
      ...configuration,
      mailBodyTemplate: 'Hello {{unknown}}'
    }
  );

  assert.deepEqual(
    JSON.parse(JSON.stringify(invalidResult)),
    {
      status: 'failed',
      errorCode: 'MAIL_TEMPLATE_INVALID',
      reused: false
    }
  );
  assert.equal(invalidTemplate.sentEmails.length, 0);

  const missingEvaluation = loadSandbox();
  const missingResult = missingEvaluation.sandbox.sendAcknowledgementMail_(
    submission,
    { url: '' },
    configuration
  );

  assert.deepEqual(
    JSON.parse(JSON.stringify(missingResult)),
    { status: 'skipped', errorCode: null, reused: false }
  );
  assert.equal(missingEvaluation.sentEmails.length, 0);
});

test('MAIL-008: send failure does not mark sent', () => {
  const { sandbox, sentEmails, properties } = loadSandbox({ failSend: true });

  const result = sandbox.sendAcknowledgementMail_(
    submission,
    evaluationSheet,
    configuration
  );

  assert.deepEqual(
    JSON.parse(JSON.stringify(result)),
    { status: 'failed', errorCode: 'MAIL_FAILED', reused: false }
  );
  assert.equal(sentEmails.length, 0);
  assert.equal(properties.MAIL_SENT_submission_001, undefined);
});

test('MAIL-009: sent acknowledgement mail is not resent', () => {
  const { sandbox, sentEmails } = loadSandbox({
    initialProperties: {
      MAIL_SENT_submission_001: '2026-06-16T00:00:00.000Z'
    }
  });

  const result = sandbox.sendAcknowledgementMail_(
    submission,
    evaluationSheet,
    configuration
  );

  assert.deepEqual(
    JSON.parse(JSON.stringify(result)),
    { status: 'success', errorCode: null, reused: true }
  );
  assert.equal(sentEmails.length, 0);
});
