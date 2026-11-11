// The scripted player (VB-078): a line played through the player's doors, in Node. It inhabits the first holder, queues work from
// `Sim.opportunities` on some days, argues one cause, sets one wish at a moving round and wishes once for a match, answers each offer of
// marriage that waits for it (refusing the first, leaving every third to its due time), and goes on as a successor at each death.
// It reads the state and its own counters only, so a run saved and loaded between days makes the same choices. A run is
// `playLine({scenario, seed, size, years, saveEvery, player})`; it reports what happened (`report`), the state's hashes and the counts of
// commands by source. Used by tests/line.js (reduced) and tools/player.js (the full runs: 75 years at seeds 7 and 42).
const VB = require('../../src/load.js'), G = VB.gen, Sim = VB.sim;
const { canon, sha } = require('./canon.js');
const { VERBS } = VB['sim/commands'], { YEAR_DAYS, DAY, YEAR } = VB['sim/rules'];
const SIZES = { tiny: [120, 85], small: [180, 130], medium: [280, 200], large: [380, 270] };

const world = (seed, map) => { const it = G.generate(seed, { cols: SIZES[map][0], rows: SIZES[map][1] }); let r; while (!(r = it.next()).done); return r.value; };
// The hashes of a state as tests/golden.js takes them: each key of it, the world and what only indexes other fields left out
const DERIVED = ['w', 'jobsBy', 'living', 'liveHouseholds', 'plans'];
const hashes = (st) => { const o = {}; for (const k of Object.keys({ ...st, wear: 0 }).sort()) if (!DERIVED.includes(k)) o[k] = sha(canon(k === 'wear' ? st.w.wear : st[k])); return o; };

// ---- commands counted by source: each verb's run is wrapped once; a counter is the run's own (`tally`) ----
let tally = null, trail = null;
for (const [name, V] of Object.entries(VERBS)) {
  const run = V.run;
  V.run = (st, c) => {
    if (tally) { const k = `${c.source}:${name}`; tally[k] = (tally[k] || 0) + 1; if (trail && c.actor === trail.pawn) trail.list.push({ t: st.t, verb: name, source: c.source }); }
    return run(st, c);
  };
}
const bySource = (counts) => { const o = {}; for (const [k, n] of Object.entries(counts)) { const [s, v] = k.split(':'); (o[s] = o[s] || {})[v] = n; } return o; };

const TAKE_DAYS = 3;
// A step window in which every job taken is matched with the work command that took it (and the played pawn's own commands are listed)
function stepped(st, hours, line) {
  const agents = st.agents, before = new Map();
  for (let h = 0; h < hours; h += 0.1) {
    for (const id of st.living) before.set(id, agents[id] && agents[id].job ? agents[id].job.key : null);
    const all = Object.entries(tally).filter(([k]) => k.endsWith(':work')).reduce((a, [, n]) => a + n, 0);
    Sim.advance(st, 0.1);
    let took = 0;
    for (const id of before.keys()) { const a = agents[id], now = a && a.job ? a.job.key : null; if (now !== null && now !== before.get(id)) took++; }
    const ran = Object.entries(tally).filter(([k]) => k.endsWith(':work')).reduce((a, [, n]) => a + n, 0) - all;
    line.jobs.took += took; line.jobs.commanded += Math.min(took, ran); line.jobs.stray += Math.max(0, took - ran);
    before.clear();
  }
}

