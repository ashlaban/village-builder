// The sources under src/ are formatted by Prettier (.prettierrc.json; VB-380): a file that `npm run format` would change fails.
const { spawnSync } = require('child_process'), path = require('path');
const root = path.join(__dirname, '..'), bin = path.join(root, 'node_modules', 'prettier', 'bin', 'prettier.cjs');
const r = spawnSync(process.execPath, [bin, '--check', 'src/**/*.js', '--log-level', 'warn'], { cwd: root, encoding: 'utf8' });
if (r.status !== 0) {
  console.error('FORMAT FAIL: run `npm run format`, then rebuild index.html\n' + (r.stdout + r.stderr).trim());
  process.exit(1);
}
console.log('format ok');
