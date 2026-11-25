// Plans-UI mocks: the shared scene, data and icon grammar (docs/mocks/plans-ui/README.md). Fake data, no game code.
// Load after icons.js. Everything here is a throwaway mock base; mocks may extend it in their own file.

// ---- Time: a year of 4 seasons x 12 days; a working day 6..18 (12 h). "Now" is autumn day 4, 10:00.
const NOW = { season: 'autumn', day: 4, hour: 10 };
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

// ---- Whose hours (the levy's colours, design 3.7). Hatched = a breach, the other side's colour over.
const WHOSE = {
  household: { name: "the household's (levied)", c: '#b9832f' },
  own: { name: 'own hours', c: '#3c8a86' },
  owed: { name: 'owed to the village', c: '#a8473a' },
  estate: { name: "owed to the estate", c: '#6b4f8a' },
};

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

// ---- The icon grammar (README): glyph = what; frame = horizon; tint = whose hours; corner badge = state or author; at most one number.
// frame: 'task' (disc) | 'day' (rounded square) | 'dated' (stake: a square on a post) | 'season' (shield) | 'year' (banner)
// whose: WHOSE key or null; breach: 'demanded' | 'taken' (hatched); badge: 'risk' | 'blocked' | 'kept' | 'quill' | 'back' | 'done' | 'stray'
// set: 'line' | 'stencil'. Returns an SVG string of size `size`, viewBox 0 0 40 40.
const FRAMES = {
  task: '<circle cx="20" cy="20" r="15"/>',
  day: '<rect x="5" y="5" width="30" height="30" rx="7"/>',
  dated: '<rect x="6" y="3" width="28" height="26" rx="4"/>',
  season: '<path d="M6 5h28v14c0 9-7 14-14 17C13 33 6 28 6 19z"/>',
  year: '<path d="M7 3h26v32l-13-7-13 7z"/>',
};
const BADGES = {
  risk: '<circle cx="33" cy="7" r="6.5" fill="#d14b2f" stroke="#fff" stroke-width="1.5"/><path d="M33 3.5v4l2 1.5" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
  blocked: '<circle cx="33" cy="7" r="6.5" fill="#444" stroke="#fff" stroke-width="1.5"/><path d="M30 4l6 6M36 4l-6 6" stroke="#fff" stroke-width="1.6"/>',
  kept: '<circle cx="33" cy="7" r="6.5" fill="#333" stroke="#fff" stroke-width="1.5"/><path d="M33 3v7M30.5 4h5" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>',
  quill: '<circle cx="33" cy="7" r="6.5" fill="#fff" stroke="#333" stroke-width="1.2"/><path d="M30 11l6-7M31.5 8l2.5.2" stroke="#333" stroke-width="1.4" stroke-linecap="round"/>',
  back: '<circle cx="33" cy="7" r="6.5" fill="#e0a020" stroke="#fff" stroke-width="1.5"/><path d="M36 9a3.2 3.2 0 1 1-1-4.5M35.5 2.5v2.3h-2.3" stroke="#fff" stroke-width="1.5" fill="none"/>',
  done: '<circle cx="33" cy="7" r="6.5" fill="#4a7a3a" stroke="#fff" stroke-width="1.5"/><path d="M30 7l2 2 4-4" stroke="#fff" stroke-width="1.7" fill="none"/>',
  stray: '<circle cx="33" cy="7" r="6.5" fill="#fff" stroke="#8a6a2a" stroke-width="1.5"/><path d="M30 9h6M31 7h4M32 5h2" stroke="#8a6a2a" stroke-width="1.5"/>',
};
const DEFS = `<defs>
<pattern id="hatch-own" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="${WHOSE.household.c}"/><rect width="2.2" height="5" fill="${WHOSE.own.c}"/></pattern>
<pattern id="hatch-hh" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="${WHOSE.own.c}"/><rect width="2.2" height="5" fill="${WHOSE.household.c}"/></pattern>
<pattern id="hatch-todo" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#fff0"/><rect width="2" height="6" fill="#0003"/></pattern>
</defs>`;
// demanded: own hours worked for the household = own colour hatched with the household's (hatch-hh); taken: the reverse (hatch-own).
function fillOf(whose, breach) {
  if (breach === 'demanded') return 'url(#hatch-hh)';
  if (breach === 'taken') return 'url(#hatch-own)';
  return whose ? WHOSE[whose].c : '#f4efe4';
}
function icon(glyph, { frame = 'task', whose = 'household', breach = null, badge = null, num = null, size = 40, set = 'line', ghost = false } = {}) {
  const fill = fillOf(whose, breach), body = ICONS[set][glyph] || ICONS.line[glyph] || ICONS.line.plan;
  const g = set === 'stencil' ? `<g fill="#fff" stroke="none">${body}</g>` : `<g fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
  const post = frame === 'dated' ? '<path d="M20 29v9" stroke="#3a2a1a" stroke-width="3"/>' : '';
  const scale = frame === 'dated' ? 'translate(9.5 5) scale(.88)' : frame === 'season' ? 'translate(9 6) scale(.9)' : 'translate(8 8)';
  const num_ = num == null ? '' : `<g><rect x="1" y="27" width="${String(num).length * 6 + 8}" height="12" rx="6" fill="#fff" stroke="#3a2a1a" stroke-width="1"/><text x="${5 + String(num).length * 3}" y="36.5" font-size="9.5" font-family="system-ui,sans-serif" font-weight="700" text-anchor="middle" fill="#2a2018">${num}</text></g>`;
  return `<svg class="pi" viewBox="0 0 40 40" width="${size}" height="${size}" style="overflow:visible${ghost ? ';opacity:.55' : ''}">${post}` +
    `<g fill="${fill}" stroke="#2a2018" stroke-width="1.4"${ghost ? ' stroke-dasharray="3 2"' : ''}>${FRAMES[frame]}</g><g transform="${scale}"><svg viewBox="0 0 24 24" width="24" height="24" overflow="visible">${g}</svg></g>${badge ? BADGES[badge] : ''}${num_}</svg>`;
}
// A legend of the grammar, for any mock that wants it.
function grammarLegend() {
  const row = (label, items) => `<div class="lg-row"><b>${label}</b>${items.map(([h, t]) => `<span class="lg-i">${h}<small>${t}</small></span>`).join('')}</div>`;
  return `<div class="legend">` +
    row('Frame = horizon', [['task', 'task (now)'], ['day', 'today'], ['dated', 'a dated day'], ['season', 'season target'], ['year', 'year: routine, aim']].map(([f, t]) => [icon('chop', { frame: f }), t])) +
    row('Colour = whose hours', [[icon('chop', { whose: 'household' }), 'levied'], [icon('courting', { whose: 'own' }), 'own'], [icon('fence', { whose: 'owed' }), 'owed (village)'], [icon('cart', { whose: 'own', breach: 'demanded' }), 'demanded'], [icon('courting', { breach: 'taken' }), 'taken']]) +
    row('Badge = state, author', Object.keys(BADGES).map((b) => [icon('chop', { badge: b }), b])) +
    `</div>`;
}
