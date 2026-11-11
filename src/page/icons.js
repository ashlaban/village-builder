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
  // The action bar (VB-341), 24 by 24 as drawn for the mock-up (docs/mockups/action-menu.html): its groups, its rows, and a job kind's tool.
  const ACT_PATHS = {
    me: '<circle cx="12" cy="6" r="3"/><path d="M6 21c0-5 2.5-9 6-9s6 4 6 9z"/>',
    home: '<path d="M4 11l8-7 8 7M6 10v9h12v-9M10 19v-5h4v5"/>',
    village: '<circle cx="12" cy="6" r="2.2"/><circle cx="6" cy="16" r="2.2"/><circle cx="18" cy="16" r="2.2"/>'
      + '<path d="M12 8.5v3M8 14.5l2.5-2M16 14.5l-2.5-2"/>',
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
    back: '<path d="M14 6l-6 6 6 6"/>', next: '<path d="M10 6l6 6-6 6"/>', no: '<path d="M6 6l12 12M18 6L6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
  };
  const actIcon = (k) => svgIcon(24, 24, ACT_PATHS[k] || ACT_PATHS.hoe, ICON_STROKE);
  // a job kind's icon (sim/kinds); a kind not named here takes the hoe
  const KIND_ICON = { sow: 'sow', gather: 'sow', reap: 'mow', mow: 'mow', rake: 'mow', haul: 'hay', hay: 'hay', fodder: 'hay', wood: 'chop',
    fell: 'chop', grub: 'chop', timber: 'chop', pick: 'build', quarry: 'build', raise: 'build',
    water: 'water', cook: 'pot', brew: 'pot', thresh: 'sack', salt: 'sack', slaughter: 'sack', milk: 'pail',
    restore: 'build', foundation: 'build', walls: 'build', roof: 'build', mend: 'build', repair: 'build', fish: 'fish' };
  for (const k of ['me', 'home', 'village', 'queue']) ICON['act-' + k] = actIcon(k);
  // A button marked data-icon="name" takes that icon before its content (a dock button keeps its label under it).
  for (const b of document.querySelectorAll('[data-icon]')) b.insertAdjacentHTML('afterbegin', ICON[b.dataset.icon]);
