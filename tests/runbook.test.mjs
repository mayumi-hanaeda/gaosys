import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDir, '..');
const runbookPath = path.join(repositoryRoot, 'RUNBOOK.md');

function readRunbook() {
  return fs.readFileSync(runbookPath, 'utf8');
}

test('RUN-001: runbook covers every required partial-failure scenario', () => {
  const runbook = readRunbook();
  for (const requiredText of [
    'Calendarだけ作成された',
    '評価シート発行失敗',
    'index登録失敗',
    'Chat通知失敗',
    'メール送信失敗',
    '再実行前の重複確認'
  ]) {
    assert.equal(
      runbook.includes(requiredText),
      true,
      `missing runbook section: ${requiredText}`
    );
  }
});

test('RUN-002: runbook distinguishes current and target recovery behavior', () => {
  const runbook = readRunbook();

  assert.equal(runbook.includes('現行本番の制約'), true);
  assert.equal(runbook.includes('submissionId'), true);
  assert.equal(runbook.includes('IMP-006'), true);
});

test('RUN-003: runbook requires verification before destructive recovery', () => {
  const runbook = readRunbook();

  assert.equal(runbook.includes('削除前'), true);
  assert.equal(runbook.includes('バックアップ'), true);
  assert.equal(runbook.includes('同じsubmissionId'), true);
  assert.equal(runbook.includes('新しいsubmissionIdを発行しない'), true);
});
