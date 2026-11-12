// A command-line view of a run: seeds a scenario, advances it and prints one line per year, then optionally a report.
// node tools/sim.js --scenario founders --seed 7 --map small --years 10 [--report households|pawns|jobs|customs|events|farms|idle|hours|paths|relations|herds|villages|hunger|perf|counts|land] [--json]
//   [--pawn ID] [--household ID] [--at Y]      (--at Y stops at year Y, overriding --years; --household N --report plans: its plans)
//   --report hours [--from Y] [--every step|hour] [--fields N] [--team] [--household N]   (VB-337: tools/hours.js; its --help)
//   [--save FILE] [--load FILE]                 (VB-074: save the run at the end; or go on from a save, its scenario, seed and map with it;
//                                                --years then counts on from the save's year; a FILE ending in .gz is gzipped)
const REPORTS = ['households', 'pawns', 'jobs', 'customs', 'events', 'farms', 'idle', 'hours', 'paths', 'relations', 'herds', 'villages', 'hunger', 'perf', 'counts', 'land',
  'plans', 'calendar', 'reach'];
const USAGE = `usage: node tools/sim.js [--scenario founders|heirs|populous] [--seed N] [--map tiny|small|medium|large] [--years Y]
  defaults: founders, seed 7, medium, 3 years; prints one line a year, then the report if one is named
  --report NAME     ${REPORTS.join('|')}
  --json            the report as JSON
  --pawn ID, --household ID   one pawn or household in detail; with --report plans, that household's plans; with --report hours, its hours
  --report hours    pawn-hours a household by job kind, and the farming year's days (tools/hours.js --help):
                    --from Y (sample from year Y), --every step|hour, --fields N, --team
  --at Y            stop at year Y, overriding --years
  --save FILE       save the run at its end (.gz is gzipped)
  --load FILE       go on from a save, with its scenario, seed and map; --years counts on from the save's year
  --report reach    the table of walking hours between villages (tools/reach.js --help)
  --report calendar prints the clock's table (sim/clock CALENDAR, VB-241) in the order it runs, and runs nothing`;
if (process.argv.includes('--help') || process.argv.includes('-h')) { console.log(USAGE); process.exit(0); }
if (process.argv.includes('calendar')) { // the clock's table needs no run (VB-241)
  const rows = require('../src/load.js')['sim/clock'].calendarRows();
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 1)); else console.table(rows);
  process.exit(0);
}
const perf = process.argv.includes('perf') ? require('./perf.js') : null, VB = perf ? perf.load() : require('../src/load.js'), G = VB.gen, Sim = VB.sim;
const SIZES = { tiny: [120, 85], small: [180, 130], medium: [280, 200], large: [380, 270] }; // as the generation screen (src/page/loader.js)
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : dflt; };
const fs = require('fs'), zlib = require('zlib'), saveTo = opt('save', null), loadFrom = opt('load', null);
// a page save (VB-214) wraps the run as {build, savedAt, label, save}: it is unwrapped here, whatever its build
const readSave = (f) => { const d = JSON.parse((f.endsWith('.gz') ? zlib.gunzipSync(fs.readFileSync(f)) : fs.readFileSync(f)).toString('utf8')); return d && d.build && d.save ? d.save : d; };
const loaded = loadFrom ? readSave(loadFrom) : null;
const mapOf = (d) => Object.keys(SIZES).find((k) => SIZES[k][0] === d.cols && SIZES[k][1] === d.rows);
const scenario = loaded ? loaded.scenario : opt('scenario', 'founders'), seedNum = loaded ? loaded.seed : +opt('seed', 7), map = loaded ? mapOf(loaded) : opt('map', 'medium'), years = +(opt('at', null) ?? opt('years', 3));
const report = opt('report', null), json = args.includes('--json'), pawnId = opt('pawn', null), hhId = opt('household', null);
if (!SIZES[map] || !['founders', 'heirs', 'populous'].includes(scenario)) { console.error(USAGE); process.exit(2); }
if (report && !REPORTS.includes(report)) { console.error('unknown report ' + report); process.exit(2); }

