// @sys sim/mood: a pawn's mood (VB-062), 50 plus its modifiers, computed when asked and stored nowhere; the event modifiers (pawn.mods),
//   written at a wedding, a birth and a death. Read by the pawn's card only: no rule of the simulation reads it (tests/mood.js holds that)
VB['sim/mood'] = (() => {
  const { DAY, MOOD } = VB['sim/rules'];
  const { on } = VB['sim/events'];
  const { spouseOf, childrenOf } = VB['sim/records'];
  // The modifiers for an event (pawn.mods), each one kept MOOD[key].days from it.
  const EVENT = ['married', 'child', 'grieving'];
  const LABEL = {
    hungry: 'Hungry',
    cold: 'Cold: no firewood',
    dry: 'Without water',
    weak: 'Weak',
    married: 'Newly married',
    child: 'A child born',
    grieving: 'Grieving',
    friend: 'Talked with a friend',
  };
  // @state pawn.mods: list of {key (a key of MOOD for an event: married, child, grieving), until (game hour)}, at most one entry a key,
  //   or absent until its first; written by sim/mood at the event, an entry past its until ignored where it is read and dropped when the
  //   list is next written (no daily pass: Rules for cost, 3 and 4).
  function feel(st, id, key) {
    const p = st.pawns[id];
    if (!p || !p.alive) return;
    const list = p.mods ? p.mods.filter((m) => m.key !== key && m.until > st.t) : [];
    list.push({ key, until: st.t + MOOD[key].days * DAY });
    p.mods = list;
  }
  on('wed', (st, e) => {
    feel(st, e.a, 'married');
    feel(st, e.b, 'married');
  });
  on('born', (st, e) => {
    feel(st, e.mother, 'child');
    if (e.father !== null) feel(st, e.father, 'child');
  });
  // the dead's spouse, children and parents grieve (read before the death ends the union)
  on('died', (st, e) => {
    const p = st.pawns[e.pawn],
      sp = spouseOf(st, e.pawn);
    if (sp !== null) feel(st, sp, 'grieving');
    for (const c of childrenOf(st, e.pawn)) feel(st, c, 'grieving');
    if (p.mother !== null) feel(st, p.mother, 'grieving');
    if (p.father !== null) feel(st, p.father, 'grieving');
  });
  const mod = (key, value) => ({ key, label: LABEL[key], value: Math.round(value) });
  // A pawn's mood now: {mood, mods: [{key, label, value}]}, the modifiers in force, those of a state read from it; null for the dead.
  function of(st, id) {
    const p = st.pawns[id];
    if (!p || !p.alive) return null;
    const hh = p.household !== null ? st.households[p.household] : null,
      mods = [];
    if (p.hunger > MOOD.hungry.over) mods.push(mod('hungry', MOOD.hungry.value * p.hunger));
    if (hh && hh.cold > 0) mods.push(mod('cold', MOOD.cold.value * hh.cold));
    if (hh && hh.dry > 0) mods.push(mod('dry', MOOD.dry.value));
    if (p.health < MOOD.weak.under) mods.push(mod('weak', MOOD.weak.value));
    if (p.mods) for (const m of p.mods) if (m.until > st.t) mods.push(mod(m.key, MOOD[m.key].value));
    if (friendTalk(st, id)) mods.push(mod('friend', MOOD.friend.value));
    const sum = mods.reduce((s, m) => s + m.value, 0);
    return { mood: Math.max(0, Math.min(100, MOOD.base + sum)), mods: mods.filter((m) => m.value !== 0) };
  }
  // Talked with a friend: its last talk with one it held at SOCIAL.friend or above (agent.talk.friendAt, kept by talk where it checks the
  // pair's band), MOOD.friend.days ago at most. The latest talk alone hid two in three of these (populous small, seed 7, a year).
  function friendTalk(st, id) {
    const t = st.agents[id] && st.agents[id].talk;
    return !!t && t.friendAt !== undefined && st.t < t.friendAt + MOOD.friend.days * DAY;
  }
  // A word for a mood: miserable under 25, low under 45, content under 65, happy.
  const word = (m) => (m < 25 ? 'miserable' : m < 45 ? 'low' : m < 65 ? 'content' : 'happy');
  return { of, word, feel, EVENT };
})();
