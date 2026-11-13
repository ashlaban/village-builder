// @sys sim/tar: tar (VB-301), the second good of place: a village's pine (its reach test), the tar pit one household builds and owns,
// burning tar in the slack of early summer, and a barrel spent on the house (f.tarredUntil) or on the fishing boat; tar's need term
// Design: design.md, Goods of place and side crafts (Goods of place, First goods, A well-kept house, The fishing boat; What each good is
// for: Agreed, 10 Nov). Tar is burnt from resinous pine wood in a funnel-shaped pit (tjärdal) dug on a slope of the pine forest, in the
// weeks between sowing and haymaking; a barrel is the farm's, held for its house and its boat (a keeping good, sim/stores). Tar gives no
// prestige by itself, only through the well-kept house (HOUSE.termTarred, sim/rules). Without the fair (VB-302) a barrel never leaves the
// household that burnt it: only the pit's own household tars its house and its boat.
VB['sim/tar'] = (() => {
  const { YEAR, SEASON_DAYS, HOUSE, houseCondition, houseTarred } = VB['sim/rules'];
  const { B } = VB['gen'];
  const Rules = VB['sim/registry'];
  const Stores = VB['sim/stores'],
    Projects = VB['sim/projects'],
    { emit } = VB['sim/events'];
  const { log, atFarm } = VB['sim/records'];
  const { fellTree } = VB['sim/forest'];
  const Drying = VB['sim/drying'];
  // Proposed (VB-301, the task's numbers; the pit's and the tarring's hours are this task's own, for Kim's review): a barrel takes `barrelHours`
  // of work at the pit and one pine tree of the village's wood (a load of pine wood), burnt from summer day 0 to `burnDays` (early summer,
  // between the sowing and the haymaking: the slack); a pit is dug in `pitHours` by `hands` hands; tarring a house or a boat takes
  // `tarHours`, in spring, summer or autumn (tar is laid on dry wood); the boat is tarred from `lead` years before it leaks (BOAT.tarYears),
  // so a barrel bought at a summer fair is in time. The pit's household keeps a barrel ready for its house, and one for its boat
  // (`stock`, burnt ahead: a barrel keeps). `urgency`: a side craft's, as ale and digging (the household's slack).
  const TAR = {
    barrelHours: 12,
    burnDays: SEASON_DAYS / 2,
    pitHours: 12,
    hands: 2,
    tarHours: 4,
    lead: 0.5,
    urgency: 0.5,
  };
  const SUMMER = 1,
    WINTER = 3;
  // ---- the reach test: pine in the village's wood (VB-326's allotment, within WOOD.reach of its centre and beyond to WOOD.far) ----
  // Burning draws only among the pine tiles of the village's wood: the firewood trips do not tell pine from broadleaf, so a tar village
  // burns its pine as firewood too (the task's note), and a village whose pine is felled has no tar until it grows back or the wood is
  // reckoned again (sim/territory).
  const pine = (w, t) => w.biome[t] === B.PINE && w.trees[t] > 0;
  // The first pine tile of the village's wood with trees standing (the wood is held nearest the centre first), or -1. A walk of the
  // allotment (at most WOOD.cap tiles), on the yearly round and on the job's posting and finishing, never daily.
  function pineTile(st, v) {
    const w = st.w,
      wood = v.wood || [];
    for (let i = 0; i < wood.length; i++) {
      VB.count.tarAsk++;
      if (pine(w, wood[i])) return wood[i];
    }
    return -1;
  }
  const villageTar = (st, v) => pineTile(st, v) >= 0;
  // ---- the pit: a facility one household builds and owns (design.md, Skill and tools) ----
  // @state household.tarPit: {tile, village, built} or null: the household's tar pit, dug on tile `tile` of village `village`'s wood at game
  //   hour `built`; it burns only while the household's farm is in that village. Written only here.
  const pitOf = (st, hh, f) => (hh.tarPit && f && hh.tarPit.village === f.village ? hh.tarPit : null);
  // The household of village v that holds a pit there, or null; and whether one is being dug (a household's project plan).
  function villagePit(st, v) {
    for (const id of v.farmsteads) {
      const f = st.farmsteads[id],
        hh = f.household === null ? null : st.households[f.household];
      VB.count.tarAsk++;
      if (!hh || hh.dissolved) continue;
      if (pitOf(st, hh, f)) return hh;
      const plan = Projects.projectOf(st, 'household', hh.id);
      if (plan && plan.what === 'tarpit') return hh;
    }
    return null;
  }
  // At the start of summer: in each village with pine in its wood and no pit, the household with the most working hands (at least
  // TAR.hands; the first farm among equals) and no project plan begins one on the wood's first pine tile.
  function tarYear(st) {
    for (const v of st.villages) {
      if (!v.wood || !v.wood.length || villagePit(st, v)) continue;
      const t = pineTile(st, v);
      if (t < 0) continue;
      let best = null,
        most = TAR.hands - 1;
      for (const id of v.farmsteads) {
        const f = st.farmsteads[id],
          hh = f.household === null ? null : st.households[f.household];
        if (!hh || hh.dissolved || f.booth || Projects.projectOf(st, 'household', hh.id)) continue;
        const n = Drying.hands(st, hh);
        if (n > most) {
          most = n;
          best = hh;
        }
      }
      if (best)
        emit(st, 'projectBegun', {
          type: 'household',
          id: best.id,
          project: { what: 'tarpit', steps: [{ kind: 'tarpit', place: t, hours: TAR.pitHours, wood: 0 }] },
        });
    }
  }
  // The pit dug: the household's; the plan is finished (sim/plans).
  function pitDug(st, j, hh) {
    const plan = Projects.projectOf(st, 'household', hh.id),
      s = plan && Projects.openStep(plan);
    if (!s || s.kind !== 'tarpit' || s.place !== j.site) return;
    const f = st.farmsteads[hh.farmstead];
    hh.tarPit = { tile: s.place, village: f.village, built: st.t };
    st.visualDirty = true;
    log(st, `${f.name} has dug a tar pit in the pine wood of ${st.villages[f.village].name}.`, {
      kind: 'tarPit',
      ...atFarm(f),
    });
    emit(st, 'stepDone', { type: 'household', id: hh.id });
  }
  // ---- what tar is for: the house and the boat ----
  // The house is due a barrel while it is not tarred; the boat from TAR.lead years before it leaks.
  const houseDue = (st, f) => !!f && !f.booth && !houseTarred(st, f);
  function dueCount(st, hh) {
    const f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    if (!f) return 0;
    return (houseDue(st, f) ? 1 : 0) + (Drying.boatDue(st, hh, f, TAR.lead) ? 1 : 0);
  }
  // The barrels the pit's household keeps ready: one for its house, and one for its boat if it has one.
  const stock = (st, hh, f) => 1 + (hh.boat && hh.boat.house === f.house ? 1 : 0);
  // A barrel burnt: a pine tree of the village's wood felled into the pit (none left: nothing burnt), a barrel into the store.
  function burnt(st, hh) {
    const f = st.farmsteads[hh.farmstead],
      t = f && pitOf(st, hh, f) ? pineTile(st, st.villages[f.village]) : -1;
    if (t < 0) return false;
    fellTree(st, t);
    Stores.put(st, hh, 'tar', 1, 'tarburn');
    return true;
  }
  // A barrel laid on the house: its condition is read to now (the wear so far at the old rate), then tarred for HOUSE.tarYears.
  function tarHouse(st, hh) {
    const f = st.farmsteads[hh.farmstead];
    if (!houseDue(st, f) || Stores.take(st, hh, 'tar', 1, 'tarring') < 1) return false;
    f.condition = houseCondition(st, f);
    f.condAt = st.t;
    f.tarredUntil = st.t + HOUSE.tarYears * YEAR;
    st.visualDirty = true;
    return true;
  }
  function tarBoat(st, hh) {
    const f = st.farmsteads[hh.farmstead];
    if (!Drying.boatDue(st, hh, f, TAR.lead) || Stores.take(st, hh, 'tar', 1, 'tarring') < 1) return false;
    Drying.boatTarred(st, hh);
    return true;
  }
  // ---- tar's need term (sim/hunger declares the rule; VB-299 left it a stub): a barrel is worth its customary worth to a household
  // whose house or boat is due and that holds too few to tar them, and nothing beyond (it is then only a keeping good, sim/exchange) ----
  const worthCtx = { good: null }; // reused: the term allocates nothing
  const lack = (due, held) => (due > held ? due - held : 0);
  Rules.contribute({
    rule: 'need',
    source: 'sim/tar',
    key: 'tar',
    label: 'Tar, for a boat or the house due',
    tunables: ['TAR.lead'],
    value: (st, c) => {
      if (c.good.id !== 'tar' || !c.hh) return 0;
      const due = dueCount(st, c.hh),
        held = c.hh.tar || 0;
      worthCtx.good = c.good;
      return Rules.value(st, 'worth', worthCtx) * (lack(due, held) - lack(due, Math.max(0, held + c.n)));
    },
  });
  // ---- the job kinds (sim/kinds registers them; their fields are described there) ----
  const atSite = (dx, dy) => (st, a, j) => [st.w.hx[j.site] + dx + a.ox * 0.4, st.w.hy[j.site] + dy + a.oy * 0.3];
  const warm = (c) => c.season !== WINTER;
  const KINDS = {
    tarpit: {
      verb: 'Digging a tar pit',
      go: 'Going to dig the tar pit',
      name: 'Dig a tar pit',
      label: 'Tar pit',
      anim: 'hoe',
      hours: TAR.pitHours,
      hands: TAR.hands,
      type: 'wood',
      project: true,
      spot: atSite(0, 0),
      done: (st, j, hh) => pitDug(st, j, hh),
    },
    burntar: {
      verb: 'Burning tar',
      go: 'Going to the tar pit',
      name: 'Burn tar',
      label: 'Tar',
      anim: 'axe',
      hours: TAR.barrelHours,
      hands: TAR.hands,
      type: 'wood',
      spot: atSite(4, 2),
      urgency: () => TAR.urgency,
      done: (st, j, hh) => {
        burnt(st, hh);
      },
      // in early summer, at the household's pit, while it holds fewer barrels than it keeps and its village's wood holds pine
      available: (st, hh, f, c, post) => {
        if (c.season !== SUMMER || c.sday >= TAR.burnDays || (hh.tar || 0) >= stock(st, hh, f)) return;
        const pit = pitOf(st, hh, f);
        if (pit && villageTar(st, st.villages[f.village])) post(`burntar:h${hh.id}`, pit.tile, { farm: f });
      },
    },
    tarhouse: {
      verb: 'Tarring the house',
      go: 'Going home to tar the house',
      name: 'Tar the house',
      label: 'Tarring',
      anim: 'mallet',
      hours: TAR.tarHours,
      hands: 1,
      type: 'upkeep',
      spot: (st, a, j) => [st.w.hx[j.site] - 6 + a.ox * 0.2, st.w.hy[j.site] + 2 + a.oy * 0.2],
      urgency: () => TAR.urgency,
      done: (st, j, hh) => {
        tarHouse(st, hh);
      },
      available: (st, hh, f, c, post) => {
        if ((hh.tar || 0) >= 1 && warm(c) && houseDue(st, f)) post(`tarhouse:h${hh.id}`, f.house, { farm: f });
      },
    },
    tarboat: {
      verb: 'Tarring the boat',
      go: 'Going to tar the boat',
      name: 'Tar the boat',
      label: 'Tarring',
      anim: 'mallet',
      hours: TAR.tarHours,
      hands: 1,
      type: 'upkeep',
      spot: atSite(0, 0),
      urgency: () => TAR.urgency,
      done: (st, j, hh) => {
        tarBoat(st, hh);
      },
      available: (st, hh, f, c, post) => {
        if ((hh.tar || 0) >= 1 && warm(c) && Drying.boatDue(st, hh, f, TAR.lead))
          post(`tarboat:h${hh.id}`, hh.boat.tile, { farm: f });
      },
    },
  };
  return { TAR, KINDS, pineTile, villageTar, pitOf, villagePit, tarYear, dueCount, houseDue, burnt, tarHouse, tarBoat };
})();
