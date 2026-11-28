// @suite fast
// Time taken from causes (VB-475): a pawn's skill at each type of work (sim/skills, from the stream `traits`), the mishap drawn at a work
// leg's start (the stream `mishap`), and reaping's and threshing's hours by the crop's size (sim/fieldwork). On a tiny farm at seed 7.
const assert = require('assert'), VB = require('../src/load.js'), Sim = VB.sim;
const Skills = VB['sim/skills'], { SKILL, paceOf, legPace, skillOf } = Skills;
const { TRAITS } = VB['sim/rules'], { CROPS } = VB['sim/crops'];
const { KINDS } = VB['sim/kinds'];
const { standing } = VB['sim/fields'];
const { SYSTEMS } = VB['sim/rng'];
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

// ---- the rule ----
assert(SYSTEMS.includes('mishap'), 'a stream of its own');
// skill alone moves the rate 0.9 to 1.1 (no mishap: u = 0), the norm at the middle
assert(near(paceOf(0, 0) * Skills.NORM, 0.9) && near(paceOf(1, 0) * Skills.NORM, 1.1), 'skill: 0.9 to 1.1');
// the most a mishap takes: a fifth at skill 0, a twentieth at skill 1
assert(near(1 - paceOf(0, 1) / paceOf(0, 0), 0.2) && near(1 - paceOf(1, 1) / paceOf(1, 0), 0.05), 'a mishap: a fifth to a twentieth');
// a hand of middling skill averages the norm: the mean draw (fix 0.5) gives exactly 1, and the mean over the draws too
assert(near(paceOf(0.5, 0.5), 1), 'the middle at the mean mishap is the norm');
let sum = 0;
for (let i = 0; i < 1000; i++) sum += paceOf(0.5, (i + 0.5) / 1000);
assert(near(sum / 1000, 1, 1e-6), `the middle averages the norm: ${sum / 1000}`);

// ---- a state: every pawn has its skills, drawn and kept ----
const w = tinyWorld(Array.from({ length: 18 }, () => '.'.repeat(24)));
const st = tinyState(w, [{ at: [8, 8], farms: 1, sizes: [6] }], { seed: 7 });
for (const p of st.pawns) {
  assert(Array.isArray(p.skill) && p.skill.length === SKILL.types.length, `pawn ${p.id} has a skill a type`);
  assert(p.skill.every((x) => x >= TRAITS.bounds[0] && x <= TRAITS.bounds[1]), `pawn ${p.id}'s skills within bounds`);
}
const skills = st.pawns.flatMap((p) => p.skill);
assert(new Set(skills).size > skills.length / 2, 'drawn, not all alike');
assert.strictEqual(skillOf(st, 0, 'no such type'), 0.5, 'a type not listed reads the middle');
// the leg's pace: drawn from the stream `mishap` only, which advances once a leg; forced with fix
const before = JSON.stringify(st.rng);
const p0 = st.pawns[0].id;
st.rng.mishap.fix = 0.5;
assert.strictEqual(legPace(st, p0, 'harvest'), Math.round(paceOf(skillOf(st, p0, 'harvest'), 0.5) * 1000) / 1000, 'the pace by skill and draw');
delete st.rng.mishap.fix;
assert.strictEqual(JSON.stringify(st.rng), before, 'a forced draw moves no stream');
legPace(st, p0, 'harvest');
const after = JSON.parse(JSON.stringify(st.rng)), was = JSON.parse(before);
for (const k of Object.keys(was)) if (k !== 'mishap') assert.deepStrictEqual(after[k], was[k], `stream ${k} untouched by a mishap`);
assert.notDeepStrictEqual(after.mishap, was.mishap, 'the mishap stream advances');

// ---- the crop's size: reaping and threshing by the crop over a normal crop, within a half and one and a half ----
const f = st.farmsteads[0], hh = st.households[f.household], fd = f.fields[0];
const reapRule = KINDS.reap.available, threshRule = KINDS.thresh.available;
const posted = (rule, at) => {
  const out = [];
  rule(st, hh, at, VB['sim/rules'].cal(st.t), (key, site, extra) => out.push(extra), f);
  return out[0];
};
Object.assign(fd, { stage: 'ripe', crop: 'barley', fert: 1, soil: 1, tilth: 0, weedMiss: 0, weedOpen: false });
const normal = standing(st, fd);
const hReap = posted(reapRule, fd).hours;
assert(near(hReap, Math.round(CROPS.barley.hours.reap * Math.min(1.5, Math.max(0.5, normal / CROPS.barley.yield)))), `reaping a crop of ${normal}: ${hReap} hours`);
fd.fert = 0.2; // a crop a fifth of normal: half the hours, no less
assert.strictEqual(posted(reapRule, fd).hours, Math.round(CROPS.barley.hours.reap * 0.5), 'a poor crop: at least half the hours');
fd.fert = 3; // a crop thrice normal: one and a half the hours, no more
assert.strictEqual(posted(reapRule, fd).hours, Math.round(CROPS.barley.hours.reap * 1.5), 'a great crop: at most one and a half');
fd.fert = 1;
// threshing: the sheaves first in the barn, one field's crop
hh.unthreshed = [CROPS.barley.yield * 1.2];
assert.strictEqual(posted(threshRule, f).hours, Math.round(CROPS.barley.hours.thresh * 1.2), 'threshing a crop a fifth over normal');
hh.unthreshed = [];
assert.strictEqual(posted(threshRule, f), undefined, 'nothing to thresh: no task');

// ---- run: hands at work carry their pace, within its bounds; the invariants hold ----
Sim.advance(st, 24 * 30);
const paces = st.agents.filter((a) => a.pace !== undefined).map((a) => a.pace);
assert(paces.length > 0, 'hands at work have a pace');
assert.deepStrictEqual(checkState(st), [], 'invariants');
console.log(`skills ok: the rule, the draws, the crop's size, ${paces.length} hands with a pace (${Math.min(...paces)} to ${Math.max(...paces)})`);
