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
// the meeting's decide and the debug verbs (VB-170), on the heirs scenario, which has farms with heirs
const hw = (() => { const it2 = G.generate(7); let q; while (!(q = it2.next()).done); return q.value; })();
const st2 = Sim.seed(hw, 7, 'heirs'); Sim.advance(st2, 2 * Sim.DAY);
const snap2 = () => { const { w, ...rest } = st2; return canon(rest); };
const C = VB.culture, s0 = st2.cenv.settlements[0], d0 = C.IDX.voice, now = s0.practice[d0], other = (now + 1) % C.NOPT[d0];
assert.strictEqual(issue(st2, { actor: { settlement: 0 }, verb: 'decide', args: { dim: d0, option: other }, source: 'meeting' }), true);
assert.strictEqual(s0.practice[d0], other);
const holder = st2.households.find((h) => !h.dissolved && h.holder !== null && VB['sim/heirs'].heirRanking(st2, h).length);
const hp = holder.holder;
assert.strictEqual(issue(st2, { actor: hp, verb: 'retire', source: 'debug' }), true);
assert.notStrictEqual(holder.holder, hp, 'the farm is handed on');
const arguer = st2.pawns.find((p) => p.died === null && p.age >= 18);
assert.strictEqual(issue(st2, { actor: arguer.id, verb: 'argue', args: { dim: d0, option: now }, source: 'debug' }), true);
assert.deepStrictEqual([arguer.advocate.dim, arguer.advocate.opt], [d0, now]);
assert.strictEqual(issue(st2, { actor: { settlement: 0 }, verb: 'rally', args: { dim: d0, option: other }, source: 'debug' }), true);
const voiced = Sim.membersOf(st2, 0).filter((q) => Sim.voiceOf(st2, q, s0) > 0);
assert.strictEqual(voiced.filter((q) => q.advocate && q.advocate.opt === other).length, Math.max(1, Math.ceil(voiced.length * 0.2)), 'a fifth rallied');
const t0 = st2.t; assert.strictEqual(issue(st2, { actor: null, verb: 'skip', args: { hours: 5 }, source: 'debug' }), true);
assert.ok(Math.abs(st2.t - (t0 + 5)) < 1e-6, 'skipped 5 hours');
const landless = st2.pawns.find((p) => p.died === null && !Sim.isHolder(st2, p.id));
const killed = st2.pawns.find((p) => p.died === null && p.id !== arguer.id);
assert.strictEqual(issue(st2, { actor: killed.id, verb: 'kill', source: 'debug' }), true); assert.ok(killed.died !== null);
const before3 = snap2();
for (const [cmd, why] of [
  [{ actor: { settlement: 0 }, verb: 'decide', args: { dim: d0, option: s0.practice[d0] } }, /already/],
  [{ actor: { settlement: 99 }, verb: 'decide', args: { dim: d0, option: 0 } }, /no settlement/],
  [{ actor: { settlement: 0 }, verb: 'decide', args: { dim: 999, option: 0 } }, /no custom/],
  [{ actor: arguer.id, verb: 'argue', args: { dim: d0, option: 99 } }, /has no option/],
  [{ actor: killed.id, verb: 'kill' }, /not a living pawn/], [{ actor: killed.id, verb: 'argue', args: { dim: d0, option: 0 } }, /not a living pawn/],
  [{ actor: landless.id, verb: 'retire' }, /holds no farm/], [{ actor: null, verb: 'skip', args: { hours: -1 } }, /cannot skip/],
]) { const res = issue(st2, { source: 'test', ...cmd }); assert.ok(typeof res === 'string' && why.test(res), `${JSON.stringify(cmd)}: ${res}`); }
assert.strictEqual(snap2(), before3, 'refused meeting and debug commands change nothing');
console.log(`commands ok: work, walkTo, goHome and idle carried out, and decide, retire, argue, rally, skip and kill; ${refusals.length + 13} refusals change nothing; start, walkTo and goHome are called only from sim/commands`);
