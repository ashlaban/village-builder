// @sys page/cards: the selection cards of farms, pawns and tiles, the links between cards, and flying the camera to what is selected (the
//   village's card: page/villagecard)
// ======== selection cards ========
// What is selected is the page's own state: a pawn (selPawn), a tile (sel), and with a tile, the farm whose house stands on it (selFarm);
// or a village (selVillage), whose green, where it has one, is the tile shown.
let selVillage = -1,
  selFarm = -1;
function flyTo(x, y, z1 = Math.max(cam.z, 1.5)) {
  intro = {
    t: 0,
    d: 1.1,
    x0: cam.x,
    y0: cam.y,
    z0: cam.z,
    x1: x,
    y1: y,
    z1,
    T: levelFor(z1, 1),
    rect: viewRect(LV[levelFor(z1, 1)].size * 0.25, { x, y, z: z1 }),
  };
}
const villageSpot = (v) => (v.center >= 0 ? v.center : st.farmsteads[v.farmsteads[0]].house);
function selectFarm(id, fly = true) {
  const f = st.farmsteads[id];
  selectionPinned = true;
  openPanel('tile');
  selPawn = -1;
  sel = f.house;
  hoverDirty = true;
  showTile(sel);
  if (fly) flyTo(w.hx[f.house], w.hy[f.house]);
}
function selectVillage(id, fly = true) {
  const v = st.villages[id],
    at = villageSpot(v);
  selectionPinned = true;
  openPanel('tile');
  selPawn = -1;
  selFarm = -1;
  selVillage = id;
  sel = v.green ? v.center : -1;
  hoverDirty = true;
  showVillage(id);
  if (fly) flyTo(w.hx[at], w.hy[at], Math.max(cam.z, 0.9));
}
// The key F and the card's button: bring what is selected to the middle of the view.
function centreSelection() {
  if (!st || activePanel !== 'tile') return;
  const o = gatheringShown() ? st.occasions.find((x) => x.id === selOcc) : null; // a gathering's card (page/gathering): its spot
  if (o) flyTo(o.x, o.y);
  else if (selPawn >= 0) {
    const a = st.agents[selPawn],
      f = farmOf(st.pawns[selPawn]);
    if (a && (!a.inside || f)) {
      const [x, y] = Sim.placeOf(st, a); // a walker's place from its leg (VB-473)
      flyTo(a.inside ? w.hx[f.house] : x, a.inside ? w.hy[f.house] : y);
    }
  } else if (selVillage >= 0) {
    const at = villageSpot(st.villages[selVillage]);
    flyTo(w.hx[at], w.hy[at], Math.max(cam.z, 0.9));
  } else if (sel >= 0) flyTo(w.hx[sel], w.hy[sel], Math.max(cam.z, 1.2));
}
$('tileFocus').addEventListener('click', centreSelection);
// A name on the map under a point of the world, while it shows.
function labelAt(x, y) {
  for (const l of labels)
    if (
      l.t.visible &&
      l.t.alpha > 0.3 &&
      Math.abs(x - l.x) < l.t.width / 2 &&
      (l.below ? y > l.y && y < l.y + l.t.height : y < l.y && y > l.y - l.t.height) // a village's name may lie under its centre
    )
      return l;
  return null;
}

// ---- links and rows ----
// a pawn's chip may say what it is to the card's subject: its holder (a house), an heir in line (a key) or the one it courts (two
// hearts; VB-036); `of` is the pawn whose card it is on, and the
// chip's portrait then carries what the two are to each other (VB-1026)
const CHIP_AS = { holder: 'Holds the farm', heir: 'Heir, in the order shown', courting: 'Courting' };
const pawnChip = (id, as = '', of = -1) =>
  `<button type="button" class="chip${as ? ' as' : ''}" data-pawn="${id}"${as ? ` title="${CHIP_AS[as]}"` : ''}>${faceImg(id, 'mini', of)}${esc(
    Sim.fullName(st.pawns[id]),
  )}${as ? goodIcon(as) : ''}</button>`;
const HOLDING = { field: 'A field of this farm', meadow: 'A hay meadow of this farm' };
const farmChip = (f, kind = '') =>
  `<button type="button" class="chip" data-farm="${f.id}"${HOLDING[kind] ? ` title="${esc(HOLDING[kind])}"` : ''}>` +
  `${iconImg(farmIcon(f), 'mini')}${esc(f.name)}</button>`;
