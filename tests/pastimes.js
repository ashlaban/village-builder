// Own time (VB-1539; design.md, Work, Own time): a pawn the planner found no task chooses a pastime from sim/pastimes' table. Each of
// the six is reached on the probe's small village: a child of 7 to 13 plays, a herder stays by its herd, a pawn with a close friend at
// home on another farm of its village visits and walks there, the fire weighs more in winter and for the old; the verb `pastime`
// refuses with a reason and passes the planner's choice and the played pawn's by one check; the head's call and a task cut a pastime as
// they cut an idle wait; `describe` says the pastime and with whom.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim;
const probe = require('./lib/probe.js'), { checkState } = require('./lib/invariants.js');
const P = VB['sim/pastimes'], { PASTIME, PASTIMES } = P, { SOCIAL } = VB['sim/ties'];
const { issue } = VB['sim/commands'], A = VB['sim/agents'], { age, fullName } = VB['sim/records'];
const { cal, WORK, YEAR } = VB['sim/rules'];

assert.deepStrictEqual(Object.keys(PASTIMES).sort(), ['company', 'fire', 'green', 'herd', 'play', 'visit'], 'the six pastimes of the row');
const st = probe.state();
st.naturalDeaths = false;
// to the middle of the first working morning
while (cal(st.t).hour !== WORK[0] + 2) Sim.advance(st, 1);
const farmOf = (p) => st.farmsteads[st.households[p.household].farmstead];
const free = (p, out = true) => { const g = st.agents[p.id]; A.release(st, g); A.standStill(st, g); if (out) g.inside = false; g.idleUntil = 0; return g; };
const atHome = (q) => { const g = st.agents[q.id]; A.placeAtHome(st, g); A.idle(st, g, st.t + 6); };
const endOf = (g) => g.path[g.path.length - 1];
const nearTile = (g, tile, r = 40) => Math.hypot(endOf(g)[0] - st.w.hx[tile], endOf(g)[1] - st.w.hy[tile]) <= r;
// the draw is among a visit, the green, the fire and play: a test leaves one of them its weight
const W0 = { ...PASTIME.weights }, seek0 = SOCIAL.seek;
const only = (...kinds) => { for (const k of Object.keys(W0)) PASTIME.weights[k] = kinds.includes(k) ? W0[k] : 0; };
SOCIAL.seek = 0; // no company, but where the test asks for it

const alive = st.pawns.filter((p) => p.alive);
const adults = alive.filter((p) => age(st, p) >= 18), kids = alive.filter((p) => age(st, p) >= 7 && age(st, p) < 14);
assert.ok(adults.length >= 4 && kids.length >= 1, 'adults and a child of 7 to 13');

// play: a child of 7 to 13 plays, on the green; an adult does not, and a child neither visits nor idles on the green as its elders do
const kid = kids[0], kg = free(kid), v = st.villages[farmOf(kid).village];
assert.ok(v.green, 'the probe village has a green');
only('play', 'green', 'visit');
P.ownTime(st, kg);
assert.strictEqual(kg.pastime.kind, 'play'); assert.ok(nearTile(kg, v.center), 'it walks to the green');
assert.strictEqual(Sim.describe(st, kid.id), 'Running off to play');
assert.match(P.why(st, adults[0].id, 'play', null), /not of an age/);
assert.match(P.why(st, kid.id, 'visit', { with: adults[0].id }), /too young/);
assert.match(P.why(st, kid.id, 'green', null), /children play/);

