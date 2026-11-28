// @sys page/villagecard: the village's card (VB-1190, split from page/cards): its overview (VB-162; Sim.villageSummary), people by age band,
//   who is ready to marry, the warnings with the farms they concern, and showVillage, the card itself

// ---- the village's overview (VB-162; Sim.villageSummary): food, the harvest, hungry households and idle hands as stats, people by age
// band as a graph, and the warnings, each with the farms it concerns. What is counted is exact; what foretells (food, hands) is the
// estimate of a pawn, named (principle "The future is someone's estimate"). ----
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
// Who can marry (VB-1120): the adults of marrying age and of them the unmarried, women to the left and men to the right as the start's age
// pyramid has them, each as the one meter (the unmarried of the adults).
function marryHTML(S) {
  const M = S.marry;
  return (
    section('Marrying age') +
    stats(
      [
        ['f', 'Women', 'people'],
        ['m', 'Men', 'people'],
      ].map(([k, label, icon]) => ({
        icon,
        label: `${label} of marrying age`,
        value: M.single[k],
        note: `unmarried, of ${M.adults[k]}`,
        title: `${label} of marrying age: ${M.adults[k]}, of them ${M.single[k]} unmarried`,
        meter: { value: M.single[k], max: Math.max(1, M.adults.f, M.adults.m) },
      })),
    ) +
    (M.alone.length
      ? `<div class="warning" title="Households of one adult"><span class="stat-ico">${goodIcon('heir')}</span><span>${M.alone.length} ${
          M.alone.length === 1 ? 'household' : 'households'
        } of one adult</span></div>`
      : '')
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
  {
    key: 'match',
    icon: goodIcon('people'),
    word: (S) => {
      const mf = S.marry.by === 'm',
        n = S.marry.reach[mf ? 'm' : 'f'],
        k = S.marry.reach[mf ? 'f' : 'm'],
        noun = (x, man) => (x === 1 ? (man ? 'man' : 'woman') : man ? 'men' : 'women');
      return `${n} unmarried ${noun(n, mf)}, ${k} unmarried ${noun(k, !mf)} within reach`;
    },
    tone: 'warn',
  },
  {
    key: 'kin',
    icon: goodIcon('people'),
    word: () => 'Lives partly on help from kin and neighbours',
    tone: 'warn',
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
    v.well !== null ? 'A shared well and woods' : 'Shared woods',
    v.founded
      ? `Founded in year ${Math.floor(v.founded.t / Sim.YEAR) + 1} from ${mother.name} by ${name(v.founded.by)}`
      : '',
    v.crowded > 0 ? `Crowded: ${v.crowded} adults wait for land, and there is no room to clear` : '',
    daughters.length ? `Daughter villages: ${daughters.map((u) => u.name).join(', ')}` : '',
    out.length ? `Want to move out: ${out.map(name).join(', ')}` : '',
    // the sites under way from it (VB-787): staked, their trail, their cottage, roofed and waiting to move
    ...(st.sites || [])
      .filter((s) => s.from === v.id && s.farm === undefined) // a farm's own cottage is drawn with the farm (VB-1937)
      .map(
        (s) =>
          `Building a new farm: ${s.party.all.map(name).join(', ')}; ${
            {
              trail: 'the trail is being blazed',
              building: 'the site is being cleared and built',
              roofed: 'the cottage stands, the move waits',
            }[s.stage] || s.stage
          }`,
      ),
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
    tilthStat(
      v.farmsteads.flatMap((fid) => st.farmsteads[fid].fields),
      "the mean of its farms' fields",
    ),
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
    // a plot being cleared: how far the work has come, which is exact (what is done is shown as it was: principle "The future is someone's estimate")
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
      (v.alderman !== undefined && v.alderman !== null && st.pawns[v.alderman].alive
        ? section('Alderman') + pawnChip(v.alderman) // VB-314: the village's office, held by a holder chosen at its meeting
        : '') +
      section('Store') +
      `<button type="button" class="card-switch" data-stores-village="${id}">Stores of every household</button>` +
      suppliesHTML(Sim.villageOutlook(st, id, st.player ? st.player.pawn : null), ['food']) +
      peopleHTML(S) +
      marryHTML(S) +
      warningsHTML(S) +
      land,
    links: mother ? villageChip(mother) : '',
    list,
  });
}
