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
const { KINDS } = VB['sim/kinds'];
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
assert.deepStrictEqual(
  [0, 1, 2, 3].map((s) => levyNorm(null, 'adult', s, 0)),
  [9.5, 10, 10.5, 9.5],
  'the adult row',
);
assert.deepStrictEqual(
  [0, 1, 2, 3].map((s) => levyNorm(null, 'child', s, 0)),
  [6, 10, 7, 3],
  'the child row',
);
assert.deepStrictEqual(
  [0, 1, 2, 3].map((s) => levyNorm(null, 'servant', s, 0)),
  [9.5, 10, 10.5, 9.5],
  'a servant: the adult row',
);
for (const row of ['lodger', 'elder'])
  assert.deepStrictEqual(
    [0, 1, 2, 3].map((s) => levyNorm(null, row, s, 0)),
    [0, 0, 0, 0],
    `the ${row} row`,
  );
assert.deepStrictEqual(
  [0, 1, 2, 3].map((s) => levyNorm(null, 'lodgerDays', s, 0)),
  [0, 1, 1, 0],
  "a lodger's adult-days",
);

// 2. Each member's levy: the head pair none; a child under 7 none; a child of 7 to 13 the child row times its hands; an elder none; any
// other adult, whatever its position, the adult row times its hands. Sim.levyOf is the same reading.
let ladderSeen = '';
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
assert.ok(
  seen.head >= 1 && seen.adult >= 1,
  `the household has a head pair and a levied adult (${JSON.stringify(seen)})`,
);
// another season's levy is worked out, not written: the summer's adult row
const son = hh.members.find(
  (id) => id !== hh.holder && id !== spouse && age(st, st.pawns[id]) >= 14 && !st.pawns[id].retired,
);
const summer = Math.floor(st.t / DAY) + SEASON_DAYS;
assert.strictEqual(cal(summer * DAY + WORK[0]).season, 1, 'a summer day');
const at = st.plans.households.get(hh.id).levies.at;
assert.ok(
  Math.abs(Levies.levyOf(st, son, summer) / Levies.levyOf(st, son) - 10 / 9.5) < 1e-9,
  "the summer's levy, by its row",
);
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
  assert.strictEqual(
    Levies.capacity(st, hh, holder, c),
    MATCH.day.horizon * (WORK[1] - WORK[0]),
    'the head: its working hours',
  );
  const worked = VB['sim/work'].workedToday(st, son, day);
  assert.ok(
    Math.abs(Levies.capacity(st, hh, p, c) - Math.max(0, Math.min(row - worked, dayLeft))) < 1e-9,
    'a member: its levy left',
  );
  const keep = st.workToday;
  st.workToday = { day, by: { [son]: 7 } };
  assert.ok(
    Math.abs(Levies.capacity(st, hh, p, c) - Math.min(2.5, dayLeft)) < 1e-9,
    "the household's work done today comes out of it",
  );
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
      cap =
        id === h.holder || id === sp ? MATCH.day.horizon * (WORK[1] - WORK[0]) : L === null ? 0 : L / handsOf(s, id);
    if (L === null && id !== h.holder && id !== sp) continue;
    assert.ok(given <= cap + 1e-6, `pawn ${id}: ${given.toFixed(2)} hours given, within ${cap.toFixed(2)}`);
  }
  assert.deepStrictEqual(checkState(s), [], 'invariants');
}
function handsOf(s, id) {
  const e = s.plans.households.get(s.pawns[id].household).levies.of[id];
  return e[1];
}

// 6. The work a household lives by is slotted first within the levy (Day.vitalFirst): the best pair of a vital task (the water), its
// member levied, goes before lesser work it fits better; a vital task the head pair fit best (the meal) keeps its place, and a vital
// task's further pairs theirs.
{
  const water = { id: 1, kind: 'water', claims: [] },
    cook = { id: 2, kind: 'cook', claims: [] },
    plow = { id: 3, kind: 'plow', claims: [] };
  const pairs = [
    [9, hh.holder, plow],
    [8, hh.holder, cook],
    [7, son, plow],
    [6, son, cook],
    [5, son, water],
    [4, hh.holder, water],
  ];
  Day.vitalFirst(st, hh, pairs);
  assert.deepStrictEqual(
    pairs.map(([s, id, j]) => [s, id === son ? 'son' : 'head', j.kind]),
    [
      [5, 'son', 'water'],
      [9, 'head', 'plow'],
      [8, 'head', 'cook'],
      [7, 'son', 'plow'],
      [6, 'son', 'cook'],
      [4, 'head', 'water'],
    ],
    "the son's water first; the head's meal and the rest in their order",
  );
}

// 7. Own hours, booked (VB-1761): at each leg's end its working hours, a clock hour times the pawn's hands, fall into one of six parts by
// who opened it and the levy left today. A constructed leg of each opening, on a levied member and on the head.
{
  const { emit } = VB['sim/events'],
    { TICKS } = VB['sim/rules'];
  const s = make(4.5),
    h = s.households[0],
    sp = spouseOf(s, h.holder),
    m = h.members.find((id) => id !== h.holder && id !== sp && age(s, s.pawns[id]) >= 14 && !s.pawns[id].retired);
  const day = Math.floor(s.t / DAY) + 2,
    at = (hour) => (day * DAY + hour) * TICKS,
    tick = s.tick,
    t0 = s.t;
  // a leg of pawn id from `from` to `to` (hours of the day), opened by `by`, ends: its hours booked into a scratch record
  const leg = (a, from, to, by) => {
    a.leg = { kind: 'work', t: at(from), ...(by ? { by } : {}) };
    s.tick = to < 24 ? at(to) : (day + 1) * DAY * TICKS + (to - 24) * TICKS;
    s.t = s.tick / TICKS;
    emit(s, 'legOver', a);
  };
  const son = { id: m, leg: null },
    head = { id: h.holder, leg: null };
  leg(son, 6, 6, 'head'); // the day's first booking begins its record at 06:00
  const r = son.book,
    L = r.levy,
    hands = r.hands;
  assert.ok(L > 0 && hands > 0, `the member is levied (${L}) and has hands (${hands})`);
  leg(son, 7, 10, 'owed'); // 06:00 to 07:00 in no leg: kept; then a day owed, out of the levy left
  assert.ok(Math.abs(r.p[4] - hands) < 1e-9 && Math.abs(r.p[0] - 3 * hands) < 1e-9, 'kept, then owed');
  leg(son, 10, 14, 'pawn'); // its own accord: levied within the levy left
  assert.ok(Math.abs(r.p[1] - 4 * hands) < 1e-9, 'its own accord within the levy: levied');
  const left = L - 7 * hands; // the levy left: the levy less owed and levied
  leg(son, 14, 17, 'head'); // the head's work across the levy line: two parts
  assert.ok(
    Math.abs(r.p[1] - (4 * hands + Math.min(left, 3 * hands))) < 1e-9,
    "the head's work: levied up to the levy left",
  );
  assert.ok(Math.abs(r.p[2] - Math.max(0, 3 * hands - left)) < 1e-9, 'and demanded past it');
  leg(son, 17, 30, 'pawn'); // past the levy, of its own accord: given; the night unbooked; the next day's 06:00 to 06:00 nothing
  assert.ok(Math.abs(r.p[3]) < 1e-9 && r.day === day + 1, 'the next day begun at 06:00');
  const closed = r.past[0];
  assert.strictEqual(closed[0], day, 'the day closed is in the days behind');
  assert.ok(Math.abs(closed[3 + 3] - hands) < 1e-9, 'its own accord past the levy: given, the night unbooked');
  const sum = closed.slice(3).reduce((x, y) => x + y, 0);
  assert.ok(Math.abs(sum - 12 * hands) < 1e-9, `the six parts sum to H = 12 × its hands (${sum})`);
  const T = s.plans.households.get(h.id).tally;
  assert.ok(
    T && Math.abs(T.of[m][0] - r.past[0][3 + 2]) < 1e-9 && Math.abs(T.of[m][2] - hands) < 1e-9,
    "the season's tally: demanded, given",
  );
  // the head: not levied, its household's work given, an outer day owed, a pastime kept
  leg(head, 6, 6, 'head');
  leg(head, 8, 12, 'head');
  leg(head, 12, 14, 'owed');
  leg(head, 14, 18, undefined);
  const g = head.book.p,
    hh2 = head.book.hands;
  assert.ok(
    Math.abs(g[3] - 4 * hh2) < 1e-9 && Math.abs(g[0] - 2 * hh2) < 1e-9 && Math.abs(g[4] - 6 * hh2) < 1e-9,
    'the head: given, owed, kept',
  );
  assert.ok(!T.of[h.holder], 'the head pair have no tally');
  // Sim.hours: the days behind exact, today's booked so far, a day ahead the levy only; sovereignty by right and as lived
  s.agents[m].book = son.book; // the scratch record read as the member's
  const H = Sim.hours(s, m, day, day + 3),
    [d0] = H;
  assert.deepStrictEqual(
    H.map((o) => o.state),
    ['past', 'today', 'ahead', 'ahead'],
    'past, today, ahead',
  );
  assert.strictEqual(d0.state, 'past', 'a past day');
  assert.ok(Math.abs(d0.right - (1 - L / (12 * hands))) < 1e-9, 'by right: 1 less the levy over H');
  assert.ok(
    Math.abs(d0.lived - (d0.demanded + d0.given + d0.kept) / d0.H) < 1e-9,
    'as lived: demanded, given and kept over H',
  );
  s.tick = tick;
  s.t = t0;
  // the season's end folds the tally into the year's count
  const later = cal((day + SEASON_DAYS) * DAY + WORK[0]),
    t2 = Levies.tallyOf(s, h, later);
  assert.ok(
    Object.keys(t2.of).length === 0 && Math.abs(t2.yearOf[m][2] - hands) < 1e-9,
    "folded into the year's count",
  );
}

