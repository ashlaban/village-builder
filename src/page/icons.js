// @sys page/icons: the interface's icons (VB-324), inline SVG drawn in currentColor, so a button's colour and pressed state colour its icon
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
    // the dock (11 Nov): two people, a family tree, a scroll of customs, the menu's three lines; the played pawn's actions, a game pawn
    people: svgIcon(20, 20, '<circle cx="7.5" cy="6.5" r="2.8"/><path d="M2.5 17c0-3.2 2.2-5.4 5-5.4s5 2.2 5 5.4"/>'
      + '<circle cx="14" cy="7.5" r="2.3"/><path d="M14 11.7c2.2 0 3.7 2 3.7 4.8"/>', ICON_STROKE),
    family: svgIcon(20, 20, '<rect x="7.5" y="2" width="5" height="4" rx="1"/><rect x="2" y="14" width="5" height="4" rx="1"/>'
      + '<rect x="13" y="14" width="5" height="4" rx="1"/><path d="M10 6v4M4.5 14v-4h11v4"/>', ICON_STROKE),
    customs: svgIcon(20, 20, '<rect x="3" y="2.5" width="14" height="3" rx="1.5"/><rect x="3" y="14.5" width="14" height="3" rx="1.5"/>'
      + '<path d="M5 5.5v9M15 5.5v9M7.5 8.5h5M7.5 11.5h5"/>', ICON_STROKE),
    menu: svgIcon(20, 20, '<path d="M3 5.5h14M3 10h14M3 14.5h14"/>', ICON_STROKE),
    pawn: svgIcon(20, 20, '<circle cx="10" cy="5" r="2.6"/><path d="M8.2 7.8h3.6l1.4 7H6.8Z"/><rect x="5" y="14.8" width="10" height="2.7" rx="1"/>',
      ICON_STROKE),
    // the panels' heads: close, and a chevron that points down while the panel is open (to fold it) and up while it is folded
    close: svgIcon(16, 16, '<path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/>', ICON_STROKE),
    chevron: svgIcon(16, 16, '<path d="M3.5 6l4.5 4.5L12.5 6"/>', ICON_STROKE),
  };
  // A button marked data-icon="name" takes that icon before its content (a dock button keeps its label under it).
  for (const b of document.querySelectorAll('[data-icon]')) b.insertAdjacentHTML('afterbegin', ICON[b.dataset.icon]);
