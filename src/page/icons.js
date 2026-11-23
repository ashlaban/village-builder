// @sys page/icons: the interface's icons (VB-338), inline SVG drawn in currentColor, so a button's colour and pressed state colour its icon
const svgIcon = (w, h, body, attrs = '') =>
  `<svg class="ico" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true" focusable="false"${attrs}>${body}</svg>`;
const ICON_STROKE =
  ' fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
// The icon sets (VB-1162, VB-1533): a set is a way of drawing the interface's icons, and a theme names the set it shows (page/options,
// THEMES' icons, put on the root as data-icons). Each drawing an icon has is in its markup under its set's name, data-set="<name>", and
// src/head.html shows the root's set by one rule a set, so a change of theme redraws nothing. line is the drawing every icon has, the
// SVG as svgIcon makes it, and the one shown where an icon has no drawing of the set asked for. The others are drawn on a 24 box and
// scaled to their icon's. A third set: docs/architecture/modules.md, Adding things.
const ICON_SETS = {
  line: 'strokes in currentColor',
  stencil:
    "the mural's, as the stencilled marks of a painted vault: flat shapes in one pigment, held apart by gaps; filled, but for those " +
    'of class "l" (a line in the pigment: a handle, a stem) and "c" (a cut through a shape, in the colour of the ground)',
};
// An icon with its drawings in the other sets beside its line one: sets maps a set's name to its shapes; a set left out, or empty,
// falls back to line.
function drawings(svg, sets, box = 24) {
  for (const s of Object.keys(sets)) if (!ICON_SETS[s] || s === 'line') throw new Error(`page/icons: no icon set ${s}`);
  const own = Object.keys(ICON_SETS).filter((s) => sets[s]);
  if (!own.length) return svg;
  const at = svg.indexOf('>') + 1,
    k = +/viewBox="0 0 \S+ (\S+)"/.exec(svg)[1] / box,
    scale = k === 1 ? '' : ` transform="scale(${+k.toFixed(4)})"`;
  return (
    `${svg.slice(0, at)}<g data-set="line">${svg.slice(at, -6)}</g>` +
    own.map((s) => `<g data-set="${s}"${scale}>${sets[s]}</g>`).join('') +
    '</svg>'
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
  return drawings(
    svgIcon(
      w,
      14,
      `<path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    ),
    { stencil: sten },
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
  fertility: svgIcon(
    20,
    20,
    '<path d="M10 17.5V8.5M10 11C6.5 11 4.5 9 4.5 5.5 8 5.5 10 7.5 10 11ZM10 9.5c0-3 2-5 5.5-5 0 3.5-2 5-5.5 5ZM3 17.5h14"/>',
    ICON_STROKE,
  ), // a sprout in the earth: how good a field is
  freshwater: svgIcon(
    20,
    20,
    '<path d="M10 2.5c2.5 4.2 5 6.7 5 9.3a5 5 0 0 1-10 0c0-2.6 2.5-5.1 5-9.3z"/>',
    ICON_STROKE,
  ), // a drop: the walk to fresh water
  woodland: svgIcon(20, 20, '<path d="M10 2.5l5.5 9h-11ZM10 11.5v6"/>', ICON_STROKE), // a tree: the woods standing
  wildfood: svgIcon(
    20,
    20,
    '<circle cx="6.5" cy="13" r="3"/><circle cx="13.5" cy="13" r="3"/><path d="M10 10V3.5M10 6.5l3.5-2"/>',
    ICON_STROKE,
  ), // berries on a stem
  grazing: svgIcon(
    20,
    20,
    '<path d="M3 16.5h14M5 16.5c0-3 1-5 2-6M8.5 16.5c0-4 .5-7 1.5-9M12 16.5c0-3 1-5.5 2.5-7"/>',
    ICON_STROKE,
  ), // tufts of grass
  wear: svgIcon(
    20,
    20,
    '<path d="M4 17.5c2-4 7-3 7-7s4-5 5-7.5"/><path d="M7.5 17.5c2-3 6.5-3 6.5-6.5" stroke-dasharray="1.5 2"/>',
    ICON_STROKE,
  ), // a way worn, a track beside it
  // three sheets one over another: the map's overlays (VB-1496), on the overlay button while none is on
  layers: svgIcon(
    20,
    20,
    '<path d="M2.5 6.5L10 3l7.5 3.5L10 10ZM2.5 10l7.5 3.5 7.5-3.5M2.5 13.5L10 17l7.5-3.5"/>',
    ICON_STROKE,
  ),
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
  fertility:
    '<path class="l" d="M12 21V10M3 21h18"/><path d="M12 13C7.5 13 5 10.5 5 6c4.5 0 7 2.5 7 7zM12 11c0-4 2.5-6.5 7-6.5 0 4.5-2.5 6.5-7 6.5z"/>',
  freshwater:
    '<path d="M12 2.5c3.2 5.3 6.5 8.5 6.5 11.8a6.5 6.5 0 0 1-13 0c0-3.3 3.3-6.5 6.5-11.8z"/><path class="c" d="M9 15c.3 1.5 1.3 2.5 2.8 2.8"/>',
  woodland: '<path d="M12 2.5l7 11.5H5z"/><path class="l" d="M12 14v7.5"/>',
  wildfood:
    '<circle cx="7.5" cy="16" r="4"/><circle cx="16.5" cy="16" r="4"/><path class="l" d="M12 12V3.5M12 7.5l4.5-2.5"/>',
  grazing: '<path class="l" d="M3 20.5h18M6 20c0-4 1.2-6.5 2.5-8M10.5 20c0-5 .6-9 2-11.5M15 20c0-4 1.2-7 3-9"/>',
  wear: '<path class="l" d="M4.5 21c2.5-5 8.5-3.5 8.5-8.5s5-6 6.5-9.5"/><circle cx="9" cy="20" r="1.3"/><circle cx="14.5" cy="16" r="1.3"/>',
  layers: '<path d="M3 7.5L12 3l9 4.5-9 4.5z"/><path class="l" d="M3 12l9 4.5 9-4.5M3 16.5l9 4.5 9-4.5"/>',
  bell: '<path d="M6 16.5v-6a6 6 0 0 1 12 0v6l2 2H4z"/><circle cx="12" cy="20.8" r="1.6"/>',
  minimap: '<path d="M3 6l6-2.5 6 2.5 6-2.5V18l-6 2.5L9 18l-6 2.5z"/><path class="c" d="M9 3.5V18M15 6v14.5"/>',
  close: '<path class="l" d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  chevron: '<path class="l" d="M5.5 9l6.5 6.5L18.5 9"/>',
};
for (const k of Object.keys(ICON_STEN)) ICON[k] = drawings(ICON[k], { stencil: ICON_STEN[k] });
