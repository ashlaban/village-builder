// @sys page/icons: the interface's icons (VB-324), inline SVG drawn in currentColor, so a button's colour and pressed state colour its icon
  const svgIcon = (w, h, body, attrs = '') =>
    `<svg class="ico" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true" focusable="false"${attrs}>${body}</svg>`;
  const ICON_STROKE = ' fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
  // A speed is one to five play arrows (11 Nov: no numbers): 1×, 3×, 10×, 30× and uncapped. Infinity is the uncapped speed.
  const SPEED_ARROWS = { 1: 1, 3: 2, 10: 3, 30: 4, Infinity: 5 };
  function speedIcon(v) {
    const n = SPEED_ARROWS[v] || 1, step = 6, w = step * (n - 1) + 8;
    let d = '';
    for (let k = 0; k < n; k++) d += `M${k * step} 1L${k * step + 8} 7L${k * step} 13Z`;
    return svgIcon(w, 14, `<path d="${d}" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>`);
  }
  const ICON = {
    pause: svgIcon(14, 14, '<rect x="2" y="1" width="3.5" height="12" rx="1" fill="currentColor"/>'
      + '<rect x="8.5" y="1" width="3.5" height="12" rx="1" fill="currentColor"/>'),
    play: svgIcon(14, 14, '<path d="M3 1L12 7L3 13Z" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>'),
    // the interface shown: an eye struck through, to hide it; hidden: an open eye, to show it again
    eye: svgIcon(20, 20, '<path d="M1.5 10S5 4 10 4s8.5 6 8.5 6-3.5 6-8.5 6S1.5 10 1.5 10Z"/><circle cx="10" cy="10" r="2.6"/>', ICON_STROKE),
    eyeOff: svgIcon(20, 20, '<path d="M1.5 10S5 4 10 4s8.5 6 8.5 6-3.5 6-8.5 6S1.5 10 1.5 10Z"/><circle cx="10" cy="10" r="2.6"/><path d="M3 17L17 3"/>',
      ICON_STROKE),
  };
