// Research engine for VB-443; not loaded by the game. One resumable Dijkstra tree per village.
// A truncated root-distance potential guides exact A*. Arbitrary branch-to-branch trips never follow the root by fiat.
class Heap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  less(a, b) { return a.k < b.k || (a.k === b.k && (a.t < b.t || (a.t === b.t && (a.b < b.b || (a.b === b.b && a.i < b.i))))); }
  push(x) {
    const a = this.items; let c = a.push(x) - 1;
    while (c) { const p = (c - 1) >> 1; if (!this.less(a[c], a[p])) break; [a[c], a[p]] = [a[p], a[c]]; c = p; }
  }
  pop() {
    const a = this.items, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      for (let c = 0; ;) {
        const l = c * 2 + 1, r = l + 1; let m = c;
        if (l < a.length && this.less(a[l], a[m])) m = l;
        if (r < a.length && this.less(a[r], a[m])) m = r;
        if (m === c) break; [a[c], a[m]] = [a[m], a[c]]; c = m;
      }
    }
    return top;
  }
}

// One queue entry per tile: repeated changes cannot accumulate stale heap records while repair is paused.
class IndexedHeap extends Heap {
  constructor() { super(); this.positions = new Map(); }
  swap(a, b) {
    const v = this.items; [v[a], v[b]] = [v[b], v[a]];
    this.positions.set(v[a].i, a); this.positions.set(v[b].i, b);
  }
  balance(c) {
    const a = this.items;
    while (c) { const p = (c - 1) >> 1; if (!this.less(a[c], a[p])) break; this.swap(c, p); c = p; }
    for (;;) {
      const l = c * 2 + 1, r = l + 1; let m = c;
      if (l < a.length && this.less(a[l], a[m])) m = l;
      if (r < a.length && this.less(a[r], a[m])) m = r;
      if (m === c) break; this.swap(c, m); c = m;
    }
  }
  push(q) {
    let p = this.positions.get(q.i);
    if (p === undefined) { p = this.items.length; this.items.push(q); this.positions.set(q.i, p); }
    else this.items[p] = q;
    this.balance(p);
  }
  remove(i) {
    const p = this.positions.get(i); if (p === undefined) return;
    const last = this.items.pop(); this.positions.delete(i);
    if (p < this.items.length) { this.items[p] = last; this.positions.set(last.i, p); this.balance(p); }
  }
  pop() { const q = this.items[0]; if (q) this.remove(q.i); return q; }
}

// Identical cost memoization for control and experiments. Finite upper bound: N tiles and 3N undirected edges.
class Costs {
  constructor(w, routes) { this.w = w; this.routes = routes; this.tiles = new Map(); this.edges = new Map(); }
  open(i) {
    if (!this.tiles.has(i)) this.tiles.set(i, this.routes.tileCost(this.w, i) < Infinity);
    return this.tiles.get(i);
  }
  edge(a, b) {
    const key = Math.min(a, b) * this.w.N + Math.max(a, b);
    let e = this.edges.get(key);
    if (!e) { e = { cost: this.routes.stepCost(this.w, a, b, true), time: this.routes.stepCost(this.w, a, b) }; this.edges.set(key, e); }
    return e;
  }
  changed(i) {
    this.tiles.delete(i);
    for (let d = 0; d < 6; d++) { const j = this.w.nb[i * 6 + d]; if (j >= 0) this.edges.delete(Math.min(i, j) * this.w.N + Math.max(i, j)); }
  }
  ports(i) {
    if (this.open(i)) return [i];
    const a = [];
    for (let d = 0; d < 6; d++) { const j = this.w.nb[i * 6 + d]; if (j >= 0 && this.open(j)) a.push(j); }
    return a;
  }
}

