// Plans-UI mocks: the shared scene, data and icon grammar (docs/mocks/plans-ui/README.md). Fake data, no game code.
// Load after icons.js. Everything here is a throwaway mock base; mocks may extend it in their own file.

// ---- Time: a year of 4 seasons x 12 days; a working day 6..18 (12 h). "Now" is autumn day 4, 10:00.
const NOW = { season: 'autumn', day: 4, hour: 10 };
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];


// ---- The household: Backa, five people. The player plays Per, the head (household first, Kim 25 Nov).
const PEOPLE = [
  { id: 'per', name: 'Per', age: 44, pos: 'head', levy: null, col: '#7a5530', played: true },
  { id: 'karin', name: 'Karin', age: 41, pos: 'head', levy: null, col: '#8a3d5c' },
  { id: 'erik', name: 'Erik', age: 20, pos: 'heir', levy: 10.5, col: '#2f6a8e', trait: 'diligent' },
  { id: 'nils', name: 'Nils', age: 17, pos: 'son', levy: 10.5, col: '#5b7a2a', trait: 'idle', wants: 'courting Lisa at Norrgård' },
  { id: 'anna', name: 'Anna', age: 12, pos: 'child', levy: 5, col: '#b0603a' },
];
// Autumn custom (levy-custom.md): an adult member 10.5 h a day of 12; a child of 7-13 7 h times its hands (0.7) = 5.

// ---- Today (autumn day 4): each member's list. h: [from, to] in hours; whose: a WHOSE key; breach: 'demanded' | 'taken'.
// state: done | doing | planned | risk | blocked. by: 'custom' (the rule) | 'per' (authored by the player) | 'kept'.
const TODAY = {
  per: [
    { kind: 'chop', what: 'Reap rye', at: 'long', h: [6, 12], whose: 'household', state: 'done', by: 'custom' },
    { kind: 'cart', what: 'Haul sheaves home', at: 'long', h: [13, 16], whose: 'household', state: 'doing', by: 'per' },
    { kind: 'hay', what: 'Fodder', at: 'home', h: [17, 18], whose: 'household', state: 'planned', by: 'custom', duty: true },
  ],
  karin: [
    { kind: 'pot', what: 'Cook', at: 'home', h: [6, 7], whose: 'household', state: 'done', by: 'custom', duty: true },
    { kind: 'pail', what: 'Milk', at: 'home', h: [7, 8], whose: 'household', state: 'done', by: 'custom', duty: true },
    { kind: 'sheaves', what: 'Bind sheaves', at: 'long', h: [8, 12], whose: 'household', state: 'done', by: 'custom' },
    { kind: 'pot', what: 'Cook', at: 'home', h: [12, 13], whose: 'household', state: 'planned', by: 'custom', duty: true },
    { kind: 'wool', what: 'Spin (beside the pot)', at: 'home', h: [13, 16], whose: 'household', state: 'planned', by: 'custom' },
    { kind: 'pail', what: 'Milk', at: 'home', h: [16, 17], whose: 'household', state: 'planned', by: 'custom', duty: true },
  ],
  erik: [
    { kind: 'chop', what: 'Reap rye', at: 'long', h: [6, 14], whose: 'household', state: 'doing', by: 'custom' },
    { kind: 'sheaves', what: 'Stook', at: 'long', h: [14, 16.5], whose: 'household', state: 'planned', by: 'custom' },
    { kind: 'sheaves', what: 'Stook (given)', at: 'long', h: [16.5, 18], whose: 'own', state: 'planned', by: 'custom', given: true },
  ],
  nils: [
    { kind: 'cart', what: 'Fetch the timber left at the wood', at: 'wood2', h: [6, 9], whose: 'household', state: 'done', by: 'custom', stray: true },
    { kind: 'wood', what: 'Cut firewood', at: 'home', h: [9, 11], whose: 'household', state: 'doing', by: 'custom' },
    { kind: 'chop', what: 'Reap rye', at: 'long', h: [11, 14], whose: 'household', state: 'planned', by: 'custom' },
    { kind: 'courting', what: 'Visit Norrgård (taken)', at: 'norr', h: [14, 16.5], whose: 'household', breach: 'taken', state: 'planned', by: 'custom' },
    { kind: 'cart', what: 'Haul before the rain (demanded)', at: 'long', h: [16.5, 18], whose: 'own', breach: 'demanded', state: 'planned', by: 'per' },
  ],
  anna: [
    { kind: 'beast', what: 'Mind the cattle', at: 'meadow', h: [7, 12], whose: 'household', state: 'doing', by: 'custom', duty: true, mind: true },
    { kind: 'water', what: 'Water', at: 'lake', h: [12, 13], whose: 'household', state: 'planned', by: 'custom', duty: true },
    { kind: 'idle', what: 'Own hours', at: 'home', h: [13, 18], whose: 'own', state: 'planned', by: 'custom' },
  ],
};

