// Study C, steps 4 and 5 (docs/mocks/plans/village/README.md): parity.
//   reach: against today's code, a controller for pawns that are not the played pawn (a head, a member, the alderman) tries to author each
//     thing the design's plans hold, through sim/commands' issue only, each on a copy of one seeded state (structuredClone; nothing saved);
//     what is refused is tried again as the played pawn (Sim.inhabit, then Sim.queue / Sim.setAuto / Sim.plan / Sim.wish) on a fresh copy.
//   model: a standalone household-and-village year with the design's interface: decisions(pawn), command(cmd), the default author filling
//     what is not authored at each decision point's deadline; three controllers: empty, random-valid (P16), lookahead.
// node docs/mocks/plans/village/parity.js [--seed 7] [--curves out/curves-populous-7.json] [--reps 1000]
const path = require('path'), fs = require('fs'), crypto = require('crypto'), root = path.join(__dirname, '../../..', '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d; };
const seed = Number(arg('seed', 7)), reps = Number(arg('reps', 1000));
const curves = arg('curves', path.join(__dirname, `out/curves-populous-${seed}.json`));
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ================= reach: today's code =================
function reach() {
  const VB = require(path.join(root, 'src/load.js')), G = VB.gen, Sim = VB.sim, { issue } = VB['sim/commands'];
  const it = G.generate(seed, { cols: 180, rows: 130 }); let r; while (!(r = it.next()).done);
  const base = Sim.seed(r.value, seed, 'populous');
  Sim.advance(base, Sim.YEAR + 0.5); // year 2, spring's first day, 0:30: a work day not yet called, the meeting's routines chosen
  const { agentOf } = VB['sim/decisions'];
  const hhId = base.liveHouseholds.find((id) => { const h = base.households[id]; return h.holder !== null && h.members.filter((m) => base.pawns[m].alive && Sim.age(base, base.pawns[m]) >= 14).length >= 2 && base.plans.households.get(id).day; });
  const hh = base.households[hhId], head = hh.holder, member = hh.members.find((m) => m !== head && base.pawns[m].alive && Sim.age(base, base.pawns[m]) >= 14);
  const vid = base.farmsteads[hh.farmstead].village, alder = agentOf(base, vid);
  const vplan = base.plans.villages.get(vid), sp = base.plans.seasons.get(hhId), day = base.plans.households.get(hhId).day;
  const Ob = VB['sim/obligations'], ob = (base.obligations || []).find((o) => o && o.kind === 'days' && Ob.isLive(o) && o.creditor.kind === 'household' && Ob.left(o) - o.called >= 1);
  const obHolder = ob ? base.households[ob.creditor.id].holder : null;
  const T = (actor, verb, target, args) => ({ actor, verb, target, args, source: 'pawn' });
  const acts = [
    ['a target (a store\'s level)', T(head, 'target', hhId, { store: 'wood', n: null })],
    ['the order of the season\'s work', T(head, 'order', hhId, { steps: sp && sp.steps ? [...sp.steps].reverse().map((s) => (typeof s === 'object' ? s.key ?? s.kind ?? s.what : s)) : [] })],
    ['a tile for the next field', T(head, 'tile', hhId, { what: 'field', tile: null })],
    ['a project', T(head, 'project', hhId, { what: 'barn' })],
    ['a member\'s day order (by the head)', T(head, 'dayOrder', hhId, { member: head, from: 0, to: Math.max(0, (day && day.lists[head] ? day.lists[head].length : 1) - 1) })],
    ['a pawn\'s own day order (by the member)', T(member, 'dayOrder', hhId, { member, from: 0, to: 0 })],
    ['giving a task to another member', T(head, 'dayGive', hhId, { key: day && day.lists[head] ? day.lists[head].find((k) => base.jobs.get(k)) : null, from: head, to: member })],
    ['calling a member', T(head, 'dayCall', hhId, { member })],
    ['calling a day owed', ob ? T(obHolder, 'callDays', ob.id, { day: Math.floor(base.t / Sim.DAY) + 3 }) : null],
    ['a work day (on its calendar day)', T(alder, 'callWorkday', vid, {})],
    ['a work day on a date the alderman chooses', null],
    ['a routine (the year\'s village work)', T(alder, 'routines', null, { by: 'meeting', routines: vplan.routines })],
    ['a routine, by the meeting as actor', { actor: { settlement: vid }, verb: 'routines', target: null, args: { by: 'meeting', routines: vplan.routines }, source: 'pawn' }],
    ['leave asked (a member) and answered (the head)', null],
    ['help asked (food): the verb offer on the basis ask, issued by sim/help for any head (read, not executed: its args not built)', 'read'],
    ['hands asked (help with work)', null],
    ['a pastime', T(member, 'pastime', Object.keys(VB['sim/pastimes'].PASTIMES)[0], {})],
    ['a claim on a household\'s days a season ahead', null],
    ['an aim of a pawn\'s own (a portion, a marriage)', null],
    ['a queued command', 'queue'],
    ['a multi-step task at a tile (the player\'s chains)', 'plan'],
    ['automatic behaviour off', 'auto'],
    ['a week of a pawn\'s own steps', null],
  ];
  const rows = [];
  for (const [what, cmd] of acts) {
    let any = null, played = null;
    if (cmd === 'read') { rows.push({ what, verb: 'offer', asAny: 'yes (by reading sim/help)', asPlayed: '-', verdict: 'verb, any pawn' }); continue; }
    if (cmd && typeof cmd === 'object') { const st = structuredClone(base); const res = issue(st, cmd); any = res === true ? 'yes' : String(res); }
    else any = cmd ? 'no verb (a Sim function of the player)' : 'no verb';
    if (any !== 'yes') { // as the played pawn: the actor inhabited, then the player's own routes
      const st = structuredClone(base), actor = cmd && typeof cmd === 'object' && Number.isInteger(cmd.actor) ? cmd.actor : head;
      Sim.inhabit(st, actor);
      let res;
      if (cmd === 'queue') res = Sim.queue(st, { actor, verb: 'idle', target: null, args: {}, source: 'player' });
      else if (cmd === 'auto') res = Sim.setAuto(st, false);
      else if (cmd === 'plan') { for (const tile of base.villages[vid].wood.slice(0, 40)) { res = VB['sim/playerplan'].plan(st, 'add', { fell: tile }); if (res === true || res === undefined) break; } }
      else if (cmd && typeof cmd === 'object') res = issue(st, { ...cmd, source: 'player' });
      else res = 'no route';
      played = res === true || res === undefined ? 'yes' : String(res);
    }
    const verdict = any === 'yes' ? 'verb, any pawn' : played === 'yes' || /played|player/.test(String(played)) && cmd && typeof cmd === 'string' ? 'played pawn only' : 'no verb (or refused by right)';
    rows.push({ what, verb: cmd && typeof cmd === 'object' ? cmd.verb : cmd || '-', asAny: any, asPlayed: played, verdict });
  }
  const cad = structuredClone(base); let reviews = 0, hhDays = 0, leaves = 0, memberDays = 0; const lastOf = new Map();
  for (let d = 0; d < Sim.YEAR_DAYS; d++) {
    Sim.advance(cad, Sim.DAY);
    for (const id of cad.liveHouseholds) { const pl = cad.plans.households.get(id); if (!pl) continue; hhDays++; const k = JSON.stringify(pl.last); if (lastOf.has(id) && lastOf.get(id) !== k) reviews++; lastOf.set(id, k);
      memberDays += cad.households[id].members.filter((m) => cad.pawns[m].alive && Sim.age(cad, cad.pawns[m]) >= 14 && m !== cad.households[id].holder).length; }
    leaves += cad.leaves && cad.leaves.by ? Object.keys(cad.leaves.by).length : 0;
  }
  const cadence = { reviewsPerHouseholdDay: +(reviews / hhDays).toFixed(2), leavesPerHouseholdDay: +(leaves / hhDays).toFixed(3), membersPerHousehold: +(memberDays / hhDays).toFixed(2) };
  return { cadence, state: { seed, t: base.t, household: hhId, head, member, village: vid, alderman: alder, obligation: ob ? ob.id : null }, rows };
}

// ================= model: the design's interface, standalone =================
// A year of 48 days for 20 households of the curves (adults, the demand of vital, field and other work a day, as recorded), one village.
// Steps: a household's week has steps {id, kind, day, hours, window [from, until], vital, member, author}; the default author fills each
// review's week greedily (steps by window's end, then vital first, each to the member with claimed hours left, last holder first); the
// alderman places the village's claim days at his review; called days are answered by the head (substitute: the default sends the head).
function model(ctrl, rnd, opts = {}) {
  const C = JSON.parse(fs.readFileSync(curves, 'utf8'));
  const HH = Object.entries(C.households).filter(([, h]) => h.rows.length >= 96 && (h.adults[48] || 0) > 0).slice(0, 20).map(([id, h]) => ({ id: +id, h }));
  const Y0 = 48, CEIL = 0.85, H = 12, DAYS = 48;
  const st = { by: {}, steps: [], seq: 0, claims: [], points: { head: 0, alderman: 0, pawn: 0 }, unmetVital: 0, missed: 0, doubleManned: 0, ceiling: 0, log: [] };
  const authored = new Set();
  // demand: each recorded day's vital, field and other hours become steps; field work has a window of 4 days from its day, other work 6
  for (const { id, h } of HH) for (let d = 0; d < DAYS; d++) {
    const r = h.rows[Y0 + d]; if (!r) continue; const a = h.adults[Y0 + d] || 1;
    const add = (kind, hrs, win, vital) => { for (let x = hrs; x > 0.25; x -= 4) st.steps.push({ id: st.seq++, hh: id, kind, day: null, hours: Math.min(4, x), from: d, until: Math.min(DAYS - 1, d + win), vital, member: null, author: 'custom', done: 0 }); };
    add('vital', r[3], 0, true); add('field', r[1], 3, false); add('other', r[6], 5, false); void a;
  }
  for (const s of st.steps) (st.by[s.hh] ||= []).push(s);
  const adultsOf = (id, d) => HH.find((x) => x.id === id).h.adults[Y0 + d] || 0;
  // the village's claim: 1 adult-day a season a household; called days: one in spring on every second household (an estate's due)
  for (const { id } of HH) for (let s = 0; s < 4; s++) st.claims.push({ hh: id, kind: 'village', season: s, day: null, hours: 8, author: 'custom' });
  HH.forEach(({ id }, i) => { if (i % 2 === 0) st.claims.push({ hh: id, kind: 'owed', season: 0, day: 2 + (i % 8), hours: 8, author: 'custom' }); });
  const load = (id, d) => (st.by[id] || []).filter((s) => s.from === d).reduce((x, s) => x + s.hours, 0);
  // ---- decision points: each body's review, in order of deadline ----
  const cap = (id, d) => adultsOf(id, d) * H * CEIL;
  for (let d = 0; d < DAYS; d++) {
    if (d % 12 === 0) { // the alderman's season review: place the village days (deadline: 3 days before the season's first day it covers)
      st.points.alderman++;
      for (const c of st.claims.filter((c) => c.kind === 'village' && c.season === d / 12)) {
        const ds = Array.from({ length: 12 }, (_, k) => d + k);
        c.day = ctrl.placeVillage ? ctrl.placeVillage(c, ds, load) : ds[0]; // the default author: the calendar's first day (as today)
        if (ctrl.placeVillage) authored.add('v' + c.hh + ':' + c.season);
      }
    }
    for (const { id } of HH) {
      if ((d + id) % 3 === 0) { // the head's week review (every 3 days, staggered): fill the next six days
        st.points.head++;
        const week = (st.by[id] || []).filter((s) => !(opts.slotVital && s.vital) && s.done < s.hours && s.from <= d + 5 && s.until >= d && s.from >= d - 5);
        if (ctrl.authorWeek) ctrl.authorWeek(id, d, week, st, cap, authored);
        // the default author fills, never overwriting what is authored
        const used = {}; for (const s of st.by[id] || []) if (s.day !== null && s.day >= d) used[s.day] = (used[s.day] || 0) + s.hours;
        for (const c of st.claims) if (c.hh === id && c.day !== null && c.day >= d && !c.defaulted) used[c.day] = (used[c.day] || 0) + c.hours;
        for (const s of week.sort((x, y) => x.until - y.until || Number(y.vital) - Number(x.vital) || x.id - y.id)) {
          if (s.day !== null && s.day >= d) continue; // planned already (by the rule last review, or authored: kept)
          for (let k = Math.max(d, s.from); k <= s.until; k++) if ((used[k] || 0) + s.hours <= cap(id, k)) { s.day = k; used[k] = (used[k] || 0) + s.hours; break; }
        }
      }
      for (const c of st.claims) if (c.hh === id && c.kind === 'owed' && c.day === d + 3) { st.points.head++; if (ctrl.answerCall) ctrl.answerCall(c, st); } // a called day: an over-claim
    }
    // the day is worked: claims first (they have an enforcer), then the steps planned for it, vital first; what does not fit is unmet
    for (const { id } of HH) {
      st.points.pawn += adultsOf(id, d) * (opts.pawnWeek ? 1 / 6 + 1 : 1); // a pawn's day reading (+ its own week, one review in six days)
      let left = adultsOf(id, d) * H, man = 0;
      for (const c of st.claims) if (c.hh === id && c.day === d && !c.defaulted) left -= c.hours;
      const today = (st.by[id] || []).filter((s) => s.day === d || (opts.slotVital && s.vital && s.from === d && s.done < s.hours)).sort((x, y) => Number(y.vital) - Number(x.vital) || x.until - y.until || x.id - y.id);
      for (const s of today) {
        if (!(opts.slotVital && s.vital)) { man += s.hours; if (man > cap(id, d) + 1e-9) st.ceiling++; } // slotted-in due work is outside the planned share
        const take = Math.min(s.hours - s.done, Math.max(0, left)); s.done += take; left -= take;
        if (s.done < s.hours - 1e-9) { if (s.vital) { st.unmetVital += s.hours - s.done; s.done = s.hours; } else if (d >= s.until) { st.missed += s.hours - s.done; s.done = s.hours; } else s.day = null; }
      }
      for (const s of st.by[id] || []) if (s.until === d && s.done < s.hours - 1e-9 && s.day === null) { if (s.vital) st.unmetVital += s.hours - s.done; else st.missed += s.hours - s.done; s.done = s.hours; }
    }
  }
  // double manning: a step planned on two days or for two members (the model gives a step one day; a duplicate id would be a double)
  const seen = new Set(); for (const s of st.steps) { if (seen.has(s.id)) st.doubleManned++; seen.add(s.id); }
  const hash = crypto.createHash('sha1').update(JSON.stringify([st.steps.map((s) => [s.id, s.day, s.done]), st.claims.map((c) => [c.day, !!c.defaulted])])).digest('hex').slice(0, 12);
  const hhDays = HH.length * DAYS;
  return { hash, unmetVital: +st.unmetVital.toFixed(1), missed: +st.missed.toFixed(1), ceiling: st.ceiling, doubleManned: st.doubleManned, authored: authored.size,
    perHeadDay: +(st.points.head / hhDays + 0 * 0).toFixed(2), perAldermanDay: +(st.points.alderman / DAYS).toFixed(2), perPawnDay: +(opts.pawnWeek ? 1 + 1 / 6 : 1).toFixed(2) };
}
const CTRL = {
  empty: () => ({}),
  // random-valid: authors a random 30% of the week's open steps onto a random day of their window that the check passes (the ceiling)
  random: (rnd) => ({
    authorWeek(id, d, week, st, cap, authored) {
      const used = {}; for (const s of st.by[id] || []) if (s.day !== null) used[s.day] = (used[s.day] || 0) + s.hours;
      for (const s of week) {
        if (s.day !== null || rnd() >= 0.3) continue;
        const k = Math.max(d, s.from) + Math.floor(rnd() * (s.until - Math.max(d, s.from) + 1));
        if ((used[k] || 0) + s.hours <= cap(id, k)) { s.day = k; s.author = 'pawn'; used[k] = (used[k] || 0) + s.hours; authored.add(s.id); } // the verb's check
      }
    },
  }),
  // lookahead: the village days on the household's lightest day of the season (the alderman), other work moved to the lightest day of its window
  lookahead: () => ({
    placeVillage: (c, ds, load) => ds.slice(3).reduce((b, k) => (load(c.hh, k) < load(c.hh, b) ? k : b), ds[3]),
    authorWeek(id, d, week, st, cap, authored) {
      const used = {}; for (const s of st.by[id] || []) if (s.day !== null) used[s.day] = (used[s.day] || 0) + s.hours;
      for (const s of week) {
        if (s.day !== null || s.vital || s.kind !== 'other') continue;
        let best = null; for (let k = Math.max(d, s.from); k <= s.until; k++) if ((used[k] || 0) + s.hours <= cap(id, k) && (best === null || (used[k] || 0) < (used[best] || 0))) best = k;
        if (best !== null) { s.day = best; s.author = 'pawn'; used[best] = (used[best] || 0) + s.hours; authored.add(s.id); }
      }
    },
    answerCall(c) { c.substituted = true; }, // the adult with the lightest week goes: in a pooled household the same hours
  }),
};

const R = reach();
console.log(`== reach (populous seed ${seed}, ${JSON.stringify(R.state)})`);
for (const r of R.rows) console.log(`${r.verdict.padEnd(30)} | ${r.what} [${r.verb}] | any: ${r.asAny.slice(0, 110)} | played: ${(r.asPlayed || '-').slice(0, 110)}`);
const counts = R.rows.reduce((o, r) => ((o[r.verdict] = (o[r.verdict] || 0) + 1), o), {});
console.log('counts', JSON.stringify(counts), 'cadence today', JSON.stringify(R.cadence));

for (const slotVital of [false, true]) {
  const o = { slotVital }, def = model(CTRL.empty(), mulberry32(1), o), def2 = model({}, mulberry32(2), o);
  console.log(`== model (${path.basename(curves)}), vital ${slotVital ? 'slotted in on its day (design 5.3 d)' : 'planned as any step'}`);
  console.log('empty    ', JSON.stringify(def), 'default author again:', def2.hash, 'hash equal:', def.hash === def2.hash);
  let worst = { unmetVital: 0 }, ceilingBreaks = 0, doubles = 0, overVital = 0, gap = 0;
  for (let k = 0; k < reps; k++) {
    const m = model(CTRL.random(mulberry32(1000 + k)), null, o);
    ceilingBreaks += m.ceiling; doubles += m.doubleManned; gap += m.unmetVital - def.unmetVital;
    if (m.unmetVital > def.unmetVital * 1.05 + 1e-9) overVital++;
    if (m.unmetVital > worst.unmetVital) worst = m;
  }
  console.log(`random-valid x${reps}: ceiling exceeded ${ceilingBreaks}, double-manned ${doubles}, runs with unmet vital > default + 5%: ${overVital}, mean excess ${(gap / reps).toFixed(1)} h; worst ${JSON.stringify(worst)}`);
  console.log('lookahead', JSON.stringify(model(CTRL.lookahead(), null, o)));
  const lv = CTRL.lookahead(); delete lv.authorWeek;
  console.log('lookahead, village days and calls only', JSON.stringify(model(lv, null, o)));
}
console.log('pawn planning its own week', JSON.stringify(model({}, null, { pawnWeek: true }).perPawnDay));
