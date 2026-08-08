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

function createSubmissionSheet() {
  const rows = [];
  const qUpdates = [];
  return {
    rows,
    qUpdates,
    getLastRow() {
      return rows.length + 1;
    },
    getRange(row, column, numRows, numColumns) {
      return {
        getValues() {
          if (row === 2 && column === 8 && numColumns === 2) {
            return rows.map((savedRow) => [savedRow[7], savedRow[8]]);
          }
          if (row === 2 && column === 16 && numColumns === 1) {
            return rows.map((savedRow) => [savedRow[15]]);
          }
          return [];
        },
        setValue(value) {
          qUpdates.push({ row, column, value });
          const rowIndex = row - 2;
          if (rows[rowIndex]) rows[rowIndex][column - 1] = value;
        }
      };
    },
    appendRow(row) {
      rows.push(row);
    }
  };
}

function createDriveFile(id, url = `https://docs.example.invalid/${id}`) {
  return {
    editors: [],
    getId() {
      return id;
    },
    getUrl() {
      return url;
    },
    addEditor(email) {
      this.editors.push(email);
    },
    isTrashed() {
      return false;
    }
  };
}

function loadSandbox({
  overrides = {},
  calendarEventId = 'event-001',
  driveApp = null
} = {}) {
  const logs = [];
  const submissionSheet = createSubmissionSheet();
  const settingsSheet = {
    getRange() {
      return {
        getValue() {
          return '';
        }
      };
    }
  };
  const propertyStore = {};
  const sandbox = {
    console: {
      log(message) {
        logs.push({ level: 'log', message });
      },
      error(message) {
        logs.push({ level: 'error', message });
      }
    },
    CalendarHandler: {
      handleCalendarEvent() {
        return calendarEventId;
      },
      addMeetLinkToEvent() {}
    },
    DriveApp: driveApp || {
      getFolderById() {
        throw new Error('DriveApp is not configured for this test');
      },
      getFileById() {
        throw new Error('DriveApp is not configured for this test');
      }
    },
    HtmlService: {},
    LockService: {
      getScriptLock() {
        return {
          waitLock() {},
          releaseLock() {}
        };
      }
    },
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(key) {
            if (key === 'GAOSYS_SPREADSHEET_ID') {
              return 'configured-spreadsheet-id';
            }
            return propertyStore[key] || '';
          },
          setProperty(key, value) {
            propertyStore[key] = value;
          }
        };
      }
    },
    Session: {
      getActiveUser() {
        return {
          getEmail() {
            return 'member@example.com';
          }
        };
      },
      getScriptTimeZone() {
        return 'Asia/Tokyo';
      }
    },
    SpreadsheetApp: {
      openById() {
        return {
          getSheetByName(name) {
            if (name === '申込リスト') return submissionSheet;
            if (name === '設定用') return settingsSheet;
            return null;
          }
        };
      }
    },
    Utilities: {
      formatDate() {
        return '2026年07月20日（月）';
      },
      getUuid() {
        return 'submission-001';
      }
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(domainSource, sandbox, { filename: 'domain.js' });
  vm.runInContext(codeSource, sandbox, { filename: 'code.js' });

  sandbox.loadApplicationConfiguration_ = () => ({
    ok: true,
    value: {
      calendarTitle: 'Startup MTG',
      calendarId: 'calendar@example.com',
      durationMinutes: 60,
      startTime: '20:00',
      evaluationTemplateId: 'template-id',
      evaluationFolderId: 'folder-id',
      mailSubjectTemplate: 'Subject {{name}}',
      mailBodyTemplate: 'Sheet {{evaluationSheetUrl}}',
      chatWebhookUrl: 'https://example.invalid/webhook'
    }
  });
  if (!driveApp) {
    sandbox.provisionEvaluationSheet_ = () => ({
      status: 'success',
      fileId: 'file-001',
      fileName: '★【たろう】評価項目チェックシート',
      url: 'https://docs.example.invalid/evaluation',
      reused: false
    });
  }
  sandbox.registerIndexRow_ = () => ({
    status: 'success',
    row: 2,
    reused: false
  });
  sandbox.notifyOnboardingChat_ = () => ({
    status: 'success',
    errorCode: null,
    responseCode: 200,
    reused: false
  });
  sandbox.sendAcknowledgementMail_ = () => ({
    status: 'success',
    errorCode: null,
    reused: false
  });
  sandbox.getMasterData = () => [
    { fullName: '山田 太郎', hiragana: 'やまだ たろう', nickname: 'たろう' }
  ];

  Object.assign(sandbox, overrides);

  return { sandbox, logs, submissionSheet, propertyStore };
}

