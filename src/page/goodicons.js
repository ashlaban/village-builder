// @sys page/goodicons: the icons of goods and measures in the panels (VB-664, VB-1589), one icon a kind wherever it is shown, in line and in stencil
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
  drawings(svgIcon(24, 24, GOOD_PATHS[k] || GOOD_PATHS.tile, ICON_STROKE), {
    stencil: GOOD_PATHS[k] ? GOOD_STEN[k] : GOOD_STEN.tile,
  });
