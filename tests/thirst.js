// VB-1554: the thirsty pawn. On drawn maps (tests/lib/tiny.js): a pawn's thirst is read from the hour it last drank (pawn.drank) and a
// save without it loads as having drunk; the dry day's health is the pawn's own (who drank at a source loses none, who did not loses
// HEALTH.dry; marsh water drunk costs HEALTH.marsh); a pawn mowing, 36 hours without a drink and its household's water not in, leaves the
// mowing, drinks at the farm's source and brings the water home, and the log names the event, the pawn and the place; a pawn with no
// source in reach is refused with the reason, as a child under 7 is; the played pawn may be given the verb.
const VB = require('../src/load.js'),
  Sim = VB.sim,
  Water = VB['sim/water'],
  Thirst = VB['sim/thirst'],
  Drinking = VB['sim/drinking'];
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const { FRESH } = VB['world/water'];
const { TICKS, DAY, YEAR, HEALTH, cal } = VB['sim/rules'];
const { KINDS } = VB['sim/kinds'];
const { issue, perform, active } = VB['sim/commands'];
const { age } = VB['sim/records'];
const { THIRST } = Thirst;
let failed = 0;
const check = (ok, m) => {
  if (!ok) {
    failed++;
    console.error('THIRST FAIL:', m);
  }
};
const meadow = (cols, rows) => Array.from({ length: rows }, () => '.'.repeat(cols));
const brook = (w, i) => {
  w.river[i] = 1;
  w.fresh[i] = FRESH.BROOK;
};
const tick = (st) => Sim.advance(st, 1 / TICKS);
// a farm of `size` with a brook `steps` tiles east of its house, and no well of its own
const farmBy = (steps, size, opt = {}) => {
  const lay = (ww) => tinyState(ww, [{ at: [8, 6], farms: 1, sizes: [size] }], { seed: 7, ...opt });
  const w = tinyWorld(meadow(30, 13));
  if (steps) brook(w, lay(tinyWorld(meadow(30, 13))).farmsteads[0].house + steps);
  const st = lay(w),
    hh = st.households[0],
    f = st.farmsteads[hh.farmstead];
  w.fresh[f.house] = FRESH.NONE; // a test's write: without the well a farm that has stood far from water starts with
  if (st.villages[0].well !== null) w.fresh[st.villages[0].well] = FRESH.NONE;
  st.villages[0].well = null; // a test's write: no well on the green either
  Water.find(st, f);
  return { st, hh, f, w };
};

// ---- 1. thirst in closed form; the kind and the verb are declared; a save without the hour loads as having drunk ----
{
  const { st, hh } = farmBy(4, 3);
  const p = st.pawns[hh.holder];
  check(typeof p.drank === 'number' && Thirst.thirst(st, p) === st.t - p.drank, 'thirst is the hours since the pawn last drank');
  check(THIRST.thirsty === 24 && THIRST.leave === 36, 'thirsty at 24 hours, leaving at 36');
  check(KINDS.drink && KINDS.drink.hours === THIRST.sip && VB['sim/commands'].VERBS.drink, 'the kind and the verb drink');
  Thirst.drank(st, p, st.t - 30);
  check(Thirst.thirst(st, p) <= st.t - p.drank && !Thirst.thirsty(st, p), 'a drink never moves the hour back');
  p.drank = st.t - 30; // a test's write
  check(Thirst.thirsty(st, p) && /Thirsty/.test(Sim.thirstLine(st, p.id)), `the panel says thirsty at 30 hours (${Sim.thirstLine(st, p.id)})`);
  p.drank = st.t - 40; // a test's write
  check(/Parched/.test(Sim.thirstLine(st, p.id)), 'and parched from 36');
  for (const q of st.pawns) delete q.drank; // a save from before VB-1554
  const again = Sim.load(tinyWorld(meadow(30, 13)), JSON.parse(JSON.stringify(Sim.save(st))));
  check(
    again.pawns.every((q) => q.drank === again.t) && Sim.thirstLine(again, p.id) === null,
    'a save without the hour loads as having drunk',
  );
  delete st.pawns[0].drank;
  check(checkState(st).some((m) => m.includes('drank')), 'the invariant sees a pawn with no hour');
}