function playLine({ scenario = 'founders', seed = 7, map = 'small', size = null, years = 5, saveEvery = 0, player = true, stepDays = null, quiet = true }) {
  tally = {}; trail = null;
  const dims = size || map, w0 = () => world(seed, dims);
  let st = Sim.seed(w0(), seed, scenario);
  const line = { pawns: [], offers: { yes: 0, no: 0, silent: 0, seen: new Set() }, argued: null, wishes: [], matchWish: null, jobs: { took: 0, commanded: 0, stray: 0 },
    autoOff: null, saves: { n: 0, bytes: 0, maxBytes: 0, saveMs: 0, loadMs: 0 }, hh: new Map(), yearly: [] };
  const hhDays = new Map(); // household id -> {days, hungry0, kids}
  const mark = (h) => hhDays.get(h) || hhDays.set(h, { days: 0, kids: 0, first: st.t }).get(h);
  const classify = (pl, id, pick) => (!pick ? 'break' : pick.why === 'heir' ? 'heir' : pick.why === 'household' ? 'household'
    : pl.left.ties.some((t) => t.id === id && t.why === pick.why) && !/^(son|daughter|father|mother|brother|sister|grand|uncle|aunt|nephew|niece|cousin|husband|wife)/.test(pick.why) ? 'tie' : 'kin');

  const decide = (day) => {
    let pl = st.player;
    if (!pl) {
      const hh = st.households.find((h) => !h.dissolved && h.holder !== null);
      if (!hh) return false;
      Sim.inhabit(st, hh.holder); line.pawns.push({ id: hh.holder, from: st.t, how: 'first holder', to: null, left: null });
      return true;
    }
    if (pl.left) { // the played pawn has died: go on as the first of its successors, else a break
      const list = Sim.successors(st, pl.pawn), pick = list[0] || null;
      let id = pick ? pick.id : st.living.find((x) => st.pawns[x].age >= 18);
      if (id === undefined) return false;
      const how = classify(pl, id, pick), last = line.pawns[line.pawns.length - 1];
      if (Sim.succeed(st, id) !== true) return false;
      last.to = st.t; last.followedBy = how; line.pawns.push({ id, from: st.t, how, to: null, left: null });
      return true;
    }
    const id = pl.pawn, p = st.pawns[id];
    line.hh.set(p.household, true);
    // offers that wait for it: refuse the first, leave every third to its due time, answer yes to the rest
    for (const o of Sim.opportunities(st, id)) {
      if (o.verb !== 'answer' || line.offers.seen.has(o.target)) continue;
      line.offers.seen.add(o.target);
      const n = line.offers.seen.size;
      if (n % 3 === 0) { line.offers.silent++; continue; }
      const yes = n !== 1; if (Sim.answer(st, o.target, yes) === true) line.offers[yes ? 'yes' : 'no']++;
    }
    const opps = Sim.opportunities(st, id), open = (v, f = () => true) => opps.find((o) => o.verb === v && o.why === null && f(o));
    // one cause argued, once the pawn is an adult
    if (!line.argued && p.age >= 18) {
      const o = open('argue');
      if (o && Sim.command(st, { actor: id, verb: 'argue', args: o.args, source: 'player' }) === true) {
        const v = VB['sim/records'].settlementIdOf(st, p);
        line.argued = { t: st.t, pawn: id, village: v, dim: o.args.dim, option: o.args.option, was: st.cenv.settlements[v].practice[o.args.dim], adopted: null };
      }
    }
    // one wish at a moving round (a farm to claim, else service, else moving out), and one for a match
    if (!line.wishes.length) {
      const c = opps.find((o) => o.when === 'round' && o.why === null && o.verb === 'claim'), s = opps.find((o) => o.when === 'round' && o.why === null && o.verb === 'serve' && o.target === null)
        || opps.find((o) => o.when === 'round' && o.why === null && o.verb === 'serve'), l = opps.find((o) => o.when === 'round' && o.why === null && o.verb === 'leave');
      if (c && Sim.wish(st, 'claim', c.target) === true) line.wishes.push({ t: st.t, pawn: id, wish: 'claim', target: c.target });
      else if (s && Sim.wish(st, 'serve', true) === true) line.wishes.push({ t: st.t, pawn: id, wish: 'serve' });
      else if (l && Sim.wish(st, 'out', true) === true) line.wishes.push({ t: st.t, pawn: id, wish: 'out' });
      // none open to it by the third year (a holder is not wanting out): it wishes to take no service, a wish the round honours as any other
      else if (st.t >= 3 * YEAR && Sim.wish(st, 'serve', false) === true) line.wishes.push({ t: st.t, pawn: id, wish: 'serve: none' });
    }
    if (!line.matchWish) {
      const m = opps.find((o) => o.verb === 'match' && typeof o.target === 'number' && o.why === null);
      if (m && Sim.wish(st, 'match', m.target) === true) line.matchWish = { t: st.t, pawn: id, partner: m.target, married: null };
    }
    // work from the list, some days: the best fit open to it, when it has nothing queued
    if (day % 3 === 0 && !pl.queue.length) {
      const wk = opps.find((o) => o.verb === 'work' && o.why === null);
      if (wk) Sim.queue(st, { actor: id, verb: 'work', target: wk.target });
    }
    return true;
  };

  const reload = () => {
    const t0 = process.hrtime.bigint(), text = JSON.stringify(Sim.save(st)), t1 = process.hrtime.bigint();
    const data = JSON.parse(text), back = Sim.load(world(data.seed, dims), data), t2 = process.hrtime.bigint();
    line.saves.n++; line.saves.bytes += text.length; line.saves.maxBytes = Math.max(line.saves.maxBytes, text.length);
    line.saves.saveMs += Number(t1 - t0) / 1e6; line.saves.loadMs += Number(t2 - t1) / 1e6;
    st = back;
  };

  const days = Math.round(years * YEAR_DAYS), t00 = Date.now();
  let alive = true;
  for (let day = 0; day < days && alive; day++) {
    if (player) alive = decide(day);
    if (!alive && player) break;
    // one game day, a few years in, with the automatic behaviour off: the pawn does what its queue and the dark tell it
    if (player && st.player && !st.player.left && stepDays !== null && day >= stepDays.autoOffDay && !line.autoOff) {
      const id = st.player.pawn; trail = { pawn: id, list: [] };
      Sim.setAuto(st, false);
      const wk = Sim.opportunities(st, id).find((o) => o.verb === 'work' && o.why === null);
      if (wk) Sim.queue(st, { actor: id, verb: 'work', target: wk.target });
      Sim.queue(st, { actor: id, verb: 'idle', args: { until: st.t + 2 } });
      for (let h = 0; h < DAY; h += 0.1) Sim.advance(st, 0.1);
      const list = trail.list, planner = list.filter((c) => c.source !== 'player');
      line.autoOff = { pawn: id, commands: list.length, player: list.length - planner.length,
        others: planner.map((c) => `${c.source}:${c.verb}@${(c.t % DAY).toFixed(1)}`), queued: wk ? 2 : 1 };
      Sim.setAuto(st, true); trail = null;
    } else if (stepDays !== null && day >= stepDays.takeFrom && day < stepDays.takeFrom + TAKE_DAYS) stepped(st, DAY, line);
    else Sim.advance(st, DAY);
    // bookkeeping that reads only the state
    for (const h of st.liveHouseholds) { const m = mark(h); m.days++; if (day % YEAR_DAYS === 0) m.kids += st.households[h].members.filter((x) => st.pawns[x].age < 18).length; }
    if (line.argued && line.argued.adopted === null && st.cenv.settlements[line.argued.village].practice[line.argued.dim] === line.argued.option) line.argued.adopted = st.t;
    if (line.matchWish && line.matchWish.married === null) {
      const s = VB['sim/records'].spouseOf(st, line.matchWish.pawn); if (s !== null) line.matchWish.married = s === line.matchWish.partner ? 'the wished partner' : 'another';
    }
    if ((day + 1) % YEAR_DAYS === 0) line.yearly.push({ year: (day + 1) / YEAR_DAYS, living: st.living.length, households: st.liveHouseholds.length });
    if (saveEvery && (day + 1) % Math.round(saveEvery * YEAR_DAYS) === 0) reload();
  }
  line.ms = Date.now() - t00; line.alive = alive;
  line.counts = bySource(tally);
  line.state = st;
  line.hashes = hashes(st);
  line.report = () => reportOf(st, line, hhDays);
  return line;
}