const villageChip = (v) =>
  `<button type="button" class="chip" data-village="${v.id}">${iconImg(villageIcon(v), 'mini')}${esc(v.name)}</button>`;
const row = (attr, img, name, note, state) =>
  `<button type="button" class="row" ${attr}>${img}<span class="who">${esc(name)}<i>${esc(
    note,
  )}</i></span><span class="state">${state}</span></button>`;
// A person and a farm have one row each, wherever they are listed (a farm's card, a village's, the People sheet).
function memberRow(id) {
  const p = st.pawns[id];
  return row(`data-pawn="${id}"`, faceImg(id, 'mini'), Sim.fullName(p), placeLine(p), esc(Sim.describe(st, id)));
}
// marks: chips put before its state (a village's card puts a chip of VB-667's kind on the farms its warnings concern, VB-162, VB-927). Its
// state is a chip for each supply about to fall short, by its head's last reckoning (VB-667: one stored outlook a farm, read), and its
// people as an icon and a number; a
// title says how the household eats today.
function farmRow(f, marks = '') {
  const hh = f.household === null ? null : st.households[f.household];
  const n = hh ? hh.members.length : 0,
    people = `<span class="ppl" title="${n} people" aria-label="${n} people">${goodIcon('people')}${n}</span>`;
  return row(
    `data-farm="${f.id}"${hh ? ` title="${esc(hungerWord(hh))}"` : ''}`,
    iconImg(farmIcon(f), hh ? 'mini' : 'mini gone'),
    f.name,
    hh
      ? `Held by ${Sim.fullName(st.pawns[hh.holder])}`
      : `Empty for ${emptyYears(f)} years${f.state === 'ruin' ? ', a ruin' : ''}`,
    hh ? `<span class="farm-state">${marks}${supplyChips(Sim.supplyOutlook(st, hh.id))}${people}</span>` : marks,
  );
}
// One listener for every link: a person, a farm or a village.
function follow(e) {
  const b = e.target.closest('button[data-pawn], button[data-farm], button[data-village]');
  if (!b || !st) return;
  if (b.dataset.pawn) focusPawn(+b.dataset.pawn);
  else if (b.dataset.farm) selectFarm(+b.dataset.farm);
  else selectVillage(+b.dataset.village);
}
$('settlers').addEventListener('click', follow);
$('tile').addEventListener('click', follow);

