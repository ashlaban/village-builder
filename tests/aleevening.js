// The ale evening and the season's rite (VB-522; design.md, Where pawns meet). On a constructed state (tests/lib/probe.js, two villages
// of two farms, 1.75 walking hours apart (14 tiles at 8 an hour)): no barrel, no evening; a barrel kept for a wedding at the farm is not poured; a second host of
// the village the same day waits; a guest 2 hours away is not asked; the barrel leaves the store once, and only if a guest came; the
// rite's leader is the most devout respected holder present, and only it gains the ties of those who came.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, S = VB['sim/stores'], O = VB['sim/occasions'];
const { TRAITS, ALE_EVENING, DAY, TICKS } = VB['sim/rules'], { SOCIAL } = VB['sim/ties'], { issue } = VB['sim/commands'];
const stored = (st, a, b) => st.pawns[a].ties.get(b) || 0; // the stored weight, on the pawn's own decaying scale (sim/ties' tieOf)
const { state } = require('./lib/probe.js'), { checkState } = require('./lib/invariants.js');

const live = (st) => st.households.filter((h) => !h.dissolved && h.holder !== null);
const barrel = (st, hh, n = 1) => hh.ale.push({ n, until: st.t + 5 * DAY }); // lint-allow: owner a constructed state's barrel
const callAle = (st, hh) => issue(st, { actor: hh.holder, verb: 'callAle', source: 'player' });
const ales = (st) => st.occasions.filter((o) => o.kind === 'ale');
const pours = (hh) => hh.ledger.filter((e) => e.good === 'ale' && e.kind === 'pour').length;
const PIETY = TRAITS.names.indexOf('piety');
// The occasion o ended now with those of `come` standing at it (arrived: no path left).
function end(st, o, come) {
  for (const id of come) {
    st.agents[id].occasion = o.id;
    st.agents[id].path = null;
    if (!o.come.includes(id)) o.come.push(id);
  }
  o.asked = [];
  o.due = o.end;
  st.occasions.splice(st.occasions.indexOf(o), 1);
  st.occasions.unshift(o);
  st.t = o.end;
  st.tick = Math.round(st.t * TICKS);
  O.occasionsDue(st);
}
const evening = (st) => st.t - (st.t % DAY) + 10;
const at = (st, t) => {
  st.t = t;
  st.tick = Math.round(t * TICKS);
}; // ten in the morning, before the end of work

// 1. No barrel, no evening: the verb says why, and nothing is called.
{
  const st = state(), [host] = live(st);
  at(st, evening(st));
  const r = callAle(st, host);
  assert.ok(typeof r === 'string' && /no barrel/.test(r), `refused for want of a barrel: ${r}`);
  assert.strictEqual(ales(st).length, 0, 'no evening called');
}

// 2. A barrel kept for a wedding called at its farm is not poured: the one barrel is the wedding's.
{
  const st = state(), [host] = live(st), f = st.farmsteads[host.farmstead];
  at(st, evening(st));
  barrel(st, host);
  st.occasions.push({ id: st.occasionSeq++, kind: 'wedding', for: [host.members[0], host.members[1]], village: f.village, farm: f.id,
    tile: f.house, x: 0, y: 0, start: st.t + DAY, end: st.t + DAY + 5, overrides: false, asked: [{ id: host.members[2], leave: st.t + DAY,
      hours: 0 }], come: [], due: st.t + DAY });
  const r = callAle(st, host);
  assert.ok(typeof r === 'string' && /kept for an occasion/.test(r), `the wedding's barrel is kept: ${r}`);
  barrel(st, host);
  assert.strictEqual(VB['sim/venues'].cannotCallAle(st, host.holder), null, 'a second barrel is to spare');
}

// 3. A second host of the same village the same day waits; a host of the other village may call its own.
{
  const st = state(), [a, b, c] = live(st);
  at(st, evening(st));
  st.rng.occasions.fix = 0; // every chance comes up: each asked says yes
  for (const hh of [a, b, c]) barrel(st, hh);
  assert.strictEqual(callAle(st, a), true, 'the first host calls');
  const r = callAle(st, b);
  assert.ok(typeof r === 'string' && /ale evening tonight/.test(r), `the second waits: ${r}`);
  assert.strictEqual(callAle(st, c), true, "the other village's host calls its own");
  assert.strictEqual(ales(st).length, 2, 'two evenings, one a village');
}

