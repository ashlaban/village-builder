// usage: node docs/mocks/roads/village.js [--seed 3] [--years 3] [--scale 2]
//   The countryside before and after: one village grown for some years by the simulation (tools/village-shot.js), its lanes drawn
//   three ways: as the game draws them today, A (a derived network) and B (hex pieces, at most three ways a hex). Writes
//   img/village-{now,A,B}.jpg. The same seed and years give the same lanes each time.
const { spawnSync } = require('child_process'), fs = require('fs'), path = require('path'), os = require('os');
const root = path.join(__dirname, '..', '..', '..');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const seed = opt('seed', '3'), years = opt('years', '3'), scale = opt('scale', '2'), out = path.join(__dirname, 'img');
fs.mkdirSync(out, { recursive: true });
const { patch } = require('./hook.js');
const base = require(root + '/tests/lib/page').builtPage();
for (const mode of [null, 'A', 'B']) {
  const tag = 'village-' + (mode || 'now'), file = path.join(os.tmpdir(), `vb-roads-${process.pid}-${tag}.html`);
  fs.writeFileSync(file, patch(base, mode));
  const r = spawnSync('node', [root + '/tools/village-shot.js', '--seed', seed, '--farms', '10', '--cols', '60', '--rows', '42', '--years', years,
    '--scale', scale, '--out', out, '--tag', tag, '--html', file, ...(opt('zoom', null) ? ['--zoom', opt('zoom')] : [])], { stdio: 'inherit' });
  fs.unlinkSync(file);
  if (r.status) process.exit(r.status);
}
