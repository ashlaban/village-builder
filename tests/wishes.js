// The wishes at the moving round (VB-212, VB-680): every pawn's wish is on the pawn (pawn.wish, sim/wishes), the player's for the pawn it
// plays; where the round asks what a pawn itself wants it reads the wish, and decides by its rules. A landless adult wished to stay is left out of st.demand, and neither claims nor leaves; an heir wished to
// move out enters it; a wish never passes a rule; a wish for one farm, for none, and against service narrow what the round gives; with no
// wish made, a played pawn's round is anyone's; the wishes are saved, and what the pawn may do at the round says what they bar.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, H = VB['sim/heirs'], FC = VB['sim/farmclaims'], S = VB['sim/service'], O = VB['sim/opportunities'];
const MT = VB['sim/matching'];
const R = VB['sim/records'], X = VB['sim/expansion'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { canon, sha, kept } = require('./lib/canon.js'), { checkState } = require('./lib/invariants.js');
const { dropKind } = require('./lib/record.js');
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'F'.repeat(18) : i === 11 ? '~'.repeat(18) : '.'.repeat(18)));
const hash = (st) => sha(canon(kept(st)));
const sound = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants, ${what}`);
const ask = (st, id) => O.forPawn(st, O.actorView(st, id), id).filter((o) => o.when === 'round');
const NONE = { out: null, claim: null, serve: null, match: null };
// the played pawn's wishes, by the kinds of VB-212 and VB-274 (Sim.wishesOf reads them off the pawn)
const W = (st, id = st.player.pawn) => { const { out, claim, serve, match } = Sim.wishesOf(st, id); return { out, claim, serve, match }; };
// Four farms: household 2 has grown children; household 3's holder is left alone; household 1 dies out and its farm stands empty.
let SEED = 1;
function scene() {
  const st = tinyState(tinyWorld(rows), [{ at: [8, 6], farms: 4, sizes: [9, 9, 9, 9] }], { seed: SEED });
  const empty = st.farmsteads[st.households[1].farmstead], lone = st.households[3];
  H.extinct(st, st.households[1]);
  for (const id of [...lone.members]) if (id !== lone.holder) Sim.killPawn(st, id, 'illness');
  H.countDemand(st); Sim.refreshRoles(st);
  return { st, empty, lone };
}
// the scene's cast, the same in every copy of it: who the round gives the empty farm, who it sends into service, an heir, a holder, and
// an unmarried adult who wants out, for whom the round starts a plot (a married one moves with its spouse, whose wish is its own)
const castOf = () => {
  const { st, empty, lone } = scene();
  const claimant = FC.claimants(st, empty)[0];
  const round = scene().st; Sim.movingRound(round);
  const single = st.demand.find((id) => R.spouseOf(st, id) === null && VB['sim/allotment'].hasPlot(round, id));
  const heir = st.living.find((id) => H.staysWhy(st, st.pawns[id]) === 'heir to the farm at home');
  const holder = st.households[2].holder, child = st.living.find((id) => st.pawns[id].age < 18);
  S.takeServants(st);
  const servant = lone.members.find((id) => id !== lone.holder);
  return { claimant, heir, holder, child, servant, single };
};
// the first seed whose village has the whole cast (the generated households change with the generator)
const whole = (c) => [c.claimant, c.heir, c.servant, c.child, c.single].every((id) => id !== undefined);
let cast = null;
for (SEED = 1; SEED < 40; SEED++) { cast = castOf(); if (whole(cast)) break; }
assert.ok(whole(cast), `the scene's cast: ${JSON.stringify(cast)}`);

