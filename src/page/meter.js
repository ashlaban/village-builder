// @sys page/meter: the panels' shared pieces (VB-664): the one meter every level is shown on, a stat (a good or a measure: its icon, its
// value, its meter where it is a level) and the grid of them, and a pawn's traits as icons
// ======== meters and stats ========
// One meter for every level (AGENTS.md, Deciding without Kim, 15): the value on its scale from min to max, a mark at each target or
// threshold, and a signed form filled from its middle. The scale is the caller's argument: today's ranges, until VB-665 settles them.
// o: {value, min (0), max (100), marks: [{at, label, kind}] (kind 'custom' or 'head': whose mark, by its colour; markKey is their
// key), signed, tone ('good', 'warn', 'bad' or none), label, text (the value in words,
// for the title and a screen reader)}. A value past max fills the meter and is marked over.
const pctOf = (x, lo, hi) => Math.max(0, Math.min(100, ((x - lo) / (hi - lo)) * 100));
function meter(o) {
  const lo = o.min ?? (o.signed ? -(o.max ?? 100) : 0),
    hi = o.max ?? 100,
    at = pctOf(o.value, lo, hi),
    mid = pctOf(0, lo, hi);
  const fill = o.signed
    ? `left:${Math.min(at, mid).toFixed(1)}%;width:${Math.abs(at - mid).toFixed(1)}%`
    : `width:${at.toFixed(1)}%`;
  // where the fill starts and ends, for a theme that draws the level another way than as a bar's width (the mural's beads, VB-1161)
  const span = o.signed
    ? `--lo:${Math.min(at, mid).toFixed(1)}%;--hi:${Math.max(at, mid).toFixed(1)}%`
    : `--lo:0%;--hi:${at.toFixed(1)}%`;
  const marks = (o.marks || [])
    .filter((m) => m.at >= lo && m.at <= hi)
    .map(
      (m) =>
        `<b${m.kind ? ` class="${m.kind}"` : ''} style="left:${pctOf(m.at, lo, hi).toFixed(1)}%" title="${esc(m.label || '')}"></b>`,
    )
    .join('');
  const text = o.text ?? String(Math.round(o.value)),
    said = [o.label ? `${o.label}: ${text}` : text, ...(o.marks || []).map((m) => m.label).filter(Boolean)].join('; ');
  const cls = ['meter', o.signed ? 'signed' : '', o.tone || '', o.value > hi ? 'over' : ''].filter(Boolean).join(' ');
  return (
    `<span class="${cls}" role="meter" aria-valuemin="${lo}" aria-valuemax="${hi}" aria-valuenow="${Math.round(o.value * 100) / 100}" ` +
    `aria-label="${esc(said)}" title="${esc(said)}" style="${span}"><i style="${fill}"></i>` +
    `${o.signed ? `<u style="left:${mid.toFixed(1)}%"></u>` : ''}${marks}</span>`
  );
}
// The key of a meter's two marks (VB-1027): the custom's and the head's, each drawn as it is on the meter.
const markKey = () =>
  `<p class="mark-key" role="note"><span><b class="custom"></b>the custom's</span><span><b class="head"></b>the head's target</span></p>`;
