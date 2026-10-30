// A command-line view of a run: seeds a scenario, advances it and prints one line per year, then optionally a report.
// node tools/sim.js --scenario founders --seed 7 --map small --years 10 [--report households|pawns|jobs|customs|events|farms|idle] [--json]
//   [--pawn ID] [--household ID] [--at Y]      (--at Y stops at year Y, overriding --years)
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
const SIZES = { tiny: [120, 85], small: [180, 130], medium: [280, 200], large: [380, 270] }; // as the generation screen (src/body.html)
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : dflt; };
const scenario = opt('scenario', 'founders'), seedNum = +opt('seed', 7), map = opt('map', 'medium'), years = +(opt('at', null) ?? opt('years', 3));
const report = opt('report', null), json = args.includes('--json'), pawnId = opt('pawn', null), hhId = opt('household', null);
if (!SIZES[map] || !['founders', 'heirs', 'populous'].includes(scenario)) { console.error('usage: node tools/sim.js --scenario founders|heirs|populous --seed N --map tiny|small|medium|large --years Y'); process.exit(2); }
if (report && !['households', 'pawns', 'jobs', 'customs', 'events', 'farms', 'idle'].includes(report)) { console.error('unknown report ' + report); process.exit(2); }

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
const st = Sim.seed(r.value, seedNum, scenario), say = (...a) => { if (!json) console.log(...a); };
const causeOf = (p) => { const e = p.events.find((x) => x.kind === 'died'); return e ? e.cause : null; };
const yearOf = (t) => Math.floor(t / Sim.YEAR) + 1;
say(`${scenario} seed ${seedNum} ${map} map (${r.value.N} tiles), ${years} years`);
say('year  pop  births  deaths(by cause)  marriages  hungry-days  mean-grain  demand  ms/day');
const idle = report === 'idle' ? require('./idle.js')(Sim, st) : null;
for (let y = 1; y <= years; y++) {
  const t0 = Date.now(), hungry0 = st.households.reduce((s, h) => s + h.hungryDays, 0);
  if (idle) idle.advanceYear(); else Sim.advance(st, Sim.YEAR);
  const ms = (Date.now() - t0) / Sim.YEAR_DAYS, live = st.households.filter((h) => !h.dissolved);
  const births = st.pawns.filter((p) => !p.founder && p.born >= (y - 1) * Sim.YEAR && p.born < y * Sim.YEAR).length;
  const deaths = {}; for (const p of st.pawns) if (p.died !== null && p.died >= (y - 1) * Sim.YEAR && p.died < y * Sim.YEAR) { const c = causeOf(p) || 'unknown'; deaths[c] = (deaths[c] || 0) + 1; }
  const marriages = st.unions.filter((u) => u.start >= (y - 1) * Sim.YEAR && u.start < y * Sim.YEAR).length;
  const grain = live.length ? live.reduce((s, h) => s + h.grain, 0) / live.length : 0;
  const d = Object.entries(deaths).map(([k, n]) => `${k} ${n}`).join(', ') || '-';
  say(`${String(y).padStart(4)} ${String(st.pawns.filter((p) => p.alive).length).padStart(4)} ${String(births).padStart(7)}  ${d.padEnd(16)} ${String(marriages).padStart(9)} ${String(st.households.reduce((s, h) => s + h.hungryDays, 0) - hungry0).padStart(12)} ${grain.toFixed(1).padStart(11)} ${String(st.demand.length).padStart(7)} ${ms.toFixed(1).padStart(7)}`);
}

const pawnRow = (p) => ({ id: p.id, name: Sim.fullName(p), sex: p.sex, age: p.age, household: p.household, role: p.role, alive: p.alive, hunger: +p.hunger.toFixed(2) });
const hhRow = (h) => ({ id: h.id, farm: st.farmsteads[h.farmstead].name, members: h.members.length, holder: h.holder, grain: Math.round(h.grain), wood: Math.round(h.wood),
  hungryDays: h.hungryDays, dissolved: h.dissolved });
const tables = {
  households: () => st.households.map(hhRow),
  pawns: () => st.pawns.filter((p) => p.alive).map(pawnRow),
  jobs: () => [...st.jobs.values()].map((j) => ({ id: j.id, key: j.key, kind: j.kind, owner: j.owner, site: j.site, claim: j.claim, done: j.done })),
  customs: () => st.cenv.cultures.map((c, i) => ({ culture: i, ...plain(c) })),
  events: () => st.events,
  idle: () => idle.result(),
  farms: () => st.farmsteads.map((f) => ({ id: f.id, name: f.name, village: f.village, household: f.household, state: f.state, fields: f.fields.map((fd) => fd.stage).join(',') })),
};
let out = null;
if (pawnId !== null) { const p = st.pawns[+pawnId]; if (!p) { console.error('no such pawn'); process.exit(1); } out = { ...plain(p), name: Sim.fullName(p) }; }
else if (hhId !== null) {
  const h = st.households[+hhId]; if (!h) { console.error('no such household'); process.exit(1); }
  out = { ...plain(h), farm: plain(st.farmsteads[h.farmstead]), people: h.members.map((m) => ({ ...pawnRow(st.pawns[m]), events: st.pawns[m].events })) };
} else if (report) out = plain(tables[report]());
if (out !== null && report === 'idle' && !json) {
  console.log('share of work hours (%): working / walking / carrying / idle');
  for (const [role, bs] of Object.entries(out.hoursShare)) for (const [season, v] of Object.entries(bs)) {
    console.log(`  ${role.padEnd(10)} ${season.padEnd(7)} ${v.working} / ${v.walking} / ${v.carrying} / ${v.idle}`);
  }
  console.log('idle hours by reason (%):'); console.table(out.idleReasons);
  console.log('wait from posting to claim (hours):'); console.table(out.waitHours);
  console.log('mean unclaimed jobs at end of work day:'); console.table(out.unclaimedAtEndOfDay);
} else if (out !== null) {
  if (json) console.log(JSON.stringify(out, null, 1));
  else if (Array.isArray(out) && out.length && typeof out[0] === 'object') console.table(out.map((o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : v]))));
  else console.log(JSON.stringify(out, null, 1));
}