class Tree {
  constructor(costs, root, cap, stats) {
    this.costs = costs; this.root = root; this.cap = cap; this.stats = stats;
    this.nodes = new Map([[root, { g: 0, t: 0, parent: -1, done: false }]]);
    this.heap = new Heap(); this.heap.push({ i: root, k: 0, t: 0, b: 0 });
    this.touched = new Set([root]); this.maxSettled = 0;
  }
  peek() {
    while (this.heap.size) {
      const q = this.heap.items[0], r = this.nodes.get(q.i);
      if (!r.done && q.k === r.g && q.t === r.t) return q;
      this.heap.pop();
    }
    return null;
  }
  grow(targets, budget) {
    const need = new Set(targets.filter(i => !this.nodes.get(i)?.done));
    let n = 0;
    while (need.size && n < budget && this.nodes.size < this.cap && this.peek()) {
      const q = this.heap.pop(), i = q.i, r = this.nodes.get(i);
      r.done = true; n++; need.delete(i); this.maxSettled = r.g;
      // Finish ALL six relaxations before pausing. The remaining frontier is then a valid distance radius.
      for (let d = 0; d < 6; d++) {
        const j = this.costs.w.nb[i * 6 + d]; if (j < 0) continue;
        this.touched.add(j);
        if (!this.costs.open(j)) continue;
        this.stats.treeRelaxed++;
        const old = this.nodes.get(j), e = this.costs.edge(i, j), g = r.g + e.cost, t = r.t + e.time;
        if (old && (old.done || g > old.g || (g === old.g && t >= old.t))) continue;
        this.nodes.set(j, { g, t, parent: i, done: false });
        this.heap.push({ i: j, k: g, t, b: 0 });
      }
    }
    this.stats.treeSettled += n;
    return n;
  }
  potential(i, radius) { const r = this.nodes.get(i); return r?.done ? Math.min(r.g, radius) : radius; }
  certifiedPath(from, to) {
    // Root-to-endpoint queries can use the tree directly, including every legal doorway of a closed endpoint.
    if (from === this.root || to === this.root) {
      const end = from === this.root ? to : from, ports = this.costs.ports(end);
      if (!ports.length || ports.some(i => !this.nodes.get(i)?.done)) return null;
      let best = null;
      for (const i of ports) {
        const r = this.nodes.get(i), e = i === end ? { cost: 0, time: 0 } : this.costs.edge(i, end);
        const g = r.g + e.cost, t = r.t + e.time;
        if (!best || g < best.g || (g === best.g && t < best.t)) best = { i, g, t };
      }
      const path = end === best.i ? [] : [end];
      for (let i = best.i; i >= 0; i = this.nodes.get(i).parent) path.push(i);
      return from === this.root ? path.reverse() : path;
    }
    // Every subpath of a lexicographic shortest path is itself shortest. Different branches still need A*.
    const a = this.nodes.get(from), b = this.nodes.get(to);
    if (!a?.done || !b?.done || !this.costs.open(from) || !this.costs.open(to)) return null;
    const high = a.g >= b.g ? from : to, low = high === from ? to : from, p = [];
    for (let i = high; i >= 0 && this.nodes.get(i).g >= this.nodes.get(low).g; i = this.nodes.get(i).parent) {
      p.push(i);
      if (i === low) return high === from ? p : p.reverse();
    }
    return null;
  }
  heuristic(goal) {
    const radius = this.peek()?.k ?? this.maxSettled, ports = this.costs.ports(goal);
    const ends = ports.map(i => ({ p: this.potential(i, radius), c: i === goal ? 0 : this.costs.edge(i, goal).cost }));
    return i => {
      if (i === goal || !this.costs.open(i) || !ends.length) return 0;
      const p = this.potential(i, radius);
      // A house can have several entrances. Its root-distance is NOT a legal transit landmark.
      let best = Infinity;
      for (let k = 0; k < ends.length; k++) { const e = ends[k], d = e.c + Math.abs(p - e.p); if (d < best) best = d; }
      return Math.max(0, best - 1e-9);
    };
  }
}

const lexLess = (g, t, h, u) => g < h || (g === h && t < u);

