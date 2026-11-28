// @suite fast
// A farm's own cottage is its site's (VB-1937, sim/sites farmSite; once a project plan of its household, VB-1411): beside its first
// field's plan, which stays the household's project of its own choosing; the house tile's steps, then the cottage's stage, posted as the
// household's own jobs; its timber goes to its walls from the start; each job ends its own; the roof ends the site and the shelter's rung,
// the timber left over to the woodpile; a household dissolved leaves it with the farm, for the household that comes. On a tiny world,
// through the rules.
const VB = require('../src/load.js'), Projects = VB['sim/projects'], Sites = VB['sim/sites'], Bld = VB['sim/building'];
const { KINDS } = VB['sim/kinds'], { stake } = VB['sim/stakes'];
const { BUILD, ECON, cal } = VB['sim/rules'];
const { checkState } = require('./lib/invariants.js');
const { tinyWorld, tinyState, tileAt } = require('./lib/tiny.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('COTTAGEPLAN FAIL:', m); } };

const rows = Array.from({ length: 16 }, () => [...Array(24)].map((_, c) => (c >= 16 ? 'F' : '.')).join(''));
const st = tinyState(tinyWorld(rows), [{ at: [6, 8], farms: 2, sizes: [4, 4] }], { seed: 5 }), v = st.villages[0], w = st.w;
const f = st.farmsteads[v.farmsteads[0]], hh = st.households[f.household], field = tileAt(w, 3, 12);
f.rung = 'shelter'; // as sim/scenarios landAlone: no cottage yet, its field's plan and its cottage's site
stake(st, hh, field, 'field');
const land = VB['sim/projectplans'].makeProject(st, 'household', hh.id, { what: 'field', steps: [{ kind: 'break', place: field, hours: 30, stake: 'field' }] });
const s = Sites.farmSite(st, f);
check(Sites.ofFarm(st, f.id) === s && s.farm === f.id && s.leader === null && s.field === null && s.booth === null && s.stage === 'building',
  'the farm\'s own site: no leader, no field, no booth, being built');
check(s.plot.steps.map((k) => k.kind).join() === 'foundation,walls,roof' && Sites.wallsOf(s).wood === 0 && s.plot.places[0].steps.length === 0,
  `the site: the three stages, the walls with their wood, the meadow house tile with no step (${s.plot.places[0].steps})`);
check(!checkState(st).length, `invariants with the site: ${checkState(st).slice(0, 3)}`);
check(Projects.ownOf(st, hh.id) === land && Projects.openOf(st, hh.id) === land.steps[0], 'the project of its own choosing is the field');
check(Projects.mayBegin(st, hh, 'cart') && Projects.mayBegin(st, hh, 'boat'), 'a farm at its shelter may begin a small construction (VB-1414)');

// posted: the field's step by landProject, the cottage's stage by the site's farmWork, as the household's own (no party); never one for the other
const posts = (fn) => { const out = []; fn(st, hh, f, cal(st.t), (key, site, extra, kind, owner) => out.push({ key, site, extra, kind, owner })); return out; };
const lp = posts(Projects.landProject), fw = posts(Sites.farmWork);
check(lp.length === 1 && lp[0].key === `break:f${f.id}` && lp[0].site === field, `landProject posts the field's step alone (${lp.map((p) => p.key)})`);
check(fw.length === 1 && fw[0].key === `site:s${s.id}.cottage` && fw[0].kind === 'foundation' && fw[0].site === f.house && fw[0].extra.siteId === s.id &&
  !fw[0].extra.party && fw[0].owner === undefined, `farmWork posts the cottage's open stage as the household's (${fw.map((p) => p.key)})`);
const island = []; Sites.siteWork(st, null, null, cal(st.t), (key) => island.push(key));
check(island.length === 0, `the island's site work posts none of a farm's own (${island})`);

// timber: from the start, to the site's walls
const trips = () => { const out = []; Bld.timberWork(st, null, null, cal(st.t), (key, site, extra) => out.push({ key, extra })); return out; };
const walls = Sites.wallsOf(s);
let t = trips();
check(v.wood.length > 0 && t.length === 2 && t.every((j) => j.extra.timberFor === walls && j.key.startsWith(`timber:s${s.id}`)),
  `the cottage's timber goes to its walls (${t.map((j) => j.key)})`);
check(Projects.timberOf(st, f).length === 0, 'not as a step carrying timber: no second set of trips');

// each job ends its own
const job = (kind, site, extra = {}) => ({ kind, site, farm: f, owner: { type: 'household', id: hh.id }, ...extra });
KINDS.walls.done(st, job('walls', f.house, { siteId: s.id, cottage: true }), hh);
check(s.plot.open === 0, 'a stage that is not the open one ends nothing');
KINDS.foundation.done(st, job('foundation', f.house, { siteId: s.id, cottage: true }), hh);
check(s.plot.open === 1 && Projects.projectsOf(st, 'household', hh.id).includes(land) && land.open === 0, 'the foundation laid: the walls open, the field untouched');
check(posts(Sites.farmWork).length === 0, 'the walls wait for their timber');
const nf = f.fields.length;
KINDS.break.done(st, job('break', field), hh);
check(!Projects.projectsOf(st, 'household', hh.id).includes(land) && f.fields.length === nf + 1 && s.plot.open === 1, 'the field broken: its plan ends, the cottage goes on');
walls.wood = BUILD.timber + 2 * ECON.woodPerTrip;
check(posts(Sites.farmWork)[0].kind === 'walls' && trips().length === 0, 'its timber brought: the walls posted, no trip');
KINDS.walls.done(st, job('walls', f.house, { siteId: s.id, cottage: true }), hh);
check(s.plot.open === 2 && walls.wood === 2 * ECON.woodPerTrip, 'the walls raised take their timber');
const wood = hh.wood, n = st.households.length;
KINDS.roof.done(st, job('roof', f.house, { siteId: s.id, cottage: true }), hh);
check(!f.rung && Sites.ofFarm(st, f.id) === null && !st.sites.includes(s) && st.households.length === n,
  'the roof on: the farm has its cottage, the site ends, nothing is founded');
check(hh.wood === wood + 2 * ECON.woodPerTrip, 'the timber left over goes to the woodpile');
check(!checkState(st).length, `invariants after the roof: ${checkState(st).slice(0, 3)}`);

// a household dissolved: its farm's site stays with the farm, its work with it, for the household that comes
const g = st.farmsteads[v.farmsteads[1]], gh = st.households[g.household];
g.rung = 'shelter';
const gs = Sites.farmSite(st, g);
gs.plot.open = 1; Sites.wallsOf(gs).wood = 6;
VB['sim/projectplans'].dropAll(st, 'household', gh.id);
check(Sites.ofFarm(st, g.id) === gs && gs.plot.open === 1 && Sites.wallsOf(gs).wood === 6, 'its household dissolved: the site stays with the farm');
const prev = g.household;
g.household = null;
check(VB['sim/cottageplan'].farmTimber(st, g) === null, 'a farm with no household fetches no timber for its site');
g.household = prev;
check(VB['sim/cottageplan'].farmTimber(st, g).owner.id === prev, 'the household that comes owns its work');

// thick scrub on an unwooded house tile (VB-1937, its review): the farm's yard already, neither felled nor grubbed, as the cottage plan had it
{
  const t = tileAt(w, 8, 3), was = [w.trees[t], w.treesMax[t]];
  w.treesMax[t] = 10; w.trees[t] = 10; // a test's write: thick scrub on a meadow tile
  check(Sites.houseSteps(st, t).length === 0, `a thick-scrub, unwooded house tile has no steps (${Sites.houseSteps(st, t)})`);
  [w.trees[t], w.treesMax[t]] = was;
}
if (failed) process.exit(1);
console.log('cottageplan ok: a farm\'s own cottage its site, beside the field, each job ending its own, timber to its walls, the roof ending it');