// ---- the household's view (VB-664): a household is told of in one place, its farm's card; the People sheet only finds it ----
// The household whose farm the card shows, or null (a pawn, a village, an empty farm, a tile).
const houseShown = () => {
  if (!st || selPawn >= 0 || selVillage >= 0 || selFarm < 0) return null;
  const f = st.farmsteads[selFarm];
  return f.household === null ? null : st.households[f.household];
};
const loads = (n) => `${n} ${n === 1 ? 'load' : 'loads'}`;
const woodStat = (hh) => ({
  icon: 'wood',
  label: 'Firewood',
  value: loads(Math.round(hh.wood)),
  note: hh.cold > 0 ? 'cold' : '',
  tone: hh.cold > 0 ? 'bad' : '',
  title: hh.cold > 0 ? 'Cold: no firewood' : 'Firewood',
});
// What the card's first tab says of the household at a glance: its supplies, as the Stores tab shows them (VB-667), and what is wrong
// today.
const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
// The head's estimate of the harvest before the frost (principle 14: whose reckoning it is is said), once a crop is ripe.
const harvestStat = (hh) => {
  const e = Sim.harvestEstimate(st, hh);
  if (!e) return null;
  const need = e.days === Infinity ? 'more days than there are' : `about ${e.days} ${e.days === 1 ? 'day' : 'days'}`,
    hands = `${e.hands} ${e.hands === 1 ? 'hand' : 'hands'}`,
    n = NUM[e.fields] || e.fields,
    left = e.left <= 0 ? 'tomorrow' : `in about ${e.left} ${e.left === 1 ? 'day' : 'days'}`;
  return {
    icon: 'field',
    label: 'Harvest',
    value: `${n} ${e.fields === 1 ? 'field' : 'fields'} standing; frost ${left}`,
    tone: e.late ? 'bad' : '',
    title: `The head's reckoning: ${hands} need ${need} to reap them; ${e.late ? 'the frost may take some' : 'it should be in time'}`,
  };
};
// While the household lives partly on help (VB-1114): the share of its year's need received over the last year, as a meter, and from whom.
const kinStat = (hh) => {
  const S = Sim.villageSummary(st, st.farmsteads[hh.farmstead].village),
    k = S.kin[hh.id];
  if (!k || !S.warnings.kin.includes(hh.id)) return null;
  const pct = Math.round(100 * k.share);
  return {
    icon: 'people',
    label: 'Lives on help',
    value: `${pct}%`,
    note: `of the year's food, from ${k.from.map(([g, n]) => `${g} (${Math.round(n)})`).join(', ')}`,
    tone: 'warn',
    title: `Help received over the last year, as a share of the household's need: ${pct}%`,
    meter: { value: pct },
    wide: true,
  };
};
// Whether the household would lay out a feast at an occasion (VB-996; the rule 'feast', Sim.explainFeast): its grain above the seed on the
// one meter, marked at the years of food it keeps first; past the mark it feasts, its holder laying out a share of what is over by its
// generosity (its word beside the share). The rule's parts are the title. What it holds now, counted: no estimate (principle 14).
const feastStat = (hh) => {
  if (hh.holder === null || !st.pawns[hh.holder].alive) return null;
  const x = Sim.explainFeast(st, hh),
    part = (k) => (x.parts.find((q) => q.key === k) || { factor: 0 }).factor,
    { FEAST } = VB['sim/feast'];
  const above = x.base + part('seed'),
    keep = -part('keep'),
    over = Math.round(x.value),
    share = Math.round(100 * FEAST.share * Sim.traitAct(st, hh.holder, 'generosity', 'feast')),
    word = VB['sim/traits'].wordOf(st, hh.holder, 'generosity'),
    who = `${st.pawns[hh.holder].given}${word ? `, ${word},` : ''}`;
  const signed = (n) => `${n < 0 ? '−' : '+'}${Math.abs(Math.round(n))}`,
    parts = [`Grain ${Math.round(x.base)}`, ...x.parts.map((q) => `${q.label} ${signed(q.factor)}`)].join(' · ');
  const words =
    over > 0
      ? `Would lay out a feast: ${over} rations over what it keeps first; ${who} lays out ${share}% of it`
      : `No feast: ${-over} rations short of the ${FEAST.above} years of food it keeps first`;
  return {
    icon: 'ale',
    label: 'Feast',
    value: over > 0 ? `${over} over` : `${-over} short`,
    note: over > 0 ? `${who} lays out ${share}%` : '',
    title: `${words}. ${parts}`,
    meter: {
      value: Math.max(0, above),
      max: Math.max(2 * keep, above, 1),
      text: words,
      marks: [{ at: keep, label: `kept first: ${Math.round(keep)} rations, ${FEAST.above} years of food` }],
    },
    wide: true,
  };
};
// The household's tools (VB-701, sim/ironwork): shown once worn, with what their wear costs the field work and felling
const toolsStat = (hh) => {
  if (hh.tools === undefined) return null;
  const I = VB['sim/ironwork'],
    slow = Math.round((1 - I.rate(st, { kind: 'plow', owner: { type: 'household', id: hh.id } })) * 100);
  return {
    icon: 'ore',
    label: 'Tools',
    value: `${Math.round(hh.tools * 100)}`,
    tone: hh.tools < 0.5 ? 'warn' : '',
    title: `Tools at ${Math.round(hh.tools * 100)} of 100: ploughing, reaping and felling ${slow}% slower; mended in winter with iron`,
    meter: { value: hh.tools * 100 },
  };
};
// The day's water (VB-1551): the fetch in hours of the day's plan, from the farm's source; none where no source is in reach, and why.
const waterStat = (hh) => {
  const W = Sim.waterOf(st, st.farmsteads[hh.farmstead]);
  if (W.none)
    return {
      icon: 'water',
      label: 'Water',
      value: 'none in reach',
      tone: 'bad',
      title: `No fresh water within ${W.search} hours' walk of the house: none is fetched, and nothing is cooked`,
    };
  const h = `${W.hours.toFixed(1)} h a day`,
    from = `fetched at ${W.name}${W.poor ? ', poor water' : ''}: the walk there and back and the drawing, ${h}`;
  return hh.dry > 0
    ? {
        icon: 'water',
        label: 'Water',
        value: 'none',
        note: h,
        tone: 'bad',
        title: `No water: nothing is cooked; ${from}`,
      }
    : { icon: 'water', label: 'Water', value: h, tone: W.poor ? 'warn' : '', title: `Water ${from}` };
};
const houseStats = (hh) =>
  suppliesHTML(Sim.supplyOutlook(st, hh.id)) +
  stats([
    kinStat(hh),
    harvestStat(hh),
    tilthStat(st.farmsteads[hh.farmstead].fields, 'the mean of its fields'),
    feastStat(hh),
    hh.cold > 0 ? { icon: 'cold', label: 'Cold', value: 'no firewood', tone: 'bad', title: 'Cold: no firewood' } : null,
    waterStat(hh),
    hh.hungryDays > 0 ? { icon: 'hunger', label: 'Hungry days', value: hh.hungryDays, tone: 'warn' } : null,
    toolsStat(hh),
  ]);
