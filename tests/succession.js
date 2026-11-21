// The player is the line (VB-213, VB-1121): when the played pawn dies the player goes on as its successor, the first of its line by its
// village's inheritance customs, worked out beforehand (Sim.successor) and not chosen from a list; the widow's right to the farm, a
// successor's own farm or its refusal do not unmake it, and a child is played as a child. In life the player stays with its pawn, retired
// or not. With no one of the line alive the game ends, the break recorded. The tiny scene: household 0 is Olof's (46), wife 1, sons 8
// (25), 7 (22), 5 (17), 4 (15), 2 (11), daughters 6 (19), 3 (13); household 1's holder 9 has a son 11 of 7 and its servant 17.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, R = VB['sim/records'], H = VB['sim/heirs'], Culture = VB.culture;
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { canon, sha } = require('./lib/canon.js'), { checkState } = require('./lib/invariants.js');
const { dropKind } = require('./lib/record.js');
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'F'.repeat(18) : i === 11 ? '~'.repeat(18) : '.'.repeat(18)));
const make = (seed = 4) => tinyState(tinyWorld(rows), [{ at: [8, 6], farms: 4, sizes: [9, 9, 9, 9] }], { seed });
const hash = (st) => { const { w, ...rest } = st; return sha(canon(rest)); };
const sound = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants, ${what}`);
const custom = (st, dim, key) => { for (const s of st.cenv.settlements) s.practice[Culture.IDX[dim]] = Culture.optIndex(dim, key); };
const playerEvents = (st, id) => Sim.recordOf(st, { pawn: id, life: true }).filter((e) => e.kind === 'player').map((e) => e.text);
const scene = (st) => assert.deepStrictEqual([st.households[0].holder, st.households[1].holder, R.spouseOf(st, 9), st.pawns[11].age, st.pawns[17].servant ? 1 : 0], [0, 9, 10, 7, 1], 'the scene');

// 1. A played holder dies leaving a widow who keeps the farm (widow: for life) and sons of 19, 12 and 7: with the elder two dead first,
// the player is the son of 7, not the widow, and is played as a child. Only the successor may be taken.
{
  const st = make(); scene(st);
  assert.strictEqual(Sim.practice(st, 0).widow, 'life');
  assert.deepStrictEqual(Sim.successor(st, 9), { id: 16, why: 'son' }, 'the eldest son, sons first');
  for (const q of [16, 13]) Sim.killPawn(st, q, 'illness');
  assert.deepStrictEqual(Sim.successor(st, 9), { id: 11, why: 'son' }, 'a death is told by the successor changing');
  Sim.inhabit(st, 9); Sim.killPawn(st, 9, 'illness');
  assert.strictEqual(st.player.pawn, 9, 'the dead pawn is kept until the player goes on');
  assert.strictEqual(st.player.ended, null);
  assert.ok(/successor is/.test(Sim.succeed(st, 10)), 'not the widow');
  assert.strictEqual(Sim.succeed(st, 11), true);
  assert.strictEqual(st.player.pawn, 11);
  assert.ok(st.pawns[11].age < 18, 'played as a child');
  assert.ok(/went on as its son, /.test(playerEvents(st, 9)[1]), playerEvents(st, 9)[1]);
  assert.ok(/has not died/.test(Sim.succeed(st, 10)), 'no succession while the played pawn lives');
  sound(st, 'after the succession');
}

// 2. The customs name the successor: daughters first, the eldest daughter; youngest, the youngest son; sons only, a daughter never.
{
  const st = make();
  custom(st, 'heirSex', 'daughtersFirst');
  assert.strictEqual(Sim.successor(st, 0).id, 6, 'daughters first: the eldest daughter');
  custom(st, 'heirSex', 'sonsFirst'); custom(st, 'birthOrder', 'youngest');
  assert.strictEqual(Sim.successor(st, 0).id, 2, 'youngest: the youngest son');
  custom(st, 'birthOrder', 'eldest'); custom(st, 'heirSex', 'sons');
  for (const q of [8, 7, 5, 4, 2]) Sim.killPawn(st, q, 'illness');
  assert.notStrictEqual(st.pawns[Sim.successor(st, 0) ? Sim.successor(st, 0).id : 0].sex, 'f', 'sons only: no daughter');
}

// 3. Unlanded pawns have successors too: the wife's is her eldest son; a servant's is its child. A successor who holds a farm of its own,
// and would refuse this one, is still the successor, though the farm's ranking passes it over.
{
  const st = make();
  assert.strictEqual(Sim.successor(st, 1).id, 8, 'the wife: her eldest son');
  R.childrenOf(st, 0); st.idx.children.set(17, new Set([12])); // the servant's child, for this check only
  assert.strictEqual(Sim.successor(st, 17).id, 12, 'the servant: its child');
  st.households[2].holder = 8; R.noteHolder(st, st.households[2]); // the eldest son holds a farm of its own, for this check only
  assert.ok(!VB['sim/heirranking'].heirRanking(st, st.households[0]).includes(8), 'the farm passes it over');
  assert.strictEqual(Sim.successor(st, 0).id, 8, 'the line does not');
}

// 4. In life nothing changes whom the player plays: a played holder who hands the farm on is played on, retired.
{
  const st = make(); Sim.inhabit(st, 0);
  H.transfer(st, st.households[0], 8, 'marriage'); H.refreshRoles(st);
  assert.strictEqual(st.households[0].holder, 8, 'the son holds the farm');
  assert.strictEqual(st.player.pawn, 0, 'the player plays on as the old holder');
  assert.strictEqual(st.player.left, null);
  sound(st, 'after a handover in life');
}

// 5. No successor: the game ends, the break is recorded, Sim.succeed refuses; an ended game loads as ended.
{
  const st = make();
  for (const q of [11, 12, 13, 14, 15, 16]) Sim.killPawn(st, q, 'illness');
  st.pawns[9].father = st.pawns[9].mother = null;
  assert.strictEqual(Sim.successor(st, 9), null, 'no one of the line');
  Sim.inhabit(st, 9); Sim.killPawn(st, 9, 'illness');
  assert.strictEqual(st.player.ended, st.t, 'the line ends at the death');
  assert.ok(/The line ended with /.test(playerEvents(st, 9)[1]), 'and it is on the record');
  assert.strictEqual(Sim.succeed(st, 10), 'the line has ended');
  sound(st, 'an ended line');
  const back = Sim.load(tinyWorld(rows), JSON.parse(JSON.stringify(Sim.save(st))));
  assert.strictEqual(canon(back.player), canon(st.player), 'an ended game loads as ended');
}

// 6. The note is saved, and a save from before it loads; with no player a death is as it was.
{
  const st = make(), id = st.households[0].holder;
  Sim.inhabit(st, id); Sim.killPawn(st, id, 'illness');
  const world = () => tinyWorld(rows), back = Sim.load(world(), JSON.parse(JSON.stringify(Sim.save(st))));
  assert.strictEqual(canon(back.player), canon(st.player), 'the player and what its pawn left come back as saved');
  assert.deepStrictEqual(Sim.successor(back, id), Sim.successor(st, id), 'and so does its successor');
  for (const s of [st, back]) Sim.advance(s, Sim.DAY);
  assert.strictEqual(hash(back), hash(st), 'the loaded run and the saved one agree a day later');
  const live = make(); Sim.inhabit(live, id);
  const old = JSON.parse(JSON.stringify(Sim.save(live))); delete old.state.player.left; delete old.state.player.ended;
  const was = Sim.load(world(), old).player;
  assert.deepStrictEqual([was.left, was.ended], [null, null], 'a save from before the notes loads with none');
  const plain = make(), played = make(), other = plain.households[1].holder;
  Sim.inhabit(played, other);
  for (const s of [plain, played]) { Sim.killPawn(s, id, 'illness'); Sim.advance(s, Sim.DAY); }
  dropKind(played, 'player');
  played.player = null;
  assert.strictEqual(hash(played), hash(plain), 'another pawn\'s death is the same with a player as without');
}
console.log('succession ok: the successor by the customs, not the widow, a child played as a child, unlanded pawns too, a holder with '
  + 'a farm of its own still; played on after a handover; no successor ends the game; saved and loaded');