// ---- The task as a plan: Nils' firewood, cut last night on the road (the stray pile), worked out from the world (design 3.2).
const TASK_FIREWOOD = {
  goal: 'Firewood: 3 loads to the woodpile', owner: 'Backa', holder: 'nils',
  steps: [ // the method's steps, read backwards from the goal; done ones struck
    { prim: 'fetch', icon: 'cart', what: 'fetch the cart', at: 'home', done: true },
    { prim: 'go', icon: 'walk', what: 'go to the wood', at: 'wood2', done: true },
    { prim: 'load', icon: 'wood', what: 'load the timber lying there (a stray pile, ours)', at: 'wood2', done: true },
    { prim: 'haul', icon: 'cart', what: 'haul home', at: 'home', done: true },
    { prim: 'work', icon: 'wood', what: 'cut to firewood', at: 'home', now: true },
    { prim: 'work', icon: 'chop', what: 'fell 2 more trees', at: 'wood1' },
  ],
  history: 'Begun yesterday; cut by nightfall at the wood with 1 load felled, which lay there as a pile with our mark.',
};

// ---- Days ahead (autumn 5..10; 6 shown, 3 binding: 5, 6, 7). Duties, dated commitments, dated steps (from/by).
const DUTIES = { anna: ['beast', 'water'], karin: ['pot', 'pail'], erik: ['wood'] };
const AHEAD = [
  { id: 's1', kind: 'chop', what: 'Reap the barley', at: 'barley', from: 6, by: 9, hours: { lo: 30, mid: 36, hi: 44 }, who: [], state: 'risk', by_: 'per', short: 8, why: 'grain target' },
  { id: 's2', kind: 'quern', what: 'Thresh the rye', at: 'home', from: 8, by: 12, hours: { lo: 14, mid: 18, hi: 24 }, who: ['per', 'erik'], state: 'planned', by_: 'custom', why: 'grain target' },
  { id: 'l1', kind: 'fence', what: 'Village fence: our lot (2 adult-days)', at: 'fence', day: 6, who: ['erik'], whose: 'owed', named: true, levy: 'v1' },
  { id: 'l2', kind: 'fence', what: 'Village fence: 1 day still to name (by day 9)', at: 'fence', window: [1, 12], whose: 'owed', named: false, levy: 'v1' },
  { id: 'w1', kind: 'village', what: 'Work done together: the bridge (called by the alderman)', at: 'green', day: 9, who: ['per'], whose: 'owed', levy: 'v2' },
  { id: 'g1', kind: 'courting', what: "Nils' leave: the gathering", at: 'green', day: 8, who: ['nils'], whose: 'own', grant: true },
];
// The outer levies (obligation records with terms, design 3.3).
const LEVIES = {
  v1: { from: 'the village (the meeting)', what: 'fence mending', days: 2, window: [1, 12], lot: 'by fields', terms: { names: 'levied', notice: 3, substitute: true, commute: 3, carry: false, onBreach: 'memory + the meeting\'s fine' } },
  v2: { from: 'the alderman', what: 'the bridge, together', days: 1, window: [9, 9], terms: { names: 'together', notice: 3, substitute: true, commute: null, carry: false, onBreach: 'memory' } },
  e1: { from: 'the estate (Lord Sparre)', what: 'day labour at the manor', days: 3, window: [1, 12], season: 'winter', terms: { names: 'levier', notice: 1, substitute: false, commute: null, carry: true, onBreach: 'penalty, eviction' } },
};

