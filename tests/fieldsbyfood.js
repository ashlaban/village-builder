// Fields sized against the head's estimate of all its food (VB-768; sim/yields' trusted, sim/fieldplans' fieldsWanted and fieldToLetGo,
// the verb letField of sim/plans): on the probe's state, two households with the same nets and the same eight years, a cautious head and
// a bold one: the bold one wants fewer fields; a household with no second source wants what it wants today; one good year lets no field
// go; a field let go leaves the farm, its tile the village's again, and no field id is used twice.
const VB = require('../src/load.js');
const { FIELDS, cal } = VB['sim/rules'];
const Y = VB['sim/yields'], F = VB['sim/fieldplans'], Traits = VB['sim/traits'], { issue } = VB['sim/commands'];
const { checkState } = require('./lib/invariants.js');
const probe = require('./lib/probe.js');
let failed = 0;
const check = (ok, m) => { if (!ok) { failed++; console.error('FIELDSBYFOOD FAIL:', m); } };
const st = probe.state();
const farms = st.villages[0].farmsteads.map((id) => st.farmsteads[id]), [fa, fb] = farms;
const A = st.households[fa.household], B = st.households[fb.household];
const HB = Traits.HEAD.bias, NET = FIELDS.expect * 100 - 25; // a barley field's cautious net yield
// the same eight years of fish for both: a field's net in a poor year, three in the others
const years = [NET, NET, 3 * NET, 3 * NET, 3 * NET, 3 * NET, 3 * NET, 3 * NET];
const remember = (hh, fish) => { for (let i = 0; i < fish.length; i++) { Y.of(hh).tally.fish = fish[i]; Y.close(hh, i + 1); } };
const alone = (hh) => F.fieldsWanted(st, hh, 99, 1, false), now = (hh) => F.fieldsWanted(st, hh, 99, 1);
// before any memory: as today
check(now(A) === alone(A), `no memory: ${now(A)} against ${alone(A)}`);
remember(A, years);
remember(B, years);
st.plans.households.get(A.id).head.bias.fields = 1 + HB; // cautious: c 1, trusts the poor year
st.plans.households.get(B.id).head.bias.fields = 1 - HB; // bold: c 0, trusts the mean
const tA = Y.trusted(st, A), tB = Y.trusted(st, B);
check(Math.abs(tA.total - NET) < 1e-9 && Math.abs(tB.total - 2.5 * NET) < 1e-9, `trusted ${tA.total} and ${tB.total}`);
check(now(B) < now(A) && now(A) < alone(A), `the bold head wants fewer: bold ${now(B)}, cautious ${now(A)}, on fields alone ${alone(A)}`);
// gifts count at their poor year whatever the caution
Y.of(B).ring.gifts = [0, 0, 0, 0, 0, 0, 0, 8 * NET];
check(Math.abs(Y.trusted(st, B).total - 2.5 * NET) < 1e-9, 'one year of gifts is not counted on');
Y.of(B).ring.gifts = [0, 0, 0, 0, 0, 0, 0, 0];
// a household with no second source wants what it wants today
const C = st.households[farms[2] ? farms[2].household : fa.household];
if (C !== A) {
  remember(C, [0, 0, 0, 0, 0, 0, 0, 0]);
  check(now(C) === alone(C), `no second source: ${now(C)} against ${alone(C)}`);
}
// one good year lets no field go: a middling head holding the fields it wants on its fields alone
const planA = st.plans.households.get(A.id), c = cal(st.t);
planA.head.bias.fields = 1;
remember(A, [0, 0, 0, 0, 0, 0, 0, NET]);
VB['sim/seasonal'].reviewTargets(st, planA, A, c);
check(F.fieldToLetGo(st, planA, fa, A, c) === null, 'one good year of fish lets a field go');
// years of good fishing free fields: one is let go through the head's verb, and only one a year
remember(A, years.map((x) => 4 * x));
VB['sim/seasonal'].reviewTargets(st, planA, A, c);
const n0 = fa.fields.length, made0 = n0 + (fa.left ? fa.left.gone : 0);
if (planA.targets.fields < Math.min(n0, alone(A))) {
  const fd = F.fieldToLetGo(st, planA, fa, A, c);
  check(fd !== null, 'the freed field is chosen');
  if (fd) {
    const tile = fd.tile, why = issue(st, { actor: A.holder, verb: 'letField', target: A.id, args: { field: fd.id }, source: 'pawn' });
    check(why === true, `letField refused: ${why}`);
    check(fa.fields.length === n0 - 1 && !fa.fields.includes(fd) && fa.left.gone === 1 && fa.left.year === c.year, 'the field left the farm');
    check(!st.used.has(tile) && st.owner[tile] === -fa.village - 1, "its tile is the village's");
    check(fa.fields.length + fa.left.gone === made0, 'the fields made are counted');
    check(F.fieldToLetGo(st, planA, fa, A, c) === null, 'a second field the same year');
  }
} else check(false, `no field freed: wants ${planA.targets.fields} of ${n0}`);
// a field with a crop is not let go
const sown = fb.fields[0];
sown.stage = 'growing';
check(issue(st, { actor: B.holder, verb: 'letField', target: B.id, args: { field: sown.id }, source: 'pawn' }) !== true, 'a sown field let go');
sown.stage = 'stubble';
const bad = checkState(st);
check(!bad.length, 'invariants: ' + bad.slice(0, 3).join('; '));
if (failed) process.exit(1);
console.log(`fieldsbyfood ok: the bold head wants ${now(B)} fields, ${alone(B)} on its fields alone; a field let go`);