// Lifelong Planning A* with zero heuristic, grown only as far as requests need. g is the stored root distance;
// rhs is the best one-edge lookahead. A changed edge updates its two endpoints; inconsistencies then propagate locally.
// The hex neighbour array supplies both incoming and outgoing edges, so no child-index or full-tree walk is needed.
class RepairTree extends Tree {
  constructor(costs, root, cap, stats) {
    super(costs, root, cap, stats);
    this.nodes.clear(); this.heap = new IndexedHeap(); this.repairUntil = 0;
    this.ensure(root); this.update(root);
  }
  ensure(i) {
    if (this.nodes.has(i)) return true;
    if (this.nodes.size >= this.cap + 6) return false;
    this.nodes.set(i, { g: Infinity, t: Infinity, rhs: Infinity, rt: Infinity, parent: -1, rp: -1, done: false });
    this.touched.add(i);
    for (let d = 0; d < 6; d++) { const j = this.costs.w.nb[i * 6 + d]; if (j >= 0) this.touched.add(j); }
    return true;
  }
  update(i) {
    const r = this.nodes.get(i); if (!r) return;
    this.stats.rhsUpdates++;
    let g = i === this.root ? 0 : Infinity, t = g, parent = -1;
    if (i !== this.root && this.costs.open(i)) for (let d = 0; d < 6; d++) {
      const j = this.costs.w.nb[i * 6 + d]; if (j < 0) continue;
      this.stats.rhsScans++;
      const p = this.nodes.get(j);
      if (!p || p.g === Infinity || !this.costs.open(j)) continue;
      this.stats.treeRelaxed++;
      const e = this.costs.edge(i, j), ng = p.g + e.cost, nt = p.t + e.time;
      if (lexLess(ng, nt, g, t)) { g = ng; t = nt; parent = j; }
    }
    this.setRhs(i, g, t, parent);
  }
  setRhs(i, g, t, parent) {
    const r = this.nodes.get(i);
    r.rhs = g; r.rt = t; r.rp = parent;
    r.done = r.g === g && r.t === t && g < Infinity;
    // An equal-cost replacement parent still needs installing when the old doorway/edge disappears.
    if (r.done) r.parent = parent;
    if (r.g === g && r.t === t) this.heap.remove(i);
    else {
      const lower = lexLess(r.g, r.t, g, t);
      const q = { i, k: lower ? r.g : g, t: lower ? r.t : t, b: 0 }, pos = this.heap.positions.get(i), prior = this.heap.items[pos];
      if (prior && prior.k === q.k && prior.t === q.t) return;
      this.heap.push(q);
      this.stats.queueUpdates++;
    }
  }
  offer(i, via) {
    const r = this.nodes.get(i); if (!r || i === this.root) return;
    this.stats.rhsOffers++;
    const p = this.nodes.get(via);
    let g = Infinity, t = Infinity;
    if (p?.g < Infinity && this.costs.open(i) && this.costs.open(via)) {
      this.stats.treeRelaxed++;
      const e = this.costs.edge(i, via); g = p.g + e.cost; t = p.t + e.time;
    }
    if (lexLess(g, t, r.rhs, r.rt)) this.setRhs(i, g, t, via);
    else if (r.rp === via && (g !== r.rhs || t !== r.rt)) this.update(i);
  }
  peek() { return this.heap.items[0] || null; }
  radius() { return this.peek()?.k ?? Infinity; }
  known(i) { const r = this.nodes.get(i); return !!r?.done && r.g < this.radius(); }
  potential(i, radius) { return Math.min(this.nodes.get(i)?.g ?? Infinity, radius); }
  changed(tile) {
    this.repairUntil = Math.max(this.repairUntil, this.peek()?.k ?? this.maxSettled + 1);
    // A newly opened tile bordering a finite label must enter the queue even if it was never previously traversable.
    if (!this.nodes.has(tile) && this.costs.open(tile)) {
      let supported = false;
      for (let d = 0; d < 6; d++) {
        const j = this.costs.w.nb[tile * 6 + d]; if (this.nodes.get(j)?.g < Infinity) { supported = true; break; }
      }
      if (supported && !this.ensure(tile)) return false; // bounded-memory fallback; never expose an unrepresented shortcut
    }
    this.update(tile);
    for (let d = 0; d < 6; d++) { const j = this.costs.w.nb[tile * 6 + d]; if (j >= 0) this.offer(j, tile); }
    this.stats.repairBatches++;
    return true;
  }
  grow(targets, budget) {
    let n = 0;
    while (n < budget && this.peek() && (this.peek().k < this.repairUntil || targets.some(i => !this.known(i)))) {
      const q = this.peek(), r = this.nodes.get(q.i), lower = lexLess(r.rhs, r.rt, r.g, r.t);
      // A finite label must relax all outgoing edges. Stop before it if that would exceed the bounded record pool.
      let extra = 0;
      if (lower) for (let d = 0; d < 6; d++) {
        const j = this.costs.w.nb[q.i * 6 + d]; if (j >= 0 && this.costs.open(j) && !this.nodes.has(j)) extra++;
      }
      if (this.nodes.size + extra > this.cap + 6) { this.stats.capStops++; break; }
      this.heap.pop(); n++;
      if (q.k < this.repairUntil) this.stats.repairProcessed++;
      if (lower) {
        r.g = r.rhs; r.t = r.rt; r.parent = r.rp; r.done = true;
        this.maxSettled = Math.max(this.maxSettled, r.g);
      } else { r.g = r.t = Infinity; r.parent = -1; r.done = false; this.update(q.i); }
      for (let d = 0; d < 6; d++) {
        const j = this.costs.w.nb[q.i * 6 + d]; if (j < 0) continue;
        if (lower && this.costs.open(j)) this.ensure(j);
        this.offer(j, q.i);
      }
    }
    this.stats.treeSettled += n;
    return n;
  }
  certifiedPath(from, to) {
    if (from === this.root || to === this.root) {
      if (!this.known(this.root) || this.costs.ports(from === this.root ? to : from).some(i => !this.known(i))) return null;
    } else if (!this.known(from) || !this.known(to)) return null;
    return super.certifiedPath(from, to);
  }
}

