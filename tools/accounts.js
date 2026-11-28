// The balance accounts (VB-403): a game year's food, people, spread, goodwill and labour, village by village and in all, read from the run.
// node tools/sim.js --scenario populous --seed 7 --map small --years 30 --report accounts [--json]   (or --load FILE)
// It reads only: no state is added, nothing is saved, nothing the simulation reads changes (`node tools/same.js` prints same). Its
// bookkeeping is kept here, outside `st` (docs/cost.md, rule 10). The run is cut at the calendar years' turns (sim/rules YEAR): the
// accounts' last year ends at its turn, some hours before the other reports' last line.
// Food, in rations as held (a ration of grain, of flour, of fish ...; meals are left out: food is counted eaten as it goes into the pot):
//   produced    grain by crop (sheaves brought to the barn; the village's common fields' harvest), fish, gathered food, meat (the slaughter
//               and the hunt), milk (and butter)
//   received    gifts into households and into the village store, packs brought home, provisions, shares and farms handed on
//   outlets     seed sown; eaten as meals (into the pot, by food), uncooked (grain and flour), fresh (gathered food as it is), from the larder, seed
//               eaten; feasts; brewed; given (to households, to the village store, out of the store), packed for journeys, provisions,
//               shares and handings on; rotted in households (grain, fresh food, the larder) and in the village store; left with a
//               household that ended (its stores go with its farm); died holding: a pawn's stake when it dies, which nothing moves
//   stores      the change over the year in grain, sheaves in the barn, flour, fish by the rack, fresh food, the larder, the village
//               stores, pawns' stakes and gift grain on its way
//   unexplained produced + received - outlets - the change in stores, with its share of the produce: 0 when every movement is counted.
//   The grain's own account, island-wide, beside it: the same lines for sheaves, grain and flour and their stocks (the harvest's split).
// People (island-wide): births, those who came from outside, deaths by cause, marriages, moves between villages (a pawn living at the
//   year's start and end in two villages), households founded and dissolved; growth, births a woman (the period's total fertility, by
//   five-year groups 15 to 49), the shares dying before 1 and before 15 (the period's life table, as the balance review's scripts), the
//   mean age at first marriage by sex and the share of the living 45 and over never married (tools/waiting.js yearFacts); and at the
//   moving round's day, the unmarried of age by what holds them back (tools/waiting.js census: hungry, none (no partner), kin, home,
//   score, means, free), with the matches the round put off for the means.
// Spread, at the year's turn: food produced over need a household (its produced lines over its need for a year: p10, p50, p90, the share
//   under 1.0 and 1.67), days of food held (p10, p50, p90), the Gini of fields and of grain, the share of single-person households, the
//   households hungry over 30 days of the year; and all food produced over all need.
// Goodwill: gifts in the year (the record's), goodwill outstanding a live household (owed to its members), live pairs, the share owed to
//   the three households owed most, and the goodwill booked at feasts. Labour: the share of work hours working, walking, carrying and idle,
//   by season, of those 7 and older not children (tools/idle.js countHour: the run is stepped an hour at a time).
// The balance properties (docs/balance/cards.md): a line each, this year's value, or `no mechanism yet`.
// Every good's own account (VB-1684), island-wide, beside the food's: for each good the stores' ledgers and totals name (grain of any crop,
//   sheaves, flour, meals, fish, the larder's foods, ale, wood, timber, peat, stone, tar, hides, salt, iron, clay, bog ore, wool, yarn,
//   cloth ...), every movement booked under its reason, `in.<reason>` what came in, `out.<reason>` what went (left with a household that
//   ended, died holding), against the change in what households, villages, pawns' stakes and gift grain on its way hold of it:
//   `unexplained` is 0 when nothing moves the good outside the stores. The run's account of each good (`run`) adds the years' up: the
//   report reads each year's movements at its turn, before the stores prune them (three years kept), so it holds over any length of run.
//   Goods outside sim/stores (the hay, sim/byre) have no ledger to read and are not here.
// --json: the years as data, a record a year ({year, food: {all, villages}, grain, goods, people, spread, goodwill, labour, properties}),
//   and the run's account of each good (`goods`).
// Read from the stores' ledgers and yearly totals (src/sim/stores.js) at each year's turn, and from a closing household's ledger as it
// closes, which is counted by wrapping sim/stores' close at load, as tools/perf.js wraps its systems (tests/lib/load.js): `load()` replaces
// require('../src/load.js'). The larder's takes and losses are in the ledger since VB-683.
// Used by tools/sim.js (`const a = require('./accounts.js')`, `VB = a.load()`, `const r = a.report(VB, st)`, `r.advanceYear()`,
// `r.result()`, `a.print(out)`) and tests/accounts.js.
require('./help.js')(__filename);
const { loadModules } = require('../tests/lib/load.js');
const Waiting = require('./waiting.js'), { countHour } = require('./idle.js');

// ---- the wrapper: a household's ledger as it closes ----
let sink = null; // the report listening (one a process)
function load() {
  const around = (fn, before) => function (...a) { before(...a); return fn.apply(this, a); };
  return loadModules({ wrap: {
    'sim/stores': { close: (fn) => around(fn, (st, hh) => { if (sink) sink.closing(st, hh); }) },
  } });
}

