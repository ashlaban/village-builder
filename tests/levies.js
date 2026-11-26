// The household's levy on a member (VB-1760; design.md section 7, The levy and own hours): the custom's hours a day by season, read through
// sim/customs' door; each member's levy by its row times its hands, the head pair not levied, a child under 7 neither levied nor allotted;
// compiled once a season a member; the head's day gives a levied member tasks up to its levy left today (the levy less the household's
// work and the outer levies' done today), the head pair up to their working hours as before, the rest of each list after; the work a
// household lives by inside the levy, slotted first. On a small constructed state: three farms on open ground, spring day 0.
const assert = require('assert');
const VB = require('../src/load.js'),
  Sim = VB.sim;
const { WORK, DAY, SEASON_DAYS, cal } = VB['sim/rules'],
  { CHILD, MATCH } = VB['sim/roles'];
const { age, spouseOf } = VB['sim/records'];
const { levyNorm } = VB['sim/customs'];
const Levies = VB['sim/levies'],
  Day = VB['sim/day'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'),
  { checkState } = require('./lib/invariants.js');
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const make = (hours) => {
  const st = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 3 }], { seed: 4 });
  st.makeFields = false;
  Sim.advance(st, hours);
  return st;
};

// 1. The custom's table, through the one door: an adult member 9.5, 10, 10.5 and 9.5 hours a day; a child of 7 to 13 6, 10, 7 and 3; a
// servant the adult row by its contract; a lodger and an elder none; a lodger's adult-days one in summer and one in autumn.
assert.deepStrictEqual([0, 1, 2, 3].map((s) => levyNorm(null, 'adult', s, 0)), [9.5, 10, 10.5, 9.5], 'the adult row');
assert.deepStrictEqual([0, 1, 2, 3].map((s) => levyNorm(null, 'child', s, 0)), [6, 10, 7, 3], 'the child row');
assert.deepStrictEqual([0, 1, 2, 3].map((s) => levyNorm(null, 'servant', s, 0)), [9.5, 10, 10.5, 9.5], 'a servant: the adult row');
for (const row of ['lodger', 'elder'])
  assert.deepStrictEqual([0, 1, 2, 3].map((s) => levyNorm(null, row, s, 0)), [0, 0, 0, 0], `the ${row} row`);
assert.deepStrictEqual([0, 1, 2, 3].map((s) => levyNorm(null, 'lodgerDays', s, 0)), [0, 1, 1, 0], "a lodger's adult-days");

// 2. Each member's levy: the head pair none; a child under 7 none; a child of 7 to 13 the child row times its hands; an elder none; any
// other adult, whatever its position, the adult row times its hands. Sim.levyOf is the same reading.
const st = make(4.5);
const hh = st.households[0],
  spouse = spouseOf(st, hh.holder);
let seen = { head: 0, adult: 0, child: 0, young: 0 };
for (const id of hh.members) {
  const p = st.pawns[id],
    a = age(st, p),
    L = Levies.levyOf(st, id);
  assert.strictEqual(Sim.levyOf(st, id), L, `pawn ${id}: Sim.levyOf`);
  if (id === hh.holder || id === spouse) {
    assert.strictEqual(L, null, `pawn ${id}, of the head pair: not levied`);
    seen.head++;
  } else if (a < CHILD.from) {
    assert.strictEqual(L, null, `pawn ${id}, under 7: not levied`);
    seen.young++;
  } else if (p.retired) assert.strictEqual(L, 0, `pawn ${id}, an elder: no hours`);
  else if (a < 14) {
    const hands = Math.min(1, CHILD.base + CHILD.perYear * (a - CHILD.from));
    assert.ok(L > 0 && L <= 6 * hands + 1e-9, `pawn ${id}, a child of ${a}: 6 hours times its hands (${L})`);
    seen.child++;
  } else {
    assert.ok(L > 0 && L <= 9.5 + 1e-9, `pawn ${id}, ${p.role}: 9.5 hours times its hands (${L})`);
    seen.adult++;
  }
}
assert.ok(seen.head >= 1 && seen.adult >= 1, `the household has a head pair and a levied adult (${JSON.stringify(seen)})`);
// another season's levy is worked out, not written: the summer's adult row
const son = hh.members.find((id) => id !== hh.holder && id !== spouse && age(st, st.pawns[id]) >= 14 && !st.pawns[id].retired);
const summer = Math.floor(st.t / DAY) + SEASON_DAYS;
assert.strictEqual(cal(summer * DAY + WORK[0]).season, 1, 'a summer day');
const at = st.plans.households.get(hh.id).levies.at;
assert.ok(Math.abs(Levies.levyOf(st, son, summer) / Levies.levyOf(st, son) - 10 / 9.5) < 1e-9, "the summer's levy, by its row");
assert.strictEqual(st.plans.households.get(hh.id).levies.at, at, "another season's levy is not compiled");

