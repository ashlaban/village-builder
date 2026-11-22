// Legs (VB-471, VB-472, VB-473; docs/review-blocks.md, steps 1 to 3): a pawn is always in one leg, a walk, work or a wait, whose end is
// known when it begins and waits in a due-queue; nothing is done to it in between. A walk ends at the step its hours foretold, never
// later, standing at its route's end; a cut treads the tiles entered so far and leaves the pawn where its hours reach; a task under work
// ends at the step its last reckoning foretold. A small constructed state, run for days through its nights, meals and hands.
const assert = require('assert'), VB = require('../src/load.js'), Sim = VB.sim, A = VB['sim/agents'];
const { state } = require('./lib/probe.js'), { checkState } = require('./lib/invariants.js');
const { KINDS } = VB['sim/kinds'], { DAY, TICKS, WORK } = VB['sim/rules'];
const st = state(), DAYS = Number(process.argv[2] || 12);
const n = { walks: 0, arrived: 0, cut: 0, stopped: 0, overdue: 0, placeBad: 0, waits: 0, tasks: 0, ended: 0, taskOverdue: 0, doneBad: 0, reckoned: 0 };
const worst = { place: 0, done: 0 };
const walks = new Map(), waits = new Map(); // pawn id -> its leg as seen at the step before
const seen = new Map(); // job -> {due, done, at} as reckoned at the step before
const hoursOf = (j) => j.hours ?? KINDS[j.kind].hours;
for (let k = 0; k < DAYS * DAY * TICKS; k++) {
  Sim.advance(st, 1 / TICKS);
  // a walk seen at the step before: gone at its due (arrived where it was going, or stopped for the night on the road), or cut before
  for (const [id, l] of walks) {
    const a = st.agents[id];
    if (a.leg === l) {
      if (l.due <= st.tick) n.overdue++;
      continue;
    }
    walks.delete(id);
    if (l.due === st.tick && l.due === l.end) n.arrived++;
    else if (l.due === st.tick) n.stopped++;
    else n.cut++;
  }
  for (const [id, l] of waits) if (st.agents[id].leg === l && l.due <= st.tick) n.overdue++;
  for (const id of st.living) {
    const a = st.agents[id], l = a.leg;
    if (!l) continue;
    if (l.kind === 'walk' && !walks.has(id)) {
      walks.set(id, l);
      n.walks++;
    }
    if (l.kind === 'wait' && !waits.has(id)) {
      waits.set(id, l);
      n.waits++;
    }
    if (l.kind !== 'walk') continue;
    // its place is along its route: at its start before it moves, never past its end, at most a step's walk from where it was
    const [x, y] = VB['sim/pose'].placeOf(st, a), e = (st.tick - l.t) / TICKS, last = a.path[a.path.length - 1];
    const off = e <= 0 ? Math.hypot(x - l.x, y - l.y) : e >= l.h[l.h.length - 1] ? Math.hypot(x - last[0], y - last[1]) : 0;
    worst.place = Math.max(worst.place, off);
    if (off > 1e-9) n.placeBad++;
  }
  for (const [id, l] of waits) if (st.agents[id].leg !== l) waits.delete(id);
  // a task foretold to end at this step has ended (or been reckoned again, its end moved)
  for (const [j, rec] of seen) {
    if (rec.due > st.tick) continue;
    seen.delete(j);
    if (j.due === rec.due && st.jobs.get(j.key) === j && j.rate > 0) n.taskOverdue++;
    else if (rec.due === st.tick) n.ended++;
  }
  for (const j of seen.keys()) if (!(j.rate > 0) || st.jobs.get(j.key) !== j) seen.delete(j); // its hands gone before its end
  for (const j of st.jobs.values()) {
    if ((KINDS[j.kind].attention || 'full') !== 'full' || !(j.rate > 0)) continue;
    const rec = seen.get(j);
    if (!rec) n.tasks++;
    else if (rec.at !== j.at) n.reckoned++;
    seen.set(j, { due: j.due, done: j.done, at: j.at });
    // the progress now is the last reckoning's, and the hours since at its rate, below the task's hours
    const want = Math.min(hoursOf(j), j.done + ((st.tick - j.at) / TICKS) * j.rate), e = Math.abs(VB['sim/work'].doneOf(st, j) - want);
    worst.done = Math.max(worst.done, e);
    if (e > 1e-9 || !(VB['sim/work'].doneOf(st, j) <= hoursOf(j))) n.doneBad++;
  }
  // the queue holds no more than the living, each once
  if (st.legDue.length > st.living.length) n.overdue++;
}
console.log('legs:', JSON.stringify(n), JSON.stringify(worst));
assert(n.walks > 100 && n.arrived > 50 && n.waits > 50 && n.tasks > 20 && n.ended > 10 && n.reckoned > 5, 'the run walked, waited and worked');
assert.strictEqual(n.overdue, 0, 'no walk or wait is left past its due step');
assert.strictEqual(n.placeBad, 0, 'placeOf is at a walk\'s start before it moves and at its end once its hours are walked');
assert.strictEqual(n.doneBad, 0, 'doneOf is the closed form of the last reckoning');
assert.strictEqual(n.taskOverdue, 0, 'no task is left past the step its reckoning foretold');
assert.deepStrictEqual(checkState(st), [], 'invariants after the run');

