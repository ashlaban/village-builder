// Each custom's readers (VB-231; target-v2 4.4): for every key of the catalogue (sim/customs DIMS), the modules under src/sim that read
// the option in force, and how: `door` (inForce, inForceAt or customOf with the key, or IDX.key), or `practice` (a field of the object
// that sim/records practice() and farmPractice() return, read from a variable assigned from one, from a call's result, or from the
// conventional `cu`/`cust`). Found by reading the sources, not by running them: a reader that passes the key in a variable is missed,
// and the listing says which keys have no reader found.
// node tools/customs.js [--json]
require('./help.js')(__filename);
const fs = require('fs'), path = require('path');
const { readSource } = require('./lib/source.js');
const ROOT = path.join(__dirname, '..');
const VB = require('../src/load.js'), { DIMS } = VB['sim/customs'];
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/manifest.json'), 'utf8'));
const files = manifest.filter((f) => f.startsWith('sim/') && f !== 'sim/customs.js');
const keys = DIMS.map((d) => d.key), esc = (k) => k.replace(/[$]/g, '\\$&');

function readers() {
  const out = Object.fromEntries(keys.map((k) => [k, {}]));
  const add = (key, mod, how) => {
    const by = (out[key][mod] = out[key][mod] || new Set());
    by.add(how);
  };
  for (const f of files) {
    const mod = f.replace(/\.js$/, ''), src = readSource('src/' + f);
    const vars = new Set(['cu', 'cust']);
    for (const m of src.matchAll(/\b(\w+)\s*=\s*(?:\w+\s*\|\|\s*)?(?:farmPractice|practice)\(/g)) vars.add(m[1]);
    for (const key of keys) {
      const k = esc(key);
      if (new RegExp(`\\b(?:inForce|customOf)\\(\\s*\\w+\\s*,\\s*'${k}'`).test(src) || new RegExp(`\\bIDX\\.${k}\\b|\\bIDX\\['${k}'\\]`).test(src))
        add(key, mod, 'door');
      const viaVar = [...vars].some((v) => new RegExp(`\\b${v}\\.${k}\\b`).test(src));
      const viaCall = new RegExp(`\\b(?:farmPractice|practice)\\([^()]*(?:\\([^()]*\\)[^()]*)*\\)\\.${k}\\b`).test(src);
      if (viaVar || viaCall) add(key, mod, 'practice');
    }
  }
  return Object.fromEntries(Object.entries(out).map(([k, by]) => [k, Object.fromEntries(Object.entries(by).map(([m, s]) => [m, [...s].sort()]))]));
}

const r = readers();
if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 1));
else {
  for (const d of DIMS) {
    const by = Object.entries(r[d.key]);
    const list = by.map(([m, how]) => `${m}${how.includes('door') ? '' : ' (practice)'}`).join(', ');
    console.log(`${d.key.padEnd(14)} ${d.label}: ${list || 'no reader found'}`);
  }
}