class TreePool {
  constructor(costs, { cap = 2048, grow = 64, repair = false } = {}) {
    this.costs = costs; this.cap = cap; this.budget = grow; this.repair = repair; this.trees = new Map();
    this.stats = { treeSettled: 0, treeRelaxed: 0, created: 0, invalidations: 0, invalidationChecks: 0, highRecords: 0,
      highFrontier: 0, highTouched: 0, growthMs: 0, invalidationMs: 0, repairBatches: 0, repairProcessed: 0,
      rhsUpdates: 0, rhsOffers: 0, rhsScans: 0, queueUpdates: 0, capStops: 0, capResets: 0, maxBatchProcessed: 0 };
  }
  get(id, root) {
    if (id < 0 || !this.costs.open(root)) return null;
    let t = this.trees.get(id);
    if (!t || t.root !== root) {
      t = this.repair ? new RepairTree(this.costs, root, this.cap, this.stats) : new Tree(this.costs, root, this.cap, this.stats);
      this.trees.set(id, t); this.stats.created++;
    }
    return t;
  }
  grow(tree, targets) {
    if (!tree || !targets.length) return;
    const start = performance.now(), processed = tree.grow(targets.flatMap(i => this.costs.ports(i)), this.budget);
    this.stats.growthMs += performance.now() - start;
    this.stats.maxBatchProcessed = Math.max(this.stats.maxBatchProcessed, processed);
    if (!processed) return; // repeated visits to a known exit do not scan the village pool for telemetry
    let records = 0, frontier = 0, touched = 0;
    for (const t of this.trees.values()) { records += t.nodes.size; frontier += t.heap.size; touched += t.touched.size; }
    this.stats.highRecords = Math.max(this.stats.highRecords, records);
    this.stats.highFrontier = Math.max(this.stats.highFrontier, frontier);
    this.stats.highTouched = Math.max(this.stats.highTouched, touched);
  }
  changed(tile) {
    const start = performance.now();
    this.costs.changed(tile);
    for (const [id, t] of this.trees) {
      this.stats.invalidationChecks++;
      // Every settled vertex's incident edges are protected, including previously blocked neighbours.
      // Changes entirely beyond that boundary cannot improve already settled distances.
      if (t.touched.has(tile)) {
        if (this.repair && this.costs.open(t.root)) {
          if (t.changed(tile)) continue;
          this.stats.capResets++;
        }
        this.trees.delete(id); this.stats.invalidations++;
      }
    }
    this.stats.invalidationMs += performance.now() - start;
  }
}

