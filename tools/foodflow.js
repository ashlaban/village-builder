// Where the food goes: one village's food account over one game year, as flows from sources through stores to outlets (a Sankey's links).
// node tools/foodflow.js --scenario populous --seed 7 --map small --year 10 [--village N|NAME] [--save FILE|--load FILE] [--json]
//   --year Y      the game year to account (default 10): the run goes to its start, then a day at a time through it
//   --village V   a village by index or name (default: the one with the most households at the year's start)
//   --save FILE   save the run at the year's start (.gz is gzipped), to account it again faster with --load
//   --load FILE   go on from a save (its scenario, seed and map with it), made before the year's start or at it by --save
//   --json        the account as data: {village, year, need, fed, nodes, links, pools, notes}
//   --html FILE   the account as a page: a Sankey diagram of the flows, the account's tables and how to read them (tools/foodflow.html,
//                 filled in); --bare writes the page without its document wrapper, as an Artifact is published
// The village is its households (their farms' village) and its village store. Food is counted in rations as stored (a sheaf, a ration of
// grain, flour, a meal, a fish, a ration of milk), in four household pools and the store: grain (sheaves in the barn, grain, flour, pawns'
// stakes), fresh (the catch, gathered food, the rack's fish), the larder (meat, salt meat, milk, butter, dried fish), meals (cooked), and the
// village store's grain. Sources: the harvest by crop (households' fields and the common fields), fish, gathered food, meat, venison,
// milk, butter. Outlets: seed, eaten (as meals, uncooked, fresh, from the larder), brewed, rotted (each pool), given to the village store,
// exchanged with other villages (gifts, shares, provisions, journeys, and what a dissolved household held), and the change in stores.
// A pool's flows are read from the stores' ledgers and yearly totals (src/sim/stores.js), diffed each day; three are read otherwise: the
// crop of a harvest load from Stores.sheaf and of the commons' from Stores.put (both wrapped for the year, the call passed on unchanged);
// what spoils in the larder, from its lots as they leave it (sim/byre drops a lot past its day without a ledger entry); and what is eaten
// from the larder, by difference (sim/hunger's takeFood writes no entry). Each pool closes: what is left over is its `unexplained` link.
// `fed` is eaten in rations of need (grain eaten uncooked feeds ECON.uncooked a ration); `need` sums the households' dailyNeed each day.
// It writes nothing to st (the wrappers are removed at the year's end), so a seed is the same run with or without it (tests/foodflow.js).
// Used by scripts: `const f = require('./foodflow.js')(VB, st, {village})`; `f.advanceYear()` from a year's start; `f.result()`.
require('./help.js')(__filename);

// the pool of each food good, as the ledger names it
const POOL = { sheaves: 'grain', grain: 'grain', flour: 'grain', meals: 'meals', fish: 'fresh', gathered: 'fresh',
  'dried fish': 'larder', meat: 'larder', 'salt meat': 'larder', milk: 'larder', butter: 'larder' };
const POOLS = ['grain', 'fresh', 'larder', 'meals', 'store'];
const LABEL = { grain: 'Grain & flour', fresh: 'Fresh food', larder: 'Larder', meals: 'Cooked meals', store: 'Village store' };
// movements between holders: inside the village they cancel, what is left is exchanged with other villages
const TRANSFER = ['gift', 'share', 'handingOn', 'provisions', 'journey'];
// a pool's own kinds: [kind, the node it flows to (an outlet) or from (a source)]; kinds missing here are shown as `other (kind)`
const ROUTE = {
  grain: { seed: 'Seed', spoilage: 'Rotted', brew: 'Brewed', raw: 'Eaten', seedMeal: 'Eaten', thresh: null, grind: null, empty: 'Left in an empty farm' },
  fresh: { catch: 'Fish', gathering: 'Gathered', meal: 'Eaten', spoilage: 'Rotted', empty: 'Left in an empty farm' },
  larder: { meat: 'Meat', hunt: 'Venison', milk: 'Milk', butter: 'Butter', empty: 'Left in an empty farm' },
  meals: { meal: 'Eaten', empty: 'Left in an empty farm' },
  store: { seed: 'Seed', spoilage: 'Rotted' },
};
const SOURCES = ['Fish', 'Gathered', 'Meat', 'Venison', 'Milk', 'Butter'];