const section = (title) => `<h3 class="card-sec">${title}</h3>`;
// ---- materials (VB-668): held until a work asks for them, so the question is whether there is enough for what is planned ----
// A material: the good a project's step spends (its key, as sim/stores names it) or a heap the household holds; `kinds` is the list of
// {label, n, tint} the heap holds of one material (the stone heap by its rock, VB-733; the others hold one kind, so it is empty), shown
// under the total only where more than one kind is held.
let allMaterials = false; // the "All materials" switch: the page's own state, kept as the selection changes
const MATERIALS = [
  { key: 'wood', label: 'Timber', icon: 'wood', field: 'wood', title: 'Timber, in loads (the woodpile)' },
  { key: 'stone', label: 'Stone', icon: 'stone', field: 'stone', title: 'Stone, in loads' },
  { key: 'clay', label: 'Clay', icon: 'clay', field: 'clay', title: 'Clay, in loads' },
  { key: 'bogOre', label: 'Bog ore', icon: 'ore', field: 'bogOre', title: 'Bog iron ore, in loads' },
  { key: 'tar', label: 'Tar', icon: 'tar', field: 'tar', title: 'Tar, in barrels' },
  {
    key: 'salt',
    label: 'Salt',
    icon: 'salt',
    field: 'salt',
    title: 'Salt, in measures (a measure salts 10 rations of meat)',
  },
  {
    key: 'iron',
    label: 'Iron',
    icon: 'ore',
    field: 'iron',
    title: 'Iron, in blooms (a tenth of a bloom mends the tools a tenth)',
  },
  { key: 'wool', label: 'Wool', icon: 'wool', field: 'wool', title: 'Wool, in fleeces, unspun' },
];
// A good's kinds as the page shows them wherever they appear (VB-733, principle 15): the good's icon, and the kind as its label and tint (a
// rock's tint as the Ground overlay draws its bedrock, page/ground). A store by kind ({[kind]: n}) gives its kinds held, in the registry's order.
const kindTint = (good, kind) => {
  const G = VB['world/geology'];
  return good === 'stone' ? hex6(ROCK_COLOUR[G.ROCK[kind.toUpperCase()]] || 0x888888) : null;
};
const kindsHeld = (good, store) =>
  store && typeof store === 'object'
    ? VB['sim/goods']
        .kindsOf(good)
        .filter((k) => store[k] >= 0.5)
        .map((k) => ({ label: k[0].toUpperCase() + k.slice(1), n: Math.round(store[k]), tint: kindTint(good, k) }))
    : [];
// What a household holds of a material: a single store's number, or the sum of a store by kind.
const heldIn = (hh, m) =>
  typeof hh[m.field] === 'object' && hh[m.field] ? VB['sim/stores'].heldOf(hh, m.key) : hh[m.field] || 0;
const materialsOf = (hh) =>
  MATERIALS.map((m) => ({ ...m, n: Math.round(heldIn(hh, m)), kinds: kindsHeld(m.key, hh[m.field]) }));
