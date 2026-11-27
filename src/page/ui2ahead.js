// @sys page/ui2ahead: the new interface's Ahead lane: the game days to the season's end, the plan's tasks against their deadlines
// ---- the Ahead lane (design.md section 1, The core loop: the days ahead are the main planning surface) ----
// Read from Sim.agenda (each task's starts, ends, hours {lo, mid, hi}, deadline, verdict), Sim.planGaps (windows that press with nothing
// planned) and the pawn's plan steps (sim/steps pawnPlan: state 'at-risk', risk.short). All read-only views. The next LANE.full game days
// at full width, the rest of the game season compressed; a task's bar from its start to its end at the middle of its range, striped on to
// the top of it; behind it its deadline, a mark. Icons first; every piece opens the task's card (page/ui2plan planCard), where the words are.
const LANE = { full: 6, rest: 0.45 }; // full: game days at full width; rest: the share of the lane the rest of the season may take at most
const LANE_SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const laneDays = (n) => `${n} game ${n === 1 ? 'day' : 'days'}`;
// A game hour as the calendar's words: "autumn day 9".
const laneDate = (t) => {
  const c = Sim.cal(t);
  return `${LANE_SEASONS[c.season]} day ${c.sday + 1}`;
};
// The icon of a deadline, by what it is: the frost, a sowing's end, the end of haymaking.
const laneDeadIcon = (d) =>
  /frost/.test(d.what)
    ? goodIcon('cold')
    : /sowing/.test(d.what)
      ? actIcon('sow')
      : /hay/.test(d.what)
        ? actIcon('mow')
        : actIcon('target');
// The task's name as the subject of a sentence ("The harvest becomes late for the frost").
const LANE_NOUN = {
  plant: 'The planting',
  hay: 'The haymaking',
  harvest: 'The harvest',
  farmstead: 'The farmstead',
  fell: 'The felling',
  firewood: 'The firewood',
  upgrade: 'The building',
  foundation: 'The foundation',
  outbuilding: 'The outbuilding',
};
const laneNoun = (t) =>
  (t.kind === 'upgrade' || t.kind === 'outbuilding') && t.what && LADDER[t.what]
    ? `The ${LADDER[t.what].name.toLowerCase()}`
    : LANE_NOUN[t.kind] || `“${hudKind(t.kind)}”`;
// The deadline an entry is judged against: the whole chain's (a field broken now, sown in time?), else its own.
const laneDeadline = (e) => (e && e.then && e.then.deadline) || (e && e.deadline) || null;
// The plan's task steps, by the tasks' index (at risk: state 'at-risk', risk.short in hours).
const laneSteps = () => {
  const pp = VB['sim/steps'].pawnPlan(st, st.player.pawn);
  return pp ? pp.steps : [];
};
// The end at the top of an entry's range: its end at the middle, and the hours between the middle and the top laid on past it.
const laneHi = (e, P) =>
  e && e.hours && Number.isFinite(e.ends)
    ? VB['sim/agenda'].past(e.ends, Math.max(0, e.hours.hi - e.hours.mid), P && P.sleep)
    : null;
