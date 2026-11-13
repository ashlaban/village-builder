// @sys page/positions: the position each person holds, read from the game (holder, spouse, heir, servant...), its words and chips from the
// customs in force, and the story archetype cards built from them (VB-339; the start screen, VB-340, reuses storyCards unchanged)
// ======== positions and story archetypes ========
// A position is read from the run: the household's holder (hh.holder), the holder's spouse (Sim.spouseOf), a retired holder (p.retired),
// a servant (p.servant), the heir the game's succession names (the first of Sim.heirRanking), or another grown member. Nothing here
// ranks lives: the words are the mock's (docs/mocks/setup.html), Proposed (design.md, Starting a game), and the chips that depend on a
// custom read the custom in force in the person's village (Sim.practice) and who speaks at its meeting (Sim.voiceOf).
const SIGN_PATHS = {
  house: 'M3 11 12 4l9 7M5.5 9.5V20h13V9.5M10 20v-5h4v5',
  field: 'M12 21V4M12 9 8.5 5.5M12 9l3.5-3.5M12 13.5 8.5 10M12 13.5l3.5-3.5M12 18l-3.5-3.5M12 18l3.5-3.5',
  rings: 'M4 14a5 5 0 1 0 10 0 5 5 0 1 0-10 0M10 14a5 5 0 1 0 10 0 5 5 0 1 0-10 0',
  key: 'M4 15a4 4 0 1 0 8 0 4 4 0 1 0-8 0M11 12l9-9M17 6l3 3M14.5 8.5l2 2',
  road: 'M12 21V4M12 6h7l2 2-2 2h-7M12 12H6l-2 2 2 2h6',
  sickle: 'M5 21l5-5M9 17C4 10 10 3 18 5 12 6 9 11 12 15',
  voice: 'M4 5h16v10H10l-4 4v-4H4z',
  sack: 'M9 4h6l-1.5 3c4 2 5.5 6 4.5 10-.5 2-2 3-4 3h-4c-2 0-3.5-1-4-3-1-4 .5-8 4.5-10z',
  flag: 'M6 21V4M6 5h11l-2 3.5 2 3.5H6',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 1 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2',
  scroll: 'M6 4h12v16H6zM9 8h6M9 12h6M9 16h3',
  next: 'M5 12h14M13 6l6 6-6 6',
  shield: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z',
  people: 'M6 8a3 3 0 1 0 6 0 3 3 0 1 0-6 0M3 20c0-5 3-7 6-7s6 2 6 7M15 5.5a2.5 2.5 0 1 1 0 5M17 13c2.5.5 4 2.5 4 6',
};
const sign = (k) => svgIcon(24, 24, `<path d="${SIGN_PATHS[k]}"/>`, ICON_STROKE);
// The scenario's suggestion (design.md, Which pawn), a filled star; what it means is written beside the cards, not only in a tooltip.
const SUGGESTED =
  '<svg class="ico sug" viewBox="0 0 24 24" width="24" height="24" role="img" aria-label="Suggested by the scenario" focusable="false">' +
  '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17l-5.4 2.8 1.1-6.1L3.2 9.4l6.1-.8z" fill="currentColor"/></svg>';
const POS_ICON = {
  holder: 'house',
  widow: 'house',
  bachelor: 'house',
  spouse: 'rings',
  heir: 'key',
  heiress: 'key',
  child: 'road',
  servant: 'sickle',
  retired: 'house',
  landless: 'road',
  minor: 'people',
};
// One line on the life (the mock's HARD; retired and landless are this task's, for positions the game has and the mock does not).
const LIFE_LINE = {
  holder: 'Secure. The most to decide from the first day.',
  widow: 'Secure while she lives.',
  bachelor: 'Secure, and a dead end unless he marries.',
  spouse: 'Secure, with little formal say. Influence runs through ties and prestige.',
  heir: 'A waiting game: nothing is his until the farm passes.',
  heiress: 'Sought after. The marriage decides everything.',
  child: 'Open and insecure: every road leads away from home.',
  servant: 'The hardest start. Nothing to lose.',
  retired: 'Settled: the farm has passed on.',
  landless: 'Nothing to lose, and no roof of its own.',
  minor: 'A child, not yet to be played.',
};
// The story archetypes a scenario names (design.md, Starting a game; the mock's lists, Proposed): [position, name, suggested].
const STORIES = {
  founders: [
    ['holder', 'A founding holder', true],
    ['spouse', 'A founder’s wife'],
    ['servant', 'The farmhand or the maid'],
  ],
  heirs: [
    ['holder', 'An ageing holder', true],
    ['heir', 'The heir who waits'],
    ['child', 'A younger child'],
    ['widow', 'The widow'],
    ['heiress', 'The heiress'],
  ],
  populous: [
    ['holder', 'A holder', true],
    ['heir', 'An heir'],
    ['child', 'A younger child'],
    ['servant', 'A servant'],
  ],
};
const wasWed = (id) => st.unions.some((u) => u.a === id || u.b === id);
const liveHousehold = (f) =>
  f.household !== null && f.household !== undefined && !st.households[f.household].dissolved
    ? st.households[f.household]
    : null;
