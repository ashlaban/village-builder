// The player's succession (VB-213): when the played pawn dies the player keeps it, with an empty queue and a note of what the death erases,
// until it goes on as another: the heir first, then kin by blood or marriage nearest first, the household, and those it thought friends.
// With none alive any adult may be chosen, and the break is recorded. The world does not wait for the choice.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, R = VB['sim/records'], H = VB['sim/heirs'], Rel = VB['sim/relations'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { canon, sha } = require('./lib/canon.js'), { checkState } = require('./lib/invariants.js');
const { dropKind } = require('./lib/record.js');
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'F'.repeat(18) : i === 11 ? '~'.repeat(18) : '.'.repeat(18)));
const make = (seed = 4) => tinyState(tinyWorld(rows), [{ at: [8, 6], farms: 4, sizes: [9, 9, 9, 9] }], { seed });
const hash = (st) => { const { w, ...rest } = st; return sha(canon(rest)); };
const sound = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants, ${what}`);
const ids = (list) => list.map((s) => s.id), whys = (list, why) => list.filter((s) => s.why === why).map((s) => s.id);
const playerEvents = (st, id) => Sim.recordOf(st, { pawn: id, life: true }).filter((e) => e.kind === 'player').map((e) => e.text);

// 1. A holder dies: the player keeps it with an empty queue; the heir, who holds the farm now, comes first, then the others in line, then
// kin nearest first with the widow at their head, and nobody twice.
{
  const st = make(), hh = st.households[0], id = hh.holder, wife = R.spouseOf(st, id), ranking = H.heirRanking(st, hh);
  assert.ok(wife !== null && ranking.length > 1, 'the scene: a married holder with heirs');
  const before = Sim.successors(st, id);
  assert.deepStrictEqual(ids(before).slice(0, ranking.length), ranking, 'for a living holder: its heirs, in the ranking\'s order');
  Sim.inhabit(st, id);
  Sim.queue(st, { actor: id, verb: 'goHome' }); Sim.queue(st, { actor: id, verb: 'idle', args: { until: st.t + 1 } });
  assert.strictEqual(st.player.left, null);
  Sim.killPawn(st, id, 'illness');
  const pl = st.player;
  assert.ok(pl && pl.pawn === id && pl.queue.length === 0, 'the player keeps its dead pawn, with an empty queue');
  assert.deepStrictEqual({ t: pl.left.t, held: pl.left.held, spouse: pl.left.spouse }, { t: st.t, held: hh.id, spouse: wife }, 'what the death erases is noted');
  sound(st, 'the played pawn has died');
  const list = Sim.successors(st, id), heir = hh.holder;
  assert.ok(heir !== id && heir !== null && list[0].id === heir && list[0].why === 'heir', `the heir, who holds the farm now, comes first (${JSON.stringify(list[0])})`);
  assert.deepStrictEqual(whys(list, 'heir').slice(1), H.heirRanking(st, hh).filter((q) => q !== heir), 'then the others in line to it');
  assert.strictEqual(new Set(ids(list)).size, list.length, 'nobody is listed twice');
  assert.ok(list.every((s) => st.pawns[s.id].alive && s.id !== id && typeof s.why === 'string'), 'only the living, each with its link');
  assert.ok(ids(list).includes(wife), 'the widow is among them, though the death ended the marriage');
  for (const c of R.childrenOf(st, id)) if (st.pawns[c].alive) assert.ok(ids(list).includes(c), `child ${c} is listed`);
  for (const m of hh.members) assert.ok(ids(list).includes(m), `housemate ${m} is listed`);
  // the world does not wait: a day passes, with the dead pawn still the player's
  Sim.advance(st, Sim.DAY); sound(st, 'a day after the death');
  assert.ok(typeof Sim.queue(st, { actor: id, verb: 'goHome' }) === 'string' || st.player.queue.length <= 1);
  // the choice: someone not on the list is refused; the heir is taken, and the dead pawn's events name the link
  const stranger = st.living.find((q) => !ids(Sim.successors(st, id)).includes(q));
  if (stranger !== undefined) assert.ok(/not among those/.test(Sim.succeed(st, stranger)), 'a stranger is refused while successors live');
  assert.ok(typeof Sim.succeed(st, id) === 'string', 'not as the dead pawn itself');
  assert.strictEqual(Sim.succeed(st, heir), true);
  assert.deepStrictEqual(st.player, { pawn: heir, auto: true, queue: [], refused: null, since: st.t, wishes: { out: null, claim: null, serve: null }, left: null });
  assert.deepStrictEqual(playerEvents(st, id), ['Played by the player', `The player went on as the heir, ${Sim.fullName(st.pawns[heir])}`]);
  assert.deepStrictEqual(playerEvents(st, heir), ['Played by the player']);
  assert.ok(st.record.some((e) => e.kind === 'player' && e.pawn === id && /went on as the heir/.test(e.text)), 'and it is on the record');
  assert.ok(/has not died/.test(Sim.succeed(st, wife)), 'no succession while the played pawn lives');
  sound(st, 'gone on as the heir');
}

// 2. Kin by blood and by marriage, each with its link, nearest degree first; those the pawn thought friends come last.
{
  // a grown child of a household who is not its holder: no farm, so no heirs; its parents, siblings and their spouses are its kin. The
  // first seed whose village has one (the generated households change with the generator).
  const grown = (st, hh) => hh.members.find((m) => m !== hh.holder && st.pawns[m].age >= 18 && st.pawns[m].father !== null
    && R.spouseOf(st, m) === null && R.siblingsOf(st, m).length > 1);
  let st = null, hh = null;
  for (let seed = 1; seed < 40 && !hh; seed++) { st = make(seed); hh = st.households.find((h) => grown(st, h) !== undefined) || null; }
  assert.ok(hh, 'the scene: a grown child with siblings');
  const id = grown(st, hh);
  const p = st.pawns[id], apart = (q) => st.pawns[q].household !== hh.id && !Number.isFinite(R.kinDegree(st, id, q));
  // marry a sibling to an outsider, and make a friend of someone from another farm
  const outsider = st.living.find((q) => apart(q) && R.spouseOf(st, q) === null && st.pawns[q].age >= 14);
  const sib = R.siblingsOf(st, id).find((q) => st.pawns[q].alive && R.spouseOf(st, q) === null && st.pawns[q].sex !== st.pawns[outsider].sex);
  const friend = st.living.find((q) => apart(q) && q !== outsider && Rel.compat(st, id, q) > 0.5); // compatible, to grow familiar with
  assert.ok(outsider !== undefined && sib !== undefined && friend !== undefined, 'the scene: an outsider to marry in and a friend');
  R.marry(st, sib, outsider, 1);
  const inLaw = R.spouseOf(st, sib), FRIEND = VB['sim/rules'].SOCIAL.friend;
  assert.strictEqual(inLaw, outsider, 'the scene: the sibling is married');
  Rel.addTie(st, id, friend, VB['sim/rules'].SOCIAL.affinity.known); // known well: the affinity whole (VB-240)
  assert.ok(Rel.opinionOf(st, id, friend) >= FRIEND, `the scene: a friend (${Rel.opinionOf(st, id, friend)})`);
  Sim.inhabit(st, id); Sim.killPawn(st, id, 'illness');
  const list = Sim.successors(st, id), at = (q) => list.find((s) => s.id === q), pos = (q) => ids(list).indexOf(q);
  assert.strictEqual(whys(list, 'heir').length, 0, 'it held no farm, so no heirs');
  for (const q of [p.father, p.mother]) if (q !== null && st.pawns[q].alive) assert.ok(['father', 'mother'].includes(at(q).why), `parent: ${at(q).why}`);
  assert.ok(['brother', 'sister'].includes(at(sib).why), `sibling: ${at(sib).why}`);
  assert.ok(/^(brother|sister)'s (wife|husband)$/.test(at(inLaw).why), `kin by marriage is listed with its link: ${at(inLaw) && at(inLaw).why}`);
  assert.ok(pos(p.father !== null && st.pawns[p.father].alive ? p.father : p.mother) < pos(sib), 'a parent (degree 1) before a sibling (degree 2)');
  assert.ok(pos(sib) < pos(inLaw), 'blood before marriage at the same degree');
  assert.ok(at(friend) && /friend/.test(at(friend).why), `the friend is listed (${JSON.stringify(st.player.left.ties)})`);
  assert.ok(list.filter((s) => !/friend/.test(s.why)).every((s) => pos(s.id) < pos(friend)), 'after kin and household');
  assert.strictEqual(Sim.succeed(st, inLaw), true);
  assert.ok(/went on as its (brother|sister)'s (wife|husband), /.test(playerEvents(st, id)[1]), playerEvents(st, id)[1]);
  sound(st, 'gone on as kin by marriage');
}

// 3. With none of them alive the list is empty: any living adult may be chosen, and the break is recorded.
{
  const st = make(), id = st.households[0].holder;
  Sim.inhabit(st, id); Sim.killPawn(st, id, 'illness');
  const others = st.living.filter((q) => !ids(Sim.successors(st, id)).includes(q));
  const adult = others.find((q) => st.pawns[q].age >= 18), child = others.find((q) => st.pawns[q].age < 18);
  assert.ok(adult !== undefined, 'the scene: an adult who is nothing to the dead pawn');
  for (const s of Sim.successors(st, id)) Sim.killPawn(st, s.id, 'illness');
  for (let n = 0; n < 5 && Sim.successors(st, id).length; n++) for (const s of Sim.successors(st, id)) Sim.killPawn(st, s.id, 'illness');
  assert.deepStrictEqual(Sim.successors(st, id), [], 'none of its heirs, kin, household or friends is alive');
  sound(st, 'a line with no one left');
  if (child !== undefined) assert.ok(/only an adult/.test(Sim.succeed(st, child)), 'a child does not begin a new line');
  assert.strictEqual(Sim.succeed(st, adult), true);
  assert.strictEqual(playerEvents(st, id)[1], `A break in the line: the player went on as ${Sim.fullName(st.pawns[adult])}`);
  assert.strictEqual(st.player.pawn, adult);
}

// 4. The note is saved, and a save from before it loads; with no player a death is as it was.
{
  const st = make(), id = st.households[0].holder;
  Sim.inhabit(st, id); Sim.killPawn(st, id, 'illness');
  const world = () => tinyWorld(rows), back = Sim.load(world(), JSON.parse(JSON.stringify(Sim.save(st))));
  assert.strictEqual(canon(back.player), canon(st.player), 'the player and what its pawn left come back as saved');
  assert.deepStrictEqual(Sim.successors(back, id), Sim.successors(st, id), 'and so do its successors');
  for (const s of [st, back]) Sim.advance(s, Sim.DAY);
  assert.strictEqual(hash(back), hash(st), 'the loaded run and the saved one agree a day later');
  const live = make(); Sim.inhabit(live, id);
  const old = JSON.parse(JSON.stringify(Sim.save(live))); delete old.state.player.left;
  assert.strictEqual(Sim.load(world(), old).player.left, null, 'a save from before the note loads with none');
  // a death with a player elsewhere changes nothing but the player
  const plain = make(), played = make(), other = plain.households[1].holder;
  Sim.inhabit(played, other);
  for (const s of [plain, played]) { Sim.killPawn(s, id, 'illness'); Sim.advance(s, Sim.DAY); }
  dropKind(played, 'player');
  played.player = null;
  assert.strictEqual(hash(played), hash(plain), 'another pawn\'s death is the same with a player as without');
}
console.log('succession ok: the played pawn dies and is kept until the choice; the heir first, kin by blood and marriage nearest first, household, '
  + 'friends; an empty list gives a break in the line; saved and loaded');