// 8. On the run: every pawn-day closed sums to H (the invariant), and Sim.hours shows the six days behind and a day ahead.
{
  const s = make(8 * DAY),
    today = Math.floor(s.t / DAY),
    m = s.households[0].members.find((id) => Levies.levyOf(s, id) > 0);
  assert.deepStrictEqual(checkState(s), [], 'invariants: the six parts sum to H');
  const H = Sim.hours(s, m, today - 10, today + 1);
  assert.deepStrictEqual(
    H.map((o) => o.state),
    ['past', 'past', 'past', 'past', 'past', 'past', 'today', 'ahead'],
    'six days behind, today, a day ahead',
  );
  for (const o of H.slice(0, 6)) {
    const sum = VB['sim/levies'].PARTS.reduce((x, k) => x + o[k], 0);
    assert.ok(Math.abs(sum - o.H) < 1e-6 && o.H > 0, `day ${o.day}: the parts sum to H (${sum}, ${o.H})`);
  }
  assert.ok(
    H.slice(0, 6).some((o) => o.levied > 0),
    'levied hours are booked',
  );
  assert.ok(VB.count.hoursBook > 0, 'bookings counted');
}

// 9. (review of VB-1761) One levy line: a member compiled at lower health and healed since, booked under the head for exactly the
// allotment's capacity (the row's clock hours), has nothing demanded; a day read before the leg in progress ends shows what its end
// books; the run's legs carry who opened them, the planner's the head's.
{
  const { emit } = VB['sim/events'],
    { TICKS } = VB['sim/rules'];
  const s = make(4.5),
    h = s.households[0],
    sp = spouseOf(s, h.holder),
    m = h.members.find((id) => id !== h.holder && id !== sp && age(s, s.pawns[id]) >= 14 && !s.pawns[id].retired),
    p = s.pawns[m];
  const health = p.health;
  p.health = 60;
  s.plans.households.get(h.id).levies = undefined;
  Levies.levyOf(s, m); // compiled at health 60
  p.health = 100; // healed: the allotment's capacity is still the row's clock hours
  const row = s.plans.households.get(h.id).levies.of[m][0],
    day = Math.floor(s.t / DAY) + 2,
    at = (hour) => (day * DAY + hour) * TICKS,
    tick = s.tick,
    t0 = s.t;
  const end = (a, from, to, by) => {
    a.leg = { kind: 'work', t: at(from), by };
    s.tick = at(to);
    s.t = s.tick / TICKS;
    emit(s, 'legOver', a);
  };
  const a = { id: m, leg: null };
  end(a, 6, 6, 'head');
  end(a, 6, 6 + row, 'head');
  assert.ok(
    a.book.p[2] < 1e-9 && Math.abs(a.book.p[1] - row * a.book.hands) < 1e-9,
    `the capacity's hours all levied (${a.book.p})`,
  );
  // read before the leg in progress ends: the day shown is what its end books
  const real = s.agents[m],
    keep = [real.book, real.leg];
  real.book = a.book;
  real.leg = { kind: 'work', t: at(6 + row), by: 'head' };
  s.tick = (day + 1) * DAY * TICKS + WORK[0] * TICKS;
  s.t = s.tick / TICKS;
  const before = Sim.hours(s, m, day, day)[0];
  emit(s, 'legOver', real);
  const after = Sim.hours(s, m, day, day)[0];
  assert.deepStrictEqual(before, after, 'a past day read before the leg in progress ends is the day it books');
  [real.book, real.leg] = keep;
  s.tick = tick;
  s.t = t0;
  p.health = health;
}
{
  const s = make(2),
    seen = { head: 0, pawn: 0, owed: 0 };
  for (let k = 0; k < 4 * 24; k++) {
    Sim.advance(s, 1);
    for (const a of s.agents) {
      const l = a && a.leg,
        j = a && a.job;
      if (!l || l.kind === 'wait' || !j || !j.owner || (j.owner.type !== 'household' && j.owner.type !== 'village'))
        continue;
      const want = a.basis === 'owed' || a.basis === 'helper' ? 'owed' : a.opener === 'head' ? 'head' : 'pawn';
      assert.strictEqual(l.by, want, `pawn ${a.id}'s ${l.kind} leg of ${j.kind} carries who opened it`);
      seen[want]++;
    }
  }
  assert.ok(seen.head > 0, `the head's allotment opens legs (${JSON.stringify(seen)})`);
}