// The positions of the living, read once for a state and a time (the choosing mode is paused, so once per game).
let posCache = { of: null, t: NaN, map: new Map() };
function positionOf(id) {
  if (posCache.of !== st || posCache.t !== st.t) posCache = { of: st, t: st.t, map: new Map(), first: new Map() };
  let k = posCache.map.get(id);
  if (k === undefined) {
    k = readPosition(id);
    posCache.map.set(id, k);
  }
  return k;
}
function firstHeir(hh) {
  if (!posCache.first.has(hh.id)) {
    const r = Sim.heirRanking(st, hh);
    posCache.first.set(hh.id, r.length ? r[0] : null);
  }
  return posCache.first.get(hh.id);
}
function readPosition(id) {
  const p = st.pawns[id];
  if (p.died !== null) return null;
  if (p.age < ADULT) return 'minor';
  const hh = p.household !== null ? st.households[p.household] : null;
  if (!hh || hh.dissolved) return 'landless';
  if (hh.holder === id)
    return Sim.spouseOf(st, id) !== null ? 'holder' : !wasWed(id) ? 'bachelor' : p.sex === 'f' ? 'widow' : 'holder';
  if (hh.holder !== null && Sim.spouseOf(st, id) === hh.holder) return 'spouse';
  if (p.retired) return 'retired';
  if (p.servant) return 'servant';
  if (firstHeir(hh) === id) return p.sex === 'f' ? 'heiress' : 'heir';
  return 'child';
}
const inStory = (key, id) => {
  const k = positionOf(id);
  return k === key || (key === 'holder' && k === 'bachelor');
};
// A position's name, read from the game where it has one (a servant is its role's title, Sim.ROLES).
function positionName(id) {
  const p = st.pawns[id],
    k = positionOf(id),
    he = p.sex === 'm';
  return (
    {
      holder: 'Holder',
      widow: 'Widow, holds the farm',
      bachelor: 'Holder, unmarried',
      spouse: he ? 'Holder’s husband' : 'Holder’s wife',
      heir: 'Heir',
      heiress: 'Heiress',
      child: 'Younger child',
      servant: (Sim.ROLES[p.role] || { title: 'Servant' }).title,
      retired: 'Retired',
      landless: 'Without a household',
      minor: 'Child',
    }[k] || ''
  );
}
// The household's living members as the panel lists them: the holder, the spouse, then the eldest first.
function householdPeople(hh) {
  const sp = hh.holder !== null ? Sim.spouseOf(st, hh.holder) : null,
    rank = (id) => (id === hh.holder ? 0 : id === sp ? 1 : 2);
  return hh.members
    .filter((id) => st.pawns[id].died === null)
    .sort((a, b) => rank(a) - rank(b) || st.pawns[a].born - st.pawns[b].born || a - b);
}
// What the position can do and what lies ahead, as [icon, words]: the mock's chips (CAN, NEXT), with those that depend on a custom read
// from the custom in force in the person's village, and "Speaks at the meeting" wherever its custom gives this person a voice.
function chipsOf(id) {
  const p = st.pawns[id],
    k = positionOf(id),
    hh = p.household !== null ? st.households[p.household] : null;
  if (k === 'minor' || !k) return { can: [], ahead: [] };
  const f = hh ? st.farmsteads[hh.farmstead] : null,
    cu = f ? Sim.practice(st, f.village) : null,
    she = p.sex === 'f';
  const heir = hh && !hh.dissolved ? firstHeir(hh) : null,
    heirName = heir !== null && heir !== id ? st.pawns[heir].given : null;
  const handover = {
    marriage: 'Hands over when the heir marries',
    death: 'Holds the farm until death',
    age60: 'Hands over at 60',
  };
  const takes = {
    marriage: 'The farm, on marriage',
    death: 'The farm, at the holder’s death',
    age60: 'The farm, when the holder is 60',
  };
  const widowed = { life: 'keeps the farm', keep: 'a right to her keep', outright: 'inherits outright' };
  const ownWork = ['sickle', 'Own work'],
    holderCan = [
      ['field', 'Places fields'],
      ['sun', 'Sets the work'],
      ['rings', 'Arranges marriages'],
    ];
  const can = {
    holder: holderCan,
    widow: holderCan,
    bachelor: holderCan.slice(0, 2),
    spouse: [ownWork, ['scroll', 'Argues a cause']],
    heir: [ownWork, ['rings', 'Own marriage']],
    heiress: [ownWork, ['rings', 'Own marriage']],
    child: [ownWork, ['road', 'May leave'], ['flag', 'May claim a farm']],
    servant: [
      ['sickle', 'Serves the farm'],
      ['road', 'May move'],
      ['flag', 'May claim a farm'],
    ],
    retired: [ownWork],
    landless: [
      ['road', 'May move'],
      ['flag', 'May claim a farm'],
    ],
  }[k].slice();
  const s = hh && !hh.dissolved ? st.cenv.settlements[Sim.settlementIdOf(st, p)] : null;
  if (s && Sim.voiceOf(st, p, s) > 0) can.push(['voice', 'Speaks at the meeting']);
  const line = heirName ? ['key', `Then ${heirName}`] : ['key', 'No heir in the line'];
  let ahead = [];
  if (!cu) ahead = [['house', 'Land: the long goal']];
  else if (k === 'holder') ahead = [heirName ? ['key', handover[cu.handover]] : line];
  else if (k === 'bachelor')
    ahead = [
      Sim.childrenOf(st, id).some((c) => st.pawns[c].died === null)
        ? ['key', handover[cu.handover]]
        : ['key', 'No child: kin inherit'],
    ];
  else if (k === 'widow')
    ahead = [
      [
        'shield',
        cu.widow === 'keep'
          ? 'Holds it for the heir'
          : cu.widow === 'outright'
            ? 'The farm as her own'
            : 'The farm for life',
      ],
      line,
    ];
  else if (k === 'spouse') ahead = [['shield', `As ${she ? 'widow' : 'widower'}, ${widowed[cu.widow]}`]];
  else if (k === 'heir')
    ahead = [
      ['house', takes[cu.handover]],
      ['sack', { one: 'Takes all', buyout: 'Buys out siblings', split: 'Shares the land' }[cu.heirCount]],
    ];
  else if (k === 'heiress') {
    ahead = [
      [
        'house',
        cu.heirSex === 'sonsFirst'
          ? 'Inherits: no son'
          : cu.heirSex === 'daughtersFirst'
            ? 'Inherits: daughters first'
            : 'Inherits: first in line',
      ],
      ['rings', cu.residence === 'husband' ? 'Moves to her husband’s' : 'Husband moves in'],
    ];
  } else if (k === 'child') {
    ahead = [['sack', cu.heirCount === 'split' ? 'A share of the land' : 'Bought out, no land']];
    if (she && cu.daughterShare === 'half') ahead.push(['sack', 'Half a son’s share']);
  } else if (k === 'servant')
    ahead = [
      ['sack', 'Keep only'],
      ['house', 'Land: the long goal'],
    ];
  else if (k === 'retired') ahead = [['house', 'A place on the farm for life']];
  return { can, ahead };
}
const chipList = (list) =>
  `<div class="pchips">${list.map(([ic, t]) => `<span class="pchip">${sign(ic)}${esc(t)}</span>`).join('')}</div>`;
