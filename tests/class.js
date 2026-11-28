// @suite integration
// Class (VB-318): the livelihood's hysteresis on constructed households, the year's income booked from the events, and what elite stood for
// as contributions to rules that read the measure (not the label).
const assert = require('assert');
const VB = require('../src/load.js');
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const Class = VB['sim/class'], Rules = VB['sim/registry'], { emit } = VB['sim/events'], { dailyNeed } = VB['sim/hunger'];
const { YEAR_DAYS } = VB['sim/rules'];
const map = ['..............', '...FF.........', '...FF.........', '..............', '..........FF..', '..............', '.........^^...', '..............', '~.............', '~~............'];
const st = tinyState(tinyWorld(map), [{ at: [3, 5], farms: 4 }], { seed: 7 });
const [A, B, C, D] = st.households;
const need = (hh) => dailyNeed(st, hh) * YEAR_DAYS;
const keep = (hh, x) => emit(st, 'keepGrain', { hh, n: x * need(hh) });
const interest = (hh, x) => {
  const o = { kind: 'loan', creditor: { kind: 'household', id: hh.id }, lent: 100, owes: { rations: 200 } };
  emit(st, 'paid', { o, part: 2 * x * need(hh) }); // half of what is repaid is interest
};
const rent = (hh, x) => emit(st, 'paid', { o: { kind: 'rent', creditor: { kind: 'household', id: hh.id } }, part: x * need(hh) });
// a load of sheaves of the household's own field, two hours in three worked by hands not its own: x of its need is income from others
const hired = (hh, x) => {
  const fd = st.farmsteads[hh.farmstead].fields[0];
  fd.hoursOwn = 1;
  fd.hoursOther = 2;
  emit(st, 'sheavesIn', { hh, field: fd, n: 1.5 * x * need(hh) });
};
const year = (hh, f) => {
  if (f) f();
  Class.reckon(st, hh);
};
const years = (hh, n, f) => {
  for (let i = 0; i < n; i++) year(hh, f);
};
// large stores and no income from others: neither (the old rule counted 45 to 100 in 200 by its stores)
A.grain.barley += 100000;
years(A, 6);
assert(!Class.isElite(A) && !Class.isLanded(A), 'stores are not income');
// the keep alone, 0.7: not elite
years(B, 6, () => keep(B, 0.7));
assert(!Class.isElite(B), 'the keep alone at 0.7 is not elite');
assert(Math.abs(Class.classOf(st, B).m - 0.7) < 1e-9);
// the keep in grain and interest to 1.3: elite after three year ends running, not landed
years(B, 2, () => { keep(B, 0.7); interest(B, 0.6); });
assert(!Class.isElite(B), 'two years are not three');
year(B, () => { keep(B, 0.7); interest(B, 0.6); });
assert(Class.isElite(B) && !Class.isLanded(B), 'elite, not landed');
// no longer elite after three years running under 0.75, not before
years(B, 2, () => keep(B, 0.7));
assert(Class.isElite(B), 'two years under are not three');
year(B, () => keep(B, 0.7));
assert(!Class.isElite(B), 'three years under 0.75');
// rents and hired hands' harvest to 1.3: elite and landed
years(C, 3, () => { rent(C, 0.5); hired(C, 0.8); });
assert(Math.abs(Class.classOf(st, C).m - 1.3) < 1e-9, 'rents and hired hands: ' + Class.classOf(st, C).m);
assert(Class.isElite(C) && Class.isLanded(C), 'elite and landed');
// elite by the keep, landed as well when its land's income alone passes 1.25
years(D, 3, () => keep(D, 1.3));
assert(Class.isElite(D) && !Class.isLanded(D));
years(D, 3, () => { keep(D, 1.3); rent(D, 1.3); });
assert(Class.isElite(D) && Class.isLanded(D), 'landed as well, still elite');
// the year's hours are cleared by the reckoning
{
  const fd = st.farmsteads[A.farmstead].fields[0];
  fd.hoursOwn = 1;
  fd.hoursOther = 2;
  Class.reckon(st, A);
  assert(fd.hoursOwn === undefined && fd.hoursOther === undefined);
}
// what elite stood for reads the measure, not the label: field work priority falls to 2 of 10 at 1.25, standing rises to 0.2
{
  const prio = (hh) => Rules.value(st, 'fieldPrio', { pr: 8, hh });
  const stand = (hh) => Rules.value(st, 'standing.livelihood', { hh });
  assert.strictEqual(prio(A), 8, 'no income from others, no change');
  assert.strictEqual(stand(A), 0);
  assert(Math.abs(prio(D) - 2) < 1e-9, 'at the level that made it elite: 2 of 10');
  assert(Math.abs(stand(D) - 0.2) < 1e-9);
  assert(prio(B) < 8 && prio(B) > 2 && stand(B) > 0 && stand(B) < 0.2, 'between, by the measure and not the class');
}
for (const hh of st.households) assert(['tenant', 'cottager', 'peasant'].includes(Class.classOf(st, hh).land));
checkState(st);
console.log('class ok');
