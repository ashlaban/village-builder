// The profile report (VB-143): milliseconds per system per game day. Nothing is added to src/: this loader requires the manifest modules in
// load.js's order and, right after each registers, wraps the coarse entry points listed in SYSTEMS in a timer, so the modules loaded after it
// destructure the wrapped functions. Time is exclusive (a wrapped call inside another counts for the inner one). Per-pawn steps (moving,
// working) are far too many to time one by one: the agents' step is timed whole, once a step (VB-205), and what is left of Sim.advance (the
// clock's own loops, the calendar's entries outside the named systems) is the remainder, reported as "agents and walking".
// Used by tools/sim.js: `const { load, result } = require('./perf.js')`; `load()` replaces require('../src/load.js').
require('./help.js')(__filename);
const { loadModules } = require('../tests/lib/load.js');
const SYSTEMS = {
  'jobs refresh and matching': { 'sim/jobs': ['refreshJobs', 'takeDay', 'dutyRound', 'lookForWork'] },
  'talk and contacts': { 'sim/relations': ['talkHour'], 'sim/encounters': ['outdoors', 'partners'] },
  'daily life and births': { 'sim/lifecycle': ['dailyLife', 'dailyDeaths'], 'sim/meetings': ['nightCulture'], 'sim/births': ['dailyBirths'] },
  'hunger and meals': { 'sim/hunger': ['feedHousehold', 'spoilGrain'], 'sim/help': ['askFood'] },
  // Slice 1, kin help booked (VB-219): what it added to help, the gift's check (the floor and the allowance) and goodwill's booking,
  // handovers and ends. Help's daily ask and the gift's moves and events (settleGift, help's gift until VB-216) stay in hunger and meals.
  'kin help and goodwill': { 'sim/exchange': ['assessGift'], 'sim/relations': ['book', 'passGoodwill', 'endGoodwill'] },
  'herds': { 'sim/herds': ['herdsDay', 'spring'] },
  'byre': { 'sim/byre': ['byreDay', 'autumnCounts'] },
  'meadows': { 'sim/meadows': ['meadowsSpring', 'meadowsFrost'] },
  'paths and routes': { 'sim/paths': ['fadeWear'], 'sim/routes': ['refreshRoutes'] },
  'trees': { 'sim/forest': ['growTrees'] },
  'the moving round': { 'sim/round': ['roundPhase'] }, // a step: a village's round, or a phase (VB-201, VB-277)
  'meetings': { 'sim/meetings': ['meetingStage'] },
  // VB-205: the agents' six-minute step (walking, working, and who wants work), and the strolls of those the planner found nothing for.
  'agents: walking and working': { 'sim/agents': ['stepAgents'] },
  'agents: idle strolls': { 'sim/pastimes': ['ownTime'] },
};
const now = () => Number(process.hrtime.bigint()) / 1e6;
const acc = {}, stack = []; let active = false;
function timed(f, name, system) {
  const a = acc[system] = acc[system] || { ms: 0, calls: 0, longest: 0, longestName: '' };
  return function (...args) {
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
  const wrap = {};
  for (const [system, mods] of Object.entries(SYSTEMS)) for (const [key, names] of Object.entries(mods)) {
    const group = wrap[key] ||= {};
    for (const name of names) group[name] = (fn) => timed(fn, name, system);
  }
  return loadModules({ wrap });
}
// timeAdvance(Sim, st, hours): advances while timing; returns the wall time of the call in ms.
function timeAdvance(Sim, st, hours) { active = true; const t0 = now(); try { Sim.advance(st, hours); } finally { active = false; } return now() - t0; }
function reset() { for (const a of Object.values(acc)) Object.assign(a, { ms: 0, calls: 0, longest: 0, longestName: '' }); }
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
module.exports = { load, timeAdvance, result, reset };
