// @suite fast
// Facilities (VB-361; design.md, The mill and the loom, the kiln and the quarry: Facilities): a registry of built things on sites, each
// founded by its owner's head through the verb `found`, its stages the steps of the owner's project plan (the job kind raisestage), the
// loads each stage takes reserved at the founding and taken as it is done (sim/stores, reason `build`); a half-built one outlives its
// dropped plan; its condition wears in closed form and its upkeep is offered on the owner's planning day. No kind is declared in the game:
// a test kind here, declared before the first seed seals the registry. On a small constructed state.
const VB = require('../src/load.js'),
  Sim = VB.sim,
  { state } = require('./lib/probe.js');
const Fac = VB['sim/facilities'],
  Stores = VB['sim/stores'],
  Projects = VB['sim/projects'],
  { issue } = VB['sim/commands'];
const { DAY, YEAR } = VB['sim/rules'];
const { checkState, checkCaches } = require('./lib/invariants.js');
let failed = 0;
const check = (ok, m) => {
  if (!ok) {
    failed++;
    console.error('FACILITIES FAIL:', m);
  }
};
Fac.declare('testshed', {
  name: 'test shed',
  stages: [{ hours: 6, loads: { iron: 2 }, name: 'the frame' }, { hours: 4 }],
  may: (st, t) => (st.w.water[t] ? 'it stands on land' : null),
  can: ['store'],
  capacity: 1,
  wear: 0.2,
  upkeep: 10,
});
Fac.declare('testhut', { name: 'test hut', stages: [{ hours: 3 }], may: () => null }); // no loads: a village holds no iron
let threw = false;
try {
  Fac.declare('testshed', { name: 'again', stages: [{ hours: 1 }], may: () => null });
} catch {
  threw = true;
}
check(threw, 'a kind is declared once');
const st = state(),
  w = st.w,
  f = st.farmsteads.find((x) => x.household !== null),
  hh = st.households[f.household];
// a free land tile beside the house
const near = [];
for (let d = 0; d < 6; d++) near.push(w.nb[f.house * 6 + d]);
const free = (t) => t >= 0 && !w.water[t] && t !== f.house && !f.fields.some((fd) => fd.tile === t);
const tile = near.find(free),
  other = near.find((t) => free(t) && t !== tile);
const me = { type: 'household', id: hh.id };
const found = (t, kind = 'testshed', actor = hh.holder) =>
  issue(st, { actor, verb: 'found', target: t, args: { kind, owner: me }, source: 'player' });
