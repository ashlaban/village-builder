// VB-194: diagnostic measurements only. Run fixtures sequentially in fresh processes; no clocks enter src/.
// Slice plans add their per-system ms/day budgets here, using tools/perf.js system names.
const SYSTEM_BUDGETS = {};
const fs = require('fs'), path = require('path'), os = require('os'), zlib = require('zlib');
const { fork } = require('child_process'), { performance } = require('perf_hooks');
const F = require('../tests/lib/fixtures.js');
const DIR = path.join(F.root, 'docs/bench'), HISTORY = path.join(DIR, 'history.jsonl');
const NAMES = ['medium-y5', 'medium-y60'];
const timed = (fn) => { const start = performance.now(), value = fn(); return { value, ms: performance.now() - start }; };
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b), n = sorted.length;
  return n % 2 ? sorted[n >> 1] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
};
function stepStats(steps) {
  const sorted = [...steps].sort((a, b) => b.ms - a.ms);
  return { longestMs: sorted[0].ms, p99Ms: sorted[sorted.length - Math.ceil(sorted.length * 0.99)].ms,
    longest: sorted.slice(0, 5) };
}
function microbench(VB, st) {
  const routes = VB['sim/routes'], w = st.w;
  // Components guarantee reachability without timing pair selection or failed searches.
  const seen = new Uint8Array(w.N), components = [];
  for (let i = 0; i < w.N; i++) {
    if (seen[i] || !routes.passable(w, i)) continue;
    const tiles = [i]; seen[i] = 1;
    for (let k = 0; k < tiles.length; k++) for (let d = 0; d < 6; d++) {
      const j = w.nb[tiles[k] * 6 + d];
      if (j >= 0 && !seen[j] && routes.passable(w, j)) { seen[j] = 1; tiles.push(j); }
    }
    if (tiles.length > 1) components.push(tiles);
  }
  const pool = components.flatMap((tiles, component) => tiles.map((tile) => ({ tile, component })));
  if (!pool.length) throw new Error('A* benchmark needs reachable tile pairs');
  // Tool-local PRNG never consumes the simulation's streams. Sampling is uniform over passable starts.
  let seed = 7;
  const random = (n) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return Math.floor(seed / 4294967296 * n); };
  const pairs = Array.from({ length: 1000 }, () => {
    const start = pool[random(pool.length)], tiles = components[start.component];
    let to; do { to = tiles[random(tiles.length)]; } while (to === start.tile);
    return [start.tile, to];
  });
  for (const [a, b] of pairs.slice(0, 20)) routes.findRoute(w, a, b, Infinity);
  const before = VB.count.routeExpand;
  const search = timed(() => {
    for (const [a, b] of pairs) if (!routes.findRoute(w, a, b, Infinity)) throw new Error('reachable pair has no route');
  });
  const expanded = VB.count.routeExpand - before;
  const pawn = st.pawns.find((p) => p.alive);
  if (!pawn) throw new Error('Rules benchmark needs a living pawn');
  const Rules = VB['sim/registry'], calls = 1000000;
  for (let i = 0; i < 10000; i++) Rules.value(st, 'death.hazard', pawn);
  const rule = timed(() => { let sum = 0; for (let i = 0; i < calls; i++) sum += Rules.value(st, 'death.hazard', pawn); return sum; });
  return { routeSearches: pairs.length, routeExpanded: expanded, routeUs: search.ms * 1000 / pairs.length,
    routeNsPerExpanded: search.ms * 1e6 / expanded, rule: 'death.hazard', ruleCalls: calls,
    ruleNs: rule.ms * 1e6 / calls, ruleChecksum: rule.value, routeMaxCost: 'unbounded (reachable components)' };
}
function measure(name) {
  // Load wrappers before the fixture loader imports src/load.js and downstream modules capture exports.
  const perf = require('./perf.js'), VB = perf.load(), Sim = VB.sim;
  const fixture = F.loadFixture(name, { fetch: false });
  if (!fixture) return { error: 'missing fixture; run node tools/fixtures.js fetch or make' };
  const { st, stamp, stale } = fixture;
  const movingRoundMs = timed(() => Sim.movingRound(st)).ms;
  const meetingsMs = timed(() => Sim.holdMeetings(st)).ms;
  perf.reset();
  const from = st.t, steps = [], days = 30;
  let totalMs = 0;
  for (let i = 0; i < days * 240; i++) {
    const hour = st.t, ms = perf.timeAdvance(Sim, st, 0.1);
    totalMs += ms; steps.push({ hour, ms });
  }
  const { livingPawnDays } = require('./counts.js'), pawnDays = livingPawnDays(st, from, st.t, Sim.DAY);
  if (!(pawnDays > 0)) throw new Error('fixture window has no living pawn-days');
  const systems = perf.result(totalMs, days).systems;
  // Heap is the used heap immediately after the simulation window, before save and microbench allocations.
  const heapMB = process.memoryUsage().heapUsed / 1e6;
  const save = timed(() => Sim.save(st)), stringify = timed(() => JSON.stringify(save.value));
  const jsonBytes = Buffer.byteLength(stringify.value), gzip = timed(() => zlib.gzipSync(stringify.value));
  const parse = timed(() => JSON.parse(stringify.value));
  // World regeneration is outside the codec budget, as in the page's separate generation phase.
  const it = VB.gen.generate(7, { cols: F.spec(name).cols, rows: F.spec(name).rows });
  let r; while (!(r = it.next()).done);
  const load = timed(() => Sim.load(r.value, parse.value));
  return { stamp, stale, days, from, to: st.t, pawnDays, meanLiving: pawnDays / days,
    msPerDay: totalMs / days, msPerPawnDay: totalMs / pawnDays, ...stepStats(steps),
    movingRoundMs, meetingsMs, heapMB, saveMs: save.ms, stringifyMs: stringify.ms, gzipMs: gzip.ms,
    saveTotalMs: save.ms + stringify.ms + gzip.ms, jsonMB: jsonBytes / 1e6, gzipMB: gzip.value.length / 1e6,
    parseMs: parse.ms, loadMs: load.ms, loadTotalMs: parse.ms + load.ms, systems, micro: microbench(VB, st) };
}
function worker(name) {
  return new Promise((resolve) => {
    const child = fork(__filename, ['--fixture', name], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    let result;
    child.on('message', (data) => { result = data; });
    child.on('error', (e) => resolve({ error: e.message }));
    child.on('exit', (code, signal) => resolve(result || { error: `worker ended (${signal || code})` }));
  });
}
function readHistory(file = HISTORY) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).flatMap((line, i) => {
    try { return [JSON.parse(line)]; } catch { console.log(`bench: ignoring malformed history line ${i + 1}`); return []; }
  });
}
function appendHistory(file, run) {
  const fd = fs.openSync(file, 'a+');
  try {
    const size = fs.fstatSync(fd).size, last = Buffer.alloc(1);
    if (size) fs.readSync(fd, last, 0, 1, size - 1);
    // Preserve an interrupted final entry, but start this result on its own line.
    fs.appendFileSync(fd, (size && last[0] !== 10 ? '\n' : '') + JSON.stringify(run) + '\n');
  } finally { fs.closeSync(fd); }
}
function metrics(run) {
  const out = {};
  for (const [name, f] of Object.entries(run.fixtures)) {
    if (f.error) continue;
    for (const key of ['msPerDay', 'msPerPawnDay', 'longestMs', 'p99Ms', 'movingRoundMs', 'meetingsMs', 'heapMB',
      'saveMs', 'stringifyMs', 'gzipMs', 'saveTotalMs', 'jsonMB', 'gzipMB', 'parseMs', 'loadMs', 'loadTotalMs']) out[`${name}.${key}`] = f[key];
    for (const row of f.systems) out[`${name}.system.${row.system}`] = row.msPerDay;
    for (const key of ['routeUs', 'routeNsPerExpanded', 'ruleNs']) out[`${name}.micro.${key}`] = f.micro[key];
  }
  return out;
}
function flags(run, history) {
  const previous = history.filter((r) => r.schema === run.schema && r.cpu.model === run.cpu.model).slice(-5);
  if (previous.length < 5) return [];
  const values = previous.map(metrics);
  return Object.entries(metrics(run)).flatMap(([key, value]) => {
    const five = values.map((row) => row[key]);
    if (!five.every(Number.isFinite)) return [];
    const mid = median(five);
    return value > 0 && value >= mid * 1.2 ? [{ key, value, median: mid, previous: five }] : [];
  });
}
function budget(run) {
  const early = run.fixtures[NAMES[0]], late = run.fixtures[NAMES[1]];
  const fmt = (v) => Number.isFinite(v) ? v.toFixed(3) : 'unavailable';
  const get = (f, key) => f && !f.error ? f[key] : undefined;
  const rows = [
    ['Mean simulation (ms/day)', '160; ceiling 400', 'msPerDay'],
    ['Longest 6-minute step (ms)', '60', 'longestMs'], ['99th percentile step (ms)', '', 'p99Ms'],
    ['Simulation (ms/living pawn-day)', '', 'msPerPawnDay'],
    ['Moving round, one call (ms)', '60 step limit', 'movingRoundMs'], ['Meetings, one call (ms)', '60 step limit', 'meetingsMs'],
    ['Save + stringify + gzip (ms)', '500', 'saveTotalMs'], ['Parse + load (ms)', '500', 'loadTotalMs'],
    ['JSON (MB)', '', 'jsonMB'], ['Gzip (MB)', '10', 'gzipMB'], ['Heap after window (MB)', '', 'heapMB'],
  ].map(([label, limit, key]) => `| ${label} | ${limit} | ${fmt(get(early, key))} | ${fmt(get(late, key))} |`);
  const ratio = get(late, 'msPerPawnDay') / get(early, 'msPerPawnDay');
  rows.push(`| Cost per living pawn-day / year 5 | ≤1.25× | ${early && !early.error ? '1.000' : 'unavailable'} | ${fmt(ratio)} |`);
  rows.push('| Page frames | Deferred (VB-166) | — | — |');
  const systems = [...new Set(NAMES.flatMap((n) => (run.fixtures[n]?.systems || []).map((r) => r.system)))].sort();
  for (const system of systems) {
    const value = (f) => fmt(f?.systems?.find((r) => r.system === system)?.msPerDay);
    rows.push(`| ${system} (ms/day) | ${SYSTEM_BUDGETS[system] ?? ''} | ${value(early)} | ${value(late)} |`);
  }
  return '# Simulation budget\n\nGenerated by `node tools/bench.js --budget`; do not edit by hand.\n\n'
    + `Measured ${run.date}; commit \`${run.commit}\`${run.dirty ? ' (working tree changes)' : ''}; ${run.node}; ${run.cpu.model} (${run.cpu.cores} cores).\n\n`
    + NAMES.map((name) => {
      const f = run.fixtures[name];
      return f && !f.error ? `${name}: ${f.stale ? '**stale golden hash**' : 'fresh'}, ${f.stamp?.living ?? 'unknown'} starting living,`
        + ` stamp \`${f.stamp?.commit ?? 'unknown'}\`.` : `${name}: unavailable.`;
    }).join('\n\n') + '\n\n'
    + '| Measure | Budget | Year 5 | Year 60 |\n|---|---|---|---|\n' + rows.join('\n')
    + '\n\n30 days, 6-minute calls; exclusive system timings include profiling overhead. Explicit round and meeting calls are outside the daily mean.\n'
    + 'Heap is used heap without forced GC. Save/load totals include the listed codec stages; load excludes world generation and disk IO.\n'
    + 'Fixture stamps, staleness, five longest step hours, codec stages and microbenchmarks are in `history.jsonl`.\n';
}
function report(run) {
  console.log(`bench: ${run.date}, ${run.commit}, ${run.cpu.model}, ${run.node}`);
  for (const [name, f] of Object.entries(run.fixtures)) {
    if (f.error) { console.log(`${name}: UNAVAILABLE ${f.error}`); continue; }
    console.log(`${name}: ${f.stale ? 'STALE' : 'fresh'} stamp ${f.stamp.commit}; ${f.msPerDay.toFixed(2)} ms/day,`
      + ` ${f.msPerPawnDay.toFixed(4)} ms/living pawn-day; mean ${f.meanLiving.toFixed(1)} living`);
    console.log(`  steps: longest ${f.longestMs.toFixed(3)} ms, p99 ${f.p99Ms.toFixed(3)} ms; top five ${JSON.stringify(f.longest)}`);
    console.log(`  moving round ${f.movingRoundMs.toFixed(3)} ms; meetings ${f.meetingsMs.toFixed(3)} ms; heap ${f.heapMB.toFixed(2)} MB`);
    console.log(`  save ${f.saveMs.toFixed(2)}, stringify ${f.stringifyMs.toFixed(2)}, gzip ${f.gzipMs.toFixed(2)} ms;`
      + ` ${f.jsonMB.toFixed(2)} MB JSON, ${f.gzipMB.toFixed(2)} MB gzip; parse ${f.parseMs.toFixed(2)}, load ${f.loadMs.toFixed(2)} ms`);
    for (const row of f.systems) console.log(`  ${row.system}: ${row.msPerDay.toFixed(2)} ms/day`);
    console.log(`  A*: ${f.micro.routeUs.toFixed(2)} µs/search, ${f.micro.routeNsPerExpanded.toFixed(2)} ns/expanded tile;`
      + ` Rules.value(${f.micro.rule}): ${f.micro.ruleNs.toFixed(2)} ns/call`);
  }
  for (const flag of run.flags) console.log(`FLAG ${flag.key}: ${flag.value} vs median ${flag.median}; five values ${JSON.stringify(flag.previous)}`);
}
async function runBench({ historyFile = HISTORY, budgetFile = path.join(DIR, 'budget.md') } = {}) {
  const cpus = os.cpus(), run = { schema: 1, date: new Date().toISOString(),
    commit: F.git(['rev-parse', 'HEAD']).toString().trim(), dirty: !!F.git(['status', '--porcelain']).toString().trim(),
    node: process.version, cpu: { model: cpus[0]?.model || 'unknown', cores: cpus.length }, fixtures: {} };
  for (const name of NAMES) run.fixtures[name] = await worker(name);
  run.flags = flags(run, readHistory(historyFile));
  fs.mkdirSync(path.dirname(historyFile), { recursive: true });
  appendHistory(historyFile, run);
  fs.mkdirSync(path.dirname(budgetFile), { recursive: true });
  fs.writeFileSync(budgetFile, budget(run));
  report(run);
  return run;
}
async function main(args) {
  if (args[0] === '--fixture' && NAMES.includes(args[1]) && process.send) {
    try { process.send(measure(args[1])); } catch (e) { process.send({ error: e.stack || e.message }); }
  } else if (args.length === 1 && args[0] === '--budget') {
    const last = readHistory().at(-1);
    if (!last) console.log('bench: no history yet; run node tools/bench.js first');
    else fs.writeFileSync(path.join(DIR, 'budget.md'), budget(last));
  } else if (!args.length) await runBench();
  else console.log('usage: node tools/bench.js [--budget]');
}
// Diagnostic failures are visible in output/history, never a reason to fail a nightly run.
if (require.main === module) main(process.argv.slice(2)).catch((e) => console.error('bench: UNAVAILABLE ' + (e.stack || e.message)));
module.exports = { runBench, measure, microbench, stepStats, median, metrics, flags, budget, readHistory, appendHistory, SYSTEM_BUDGETS };
