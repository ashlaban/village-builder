// @sys sim/mood: a pawn's mood (VB-062), 50 plus its modifiers, computed when asked and stored nowhere; the event modifiers (pawn.mods),
//   written at a wedding, a birth and a death. Read by the pawn's card, and by one rule: the giver's mood in the allowance of a gift
//   (sim/exchange, VB-875; tests/mood.js holds that no other module reads it)
VB['sim/mood'] = (() => {
  const { DAY } = VB['sim/rules'];
  const { on } = VB['sim/events'];
  const { spouseOf, childrenOf } = VB['sim/records'];
  const { owedBy, tiredMood } = VB['sim/sleep'];
  const { crowded } = VB['sim/house'];
  // @tunable MOOD: mood (VB-062; design.md, Traits, talk and stories: Mood): 50 plus its modifiers' values, within 0 to 100; shown, and read
  //   by one rule, the allowance of a gift (`gives`, VB-875)
  // Starting values, each a feeling's weight on that scale (Kim, 30 Oct: "talked with a friend +5"). For a state, read from it: hungry,
  // `value` × the pawn's hunger while over `over`; cold, `value` × its household's cold (VB-327, cold's weight as hunger's until Kim sets
  // one); without water, `value` while its household's hh.dry is above 0 (VB-331); weak, `value` while health is under `under`; tired,
  // by the played pawn's sleep owed (SLEEP.mood, sim/sleep; VB-1615); crowded, `value` for a tenant of a household crowded in its house
  // (sim/house crowded: more members than its rung's room, ROOM; VB-1636). For an
  // event, kept `days` from it (pawn.mods): married; a child born, both parents; grieving at the death of a spouse, child or parent;
  // talked with a friend, read from the pawn's latest talk (agent.talk) with one it holds at SOCIAL.friend or above.
  // gives (VB-875): what mood changes. A giver's allowance (what it would give up to another in one deal, sim/relations) gains
  // `days` of its household's need × (mood − base) / base: at 100 ten days more, at 0 ten days less, and at the content 55 of most
  // pawn-days one day more. A grieving holder (35) holds back three days' need; a newly married one gives two more. A starting value.
  const MOOD = {
    base: 50,
    hungry: { value: -20, over: 0.1 },
    cold: { value: -20 },
    dry: { value: -10 },
    weak: { value: -10, under: 50 },
    crowded: { value: -10 },
    married: { value: 10, days: 12 },
    child: { value: 5, days: 12 },
    grieving: { value: -15, days: 12 },
    friend: { value: 5, days: 2 },
    gives: { days: 10 },
  };

  // The modifiers for an event (pawn.mods), each one kept MOOD[key].days from it.
  const EVENT = ['married', 'child', 'grieving'];
  const LABEL = {
    hungry: 'Hungry',
    cold: 'Cold: no firewood',
    dry: 'Without water',
    weak: 'Weak',
    tired: 'Tired: sleep owed',
    crowded: 'Crowded: a tenant in a full house',
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
  // The modifiers in force for living pawn p, each value rounded: their sum, and each one not 0 pushed to `out` as {key, label, value}
  // when `out` is a list (the card's), nothing made when it is null (the rule's read: the registry's value allocates nothing)
  function put(out, key, value) {
    const v = Math.round(value);
    if (out && v !== 0) out.push({ key, label: LABEL[key], value: v });
    return v;
  }
  function terms(st, id, p, out) {
    const hh = p.household !== null ? st.households[p.household] : null;
    let sum = 0;
    if (p.hunger > MOOD.hungry.over) sum += put(out, 'hungry', MOOD.hungry.value * p.hunger);
    if (hh && hh.cold > 0) sum += put(out, 'cold', MOOD.cold.value * hh.cold);
    if (hh && hh.dry > 0) sum += put(out, 'dry', MOOD.dry.value);
    if (p.health < MOOD.weak.under) sum += put(out, 'weak', MOOD.weak.value);
    const tired = tiredMood(owedBy(st, id)); // the played pawn's sleep owed (sim/sleep, VB-1615)
    if (tired) sum += put(out, 'tired', tired);
    if (hh && crowded(st, hh) && tenant(st, hh, id)) sum += put(out, 'crowded', MOOD.crowded.value);
    if (p.mods) for (const m of p.mods) if (m.until > st.t) sum += put(out, m.key, MOOD[m.key].value);
    if (friendTalk(st, id)) sum += put(out, 'friend', MOOD.friend.value);
    return Math.max(0, Math.min(100, MOOD.base + sum));
  }
  // ---- the tenants of a household (VB-1636; Kim's word: those whom a crowded house weighs on) ----
  // The household's own records tell them: membership (hh.members), service (pawn.servant) and descent (pawn.mother, pawn.father, the
  // union). The head's own family is the head, its spouse, their parents, and their descendants with their spouses; every other member is a
  // tenant: a servant (always, kin or not), and kin outside that line, the head's brothers and sisters, nephews, cousins, in-laws. The sim
  // has no lodger as a member (a lodger, sim/away, is a guest away from home), so none is counted. Walks at most four generations up and
  // allocates nothing.
  function lineOf(st, x, h, sp, up = 4) {
    if (x === h || x === sp) return true;
    if (up === 0 || x === null || x === undefined) return false;
    const p = st.pawns[x];
    return (
      (p.mother != null && lineOf(st, p.mother, h, sp, up - 1)) ||
      (p.father != null && lineOf(st, p.father, h, sp, up - 1))
    );
  }
  function tenant(st, hh, id) {
    const h = hh.holder,
      p = st.pawns[id];
    if (p.servant) return true;
    if (h === null || id === h) return false;
    const sp = spouseOf(st, h);
    if (id === sp) return false;
    const hp = st.pawns[h];
    if (id === hp.mother || id === hp.father) return false;
    if (sp !== null && (id === st.pawns[sp].mother || id === st.pawns[sp].father)) return false;
    if (lineOf(st, id, h, sp)) return false;
    const mate = spouseOf(st, id); // a descendant's spouse
    return !(mate !== null && lineOf(st, mate, h, sp));
  }
  // A pawn's mood now: {mood, mods: [{key, label, value}]}, the modifiers in force, those of a state read from it; null for the dead.
  function of(st, id) {
    const p = st.pawns[id];
    if (!p || !p.alive) return null;
    const mods = [];
    return { mood: terms(st, id, p, mods), mods };
  }
  // A pawn's mood now as a number, 0 to 100, allocating nothing (the rule's read, VB-875); null for the dead.
  function level(st, id) {
    const p = st.pawns[id];
    return p && p.alive ? terms(st, id, p, null) : null;
  }
  // Talked with a friend: its last talk with one it held at SOCIAL.friend or above (agent.talk.friendAt, kept by talk where it checks the
  // pair's band), MOOD.friend.days ago at most. The latest talk alone hid two in three of these (populous small, seed 7, a year).
  function friendTalk(st, id) {
    const t = st.agents[id] && st.agents[id].talk;
    return !!t && t.friendAt !== undefined && st.t < t.friendAt + MOOD.friend.days * DAY;
  }
  // A word for a mood: miserable under 25, low under 45, content under 65, happy.
  const word = (m) => (m < 25 ? 'miserable' : m < 45 ? 'low' : m < 65 ? 'content' : 'happy');
  return { MOOD, of, level, word, feel, EVENT, tenant };
})();
