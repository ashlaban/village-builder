// @suite fast
// The player is the line (VB-213, VB-1121): when the played pawn dies the player goes on as its successor, the first of its line by its
// village's inheritance customs, worked out beforehand (Sim.successor) and not chosen from a list; the widow's right to the farm, a
// successor's own farm or its refusal do not unmake it, and a child is played as a child. In life the player stays with its pawn, retired
// or not. With no one of the line alive the game ends, the break recorded. The tiny scene, its cast found by kin (castOf): household 0's
// holder, his wife, sons and daughters; household 1's holder, his wife, sons the youngest of them a child, and its servant.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, R = VB['sim/records'], H = VB['sim/heirs'], Culture = VB.culture, Customs = VB['sim/customs'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { canon, sha, kept } = require('./lib/canon.js'), { checkState } = require('./lib/invariants.js');
const { dropKind } = require('./lib/record.js');
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'F'.repeat(18) : i === 11 ? '~'.repeat(18) : '.'.repeat(18)));
const make = (seed = 3) => tinyState(tinyWorld(rows), [{ at: [8, 6], farms: 4, sizes: [9, 9, 9, 9] }], { seed });
const hash = (st) => sha(canon(kept(st)));
const sound = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants, ${what}`);
const custom = (st, dim, key) => { for (const s of st.cenv.settlements) s.practice[Customs.IDX[dim]] = Customs.optIndex(dim, key); };
const playerEvents = (st, id) => Sim.recordOf(st, { pawn: id, life: true }).filter((e) => e.kind === 'player').map((e) => e.text);
// the cast: a holder's sons and daughters living with it, eldest first (seed 3 draws them since VB-1951 moved the draws)
const kids = (st, h, sex) => st.households[h].members.filter((i) => i !== st.households[h].holder && st.pawns[i].sex === sex
  && (st.pawns[i].father === st.households[h].holder || st.pawns[i].mother === st.households[h].holder)).sort((a, b) => st.pawns[a].born - st.pawns[b].born);
const castOf = (st) => {
  const h0 = st.households[0], h1 = st.households[1];
  return { head: h0.holder, wife: R.spouseOf(st, h0.holder), sons: kids(st, 0, 'm'), daughters: kids(st, 0, 'f'),
    holder: h1.holder, widow: R.spouseOf(st, h1.holder), sons1: kids(st, 1, 'm'), children1: [...kids(st, 1, 'm'), ...kids(st, 1, 'f')],
    servant: h1.members.find((i) => st.pawns[i].servant) };
};
const C = castOf(make()), YOUNG = C.sons1[C.sons1.length - 1];
const scene = (st) => {
  const c = castOf(st);
  assert.ok(c.sons.length >= 2 && c.daughters.length >= 1 && c.wife !== null && c.sons1.length >= 2 && c.widow !== null && c.servant !== undefined
    && R.age(st, st.pawns[YOUNG]) < 18 && st.pawns[c.servant].servant, `the scene: ${JSON.stringify(c)}`);
};

// 1. A played holder dies leaving a widow who keeps the farm (widow: for life) and sons, the youngest a child: with the elder dead first,
// the player is the youngest, not the widow, and is played as a child. Only the successor may be taken.
{
  const st = make(); scene(st);
  assert.strictEqual(Sim.practice(st, 0).widow, 'life');
  assert.deepStrictEqual(Sim.successor(st, C.holder), { id: C.sons1[0], why: 'son' }, 'the eldest son, sons first');
  for (const q of C.sons1.slice(0, -1)) Sim.killPawn(st, q, 'illness');
  assert.deepStrictEqual(Sim.successor(st, C.holder), { id: YOUNG, why: 'son' }, 'a death is told by the successor changing');
  Sim.inhabit(st, C.holder); Sim.killPawn(st, C.holder, 'illness');
  assert.strictEqual(st.player.pawn, C.holder, 'the dead pawn is kept until the player goes on');
  assert.strictEqual(st.player.ended, null);
  assert.ok(/successor is/.test(Sim.succeed(st, C.widow)), 'not the widow');
  assert.strictEqual(Sim.succeed(st, YOUNG), true);
  assert.strictEqual(st.player.pawn, YOUNG);
  assert.ok(st.pawns[YOUNG].age < 18, 'played as a child');
  assert.ok(/went on as its son, /.test(playerEvents(st, C.holder)[1]), playerEvents(st, C.holder)[1]);
  assert.ok(/has not died/.test(Sim.succeed(st, C.widow)), 'no succession while the played pawn lives');
  sound(st, 'after the succession');
}

// 2. The customs name the successor: daughters first, the eldest daughter; youngest, the youngest son; sons only, a daughter never.
{
  const st = make();
  custom(st, 'heirSex', 'daughtersFirst');
  assert.strictEqual(Sim.successor(st, C.head).id, C.daughters[0], 'daughters first: the eldest daughter');
  custom(st, 'heirSex', 'sonsFirst'); custom(st, 'birthOrder', 'youngest');
  assert.strictEqual(Sim.successor(st, C.head).id, C.sons[C.sons.length - 1], 'youngest: the youngest son');
  custom(st, 'birthOrder', 'eldest'); custom(st, 'heirSex', 'sons');
  for (const q of C.sons) Sim.killPawn(st, q, 'illness');
  assert.notStrictEqual(st.pawns[Sim.successor(st, C.head) ? Sim.successor(st, C.head).id : C.head].sex, 'f', 'sons only: no daughter');
}

// 3. Unlanded pawns have successors too: the wife's is her eldest son; a servant's is its child. A successor who holds a farm of its own,
// and would refuse this one, is still the successor, though the farm's ranking passes it over.
{
  const st = make();
  assert.strictEqual(Sim.successor(st, C.wife).id, C.sons[0], 'the wife: her eldest son');
  const its = C.children1.find((i) => i !== C.servant);
  R.childrenOf(st, 0); st.idx.children.set(C.servant, new Set([its])); // the servant's child, for this check only
  assert.strictEqual(Sim.successor(st, C.servant).id, its, 'the servant: its child');
  st.households[2].holder = C.sons[0]; R.noteHolder(st, st.households[2]); // the eldest son holds a farm of its own, for this check only
  assert.ok(!VB['sim/heirranking'].heirRanking(st, st.households[0]).includes(C.sons[0]), 'the farm passes it over');
  assert.strictEqual(Sim.successor(st, C.head).id, C.sons[0], 'the line does not');
}

// 4. In life nothing changes whom the player plays: a played holder who hands the farm on is played on, retired.
{
  const st = make(); Sim.inhabit(st, C.head);
  H.transfer(st, st.households[0], C.sons[0], 'marriage'); H.refreshRoles(st);
  assert.strictEqual(st.households[0].holder, C.sons[0], 'the son holds the farm');
  assert.strictEqual(st.player.pawn, C.head, 'the player plays on as the old holder');
  assert.strictEqual(st.player.left, null);
  sound(st, 'after a handover in life');
}

// 5. No successor: the game ends, the break is recorded, Sim.succeed refuses; an ended game loads as ended.
{
  const st = make();
  for (const q of R.childrenOf(st, C.holder)) Sim.killPawn(st, q, 'illness');
  st.pawns[C.holder].father = st.pawns[C.holder].mother = null;
  assert.strictEqual(Sim.successor(st, C.holder), null, 'no one of the line');
  Sim.inhabit(st, C.holder); Sim.killPawn(st, C.holder, 'illness');
  assert.strictEqual(st.player.ended, st.t, 'the line ends at the death');
  assert.ok(/The line ended with /.test(playerEvents(st, C.holder)[1]), 'and it is on the record');
  assert.strictEqual(Sim.succeed(st, C.widow), 'the line has ended');
  sound(st, 'an ended line');
  const back = Sim.load(tinyWorld(rows), JSON.parse(JSON.stringify(Sim.save(st))));
  assert.strictEqual(canon(back.player), canon(st.player), 'an ended game loads as ended');
}

// 6. The note is saved; with no player a death is as it was.
{
  const st = make(), id = st.households[0].holder;
  Sim.inhabit(st, id); Sim.killPawn(st, id, 'illness');
  const world = () => tinyWorld(rows), back = Sim.load(world(), JSON.parse(JSON.stringify(Sim.save(st))));
  assert.strictEqual(canon(back.player), canon(st.player), 'the player and what its pawn left come back as saved');
  assert.deepStrictEqual(Sim.successor(back, id), Sim.successor(st, id), 'and so does its successor');
  for (const s of [st, back]) Sim.advance(s, Sim.DAY);
  assert.strictEqual(hash(back), hash(st), 'the loaded run and the saved one agree a day later');
  const plain = make(), played = make(), other = plain.households[1].holder;
  Sim.inhabit(played, other);
  for (const s of [plain, played]) { Sim.killPawn(s, id, 'illness'); Sim.advance(s, Sim.DAY); }
  dropKind(played, 'player');
  played.player = null; for (const p of played.pawns) delete p.control; delete played.controlled; delete played.queued; // and its controller (VB-1745)
  assert.strictEqual(hash(played), hash(plain), 'another pawn\'s death is the same with a player as without');
}
console.log('succession ok: the successor by the customs, not the widow, a child played as a child, unlanded pawns too, a holder with '
  + 'a farm of its own still; played on after a handover; no successor ends the game; saved and loaded');