// 10. (VB-1779) Demand and take. The judgement: a member of middle diligence, neutral to its head, rested, complies with a demand of work
// at risk; one idle, resentful and wanting its hours takes a levied leg's. Hours demanded book goodwill the head owes the member, hours
// taken goodwill the member owes the head, a day's work 3 rations; taken hours are counted in the season's tally.
{
  const { emit } = VB['sim/events'],
    { TICKS } = VB['sim/rules'],
    Rel = VB['sim/relations'],
    { issue } = VB['sim/commands'];
  const s = make(4.5),
    h = s.households[0],
    sp = spouseOf(s, h.holder),
    m = h.members.find((id) => id !== h.holder && id !== sp && age(s, s.pawns[id]) >= 14 && !s.pawns[id].retired),
    p = s.pawns[m],
    meal = { kind: 'cook' };
  // the judgement read: diligence 0 and a wanting member, of a task merely open, takes; diligence 1 complies
  const L = Levies.GIVE;
  assert.ok(L.press === 0.4 && L.hold === 0.8 && Levies.DEMAND.weight === 2, 'the starting values');
  // goodwill: a leg of 4 hours past the levy demanded, a leg of 3 taken
  const row = Levies.levyOf(s, m) / 1,
    day = Math.floor(s.t / DAY) + 2,
    at = (hour) => (day * DAY + hour) * TICKS,
    tick = s.tick,
    t0 = s.t;
  const a = { id: m, leg: null };
  const end = (from, to, by) => {
    a.leg = { kind: 'work', t: at(from), by };
    s.tick = at(to);
    s.t = s.tick / TICKS;
    emit(s, 'legOver', a);
  };
  const g0 = Rel.balance(s, m, h.holder);
  end(6, 6, 'head');
  a.taking = at(9);
  end(6, 9, undefined); // a breach's hours: taken
  assert.ok(a.taking === undefined, 'the breach ends once booked past');
  assert.ok(Math.abs(a.book.p[5] - 3 * a.book.hands) < 1e-9, `three hours taken (${a.book.p})`);
  const hours = Math.ceil(row) + 4;
  end(9, Math.min(18, 9 + hours), 'head');
  const P = a.book.p;
  assert.ok(P[2] > 0, `hours past the levy demanded (${P})`);
  const owed = (P[2] - P[5]) * (3 / 8),
    g1 = Rel.balance(s, m, h.holder) + (a.book.gw || 0);
  assert.ok(
    Math.abs(g1 - g0 - owed) < 0.01,
    `goodwill (it decays as it stands): the head owes the hours demanded less those taken (${g1 - g0}, ${owed})`,
  );
  const tl = Levies.tallyOf(s, h, cal(day * DAY + WORK[0]));
  assert.ok(
    Math.abs(tl.of[m][1] - P[5]) < 1e-9 && tl.of[m][0] >= P[2] - 1e-9,
    `the tally counts taken and demanded (${tl.of[m]})`,
  );
  s.tick = tick;
  s.t = t0;
}
// 11. (VB-1779) assign past the levy left is a demand, named by its check before it is issued; issued with demand: true, it is an offer
// the member answers by its judgement, and at a yes the task is moved. breach: a levied member keeps hours of its levy, refused for the
// head pair. The default author's points: take for a levied member in the working day.
{
  const { issue } = VB['sim/commands'];
  const s = make(WORK[0] + 1.5),
    h = s.households.find((x) => x.members.filter((id) => Levies.levyOf(s, id) > 0).length >= 2) || s.households[0],
    day = s.plans.households.get(h.id).day,
    levied = h.members.filter((id) => Levies.levyOf(s, id) > 0 && day.lists[id] && day.lists[id].length);
  assert.ok(levied.length >= 2, 'two levied members');
  {
    const [x, y] = levied,
      given = (key) => day.lists[y].includes(key) && !(day.fits[y][day.lists[y].indexOf(key)] < 0),
      i = day.fits[x].findIndex((f, k) => f > 0 && day.hours[x][k] > 0 && !given(day.lists[x][k]));
    assert.ok(i >= 0, 'a task given hands to move');
    {
      const key = day.lists[x][i];
      day.free[y] = 0; // its levy left spent
      const cmd = { actor: h.holder, verb: 'assign', target: h.id, args: { key, from: x, to: y }, source: 'player' };
      const why = issue(s, cmd);
      assert.match(String(why), /is a demand: .* hours past pawn \d+'s levy left today/, 'named before it is issued');
      const made = VB.count.demandMade,
        yes0 = VB.count.demandMet,
        no0 = VB.count.demandRefused,
        r = issue(s, { ...cmd, args: { ...cmd.args, demand: true } });
      assert.strictEqual(r, true, 'a demand issued');
      assert.strictEqual(VB.count.demandMade, made + 1, 'a demand made');
      const met = s.plans.households.get(h.id).day.lists[y].includes(key);
      assert.ok(
        met ? VB.count.demandMet === yes0 + 1 : VB.count.demandRefused === no0 + 1,
        'answered at once: moved at a yes, a memory at a no',
      );
    }
    {
      // a call to a task on the member's own list is inside what the allotment gave it: no demand, even with its levy left spent (F2)
      const key = day.lists[x][0];
      day.free[x] = 0;
      const r = issue(s, { actor: h.holder, verb: 'call', target: h.id, args: { member: x, key }, source: 'player' });
      assert.ok(!/is a demand/.test(String(r)), `a call within the allotment is no demand (${r})`);
    }
  }
  const hp = h.holder;
  assert.match(
    String(issue(s, { actor: hp, verb: 'breach', args: {}, source: 'player' })),
    /owes no household hours/,
    'the head pair owe none',
  );
  const m = h.members.find((id) => Levies.levyOf(s, id) > 0 && age(s, s.pawns[id]) >= 14);
  assert.ok(m !== undefined && Levies.capacity(s, h, s.pawns[m], cal(s.t)) > 0, 'a levied member with levy left');
  {
    assert.ok(
      Sim.decisions(s, m).some((d) => d.point === 'take'),
      'a levied member may take hours of its levy',
    );
    assert.strictEqual(issue(s, { actor: m, verb: 'breach', args: { hours: 2 }, source: 'player' }), true, 'a breach');
    assert.ok(s.agents[m].taking > s.tick, 'keeping its hours');
    assert.ok(!Sim.decisions(s, m).some((d) => d.point === 'take'), 'not while it takes');
    Sim.advance(s, 3);
    assert.deepStrictEqual(checkState(s), [], 'invariants after a breach');
    const o = Sim.hours(s, m, Math.floor(s.t / DAY), Math.floor(s.t / DAY))[0];
    assert.ok(o.taken > 0, `the hours booked taken (${o.taken})`);
  }
}

// 12. (VB-1762) Own hours given by the pawn's judgement: of two sons alike but in diligence (0.8 and 0.2; their traits else the same),
// over a season with fields, the diligent one gives at least three times the hours of the idle one to the household's work of its own
// accord (its legs opened by the pawn), and what it gives past its levy is booked given.
let ownSeen = '';
{
  const { TICKS } = VB['sim/rules'],
    D = VB['sim/traits'].IDX.diligence;
  const s = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 3 }], { seed: 4 });
  Sim.advance(s, 4.5);
  const h = s.households[2],
    sp = spouseOf(s, h.holder),
    [x, y] = h.members.filter((id) => id !== h.holder && id !== sp && age(s, s.pawns[id]) >= 14);
  assert.ok(x !== undefined && y !== undefined, 'a household of two grown sons');
  s.pawns[y].traits = s.pawns[x].traits.slice();
  s.pawns[x].traits[D] = 0.8;
  s.pawns[y].traits[D] = 0.2;
  const own = { [x]: 0, [y]: 0 },
    given = { [x]: 0, [y]: 0 };
  const legs0 = VB.count.giveLeg;
  for (let d = 0; d < SEASON_DAYS - 1; d++) {
    // each step a son is in a leg of the household's work it opened itself counts a step given of its own accord
    for (let k = 0; k < DAY * TICKS; k++) {
      Sim.advance(s, 1 / TICKS);
      for (const id of [x, y]) {
        const l = s.agents[id].leg;
        if (l && l.by === 'pawn') own[id] += 1 / TICKS;
      }
    }
    const yd = Math.floor(s.t / DAY) - 1;
    for (const id of [x, y]) given[id] += Sim.hours(s, id, yd, yd)[0].given;
  }
  assert.ok(VB.count.giveLeg > legs0, 'legs given by judgement');
  assert.ok(
    own[x] >= 3 * own[y] && own[x] > 0,
    `the diligent son gives three times the idle one's hours (${own[x].toFixed(1)}, ${own[y].toFixed(1)})`,
  );
  assert.ok(
    given[x] > 0 && given[x] >= given[y],
    `hours past the levy booked given (${given[x].toFixed(1)}, ${given[y].toFixed(1)})`,
  );
  // explainIdle names the choice at a job of the idle son's list past its levy, levy left or not (review F1)
  const dy = s.plans.households.get(h.id).day,
    fy = (dy.fits && dy.fits[y]) || [],
    k = (dy.lists[y] || []).find((key, i) => fy[i] !== null && fy[i] < 0 && s.jobs.has(key));
  if (k !== undefined && !Levies.gives(s, h, s.pawns[y], s.jobs.get(k), true)) {
    const row = VB['sim/fit'].explainIdle(s, y).find((r) => r.job === k);
    assert.ok(
      !row || row.reason === 'its own hours: it gives none' || row.bid === null,
      `a job past the levy named as its own hours (${JSON.stringify(row)})`,
    );
  }
  {
    // constructed: a job of the idle son's list put past its levy while its levy has room, in the morning
    Sim.advance(s, 4);
    const f = s.farmsteads[h.farmstead];
    VB['sim/jobs'].post(s, `repair:h${h.id}:test`, 'repair', { type: 'household', id: h.id }, f.house, {});
    const j = s.jobs.get(`repair:h${h.id}:test`),
      dy = s.plans.households.get(h.id).day;
    assert.ok(
      VB['sim/fit'].explainIdle(s, y).some((r) => r.job === j.key && r.bid !== null),
      'the idle son would bid for the repair',
    );
    {
      assert.ok(Levies.capacity(s, h, s.pawns[y], cal(s.t)) > 0, 'its levy has room');
      const save = [dy.lists[y], dy.fits[y], dy.hours[y]];
      [dy.lists[y], dy.fits[y], dy.hours[y]] = [[j.key], [-1], [0]];
      s.pawns[y].traits[D] = 0;
      const row = VB['sim/fit'].explainIdle(s, y).find((r) => r.job === j.key);
      assert.ok(!Levies.gives(s, h, s.pawns[y], j, true), 'an idle son gives nothing to it');
      assert.strictEqual(row.reason, 'its own hours: it gives none', 'named past the levy with levy left');
      s.pawns[y].traits[D] = 0.2;
      [dy.lists[y], dy.fits[y], dy.hours[y]] = save;
    }
  }
  assert.deepStrictEqual(checkState(s), [], 'invariants after a season of own hours');
  ownSeen = `${own[x].toFixed(0)} hours against ${own[y].toFixed(0)}, ${given[x].toFixed(0)} of them past the levy`;
}