// ---- Season (autumn): targets with hours still to do by Per's estimate, against the labour budget (members' levies less outer days).
const SEASON = {
  daysLeft: 8,
  budget: { levy: 2 * 10.5 * 8 + 5 * 8, heads: 2 * 12 * 8, outer: 3 * 8 }, // members' levies + the head pair's own choice - outer days
  targets: [
    { good: 'rye', name: 'Rye in the barn', have: 34, want: 60, left: { lo: 40, mid: 52, hi: 66 } },
    { good: 'oats', name: 'Barley in the barn', have: 0, want: 30, left: { lo: 30, mid: 36, hi: 44 } },
    { good: 'wood', name: 'Firewood for winter', have: 9, want: 20, left: { lo: 18, mid: 24, hi: 30 } },
    { good: 'hay', name: 'Hay', have: 28, want: 26, left: { lo: 0, mid: 0, hi: 0 } },
  ],
  windows: [ { kind: 'chop', what: 'rye harvest', from: 1, to: 6 }, { kind: 'chop', what: 'barley harvest', from: 5, to: 10 }, { kind: 'sow', what: 'winter rye sowing', from: 8, to: 12 } ],
};

// ---- Year: routines and lots, projects, aims.
const YEAR = {
  routines: [ { kind: 'fence', what: 'Fence mending', days: 2, season: 'autumn' }, { kind: 'green', what: 'Road lot', days: 1, season: 'spring' } ],
  projects: [ { kind: 'hoe', what: 'Clear the south field', at: 'clearing', season: 'spring', state: 'planned' } ],
  aims: [ { who: 'erik', kind: 'married', what: 'marry and take the farm' }, { who: 'nils', kind: 'courting', what: 'court Lisa at Norrgård' } ],
};