// a visit: one with a close friend at home on another farm of its village may visit, and walks there
const x = adults[0], y = adults.find((q) => farmOf(q) !== farmOf(x) && farmOf(q).village === farmOf(x).village);
const z = adults.find((q) => farmOf(q).village !== farmOf(x).village);
assert.ok(y && z, 'an adult on another farm of the village, and one of another village');
const xg = free(x);
assert.match(P.why(st, x.id, 'visit', { with: y.id }), /neither near kin nor a close friend/);
x.bands.set(y.id, 1); x.bands.set(z.id, 1);
free(y); // out on a walk somewhere: not at home
st.agents[y.id].x += 400;
assert.match(P.why(st, x.id, 'visit', { with: y.id }), /is not at home/);
assert.match(P.why(st, x.id, 'visit', { with: z.id }), /another village/);
assert.match(P.why(st, x.id, 'visit', null), /spent with someone/);
only('visit');
P.ownTime(st, xg);
assert.ok(!xg.pastime || xg.pastime.kind !== 'visit', 'no one at home to visit: it waits where it is');
atHome(y);
xg.idleUntil = 0;
P.ownTime(st, xg);
assert.deepStrictEqual([xg.pastime.kind, xg.pastime.with, xg.pastime.farm], ['visit', y.id, farmOf(y).id]);
assert.ok(xg.path && nearTile(xg, farmOf(y).house, 20), 'a visit is walked, to the friend\'s house');
assert.strictEqual(Sim.describe(st, x.id), `Walking to visit ${y.given} at ${farmOf(y).name}`);
const from = [xg.x, xg.y];
for (let h = 0; h < 30 && xg.path; h++) Sim.advance(st, 0.1);
assert.ok(!xg.path && Math.hypot(xg.x - from[0], xg.y - from[1]) > 20, 'it arrives on foot');
assert.strictEqual(Sim.describe(st, x.id), `Visiting ${y.given} at ${farmOf(y).name}`);
assert.strictEqual(VB['sim/reasons'].reasonOf(st, x.id).by, 'self', 'the reasons view (VB-1538): a pastime is its own choosing');
assert.deepStrictEqual(checkState(st), [], 'invariants with pastimes under way');

// the head's call cuts a pastime as it cut an idle wait (sim/hands' settle: the pawn idles until now, and looks for work at the next step)
assert.ok(P.of(st, x.id), 'at its pastime');
assert.strictEqual(issue(st, { actor: x.id, verb: 'idle', args: { until: st.t }, source: 'planner' }), true);
assert.strictEqual(P.of(st, x.id), null, 'called: the pastime is over');
assert.ok(A.wantsWork(st, xg, cal(st.t)), 'and it wants work');
assert.strictEqual(Sim.describe(st, x.id), 'Resting');

// the green; and a task that opens cuts the pastime: the pawn takes it as an idle pawn did
only('green');
xg.idleUntil = 0;
P.ownTime(st, xg);
assert.strictEqual(xg.pastime.kind, 'green'); assert.ok(nearTile(xg, st.villages[farmOf(x).village].center));
assert.strictEqual(Sim.describe(st, x.id), 'Strolling to the green');
const job = Sim.opportunities(st, x.id).find((o) => o.verb === 'work' && o.why === null);
assert.ok(job, 'work it may take');
assert.strictEqual(issue(st, { actor: x.id, verb: 'work', target: job.target, source: 'planner' }), true);
assert.ok(xg.job && P.of(st, x.id) === null, 'at work, the pastime is over');
assert.ok(!/green/.test(Sim.describe(st, x.id)));

// the fire: at home with its housemates; it weighs more in winter, and for the old and the weak
only('fire');
const summer = { season: 1 }, winter = { season: 3 }, fire = (p, c) => PASTIMES.fire.weight(st, st.agents[p.id], p, c);
const w = adults[1], w0 = fire(w, summer), born = w.born, health = w.health;
assert.ok(fire(w, winter) > w0, 'more in winter');
w.born = st.t - 70 * YEAR; assert.ok(fire(w, summer) > w0, 'more for the old'); w.born = born;
w.health = 30; assert.ok(fire(w, summer) > w0, 'more for the weak'); w.health = health;
// indoors in winter, and for the old and the weak; else on the yard, out of doors
assert.notStrictEqual(cal(st.t).season, 3, 'the probe is not in winter');
const wg = free(w);
P.ownTime(st, wg);
assert.deepStrictEqual([wg.pastime.kind, wg.pastime.farm, wg.phase], ['fire', farmOf(w).id, null]);
assert.ok(nearTile(wg, farmOf(w).house, 20), 'in the light seasons it sits in its yard');
assert.strictEqual(Sim.describe(st, w.id), 'Strolling home');
w.born = st.t - 70 * YEAR; free(w);
P.ownTime(st, wg);
assert.deepStrictEqual([wg.pastime.kind, wg.pastime.farm, wg.phase], ['fire', null, 'home']);
assert.strictEqual(Sim.describe(st, w.id), 'Going home to the fire');
for (let h = 0; h < 30 && wg.path; h++) Sim.advance(st, 0.1);
assert.ok(wg.inside && !wg.path, 'indoors');
if (P.of(st, w.id)) assert.strictEqual(Sim.describe(st, w.id), 'By the fire');
w.born = born;

