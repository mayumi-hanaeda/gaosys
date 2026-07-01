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
const sandbox = {};

vm.createContext(sandbox);
vm.runInContext(domainSource, sandbox, { filename: 'domain.js' });

const domain = sandbox.GaosysDomain;

test('CFG-001: valid configuration is normalized', () => {
  const result = domain.normalizeConfiguration(
    {
      calendarTitle: 'Startup MTG',
      calendarId: 'calendar@example.com',
      durationMinutes: 60,
      startTime: '20:30',
      evaluationTemplateId: 'template-id',
      mailSubjectTemplate: 'Hello {{name}}',
      mailBodyTemplate: 'Sheet: {{evaluationSheetUrl}}'
    },
    {
      chatWebhookUrl: 'https://example.invalid/webhook',
      evaluationFolderId: 'folder-id'
    }
  );

  assert.equal(result.ok, true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(result.value)),
    {
      calendarTitle: 'Startup MTG',
      calendarId: 'calendar@example.com',
      durationMinutes: 60,
      startTime: '20:30',
      evaluationTemplateId: 'template-id',
      mailSubjectTemplate: 'Hello {{name}}',
      mailBodyTemplate: 'Sheet: {{evaluationSheetUrl}}',
      chatWebhookUrl: 'https://example.invalid/webhook',
      evaluationFolderId: 'folder-id'
    }
  );
});

