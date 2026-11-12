// Timber (VB-328): a felled plot tile's trees are the plot's wood; a cottage short of BUILD.timber loads for its walls fells the rest in the
// village's wood, trips drawn there and carried to the site, and its walls wait for them; what the walls leave goes to the new household
// up to its winter goal, then to those who worked the plot, the rest burnt; a new household's first wood comes from its members' old homes,
// never leaving a pile under woodLow; settlers bring none. On a tiny world, through the rules, not a run.
const VB = require('../src/load.js'), X = VB['sim/expansion'], Bld = VB['sim/building'], J = VB['sim/jobs'];
const { BUILD, ECON, MATCH, cal } = VB['sim/rules'];
const { tinyWorld, tinyState, tileAt } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('TIMBER FAIL:', m); } };
const rows = Array.from({ length: 16 }, (_, r) => [...Array(24)].map((_, c) => (c >= 16 ? 'F' : '.')).join(''));
const st = tinyState(tinyWorld(rows), [{ at: [6, 8], farms: 3, sizes: [4, 4, 4] }], { seed: 5 }), v = st.villages[0], w = st.w;
v.plots = v.plots || [];
const [h0, h1] = [st.households[0], st.households[1]], holder = h0.members.find((id) => st.pawns[id].age >= 18);
// a plot cleared on open ground: no felled tile, so no wood of its own
const house = tileAt(w, 10, 3), field = tileAt(w, 11, 4);
// its village's project plan (VB-123): cleared, at the cottage's foundation, the timber at the site on its walls step
const Plans = VB['sim/plans'], stage = (kind, hours) => ({ kind, place: house, hours, done: 0, ...kind === 'walls' ? { wood: 0 } : {} });
const plot = Plans.makeProject(st, 'village', v.id, { what: 'plot', plot: v.plots.length, intended: holder, to: holder, hours: {}, started: st.t,
  steps: [{ kind: 'clear', places: [{ tile: house, kind: 'house', steps: [], i: 0 }, { tile: field, kind: 'field', steps: [], i: 0 }] },
    stage('foundation', 30), stage('walls', 60), stage('roof', 30)] });
Plans.advance(st, plot); st.used.add(house); st.used.add(field);
const site = plot.steps[2];
const asked = (fn) => { const out = []; fn(st, null, null, cal(st.t), (key, site, extra, kind, owner) => out.push({ key, site, extra, kind, owner })); return out; };
let jobs = asked(Bld.timberWork);
check(jobs.length === 2 && jobs.every((j) => j.kind === 'timber' && j.owner.type === 'village' && j.extra.timberFor === site && j.extra.dest === house),
  `a cottage with no timber posts two timber trips (${jobs.length})`);
// a trip: its tile is drawn in the village's wood when posted, a tree is felled there, and its load lies at the site
const j = J.post(st, jobs[0].key, 'timber', jobs[0].owner, jobs[0].site, jobs[0].extra), t = j.site, trees = w.trees[t];
check(v.wood.includes(t), `the trip's tile ${t} is in the village's wood`);
VB['sim/kinds'].KINDS.timber.deliver(st, j, h0);
check(site.wood === ECON.woodPerTrip && w.trees[t] === trees - 1, `a trip's load lies at the site (${site.wood}) and its tree is felled`);
check(v.ledger.some((e) => e.kind === 'timber' && e.good === 'timber'), 'the village\'s ledger shows the timber');
// the walls wait for BUILD.timber loads
Plans.advance(st, plot); // the foundation laid
const walls = () => X.plotJobs(st).some((x) => x[3].cottage && x[3].plot === plot && x[1] === 'walls');
check(!walls(), 'the walls wait for their timber');
site.wood = BUILD.timber - ECON.woodPerTrip;
check(asked(Bld.timberWork).length === 1, 'one trip is posted for the last load');
site.wood = BUILD.timber + 7;
check(walls() && asked(Bld.timberWork).length === 0, 'with its timber the walls are raised, and no more is felled');
X.finishStep(st, { plot, cottage: true });
check(site.wood === 7 && X.cottageAt(plot) === 2, `the walls took ${BUILD.timber} loads (${site.wood} left)`);
// a felled plot tile: its trees are the plot's wood
const wooded = tileAt(w, 17, 10), grove = { holder: { type: 'village', id: v.id }, intended: holder, hours: {}, open: 0,
  steps: [{ places: [{ tile: wooded, kind: 'house', steps: ['fell', 'grub', 'clear'], i: 0 }] }, {}, { wood: 0 }] };
const n = Math.floor(w.trees[wooded]); X.finishStep(st, { plot: grove, tr: grove.steps[0].places[0] });
check(grove.steps[2].wood === n * ECON.woodPerTrip && w.trees[wooded] === 0, `a felled tile of ${n} trees gives ${grove.steps[2].wood} loads`);
// what is left: those who worked the plot, most hours first, each up to its winter goal; the rest burnt
const p1 = h1.members[0];
plot.hours = { [holder]: 5, [p1]: 20 }; h0.wood = 30; h1.wood = 35;
const burnt = Bld.shareWood(st, plot, 30);
check(h1.wood === ECON.woodWinter && h0.wood === ECON.woodWinter && burnt === 30 - 5 - 10 && site.wood === 0, `shared: ${h1.wood}, ${h0.wood}; burnt ${burnt}`);
check(h1.ledger.some((e) => e.kind === 'plot' && e.good === 'wood'), 'the ledger shows where the pile came from');
// a new household's first wood: from its members' old homes, never leaving one under woodLow; settlers bring none
const M = VB['sim/membership'], empty = (id) => { const f = st.farmsteads[id]; f.household = null; return f; };
const fA = VB['sim/layout'].makeFarmstead(w, st.farmsteads.length, tileAt(w, 3, 13), [], v, st.used); st.farmsteads.push(fA); v.farmsteads.push(fA.id);
h1.wood = MATCH.urgency.woodLow + 5;
const mover = h1.members.find((id) => id !== h1.holder);
const nh = M.foundHousehold(st, empty(fA.id), [mover], mover);
check(nh.wood === 5 && h1.wood === MATCH.urgency.woodLow, `the first wood from the old home: ${nh.wood}, the old pile keeps ${h1.wood}`);
const fB = VB['sim/layout'].makeFarmstead(w, st.farmsteads.length, tileAt(w, 3, 2), [], v, st.used); st.farmsteads.push(fB); v.farmsteads.push(fB.id);
h0.wood = 40; const settler = h0.members.find((id) => id !== h0.holder && st.pawns[id].household === h0.id);
const sh = M.foundHousehold(st, empty(fB.id), [settler], settler, { carry: false });
check(sh.wood === 0 && h0.wood === 40, `settlers bring no wood (${sh.wood})`);
for (const f of [fA, fB]) VB['sim/territory'].reckonWood(st, st.villages[f.village]);
const bad = checkState(st).filter((m) => !/plot|farmstead|fence|line|booth/.test(m));
check(!bad.length, `invariants: ${bad.slice(0, 3).join('; ')}`);
if (failed) process.exit(1);
console.log(`timber ok: ${BUILD.timber} loads for the walls, trips drawn in the village's wood and carried to the site; a felled tile of ${n} trees `
  + `gives ${n * ECON.woodPerTrip}; the rest shared and burnt; the first wood from the old homes`);