// ---- the food lines ----
const FOOD = new Set(['grain', 'sheaves', 'flour', 'fish', 'gathered', 'dried fish', 'meat', 'salt meat', 'smoked meat', 'milk', 'butter']);
// The grain's own account (island-wide, beside the food's): its goods (sheaves, grain of every crop, flour ground from it) are also booked
// under the key 'g:' + village, with their stocks, so that the harvest's split reads as the balance review's did (docs/balance/findings.md)
const GRAIN = new Set(['grain', 'sheaves', 'flour']);
const LARDER = new Set(['dried fish', 'meat', 'salt meat', 'smoked meat', 'milk', 'butter']); // the larder's foods (FOODS held 'larder')
const G = 'g:';
// Every good's account: its lines and stocks booked under the key X + good (island-wide), as the grain's are under G + village
const X = 'x:';
// A ledger entry or a yearly total in a good's own account: `in.<reason>` or `out.<reason>`, by the movement's sign; null when it moves
// nothing (the milk a crowded pasture cost)
// 'lying' (VB-1910): what lay out and was lost there, never in a store: no movement of one
const goodLine = (d) => (d.kind === 'milkbite' || d.kind === 'lying' ? null : (d.n > 0 ? 'in.' : 'out.') + d.kind);
// A ledger entry or a yearly total of a food: the line it books to, or null when it moves food between two of a holder's stores (threshing,
// grinding, drying) or is no movement (milkbite). holder: 'household' or 'village'; d: the entry (kind, n, crop, to, stake ...).
function lineOf(holder, d) {
  const k = d.kind, n = d.n, g = d.good;
  if (k === 'lying' || k === 'thresh' || k === 'grind' || k === 'drying' || k === 'milkbite' || k === 'salting') return null;
  if (k === 'harvest') return holder === 'village' ? 'produced.grain.commons' : 'produced.grain.' + (d.crop || 'barley');
  if (k === 'catch') return 'produced.fish';
  if (k === 'gathering') return 'produced.gathered';
  if (k === 'meat' || k === 'hunt') return 'produced.meat';
  if (k === 'milk' || k === 'butter') return 'produced.milk';
  if (k === 'seed') return 'out.seed';
  if (k === 'cooking') return 'out.eaten.pot.' + (g === 'dried fish' ? 'driedFish' : g);
  if (k === 'raw') return 'out.eaten.uncooked';
  if (k === 'meal') return LARDER.has(g) ? 'out.eaten.larder' : 'out.eaten.fresh';
  if (k === 'seedMeal') return 'out.eaten.seed';
  if (k === 'feast') return 'out.feast';
  if (k === 'brew') return 'out.brewed';
  if (k === 'spoilage') return holder === 'village' ? 'out.rotted.store' : 'out.rotted.' + (g === 'grain' ? 'grain' : LARDER.has(g) ? 'larder' : 'fresh');
  if (k === 'gift') {
    if (n > 0) return holder === 'village' ? 'in.store' : 'in.gifts';
    if (holder === 'village') return 'out.given.fromStore';
    return d.to === 'the village store' ? 'out.given.toStore' : 'out.given.toHouseholds';
  }
  if (k === 'loan') return n > 0 ? 'in.loans' : 'out.loans'; // VB-312: grain lent, and repaid (sim/loans)
  if (k === 'away') return n > 0 ? 'in.packsHome' : 'out.packed';
  if (k === 'share' || k === 'wage' || k === 'handingOn' || k === 'provisions' || k === 'start') return n > 0 ? 'in.handedOn' : 'out.handedOn';
  return 'other.' + k; // a kind this report does not know yet: it shows, so that it is placed
}
const yearOfT = (YEAR, t) => Math.floor(t / YEAR) + 1;

