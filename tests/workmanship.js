// Workmanship (VB-761): the odds of the five grades at a maker's skill, the draw from the stream `making`, the head's estimate of worth and
// who takes a making; the quern hewn with a grade, that lasts and grinds by it. On a tiny farm at seed 7.
const assert = require('assert'),
  VB = require('../src/load.js');
const W = VB['sim/workmanship'],
  { WORKMANSHIP, oddsAt, meanAt, draw, expectedWorth, maker, skillFor } = W;
const { SYSTEMS } = VB['sim/rng'];
const { TRAITS, YEAR } = VB['sim/rules'];
const Norms = VB['sim/norms'];
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

// ---- the rule ----
assert(SYSTEMS.includes('making'), 'a stream of its own');
for (const [s, row] of [
  [0, WORKMANSHIP.odds.novice],
  [0.5, WORKMANSHIP.odds.practised],
  [1, WORKMANSHIP.odds.master],
])
  for (let g = 0; g < 5; g++) assert(near(oddsAt(s, g), row[g] / 100), `odds at ${s}, grade ${g}`);
for (const s of [0, 0.25, 0.5, 0.75, 1]) {
  let sum = 0;
  for (let g = 0; g < 5; g++) sum += oddsAt(s, g);
  assert(near(sum, 1), `the odds at ${s} sum to 1`);
}
// the plan's means (VB-702, 13.2): a novice 0.83 life and 0.91 working, practised 1.01 and 1.00, a master 1.12 and 1.06
const life = (g) => WORKMANSHIP.life[g],
  work = (g) => WORKMANSHIP.work[g],
  worth = (g) => Norms.norm('workmanship', g);
assert(near(meanAt(0, life), 0.83, 0.005) && near(meanAt(0, work), 0.91, 0.005), 'a novice');
assert(near(meanAt(0.5, life), 1.01, 0.005) && near(meanAt(0.5, work), 1.0, 0.005), 'practised');
assert(near(meanAt(1, life), 1.12, 0.005) && near(meanAt(1, work), 1.06, 0.005), 'a master');
assert(near(meanAt(0, worth), 0.77, 0.005) && near(meanAt(1, worth), 1.47, 0.005), 'worth: 0.77 to 1.47');

// ---- the registry: a graded good's kind carries one row a grade (sim/goods) ----
const Goods = VB['sim/goods'], Rules = VB['sim/registry'];
const granite = Goods.kindRow('quern', 'granite');
assert.strictEqual(granite.grades.length, 5, 'five rows');
assert(Object.isFrozen(granite.grades) && Object.isFrozen(granite.grades[0]), 'frozen');
for (let g = 0; g < 5; g++) {
  const r = granite.grades[g];
  assert.strictEqual(r.grade, g);
  assert(near(r.grit, granite.grit * WORKMANSHIP.work[g]), `grit scaled by work at ${g}`);
  assert(near(r.life, WORKMANSHIP.life[g]) && near(r.worth, granite.worth * worth(g)), `life and worth at ${g}`);
}
assert.strictEqual(Goods.kindRow('stone', 'granite').grades, undefined, 'a material is not graded');

const w = tinyWorld(Array.from({ length: 18 }, () => '.'.repeat(24)));
const st = tinyState(w, [{ at: [8, 8], farms: 1, sizes: [6] }], { seed: 7 });
const HANDS = TRAITS.names.indexOf('hands');
const p = st.pawns[0];
p.traits[HANDS] = 0.5; // the hands at the middle: the odds are read at the level alone
p.skills = { stonework: { level: 0.5, at: st.t } };
assert(near(skillFor(st, p.id, 'stonework'), 0.5), 'practised, at the middle of hands');
p.traits[HANDS] = 1;
assert(near(skillFor(st, p.id, 'stonework'), 0.6), 'deft hands: a tenth of skill more');
p.traits[HANDS] = 0.5;
// fix forces each grade: u just under each cumulative bound falls in that grade
let acc = 0;
for (let g = 0; g < 5; g++) {
  const share = oddsAt(0.5, g);
  st.rng.making.fix = acc + share / 2;
  assert.strictEqual(draw(st, p.id, 'stonework'), g, `fix forces grade ${g}`);
  acc += share;
}
delete st.rng.making.fix;
// many draws of a practised maker: the shares are the table's, the mean life and working 1 within 0.02
const n = 20000,
  count = [0, 0, 0, 0, 0];
for (let i = 0; i < n; i++) count[draw(st, p.id, 'stonework')]++;
for (let g = 0; g < 5; g++)
  assert(near(count[g] / n, WORKMANSHIP.odds.practised[g] / 100, 0.012), `share of grade ${g}: ${count[g] / n}`);
const mean = (row) => count.reduce((s, c, g) => s + c * row(g), 0) / n;
assert(
  near(mean(life), 1, 0.02) && near(mean(work), 1, 0.02),
  `a practised maker averages sound: ${mean(life)}, ${mean(work)}`,
);
assert(near(expectedWorth(st, p.id, 'stonework'), meanAt(0.5, worth)), 'the head estimates in closed form');
// the most skilled hand takes the making; a tie goes to the first named
const q = st.pawns[1];
q.traits[HANDS] = 0.5;
assert.strictEqual(maker(st, [q.id, p.id], 'stonework'), p.id, 'the practised hand makes');
q.skills = { stonework: { level: 0.5, at: st.t } };
assert.strictEqual(maker(st, [q.id, p.id], 'stonework'), q.id, 'a tie: the first');
// the worth rule takes the grade in its context
const quern = Goods.goodOf('quern');
assert(near(Rules.value(st, 'worth', { good: quern }), Norms.norm('worth', 'quern')), 'no grade: sound');
assert(near(Rules.value(st, 'worth', { good: quern, grade: 4 }), 4 * Norms.norm('worth', 'quern')), 'a masterwork: four times');
console.log('workmanship: ok');
