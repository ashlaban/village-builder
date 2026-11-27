// @sys page/day: the day's timetable in the Plan tab of a household's card (VB-477; design.md section 7, The timetable): each member's row,
// its tasks laid end to end with their walks, each a range by the inhabited pawn's estimate (principle "The future is someone's estimate": whose reckoning
// it is is said;
// progress so far is exact), and, for the played pawn that is the head, the head's verbs on the day (Sim.head: dayOrder, assign,
// call), a call named with its cost before it is made (Sim.callCost)
// ======== the day ========
// The page's own state: the member whose call is asked and waits for its confirmation (calling, a pawn id, or null), and the member
// chosen in each Give list (daySel: "member:key" to a pawn id), kept across the tab's redraws.
let calling = null;
const daySel = new Map();
// Hours in words: minutes under an hour, else to the half hour.
const dayHours = (h) => (h < 1 ? `${Math.max(0, Math.round(h * 60))} min` : `${Math.round(h * 2) / 2} h`);
// A range {lo, mid, hi} in words: its two ends, or one where they round alike.
function dayRange(r) {
  const lo = dayHours(r.lo),
    hi = dayHours(r.hi);
  return lo === hi ? lo : `${lo} to ${hi}`;
}
// Who reckons: the inhabited pawn, else the household's head.
const dayViewer = () => (st.player && st.pawns[st.player.pawn].died === null ? st.player.pawn : null);
// One entry of a member's row: its name, its walk, its range, its share done, and, for the head, its controls.
function dayEntry(T, r, k, list, mine) {
  const e = r.entries[k],
    now = r.now === e.key,
    bits = [];
  if (e.walk >= 0.05) bits.push(`walk ${dayHours(e.walk)}`);
  if (e.side) bits.push('held beside its work');
  else bits.push(`${dayRange(e)}${e.part ? ', a part of it' : ''}`);
  if (e.done > 0) bits.push(`${Math.round(e.done * 100)}% done`);
  let ctl = '';
  if (mine) {
    const from = list.indexOf(e.key),
      up = k > 0 ? list.indexOf(r.entries[k - 1].key) : -1,
      down = k < r.entries.length - 1 ? list.indexOf(r.entries[k + 1].key) : -1,
      others = T.members.filter((m) => m.id !== r.id),
      sk = `${r.id}:${e.key}`,
      sel = daySel.get(sk);
    ctl =
      `<span class="plan-ctl day-give">${planBtn(
        { plan: 'dayOrder', member: r.id, from, to: up },
        '↑',
        `Take ${e.label.toLowerCase()} earlier in the day`,
        up >= 0,
      )}${planBtn({ plan: 'dayOrder', member: r.id, from, to: down }, '↓', `Leave ${e.label.toLowerCase()} till later`, down >= 0)}` +
      (others.length
        ? `<select class="day-to" data-sel="${esc(sk)}" aria-label="${esc(`Whom to give ${e.label.toLowerCase()} to`)}">${others
            .map(
              (m) =>
                `<option value="${m.id}"${sel === m.id ? ' selected' : ''}>${esc(Sim.fullName(st.pawns[m.id]))}</option>`,
            )
            .join('')}</select>${planBtn(
            { plan: 'assign', key: e.key, from: r.id },
            'Give',
            `Give ${e.label.toLowerCase()} to the member chosen`,
          )}`
        : '') +
      '</span>';
  }
  const title = e.unseen && e.unseen.length ? ` title="${esc(`Not reckoned with: ${e.unseen.join(', ')}`)}"` : '',
    what = `<b>${esc(e.label)}</b> <span class="day-hours">${esc(bits.join(' · '))}</span>`;
  return `<li class="day-entry${now ? ' now' : ''}"${title}><span class="day-what">${what}</span>${ctl}</li>`;
}
// The call of member id: a button that asks, then its cost and the confirmation (the call is made on the second press).
function callHTML(id) {
  if (calling !== id) {
    const ask = `Call ${Sim.fullName(st.pawns[id])} home: see what it costs first`;
    return `<p class="plan-ctl menu">${planBtn({ plan: 'callAsk', member: id }, 'Call home…', ask, true, 'wide')}</p>`;
  }
  const c = Sim.callCost(st, id, dayViewer()),
    name = Sim.fullName(st.pawns[id]);
  if (!c) return '';
  const words = [
    c.walk > 0 ? `${name} walks home ${dayHours(c.walk)}` : `${name} is at home`,
    c.load > 0 ? `the ${Math.round(c.load * 10) / 10} it carries is put down where it stands` : 'it carries nothing',
    c.task && c.left
      ? `its task in hand, ${dayRange(c.left)} left by ${dayWhose()} reckoning, waits`
      : 'it has no task in hand',
  ];
  return (
    `<p class="card-note day-cost" role="status">A call costs: ${esc(words.join('; '))}.</p>` +
    `<p class="plan-ctl menu">${planBtn({ plan: 'call', member: id }, 'Call home now', `Call ${name} home now`, true, 'wide')}${planBtn(
      { plan: 'callNo' },
      'Leave at work',
      `Leave ${name} at its work`,
      true,
      'wide',
    )}</p>`
  );
}
// Whose reckoning the ranges are, in words.
const dayWhose = () => {
  const v = dayViewer();
  return v === null ? 'the head’s' : 'your';
};
// A pawn's task in hand on its card (the audit of VB-477): its share done, exact, and the hours left by the inhabited pawn's reckoning
// (its own, with none played); null with no task.
function taskLine(id) {
  const v = dayViewer(),
    T = Sim.taskLeft(st, id, v);
  if (!T) return null;
  const whose = v === null ? 'its own' : 'your';
  return `${T.label}: ${Math.round(T.done * 100)}% done${T.left ? `, ${dayRange(T.left)} left by ${whose} reckoning` : ''}`;
}
// The Today section: read from Sim.timetable, by the inhabited pawn's estimate (the head's with none played).
function dayHTML(hh, mine) {
  const T = Sim.timetable(st, hh, dayViewer());
  if (!T) return '<p class="card-note">No day is allotted yet.</p>';
  const day = st.plans.households.get(hh.id).day;
  let h = `<p class="card-note">Each task’s hours by ${dayWhose()} reckoning, as a range; what is done so far is exact.</p>`;
  if (T.edited)
    h += `<p class="card-note day-edited">Changed by ${esc(T.edited.who)} at ${clockOf(T.edited.t)}; it stands until the day is next allotted.</p>`;
  for (const r of T.members) {
    const p = st.pawns[r.id],
      list = day.lists[r.id] || [];
    const free = r.free > 0.05 ? ` <span class="day-hours">${esc(`${dayHours(r.free)} free`)}</span>` : '';
    h += `<div class="day-row"><h4 class="day-who">${esc(Sim.fullName(p))}${free}</h4>`;
    h += r.entries.length
      ? `<ol class="day-list">${r.entries.map((e, k) => dayEntry(T, r, k, list, mine)).join('')}</ol>`
      : '<p class="card-note">Nothing given for the day.</p>';
    if (r.rest.length)
      h += `<p class="card-note">When that is done: ${esc(
        r.rest
          .map((k) => st.jobs.get(k))
          .filter(Boolean)
          .map((j) => Sim.KINDS[j.kind].label.toLowerCase())
          .join(', '),
      )}.</p>`;
    if (mine) h += callHTML(r.id);
    h += '</div>';
  }
  return h;
}
// A choice of the day's section, from planClick: its answer, true or why not, or undefined for one that only changes the page.
function dayClick(b, hh) {
  const d = b.dataset;
  if (d.plan === 'callAsk') {
    calling = +d.member;
    return undefined;
  }
  if (d.plan === 'callNo') {
    calling = null;
    return undefined;
  }
  if (d.plan === 'call') {
    calling = null;
    return Sim.head(st, st.player.pawn, 'call', { member: +d.member });
  }
  if (d.plan === 'dayOrder')
    return Sim.head(st, st.player.pawn, 'dayOrder', { member: +d.member, from: +d.from, to: +d.to });
  if (d.plan === 'assign') {
    const s = b.closest('.day-give').querySelector('select.day-to');
    return Sim.head(st, st.player.pawn, 'assign', { key: d.key, from: +d.from, to: +s.value });
  }
  return null;
}
// the member chosen in a Give list is kept across the tab's redraws
$('tileHouse').addEventListener('change', (e) => {
  if (e.target.matches && e.target.matches('select.day-to')) daySel.set(e.target.dataset.sel, +e.target.value);
});
