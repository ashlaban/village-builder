// @sys sim/eventline: an event of the record as every view reads it (VB-1946): whether it is told, whom of a household or line it
// concerns, the grain a gift event received, and the event in one sentence; read by the chronicle (sim/notable) and the skip (sim/skip)
VB['sim/eventline'] = (() => {
  const { ancestorsOf, fullName, age } = VB['sim/records'];
  const { CAUSES, COLD } = VB['sim/deaths'];
  // An event of the record in full that every view reads: not a folded slot (a number, sim/records), nor a pawn's own telling of an event
  // recorded beside it (`self`), which only its life reads.
  const told = (e) => typeof e === 'object' && !e.self;
  // A pawn's line: itself, its forebears and its descendants, this many generations up and down.
  const GENERATIONS = 4;
  const inLine = (st, a, b) =>
    a === b || ancestorsOf(st, [a], GENERATIONS).has(b) || ancestorsOf(st, [b], GENERATIONS).has(a);
  // Does a birth, marriage or death concern pawn `about`: it happened in its household, or to someone of its line.
  function concerns(st, ev, about) {
    if (about === null || about === undefined || about < 0) return false;
    if (ev.household !== undefined && ev.household === st.pawns[about].household) return true;
    return (
      (ev.pawn !== undefined && inLine(st, about, ev.pawn)) || (ev.other !== undefined && inLine(st, about, ev.other))
    );
  }
  // An event in one sentence. Most kinds carry their sentence; a death carries its cause and is told as the village log told it, and the
  // births, marriages and deaths from before the start, seeded as history, carry none.
  function eventLine(st, ev) {
    if (ev.kind !== 'died') {
      // a cause taken up is told with its pawn's name, as the notice tells it (VB-082): "Took up the cause: ..." in its own history
      if (ev.kind === 'cause' && ev.reason === 'natural' && /^Took up/.test(ev.text))
        return `${fullName(st.pawns[ev.pawn])} took up${ev.text.slice(7)}.`;
      if (ev.text) return ev.text;
      if (ev.kind === 'born') return `${fullName(st.pawns[ev.pawn])} was born.`;
      if (ev.kind === 'holds') return `${fullName(st.pawns[ev.pawn])} holds ${st.farmsteads[ev.farm].name}.`;
      return ev.kind === 'married' ? `${fullName(st.pawns[ev.pawn])} and ${fullName(st.pawns[ev.other])} married.` : '';
    }
    const p = st.pawns[ev.pawn],
      cause = CAUSES[ev.text];
    if (!cause) return `${fullName(p)} died ${ev.text || ''}`.trim() + '.';
    const where = ev.farm !== undefined ? st.farmsteads[ev.farm].name : 'the island';
    return `${fullName(p)} of ${where} ${cause.log}${ev.cold ? COLD : ''}, aged ${age(st, p, ev.t)}.`;
  }
  // Grain received as a gift (sim/exchange's booked): {n, from (the giver's name)}, else null. The record tells it as text.
  const GIFT_IN = /^Received (\d+) grain from (.+)$/;
  function helpIn(ev) {
    const m = ev.kind === 'gift' && typeof ev.text === 'string' ? GIFT_IN.exec(ev.text) : null;
    return m ? { n: +m[1], from: m[2] } : null;
  }
  return {
    // what it gives the page through the Sim facade (src/sim.js joins the lists, VB-1944)
    PAGE: ['eventLine'],
    told,
    inLine,
    concerns,
    eventLine,
    helpIn,
  };
})();
