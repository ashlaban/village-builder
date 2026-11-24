// @sys page/kindicons: the icons of the acts and the job kinds (VB-341, VB-1589): the action bar's groups and rows and a kind's tool, in line and in stencil
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
  drawings(svgIcon(24, 24, ACT_PATHS[k] || ACT_PATHS.hoe, ICON_STROKE), {
    stencil: ACT_PATHS[k] ? ACT_STEN[k] : ACT_STEN.hoe,
  });
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
  drink: 'water',
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
  smelt: 'build',
  mendtools: 'build',
  cobble: 'build',
  harness: 'build',
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