// company, as built: it joins one it likes who is free out of doors
SOCIAL.seek = 4; only();
const m = adults.find((q) => q !== x && q !== w && farmOf(q).village === farmOf(w).village && VB['sim/relations'].opinionOf(st, w.id, q.id) > -0.04);
assert.ok(m, 'one of its village it likes');
for (const g of st.agents) if (g.id !== m.id && g.id !== w.id) g.inside = true;
const mg = free(m); free(w); st.idlers = null;
wg.x = mg.x + 60;
P.ownTime(st, wg);
assert.deepStrictEqual([wg.pastime.kind, wg.pastime.with], ['company', m.id]);
assert.strictEqual(Sim.describe(st, w.id), `Walking over to ${m.given}`);
assert.match(P.why(st, w.id, 'company', { with: x.id }), /not free out of doors/);
SOCIAL.seek = 0;

// by the herd: one who holds it at the side stays by it
only('green', 'fire', 'play', 'visit');
// (the side task set by hand, as tests/encounters.js does: a pasture three tiles from the green)
const herder = free(adults[2]), pasture = st.w.nb[st.w.nb[st.w.nb[st.villages[farmOf(adults[2]).village].center * 6] * 6] * 6];
herder.side = { partial: null, background: { kind: 'herd', key: 'probe', site: pasture } };
herder.idleUntil = 0;
P.ownTime(st, herder);
assert.strictEqual(herder.pastime.kind, 'herd'); assert.strictEqual(P.line(st, herder.id), null, 'the card says the herding');
assert.ok(herder.path && nearTile(herder, pasture, 20), 'by the herd');
assert.strictEqual(Sim.describe(st, herder.id), VB['sim/kinds'].KINDS.herd.go);
A.standStill(st, herder); delete herder.side; A.idle(st, herder, st.t + 6);
assert.match(P.why(st, x.id, 'herd', null), /holds no herd/);

// the verb: refusals change nothing; the planner's choice and the played pawn's pass the same check
const snap = () => JSON.stringify(st.agents.map((g) => [g.x, g.y, g.path, g.phase, g.idleUntil, g.pastime]));
const before = snap(), dead = st.pawns.find((p) => !p.alive);
for (const [cmd, why] of [
  [{ actor: x.id, verb: 'pastime', target: 'chess' }, /there is no pastime/],
  [{ actor: x.id, verb: 'pastime', target: 'play' }, /not of an age/],
  [{ actor: x.id, verb: 'pastime', target: 'green', args: { until: st.t - 1 } }, /past/],
  [{ actor: x.id, verb: 'pastime', target: 'company' }, /spent with someone/],
  [{ actor: 9999, verb: 'pastime', target: 'green' }, /not a living pawn/],
  ...(dead ? [[{ actor: dead.id, verb: 'pastime', target: 'fire' }, /not a living pawn/]] : []),
]) {
  const res = issue(st, { source: 'player', ...cmd });
  assert.ok(typeof res === 'string' && why.test(res), `${JSON.stringify(cmd)}: ${res}`);
}
assert.strictEqual(snap(), before, 'a refused pastime changes nothing');
// the played pawn's Actions list the pastimes open to it, each passing the verb's check
while (Math.floor(cal(st.t).hour) !== WORK[0] + 2) Sim.advance(st, 0.5);
atHome(y);
const mine = Sim.opportunities(st, x.id).filter((o) => o.verb === 'pastime');
const names = mine.map((o) => o.pastime.name);
assert.ok(names.includes('Go to the green') && names.includes('Sit at home') && !names.includes('Go and play'), `an adult's pastimes: ${names}`);
assert.ok(names.includes(`Visit ${y.given} at ${farmOf(y).name}`), `a visit to its friend at home: ${names}`);
assert.ok(Sim.opportunities(st, kid.id).some((o) => o.verb === 'pastime' && o.target === 'play'), 'a child may play');
for (const o of mine) {
  assert.strictEqual(o.why, null, `${o.pastime.name}: ${o.why}`);
  assert.strictEqual(issue(st, { actor: x.id, verb: 'pastime', target: o.target, args: o.args, source: 'player' }), true, o.pastime.name);
  assert.strictEqual(st.agents[x.id].pastime.kind, o.target);
}
assert.deepStrictEqual(checkState(st), [], 'invariants at the end');
// plain data, kept by a save
const saved = Sim.load(probe.world(), JSON.parse(JSON.stringify(Sim.save(st))));
assert.deepStrictEqual(saved.agents[x.id].pastime, st.agents[x.id].pastime, 'a save keeps the pastime');
Object.assign(PASTIME.weights, W0); SOCIAL.seek = seek0;
console.log(`pastimes ok: ${Object.keys(PASTIMES).join(', ')} each reached; the verb refuses with a reason; the call and a task cut a pastime; ${fullName(x)} had ${names.length} to choose from`);
