// @suite integration
// VB-705: standing is the sum of a pawn's public deeds. Every member of a village starts at DEED.base; a farm held adds DEED.held, and after
// the holding ends it fades with a half-life of DEED.heldHalf years; a holder's spouse has no term of its own position (the house's term is
// the household's); a gift of food given adds its worth to a sum that halves in DEED.giftHalf years, read as DEED.gift x (1 - exp(-sum /
// giftScale)). Nothing decays by a pass: each term is read in closed form from its value and the hour it was set.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim;
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const { setClock } = require('./lib/clock.js');
const { YEAR } = VB['sim/rules'], S = VB['sim/society'], { DEED } = S, { emit } = VB['sim/events'];
const { spouseOf, isHolder } = VB['sim/records'];
const rows = Array.from({ length: 12 }, () => '................');
const st = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 3, sizes: [5, 5, 5] }], { seed: 4 });
const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-6, `${what}: ${a} against ${b}`);
const part = (p, label) => (S.standingParts(st, p).find((x) => x[0] === label) || [null, 0])[1];
const sum = (p) => S.standingParts(st, p).reduce((s, x) => s + x[1], 0);

const hh = st.households[0], holder = st.pawns[hh.holder], sp = spouseOf(st, holder.id);
assert.ok(sp !== null, 'the scene: a holder with a spouse');
S.refreshStanding(st);
// the base for every member, the holding for the holder only
for (const id of st.living) near(part(st.pawns[id], 'A member of the village'), DEED.base, `pawn ${id}'s base`);
near(part(holder, 'Holds a farm'), DEED.held, "the holder's farm");
assert.strictEqual(part(st.pawns[sp], 'Holds a farm') + part(st.pawns[sp], 'Held a farm'), 0, 'the spouse holds nothing of its own');
assert.ok(!S.standingParts(st, st.pawns[sp]).some((x) => /spouse/i.test(x[0])), 'no base by status for the spouse');
near(holder.standing, sum(holder), 'standing is the sum of its parts');

// a gift of 50 rations: its term, and the sum halving in giftHalf years
const giver = st.pawns[st.households[1].holder];
const before = giver.standing;
emit(st, 'giftGiven', { giver: giver.id, worth: 50 });
const term = DEED.gift * (1 - Math.exp(-50 / DEED.giftScale));
near(part(giver, 'Gifts given'), term, 'a gift of 50 rations');
near(giver.standing - before, term, 'the giver gains at once');
assert.ok(term > 0.1 && term < 0.15, `50 rations give about 0.12 (${term})`);
emit(st, 'giftGiven', { giver: giver.id, worth: 50 });
near(part(giver, 'Gifts given'), DEED.gift * (1 - Math.exp(-100 / DEED.giftScale)), 'two gifts sum their worth');

// a holder who retires: held, faded by half in heldHalf years (the clock moved by hand; nothing else runs)
assert.ok(Sim.retireHolder(st, hh.id), 'the holder retires to its heir');
assert.ok(!isHolder(st, holder.id));
near(part(holder, 'Held a farm'), DEED.held, 'at once the old holder keeps the term');
setClock(st, st.t + DEED.heldHalf * YEAR);
near(part(holder, 'Held a farm'), DEED.held / 2, 'after heldHalf years, half');
near(part(giver, 'Gifts given'), DEED.gift * (1 - Math.exp(-(100 * Math.pow(0.5, DEED.heldHalf / DEED.giftHalf)) / DEED.giftScale)), 'the gifts fade with giftHalf');
// long after, the term is dropped from the record at the next refresh
setClock(st, st.t + 20 * DEED.heldHalf * YEAR);
S.refreshStanding(st);
assert.ok(!holder.deeds || !holder.deeds.held, 'a faded term is dropped');
assert.ok(!giver.deeds || !giver.deeds.gift, 'a faded gift is dropped');
assert.deepStrictEqual(checkState(st).filter((x) => /deed/.test(x)), [], 'the deeds are well formed');
console.log('deeds: base, a farm held and held before, gifts given and their fading');
