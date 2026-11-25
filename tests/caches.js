// VB-1685: a cache equals its derivation after every command, with no lag (the principles review of 24 November, S1). Each registered
// verb's run is followed, on constructed states, by checkCaches (tests/lib/invariants.js), which compares each declared cache (src/owners.json,
// category cache) with a fresh derivation: the verbs the runs issue themselves, then each verb not yet carried tried by hand. Statically, a
// `...Changed(` notification must not come before the write it reports in its function (tests/lint-rules.js, notedBefore).
const assert = require('assert'), fs = require('fs'), path = require('path');
const EVERY = 40; // a verb's first EVERY runs are each checked, then every EVERY-th (work and talk run thousands of times)
const failures = [], carried = new Map();
let checking = null, batched = 0; // the check, set once the modules are loaded; the depth of sim/crowding's batch
const VB = require('./lib/load.js').loadModules({ wrap: {
  'sim/commands': {
    register: (register) => (verb, V) => register(verb, { ...V, run: (st, cmd) => {
      const ref = V.run(st, cmd), n = (carried.get(verb) || 0) + 1;
      carried.set(verb, n);
      if (checking && (n <= EVERY || n % EVERY === 0)) checking(st, `${verb} (${cmd.source})`);
      return ref;
    } }),
  },
  // A batch of the round's moves (VB-1380) sums the crowding of each household and applies it once at its end, within one synchronous
  // call: crowding is compared at the batch's end, not inside it.
  'sim/crowding': {
    batch: (batch) => (st, fn) => {
      batched++;
      try { return batch(st, fn); } finally { if (--batched === 0 && checking) checking(st, 'the end of a crowding batch'); }
    },
  },
} });
const { checkCaches, CACHES_UNCOMPARED } = require('./lib/invariants.js'), { notedBefore } = require('./lint-rules.js');
const { readSource } = require('../tools/lib/source.js');
const { state, scenario } = require('./lib/probe.js'), Sim = VB.sim, { issue, VERBS, SOURCES } = VB['sim/commands'];
checking = (st, after) => {
  for (const e of checkCaches(st, { crowding: batched === 0 })) if (failures.length < 12) failures.push(`after ${after}: ${e}`);
};

// every declared cache is compared, or named with the reason it is not
const owners = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/owners.json'), 'utf8'));
const declared = [];
(function walk(o) { for (const [k, v] of Object.entries(o)) if (v && typeof v === 'object') v.category === 'cache' ? declared.push(k) : walk(v); })(owners);
const COMPARED = ['st.owner', 'st.crowd', 'st.crowdN', 'st.followers', 'st.living', 'st.liveHouseholds', 'st.graph', 'st.liveTrusts', 'st.courtships',
  'st.obligationsDue', 'st.obligationsBy', 'st.askingBy', 'agent.away', 'pawn.household', 'household.members', 'pawn.role'];
assert.deepStrictEqual(declared.filter((k) => !COMPARED.includes(k) && !CACHES_UNCOMPARED[k]), [], 'a declared cache neither compared nor excused');
assert.deepStrictEqual([...COMPARED, ...Object.keys(CACHES_UNCOMPARED)].filter((k) => !declared.includes(k)), [], 'a cache listed that src/owners.json does not declare');

// the runs: the probe village and the founders, each 45 days (the first gathering, ale, claims, a household founded, lodging)
const runs = [state(), scenario('founders', 7)];
for (const st of runs) Sim.advance(st, 45 * Sim.DAY);
const natural = carried.size;
// each verb not yet carried, by hand: an actor, a target of each kind and the verb's sources, until its check lets one by
for (const verb of Object.keys(VERBS).filter((v) => !carried.has(v))) {
  for (const st of runs) {
    const actors = st.living.slice(0, 10), hhs = st.liveHouseholds.slice(0, 5), tiles = st.farmsteads.slice(0, 3).map((f) => f.house);
    const targets = [undefined, null, ...hhs, ...actors, ...tiles, ...st.villages.map((v) => v.id), ...hhs.map((id) => ({ type: 'household', id }))];
    for (const source of VERBS[verb].sources || SOURCES) for (const actor of actors) for (const target of targets) {
      if (carried.has(verb)) break;
      try { issue(st, { actor, verb, target, args: {}, source }); } catch { /* a check that reads args it was not given: not carried */ }
    }
  }
}
assert.deepStrictEqual(failures, [], 'a cache differs from its derivation after a verb');
// The verbs these states do not reach yet, each needing a command built for it (an offer to answer, a plan, a booth, a trust; VB-1703).
// The list only shrinks: a verb carried here is struck from it, a new verb is carried or added.
const NOT_YET = ['answer', 'claim', 'letIn', 'placeFarmstead', 'callWorkday', 'blaze', 'lodge', 'comeHome', 'call', 'goGathering', 'stayHome', 'swap',
  'target', 'tile', 'order', 'letField', 'dropProject', 'sowOutOfTurn', 'courses', 'dayOrder', 'dayGive', 'dayCall', 'handOn', 'move', 'plotToVillage',
  'beginCottage', 'goBack', 'goToKin', 'visit', 'sendVisit', 'foundHousehold', 'finishCottage', 'decide', 'argue', 'dropCause', 'rally', 'leave', 'takeUp',
  'renounce', 'marry', 'skip', 'slander'];
const missed = Object.keys(VERBS).filter((v) => !carried.has(v));
assert.deepStrictEqual(missed.filter((v) => !NOT_YET.includes(v)), [], 'a verb neither carried nor listed in NOT_YET');
assert.deepStrictEqual(NOT_YET.filter((v) => carried.has(v) || !VERBS[v]), [], 'carried now, or no longer a verb: strike it from NOT_YET');

// statically: no notification of a change before the write it reports, in src/
const early = [];
for (const dir of ['src/sim', 'src/world', 'src/draw']) {
  const abs = path.join(__dirname, '..', dir);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs).filter((x) => /\.(js|ts)$/.test(x))) early.push(...notedBefore(readSource(`${dir}/${f}`)).map((e) => `${dir}/${f}:${e}`));
}
assert.deepStrictEqual(early, [], 'a ...Changed( notification before the write it reports');
for (const [bad, src] of [[1, 'function f(st, t) { costChanged(st, t); st.w.dev[t] = 3; }'], [1, 'const g = (st, t) => { if (x) { costChanged(st, t); } w.dev[t] += 1; };'],
  [0, 'function f(st, t) { st.w.dev[t] = 3; costChanged(st, t); }'], [0, 'function f(st, t) { costChanged(st, t); st.w.dev[u] = 3; }'],
  [0, 'function f(st, t) { costChanged(st, t); const h = () => { st.w.dev[t] = 1; }; }'], [0, 'function f(st, t) { if (a) { costChanged(st, t); return; } w.dev[t] = 2; }'],
  [1, 'function f(st, t) { if (a) { costChanged(st, t); } w.dev[t] = 2; return; }'], [1, 'function f(st, w, t) { costChanged(st, t); setBiome(w, t, B.MEADOW); }'],
  [0, 'function f(st, w, t) { setBiome(w, t, B.MEADOW); costChanged(st, t); setOwner(st, u, null); }'], [0, 'function costChanged(st, t) { st.x[t] = 1; }']])
  assert.strictEqual(notedBefore(src).length, bad, `notedBefore on: ${src}`);
console.log(`caches ok: ${declared.length} declared caches (${COMPARED.length} compared), after ${Object.keys(VERBS).length - missed.length} of ` +
  `${Object.keys(VERBS).length} verbs (${natural} issued by the runs); no notification before its write`);
