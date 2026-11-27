// @sys page/ui2day: the new interface's Today row: what the plan makes of today as a thin row of icons in order, and the two days after
// Read from the agenda's layout (Sim.agenda(st, st.player.pawn).days, VB-1647: the plan laid as the settler will follow it, at its own estimate)
// and the plan's view (Sim.planView). Icons first (Kim, 27 Nov: "informational text should be used sparingly, and only after at least one
// click"): the routine's kinds (faded once done today), the work of the day in its order (the piece under way with a "now" mark), the night
// as the moon. Laid in order, not by the hour: no piece overlaps another, and the night is not cut at midnight (round 4). A task broken off
// at nightfall and taken up again carries a small meter of its work done against its work left: a cut is ordinary, not a warning (design.md
// section 1, The core loop). A tap on an icon opens its card in the plan bar (page/ui2plan), where its hours and words are.
const DAY_WORD = ['Today', 'Tomorrow'];
// The plan's task a segment of the layout is part of (a task at a tile by its tile, else by its job's key), or -1.
const dayTaskOf = (P, g) =>
  P.tasks.findIndex((t) => (g.key && t.key === g.key) || (HUD_CHAIN[t.kind] && t.site === g.site && g.site >= 0));
// A task's work carried over from an earlier day: {done, left} in working hours (its job posted before today and part done), or null.
function dayResumed(A, t) {
  const e = hudTaskEntry(A, t),
    j = e && e.key ? st.jobs.get(e.key) : null;
  if (!j || !(j.posted < Math.floor(st.t / Sim.DAY) * Sim.DAY) || !e.hours) return null;
  const hours = j.hours ?? (Sim.KINDS[j.kind] && Sim.KINDS[j.kind].hours) ?? 0,
    done = VB['sim/progress'].doneOf(st, j, hours);
  return done > 0.5 ? { done, left: e.hours.mid } : null;
}
// A small meter of a resumed task: the share of its work done, a slice of a ring.
function dayMeter(r) {
  const f = Math.max(0.05, Math.min(0.95, r.done / Math.max(1e-9, r.done + r.left))),
    a = f * 2 * Math.PI,
    x = 6 + 5 * Math.sin(a),
    y = 6 - 5 * Math.cos(a);
  return (
    '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5"/>' +
    `<path d="M6 6V1A5 5 0 ${f > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}z"/></svg>`
  );
}
// A span of working hours in words, in game days past most of a day's work ("about 1½ game days").
const dayGame = (h) => {
  const L = Sim.WORK[1] - Sim.WORK[0];
  if (h < L * 0.75) return `${Math.max(1, Math.round(h))} ${Math.round(h) === 1 ? 'hour' : 'hours'}`;
  const n = laneSpanN(h);
  return `${n} ${n === '1' ? 'game day' : 'game days'}`;
};
// The spans of hours piece `pc` takes today by the layout: [[from, to], ...] in hours of the day, empty when it has none today.
function daySpanToday(A, P, pc) {
  const from = Math.floor(st.t / Sim.DAY) * Sim.DAY,
    out = [];
  for (const g of (A && A.days && A.days[0]) || []) if (dayPc(P, g) === pc) out.push([g.from - from, g.to - from]);
  return out;
}
// The plan bar's chip a segment opens: 'sleep', 'r:<kind>', 't:<task>' or 'q:<command>'; '' for none.
function dayPc(P, g) {
  if (g.what === 'sleep') return 'sleep';
  if (g.what === 'routine') return `r:${g.kind}`;
  if (g.what === 'task') {
    const i = dayTaskOf(P, g);
    return i >= 0 ? `t:${i}` : '';
  }
  if (g.what === 'queue') {
    const i = Sim.controlOf(st, st.player.pawn).queue.findIndex((q) => !q.plan && q.target === g.key);
    return i >= 0 ? `q:${i}` : '';
  }
  return '';
}
// What the settler is on now, as a chip's key: the plan's piece under way, else the night while it sleeps.
function dayNow(P, segs) {
  const n = P.now;
  if (n && n.what === 'routine') return `r:${n.kind}`;
  if (n && n.what === 'task') {
    const i = P.tasks.findIndex((t) => (n.key && t.key === n.key) || (HUD_CHAIN[t.kind] && t.kind === n.kind));
    if (i >= 0) return `t:${i}`;
  }
  if (n && n.what === 'sleep') return 'sleep';
  const g = segs[0];
  return g && g.what === 'sleep' && g.from <= st.t + 0.05 ? 'sleep' : '';
}
// A day's pieces in order, each once: [{pc, what, kind}]; today first the routine done, last the routine with nothing of it yet.
function dayPieces(P, segs, today) {
  const out = [],
    seen = new Set(),
    add = (x) => {
      if (!x.pc || seen.has(x.pc)) return;
      seen.add(x.pc);
      out.push(x);
    };
  if (today)
    for (const r of P.routine) if (r.done) add({ pc: `r:${r.kind}`, what: 'routine', kind: r.kind, done: true });
  for (const g of segs) if (g.what !== 'free') add({ pc: dayPc(P, g), what: g.what, kind: g.kind });
  if (today) {
    const night = out.findIndex((x) => x.pc === 'sleep' && x !== out[0]),
      rest = P.routine
        .filter((r) => !seen.has(`r:${r.kind}`))
        .map((r) => ({ pc: `r:${r.kind}`, what: 'routine', kind: r.kind, wait: true }));
    rest.forEach((x) => seen.add(x.pc));
    out.splice(night >= 0 ? night : out.length, 0, ...rest);
    if (P.sleep && !seen.has('sleep')) out.push({ pc: 'sleep', what: 'sleep' });
  }
  return out;
}
function dayStripHTML(A, P) {
  if (!A || !A.days || !A.days.length) return '';
  const rows = hud.days3 ? A.days : A.days.slice(0, 1);
  let h = '';
  rows.forEach((segs, n) => {
    const owed = A.owed && Number.isFinite(A.owed[n]) ? Math.round(A.owed[n]) : 0,
      now = n === 0 ? dayNow(P, segs) : '',
      from = (Math.floor(st.t / Sim.DAY) + n) * Sim.DAY;
    h += `<div class="u2-day"><span class="u2-dayname">${DAY_WORD[n] || `Day ${Sim.cal(from).sday + 1}`}</span><div class="u2-dayrow">`;
    for (const x of dayPieces(P, segs, n === 0)) {
      const ti = x.pc.startsWith('t:') ? +x.pc.slice(2) : -1,
        t = ti >= 0 ? P.tasks[ti] : null,
        q = x.pc.startsWith('q:') ? Sim.controlOf(st, st.player.pawn).queue[+x.pc.slice(2)] : null,
        name = t ? laneShort(t) : q ? `Now: ${commandWords(q)}` : hudKind(x.what === 'sleep' ? 'sleep' : x.kind),
        icon = t ? hudTaskIcon(t) : actIcon(x.what === 'sleep' ? 'idle' : KIND_ICON[x.kind] || 'hoe'),
        res = n === 0 && t ? dayResumed(A, t) : null,
        on = x.pc === now,
        aria = `${name}${x.done ? ', done' : ''}${on ? ', now' : ''}${res ? ', taken up again' : ''}`;
      h +=
        `<button type="button" class="u2-dpc ${x.what}${x.done ? ' done' : ''}${x.wait ? ' wait' : ''}${on ? ' now' : ''}" data-pc="${esc(x.pc)}" ` +
        `aria-pressed="${hud.pc === x.pc}" aria-label="${esc(aria)}" title="${esc(name)}">` +
        `${icon}${res ? `<i class="u2-dres">${dayMeter(res)}</i>` : ''}</button>`;
    }
    h += `</div><span class="u2-dayowed${owed >= 16 ? ' press2' : owed >= 8 ? ' press1' : ''}">${owed >= 8 ? `${actIcon('idle')}${owed}` : ''}</span></div>`;
  });
  return h;
}
// The facts the Today row adds to a card (page/ui2plan planCard): the hours piece `pc` takes today, and for a task taken up again, its
// work done against its work left.
function dayFacts(A, P, pc, t) {
  const out = [],
    sp = daySpanToday(A, P, pc),
    hr = (h, up) => hudHour(up ? Math.ceil(h) % 24 : Math.floor(h));
  if (sp.length) {
    const a = hr(sp[0][0]),
      b = hr(sp[sp.length - 1][1], true),
      words = sp.map(([x, y]) => `${hr(x)} to ${hr(y, true)}`).join(', ');
    out.push({
      k: 'today',
      icon: actIcon('clock'),
      n: `${a.slice(0, 2)}–${b.slice(0, 2)}`,
      label: `Today ${words}`,
      why: `Today: ${words}, by the settler’s own estimate. In the Today row, in its turn.`,
    });
  }
  const r = t ? dayResumed(A, t) : null;
  if (r)
    out.push({
      k: 'resume',
      icon: `<span class="u2-dres">${dayMeter(r)}</span>`,
      n: `${laneSpanN(r.done)}/${laneSpanN(r.left)}`,
      label: 'Taken up again',
      why: `Broken off at nightfall and taken up again: ${dayGame(r.done)} done, ${dayGame(r.left)} left. Nothing is lost by the night.`,
    });
  return out;
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