// 9. The labour budget (VB-1778; design.md section 7, The labour budget, A season that does not fit): a household's budget for a season
// is its members' levies over the season's days (the head pair at the adult row times their hands: the plan is theirs), by its three
// game weeks, less the outer levies' days; reckoned at its first review and again when the members change. A season that fits is left
// alone; one whose steps' hours left exceed it is flagged at its first review and answered in design.md's order: help asked in the short
// step's window and a servant at the moving round, then the target whose hours buy least lowered, then the rest demanded; a line said.
let fitSeen = '';
{
  const s = make(30);
  const c = cal(s.t),
    h = s.households[0],
    plan = s.plans.households.get(h.id),
    B = plan.budget,
    review = () => VB['sim/plans'].reviewed(s, plan, cal(s.t), 'store');
  assert.ok(B && B.at === c.year * 4 + c.season && B.weeks.length === 3, 'the budget is reckoned at the first review');
  let a = 0;
  for (const id of h.members) {
    const p = s.pawns[id],
      l = Levies.levyOf(s, id);
    if (p.died !== null) continue;
    if (l !== null) a += l;
    else if (id === h.holder || spouseOf(s, h.holder) === id)
      a += levyNorm(s, 'adult', c.season, 0) * plan.levies.of[id][1];
  }
  assert.ok(
    Math.abs(B.total - a * (SEASON_DAYS - B.from)) < 1e-6,
    `the budget: the levies over the season's days (${B.total}, ${a})`,
  );
  assert.ok(
    plan.fit && plan.fit.short === 0 && !plan.fit.help && !plan.fit.lowered,
    'a season that fits is left alone',
  );
  assert.strictEqual(s.record.filter((e) => e.kind === 'seasonShort').length, 0, 'nothing said of a season that fits');
  const n = VB.count.budgetReckoned;
  review();
  assert.ok(plan.budget === B && VB.count.budgetReckoned === n, 'reviewed again: nothing reckoned again');
  // a member gone: the budget is reckoned again, lower
  const gone = h.members.find((id) => Levies.levyOf(s, id) > 0),
    save = h.members.slice();
  h.members = h.members.filter((id) => id !== gone);
  review();
  assert.ok(plan.budget.total < B.total - 1e-9 && VB.count.budgetReckoned === n + 1, 'a member gone: reckoned again');
  h.members = save;
  review();
  // an outer levy's days come off the budget in its window once asked (VB-1767), and leave it with the levy
  {
    const O = VB['sim/obligations'],
      { OUTER: OU, TERMS: TE } = VB['sim/days'],
      cr = s.households.find((x) => x !== h && !x.dissolved),
      B0 = plan.budget,
      first = c.day - c.sday;
    const id = O.create(s, {
      kind: 'days',
      source: 'debt',
      debtor: { kind: 'household', id: h.id },
      creditor: { kind: 'household', id: cr.id },
      owes: { days: 4 },
      terms: TE.debt,
    });
    review();
    assert.ok(plan.budget.outer === 0 && plan.budget.total === B0.total, 'not asked: not charged to the season');
    O.setLevy(s, id, { window: [first + B0.from, first + SEASON_DAYS - 1], asked: 2 });
    review();
    assert.ok(
      plan.budget.outer === 2 && Math.abs(B0.total - plan.budget.total - 2 * OU.hours) < 1e-6,
      `the days asked come off the budget (${plan.budget.outer}, ${B0.total} -> ${plan.budget.total})`,
    );
    O.forgive(s, id, cr.holder);
    assert.ok(!O.due(s, { kind: 'household', id: h.id }, 'debtor', 'days').length, 'closed: out of the live index');
    review();
    assert.ok(plan.budget.outer === 0 && plan.budget.total === B0.total, 'and off the budget');
  }
  // the season made not to fit: the head reckons it can place a great deal of tar (sim/asks), more than its people owe the season
  plan.placed = { year: c.year, goods: { tar: Math.ceil(plan.budget.total / KINDS.burntar.hours) * 2 }, heard: [] };
  delete plan.fit;
  review();
  const F = plan.fit,
    tar = plan.season.find((x) => x.what.target && x.what.target.good === 'tar');
  assert.ok(F.short > 0 && F.at === c.year * 4 + c.season, `flagged short at its first review (${F.short})`);
  assert.strictEqual(F.servant, c.year, "a servant wanted at this year's moving round");
  assert.ok(
    F.lowered.tar > 0 && tar.what.target.level < plan.placed.goods.tar,
    `the tar, whose hours buy least, lowered (${JSON.stringify(F)})`,
  );
  assert.ok(F.demand >= 0 && F.demand < F.short, `the rest demanded (${F.demand} of ${F.short})`);
  const told = s.record.filter((e) => e.kind === 'seasonShort');
  assert.ok(told.length === 1 && /lowered its target of tar/.test(told[0].text), told.map((e) => e.text).join());
  // the next review of the season judges nothing again, and the lowering stands
  const m = VB.count.fitJudged,
    level = tar.what.target.level;
  review();
  assert.ok(
    VB.count.fitJudged === m && Math.abs(tar.what.target.level - level) < 1e-9,
    'judged once a season; the lowering stands',
  );
  // help in the sowing window, where the sowing is short: its planned hours asked in the morning, spread over the window's days
  assert.ok(
    F.help.reduce((x, r) => x + r[4], 0) <= F.short + 1e-9,
    `the help planned is at most the shortfall (${JSON.stringify(F.help)}, ${F.short})`,
  );
  const sow = plan.season.find((x) => x.what.routine === 'sow'),
    sowLeft = sow.left;
  F.help = [[sow.id, 'sow', c.day, c.day + 3, 40]];
  sow.left = { lo: 40, mid: 40, hi: 40 };
  assert.ok(
    Math.abs(VB['sim/hands'].plannedHelp(s, h, cal(s.t)) - 10) < 1e-9,
    'help planned: 40 hours over four days, 10 today',
  );
  // the sowing done within its window (review F2): no help asked for work that no longer exists
  sow.left = { lo: 0, mid: 0, hi: 0 };
  assert.strictEqual(VB['sim/hands'].plannedHelp(s, h, cal(s.t)), 0, 'a step with no hours left asks no planned help');
  sow.left = sowLeft;
  // one reckoning of a field's yield (review F1): the fit's bar for lowering a field target (sim/levies yieldOf) and the head's demand
  // for a field step (sim/day atRisk) both read sim/estimate fieldYield, FIELDS.expect of the crop's yield
  assert.ok(
    Math.abs(
      VB['sim/estimate'].fieldYield('barley') - VB['sim/rules'].FIELDS.expect * VB['sim/crops'].CROPS.barley.yield,
    ) < 1e-9,
    "a field's yield a year: FIELDS.expect of its crop's, one reckoning",
  );
  assert.deepStrictEqual(checkState(s), [], 'invariants with a season that does not fit');
  assert.ok(
    Sim.plans(s, { kind: 'household', id: h.id }).fit.short > 0,
    'Sim.plans reads the budget and the fit beside the steps',
  );
  fitSeen = `; the labour budget ${Math.round(B.total)} hours, a season ${Math.round(F.short)} hours short answered`;
}