test('CFG-002: blank start time defaults to 20:00', () => {
  const result = domain.normalizeConfiguration(
    {
      calendarTitle: 'Startup MTG',
      calendarId: 'calendar@example.com',
      durationMinutes: 60,
      startTime: '',
      evaluationTemplateId: 'template-id',
      mailSubjectTemplate: 'Subject',
      mailBodyTemplate: 'Body'
    },
    {
      chatWebhookUrl: 'https://example.invalid/webhook',
      evaluationFolderId: 'folder-id'
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.value.startTime, '20:00');
});

test('CFG-003: missing required settings return names without values', () => {
  const result = domain.normalizeConfiguration(
    {
      calendarTitle: 'Startup MTG',
      calendarId: 'calendar@example.com',
      durationMinutes: 60,
      startTime: '',
      evaluationTemplateId: '',
      mailSubjectTemplate: '',
      mailBodyTemplate: ''
    },
    {
      chatWebhookUrl: '',
      evaluationFolderId: ''
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.errorCode, 'CONFIG_INVALID');
  assert.deepEqual(
    Array.from(result.missing).sort(),
    [
      'CHAT_WEBHOOK_URL',
      'EVALUATION_SHEET_FOLDER_ID',
      'evaluationTemplateId',
      'mailBodyTemplate',
      'mailSubjectTemplate'
    ]
  );
  assert.equal(JSON.stringify(result).includes('example.invalid'), false);
});

test('CFG-004/005: invalid duration and time are rejected', () => {
  const base = {
    calendarTitle: 'Startup MTG',
    calendarId: 'calendar@example.com',
    durationMinutes: 60,
    startTime: '20:00',
    evaluationTemplateId: 'template-id',
    mailSubjectTemplate: 'Subject',
    mailBodyTemplate: 'Body'
  };
  const properties = {
    chatWebhookUrl: 'https://example.invalid/webhook',
    evaluationFolderId: 'folder-id'
  };

  for (const durationMinutes of [0, -1, 1.5, '60']) {
    const result = domain.normalizeConfiguration(
      { ...base, durationMinutes },
      properties
    );
    assert.equal(result.ok, false);
    assert.equal(result.invalid.includes('durationMinutes'), true);
  }

  const invalidTime = domain.normalizeConfiguration(
    { ...base, startTime: '25:90' },
    properties
  );
  assert.equal(invalidTime.ok, false);
  assert.equal(invalidTime.invalid.includes('startTime'), true);
});

test('VAL-001: valid form input is normalized', () => {
  const result = domain.validateFormInput(
    {
      name: ' 山田 太郎 ',
      tadasukeName: ' たろう ',
      startTime: '2026-07-20',
      challenge: false,
      freeText: '質問です'
    },
    ['山田 太郎'],
    'member@example.com'
  );

  assert.equal(result.ok, true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(result.value)),
    {
      name: '山田 太郎',
      tadasukeName: 'たろう',
      startTime: '2026-07-20',
      challenge: false,
      freeText: '質問です',
      email: 'member@example.com'
    }
  );
});

test('VAL-002〜006: invalid form fields are identified', () => {
  const base = {
    name: '山田 太郎',
    tadasukeName: 'たろう',
    startTime: '2026-07-20',
    challenge: false,
    freeText: ''
  };
  const names = ['山田 太郎'];

  const cases = [
    [{ ...base, name: '未登録' }, names, 'member@example.com', 'name'],
    [{ ...base, tadasukeName: 'x'.repeat(101) }, names, 'member@example.com', 'tadasukeName'],
    [{ ...base, startTime: '2026-02-30' }, names, 'member@example.com', 'startTime'],
    [{ ...base, challenge: 'false' }, names, 'member@example.com', 'challenge'],
    [{ ...base, freeText: 'x'.repeat(5001) }, names, 'member@example.com', 'freeText'],
    [base, names, 'invalid-email', 'email']
  ];

  for (const [input, masterNames, email, field] of cases) {
    const result = domain.validateFormInput(input, masterNames, email);
    assert.equal(result.ok, false);
    assert.equal(result.errorCode, 'VALIDATION_ERROR');
    assert.equal(result.invalid.includes(field), true);
  }
});

test('EVAL-001〜003: evaluation sheet names are sanitized', () => {
  assert.equal(
    domain.buildEvaluationSheetName(' たろう ', '山田 太郎'),
    '★【たろう】評価項目チェックシート'
  );
  assert.equal(
    domain.buildEvaluationSheetName('たろう\n\t  講師', '山田 太郎'),
    '★【たろう 講師】評価項目チェックシート'
  );
  assert.equal(
    domain.buildEvaluationSheetName('\n\t', ' 山田 太郎 '),
    '★【山田 太郎】評価項目チェックシート'
  );
});

test('IDX-001: index row data targets B through F only', () => {
  const result = domain.buildIndexRowData({
    tadasukeName: 'たろう',
    fileName: '★【たろう】評価項目チェックシート',
    url: 'https://docs.example.invalid/sheet'
  });

  assert.deepEqual(
    JSON.parse(JSON.stringify(result)),
    {
      startColumn: 2,
      values: [
        'たろう',
        '',
        '',
        '',
        '★【たろう】評価項目チェックシート'
      ],
      link: {
        valueIndex: 4,
        text: '★【たろう】評価項目チェックシート',
        url: 'https://docs.example.invalid/sheet'
      }
    }
  );
});

test('CHAT-001〜003: chat message covers success, failure, and empty free text', () => {
  const base = {
    submissionId: 'submission-id',
    email: 'member@example.com',
    name: '山田 太郎',
    tadasukeName: 'たろう',
    startDate: '2026年07月20日（月）',
    challenge: 'チャレンジ講師を希望しない',
    freeText: '',
    spreadsheetUrl: 'https://sheets.example.invalid/control'
  };

  const success = domain.buildChatMessage({
    ...base,
    evaluationSheetUrl: 'https://docs.example.invalid/evaluation'
  });
  assert.match(success, /\*申込ID\*: submission-id/);
  assert.match(success, /評価項目チェックシート.*https:\/\/docs\.example\.invalid\/evaluation/);
  assert.equal(success.includes('*自由記載*:'), false);

  const failure = domain.buildChatMessage({
    ...base,
    evaluationSheetUrl: ''
  });
  assert.match(failure, /評価項目チェックシート.*発行失敗・要手動対応/);
});

test('MAIL-001〜005: templates are rendered and invalid tags are rejected', () => {
  const values = {
    name: '山田 太郎',
    tadasukeName: 'たろう',
    startDate: '2026年07月20日（月）',
    challenge: 'チャレンジ講師を希望しない',
    freeText: '',
    evaluationSheetUrl: 'https://docs.example.invalid/evaluation'
  };
  const responseSummary = domain.buildResponseSummary(values);
  assert.match(responseSummary, /自由記載: なし/);

  const success = domain.renderMailTemplate(
    'こんにちは {{name}}\n{{responseSummary}}\n{{evaluationSheetUrl}}',
    { ...values, responseSummary }
  );
  assert.equal(success.ok, true);
  assert.equal(success.value.includes('{{'), false);
  assert.match(success.value, /山田 太郎/);

  const unknown = domain.renderMailTemplate('Hello {{unknown}}', values);
  assert.equal(unknown.ok, false);
  assert.equal(unknown.errorCode, 'MAIL_TEMPLATE_INVALID');

  const missing = domain.renderMailTemplate(
    'Sheet: {{evaluationSheetUrl}}',
    { ...values, evaluationSheetUrl: '' }
  );
  assert.equal(missing.ok, false);
  assert.equal(missing.errorCode, 'MAIL_TEMPLATE_INVALID');
});

test('CHAT-004/005: only HTTP 2xx is successful', () => {
  assert.equal(domain.isSuccessfulHttpStatus(200), true);
  assert.equal(domain.isSuccessfulHttpStatus(204), true);
  assert.equal(domain.isSuccessfulHttpStatus(299), true);
  assert.equal(domain.isSuccessfulHttpStatus(300), false);
  assert.equal(domain.isSuccessfulHttpStatus(400), false);
  assert.equal(domain.isSuccessfulHttpStatus(500), false);
});

test('REG-005: future third Mondays are deterministic with a fixed clock', () => {
  const dates = domain.generateFutureThirdMondays(
    new Date(2026, 5, 13, 12, 0, 0),
    3
  );

  assert.deepEqual(
    JSON.parse(JSON.stringify(dates)),
    [
      { display: '2026年6月15日(月)', value: '2026-06-15' },
      { display: '2026年7月20日(月)', value: '2026-07-20' },
      { display: '2026年8月17日(月)', value: '2026-08-17' }
    ]
  );
});

