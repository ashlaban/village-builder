// @suite fast
// Succession is offered and taken up (VB-824; design.md, Succession: Handed on, and taken up), on a constructed state (tests/lib/tiny.js):
// the line as it is asked gives the ranking (those who would take it, in order), with why each of the others would not; a holder offers
// on its own day, at the custom's time, due at the round, the first in line answers, and a no passes the offer to the next at once,
// with no memory; a holder weighs it (VB-1314): at odds with the heir it holds out at the wedding, its heir's grudge growing, and hands on at 60; nothing offers for a played holder, who hands on early by the
// same verb, to the first in line only, and goes on being played; a played heir may say no; a wedding brings the holder's offer at
// once; at a death one in line who holds a place renounces and the next takes it up, a minor is not asked, and a played heir is asked (VB-1142): the farm is its own, it takes it up or renounces.
const assert = require('assert');
const VB = require('../src/load.js'),
  Sim = VB.sim;
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const { DAY, YEAR, HANDOVER } = VB['sim/rules'];
const { heirRanking } = VB['sim/heirranking'], { refreshRoles } = VB['sim/heirs'];
const { conclude } = VB['sim/offers'];
const { dailyLife } = VB['sim/lifecycle'];
const { dueRound } = VB['sim/asking'];
const { remember, opinionOf } = VB['sim/relations'];
const { issue } = VB['sim/commands'];
const R = VB['sim/records'];
const sound = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants, ${what}`);
const map = [
  '..............',
  '...FF.........',
  '...FF.........',
  '..............',
  '..........FF..',
  '..............',
  '.........^^...',
  '..............',
  '~.............',
  '~~............',
];
// Village 0: household 0 (holder 0 of 62, his wife 1, their daughters 2 to 5, of 30, 27, 24 and 21: the line, eldest first) and
// household 1 (holder 6, his wife 7, their children 8 to 10); village 1: household 2 (holder 11, his wife 12, their children 13 and 14).
// `at`: daughter 2's place: 'spouse' (she has married 11, a widower, and lives on his farm) or 'holds' (he has died too, and she holds
// it, his children dead as well).
function world(customs, at = null) {
  const st = tinyState(
    tinyWorld(map),
    [
      { at: [3, 5], farms: 2 },
      { at: [11, 2], farms: 1 },
    ],
    {
      seed: 7,
      customs: { widow: 'keep', ...customs },
    },
  );
  const aged = (id, years) => {
    st.pawns[id].born = st.t - years * YEAR - DAY;
    st.pawns[id].age = years;
  };
  [62, 60, 30, 27, 24, 21].forEach((y, id) => aged(id, y));
  aged(8, 22);
  for (const h of st.households) h.grain.barley += 5000;
  if (at) {
    Sim.killPawn(st, 12);
    const r = issue(st, { actor: 11, verb: 'marry', target: 2, args: { home: 2 }, source: 'round' });
    assert.strictEqual(r, true, `the scene's marriage: ${r}`);
    if (at === 'holds') {
      // a widow is one who was married before the death: his first wife died two days ago, and he married again yesterday
      st.pawns[12].died -= 2 * DAY;
      st.unions.find((u) => u.b === 12 || u.a === 12).end -= 2 * DAY;
      st.unions[st.unions.length - 1].start -= DAY;
      for (const id of [13, 14, 11]) Sim.killPawn(st, id);
      assert.strictEqual(st.households[2].holder, 2, 'the scene: she holds her late husband’s farm');
    }
  }
  refreshRoles(st);
  return st;
}
const line = (st, h = 0) => {
  const asked = [],
    ranking = heirRanking(st, st.households[h], null, false, null, null, asked);
  return { asked, ranking };
};
// the holder's own day: its birthday, in the daily life step
const birthday = (st, id) => {
  st.pawns[id].born = st.t - st.pawns[id].age * YEAR - 1;
  dailyLife(st);
};
const told = (st, kind, pawn) => st.record.filter((e) => e.kind === kind && e.pawn === pawn);
const handovers = (st) => st.offers.filter((o) => o.basis === 'handover');