const validForm = {
  startTime: '2026-07-20',
  challenge: false,
  name: '山田 太郎',
  tadasukeName: 'たろう',
  freeText: ''
};

test('FLOW-001/IDEM-002: saveFormData stores submissionId and operation states', () => {
  const { sandbox, submissionSheet } = loadSandbox();

  const result = sandbox.saveFormData(validForm);

  assert.equal(result.success, true);
  assert.equal(result.submissionId, 'submission-001');
  assert.deepEqual(
    JSON.parse(JSON.stringify(result.operations)),
    {
      calendar: 'success',
      submission: 'success',
      evaluationSheet: 'success',
      index: 'success',
      chat: 'success',
      mail: 'success'
    }
  );
  assert.equal(submissionSheet.rows.length, 1);
  assert.equal(submissionSheet.rows[0][15], 'submission-001');
  assert.deepEqual(
    JSON.parse(submissionSheet.rows[0][16]),
    JSON.parse(JSON.stringify(result.operations))
  );
  assert.equal(submissionSheet.rows[0].length, 17);
});

test('FLOW-004/005: partial failures do not fail accepted submission', () => {
  const { sandbox, submissionSheet } = loadSandbox({
    overrides: {
      registerIndexRow_: () => ({
        status: 'failed',
        errorCode: 'INDEX_WRITE_FAILED',
        reused: false
      }),
      notifyOnboardingChat_: () => ({
        status: 'failed',
        errorCode: 'CHAT_FAILED',
        responseCode: 500,
        reused: false
      })
    }
  });

  const result = sandbox.saveFormData(validForm);

  assert.equal(result.success, true);
  assert.equal(result.operations.index, 'failed');
  assert.equal(result.operations.chat, 'failed');
  assert.equal(result.operations.mail, 'success');
  assert.deepEqual(
    JSON.parse(submissionSheet.qUpdates.at(-1).value),
    JSON.parse(JSON.stringify(result.operations))
  );
});

test('IDEM-004: same submissionId does not append a second submission row', () => {
  const { sandbox, submissionSheet } = loadSandbox({
    overrides: {
      provisionEvaluationSheet_: () => ({
        status: 'success',
        fileId: 'file-001',
        fileName: '★【たろう】評価項目チェックシート',
        url: 'https://docs.example.invalid/evaluation',
        reused: true
      }),
      registerIndexRow_: () => ({
        status: 'success',
        row: 2,
        reused: true
      }),
      notifyOnboardingChat_: () => ({
        status: 'success',
        errorCode: null,
        responseCode: 200,
        reused: true
      }),
      sendAcknowledgementMail_: () => ({
        status: 'success',
        errorCode: null,
        reused: true
      })
    }
  });

  const first = sandbox.saveFormData({
    ...validForm,
    submissionId: 'retry-submission-001'
  });
  const second = sandbox.saveFormData({
    ...validForm,
    submissionId: 'retry-submission-001'
  });

  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.equal(submissionSheet.rows.length, 1);
  assert.equal(submissionSheet.rows[0][15], 'retry-submission-001');
  assert.deepEqual(
    JSON.parse(submissionSheet.rows[0][16]),
    JSON.parse(JSON.stringify(second.operations))
  );
});

test('FLOW-006: structured logs use submissionId without webhook or email values', () => {
  const { sandbox, logs } = loadSandbox();

  sandbox.saveFormData(validForm);
  const serialized = JSON.stringify(logs);

  assert.equal(serialized.includes('submission-001'), true);
  assert.equal(serialized.includes('member@example.com'), false);
  assert.equal(serialized.includes('https://example.invalid/webhook'), false);
});