check(/no facility/.test(found(tile, 'mill')), 'an undeclared kind is refused');
check(/not the head/.test(found(tile, 'testshed', hh.holder + 1)), 'only the head founds for its household');
const iron0 = Stores.heldOf(hh, 'iron');
if (iron0 > 0) Stores.take(st, hh, 'iron', iron0, 'mendtools');
check(/takes 2 loads of iron/.test(found(tile)), `the loads are asked of the stores (${found(tile)})`);
const water = near.find((t) => t >= 0 && w.water[t]);
Stores.put(st, hh, 'iron', 3, 'smelt');
if (water !== undefined) check(found(water) === 'it stands on land', 'the kind tests the tile');
check(found(tile) === true, 'the head founds a shed');
const fac = Fac.at(st, tile);
check(fac && fac.id === 0 && fac.stage === 0 && fac.built === null && fac.owner.id === hh.id, `the record: ${JSON.stringify(fac)}`);
check(Fac.ofOwner(st, me).join() === '0', 'indexed by owner');
const plan = Projects.projectsOf(st, 'household', hh.id).find((p) => p.what === 'facility');
check(
  plan && plan.steps.length === 2 && plan.steps.every((s) => s.kind === 'raisestage' && s.place === tile) && plan.steps[0].spends.iron === 2,
  `the plan's steps are the stages: ${JSON.stringify(plan && plan.steps)}`,
);
check(Stores.reserved(st, hh, 'iron') >= 2, 'the loads are reserved from the founding');
check(/being built/.test(found(tile)), 'one facility a tile: one being built is not founded again');
check(/being built/.test(Fac.view(st, fac).stage), 'the panel names its stage');
// the household's hands raise it, stage by stage; the frame takes its iron as it is done
let sawStage = false;
for (let d = 0; d < 30 && fac.built === null; d++) {
  Sim.advance(st, DAY);
  if (fac.stage === 1) sawStage = true;
}
check(fac.built !== null && fac.stage === 2 && fac.done === 0, `the shed is built by the household's hands (${JSON.stringify(fac)})`);
check(sawStage || fac.built !== null, 'the stages are raised in turn');
check(Math.abs(Stores.heldOf(hh, 'iron') - 1) < 1e-9, `the frame took its 2 loads of iron (${Stores.heldOf(hh, 'iron')})`);
check(!Projects.projectsOf(st, 'household', hh.id).some((p) => p.what === 'facility'), 'the plan is finished');
let bad = [...checkState(st), ...checkCaches(st)];
check(!bad.length, `invariants: ${bad.slice(0, 3).join('; ')}`);
// it wears in closed form; worn below FACILITIES.mend its upkeep is offered on the planning day and mended by the household
const t0 = st.t;
check(Fac.conditionOf(st, fac) > 0.99, 'built whole');
fac.condAt = t0 - 3 * YEAR; // as if built three years ago (the test's hand on its own record)
check(Math.abs(Fac.conditionOf(st, fac) - 0.4) < 1e-9, `0.2 a year: 0.4 after three (${Fac.conditionOf(st, fac)})`);
check(/standing, in 40%/.test(Fac.view(st, fac).stage), 'the panel names its condition');
for (let d = 0; d < 40 && fac.condAt < t0; d++) Sim.advance(st, DAY);
check(fac.condAt >= t0 && Fac.conditionOf(st, fac) > 0.9, `mended on the owner's offer (${Fac.conditionOf(st, fac)}, at ${fac.condAt})`);
check(Fac.upkeepWhy(st, fac.id) === 'it is whole' || Fac.conditionOf(st, fac) > 0.9, 'once whole, no upkeep');
// a half-built facility outlives its dropped plan, and is taken up again where it stood
Stores.put(st, hh, 'iron', 2, 'smelt');
check(found(other) === true, `a second shed (${found(other)})`);
const fac2 = Fac.at(st, other);
for (let h = 0; h < 24 * 10 && !(fac2.done > 0); h++) Sim.advance(st, 1);
const p2 = Projects.projectsOf(st, 'household', hh.id).find((p) => p.facility === fac2.id);
if (p2) issue(st, { actor: hh.holder, verb: 'dropProject', target: hh.id, args: { id: p2.id }, source: 'player' });
check(fac2.done > 0 && fac2.built === null && Fac.at(st, other) === fac2, `half-built, it stands (${JSON.stringify(fac2)})`);
const done2 = fac2.done;
check(found(other) === true, 'taken up again');
const p3 = Projects.projectsOf(st, 'household', hh.id).find((p) => p.facility === fac2.id);
const open2 = [6, 4][fac2.stage]; // the stage it stood at: the frame's 6 hours, or the roof's 4 once the frame was done in one leg
check(p3 && Math.abs(p3.steps[0].hours + done2 - open2) < 1e-6 && fac2.id === 1, `its open stage less the hours done (${p3 && p3.steps[0].hours})`);
check(st.facilities.length === 2, 'ids are never reused');
// a village's: its plan, the job posted at the village
const v = st.villages[f.village];
const vt = (() => {
  for (let i = 0; i < w.N; i++) if (!w.water[i] && st.owner[i] === 0 && !Fac.at(st, i) && i !== tile) return i;
  return -1;
})();
const vf = Fac.found(st, 'testhut', vt, { type: 'village', id: v.id });
check(vf && vf.owner.type === 'village' && Projects.projectsOf(st, 'village', v.id).some((p) => p.facility === vf.id), `a village's (${String(vf)})`);
for (let d = 0; d < 3; d++) Sim.advance(st, DAY);
check([...st.jobs.values()].some((j) => j.kind === 'raisestage' && j.owner.type === 'village') || vf.done > 0 || vf.built !== null, 'its stage is posted at the village');
bad = [...checkState(st), ...checkCaches(st)];
check(!bad.length, `invariants: ${bad.slice(0, 3).join('; ')}`);
// a save keeps the records and builds the index again
const back = Sim.load(w, JSON.parse(JSON.stringify(Sim.save(st))));
check(JSON.stringify(back.facilities) === JSON.stringify(st.facilities) && Fac.at(back, tile).id === 0, 'saved and loaded');
// the invariants see a broken record
fac.stage = 7;
check(checkState(st).some((m) => /facilities\[0\]/.test(m)), 'an invariant misses a stage past the kind');
if (failed) process.exit(1);
console.log('facilities ok');
