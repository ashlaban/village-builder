// Stories (sim/stories, VB-523; design.md, Traits, talk and stories: Stories), on a constructed state of one village, chances forced with
// `fix`: a witnessed event known first-hand, told and believed, its hearsay a memory discounted by hops and capped; saturation for one
// audience only; a ninth story drops the weakest; strength in closed form by half-lives and wits; a story dies with its last holder; a save keeps them.
const VB = require('../src/load.js'), Sim = VB.sim, S = VB['sim/stories'], { STORY } = S, { DAY } = VB['sim/rules'];
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('STORIES FAIL:', m); } };
const near = (x, y, e = 1e-9) => Math.abs(x - y) <= e;
const map = Array.from({ length: 10 }, () => '.'.repeat(14));
const w = tinyWorld(map), st = tinyState(w, [{ at: [5, 5], farms: 4, sizes: [4, 4, 4, 4] }], { seed: 3 });
st.naturalDeaths = false;
const R = VB['sim/relations'], Traits = VB['sim/traits'], WITS = Traits.IDX.wits;
const heads = st.households.map((hh) => hh.holder);
check(heads.length === 4 && heads.every((h) => h !== null), `four households with heads: ${heads}`);
const [x, y, z, u] = heads, known = (id) => st.pawns[id].known || [], entry = (id, s) => known(id).find((e) => e.story === s.id);
const adults = (hh) => st.households[hh].members.filter((m) => st.pawns[m].age >= 16);
for (const id of st.living) st.pawns[id].traits[WITS] = 0.5; // a strength's half-life is its rule's, by wits 0.5

// a witnessed claim: known first-hand to the parties and the adults of their households, nobody else; held counts them
const s1 = S.witness(st, 'claim', x, y, null);
const first = new Set([...adults(st.pawns[x].household), ...adults(st.pawns[y].household), x, y]);
check(s1 && s1.held === first.size && st.stories.get(s1.id) === s1, `claim held by ${s1 && s1.held}, first-hand ${first.size}`);
check([...first].every((id) => entry(id, s1) && entry(id, s1).first && entry(id, s1).hops === 0), 'each first-hand knower holds it, hops 0');
check(!entry(z, s1) && !entry(u, s1), 'the other households have not heard it');
check(!R.reasonsOf(st, y, x).some((r) => /Heard/.test(r.label)), 'a first-hand knower keeps no hearsay of it');

// told and believed: z hears it from y, sharpened, with the noise at its least (the draws fixed at 0); a memory of x by the told valence ×
// hop, capped at STORY.cap a subject
st.rng.stories.fix = 0;
const told = Math.max(-1, -0.5 * (1 + STORY.sharpen) - STORY.noise);
S.tell(st, y, z, entry(y, s1), 0);
check(entry(z, s1) && near(entry(z, s1).v, told) && entry(z, s1).hops === 1 && !entry(z, s1).first, `z believes it: ${JSON.stringify(entry(z, s1))}`);
check(s1.held === first.size + 1 && s1.by === y, `held ${s1.held}; first told by ${s1.by}`);
const mem = (a, b, k) => (st.pawns[a].rel.get(b) || { mem: {} }).mem[k];
check(mem(z, x, 'heardIll') && near(mem(z, x, 'heardIll').v, Math.max(-STORY.cap, told * STORY.hop)), `hearsay: ${JSON.stringify(mem(z, x, 'heardIll'))}`);
// a smaller story, two mouths on: discounted by hop for each
const s2 = S.witness(st, 'shirked', u, null, null);
const t1 = -0.2 * (1 + STORY.sharpen) - STORY.noise, t2 = t1 * (1 + STORY.sharpen) - STORY.noise;
S.tell(st, u, y, entry(u, s2), 0);
S.tell(st, y, z, entry(y, s2), 0);
check(near(entry(z, s2).v, t2) && entry(z, s2).hops === 2, `two mouths on: ${JSON.stringify(entry(z, s2))}`);
check(near(mem(z, u, 'heardIll').v, t2 * STORY.hop * STORY.hop), `hearsay discounted by hops: ${mem(z, u, 'heardIll').v} against ${t2 * STORY.hop ** 2}`);
check(near(mem(y, u, 'heardIll').v, t1 * STORY.hop), `the first hearer's: ${mem(y, u, 'heardIll').v}`);

