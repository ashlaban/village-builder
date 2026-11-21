// Commands (VB-167): a work command is carried out as start was; a refused command changes nothing; outside a verb (the `register(...)` of
// the module that carries it out, VB-228) and the module that defines it, nothing in src/sim calls start (or the other acts the verbs wrap). On the small islands of tests/lib/probe.js (VB-856; the default
// island before): founders on 36 by 26, heirs on 48 by 34.
const assert = require('assert');
const { readSource } = require('../tools/lib/source.js');
const fs = require('fs'), path = require('path'), { tokenize } = require('../tools/wrap.js');
const VB = require('../src/load.js'), { island, ROOMY } = require('./lib/probe.js'), Sim = VB.sim, { issue } = VB['sim/commands'], { isOpen } = VB['sim/kinds'];
const { canon } = require('./lib/canon.js');

// static: the acts a verb wraps are called only from a verb (inside a `register(` call), or inside the module that defines them (an act
// built of others there)
const WRAPPED = ['start', 'walkTo', 'goHome', 'idle', 'haltForTalk', 'wed', 'startClaim', 'settleFarm', 'found', 'finishCottage', 'settleGift', 'carryGift', 'setRoutines', 'setGathering', 'endTrust', 'holdInTrust',
  'setTarget', 'nameTile', 'setOrder', 'holdProject', 'beginLand', 'giveUp', 'planVisit'], calls = [];
