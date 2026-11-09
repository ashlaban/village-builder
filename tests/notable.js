// Notable events (VB-098): `Sim.notable(st, ev, about)` gives the reasons a record event is notable (keys of `Sim.NOTABLE`) or null, and
// `Sim.eventLine` tells an event in one sentence, a death as the village log told it. The heirs scenario at seed 7.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
const it = G.generate(7); let r; while (!(r = it.next()).done);
const st = Sim.seed(r.value, 7, 'heirs'); st.naturalDeaths = false;
const died = (id) => st.record.filter((e) => e.kind === 'died' && e.pawn === id).pop();
const living = (hh) => hh.members.map((id) => st.pawns[id]).filter((p) => p.alive);
const stranger = (hh) => st.pawns.find((p) => p.alive && p.household !== null && p.household !== hh.id
  && Sim.kinDegree(st, p.id, hh.holder) === Infinity && !hh.members.some((m) => Number.isFinite(Sim.kinDegree(st, p.id, m))));

// the death of a landholder: notable to all, and a family event to his household and to his line elsewhere
const hh = st.households[2], holder = hh.holder, child = Sim.childrenOf(st, holder).find((c) => st.pawns[c].alive);
const mate = living(hh).find((p) => p.id !== holder), far = stranger(hh);
assert.ok(child !== undefined && mate && far, 'the heirs scenario has a holder with a child, a housemate and a stranger');
Sim.killPawn(st, holder, 'illness');
const ev = died(holder);
assert.deepStrictEqual(Sim.notable(st, ev), ['holder']);
assert.deepStrictEqual(Sim.notable(st, ev, far.id), ['holder'], 'a stranger is told of a landholder, not of family');
assert.deepStrictEqual(Sim.notable(st, ev, mate.id), ['family', 'holder'], 'a housemate');
assert.deepStrictEqual(Sim.notable(st, ev, child), ['family', 'holder'], 'a child');
assert.deepStrictEqual(Sim.notable(st, ev, holder), ['family', 'holder'], 'the followed pawn itself');
const line = Sim.villageLog(st, Infinity).find((e) => e.text.startsWith(Sim.fullName(st.pawns[holder])) && / died of illness, aged \d+\.$/.test(e.text));
assert.ok(line, 'the village log told the death');
assert.strictEqual(Sim.eventLine(st, ev), line.text, 'a death is told as the village log told it');

// a death that is nobody's concern, one from hunger, and one from hunger in the family
const hh2 = st.households.find((h) => !h.dissolved && h.id !== hh.id && living(h).filter((p) => p.id !== h.holder && Sim.spouseOf(st, p.id) === null).length >= 2);
const [one, two] = living(hh2).filter((p) => p.id !== hh2.holder && Sim.spouseOf(st, p.id) === null);
Sim.killPawn(st, one.id, 'killed');
assert.strictEqual(Sim.notable(st, died(one.id)), null, 'a landless death unfollowed is routine');
assert.strictEqual(Sim.notable(st, died(one.id), child), null, 'and so it is to a stranger');
assert.deepStrictEqual(Sim.notable(st, died(one.id), hh2.holder), ['family']);
Sim.killPawn(st, two.id, 'hunger');
assert.deepStrictEqual(Sim.notable(st, died(two.id)), ['hunger']);
assert.deepStrictEqual(Sim.notable(st, died(two.id), hh2.holder), ['family', 'hunger']);
assert.ok(/ died of hunger, aged \d+\.$/.test(Sim.eventLine(st, died(two.id))));

// births and marriages: to the household and the line (a grandparent living elsewhere), not to others
const born = st.record.filter((e) => e.kind === 'born' && e.other !== undefined && st.pawns[e.other].father !== null).pop();
const mother = st.pawns[born.other];
assert.deepStrictEqual(Sim.notable(st, born, mother.id), ['family'], 'a mother');
assert.deepStrictEqual(Sim.notable(st, born, mother.father), ['family'], "the mother's father: his line");
assert.strictEqual(Sim.notable(st, born), null, 'a birth nobody follows');
const wed = st.record.find((e) => e.kind === 'married');
assert.deepStrictEqual(Sim.notable(st, wed, wed.other), ['family']);
assert.strictEqual(Sim.notable(st, wed), null);

// farms and customs are notable to all; the routine kinds to none
for (const kind of ['empty', 'claim', 'cottage', 'left']) assert.deepStrictEqual(Sim.notable(st, { t: st.t, kind, farm: 0, village: 0 }, child), ['farm'], kind);
for (const kind of ['custom', 'split']) assert.deepStrictEqual(Sim.notable(st, { t: st.t, kind, village: 0 }), ['custom'], kind);
for (const kind of ['friend', 'fellOut', 'gift', 'harvest', 'moved', 'inherited', 'year', 'plot', 'service']) {
  assert.strictEqual(Sim.notable(st, { t: st.t, kind, pawn: child, household: st.pawns[child].household }, child), null, kind);
}
for (const why of [['family', 'holder'], ['hunger'], ['farm'], ['custom']].flat()) assert.ok(typeof Sim.NOTABLE[why] === 'string', `NOTABLE lacks ${why}`);

// every other kind carries its sentence; a death before the record has no cause to tell
assert.strictEqual(Sim.eventLine(st, { t: 0, kind: 'empty', text: 'Nygård stands empty: no heir would take it.' }), 'Nygård stands empty: no heir would take it.');
const old = st.record.find((e) => e.kind === 'died' && e.text === 'before the record');
assert.strictEqual(Sim.eventLine(st, old), `${Sim.fullName(st.pawns[old.pawn])} died before the record.`);

// a cottage built on a cleared plot is told as a cottage, once, and its holder's move as a move, once (an untouched year of heirs 7)
{
  const it2 = G.generate(7); let r2; while (!(r2 = it2.next()).done);
  const s2 = Sim.seed(r2.value, 7, 'heirs'); Sim.advance(s2, Sim.YEAR);
  const built = s2.record.filter((e) => e.kind === 'cottage' && / moves into the new farmstead /.test(e.text));
  assert.ok(built.length, 'no cottage was built on a cleared plot in a year of heirs 7');
  for (const e of built) {
    assert.deepStrictEqual(Sim.notable(s2, e), ['farm']);
    assert.strictEqual(s2.record.filter((x) => x.kind === 'joined' && x.farm === e.farm && x.pawn === e.pawn).length, 1, 'its holder joined it once');
    const told = Sim.chronicle(s2, { pawn: e.pawn }).filter((x) => x.ev.t === e.t).map((x) => x.ev.kind);
    assert.deepStrictEqual(told, ['cottage'], 'and its history tells the move once (VB-099)');
  }
}

// a year of play: every event answers, with reasons that NOTABLE knows
st.naturalDeaths = true; Sim.advance(st, Sim.YEAR);
const counts = {}; let n = 0;
for (const e of st.record) {
  const why = Sim.notable(st, e, child);
  if (!why) continue;
  n++; for (const k of why) { assert.ok(Sim.NOTABLE[k], `unknown reason ${k}`); counts[k] = (counts[k] || 0) + 1; }
  assert.ok(Sim.eventLine(st, e).length > 5, `no sentence for ${JSON.stringify(e)}`);
}
console.log(`notable ok: heirs 7 after a year: ${n} of ${st.record.length} events notable to one pawn `
  + `(${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')})`);