// 3. Compiled once a season a member: reading again compiles nothing; a member whose role changed is compiled again.
{
  const n = VB.count.levyCompile;
  for (let i = 0; i < 3; i++) for (const id of hh.members) Levies.levyOf(st, id);
  assert.strictEqual(VB.count.levyCompile, n, 'read again: nothing compiled');
  const e = st.plans.households.get(hh.id).levies.of[son];
  e[2] = 'changed';
  Levies.levyOf(st, son);
  assert.strictEqual(VB.count.levyCompile, n + 1, 'a changed role: that member compiled again');
}

// 4. The day's capacity: a levied member's is its levy left today, at most the working day left; the household's work done today and a
// day owed come out of it; the head pair's is the horizon's working hours, as before.
{
  const c = cal(st.t),
    row = 9.5,
    p = st.pawns[son],
    holder = st.pawns[hh.holder],
    day = Math.floor(st.t / DAY),
    dayLeft = WORK[1] - Math.min(WORK[1], Math.max(WORK[0], c.hour));
  assert.strictEqual(Levies.capacity(st, hh, holder, c), MATCH.day.horizon * (WORK[1] - WORK[0]), 'the head: its working hours');
  const worked = VB['sim/work'].workedToday(st, son, day);
  assert.ok(Math.abs(Levies.capacity(st, hh, p, c) - Math.max(0, Math.min(row - worked, dayLeft))) < 1e-9, 'a member: its levy left');
  const keep = st.workToday;
  st.workToday = { day, by: { [son]: 7 } };
  assert.ok(Math.abs(Levies.capacity(st, hh, p, c) - Math.min(2.5, dayLeft)) < 1e-9, "the household's work done today comes out of it");
  const owed = st.daysToday;
  st.daysToday = { day, by: { [son]: [0, 2, 0] } };
  assert.ok(Math.abs(Levies.capacity(st, hh, p, c) - Math.min(0.5, dayLeft)) < 1e-9, 'a day owed comes out of it');
  st.workToday = { day, by: { [son]: 12 } };
  assert.strictEqual(Levies.capacity(st, hh, p, c), 0, 'never below nothing');
  st.workToday = keep;
  st.daysToday = owed;
  if (st.daysToday === undefined) delete st.daysToday;
  if (st.workToday === undefined) delete st.workToday;
}

// 5. The morning's allotment: no levied member is given hands for more hours than its levy, the head pair no more than their working
// hours of the horizon; a member's tasks past it follow in its list, not given hands.
{
  const s = make(DAY + WORK[0] - 0.5),
    h = s.households[0],
    day = s.plans.households.get(h.id).day,
    sp = spouseOf(s, h.holder);
  assert.ok(day && day.hours, 'the day is allotted');
  for (const id of h.members) {
    const given = (day.hours[id] || []).reduce((x, y) => x + y, 0),
      L = Levies.levyOf(s, id),
      cap = id === h.holder || id === sp ? MATCH.day.horizon * (WORK[1] - WORK[0]) : L === null ? 0 : L / handsOf(s, id);
    if (L === null && id !== h.holder && id !== sp) continue;
    assert.ok(given <= cap + 1e-6, `pawn ${id}: ${given.toFixed(2)} hours given, within ${cap.toFixed(2)}`);
  }
  assert.deepStrictEqual(checkState(s), [], 'invariants');
}
function handsOf(s, id) {
  const e = s.plans.households.get(s.pawns[id].household).levies.of[id];
  return e[1];
}

console.log(
  "levies ok: the custom's table through the door; each member's levy by its row and hands, the head pair and a child under 7 not levied; compiled once a season; the levy left today the day's capacity; the morning's lists within the levies",
);