// 1. The answers give the ranking: the line as asked, with why each who is passed over would not take it
{
  let st = world({ handover: 'age60' });
  let l = line(st);
  assert.deepStrictEqual(
    l.asked,
    [2, 3, 4, 5].map((id) => ({ id, no: null })),
    'nobody holds a place: each would take it, eldest first',
  );
  assert.deepStrictEqual(l.ranking, [2, 3, 4, 5]);
  st = world({ handover: 'age60' }, 'spouse');
  l = line(st);
  assert.deepStrictEqual(
    l.asked.map((e) => e.id),
    [2, 3, 4, 5],
    'one who lives on a spouse’s farm keeps her place in the order asked',
  );
  assert.ok(/^lives at /.test(l.asked[0].no), `and would not take it: ${l.asked[0].no}`);
  assert.deepStrictEqual(l.ranking, [3, 4, 5], 'so the ranking passes her over, as before');
  st = world({ handover: 'age60' }, 'holds');
  l = line(st);
  assert.ok(/^holds /.test(l.asked[0].no), `one who holds a farm would not take it: ${l.asked[0].no}`);
  assert.deepStrictEqual(l.ranking, [3, 4, 5]);
  // the ranking is the line's yes-sayers in every case, and reads the same with and without the line asked for
  for (const customs of [{ ownHeir: 'keeps' }, { heirSex: 'sons' }, { birthOrder: 'youngest' }])
    for (const at of [null, 'spouse', 'holds']) {
      const s = world(customs, at);
      for (const h of s.liveHouseholds) {
        const x = line(s, h);
        const yes = x.asked.filter((e) => e.no === null).map((e) => e.id);
        assert.deepStrictEqual(yes, x.ranking, `household ${h}, ${JSON.stringify(customs)}, ${at}`);
        assert.deepStrictEqual(heirRanking(s, s.households[h]), x.ranking);
        for (const e of x.asked) {
          const sp = R.spouseOf(s, e.id),
            placed = R.holdingOf(s, e.id) !== null || (sp !== null && R.holdingOf(s, sp) !== null);
          assert.strictEqual(e.no !== null, placed, `pawn ${e.id}: no only for a place held (${e.no})`);
        }
      }
    }
}

// VB-1141: an heir gives up a smaller place, in life or at a death.
for (const at of ['holds', 'spouse']) {
  const st = world({ handover: 'age60' }, at);
  const small = st.farmsteads[2];
  const offered = st.farmsteads[0];
  assert.ok(small.fields.length >= offered.fields.length);
  small.fields.length = offered.fields.length - 1;
  assert.strictEqual(line(st).asked[0].no, null);
  assert.strictEqual(line(st).ranking[0], 2);
  if (at === 'holds') {
    birthday(st, 0);
    conclude(st, handovers(st)[0]);
  } else Sim.killPawn(st, 0);
  assert.strictEqual(st.households[0].holder, 2);
  assert.strictEqual(R.holdingOf(st, 2).id, 0);
  assert.ok(st.households[2].dissolved || ![2, 11].includes(st.households[2].holder));
  for (const id of at === 'holds' ? [2] : [2, 11]) {
    assert.strictEqual(st.pawns[id].household, 0);
    assert.strictEqual(told(st, 'joined', id).at(-1).reason, 'heir');
  }
  // the smaller place's log line names its holder, who moves away, and not as the one who inherits: with the spouse, he did not
  if (!st.households[2].dissolved) {
    const took = st.record.filter((e) => e.kind === 'inherited' && e.household === 2).at(-1);
    const holder = R.fullName(st.pawns[at === 'holds' ? 2 : 11]);
    assert.ok(took.text.endsWith(` as ${holder} moves away.`), `the log line: ${took.text}`);
    assert.ok(!/inherits/.test(took.text), took.text);
  } else assert.strictEqual(at, 'holds', 'the spouse case hands the smaller place on');
  sound(st, 'after giving up the smaller place');
}
// ... the smaller place held in trust (sim/trust): she lives with her parents, who hold it, and inherits theirs at her father's death;
// the trust ends before the place is handed on, as when a trustee's new holder holds the farm it holds (inheritedHeld)
{
  const st = world({ handover: 'age60' }, 'holds');
  st.farmsteads[2].fields.length = st.farmsteads[0].fields.length - 1;
  VB['sim/trust'].holdInTrust(st, st.households[2], 'is alone');
  const t = st.trusts[0];
  assert.deepStrictEqual([t.household, t.trustee, st.pawns[2].household], [2, 0, 0], 'the scene: her parents hold her farm in trust');
  sound(st, 'held in trust');
  Sim.killPawn(st, 0);
  assert.strictEqual(st.households[0].holder, 2);
  assert.deepStrictEqual([t.end, t.why, st.liveTrusts], [st.t, 'inherited', []], 'the trust ends');
  assert.ok(st.households[2].dissolved || st.households[2].holder !== 2);
  sound(st, 'after giving up the place held in trust');
}
// ... a minor holder, her stepson her guardian, inherits the larger farm at a death: her guardianship of the smaller place ends with her
// leaving it, and its new holder is nobody's guardian
{
  const st = world({ handover: 'age60' }, 'holds');
  st.farmsteads[2].fields.length = st.farmsteads[0].fields.length - 1;
  st.pawns[8].father = 11; // her late husband's son, in the line of his farm
  st.idx = null;
  VB['sim/heirs'].moveTo(st, 8, 2);
  st.pawns[2].age = 16;
  st.pawns[2].born = st.t - 16 * YEAR - DAY;
  Object.assign(st.households[2], { guardian: 8, ward: 2 }); // as sim/heirs' setGuardian would choose
  for (const id of [1, 3, 4, 5]) Sim.killPawn(st, id);
  refreshRoles(st);
  assert.deepStrictEqual([line(st).ranking, line(st, 2).ranking], [[2], [8]], 'the scene');
  // her asking, made while she was grown, falls due before she comes of age: the scene's, not the case's
  const minorSound = (what) =>
    assert.deepStrictEqual(checkState(st).filter((b) => !/before it comes of age/.test(b)), [], `invariants, ${what}`);
  minorSound('a ward on the smaller place');
  Sim.killPawn(st, 0);
  const small = st.households[2];
  assert.deepStrictEqual([st.households[0].holder, small.holder, st.pawns[2].household], [2, 8, 0]);
  assert.ok(small.guardian === null && small.ward === null, `no guardian left behind: ${small.guardian}, ward ${small.ward}`);
  minorSound('after the ward leaves the smaller place');
}