function report(VB, st, opts = {}) {
  const Sim = VB.sim, Stores = VB['sim/stores'], YEAR = Sim.YEAR, R = st.ECON.uncooked;
  const villageOf = (hh) => st.farmsteads[hh.farmstead].village;
  // year -> Map(village id | 'transit', {line: n}): `flows` what the ledgers hold (read again at each turn), `kept` what no ledger keeps
  // (the larder's takes, a closing household's movements), booked once as it happens
  const flows = new Map(), kept = new Map();
  const bucket = (year, v, into = flows) => {
    let y = into.get(year); if (!y) into.set(year, (y = new Map()));
    let b = y.get(v); if (!b) y.set(v, (b = {}));
    return b;
  };
  const add = (b, line, n) => { b[line] = (b[line] || 0) + n; };
  // a food entry's stock change n books |n| to its line: an inflow (produced, in) adds, an outlet subtracts; a line whose sign is the
  // other way (a seed returned, a gift taken back) books a negative amount
  const book = (b, line, n) => add(b, line, line.startsWith('out.') ? -n : n);
  // A holder's food entries and totals of years `from` and later, into their years' buckets.
  function readHolder(holder, type, v, from, into = flows) {
    for (const e of holder.ledger || []) {
      const y = yearOfT(YEAR, e.t);
      if (y < from) continue;
      const gl = goodLine(e);
      if (gl) book(bucket(y, X + e.good, into), gl, e.n);
      if (!FOOD.has(e.good)) continue;
      const line = lineOf(type, e);
      if (line) book(bucket(y, v, into), line, e.n);
      if (line && GRAIN.has(e.good)) book(bucket(y, G + v, into), line, e.n);
      if (e.kind === 'feast' && e.booked > 0) add(bucket(y, v, into), 'goodwill.feasts', e.booked); // not food: the goodwill a feast booked
      if (line && type === 'household' && into === flows && line.startsWith('produced.') && y === counted + 1) produce.set(holder.id, (produce.get(holder.id) || 0) + e.n);
    }
    for (const x of holder.totals || []) {
      if (x.year < from) continue;
      const gl = goodLine(x);
      if (gl) book(bucket(x.year, X + x.good, into), gl, x.n);
      if (!FOOD.has(x.good)) continue;
      const line = lineOf(type, x);
      if (line) book(bucket(x.year, v, into), line, x.n);
      if (line && GRAIN.has(x.good)) book(bucket(x.year, G + v, into), line, x.n);
      if (line && type === 'household' && into === flows && line.startsWith('produced.') && x.year === counted + 1) produce.set(holder.id, (produce.get(holder.id) || 0) + x.n);
    }
  }
  // Food held now, by village (and 'transit': a stake held by one of no household): rations as held. Gift grain on its way is in no
  // stock, held or at its stops: it left the giver's ledger when set aside and enters the receiver's as it arrives (VB-1775: a held
  // load counted here at a year's turn, with no line, left that year unexplained by the load and the next by its negative).
  function stocks() {
    const s = new Map(), at = (v) => { if (!s.has(v)) s.set(v, 0); return v; };
    const put = (v, n, grain = 0) => { s.set(at(v), s.get(v) + n); s.set(at(G + v), s.get(G + v) + grain); };
    const good = (g, n) => { if (n) s.set(at(X + g), s.get(X + g) + n); };
    for (const id of st.liveHouseholds) {
      const hh = st.households[id];
      if (hh.dissolved) continue;
      put(villageOf(hh), householdFood(hh), householdGrain(hh));
      householdGoods(hh, good);
    }
    for (const v of st.villages) { put(v.id, Stores.grainOf(v), Stores.grainOf(v)); good('grain', Stores.grainOf(v)); }
    for (const p of st.pawns) if (p.alive && p.stake > 0) { put(p.household !== null ? villageOf(st.households[p.household]) : 'transit', p.stake, p.stake); good('grain', p.stake); }
    return s;
  }
  // The stakes the dead hold, by village (of the household each died in): a pawn's stake is not handed on at its death, and no movement
  // takes it (the grain goes with it), so it is an outlet, `died holding`, the year's change in these.
  function deadStakes() {
    const s = new Map(), put = (v, n) => { for (const k of [v, G + v, X + 'grain']) s.set(k, (s.get(k) || 0) + n); };
    for (const p of st.pawns) if (!p.alive && p.stake > 0) put(p.household !== null ? villageOf(st.households[p.household]) : 'transit', p.stake);
    return s;
  }
  function householdGrain(hh) {
    let n = Stores.grainOf(hh) + (hh.flour || 0);
    for (const x of hh.unthreshed || []) n += x;
    return n;
  }
  // What a household holds of each good, as the stores' ledger names it (grain of any crop, a good of kinds whatever its kind): into(good, n).
  function householdGoods(hh, into) {
    into('grain', Stores.grainOf(hh));
    let sheaves = 0;
    for (const x of hh.unthreshed || []) sheaves += x;
    into('sheaves', sheaves);
    for (const [g, k] of HELD) into(g, hh[k] || 0);
    for (const k in hh.stone || {}) into('stone', hh.stone[k]); // the heap by rock (heldOf refuses a closing household)
    if (hh.cloth) into('cloth', hh.cloth.reduce((a, n) => a + n, 0));
    for (const l of hh.ale || []) into('ale', l.n);
    for (const b of hh.fresh || []) into(b.food, b.qty);
    for (const l of hh.larder || []) into(l.kind, l.n);
  }
  function householdFood(hh) {
    let n = Stores.grainOf(hh) + (hh.flour || 0) + (hh.rack || 0);
    for (const b of hh.fresh || []) n += b.qty;
    for (const l of hh.larder || []) n += l.n;
    for (const x of hh.unthreshed || []) n += x;
    return n;
  }
  // the stocks less what the year in progress has already moved: the stocks as they stood at that year's turn (or at the run's start, as
  // if its year's movements so far had not been made), so that a year's change in stores is that year's movements
  let counted = Stores.yearNow(st) - 1; // years whose accounts are closed
  const produce = new Map(); // household id -> food it produced in the year being closed (the ledger's produced lines), for the spread
  const net = (b) => Object.entries(b).reduce((s, [k, n]) => s + (k.startsWith('out.') ? -n : k.startsWith('goodwill.') ? 0 : n), 0);
  function opening() {
    const y = counted + 1, s = stocks();
    for (const id of st.liveHouseholds) if (!st.households[id].dissolved) readHolder(st.households[id], 'household', villageOf(st.households[id]), y);
    for (const v of st.villages) readHolder(v, 'village', v.id, y);
    for (const m of [flows, kept]) for (const [v, b] of m.get(y) || []) s.set(v, (s.get(v) || 0) - net(b));
    flows.delete(y); // read again, whole, at the year's turn; what is kept stays, and is this year's
    return s;
  }
  sink = {
    closing(st2, hh) { // a household that ends: its year's movements so far, and what it held, which stays with its farm
      const v = villageOf(hh);
      readHolder(hh, 'household', v, counted + 1, kept);
      add(bucket(Stores.yearNow(st2), v, kept), 'out.ended', householdFood(hh));
      add(bucket(Stores.yearNow(st2), G + v, kept), 'out.ended', householdGrain(hh));
      householdGoods(hh, (g, n) => { if (n) add(bucket(Stores.yearNow(st2), X + g, kept), 'out.ended', n); });
    },
  };
  let open = opening(), dead0 = deadStakes();
  const years = [];
  // the year's people, spread, goodwill and labour (below), read as the year starts, at the moving round's day and at its turn
  const P = people(VB, st), labour = {};
  const [W0, W1] = Sim.WORK;
  // Advances to hour t, an hour at a time, counting each work hour as the idle report does (tools/idle.js countHour).
  function stepTo(t) {
    while (st.t < t - 1e-9) {
      Sim.advance(st, Math.min(1, t - st.t));
      const h = Sim.cal(st.t).hour;
      if (h >= W0 && h < W1) countHour(Sim, st, labour);
    }
  }
  // Advances to the next calendar year's turn and closes that year's account.
  function advanceYear() {
    const y = counted + 1, census = (y - 1) * YEAR + Waiting.censusHour(VB['sim/rules']);
    P.start();
    for (const k of Object.keys(labour)) delete labour[k];
    let c = null;
    if (census > st.t && census < y * YEAR) { stepTo(census); c = Waiting.census(VB, st); }
    stepTo(y * YEAR);
    for (const id of st.liveHouseholds) if (!st.households[id].dissolved) readHolder(st.households[id], 'household', villageOf(st.households[id]), y);
    for (const v of st.villages) readHolder(v, 'village', v.id, y);
    const end = stocks(); // less the next year's first hours, already moved (read from the ledgers just now, or kept)
    for (const m of [flows, kept]) for (const [v, b] of m.get(y + 1) || []) end.set(v, (end.get(v) || 0) - net(b));
    flows.delete(y + 1); // read again at its turn
    counted = y;
    const lines = new Map();
    for (const m of [flows, kept]) for (const [v, b] of m.get(y) || []) lines.set(v, sumLines([lines.get(v) || {}, b]));
    const dead1 = deadStakes();
    for (const v of new Set([...dead0.keys(), ...dead1.keys()])) {
      const n = (dead1.get(v) || 0) - (dead0.get(v) || 0);
      if (n) lines.set(v, sumLines([lines.get(v) || {}, { 'out.diedHolding': n }]));
    }
    dead0 = dead1;
    const year = close(y, lines, open, end);
    year.people = P.end(c);
    year.spread = spread(VB, st, P.hungry0, produce);
    year.goodwill = goodwill(VB, st, P.record0);
    year.labour = hoursShare(labour);
    year.spread.foodOverNeed = r3(year.food.all.produced / Math.max(1e-9, year.spread.need));
    year.goodwill.fromFeasts = r3(year.food.all.feastGoodwill);
    year.properties = properties(VB, st, year);
    years.push(year);
    produce.clear();
    flows.delete(y);
    kept.delete(y);
    open = end;
  }
  function close(y, b, s0, s1) {
    const isG = (k) => typeof k === 'string' && k.startsWith(G), isX = (k) => typeof k === 'string' && k.startsWith(X), food = (k) => !isG(k) && !isX(k);
    const ids = [...new Set([...b.keys(), ...s0.keys(), ...s1.keys()])].filter(food).sort((a, c) => (a === 'transit') - (c === 'transit') || a - c);
    const rows = ids.map((v) => account(v === 'transit' ? 'on the way' : st.villages[v].name, b.get(v) || {}, s0.get(v) || 0, s1.get(v) || 0));
    const pick = (m, f) => new Map([...m].filter(([k]) => f(k)));
    const all = account('all', sumLines([...pick(b, food).values()]), sum(pick(s0, food)), sum(pick(s1, food)));
    const grain = account('grain', sumLines([...pick(b, isG).values()]), sum(pick(s0, isG)), sum(pick(s1, isG)));
    const goods = {};
    for (const k of [...new Set([...b.keys(), ...s0.keys(), ...s1.keys()])].filter(isX).sort()) {
      const g = k.slice(X.length), a = account(g, b.get(k) || {}, s0.get(k) || 0, s1.get(k) || 0);
      goods[g] = a;
      const r = (run[g] ||= { name: g, lines: {}, opening: a.opening, years: 0 });
      r.lines = sumLines([r.lines, flatLines(a.lines)]);
      r.closing = a.closing; r.years++;
    }
    return { year: y, food: { all, villages: rows }, grain, goods };
  }
  // the run's account of each good: its years' lines added up, from the first year's opening to the last's closing (VB-1684: the stores
  // keep three years, this report every year it read)
  const run = {};
  const runGoods = () => Object.fromEntries(Object.entries(run).map(([g, r]) => [g, { ...account(g, r.lines, r.opening, r.closing), years: r.years }]));
  return { advanceYear, result: () => ({ years, goods: runGoods() }), R };
}
const sum = (m) => [...m.values()].reduce((s, n) => s + n, 0);
const r3 = (x) => (Number.isFinite(x) ? +x.toFixed(3) : null);
const quantile = (xs, q) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
function gini(xs) {
  const s = [...xs].sort((a, b) => a - b), n = s.length, tot = s.reduce((a, b) => a + b, 0);
  if (!n || !(tot > 0)) return null;
  let w = 0;
  s.forEach((x, i) => { w += (i + 1) * x; });
  return (2 * w) / (n * tot) - (n + 1) / n;
}

