// @sys page/icons: the interface's icons (VB-338), inline SVG drawn in currentColor, so a button's colour and pressed state colour its icon
const svgIcon = (w, h, body, attrs = '') =>
  `<svg class="ico" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true" focusable="false"${attrs}>${body}</svg>`;
const ICON_STROKE =
  ' fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
// A speed is one to five chevrons, > to >>>>> (11 Nov: no numbers): 1×, 3×, 10×, 30× and uncapped (Infinity). Open chevrons, so that
// the speed of 1× is not the filled triangle of play beside it.
const SPEED_ARROWS = { 1: 1, 3: 2, 10: 3, 30: 4, Infinity: 5 };
function speedIcon(v) {
  const n = SPEED_ARROWS[v] || 1,
    step = 5.5,
    w = step * (n - 1) + 8;
  let d = '';
  for (let k = 0; k < n; k++) d += `M${1.5 + k * step} 2L${6.5 + k * step} 7L${1.5 + k * step} 12`;
  return svgIcon(
    w,
    14,
    `<path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  );
}
const ICON = {
  pause: svgIcon(
    14,
    14,
    '<rect x="2" y="1" width="3.5" height="12" rx="1" fill="currentColor"/>' +
      '<rect x="8.5" y="1" width="3.5" height="12" rx="1" fill="currentColor"/>',
  ),
  skip: svgIcon(
    14,
    14,
    '<path d="M2 1.5L9.5 7L2 12.5Z" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>' +
      '<rect x="10.5" y="1.5" width="2.5" height="11" rx="1" fill="currentColor"/>',
  ),
  play: svgIcon(
    14,
    14,
    '<path d="M3 1L12 7L3 13Z" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>',
  ),
  // the interface shown: an eye struck through, to hide it; hidden: an open eye, to show it again
  eye: svgIcon(
    20,
    20,
    '<path d="M1.5 10S5 4 10 4s8.5 6 8.5 6-3.5 6-8.5 6S1.5 10 1.5 10Z"/><circle cx="10" cy="10" r="2.6"/>',
    ICON_STROKE,
  ),
  eyeOff: svgIcon(
    20,
    20,
    '<path d="M1.5 10S5 4 10 4s8.5 6 8.5 6-3.5 6-8.5 6S1.5 10 1.5 10Z"/><circle cx="10" cy="10" r="2.6"/><path d="M3 17L17 3"/>',
    ICON_STROKE,
  ),
  // the dock (11 Nov): two people, a family tree, a scroll of customs, a bug for Debug; the played pawn's actions, a game pawn. The main
  // menu, at the top bar's end, is three lines.
  people: svgIcon(
    20,
    20,
    '<circle cx="7.5" cy="6.5" r="2.8"/><path d="M2.5 17c0-3.2 2.2-5.4 5-5.4s5 2.2 5 5.4"/>' +
      '<circle cx="14" cy="7.5" r="2.3"/><path d="M14 11.7c2.2 0 3.7 2 3.7 4.8"/>',
    ICON_STROKE,
  ),
  family: svgIcon(
    20,
    20,
    '<rect x="7.5" y="2" width="5" height="4" rx="1"/><rect x="2" y="14" width="5" height="4" rx="1"/>' +
      '<rect x="13" y="14" width="5" height="4" rx="1"/><path d="M10 6v4M4.5 14v-4h11v4"/>',
    ICON_STROKE,
  ),
  customs: svgIcon(
    20,
    20,
    '<rect x="3" y="2.5" width="14" height="3" rx="1.5"/><rect x="3" y="14.5" width="14" height="3" rx="1.5"/>' +
      '<path d="M5 5.5v9M15 5.5v9M7.5 8.5h5M7.5 11.5h5"/>',
    ICON_STROKE,
  ),
  menu: svgIcon(20, 20, '<path d="M3 5.5h14M3 10h14M3 14.5h14"/>', ICON_STROKE),
  pawn: svgIcon(
    20,
    20,
    '<circle cx="10" cy="5" r="2.6"/><path d="M8.2 7.8h3.6l1.4 7H6.8Z"/><rect x="5" y="14.8" width="10" height="2.7" rx="1"/>',
    ICON_STROKE,
  ),
  agenda: svgIcon(
    20,
    20,
    '<path d="M3.5 8.5v3.5h2.5l6.5 3.2V5.3L6 8.5zM15 8a3 3 0 0 1 0 4.5M6 12l.8 4h2l-.8-3.6"/>',
    ICON_STROKE,
  ),
  bug: svgIcon(
    20,
    20,
    '<path d="M7 7.5a3 3 0 0 1 6 0"/><rect x="6" y="7.5" width="8" height="9.5" rx="4"/>' +
      '<path d="M10 9.5v7M6 10.5H3M14 10.5h3M6 14H3.5M14 14h2.5M7.5 5L6 3M12.5 5L14 3"/>',
    ICON_STROKE,
  ),
  // the map's bar under the minimap (11 Nov): the grid, the regions, the land held (a claim's flag), which notifications show, the minimap
  grid: svgIcon(20, 20, '<path d="M3 7h14M3 13h14M7 3v14M13 3v14"/>', ICON_STROKE),
  regions: svgIcon(
    20,
    20,
    '<rect x="2.5" y="3" width="15" height="14" rx="2"/><path d="M9.5 3c-2 3 1.5 4.5-.5 7s1 4.5 0 7M9.2 10c3 1.2 5-1 8.3 0"/>',
    ICON_STROKE,
  ),
  land: svgIcon(20, 20, '<path d="M5 17.5V2.5M5 3.5h10l-2.5 3.25L15 10H5"/>', ICON_STROKE),
  ground: svgIcon(20, 20, '<path d="M2.5 7.5L10 3.5l7.5 4-7.5 4ZM2.5 11.5l7.5 4 7.5-4"/>', ICON_STROKE), // strata: what lies in the ground
  reach: svgIcon(
    20,
    20,
    '<circle cx="10" cy="10" r="1.5"/><circle cx="10" cy="10" r="4.5"/><circle cx="10" cy="10" r="7.5"/>',
    ICON_STROKE,
  ), // rings round a place: how far a walk is
  bell: svgIcon(
    20,
    20,
    '<path d="M5 14V9a5 5 0 0 1 10 0v5l1.5 1.5h-13Z"/><path d="M8.3 17.5a1.8 1.8 0 0 0 3.4 0"/>',
    ICON_STROKE,
  ),
  minimap: svgIcon(
    20,
    20,
    '<path d="M2.5 5l5-2 5 2 5-2v12l-5 2-5-2-5 2Z"/><path d="M7.5 3v12M12.5 5v12"/>',
    ICON_STROKE,
  ),
  // the panels' heads: close, and a chevron that points down while the panel is open (to fold it) and up while it is folded
  close: svgIcon(16, 16, '<path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/>', ICON_STROKE),
  chevron: svgIcon(16, 16, '<path d="M3.5 6l4.5 4.5L12.5 6"/>', ICON_STROKE),
};
// The action bar (VB-341), 24 by 24 as drawn for the mock-up (docs/mockups/action-menu.html): its groups, its rows, and a job kind's tool.
const ACT_PATHS = {
  me: '<circle cx="12" cy="6" r="3"/><path d="M6 21c0-5 2.5-9 6-9s6 4 6 9z"/>',
  home: '<path d="M4 11l8-7 8 7M6 10v9h12v-9M10 19v-5h4v5"/>',
  village:
    '<circle cx="12" cy="6" r="2.2"/><circle cx="6" cy="16" r="2.2"/><circle cx="18" cy="16" r="2.2"/>' +
    '<path d="M12 8.5v3M8 14.5l2.5-2M16 14.5l-2.5-2"/>',
  queue: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  walk: '<circle cx="13" cy="4" r="1.8"/><path d="M13 7l-3 5 3 3v5M10 12l-3 1M13 10l3 2 2-1M10 15l-2 5"/>',
  idle: '<path d="M19 14.5A8 8 0 1 1 9.5 5a6.5 6.5 0 0 0 9.5 9.5z"/>',
  round: '<path d="M3 11l7-6 7 6M5 10v9h7M15 14h6M18 11l3 3-3 3"/>',
  offer: '<path d="M4 5h16v10H10l-4 4v-4H4z"/>',
  cause: '<path d="M4 10v4h3l8 4V6l-8 4zM18 9.5a3.5 3.5 0 0 1 0 5M7 14l1 5h2.5l-1-4.5"/>',
  gift: '<path d="M4 10h16v10H4zM12 10v10M3 7h18v3H3zM12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0"/>',
  chop: '<path d="M5 20L14 9M12 5l7 7c-2 2-5 2-7 .5l-1.5-1.5C9 9 10 6.5 12 5z"/>',
  hoe: '<path d="M6 21L16 5M16 5l4.5 1.5-2 5-4.5-3"/>',
  sow: '<path d="M12 21v-9M12 12c0-4-3-6-7-6 0 4 3 6 7 6zM12 14c0-3 2.5-5 6.5-5 0 3.5-2.5 5-6.5 5z"/>',
  mow: '<path d="M6 21L15 4M15 4c4 0 6 3 6 7-2-3-5-4-8-3.5"/>',
  hay: '<path d="M4 20c0-8 3-14 8-14s8 6 8 14zM9 20c0-4 1-7 3-9"/>',
  sack: '<path d="M9 4h6l-1.5 3c3.5 1.5 5.5 5 5.5 8 0 3-2 5-7 5s-7-2-7-5c0-3 2-6.5 5.5-8zM9.5 7h5"/>',
  build: '<path d="M6 21l7-9M10 5l8 6-2 3-8-6z"/>',
  fish: '<path d="M3 12c3-4 8-5 12-2l5-3v10l-5-3c-4 3-9 2-12-2z"/><circle cx="8" cy="11.5" r=".6"/>',
  water: '<path d="M12 3c3 5 6 8 6 11a6 6 0 0 1-12 0c0-3 3-6 6-11z"/>',
  pot: '<path d="M4 10h16M6 10v6a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4v-6M9 7c0-1 1-2 0-3M14 7c0-1 1-2 0-3"/>',
  pail: '<path d="M6 9h12l-1.5 11h-9zM6 9c0-3.5 3-6 6-6s6 2.5 6 6"/>',
  back: '<path d="M14 6l-6 6 6 6"/>',
  next: '<path d="M10 6l6 6-6 6"/>',
  no: '<path d="M6 6l12 12M18 6L6 18"/>',
  emptyfarm: '<path d="M4 11l8-7 8 7M6 10v9h12v-9"/>', // a house with no door: no one lives there
  ruin: '<path d="M3 20h18M6 20v-9l3 2.5V9l3 3M18 20v-5l-3-2v7"/>', // broken walls
  green: '<path d="M6 20v-8h12v8M4 12h16M8 12V6h8v6M12 6V3"/>', // the well on the green
  road: '<path d="M8 21l2-18M16 21L14 3M12 5v2.5M12 10.5v3M12 16.5v3"/>', // a way running off: its two edges and a broken middle line
  rake: '<path d="M6 21L15 6M10 4l10 5M11.5 4.8l-1.3 3M14.5 6.2l-1.3 3M17.5 7.6l-1.3 3M20 9l-1.3 3"/>', // a hay rake: its head and tines
  quern:
    '<ellipse cx="12" cy="15" rx="8" ry="3.5"/><path d="M4 15v3c0 2 3.5 3.5 8 3.5s8-1.5 8-3.5v-3M6 11.5' +
    'c0-2 2.7-3.5 6-3.5s6 1.5 6 3.5M15 9V4"/>', // two stones and the handle
  fork: '<path d="M6 21L14 9M11 4.5l-1 5.5 4 3 5-2M13.5 6.2l-1 4.3M16.3 8l-1.8 3.8"/>', // a dung fork
  spade: '<path d="M7 20l8-10M13 6l5 4-2.5 5.5L10.5 12zM5.5 18.5l3 3"/>',
  weed: '<path d="M12 21v-7M12 14c-1-4-4-5-7-5 0 3 3 5 7 5zM12 12c1-5 4-6 7-6 0 4-3 6-7 6zM4 21h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
};
const actIcon = (k) => svgIcon(24, 24, ACT_PATHS[k] || ACT_PATHS.hoe, ICON_STROKE);
// a job kind's icon (sim/kinds); a kind not named here takes the hoe
const KIND_ICON = {
  sow: 'sow',
  gather: 'sow',
  reap: 'mow',
  mow: 'mow',
  rake: 'rake',
  haul: 'hay',
  hay: 'hay',
  fodder: 'hay',
  wood: 'chop',
  fell: 'chop',
  grub: 'chop',
  timber: 'chop',
  pick: 'build',
  quarry: 'build',
  raise: 'build',
  water: 'water',
  cook: 'pot',
  brew: 'pot',
  thresh: 'sack',
  salt: 'sack',
  slaughter: 'sack',
  milk: 'pail',
  restore: 'build',
  foundation: 'build',
  walls: 'build',
  roof: 'build',
  mend: 'build',
  repair: 'build',
  fish: 'fish',
  grind: 'quern',
  manure: 'fork',
  weed: 'weed',
  clear: 'spade',
  break: 'spade',
  reclaim: 'spade',
  meadow: 'spade',
};
// Goods and measures in the panels (VB-664): one icon a kind, wherever it is shown; 24 by 24, the action bar's stroke.
const GOOD_PATHS = {
  grain:
    '<path d="M12 21V8M12 8c-2-1-2.5-3 0-5 2.5 2 2 4 0 5zM12 12c-3 0-4-2-4-4 2.5 0 4 1.5 4 4zM12 12' +
    'c3 0 4-2 4-4-2.5 0-4 1.5-4 4zM12 16.5c-3 0-4-2-4-4 2.5 0 4 1.5 4 4zM12 16.5c3 0 4-2 4-4-2.5 0-4 1.5-4 4z"/>',
  seed: ACT_PATHS.sow,
  flour: ACT_PATHS.sack,
  meals: ACT_PATHS.pot,
  sheaves: '<path d="M8 21l2-9M16 21l-2-9M12 21v-9M7 12h10M10 12L7 4M12 12V3M14 12l3-8M9 12L4 7M15 12l5-5"/>',
  hay: ACT_PATHS.hay,
  wood: '<circle cx="7" cy="16" r="3.5"/><circle cx="17" cy="16" r="3.5"/><circle cx="12" cy="8.5" r="3.5"/><path d="M7 16h.01M17 16h.01M12 8.5h.01"/>',
  stone: '<path d="M4 18l2-7 5-4 6 1 3 6-2 4zM11 7l1 5 6 2M12 12l-6 1"/>',
  clay: '<path d="M4 9h10v6H4zM14 9l5-3v6l-5 3M4 9l5-3h10"/>',
  ore: '<path d="M5 19l-1-6 4-6 6-2 5 4 1 7-4 3zM8 7l3 5-2 6M11 12l6-1"/><path d="M14.5 15h.01M7 14h.01"/>',
  peat: '<path d="M3 15h8v5H3zM13 15h8v5h-8zM8 9h8v5H8zM6 17.5h2M16 17.5h2M11 11.5h2"/>',
  wool: '<path d="M7 17a4 4 0 0 1-1-7.8A4 4 0 0 1 12 6a4 4 0 0 1 6 3.2A4 4 0 0 1 17 17zM9 17v3M15 17v3"/>',
  fish: ACT_PATHS.fish,
  tar: '<path d="M7 4h10c1.5 3 1.5 13 0 16H7C5.5 17 5.5 7 7 4zM5.9 9h12.2M5.9 15h12.2"/>',
  water: ACT_PATHS.water,
  cart: '<path d="M3 8h13l1.5 6H5zM17.5 14l3.5-7"/><circle cx="9" cy="17" r="3"/>',
  boat: '<path d="M3 14h18l-3 5H6zM12 14V4l6 7h-6"/>',
  quern: ACT_PATHS.quern,
  meat: '<path d="M14 4c4 0 6 3 6 6 0 4-4 7-9 6l-3 3-2-.5-.5-2 3-3C7 9 10 4 14 4zM14 8.5a1.5 1.5 0 1 0 .01 0"/>',
  butter: '<path d="M8 21h8l1-11H7zM7.5 14h9M12 10V3M10 3h4"/>',
  milk: ACT_PATHS.pail,
  field: '<path d="M3 19l4-13h10l4 13zM10 6l-2 13M14 6l2 13M5.2 12h13.6"/>',
  meadow:
    '<path d="M3 20h18M6 20c0-4-1-6-2-8M8 20c0-5 1-8 2-10M12 20c0-4-.5-6-1.5-8M15 20c0-5 1-8 2.5-10M18 20c0-3 1-5 2-6"/>',
  beast: '<path d="M4 9l2-3 1 2h8l3-2 2 2-1 3v3l-1 5h-2l-.5-4H9.5L9 19H7l-1-5c-1.5-1-2-3-2-5z"/>',
  health: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
  hunger: '<path d="M4 11h16a8 8 0 0 1-16 0zM9 19.5V21h6v-1.5M12 3v5M8.5 5v3M15.5 5v3"/>',
  prestige: '<path d="M4 18h16M5 15l-1-8 5 4 3-6 3 6 5-4-1 8z"/>',
  people:
    '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2.5-7 6-7s6 3 6 7M15.5 5.5a2.5 2.5 0 1 1 0 5M17.5 13.5c2 .7 3.5 3 3.5 6.5"/>',
  fence: '<path d="M5 21V6l1.5-2L8 6v15M11 21V6l1.5-2L14 6v15M17 21V6l1.5-2L20 6v15M3 10h18M3 16h18"/>',
  cold: '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5"/>',
  soil: '<path d="M3 13c3-2 6-2 9 0s6 2 9 0M3 18c3-2 6-2 9 0s6 2 9 0M12 10V4M12 6c-2 0-3-1-3-3M12 7c2 0 3-1 3-3"/>',
  heir: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M14.5 8.5l2 2"/>',
  holder: ACT_PATHS.home,
  tile: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/>',
};
const goodIcon = (k) => svgIcon(24, 24, GOOD_PATHS[k] || GOOD_PATHS.tile, ICON_STROKE);
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
const traitIcon = (k) => svgIcon(24, 24, TRAIT_PATHS[k], ICON_STROKE);
for (const k of ['me', 'home', 'village', 'queue']) ICON['act-' + k] = actIcon(k);
// A button marked data-icon="name" takes that icon before its content (a dock button keeps its label under it).
for (const b of document.querySelectorAll('[data-icon]')) b.insertAdjacentHTML('afterbegin', ICON[b.dataset.icon]);
// A tab marked data-good="name" takes that good's icon before its word (the household's tabs, VB-664).
for (const b of document.querySelectorAll('[data-good]')) b.insertAdjacentHTML('afterbegin', goodIcon(b.dataset.good));