// ---- The map: pointy-top axial hexes. Each tile {q, r, t, name?}. t: terrain key below.
const TERRAIN = {
  grass: '#a9b77a', meadow: '#b7c47a', rye: '#d9b25a', ryecut: '#cfb98a', barley: '#cdbf63', forest: '#5d7a4a', lake: '#7fa7b5',
  yard: '#b8a47f', green: '#9fb46e', fallow: '#a89a72', rock: '#9a9888',
};
const PLACES = {
  home: { q: 3, r: 2, t: 'yard', name: 'Backa (home)' },
  long: { q: 4, r: 2, t: 'ryecut', name: 'Long field (rye, half cut)' },
  long2: { q: 5, r: 2, t: 'rye', name: 'Long field' },
  barley: { q: 4, r: 3, t: 'barley', name: 'Barley field' },
  meadow: { q: 2, r: 3, t: 'meadow', name: 'Low meadow' },
  wood1: { q: 1, r: 1, t: 'forest', name: 'Hagen wood' },
  wood2: { q: 1, r: 2, t: 'forest', name: 'Hagen wood (our pile)' },
  lake: { q: 2, r: 1, t: 'lake', name: 'The lake' },
  green: { q: 5, r: 0, t: 'green', name: 'Village green' },
  norr: { q: 6, r: 0, t: 'yard', name: 'Norrgård' },
  fence: { q: 6, r: 1, t: 'grass', name: 'The village fence' },
  clearing: { q: 3, r: 4, t: 'fallow', name: 'South field (to clear)' },
};
const COLS = 8, ROWS = 6;
function tiles() {
  const out = [], byKey = {};
  for (const [k, p] of Object.entries(PLACES)) byKey[p.q + ',' + p.r] = { ...p, key: k };
  const forest = new Set(['0,1', '0,2', '0,3', '1,3', '0,0', '1,0']), lake = new Set(['2,0', '3,0']);
  for (let r = 0; r < ROWS; r++)
    for (let q = 0; q < COLS; q++) {
      const k = q + ',' + r;
      out.push(byKey[k] || { q, r, t: forest.has(k) ? 'forest' : lake.has(k) ? 'lake' : r === 5 || q === 7 ? 'rock' : 'grass' });
    }
  return out;
}
const HEX = 52; // radius in px
function hexXY(q, r) { return { x: 70 + HEX * Math.sqrt(3) * (q + (r % 2) / 2), y: 70 + HEX * 1.5 * r }; }
const at = (key) => hexXY(PLACES[key].q, PLACES[key].r);
function hexPath(x, y, s = HEX) {
  let d = '';
  for (let i = 0; i < 6; i++) { const a = Math.PI / 180 * (60 * i - 30); d += (i ? 'L' : 'M') + (x + s * Math.cos(a)).toFixed(1) + ' ' + (y + s * Math.sin(a)).toFixed(1); }
  return d + 'Z';
}
// The terrain as SVG: hexes, a few marks (trees, stubble, stooks, the house). Returns an SVG string (no outer <svg>).
function mapSVG({ dim = 0 } = {}) {
  let s = '';
  for (const t of tiles()) {
    const { x, y } = hexXY(t.q, t.r);
    s += `<path d="${hexPath(x, y)}" fill="${TERRAIN[t.t]}" stroke="#00000018" stroke-width="1"/>`;
    if (t.t === 'forest') for (const [dx, dy] of [[-16, -8], [10, -14], [0, 10], [18, 8], [-14, 14]]) s += `<path d="M${x + dx} ${y + dy - 12}l7 14h-14z" fill="#3f5a33"/>`;
    if (t.t === 'rye' || t.t === 'barley') for (let i = -3; i <= 3; i++) s += `<path d="M${x - 30} ${y + i * 8}h60" stroke="#00000020" stroke-width="2"/>`;
    if (t.t === 'ryecut') { for (let i = -3; i <= 0; i++) s += `<path d="M${x - 30} ${y + i * 8}h60" stroke="#00000020" stroke-width="2"/>`; for (const dx of [-18, 0, 18]) s += `<path d="M${x + dx} ${y + 22}l-4 -12h8z" fill="#c9a24a" stroke="#8a6a2a" stroke-width=".8"/>`; }
    if (t.t === 'lake') s += `<path d="M${x - 20} ${y}q10 -6 20 0t20 0" stroke="#ffffff70" fill="none" stroke-width="2"/>`;
    if (t.key === 'home' || t.key === 'norr') s += `<path d="M${x - 16} ${y + 6}v-14l16 -12 16 12v14z" fill="#8a5a3a" stroke="#4a2f1e"/><path d="M${x - 20} ${y - 8}l20 -16 20 16" fill="none" stroke="#5a2f1e" stroke-width="4"/>`;
    if (t.key === 'green') s += `<circle cx="${x}" cy="${y}" r="10" fill="#7d9a52"/><path d="M${x} ${y - 22}v18" stroke="#6a4a2a" stroke-width="3"/>`;
    if (t.key === 'fence') s += `<path d="M${x - 40} ${y - 20}L${x + 40} ${y + 20}" stroke="#6a4a2a" stroke-width="3" stroke-dasharray="6 3"/>`;
  }
  if (dim) s += `<rect x="0" y="0" width="2000" height="2000" fill="#fff" opacity="${dim}"/>`;
  return s;
}
const MAP_W = 70 * 2 + HEX * Math.sqrt(3) * (COLS + 0.5), MAP_H = 70 * 2 + HEX * 1.5 * (ROWS - 1);