// ---- people: the year's births, deaths, marriages, moves and households, and the rates from them ----
// Marriages put off, by reason: the waiting census at the moving round's day (tools/waiting.js: those unmarried, of age to marry and
// under 45, each under the best outcome over the other sex): hungry, no partner (nobody of the other sex free), the kin limit, no home
// under the residence custom, the score (ages, villages), the home lacks the means, and free to marry.
function people(VB, st) {
  const Sim = VB.sim, YEAR = Sim.YEAR, Rec = VB['sim/records'];
  let t0, living0, villageAt, pawns0, households0, dissolved0;
  const o = {
    start() {
      t0 = st.t; living0 = [...st.living]; pawns0 = st.pawns.length; households0 = st.households.length;
      dissolved0 = st.households.filter((h) => h.dissolved).length;
      villageAt = new Map(living0.map((id) => [id, Rec.settlementIdOf(st, st.pawns[id])]));
      o.record0 = st.record.length;
      o.hungry0 = new Map(st.liveHouseholds.map((id) => [id, st.households[id].hungryDays]));
    },
    end(census) {
      const t1 = st.t, inYear = (t) => t !== null && t !== undefined && t >= t0 && t < t1;
      const cause = new Map();
      for (let i = o.record0; i < st.record.length; i++) { const e = st.record[i]; if (e && e.kind === 'died') cause.set(e.pawn, e.cause || e.text || 'unknown'); }
      // the year's newcomers: those born in it, and those who came from outside the island (a pawn made as a founder: settlers, a
      // scenario's arrivals); every pawn alive in the year is of the living at its start or a newcomer
      const born = [], arrived = [], died = [];
      for (let id = pawns0; id < st.pawns.length; id++) (st.pawns[id].founder ? arrived : born).push(st.pawns[id]);
      for (const p of [...living0.map((id) => st.pawns[id]), ...born, ...arrived]) if (inYear(p.died)) died.push(p);
      const deaths = {};
      for (const p of died) { const c = cause.get(p.id) || 'unknown'; deaths[c] = (deaths[c] || 0) + 1; }
      let moves = 0;
      for (const [id, v] of villageAt) { const p = st.pawns[id]; if (p.alive && Rec.settlementIdOf(st, p) !== v) moves++; }
      const facts = Waiting.yearFacts(VB, st, t0 - 1e-9, t1 - 1e-9, o.record0);
      // the year's exposure (person-years) and deaths by age, over those alive in it: the period's rates
      const exposed = [...living0.map((id) => st.pawns[id]), ...born, ...arrived];
      const ageAt = (p, t) => (t - p.born) / YEAR;
      const years = (p, a0, a1) => Math.max(0, Math.min(t1, p.born + a1 * YEAR, p.died === null ? Infinity : p.died) - Math.max(t0, p.born + a0 * YEAR)) / YEAR;
      const rate = (a0, a1) => {
        let ex = 0, d = 0;
        for (const p of exposed) { ex += years(p, a0, a1); if (inYear(p.died) && ageAt(p, p.died) >= a0 && ageAt(p, p.died) < a1) d++; }
        return ex > 0 ? d / ex : null;
      };
      const m0 = rate(0, 1), m1 = rate(1, 5), m5 = rate(5, 15);
      // births a woman: the period's total fertility, five-year groups from 15 to 49
      let tfr = 0;
      for (let a = 15; a < 50; a += 5) {
        let wy = 0, b = 0;
        for (const p of exposed) if (p.sex === 'f') wy += years(p, a, a + 5);
        for (const c of born) { const m = c.mother !== null && c.mother !== undefined ? st.pawns[c.mother] : null; if (m && ageAt(m, c.born) >= a && ageAt(m, c.born) < a + 5) b++; }
        if (wy > 0) tfr += (5 * b) / wy;
      }
      const first = new Set();
      for (const u of st.unions) { first.add(u.a); first.add(u.b); }
      const old = st.living.map((id) => st.pawns[id]).filter((p) => ageAt(p, t1) >= 45);
      const wait = census ? Object.fromEntries(Waiting.CAUSES.map((k) => [k, census.counts[k]])) : null;
      return {
        living: [living0.length, st.living.length], births: born.length, arrived: arrived.length, deaths, died: died.length, marriages: facts.marriages,
        putOff: wait, putOffForMeans: facts.putOff, moves, householdsFounded: st.households.length - households0,
        householdsDissolved: st.households.filter((h) => h.dissolved).length - dissolved0,
        growth: r3(living0.length ? st.living.length / living0.length - 1 : null), birthsAWoman: r3(tfr),
        diedBefore1: r3(m0 === null ? null : 1 - Math.exp(-m0)),
        diedBefore15: r3(m0 === null || m1 === null || m5 === null ? null : 1 - Math.exp(-(m0 + 4 * m1 + 10 * m5))),
        firstMarriageAge: { f: r3(facts.ages.f[0] ? facts.ages.f[1] / facts.ages.f[0] : null), m: r3(facts.ages.m[0] ? facts.ages.m[1] / facts.ages.m[0] : null) },
        neverMarried45: r3(old.length ? old.filter((p) => !first.has(p.id)).length / old.length : null),
      };
    },
  };
  return o;
}

