// @sys page/icons: the interface's icons (VB-338), inline SVG drawn in currentColor, so a button's colour and pressed state colour its icon
  const svgIcon = (w, h, body, attrs = '') =>
    `<svg class="ico" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true" focusable="false"${attrs}>${body}</svg>`;
  const ICON_STROKE = ' fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
  // A speed is one to five chevrons, > to >>>>> (11 Nov: no numbers): 1×, 3×, 10×, 30× and uncapped (Infinity). Open chevrons, so that
  // the speed of 1× is not the filled triangle of play beside it.
  const SPEED_ARROWS = { 1: 1, 3: 2, 10: 3, 30: 4, Infinity: 5 };
  function speedIcon(v) {
    const n = SPEED_ARROWS[v] || 1, step = 5.5, w = step * (n - 1) + 8;
    let d = '';
    for (let k = 0; k < n; k++) d += `M${1.5 + k * step} 2L${6.5 + k * step} 7L${1.5 + k * step} 12`;
    return svgIcon(w, 14, `<path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`);
  }
  const ICON = {
    pause: svgIcon(14, 14, '<rect x="2" y="1" width="3.5" height="12" rx="1" fill="currentColor"/>'
      + '<rect x="8.5" y="1" width="3.5" height="12" rx="1" fill="currentColor"/>'),
    skip: svgIcon(14, 14, '<path d="M2 1.5L9.5 7L2 12.5Z" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>'
      + '<rect x="10.5" y="1.5" width="2.5" height="11" rx="1" fill="currentColor"/>'),
    play: svgIcon(14, 14, '<path d="M3 1L12 7L3 13Z" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>'),
    // the interface shown: an eye struck through, to hide it; hidden: an open eye, to show it again
    eye: svgIcon(20, 20, '<path d="M1.5 10S5 4 10 4s8.5 6 8.5 6-3.5 6-8.5 6S1.5 10 1.5 10Z"/><circle cx="10" cy="10" r="2.6"/>', ICON_STROKE),
    eyeOff: svgIcon(20, 20, '<path d="M1.5 10S5 4 10 4s8.5 6 8.5 6-3.5 6-8.5 6S1.5 10 1.5 10Z"/><circle cx="10" cy="10" r="2.6"/><path d="M3 17L17 3"/>',
      ICON_STROKE),
    // the dock (11 Nov): two people, a family tree, a scroll of customs, a bug for Debug; the played pawn's actions, a game pawn. The main
    // menu, at the top bar's end, is three lines.
    people: svgIcon(20, 20, '<circle cx="7.5" cy="6.5" r="2.8"/><path d="M2.5 17c0-3.2 2.2-5.4 5-5.4s5 2.2 5 5.4"/>'
      + '<circle cx="14" cy="7.5" r="2.3"/><path d="M14 11.7c2.2 0 3.7 2 3.7 4.8"/>', ICON_STROKE),
    family: svgIcon(20, 20, '<rect x="7.5" y="2" width="5" height="4" rx="1"/><rect x="2" y="14" width="5" height="4" rx="1"/>'
      + '<rect x="13" y="14" width="5" height="4" rx="1"/><path d="M10 6v4M4.5 14v-4h11v4"/>', ICON_STROKE),
    customs: svgIcon(20, 20, '<rect x="3" y="2.5" width="14" height="3" rx="1.5"/><rect x="3" y="14.5" width="14" height="3" rx="1.5"/>'
      + '<path d="M5 5.5v9M15 5.5v9M7.5 8.5h5M7.5 11.5h5"/>', ICON_STROKE),
    menu: svgIcon(20, 20, '<path d="M3 5.5h14M3 10h14M3 14.5h14"/>', ICON_STROKE),
    pawn: svgIcon(20, 20, '<circle cx="10" cy="5" r="2.6"/><path d="M8.2 7.8h3.6l1.4 7H6.8Z"/><rect x="5" y="14.8" width="10" height="2.7" rx="1"/>',
      ICON_STROKE),
    bug: svgIcon(20, 20, '<path d="M7 7.5a3 3 0 0 1 6 0"/><rect x="6" y="7.5" width="8" height="9.5" rx="4"/>'
      + '<path d="M10 9.5v7M6 10.5H3M14 10.5h3M6 14H3.5M14 14h2.5M7.5 5L6 3M12.5 5L14 3"/>', ICON_STROKE),
    // the map's bar under the minimap (11 Nov): the grid, the regions, the land held (a claim's flag), which notifications show, the minimap
    grid: svgIcon(20, 20, '<path d="M3 7h14M3 13h14M7 3v14M13 3v14"/>', ICON_STROKE),
    regions: svgIcon(20, 20, '<rect x="2.5" y="3" width="15" height="14" rx="2"/><path d="M9.5 3c-2 3 1.5 4.5-.5 7s1 4.5 0 7M9.2 10c3 1.2 5-1 8.3 0"/>',
      ICON_STROKE),
    land: svgIcon(20, 20, '<path d="M5 17.5V2.5M5 3.5h10l-2.5 3.25L15 10H5"/>', ICON_STROKE),
    bell: svgIcon(20, 20, '<path d="M5 14V9a5 5 0 0 1 10 0v5l1.5 1.5h-13Z"/><path d="M8.3 17.5a1.8 1.8 0 0 0 3.4 0"/>', ICON_STROKE),
    minimap: svgIcon(20, 20, '<path d="M2.5 5l5-2 5 2 5-2v12l-5 2-5-2-5 2Z"/><path d="M7.5 3v12M12.5 5v12"/>', ICON_STROKE),
    // the panels' heads: close, and a chevron that points down while the panel is open (to fold it) and up while it is folded
    close: svgIcon(16, 16, '<path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/>', ICON_STROKE),
    chevron: svgIcon(16, 16, '<path d="M3.5 6l4.5 4.5L12.5 6"/>', ICON_STROKE),
  };
  // A button marked data-icon="name" takes that icon before its content (a dock button keeps its label under it).
  for (const b of document.querySelectorAll('[data-icon]')) b.insertAdjacentHTML('afterbegin', ICON[b.dataset.icon]);