test('FLOW-002: calendar failure stops before submission write', () => {
  const { sandbox, submissionSheet } = loadSandbox({ calendarEventId: '' });

  const result = sandbox.saveFormData(validForm);

  assert.equal(result.success, false);
  assert.equal(result.operations.calendar, 'failed');
  assert.equal(submissionSheet.rows.length, 0);
});

test('FLOW-003: invalid configuration stops before calendar operation', () => {
  const { sandbox, submissionSheet } = loadSandbox();
  sandbox.loadApplicationConfiguration_ = () => ({
    ok: false,
    errorCode: 'CONFIG_INVALID',
    missing: ['evaluationTemplateId'],
    invalid: []
  });

  const result = sandbox.saveFormData(validForm);

  assert.equal(result.success, false);
  assert.equal(result.errorCode, 'CONFIG_INVALID');
  assert.equal(result.operations.calendar, 'skipped');
  assert.equal(submissionSheet.rows.length, 0);
});

test('FLOW-007: server validation stops before configuration and calendar', () => {
  const { sandbox, submissionSheet } = loadSandbox();
  let configurationCalls = 0;
  sandbox.loadApplicationConfiguration_ = () => {
    configurationCalls += 1;
    return { ok: true, value: {} };
  };

  const result = sandbox.saveFormData({
    ...validForm,
    name: '未登録 太郎'
  });

  assert.equal(result.success, false);
  assert.equal(result.errorCode, 'VALIDATION_ERROR');
  assert.equal(result.operations.calendar, 'skipped');
  assert.equal(configurationCalls, 0);
  assert.equal(submissionSheet.rows.length, 0);
});

// E2E-EVAL-001/002: the real provisionEvaluationSheet_ (not a stub) runs
// inside the full saveFormData flow, so the fix applied to it (idempotency
// key saved right after copy, permission re-checked on reuse, trashed files
// rejected) is exercised end-to-end and its blast radius on the surrounding
// flow (calendar, submission, index, chat, mail) can be confirmed directly.
function buildDriveApp({ failPermission = false } = {}) {
  const folder = { id: 'folder-id' };
  const template = {
    makeCopy(fileName) {
      const file = createDriveFile('evaluation-file-001');
      if (failPermission) {
        file.addEditor = () => {
          throw new Error('permission failed');
        };
      }
      file.fileName = fileName;
      return file;
    }
  };
  return {
    getFolderById(id) {
      if (id !== folder.id) throw new Error('folder not found');
      return folder;
    },
    getFileById(id) {
      if (id !== 'template-id') throw new Error('file not found');
      return template;
    }
  };
}

test('E2E-EVAL-001: full flow succeeds through the real evaluation sheet provisioning, calendar/submission/chat unaffected', () => {
  const { sandbox, submissionSheet, propertyStore } = loadSandbox({
    driveApp: buildDriveApp()
  });

  const result = sandbox.saveFormData(validForm);

  assert.equal(result.success, true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(result.operations)),
    {
      calendar: 'success',
      submission: 'success',
      evaluationSheet: 'success',
      index: 'success',
      chat: 'success',
      mail: 'success'
    }
  );
  assert.equal(submissionSheet.rows.length, 1);
  assert.equal(
    propertyStore['EVALUATION_FILE_submission-001'],
    'evaluation-file-001'
  );
});

test('E2E-EVAL-002: a real evaluation sheet permission failure only skips index/mail, leaving calendar/submission/chat and overall success unaffected', () => {
  const { sandbox, submissionSheet } = loadSandbox({
    driveApp: buildDriveApp({ failPermission: true })
  });

  const result = sandbox.saveFormData(validForm);

  assert.equal(result.success, true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(result.operations)),
    {
      calendar: 'success',
      submission: 'success',
      evaluationSheet: 'failed',
      index: 'skipped',
      chat: 'success',
      mail: 'skipped'
    }
  );
  assert.equal(submissionSheet.rows.length, 1);
});
