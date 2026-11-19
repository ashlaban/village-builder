// Do the two engine workarounds of src/ still pay (VB-246)? Each is timed as it is against its plain form, which lives here, not in src/:
//   sift        (sim/relations, VB-205): a record's memories are copied, against deleting the faded keys;
//   driftPerson (culture, VB-195): a function of its own, against its body written in the loop of dailyStep.
// `node tests/perf.js --engine` runs it. Each case is three runs of each form, one process each (a form is the source of a module, so
// two cannot share a process), interleaved. A workaround fails only if it is slower than its plain form by more than the runs' spread.
const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const FILE = __filename;
// [file, [[what to find, what plain has in its place]]]; a miss throws, so a changed workaround is noticed here.
const PLAIN = {
  sift: ['sim/relations.js', [[
    /function sift\(r, keep\) \{[\s\S]*?\n {2}\}\n/,
    'function sift(r, keep) {\n    let n = 0;\n    for (const k of Object.keys(r.mem)) if (keep(k)) n++; else delete r.mem[k];\n    return n > 0;\n  }\n',
  ]]],
  drift: ['culture.js', [[
    'driftPerson(hooks.byId(id), hooks, dt, rand, mul, means, tgt, press, sq);',
    (src) => {
      const m = /function driftPerson\(p, hooks[^)]*\) \{\n([\s\S]*?)\n {2}\}\n/.exec(src);
      if (!m || (m[1].match(/\breturn\b/g) || []).length !== 1) throw new Error('engine: driftPerson changed shape; the inline form needs a look');
      return `{ const p = hooks.byId(id); inline: {\n${m[1].replace('return;', 'break inline;')}\n} }`;
    },
  ]]],
};
function plainSource(name, file, src) {
  const [target, edits] = PLAIN[name];
  if (!file.endsWith(path.join('src', target))) return src;
  for (const [from, to] of edits) {
    const re = from instanceof RegExp;
    if (!(re ? from.test(src) : src.includes(from))) throw new Error(`engine: ${target} no longer holds the workaround of ${name}; update PLAIN`);
    const by = typeof to === 'function' ? to(src) : to;
    src = re ? src.replace(from, () => by) : src.replace(from, () => by);
  }
  return src;
}
function child([name, form, saveFile]) {
  if (form === 'plain') {
    const Module = require('module'), compile = Module.prototype._compile;
    Module.prototype._compile = function (content, filename) { return compile.call(this, plainSource(name, filename, content), filename); };
  }
  const VB = require('../../src/load.js'), Sim = VB.sim, C = VB.culture;
  const data = JSON.parse(fs.readFileSync(saveFile, 'utf8'));
  const it = VB.gen.generate(data.seed, { cols: data.cols, rows: data.rows });
  let r; while (!(r = it.next()).done);
  const st = Sim.load(r.value, data);
  const now = () => Number(process.hrtime.bigint()) / 1e6; // lint-allow: clock a test times itself
  const t0 = now();
  if (name === 'drift') {
    const hooks = Sim.hooks(st), rand = VB['sim/rng'].drawer(st.rng.culture);
    for (let d = 0; d < 48; d++) C.dailyStep(st.cenv, hooks, 1 / Sim.YEAR_DAYS, rand);
  } else Sim.advance(st, Sim.YEAR);
  console.log(JSON.stringify({ ms: now() - t0, living: st.pawns.filter((p) => p.alive).length }));
}
// The state to time on: small-y40 if the fixture is there, else a populous small run of 5 years.
function save(dir) {
  const VB = require('../../src/load.js'), F = require('./fixtures.js');
  let st, from;
  if (F.status('small-y40').status === 'made') { st = F.loadFixture('small-y40', { make: false }).st; from = 'small-y40'; }
  else {
    const it = VB.gen.generate(7, { cols: 180, rows: 130 }); let r; while (!(r = it.next()).done);
    st = VB.sim.seed(r.value, 7, 'populous'); VB.sim.advance(st, 5 * VB.sim.YEAR); from = 'populous small, seed 7, 5 years';
  }
  const file = path.join(dir, 'save.json');
  fs.writeFileSync(file, JSON.stringify(VB.sim.save(st)));
  return { file, from };
}
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const spread = (a) => Math.max(...a) - Math.min(...a);
const CASES = [
  ['sift', 'a year, fadeRelations copying memories vs deleting faded keys', 'fadeRelations'],
  ['drift', 'Culture.dailyStep over 48 days, driftPerson apart vs in the loop', 'driftPerson'],
];
function main({ runs = 3 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-engine-'));
  const failed = [];
  try {
    const { file, from } = save(dir);
    console.log(`engine workarounds on ${from}, Node ${process.version}, ${runs} runs of each form`);
    for (const [name, what, who] of CASES) {
      const t = { as: [], plain: [] };
      for (let i = 0; i < runs; i++)
        for (const form of ['as', 'plain']) {
          const o = spawnSync(process.execPath, [FILE, 'child', name, form, file], { encoding: 'utf8', maxBuffer: 1 << 26 });
          if (o.status !== 0) throw new Error(`engine ${name} ${form}: ${o.stderr || o.stdout}`);
          t[form].push(JSON.parse(o.stdout.trim().split('\n').pop()).ms);
        }
      const a = med(t.as), p = med(t.plain), sp = Math.max(spread(t.as), spread(t.plain)), ratio = a / p;
      const ms = (x) => x.map((v) => v.toFixed(0)).join('/');
      let verdict = 'pays';
      if (a - p > sp) { verdict = `SLOWER than plain by more than the spread: the workaround of ${who} can go`; failed.push(who); }
      else if (p - a <= sp) verdict = 'no longer helps (within the spread); it could go';
      console.log(`${name}: ${what}: as is ${ms(t.as)} ms, plain ${ms(t.plain)} ms; ratio as is / plain ${ratio.toFixed(3)}, spread ${sp.toFixed(0)} ms: ${verdict}`);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  if (failed.length) { console.error(`engine: slower than its plain form: ${failed.join(', ')}; the workaround can go`); process.exitCode = 1; }
}
if (require.main === module) { if (process.argv[2] === 'child') child(process.argv.slice(3)); else main(); }
module.exports = { main, plainSource };
