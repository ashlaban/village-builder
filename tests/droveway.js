// The herds' way out to the outland (VB-446, sim/grazing): a village chooses one way a season from its green to its outland pasture, and
// all its herds are driven by it, so that their crossings fall on the same tiles; on a wooded island a season's driving wears the forest
// it crosses to a path, and a way no longer driven fades as any worn way does (sim/paths).
const VB = require('../src/load.js'), Sim = VB.sim, { tinyWorld, tinyState } = require('./lib/tiny.js');
const { B } = VB['world/biomes'], { PATHS } = VB['sim/walking'], { hexSteps } = VB['sim/hex'], H = Sim.HERD.herding;
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('DROVEWAY FAIL:', m); } };

// a wooded island: the village on a clearing in its middle that its houses and fields fill, its outland the forest round it
const w = tinyWorld(Array.from({ length: 26 }, (_, r) => (r >= 11 && r <= 15 ? 'F'.repeat(18) + '.'.repeat(8) + 'F'.repeat(18) : 'F'.repeat(44))));
const st = tinyState(w, [{ at: [22, 13], farms: 8 }], { seed: 3, herds: true });
const v = st.villages[0], SEASON = Sim.SEASON_DAYS;
const herding = () => st.liveHouseholds.map((id) => st.households[id]).filter((hh) => VB['sim/grazing'].herdLoad(st, hh) > 0);
check(herding().length >= 4, `only ${herding().length} households with animals`);
// from the first grazing day of spring to the end of the season after it
Sim.advance(st, (Sim.HERD.stall[1] + 1) * Sim.DAY - st.t);
const first = v.droveway;
check(first && first.to >= 0 && first.tiles.length > 1 && first.tiles[0] === v.center, `no way out chosen: ${JSON.stringify(first)}`);
const season = first.season;
// the forest it crosses when chosen (the village's felling may clear a tile of it later: it is still the way)
const forest = first.tiles.slice(1).filter((t) => w.biome[t] === B.FOREST || w.biome[t] === B.PINE);
// out of the village: its end farther from the green than every house
const farthest = Math.max(...v.farmsteads.map((fid) => hexSteps(w, v.center, st.farmsteads[fid].house)));
check(hexSteps(w, v.center, first.to) > farthest, `the way ends ${hexSteps(w, v.center, first.to)} steps from the green, a house ${farthest}`);
// the herds graze at its end, each household's pasture within `around` steps of it, chosen by it
Sim.advance(st, Sim.DAY);
for (const hh of herding()) {
  const pa = hh.pasture;
  check(pa && pa.to === first.to && hexSteps(w, first.to, pa.tile) <= H.around, `household ${hh.id}: pasture ${JSON.stringify(pa)} not by the way's end`);
}
// the herders go by the way: each walk out with the herds, seen on the road the next morning, runs along its last tiles
{
  const along = new Set(first.tiles.slice(-2)), seen = [];
  Sim.advance(st, 5.5);
  for (let h = 0; h < 10; h++) {
    Sim.advance(st, 0.5);
    for (const id of st.living) {
      const a = st.agents[id], j = a.mind && a.mind[0];
      if (j && j.kind === 'herd' && a.path && !seen.includes(id)) seen.push(id) && check(a.path.some((pt) => along.has(pt[3])), `herder ${id} walks out off the way`);
    }
  }
  check(seen.length >= 2, `${seen.length} herders seen walking out`);
}
// kept for the season: the same way until the season turns, then chosen again
Sim.advance(st, (season + 1) * SEASON * Sim.DAY - st.t - 1);
check(v.droveway === first || (v.droveway.season === season && v.droveway.to === first.to), 'the way changed within its season');
Sim.advance(st, (season + 2) * SEASON * Sim.DAY + 11 - st.t); // through the next season, to 11:00 on the day after it
check(v.droveway.season === season + 2, `the way not chosen again a season on: ${v.droveway.season}`);
// the way's forest worn to a path by a season's driving (and the one before it): its tiles outside the green
check(forest.length >= 2, `the way crosses ${forest.length} forest tiles`);
const pathed = forest.filter((t) => w.worn[t] >= 2);
check(pathed.length >= forest.length - 1, `of the way's ${forest.length} forest tiles only ${pathed.length} worn to a path: ` +
  forest.map((t) => Math.round(w.wear[t])).join(' '));
// no longer driven (the herds sold): the way fades by half a year, and is no path by the time it falls below the path's keep
for (const hh of herding()) for (const id of hh.herds) { const hd = st.herds[id]; if (hd.head) hd.head.length = 0; else hd.ewes = hd.rams = hd.lambs = 0; } // lint-allow: owner the test sells the herds
const wear0 = forest.map((t) => w.wear[t]);
Sim.advance(st, Sim.YEAR);
// the fade of a year of no driving: the count halves a year (sim/paths), and people still walk the way to their work and the wood, so it
// keeps some of their crossings (1201 to 658 on seed 3 after the merge of 25 November moved the draws); under two thirds of it by a year on
const faded = forest.filter((t, k) => w.wear[t] < (2 / 3) * wear0[k]);
check(faded.length >= forest.length - 1, `a year after the herds stopped: ${forest.map((t, k) => `${Math.round(wear0[k])}->${Math.round(w.wear[t])}`).join(' ')}`);
Sim.advance(st, Sim.YEAR);
const still = forest.filter((t) => w.worn[t] >= 2 && w.wear[t] < PATHS.at[2] * PATHS.keep);
check(!still.length, `${still.length} tiles still a path below the path's keep`);
if (failed) { console.error(`droveway: ${failed} failed`); process.exit(1); }
console.log(`droveway ok: a way of ${first.tiles.length} tiles from the green, ${pathed.length} of its ${forest.length} forest tiles worn to a path in two seasons, faded once undriven`);