// ---- a cut: a walk told to go elsewhere stops where its hours reach, treading only the tiles it entered ----
{
  const s = state(), w = s.w;
  Sim.advance(s, WORK[0] + DAY - (s.t % DAY) + 3); // the next day, 9:00
  const a = s.agents[s.living.find((id) => s.agents[id].leg && s.agents[id].leg.kind === 'wait' && !s.agents[id].side)];
  const from = VB['sim/pose'].tileAt(s, ...VB['sim/pose'].placeOf(s, a));
  let far = -1;
  for (let i = 0; i < w.N; i++) if (!w.water[i] && VB['sim/hex'].hexSteps(w, from, i) === 8) { far = i; break; }
  A.walkTo(s, a, far, w.hx[far], w.hy[far]);
  const l = a.leg, tiles = a.path.slice(1).map((p) => p[3]), wear0 = tiles.map((t) => (t >= 0 ? w.wear[t] : 0));
  assert.ok(l.kind === 'walk' && l.h.length >= 6 && s.legDue.includes(a.id), 'a walk leg of 8 tiles, queued');
  const steps = Math.floor(l.h[l.h.length - 1] * TICKS / 2); // about half way
  for (let k = 0; k < steps; k++) Sim.advance(s, 1 / TICKS);
  assert.strictEqual(a.leg, l, "the walk goes on, untouched");
  const e = (s.tick - l.t) / TICKS, [x, y] = VB['sim/pose'].placeOf(s, a), reached = l.h.filter((h) => h <= e).length;
  assert.ok(reached > 0 && reached < tiles.length, `half way: ${reached} of ${tiles.length} points`);
  const home = s.farmsteads[s.households[s.pawns[a.id].household].farmstead].house;
  A.walkTo(s, a, home, w.hx[home], w.hy[home]); // the cut
  assert.ok(Math.hypot(a.leg.x - x, a.leg.y - y) < 1e-9 && a.leg.t === s.tick, 'the next walk begins where the cut left it, from the step now');
  tiles.forEach((t, i) => {
    if (t < 0) return;
    const dw = w.wear[t] - wear0[i], entered = i < reached;
    assert.ok(entered ? dw >= 1 - 1e-5 : Math.abs(dw) < 1e-6 || tiles.indexOf(t) < reached, `tile ${t} (${i}) ${entered ? 'entered and trodden' : 'not reached, not trodden'}: ${dw}`);
  });
  assert.deepStrictEqual(checkState(s), [], 'invariants after a cut');
}