// saturation: told again to one who holds it, the teller's zeal for that audience halves; the other audience's stays
const ey = entry(y, s1);
S.tell(st, y, z, ey, 0);
check(near(ey.zeal[0], STORY.stifle) && ey.zeal[1] === 1, `zeal after saturation: ${ey.zeal}`);
// not told: the chance fails (draws fixed at 0.99)
st.rng.stories.fix = 0.99;
const before = known(u).length;
S.tellMaybe(st, y, u);
check(known(u).length === before, 'no telling when the chance fails');
delete st.rng.stories.fix;

// strength in closed form: a half-life on is a half, three for a first-hand one; a slow pawn forgets sooner than a sharp one
const ez = entry(z, s1), half = STORY.half * DAY; // wits 0.5: (0.5 + wits) is 1
ez.t = st.t - half;
check(near(S.strength(st, z, ez), 0.5), `a half-life on: ${S.strength(st, z, ez)}`);
const ex = entry(x, s1);
ex.t = st.t - half;
check(near(S.strength(st, x, ex), Math.pow(0.5, 1 / 3)), `first-hand, a third of its half-life: ${S.strength(st, x, ex)}`);
ex.t = st.t - 3 * half;
check(near(S.strength(st, x, ex), 0.5), `first-hand, three half-lives: ${S.strength(st, x, ex)}`);
st.pawns[z].traits[WITS] = 0;
const slow = S.strength(st, z, ez);
st.pawns[z].traits[WITS] = 1;
const sharp = S.strength(st, z, ez);
st.pawns[z].traits[WITS] = 0.5;
check(slow < 0.5 && sharp > 0.5, `a slow pawn forgets sooner: slow ${slow}, sharp ${sharp}`);
ez.t = st.t;
ex.t = st.t;

// a ninth story drops the weakest, |v| × strength
const pz = st.pawns[z];
while (known(z).length < STORY.keep) S.witness(st, 'ale', x, null, [z]);
const weak = known(z)[known(z).length - 1];
weak.t = st.t - 2 * STORY.halfFirst * DAY; // first-hand, a quarter of its strength
const weakId = weak.story;
S.witness(st, 'ale', x, null, [z]);
check(pz.known.length === STORY.keep && !pz.known.some((e) => e.story === weakId), `the ninth: ${pz.known.length} held, the weakest gone`);
check(!st.stories.has(weakId) || st.stories.get(weakId).held >= 1, 'a story dropped by one holder is kept for the others');
let bad = checkState(st);
check(!bad.length, `invariants: ${bad.slice(0, 3).join('; ')}`);

// a save keeps them: written as JSON, loaded into the same world
const data = JSON.parse(JSON.stringify(Sim.save(st))), back = Sim.load(tinyWorld(map), data);
check(back.stories.size === st.stories.size && JSON.stringify(back.pawns[z].known) === JSON.stringify(pz.known), 'a save keeps the stories and who holds them');

// a story dies with its last holder: kill the holders of the shirked story one by one
const { killPawn } = VB['sim/lifecycle'];
for (const id of [...st.living]) if (entry(id, s2)) killPawn(st, id);
check(!st.stories.has(s2.id), 'a story nobody holds is dropped');
check(st.pawns.every((p) => p.alive || !p.known), 'the dead hold none');
bad = checkState(st);
check(!bad.length, `invariants after the deaths: ${bad.slice(0, 3).join('; ')}`);

// the report (tools/stories.js, tools/sim.js --report stories): a year of the loaded state, its stories counted by kind, hops and spread
const C = require('../tools/stories.js').collector(VB, back), madeBefore = back.storySeq;
S.witness(back, 'quarrel', heads[0], heads[1], null);
C.advanceYear();
const rep = C.result(), y1 = rep.years[0];
check(y1.made.quarrel >= 1 && y1.heldPerPawn > 0 && y1.hops[0] && y1.hops[0].held === 1, `the report's year: ${JSON.stringify(y1).slice(0, 200)}`);
check(rep.spread[0].day === 0 && rep.spread[0].sampled >= back.storySeq - madeBefore - 1 && rep.cost.livingPawnDays > 0, `the report's spread and cost: ${JSON.stringify(rep.spread[0])}`);
if (failed) process.exit(1);
console.log('stories ok: witnessed, told, believed, saturated, forgotten, dropped, saved; the report counts them');
