import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  parseTrackedFiles,
  validateDeployment
} from '../scripts/check-deployment.mjs';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDir, '..');
const policy = JSON.parse(
  fs.readFileSync(
    path.join(repositoryRoot, 'ops/deployment-policy.json'),
    'utf8'
  )
);

function statusFor(files) {
  return [
    'Tracked files:',
    ...files.map((fileName) => `└─ ${fileName}`),
    'Untracked files:',
    '└─ tests/'
  ].join('\n');
}

test('DEP-001: approved tracked files pass deployment preflight', () => {
  const trackedFiles = parseTrackedFiles(statusFor(policy.trackedFiles));
  const result = validateDeployment({ policy, trackedFiles });

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('DEP-002: an unexpected deployable file blocks deployment', () => {
  const trackedFiles = parseTrackedFiles(
    statusFor([...policy.trackedFiles, 'unexpected.js'])
  );
  const result = validateDeployment({ policy, trackedFiles });

  assert.equal(result.ok, false);
  assert.equal(
    result.errors.some(
      (error) => error.code === 'UNEXPECTED_TRACKED_FILES'
    ),
    true
  );
});

test('DEP-003: a missing protected file blocks deployment', () => {
  const changedPolicy = JSON.parse(JSON.stringify(policy));
  changedPolicy.protectedFiles.push('missing-protected-file.html');
  const result = validateDeployment({
    policy: changedPolicy,
    trackedFiles: policy.trackedFiles
  });

  assert.equal(result.ok, false);
  assert.equal(
    result.errors.some(
      (error) =>
        error.code === 'PROTECTED_FILE_MISSING' &&
        error.file === 'missing-protected-file.html'
    ),
    true
  );
});

test('DEP-004: missing local-only ignore rules block deployment', () => {
  const result = validateDeployment({
    policy,
    trackedFiles: policy.trackedFiles,
    claspIgnore: 'tests/**\n'
  });

  assert.equal(result.ok, false);
  assert.equal(
    result.errors.some(
      (error) => error.code === 'IGNORE_PATTERNS_MISSING'
    ),
    true
  );
});
