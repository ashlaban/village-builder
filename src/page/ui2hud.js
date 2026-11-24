// @sys page/ui2hud: the new interface in play: the year's ribbon with its windows and the nearest deadline, and the Today, Plan and Stores tabs
// ======== the played settler's year, day and stores ========
// All of it reads st and acts through Sim: the head's verbs (Sim.head: project, target, order), the queue (Sim.queue, unqueue,
// setAuto). The page's own state, never saved: hud = {tab: 'today' | 'plan' | 'stores' | null, msg: {text, bad}, key: what was drawn}.
const hud = { tab: null, msg: null, key: '', yearKey: '', at: -1, markKey: '', sites: null };
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
  u2.alert.hidden = !hud.press || !!hud.tab;
  hudMarks(id, hh, f);
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
// ---- on the land: how things stand, and what can be done where ----
// A field's badge: a word or two and how pressing it is.
function fieldBadge(fd) {
  const C = VB['sim/crops'].CROPS[fd.crop],
    c = Sim.cal(st.t),
    day = Math.floor(st.t / Sim.DAY);
  if (fd.stage === 'sown' || fd.stage === 'growing')
    return [`${fd.crop} ${Math.min(C.ripe, Math.max(0, day - fd.sown))}/${C.ripe}`, 0];
  if (fd.stage === 'ripe') return ['ripe: reap', 2];
  if (fd.stage === 'stooks') return ['carry in', 1];
  if (fd.stage === 'fallow' || fd.stage === 'scrub') return ['overgrown', 1];
  if (C.fallow) return ['fallow', 0];
  const open = c.season === C.sow[0] && c.sday >= C.sow[1] && c.sday <= C.sow[2],
    left = C.sow[2] - c.sday + 1;
  return [`${fd.stage === 'plowed' ? 'sow' : 'hoe'}${open ? ` · ${left}d left` : ''}`, open ? (left <= 3 ? 2 : 1) : 0];
}
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
  jobs.slice(0, 3).forEach((o, n) => {
    acts +=
      `<button type="button" class="u2-act${n ? '' : ' go'}" data-hud="job" data-target="${esc(o.target)}" data-site="-1">${esc(Sim.KINDS[o.kind].name)}` +
      `<small>${o.when === 'now' ? 'She goes and does it next' : 'Queued for when it opens'}</small></button>`;
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
    key = `${Math.floor(st.t)}|${hud.at}|${hud.msg ? hud.msg.text : ''}|${hud.tab}|${st.player.queue.length}|${site}|${V.tiles.field}|${V.tiles.meadow}`;
  if (key === hud.markKey) return;
  hud.markKey = key;
  const marks = [];
  f.fields.forEach((fd, k) => {
    const [text, press] = fieldBadge(fd);
    if (fd.tile !== hud.at) marks.push({ id: `f${k}`, tile: fd.tile, cls: `u2-badge press${press}`, html: esc(text) });
  });
  if (site >= 0 && site !== hud.at && V.project) {
    const kn = Sim.KINDS[V.project.step];
    marks.push({ id: 'site', tile: site, cls: 'u2-badge work', html: esc(kn ? kn.name : V.project.what) });
  }
  for (const what of ['field', 'meadow'])
    if (V.tiles[what] >= 0 && V.tiles[what] !== site && V.tiles[what] !== hud.at)
      marks.push({
        id: `next${what}`,
        tile: V.tiles[what],
        cls: 'u2-badge',
        html: what === 'field' ? 'next field' : 'next meadow',
      });
  if (O && f.house !== hud.at)
    marks.push({
      id: 'house',
      tile: f.house,
      cls: 'u2-gauges',
      html: [
        ['food', 'food'],
        ['fuel', 'wood'],
        ['hay', 'hay'],
      ]
        .map(([k, name]) => `<i class="${O[k].state}"><u></u>${name}</i>`)
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
  else if (d.hud === 'shut') hud.at = -1;
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
  hud.key = hud.markKey = '';
}
if (UI2) {
  u2.tabs.innerHTML = HUD_TABS.map(
    ([k, name]) => `<button type="button" data-tab="${k}" aria-pressed="false">${name}</button>`,
  ).join('');
  u2.u2.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]'),
      b = e.target.closest('[data-hud]');
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
