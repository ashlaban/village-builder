// Commands (VB-167): a work command is carried out as start was; a refused command changes nothing; outside sim/commands and sim/agents
// nothing in src/sim calls start (or the other acts the command verbs wrap).
const assert = require('assert');
const fs = require('fs'), path = require('path'), { tokenize } = require('../tools/wrap.js');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, { issue } = VB['sim/commands'], { isOpen } = VB['sim/kinds'];
const { canon } = require('./lib/canon.js');

// static: the acts a verb wraps are called only from sim/commands (and inside sim/agents, where they are defined)
const WRAPPED = ['start', 'walkTo', 'goHome'], ALLOWED = new Set(['src/sim/commands.js', 'src/sim/agents.js']), calls = [];
for (const f of fs.readdirSync(path.join(__dirname, '../src/sim')).map((x) => 'src/sim/' + x).concat(['src/sim.js'])) {
  if (ALLOWED.has(f)) continue;
  const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), toks = tokenize(src).filter((t) => t.t !== 'com');
  toks.forEach((t, i) => {
    const prev = toks[i - 1];
    if (t.t === 'word' && WRAPPED.includes(t.v) && toks[i + 1] && toks[i + 1].v === '(' && !(prev && (prev.v === '.' || prev.v === 'function'))) {
      calls.push(`${f}:${src.slice(0, t.s).split('\n').length} ${t.v}`);
    }
  });
}
assert.deepStrictEqual(calls, [], `acts called outside sim/commands: ${calls.join(', ')}`);

const it = G.generate(7); let r; while (!(r = it.next()).done);
const st = Sim.seed(r.value, 7, 'founders');
Sim.advance(st, 3 * Sim.DAY + 4); // a working morning: jobs posted
const snap = () => { const { w, ...rest } = st; return canon(rest); };
const j = [...st.jobs.values()].find((x) => isOpen(x) && x.claims.length === 0);
const a = st.agents.find((x) => st.pawns[x.id].died === null && x.job !== j);
assert.ok(j && a, 'an open job and a living pawn');
const had = a.job;
assert.strictEqual(issue(st, { actor: a.id, verb: 'work', target: j.key, source: 'planner' }), true);
assert.strictEqual(a.job, j); assert.ok(j.claims.includes(a.id)); assert.strictEqual(a.phase, 'go');
if (had) assert.ok(!had.claims.includes(a.id), 'the job in hand is left');

// refusals change nothing: a dead actor, an unknown job, an unknown verb, a job with no room
if (!st.pawns.some((p) => p.died !== null)) Sim.killPawn(st, st.pawns.find((p) => p.died === null && p.id !== a.id).id, 'illness');
const before = snap(), dead = st.pawns.find((p) => p.died !== null);
const refusals = [
  [{ actor: 9999, verb: 'work', target: j.key }, /not a living pawn/],
  [{ actor: a.id, verb: 'work', target: 'no-such-job' }, /there is no job/],
  [{ actor: a.id, verb: 'fly', target: j.key }, /there is no verb/],
];
refusals.push([{ actor: dead.id, verb: 'work', target: j.key }, /not a living pawn/]);
const full = [...st.jobs.values()].find((x) => !isOpen(x));
assert.ok(full, 'a job with no room');
refusals.push([{ actor: a.id, verb: 'work', target: full.key }, /has no room/]);
for (const [cmd, why] of refusals) { const res = issue(st, { source: 'test', ...cmd }); assert.ok(typeof res === 'string' && why.test(res), `${JSON.stringify(cmd)}: ${res}`); }
assert.strictEqual(snap(), before, 'a refused command changes nothing');
// walkTo, goHome, idle (VB-168)
const b = st.agents.find((x) => st.pawns[x.id].died === null && x.id !== a.id), home = st.farmsteads[st.households[st.pawns[b.id].household].farmstead].house;
const there = st.farmsteads.find((f) => f.house !== home).house;
assert.strictEqual(issue(st, { actor: b.id, verb: 'walkTo', target: there, args: { x: st.w.hx[there], y: st.w.hy[there] + 3 }, source: 'test' }), true);
assert.ok(b.path && b.path.length >= 2 && b.anim === 'walk', 'walking');
assert.deepStrictEqual(b.path[b.path.length - 1].slice(0, 2), [st.w.hx[there], st.w.hy[there] + 3], 'to the spot asked');
assert.strictEqual(issue(st, { actor: b.id, verb: 'goHome', source: 'test' }), true);
assert.strictEqual(b.phase, 'home'); assert.strictEqual(b.path[b.path.length - 1][3], home, 'the walk ends on the home tile');
assert.strictEqual(issue(st, { actor: b.id, verb: 'idle', args: { until: st.t + 2 }, source: 'test' }), true);
assert.strictEqual(b.idleUntil, st.t + 2);
const before2 = snap();
for (const [cmd, why] of [
  [{ actor: b.id, verb: 'walkTo', target: -1 }, /there is no tile/], [{ actor: b.id, verb: 'walkTo', target: st.w.N }, /there is no tile/],
  [{ actor: dead.id, verb: 'goHome' }, /not a living pawn/], [{ actor: b.id, verb: 'idle', args: { until: st.t - 1 } }, /past/],
  [{ actor: b.id, verb: 'idle' }, /past/],
]) { const res = issue(st, { source: 'test', ...cmd }); assert.ok(typeof res === 'string' && why.test(res), `${JSON.stringify(cmd)}: ${res}`); }
assert.strictEqual(snap(), before2, 'refused walk, home and idle commands change nothing');
console.log(`commands ok: work, walkTo, goHome and idle carried out; ${refusals.length + 5} refusals change nothing; start, walkTo and goHome are called only from sim/commands`);
