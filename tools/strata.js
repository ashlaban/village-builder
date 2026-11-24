// The strata report (VB-765): the work line 600 / 325 / 75, the heads line and the urban sink's two bounds, counted from a run, before anything is built for them.
// node tools/strata.js [--scenario founders|solo|heirs|populous] [--seed N] [--map probe|tiny|small|medium|large] [--years Y] [--every step|hour] [--json]
// node tools/strata.js --load FILE [--years Y] [--every step|hour] [--json]     (--years counts on from the save's year)
// Hours: each adult's (14 and over) hours on a job, sampled as tools/hours.js samples them (every step, or each hour's first with
// --every hour), walking and carrying included, by the kind of the job. A kind falls in one of: farming (fields, hay, herds, fishing,
// hunting, gathering and their carrying); not farming (every craft hour, whoever the product is for: brewing, drying fish, tar, quern
// making, digging; carrying to deal, dealing and service, which no kind of today's jobs is); elite (the hours of an elite household's
// members: 0 until VB-318's view exists); household work, printed apart and outside the three figures (cooking, water, firewood,
// grinding, building and upkeep). A kind this tool does not know is printed as unclassified, apart, and the tool says so.
// The work line: per 1,000 of the three classes' hours, for the island and each village, by decade, with the target 600 / 325 / 75, the
// residual (measure less target) and the band the plan proposes (550 to 700 / 250 to 400 / 50 to 100: proposed, not applied). The
// target is not changed and no allowance is written. Beside it, the share of not-farming hours whose product left the household: it
// cannot yet be told (no good is tracked from its maker to a buyer or a recipient), and the tool says so.
// The heads line: the households per 1,000 by their relation to production: elite (VB-318, none yet), craft, farm. The rest are told by the
// craft's share of their food over 3 years, which is not measured yet: the tool uses the craft's share of their working hours over 3
// years (at least a half is craft), and says so. Today every household is a farm.
// The sink, for each village by decade: people at its end, the movers in and out (pawns alive at a year's start and end, in another
// village), births and deaths per 1,000 a year, M / (d - b) (M the movers in a year; infinite where deaths do not exceed births),
// S / c (S the grain a year that its households and store were given from a household of another village, c a person's yearly need),
// and which of the two is lower. A village's S is read from the household and village ledgers (three years), at each year's end.
// It reads the run and writes nothing to it. Also used by tests/lib/bands.js: `Strata.collector(VB, st)`.
require('./help.js')(__filename);
const KINDS_OF = {
  farm: 'plow sow reap haul weed thresh clear break ditch meadow reclaim rake mow hay fodder manure milk shear slaughter salt fell grub fish gather herd lead hunt boat cart leftCart restore workclear fetchHaul fetchHay fetchLeftCart drove',
  craft: 'brew hewQuern rackfish dry tarpit burntar tarhouse tarboat dig boilsalt smelt mendtools cobble harness spin weave loom',
  household:
    'wood firewood cook water boothwater drink grind foundation walls roof barnbase barnwalls barnroof byrewalls byreroof timber booth leftTimber leftGrain pick quarry raise green wellstone well sweep workfence mend repair mendcart housewell fetchWood fetchLeftTimber fetchLeftGrain fetchWellstone blaze',
};
const CLASS = {};
for (const [c, ks] of Object.entries(KINDS_OF)) for (const k of ks.split(' ')) CLASS[k] = c;
const FIGURES = ['farm', 'craft', 'elite'],
  TARGET = { farm: 600, craft: 325, elite: 75 },
  PROPOSED = { farm: [550, 700], craft: [250, 400], elite: [50, 100] },
  NAMES = { farm: 'farming', craft: 'not farming', elite: 'elite' };