// ---- the spread between households, at the year's turn ----
// produced over need: the food a household produced in the year (its produced lines) over its members' need for a year (sim/hunger
// dailyNeed, now); days held: its food (grain, sheaves, flour, the rack, fresh food, the larder, meals) over its day's need.
function spread(VB, st, hungry0, produce) {
  const Stores = VB['sim/stores'], { dailyNeed } = VB['sim/hunger'], YEAR_DAYS = VB.sim.YEAR_DAYS;
  const live = st.liveHouseholds.map((id) => st.households[id]).filter((h) => !h.dissolved);
  const ratio = [], days = [];
  for (const h of live) {
    const need = dailyNeed(st, h);
    if (!(need > 0)) continue;
    ratio.push((produce.get(h.id) || 0) / (need * YEAR_DAYS));
    let held = Stores.grainOf(h) + (h.flour || 0) + (h.rack || 0) + (h.meals || 0);
    for (const b of h.fresh || []) held += b.qty;
    for (const l of h.larder || []) held += l.n;
    for (const x of h.unthreshed || []) held += x;
    days.push(held / need);
  }
  const q = (xs) => ({ p10: r3(quantile(xs, 0.1)), p50: r3(quantile(xs, 0.5)), p90: r3(quantile(xs, 0.9)) });
  return {
    households: live.length, need: live.reduce((s, h) => s + dailyNeed(st, h) * YEAR_DAYS, 0),
    producedOverNeed: { ...q(ratio), under1: r3(ratio.filter((r) => r < 1).length / Math.max(1, ratio.length)),
      under167: r3(ratio.filter((r) => r < 1.67).length / Math.max(1, ratio.length)) },
    daysHeld: q(days),
    giniFields: r3(gini(live.map((h) => st.farmsteads[h.farmstead].fields.length))),
    giniGrain: r3(gini(live.map((h) => Stores.grainOf(h)))),
    single: r3(live.filter((h) => h.members.length === 1).length / Math.max(1, live.length)),
    hungry30: live.filter((h) => h.hungryDays - (hungry0.get(h.id) || 0) > 30).length,
  };
}