// 10. The season's daily routines in its hours left (VB-1906): the meal, the water, the milking and the fodder count their work on each
// day of the season left by the head's estimate, so a household whose targets fit but whose daily work with them does not is flagged at
// its first review.
{
  const s = make(30);
  const c = cal(s.t),
    h = s.households[0],
    plan = s.plans.households.get(h.id),
    days = plan.season[0].by - c.day,
    daily = (x) => !!(x.what.routine && KINDS[x.what.routine].daily),
    sum = (f) => plan.season.filter(f).reduce((a, x) => a + (x.left ? x.left.mid : 0), 0),
    review = () => VB['sim/plans'].reviewed(s, plan, cal(s.t), 'store');
  const cook = plan.season.find((x) => x.what.routine === 'cook'),
    water = plan.season.find((x) => x.what.routine === 'water'),
    W = VB['sim/water'].waterOf(s, s.farmsteads[h.farmstead]);
  // the meal's left: the head's estimate of each day's meal left, today's counted once (its open task's, else a day of the kind's
  // hours where the meal is not yet cooked: review F1, a first review before the meal is posted)
  {
    const E = VB['sim/estimate'],
      head = plan.head.pawn,
      job = (hours) => ({ kind: 'cook', hours, done: 0, rate: 0, owner: { type: 'household', id: h.id }, claims: [] }),
      open = [...(s.jobsBy.get(`household:${h.id}`) || [])].filter((j) => j.step === cook.id),
      n = days + (open.length || h.cookDay === c.day ? 0 : 1),
      want =
        open.reduce((a, j) => a + E.estimate(s, head, j).mid, 0) + E.estimate(s, head, job(n * KINDS.cook.hours)).mid;
    assert.ok(
      days > 0 && Math.abs(cook.left.mid - want) < 1e-6,
      `the meal's hours left each day (${cook.left.mid}, ${want})`,
    );
    // the same review with no meal standing nor cooked today: today's meal counted (F1)
    const saved = s.jobsBy.get(`household:${h.id}`),
      was = h.cookDay;
    s.jobsBy.set(`household:${h.id}`, new Set([...(saved || [])].filter((j) => j.step !== cook.id)));
    h.cookDay = -1;
    review();
    const all = E.estimate(s, head, job((days + 1) * KINDS.cook.hours)).mid;
    assert.ok(
      Math.abs(cook.left.mid - all) < 1e-6,
      `before the meal is posted, today's counted (${cook.left.mid}, ${all})`,
    );
    if (saved) s.jobsBy.set(`household:${h.id}`, saved);
    else s.jobsBy.delete(`household:${h.id}`);
    h.cookDay = was;
    review();
  }
  assert.ok(water.left.mid >= W.hours * days - 1e-9, `the water's fetch each day left (${water.left.mid}, ${W.hours})`);
  assert.ok(plan.fit && plan.fit.short === 0, 'its season, daily work and all, fits');
  // tar placed to fill the budget but for half the daily work: its targets fit, and the daily work with them does not
  const D = sum(daily),
    T = sum((x) => !daily(x));
  plan.placed = { year: c.year, goods: { tar: 10 }, heard: [] };
  review();
  const tar = plan.season.find((x) => x.what.target && x.what.target.good === 'tar'),
    per = tar.left.mid / 10; // the head's hours a barrel of tar
  // the fit judged once a season: raised barrel by barrel (each review reckons the hours left again) until the targets alone come
  // within the daily work of the budget, then judged afresh
  let n = Math.floor((plan.budget.total - T - D) / per),
    T2 = 0;
  for (; n < 1000; n++) {
    plan.placed.goods.tar = n;
    review();
    T2 = sum((x) => !daily(x));
    if (T2 + sum(daily) > plan.budget.total) break;
  }
  delete plan.fit;
  review();
  assert.ok(
    D > 0 && T2 <= plan.budget.total,
    `the targets alone fit (${Math.round(T2)} of ${Math.round(plan.budget.total)})`,
  );
  assert.ok(
    plan.fit.short > 0 && sum(daily) + T2 > plan.budget.total,
    `with the daily work it does not: flagged at its first review (${Math.round(plan.fit.short)} short, ${Math.round(D)} daily, ${tar.what.target.level} tar)`,
  );
  assert.strictEqual(s.record.filter((e) => e.kind === 'seasonShort').length, 1, 'and said');
  assert.deepStrictEqual(checkState(s), [], 'invariants with the daily work counted');
  fitSeen += `; the daily work ${Math.round(D)} hours of the season counted`;
}