const WORK_WORD = { field: 'New field', meadow: 'New hay meadow', boat: 'A boat', plot: 'A plot for an heir' };
// The works that ask for materials: the household's project plans, each with what it asks (what its plan holds back for its steps, `build`).
function worksOf(hh) {
  const works = [];
  for (const plan of VB['sim/projects'].projectsOf(st, 'household', hh.id)) {
    const asks = [];
    for (const key in plan.reasons)
      if (plan.reasons[key] === 'build' && plan.reserved[key] > 0) {
        const m = MATERIALS.find((x) => x.key === key);
        if (m) asks.push({ key, have: Math.round(heldIn(hh, m)), want: Math.ceil(plan.reserved[key] - 1e-9) });
      }
    if (asks.length) {
      const step = plan.steps[plan.open];
      works.push({
        icon: plan.what === 'boat' ? 'boat' : plan.what === 'meadow' ? 'meadow' : 'field',
        name: WORK_WORD[plan.what] || `New ${plan.what}`,
        step: step ? Sim.KINDS[step.kind].name : '',
        asks,
      });
    }
  }
  return works;
}
// The section's layout, from lists: mats [{key, label, icon, n, kinds, title}], works [{icon, name, step, asks: [{key, have, want}]}], all.
function materialsHTML(mats, works, all) {
  const asked = new Set(works.flatMap((w) => w.asks.map((a) => a.key)));
  const by = (k) => mats.find((m) => m.key === k);
  const frames = works
    .map(
      (w) =>
        `<div class="work"><div class="work-head">${goodIcon(w.icon)}<b>${esc(w.name)}</b>${w.step ? `<small>${esc(w.step)} is next</small>` : ''}</div>` +
        stats(
          w.asks.map((a) => ({
            icon: by(a.key).icon,
            label: by(a.key).label,
            value: `${a.have} of ${a.want}`,
            tone: a.have < a.want ? 'warn' : 'good',
            meter: { value: a.have, max: a.want * 1.25, marks: [{ at: a.want, label: `asked: ${a.want}` }] },
          })),
        ) +
        '</div>',
    )
    .join('');
  const shown = mats.filter((m) => all || m.n >= 1 || asked.has(m.key));
  const tiles = shown.map((m) => {
    const list = m.kinds && m.kinds.length > 1 ? m.kinds : [];
    return (
      stat({ icon: m.icon, label: m.label, value: m.n, title: m.title }) +
      (list.length
        ? `<div class="stat wide kinds">${list
            .map(
              (k) => `<span><i style="background:${esc(k.tint || 'var(--muted)')}"></i>${esc(k.label)} ${k.n}</span>`,
            )
            .join('')}</div>`
        : '')
    );
  });
  return (
    frames +
    `<div class="stat-grid">${tiles.join('')}</div>` +
    `<button type="button" class="card-switch" data-all-materials aria-pressed="${all}">All materials</button>`
  );
}
$('tileHouse').addEventListener('click', (e) => {
  if (!e.target.closest('[data-all-materials]')) return;
  allMaterials = !allMaterials;
  syncTabs();
});
function storesTab(hh) {
  const f = st.farmsteads[hh.farmstead],
    C = VB['sim/carts'],
    seed = Math.round(Sim.seedReserve(st, hh)),
    quern = hh.quern ? Sim.quernYears(st, hh) : 0,
    n = (x) => Math.round(x || 0);
  const supplies = [
    {
      icon: 'grain',
      label: 'Grain',
      value: n(Sim.grainOf(hh)),
      note: seed ? `${seed} seed` : '',
      title: 'Grain, in rations; the seed set aside is part of it',
    },
    { icon: 'flour', label: 'Flour', value: n(hh.flour), title: 'Flour, in rations, ground' },
    { icon: 'meals', label: 'Meals', value: n(hh.meals), title: 'Meals, in rations, cooked' },
    {
      icon: 'sheaves',
      label: 'Sheaves',
      value: n(hh.unthreshed.reduce((sum, x) => sum + x, 0)),
      title: 'Unthreshed, in sheaves',
    },
    {
      icon: 'fish',
      label: 'Dried fish',
      value: n(Sim.larderOf(hh, 'dried fish')),
      note: hh.rack >= 0.5 ? `${n(hh.rack)} fresh` : '',
      title: 'Dried fish, in rations; fresh by the rack',
    },
    woodStat(hh),
    hh.dry > 0 ? { icon: 'water', label: 'Water', value: 'none', tone: 'bad' } : null,
    { icon: 'peat', label: 'Peat', value: n(hh.peat), title: 'Peat, in units' },
  ];
  const gear = [
    {
      icon: 'quern',
      label: 'Hand quern',
      wide: true,
      value: !hh.quern ? 'none' : quern > 0 ? `${Math.ceil(quern)} years left` : 'worn out',
      note: hh.quern ? `of ${hh.quern.kind}` : '',
      tone: hh.quern && quern > 0 ? '' : 'warn',
      title: hh.quern && quern > 0 ? 'A hand quern' : 'No quern that grinds: grain is cooked unground',
    },
    hh.boat
      ? {
          icon: 'boat',
          label: 'Fishing boat',
          wide: true,
          value: `tarred ${Math.floor(Sim.boatUntarred(st, hh.boat))} years ago`,
          note: Sim.boatUntarred(st, hh.boat) >= 2 ? 'it leaks' : '',
          tone: Sim.boatUntarred(st, hh.boat) >= 2 ? 'warn' : '',
        }
      : null,
    ...(hh.carts && hh.carts.length
      ? hh.carts.map((c) => ({
          icon: 'cart',
          label: c.kind === 'ox' ? 'Ox cart' : 'Hand cart',
          value: `${Math.round(c.cond * 100)}`,
          note: C.out(st, c) ? 'on the road' : '',
          tone: c.cond < C.CART.mendAt ? 'warn' : '',
          title: c.cond < C.CART.mendAt ? 'Worn: it wants mending' : 'How sound the cart is',
          meter: { value: c.cond * 100, marks: [{ at: C.CART.mendAt * 100, label: 'below this it wants mending' }] },
        }))
      : [{ icon: 'cart', label: 'Cart', wide: true, value: 'none' }]),
  ];
  const low = Math.round(Math.min(100, ...hh.members.map((id) => st.pawns[id].health)));
  return (
    section('Supplies') +
    suppliesHTML(Sim.supplyOutlook(st, hh.id)) +
    stats(supplies) +
    section('Materials') +
    materialsHTML(materialsOf(hh), worksOf(hh), allMaterials) +
    section('Gear') +
    stats(gear) +
    section('Health') +
    stats([
      { icon: 'hunger', label: 'Hungry days', value: hh.hungryDays, tone: hh.hungryDays > 0 ? 'warn' : '' },
      { icon: 'health', label: 'Lowest health', value: low, tone: low < 50 ? 'bad' : '', meter: { value: low } },
    ])
  );
}
// The work a household or a village has posted, a stat a kind: its icon, how many, and how many are under way (a farm's Land tab, a
// village's card: one presentation, VB-162).
function workStats(type, id) {
  const n = {};
  for (const job of st.jobs.values()) {
    if (job.owner.type !== type || job.owner.id !== id) continue;
    const k = job.kind;
    n[k] = n[k] || { open: 0, taken: 0 };
    n[k][job.claims.length ? 'taken' : 'open']++;
  }
  return Object.entries(n).map(([k, v]) => ({
    img: actIcon(KIND_ICON[k] || 'hoe'),
    label: Sim.KINDS[k].name,
    value: v.open + v.taken > 1 ? `×${v.open + v.taken}` : '',
    note: v.taken ? (v.open ? `${v.taken} under way` : 'under way') : 'open',
    wide: true,
  }));
}
function landTab(hh) {
  const f = st.farmsteads[hh.farmstead],
    jobs = workStats('household', hh.id);
  return (
    stats([
      ...fieldCounts(f).map(([word, k]) => ({ icon: 'field', label: `Fields ${word}`, value: k })),
      f.fields.length ? null : { icon: 'field', label: 'Fields', value: 'none' },
      { icon: 'meadow', label: 'Hay meadows', value: f.meadows.length },
      ...VB['sim/projects'].projectsOf(st, 'household', hh.id).map((pj) => ({
        img: actIcon('spade'),
        label: `New ${pj.what === 'meadow' ? 'hay meadow' : pj.what}`,
        value: pj.steps[pj.open].kind,
        wide: true,
        title: "One of the household's projects, and its step under way",
      })),
    ]) +
    section('Work') +
    (jobs.length ? stats(jobs) : '<p class="card-note">No work open.</p>')
  );
}
function animalsTab(hh) {
  const beasts = [];
  for (const herd of Sim.herdsOf(st, hh)) {
    if (herd.species === 'cattle') {
      for (const [k, one, many] of [
        ['cow', 'Cow', 'Cows'],
        ['bull', 'Bull', 'Bulls'],
        ['ox', 'Ox', 'Oxen'],
        ['heifer', 'Heifer', 'Heifers'],
        ['steer', 'Steer', 'Steers'],
        ['calf', 'Calf', 'Calves'],
      ]) {
        const of = herd.head.filter((h) => h.kind === k);
        if (of.length)
          beasts.push({
            icon: 'beast',
            label: of.length === 1 ? one : many,
            value: of.length,
            title:
              of
                .map((h) => h.name)
                .filter(Boolean)
                .join(', ') || many,
          });
      }
    } else
      for (const [k, label] of [
        ['ewes', 'Ewes'],
        ['rams', 'Rams'],
        ['lambs', 'Lambs'],
      ])
        if (herd[k]) beasts.push({ icon: 'wool', label, value: herd[k] });
  }
  const larder = [
    ['salt meat', 'Salt meat', 'meat'],
    ['smoked meat', 'Smoked meat', 'meat'],
    ['meat', 'Fresh meat', 'meat'],
    ['butter', 'Butter', 'butter'],
    ['milk', 'Milk', 'milk'],
    ['dried fish', 'Dried fish', 'fish'],
  ]
    .map(([kind, label, icon]) => ({
      icon,
      label,
      value: Math.round(Sim.larderOf(hh, kind)),
      title: `${label}, in rations`,
    }))
    .filter((x) => x.value >= 1);
  const spoilt = Math.round(hh.haySpoilt || 0);
  return (
    (beasts.length ? stats(beasts) : '<p class="card-note">No animals.</p>') +
    suppliesHTML(Sim.supplyOutlook(st, hh.id), ['hay']) +
    stats([spoilt ? { icon: 'hay', label: 'Hay spoilt', value: spoilt, tone: 'warn' } : null]) +
    section('Larder') +
    (larder.length ? stats(larder) : '<p class="card-note">The larder is empty.</p>')
  );
}
let houseHTML = '';
function renderHouse(tab, hh) {
  const h =
    tab === 'land' ? landTab(hh) : tab === 'animals' ? animalsTab(hh) : tab === 'plan' ? planTab(hh) : storesTab(hh);
  if (h !== houseHTML) {
    houseHTML = h;
    $('tileHouse').innerHTML = h;
  }
}