// plain data: Maps as objects, Sets as arrays, typed arrays as arrays, functions left out, shared objects after the first as "&path"
function plain(v, seen = new Map(), where = '$') {
  if (typeof v === 'function') return undefined;
  if (v === null || typeof v !== 'object') return Number.isFinite(v) || typeof v !== 'number' ? v : String(v);
  if (seen.has(v)) return '&' + seen.get(v);
  seen.set(v, where);
  if (ArrayBuffer.isView(v)) return Array.from(v);
  if (Array.isArray(v)) return v.map((x, i) => plain(x, seen, `${where}[${i}]`));
  if (v instanceof Set) return [...v].map((x, i) => plain(x, seen, `${where}[${i}]`));
  const o = {};
  for (const [k, x] of v instanceof Map ? v : Object.entries(v)) { const y = plain(x, seen, `${where}.${k}`); if (y !== undefined) o[k] = y; }
  return o;
}

const it = G.generate(seedNum, { cols: SIZES[map][0], rows: SIZES[map][1] });
let r; while (!(r = it.next()).done);
const st = loaded ? Sim.load(r.value, loaded) : Sim.seed(r.value, seedNum, scenario), say = (...a) => { if (!json) console.log(...a); };
const causeOf = (p) => { const e = Sim.recordOf(st, { pawn: p.id, life: true }).find((x) => x.kind === 'died'); return e ? e.cause : null; };
const yearOf = (t) => Math.floor(t / Sim.YEAR) + 1;
const start = Math.floor(st.t / Sim.YEAR), last = opt('at', null) !== null ? years : start + years; // years done before, and the last to run
say(`${scenario} seed ${seedNum} ${map} map (${r.value.N} tiles), ${loaded ? `from the save ${loadFrom} at year ${start}, ` : ''}to year ${last}`);
say('year  pop  births  deaths(by cause)  marriages  hungry-days  mean-grain  demand  ms/day');
const idle = report === 'idle' ? require('./idle.js')(Sim, st) : null;
let perfMs = 0;
const countsFrom = st.t;
if (report === 'counts') VB.resetCounts();
const hunger = report === 'hunger' ? require('./hunger.js')(Sim, st) : null;
const hours = report === 'hours' ? require('./hours.js')(VB, st, { from: +opt('from', 1), every: opt('every', 'step'), fields: opt('fields', null),
  team: args.includes('--team'), household: hhId }) : null;
for (let y = start + 1; y <= last; y++) {
  const t0 = Date.now(), hungry0 = st.households.reduce((s, h) => s + h.hungryDays, 0);
  if (idle) idle.advanceYear(); else if (hours) hours.advanceYear(); else if (hunger) hunger.advanceYear(); else if (perf) perfMs += perf.timeAdvance(Sim, st, Sim.YEAR); else Sim.advance(st, Sim.YEAR);
  const ms = (Date.now() - t0) / Sim.YEAR_DAYS, live = st.households.filter((h) => !h.dissolved);
  const births = st.pawns.filter((p) => !p.founder && p.born >= (y - 1) * Sim.YEAR && p.born < y * Sim.YEAR).length;
  const deaths = {}; for (const p of st.pawns) if (p.died !== null && p.died >= (y - 1) * Sim.YEAR && p.died < y * Sim.YEAR) { const c = causeOf(p) || 'unknown'; deaths[c] = (deaths[c] || 0) + 1; }
  const marriages = st.unions.filter((u) => u.start >= (y - 1) * Sim.YEAR && u.start < y * Sim.YEAR).length;
  const grain = live.length ? live.reduce((s, h) => s + Sim.grainOf(h), 0) / live.length : 0;
  const d = Object.entries(deaths).map(([k, n]) => `${k} ${n}`).join(', ') || '-';
  say(`${String(y).padStart(4)} ${String(st.pawns.filter((p) => p.alive).length).padStart(4)} ${String(births).padStart(7)}  ${d.padEnd(16)} ${String(marriages).padStart(9)} ${String(st.households.reduce((s, h) => s + h.hungryDays, 0) - hungry0).padStart(12)} ${grain.toFixed(1).padStart(11)} ${String(st.demand.length).padStart(7)} ${ms.toFixed(1).padStart(7)}`);
}
if (saveTo) {
  const text = JSON.stringify(Sim.save(st));
  fs.writeFileSync(saveTo, saveTo.endsWith('.gz') ? zlib.gzipSync(text) : text);
  console.error(`saved year ${Math.floor(st.t / Sim.YEAR)} to ${saveTo}: ${(text.length / 1048576).toFixed(2)} MB of JSON, ${(zlib.gzipSync(text).length / 1048576).toFixed(2)} MB gzipped`);
}

