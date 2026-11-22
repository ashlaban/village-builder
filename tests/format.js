// The sources under src/ are formatted by Prettier (.prettierrc.json; VB-380): a file that `npm run format` would change fails.
const { spawnSync } = require('child_process'), path = require('path');
const root = path.join(__dirname, '..'), bin = path.join(root, 'node_modules', 'prettier', 'bin', 'prettier.cjs');
// Prettier's cache (node_modules/.cache/prettier), keyed by each file's content and the options, checks again only what changed: 6 s
// of CPU cold, under half a second warm (VB-862).
const args = [bin, '--check', 'src/**/*.js', '--log-level', 'warn', '--cache', '--cache-strategy', 'content'];
const r = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
if (r.status !== 0) {
  console.error('FORMAT FAIL: run `npm run format`\n' + (r.stdout + r.stderr).trim());
  process.exit(1);
}
console.log('format ok');