// A pawn on the map: a small figure in its own colour.
function pawnSVG(p, x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><circle cy="-14" r="5" fill="${p.col}" stroke="#2a2018" stroke-width="1"/>` +
    `<path d="M-6 6c0-9 2-14 6-14s6 5 6 14z" fill="${p.col}" stroke="#2a2018" stroke-width="1"/></g>`;
}

// ---- The icon grammar, v2 (round 1's review, review-round1.md; the owner's yes of 25 Nov). One channel, one meaning:
//   glyph = what.
//   frame = how settled, three shapes: 'now' (disc: being done), 'plan' (rounded square: planned or dated), 'target' (shield: a
//           target or an aim). How far ahead is carried by where the icon stands on a time axis, not by its shape.
//   whose = whose hours, encoded twice, by fill and by rim: household (amber fill, plain dark rim); own (pale fill, double teal rim);
//           owed to the village (blue fill, one pennant on top); owed to the estate (purple fill, two pennants); null (pale, no one's).
//           Every icon has a white halo so it holds on any ground.
//   breach = a torn corner (bottom right) in the other side's colour: 'demanded' (own hours, torn amber), 'taken' (household's, torn pale).
//   author = top-left mark: 'player' (a pen nib on dark), 'kept' (a pin: the player's and "keep my order"); the rule's steps have none.
//   state = top-right badge only: 'risk' | 'blocked' | 'done' | 'back' (taken back by the rule) | 'stray' (a pile lying out).
//   num + unit = at most one number, its unit in the pill's shape: 'day' (a calendar leaf: "the day it is on"), 'hours' (a pill
//           ending in h, signed when short: "-8h"), 'count' (a round counter: "×3"). One meaning per frame by convention: plan → day,
//           target → hours (short, signed), now → none or count.
// Old (round 1) options still work: frame task/day/dated/season/year and badge quill/kept map to the new channels.
const WHOSE_STYLE = {
  household: { fill: '#e0a43a', rim: '#2a2018', glyph: '#2a2018' },
  own: { fill: '#eef6f4', rim: '#1f7a76', glyph: '#1f5f5c', double: true },
  owed: { fill: '#33599e', rim: '#1b2f57', glyph: '#fff', pennants: 1 },
  estate: { fill: '#7d3f8c', rim: '#3d1d45', glyph: '#fff', pennants: 2 },
  none: { fill: '#f4efe4', rim: '#5a5247', glyph: '#2a2018' },
};
const FRAMES = {
  now: '<circle cx="20" cy="20" r="15"/>',
  plan: '<rect x="5" y="5" width="30" height="30" rx="5"/>',
  target: '<path d="M5 5h30v14c0 9-7.5 14.5-15 17.5C12.5 33.5 5 28 5 19z"/>',
};
const FRAME_ALIAS = { task: 'now', day: 'plan', dated: 'plan', season: 'target', year: 'target' };
const STATES = {
  risk: '<circle cx="34" cy="6" r="6.5" fill="#c8361b" stroke="#fff" stroke-width="1.5"/><path d="M34 2.5v4l2 1.5" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
  blocked: '<circle cx="34" cy="6" r="6.5" fill="#333" stroke="#fff" stroke-width="1.5"/><path d="M31 3l6 6M37 3l-6 6" stroke="#fff" stroke-width="1.6"/>',
  back: '<circle cx="34" cy="6" r="6.5" fill="#6b6b6b" stroke="#fff" stroke-width="1.5"/><path d="M37 8a3.2 3.2 0 1 1-1-4.5M36.5 1.5v2.3h-2.3" stroke="#fff" stroke-width="1.5" fill="none"/>',
  done: '<circle cx="34" cy="6" r="6.5" fill="#3f7a35" stroke="#fff" stroke-width="1.5"/><path d="M31 6l2 2 4-4" stroke="#fff" stroke-width="1.7" fill="none"/>',
  stray: '<circle cx="34" cy="6" r="6.5" fill="#fff" stroke="#7a5a1a" stroke-width="1.5"/><path d="M31 8h6M32 6h4M33 4h2" stroke="#7a5a1a" stroke-width="1.5"/>',
};
const AUTHORS = {
  player: '<rect x="0" y="0" width="12" height="12" rx="3" fill="#2a2018" stroke="#fff" stroke-width="1.3"/><path d="M3.5 9.5l5-6M4.5 6.5l2.3.3" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>',
  kept: '<rect x="0" y="0" width="12" height="12" rx="3" fill="#2a2018" stroke="#fff" stroke-width="1.3"/><circle cx="6" cy="4.5" r="2.2" fill="#fff"/><path d="M6 6.5v3.5" stroke="#fff" stroke-width="1.6"/>',
};
// Kept for round 1's mocks (hearth segments): hatches of the two breaches, and the stripes of what is still to do.
const WHOSE = {
  household: { name: "the household's (levied)", c: WHOSE_STYLE.household.fill },
  own: { name: 'own hours', c: '#2f8f8a' },
  owed: { name: 'owed to the village', c: WHOSE_STYLE.owed.fill },
  estate: { name: 'owed to the estate', c: WHOSE_STYLE.estate.fill },
};
const DEFS = `<defs>
<pattern id="hatch-own" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="${WHOSE.household.c}"/><rect width="2.2" height="5" fill="${WHOSE.own.c}"/></pattern>
<pattern id="hatch-hh" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="${WHOSE.own.c}"/><rect width="2.2" height="5" fill="${WHOSE.household.c}"/></pattern>
<pattern id="hatch-todo" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#fff0"/><rect width="2" height="6" fill="#0003"/></pattern>
</defs>`;
function fillOf(whose, breach) {
  if (breach === 'demanded') return 'url(#hatch-hh)';
  if (breach === 'taken') return 'url(#hatch-own)';
  return whose ? WHOSE[whose].c : '#f4efe4';
}
function numPill(num, unit) {
  const s = String(num), w = s.length * 6 + (unit === 'hours' ? 14 : 9), x = 20 - w / 2;
  const txt = (t, cx) => `<text x="${cx}" y="45.5" font-size="9.5" font-family="system-ui,sans-serif" font-weight="700" text-anchor="middle" fill="#2a2018">${t}</text>`;
  if (unit === 'day') return `<g><rect x="${x}" y="36" width="${w}" height="13" rx="2" fill="#fff" stroke="#2a2018"/><path d="M${x + 3} 34.5v3M${x + w - 3} 34.5v3" stroke="#2a2018" stroke-width="1.4"/>${txt(s, 20)}</g>`;
  if (unit === 'count') return `<g><circle cx="20" cy="42" r="${Math.max(7, w / 2)}" fill="#2a2018"/><text x="20" y="45.3" font-size="9.5" font-family="system-ui,sans-serif" font-weight="700" text-anchor="middle" fill="#fff">×${s}</text></g>`;
  return `<g><rect x="${x}" y="36" width="${w}" height="13" rx="6.5" fill="#fff" stroke="#2a2018"/>${txt(s + 'h', 20)}</g>`;
}
function icon(glyph, o = {}) {
  let { frame = 'now', whose = 'household', breach = null, state = null, author = null, num = null, unit = null, size = 40, set = 'line', ghost = false, badge = null } = o;
  frame = FRAME_ALIAS[frame] || frame;
  if (badge === 'quill') author = author || 'player'; else if (badge === 'kept') author = 'kept'; else if (badge) state = state || badge;
  if (num != null && !unit) unit = frame === 'plan' ? 'day' : frame === 'target' ? 'hours' : 'count';
  const W = WHOSE_STYLE[breach === 'demanded' ? 'own' : breach === 'taken' ? 'household' : whose || 'none'];
  const body = ICONS[set][glyph] || ICONS.line[glyph] || ICONS.line.plan;
  const g = set === 'stencil' ? `<g fill="${W.glyph}" stroke="none">${body}</g>` : `<g fill="none" stroke="${W.glyph}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
  const shape = FRAMES[frame], dash = ghost ? ' stroke-dasharray="3 2"' : '';
  let s = `<g fill="none" stroke="#fff" stroke-width="5" opacity=".9">${shape}</g>`;
  for (let i = 0; i < (W.pennants || 0); i++) s += `<path d="M${16 + i * 7} 5.5v-6.5l6.5 3.2-6.5 3.2" fill="${W.fill}" stroke="${W.rim}" stroke-width="1.1"/>`;
  s += `<g fill="${W.fill}" stroke="${W.rim}" stroke-width="${W.double ? 2.6 : 1.6}"${dash}>${shape}</g>`;
  if (W.double) s += `<g fill="none" stroke="#fff" stroke-width="1" transform="translate(20 20) scale(.84) translate(-20 -20)">${shape}</g>`;
  s += `<g transform="${frame === 'target' ? 'translate(8 6.5)' : 'translate(8 8)'}"><svg viewBox="0 0 24 24" width="24" height="24" overflow="visible">${g}</svg></g>`;
  if (breach) {
    const T = WHOSE_STYLE[breach === 'demanded' ? 'household' : 'own'];
    s += `<path d="M24 38l3-4 1.5 2.5 3-4 1.5 2.5 3-4 1.5 2.5V38z" fill="${T.fill}" stroke="${T.rim}" stroke-width="1.2" stroke-linejoin="round"/>`;
  }
  if (author) s += `<g transform="translate(-1 -1)">${AUTHORS[author]}</g>`;
  if (state) s += STATES[state];
  if (num != null) s += numPill(num, unit);
  return `<svg class="pi" viewBox="0 0 40 40" width="${size}" height="${size}" style="overflow:visible${ghost ? ';opacity:.6' : ''}">${s}</svg>`;
}
// A legend of the grammar, for any mock that wants it.
function grammarLegend() {
  const row = (label, items) => `<div class="lg-row"><b>${label}</b>${items.map(([h, t]) => `<span class="lg-i">${h}<small>${t}</small></span>`).join('')}</div>`;
  return `<div class="legend">` +
    row('Frame = how settled', [[icon('chop', { frame: 'now' }), 'being done'], [icon('chop', { frame: 'plan' }), 'planned, dated'], [icon('oats', { frame: 'target' }), 'target, aim']]) +
    row('Fill + rim = whose hours', [[icon('chop'), 'levied'], [icon('courting', { whose: 'own' }), 'own'], [icon('fence', { whose: 'owed' }), 'owed: village'], [icon('build', { whose: 'estate' }), 'owed: estate'], [icon('wood', { whose: null }), 'no one\'s']]) +
    row('Torn corner = breach', [[icon('cart', { breach: 'demanded' }), 'demanded'], [icon('courting', { breach: 'taken' }), 'taken']]) +
    row('Top left = author', [[icon('chop', { frame: 'plan' }), 'the rule'], [icon('chop', { frame: 'plan', author: 'player' }), 'the player'], [icon('chop', { frame: 'plan', author: 'kept' }), 'kept order']]) +
    row('Top right = state', Object.keys(STATES).map((b) => [icon('chop', { frame: 'plan', state: b }), b])) +
    row('One number, its unit', [[icon('chop', { frame: 'plan', num: 6 }), 'on day 6'], [icon('oats', { frame: 'target', num: -8 }), '8 hours short'], [icon('people', { num: 3 }), '3 of them']]) +
    row('All at once', [[icon('chop', { frame: 'plan', author: 'player', state: 'risk', num: 6 }), 'Per\'s barley, at risk, day 6'], [icon('cart', { breach: 'demanded', author: 'player', num: 2 }), 'Per\'s demand of Nils']]) +
    `</div>`;
}

