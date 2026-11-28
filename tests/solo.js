// @suite fast
// The solo start: one settler, a young adult of either sex (SOLO, sim/people), alone in one household on the one farm of one village,
// unmarried and with no kin on record; seeded the same at the same seed; no house, a booth first (VB-1544). A year on runs without
// throwing and keeps the state's invariants.
const VB = require('../src/load.js'), Sim = VB.sim, { SOLO } = VB['sim/people'];
const { scenario } = require('./lib/probe.js'), { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('SOLO FAIL:', m); } };
const age = (st, p) => Math.floor((st.t - p.born) / Sim.YEAR), sexes = new Set();
for (const seed of [3, 5, 7, 11, 42]) {
  const st = scenario('solo', seed), tag = `seed ${seed}`, alive = st.pawns.filter((p) => p.alive);
  check(st.scenario === 'solo', `${tag}: scenario ${st.scenario}`);
  check(st.pawns.length === 1 && alive.length === 1, `${tag}: ${st.pawns.length} pawns, ${alive.length} living`);
  check(st.households.length === 1 && st.farmsteads.length === 1 && st.villages.length === 1,
    `${tag}: ${st.households.length} households, ${st.farmsteads.length} farms, ${st.villages.length} villages`);
  const p = alive[0], hh = st.households[0];
  if (!p) continue;
  sexes.add(p.sex);
  const a = age(st, p);
  check(a >= 18 && a <= 25 && a >= SOLO.ageMin && a <= SOLO.ageMin + SOLO.ageSpan - 1, `${tag}: the settler is ${a}`);
  check(hh.members.length === 1 && hh.members[0] === p.id && hh.holder === p.id, `${tag}: household ${JSON.stringify(hh.members)}, holder ${hh.holder}`);
  check(!st.unions.length && p.father === null && p.mother === null, `${tag}: a union or kin on record`);
  check(hh.grain.barley > 0 && hh.herds.length > 0 && hh.wood > 0, `${tag}: landed without grain, herd or wood`);
  const again = scenario('solo', seed).pawns[0];
  check(again.sex === p.sex && again.born === p.born && again.given === p.given, `${tag}: seeded differently twice`);
}
check(sexes.size === 2, `the settler is always ${[...sexes]}`);
// VB-1544: no house stands on day 1 (a booth farm, its cottage a plan) and its shelter is begun on the house tile itself (VB-1666: no
// booth of st.booths); the settler sleeps under the open sky (sim/building roofless) until the shelter stands, which is within the
// season; then a year on.
const B = VB['sim/building'], Projects = VB['sim/projects'];
for (const seed of [7, 42]) {
  const st = scenario('solo', seed), tag = `seed ${seed}`, hh = st.households[0], f = st.farmsteads[hh.farmstead];
  check(f.booth === true && !st.booths.length, `${tag}: a house stands on day 1 (booth ${f.booth}, ${st.booths.length} booths)`);
  check(Projects.projectsOf(st, 'household', hh.id).some((p) => p.what === 'cottage'), `${tag}: no cottage plan`);
  check(f.shelter && f.shelter.built === null, `${tag}: no shelter begun on the house tile (${JSON.stringify(f.shelter)})`);
  check(B.roofless(st, hh), `${tag}: the settler is not under the open sky before the shelter stands`);
  let day = null;
  for (let d = 1; d <= Sim.SEASON_DAYS && day === null; d++) { Sim.advance(st, Sim.DAY); if (B.shelterStands(st, f)) day = d; }
  check(day !== null, `${tag}: no shelter stands within the season`);
  check(!B.roofless(st, hh) && f.booth === true && !st.booths.length, `${tag}: the shelter stands, no booth, and the cottage is still to come`);
  let err = null;
  try { for (let q = 0; q < 4; q++) { Sim.advance(st, Sim.YEAR / 4); const bad = checkState(st); check(!bad.length, `${tag}, quarter ${q + 1}: ${bad.slice(0, 3).join('; ')}`); } } catch (e) { err = e; }
  check(!err, `${tag}: a year throws: ${err && err.stack}`);
}
// VB-1613: the sites offered with their water, a choice landing near its tile, the default unchanged.
{
  const seed = 7, w = scenario('solo', seed).w;
  const offer = Sim.soloSites(w, seed), def = scenario('solo', seed);
  check(offer.length >= 1 && offer.length <= 1 + VB['sim/rules'].SETTLE.shown, `offered ${offer.length} sites`);
  check(offer[0].house === def.farmsteads[0].house, 'the first site offered is not the default');
  check(offer.every((s) => s.water && typeof s.water === 'object'), 'a site is offered without its water');
  if (offer.length > 1) {
    const pick = offer[1], st = Sim.seed(w, seed, 'solo', null, { site: pick.house });
    const near = VB['sim/hex'].hexSteps(w, pick.house, st.farmsteads[0].house); // the village's own placing sets the house beside the tile chosen
    check(near <= 3 && st.farmsteads[0].house !== def.farmsteads[0].house, `the chosen site ${pick.house} landed ${near} steps off, on ${st.farmsteads[0].house}`);
  }
  check(offer.every((s) => Number.isFinite(s.water.hours) && s.water.people === 1), 'a site offered with no fetch reading'); // the page card prints these
  const none = Sim.seed(w, seed, 'solo', null, null);
  check(none.farmsteads[0].house === def.farmsteads[0].house, 'no choice seeds differently');
}
if (failed) process.exit(1);
console.log('solo ok: one young settler alone, no house; a shelter on the house tile within the season; a year on keeps the invariants');
