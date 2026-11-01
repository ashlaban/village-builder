// Claims on tiles (VB-042, sim/claims): adding, renewing, fading and lapsing, realising, each Disputed claims option, grievances and land held.
const VB = require('../src/load.js'), Sim = VB.sim, CL = VB['sim/claims'], { YEAR, CLAIMS } = VB['sim/rules'];
const { tinyWorld, tinyState, tileAt } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('CLAIMS FAIL:', m); } };
const map = [
  '................',
  '...FF...........',
  '...FF...........',
  '................',
  '...........FF...',
  '................',
  '................',
  '................',
  '................',
  '................',
];
const fresh = () => tinyState(tinyWorld(map), [{ at: [4, 5], farms: 3, sizes: [5, 5, 5] }, { at: [13, 3], farms: 2, sizes: [4, 4] }], { seed: 3 });
const H = (id) => ({ type: 'household', id }), V = (id) => ({ type: 'village', id });

// ---- adding, renewing, fading, lapsing, realising ----
let st = fresh();
const tile = tileAt(st.w, 8, 8);
check(Sim.ownerOf(st, tile) === null && !CL.claimsOn(st, tile).length, 'a free tile to start with');
st.landDirty.clear();
const c0 = CL.addClaim(st, tile, H(0), 'field');
check(CL.claimOf(st, tile, H(0)) === c0 && c0.state === 'unrealised' && CL.strength(st, c0) === 1, 'a new claim is at full strength');
check(st.landDirty.has(tile), 'a new claim marks the tile for the overlay');
check(CL.addClaim(st, tile, H(0), 'meadow') === c0 && CL.claimsOn(st, tile).length === 1 && c0.why === 'meadow', 'claiming again renews, not doubles');
st.t += 1.5 * YEAR;
check(Math.abs(CL.strength(st, c0) - 0.5) < 1e-6, `half strength after a year and a half (${CL.strength(st, c0)})`);
CL.renewClaim(st, tile, H(0));
check(CL.strength(st, c0) === 1, 'renewed to full strength');
st.t += CLAIMS.years * YEAR - 1;
check(!CL.lapseClaims(st).length && CL.claimsOn(st, tile).length === 1, 'still standing just before 3 years');
st.t += 1;
const gone = CL.lapseClaims(st);
check(gone.length === 1 && gone[0][0] === tile && !st.claims.has(tile), 'lapsed after 3 years without work');
const t2 = tileAt(st.w, 9, 8);
CL.addClaim(st, t2, H(1), 'field');
CL.addClaim(st, t2, { type: 'pawn', id: 0 }, 'birthright', { state: 'realised', until: st.t + 2 * YEAR });
CL.realise(st, t2, H(1));
check(Sim.ownerOf(st, t2) && Sim.ownerOf(st, t2).id === 1 && !CL.claimOf(st, t2, H(1)), 'realised: owned, and the claim gone');
check(CL.claimsOn(st, t2).length === 1 && CL.strength(st, CL.claimsOn(st, t2)[0]) === 1, 'a realised claim stays at full strength');
st.t += 2 * YEAR;
check(CL.lapseClaims(st).length === 1 && !st.claims.has(t2), 'a realised claim ends at its until');
let threw = false; try { CL.realise(st, t2, { type: 'pawn', id: 0 }); } catch (e) { threw = true; }
check(threw, 'a pawn cannot own land');
check(!checkState(st).length, `invariants: ${checkState(st).slice(0, 2).join('; ')}`);

// ---- disputes: each option of the custom ----
st = fresh();
const [a, b] = [0, 1], hA = st.households[a], hB = st.households[b];
const dispute = () => { const t = tileAt(st.w, 8, 7); return [CL.addClaim(st, t, H(a), 'field'), CL.addClaim(st, t, H(b), 'field')]; };
let [ca, cb] = dispute();
check(CL.settle(st, [ca, cb], 'first') === ca && CL.settle(st, [cb, ca], 'first') === ca, 'first: the earlier claim, in any order');
ca.renewed = st.t - 2 * YEAR;
check(CL.settle(st, [ca, cb], 'strongest') === cb, 'strongest: the claim worked or renewed more recently');
ca.renewed = st.t;
check(CL.settle(st, [ca, cb], 'strongest') === ca, 'strongest: on equal strength, the first');
const childOfB = st.pawns.find((p) => p.father === hB.holder || p.mother === hB.holder);
check(childOfB && CL.settle(st, [ca, cb], 'kin', { lastHolder: childOfB.id }) === cb, 'kin: the claimant akin to the last holder');
check(CL.settle(st, [ca, cb], 'kin', { lastHolder: null }) === ca, 'kin: with no last holder, the first');
// the meeting: the voices of village 0 tied to b's holder, not to a's
for (const p of st.cenv.settlements[0].members()) { p.ties.delete(hA.holder); if (p.id !== hB.holder) p.ties.set(hB.holder, 1); }
const sup = CL.support(st, [ca, cb], 0);
check(sup[1] > sup[0], `meeting: support ${sup.map((x) => x.toFixed(1))}`);
check(CL.settle(st, [ca, cb], 'meeting', { village: 0 }) === cb, 'meeting: the claimant with the voices behind them');
// two villages: the one with more voices wins at a joint meeting
const tv = tileAt(st.w, 9, 4), va = CL.addClaim(st, tv, V(1), 'outland'), vb = CL.addClaim(st, tv, V(0), 'outland');
check(CL.settle(st, [va, vb], 'first') === va && CL.settle(st, [va, vb], 'meeting') === vb, 'villages: the first claim, or the larger meeting');
// the loser's grievance: the rules that would have let it win
check(CL.rulesFor(st, [ca, cb], ca, { village: 0 }).includes('first') && !CL.rulesFor(st, [ca, cb], ca, { village: 0 }).includes('meeting'), 'rulesFor');
CL.aggrieve(st, [ca, cb], cb, { village: 0 });
check(hA.grievance && hA.grievance.rules.includes('first') && !hB.grievance, 'the loser remembers which rules would have served it');
Sim.refreshInterests(st);
const adultA = st.pawns.find((p) => p.alive && p.household === a && p.age >= 16), C = VB.culture, k = C.IDX.dispute;
check(adultA && adultA.interest[C.OFF[k] + C.optIndex('dispute', 'first')] > 0, 'an aggrieved adult leans towards the rule that would have served it');

// ---- land held ----
const land = CL.holdings(st), h0 = land.households.get(0), v0 = land.villages.get(0);
const f0 = st.farmsteads[hA.farmstead];
check(h0 && h0.house === 1 && h0.fields === f0.fields.length && h0.claims === 1, `household 0 holds ${JSON.stringify(h0)}`);
check(v0 && v0.green === 1 && v0.claims === 1, `village 0 holds ${JSON.stringify(v0)}`);
check(!checkState(st).length, `invariants after disputes: ${checkState(st).slice(0, 2).join('; ')}`);
if (failed) process.exit(1);
console.log(`claims ok: lapse after ${CLAIMS.years} years; first, strongest, kin and meeting settle as they should; ${JSON.stringify(h0)}`);