// ---- The village at scale (round 2): 20 households of Byn, for the muster and stress views. Deterministic fake data.
// Each: name, adults (incl. the head pair), children, fields (lots are by fields), its autumn fence lot in adult-days, and for each of
// the 12 autumn days what its levy days are: 'named' | 'worked' | 'lapsed' | 'breached' | 'tonamed' (still to name). Backa is ours.
const VILLAGE = (() => {
  const names = ['Backa', 'Norrgård', 'Övergård', 'Sörgård', 'Västergård', 'Östergård', 'Mellangård', 'Bäcken', 'Hagen', 'Lyckan',
    'Torpet', 'Nybygget', 'Kullen', 'Ängen', 'Sjöstugan', 'Prästgården', 'Smedjan', 'Kvarnen', 'Rotet', 'Lillgården'];
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const hh = names.map((name, i) => {
    const adults = i === 0 ? 4 : 1 + Math.floor(rnd() * 5), fields = i === 0 ? 3 : 1 + Math.floor(rnd() * 4);
    const lot = Math.max(1, Math.round(fields * 0.7)), days = Array(12).fill(null);
    let left = lot;
    for (let d = 0; d < 12 && left > 0; d++) if (rnd() < 0.18) { days[d] = d < 3 ? (rnd() < 0.15 ? 'breached' : rnd() < 0.1 ? 'lapsed' : 'worked') : 'named'; left--; }
    return { name, adults, children: Math.floor(rnd() * 4), fields, lot, days, toName: left, alderman: name === 'Övergård',
      opinion: Math.round((rnd() * 2 - 1) * 10) / 10, own: Math.round((0.15 + rnd() * 0.25) * 100) / 100 };
  });
  hh[0].days = Array(12).fill(null); hh[0].days[5] = 'named'; hh[0].toName = 1; // Backa: Erik on day 6, one day still to name
  return { name: 'Byn', today: 4, routine: 'Fence mending, autumn, lots by fields', households: hh,
    together: [{ day: 9, what: 'the bridge', kind: 'village' }], estate: { name: 'Sparre manor', days: 3, season: 'winter', names: 'levier' } };
})();
// Round 1's mocks read the old badge table directly; kept as an alias.
const BADGES = { ...STATES, quill: `<g transform="translate(27 1)">${AUTHORS.player}</g>`, kept: `<g transform="translate(27 1)">${AUTHORS.kept}</g>` };

