// Lies and counter-stories (sim/stories, VB-554; design.md, Traits, talk and stories: Stories, the rows Lies, Exposure and What the
// player hears), on a constructed state of one village, chances forced with `fix`: only an enemy is lied about, and an honourable pawn
// never lies; a witness exposes a lie and a stranger believes it; the counter-story's valence by the hearer's honour; the verb slander
// and its refusals; what a pawn has heard, as its belief, never marked a lie; the played pawn's hearing of its household is notable.
const fs = require('fs'), path = require('path');
const VB = require('../src/load.js'), Sim = VB.sim, S = VB['sim/stories'], { STORY } = S, { issue } = VB['sim/commands'];
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('LIES FAIL:', m); } };
const near = (x, y, e = 1e-9) => Math.abs(x - y) <= e;
const map = Array.from({ length: 10 }, () => '.'.repeat(14));
const st = tinyState(tinyWorld(map), [{ at: [5, 5], farms: 4, sizes: [4, 4, 4, 4] }], { seed: 3 });
st.naturalDeaths = false;
const R = VB['sim/relations'], Traits = VB['sim/traits'], IDX = Traits.IDX;
const [x, y, z, u] = st.households.map((hh) => hh.holder);
const known = (id) => st.pawns[id].known || [], entry = (id, s) => known(id).find((e) => e.story === s.id);
const lies = () => [...(st.stories || new Map()).values()].filter((s) => s.lie);
for (const id of st.living) { st.pawns[id].traits[IDX.honour] = 0.5; st.pawns[id].traits[IDX.ambition] = 0.5; }

// only an enemy is lied about: x holds y as an enemy and z as a close friend; the chance forced, x lies about y and no other
st.pawns[x].bands.set(y, -1).set(z, 1);
st.rng.stories.fix = 0;
S.lieMaybe(st, x);
check(lies().length === 1 && lies()[0].subject === y && lies()[0].by === x && lies()[0].why === 'enemy', `x lies about its enemy: ${JSON.stringify(lies())}`);
check(entry(x, lies()[0]) && entry(x, lies()[0]).first, 'the liar holds its lie first-hand');
S.lieMaybe(st, x);
check(lies().length === 1, 'one lie about one pawn at a time');
S.lieMaybe(st, z); // z has no enemy
check(lies().length === 1, 'a pawn with no enemy makes up nothing');
// an honourable pawn never lies: z, of honour 1, holding u as an enemy
st.pawns[z].bands.set(u, -1);
st.pawns[z].traits[IDX.honour] = 1;
S.lieMaybe(st, z);
check(lies().length === 1, 'an honourable pawn never lies');
st.pawns[z].bands.delete(u);
st.pawns[z].traits[IDX.honour] = 0.5;
// the chance by the traits: honour 0 and ambition 1 doubles... (1 − 0) × (0.5 + 1) against (1 − 0.5) × (0.5 + 0.5): three times
const chance = (id) => STORY.lie * Traits.act(st, id, 'honour', 'lie') * Traits.act(st, id, 'ambition', 'lie');
const before = chance(x);
st.pawns[x].traits[IDX.honour] = 0; st.pawns[x].traits[IDX.ambition] = 1;
check(near(chance(x), 3 * before) && near(before, STORY.lie * 0.5), `the chance by honour and ambition: ${before} then ${chance(x)}`);
st.pawns[x].traits[IDX.honour] = 0.5; st.pawns[x].traits[IDX.ambition] = 0.5;

