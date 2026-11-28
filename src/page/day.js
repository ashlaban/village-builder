// @sys page/day: the day's timetable in the Plan tab of a household's card (VB-477; design.md section 7, The timetable): each member's row,
// its tasks laid end to end with their walks, each a range by the inhabited pawn's estimate (principle "The future is someone's estimate": whose reckoning
// it is is said;
// progress so far is exact), and, for the played pawn that is the head, the head's verbs on the day (Sim.head: dayOrder, assign,
// call), a call named with its cost before it is made (Sim.callCost)
// ======== the day ========
// The page's own state: the call asked that waits for its confirmation (calling, {member, key: the task called to, or null for home}, or
// null), and the member
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
      )}${planBtn({ plan: 'dayOrder', member: r.id, from, to: down }, '↓', `Leave ${e.label.toLowerCase()} till later`, down >= 0)}${
        // the head's call to this task now (VB-1926): its kinds and their costs are named first (callHTML)
        planBtn(
          { plan: 'callAsk', member: r.id, key: e.key },
          'Call…',
          `Call ${Sim.fullName(st.pawns[r.id])} to ${e.label.toLowerCase()} now: see what it costs first`,
          !now && !e.side,
        )
      }` +
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
  return `<li class="day-entry${now ? ' now' : ''}"${title}><span class="day-what">${what}</span>${ctl}${mine ? callHTML(r.id, e.key) : ''}</li>`;
}
// The two kinds of call (VB-1926; design.md section 15, Icon and label first): an icon and its label with the hours it costs, the
// sentence one tap in. Not urgent: the load in hand is brought in first (the wait); urgent: the load is left where it stands, a pile,
// and the walk out and back to fetch it is the cost.
function callKinds(c, name, what) {
  const calm = c.come ? c.come.calm : c.bring,
    now = c.come ? c.come.now : c.walk,
    load = Math.round(c.load * 10) / 10;
  const kind = (icon, label, n, sentence) =>
    `<details class="day-kind"><summary>${actIcon(icon)} <b>${esc(label)}</b> <span class="day-hours">${esc(n)}</span></summary>` +
    `<p class="card-note">${esc(sentence)}</p></details>`;
  if (!(c.load > 0))
    return kind(
      'walk',
      'Now',
      dayHours(now),
      `${name} carries nothing: it ${what} at once, in about ${dayHours(now)}.`,
    );
  return (
    kind(
      'wait',
      'Load first',
      dayHours(calm),
      `${name} brings the ${load} it carries to the store first, and ${what} in about ${dayHours(calm)}, aiming within the hour.`,
    ) +
    kind(
      'walk',
      'At once',
      `${dayHours(now)}, load left`,
      `${name} sets the ${load} it carries down where it stands and ${what} in about ${dayHours(now)};` +
        ` fetching it is ${dayHours(c.fetch)} out and back.`,
    )
  );
}
// The call of member id (to task `key`, or home when null): a button that asks, then its kinds with their costs and the confirmation
// (the call is made on the second press).
function callHTML(id, key = null) {
  const name = Sim.fullName(st.pawns[id]);
  if (!calling || calling.member !== id || calling.key !== key) {
    if (key !== null) return '';
    const ask = `Call ${name} home: see what it costs first`;
    return `<p class="plan-ctl menu">${planBtn({ plan: 'callAsk', member: id }, 'Call home…', ask, true, 'wide')}</p>`;
  }
  const c = Sim.callCost(st, id, dayViewer(), key);
  if (!c || (key !== null && !c.come)) return '';
  const label = key !== null ? Sim.KINDS[st.jobs.get(key).kind].label.toLowerCase() : null,
    what = key !== null ? `is at ${label}` : 'is home',
    data = key !== null ? { plan: 'call', member: id, key } : { plan: 'call', member: id },
    words = [
      c.task && c.left
        ? `its task in hand, ${dayRange(c.left)} left by ${dayWhose()} reckoning, waits`
        : 'it has no task in hand',
    ];
  if (key === null) words.unshift(c.walk > 0 ? `${name} walks home ${dayHours(c.walk)}` : `${name} is at home`);
  const go = key !== null ? `Call ${name} to ${label}` : `Call ${name} home`;
  return (
    `<div class="card-note day-cost" role="status"><details class="day-kind"><summary>A call costs:</summary>` +
    `<p class="card-note">${esc(`${words.join('; ')}.`)}</p></details>${callKinds(c, name, what)}</div>` +
    `<p class="plan-ctl menu">${planBtn(data, c.load > 0 ? 'Load first' : 'Call', go, true, 'wide')}${
      c.load > 0 ? planBtn({ ...data, urgent: 1 }, 'At once', `${go} at once, the load set down`, true, 'wide') : ''
    }${planBtn({ plan: 'callNo' }, 'Leave at work', `Leave ${name} at its work`, true, 'wide')}</p>`
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
cardRow('person', 80, taskLine); // the person card's last line (page/cardrows)
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
    calling = { member: +d.member, key: d.key === undefined ? null : d.key };
    return undefined;
  }
  if (d.plan === 'callNo') {
    calling = null;
    return undefined;
  }
  if (d.plan === 'call') {
    calling = null;
    const args = d.key === undefined ? { member: +d.member } : { member: +d.member, key: d.key };
    return Sim.head(st, st.player.pawn, 'call', d.urgent ? { ...args, urgent: true } : args);
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
