// The player's wishes at the moving round (VB-212): where the round asks what a pawn itself wants, the player's wish stands in, and the
// round decides by its rules. A landless adult wished to stay is left out of st.demand, and neither claims nor leaves; an heir wished to
// move out enters it; a wish never passes a rule; a wish for one farm, for none, and against service narrow what the round gives; with no
// wish made, a played pawn's round is anyone's; the wishes are saved, and what the pawn may do at the round says what they bar.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, H = VB['sim/heirs'], FC = VB['sim/farmclaims'], S = VB['sim/service'], O = VB['sim/opportunities'];
const R = VB['sim/records'], X = VB['sim/expansion'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { canon, sha } = require('./lib/canon.js'), { checkState } = require('./lib/invariants.js');
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'F'.repeat(18) : i === 11 ? '~'.repeat(18) : '.'.repeat(18)));
const hash = (st) => { const { w, ...rest } = st; return sha(canon(rest)); };
const sound = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants, ${what}`);
const ask = (st, id) => O.forPawn(st, O.actorView(st, id), id).filter((o) => o.when === 'round');
const NONE = { out: null, claim: null, serve: null };
// Four farms: household 2 has grown children; household 3's holder is left alone; household 1 dies out and its farm stands empty.
function scene() {
  const st = tinyState(tinyWorld(rows), [{ at: [8, 6], farms: 4, sizes: [9, 9, 9, 9] }], { seed: 4 });
  const empty = st.farmsteads[st.households[1].farmstead], lone = st.households[3];
  H.extinct(st, st.households[1]);
  for (const id of [...lone.members]) if (id !== lone.holder) Sim.killPawn(st, id, 'illness');
  H.countDemand(st); Sim.refreshRoles(st);
  return { st, empty, lone };
}
// the scene's cast, the same in every copy of it: who the round gives the empty farm, who it sends into service, an heir, a holder, and
// an unmarried adult who wants out, for whom the round starts a plot (a married one moves with its spouse, whose wish is its own)
const cast = (() => {
  const { st, empty, lone } = scene();
  const claimant = FC.claimants(st, empty)[0];
  const round = scene().st; Sim.movingRound(round);
  const single = st.demand.find((id) => R.spouseOf(st, id) === null && X.hasPlot(round, id));
  const heir = st.living.find((id) => H.staysWhy(st, st.pawns[id]) === 'heir to the farm at home');
  const holder = st.households[2].holder, child = st.living.find((id) => st.pawns[id].age < 18);
  S.takeServants(st);
  const servant = lone.members.find((id) => id !== lone.holder);
  return { claimant, heir, holder, child, servant, single };
})();
assert.ok([cast.claimant, cast.heir, cast.servant, cast.child, cast.single].every((id) => id !== undefined), `the scene's cast: ${JSON.stringify(cast)}`);

// 1. A wish is set on the player, checked for its shape only, and kept until changed; playing another pawn starts with none.
{
  const { st, empty } = scene();
  assert.ok(/no pawn is played/.test(Sim.wish(st, 'out', true)), 'no wishes without a played pawn');
  Sim.inhabit(st, cast.claimant);
  assert.deepStrictEqual(st.player.wishes, NONE, 'a played pawn starts with no wishes');
  for (const [kind, value] of [['out', true], ['out', false], ['claim', empty.id], ['claim', false], ['serve', true], ['serve', false]]) {
    assert.strictEqual(Sim.wish(st, kind, value), true, `${kind} ${value}`); assert.strictEqual(st.player.wishes[kind], value);
    sound(st, `wish ${kind} ${value}`);
  }
  for (const [kind, value] of [['marry', true], ['out', 1], ['out', undefined], ['claim', true], ['claim', 999], ['claim', -1], ['serve', 'yes']]) {
    assert.ok(typeof Sim.wish(st, kind, value) === 'string', `${kind} ${value} is no wish`);
  }
  assert.deepStrictEqual(st.player.wishes, { out: false, claim: false, serve: false }, 'a refused wish leaves the wishes as they were');
  Sim.movingRound(st);
  assert.deepStrictEqual(st.player.wishes, { out: false, claim: false, serve: false }, 'the wishes are kept across the round');
  for (const kind of ['out', 'claim', 'serve']) assert.strictEqual(Sim.wish(st, kind, null), true);
  Sim.wish(st, 'out', false); Sim.inhabit(st, cast.heir);
  assert.deepStrictEqual(st.player.wishes, NONE, 'another pawn starts with none');
}