module.exports = (VB, st, { village = null } = {}) => {
  const Sim = VB.sim, Stores = VB['sim/stores'], Hunger = VB['sim/hunger'], { DAY, YEAR, ECON } = VB['sim/rules'];
  const flows = new Map(); // `${pool}|${kind}` -> net rations, the year's
  const crops = new Map(); // `${pool}|${crop}` -> rations harvested
  const add = (m, k, n) => m.set(k, (m.get(k) || 0) + n);
  let V = village, need = 0, larderSpoilt = 0, larderGone = 0, toStore = 0, storeIn = 0, fromStore = 0, within = 0, dissolvedHeld = {}, opening = null, closing = null;
  let first = null;

  const villageOf = (hh) => st.farmsteads[hh.farmstead].village;
  const householdsOf = () => st.liveHouseholds.map((id) => st.households[id]).filter((hh) => !hh.dissolved && villageOf(hh) === V);
  const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
  // a household's food by pool, and its larder lots (kept by identity, to see which leave and how)
  function stocks(hh) {
    const stakes = sum(hh.members, (id) => st.pawns[id].stake || 0);
    return { grain: Stores.grainOf(hh) + (hh.flour || 0) + sum(hh.unthreshed, (n) => n) + stakes, fresh: sum(hh.fresh, (b) => b.qty) + (hh.rack || 0),
      larder: sum(hh.larder, (l) => l.n), meals: hh.meals || 0, lots: hh.larder.map((l) => [l, l.n, l.kind]) };
  }
  // the day's snapshot: each holder's stocks and its ledger's routine totals as read so far
  function snapshot() {
    const hhs = householdsOf(), v = st.villages[V];
    return { t: st.t, hhs: new Map(hhs.map((hh) => [hh.id, stocks(hh)])), store: Stores.grainOf(v), need: sum(hhs, (hh) => Hunger.dailyNeed(st, hh)) };
  }
  // A holder's new movements: its ledger's entries after the last one read (by identity: an entry made in a day's last step is stamped
  // with the next day's first hour, and the ledger only grows, but for pruning entries three years old), and its totals' growth.
  const totalsSeen = new Map(), lastSeen = new Map(); // `${holder}|${year}|${kind}|${good}` -> n read; holder -> its last entry read
  function readHolder(key, holder, store, prime = false) {
    const L = holder.ledger, last = lastSeen.get(key);
    for (let i = L.length - 1; !prime && i >= 0 && L[i] !== last; i--) entry(store, L[i]);
    if (L.length) lastSeen.set(key, L[L.length - 1]);
    for (let i = holder.totals.length - 1; i >= 0; i--) {
      const x = holder.totals[i], k = `${key}|${x.year}|${x.kind}|${x.good}`, d = x.n - (totalsSeen.get(k) || 0);
      if (d && !prime) entry(store, { kind: x.kind, good: x.good, n: d });
      totalsSeen.set(k, x.n);
    }
  }
  // one movement: into its pool by good (the store has one pool); transfers are kept apart, by direction
  function entry(store, e) {
    const pool = store ? (POOL[e.good] === 'grain' ? 'store' : null) : POOL[e.good];
    if (!pool) return; // wood, timber, stone, ale and the other goods that are not food
    if (store && e.kind === 'gift') { if (e.n < 0) fromStore -= e.n; else storeIn += e.n; return; }
    if (!store && e.kind === 'gift' && e.to === 'the village store') { toStore -= e.n; return; }
    if (!store && TRANSFER.includes(e.kind) && e.n < 0) within -= e.n; // gross, both directions inside and out
    add(flows, `${pool}|${e.kind}`, e.n);
  }
  // the larder's lots that left it today: what was left of a lot past its day spoilt; meat salted reappears as salt meat
  function larderDay(before, hh) {
    const now = new Set(hh.larder), salted = hh.larder.some((l) => l.kind === 'salt meat' && !before.lots.some(([x]) => x === l));
    for (const [lot, , kind] of before.lots) {
      if (now.has(lot) || !(lot.n > 1e-9)) continue;
      if (lot.until <= st.t) larderSpoilt += lot.n;
      else if (!(kind === 'meat' && salted)) larderGone += lot.n;
    }
  }
  function wrap() {
    const sheaf = Stores.sheaf, put = Stores.put;
    Stores.sheaf = function (s, hh, n, seq, crop = 'barley') {
      if (s === st && !hh.dissolved && villageOf(hh) === V) add(crops, `grain|${crop}`, n);
      return sheaf.apply(this, arguments);
    };
    Stores.put = function (s, holder, good, n, why) {
      if (s === st && why === 'harvest' && holder === st.villages[V] && good.startsWith('grain/')) add(crops, `store|${good.slice(6)}`, n);
      return put.apply(this, arguments);
    };
    return () => { Stores.sheaf = sheaf; Stores.put = put; };
  }

  function advanceYear() {
    if (V === null) { // the village with the most households now
      const n = new Map(); for (const id of st.liveHouseholds) add(n, villageOf(st.households[id]), 1);
      V = [...n].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
    }
    const end = (Math.floor(st.t / YEAR) + 1) * YEAR, unwrap = wrap();
    let day = snapshot();
    first = day; opening = day;
    for (const [id, hh] of st.households.entries()) if (!hh.dissolved) readHolder(id, hh, false, true); // what is on record so far: read
    readHolder('v', st.villages[V], true, true);
    try {
      while (st.t < end) {
        Sim.advance(st, Math.min(DAY - (st.t % DAY), end - st.t));
        need += day.need * ((st.t - day.t) / DAY);
        const now = snapshot();
        for (const [id, before] of day.hhs) {
          const hh = st.households[id];
          if (hh.dissolved) { // its ledger went with it: of what it held at the day's start, what it still holds is left in the empty
            // farm (VB-650: a dissolved household's stores lie as they are), the rest went that day, mostly as stakes with its people
            const left = stocks(hh);
            for (const p of ['grain', 'fresh', 'larder', 'meals']) {
              dissolvedHeld[p] = (dissolvedHeld[p] || 0) + left[p];
              add(flows, `${p}|empty`, -left[p]);
              add(flows, `${p}|dissolved`, -(before[p] - left[p]));
            }
            continue;
          }
          larderDay(before, hh);
        }
        for (const [id] of now.hhs) readHolder(id, st.households[id], false);
        readHolder('v', st.villages[V], true);
        day = now;
      }
    } finally { unwrap(); }
    closing = day;
  }

  function result() {
    const pick = (snap, p) => (p === 'store' ? snap.store : sum([...snap.hhs.values()], (s) => s[p]));
    const links = [], link = (source, target, value, kind) => { if (value > 1e-6) links.push({ source, target, value, kind }); };
    const f = (p, k) => flows.get(`${p}|${k}`) || 0;
    const pools = {};
    for (const p of POOLS) pools[p] = { in: 0, out: 0, opening: pick(opening, p), closing: pick(closing, p) };
    const into = (p, v) => (pools[p].in += v), outOf = (p, v) => (pools[p].out += v);
    // sources: the harvest by crop, then the pools' own sources
    for (const [k, n] of crops) { const [p, crop] = k.split('|'), name = crop[0].toUpperCase() + crop.slice(1); link(name, LABEL[p], n, 'harvest'); into(p, n); }
    // conversions between pools: cooking (into meals), drying (fresh fish to dried fish in the larder)
    const cooked = { grain: -f('grain', 'cooking'), fresh: -f('fresh', 'cooking'), larder: -f('larder', 'cooking') };
    for (const p of ['grain', 'fresh', 'larder']) { link(LABEL[p], LABEL.meals, cooked[p], 'cooking'); outOf(p, cooked[p]); into('meals', cooked[p]); }
    const made = f('meals', 'cooking'), cookDiff = made - (cooked.grain + cooked.fresh + cooked.larder);
    if (cookDiff > 0) { link('Gained in cooking', LABEL.meals, cookDiff, 'cooking'); into('meals', cookDiff); } else { link(LABEL.meals, 'Lost in cooking', -cookDiff, 'cooking'); outOf('meals', -cookDiff); }
    const dried = f('larder', 'drying');
    link(LABEL.fresh, LABEL.larder, dried, 'drying'); outOf('fresh', dried); into('larder', dried); // fish to the rack and off it: one kind
    // the store and the households: what the store was given (moved to it, or a gift carried to a household that had dissolved meanwhile,
    // whose giver booked it as a gift to that household), and its gifts back (booked by the receiver as gifts too)
    link(LABEL.grain, LABEL.store, storeIn, 'gift'); outOf('grain', storeIn); into('store', storeIn);
    link(LABEL.store, LABEL.grain, fromStore, 'gift'); outOf('store', fromStore); into('grain', fromStore);
    const storeAdjust = { grain: storeIn - toStore - fromStore };
    // each pool's own kinds
    const seen = new Set(['cooking', 'drying', 'dissolved', ...TRANSFER]);
    for (const p of POOLS) {
      for (const [k, n] of flows) {
        const [q, kind] = k.split('|');
        if (q !== p || seen.has(kind) || (p === 'grain' && kind === 'harvest') || (p === 'store' && kind === 'harvest')) continue;
        const to = kind in ROUTE[p] ? ROUTE[p][kind] : `other (${kind})`;
        if (to === null) continue; // inside the pool (thresh, grind): nets to nothing, and what does not is unexplained
        if (n >= 0) { link(to, LABEL[p], n, kind); into(p, n); } else { link(LABEL[p], to, -n, kind); outOf(p, -n); }
      }
      // exchanged with other villages (and new and dissolved households): the net of the transfer kinds
      if (p !== 'store') {
        const x = TRANSFER.reduce((s, k) => s + f(p, k), 0) + f(p, 'dissolved') + (storeAdjust[p] || 0);
        if (x >= 0) { link('From other villages', LABEL[p], x, 'exchange'); into(p, x); } else { link(LABEL[p], 'To other villages', -x, 'exchange'); outOf(p, -x); }
      }
    }
    // the larder: what spoilt, measured; what was eaten, by difference
    link(LABEL.larder, 'Rotted', larderSpoilt, 'spoilage'); outOf('larder', larderSpoilt);
    const L = pools.larder, eatenLarder = L.in - L.out - (L.closing - L.opening);
    link(LABEL.larder, 'Eaten', eatenLarder, 'larder'); outOf('larder', Math.max(0, eatenLarder));
    // the change in stores, and what each pool leaves unexplained
    for (const p of POOLS) {
      const P = pools[p], d = P.closing - P.opening;
      if (d < 0) { link('Drawn from stores', LABEL[p], -d, 'stock'); } else link(LABEL[p], 'Put by', d, 'stock');
      P.unexplained = P.in - P.out - d;
      if (P.unexplained > 0) link(LABEL[p], 'Unexplained loss', P.unexplained, 'unexplained'); else link('Unexplained gain', LABEL[p], -P.unexplained, 'unexplained');
    }
    const eaten = links.filter((l) => l.target === 'Eaten');
    const fed = sum(eaten, (l) => (l.kind === 'raw' || l.kind === 'seedMeal' ? l.value * ECON.uncooked : l.value));
    const names = [...new Set(links.flatMap((l) => [l.source, l.target]))];
    const produced = sum(links.filter((l) => l.kind === 'harvest' || SOURCES.includes(l.source)), (l) => l.value);
    const v = st.villages[V];
    return {
      village: { id: V, name: v.name, households: [opening.hhs.size, closing.hhs.size],
        people: [opening, closing].map((s) => sum([...s.hhs.keys()], (id) => st.households[id].members.filter((m) => st.pawns[m].died === null).length)) },
      year: Math.floor((first.t + 1) / YEAR) + 1, need, fed, produced,
      nodes: names.map((name) => ({ name, pool: POOLS.find((p) => LABEL[p] === name) || null })),
      links: links.map((l) => ({ ...l, value: +l.value.toFixed(1) })),
      pools: Object.fromEntries(POOLS.map((p) => [p, Object.fromEntries(Object.entries(pools[p]).map(([k, x]) => [k, +x.toFixed(1)]))])),
      notes: { passedBetweenHouseholds: +within.toFixed(1), larderLeftUnexplained: +larderGone.toFixed(1),
        leftInEmptyFarms: Object.fromEntries(Object.entries(dissolvedHeld).map(([k, x]) => [k, +x.toFixed(1)])),
        cookedInMealsVsTaken: +cookDiff.toFixed(1) },
      raw: Object.fromEntries([...flows].map(([k, n]) => [k, +n.toFixed(1)])),
    };
  }

  function print(r) {
    const n = (x) => Math.round(x).toLocaleString('en');
    console.log(`${r.village.name} (village ${r.village.id}), year ${r.year}: ${r.village.households.join(' → ')} households, ${r.village.people.join(' → ')} people`);
    console.log(`produced ${n(r.produced)} rations; need ${n(r.need)}; fed ${n(r.fed)} (${Math.round((100 * r.fed) / r.need)}% of need)\n`);
    console.table(r.links.map((l) => ({ from: l.source, to: l.target, rations: Math.round(l.value), kind: l.kind })));
    console.table(Object.entries(r.pools).map(([p, x]) => ({ pool: p, ...x, 'unexplained %': x.in ? +((100 * x.unexplained) / x.in).toFixed(1) : 0 })));
    console.log('notes', r.notes);
  }
  return { advanceYear, result, print };
};

