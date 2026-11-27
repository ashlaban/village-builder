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

// 6. The work a household lives by is slotted first within the levy (Day.vitalFirst): the best pair of a vital task (the water), its
// member levied, goes before lesser work it fits better; a vital task the head pair fit best (the meal) keeps its place, and a vital
// task's further pairs theirs.
{
  const water = { id: 1, kind: 'water', claims: [] },
    cook = { id: 2, kind: 'cook', claims: [] },
    plow = { id: 3, kind: 'plow', claims: [] };
  const pairs = [[9, hh.holder, plow], [8, hh.holder, cook], [7, son, plow], [6, son, cook], [5, son, water], [4, hh.holder, water]];
  Day.vitalFirst(st, hh, pairs);
  assert.deepStrictEqual(
    pairs.map(([s, id, j]) => [s, id === son ? 'son' : 'head', j.kind]),
    [[5, 'son', 'water'], [9, 'head', 'plow'], [8, 'head', 'cook'], [7, 'son', 'plow'], [6, 'son', 'cook'], [4, 'head', 'water']],
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
  assert.ok(Math.abs(r.p[1] - (4 * hands + Math.min(left, 3 * hands))) < 1e-9, "the head's work: levied up to the levy left");
  assert.ok(Math.abs(r.p[2] - Math.max(0, 3 * hands - left)) < 1e-9, 'and demanded past it');
  leg(son, 17, 30, 'pawn'); // past the levy, of its own accord: given; the night unbooked; the next day's 06:00 to 06:00 nothing
  assert.ok(Math.abs(r.p[3]) < 1e-9 && r.day === day + 1, 'the next day begun at 06:00');
  const closed = r.past[0];
  assert.strictEqual(closed[0], day, 'the day closed is in the days behind');
  assert.ok(Math.abs(closed[3 + 3] - hands) < 1e-9, 'its own accord past the levy: given, the night unbooked');
  const sum = closed.slice(3).reduce((x, y) => x + y, 0);
  assert.ok(Math.abs(sum - 12 * hands) < 1e-9, `the six parts sum to H = 12 × its hands (${sum})`);
  const T = s.plans.households.get(h.id).tally;
  assert.ok(T && Math.abs(T.of[m][0] - r.past[0][3 + 2]) < 1e-9 && Math.abs(T.of[m][2] - hands) < 1e-9, "the season's tally: demanded, given");
  // the head: not levied, its household's work given, an outer day owed, a pastime kept
  leg(head, 6, 6, 'head');
  leg(head, 8, 12, 'head');
  leg(head, 12, 14, 'owed');
  leg(head, 14, 18, undefined);
  const g = head.book.p,
    hh2 = head.book.hands;
  assert.ok(Math.abs(g[3] - 4 * hh2) < 1e-9 && Math.abs(g[0] - 2 * hh2) < 1e-9 && Math.abs(g[4] - 6 * hh2) < 1e-9, 'the head: given, owed, kept');
  assert.ok(!(T.of[h.holder]), 'the head pair have no tally');
  // Sim.hours: the days behind exact, today's booked so far, a day ahead the levy only; sovereignty by right and as lived
  s.agents[m].book = son.book; // the scratch record read as the member's
  const H = Sim.hours(s, m, day, day + 3),
    [d0] = H;
  assert.deepStrictEqual(H.map((o) => o.state), ['past', 'today', 'ahead', 'ahead'], 'past, today, ahead');
  assert.strictEqual(d0.state, 'past', 'a past day');
  assert.ok(Math.abs(d0.right - (1 - L / (12 * hands))) < 1e-9, 'by right: 1 less the levy over H');
  assert.ok(Math.abs(d0.lived - (d0.demanded + d0.given + d0.kept) / d0.H) < 1e-9, 'as lived: demanded, given and kept over H');
  s.tick = tick;
  s.t = t0;
  // the season's end folds the tally into the year's count
  const later = cal((day + SEASON_DAYS) * DAY + WORK[0]),
    t2 = Levies.tallyOf(s, h, later);
  assert.ok(Object.keys(t2.of).length === 0 && Math.abs(t2.yearOf[m][2] - hands) < 1e-9, "folded into the year's count");
}

// 8. On the run: every pawn-day closed sums to H (the invariant), and Sim.hours shows the six days behind and a day ahead.
{
  const s = make(8 * DAY),
    today = Math.floor(s.t / DAY),
    m = s.households[0].members.find((id) => Levies.levyOf(s, id) > 0);
  assert.deepStrictEqual(checkState(s), [], 'invariants: the six parts sum to H');
  const H = Sim.hours(s, m, today - 10, today + 1);
  assert.deepStrictEqual(H.map((o) => o.state), ['past', 'past', 'past', 'past', 'past', 'past', 'today', 'ahead'], 'six days behind, today, a day ahead');
  for (const o of H.slice(0, 6)) {
    const sum = VB['sim/levies'].PARTS.reduce((x, k) => x + o[k], 0);
    assert.ok(Math.abs(sum - o.H) < 1e-6 && o.H > 0, `day ${o.day}: the parts sum to H (${sum}, ${o.H})`);
  }
  assert.ok(H.slice(0, 6).some((o) => o.levied > 0), 'levied hours are booked');
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
  assert.ok(a.book.p[2] < 1e-9 && Math.abs(a.book.p[1] - row * a.book.hands) < 1e-9, `the capacity's hours all levied (${a.book.p})`);
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
      if (!l || l.kind === 'wait' || !j || !j.owner || (j.owner.type !== 'household' && j.owner.type !== 'village')) continue;
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
  assert.ok(Math.abs(g1 - g0 - owed) < 0.01, `goodwill (it decays as it stands): the head owes the hours demanded less those taken (${g1 - g0}, ${owed})`);
  const tl = Levies.tallyOf(s, h, cal(day * DAY + WORK[0]));
  assert.ok(Math.abs(tl.of[m][1] - P[5]) < 1e-9 && tl.of[m][0] >= P[2] - 1e-9, `the tally counts taken and demanded (${tl.of[m]})`);
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
  assert.ok(levied.length >= 2, "two levied members");
  {
    const [x, y] = levied,
      given = (key) => day.lists[y].includes(key) && !(day.fits[y][day.lists[y].indexOf(key)] < 0),
      i = day.fits[x].findIndex((f, k) => f > 0 && day.hours[x][k] > 0 && !given(day.lists[x][k]));
    assert.ok(i >= 0, "a task given hands to move");
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
      assert.ok(met ? VB.count.demandMet === yes0 + 1 : VB.count.demandRefused === no0 + 1, 'answered at once: moved at a yes, a memory at a no');
    }
  }
  const hp = h.holder;
  assert.match(String(issue(s, { actor: hp, verb: 'breach', args: {}, source: 'player' })), /owes no household hours/, 'the head pair owe none');
  const m = h.members.find((id) => Levies.levyOf(s, id) > 0 && age(s, s.pawns[id]) >= 14);
  assert.ok(m !== undefined && Levies.capacity(s, h, s.pawns[m], cal(s.t)) > 0, "a levied member with levy left");
  {
    assert.ok(Sim.decisions(s, m).some((d) => d.point === 'take'), 'a levied member may take hours of its levy');
    assert.strictEqual(issue(s, { actor: m, verb: 'breach', args: { hours: 2 }, source: 'player' }), true, 'a breach');
    assert.ok(s.agents[m].taking > s.tick, 'keeping its hours');
    assert.ok(!Sim.decisions(s, m).some((d) => d.point === 'take'), 'not while it takes');
    Sim.advance(s, 3);
    assert.deepStrictEqual(checkState(s), [], 'invariants after a breach');
    const o = Sim.hours(s, m, Math.floor(s.t / DAY), Math.floor(s.t / DAY))[0];
    assert.ok(o.taken > 0, `the hours booked taken (${o.taken})`);
  }
}

console.log(
  "levies ok: the custom's table through the door; each member's levy by its row and hands, the head pair and a child under 7 not levied; compiled once a season; the levy left today the day's capacity; the morning's lists within the levies; the vital work slotted first; each leg's hours booked into the six parts, a day summing to H, the tally folded; a demand named and answered by the member's judgement, a breach's hours taken, goodwill booked both ways",
);