// ---- 2. the dry day's health is the pawn's own ----
{
  const { st, hh } = farmBy(4, 4);
  while (cal(st.t).hour !== 0 || Math.floor(st.t / DAY) < 2) tick(st);
  const adults = hh.members.map((id) => st.pawns[id]).filter((p) => p.died === null && age(st, p) >= 15 && age(st, p) < 60);
  check(adults.length >= 2, `two adults to compare (${adults.length})`);
  const [a, b] = adults,
    day = Math.floor(st.t / DAY) - 1;
  // the day that ended had no water in; a drank at a source in its afternoon, b not since the day before's meal
  hh.waterDay = day - 1; // a test's write
  a.drank = day * DAY + 15;
  b.drank = (day - 1) * DAY + THIRST.meal;
  a.health = b.health = 50;
  a.hunger = b.hunger = 0;
  a.hungerLog.length = b.hungerLog.length = 0;
  VB['sim/hunger'].feedHousehold(st, hh, 1);
  check(a.health >= 50, `who drank at a source loses nothing on the household's dry day (${a.health})`);
  check(Math.abs(50 - b.health - HEALTH.dry) < 1e-9, `who ended the day without a drink loses HEALTH.dry (${50 - b.health})`);
  check(hh.dryLog[hh.dryLog.length - 1] === 1, "the day is the household's dry day still: nothing was cooked for it");
  check(st.thirstDue && st.thirstDue.some((e) => e.pawn === b.id) && !st.thirstDue.some((e) => e.pawn === a.id), 'only the thirsty one is held due');
  check(st.thirstDue.find((e) => e.pawn === b.id).at === b.drank + THIRST.leave, 'at 36 hours without a drink');
  // marsh water drunk by itself: HEALTH.marsh at that day's end, and the meal restores
  st.thirstDue.length = 0;
  hh.waterDay = day - 1;
  Thirst.drank(st, a, st.t - 2, true);
  a.health = 50;
  const lone = VB['sim/hunger'].updateHealth; // the same day's rule with no drink of marsh water, for the meal's part
  const c0 = { ...a, hungerLog: [...a.hungerLog] };
  st.t += DAY; // a test's write: the next midnight, with nothing in between
  a.marsh = Math.floor(st.t / DAY) - 1;
  a.drank = st.t - 3;
  VB['sim/hunger'].feedHousehold(st, hh, 1);
  const withMarsh = a.health;
  a.health = 50;
  a.hunger = c0.hunger;
  delete a.marsh;
  lone(st, a, true, 0, 0, false);
  check(Math.abs(a.health - withMarsh - HEALTH.marsh) < 1e-9, `marsh water drunk costs HEALTH.marsh (${a.health - withMarsh})`);
  st.t -= DAY;
}