// 2. With no wish made, a played pawn's round is anyone's: the run hashes as the one with no player, the player's marks taken out.
{
  const plain = scene().st, played = scene().st;
  Sim.inhabit(played, cast.claimant);
  for (const st of [plain, played]) { Sim.movingRound(st); Sim.advance(st, Sim.DAY); }
  played.record = played.record.filter((e) => e.kind !== 'player');
  played.pawns[cast.claimant].events = played.pawns[cast.claimant].events.filter((e) => e.kind !== 'player');
  played.player = null;
  assert.strictEqual(hash(played), hash(plain), 'a played pawn with no wishes changes nothing at the round');
}

// 3. A landless adult whose player wishes it to stay is left out of st.demand, and so neither claims nor leaves.
{
  const { st, empty } = scene(), id = cast.single, home = st.pawns[id].household;
  assert.ok(st.demand.includes(id), 'the scene: an unmarried adult who wants out, and would be given a plot at the round');
  Sim.inhabit(st, id); Sim.wish(st, 'out', false);
  assert.strictEqual(H.staysWhy(st, st.pawns[id]), 'its player wishes it to stay');
  H.countDemand(st);
  assert.ok(!st.demand.includes(id), 'wished to stay, it is left out of st.demand');
  assert.ok(ask(st, id).every((o) => /wishes it to stay/.test(o.why)), 'and every act of the round says so');
  assert.strictEqual(ask(st, id).find((o) => o.verb === 'leave').own, null, 'though the pawn itself would move out');
  assert.ok(!FC.claimants(st, empty).includes(id) && FC.claimants(st, empty, [id]).length === 1, 'no claimant, though the rules would let it claim');
  Sim.movingRound(st);
  assert.ok(!st.demand.includes(id) && st.pawns[id].household === home && !st.pawns[id].servant, 'after the round it is at home still');
  assert.ok(!X.hasPlot(st, id), 'no plot is cleared for it');
  assert.ok(!st.farmsteads.some((f) => f.claim && f.claim.by === id) && !R.isHolder(st, id), 'it claimed nothing and holds nothing');
  sound(st, 'a round with a wish to stay');
}

// 4. An heir whose player wishes it to move out enters st.demand: waiting for the farm is the heir's own wish.
{
  const { st } = scene(), id = cast.heir;
  assert.ok(!st.demand.includes(id), 'the scene: the heir waits for the farm at home');
  Sim.inhabit(st, id);
  H.countDemand(st); assert.ok(!st.demand.includes(id), 'played with no wish, it waits as before');
  const leave = () => ask(st, id).find((o) => o.verb === 'leave');
  assert.ok(/heir to the farm at home/.test(leave().why) && leave().own === leave().why);
  Sim.wish(st, 'out', true); H.countDemand(st);
  assert.ok(st.demand.includes(id), 'wished to move out, the heir is counted among those who want out');
  assert.ok(leave().why === null && /heir to the farm at home/.test(leave().own), 'the round would let it; the pawn itself would have waited');
  Sim.wish(st, 'out', null); H.countDemand(st);
  assert.ok(!st.demand.includes(id), 'and waits again when the wish is taken back');
}

// 5. A wish never lets a pawn past a rule: a holder, a holder's spouse and a child never enter st.demand.
{
  const { st } = scene(), spouse = R.spouseOf(st, cast.holder);
  for (const id of [cast.holder, spouse, cast.child]) {
    if (id === null) continue;
    Sim.inhabit(st, id); Sim.wish(st, 'out', true); H.countDemand(st);
    assert.ok(!st.demand.includes(id), `pawn ${id} is kept by a rule`);
    const why = ask(st, id).find((o) => o.verb === 'leave').why;
    assert.ok(/holds a farm|under 18/.test(why), `and is told which (${why})`);
  }
  Sim.movingRound(st);
  assert.ok(R.isHolder(st, cast.holder), 'the holder holds its farm after the round');
  sound(st, 'a round with a wish against a rule');
}

