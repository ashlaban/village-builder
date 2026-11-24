// @sys sim/planchains: the chains of a task at a tile in the player's plan (VB-1621, VB-1622, VB-1625, VB-1627; VB-1629 split it from
//   sim/playerplan), declared as data (CHAINS): a field from its clearing to its sowing (plant), a meadow's hay from its mowing until it
//   is home (hay), a field's crop from its reaping until its sheaves are in (harvest), trips of timber felled on a forest tile and carried
//   home (fell), the timber home cut into firewood (firewood) and the first shelter placed from the camp and raised (farmstead; the
//   upgrade of the main building, sim/upgrade's, is contributed at load, VB-1632); what
//   stands at a tile for each (chainWhere), why it cannot be planned (chainWhy), its steps left (chainSteps) and why its task leaves the
//   plan (chainGone). Reads only: the plan's writes are sim/playerplan's
VB['sim/planchains'] = (() => {
  const { DAY, SEASON_DAYS, YEAR, WORK, TRAVEL, BOOTH, ECON, cal } = VB['sim/rules'];
  const { CROPS, ROTATIONS } = VB['sim/crops'];
  const { projectsOf, lacks } = VB['sim/projects'];
  const { frostDay } = VB['sim/weather'];
  const { fieldProject } = VB['sim/fieldplans'];
  const { standing } = VB['sim/fields'];
  const { MOW_LAST, DRY_DAYS, HAY, meadowFert, meadowProject } = VB['sim/meadows'];
  const { courseFor } = VB['sim/rotations'];
  const { heldFarms } = VB['sim/ownership'];
  const { KINDS } = VB['sim/kinds'];
  const { VERBS } = VB['sim/commands'];
  const { WOOD_HOURS, fuelFree, timberOf } = VB['sim/chores'];
  const { woodWhy } = VB['sim/territory'];
  // ---- a task at a tile (VB-1621, VB-1622; Kim, 24 Nov 2026): a chain of steps carried at one tile ----
  // A chain is declared as data (CHAINS): the land project a tile the head has marked for it begins (`mark`: 'field' or 'meadow', or
  // null), what of the household's stands at a tile for it (`at`: {f, fd} a field, {f, m} a meadow, {plan, f} its open project making
  // one, or null), why nothing does (`none`), why what stands there takes no task now (`why`), its steps in the order the work goes after
  // any project's (`steps`: [{kind, hours (of one piece), n (pieces: the loads of a carrying, else 1), from (the game hour it may begin,
  // while its job is not posted)}]), why it leaves the plan (`gone`: one of `which`, or null while it stands), the job kinds it covers
  // (`kinds`, sim/agenda's gaps) and its deadline (`deadline`, {t, what}: `frost` the autumn day of the frost the head expects, which
  // sim/reasons reckons and its reader passes). A project's tile and a marked one stand until the project is done, whatever the season.
  const SOWN = ['sown', 'growing', 'ripe', 'stooks'];
  const yearOf = (st) => Math.floor(st.t / YEAR) * YEAR;
  // The farms of household hid, its own first and those it holds (a household's farms are few), or [] for none.
  function farmsOf(st, hid) {
    const hh = hid === null || hid === undefined ? null : st.households[hid];
    if (!hh || hh.dissolved) return [];
    const home = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    return home ? [home, ...heldFarms(st, hid)] : heldFarms(st, hid);
  }
  const homeOf = (st, hid) => {
    const hh = st.households[hid];
    return hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
  };
  // The open project of household hid making `what` (a field, a meadow) whose step stands at `tile`, or null.
  function projectAt(st, hid, what, tile) {
    for (const p of projectsOf(st, 'household', hid)) {
      const s = p.steps[p.open];
      if (p.what === what && s && s.place === tile) return p;
    }
    return null;
  }
  // The project a marked tile would begin, as sim/plans makes it (its steps; read only).
  const markProject = (st, hid, what, tile) =>
    (what === 'field' ? fieldProject : meadowProject)(st, st.households[hid], tile);
  // ---- plant: one field carried from its clearing to its sowing (VB-1621) ----
  // The crop the field at `where` is sown with: its own, or for a project's the course a new field beside the farm's would take.
  function plantCrop(st, hid, where) {
    if (where.fd) return where.fd.crop;
    const { key, i } = courseFor(st, where.f ? where.f.fields : [], st.households[hid]);
    return ROTATIONS[key].courses[i];
  }
  const sowable = (k) => !CROPS[k].fallow && !!CROPS[k].sow && CROPS[k].seed > 0;
  // Crop k's sowing window this year, or next year's once this year's has shut: {opens, close (game hours; its first day's start of work,
  // the thaw not reckoned, and its last day's end of work), next (whether next year's)}; null for a crop not sown.
  function sowWindow(st, k) {
    if (!CROPS[k] || !sowable(k)) return null;
    const W = CROPS[k].sow,
      y0 = yearOf(st),
      close = (y) => y + (W[0] * SEASON_DAYS + W[2]) * DAY + WORK[1],
      y = close(y0) >= st.t ? y0 : y0 + YEAR;
    return { opens: y + (W[0] * SEASON_DAYS + W[1]) * DAY + WORK[0], close: close(y), next: y > y0 };
  }
  // Whether this year's sowing window of crop k has shut: its last day is past (sim/reasons windowLeft's count).
  const shut = (st, k) => {
    const W = CROPS[k].sow,
      c = cal(st.t);
    return c.season * SEASON_DAYS + c.sday > W[0] * SEASON_DAYS + W[2];
  };
  const plant = {
    noun: 'field',
    mark: 'field',
    kinds: ['fell', 'grub', 'clear', 'break', 'plow', 'sow'],
    which: ['sown', 'closed', 'fallow', 'gone'],
    at: (st, hid, tile) => {
      for (const f of farmsOf(st, hid)) for (const fd of f.fields) if (fd.tile === tile) return { f, fd };
      const p = projectAt(st, hid, 'field', tile);
      return p ? { plan: p, f: homeOf(st, hid) } : null;
    },
    none: (tile) => `there is no field of the household's nor a field project at ${tile}`,
    // a field not yet sown this year with its sowing window not shut
    why: (st, { fd }, tile) => {
      if (!sowable(fd.crop)) return `the field at ${tile} lies ${fd.crop} this year`;
      if (fd.stage !== 'stubble' && fd.stage !== 'plowed')
        return SOWN.includes(fd.stage) ? `the field at ${tile} is sown` : `the field at ${tile} is ${fd.stage}`;
      if (shut(st, fd.crop)) return `the ${fd.crop} sowing is over for this year`;
      return null;
    },
    // after a project, the hoeing and the sowing of the crop the new field would take; a field's hoeing (in stubble) and sowing; the
    // hoeing and the sowing laid no earlier than the window's opening
    steps: (st, hid, where) => {
      const crop = plantCrop(st, hid, where),
        C = CROPS[crop],
        win = sowWindow(st, crop),
        open = !where.fd;
      if (!sowable(crop) || !(open || where.fd.stage === 'stubble' || where.fd.stage === 'plowed')) return [];
      const out = open || where.fd.stage === 'stubble' ? ['plow', 'sow'] : ['sow'];
      return out.map((kind) => ({
        kind,
        hours: C.hours[kind] ?? KINDS[kind].hours,
        n: 1,
        from: win.opens,
        what: `the ${crop} sowing`,
      }));
    },
    // sown; this year's window shut with it unsown; the field made lies fallow
    gone: (st, { fd }) => {
      if (SOWN.includes(fd.stage)) return 'sown';
      if (!sowable(fd.crop)) return 'fallow';
      if (fd.stage !== 'stubble' && fd.stage !== 'plowed') return 'gone';
      return shut(st, fd.crop) ? 'closed' : null;
    },
    deadline: (st, hid, where) => {
      const crop = plantCrop(st, hid, where),
        win = sowWindow(st, crop);
      return win ? { t: win.close, what: `the end of the ${crop} sowing${win.next ? ' next year' : ''}` } : null;
    },
  };
  // ---- hay: one meadow's hay from its mowing (after the meadow's clearing, a project's) until it is home (VB-1622) ----
  // The haymaking window (sim/meadows: summer's first day to autumn's MOW_LAST): whether this year's is over; its opening and its end,
  // this year's or next year's once this year's is over (`next`).
  const hayOver = (c) => c.season > 2 || (c.season === 2 && c.sday > MOW_LAST);
  function hayWindow(st) {
    const y = yearOf(st) + (hayOver(cal(st.t)) ? YEAR : 0);
    return {
      opens: y + SEASON_DAYS * DAY + WORK[0],
      close: y + (2 * SEASON_DAYS + MOW_LAST) * DAY + WORK[1],
      next: y > yearOf(st),
    };
  }
  // The loads of a carrying: `amount` (of hay, or rations of sheaves) at a back's load (TRAVEL.load rations; hay TRAVEL.hay a ration).
  const loads = (amount, per) => Math.max(1, Math.ceil(amount / per - 1e-9));
  // Whether the year's frost has come (sim/weather frostDay: the draw, as the state shows it; what a stage reached at it means).
  const frosted = (st, c) => c.season > 2 || (c.season === 2 && c.sday >= frostDay(st));
  const hay = {
    noun: 'meadow',
    mark: 'meadow',
    kinds: ['meadow', 'rake', 'mow', 'hay'],
    which: ['home', 'closed', 'rotted', 'gone'],
    at: (st, hid, tile) => {
      for (const f of farmsOf(st, hid)) for (const m of f.meadows) if (m.tile === tile) return { f, m };
      const p = projectAt(st, hid, 'meadow', tile);
      return p ? { plan: p, f: homeOf(st, hid) } : null;
    },
    none: (tile) => `there is no meadow of the household's nor a meadow project at ${tile}`,
    why: (st, { m }, tile) =>
      m.stage === 'aftermath'
        ? `the hay of the meadow at ${tile} is in`
        : m.stage === 'grass' && hayOver(cal(st.t))
          ? 'the haymaking is over for this year'
          : null,
    // a raking posted (spring), the mowing from the window's opening, the carrying once the hay has dried (DRY_DAYS), by its loads
    steps: (st, hid, where) => {
      const m = where.m,
        win = hayWindow(st),
        per = TRAVEL.load * TRAVEL.hay,
        out = [];
      if (m && m.stage === 'aftermath') return out;
      if (m && m.stage === 'mown')
        return [
          {
            kind: 'hay',
            hours: KINDS.hay.hours,
            n: loads(m.held, per),
            from: (m.mown + DRY_DAYS) * DAY + WORK[0],
            what: 'the hay dry',
          },
        ];
      if (m && !m.raked) out.push({ kind: 'rake', hours: KINDS.rake.hours, n: 1, from: Infinity, posted: true });
      const fert = m ? m.fert : meadowFert(st.w, where.plan ? where.plan.steps[where.plan.open].place : where.tile);
      out.push({ kind: 'mow', hours: KINDS.mow.hours, n: 1, from: win.opens, what: 'the haymaking' });
      out.push({
        kind: 'hay',
        hours: KINDS.hay.hours,
        n: loads(HAY * fert, per),
        from: win.opens + DRY_DAYS * DAY,
        what: 'the hay dry',
      });
      return out;
    },
    gone: (st, { m }) => {
      const c = cal(st.t);
      if (m.stage === 'aftermath') return frosted(st, c) ? 'rotted' : 'home';
      return m.stage === 'grass' && hayOver(c) ? 'closed' : null;
    },
    deadline: (st) => {
      const win = hayWindow(st);
      return { t: win.close, what: `the end of haymaking${win.next ? ' next year' : ''}` };
    },
  };
  // ---- harvest: one sown field reaped when ripe and its sheaves carried in; the threshing is indoor work of any day (VB-1622) ----
  // The day a field's crop is expected ripe: its sowing and the crop's days to ripen (the year's weather, a draw, not reckoned).
  const ripeDay = (fd) => fd.sown + CROPS[fd.crop].ripe;
  const harvest = {
    noun: 'harvest',
    mark: null,
    kinds: ['reap', 'haul'],
    which: ['in', 'lost', 'gone'],
    at: (st, hid, tile) => {
      for (const f of farmsOf(st, hid)) for (const fd of f.fields) if (fd.tile === tile) return { f, fd };
      return null;
    },
    none: (tile) => `there is no field of the household's at ${tile}`,
    why: (st, { fd }, tile) => (SOWN.includes(fd.stage) ? null : `the field at ${tile} is not sown`),
    // the reaping once ripe (expected), then the carrying once the sheaves are dry, by its loads; in stooks, the carrying left
    steps: (st, hid, { fd }) => {
      const dry = st.ECON.dryDays,
        haul = KINDS.haul.hours;
      if (fd.stage === 'stooks')
        return [
          {
            kind: 'haul',
            hours: haul,
            n: loads(fd.held, TRAVEL.load),
            from: (fd.reaped + dry) * DAY + WORK[0] - 1,
            what: 'the sheaves dry',
          },
        ];
      if (!SOWN.includes(fd.stage)) return [];
      const ripe = fd.stage === 'ripe' ? st.t : ripeDay(fd) * DAY + WORK[0];
      return [
        {
          kind: 'reap',
          hours: CROPS[fd.crop].hours.reap ?? KINDS.reap.hours,
          n: 1,
          from: ripe,
          what: `the ${fd.crop} ripe`,
        },
        {
          kind: 'haul',
          hours: haul,
          n: loads(standing(st, fd), TRAVEL.load),
          from: ripe + dry * DAY,
          what: 'the sheaves dry',
        },
      ];
    },
    // the sheaves in (the field reaped this year and back in stubble before the frost), or the crop lost to the frost or left standing
    gone: (st, { fd }) => {
      if (SOWN.includes(fd.stage)) return null;
      const c = cal(st.t),
        y = Math.floor(st.t / YEAR) * (YEAR / DAY);
      return fd.reaped !== null && fd.reaped !== undefined && fd.reaped >= y && !frosted(st, c) ? 'in' : 'lost';
    },
    // the frost the head expects (`frost`, an autumn day), or the crop's day of loss left standing when that comes first; next year's for
    // a crop not ripe before this year's
    deadline: (st, hid, { fd }, frost) => {
      if (!SOWN.includes(fd.stage)) return null;
      const L = CROPS[fd.crop].lost,
        at = (y) => {
          const f = y + (2 * SEASON_DAYS + frost) * DAY + WORK[1];
          if (!L) return { t: f, what: 'the frost' };
          const l = y + (L[0] * SEASON_DAYS + L[1] - 1) * DAY + WORK[1];
          return l < f ? { t: l, what: `the ${fd.crop} lost standing` } : { t: f, what: 'the frost' };
        },
        d = at(yearOf(st));
      return fd.stage === 'stooks' || ripeDay(fd) * DAY < d.t ? d : at(yearOf(st) + YEAR);
    },
  };
  // ---- fell: n trips of timber felled on a forest tile the player chose and carried home (VB-1625; Kim, 24 Nov 2026) ----
  // Any tile the household's village may fell on (sim/territory woodWhy: the tiles the rule of the village's wood may give it, whatever
  // its size, within WOOD.far of its centre; a lone farm's village is its own, so the same rule). The household's farm takes the timber.
  const FELL_MAX = 20;
  // The task of chain `name` at `tile` in the played pawn's plan, or null.
  const taskAt = (st, name, tile) => {
    const pp = st.player && st.player.plan;
    return (pp && pp.tasks.find((t) => t.key === undefined && t.kind === name && t[name] === tile)) || null;
  };
  const fell = {
    noun: 'felling',
    mark: null,
    kinds: ['wood'],
    which: ['home', 'bare', 'gone'],
    args: (g) => {
      const n = g.n === undefined || g.n === null ? 1 : g.n;
      return Number.isInteger(n) && n >= 1 && n <= FELL_MAX
        ? { n, got: 0 }
        : `cannot plan ${g.n} trips to fell (1 to ${FELL_MAX})`;
    },
    at: (st, hid, tile) => {
      const f = homeOf(st, hid);
      if (!f || st.households[hid].dissolved || !st.villages[f.village]) return null;
      const t = taskAt(st, 'fell', tile);
      return { f, tile, n: t ? t.n : 1, got: t ? t.got : 0 };
    },
    none: () => 'the household has no farm to carry timber home to',
    why: (st, { f }, tile) => woodWhy(st, st.villages[f.village], tile),
    // the trips left, each a tree felled and its timber home, while trees stand there
    steps: (st, hid, { tile, n, got }) =>
      st.w.trees[tile] > 0 && got < n ? [{ kind: 'wood', hours: WOOD_HOURS.fell, n: n - got, from: -Infinity }] : [],
    gone: (st, { tile, n, got }) => (got >= n ? 'home' : st.w.trees[tile] > 0 ? null : 'bare'),
    deadline: () => null,
  };
  // (the event timberHome, a trip of timber home, is counted by sim/playerplan, the plan's writer)
  // ---- firewood: the timber home cut into firewood at the house, until it is all cut or the pile holds the season's goal (VB-1625) ----
  // The pile's free wood against the season's goal (the head's plan's targets, sim/plans), and whether it is short.
  const pileOf = (st, hh) => {
    const plan = st.plans.households.get(hh.id),
      goal = plan && plan.targets ? plan.targets.wood[cal(st.t).season] : 0,
      free = fuelFree(st, hh);
    return { free, goal, short: free < goal };
  };
  // Whether the played pawn's plan holds a fell task with trips left (timber to come home).
  const fellPlanned = (st) => {
    const pp = st.player && st.player.plan;
    return !!pp && pp.tasks.some((t) => t.key === undefined && t.kind === 'fell' && t.got < t.n);
  };
  const firewood = {
    noun: 'firewood',
    mark: null,
    kinds: ['firewood'],
    which: ['cut', 'full', 'gone'],
    at: (st, hid, tile) => {
      const f = homeOf(st, hid);
      return f && f.house === tile && !st.households[hid].dissolved ? { f, hh: st.households[hid], tile } : null;
    },
    none: (tile) => `the household's house is not at ${tile}`,
    // timber home, or a felling planned to bring it; the pile short of the season's goal
    why: (st, { hh }) => {
      if (!timberOf(hh) && !fellPlanned(st)) return 'no timber is home to cut: fell timber first';
      return pileOf(st, hh).short ? null : "the woodpile holds the season's goal";
    },
    // the loads left to cut: the timber home, at most the pile's shortfall, ECON.woodPerTrip a load
    steps: (st, hid, { hh }) => {
      const p = pileOf(st, hh),
        per = st.ECON.woodPerTrip,
        x = Math.min(timberOf(hh), Math.max(0, p.goal - p.free));
      return x > 0 || fellPlanned(st)
        ? [{ kind: 'firewood', hours: WOOD_HOURS.cut, n: Math.max(1, Math.ceil(x / per - 1e-9)), from: -Infinity }]
        : [];
    },
    gone: (st, { hh }) => (!pileOf(st, hh).short ? 'full' : !timberOf(hh) && !fellPlanned(st) ? 'cut' : null),
    deadline: () => null,
  };
  // ---- farmstead: the first shelter, placed from the camp and raised (VB-1627) ----
  // On a camp (sim/camp) the head places the farmstead by its own verb (`act`: placeFarmstead, the house moved to the tile and the booth
  // staked beside it); then the booth's timber trips, whose jobs stand at the wood (`keys`: found by their keys, not at the tile), and its
  // raising. It leaves when the booth stands ('raised'), or when nothing of the camp's stands for it ('gone').
  const Camp = VB['sim/camp'];
  const trips = (lack) => Math.max(1, Math.ceil(lack / ECON.woodPerTrip - 1e-9));
  const farmstead = {
    noun: 'farmstead',
    mark: null,
    kinds: ['timber', 'booth'],
    which: ['raised', 'gone'],
    at: (st, hid, tile) => Camp.campAt(st, hid, tile),
    none: (tile) => `there is no camp to place a farmstead from, nor a farmstead under way at ${tile}`,
    why: (st, where, tile) =>
      where.camp ? Camp.placeWhy(st, 'farmstead', tile) : where.raised ? `the farmstead at ${tile} stands` : null,
    steps: (st, hid, { camp, staked }) => {
      if (!camp && !staked) return [];
      const s = staked && staked.steps[staked.open],
        bid = staked ? staked.booth : null,
        raise = { kind: 'booth', hours: BOOTH.hours, n: 1, from: -Infinity, keys: staked ? [`booth:o${bid}`] : [] };
      if (s && s.kind !== 'timber') return [raise];
      const lack = s ? lacks(s, s.timber) : BOOTH.wood,
        keys = staked ? [`timber:o${bid}`, `timber:o${bid}b`] : [];
      return lack > 0
        ? [{ kind: 'timber', hours: KINDS.timber.hours, n: trips(lack), from: -Infinity, keys }, raise]
        : [raise];
    },
    gone: (st, where) => (where.raised ? 'raised' : null),
    deadline: () => null,
    act: (st, id, where, tile) =>
      where.camp ? { actor: id, verb: 'placeFarmstead', target: tile, args: null, source: 'player' } : null,
  };
  const CHAINS = { plant, hay, harvest, fell, firewood };
  CHAINS.farmstead = farmstead; // VB-1627
  // The chain of task t (a task at a tile: no key), or null for a task by key.
  const chainOf = (t) => (t.key === undefined && CHAINS[t.kind] ? t.kind : null);
  // What stands at `tile` for chain `name` of household hid: the chain's own (`at`), else the tile the head has marked for its next field
  // or meadow (sim/plans, plan.tiles) as {mark, f, tile}; else, for a task already planned (`planned`), its tile as one the played head's
  // verb `project` begins a field or meadow on (VB-1623: no mark needed; {mark, f, tile, free: true}); null for nothing.
  function chainWhere(st, hid, name, tile, planned = false) {
    if (hid === null || hid === undefined || !Number.isInteger(tile) || tile < 0) return null;
    const C = CHAINS[name],
      where = C.at(st, hid, tile);
    if (where) return where;
    const plan = C.mark && st.plans.households.get(hid);
    if (plan && plan.tiles && plan.tiles[C.mark] === tile) return { mark: C.mark, f: homeOf(st, hid), tile };
    return planned && C.mark && headPlayed(st, hid) ? { mark: C.mark, f: homeOf(st, hid), tile, free: true } : null;
  }
  // Whether household hid's head is the played pawn.
  const headPlayed = (st, hid) => !!st.player && st.households[hid].holder === st.player.pawn;
  // The head's check, through its own verb (sim/plans' project: only the head changes its plan), or null.
  const headCmd = (id, hid, args) => ({ actor: id, verb: 'project', target: hid, args, source: 'player' });
  // Why the played pawn `id` cannot plan chain `name` at `tile`, or null; a marked tile only by the head of the household, and any other
  // tile where the head's verb `project` would begin the chain's field or meadow now (VB-1623).
  function chainWhy(st, id, name, tile) {
    const hid = st.pawns[id].household,
      C = CHAINS[name];
    if (!Number.isInteger(tile) || tile < 0) return `there is no tile ${tile}`;
    const where = chainWhere(st, hid, name, tile);
    if (!where) {
      if (!C.mark || hid === null || st.households[hid].holder !== id) return C.none(tile);
      const why = VERBS.project.check(st, headCmd(id, hid, { what: C.mark, tile }));
      return why === null ? null : `${C.none(tile)} (${why})`;
    }
    if (where.plan) return null;
    if (where.mark) return VERBS.project.check(st, headCmd(id, hid, { what: null }));
    return C.why(st, where, tile);
  }
  // The steps left of chain `name` at `tile` for household hid's task there, in the order the work goes: a project's (begun, or the one a
  // marked or free tile would begin) at their own hours, then the chain's: {where, steps: [{kind, job (its job posted at the tile, or
  // null), hours, n, from, what (what its `from` waits for, or absent)}]}; null where nothing of the household's stands there. A step
  // whose job is not posted now and that is listed only while posted (`posted`) is left out. Reads only.
  function chainSteps(st, hid, name, tile) {
    const where = chainWhere(st, hid, name, tile, true);
    if (!where) return null;
    const p = where.plan || (where.mark ? markProject(st, hid, where.mark, tile) : null),
      first = p
        ? p.steps.slice(where.plan ? p.open : 0).map((s) => ({ kind: s.kind, hours: s.hours, n: 1, from: -Infinity }))
        : [];
    const js = st.jobsBy.get(`household:${hid}`),
      steps = [];
    for (const s of [...first, ...CHAINS[name].steps(st, hid, where)]) {
      let job = null;
      if (s.keys)
        for (const k of s.keys) job = job || st.jobs.get(k) || null; // jobs found by key (farmstead's timber at the wood)
      else if (js && !where.mark) for (const j of js) if (j.kind === s.kind && j.site === tile) job = j;
      if (!job && s.posted) continue;
      steps.push({ kind: s.kind, job, hours: s.hours, n: s.n, from: s.from, what: s.what });
    }
    return { where, steps };
  }
  // Why a task of chain `name` leaves the plan now (one of the chain's `which`), or null: nothing of the household's stands there
  // ('gone'); a project's tile, a marked one or a free one stands.
  function chainGone(st, hid, name, tile) {
    const where = chainWhere(st, hid, name, tile, true);
    if (!where) return 'gone';
    return where.plan || where.mark ? null : CHAINS[name].gone(st, where);
  }
  return { CHAINS, FELL_MAX, chainOf, chainWhy, chainSteps, chainGone, taskAt, headCmd, pileOf };
})();
