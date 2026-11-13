// VB-253: the player as head. Every choice of a household's plan is a verb of sim/commands (target, tile, order, project, dropProject),
// which the player in its head issues through Sim.head and the holder's own rule through the land step (source 'pawn'). On a tiny world
// at seed 7: only the head may choose; a tile is chosen and the field is made there; a refused tile returns its reason; a raised hay
// target is met by the next winter; a target, the hold on projects, the order and the project under way are set, checked and cleared.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim;
const { tinyWorld, tinyState, tileAt } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const { DAY, cal } = VB['sim/rules'], F = VB['sim/fields'], M = VB['sim/meadows'], P = VB['sim/plans'], C = VB['sim/commands'];
const Projects = VB['sim/projects'], { winterNeed } = VB['sim/herds'], { cowWanted } = VB['sim/exchange'];
const map = Array.from({ length: 12 }, () => '.'.repeat(20));
// One village of three farms: household 0 (8 people) wants more fields than it has.
function scene(opt = {}) {
  const st = tinyState(tinyWorld(map), [{ at: [9, 6], farms: 3, sizes: [8, 3, 6] }], { seed: 7, ...opt });
  const hh = st.households[0], f = st.farmsteads[hh.farmstead], plan = st.plans.households.get(hh.id);
  return { st, hh, f, plan };
}
const sound = (st, label) => { Sim.refreshRoles(st); const bad = checkState(st); assert.deepStrictEqual(bad.slice(0, 3), [], `${label}: invariants`); };
const snap = (st, hh) => JSON.stringify([st.plans.households.get(hh.id), st.plans.seasons.get(hh.id), Projects.projectOf(st, 'household', hh.id)]);
let refusals = 0;
// A refusal returns its reason, a string matching re, and changes nothing of the plan.
const refused = (st, hh, got, re, label) => {
  assert.ok(typeof got === 'string' && re.test(got), `${label}: refused with ${JSON.stringify(got)}`);
  refusals++;
};

{ // only the head: no pawn played, a pawn that is not the head, a household with no plan, a verb that is not a choice of the plan
  const { st, hh, f } = scene(), before = snap(st, hh);
  refused(st, hh, Sim.head(st, 'target', { store: 'hay', n: 3 }), /no pawn is played/, 'no player');
  const other = hh.members.find((id) => id !== hh.holder && Sim.inhabit(st, id) === true);
  refused(st, hh, Sim.head(st, 'target', { store: 'hay', n: 3 }), /is not the head of household 0/, 'a member that is not the head');
  refused(st, hh, Sim.head(st, 'tile', { what: 'field', tile: F.pickField(st, f, hh) }), /is not the head/, 'its tile');
  refused(st, hh, Sim.head(st, 'order', { steps: [...st.plans.seasons.get(hh.id).steps].reverse() }), /is not the head/, 'its order');
  refused(st, hh, Sim.head(st, 'project', { what: 'none' }), /is not the head/, 'its project');
  refused(st, hh, Sim.head(st, 'dropProject', {}), /is not the head/, 'dropping its project');
  refused(st, hh, Sim.head(st, 'kill', {}), /not a choice of the plan/, 'another verb');
  // another household's head, issued directly: the verb's own check
  refused(st, hh, Sim.command(st, { actor: st.households[1].holder, verb: 'target', target: hh.id, args: { store: 'hay', n: 3 }, source: 'player' }),
    /is not the head of household 0/, "another household's head");
  refused(st, hh, Sim.command(st, { actor: { household: hh.id }, verb: 'target', target: hh.id, args: { store: 'hay', n: 3 }, source: 'pawn' }),
    /only the head/, 'the household itself while it has a holder');
  refused(st, hh, Sim.command(st, { actor: other, verb: 'target', target: 99, args: { store: 'hay', n: 3 }, source: 'player' }), /no household 99/, 'no such household');
  assert.strictEqual(snap(st, hh), before, 'refusals change nothing');
}

