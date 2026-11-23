// A settler household's cottage is a project plan of its household beside its first field's (VB-1411): each job ends its own plan; the
// cottage's stage is posted under the booth's key, its timber goes to its walls from the foundation on, and its roof ends the booth; the
// guards do not count it; a household dissolved leaves it with the farm, for the household that comes. On a tiny world, through the rules.
const VB = require('../src/load.js'), Projects = VB['sim/projects'], Plans = VB['sim/plans'], Bld = VB['sim/building'], X = VB['sim/expansion'];
const { KINDS } = VB['sim/kinds'], { stake } = VB['sim/stakes'];
const { BUILD, ECON, cal } = VB['sim/rules'];
const { tinyWorld, tinyState, tileAt } = require('./lib/tiny.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('COTTAGEPLAN FAIL:', m); } };

const rows = Array.from({ length: 16 }, () => [...Array(24)].map((_, c) => (c >= 16 ? 'F' : '.')).join(''));
const st = tinyState(tinyWorld(rows), [{ at: [6, 8], farms: 2, sizes: [4, 4] }], { seed: 5 }), v = st.villages[0], w = st.w;
const f = st.farmsteads[v.farmsteads[0]], hh = st.households[f.household], field = tileAt(w, 3, 12);
f.booth = true; // as sim/settle's settleFarm: the household in a booth, its field's plan and its cottage's
stake(st, hh, field, 'field');
const land = VB['sim/projectplans'].makeProject(st, 'household', hh.id, { what: 'field', steps: [{ kind: 'break', place: field, hours: 30, stake: 'field' }] });
const home = VB['sim/projectplans'].makeProject(st, 'household', hh.id, VB['sim/cottageplan'].cottagePlan(f));
check(home.what === 'cottage' && home.steps.map((s) => s.kind).join() === 'foundation,walls,roof' && Projects.stepOf(home, 'walls').wood === 0,
  'the cottage plan: the plot\'s three stages, the walls with their wood');
check(Projects.ownOf(st, hh.id) === land && Projects.openOf(st, hh.id) === land.steps[0], 'the project of its own choosing is the field, not the cottage');
check(Projects.mayBegin(st, hh, 'cart') && Projects.mayBegin(st, hh, 'boat'), 'a farm with a booth may begin a small construction (VB-1414)');

// posted: the field's step by landProject, the cottage's stage under the booth's key by boothWork; never one for the other
const posts = (fn) => { const out = []; fn(st, hh, f, cal(st.t), (key, site, extra, kind) => out.push({ key, site, extra, kind })); return out; };
const lp = posts(Projects.landProject), bw = posts(Bld.boothWork);
check(lp.length === 1 && lp[0].key === `break:f${f.id}` && lp[0].site === field, `landProject posts the field's step alone (${lp.map((p) => p.key)})`);
check(bw.length === 1 && bw[0].key === `booth:f${f.id}` && bw[0].kind === 'foundation' && bw[0].site === f.house && bw[0].extra.booth,
  `boothWork posts the cottage's open stage (${bw.map((p) => p.key)})`);

// timber: from the foundation on, to the cottage's walls, under the booth's key
const trips = () => { const out = []; Bld.timberWork(st, null, null, cal(st.t), (key, site, extra) => out.push({ key, extra })); return out; };
const walls = Projects.stepOf(home, 'walls');
let t = trips();
check(v.wood.length > 0 && t.length === 2 && t.every((j) => j.extra.timberFor === walls && j.key.startsWith(`timber:f${f.id}`)),
  `the cottage's timber goes to its walls from the foundation on (${t.map((j) => j.key)})`);
check(Projects.timberOf(st, f).length === 0, 'not as a step carrying timber: no second set of trips');

// each job ends its own plan
const job = (kind, site, extra = {}) => ({ kind, site, farm: f, owner: { type: 'household', id: hh.id }, ...extra });
KINDS.foundation.done(st, job('foundation', field, { booth: true }), hh);
check(home.open === 0, 'a stage job elsewhere ends nothing');
KINDS.foundation.done(st, job('foundation', f.house, { booth: true }), hh);
check(home.open === 1 && Projects.projectsOf(st, 'household', hh.id).includes(land) && land.open === 0, 'the foundation laid: the cottage\'s walls open, the field untouched');
check(posts(Bld.boothWork).length === 0, 'the walls wait for their timber');
const nf = f.fields.length;
KINDS.break.done(st, job('break', field), hh);
check(!Projects.projectsOf(st, 'household', hh.id).includes(land) && f.fields.length === nf + 1 && home.open === 1, 'the field broken: its plan ends, the cottage\'s goes on');
walls.wood = BUILD.timber + 2 * ECON.woodPerTrip;
check(posts(Bld.boothWork)[0].kind === 'walls' && trips().length === 0, 'its timber brought: the walls posted, no trip');
KINDS.walls.done(st, job('walls', f.house, { booth: true }), hh);
check(home.open === 2 && walls.wood === 2 * ECON.woodPerTrip, 'the walls raised take their timber');
const wood = hh.wood;
KINDS.roof.done(st, job('roof', f.house, { booth: true }), hh);
check(f.booth === null && Projects.projectsOf(st, 'household', hh.id).length === 0, 'the roof on: the booth ends, and the plan with it');
check(hh.wood === wood + 2 * ECON.woodPerTrip, 'the timber left over goes to the woodpile');

// a household dissolved: its cottage passes to its village, kept with the farm, and to the household that comes
const g = st.farmsteads[v.farmsteads[1]], gh = st.households[g.household];
g.booth = true;
const gc = VB['sim/projectplans'].makeProject(st, 'household', gh.id, VB['sim/cottageplan'].cottagePlan(g));
gc.open = 1; Projects.stepOf(gc, 'walls').wood = 6;
VB['sim/projectplans'].dropAll(st, 'household', gh.id);
check(Projects.projectsOf(st, 'village', v.id).includes(gc) && gc.holder.type === 'village', 'its household dissolved: the cottage is its village\'s, its work with it');
Plans.makePlan(st, 'household', gh.id); // as a household founded on the farm (sim/membership)
check(Projects.projectsOf(st, 'household', gh.id).includes(gc) && gc.open === 1 && Projects.stepOf(gc, 'walls').wood === 6, 'the household that comes takes it on');

if (failed) process.exit(1);
console.log('cottageplan ok: the cottage a plan beside the field, each job ending its own, timber to its walls, the roof ending the booth');