const pawnDays = report === 'counts' ? require('./counts.js').livingPawnDays(st, countsFrom, st.t, Sim.DAY) : 0;
const pawnRow = (p) => ({ id: p.id, name: Sim.fullName(p), sex: p.sex, age: p.age, household: p.household, role: p.role, alive: p.alive, hunger: +p.hunger.toFixed(2) });
const hhRow = (h) => ({ id: h.id, farm: st.farmsteads[h.farmstead].name, members: h.members.length, holder: h.holder, grain: Math.round(Sim.grainOf(h)), wood: Math.round(h.wood),
  hungryDays: h.hungryDays, dissolved: h.dissolved });
// A household's plans (sim/plans): the standing plan's targets, reservations and next review; the seasonal plan's season and steps.
const when = (hour) => {
  const c = Sim.cal(hour);
  return `year ${c.year} ${Sim.SEASONS[c.season]} day ${c.sday + 1} ${String(Math.floor(c.hour)).padStart(2, '0')}:00`;
};
function plansOf(h) {
  const P = VB['sim/plans'], plan = P.planOf(st, 'household', h.id), sp = P.seasonOf(st, h.id);
  if (!plan) return { household: h.id, plans: 'none (dissolved)' };
  return { household: h.id, culture: P.cultureOf(st, h), targets: plain(plan.targets), reserved: plain(plan.reserved),
    nextReview: when(plan.nextReview), cadenceDays: P.cadence(st, plan), lastReviewDay: plan.last,
    season: `${Sim.SEASONS[sp.season]} of year ${sp.year} (made on day ${sp.made})`, steps: sp.steps.join(', ') };
}
const tables = {
  reach: () => require('./reach.js')(st), // VB-286
  counts: () => Object.keys(VB.COUNTERS).map((counter) => ({ counter, total: VB.count[counter],
    perDay: (st.t > countsFrom) ? VB.count[counter] / ((st.t - countsFrom) / Sim.DAY) : 0,
    perLivingPawnDay: pawnDays ? VB.count[counter] / pawnDays : 0 })),
  households: () => st.households.map(hhRow),
  pawns: () => st.pawns.filter((p) => p.alive).map(pawnRow),
  jobs: () => [...st.jobs.values()].map((j) => ({ id: j.id, key: j.key, kind: j.kind, owner: j.owner, site: j.site, claims: j.claims, done: j.done })),
  customs: () => st.cenv.cultures.map((c, i) => ({ culture: i, ...plain(c) })),
  events: () => Sim.villageLog(st).map(({ t, text }) => ({ t, text })),
  idle: () => idle.result(),
  hours: () => hours.result(),
  hunger: () => hunger.result(),
  perf: () => perf.result(perfMs, years * Sim.YEAR_DAYS),
  farms: () => st.farmsteads.map((f) => ({ id: f.id, name: f.name, village: f.village, household: f.household, state: f.state, fields: f.fields.map((fd) => fd.stage).join(',') })),
  // relationships per village (sim/relations): records held, their opinion words in %, and per adult (16+) the friends and the disliked
  // outside one's household; talks per pawn and day since the start, over everyone
  // herds (sim/herds): per household with animals, its herds by kind, names and ages, its hay and its winter's need
  herds: () => st.households.filter((h) => !h.dissolved && h.herds.length).map((h) => Sim.herdReport(st, h)),
  // villages (sim/settle, VB-148): farms (occupied, in a booth), people, adults waiting for land with no room (crowded), and where and when
  // a village founded in play came from
  villages: () => st.villages.map((v) => {
    const farms = v.farmsteads.map((id) => st.farmsteads[id]), fd = v.founded;
    const people = st.pawns.filter((p) => p.alive && p.household !== null && Sim.settlementIdOf(st, p) === v.id).length;
    return { id: v.id, name: v.name, farms: farms.length, occupied: farms.filter((f) => f.household !== null).length,
      booths: farms.filter((f) => f.booth).length, people, crowded: v.crowded,
      founded: fd ? `year ${Math.floor(fd.t / Sim.YEAR) + 1} from ${st.villages[fd.from].name} by ${Sim.fullName(st.pawns[fd.by])}` : '' };
  }),
  // plans (sim/plans, VB-252): per live household, its standing plan's targets and next review, and its seasonal plan's steps in order
  plans: () => st.liveHouseholds.map((id) => plansOf(st.households[id])),
  // land (sim/claims, VB-155): per village, the tiles it holds by kind and its households' tiles, claims held and on disputed tiles, cairns
  // (VB-157), and the hex steps from its land to the nearest other village's land
  land: () => {
    const w = st.w, { hexSteps } = VB['sim/hex'], CL = VB['sim/claims'], held = CL.holdings(st), cairns = st.cairns || new Map();
    const villageOfOwner = (n) => (n < 0 ? -n - 1 : st.farmsteads[st.households[n - 1].farmstead].village);
    const tiles = st.villages.map(() => []);
    for (let t = 0; t < w.N; t++) if (st.owner[t] !== 0) tiles[villageOfOwner(st.owner[t])].push(t);
    const villageOfClaim = (c) => (c.by.type === 'village' ? c.by.id : c.by.type === 'household' ? st.farmsteads[st.households[c.by.id].farmstead].village : null);
    const disputed = st.villages.map(() => 0);
    for (const list of st.claims.values()) if (list.length > 1) for (const v of new Set(list.map(villageOfClaim))) if (v !== null) disputed[v]++;
    return st.villages.map((v) => {
      const own = held.villages.get(v.id) || { green: 0, farms: 0, plots: 0, outland: 0, claims: 0 }, hh = { house: 0, fields: 0, meadows: 0, other: 0, claims: 0 };
      for (const id of v.farmsteads) {
        const f = st.farmsteads[id], r = f.household !== null ? held.households.get(f.household) : null;
        if (r) for (const k of Object.keys(hh)) hh[k] += r[k];
      }
      let near = null;
      for (const u of st.villages) if (u.id !== v.id && tiles[u.id].length) {
        for (const a of tiles[v.id]) for (const b of tiles[u.id]) { const d = hexSteps(w, a, b); if (near === null || d < near) near = d; }
      }
      return { id: v.id, name: v.name, occupied: v.farmsteads.filter((id) => st.farmsteads[id].household !== null).length, tiles: tiles[v.id].length,
        houses: hh.house, fields: hh.fields, meadows: hh.meadows, green: own.green, outland: own.outland, emptyFarms: own.farms, plots: own.plots,
        claims: own.claims + hh.claims, disputed: disputed[v.id], cairns: [...cairns.values()].filter((c) => c.a === v.id || c.b === v.id).length,
        nearestOther: near };
    });
  },
  relations: () => {
    const R = VB['sim/relations'], rows = new Map(), WORD = { 'close friend': 'close', friend: 'friend', neutral: 'neutral', dislikes: 'dislikes', enemy: 'enemy' };
    const row = (k, name) => rows.get(k) || rows.set(k, { village: name, people: 0, adults: 0, records: 0, close: 0, friend: 0, neutral: 0, dislikes: 0,
      enemy: 0, friendsOut: 0, dislikedOut: 0, tiesAcross: 0, friendsAcross: 0 }).get(k);
    for (const p of st.pawns) {
      if (!p.alive) continue;
      const v = Sim.settlementIdOf(st, p);
      for (const x of [row('all', 'all'), row(v, st.villages[v].name)]) {
        x.people++; if (p.age >= 16) x.adults++;
        for (const j of new Set([...p.ties.keys(), ...p.rel.keys()])) { // whom it knows or remembers (opinion is derived: VB-240)
          if (!st.pawns[j].alive) continue;
          const o = R.opinionOf(st, p.id, j), out = st.pawns[j].household !== p.household;
          x.records++; x[WORD[R.opinionWord(o)]]++;
          if (p.age >= 16 && out && o >= VB['sim/rules'].SOCIAL.friend) x.friendsOut++;
          if (p.age >= 16 && out && o <= VB['sim/rules'].SOCIAL.dislike) x.dislikedOut++;
          const across = p.age >= 16 && Sim.settlementIdOf(st, st.pawns[j]) !== v; // of another village (VB-126)
          if (across && p.ties.has(j)) x.tiesAcross++;
          if (across && o >= VB['sim/rules'].SOCIAL.friend) x.friendsAcross++;
        }
      }
    }
    return [...rows.values()].map((x) => {
      const pc = (k) => +(100 * x[k] / Math.max(1, x.records)).toFixed(1), per = (k) => +(x[k] / Math.max(1, x.adults)).toFixed(2);
      const talks = x.village === 'all' && st.talks !== undefined ? { talksPerPawnDay: +(st.talks * 2 / x.people / (st.t / 24)).toFixed(2) } : {};
      return { village: x.village, people: x.people, records: x.records, close: pc('close'), friend: pc('friend'), neutral: pc('neutral'),
        dislikes: pc('dislikes'), enemy: pc('enemy'), friendsOut: per('friendsOut'), dislikedOut: per('dislikedOut'),
        tiesAcross: per('tiesAcross'), friendsAcross: per('friendsAcross'), ...talks };
    });
  },
  // worn paths per village (tiles within 8 steps of the green, by stage), and the walking network: fords and the route cache
  paths: () => {
    const w = st.w, { hexSteps } = VB['sim/hex'], P = VB['sim/paths'];
    const villages = st.villages.map((v) => {
      const n = [0, 0, 0];
      for (let i = 0; i < w.N; i++) if (w.worn[i] && hexSteps(w, v.center, i) <= 8) n[w.worn[i] - 1]++;
      return { village: v.id, name: v.name, farms: v.farmsteads.length, trodden: n[0], path: n[1], lane: n[2] };
    });
    const [, trodden, path, lane] = P.stageCounts(w);
    return [{ village: 'all', trodden, path, lane, fords: w.crossing.reduce((a, c) => a + (c === 1), 0), routes: st.pathCache.size,
      fallbacks: st.routeFallbacks }, ...villages];
  },
};
let out = null;
if (pawnId !== null) {
  const p = st.pawns[+pawnId]; if (!p) { console.error('no such pawn'); process.exit(1); }
  out = { ...plain(p), name: Sim.fullName(p), life: Sim.recordOf(st, { pawn: p.id, life: true }) };
} else if (hhId !== null && report === 'hours') out = hours.result();
else if (hhId !== null) {
  const h = st.households[+hhId]; if (!h) { console.error('no such household'); process.exit(1); }
  if (report === 'plans') out = plansOf(h);
  else out ={ ...plain(h), farm: plain(st.farmsteads[h.farmstead]), people: h.members.map((m) => ({ ...pawnRow(st.pawns[m]), events: Sim.recordOf(st, { pawn: m, life: true }) })) };
} else if (report) out = plain(tables[report]());
if (out !== null && report === 'idle' && !json) {
  console.log('share of work hours (%): working / walking / carrying / idle');
  for (const [role, bs] of Object.entries(out.hoursShare)) for (const [season, v] of Object.entries(bs)) {
    console.log(`  ${role.padEnd(10)} ${season.padEnd(7)} ${v.working} / ${v.walking} / ${v.carrying} / ${v.idle}`);
  }
  console.log('idle hours by reason (%):'); console.table(out.idleReasons);
  console.log('wait from posting to claim (hours):'); console.table(out.waitHours);
  console.log('job switches per pawn per year:'); console.table(out.switchesPerPawnYear);
  console.log('mean unclaimed jobs at end of work day:'); console.table(out.unclaimedAtEndOfDay);
} else if (out !== null && report === 'hours' && !json) hours.print(out);
else if (out !== null && report === 'perf' && !json) {
  console.log(`${out.days} game days in ${out.totalMs} ms (${out.msPerDay} ms/day); time per system, exclusive:`); console.table(out.systems);
} else if (out !== null && report === 'hunger' && !json) {
  console.log(`households hungry for over 30 days in year ${out.summary.year}:`); console.table(out.households);
  console.log('summary:'); console.log(JSON.stringify(out.summary, null, 1));
} else if (out !== null) {
  if (json) console.log(JSON.stringify(out, null, 1));
  else if (Array.isArray(out) && out.length && typeof out[0] === 'object') console.table(out.map((o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : v]))));
  else console.log(JSON.stringify(out, null, 1));
}