// ---- older saves: a task under work with no reckoning (before VB-472), and pawns with no legs (before VB-473) ----
{
  while (![...st.jobs.values()].some((x) => x.rate > 0 && (KINDS[x.kind].attention || 'full') === 'full')) Sim.advance(st, 1 / TICKS);
  const j = [...st.jobs.values()].find((x) => x.rate > 0 && (KINDS[x.kind].attention || 'full') === 'full');
  st.workDue.splice(st.workDue.indexOf(j), 1);
  delete j.at; delete j.rate; delete j.due;
  const old = JSON.parse(JSON.stringify(Sim.save(st)));
  delete old.state.legDue;
  for (const a of old.state.agents) if (a.leg && a.leg.kind !== 'work') delete a.leg; else if (a.leg) delete a.leg.kind;
  for (const x of old.state.away) x.due = 0;
  A.loaded(st);
  assert(j.rate > 0 && j.at === st.tick && st.workDue.includes(j), "an older save's task under work is reckoned and queued at load");
  // a save made before VB-473 held a background task minded (its due set) out of st.workDue: loading queues its end
  const side = (x) => (KINDS[x.kind].attention || 'full') === 'background' && x.rate > 0;
  for (let k = 0; k < 20 * DAY * TICKS && ![...st.jobs.values()].some(side); k++) Sim.advance(st, 1 / TICKS);
  const bg = [...st.jobs.values()].find(side);
  assert(bg, 'a herd minded at the side');
  st.workDue.splice(st.workDue.indexOf(bg), 1);
  A.loaded(st);
  assert(st.workDue.includes(bg) && bg.due > st.tick, "an older save's background task is queued at load, to end at its due");
  assert.deepStrictEqual(checkState(st), [], 'invariants after loading it');
  const back = Sim.load(st.w, old);
  assert.deepStrictEqual(checkState(back), [], 'a save with no legs loads with every pawn in its leg');
  const walking = back.living.filter((id) => back.agents[id].path && back.agents[id].phase !== 'road');
  assert.ok(walking.every((id) => back.agents[id].leg.kind === 'walk' && back.legDue.includes(id)), 'a walker walks on from where it was saved');
  Sim.advance(back, DAY);
  assert.deepStrictEqual(checkState(back), [], 'and goes on');
}

// ---- a task whose completion moves its pawn (a farm restored: it founds a household there) sets it out on a journey: the journey is its
// own, the task's end leaves it be, and it arrives (VB-473 repair: the end of the task wiped the journey's phase, and the pawn was in 'go')
{
  const s = state(), { moveTo, refreshRoles } = VB['sim/heirs'];
  const plain = (j) => {
    const K = KINDS[j.kind];
    return (K.attention || 'full') === 'full' && !K.carry && !K.load && !K.stack && !j.plot;
  };
  let a = null;
  for (let k = 0; k < 4 * DAY * TICKS && !a; k++) {
    Sim.advance(s, 1 / TICKS);
    const id = s.living.find((x) => {
      const b = s.agents[x];
      return b.phase === 'work' && b.job && b.job.due > s.tick + 1 && plain(b.job);
    });
    if (id !== undefined) a = s.agents[id];
  }
  assert.ok(a, 'a pawn at work on a task that completes where it is done');
  const j = a.job, K = KINDS[j.kind], was = K.done, from = s.pawns[a.id].household;
  const v = s.farmsteads[s.households[from].farmstead].village;
  const to = s.households.find((h) => !h.dissolved && s.farmsteads[h.farmstead].village !== v);
  K.done = (st2, x, hh, c) => {
    if (was) was(st2, x, hh, c);
    if (x !== j) return;
    moveTo(st2, a.id, to.id); // the completion moves its pawn to a household of the other village
    refreshRoles(st2);
  };
  try {
    for (let k = 0; k < 2 * DAY * TICKS && a.job === j; k++) Sim.advance(s, 1 / TICKS);
  } finally {
    K.done = was;
  }
  const trip = s.away.find((x) => x.pawn === a.id);
  assert.ok(a.job !== j && s.pawns[a.id].household === to.id, 'the task ended and moved its pawn');
  assert.ok(trip && (a.phase === 'journey' || a.phase === 'road') && !a.job, `on its journey (phase ${a.phase})`);
  assert.deepStrictEqual(checkState(s), [], 'invariants as it sets out');
  for (let k = 0; k < 6 * DAY * TICKS && s.away.includes(trip); k++) {
    Sim.advance(s, 1 / TICKS);
    if (k % TICKS === 0) assert.deepStrictEqual(checkState(s), [], `invariants on the road, step ${k}`);
  }
  assert.ok(!s.away.includes(trip) && a.phase !== 'journey' && a.phase !== 'road', 'it arrives, and its journey ends');
  assert.strictEqual(VB['sim/pose'].tileAt(s, ...VB['sim/pose'].placeOf(s, a)) >= 0 && s.pawns[a.id].household, to.id, 'a member of its new home');
  assert.deepStrictEqual(checkState(s), [], 'invariants after the arrival');
  console.log(`legs: a completion set pawn ${a.id} out (${j.kind}); it arrived`);
}
