// @sys page/ui2land: the new interface on the land: the pins at the tiles, the house's gauges and warnings, and a tile's callout with what can be done there
// ---- on the land: how things stand, and what can be done where ----
// What took of the settler's health at its last reckoning (st.player.days, VB-1118), each an icon at the house and a sentence in its
// callout: the warning stands on the land, its words a tap away.
// The day kept is the last one reckoned (its `t`, at the day's end): its cold is of the roof that stood then, so a shelter raised since is
// said to have come after it. `damp` is a day without water (sim/hunger's dry day, VB-331), not the roof's.
const HUD_AILS = [
  ['cold', 'cold', ''],
  ['damp', 'water', 'A day without water: none was fetched for the house. Fetching water is in the daily routine.'],
  ['hunger', 'hunger', 'Hunger is taking of its health.'],
  ['tired', 'mood', 'Lack of sleep is taking of its health.'],
  ['ill', 'health', 'It is ill.'],
];
// The cold of day d in words, by the roof that stood when it was reckoned and what stands now.
function hudColdWords(d) {
  const { hh, f } = hudHouse(),
    { hexSteps } = VB['sim/hex'],
    sh = f && f.shelter && f.shelter.built !== null ? f.shelter : null, // the shelter on the house tile (VB-1666)
    booth = sh || (f && hh ? st.booths.find((b) => b.by === hh.id && hexSteps(w, b.tile, f.house) <= 1) : null), // or an older save's
    roofed = f && (!f.booth || (booth && booth.built <= d.t));
  if (roofed) return 'The last night was cold: too little firewood for the fire. ' + WOOD_PATH;
  const then = 'The last night was cold: there was no roof and fire to sleep by.';
  if (booth || (f && !f.booth)) return `${then} The shelter stands now: the next night is under its roof.`;
  return `${then} ${buildCalls(f) ? 'Build a farmstead: the build button.' : 'The shelter in the plan mends that.'}`;
}
function hudAils() {
  const d = (st.player.days || []).slice(-1)[0],
    seen = new Set();
  return d
    ? HUD_AILS.filter(([k, icon]) => d.why[k] >= 0.2 && !seen.has(icon) && seen.add(icon)).map(([k, icon, words]) => [
        icon,
        k === 'cold' ? hudColdWords(d) : words,
      ])
    : [];
}
// The house's three bars in words: what each measures and how it stands by the head's reckoning (Sim.supplyOutlook).
const hudLasts = (O, k) =>
  O[k].state === 'safe'
    ? 'lasts the year'
    : `runs ${O[k].state === 'bad' ? 'badly ' : ''}short in ${Sim.SEASONS[(O.season + O[k].season) % 4]}`;
