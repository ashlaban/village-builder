// @sys page/ui2hud: the new interface in play: the year's ribbon with its windows and the nearest deadline, and the Today, Plan and Stores tabs
// ======== the played settler's year, day and stores ========
// All of it reads st and acts through Sim: the head's verbs (Sim.head: project, target, order), the queue (Sim.queue, unqueue,
// setAuto). The page's own state, never saved: hud = {tab: 'today' | 'plan' | 'stores' | null, msg: {text, bad}, key: what was drawn}.
const hud = { tab: null, msg: null, key: '', yearKey: '', at: -1, markKey: '', sites: null, pc: null, planKey: '' };
const HUD_TABS = [
  ['today', 'Today', () => actIcon('me')],
  ['plan', 'Plan', () => goodIcon('plan')],
  ['stores', 'Stores', () => goodIcon('grain')],
];
const HUD_DAILY = ['water', 'cook', 'fodder', 'milk']; // done every day whatever the season's order
const hudHouse = () => {
  const id = played(),
    hh = id >= 0 && st.pawns[id].household !== null ? st.households[st.pawns[id].household] : null,
    f = hh && hh.farmstead !== null ? st.farmsteads[hh.farmstead] : null;
  return { id, hh, f };
};
const hudDays = (n) => `${n} ${n === 1 ? 'day' : 'days'}`;
// The year's windows for this farm, in days of the year: sowing (the spring crops it holds seed of), haymaking, and each sown field's
// ripening; and the nearest deadline in words, with how pressing it is (0 calm, 1 soon, 2 now).
function hudYear(hh, f) {
  const CROPS = VB['sim/crops'].CROPS,
    c = Sim.cal(st.t),
    S = Sim.SEASON_DAYS,
    spring = Object.keys(hh.grain || {}).filter(
      (k) => CROPS[k] && CROPS[k].sow && CROPS[k].sow[0] === 0 && !CROPS[k].fallow,
    ),
    sow = spring.length ? [0, Math.max(...spring.map((k) => CROPS[k].sow[2]))] : null,
    hay = [S, 2 * S + 2],
    fields = f ? f.fields : [],
    sown = fields.filter((x) => ['sown', 'growing', 'ripe', 'stooks'].includes(x.stage)).length,
    ripe = fields
      .filter((x) => x.stage === 'sown' || x.stage === 'growing')
      .map((x) => (x.sown + CROPS[x.crop].ripe) % Sim.YEAR_DAYS);
  let line, press;
  if (sow && c.doy <= sow[1] && sown < Math.max(1, fields.length)) {
    const left = sow[1] - c.doy + 1;
    line = fields.length
      ? `Sow by spring day ${sow[1] + 1}: ${hudDays(left)} left, ${sown} of ${fields.length} ${fields.length === 1 ? 'field' : 'fields'} sown`
      : `Sowing closes after spring day ${sow[1] + 1}: ${hudDays(left)} left, and no field is broken yet`;
    press = left <= 3 ? 2 : 1;
  } else if (c.doy < hay[0]) {
    line = `Haymaking opens in ${hudDays(hay[0] - c.doy)}`;
    press = 0;
  } else if (c.doy <= hay[1]) {
    const left = hay[1] - c.doy + 1;
    line = `Haymaking: ${hudDays(left)} left to mow`;
    press = left <= 3 ? 2 : 1;
  } else if (c.season < 3) {
    line = `Winter in ${hudDays(3 * S - c.doy)}: bring in the harvest and the wood`;
    press = 3 * S - c.doy <= 4 ? 1 : 0;
  } else {
    line = `Winter: ${hudDays(4 * S - c.doy)} to spring`;
    press = 0;
  }
  return { c, sow, hay, ripe, line, press };
}
function renderYear() {
  const { hh, f } = hudHouse();
  if (!hh) return;
  const Y = hudYear(hh, f),
    N = Sim.YEAR_DAYS,
    key = `${Y.c.year}|${Y.c.doy}|${Y.line}|${Y.ripe.join()}`;
  if (key === hud.yearKey) return;
  hud.yearKey = key;
  const pct = (d) => `${((d / N) * 100).toFixed(2)}%`,
    band = (cls, a, b, label) =>
      `<i class="${cls}" style="left:${pct(a)};width:${pct(b - a + 1)}" title="${label}"><span>${label}</span></i>`;
  u2.ribbon.innerHTML =
    `<div class="u2-ribbon" role="img" aria-label="The year: ${esc(Y.line)}">` +
    Sim.SEASONS.map((s, k) => `<b class="s${k}${k === Y.c.season ? ' now' : ''}">${s}</b>`).join('') +
    (Y.sow ? band('sow', Y.sow[0], Y.sow[1], 'sow') : '') +
    band('hay', Y.hay[0], Y.hay[1], 'hay') +
    Y.ripe.map((d) => band('ripe', d, d + 2, 'reap')).join('') +
    `<u style="left:${pct(Y.c.doy + 0.5)}"></u></div>`;
  u2.alert.className = `u2-alert press${Y.press}`;
  u2.alert.textContent = Y.line;
  hud.press = Y.press;
}
// ---- the tabs ----
function hudMsg(r, done) {
  hud.msg = r === true ? { text: done } : { text: siteCap(String(r)), bad: true };
  hud.key = '';
}
function todayHTML(id) {
  const pl = st.player,
    why = Sim.reasonLine(st, id);
  let h = `<p class="u2-doing"><b>${esc(Sim.describe(st, id))}</b>${why ? `<small>${esc(why)}</small>` : ''}</p>`;
  h += '<h3>Queue</h3>';
  h += pl.queue.length
    ? `<ol class="u2-list">${pl.queue
        .map(
          (c, i) =>
            `<li><span>${esc(commandWords(c))}${c.begun !== null ? ' <i>(under way)</i>' : ''}</span>` +
            `<button type="button" class="u2-chip" data-hud="unqueue" data-i="${i}">Remove</button></li>`,
        )
        .join('')}</ol>`
    : `<p class="sub">${
        pl.auto
          ? `Nothing queued: ${esc(st.pawns[id].given)} does what is most needed, by the order of work.`
          : `Nothing queued, and ${esc(st.pawns[id].given)} waits for your word: nothing is done.`
      }</p>`;
  const seen = new Set(),
    jobs = Sim.opportunities(st, id)
      .filter((o) => o.verb === 'work' && o.why === null && o.kind && !seen.has(o.kind) && seen.add(o.kind))
      .sort((a, b) => b.fit - a.fit)
      .slice(0, 6)
      .sort((a, b) => (Sim.KINDS[a.kind].name < Sim.KINDS[b.kind].name ? -1 : 1)); // by name: a button keeps its place from hour to hour
  h += '<h3>Do next yourself</h3>';
  h += jobs.length
    ? `<div class="u2-jobs">${jobs
        .map(
          (o) =>
            `<button type="button" class="u2-job" data-hud="job" data-target="${esc(o.target)}" data-site="${o.site}">` +
            `${esc(Sim.KINDS[o.kind].name)}<small>${o.when === 'now' ? 'open now' : esc(String(o.when || ''))}</small></button>`,
        )
        .join('')}</div>`
    : '<p class="sub">No work is open right now.</p>';
  h += `<div class="u2-row2"><button type="button" class="u2-chip" data-hud="follow" aria-pressed="${followPlayed}">Follow on the map</button></div>`;
  const log = Sim.villageLog(st, 4);
  if (log.length) h += `<h3>Lately</h3><ul class="u2-log">${log.map((e) => `<li>${esc(e.text)}</li>`).join('')}</ul>`;
  h +=
    `<h3>When nothing is queued</h3><div class="u2-row2"><p class="sub">${pl.auto ? 'Works on unasked.' : 'Waits for your word.'}</p>` +
    `<button type="button" class="u2-chip" data-hud="auto">${pl.auto ? 'Make them wait' : 'Let them work unasked'}</button></div>`;
  return h;
}
function fieldLine(fd, i) {
  const CROPS = VB['sim/crops'].CROPS,
    C = CROPS[fd.crop],
    day = Math.floor(st.t / Sim.DAY),
    c = Sim.cal(st.t);
  if (fd.stage === 'sown' || fd.stage === 'growing') {
    const g = Math.min(C.ripe, Math.max(0, day - fd.sown));
    return [`Field ${i + 1}: ${fd.crop} growing`, `Ripe in ${hudDays(C.ripe - g)}`, 0];
  }
  if (fd.stage === 'ripe') return [`Field ${i + 1}: ${fd.crop} is ripe`, 'Reap it now', 2];
  if (fd.stage === 'stooks') return [`Field ${i + 1}: ${fd.crop} in stooks`, 'Carry in and thresh', 1];
  if (fd.stage === 'fallow' || fd.stage === 'scrub') return [`Field ${i + 1}: overgrown`, 'Clear it again', 1];
  if (C.fallow) return [`Field ${i + 1}: fallow this year`, 'Till it in summer', 0];
  const open = c.season === C.sow[0] && c.sday >= C.sow[1] && c.sday <= C.sow[2],
    left = C.sow[2] - c.sday + 1;
  return [
    `Field ${i + 1}: ${fd.stage === 'plowed' ? 'ready to sow' : 'to hoe, then sow'} ${fd.crop}`,
    open ? `${hudDays(left)} left to sow` : `Sowing: ${Sim.SEASONS[C.sow[0]]} days ${C.sow[1] + 1} to ${C.sow[2] + 1}`,
    open ? (left <= 3 ? 2 : 1) : 0,
  ];
}
const HUD_PROJECT = { field: 'a new field', meadow: 'a hay meadow', barn: 'a barn', well: 'a well' };
function planHTML(hh, f) {
  const V = Sim.headView(st, hh.id);
  let h = '<h3>Building</h3>';
  if (V.project) {
    const k = Sim.KINDS[V.project.step];
    h +=
      `<div class="u2-row2"><p class="u2-doing"><b>${esc(siteCap(HUD_PROJECT[V.project.what] || V.project.what))}</b>` +
      `<small>Now: ${esc(k ? k.name.toLowerCase() : V.project.step)}</small></p>` +
      `<button type="button" class="u2-chip" data-hud="drop" data-id="${V.project.id}">Give it up</button></div>`;
  } else
    h +=
      '<p class="sub">Nothing under way. Begin:</p><div class="u2-row2">' +
      '<button type="button" class="u2-btn" data-hud="project" data-what="field">A new field</button>' +
      '<button type="button" class="u2-btn" data-hud="project" data-what="meadow">A hay meadow</button></div>';
  h += '<h3>Fields</h3>';
  h += f.fields.length
    ? `<ul class="u2-fields">${f.fields
        .map((fd, i) => {
          const [a, b, p] = fieldLine(fd, i);
          return `<li class="press${p}"><button type="button" data-hud="fly" data-tile="${fd.tile}"><b>${esc(a)}</b><small>${esc(b)}</small></button></li>`;
        })
        .join('')}</ul>`
    : '<p class="sub">No field yet. The first is being broken from the land; it must be hoed before it can be sown.</p>';
  h += '<h3>Aim for</h3><div class="u2-targets">';
  const T = V.targets;
  for (const [key, label, step, unit] of [
    ['fields', 'Fields', 1, ''],
    ['hay', 'Hay', 0.25, 'winters'],
    ['wood', 'Firewood', 5, 'loads'],
  ]) {
    const t = T[key];
    if (!t || t.now === null) continue;
    const dn = Math.max(t.bounds[0], +(t.now - step).toFixed(2)),
      up = Math.min(t.bounds[1], +(t.now + step).toFixed(2)),
      val = key === 'wood' ? Math.round(t.now) : +t.now.toFixed(1);
    h +=
      `<div><span>${label}</span><button type="button" data-hud="target" data-store="${key}" data-n="${dn}" aria-label="Less ${label}"` +
      `${dn < t.now ? '' : ' disabled'}>−</button><b>${val}${unit ? ` <small>${unit}</small>` : ''}</b>` +
      `<button type="button" data-hud="target" data-store="${key}" data-n="${up}" aria-label="More ${label}"${up > t.now ? '' : ' disabled'}>+</button></div>`;
  }
  h += '</div><h3>Order of work this season</h3><ol class="u2-list">';
  const at = V.order.map((k, i) => ({ k, i })).filter((x) => !HUD_DAILY.includes(x.k));
  at.forEach((x, n) => {
    const name = (Sim.KINDS[x.k] && Sim.KINDS[x.k].name) || x.k;
    h +=
      `<li><span>${n + 1}. ${esc(name)}</span><span class="u2-ud">` +
      `<button type="button" class="u2-chip" data-hud="order" data-from="${x.i}" data-to="${n > 0 ? at[n - 1].i : x.i}" aria-label="${esc(name)} earlier"` +
      `${n > 0 ? '' : ' disabled'}>▲</button>` +
      `<button type="button" class="u2-chip" data-hud="order" data-from="${x.i}" data-to="${n < at.length - 1 ? at[n + 1].i : x.i}"` +
      ` aria-label="${esc(name)} later"${n < at.length - 1 ? '' : ' disabled'}>▼</button></span></li>`;
  });
  return h + '</ol><p class="sub">Water, cooking and the animals are seen to every day whatever the order.</p>';
}
const HUD_STORES = [
  ['food', 'Food', 'rations'],
  ['fuel', 'Firewood', 'loads'],
  ['hay', 'Hay', 'loads'],
];
function storesHTML(hh) {
  const O = Sim.supplyOutlook(st, hh.id);
  if (!O) return '<p class="sub">Not reckoned yet: the stores are counted on the first morning.</p>';
  let h = '';
  for (const [key, label, unit] of HUD_STORES) {
    const s = O[key];
    if (s.state === 'none') continue;
    const coming = s.parts.intakes.reduce((n, x) => n + x.n, 0),
      word =
        s.state === 'safe'
          ? coming > 0
            ? 'Lasts the year, if the work planned is done'
            : 'Lasts the year ahead'
          : `Runs ${s.state === 'bad' ? 'badly ' : ''}short in ${Sim.SEASONS[(O.season + s.season) % 4]}`,
      cells = [0, 1, 2, 3]
        .map((k) => {
          const fill = Math.max(0, Math.min(1, s.own - k)),
            need = s.parts.need[k] > 0;
          return `<i class="${need ? '' : 'idle'}" title="${Sim.SEASONS[(O.season + k) % 4]}"><u style="width:${(fill * 100).toFixed(0)}%"></u><span>${
            Sim.SEASONS[(O.season + k) % 4]
          }</span></i>`;
        })
        .join('');
    h +=
      `<div class="u2-store ${s.state}"><div><b>${label}</b><span>${esc(word)}</span></div><div class="u2-cells">${cells}</div>` +
      `<small>${Math.round(s.parts.store)} ${unit} in store now` +
      `${coming > 0 ? ` · about ${Math.round(coming)} more counted on from work still to do` : ''}</small></div>`;
  }
  const herds = Sim.describeHerds ? Sim.describeHerds(st, hh) : '';
  if (herds) h += `<h3>Animals</h3><p class="sub">${esc(String(herds))}</p>`;
  return (
    h +
    '<p class="sub">The bars are the head’s own reckoning of the four seasons ahead, made at each morning’s review.</p>' +
    (O.stale ? '<p class="sub">Counted last season; it is counted again at the next review.</p>' : '')
  );
}
function renderHud() {
  const { id, hh, f } = hudHouse();
  if (id < 0 || !hh || !f) return;
  renderYear();
  u2.alert.hidden = !hud.press || !!hud.tab;
  hudMarks(id, hh, f);
  renderPlan();
  const hour = Math.floor(st.t),
    key = `${hud.tab}|${hour}|${st.player.queue.length}|${st.player.auto}|${followPlayed}|${hud.msg ? hud.msg.text : ''}`;
  for (const b of u2.tabs.children) b.setAttribute('aria-pressed', String(b.dataset.tab === hud.tab));
  u2.sheet.hidden = !hud.tab;
  if (!hud.tab || key === hud.key) return;
  hud.key = key;
  const top = u2.sheet.scrollTop,
    body = hud.tab === 'today' ? todayHTML(id) : hud.tab === 'plan' ? planHTML(hh, f) : storesHTML(hh);
  u2.sheet.innerHTML =
    `<header><h2>${hud.tab === 'today' ? esc(Sim.fullName(st.pawns[id])) : hud.tab === 'plan' ? esc(f.name) + ': the plan' : esc(f.name) + ': stores'}</h2>` +
    `<button type="button" class="u2-chip" data-hud="close" aria-label="Close">Close</button></header>` +
    (hud.msg ? `<p class="u2-msg${hud.msg.bad ? '' : ' ok'}">${esc(hud.msg.text)}</p>` : '') +
    body;
  u2.sheet.scrollTop = top;
}
function hudTab(tab) {
  hud.tab = hud.tab === tab ? null : tab;
  hud.msg = null;
  hud.key = '';
  u2.sheet.scrollTop = 0;
}
// ---- the plan: every day's routine, the sleeping hours and the tasks in order, a row of icons; the words are a tap away ----
// Planned by hand (Kim, 24 Nov): the settler follows the plan the player lays (Sim.plan, Sim.planView; VB-1618), automatic planning off.
const HUD_SLEEP = { from: 22, until: 6 };
const hudPlanned = () => (Sim.planView ? Sim.planView(st) : null);
// The first morning: automatic planning off, the necessities as the day's routine, and the night for sleep.
function hudBegin() {
  if (!Sim.plan || !st || played() < 0) return;
  Sim.setAuto(st, false);
  Sim.plan(st, 'routine', { kinds: HUD_DAILY });
  Sim.plan(st, 'sleep', HUD_SLEEP);
}
const hudHour = (h) => `${String(((h % 24) + 24) % 24).padStart(2, '0')}:00`;
const hudKind = (k) => (k === 'sleep' ? 'Sleep' : (Sim.KINDS[k] && Sim.KINDS[k].name) || k);
// An agenda entry for a job's key, wherever the agenda holds it.
const hudEntry = (A, key) =>
  A
    ? (A.plan || []).find((x) => x.key === key) ||
      A.queue.find((x) => x.key === key) ||
      A.open.find((x) => x.key === key)
    : null;
