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
// How many live in the house against its room (sim/house roomOf, VB-1664): crowded, every member's mood suffers until a larger house. A
// fact of the house's callout (people, and the count against the room), or null.
function hudRoom(hh, f, FV) {
  const room = VB['sim/house'].roomOf(f),
    n = hh.members.length;
  if (!Number.isFinite(room)) return null;
  const lives = `${n} ${n === 1 ? 'lives' : 'live'} here`,
    next = FV && FV.next.length ? ladderOf(FV.next[0].what).name.toLowerCase() : '';
  return {
    k: 'room',
    icon: goodIcon('people'),
    n: `${n}/${room}`,
    cls: n > room ? 'v2' : '',
    label: n > room ? 'Crowded' : `${lives}, room for ${room}`,
    why:
      n <= room
        ? `${siteCap(lives)}, room for ${room}.`
        : `Crowded: ${lives}, room for ${room}; everyone’s mood suffers.${next ? ` A ${next} mends it: Build up.` : ''}`,
  };
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
    e = t ? hudTaskEntry(Sim.agenda(st, st.player.pawn), t) : null,
    frost = e && e.deadline ? e.deadline : null;
  return { tile, parts, frost, lying: lying.length };
}
// The windows that press with no task of the plan for them (Sim.planGaps, VB-1650).
const hudGaps = () =>
  Sim.planGaps && HUD_CHAIN ? (Sim.planGaps(st, st.player.pawn) || []).filter((g) => HUD_CHAIN[g.goal]) : [];
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
// ---- icons first, the words a tap away (Kim, 27 Nov: "informational text should be used sparingly, and only after at least one click"),
// the plan card's pattern (page/ui2plan planCard) for every surface ----
// A fact: {k, icon (HTML), n (a number or '' beside it), cls, label (its name to a screen reader), why (its sentence), chip (false: a
// sentence behind "i" with no chip of its own)}. slot: the key of hud that holds which fact's words are open, its k, or 'all' under "i"
// (a slot's facts share one list of keys). Every chip has its why: missing information on expansion is a bug.
const factNum = (f) => (f.n === '' || f.n === undefined || f.n === null ? '' : `<b>${esc(f.n)}</b>`);
const factChip = (f, slot) =>
  `<button type="button" class="u2-fact ${f.cls || ''}" data-hud="pinfo" data-slot="${slot}" data-k="${esc(f.k)}" ` +
  `aria-pressed="${hud[slot] === f.k}" aria-label="${esc(f.label || f.why)}" title="${esc(f.label || f.why)}">${f.icon}${factNum(f)}</button>`;
const factChips = (facts, slot) =>
  facts
    .filter((f) => f && f.chip !== false)
    .map((f) => factChip(f, slot))
    .join('');
// The "i" that opens every sentence of a slot (k 'all'), or the sentences of one group of it (k its own).
const factI = (slot, k = 'all', label = 'What it means') =>
  `<button type="button" class="u2-i" data-hud="pinfo" data-slot="${slot}" data-k="${esc(k)}" aria-pressed="${hud[slot] === k}" ` +
  `aria-label="${esc(label)}" title="${esc(label)}">i</button>`;
