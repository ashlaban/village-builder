// The balance accounts (VB-403): a game year's food, people, spread, goodwill and labour, village by village and in all, read from the run.
// node tools/sim.js --scenario populous --seed 7 --map small --years 30 --report accounts [--json]   (or --load FILE)
// It reads only: no state is added, nothing is saved, nothing the simulation reads changes (`node tools/same.js` prints same). Its
// bookkeeping is kept here, outside `st` (docs/cost.md, rule 10). The run is cut at the calendar years' turns (sim/rules YEAR): the
// accounts' last year ends at its turn, some hours before the other reports' last line.
// Food, in rations as held (a ration of grain, of flour, of fish ...; meals are left out: food is counted eaten as it goes into the pot):
//   produced    grain by crop (sheaves brought to the barn; the village's common fields' harvest), fish, gathered food, meat (the slaughter
//               and the hunt), milk (and butter)
//   received    gifts into households and into the village store, packs brought home, provisions, shares and farms handed on
//   outlets     seed sown; eaten as meals (into the pot), uncooked (grain and flour), fresh (gathered food as it is), from the larder, seed
//               eaten; feasts; brewed; given (to households, to the village store, out of the store), packed for journeys, provisions,
//               shares and handings on; rotted in households (grain, fresh food, the larder) and in the village store; left with a
//               household that ended (its stores go with its farm)
//   stores      the change over the year in grain, sheaves in the barn, flour, fish by the rack, fresh food, the larder, the village
//               stores, pawns' stakes and gift grain on its way
//   unexplained produced + received - outlets - the change in stores, with its share of the produce: 0 when every movement is counted.
// Read from the stores' ledgers and yearly totals (src/sim/stores.js) at each year's turn, and from a closing household's ledger as it
// closes; the larder's takes (eaten, spoilt), which write no ledger entry, are counted by wrapping sim/larder's exports at load, as
// tools/perf.js wraps its systems (tests/lib/load.js): `load()` replaces require('../src/load.js').
// Used by tools/sim.js (`const a = require('./accounts.js')`, `VB = a.load()`, `const r = a.report(VB, st)`, `r.advanceYear()`,
// `r.result()`, `a.print(out)`) and tests/accounts.js.
require('./help.js')(__filename);
const { loadModules } = require('../tests/lib/load.js');

// ---- the wrappers: the larder's unrecorded takes, and a household's ledger as it closes ----
let sink = null; // the report listening (one a process)
let cooking = 0; // inside Stores.cookLarder: its larder take is cooked (the ledger's 'cooking'), not eaten
function load() {
  const around = (fn, before, after) => function (...a) { if (before) before(...a); const r = fn.apply(this, a); if (after) after(r, ...a); return r; };
  return loadModules({ wrap: {
    'sim/larder': {
      takeFood: (fn) => around(fn, null, (got, st, hh) => { if (sink && !cooking && got > 0) sink.larder(st, hh, 'eaten', got); }),
      spoilFood: (fn) => around(fn, null, (lots, st, hh) => { if (sink) for (const l of lots) sink.larder(st, hh, 'rotted', l.n); }),
    },
    'sim/stores': {
      cookLarder: (fn) => function (...a) { cooking++; try { return fn.apply(this, a); } finally { cooking--; } },
      close: (fn) => around(fn, (st, hh) => { if (sink) sink.closing(st, hh); }),
    },
  } });
}

