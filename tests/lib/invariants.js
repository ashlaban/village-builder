// State invariants: checkState(st) returns a list of violations, each naming the record. A new state field or record gets its checks here.
const { SYSTEMS } = require('../../src/load.js')['sim/rng'];
const { checkRoles } = require('./owner-caches.js');
const checked = new WeakMap(); // the record's length at the last check, by record
// Grain by crop (VB-347): an object of crops of CROPS with seed (Stores.CROP_LIST: not fallow, VB-348), none negative, and the sum the
// readers see (Stores.grainOf) is their sum.
const LOADED = require('../../src/load.js'), CROPS = VB['sim/crops'].CROPS;
function grainBad(g) {
  if (!g || typeof g !== 'object' || Array.isArray(g)) return true;
  let sum = 0;
  for (const c of Object.keys(g)) {
    if (!LOADED['sim/stores'].CROP_LIST.includes(c) || !CROPS[c] || !Number.isFinite(g[c]) || g[c] < -1e-6 || g[c] > 1e6) return true;
    sum += g[c];
  }
  return Math.abs(LOADED['sim/stores'].grainOf({ grain: g }) - sum) > 1e-9 * Math.max(1, sum);
}
function checkState(st) {
  const bad = [], N = st.w.N, tileOk = (i) => Number.isInteger(i) && i >= 0 && i < N;
  // the open step of a household's land project (VB-123: the plan whose open step works under a stake), or null; a cottage's plan or a
  // small construction may stand before it in the list (VB-1411, VB-1414)
  // the staked open steps of household id's project plans (several side by side, VB-1651, VB-1668)
  const projectSteps = (id) => {
    const l = st.plans && st.plans.projects && st.plans.projects.household.get(id), out = [];
    for (const p of l || []) if (p.steps[p.open] && p.steps[p.open].stake) out.push(p.steps[p.open]);
    return out; };
  bad.push(...checkRoles(st, globalThis.VB, { allowAgeLag: true }));
  bad.push(...globalThis.VB['sim/graph'].check(st)); // VB-043: the household caches, holders, lines, unions, cultures and aldermen agree with the membership graph
  for (const [key, expected] of [
    ['living', st.pawns.filter((p) => p.alive).map((p) => p.id)],
    ['liveHouseholds', st.households.filter((h) => !h.dissolved).map((h) => h.id)],
  ]) {
    if (!Array.isArray(st[key]) || st[key].length !== expected.length || st[key].some((id, i) => id !== expected[i])) {
      bad.push(`${key}: live index differs from its source records`);
    }
  }
  // VB-239: the derived fields a save leaves out (sim/saves DERIVED) agree with their sources, as a load rebuilds them: each owner's open
  // jobs (st.jobsBy, an empty set aside) are st.jobs' of that owner in the order posted; the index of the records (st.idx, when built)
  // holds what one built afresh holds (sim/records)
  {
    const D = globalThis.VB['sim/saves'].DERIVED, by = new Map();
    for (const j of st.jobs.values()) {
      const k = `${j.owner.type}:${j.owner.id}`;
      if (!by.has(k)) by.set(k, []);
      by.get(k).push(j.id);
    }
    const held = new Map([...(st.jobsBy || [])].filter(([, s]) => s.size).map(([k, s]) => [k, [...s].map((j) => j.id)]));
    const text = (m) => JSON.stringify([...m].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
    if (!('jobsBy' in D) || text(by) !== text(held)) bad.push('jobsBy: open jobs by owner differ from st.jobs');
    if (st.idx && st.pawns.length) {
      const was = st.idx;
      st.idx = null;
      globalThis.VB['sim/records'].spouseOf(st, st.pawns[0].id); // builds the index afresh
      const fresh = st.idx;
      st.idx = was;
      // holds and lines keep an entry under every holder and line a household or farm has had, and their readers take those still so:
      // compared as those
      const still = { holds: (k, id) => st.households[id].holder === k, lines: (k, id) => st.farmsteads[id].line === k };
      const norm = (m, f) => JSON.stringify([...m].map(([k, v]) => [k, Array.isArray(v) ? v.filter((id) => !f || f(k, id)).sort((a, b) => a - b) : v])
        .filter(([, v]) => !Array.isArray(v) || v.length).sort((a, b) => a[0] - b[0]));
      for (const k of ['children', 'spouse', 'union', 'holds', 'lines']) if (norm(was[k], still[k]) !== norm(fresh[k], still[k])) bad.push(`idx.${k}: differs from the index built afresh`);
      if (JSON.stringify([...was.widowed].sort((a, b) => a - b)) !== JSON.stringify([...fresh.widowed].sort((a, b) => a - b))) bad.push('idx.widowed: differs from the index built afresh');
    }
  }
  // VB-239: no movement of nothing is recorded: no ledger entry or yearly total moves 0
  for (const h of [...st.households, ...st.villages]) {
    const zero = (h.ledger || []).find((e) => e.n === 0) || (h.totals || []).find((e) => e.n === 0 && e.count === 1);
    if (zero) bad.push(`ledger: ${h.center ? 'village' : 'household'} ${h.id} records a movement of nothing (${zero.kind})`);
  }
  // VB-354: the seasons' weather: one or two years, oldest first and consecutive, the last no later than this year (a test that sets the
  // clock jumps past the seasons' draws); at most four seasons each, warmth
  // and wetness in -1 to 1, the thaw a spring day of 0 to 3 and the frost an autumn day of 7 to 11
  {
    const y = globalThis.VB['sim/rules'].cal(st.t).year, ws = st.weather, num = (x) => typeof x === 'number' && x >= -1 && x <= 1;
    if (!Array.isArray(ws) || ws.length < 1 || ws.length > 2 || ws[ws.length - 1].year > y || (ws.length === 2 && ws[0].year !== ws[1].year - 1)
      || ws.some((e) => !Array.isArray(e.seasons) || e.seasons.length > 4 || e.seasons.some((s) => !Array.isArray(s) || s.length !== 2 || !num(s[0]) || !num(s[1]))
        || !Number.isInteger(e.thaw) || e.thaw < 0 || e.thaw > 3 || !Number.isInteger(e.frost) || e.frost < 7 || e.frost > 11)) bad.push(`weather: not this year and the last, each in bounds: ${JSON.stringify(ws)}`);
  }
  // VB-807: the winter's dates: a band each, each band's dates in the order of DATES, at most six, none in a band whose curve stays above
  // the snow's line all winter (its coldest day, in a mild winter as in a hard one, judged by its warmest: a mild one); the queue by hour
  // holding only its bands' dates (a test that sets the clock jumps past the dates' falling)
  if (st.climate) {
    const Cl = globalThis.VB['sim/climate'], { DATES, CLIMATE } = Cl, cl = st.climate;
    if (!Array.isArray(cl.bands) || cl.bands.length !== CLIMATE.bands || !Array.isArray(cl.due)) bad.push('climate: not a band each, or no queue');
    else {
      for (const [b, band] of cl.bands.entries()) {
        const ts = DATES.map((k) => band.dates[k]).filter((t) => t !== null);
        if (ts.length > 6 || ts.some((t, i) => i && t < ts[i - 1])) bad.push(`climate: band ${b}'s dates out of order: ${JSON.stringify(band.dates)}`);
        const coldest = Math.min(...Array.from({ length: 48 }, (_, d) => Cl.temp(band.lat, -1, d)));
        if (ts.length && coldest >= CLIMATE.snow) bad.push(`climate: band ${b} has dates, though its curve never falls to snow`);
        if (!DATES.includes(band.state) && band.state !== 'open') bad.push(`climate: band ${b}'s state ${band.state}`);
      }
      if (cl.due.some((e, i) => (i && e.at < cl.due[i - 1].at) || !cl.bands[e.band] || cl.bands[e.band].dates[e.date] !== e.at))
        bad.push('climate: the queue out of order, or holding a date not its band\'s');
    }
  }
  // VB-313: the ballots kept, the last LOG of them, each a choice among its options
  if (st.decisionLog && (st.decisionLog.length > globalThis.VB['sim/decisions'].LOG
    || st.decisionLog.some((e) => e.chosen !== null && !(e.chosen >= 0 && (!e.support.length || e.chosen < e.support.length))))) bad.push('decisionLog: over its bound, or a choice outside its options');
  // VB-323: the households to check for a missing adult: live ids, no duplicates
  if (!Array.isArray(st.peopleCheck) || new Set(st.peopleCheck).size !== st.peopleCheck.length
    || st.peopleCheck.some((id) => !st.households[id] || st.households[id].dissolved)) bad.push('peopleCheck: not a list of distinct live household ids');
  // VB-766: a household's compiled crowding equals a fresh count of the people within CROWD.steps of its house
  {
    const Cr = globalThis.VB['sim/crowding'];
    for (const id of st.liveHouseholds) {
      const n = Cr.fresh(st, id);
      if (!st.crowdN || st.crowdN[id] !== n || st.crowd[id] !== Cr.factorOf(n)) { bad.push(`crowding: household ${id} holds ${st.crowdN && st.crowdN[id]}, a fresh count gives ${n}`); break; }
    }
  }
  // VB-1481: a pawn holds at most one live household (a marriage hands a farm on before the holder is counted twice)
  {
    const seen = new Map();
    for (const hh of st.households) {
      if (hh.dissolved || hh.holder === null || hh.holder === undefined) continue;
      if (seen.has(hh.holder)) bad.push(`holders: pawn ${hh.holder} holds households ${seen.get(hh.holder)} and ${hh.id}`);
      else seen.set(hh.holder, hh.id);
    }
  }
  // VB-309: farms held in trust: st.liveTrusts the sorted ids of the open records of st.trusts; a live trust's farm and trustee live, its
  // household empty, its holder living with the trustee; no farm held twice
  if (st.trusts || st.liveTrusts) {
    const T = st.trusts || [], L = st.liveTrusts || [], open = T.filter((t) => t.end === null).map((t) => t.id);
    if (T.some((t, i) => t.id !== i) || L.length !== open.length || L.some((id, i) => id !== open[i])) bad.push('trusts: liveTrusts differs from the open records');
    const held = new Set();
    for (const id of L) {
      const t = T[id], hh = st.households[t.household], k = st.households[t.trustee];
      if (!hh || hh.dissolved || !k || k.dissolved) { bad.push(`trust ${id}: its household or its trustee is gone`); continue; }
      if (held.has(t.household)) bad.push(`trust ${id}: household ${t.household} held twice`);
      held.add(t.household);
      if (hh.members.length) bad.push(`trust ${id}: household ${t.household} held in trust has members ${hh.members.join(', ')}`);
      const p = st.pawns[hh.holder];
      if (!p || !p.alive || p.household !== t.trustee) bad.push(`trust ${id}: holder ${hh.holder} does not live with the trustee ${t.trustee}`);
      if (t.ward !== null && t.ward !== hh.holder) bad.push(`trust ${id}: ward ${t.ward} is not the holder`);
    }
  }
  // VB-310: obligations: ids are indexes; a live one's parties exist; delivered at most what is owed, and all of it only when met; the
  // due-queue holds exactly the running ones (open, part), by due then id, none past due by a year; the parties' lists exactly the live ones
  if (st.obligations || st.obligationsDue || st.obligationsBy) {
    const O = globalThis.VB['sim/obligations'], all = st.obligations || [], STATUS = ['open', 'part', 'overdue', 'met', 'forgiven', 'lapsed', 'defaulted'];
    const exists = (x) => !!x && (x.kind === 'pawn' ? !!st.pawns[x.id] : x.kind === 'household' ? !!st.households[x.id] : x.kind === 'village' ? !!st.villages[x.id] : false);
    all.forEach((o, i) => {
      const at = `obligation ${i}`, n = o.owes && (o.owes.rations !== undefined ? o.owes.rations : o.owes.days !== undefined ? o.owes.days : o.owes.hours);
      if (o.id !== i) bad.push(`${at}: id ${o.id}`);
      if (!O.KINDS[o.kind] || !STATUS.includes(o.status)) bad.push(`${at}: kind ${o.kind}, status ${o.status}`);
      if (!(n > 0) || !(o.delivered >= 0) || o.delivered > n + 1e-9) bad.push(`${at}: delivered ${o.delivered} of ${n}`);
      if ((o.status === 'met') !== (o.delivered >= n - 1e-9)) bad.push(`${at}: ${o.status} with ${o.delivered} of ${n} delivered`);
      if (o.kind === 'days') {
        // VB-462: days owed: a source, and called days that are whole, not more than are left, and none once closed
        if (!['debt', 'keep', 'patron'].includes(o.source)) bad.push(`${at}: source ${o.source}`);
        if (!Number.isInteger(o.called) || o.called < 0 || (['met', 'forgiven', 'lapsed', 'defaulted'].includes(o.status) ? false : o.called > Math.ceil(n - o.delivered - 1e-9) + 1)) bad.push(`${at}: called ${o.called} of ${n - o.delivered} left`);
      }
      if (o.status === 'open' && o.delivered > 0 && o.kind !== 'days') bad.push(`${at}: open with ${o.delivered} delivered`);
      // VB-637: a servant's wage is owed by a household to a pawn, in rations, its master's village the enforcer
      if (o.kind === 'wage' && (o.debtor.kind !== 'household' || o.creditor.kind !== 'pawn' || o.owes.rations === undefined || !o.enforcer || o.enforcer.kind !== 'village'))
        bad.push(`${at}: a wage of ${JSON.stringify([o.debtor, o.creditor, o.owes, o.enforcer])}`);
      if (!(o.since <= st.t) || !Number.isFinite(o.due)) bad.push(`${at}: since ${o.since}, due ${o.due}`);
      if (['open', 'part', 'overdue'].includes(o.status) && !(exists(o.debtor) && exists(o.creditor) && (o.enforcer === null || exists(o.enforcer))))
        bad.push(`${at}: a party of it does not exist (${JSON.stringify([o.debtor, o.creditor, o.enforcer])})`);
    });
    for (const [day, pawn, oid] of st.daysCalls || []) {
      const o = all[oid];
      if (!o || o.kind !== 'days' || !st.pawns[pawn] || !Number.isInteger(day)) bad.push(`daysCalls: [${day}, ${pawn}, ${oid}]`);
    }
    // VB-470: today's lent hands, each a living pawn lent to another live household, its hours worked within those given
    if (st.handsToday) {
      const d = st.handsToday;
      if (!Number.isInteger(d.day) || !Array.isArray(d.asked)) bad.push(`handsToday: ${JSON.stringify(d).slice(0, 80)}`);
      for (const [id, e] of Object.entries(d.by || {})) {
        const p = st.pawns[id], hh = st.households[e[0]];
        if (!p || !hh || p.household === e[0] || !(e[1] > 0) || !(e[2] >= 0) || (e[3] !== 0 && e[3] !== 1) || (!e[3] && e[2] > e[1] + 1))
          bad.push(`handsToday: pawn ${id} lent ${JSON.stringify(e)}`);
      }
    }
    // VB-1555: today's leaves, each a pawn's, from an hour before the end of the working day it ends at; a pawn's days of its own ask and
    // its last visit are whole game days, none in the future
    if (st.leaves) {
      const d = st.leaves;
      if (!Number.isInteger(d.day) || !d.by || typeof d.by !== 'object') bad.push(`leaves: ${JSON.stringify(d).slice(0, 80)}`);
      for (const [id, e] of Object.entries(d.by || {}))
        if (!st.pawns[id] || !Array.isArray(e) || !(e[0] < e[1]) || e[1] > (d.day + 1) * 24 || (e[2] !== 0 && e[2] !== 1) || (e[3] !== null && !st.pawns[e[3]]))
          bad.push(`leaves: pawn ${id} ${JSON.stringify(e)}`);
    }
    for (const p of st.pawns)
      for (const f of ['voiced', 'sat'])
        if (p[f] !== undefined && p[f] !== null && !(Number.isInteger(p[f]) && p[f] >= 0 && p[f] <= Math.floor(st.t / 24))) bad.push(`pawn ${p.id}.${f}: ${p[f]}`);
    if (st.daysCalls && st.daysCalls.some((c, i) => i && (st.daysCalls[i - 1][0] > c[0] || (st.daysCalls[i - 1][0] === c[0] && st.daysCalls[i - 1][1] > c[1])))) bad.push('daysCalls: not sorted');
    const made = O.rebuilt(st);
    if (JSON.stringify(made.due) !== JSON.stringify(st.obligationsDue)) bad.push(`obligations: the due-queue ${JSON.stringify(st.obligationsDue)} is not the running ones ${JSON.stringify(made.due)}`);
    for (const as of ['debtor', 'creditor']) {
      const have = st.obligationsBy ? st.obligationsBy[as] : {}, keys = Object.keys(made.by[as]).sort();
      if (JSON.stringify(Object.keys(have).sort()) !== JSON.stringify(keys) || keys.some((k) => JSON.stringify(have[k]) !== JSON.stringify(made.by[as][k])))
        bad.push(`obligations: the ${as}s' lists differ from the live records`);
    }
  }
  // VB-637: a stake (shares paid out, a servant's wages) is grain of no crop held by its pawn where it lives: a finite number >= 0, and a
  // living pawn's lies with it in a household or on its way to one (its pawn has a household)
  for (const p of st.pawns) {
    if (p.stake === undefined) continue;
    if (!Number.isFinite(p.stake) || p.stake < -1e-9) bad.push(`pawns[${p.id}]: stake ${p.stake}`);
    else if (p.alive && p.stake > 1e-9 && p.household === null) bad.push(`pawns[${p.id}]: a stake of ${p.stake} with no household to lie in`);
  }
  // the clock (VB-235): st.tick, a non-negative whole count of 6-minute steps, is its source of truth; st.t is it in hours, whole steps
  // only (VB-244: the page keeps the part of a step)
  const TICKS = globalThis.VB['sim/rules'].TICKS;
  if (!Number.isInteger(st.tick) || st.tick < 0) bad.push(`tick: ${st.tick} is not a non-negative integer`);
  else if (st.t !== st.tick / TICKS) bad.push(`t: ${st.t} is not tick ${st.tick} / ${TICKS}`);
  if ('tickPart' in st) bad.push('tickPart: the field was dropped (VB-285)');
  // the standing plans (VB-258): exactly one per undissolved household and per village, none of a dissolved household
  if (st.plans) {
    for (const [type, map, live] of [['household', st.plans.households, st.liveHouseholds], ['village', st.plans.villages, st.villages.map((v) => v.id)]]) {
      if (!(map instanceof Map) || map.size !== live.length) { bad.push(`plans: ${type} plans ${map && map.size}, live ${type}s ${live.length}`); continue; }
      for (const id of live) {
        const plan = map.get(id);
        if (!plan || plan.kind !== 'standing' || plan.holder.type !== type || plan.holder.id !== id || !Number.isFinite(plan.nextReview)) {
          bad.push(`plans: ${type} ${id} has no standing plan of its own`);
        }
      }
      if (type === 'household') for (const id of map.keys()) if (!st.households[id] ||
        st.households[id].dissolved) bad.push(`plans: dissolved household ${id} keeps a plan`);
      // VB-248: reservations live on a live plan (so none names a plan that is gone), one reason and a count >= 0 for each good the
      // holder can hold; a household's plan has its targets and tiles. (That a reservation never exceeds its holder's stock does not hold
      // for seed yet: the seed reservation is the fields' need, and a household short of grain reserves more than it holds; VB-252.)
      const STORES = globalThis.VB['sim/stores'];
      for (const [id, plan] of map) {
        if (!plan.reserved || !plan.reasons) { bad.push(`plans: ${type} ${id} has no reservations record`); continue; }
        const goods = Object.keys(plan.reserved);
        if (goods.length !== Object.keys(plan.reasons).length) bad.push(`plans: ${type} ${id} reservations and reasons disagree`);
        for (const good of goods) {
          const n = plan.reserved[good];
          if (!(n >= 0) || !Number.isFinite(n) || !STORES.RESERVE.includes(plan.reasons[good]) ||
            (type === 'household' && !STORES.CROP_LIST.some((c) => good === STORES.grainGood(c)) && good !== 'meals')) {
            bad.push(`plans: ${type} ${id} reserves ${n} ${good} for ${plan.reasons[good]}`);
          }
        }
        if (type !== 'household') {
          // VB-257: a village's routines this year: at most MAX_ROUTINES, each a known routine, once; set by the founders, the meeting or a
          // practice of what follows a meeting that did not decide
          const PL = globalThis.VB['sim/plans'], R = plan.routines;
          if (VB['sim/routines'].routinesWhy(R) || !['founded', 'meeting', 'nothing', 'asLastYear'].includes(plan.routinesBy) || !Number.isInteger(plan.routinesYear)
            || (plan.routinesBy === 'nothing' && R.length)) bad.push(`plans: village ${id} has routines ${JSON.stringify(R)} by ${plan.routinesBy}`);
          continue;
        }
        const T = plan.targets;
        if (!T || T.wood.length !== 4 || !T.wood.every((x) => x > 0) || !(T.hayWinters > 0) || !(T.woodSecond >= 0) || !(T.fields >= 0) ||
          !(T.workable >= 0) || !Number.isInteger(plan.tiles?.field) || !Number.isInteger(plan.tiles?.meadow) ||
          plan.reasons['grain/barley'] !== 'seed') {
          bad.push(`plans: household ${id} lacks its targets, tiles or seed reservation`);
        }
        // T.seed > 0: the template's rule 'year.seed' is CROPS.barley.seed and no custom contributes to it; one that took it to 0 would be
        // the one exception (VB-485)
        if (!(T.seed > 0) || !(T.perHand > 0)) bad.push(`plans: household ${id} lacks its seed or fields-per-hand target`);
        // VB-254: the plan's head is its household's holder, since a time not after now, with a bias on each of the four targets within
        // Traits.HEAD.bias of 1 (and hours, VB-476: the lean of the head's estimate, absent in a save made before it, which reads 1);
        // none while the household has no holder
        const H = plan.head, hhH = st.households[id].holder, most = globalThis.VB['sim/traits'].HEAD.bias + 1e-9;
        if (hhH === null || hhH === undefined ? H !== null : !H || H.pawn !== hhH || !(H.since <= st.t) || !H.bias ||
          !['wood,hay,seed,fields,hours', 'wood,hay,seed,fields'].includes(Object.keys(H.bias).join()) || !Object.values(H.bias).every((x) => Math.abs(x - 1) <= most))
          bad.push(`plans: household ${id}'s head ${JSON.stringify(H)} is not its holder ${hhH}'s`);
        // VB-255: the head's projects: its record absent, or its year, its project under way (a live project plan of the household's,
        // with its kind) or none, and the times not after now
        const Ai = plan.aim, CROP_LIST_I = globalThis.VB['sim/stores'].CROP_LIST;
        if (Ai !== undefined && !(Number.isInteger(Ai.year) && typeof Ai.surplus === 'boolean' && typeof Ai.again === 'boolean' &&
          (Ai.trial !== undefined ? Ai.project === null && Ai.what === 'trial' && Ai.since <= st.t && (CROP_LIST_I || []).includes(Ai.trial) // VB-351: a trial, no plan
            : Ai.project === null ? Ai.what === null && Ai.since === null && Ai.shortSince === null
            : globalThis.VB['sim/aims'].KIND.includes(Ai.what) && Ai.since <= st.t && (Ai.shortSince === null || Ai.shortSince <= st.t) &&
              (st.plans.projects.household.get(id) || []).some((q) => q.id === Ai.project))))
          bad.push(`plans: household ${id}'s aim ${JSON.stringify(Ai)}`);
        // VB-678: the head's yearly looks at the small constructions: absent, or the year of its last look at each making with a look,
        // not after this year
        const Wd = plan.weighed, M = globalThis.VB['sim/makings'];
        if (Wd !== undefined && !(Wd && typeof Wd === 'object' && Object.entries(Wd).every(([k, y]) =>
          M.makingOf(k) && M.makingOf(k).look && Number.isInteger(y) && y >= 0 && y <= globalThis.VB['sim/rules'].cal(st.t).year)))
          bad.push(`plans: household ${id}'s looks ${JSON.stringify(Wd)}`);
        // VB-666: the supply outlook, absent before the first review, made not after now; each supply's values finite, from 0 to the
        // frame, its state a known word, its first short season within the frame (null when safe or not needed), its parts at least 0
        const O = plan.outlook, OL = globalThis.VB['sim/outlook'];
        if (O !== undefined) {
          const okNum = (x) => Number.isFinite(x) && x >= 0;
          const okSupply = (s) => s && okNum(s.own) && okNum(s.with) && s.own <= OL.FRAME && s.with <= OL.FRAME &&
            OL.STATES.includes(s.state) && (s.state === 'short' || s.state === 'bad'
              ? Number.isInteger(s.season) && s.season >= 0 && s.season < OL.FRAME : s.season === null) &&
            okNum(s.parts.store) && s.parts.need.length === OL.FRAME && s.parts.need.every(okNum) && okNum(s.parts.spoilt) &&
            s.parts.intakes.every((x) => okNum(x.n) && x.season >= 0 && x.season < OL.FRAME) &&
            // VB-669: the head's doubt, low at most the centre at most the high, on the frame (absent in an outlook saved before it)
            (s.lo === undefined || (okNum(s.lo) && s.lo <= s.mid && s.mid <= s.hi && s.hi <= OL.FRAME));
          if (!(O.day <= Math.floor(st.t / LOADED['sim/rules'].DAY) && OL.SUPPLIES.every((k) => okSupply(O[k]))))
            bad.push(`plans: household ${id}'s outlook ${JSON.stringify(O)}`);
        }
        // VB-255: a household's plot for its heir is in the index of them, and, once cleared, goes to a pawn: one whose pawn cannot take it
        // has passed to the village (no plot of a household stands with nobody to build it for)
        for (const q of st.plans.projects.household.get(id) || [])
          if (q.what === 'plot' && (!st.plans.projects.heirPlots.includes(q) || q.by !== id || (q.open >= 1 && q.to === null)))
            bad.push(`plans: household ${id}'s plot ${q.id} (by ${q.by}, open ${q.open}, to ${q.to}) is not a plot for its heir under way`);
        // VB-390: a want of a cow names no giver, or another household of the same village (one dissolved since is let go at the next
        // review), a heifer or a cow, by kin or by a deal
        const W = plan.want, villageOf = (h) => st.farmsteads[st.households[h].farmstead].village;
        if (W && (W.what !== 'cow' || (W.from === null ? W.kind !== null || W.by !== null
          : W.from === id || !st.households[W.from] || !['heifer', 'cow'].includes(W.kind) || !['kin', 'deal'].includes(W.by) ||
            (!st.households[W.from].dissolved && villageOf(W.from) !== villageOf(id)))))
          bad.push(`plans: household ${id} wants ${JSON.stringify(W)}`);
        // VB-253: the head's choices, absent until one is made: each target null or within its widest bounds (hay 0 to 3 winters, fields
        // a whole number, wood 0 to twice the winter's goal, a cow 0 or 1), the hold on projects 'none' or null
        const Ch = plan.chosen, in01 = (x, most, whole) => x === null || (Number.isFinite(x) && x >= 0 && x <= most && (!whole || Number.isInteger(x)));
        if (Ch !== undefined && (!Ch || !in01(Ch.hay, 3) || !in01(Ch.fields, Infinity, true) || !in01(Ch.wood, 2 * st.ECON.woodWinter) ||
          !in01(Ch.cow, 1, true) || (Ch.project !== null && Ch.project !== 'none') || Object.keys(Ch).length !== (Ch.goods ? 6 : 5)))
          bad.push(`plans: household ${id}'s head chose ${JSON.stringify(Ch)}`);
        // VB-698: the head's target on each made good, absent before the first review, then one for every made good, none below 0 (Infinity
        // where the maker has no cap of its own), whole where the good is counted whole; a chosen one null or a number from 0, and the
        // compiled target is the choice
        const G = T.goods, MADE = globalThis.VB['sim/targets'].MADE;
        if (G !== undefined && (Object.keys(G).length !== MADE.size ||
          ![...MADE.values()].every((m) => G[m.good] >= 0 && (!m.whole || !Number.isFinite(G[m.good]) || Number.isInteger(G[m.good])))))
          bad.push(`plans: household ${id}'s targets on its goods ${JSON.stringify(G)}`);
        if (Ch && Ch.goods && !Object.entries(Ch.goods).every(([g, n]) => MADE.has(g) && (n === null || (Number.isFinite(n) && n >= 0 && (!G || G[g] === n)))))
          bad.push(`plans: household ${id}'s head chose ${JSON.stringify(Ch.goods)} of its goods`);
        if (Ch && Ch.fields !== null && T.fields > Ch.fields) bad.push(`plans: household ${id} wants ${T.fields} fields over its head's ${Ch.fields}`);
      }
    }
    // VB-252: one seasonal plan per undissolved household, its steps kinds that exist; of the current season once the standing plan has
    // been reviewed in it (a household makes it at its first review of the season, on its planning day), else of an earlier one
    const seasons = st.plans.seasons, KINDS = globalThis.VB['sim/kinds'].KINDS, c = globalThis.VB['sim/rules'].cal(st.t);
    const now = c.year * 4 + c.season, start = c.day - c.sday;
    if (!(seasons instanceof Map) || seasons.size !== st.liveHouseholds.length) {
      bad.push(`plans: ${seasons && seasons.size} seasonal plans, live households ${st.liveHouseholds.length}`);
    } else {
      for (const id of st.liveHouseholds) {
        const sp = seasons.get(id), plan = st.plans.households.get(id);
        if (!sp || sp.kind !== 'season' || sp.holder.type !== 'household' || sp.holder.id !== id || !Array.isArray(sp.steps) ||
          !sp.steps.every((k) => KINDS[k])) {
          bad.push(`plans: household ${id} has no seasonal plan of its own`); continue;
        }
        if (sp.by !== undefined && sp.by !== 'head') bad.push(`plans: household ${id}'s seasonal order is by ${sp.by}`); // VB-253
        const key = sp.year * 4 + sp.season;
        if (key > now || (key !== now && plan && plan.last !== null && plan.last >= start)) {
          bad.push(`plans: household ${id}'s seasonal plan is of year ${sp.year}, season ${sp.season}, not of the current one`);
        }
      }
    }
    // VB-249: the due-queue: sorted by hour, then household, then kind; exactly one entry per live household's plan and time-bound kind,
    // none of a dissolved household (an overdue entry is not checked: tests move the clock by hand, and the next review hour asks it)
    const due = st.plans.due, W = globalThis.VB['sim/plandays'].WINDOWED;
    if (!Array.isArray(due)) bad.push('plans: no due-queue');
    else {
      const seen = new Set();
      for (let i = 0; i < due.length; i++) {
        const e = due[i], prev = due[i - 1];
        if (!Array.isArray(e) || e.length !== 3 || !Number.isInteger(e[0]) || !Number.isInteger(e[2]) || e[2] < 0 || e[2] >= W.length) {
          bad.push(`plans: due entry ${JSON.stringify(e)} is malformed`); continue;
        }
        if (prev && (prev[0] > e[0] ||
          (prev[0] === e[0] && (prev[1] > e[1] || (prev[1] === e[1] && prev[2] >= e[2]))))) bad.push(`plans: due-queue unsorted at ${i}`);
        if (!st.households[e[1]] || st.households[e[1]].dissolved) bad.push(`plans: due entry for dissolved household ${e[1]}`);
        seen.add(`${e[1]}:${e[2]}`);
      }
      if (seen.size !== due.length || due.length !== st.plans.households.size * W.length) {
        bad.push(`plans: due-queue holds ${due.length} entries (${seen.size} distinct) for ${st.plans.households.size} households`);
      }
    }
    for (const q of st.plans.projects.heirPlots || []) // the index of the households' plots holds only those (VB-255)
      if (q.holder.type !== 'household' || q.what !== 'plot' || !(st.plans.projects.household.get(q.holder.id) || []).includes(q))
        bad.push(`plans: plot ${q.id} in the index of the households' plots is no household's`);
    for (const plan of [...st.plans.households.values(), ...st.plans.villages.values()]) {
      if (typeof plan.dirty !== 'boolean' || plan.last === undefined) bad.push(`plans: ${plan.holder.type} ${plan.holder.id} lacks its review record`);
      // VB-466: a household's day, once allotted: the hour it was made, and for pawns of the state a list of task keys, each once
      if (plan.day !== undefined) {
        const d = plan.day, at = `plans: household ${plan.holder.id}'s day`;
        if (plan.holder.type !== 'household' || !d || !Number.isInteger(d.made) || !d.lists || typeof d.lists !== 'object') bad.push(`${at} is not {made, lists}`);
        else for (const [id, list] of Object.entries(d.lists)) {
          if (!st.pawns[id]) bad.push(`${at}: a list for pawn ${id}, which does not exist`);
          if (!Array.isArray(list) || list.some((k) => typeof k !== 'string') || new Set(list).size !== list.length) bad.push(`${at}: pawn ${id}'s list is not task keys, each once`);
          // VB-1558: beside each list its fits (null at the head, then > 0, best first, then < 0, the rest) and the hours given each entry
          const fit = d.fits && d.fits[id];
          if (d.fits && (!Array.isArray(fit) || fit.length !== list.length || fit.some((x) => x !== null && !Number.isFinite(x)))) bad.push(`${at}: pawn ${id}'s fits do not match its list`);
          const hrs = d.hours && d.hours[id];
          if (d.hours && (!Array.isArray(hrs) || hrs.length !== list.length || hrs.some((x) => !(x >= 0)))) bad.push(`${at}: pawn ${id}'s hours do not match its list`);
        }
      }
    }
    // VB-123: project plans: each holder exists (a live household or village, a living pawn), keyed by it; its open step within its steps,
    // each step a kind of sim/kinds on a tile; ids distinct; a finished or dropped plan is gone (no list kept empty); a household has at most
    // one; its reservations are its own (reasons field or build), and what its steps will spend is held in its holder's stock; the store's
    // count (sim/stores, reserved) is the sum of its plans'.
    const P = st.plans.projects, STORES = globalThis.VB['sim/stores'], ids = new Set();
    if (!P || !(P.household instanceof Map) || !(P.village instanceof Map) || !(P.pawn instanceof Map) ||
      !(st.plans.projectSeq >= 0)) bad.push('plans: no project plans record');
    else for (const type of ['household', 'village', 'pawn']) for (const [id, list] of P[type]) {
      const h = (type === 'household' ? st.households : type === 'village' ? st.villages : st.pawns)[id];
      if (!h || h.dissolved) bad.push(`plans: project plans of a ${type} ${id} that is gone`); // a claimant who died: until the round (sim/farmclaims)
      if (!Array.isArray(list) || !list.length) { bad.push(`plans: ${type} ${id} keeps an empty list of project plans`); continue; }
      // no limit on the household's projects (VB-1668), but their jobs' keys never meet (sim/projects landProject): of the plans it
      // posts (not a plot's nor a cottage's), two with steps of a kind in common are not both unmarked `side`; small constructions one
      // of a making (VB-1414)
      if (type === 'household') {
        const posted = list.filter((p) => p.what !== 'plot' && p.what !== 'cottage' && !p.side);
        for (let i = 0; i < posted.length; i++) for (let k = i + 1; k < posted.length; k++)
          if (posted[i].steps.some((x) => posted[k].steps.some((y) => y.kind === x.kind)))
            bad.push(`plans: household ${id}'s ${posted[i].what} and ${posted[k].what} would post jobs of one key`);
      }
      if (type === 'household') for (const p of list) {
        if (p.small && !['cart', 'boat', 'tarpit', 'well', 'loom'].includes(p.what)) bad.push(`plans: household ${id}'s ${p.what} is marked small`);
        if (!p.small && ['cart', 'boat', 'tarpit', 'well'].includes(p.what)) bad.push(`plans: household ${id}'s ${p.what} is not marked small`);
        if (p.small && list.filter((q) => q.what === p.what).length > 1) bad.push(`plans: household ${id} has two ${p.what} plans`);
      }
      if (type === 'household' && list.filter((p) => p.what === 'cottage').length > 1) bad.push(`plans: ${type} ${id} has ${list.length} cottage plans`);
      for (const pl of list) {
        const where = `plans: project ${pl.id} of ${type} ${id}`;
        if (pl.kind !== 'project' || pl.holder.type !== type || pl.holder.id !== id || ids.has(pl.id) ||
          !(pl.id > 0 && pl.id <= st.plans.projectSeq)) bad.push(`${where} is misfiled`);
        ids.add(pl.id);
        if (!Array.isArray(pl.steps) || !pl.steps.length || !Number.isInteger(pl.open) || pl.open < 0 || pl.open >= pl.steps.length) {
          bad.push(`${where}: open step ${pl.open} of ${pl.steps && pl.steps.length}`); continue;
        }
        for (const s of pl.steps) { // a step at one place, or at several (a plot's tiles, each with its own steps; VB-123)
          if (!KINDS[s.kind] ||
            (s.places ? !s.places.every((q) => tileOk(q.tile)) : !tileOk(s.place) || !(s.hours >= 0))) bad.push(`${where}: step ${JSON.stringify(s)}`);
        }
        if (!h || h.dissolved) continue;
        for (const good of Object.keys(pl.reserved)) {
          const n = pl.reserved[good], why = pl.reasons[good];
          if (!(n >= 0) || !['field', 'build'].includes(why)) bad.push(`${where} reserves ${n} ${good} for ${why}`);
          if (why === 'build' && n > (h[good] || 0) + 1e-6) bad.push(`${where} reserves ${n} ${good}, more than its holder's ${h[good] || 0}`);
          const sp = type === 'pawn' ? null : (type === 'household' ? st.plans.households : st.plans.villages).get(id), why0 = sp && sp.reasons[good];
          const own = !why0 ? 0 : why0 === 'seed' ? globalThis.VB['sim/hunger'].seedNeed(st, h, good.split('/')[1]) /* by crop, VB-350 */ : sp.reserved[good];
          const projects = list.reduce((x, q) => x + (q.reasons[good] ? q.reserved[good] : 0), 0);
          if (Math.abs(STORES.reserved(st, h, good) - own - projects) > 1e-6) bad.push(`${where}: the store's count of ${good} is not its plans'`);
        }
        if (Object.keys(pl.reserved).length !== Object.keys(pl.reasons).length) bad.push(`${where}: reservations and reasons disagree`);
      }
    }
    for (const id of st.living) {
      const d = st.pawns[id].diligence;
      if (d !== undefined && !(d >= 0 && d < 1)) bad.push(`pawn ${id}: diligence ${d}`);
    }
  } else bad.push('plans: missing');
  // service is dated (VB-634): servedSince is set exactly when the pawn is a servant
  for (const id of st.living) {
    const p = st.pawns[id];
    if (p.servant !== (typeof p.servedSince === 'number')) bad.push(`pawn ${id}: servant ${p.servant} with servedSince ${p.servedSince}`);
  }
  // a cause is an agenda: the year it was taken up (culture), null or undefined for none yet, and never in the future
  for (const id of st.living) {
    const cs = st.pawns[id].causeSince;
    if (cs !== null && cs !== undefined && !(cs <= st.t / globalThis.VB['sim/rules'].YEAR + 1e-6)) bad.push(`pawn ${id}: causeSince ${cs}`);
  }
  if (!(st.pathCache instanceof Map) || st.pathCache.size > globalThis.VB['sim/routes'].ROUTE.cacheMax) {
    bad.push('pathCache: exceeds ROUTE.cacheMax or is not a Map');
  }
  { // VB-1563: the routes set aside at the day's emptying are bounded as the cache is, their log by ROUTE.keepDays
    const K = st.routeKept, { ROUTE } = globalThis.VB['sim/routes'];
    if (K && (K.routes.size > ROUTE.cacheMax || K.log.length > ROUTE.keepDays)) bad.push('routeKept: over ROUTE.cacheMax or ROUTE.keepDays');
  }
  // VB-1667: a lone farm's village follows its house: a village of one farm and no green has its centre on that farm's house (sim/layout
  // seeds it so, sim/green moves it when the house moves)
  for (const v of st.villages)
    if (!v.green && v.farmsteads.length === 1 && v.center !== st.farmsteads[v.farmsteads[0]].house)
      bad.push(`village ${v.id}: one farm and no green, its centre ${v.center} not the house ${st.farmsteads[v.farmsteads[0]].house}`);
  // the walking hours between villages (VB-286): a row a village, each as long as the villages are many; 0 on the diagonal, symmetric, and
  // every other entry null or a number in (0, ROUTE.reach / SPEED]
  {
    const T = st.villageHours, n = st.villages.length, top = globalThis.VB['sim/routes'].ROUTE.reach / globalThis.VB['sim/rules'].SPEED;
    if (!Array.isArray(T) || T.length !== n) bad.push(`villageHours: ${Array.isArray(T) ? T.length : T} rows for ${n} villages`);
    else for (let v = 0; v < n; v++) {
      if (!Array.isArray(T[v]) || T[v].length !== n) { bad.push(`villageHours[${v}]: not a row of ${n}`); continue; }
      for (let u = 0; u < n; u++) {
        const h = T[v][u];
        if (u === v ? h !== 0 : !(h === null || (typeof h === 'number' && h > 0 && h <= top + 1e-9))) bad.push(`villageHours[${v}][${u}]: ${h}`);
        else if (u > v && Array.isArray(T[u]) &&
          ((h === null) !== (T[u][v] === null) || (h !== null && Math.abs(h - T[u][v]) > 1e-9))) bad.push(`villageHours[${v}][${u}]: not symmetric`);
      }
    }
  }
  // the winter table (VB-808): none, or a row a village as the land table's, 0 on the diagonal, symmetric, every other entry null or a number
  // in (0, WINTER_HOURS]
  if (st.winterHours !== null && st.winterHours !== undefined) {
    const T = st.winterHours, n = st.villages.length, top = globalThis.VB['sim/villagehours'].WINTER_HOURS;
    if (!Array.isArray(T) || T.length !== n) bad.push(`winterHours: ${Array.isArray(T) ? T.length : T} rows for ${n} villages`);
    else for (let v = 0; v < n; v++) {
      if (!Array.isArray(T[v]) || T[v].length !== n) { bad.push(`winterHours[${v}]: not a row of ${n}`); continue; }
      for (let u = 0; u < n; u++) {
        const h = T[v][u];
        if (u === v ? h !== 0 : !(h === null || (typeof h === 'number' && h > 0 && h <= top + 1e-9))) bad.push(`winterHours[${v}][${u}]: ${h}`);
        else if (u > v && Array.isArray(T[u]) && (h === null ? T[u][v] !== null : !(Math.abs(h - T[u][v]) <= 1e-9))) bad.push(`winterHours[${v}][${u}]: not symmetric`);
      }
    }
  }
  // the household charged with a village's tar pit (VB-673): none, or a household that is or was of the world
  for (const v of st.villages)
    if (v.tarBy !== undefined && v.tarBy !== null && !(Number.isInteger(v.tarBy) && st.households[v.tarBy]))
      bad.push(`tar: village ${v.id} charged household ${JSON.stringify(v.tarBy)}`);
  // a village's own rite days (VB-775): three, one in each season's window of RITE.spread days after the season's day
  {
    const R = globalThis.VB['sim/rules'].RITE;
    for (const v of st.villages) {
      if (v.riteDays === undefined) continue;
      if (!Array.isArray(v.riteDays) || v.riteDays.length !== R.days.length
        || v.riteDays.some((d, i) => !Number.isInteger(d) || d < R.days[i][1] || d > R.days[i][1] + R.spread))
        bad.push(`rite days: village ${v.id} has ${JSON.stringify(v.riteDays)}`);
    }
  }
  // the gathering (VB-294): a village's choice names hosts with a green within a day's walk, each once, and offers only with a green; its
  // host has a green, is within a day's walk, and hosts its own gathering of the same winter, which at least GATHERING.least villages
  // attend. That the host was inhabited is checked when it is settled (tests/gathering.js), as a village may empty before the winter.
  {
    // the table of hours is compiled anew each autumn (day 9), so reach is checked for the choice of this year
    const R = globalThis.VB['sim/rules'], year = R.cal(st.t).year, near = (a, b) => a === b || (st.villageHours[a][b] !== null && st.villageHours[a][b] <= R.TRAVEL.dayWalk);
    const size = new Map();
    for (const v of st.villages) {
      const g = v.gathering;
      if (g === undefined || g === null) continue;
      if (!Array.isArray(g.prefs) || new Set(g.prefs).size !== g.prefs.length
        || g.prefs.some((h) => !st.villages[h] || !st.villages[h].green || (g.chosen === year && !near(v.id, h))))
        bad.push(`gathering: village ${v.id} names hosts ${JSON.stringify(g.prefs)}`);
      if (g.hosting && !v.green) bad.push(`gathering: village ${v.id} offers to host with no green`);
      if (!['meeting', 'nothing', 'asLastYear'].includes(g.by)) bad.push(`gathering: village ${v.id} chose by ${g.by}`);
      if (g.host === null) continue;
      const h = st.villages[g.host], hg = h && h.gathering;
      if (!h || !h.green || (g.year === year && !near(v.id, g.host)) || !hg || hg.host !== g.host || hg.year !== g.year)
        bad.push(`gathering: village ${v.id} goes to ${g.host}, not a host within a day's walk`);
      else size.set(g.host, (size.get(g.host) || 0) + 1);
    }
    for (const [h, n] of size) if (n < globalThis.VB['sim/rules'].GATHERING.least) bad.push(`gathering: ${h}'s has ${n} villages`);
  }
  // going to the gathering (VB-295): a household's plan names its own members once each, and its beds are of a host household and only
  // until it has packed; a goer lodged at the gathering waits for a day of it, is home or dead two days after it ends, and sleeps under
  // a host's roof (sim/away's stays, below); and no household has all its living adults lodged at the gathering
  {
    const R = globalThis.VB['sim/rules'], G = R.GATHERING, ageOf = (p) => Math.floor((st.t - p.born) / R.YEAR);
    const lodged = new Set();
    for (const s of st.away || []) if (s.why === 'gathering' && s.bed !== null && !s.back) lodged.add(s.pawn);
    for (const hh of st.households) {
      const g = hh.gathering;
      if (g === undefined) continue;
      if (!Number.isInteger(g.year) || typeof g.planned !== 'boolean' || typeof g.packed !== 'boolean' || !Array.isArray(g.go) || !Array.isArray(g.beds)
        || new Set(g.go).size !== g.go.length || g.go.some((id) => !st.pawns[id]))
        bad.push(`gathering: household ${hh.id}'s plan ${JSON.stringify(g)}`);
      else if (g.beds.some(([id, h, barn]) => !g.go.includes(id) || !st.households[h] || h === hh.id || typeof barn !== 'boolean'))
        bad.push(`gathering: household ${hh.id}'s beds ${JSON.stringify(g.beds)}`);
      if (hh.dissolved || !lodged.size) continue;
      const adults = hh.members.filter((m) => st.pawns[m].alive && ageOf(st.pawns[m]) >= G.adult);
      if (adults.length && adults.every((m) => lodged.has(m))) bad.push(`gathering: household ${hh.id} has every adult lodged at the gathering`);
    }
    for (const s of st.away || [])
      if (s.why === 'gathering' && (s.bed === null || !(s.until > 0) || st.t >= s.until + 2 * R.DAY || (s.roof !== 'house' && s.roof !== 'barn')))
        bad.push(`gathering: a goer's stay ${s.id}: bed ${s.bed}, until ${s.until}, roof ${s.roof}, at ${st.t}`);
  }
  // the fair (VB-302): st.fair.loads names each pawn with a load once, alive; a load holds lots of the fair's goods, n > 0, a grain lot's
  // crops summing to it, within a back load; goods are conserved over a fair: of each good, what was packed less what went home, was laid
  // where a dealer fell and was lost with it is what the loads carry; and no load outlasts its gathering by more than four days
  if (st.fair) {
    const R = globalThis.VB['sim/rules'], F = globalThis.VB['sim/fair'], f = st.fair, onLoad = {};
    if (!Array.isArray(f.loads) || new Set(f.loads).size !== f.loads.length) bad.push(`fair: loads ${JSON.stringify(f.loads)}`);
    for (const id of f.loads || []) {
      const p = st.pawns[id], l = p && p.load;
      if (!p || !p.alive || !l || !st.households[l.household]) { bad.push(`fair: pawn ${id} listed with no load`); continue; }
      if (st.t > l.until + 4 * R.DAY) bad.push(`fair: pawn ${id}'s load outlasts its gathering (until ${l.until}, now ${st.t})`);
      if (F.weight(l) > R.TRAVEL.load + 1e-9) bad.push(`fair: pawn ${id}'s load weighs ${F.weight(l)}`);
      for (const x of l.lots) {
        if (!F.FAIR.goods.includes(x.good) || !(x.n > 0)) bad.push(`fair: pawn ${id}'s lot ${JSON.stringify(x)}`);
        if (x.good === 'grain' && (grainBad(x.parts) || Math.abs(LOADED['sim/stores'].grainOf({ grain: x.parts }) - x.n) > 1e-6 * Math.max(1, x.n))) bad.push(`fair: pawn ${id}'s grain lot ${JSON.stringify(x)} by crop`);
        onLoad[x.good] = (onLoad[x.good] || 0) + x.n;
      }
    }
    for (const p of st.pawns) if (p.load && !(f.loads || []).includes(p.id)) bad.push(`fair: pawn ${p.id} carries a load not listed`);
    for (const g in f.goods) {
      const t = f.goods[g], left = t.packed - t.home - t.laid - t.lost;
      if (Math.abs(left - (onLoad[g] || 0)) > 1e-6 * Math.max(1, t.packed)) bad.push(`fair: ${g} not conserved: ${JSON.stringify(t)}, ${onLoad[g] || 0} on loads`);
    }
  }
  // the record of events (VB-075), the events appended since the last check: a kind, a time not after now, ids that exist
  // (a slot folded since, VB-199, is the index of a count of st.recordYears)
  const from = checked.get(st.record) || 0, Y = st.recordYears || [];
  for (let i = from; i < (st.record || []).length; i++) {
    const e = st.record[i], ids = { pawn: st.pawns, other: st.pawns, household: st.households, farm: st.farmsteads, fromFarm: st.farmsteads, village: st.villages };
    if (typeof e === 'number') { if (!(Number.isInteger(e) && e >= 0 && e < Y.length)) bad.push(`record[${i}]: folded into no count, ${e}`); continue; }
    if (typeof e.kind !== 'string' || !e.kind || !(e.t <= st.t)) bad.push(`record[${i}]: ${JSON.stringify(e)}`);
    if ('self' in e && (e.self !== true || !('pawn' in e))) bad.push(`record[${i}].self: ${JSON.stringify(e)}`);
    for (const [k, list] of Object.entries(ids)) if (k in e &&
      !(Number.isInteger(e[k]) && e[k] >= 0 && e[k] < list.length)) bad.push(`record[${i}].${k}: ${e[k]}`);
  }
  if (st.record) checked.set(st.record, st.record.length);
  // the folded counts (VB-199), those made since the last check: a routine kind, a whole year at least two before now, a village that exists
  // or none, a count of at least one, and one count per kind, village and year; and the fold's positions within the record
  if (st.recordYears) {
    const R = globalThis.VB['sim/records'], YEAR = globalThis.VB['sim/rules'].YEAR, seen = checked.get(Y) || { n: 0, keys: new Set() };
    for (; seen.n < Y.length; seen.n++) {
      const y = Y[seen.n], key = `${y.kind}|${y.village}|${y.year}`;
      if (!(R.HISTORY[y.kind] > 0) || !Number.isInteger(y.year) || y.year > Math.floor(st.t / YEAR) - 2
        || !(Number.isInteger(y.tally) && y.tally >= 1)
        || ('village' in y && !(Number.isInteger(y.village) && y.village >= 0 && y.village < st.villages.length)) || seen.keys.has(key)) {
        bad.push(`recordYears[${seen.n}]: ${JSON.stringify(y)}`);
      }
      seen.keys.add(key);
    }
    checked.set(Y, seen);
    const F = st.recordFold, P = F && F.pass, pos = (x) => Number.isInteger(x) && x >= 0 && x <= st.record.length;
    if (!F || !pos(F.shortAt) || !pos(F.longAt) || (P && !(pos(P.shortEnd) && pos(P.longEnd) && P.shortEnd >= F.shortAt && P.longEnd >= F.longAt
      && P.shortNext >= F.shortAt && P.shortNext <= P.shortEnd && P.longNext >= F.longAt &&
        P.longNext <= P.longEnd))) bad.push(`recordFold: ${JSON.stringify(F)}`);
  }
  // the twelve traits (VB-519): every pawn, living or dead, has the twelve, each finite within TRAITS.bounds; none keeps VB-249's diligence
  // beside them. Its hungry days: a whole number for a child, null once its values have set (tests/traits.js checks when)
  const TR = globalThis.VB['sim/rules'].TRAITS, [lo, hi] = TR.bounds;
  for (const p of st.pawns) {
    const t = p.traits;
    if (!Array.isArray(t) || t.length !== TR.names.length || !t.every((x) => Number.isFinite(x) && x >= lo && x <= hi) || 'diligence' in p)
      bad.push(`pawn ${p.id}: traits ${JSON.stringify(t)}`);
    if (!(p.leanDays === null || (Number.isInteger(p.leanDays) && p.leanDays >= 0))) bad.push(`pawn ${p.id}: leanDays ${p.leanDays}`);
    // a head's bias on each crop's yield (VB-351): absent, or a multiplier for each crop with seed, within SOWING.bias of 1
    if (p.cropBias !== undefined) {
      const CL = globalThis.VB['sim/stores'].CROP_LIST, SB = globalThis.VB['sim/rotations'].SOWING.bias;
      if (!(p.cropBias && Object.keys(p.cropBias).length === CL.length && CL.every((k) => Number.isFinite(p.cropBias[k]) && Math.abs(p.cropBias[k] - 1) <= SB + 1e-9)))
        bad.push(`pawn ${p.id}: cropBias ${JSON.stringify(p.cropBias)}`);
    }
  }
  // skill at each type of work (VB-475; sim/skills): every pawn has one a type, each finite within TRAITS.bounds; a hand's pace over a work
  // leg is absent or within what the slowest and the fastest skill, with the worst and no mishap, give
  // (times a craft's rate, VB-360: from a novice's to a master's); a pawn's crafts (pawn.skills) are absent, or crafts of SKILLS.crafts
  // each with a level within 0 to 1 and the hour it was set, not after now
  const SK = globalThis.VB['sim/skills'], SKS = SK.SKILLS,
    paceLo = SK.paceOf(0, 1) * Math.min(1, SKS.novice) - 1e-3, paceHi = SK.paceOf(1, 0) * Math.max(1, SKS.master) + 1e-3;
  for (const p of st.pawns) {
    const t = p.skill;
    if (!Array.isArray(t) || t.length !== SK.SKILL.types.length || !t.every((x) => Number.isFinite(x) && x >= lo && x <= hi))
      bad.push(`pawn ${p.id}: skill ${JSON.stringify(t)}`);
    const k = p.skills;
    if (k === undefined) continue;
    if (!k || typeof k !== 'object' || Object.entries(k).some(([c, s]) => !SKS.crafts.includes(c) || !s || !(Number.isFinite(s.level) && s.level >= 0 && s.level <= 1) || !(Number.isFinite(s.at) && s.at <= st.t + 1e-9)))
      bad.push(`pawn ${p.id}: skills ${JSON.stringify(k)}`);
  }
  for (const a of st.agents)
    if (a.pace !== undefined && !(Number.isFinite(a.pace) && a.pace >= paceLo && a.pace <= paceHi)) bad.push(`agent ${a.id}: pace ${a.pace}`);
  // a pawn's wish at the moving round (VB-680): absent or null (the default), else a ranking that holds each rung once, a farm that exists
  // or null, a pawn of the other sex or null; a living pawn's is not the default written out
  const RUNGS = globalThis.VB['sim/wishes'].WISH.rungs;
  for (const p of st.pawns) {
    const w = p.wish;
    if (w === undefined || w === null) continue;
    if (!Array.isArray(w.rank) || w.rank.length !== RUNGS.length || RUNGS.some((r) => !w.rank.includes(r))
      || !(w.farm === null || (Number.isInteger(w.farm) && !!st.farmsteads[w.farm]))
      || !(w.partner === null || (Number.isInteger(w.partner) && !!st.pawns[w.partner] && st.pawns[w.partner].sex !== p.sex))
      || (p.alive && w.farm === null && w.partner === null && w.rank.every((r, i) => r === RUNGS[i]))) bad.push(`pawn ${p.id}: wish ${JSON.stringify(w)}`);
  }
  // courting (VB-036; sim/courting): pawn.courting is absent, null or the id of the one it courts, the same on both sides; the two are
  // living, unmarried, of opposite sex, of COURT.minAge or more and never of a degree that may not marry (2 or less; the custom's limit
  // is read where a courtship starts and where their offer is made, and may change under them); courtingSince is a time not after now,
  // and courtRefused is held only while courting, of a pawn; st.courtships holds the man of each couple once, and no other
  {
    const C = globalThis.VB['sim/courting'].COURT, Rec = globalThis.VB['sim/records'], men = [];
    for (const p of st.pawns) {
      const c = p.courting, at = `pawn ${p.id}: courting ${c}`;
      if (c === undefined || c === null) {
        if (p.courtingSince !== undefined && p.courtingSince !== null) bad.push(`pawn ${p.id}: courts nobody since ${p.courtingSince}`);
        if (p.courtRefused !== undefined && p.courtRefused !== null) bad.push(`pawn ${p.id}: refused, and courts nobody`);
        continue;
      }
      const q = st.pawns[c];
      if (!Number.isInteger(c) || !q) { bad.push(`${at}: no such pawn`); continue; }
      if (q.courting !== p.id) bad.push(`${at}, who courts ${q.courting}`);
      if (!p.alive || !q.alive) bad.push(`${at}: one of them is dead`);
      if (p.sex === q.sex) bad.push(`${at}: of one sex`);
      if (Rec.spouseOf(st, p.id) !== null) bad.push(`${at}, and is married`);
      if (Rec.age(st, p) < C.minAge) bad.push(`${at}, aged ${Rec.age(st, p)}`);
      if (Rec.kinDegree(st, p.id, c) <= 2) bad.push(`${at}: kin of degree ${Rec.kinDegree(st, p.id, c)}`);
      if (!(Number.isFinite(p.courtingSince) && p.courtingSince <= st.t && p.courtingSince === q.courtingSince)) bad.push(`${at}: since ${p.courtingSince}`);
      const r = p.courtRefused;
      if (r !== undefined && r !== null && !(Number.isInteger(r.by) && st.pawns[r.by] && Number.isFinite(r.t) && r.t <= st.t)) bad.push(`${at}: refused ${JSON.stringify(r)}`);
      if (p.sex === 'm') men.push(p.id);
    }
    if (st.courtships !== undefined) {
      if (!Array.isArray(st.courtships) || [...st.courtships].sort((a, b) => a - b).join() !== men.join()) bad.push(`courtships ${JSON.stringify(st.courtships)}: the courting men are ${men.join()}`);
    }
  }
  // a child on the way (VB-555; sim/births, sim/asking): pawn.outside is absent or a boolean, true only of one with a mother, whose
  // parents are not married to each other now; pawn.pregnantCourting only while pregnant; st.courtDue's entries in order of t, each of
  // a woman and a man, known no later than it may be put off to
  {
    const Rec = globalThis.VB['sim/records'];
    for (const p of st.pawns) {
      if (p.outside !== undefined && typeof p.outside !== 'boolean') bad.push(`pawn ${p.id}: outside ${p.outside}`);
      if (p.outside === true && (p.mother === null || (p.father !== null && Rec.spouseOf(st, p.mother) === p.father)))
        bad.push(`pawn ${p.id}: born outside marriage, its parents ${p.mother} and ${p.father} married`);
      if (p.pregnantCourting === true && p.pregnantUntil === null) bad.push(`pawn ${p.id}: pregnant while courting, and not pregnant`);
    }
    const q = st.courtDue;
    if (q !== undefined) {
      if (!Array.isArray(q)) bad.push('courtDue is not a list');
      else q.forEach((e, i) => {
        const ok = e && [e.woman, e.man].every((id) => st.pawns[id]) && st.pawns[e.woman].sex === 'f' && st.pawns[e.man].sex === 'm';
        if (!ok || !(Number.isFinite(e.t) && e.t <= e.until) || (i && q[i - 1].t > e.t)) bad.push(`courtDue[${i}] ${JSON.stringify(e)}`);
      });
    }
  }
  // a culture's values (VB-519): the four means, each within the bounds
  if (st.cenv) for (const c of st.cenv.cultures) {
    const v = c.values;
    if (!v || Object.keys(v).join() !== TR.names.slice(0, 4).join() || !Object.values(v).every((x) => Number.isFinite(x) && x >= lo && x <= hi))
      bad.push(`culture ${c.id}: values ${JSON.stringify(v)}`);
  }
  // a pawn's events (VB-199), those added since the last check: positions in the record, each its own event or one folded since
  for (const p of st.pawns) {
    const ev = p.events, n0 = checked.get(ev) || 0;
    for (let k = n0; k < ev.length; k++) {
      const at = ev[k], e = st.record[at];
      if (!Number.isInteger(at) || at < 0 || at >= st.record.length || (typeof e === 'object' && e.pawn !== p.id)) {
        bad.push(`pawn ${p.id}.events[${k}]: ${JSON.stringify(at)} is not one of its events`);
      }
    }
    checked.set(ev, ev.length);
  }
  // the idle pawns of the hour (VB-074): built this hour or before, each an agent of a living pawn
  if (st.idlers) {
    if (!(st.idlers.hour <= Math.floor(st.t))) bad.push(`idlers: hour ${st.idlers.hour} is after ${Math.floor(st.t)}`);
    for (const [v, l] of st.idlers.by) for (const b of l) if (st.agents[b.id] !== b) bad.push(`idlers: village ${v} lists ${b.id}, not an agent`);
  }
  // legs (VB-473): st.legDue holds the walks and waits under way, each pawn once, a living one, sorted by due then id, each due after the
  // step now (a step takes all that is due); each living pawn's leg agrees with what it does: walking a walk, resting on the road a wait,
  // at work a work leg, free a wait or none (none only when its next look falls outside the working hours: the working day's start takes
  // it); a walk's hours to each point rise, its end is the step they reach, its due its end or, on a journey, the night's stop before it.
  // The awake list is gone.
  if (st.awake !== undefined) bad.push('awake: the awake list is gone (VB-473)');
  if (st.legDue !== undefined) {
    const q = st.legDue, R = globalThis.VB['sim/rules'], living = new Set(st.living), inQ = new Set(Array.isArray(q) ? q : []);
    const tickOf = (u) => { let k = Math.ceil(u * R.TICKS); if ((k - 1) / R.TICKS >= u) k--; if (k / R.TICKS < u) k++; return k; };
    if (!Array.isArray(q) || inQ.size !== q.length) bad.push('legDue: not a list of distinct pawn ids');
    else q.forEach((id, n) => {
      const a = st.agents[id], l = a && a.leg, at = `legDue[${n}] (pawn ${id})`;
      if (!living.has(id)) bad.push(`${at}: not living`);
      if (!l || (l.kind !== 'walk' && l.kind !== 'wait')) { bad.push(`${at}: its leg is ${l && l.kind}`); return; }
      // after the step now (a step takes all that is due); in a state whose clock a test set forward by hand (tests/lib/clock.js), after its start
      if (!Number.isInteger(l.due) || !(st.clockSet ? l.due > l.t || (l.kind === 'wait' && l.due === l.t) : l.due > st.tick)) bad.push(`${at}: due ${l.due}, begun ${l.t}, at tick ${st.tick}`);
      const p = n > 0 && st.agents[q[n - 1]].leg;
      if (p && (p.due > l.due || (p.due === l.due && q[n - 1] >= id))) bad.push(`${at}: out of order`);
    });
    for (const id of st.living) {
      const a = st.agents[id], l = a.leg || null, k = l && l.kind, at = `agents[${id}]`, free = !a.path && a.phase === null;
      const want = a.phase === 'road' ? ['wait'] : a.path ? ['walk'] : a.phase === 'work' ? ['work'] : free ? [null, 'wait'] : [];
      if (!want.includes(k)) bad.push(`${at}: phase ${a.phase}, ${a.path ? 'walking' : 'standing'}, in a leg ${k}`);
      if (a.errand !== undefined && a.errand !== true) bad.push(`${at}: errand ${a.errand}, neither absent nor true`); // VB-228
      if ((k === 'walk' || k === 'wait') !== inQ.has(id)) bad.push(`${at}: a leg ${k}, ${inQ.has(id) ? '' : 'not '}in legDue`);
      if (k === 'walk' && a.path) {
        const n = a.path.length - l.seg - 1, last = n > 0 ? l.h[n - 1] : 0;
        if (!Array.isArray(l.h) || l.h.length !== n || l.h.some((x, i) => !(x >= (i ? l.h[i - 1] : 0)))) bad.push(`${at}: a walk's hours ${l.h} to ${n} points`);
        if (l.end !== l.t + Math.max(1, Math.ceil(last * R.TICKS - 1e-9)) || !(l.due <= l.end) || !(l.pace > 0)) bad.push(`${at}: a walk begun ${l.t}, end ${l.end}, due ${l.due}, pace ${l.pace}`);
        if (l.due < l.end && a.phase !== 'journey') bad.push(`${at}: a walk stops short of its end, not on a journey`);
      }
      if (k === null && free) {
        const next = Math.max(st.tick + 1, tickOf(a.idleUntil)), h = Math.floor(next / R.TICKS) % R.DAY;
        if (h >= R.WORK[0] && h < R.WORK[1]) bad.push(`${at}: free, with no leg, and its next look in the working hours`);
      }
    }
    for (const a of st.agents) if (!living.has(a.id) && a.leg) bad.push(`agents[${a.id}]: dead, in a leg ${a.leg.kind}`);
  }
  // random streams (VB-072): after seeding, exactly one stream per system, none shared, each a 32-bit state, none fixed by a test
  const keys = Object.keys(st.rng || {}).sort().join(), streams = Object.values(st.rng || {});
  if (keys !== [...SYSTEMS].sort().join()) bad.push(`rng: streams ${keys}, want ${[...SYSTEMS].sort().join()}`);
  if (new Set(streams).size !== streams.length) bad.push('rng: two systems share a stream');
  for (const [k, r] of Object.entries(st.rng || {})) {
    if (!Number.isInteger(r.s) || (r.s | 0) !== r.s) bad.push(`rng.${k}: state ${r.s} is not a 32-bit integer`);
    if (r.fix !== undefined) bad.push(`rng.${k}: fixed at ${r.fix}`);
  }
  const within = (x, lo, hi) => Number.isFinite(x) && x >= lo && x <= hi;
  const memberOf = new Map();
  for (const h of st.households) {
    // the cold (VB-327): coldLog holds at most HUNGER.days days' cold, each 0..1, and is empty when warm that long; cold is its sum over
    // HUNGER.days, so 0 exactly when the log is empty
    const CL = h.coldLog, HD = globalThis.VB['sim/rules'].HUNGER.days;
    if (!Array.isArray(CL) || CL.length > HD || CL.some((x) => !within(x, 0, 1))) bad.push(`households[${h.id}]: coldLog ${JSON.stringify(CL)}`);
    else if (!within(h.cold, 0, 1) || Math.abs(h.cold - CL.reduce((n, x) => n + x, 0) / HD) > 1e-9 || (CL.length > 0) !== CL.some((x) => x > 0))
      bad.push(`households[${h.id}]: cold ${h.cold} against its log ${JSON.stringify(CL)}`);
    const DL = h.dryLog; // the dry days (VB-331): as the cold, each 0 or 1, or the part of its people a day's loads did not cover (VB-1586)
    if (!Array.isArray(DL) || DL.length > HD || DL.some((x) => !within(x, 0, 1))) bad.push(`households[${h.id}]: dryLog ${JSON.stringify(DL)}`);
    else if (!within(h.dry, 0, 1) || Math.abs(h.dry - DL.reduce((n, x) => n + x, 0) / HD) > 1e-9 || (DL.length > 0) !== DL.some((x) => x > 0))
      bad.push(`households[${h.id}]: dry ${h.dry} against its log ${JSON.stringify(DL)}`);
    // the people the day's loads cover (VB-1586): absent until the first load is brought, then a whole number of people, a load's at least
    if (h.waterFor !== undefined && !(Number.isInteger(h.waterFor) && h.waterFor >= globalThis.VB['sim/water'].WATER.child && Number.isInteger(h.waterDay)))
      bad.push(`households[${h.id}]: waterFor ${h.waterFor} on day ${h.waterDay}`);
    if (h.dissolved) { if (h.members.length) bad.push(`households[${h.id}]: dissolved but has members ${h.members}`); continue; }
    if (new Set(h.members).size !== h.members.length) bad.push(`households[${h.id}]: duplicate members ${h.members}`);
    for (const id of h.members) {
      const p = st.pawns[id];
      if (!p) { bad.push(`households[${h.id}]: member ${id} does not exist`); continue; }
      if (!p.alive) bad.push(`households[${h.id}]: member ${id} is dead`);
      if (memberOf.has(id)) bad.push(`pawns[${id}]: in households ${memberOf.get(id)} and ${h.id}`);
      memberOf.set(id, h.id);
    }
    if (h.holder !== null && !h.members.includes(h.holder) && !st.offers.some((o) => o.basis === 'inheritance' && o.gives.household === h.id) && !(st.liveTrusts || []).some((i) => st.trusts[i].household === h.id)) bad.push(`households[${h.id}]: holder ${h.holder} is not a member`);
    if (h.holder !== null && st.pawns[h.holder] && !st.pawns[h.holder].alive) bad.push(`households[${h.id}]: holder ${h.holder} is dead`);
    if (grainBad(h.grain)) bad.push(`households[${h.id}]: grain ${JSON.stringify(h.grain)}`);
    for (const k of ['wood', 'peat', 'meals', 'flour', 'hungryDays']) if (!within(h[k], 0, 1e6)) bad.push(`households[${h.id}]: ${k} is ${h[k]}`);
    // timber home and not yet cut (VB-1653): absent, or loads, a finite number not negative
    if (h.timber !== undefined && !within(h.timber, 0, 1e6)) bad.push(`households[${h.id}]: timber is ${h.timber}`);
    // the stone heap by rock (VB-733): loads of the stone's kinds, each a finite number, none negative
    const rocks = globalThis.VB['sim/goods'].kindsOf('stone');
    if (!h.stone || typeof h.stone !== 'object' || Object.keys(h.stone).some((k) => !rocks.includes(k) || !within(h.stone[k], 0, 1e6)))
      bad.push(`households[${h.id}]: stone is ${JSON.stringify(h.stone)}`);
    // the head's remembered yield (VB-767): a tally and a ring a source, none negative, at most FIELDS.memory years each, so 8 x 7 numbers
    if (h.yields) {
      const Y = VB['sim/yields'], M = VB['sim/rules'].FIELDS.memory;
      for (const s of Y.SOURCES) {
        const r = h.yields.ring[s];
        if (!within(h.yields.tally[s], 0, 1e9)) bad.push(`households[${h.id}]: yield tally ${s} is ${h.yields.tally[s]}`);
        if (!Array.isArray(r) || r.length > M || r.some((n) => !within(n, 0, 1e9))) bad.push(`households[${h.id}]: yield ring ${s} is ${JSON.stringify(r)}`);
      }
    }
    // the hand quern (VB-009): null, or a stone of a kind of the good (sandstone or granite; VB-733) made at a time not after now
    // and of a grade of workmanship, a whole number 0 to 4 (VB-761)
    if (h.quern !== null && !(h.quern && globalThis.VB['sim/goods'].kindRow('quern', h.quern.kind) && Number.isFinite(h.quern.made) && h.quern.made <= st.t
      && Number.isInteger(h.quern.grade) && h.quern.grade >= 0 && h.quern.grade <= 4))
      bad.push(`households[${h.id}]: quern ${JSON.stringify(h.quern)}`);
    // dug loads (VB-359): whole loads, and no more than the stock a household digs to; its digging ground's tiles on the map
    for (const k of ['clay', 'bogOre']) if (!Number.isInteger(h[k]) || h[k] < 0 ||
      h[k] > globalThis.VB['sim/dig'].DIG.stock) bad.push(`households[${h.id}]: ${k} is ${h[k]}`);
    // salt (VB-700): measures held, none or a finite amount; its spring, when searched, a tile of the map or -1
    if (h.salt !== undefined && !(Number.isFinite(h.salt) && h.salt >= 0 && h.salt <= 1e4)) bad.push(`households[${h.id}]: salt is ${h.salt}`);
    // iron and the tools (VB-701): blooms held, none or a finite amount; the tools' condition, when worn, from 0 to 1
    if (h.iron !== undefined && !(Number.isFinite(h.iron) && h.iron >= 0 && h.iron <= 1e4)) bad.push(`households[${h.id}]: iron is ${h.iron}`);
    if (h.tools !== undefined && !(Number.isFinite(h.tools) && h.tools >= 0 && h.tools <= 1)) bad.push(`households[${h.id}]: tools are ${h.tools}`);
    if (h.saltAt !== undefined && !(h.saltAt && (h.saltAt.tile === -1 || tileOk(h.saltAt.tile)) && tileOk(h.saltAt.house)))
      bad.push(`households[${h.id}]: saltAt ${JSON.stringify(h.saltAt)}`);
    if (h.digAt !== undefined &&
      !['clay', 'bogOre', 'peat'].every((g) => h.digAt[g] === -1 || tileOk(h.digAt[g]))) bad.push(`households[${h.id}]: digAt ${JSON.stringify(h.digAt)}`);
    // VB-255: the hours its hands worked this season and the last, counted as their work is reckoned (sim/agents)
    const Wh = h.workHours;
    if (Wh !== undefined && !(Array.isArray(Wh) && Wh.length === 3 && Number.isInteger(Wh[0]) && Wh[1] >= 0 && Wh[2] >= 0 &&
      Number.isFinite(Wh[1]) && Number.isFinite(Wh[2]))) bad.push(`households[${h.id}]: workHours ${JSON.stringify(Wh)}`);
    // the catch waiting by the drying rack, and the household's boat: a shore tile next to water of the sea or a large lake (VB-300)
    if (h.rack !== undefined && !within(h.rack, 0, 1e6)) bad.push(`households[${h.id}]: rack is ${h.rack}`);
    const b = h.boat;
    if (b && !(tileOk(b.tile) && tileOk(b.house) && st.w.water[b.water] === 1 && Array.from({ length: 6 }, (_, k) => st.w.nb[b.tile * 6 + k]).includes(b.water)
      && b.built <= st.t && (b.tarred === undefined || b.tarred >= b.built && b.tarred <= st.t))) bad.push(`households[${h.id}]: boat ${JSON.stringify(b)}`);
    if (h.hides !== undefined && !(Number.isInteger(h.hides) && h.hides >= 0)) bad.push(`households[${h.id}]: hides is ${h.hides}`); // VB-424
    // wool to cloth (VB-362): fleeces and skeins whole, not below 0; cloth five whole counts by grade; the loom built at a time not after now
    for (const k of ['wool', 'yarn']) if (h[k] !== undefined && !(Number.isInteger(h[k]) && h[k] >= 0)) bad.push(`households[${h.id}]: ${k} is ${h[k]}`);
    if (h.cloth !== undefined && !(Array.isArray(h.cloth) && h.cloth.length === 5 && h.cloth.every((n) => Number.isInteger(n) && n >= 0)))
      bad.push(`households[${h.id}]: cloth is ${JSON.stringify(h.cloth)}`);
    if (h.loom !== undefined && !(h.loom && h.loom.built <= st.t)) bad.push(`households[${h.id}]: loom is ${JSON.stringify(h.loom)}`);
    // shoes and harness (VB-911): pairs held, a finite number not below 0; the harness's condition in [0, 1]
    if (h.shoes !== undefined && !(Number.isFinite(h.shoes) && h.shoes >= 0)) bad.push(`households[${h.id}]: shoes is ${h.shoes}`);
    if (h.harness !== undefined && !within(h.harness, 0, 1)) bad.push(`households[${h.id}]: harness is ${h.harness}`);
    // tar (VB-301): whole barrels; the pit null or on a tile of the map, in a village, dug at a time not after now
    if (h.tar !== undefined && !(Number.isInteger(h.tar) && h.tar >= 0 && h.tar <= 100)) bad.push(`households[${h.id}]: tar is ${h.tar}`);
    if (h.tarPit !== undefined && h.tarPit !== null && !(tileOk(h.tarPit.tile) && st.villages[h.tarPit.village] && h.tarPit.built <= st.t))
      bad.push(`households[${h.id}]: tarPit ${JSON.stringify(h.tarPit)}`);
    if (b !== undefined && b !== null && typeof b !== 'object') bad.push(`households[${h.id}]: boat ${b}`);
    // carts (sim/carts): hand or ox, a condition above 0 and at most 1, out with no one or with a pawn; the misses a count
    if (!Array.isArray(h.carts) ||
      !(Number.isInteger(h.cartMiss) && h.cartMiss >= 0)) bad.push(`households[${h.id}]: carts ${JSON.stringify(h.carts)}, misses ${h.cartMiss}`);
    else for (const c of h.carts) {
      if (!((c.kind === 'hand' || c.kind === 'ox') && c.cond > 0 && c.cond <= 1 && c.built <= st.t && (c.by === null || !!st.pawns[c.by]))) {
        bad.push(`households[${h.id}]: cart ${JSON.stringify(c)}`); }
      // a cart standing out (VB-649): no carrier, and a lying 'leftCart' load of the household names it, or a hand that has taken it up
      // is leading it home (the lying load goes as it is taken up, the cart is free once it is at the house: seen with VB-1586)
      if (c.at !== undefined && !(c.by === null && Number.isInteger(c.at.tile) && c.at.t <= st.t &&
        ((st.lying || []).some((l) => l.kind === 'leftCart' && l.owner.type === 'household' && l.owner.id === h.id && l.of.cart.kind === c.kind && l.of.cart.built === c.built) ||
          [...st.jobs.values()].some((j) => j.kind === 'fetchLeftCart' && j.owner.id === h.id && j.claims.length > 0 && j.cart && j.cart.kind === c.kind && j.cart.built === c.built) ||
          // or a hand has taken it up and leads it home (the fetch's way back: the lying load is gone, the cart is home at the delivery; VB-1552 found the gap)
          [...st.jobs.values()].some((j) => j.cart && j.cart.kind === c.kind && j.cart.built === c.built && j.claims.some((id) => st.agents[id].phase === 'back')))))
        bad.push(`households[${h.id}]: cart ${JSON.stringify(c)} stands out with no carrier's lying cart`);
    }
    // the larder holds foods eaten as they are (rules FOODS, VB-259)
    const FOODS = globalThis.VB['sim/rules'].FOODS;
    for (const l of h.larder || []) if (!FOODS[l.kind] || !FOODS[l.kind].raw || FOODS[l.kind].held !== 'larder' ||
      !within(l.n, 0, 1e6)) bad.push(`households[${h.id}]: larder lot ${JSON.stringify(l)}`);
    // fresh food (sim/pot, VB-119): batches of fresh foods above 0, in day order, none from a later day, at most its keeping's days and one of a food (a batch
    // past its shelf life is held until the store is next touched, and read as gone)
    if (!Array.isArray(h.fresh)) bad.push(`households[${h.id}]: no fresh store`);
    else {
      const today = Math.floor(st.t / globalThis.VB['sim/rules'].DAY), per = {};
      for (let i = 0; i < h.fresh.length; i++) {
        const b = h.fresh[i];
        if (!FOODS[b.food] || FOODS[b.food].held !== 'fresh' || !(b.qty > 0) || !within(b.qty, 0, 1e6) || !Number.isInteger(b.day) || b.day > today
            || i && h.fresh[i - 1].day > b.day) bad.push(`households[${h.id}]: fresh batch ${JSON.stringify(b)}`);
        per[b.food] = (per[b.food] || 0) + 1;
      }
      for (const k in per) if (per[k] > globalThis.VB['sim/goods'].keepsDays(k) + 1) bad.push(`households[${h.id}]: ${per[k]} batches of ${k}`);
    }
    // help's seasonal ask (sim/help, VB-222): the season of the last ask, no later than this one
    if (h.askedIn !== undefined &&
      !(Number.isInteger(h.askedIn) && h.askedIn >= 0 && h.askedIn <= Math.floor(st.t / (VB['sim/rules'].SEASON_DAYS * VB['sim/rules'].DAY))))
      bad.push(`households[${h.id}]: askedIn is ${h.askedIn}`);
    // an ask for food that fell short, short of people (sim/help, VB-691): the day of it, no later than today
    if (h.fellShort !== undefined && !(Number.isInteger(h.fellShort) && h.fellShort >= 0 && h.fellShort <= Math.floor(st.t / VB['sim/rules'].DAY)))
      bad.push(`households[${h.id}]: fellShort is ${h.fellShort}`);
    // ale (VB-305): lots in order of their season's end, whole barrels, none kept past a season; the pours, the last BREW.maxBarrels in order of time
    {
      const keeps = globalThis.VB['sim/rules'].SEASON_DAYS * globalThis.VB['sim/rules'].DAY, B = globalThis.VB['sim/rules'].BREW;
      if (!Array.isArray(h.ale) || !Array.isArray(h.poured)) bad.push(`households[${h.id}]: no ale or poured`);
      else {
        h.ale.forEach((l, i) => {
          if (!(Number.isInteger(l.n) && l.n > 0) || !(l.until <= st.t + keeps) || i &&
            h.ale[i - 1].until > l.until) bad.push(`households[${h.id}]: invalid ale lot ${JSON.stringify(l)}`);
        });
        if (h.poured.length > B.maxBarrels || h.poured.some((t, i) => !(t <= st.t) || i && h.poured[i - 1] > t))
          bad.push(`households[${h.id}]: invalid pours ${JSON.stringify(h.poured)}`);
        if (h.dissolved && (h.ale.length || h.poured.length)) bad.push(`households[${h.id}]: dissolved with ale`);
      }
    }
    const f = st.farmsteads[h.farmstead];
    if (!f || f.household !== h.id) bad.push(`households[${h.id}]: farmstead ${h.farmstead} does not name it`);
    // VB-1314: the custom's time come and the holder holding out: {heir, since}, a pawn not the holder, since not after now
    const ex = h.expected;
    if (ex !== undefined && ex !== null && !(Object.keys(ex).join() === 'heir,since' && Number.isInteger(ex.heir) && !!st.pawns[ex.heir] &&
      Number.isFinite(ex.since) && ex.since <= st.t && h.holder !== ex.heir))
      bad.push(`households[${h.id}]: expected ${JSON.stringify(ex)}`);
    // the index of lines (sim/records, VB-224): a household is found under its farm's line, or with none, its holder
    const line = f && f.line !== null && f.line !== undefined ? f.line : h.holder;
    if (line !== null && !globalThis.VB['sim/records'].householdsOfLine(st, line).includes(h.id))
      bad.push(`households[${h.id}]: not in the index of lines under ${line}`);
  }
  // the feast (VB-458): a feast of the last day left its host at or above its seed and FEAST.above years of need (the entry's keep), and
  // what it served is what those who ate there ate (pawn.feast), each one feast a day
  {
    const DAY = globalThis.VB['sim/rules'].DAY, recent = new Map();
    for (const id of st.liveHouseholds) {
      const h = st.households[id];
      for (let i = h.ledger.length - 1; i >= 0 && st.t - h.ledger[i].t < DAY; i--) {
        const e = h.ledger[i];
        if (e.kind !== 'feast') continue;
        if (!(e.n < 0) || !(e.guests > 0) || !(e.booked >= 0)) bad.push(`households[${h.id}]: invalid feast ${JSON.stringify(e)}`);
        // two occasions at one farm ending in the same hour (two weddings of the house) are two entries: summed (VB-824)
        const key = `${h.id}:${e.t}`, was = recent.get(key);
        const both = was && { n: was.e.n + e.n, guests: was.e.guests + e.guests, left: Math.min(was.e.left - was.e.keep, e.left - e.keep), keep: 0 };
        recent.set(key, { e: both || e, ate: 0, eaters: 0 });
      }
    }
    // an illness running its course (pawn.ill, VB-1118): a living pawn's, of a cause with a course, begun by now and ending after it began
    for (const p of st.pawns) {
      if (p.ill === undefined || !p.alive) continue; // one killed otherwise while ill keeps its last illness
      const I = p.ill, ILL = globalThis.VB['sim/rules'].ILLNESS;
      if (!(I.cause in ILL.days) || !(I.from <= st.t) || !(I.until > I.from) || !(I.passes === undefined || I.passes === true)) bad.push(`pawns[${p.id}]: invalid illness ${JSON.stringify(I)}`);
    }
    for (const p of st.pawns) {
      if (p.feast === undefined) continue;
      const x = p.feast;
      if (!(x.n > 0) || !(x.t <= st.t) || !st.households[x.host]) bad.push(`pawns[${p.id}]: invalid feast ${JSON.stringify(x)}`);
      const r = recent.get(`${x.host}:${x.t}`);
      if (r) { r.ate += x.n; r.eaters++; }
    }
    for (const [key, r] of recent) {
      if (Math.abs(r.ate + r.e.n) > 1e-6 || r.eaters !== r.e.guests)
        bad.push(`feast ${key}: served ${-r.e.n} to ${r.e.guests}, eaten ${r.ate} by ${r.eaters}`);
      if (!(r.e.left >= r.e.keep - 1e-6)) bad.push(`feast ${key}: left its host ${r.e.left}, below its seed and years of need (${r.e.keep})`);
    }
  }
  const ledgerKinds = globalThis.VB['sim/stores'].KINDS;
  const WOODS = ['wood', 'timber', 'stone']; // the woodpile and timber at a building site (VB-328), the stone heap (VB-332)
  const FISHES = ['fish', 'dried fish', 'gathered']; // the catch by the drying rack and the fish hung on it (VB-300), fresh food (VB-119)
  FISHES.push('flour'); // ground on the quern (VB-009): a store moved as the foods are
  for (const holder of [...st.households, ...st.villages]) {
    if (!Array.isArray(holder.ledger)) { bad.push(`stores[${holder.id}]: missing ledger`); continue; }
    for (const e of holder.ledger) if (!ledgerKinds.includes(e.kind) || !Number.isFinite(e.n) || !Number.isFinite(e.t) || e.t > st.t
        || e.good !== undefined && !['grain', 'meals', 'sheaves', 'meat', 'salt meat', 'smoked meat', 'milk', 'butter', 'ale', 'clay', 'bogOre', 'peat', 'tar', 'hide', 'salt', 'iron', 'wool', 'yarn', 'cloth', ...FISHES, ...WOODS].includes(e.good)
        || e.stake && !st.pawns[e.pawn]) {
      bad.push(`stores[${holder.id}]: invalid ledger entry ${JSON.stringify(e)}`);
    }
    // VB-204: routine kinds are yearly totals, one per year, kind and good, in year order, none after this year or before the last three
    const S = globalThis.VB['sim/stores'], year = S.yearNow(st), seen = new Set();
    if (!Array.isArray(holder.totals)) { bad.push(`stores[${holder.id}]: missing totals`); continue; }
    for (let i = 0; i < holder.totals.length; i++) {
      const x = holder.totals[i], key = `${x.year}:${x.kind}:${x.good}`;
      if (!S.ROUTINE.includes(x.kind) || !Number.isInteger(x.year) || x.year > year || x.year < year - 3 || !Number.isFinite(x.n)
          || !Number.isInteger(x.count) || x.count < 1 || ![...'grain meals sheaves meat milk butter ale peat hide'.split(' '), 'salt meat', 'smoked meat', 'salt', ...FISHES, ...WOODS].includes(x.good)
          || seen.has(key)
          || i && holder.totals[i - 1].year > x.year) bad.push(`stores[${holder.id}]: invalid total ${JSON.stringify(x)}`);
      seen.add(key);
    }
    if (holder.dissolved && (holder.ledger.length || holder.totals.length)) bad.push(`households[${holder.id}]: dissolved with a ledger`);
  }
  // VB-100: a village's common fields: each on its own tile, the village's, in use, with a stage a field has, its ids in order; and no farm's
  const STAGES = ['stubble', 'plowed', 'sown', 'growing', 'ripe', 'stooks', 'fallow', 'scrub'], farmFields = new Set();
  for (const f of st.farmsteads) for (const fd of f.fields) farmFields.add(fd.tile);
  for (const v of st.villages) {
    if (v.commonFields === undefined) continue;
    if (!Array.isArray(v.commonFields)) { bad.push(`villages[${v.id}]: commonFields is not a list`); continue; }
    v.commonFields.forEach((fd, i) => {
      if (fd.id !== i || !STAGES.includes(fd.stage) || st.owner[fd.tile] !== -v.id - 1 || !st.used.has(fd.tile) || farmFields.has(fd.tile))
        bad.push(`villages[${v.id}]: common field ${i} ${JSON.stringify({ tile: fd.tile, stage: fd.stage, owner: st.owner[fd.tile] })}`);
    });
  }
  for (const v of st.villages)
    if (v.commonSow !== undefined && !(Number.isInteger(v.commonSow.year) && typeof v.commonSow.sow === 'boolean'))
      bad.push(`villages[${v.id}]: commonSow ${JSON.stringify(v.commonSow)}`);
  for (const v of st.villages) {
    if (grainBad(v.grain)) bad.push(`villages[${v.id}]: grain is ${JSON.stringify(v.grain)}`);
    // the reach test to fishing water (sim/drying, VB-300): tested for no more farms than the village has
    if (v.fishing !== undefined && !(v.fishing && Number.isInteger(v.fishing.farms) && v.fishing.farms <= v.farmsteads.length
      && typeof v.fishing.near === 'boolean')) bad.push(`villages[${v.id}]: fishing ${JSON.stringify(v.fishing)}`);
    // every village has the Culture settlement of the same id (sim/society, addSettlement); moving to new land (sim/settle)
    const s = st.cenv.settlements[v.id];
    if (!s || s.id !== v.id) bad.push(`villages[${v.id}]: no Culture settlement with its id`);
    if (!(Number.isInteger(v.crowded) && v.crowded >= 0)) bad.push(`villages[${v.id}]: crowded is ${v.crowded}`);
    const fd = v.founded;
    if (fd !== null && !(Number.isInteger(fd.from) && fd.from >= 0 && fd.from < v.id && st.pawns[fd.by] && Number.isFinite(fd.t))) {
      bad.push(`villages[${v.id}]: founded is ${JSON.stringify(fd)}`);
    }
  }
  // lapsed ground (VB-1527): a Set of tiles, each let go on a known day (w.tended); a house or a green never stands on one
  if (st.lapsed !== undefined) {
    if (!(st.lapsed instanceof Set)) bad.push(`lapsed is ${typeof st.lapsed}`);
    else for (const t of st.lapsed) if (!Number.isInteger(t) || t < 0 || t >= st.w.N || !(st.w.tended[t] > 0) || st.w.dev[t] > 1) bad.push(`lapsed: tile ${t} (dev ${st.w.dev[t]}, tended ${st.w.tended[t]})`);
  }
  // the village's wood (VB-326): every tile wooded (forest, or scrub the forest has grown on open land, VB-091), in no other village's wood
  // and not in use; within the cap
  const WOOD = globalThis.VB['sim/rules'].WOOD, { B } = globalThis.VB['world/biomes'], inWood = new Map();
  for (const v of st.villages) {
    if (!Array.isArray(v.wood) || v.wood.length > WOOD.cap) { bad.push(`villages[${v.id}]: wood is ${JSON.stringify(v.wood)}`); continue; }
    for (const t of v.wood) {
      const b = st.w.biome[t];
      if (!(b === B.FOREST || b === B.PINE || st.w.treesMax[t] > 0) || !(st.w.trees[t] > 0)) bad.push(`villages[${v.id}]: wood tile ${t} is not wooded`);
      if (st.used.has(t)) bad.push(`villages[${v.id}]: wood tile ${t} is in use`);
      if (inWood.has(t)) bad.push(`villages[${v.id}]: wood tile ${t} is also village ${inWood.get(t)}'s`);
      inWood.set(t, v.id);
    }
  }
  if (st.cenv.settlements.length !== st.villages.length) bad.push(`${st.cenv.settlements.length} settlements for ${st.villages.length} villages`);
  // each culture's order of preference among farm-name generators (sim/names, VB-026): known generators, each once
  const gens = Object.keys(VB['sim/names'].FARM);
  for (const c of st.cenv.cultures) {
    const f = c.namePrefs && c.namePrefs.farm;
    if (!Array.isArray(f) || !f.length || new Set(f).size !== f.length ||
      !f.every((g) => gens.includes(g))) bad.push(`cultures[${c.id}]: namePrefs ${JSON.stringify(c.namePrefs)}`);
    // VB-257: the culture's practices that are not customs, each one of its options
    const P = globalThis.VB['sim/customs'].PRACTICES;
    for (const k of Object.keys(P)) if (!c.practices ||
      !P[k].opts.some((o) => o[0] === c.practices[k])) bad.push(`cultures[${c.id}]: practice ${k} is ${c.practices && c.practices[k]}`);
  }
  for (const p of st.pawns) {
    // a pawn's work days (VB-120): counts of days, within the days a year holds
    const wd = p.workdays;
    if (wd && !(Number.isInteger(wd.year) && [wd.came, wd.missed].every((n) => Number.isInteger(n) && n >= 0 && n <= 2) && wd.came + wd.missed <= 2))
      bad.push(`pawns[${p.id}]: work days ${JSON.stringify(wd)}`);
    // a pawn's deeds (VB-705): held, office and gift, each [v > 0, t not after now]
    if (p.deeds) for (const [k, d] of Object.entries(p.deeds))
      if (!['held', 'office', 'gift'].includes(k) || !Array.isArray(d) || !(d[0] > 0) || !Number.isFinite(d[0]) || !(d[1] <= st.t))
        bad.push(`pawns[${p.id}]: deed ${k} ${JSON.stringify(d)}`);
    if (p.alive) {
      if (!memberOf.has(p.id)) bad.push(`pawns[${p.id}]: alive but in no household`);
      else if (p.household !== memberOf.get(p.id)) bad.push(`pawns[${p.id}]: household field ${p.household}, member of ${memberOf.get(p.id)}`);
      if (p.died !== null) bad.push(`pawns[${p.id}]: alive with died ${p.died}`);
      if (p.buffer !== undefined) bad.push(`pawns[${p.id}]: a drawn buffer (VB-520: the holder's reserve is its generosity's)`);
      if (!within(p.health, 0, 100)) bad.push(`pawns[${p.id}]: health is ${p.health}`);
      // VB-1585: the hour it last drank (sim/thirst), never ahead of the clock; the day it last drank marsh water, if any
      if (!(typeof p.drank === 'number' && p.drank <= st.t + 1e-9)) bad.push(`pawns[${p.id}]: drank is ${p.drank} at ${st.t}`);
      if (p.marsh !== undefined && !(Number.isInteger(p.marsh) && p.marsh <= st.t / 24)) bad.push(`pawns[${p.id}]: marsh is ${p.marsh}`);
    } else {
      if (memberOf.has(p.id)) bad.push(`pawns[${p.id}]: dead but in household ${memberOf.get(p.id)}`);
      if (p.died === null) bad.push(`pawns[${p.id}]: dead without a died time`);
    }
    if (p.alive && p.nursling !== null && p.nursling !== undefined) {
      // VB-632: she nurses a child of hers, born within the nursing term, and while the term lies ahead (the step clears it a day late at most)
      const c = st.pawns[p.nursling];
      if (!c || c.mother !== p.id || st.t - c.born > LOADED['sim/births'].BIRTH.nursingDays * LOADED['sim/rules'].DAY + 1e-6) bad.push(`pawns[${p.id}]: nursling ${p.nursling} is not her child born within the term`);
      if (p.nursingUntil === null || st.t - p.nursingUntil > 2 * LOADED['sim/rules'].DAY) bad.push(`pawns[${p.id}]: nursling ${p.nursling} but nursingUntil ${p.nursingUntil}`);
    }
    if (!within(p.hunger, 0, 1)) bad.push(`pawns[${p.id}]: hunger is ${p.hunger}`);
    // VB-520: a pawn with an attitude leans, a byte a custom, to the option it favours most (sim/attitudes compiles it where it writes att)
    if (p.att) {
      const C = globalThis.VB.culture, Customs = globalThis.VB['sim/customs'];
      if (!(p.leans instanceof Uint8Array) || p.leans.length !== Customs.DIMS.length) bad.push(`pawns[${p.id}]: leans ${p.leans}`);
      else for (let d = 0; d < Customs.DIMS.length; d++) {
        const o = Customs.OFF[d], top = p.att[o + p.leans[d]];
        let most = -Infinity;
        for (let j = 0; j < Customs.NOPT[d]; j++) most = Math.max(most, p.att[o + j]);
        if (p.leans[d] >= Customs.NOPT[d] || top !== most) { bad.push(`pawns[${p.id}]: leans ${p.leans[d]} on custom ${d}, not its strongest`); break; }
      }
    }
    if (p.mods !== undefined) checkMods(st, p, bad);
    if (p.rel) checkRel(st, p, bad);
    if (p.ties) checkTies(st, p, bad);
    if (p.goodwill) checkGoodwill(st, p, bad);
    if (p.known) checkKnown(st, p, bad);
    if (p.kinPush !== null &&
      !(typeof p.kinPush.to === 'string' && within(p.kinPush.w, 0, 1))) bad.push(`pawns[${p.id}]: kinPush is ${JSON.stringify(p.kinPush)}`);
    if (p.landWait !== undefined && !(Number.isInteger(p.landWait) && p.landWait >= 0)) bad.push(`pawns[${p.id}]: landWait is ${p.landWait}`);
  }
  checkFollowers(st, bad);
  checkStories(st, bad);
  const open = new Map();
  for (const u of st.unions) {
    if (u.end !== null && u.end < u.start) bad.push(`unions[${u.id}]: ends (${u.end}) before it starts (${u.start})`);
    if (u.end === null) for (const id of [u.a, u.b]) {
      if (open.has(id)) bad.push(`pawns[${id}]: open unions ${open.get(id)} and ${u.id}`);
      open.set(id, u.id);
    }
  }
  for (const f of st.farmsteads) {
    // VB-1587: the well a site was chosen for (sim/wells): a mark, true or absent, and none once the house's tile has its well
    if (f.wellMeant !== undefined && (f.wellMeant !== true || st.w.fresh[f.house] === VB['world/water'].FRESH.WELL)) bad.push(`farmsteads[${f.id}]: wellMeant ${JSON.stringify(f.wellMeant)}${f.wellMeant === true ? ' beside its well' : ''}`);
    // VB-1582: the farm's source (sim/water): none, or a tile its household may draw at, of the class named: a well its own or on a
    // green, running water on its own tile, a lake or a marsh from the tile or beside it; the walk within WATER.search hours
    if (f.water !== undefined) {
      const { FRESH } = VB['world/water'], s = f.water, w = st.w, by = (c) => [0, 1, 2, 3, 4, 5].some((k) => w.nb[s.tile * 6 + k] >= 0 && w.fresh[w.nb[s.tile * 6 + k]] === c);
      const ok = s.tile === -1 ? s.cls === FRESH.NONE
        : !(Number.isInteger(s.tile) && s.tile >= 0 && s.tile < w.N && s.walk >= 0 && s.walk <= VB['sim/water'].WATER.search) ? false
        : s.cls === FRESH.WELL ? w.fresh[s.tile] === FRESH.WELL && (s.tile === f.house || st.villages.some((v) => v.well === s.tile))
        : s.cls === FRESH.LAKE ? by(FRESH.LAKE)
        : s.cls === FRESH.MARSH ? w.fresh[s.tile] === FRESH.MARSH || by(FRESH.MARSH)
        : [FRESH.BROOK, FRESH.STREAM, FRESH.RIVER].includes(s.cls) && w.fresh[s.tile] === s.cls;
      if (!ok || !Number.isInteger(s.year)) bad.push(`farmsteads[${f.id}]: water ${JSON.stringify(s)} is no source its household may draw at`);
    }
    const want = f.household === null ? ['derelict', 'ruin'] : ['occupied'];
    if (!want.includes(f.state)) bad.push(`farmsteads[${f.id}]: state ${f.state} with household ${f.household}`);
    // VB-255: the farm's barn, one at most, built at a time not after now
    if (f.barn !== undefined && f.barn !== null && !(Object.keys(f.barn).join() === 'built' && f.barn.built <= st.t))
      bad.push(`farmsteads[${f.id}]: barn ${JSON.stringify(f.barn)}`);
    // VB-1665: the farm's byre, one at most, built at a time not after now; none on a camp
    if (f.byre !== undefined && f.byre !== null && !(Object.keys(f.byre).join() === 'built' && f.byre.built <= st.t && f.camp !== true))
      bad.push(`farmsteads[${f.id}]: byre ${JSON.stringify(f.byre)}`);
    // VB-1664: the rung stored where it cannot be derived, the timber house, on a farm with its cottage built (no booth)
    if (f.rung !== undefined && f.rung !== null && !(f.rung === 'timber' && !f.booth))
      bad.push(`farmsteads[${f.id}]: rung ${JSON.stringify(f.rung)} with booth ${JSON.stringify(f.booth)}`);
    // the house's condition (VB-306): 0..1 as last set, at a time not after now, and its tar not further than a barrel's years ahead
    if (f.condition !== undefined && !(f.condition >= 0 && f.condition <= 1)) bad.push(`farmsteads[${f.id}]: condition ${f.condition}`);
    if (f.condAt !== undefined && !(f.condAt <= st.t)) bad.push(`farmsteads[${f.id}]: condAt ${f.condAt} is in the future`);
    if (f.tarredUntil !== undefined &&
      !(f.tarredUntil <= st.t + globalThis.VB['sim/house'].HOUSE.tarYears * globalThis.VB['sim/rules'].YEAR)) bad.push(
      `farmsteads[${f.id}]: tarredUntil ${f.tarredUntil}`);
    if (!tileOk(f.house)) bad.push(`farmsteads[${f.id}]: house tile ${f.house} out of range`);
    // settlers' booth (sim/settle): a mark, the cottage being the project plan 'cottage' of its household, or of its village while the
    // farm waits for a household (VB-1411)
    if (f.booth !== null && f.booth !== true) bad.push(`farmsteads[${f.id}]: booth is ${JSON.stringify(f.booth)}`);
    if (f.booth && st.plans && st.plans.projects) {
      const P = st.plans.projects, mine = (p) => p.what === 'cottage' && p.farmstead === f.id,
        n = [...(P.household.get(f.household) || []), ...(P.village.get(f.village) || [])].filter(mine).length;
      // a farm landed by hand (f.camp, VB-1655) has its cottage planned by a later task: none, or one
      if (n !== 1 && !(n === 0 && f.camp !== undefined)) bad.push(`farmsteads[${f.id}]: a booth with ${n} cottage plans`);
    }
    // the camp (VB-1655): absent, or true (nothing stands: no booth of its household raised by its house) or false, on a booth farm while true
    if (f.camp !== undefined && f.camp !== true && f.camp !== false) bad.push(`farmsteads[${f.id}]: camp ${JSON.stringify(f.camp)}`);
    if (f.camp === true && (!f.booth || (st.booths || []).some((b) => b.by === f.household && globalThis.VB['sim/hex'].hexSteps(st.w, b.tile, f.house) <= 1)))
      bad.push(`farmsteads[${f.id}]: a camp ${f.booth ? 'with its booth raised' : 'with no booth mark'}`);
    // the shelter on the house tile (VB-1666): absent or null, or on a farm with no cottage yet {wood, done, built (null while raised, else
    // not after now), cond 0..1, condAt not after now}; a camp's never stands
    const sh = f.shelter;
    if (sh !== undefined && sh !== null) {
      const num = (x) => Number.isFinite(x) && x >= 0;
      if (!f.booth) bad.push(`farmsteads[${f.id}]: a shelter on a farm with its cottage`);
      if (!num(sh.wood) || !num(sh.done) || !(sh.cond >= 0 && sh.cond <= 1) || !(sh.condAt <= st.t) || !(sh.built === null || sh.built <= st.t))
        bad.push(`farmsteads[${f.id}]: shelter ${JSON.stringify(sh)}`);
      if (f.camp === true && sh.built !== null) bad.push(`farmsteads[${f.id}]: a camp with its shelter standing`);
    }
    if (f.grade !== 'ground' && f.grade !== 'stone') bad.push(`farmsteads[${f.id}]: grade ${f.grade}`); // VB-332
    for (const fd of f.fields) if (!tileOk(fd.tile)) bad.push(`farmsteads[${f.id}]: field ${fd.id} tile ${fd.tile} out of range`);
    // VB-1520: a field's ground is the key of a farmable ground (a biome with a row of GROUND)
    for (const fd of f.fields) if (!VB['sim/fieldrec'].farmableKeys().includes(fd.ground)) bad.push(`farmsteads[${f.id}]: field ${fd.id} ground ${fd.ground}`);
    // VB-768: the fields let go, absent or counted; the fields' ids distinct and under the fields ever made (none used again)
    const L = f.left;
    if (L !== undefined && !(L && Number.isInteger(L.gone) && L.gone >= 1 && Number.isInteger(L.year) && L.year >= 0 && L.year <= Math.floor(st.t / VB["sim/rules"].YEAR) + 1 && Number.isInteger(L.inYear) && L.inYear >= 0 && L.inYear <= L.gone))
      bad.push(`farmsteads[${f.id}]: fields let go ${JSON.stringify(L)}`);
    const made = f.fields.length + (L ? L.gone : 0), ids = new Set(f.fields.map((fd) => fd.id));
    if (ids.size !== f.fields.length || f.fields.some((fd) => !(Number.isInteger(fd.id) && fd.id >= 0 && fd.id < made)))
      bad.push(`farmsteads[${f.id}]: field ids ${[...ids].join(',')} not distinct under ${made}`);
    if (st.owner) {
      const want = f.household === null ? -f.village - 1 : f.household + 1;
      for (const tile of [f.house, ...f.fields.map((fd) => fd.tile), ...(f.meadows || []).map((m) => m.tile)]) {
        if (st.owner[tile] !== want) bad.push(`farmsteads[${f.id}]: owner cache on tile ${tile} is ${st.owner[tile]}, expected ${want}`);
      }
      for (const m of f.meadows || []) if (!st.used.has(m.tile)) bad.push(`farmsteads[${f.id}]: meadow ${m.id} tile ${m.tile} unused`);
    }
    // a claim on an empty farm (VB-033): only on an empty, derelict farm, its hours in range, and the claimant's claim on its house
    // (its claimant's project plan, VB-123)
    const fc = VB['sim/farmclaims'].claimOn(st, f);
    if ('claim' in f) bad.push(`farmsteads[${f.id}]: a claim kept on the farm`);
    if (fc) {
      const c = st.claims && VB['sim/claims'].claimOf(st, f.house, { type: 'pawn', id: fc.by });
      if (f.household !== null || f.state !== 'derelict' ||
        !st.pawns[fc.by]) bad.push(`farmsteads[${f.id}]: claim by ${fc.by} on a farm ${f.state}, held by ${f.household}`);
      if (!within(fc.done, 0, fc.hours + 1e-6) || !within(fc.hours, 0, 120)) bad.push(`farmsteads[${f.id}]: claim hours ${fc.done} of ${fc.hours}`);
      if (st.claims && (!c || c.why !== 'farm' || c.state !== 'unrealised')) bad.push(`farmsteads[${f.id}]: claim by ${fc.by} without its claim on the house`);
    }
    // a field or meadow in the making (its household's project plan, VB-123) is staked by its household, not owned by it (VB-158); the
    // farm holds no project of its own
    if ('project' in f) bad.push(`farmsteads[${f.id}]: a project kept on the farm`);
    for (const pj of f.household === null ? [] : projectSteps(f.household)) if (st.claims) {
      const c = VB['sim/claims'].claimOf(st, pj.place, { type: 'household', id: f.household });
      if (!c || c.state !== 'unrealised' || c.why !== pj.stake) bad.push(`farmsteads[${f.id}]: project on ${pj.place} not staked by its household`);
      if (st.owner[pj.place] === f.household + 1) bad.push(`farmsteads[${f.id}]: project tile ${pj.place} owned before it is made`);
    }
  }
  // claims on tiles (sim/claims, VB-042): valid tiles and claimants, no claimant twice on a tile, strengths in 0..1, no empty lists
  if (st.claims) {
    const CL = VB['sim/claims'], WHY = ['outland', 'field', 'meadow', 'farm', 'birthright'];
    const exists = (by) => by.type === 'pawn' ? !!st.pawns[by.id] : by.type === 'household' ? !!st.households[by.id] : by.type === 'village' &&
      !!st.villages[by.id];
    for (const [tile, list] of st.claims) {
      if (!tileOk(tile)) bad.push(`claims: tile ${tile} out of range`);
      if (!list.length) bad.push(`claims[${tile}]: empty list kept`);
      const seen = new Set();
      for (const c of list) {
        const k = c.by.type + ':' + c.by.id;
        if (seen.has(k)) bad.push(`claims[${tile}]: ${k} claims twice`);
        seen.add(k);
        if (!exists(c.by)) bad.push(`claims[${tile}]: claimant ${k} does not exist`);
        if (!['unrealised', 'realised'].includes(c.state) || !WHY.includes(c.why)) bad.push(`claims[${tile}]: ${k} is ${c.state}, ${c.why}`);
        if (!within(CL.strength(st, c), 0, 1) || !(c.seq > 0 && c.seq <= st.claimSeq)) bad.push(`claims[${tile}]: ${k} strength or seq ${c.seq}`);
        if (c.by.type === 'household' && st.households[c.by.id] &&
          st.households[c.by.id].dissolved) bad.push(`claims[${tile}]: dissolved household ${c.by.id}`);
        // only villages claim outland (VB-156); a village claims only outland, and a common field's tile (VB-100)
        if ((c.why === 'outland') !== (c.by.type === 'village') && !(c.why === 'field' && c.by.type === 'village')) bad.push(`claims[${tile}]: ${k} claims ${c.why}`);
        if (c.why === 'birthright') { // the old family's claim on the house of its empty farm, for a while (VB-033)
          const f = st.farmsteads.find((x) => x.house === tile);
          if (c.by.type !== 'pawn' || c.state !== 'realised' || c.until === null || !f ||
            f.household !== null) bad.push(`claims[${tile}]: ${k} birthright is ${c.state} on ${f ? `a farm held by ${f.household}` : 'no farm'}`);
        }
        if (c.why === 'farm') { // a pawn's claim on the house of the empty farm it is restoring (VB-033)
          const f = st.farmsteads.find((x) => x.house === tile);
          if (c.by.type !== 'pawn' || !f ||
            VB['sim/farmclaims'].claimOn(st, f)?.by !== c.by.id) bad.push(`claims[${tile}]: ${k} claims a farm with no claim under way`);
        }
        if (c.why === 'field' && c.by.type === 'village') { // a common field's tile, while it is cleared and broken (VB-100)
          const pl = (st.plans.projects.village.get(c.by.id) || []).find((x) => x.what === 'commons');
          if (!pl || pl.steps[pl.open].place !== tile || c.state !== 'unrealised') bad.push(`claims[${tile}]: ${k} claims it for no common field`);
        } else if (c.why === 'field' || c.why === 'meadow') { // a stake is its household's project (VB-158)
          const h = c.by.type === 'household' && st.households[c.by.id], f = h && st.farmsteads[h.farmstead];
          const s = f && projectSteps(f.household).find((x) => x.place === tile);
          if (!s || c.state !== 'unrealised') bad.push(`claims[${tile}]: ${k} stakes it with no project there`);
        }
      }
    }
  }
  // cairns on settled borders (VB-157): a valid tile, two different villages, set in the past
  for (const [tile, c] of st.cairns || []) {
    if (!tileOk(tile) || !st.villages[c.a] || !st.villages[c.b] || c.a === c.b || !(c.t <= st.t)) bad.push(`cairns[${tile}]: ${JSON.stringify(c)}`);
  }
  // what the villages have found (VB-358): a live village id, and each vein once, a hidden one of this world
  (st.finds || new Map()).forEach((found, v) => {
    const hiddenKind = (id) => st.w.veinKind && id >= 1 && id < st.w.veinKind.length && [3, 4, 5, 6, 7].includes(st.w.veinKind[id]);
    if (!st.villages[v] || new Set(found).size !== found.length || !found.every(hiddenKind)) bad.push(`finds[${v}]: ${JSON.stringify(found)}`);
  });
  // nothing is built on a river tile (VB-111): houses, fields, fields in the making, plots and greens
  const onRiver = (t) => tileOk(t) && st.w.river[t] > 0;
  for (const f of st.farmsteads) {
    if (onRiver(f.house)) bad.push(`farmsteads[${f.id}]: house on river tile ${f.house}`);
    for (const fd of f.fields) if (onRiver(fd.tile)) bad.push(`farmsteads[${f.id}]: field ${fd.id} on river tile ${fd.tile}`);
    for (const pj of f.household === null ? [] : projectSteps(f.household)) if (onRiver(pj.place)) bad.push(`farmsteads[${f.id}]: new field on river tile ${pj.place}`);
    for (const m of f.meadows || []) if (onRiver(m.tile) ||
      st.w.water[m.tile]) bad.push(`farmsteads[${f.id}]: meadow ${m.id} on river or water tile ${m.tile}`);
  }
  for (const v of st.villages) {
    if (v.green && onRiver(v.center)) bad.push(`villages[${v.id}]: green on river tile ${v.center}`);
    // plots built (village.plots) and under way (the village's project plans, VB-123): numbered in the village, none twice; the timber at the
    // site within range (VB-328); a built one's farmstead exists
    const projects = st.plans && st.plans.projects ? st.plans.projects.village.get(v.id) || [] : [],
      // as sim/expansion's livePlots: the village's own plans and its households' plots for their heirs (VB-255, VB-959)
      live = [...projects.filter((pl) => pl.what === 'plot'), ...((st.plans && st.plans.projects && st.plans.projects.heirPlots) || []).filter((pl) => pl.village === v.id)];
    // VB-646: a village's plot cleared with nobody to have it is allotted at a moving round or given back: none stands unclaimed past the
    // rounds it waits (two years, and a year's slack to the next round)
    for (const pl of live)
      if (pl.open >= 1 && pl.to === null && pl.vacant !== undefined && st.t - pl.vacant > 3 * LOADED['sim/rules'].YEAR)
        bad.push(`villages[${v.id}]: plot ${pl.plot} has stood cleared with nobody to have it since ${pl.vacant}`);
    // the green and well (VB-058): a well only with a green; a green under way at most once, only while there is no well: its three steps
    // on one tile, the village's and in use, open ground off any river, its stone brought at most what the well takes
    // VB-1584: the well is its tile, on the green (the village's centre), a source on the map, in ground that has one; null for none
    if (v.well !== null && !v.green) bad.push(`villages[${v.id}]: a well without a green`);
    if (v.well !== null && (v.well !== v.center || st.w.fresh[v.well] !== VB['world/water'].FRESH.WELL)) bad.push(`villages[${v.id}]: well ${v.well}, centre ${v.center}, not a well on the map`);
    const greens = projects.filter((pl) => pl.what === 'green');
    if (projects.some((pl) => !['plot', 'green', 'commons'].includes(pl.what))) bad.push(`villages[${v.id}]: a project of an unknown kind`);
    // a common field under way (VB-100): at most one, its clearing and breaking on one tile, in use
    const commons = projects.filter((pl) => pl.what === 'commons');
    if (commons.length > 1 || commons.some((pl) => pl.steps.map((x) => x.kind).join() !== 'clear,break' ||
        pl.steps[0].place !== pl.steps[1].place || !st.used.has(pl.steps[0].place))) bad.push(`villages[${v.id}]: a common field under way is malformed`);
    if (greens.length > 1 || (greens.length && v.green)) bad.push(`villages[${v.id}]: ${greens.length} greens under way, well ${v.well}`);
    for (const pl of greens) {
      const t = pl.steps[0].place, wellStep = pl.steps[1];
      const noWell = !(st.w.waterDepth[t] < Infinity);
      if (pl.steps.map((x) => x.kind).join() !== (noWell ? 'green' : 'green,well,sweep') || pl.steps.some((x) => x.place !== t)) bad.push(`villages[${v.id}]: green shape`);
      if (st.owner[t] !== -v.id - 1 || !st.used.has(t) || onRiver(t) || st.w.water[t]) bad.push(`villages[${v.id}]: green under way on tile ${t}, not its own open ground`);
      const { wellHours, wellStone } = VB['world/water'], depth = st.w.waterDepth[t];
      if (wellStep && (!Number.isInteger(wellStep.brought) || wellStep.brought < 0 || wellStep.brought > (wellStep.stone ?? 6))) bad.push(`villages[${v.id}]: the well's stone ${wellStep.brought}`);
      if (wellStep && wellStep.stone !== undefined && (wellStep.stone !== wellStone(depth) || wellStep.hours !== wellHours(depth))) bad.push(`villages[${v.id}]: the well's hours ${wellStep.hours} and stone ${wellStep.stone} are not its depth's`);
    }
    // the last work day (VB-120): a day not after today, of a kind there is, hours worked by pawns that were born, none negative, and no
    // more than the day's working hours
    const wd = v.workday;
    if (wd) {
      if (!Number.isInteger(wd.day) || wd.day > Math.floor(st.t / 24) || !['fence', 'commons'].includes(wd.what)) bad.push(`villages[${v.id}]: work day ${wd.day} ${wd.what}`);
      for (const [id, h] of Object.entries(wd.hoursOf)) if (!st.pawns[id] || !within(h, 0, 12.5)) bad.push(`villages[${v.id}]: work day hours ${id}: ${h}`);
    }
    const nums = [...(v.plots || []).map((pl) => pl.id), ...live.map((pl) => pl.plot)].sort((a, b) => a - b);
    // a plot given up leaves a gap (sim/expansion plotNumber numbers one past the highest): numbers are distinct, not contiguous
    if (!nums.every((n, i) => Number.isInteger(n) && n >= 0 && (i === 0 || n !== nums[i - 1]))) bad.push(`villages[${v.id}]: plots numbered ${nums}`);
    for (const pl of live) {
      if (pl.what !== 'plot' || pl.steps.length !== 4 || !pl.steps[0].places ||
        !within(pl.steps[2].wood, -1e5, 1e5)) bad.push(`villages[${v.id}]: plot ${pl.plot} shape`);
      if (pl.to !== null && !st.pawns[pl.to]) bad.push(`villages[${v.id}]: plot ${pl.plot} allotted to nobody`);
    }
    for (const pl of v.plots || []) if (!st.farmsteads[pl.farmstead]) bad.push(`villages[${v.id}]: plot ${pl.id} built without a farmstead`);
    for (const pl of [...v.plots || [], ...live]) for (const tr of pl.tiles || pl.steps[0].places) {
      if (onRiver(tr.tile)) bad.push(`villages[${v.id}]: plot ${pl.id ?? pl.plot} on river tile ${tr.tile}`);
    }
  }
  // worn paths (VB-094): counts finite and not negative, none on water; a stage from 0 to 3 that its count supports
  const { wear, worn } = st.w;
  if (wear) {
    let off = 0;
    for (let i = 0; i < N; i++) if (!(wear[i] >= 0) || worn[i] > 3 || (wear[i] > 0 && st.w.water[i]) || (worn[i] && !(wear[i] > 0))) off++;
    if (off) bad.push(`w.wear: ${off} tiles with a count or stage out of place`);
  }
  // grazing pressure (sim/grazing, VB-136): one finite value, not negative, a tile
  if (st.w.graze) {
    let off = 0;
    for (let i = 0; i < N; i++) if (!(st.w.graze[i] >= 0 && st.w.graze[i] < Infinity)) off++;
    if (st.w.graze.length !== N || off) bad.push(`w.graze: ${off} tiles with a pressure out of place, of ${st.w.graze.length}`);
  }
  // passage on foot (sim/passage, VB-816): 0 open, 1 closed, 2 standing but kept open; only a field's or a meadow's tile (developed ground) is marked
  if (st.w.shut) {
    let off = 0;
    for (let i = 0; i < N; i++) if (st.w.shut[i] > 2 || (st.w.shut[i] && st.w.dev[i] !== 1)) off++;
    if (st.w.shut.length !== N || off) bad.push(`w.shut: ${off} tiles marked out of place, of ${st.w.shut.length}`);
  }
  // the ground compiled (VB-808, sim/walking w.ground): each tile's cost and ice equal the rule computed afresh on its row's season, so
  // no change of a tile's cost has gone by sim/routes costChanged unseen
  if (st.w.ground) {
    const Wk = globalThis.VB['sim/walking'], g = st.w.ground;
    let off = 0, first = -1;
    for (let i = 0; i < N; i++) {
      const c = Wk.ruleCost(st.w, i);
      if (!(g.cost[i] === c || (Number.isNaN(c) && Number.isNaN(g.cost[i])))) { off++; if (first < 0) first = i; }
    }
    if (off || g.cost.length !== N || g.season.length !== st.w.ROWS)
      bad.push(`w.ground: ${off} tiles costed out of step with the rule (first ${first}: ${first >= 0 ? `${g.cost[first]} against ${Wk.ruleCost(st.w, first)}` : '-'})`);
  }
  // the generated climate (VB-342): the wind a unit vector, rain from 0 to 1 and only on land
  if (st.w.rain) {
    let off = 0;
    for (let i = 0; i < N; i++) if (!(st.w.rain[i] >= 0 && st.w.rain[i] <= 1) || (st.w.water[i] && st.w.rain[i] !== 0)) off++;
    if (off || !st.w.wind ||
      Math.abs(Math.hypot(st.w.wind[0], st.w.wind[1]) - 1) > 1e-9) bad.push(`w.rain, w.wind: ${off} tiles out of range, or no unit wind`);
  }
  // fish stocks (VB-117): from 0 to 1, set on a day not after today; below 1 or set only on a river or small lake tile, whose stock runs down
  const { fish, fishDay } = st.w;
  if (fish) {
    const F = globalThis.VB['sim/fish'], day = Math.floor(st.t / 24);
    let off = 0;
    for (let i = 0; i < N; i++) {
      if (!(fish[i] >= 0 && fish[i] <= 1) || fishDay[i] < 0 || fishDay[i] > day) off++;
      else if ((fish[i] < 1 || fishDay[i] > 0) && !F.runsDown(st.w, i)) off++;
    }
    if (off) bad.push(`w.fish: ${off} tiles with a stock or day out of place`);
  }
  // fresh water on the map (VB-1581): a source's class on every tile, none on the sea, a lake on a lake, running water where a river runs;
  // a depth to the ground's water on land or no well, never on water; the walk laid, 0 on a river's tile, none on water, nowhere negative
  {
    const { fresh, waterDepth, freshWalk, water, ocean, river } = st.w, { FRESH, FRESHES } = globalThis.VB['world/water'];
    if (!fresh || !waterDepth || !freshWalk || fresh.length !== N || waterDepth.length !== N || freshWalk.length !== N) bad.push('w.fresh, w.waterDepth, w.freshWalk: not laid a tile');
    else {
      let off = 0;
      for (let i = 0; i < N; i++) {
        const f = fresh[i], running = f >= FRESH.BROOK && f <= FRESH.RIVER;
        if (f >= FRESHES.length || (water[i] ? f !== (ocean[i] ? FRESH.NONE : FRESH.LAKE) : f === FRESH.LAKE) || running !== (river[i] > 0 && !water[i])) off++;
        else if (water[i] ? waterDepth[i] !== Infinity || freshWalk[i] !== Infinity : !(waterDepth[i] > 0) || !(freshWalk[i] >= 0) || (running && freshWalk[i] !== 0)) off++;
      }
      if (off) bad.push(`w.fresh, w.waterDepth, w.freshWalk: ${off} tiles out of place`);
    }
  }
  // the kept lists of walking reach (VB-452; sim/walking reachTiles): for each farm with a household and each reach the ground searches ask
  // (fishing, gathering, hunting), the kept list is what a new search from the house finds now, tile for tile in its order
  {
    const V = globalThis.VB, Walking = V['sim/walking'], Ru = V['sim/rules'], walk = Walking.walkable(st.w);
    let off = 0, first = null;
    for (const f of st.farmsteads) {
      if (f.household === null) continue;
      for (const steps of new Set([Ru.FISH.reach, V['sim/forage'].FORAGE.reach, Ru.DEER.hunt.reach])) {
        const kept = Walking.reachTiles(st.w, f.house, steps), now = [...V['sim/hex'].bfs(st.w, f.house, steps, walk).dist.keys()];
        if (kept.length !== now.length || now.some((t, i) => kept[i] !== t)) { off++; first ??= `house ${f.house}, ${steps} steps`; }
      }
    }
    if (off) bad.push(`reachTiles: ${off} kept lists differ from a new search (${first})`);
  }
  // wild food (VB-118): stocks from 0 to 1, set in a year not after this one; below 1 or set only on a forest or heath tile (a cleared tile keeps its stock)
  const { forage, forageYear } = st.w;
  if (forage) {
    const year = Math.floor(st.t / 24 / globalThis.VB['sim/rules'].YEAR_DAYS);
    let off = 0;
    for (let i = 0; i < N; i++) if (!(forage[i] >= 0 && forage[i] <= 1) || forageYear[i] < 0 || forageYear[i] > year) off++;
    if (off) bad.push(`w.forage: ${off} tiles with a stock or year out of place`);
  }
  // roe deer (VB-139, sim/deer): a region's head from 0, its capacity DEER.perEdge a forest-edge tile it lists, set on a day not after today,
  // the edges tiles of the region (wood at the year's count; a wood felled since stays listed until the next), and no deer without capacity
  if (st.deer) {
    const D = st.deer, Dr = globalThis.VB['sim/rules'].DEER, R = st.w.regions.length, day = Math.floor(st.t / 24);
    let off = 0;
    if (D.head.length !== R || D.since.length !== R || D.cap.length !== R || D.edges.length !== R) off = R;
    else for (let r = 0; r < R; r++) {
      if (!(D.head[r] >= 0 && D.head[r] < Infinity) || D.since[r] > day || Math.abs(D.cap[r] - D.edges[r].length * Dr.perEdge) > 1e-9
        || (D.cap[r] === 0 && D.head[r] !== 0) || D.edges[r].some((t) => st.w.region[t] !== r)) off++;
    }
    if (off) bad.push(`st.deer: ${off} regions with deer, a day or edges out of place`);
  }
  // deposits (VB-359, sim/dig): loads left only on a deposit tile; a dug tile (dugDay) not after today, its first amount at least what is left
  // and nothing dug but clay, bog iron and peat; an endless tile stays endless
  {
    const { deposit, depositLeft, depositFull, dugDay } = st.w, today = Math.floor(st.t / 24), E = globalThis.VB['world/geology'];
    let off = 0;
    if (deposit) for (let i = 0; i < N; i++) {
      if (!deposit[i] && depositLeft[i]) off++;
      else if (dugDay && dugDay[i] && (dugDay[i] > today + 1 || depositFull[i] < depositLeft[i] || depositFull[i] === E.ENDLESS
        || (deposit[i] !== E.DEPOSIT.CLAY && deposit[i] !== E.DEPOSIT.BOG_IRON && deposit[i] !== E.DEPOSIT.PEAT))) off++;
    }
    if (off) bad.push(`w.depositLeft: ${off} tiles with loads or a digging out of place`);
  }
  // fishing jobs (VB-117): at a bank (land, not a river) next to the water they fish
  for (const j of st.jobs.values()) {
    if (j.kind !== 'fish') continue;
    const w = st.w, F = globalThis.VB['sim/fish'];
    if (!tileOk(j.site) || w.water[j.site] || w.river[j.site] || !F.isWater(w, j.water) || !w.nb.slice(j.site * 6, j.site * 6 + 6).includes(j.water)) {
      bad.push(`jobs[${j.key}]: not at a bank next to its water ${j.water}`);
    }
  }
  // jobs (VB-102): each worker of a job has it as its job, no worker twice, no more workers than the kind's hands
  for (const j of st.jobs.values()) {
    if (new Set(j.claims).size !== j.claims.length) bad.push(`jobs[${j.key}]: a worker listed twice in ${j.claims}`);
    if (j.claims.length > globalThis.VB['sim/kinds'].KINDS[j.kind].hands) bad.push(`jobs[${j.key}]: ${j.claims.length} workers, more than its hands`);
    for (const id of j.claims) {
      const a = st.agents[id];
      const side = a && a.side && (a.side.partial === j || a.side.background === j);
      if (!a || (a.job !== j && !side)) bad.push(`jobs[${j.key}]: worked by agent ${id}, whose job is ${a && a.job ? a.job.key : 'none'}`);
    }
  }
  // work as a block (VB-472): a task's done, at (the tick it was reckoned at) and rate (its hands' hours a game hour); a task with a hand
  // at work has a rate, and one with none none; done below its hours while worked; st.workDue holds each task of full attention under
  // work once, posted, sorted by due then id, each due after the step now (a step takes all that is due), as reckoned from done and rate
  {
    const KS = globalThis.VB['sim/kinds'].KINDS, { TICKS } = globalThis.VB['sim/rules'], A = globalThis.VB['sim/agents'];
    const q = st.workDue, inQ = new Set(q || []);
    if (q !== undefined && !Array.isArray(q)) bad.push(`workDue: ${typeof q}`);
    // VB-1585: the thirsty pawns held due (sim/drinking): in the order of their hour, each a pawn, one thirst entry a pawn at most
    if (st.thirstDue !== undefined) {
      const T = st.thirstDue, seen = new Set();
      if (!Array.isArray(T)) bad.push(`thirstDue: ${typeof T}`);
      else T.forEach((e, i) => {
        if (!st.pawns[e.pawn] || typeof e.at !== 'number' || (i > 0 && T[i - 1].at > e.at)) bad.push(`thirstDue[${i}]: ${JSON.stringify(e)} out of place`);
        if (!e.home && seen.has(e.pawn)) bad.push(`thirstDue[${i}]: pawn ${e.pawn} held twice`);
        if (!e.home) seen.add(e.pawn);
      });
    }
    else if (q) {
      if (inQ.size !== q.length) bad.push('workDue: a task twice');
      q.forEach((j, n) => {
        const at = `workDue[${n}] (${j.key})`;
        if (st.jobs.get(j.key) !== j) bad.push(`${at}: not posted`);
        if ((KS[j.kind].attention || 'full') === 'partial') bad.push(`${at}: a partial task`);
        if (!(j.rate > 0) || !Number.isInteger(j.due) || !(j.due > st.tick)) bad.push(`${at}: rate ${j.rate}, due ${j.due} at tick ${st.tick}`);
        if (n > 0 && (q[n - 1].due > j.due || (q[n - 1].due === j.due && q[n - 1].id >= j.id))) bad.push(`${at}: out of order`);
        const h = j.hours ?? KS[j.kind].hours, want = j.at + Math.max(1, Math.ceil(((h - j.done) / j.rate) * TICKS - 1e-7));
        if (j.due !== want) bad.push(`${at}: due ${j.due}, its done and rate give ${want}`);
      });
    }
    for (const j of st.jobs.values()) {
      const at = `jobs[${j.key}]`, full = (KS[j.kind].attention || 'full') === 'full';
      if (j.at === undefined) {
        if (j.rate !== undefined) bad.push(`${at}: a rate ${j.rate} never reckoned`);
        continue;
      }
      if (!Number.isInteger(j.at) || j.at > st.tick || !(j.rate >= 0) || !Number.isFinite(j.rate) || !(j.done >= 0)) bad.push(`${at}: at ${j.at}, rate ${j.rate}, done ${j.done}`);
      if (full) {
        const hands = j.claims.filter((id) => st.agents[id].job === j && st.agents[id].phase === 'work');
        if (hands.length === 0 && j.rate > 0) bad.push(`${at}: a rate of ${j.rate} with no hand at work`);
        if (hands.some((id) => globalThis.VB['sim/work'].rateOf(st, st.pawns[id]) > 0) && !(j.rate > 0)) bad.push(`${at}: hands at work (${hands}) and no rate`);
        if (j.rate > 0 && !inQ.has(j)) bad.push(`${at}: under work, not in workDue`);
        if (j.rate > 0 && !(j.done < (j.hours ?? KS[j.kind].hours))) bad.push(`${at}: done ${j.done} of ${j.hours ?? KS[j.kind].hours} while worked`);
        if (globalThis.VB['sim/work'].doneOf(st, j) < j.done - 1e-9) bad.push(`${at}: progress now ${globalThis.VB['sim/work'].doneOf(st, j)} below its last reckoning ${j.done}`);
      } else if (j.rate > 0 && !inQ.has(j)) bad.push(`${at}: minded at the side, not in workDue`); // a background task (VB-473)
    }
    for (const a of st.agents) if ('work' in a) bad.push(`agents[${a.id}]: rows (a.work) in the state`);
  }
  // loads lying where their carrier fell (VB-611, sim/lying): absent or a non-empty list in the order put down, ids distinct, rising and
  // within st.lyingSeq; each of a kind that carries a load (one with a fetch kind), a load above 0, on a tile of the map, put down this
  // year at most (the autumn frost rots them all), owned by a household or village that exists
  if (st.lying !== undefined) {
    const KS = globalThis.VB['sim/kinds'].KINDS, L = globalThis.VB['sim/lying'], { YEAR } = globalThis.VB['sim/rules'];
    if (!Array.isArray(st.lying) || !st.lying.length) bad.push(`lying: ${Array.isArray(st.lying) ? 'empty' : typeof st.lying}`);
    else st.lying.forEach((l, n) => {
      const at = `lying[${n}] (${l.id})`, prev = st.lying[n - 1], o = l.owner;
      if (!Number.isInteger(l.id) || !(l.id <= st.lyingSeq) || (prev && !(prev.id < l.id && prev.t <= l.t))) bad.push(`${at}: id ${l.id} out of order, or past lyingSeq ${st.lyingSeq}`);
      if (!KS[l.kind] || !KS[L.fetchKey(l.kind)]) bad.push(`${at}: kind ${l.kind} has no fetching`);
      if (!(l.n > 0) || !Number.isFinite(l.n)) bad.push(`${at}: a load of ${l.n}`);
      if (!Number.isInteger(l.tile) || l.tile < 0 || l.tile >= st.w.COLS * st.w.ROWS) bad.push(`${at}: on tile ${l.tile}`);
      if (!(l.t <= st.t) || !(st.t - l.t < YEAR)) bad.push(`${at}: put down at ${l.t}, a year or more ago (the frost rots it)`);
      if (!o || !((o.type === 'household' && st.households[o.id]) || (o.type === 'village' && st.villages[o.id]))) bad.push(`${at}: owner ${JSON.stringify(o)}`);
      if (!l.of || !Number.isInteger(l.of.src)) bad.push(`${at}: no task tile`);
      if (l.kind === 'leftCart' && !(o && o.type === 'household' && st.households[o.id] && st.households[o.id].carts.some((c) => c.at && c.kind === l.of.cart.kind && c.built === l.of.cart.built)))
        bad.push(`${at}: a cart left standing that its household does not have out`);
    });
  }
  // a load on the road (VB-335): a whole number of rations above 0 only while carrying home; the barn's threshed count is a whole number
  // or while cutting the next load beside a cart with room (sim/agents stepWork, a kind's `stack`: firewood), or out with a cart taken
  // at the house, on the way and at the work (the water's barrel: the job names its cart, VB-1586)
  for (const a of st.agents) if (a.load && !(a.load > 0 && (a.phase === 'back' || (a.phase === 'work' && a.job && VB['sim/kinds'].KINDS[a.job.kind].stack) || ((a.phase === 'go' || a.phase === 'work') && a.job && a.job.cart)))) bad.push(`agents[${a.id}]: a load of ${a.load} in phase ${a.phase}`);
  // a full task in hand (agent.job) only on the way to it, at it or bringing its load in: a hand sent home or left free has let it go, and
  // holds no claim a task's pace is reckoned from (VB-1565; sim/agents release, the verb goHome)
  for (const a of st.agents) if (a.job && !['go', 'work', 'back'].includes(a.phase)) bad.push(`agents[${a.id}]: holds job ${a.job.key} in phase ${a.phase}`);
  for (const h of st.households) if (h.threshed !== undefined &&
    !(Number.isInteger(h.threshed) && h.threshed >= 0)) bad.push(`households[${h.id}]: threshed ${h.threshed}`);
  // the hour of a pawn's last talk with a friend (agent.talk.friendAt, VB-062): a finite hour, no later than a talk begun now can show (two
  // talks in one hour may be shown in either order, so it may follow the latest talk's own hour)
  // a pawn's pastime (agent.pastime, VB-1552): a kind of the table, begun no later than now, with a pawn and at a farm there are
  for (const a of st.agents) if (a.pastime !== undefined) { const r = a.pastime; if (!(r && Object.hasOwn(VB['sim/pastimes'].PASTIMES, r.kind) && r.at <= st.t + 1e-9 && r.until >= r.at && (r.with === null || !!st.pawns[r.with]) && (r.farm === null || !!st.farmsteads[r.farm]))) bad.push(`agents[${a.id}].pastime: ${JSON.stringify(r)}`); }
  for (const a of st.agents) if (a.talk && a.talk.friendAt !== undefined && !(Number.isFinite(a.talk.friendAt) && a.talk.friendAt <= st.t + VB['sim/ties'].SOCIAL.talk.bubbleHours + 1e-9)) bad.push(`agents[${a.id}].talk: friendAt ${a.talk.friendAt}, after now (${st.t}) and a talk's bubble`);
  for (const a of st.agents) if (a.job && !a.job.claims.includes(a.id)) bad.push(`agents[${a.id}]: job ${a.job.key} does not list it among its workers`);
  // assignments numbered (VB-1405): three slot numbers, none above the count taken, and once numbered a slot that holds a task has one
  for (const a of st.agents) {
    const n = a.assigned;
    if (n === undefined) continue; // none taken yet, or a save made before VB-1405
    if (!Number.isInteger(n.assignments) || Object.keys(n).length !== 4) bad.push(`agents[${a.id}].assigned: ${JSON.stringify(n)}`);
    for (const slot of ['full', 'partial', 'background'])
      if (!(n[slot] === null || (Number.isInteger(n[slot]) && n[slot] >= 1 && n[slot] <= n.assignments))) bad.push(`agents[${a.id}].assigned.${slot}: ${n[slot]} of ${n.assignments}`);
    if ((a.job && n.full === null) || (a.side && a.side.partial && n.partial === null) || (a.side && a.side.background && n.background === null)) bad.push(`agents[${a.id}]: a task held with no number`);
  }
  // side tasks (VB-251): at most one partial and one background task, each of its attention, posted and listing the pawn, a living one
  for (const a of st.agents) {
    if (a.side === undefined) continue;
    const K = globalThis.VB['sim/kinds'].KINDS;
    if (!a.side || (!a.side.partial && !a.side.background)) bad.push(`agents[${a.id}]: an empty side`);
    if (st.pawns[a.id].died !== null) bad.push(`agents[${a.id}]: a dead pawn holds a side task`);
    for (const slot of ['partial', 'background']) {
      const j = a.side && a.side[slot];
      if (!j) continue;
      if ((K[j.kind].attention || 'full') !== slot) bad.push(`agents[${a.id}]: holds ${j.key} as ${slot}, not its attention`);
      if (st.jobs.get(j.key) !== j || !j.claims.includes(a.id)) bad.push(`agents[${a.id}]: holds ${j.key}, not posted or not listing it`);
    }
  }
  if (st.herds) checkHerds(st, bad);
  // sleep owed (VB-1645, sim/sleepers): a living pawn's absent until first reckoned, else {owed within 0 and SLEEP.cap, asleep, at a step
  // not ahead of the clock, until null or a time}
  {
    const CAP = globalThis.VB['sim/sleep'].SLEEP.cap;
    for (const id of st.living || []) {
      const sl = st.pawns[id].sleep;
      if (sl !== undefined && !(sl && sl.owed >= 0 && sl.owed <= CAP && typeof sl.asleep === 'boolean' && Number.isInteger(sl.at) && sl.at <= st.tick && (sl.until === null || Number.isFinite(sl.until)))) bad.push(`pawns[${id}]: sleep ${JSON.stringify(sl)}`);
    }
  }
  // the player (VB-169): null, or a pawn that exists with a queue of at most 8 of its own commands, of which only the head may be begun
  if (st.player !== null && st.player !== undefined) {
    const pl = st.player, QUEUE_MAX = globalThis.VB['sim/player'].QUEUE_MAX;
    if (!st.pawns[pl.pawn] || !st.agents[pl.pawn]) bad.push(`player: pawn ${pl.pawn} does not exist`);
    if (typeof pl.auto !== 'boolean' || !(pl.since <= st.t)) bad.push(`player: auto ${pl.auto}, since ${pl.since}`);
    // its sleep owed is its pawn's since VB-1645: only a save made from VB-1643 to then holds it, until the next step hands it over
    const sl = pl.sleep, CAP = globalThis.VB['sim/sleep'].SLEEP.cap;
    if (sl !== undefined && !(sl && sl.owed >= 0 && sl.owed <= CAP && typeof sl.asleep === 'boolean' && Number.isInteger(sl.at) && sl.at <= st.tick)) bad.push(`player: sleep ${JSON.stringify(sl)}`);
    if (!Array.isArray(pl.queue) || pl.queue.length > QUEUE_MAX) bad.push(`player: a queue of ${pl.queue && pl.queue.length} commands`);
    else pl.queue.forEach((c, n) => {
      if (c.source !== 'player' || c.actor !== pl.pawn || typeof c.verb !== 'string') bad.push(`player.queue[${n}]: ${JSON.stringify(c)}`);
      if (!(c.begun === null || (n === 0 && c.begun <= st.t))) bad.push(`player.queue[${n}]: begun ${c.begun}`);
      // its reference (VB-1405): null until begun, then plain data or null; absent only in a command begun before VB-1405
      if (c.ref === undefined ? c.begun === null : (c.ref !== null && (c.begun === null || typeof c.ref !== 'object'))) bad.push(`player.queue[${n}]: ref ${JSON.stringify(c.ref)}, begun ${c.begun}`);
    });
    // its plan (VB-1646): absent until first planned; at most PLAN_MAX kinds of sim/kinds, each once, and tasks of distinct keys; the
    // sleeping hours two distinct hours of the day; a task at a tile (VB-1649, VB-1650) a tile under its chain's name, one a chain a tile and a `what` (VB-1668); the routine's done kinds of its own, on a day not after today; the commands it fed marked
    const pp = pl.plan, PP = globalThis.VB['sim/playerplan'], PC = globalThis.VB['sim/planchains'], KS = globalThis.VB['sim/kinds'].KINDS, hr = (h) => typeof h === 'number' && h >= 0 && h < 24;
    if (pp !== undefined && !(pp && Array.isArray(pp.routine) && pp.routine.length <= PP.PLAN_MAX && pp.routine.every((k) => KS[k])
      && new Set(pp.routine).size === pp.routine.length && (pp.sleep === null || (pp.sleep && hr(pp.sleep.from) && hr(pp.sleep.until) && pp.sleep.from !== pp.sleep.until))
      && Array.isArray(pp.tasks) && pp.tasks.length <= PP.PLAN_MAX && new Set(pp.tasks.map((x) => (x.key === undefined ? `${x.kind} ${x[x.kind]} ${x.what}` : x.key))).size === pp.tasks.length
      && pp.tasks.every((x) => (x.key === undefined ? !!PC.CHAINS[x.kind] && Number.isInteger(x[x.kind]) && x.site === x[x.kind]
        : typeof x.key === 'string' && KS[x.kind] && Number.isInteger(x.site))) && Number.isInteger(pp.day) && pp.day * 24 <= st.t
      && Array.isArray(pp.done) && pp.done.every((k) => pp.routine.includes(k)) && new Set(pp.done).size === pp.done.length
      && (pp.last === null || ((typeof pp.last.key === 'string' || (!!PC.CHAINS[pp.last.kind] && Number.isInteger(pp.last[pp.last.kind]) && PC.CHAINS[pp.last.kind].which.includes(pp.last.which))) && pp.last.t <= st.t)))) bad.push(`player.plan: ${JSON.stringify(pp)}`);
    (Array.isArray(pl.queue) ? pl.queue : []).forEach((c, n) => {
      if (c.plan !== undefined && !(c.plan && ['routine', 'task', 'sleep'].includes(c.plan.from))) bad.push(`player.queue[${n}].plan: ${JSON.stringify(c.plan)}`);
    });
    const r = pl.refused;
    // what its death left (VB-213): null while the played pawn lives, and from its death the farm, spouse and friends noted then, no queue
    const lf = pl.left, dead = !!st.pawns[pl.pawn] && st.pawns[pl.pawn].died !== null, TIES_MAX = globalThis.VB['sim/player'].TIES_MAX;
    if (!(pl.ended === null || (dead && pl.ended <= st.t))) bad.push(`player.ended: ${pl.ended} for a pawn ${dead ? 'dead' : 'alive'}`);
    if (dead !== (lf !== null && lf !== undefined)) bad.push(`player.left: ${JSON.stringify(lf)} for a pawn ${dead ? 'dead' : 'alive'}`);
    else if (dead) {
      if (pl.queue.length || !(lf.t <= st.t) || !(lf.held === null || st.households[lf.held]) || !(lf.spouse === null || st.pawns[lf.spouse])
        || !Array.isArray(lf.ties) || lf.ties.length > TIES_MAX || lf.ties.some((x) => !st.pawns[x.id] || typeof x.why !== 'string')) {
        bad.push(`player.left: ${JSON.stringify(lf)}, queue ${pl.queue.length}`);
      }
    }
    // its wishes are its pawn's (pawn.wish, VB-680): a wished partner is living while the played pawn lives
    const pw = st.pawns[pl.pawn] && st.pawns[pl.pawn].wish, mw = pw ? pw.partner : null;
    if (!(mw === null || (st.pawns[mw].alive && st.pawns[pl.pawn].alive))) bad.push(`player's pawn's partner: ${mw}`);
    if ('wishes' in pl) bad.push('player.wishes: the wishes are the pawn\'s (VB-680)');
    if (!(r === null || (typeof r.verb === 'string' && typeof r.why === 'string' && r.t <= st.t))) bad.push(`player.refused: ${JSON.stringify(r)}`);
    // what its acts brought and what moved its levels (VB-1118): the last act at or before now; at most DAYS_KEPT days, in order of time
    const L = pl.last, D = pl.days, DAYS_KEPT = globalThis.VB['sim/player'].DAYS_KEPT;
    if (!(L === null || L === undefined || (typeof L.kind === 'string' && L.t <= st.t && L.n >= 0))) bad.push(`player.last: ${JSON.stringify(L)}`);
    if (D !== undefined && (!Array.isArray(D) || D.length > DAYS_KEPT || D.some((d, k) => !(d.t <= st.t && (k === 0 || D[k - 1].t <= d.t))
      || !(d.health >= 0 && d.health <= 100) || Object.values(d.why).some((x) => !(x >= 0))))) bad.push(`player.days: ${JSON.stringify(D)}`);
  }
  // the asks for goods (VB-699): each open ask under a made good its household asks for, made by now and n > 0, on the basis swap or
  // gift; at most ASKS.cap a household and one a good; the tally's counts whole and none negative, met and lapsed within those asked.
  if (st.asks !== undefined) {
    const { ASKS } = globalThis.VB['sim/asks'], Tg = globalThis.VB['sim/targets'], per = new Map();
    for (const [good, L] of Object.entries(st.asks.open || {})) {
      if (!Tg.isMade(good) || !Array.isArray(L)) { bad.push(`asks: ${good} is not a made good with a list`); continue; }
      const once = new Set();
      for (const a of L) {
        if (!(Number.isInteger(a.household) && st.households[a.household] && a.n > 0 && a.made <= st.t && (a.basis === 'swap' || a.basis === 'gift')) || once.has(a.household))
          bad.push(`asks.open.${good}: ${JSON.stringify(a)}`);
        once.add(a.household);
        per.set(a.household, (per.get(a.household) || 0) + 1);
      }
    }
    for (const [h, n] of per) if (n > ASKS.cap) bad.push(`asks: household ${h} holds ${n} asks, over ${ASKS.cap}`);
    for (const [good, c] of Object.entries(st.asks.tally || {}))
      if (![c.asked, c.met, c.lapsed].every((x) => Number.isInteger(x) && x >= 0) || c.met + c.lapsed > c.asked) bad.push(`asks.tally.${good}: ${JSON.stringify(c)}`);
  }
  // the open offers (VB-293, VB-690): sorted by due, made by now and due after, within a year, and no later than the basis's wait after
  // it was made when the played pawn's answer extended it; ids below st.offerSeq and unique; a known basis; answers by pawns, keys unique,
  // none a no and one at least still to give (an offer closes at a no or at all yes). A match: a man and a woman, the one whose side asks in no other open
  // match and the one asked asked by at most ASK.held (VB-693), its fancy within 0..1; the answers are theirs (by them) and at most one spokesman's a side (by another pawn); its home a household. Goods (a gift,
  // an ask): the parties are households or villages, the terms a positive amount of a good, the asked one answer (key 'to'). Who spoke
  // for whom is checked where the offer is made (tests/offers.js): a spokesman may have changed since. A match may also be answered by
  // the head of the home one of them moves to (key 'head', VB-692). An offer about a life (handover, land, party, place; VB-692): its
  // terms of its basis, its answers by pawns; its subject (the basis's) a living pawn who holds it as pawn.ask; `round`, when present,
  // true. And each pawn's ask (VB-692): null or absent, or the id of an open offer of which it is the subject.
  if (st.offers !== undefined) {
    const { YEAR: Y, ASK: ASKS } = globalThis.VB['sim/rules'], { BASES } = globalThis.VB['sim/offers'], seen = new Set(), ids = new Set(), held = new Map();
    if (!Array.isArray(st.offers) || !Number.isInteger(st.offerSeq) || st.offerSeq < 0) bad.push(`offers: ${typeof st.offers}, offerSeq ${st.offerSeq}`);
    else st.offers.forEach((o, n) => {
      const at = `offers[${n}] (id ${o.id})`;
      if (n > 0 && st.offers[n - 1].due > o.due) bad.push(`${at}: due ${o.due} before the one ahead of it`);
      if (!(o.made <= st.t && o.due > o.made && o.due <= o.made + Y)) bad.push(`${at}: made ${o.made}, due ${o.due}`);
      if (!Number.isInteger(o.id) || o.id < 0 || o.id >= st.offerSeq || ids.has(o.id)) bad.push(`${at}: id against offerSeq ${st.offerSeq}`);
      ids.add(o.id);
      if (!BASES[o.basis]) { bad.push(`${at}: basis ${o.basis}`); return; }
      const keys = (o.answers || []).map((x) => x.key);
      if (new Set(keys).size !== keys.length || !(o.answers || []).every((x) => !!st.pawns[x.by])) bad.push(`${at}: answers ${JSON.stringify(o.answers)}`);
      for (const x of o.answers || []) if (!(x.yes === null || x.yes === true)) bad.push(`${at}: ${x.key} answered ${x.yes}, and the offer is open`);
      if ((o.answers || []).every((x) => x.yes === true)) bad.push(`${at}: all have said yes, and the offer is open`);
      if (o.basis === 'match') {
        const man = o.gives && o.gives.man, woman = o.wants && o.wants.woman, home = o.gives && o.gives.home;
        if (!st.pawns[man] || !st.pawns[woman] || st.pawns[man].sex !== 'm' || st.pawns[woman].sex !== 'f') bad.push(`${at}: man ${man}, woman ${woman}`);
        // the one whose side asks (the man, or the woman: `asker`, VB-693) is in no other open match; the one asked asks in none, and may
        // be asked by up to ASK.held (VB-823)
        const asker = o.asker === 'woman' ? woman : man, asked = o.asker === 'woman' ? man : woman;
        if (o.asker !== undefined && o.asker !== 'woman') bad.push(`${at}: asker ${o.asker}`);
        if (o.fancy !== undefined && !(o.fancy >= 0 && o.fancy <= 1)) bad.push(`${at}: fancy ${o.fancy}`);
        if (seen.has(asker) || held.has(asker)) bad.push(`${at}: pawn ${asker} is in two open offers`);
        seen.add(asker);
        held.set(asked, (held.get(asked) || 0) + 1);
        if (held.get(asked) > ASKS.held || seen.has(asked)) bad.push(`${at}: pawn ${asked} is asked by ${held.get(asked)} open matches`);
        if (!st.households[home] || !Number.isInteger(o.village)) bad.push(`${at}: home ${home}, village ${o.village}`);
        if (!keys.includes('man') || !keys.includes('woman')) bad.push(`${at}: answers ${keys.join()}`);
        for (const x of o.answers || []) {
          const own = x.key === 'man' ? man : x.key === 'woman' ? woman : null, side = x.key === 'manSide' ? man : x.key === 'womanSide' ? woman : null;
          if (x.key === 'head') { if (x.by === man || x.by === woman) bad.push(`${at}: head answered by ${x.by}`); continue; }
          if (own === null && side === null) bad.push(`${at}: an answer of ${x.key}`);
          else if (own !== null ? x.by !== own : x.by === side) bad.push(`${at}: ${x.key} answered by ${x.by}`);
        }
      } else if (o.basis === 'swap') { // a swap of the fair (VB-1598): whole quanta of its goods, both dealers still carrying their loads
        const F = globalThis.VB['sim/fair'], term = (t) => t && F.FAIR.goods.includes(t.good) && Number.isInteger(t.n) && t.n > 0;
        if (!term(o.gives) || !term(o.wants)) bad.push(`${at}: a swap of the fair: gives ${JSON.stringify(o.gives)}, wants ${JSON.stringify(o.wants)}`);
        for (const id of [o.from, o.to]) if (!st.pawns[id] || !st.pawns[id].load) bad.push(`${at}: a swap of the fair outlives the load of pawn ${id}`);
        if (keys.join() !== 'to' || o.answers[0].by !== o.to) bad.push(`${at}: a swap of the fair: answers ${keys.join()} of ${o.to}`);
      } else if (o.basis === 'leave') { // a member's ask of leave (VB-1555): of its household's head, from an hour, a visit named or none
        const hh = st.households[o.household], w = o.wants || {};
        if (!hh || hh.holder !== o.to || !hh.members.includes(o.from) || o.gives !== null) bad.push(`${at}: leave of ${o.from} asked of ${o.to}, household ${o.household}`);
        if (!Number.isFinite(w.from) || !(w.with === null || !!st.pawns[w.with])) bad.push(`${at}: leave wants ${JSON.stringify(w)}`);
        if (keys.join() !== 'head' || o.answers[0].by !== o.to) bad.push(`${at}: answers ${keys.join()} of ${o.to}`);
      } else if (BASES[o.basis].where) { // an offer about a life: answered at a village's step of the round (a handover has no subject, VB-824)
        const g = o.gives || {}, w = o.wants || {};
        const terms = o.basis === 'handover' ? !!st.households[g.household] && ['marriage', 'retirement'].includes(g.reason)
          : o.basis === 'place' || o.basis === 'inheritance' ? !!st.households[g.household]
          : o.basis === 'party' ? !!st.villages[g.from] && Array.isArray(g.all) && g.all[0] === o.from
          : o.basis === 'land' ? (w.farm !== undefined ? !!st.farmsteads[w.farm] : !!st.villages[w.plot]) : false;
        if (!terms) bad.push(`${at}: ${o.basis}: gives ${JSON.stringify(o.gives)}, wants ${JSON.stringify(o.wants)}`);
        if (!(o.answers || []).length) bad.push(`${at}: ${o.basis} with no answer to give`);
      } else {
        const t = o.gives || o.wants, party = (r) => r && (r.household !== undefined ? !!st.households[r.household] : r.village !== undefined && !!st.villages[r.village]);
        if (!!o.gives === !!o.wants || !t || typeof t.good !== 'string' || !(t.n > 0)) bad.push(`${at}: gives ${JSON.stringify(o.gives)}, wants ${JSON.stringify(o.wants)}`);
        if (!o.parties || !party(o.parties.from) || !party(o.parties.to)) bad.push(`${at}: parties ${JSON.stringify(o.parties)}`);
        if (keys.join() !== (Number.isInteger(o.to) ? 'to' : '') || (Number.isInteger(o.to) && o.answers[0].by !== o.to)) bad.push(`${at}: answers ${keys.join()} of ${JSON.stringify(o.to)}`);
      }
      if (o.round !== undefined && o.round !== true) bad.push(`${at}: round ${o.round}`);
      const sub = BASES[o.basis].subject ? BASES[o.basis].subject(st, o) : null;
      if (BASES[o.basis].subject && !(st.pawns[sub] && st.pawns[sub].ask === o.id)) bad.push(`${at}: its subject ${sub} does not hold it`);
    });
    for (const p of st.pawns) {
      if (p.ask === undefined || p.ask === null) continue;
      const o = Array.isArray(st.offers) ? st.offers.find((x) => x.id === p.ask) : null, B = o && BASES[o.basis];
      if (!o || !B.subject || B.subject(st, o) !== p.id) bad.push(`pawn ${p.id}: ask ${p.ask} is no open offer about its future`);
    }
  }
  // the retired's spring advice (VB-1316; sim/advice): pawn.advisedIn absent, or a year not after this one, on a pawn who was retired then
  for (const p of st.pawns) {
    if (p.advisedIn === undefined) continue;
    if (!Number.isInteger(p.advisedIn) || p.advisedIn < 0 || p.advisedIn > Math.floor(st.t / globalThis.VB['sim/rules'].YEAR)) bad.push(`pawn ${p.id}: advisedIn ${p.advisedIn} is no year yet`);
    else if (!p.retired) bad.push(`pawn ${p.id}: advised its head in ${p.advisedIn}, not being retired`);
  }
  // the askings' queue (VB-823; sim/wishes): entries {t, pawn} in order of t, at most one a pawn, each a living pawn's on its asking day
  // (season day pawn mod SEASON_DAYS, at ASK.hour); none for the dead, the married who hold a place (holder or holder's spouse), and
  // none due before a child comes of age (its entry, written at its birth, falls due at the first asking day after its 18th birthday).
  if (st.asking !== undefined) {
    const R = globalThis.VB['sim/rules'], Rec = globalThis.VB['sim/records'], once = new Set();
    const SEASON = R.SEASON_DAYS * R.DAY, grown = (p) => p.born + 18 * R.YEAR;
    if (!Array.isArray(st.asking)) bad.push(`asking: ${typeof st.asking}`);
    else st.asking.forEach((e, n) => {
      const at = `asking[${n}] (pawn ${e.pawn})`, p = st.pawns[e.pawn];
      if (n > 0 && st.asking[n - 1].t > e.t) bad.push(`${at}: due ${e.t} before the one ahead of it`);
      if (!p || once.has(e.pawn)) { bad.push(`${at}: no pawn, or a second entry`); return; }
      once.add(e.pawn);
      if (!p.alive) bad.push(`${at}: the pawn is dead`);
      const day = (((e.t - R.ASK.hour) % SEASON) + SEASON) % SEASON;
      if (Math.abs(day - (e.pawn % R.SEASON_DAYS) * R.DAY) > 1e-6) bad.push(`${at}: due ${e.t}, not on its asking day`);
      if (grown(p) > st.t && e.t < grown(p)) bad.push(`${at}: due ${e.t}, before it comes of age (born ${p.born})`);
      const sp = Rec.spouseOf(st, p.id);
      if (sp !== null && (Rec.holdingOf(st, p.id) !== null || Rec.holdingOf(st, sp) !== null)) bad.push(`${at}: married, and holds a place`);
    });
    // and every living unmarried pawn not retired has its entry: the queue is the index of those an asking may ask (sim/asking)
    if (Array.isArray(st.asking))
      for (const id of st.living || []) {
        const p = st.pawns[id];
        if (!once.has(id) && !p.retired && Rec.spouseOf(st, id) === null) bad.push(`pawn ${id}: unmarried, and no asking`);
      }
  }
  // the queue by village (VB-1169; sim/wishes): a cache of st.asking, each entry filed under the village its pawn lives in (none for a pawn
  // of no household), in the order the queue holds them, and nothing else
  if (st.asking !== undefined && Array.isArray(st.asking)) {
    const Rec = globalThis.VB['sim/records'], by = st.askingBy;
    if (!by || typeof by !== 'object') bad.push(`askingBy: ${typeof by}`);
    else {
      const want = {};
      for (const e of st.asking) {
        const v = Rec.settlementIdOf(st, st.pawns[e.pawn]);
        if (e.v !== v) bad.push(`asking: pawn ${e.pawn} filed under village ${e.v}, lives in ${v}`);
        if (v !== null) (want[v] = want[v] || []).push(e.pawn + '@' + e.t);
      }
      for (const v of new Set([...Object.keys(want), ...Object.keys(by)])) {
        // the order of those due at the same time may differ (a pawn refiled after a move goes behind its equals)
        const key = (a) => a.slice().sort((x, y) => x.split('@')[1] - y.split('@')[1] || x.split('@')[0] - y.split('@')[0]).join();
        const have = key((by[v] || []).map((e) => e.pawn + '@' + e.t)), wants = key(want[v] || []);
        if (have !== wants) bad.push(`askingBy[${v}]: ${have}, the queue gives ${wants}`);
      }
    }
  }
  // the visits planned (VB-289; sim/visits): in the order of their due, each due at a 6:00, one a pawn, to a village, from a household; and
  // a pawn's last visit, {village, year}, null on the dead and the married
  if (st.visits !== undefined) {
    const R = globalThis.VB['sim/rules'], Rec = globalThis.VB['sim/records'], once = new Set();
    if (!Array.isArray(st.visits)) bad.push(`visits: ${typeof st.visits}`);
    else st.visits.forEach((e, n) => {
      const at = `visits[${n}] (pawn ${e.pawn})`;
      if (n > 0 && st.visits[n - 1].due > e.due) bad.push(`${at}: due ${e.due} before the one ahead of it`);
      if (!st.pawns[e.pawn] || once.has(e.pawn)) bad.push(`${at}: no such pawn, or two plans`);
      once.add(e.pawn);
      if (!st.villages[e.village] || !st.households[e.household]) bad.push(`${at}: village ${e.village}, household ${e.household}`);
      if (!Number.isFinite(e.due) || Math.abs(e.due - Math.floor(e.due / R.DAY) * R.DAY - R.WORK[0]) > 1e-6) bad.push(`${at}: due ${e.due}, not at ${R.WORK[0]}:00`);
    });
    for (const p of st.pawns) {
      const v = p.visited;
      if (v === undefined || v === null) continue;
      if (!st.villages[v.village] || !Number.isInteger(v.year)) bad.push(`pawns[${p.id}]: visited ${JSON.stringify(v)}`);
      if (!p.alive || Rec.spouseOf(st, p.id) !== null) bad.push(`pawns[${p.id}]: visited kept by one dead or married`);
    }
  }
  // the stays away (VB-783; the journeys, VB-287, among them): in the order they began (by id; VB-473: a journey's legs are its pawn's), ids below
  // st.awaySeq and unique, one stay a pawn, each pawn living, the food it carries never below 0, agent.away its index (the stay's id on its
  // pawn's agent, absent on every other). A journey (bed null, roof 'none'): `to` its household's house, and its pawn in phase 'journey' or
  // 'road' exactly when it is on one. A lodger: its bed a tile and its walk there, `to` its bed, roof 'none' or 'house', a guest's bed the
  // house of its host, another household (roof 'house', or 'barn' at a gathering, VB-295); its pawn never on the road; one for an occasion
  // (until) has a bed and no tasks.
  // VB-1175: a pawn walking home to pack for a stay (agent.packing) is not away yet: no stay of its own, a tile to lodge at and the verb's args
  (st.agents || []).forEach((a, id) => {
    if (!a || a.packing === undefined) return;
    const t = a.packing;
    if (a.away !== undefined || !t || !Number.isInteger(t.at) || t.at < 0 || t.at >= st.w.N || !t.args || typeof t.args.why !== 'string') bad.push(`agent ${id}: packing ${JSON.stringify(t)} while away ${a.away}`);
  });
  // VB-1240: a small child fetched to its new home: agent.awaits -1 or a pawn (of its household when the fetch was made: one broken off
  // is let go at the day's end); agent.fetching {at (a tile), led}, its pawn on no journey
  (st.agents || []).forEach((a, id) => {
    if (!a) return;
    if (a.awaits !== undefined) {
      const b = a.awaits, hh = st.pawns[id].household;
      if (!Number.isInteger(b) || b < -1 || (b >= 0 && !st.pawns[b]) || hh === null) bad.push(`agent ${id}: awaits ${b}, of household ${hh}`);
    }
    if (a.fetching !== undefined) {
      const f = a.fetching;
      if (!f || !Number.isInteger(f.at) || f.at < 0 || f.at >= st.w.N || typeof f.led !== 'boolean' || a.phase === 'journey') bad.push(`agent ${id}: fetching ${JSON.stringify(f)} in phase ${a.phase}`);
    }
  });
  if (st.away !== undefined) {
    const seen = new Set(), ids = new Set();
    if (!Array.isArray(st.away) || !Number.isInteger(st.awaySeq) || st.awaySeq < 0) bad.push(`away: ${typeof st.away}, seq ${st.awaySeq}`);
    else st.away.forEach((j, n) => {
      const at = `away[${n}] (id ${j.id})`, p = st.pawns[j.pawn];
      if (n > 0 && st.away[n - 1].id >= j.id) bad.push(`${at}: began before the one ahead of it`);
      if (!Number.isInteger(j.id) || j.id < 0 || j.id >= st.awaySeq || ids.has(j.id)) bad.push(`${at}: id against awaySeq ${st.awaySeq}`);
      ids.add(j.id);
      if (!p || !p.alive || seen.has(j.pawn)) bad.push(`${at}: pawn ${j.pawn} dead, missing or away twice`);
      seen.add(j.pawn);
      if (!st.agents[j.pawn] || st.agents[j.pawn].away !== j.id) bad.push(`${at}: its pawn's agent.away is ${st.agents[j.pawn] && st.agents[j.pawn].away}`);
      if (!(j.food >= 0)) bad.push(`${at}: food ${j.food}`);
      if (j.noWater !== undefined && !(Number.isInteger(j.noWater) && j.noWater <= Math.floor(st.t / VB['sim/rules'].DAY) && j.bed !== null && j.host === undefined)) bad.push(`${at}: noWater ${j.noWater}, bed ${j.bed}, host ${j.host}`); // VB-1601
      if (j.until !== undefined && (j.bed === null || !(j.until > 0) || (j.jobs || []).length)) bad.push(`${at}: a stay for an occasion until ${j.until}, bed ${j.bed}, jobs ${j.jobs}`);
      if (j.why === 'visit' && j.village !== undefined && j.bed !== null) {
        // VB-1151: a visitor's bed at his host's door: the house of another household of the village visited, under its roof, while he is its guest
        const host = j.host === undefined ? null : st.households[j.host];
        if (!host || host.dissolved || j.roof !== 'house' || j.bed !== st.farmsteads[host.farmstead].house || !j.guest || !j.back || (p && p.household === host.id) || st.farmsteads[host.farmstead].village !== j.village) bad.push(`${at}: a visitor's bed ${j.bed}, roof ${j.roof}, host ${j.host}`);
      } else if (j.bed !== null) {
        const host = j.host === undefined ? null : st.households[j.host];
        if (!Number.isInteger(j.bed) || j.bed < 0 || j.bed >= st.w.N || j.to !== j.bed || !(j.walk >= 0) || !Array.isArray(j.jobs)) bad.push(`${at}: a lodger's bed ${j.bed}, to ${j.to}, walk ${j.walk}`);
        if (host ? (j.roof !== 'house' && j.roof !== 'barn') || st.farmsteads[host.farmstead].house !== j.bed || (p && p.household === host.id) : j.roof !== 'none' && j.roof !== 'booth') bad.push(`${at}: roof ${j.roof}, host ${j.host}`);
        const ph = st.agents[j.pawn] && st.agents[j.pawn].phase;
        if (ph === 'journey' || ph === 'road') bad.push(`${at}: a lodger in phase ${ph}`);
        return;
      }
      if (j.roof !== (j.host !== undefined ? 'house' : 'none')) bad.push(`${at}: a journey under roof ${j.roof}`);
      const bearing = j.why === 'carry' && !j.back; // VB-291: a carrier bound for the receiver's house, with his gift
      // VB-461: a fetch with its gift is its pawn's household's (or was, while it holds a load); the grain in transit is on the pawn, bound for that house, and none is on
      // him on his way out to the place its first stop names; each stop holds grain set aside, by crop
      const g = (j.why === 'fetch' || j.why === 'haul') && j.gift ? j.gift : null;
      if (g) {
        const haul = j.why === 'haul', house = haul ? st.villages[g.village].center : st.farmsteads[st.households[g.to].farmstead].house, sum = (o) => Object.values(o || {}).reduce((x, y) => x + y, 0);
        // a fetcher whose household changed on the road brings in the load he holds first (sim/away, retarget), then walks to his own
        if (!p || (p.household !== g.to && !(g.held > 0))) bad.push(`${at}: a fetch for household ${g.to} by pawn ${j.pawn} of ${p && p.household}`);
        if (!(g.held >= 0) || Math.abs(sum(g.parts) - g.held) > 1e-6 * Math.max(1, g.held) || !Array.isArray(g.stops)) bad.push(`${at}: a fetch holding ${g.held}, parts ${JSON.stringify(g.parts)}`);
        else if (g.held > 0 ? j.to !== house : !g.stops.length || j.to !== g.stops[0].at) bad.push(`${at}: a fetch holding ${g.held} bound for ${j.to}`);
        for (const s of g.stops || []) if (!(s.left > 0) || Math.abs(sum(s.parts) - s.left) > 1e-6 * Math.max(1, s.left) || (s.from === null) === (s.village === null)) bad.push(`${at}: a stop ${JSON.stringify(s)}`);
      } else if (bearing ? !j.gift || !(j.gift.n > 0) || st.farmsteads[st.households[j.gift.to].farmstead].house !== j.to : (j.gift || false) && j.gift !== null) bad.push(`${at}: a gift ${JSON.stringify(j.gift)} on a journey ${j.why}, back ${j.back}`);
      const visiting = j.why === 'visit' && !j.back; // VB-289: a visitor bound for the green of the village he visits
      if (j.why === 'visit' && (!st.villages[j.village] || !(j.stay >= 0) || typeof j.back !== 'boolean' || (visiting && j.to !== st.villages[j.village].center))) bad.push(`${at}: a visit to village ${j.village}, to ${j.to}, stay ${j.stay}, back ${j.back}`);
      if (!bearing && !visiting && !g && p && p.household !== null && st.farmsteads[st.households[p.household].farmstead].house !== j.to) bad.push(`${at}: to ${j.to}, not its household's house`);
      if (!['move', 'carry', 'fetch', 'haul', 'visit'].includes(j.why) || 'due' in j) bad.push(`${at}: why ${j.why}, due ${j.due}`);
      const ph = st.agents[j.pawn] && st.agents[j.pawn].phase;
      if (ph !== 'journey' && ph !== 'road') bad.push(`${at}: its pawn is in phase ${ph}`);
    });
    for (const a of st.agents) {
      if ((a.phase === 'journey' || a.phase === 'road') && !seen.has(a.id)) bad.push(`agent ${a.id}: phase ${a.phase} and on no journey`);
      if (a.away !== undefined && !seen.has(a.id)) bad.push(`agent ${a.id}: away ${a.away}, and in no stay`);
    }
  }
  // the booths (VB-784): ids below st.boothSeq, unique and in order, on a tile with nobody else's booth, for a household, raised (VB-1172:
  // staked is its maker's plan), its condition in 0..1 at a time not after now (a gone one is not here), and a stay under a booth's roof at a standing booth's tile, at most BOOTH.sleeps
  if (st.booths !== undefined) {
    const tiles = new Set(), under = new Map();
    for (const s of st.away) if (s.roof === 'booth') under.set(s.bed, (under.get(s.bed) || 0) + 1);
    st.booths.forEach((b, n) => {
      const at = `booths[${n}] (id ${b.id})`;
      if (!Number.isInteger(b.id) || b.id < 0 || b.id >= st.boothSeq || (n > 0 && st.booths[n - 1].id >= b.id)) bad.push(`${at}: id against boothSeq ${st.boothSeq}`);
      if (tiles.has(b.tile)) bad.push(`${at}: two booths on tile ${b.tile}`);
      tiles.add(b.tile);
      if (!st.households[b.by]) bad.push(`${at}: for no household`);
      if (!(b.built <= st.t) || !(b.cond >= 0 && b.cond <= 1) || b.condAt < b.built || b.condAt > st.t) bad.push(`${at}: condition ${b.cond} at ${b.condAt}, built ${b.built}`);
      if (!(b.wood >= 0)) bad.push(`${at}: wood ${b.wood}`);
      // its water (VB-1601): a source found once, a tile of the map or none; the day its water last came in not after today, its marsh day never after that
      if (b.water !== undefined && !(Number.isInteger(b.water.tile) && b.water.tile >= -1 && b.water.tile < st.w.N && b.water.walk >= 0 && (b.water.tile >= 0) === (b.water.cls > 0))) bad.push(`${at}: water ${JSON.stringify(b.water)}`);
      if (b.waterDay !== undefined && !(Number.isInteger(b.waterDay) && b.waterDay <= Math.floor(st.t / VB['sim/rules'].DAY))) bad.push(`${at}: waterDay ${b.waterDay}`);
      if (b.marshDay !== undefined && !(b.marshDay <= b.waterDay)) bad.push(`${at}: marshDay ${b.marshDay} against waterDay ${b.waterDay}`);
      if ((under.get(b.tile) || 0) > VB['sim/rules'].BOOTH.sleeps) bad.push(`${at}: more than it sleeps`);
    });
    for (const t of under.keys()) if (!tiles.has(t)) bad.push(`a stay under a booth's roof at tile ${t}, where none stands`);
    // a booth staked and not raised (VB-1172): its maker's plan, its id below boothSeq and none other's, on a tile where none stands or is
    // staked, its wood brought not below none
    const ids = new Set(st.booths.map((b) => b.id));
    for (const list of (st.plans && st.plans.projects ? st.plans.projects.pawn.values() : []))
      for (const plan of list) {
        if (plan.what !== 'booth') continue;
        const at = `the staked booth ${plan.booth} (plan ${plan.id})`;
        if (!Number.isInteger(plan.booth) || plan.booth >= st.boothSeq || ids.has(plan.booth)) bad.push(`${at}: id against boothSeq ${st.boothSeq}`);
        if (tiles.has(plan.tile)) bad.push(`${at}: on tile ${plan.tile}, where a booth stands or is staked`);
        if (!(plan.steps[0].wood >= 0) || !Array.isArray(plan.guests)) bad.push(`${at}: wood ${plan.steps[0].wood}, guests ${plan.guests}`);
        ids.add(plan.booth);
        tiles.add(plan.tile);
      }
  }
  // the hard rule (VB-461): no gift's grain changes place at once between two farmsteads, or from a village store to a household
  const VBc = globalThis.VB && globalThis.VB.count;
  if (VBc && VBc.giftUncarried) bad.push(`gifts: ${VBc.giftUncarried} grain settled at once between two places`);
  // the occasions (VB-126): sorted by due, ids below st.occasionSeq and unique, due at most at the end, which is after the start (not
  // after now: a test may set the clock forward, and the next step ends it); the asked are in order of setting out, each once, and none of them has set out; a pawn at an occasion stands at one
  // that is in the queue and lists it among those who came. An ale evening (VB-522) is held for its host, the holder of the farm's
  // household, from the end of work, one a village a day, for at most ALE_EVENING.guests besides the household; a rite on a green at
  // RITE.hour, for nobody in particular.
  for (const p of st.pawns) if (p.called !== undefined && !(p.called <= st.t)) bad.push(`pawns[${p.id}]: called at ${p.called}, after now`);
  if (st.occasions !== undefined) {
    const { ALE_EVENING, RITE, DAY: D } = globalThis.VB['sim/rules'], aleDays = new Set();
    const O = globalThis.VB['sim/occasions'].OCCASIONS, live = new Map();
    if (!Array.isArray(st.occasions) || !Number.isInteger(st.occasionSeq) || st.occasionSeq < 0) {
      bad.push(`occasions: ${typeof st.occasions}, seq ${st.occasionSeq}`);
    } else st.occasions.forEach((o, n) => {
      const at = `occasions[${n}] (id ${o.id})`;
      if (n > 0 && st.occasions[n - 1].due > o.due) bad.push(`${at}: due ${o.due} before the one ahead of it`);
      if (!Number.isInteger(o.id) || o.id < 0 || o.id >= st.occasionSeq || live.has(o.id)) bad.push(`${at}: id against occasionSeq ${st.occasionSeq}`);
      live.set(o.id, o);
      if (!O[o.kind] || o.overrides !== O[o.kind].overrides) bad.push(`${at}: kind ${o.kind}, overrides ${o.overrides}`);
      if (!(o.start < o.end && o.due <= o.end)) bad.push(`${at}: start ${o.start}, end ${o.end}, due ${o.due}`);
      if (!(o.tile >= 0 && o.tile < st.w.N) || !st.villages[o.village] || (o.farm !== null && !st.farmsteads[o.farm])) {
        bad.push(`${at}: tile ${o.tile}, village ${o.village}, farm ${o.farm}`);
      }
      if ((o.kind === 'meeting' || o.kind === 'rite' || o.kind === 'gathering') !== (o.farm === null)) bad.push(`${at}: a ${o.kind} at farm ${o.farm}`);
      if (o.kind === 'ale') {
        const hh = o.farm === null ? null : st.households[st.farmsteads[o.farm].household];
        const day = `${o.village} ${Math.floor(o.start / D)}`, own = hh ? hh.members : [];
        if (o.for.length !== 1 || !hh || hh.holder !== o.for[0]) bad.push(`${at}: an ale evening for ${o.for.join()}, not its farm's holder`);
        if (aleDays.has(day)) bad.push(`${at}: a second ale evening in village ${o.village} that day`);
        aleDays.add(day);
        const guests = [...o.asked.map((g) => g.id), ...o.come].filter((id) => !own.includes(id)).length;
        if (guests > ALE_EVENING.guests) bad.push(`${at}: ${guests} guests asked, over ${ALE_EVENING.guests}`);
      }
      if (o.kind === 'rite' && (o.for.length || ((o.start % D) + D) % D !== RITE.hour)) bad.push(`${at}: a rite for ${o.for.join()} at ${o.start}`);
      const asked = new Set(o.asked.map((g) => g.id));
      if (asked.size !== o.asked.length || o.asked.some((g, k) => !st.pawns[g.id] || (k > 0 && o.asked[k - 1].leave > g.leave) || !(g.hours >= 0))) {
        bad.push(`${at}: asked ${JSON.stringify(o.asked)}`);
      }
      if (o.come.some((id) => asked.has(id)) || new Set(o.come).size !== o.come.length) bad.push(`${at}: came ${o.come.join()}, asked ${[...asked].join()}`);
    });
    for (const a of st.agents) {
      if (a.occasion === null) continue;
      const o = live.get(a.occasion);
      if (!o || !o.come.includes(a.id)) bad.push(`agents[${a.id}]: at occasion ${a.occasion}, which ${o ? 'does not list it' : 'is not in the queue'}`);
    }
  }
  return bad;
}
// Herds (sim/herds, VB-131): each listed by its living household and no other, or emptied with no household; counts whole and not negative;
// cattle heads unique, of a known kind, born in the past; a household's hay and larder not negative.
function checkHerds(st, bad) {
  const { HERD, YEAR } = VB['sim/rules'], seen = new Set(), whole = (n) => Number.isInteger(n) && n >= 0;
  for (const hd of st.herds) {
    const where = `herds[${hd.id}]`;
    // standing away (sim/droving, VB-674): at a farm of the map, on st.herdsAway, owned by a living household that does not list it, or
    // by nobody; only a herd standing away has animals and no household
    const standing = hd.at !== undefined;
    if (standing && !(Number.isInteger(hd.at) && st.farmsteads[hd.at])) bad.push(`${where}: stands at farm ${hd.at}`);
    if (standing !== (st.herdsAway || []).includes(hd.id)) bad.push(`${where}: at ${hd.at}, ${standing ? 'not ' : ''}on herdsAway`);
    // VB-1667: a herd left at the landing its farm's house moved from stands at a tile of the map, away, at its own household's farm
    if (hd.tile !== undefined && !(standing && Number.isInteger(hd.tile) && hd.tile >= 0 && hd.tile < st.w.N && hd.household !== null
      && st.households[hd.household] && st.households[hd.household].farmstead === hd.at)) bad.push(`${where}: stands at tile ${hd.tile}`);
    if (hd.household === null) {
      if (!standing && ((hd.head && hd.head.length) || hd.ewes || hd.rams || hd.lambs)) bad.push(`${where}: animals but no household`);
      continue;
    }
    const hh = st.households[hd.household];
    if (!hh || hh.dissolved) bad.push(`${where}: household ${hd.household} missing or dissolved`);
    else if (hh.herds.filter((id) => id === hd.id).length !== (standing ? 0 : 1))
      bad.push(`${where}: ${standing ? 'standing away but listed' : 'not listed once'} by household ${hd.household}`);
    if (!Number.isInteger(hd.home) || hd.home < 0 || hd.home >= st.w.N) bad.push(`${where}: home tile ${hd.home}`);
    if (hd.species === 'cattle') {
      for (const h of hd.head) {
        if (seen.has(h.id)) bad.push(`${where}: head ${h.id} twice`);
        seen.add(h.id);
        if (!(h.kind in HERD.hay) || h.kind === 'ewe' || h.kind === 'ram' || h.kind === 'lamb') bad.push(`${where}: head ${h.id} of kind ${h.kind}`);
        if (!(h.born <= st.t) || !['f', 'm'].includes(h.sex)) bad.push(`${where}: head ${h.id} born ${h.born}, sex ${h.sex}`);
        // a cow's last calving (VB-135): a game year since she was born, not in the future, and only a cow's (a heifer calves as she turns 3)
        if (h.calved !== undefined && (!Number.isInteger(h.calved) || h.calved > Math.floor(st.t / YEAR) + 1 || h.calved * YEAR < h.born
          || h.kind !== 'cow')) bad.push(`${where}: head ${h.id} (${h.kind}) calved in year ${h.calved}`);
      }
    } else if (hd.species === 'sheep') { for (const k of ['ewes', 'rams', 'lambs']) if (!whole(hd[k])) bad.push(`${where}: ${k} is ${hd[k]}`); }
    else bad.push(`${where}: species ${hd.species}`);
    // cull lists (sim/byre, VB-134) name animals that are there: a head of the herd, or no more sheep of a kind than the flock has
    const n = { ewe: hd.ewes, ram: hd.rams, lamb: hd.lambs };
    for (const e of hd.cull || []) {
      if (hd.species === 'cattle' ? !hd.head.some((h) =>
        h.id === e.head) : !(n[e.sheep]-- > 0)) bad.push(`${where}: cull entry ${JSON.stringify(e)} names no animal`);
    }
    if (!whole(hd.lean || 0) || !whole(hd.unfed || 0)) bad.push(`${where}: lean ${hd.lean}, unfed ${hd.unfed}`);
    // fleeces grown and not yet shorn (sim/byre, VB-679): a sheep flock's, a whole number, one or more
    if (hd.fleece !== undefined && (hd.species !== 'sheep' || !whole(hd.fleece) || hd.fleece < 1)) bad.push(`${where}: fleece ${hd.fleece}`);
    // herding (sim/grazing, VB-136): out with a living pawn, of the household or one working off days it owes it (VB-462, VB-463's keep: the
    // job is the household's, whoever takes it), or by the farm; taken out last on a past day, or never (-1)
    if (hd.herder !== null && !(st.pawns[hd.herder] && st.pawns[hd.herder].alive)) bad.push(`${where}: herder ${hd.herder}`);
    if (!(Number.isInteger(hd.herded) && hd.herded >= -1 && hd.herded <= Math.floor(st.t / 24))) bad.push(`${where}: herded on day ${hd.herded}`);
    // the household's kept pasture (sim/grazing, VB-136): absent, or a tile of the map chosen on a past day
    const pa = hh && hh.pasture;
    if (pa !== undefined && !(pa && Number.isInteger(pa.tile) && pa.tile >= 0 && pa.tile < st.w.N && Number.isInteger(pa.since)
      && pa.since <= Math.floor(st.t / 24))) bad.push(`households[${hd.household}]: pasture ${JSON.stringify(pa)}`);
  }
  if (st.herdsAway !== undefined && !(Array.isArray(st.herdsAway) && st.herdsAway.length && new Set(st.herdsAway).size === st.herdsAway.length
    && st.herdsAway.every((id) => st.herds[id] && st.herds[id].at !== undefined))) bad.push(`herdsAway: ${JSON.stringify(st.herdsAway)}`);
  for (const hh of st.households) {
    for (const id of hh.herds || []) if (!st.herds[id] || st.herds[id].household !== hh.id) bad.push(`households[${hh.id}]: lists herd ${id}, not its own`);
    if (!(Number.isFinite(hh.haySpoilt) && hh.haySpoilt >= 0)) bad.push(`households[${hh.id}]: haySpoilt is ${hh.haySpoilt}`);
    if (!(hh.hay >= 0)) bad.push(`households[${hh.id}]: hay is ${hh.hay}`);
    const KINDS = ['meat', 'salt meat', 'smoked meat', 'milk', 'butter', 'dried fish'];
    for (const l of hh.larder ||
      []) if (!(l.n > 0 && KINDS.includes(l.kind) && Number.isFinite(l.until))) bad.push(`households[${hh.id}]: larder lot ${JSON.stringify(l)}`);
    if (hh.milkDay !== undefined &&
      !(Number.isInteger(hh.milkDay) && hh.milkDay >= -1 && hh.milkDay <= st.t / 24)) bad.push(`households[${hh.id}]: milkDay ${hh.milkDay}`);
    if (hh.manure !== undefined && !(hh.manure >= 0)) bad.push(`households[${hh.id}]: manure ${hh.manure}`); // VB-137
    if (hh.wool !== undefined && !(hh.wool >= 0)) bad.push(`households[${hh.id}]: wool ${hh.wool}`); // VB-144
    if (hh.spoilt !== undefined && !(hh.spoilt >= 0)) bad.push(`households[${hh.id}]: spoilt ${hh.spoilt}`); // grain lost in store (balance review)
  }
  // a field's soil (VB-137) between the floor that harvests wear it to and the cap manure raises it to
  const { SOIL, CROPS } = VB['sim/crops'];
  for (const f of st.farmsteads) for (const fd of f.fields) {
    if (!Object.prototype.hasOwnProperty.call(CROPS, fd.crop)) bad.push(`farmsteads[${f.id}].fields[${fd.id}]: crop ${fd.crop} is not in the table`); // VB-346
    if (!(fd.soil >= SOIL.floor - 1e-9 && fd.soil <= Math.max(SOIL.cap, SOIL.fresh) + 1e-9)) bad.push(`farmsteads[${f.id}].fields[${fd.id}]: soil ${fd.soil}`);
    if (!(Number.isFinite(fd.tilth) && fd.tilth >= 0 && fd.tilth <= VB['sim/soil'].TILTH.max && fd.tilthAt <= st.t)) bad.push(`farmsteads[${f.id}].fields[${fd.id}]: tilth ${fd.tilth} at ${fd.tilthAt}`); // VB-717
    if (fd.ditch !== undefined && !(fd.ditch >= 0 && fd.ditch <= 1 && Number.isFinite(fd.ditchAt) && fd.ditchAt <= st.t)) bad.push(`farmsteads[${f.id}].fields[${fd.id}]: ditch ${fd.ditch} at ${fd.ditchAt}`); // VB-721
    if (fd.surplus !== undefined && !(fd.surplus >= 0 && fd.surplus <= VB['sim/soil'].TILTH.surplus + 1e-9 && fd.surplusYear <= Math.floor(st.t / VB['sim/rules'].YEAR))) bad.push(`farmsteads[${f.id}].fields[${fd.id}]: surplus ${fd.surplus} in year ${fd.surplusYear}`); // VB-718
    // VB-348: a fallow field is never sown; a sown field's crop has seed; a winter crop stands across the year's turn, any other is not
    // standing in winter; weeding rounds within the crop's; a rest mark is 0.5 or 1
    const C = CROPS[fd.crop] || {}, at = `farmsteads[${f.id}].fields[${fd.id}]`, standing = ['sown', 'growing', 'ripe'].includes(fd.stage);
    if (C.fallow && (fd.sown !== null || fd.stage === 'plowed' || standing || fd.stage === 'stooks')) bad.push(`${at}: fallow but ${fd.stage}, sown ${fd.sown}`);
    if (fd.sown !== null && !(C.seed > 0)) bad.push(`${at}: sown with ${fd.crop}, which has no seed`);
    if (standing && Math.floor(st.t / VB['sim/rules'].DAY / VB['sim/rules'].SEASON_DAYS) % 4 === 3 && !C.winter && f.household !== null) bad.push(`${at}: ${fd.crop} ${fd.stage} in winter`);
    if (fd.weeds !== undefined && !(Number.isInteger(fd.weeds) && fd.weeds >= 1 && fd.weeds <= (C.weeds || 0))) bad.push(`${at}: weeds ${fd.weeds}`);
    if (fd.rest !== undefined && fd.rest !== 0.5 && fd.rest !== 1) bad.push(`${at}: rest ${fd.rest}`);
  }
  // VB-350: a field's rotation is a known key, the same on every field of its farm (and barley every year on a village's common field);
  // its step is inside the rotation, and the field's crop is the step's course; a village's usual rotation is a known key
  const { ROTATIONS } = VB['sim/crops'];
  const rotOk = (fd, at, only) => {
    const R = ROTATIONS[fd.rotation];
    if (!R || (only && fd.rotation !== only)) bad.push(`${at}: rotation ${fd.rotation}`);
    else if (!(Number.isInteger(fd.step) && fd.step >= 0 && fd.step < R.courses.length) || (R.courses[fd.step] !== fd.crop) !== (fd.turn === true))
      bad.push(`${at}: step ${fd.step} of ${fd.rotation} with ${fd.crop}${fd.turn ? ', out of turn' : ''}`); // VB-355: out of turn, another crop than its course's
    if (fd.turn !== undefined && fd.turn !== true) bad.push(`${at}: turn ${fd.turn}`);
  };
  for (const f of st.farmsteads) for (const fd of f.fields) rotOk(fd, `farmsteads[${f.id}].fields[${fd.id}]`, f.fields[0].rotation);
  for (const f of st.farmsteads) {
    // VB-355: the household whose head chose the farm's rotation to keep; VB-353: the farm's first rotation, the crops it keeps seed of
    if (f.firstRotation !== undefined && !VB['sim/crops'].ROTATIONS[f.firstRotation]) bad.push(`farmsteads[${f.id}]: firstRotation ${f.firstRotation}`);
    if (f.keeps !== undefined && !(Array.isArray(f.keeps) && f.keeps.every((k) => LOADED['sim/stores'].CROP_LIST.includes(k)))) bad.push(`farmsteads[${f.id}]: keeps ${f.keeps}`);
    if (f.rotationBy !== undefined && !(Number.isInteger(f.rotationBy) && st.households[f.rotationBy])) bad.push(`farmsteads[${f.id}]: rotationBy ${f.rotationBy}`);
    // VB-351: the crop last lost on the farm, and the year, kept only where its rotation has two crops or more
    if (f.failed !== undefined && !(f.failed && LOADED['sim/stores'].CROP_LIST.includes(f.failed.crop) && Number.isInteger(f.failed.year) && f.fields.length
      && ROTATIONS[f.fields[0].rotation].courses.filter((k) => VB['sim/crops'].CROPS[k].seed > 0).length >= 2)) bad.push(`farmsteads[${f.id}]: failed ${JSON.stringify(f.failed)}`);
  }
  for (const v of st.villages) {
    if (!ROTATIONS[v.rotation]) bad.push(`villages[${v.id}]: rotation ${v.rotation}`);
    for (const fd of v.commonFields || []) rotOk(fd, `villages[${v.id}].commonFields[${fd.id}]`, 'every');
  }
  // the barn's crops (VB-348): absent, or one known crop for each unthreshed entry
  for (const h of st.households) if (h.sheafCrops !== undefined && !(Array.isArray(h.sheafCrops) && h.sheafCrops.length === h.unthreshed.length &&
    h.sheafCrops.every((c) => LOADED['sim/stores'].CROP_LIST.includes(c)))) bad.push(`households[${h.id}]: sheafCrops ${JSON.stringify(h.sheafCrops)}`);
}
// Goodwill balances (sim/relations, VB-217): none for the dead or with them, at most GOODWILL.cap, each {v, t} with v non-zero and finite,
// t no later than now, mirrored exactly on the other pawn ({v: -v, t}).
const within = (x, lo, hi) => Number.isFinite(x) && x >= lo - 1e-9 && x <= hi + 1e-9;
// VB-523: a pawn's stories: the living only, at most STORY.keep, each of a live story once, its values within bounds
function checkKnown(st, p, bad) {
  const { STORY } = VB['sim/stories'];
  if (!p.alive) { bad.push(`pawns[${p.id}]: dead and holding stories`); return; }
  if (!Array.isArray(p.known) || p.known.length > STORY.keep) { bad.push(`pawns[${p.id}]: ${p.known.length} stories held, over ${STORY.keep}`); return; }
  const seen = new Set();
  for (const e of p.known) {
    const where = `pawns[${p.id}].known<${e.story}>`;
    if (!st.stories || !st.stories.has(e.story)) bad.push(`${where}: no live story`);
    if (seen.has(e.story)) bad.push(`${where}: held twice`);
    seen.add(e.story);
    if (!within(e.v, -1, 1) || !(Number.isInteger(e.hops) && e.hops >= 0) || !within(e.s, 0, 1) || !(e.t <= st.t) ||
      !Array.isArray(e.zeal) || e.zeal.length !== 2 || !e.zeal.every((z) => within(z, 0, 1)) || typeof e.first !== 'boolean' ||
      (e.from !== undefined && e.from !== null && !(Number.isInteger(e.from) && st.pawns[e.from] && e.from !== p.id)))
      bad.push(`${where}: ${JSON.stringify(e)}`);
  }
}
// VB-523: each live story is held by as many living pawns as `held` says, at least one; its kind and parties known
function checkStories(st, bad) {
  if (!st.stories) return;
  const { STORY } = VB['sim/stories'], n = new Map();
  for (const id of st.living) for (const e of st.pawns[id].known || []) n.set(e.story, (n.get(e.story) || 0) + 1);
  for (const [id, s] of st.stories) {
    if (s.id !== id || !STORY.kinds[s.kind] || !st.pawns[s.subject] || (s.other !== null && !st.pawns[s.other]) || !within(s.v, -1, 1) ||
      !(id < st.storySeq) || (s.lie !== undefined && (s.lie !== true || !st.pawns[s.by] || !['enemy', 'player'].includes(s.why))) ||
      (s.counter !== undefined && !(Number.isInteger(s.counter) && s.counter > id))) bad.push(`stories<${id}>: ${JSON.stringify(s)}`);
    if (s.held !== (n.get(id) || 0) || s.held < 1) bad.push(`stories<${id}>: held ${s.held}, by ${n.get(id) || 0} living pawns`);
  }
}
function checkGoodwill(st, p, bad) {
  const { GOODWILL } = VB['sim/rules'];
  if (!p.alive) { bad.push(`pawns[${p.id}]: dead with a goodwill map`); return; }
  if (p.goodwill.size > GOODWILL.cap) bad.push(`pawns[${p.id}]: ${p.goodwill.size} goodwill balances, over the cap of ${GOODWILL.cap}`);
  for (const [j, e] of p.goodwill) {
    const where = `pawns[${p.id}].goodwill<${j}>`, q = st.pawns[j], m = q && q.goodwill && q.goodwill.get(p.id);
    if (j === p.id || !q || !q.alive) { bad.push(`${where}: not a living other pawn`); continue; }
    if (!(Number.isFinite(e.v) && e.v !== 0 && e.t <= st.t)) bad.push(`${where}: ${JSON.stringify(e)} at ${st.t}`);
    if (!m || m.v !== -e.v || m.t !== e.t) bad.push(`${where}: no exact mirror on pawn ${j}`);
  }
}
// Familiarity (sim/relations, VB-127): a living pawn's ties are to other pawns, living or dead since its last renormalisation, finite and
// above 0, at most SOCIAL.ties.cap of them (or its near kin, if more); its scale's start is no later than now, and its waking hours at
// home today are a whole number within the talk hours. (The kin floor is checked in tests/relations.js.)
function checkTies(st, p, bad) {
  const { SOCIAL } = VB['sim/ties'], TIES = SOCIAL.ties, T = SOCIAL.talk;
  if (!(Number.isFinite(p.tieT) && p.tieT <= st.t)) bad.push(`pawns[${p.id}]: tieT ${p.tieT} at ${st.t}`);
  if (!(Number.isInteger(p.homeHours) && p.homeHours >= 0 && p.homeHours <= T.to - T.from)) bad.push(`pawns[${p.id}]: homeHours ${p.homeHours}`);
  if (!p.alive) return;
  const kin = VB['sim/records'].kinNear(st, p.id).filter((q) => st.pawns[q].alive);
  if (p.ties.size > Math.max(TIES.cap, kin.length)) bad.push(`pawns[${p.id}]: ${p.ties.size} ties, over the cap of ${TIES.cap}`);
  for (const [j, w] of p.ties) {
    const q = st.pawns[j];
    // a tie to one who died is dropped at the death, or, if that pawn had dropped its own tie, when this pawn next renormalises; a death in the very hour of its renormalising (died == tieT) counts as since
    if (j === p.id || !q || (!q.alive && !(q.died >= p.tieT))) bad.push(`pawns[${p.id}].ties<${j}>: not a living other pawn, nor one dead since ${p.tieT}`);
    if (!(Number.isFinite(w) && w > 0)) bad.push(`pawns[${p.id}].ties<${j}>: ${w}`);
  }
}
// Relationship records (sim/relations): about a living other pawn, with known memories within their caps (only of kinds in
// SOCIAL.memories: talk leaves none, VB-240), and none for the dead. Bands (pawn.bands): 1 or -1, about another pawn, none for the dead,
// and agreeing with the opinion within SOCIAL.back and the most it can drift with nothing touching the pair between the season's checks
// (fadeRelations): a tie's affinity fading for a season, each memory fading for a season, and the housemate's bond lost.
function checkRel(st, p, bad) {
  const { SEASON_DAYS, YEAR_DAYS } = VB['sim/rules'], { SOCIAL } = VB['sim/ties'], R = VB['sim/relations'];
  if (!p.alive) {
    if (p.rel.size) bad.push(`pawns[${p.id}]: dead with ${p.rel.size} relationship records`);
    if (p.bands && p.bands.size) bad.push(`pawns[${p.id}]: dead with ${p.bands.size} bands`);
    return;
  }
  if (!(p.bands instanceof Map)) bad.push(`pawns[${p.id}]: no bands`);
  else {
    let drift = SOCIAL.affinity.weight * (1 - Math.pow(2, -SEASON_DAYS / YEAR_DAYS)) + SOCIAL.situational.housemate;
    for (const k in SOCIAL.memories) drift += Math.abs(SOCIAL.memories[k].cap) * SEASON_DAYS / SOCIAL.memories[k].days;
    for (const [j, band] of p.bands) {
      const where = `pawns[${p.id}].bands<${j}>`, q = st.pawns[j];
      if (j === p.id || !q) { bad.push(`${where}: no such other pawn`); continue; }
      if (band !== 1 && band !== -1) bad.push(`${where}: band is ${band}`);
      if (!q.alive) continue; // dropped at the season's pass
      const o = R.opinionOf(st, p.id, j), slack = SOCIAL.back + drift + 1e-9;
      if (band === 1 ? o < SOCIAL.closeFriend - slack : o > SOCIAL.enemy + slack) bad.push(`${where}: band ${band} at opinion ${o.toFixed(3)}`);
    }
  }
  for (const [j, r] of p.rel) {
    const where = `pawns[${p.id}].rel<${j}>`;
    if (j === p.id || !st.pawns[j]) bad.push(`${where}: no such other pawn`);
    const kinds = Object.keys(r.mem);
    if (!kinds.length) bad.push(`${where}: no memories`);
    for (const k of kinds) {
      const K = SOCIAL.memories[k], m = r.mem[k];
      if (!K) { bad.push(`${where}: unknown memory ${k}`); continue; }
      // a breach is felt by honour, its cap up to the most of TRAITS.acts.honour.breach (VB-520)
      const T = globalThis.VB['sim/rules'].TRAITS, felt = T.breach.includes(k) ? Math.max(...T.acts.honour.breach) : 1;
      const cap = K.cap * felt, lo = Math.min(0, cap), hi = Math.max(0, cap);
      if (!(Number.isFinite(m.v) && m.v >= lo - 1e-9 && m.v <= hi + 1e-9)) bad.push(`${where}: ${k} is ${m.v}, outside 0..${cap}`);
      if (!(m.t <= st.t)) bad.push(`${where}: ${k} remembered at ${m.t}, after now (${st.t})`);
    }
  }
}
// A pawn's event modifiers (pawn.mods, sim/mood, VB-062): a list of {key, until}, each key one of sim/mood's event modifiers and at
// most once, until a finite game hour no further ahead than its modifier lasts.
function checkMods(st, p, bad) {
  const { DAY } = VB['sim/rules'], { MOOD } = VB['sim/mood'], { EVENT } = VB['sim/mood'];
  if (!Array.isArray(p.mods)) return void bad.push(`pawns[${p.id}].mods: ${JSON.stringify(p.mods)}, not a list`);
  const seen = new Set();
  for (const m of p.mods) {
    const where = `pawns[${p.id}].mods<${m && m.key}>`;
    if (!m || !EVENT.includes(m.key)) { bad.push(`${where}: unknown modifier`); continue; }
    if (seen.has(m.key)) bad.push(`${where}: twice`);
    seen.add(m.key);
    if (!Number.isFinite(m.until)) bad.push(`${where}: until is ${m.until}`);
    else if (m.until > st.t + MOOD[m.key].days * DAY + 1e-9) bad.push(`${where}: until ${m.until}, past ${MOOD[m.key].days} days from now`);
  }
}
module.exports = { checkState };

// VB-708: pawn.looksTo, a living pawn or null; nobody looks to itself, nor in a cycle, nor while dead; and the index of followers by lord, when
// built, is exactly the living pawns' looksTo
function checkFollowers(st, bad) {
  const seen = new Map();
  for (const p of st.pawns) {
    const l = p.looksTo;
    if (l === undefined || l === null) continue;
    const where = `pawns[${p.id}].looksTo`;
    if (!Number.isInteger(l) || !st.pawns[l]) { bad.push(`${where} is ${l}`); continue; }
    if (!p.alive) { bad.push(`${where}: dead and looks to ${l}`); continue; }
    if (l === p.id) bad.push(`${where}: looks to itself`);
    if (!st.pawns[l].alive) bad.push(`${where}: looks to ${l}, who is dead`);
    for (let x = l, n = 0; x !== null && x !== undefined; x = st.pawns[x].looksTo, n++)
      if (x === p.id || n > st.pawns.length) { bad.push(`${where}: a cycle of lords through ${l}`); break; }
    if (!seen.has(l)) seen.set(l, new Set());
    seen.get(l).add(p.id);
  }
  if (!st.followers) return;
  const key = (m) => [...m].map(([k, v]) => `${k}:${[...v].sort((a, b) => a - b).join(',')}`).sort().join(' ');
  if (key(st.followers) !== key(seen)) bad.push('st.followers does not match the pawns\' looksTo');
}