// ---- goodwill (sim/relations): gifts in the year (the record's), and the balances standing at its turn ----
// outstanding: what is owed to a household's members, summed, a live household (the mean); pairs: the pairs of living pawns with a
// balance (sim/relations balance: not yet forgotten); top3: the share of all that is owed held by the three households owed most.
function goodwill(VB, st, record0) {
  const Rel = VB['sim/relations'];
  let gifts = 0;
  for (let i = record0; i < st.record.length; i++) if (st.record[i] && st.record[i].kind === 'gift') gifts++;
  const owed = new Map();
  let pairs = 0;
  for (const id of st.living) {
    const p = st.pawns[id];
    if (!p.goodwill) continue;
    for (const j of p.goodwill.keys()) {
      const v = Rel.balance(st, id, j);
      if (!v || !st.pawns[j].alive) continue;
      if (id < j) pairs++;
      if (v > 0 && p.household !== null) owed.set(p.household, (owed.get(p.household) || 0) + v);
    }
  }
  const all = sum(owed), top = [...owed.values()].sort((a, b) => b - a).slice(0, 3).reduce((s, n) => s + n, 0);
  return { gifts, outstanding: r3(all / Math.max(1, st.liveHouseholds.length)), pairs, top3: r3(all > 0 ? top / all : null) };
}

// ---- the balance map's properties (docs/balance/cards.md, The balance properties): this year's value of each, or 'no mechanism yet' ----
const NONE = 'no mechanism yet';
function properties(VB, st, y) {
  const F = y.food.all, pc = (n) => r3(F.produced > 0 ? n / F.produced : null), t = (o) => (typeof o === 'number' ? o : Object.values(o || {}).reduce((s, x) => s + t(x), 0));
  const L = F.lines, out = L.out || {}, eaten = t(out.eaten), rotted = t(out.rotted);
  // customs: the villages' practice (sim/records practice), the customs on which two villages differ
  const Rec = VB['sim/records'], keys = new Map();
  for (const v of st.villages) for (const [k, x] of Object.entries(Rec.practice(st, v.id) || {})) { if (!keys.has(k)) keys.set(k, new Set()); keys.get(k).add(x); }
  const differ = [...keys.values()].filter((xs) => xs.size > 1).length;
  const P = y.people, S = y.spread, G = y.goodwill, H = y.labour;
  return [
    { property: 'population', value: `${P.living[1]} living, growth ${(100 * P.growth).toFixed(1)}% a year` },
    { property: 'the split of people: farming', value: `${P.living[1]} (all)` },
    { property: 'the split of people: town and craft', value: NONE },
    { property: 'the split of people: elite', value: NONE },
    { property: 'land concentration', value: `Gini of fields ${S.giniFields}; tenancy: ${NONE}` },
    { property: 'food produced over need', value: `${S.foodOverNeed} in all (all food, the commons too); a household's: p10 ${S.producedOverNeed.p10}, p50 ${S.producedOverNeed.p50}, p90 ${S.producedOverNeed.p90}` },
    { property: 'share extracted', value: NONE },
    { property: 'the split of the surplus', value: `of the produce: eaten ${pc(eaten)}, feasted ${pc(out.feast || 0)}, brewed ${pc(out.brewed || 0)}, rots ${pc(rotted)}, seed ${pc(out.seed || 0)}; taken: ${NONE}; sold: ${NONE}` },
    { property: 'food kept a head', value: `${S.hungry30} of ${S.households} households hungry over 30 days; ${(100 * S.producedOverNeed.under1).toFixed(0)}% produce under their need; days held p50 ${S.daysHeld.p50}` },
    { property: 'goodwill in circulation', value: `${G.outstanding} rations outstanding a household; ${G.pairs} pairs; the three owed most hold ${G.top3}` },
    { property: 'goodwill from feasts', value: `${G.fromFeasts} rations booked at feasts this year` },
    { property: 'idle hours', value: Object.entries(H).map(([k, v]) => `${k} ${(100 * v.idle).toFixed(0)}%`).join(', ') },
    { property: 'spread of customs', value: `${st.cenv ? st.cenv.cultures.length : 0} culture(s); villages differ on ${differ} of ${keys.size} customs` },
    { property: 'disease', value: `${NONE} (illness stands in: ${P.deaths.illness || 0} died of it)` },
  ];
}