// The archetypes the scenario names that someone living holds, each {key, label, sug, who (pawn ids, farm by farm)}.
function storyPeople(scenario) {
  const all = [];
  for (const hh of st.households) if (!hh.dissolved) all.push(...householdPeople(hh));
  return (STORIES[scenario] || [])
    .map(([key, label, sug]) => ({ key, label, sug: !!sug, who: all.filter((id) => inStory(key, id)) }))
    .filter((s) => s.who.length);
}
// The story archetype cards (design.md, Starting a game): the position's icon, its name, one line, and up to six portraits of those who
// hold it, with "and N more"; an archetype no one holds is left out; the suggested one is starred. `pressed` is the key of the one
// pressed, or null. The same cards on the start (a look) and in the choosing mode (a way to someone): each is a button with data-story.
function storyCards(scenario, pressed = null) {
  return `<div class="stories">${storyPeople(scenario)
    .map(
      (s) =>
        `<button type="button" class="story" data-story="${s.key}" aria-pressed="${
          pressed === s.key
        }">${sign(POS_ICON[s.key])}<b>${esc(s.label)}</b>${s.sug ? SUGGESTED : '<span></span>'}<small>${esc(LIFE_LINE[s.key])}</small>` +
        `<span class="few">${s.who
          .slice(0, 6)
          .map((id) => faceImg(id, 'pf'))
          .join('')}<span>${s.who.length > 6 ? `and ${s.who.length - 6} more` : ''}</span></span></button>`,
    )
    .join('')}</div>`;
}
