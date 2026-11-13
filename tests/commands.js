// Commands (VB-167): a work command is carried out as start was; a refused command changes nothing; outside sim/commands and sim/agents
// nothing in src/sim calls start (or the other acts the command verbs wrap).
const assert = require('assert');
const fs = require('fs'), path = require('path'), { tokenize } = require('../tools/wrap.js');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, { issue } = VB['sim/commands'], { isOpen } = VB['sim/kinds'];
const { canon } = require('./lib/canon.js');

// static: the acts a verb wraps are called only from sim/commands, or inside the module that defines them (an act built of others there)
const WRAPPED = ['start', 'walkTo', 'goHome', 'idle', 'haltForTalk', 'wed', 'enterService', 'startClaim', 'settleFarm', 'found', 'finishCottage', 'settleGift', 'setRoutines', 'endTrust', 'holdInTrust'], calls = [];
const files = fs.readdirSync(path.join(__dirname, '../src/sim')).map((x) => 'src/sim/' + x).concat(['src/sim.js']);
const text = Object.fromEntries(files.map((f) => [f, fs.readFileSync(path.join(__dirname, '..', f), 'utf8')]));
const definedIn = Object.fromEntries(WRAPPED.map((n) => [n, files.find((f) => new RegExp(`function ${n}\\(`).test(text[f]))]));
for (const n of WRAPPED) if (!definedIn[n]) throw new Error(`no module defines ${n}`);
for (const f of files) {
  if (f === 'src/sim/commands.js') continue;
  const src = text[f], toks = tokenize(src).filter((t) => t.t !== 'com');
  toks.forEach((t, i) => {
    const prev = toks[i - 1];
    if (t.t === 'word' && WRAPPED.includes(t.v) && definedIn[t.v] !== f && toks[i + 1] && toks[i + 1].v === '(' && !(prev && (prev.v === '.' || prev.v === 'function'))) {
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
// Talk pauses cannot interrupt work, entering home, or an indoor pawn, and cannot shorten an idle pause (VB-177).
const talking = (until) => issue(st, { actor: b.id, verb: 'haltForTalk', args: { until }, source: 'talk' });
const entering = snap();
assert.strictEqual(talking(st.t + 3), true);
assert.strictEqual(snap(), entering, 'a pawn entering home keeps its walk');
VB['sim/agents'].release(st, b);
b.inside = true;
const indoors = snap(); talking(st.t + 3);
assert.strictEqual(snap(), indoors, 'talk does not halt an indoor pawn');
b.inside = false;
b.job = j;
const working = snap(); talking(st.t + 3);
assert.strictEqual(snap(), working, 'talk does not interrupt a job');
b.job = null;
assert.strictEqual(talking(st.t + 1), true);
assert.strictEqual(b.path, null); assert.strictEqual(b.anim, 'idle');
assert.strictEqual(b.idleUntil, st.t + 2, 'talk cannot shorten an existing pause');
talking(st.t + 3); assert.strictEqual(b.idleUntil, st.t + 3);
const before2 = snap();
for (const [cmd, why] of [
  [{ actor: b.id, verb: 'walkTo', target: -1 }, /there is no tile/], [{ actor: b.id, verb: 'walkTo', target: st.w.N }, /there is no tile/],
  [{ actor: dead.id, verb: 'goHome' }, /not a living pawn/], [{ actor: b.id, verb: 'idle', args: { until: st.t - 1 } }, /past/],
  [{ actor: b.id, verb: 'idle' }, /past/],
  [{ actor: b.id, verb: 'haltForTalk' }, /past/],
  [{ actor: b.id, verb: 'haltForTalk', args: { until: st.t - 1 } }, /past/],
  [{ actor: dead.id, verb: 'haltForTalk', args: { until: st.t + 1 } }, /not a living pawn/],
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
// the moving round's verbs (VB-171), on a fresh heirs state
const st3 = Sim.seed((() => { const it3 = G.generate(7); let q; while (!(q = it3.next()).done); return q.value; })(), 7, 'heirs');
Sim.advance(st3, Sim.DAY);
const snap3 = () => { const { w, ...rest } = st3; return canon(rest); };
const single = (sex) => st3.pawns.find((p) => p.died === null && p.age >= 18 && p.sex === sex && Sim.spouseOf(st3, p.id) === null && !Sim.isHolder(st3, p.id));
const groom = single('m'), bride = single('f'), wedHome = groom.household, nUnions = st3.unions.length;
const R3 = [];
assert.strictEqual(issue(st3, { actor: groom.id, verb: 'marry', target: bride.id, args: { home: wedHome }, source: 'round' }), true);
assert.strictEqual(st3.unions.length, nUnions + 1); assert.strictEqual(bride.household, wedHome); assert.strictEqual(Sim.spouseOf(st3, groom.id), bride.id);
const hh3 = st3.households.find((h) => !h.dissolved && h.holder !== null && st3.pawns[h.holder].died === null && VB['sim/heirs'].heirRanking(st3, h).length);
const old3 = hh3.holder, heir3 = VB['sim/heirs'].heirRanking(st3, hh3)[0];
assert.strictEqual(issue(st3, { actor: old3, verb: 'handOn', target: heir3, args: { household: hh3.id, reason: 'retirement' }, source: 'round' }), true);
assert.strictEqual(hh3.holder, heir3);
const servant = st3.pawns.find((p) => p.died === null && p.age >= 15 && !Sim.isHolder(st3, p.id) && p.id !== groom.id && p.id !== bride.id);
const master = st3.households.find((h) => !h.dissolved && h.id !== servant.household);
assert.strictEqual(issue(st3, { actor: servant.id, verb: 'serve', target: master.id, source: 'round' }), true);
assert.strictEqual(servant.household, master.id); assert.strictEqual(servant.servant, true);
const empty = st3.farmsteads.find((f) => VB['sim/farmclaims'].claimable(st3, f));
if (empty) {
  const claimant = st3.pawns.find((p) => p.died === null && p.age >= 18 && p.id !== groom.id && p.id !== bride.id);
  assert.strictEqual(issue(st3, { actor: claimant.id, verb: 'claim', target: empty.id, source: 'round' }), true);
  assert.strictEqual(VB['sim/farmclaims'].claimOn(st3, empty).by, claimant.id);
  R3.push([{ actor: claimant.id, verb: 'claim', target: empty.id }, /cannot be claimed/]);
}
const before4 = snap3();
R3.push([{ actor: groom.id, verb: 'marry', target: groom.id, args: { home: wedHome } }, /oneself/],
  [{ actor: groom.id, verb: 'marry', target: single('f') ? single('f').id : bride.id, args: { home: wedHome } }, /married/],
  [{ actor: servant.id, verb: 'marry', target: single('f') ? single('f').id : bride.id, args: { home: 999 } }, /no household|married/],
  [{ actor: old3, verb: 'handOn', target: heir3, args: { household: hh3.id, reason: 'retirement' } }, /does not hold/],
  [{ actor: servant.id, verb: 'serve', target: master.id }, /lives there already/], [{ actor: servant.id, verb: 'claim', target: 9999 }, /no farm/]);
for (const [cmd, why] of R3) { const res = issue(st3, { source: 'test', ...cmd }); assert.ok(typeof res === 'string' && why.test(res), `${JSON.stringify(cmd)}: ${res}`); }
assert.strictEqual(snap3(), before4, 'refused round commands change nothing');
// leave: a settler founds a village on a site the round would choose
const S3 = VB['sim/settle'], settler = st3.pawns.find((p) => p.died === null && p.age >= 18 && !Sim.isHolder(st3, p.id) && p.household !== null);
st3.households[settler.household].grain.barley += 2000; // a family that can spare the provisions
assert.ok(S3.provisions(st3, [settler.id]), 'provisions for the settler');
const fromV = st3.villages[Sim.settlementIdOf(st3, settler)], use3 = S3.landInUse(st3), site3 = S3.newSite(st3, fromV, use3, S3.candidates(st3, fromV, use3, S3.reachOf(st3, fromV)));
if (site3) {
  const nf = st3.farmsteads.length, nv = st3.villages.length, party = { all: [settler.id], followers: [] };
  assert.strictEqual(issue(st3, { actor: settler.id, verb: 'leave', args: { from: fromV.id, party, house: site3.house, field: site3.field, wood: site3.wood }, source: 'round' }), true);
  assert.strictEqual(st3.farmsteads.length, nf + 1); assert.strictEqual(st3.villages.length, nv + 1);
  assert.strictEqual(st3.households[settler.household].farmstead, nf, 'the settler lives on the new farm');
  R3.push(['leave', 1]);
}
// Membership's owner keeps death's historical address, and ordinary moves detach before joining.
const R = VB['sim/records'], membership = {
  pawns: [{ household: 0, servant: true }], households: [{ id: 0, members: [0] }, { id: 1, members: [] }],
};
R.leaveHousehold(membership, 0, true);
assert.deepStrictEqual(membership.households[0].members, []);
assert.strictEqual(membership.pawns[0].household, 0, 'death preserves the last household');
assert.strictEqual(membership.pawns[0].servant, true, 'death preserves service');
R.leaveHousehold(membership, 0);
assert.strictEqual(membership.pawns[0].household, null);
R.joinHousehold(membership, membership.households[1], 0, false);
assert.deepStrictEqual(membership.households[1].members, [0]);
assert.deepStrictEqual(membership.pawns[0], { household: 1, servant: false });
R.setServant(membership, 0, true);
assert.strictEqual(membership.pawns[0].servant, true);
const before5 = snap3(), lead = st3.pawns.find((p) => p.died === null && p.age >= 18);
for (const [cmd, why] of [
  [{ actor: lead.id, verb: 'foundHousehold', target: 99999, args: { members: [lead.id], grain: 0 } }, /empty farm/],
  [{ actor: null, verb: 'finishCottage', target: 99999, args: { village: 0 } }, /finished cottage/],
  [{ actor: lead.id, verb: 'leave', args: { from: 999, party: { all: [lead.id] }, house: 0, field: 1 } }, /no village/],
  [{ actor: lead.id, verb: 'leave', args: { from: 0, party: { all: [dead.id] }, house: 0, field: 1 } }, /led by the actor/],
  [{ actor: lead.id, verb: 'leave', args: { from: 0, party: { all: [lead.id] }, house: -5, field: 1 } }, /must be tiles/],
]) { const res = issue(st3, { source: 'test', ...cmd }); assert.ok(typeof res === 'string' && why.test(res), `${JSON.stringify(cmd)}: ${res}`); R3.push(['leave refusal', 1]); }
assert.strictEqual(snap3(), before5, 'refused leave commands change nothing');
console.log(`commands ok: work, walkTo, goHome, idle and haltForTalk carried out, and decide, retire, argue, rally, skip and kill, and marry, handOn, serve${empty ? ', claim' : ''}${site3 ? ' and leave' : ''}; ${refusals.length + 16 + R3.length - (site3 ? 1 : 0)} refusals change nothing; the acts the verbs wrap are called only from sim/commands`);
// the player's cause (VB-211): the same advocate slot as a natural cause, so the same pull on the pawn's attitude and its ties'; dropCause ends it
{
  // each on a world of its own: a and b are live together, and a world's fish stocks (w.fish, w.fishDay) belong to one run
  const land = () => { const it4 = G.generate(7); let q; while (!(q = it4.next()).done); return q.value; };
  const make = () => { const s = Sim.seed(land(), 7, 'heirs'); Sim.advance(s, 2 * Sim.DAY); return s; };
  const a = make(), b = make(), id = a.pawns.findIndex((p) => p.died === null && p.age >= 18), dim = d0, opt = (a.cenv.settlements[0].practice[dim] + 1) % C.NOPT[dim];
  assert.strictEqual(issue(a, { actor: id, verb: 'dropCause', source: 'player' }), 'the pawn argues no cause', 'dropCause is refused with no cause');
  Sim.inhabit(a, id); assert.strictEqual(Sim.queue(a, { actor: id, verb: 'argue', args: { dim, option: opt } }), true);
  Sim.advance(a, 0.2);
  assert.deepStrictEqual([a.pawns[id].advocate.dim, a.pawns[id].advocate.opt], [dim, opt]);
  assert.ok(Math.abs(a.pawns[id].advocate.until - (a.cenv.t + C.P.causeEvery)) < 0.05, 'for five years');
  assert.ok(Sim.recordOf(a, { pawn: id, life: true }).some((e) => e.kind === 'cause' && /^Took up the cause/.test(e.text)), 'a record event');
  assert.ok(Math.abs(a.pawns[id].causeSince - a.cenv.t) < 0.05, 'the year it was taken up');
  Sim.uninhabit(a); C.advocate(b.pawns[id], dim, opt, b.cenv.t + C.P.causeEvery, b.cenv.t, true); // as a natural cause, the same slot and the same step
  b.pawns[id].advocate.until = a.pawns[id].advocate.until;
  Sim.advance(a, 5 * Sim.DAY); Sim.advance(b, 5 * Sim.DAY + 0.2);
  const o = C.OFF[dim] + opt, pa = a.pawns[id], pb = b.pawns[id];
  assert.ok(Math.abs(pa.att[o] - pb.att[o]) < 0.05, 'the player\'s cause pulls as a natural one does');
  assert.strictEqual(issue(a, { actor: id, verb: 'dropCause', source: 'player' }), true);
  assert.strictEqual(pa.advocate, null); assert.ok(Sim.recordOf(a, { pawn: id, life: true }).some((e) => /^Dropped the cause/.test(e.text)));
  assert.ok(typeof issue(a, { actor: id, verb: 'dropCause', source: 'player' }) === 'string', 'refused again');
  // an agenda: laid down at any time, but no new cause for Culture.P.causeEvery years from the last one taken up; taking one up is a step at once
  const args = { dim, option: opt }, since = pa.causeSince;
  assert.ok(/more before a new one/.test(issue(a, { actor: id, verb: 'argue', args, source: 'player' })), 'no new cause yet');
  assert.ok(Sim.opportunities(a, id).filter((x) => x.verb === 'argue').every((x) => /more before a new one/.test(x.why)), 'and none is offered');
  assert.strictEqual(pa.advocate, null); assert.strictEqual(pa.causeSince, since);
  pa.causeSince = a.cenv.t - C.P.causeEvery; // as if the years had passed
  const was = pa.att[o];
  assert.strictEqual(issue(a, { actor: id, verb: 'argue', args, source: 'player' }), true, 'after the years, a new cause');
  assert.ok(Math.abs(pa.att[o] - (was + C.P.advocacyJump * (1 - was))) < 1e-6 && pa.causeSince === a.cenv.t, 'its own attitude steps towards it at once');
}
