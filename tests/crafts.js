// Crafts learnt by doing (VB-360; sim/skills): a pawn's level at a craft rises with its hours (halfway in SKILLS.half at aptitude 1,
// faster with the trait), fades a tenth a year unused, read in closed form, and sets a craft job's rate from a novice's to a master's;
// a save keeps it. On a tiny farm at seed 7.
const assert = require('assert'), VB = require('../src/load.js'), Sim = VB.sim;
const Skills = VB['sim/skills'], { SKILLS, level, practise, craftRate, craftsOf, workPace, legPace } = Skills;
const { YEAR } = VB['sim/rules'], { KINDS } = VB['sim/kinds'];
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

const w = tinyWorld(Array.from({ length: 18 }, () => '.'.repeat(24)));
const st = tinyState(w, [{ at: [8, 8], farms: 1, sizes: [6] }], { seed: 7 });
const p = st.pawns[0], id = p.id, traits0 = p.traits.slice();
// the rate: a novice at 0.6, a master at 1.3, linear between
assert(near(craftRate(0), 0.6) && near(craftRate(1), 1.3) && near(craftRate(0.5), 0.95), 'a novice 60%, a master 130%');
// nothing practised: every craft reads 0, and the panel lists none
assert.strictEqual(level(st, id, 'milling'), 0, 'unpractised reads 0');
assert.deepStrictEqual(craftsOf(st, id), [], 'no crafts listed');
// halfway in SKILLS.half hours at aptitude 1 (the trait at its middle), in one practice or in many
const trait = SKILLS.aptitude.milling || 'hands';
p.traits[VB['sim/traits'].IDX[trait]] = 0.5;
practise(st, id, 'milling', SKILLS.half);
assert(near(level(st, id, 'milling'), 0.5), `halfway in ${SKILLS.half} hours: ${level(st, id, 'milling')}`);
p.traits[VB['sim/traits'].IDX.hands] = 0.5;
for (let i = 0; i < 400; i++) practise(st, id, 'building', SKILLS.half / 400);
assert(near(level(st, id, 'building'), 0.5, 1e-9), `halfway in many small practices: ${level(st, id, 'building')}`);
// aptitude: a deft hand (the trait at 1) learns at 1.25 times
p.traits[VB['sim/traits'].IDX.hands] = 1;
practise(st, id, 'pottery', SKILLS.half / 1.25);
assert(near(level(st, id, 'pottery'), 0.5), 'a deft hand learns at 1.25');
// a tenth a year unused, read in closed form, and practice goes on from the faded level
const t0 = st.t;
st.t = t0 + YEAR;
assert(near(level(st, id, 'milling'), 0.45), `a tenth lost in a year: ${level(st, id, 'milling')}`);
st.t = t0 + 2 * YEAR;
assert(near(level(st, id, 'milling'), 0.405), 'two years: 0.81 of it');
practise(st, id, 'milling', 0);
assert(near(level(st, id, 'milling'), 0.405) && p.skills.milling.at === t0, 'no hours, no write');
practise(st, id, 'milling', 1e-6);
assert(near(p.skills.milling.level, 0.405, 1e-6) && p.skills.milling.at === st.t, 'a practice sets it from the faded level, now');
st.t = t0;
// a craft not declared is not learnt
practise(st, id, 'juggling', 100);
assert(!('juggling' in p.skills), 'only the crafts of SKILLS.crafts');
// the panel: crafts above the first cut, with their words
assert.deepStrictEqual(craftsOf(st, id).map((c) => [c.craft, c.word]), [['pottery', 'practised'], ['building', 'practised'], ['milling', 'practised']].sort((a, b) => SKILLS.crafts.indexOf(a[0]) - SKILLS.crafts.indexOf(b[0])), 'listed by craft with a word');
// a work leg's pace at a craft is the type's pace times the craft's rate, one draw of the stream `mishap`
st.rng.mishap.fix = 0.5;
assert.strictEqual(workPace(st, id, 'household', 'milling'), Math.round(legPace(st, id, 'household') * craftRate(level(st, id, 'milling')) * 1000) / 1000, 'a craft leg');
assert.strictEqual(workPace(st, id, 'household', undefined), legPace(st, id, 'household'), 'no craft: as before');
delete st.rng.mishap.fix;
// the craft kinds name crafts that are declared
for (const [k, K] of Object.entries(KINDS)) if (K.craft) assert(SKILLS.crafts.includes(K.craft), `${k}'s craft ${K.craft} is declared`);
assert.strictEqual(KINDS.grind.craft, 'milling', 'grinding is milling');
// a save keeps the skills
const data = JSON.parse(JSON.stringify(Sim.save(st))), back = Sim.load(w, data);
assert.deepStrictEqual(back.pawns[id].skills, p.skills, 'a save keeps them');
// a run: the forced state put back, a month of work; those who worked a craft hold it, and the invariants hold
p.traits = traits0;
delete p.skills;
Sim.advance(st, 24 * 30);
const learnt = st.pawns.filter((q) => q.skills).length;
assert.deepStrictEqual(checkState(st), [], 'invariants');
console.log(`crafts ok: halfway in ${SKILLS.half} hours, a tenth a year, the rate 0.6 to 1.3, the words, a save; ${learnt} pawns practised a craft in a month`);
