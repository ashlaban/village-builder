// @suite fast
// The tiny-world kit (VB-155, tests/lib/tiny.js): a text map lays its tiles as the generator does, and a state of two villages seeds fast and runs.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
const { tinyWorld, tinyState, tileAt } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('TINY FAIL:', m); } };

// neighbours as the generator lays them, on an odd and an even row
const it = G.generate(3, { cols: 12, rows: 10 }); let r; while (!(r = it.next()).done);
const gw = r.value, tw = tinyWorld(Array.from({ length: 10 }, () => '.'.repeat(12)));
for (const [col, row] of [[4, 3], [4, 4], [0, 0], [11, 9]]) {
  const i = tileAt(tw, col, row);
  for (let d = 0; d < 6; d++) check(tw.nb[i * 6 + d] === gw.nb[i * 6 + d], `neighbour ${d} of ${col}, ${row}: ${tw.nb[i * 6 + d]} against ${gw.nb[i * 6 + d]}`);
  check(Math.abs(tw.hx[i] - gw.hx[i]) < 1e-3 && Math.abs(tw.hy[i] - gw.hy[i]) < 1e-3, `position of ${col}, ${row}`);
}
check(tinyWorld(['.F~', 'hmP'], { stones: 90 }).stones[0] === 90 && tinyWorld(['.F~', 'hmP']).water[2] === 1, 'tiles from characters');

// two villages on a 14 by 10 map: seeded in well under 100 ms, a day advances, the state holds its invariants
const map = [
  '..............',
  '...FF.........',
  '...FF.........',
  '..............',
  '..........FF..',
  '..............',
  '.........^^...',
  '..............',
  '~.............',
  '~~............',
];
const t0 = Date.now(), w = tinyWorld(map), st = tinyState(w, [{ at: [3, 5], farms: 2 }, { at: [11, 2], farms: 1 }], { seed: 7, customs: { dispute: 'kin' } });
const ms = Date.now() - t0;
check(ms < 500, `seeding took ${ms} ms`); // about 15 ms alone; the suite runs scripts in parallel
check(st.villages.length === 2 && st.farmsteads.length === 3 && st.households.length === 3, `villages ${st.villages.length}, farms ${st.farmsteads.length}`);
check(st.villages[0].center === tileAt(w, 3, 5), 'the first village stands where it was put');
check(Sim.practice(st, 1).dispute === 'kin', 'customs set in every village');
Sim.advance(st, Sim.DAY);
const bad = checkState(st);
check(!bad.length, `invariants: ${bad.slice(0, 3).join('; ')}`);

