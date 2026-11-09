// @sys sim/notable: which events of the record are notable and why, and an event told in one sentence; a read-only view, no state (VB-098)
VB['sim/notable'] = (() => {
  const { index, ancestorsOf, fullName, age } = VB['sim/records'];
  const { CAUSES } = VB['sim/deaths'];
  // Why an event is notable (Kim, 9 Nov: QUESTION_ARCHIVE.md, "VB-098"), in the order the page lists them; the page turns each on or off.
  const NOTABLE = {
    family: 'Births, marriages and deaths in the household or line of the person you follow',
    holder: 'Deaths of landholders',
    hunger: 'Deaths from hunger',
    farm: 'Farms left empty, claimed or newly built',
    custom: 'Changes of custom',
  };
  // A pawn's line: itself, its forebears and its descendants, this many generations up and down.
  const GENERATIONS = 4;
  const HUNGER = new Set(['hunger', 'starvation']);
  const FARM = new Set(['empty', 'claim', 'cottage', 'left']);
  const CUSTOM = new Set(['custom', 'split']);
  const inLine = (st, a, b) => a === b || ancestorsOf(st, [a], GENERATIONS).has(b) || ancestorsOf(st, [b], GENERATIONS).has(a);
  // Does a birth, marriage or death concern pawn `about`: it happened in its household, or to someone of its line.
  function concerns(st, ev, about) {
    if (about === null || about === undefined || about < 0) return false;
    if (ev.household !== undefined && ev.household === st.pawns[about].household) return true;
    return (ev.pawn !== undefined && inLine(st, about, ev.pawn)) || (ev.other !== undefined && inLine(st, about, ev.other));
  }
  // Did the dead pawn of a `died` event hold the household it died in. Read from the kin index, which keeps a household under every holder
  // it has had since the run was seeded or loaded: right for a death of this session, false for one a loaded save had already passed on.
  function heldAtDeath(st, ev) {
    if (ev.household === undefined || st.pawns[ev.pawn].retired) return false;
    return (index(st).holds.get(ev.pawn) || []).includes(ev.household);
  }
  // The reasons a record event is notable, as keys of NOTABLE, or null when it is routine. `about` is the pawn the player follows (the
  // selected pawn; the played one once the player plays a pawn, VB-210), or null. Most events are routine: they cost one switch.
  function notable(st, ev, about = null) {
    const k = ev.kind;
    if (FARM.has(k)) return ['farm'];
    if (CUSTOM.has(k)) return ['custom'];
    if (k !== 'died' && k !== 'born' && k !== 'married') return null;
    const why = [];
    if (concerns(st, ev, about)) why.push('family');
    if (k === 'died') {
      if (heldAtDeath(st, ev)) why.push('holder');
      if (HUNGER.has(ev.text)) why.push('hunger');
    }
    return why.length ? why : null;
  }
  // An event in one sentence. Most kinds carry their sentence; a death carries its cause and is told as the village log told it, and the
  // births, marriages and deaths from before the start, seeded as history, carry none.
  function eventLine(st, ev) {
    if (ev.kind !== 'died') {
      if (ev.text) return ev.text;
      if (ev.kind === 'born') return `${fullName(st.pawns[ev.pawn])} was born.`;
      return ev.kind === 'married' ? `${fullName(st.pawns[ev.pawn])} and ${fullName(st.pawns[ev.other])} married.` : '';
    }
    const p = st.pawns[ev.pawn], cause = CAUSES[ev.text];
    if (!cause) return `${fullName(p)} died ${ev.text || ''}`.trim() + '.';
    return `${fullName(p)} of ${ev.farm !== undefined ? st.farmsteads[ev.farm].name : 'the island'} ${cause.log}, aged ${age(st, p, ev.t)}.`;
  }
  return { NOTABLE, notable, eventLine };
})();
