// @sys page/ui2hud: the new interface in play: the year's ribbon with its windows and the nearest deadline, the settler's card and the stores, and the clicks
// ======== the played settler's year, day and stores ========
// All of it reads st and acts through Sim: the head's verbs (Sim.head: project, target, order), the queue (Sim.queue, unqueue,
// setAuto). The page's own state, never saved: hud = {tab: 'today' | 'plan' | 'stores' | null, msg: {text, bad}, key: what was drawn}.
const hud = {
  tab: null,
  msg: null,
  key: '',
  yearKey: '',
  at: -1,
  markKey: '',
  sites: null,
  pc: null,
  pinfo: null,
  planKey: '',
  goAt: null, // {tile, chain}: the window's act opened this tile's card (yearGo), its chain shown first
};
const HUD_TABS = [
  ['build', 'Build', () => actIcon('build')],
  ['me', 'The settler', () => actIcon('me')],
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
  // the line's words, behind a tap; its first view the window's glyph and the game days left (chips: page/ui2land factChips)
  let line,
    press,
    win = null,
    chips = [];
  const left = (icon, n, label) => ({ icon, n: String(n), label });
  if (buildCalls(f)) {
    line = 'Nothing is built yet: the build button places your farmstead';
    press = 1;
    chips = [{ icon: actIcon('build'), n: '!', label: 'Build the farmstead' }];
  } else if (sow && c.doy <= sow[1] && sown < Math.max(1, fields.length)) {
    const n = sow[1] - c.doy + 1;
    line = fields.length
      ? `Sow by spring day ${sow[1] + 1}: ${laneDays(n)} left, ${sown} of ${fields.length} ${fields.length === 1 ? 'field' : 'fields'} sown`
      : `Sowing closes after spring day ${sow[1] + 1}: ${laneDays(n)} left, and no field is broken yet`;
    press = n <= 3 ? 2 : 1;
    win = 'plant';
    chips = [
      left(actIcon('sow'), n, `Sowing: ${laneDays(n)} left`),
      fields.length
        ? { icon: goodIcon('field'), n: `${sown}/${fields.length}`, label: `${sown} of ${fields.length} sown` }
        : { icon: `<span class="gap">${goodIcon('field')}</span>`, n: '', label: 'No field yet' },
    ];
  } else if (c.doy < hay[0]) {
    line = `Haymaking opens in ${laneDays(hay[0] - c.doy)}`;
    press = 0;
    chips = [{ icon: actIcon('wait') + actIcon('hay'), n: String(hay[0] - c.doy), label: line }];
  } else if (c.doy <= hay[1]) {
    const n = hay[1] - c.doy + 1;
    line = `Haymaking: ${laneDays(n)} left to mow`;
    press = n <= 3 ? 2 : 1;
    win = 'hay';
    chips = [left(actIcon('hay'), n, line)];
  } else if (c.season < 3) {
    line = `Winter in ${laneDays(3 * S - c.doy)}: bring in the harvest and the wood`;
    press = 3 * S - c.doy <= 4 ? 1 : 0;
    win = 'harvest';
    chips = [left(goodIcon('cold'), 3 * S - c.doy, `Winter in ${laneDays(3 * S - c.doy)}`)];
  } else {
    line = `Winter: ${laneDays(4 * S - c.doy)} to spring`;
    press = 0;
    chips = [left(seasonIcon(0), 4 * S - c.doy, line)];
  }
  const go = win && f ? yearGo(win, hh, f) : null;
  return { c, sow, hay, ripe, line, press: go ? Math.max(1, press) : press, chips, go }; // a window's act shows the line, calm or not
}
// The window's act (the playtest of 27 Nov: a window with no way to it): the tile the window's work is best begun at, for a chain of
// work the plan does not hold yet: a pressing gap of the plan (Sim.planGaps), else the farm's own field or meadow, else the tile the
// head marked for the next one, else the nearest the head's own check takes. {chain, tile}, or null with the work already planned or
// nowhere to do it. A tap flies there and opens the tile's card, where the chain's button adds it.
function yearGo(chain, hh, f) {
  const P = hudPlanned();
  if (!P || P.tasks.some((t) => t.kind === chain)) return null;
  const g = hudGaps().find((x) => x.goal === chain);
  if (g) return { chain, tile: g.tile };
  if (chain === 'harvest') return null;
  const own = chain === 'plant' ? f.fields.find((x) => x.stage === 'stubble' || x.stage === 'plowed') : f.meadows[0];
  if (own) return { chain, tile: own.tile };
  const V = Sim.headView(st, hh.id),
    marked = chain === 'plant' ? V.tiles.field : V.tiles.meadow;
  if (Number.isInteger(marked) && marked >= 0) return { chain, tile: marked };
  const first = [...hudSites(hh)[chain === 'plant' ? 'field' : 'meadow']][0];
  return first === undefined ? null : { chain, tile: first };
}
const YEAR_GO = { plant: 'Plant', hay: 'Make hay', harvest: 'Harvest' };
function renderYear() {
  const { hh, f } = hudHouse();
  if (!hh) return;
  const Y = hudYear(hh, f),
    N = Sim.YEAR_DAYS,
    key = `${Y.c.year}|${Y.c.doy}|${Y.line}|${Y.ripe.join()}|${hud.yinfo}|${Y.go ? `${Y.go.chain}${Y.go.tile}` : ''}`;
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
  // the window's glyph and the game days left; a tap says it in words (Kim, 27 Nov)
  u2.alert.innerHTML =
    `<button type="button" class="u2-yline" data-hud="pinfo" data-slot="yinfo" data-k="year" aria-pressed="${hud.yinfo === 'year'}" ` +
    `aria-label="${esc(Y.line)}" title="${esc(Y.line)}">${Y.chips
      .map((x) => `<span class="u2-ychip" aria-hidden="true">${x.icon}${x.n ? `<b>${esc(x.n)}</b>` : ''}</span>`)
      .join('')}</button>` +
    (Y.go
      ? `<button type="button" class="u2-ygo" data-hud="ygo" data-tile="${Y.go.tile}" data-chain="${Y.go.chain}" ` +
        `aria-label="${esc(`${HUD_CHAIN[Y.go.chain].name}: show where`)}" ` +
        `title="${esc(HUD_CHAIN[Y.go.chain].name)}">${actIcon('target')}${HUD_CHAIN[Y.go.chain].icon()}<span>${YEAR_GO[Y.go.chain]}</span></button>`
      : '') +
    (hud.yinfo === 'year' ? `<span class="u2-ywords">${esc(Y.line)}.</span>` : '');
  hud.press = Y.press;
}
// ---- the tabs ----
function hudMsg(r, done) {
  hud.msg = r === true ? { text: done } : { text: siteCap(String(r)), bad: true };
  hud.key = '';
}
// The settler's own card: what it does and why, its health and mood with what moves them, its sleep, and what happened lately.
function meHTML(id) {
  const p = st.pawns[id],
    why = Sim.reasonLine(st, id),
    M = Sim.moodOf(st, id),
    S = Sim.sleepOf(st),
    bar = (icon, label, v, word) =>
      `<div class="u2-stat"><span>${goodIcon(icon)}${label}</span><i><u style="width:${Math.max(0, Math.min(100, v)).toFixed(0)}%"` +
      `${v < 40 ? ' class="bad"' : v < 70 ? ' class="short"' : ''}></u></i><b>${Math.round(v)}${word ? ` <small>${esc(word)}</small>` : ''}</b></div>`;
  let h = `<p class="u2-doing"><b>${esc(Sim.describe(st, id))}</b>${why ? `<small>${esc(why)}</small>` : ''}</p>`;
  h += bar('health', 'Health', p.health, '') + (M ? bar('mood', 'Mood', M.mood, Sim.moodWord(M.mood)) : '');
  const lines = hudAils().map(([, words]) => words);
  if (M) for (const x of M.mods) lines.push(`${x.label}: mood ${x.value > 0 ? '+' : '−'}${Math.abs(x.value)}.`);
  if (S && S.owed >= 1)
    lines.push(`Owes ${Math.round(S.owed)} ${Math.round(S.owed) === 1 ? 'hour' : 'hours'} of sleep.`);
  h += lines.length
    ? `<ul class="u2-log">${lines.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`
    : '<p class="sub">Nothing ails it.</p>';
  h += `<div class="u2-row2"><button type="button" class="u2-chip" data-hud="follow" aria-pressed="${followPlayed}">Follow on the map</button></div>`;
  const log = Sim.villageLog(st, 5);
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
const HUD_STORES = [
  ['food', 'Food', 'rations'],
  ['fuel', 'Firewood', 'measures'], // a load home is Sim.ECON.woodPerTrip measures
  ['hay', 'Hay', 'loads'],
];
// What the outlook of a household planned by hand left out for want of a task (parts.left, VB-1661): a dashed chip of the good and how
// much, its sentence a tap away, and the way to it as buttons.
function storeLeft(x, f, unit, good, k) {
  const fi = f.fields.findIndex((q) => q.tile === x.tile),
    mi = f.meadows.findIndex((q) => q.tile === x.tile),
    at = fi >= 0 ? `field ${fi + 1}` : mi >= 0 ? `hay meadow ${mi + 1}` : 'the wood',
    n = `about ${Math.round(x.n)} ${unit}`,
    show = Number.isInteger(x.tile)
      ? `<button type="button" class="u2-chip" data-hud="fly" data-tile="${x.tile}">${actIcon('target')} Show</button>`
      : '',
    chain = (c, label, why) =>
      `<button type="button" class="u2-chip go" data-hud="chain" data-chain="${c}" data-tile="${x.tile}" aria-label="${esc(why)}" ` +
      `title="${esc(why)}">${actIcon('plus')}${HUD_CHAIN[c].icon()} ${label}</button>`,
    cut = `<button type="button" class="u2-chip go" data-hud="cutwood" aria-label="Cut firewood">${actIcon('plus')}${goodIcon('wood')} Cut</button>`;
  const [words, acts] =
    x.what === 'harvest'
      ? [
          `${siteCap(n)} of ${x.crop} on ${at}: no task of the plan brings in its harvest.`,
          show + chain('harvest', 'Bring in', 'Bring it in'),
        ]
      : x.what === 'mown'
        ? [
            `${siteCap(n)} of hay lying mown on ${at}: no task of the plan brings it home.`,
            show + chain('hay', 'Make hay', 'Make hay here'),
          ]
        : x.what === 'meadow'
          ? [
              `${siteCap(n)} of hay on ${at}: no task of the plan mows it.`,
              show + chain('hay', 'Make hay', 'Make hay here'),
            ]
          : x.what === 'timber'
            ? [`${siteCap(woodTimber(x.n))} at home: no task of the plan cuts it into firewood.`, cut]
            : x.what === 'fell'
              ? [
                  `${siteCap(woodTimber(x.n))} to be felled in ${at}: no task of the plan cuts it into firewood.`,
                  show + cut,
                ]
              : [
                  `${siteCap(n)} of firewood for the year ahead: no task of the plan fells and cuts it. ${WOOD_PATH}`,
                  '',
                ];
  return {
    fact: {
      k,
      icon: `<span class="gap">${goodIcon(good)}</span>`,
      n: String(Math.round(x.n)),
      cls: 'left',
      label: `Not counted: ${n}`,
      why: `Not counted: ${words}`,
    },
    acts,
  };
}
const STORE_KEY =
  'Each bar is a good; its four cells are the seasons ahead, from now (sprout spring, sun summer, leaf autumn, snowflake winter), each ' +
  'filled as far as the store lasts into it. Green: it lasts the year; gold: it runs short; red: it runs badly short. A faded cell: ' +
  'none of it is needed that season. Counted: what is in store, and what the tasks of the plan bring in, nothing else. A dashed chip: ' +
  'what is not counted, for want of a task of the plan.';
const STORE_ICON = { food: 'grain', fuel: 'wood', hay: 'hay' };
// The stores: a row a good, its icon, its meter of the seasons ahead and the season it lasts to; the words behind a chip or "i" (hud.sinfo).
function storesHTML(hh) {
  const O = Sim.supplyOutlook(st, hh.id),
    f = st.farmsteads[hh.farmstead];
  if (!O) {
    const none = [
      {
        k: 'none',
        icon: actIcon('wait'),
        n: '',
        label: 'Not reckoned yet',
        why: 'Not reckoned yet: the stores are counted on the first morning.',
      },
    ];
    return `<div class="u2-facts">${factChips(none, 'sinfo')}</div>${factWords(none, 'sinfo')}`;
  }
  let h = '';
  for (const [key, label, unit] of HUD_STORES) {
    const s = O[key];
    if (s.state === 'none') continue;
    const coming = s.parts.intakes.reduce((n, x) => n + x.n, 0),
      left = (s.parts.left || []).map((x, k) => storeLeft(x, f, unit, STORE_ICON[key], `${key}-left${k}`)),
      runs = Sim.SEASONS[(O.season + s.season) % 4],
      facts = [
        s.state === 'safe'
          ? {
              k: `${key}-lasts`,
              icon: actIcon('vok'),
              n: '',
              cls: 'v0',
              label: 'Lasts the year',
              why: coming > 0 ? 'Lasts the year ahead, if the tasks planned are done.' : 'Lasts the year ahead.',
            }
          : {
              k: `${key}-lasts`,
              icon: seasonIcon((O.season + s.season) % 4),
              n: '',
              cls: s.state === 'bad' ? 'v2' : 'v1',
              label: `Runs short in ${runs}`,
              why: `Runs ${s.state === 'bad' ? 'badly ' : ''}short in ${runs}.`,
            },
        {
          k: `${key}-store`,
          icon: actIcon('sack'),
          n: String(Math.round(s.parts.store)),
          label: `${Math.round(s.parts.store)} ${unit} in store`,
          why: `${Math.round(s.parts.store)} ${unit} in store now.`,
        },
        coming > 0
          ? {
              k: `${key}-coming`,
              icon: actIcon('plus'),
              n: String(Math.round(coming)),
              label: `${Math.round(coming)} more from the plan`,
              why: `About ${Math.round(coming)} ${unit} more from the tasks of the plan.`,
            }
          : null,
        ...left.map((x) => x.fact),
      ].filter(Boolean),
      cells = [0, 1, 2, 3]
        .map((k) => {
          const fill = Math.max(0, Math.min(1, s.own - k)),
            need = s.parts.need[k] > 0;
          return (
            `<i class="${need ? '' : 'idle'}" title="${Sim.SEASONS[(O.season + k) % 4]}">` +
            `<u style="width:${(fill * 100).toFixed(0)}%"></u><span>${seasonIcon((O.season + k) % 4)}</span></i>`
          );
        })
        .join('');
    h +=
      `<div class="u2-store ${s.state}"><div class="u2-shead">${goodIcon(STORE_ICON[key])}<b>${label}</b>` +
      `<div class="u2-facts">${factChips(facts, 'sinfo')}</div></div><div class="u2-cells">${cells}</div>` +
      factWords(facts, 'sinfo') +
      (left.some((x) => x.acts) ? `<div class="u2-row2">${left.map((x) => x.acts).join('')}</div>` : '') +
      '</div>';
  }
  const herds = Sim.describeHerds ? String(Sim.describeHerds(st, hh) || '') : '',
    more = [
      herds ? { k: 'herds', icon: goodIcon('beast'), n: '', label: 'Animals', why: herds } : null,
      { k: 'key', chip: false, icon: seasonIcon(O.season), why: STORE_KEY },
      O.stale
        ? {
            k: 'stale',
            icon: actIcon('wait'),
            n: '',
            cls: 'v1',
            label: 'Counted last season',
            why: 'Counted last season; it is counted again at the next review.',
          }
        : null,
    ].filter(Boolean);
  return h + `<div class="u2-facts">${factChips(more, 'sinfo')}</div>` + factWords(more, 'sinfo');
}
function renderHud() {
  const { id, hh, f } = hudHouse();
  if (id < 0 || !hh || !f) return;
  renderYear();
  u2.alert.hidden = !hud.press || !!hud.tab || !!hud.place;
  renderBuild(f);
  hudMarks(id, hh, f);
  renderPlan();
  const hour = Math.floor(st.t),
    ctl = Sim.controlOf(st, st.player.pawn),
    key = `${hud.tab}|${hud.sinfo}|${hud.binfo}|${hour}|${ctl.queue.length}|${ctl.auto}|${followPlayed}|${hud.msg ? hud.msg.text : ''}`;
  for (const b of u2.tabs.children) b.setAttribute('aria-pressed', String(b.dataset.tab === hud.tab));
  u2.sheet.hidden = !hud.tab;
  if (!hud.tab || key === hud.key) return;
  hud.key = key;
  const top = u2.sheet.scrollTop,
    body = hud.tab === 'me' ? meHTML(id) : hud.tab === 'build' ? buildHTML() : storesHTML(hh);
  u2.sheet.innerHTML =
    `<header><h2>${hud.tab === 'me' ? esc(Sim.fullName(st.pawns[id])) : hud.tab === 'build' ? 'Build' : esc(f.name) + ': stores'}</h2>` +
    (hud.tab === 'stores' ? factI('sinfo') : hud.tab === 'build' ? factI('binfo') : '') +
    `<button type="button" class="u2-chip" data-hud="close" aria-label="Close">Close</button></header>` +
    (hud.msg ? `<p class="u2-msg${hud.msg.bad ? '' : ' ok'}">${esc(hud.msg.text)}</p>` : '') +
    body;
  u2.sheet.scrollTop = top;
}
function hudTab(tab) {
  const open = hud.tab === tab ? null : tab;
  if (tab === 'build') buildPick(null); // the menu again: what was being placed is let go
  hud.tab = open;
  hud.msg = hud.sinfo = hud.binfo = null;
  hud.key = '';
  u2.sheet.scrollTop = 0;
}
function hudClick(b) {
  const d = b.dataset,
    { id, hh } = hudHouse();
  if (d.hud === 'close') hud.tab = null;
  else if (d.hud === 'pshut') hud.pc = hud.pmove = hud.pinfo = null;
  else if (d.hud === 'pinfo') {
    const k = d.slot || 'pinfo'; // a chip's words, or all of them under "i" (page/ui2land factChips)
    hud[k] = hud[k] === d.k ? null : d.k;
  } else if (d.hud === 'buildpick') buildPick(d.what);
  else if (d.hud === 'placeoff') buildPick(null);
  else if (d.hud === 'buildhere') buildHere();
  else if (d.hud === 'uptoggle') hud.up = !hud.up;
  else if (d.hud === 'upgrade') ladderAdd(d.kind, d.what);
  else if (d.hud === 'fell') {
    const n = +d.n;
    hudMsg(
      Sim.plan(st, st.player.pawn, 'add', { fell: +d.tile, n }),
      `Added to the plan: felling, ${n} ${n === 1 ? 'load' : 'loads'}.`,
    );
  } else if (d.hud === 'cutwood')
    hudMsg(
      Sim.plan(st, st.player.pawn, 'add', { firewood: hudHouse().f.house }),
      'Added to the plan: cutting firewood.',
    );
  else if (d.hud === 'planadd') hudMsg(Sim.plan(st, st.player.pawn, 'add', { key: d.target }), 'Added to the plan.');
  else if (d.hud === 'premove') {
    hudMsg(Sim.plan(st, st.player.pawn, 'remove', { i: +d.i }), 'Taken out of the plan.');
    hud.pc = null;
  } else if (d.hud === 'pmove') {
    // the knock-on first (page/ui2ahead): a move that makes another task tight or late waits for the player's word
    const worse = d.sure ? [] : laneKnock(+d.from, +d.to);
    hud.pmove = worse.length ? { from: +d.from, to: +d.to, worse } : null;
    hud.msg = hud.pinfo = null;
    if (!worse.length) {
      const r = Sim.plan(st, st.player.pawn, 'move', { from: +d.from, to: +d.to });
      hudMsg(r, 'The order is changed.');
      if (r === true) hud.pc = `t:${d.to}`;
    }
  } else if (d.hud === 'pkeep') {
    const r = Sim.plan(st, st.player.pawn, 'keep', { i: +d.i, on: !!d.on }); // the pressed pin says it: words only on a refusal
    hud.msg = null;
    if (r !== true) hudMsg(r, '');
  } else if (d.hud === 'pmovecancel') {
    hud.pmove = hud.pinfo = null;
    hudMsg(true, 'The order is kept.');
  } else if (d.hud === 'psleep')
    hudMsg(
      Sim.plan(
        st,
        st.player.pawn,
        'sleep',
        d.off ? null : { from: ((+d.from % 24) + 24) % 24, until: ((+d.until % 24) + 24) % 24 },
      ),
      d.off ? 'No hours for sleep now.' : 'The sleeping hours are changed.',
    );
  else if (d.hud === 'pdrop' || d.hud === 'padd') {
    const now = hudPlanned().routine.map((r) => r.kind),
      kinds =
        d.hud === 'padd' ? HUD_DAILY.filter((k) => now.includes(k) || k === d.kind) : now.filter((k) => k !== d.kind);
    hudMsg(
      Sim.plan(st, st.player.pawn, 'routine', { kinds }),
      d.hud === 'padd' ? 'Back in the routine.' : 'Dropped from the routine.',
    );
    if (d.hud === 'pdrop') hud.pc = 'sleep';
  } else if (d.hud === 'shut') hud.at = -1;
  else if (d.hud === 'walk')
    hudMsg(Sim.queue(st, st.player.pawn, { actor: id, verb: 'walkTo', target: hud.at }), 'Queued: walk here.');
  else if (d.hud === 'chain')
    hudMsg(
      Sim.plan(st, st.player.pawn, 'add', { [d.chain]: d.tile !== undefined ? +d.tile : hud.at }),
      `Added to the plan: ${HUD_CHAIN[d.chain].done}.`,
    );
  else if (d.hud === 'ygo') {
    // the window's act: fly to its tile and open the tile's card, whose button adds the chain (its first button, "go")
    flyTo(w.hx[+d.tile], w.hy[+d.tile]);
    hud.tab = hud.msg = null;
    hud.at = +d.tile;
    hud.goAt = { tile: +d.tile, chain: d.chain };
    hud.tapAt = performance.now();
  } else if (d.hud === 'fly') {
    flyTo(w.hx[+d.tile], w.hy[+d.tile]);
    if (b.closest('#u2Sheet')) ((hud.tab = null), (hud.at = +d.tile), (hud.tapAt = performance.now())); // from the stores: its tile's callout
  } else if (d.hud === 'follow') {
    followPlayed = !followPlayed;
    if (followPlayed) flyToFarmOf(id);
  } else if (d.hud === 'unqueue') {
    hudMsg(Sim.unqueue(st, st.player.pawn, +d.i), 'Taken off.');
    hud.pc = null;
  } else if (d.hud === 'job') {
    hudMsg(
      Sim.queue(st, st.player.pawn, { actor: id, verb: 'work', target: d.target }),
      `Queued: ${(d.name || b.textContent.trim()).toLowerCase()}.`,
    );
  } else if (d.hud === 'drop') hudMsg(Sim.head(st, st.player.pawn, 'dropProject', { id: +d.id }), 'Given up.');
  hud.key = hud.markKey = hud.planKey = '';
}
if (UI2) {
  u2.tabs.innerHTML = HUD_TABS.map(
    ([k, name, icon]) =>
      `<button type="button" data-tab="${k}" aria-pressed="false" aria-label="${name}" title="${name}">${icon()}</button>`,
  ).join('');
  u2.u2.addEventListener('click', (e) => {
    // the tap that opened a callout presses nothing in it: what appears under the finger is not what was aimed at
    if (e.target.closest('.u2-call') && performance.now() - (hud.tapAt || 0) < 450) return;
    const t = e.target.closest('[data-tab]'),
      b = e.target.closest('[data-hud]'),
      pc = e.target.closest('[data-pc]');
    if (pc && st && played() >= 0) {
      hud.pc = hud.pc === pc.dataset.pc ? null : pc.dataset.pc;
      hud.msg = hud.pmove = hud.pinfo = null;
      hud.planKey = '';
      return renderHud(); // the map stays where it is: a task's card has "Show" for its place
    }
    if (t && st && played() >= 0) {
      if (t.closest('.u2-call')) hud.at = -1;
      if (hud.tab !== t.dataset.tab || !t.closest('.u2-call')) hudTab(t.dataset.tab);
      hud.markKey = '';
    } else if (b && st && played() >= 0) hudClick(b);
    else return;
    renderHud();
  });
}