function renderPlan() {
  const P = hudPlanned();
  u2.plan.hidden = !P;
  if (!P) return (u2.pcard.hidden = true);
  const S = Sim.sleepOf(st),
    A = Sim.agenda(st),
    owed = S ? Math.floor(S.owed) : 0,
    key = [Math.floor(st.t), hud.pc, st.player.auto, JSON.stringify(P), owed, hud.msg ? hud.msg.text : ''].join('|');
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
    hudPin(actIcon('idle'), owed >= 8 ? owed : ''), // an ordinary evening owes 6: the number shows once a night is owed
    'Sleep',
  );
  h += '<i class="u2-pdiv"></i>';
  h += P.tasks.length
    ? P.tasks
        .map((t, i) => {
          const e = hudEntry(A, t.key),
            v = e ? HUD_VERDICT[hudVerdict(e)] || 0 : 0,
            days = e && Number.isFinite(e.ends) ? hudDaysTo(e.ends) : '';
          return chip(
            `t:${i}`,
            `task press${v}${now.what === 'task' && now.key === t.key ? ' on' : ''}`,
            `<s>${i + 1}</s>${hudPin(actIcon(KIND_ICON[t.kind] || 'hoe'), days)}`,
            `${i + 1}. ${hudKind(t.kind)}`,
          );
        })
        .join('')
    : chip('empty', 'empty', hudPin(goodIcon('tile'), '+'), 'Plan work');
  u2.plan.innerHTML = h;
  u2.pcard.hidden = !hud.pc;
  if (hud.pc) u2.pcard.innerHTML = planCard(P, A, S);
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
        ? 'Every day. Seen to today.'
        : r.open
          ? 'Every day. Next in turn today.'
          : 'Every day. Nothing of it to do yet today.';
    if (r) acts += btn('pdrop', 'Drop from the routine', ` data-kind="${esc(arg)}"`);
  } else if (what === 'sleep') {
    const owed = S ? S.owed : 0;
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
    else acts += btn('psleep', 'Sleep at night', ` data-from="${HUD_SLEEP.from}" data-until="${HUD_SLEEP.until}"`);
    const out = HUD_DAILY.filter((k) => !P.routine.some((r) => r.kind === k));
    if (out.length) acts += out.map((k) => btn('padd', `Every day: ${hudKind(k)}`, ` data-kind="${esc(k)}"`)).join('');
  } else if (what === 't') {
    const i = +arg,
      t = P.tasks[i],
      e = t && hudEntry(A, t.key);
    if (!t) return ((hud.pc = null), '');
    title = `${i + 1}. ${hudKind(t.kind)}`;
    sub = e ? hudStake(e) : 'Its work is not open now.';
    acts +=
      (t.site >= 0 ? btn('fly', 'Show', ` data-tile="${t.site}"`) : '') +
      btn('pmove', 'Earlier', ` data-from="${i}" data-to="${i - 1}"${i > 0 ? '' : ' disabled'}`) +
      btn('pmove', 'Later', ` data-from="${i}" data-to="${i + 1}"${i < P.tasks.length - 1 ? '' : ' disabled'}`) +
      btn('premove', 'Remove', ` data-i="${i}"`);
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
// ---- on the land: how things stand, and what can be done where ----
// A field's pin: the icon of what it waits for, a number of days where one counts (to ripe, or left to sow), and how pressing it is.
// The words are the tile's callout (fieldLine), a tap away.
function fieldPin(fd) {
  const C = VB['sim/crops'].CROPS[fd.crop],
    c = Sim.cal(st.t),
    day = Math.floor(st.t / Sim.DAY);
  if (fd.stage === 'sown' || fd.stage === 'growing')
    return [goodIcon(GOOD_PATHS[fd.crop] ? fd.crop : 'seed'), C.ripe - Math.min(C.ripe, Math.max(0, day - fd.sown)), 0];
  if (fd.stage === 'ripe') return [actIcon('mow'), '!', 2];
  if (fd.stage === 'stooks') return [goodIcon('sheaves'), '', 1];
  if (fd.stage === 'fallow' || fd.stage === 'scrub') return [actIcon('weed'), '', 1];
  if (C.fallow) return [goodIcon('fallow'), '', 0];
  const open = c.season === C.sow[0] && c.sday >= C.sow[1] && c.sday <= C.sow[2],
    left = C.sow[2] - c.sday + 1;
  return [actIcon(fd.stage === 'plowed' ? 'sow' : 'hoe'), open ? left : '', open ? (left <= 3 ? 2 : 1) : 0];
}
// A span of working hours in the player's units: hours under a day's work, else days of work to the half.
const hudSpan = (h) => {
  const L = Sim.WORK[1] - Sim.WORK[0];
  if (!Number.isFinite(h)) return '?';
  if (h < L * 0.75) return `${Math.max(1, Math.round(h))} h`;
  const d = Math.round((h / L) * 2) / 2;
  return `${Number.isInteger(d) ? d : d > 1 ? `${Math.floor(d)}½` : '½'} ${d === 1 ? 'day' : 'days'}`;
};
// The whole days from now until game hour t (1: done today).
const hudDaysTo = (t) => Math.max(1, Math.floor(t / Sim.DAY) - Math.floor(st.t / Sim.DAY) + 1);
const HUD_VERDICT = { 'in time': 0, tight: 1, late: 2 };
// An agenda entry's verdict: its own, or the whole chain's it leads to (a field broken now, sown in time?).
const hudVerdict = (e) => (e.then && e.then.verdict) || e.verdict || null;
// One line of words for an agenda entry: the hours it takes as the settler reckons them, and how it stands against its deadline.
function hudStake(e) {
  let t = `About ${hudSpan(e.hours.mid)} of work`;
  if (e.then) {
    const more = e.then.steps.reduce((n, x) => n + x.hours.mid, 0);
    t += `, then ${hudSpan(more)} more before ${e.then.crop} is sown`;
    const d = e.then.deadline;
    if (d)
      t += `: ${e.then.verdict === 'late' ? 'too late for' : e.then.verdict === 'tight' ? 'tight for' : 'in time for'} ${d.what}`;
  } else if (e.deadline)
    t += `: ${e.verdict === 'late' ? 'too late for' : e.verdict === 'tight' ? 'tight for' : 'in time for'} ${e.deadline.what}`;
  return t + (e.why ? `. ${siteCap(e.why)}` : '');
}
const hudPin = (icon, n = '') => `${icon}${n === '' ? '' : `<b>${n}</b>`}`;
// The tiles the next field or meadow may be laid on (page/plan's planSites, the head's own checks), read once an hour.
function hudSites(hh) {
  const hour = Math.floor(st.t);
  if (!hud.sites || hud.sites.hour !== hour || hud.sites.hh !== hh.id)
    hud.sites = {
      hour,
      hh: hh.id,
      field: new Set(planSites('field', hh).sites),
      meadow: new Set(planSites('meadow', hh).sites),
    };
  return hud.sites;
}
// The callout of tile i: what it is, how it stands, and what the settler can do there.
function hudCall(i, id, hh, f) {
  const V = Sim.headView(st, hh.id),
    fi = f.fields.findIndex((q) => q.tile === i),
    mi = (f.meadows || []).findIndex((q) => q.tile === i),
    seen = new Set(),
    jobs = Sim.opportunities(st, id).filter(
      (o) => o.verb === 'work' && o.why === null && o.site === i && o.kind && !seen.has(o.kind) && seen.add(o.kind),
    );
  let title,
    sub,
    acts = '';
  if (i === f.house) {
    title = f.name;
    sub = `${st.pawns[id].given}: ${Sim.describe(st, id)}`;
    acts +=
      '<div class="u2-row2"><button type="button" class="u2-chip" data-tab="stores">Stores</button>' +
      '<button type="button" class="u2-chip" data-tab="plan">Plan</button><button type="button" class="u2-chip" data-tab="today">Today</button></div>';
  } else if (fi >= 0) [title, sub] = fieldLine(f.fields[fi], fi);
  else if (mi >= 0) {
    title = `Hay meadow ${mi + 1}`;
    sub = 'Mown in summer for the winter’s hay.';
  } else {
    title = VB['world/biomes'].BIOMES[w.biome[i]].name;
    sub =
      V.tiles.field === i
        ? 'Marked for the next field.'
        : V.tiles.meadow === i
          ? 'Marked for the next hay meadow.'
          : waterLines(i)[0] || '';
  }
  const A = Sim.agenda(st);
  const P = hudPlanned();
  jobs.slice(0, 3).forEach((o, n) => {
    const e = hudEntry(A, o.target),
      stake = e ? esc(hudStake(e)) : '',
      inPlan = P && P.tasks.some((t) => t.key === o.target),
      name = esc(Sim.KINDS[o.kind].name);
    if (P && !inPlan)
      acts +=
        `<button type="button" class="u2-act${n ? '' : ' go'}" data-hud="planadd" data-target="${esc(o.target)}">${name}` +
        `<small>${stake ? `${stake}. ` : ''}Add to the plan</small></button>`;
    else if (P)
      acts += `<p class="u2-inplan">${actIcon(KIND_ICON[o.kind] || 'hoe')}<span><b>${name}</b> is in the plan. ${stake}</span></p>`;
    if (o.when === 'now' || !P)
      acts +=
        `<button type="button" class="${P ? 'u2-chip' : `u2-act${n ? '' : ' go'}`}" data-hud="job" data-target="${esc(o.target)}" data-site="-1">` +
        `${P ? `Do it now: ${name.toLowerCase()}` : `${name}<small>${stake || 'Done next'}</small>`}</button>`;
  });

  if (i !== f.house && fi < 0 && mi < 0) {
    const S = hudSites(hh);
    if (S.field.has(i) && V.tiles.field !== i)
      acts +=
        '<button type="button" class="u2-act" data-hud="lay" data-what="field">Break a field here<small>' +
        `${V.project ? 'After the work under way' : 'Begun at once'}</small></button>`;
    if (S.meadow.has(i) && V.tiles.meadow !== i)
      acts +=
        '<button type="button" class="u2-act" data-hud="lay" data-what="meadow">Make a hay meadow here<small>' +
        `${V.project ? 'After the work under way' : 'Begun at once'}</small></button>`;
  }
  if (!w.water[i] && !w.river[i] && i !== f.house)
    acts += '<button type="button" class="u2-chip" data-hud="walk">Walk here</button>';
  return (
    `<div class="u2-verdict"><div><h2>${esc(title)}</h2>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}</div>` +
    '<button type="button" class="u2-x" data-hud="shut" aria-label="Close">×</button></div>' +
    (hud.msg && !hud.tab ? `<p class="u2-msg${hud.msg.bad ? '' : ' ok'}">${esc(hud.msg.text)}</p>` : '') +
    (acts ? `<div class="u2-acts">${acts}</div>` : '')
  );
}
function hudMarks(id, hh, f) {
  const O = Sim.supplyOutlook(st, hh.id),
    V = Sim.headView(st, hh.id),
    open = VB['sim/projects'].openOf(st, hh.id),
    site = open && Number.isInteger(open.place) ? open.place : -1,
    plan = st.player.queue.map((q) => q.target).join() + JSON.stringify((hudPlanned() || {}).tasks || 0),
    key = [
      Math.floor(st.t),
      hud.at,
      hud.msg ? hud.msg.text : '',
      hud.tab,
      plan,
      site,
      V.tiles.field,
      V.tiles.meadow,
    ].join('|');
  if (key === hud.markKey) return;
  hud.markKey = key;
  const marks = [];
  f.fields.forEach((fd, k) => {
    const [icon, n, press] = fieldPin(fd);
    if (fd.tile !== hud.at)
      marks.push({ id: `f${k}`, tile: fd.tile, cls: `u2-pin press${press}`, html: hudPin(icon, n) });
  });
  if (site >= 0 && site !== hud.at && V.project)
    marks.push({
      id: 'site',
      tile: site,
      cls: 'u2-pin work',
      html: hudPin(actIcon(KIND_ICON[V.project.step] || 'build')),
    });
  for (const what of ['field', 'meadow'])
    if (V.tiles[what] >= 0 && V.tiles[what] !== site && V.tiles[what] !== hud.at)
      marks.push({ id: `next${what}`, tile: V.tiles[what], cls: 'u2-pin next', html: hudPin(goodIcon(what)) });
  // the plan's pins: each queued job at its tile, its place in the queue at one shoulder and the days until it is done at the other;
  // a tile shows one pin, the plan's before the field's
  const A = Sim.agenda(st),
    planned = new Map();
  const P = hudPlanned(),
    list =
      P && P.tasks.length
        ? P.tasks.map((t) => ({ ...t, e: hudEntry(A, t.key) }))
        : A
          ? A.queue.map((e) => ({ ...e, e }))
          : [];
  list.forEach((t, k) => {
    if (t.site < 0 || !t.kind || planned.has(t.site) || t.site === hud.at) return;
    const days = t.e && Number.isFinite(t.e.ends) ? hudDaysTo(t.e.ends) : '';
    planned.set(t.site, {
      id: `q${t.site}`,
      tile: t.site,
      cls: `u2-pin plan press${(t.e && HUD_VERDICT[hudVerdict(t.e)]) || 0}`,
      html: `<s>${k + 1}</s>${hudPin(actIcon(KIND_ICON[t.kind] || 'hoe'), days)}`,
    });
  });
  for (let k = marks.length - 1; k >= 0; k--) if (planned.has(marks[k].tile)) marks.splice(k, 1);
  marks.push(...planned.values());
  if (O && f.house !== hud.at)
    marks.push({
      id: 'house',
      tile: f.house,
      cls: 'u2-gauges',
      html: [
        ['food', 'grain'],
        ['fuel', 'wood'],
        ['hay', 'hay'],
      ]
        .map(([k, icon]) => `<i class="${O[k].state}">${goodIcon(icon)}<u></u></i>`)
        .join(''),
    });
  if (hud.at >= 0)
    marks.push({ id: 'call', tile: hud.at, cls: 'u2-call', call: true, html: hudCall(hud.at, id, hh, f) });
  u2Marks(marks);
}
// A tap on the map, in play: the tile's callout opens at it; the same tile again, or water far from land, shuts it.
function hudTap(sx, sy) {
  const { id, f } = hudHouse();
  if (id < 0 || !f) return false;
  const i = loc(...toWorld(sx, sy), [0, 0]);
  hud.at = i === hud.at || i < 0 ? -1 : i;
  hud.msg = null;
  hud.markKey = '';
  sel = hud.at;
  hoverDirty = true;
  return true;
}
function hudClick(b) {
  const d = b.dataset,
    { id, hh } = hudHouse();
  if (d.hud === 'close') hud.tab = null;
  else if (d.hud === 'pshut') hud.pc = null;
  else if (d.hud === 'planadd') hudMsg(Sim.plan(st, 'add', { key: d.target }), 'Added to the plan.');
  else if (d.hud === 'premove') {
    hudMsg(Sim.plan(st, 'remove', { i: +d.i }), 'Taken out of the plan.');
    hud.pc = null;
  } else if (d.hud === 'pmove') {
    const r = Sim.plan(st, 'move', { from: +d.from, to: +d.to });
    hudMsg(r, 'The order is changed.');
    if (r === true) hud.pc = `t:${d.to}`;
  } else if (d.hud === 'psleep')
    hudMsg(
      Sim.plan(st, 'sleep', d.off ? null : { from: ((+d.from % 24) + 24) % 24, until: ((+d.until % 24) + 24) % 24 }),
      d.off ? 'No hours for sleep now.' : 'The sleeping hours are changed.',
    );
  else if (d.hud === 'pdrop' || d.hud === 'padd') {
    const now = hudPlanned().routine.map((r) => r.kind),
      kinds =
        d.hud === 'padd' ? HUD_DAILY.filter((k) => now.includes(k) || k === d.kind) : now.filter((k) => k !== d.kind);
    hudMsg(Sim.plan(st, 'routine', { kinds }), d.hud === 'padd' ? 'Back in the routine.' : 'Dropped from the routine.');
    if (d.hud === 'pdrop') hud.pc = 'sleep';
  } else if (d.hud === 'shut') hud.at = -1;
  else if (d.hud === 'walk') hudMsg(Sim.queue(st, { actor: id, verb: 'walkTo', target: hud.at }), 'Queued: walk here.');
  else if (d.hud === 'lay') {
    let r = Sim.head(st, 'tile', { what: d.what, tile: hud.at });
    const busy = !!Sim.headView(st, hh.id).project;
    if (r === true && !busy) r = Sim.head(st, 'project', { what: d.what });
    hudMsg(
      r,
      busy
        ? `Marked: the next ${d.what === 'field' ? 'field' : 'hay meadow'} is made here.`
        : `Begun: ${HUD_PROJECT[d.what]} here.`,
    );
  } else if (d.hud === 'fly') flyTo(w.hx[+d.tile], w.hy[+d.tile]);
  else if (d.hud === 'follow') {
    followPlayed = !followPlayed;
    if (followPlayed) flyToFarmOf(id);
  } else if (d.hud === 'auto') {
    const on = !st.player.auto;
    hudMsg(Sim.setAuto(st, on), on ? 'Works on unasked again.' : 'Waits for your word now.');
  } else if (d.hud === 'unqueue') hudMsg(Sim.unqueue(st, +d.i), 'Removed from the queue.');
  else if (d.hud === 'job') {
    hudMsg(
      Sim.queue(st, { actor: id, verb: 'work', target: d.target }),
      `Queued: ${b.firstChild.textContent.toLowerCase()}.`,
    );
    if (+d.site >= 0) flyTo(w.hx[+d.site], w.hy[+d.site]);
  } else if (d.hud === 'project') hudMsg(Sim.head(st, 'project', { what: d.what }), `Begun: ${HUD_PROJECT[d.what]}.`);
  else if (d.hud === 'drop') hudMsg(Sim.head(st, 'dropProject', { id: +d.id }), 'Given up.');
  else if (d.hud === 'target') hudMsg(Sim.head(st, 'target', { store: d.store, n: +d.n }), 'The aim is changed.');
  else if (d.hud === 'order') {
    const steps = Sim.headView(st, hh.id).order,
      [x] = steps.splice(+d.from, 1);
    steps.splice(+d.to, 0, x);
    hudMsg(Sim.head(st, 'order', { steps }), 'The order is changed.');
  }
  hud.key = hud.markKey = hud.planKey = '';
}
if (UI2) {
  u2.tabs.innerHTML = HUD_TABS.map(
    ([k, name, icon]) =>
      `<button type="button" data-tab="${k}" aria-pressed="false" aria-label="${name}" title="${name}">${icon()}</button>`,
  ).join('');
  u2.u2.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]'),
      b = e.target.closest('[data-hud]'),
      pc = e.target.closest('[data-pc]');
    if (pc && st && played() >= 0) {
      hud.pc = hud.pc === pc.dataset.pc ? null : pc.dataset.pc;
      hud.msg = null;
      hud.planKey = '';
      const P = hudPlanned(),
        t0 = P && pc.dataset.pc.startsWith('t:') ? P.tasks[+pc.dataset.pc.slice(2)] : null;
      if (hud.pc && t0 && t0.site >= 0) flyTo(w.hx[t0.site], w.hy[t0.site]);
      return renderHud();
    }
    if (t && st && played() >= 0) {
      if (t.closest('.u2-call')) hud.at = -1;
      if (hud.tab !== t.dataset.tab || !t.closest('.u2-call')) hudTab(t.dataset.tab);
      hud.markKey = '';
    } else if (b && st && played() >= 0) hudClick(b);
    else if (e.target.closest('#u2Ribbon') && st) hudTab('plan');
    else return;
    renderHud();
  });
}
