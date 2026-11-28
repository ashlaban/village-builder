// @sys sim/leather: leather, a first version (VB-911): a household's shoes, worn by its walkers day by day, and its team's harness, worn by
// the years while it keeps a team; a hide cut and sewn at home into shoes, or into harness to mend the team's; the hide's need term
// Design: VB-424 (hides from the hunt, wanted for shoes and harness); design.md, Goods, production and animals (Goods of place; Skill and
// tools); AGENTS.md, Deciding without Kim (7, 9, 16): the wear is the sink, as the tools' iron is (sim/ironwork); nothing is barred by it
// yet. A hide comes from the hunt (sim/deer) and from a slaughtered beast of the cattle (sim/byre).
VB['sim/leather'] = (() => {
  const { YEAR_DAYS } = VB['sim/rules'];
  const Rules = VB['sim/registry'];
  const Stores = VB['sim/stores'];
  const { age } = VB['sim/records'];
  const { hasTeam } = VB['sim/herds'];
  // @tunable LEATHER: shoes and harness (VB-911; named estimates with no source but the reckoning here, rows of docs/tuning.md). shodAge:
  // from this age a member walks shod (a small child goes barefoot); shoeDays: the GAME days a walker wears a pair of turnshoes through
  // (a game day stands for a week, YEAR_DAYS 48 a year: 32 is some eight months of wear); pairs:
  // the pairs a hide is cut into (a roe deer's gives two, a cow's many more, most of it to other uses); keep: the pairs a walker's
  // household keeps in hand, its target; shoeHours: the work of cutting and sewing a hide into shoes, one hand in the house;
  // harnessYears: the years a team's harness lasts; harnessMend: the part of a whole harness a hide makes good; harnessHours: that work;
  // seasons: when leather is worked (winter, the slack); low: below this part of the target (shoes) or of a whole harness the work is
  // done in any season; urgency: a side craft's (MATCH.urgency's scale), as the tools' mending.
  const LEATHER = {
    shodAge: 3,
    shoeDays: 32,
    pairs: 4,
    keep: 1,
    shoeHours: 6,
    harnessYears: 5,
    harnessMend: 0.5,
    harnessHours: 8,
    seasons: [3],
    low: 0.25,
    urgency: 0.5,
  };
  // @state household.shoes: the pairs of shoes the household holds, counted by the wear left in them (a pair half worn is half a pair),
  //   undefined until its first day's wear, when its members' own are counted (LEATHER.keep a walker); written only here
  // @state household.harness: the condition of the team's harness, 0 (worn out) to 1 (sound), undefined for sound; worn only while the
  //   household keeps a team (sim/herds hasTeam); written only here
  const walkers = (st, hh) => {
    let n = 0;
    for (const id of hh.members) if (age(st, st.pawns[id]) >= LEATHER.shodAge) n++;
    return n;
  };
  const shoesOf = (hh) => hh.shoes || 0;
  const harnessOf = (hh) => (hh.harness === undefined ? 1 : hh.harness);
  const hidesOf = (hh) => hh.hides || 0;
  const shoeTarget = (st, hh) => walkers(st, hh) * LEATHER.keep;
  // A day's wear: each walker wears 1 / shoeDays of a pair; a team's harness 1 / harnessYears of a year. Once a day for every household
  // that has members (sim/clock), counted in VB.count.leatherWear.
  function wearDay(st) {
    const harnessDay = 1 / (LEATHER.harnessYears * YEAR_DAYS);
    for (const id of st.liveHouseholds) {
      const hh = st.households[id];
      VB.count.leatherWear++;
      if (!hh.members.length) continue;
      const n = walkers(st, hh);
      if (hh.shoes === undefined) hh.shoes = n * LEATHER.keep;
      hh.shoes = Math.max(0, hh.shoes - n / LEATHER.shoeDays);
      if (hasTeam(st, hh)) hh.harness = Math.max(0, harnessOf(hh) - harnessDay);
    }
  }
  // The work wanted: shoes below the target, or the harness worn by more than half a hide's mending while the household keeps a team;
  // `pressing` when below LEATHER.low of it, when the work is done in any season.
  const shoesWanted = (st, hh) => hh.shoes !== undefined && shoesOf(hh) < shoeTarget(st, hh) - 1e-9;
  const shoesPressing = (st, hh) => shoesOf(hh) < LEATHER.low * shoeTarget(st, hh);
  const harnessWanted = (st, hh) => hasTeam(st, hh) && harnessOf(hh) < 1 - LEATHER.harnessMend / 2;
  const harnessPressing = (st, hh) => harnessWanted(st, hh) && harnessOf(hh) < LEATHER.low;
  // A hide cut into shoes: one hide taken, LEATHER.pairs pairs to the household's; nothing without a hide.
  function cobbled(st, hh) {
    if (hidesOf(hh) < 1) return 0;
    Stores.take(st, hh, 'hide', 1, 'leather');
    hh.shoes = shoesOf(hh) + LEATHER.pairs;
    return 1;
  }
  // A hide cut into harness: one hide taken, the harness LEATHER.harnessMend sounder, up to whole; nothing without a hide.
  function harnessed(st, hh) {
    if (hidesOf(hh) < 1) return 0;
    Stores.take(st, hh, 'hide', 1, 'leather');
    hh.harness = Math.min(1, harnessOf(hh) + LEATHER.harnessMend);
    return 1;
  }
  // The hides a household wants for a year of its leather: its walkers' shoes and its team's harness, rounded up.
  function hidesWanted(st, hh) {
    const shoes = (walkers(st, hh) * YEAR_DAYS) / LEATHER.shoeDays / LEATHER.pairs,
      harness = hasTeam(st, hh) ? 1 / (LEATHER.harnessYears * LEATHER.harnessMend) : 0;
    return Math.ceil(shoes + harness - 1e-9);
  }
  // The hide's need term (the rule sim/foodneed declares): what a household lacks of a year's hides is worth the good's customary worth
  // each, so a household short of leather takes a hide at the fair or as a gift (VB-424's term, now read from the wear).
  const worthCtx = { good: null }; // reused: the term allocates nothing
  const lack = (due, held) => (due > held ? due - held : 0);
  Rules.contribute({
    rule: 'need',
    source: 'sim/leather',
    key: 'hide',
    label: 'Hides, for shoes and harness',
    tunables: ['LEATHER.shoeDays', 'LEATHER.pairs', 'LEATHER.harnessYears', 'LEATHER.harnessMend'],
    value: (st, c) => {
      if (c.good.id !== 'hide' || !c.hh) return 0;
      const due = hidesWanted(st, c.hh),
        held = hidesOf(c.hh);
      worthCtx.good = c.good;
      return Rules.value(st, 'worth', worthCtx) * (lack(due, held) - lack(due, Math.max(0, held + c.n)));
    },
  });
  const atHouse = (dx, dy) => (st, a, j) => [st.w.hx[j.site] + dx + a.ox * 0.3, st.w.hy[j.site] + dy + a.oy * 0.3];
  // The job kinds (sim/kinds registers them; their fields are described there). A pawn takes them as any job, by the verb `work`.
  const KINDS = {
    cobble: {
      verb: 'Making shoes',
      go: 'Going home to make shoes',
      name: 'Make shoes',
      at: ['house'],
      needs: ['hide'],
      gives: ['shoes'],
      label: 'Shoes',
      anim: null,
      hours: LEATHER.shoeHours,
      hands: 1,
      type: 'upkeep',
      spot: atHouse(4, 2),
      urgency: () => LEATHER.urgency,
      done: (st, j, hh) => {
        cobbled(st, hh);
      },
      // while the household holds a hide and fewer shoes than its target: in winter, or in any season when they are nearly worn out
      available: (st, hh, f, c, post) => {
        if (hidesOf(hh) < 1 || !shoesWanted(st, hh)) return;
        if (LEATHER.seasons.includes(c.season) || shoesPressing(st, hh)) post(`cobble:h${hh.id}`, f.house, { farm: f });
      },
    },
    harness: {
      verb: 'Mending the harness',
      go: 'Going home to mend the harness',
      name: 'Mend the harness',
      at: ['house'],
      needs: ['hide'],
      gives: ['harness'],
      label: 'Harness',
      anim: null,
      hours: LEATHER.harnessHours,
      hands: 1,
      type: 'upkeep',
      spot: atHouse(-4, 2),
      urgency: () => LEATHER.urgency,
      done: (st, j, hh) => {
        harnessed(st, hh);
      },
      // while the household keeps a team, its harness is worn and it holds a hide: in winter, or in any season when nearly worn out
      available: (st, hh, f, c, post) => {
        if (hidesOf(hh) < 1 || !harnessWanted(st, hh)) return;
        if (LEATHER.seasons.includes(c.season) || harnessPressing(st, hh))
          post(`harness:h${hh.id}`, f.house, { farm: f });
      },
    },
  };
  // worked indoors (VB-1820: the work step says it, sim/methods labour; no field of the kind)
  VB['sim/methods'].labour(KINDS.cobble, { inside: true });
  VB['sim/methods'].labour(KINDS.harness, { inside: true });
  return {
    LEATHER,
    KINDS,
    walkers,
    shoesOf,
    harnessOf,
    shoeTarget,
    wearDay,
    shoesWanted,
    harnessWanted,
    cobbled,
    harnessed,
    hidesWanted,
  };
})();