// ---- the food lines ----
const FOOD = new Set(['grain', 'sheaves', 'flour', 'fish', 'gathered', 'dried fish', 'meat', 'salt meat', 'milk', 'butter']);
// A ledger entry or a yearly total of a food: the line it books to, or null when it moves food between two of a holder's stores (threshing,
// grinding, drying) or is no movement (milkbite). holder: 'household' or 'village'; d: the entry (kind, n, crop, to, stake ...).
function lineOf(holder, d) {
  const k = d.kind, n = d.n, g = d.good;
  if (k === 'thresh' || k === 'grind' || k === 'drying' || k === 'milkbite') return null;
  if (k === 'harvest') return holder === 'village' ? 'produced.grain.commons' : 'produced.grain.' + (d.crop || 'barley');
  if (k === 'catch') return 'produced.fish';
  if (k === 'gathering') return 'produced.gathered';
  if (k === 'meat' || k === 'hunt') return 'produced.meat';
  if (k === 'milk' || k === 'butter') return 'produced.milk';
  if (k === 'seed') return 'out.seed';
  if (k === 'cooking') return 'out.eaten.meals';
  if (k === 'raw') return 'out.eaten.uncooked';
  if (k === 'meal') return 'out.eaten.fresh';
  if (k === 'seedMeal') return 'out.eaten.seed';
  if (k === 'feast') return 'out.feast';
  if (k === 'brew') return 'out.brewed';
  if (k === 'spoilage') return holder === 'village' ? 'out.rotted.store' : 'out.rotted.' + (g === 'grain' ? 'grain' : 'fresh');
  if (k === 'gift') {
    if (n > 0) return holder === 'village' ? 'in.store' : 'in.gifts';
    if (holder === 'village') return 'out.given.fromStore';
    return d.to === 'the village store' ? 'out.given.toStore' : 'out.given.toHouseholds';
  }
  if (k === 'away') return n > 0 ? 'in.packsHome' : 'out.packed';
  if (k === 'share' || k === 'handingOn' || k === 'provisions' || k === 'start') return n > 0 ? 'in.handedOn' : 'out.handedOn';
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
      if (!FOOD.has(e.good)) continue;
      const y = yearOfT(YEAR, e.t);
      if (y < from) continue;
      const line = lineOf(type, e);
      if (line) book(bucket(y, v, into), line, e.n);
    }
    for (const x of holder.totals || []) {
      if (x.year < from || !FOOD.has(x.good)) continue;
      const line = lineOf(type, x);
      if (line) book(bucket(x.year, v, into), line, x.n);
    }
  }
  // Food held now, by village (and 'transit': gift grain on its way): rations as held.
  function stocks() {
    const s = new Map(), at = (v) => { if (!s.has(v)) s.set(v, 0); return v; };
    const put = (v, n) => s.set(at(v), s.get(v) + n);
    for (const id of st.liveHouseholds) {
      const hh = st.households[id];
      if (hh.dissolved) continue;
      put(villageOf(hh), householdFood(hh));
    }
    for (const v of st.villages) put(v.id, Stores.grainOf(v));
    for (const p of st.pawns) if (p.alive && p.stake > 0) put(p.household !== null ? villageOf(st.households[p.household]) : 'transit', p.stake);
    for (const j of st.away || []) if (j.gift && j.gift.held > 0) put('transit', j.gift.held);
    return s;
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
  const net = (b) => Object.entries(b).reduce((s, [k, n]) => s + (k.startsWith('out.') ? -n : n), 0);
  function opening() {
    const y = counted + 1, s = stocks();
    for (const id of st.liveHouseholds) if (!st.households[id].dissolved) readHolder(st.households[id], 'household', villageOf(st.households[id]), y);
    for (const v of st.villages) readHolder(v, 'village', v.id, y);
    for (const m of [flows, kept]) for (const [v, b] of m.get(y) || []) s.set(v, (s.get(v) || 0) - net(b));
    flows.delete(y); // read again, whole, at the year's turn; what is kept stays, and is this year's
    return s;
  }
  sink = {
    larder(st2, hh, what, n) { book(bucket(Stores.yearNow(st2), villageOf(hh), kept), what === 'eaten' ? 'out.eaten.larder' : 'out.rotted.larder', -n); },
    closing(st2, hh) { // a household that ends: its year's movements so far, and what it held, which stays with its farm
      const v = villageOf(hh);
      readHolder(hh, 'household', v, counted + 1, kept);
      add(bucket(Stores.yearNow(st2), v, kept), 'out.ended', householdFood(hh));
    },
  };
  let open = opening();
  const years = [];
  // Advances to the next calendar year's turn and closes that year's account.
  function advanceYear() {
    const y = counted + 1;
    Sim.advance(st, y * YEAR - st.t);
    for (const id of st.liveHouseholds) if (!st.households[id].dissolved) readHolder(st.households[id], 'household', villageOf(st.households[id]), y);
    for (const v of st.villages) readHolder(v, 'village', v.id, y);
    const end = stocks(); // less the next year's first hours, already moved (read from the ledgers just now, or kept)
    for (const m of [flows, kept]) for (const [v, b] of m.get(y + 1) || []) end.set(v, (end.get(v) || 0) - net(b));
    flows.delete(y + 1); // read again at its turn
    counted = y;
    const lines = new Map();
    for (const m of [flows, kept]) for (const [v, b] of m.get(y) || []) lines.set(v, sumLines([lines.get(v) || {}, b]));
    years.push(close(y, lines, open, end));
    flows.delete(y);
    kept.delete(y);
    open = end;
  }
  function close(y, b, s0, s1) {
    const ids = [...new Set([...b.keys(), ...s0.keys(), ...s1.keys()])].sort((a, c) => (a === 'transit') - (c === 'transit') || a - c);
    const rows = ids.map((v) => account(v === 'transit' ? 'on the way' : st.villages[v].name, b.get(v) || {}, s0.get(v) || 0, s1.get(v) || 0));
    const all = account('all', sumLines([...b.values()]), sum(s0), sum(s1));
    return { year: y, food: { all, villages: rows } };
  }
  return { advanceYear, result: () => ({ years }), R };
}
const sum = (m) => [...m.values()].reduce((s, n) => s + n, 0);
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
  const produced = total(tree.produced), received = total(tree.in), out = total(tree.out), other = total(tree.other), change = s1 - s0;
  const unexplained = produced + received + other - out - change;
  return { name, lines: tree, produced, received, outlets: out, other, opening: s0, closing: s1, change, unexplained,
    unexplainedShare: produced > 0 ? unexplained / produced : 0 };
}

