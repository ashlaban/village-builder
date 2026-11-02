// The profile report (VB-143): milliseconds per system per game day. Nothing is added to src/: this loader requires the manifest modules in
// load.js's order and, right after each registers, wraps the coarse entry points listed in SYSTEMS in a timer, so the modules loaded after it
// destructure the wrapped functions. Time is exclusive (a wrapped call inside another counts for the inner one). Per-pawn steps (moving,
// working) are far too many to time one by one; they and the loop around them are the remainder of Sim.advance, reported as "agents and walking".
// Used by tools/sim.js: `const { load, result } = require('./perf.js')`; `load()` replaces require('../src/load.js').
const fs = require('fs'), path = require('path');
const SYSTEMS = {
  'jobs refresh and matching': { 'sim/jobs': ['refreshJobs', 'callCooks', 'lookUp', 'planRound'] },
  'talk and contacts': { 'sim/relations': ['talkHour'], 'sim/society': ['noteContacts'] },
  'daily life and births': { 'sim/lifecycle': ['dailyLife'], 'sim/births': ['dailyBirths'] },
  'hunger and meals': { 'sim/hunger': ['feedHousehold', 'spoilGrain'], 'sim/help': ['shareFood'] },
  'herds': { 'sim/herds': ['herdsDay'] },
  'byre': { 'sim/byre': ['byreDay'] },
  'meadows': { 'sim/meadows': ['meadowsDay'] },
  'paths and routes': { 'sim/paths': ['fadeWear'], 'sim/routes': ['refreshRoutes'] },
  'trees': { 'sim/forest': ['growTrees'] },
  'the moving round': { 'sim/lifecycle': ['movingRound'] },
  'meetings': { 'sim/lifecycle': ['holdMeetings'] },
};
const now = () => Number(process.hrtime.bigint()) / 1e6;
const acc = {}, stack = []; let active = false;
function wrap(obj, name, system) {
  const f = obj[name]; if (typeof f !== 'function') throw new Error(`perf: ${name} is not exported`);
  const a = acc[system] = acc[system] || { ms: 0, calls: 0, longest: 0, longestName: '' };
  obj[name] = function (...args) {
    if (!active) return f.apply(this, args);
    const t0 = now(); stack.push(0);
    try { return f.apply(this, args); } finally {
      const total = now() - t0, inner = stack.pop(), self = total - inner;
      if (stack.length) stack[stack.length - 1] += total;
      a.ms += self; a.calls++; if (total > a.longest) { a.longest = total; a.longestName = name; }
    }
  };
}
function load() {
  const root = path.join(__dirname, '..', 'src'), want = new Map();
  for (const [system, mods] of Object.entries(SYSTEMS)) for (const [key, names] of Object.entries(mods)) {
    if (!want.has(key)) want.set(key, []); for (const n of names) want.get(key).push([n, system]);
  }
  for (const f of JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'))) {
    require(path.join(root, f));
    const key = f.slice(0, -3);
    for (const [n, system] of want.get(key) || []) wrap(globalThis.VB[key], n, system);
  }
  return globalThis.VB;
}
// timeAdvance(Sim, st, hours): advances while timing; returns the wall time of the call in ms.
function timeAdvance(Sim, st, hours) { active = true; const t0 = now(); try { Sim.advance(st, hours); } finally { active = false; } return now() - t0; }
function result(totalMs, days) {
  const rows = Object.entries(acc).map(([system, a]) => ({ system, ms: +a.ms.toFixed(1), msPerDay: +(a.ms / days).toFixed(2), share: 0, calls: a.calls,
    longestMs: +a.longest.toFixed(2), longestCall: a.longestName }));
  const inSystems = rows.reduce((s, r) => s + r.ms, 0);
  rows.push({ system: 'agents and walking (the rest of Sim.advance)', ms: +(totalMs - inSystems).toFixed(1), msPerDay: +((totalMs - inSystems) / days).toFixed(2),
    share: 0, calls: 0, longestMs: 0, longestCall: '' });
  for (const r of rows) r.share = +(100 * r.ms / totalMs).toFixed(1);
  rows.sort((a, b) => b.ms - a.ms);
  return { totalMs: +totalMs.toFixed(1), days, msPerDay: +(totalMs / days).toFixed(2), systems: rows };
}
module.exports = { load, timeAdvance, result };
