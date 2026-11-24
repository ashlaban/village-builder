// @sys page/ui2hud: the new interface in play: the year's ribbon with its windows and the nearest deadline, and the Today, Plan and Stores tabs
// ======== the played settler's year, day and stores ========
// All of it reads st and acts through Sim: the head's verbs (Sim.head: project, target, order), the queue (Sim.queue, unqueue,
// setAuto). The page's own state, never saved: hud = {tab: 'today' | 'plan' | 'stores' | null, msg: {text, bad}, key: what was drawn}.
const hud = { tab: null, msg: null, key: '', yearKey: '' };
const HUD_TABS = [
  ['today', 'Today'],
  ['plan', 'Plan'],
  ['stores', 'Stores'],
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
  u2.ribbon.className = `u2-year u2-card press${Y.press}`;
  u2.ribbon.innerHTML =
    `<div class="u2-ribbon" role="img" aria-label="The year: ${esc(Y.line)}">` +
    Sim.SEASONS.map((s, k) => `<b class="s${k}${k === Y.c.season ? ' now' : ''}">${s}</b>`).join('') +
    (Y.sow ? band('sow', Y.sow[0], Y.sow[1], 'sow') : '') +
    band('hay', Y.hay[0], Y.hay[1], 'hay') +
    Y.ripe.map((d) => band('ripe', d, d + 2, 'reap')).join('') +
    `<u style="left:${pct(Y.c.doy + 0.5)}"></u></div><p>${esc(Y.line)}</p>`;
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
          ? 'Nothing queued: she follows the plan and does what is most needed.'
          : 'Nothing queued, and working by the plan is off: you wait.'
      }</p>`;
  const seen = new Set(),
    jobs = Sim.opportunities(st, id)
      .filter((o) => o.verb === 'work' && o.why === null && o.kind && !seen.has(o.kind) && seen.add(o.kind))
      .sort((a, b) => b.fit - a.fit)
      .slice(0, 6);
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
  h +=
    `<div class="u2-row2"><button type="button" class="u2-chip" data-hud="auto" aria-pressed="${pl.auto}">` +
    `${pl.auto ? 'Works by the plan: on' : 'Works by the plan: off'}</button>` +
    `<button type="button" class="u2-chip" data-hud="follow" aria-pressed="${followPlayed}">Follow on the map</button></div>`;
  const log = Sim.villageLog(st, 4);
  if (log.length) h += `<h3>Lately</h3><ul class="u2-log">${log.map((e) => `<li>${esc(e.text)}</li>`).join('')}</ul>`;
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
    const word =
        s.state === 'safe'
          ? 'Enough for the year ahead'
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
      `<small>${Math.round(s.parts.store)} ${unit} in store · this season needs ${Math.round(s.parts.need[0])}` +
      `${s.parts.intakes.length ? ' · more is planned to come in' : ''}</small></div>`;
  }
  const herds = Sim.describeHerds ? Sim.describeHerds(st, hh) : '';
  if (herds) h += `<h3>Animals</h3><p class="sub">${esc(String(herds))}</p>`;
  return h + (O.stale ? '<p class="sub">Counted last season; it is counted again at the next review.</p>' : '');
}
function renderHud() {
  const { id, hh, f } = hudHouse();
  if (id < 0 || !hh || !f) return;
  renderYear();
  const hour = Math.floor(st.t),
    key = `${hud.tab}|${hour}|${st.player.queue.length}|${st.player.auto}|${followPlayed}|${hud.msg ? hud.msg.text : ''}`;
  for (const b of u2.tabs.children) b.setAttribute('aria-pressed', String(b.dataset.tab === hud.tab));
  u2.sheet.hidden = !hud.tab;
  if (!hud.tab || key === hud.key || u2.sheet.matches(':active')) return;
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
// A tap on the map, in play: the played farm's house opens its stores, one of its fields the plan, the settler today. True when taken.
function hudTap(sx, sy) {
  const { id, f } = hudHouse();
  if (id < 0 || !f) return false;
  const [x, y] = toWorld(sx, sy),
    i = loc(x, y, [0, 0]),
    tab = pawnAt(x, y) === id ? 'today' : i === f.house ? 'stores' : f.fields.some((q) => q.tile === i) ? 'plan' : null;
  if (!tab) return false;
  if (hud.tab !== tab) hudTab(tab);
  return true;
}
function hudClick(b) {
  const d = b.dataset,
    { id, hh } = hudHouse();
  if (d.hud === 'close') hud.tab = null;
  else if (d.hud === 'fly') flyTo(w.hx[+d.tile], w.hy[+d.tile]);
  else if (d.hud === 'follow') {
    followPlayed = !followPlayed;
    if (followPlayed) flyToFarmOf(id);
  } else if (d.hud === 'auto')
    hudMsg(Sim.setAuto(st, !st.player.auto), st.player.auto ? 'She waits for your word.' : 'She works by the plan.');
  else if (d.hud === 'unqueue') hudMsg(Sim.unqueue(st, +d.i), 'Removed from the queue.');
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
  hud.key = '';
}
if (UI2) {
  u2.tabs.innerHTML = HUD_TABS.map(
    ([k, name]) => `<button type="button" data-tab="${k}" aria-pressed="false">${name}</button>`,
  ).join('');
  u2.u2.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]'),
      b = e.target.closest('[data-hud]');
    if (t && st) hudTab(t.dataset.tab);
    else if (b && st && played() >= 0) hudClick(b);
    else if (e.target.closest('#u2Ribbon') && st) hudTab('plan');
    else return;
    renderHud();
  });
}