// Outer levies (VB-462, VB-1767; design.md, Outer levies): the verb levy lays a levy with its source's terms; its levier's default author
// asks its days by season (a debt a quarter); the levied head names them at three days' notice through the verb name (its default author
// the day that displaces least, a head on its own commands only once the window runs short); the one sent works the levier's tasks on
// the basis `owed`, each hour booked against the levy; a day that cannot be kept as named goes up the ladder (VB-1769); at the term's end a debt's days stand and the keep's lapse, told once; a due laid on a village adds
// lots to its households' levies; Sim.levies reads them. On a small constructed state: two farms on open ground.
{
  const { eligible } = VB['sim/eligibility'],
    Jobs = VB['sim/jobs'],
    O = VB['sim/obligations'],
    { issue } = VB['sim/commands'],
    { emit } = VB['sim/events'];
  const { OUTER, TERMS } = VB['sim/days'];
  const st = tinyState(tinyWorld(Array(20).fill('.'.repeat(36))), [{ at: [8, 10], farms: 2, sizes: [4, 4] }], {
    seed: 4,
  });
  Sim.advance(st, 3);
  const [A, B] = [st.households[0], st.households[1]],
    fA = st.farmsteads[A.farmstead],
    fB = st.farmsteads[B.farmstead];
  const dropAll = (key) => {
    for (const j of [...(st.jobsBy.get(key) || [])]) {
      st.jobs.delete(j.key);
      st.jobsBy.get(key).delete(j);
    }
  };
  const quiet = () => {
    for (const h of [A, B]) {
      dropAll(`household:${h.id}`);
      h.waterDay = Sim.cal(st.t).day;
    }
    dropAll(`village:${fA.village}`);
  };
  const adults = (hh) => hh.members.filter((id) => st.pawns[id].alive && age(st, st.pawns[id]) >= MATCH.help.minAge);
  const hand = adults(B)[0],
    today = () => Math.floor(st.t / DAY);
  quiet();
  const fd = fA.fields[0];
  fd.stage = 'stubble';
  const post = () => {
    const j = Jobs.post(st, `plow:f${fA.id}.${fd.id}`, 'plow', { type: 'household', id: A.id }, fd.tile, {
      field: fd,
      farm: fA,
    });
    j.hours = 60;
    return j;
  };
  let j = post();
  A.grain = { barley: 4000 };
  B.grain = { barley: 4000 };
  const lay = (actor, args) => issue(st, { actor, verb: 'levy', args, source: 'player' });
  const toB = { kind: 'household', id: B.id };
  assert.ok(
    /only the one who acts/.test(lay(hand, { creditor: { kind: 'household', id: A.id }, debtor: toB, source: 'debt', days: 2 })),
    "only the levier's agent lays a levy",
  );
  assert.ok(
    /names its source/.test(lay(A.holder, { debtor: toB, source: 'tithe', days: 2 })),
    'a levy has a source of the table',
  );
  assert.ok(
    /does not levy itself/.test(lay(A.holder, { debtor: { kind: 'household', id: A.id }, source: 'debt', days: 2 })),
  );
  assert.strictEqual(lay(A.holder, { debtor: toB, source: 'debt', days: 2 }), true, "the verb levy lays a debt's days");
  const oid = st.obligations.length - 1,
    o = st.obligations[oid];
  assert.deepStrictEqual([o.kind, o.source, o.debtor, o.creditor.id, o.owes.days], ['days', 'debt', toB, A.id, 2]);
  assert.deepStrictEqual(
    o.terms,
    TERMS.debt,
    "the source's terms: the levied names, a substitute, commuted at OUTER.worth, no carry",
  );
  assert.deepStrictEqual(
    [o.terms.names, o.terms.commute, o.window, o.asked, o.named, o.worked],
    ['levied', OUTER.worth, null, 0, [], 0],
  );
  const nm = (actor, args) => issue(st, { actor, verb: 'name', target: oid, args, source: 'player' });
  assert.ok(/asked/.test(nm(B.holder, { day: today() + 5 })), 'nothing is named before its levier asks');
  // the levier's default author asks at its season's turn: a debt a quarter of its days, in the season's window
  emit(st, 'seasonJudged', { hh: A, c: Sim.cal(st.t) });
  const c0 = Sim.cal(st.t);
  assert.deepStrictEqual(
    [o.asked, o.window],
    [1, [c0.day, c0.day - c0.sday + VB['sim/rules'].SEASON_DAYS - 1]],
    'a quarter of the days, this season',
  );
  // the levied head names: three days ahead at least, within the window, only the head of the household levied
  assert.ok(
    /at least 3 days ahead/.test(nm(B.holder, { day: today() + 1, pawn: hand })),
    'a day is named three days ahead at least',
  );
  assert.ok(/levied head/.test(nm(A.holder, { day: today() + 3 })), 'the levied head names, not the levier');
  assert.ok(/outside/.test(nm(B.holder, { day: o.window[1] + 1 })), 'within the window');
  const D = today() + OUTER.notice;
  assert.strictEqual(nm(B.holder, { day: D, pawn: hand }), true, 'a day is named');
  assert.ok(/named already/.test(nm(B.holder, { day: D + 1 })), 'no more days than asked');
  assert.deepStrictEqual(o.named, [{ day: D, pawn: hand }]);
  assert.deepStrictEqual(
    checkState(st).filter((b) => /obligation|days/.test(b)),
    [],
  );
  // Sim.levies: what a body lays and bears, with the terms, through the actor view
  const seen = Sim.levies(st, toB);
  assert.ok(
    seen.bears.some((x) => x.id === oid && x.terms.names === 'levied' && x.named.length === 1) && !seen.lays.length,
  );
  assert.ok(
    Sim.levies(st, { kind: 'household', id: A.id }).lays.some((x) => x.id === oid),
    'and the levier lays it',
  );
  // the hand is on duty only on the day, and takes tasks of the levier's plan only
  const p = st.pawns[hand];
  assert.strictEqual(eligible(st, j, p), null, 'not before the day');
  while (today() < D) {
    Sim.advance(st, 1);
    quiet();
    if (!st.jobs.has(j.key)) j = post();
  }
  Sim.advance(st, 0.2);
  assert.strictEqual(st.daysToday.day, D);
  assert.deepStrictEqual(o.named, [], 'the day come, it leaves the days named');
  assert.strictEqual(eligible(st, j, p), 'owed', "on duty: the levier's tasks, on the basis owed");
  const mine = Jobs.post(
    st,
    `plow:f${fB.id}.${fB.fields[0].id}`,
    'plow',
    { type: 'household', id: B.id },
    fB.fields[0].tile,
    {
      field: fB.fields[0],
      farm: fB,
    },
  );
  assert.strictEqual(eligible(st, mine, p), null, "and not its own household's");
  st.jobs.delete(mine.key);
  st.jobsBy.get(`household:${B.id}`).delete(mine);
  const others = () => {
    for (const q of [...(st.jobsBy.get(`household:${A.id}`) || [])])
      if (q !== j && q.kind === 'plow') {
        st.jobs.delete(q.key);
        st.jobsBy.get(`household:${A.id}`).delete(q);
      }
  };
  while (st.t < D * DAY + 12) {
    Sim.advance(st, 0.5);
    dropAll(`household:${B.id}`);
    others();
    B.waterDay = Sim.cal(st.t).day;
  }
  const a = st.agents[hand];
  assert.ok(
    a.job === j && a.basis === 'owed',
    `at noon it works the levier's field (job ${a.job && a.job.key}, ${a.basis})`,
  );
  while (st.t < D * DAY + 23) {
    Sim.advance(st, 0.5);
    dropAll(`household:${B.id}`);
    B.waterDay = Sim.cal(st.t).day;
  }
  assert.ok(o.delivered > 0.3 && o.delivered <= 1 + 1e-9, `the day worked comes out of the levy (${o.delivered})`);
  assert.ok(
    Math.abs(o.worked - o.delivered) < 1e-9 && o.asked <= 1 - o.delivered + 1e-9,
    `booked as days worked (${o.worked}, asked ${o.asked})`,
  );
  assert.ok(fd.hoursOther >= o.delivered * OUTER.hours - 1e-6, `booked as others' hours (${fd.hoursOther})`);
  assert.ok(!a.job && st.daysToday.by[hand][1] <= OUTER.hours + 1e-9, "home at night, no more than the day's hours");
  // the default author: a levy of a household whose head is not on its own commands is named at the next day's first step, each day
  // at the notice or after, never two on one day
  const lay2 = () => {
    lay(A.holder, {
      debtor: toB,
      source: 'due',
      days: 3,
      window: [today() + 1, today() + 12],
      terms: { names: 'levied' },
    });
    return st.obligations[st.obligations.length - 1];
  };
  const o2 = lay2();
  assert.deepStrictEqual(
    [o2.asked, o2.terms.substitute, o2.terms.carry],
    [3, false, true],
    "a due's terms, the window's days asked",
  );
  Sim.advance(st, 1);
  assert.strictEqual(o2.named.length, 3, 'named by the default author');
  assert.ok(
    o2.named.every((e, i) => e.day >= o2.window[0] && e.day <= o2.window[1] && (!i || e.day > o2.named[i - 1].day)),
  );
  assert.ok(
    o2.named.every((e) => e.pawn !== null && B.members.includes(e.pawn)),
    'each with the adult sent',
  );
  O.forgive(st, o2.id, A.holder);
  assert.deepStrictEqual(o2.named, [], 'closed, its days named go with it');
  // a head on its own commands names its days itself; its default author only once the window has no more days than those unnamed and
  // the notice
  const head = st.pawns[B.holder],
    ctl = head.control;
  head.control = { auto: false, queue: [] };
  const o3 = lay2();
  Sim.advance(st, 1);
  assert.strictEqual(o3.named.length, 0, 'the head on its own commands: not named for it');
  while (o3.window[1] - today() + 1 > 3 + OUTER.notice) Sim.advance(st, 1);
  Sim.advance(st, 0.1);
  assert.strictEqual(o3.named.length, 3, 'named by its default author when the window runs short');
  head.control = ctl;
  O.forgive(st, o3.id, A.holder);
  // The ladder before a breach (VB-1769; design.md, Outer levies, The terms, the ladder and the breach): on a day named, the levied
  // head's default author keeps it where the one named can come and keeping it costs no more than its worth (K, sim/levies costOf); else
  // (1) another adult, (2) another day, (3) a release asked of the levier's agent, (4) the day commuted, (5) a breach when K > B. Its own
  // harvest waiting no longer holds a hand back by itself (sim/days' sendsNone gave way to this judgement: the test of it is replaced on
  // purpose). Each case on a levy constructed here, judged at once (Levies.keepDay, as the day's first step does).
  const { OUTER: OU2 } = Levies;
  const { balance } = VB['sim/relations'];
  const lady = adults(A).find((id) => id !== A.holder) ?? A.holder,
    bAdults = adults(B),
    other = bAdults.find((id) => id !== hand);
  const construct = (source, terms, pawn) => {
    lay(A.holder, { debtor: toB, source, days: 5, terms });
    const L = st.obligations[st.obligations.length - 1];
    O.setLevy(st, L.id, { window: [today(), today() + 20], asked: 5, named: [{ day: today(), pawn }] });
    return L;
  };
  const judge = (L) => Levies.keepDay(st, L, L.named[0], {});
  // a day whose one named can come and costs nothing to keep is kept as named
  let L = construct('debt', {}, hand);
  judge(L);
  assert.deepStrictEqual(L.named, [{ day: today(), pawn: hand }], 'kept as named');
  assert.strictEqual(Levies.costOf(st, B, today(), hand), 0, 'nothing of its windowed work displaced: K is 0');
  // (1) the one named cannot come (ill): another adult is sent
  st.pawns[hand].ill = true;
  judge(L);
  delete st.pawns[hand].ill;
  if (other !== undefined)
    assert.ok(
      L.named.length === 1 && L.named[0].pawn !== hand && bAdults.includes(L.named[0].pawn),
      `substituted (${JSON.stringify(L.named)})`,
    );
  O.forgive(st, L.id, A.holder);
  // (2) no other may be sent: another day of the window, at the notice
  L = construct('debt', { substitute: false }, lady);
  judge(L);
  assert.ok(
    L.named.length === 1 && L.named[0].day >= today() + OU2.notice && B.members.includes(L.named[0].pawn),
    `named another day (${JSON.stringify(L.named)})`,
  );
  O.forgive(st, L.id, A.holder);
  // (3) the levier names the day: a release is asked, and granted by the agent's rule (K × (1 + o) > W + G), booked as its goodwill
  const g0 = balance(st, A.holder, B.holder);
  L = construct('debt', { substitute: false, names: 'levier' }, lady);
  judge(L);
  assert.ok(
    O.left(L) === 4 && !L.named.length,
    `released: a day struck (${O.left(L)}, ${JSON.stringify(L.named)})`,
  );
  assert.ok(Math.abs(balance(st, A.holder, B.holder) - g0 - OU2.worth) < 1e-6, "the grant booked as the agent's goodwill");
  O.forgive(st, L.id, A.holder);
  // (4) the agent on its own commands: the ask stays open for it; the day is commuted at the terms' rate, from the store to the levier's
  const agentCtl = st.pawns[A.holder].control;
  st.pawns[A.holder].control = { auto: false, queue: [] };
  L = construct('debt', { substitute: false, names: 'levier' }, lady);
  const gA = VB['sim/stores'].grainOf(A),
    gB = VB['sim/stores'].grainOf(B);
  judge(L);
  assert.ok(
    O.left(L) === 4 && L.worked === 0 && !L.named.length,
    `commuted: paid, not worked (${O.left(L)}, ${L.worked})`,
  );
  assert.ok(
    Math.abs(VB['sim/stores'].grainOf(B) - gB + OU2.worth) < 1e-6 && VB['sim/stores'].grainOf(A) <= gA + 1e-6,
    `the rate's rations set aside at the levied's house, the levier's to fetch: nothing teleports (review F2): ${gB} -> ${VB['sim/stores'].grainOf(B)}, ${gA} -> ${VB['sim/stores'].grainOf(A)}`,
  );
  assert.ok(
    st.offers.some((x) => x.basis === 'release' && x.wants.levy === L.id),
    'the ask for release open for the agent to answer',
  );
  assert.ok(
    Sim.decisions(st, A.holder).some((x) => x.point === 'ask' && x.basis === 'release'),
    'a decision point of the agent',
  );
  O.forgive(st, L.id, A.holder);
  // (5) nothing to commute at: breached, K > B; a debt's day stays owed, its worth owed as goodwill, the agent to answer it
  const g1 = balance(st, A.holder, B.holder),
    r1 = st.record.length;
  L = construct('debt', { substitute: false, names: 'levier', commute: null }, lady);
  judge(L);
  assert.ok(O.left(L) === 5 && !L.named.length && L.breaches.length === 1, `breached, still owed (${O.left(L)})`);
  assert.ok(Math.abs(balance(st, A.holder, B.holder) - g1 - OU2.worth) < 1e-6, "the day's worth owed to the agent");
  assert.ok(
    st.record.slice(r1).some((e) => /kept back the day of debt/.test(e.text || '')),
    'told in the record with K and B',
  );
  assert.ok(
    Sim.decisions(st, A.holder).some((x) => x.point === 'breach' && x.levy === L.id),
    'a breach to answer: a decision point of the agent',
  );
  assert.ok(/no breach/.test(issue(st, { actor: A.holder, verb: 'forgive', target: L.id, args: { day: today() + 1 }, source: 'player' })));
  assert.strictEqual(
    issue(st, { actor: A.holder, verb: 'forgive', target: L.id, args: { day: today() }, source: 'player' }),
    true,
  );
  assert.ok(
    Math.abs(balance(st, A.holder, B.holder) - g1) < 1e-6 && !L.breaches.length && O.left(L) === 5,
    'forgiven: the goodwill struck, the day still owed',
  );
  O.forgive(st, L.id, A.holder);
  st.pawns[A.holder].control = agentCtl;
  // any other source's breached day is struck
  st.pawns[A.holder].control = { auto: false, queue: [] };
  L = construct('keep', { substitute: false, names: 'levier', commute: null }, lady);
  judge(L);
  assert.ok(O.left(L) === 4 && L.breaches.length === 1, `the keep's day struck by the breach (${O.left(L)})`);
  O.forgive(st, L.id, A.holder);
  // the checks say why not
  L = construct('due', {}, hand);
  const verb = (actor, v, args) => issue(st, { actor, verb: v, target: L.id, args, source: 'player' });
  assert.ok(/no other/.test(verb(B.holder, 'substitute', { day: today(), pawn: other ?? hand })), 'a due sends the one named');
  assert.ok(/not goods/.test(verb(B.holder, 'commute', { day: today() })), 'a due is not commuted');
  assert.ok(/levied head/.test(verb(A.holder, 'commute', { day: today() })));
  assert.ok(/levier answers/.test(verb(B.holder, 'release', { day: today() })), 'only its agent releases');
  assert.ok(/another household/.test(verb(A.holder, 'transfer', { day: today(), to: B.id })));
  O.forgive(st, L.id, A.holder);
  // the agent may lend the day to a household that asked for hands instead (transfer): a levy of one day of its own, named that day
  L = construct('keep', {}, hand);
  assert.ok(/within the village|another household/.test(verb(A.holder, 'transfer', { day: today(), to: A.id })));
  O.forgive(st, L.id, A.holder);
  st.pawns[A.holder].control = agentCtl;
  // the fall of breaches as the consequence grows (Q11, in the test only): K forced between the day's worth and B by windowed work of
  // the household's own, a heavier term (OUTER.breach) forced on a constructed levy each time
  const fB0 = fB.fields[0],
    was0 = [fB0.stage, fB0.crop];
  fB0.stage = 'ripe';
  fB0.crop = 'barley';
  const reaps = [];
  const postReap = (k, hours) => {
    const r = Jobs.post(st, `reap:f${fB.id}.q${k}`, 'reap', { type: 'household', id: B.id }, fB0.tile, { field: fB0, farm: fB });
    r.hours = hours;
    reaps.push(r);
    return r;
  };
  const first = postReap(0, 1e6),
    k1 = Levies.costOf(st, B, today(), hand);
  if (k1 > 0) {
    // each saturated task adds k1 × 1e6 / its hours; enough of them that K sits near 7.5 rations, between the keep's B of 6 and 9
    const H = 1e6,
      n = Math.max(1, Math.round(7.5 / k1));
    for (let k = 1; k < n; k++) postReap(k, H);
    const K = Levies.costOf(st, B, today(), hand);
    const breaches = [];
    st.pawns[A.holder].control = { auto: false, queue: [] };
    for (const w of [1, 2, 3, 4]) {
      OU2.breach = w;
      L = construct('keep', { substitute: false, names: 'levier', commute: null }, hand);
      judge(L);
      breaches.push(L.breaches.length);
      O.forgive(st, L.id, A.holder);
    }
    OU2.breach = 2;
    st.pawns[A.holder].control = agentCtl;
    assert.ok(
      breaches.every((b, i) => !i || b <= breaches[i - 1]) && breaches[0] > breaches[3],
      `breaches fall as B grows (K ${K.toFixed(2)}: ${breaches})`,
    );
    ladderSeen = ` (K ${K.toFixed(1)}: breaches ${breaches.join(', ')} as B is 3, 6, 9, 12)`;
  }
  for (const r of reaps) {
    st.jobs.delete(r.key);
    st.jobsBy.get(`household:${B.id}`).delete(r);
  }
  [fB0.stage, fB0.crop] = was0;
  void first;
  // a debt's days left on the last day of its year are laid again as a new year's levy
  lay(A.holder, { debtor: toB, source: 'debt', days: 3, due: (today() + 2) * DAY + 10 });
  const od = st.obligations[st.obligations.length - 1];
  Sim.advance(st, 3 * DAY);
  const nd = st.obligations[st.obligations.length - 1];
  assert.ok(
    od.status === 'lapsed' && nd !== od && nd.source === 'debt' && O.left(nd) === 3 && nd.due === od.due + VB['sim/rules'].YEAR_DAYS * DAY,
    `relaid for a new year (${od.status}, ${nd.source} ${O.left(nd)})`,
  );
  O.forgive(st, nd.id, A.holder);
  // a day of a debt lent (transfer) is not a debt to the household it is lent to: on its day, its last, it is sent, not relaid (review F1)
  const nLent = st.obligations.length,
    lent = st.obligations[
      O.create(st, {
        kind: 'days',
        debtor: toB,
        creditor: { kind: 'household', id: A.id },
        owes: { days: 1 },
        due: (today() + 2) * DAY,
        source: 'debt',
        terms: { ...TERMS.debt, carry: false, lent: true },
        window: [today() + 1, today() + 1],
      })
    ];
  O.setLevy(st, lent.id, { named: [{ day: today() + 1, pawn: hand }] });
  while (today() < lent.window[0]) Sim.advance(st, 1);
  Sim.advance(st, 0.2);
  assert.ok(
    st.obligations.length === nLent + 1 && (st.daysToday.by[hand] || [])[0] === lent.id,
    `the lent day sent, no debt relaid (${st.obligations.length - nLent}, ${JSON.stringify(st.daysToday.by[hand])})`,
  );
  while (st.t < lent.due + 1) Sim.advance(st, 1);
  assert.ok(lent.status === 'met' || lent.status === 'lapsed', `and it ends with its day (${lent.status})`);
  assert.deepStrictEqual(
    checkState(st).filter((b) => /obligation|days/.test(b)),
    [],
  );
  // a term's end: a debt's days stand, the keep's lapse, told once
  const mk = (source) => {
    lay(A.holder, { debtor: toB, source, days: 4, due: st.t + 2 });
    return st.obligations.length - 1;
  };
  const debt = mk('debt'),
    keep = mk('keep');
  const n0 = st.record.length;
  Sim.advance(st, 3);
  assert.strictEqual(st.obligations[debt].status, 'overdue', "a debt's days stand");
  assert.strictEqual(st.obligations[keep].status, 'lapsed', "the keep's days lapse");
  assert.strictEqual(st.record.slice(n0).filter((e) => /lapsed/.test(e.text || '')).length, 1, 'told once');
  assert.deepStrictEqual(
    checkState(st).filter((b) => /obligation|days/.test(b)),
    [],
  );
  // an estate's levy comes on top (design.md, Outer levies, An estate's levy): a due laid on a village is split into its households'
  // lots by fields, beside the routine lots already laid on them, which stand as they were
  const vid = fA.village,
    routine = [A, B].map((h) =>
      O.create(st, {
        kind: 'days',
        debtor: { kind: 'household', id: h.id },
        creditor: { kind: 'village', id: vid },
        owes: { days: 2 },
        source: 'routine',
        terms: TERMS.routine,
        window: [today(), today() + 20],
      }),
    );
  const before = JSON.stringify(routine.map((id) => st.obligations[id]));
  const n1 = st.obligations.length;
  assert.strictEqual(
    lay(A.holder, { debtor: { kind: 'village', id: vid }, source: 'due', days: 3, window: [today(), today() + 20] }),
    true,
  );
  const dues = st.obligations.slice(n1);
  assert.ok(
    dues.every((x) => x.source === 'due' && x.debtor.kind === 'household' && x.terms.names === 'levier'),
    'lots of the due',
  );
  assert.strictEqual(
    dues.reduce((s, x) => s + x.owes.days, 0),
    3,
    'the lots sum to the days laid',
  );
  assert.strictEqual(
    JSON.stringify(routine.map((id) => st.obligations[id])),
    before,
    'the routine lots stand as they were',
  );
  for (const h of [A, B])
    assert.ok(
      Sim.levies(st, { kind: 'household', id: h.id }).bears.length >=
        1 + dues.filter((x) => x.debtor.id === h.id).length,
    );
  for (const id of [...routine, ...dues.map((x) => x.id)]) O.forgive(st, id, A.holder);
  // hours booked while the creditor's load is on the road: it is brought in before the pawn goes home (VB-1548)
  {
    const ag = st.agents[hand],
      was = [ag.job, ag.load, st.daysToday];
    st.daysToday = { day: today(), by: { [hand]: [oid, OUTER.hours, 0] } };
    const e = st.daysToday.by[hand];
    ag.job = j;
    ag.load = 1;
    Levies.step(st);
    assert.strictEqual(e[2], 0, 'a load on the road: no goHome yet');
    ag.load = 0;
    ag.job = null;
    Levies.step(st);
    assert.strictEqual(e[2], 1, 'the load delivered: the hand goes home');
    [ag.job, ag.load, st.daysToday] = was;
  }
  // VB-1813: an owed hand whose hours are booked while it is cut at a creditor's trip (a basket of stone picked: the load made, carried to the
  // creditor's store by the methods) and on a wood haul (the load in hand set in the creditor's store) sets the load in the store, then walks home
  // (sim/agents dayGiven, onward); the store is the creditor's, never the debtor's
  {
    const { tinyWorld, tinyState } = require('./lib/tiny.js'),
      Agents = VB['sim/agents'],
      Stores = VB['sim/stores'],
      { cal } = VB['sim/rules'];
    const rows = Array.from({ length: 14 }, (_, i) =>
      i < 2 ? 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF' : '.'.repeat(36),
    );
    const mkst = () => {
      const s = tinyState(tinyWorld(rows), [{ at: [8, 8], farms: 2, sizes: [4, 4] }], { seed: 4 });
      s.naturalDeaths = false;
      Sim.advance(s, 3);
      while (cal(s.t).hour < 8) Sim.advance(s, 0.25);
      return s;
    };
    for (const kind of ['gather', 'wood']) {
      const s = mkst(),
        [CA, CB] = [s.households[0], s.households[1]],
        fa = s.farmsteads[CA.farmstead],
        ob = O.create(s, {
          kind: 'days',
          debtor: { kind: 'household', id: CB.id },
          creditor: { kind: 'household', id: CA.id },
          owes: { days: 2 },
          source: 'debt',
        });
      const h = CB.members.find((m) => s.pawns[m].alive && age(s, s.pawns[m]) >= MATCH.help.minAge),
        ag = s.agents[h];
      const site = s.villages[fa.village].wood[0];
      assert.ok(site >= 0, `${kind}: a site`);
      const jj = Jobs.post(s, `${kind}:test`, kind, { type: 'household', id: CA.id }, site, { farm: fa });
      const mark = (x) => {
        s.daysToday = { day: Math.floor(s.t / DAY), by: { [h]: [ob, x, 0] } };
      };
      mark(0);
      VB['sim/agents'].release(s, ag);
      ag.basis = 'owed';
      Agents.start(s, ag, jj);
      const held = (hh) =>
          kind === 'gather' ? hh.fresh.reduce((x, b) => x + b.qty, 0) : Stores.heldOf(hh, 'timber') + (hh.wood || 0),
        stone = () => held(CA),
        mine = () => held(CB),
        was = [stone(), mine()];
      let n = 0;
      if (kind === 'gather') {
        while (!(ag.leg && ag.leg.kind === 'work') && n++ < 400) Sim.advance(s, 0.1);
        for (let i = 0; i < 5; i++) Sim.advance(s, 0.1); // half an hour of its two hours worked
      } else while (!(ag.load > 0) && n++ < 600) Sim.advance(s, 0.1);
      assert.ok(
        n < 400 && ag.job === jj && (kind === 'wood' || ag.leg.kind === 'work'),
        `${kind}: the hand is at the trip (${n}, ${ag.job && ag.job.key})`,
      );
      const hours = OUTER.hours;
      mark(hours);
      if (kind === 'gather') Levies.step(s);
      let i = 0;
      for (; i < 25 && (ag.job || !ag.inside); i++) Sim.advance(s, 0.1); // well within the hours it would take to work on
      assert.ok(
        !ag.job && ag.inside && !(ag.load > 0),
        `${kind}: the load set down, the hand home (${ag.job && ag.job.key}, ${ag.load}, inside ${ag.inside})`,
      );
      assert.ok(
        stone() > was[0] && mine() === was[1],
        `${kind}: the load is in the creditor's store (${was[0]} to ${stone()}; its own ${mine()})`,
      );
    }
  }
}

console.log(
  `levies ok: the custom's table through the door; each member's levy by its row and hands, the head pair and a child under 7 not levied; compiled once a season; the levy left today the day's capacity; the morning's lists within the levies; the vital work slotted first; each leg's hours booked into the six parts, a day summing to H, the tally folded; a demand named and answered by the member's judgement, a breach's hours taken, goodwill booked both ways; own hours given by the member's judgement, the diligent son's ${ownSeen}${fitSeen}; an outer levy laid with its terms, asked, named at the notice, worked as owed, a due on a village on top of its routine lots; the ladder before a breach, rung by rung${ladderSeen}`,
);