const files = fs.readdirSync(path.join(__dirname, '../src/sim')).map((x) => 'src/sim/' + x).concat(['src/sim.js']);
const text = Object.fromEntries(files.map((f) => [f, readSource(f)]));
const definedIn = Object.fromEntries(WRAPPED.map((n) => [n, files.find((f) => new RegExp(`function ${n}\\(`).test(text[f]))]));
for (const n of WRAPPED) if (!definedIn[n]) throw new Error(`no module defines ${n}`);
for (const f of files) {
  const src = text[f], toks = tokenize(src).filter((t) => t.t !== 'com');
  const inVerb = new Set(); // the tokens inside a register(...) call
  toks.forEach((t, i) => {
    if (!(t.t === 'word' && t.v === 'register' && toks[i + 1] && toks[i + 1].v === '(' && !(toks[i - 1] && toks[i - 1].v === 'function'))) return;
    for (let k = i + 1, depth = 0; k < toks.length; k++) {
      if (toks[k].v === '(') depth++;
      else if (toks[k].v === ')' && --depth === 0) break;
      inVerb.add(k);
    }
  });
  toks.forEach((t, i) => {
    const prev = toks[i - 1];
    if (inVerb.has(i)) return;
    // These acts have exactly one entry through a verb, even inside their defining module.
    if (t.t === 'word' && ['moveTo', 'carryGift', 'haulGift', 'fetchGift'].includes(t.v) && toks[i + 1] && toks[i + 1].v === '(' && !(prev && prev.v === 'function')) calls.push(`${f}:${src.slice(0, t.s).split('\n').length} ${t.v}`);
    if (t.t === 'word' && WRAPPED.includes(t.v) && definedIn[t.v] !== f && toks[i + 1] && toks[i + 1].v === '(' && !(prev && (prev.v === '.' || prev.v === 'function'))) {
      calls.push(`${f}:${src.slice(0, t.s).split('\n').length} ${t.v}`);
    }
  });
}
assert.deepStrictEqual(calls, [], `acts called outside a verb: ${calls.join(', ')}`);
// VB-1111: every caller of `give` is known and checked (help's near gift is fetched and its far one carried, tests/fetch.js and
// tests/journeys.js; the page's form names its carrier or has it fetched), and settleGift is reached at one place, the last branch of
// `deliver`, after the carried, the hauled and the fetched: a gift within one farmstead (tests/lib/invariants.js holds giftUncarried at 0)
{
  const pages = fs.readdirSync(path.join(__dirname, '../src/page')).map((x) => 'src/page/' + x);
  const givers = files.concat(pages).filter((f) => /verb: 'give'/.test(text[f] || readSource(f))).sort();
  assert.deepStrictEqual(givers, ['src/page/gift.js', 'src/sim/help.js'], 'a new caller of give says how its gift is carried');
  const cmd = text['src/sim/gifts.js'];
  assert.strictEqual(cmd.split('settleGift(').length - 1, 1, 'settleGift is called once');
  assert.ok(/carryGift\([^]*haulGift\([^]*fetchGift\([^]*else settleGift\(/.test(cmd), 'and only after the carried, hauled and fetched gifts');
}

const st = Sim.seed(island(7), 7, 'founders');
Sim.advance(st, 3 * Sim.DAY + 4); // a working morning: jobs posted
const snap = () => { const { w, ...rest } = st; return canon(rest); };
const j = [...st.jobs.values()].find((x) => isOpen(st, x) && x.claims.length === 0);
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
const full = [...st.jobs.values()].find((x) => !isOpen(st, x));
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
const hw = island(7, ROOMY);
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
const st3 = Sim.seed(island(7, ROOMY), 7, 'heirs');
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
assert.strictEqual(issue(st3, { actor: servant.id, verb: 'move', target: master.id, args: { reason: 'service' }, source: 'round' }), true);
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
  [{ actor: servant.id, verb: 'move', target: master.id, args: { reason: 'service' } }, /lives there already/], [{ actor: servant.id, verb: 'claim', target: 9999 }, /no farm/]);
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
assert.deepStrictEqual(membership.pawns[0], { household: 1, servant: false, servedSince: null });
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
  const land = () => island(7, ROOMY);
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
  pa.causeSince -= 2 * C.P.causeGrace; // past its first season, so that the drop starts the wait (VB-1103)
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

// ---- offer and answer (VB-690): one verb pair for every crossing between households (sim/offers' bases gift, ask and match) ----
{
  const Offers = VB['sim/offers'], { opinionOf, balance } = VB['sim/relations'], { HELP } = VB['sim/rules'], { checkState } = require('./lib/invariants.js');
  const fresh = () => {
    const s = Sim.seed(island(7), 7, 'founders');
    const [a, b] = s.households.filter((h) => !h.dissolved && h.holder !== null
      && h.members.some((id) => id !== h.holder && s.pawns[id].age >= 14 && s.pawns[id].age < 60));
    b.grain = { barley: 5000 };
    return { s, a, b };
  };
  const sound = (s, what) => assert.deepStrictEqual(checkState(s), [], `invariants, ${what}`);
  const offer = (s, actor, target, args, source = 'pawn') => issue(s, { actor, verb: 'offer', target, args, source });
  const gift = (n) => ({ basis: 'gift', gives: { good: 'grain', n } });
  const told = (s, kind, f = () => true) => s.record.some((e) => typeof e === 'object' && e.kind === kind && f(e));
  // (a) a gift between unplayed pawns: the receiver's holder answers yes at once; nothing is kept, the grain moves, goodwill is booked
  {
    const { s, a, b } = fresh(), a0 = Sim.grainOf(a), b0 = Sim.grainOf(b);
    assert.strictEqual(offer(s, b.holder, a.holder, gift(30)), true);
    assert.deepStrictEqual([s.offers, s.offerSeq], [[], 0], 'answered at once: never kept');
    assert.ok(Math.abs(b0 - Sim.grainOf(b) - 30) < 1e-9 && Sim.grainOf(a) <= a0, 'the gift is set aside where it lies (VB-461)');
    assert.ok(s.away.some((j) => j.why === 'fetch' && s.pawns[j.pawn].household === a.id), 'and a member of the receiving household fetches it');
    for (let k = 0; k < 96 && s.away.length; k++) Sim.advance(s, 0.5);
    assert.ok(a.ledger.some((e) => e.kind === 'gift' && Math.abs(e.n - 30) < 1e-9), 'the gift settles as it comes in');
    assert.ok(balance(s, b.holder, a.holder) > 0, 'the giver is owed its worth: goodwill');
    for (const [args, why] of [[{ basis: 'loan' }, /no basis/], [{ ...gift(30), wants: { good: 'grain', n: 1 } }, /wants nothing/],
      [{ ...gift(30), due: s.t - 1 }, /cannot be due/], [gift(-1), /cannot give/]])
      assert.ok(why.test(offer(s, b.holder, a.holder, args)), `refused: ${JSON.stringify(args)}`);
    assert.ok(/no open offer/.test(issue(s, { actor: a.holder, verb: 'answer', target: 0, args: { yes: true }, source: 'pawn' })), 'no open offer to answer');
    assert.ok(/only as an offer settles/.test(issue(s, { actor: b.holder, verb: 'deliver', target: a.id, args: { good: 'grain', n: 5 }, source: 'player' })),
      'goods are delivered only by an offer');
    sound(s, 'a gift');
  }
  // (b) the played pawn is asked: the offer is kept for HELP.answerDays, its pawn's judgement shown as advice; a no is a memory of both
  {
    const { s, a, b } = fresh(), a0 = Sim.grainOf(a);
    assert.strictEqual(Sim.inhabit(s, a.holder), true);
    const ob = opinionOf(s, b.holder, a.holder), oa = opinionOf(s, a.holder, b.holder);
    assert.strictEqual(offer(s, b.holder, a.holder, gift(30)), true);
    const o = s.offers[0];
    assert.ok(o && o.basis === 'gift' && o.due === o.made + HELP.answerDays * Sim.DAY && o.answers[0].by === a.holder, `kept: ${JSON.stringify(s.offers)}`);
    sound(s, 'a gift waits for the player');
    const item = Sim.opportunities(s, a.holder).find((x) => x.verb === 'answer' && x.target === o.id);
    assert.ok(item && item.offer.advice === true && item.offer.basis === 'gift' && /a gift of 30 grain/.test(item.offer.text), 'the advice: the pawn\'s own yes');
    assert.ok(/no answer to give/.test(issue(s, { actor: b.holder, verb: 'answer', target: o.id, args: { yes: true }, source: 'pawn' })), 'the giver has none to give');
    assert.strictEqual(Sim.answer(s, o.id, false), true);
    assert.deepStrictEqual(s.offers, [], 'a no closes it');
    assert.strictEqual(Sim.grainOf(a), a0, 'nothing moves');
    assert.ok(opinionOf(s, b.holder, a.holder) < ob && opinionOf(s, a.holder, b.holder) < oa, 'both remember the refusal');
    assert.ok(told(s, 'offerRefused', (e) => e.pawn === a.holder), 'the refusal is told');
    // silence: at its due time it is answered as the pawn would, yes, and settles
    assert.strictEqual(offer(s, b.holder, a.holder, gift(20)), true);
    assert.strictEqual(s.offers.length, 1);
    Sim.advance(s, 2 * Sim.DAY);
    assert.deepStrictEqual(s.offers, []);
    for (let k = 0; k < 96 && s.away.some((j) => j.why === 'fetch'); k++) Sim.advance(s, 0.5); // fetched (VB-461)
    assert.ok(a.ledger.some((e) => e.kind === 'gift' && Math.abs(e.n - 20) < 1e-9), 'settled at its due time');
  }
  // (c) an ask: a holder asks another for grain; the asked weighs it as the gift it would make, and a yes sets the grain aside, fetched by the asker
  {
    const { s, a, b } = fresh(), b0 = Sim.grainOf(b);
    assert.strictEqual(offer(s, a.holder, b.holder, { basis: 'ask', wants: { good: 'grain', n: 20 } }), true);
    const j = s.away.find((x) => x.why === 'fetch');
    assert.ok(j && s.pawns[j.pawn].household === a.id && j.gift.stops[0].left === 20, `a member of the asking household sets out to fetch: ${JSON.stringify(s.away)}`);
    assert.ok(!s.away.some((x) => x.why === 'carry'), 'no carrier of the asked household takes it up at the start');
    const took = b0 - Sim.grainOf(b); // the grain is set aside where it lies, no more
    assert.ok(Math.abs(took - 20) < 1e-9, `the grain is set aside: ${took}`);
    assert.ok(/own household/.test(offer(s, a.holder, a.holder, { basis: 'ask', wants: { good: 'grain', n: 20 } })), 'not of one\'s own');
    // beyond what the asked would give: no, and both remember it
    const ob = opinionOf(s, a.holder, b.holder);
    assert.strictEqual(offer(s, a.holder, b.holder, { basis: 'ask', wants: { good: 'grain', n: 50000 } }), true);
    assert.ok(opinionOf(s, a.holder, b.holder) < ob, 'the asker remembers the refusal');
    assert.ok(told(s, 'offerRefused', (e) => e.pawn === b.holder), 'the refusal is told');
    sound(s, 'an ask');
  }
  // (d) an offer due later is kept and answered once, at its due time, by the unplayed pawn's judgement
  {
    const { s, a, b } = fresh(), n0 = VB.count.offerWeighed;
    assert.strictEqual(offer(s, a.holder, b.holder, { basis: 'ask', wants: { good: 'grain', n: 20 }, due: s.t + 2 * Sim.DAY }), true);
    assert.ok(s.offers.length === 1 && s.offers[0].answers[0].yes === null && VB.count.offerWeighed === n0, 'not weighed before it is due');
    sound(s, 'an ask due later');
    Sim.advance(s, 3 * Sim.DAY);
    assert.deepStrictEqual(s.offers, [], 'answered at its due time');
    assert.strictEqual(VB.count.offerWeighed, n0 + 1, 'one evaluation');
    assert.ok(a.ledger.some((e) => e.kind === 'gift') || s.away.some((x) => x.why === 'fetch'), 'and fetched');
  }
  assert.ok(['gift', 'ask', 'match'].every((k) => Offers.BASES[k] && typeof Offers.BASES[k].weigh === 'function'), 'the table of bases');
}
console.log('commands ok: offer and answer (VB-690): a gift and an ask settle at once between the unplayed, carried; the played pawn is asked, with '
  + 'its advice; a no is a memory of both; an offer due later is weighed once, at its due time');

// move (VB-822): the one act for every change of household, with its reason and the minors who follow; each refusal changes nothing
{
  const s = Sim.seed(island(7, ROOMY), 7, 'heirs');
  Sim.advance(s, Sim.DAY);
  const snap = () => { const { w, ...rest } = s; return canon(rest); };
  const live = (p) => p.died === null && p.household !== null;
  const parent = s.pawns.find((p) => live(p) && p.age >= 18 && Sim.childrenOf(s, p.id).some((c) => live(s.pawns[c]) && s.pawns[c].age < 18 && s.pawns[c].household === p.household));
  assert.ok(parent, 'a parent living with a minor child');
  const kid = Sim.childrenOf(s, parent.id).find((c) => live(s.pawns[c]) && s.pawns[c].age < 18 && s.pawns[c].household === parent.household);
  const stranger = s.pawns.find((p) => live(p) && p.age < 18 && !Sim.childrenOf(s, parent.id).includes(p.id) && (Sim.spouseOf(s, parent.id) === null || !Sim.childrenOf(s, Sim.spouseOf(s, parent.id)).includes(p.id)));
  const grown = s.pawns.find((p) => live(p) && p.age >= 18 && p.id !== parent.id);
  const other = s.households.find((h) => !h.dissolved && h.id !== parent.household);
  const go = (actor, target, args) => issue(s, { actor, verb: 'move', target, args, source: 'test' });
  const before = snap();
  for (const [actor, target, args, why] of [
    [9999, other.id, { reason: 'care' }, /not a living pawn/],
    [parent.id, 9999, { reason: 'care' }, /no household/],
    [parent.id, parent.household, { reason: 'care' }, /lives there already/],
    [parent.id, other.id, { reason: 'whim' }, /no reason whim/],
    [parent.id, other.id, undefined, /no reason/],
    [parent.id, other.id, { reason: 'care', with: kid }, /must be a list/],
    [parent.id, other.id, { reason: 'care', with: [9999] }, /not a living pawn/],
    [parent.id, other.id, { reason: 'care', with: [stranger.id] }, /not a minor whom/],
    [parent.id, other.id, { reason: 'care', with: [grown.id] }, /not a minor whom/],
    [parent.id, other.id, { reason: 'care', with: [parent.id] }, /not a minor whom/],
  ]) {
    const res = go(actor, target, args);
    assert.ok(typeof res === 'string' && why.test(res), `move ${JSON.stringify(args)}: ${res}`);
  }
  assert.strictEqual(snap(), before, 'a refused move changes nothing');
  // the minors who follow: the parent with its child, both in the new household, after it; the record's `joined` carries the reason
  const n = s.record.length;
  assert.strictEqual(go(parent.id, other.id, { reason: 'care', with: [kid] }), true);
  assert.ok(parent.household === other.id && s.pawns[kid].household === other.id, 'the parent and the child moved');
  const tail = (from) => s.record.slice(from).filter((e) => e.kind === 'joined');
  assert.ok(tail(n).every((e) => e.reason === 'care'), 'the joined events carry the reason');
  assert.deepStrictEqual(tail(n).map((e) => e.pawn), [parent.id, kid], 'the parent first, the child after it');
  // each reason moves; settlers walk on their stakes; service makes a servant, with its event and its log line
  const homes = s.households.filter((h) => !h.dissolved);
  const movers = s.pawns.filter((p) => live(p) && p.age >= 18 && p.id !== parent.id && !Sim.isHolder(s, p.id));
  const REASONS = ['marriage', 'heir', 'service', 'guardian', 'care', 'home', 'settle', 'found'];
  assert.ok(movers.length >= REASONS.length, 'enough pawns to move');
  REASONS.forEach((reason, k) => {
    const p = movers[k], to = homes.find((h) => h.id !== p.household && s.farmsteads[h.farmstead].id !== s.households[p.household].farmstead);
    const m = s.record.length;
    assert.strictEqual(go(p.id, to.id, { reason }), true, reason);
    assert.strictEqual(p.household, to.id, `${reason}: moved`);
    assert.ok(tail(m).some((e) => e.pawn === p.id && e.reason === reason), `${reason}: the joined event carries it`);
    assert.strictEqual(p.servant === true, reason === 'service', `${reason}: a servant only by service`);
    if (reason === 'service') assert.ok(s.record.slice(m).some((e) => e.kind === 'service' && e.pawn === p.id), 'the service event');
  });
}
console.log('commands ok: move (VB-822): each refusal changes nothing; each reason moves, on the record; the minors follow; service makes a servant');

// VB-228 (Kim, 18 Nov): a talk cuts a stroll, and a walk let go of, but not a walk on an errand: any pawn's, and so the played pawn's queued walk
{
  const s2 = Sim.seed(island(7), 7, 'founders');
  Sim.advance(s2, 3 * Sim.DAY + 4);
  const g = s2.agents.find((x) => s2.pawns[x.id].died === null), R = VB['sim/agents'];
  const far = s2.farmsteads.find((f) => f.house !== s2.farmsteads[s2.households[s2.pawns[g.id].household].farmstead].house).house;
  const walk = (args) => { R.release(s2, g); g.inside = false; g.occasion = null; assert.strictEqual(issue(s2, { actor: g.id, verb: 'walkTo', target: far, args, source: 'test' }), true); };
  const talk = () => issue(s2, { actor: g.id, verb: 'haltForTalk', args: { until: s2.t + 1 }, source: 'talk' });
  walk({}); assert.strictEqual(g.errand, true);
  const walking = JSON.stringify(g.path); talk();
  assert.strictEqual(JSON.stringify(g.path), walking, 'a walk on an errand goes on through a talk'); assert.strictEqual(g.anim, 'walk');
  R.release(s2, g); assert.strictEqual(g.errand, undefined, 'let go of, it is an errand no more');
  talk(); assert.strictEqual(g.path, null, 'and a talk stops it');
  walk({ near: true }); assert.strictEqual(g.errand, undefined, 'a stroll is no errand');
  talk(); assert.strictEqual(g.path, null, 'a talk stops a stroll');
  // the played pawn's queued walk outlasts a talk
  walk({}); R.release(s2, g); g.path = null;
  assert.strictEqual(Sim.inhabit(s2, g.id), true); assert.strictEqual(Sim.queue(s2, { actor: g.id, verb: 'walkTo', target: far }), true);
  Sim.advance(s2, 0.2); assert.ok(g.path && s2.player.queue.length === 1 && s2.player.queue[0].begun !== null, 'the queued walk is under way');
  const queued = JSON.stringify(g.path); talk();
  assert.strictEqual(JSON.stringify(g.path), queued, 'and a talk does not cut it'); assert.strictEqual(s2.player.queue.length, 1);
  Sim.advance(s2, 0.1); assert.strictEqual(s2.player.refused, null);
}
// VB-228: verbs are registered at load, once each, and the table closes with the registries (a state has been seeded above)
{
  const { register, VERBS } = VB['sim/commands'], V = { check: () => null, run: () => {} };
  assert.throws(() => register('work', V), /Rules may only be registered at load time/, 'sealed after the first seed');
  assert.ok(Object.values(VERBS).every((x) => typeof x.check === 'function' && typeof x.run === 'function'), 'every verb has a check and a run');
  const fresh = require('child_process').spawnSync(process.execPath, ['-e', `
    const { register } = require('./src/load.js')['sim/commands'], V = { check: () => null, run: () => {} };
    let dup = '', bad = '';
    try { register('work', V); } catch (e) { dup = e.message; }
    try { register('noRun', { check: () => null }); } catch (e) { bad = e.message; }
    console.log(dup + '|' + bad);`], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
  assert.strictEqual(fresh.stdout.trim(), 'Duplicate verb: work|Verb noRun needs a check and a run', fresh.stderr);
}