let made;
{ // the tile: refused with its reason; chosen, the land step begins the field there and the field is made there
  const { st, hh, f, plan } = scene();
  assert.strictEqual(Sim.inhabit(st, hh.holder), true);
  const own = F.pickField(st, f, hh), before = snap(st, hh);
  assert.ok(f.fields.length < plan.targets.fields && own >= 0, 'the household wants a field and has a tile to pick');
  const other = st.farmsteads[st.households[2].farmstead];
  refused(st, hh, Sim.head(st, 'tile', { what: 'field', tile: other.fields[0].tile }), /claimed|in use/, "another farm's field");
  refused(st, hh, Sim.head(st, 'tile', { what: 'field', tile: tileAt(st.w, 0, 0) }), /not within \d+ steps' walk/, 'a tile out of reach');
  refused(st, hh, Sim.head(st, 'tile', { what: 'field', tile: f.house }), /the house stands there/, 'the house');
  refused(st, hh, Sim.head(st, 'tile', { what: 'field', tile: st.w.N }), /no tile/, 'no such tile');
  refused(st, hh, Sim.head(st, 'tile', { what: 'pond', tile: own }), /no land project pond/, 'no such land');
  assert.strictEqual(snap(st, hh), before, 'refused tiles change nothing');
  // a tile the head may take that is not its rule's pick
  let tile = -1;
  for (let t = 0; t < st.w.N && tile < 0; t++) if (t !== own && F.fieldWhy(st, f, hh, t) === null) tile = t;
  assert.ok(tile >= 0, 'another tile will do');
  assert.strictEqual(Sim.head(st, 'tile', { what: 'field', tile }), true, 'the tile is chosen');
  assert.strictEqual(plan.tiles.field, tile);
  assert.strictEqual(Sim.headView(st, hh.id).tiles.field, tile, 'the page reads it');
  assert.strictEqual(Sim.head(st, 'tile', { what: 'field', tile: null }), true, 'and cleared');
  assert.strictEqual(plan.tiles.field, -1);
  assert.strictEqual(Sim.head(st, 'tile', { what: 'field', tile }), true);
  let d = 0;
  while (!Projects.projectOf(st, 'household', hh.id) && d++ < 12) Sim.advance(st, DAY);
  const p = Projects.projectOf(st, 'household', hh.id);
  assert.ok(p && p.what === 'field' && p.steps[0].place === tile, `the land step begins the field on the chosen tile (${p && p.steps[0].place}, not ${tile})`);
  assert.strictEqual(plan.tiles.field, -1, 'the tile is used');
  refused(st, hh, Sim.head(st, 'project', { what: 'field' }), /has a field under way/, 'a second project');
  for (d = 0; !f.fields.some((fd) => fd.tile === tile) && d < 60; d++) Sim.advance(st, DAY);
  assert.ok(f.fields.some((fd) => fd.tile === tile), 'the field is made on the chosen tile');
  made = d;
  sound(st, 'a chosen tile');
}

{ // the project: begun at once on a tile, given up, held off and let go again
  const { st, hh, f, plan } = scene();
  Sim.inhabit(st, hh.holder);
  const own = F.pickField(st, f, hh);
  refused(st, hh, Sim.head(st, 'dropProject', {}), /no project under way/, 'nothing to drop');
  refused(st, hh, Sim.head(st, 'project', { what: 'boat' }), /no land project boat/, "a project of VB-255's menu");
  refused(st, hh, Sim.head(st, 'project', { what: 'field', tile: f.house }), /the house stands there/, 'a project on a tile that will not do');
  assert.strictEqual(Sim.head(st, 'project', { what: 'field' }), true, "a field begun now, on the holder's pick");
  let p = Projects.projectOf(st, 'household', hh.id);
  assert.ok(p && p.what === 'field' && p.steps[0].place === own, 'on the tile its rule would pick');
  refused(st, hh, Sim.head(st, 'dropProject', { id: p.id + 1 }), /no project \d+ under way/, 'another project');
  assert.strictEqual(Sim.head(st, 'dropProject', { id: p.id, hold: true }), true, 'given up, and projects held off');
  assert.strictEqual(Projects.projectOf(st, 'household', hh.id), null, 'no project');
  assert.ok(Projects.heldOff(st, hh.id) && Sim.headView(st, hh.id).heldOff, 'held off');
  assert.ok(Sim.villageLog(st, Infinity).some((e) => /its head chose to/.test(e.text)), 'told in the log');
  for (let d = 0; d < 6; d++) Sim.advance(st, DAY);
  assert.strictEqual(Projects.projectOf(st, 'household', hh.id), null, 'its rule begins none while the head holds off');
  assert.ok(f.fields.length < plan.targets.fields, 'though it wants a field');
  assert.strictEqual(Sim.head(st, 'project', { what: null }), true, 'let go');
  assert.ok(!Projects.heldOff(st, hh.id));
  for (let d = 0; !Projects.projectOf(st, 'household', hh.id) && d < 12; d++) Sim.advance(st, DAY);
  p = Projects.projectOf(st, 'household', hh.id);
  assert.ok(p && p.what === 'field', 'and its rule begins a field again');
  assert.strictEqual(Sim.head(st, 'project', { what: 'none' }), true, 'held off with a project under way: it goes on');
  assert.ok(Projects.projectOf(st, 'household', hh.id) && Projects.heldOff(st, hh.id));
  sound(st, 'projects');
}

{ // the targets: within their bounds, lasting over the season's plan, cleared; the order, until the next season's plan
  const { st, hh, plan } = scene({ herds: true });
  Sim.inhabit(st, hh.holder);
  const T = plan.targets, before = snap(st, hh), was = { hay: T.hayWinters, wood: [...T.wood], fields: T.fields };
  refused(st, hh, Sim.head(st, 'target', { store: 'hay', n: 3.5 }), /hay must be from 0 to 3/, 'hay over three winters');
  refused(st, hh, Sim.head(st, 'target', { store: 'hay', n: -1 }), /hay must be from 0 to 3/, 'hay below none');
  refused(st, hh, Sim.head(st, 'target', { store: 'fields', n: T.workable + 1 }), /fields must be from 0 to/, 'more fields than the hands can till');
  refused(st, hh, Sim.head(st, 'target', { store: 'fields', n: 1.5 }), /whole number/, 'half a field');
  refused(st, hh, Sim.head(st, 'target', { store: 'wood', n: 2 * st.ECON.woodWinter + 1 }), /wood must be from 0 to/, "wood over twice the winter's goal");
  refused(st, hh, Sim.head(st, 'target', { store: 'cow', n: 2 }), /cow must be from 0 to 1/, 'two cows');
  refused(st, hh, Sim.head(st, 'target', { store: 'ale', n: 1 }), /no target ale/, 'no such target');
  refused(st, hh, Sim.head(st, 'target', { store: 'hay' }), /names n/, 'no number');
  assert.strictEqual(snap(st, hh), before, 'refused targets change nothing');
  assert.strictEqual(Sim.head(st, 'target', { store: 'hay', n: 3 }), true);
  assert.strictEqual(Sim.head(st, 'target', { store: 'wood', n: 2 * st.ECON.woodWinter }), true);
  assert.strictEqual(Sim.head(st, 'target', { store: 'fields', n: 0 }), true);
  assert.strictEqual(Sim.head(st, 'target', { store: 'cow', n: 0 }), true);
  assert.deepStrictEqual([T.hayWinters, T.wood, T.fields], [3, Array(4).fill(2 * st.ECON.woodWinter), 0], 'the targets are the head\'s at once');
  const V = Sim.headView(st, hh.id);
  assert.deepStrictEqual(V.targets.hay, { now: 3, chosen: 3, bounds: [0, 3] }, 'the page reads the target, the choice and the bounds');
  assert.deepStrictEqual(V.targets.fields.bounds, [0, T.workable]);
  { // a save carries the choices
    const st2 = Sim.load(st.w, JSON.parse(JSON.stringify(Sim.save(st))));
    assert.deepStrictEqual(Sim.headView(st2, hh.id), Sim.headView(st, hh.id), 'a loaded run holds the head\'s choices');
  }
  // the order of the season's routines
  const sp = () => st.plans.seasons.get(hh.id), steps = [...sp().steps], turned = [...steps].reverse();
  refused(st, hh, Sim.head(st, 'order', { steps: steps.slice(1) }), /each of the season's/, 'a routine left out');
  refused(st, hh, Sim.head(st, 'order', { steps: [steps[0], ...steps.slice(0, -1)] }), /each of the season's/, 'a routine twice');
  refused(st, hh, Sim.head(st, 'order', { steps: ['nothing', ...steps.slice(1)] }), /not a routine of the season/, 'a routine of no season');
  assert.strictEqual(Sim.head(st, 'order', { steps: turned }), true);
  assert.deepStrictEqual([sp().steps, sp().by, Sim.headView(st, hh.id).orderBy], [turned, 'head', 'head'], 'the order is the head\'s');
  const season = cal(st.t).season;
  for (let d = 0; (cal(st.t).season === season || sp().season === season) && d < 30; d++) Sim.advance(st, DAY);
  assert.ok(sp().season !== season && sp().by === undefined, "the next season's plan is the template's again");
  assert.strictEqual(Sim.headView(st, hh.id).orderBy, 'template');
  assert.deepStrictEqual([T.hayWinters, T.wood, T.fields], [3, Array(4).fill(2 * st.ECON.woodWinter), 0], 'the targets last over the season\'s plan');
  assert.strictEqual(Projects.projectOf(st, 'household', hh.id), null, 'with no field wanted its rule begins none');
  assert.strictEqual(cowWanted(st, hh), false, 'no cow wanted');
  for (const store of ['hay', 'wood', 'fields', 'cow']) assert.strictEqual(Sim.head(st, 'target', { store, n: null }), true, `${store} cleared`);
  for (let d = 0; d < 6; d++) Sim.advance(st, DAY); // a review within its planning days
  assert.strictEqual(T.fields, F.fieldsWanted(st, hh, T.workable), "the fields are the rule's again at the next review");
  for (let d = 0; sp().season !== 0 && d < 60; d++) Sim.advance(st, DAY);
  for (let d = 0; d < 6; d++) Sim.advance(st, DAY);
  assert.deepStrictEqual([T.hayWinters, T.wood], [was.hay, was.wood], "and hay and wood the template's from the next season's plan");
  sound(st, 'targets and order');
}

{ // a cow wanted by the head's choice, whatever its hands, while it holds a meadow and has no cattle
  const { st, hh, f } = scene({ herds: true });
  Sim.inhabit(st, hh.holder);
  for (const id of hh.herds) if (st.herds[id].species === 'cattle') st.herds[id].head.length = 0;
  assert.ok(f.meadows.length > 0);
  assert.strictEqual(Sim.head(st, 'target', { store: 'cow', n: 0 }), true);
  assert.strictEqual(cowWanted(st, hh), false, 'none wanted');
  assert.strictEqual(Sim.head(st, 'target', { store: 'cow', n: 1 }), true);
  assert.strictEqual(cowWanted(st, hh), true, 'wanted');
}

// a raised hay target is met by the next winter: a household with meadows for more than its animals' need rakes and mows for two winters by its
// template (the meadows mown together overshoot it) and for three by its head's choice
const hay = [];
for (const raise of [false, true]) {
  const { st, hh, f } = scene({ herds: true });
  for (const id of hh.herds) { // a cow and five ewes: three winters' need is within what the four meadows give, raked
    const hd = st.herds[id];
    if (hd.species === 'cattle') hd.head.length = 1; else { hd.ewes = 5; hd.rams = 0; hd.lambs = 0; }
  }
  Sim.inhabit(st, hh.holder);
  if (raise) assert.strictEqual(Sim.head(st, 'target', { store: 'hay', n: 3 }), true);
  let peak = 0, need = 0;
  while (cal(st.t).season !== 3) { Sim.advance(st, DAY); if (hh.hay > peak) { peak = hh.hay; need = winterNeed(st, hh); } }
  hay.push({ peak, need, winters: peak / need, atWinter: hh.hay / winterNeed(st, hh), meadows: f.meadows.length, expected: M.expectedHay(f) });
  if (raise) sound(st, 'a raised hay target');
}
const w = (x) => x.toFixed(2);
assert.ok(hay[0].atWinter >= 2 && hay[0].atWinter < 3, `by its template the household holds two winters' hay at the start of winter (${w(hay[0].atWinter)})`);
assert.ok(hay[1].winters >= 3 && hay[1].atWinter >= 3,
  `by its head's choice three (${w(hay[1].atWinter)} winters of ${hay[1].need.toFixed(1)}, ${w(hay[1].winters)} at its peak; meadows give ${hay[1].expected})`);

{ // the holder's own rule goes through the verb: a household with no player, and one with no holder, begin their fields by `project`
  const { st, hh, f } = scene();
  let d = 0;
  while (!Projects.projectOf(st, 'household', hh.id) && d++ < 12) Sim.advance(st, DAY);
  assert.ok(Projects.projectOf(st, 'household', hh.id), 'with no player the land step begins a field');
  assert.strictEqual(st.plans.households.get(hh.id).chosen, undefined, 'and no choice is recorded');
  const h2 = st.households[2], f2 = st.farmsteads[h2.farmstead];
  if (!Projects.projectOf(st, 'household', h2.id)) {
    const t = F.pickField(st, f2, h2);
    refused(st, h2, Sim.command(st, { actor: { household: h2.id }, verb: 'project', target: h2.id, args: { what: 'field', tile: t }, source: 'pawn' }),
      /only the head/, 'the household itself while it has a holder');
    assert.strictEqual(Sim.command(st, { actor: h2.holder, verb: 'project', target: h2.id, args: { what: 'field', tile: t }, source: 'pawn' }), true, "the holder's rule's verb");
    assert.strictEqual(Projects.projectOf(st, 'household', h2.id).steps[0].place, t);
  }
  assert.deepStrictEqual(Object.keys(C.VERBS).filter((v) => ['target', 'tile', 'order', 'project', 'dropProject'].includes(v)).length, 5, 'the five verbs of the plan');
  assert.ok(typeof P.headView === 'function' && Sim.headView(st, 99) === null, 'no view of a household with no plan');
  sound(st, 'the holder\'s rule');
}
console.log(`head ok: only the head chooses; a chosen tile's field made there in ${made} days; ${refusals} refusals with their reasons change nothing; ` +
  `targets, order and the hold on projects set and cleared; hay at the start of winter ${w(hay[0].atWinter)} winters by the template, ${w(hay[1].atWinter)} by a target of 3`);
