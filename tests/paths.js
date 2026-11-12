// Worn paths (VB-094): crossings count on open land, fields and meadows, not on houses, greens or water, the count halves in a game year, stages with a margin, the page is told,
// and in a run the wear sits where pawns walk; generated villages start worn in (VB-114); the map's trails reach their neighbours and keep
// trees off paths and lanes.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, P = VB['sim/paths'], Look = VB['gen/paths'];
const { PATHS, YEAR_DAYS } = VB['sim/rules'];
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('PATHS FAIL:', m); } };
const world = (seed) => { const it = G.generate(seed); let r; while (!(r = it.next()).done); return r.value; };

// stages: up at 50, 200 and 800; down only below 85% of a threshold
check(P.stageOf(49, 0) === 0 && P.stageOf(50, 0) === 1 && P.stageOf(200, 0) === 2 && P.stageOf(800, 1) === 3, 'stages rise at 50, 200, 800');
check(P.stageOf(45, 1) === 1 && P.stageOf(42, 1) === 0 && P.stageOf(700, 3) === 3 && P.stageOf(600, 3) === 2, 'stages fall below 85%');
check(P.stageOf(0, 3) === 0, 'a tile with no wear has no stage');

const st = Sim.seed(world(7), 7, 'founders'), w = st.w;
check(w.wear instanceof Float32Array && w.worn instanceof Uint8Array && w.wear.every((x) => x === 0), 'a new world has no wear');
const house = st.farmsteads[0].house, open = w.nb.slice(house * 6, house * 6 + 6).find((j) => j >= 0 && !w.dev[j] && !w.water[j]);
const field = st.farmsteads[0].fields.length ? st.farmsteads[0].fields[0].tile : -1;
P.tread(w, house); P.tread(w, open);
if (field >= 0) { P.tread(w, field); check(w.wear[field] === 1 && w.dev[field] === 1, 'a field counts a crossing as open land does'); w.wear[field] = 0; }
check(w.dev[house] === 3, 'a house is marked as a house');
check(w.wear[house] === 0 && w.wear[open] === 1, 'a house wears no path; open land counts one crossing');
// fading: a lane's count halves in a game year and the stage follows; the page hears of each change
w.wear[open] = 1000; st.pathDirty.clear();
P.fadeWear(st); check(w.worn[open] === 3 && st.pathDirty.has(open), 'a count of 1000 is a lane, and the page is told');
st.pathDirty.clear();
for (let d = 1; d < YEAR_DAYS; d++) P.fadeWear(st);
check(Math.abs(w.wear[open] - 500) < 1, `after a year a count of 1000 is ${w.wear[open].toFixed(1)}, not 500`);
check(w.worn[open] === 2 && st.pathDirty.has(open), 'a count of 500 is a path');
for (let d = 0; d < 5 * YEAR_DAYS; d++) P.fadeWear(st);
check(w.wear[open] < PATHS.at[1] * PATHS.keep && w.worn[open] === 0, `an unused lane is gone in five years (${w.wear[open].toFixed(1)} left)`);
for (let d = 0; d < 6 * YEAR_DAYS; d++) P.fadeWear(st);
check(w.wear[open] === 0, 'a count under half a crossing is dropped');