class Solver {
  constructor(costs, hexSteps, rules) {
    this.costs = costs; this.hexSteps = hexSteps; this.rules = rules;
    const n = costs.w.N;
    this.g = new Float64Array(n); this.time = new Float64Array(n); this.prev = new Int32Array(n);
    this.mark = new Uint32Array(n); this.shut = new Uint32Array(n); this.run = 0;
    this.stats = { queries: 0, settled: 0, relaxed: 0, heuristicCalls: 0, stronger: 0, certified: 0, fallbacks: 0, ms: 0 };
  }
  route(from, to, tree = null, budget = this.rules.ROUTE.reach, prefer = true) {
    const start = performance.now(), path = prefer && tree ? tree.certifiedPath(from, to) : null;
    let result = null;
    if (path) {
      let cost = 0, time = 0;
      for (let k = 1; k < path.length; k++) { const e = this.costs.edge(path[k - 1], path[k]); cost += e.cost; time += e.time; }
      if (time <= budget) { result = { path, cost, time, physicalFallback: false }; this.stats.certified++; }
    }
    if (!result) result = this.search(from, to, tree, budget, prefer);
    this.stats.ms += performance.now() - start; this.stats.queries++;
    return result;
  }
  search(from, to, tree, budget, prefer) {
    const { w } = this.costs, { g, time, prev, mark, shut } = this, run = ++this.run, heap = new Heap();
    const lo = this.rules.ROUTE.minStep, e = this.rules.PATHS.effort;
    const limit = prefer ? budget * (1 + e.weight * (Math.max(e.firm, ...Object.values(e.ground)) - 1 + e.wetExtra)) : budget;
    const geo = i => this.hexSteps(w, i, to) * lo, landmark = prefer && tree ? tree.heuristic(to) : () => 0;
    const h = i => { const a = geo(i), b = landmark(i); this.stats.heuristicCalls++; if (b > a) this.stats.stronger++; return Math.max(a, b); };
    const lx = w.hx ? w.hx[to] - w.hx[from] : 0, ly = w.hy ? w.hy[to] - w.hy[from] : 0;
    const off = w.hx ? 1e-3 / ((Math.hypot(lx, ly) || 1) * w.HW) : 0;
    const bias = i => off ? Math.abs((w.hx[i] - w.hx[from]) * ly - (w.hy[i] - w.hy[from]) * lx) * off : 0;
    g[from] = time[from] = 0; prev[from] = -1; mark[from] = run;
    heap.push({ i: from, k: h(from), t: 0, b: 0 });
    while (heap.size) {
      const q = heap.pop(), i = q.i; if (shut[i] === run) continue;
      shut[i] = run; this.stats.settled++;
      if (i === to) {
        if (prefer && time[to] > budget) { this.stats.fallbacks++; return this.search(from, to, null, budget, false); }
        const path = [to]; for (let j = prev[to]; j >= 0; j = prev[j]) path.push(j);
        path.reverse();
        return { path, cost: prefer ? g[to] : path.slice(1).reduce((s, j, k) => s + this.costs.edge(path[k], j).cost, 0), time: time[to], physicalFallback: !prefer };
      }
      for (let d = 0; d < 6; d++) {
        const j = w.nb[i * 6 + d]; if (j < 0 || shut[j] === run || (j !== to && !this.costs.open(j))) continue;
        this.stats.relaxed++;
        const edge = this.costs.edge(i, j), ng = g[i] + (prefer ? edge.cost : edge.time), nt = time[i] + edge.time;
        if (ng > limit || (mark[j] === run && (ng > g[j] || (ng === g[j] && nt >= time[j])))) continue;
        g[j] = ng; time[j] = nt; mark[j] = run; prev[j] = i;
        heap.push({ i: j, k: ng + h(j), t: nt + geo(j), b: bias(j) });
      }
    }
    return null;
  }
}
module.exports = { Heap, IndexedHeap, Costs, Tree, RepairTree, TreePool, Solver };
