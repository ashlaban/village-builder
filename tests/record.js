// The record of events (VB-075): after 10 founders years at seed 7, every pawn ever born has a born event, every dead pawn a died event and
// every union a married event; recordOf filters by pawn, place, kind and time and returns time order. VB-199: a pawn's events are
// positions in the record and read as they did, every kind is in HISTORY, and the routine kinds fold into yearly counts.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
const fs = require('fs'), path = require('path'), { tokenize } = require('../tools/wrap.js');

// every log(st, text, event) call in the simulation passes its event: two commas at the call's own depth
const missing = [];
for (const f of fs.readdirSync(path.join(__dirname, '../src/sim')).map((x) => 'src/sim/' + x).concat(['src/sim.js'])) {
  const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), toks = tokenize(src).filter((t) => t.t !== 'com');
  for (let i = 0; i + 1 < toks.length; i++) {
    const t = toks[i], prev = toks[i - 1];
    if (t.t !== 'word' || t.v !== 'log' || toks[i + 1].v !== '(' || (prev && (prev.v === '.' || prev.v === 'function'))) continue;
    let depth = 0, commas = 0, j = i + 1;
    for (; j < toks.length; j++) {
      const v = toks[j].v;
      if (v === '(' || v === '[' || v === '{') depth++;
      else if (v === ')' || v === ']' || v === '}') { depth--; if (!depth) break; }
      else if (v === ',' && depth === 1) commas++;
      if (toks[j].t === 'tpl' && toks[j].open) depth++;
      if (toks[j].t === 'tpl' && src[toks[j].s] === '}') depth--;
    }
    if (commas < 2) missing.push(`${f}:${src.slice(0, t.s).split('\n').length}`);
  }
}
assert.deepStrictEqual(missing, [], `log calls without an event: ${missing.join(', ')}`);
// every kind of event a call writes is in the table of how long each kind is kept (VB-199): the literal kinds of personEvent, and of
// the events of log and record calls
const H = VB['sim/records'].HISTORY, written = new Set();
for (const f of fs.readdirSync(path.join(__dirname, '../src/sim')).map((x) => 'src/sim/' + x)) {
  const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  for (const m of src.matchAll(/personEvent\(st, [^,]+, '(\w+)'/g)) written.add(m[1]);
  for (const m of src.matchAll(/\b(?:log|record)\(st, [^;]*?\{[^;]*?kind: '(\w+)'/g)) written.add(m[1]);
}
const unlisted = [...written].filter((k) => !(k in H));
assert.deepStrictEqual(unlisted, [], `kinds written but not in HISTORY (sim/records): ${unlisted.join(', ')}`);
const world = () => { const it = G.generate(7); let r; while (!(r = it.next()).done); return r.value; };
// A pawn's life reads as it did when each pawn kept copies of its events: the times and texts of every pawn's events, heirs at seed 7
// after two and a half years (before any fold), hash as the copies did at 7812253, the commit before VB-199 (230 events, 79786b701a98b8a7,
// until VB-201 moved the night's culture and the round's phases). Re-recorded since for VB-235 (the clock) and when slopes entered the
// walking cost (VB-271), and when talk stopped writing memories and friend events (VB-240), and when a hungry household began to eat its
// seed (VB-282), and for planning days (VB-249) with occasions (VB-126, weddings and funeral ales in the lives), and for digging (VB-359),
// the village's wood (VB-326), timber (VB-328) and stone (VB-332), and when the weather began to place the
// biomes, so every island changed (VB-342), and for herding (VB-136: fewer gifts and close friends, the same births, deaths and marriages),
// and for dried fish and the boat (VB-300: 49 events became 58), and for the harvest hours (VB-333: 58 became 55), and for sheaves carried by the load (VB-335: 55 became 59):
// the lives changed, not how they are read.
{
  const st = Sim.seed(world(), 7, 'heirs');
  Sim.advance(st, 2.5 * Sim.YEAR);
  const lives = st.pawns.map((p) => Sim.recordOf(st, { pawn: p.id, life: true }).map((e) => [e.t, e.text === undefined ? null : e.text]));
  const hash = require('crypto').createHash('sha256').update(JSON.stringify(lives)).digest('hex').slice(0, 16);
  assert.strictEqual(lives.reduce((a, l) => a + l.length, 0), 59, 'heirs 7 at 2.5 years: 59 events on its pawns');
  assert.strictEqual(hash, '58cf091547929a21', 'a pawn\'s life reads as it did with copies');
}
const st = Sim.seed(world(), 7, 'founders');
Sim.advance(st, 10 * Sim.YEAR + 12 * Sim.DAY); // the fold of the tenth year's turn has ended
const live = st.record.filter((e) => typeof e === 'object'), told = live.filter((e) => !e.self);
const of = (kind) => { const m = new Map(); for (const e of told) if (e.kind === kind) m.set(e.pawn, (m.get(e.pawn) || 0) + 1); return m; };
const born = of('born'), died = of('died');
for (const p of st.pawns) {
  assert.strictEqual(born.get(p.id), 1, `pawn ${p.id} has ${born.get(p.id) || 0} born events`);
  assert.strictEqual(died.get(p.id) || 0, p.died === null ? 0 : 1, `pawn ${p.id} (died ${p.died}) has ${died.get(p.id) || 0} died events`);
}
const wed = new Set(told.filter((e) => e.kind === 'married').map((e) => `${e.pawn}-${e.other}`));
for (const u of st.unions) assert.ok(wed.has(`${u.a}-${u.b}`), `union ${u.id} (${u.a} and ${u.b}) has no married event`);
for (const e of live) {
  assert.ok(typeof e.kind === 'string' && Number.isFinite(e.t) && e.t <= st.t, `bad event ${JSON.stringify(e)}`);
  assert.ok(e.kind in H, `the kind ${e.kind} is not in HISTORY (sim/records)`);
  for (const k of Object.keys(e)) assert.ok(e[k] !== undefined && e[k] !== null, `event ${JSON.stringify(e)}: ${k} is empty`);
}
// the fold: a routine event is kept its years, then its slot is the index of its count, and each count is as many slots
const Y = Math.floor(st.t / Sim.YEAR), slots = new Map();
assert.strictEqual(st.recordFold.pass, null, 'the fold has ended');
for (const e of live) {
  if (H[e.kind]) assert.ok(e.t >= (Y - H[e.kind]) * Sim.YEAR, `a ${e.kind} event of year ${Math.floor(e.t / Sim.YEAR)} not folded in year ${Y}`);
}
st.record.forEach((e) => { if (typeof e === 'number') slots.set(e, (slots.get(e) || 0) + 1); });
assert.ok(st.recordYears.length && st.recordYears.every((c) => H[c.kind] === 2), 'ten years fold close friends and enemies only');
st.recordYears.forEach((c, k) => assert.strictEqual(slots.get(k), c.tally, `count ${k} ${JSON.stringify(c)}: ${slots.get(k)} slots`));
const keys = new Set(st.recordYears.map((c) => `${c.kind}|${c.village}|${c.year}`));
assert.strictEqual(keys.size, st.recordYears.length, 'one count per kind, village and year');
const kept = st.pawns.find((p) => p.events.some((at) => typeof st.record[at] === 'number'));
const gone = Sim.recordOf(st, { pawn: kept.id, life: true }).find((e) => e.folded);
assert.ok(gone && gone.text === undefined && H[gone.kind] && gone.folded === st.recordYears[st.record[gone.at]].tally, 'a folded event reads as its count');
// a save in the middle of a fold goes on as the run does
{
  const a = Sim.seed(world(), 7, 'heirs');
  Sim.advance(a, 3 * Sim.YEAR); // the third year's fold has begun, its first slice folded
  assert.ok(a.recordFold.pass && a.recordFold.pass.shortNext > a.recordFold.shortAt, `a fold under way: ${JSON.stringify(a.recordFold)}`);
  const b = Sim.load(world(), JSON.parse(JSON.stringify(Sim.save(a))));
  for (const s of [a, b]) Sim.advance(s, 6 * Sim.DAY);
  assert.strictEqual(a.recordFold.pass, null);
  assert.strictEqual(JSON.stringify([b.record, b.recordYears, b.recordFold]), JSON.stringify([a.record, a.recordYears, a.recordFold]),
    'loaded, the fold ends as it would have');
}
// queries
const all = Sim.recordOf(st);
assert.strictEqual(all.length, told.length);
for (let i = 1; i < all.length; i++) assert.ok(all[i - 1].t <= all[i].t, 'recordOf returns time order');
const kid = st.pawns.find((p) => p.born > 0 && p.mother !== null), mine = Sim.recordOf(st, { pawn: kid.mother });
assert.ok(mine.some((e) => e.kind === 'born' && e.pawn === kid.id), 'a mother finds the birth of her child (as other)');
const v0 = Sim.recordOf(st, { village: 0, kinds: ['died'] });
assert.ok(v0.every((e) => e.village === 0 && e.kind === 'died'));
const y5 = Sim.recordOf(st, { from: 4 * Sim.YEAR, to: 5 * Sim.YEAR });
assert.ok(y5.length && y5.every((e) => e.t >= 4 * Sim.YEAR && e.t < 5 * Sim.YEAR));
const kinds = {}; for (const e of live) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
const folded = st.recordYears.reduce((a, c) => a + c.tally, 0);
console.log(`record ok: founders 7 after 10 years: ${st.pawns.length} pawns, ${st.unions.length} unions, ${st.record.length} events, ${folded} `
  + `folded into ${st.recordYears.length} counts (${Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ')})`);
