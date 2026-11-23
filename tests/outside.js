// A child on the way (VB-555; design.md, Courting: A child on the way and A child outside marriage), on a constructed state
// (tests/lib/tiny.js), chances forced with `fix`: a courting woman conceives and an unmarried one who courts nobody never does; the
// pregnancy known COURT.known days on, the couple's offer is answered out of the round and the child is born in marriage; a couple that
// cannot marry has a child outside marriage, which its parents' later marriage legitimates; hunger puts the offer off a day at a time,
// service until the round; each option of the custom in the heir ranking; an old save gains the custom; the invariants hold throughout.
const assert = require('assert');
const VB = require('../src/load.js');
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const { DAY, YEAR, YEAR_DAYS, TICKS } = VB['sim/rules'],
  { COURT } = VB['sim/courting'];
const { BIRTH, courtChance, dailyBirths } = VB['sim/births'];
const { offerKnown, dueRound } = VB['sim/asking'];
const { seedAsking } = VB['sim/wishes'];
const { emit } = VB['sim/events'];
const { issue } = VB['sim/commands'];
const { heirRanking } = VB['sim/heirranking'];
const Rel = VB['sim/relations'],
  R = VB['sim/records'];
const at = (st, t) => {
  st.tick = Math.round(t * TICKS);
  st.t = st.tick / TICKS;
};
const sound = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants, ${what}`);
const map = [
  '..............',
  '...FF.........',
  '...FF.........',
  '..............',
  '..........FF..',
  '..............',
  '.........^^...',
  '..............',
  '~.............',
  '~~............',
];
// As tests/courting.js: village 0, household 0 (holder 0, his wife 1, daughters 2 to 5) and household 1 (holder 6, his wife 7, sons 8
// and 10, daughter 9); village 1, household 2. The heirs 2 (21) and 8 (22); 4 (20) and 10 (21), heirs to nothing.
function world() {
  const st = tinyState(tinyWorld(map), [{ at: [3, 5], farms: 2 }, { at: [11, 2], farms: 1 }], { seed: 7 });
  const aged = (id, years) => {
    st.pawns[id].born = st.t - years * YEAR - DAY;
    st.pawns[id].age = years;
  };
  aged(2, 21);
  aged(8, 22);
  aged(4, 20);
  aged(10, 21);
  aged(9, 17);
  aged(5, 15);
  for (const h of st.households) h.grain.barley += 5000;
  VB['sim/heirs'].refreshRoles(st);
  seedAsking(st);
  return st;
}
function fond(st, a, b) {
  for (const [x, y] of [
    [a, b],
    [b, a],
  ]) {
    VB['sim/ties'].raiseTie(st, x, y, COURT.tie + 0.5);
    for (let i = 0; i < 6; i++) Rel.remember(st, x, y, 'worked');
    for (let i = 0; i < 4; i++) Rel.remember(st, x, y, 'ale');
  }
}
const court = (st, a, b) => {
  fond(st, a, b);
  emit(st, 'goodTalk', { a, b, oa: Rel.opinionOf(st, a, b), ob: Rel.opinionOf(st, b, a) });
  assert.ok(st.pawns[a].courting === b, `${a} and ${b} court`);
};
// one day of conceptions, every chance coming up, then the stream as it was
const conceive = (st) => {
  st.rng.births.fix = 0;
  dailyBirths(st);
  delete st.rng.births.fix;
};
// the pregnancy carried to its term: the birth (a boy, the mother lives)
function bear(st, m) {
  st.rng.births.fix = 0.99; // nobody conceives on the way, and the mother lives
  VB.sim.advance(st, st.pawns[m].pregnantUntil - st.t + DAY);
  delete st.rng.births.fix;
  return R.childrenOf(st, m).find((c) => st.pawns[c].born > st.t - 2 * DAY);
}
// the days until the pregnancy is known, and one more: the asking day reads the entry (sim/asking courtDay)
// a couple named stays fond on the way, whether or not the days bring the two together (VB-1541: the memories alone fade under COURT.end)
const known = (st, a, b) => {
  const half = Math.floor((COURT.known + 1) / 2) * DAY;
  VB.sim.advance(st, half);
  if (a !== undefined) fond(st, a, b);
  VB.sim.advance(st, (COURT.known + 1) * DAY - half);
};
const kinds = (st) => st.record.map((e) => e.kind);

// The chance: COURT.conceive a year at the peak of the married curve, by the same curve
assert.ok(Math.abs(courtChance(22) * YEAR_DAYS - COURT.conceive) < 1e-9, 'COURT.conceive a year at the peak');
assert.ok(courtChance(37) < courtChance(22) && courtChance(14) === 0 && courtChance(50) === 0, 'by the curve of married women');
assert.ok(courtChance(22) < BIRTH.peak, 'less than a married woman');

// 1. A courting woman conceives, an unmarried one who courts nobody never does; known COURT.known days on, the couple's open offer of
//    the round is answered then, they marry, and the child is born in marriage
{
  const st = world();
  court(st, 8, 2);
  const o = st.offers.find((x) => x.id === st.pawns[8].ask);
  assert.ok(o && o.courted && o.round, 'their offer of the round is open');
  sound(st, 'courting');
  conceive(st);
  const f = st.pawns[2];
  assert.ok(f.pregnantUntil !== null && f.pregnantBy === 8 && f.pregnantCourting === true, 'she conceives by the man she courts');
  for (const id of [4, 9]) assert.strictEqual(st.pawns[id].pregnantUntil, null, `${id}, unmarried and courting nobody, does not`);
  assert.deepStrictEqual(st.courtDue, [{ woman: 2, man: 8, t: st.t + COURT.known * DAY, until: st.t + (COURT.known + COURT.wait) * DAY }]);
  sound(st, 'a child on the way');
  known(st, 8, 2);
  assert.strictEqual(st.courtDue.length, 0, 'the entry is read');
  assert.strictEqual(R.spouseOf(st, 8), 2, 'the offer is answered out of the round: they marry');
  assert.ok(st.pawns[8].ask === null && !st.offers.some((x) => x.basis === 'match'), 'the offer of the round is closed');
  const c = bear(st, 2);
  assert.ok(c !== undefined && st.pawns[c].father === 8, 'the child is born, its father the man she courted');
  assert.ok(st.pawns[c].outside !== true && !kinds(st).includes('bornOutside'), 'born in marriage');
  assert.ok(!f.pregnantCourting, 'the pregnancy is over');
  sound(st, 'born in marriage');
}

// 2. A couple that cannot marry (no home: neither holds a farm) has a child outside marriage, in its mother's household, the father
//    recorded and known; their marriage later makes it born in marriage
{
  const st = world();
  court(st, 10, 4);
  conceive(st);
  assert.ok(st.pawns[4].pregnantCourting, 'she conceives');
  assert.strictEqual(offerKnown(st, { ...st.courtDue[0] }), 'wait', 'no home for them: not allowed');
  known(st);
  assert.ok(st.courtDue.length === 0 && R.spouseOf(st, 10) === null, 'read, and they stay unmarried');
  const c = bear(st, 4),
    p = st.pawns[c];
  assert.ok(p.outside === true && p.father === 10 && p.mother === 4, 'born outside marriage, its father recorded');
  assert.strictEqual(p.household, st.pawns[4].household, 'it lives in its mother’s household');
  const e = st.record.find((x) => x.kind === 'bornOutside');
  assert.ok(e && e.pawn === c && e.other === 4 && e.by === 10 && e.household === p.household, 'an event of the record');
  sound(st, 'born outside marriage');
  const wed = issue(st, { actor: 10, verb: 'marry', target: 4, args: { home: st.pawns[4].household }, source: 'round' });
  assert.strictEqual(wed, true, `they marry: ${wed}`);
  assert.strictEqual(p.outside, false, 'legitimated by the later marriage');
  const l = st.record.find((x) => x.kind === 'legitimated');
  assert.ok(l && l.pawn === c && l.other === 4 && l.by === 10, 'an event of the record');
  sound(st, 'legitimated');
}

// 3. Hunger puts the offer off a day at a time, for at most COURT.wait days; service waits for the round; a couple who court no more
//    are offered nothing
{
  const st = world();
  court(st, 8, 2);
  conceive(st);
  const e = st.courtDue[0];
  at(st, e.t);
  st.pawns[2].hunger = 0.6;
  assert.strictEqual(offerKnown(st, st.courtDue.shift()), 'later', 'too hungry: put off');
  assert.strictEqual(st.courtDue[0].t, e.t + DAY, 'by a day');
  at(st, e.until);
  st.courtDue[0].t = e.until;
  assert.strictEqual(offerKnown(st, st.courtDue.shift()), 'hungry', 'not past COURT.wait days: the round will offer it');
  assert.ok(st.courtDue.length === 0 && R.spouseOf(st, 8) === null, 'no entry left, unmarried');
  st.pawns[2].hunger = 0;
  st.pawns[2].servant = true;
  assert.strictEqual(offerKnown(st, { ...e, t: st.t, until: st.t }), 'service', 'one in service waits for the round');
  st.pawns[2].servant = false;
  st.pawns[2].courting = null;
  st.pawns[8].courting = null;
  assert.strictEqual(offerKnown(st, { ...e, t: st.t, until: st.t }), 'gone', 'they court no more');
}

// 4. The custom in the heir ranking: the eldest daughter of household 0, born outside marriage, inherits like the others, after those
//    born in marriage, or not at all
{
  const st = world();
  const hh = st.households[0],
    cu = R.practice(st, st.farmsteads[hh.farmstead].village),
    rank = (outside) => heirRanking(st, hh, { ...cu, outside });
  const equal = rank('equal'),
    first = equal[0];
  assert.ok(equal.length >= 3, `the daughters are heirs: ${equal}`);
  assert.deepStrictEqual(rank('after'), equal, 'none born outside: the options agree');
  st.pawns[first].outside = true;
  assert.deepStrictEqual(rank('equal'), equal, 'equal: she keeps her place');
  assert.deepStrictEqual(rank('after'), [...equal.slice(1), first], 'after: she follows those born in marriage');
  assert.deepStrictEqual(rank('none'), equal.slice(1), 'none: she does not inherit');
  assert.strictEqual(cu.outside, 'after', 'the default');
}

// 5. A save from before the custom: its arrays by custom are one block short; loaded, each gains it from the archetype
{
  const C = VB['sim/customs'],
    st = world(),
    k = C.IDX.outside,
    from = C.OFF[k];
  const data = JSON.parse(JSON.stringify(VB.sim.save(st))),
    old = VB.sim.load(st.w, data);
  for (const c of old.cenv.cultures) c.customs = c.customs.slice(0, k);
  for (const v of old.cenv.settlements) v.practice = v.practice.slice(0, k);
  for (const p of old.pawns) for (const f of ['att', 'anc']) if (p[f]) p[f] = p[f].slice(0, from);
  const back = VB.sim.load(st.w, JSON.parse(JSON.stringify(VB.sim.save(old))));
  assert.ok(back.cenv.cultures.every((c) => c.customs.length === C.DIMS.length && c.customs[k] === C.optIndex('outside', 'after')));
  assert.ok(back.cenv.settlements.every((v) => !v.practice || v.practice.length === C.DIMS.length));
  const p = back.pawns.find((x) => x.att);
  assert.strictEqual(p.att.length, C.TOTAL);
  assert.ok(Math.abs(p.att[from + C.optIndex('outside', 'after')] - 0.7) < 1e-6, 'the block of one who holds the default');
  assert.deepStrictEqual(Array.from(p.att.slice(0, from)), Array.from(st.pawns[p.id].att.slice(0, from)), 'the rest as saved');
  VB.sim.advance(back, 2 * DAY);
  sound(back, 'an old save, loaded and advanced');
}
console.log('outside ok: a courting conception, the offer out of the round, a child outside marriage and its legitimation, the custom');
