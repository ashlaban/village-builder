// Mood (VB-062; design.md, Traits, talk and stories: Mood): 50 plus the modifiers in force, within 0 to 100. A modifier for a state is read
// from the state (hungry, cold, without water, weak), one for an event is written at it into pawn.mods (newly married, a child born, both
// parents, grieving at the death of a spouse, child or parent) and is gone on time without a pass, and "talked with a friend" is read from
// the latest talk. A save keeps the event modifiers. Nothing in the simulation reads mood. On the probe's small village.
const VB = require('../src/load.js'), Sim = VB.sim;
const fs = require('fs'), path = require('path');
const { DAY, MOOD, SOCIAL, TICKS, YEAR } = VB['sim/rules'], Mood = VB['sim/mood'];
const { spouseOf, childrenOf } = VB['sim/records'], { killPawn, wed } = VB['sim/lifecycle'], { dailyBirths } = VB['sim/births'];
const { readSource } = require('../tools/lib/source.js');
const probe = require('./lib/probe.js'), { checkState } = require('./lib/invariants.js');
let failed = 0;
const check = (ok, m) => {
  if (!ok) { failed++; console.error('MOOD FAIL:', m); }
};
// the clock set by hand, on a tick (the invariants hold st.t to st.tick)
const at = (st, t) => { st.tick = Math.round(t * TICKS); st.t = st.tick / TICKS; };
const keys = (st, id) => Mood.of(st, id).mods.map((m) => m.key).sort().join(',');
const valueOf = (st, id, key) => (Mood.of(st, id).mods.find((m) => m.key === key) || {}).value;
// a calm pawn: fed, healthy, warm, watered, no talk and no event modifiers
function calm(st) {
  for (const id of st.living) {
    const p = st.pawns[id];
    p.hunger = 0; p.health = 100; delete p.mods;
    st.agents[id].talk = null;
  }
  for (const hh of st.households) { hh.cold = 0; hh.dry = 0; }
}
const st = probe.state();
st.naturalDeaths = false;
calm(st);
const couple = st.living.find((id) => spouseOf(st, id) !== null && st.pawns[id].sex === 'f' && childrenOf(st, id).length);
const man = spouseOf(st, couple), kid = childrenOf(st, couple).find((c) => st.pawns[c].alive);
check(couple !== undefined && kid !== undefined, 'the probe has a married mother with a living child');

// --- calm: 50, no modifiers; the word
check(Mood.of(st, couple).mood === MOOD.base && keys(st, couple) === '', `calm: ${JSON.stringify(Mood.of(st, couple))}`);
check(['miserable', 'low', 'content', 'happy'].join() === [10, 30, 50, 80].map(Mood.word).join(), 'the words');
check(Mood.word(24) === 'miserable' && Mood.word(25) === 'low' && Mood.word(45) === 'content' && Mood.word(65) === 'happy', 'the cut points');

// --- the states: read from them, gone with them
{
  const p = st.pawns[couple], hh = st.households[p.household];
  p.hunger = 0.1;
  check(keys(st, couple) === '', 'hunger 0.1 is not hungry');
  p.hunger = 0.5;
  check(valueOf(st, couple, 'hungry') === -10, `hungry at 0.5: ${valueOf(st, couple, 'hungry')}`);
  hh.cold = 0.5;
  check(valueOf(st, couple, 'cold') === -10, `cold at 0.5: ${valueOf(st, couple, 'cold')}`);
  hh.dry = 0.2;
  check(valueOf(st, couple, 'dry') === -10, 'without water');
  p.health = 49;
  check(valueOf(st, couple, 'weak') === -10, 'weak under 50');
  check(Mood.of(st, couple).mood === 50 - 40, `all four: ${Mood.of(st, couple).mood}`);
  p.hunger = 1; hh.cold = 1; // -20, -20, -10, -10: 50 - 60, held at 0
  check(Mood.of(st, couple).mood === 0, `held at 0: ${Mood.of(st, couple).mood}`);
  calm(st);
  check(keys(st, couple) === '', 'the states gone, their modifiers too');
}

// --- talked with a friend: read from the latest talk, while the other is held at the friend line, for 2 days
{
  const a = st.agents[couple];
  a.talk = { with: man, kind: 'chat', at: st.t, until: st.t + 1 };
  const o = VB['sim/relations'].opinionOf(st, couple, man);
  check(o >= SOCIAL.friend, `the probe's wife holds her husband a friend: ${o}`);
  check(valueOf(st, couple, 'friend') === MOOD.friend.value, `talked with a friend: ${keys(st, couple)}`);
  const other = st.living.find((id) => VB['sim/relations'].opinionOf(st, couple, id) < SOCIAL.friend && id !== couple);
  if (other !== undefined) {
    a.talk = { with: other, kind: 'chat', at: st.t, until: st.t + 1 };
    check(valueOf(st, couple, 'friend') === undefined, 'a talk with one not a friend is no modifier');
  }
  a.talk = { with: man, kind: 'chat', at: st.t - MOOD.friend.days * DAY, until: st.t };
  check(valueOf(st, couple, 'friend') === undefined, 'gone two days after the talk');
  a.talk = null;
}