// 1. A wish is set on the player, checked for its shape only, and kept until changed; playing another pawn starts with none.
{
  const { st, empty } = scene();
  assert.ok(/there is no pawn -1/.test(Sim.wish(st, -1, 'out', true)), 'no wishes without a played pawn');
  Sim.inhabit(st, cast.claimant);
  assert.deepStrictEqual(W(st), NONE, 'a played pawn starts with no wishes');
  for (const [kind, value] of [['out', true], ['out', false], ['claim', empty.id], ['claim', false], ['serve', true], ['serve', false]]) {
    // serve true is as the pawn would: it reads null
    assert.strictEqual(Sim.wish(st, st.player.pawn, kind, value), true, `${kind} ${value}`); assert.strictEqual(W(st)[kind], kind === 'serve' && value ? null : value);
    sound(st, `wish ${kind} ${value}`);
  }
  for (const [kind, value] of [['marry', true], ['out', 1], ['out', undefined], ['claim', true], ['claim', 999], ['claim', -1], ['serve', 'yes']]) {
    assert.ok(typeof Sim.wish(st, st.player.pawn, kind, value) === 'string', `${kind} ${value} is no wish`);
  }
  assert.deepStrictEqual(W(st), { out: false, claim: false, serve: false, match: null }, 'a refused wish leaves the wishes as they were');
  Sim.movingRound(st);
  assert.deepStrictEqual(W(st), { out: false, claim: false, serve: false, match: null }, 'the wishes are kept across the round');
  for (const kind of ['out', 'claim', 'serve']) assert.strictEqual(Sim.wish(st, st.player.pawn, kind, null), true);
  const first = st.player.pawn;
  Sim.wish(st, st.player.pawn, 'out', false); Sim.inhabit(st, cast.heir);
  assert.deepStrictEqual(W(st), NONE, 'another pawn starts with none');
  assert.strictEqual(W(st, first).out, false, 'and the pawn left keeps its wish until its own choosing at the next round');
}

// 2. With no wish made, a played pawn's round is anyone's: the run hashes as the one with no player, the player's marks taken out.
{
  const plain = scene().st, played = scene().st;
  Sim.inhabit(played, cast.claimant);
  for (const st of [plain, played]) { Sim.movingRound(st); Sim.advance(st, Sim.DAY); }
  dropKind(played, 'player');
  played.player = null; for (const p of played.pawns) delete p.control; delete played.controlled; delete played.queued; // and its controller (VB-1745)
  for (const st of [plain, played]) delete st.pawns[cast.claimant].wish; // the player's mark: its pawn chose no wish of its own
  assert.strictEqual(hash(played), hash(plain), 'a played pawn with no wishes changes nothing at the round');
}

// 3. A landless adult whose player wishes it to stay is left out of st.demand, and so neither claims nor leaves.
{
  const { st, empty } = scene(), id = cast.single, home = st.pawns[id].household;
  assert.ok(st.demand.includes(id), 'the scene: an unmarried adult who wants out, and would be given a plot at the round');
  Sim.inhabit(st, id); Sim.wish(st, st.player.pawn, 'out', false);
  assert.strictEqual(H.staysWhy(st, st.pawns[id]), 'it wishes to stay');
  H.countDemand(st);
  assert.ok(!st.demand.includes(id), 'wished to stay, it is left out of st.demand');
  // the wish for a match is another wish (VB-274): one old enough to marry is offered it whatever it wishes about moving out
  assert.ok(ask(st, id).every((o) => o.verb === 'match' || /wishes to stay/.test(o.why)), 'and every act of the round about moving says so');
  assert.deepStrictEqual([...new Set(ask(st, id).map((o) => o.verb))].filter((v) => v !== 'match').sort(), ['claim', 'leave', 'serve']);
  assert.strictEqual(ask(st, id).find((o) => o.verb === 'leave').own, null, 'though the pawn itself would move out');
  // staying ranks Stay above every rung that leaves home (VB-680), so it is no claimant even when asked alone; the rules would let it
  assert.ok(!FC.claimants(st, empty).includes(id) && FC.claimants(st, empty, [id]).length === 0, 'no claimant');
  Sim.wish(st, st.player.pawn, 'out', null); assert.strictEqual(FC.claimants(st, empty, [id]).length, 1, 'though the rules would let it claim');
  Sim.wish(st, st.player.pawn, 'out', false);
  Sim.movingRound(st);
  assert.ok(!st.demand.includes(id) && st.pawns[id].household === home && !st.pawns[id].servant, 'after the round it is at home still');
  assert.ok(!VB['sim/allotment'].hasPlot(st, id), 'no plot is cleared for it');
  assert.ok(!st.farmsteads.some((f) => VB['sim/farmclaims'].claimOn(st, f)?.by === id) && !R.isHolder(st, id), 'it claimed nothing and holds nothing');
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
  Sim.wish(st, st.player.pawn, 'out', true); H.countDemand(st);
  assert.ok(st.demand.includes(id), 'wished to move out, the heir is counted among those who want out');
  assert.ok(leave().why === null && /heir to the farm at home/.test(leave().own), 'the round would let it; the pawn itself would have waited');
  Sim.wish(st, st.player.pawn, 'out', null); H.countDemand(st);
  assert.ok(!st.demand.includes(id), 'and waits again when the wish is taken back');
}

