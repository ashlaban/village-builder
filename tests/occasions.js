// Occasions (VB-126; design.md, Customs and culture, Meetings; Kim's answers in QUESTION_ARCHIVE.md, "VB-126"): a place, a start and an
// end, and who is asked. A wedding the day after a marriage, 16:00 to 21:00 at the couple's farm, for the couple and the near kin of both
// within a day's walk, takes those who are free; a funeral ale the day after a death, at the farm of the dead, for its household and near
// kin, stops work; the village meeting gathers the people with a voice on the green from 10:00 until the meeting at noon, and stops work.
// Those who come stand about the spot and talk there; at the end they are free, and after work go home; a wedding and a funeral ale are
// told in the log. A save made while one is under way plays on as the unbroken run.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, R = VB['sim/records'], O = VB['sim/occasions'];
const { canon } = require('./lib/canon.js'), { checkState } = require('./lib/invariants.js');
const sound = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants, ${what}`);
const world = (seed) => { const it = G.generate(seed, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done); return r.value; };
const roll = (st, f) => {
  const rs = new Set(Object.values(st.rng)); rs.forEach((r) => { r.fix = 0; });
  try { f(); } finally { rs.forEach((r) => { delete r.fix; }); }
};
const told = (st, from, kind) => st.record.slice(from).filter((e) => typeof e === 'object' && !e.self && e.kind === kind);
const villageOf = (st, id) => R.settlementIdOf(st, st.pawns[id]);
const near = (st, a, o) => Math.abs(a.x - o.x) < 16 && Math.abs(a.y - o.y) < 10;
// Populous at seed 3 (at seed 7 the first round marries one couple, since villages were laid out by their land), natural deaths off, every household with the means to marry, and the moving round at hour 0 of the first day.
function scene() {
  const st = Sim.seed(world(3), 3, 'populous'); st.naturalDeaths = false;
  for (const h of st.households) h.grain.barley += 5000;
  const mark = st.record.length;
  roll(st, () => Sim.movingRound(st));
  return { st, mark };
}

// 1. Each marriage calls its wedding for the next day, at the couple's farm, asking the couple, their household and the near kin of both.
const { st, mark } = scene(), weds = told(st, mark, 'married');
assert.ok(weds.length >= 2, `the round marries (${weds.length})`);
const weddings = st.occasions.filter((o) => o.kind === 'wedding');
assert.strictEqual(weddings.length, weds.length, 'a wedding for each marriage');
for (const e of weds) {
  const o = weddings.find((x) => x.for[0] === e.pawn && x.for[1] === e.other), f = st.farmsteads[st.households[e.household].farmstead];
  assert.ok(o, `the wedding of ${e.pawn} and ${e.other}`);
  assert.strictEqual(o.farm, f.id, 'at the couple\'s farm');
  assert.strictEqual(o.start, Sim.DAY + 16); assert.strictEqual(o.end, Sim.DAY + 21); assert.strictEqual(o.overrides, false);
  const asked = new Set(o.asked.map((g) => g.id));
  for (const id of [e.pawn, e.other, ...R.kinNear(st, e.pawn), ...R.kinNear(st, e.other)]) {
    const p = st.pawns[id], far = o.asked.find((g) => g.id === id);
    if (p.alive && p.age >= 4) assert.ok(asked.has(id) || villageOf(st, id) !== f.village, `kin ${id} of the couple is asked`);
    if (far) assert.ok(far.hours <= O.REACH && far.leave >= Sim.DAY + Sim.WORK[0] && far.leave <= o.start, `kin ${id} sets out in time`);
  }
  for (const g of o.asked) assert.ok(st.pawns[g.id].alive, 'only the living are asked');
}
sound(st, 'weddings called');

// 2. A save made on the wedding's day loads and plays on as the unbroken run.
Sim.advance(st, Sim.DAY + 15 - st.t); // 15:00 of the next day
const text = JSON.stringify(Sim.save(st));
// 3. At 16:30 those asked who were free have set out; those at work have not.
Sim.advance(st, 1.5);
for (const o of weddings) for (const id of o.come) assert.ok(!st.agents[id].job, `pawn ${id} left no work for the wedding`);
// 4. At 20:00 the couples stand at their weddings, in a ring about the spot, idle until the end; the wedding guests talk there.
Sim.advance(st, 3.5);
let present = 0, talks = 0;
for (const o of weddings) {
  for (const id of o.for) {
    const a = st.agents[id];
    assert.strictEqual(a.occasion, o.id, `pawn ${id} is at its own wedding`);
    if (!a.path) { assert.ok(near(st, a, o), `pawn ${id} stands about the spot`); assert.strictEqual(a.idleUntil >= o.end, true); }
    assert.ok(/wedding/i.test(Sim.describe(st, id)), Sim.describe(st, id));
  }
  for (const id of o.come) {
    const a = st.agents[id];
    if (a.occasion !== o.id) continue;
    present++;
    if (a.talk && a.talk.at >= o.start && st.agents[a.talk.with].occasion === o.id) talks++;
  }
}
assert.ok(present > 2 * weddings.length, `guests besides the couples (${present})`);
assert.ok(talks > 0, 'guests talk at the wedding');
sound(st, 'at the weddings');
// 5. At 21:00 it is over: none is held there, those outdoors walk home, and each wedding is told with those who came.
const before = st.record.length;
Sim.advance(st, 1.1);
for (const o of weddings) for (const id of o.come) {
  const a = st.agents[id];
  assert.notStrictEqual(a.occasion, o.id, `pawn ${id} is free after the wedding`);
  if (st.pawns[id].alive) assert.ok(a.inside || a.phase === 'home', `pawn ${id} goes home after the wedding`);
}
assert.strictEqual(st.occasions.filter((o) => o.kind === 'wedding').length, 0, 'the weddings are over');
const lines = told(st, before, 'wedding');
assert.strictEqual(lines.length, weddings.length, 'a line for each wedding');
for (const e of lines) {
  const o = weddings.find((x) => x.for[0] === e.pawn);
  assert.strictEqual(e.n, o.come.length); assert.ok(e.text.startsWith('The wedding of') && e.text.includes(`${o.come.length} came`), e.text);
}
sound(st, 'after the weddings');
{
  const back = Sim.load(world(3), JSON.parse(text));
  Sim.advance(back, 6.1);
  const bad = [...new Set([...Object.keys(st), ...Object.keys(back)])].filter((k) => k !== 'w' && canon(st[k]) !== canon(back[k]));
  assert.deepStrictEqual(bad, [], 'the loaded run plays as the unbroken one');
}

// 6. A death calls the funeral ale for the next day at the farm of the dead, for its household and near kin; it stops work.
const hh = st.households.find((h) => !h.dissolved && h.members.filter((id) => st.pawns[id].alive && st.pawns[id].age >= 18).length >= 3);
const dead = hh.members.find((id) => st.pawns[id].alive && st.pawns[id].age >= 18), mates = hh.members.filter((id) => id !== dead && st.pawns[id].alive);
const kin = R.kinNear(st, dead).filter((id) => st.pawns[id].alive && st.pawns[id].age >= 4);
const t0 = Math.floor(st.t / Sim.DAY) * Sim.DAY;
Sim.advance(st, t0 + Sim.DAY + 8 - st.t); // 8:00 of the next day
Sim.killPawn(st, dead, 'illness');
const ale = st.occasions.find((o) => o.kind === 'funeral' && o.for[0] === dead);
assert.ok(ale, 'a funeral ale is called');
assert.strictEqual(ale.farm, hh.farmstead); assert.strictEqual(ale.overrides, true);
assert.strictEqual(ale.start, t0 + 2 * Sim.DAY + 16, 'the next day at 16:00');
for (const id of [...mates, ...kin]) if (st.pawns[id].age >= 4) {
  assert.ok(ale.asked.some((g) => g.id === id) || villageOf(st, id) !== st.farmsteads[hh.farmstead].village, `pawn ${id} is asked to the ale`);
}
Sim.advance(st, ale.start - 0.3 - st.t);
const working = ale.asked.filter((g) => g.leave === ale.start && st.agents[g.id].job && st.agents[g.id].phase !== 'back').map((g) => g.id);
Sim.advance(st, 0.5);
// but one that took up its load meanwhile, which it carries home first (as those carrying at the first look)
for (const id of working) assert.ok(st.agents[id].occasion === ale.id || st.agents[id].phase === 'back', `pawn ${id} leaves its work for the funeral ale`);
assert.ok(/funeral ale/i.test(Sim.describe(st, mates[0])), Sim.describe(st, mates[0]));
const mark2 = st.record.length;
Sim.advance(st, 5);
const aleLine = told(st, mark2, 'funeralAle');
assert.strictEqual(aleLine.length, 1); assert.ok(aleLine[0].text.startsWith('The funeral ale for'), aleLine[0].text);
sound(st, 'after the funeral ale');

// 7. The meeting (autumn day 10): the people with a voice gather on the green from 10:00 and stand there until the meeting is done.
const autumn10 = (2 * Sim.SEASON_DAYS + 9) * Sim.DAY;
Sim.advance(st, autumn10 + 11 - st.t);
const meetings = st.occasions.filter((o) => o.kind === 'meeting');
assert.ok(meetings.length >= 1, 'the villages meet');
for (const o of meetings) {
  const v = st.villages[o.village], s = st.cenv.settlements[v.id];
  assert.strictEqual(o.tile, v.center, 'on the green'); assert.strictEqual(o.end, autumn10 + 12.5);
  const voices = R.membersOf(st, v.id).filter((p) => R.voiceOf(st, p, s) > 0).map((p) => p.id);
  for (const id of voices) assert.ok(o.come.includes(id) || o.asked.some((g) => g.id === id), `voice ${id} is called to the ${v.name} meeting`);
  assert.ok(o.come.length >= Math.ceil(voices.length / 2), `the ${v.name} meeting is attended (${o.come.length} of ${voices.length})`);
}
sound(st, 'at the meetings');
Sim.advance(st, 2);
assert.strictEqual(st.occasions.filter((o) => o.kind === 'meeting').length, 0, 'the meetings are over');
assert.ok(st.agents.every((a) => a.occasion === null), 'nobody is held');
console.log(`occasions ok: ${weddings.length} weddings (${present} there at 20:00, ${talks} talking), a funeral ale that stops work, `
  + `${meetings.length} meetings on the greens; saved and loaded mid-wedding`);
