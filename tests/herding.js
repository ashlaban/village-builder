// Herding and grazing pressure (VB-136, sim/grazing): each grazing day a household with animals posts `herd` from 6:00, a background task
// a herder of 8 or more takes; it takes the herds to a pasture within 8 steps (open land or wood, not a field or another household's),
// minds them 9 hours within reach, adding pressure, then brings them home. The pressure halves each year in closed form. A herd left by
// the farm gives half its milk (tests/milk.js) and may get into a crop through a broken fence: the crop loses 10%, the holder remembers it.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, Z = VB['sim/grazing'], Y = VB['sim/byre'], Fd = VB['sim/fields'];
const { KINDS } = VB['sim/kinds'], { hexSteps } = VB['sim/hex'], { tread } = VB['sim/paths'];
const HD = Sim.HERD, H = HD.herding;
let failed = 0, remembered = 'no memory to check'; const check = (ok, m) => { if (!ok) { failed++; console.error('HERDING FAIL:', m); } };
const world = (seed) => { const it = G.generate(seed, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done); return r.value; };

// --- the kind and who herds (Kim, 31 Oct)
const K = KINDS.herd, prio = (role) => Sim.ROLES[role].prio.herd;
check(K.attention === 'background' && K.minAge === 8 && K.hours === 9 && K.window.from === 6 && K.reach > 0, 'herd is not a background kind of 9 hours from 8');
check(prio('child') === 8 && prio('daughter') === 6 && prio('son') === 5 && prio('retired') === 4 && prio('farmhand') === 3 && prio('farmer') === 2
  && !prio('wife') && !prio('maid'), 'herding priorities are not child 8, daughter 6, son 5, retired 4, farmhand 3, farmer 2');

// --- populous tiny, seed 7: a summer morning
const st = Sim.seed(world(7), 7, 'populous');
Sim.advance(st, 15 * Sim.DAY + 10 - st.t); // summer day 3, 10:00
const day = Sim.cal(st.t).day, herdJobs = [...st.jobs.values()].filter((j) => j.kind === 'herd');
const withAnimals = st.liveHouseholds.map((id) => st.households[id]).filter((hh) => Z.herdLoad(st, hh) > 0);
check(herdJobs.length > 0 && herdJobs.length <= withAnimals.length, `${herdJobs.length} herd jobs for ${withAnimals.length} households with animals`);
const held = herdJobs.filter((j) => j.claims.length);
check(held.length >= herdJobs.length / 2, `only ${held.length} of ${herdJobs.length} herd jobs held at 10:00`);
for (const j of herdJobs) {
  const hh = st.households[j.owner.id], f = st.farmsteads[hh.farmstead];
  check(j.key === `herd:h${hh.id}:${day}`, `herd job ${j.key} not of today`);
  check(hexSteps(st.w, f.house, j.site) <= H.steps && j.site !== f.house, `${j.key}: pasture ${hexSteps(st.w, f.house, j.site)} steps from the house`);
  const aftermath = f.meadows.some((m) => m.tile === j.site && m.stage === 'aftermath'); // the farm's own meadow, mown and carried
  check((!st.used.has(j.site) || aftermath) && !(st.owner[j.site] > 0 && st.owner[j.site] !== hh.id + 1), `${j.key}: pasture on a field, a house or another's land`);
  for (const id of j.claims) {
    const p = st.pawns[id], a = st.agents[id];
    check(p.household === hh.id && Sim.age(st, p) >= H.minAge, `${j.key}: herder ${id} of household ${p.household}, aged ${Sim.age(st, p)}`);
    check(a.side && a.side.background === j, `${j.key}: herder ${id} does not hold it at the side`);
    for (const hid of hh.herds) check(st.herds[hid].herder === id && st.herds[hid].herded === day, `${j.key}: herd ${hid} not out with ${id}`);
  }
}
// nobody under 8 herds, and after 10:00 no herd job is posted that nobody took
check(!held.some((j) => j.claims.some((id) => Sim.age(st, st.pawns[id]) < H.minAge)), 'a child under 8 herds');
Sim.advance(st, 1);
check([...st.jobs.values()].every((j) => j.kind !== 'herd' || j.claims.length || j.done > 0), 'an untaken herd job stands after 10:00');
// the evening: the herding done, the herds home, the pressure on the pastures
Sim.advance(st, 9);
const done = held.filter((j) => !st.jobs.has(j.key));
check(done.length > 0, 'no herding finished by 20:00');
for (const j of done) {
  const hh = st.households[j.owner.id], g = Z.grazeOf(st, j.site);
  check(g >= 0.95 * H.hours * Z.herdLoad(st, hh), `${j.key}: pressure ${g.toFixed(1)} on its pasture after ${H.hours} hours of a load of ${Z.herdLoad(st, hh)}`);
  const nb = st.w.nb[j.site * 6];
  if (nb >= 0) check(Z.grazeOf(st, nb) >= 0.95 * H.nb * H.hours * Z.herdLoad(st, hh), `${j.key}: a neighbour's pressure ${Z.grazeOf(st, nb).toFixed(1)}`);
}
// after the working day nobody minds a herd at the side: each herder has let go and is home or on its way (the herds by it)
check(st.living.every((id) => !st.agents[id].side), 'a side task held at 20:00');
// no herding in the byre season
Sim.advance(st, (Sim.HERD.stall[0] + 1) * Sim.DAY + 8 - st.t);
check(![...st.jobs.values()].some((j) => j.kind === 'herd'), 'a herd job in the byre season');