// VB-1581: fresh water on a drawn map, as the generator lays it (gen/water) and the walk to it (sim/water): a tile beside a lake is
// shallow, a mountain has no well, marsh is a source of class marsh, the sea is none; the walk is a step from the bank, longer through
// the wood, and to the lake, not to the marsh nearer by
{
  const W = VB['world/water'], { FRESH, band, bandHours, sourceNear, NO_WELL } = W, { SPEED } = VB['sim/rules'];
  const ww = tinyWorld([
    '~~..........',
    '~.....FFF...',
    '..oo..FFF.M.',
    '..oo......*.',
    '............',
    '.....m......',
    '....mm......',
    '...........^',
  ]), at = (c, r) => tileAt(ww, c, r);
  VB.resetCounts();
  VB['sim/water'].layWalk(ww);
  const settled = VB.count.waterSettled, walk = ww.freshWalk;
  check(ww.fresh[at(2, 2)] === FRESH.LAKE && ww.fresh[at(5, 5)] === FRESH.MARSH && ww.fresh[at(0, 0)] === FRESH.NONE && ww.fresh[at(7, 4)] === FRESH.NONE,
    'a lake tile is a lake, marsh a source of class marsh, the sea and dry land none');
  check(band(ww.waterDepth[at(4, 2)]) === 0 && Math.abs(ww.waterDepth[at(4, 2)] - 1) < 1e-6, `a tile beside a lake is shallow, a metre: ${ww.waterDepth[at(4, 2)]}`);
  check(ww.waterDepth[at(10, 2)] === NO_WELL && ww.waterDepth[at(10, 3)] === NO_WELL && band(NO_WELL) === 3 && bandHours(3) === null, 'a mountain and a snowfield have no well');
  check(ww.waterDepth[at(5, 5)] === 0.5 && ww.waterDepth[at(0, 0)] === NO_WELL && band(ww.waterDepth[at(11, 7)]) === 2, `marsh half a metre, the sea none, a hill above the lake deep: ${ww.waterDepth[at(11, 7)]}`);
  check(band(4) === 0 && band(4.01) === 1 && band(10) === 1 && band(20) === 2 && band(20.01) === 3, 'the bands end at 4, 10 and 20 m');
  check(String(bandHours(0)) === '20,32' && String(bandHours(1)) === '32,56' && String(bandHours(2)) === '56,96', `the bands' hours: ${[0, 1, 2].map(bandHours).join('; ')}`);
  check(Math.abs(walk[at(4, 2)] - 1 / SPEED) < 1e-6 && Math.abs(walk[at(5, 2)] - 2 / SPEED) < 1e-6, `a step of meadow from the bank an eighth of an hour: ${walk[at(4, 2)]}, ${walk[at(5, 2)]}`);
  check(walk[at(7, 2)] > walk[at(7, 4)] && walk[at(7, 4)] > walk[at(5, 2)], 'the wood is a longer walk than the meadow beyond it');
  check(walk[at(2, 2)] === Infinity && walk[at(0, 0)] === Infinity && walk[at(5, 5)] > 0 && walk[at(5, 5)] < Infinity, 'no walk on water; a marsh tile walks to good water');
  check(sourceNear(ww, at(5, 6)) >= 0 && ww.fresh[sourceNear(ww, at(5, 6))] === FRESH.LAKE && sourceNear(ww, at(2, 2)) === at(2, 2) && ww.fresh[sourceNear(ww, at(11, 7))] === FRESH.LAKE,
    'the nearest source is the lake, from beside the marsh too');
  check(settled > 0 && settled <= ww.N, `the walk settles each land tile once: ${settled}`);
  check(st.w.freshWalk && st.w.freshWalk.length === st.w.N && st.w.freshWalk.every((x, i) => x === Infinity), 'a state on a map with no fresh water has its walk laid, none to walk to');
  const again = ww.freshWalk; VB['sim/water'].layWalk(ww);
  check(ww.freshWalk === again, 'the walk is laid once');
}
// VB-1982: a household owing a share dies out; its obligation passes to the household its people go to, or lapses with none
{
  const O = VB['sim/obligations'], { extinct } = VB['sim/heirs'];
  const s2 = tinyState(tinyWorld(map), [{ at: [3, 5], farms: 2 }, { at: [11, 2], farms: 1 }], { seed: 7 });
  const [a, b] = s2.households.filter((h) => !h.dissolved && h.holder !== null && h.farmstead !== null);
  const sib = s2.pawns.find((p) => p.alive && p.household !== a.id && p.household !== b.id) || s2.pawns[s2.households[2].holder];
  const o = O.oweShare(s2, a, sib.id, 10);
  const id = typeof o === 'object' && o !== null ? o.id : o;
  extinct(s2, a);
  const rec = s2.obligations[id];
  check(a.dissolved, 'the household died out');
  check(rec.status !== 'open' || (rec.debtor.kind === 'household' && !s2.households[rec.debtor.id].dissolved), `its share passed or closed: ${rec.status} ${JSON.stringify(rec.debtor)}`);
  check(!(s2.obligationsBy.debtor['household:' + a.id] || []).length, 'none left to the dissolved debtor');
  const bad2 = checkState(s2).filter((e) => /dissolved, holding obligations/.test(e));
  check(!bad2.length, bad2.join('; '));
}
// VB-1983: a death leaves st.demand and a ward's guardianship
{
  const s3 = tinyState(tinyWorld(map), [{ at: [3, 5], farms: 2 }, { at: [11, 2], farms: 1 }], { seed: 7 });
  const L = VB['sim/lifecycle'], gone = s3.living[0];
  s3.demand = s3.living.slice(0, 3);
  L.killPawn(s3, gone);
  check(!s3.demand.includes(gone) && s3.demand.length === 2, 'a dead pawn leaves st.demand');
  const hh = s3.households.find((h) => !h.dissolved), g = hh.members.find((m) => s3.pawns[m].alive && s3.pawns[m].age >= 18);
  if (g !== undefined) {
    const ward = s3.pawns[hh.members.find((m) => m !== g)] || s3.pawns[g];
    hh.ward = ward.id; hh.guardian = g;
    L.killPawn(s3, g);
    check(hh.guardian !== g && (hh.guardian === null || s3.pawns[hh.guardian].alive), 'a dead guardian is replaced or none');
  } else check(false, 'no adult to test');
  const bad3 = checkState(s3).filter((e) => /is dead/.test(e) && /demand|guardian/.test(e));
  check(!bad3.length, bad3.join('; '));
}
// VB-1541: a household with food and no water, five days: the sheet names the water, and so does the death
{
  const s4 = tinyState(tinyWorld(map), [{ at: [3, 5], farms: 1 }], { seed: 7 });
  const hh = s4.households.find((h) => !h.dissolved), p = s4.pawns[hh.holder];
  Sim.inhabit(s4, p.id);
  const U = VB['sim/hunger'].updateHealth;
  p.hunger = 0; p.health = 80; hh.dryLog = [1, 1, 1, 1, 1]; hh.dry = 1;
  for (let d = 0; d < 3; d++) { s4.t += Sim.DAY; U(s4, p, true, 0, 1, false); }
  const words = Sim.sheetNotes(s4).moved.join(' | ');
  check(/no water fetched \(-\d+\)/.test(words) && !/damp/.test(words), `the sheet reads the water: ${words}`);
  p.health = 0;
  check(VB['sim/deaths'].deathRoll(s4, p) === 'thirst', 'a death by dry days is thirst');
  hh.dry = 0; hh.dryLog = [];
  check(VB['sim/deaths'].deathRoll(s4, p) === 'starvation', 'and by none of them, starvation');
  hh.cold = 1; p.hunger = 0;
  check(VB['sim/deaths'].deathRoll(s4, p) === 'cold', 'a death in a cold house, with no hunger, is cold (VB-2030)');
  hh.cold = 0;
}
if (failed) process.exit(1);
console.log(`tiny ok: two villages on a 14 x 10 map seeded in ${ms} ms, ${st.pawns.length} people`);