// A stat: the icon of a good or a measure, its value, and its meter where it is a level; the word is its label. o: {icon (a key of
// GOOD_PATHS, or ready HTML in `img`), label, value (text), note (a few words after the value), meter (meter()'s argument, or none),
// tone, wide (a row of its own)}.
function stat(o) {
  const m = o.meter ? meter({ label: o.label, text: o.value, tone: o.tone, ...o.meter }) : '';
  return (
    `<div class="stat${o.wide || m ? ' wide' : ''}${o.tone ? ' ' + o.tone : ''}${o.cls ? ' ' + o.cls : ''}" title="${esc(o.title || o.label)}">` +
    `<span class="stat-ico">${o.img || goodIcon(o.icon)}</span><span class="stat-name">${esc(o.label)}</span>${m}` +
    `<span class="stat-val">${esc(String(o.value))}${o.note ? `<small>${esc(o.note)}</small>` : ''}</span></div>`
  );
}
// Tilth (VB-719; Kim, 16 Nov): what years of dung have left in the ground, as the hundredths of harvest it adds, on the one meter to
// TILTH.max; of one field, or the mean of a farm's or a village's fields (null with none, and no row). What the ground holds now: no
// foretelling, so no pawn's estimate is named (principle 14).
function tilthStat(fields, of = '') {
  if (!fields.length) return null;
  let sum = 0;
  for (const fd of fields) sum += Sim.tilthOf(st, fd);
  const n = Math.round((100 * sum) / fields.length);
  return {
    icon: 'soil',
    label: 'Tilth',
    value: n,
    note: of,
    title: `What years of dung have left in the ground${of ? `, ${of}` : ''}: the harvest gains this many hundredths`,
    meter: { value: n, max: Math.round(100 * VB['sim/soil'].TILTH.max) },
  };
}
// A wet field's loss to its wetness now, and its ditch (VB-721), on the one meter; null on dry ground. The loss less what its ditch takes away.
function wetStat(fd) {
  if (VB['sim/crops'].wetLoss(st.w, fd.tile) <= 0) return null;
  const n = Math.round(100 * (1 - Sim.wetFactor(st, fd))),
    d = Math.round(100 * Sim.ditchOf(st, fd)),
    most = Math.round(100 * VB['sim/crops'].WET.most);
  return {
    icon: 'soil',
    label: 'Wetness',
    value: n,
    note: d >= 1 ? `ditched, the ditch at ${d}%` : 'not ditched',
    tone: n >= 10 ? 'warn' : '',
    title:
      'What the wet ground takes of the harvest, in hundredths; a ditch takes a share of it away, and silts unless dug again',
    meter: { value: n, max: most },
  };
}
const stats = (list) => `<div class="stat-grid">${list.filter(Boolean).map(stat).join('')}</div>`;
// A pawn's mood (sim/mood, VB-062): a stat, its level on the one meter marked at the words' cut points (miserable under 25, low under
// 45, content under 65, happy), the word beside the number; and each modifier in force as its icon and signed value, its label the title.
const MOOD_CUTS = [
  [25, 'miserable under 25'],
  [45, 'low under 45'],
  [65, 'content under 65, happy above'],
];
const MOOD_ICON = { hungry: 'hunger', cold: 'cold', dry: 'water', weak: 'health' };
function moodStat(m) {
  return {
    icon: 'mood',
    label: 'Mood',
    value: m.mood,
    note: Sim.moodWord(m.mood),
    tone: m.mood < 25 ? 'bad' : m.mood < 45 ? 'warn' : '',
    meter: {
      value: m.mood,
      text: `${m.mood}, ${Sim.moodWord(m.mood)}`,
      marks: MOOD_CUTS.map(([at, label]) => ({ at, label })),
    },
  };
}
function moodModsHTML(m) {
  if (!m.mods.length) return '';
  const one = (x) => {
    const said = `${x.label} ${x.value > 0 ? '+' : '−'}${Math.abs(x.value)}`;
    return (
      `<span class="mood-mod ${x.value > 0 ? 'up' : 'down'}" role="listitem" title="${esc(said)}" aria-label="${esc(said)}">` +
      `${goodIcon(MOOD_ICON[x.key] || x.key)}<b>${x.value > 0 ? '+' : '−'}${Math.abs(x.value)}</b></span>`
    );
  };
  return `<div class="mood-mods" role="list" aria-label="Mood">${m.mods.map(one).join('')}</div>`;
}
// A pawn's traits (sim/traits): all twelve, each its icon over the one meter, in their three groups; one beyond the labels' bounds
// (TRAITS.label) is marked and named by its word. Shown for every pawn that has them: traits are not hidden.
const TRAIT_GROUPS = ['Values', 'Temperament', 'Aptitudes'];
function traitsHTML(id) {
  const p = st.pawns[id],
    T = VB['sim/rules'].TRAITS;
  if (!p.traits) return '';
  const one = (name, i) => {
    const x = p.traits[i],
      word = VB['sim/traits'].wordOf(st, id, name),
      said = `${name[0].toUpperCase()}${name.slice(1)} ${Math.round(x * 100)}${word ? `: ${word}` : ''}`;
    return (
      `<span class="trait${word ? (x > 0.5 ? ' high' : ' low') : ''}" title="${esc(said)}">${traitIcon(name)}` +
      `${meter({ value: x * 100, label: name, text: `${Math.round(x * 100)}${word ? `, ${word}` : ''}` })}</span>`
    );
  };
  return `<div class="traits" role="group" aria-label="Traits">${[0, 1, 2]
    .map(
      (g) =>
        `<div class="trait-row" title="${TRAIT_GROUPS[g]}">${T.names
          .slice(g * 4, g * 4 + 4)
          .map((n, k) => one(n, g * 4 + k))
          .join('')}</div>`,
    )
    .join('')}</div>`;
}
// A pawn's crafts (sim/skills, VB-360): each it has learnt beyond a novice's first hours (SKILLS.shown), with its word on the fixed
// scale (novice, able, skilled, master; Kim, 18 Nov), in the order of SKILLS.crafts; none, no line.
function craftsLine(id) {
  const c = VB['sim/skills'].craftsOf(st, id);
  return c.length ? `Crafts: ${c.map((x) => `${x.craft} (${x.word})`).join(', ')}` : '';
}
// ======== the supply component (VB-667) ========
// One presentation of a supply, wherever it is shown (AGENTS.md, Deciding without Kim, 15): its icon, its word, its season cells, its
// state in a few words and an i that opens its numbers. Its argument is the outlook the household's head made at his last review
// (Sim.supplyOutlook, VB-666); the page computes nothing of it, and says whose reckoning it is (14). Mocks: docs/mocks/supply-scale.html
// (the rows and the numbers) and docs/mocks/supply-doubt.html (the chips in the farm rows).
const SUPPLY_ROWS = [
  { key: 'food', icon: 'hunger', label: 'Food', unit: 'rations' },
  { key: 'fuel', icon: 'wood', label: 'Fuel', unit: 'loads' },
  { key: 'hay', icon: 'hay', label: 'Hay', unit: '' },
];
const supplyOpen = new Set(); // the supplies whose numbers are open: the page's own state, kept as the selection changes
const seasonWord = (O, k) => Sim.SEASONS[(O.season + k) % 4];
const partOf = (x, k) => Math.max(0, Math.min(1, x - k));
// the frame season of the one season a supply is needed in (hay: the winter), from its need
const oneSeason = (s) =>
  Math.max(
    0,
    s.parts.need.findIndex((n) => n > 0),
  );
