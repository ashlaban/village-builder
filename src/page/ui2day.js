// @sys page/ui2day: the new interface's day strip: what the plan makes of today and the two days after, by the hour
// Read from the agenda's layout (Sim.agenda(st, st.player.pawn).days, VB-1647: the plan laid as the settler will follow it, at its own estimate). A strip
// a day: the night's sleep dark, the routine, each task with its icon, the hours left free pale; a line at the hour it is. A tap on a piece
// opens the card of its chip in the plan bar (page/ui2hud), where the words are.
const DAY_WORD = ['Today', 'Tomorrow'];
function dayStripHTML(A, P) {
  if (!A || !A.days || !A.days.length) return '';
  const D = Sim.DAY,
    day0 = Math.floor(st.t / D),
    pct = (h) => `${((h / D) * 100).toFixed(2)}%`,
    rows = hud.days3 ? A.days : A.days.slice(0, 1);
  let h = '';
  rows.forEach((segs, n) => {
    const from = (day0 + n) * D,
      owed = A.owed && Number.isFinite(A.owed[n]) ? Math.round(A.owed[n]) : 0;
    h += `<div class="u2-day"><span class="u2-dayname">${DAY_WORD[n] || `Day ${Sim.cal(from).sday + 1}`}</span><div class="u2-dayrow">`;
    for (const g of segs) {
      const a = Math.max(0, g.from - from),
        b = Math.min(D, g.to - from);
      if (!(b > a) || g.what === 'free') continue;
      const ti =
          g.what === 'task'
            ? P.tasks.findIndex((t) => (g.key && t.key === g.key) || (t.kind === 'plant' && t.site === g.site))
            : -1,
        pc = g.what === 'sleep' ? 'sleep' : g.what === 'routine' ? `r:${g.kind}` : ti >= 0 ? `t:${ti}` : '',
        name = hudKind(g.what === 'sleep' ? 'sleep' : g.kind),
        wide = ((b - a) / D) * (u2.days ? u2.days.clientWidth || 300 : 300) >= 20;
      h +=
        `<button type="button" class="u2-seg ${g.what}" style="left:${pct(a)};width:${pct(b - a)}"${pc ? ` data-pc="${esc(pc)}"` : ''} ` +
        `aria-label="${esc(name)}, ${hudHour(Math.floor(a))} to ${hudHour(Math.ceil(b))}" title="${esc(name)}">` +
        `${wide ? actIcon(g.what === 'sleep' ? 'idle' : KIND_ICON[g.kind] || 'hoe') : ''}</button>`;
    }
    if (n === 0) h += `<u style="left:${pct(st.t - from)}"></u>`;
    h += `</div><span class="u2-dayowed${owed >= 16 ? ' press2' : owed >= 8 ? ' press1' : ''}">${owed >= 8 ? `${actIcon('idle')}${owed}` : ''}</span></div>`;
  });
  return h;
}
function renderDay(A, P) {
  const html = P && A ? dayStripHTML(A, P) : '';
  u2.days.hidden = !html;
  if (html && html !== hud.dayHTML) u2.days.innerHTML = hud.dayHTML = html;
}
if (UI2)
  u2.days.addEventListener('click', (e) => {
    if (e.target.closest('[data-pc]')) return; // a piece: the plan bar's click opens its card
    hud.days3 = !hud.days3;
    hud.planKey = '';
    if (st) renderHud();
  });
