import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDir, '..');

export function parseTrackedFiles(statusOutput) {
  const trackedFiles = [];
  let section = '';

  for (const line of statusOutput.split(/\r?\n/)) {
    if (line === 'Tracked files:') {
      section = 'tracked';
      continue;
    }
    if (line === 'Untracked files:') {
      section = 'untracked';
      continue;
    }
    if (section !== 'tracked') continue;

    const match = /^└─ (.+)$/.exec(line);
    if (match) trackedFiles.push(match[1]);
  }

  return trackedFiles.sort();
}

export function validateDeployment({
  policy,
  trackedFiles,
  rootDir = repositoryRoot,
  claspIgnore = fs.readFileSync(path.join(rootDir, '.claspignore'), 'utf8')
}) {
  const errors = [];
  const expectedTracked = [...policy.trackedFiles].sort();
  const actualTracked = [...trackedFiles].sort();

  const missingTracked = expectedTracked.filter(
    (fileName) => !actualTracked.includes(fileName)
  );
  const unexpectedTracked = actualTracked.filter(
    (fileName) => !expectedTracked.includes(fileName)
  );

  if (missingTracked.length > 0) {
    errors.push({
      code: 'TRACKED_FILES_MISSING',
      files: missingTracked
    });
  }
  if (unexpectedTracked.length > 0) {
    errors.push({
      code: 'UNEXPECTED_TRACKED_FILES',
      files: unexpectedTracked
    });
  }

  for (const fileName of policy.protectedFiles) {
    const filePath = path.join(rootDir, fileName);
    if (!fs.existsSync(filePath)) {
      errors.push({ code: 'PROTECTED_FILE_MISSING', file: fileName });
    }
  }

  const ignoreLines = claspIgnore
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const missingIgnorePatterns = policy.requiredIgnorePatterns.filter(
    (pattern) => !ignoreLines.includes(pattern)
  );
  if (missingIgnorePatterns.length > 0) {
    errors.push({
      code: 'IGNORE_PATTERNS_MISSING',
      patterns: missingIgnorePatterns
    });
  }

  return {
    ok: errors.length === 0,
    trackedFiles: actualTracked,
    activeFiles: [...policy.activeFiles].sort(),
    protectedFiles: [...policy.protectedFiles].sort(),
    errors
  };
}

function readStatusOutput(statusFile) {
  if (statusFile) {
    return fs.readFileSync(path.resolve(statusFile), 'utf8');
  }

  const result = spawnSync(
    'clasp',
    ['status', '--user', 'default'],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      shell: process.platform === 'win32'
    }
  );
  if (result.status !== 0) {
    const output = [result.stderr, result.stdout, result.error?.message]
      .filter(Boolean)
      .join('\n')
      .trim();
    throw new Error(
      `clasp status failed: ${output || 'unknown error'}`
    );
  }
  return result.stdout;
}

function main() {
  const statusFileIndex = process.argv.indexOf('--status-file');
  const statusFile = statusFileIndex >= 0
    ? process.argv[statusFileIndex + 1]
    : '';
  const policy = JSON.parse(
    fs.readFileSync(
      path.join(repositoryRoot, 'ops/deployment-policy.json'),
      'utf8'
    )
  );
  const result = validateDeployment({
    policy,
    trackedFiles: parseTrackedFiles(readStatusOutput(statusFile))
  });

  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main();
}
