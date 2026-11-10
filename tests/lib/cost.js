// Deterministic cost measures. Growth is a target (docs/gates.md, rows 16 and 17): each counter's ratio is reported through
// tests/lib/targets.js with its residual and never fails; that every counter is exercised stays a hard check. Timing is diagnostic only.
const assert = require('assert');
const VB = require('../../src/load.js'), Sim = VB.sim, { livingPawnDays } = require('../../tools/counts.js');
const { target } = require('./targets.js');
const LIMITS = { scaling: 1.15, history: 1.25 };
const NAMES = [...Object.keys(VB.COUNTERS), 'roundRank'];

function measure(st, { timed = false } = {}) {
  const from = st.t, steps = [], started = performance.now();
  VB.resetCounts();
  // One explicit round, then 30 days: the window ends before the next scheduled round (autumn day 11).
  const before = VB.count.heirRank;
  Sim.movingRound(st);
  const roundRank = VB.count.heirRank - before;
  for (let d = 0; d < 30; d++) {
    if (!timed) Sim.advance(st, Sim.DAY);
    else for (let s = 0; s < 240; s++) {
      const hour = st.t, start = performance.now();
      Sim.advance(st, 0.1);
      steps.push({ hour, ms: performance.now() - start });
    }
  }
  const pawnDays = livingPawnDays(st, from, st.t, Sim.DAY);
  assert(pawnDays > 0, 'cost fixture must have living pawn-days');
  const work = { ...VB.count, roundRank };
  for (const name of NAMES) assert(Number.isFinite(work[name]) && work[name] >= 0, `invalid work: ${name}`);
  assert(roundRank > 0, 'cost fixture must exercise the moving round');
  return { work, pawnDays, living: pawnDays / 30, steps, ms: performance.now() - started };
}

function growth(early, late, scaling = false) {
  if (scaling) assert(late.living > early.living, 'scaling must increase the living population');
  return Object.fromEntries(NAMES.map((name) => {
    const a = early.work[name], b = late.work[name];
    // An inactive counter passes, but new work with no denominator must fail, including during --update.
    const value = a === 0 ? (b === 0 ? 0 : Infinity) : scaling
      ? (b === 0 ? 0 : Math.log(b / a) / Math.log(late.living / early.living))
      : (b / late.pawnDays) / (a / early.pawnDays);
    return [name, value];
  }));
}

// Reports every counter's growth as a target (at most LIMITS[kind]) and returns the records; never throws for a value out.
function report(kind, values) {
  assert(Object.hasOwn(LIMITS, kind), `unknown cost check: ${kind}`);
  assert.deepStrictEqual(Object.keys(values).sort(), [...NAMES].sort(), 'cost check must cover every counter');
  const where = kind === 'scaling' ? 'tests/scaling.js: exponent of work, 2 to 4 villages'
    : 'tests/history.js: work per living pawn-day, small-y40 over small-y5';
  return NAMES.map((name) => target(`${kind}.${name}`, { where, dir: 'max', target: LIMITS[kind], measured: values[name] }));
}

function timing(label, result) {
  const sorted = [...result.steps].sort((a, b) => a.ms - b.ms), longest = sorted.at(-1);
  const p99 = sorted[Math.ceil(sorted.length * 0.99) - 1];
  console.log(`${label}: ${result.ms.toFixed(1)} ms window (round included); ${sorted.length} six-minute steps;`
    + ` longest ${longest.ms.toFixed(3)} ms, p99 ${p99.ms.toFixed(3)} ms (reported only)`);
  for (const step of sorted.slice(-5).reverse()) {
    console.log(`  hour ${step.hour.toFixed(1)} -> ${(step.hour + 0.1).toFixed(1)}: ${step.ms.toFixed(3)} ms`);
  }
}
module.exports = { measure, growth, report, timing, LIMITS, NAMES };