// 4. Who is asked: the village and the villages within ALE_EVENING.reach walking hours; one 2 hours away is not.
{
  for (const [hours, far] of [[1.1666666666666667, true], [2, false]]) {
    const st = state(), [host, , other, other2] = live(st);
    st.villageHours[0][1] = st.villageHours[1][0] = hours; // lint-allow: owner the table of walking hours, set for the case
    at(st, evening(st));
    st.rng.occasions.fix = 0;
    barrel(st, host);
    assert.strictEqual(callAle(st, host), true);
    const asked = ales(st)[0].asked.map((g) => g.id),
      away = [...other.members, ...other2.members].filter((id) => Sim.age(st, st.pawns[id]) >= 16);
    assert.strictEqual(away.some((id) => asked.includes(id)), far, `${hours} hours away: ${far ? '' : 'not '}asked`);
    assert.ok(asked.length <= host.members.length + ALE_EVENING.guests, 'at most a barrel of guests besides the household');
  }
}

// 5. The barrel leaves the store once, and only if a guest of another household came.
{
  const st = state(), [host, guest] = live(st);
  at(st, evening(st));
  st.rng.occasions.fix = 0;
  barrel(st, host, 2);
  callAle(st, host);
  end(st, ales(st)[0], [...host.members]);
  assert.strictEqual(S.aleOf(st, host), 2, 'only its own household came: nothing poured');
  at(st, evening(st) + DAY);
  callAle(st, host);
  const o = ales(st)[0];
  end(st, o, [...host.members, ...guest.members]);
  assert.strictEqual(S.aleOf(st, host), 1, 'one barrel poured for its guests');
  assert.strictEqual(pours(host), 1, 'poured once');
  const ev = st.record.filter((e) => e && e.kind === 'aleEvening');
  assert.strictEqual(ev.length, 1, 'one evening told');
  assert.strictEqual(ev[0].n, guest.members.length, 'its guests counted');
  assert.ok(VB['sim/relations'].balance(st, host.holder, guest.holder) > 0, "the guests' holder owes the ale, as a feast books it");
  delete st.rng.occasions.fix;
  const errs = checkState(st);
  assert.deepStrictEqual(errs, [], errs.join('\n'));
}

// 6. The rite: the leader is the holder present highest in piety × standing; only it gains the ties of those who came.
{
  const st = state(), [h0, h1] = live(st), v = st.villages[0];
  at(st, evening(st));
  const come = [...h0.members, ...h1.members],
    set = (id, piety, standing) => {
      st.pawns[id].traits[PIETY] = piety; // lint-allow: owner a constructed state's trait
      st.pawns[id].standing = standing; // lint-allow: owner a constructed state's standing
    };
  for (const id of come) set(id, 0.9, 1); // devout, but not holders
  set(h0.holder, 0.5, 1.8); // 0.9
  set(h1.holder, 0.8, 1.5); // 1.2: the leader
  const o = { id: st.occasionSeq++, kind: 'rite', for: [], village: v.id, farm: null, tile: v.center, x: 0, y: 0, start: st.t,
    end: st.t + 2, overrides: false, asked: [], come: [], due: st.t + 2 };
  st.occasions.push(o);
  const before = come.map((id) => come.map((j) => stored(st, id, j)));
  end(st, o, come);
  const ev = st.record.filter((e) => e && e.kind === 'rite');
  assert.strictEqual(ev.length, 1, 'the rite told');
  assert.strictEqual(ev[0].pawn, h1.holder, 'led by the most devout respected holder');
  assert.strictEqual(ev[0].n, come.length);
  come.forEach((id, i) =>
    come.forEach((j, k) => {
      if (id === j) return;
      const grew = stored(st, id, j) - before[i][k];
      if (j === h1.holder) assert.ok(grew > 0, `${id} gained a tie to the leader`);
      else assert.ok(Math.abs(grew) < 1e-12, `${id}'s tie to ${j} unchanged`);
    }),
  );
  assert.ok(SOCIAL.ties.rite === 0.25);
}