// The outcome as plain data: each pawn played and how it followed the last, the cause and what the meetings did, the offers, the household
// of the line against the rest (hungry days, farms still held, children at the start of each year, per household-year)
function reportOf(st, line, hhDays) {
  const mine = [...line.hh.keys()].filter((h) => h !== null), rest = [...hhDays.keys()].filter((h) => !line.hh.has(h));
  const sum = (ids) => {
    const days = ids.reduce((a, h) => a + hhDays.get(h).days, 0) || 1;
    return { households: ids.length, stillHeld: ids.filter((h) => !st.households[h].dissolved).length,
      hungryPerYear: +(ids.reduce((a, h) => a + st.households[h].hungryDays, 0) / (days / YEAR_DAYS)).toFixed(2),
      childrenPerHouseholdYear: +(ids.reduce((a, h) => a + hhDays.get(h).kids, 0) / (days / YEAR_DAYS)).toFixed(2) };
  };
  const custom = st.record.filter((e) => typeof e === 'object' && !e.self && e.kind === 'custom' && line.argued && e.village === line.argued.village && e.t >= line.argued.t).length;
  const followed = {}; for (const p of line.pawns) if (p.followedBy) followed[p.followedBy] = (followed[p.followedBy] || 0) + 1;
  return {
    pawns: line.pawns.map((p) => ({ id: p.id, name: VB['sim/records'].fullName(st.pawns[p.id]), from: +(p.from / YEAR).toFixed(1), to: p.to === null ? null : +(p.to / YEAR).toFixed(1), how: p.how })),
    followed, argued: line.argued && { ...line.argued, meetingChanges: custom }, wishes: line.wishes, matchWish: line.matchWish,
    offers: { yes: line.offers.yes, no: line.offers.no, silent: line.offers.silent, seen: line.offers.seen.size },
    households: { line: sum(mine), others: sum(rest) },
  };
}

module.exports = { playLine, world, hashes, SIZES, bySource };
