// @sys page/ui2plan: the new interface's plan bar: every day's routine, the sleeping hours and the tasks in order as a row of icons, each with its card
// ---- the plan: every day's routine, the sleeping hours and the tasks in order, a row of icons; the words are a tap away ----
// Planned by hand (Kim, 24 Nov): the settler follows the plan the player lays (Sim.plan, Sim.planView; VB-1646), automatic planning off.
const HUD_SLEEP = { from: 22, until: 6 };
const hudPlanned = () => (Sim.planView ? Sim.planView(st, st.player.pawn) : null);
// The first morning: automatic planning off, the necessities as the day's routine, and the night for sleep.
function hudBegin() {
  if (!Sim.plan || !st || played() < 0) return;
  Sim.setAuto(st, st.player.pawn, false);
  Sim.plan(st, st.player.pawn, 'routine', { kinds: HUD_DAILY });
  Sim.plan(st, st.player.pawn, 'sleep', HUD_SLEEP);
}
const hudHour = (h) => `${String(((h % 24) + 24) % 24).padStart(2, '0')}:00`;
// the steps of a farmstead's move from its landing (VB-1667), each by what it brings over
const HUD_MOVE = {
  drove: 'Drive the animals over',
  leftCart: 'Fetch the cart',
  leftGrain: 'Fetch the grain',
  leftHay: 'Fetch the hay',
  leftTimber: 'Fetch the wood',
};
const hudKind = (k) =>
  k === 'sleep' ? 'Sleep' : HUD_CHAIN[k] ? HUD_CHAIN[k].name : HUD_MOVE[k] || (Sim.KINDS[k] && Sim.KINDS[k].name) || k;
// An agenda entry for a job's key, wherever the agenda holds it.
// A plan task's entry in the agenda: a plant task by its tile, another by its job's key; and its icon.
// The tasks at a tile that carry a chain of work through (VB-1649, VB-1650): the name, the icon, what the callout offers and says.
const HUD_CHAIN = {
  plant: {
    name: 'Plant a field',
    icon: () => goodIcon('field'),
    offer: 'Plant this field',
    fresh: 'Plant a field here',
    done: 'the field is carried through to its sowing',
  },
  hay: {
    name: 'Make hay',
    icon: () => goodIcon('hay'),
    offer: 'Make hay here',
    fresh: 'Make a hay meadow here',
    done: 'the meadow is mown and its hay brought home',
  },
  farmstead: {
    name: 'Build the farmstead',
    icon: () => actIcon('home'),
    offer: 'Build the farmstead here',
    done: 'the farmstead placed, its timber carried and its shelter raised',
  },
  fell: {
    name: 'Fell timber',
    icon: () => actIcon('chop'),
    offer: 'Fell timber here',
    done: 'timber felled here and carried home',
  },
  firewood: {
    name: 'Cut firewood',
    icon: () => goodIcon('wood'),
    offer: 'Cut firewood',
    done: 'the timber at home cut into firewood',
  },
  upgrade: {
    name: 'Build up the house',
    icon: () => actIcon('build'),
    offer: 'Build',
    done: 'the next building raised until it is finished',
  },
  foundation: {
    name: 'Lay a stone foundation',
    icon: () => goodIcon('stone'),
    offer: 'Build',
    done: 'stone gathered and the house raised onto it',
  },
  outbuilding: {
    name: 'Build an outbuilding',
    icon: () => actIcon('build'),
    offer: 'Build',
    done: 'the barn or the byre built until it stands',
  },
  harvest: {
    name: 'Bring in the harvest',
    icon: () => goodIcon('sheaves'),
    offer: 'Bring in this field',
    done: 'the field is reaped when ripe and carried in',
  },
};
// Why a task of the plan waits (Sim.planView's `waits`, VB-1651), in words; '' while it is worked or next.
const hudClock = (t) => {
  const d = Math.floor(t / Sim.DAY) - Math.floor(st.t / Sim.DAY);
  return d <= 0 ? `at ${hudHour(Math.floor(t % Sim.DAY))}` : d === 1 ? 'tomorrow' : `in ${hudDays(d)}`;
};
function hudWaits(x) {
  if (!x) return '';
  if (x.why === 'hand') {
    const ago = x.since === null ? '' : `, begun ${hudSpan(Math.max(1, st.t - x.since))} ago`;
    return `Waits for the order given by hand (${commandWords(x)})${ago}: it goes first.`;
  }
  if (x.why === 'before') return `Waits its turn: number ${x.i + 1} in the plan is worked first.`;
  if (x.why === 'routine') return `Waits for the day’s routine (${hudKind(x.kind).toLowerCase()}).`;
  if (x.why === 'sleep') return `Waits for the night to end, at ${hudHour(x.until)}.`;
  if (x.why === 'opens') return `Waits for ${x.what}, ${hudClock(x.t)}: nothing of it can be done before.`;
  if (x.why === 'unposted' && x.text) return `Cannot go on now: ${x.text}.`;
  if (x.why === 'unposted') return `Cannot go on now: there is no work open for “${hudKind(x.kind)}” at present.`;
  return `Cannot go on: ${x.text}.`;
}
// Why the plan as a whole has the settler do nothing now though it holds tasks ('' when it works, or holds none).
function hudIdle() {
  const P = hudPlanned();
  return P && P.followed && P.idle && (P.tasks.length || P.idle.why === 'hand') ? hudWaits(P.idle) : '';
}
const hudTaskEntry = (A, t) =>
  HUD_CHAIN[t.kind]
    ? (A && (A.plan || []).find((x) => x.kind === t.kind && x.site === t.site)) || null
    : hudEntry(A, t.key);