// 5. A wish never lets a pawn past a rule: a holder, a holder's spouse and a child never enter st.demand.
{
  const { st } = scene(), spouse = R.spouseOf(st, cast.holder);
  for (const id of [cast.holder, spouse, cast.child]) {
    if (id === null) continue;
    Sim.inhabit(st, id); Sim.wish(st, st.player.pawn, 'out', true); H.countDemand(st);
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
  Sim.wish(st, st.player.pawn, 'claim', false);
  assert.ok(!FC.claimants(st, empty).includes(id) && FC.claimableFarm(st, id) === null, 'wishing for no farm, it is no claimant');
  assert.ok(/claim no farm/.test(claim().why), claim().why);
  Sim.wish(st, st.player.pawn, 'claim', other);
  assert.ok(!FC.claimants(st, empty).includes(id) && /another farm/.test(claim().why), 'nor when it wishes for another farm');
  assert.ok(st.demand.includes(id), 'it wants out all the same');
  Sim.wish(st, st.player.pawn, 'claim', empty.id);
  assert.ok(first() === id && claim().why === null, 'wishing for this farm, it stands where the rule puts it');
  FC.claimFarms(st);
  assert.strictEqual(VB['sim/farmclaims'].claimOn(st, empty).by, id, 'and takes it at the round');
  // a wish for a farm does not pass the rule that the claimant wants out: an heir stays an heir
  const again = scene();
  Sim.inhabit(again.st, cast.heir); Sim.wish(again.st, again.st.player.pawn, 'claim', again.empty.id); H.countDemand(again.st);
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
  Sim.wish(st, st.player.pawn, 'serve', true); assert.strictEqual(serve().why, null, 'wishing to serve is as the pawn would');
  Sim.wish(st, st.player.pawn, 'serve', false);
  assert.ok(/no service/.test(serve().why), serve().why);
  const home = st.pawns[id].household;
  S.takeServants(st);
  assert.ok(st.pawns[id].household === home && !st.pawns[id].servant && st.demand.includes(id), 'declining, it stays at home and still wants land');
  assert.ok(lone.members.every((m) => m !== id), 'the holder takes another, or none');
  sound(st, 'service declined');
}

// 8. The wishes are saved with the run.
{
  const { st, empty } = scene();
  Sim.inhabit(st, cast.claimant); Sim.wish(st, st.player.pawn, 'out', true); Sim.wish(st, st.player.pawn, 'claim', empty.id); Sim.wish(st, st.player.pawn, 'serve', false);
  const world = () => tinyWorld(rows), data = JSON.parse(JSON.stringify(Sim.save(st))), back = Sim.load(world(), data);
  assert.deepStrictEqual(W(back), { out: true, claim: empty.id, serve: false, match: null }, 'the wishes come back as saved');
  for (const s of [st, back]) { Sim.movingRound(s); Sim.advance(s, Sim.DAY); }
  assert.strictEqual(hash(back), hash(st), 'the loaded run and the saved one agree after a round and a day');
  sound(back, 'loaded');
}
// 9. The wish for a match (VB-274): false keeps the played pawn out of the round's matching; a partner who passes the round's rules is
// offered at its start and married at its close; a sister, a partner with no home and one 30 years older are no offer, and the round
// matches the played pawn as usual; the wish is kept until the pawn or its partner marries or dies.
{
  const YEAR = VB['sim/rules'].YEAR;
  const world = (seed) => {
    const st = tinyState(tinyWorld(rows), [{ at: [8, 6], farms: 4, sizes: [9, 9, 9, 9] }], { seed });
    for (const h of st.households) h.grain.barley += 5e4; // the homes afford a marriage
    return st;
  };
  const adults = (st) => st.living.map((i) => st.pawns[i]).filter((p) => R.spouseOf(st, p.id) === null && p.age >= 20);
  const pairs = (st) => {
    const rules = MT.matchRules(st), out = [];
    for (const m of adults(st)) for (const f of adults(st)) if (m.sex === 'm' && f.sex === 'f' && !MT.matchBar(st, m.id, f.id, rules).why) out.push([m.id, f.id]);
    return out;
  };
  const married = (st, id) => R.spouseOf(st, id);
  const after = (seed, wish, who) => {
    const st = world(seed);
    if (who !== undefined) { Sim.inhabit(st, who); if (wish !== undefined) assert.strictEqual(Sim.wish(st, st.player.pawn, 'match', wish), true); }
    Sim.movingRound(st); return st;
  };
  const matchItem = (st, who, partner) => O.forPawn(st, O.actorView(st, who), who).find((o) => o.verb === 'match' && o.target === partner);
  // a pair that passes the rules and that the round would not marry by itself
  let found = null;
  for (let seed = 1; seed < 60 && !found; seed++) {
    const plain = after(seed);
    for (const [m, f] of pairs(world(seed))) if (married(plain, m) !== f) { found = { seed, m, f }; break; }
  }
  assert.ok(found, 'the scene: a pair the askings would not marry to each other, that passes the rules');
  const { seed, m, f } = found;
  {
    const st = world(seed); Sim.inhabit(st, m);
    assert.ok(typeof Sim.wish(st, st.player.pawn, 'match', m) === 'string', 'one cannot wish for oneself');
    assert.ok(typeof Sim.wish(st, st.player.pawn, 'match', true) === 'string' && typeof Sim.wish(st, st.player.pawn, 'match', 99999) === 'string', 'a wish for a match is false, null or a pawn');
    assert.strictEqual(Sim.wish(st, st.player.pawn, 'match', f), true); assert.strictEqual(W(st).match, f);
    assert.strictEqual(matchItem(st, m, f).why, null, 'nothing bars the wished match');
    sound(st, 'a wish for a match');
    Sim.movingRound(st);
    assert.strictEqual(married(st, m), f, 'the wished partner is offered at the round and married at its close');
    assert.strictEqual(W(st).match, null, 'and the wish is cleared by the marriage');
    // the other side answered at once: no match is left waiting; the handover the marriage brings asks the played heir (VB-692)
    assert.ok(st.offers.every((o) => o.basis === 'handover' && o.to === m), 'the other side answered at once: no match is left waiting');
    sound(st, 'the wished match made');
    // wished by the woman: her side asks him, and only him, at her asking (VB-693); his side answers the best offer it holds at the
    // round, which may be another's: the player's wish is its pawn's offer, no more
    const w = world(seed); Sim.inhabit(w, f); Sim.wish(w, w.player.pawn, 'match', m);
    assert.strictEqual(VB['sim/asking'].askFor(w, f, Math.floor(w.t / Sim.DAY) * Sim.DAY + 12), 'match', 'her asking offers the one she wishes');
    const hers = w.offers.find((o) => o.id === w.pawns[f].ask);
    assert.ok(hers && hers.asker === 'woman' && hers.gives.man === m && hers.wants.woman === f, 'her side asks him');
    Sim.movingRound(w);
    assert.ok(married(w, m) !== null && !w.offers.some((o) => o.basis === 'match'), 'his side took the best offer it held, and the rest lapsed');
    sound(w, 'wished by the woman');
  }
  // not this year: the played pawn is left out of the round's matching, and of kinPressure
  {
    let hit = null;
    for (let sd = 1; sd < 60 && !hit; sd++) {
      const plain = after(sd), id = plain.living.find((i) => plain.unions.some((u) => u.start === plain.t && (u.a === i || u.b === i)));
      if (id !== undefined) hit = { sd, id };
    }
    assert.ok(hit, 'the scene: a round that marries someone');
    const st = after(hit.sd, false, hit.id);
    assert.strictEqual(married(st, hit.id), null, 'not this year: the pawn is unmarried after a round that would have married it');
    assert.strictEqual(W(st).match, false, 'and the wish stays until changed');
    assert.strictEqual(st.pawns[hit.id].kinPush, null, 'and is not counted by kinPressure');
    sound(st, 'not this year');
  }
  // a wish that fails a rule makes no offer, and the played pawn enters the matcher as usual
  const asUsual = (sd, who, partner, why) => {
    const wished = world(sd); Sim.inhabit(wished, who); Sim.wish(wished, wished.player.pawn, 'match', partner);
    assert.ok(why.test(matchItem(wished, who, partner).why), `bar ${why}: ${matchItem(wished, who, partner).why}`);
    Sim.movingRound(wished);
    const plain = after(sd, undefined, who);
    assert.notStrictEqual(married(wished, who), partner, 'the barred wish makes no match');
    assert.strictEqual(married(wished, who), married(plain, who), 'and the played pawn is matched as usual');
    sound(wished, 'a wish barred');
  };
  const bar = (re) => {
    for (let sd = 1; sd < 60; sd++) {
      const st = world(sd), rules = MT.matchRules(st), ids = adults(st);
      for (const a of ids) for (const b of ids) if (a.sex === 'm' && b.sex === 'f' && re.test(MT.matchBar(st, a.id, b.id, rules).why || '')) return { sd, a: a.id, b: b.id };
    }
    return null;
  };
  for (const re of [/too close kin/, /no home/]) {
    const x = bar(re); assert.ok(x, `the scene: a pair barred by ${re}`);
    asUsual(x.sd, x.a, x.b, re);
  }
  {
    const st = world(seed); st.pawns[f].born -= 30 * YEAR;
    Sim.inhabit(st, m); Sim.wish(st, st.player.pawn, 'match', f);
    assert.ok(/ill matched/.test(matchItem(st, m, f).why), matchItem(st, m, f).why);
    Sim.movingRound(st);
    assert.notStrictEqual(married(st, m), f, 'the partner 30 years older is no offer');
  }
  // the panel's partners: the other sex, unmarried, of age, at most 8; and the wish is cleared by the death of the partner
  {
    const st = world(seed); Sim.inhabit(st, m);
    const list = O.forPawn(st, O.actorView(st, m), m).filter((o) => o.verb === 'match');
    assert.strictEqual(list[0].target, null, 'the first item says the pawn may wish');
    assert.ok(list.length - 1 <= 8 && list.slice(1).every((o) => st.pawns[o.target].sex === 'f' && R.spouseOf(st, o.target) === null), 'at most 8 unmarried women');
    Sim.wish(st, st.player.pawn, 'match', f); Sim.killPawn(st, f, 'illness');
    assert.strictEqual(W(st).match, null, 'the wish is cleared when the wished partner dies');
    sound(st, 'wished partner died');
  }
  // the wish is saved
  {
    const st = world(seed); Sim.inhabit(st, m); Sim.wish(st, st.player.pawn, 'match', f);
    const data = JSON.parse(JSON.stringify(Sim.save(st)));
    assert.strictEqual(W(Sim.load(tinyWorld(rows), data)).match, f, 'the wish is saved');
  }
}
// 10. Every pawn has wishes (VB-680): its own choosing before the round ranks the rungs by its ambition and its hunger, leaves a pawn
// with the default holding none (the save stays small), passes over the played pawn and children; the round reads an unplayed pawn's
// wish as the played pawn's; a whole ranking is a wish too.
{
  const Wi = VB['sim/wishes'], T = VB['sim/traits'], { HUNGER } = VB['sim/rules'], { WISH } = VB['sim/wishes'];
  const { st } = scene(), amb = T.IDX.ambition;
  const adults = st.living.filter((id) => st.pawns[id].age >= 18), [a, b, c] = adults;
  st.pawns[a].traits[amb] = 0.9; st.pawns[b].traits[amb] = 0.5; st.pawns[b].hunger = HUNGER.marryBelow; st.pawns[c].traits[amb] = 0.5;
  st.pawns[c].hunger = 0;
  Sim.inhabit(st, cast.child); Wi.chooseWishes(st);
  assert.deepStrictEqual(st.pawns[a].wish.rank, ['heir', 'match', 'farm', 'party', 'plot', 'service', 'stay'], 'the ambitious rank new land above a plot');
  assert.deepStrictEqual(W(st, a), NONE, 'which bars nothing the round reads today');
  assert.strictEqual(Wi.wishOf(st, b, 'match'), false, 'the hungry rank Stay above Marry: not this year');
  assert.ok(!st.pawns[c].wish, 'a pawn with the default wish holds none');
  assert.ok(!st.pawns[cast.child].wish && W(st, cast.child).out === null, 'the played pawn is the player\'s to choose for');
  st.pawns[b].hunger = 0; Wi.chooseWishes(st);
  assert.strictEqual(st.pawns[b].wish, null, 'fed again, it wishes as by default');
  sound(st, 'the pawns\' own wishes');
  // the round reads an unplayed pawn's wish as it reads the played pawn's
  const plain = scene(), other = scene(), id = cast.servant;
  Wi.setWish(other.st, id, 'serve', false);
  S.takeServants(plain.st); S.takeServants(other.st);
  assert.ok(plain.st.pawns[id].servant && !other.st.pawns[id].servant, 'an unplayed pawn who declines service is passed by');
  assert.ok(/no service/.test(ask(other.st, id).find((o) => o.verb === 'serve').why), 'and what it may do at the round says so');
  // a whole ranking
  Sim.inhabit(st, a);
  assert.ok(typeof Sim.wish(st, st.player.pawn, 'rank', ['heir', 'stay']) === 'string', 'a ranking holds every rung once');
  assert.strictEqual(Sim.wish(st, st.player.pawn, 'rank', ['service', 'heir', 'stay', 'match', 'farm', 'plot', 'party']), true);
  assert.deepStrictEqual(Sim.wishesOf(st, a), { out: null, claim: false, serve: null, match: false, settle: false,
    rank: ['service', 'heir', 'stay', 'match', 'farm', 'plot', 'party'] }, 'the rungs after Stay are declined');
  Sim.wish(st, st.player.pawn, 'rank', [...WISH.rungs]);
  assert.deepStrictEqual(st.pawns[a].wish, { rank: [...WISH.rungs], farm: null, partner: null, by: 'pawn' },
    'and the default ranking, authored, is kept as its controller\'s (VB-1776)');
}
const { twins } = require('./lib/twins.js');
// VB-1776: on automatic, the played pawn's wish is its own choosing as the unplayed one's (hungry, it puts off a match) until its
// controller authors one; the authored wish is not rewritten
{
  const id = castOf().heir;
  const [a] = twins(() => scene().st, id, (st) => {
    st.pawns[id].hunger = VB['sim/rules'].HUNGER.marryBelow;
    VB['sim/wishes'].chooseWishes(st);
  }, 'its own choosing at the round');
  assert.strictEqual(Sim.wishesOf(a, id).match, false, 'hungry, the played pawn on automatic puts off a match');
  assert.strictEqual(Sim.wish(a, id, 'match', null), true);
  VB['sim/wishes'].chooseWishes(a);
  assert.strictEqual(Sim.wishesOf(a, id).match, null, 'the wish its controller authored stands');
}
console.log('wishes ok: every pawn\'s own wish (ambition, hunger), read alike for the unplayed; a wish to stay keeps a landless adult out of st.demand, and it neither claims nor leaves; an heir wished out enters it; '
  + 'no wish passes a rule; a farm wished for, none, and service declined; no wishes change nothing; saved and loaded; a wish for a match: not this year, a partner offered at the round, and the rules it never passes');