// a witness exposes, a stranger believes: x's lie about y told to u, who worked beside y (a good first-hand memory in the lie's domain),
// and to z, who knows nothing of y
const lie = lies()[0], K = STORY.kinds[lie.kind];
R.remember(st, u, y, 'worked');
const rec0 = st.record.length;
S.tell(st, x, z, entry(x, lie), 0);
check(entry(z, lie) && !entry(z, lie).first && entry(z, lie).from === x, `a stranger believes it: ${JSON.stringify(entry(z, lie))}`);
check(S.knowsBetter(st, u, lie) && !S.knowsBetter(st, z, lie), 'the witness knows better, the stranger does not');
// the witness's valence by its honour: told by x (zeal for this audience reset)
st.pawns[u].traits[IDX.honour] = 0;
const ex = entry(x, lie);
ex.zeal = [1, 1];
S.tell(st, x, u, ex, 0);
const c = st.stories.get(lie.counter), told = Math.max(-1, K.v * (1 + STORY.sharpen) - STORY.noise);
check(!entry(u, lie) && c && c.kind === 'lied' && c.subject === x && c.other === y, `the witness holds the counter-story: ${JSON.stringify(c)}`);
const want0 = -Math.min(1, STORY.counter * Math.abs(told) * 0.5 * (0.5 + 0.6)); // honour 0: × 0.5; Old Nordic's mean honour 0.6
check(entry(u, c) && entry(u, c).first && near(entry(u, c).v, want0), `its valence at honour 0: ${entry(u, c) && entry(u, c).v} against ${want0}`);
check(entry(x, c) && ex.zeal[0] === 0 && ex.zeal[1] === 0, 'the liar is told it at once and tells the lie no more');
check(R.reasonsOf(st, u, x).some((r) => r.label === 'Lied to me'), 'the witness remembers the liar by it');
const ev = st.record.slice(rec0).find((e) => e.kind === 'lieExposed');
check(ev && ev.pawn === u && ev.other === x && ev.reason === lie.kind && ev.village !== undefined, `the record's event: ${JSON.stringify(ev)}`);
// a second witness of honour 1 holds the same counter-story, of its own valence: three times (capped at 1)
const w2 = st.households[st.pawns[u].household].members.find((m) => m !== u && st.pawns[m].age >= 16) ?? null;
if (w2 !== null) {
  st.pawns[w2].traits[IDX.honour] = 1;
  if (!S.knowsBetter(st, w2, lie)) R.remember(st, w2, y, 'worked');
  ex.zeal = [1, 1];
  const was = st.storySeq;
  S.tell(st, x, w2, ex, 0);
  const want1 = -Math.min(1, STORY.counter * Math.abs(told) * 1.5 * (0.5 + 0.6));
  check(st.storySeq === was && entry(w2, c) && near(entry(w2, c).v, want1), `honour 1: ${entry(w2, c) && entry(w2, c).v} against ${want1}`);
  check(Math.abs(want1) > Math.abs(want0), 'the more honourable judges the liar harder');
} else check(false, 'no second adult in the witness household');
delete st.rng.stories.fix;

// the verb slander, the player's Speak ill of: refusals, then a lie of the player's
const child = st.living.find((id) => st.pawns[id].age < 16 && st.pawns[id].age >= 0);
const say = (actor, target, kind) => issue(st, { actor, verb: 'slander', target, args: { kind }, source: 'player' });
check(typeof say(z, z, 'claim') === 'string', 'nobody speaks ill of itself');
check(typeof say(z, u, 'nonsense') === 'string', 'no such tale');
check(typeof say(z, u, 'lied') === 'string', 'a counter-story is not a tale to make up');
if (child !== undefined) check(typeof say(z, child, 'claim') === 'string', 'not of a child under 16');
check(typeof say(x, y, 'quarrel') === 'string', 'a second lie about the same pawn is refused');
check(say(z, u, 'crop') === true && lies().some((s) => s.by === z && s.subject === u && s.why === 'player'), "the player's lie is made");
check(/goes round/.test(say(z, u, 'claim')), 'and not a second');

// what the player hears: the played pawn's view of its stories, never the flag; a story of its household heard is notable
const yw = st.households[st.pawns[y].household].members.find((m) => m !== y && st.pawns[m].age >= 16);
st.player = { pawn: yw, queue: [], auto: true };
const view = Sim.heard(st, z);
check(view.length && view.every((h) => !('lie' in h) && typeof h.what === 'string' && typeof h.remembered === 'string' && 'from' in h && 'mouths' in h),
  `Sim.heard: ${JSON.stringify(view).slice(0, 200)}`);
check(!/"lie"/.test(JSON.stringify(view)), 'no story view carries the flag');
const pageSrc = fs.readdirSync(path.join(__dirname, '../src/page')).map((f) => fs.readFileSync(path.join(__dirname, '../src/page', f), 'utf8')).join('\n');
check(!/\.lie\b/.test(pageSrc), 'no page text reads the flag');
const rec1 = st.record.length, mine = lies().find((s) => s.by === x);
st.rng.stories.fix = 0; // believed
S.tell(st, x, yw, Object.assign(entry(x, mine), { zeal: [1, 1] }), 0); // x tells one of y's household of y, played
const heardEv = st.record.slice(rec1).find((e) => e.kind === 'heardOfUs');
check(heardEv && heardEv.pawn === yw && Sim.notable(st, heardEv, yw) && Sim.notable(st, heardEv, yw)[0] === 'heard' && Sim.SKIP.heard,
  `the played pawn hears of itself: ${JSON.stringify(heardEv)}`);
delete st.rng.stories.fix;
delete st.player;
for (const id of st.living) { st.pawns[id].traits[IDX.honour] = 0.5; st.pawns[id].traits[IDX.ambition] = 0.5; } // within the bounds again
const bad = checkState(st);
check(!bad.length, `invariants: ${bad.slice(0, 3).join('; ')}`);
const back = Sim.load(tinyWorld(map), JSON.parse(JSON.stringify(Sim.save(st))));
check([...back.stories.values()].filter((s) => s.lie).length === lies().length, 'a save keeps the lies');
if (failed) process.exit(1);
console.log('lies ok: an enemy lied about, the honourable never; a witness exposes, a stranger believes; the counter-story by honour; the verb; what is heard');
