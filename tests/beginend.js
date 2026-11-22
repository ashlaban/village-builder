// A project's beginning and its end said once (VB-1408): sim/projects' mayBegin, the one read of whether a household may begin a project
// of its own, a small construction (it lives, is not dissolved, has no plan of the same making under way, a head not holding off
// projects; a booth and another plan do not stop it, VB-1414), and stepEnds, the one way a project step's job ends (the holder's open step, its kind and place; the
// cart's leaves the place). On a tiny world, through the rules, not a run.
const VB = require('../src/load.js'), Projects = VB['sim/projects'], Plans = VB['sim/plans'];
const { tinyWorld, tinyState } = require('./lib/tiny.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('BEGINEND FAIL:', m); } };
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'P'.repeat(16) : '................'));
const st = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 2, sizes: [5, 4] }], { seed: 4 });
const f = st.farmsteads[st.villages[0].farmsteads[0]], hh = st.households[f.household];
const { mayBegin, stepEnds } = Projects;

// the guard: each of its refusals, and what no longer refuses (a booth, another plan under way)
check(mayBegin(st, hh, 'tarpit') && mayBegin(st, hh, 'cart'), 'a living household with no plan, no holding off may begin');
check(!mayBegin(st, null, 'tarpit') && !mayBegin(st, undefined, 'cart'), 'no household: none');
hh.dissolved = true;
check(!mayBegin(st, hh, 'tarpit') && !mayBegin(st, hh, 'cart'), 'a dissolved household: none');
hh.dissolved = false;
f.booth = { tile: f.house };
check(mayBegin(st, hh, 'tarpit') && mayBegin(st, hh, 'cart'), 'a farm with a booth: a small construction all the same');
f.booth = null;
const plan = VB['sim/projectplans'].makeProject(st, 'household', hh.id, { what: 'tarpit', small: true, steps: [{ kind: 'tarpit', place: f.house, hours: 10, wood: 0 }] });
check(!mayBegin(st, hh, 'tarpit') && mayBegin(st, hh, 'cart') && !Projects.ownOf(st, hh.id), 'a pit under way: no second pit, a cart beside it; not a large project');
const hp = st.plans.households.get(hh.id), was = hp && hp.chosen;
check(!!hp, 'the household has a plan to choose in');

// the finisher: the effect and stepDone only while the job's step is still the holder's open one
let ran = 0;
const effect = () => ran++;
check(!stepEnds(st, { kind: 'cart', site: f.house }, hh, effect) && ran === 0, 'another kind: not its step, no effect');
check(!stepEnds(st, { kind: 'tarpit', site: f.house + 1 }, hh, effect) && ran === 0, 'another tile: not its step, no effect');
check(!stepEnds(st, { kind: 'tarpit', site: f.house }, null, effect) && ran === 0, 'no holder: nothing');
check(stepEnds(st, { kind: 'tarpit', site: f.house + 1 }, hh, effect, { place: false }) && ran === 1, 'the place left unasked (the cart): it ends');
check(!Projects.projectsOf(st, 'household', hh.id).length && plan.steps.length === 1, 'its one step done: the plan is finished (stepDone)');
check(!stepEnds(st, { kind: 'tarpit', site: f.house }, hh, effect) && ran === 1, 'a step no longer open: no effect, no second stepDone');
check(mayBegin(st, hh, 'tarpit'), 'its plan finished: it may begin again');
hp.chosen = { ...(was || {}), project: 'none' };
check(!mayBegin(st, hh, 'tarpit') && !mayBegin(st, hh, 'cart'), 'a head holding off projects: none, the cart as the others (VB-678 closed)');
hp.chosen = was;
const two = VB['sim/projectplans'].makeProject(st, 'household', hh.id, { what: 'barn', steps: [{ kind: 'barnbase', place: f.house, hours: 1 }, { kind: 'barnroof', place: f.house, hours: 1 }] });
check(!stepEnds(st, { kind: 'barnroof', site: f.house }, hh, effect) && ran === 1, 'a later step not yet open: no effect');
check(stepEnds(st, { kind: 'barnbase', site: f.house }, hh, effect) && ran === 2 && Projects.openOf(st, hh.id) === two.steps[1], 'the open step ends: the next opens');
check(!stepEnds(st, { kind: 'barnbase', site: f.house }, hh, effect) && ran === 2, 'the step before, ended again: nothing');
// the barn's holder is the job's owner, not the hand's household
const { KINDS } = VB['sim/kinds'], other = st.households.find((h) => h.id !== hh.id && !h.dissolved);
KINDS.barnroof.done(st, { kind: 'barnroof', site: f.house, farm: f, owner: { type: 'household', id: other.id } }, hh);
check(Projects.openOf(st, hh.id) === two.steps[1] && !f.barn, "another household's barn job: not this holder's step");
KINDS.barnroof.done(st, { kind: 'barnroof', site: f.house, farm: f, owner: { type: 'household', id: hh.id } }, other);
check(!Projects.ownOf(st, hh.id) && f.barn && f.barn.built === st.t, 'its owner\'s roof on: the farm has its barn, the plan done');

if (failed) { console.error(`beginend: ${failed} failed`); process.exit(1); }
console.log('beginend ok');
