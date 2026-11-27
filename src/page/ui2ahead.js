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
        ? actIcon('hay')
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
      // the lane's own word: a task whose end falls past its window, or tight with its deadline in the days at full width, is marked
      // though the plan's step is not at risk (a harvest is laid on the ripening, which may fall a day before the frost)
      late = v === 'late',
      near = v === 'tight' && d && d.t < (S.day0 + LANE.full) * D,
      risk = (s && s.state === 'at-risk') || late || near,
      name = `${i + 1}. ${hudKind(t.kind)}`,
      pc = `t:${i}`,
      sel = hud.pc === pc ? ' sel' : '',
      keep = s && s.kept ? `<i class="u2-lkeep" aria-label="Kept">${actIcon('pin')}</i>` : '',
      riskMark = (left) =>
        `<button type="button" class="u2-lrisk" data-pc="${pc}" style="left:${left}" ` +
        `aria-label="${esc(`${name}: ${late ? 'too late' : 'at risk'}`)}" title="${late ? 'Too late' : 'At risk'}">!</button>`;
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
        `${hudTaskIcon(t)}${keep}</button>`;
      if (risk) r += riskMark(`min(${lanePct(c)}, 100% - 9px)`);
    } else
      r +=
        `<button type="button" class="u2-lbar unlaid${sel}" data-pc="${pc}" style="left:0;width:22px" ` +
        `aria-label="${esc(`${name}: not laid in the days ahead`)}" title="${esc(name)}">${hudTaskIcon(t)}${keep}</button>` +
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
// ---- the task's card: icons and numbers first, the words behind its "i" (Kim, 27 Nov: "informational text should be used sparingly, and
// only after at least one click") ----
// A fact of the card: {k, icon (HTML), n (a number or '' beside it), cls, label (its name to a screen reader), why (its sentence, shown on
// a tap of the chip or of "i"), chip (false: a sentence behind "i" with no chip of its own)}. Every chip has its why: missing information
// on expansion is a bug.
// A task's short name, a label: "Harvest", "Cottage".
const LANE_SHORT = {
  plant: 'Plant',
  hay: 'Hay',
  harvest: 'Harvest',
  farmstead: 'Farmstead',
  fell: 'Felling',
  firewood: 'Firewood',
  upgrade: 'Build',
  foundation: 'Foundation',
  outbuilding: 'Outbuilding',
};
const laneShort = (t) =>
  (t.kind === 'upgrade' || t.kind === 'outbuilding') && t.what && LADDER[t.what]
    ? LADDER[t.what].name
    : LANE_SHORT[t.kind] || hudKind(t.kind);
// A span of working hours as a chip's number: hours under a day's work ("5h"), else game days to the half ("1½").
const laneSpanN = (h) =>
  hudSpan(h)
    .replace(/ days?$/, '')
    .replace(/ h$/, 'h');