// ---- 3. a pawn mowing, 36 hours without a drink, its household's water not in: it leaves, drinks and brings the water home ----
{
  const { st, hh, f } = farmBy(5, 4, { herds: true });
  const src = Water.sourceOf(st, f);
  check(src.tile >= 0 && src.cls === FRESH.BROOK, `the farm draws at the brook (${JSON.stringify(src)})`);
  // on to a morning on which a member mows
  let who = null;
  const end = st.t + 2 * YEAR;
  while (st.t < end && !who) {
    tick(st);
    const h = cal(st.t).hour;
    if (h < 8 || h > 13) continue;
    for (const id of hh.members) {
      const a = st.agents[id];
      if (a.job && a.job.kind === 'mow' && a.phase === 'work' && Thirst.goes(st, st.pawns[id])) who = id;
    }
  }
  check(who !== null, 'a member mows on a summer morning');
  if (who !== null) {
    const p = st.pawns[who],
      a = st.agents[who],
      d = cal(st.t).day,
      mowing = a.job,
      n0 = st.record.length;
    // the household's water never fetched today, and the pawn 35.9 hours without a drink: yesterday ended thirsty, so it is held due
    hh.waterDay = d - 1; // a test's write
    for (const j of [...st.jobs.values()]) if (j.kind === 'water') VB['sim/agents'].dropJob(st, j); // and no fetch stands posted
    p.drank = st.t - THIRST.leave + 0.1; // a test's write
    const [dry] = Thirst.dayEnd(st, p, false);
    check(dry === 1 && st.thirstDue.some((e) => e.pawn === who), 'a pawn that ended its day thirsty is held due');
    check(a.job === mowing, 'under 36 hours it mows on');
    while (a.job === mowing && st.t < p.drank + THIRST.leave + 0.5) tick(st);
    check(a.job && a.job.kind === 'drink' && a.job.site === src.tile, `at 36 hours it leaves the mowing to drink (${a.job && a.job.kind})`);
    check(!mowing.claims.includes(who), 'the mowing is let go');
    check(/Going to drink|Drinking/.test(Sim.describe(st, who)), `its card says so (${Sim.describe(st, who)})`);
    const ev = st.record.slice(n0).find((e) => e.kind === 'thirst');
    check(
      ev && ev.pawn === who && ev.farm === f.id && ev.household === hh.id && ev.tile === src.tile && ev.reason === 'mow' && /left mow/.test(ev.text),
      `the log names the event, the pawn, the place and what was left (${JSON.stringify(ev)})`,
    );
    const before = p.drank;
    let fetched = null;
    for (let i = 0; i < 6 * TICKS && hh.waterDay !== d; i++) {
      tick(st);
      if (a.job && a.job.kind === 'water') fetched = a.job;
    }
    check(p.drank > before && Thirst.thirst(st, p) < 6, `it drank (${Thirst.thirst(st, p)} hours ago)`);
    check(fetched && fetched.site === src.tile, 'and took the fetch from there');
    check(hh.waterDay === d, `and brought the water home (waterDay ${hh.waterDay}, day ${d})`);
    check(!st.jobs.has(`drink:p${who}`), 'the drink is off the board');
    check(!checkState(st).length, `invariants: ${checkState(st).slice(0, 3).join('; ')}`);
    // the played pawn may be given the verb: pending while it goes and drinks, then done
    const r = perform(st, { actor: who, verb: 'drink', source: 'player' });
    check(r.status === 'pending' && active(st, { actor: who, verb: 'drink' }, r.ref), `the verb, given by the player, is under way (${JSON.stringify(r)})`);
    for (let i = 0; i < 4 * TICKS && active(st, { actor: who, verb: 'drink' }, r.ref); i++) tick(st);
    check(!active(st, { actor: who, verb: 'drink' }, r.ref) && Thirst.thirst(st, p) < 0.5, 'and ends when it has drunk');
  }
}

// ---- 4. no source in reach: the verb is refused with the reason; a child under 7 does not go ----
{
  const { st, hh, f } = farmBy(0, 5);
  check(f.water.tile === -1, 'no water in reach of the farm');
  const why = issue(st, { actor: hh.holder, verb: 'drink', source: 'pawn' });
  check(typeof why === 'string' && /no source of fresh water within 8 hours/.test(why), `refused with the reason (${why})`);
  check(!st.agents[hh.holder].job || st.agents[hh.holder].job.kind !== 'drink', 'and nothing is begun');
  check(Drinking.sourceFor(st, st.pawns[hh.holder]).tile === -1, 'sourceFor: none');
  const child = hh.members.map((id) => st.pawns[id]).find((p) => age(st, p) < 7);
  if (child) {
    const w2 = issue(st, { actor: child.id, verb: 'drink', source: 'pawn' });
    check(typeof w2 === 'string' && /too young/.test(w2), `a child under 7 is given its drink at home (${w2})`);
    child.drank = st.t - 30; // a test's write
    Thirst.dayEnd(st, child, false);
    check(!(st.thirstDue || []).some((e) => e.pawn === child.id), 'and is never held due');
  }
  // held due with no source: asked once, refused, and not held again before its next dry day's end
  const p = st.pawns[hh.holder];
  p.drank = st.t - 40; // a test's write
  Thirst.dayEnd(st, p, false);
  check(st.thirstDue.length === 1, 'the thirsty holder is held due');
  tick(st);
  check(st.thirstDue.length === 0 && (!st.agents[p.id].job || st.agents[p.id].job.kind !== 'drink'), 'with no source it is asked once and goes nowhere');
}
if (failed) process.exit(1);
console.log('thirst ok: thirst from the hour last drunk; the dry day the pawn\'s own; a mower leaves at 36 hours, drinks and fetches; no source refused');
