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
// VB-1544: no house stands on day 1 (a booth farm, its cottage a plan) and the settler has staked a booth beside the house tile by the
// verb; it sleeps under the open sky (sim/building roofless) until the booth stands, which is within the season; then a year on.
const B = VB['sim/building'], Projects = VB['sim/projects'];
for (const seed of [7, 42]) {
  const st = scenario('solo', seed), tag = `seed ${seed}`, hh = st.households[0], f = st.farmsteads[hh.farmstead];
  const staked = []; B.stakedEach(st, (p) => staked.push(p));
  check(f.booth === true && !st.booths.length, `${tag}: a house stands on day 1 (booth ${f.booth}, ${st.booths.length} booths)`);
  check(Projects.projectsOf(st, 'household', hh.id).some((p) => p.what === 'cottage'), `${tag}: no cottage plan`);
  check(staked.length === 1 && staked[0].holder.id === hh.holder && st.w.nb.slice(f.house * 6, f.house * 6 + 6).includes(staked[0].tile),
    `${tag}: the settler staked ${staked.length} booths, not one beside the house`);
  check(B.roofless(st, hh), `${tag}: the settler is not under the open sky before the booth stands`);
  let day = null;
  for (let d = 1; d <= Sim.SEASON_DAYS && day === null; d++) { Sim.advance(st, Sim.DAY); if (st.booths.some((b) => b.by === hh.id)) day = d; }
  check(day !== null, `${tag}: no booth stands within the season`);
  check(!B.roofless(st, hh) && f.booth === true, `${tag}: the booth stands and the cottage is still to come`);
  let err = null;
  try { for (let q = 0; q < 4; q++) { Sim.advance(st, Sim.YEAR / 4); const bad = checkState(st); check(!bad.length, `${tag}, quarter ${q + 1}: ${bad.slice(0, 3).join('; ')}`); } } catch (e) { err = e; }
  check(!err, `${tag}: a year throws: ${err && err.stack}`);
}
if (failed) process.exit(1);
console.log('solo ok: one young settler alone, no house; a booth within the season; a year on keeps the invariants');