// The day of the season a game hour falls on: the chip's number for a date.
const laneDayN = (t) => String(Sim.cal(t).sday + 1);
// A second date after a first: its day alone in the same season ("10"), else in full.
const laneDayOf = (a, b) => (Sim.cal(a).season === Sim.cal(b).season ? laneDayN(b) : laneDate(b));
// Whole game days from today to game hour t (0: today).
const laneIn = (t) => Math.floor(t / Sim.DAY) - Math.floor(st.t / Sim.DAY);
const laneInWords = (t) => {
  const n = laneIn(t);
  return n <= 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${laneDays(n)}`;
};
const LANE_VERDICT_ICON = { 'in time': 'vok', tight: 'vtight', late: 'vlate' };
const laneVerdictIcon = (v) => actIcon(LANE_VERDICT_ICON[v] || 'vok');
// A deadline as a fact: its icon and its day.
const laneDeadFact = (d, cls = '') => ({
  k: 'dead',
  icon: laneDeadIcon(d),
  n: laneDayN(d.t),
  cls,
  label: `Deadline: ${d.what}, ${laneDate(d.t)}`,
  why: `Deadline: ${d.what}, ${laneDate(d.t)} (${laneInWords(d.t)}). On the lane, the mark behind the bar.`,
});
// What a task waits for, as a fact: the hourglass, and beside it what it waits for and when.
function laneWaitFact(x) {
  const why = hudWaits(x),
    f = { k: 'wait', icon: actIcon('wait'), n: '', label: why, why };
  if (x.why === 'opens') {
    const n = laneIn(x.t);
    f.n = n <= 0 ? hudHour(Math.floor(x.t % Sim.DAY)) : String(n);
  } else if (x.why === 'before') ((f.icon += actIcon('queue')), (f.n = String(x.i + 1)));
  else if (x.why === 'routine' || x.why === 'vital') f.icon += actIcon(KIND_ICON[x.kind] || 'hoe');
  else if (x.why === 'sleep') ((f.icon += actIcon('idle')), (f.n = hudHour(x.until)));
  else if (x.why === 'hand') f.icon += actIcon('walk');
  return f;
}
// An agenda entry's verdict as a fact: the coloured ring (green in time, gold tight, red late), or null.
function laneVerdictFact(e) {
  const v = hudVerdict(e),
    d = laneDeadline(e);
  if (!v) return null;
  const word = v === 'late' ? 'Too late' : v === 'tight' ? 'Tight' : 'In time';
  return {
    k: 'verdict',
    icon: laneVerdictIcon(v),
    n: '',
    cls: `v${HUD_VERDICT[v]}`,
    label: v,
    why:
      `${word} for ${d ? d.what : 'its deadline'}` +
      (e.then ? `, ${e.then.crop} sown` : '') +
      ', by the settler’s estimate. Green in time, gold tight, red late.',
  };
}
// An agenda entry's work as a fact: the stopwatch and its span, the chain's steps to sowing counted in.
function laneWorkFact(e) {
  const more = e.then ? e.then.steps.reduce((n, x) => n + x.hours.mid, 0) : 0,
    steps = e.steps && e.steps.length ? e.steps.map((x) => hudKind(x.kind).toLowerCase()).join(', ') : '';
  return {
    k: 'work',
    icon: actIcon('clock'),
    n: laneSpanN(e.hours.mid + more),
    label: `${hudSpan(e.hours.mid + more)} of work`,
    why:
      `Work: about ${hudSpan(e.hours.mid)}` +
      (e.hours.hi > e.hours.mid ? `, ${hudSpan(e.hours.hi)} if it goes slowly` : '') +
      (steps ? ` (${steps})` : '') +
      (e.rough ? ', roughly' : '') +
      (more ? `, then ${hudSpan(more)} more until ${e.then.crop} is sown` : '') +
      '.',
  };
}
// The facts of the plan's task i: what it waits for, its verdict, its work, its deadline, at risk; then the lane's and the pin's words.
function laneTaskFacts(t, e, i) {
  const out = [],
    v = e ? hudVerdict(e) : null,
    d = laneDeadline(e);
  if (HUD_CHAIN[t.kind] && t.step) {
    const nx = hudKind(t.step).toLowerCase();
    out.push({
      k: 'step',
      icon: actIcon('next') + actIcon(KIND_ICON[t.step] || 'hoe'),
      n: '',
      label: `Next: ${nx}`,
      why: `Next step: ${nx}.`,
    });
  }
  const rf = recipeFact(t.kind, 'recipe');
  if (rf) out.push(rf);
  if (t.waits) out.push(laneWaitFact(t.waits));
  if (v) out.push(laneVerdictFact(e));
  if (e && e.hours) out.push(laneWorkFact(e));
  if (d) out.push(laneDeadFact(d, v === 'late' ? 'v2' : ''));
  const s = laneSteps()[i];
  if (s && s.state === 'at-risk') {
    const h = s.risk ? Math.max(1, Math.round(s.risk.short)) : null;
    out.push({
      k: 'risk',
      icon: '<s>!</s>',
      n: h ? `${h}h` : '',
      cls: 'risk',
      label: 'At risk',
      why:
        `At risk: ${h ? `${h} ${h === 1 ? 'hour' : 'hours'} short` : 'short'} of being done` +
        (Number.isFinite(s.by) ? ` by ${laneDate(s.by * Sim.DAY)}` : '') +
        (s.kept
          ? '. Kept: the household will not take it back, so it stays yours to finish or to leave undone.'
          : '. Unless it is kept, it may leave your plan once that day is past, and the household sees to it instead.') +
        ' On the lane, the red mark.',
    });
  }
  if (!e && !t.waits)
    out.push({ k: 'shut', icon: actIcon('wait'), n: '', label: 'Not open now', why: 'Its work is not open now.' });
  // behind "i" only: when it is laid on the lane, and how its pin reads on the land
  if (e && Number.isFinite(e.starts) && Number.isFinite(e.ends)) {
    const hi = laneHi(e, hudPlanned()),
      same = hi === null || Math.floor(hi / Sim.DAY) === Math.floor(e.ends / Sim.DAY);
    out.push({
      k: 'lane',
      chip: false,
      icon: hudTaskIcon(t),
      why:
        `On the lane: ${laneDate(Math.max(st.t, e.starts))} to ${laneDayOf(e.starts, e.ends)}` +
        (same ? '' : `, ${laneDayOf(e.ends, hi)} if slow (the striped end)`) +
        '.',
    });
  } else if (e) out.push({ k: 'lane', chip: false, icon: hudTaskIcon(t), why: 'Not laid in the days ahead.' });
  if (e && e.why) out.push({ k: 'site', chip: false, icon: goodIcon('tile'), why: `${siteCap(e.why)}.` });
  out.push({
    k: 'place',
    chip: false,
    icon: `<s class="sq">${i + 1}</s>`,
    why:
      `Number ${i + 1} in the plan: its pin's square on the land` +
      (e && Number.isFinite(e.ends) ? `; the round number, the days until it is done (${hudDaysTo(e.ends)})` : '') +
      '.',
  });
  return out;
}
// The card of a window with nothing planned: its icon, its deadline and the days left, and the act that plans it, the callout's own.
function laneGapCard(tile) {
  const g = hudGaps().find((x) => x.tile === tile);
  if (!g) return null;
  const C = HUD_CHAIN[g.goal],
    icon = `<span class="gap">${C.icon()}</span>`;
  return {
    title: LANE_SHORT[g.goal] || C.name,
    icon,
    facts: [
      { k: 'gap', chip: false, icon, why: 'Nothing in the plan sees to it: an empty window on the lane, dashed.' },
      laneDeadFact(g.deadline),
      {
        k: 'left',
        icon: actIcon('wait'),
        n: String(Math.max(0, g.days)),
        label: `${laneDays(g.days)} left`,
        why: `${laneDays(Math.max(0, g.days))} left before ${g.deadline.what}.`,
      },
    ],
    acts:
      `<button type="button" class="u2-chip go" data-hud="chain" data-chain="${esc(g.goal)}" data-tile="${g.tile}" ` +
      `aria-label="${esc(C.offer)}" title="${esc(C.offer)}">${actIcon('plus')}${C.icon()}Plan</button>` +
      `<button type="button" class="u2-chip" data-hud="fly" data-tile="${g.tile}">${actIcon('target')}Show</button>`,
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
      out.push({ noun: laneNoun(t), icon: hudTaskIcon(t), from: v, to: v2, deadline: d });
  });
  return out;
}
const laneKnockWords = (k) =>
  `${k.noun} becomes ${k.to === 'late' ? 'late' : 'tight'} for ${k.deadline.what} (${laneDate(k.deadline.t)}).`;

// ---- keep (VB-1755: the verb plan's op keep) ----
// The Keep toggle of the plan's task i: the pin, pressed while kept (the household never takes it back).
function laneKeepButton(i) {
  const s = laneSteps()[i],
    on = !!(s && s.kept);
  return (
    `<button type="button" class="u2-chip keep" data-hud="pkeep" data-i="${i}" data-on="${on ? '' : '1'}" aria-pressed="${on}" ` +
    `aria-label="${on ? 'Kept: tap to let go' : 'Keep: the household never takes it back'}" title="Keep">${actIcon('pin')}Keep</button>`
  );
}
