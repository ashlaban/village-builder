// Draining a wet field (VB-721): a field's wetness (sim/crops wetLoss, the tile's moisture w.hm) takes a share of its fertility; a ditch
// takes away a share of that loss and silts, read in closed form (sim/soil); the head ditches a wet field by its own estimate, through the
// verb project (sim/drain's making), and pawns dig it at the field. On a small constructed state.
const VB = require('../src/load.js'), Sim = VB.sim, { state } = require('./lib/probe.js');
const { YEAR, DAY } = VB['sim/rules'], { WET, wetLoss } = VB['sim/crops'], Soil = VB['sim/soil'], { DITCH } = Soil;
const Drain = VB['sim/drain'], F = VB['sim/fields'], { issue } = VB['sim/commands'], Projects = VB['sim/projects'];
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('DRAIN FAIL:', m); } };
const near = (x, y, e = 1e-9) => Math.abs(x - y) <= e;
const st = state(), w = st.w, f = st.farmsteads.find((x) => x.household !== null && x.fields.length >= 2), hh = st.households[f.household];
const [a, b] = f.fields;
// the loss: none at or below WET.from, WET.most at moisture 1, in proportion between
w.hm[a.tile] = WET.from; check(wetLoss(w, a.tile) === 0, 'a field at WET.from loses nothing');
w.hm[a.tile] = 1; check(near(wetLoss(w, a.tile), WET.most), `moisture 1 loses WET.most (${wetLoss(w, a.tile)})`);
w.hm[a.tile] = (1 + WET.from) / 2; check(near(wetLoss(w, a.tile), WET.most / 2, 1e-6), 'half way, half the loss');
w.hm[b.tile] = 0.1;
check(Soil.wetFactor(st, b) === 1 && Soil.ditchOf(st, b) === 0, 'a dry field keeps its fertility, and has no ditch');
// a ditch takes DITCH.share of the loss away, and silts with the time constant DITCH.years
const loss = wetLoss(w, a.tile);
check(near(Soil.wetFactor(st, a), 1 - loss), 'an undrained wet field loses its whole loss');
st.t = 5 * YEAR; Soil.ditchDug(st, a);
check(near(Soil.wetFactor(st, a), 1 - loss * (1 - DITCH.share)), `a new ditch takes its share away (${Soil.wetFactor(st, a)})`);
st.t = (5 + DITCH.years) * YEAR;
check(near(Soil.ditchOf(st, a), Math.exp(-1), 1e-9), `after DITCH.years the ditch is at e^-1 (${Soil.ditchOf(st, a)})`);
// the standing crop reads it: the same field, ditched new and undrained
const crop = (fd) => { Object.assign(fd, { crop: 'barley', stage: 'ripe', soil: 1, fert: 1, tilth: 0, weedMiss: 0, weedOpen: false }); return F.standing(st, fd); };
Soil.ditchDug(st, a); const dug = crop(a); delete a.ditch; delete a.ditchAt; const wet = crop(a);
check(near(dug / wet, (1 - loss * (1 - DITCH.share)) / (1 - loss)), `the standing crop gains by the ditch (${dug / wet})`);
// the verb: a dry field is refused; a wet one is begun as a project plan with a ditching step of DITCH.hours
const project = (field) => issue(st, { actor: hh.holder, verb: 'project', target: hh.id, args: { what: 'drain', field }, source: 'player' });
for (const fd of f.fields) fd.stage = 'stubble';
const why = project(b.id);
check(why === 'the field is not wet', `a dry field is not ditched (${why})`);
w.hm[a.tile] = 0.95;
check(Drain.bestField(st, f) === a, 'the head would ditch the wet field: its gain an hour clears the bar');
w.hm[a.tile] = WET.from + 0.02;
check(Drain.bestField(st, f) === null, 'a field hardly wet is not worth its hours');
w.hm[a.tile] = 0.95;
check(project(a.id) === true, 'the wet field is begun');
const plan = Projects.ownOf(st, hh.id);
check(plan && plan.what === 'drain' && plan.field === a.id && plan.steps[0].kind === 'ditch' && near(plan.steps[0].hours, DITCH.hours),
  `the plan: ${JSON.stringify(plan && plan.steps)}`);
check(typeof project(a.id) === 'string', 'one large project at a time');
// pawns walk there and dig it: within the work's days the field is ditched, and no invariant breaks
for (let d = 0; d < 40 && !a.ditch; d++) Sim.advance(st, DAY);
check(a.ditch === 1 && a.ditchAt <= st.t && st.t - a.ditchAt < 40 * DAY, `the field is ditched by the household's hands (${a.ditch})`);
check(!Projects.projectsOf(st, 'household', hh.id).some((p) => p.what === 'drain'), 'the plan is finished');
check(Drain.fieldWhy(st, f, a.id) === 'its ditches are still sound', 'a sound ditch is not dug again');
const bad = checkState(st); check(!bad.length, `invariants: ${bad.slice(0, 3).join('; ')}`);
// a silted ditch is dug again for the share silted
st.t += 2 * DITCH.years * YEAR;
check(near(Drain.ditchHours(st, a), DITCH.hours * (1 - Soil.ditchOf(st, a))), 'a silted ditch is dug again for the share silted');
a.ditch = 1.5; check(checkState(st).some((m) => /ditch/.test(m)), 'invariant misses a ditch above 1');
if (failed) process.exit(1); console.log('drain ok');