// A supply's state in a few words, and its tone: 'safe', or short in the first season the likeliest outcome does not cover.
function supplyState(O, s) {
  if (s.state === 'none') return { tone: 'none', word: 'none needed' };
  if (s.state === 'safe') return { tone: 'safe', word: 'safe' };
  return { tone: s.state === 'bad' ? 'bad' : 'warn', word: `short in ${seasonWord(O, s.season)}` };
}
// One cell: filled by how much of its season's need is covered, solid from the store (own), striped from what is still to come (with);
// a red frame where the likeliest outcome does not cover it.
const supplyCell = (own, wth, short, title) =>
  `<span class="cell${short ? ' short' : ''}" title="${esc(title)}"><i class="with" style="width:${(wth * 100).toFixed(1)}%"></i>` +
  `<i class="own" style="width:${(own * 100).toFixed(1)}%"></i></span>`;
// The head's doubt under the cells (VB-669; the mock's whisker, docs/mocks/supply-doubt.html): a line from the worst the head expects (lo)
// to the best (hi), ticks at its ends and a dot at the likeliest (mid), drawn a cell at a time under the same cells; none where the range
// is nil (a store reckoned with no doubt, or an outlook saved before it). k0: the first cell's frame season; n: the cells.
function supplyWhisker(s, k0, n, lead) {
  if (s.lo === undefined || !(s.hi - s.lo > 0.005)) return '';
  const at = (x, k) => (x >= 4 ? 1 : partOf(x, k)),
    ends = new Set();
  let h = lead;
  for (let k = k0; k < k0 + n; k++) {
    const a = at(s.lo, k),
      b = at(s.hi, k),
      on = b - a > 0.001 || (s.lo >= k && s.lo <= k + 1),
      last = k === k0 + n - 1,
      seg = on
        ? `<i class="wl${b >= 1 && !last && s.hi > k + 1 ? ' on' : ''}" style="left:${(a * 100).toFixed(1)}%;width:${((b - a) * 100).toFixed(1)}%"></i>`
        : '';
    let marks = '';
    if (on && !ends.has('lo') && (s.lo < k + 1 || last)) {
      marks += `<i class="wt" style="left:${(a * 100).toFixed(1)}%"></i>`;
      ends.add('lo');
    }
    if (on && !ends.has('hi') && (s.hi <= k + 1 || last)) {
      marks += `<i class="wt" style="left:${(b * 100).toFixed(1)}%"></i>`;
      ends.add('hi');
    }
    if (!ends.has('mid') && (s.mid < k + 1 || last)) {
      marks += `<i class="wd" style="left:${(at(s.mid, k) * 100).toFixed(1)}%"></i>`;
      ends.add('mid');
    }
    h += `<span class="whisk-cell">${seg}${marks}</span>`;
  }
  return `<span class="whisk" title="The head's doubt: from the worst it expects to the best, the dot its likeliest">${h}</span>`;
}
function supplyCells(O, s) {
  if (s.state === 'none') return '<span class="cells none"><span class="cell"></span></span>';
  if (s.seasons.length === 1) {
    // needed in one season only (hay): one wide cell for it, after its season's icon (Kim)
    const k = oneSeason(s),
      own = s.own >= 4 ? 1 : partOf(s.own, k),
      wth = s.with >= 4 ? 1 : partOf(s.with, k);
    return (
      `<span class="cells-wrap"><span class="cells one"><span class="cell-season" title="${esc(seasonWord(O, k))}">${seasonIcon(O.season + k)}</span>` +
      supplyCell(own, wth, s.with < 4, `${seasonWord(O, k)}: ${Math.round(wth * 100)}% covered`) +
      `</span>${supplyWhisker(s, k, 1, `<span class="cell-season" aria-hidden="true">${seasonIcon(O.season + k)}</span>`)}</span>`
    );
  }
  let h = '';
  for (let k = 0; k < 4; k++) {
    const wth = partOf(s.with, k);
    h += supplyCell(partOf(s.own, k), wth, s.with < k + 0.98, `${seasonWord(O, k)}: ${Math.round(wth * 100)}% covered`);
  }
  return `<span class="cells-wrap"><span class="cells">${h}</span>${supplyWhisker(s, 0, 4, '')}</span>`;
}
// The head's range in words (VB-669): for a supply of one season the share of it covered, worst to best ("70 to 100% of the winter");
// else the seasons it runs out in, or that it lasts the year.
function supplyRange(O, s, one) {
  if (one) {
    const k = oneSeason(s),
      pc = (x) => Math.round(100 * (x >= 4 ? 1 : partOf(x, k)));
    return `${pc(s.lo)} to ${pc(s.hi)}% of the ${seasonWord(O, k)}`;
  }
  const when = (x) => (x >= 4 ? 'lasts the year' : `runs out in ${seasonWord(O, Math.floor(x))}`);
  return s.hi >= 4 && s.lo >= 4 ? 'lasts the year' : `at worst ${when(s.lo)}; at best ${when(s.hi)}`;
}
const INTAKE_WORD = { firewood: 'Firewood to cut', mown: 'Hay lying mown', meadows: 'Meadows still to mow' };
const intakeWord = (what) => INTAKE_WORD[what] || `The ${what} harvest`;
// The numbers under a row (its outlook's parts): the store, the need, what is expected and when, what is expected to spoil; for hay a
// sentence first (Kim).
function supplyNums(O, r, s) {
  const n = (x) => `${Math.round(x)}${r.unit ? ` ${r.unit}` : ''}`,
    P = s.parts,
    one = s.seasons.length === 1,
    lines = [['In store', n(P.store)]];
  if (one) lines.push([`The ${seasonWord(O, oneSeason(s))} needs`, n(P.need[oneSeason(s)])]);
  else lines.push(['The need, season by season', P.need.map((x) => Math.round(x)).join(' · ')]);
  for (const x of P.intakes) lines.push([`${intakeWord(x.what)}, in ${seasonWord(O, x.season)}`, n(x.n)]);
  if (P.target !== undefined) lines.push(["The store's target", `${n(P.target)}`]);
  if (P.spoilt >= 0.5) lines.push(['Expected to spoil', `about ${n(P.spoilt)}`]);
  if (s.lo !== undefined && s.hi - s.lo > 0.005) lines.push(["The head's range", supplyRange(O, s, one)]);
  lines.push([
    'Likeliest outcome',
    one
      ? `${Math.round(100 * (P.share ?? 1))}% of the ${seasonWord(O, oneSeason(s))}`
      : s.with >= 4
        ? 'lasts the year'
        : `runs out in ${seasonWord(O, Math.floor(s.with))}`,
  ]);
  return (
    `<div class="supply-nums" data-supply-nums="${r.key}">` +
    (r.key === 'hay'
      ? '<p>Hay is eaten by the animals while they stand in the byre over winter. Out of winter they graze, and none is needed.</p>'
      : '') +
    `<dl>${lines.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl></div>`
  );
}
function supplyRow(O, r) {
  const s = O[r.key],
    S = supplyState(O, s),
    open = supplyOpen.has(r.key);
  return (
    `<div class="supply ${S.tone}" data-supply="${r.key}"><span class="stat-ico">${goodIcon(r.icon)}</span>` +
    `<span class="stat-name">${r.label}</span>${supplyCells(O, s)}<span class="supply-state">${esc(S.word)}</span>` +
    `<button type="button" class="supply-more" data-supply-more="${r.key}" aria-haspopup="true" aria-expanded="${open}" title="The numbers" ` +
    `aria-label="${r.label}: the numbers">i</button></div>` +
    (open ? supplyNums(O, r, s) : '')
  );
}
// Whose reckoning it is (principle 14): "By Gunnar Håkansson's reckoning, at his last review"; the played pawn's is "your".
function supplyWhose(O) {
  const p = O.head === null || O.head === undefined ? null : st.pawns[O.head],
    mine = !!(p && st.player && st.player.pawn === p.id),
    his = mine ? 'your' : p && p.sex === 'f' ? 'her' : 'his',
    when = O.village ? 'today' : O.stale ? `at ${his} review in the ${Sim.SEASONS[O.season]}` : `at ${his} last review`;
  if (mine) return `By your reckoning, ${when}`;
  return p ? `By ${Sim.fullName(p)}'s reckoning, ${when}` : `By the custom's reckoning, ${when}`;
}
// The Supplies section: the seasons ahead as icons, then a row a supply. O: Sim.supplyOutlook's value (null before a first review);
// `only`, the supplies shown (all three by default).
function suppliesHTML(O, only = null) {
  if (!O) return '<p class="card-note">No reckoning of the supplies yet: the head has not reviewed the plan.</p>';
  const rows = SUPPLY_ROWS.filter((r) => !only || only.includes(r.key)),
    four = rows.some((r) => O[r.key].seasons.length > 1 && O[r.key].state !== 'none');
  const head = four
    ? `<div class="supply head" aria-hidden="true"><span></span><span></span><span class="cells">${[0, 1, 2, 3]
        .map((k) => `<span class="cell-season" title="${seasonWord(O, k)}">${seasonIcon(O.season + k)}</span>`)
        .join('')}</span><span></span><span></span></div>`
    : '';
  return (
    `<div class="supplies${O.stale ? ' stale' : ''}" role="group" aria-label="Supplies">` +
    `<p class="card-note">${esc(supplyWhose(O))}</p>${head}${rows.map((r) => supplyRow(O, r)).join('')}</div>`
  );
}
// The chips of a farm's row: one for each supply about to fall short, its icon and the icon of the first season it is short in, gold for
// a little, red for badly; none for a supply that is safe.
function supplyChips(O) {
  if (!O) return '';
  return SUPPLY_ROWS.filter((r) => O[r.key].state === 'short' || O[r.key].state === 'bad')
    .map((r) => {
      const s = O[r.key],
        said = `${r.label}: short in ${seasonWord(O, s.season)}${s.state === 'bad' ? ', badly' : ''}`;
      return (
        `<span class="supply-chip ${s.state === 'bad' ? 'bad' : 'warn'}" title="${esc(said)}" aria-label="${esc(said)}">` +
        `${goodIcon(r.icon)}${seasonIcon(O.season + s.season)}</span>`
      );
    })
    .join('');
}
// The i opens or closes a supply's numbers wherever the component is shown; the panels draw the choice at their next refresh.
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-supply-more]');
  if (!b || !st) return;
  const k = b.dataset.supplyMore;
  if (supplyOpen.has(k)) supplyOpen.delete(k);
  else supplyOpen.add(k);
  syncTabs();
  if (selPawn < 0 && selVillage >= 0) showVillage(selVillage); // a village's card draws on a timer, not here
});