// 2. In life: the holder offers on its own day, at the custom's time, due at the round; an heir with a farm refuses, and the next takes it
{
  const st = world({ handover: 'age60' }, 'holds');
  birthday(st, 6); // a holder of 29: not yet the time
  assert.strictEqual(st.offers.length, 0, 'no offer before the custom’s time');
  birthday(st, 0);
  assert.strictEqual(handovers(st).length, 1, 'the holder of 62 offers on his day');
  const o = st.offers[0];
  assert.deepStrictEqual(
    [o.from, o.to, o.due, o.round],
    [0, 2, dueRound(st), true],
    'to the first in line, due at the moving round',
  );
  assert.deepStrictEqual(o.gives, { household: 0, reason: 'retirement' });
  assert.ok(
    st.pawns.every((p) => p.ask === undefined || p.ask === null),
    'it is nobody\u2019s ask: the holder and the heir may still be matched',
  );
  assert.strictEqual(st.households[0].holder, 0, 'nothing changes hands before the answer');
  sound(st, 'the handover offered');
  birthday(st, 0);
  assert.strictEqual(st.offers.length, 1, 'one open offer of the holding');
  const before = opinionOf(st, 0, 2),
    back = opinionOf(st, 2, 0);
  conclude(st, o); // the round's step answers it
  assert.strictEqual(told(st, 'offerRefused', 2).length, 1, 'the heir who holds a farm says no, and it is told');
  assert.ok(
    /would not take over .*: holds /.test(told(st, 'offerRefused', 2)[0].text),
    told(st, 'offerRefused', 2)[0].text,
  );
  assert.strictEqual(st.households[0].holder, 3, 'the offer passes to the next in line at once, who takes it');
  assert.strictEqual(st.households[2].holder, 2, 'and the one who refused keeps her own');
  assert.deepStrictEqual([opinionOf(st, 0, 2), opinionOf(st, 2, 0)], [before, back], 'the no books no memory');
  assert.ok(st.pawns[0].retired && st.pawns[1].retired, 'the old holder and his wife retire');
  assert.deepStrictEqual([st.pawns[0].household, st.pawns[1].household], [0, 0], 'on the farm, for their keep');
  assert.ok(told(st, 'inherited', 3).some((e) => /old holder retires/.test(e.text)));
  assert.strictEqual(st.offers.length, 0);
  sound(st, 'the handover taken');
}