// ---- printing ----
const LABELS = {
  'grain.barley': 'grain: barley', 'grain.rye': 'grain: rye', 'grain.peas': 'grain: peas', 'grain.commons': 'grain: common fields',
  fish: 'fish', gathered: 'gathered food', meat: 'meat', milk: 'milk and butter',
  seed: 'seed sown', 'eaten.meals': 'eaten: into the pot', 'eaten.uncooked': 'eaten: grain and flour uncooked', 'eaten.fresh': 'eaten: fresh, as it is',
  'eaten.larder': 'eaten: from the larder', 'eaten.seed': 'eaten: the seed', feast: 'feasts', brewed: 'brewed',
  'given.toHouseholds': 'given to households', 'given.toStore': 'given to the village store', 'given.fromStore': 'given out of the village store',
  packed: 'packed for journeys', handedOn: 'provisions, shares, handings on', 'rotted.grain': 'rotted: grain in households',
  'rotted.fresh': 'rotted: fresh food', 'rotted.larder': 'rotted: the larder', 'rotted.store': 'rotted: the village store',
  ended: 'left with households that ended', gifts: 'gifts into households', store: 'gifts into the village store', packsHome: 'packs brought home',
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
  for (const y of out.years) {
    console.log(`year ${y.year}: food, rations as held; produced ${Math.round(y.food.all.produced)}, unexplained ${Math.round(y.food.all.unexplained)} (${(100 * y.food.all.unexplainedShare).toFixed(1)}%)`);
  }
  const last = out.years[out.years.length - 1];
  if (!last) return;
  console.log(`\nyear ${last.year}, all villages:`);
  console.table(foodTable(last.food.all));
  console.log('by village: produced, received, outlets, change in stores, unexplained');
  console.table(last.food.villages.map((a) => ({ village: a.name, produced: Math.round(a.produced), received: Math.round(a.received), outlets: Math.round(a.outlets),
    change: Math.round(a.change), unexplained: Math.round(a.unexplained), pct: (100 * a.unexplainedShare).toFixed(1) })));
}
module.exports = { load, report, print, lineOf };
