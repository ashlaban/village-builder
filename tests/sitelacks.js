// What a building site lacks (VB-1407): one read, sim/projects' lacks, for the timber trips and the waits; a step that carries `timber`
// gets its trips whatever its kind, one without none (no cottage's default); a plot's walls step is reached by its kind; an open stage's
// hours kept while its job is posted again (sim/progress keptDone). On a tiny world, through the rules, not a run.
const VB = require('../src/load.js'), Projects = VB['sim/projects'], Bld = VB['sim/building'], Plans = VB['sim/plans'], J = VB['sim/jobs'];
const { keptDone } = VB['sim/progress'];
const { BUILD, ECON, cal } = VB['sim/rules'];
const { tinyWorld, tinyState, tileAt } = require('./lib/tiny.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('SITELACKS FAIL:', m); } };

// the read: loads still to bring for the need its site's module names, none below nothing
const { lacks, stepOf } = Projects, waits = (s) => lacks(s, s.timber) > 0; // a step waits by what it lacks of its own timber
check(lacks({ wood: 2 }, 6) === 4 && lacks({}, 6) === 6 && lacks({ wood: 7 }, 6) === 0, 'loads lacking: the need less the wood brought');
check(lacks({ wood: 0 }, 0) === 0 && lacks({ wood: 0 }, undefined) === 0, 'a site that needs nothing lacks nothing');
check(waits({ kind: 'boat', wood: 3, timber: 6 }) && !waits({ kind: 'boat', wood: 6, timber: 6 }), 'a step with timber waits until it lacks none');
check(!waits({ kind: 'tarpit', wood: 0 }), 'a step without timber waits for none (no cottage default)');

const rows = Array.from({ length: 16 }, (_, r) => [...Array(24)].map((_, c) => (c >= 16 ? 'F' : '.')).join(''));
const st = tinyState(tinyWorld(rows), [{ at: [6, 8], farms: 2, sizes: [4, 4] }], { seed: 5 }), v = st.villages[0], w = st.w;
const asked = () => { const out = []; Bld.timberWork(st, null, null, cal(st.t), (key, site, extra, kind, owner) => out.push({ key, site, extra, kind, owner })); return out; };
check(v.wood.length > 0 && asked().length === 0, 'no site, no trip');

// a plot's walls step by name: the plot's wood lies there, and its trips carry to it
const house = tileAt(w, 10, 3), field = tileAt(w, 11, 4);
const stage = (kind, hours) => ({ kind, place: house, hours, done: 0, ...(kind === 'walls' ? { wood: 0 } : {}) });
const plot = Plans.makeProject(st, 'village', v.id, { what: 'plot', plot: 0, intended: null, to: { type: 'village', id: v.id }, hours: {}, started: st.t,
  steps: [{ kind: 'clear', places: [{ tile: house, kind: 'house', steps: [], i: 0 }, { tile: field, kind: 'field', steps: [], i: 0 }] },
    stage('foundation', 30), stage('walls', 60), stage('roof', 30)] });
Plans.advance(st, plot);
const walls = stepOf(plot, 'walls');
check(walls === plot.steps[2] && stepOf(plot, 'kiln') === undefined, 'the walls step found by its kind');
let jobs = asked();
check(jobs.length === 2 && jobs.every((j) => j.extra.timberFor === walls && j.key.startsWith(`timber:v${v.id}.0`)), `a plot's walls lacking ${BUILD.timber} loads: two trips (${jobs.length})`);
walls.wood = BUILD.timber - ECON.woodPerTrip;
check(asked().length === 1, 'one load short: one trip');
walls.wood = BUILD.timber;
check(asked().length === 0, 'its timber brought: no trip');
plot.open = 3; walls.wood = 0; // the walls stand: the roof needs none
check(asked().length === 0, 'once the walls stand the site lacks nothing');

// a household's open step: one carrying timber (whatever its kind) gets its trips, one without none
const f = st.farmsteads[v.farmsteads[0]], hid = f.household;
const step = { kind: 'tarpit', place: f.house, hours: 10, wood: 0 };
const plan = Plans.makeProject(st, 'household', hid, { what: 'tarpit', steps: [step] });
check(Projects.openOf(st, hid) === step && Projects.timberOf(st, f) === null && asked().length === 0, 'a step without timber: no trip');
step.timber = 4; // any step that carries timber: no list of kinds
jobs = asked();
check(jobs.length === 2 && jobs.every((j) => j.key.startsWith(`timber:b${f.id}`) && j.extra.timberFor === step && j.owner.id === hid && j.extra.dest === f.house),
  `a step carrying timber gets its trips, the household's (${jobs.length})`);
check(plan.steps[0] === step, 'the plan holds its step');

// the kept hours: the record's own while no job is posted, the live job's progress when one is
check(keptDone(st, 'none:here', 30, 7) === 7, 'no live job: the record keeps its hours');
const j = J.post(st, 'kept:test', 'timber', { type: 'village', id: v.id }, house, { village: v.id, timberFor: walls, dest: house });
j.done = 5; j.rate = 0;
check(keptDone(st, 'kept:test', 30, 0) === 5, 'a live job: its hours done now');

if (failed) { console.error(`sitelacks: ${failed} failed`); process.exit(1); }
console.log('sitelacks ok');