// The words open in a slot: the tapped chip's sentence, or all of them under "i" (all false: not these), or those of `group`.
function factWords(facts, slot, group, all = true) {
  const cur = hud[slot],
    shown = facts.filter((f) => f && ((all && cur === 'all') || cur === f.k || (group && cur === group)));
  return shown.length
    ? `<ul class="u2-pinfo">${shown
        .map(
          (f) =>
            `<li><span class="u2-fact ${f.cls || ''}">${f.icon}${factNum(f)}</span><span>${esc(f.why)}</span></li>`,
        )
        .join('')}</ul>`
    : '';
}
// A mark's own explanation, in the callout of its tile when the mark was what was tapped (Kim, 24 Nov: a tap on anything standing on a
// tile opens that tile's callout, the mark's icon repeated in a band on top). Its words are behind a tap on the band (Kim, 27 Nov).
const hudBand = (b) =>
  b && b.why
    ? `<button type="button" class="u2-band" data-hud="pinfo" data-slot="cinfo" data-k="band" aria-pressed="${hud.cinfo === 'band'}" ` +
      `aria-label="${esc(b.why)}" title="${esc(b.why)}"><span class="${esc(b.cls)}">${b.html}</span><span class="u2-i" aria-hidden="true">i</span></button>` +
      (hud.cinfo === 'band' || hud.cinfo === 'all' ? `<p class="u2-pinfo u2-bandwhy">${esc(b.why)}</p>` : '')
    : '';
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
// An agenda entry as the chips of a job in a tile's callout (job j): its work, its deadline and its verdict, as the plan's card shows them
// (page/ui2ahead), and the site's words; keys `j<j>…` in the callout's slot.
function hudJobFacts(e, j) {
  if (!e) return [];
  const d = laneDeadline(e),
    v = hudVerdict(e),
    pre = `j${j}`;
  return [
    e.hours ? { ...laneWorkFact(e), k: `${pre}w` } : null,
    d
      ? {
          k: `${pre}d`,
          icon: laneDeadIcon(d),
          n: laneDayN(d.t),
          cls: v === 'late' ? 'v2' : '',
          label: `Deadline: ${d.what}, ${laneDate(d.t)}`,
          why: `Deadline: ${d.what}, ${laneDate(d.t)} (${laneInWords(d.t)}).`,
        }
      : null,
    v ? { ...laneVerdictFact(e), k: `${pre}v` } : null,
    e.why ? { k: `${pre}s`, icon: goodIcon('tile'), n: '', label: 'The site', why: `${siteCap(e.why)}.` } : null,
  ].filter(Boolean);
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
// The callout of tile i: what it is, how it stands, and what the settler can do there. Its first view is a header (the tile's name, "i"
// and close), a row of icon+number chips, and the acts as icons with short labels; the words behind a chip's tap or "i" (hud.cinfo).
const HUD_CALL_SHORT = { plant: 'Plant', hay: 'Make hay', harvest: 'Harvest' };
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
    acts = '';
  const facts = [], // the tile's own chips and sentences, all of them under the header's "i"
    say = (k, icon, why, more = {}) => facts.push({ k, icon, n: '', why, ...more });
  const camp = hudCamp(f),
    P0 = hudPlanned(),
    placed = i !== f.house && P0 && P0.tasks.some((t) => t.kind === 'farmstead' && t.site === i);
  if (i === f.house) {
    title = camp === 'camp' ? `${f.name}: camp` : camp === 'staked' ? `${f.name}: staked` : f.name;
    if (camp === 'camp')
      say(
        'camp',
        goodIcon('flour'),
        `Nothing is built: the goods are landed here, and the nights are spent under the open sky. ${
          buildTasked() ? 'The farmstead is in the plan.' : 'The build button places a farmstead.'
        }`,
        { label: 'A camp: nothing built' },
      );
    else if (camp === 'staked')
      say(
        'camp',
        actIcon('home'),
        'The farmstead is placed: its shelter is staked here, and stands once its timber is carried and it is raised.',
        { label: 'The shelter staked', cls: 'v1' },
      );
    for (const [icon, words] of hudAils()) say(`ail-${icon}`, goodIcon(icon), words, { cls: 'v2', label: words });
    say('who', actIcon('me'), `${st.pawns[id].given}: ${Sim.describe(st, id)}.`, { chip: false });
    if (camp === 'camp' && !buildTasked())
      acts += `<button type="button" class="u2-act go" data-tab="build" aria-label="The build menu">${actIcon('build')} Build</button>`;
    const FV = camp ? null : Sim.farmView(st, f.id, st.player ? st.player.pawn : null);
    if (FV) {
      if (FV.rung !== 'camp') title = `${f.name}: ${ladderOf(FV.rung).name.toLowerCase()}`;
      const now = ladderBuilding(FV);
      if (now) say('building', actIcon('build'), now, { n: laneSpanN(FV.building.hoursLeft), label: now });
      // the upgrade icon's card, opened by the icon on the land or by this button
      acts +=
        `<button type="button" class="u2-chip up" data-hud="uptoggle" aria-pressed="${!!hud.up}">${actIcon('build')} Build up</button>` +
        (hud.up ? `<div class="u2-ladder">${ladderHTML(f)}</div>` : '');
    }
    const room = hudRoom(hh, f, FV);
    if (room) facts.push(room);
    const wood = houseWood(camp ? null : Sim.fireView(st, st.player.pawn));
    if (wood.fact) facts.push(wood.fact);
    acts += wood.act;
    say('gauges', goodIcon('grain'), hudGauges(hh), { chip: false });
    acts +=
      `<div class="u2-row2"><button type="button" class="u2-chip" data-tab="stores">${goodIcon('grain')} Stores</button>` +
      `<button type="button" class="u2-chip" data-tab="me">${actIcon('me')} ${esc(st.pawns[id].given)}</button></div>`;
  } else if (placed) {
    title = 'The farmstead’s place';
    say('placed', actIcon('home'), 'The farmstead is to stand here: it is in the plan.', { label: 'In the plan' });
  } else if (fi >= 0) {
    const [t, sub] = fieldLine(f.fields[fi], fi),
      [icon, n, press, why] = fieldPin(f.fields[fi]);
    title = t;
    say('field', icon, `${sub}. ${why}`, { n, cls: press ? `v${press}` : '', label: sub });
  } else if (mi >= 0) {
    title = `Hay meadow ${mi + 1}`;
    say('meadow', actIcon('hay'), 'Mown in summer for the winter’s hay.', { label: 'Mown in summer' });
  } else {
    title = VB['world/biomes'].BIOMES[w.biome[i]].name;
    if (V.tiles.field === i || V.tiles.meadow === i)
      say(
        'marked',
        `<span class="gap">${goodIcon(V.tiles.field === i ? 'field' : 'meadow')}</span>`,
        V.tiles.field === i ? 'Marked for the next field.' : 'Marked for the next hay meadow.',
      );
    const water = waterLines(i)[0];
    if (water) say('water', goodIcon('water'), `${water}.`, { label: water });
  }
  const A = Sim.agenda(st, st.player.pawn);
  const P = hudPlanned();
  let jobsHTML = '';
  jobs.slice(0, 3).forEach((o, n) => {
    const e = hudEntry(A, o.target),
      inPlan = P && P.tasks.some((t) => t.key === o.target),
      name = Sim.KINDS[o.kind].name,
      icon = actIcon(KIND_ICON[o.kind] || 'hoe'),
      jf = hudJobFacts(e, n);
    let row = '';
    if (P && !inPlan)
      row +=
        `<button type="button" class="u2-act${n ? '' : ' go'}" data-hud="planadd" data-target="${esc(o.target)}" ` +
        `aria-label="${esc(`${name}: add to the plan`)}" title="${esc(`${name}: add to the plan`)}">${actIcon('plus')}${icon} ${esc(name)}</button>`;
    else if (P) {
      row += `<span class="u2-jobname">${icon}<b>${esc(name)}</b></span>`;
      jf.unshift({ k: `j${n}p`, icon: actIcon('queue'), n: '', label: 'In the plan', why: `${name} is in the plan.` });
    }
    if (o.when === 'now' || !P)
      row +=
        `<button type="button" class="${P ? 'u2-chip' : `u2-act${n ? '' : ' go'}`}" data-hud="job" data-target="${esc(o.target)}" data-site="-1" ` +
        `data-name="${esc(P ? `do it now: ${name.toLowerCase()}` : name)}" aria-label="${esc(P ? `Do it now: ${name.toLowerCase()}` : name)}" ` +
        `title="${esc(P ? `Do it now: ${name.toLowerCase()}` : name)}">${P ? `${actIcon('walk')} Now` : `${icon} ${esc(name)}`}</button>`;
    jobsHTML +=
      `<div class="u2-cjob"><div class="u2-jobrow">${row}</div>` +
      (jf.length ? `<div class="u2-facts">${factChips(jf, 'cinfo')}</div>` : '') +
      factWords(jf, 'cinfo', `j${n}`, false) +
      '</div>';
  });
  if (i !== f.house) acts += woodActs(i, f, facts);
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
    ]
      .filter((c) => c && P && !P.tasks.some((t) => t.kind === c && t.site === i))
      // the window's act opened this card (page/ui2hud yearGo): its chain first, the one pressed for
      .sort((a, b) => (hud.goAt && hud.goAt.tile === i ? (b === hud.goAt.chain) - (a === hud.goAt.chain) : 0));
  if (gap)
    say(
      'gap',
      `<span class="gap">${HUD_CHAIN[gap.goal].icon()}</span>`,
      `Nothing in the plan sees to it, and ${laneDays(gap.days)} ${gap.days === 1 ? 'is' : 'are'} left: ${gap.deadline.what}.`,
      { n: String(Math.max(0, gap.days)), cls: 'v2', label: `Nothing planned: ${laneDays(gap.days)} left` },
    );
  for (const c of chains)
    say(
      `chain-${c}`,
      actIcon('plus') + HUD_CHAIN[c].icon(),
      `${offer(c)}: one task of the plan, ${HUD_CHAIN[c].done}.`,
      {
        chip: false,
      },
    );
  const chainHTML = chains.length
    ? '<div class="u2-row2 u2-chains">' +
      chains
        .map(
          (c, k) =>
            `<button type="button" class="u2-act${k ? '' : ' go'}" data-hud="chain" data-chain="${c}" ` +
            `aria-label="${esc(`${offer(c)}: one task of the plan, ${HUD_CHAIN[c].done}`)}" title="${esc(offer(c))}">` +
            `${actIcon('plus')}${HUD_CHAIN[c].icon()} ${esc(HUD_CALL_SHORT[c] || HUD_CHAIN[c].name)}</button>`,
        )
        .join('') +
      '</div>'
    : '';
  if (chains.length) jobsHTML = jobsHTML.replace('u2-act go', 'u2-act');
  acts = chainHTML + jobsHTML + acts;
  let tail = '';
  if (here)
    tail +=
      `<button type="button" class="u2-chip" data-hud="drop" data-id="${here.id}" aria-label="Give this work up" ` +
      `title="Give this work up">${actIcon('no')} Give up</button>`;
  if (!w.water[i] && !w.river[i] && i !== f.house)
    tail += `<button type="button" class="u2-chip" data-hud="walk" aria-label="Walk here" title="Walk here">${actIcon('walk')} Walk</button>`;
  if (tail) acts += `<div class="u2-row2">${tail}</div>`;
  const band = hud.band && hud.band.tile === i ? hud.band : null;
  return (
    hudBand(band) +
    (band && band.mark === 'house' && fireWarn() ? fireAct(fireWarn(), f, facts) : '') +
    `<div class="u2-verdict"><h2>${esc(title)}</h2>${facts.length ? factI('cinfo') : ''}` +
    '<button type="button" class="u2-x" data-hud="shut" aria-label="Close">×</button></div>' +
    (facts.some((x) => x.chip !== false) ? `<div class="u2-facts">${factChips(facts, 'cinfo')}</div>` : '') +
    factWords(facts, 'cinfo') +
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
  const A = Sim.agenda(st, st.player.pawn),
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
        html: hudPin(HUD_CHAIN[g.goal].icon(), g.days),
        why: `Pressing, and nothing in the plan sees to it: ${hudDays(g.days)} left (the number) until ${g.deadline.what}.`,
      });
  for (let k = marks.length - 1; k >= 0; k--) if (planned.has(marks[k].tile)) marks.splice(k, 1);
  marks.push(...planned.values());
  const F = fireWarn(),
    FV = hudCamp(f) ? null : Sim.farmView(st, f.id, st.player ? st.player.pawn : null);
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
  hud.cinfo = null;
  hud.up = !!hud.band && hud.band.mark === 'up';
  hud.tapAt = performance.now();
  hud.msg = null;
  hud.markKey = '';
  sel = hud.at;
  hoverDirty = true;
  return true;
}