// ---- what a tile of a farm adds to its card: the farm's icon, kind and people on its house; a way back to the farm from its fields ----
function tileExtras(of) {
  const f = st.farmsteads[of.farm],
    v = st.villages[f.village];
  if (!of.house) return { links: farmChip(f, of.kind) + villageChip(v), stats: of.stats, list: of.list };
  const hh = f.household === null ? null : st.households[f.household];
  const list = hh ? `<h3>Lives here</h3>${hh.members.map(memberRow).join('')}` : '';
  const heirs = hh ? Sim.heirRanking(st, hh).slice(0, 3) : [];
  return {
    badge: iconImg(farmIcon(f), hh ? 'badge' : 'badge gone'),
    kind: `${hh ? 'Farm' : f.state === 'ruin' ? 'Ruined farm' : 'Empty farm'} in ${v.name}`,
    stats: hh
      ? houseStats(hh)
      : stats([
          {
            icon: 'holder',
            label: 'Buildings',
            value: f.state === 'ruin' ? 'a ruin' : `${Math.round(f.condition * 100)}`,
            tone: f.state === 'ruin' ? 'bad' : '',
            meter: { value: f.condition * 100 },
          },
        ]),
    links: (hh ? pawnChip(hh.holder, 'holder') + heirs.map((q) => pawnChip(q, 'heir')).join('') : '') + villageChip(v),
    list,
  };
}
// On a wide screen a pinned card opens with its details; on a phone it opens as its summary, to leave the map in view.
if (!mobileUI.matches) {
  $('tile').classList.remove('collapsed');
  const b = document.querySelector('#tile .sheet-expand');
  b.setAttribute('aria-expanded', 'true');
  nameFold(b);
}
