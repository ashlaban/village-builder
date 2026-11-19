// VB-1100: what a yes to an offer would bring (sim/preview offerPreview), on a small constructed state, the case of the playtest of 16
// November: a widowed holder with five children, the eldest a minor, marries onto a widow's farm. The preview names the five children
// who move (four with their father, the minor heir to kin the next day), the minor's farm held in trust by the receiving home, its heir
// and its food; after a yes and the next day, the state is what it said, and the preview wrote nothing to st.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, L = VB['sim/lifecycle'];
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const w = tinyWorld(Array(18).fill('.'.repeat(28)), { seed: 7 });
// Three farms of one village: Hans (0), his wife (1) and their five; a couple with three; Ingeborg's husband (11), she (12) and a son.
const st = tinyState(w, [{ at: [7, 9], farms: 3, sizes: [7, 4, 3] }]);
st.naturalDeaths = false;
const HANS = 0, INGEBORG = 12, KIDS = [2, 3, 4, 5, 6];
KIDS.forEach((id, i) => {
  const a = [14, 12, 10, 8, 5][i];
  st.pawns[id].born = st.t - a * Sim.YEAR - Sim.DAY;
  st.pawns[id].age = a;
});
VB['sim/wishes'].seedAsking(st); // the askings, written at their births, again for the births now set (and the queue's index by village)
assert.deepStrictEqual(KIDS.map((id) => st.pawns[id].father), KIDS.map(() => HANS), 'the five are Hans\'s');
L.killPawn(st, 1, 'illness');
L.killPawn(st, 11, 'illness');
Sim.advance(st, Sim.DAY);
const sodergarden = st.pawns[HANS].household, ostergarden = st.pawns[INGEBORG].household;
assert.strictEqual(st.households[sodergarden].holder, HANS, 'Hans holds his farm, widowed');
assert.strictEqual(st.households[ostergarden].holder, INGEBORG, 'Ingeborg holds hers, widowed');
// Ingeborg is played: the skip stops for the offer and names it, so that the page opens it where it is answered.
Sim.inhabit(st, INGEBORG);
const cursor = Sim.skipFrom(st, null);
// The match, Hans's side asking, to live at Ingeborg's, due tomorrow: open until then.
assert.strictEqual(Sim.command(st, { actor: HANS, verb: 'offer', target: INGEBORG, source: 'asking',
  args: { basis: 'match', gives: { man: HANS, home: ostergarden }, wants: { woman: INGEBORG }, due: st.t + Sim.DAY } }), true);
const o = st.offers[0];
assert.ok(o, 'the offer is open');
const stop = Sim.skipStop(st, cursor);
assert.ok(stop && stop.why === 'offer' && stop.offer === o.id, `the skip stops at the offer, by its id: ${JSON.stringify(stop)}`);
const before = JSON.stringify({ ...st, w: null }), count = VB.count.previewWalk;
const pv = Sim.offerPreview(st, o.id, INGEBORG);
assert.strictEqual(JSON.stringify({ ...st, w: null }), before, 'the preview writes nothing to st');
assert.ok(VB.count.previewWalk > count, 'the preview counts its walk');
assert.strictEqual(Sim.offerPreview(st, 999, INGEBORG), null, 'no preview of an offer not open');
assert.strictEqual(pv.by, INGEBORG, 'whose estimate it is');
assert.strictEqual(pv.home, ostergarden, 'the couple lives at Ingeborg\'s');
assert.strictEqual(pv.lapses, null);
const moved = (id) => pv.moves.find((m) => m.pawn === id);
assert.deepStrictEqual(moved(HANS), { pawn: HANS, from: sodergarden, to: ostergarden, as: 'spouse' }, 'Hans moves in');
for (const id of KIDS)
  assert.deepStrictEqual(moved(id), { pawn: id, from: sodergarden, to: ostergarden, as: 'child' }, `child ${id} moves to Ingeborg's`);
assert.strictEqual(pv.moves.length, 6, 'nobody else moves');
const farm = (h) => pv.farms.find((f) => f.household === h);
assert.deepStrictEqual(farm(sodergarden), { household: sodergarden, before: HANS, holder: KIDS[0], trustee: ostergarden, guardian: null, empty: false },
  'the minor takes Hans\'s farm, held in trust by the receiving home');
assert.strictEqual(farm(ostergarden).holder, INGEBORG, 'Ingeborg keeps hers');
assert.ok(pv.food.before > pv.food.after && pv.food.after > 0, `food falls with six more mouths: ${pv.food.before} to ${pv.food.after} days`);
// A yes from both, and the next morning: the state is what the preview said.
for (const by of [HANS, INGEBORG]) Sim.command(st, { actor: by, verb: 'answer', target: o.id, args: { yes: true }, source: 'player' });
assert.ok(!st.offers.length, 'the offer closed');
Sim.advance(st, (Math.floor(st.t / Sim.DAY) + 1) * Sim.DAY + 1 - st.t); // to the next day's first hour: its care for a farm left alone
for (const m of pv.moves) assert.strictEqual(st.pawns[m.pawn].household, m.to, `pawn ${m.pawn} lives where the preview said`);
for (const f of pv.farms) {
  const hh = st.households[f.household], t = st.liveTrusts.map((i) => st.trusts[i]).find((x) => x.household === f.household);
  assert.strictEqual(hh.holder, f.holder, `farm ${f.household}: its holder`);
  assert.strictEqual(t ? t.trustee : null, f.trustee, `farm ${f.household}: held in trust as said`);
}
assert.strictEqual(Sim.heirRanking(st, st.households[ostergarden])[0] ?? null, pv.heir.after, 'the home\'s first heir');
const food = Sim.foodDays(st, st.households[ostergarden]);
assert.ok(Math.abs(food - pv.food.after) <= 1, `the home's food the next morning, ${food} days, is the preview's ${pv.food.after}, less what is eaten`);
const bad = checkState(st);
assert.ok(!bad.length, bad.slice(0, 3).join('; '));
console.log(`offer preview ok: ${pv.moves.length} move, the minor's farm in trust at the home, food ${pv.food.before} to ${pv.food.after} days`);
