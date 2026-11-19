// Succession is offered and taken up (VB-824; design.md, Succession: Handed on, and taken up), on a constructed state (tests/lib/tiny.js):
// the line as it is asked gives the ranking (those who would take it, in order), with why each of the others would not; a holder offers
// on its own day, at the custom's time, due at the round, the first in line answers, and a no passes the offer to the next at once,
// with no memory; a holder holds out against an heir it thinks ill of; nothing offers for a played holder, who hands on early by the
// same verb, to the first in line only, and goes on being played; a played heir may say no; a wedding brings the holder's offer at
// once; at a death one in line who holds a place renounces and the next takes it up, and a minor is not asked.
const assert = require('assert');
const VB = require('../src/load.js'),
  Sim = VB.sim;
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const { DAY, YEAR, SOCIAL } = VB['sim/rules'];
const { heirRanking, refreshRoles } = VB['sim/heirs'];
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

// 3. A holder who thinks ill of the heir holds out
{
  const st = world({ handover: 'age60' });
  for (let n = 0; n < 12; n++) remember(st, 0, 2, ['refusedMatch', 'claim', 'border'][n % 3]); // each to its cap
  assert.ok(opinionOf(st, 0, 2) <= SOCIAL.enemy, 'the scene: the holder is at enmity with the first in line');
  birthday(st, 0);
  assert.strictEqual(st.offers.length, 0, 'he offers nothing');
  assert.strictEqual(st.households[0].holder, 0);
}

// 4. Nothing offers for a played holder; it hands on early, by the same verb, to the first in line, and goes on being played
{
  const st = world({ handover: 'age60' });
  Sim.inhabit(st, 0);
  birthday(st, 0);
  assert.strictEqual(st.offers.length, 0, 'the custom’s time has come, and nothing offers for the played holder');
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
  const ho = (id) => Sim.opportunities(st, id).find((o) => o.verb === 'offer');
  assert.ok(
    ho(0) && ho(0).why === null && ho(0).target === 2 && ho(0).handover.first.id === 2,
    'Hand the farm on is open',
  );
  assert.strictEqual(ho(1), undefined, 'and is the holder’s alone');
  assert.strictEqual(hand(2, { reason: 'retirement' }), true);
  assert.strictEqual(st.households[0].holder, 2, 'the first in line says yes at once');
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
console.log(
  'handover ok: the line as asked gives the ranking, with why each of the others would not take it; a holder offers on its own day at the ' +
    'custom’s time, due at the round; an heir with a farm refuses and the next takes it, with no memory; ill opinion holds out; a played ' +
    'holder hands on early by the same verb and stays played; a played heir may refuse; a wedding brings the offer at once; at a death an ' +
    'heir with a place renounces and the next takes it up, a minor is not asked, and with nobody the farm stands empty',
);