const classOf = (kind) => CLASS[kind] || 'unclassified';
// until VB-318's class view exists no household is elite
const eliteOf = () => false;
function collector(VB, st) {
  const Sim = VB.sim,
    { dailyNeed } = VB['sim/hunger'],
    bump = (o, k, n) => {
      o[k] = (o[k] || 0) + n;
    };
  const years = new Map(); // year -> {hours: {village: {class: h}}, hh: {id: {class: h}}, kinds: {kind: h}, sink: {village: {...}}}
  const yr = (y) => years.get(y) || years.set(y, { hours: {}, hh: {}, kinds: {}, sink: {}, hhs: 0 }).get(y);
  let year = 0,
    from = null,
    t0 = 0;
  const villageOf = (p) => Sim.settlementIdOf(st, p);
  // one sample: `w` hours for each adult on a job
  function sample(w) {
    const Y = yr(year);
    for (const a of st.agents) {
      const p = st.pawns[a.id];
      if (!a.job || !p.alive || p.household === null || p.retired || Sim.age(st, p) < 14) continue;
      const hh = st.households[p.household];
      let c = classOf(a.job.kind);
      if (FIGURES.includes(c) && eliteOf(st, hh)) c = 'elite';
      const v = villageOf(p);
      bump(Y.hours[v] || (Y.hours[v] = {}), c, w);
      bump(Y.hh[hh.id] || (Y.hh[hh.id] = {}), c, w);
      bump(Y.kinds, a.job.kind, w);
    }
  }
  function begin(y) {
    year = y;
    t0 = st.t;
    from = new Map();
    for (const id of st.living) from.set(id, villageOf(st.pawns[id]));
  }
  function end() {
    const Y = yr(year),
      S = Y.sink,
      sk = (v) => S[v] || (S[v] = { pop0: 0, pop1: 0, in: 0, out: 0, births: 0, deaths: 0, given: 0, need: 0 });
    for (const v of from.values()) if (v !== null) sk(v).pop0++;
    for (const id of st.living) {
      const p = st.pawns[id],
        v = villageOf(p);
      if (v !== null) sk(v).pop1++;
      const was = from.get(id);
      if (was !== undefined && was !== null && v !== null && was !== v) {
        sk(v).in++;
        sk(was).out++;
      } else if (was === undefined && p.born >= t0 && v !== null) sk(v).births++;
    }
    for (const p of st.pawns) if (p.died !== null && p.died >= t0 && p.household !== null) {
      const v = villageOf(p);
      if (v !== null) sk(v).deaths++;
    }
    // grain given to a village's households or store from a household of another village, from the ledgers' entries of this year
    const home = new Map(st.farmsteads.map((f) => [f.name, f.village])),
      scan = (holder, v) => {
        for (const e of holder.ledger || [])
          if (e.t >= t0 && e.kind === 'gift' && typeof e.from === 'string' && e.n > 0 && home.has(e.from) && home.get(e.from) !== v) sk(v).given += e.n;
      };
    let live = 0;
    for (const id of st.liveHouseholds) {
      const hh = st.households[id],
        v = st.farmsteads[hh.farmstead].village;
      live++;
      scan(hh, v);
      sk(v).need += dailyNeed(st, hh) * Sim.YEAR_DAYS;
    }
    Y.hhs = live;
    st.villages.forEach((vl, v) => scan(vl, v));
  }
  // heads: by the craft's share of the household's hours over the three years to `y`
  function heads(y) {
    const tot = {},
      ids = new Set(st.liveHouseholds);
    for (let k = Math.max(1, y - 2); k <= y; k++)
      for (const [id, h] of Object.entries(yr(k).hh))
        if (ids.has(+id)) {
          const t = tot[id] || (tot[id] = {});
          for (const c in h) bump(t, c, h[c]);
        }
    const n = { elite: 0, craft: 0, farm: 0 };
    for (const id of ids) {
      const t = tot[id] || {},
        w = FIGURES.reduce((s, c) => s + (t[c] || 0), 0);
      if (eliteOf(st, st.households[id])) n.elite++;
      else if (w > 0 && (t.craft || 0) >= 0.5 * w) n.craft++;
      else n.farm++;
    }
    return n;
  }
  const merge = (ys, f) => {
    const o = {};
    for (const y of ys) f(yr(y), o);
    return o;
  };
  function line(h) {
    // per 1,000 of the three figures' hours
    const tot = FIGURES.reduce((s, c) => s + (h[c] || 0), 0);
    return {
      hours: tot,
      ...Object.fromEntries(FIGURES.map((c) => [c, tot ? (1000 * (h[c] || 0)) / tot : null])),
      household: h.household || 0,
      unclassified: h.unclassified || 0,
    };
  }
  // the years run, by decade from the first
  function result(first, last) {
    const nv = st.villages.length,
      out = [];
    for (let a = first; a <= last; a += 10) {
      const z = Math.min(a + 9, last),
        ys = [...Array(z - a + 1).keys()].map((i) => a + i);
      const island = merge(ys, (Y, o) => {
        for (const h of Object.values(Y.hours)) for (const c in h) bump(o, c, h[c]);
      });
      const villages = [...Array(nv).keys()].map((v) => ({
        village: v,
        ...line(merge(ys, (Y, o) => { for (const c in Y.hours[v] || {}) bump(o, c, Y.hours[v][c]); })),
      }));
      const sink = [...Array(nv).keys()].map((v) => {
        const s = merge(ys, (Y, o) => { const x = Y.sink[v] || {}; for (const k in x) bump(o, k, x[k]); }),
          py = s.pop0 || 0,
          b = py ? s.births / py : 0,
          dd = py ? s.deaths / py : 0,
          M = (s.in || 0) / ys.length,
          c = s.pop1 ? (s.need || 0) / s.pop1 : 0,
          S = (s.given || 0) / ys.length,
          mdb = dd > b ? M / (dd - b) : Infinity,
          sc = c ? S / c : 0;
        return {
          village: v, people: (yr(z).sink[v] || {}).pop1 || 0, in: s.in || 0, out: s.out || 0, birthsPer1000: 1000 * b, deathsPer1000: 1000 * dd,
          MoverDMinusB: mdb, SoverC: sc, binds: mdb === Infinity && sc === 0 ? 'neither' : mdb <= sc ? 'M / (d - b)' : 'S / c',
        };
      });
      out.push({ label: `years ${a}-${z}`, from: a, to: z, island: line(island), villages, sink, heads: heads(z) });
    }
    return out;
  }
  return { sample, begin, end, result, years, heads };
}
module.exports = { collector, classOf, CLASS, FIGURES, TARGET, PROPOSED };
if (require.main === module) {
  const VB = require('../src/load.js'),
    Sim = VB.sim,
    G = VB.gen,
    { TICKS } = VB['sim/rules'],
    fs = require('fs'),
    zlib = require('zlib');
  const args = process.argv.slice(2),
    opt = (n, d) => {
      const i = args.indexOf('--' + n);
      return i >= 0 ? args[i + 1] : d;
    };
  const SIZES = { probe: [36, 26], tiny: [120, 85], small: [180, 130], medium: [280, 200], large: [380, 270] },
    every = opt('every', 'step'),
    json = args.includes('--json');
  if (!['step', 'hour'].includes(every)) {
    console.error('strata: --every is hour or step');
    process.exit(2);
  }
  const loadFrom = opt('load', null);
  let loaded = null;
  if (loadFrom) {
    const d = JSON.parse((loadFrom.endsWith('.gz') ? zlib.gunzipSync(fs.readFileSync(loadFrom)) : fs.readFileSync(loadFrom)).toString('utf8'));
    loaded = d && d.build && d.save ? d.save : d;
  }
  const mapOf = (d) => Object.keys(SIZES).find((k) => SIZES[k][0] === d.cols && SIZES[k][1] === d.rows);
  const scenario = loaded ? loaded.scenario : opt('scenario', 'founders'),
    seed = loaded ? loaded.seed : +opt('seed', 7),
    map = loaded ? mapOf(loaded) : opt('map', 'small');
  if (!SIZES[map] || !['founders', 'solo', 'heirs', 'populous'].includes(scenario)) {
    console.error('strata: see --help');
    process.exit(2);
  }
  const it = G.generate(seed, { cols: SIZES[map][0], rows: SIZES[map][1] });
  let r;
  while (!(r = it.next()).done);
  const st = loaded ? Sim.load(r.value, loaded) : Sim.seed(r.value, seed, scenario),
    col = collector(VB, st),
    start = Math.floor(st.t / Sim.YEAR),
    last = start + +opt('years', 10),
    STEP = 1 / TICKS;
  for (let y = start + 1; y <= last; y++) {
    col.begin(y);
    for (let k = 0; k < Sim.YEAR * TICKS; k++) {
      Sim.advance(st, STEP);
      if (every === 'step') col.sample(STEP);
      else if (k % TICKS === 0) col.sample(1);
    }
    col.end();
  }
  const res = col.result(start + 1, last),
    f1 = (x) => (x === null ? '-' : x === Infinity ? 'inf' : x.toFixed(1)),
    kinds = {};
  for (const Y of col.years.values()) for (const [k, h] of Object.entries(Y.kinds)) kinds[k] = (kinds[k] || 0) + h;
  const unknown = Object.keys(kinds).filter((k) => classOf(k) === 'unclassified');
  if (json) {
    console.log(JSON.stringify({ scenario, seed, map, years: last, decades: res, kinds, unclassified: unknown }, (k, v) => (v === Infinity ? 'inf' : v), 1));
    process.exit(0);
  }
  console.log(`${scenario} seed ${seed} ${map}, to year ${last}${loaded ? ` (from the save at year ${start})` : ''}; hours sampled ${every === 'step' ? 'every step' : 'every hour'}`);
  for (const d of res) {
    console.log(`\n== ${d.label} ==`);
    console.log(`work line per 1,000 hours of the three figures (island ${Math.round(d.island.hours)} h; household work ${Math.round(d.island.household)} h, apart; unclassified ${Math.round(d.island.unclassified)} h)`);
    console.log('figure        measure  target  residual   proposed band (not applied)');
    for (const c of FIGURES) {
      const m = d.island[c];
      console.log(`${NAMES[c].padEnd(12)} ${f1(m).padStart(8)} ${String(TARGET[c]).padStart(7)} ${(m === null ? '-' : f1(m - TARGET[c])).padStart(9)}   ${PROPOSED[c].join(' to ')}`);
    }
    console.log('village   hours  farming  not farming  elite  | people   in  out  b/1000  d/1000  M/(d-b)   S/c  binds');
    d.villages.forEach((v, i) => {
      const s = d.sink[i];
      console.log(
        `${String(v.village).padStart(7)} ${String(Math.round(v.hours)).padStart(7)} ${f1(v.farm).padStart(8)} ${f1(v.craft).padStart(12)} ${f1(v.elite).padStart(6)}  | ${String(s.people).padStart(6)} ${String(s.in).padStart(4)} ${String(s.out).padStart(4)} ${f1(s.birthsPer1000).padStart(7)} ${f1(s.deathsPer1000).padStart(7)} ${f1(s.MoverDMinusB).padStart(8)} ${f1(s.SoverC).padStart(5)}  ${s.binds}`,
      );
    });
    const n = d.heads,
      N = n.elite + n.craft + n.farm || 1;
    console.log(`heads per 1,000 households (of ${N}): elite ${f1((1000 * n.elite) / N)} (no class view yet), craft ${f1((1000 * n.craft) / N)} (by hours, not food), farm ${f1((1000 * n.farm) / N)}`);
  }
  console.log('\nshare of not-farming hours whose product left the household: cannot yet be told (no good is followed from its maker to a buyer or a recipient)');
  if (unknown.length) console.log(`unclassified kinds (outside the figures): ${unknown.join(', ')}`);
  console.log('hours by kind: ' + Object.entries(kinds).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, h]) => `${k} (${classOf(k)}) ${Math.round(h)}`).join(', '));
}
