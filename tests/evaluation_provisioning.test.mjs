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

function createFile(id, url = `https://docs.example.invalid/${id}`) {
  return {
    id,
    editors: [],
    getId() {
      return id;
    },
    getUrl() {
      return url;
    },
    addEditor(email) {
      this.editors.push(email);
    }
  };
}

function loadSandbox({ existingFile = null, failCopy = false, failPermission = false } = {}) {
  const properties = {};
  const copies = [];
  const files = {
    template: {
      makeCopy(fileName, folder) {
        if (failCopy) throw new Error('copy failed');
        const copiedFile = createFile(`file-${copies.length + 1}`);
        if (failPermission) {
          copiedFile.addEditor = () => {
            throw new Error('permission failed');
          };
        }
        copies.push({ fileName, folderId: folder.id, file: copiedFile });
        return copiedFile;
      }
    }
  };
  if (existingFile) files[existingFile.getId()] = existingFile;

  const sandbox = {
    console,
    DriveApp: {
      getFolderById(id) {
        return { id };
      },
      getFileById(id) {
        if (!files[id]) throw new Error('file not found');
        return files[id];
      }
    },
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(key) {
            return properties[key] || '';
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

  return { sandbox, properties, copies };
}

const configuration = {
  evaluationTemplateId: 'template',
  evaluationFolderId: 'folder'
};
const submission = {
  submissionId: 'sub-001',
  name: '山田 太郎',
  tadasukeName: ' たろう\n講師 ',
  email: 'member@example.invalid'
};

test('EVAL-004: evaluation sheet is copied, named, shared, and tracked', () => {
  const { sandbox, properties, copies } = loadSandbox();
  const result = sandbox.provisionEvaluationSheet_(submission, configuration);

  assert.equal(result.status, 'success');
  assert.equal(result.reused, false);
  assert.equal(result.fileId, 'file-1');
  assert.equal(result.fileName, '★【たろう 講師】評価項目チェックシート');
  assert.equal(result.url, 'https://docs.example.invalid/file-1');
  assert.equal(properties['EVALUATION_FILE_sub-001'], 'file-1');
  assert.equal(copies.length, 1);
  assert.equal(copies[0].file.editors.includes('member@example.invalid'), true);
});

test('EVAL-007: existing file for the same submissionId is reused', () => {
  const existingFile = createFile('existing-file');
  const { sandbox, properties, copies } = loadSandbox({ existingFile });
  properties['EVALUATION_FILE_sub-001'] = 'existing-file';

  const result = sandbox.provisionEvaluationSheet_(submission, configuration);

  assert.equal(result.status, 'success');
  assert.equal(result.reused, true);
  assert.equal(result.fileId, 'existing-file');
  assert.equal(copies.length, 0);
});

test('EVAL-008: inaccessible existing file fails without recreating', () => {
  const { sandbox, properties, copies } = loadSandbox();
  properties['EVALUATION_FILE_sub-001'] = 'missing-file';

  const result = sandbox.provisionEvaluationSheet_(submission, configuration);

  assert.deepEqual(
    JSON.parse(JSON.stringify(result)),
    {
      status: 'failed',
      errorCode: 'EVALUATION_COPY_FAILED',
      reused: false
    }
  );
  assert.equal(copies.length, 0);
});

test('EVAL-005: copy failure does not store an idempotency property', () => {
  const { sandbox, properties } = loadSandbox({ failCopy: true });
  const result = sandbox.provisionEvaluationSheet_(submission, configuration);

  assert.equal(result.status, 'failed');
  assert.equal(result.errorCode, 'EVALUATION_COPY_FAILED');
  assert.equal(properties['EVALUATION_FILE_sub-001'], undefined);
});

test('EVAL-006: permission failure is reported and does not mark success', () => {
  const { sandbox, properties } = loadSandbox({ failPermission: true });
  const result = sandbox.provisionEvaluationSheet_(submission, configuration);

  assert.equal(result.status, 'failed');
  assert.equal(result.errorCode, 'EVALUATION_PERMISSION_FAILED');
  assert.equal(properties['EVALUATION_FILE_sub-001'], undefined);
});
