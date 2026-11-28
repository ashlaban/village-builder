// @sys page/cardicons: the icons the cards show of time and of people (VB-1589): the seasons, the traits, the bonds, the states and the occasions
// The four seasons (sim/weather SEASONS, spring first), one icon each, on a 14 box (VB-667: the supply component's header and its chips): a
// sprout, a sun, a leaf, a snowflake.
const SEASON_PATHS = [
  '<path d="M7 13V6M7 8C5 8 3.5 6.5 3.5 4.5 5.5 4.5 7 6 7 8zM7 6.5c0-2 1.5-3.5 3.5-3.5 0 2-1.5 3.5-3.5 3.5z"/>',
  '<circle cx="7" cy="7" r="2.6"/><path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.8 2.8l1 1M10.2 10.2l1 1M11.2 2.8l-1 1M3.8 10.2l-1 1"/>',
  '<path d="M3 11c0-5 3-8 8-8 0 5-3 8-8 8zM3 11l5-5M2 12l1-1"/>',
  '<path d="M7 1v12M1.8 4l10.4 6M12.2 4L1.8 10M5.5 2L7 3.5 8.5 2M5.5 12L7 10.5 8.5 12"/>',
];
// The seasons as stencils (VB-1163), drawn on the 24 box as the others are.
const SEASON_STEN = [
  ACT_STEN.sow,
  '<circle cx="12" cy="12" r="4.8"/>' +
    '<path class="l" d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M5 5l1.8 1.8M17.2 17.2L19 19M19 5l-1.8 1.8M6.8 17.2L5 19"/>',
  '<path class="l" d="M3.5 20.5L5 19"/><path d="M5 19C5 10.5 10 5.5 19 5.5 19 14 14 19 5 19z"/><path class="c" d="M5.5 18.5L14 10"/>',
  COLD_STEN,
];
const seasonIcon = (k) =>
  drawings(
    svgIcon(
      14,
      14,
      SEASON_PATHS[((k % 4) + 4) % 4],
      ' fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"',
    ),
    { stencil: SEASON_STEN[((k % 4) + 4) % 4] },
  );
