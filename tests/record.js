// The record of events (VB-075): after 10 founders years at seed 7, every pawn ever born has a born event, every dead pawn a died event and
// every union a married event; recordOf filters by pawn, place, kind and time and returns time order.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
const it = G.generate(7); let r; while (!(r = it.next()).done);
const st = Sim.seed(r.value, 7, 'founders');
Sim.advance(st, 10 * Sim.YEAR);
const of = (kind) => { const m = new Map(); for (const e of st.record) if (e.kind === kind) m.set(e.pawn, (m.get(e.pawn) || 0) + 1); return m; };
const born = of('born'), died = of('died');
for (const p of st.pawns) {
  assert.strictEqual(born.get(p.id), 1, `pawn ${p.id} has ${born.get(p.id) || 0} born events`);
  assert.strictEqual(died.get(p.id) || 0, p.died === null ? 0 : 1, `pawn ${p.id} (died ${p.died}) has ${died.get(p.id) || 0} died events`);
}
const wed = new Set(st.record.filter((e) => e.kind === 'married').map((e) => `${e.pawn}-${e.other}`));
for (const u of st.unions) assert.ok(wed.has(`${u.a}-${u.b}`), `union ${u.id} (${u.a} and ${u.b}) has no married event`);
for (const e of st.record) {
  assert.ok(typeof e.kind === 'string' && Number.isFinite(e.t) && e.t <= st.t, `bad event ${JSON.stringify(e)}`);
  for (const k of Object.keys(e)) assert.ok(e[k] !== undefined && e[k] !== null, `event ${JSON.stringify(e)}: ${k} is empty`);
}
// queries
const all = Sim.recordOf(st);
assert.strictEqual(all.length, st.record.length);
for (let i = 1; i < all.length; i++) assert.ok(all[i - 1].t <= all[i].t, 'recordOf returns time order');
const kid = st.pawns.find((p) => p.born > 0 && p.mother !== null), mine = Sim.recordOf(st, { pawn: kid.mother });
assert.ok(mine.some((e) => e.kind === 'born' && e.pawn === kid.id), 'a mother finds the birth of her child (as other)');
const v0 = Sim.recordOf(st, { village: 0, kinds: ['died'] });
assert.ok(v0.every((e) => e.village === 0 && e.kind === 'died'));
const y5 = Sim.recordOf(st, { from: 4 * Sim.YEAR, to: 5 * Sim.YEAR });
assert.ok(y5.length && y5.every((e) => e.t >= 4 * Sim.YEAR && e.t < 5 * Sim.YEAR));
const kinds = {}; for (const e of st.record) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
console.log(`record ok: founders 7 after 10 years: ${st.pawns.length} pawns, ${st.unions.length} unions, ${st.record.length} events `
  + `(${Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ')})`);
