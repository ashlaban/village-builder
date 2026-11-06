// Node-only investigation of VB-196. Wrap before importers capture exports; never read clocks in simulation code.
// Times are inclusive and exclusive of nested wrapped calls. Counts and hashes remain comparable with moving-bench.js.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..'), rows = new Map(), stack = [];
let active = false;
const targets = {
  'sim/heirs': ['roundHeirs', 'handOn', 'countDemand', 'refreshRoles'],
  'sim/lifecycle': ['movingRound', 'kinPressure', 'wed'],
  'sim/help': ['fillStores'], 'sim/farmclaims': ['claimFarms'], 'sim/expansion': ['startPlots'],
  'sim/settle': ['settleRound'], 'sim/service': ['takeServants'], 'sim/cottage': ['payOwed'],
  'sim/society': ['refreshPrestige'],
};
function wrap(fn, name) {
  return function (...args) {
    if (!active) return fn.apply(this, args);
    const start = performance.now(); stack.push(0);
    try { return fn.apply(this, args); } finally {
      const ms = performance.now() - start, nested = stack.pop();
      if (stack.length) stack[stack.length - 1] += ms;
      const row = rows.get(name) || { name, calls: 0, totalMs: 0, selfMs: 0, longestMs: 0 };
      row.calls++; row.totalMs += ms; row.selfMs += ms - nested; row.longestMs = Math.max(row.longestMs, ms);
      rows.set(name, row);
    }
  };
}
for (const file of JSON.parse(fs.readFileSync(path.join(root, 'src/manifest.json'), 'utf8'))) {
  require(path.join(root, 'src', file));
  const key = file.slice(0, -3), mod = globalThis.VB[key];
  if (!mod) continue;
  for (const name of targets[key] || []) mod[name] = wrap(mod[name], name);
  if (key === 'sim/heirs') {
    const make = mod.roundHeirs;
    mod.roundHeirs = (...args) => {
      const view = make(...args);
      view.rank = wrap(view.rank, 'cachedRank'); view.invalidate = wrap(view.invalidate, 'invalidateRanks');
      return view;
    };
  }
}
const VB = globalThis.VB, F = require('../tests/lib/fixtures.js');
for (const name of process.argv.slice(2).length ? process.argv.slice(2) : ['small-y40', 'medium-y60']) {
  const fixture = F.loadFixture(name);
  if (!fixture) throw new Error(`${name}: fixture required`);
  const { st } = fixture;
  rows.clear(); VB.resetCounts(); active = true;
  try { VB.sim.movingRound(st); } finally { active = false; }
  const hash = crypto.createHash('sha256').update(JSON.stringify(VB.sim.save(st))).digest('hex');
  console.log(JSON.stringify({ name, households: st.liveHouseholds.length, roundRank: VB.count.heirRank,
    roundPairs: VB.count.roundPairs, saveHash: hash, profile: [...rows.values()].sort((a, b) => b.selfMs - a.selfMs) }));
}