// --- the events: married, a child born (both parents), grieving (spouse, children, parents); gone on time
{
  const t0 = st.t;
  // a birth: the mother due today, no death in childbed
  const m = st.pawns[couple];
  m.pregnantUntil = st.t; m.pregnantBy = man; m.nursingUntil = null; m.nursling = null;
  st.rng.births.fix = 0.99;
  const born = st.pawns.length;
  dailyBirths(st);
  delete st.rng.births.fix;
  check(st.pawns.length === born + 1, 'a child born');
  check(valueOf(st, couple, 'child') === MOOD.child.value && valueOf(st, man, 'child') === MOOD.child.value, `both parents: ${keys(st, couple)} / ${keys(st, man)}`);
  check(Mood.of(st, couple).mood === 55, `mood 55: ${Mood.of(st, couple).mood}`);
  check(checkState(st).length === 0, `invariants: ${checkState(st).slice(0, 3)}`);
  // a death of their child: both parents grieve, and its siblings do not (not spouse, child or parent)
  const sib = childrenOf(st, couple).find((c) => c !== kid && c !== born && st.pawns[c].alive);
  killPawn(st, kid, 'killed');
  check(valueOf(st, couple, 'grieving') === MOOD.grieving.value && valueOf(st, man, 'grieving') === MOOD.grieving.value, 'the parents grieve');
  if (sib !== undefined) check(valueOf(st, sib, 'grieving') === undefined, 'a sibling does not');
  check(st.pawns[couple].mods.length === 2, 'one entry a key');
  // a second death refreshes, never doubles
  at(st, st.t + DAY);
  const kid2 = childrenOf(st, couple).find((c) => st.pawns[c].alive && c !== born);
  if (kid2 !== undefined) {
    killPawn(st, kid2, 'killed');
    const g = st.pawns[couple].mods.filter((x) => x.key === 'grieving');
    check(g.length === 1 && g[0].until === st.t + MOOD.grieving.days * DAY, 'grief refreshed, once');
  }
  // the save keeps them
  const data = JSON.parse(JSON.stringify(Sim.save(st))), back = Sim.load(probe.world(), data);
  check(JSON.stringify(back.pawns[couple].mods) === JSON.stringify(st.pawns[couple].mods), 'a save keeps pawn.mods');
  check(keys(back, couple) === keys(st, couple), `and mood after a load: ${keys(back, couple)}`);
  // gone on time: the child's 12 days from t0, read without a pass
  at(st, t0 + MOOD.child.days * DAY - 1);
  check(valueOf(st, couple, 'child') === MOOD.child.value, 'the child born still in force just before 12 days');
  at(st, t0 + MOOD.child.days * DAY);
  check(valueOf(st, couple, 'child') === undefined, 'gone at 12 days');
  check(st.pawns[couple].mods.some((x) => x.key === 'child'), 'the entry lies till the list is next written');
  // a death of the husband: the widow grieves (refreshed), and the expired entry is dropped as the list is written
  killPawn(st, man, 'killed');
  check(!st.pawns[couple].mods.some((x) => x.key === 'child'), 'dropped when the list was next written');
  check(valueOf(st, couple, 'grieving') === MOOD.grieving.value, 'the widow grieves');
  check(Mood.of(st, man) === null, 'the dead have no mood');
  // a wedding: both newly married
  // an unmarried man of the other farm, made 25 if he is younger
  const w = st.living.find((id) => st.pawns[id].sex === 'm' && spouseOf(st, id) === null && st.pawns[id].household !== st.pawns[couple].household);
  if (w !== undefined) {
    if (st.pawns[w].age < 25) { st.pawns[w].born = st.t - 25 * YEAR; st.pawns[w].age = 25; }
    wed(st, w, couple, st.pawns[couple].household);
    check(valueOf(st, w, 'married') === MOOD.married.value && valueOf(st, couple, 'married') === MOOD.married.value, `newly married: ${keys(st, w)}`);
  } else check(false, 'an unmarried man to wed');
  // the clock was moved by hand, which the legs' invariants notice: the modifiers' own are read
  const mine = checkState(st).filter((x) => x.includes('.mods'));
  check(mine.length === 0, `invariants of pawn.mods: ${mine.slice(0, 3)}`);
  const keep = st.pawns[couple].mods;
  st.pawns[couple].mods = [...keep, { key: 'married', until: st.t }, { key: 'joy', until: st.t }, { key: 'child', until: NaN }];
  check(checkState(st).filter((x) => x.includes('.mods')).length === 3, 'the invariant sees a key twice, an unknown key, and no end');
  st.pawns[couple].mods = keep;
  // within 0 to 100: everything good at once
  calm(st);
  for (const k of ['married', 'child']) Mood.feel(st, couple, k);
  st.agents[couple].talk = { with: w, kind: 'chat', at: st.t, until: st.t + 1 };
  const all = Mood.of(st, couple);
  check(all.mood >= 0 && all.mood <= 100 && all.mood === 50 + all.mods.reduce((s, x) => s + x.value, 0), `in range: ${all.mood}`);
}

// --- nothing in the simulation reads mood: only sim/mood itself and the Sim facade name it (until a later task means to)
{
  const src = path.join(__dirname, '..', 'src');
  for (const f of fs.readdirSync(path.join(src, 'sim'))) {
    if (f === 'mood.js') continue;
    const code = readSource(path.join(src, 'sim', f)).replace(/\/\/.*$/gm, ''); // its code, not its comments
    check(!/sim\/mood|\.mods\b|moodOf/.test(code), `src/sim/${f} reads mood`);
  }
}
if (failed) process.exit(1);
console.log('mood: states, events, talk, save and range ok');
