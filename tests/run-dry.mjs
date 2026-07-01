import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDir, '..');
const sandbox = {};

vm.createContext(sandbox);
for (const fileName of ['domain.js', 'dry_run.js']) {
  const source = fs.readFileSync(
    path.join(repositoryRoot, fileName),
    'utf8'
  );
  vm.runInContext(source, sandbox, { filename: fileName });
}

const result = sandbox.runDryTestSuite({
  suite: 'all',
  now: new Date().toISOString()
});
const output = `${JSON.stringify(result, null, 2)}\n`;
const outputArgumentIndex = process.argv.indexOf('--output');

if (outputArgumentIndex !== -1 && process.argv[outputArgumentIndex + 1]) {
  const outputPath = path.resolve(
    repositoryRoot,
    process.argv[outputArgumentIndex + 1]
  );
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, output, 'utf8');
}

process.stdout.write(output);
process.exitCode = result.failed > 0 ? 1 : 0;

