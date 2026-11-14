// Live shadow experiment: exact A* guided by one demand-grown shortest-path tree per village.
// usage: node tools/village-tree-probe.js [--map tiny|small|medium|large] [--seeds 7,42] [--days 48] [--grow 64] [--cap 2048]
// --load FILE starts from a local saved game instead of generation (one run; --seeds is ignored).
// Control, endpoint-demand and actual-tread exit growth see the SAME native cache misses and cost changes.
// Exits are undeveloped tiles adjoining developed land, learned only when a pawn actually treads there.
// Includes tree building and invalidation in work/timings; never replaces game routes. Outputs JSON; no screenshots.
require('./help.js')(__filename);
const fs = require('fs'), path = require('path'), assert = require('assert'), zlib = require('zlib');
const { Costs, TreePool, Solver } = require('./lib/village-trees.js');
const root = path.join(__dirname, '..'), args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : args[i + 1]; };
const map = opt('map', 'tiny'), sizes = { tiny: [120, 85], small: [180, 130], medium: [280, 200], large: [380, 270] };
const days = +opt('days', 48), grow = +opt('grow', 64), cap = +opt('cap', 2048), load = opt('load', null);
const seeds = load ? [null] : opt('seeds', '7,42').split(',').map(Number);
if (!sizes[map] || !Number.isInteger(days) || days < 0 || !Number.isInteger(grow) || grow < 1 || !Number.isInteger(cap) || cap < 8 || seeds.some(s => s !== null && !Number.isInteger(s))) throw new Error('bad arguments');
let live = null;
for (const file of JSON.parse(fs.readFileSync(path.join(root, 'src/manifest.json'), 'utf8'))) {
  require(path.join(root, 'src', file));
  if (file === 'sim/routes.js') {
    const r = globalThis.VB['sim/routes'], route = r.route, changed = r.costChanged;
    r.route = (st, from, to) => {
      const before = globalThis.VB.count.routeSearch, start = performance.now(), p = route(st, from, to);
      if (live?.st === st) {
        live.nativeMs += performance.now() - start; live.calls++;
        if (globalThis.VB.count.routeSearch > before) live.query(from, to, p);
      }
      return p;
    };
    r.costChanged = (st, i) => { if (live?.st === st) live.changed(i); return changed(st, i); };
  }
  if (file === 'sim/paths.js') {
    const p = globalThis.VB['sim/paths'], tread = p.tread;
    p.tread = (w, i, n) => { tread(w, i, n); if (live?.st.w === w) live.tread(i); };
  }
}
const vb = globalThis.VB, R = vb['sim/routes'], rules = vb['sim/rules'], { hexSteps } = vb['sim/hex'];
class Experiment {
  constructor(st) {
    this.st = st; this.calls = 0; this.misses = 0; this.compared = 0; this.noRoute = 0; this.nativeMs = 0; this.exitHookMs = 0;
    this.exitTreads = 0; this.treads = 0; this.changes = 0; this.ties = { demand: 0, exit: 0 }; this.strongQueries = { demand: 0, exit: 0 };
    this.models = {};
    for (const name of ['control', 'demand', 'exit']) {
      const costs = new Costs(st.w, R), solver = new Solver(costs, hexSteps, rules);
      this.models[name] = { costs, solver, dispatchMs: 0, pool: name === 'control' ? null : new TreePool(costs, { cap, grow }) };
    }
  }
  village(tile) {
    const st = this.st, owner = st.owner[tile];
    if (owner < 0 && st.villages[-owner - 1]) return -owner - 1;
    if (owner > 0) { const hh = st.households[owner - 1], f = hh && st.farmsteads[hh.farmstead]; if (f && st.villages[f.village]) return f.village; }
    let vid = -1, best = Infinity;
    for (let v = 0; v < st.villages.length; v++) { const d = hexSteps(st.w, tile, st.villages[v].center); if (d < best) { best = d; vid = v; } }
    return vid;
  }
  tree(model, tile) { const v = this.village(tile); return v < 0 ? null : model.pool.get(v, this.st.villages[v].center); }
  query(from, to, native) {
    this.misses++;
    const values = {}, order = this.misses % 2 ? ['control', 'demand', 'exit'] : ['exit', 'demand', 'control'];
    for (const name of order) {
      const started = performance.now();
      const model = this.models[name], tree = model.pool ? this.tree(model, from) : null;
      if (name === 'demand') model.pool.grow(tree, [from, to]);
      const before = model.solver.stats.stronger;
      values[name] = model.solver.route(from, to, tree);
      model.dispatchMs += performance.now() - started;
      if (name !== 'control' && before < model.solver.stats.stronger) this.strongQueries[name]++;
    }
    const control = values.control, valid = native.length > 1 && native[0] === from;
    if (!valid) { this.noRoute++; assert(!control, `control found route native rejected: ${from}->${to}`); }
    else {
      assert(control, `control lost route ${from}->${to}`);
      assert(Math.abs(control.cost - R.routeCost(this.st.w, native, true)) < 1e-8, `control/native choice ${from}->${to}`);
      assert(Math.abs(control.time - R.routeCost(this.st.w, native)) < 1e-8, `control/native time ${from}->${to}`);
      this.compared++;
    }
    for (const name of ['demand', 'exit']) {
      const x = values[name]; assert.strictEqual(!!x, !!control);
      if (!x) continue;
      assert(Math.abs(x.cost - control.cost) < 1e-8, `${name} choice ${from}->${to}: ${x.cost} vs ${control.cost}`);
      assert(Math.abs(x.time - control.time) < 1e-8, `${name} time ${from}->${to}: ${x.time} vs ${control.time}`);
      if (x.path.join(',') !== control.path.join(',')) this.ties[name]++;
    }
  }
  changed(i) {
    this.changes++;
    for (const model of Object.values(this.models)) { if (model.pool) model.pool.changed(i); else model.costs.changed(i); }
  }
  tread(i) {
    const start = performance.now(); this.treads++;
    const { w } = this.st;
    if (i >= 0 && !w.dev[i] && !w.water[i]) {
      let boundary = false;
      for (let d = 0; d < 6; d++) { const j = w.nb[i * 6 + d]; if (j >= 0 && w.dev[j]) { boundary = true; break; } }
      if (boundary) {
        this.exitTreads++;
        const model = this.models.exit, tree = this.tree(model, i);
        model.pool.grow(tree, [i]);
      }
    }
    this.exitHookMs += performance.now() - start;
  }
  report() {
    const models = {};
    for (const [name, m] of Object.entries(this.models)) {
      const tree = m.pool?.stats;
      models[name] = { ...m.solver.stats, tree, dispatchMs: m.dispatchMs, totalSettled: m.solver.stats.settled + (tree?.treeSettled || 0),
        // exitHookMs already includes growth; do not add growth twice.
        totalMs: m.dispatchMs + (name === 'exit' ? this.exitHookMs : 0) + (tree?.invalidationMs || 0),
        costCacheTiles: m.costs.tiles.size, costCacheEdges: m.costs.edges.size };
    }
    return { calls: this.calls, misses: this.misses, compared: this.compared, noRoute: this.noRoute, costChanges: this.changes,
      treads: this.treads, exitTreads: this.exitTreads, differentEqualCostPaths: this.ties, strongerHeuristicQueries: this.strongQueries,
      nativeRouteMs: this.nativeMs, exitHookMs: this.exitHookMs, models };
  }
}
const result = [];
for (const seed of seeds) {
  let st;
  if (load) {
    const parsed = JSON.parse((load.endsWith('.gz') ? zlib.gunzipSync(fs.readFileSync(load)) : fs.readFileSync(load)).toString('utf8'));
    const data = parsed.build && parsed.save ? parsed.save : parsed;
    const it = vb.gen.generate(data.seed, { cols: data.cols, rows: data.rows }); let next; while (!(next = it.next()).done) {}
    st = vb.sim.load(next.value, data);
  }
  else {
    const it = vb.gen.generate(seed, { cols: sizes[map][0], rows: sizes[map][1] }); let next; while (!(next = it.next()).done) {}
    st = vb.sim.seed(next.value, seed, 'populous');
  }
  live = new Experiment(st);
  const start = performance.now();
  for (let day = 0; day < days; day++) vb.sim.advance(st, vb.sim.DAY);
  result.push({ seed, map: load ? 'save:' + load : map, days, grow, cap, villages: st.villages.length,
    population: st.pawns.filter(p => p.alive).length, instrumentedSimulationMs: performance.now() - start, ...live.report() });
  live = null;
}
console.log(JSON.stringify({ researchOnly: true, result }, null, 2));