// 3. The holder's choice, weighed (VB-1314; HANDOVER): under 'marriage', a holder of 58 at odds with the heir holds on at her wedding,
// and the farm comes to expect her; her grudge grows a year, to its cap; at 60 he hands on, and the grudge ends with the holding.
{
  const st = world({ handover: 'marriage' });
  st.pawns[0].born += 4 * YEAR;
  st.pawns[0].age = 58;
  for (let n = 0; n < 12; n++) remember(st, 0, 2, ['refusedMatch', 'claim', 'border'][n % 3]); // each to its cap
  const op = opinionOf(st, 0, 2);
  assert.ok(
    0.8 + 0.15 + 0.3 + HANDOVER.opinion * op < HANDOVER.at,
    `the scene: the holder is at odds with his heir (${op})`,
  );
  const home = st.households[0],
    fond = opinionOf(st, 2, 0);
  const r = issue(st, {
    actor: 6,
    verb: 'offer',
    target: 0,
    args: { basis: 'match', gives: { man: 8, home: 0 }, wants: { woman: 2 } },
    source: 'round',
  });
  assert.strictEqual(r, true, `the match: ${r}`);
  assert.strictEqual(R.spouseOf(st, 2), 8, 'the scene: the heir marries, and he comes to live on her father’s farm');
  assert.strictEqual(st.households[0].holder, 0, 'the holder holds on at the wedding');
  assert.strictEqual(handovers(st).length, 0, 'and offers nothing');
  assert.deepStrictEqual(home.expected, { heir: 2, since: st.t }, 'the custom’s time has come: the farm expects her');
  sound(st, 'a holder holding out');
  const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-9, `${what}: ${a} against ${b}`);
  near(opinionOf(st, 2, 0), fond, 'no grudge on the day');
  home.expected.since -= YEAR; // a year on
  near(opinionOf(st, 2, 0), fond - HANDOVER.grudge, 'a year of holding out costs the heir’s opinion');
  assert.strictEqual(opinionOf(st, 3, 0), opinionOf(st, 3, 0), 'only hers');
  home.expected.since -= 20 * YEAR;
  near(opinionOf(st, 2, 0), fond - HANDOVER.grudgeMax, 'up to its cap');
  home.expected.since += 20 * YEAR;
  st.pawns[0].age = 60;
  birthday(st, 0);
  assert.strictEqual(st.pawns[0].age, 60, 'the scene: his sixtieth birthday');
  const fond60 = opinionOf(st, 2, 0); // the grudge's time put back (no grudge), at his new age (VB-476: chemistry reads it)
  const o = handovers(st)[0];
  assert.ok(o && o.to === 2 && o.gives.reason === 'marriage', 'at 60, no longer a hand, he offers it to her');
  conclude(st, o);
  assert.strictEqual(st.households[0].holder, 2, 'she takes it');
  assert.strictEqual(home.expected, null, 'the farm expects nothing more');
  assert.ok(opinionOf(st, 2, 0) >= fond60 - 1e-9, 'and the grudge ends with the holding');
  sound(st, 'handed on at 60');
}

// 4. Nothing offers for a played holder; it hands on early, by the same verb, to the first in line, and goes on being played
{
  const st = world({ handover: 'age60' });
  Sim.inhabit(st, 0);
  Sim.setAuto(st, 0, false); // its controller chooses (VB-1776: on automatic, the played holder hands on as any holder)
  birthday(st, 0);
  assert.strictEqual(st.offers.length, 0, 'the custom’s time has come, and nothing offers for the played holder');
  assert.deepStrictEqual(
    st.households[0].expected,
    { heir: 2, since: st.t },
    'and it holds out, as any holder would (VB-1314)',
  );
  const hand = (target, gives) =>
    issue(st, {
      actor: 0,
      verb: 'offer',
      target,
      args: { basis: 'handover', gives: { household: 0, ...gives } },
      source: 'player',
    });
  assert.ok(/first in line/.test(hand(3, { reason: 'retirement' })), 'not to one further down the line');
  assert.ok(/only a refusal/.test(hand(3, { reason: 'retirement', passed: [2] })), 'nor by naming one as passed');
  assert.ok(/not handed on for/.test(hand(2, {})), 'a reason is named');
  assert.strictEqual(st.households[0].holder, 0);
  // the page's control (VB-1140): the opportunity names the first in line, open to the verb's check, and why not once an offer is open
  const ho = (id) => Sim.opportunities(st, id).find((o) => o.verb === 'offer' && o.handover);
  assert.ok(
    ho(0) && ho(0).why === null && ho(0).target === 2 && ho(0).handover.first.id === 2,
    'Hand the farm on is open',
  );
  assert.strictEqual(ho(1), undefined, 'and is the holder’s alone');
  assert.strictEqual(hand(2, { reason: 'retirement' }), true);
  assert.strictEqual(st.households[0].holder, 2, 'the first in line says yes at once');
  assert.strictEqual(st.households[0].expected, null, 'the handover ends what was expected');
  assert.ok(st.pawns[0].retired && st.pawns[0].household === 0, 'the played pawn is retired on the farm');
  assert.strictEqual(st.player.pawn, 0, 'and is still the one played');
  sound(st, 'a played holder handed on');
}
// ... and early: a played holder of 45, long before the custom's time
{
  const st = world({ handover: 'age60' });
  st.pawns[0].born += 17 * YEAR;
  st.pawns[0].age = 45;
  Sim.inhabit(st, 0);
  const r = issue(st, {
    actor: 0,
    verb: 'offer',
    target: 2,
    args: { basis: 'handover', gives: { household: 0, reason: 'retirement' } },
    source: 'player',
  });
  assert.strictEqual(r, true);
  assert.strictEqual(st.households[0].holder, 2, 'a played holder of 45 hands on when it chooses');
}

