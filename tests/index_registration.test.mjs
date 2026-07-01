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

function createSheet(existingNames = ['existing']) {
  const writes = [];
  const richTextWrites = [];

  return {
    writes,
    richTextWrites,
    getLastRow() {
      return existingNames.length + 1;
    },
    getRange(row, column, numRows, numColumns) {
      return {
        getValues() {
          if (column === 2 && numColumns === 1) {
            return existingNames.slice(row - 2, row - 2 + numRows)
              .map((value) => [value]);
          }
          return [];
        },
        setValues(values) {
          writes.push({ row, column, numRows, numColumns, values });
        },
        setRichTextValue(value) {
          richTextWrites.push({ row, column, value });
        }
      };
    }
  };
}

function loadSandbox({
  existingNames,
  existingIndexRow = '',
  missingSheet = false
} = {}) {
  const sheet = createSheet(existingNames);
  const properties = existingIndexRow
    ? { 'INDEX_ROW_sub-001': String(existingIndexRow) }
    : {};
  const lock = {
    waitLockCalls: [],
    released: false,
    waitLock(timeoutMs) {
      this.waitLockCalls.push(timeoutMs);
    },
    releaseLock() {
      this.released = true;
    }
  };
  const richTextValues = [];
  const sandbox = {
    console,
    SpreadsheetApp: {
      openById() {
        return {
          getSheetByName(name) {
            return name === 'index' && !missingSheet ? sheet : null;
          }
        };
      },
      newRichTextValue() {
        const builder = {
          text: '',
          url: '',
          setText(text) {
            this.text = text;
            return this;
          },
          setLinkUrl(url) {
            this.url = url;
            return this;
          },
          build() {
            const value = { text: this.text, url: this.url };
            richTextValues.push(value);
            return value;
          }
        };
        return builder;
      }
    },
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(key) {
            if (key === 'GAOSYS_SPREADSHEET_ID') {
              return 'configured-spreadsheet-id';
            }
            return properties[key] || '';
          },
          setProperty(key, value) {
            properties[key] = value;
          }
        };
      }
    },
    LockService: {
      getScriptLock() {
        return lock;
      }
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(domainSource, sandbox, { filename: 'domain.js' });
  vm.runInContext(codeSource, sandbox, { filename: 'code.js' });

  return { sandbox, sheet, properties, lock, richTextValues };
}

const submission = {
  submissionId: 'sub-001',
  tadasukeName: 'たろう'
};
const evaluationSheet = {
  fileName: '★【たろう】評価項目チェックシート',
  url: 'https://docs.example.invalid/evaluation'
};

test('IDX-002: index row is written to B-F with a rich text link in F', () => {
  const { sandbox, sheet, properties, lock } = loadSandbox({
    existingNames: ['existing']
  });

  const result = sandbox.registerIndexRow_(submission, evaluationSheet);

  assert.deepEqual(
    JSON.parse(JSON.stringify(result)),
    { status: 'success', row: 3, reused: false }
  );
  assert.deepEqual(JSON.parse(JSON.stringify(sheet.writes)), [
    {
      row: 3,
      column: 2,
      numRows: 1,
      numColumns: 5,
      values: [[
        'たろう',
        '',
        '',
        '',
        '★【たろう】評価項目チェックシート'
      ]]
    }
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(sheet.richTextWrites)), [
    {
      row: 3,
      column: 6,
      value: {
        text: '★【たろう】評価項目チェックシート',
        url: 'https://docs.example.invalid/evaluation'
      }
    }
  ]);
  assert.equal(properties['INDEX_ROW_sub-001'], '3');
  assert.deepEqual(lock.waitLockCalls, [30000]);
  assert.equal(lock.released, true);
});

test('IDX-003: existing INDEX_ROW property is reused without writing', () => {
  const { sandbox, sheet, properties, lock } = loadSandbox({
    existingIndexRow: 12
  });

  const result = sandbox.registerIndexRow_(submission, evaluationSheet);

  assert.deepEqual(
    JSON.parse(JSON.stringify(result)),
    { status: 'success', row: 12, reused: true }
  );
  assert.equal(sheet.writes.length, 0);
  assert.equal(sheet.richTextWrites.length, 0);
  assert.equal(properties['INDEX_ROW_sub-001'], '12');
  assert.deepEqual(lock.waitLockCalls, [30000]);
  assert.equal(lock.released, true);
});

test('IDX-004: missing evaluation URL fails without writing', () => {
  const { sandbox, sheet, properties } = loadSandbox();

  const result = sandbox.registerIndexRow_(submission, {
    fileName: '★【たろう】評価項目チェックシート',
    url: ''
  });

  assert.deepEqual(
    JSON.parse(JSON.stringify(result)),
    { status: 'failed', errorCode: 'INDEX_WRITE_FAILED', reused: false }
  );
  assert.equal(sheet.writes.length, 0);
  assert.equal(properties['INDEX_ROW_sub-001'], undefined);
});

test('IDX-005: missing index sheet fails safely and releases the lock', () => {
  const { sandbox, lock } = loadSandbox({ missingSheet: true });

  const result = sandbox.registerIndexRow_(submission, evaluationSheet);

  assert.deepEqual(
    JSON.parse(JSON.stringify(result)),
    { status: 'failed', errorCode: 'INDEX_WRITE_FAILED', reused: false }
  );
  assert.equal(lock.released, true);
});

test('IDX-006: first empty B row is selected under the lock', () => {
  const { sandbox, sheet } = loadSandbox({
    existingNames: ['existing', '', 'later']
  });

  const result = sandbox.registerIndexRow_(submission, evaluationSheet);

  assert.deepEqual(
    JSON.parse(JSON.stringify(result)),
    { status: 'success', row: 3, reused: false }
  );
  assert.equal(sheet.writes[0].row, 3);
});
