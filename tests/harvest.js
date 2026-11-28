// The harvest home (VB-459; design.md, The gift: The harvest home): once its grain is in, a household above the feast's threshold calls
// one evening FEAST.notice days ahead at its farm, once a year, and asks its own, its kin households, then the households its holder is
// tied to most strongly, nearest first, to 20, within a day's walk by land, none already bound for an occasion that day.
const assert = require('assert');
const VB = require('../src/load.js'),
  O = VB['sim/occasions'];
const { DAY, YEAR_DAYS, SEASON_DAYS, cal } = VB['sim/rules'],
  { FEAST } = VB['sim/feast'],
  { addTie } = VB['sim/ties'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'),
  { checkState } = require('./lib/invariants.js');

// 170 by 12 land, a sea strip at columns 34 and 35 from end to end: A (the host) at 40, B near it at 48, D just behind the strip at 30
// (near as the crow flies, with no way by land), C at 160 (beyond a day's walk).
const rows = Array.from({ length: 12 }, () => '.'.repeat(34) + '~~' + '.'.repeat(134));
const scene = () => {
  const st = tinyState(
    tinyWorld(rows, { seed: 7 }),
    [
      { at: [40, 6], farms: 1, sizes: [4] },
      { at: [48, 6], farms: 1, sizes: [4] },
      { at: [30, 6], farms: 1, sizes: [4] },
      { at: [160, 6], farms: 1, sizes: [4] },
      { at: [44, 3], farms: 1, sizes: [4] },
    ],
    { seed: 7 },
  );
  const [a, b, d, c, e] = st.households.filter((h) => !h.dissolved && h.holder !== null);
  st.t = (YEAR_DAYS + 2 * SEASON_DAYS + 5) * DAY + 9; // autumn, the second year
  const day = cal(st.t).day;
  for (const h of st.households) {
    h.grain = { barley: 100000 };
    for (const fd of st.farmsteads[h.farmstead].fields) {
      fd.stage = 'stooks';
      fd.reaped = day - 2;
      fd.sown = day - 100;
    }
  }
  for (const x of [b, c, d, e]) addTie(st, a.holder, x.holder, 0.5);
  return { st, a, b, c, d, e };
};

// 1. One a year above the threshold; none below
{
  const { st, a, b, c, d, e } = scene();
  const h = O.harvestHome(st, a);
  assert.ok(h && h.kind === 'harvest', 'a household above the threshold calls one');
  assert.strictEqual(h.start, (cal(st.t).day + FEAST.notice) * DAY + 16, 'for the evening FEAST.notice days ahead');
  assert.strictEqual(h.end, (cal(st.t).day + FEAST.notice) * DAY + 21);
  assert.strictEqual(h.overrides, false, 'work goes on');
  assert.strictEqual(a.harvestIn, cal(st.t).year);
  assert.strictEqual(O.harvestHome(st, a), null, 'one only in a year');
  st.t += 2 * DAY;
  assert.strictEqual(O.harvestHome(st, a), null, 'nor on another planning day');
  const ids = new Set(h.asked.map((g) => g.id)),
    has = (hh) => hh.members.some((m) => ids.has(m) && st.pawns[m].age >= 4);
  assert.ok(has(a) && has(b) && has(e), 'its own and the near households are asked');
  assert.ok(!has(c), "beyond a day's walk is not asked");
  assert.ok(!has(d), 'over the sea, with no way by land, is not asked');
  assert.deepStrictEqual(
    checkState(st).filter((x) => /harvest/.test(x)),
    [],
    'invariants',
  );
  // a year on, it may call another
  st.t += YEAR_DAYS * DAY;
  for (const fd of st.farmsteads[a.farmstead].fields) {
    fd.stage = 'stooks';
    fd.reaped = cal(st.t).day - 1;
  }
  assert.ok(O.harvestHome(st, a), 'a year later, another');
}
{
  const { st, a } = scene();
  a.grain = { barley: 0 };
  assert.strictEqual(O.harvestHome(st, a), null, 'below the threshold, none');
  assert.strictEqual(a.harvestIn, undefined, 'and none counted');
}

// 2. The grain is not in: a field still ripe, or none reaped yet
{
  const { st, a } = scene();
  st.farmsteads[a.farmstead].fields[0].stage = 'ripe';
  assert.strictEqual(O.harvestHome(st, a), null, 'a field still ripe');
}

// 3. Two hosts on one evening share no guest: those the first asked are not asked by the second, who has nobody else near, so calls none
{
  const { st, a, b, e } = scene();
  const h1 = O.harvestHome(st, a);
  assert.ok(h1);
  const one = new Set(h1.asked.map((g) => g.id)),
    day = O.dayOf(h1.start);
  const g2 = O.harvestGuests(st, e, day);
  assert.ok(
    g2.ids.every((id) => !one.has(id)),
    'no guest asked to both',
  );
  assert.ok(one.has(b.members[0]) && !g2.ids.includes(b.members[0]), "b is bound for a's evening");
  assert.strictEqual(O.harvestHome(st, e), null, 'with nobody left to ask, it calls none');
  // a day later the guests are free again
  assert.ok(O.harvestGuests(st, a, day + DAY).ids.includes(b.members[0]), 'another evening, b may be asked');
}
console.log('harvest: ok');
