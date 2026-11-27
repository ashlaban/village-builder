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
  if (x.why === 'vital')
    return `Waits for the household’s ${hudKind(x.kind).toLowerCase()}, which nobody else is given today.`;
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
  if (!P) return (u2.pcard.hidden = u2.days.hidden = u2.ahead.hidden = true);
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
      hud.pmove ? `${hud.pmove.from}>${hud.pmove.to}` : '',
      hud.pinfo || '',
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
  // work ordered for now, by hand: it goes before the plan
  const more = Sim.controlOf(st, st.player.pawn)
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
  // the tasks are on the Ahead lane (page/ui2ahead), each a bar in game days against its deadline; with none, the way to plan one
  const tail = more + (P.tasks.length ? '' : chip('empty', 'empty', hudPin(goodIcon('tile'), '+'), 'Plan work'));
  if (tail) h += `<i class="u2-pdiv"></i>${tail}`;
  u2.plan.innerHTML = h;
  u2.pcard.hidden = !hud.pc;
  if (hud.pc) u2.pcard.innerHTML = planCard(P, A, S);
  renderDay(A, P);
  renderAhead(A, P);
}
// A chip of the plan's card: its icons, its number and its kind; its words a tap away (hud.pinfo: a fact's k, or 'all' under "i").
function planCard(P, A, S) {
  const [what, arg] = String(hud.pc).split(':'),
    btn = (act, label, extra = '') =>
      `<button type="button" class="u2-chip" data-hud="${act}"${extra}>${label}</button>`;
  let title,
    icon = '',
    facts = [],
    warn = '',
    acts = '';
  if (what === 'r') {
    const r = P.routine.find((x) => x.kind === arg);
    title = hudKind(arg);
    icon = actIcon(KIND_ICON[arg] || 'hoe');
    facts.push({ k: 'every', icon: actIcon('round'), n: '', label: 'Every day', why: 'Every day, in the routine.' });
    if (r)
      facts.push(
        r.done
          ? {
              k: 'state',
              icon: actIcon('vok'),
              n: '',
              cls: 'v0',
              label: 'Done today',
              why: 'Seen to today: its icon is faded until tomorrow.',
            }
          : r.open
            ? { k: 'state', icon: actIcon('next'), n: '', label: 'Next', why: 'Next in turn today.' }
            : { k: 'state', icon: actIcon('wait'), n: '', label: 'Nothing yet', why: 'Nothing of it to do yet today.' },
      );
    else
      facts.push({ k: 'state', icon: actIcon('no'), n: '', label: 'Not in the routine', why: 'Not in the routine.' });
    if (r && !r.done) facts.push(...dayFacts(A, P, hud.pc));
    if (r) acts += btn('pdrop', `${actIcon('no')}Drop`, ` data-kind="${esc(arg)}" aria-label="Drop from the routine"`);
  } else if (what === 'sleep') {
    const owed = S ? S.owed : 0;
    hud.sleepWas = P.sleep || hud.sleepWas || HUD_SLEEP;
    title = 'Sleep';
    icon = actIcon('idle');
    facts.push(
      P.sleep
        ? {
            k: 'hours',
            icon: actIcon('clock'),
            n: `${hudHour(P.sleep.from).slice(0, 2)}–${hudHour(P.sleep.until).slice(0, 2)}`,
            label: `Sleeps ${hudHour(P.sleep.from)} to ${hudHour(P.sleep.until)}`,
            why: `Sleeps ${hudHour(P.sleep.from)} to ${hudHour(P.sleep.until)}. Work in the plan stops for the night and is taken up in the morning.`,
          }
        : {
            k: 'hours',
            icon: actIcon('no'),
            n: '',
            label: 'No hours for sleep',
            why: 'No hours for sleep: the plan’s work goes on through the night.',
          },
    );
    const h = Math.round(owed);
    facts.push(
      owed < 1
        ? { k: 'owed', icon: actIcon('vok'), n: '', cls: 'v0', label: 'Rested', why: 'Rested.' }
        : {
            k: 'owed',
            icon: actIcon('wait'),
            n: `${h}h`,
            cls: owed >= 16 ? 'v2' : owed >= 8 ? 'v1' : '',
            label: `Owes ${h} hours of sleep`,
            why:
              `Owes ${h} ${h === 1 ? 'hour' : 'hours'} of sleep` +
              (S.mood ? `: mood ${S.mood}` : '') +
              (S.health ? ', and health suffers' : '') +
              '.',
          },
    );
    const night = (st.player.days || []).slice(-1)[0],
      rough = night ? (night.why.cold || 0) + (night.why.damp || 0) : 0;
    if (rough >= 0.25)
      facts.push({
        k: 'rough',
        icon: goodIcon('cold'),
        n: '',
        cls: 'v2',
        label: 'A cold, damp night',
        why: 'The last night was cold and damp, and took of its health: a roof would mend that.',
      });
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
    if (out.length)
      acts += out
        .map((k) =>
          btn(
            'padd',
            `${actIcon('plus')}${esc(hudKind(k))}`,
            ` data-kind="${esc(k)}" aria-label="${esc(`Every day: ${hudKind(k)}`)}"`,
          ),
        )
        .join('');
  } else if (what === 't') {
    const i = +arg,
      t = P.tasks[i],
      e = t && hudTaskEntry(A, t);
    if (!t) return ((hud.pc = null), '');
    title = laneShort(t);
    icon = `${hudTaskIcon(t)}<s class="sq">${i + 1}</s>`;
    facts = [...laneTaskFacts(t, e, i), ...dayFacts(A, P, hud.pc, t)];
    // a reorder that would make another task worse waits here for the player's word (page/ui2ahead laneKnock): the task, the red
    // badge of its new verdict, the deadline and its day; the sentence behind "i"
    const pm = hud.pmove && hud.pmove.from === i ? hud.pmove : null;
    if (pm) {
      facts = [
        ...pm.worse.map((k) => ({
          k: 'knock',
          chip: false,
          icon: k.icon + laneVerdictIcon(k.to),
          cls: `v${HUD_VERDICT[k.to] || 0}`,
          why: `${laneKnockWords(k)} Move: change the order anyway. Keep: leave it as it is.`,
        })),
        ...facts,
      ];
      warn =
        '<div class="u2-knock">' +
        pm.worse
          .map(
            (k) =>
              `<button type="button" class="u2-kn" data-hud="pinfo" data-k="knock" aria-pressed="${hud.pinfo === 'knock'}" ` +
              `aria-label="${esc(laneKnockWords(k))}" title="${esc(laneKnockWords(k))}">${k.icon}` +
              `<span class="u2-fact v${HUD_VERDICT[k.to] || 0}">${laneVerdictIcon(k.to)}</span>` +
              `${laneDeadIcon(k.deadline)}<b>${esc(laneDayN(k.deadline.t))}</b></button>`,
          )
          .join('') +
        '</div>' +
        '<div class="u2-row2">' +
        btn(
          'pmove',
          `${actIcon(pm.to < i ? 'back' : 'next')}Move`,
          ` data-from="${i}" data-to="${pm.to}" data-sure="1" aria-label="Move ${pm.to < i ? 'earlier' : 'later'} anyway"`,
        ) +
        `${btn('pmovecancel', `${actIcon('pin')}Keep`, ' aria-label="Keep the order"')}</div>`;
    }
    acts +=
      (t.site >= 0 ? btn('fly', `${actIcon('target')}Show`, ` data-tile="${t.site}"`) : '') +
      btn('pmove', `${actIcon('back')}Earlier`, ` data-from="${i}" data-to="${i - 1}"${i > 0 ? '' : ' disabled'}`) +
      btn(
        'pmove',
        `Later${actIcon('next')}`,
        ` data-from="${i}" data-to="${i + 1}"${i < P.tasks.length - 1 ? '' : ' disabled'}`,
      ) +
      btn('premove', `${actIcon('no')}Remove`, ` data-i="${i}"`) +
      laneKeepButton(i);
  } else if (what === 'q') {
    const q = Sim.controlOf(st, st.player.pawn).queue[+arg];
    if (!q) return ((hud.pc = null), '');
    title = `Now: ${commandWords(q)}`;
    icon = `<s>!</s>${actIcon(KIND_ICON[String(q.target).split(':')[0]] || 'walk')}`;
    facts.push({
      k: 'hand',
      chip: false,
      icon: '<s>!</s>',
      why: 'Ordered by hand: it goes before the plan, and is not broken off for sleep.',
    });
    acts += btn('unqueue', q.begun !== null ? 'Stop' : 'Remove', ` data-i="${arg}"`);
  } else if (what === 'g') {
    const g = laneGapCard(+arg);
    if (!g) return ((hud.pc = null), '');
    ({ title, icon, facts, acts } = g);
  } else {
    title = 'Nothing planned';
    icon = goodIcon('tile');
    facts.push({
      k: 'how',
      chip: false,
      icon: goodIcon('tile'),
      why: `Tap the land where work is to be done, and add it to the plan. ${st.pawns[played()].given} does the day’s routine and then waits.`,
    });
  }
  const chips = factChips(facts, 'pinfo'),
    head =
      what === 't'
        ? `<button type="button" class="u2-pico" data-hud="pinfo" data-k="place" aria-pressed="${hud.pinfo === 'place'}" ` +
          `aria-label="Its place in the plan">${icon}</button>`
        : `<span class="u2-pico">${icon}</span>`;
  return (
    `<div class="u2-verdict">${head}<h2>${esc(title)}</h2>` +
    (facts.length ? factI('pinfo') : '') +
    '<button type="button" class="u2-x" data-hud="pshut" aria-label="Close">×</button></div>' +
    (chips ? `<div class="u2-facts">${chips}</div>` : '') +
    factWords(facts, 'pinfo') +
    (hud.msg ? `<p class="u2-msg${hud.msg.bad ? '' : ' ok'}">${esc(hud.msg.text)}</p>` : '') +
    warn +
    (acts && !warn ? `<div class="u2-row2">${acts}</div>` : '')
  );
}
