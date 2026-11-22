// @sys page/icons: the interface's icons (VB-338), inline SVG drawn in currentColor, so a button's colour and pressed state colour its icon
const svgIcon = (w, h, body, attrs = '') =>
  `<svg class="ico" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true" focusable="false"${attrs}>${body}</svg>`;
const ICON_STROKE =
  ' fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
// The mural theme's icons (VB-1162): each icon may carry a second drawing, a stencil, as the stencilled marks of a painted vault: flat
// shapes in one pigment, held apart by gaps. Both drawings are in the icon, and the theme's styles show one of them (src/head.html), so
// a change of theme redraws nothing. A stencil is drawn on a 24 box and scaled to its icon's; its shapes are filled, but for those of
// class "l" (a line in the pigment: a handle, a stem) and "c" (a cut through a shape, in the ground's colour).
function stencil(svg, shapes, box = 24) {
  if (!shapes) return svg;
  const at = svg.indexOf('>') + 1,
    k = +/viewBox="0 0 \S+ (\S+)"/.exec(svg)[1] / box;
  return (
    `${svg.slice(0, at)}<g class="i-line">${svg.slice(at, -6)}</g>` +
    `<g class="i-sten"${k === 1 ? '' : ` transform="scale(${+k.toFixed(4)})"`}>${shapes}</g></svg>`
  );
}
// A speed is one to five chevrons, > to >>>>> (11 Nov: no numbers): 1×, 3×, 10×, 30× and uncapped (Infinity). Open chevrons, so that
// the speed of 1× is not the filled triangle of play beside it.
const SPEED_ARROWS = { 1: 1, 3: 2, 10: 3, 30: 4, Infinity: 5 };
function speedIcon(v) {
  const n = SPEED_ARROWS[v] || 1,
    step = 5.5,
    w = step * (n - 1) + 8;
  let d = '';
  for (let k = 0; k < n; k++) d += `M${1.5 + k * step} 2L${6.5 + k * step} 7L${1.5 + k * step} 12`;
  let sten = '';
  for (let k = 0; k < n; k++) sten += `<path d="M${1 + k * step} 1.5h3.2l4 5.5-4 5.5H${1 + k * step}l4-5.5z"/>`;
  return stencil(
    svgIcon(
      w,
      14,
      `<path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    ),
    sten,
    14,
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
// The stencils of the bars' and the panels' icons (VB-1162), by ICON's keys.
const PEOPLE_STEN =
  '<path d="M10 20.5c0-5 2.2-8 5.5-8s5.5 3 5.5 8z"/><circle cx="15.5" cy="7.6" r="2.7"/>' +
  '<path d="M2.5 21.5c0-5.5 2.6-9 6-9s6 3.5 6 9z"/><circle cx="8.5" cy="8" r="3.1"/>';
const EYE_STEN =
  '<path d="M2 12c3-5 6.5-7 10-7s7 2 10 7c-3 5-6.5 7-10 7s-7-2-10-7z"/><circle class="c" cx="12" cy="12" r="3.2"/>';
const ICON_STEN = {
  pause: '<rect x="5.5" y="4" width="4.6" height="16" rx=".6"/><rect x="13.9" y="4" width="4.6" height="16" rx=".6"/>',
  skip: '<path d="M4.5 4.5l10 7.5-10 7.5z"/><rect x="16" y="4.5" width="3.6" height="15" rx=".6"/>',
  play: '<path d="M6.5 4l12.5 8-12.5 8z"/>',
  eye: EYE_STEN,
  eyeOff: EYE_STEN + '<path class="c" d="M5.4 21.2L21.4 4.2"/><path class="l" d="M4 20L20 3"/>',
  people: PEOPLE_STEN,
  // a tree of kin: a stem, its branches, a round for each of three
  family:
    '<path class="l" d="M12 21.5V9M12 16c-3.2 0-5-1.6-5-4M12 14c3.2 0 5-1.6 5-4M7.5 21.5h9"/>' +
    '<circle cx="12" cy="6" r="3"/><circle cx="6.5" cy="9.5" r="2.6"/><circle cx="17.5" cy="7.8" r="2.6"/>',
  // a banderole, the scroll a mural's figure speaks from
  customs:
    '<path d="M2.5 9.5c3.2-3.4 6.3 2.6 9.5 0s6.3-3.4 9.5 0v6.5c-3.2-3.4-6.3 2.6-9.5 0s-6.3 3.4-9.5 0z"/>' +
    '<path class="c" d="M5.8 12.4l3 .8M12.2 12.6l2.6-1M17 11.4l1.8.6"/>',
  menu:
    '<rect x="4" y="4.4" width="16" height="3.5" rx=".6"/><rect x="4" y="10.25" width="16" height="3.5" rx=".6"/>' +
    '<rect x="4" y="16.1" width="16" height="3.5" rx=".6"/>',
  pawn: '<circle cx="12" cy="5.8" r="3.3"/><path d="M9 9.5h6l2 8.2H7z"/><rect x="5" y="18.3" width="14" height="3.2" rx=".6"/>',
  agenda: '<path d="M3 9.8v4.4h3l9 4.5V5.3l-9 4.5z"/><path class="l" d="M18.2 9.3c1.3 1.3 1.3 4.1 0 5.4"/>',
  bug:
    '<path class="l" d="M7.5 12h-4M16.5 12h4M8 16.5l-3.2 1.8M16 16.5l3.2 1.8M9.5 4.5L8 2.5M14.5 4.5l1.5-2"/>' +
    '<ellipse cx="12" cy="14.5" rx="5" ry="6.5"/><circle cx="12" cy="6.3" r="2.6"/><path class="c" d="M12 9.5V20"/>',
  grid: '<path class="l" d="M4 8.5h16M4 15.5h16M8.5 4v16M15.5 4v16"/>',
  regions:
    '<rect x="3" y="3.5" width="18" height="17" rx="1"/>' +
    '<path class="c" d="M11 3.5c-2.5 3.5 2 5.5-.5 8.5s1 5.5 0 8.5M10.8 12c3.5 1.5 6-1.2 10.2 0"/>',
  land: '<path class="l" d="M6 21.5V3"/><path d="M7 3.5h12l-3.2 4 3.2 4H7z"/>',
  ground: '<path d="M3 9l9-5 9 5-9 5z"/><path class="l" d="M3.5 14.5l8.5 4.7 8.5-4.7"/>',
  reach: '<circle class="l" cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.8"/>',
  bell: '<path d="M6 16.5v-6a6 6 0 0 1 12 0v6l2 2H4z"/><circle cx="12" cy="20.8" r="1.6"/>',
  minimap: '<path d="M3 6l6-2.5 6 2.5 6-2.5V18l-6 2.5L9 18l-6 2.5z"/><path class="c" d="M9 3.5V18M15 6v14.5"/>',
  close: '<path class="l" d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  chevron: '<path class="l" d="M5.5 9l6.5 6.5L18.5 9"/>',
};
for (const k of Object.keys(ICON_STEN)) ICON[k] = stencil(ICON[k], ICON_STEN[k]);
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
  target: '<circle cx="12" cy="12" r="7"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/>',
  fence: '<path d="M5 21V8l2-2.5L9 8v13M15 21V8l2-2.5L19 8v13M3 12h18M3 17h18"/>',
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
  ale: '<path d="M6 7h10v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zM16 10h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2M6 7c0-2 2-3 4-2 1-1.5 4-1.5 5 .5"/>', // a tankard
};
// The same acts as stencils (VB-1162), by ACT_PATHS' keys.
const HOUSE_STEN = 'M2.5 11.5l9.5-8.5 9.5 8.5h-2.8V21H5.3v-9.5z';
const LEAVES_STEN =
  '<path d="M12 12.5c0-4.5-3-6.5-7.5-6.5 0 4.5 3 6.5 7.5 6.5z"/><path d="M12 14.5c0-3.5 2.5-5.5 7-5.5 0 4-2.5 5.5-7 5.5z"/>';
const ACT_STEN = {
  me: '<path d="M5.5 21.5c0-5.5 2.8-9 6.5-9s6.5 3.5 6.5 9z"/><circle cx="12" cy="7.5" r="3.6"/>',
  home: `<path d="${HOUSE_STEN}"/><path class="c" d="M12 21v-5.5"/>`,
  village:
    '<path d="M1.8 21v-5.2l3.7-3.3 3.7 3.3V21z"/><path d="M14.8 21v-5.2l3.7-3.3 3.7 3.3V21z"/><path d="M8 12V7l4-3.6L16 7v5z"/>',
  queue:
    '<circle cx="4.8" cy="6.2" r="1.8"/><rect x="8.5" y="4.6" width="12.5" height="3.2" rx=".6"/>' +
    '<circle cx="4.8" cy="12" r="1.8"/><rect x="8.5" y="10.4" width="12.5" height="3.2" rx=".6"/>' +
    '<circle cx="4.8" cy="17.8" r="1.8"/><rect x="8.5" y="16.2" width="12.5" height="3.2" rx=".6"/>',
  walk: '<path class="l" d="M13 8.5l-2.5 5 3 3v5M10.5 13.5L8 20.5M13 9.5l3.5 2.5 2.5-1M12.5 9l-4 2.5"/><circle cx="13.5" cy="4.3" r="2.5"/>',
  idle: '<path d="M19.5 14.8A8.5 8.5 0 1 1 9.2 4.5a7 7 0 0 0 10.3 10.3z"/>',
  round: '<path d="M2 11.5l6.5-6 6.5 6h-2v8H4v-8z"/><path class="l" d="M16.5 15H22M19.5 12l3 3-3 3"/>',
  offer: '<path d="M3.5 4.5h17v11H11l-4.5 4.5v-4.5h-3z"/>',
  cause: '<path d="M3 9.8v4.4h3l9 4.5V5.3l-9 4.5z"/><path class="l" d="M18.2 9.3c1.3 1.3 1.3 4.1 0 5.4M7.5 15.5l1 5"/>',
  gift:
    '<rect x="4" y="11" width="16" height="9.5"/><rect x="2.8" y="6.8" width="18.4" height="3.6"/><path class="c" d="M12 6.8v13.7"/>' +
    '<path class="l" d="M12 6.3c-1.5-3.5-5-3-4.5-.5M12 6.3c1.5-3.5 5-3 4.5-.5"/>',
  chop: '<path class="l" d="M6 21.5L14.5 7"/><path d="M12 3.5c3.5 0 6.5 1.7 8 4.7l-5 3.3c-1-1.7-2.7-2.8-4.7-3.2z"/>',
  target:
    '<circle cx="12" cy="12" r="2.6"/><path class="l" d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/><circle class="l" cx="12" cy="12" r="7"/>',
  fence:
    '<path class="l" d="M3 12.5h18M3 17.5h18"/><path d="M4.5 21.5v-13l2.5-3 2.5 3v13zM14.5 21.5v-13l2.5-3 2.5 3v13z"/>',
  hoe: '<path class="l" d="M5.5 21L15.5 6.5"/><path d="M13 4l6.6 3.8-2.4 3.6c-2-.5-4-1.8-5.8-3.8z"/>',
  sow: `<path class="l" d="M12 21.5v-9"/>${LEAVES_STEN}`,
  mow: '<path class="l" d="M6 21.5L15 4.5"/><path d="M14.5 3.5c4.5 0 7 3.5 7 8-2.2-3.3-5.5-4.6-9-4z"/>',
  hay: '<path d="M3.5 20.5c0-8.5 3.2-15 8.5-15s8.5 6.5 8.5 15z"/><path class="c" d="M9 20.5c0-4.5 1-7.5 3-10M15 20.5c0-3-.5-5-1.5-7"/>',
  sack:
    '<path d="M9 3.5h6l-1.5 3.2c3.7 1.6 5.8 5.2 5.8 8.3 0 3.3-2.2 5.5-7.3 5.5s-7.3-2.2-7.3-5.5c0-3.1 2.1-6.7 5.8-8.3z"/>' +
    '<path class="c" d="M9.3 7.2h5.4"/>',
  build: '<path class="l" d="M5.5 21.5l7-9"/><path d="M9.8 4l9 6.8-2.5 3.4-9-6.8z"/>',
  fish: '<path d="M2.5 12c3.2-4.5 8.5-5.5 12.8-2.2l5.2-3.3v11l-5.2-3.3C11 17.5 5.7 16.5 2.5 12z"/><circle class="c" cx="7.5" cy="11.3" r=".9"/>',
  water:
    '<path d="M12 2.5c3.2 5.3 6.5 8.5 6.5 11.8a6.5 6.5 0 0 1-13 0c0-3.3 3.3-6.5 6.5-11.8z"/><path class="c" d="M9 15c.3 1.5 1.3 2.5 2.8 2.8"/>',
  pot:
    '<path d="M5.5 10.5h13V16a4.5 4.5 0 0 1-4.5 4.5h-4A4.5 4.5 0 0 1 5.5 16z"/><rect x="3" y="8" width="18" height="2.2" rx=".6"/>' +
    '<path class="l" d="M9.5 6c0-1 1-1.8 0-3M14.5 6c0-1 1-1.8 0-3"/>',
  pail: '<path d="M5.5 9.5h13L17 20.5H7z"/><path class="l" d="M6.5 8.5C6.5 5.2 9 3 12 3s5.5 2.2 5.5 5.5"/><path class="c" d="M6.3 13.5h11.4"/>',
  back: '<path class="l" d="M14.5 5.5L8 12l6.5 6.5"/>',
  next: '<path class="l" d="M9.5 5.5L16 12l-6.5 6.5"/>',
  no: '<path class="l" d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  // a roof over open walls: no one lives there
  emptyfarm: '<path d="M2.5 12L12 3.5l9.5 8.5h-3.8L12 7l-5.7 5z"/><path class="l" d="M6 13.5v7h12v-7"/>',
  ruin: '<path class="l" d="M3 20.5h18"/><path d="M5 19.5v-9l3.5 2.8V9l3.5 3.5v7z"/><path d="M14.5 19.5V12l4.5 2.8v4.7z"/>',
  green:
    '<path d="M6 12.5h12v8H6z"/><path d="M7 6h10l1.5 3.5h-13z"/><path class="l" d="M8 10v2M16 10v2M12 5.5V3"/><path class="c" d="M6 16.5h12"/>',
  road: '<path d="M7 21.5l3-19h4l3 19z"/><path class="c" d="M12 5v2.5M12 10.5v3M12 16.5v3.5"/>',
  rake: '<path class="l" d="M5 21L15.5 7M11 5.5L9.5 8M14 7.5L12.5 10M17 9.5L15.5 12"/><path d="M9.8 3.5L20 10l-1 1.7L8.8 5.2z"/>',
  quern:
    '<path d="M4 13.5h16V17c0 2.2-3.6 3.8-8 3.8S4 19.2 4 17z"/><ellipse cx="12" cy="9.3" rx="7.2" ry="3.6"/>' +
    '<path class="l" d="M14.5 8.5l3-5"/>',
  fork: '<path class="l" d="M5.5 21.5L13 10M10 5l-.5 5.5 4.5 3 5-1.5M13 6.5l-1 4M16.5 8.5L15 12"/>',
  spade: '<path class="l" d="M12 3v9M9.5 3h5"/><path d="M7.8 12h8.4v4c0 3-2.1 5-4.2 5.5-2.1-.5-4.2-2.5-4.2-5.5z"/>',
  weed: `<path class="l" d="M12 21v-8.5M4 21.5h16"/>${LEAVES_STEN}`,
  plus: '<path class="l" d="M12 5v14M5 12h14"/>',
  minus: '<path class="l" d="M5 12h14"/>',
  ale: '<path d="M5.5 6h10v14.5h-10z"/><path d="M5 3.5h11v2.2H5z"/><path class="l" d="M16 9.5h2c1.8 0 1.8 6 0 6h-2"/>',
};
const actIcon = (k) =>
  stencil(svgIcon(24, 24, ACT_PATHS[k] || ACT_PATHS.hoe, ICON_STROKE), ACT_PATHS[k] ? ACT_STEN[k] : ACT_STEN.hoe);
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
  mend: 'fence',
  workfence: 'fence',
  plow: 'hoe',
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
  // a crop each (VB-355): rye's ear is slim and awned beside barley's (the grain icon); a pod of peas; fallow, the resting ground
  rye: '<path d="M12 21V7M12 7l-1.3-4M12 7l1.3-4M12 10.5l-3-3.5M12 10.5l3-3.5M12 14l-3-3.5M12 14l3-3.5M12 17.5l-3-3.5M12 17.5l3-3.5"/>',
  peas:
    '<path d="M4 16c1-7 8-11 16-10-1 8-6 13-13 13-1.5 0-2.5-1.5-3-3z"/><circle cx="9.3" cy="14.2" r="1.5"/>' +
    '<circle cx="12.8" cy="11.5" r="1.5"/><circle cx="16" cy="8.8" r="1.3"/>',
  fallow: '<path d="M3 15c3-2 6-2 9 0s6 2 9 0M3 19c3-2 6-2 9 0s6 2 9 0M7 11l1-3M8 11l1.5-2M16 11l-1-3M15 11l-1.5-2"/>',
  flour: ACT_PATHS.sack,
  meals: ACT_PATHS.pot,
  sheaves: '<path d="M8 21l2-9M16 21l-2-9M12 21v-9M7 12h10M10 12L7 4M12 12V3M14 12l3-8M9 12L4 7M15 12l5-5"/>',
  hay: ACT_PATHS.hay,
  wood: '<circle cx="7" cy="16" r="3.5"/><circle cx="17" cy="16" r="3.5"/><circle cx="12" cy="8.5" r="3.5"/><path d="M7 16h.01M17 16h.01M12 8.5h.01"/>',
  tree: '<path d="M12 21v-5M12 3l-5 7h2.5L5.5 16h13L14.5 10H17z"/>',
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
  standing: '<path d="M4 18h16M5 15l-1-8 5 4 3-6 3 6 5-4-1 8z"/>',
  people:
    '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2.5-7 6-7s6 3 6 7M15.5 5.5a2.5 2.5 0 1 1 0 5M17.5 13.5c2 .7 3.5 3 3.5 6.5"/>',
  fence: '<path d="M5 21V6l1.5-2L8 6v15M11 21V6l1.5-2L14 6v15M17 21V6l1.5-2L20 6v15M3 10h18M3 16h18"/>',
  cold: '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5"/>',
  soil: '<path d="M3 13c3-2 6-2 9 0s6 2 9 0M3 18c3-2 6-2 9 0s6 2 9 0M12 10V4M12 6c-2 0-3-1-3-3M12 7c2 0 3-1 3-3"/>',
  heir: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M14.5 8.5l2 2"/>',
  // two hearts, the one behind the other: a pair that courts (VB-036)
  courting:
    '<path d="M9.5 18c-3.8-2.6-6-4.9-6-7.5a3.1 3.1 0 0 1 6-1.3 3.1 3.1 0 0 1 6 1.3c0 2.6-2.2 4.9-6 7.5z"/>' +
    '<path d="M15.2 6.6a3 3 0 0 1 5.3 1.9c0 2.6-2.2 4.9-6 7.5"/>',
  holder: ACT_PATHS.home,
  // a pawn's mood and its modifiers for an event (VB-062): a face; two rings; a swaddled child; a falling tear
  mood: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14.5c2 2 5 2 7 0M9 9.5h.01M15 9.5h.01"/>',
  married: '<circle cx="9" cy="13" r="5"/><circle cx="15" cy="13" r="5"/><path d="M10.5 6l1.5-2.5L13.5 6"/>',
  child:
    '<circle cx="12" cy="6.5" r="3"/><path d="M8 11c0-1 1.5-1.5 4-1.5s4 .5 4 1.5v6c0 2.5-1.5 3.5-4 3.5s-4-1-4-3.5zM8 14h8"/>',
  grieving:
    '<circle cx="12" cy="10" r="7"/><path d="M8.5 13c2-1.5 5-1.5 7 0M9 8.5h.01M15 8.5h.01M16.5 12c1 2 1.5 3 1.5 4a1.5 1.5 0 0 1-3 0c0-1 .5-2 1.5-4z"/>',
  friend:
    '<circle cx="7.5" cy="8" r="2.5"/><circle cx="16.5" cy="8" r="2.5"/><path d="M3 19c0-3.5 2-6 4.5-6s4.5 2.5 4.5 6M12 19c0-3.5 2-6 4.5-6s4.5 2.5 4.5 6"/>',
  tile: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/>',
  // ale (VB-698's made good): a tankard; the household's plan (VB-256): a list of what is to be done, ticked
  ale: '<path d="M5 6h10v14H5zM15 9h2.5a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H15M5 9.5h10M8 6V4.5h4V6"/>',
  plan: '<path d="M6 3h12v18H6zM9 8l1.2 1.2L12.5 7M14 8.5h2M9 13l1.2 1.2 2.3-2.2M14 13.5h2M9 18h7"/>',
};
// The same goods and measures as stencils (VB-1163), by GOOD_PATHS' keys.
const HEART_STEN =
  'M12 20.5C5 15.5 3 12 3 8.8 3 6 5 4.2 7.3 4.2c1.9 0 3.6 1.1 4.7 3 1.1-1.9 2.8-3 4.7-3C19 4.2 21 6 21 8.8c0 3.2-2 6.7-9 11.7z';
const CHILD_STEN =
  '<circle cx="12" cy="6.3" r="3.2"/><path d="M8 11.5c0-1.2 1.5-1.8 4-1.8s4 .6 4 1.8v6c0 2.7-1.5 3.8-4 3.8s-4-1.1-4-3.8z"/>' +
  '<path class="c" d="M8 14.5h8"/>';
const RINGS_STEN =
  '<circle class="l" cx="9" cy="13.5" r="4.8"/><circle class="l" cx="15" cy="13.5" r="4.8"/><path d="M10.5 6.5l1.5-3 1.5 3z"/>';
const COLD_STEN =
  '<path class="l" d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5"/>';
const GOOD_STEN = {
  grain:
    '<path class="l" d="M12 22V8"/><path d="M12 2.8c1.7 1.5 1.7 3.6 0 5.1-1.7-1.5-1.7-3.6 0-5.1z"/>' +
    '<path d="M11.2 9.4c-2.3.2-3.8-1.1-4.1-3.2 2.3-.2 3.8 1.1 4.1 3.2z"/>' +
    '<path d="M12.8 9.4c2.3.2 3.8-1.1 4.1-3.2-2.3-.2-3.8 1.1-4.1 3.2z"/>' +
    '<path d="M11.2 13.6c-2.3.2-3.8-1.1-4.1-3.2 2.3-.2 3.8 1.1 4.1 3.2z"/><path d="M12.8 13.6c2.3.2 3.8-1.1 4.1-3.2-2.3-.2-3.8 1.1-4.1 3.2z"/>' +
    '<path d="M11.2 17.8c-2.3.2-3.8-1.1-4.1-3.2 2.3-.2 3.8 1.1 4.1 3.2z"/><path d="M12.8 17.8c2.3.2 3.8-1.1 4.1-3.2-2.3-.2-3.8 1.1-4.1 3.2z"/>',
  seed: ACT_STEN.sow,
  flour: ACT_STEN.sack,
  meals: ACT_STEN.pot,
  sheaves:
    '<path d="M12 12.5C8 10 6.5 6.5 6.5 3 9.5 4 11.5 6 12 9c.5-3 2.5-5 5.5-6 0 3.5-1.5 7-5.5 9.5z"/>' +
    '<path d="M10.5 12.5h3l4.5 9H6z"/><path class="c" d="M9 15.5h6"/>',
  hay: ACT_STEN.hay,
  wood:
    '<circle cx="7.5" cy="16.5" r="4.2"/><circle cx="16.5" cy="16.5" r="4.2"/><circle cx="12" cy="8.7" r="4.2"/>' +
    '<circle class="c" cx="7.5" cy="16.5" r="1.5"/><circle class="c" cx="16.5" cy="16.5" r="1.5"/><circle class="c" cx="12" cy="8.7" r="1.5"/>',
  tree: '<path class="l" d="M12 21v-5"/><path d="M12 2.8l-5.5 7.7h3L5 16.5h14l-4.5-6h3z"/>',
  stone: '<path d="M4 18l2-7 5-4 6 1 3 6-2 4z"/><path class="c" d="M11 7l1 5 6 2M12 12l-6 1"/>',
  clay: '<path d="M3.5 9.5h11V16h-11z"/><path d="M3.5 9.5l5-3h11l-5 3z"/><path d="M14.5 9.5l5-3V13l-5 3z"/>',
  ore: '<path d="M5 19l-1-6 4-6 6-2 5 4 1 7-4 3z"/><path class="c" d="M8 7l3 5-2 6M11 12l6-1"/>',
  peat: '<rect x="3" y="15" width="8" height="5.5"/><rect x="13" y="15" width="8" height="5.5"/><rect x="8" y="8.5" width="8" height="5.5"/>',
  wool:
    '<path d="M7 18.5a4.2 4.2 0 0 1-1-8.2A4.2 4.2 0 0 1 12 6.8a4.2 4.2 0 0 1 6 3.5 4.2 4.2 0 0 1-1 8.2z"/>' +
    '<path class="c" d="M8 13.5c1-1.5 2.5-1.5 3.200 0M12.800 15c1-1.5 2.5-1.5 3.200 0M11 10.5c.8-1.200 2-1.200 2.700 0"/>',
  fish: ACT_STEN.fish,
  tar: '<path d="M7 3.5h10c1.7 3.2 1.7 13.8 0 17H7c-1.7-3.2-1.7-13.8 0-17z"/><path class="c" d="M5.9 9h12.2M5.9 15h12.2"/>',
  water: ACT_STEN.water,
  cart:
    '<path d="M2.5 7.5h14L18 14H4.5z"/><path class="l" d="M18 14l3.5-7"/><circle cx="9.5" cy="17.5" r="3.5"/>' +
    '<circle class="c" cx="9.5" cy="17.5" r="1"/>',
  boat: '<path d="M2.5 14.5h19l-3.2 5.5H5.7z"/><path d="M12.8 13V3.5l6.2 9.5z"/><path class="l" d="M10.8 13.5V4"/>',
  quern: ACT_STEN.quern,
  meat:
    '<path d="M14 3.5c4.2 0 6.5 3.2 6.5 6.5 0 4.3-4.3 7.5-9.5 6.5l-3.2 3.2-2.3-.5-.5-2.3 3.2-3.2C7 9 10 3.5 14 3.5z"/>' +
    '<circle class="c" cx="14" cy="9.5" r="1.6"/>',
  butter: '<path d="M7 10h10l-1 11H8z"/><path class="c" d="M7.5 14.5h9"/><path class="l" d="M12 9V3M9.5 3h5"/>',
  milk: ACT_STEN.pail,
  field: '<path d="M2.5 19.5l4.2-14h10.6l4.2 14z"/><path class="c" d="M10 5.5l-2 14M14 5.5l2 14M5 12.5h14"/>',
  meadow:
    '<path class="l" d="M3 20.5h18M6 19.5c0-3.5-1-5.5-2-7.5M9 19.5c0-5 1-8 2-10M13 19.5c0-4 .5-6.5 2.5-9.5M17.5 19.5c0-3 1-5 2.5-6.5"/>',
  beast: '<path d="M4 9l2-3 1 2h8l3-2 2 2-1 3v3l-1 5h-2l-.5-4H9.5L9 19H7l-1-5c-1.5-1-2-3-2-5z"/>',
  health: `<path d="${HEART_STEN}"/>`,
  hunger: '<path d="M3 11h18c0 5.2-4 8.8-9 8.8S3 16.2 3 11z"/><path class="l" d="M12 3.5v4M8.3 5v2.5M15.7 5v2.5"/>',
  standing: '<path d="M3.5 19L2.3 8l5.2 4.2L12 5l4.5 7.2L21.7 8l-1.2 11z"/><path class="c" d="M4.5 16h15"/>',
  people: PEOPLE_STEN,
  fence:
    '<path class="l" d="M3 10.5h18M3 16.5h18"/><path d="M4.5 21V6.5L6.2 4l1.7 2.5V21z"/><path d="M10.3 21V6.5L12 4l1.7 2.5V21z"/>' +
    '<path d="M16.1 21V6.5L17.8 4l1.7 2.5V21z"/>',
  cold: COLD_STEN,
  soil:
    '<path class="l" d="M3 14c3-2 6-2 9 0s6 2 9 0M3 19c3-2 6-2 9 0s6 2 9 0M12 10.5V5"/>' +
    '<path d="M12 7C9.5 7 8.5 5.8 8.5 3.5 11 3.5 12 4.7 12 7z"/><path d="M12 8.5c2.5 0 3.5-1.2 3.5-3.5C13 5 12 6.2 12 8.5z"/>',
  heir: '<path class="l" d="M11.5 12L20 3.5M17 6.5L19.5 9M14.5 9l2 2"/><circle cx="8" cy="15.5" r="4.5"/><circle class="c" cx="8" cy="15.5" r="1.5"/>',
  holder: ACT_STEN.home,
  mood: '<circle cx="12" cy="12" r="8.7"/><path class="c" d="M8.3 14.2c2 2.2 5.4 2.2 7.4 0M9 9.4v1.2M15 9.4v1.2"/>',
  married: RINGS_STEN,
  child: CHILD_STEN,
  grieving:
    '<circle cx="12" cy="10.5" r="7.5"/><path class="c" d="M8.5 13.5c2-1.5 5-1.5 7 0M9 8.3v1.2M15 8.3v1.2"/>' +
    '<path d="M17.5 14c1.2 2.2 1.8 3.3 1.8 4.5a1.8 1.8 0 0 1-3.6 0c0-1.2.6-2.3 1.8-4.5z"/>',
  friend:
    '<path d="M2.5 20c0-4 2.2-6.8 5-6.8s5 2.8 5 6.8z"/><path d="M11.5 20c0-4 2.2-6.8 5-6.8s5 2.8 5 6.8z"/>' +
    '<circle cx="7.5" cy="7.5" r="2.8"/><circle cx="16.5" cy="7.5" r="2.8"/>',
  tile: '<path d="M12 2.5l8.5 4.8v9.4L12 21.5l-8.5-4.8V7.3z"/>',
  ale: ACT_STEN.ale,
  plan:
    '<path d="M5.5 2.5h13v19h-13z"/>' +
    '<path class="c" d="M8.5 8l1.3 1.3L12.3 7M14 8.5h2.5M8.5 13.5l1.3 1.3 2.5-2.3M14 14h2.5M8.5 18.5h8"/>',
};
const goodIcon = (k) =>
  stencil(
    svgIcon(24, 24, GOOD_PATHS[k] || GOOD_PATHS.tile, ICON_STROKE),
    GOOD_PATHS[k] ? GOOD_STEN[k] : GOOD_STEN.tile,
  );
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
  stencil(
    svgIcon(
      14,
      14,
      SEASON_PATHS[((k % 4) + 4) % 4],
      ' fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"',
    ),
    SEASON_STEN[((k % 4) + 4) % 4],
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
const traitIcon = (k) => stencil(svgIcon(24, 24, TRAIT_PATHS[k], ICON_STROKE), TRAIT_STEN[k]);
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
const bondIcon = (k) => stencil(svgIcon(24, 24, BOND_PATHS[k], ICON_STROKE), BOND_STEN[k]);
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
const stateIcon = (k) => stencil(svgIcon(24, 24, STATE_PATHS[k], ICON_STROKE), STATE_STEN[k]);
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
};
const OCCASION_STEN = {
  meeting: TRAIT_STEN.sociability,
  rite: TRAIT_STEN.piety,
  wedding: RINGS_STEN,
  funeral: GOOD_STEN.grieving,
  ale: ACT_STEN.ale,
  call: TRAIT_STEN.sociability,
  gathering: TRAIT_STEN.sociability,
};
const occasionIcon = (k) => stencil(svgIcon(24, 24, OCCASION_PATHS[k], ICON_STROKE), OCCASION_STEN[k]);
for (const k of ['me', 'home', 'village', 'queue']) ICON['act-' + k] = actIcon(k);
// A button marked data-icon="name" takes that icon before its content (a dock button keeps its label under it).
for (const b of document.querySelectorAll('[data-icon]')) b.insertAdjacentHTML('afterbegin', ICON[b.dataset.icon]);
// A tab marked data-good="name" takes that good's icon before its word (the household's tabs, VB-664).
for (const b of document.querySelectorAll('[data-good]')) b.insertAdjacentHTML('afterbegin', goodIcon(b.dataset.good));
