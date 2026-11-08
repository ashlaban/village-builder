// VB-198: repeatable cache measurements on a late fixture, without changing the simulation's instrumentation.
// node tools/route-bench.js small-y40 [days=30] [cacheMax override]
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const name = process.argv[2], days = Number(process.argv[3] || 30), max = process.argv[4] === undefined ? null : Number(process.argv[4]);
if (!['small-y40', 'medium-ref'].includes(name) || !Number.isInteger(days) || days < 1
    || (max !== null && (!Number.isInteger(max) || max < 1))) {
  throw new Error('usage: node tools/route-bench.js small-y40|medium-ref [positive integer days] [positive cacheMax override]');
}
const root = path.join(__dirname, '../src');
let refreshMs = 0;
for (const file of JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'))) {
  require(path.join(root, file));
  if (file === 'sim/routes.js') {
    const routes = globalThis.VB['sim/routes'], refresh = routes.refreshRoutes;
    routes.refreshRoutes = (st) => {
      const start = performance.now();
      try { return refresh(st); } finally { refreshMs += performance.now() - start; }
    };
  }
}
const VB = globalThis.VB, Sim = VB.sim, { loadFixture } = require('../tests/lib/fixtures.js');
if (max !== null) VB['sim/rules'].ROUTE.cacheMax = max;
const fixture = loadFixture(name, { fetch: false, notice: (s) => console.error(s) });
if (!fixture) throw new Error(`${name}: missing fixture; fetch it first`);
const { st, stamp, stale } = fixture;
function size() {
  const json = JSON.stringify(Sim.save(st));
  return { entries: st.pathCache.size, cacheMB: Buffer.byteLength(JSON.stringify(VB['sim/saves'].encode(st.pathCache))) / 1e6,
    saveJsonMB: Buffer.byteLength(json) / 1e6, saveGzipMB: zlib.gzipSync(json).length / 1e6 };
}
const hungerBefore = new Map(st.households.map((h) => [h.id, h.hungryDays]));
const before = size(), loadEvictions = VB.count.routeEvict ?? 0;
VB.resetCounts();
const start = performance.now();
for (let day = 0; day < days; day++) Sim.advance(st, Sim.DAY);
const elapsed = performance.now() - start, counts = { ...VB.count };
const report = { fixture: name, stamp: stamp.commit, stale, days, loadEvictions, cacheMax: VB['sim/rules'].ROUTE.cacheMax ?? null, before, after: size(),
  hitRate: counts.routeHit / (counts.routeHit + counts.routeSearch),
  perDay: Object.fromEntries(['routeHit', 'routeSearch', 'routeRefresh', 'routeEvict'].map((key) => [key, (counts[key] ?? 0) / days])),
  refreshMsPerDay: refreshMs / days, simulationMsPerDay: elapsed / days,
  households: st.liveHouseholds.length, living: st.living.length,
  householdHungerDays: st.households.map((h) => ({ id: h.id, days: h.hungryDays - (hungerBefore.get(h.id) ?? 0) })) };
console.log(JSON.stringify(report, null, 2));
