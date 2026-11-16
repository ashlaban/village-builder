// @sys page/meter: the panels' shared pieces (VB-664): the one meter every level is shown on, a stat (a good or a measure: its icon, its
// value, its meter where it is a level) and the grid of them, and a pawn's traits as icons
// ======== meters and stats ========
// One meter for every level (AGENTS.md, Deciding without Kim, 15): the value on its scale from min to max, a mark at each target or
// threshold, and a signed form filled from its middle. The scale is the caller's argument: today's ranges, until VB-665 settles them.
// o: {value, min (0), max (100), marks: [{at, label}], signed, tone ('good', 'warn', 'bad' or none), label, text (the value in words,
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
  const marks = (o.marks || [])
    .filter((m) => m.at >= lo && m.at <= hi)
    .map((m) => `<b style="left:${pctOf(m.at, lo, hi).toFixed(1)}%" title="${esc(m.label || '')}"></b>`)
    .join('');
  const text = o.text ?? String(Math.round(o.value)),
    said = [o.label ? `${o.label}: ${text}` : text, ...(o.marks || []).map((m) => m.label).filter(Boolean)].join('; ');
  const cls = ['meter', o.signed ? 'signed' : '', o.tone || '', o.value > hi ? 'over' : ''].filter(Boolean).join(' ');
  return (
    `<span class="${cls}" role="meter" aria-valuemin="${lo}" aria-valuemax="${hi}" aria-valuenow="${Math.round(o.value * 100) / 100}" ` +
    `aria-label="${esc(said)}" title="${esc(said)}"><i style="${fill}"></i>${o.signed ? `<u style="left:${mid.toFixed(1)}%"></u>` : ''}${marks}</span>`
  );
}
// A stat: the icon of a good or a measure, its value, and its meter where it is a level; the word is its label. o: {icon (a key of
// GOOD_PATHS, or ready HTML in `img`), label, value (text), note (a few words after the value), meter (meter()'s argument, or none),
// tone, wide (a row of its own)}.
function stat(o) {
  const m = o.meter ? meter({ label: o.label, text: o.value, tone: o.tone, ...o.meter }) : '';
  return (
    `<div class="stat${o.wide || m ? ' wide' : ''}${o.tone ? ' ' + o.tone : ''}" title="${esc(o.title || o.label)}">` +
    `<span class="stat-ico">${o.img || goodIcon(o.icon)}</span><span class="stat-name">${esc(o.label)}</span>${m}` +
    `<span class="stat-val">${esc(String(o.value))}${o.note ? `<small>${esc(o.note)}</small>` : ''}</span></div>`
  );
}
const stats = (list) => `<div class="stat-grid">${list.filter(Boolean).map(stat).join('')}</div>`;
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
