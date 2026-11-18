// @sys page/cards: the selection cards of farms and villages, the links between cards, and flying the camera to what is selected
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
// a pawn's chip may say what it is to the card's subject: its holder (a house) or an heir in line (a key); `of` is the pawn whose card it is on, and the
// chip's portrait then carries what the two are to each other (VB-1026)
const CHIP_AS = { holder: 'Holds the farm', heir: 'Heir, in the order shown' };
const pawnChip = (id, as = '', of = -1) =>
  `<button type="button" class="chip${as ? ' as' : ''}" data-pawn="${id}"${as ? ` title="${CHIP_AS[as]}"` : ''}>${faceImg(id, 'mini', of)}${esc(
    Sim.fullName(st.pawns[id]),
  )}${as ? goodIcon(as) : ''}</button>`;
const farmChip = (f) =>
  `<button type="button" class="chip" data-farm="${f.id}">${iconImg(farmIcon(f), 'mini')}${esc(f.name)}</button>`;
const villageChip = (v) =>
  `<button type="button" class="chip" data-village="${v.id}">${iconImg(villageIcon(v), 'mini')}${esc(v.name)}</button>`;
const row = (attr, img, name, note, state) =>
  `<button type="button" class="row" ${attr}>${img}<span class="who">${esc(name)}<i>${esc(
    note,
  )}</i></span><span class="state">${state}</span></button>`;