// --- a herd keeps its pasture: the same tile the next day, at least keepDays days, and until it is grazed down or may not be grazed
{
  const s = Sim.seed(world(7), 7, 'populous');
  Sim.advance(s, 15 * Sim.DAY + 7 - s.t);
  const hh = s.liveHouseholds.map((id) => s.households[id]).find((h) => h.pasture), c = Sim.cal(s.t), p = hh.pasture.tile;
  const next = (d) => ({ ...c, day: c.day + d });
  check(Z.todaysPasture(s, hh, next(1)) === p, 'the pasture not kept the next day');
  const g0 = s.w.graze[p];
  s.w.graze[p] = (H.downAt + 1) * Z.yearScale(s);
  check(Z.todaysPasture(s, hh, { ...c, day: hh.pasture.since + H.keepDays - 1 }) === p, 'a grazed-down pasture left before keepDays');
  const moved = Z.todaysPasture(s, hh, { ...c, day: hh.pasture.since + H.keepDays });
  check(moved !== p && moved >= 0 && hh.pasture.tile === moved, 'a grazed-down pasture kept after keepDays');
  s.w.graze[p] = g0;
  const q = hh.pasture.tile, was = s.owner[q];
  s.owner[q] = hh.id + 2; // another household's now
  check(Z.todaysPasture(s, hh, next(1)) !== q, 'a pasture kept on another\'s land');
  s.owner[q] = was;
  check(s.liveHouseholds.every((id) => !s.households[id].pasture || Z.grazable(s, s.households[id], s.households[id].pasture.tile)), 'a kept pasture not grazable');
}

// --- the pressure halves each game year in closed form, put on the new year's scale at its first step
{
  const w = { N: 7, nb: new Int32Array(42).fill(-1), graze: new Float32Array(7) };
  w.nb[0] = 1;
  const s = { t: 10, w, liveHouseholds: [] };
  Z.graze(s, 0, 8);
  check(Math.abs(Z.grazeOf(s, 0) - 8) < 1e-5 && Math.abs(Z.grazeOf(s, 1) - 8 * H.nb) < 1e-5, 'the pressure and its neighbour\'s as added');
  s.t = 10 + Sim.YEAR / 2;
  check(Math.abs(Z.grazeOf(s, 0) - 8 / Math.SQRT2) < 1e-4, `half a year on: ${Z.grazeOf(s, 0)}, wanted ${8 / Math.SQRT2}`);
  s.t = Sim.YEAR; Z.halveGraze(s);
  s.t = Sim.YEAR + 10;
  check(Math.abs(Z.grazeOf(s, 0) - 4) < 1e-4, `a year on, past the new year: ${Z.grazeOf(s, 0)}, wanted 4`);
}