// ---- labour: the share of the work hours of those who work (7 and older, not children), by season, as the idle report counts them ----
function hoursShare(share) {
  const out = {};
  for (const bySeason of Object.values(share)) for (const [season, s] of Object.entries(bySeason)) {
    const o = (out[season] ||= { working: 0, walking: 0, carrying: 0, idle: 0 });
    for (const k of Object.keys(o)) o[k] += s[k];
  }
  for (const o of Object.values(out)) {
    const tot = o.working + o.walking + o.carrying + o.idle;
    for (const k of Object.keys(o)) o[k] = r3(tot ? o[k] / tot : null);
  }
  return out;
}
// The stores' fields of a household that hold a good as one number, by the good the ledger names (sim/stores field)
const HELD = [['flour', 'flour'], ['meals', 'meals'], ['wood', 'wood'], ['timber', 'timber'], ['peat', 'peat'], ['tar', 'tar'], ['hide', 'hides'],
  ['salt', 'salt'], ['iron', 'iron'], ['clay', 'clay'], ['bogOre', 'bogOre'], ['wool', 'wool'], ['yarn', 'yarn'], ['fish', 'rack'], ['shoes', 'shoes']];
// an account's nested lines back to their flat keys ({in: {felling: 3}} -> {'in.felling': 3})
const flatLines = (tree) => Object.fromEntries(flat(tree));
function sumLines(list) { const o = {}; for (const b of list) for (const [k, n] of Object.entries(b)) o[k] = (o[k] || 0) + n; return o; }
// An account from its lines and its opening and closing stocks: the lines nested ({produced: {grain: {barley}}, ...}), the totals, and
// what is left unexplained.
function account(name, lines, s0, s1) {
  const tree = {};
  for (const [k, n] of Object.entries(lines)) {
    const path = k.split('.'); let o = tree;
    for (const p of path.slice(0, -1)) o = o[p] = o[p] || {};
    o[path[path.length - 1]] = (o[path[path.length - 1]] || 0) + n;
  }
  const total = (o) => (typeof o === 'number' ? o : Object.values(o || {}).reduce((s, x) => s + total(x), 0));
  const feastGoodwill = tree.goodwill ? tree.goodwill.feasts : 0;
  delete tree.goodwill;
  const produced = total(tree.produced), received = total(tree.in), out = total(tree.out), other = total(tree.other), change = s1 - s0;
  const unexplained = produced + received + other - out - change;
  return { name, lines: tree, produced, received, outlets: out, other, opening: s0, closing: s1, change, unexplained,
    unexplainedShare: produced > 0 ? unexplained / produced : 0, feastGoodwill };
}

