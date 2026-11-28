// @suite fast
// VB-1685: a cache equals its derivation after every command, with no lag (the principles review of 24 November, S1). Each registered
// verb's run is followed, on constructed states, by checkCaches (tests/lib/invariants.js), which compares each declared cache (src/owners.json,
// category cache) with a fresh derivation: the verbs the runs issue themselves, then each verb not yet carried tried by hand. Statically, a
// `...Changed(` notification must not come before the write it reports in its function (tests/lint-rules.js, notedBefore).
const assert = require('assert'), fs = require('fs'), path = require('path');
const EVERY = 40; // a verb's first EVERY runs are each checked, then every EVERY-th (work and talk run thousands of times)
const failures = [], carried = new Map();
let checking = null, batched = 0, depth = 0; // the check, set once the modules are loaded; the depth of sim/crowding's batch; of verbs' runs
const VB = require('./lib/load.js').loadModules({ wrap: {
  'sim/commands': {
    // a verb issued inside another's run (move's walk home, sim/journeys) is checked at the outer verb's end, its run whole
    register: (register) => (verb, V) => register(verb, { ...V, run: (st, cmd) => {
      depth++;
      let ref;
      try { ref = V.run(st, cmd); } finally { depth--; }
      const n = (carried.get(verb) || 0) + 1;
      carried.set(verb, n);
      if (checking && depth === 0 && (n <= EVERY || n % EVERY === 0)) checking(st, `${verb} (${cmd.source})`);
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
  'st.obligationsDue', 'st.obligationsBy', 'st.facilityIdx', 'st.lyingBy', 'st.askingBy', 'agent.away', 'pawn.household', 'household.members', 'pawn.role'];
assert.deepStrictEqual(declared.filter((k) => !COMPARED.includes(k) && !CACHES_UNCOMPARED[k]), [], 'a declared cache neither compared nor excused');
assert.deepStrictEqual([...COMPARED, ...Object.keys(CACHES_UNCOMPARED)].filter((k) => !declared.includes(k)), [], 'a cache listed that src/owners.json does not declare');

// the runs: the probe village and the founders, each 50 days (the first gathering, ale, claims, a household founded, lodging, a cottage
// finished: VB-1775, with the wood as goals the founders' first cottage is roofed after day 45)
// VB-2051: a facility kind of the test's, declared before the first seed seals the registry (as tests/facilities.js does; none is in the
// game yet, VB-361): one stage of no loads, worn and mended as a shed
const Fac = VB['sim/facilities'];
Fac.declare('cacheshed', { name: 'test shed', stages: [{ hours: 2 }], may: () => null, wear: 0.2, upkeep: 10 });
const runs = [state(4), scenario('founders', 7)]; // the probe village at seed 4 (7 before VB-1951 gave the layout its own draws: eight of the verbs found no state to pass there)
for (const st of runs) Sim.advance(st, 50 * Sim.DAY);
const natural = carried.size;
// a loan booked by hand where a run took none, so that `repay` is tried on it (VB-1812: with a held cart walking at its pace the founders
// no longer borrow by day 50); a test's write, through sim/obligations, from the household that holds the most grain to the next
const loans = (st) => (st.obligations || []).filter((o) => o.kind === 'loan');
for (const st of runs) {
  if (loans(st).length) continue;
  const grain = (h) => VB['sim/stores'].grainOf(h);
  const [d, c] = st.liveHouseholds.map((id) => st.households[id]).filter((h) => h.farmstead !== null).sort((x, y) => grain(y) - grain(x));
  if (d && c)
    VB['sim/obligations'].create(st, { kind: 'loan', debtor: { kind: 'household', id: d.id }, creditor: { kind: 'household', id: c.id },
      owes: { rations: 10 }, enforcer: { kind: 'village', id: st.farmsteads[d.farmstead].village }, lent: 10 });
}
// the args a verb is tried with by hand, where {} cannot pass its check: a gift of a little grain (VB-446 moved the draws, and the loans of
// VB-312 that carried it in the run no longer fall in its 45 days)
// VB-1745: a controller's own verbs, the switch left on and a walk home queued, then taken off
const ARGS = { give: [{ good: 'grain', n: 1 }], repay: [{ n: 1 }], auto: [{ on: true }], queue: [{ cmd: { verb: 'goHome' } }], unqueue: [{ i: 0 }] };
// each verb not yet carried, by hand: an actor, a target of each kind and the verb's sources, until its check lets one by
for (const verb of Object.keys(VERBS).filter((v) => !carried.has(v))) {
  for (const st of runs) {
    const actors = st.living.slice(0, 10), hhs = st.liveHouseholds.slice(0, 5), tiles = st.farmsteads.slice(0, 3).map((f) => f.house);
    const targets = [undefined, null, ...hhs, ...actors, ...tiles, ...st.villages.map((v) => v.id), ...hhs.map((id) => ({ type: 'household', id })), ...loans(st).map((o) => o.id)];
    for (const source of VERBS[verb].sources || SOURCES) for (const actor of actors) for (const target of targets) {
      if (carried.has(verb)) break;
      for (const args of ARGS[verb] || [{}]) {
        if (carried.has(verb)) break;
        try { issue(st, { actor, verb, target, args, source }); } catch { /* a check that reads args it was not given: not carried */ }
      }
    }
  }
}
// VB-1703: the verbs the runs and the hand above do not reach, each given the state it needs, built by hand on the runs' states (no month
// is run): an heir away from home asked its inheritance, a booth staked, a site roofed, a levy's days named and broken, a plan's steps.
// Each issues the first of its commands that its check lets by; a test's writes go through the systems' own functions, or age a child.
const { YEAR } = VB['sim/rules'], Stores = VB['sim/stores'], Heirs = VB['sim/heirs'], { heirRanking } = VB['sim/heirranking'];
const first = (st, verb, cmds) => cmds.some((c) => issue(st, { verb, ...c }) === true);
const held = (st) => st.liveHouseholds.map((id) => st.households[id]).filter((h) => h.holder !== null && h.farmstead !== null);
const fill = (st, h, n = 400) => Stores.put(st, h, 'grain', n, 'harvest', { barley: n });
const grow = (st, p) => { p.born = st.t - 20.5 * YEAR; p.age = 20; Heirs.refreshRoles(st); }; // a child made a grown pawn of 20
const levies = (st) => (st.obligations || []).filter((o) => o.kind === 'days' && o.status !== 'forgiven' && o.status !== 'met');
// a holder widowed, its heir grown and in service in another household, played on its own commands: at the holder's death the heir is
// asked its inheritance (an offer to answer); yes takes it up, no renounces it
const inheritance = (st, yes) => {
  for (const h of held(st)) {
    const heir = heirRanking(st, h)[0], other = held(st).find((g) => g.id !== h.id);
    if (heir === undefined || !other || st.pawns[heir].household !== h.id) continue;
    const sp = Sim.spouseOf(st, h.holder);
    if (sp !== null) issue(st, { actor: sp, verb: 'kill', source: 'debug' });
    grow(st, st.pawns[heir]);
    if (issue(st, { actor: heir, verb: 'move', target: other.id, args: { reason: 'service' }, source: 'debug' }) !== true) continue;
    if (heirRanking(st, h)[0] !== heir) continue;
    Sim.inhabit(st, heir);
    Sim.setAuto(st, heir, false);
    const n = st.offers.length;
    issue(st, { actor: h.holder, verb: 'kill', source: 'debug' });
    if (st.offers.length > n) return first(st, 'answer', [{ actor: heir, target: st.offers[st.offers.length - 1].id, args: { yes }, source: 'player' }]);
  }
  return false;
};
{
  const [st] = runs;
  // the round's: a wedding of two grown and single
  const single = (sex) => st.living.map((id) => st.pawns[id]).filter((p) => p.sex === sex && Sim.spouseOf(st, p.id) === null && !Sim.isHolder(st, p.id));
  first(st, 'marry', single('m').flatMap((g) => single('f').map((b) => ({ actor: g.id, target: b.id, args: { home: g.household }, source: 'round' }))));
  inheritance(st, true);
  inheritance(st, false);
  const hs = held(st);
  for (const h of hs) fill(st, h);
  first(st, 'lodge', hs.flatMap((h) => h.members.map((m) => ({ actor: m, target: st.farmsteads[h.farmstead].house, args: { why: 'work', days: 1 }, source: 'pawn' }))));
  first(st, 'comeHome', st.living.filter((id) => st.agents[id].away !== undefined).map((id) => ({ actor: id, source: 'player' })));
  const talker = st.living.find((id) => st.pawns[id].age >= 16);
  first(st, 'slander', st.living.map((id) => ({ actor: talker, target: id, args: { kind: VB['sim/stories'].TALES[0] }, source: 'player' })));
  // a booth staked by a head near its house, and a pawn of another household let in
  const h0 = hs[0], house = st.farmsteads[h0.farmstead].house, bid = st.boothSeq;
  first(st, 'raiseBooth', Array.from({ length: 80 }, (_, k) => ({ actor: h0.holder, target: house - 40 + k, source: 'pawn' })));
  first(st, 'letIn', st.living.map((m) => ({ actor: h0.holder, target: bid, args: { pawn: m }, source: 'pawn' })));
  // a levy's days: another adult sent, a day bought off, a day lent, a day broken and forgiven
  for (const o of levies(st)) fill(st, st.households[o.debtor.id]);
  const named = levies(st).filter((o) => o.named.length), debtor = (o) => st.households[o.debtor.id];
  first(st, 'substitute', named.flatMap((o) => debtor(o).members.map((m) => ({ actor: debtor(o).holder, target: o.id, args: { day: o.named[0].day, pawn: m }, source: 'player' }))));
  first(st, 'commute', named.map((o) => ({ actor: debtor(o).holder, target: o.id, args: { day: o.named[o.named.length - 1].day }, source: 'player' })));
  first(st, 'breach', named.map((o) => ({ actor: debtor(o).holder, args: { levy: o.id, day: o.named[0].day }, source: 'player' })));
  first(st, 'forgive', levies(st).filter((o) => o.breaches.length).map((o) => ({ actor: st.households[o.creditor.id].holder, target: o.id, args: { day: o.breaches[0].day }, source: 'player' })));
  // a child grown to settle: its site staked on open ground, worked and roofed as if done (tests/lib/settled.js), then left for
  const settler = st.living.map((id) => st.pawns[id]).find((p) => p.age < 14 && p.household !== null);
  grow(st, settler);
  fill(st, st.households[settler.household], 2000);
  const open = [];
  for (let t = 0; t < st.w.N && open.length < 2; t += 37) if (!st.w.water[t] && !st.w.river[t] && !st.used.has(t) && st.w.trees[t] === 0) open.push(t);
  const lent = levies(st).find((o) => o.named.length), village = st.farmsteads[st.households[lent.debtor.id].farmstead].village;
  require('./lib/settled.js')(VB, st, settler.id, { from: Sim.settlementIdOf(st, settler), party: { all: [settler.id], followers: [] }, house: open[0], field: open[1], village });
  // a levy's day lent by its levier to the settler's new household, of the levied's village
  first(st, 'transfer', levies(st).filter((o) => o.named.length).flatMap((o) => st.liveHouseholds.map((to) => ({ actor: st.households[o.creditor.id].holder, target: o.id, args: { day: o.named[0].day, to }, source: 'player' }))));
  // a farm held in trust by kin: the ward's kin in service in another household (the inheritance renounced above) takes it, and its
  // holder goes back
  const wards = held(st).flatMap((h) => h.members.map((w) => ({ actor: h.holder, target: h.id, args: { ward: w }, source: 'player' })));
  if (first(st, 'goToKin', wards)) first(st, 'goBack', held(st).map((h) => ({ actor: h.holder, target: h.id, source: 'player' })));
}
{
  const [, st] = runs, Customs = VB['sim/customs'], d = Customs.IDX.voice, s0 = st.cenv.settlements[0];
  first(st, 'skip', [{ actor: null, args: { hours: 1 }, source: 'debug' }]);
  // the meeting's verbs: a practice decided, a cause argued and dropped, a fifth rallied
  first(st, 'decide', [{ actor: { settlement: 0 }, args: { dim: d, option: (s0.practice[d] + 1) % Customs.NOPT[d] }, source: 'meeting' }]);
  first(st, 'argue', st.living.map((id) => ({ actor: id, args: { dim: d, option: 0 }, source: 'debug' })));
  first(st, 'dropCause', st.living.filter((id) => st.pawns[id].advocate).map((id) => ({ actor: id, source: 'player' })));
  first(st, 'rally', [{ actor: { settlement: 0 }, args: { dim: d, option: 0 }, source: 'debug' }]);
  // a pawn's own: a trail blazed, a wish, a match let go
  const [a] = st.living, hs = held(st), f0 = st.farmsteads[hs[0].farmstead];
  first(st, 'blaze', st.living.map((id) => ({ actor: id, args: { from: f0.house, to: f0.house + 4 }, source: 'player' })));
  first(st, 'wish', [{ actor: a, target: 'out', args: { value: true }, source: 'player' }]);
  first(st, 'match', [{ actor: a, target: a, args: { partner: null }, source: 'player' }]);
  // the plan's and the day's verbs, by each head of its household
  const D = VB['sim/day'], routines = VB['sim/seasonal'].routinesOf;
  const heads = (f) => held(st).flatMap((h) => f(h, st.farmsteads[h.farmstead], st.plans.households.get(h.id)).map((args) => ({ actor: h.holder, target: h.id, args, source: 'player' })));
  first(st, 'target', heads(() => [{ store: 'hay', n: null }]));
  first(st, 'tile', heads(() => [{ what: 'field', tile: null }]));
  first(st, 'order', heads((h, f, p) => (p && p.season ? [{ steps: [...routines(p)].reverse() }] : [])));
  first(st, 'dayOrder', heads((h) => h.members.map((member) => ({ member, from: 0, to: 1 }))));
  first(st, 'call', heads((h) => h.members.map((member) => ({ member }))));
  first(st, 'assign', heads((h) => h.members.flatMap((to) => [...D.dutyTypes().keys()].map((duty) => ({ duty, to })))));
  first(st, 'sowOutOfTurn', heads((h, f) => f.fields.flatMap((x) => ['barley', 'rye', 'oats'].map((crop) => ({ tile: x.tile, crop })))));
  first(st, 'courses', heads((h, f) => f.fields.flatMap((x) => f.fields.map((y) => ({ a: x.tile, b: y.tile })))));
  first(st, 'letField', heads((h, f) => f.fields.map((fd) => ({ field: fd.id }))));
  // the round's: a farm handed on; a levy's day named by its levied head and lent to a third household of its village
  const villageOf = (h) => st.farmsteads[h.farmstead].village;
  for (const o of levies(st).filter((x) => !x.named.length)) {
    const d0 = st.households[o.debtor.id], days = Array.from({ length: o.window[1] - o.window[0] + 1 }, (_, k) => o.window[0] + k);
    if (!first(st, 'name', days.map((day) => ({ actor: d0.holder, target: o.id, args: { day, pawn: null }, source: 'player' })))) continue;
    const to = held(st).filter((h) => h.id !== d0.id && h.id !== o.creditor.id && villageOf(h) === villageOf(d0));
    if (first(st, 'transfer', to.map((h) => ({ actor: st.households[o.creditor.id].holder, target: o.id, args: { day: o.named[0].day, to: h.id }, source: 'player' })))) break;
  }
  first(st, 'handOn', held(st).flatMap((h) => heirRanking(st, h).slice(0, 1).map((heir) => ({ actor: h.holder, target: heir, args: { household: h.id, reason: 'retirement' }, source: 'round' }))));
  // a farm for the heir begun by its head (the making heirFarm), then given up to the village
  const plots = (h) => VB['sim/projects'].projectsOf(st, 'household', h.id).filter((p) => p.what === 'plot');
  first(st, 'project', heads((h) => h.members.map((heir) => ({ what: 'heirFarm', heir }))));
  first(st, 'plotToVillage', held(st).flatMap((h) => plots(h).map((p) => ({ actor: h.holder, target: h.id, args: { plan: p.id }, source: 'player' }))));
  // a household gone: its farm empty, claimed and founded again by the claimant
  const gone = held(st).at(-1), nFarm = gone.farmstead;
  for (const id of [...gone.members]) issue(st, { actor: id, verb: 'kill', source: 'debug' });
  const claimant = st.living.find((id) => st.pawns[id].age >= 18);
  if (first(st, 'claim', [{ actor: claimant, target: nFarm, source: 'round' }]))
    first(st, 'foundHousehold', [{ actor: claimant, target: nFarm, args: { members: [claimant], grain: {} }, source: 'restoration' }]);
}
{
  // the solo settler by hand, landed at a camp (tests/camp.js): its head places the farmstead on the landing
  const st = Sim.seed(require('./lib/tiny.js').tinyWorld(Array.from({ length: 12 }, (_, i) => (i < 2 ? 'F' : '.').repeat(16))), 7, 'solo', null, { hand: true });
  const hh = st.households[0];
  Sim.inhabit(st, hh.holder);
  Sim.setAuto(st, hh.holder, false);
  first(st, 'placeFarmstead', [{ actor: hh.holder, target: st.farmsteads[0].house, source: 'player' }]);
  // VB-2051: its shelter raised, by the job's own end (sim/building's kind shelter); then its head begins the cottage on it
  const f = st.farmsteads[0];
  VB['sim/building'].KINDS.shelter.done(st, { farm: f });
  first(st, 'beginCottage', [{ actor: hh.holder, target: f.house, source: 'player' }]);
}
// VB-2051: the verbs that need a state of their own, each built by hand on a constructed state, no day run (the clock moved only by
// sim/clock's ticking, its steps not taken).
{
  // VB-315: two loans of one household to another defaulted (due now, a harvest missed already: a test's write), the first pressed, the
  // second extended by the creditor's holder
  const [st] = runs, [a, b] = held(st), Ob = VB['sim/obligations'];
  const loan = () => {
    const id = Ob.create(st, { kind: 'loan', debtor: { kind: 'household', id: a.id }, creditor: { kind: 'household', id: b.id }, owes: { rations: 5000 }, due: st.t, lent: 4000 });
    st.obligations[id].missed = 1; // a test's write: one harvest missed
    return id;
  };
  const p = loan(), e = loan();
  Ob.step(st);
  first(st, 'press', [{ actor: b.holder, target: p, source: 'player' }]);
  first(st, 'extend', [{ actor: b.holder, target: e, source: 'player' }]);
}
{
  // a facility founded by a head beside its house, its one stage raised by the job's own end (sim/facilities' kind raisestage), and worn
  // three years by the test's hand on its record (as tests/facilities.js does): its upkeep begun
  const [st] = runs, h = held(st)[0], owner = { type: 'household', id: h.id }, house = st.farmsteads[h.farmstead].house;
  const near = Array.from({ length: 6 }, (_, d) => st.w.nb[house * 6 + d]).filter((t) => t >= 0);
  if (first(st, 'found', near.map((t) => ({ actor: h.holder, target: t, args: { kind: 'cacheshed', owner }, source: 'player' })))) {
    const fac = st.facilities[st.facilities.length - 1];
    Fac.KINDS.raisestage.done(st, { kind: 'raisestage', owner, site: fac.tile });
    fac.condAt = st.t - 3 * YEAR;
    first(st, 'upkeep', [{ actor: h.holder, target: fac.id, source: 'player' }]);
  }
}
{
  // four villages of two farms in a row on open meadow (tests/going.js), at the start of the year: their meetings choose a gathering by the
  // verb and it is settled, so that it is ahead; an adult goes, then stays home
  const { tinyWorld, tinyState } = require('./lib/tiny.js'), Gt = VB['sim/gathering'], { membersOf, age } = VB['sim/records'];
  const { GATHERING, DAY } = VB['sim/rules'];
  const st = tinyState(tinyWorld(Array(12).fill('.'.repeat(110)), { seed: 7 }), [4, 30, 56, 82].map((x) => ({ at: [x, 5], farms: 2, sizes: [6, 5] })), { seed: 2 });
  for (const v of st.villages) Gt.chooseGathering(st, st.cenv.settlements[v.id], true, membersOf(st, v.id));
  Gt.settleGatherings(st);
  const goers = st.living.map((id) => ({ actor: id, source: 'player' }));
  if (first(st, 'goGathering', goers)) first(st, 'stayHome', goers);
  // two dealers of two households, each with a load packed as at its setting out for the gathering (sim/fair's loadUp, on the event
  // gatheringSetOut), called to one meeting on the green and come to it: one swaps from its load for the other's
  const adults = (hh) => hh.members.filter((m) => age(st, st.pawns[m]) >= GATHERING.adult);
  const [ha, hb] = [st.households[0], st.households[1]], [a] = adults(ha), [b] = adults(hb);
  Stores.put(st, ha, 'grain', 900, { kind: 'harvest' }, { barley: 900 });
  Stores.put(st, hb, 'tar', 3, { kind: 'harvest' });
  Stores.put(st, hb, 'hide', 2, { kind: 'harvest' });
  for (const [p, hh] of [[a, ha], [b, hb]]) VB['sim/events'].emit(st, 'gatheringSetOut', { pawn: p, household: hh.id, until: st.t + 4 * DAY });
  const v = st.villages[0], O = VB['sim/occasions'], day = Math.floor(st.t / DAY) * DAY + DAY;
  const o = O.call(st, 'meeting', day, { village: v.id, farm: null, tile: v.center, x: st.w.hx[v.center], y: st.w.hy[v.center] }, [a, b], [0, 0], []);
  for (const p of [a, b]) issue(st, { actor: p, verb: 'attend', target: o.id, source: 'pawn' });
  const goods = VB['sim/fair'].FAIR.goods;
  first(st, 'swap', goods.flatMap((g) => goods.map((t) => ({ actor: a, target: b, args: { gives: { good: g, n: 1 }, wants: { good: t, n: 1 } }, source: 'offer' }))));
}
{
  // three villages in a row, each beyond a day's walk of the next (tests/journeys.js), the clock set to the moving round of autumn: a head
  // sends a grown son of its house on a winter's visit to the nearest, and a grown daughter of the second village plans her own
  const { tinyWorld, tinyState } = require('./lib/tiny.js'), { spouseOf } = VB['sim/records'], { SEASON_DAYS, ASK, DAY } = VB['sim/rules'];
  const st = tinyState(tinyWorld(Array(9).fill('.'.repeat(210)), { seed: 7 }),
    [{ at: [6, 4], farms: 1, sizes: [5] }, { at: [156, 4], farms: 1, sizes: [5] }, { at: [196, 4], farms: 1, sizes: [5] }], { seed: 7 });
  const grown = (hh, sex, years) => {
    const p = st.pawns[hh.members.find((k) => k !== hh.holder && spouseOf(st, k) === null)];
    p.sex = sex;
    p.born = st.t - (years + 0.5) * YEAR;
    p.age = years;
    return p.id;
  };
  const [man, woman] = [grown(st.households[0], 'm', 25), grown(st.households[1], 'f', 22)];
  VB['sim/wishes'].seedAsking(st);
  Heirs.refreshRoles(st);
  for (const hh of st.households) fill(st, hh, 3000);
  VB['sim/clock'].ticking(st, (2 * SEASON_DAYS + ASK.day) * DAY + 11 - st.t, () => {});
  first(st, 'sendVisit', [{ actor: st.households[0].holder, target: man, args: { village: 1 }, source: 'player' }]);
  first(st, 'visit', [0, 2].map((v) => ({ actor: woman, target: v, source: 'player' })));
}
assert.deepStrictEqual(failures, [], 'a cache differs from its derivation after a verb');
// Every verb is carried (VB-2051 struck the last eight). The list only shrinks: a new verb is carried here, or added to it with the reason.
const NOT_YET = [];
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