// --- a herd on the move wears the tiles it crosses, a quarter crossing a head
{
  const s = Sim.seed(world(7), 7, 'populous'), hh = s.households.find((h) => Z.heads(s, h)[0] > 0), id = hh.members[0];
  const n = Z.heads(s, hh)[0] + Z.heads(s, hh)[1];
  check(Z.driven(s, id) === 0, 'a pawn drives herds it has not taken out');
  Z.driveOut(s, hh, id, Sim.cal(s.t));
  check(Z.driven(s, id) === n, `driving ${Z.driven(s, id)} head, wanted ${n}`);
  const t = s.w.wear.findIndex((x, i) => !s.w.dev[i] && !s.w.water[i]), was = s.w.wear[t];
  tread(s.w, t, 1 + H.move * Z.driven(s, id));
  check(Math.abs(s.w.wear[t] - was - (1 + H.move * n)) < 1e-4, 'the herds\' crossing');
  Z.driveHome(s, hh, id);
  check(Z.driven(s, id) === 0, 'still driving once home');
}

// --- a herd left by the farm gets into a standing crop through a broken stretch of fence
{
  const s = Sim.seed(world(7), 7, 'populous');
  Sim.advance(s, 15 * Sim.DAY + 1 - s.t);
  const c = Sim.cal(s.t), v = s.villages.find((x) => x.fence.length && x.farmsteads.filter((f) => s.farmsteads[f].household !== null).length >= 2);
  const farms = v.farmsteads.map((id) => s.farmsteads[id]).filter((f) => f.household !== null);
  const hh = farms.map((f) => s.households[f.household]).find((h) => h.herds.some((id) => s.herds[id].species === 'cattle' && s.herds[id].head.length));
  const herd = hh.herds.map((id) => s.herds[id]).find((x) => x.species === 'cattle'), g = farms.find((f) => f.household !== hh.id) || farms[0];
  const fd = g.fields[0];
  fd.stage = 'growing'; fd.sown = c.day - 4; delete fd.trampled;
  for (const x of v.fence) x.cond = 1;
  const sx = v.fence[0]; sx.cond = 0.3; sx.edges = [{ ...sx.edges[0], tile: fd.tile }];
  herd.herded = -1;
  check(Z.unherded(s, herd, c), 'a herd not taken out yesterday is not unherded');
  const events = s.record.length;
  s.rng.herds.fix = 0.99; Y.stray(s, hh, herd);
  check(!fd.trampled && s.record.length === events, 'the cattle got in against the chance');
  s.rng.herds.fix = 0; Y.stray(s, hh, herd); delete s.rng.herds.fix;
  check(fd.trampled === 1, `trampled ${fd.trampled}`);
  const e = s.record[s.record.length - 1];
  check(e && e.kind === 'cattleInCrop' && /broken fence/.test(e.text || ''), `the event ${JSON.stringify(e && e.kind)}`);
  // its holder remembers it about the holder of the farm nearest the stretch, the stretch's keeper
  const keeper = farms.slice().sort((a, b) => hexSteps(s.w, sx.tile, a.house) - hexSteps(s.w, sx.tile, b.house))[0];
  const holder = s.households[g.household].holder, kept = s.households[keeper.household].holder;
  if (holder !== null && kept !== null && holder !== kept) {
    const r = s.pawns[holder].rel.get(kept);
    check(r && r.mem.crop && Math.abs(r.mem.crop.v - VB['sim/rules'].SOCIAL.memories.crop.v) < 1e-9, `the holder's memory ${JSON.stringify(r && r.mem)}`);
    remembered = 'the holder remembers it of the keeper';
  }
  // mended, it holds: no crop is lost
  sx.cond = 1; s.rng.herds.fix = 0; Y.stray(s, hh, herd); delete s.rng.herds.fix;
  check(fd.trampled === 1, 'cattle through a mended fence');
  // the reaping: the field gives 10% less for each time the cattle got in
  const yieldOf = (n) => { if (n) fd.trampled = n; else delete fd.trampled; s.rng.fields.fix = 0.5; Fd.reaped(s, fd, c); delete s.rng.fields.fix; return fd.held; };
  const soil = fd.soil, plain = yieldOf(0); fd.soil = soil; const lost = yieldOf(1); fd.soil = soil;
  check(Math.abs(lost - Math.round(plain * (1 - HD.stray.loss))) <= 1 && lost < plain, `reaped ${lost} trampled, ${plain} not`);
  check(fd.trampled === undefined, 'trampled kept past the reaping');
}

if (failed) process.exit(1);
console.log(`herding ok: populous 7 tiny, summer day 3: ${held.length} of ${herdJobs.length} herd jobs held by 10:00, ${done.length} done by 20:00; `
  + `pressure halves a year in closed form; herds wear the way; a broken fence lets cattle into the crop, ${remembered}`);