// ---- printing ----
const LABELS = {
  'grain.barley': 'grain: barley', 'grain.rye': 'grain: rye', 'grain.peas': 'grain: peas', 'grain.commons': 'grain: common fields',
  fish: 'fish', gathered: 'gathered food', meat: 'meat', milk: 'milk and butter',
  seed: 'seed sown', 'eaten.pot.grain': 'eaten: grain into the pot', 'eaten.pot.flour': 'eaten: flour into the pot',
  'eaten.pot.fish': 'eaten: fish into the pot', 'eaten.pot.gathered': 'eaten: gathered food into the pot', 'eaten.pot.driedFish': 'eaten: dried fish into the pot', 'eaten.uncooked': 'eaten: grain and flour uncooked', 'eaten.fresh': 'eaten: fresh, as it is',
  'eaten.larder': 'eaten: from the larder', 'eaten.seed': 'eaten: the seed', feast: 'feasts', brewed: 'brewed',
  'given.toHouseholds': 'given to households', 'given.toStore': 'given to the village store', 'given.fromStore': 'given out of the village store',
  packed: 'packed for journeys', handedOn: 'provisions, shares, handings on', 'rotted.grain': 'rotted: grain in households',
  'rotted.fresh': 'rotted: fresh food', 'rotted.larder': 'rotted: the larder', 'rotted.store': 'rotted: the village store',
  ended: 'left with households that ended', diedHolding: 'stakes of pawns who died holding them (not handed on)', gifts: 'gifts into households', store: 'gifts into the village store', packsHome: 'packs brought home',
};
function flat(o, pre = '') {
  const out = [];
  for (const [k, v] of Object.entries(o || {})) {
    if (typeof v === 'number') out.push([pre + k, v]); else out.push(...flat(v, pre + k + '.'));
  }
  return out;
}
function foodTable(a) {
  const pc = (n) => (a.produced > 0 ? (100 * n / a.produced).toFixed(1) : '-');
  const rows = [];
  const section = (title, o) => { for (const [k, n] of flat(o)) rows.push({ line: `${title}: ${LABELS[k] || k}`, rations: Math.round(n), pctOfProduce: pc(n) }); };
  section('produced', treeOf(a, 'produced'));
  section('received', treeOf(a, 'in'));
  section('outlet', treeOf(a, 'out'));
  section('unplaced', treeOf(a, 'other'));
  rows.push({ line: 'change in stores', rations: Math.round(a.change), pctOfProduce: pc(a.change) });
  rows.push({ line: 'unexplained', rations: Math.round(a.unexplained), pctOfProduce: pc(a.unexplained) });
  return rows;
}
// the nested lines of an account (its number-valued keys are the totals: produced, received, outlets ...)
const treeOf = (a, key) => a.lines[key] || {};
function print(out) {
  console.log('\nfood (rations as held), people and households, a year:');
  console.table(out.years.map((y) => ({ year: y.year, produced: Math.round(y.food.all.produced), unexplained: Math.round(y.food.all.unexplained),
    pct: (100 * y.food.all.unexplainedShare).toFixed(1), living: y.people.living[1], births: y.people.births, died: y.people.died,
    marriages: y.people.marriages, moves: y.people.moves, founded: y.people.householdsFounded, dissolved: y.people.householdsDissolved,
    overNeed: y.spread.foodOverNeed, hungry30: y.spread.hungry30 })));
  const last = out.years[out.years.length - 1];
  if (!last) return;
  const P = last.people, S = last.spread, G = last.goodwill;
  console.log(`\nyear ${last.year}, people: living ${P.living[0]} -> ${P.living[1]} (growth ${(100 * P.growth).toFixed(1)}%); births ${P.births}, arrived ${P.arrived}, `
    + `deaths ${P.died} (${Object.entries(P.deaths).map(([k, n]) => `${k} ${n}`).join(', ') || '-'}); marriages ${P.marriages}; moves between villages ${P.moves}; `
    + `households founded ${P.householdsFounded}, dissolved ${P.householdsDissolved}`);
  console.log(`  births a woman ${P.birthsAWoman}; dying before 1 ${P.diedBefore1}, before 15 ${P.diedBefore15}; first marriage at ${P.firstMarriageAge.f} (women), `
    + `${P.firstMarriageAge.m} (men); never married at 45 and over ${P.neverMarried45}`);
  if (P.putOff) console.log(`  at the moving round, unmarried of age, by what holds them back: ${Object.entries(P.putOff).map(([k, n]) => `${k} ${n}`).join(', ')}; `
    + `matches put off for the means ${P.putOffForMeans}`);
  console.log(`spread: produced over need p10 ${S.producedOverNeed.p10}, p50 ${S.producedOverNeed.p50}, p90 ${S.producedOverNeed.p90}, under 1.0 ${S.producedOverNeed.under1}, `
    + `under 1.67 ${S.producedOverNeed.under167}; days held p10 ${S.daysHeld.p10}, p50 ${S.daysHeld.p50}, p90 ${S.daysHeld.p90}; Gini of fields ${S.giniFields}, of grain ${S.giniGrain}; `
    + `single-person ${S.single}; hungry over 30 days ${S.hungry30}`);
  console.log(`goodwill: gifts ${G.gifts}; outstanding a household ${G.outstanding}; live pairs ${G.pairs}; the three owed most ${G.top3}; booked at feasts ${G.fromFeasts}`);
  console.log('labour, share of work hours:'); console.table(last.labour);
  console.log(`\nyear ${last.year}, all villages:`);
  console.table(foodTable(last.food.all));
  console.log(`year ${last.year}, the grain (sheaves, grain and flour, households and the village stores):`);
  console.table(foodTable(last.grain));
  console.log('by village: produced, received, outlets, change in stores, unexplained');
  console.table(last.food.villages.map((a) => ({ village: a.name, produced: Math.round(a.produced), received: Math.round(a.received), outlets: Math.round(a.outlets),
    change: Math.round(a.change), unexplained: Math.round(a.unexplained), pct: (100 * a.unexplainedShare).toFixed(1) })));
  console.log('the balance properties (docs/balance/cards.md):'); console.table(last.properties);
  const goodRow = (a) => ({ good: a.name, opening: +a.opening.toFixed(1), in: +a.received.toFixed(1), out: +a.outlets.toFixed(1), change: +a.change.toFixed(1), unexplained: +a.unexplained.toFixed(3) });
  console.log(`year ${last.year}, every good (island-wide; in and out by reason in --json):`);
  console.table(Object.values(last.goods).map(goodRow));
  console.log(`the run, ${out.years.length} year(s), every good:`);
  console.table(Object.values(out.goods).map(goodRow));
}
module.exports = { load, report, print, lineOf };