// The page of an account (`--html`): tools/foodflow.html with its title and data filled in; bare, without the document around it.
module.exports.page = (out, bare = false) => {
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;'), data = JSON.stringify(out).replace(/</g, '\\u003c');
  const page = require('fs').readFileSync(require('path').join(__dirname, 'foodflow.html'), 'utf8')
    .replace('{{TITLE}}', () => esc(`Where ${out.village.name}'s food goes`)).replace('{{DATA}}', () => data);
  return bare ? page : `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n` +
    `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n${page}</body>\n</html>\n`;
};

if (require.main === module) {
  const fs = require('fs'), zlib = require('zlib');
  const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
  const SIZES = { tiny: [120, 85], small: [180, 130], medium: [280, 200], large: [380, 270] };
  const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
  const readSave = (f) => { const d = JSON.parse((f.endsWith('.gz') ? zlib.gunzipSync(fs.readFileSync(f)) : fs.readFileSync(f)).toString('utf8')); return d && d.build && d.save ? d.save : d; };
  const loaded = opt('load', null) ? readSave(opt('load')) : null;
  const mapOf = (d) => Object.keys(SIZES).find((k) => SIZES[k][0] === d.cols && SIZES[k][1] === d.rows);
  const scenario = loaded ? loaded.scenario : opt('scenario', 'populous'), seed = loaded ? loaded.seed : +opt('seed', 7), map = loaded ? mapOf(loaded) : opt('map', 'small');
  const year = +opt('year', 10), json = args.includes('--json');
  const it = G.generate(seed, { cols: SIZES[map][0], rows: SIZES[map][1] }); let r; while (!(r = it.next()).done);
  const st = loaded ? Sim.load(r.value, loaded) : Sim.seed(r.value, seed, scenario);
  const t0 = (year - 1) * Sim.YEAR;
  if (st.t > t0) { console.error(`the run is at year ${Math.floor(st.t / Sim.YEAR) + 1}, past the start of year ${year}`); process.exit(2); }
  Sim.advance(st, t0 - st.t);
  if (opt('save', null)) {
    const f = opt('save'), text = JSON.stringify(Sim.save(st));
    fs.writeFileSync(f, f.endsWith('.gz') ? zlib.gzipSync(text) : text);
  }
  let village = opt('village', null);
  if (village !== null) village = /^\d+$/.test(village) ? +village : st.villages.findIndex((v) => v.name === village);
  if (village !== null && !st.villages[village]) { console.error(`no village ${opt('village')}`); process.exit(2); }
  const f = module.exports(VB, st, { village });
  f.advanceYear();
  const out = { scenario, seed, map, ...f.result() };
  if (json) console.log(JSON.stringify(out, null, 1)); else { console.log(`${scenario}, seed ${seed}, ${map} map`); f.print(out); }
  if (opt('html', null)) fs.writeFileSync(opt('html'), module.exports.page(out, args.includes('--bare')));
}