// ---- The pawn scale (round 4). Two played pawns: Nils as a member of Backa (TODAY.nils, his levy 10.5 h, his aim), and a lone
// settler, Ola, who is head, member and pawn at once (no levy within; the village's outer levies only once he has a farm).
const LONE = {
  name: 'Ola', age: 24, col: '#6a5a8a', day: { season: 'spring', day: 3, hour: 9 },
  home: 'home', // the scene's yard stands in for his cottage, half built
  necessities: [ { kind: 'water', what: 'Water', h: 0.5 }, { kind: 'pot', what: 'Cook', h: 1.5 }, { kind: 'wood', what: 'Firewood', h: 1, short: true }, { kind: 'beast', what: 'The cow: milk and fodder', h: 1 } ],
  sleep: [22, 6], owedSleep: 3,
  today: [
    { kind: 'water', what: 'Water', at: 'lake', h: [6, 6.5], state: 'done' },
    { kind: 'pot', what: 'Cook', at: 'home', h: [6.5, 7], state: 'done' },
    { kind: 'hoe', what: 'Break the south field (day 2 of ~6)', at: 'clearing', h: [7, 12], state: 'doing', task: 'plant' },
    { kind: 'pot', what: 'Cook', at: 'home', h: [12, 13], state: 'planned' },
    { kind: 'chop', what: 'Fell timber for the cottage', at: 'wood1', h: [13, 16], state: 'planned', task: 'cottage', cut: true },
    { kind: 'cart', what: 'Haul the timber home', at: 'home', h: [16, 17.5], state: 'planned', task: 'cottage' },
    { kind: 'beast', what: 'Milk, fodder', at: 'home', h: [17.5, 18.5], state: 'planned' },
  ],
  tasks: { // multi-step tasks as goals with methods (design 3.2), steps read from the world
    plant: { goal: 'A sown field at the south clearing', window: 'sow by spring day 10', steps: ['clear', 'break', 'hoe', 'sow'], at: 1, est: { lo: 4, mid: 6, hi: 8 }, unit: 'days' },
    cottage: { goal: 'A cottage in place of the shelter', steps: ['fell 6 trees', 'haul', 'hew', 'raise walls', 'roof'], at: 0, est: { lo: 9, mid: 12, hi: 16 }, unit: 'days', cut: 'yesterday, at the wood: 1 tree felled, lying with his mark' },
  },
  aims: [ { kind: 'married', what: 'A wife and a household', horizon: 'year' }, { kind: 'field', what: 'Three fields by next autumn', horizon: 'year' } ],
  problems: [ { kind: 'cold', what: 'No roof: cold nights', at: 'home' }, { kind: 'wood', what: 'Firewood for 2 days', at: 'home' } ],
};
// Nils as the played pawn (a member): his view of the household's plan is the head's lists up to his levy line, his own hours above it.
const NILS_VIEW = {
  levy: 10.5, ownToday: 1.5, standing: 'the head thinks him idle (memory: took 3 h on day 2)',
  asks: [ { to: 'per', what: 'Leave for the gathering, day 8', state: 'granted' }, { to: 'per', what: 'A lighter levy in winter (9 h)', state: 'unasked' } ],
  demand: { from: 'per', what: 'Haul before the rain, 16:30-18', h: 1.5, likely: 'refuse: wants Norrgård' },
  aim: { kind: 'courting', what: 'Court Lisa at Norrgård', progress: 0.3, needs: 'own hours: ~6 h a week', rival: 'the smith\'s son' },
};