const hudTaskIcon = (t) =>
  (t.kind === 'outbuilding' || t.kind === 'upgrade') && t.what && LADDER[t.what] // the building's own icon (page/ui2build)
    ? LADDER[t.what].icon()
    : HUD_CHAIN[t.kind]
      ? HUD_CHAIN[t.kind].icon()
      : actIcon(KIND_ICON[t.kind] || 'hoe');
const hudEntry = (A, key) =>
  A
    ? (A.plan || []).find((x) => x.key === key) ||
      A.queue.find((x) => x.key === key) ||
      A.open.find((x) => x.key === key)
    : null;
function renderPlan() {
  const P = hudPlanned();
  u2.plan.hidden = !P;
  if (!P) return (u2.pcard.hidden = u2.days.hidden = true);
  const S = Sim.sleepOf(st),
    A = Sim.agenda(st, st.player.pawn),
    owed = S ? Math.floor(S.owed) : 0,
    key = [
      Math.floor(st.t * 4),
      hud.pc,
      hud.days3,
      Sim.controlOf(st, st.player.pawn).auto,
      JSON.stringify(P),
      owed,
      hud.msg ? hud.msg.text : '',
    ].join('|');
  if (key === hud.planKey) return;
  hud.planKey = key;
  const now = P.now || {},
    chip = (pc, cls, inner, label) =>
      `<button type="button" class="u2-pc ${cls}" data-pc="${esc(pc)}" aria-pressed="${hud.pc === pc}" ` +
      `aria-label="${esc(label)}" title="${esc(label)}">${inner}</button>`;
  let h = P.routine
    .map((r) =>
      chip(
        `r:${r.kind}`,
        `${r.done ? 'done' : ''}${now.what === 'routine' && now.kind === r.kind ? ' on' : ''}`,
        actIcon(KIND_ICON[r.kind] || 'hoe'),
        `Every day: ${hudKind(r.kind)}`,
      ),
    )
    .join('');
  h += chip(
    'sleep',
    `sleep${P.sleep ? '' : ' off'}${owed >= 16 ? ' press2' : owed >= 8 ? ' press1' : ''}${now.what === 'sleep' ? ' on' : ''}`,
    hudPin(actIcon('idle'), owed >= 8 ? Math.round(S.owed) : ''), // an ordinary evening owes 6: the number shows once a night is owed
    'Sleep',
  );
  h += '<i class="u2-pdiv"></i>';
  // work ordered for now, by hand: it goes before the plan
  h += Sim.controlOf(st, st.player.pawn)
    .queue.map((q, i) =>
      q.plan
        ? ''
        : chip(
            `q:${i}`,
            `task queue${q.begun !== null ? ' on' : ''}`,
            `<s>!</s>${actIcon(KIND_ICON[String(q.target).split(':')[0]] || 'walk')}`,
            `Now: ${commandWords(q)}`,
          ),
    )
    .join('');
  h += P.tasks.length
    ? P.tasks
        .map((t, i) => {
          const e = hudTaskEntry(A, t),
            v = e ? HUD_VERDICT[hudVerdict(e)] || 0 : 0,
            days = e && Number.isFinite(e.ends) ? hudDaysTo(e.ends) : '';
          const held = t.waits && ['refused', 'unposted', 'hand'].includes(t.waits.why);
          return chip(
            `t:${i}`,
            `task press${v}${held ? ' held' : ''}${now.what === 'task' && now.key && now.key === t.key ? ' on' : ''}`,
            `<s>${i + 1}</s>${hudPin(hudTaskIcon(t), days)}`,
            `${i + 1}. ${hudKind(t.kind)}`,
          );
        })
        .join('')
    : chip('empty', 'empty', hudPin(goodIcon('tile'), '+'), 'Plan work');
  u2.plan.innerHTML = h;
  u2.pcard.hidden = !hud.pc;
  if (hud.pc) u2.pcard.innerHTML = planCard(P, A, S);
  renderDay(A, P);
}
// The words behind a chip of the plan, and what can be done with it.
function planCard(P, A, S) {
  const [what, arg] = String(hud.pc).split(':'),
    btn = (act, label, extra = '') =>
      `<button type="button" class="u2-chip" data-hud="${act}"${extra}>${label}</button>`;
  let title,
    sub,
    acts = '';
  if (what === 'r') {
    const r = P.routine.find((x) => x.kind === arg);
    title = hudKind(arg);
    sub = !r
      ? 'Not in the routine.'
      : r.done
        ? 'Every day. Seen to today (its icon is faded until tomorrow).'
        : r.open
          ? 'Every day. Next in turn today.'
          : 'Every day. Nothing of it to do yet today.';
    if (r) acts += btn('pdrop', 'Drop from the routine', ` data-kind="${esc(arg)}"`);
  } else if (what === 'sleep') {
    const owed = S ? S.owed : 0;
    hud.sleepWas = P.sleep || hud.sleepWas || HUD_SLEEP;
    title = P.sleep ? `Sleeps ${hudHour(P.sleep.from)} to ${hudHour(P.sleep.until)}` : 'No hours for sleep';
    sub =
      owed < 1
        ? 'Rested.'
        : `Owes ${Math.round(owed)} ${Math.round(owed) === 1 ? 'hour' : 'hours'} of sleep` +
          (S.mood ? `: mood ${S.mood}` : '') +
          (S.health ? ', and health suffers' : '') +
          '.';
    const night = (st.player.days || []).slice(-1)[0],
      rough = night ? (night.why.cold || 0) + (night.why.damp || 0) : 0;
    if (rough >= 0.25) sub += ' The last night was cold and damp, and took of its health: a roof would mend that.';
    sub += P.sleep
      ? ' Work in the plan stops for the night and is taken up in the morning.'
      : ' The plan’s work goes on through the night.';
    if (P.sleep)
      acts +=
        btn('psleep', 'To bed earlier', ` data-from="${P.sleep.from - 1}" data-until="${P.sleep.until}"`) +
        btn('psleep', 'To bed later', ` data-from="${P.sleep.from + 1}" data-until="${P.sleep.until}"`) +
        btn('psleep', 'Up earlier', ` data-from="${P.sleep.from}" data-until="${P.sleep.until - 1}"`) +
        btn('psleep', 'Up later', ` data-from="${P.sleep.from}" data-until="${P.sleep.until + 1}"`) +
        btn('psleep', 'No sleep', ' data-off="1"');
    else
      acts += btn('psleep', 'Sleep at night', ` data-from="${hud.sleepWas.from}" data-until="${hud.sleepWas.until}"`);
    const out = HUD_DAILY.filter((k) => !P.routine.some((r) => r.kind === k));
    if (out.length) acts += out.map((k) => btn('padd', `Every day: ${hudKind(k)}`, ` data-kind="${esc(k)}"`)).join('');
  } else if (what === 't') {
    const i = +arg,
      t = P.tasks[i],
      e = t && hudTaskEntry(A, t);
    if (!t) return ((hud.pc = null), '');
    title = `${i + 1}. ${hudKind(t.kind)}${HUD_CHAIN[t.kind] && t.step ? `: ${hudKind(t.step).toLowerCase()} next` : ''}`;
    sub = [hudWaits(t.waits), e ? `${hudStake(e)}.` : t.waits ? '' : 'Its work is not open now.']
      .filter(Boolean)
      .join(' ');
    const till =
      e && Number.isFinite(e.ends) ? `, the round number the days until it is done (${hudDaysTo(e.ends)})` : '';
    sub += ` On its icon, the square is its place in the plan${till}.`;
    acts +=
      (t.site >= 0 ? btn('fly', 'Show', ` data-tile="${t.site}"`) : '') +
      btn('pmove', 'Earlier', ` data-from="${i}" data-to="${i - 1}"${i > 0 ? '' : ' disabled'}`) +
      btn('pmove', 'Later', ` data-from="${i}" data-to="${i + 1}"${i < P.tasks.length - 1 ? '' : ' disabled'}`) +
      btn('premove', 'Remove', ` data-i="${i}"`);
  } else if (what === 'q') {
    const q = Sim.controlOf(st, st.player.pawn).queue[+arg];
    if (!q) return ((hud.pc = null), '');
    title = `Now: ${commandWords(q)}`;
    sub = 'Ordered by hand: it goes before the plan, and is not broken off for sleep.';
    acts += btn('unqueue', q.begun !== null ? 'Stop' : 'Remove', ` data-i="${arg}"`);
  } else {
    title = 'Nothing planned';
    sub = `Tap the land where work is to be done, and add it to the plan. ${st.pawns[played()].given} does the day’s routine and then waits.`;
  }
  return (
    `<div class="u2-verdict"><div><h2>${esc(title)}</h2><p class="sub">${esc(sub)}</p></div>` +
    '<button type="button" class="u2-x" data-hud="pshut" aria-label="Close">×</button></div>' +
    (hud.msg ? `<p class="u2-msg${hud.msg.bad ? '' : ' ok'}">${esc(hud.msg.text)}</p>` : '') +
    (acts ? `<div class="u2-row2">${acts}</div>` : '')
  );
}