// A person and a farm have one row each, wherever they are listed (a farm's card, a village's, the People sheet).
function memberRow(id) {
  const p = st.pawns[id];
  return row(
    `data-pawn="${id}"`,
    faceImg(id, 'mini'),
    Sim.fullName(p),
    `${p.age}, ${roleLine(p)}`,
    esc(Sim.describe(st, id)),
  );
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
const houseStats = (hh) =>
  suppliesHTML(Sim.supplyOutlook(st, hh.id)) +
  stats([
    hh.cold > 0 ? { icon: 'cold', label: 'Cold', value: 'no firewood', tone: 'bad', title: 'Cold: no firewood' } : null,
    hh.dry > 0
      ? { icon: 'water', label: 'Water', value: 'none', tone: 'bad', title: 'No water: nothing is cooked' }
      : null,
    hh.hungryDays > 0 ? { icon: 'hunger', label: 'Hungry days', value: hh.hungryDays, tone: 'warn' } : null,
  ]);
const section = (title) => `<h3 class="card-sec">${title}</h3>`;
// ---- materials (VB-668): held until a work asks for them, so the question is whether there is enough for what is planned ----
// A material: the good a project's step spends (its key, as sim/stores names it) or a heap the household holds; `kinds` is the list of
// {label, n, tint} the heap holds of one material (today's state holds one kind of each, so it is empty), shown under the total only
// where more than one kind is held.
let allMaterials = false; // the "All materials" switch: the page's own state, kept as the selection changes
const MATERIALS = [
  { key: 'wood', label: 'Timber', icon: 'wood', field: 'wood', title: 'Timber, in loads (the woodpile)' },
  { key: 'stone', label: 'Stone', icon: 'stone', field: 'stone', title: 'Stone, in loads' },
  { key: 'clay', label: 'Clay', icon: 'clay', field: 'clay', title: 'Clay, in loads' },
  { key: 'bogOre', label: 'Bog ore', icon: 'ore', field: 'bogOre', title: 'Bog iron ore, in loads' },
  { key: 'tar', label: 'Tar', icon: 'tar', field: 'tar', title: 'Tar, in barrels' },
  { key: 'wool', label: 'Wool', icon: 'wool', field: 'wool', title: 'Wool, in fleeces, unspun' },
];
const materialsOf = (hh) => MATERIALS.map((m) => ({ ...m, n: Math.round(hh[m.field] || 0), kinds: [] }));
const WORK_WORD = { field: 'New field', meadow: 'New hay meadow', boat: 'A boat', plot: 'A plot for an heir' };
// The works that ask for materials: the household's project plans, each with what it asks (what its plan holds back for its steps, `build`).
function worksOf(hh) {
  const works = [];
  for (const plan of VB['sim/projects'].projectsOf(st, 'household', hh.id)) {
    const asks = [];
    for (const key in plan.reasons)
      if (plan.reasons[key] === 'build' && plan.reserved[key] > 0) {
        const m = MATERIALS.find((x) => x.key === key);
        if (m) asks.push({ key, have: Math.round(hh[m.field] || 0), want: Math.ceil(plan.reserved[key] - 1e-9) });
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
      note: hh.quern ? `of ${hh.quern.rock}` : '',
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
    pj = VB['sim/plans'].projectOf(st, 'household', hh.id),
    jobs = workStats('household', hh.id);
  return (
    stats([
      ...fieldCounts(f).map(([word, k]) => ({ icon: 'field', label: `Fields ${word}`, value: k })),
      f.fields.length ? null : { icon: 'field', label: 'Fields', value: 'none' },
      { icon: 'meadow', label: 'Hay meadows', value: f.meadows.length },
      pj
        ? {
            img: actIcon('spade'),
            label: `New ${pj.what === 'meadow' ? 'hay meadow' : pj.what}`,
            value: pj.steps[pj.open].kind,
            wide: true,
            title: "The household's project, and its step under way",
          }
        : null,
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
  if (!of.house) return { links: farmChip(f) + villageChip(v), stats: of.stats };
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
// ---- the village's overview (VB-162; Sim.villageSummary): food, the harvest, hungry households and idle hands as stats, people by age
// band as a graph, and the warnings, each with the farms it concerns. What is counted is exact; what foretells (food, hands) is the
// estimate of a pawn, named (principle 14). ----
function overviewStats(S) {
  const days = Math.floor(S.food.days),
    pct = Math.round(100 * S.harvest.share),
    idle = Math.round(100 * S.idle.share),
    hungry = S.hungry.households.length;
  return [
    {
      icon: 'hunger',
      label: 'Food',
      value: `${days} ${days === 1 ? 'day' : 'days'}`,
      note: S.food.store >= 1 ? `${Math.round(S.food.store)} in the village store` : '',
      title: "Food in store, the households' and the village store's, in days of the village's need",
      tone: S.food.short ? 'bad' : '',
      meter: {
        value: days,
        max: Sim.YEAR_DAYS,
        marks: S.viewer ? [{ at: S.viewer.toHarvest, label: `the harvest begins in ${S.viewer.toHarvest} days` }] : [],
      },
    },
    S.harvest.year < 1
      ? { icon: 'sheaves', label: 'Harvest', value: 'none yet', wide: true }
      : {
          icon: 'sheaves',
          label: 'Harvest',
          value: `${pct}%`,
          note: `of a year's need, year ${S.harvest.year}`,
          title: `The harvest of year ${S.harvest.year}, against a year of the village's need now`,
          tone: pct < 100 ? 'warn' : '',
          meter: { value: pct, max: 200, marks: [{ at: 100, label: "a year's need" }] },
        },
    {
      icon: 'hunger',
      label: 'Hungry',
      value: `${hungry} of ${S.households}`,
      note: `households, last ${S.hungry.window} days`,
      title: `Households in which someone ate short on any of the last ${S.hungry.window} days`,
      tone: hungry ? 'warn' : '',
      meter: { value: hungry, max: Math.max(1, S.households) },
    },
    {
      img: actIcon('idle'),
      label: 'Idle hands',
      value: `${idle}%`,
      note: `last ${S.hungry.window} days`,
      title: `The share of the working hands' hours (14 to 59) not at work on a task, over the last ${S.hungry.window} days`,
      meter: { value: idle },
    },
  ];
}
// People by age band, now, on one meter each against the village's people, and the change since a year ago.
const BANDS = [
  ['child', '0–14'],
  ['people', '15–49'],
  ['holder', '50+'],
];
function peopleHTML(S) {
  return (
    section('People') +
    stats(
      BANDS.map(([icon, label], i) => {
        const n = S.bands.now[i],
          d = n - S.bands.ago[i];
        return {
          icon,
          label,
          value: n,
          note: d ? `${d > 0 ? '+' : '−'}${Math.abs(d)} in a year` : 'as a year ago',
          title: `People aged ${label}: ${n} now, ${S.bands.ago[i]} a year ago`,
          meter: { value: n, max: Math.max(1, S.people, ...S.bands.ago) },
        };
      }),
    )
  );
}
// The warnings: an icon and words each, and the farms it concerns as chips (a chip selects the farm, whose card is its household's).
const WARNINGS = [
  {
    key: 'food',
    icon: goodIcon('hunger'),
    word: (S) => `Food short of the ${S.viewer.days} days ahead`,
    tone: 'bad',
    foretells: true,
  },
  {
    key: 'hunger',
    icon: goodIcon('hunger'),
    word: (S) => `Hungry ${Sim.OVERVIEW.hungry} or more of the last ${S.hungry.window} days`,
    tone: 'bad',
  },
  { key: 'heir', icon: goodIcon('heir'), word: () => 'Holder over 60, no heir at home', tone: 'warn' },
  {
    key: 'hands',
    icon: goodIcon('field'),
    word: () => 'More fields than hands to work them',
    tone: 'warn',
    foretells: true,
  },
];
function warningsHTML(S) {
  const on = WARNINGS.filter((x) => S.warnings[x.key].length);
  if (!on.length) return '';
  const whose = S.viewer
    ? `<p class="card-note">${esc(
        `Food and hands by ${Sim.fullName(st.pawns[S.viewer.pawn])}'s reckoning, ${S.viewer.days} ${
          S.viewer.days === 1 ? 'day' : 'days'
        } ahead`,
      )}</p>`
    : '';
  return (
    section('Warnings') +
    (on.some((x) => x.foretells) ? whose : '') +
    on
      .map(
        (x) =>
          `<div class="warning" title="${esc(x.word(S))}"><span class="stat-ico">${x.icon}</span><span>${esc(
            x.word(S),
          )}</span><div class="links">${S.warnings[x.key]
            .map((h) => farmChip(st.farmsteads[st.households[h].farmstead]))
            .join('')}</div></div>`,
      )
      .join('')
  );
}
function showVillage(id) {
  const v = st.villages[id],
    farms = v.farmsteads.map((k) => st.farmsteads[k]),
    lived = farms.filter((f) => f.household !== null);
  const people = lived.reduce((n, f) => n + st.households[f.household].members.length, 0),
    empty = farms.length - lived.length;
  const worst = v.fence.length ? Math.min(...v.fence.map((fence) => fence.cond)) : 1;
  const mother = v.founded ? st.villages[v.founded.from] : null;
  // what the People sheet's fold of the commons told (VB-664: a village is told of on its card): who waits to move out, the plots
  // cleared for them, its daughters, and the village's own work
  const X = VB['sim/expansion'],
    name = (id) => Sim.fullName(st.pawns[id]),
    out = st.demand.filter((q) => st.pawns[q].alive && Sim.settlementIdOf(st, st.pawns[q]) === v.id),
    daughters = st.villages.filter((u) => u.founded && u.founded.from === v.id),
    plots = [...v.plots, ...X.livePlots(st, v)].sort((a, b) => (a.plot ?? a.id) - (b.plot ?? b.id));
  const S = Sim.villageSummary(st, id, st.player ? st.player.pawn : null); // the overview (VB-162): the played pawn's estimate
  const lines = [
    `${people} people in ${lived.length} ${lived.length === 1 ? 'household' : 'households'}${empty ? `, ${empty} empty` : ''}`,
    v.well ? 'A shared well and woods' : 'Shared woods',
    v.founded
      ? `Founded in year ${Math.floor(v.founded.t / Sim.YEAR) + 1} from ${mother.name} by ${name(v.founded.by)}`
      : '',
    v.crowded > 0 ? `Crowded: ${v.crowded} adults wait for land, and there is no room to clear` : '',
    daughters.length ? `Daughter villages: ${daughters.map((u) => u.name).join(', ')}` : '',
    out.length ? `Want to move out: ${out.map(name).join(', ')}` : '',
    ...plots.map((plot) =>
      !plot.steps
        ? `Plot cleared, for ${name(plot.holder)}; the cottage is built`
        : plot.open < 1
          ? ''
          : `Plot cleared${plot.to !== null ? `, for ${name(plot.to)}` : ''}; ${
              X.cottageAt(plot) < 3
                ? `the cottage: ${['foundation', 'walls', 'roof'][X.cottageAt(plot)]} is next`
                : 'the cottage stands empty'
            }`,
    ),
  ].filter(Boolean);
  const villageStats = stats([
    ...overviewStats(S),
    v.fence.length
      ? {
          icon: 'fence',
          label: 'Fence',
          value: Math.round(worst * 100),
          tone: worst < 0.45 ? 'bad' : worst < 0.65 ? 'warn' : '',
          title: `The fence at its worst stretch: in ${worst < 0.45 ? 'poor' : worst < 0.65 ? 'fair' : 'good'} repair`,
          meter: { value: worst * 100 },
        }
      : { icon: 'fence', label: 'Fence', value: 'none yet', wide: true },
    // a plot being cleared: how far the work has come, which is exact (what is done is shown as it was: principle 14)
    ...plots
      .filter((plot) => plot.steps && plot.open < 1)
      .map((plot) => {
        const x = Math.round(Sim.plotProgress(st, plot) * 100);
        return {
          img: actIcon('spade'),
          label: 'Clearing',
          value: x,
          note: `for ${name(plot.intended)}`,
          title: `Clearing a plot for ${name(plot.intended)}: how much is done`,
          meter: { value: x },
        };
      }),
  ]);
  // its common fields (VB-100) and its work as a farm's Land tab shows a farm's (one presentation, VB-162)
  const common = v.commonFields || [],
    work = workStats('village', v.id),
    commons = common.length || VB['sim/commons'].underWay(st, v);
  const land =
    (commons ? section('Common fields') : '') +
    (commons
      ? stats([
          ...fieldCounts({ fields: common }).map(([word, k]) => ({ icon: 'field', label: `Fields ${word}`, value: k })),
          VB['sim/commons'].underWay(st, v)
            ? { img: actIcon('spade'), label: 'Clearing a common field', value: '', wide: true }
            : null,
        ])
      : '') +
    (work.length ? section('Village work') + stats(work) : '');
  const marks = (f) =>
    f.household === null
      ? ''
      : WARNINGS.filter((x) => S.warnings[x.key].includes(f.household))
          .map(
            (x) =>
              `<span class="supply-chip ${x.tone}" data-warning="${x.key}" title="${esc(x.word(S))}" aria-label="${esc(x.word(S))}">${x.icon}</span>`,
          )
          .join('');
  const list = `<h3>Farms</h3>${farms.map((f) => farmRow(f, marks(f))).join('')}`;
  card(v.name, lines, '', {
    badge: iconImg(villageIcon(v)),
    kind: v.green || farms.length >= 2 ? 'Village' : 'Lone farm',
    stats:
      villageStats +
      section('Store') +
      suppliesHTML(Sim.villageOutlook(st, id, st.player ? st.player.pawn : null), ['food']) +
      peopleHTML(S) +
      warningsHTML(S) +
      land,
    links: mother ? villageChip(mother) : '',
    list,
  });
}

// On a wide screen a pinned card opens with its details; on a phone it opens as its summary, to leave the map in view.
if (!mobileUI.matches) {
  $('tile').classList.remove('collapsed');
  const b = document.querySelector('#tile .sheet-expand');
  b.setAttribute('aria-expanded', 'true');
  nameFold(b);
}