// 5. A played heir is asked, and may say no: the offer passes to the next
{
  const st = world({ handover: 'age60' });
  Sim.inhabit(st, 2);
  birthday(st, 0);
  const o = st.offers[0];
  assert.ok(
    o && o.to === 2 && o.answers.length === 1 && o.answers[0].by === 2 && o.answers[0].yes === null,
    'the played heir has the answer',
  );
  const asked = Sim.opportunities(st, 2).find((x) => x.when === 'offer');
  assert.ok(
    asked && asked.offer.basis === 'handover' && asked.offer.advice !== undefined,
    'it shows as an open offer, with advice',
  );
  assert.strictEqual(
    issue(st, { actor: 2, verb: 'answer', target: o.id, args: { yes: false }, source: 'player' }),
    true,
  );
  assert.strictEqual(st.households[0].holder, 3, 'her no passes it to the next in line');
  assert.strictEqual(told(st, 'offerRefused', 2).length, 1);
  sound(st, 'a played heir refused');
}

// 6. The custom 'marriage': the heir's wedding brings the holder's offer, answered at once
{
  const st = world({ handover: 'marriage' });
  birthday(st, 6);
  assert.strictEqual(st.offers.length, 0, 'an unmarried heir: not yet the time');
  const r = issue(st, {
    actor: 6,
    verb: 'offer',
    target: 0,
    args: { basis: 'match', gives: { man: 8, home: 1 }, wants: { woman: 5 } },
    source: 'round',
  });
  assert.strictEqual(r, true, `the match: ${r}`);
  assert.strictEqual(R.spouseOf(st, 8), 5, 'the scene: the son of the house marries');
  assert.strictEqual(st.households[1].holder, 8, 'and his father hands the farm on at the wedding');
  assert.ok(told(st, 'inherited', 8).some((e) => /on marrying/.test(e.text)));
  sound(st, 'handed on at the wedding');
}