function hudGauges(hh) {
  const O = Sim.supplyOutlook(st, hh.id);
  if (!O) return 'The bars under the house are food, firewood and hay: they are reckoned on the first morning.';
  const goods = HUD_STORES.filter(([k]) => O[k].state !== 'none'),
    left = goods.some(([k]) => (O[k].parts.left || []).length);
  return (
    goods.map(([k, label]) => `${label}: ${hudLasts(O, k)}.`).join(' ') +
    (left ? ' Some is not counted, for want of a task of the plan: Stores says what.' : '')
  );
}
// How many live in the house against its room (sim/house roomOf, VB-1664): crowded, every member's mood suffers until a larger house.
function hudRoom(hh, f, FV) {
  const room = VB['sim/house'].roomOf(f),
    n = hh.members.length;
  if (!Number.isFinite(room)) return '';
  const lives = `${n} ${n === 1 ? 'lives' : 'live'} here`;
  if (n <= room) return `<p class="u2-legend">${goodIcon('people')} ${lives}, room for ${room}.</p>`;
  const next = FV && FV.next.length ? ladderOf(FV.next[0].what).name.toLowerCase() : '';
  return (
    `<p class="u2-move bad">${goodIcon('people')} Crowded: ${lives}, room for ${room}; everyone’s mood suffers.` +
    `${next ? ` A ${next} mends it: Build up.` : ''}</p>`
  );
}
// What of a farm's move lies at its landing (VB-1667): the loads marked `moving`, the cart left there, the herds standing there; and the
// landing's tile, or null when nothing is left.
function hudMoving(hh, f) {
  const lying = (st.lying || []).filter(
      (x) => x.of && x.of.moving && x.owner && x.owner.id === hh.id && x.kind !== 'leftCart',
    ),
    cart = hh.carts.find((c) => c.at && c.at.kept),
    herds = (st.herdsAway || [])
      .map((i) => st.herds[i])
      .filter((x) => x && x.tile !== undefined && x.household === hh.id);
  const tile = lying.length ? lying[0].tile : cart ? cart.at.tile : herds.length ? herds[0].tile : -1;
  if (tile < 0 || tile === f.house) return null;
  const NAMES = { leftGrain: 'grain', leftTimber: 'firewood and timber', hay: 'hay', grain: 'grain' },
    parts = lying.map((x) => `${Math.round(x.n)} ${NAMES[x.kind] || x.kind}`);
  if (cart) parts.push('the cart');
  if (herds.length) parts.push(herds.length === 1 ? 'a herd' : `${herds.length} herds`);
  const P = hudPlanned(),
    t = P && P.tasks.find((q) => q.kind === 'farmstead'),
    e = t ? hudTaskEntry(Sim.agenda(st), t) : null,
    frost = e && e.deadline ? e.deadline : null;
  return { tile, parts, frost, lying: lying.length };
}
// The windows that press with no task of the plan for them (Sim.planGaps, VB-1650).
const hudGaps = () => (Sim.planGaps && HUD_CHAIN ? (Sim.planGaps(st) || []).filter((g) => HUD_CHAIN[g.chain]) : []);
// A field's pin: the icon of what it waits for, a number of days where one counts (to ripe, or left to sow), and how pressing it is.
// The words are the tile's callout (fieldLine), a tap away.
function fieldPin(fd) {
  const C = VB['sim/crops'].CROPS[fd.crop],
    c = Sim.cal(st.t),
    day = Math.floor(st.t / Sim.DAY);
  if (fd.stage === 'sown' || fd.stage === 'growing') {
    const n = C.ripe - Math.min(C.ripe, Math.max(0, day - fd.sown));
    return [
      goodIcon(GOOD_PATHS[fd.crop] ? fd.crop : 'seed'),
      n,
      0,
      `The ${fd.crop} grows: about ${hudDays(n)} until it is ripe.`,
    ];
  }
  if (fd.stage === 'ripe')
    return [actIcon('mow'), '!', 2, `The ${fd.crop} is ripe: it is reaped now, or lost to the frost.`];
  if (fd.stage === 'stooks')
    return [goodIcon('sheaves'), '', 1, 'Reaped: the sheaves stand drying until they are carried in.'];
  if (fd.stage === 'fallow' || fd.stage === 'scrub')
    return [actIcon('weed'), '', 1, 'Untilled and growing over: it is hoed before it can be sown again.'];
  if (C.fallow) return [goodIcon('fallow'), '', 0, 'Lies fallow this year, to rest the soil.'];
  const open = c.season === C.sow[0] && c.sday >= C.sow[1] && c.sday <= C.sow[2],
    left = C.sow[2] - c.sday + 1,
    plowed = fd.stage === 'plowed';
  return [
    actIcon(plowed ? 'sow' : 'hoe'),
    open ? left : '',
    open ? (left <= 3 ? 2 : 1) : 0,
    `Waits to be ${plowed ? 'sown' : 'hoed, then sown'} with ${fd.crop}` +
      (open
        ? `: ${hudDays(left)} of the sowing ${left === 1 ? 'is' : 'are'} left (the number).`
        : ': the sowing is not open now.'),
  ];
}
// A mark's own explanation, in the callout of its tile when the mark was what was tapped (Kim, 24 Nov: a tap on anything standing on a
// tile opens that tile's callout, the mark's words in a band on top with its icon repeated).
const hudBand = (b) =>
  b && b.why ? `<p class="u2-band"><span class="${esc(b.cls)}">${b.html}</span><span>${esc(b.why)}</span></p>` : '';
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
const HUD_ENDS = {
  plant: 'to a sown field',
  hay: 'until the hay is home',
  harvest: 'until the sheaves are in',
  farmstead: 'until the shelter stands',
  fell: 'until the timber is home',
  firewood: 'until it is cut',
  upgrade: 'until it is finished',
  foundation: 'until the house stands on stone',
  outbuilding: 'until it stands',
};
function hudStake(e) {
  let t = `About ${hudSpan(e.hours.mid)} of work`;
  if (e.steps && e.steps.length)
    t += ` ${HUD_ENDS[e.kind] || HUD_ENDS.plant} (${e.steps.map((x) => hudKind(x.kind).toLowerCase()).join(', ')})${e.rough ? ', roughly' : ''}`;
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
  if (hud.place) return placeCall(i);
  const P0move = (hudPlanned() || { tasks: [] }).tasks.some((t) => t.kind === 'farmstead');
  const V = Sim.headView(st, hh.id),
    fi = f.fields.findIndex((q) => q.tile === i),
    mi = (f.meadows || []).findIndex((q) => q.tile === i),
    seen = new Set(),
    jobs = Sim.opportunities(st, id).filter(
      (o) =>
        o.verb === 'work' &&
        o.why === null &&
        o.site === i &&
        o.kind &&
        o.kind !== 'firewood' && // the house offers its cutting as a task of its own (page/ui2wood)
        !(HUD_MOVE[o.kind] && P0move) && // the move's loads are the farmstead task's to fetch
        !seen.has(o.kind) &&
        seen.add(o.kind),
    );
  let title,
    sub,
    acts = '';
  const camp = hudCamp(f),
    P0 = hudPlanned(),
    placed = i !== f.house && P0 && P0.tasks.some((t) => t.kind === 'farmstead' && t.site === i);
  if (i === f.house) {
    title = camp === 'camp' ? `${f.name}: a camp` : camp === 'staked' ? `${f.name}: the shelter staked` : f.name;
    sub = `${st.pawns[id].given}: ${Sim.describe(st, id)}.${hudAils()
      .map(([, words]) => ` ${words}`)
      .join('')}`;
    if (camp === 'camp')
      sub = `Nothing is built: the goods are landed here, and the nights are spent under the open sky. ${
        buildTasked() ? 'The farmstead is in the plan.' : 'The build button places a farmstead.'
      } ${sub}`;
    else if (camp === 'staked')
      sub = `The farmstead is placed: its shelter is staked here, and stands once its timber is carried and it is raised. ${sub}`;
    if (camp === 'camp' && !buildTasked())
      acts += `<button type="button" class="u2-act go" data-tab="build">${actIcon('build')} Build…<small>The build menu</small></button>`;
    const FV = camp ? null : Sim.farmView(st, f.id);
    if (FV) {
      if (FV.rung !== 'camp') title = `${f.name}: ${ladderOf(FV.rung).name.toLowerCase()}`;
      const now = ladderBuilding(FV);
      if (now) sub = `${now} ${sub}`;
      // the upgrade icon's card, opened by the icon on the land or by this button
      acts +=
        `<button type="button" class="u2-chip up" data-hud="uptoggle" aria-pressed="${!!hud.up}">${actIcon('build')} Build up…</button>` +
        (hud.up ? `<div class="u2-ladder">${ladderHTML(f)}</div>` : '');
    }
    acts += hudRoom(hh, f, FV) + houseWood(camp ? null : Sim.fireView(st));
    acts +=
      `<p class="u2-legend">${hudGauges(hh)}</p>` +
      '<div class="u2-row2"><button type="button" class="u2-chip" data-tab="stores">Stores</button>' +
      `<button type="button" class="u2-chip" data-tab="me">${esc(st.pawns[id].given)}</button></div>`;
  } else if (placed) {
    title = 'The farmstead’s place';
    sub = 'The farmstead is to stand here: it is in the plan.';
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

  if (i !== f.house) acts += woodActs(i, f);
  const here = (V.projects || []).find((p) => p.tile === i) || null, // the project under way on this tile, of several (VB-1651)
    making = !!here && here.what === 'field',
    unsown = fi >= 0 && !['sown', 'growing', 'ripe', 'stooks'].includes(f.fields[fi].stage);
  // the chains this tile may take, by what stands on it; the sim says why not when one is pressed and refused
  // a free tile the head's own check takes for a field or a meadow: a task there begins it in its turn, beside any other (VB-1651)
  const none = { field: new Set(), meadow: new Set() },
    free = i !== f.house && fi < 0 && mi < 0 && !here && !placed ? hudSites(hh) : none;
  const offer = (c) => ((free.field.has(i) || free.meadow.has(i)) && HUD_CHAIN[c].fresh) || HUD_CHAIN[c].offer;
  const gap = hudGaps().find((g) => g.tile === i),
    marked = V.tiles.field === i ? 'plant' : V.tiles.meadow === i ? 'hay' : null,
    making2 = !!here && here.what === 'meadow',
    chains = [
      (making || unsown || marked === 'plant' || free.field.has(i)) && 'plant',
      Sim.planGaps && (mi >= 0 || making2 || marked === 'hay' || free.meadow.has(i)) && 'hay',
      Sim.planGaps && fi >= 0 && !unsown && 'harvest',
    ].filter((c) => c && P && !P.tasks.some((t) => t.kind === c && t.site === i));
  if (gap)
    sub = `${sub ? `${sub} ` : ''}Nothing in the plan sees to it, and ${hudDays(gap.days)} ${gap.days === 1 ? 'is' : 'are'} left: ${gap.deadline.what}.`;
  if (chains.length)
    acts =
      chains
        .map(
          (c) =>
            `<button type="button" class="u2-act go" data-hud="chain" data-chain="${c}">${offer(c)}` +
            `<small>One task of the plan: ${HUD_CHAIN[c].done}</small></button>`,
        )
        .join('') + acts.replace('u2-act go', 'u2-act');
  if (here)
    acts += `<button type="button" class="u2-chip" data-hud="drop" data-id="${here.id}">Give this work up</button>`;
  if (!w.water[i] && !w.river[i] && i !== f.house)
    acts += '<button type="button" class="u2-chip" data-hud="walk">Walk here</button>';
  return (
    hudBand(hud.band && hud.band.tile === i ? hud.band : null) +
    (hud.band && hud.band.tile === i && hud.band.mark === 'house' && fireWarn() ? fireAct(fireWarn(), f) : '') +
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
    plan =
      hudAils().length +
      JSON.stringify(hudGaps()) +
      Sim.controlOf(st, st.player.pawn)
        .queue.map((q) => q.target)
        .join() +
      JSON.stringify((hudPlanned() || {}).tasks || 0),
    key = [
      Math.floor(st.t),
      hud.at,
      hud.place,
      hud.msg ? hud.msg.text : '',
      hud.tab,
      plan,
      site,
      JSON.stringify(V.projects || 0),
      V.tiles.field,
      V.tiles.meadow,
    ].join('|');
  if (key === hud.markKey) return;
  hud.markKey = key;
  const marks = [];
  f.fields.forEach((fd, k) => {
    const [icon, n, press, why] = fieldPin(fd);
    if (fd.tile !== hud.at)
      marks.push({ id: `f${k}`, tile: fd.tile, cls: `u2-pin press${press}`, html: hudPin(icon, n), why });
  });
  for (const p of V.projects || [])
    if (p.tile >= 0 && p.tile !== hud.at)
      marks.push({
        id: `site${p.id}`,
        tile: p.tile,
        cls: 'u2-pin work',
        html: hudPin(actIcon(KIND_ICON[p.step] || 'build')),
        why: `Work under way here: ${hudKind(p.step).toLowerCase()}. The mark is its tool.`,
      });
  for (const what of ['field', 'meadow'])
    if (V.tiles[what] >= 0 && V.tiles[what] !== site && V.tiles[what] !== hud.at)
      marks.push({
        id: `next${what}`,
        tile: V.tiles[what],
        cls: 'u2-pin next',
        html: hudPin(goodIcon(what)),
        why: `Marked for the next ${what === 'field' ? 'field' : 'hay meadow'}: nothing is begun here yet.`,
      });
  // the plan's pins: each queued job at its tile, its place in the queue at one shoulder and the days until it is done at the other;
  // a tile shows one pin, the plan's before the field's
  const A = Sim.agenda(st),
    planned = new Map();
  const P = hudPlanned(),
    list =
      P && P.tasks.length
        ? P.tasks.map((t) => ({ ...t, e: hudTaskEntry(A, t) }))
        : A
          ? A.queue.map((e) => ({ ...e, e }))
          : [];
  list.forEach((t, k) => {
    if (t.site < 0 || !t.kind || planned.has(t.site) || t.site === hud.at) return;
    const days = t.e && Number.isFinite(t.e.ends) ? hudDaysTo(t.e.ends) : '',
      v = (t.e && hudVerdict(t.e)) || '';
    planned.set(t.site, {
      why:
        `${hudKind(t.kind)} is number ${k + 1} in the plan (the square).` +
        (days === '' ? '' : ` It is done in about ${hudDays(days)} (the round number).`) +
        (v ? ` It is ${v === 'late' ? 'too late' : v} for what it must be ready for.` : ''),
      id: `q${t.site}`,
      tile: t.site,
      cls: `u2-pin plan press${(t.e && HUD_VERDICT[hudVerdict(t.e)]) || 0}`,
      html: `<s>${k + 1}</s>${hudPin(hudTaskIcon(t), days)}`,
    });
  });
  // a window that presses with nothing in the plan for it: a red pin with the days left, before the field's own
  for (const g of hudGaps())
    if (!planned.has(g.tile) && g.tile !== hud.at)
      planned.set(g.tile, {
        id: `gap${g.tile}`,
        tile: g.tile,
        cls: 'u2-pin press2 gap',
        html: hudPin(HUD_CHAIN[g.chain].icon(), g.days),
        why: `Pressing, and nothing in the plan sees to it: ${hudDays(g.days)} left (the number) until ${g.deadline.what}.`,
      });
  for (let k = marks.length - 1; k >= 0; k--) if (planned.has(marks[k].tile)) marks.splice(k, 1);
  marks.push(...planned.values());
  const F = fireWarn(),
    FV = hudCamp(f) ? null : Sim.farmView(st, f.id);
  if (FV && FV.rung !== 'camp' && f.house !== hud.at)
    marks.push({
      id: 'up',
      tile: f.house,
      cls: 'u2-pin up',
      html: hudPin(actIcon('build')),
      why: `Build up the farmstead: what can follow the ${ladderOf(FV.rung).name.toLowerCase()}, and what it takes.`,
    });
  const mv = hudMoving(hh, f);
  if (mv && mv.tile !== hud.at)
    marks.push({
      id: 'landing',
      tile: mv.tile,
      cls: `u2-pin landing${mv.frost && mv.lying ? ' press1' : ''}`,
      html: hudPin(goodIcon('flour'), mv.frost && mv.lying ? hudDaysTo(mv.frost.t) : ''),
      why:
        `Left at the landing: ${mv.parts.join(', ')}. The farmstead task fetches it all.` +
        (mv.frost && mv.lying
          ? ` What still lies here at the frost is lost: ${hudDays(hudDaysTo(mv.frost.t))} left (the number).`
          : ''),
    });
  if (O && f.house !== hud.at)
    marks.push({
      why: F ? fireWords(F) : '',
      id: 'house',
      tile: f.house,
      cls: 'u2-gauges',
      html:
        [
          ['food', 'grain'],
          ['fuel', 'wood'],
          ['hay', 'hay'],
        ]
          .map(
            ([k, icon]) =>
              `<i class="${O[k].state}">${goodIcon(icon)}<u></u>${k === 'fuel' && F ? '<b>!</b>' : ''}</i>`,
          )
          .join('') +
        hudAils()
          .map(([icon]) => `<i class="warn">${goodIcon(icon)}</i>`)
          .join(''),
    });
  hud.pins = marks.map(({ id: mark, tile, cls, html, why }) => ({ mark, tile, cls, html, why: why || '' }));
  if (hud.at >= 0)
    marks.push({ id: 'call', tile: hud.at, cls: 'u2-call', call: true, html: hudCall(hud.at, id, hh, f) });
  u2Marks(marks);
}
// A tap on the map, in play: the tile's callout opens at it; the same tile again, or water far from land, shuts it.
function hudTap(sx, sy) {
  const { id, f } = hudHouse();
  if (id < 0 || !f) return false;
  // a mark under the finger is its tile's (it stands above the tile, often over another): its callout opens with the mark's words
  const pin = (hud.pins || []).find((p) => {
    const a = u2Anchor.get(p.mark),
      r = a && a.el.getBoundingClientRect();
    return r && sx >= r.left - 6 && sx <= r.right + 6 && sy >= r.top - 6 && sy <= r.bottom + 6;
  });
  const i = pin ? pin.tile : loc(...toWorld(sx, sy), [0, 0]);
  hud.at = (i === hud.at && !pin) || i < 0 ? -1 : i;
  hud.band = pin && hud.at >= 0 ? pin : null;
  hud.up = !!hud.band && hud.band.mark === 'up';
  hud.tapAt = performance.now();
  hud.msg = null;
  hud.markKey = '';
  sel = hud.at;
  hoverDirty = true;
  return true;
}