// The twelve traits (sim/traits, TRAITS.names), one icon each: traits are not hidden (Kim, 16 Nov), and are shown as icons.
const TRAIT_PATHS = {
  generosity:
    '<path d="M3 15c3-2 5-2 7-1l4 1c1.5.5 1 2.5-.5 2.5H10M14.5 16l5-2.5c1.5-.5 2.5 1.5 1 2.5L14 20H8l-5-1M12 10' +
    'c-3-2-4.5-3.5-4.5-5.5a2.3 2.3 0 0 1 4.5-.8 2.3 2.3 0 0 1 4.5.8C16.5 6.5 15 8 12 10z"/>',
  piety: '<path d="M12 3v18M7 8h10"/>',
  ambition: '<path d="M5 21V4M5 5h13l-3 3.5 3 3.5H5"/>',
  honour: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6zM9 12l2 2 4-4"/>',
  sociability: '<path d="M3 5h11v7H8l-3 3v-3H3zM16 9h5v7h-2v3l-3-3h-4v-2"/>',
  temper:
    '<path d="M12 21c-4 0-6.5-2.5-6.5-6 0-3 2-4.5 3-7 1 1 1.5 2 1.5 3.5C11 9 12 6 11.5 3' +
    'c3.5 2 7 6 7 11.5 0 4-2.5 6.5-6.5 6.5zM12 21c-1.5 0-2.5-1-2.5-2.5S11 16 12 14.5' +
    'c1 1.5 2.5 2.5 2.5 4S13.5 21 12 21z"/>',
  diligence: '<circle cx="12" cy="13" r="7"/><path d="M12 9v4l3 2M9.5 3h5M12 3v3"/>',
  openness: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  body: '<path d="M2.5 9v6M5.5 6.5v11M18.5 6.5v11M21.5 9v6M5.5 12h13"/>',
  hands:
    '<path d="M7 13V6.5a1.5 1.5 0 0 1 3 0V11V4.5a1.5 1.5 0 0 1 3 0V11V5.5a1.5 1.5 0 0 1 3 0' +
    'V12v-3a1.5 1.5 0 0 1 3 0v6c0 4-2.5 6-6 6h-1c-2.5 0-4-1-5.5-3.5L4 14c-.8-1.5 1-2.8 2-1.5z"/>',
  husbandry: GOOD_PATHS.beast,
  wits: '<path d="M9 18h6M10 21h4M8.5 15C6.5 13.5 6 11.5 6 10a6 6 0 0 1 12 0c0 1.5-.5 3.5-2.5 5z"/>',
};
// The same traits as stencils (VB-1163).
const TRAIT_STEN = {
  generosity:
    '<path d="M12 10.5c-3.3-2.2-5-3.8-5-6a2.5 2.5 0 0 1 5-.9 2.5 2.5 0 0 1 5 .9c0 2.2-1.7 3.8-5 6z"/>' +
    '<path d="M2.5 14.5c3-1.8 5.5-1.8 7.5-.8l4 1c1.3.4 1.3 2.3 0 2.5l4.5-2.2c1.7-.6 2.8 1.5 1.2 2.7L14 21.5H8l-5.5-1.2z"/>',
  piety: '<path d="M10.3 3h3.4v5h5v3.4h-5V21h-3.4v-9.6h-5V8h5z"/>',
  ambition: ICON_STEN.land,
  honour:
    '<path d="M12 2.8l8 2.7v6c0 5-3.5 8.3-8 10-4.5-1.7-8-5-8-10v-6z"/><path class="c" d="M8.5 12l2.5 2.5 4.5-4.8"/>',
  sociability: '<path d="M2.5 4h12v8.5H8l-3 3v-3H2.5z"/><path d="M16 9h5.5v7.5h-2v3l-3-3h-5V14H16z"/>',
  temper:
    '<path d="M12 21.5c-4 0-6.5-2.7-6.5-6 0-3.5 3-5 3.5-9 .5 1.5 1.5 2.5 2 3.5.5-2.5 1.5-5 1-7.5 3.5 2.5 6.5 7 6.5 12.5 0 3.8-2.5 6.5-6.5 6.5z"/>',
  diligence:
    '<circle cx="12" cy="13.5" r="7.5"/><rect x="9.5" y="2.5" width="5" height="2.2"/><path class="c" d="M12 9.5v4l3 2"/>',
  openness: '<circle cx="12" cy="12" r="9"/><path class="c" d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  body:
    '<path class="l" d="M8.5 12h7"/><rect x="2" y="9" width="2.6" height="6"/><rect x="5.5" y="6.5" width="2.8" height="11"/>' +
    '<rect x="15.7" y="6.5" width="2.8" height="11"/><rect x="19.4" y="9" width="2.6" height="6"/>',
  hands: '<path d="M7 21c-2-2.5-3.5-5-3.5-8l2-1L7 14.5V5h2.5v6h1V3.5H13V11h1V5h2.5v6.5h1V8H20v6c0 3-1 5-2.5 7z"/>',
  husbandry: GOOD_STEN.beast,
  wits: '<path d="M8.5 15.5C6.5 14 5.5 12 5.5 9.8a6.5 6.5 0 0 1 13 0c0 2.2-1 4.2-3 5.7z"/><rect x="9" y="17" width="6" height="3.8" rx="1"/>',
};
const traitIcon = (k) => drawings(svgIcon(24, 24, TRAIT_PATHS[k], ICON_STROKE), { stencil: TRAIT_STEN[k] });
// The bonds (VB-1026): what one person is to another, one icon each. The five kin bonds the simulation names (sim/relations, bond):
// two rings; an elder with a staff; a swaddled child; two of one branch; two under one roof. The four opinion bands (opinionWord): a
// heart, filled for a close friend; a heart struck through; two crossed blades.
const HEART = 'M12 20c-5-3.5-8-6.5-8-10a4.2 4.2 0 0 1 8-1.8A4.2 4.2 0 0 1 20 10c0 3.5-3 6.5-8 10z';
const BOND_PATHS = {
  spouse: GOOD_PATHS.married,
  parent: '<circle cx="10" cy="6.5" r="3.2"/><path d="M4 21c0-5 2.5-9 6-9s6 4 6 9M19.5 9v12M17.5 9.5c0-2 4-2 4 0"/>',
  child: GOOD_PATHS.child,
  sibling:
    '<path d="M7 9V5h10v4M12 5V2.5"/><circle cx="7" cy="12" r="2.6"/><circle cx="17" cy="12" r="2.6"/>' +
    '<path d="M3 21c0-3 1.7-4.5 4-4.5s4 1.5 4 4.5M13 21c0-3 1.7-4.5 4-4.5s4 1.5 4 4.5"/>',
  housemate:
    '<path d="M3 11l9-7.5 9 7.5M5.5 9.5V20h13V9.5"/><circle cx="9.5" cy="15" r="1.6"/><circle cx="14.5" cy="15" r="1.6"/>',
  friend: `<path d="${HEART}"/>`,
  'close friend': `<path d="${HEART}" fill="currentColor"/>`,
  dislikes: `<path d="${HEART}M4 4l16 16"/>`,
  enemy: '<path d="M4 4l13 13M20 4L7 17M14.5 19.5l5-5M9.5 19.5l-5-5M17 17l3 3M7 17l-3 3"/>',
};
// The same bonds as stencils (VB-1163): a friend's heart is its outline, a close friend's is filled, a dislike's is broken.
const BOND_STEN = {
  spouse: RINGS_STEN,
  parent:
    '<path d="M3.5 21.5c0-5.5 2.7-9.5 6.5-9.5s6.5 4 6.5 9.5z"/><circle cx="10" cy="6.5" r="3.3"/>' +
    '<path class="l" d="M19.5 9v12.5M17.5 9.5c0-2 4-2 4 0"/>',
  child: CHILD_STEN,
  sibling:
    '<path class="l" d="M7 8.5V5h10v3.5M12 5V2.5"/><circle cx="7" cy="12.3" r="2.7"/><circle cx="17" cy="12.3" r="2.7"/>' +
    '<path d="M2.8 21.5c0-3.3 1.8-5 4.2-5s4.2 1.7 4.2 5z"/><path d="M12.8 21.5c0-3.3 1.8-5 4.2-5s4.2 1.7 4.2 5z"/>',
  housemate:
    '<path d="M2.5 12L12 3.5l9.5 8.5h-3.8L12 7l-5.7 5z"/><path class="l" d="M6 13.5v7h12v-7"/>' +
    '<circle cx="9.5" cy="16" r="1.8"/><circle cx="14.5" cy="16" r="1.8"/>',
  friend: `<path class="l" d="${HEART}"/>`,
  'close friend': `<path d="${HEART_STEN}"/>`,
  dislikes: `<path d="${HEART_STEN}"/><path class="c" d="M12.5 6.5l-2.5 4.5 4 2.5-2.5 6"/>`,
  enemy: '<path class="l" d="M4 4l13 13M20 4L7 17M14.5 19.5l5-5M9.5 19.5l-5-5M17 17l3 3M7 17l-3 3"/>',
};
const bondIcon = (k) => drawings(svgIcon(24, 24, BOND_PATHS[k], ICON_STROKE), { stencil: BOND_STEN[k] });
// A person's state in its family (VB-1035), where no other person's chip can say it: one ring; the two rings, one of them faded;
// a figure great with child; a mother with a swaddled child.
const STATE_PATHS = {
  unmarried: '<circle cx="12" cy="14" r="5.5"/><path d="M10.5 6.5L12 4l1.5 2.5"/>',
  widowed:
    '<circle cx="9" cy="13" r="5"/><circle cx="15" cy="13" r="5" stroke-dasharray="1.6 2.8"/><path d="M7.5 6L9 3.5 10.5 6"/>',
  expecting: '<circle cx="10.5" cy="5.5" r="2.8"/><path d="M9 10.5c-1.2 3.5-1.2 7 0 10.5h4.5v-3c4.2-.6 5-6-.5-7.5z"/>',
  nursing:
    '<circle cx="9" cy="6" r="2.8"/><path d="M4.5 21c0-5 1.5-9 4.5-9 1.8 0 3.2 1 4.2 2.8"/><circle cx="16.5" cy="13" r="1.9"/>' +
    '<path d="M12.2 18.2c1.2-2.2 6.4-2.2 7.8-.2 0 2-1.8 3-3.9 3s-3.9-1-3.9-2.8z"/>',
};
// The same states as stencils (VB-1163).
const STATE_STEN = {
  unmarried: '<circle class="l" cx="12" cy="14.5" r="5.5"/><path d="M10.5 7L12 4l1.5 3z"/>',
  widowed:
    '<circle class="l" cx="9" cy="13.5" r="4.8"/><circle class="l" cx="15" cy="13.5" r="4.8" stroke-dasharray="1.2 4.2"/>' +
    '<path d="M7.5 6.5l1.5-3 1.5 3z"/>',
  expecting: '<circle cx="10.5" cy="5.5" r="3"/><path d="M9 10.5c-1.2 3.5-1.2 7 0 10.5h4.5v-3c4.2-.6 5-6-.5-7.5z"/>',
  nursing:
    '<circle cx="9" cy="6" r="3"/><path d="M4 21.5c0-5.5 1.8-9.5 5-9.5 2 0 3.5 1.2 4.5 3l-2 6.5z"/><circle cx="16.5" cy="13" r="2"/>' +
    '<path d="M12.2 18.2c1.2-2.2 6.4-2.2 7.8-.2 0 2-1.8 3.2-3.9 3.2s-3.9-1-3.9-3z"/>',
};
const stateIcon = (k) => drawings(svgIcon(24, 24, STATE_PATHS[k], ICON_STROKE), { stencil: STATE_STEN[k] });
// The occasions (sim/occasions; VB-1032), one icon a kind, each an icon the interface has already: the two bubbles of who speaks, the
// cross of piety, the rings, the tear of the grieving, the tankard. The map's mark of a gathering draws the same path (page/gathering).
const OCCASION_PATHS = {
  meeting: TRAIT_PATHS.sociability,
  rite: TRAIT_PATHS.piety,
  wedding: GOOD_PATHS.married,
  funeral: GOOD_PATHS.grieving,
  ale: GOOD_PATHS.ale,
  call: TRAIT_PATHS.sociability, // a call on a household (VB-1119's kind had no mark, and the map's mark threw): people who talk, as a meeting
  gathering: TRAIT_PATHS.sociability, // a day of the gathering (VB-295): people of many villages who talk, as a meeting
  harvest: TRAIT_PATHS.sociability, // the harvest home (VB-459): a feast of people who talk, as a meeting (it had no mark, and the map's mark threw)
};
const OCCASION_STEN = {
  meeting: TRAIT_STEN.sociability,
  rite: TRAIT_STEN.piety,
  wedding: RINGS_STEN,
  funeral: GOOD_STEN.grieving,
  ale: ACT_STEN.ale,
  call: TRAIT_STEN.sociability,
  gathering: TRAIT_STEN.sociability,
  harvest: TRAIT_STEN.sociability,
};
const occasionIcon = (k) => drawings(svgIcon(24, 24, OCCASION_PATHS[k], ICON_STROKE), { stencil: OCCASION_STEN[k] });
for (const k of ['me', 'home', 'village', 'queue']) ICON['act-' + k] = actIcon(k);
// A button marked data-icon="name" takes that icon before its content (a dock button keeps its label under it).
for (const b of document.querySelectorAll('[data-icon]')) b.insertAdjacentHTML('afterbegin', ICON[b.dataset.icon]);
// A tab marked data-good="name" takes that good's icon before its word (the household's tabs, VB-664).
for (const b of document.querySelectorAll('[data-good]')) b.insertAdjacentHTML('afterbegin', goodIcon(b.dataset.good));
