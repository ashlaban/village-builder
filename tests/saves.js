// @suite integration
// Saves (VB-074): a run saved, written as JSON text, parsed and loaded into a fresh world goes on exactly as the run that was never saved:
// every key of the state (the world aside) has the same canonical text, and the tiles the simulation changes are the same. On small
// islands since VB-853: each scenario on a generated island loaded into one generated again from the save's seed and size, and the probe
// village saved mid-hour and mid-day; the long runs on the default and tiny maps it replaced were deleted (length is not a rule).
const VB = require('../src/load.js'), Sim = VB.sim;
const { canon } = require('./lib/canon.js');
const probe = require('./lib/probe.js');
const TILES = ['trees', 'treesMax', 'stones', 'biome', 'dev', 'wear', 'worn', 'tr', 'tg', 'tb'];
const { YEAR: Y, DAY } = Sim;
let failed = 0; const out = [];
const regenerate = (data) => probe.island(data.seed, data);
// [label, the state, its world again from the save, hours before the save, hours after]. The founders are saved in early autumn and run on
// across the autumn meetings and the moving round; heirs and populous a few days in, their seeded history and herds already in play; the
// probe's two (which spread.js also saves between the phases of the meetings and the round) are saved mid-hour, when
// the idle pawns of the hour were drawn earlier in it (st.idlers), the second mid-day, between talk turns (VB-521). Both runs make the
// same advance calls after the save: steps of 6 minutes add up differently in other chunks.
for (const [label, make, restore, before, after] of [
  ['founders 42', () => probe.scenario('founders', 42), regenerate, 0.6 * Y, 0.25 * Y],
  ['heirs 7', () => probe.scenario('heirs', 7), regenerate, 5 * DAY + 14.3, 5 * DAY],
  ['populous 7', () => probe.scenario('populous', 7), regenerate, 10 * DAY + 7.2, 5 * DAY],
  ['market 7', () => probe.scenario('market', 7), regenerate, 10 * DAY + 7.2, 5 * DAY],
  ['the probe at night', probe.state, probe.world, 10 * DAY + 0.7, 3 * DAY],
  ['the probe mid-day', probe.state, probe.world, 10 * DAY + 10.5, 3 * DAY],
]) {
  const st = make();
  Sim.advance(st, before);
  const text = JSON.stringify(Sim.save(st));
  Sim.advance(st, after); // the run that was never saved
  const data = JSON.parse(text), back = Sim.load(restore(data), data);
  Sim.advance(back, after);
  const bad = [];
  // the derived fields (sim/saves DERIVED) are rebuilt on load, and checked against their sources by the invariants, not here
  const D = VB['sim/saves'].DERIVED;
  for (const k of new Set([...Object.keys(st), ...Object.keys(back)])) if (k !== 'w' && !(k in D) && canon(st[k]) !== canon(back[k])) bad.push(k);
  const { checkState } = require('./lib/invariants.js');
  for (const [which, s] of [['saved', st], ['loaded', back]]) { const v = checkState(s); if (v.length) { failed++; console.error(`SAVES FAIL: ${label}, the run ${which}: ${v.slice(0, 3).join('; ')}`); } }
  for (const k of TILES) if (canon(st.w[k]) !== canon(back.w[k])) bad.push('w.' + k);
  if (bad.length) { failed++; console.error(`SAVES FAIL: ${label}, saved after ${before} h, ${after} h more: ${bad.join(', ')} differ`); }
  out.push(`${label} ${(text.length / 1024).toFixed(0)} KB`);
}
{ // VB-259: a save from before the cooked store was named meals (format 2, hh.rations) is refused, as any other build's
  const st = probe.state(), data = JSON.parse(JSON.stringify(Sim.save(st)));
  // and one from before the climate and the basins' rivers changed every seed's island (format 3, VB-342), and one whose idlers were
  // agents (format 4, VB-247)
  for (const old of [2, 3, 4, 6, 7]) { // and one from before the plan record (format 6, VB-1752), and the controller (format 7, VB-1745)
    data.format = old;
    let why = null; try { Sim.load(probe.world(), data); } catch (e) { why = e.message; }
    if (!new RegExp(`format ${old}, this build reads ${VB["sim/saves"].FORMAT}`).test(why || '')) { failed++; console.error(`SAVES FAIL: a format-${old} save was not refused (${why})`); }
  }
}
// VB-239: saves of older builds are refused by their format, and no migration is kept for them (Kim, 10 Nov 2026: no one holds one)
{ // VB-1150: a save of a load plays as the load, while plots' cottages are built (each load on a world of its own)
  const { tinyWorld, tinyState } = require('./lib/tiny.js'), Rec = VB['sim/records'];
  const world = () => tinyWorld(Array(9).fill('.'.repeat(210)), { seed: 7 });
  const st = tinyState(world(), [{ at: [6, 4], farms: 1, sizes: [5] }, { at: [156, 4], farms: 1, sizes: [5] }, { at: [196, 4], farms: 1, sizes: [5] }], { seed: 7 });
  for (const hh of st.households) {
    const id = hh.members.find((k) => k !== hh.holder && Rec.spouseOf(st, k) === null), p = st.pawns[id];
    p.born = st.t - 25.5 * Y; p.age = 25;
  }
  VB['sim/wishes'].seedAsking(st); VB['sim/heirs'].refreshRoles(st);
  while (!(st.t >= 3 * Sim.SEASON_DAYS * DAY && st.agents.some((a) => a.job && a.job.plot))) Sim.advance(st, DAY);
  const text = JSON.stringify(Sim.save(st)), load = (d) => Sim.load(world(), JSON.parse(JSON.stringify(d)));
  const one = load(JSON.parse(text)), two = load(Sim.save(load(JSON.parse(text))));
  Sim.advance(one, 6 * DAY); Sim.advance(two, 6 * DAY);
  if (canon(one.agents) !== canon(two.agents)) { failed++; console.error('SAVES FAIL: the agents of a second save differ while a cottage is built'); }
  out.push('a second save while a cottage is built');
}
// VB-1937: a save from before it, a household living in a booth (farmstead.booth, its cottage a project plan of its household), loads with
// its cottage as its farm's own site at step 3: stage building, the house tile's steps done, the open stage and the walls' wood kept, its
// household founded already; it plays on, and the roof founds nothing: it ends the site, the farm has its cottage.
{
  const { tinyWorld } = require('./lib/tiny.js'), Sites = VB['sim/sites'], P = VB['sim/projects'];
  const { checkState } = require('./lib/invariants.js');
  const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
  const st = Sim.seed(tinyWorld(rows), 7, 'solo', null, {}), f = st.farmsteads[0], hh = st.households[f.household];
  while (!VB['sim/building'].shelterStands(st, f)) Sim.advance(st, DAY);
  // the site made at the landing, written back as the save before VB-1937 held it
  const s = Sites.ofFarm(st, f.id);
  const data = JSON.parse(JSON.stringify(Sim.save(st)));
  const sf = data.state.farmsteads[0];
  sf.booth = true; delete sf.rung;
  data.state.sites = data.state.sites.filter((x) => x.id !== s.id);
  const steps = [{ kind: 'fell', place: f.house, hours: 10, done: 0 }, { kind: 'grub', place: f.house, hours: 6, done: 0 },
    { kind: 'foundation', place: f.house, hours: 30, done: 30 }, { kind: 'walls', place: f.house, hours: 60, done: 12, wood: 7 }, { kind: 'roof', place: f.house, hours: 30, done: 0 }];
  const before = Sim.load(tinyWorld(rows), JSON.parse(JSON.stringify(data)));
  for (const x of before.sites) if (x.farm === 0) before.sites.splice(before.sites.indexOf(x), 1);
  VB['sim/projectplans'].makeProject(before, 'household', hh.id, { what: 'cottage', farmstead: f.id, steps }).open = 3;
  const old = JSON.parse(JSON.stringify(Sim.save(before)));
  old.state.farmsteads[0].booth = true; delete old.state.farmsteads[0].rung;
  for (const g of old.state.farmsteads.slice(1)) g.booth = null;
  const back = Sim.load(tinyWorld(rows), old), bf = back.farmsteads[0], bs = Sites.ofFarm(back, 0), n = back.households.length;
  const ok = (c, m) => { if (!c) { failed++; console.error('SAVES FAIL: a booth household loaded:', m); } };
  ok(!('booth' in bf) && bf.rung === 'shelter' && !P.projectsOf(back, 'household', hh.id).some((p) => p.what === 'cottage'), 'the booth\'s mark and its plan are its rung and its site');
  ok(bs && bs.stage === 'building' && bs.farm === 0 && bs.leader === null && bs.plot.places[0].steps.join() === 'fell,grub' && bs.plot.places[0].i === 2,
    `its site at step 3, the house tile's steps done (${bs && JSON.stringify(bs.plot.places)})`);
  ok(bs && bs.plot.open === 1 && bs.plot.steps[1].done === 12 && bs.plot.steps[1].wood === 7, `the open stage kept (${bs && JSON.stringify(bs.plot.steps)})`);
  ok(!checkState(back).length, `invariants on the load: ${checkState(back).slice(0, 3)}`);
  for (let d = 0; d < 3 * Sim.SEASON_DAYS * 2 && Sites.ofFarm(back, 0); d++) Sim.advance(back, DAY);
  ok(!Sites.ofFarm(back, 0) && !bf.rung && bf.shelter === null && bf.household === hh.id && back.households.length === n,
    `played on to the roof: the site ends, the farm has its cottage, nothing founded (site ${!!Sites.ofFarm(back, 0)}, rung ${bf.rung})`);
  ok(!checkState(back).length, `invariants after the roof: ${checkState(back).slice(0, 3)}`);
  out.push('a booth household of an older save loaded as its farm\'s site, to its roof');
}
// VB-1937, its review: a booth cottage plan its village held (sim/plans dropAll kept it for the farm's next household) loads as that farm's
// site as well, its walls' wood and its stages kept, nothing vanishing; and a plan open at its grub step, half done, keeps those hours.
{
  const { tinyWorld } = require('./lib/tiny.js'), Sites = VB['sim/sites'], P = VB['sim/projects'];
  const { checkState } = require('./lib/invariants.js');
  const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
  const st = Sim.seed(tinyWorld(rows), 7, 'solo', null, {}), f = st.farmsteads[0];
  while (!VB['sim/building'].shelterStands(st, f)) Sim.advance(st, DAY);
  const data = JSON.parse(JSON.stringify(Sim.save(st)));
  const before = Sim.load(tinyWorld(rows), JSON.parse(JSON.stringify(data)));
  for (const x of [...before.sites]) if (x.farm === 0) before.sites.splice(before.sites.indexOf(x), 1);
  const steps = [{ kind: 'fell', place: f.house, hours: 10, done: 0 }, { kind: 'grub', place: f.house, hours: 6, done: 3 },
    { kind: 'foundation', place: f.house, hours: 30, done: 0 }, { kind: 'walls', place: f.house, hours: 60, done: 0, wood: 7 }, { kind: 'roof', place: f.house, hours: 30, done: 0 }];
  VB['sim/projectplans'].makeProject(before, 'village', f.village, { what: 'cottage', farmstead: f.id, steps }).open = 1;
  const old = JSON.parse(JSON.stringify(Sim.save(before)));
  old.state.farmsteads[0].booth = true; delete old.state.farmsteads[0].rung;
  for (const g of old.state.farmsteads.slice(1)) g.booth = null;
  const back = Sim.load(tinyWorld(rows), old), bs = Sites.ofFarm(back, 0);
  const ok = (c, m) => { if (!c) { failed++; console.error('SAVES FAIL: a village-held booth cottage loaded:', m); } };
  ok(!P.projectsOf(back, 'village', f.village).some((p) => p.what === 'cottage'), 'the village holds no cottage plan after the load');
  ok(bs && bs.plot.places[0].i === 1 && bs.plot.places[0].done === 3, `its site open at the grub step, its 3 hours kept (${bs && JSON.stringify(bs.plot.places)})`);
  ok(bs && bs.plot.open === 0 && bs.plot.steps[1].wood === 7, `the stages and the walls' wood kept (${bs && JSON.stringify(bs.plot.steps)})`);
  ok(!checkState(back).length, `invariants on the load: ${checkState(back).slice(0, 3)}`);
  for (let d = 0; d < 3 * Sim.SEASON_DAYS * 2 && Sites.ofFarm(back, 0); d++) Sim.advance(back, DAY);
  ok(!Sites.ofFarm(back, 0) && !back.farmsteads[0].rung, 'played on to the roof');
  out.push('a village-held booth cottage loaded as its farm\'s site');
}
if (failed) process.exit(1);
console.log(`saves ok: saved, loaded into a new world and advanced, each run matches the unbroken one (${out.join(', ')})`);