// generated villages start worn in (VB-114), but the founders, who arrive on unmade land
const pop = Sim.seed(world(7), 7, 'populous'), pw = pop.w, start = P.stageCounts(pw), heirs = P.stageCounts(Sim.seed(world(7), 7, 'heirs').w);
check(start[1] > 60 && start[2] > 10, `populous starts with trodden/path/lane ${start.slice(1).join('/')}`);
check(heirs[1] + heirs[2] > 0, `heirs start with trodden/path/lane ${heirs.slice(1).join('/')}`);
check(P.stageCounts(Sim.seed(world(7), 7, 'founders').w).slice(1).every((n) => n === 0), 'the founders start with worn paths');
// a populous run: wear where pawns walk, never on houses, greens or water, on fields and meadows too; stages agree with the counts
Sim.advance(pop, Sim.YEAR);
let worn = 0, onBuilt = 0, bad = 0, onFields = 0;
for (let i = 0; i < pw.N; i++) {
  if (pw.wear[i] > 0 && (pw.water[i] || pw.dev[i] > 1)) onBuilt++;
  if (pw.worn[i] && pw.dev[i] === 1) onFields++;
  if (pw.worn[i]) worn++;
  if (!(pw.wear[i] >= 0) || pw.worn[i] > 3 || (pw.worn[i] && pw.wear[i] < PATHS.at[pw.worn[i]] * PATHS.keep)) bad++;
}
check(worn > 20, `only ${worn} worn tiles after a populous year`);
check(onBuilt === 0, `${onBuilt} worn houses, greens or water tiles`);
check(onFields > 0, 'no way is worn over a field or meadow after a populous year');
check(bad === 0, `${bad} tiles whose stage does not fit their count`);
const counts = P.stageCounts(pw);
// a way ends at a house's door and never goes on through the house: the house draws nothing, and of the tiles round it only its door,
// the most worn of them, sends a way to it
let doors = 0;
for (const f of pop.farmsteads) {
  const h = f.house, d = Look.door(pw, h), nbs = [0, 1, 2, 3, 4, 5].map((k) => pw.nb[h * 6 + k]);
  check(Look.segments(pw, h).length === 0, `house ${h} draws a trail`);
  for (const j of nbs) if (j >= 0 && pw.dev[j] < 2 && pw.worn[j] >= Look.LOOK.from && !pw.river[j]) {
    check(Look.exits(pw, j).includes(nbs.indexOf(j) < 0 ? -1 : (nbs.indexOf(j) + 3) % 6) === (j === d),
      `house ${h}: tile ${j} ${j === d ? 'is' : 'is not'} its door`);
  }
  if (d >= 0 && pw.dev[d] !== 2) doors++;
}
check(doors > pop.farmsteads.length / 4, `only ${doors} of ${pop.farmsteads.length} houses have a way to their door`);
// trodden ground is walked and counted and draws nothing (LOOK.from)
const faint = pw.worn.findIndex((s, i) => s === 1 && pw.dev[i] < 2 && !pw.river[i]);
if (faint >= 0) check(Look.segments(pw, faint).length === 0, 'trodden ground draws a trail');
// the trails on the map: every worn trail tile has segments, each from its bend to a joint at most a tile away
let segs = 0;
for (let i = 0; i < pw.N; i++) {
  if (pw.worn[i] < Look.LOOK.from || pw.dev[i] > 1 || pw.river[i]) continue; // paths and lanes are drawn, over fields and meadows too
  const g = Look.segments(pw, i);
  segs += g.length;
  check(g.length > 0 && g.every((s) => Math.hypot(s[4] - pw.hx[i], s[5] - pw.hy[i]) < 1.2 * pw.HW), `tile ${i}: trail segments ${g.length}`);
}
// decorations: an item on a lane (where its first curve ends) goes; one well clear of its trail stays
const lane = pw.worn.findIndex((s, i) => s === 3 && !pw.dev[i] && !pw.river[i]);
if (lane >= 0) {
  const segs3 = Look.segments(pw, lane), [bx, by] = [segs3[0][4], segs3[0][5]];
  const clear = (x, y) => segs3.every((g) => [0, 0.25, 0.5, 0.75, 1].every((t) => { // points along the quadratic curve
    const u = 1 - t, px = u * u * g[0] + 2 * u * t * g[2] + t * t * g[4], py = u * u * g[1] + 2 * u * t * g[3] + t * t * g[5];
    return Math.hypot(px - x, py - y) > g[6] / 2 + 10;
  }));
  const spots = [0, 1, 2, 3, 4, 5].map((k) => [pw.hx[lane] + 0.75 * pw.R * Math.cos(k + 0.5), pw.hy[lane] + 0.75 * pw.R * Math.sin(k + 0.5)]);
  const free = spots.find(([x, y]) => clear(x, y)), items = [{ t: 'stone', x: bx, y: by }, ...(free ? [{ t: 'stone', x: free[0], y: free[1] }] : [])];
  Look.thin(pw, items, G.hexLocator(pw));
  check(!items.some((it) => it.x === bx) && items.length === (free ? 1 : 0), `thin keeps ${items.length} items on and beside a lane`);
}
if (failed) process.exit(1);
console.log(`paths ok: populous seed 7 trodden/path/lane worn in ${start.slice(1).join('/')}, after a year ${counts.slice(1).join(
  '/')}; ${segs} trail segments`);
