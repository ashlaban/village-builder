// State invariants: checkState(st) returns a list of violations, each naming the record. A new state field or record gets its checks here.
const { SYSTEMS } = require('../../src/load.js')['sim/rng'];
const { checkRoles } = require('./owner-caches.js');
const checked = new WeakMap(); // the record's length at the last check, by record
function checkState(st) {
  const bad = [], N = st.w.N, tileOk = (i) => Number.isInteger(i) && i >= 0 && i < N;
  bad.push(...checkRoles(st, globalThis.VB, { allowAgeLag: true }));
  for (const [key, expected] of [
    ['living', st.pawns.filter((p) => p.alive).map((p) => p.id)],
    ['liveHouseholds', st.households.filter((h) => !h.dissolved).map((h) => h.id)],
  ]) {
    if (!Array.isArray(st[key]) || st[key].length !== expected.length || st[key].some((id, i) => id !== expected[i])) {
      bad.push(`${key}: live index differs from its source records`);
    }
  }
  // VB-307: the households to check for a missing adult: live ids, no duplicates
  if (!Array.isArray(st.peopleCheck) || new Set(st.peopleCheck).size !== st.peopleCheck.length
    || st.peopleCheck.some((id) => !st.households[id] || st.households[id].dissolved)) bad.push('peopleCheck: not a list of distinct live household ids');
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
      if (type === 'household') for (const id of map.keys()) if (!st.households[id] || st.households[id].dissolved) bad.push(`plans: dissolved household ${id} keeps a plan`);
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
          if (!(n >= 0) || !Number.isFinite(n) || !STORES.RESERVE.includes(plan.reasons[good]) || (type === 'household' && good !== 'grain' && good !== 'meals')) {
            bad.push(`plans: ${type} ${id} reserves ${n} ${good} for ${plan.reasons[good]}`);
          }
        }
        if (type !== 'household') continue;
        const T = plan.targets;
        if (!T || T.wood.length !== 4 || !T.wood.every((x) => x > 0) || !(T.hayWinters > 0) || !(T.woodSecond >= 0) || !(T.fields >= 0) ||
          !(T.workable >= 0) || !Number.isInteger(plan.tiles?.field) || !Number.isInteger(plan.tiles?.meadow) || plan.reasons.grain !== 'seed') {
          bad.push(`plans: household ${id} lacks its targets, tiles or seed reservation`);
        }
        if (!(T.seed > 0) || !(T.perHand > 0)) bad.push(`plans: household ${id} lacks its seed or fields-per-hand target`);
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
        const key = sp.year * 4 + sp.season;
        if (key > now || (key !== now && plan && plan.last !== null && plan.last >= start)) {
          bad.push(`plans: household ${id}'s seasonal plan is of year ${sp.year}, season ${sp.season}, not of the current one`);
        }
      }
    }
    // VB-249: the due-queue: sorted by hour, then household, then kind; exactly one entry per live household's plan and time-bound kind,
    // none of a dissolved household (an overdue entry is not checked: tests move the clock by hand, and the next review hour asks it)
    const due = st.plans.due, W = globalThis.VB['sim/plans'].WINDOWED;
    if (!Array.isArray(due)) bad.push('plans: no due-queue');
    else {
      const seen = new Set();
      for (let i = 0; i < due.length; i++) {
        const e = due[i], prev = due[i - 1];
        if (!Array.isArray(e) || e.length !== 3 || !Number.isInteger(e[0]) || !Number.isInteger(e[2]) || e[2] < 0 || e[2] >= W.length) {
          bad.push(`plans: due entry ${JSON.stringify(e)} is malformed`); continue;
        }
        if (prev && (prev[0] > e[0] || (prev[0] === e[0] && (prev[1] > e[1] || (prev[1] === e[1] && prev[2] >= e[2]))))) bad.push(`plans: due-queue unsorted at ${i}`);
        if (!st.households[e[1]] || st.households[e[1]].dissolved) bad.push(`plans: due entry for dissolved household ${e[1]}`);
        seen.add(`${e[1]}:${e[2]}`);
      }
      if (seen.size !== due.length || due.length !== st.plans.households.size * W.length) {
        bad.push(`plans: due-queue holds ${due.length} entries (${seen.size} distinct) for ${st.plans.households.size} households`);
      }
    }
    for (const plan of [...st.plans.households.values(), ...st.plans.villages.values()]) {
      if (typeof plan.dirty !== 'boolean' || plan.last === undefined) bad.push(`plans: ${plan.holder.type} ${plan.holder.id} lacks its review record`);
    }
    for (const id of st.living) {
      const d = st.pawns[id].diligence;
      if (d !== undefined && !(d >= 0 && d < 1)) bad.push(`pawn ${id}: diligence ${d}`);
    }
  } else bad.push('plans: missing');
  if (!(st.pathCache instanceof Map) || st.pathCache.size > globalThis.VB['sim/rules'].ROUTE.cacheMax) {
    bad.push('pathCache: exceeds ROUTE.cacheMax or is not a Map');
  }
  // the record of events (VB-075), the events appended since the last check: a kind, a time not after now, ids that exist
  // (a slot folded since, VB-199, is the index of a count of st.recordYears)
  const from = checked.get(st.record) || 0, Y = st.recordYears || [];
  for (let i = from; i < (st.record || []).length; i++) {
    const e = st.record[i], ids = { pawn: st.pawns, other: st.pawns, household: st.households, farm: st.farmsteads, village: st.villages };
    if (typeof e === 'number') { if (!(Number.isInteger(e) && e >= 0 && e < Y.length)) bad.push(`record[${i}]: folded into no count, ${e}`); continue; }
    if (typeof e.kind !== 'string' || !e.kind || !(e.t <= st.t)) bad.push(`record[${i}]: ${JSON.stringify(e)}`);
    if ('self' in e && (e.self !== true || !('pawn' in e))) bad.push(`record[${i}].self: ${JSON.stringify(e)}`);
    for (const [k, list] of Object.entries(ids)) if (k in e && !(Number.isInteger(e[k]) && e[k] >= 0 && e[k] < list.length)) bad.push(`record[${i}].${k}: ${e[k]}`);
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
      && P.shortNext >= F.shortAt && P.shortNext <= P.shortEnd && P.longNext >= F.longAt && P.longNext <= P.longEnd))) bad.push(`recordFold: ${JSON.stringify(F)}`);
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
  // the awake agents of the hour (VB-205): increasing ids of living pawns, and, for the hour it is, every agent the step could move,
  // set working or offer to the planner: walking, working, or in working hours free with its pause ending by the hour's end
  if (st.awake) {
    const { ids, hour } = st.awake, living = new Set(st.living), { WORK, DAY } = globalThis.VB['sim/rules'];
    if (ids.some((id, i) => !living.has(id) || (i > 0 && id <= ids[i - 1]))) bad.push(`awake: ids ${ids} are not increasing living pawns`);
    if (hour === Math.floor(st.t + 1e-9)) {
      const h = ((hour % DAY) + DAY) % DAY, work = h >= WORK[0] && h <= WORK[1], has = new Set(ids);
      for (const id of st.living) {
        const a = st.agents[id];
        if (!has.has(id) && (a.path || a.phase === 'work' || (work && a.phase === null && a.idleUntil <= hour + 1))) {
          bad.push(`awake: agent ${id} may act in hour ${hour} but is not awake`);
        }
      }
    }
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
    if (h.dissolved) { if (h.members.length) bad.push(`households[${h.id}]: dissolved but has members ${h.members}`); continue; }
    if (new Set(h.members).size !== h.members.length) bad.push(`households[${h.id}]: duplicate members ${h.members}`);
    for (const id of h.members) {
      const p = st.pawns[id];
      if (!p) { bad.push(`households[${h.id}]: member ${id} does not exist`); continue; }
      if (!p.alive) bad.push(`households[${h.id}]: member ${id} is dead`);
      if (memberOf.has(id)) bad.push(`pawns[${id}]: in households ${memberOf.get(id)} and ${h.id}`);
      memberOf.set(id, h.id);
    }
    if (h.holder !== null && !h.members.includes(h.holder)) bad.push(`households[${h.id}]: holder ${h.holder} is not a member`);
    if (h.holder !== null && st.pawns[h.holder] && !st.pawns[h.holder].alive) bad.push(`households[${h.id}]: holder ${h.holder} is dead`);
    for (const k of ['grain', 'wood', 'stone', 'meals', 'hungryDays']) if (!within(h[k], 0, 1e6)) bad.push(`households[${h.id}]: ${k} is ${h[k]}`);
    // the larder holds foods eaten as they are (rules FOODS, VB-259)
    const FOODS = globalThis.VB['sim/rules'].FOODS;
    for (const l of h.larder || []) if (!FOODS[l.kind] || !FOODS[l.kind].raw || !within(l.n, 0, 1e6)) bad.push(`households[${h.id}]: larder lot ${JSON.stringify(l)}`);
    // help's seasonal ask (sim/help, VB-222): the season of the last ask, no later than this one
    if (h.askedIn !== undefined && !(Number.isInteger(h.askedIn) && h.askedIn >= 0 && h.askedIn <= Math.floor(st.t / (VB['sim/rules'].SEASON_DAYS * VB['sim/rules'].DAY))))
      bad.push(`households[${h.id}]: askedIn is ${h.askedIn}`);
    const f = st.farmsteads[h.farmstead];
    if (!f || f.household !== h.id) bad.push(`households[${h.id}]: farmstead ${h.farmstead} does not name it`);
    // the index of lines (sim/records, VB-224): a household is found under its farm's line, or with none, its holder
    const line = f && f.line !== null && f.line !== undefined ? f.line : h.holder;
    if (line !== null && !globalThis.VB['sim/records'].householdsOfLine(st, line).includes(h.id))
      bad.push(`households[${h.id}]: not in the index of lines under ${line}`);
  }
  const ledgerKinds = globalThis.VB['sim/stores'].KINDS;
  for (const holder of [...st.households, ...st.villages]) {
    if (!Array.isArray(holder.ledger)) { bad.push(`stores[${holder.id}]: missing ledger`); continue; }
    for (const e of holder.ledger) if (!ledgerKinds.includes(e.kind) || !Number.isFinite(e.n) || !Number.isFinite(e.t) || e.t > st.t
        || e.good !== undefined && !['grain', 'meals', 'sheaves', 'meat', 'milk', 'butter'].includes(e.good)
        || e.stake && !st.pawns[e.pawn]) {
      bad.push(`stores[${holder.id}]: invalid ledger entry ${JSON.stringify(e)}`);
    }
    // VB-204: routine kinds are yearly totals, one per year, kind and good, in year order, none after this year or before the last three
    const S = globalThis.VB['sim/stores'], year = S.yearNow(st), seen = new Set();
    if (!Array.isArray(holder.totals)) { bad.push(`stores[${holder.id}]: missing totals`); continue; }
    for (let i = 0; i < holder.totals.length; i++) {
      const x = holder.totals[i], key = `${x.year}:${x.kind}:${x.good}`;
      if (!S.ROUTINE.includes(x.kind) || !Number.isInteger(x.year) || x.year > year || x.year < year - 3 || !Number.isFinite(x.n)
          || !Number.isInteger(x.count) || x.count < 1 || !['grain', 'meals', 'sheaves', 'milk', 'butter'].includes(x.good) || seen.has(key)
          || i && holder.totals[i - 1].year > x.year) bad.push(`stores[${holder.id}]: invalid total ${JSON.stringify(x)}`);
      seen.add(key);
    }
    if (holder.dissolved && (holder.ledger.length || holder.totals.length)) bad.push(`households[${holder.id}]: dissolved with a ledger`);
  }
  for (const v of st.villages) {
    if (!within(v.grain, 0, 1e6)) bad.push(`villages[${v.id}]: grain is ${v.grain}`);
    // every village has the Culture settlement of the same id (sim/society, addSettlement); moving to new land (sim/settle)
    const s = st.cenv.settlements[v.id];
    if (!s || s.id !== v.id) bad.push(`villages[${v.id}]: no Culture settlement with its id`);
    if (!(Number.isInteger(v.crowded) && v.crowded >= 0)) bad.push(`villages[${v.id}]: crowded is ${v.crowded}`);
    const fd = v.founded;
    if (fd !== null && !(Number.isInteger(fd.from) && fd.from >= 0 && fd.from < v.id && st.pawns[fd.by] && Number.isFinite(fd.t))) {
      bad.push(`villages[${v.id}]: founded is ${JSON.stringify(fd)}`);
    }
  }
  if (st.cenv.settlements.length !== st.villages.length) bad.push(`${st.cenv.settlements.length} settlements for ${st.villages.length} villages`);
  // each culture's order of preference among farm-name generators (sim/names, VB-026): known generators, each once
  const gens = Object.keys(VB['sim/names'].FARM);
  for (const c of st.cenv.cultures) {
    const f = c.namePrefs && c.namePrefs.farm;
    if (!Array.isArray(f) || !f.length || new Set(f).size !== f.length || !f.every((g) => gens.includes(g))) bad.push(`cultures[${c.id}]: namePrefs ${JSON.stringify(c.namePrefs)}`);
  }
  for (const p of st.pawns) {
    if (p.alive) {
      if (!memberOf.has(p.id)) bad.push(`pawns[${p.id}]: alive but in no household`);
      else if (p.household !== memberOf.get(p.id)) bad.push(`pawns[${p.id}]: household field ${p.household}, member of ${memberOf.get(p.id)}`);
      if (p.died !== null) bad.push(`pawns[${p.id}]: alive with died ${p.died}`);
      if (!within(p.buffer, 20, 60)) bad.push(`pawns[${p.id}]: buffer is ${p.buffer}`);
      if (!within(p.health, 0, 100)) bad.push(`pawns[${p.id}]: health is ${p.health}`);
    } else {
      if (memberOf.has(p.id)) bad.push(`pawns[${p.id}]: dead but in household ${memberOf.get(p.id)}`);
      if (p.died === null) bad.push(`pawns[${p.id}]: dead without a died time`);
    }
    if (!within(p.hunger, 0, 1)) bad.push(`pawns[${p.id}]: hunger is ${p.hunger}`);
    if (p.rel) checkRel(st, p, bad);
    if (p.ties) checkTies(st, p, bad);
    if (p.goodwill) checkGoodwill(st, p, bad);
    if (p.kinPush !== null && !(typeof p.kinPush.to === 'string' && within(p.kinPush.w, 0, 1))) bad.push(`pawns[${p.id}]: kinPush is ${JSON.stringify(p.kinPush)}`);
    if (p.landWait !== undefined && !(Number.isInteger(p.landWait) && p.landWait >= 0)) bad.push(`pawns[${p.id}]: landWait is ${p.landWait}`);
  }
  const open = new Map();
  for (const u of st.unions) {
    if (u.end !== null && u.end < u.start) bad.push(`unions[${u.id}]: ends (${u.end}) before it starts (${u.start})`);
    if (u.end === null) for (const id of [u.a, u.b]) {
      if (open.has(id)) bad.push(`pawns[${id}]: open unions ${open.get(id)} and ${u.id}`);
      open.set(id, u.id);
    }
  }
  for (const f of st.farmsteads) {
    const want = f.household === null ? ['derelict', 'ruin'] : ['occupied'];
    if (!want.includes(f.state)) bad.push(`farmsteads[${f.id}]: state ${f.state} with household ${f.household}`);
    // the house's condition (VB-306): 0..1 as last set, at a time not after now, and its tar not further than a barrel's years ahead
    if (!(f.condition >= 0 && f.condition <= 1)) bad.push(`farmsteads[${f.id}]: condition ${f.condition}`);
    if (f.condAt !== undefined && !(f.condAt <= st.t)) bad.push(`farmsteads[${f.id}]: condAt ${f.condAt} is in the future`);
    if (f.tarredUntil !== undefined && !(f.tarredUntil <= st.t + globalThis.VB['sim/rules'].HOUSE.tarYears * globalThis.VB['sim/rules'].YEAR)) bad.push(`farmsteads[${f.id}]: tarredUntil ${f.tarredUntil}`);
    if (!tileOk(f.house)) bad.push(`farmsteads[${f.id}]: house tile ${f.house} out of range`);
    const b = f.booth; // settlers' booth: cottage stages done (0..2) and hours on the open one (sim/settle)
    if (b !== null && !(Number.isInteger(b.i) && b.i >= 0 && b.i <= 2 && within(b.done, 0, 1e6))) bad.push(`farmsteads[${f.id}]: booth is ${JSON.stringify(b)}`);
    for (const fd of f.fields) if (!tileOk(fd.tile)) bad.push(`farmsteads[${f.id}]: field ${fd.id} tile ${fd.tile} out of range`);
    if (st.owner) {
      const want = f.household === null ? -f.village - 1 : f.household + 1;
      for (const tile of [f.house, ...f.fields.map((fd) => fd.tile), ...(f.meadows || []).map((m) => m.tile)]) {
        if (st.owner[tile] !== want) bad.push(`farmsteads[${f.id}]: owner cache on tile ${tile} is ${st.owner[tile]}, expected ${want}`);
      }
      for (const m of f.meadows || []) if (!st.used.has(m.tile)) bad.push(`farmsteads[${f.id}]: meadow ${m.id} tile ${m.tile} unused`);
    }
    // a claim on an empty farm (VB-033): only on an empty, derelict farm, its hours in range, and the claimant's claim on its house
    if (f.claim) {
      const c = st.claims && VB['sim/claims'].claimOf(st, f.house, { type: 'pawn', id: f.claim.by });
      if (f.household !== null || f.state !== 'derelict' || !st.pawns[f.claim.by]) bad.push(`farmsteads[${f.id}]: claim by ${f.claim.by} on a farm ${f.state}, held by ${f.household}`);
      if (!within(f.claim.done, 0, f.claim.hours + 1e-6) || !within(f.claim.hours, 0, 120)) bad.push(`farmsteads[${f.id}]: claim hours ${f.claim.done} of ${f.claim.hours}`);
      if (st.claims && (!c || c.why !== 'farm' || c.state !== 'unrealised')) bad.push(`farmsteads[${f.id}]: claim by ${f.claim.by} without its claim on the house`);
    }
    // a field or meadow in the making is staked by its household, not owned by it (VB-158); an empty farm has no project
    if (f.project && st.claims) {
      const c = f.household === null ? null : VB['sim/claims'].claimOf(st, f.project.tile, { type: 'household', id: f.household });
      if (!c || c.state !== 'unrealised' || c.why !== (f.project.stage === 'meadow' ? 'meadow' : 'field')) bad.push(`farmsteads[${f.id}]: project on ${f.project.tile} not staked by its household`);
      if (f.household !== null && st.owner[f.project.tile] === f.household + 1) bad.push(`farmsteads[${f.id}]: project tile ${f.project.tile} owned before it is made`);
    }
  }
  // claims on tiles (sim/claims, VB-042): valid tiles and claimants, no claimant twice on a tile, strengths in 0..1, no empty lists
  if (st.claims) {
    const CL = VB['sim/claims'], WHY = ['outland', 'field', 'meadow', 'farm', 'birthright'];
    const exists = (by) => by.type === 'pawn' ? !!st.pawns[by.id] : by.type === 'household' ? !!st.households[by.id] : by.type === 'village' && !!st.villages[by.id];
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
        if (c.by.type === 'household' && st.households[c.by.id] && st.households[c.by.id].dissolved) bad.push(`claims[${tile}]: dissolved household ${c.by.id}`);
        if ((c.why === 'outland') !== (c.by.type === 'village')) bad.push(`claims[${tile}]: ${k} claims ${c.why}`); // only villages claim outland (VB-156)
        if (c.why === 'birthright') { // the old family's claim on the house of its empty farm, for a while (VB-033)
          const f = st.farmsteads.find((x) => x.house === tile);
          if (c.by.type !== 'pawn' || c.state !== 'realised' || c.until === null || !f || f.household !== null) bad.push(`claims[${tile}]: ${k} birthright is ${c.state} on ${f ? `a farm held by ${f.household}` : 'no farm'}`);
        }
        if (c.why === 'farm') { // a pawn's claim on the house of the empty farm it is restoring (VB-033)
          const f = st.farmsteads.find((x) => x.house === tile);
          if (c.by.type !== 'pawn' || !f || !f.claim || f.claim.by !== c.by.id) bad.push(`claims[${tile}]: ${k} claims a farm with no claim under way`);
        }
        if (c.why === 'field' || c.why === 'meadow') { // a stake is its household's project (VB-158)
          const h = c.by.type === 'household' && st.households[c.by.id], f = h && st.farmsteads[h.farmstead];
          if (!f || !f.project || f.project.tile !== tile || c.state !== 'unrealised') bad.push(`claims[${tile}]: ${k} stakes it with no project there`);
        }
      }
    }
  }
  // cairns on settled borders (VB-157): a valid tile, two different villages, set in the past
  for (const [tile, c] of st.cairns || []) {
    if (!tileOk(tile) || !st.villages[c.a] || !st.villages[c.b] || c.a === c.b || !(c.t <= st.t)) bad.push(`cairns[${tile}]: ${JSON.stringify(c)}`);
  }
  // nothing is built on a river tile (VB-111): houses, fields, fields in the making, plots and greens
  const onRiver = (t) => tileOk(t) && st.w.river[t] > 0;
  for (const f of st.farmsteads) {
    if (onRiver(f.house)) bad.push(`farmsteads[${f.id}]: house on river tile ${f.house}`);
    for (const fd of f.fields) if (onRiver(fd.tile)) bad.push(`farmsteads[${f.id}]: field ${fd.id} on river tile ${fd.tile}`);
    if (f.project && onRiver(f.project.tile)) bad.push(`farmsteads[${f.id}]: new field on river tile ${f.project.tile}`);
    for (const m of f.meadows || []) if (onRiver(m.tile) || st.w.water[m.tile]) bad.push(`farmsteads[${f.id}]: meadow ${m.id} on river or water tile ${m.tile}`);
  }
  for (const v of st.villages) {
    if (v.green && onRiver(v.center)) bad.push(`villages[${v.id}]: green on river tile ${v.center}`);
    for (const pl of v.plots || []) {
      if (pl.cottage && !(Number.isInteger(pl.cottage.i) && pl.cottage.i >= 0 && pl.cottage.i <= 3)) bad.push(`villages[${v.id}]: plot ${pl.id} cottage stage ${pl.cottage.i}`);
      if (pl.built && !st.farmsteads[pl.farmstead]) bad.push(`villages[${v.id}]: plot ${pl.id} built without a farmstead`);
    }
    for (const pl of v.plots || []) for (const tr of pl.tiles) if (onRiver(tr.tile)) bad.push(`villages[${v.id}]: plot ${pl.id} on river tile ${tr.tile}`);
  }
  // worn paths (VB-094): counts finite and not negative, none on water; a stage from 0 to 3 that its count supports
  const { wear, worn } = st.w;
  if (wear) {
    let off = 0;
    for (let i = 0; i < N; i++) if (!(wear[i] >= 0) || worn[i] > 3 || (wear[i] > 0 && st.w.water[i]) || (worn[i] && !(wear[i] > 0))) off++;
    if (off) bad.push(`w.wear: ${off} tiles with a count or stage out of place`);
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
  // wild food (VB-118): stocks from 0 to 1, set in a year not after this one; below 1 or set only on a forest or heath tile (a cleared tile keeps its stock)
  const { forage, forageYear } = st.w;
  if (forage) {
    const year = Math.floor(st.t / 24 / globalThis.VB['sim/rules'].YEAR_DAYS);
    let off = 0;
    for (let i = 0; i < N; i++) if (!(forage[i] >= 0 && forage[i] <= 1) || forageYear[i] < 0 || forageYear[i] > year) off++;
    if (off) bad.push(`w.forage: ${off} tiles with a stock or year out of place`);
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
  for (const a of st.agents) if (a.job && !a.job.claims.includes(a.id)) bad.push(`agents[${a.id}]: job ${a.job.key} does not list it among its workers`);
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
  // the player (VB-169): null, or a pawn that exists with a queue of at most 8 of its own commands, of which only the head may be begun
  if (st.player !== null && st.player !== undefined) {
    const pl = st.player, QUEUE_MAX = globalThis.VB['sim/commands'].QUEUE_MAX;
    if (!st.pawns[pl.pawn] || !st.agents[pl.pawn]) bad.push(`player: pawn ${pl.pawn} does not exist`);
    if (typeof pl.auto !== 'boolean' || !(pl.since <= st.t)) bad.push(`player: auto ${pl.auto}, since ${pl.since}`);
    if (!Array.isArray(pl.queue) || pl.queue.length > QUEUE_MAX) bad.push(`player: a queue of ${pl.queue && pl.queue.length} commands`);
    else pl.queue.forEach((c, n) => {
      if (c.source !== 'player' || c.actor !== pl.pawn || typeof c.verb !== 'string') bad.push(`player.queue[${n}]: ${JSON.stringify(c)}`);
      if (!(c.begun === null || (n === 0 && c.begun <= st.t))) bad.push(`player.queue[${n}]: begun ${c.begun}`);
    });
    const r = pl.refused;
    // what its death left (VB-213): null while the played pawn lives, and from its death the farm, spouse and friends noted then, no queue
    const lf = pl.left, dead = !!st.pawns[pl.pawn] && st.pawns[pl.pawn].died !== null, TIES_MAX = globalThis.VB['sim/commands'].TIES_MAX;
    if (dead !== (lf !== null && lf !== undefined)) bad.push(`player.left: ${JSON.stringify(lf)} for a pawn ${dead ? 'dead' : 'alive'}`);
    else if (dead) {
      if (pl.queue.length || !(lf.t <= st.t) || !(lf.held === null || st.households[lf.held]) || !(lf.spouse === null || st.pawns[lf.spouse])
        || !Array.isArray(lf.ties) || lf.ties.length > TIES_MAX || lf.ties.some((x) => !st.pawns[x.id] || typeof x.why !== 'string')) {
        bad.push(`player.left: ${JSON.stringify(lf)}, queue ${pl.queue.length}`);
      }
    }
    // its wishes for the moving round (VB-212): out and serve null or a boolean; claim null, false or a farm that exists
    const ws = pl.wishes || {}, tri = (x) => x === null || typeof x === 'boolean';
    if (Object.keys(ws).sort().join() !== 'claim,match,out,serve' || !tri(ws.out) || !tri(ws.serve)
      || !(ws.claim === null || ws.claim === false || (Number.isInteger(ws.claim) && !!st.farmsteads[ws.claim]))) bad.push(`player.wishes: ${JSON.stringify(pl.wishes)}`);
    // a wish for a match: null, false or a living pawn of the other sex than the played pawn's, while the played pawn lives
    const mw = ws.match;
    if (!(mw === null || mw === false || (Number.isInteger(mw) && !!st.pawns[mw] && st.pawns[mw].alive && st.pawns[mw].sex !== st.pawns[pl.pawn].sex
      && st.pawns[pl.pawn].alive))) bad.push(`player.wishes.match: ${JSON.stringify(mw)}`);
    if (!(r === null || (typeof r.verb === 'string' && typeof r.why === 'string' && r.t <= st.t))) bad.push(`player.refused: ${JSON.stringify(r)}`);
  }
  // the open marriage offers (VB-293): sorted by due, each due at most MARRIAGE.offerDays after it was made, ids below st.offerSeq and
  // unique, no pawn in two; the answers are the man's and the woman's (by them) and at most one spokesman's a side (by another pawn: a
  // spokesman who is the one to marry gives one answer), none a no and one at least still to give (an offer closes at a no or at all yes).
  // Who spoke for whom is checked where the offer is made (tests/offers.js): a spokesman may have changed since.
  if (st.offers !== undefined) {
    const { DAY: D, MARRIAGE: MR } = globalThis.VB['sim/rules'], seen = new Set(), ids = new Set();
    if (!Array.isArray(st.offers) || !Number.isInteger(st.offerSeq) || st.offerSeq < 0) bad.push(`offers: ${typeof st.offers}, offerSeq ${st.offerSeq}`);
    else st.offers.forEach((o, n) => {
      const at = `offers[${n}] (id ${o.id})`;
      if (n > 0 && st.offers[n - 1].due > o.due) bad.push(`${at}: due ${o.due} before the one ahead of it`);
      if (!(o.made <= st.t && o.due > o.made && o.due <= o.made + MR.offerDays * D)) bad.push(`${at}: made ${o.made}, due ${o.due}`);
      if (!Number.isInteger(o.id) || o.id < 0 || o.id >= st.offerSeq || ids.has(o.id)) bad.push(`${at}: id against offerSeq ${st.offerSeq}`);
      ids.add(o.id);
      if (!st.pawns[o.man] || !st.pawns[o.woman] || st.pawns[o.man].sex !== 'm' || st.pawns[o.woman].sex !== 'f') bad.push(`${at}: man ${o.man}, woman ${o.woman}`);
      for (const id of [o.man, o.woman]) { if (seen.has(id)) bad.push(`${at}: pawn ${id} is in two open offers`); seen.add(id); }
      if (!st.households[o.home] || !Number.isInteger(o.village)) bad.push(`${at}: home ${o.home}, village ${o.village}`);
      const keys = (o.answers || []).map((x) => x.key);
      if (!keys.includes('man') || !keys.includes('woman') || new Set(keys).size !== keys.length) bad.push(`${at}: answers ${keys.join()}`);
      for (const x of o.answers || []) {
        const own = x.key === 'man' ? o.man : x.key === 'woman' ? o.woman : null, side = x.key === 'manSide' ? o.man : x.key === 'womanSide' ? o.woman : null;
        if (own === null && side === null) bad.push(`${at}: an answer of ${x.key}`);
        else if (own !== null ? x.by !== own : !st.pawns[x.by] || x.by === side) bad.push(`${at}: ${x.key} answered by ${x.by}`);
        if (!(x.yes === null || x.yes === true)) bad.push(`${at}: ${x.key} answered ${x.yes}, and the offer is open`);
      }
      if ((o.answers || []).every((x) => x.yes === true)) bad.push(`${at}: all have said yes, and the offer is open`);
    });
  }
  // the occasions (VB-126): sorted by due, ids below st.occasionSeq and unique, due at most at the end, which is after the start (not
  // after now: a test may set the clock forward, and the next step ends it); the asked are in order of setting out, each once, and none of them has set out; a pawn at an occasion stands at one
  // that is in the queue and lists it among those who came.
  if (st.occasions !== undefined) {
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
      if ((o.kind === 'meeting') !== (o.farm === null)) bad.push(`${at}: a ${o.kind} at farm ${o.farm}`);
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
    if (hd.household === null) {
      if ((hd.head && hd.head.length) || hd.ewes || hd.rams || hd.lambs) bad.push(`${where}: animals but no household`);
      continue;
    }
    const hh = st.households[hd.household];
    if (!hh || hh.dissolved) bad.push(`${where}: household ${hd.household} missing or dissolved`);
    else if (hh.herds.filter((id) => id === hd.id).length !== 1) bad.push(`${where}: not listed once by household ${hd.household}`);
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
      if (hd.species === 'cattle' ? !hd.head.some((h) => h.id === e.head) : !(n[e.sheep]-- > 0)) bad.push(`${where}: cull entry ${JSON.stringify(e)} names no animal`);
    }
    if (!whole(hd.lean || 0) || !whole(hd.unfed || 0)) bad.push(`${where}: lean ${hd.lean}, unfed ${hd.unfed}`);
  }
  for (const hh of st.households) {
    for (const id of hh.herds || []) if (!st.herds[id] || st.herds[id].household !== hh.id) bad.push(`households[${hh.id}]: lists herd ${id}, not its own`);
    if (!(Number.isFinite(hh.haySpoilt) && hh.haySpoilt >= 0)) bad.push(`households[${hh.id}]: haySpoilt is ${hh.haySpoilt}`);
    if (!(hh.hay >= 0)) bad.push(`households[${hh.id}]: hay is ${hh.hay}`);
    const KINDS = ['meat', 'salt meat', 'milk', 'butter'];
    for (const l of hh.larder || []) if (!(l.n > 0 && KINDS.includes(l.kind) && Number.isFinite(l.until))) bad.push(`households[${hh.id}]: larder lot ${JSON.stringify(l)}`);
    if (hh.milkDay !== undefined && !(Number.isInteger(hh.milkDay) && hh.milkDay >= -1 && hh.milkDay <= st.t / 24)) bad.push(`households[${hh.id}]: milkDay ${hh.milkDay}`);
    if (hh.manure !== undefined && !(hh.manure >= 0)) bad.push(`households[${hh.id}]: manure ${hh.manure}`); // VB-137
    if (hh.spoilt !== undefined && !(hh.spoilt >= 0)) bad.push(`households[${hh.id}]: spoilt ${hh.spoilt}`); // grain lost in store (balance review)
    if (!(hh.grain >= -1e-6)) bad.push(`households[${hh.id}]: grain ${hh.grain}`);
  }
  // a field's soil (VB-137) between the floor that harvests wear it to and the cap manure raises it to
  const { SOIL } = VB['sim/rules'];
  for (const f of st.farmsteads) for (const fd of f.fields) {
    if (!(fd.soil >= SOIL.floor - 1e-9 && fd.soil <= Math.max(SOIL.cap, SOIL.fresh) + 1e-9)) bad.push(`farmsteads[${f.id}].fields[${fd.id}]: soil ${fd.soil}`);
  }
}
// Goodwill balances (sim/relations, VB-217): none for the dead or with them, at most GOODWILL.cap, each {v, t} with v non-zero and finite,
// t no later than now, mirrored exactly on the other pawn ({v: -v, t}).
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
  const { SOCIAL } = VB['sim/rules'], TIES = SOCIAL.ties, T = SOCIAL.talk;
  if (!(Number.isFinite(p.tieT) && p.tieT <= st.t)) bad.push(`pawns[${p.id}]: tieT ${p.tieT} at ${st.t}`);
  if (!(Number.isInteger(p.homeHours) && p.homeHours >= 0 && p.homeHours <= T.to - T.from)) bad.push(`pawns[${p.id}]: homeHours ${p.homeHours}`);
  if (!p.alive) return;
  const kin = VB['sim/records'].kinNear(st, p.id).filter((q) => st.pawns[q].alive);
  if (p.ties.size > Math.max(TIES.cap, kin.length)) bad.push(`pawns[${p.id}]: ${p.ties.size} ties, over the cap of ${TIES.cap}`);
  for (const [j, w] of p.ties) {
    const q = st.pawns[j];
    // a tie to one who died is dropped at the death, or, if that pawn had dropped its own tie, when this pawn next renormalises
    if (j === p.id || !q || (!q.alive && !(q.died > p.tieT))) bad.push(`pawns[${p.id}].ties<${j}>: not a living other pawn, nor one dead since ${p.tieT}`);
    if (!(Number.isFinite(w) && w > 0)) bad.push(`pawns[${p.id}].ties<${j}>: ${w}`);
  }
}
// Relationship records (sim/relations): about a living other pawn, with known memories within their caps (only of kinds in
// SOCIAL.memories: talk leaves none, VB-240), and none for the dead. Bands (pawn.bands): 1 or -1, about another pawn, none for the dead,
// and agreeing with the opinion within SOCIAL.back and the most it can drift with nothing touching the pair between the season's checks
// (fadeRelations): a tie's affinity fading for a season, each memory fading for a season, and the housemate's standing lost.
function checkRel(st, p, bad) {
  const { SOCIAL, SEASON_DAYS, YEAR_DAYS } = VB['sim/rules'], R = VB['sim/relations'];
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
      const lo = Math.min(0, K.cap), hi = Math.max(0, K.cap);
      if (!(Number.isFinite(m.v) && m.v >= lo - 1e-9 && m.v <= hi + 1e-9)) bad.push(`${where}: ${k} is ${m.v}, outside 0..${K.cap}`);
      if (!(m.t <= st.t)) bad.push(`${where}: ${k} remembered at ${m.t}, after now (${st.t})`);
    }
  }
}
module.exports = { checkState };