// The lane's scale: {n (game days shown), day0, w (each day's width, %), x(t) (% from the left: a day's working hours fill its column)}.
function laneScale() {
  const D = Sim.DAY,
    day0 = Math.floor(st.t / D),
    left = Sim.SEASON_DAYS - Sim.cal(st.t).sday, // today and the days after it in this game season
    n = Math.max(LANE.full, left),
    rest = n - LANE.full,
    k = rest ? Math.min(1, (LANE.rest * LANE.full) / ((1 - LANE.rest) * rest)) : 1, // a compressed day's width against a full one
    total = LANE.full + rest * k,
    w = Array.from({ length: n }, (_, i) => ((i < LANE.full ? 1 : k) / total) * 100),
    at = w.reduce((a, x, i) => (a.push(a[i] + x), a), [0]);
  const x = (t) => {
    const d = Math.floor(t / D) - day0;
    if (d < 0) return 0;
    if (d >= n) return 100;
    const h = t - (day0 + d) * D,
      f = Math.min(1, Math.max(0, (h - Sim.WORK[0]) / (Sim.WORK[1] - Sim.WORK[0])));
    return at[d] + w[d] * f;
  };
  return { n, day0, w, at, x, end: (day0 + n) * D };
}
const lanePct = (v) => `${v.toFixed(2)}%`;
// The lane's HTML: the days' heads, a row a task, a row a window with nothing planned.
function laneHTML(A, P) {
  const S = laneScale(),
    steps = laneSteps(),
    gaps = hudGaps();
  if (!P.tasks.length && !gaps.length) return '';
  const D = Sim.DAY,
    now = S.x(st.t);
  let head = '';
  for (let i = 0; i < S.n; i++) {
    const c = Sim.cal((S.day0 + i) * D),
      first = i === 0 || c.sday === 0,
      word = i === 0 ? 'Today' : first ? `${LANE_SEASONS[c.season]} ${c.sday + 1}` : String(c.sday + 1);
    head +=
      `<span class="${i >= LANE.full ? 'far' : ''}${c.sday === 0 && i ? ' turn' : ''}" style="left:${lanePct(S.at[i])};width:${lanePct(S.w[i])}"` +
      ` title="${esc(laneDate((S.day0 + i) * D))}">${S.w[i] >= 5 || first ? esc(word) : ''}</span>`;
  }
  // the columns behind the rows: the full days and the compressed rest
  const grid = S.at
    .slice(1, -1)
    .map((v, i) => `<i class="${i + 1 >= LANE.full ? 'far' : ''}" style="left:${lanePct(v)}"></i>`)
    .join('');
  // a deadline's mark: an icon on a line at its hour, past the lane's end at the end with an arrow
  const dead = (d, pc, late, name) => {
    const out = d.t >= S.end,
      x = out ? 100 : S.x(d.t);
    return (
      `<button type="button" class="u2-ldead${late ? ' late' : ''}${out ? ' out' : ''}" data-pc="${esc(pc)}" style="left:${lanePct(x)}"` +
      ` aria-label="${esc(`${name}: deadline, ${d.what}, ${laneDate(d.t)}`)}" title="${esc(`${d.what}, ${laneDate(d.t)}`)}">${laneDeadIcon(d)}</button>`
    );
  };
  let rows = '';
  P.tasks.forEach((t, i) => {
    const e = hudTaskEntry(A, t),
      s = steps[i],
      v = e ? hudVerdict(e) : null,
      d = laneDeadline(e),
      risk = s && s.state === 'at-risk',
      name = `${i + 1}. ${hudKind(t.kind)}`,
      pc = `t:${i}`,
      sel = hud.pc === pc ? ' sel' : '',
      riskMark = (left) =>
        `<button type="button" class="u2-lrisk" data-pc="${pc}" style="left:${left}" ` +
        `aria-label="${esc(`${name}: at risk`)}" title="At risk">!</button>`;
    let r = '';
    if (e && Number.isFinite(e.ends) && Number.isFinite(e.starts)) {
      const a = S.x(Math.max(st.t, e.starts)),
        b = Math.max(a + 0.5, S.x(e.ends)),
        hi = laneHi(e, P),
        c = hi === null ? b : Math.max(b, S.x(hi)),
        more = (hi === null ? e.ends : hi) >= S.end;
      r +=
        `<button type="button" class="u2-lbar v${HUD_VERDICT[v] || 0}${v ? '' : ' none'}${more ? ' more' : ''}${sel}" data-pc="${pc}" ` +
        `style="left:min(${lanePct(a)}, 100% - 22px);width:${lanePct(c - a)};--mid:${(((b - a) / Math.max(0.01, c - a)) * 100).toFixed(1)}%" ` +
        `aria-label="${esc(`${name}: ${laneDate(e.starts)} to ${laneDate(e.ends)}${v ? `, ${v}` : ''}`)}" title="${esc(name)}">` +
        `${hudTaskIcon(t)}</button>`;
      if (risk) r += riskMark(`min(${lanePct(c)}, 100% - 9px)`);
    } else
      r +=
        `<button type="button" class="u2-lbar unlaid${sel}" data-pc="${pc}" style="left:0;width:22px" ` +
        `aria-label="${esc(`${name}: not laid in the days ahead`)}" title="${esc(name)}">${hudTaskIcon(t)}</button>` +
        (risk ? riskMark('24px') : '');
    if (d) r = dead(d, pc, v === 'late', name) + r;
    rows += `<div class="u2-lrow">${r}</div>`;
  });
  for (const g of gaps) {
    const pc = `g:${g.tile}`,
      name = HUD_CHAIN[g.goal].name,
      b = g.deadline.t >= S.end ? 100 : S.x(g.deadline.t),
      span = `left:${lanePct(now)};width:${lanePct(Math.max(3, b - now))}`;
    rows +=
      `<div class="u2-lrow">${dead(g.deadline, pc, false, name)}` +
      `<button type="button" class="u2-lgap${hud.pc === pc ? ' sel' : ''}" data-pc="${pc}" style="${span}" ` +
      `aria-label="${esc(`${name}: nothing planned, ${laneDays(g.days)} left before ${g.deadline.what}`)}" title="${esc(`${name}: nothing planned`)}">` +
      `${HUD_CHAIN[g.goal].icon()}</button></div>`;
  }
  return `<div class="u2-lhead">${head}</div><div class="u2-lbody">${grid}<u style="left:${lanePct(now)}"></u>${rows}</div>`;
}
function renderAhead(A, P) {
  const html = P && A && P.followed ? laneHTML(A, P) : '';
  u2.ahead.hidden = !html;
  if (html && html !== hud.aheadHTML) {
    const top = u2.ahead.scrollTop;
    u2.ahead.innerHTML = hud.aheadHTML = html;
    u2.ahead.scrollTop = top;
  }
}
// The lane's words in a task's card: when it is laid, the range, the deadline, and the risk.
function laneTaskWords(e, i) {
  const out = [];
  if (e && Number.isFinite(e.starts) && Number.isFinite(e.ends)) {
    const hi = laneHi(e, hudPlanned()),
      same = hi !== null && Math.floor(hi / Sim.DAY) === Math.floor(e.ends / Sim.DAY);
    out.push(
      `On the lane: from ${laneDate(Math.max(st.t, e.starts))} to ${laneDate(e.ends)}` +
        (hi !== null && !same ? `, or as late as ${laneDate(hi)} if it goes slowly (the striped end)` : '') +
        '.',
    );
  } else out.push('Not laid in the days ahead: it cannot be begun as things stand.');
  const d = laneDeadline(e);
  if (d) {
    const n = Math.floor(d.t / Sim.DAY) - Math.floor(st.t / Sim.DAY);
    out.push(
      `Its deadline (the mark behind it): ${d.what}, ${laneDate(d.t)}, ${n <= 0 ? 'today' : `in ${laneDays(n)}`}.`,
    );
  } else if (e) out.push('No deadline presses on it.');
  const s = laneSteps()[i];
  if (s && s.state === 'at-risk') {
    const h = s.risk ? Math.max(1, Math.round(s.risk.short)) : null;
    out.push(
      `At risk (the red mark): ${h ? `${h} ${h === 1 ? 'hour' : 'hours'} short` : 'short'} of being done` +
        (Number.isFinite(s.by) ? ` by ${laneDate(s.by * Sim.DAY)}` : '') +
        ', by the settler’s own estimate.',
    );
  }
  return out.join(' ');
}
// The card of a window with nothing planned: what presses, by when, and the act that plans it, the callout's own.
function laneGapCard(tile) {
  const g = hudGaps().find((x) => x.tile === tile);
  if (!g) return null;
  const C = HUD_CHAIN[g.goal];
  return {
    title: `Nothing planned: ${C.name.toLowerCase()}`,
    sub:
      `An empty window on the lane: ${g.deadline.what} comes ${g.days <= 0 ? 'today' : `in ${laneDays(g.days)}`} ` +
      `(${laneDate(g.deadline.t)}, the mark at its end), and no task of the plan sees to it.`,
    acts:
      `<button type="button" class="u2-chip go" data-hud="chain" data-chain="${esc(g.goal)}" data-tile="${g.tile}">${esc(C.offer)}</button>` +
      `<button type="button" class="u2-chip" data-hud="fly" data-tile="${g.tile}">Show</button>`,
  };
}
// ---- a reorder's knock-on, before it lands ----
// The tasks whose verdict a move of the plan's task `from` to `to` makes worse: the move made on a copy of the state (Sim views write
// nothing; the copy is let go), the agenda read again. [{noun, from, to, deadline}].
function laneKnock(from, to) {
  const id = st.player.pawn,
    P = hudPlanned(),
    A = Sim.agenda(st, id);
  let c;
  try {
    c = structuredClone(st);
  } catch (e) {
    return [];
  }
  if (Sim.plan(c, id, 'move', { from, to }) !== true) return [];
  const P2 = Sim.planView(c, id),
    A2 = Sim.agenda(c, id),
    same = (a, b) => a.kind === b.kind && a.site === b.site && (a.key === b.key || !!HUD_CHAIN[a.kind]),
    out = [];
  P.tasks.forEach((t) => {
    const j = P2.tasks.findIndex((u) => same(t, u)),
      e = hudTaskEntry(A, t),
      e2 = j >= 0 ? hudTaskEntry(A2, P2.tasks[j]) : null,
      v = e ? hudVerdict(e) : null,
      v2 = e2 ? hudVerdict(e2) : null,
      d = laneDeadline(e2) || laneDeadline(e);
    if (v2 && d && (HUD_VERDICT[v2] || 0) > (HUD_VERDICT[v] || 0))
      out.push({ noun: laneNoun(t), from: v, to: v2, deadline: d });
  });
  return out;
}
const laneKnockWords = (k) =>
  `${k.noun} becomes ${k.to === 'late' ? 'late' : 'tight'} for ${k.deadline.what} (${laneDate(k.deadline.t)}).`;