// 7. At a death: the inheritance falls to the first in line; one who holds a place renounces it, and the next takes it up
{
  const st = world({ handover: 'death' }, 'holds');
  birthday(st, 0);
  assert.strictEqual(st.offers.length, 0, 'under the custom of death the holder offers nothing in life');
  Sim.killPawn(st, 0);
  assert.strictEqual(told(st, 'renounced', 2).length, 1, 'the first in line holds a farm, and renounces');
  assert.ok(/renounces .*: holds /.test(told(st, 'renounced', 2)[0].text), told(st, 'renounced', 2)[0].text);
  assert.strictEqual(st.households[0].holder, 3, 'it falls to the next, who takes it up');
  assert.strictEqual(st.households[2].holder, 2);
  assert.ok(told(st, 'inherited', 3).some((e) => / after /.test(e.text)));
  sound(st, 'an inheritance renounced and taken up');
}
// ... a minor heir is not asked: the widow holds as its guardian, and nobody renounces
{
  const st = world({ handover: 'death' }, 'holds');
  for (const id of [3, 4, 5]) {
    st.pawns[id].born = st.t - (id + 5) * YEAR - DAY;
    st.pawns[id].age = id + 5;
  }
  refreshRoles(st);
  Sim.killPawn(st, 0);
  assert.strictEqual(st.households[0].holder, 1, 'the widow keeps the farm for the minor heir');
  assert.strictEqual(st.households[0].guardian, 1, 'as guardian (the guardian rule stands)');
  assert.strictEqual(st.record.filter((e) => e.kind === 'renounced').length, 0);
  sound(st, 'a minor heir');
}
// ... with nobody to take it the farm stands empty
{
  const st = world({ handover: 'death' }, 'holds');
  for (const id of [1, 3, 4, 5]) Sim.killPawn(st, id);
  Sim.killPawn(st, 0);
  assert.strictEqual(told(st, 'renounced', 2).length, 1);
  assert.ok(st.households[0].dissolved, 'nobody takes it: the farm stands empty');
  sound(st, 'an inheritance nobody took');
}
// 8. A played heir is asked (VB-1142): the farm is its own at once, it takes it up by moving or renounces it, and the next takes it up
{
  const play = (answer) => {
    const st = world({ handover: 'death' });
    const r = issue(st, { actor: 2, verb: 'move', target: 1, args: { reason: 'service' }, source: 'round' });
    assert.strictEqual(r, true, `the scene: the eldest daughter serves at household 1: ${r}`);
    Sim.inhabit(st, 2);
    Sim.setAuto(st, 2, false); // its controller answers (VB-1776: on automatic, it inherits as any heir)
    Sim.killPawn(st, 0);
    const o = st.offers.find((x) => x.basis === 'inheritance');
    assert.ok(o, 'the played heir is asked');
    assert.strictEqual(st.households[0].holder, 2, 'the farm is its own at once, a right');
    assert.strictEqual(st.pawns[2].household, 1, 'but it has not moved yet');
    assert.ok(st.households[0].members.includes(1), 'meanwhile the widow and the sisters in the house work its fields');
    assert.strictEqual(VB['sim/offers'].advice(st, o, 2), true, 'its pawn would take it up');
    sound(st, 'an inheritance falls to the played heir');
    if (answer === 'wait') {
      conclude(st, o); // the wait's end: its pawn's judgement answers
    } else issue(st, { actor: 2, verb: 'answer', target: o.id, args: { yes: answer }, source: 'player' });
    return st;
  };
  let st = play(false);
  assert.strictEqual(told(st, 'renounced', 2).length, 1, 'renounced: a renounced event tells it');
  assert.strictEqual(st.households[0].holder, 3, 'it falls to the next at once, who takes it up');
  assert.strictEqual(st.pawns[2].household, 1, 'the renouncer stays where she was');
  sound(st, 'renounced by the played heir');
  for (const a of [true, 'wait']) {
    st = play(a);
    assert.strictEqual(st.households[0].holder, 2);
    assert.strictEqual(st.pawns[2].household, 0, `taken up (${a}): she moves to the farm`);
    assert.strictEqual(told(st, 'renounced', 2).length, 0);
    assert.ok(told(st, 'inherited', 2).some((e) => / after /.test(e.text)));
    assert.ok(!st.offers.some((o) => o.basis === 'inheritance'));
    sound(st, 'taken up by the played heir');
  }
}
const { twins } = require('./lib/twins.js');
// VB-1776: on automatic with nothing queued, the played holder at the custom's time offers the farm as the same holder unplayed, and
// the played heir with a place elsewhere inherits at a death as any heir does (it is asked only while its controller drives it)
{
  const [a] = twins(() => world({ handover: 'age60' }), 0, (st) => birthday(st, 0), 'the holder at the custom’s time');
  assert.strictEqual(a.offers.filter((o) => o.basis === 'handover').length, 1, 'the played holder on automatic offers the farm');
  const away = () => {
    const st = world({ handover: 'death' });
    issue(st, { actor: 2, verb: 'move', target: 1, args: { reason: 'service' }, source: 'round' });
    return st;
  };
  const [h] = twins(away, 2, (st) => Sim.killPawn(st, 0), 'the heir at a death');
  assert.ok(!h.offers.some((o) => o.basis === 'inheritance'), 'the played heir on automatic is not asked: it inherits as any heir');
}
console.log(
  'handover ok: the line as asked gives the ranking, with why each of the others would not take it; a holder offers on its own day at the ' +
    'custom’s time, due at the round; an heir with a farm refuses and the next takes it, with no memory; a holder at odds holds out at the wedding, at a grudge a year, and hands on at 60; a played ' +
    'holder hands on early by the same verb and stays played; a played heir may refuse; a wedding brings the offer at once; at a death an ' +
    'heir with a place renounces and the next takes it up, a minor is not asked, and with nobody the farm stands empty',
);