// 6. The wish for a farm: none, or only the one named. The round's order among claimants is a rule, and stays.
{
  const { st, empty } = scene(), id = cast.claimant, other = st.farmsteads.find((f) => f.id !== empty.id).id;
  const first = () => FC.claimants(st, empty)[0], claim = () => ask(st, id).find((o) => o.verb === 'claim');
  Sim.inhabit(st, id);
  assert.ok(first() === id && claim().why === null, 'with no wish it is the first claimant');
  Sim.wish(st, 'claim', false);
  assert.ok(!FC.claimants(st, empty).includes(id) && FC.claimableFarm(st, id) === null, 'wishing for no farm, it is no claimant');
  assert.ok(/claim no farm/.test(claim().why), claim().why);
  Sim.wish(st, 'claim', other);
  assert.ok(!FC.claimants(st, empty).includes(id) && /another farm/.test(claim().why), 'nor when it wishes for another farm');
  assert.ok(st.demand.includes(id), 'it wants out all the same');
  Sim.wish(st, 'claim', empty.id);
  assert.ok(first() === id && claim().why === null, 'wishing for this farm, it stands where the rule puts it');
  FC.claimFarms(st);
  assert.strictEqual(empty.claim.by, id, 'and takes it at the round');
  // a wish for a farm does not pass the rule that the claimant wants out: an heir stays an heir
  const again = scene();
  Sim.inhabit(again.st, cast.heir); Sim.wish(again.st, 'claim', again.empty.id); H.countDemand(again.st);
  assert.ok(!FC.claimants(again.st, again.empty).includes(cast.heir), 'an heir who wishes for the farm, but not to move out, is no claimant');
}

// 7. The wish against service: the round passes it by, and it still wants land.
{
  const plain = scene(), { st, lone } = scene(), id = cast.servant;
  S.takeServants(plain.st);
  assert.strictEqual(plain.st.pawns[id].household, plain.lone.id, 'left to itself, it goes into service with the lone holder');
  Sim.inhabit(st, id);
  const serve = () => ask(st, id).find((o) => o.verb === 'serve');
  assert.strictEqual(serve().why, null);
  Sim.wish(st, 'serve', true); assert.strictEqual(serve().why, null, 'wishing to serve is as the pawn would');
  Sim.wish(st, 'serve', false);
  assert.ok(/no service/.test(serve().why), serve().why);
  const home = st.pawns[id].household;
  S.takeServants(st);
  assert.ok(st.pawns[id].household === home && !st.pawns[id].servant && st.demand.includes(id), 'declining, it stays at home and still wants land');
  assert.ok(lone.members.every((m) => m !== id), 'the holder takes another, or none');
  sound(st, 'service declined');
}

// 8. The wishes are saved with the run; a save from before them loads with none.
{
  const { st, empty } = scene();
  Sim.inhabit(st, cast.claimant); Sim.wish(st, 'out', true); Sim.wish(st, 'claim', empty.id); Sim.wish(st, 'serve', false);
  const world = () => tinyWorld(rows), data = JSON.parse(JSON.stringify(Sim.save(st))), back = Sim.load(world(), data);
  assert.deepStrictEqual(back.player.wishes, { out: true, claim: empty.id, serve: false }, 'the wishes come back as saved');
  for (const s of [st, back]) { Sim.movingRound(s); Sim.advance(s, Sim.DAY); }
  assert.strictEqual(hash(back), hash(st), 'the loaded run and the saved one agree after a round and a day');
  const old = JSON.parse(JSON.stringify(Sim.save(st))); delete old.state.player.wishes;
  const older = Sim.load(world(), old);
  assert.deepStrictEqual(older.player.wishes, NONE, 'a save from before the wishes loads with none');
  sound(older, 'loaded from an older save');
}
console.log('wishes ok: a wish to stay keeps a landless adult out of st.demand, and it neither claims nor leaves; an heir wished out enters it; '
  + 'no wish passes a rule; a farm wished for, none, and service declined; no wishes change nothing; saved and loaded');