// 7. The rites are called on a rite's day, on each green, by the calendar.
{
  const st = state();
  assert.ok(VB['sim/venues'].riteDay(Sim.cal(0)), 'spring day 1 is a rite day');
  for (const c of Object.values(st.cenv.cultures)) c.practices = { ...(c.practices || {}), riteDays: 'common' }; // lint-allow: owner a constructed state
  st.rng.occasions.fix = 0;
  VB['sim/venues'].callRites(st);
  const rites = st.occasions.filter((o) => o.kind === 'rite');
  assert.strictEqual(rites.length, 2, 'a rite on each green');
  assert.ok(rites.every((o) => o.start % DAY === 12 && o.asked.length > 0), 'at noon, its adults asked');
}
console.log('ale evening and rite ok');

// 8. Rites on a village's own days (VB-775): two greens 1.75 hours apart with different days; a devout adult attends both villages' rites
// (the other's by the walk); under 'common' days it attends its own only; a village 3 hours away sends nobody.
{
  const { RITE } = VB['sim/rules'], V = VB['sim/venues'];
  const setup = (mode) => {
    const st = state();
    for (const c of Object.values(st.cenv.cultures)) c.practices = { ...(c.practices || {}), riteDays: mode }; // lint-allow: owner a constructed state
    st.villages[0].riteDays = [0, 5, 6]; // lint-allow: owner a constructed state
    st.villages[1].riteDays = [2, 7, 9]; // lint-allow: owner a constructed state
    st.rng.occasions.fix = 0;
    return st;
  };
  const rites = (st) => st.occasions.filter((o) => o.kind === 'rite');
  const adultsOf = (st, vid) =>
    live(st).filter((h) => st.farmsteads[h.farmstead].village === vid).flatMap((h) => h.members).filter((m) => st.pawns[m].alive && VB['sim/records'].age(st, st.pawns[m]) >= 16);
  const day = (st, season, sday) => at(st, (season * 100 + sday) * 0 + Sim.cal.length * 0 + (season * VB['sim/rules'].SEASON_DAYS + sday) * DAY);
  {
    const st = setup('own');
    day(st, 0, 0);
    V.callRites(st);
    const r = rites(st);
    assert.strictEqual(r.length, 1, 'only village 0 keeps spring day 1');
    assert.strictEqual(r[0].village, 0);
    const guests = adultsOf(st, 1);
    assert.ok(guests.length && guests.every((m) => r[0].asked.some((a) => a.id === m)), "the other village's adults are asked, by the walk");
    assert.ok(r[0].asked.every((a) => a.hours === 0 || Math.abs(a.hours - 1.75) < 0.1), 'those who walk, walk the hours between the greens');
    day(st, 0, 2);
    st.occasions.length = 0;
    V.callRites(st);
    assert.strictEqual(rites(st).length, 1, "and village 1's rite is on its own day");
    assert.strictEqual(rites(st)[0].village, 1);
    delete st.rng.occasions.fix;
    assert.deepStrictEqual(checkState(st), [], 'invariants hold');
  }
  {
    const st = setup('common');
    day(st, 0, 0);
    V.callRites(st);
    assert.ok(rites(st).length === 2 && rites(st).every((o) => o.asked.every((a) => a.hours === 0)), 'under common days both hold it, each its own');
  }
  {
    const st = setup('own');
    st.villageHours[0][1] = st.villageHours[1][0] = RITE.reach + 1; // lint-allow: owner a constructed state
    day(st, 0, 0);
    V.callRites(st);
    const r = rites(st);
    assert.ok(r.length === 1 && r[0].asked.every((a) => st.pawns[a.id].household === null || st.farmsteads[st.households[st.pawns[a.id].household].farmstead].village === 0), 'a village beyond the reach sends nobody');
  }
}
