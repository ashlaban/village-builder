// @sys sim/playerplan: the player's plan (VB-1618; Kim, 24 Nov): a daily routine of job kinds, the sleeping hours and an ordered list of
//   tasks, edited by the player (Sim.plan) and read by the page (Sim.planView); `nextOf` is the one choice of what the plan has the pawn
//   do next, which sim/player's feeder queues with automatic behaviour off and the view reads without writing (VB-1619 reads it too);
//   a task at a tile (VB-1621, VB-1622) carries one chain of steps there: a field from its clearing to its sowing (plant), a meadow's hay
//   from its mowing until it is home (hay), a field's crop from its reaping until its sheaves are in (harvest), trips of timber felled
//   on a forest tile and carried home (fell) and the timber home cut into firewood (firewood; VB-1625); declared as data (CHAINS);
//   why each task waits and why the plan is idle (WAITS, waitsOf; VB-1623), by the reads nextOf makes; how the fire stands (fireView)
VB['sim/playerplan'] = (() => {
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
  const { eligible } = VB['sim/eligibility'];
  const { living } = VB['sim/records'];
  const { WOOD_HOURS, fuelFree, timberOf } = VB['sim/chores'];
  const { woodWhy } = VB['sim/territory'];
  const { on } = VB['sim/events'];
  // @state st.player.plan: absent until the player first plans (an older save reads as empty), else {routine[] (job kinds seen to every
  //   day, in order, at most PLAN_MAX), sleep (null, or {from, until}: hours of the day, the pawn sleeps from `from` to `until`), tasks[]
  //   (at most PLAN_MAX, in order: a task by key {key (a job's key), kind, site (its tile or -1)}, or a task at a tile {<chain> (a tile),
  //   kind: <chain> (a key of CHAINS: plant, hay, harvest, fell, firewood), site (the same tile), and a fell task's n (the trips planned,
  //   1 to FELL_MAX) and got (those home)}, one a chain a tile; VB-1621, VB-1622, VB-1625), day (the game day
  //   `done` is of), done[] (the routine kinds begun on day `day`), last (null, or the last task that left the plan: {key, kind, t}, its
  //   job finished or gone; or {<chain>, kind, site, t, which (one of the chain's `which`: plant 'sown' | 'closed' (its sowing window
  //   shut, the field unsown) | 'fallow' (the field made lies fallow this year) | 'gone' (nothing of the household's there now); hay
  //   'home' | 'closed' (the haymaking over, the meadow unmown) | 'rotted' | 'gone'; harvest 'in' | 'lost' | 'gone'; fell 'home' (its
  //   trips home) | 'bare' (no tree left at the tile) | 'gone'; firewood 'cut' (no timber left, and none planned to fell) | 'full' (the
  //   pile at the season's goal) | 'gone')})}; plain data,
  //   saved with st.player. A command the plan feeds to the queue carries `plan` {from: 'routine' | 'task' | 'sleep', kind, key}, and
  //   `chain` and <chain> (its tile) when a task at a tile fed it (kind 'project' for the project a marked tile begins)
  const PLAN_MAX = 24;
  const empty = (st) => ({ routine: [], sleep: null, tasks: [], day: Math.floor(st.t / DAY), done: [], last: null });
  const today = (st) => Math.floor(st.t / DAY);
  // Whether hour h is within the sleeping hours s (from `from` up to `until`, across midnight when from > until).
  const asleepAt = (s, h) => !!s && (s.from < s.until ? h >= s.from && h < s.until : h >= s.from || h < s.until);
  const workCmd = (id, key) => ({ actor: id, verb: 'work', target: key, args: null, source: 'player' });
  // ---- the player's act: Sim.plan(st, op, args), true or why not ----
  const hourOf = (h) => typeof h === 'number' && h >= 0 && h < 24;
  const index = (i, n) => Number.isInteger(i) && i >= 0 && i < n;
  function plan(st, op, args) {
    const pl = st.player;
    if (!pl) return 'no pawn is played';
    const dead = living(st, pl.pawn);
    if (dead) return dead;
    const g = args || {},
      pp = pl.plan || empty(st);
    const name = op === 'add' ? Object.keys(CHAINS).find((k) => g[k] !== undefined) : undefined;
    if (name) {
      const tile = g[name],
        why = chainWhy(st, pl.pawn, name, tile);
      if (why) return why;
      if (pp.tasks.some((x) => chainOf(x) === name && x[name] === tile))
        return `the ${CHAINS[name].noun} at ${tile} is already planned`;
      if (pp.tasks.length >= PLAN_MAX) return `the plan is full (${PLAN_MAX} tasks)`;
      const at = g.at === undefined || g.at === null ? pp.tasks.length : g.at;
      if (!(Number.isInteger(at) && at >= 0 && at <= pp.tasks.length)) return `there is no place ${g.at} in the plan`;
      const more = CHAINS[name].args ? CHAINS[name].args(g) : null;
      if (typeof more === 'string') return more;
      pp.tasks.splice(at, 0, { [name]: tile, kind: name, site: tile, ...more });
    } else if (op === 'add') {
      const j = st.jobs.get(g.key);
      if (!j) return `there is no job ${g.key}`;
      if (!eligible(st, j, st.pawns[pl.pawn])) return `job ${g.key} is not the pawn's to take`;
      if (pp.tasks.some((x) => x.key !== undefined && x.key === g.key)) return `job ${g.key} is already planned`;
      if (pp.tasks.length >= PLAN_MAX) return `the plan is full (${PLAN_MAX} tasks)`;
      const at = g.at === undefined || g.at === null ? pp.tasks.length : g.at;
      if (!(Number.isInteger(at) && at >= 0 && at <= pp.tasks.length)) return `there is no place ${g.at} in the plan`;
      pp.tasks.splice(at, 0, { key: j.key, kind: j.kind, site: Number.isInteger(j.site) ? j.site : -1 });
    } else if (op === 'remove') {
      if (!index(g.i, pp.tasks.length)) return `the plan has no task ${g.i}`;
      pp.tasks.splice(g.i, 1);
    } else if (op === 'move') {
      if (!index(g.from, pp.tasks.length) || !index(g.to, pp.tasks.length))
        return `the plan cannot move task ${g.from} to ${g.to}`;
      pp.tasks.splice(g.to, 0, pp.tasks.splice(g.from, 1)[0]);
    } else if (op === 'routine') {
      const ks = g.kinds;
      if (!Array.isArray(ks) || ks.length > PLAN_MAX) return 'a routine is a list of job kinds';
      const bad = ks.find((k) => typeof k !== 'string' || !KINDS[k]);
      if (bad !== undefined) return `there is no job kind ${bad}`;
      if (new Set(ks).size !== ks.length) return 'a kind is in the routine twice';
      pp.routine = ks.slice();
      pp.done = pp.done.filter((k) => ks.includes(k));
    } else if (op === 'sleep') {
      if (args === null || args === undefined) pp.sleep = null;
      else if (!hourOf(g.from) || !hourOf(g.until) || g.from === g.until)
        return `cannot sleep from ${g.from} until ${g.until}`;
      else pp.sleep = { from: g.from, until: g.until };
    } else return `there is no plan op ${op}`;
    pl.plan = pp;
    return true;
  }
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
  // A trip of timber is home from `tile` (sim/chores' wood, the event timberHome): a fell task of the played household's there counts it.
  on('timberHome', (st, { household, tile }) => {
    const pl = st.player;
    if (!pl || !pl.plan || st.pawns[pl.pawn].household !== household) return;
    const t = taskAt(st, 'fell', tile);
    if (t && t.got < t.n) t.got++;
  });
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
  // ---- why a task waits (VB-1623): the one closed list of reasons, each plain data for the page (planView's `waits` and `idle`) ----
  // hand: a command queued by hand goes first (its verb, target and the game hour it was begun, null before); before: an earlier task (i,
  // its index) is what the plan does next or has in hand; routine: a routine kind goes first; sleep: the sleeping hours, until `until`
  // o'clock; opens: its next step is not posted until game hour t (what: its window opening, its crop ripe, its hay dry); unposted: its
  // next step (kind) is open and its job not posted for the household now (posted at a review, while the household's own rule wants it:
  // the fields its hands till, the hay it needs); refused: the verb's own reason (text).
  const WAITS = {
    hand: (c) => ({ why: 'hand', verb: c.verb, target: c.target ?? null, since: c.begun ?? null }),
    before: (i) => ({ why: 'before', i }),
    routine: (kind) => ({ why: 'routine', kind }),
    sleep: (until) => ({ why: 'sleep', until }),
    opens: (t, what) => ({ why: 'opens', t, what }),
    unposted: (kind) => ({ why: 'unposted', kind }),
    refused: (text) => ({ why: 'refused', text }),
  };
  // What the pawn may do now for chain task tk, as a command with its `plan` mark, or why not (a WAITS reason): on a marked or free tile,
  // the project begun through the head's verb, beside any other of the household's (VB-1623); else the first step posted at its tile, in
  // the order the work goes, if its `work` verb lets the pawn take it; else its first step's opening, or that its job is not posted.
  function chainCmd(st, id, tk) {
    const name = tk.kind,
      tile = tk[name],
      hid = st.pawns[id].household,
      s = chainSteps(st, hid, name, tile),
      mark = { from: 'task', chain: name, [name]: tile };
    if (!s) return WAITS.refused(CHAINS[name].none(tile));
    if (s.where.mark) {
      const cmd = headCmd(id, hid, { what: s.where.mark, tile }),
        why = VERBS.project.check(st, cmd);
      return why === null ? { ...cmd, plan: { ...mark, kind: 'project', key: null } } : WAITS.refused(why);
    }
    const act = CHAINS[name].act && CHAINS[name].act(st, id, s.where, tile); // a chain's own act first (farmstead: its placing)
    if (act) {
      const why = VERBS[act.verb].check(st, act);
      return why === null ? { ...act, plan: { ...mark, kind: act.verb, key: null } } : WAITS.refused(why);
    }
    const x = s.steps.find((y) => y.job);
    if (x) {
      const why = VERBS.work.check(st, workCmd(id, x.job.key));
      return why === null
        ? { ...workCmd(id, x.job.key), plan: { ...mark, kind: x.job.kind, key: x.job.key } }
        : WAITS.refused(why);
    }
    const y = s.steps[0];
    if (!y) return WAITS.refused(`nothing is left to do at ${tile}`);
    return y.from > st.t ? WAITS.opens(y.from, y.what || y.kind) : WAITS.unposted(y.kind);
  }
  // What the pawn may do now for task t (a task at a tile, or by key): a command with its `plan` mark, or why not (a WAITS reason).
  function taskCmd(st, id, t) {
    if (chainOf(t)) return chainCmd(st, id, t);
    if (!st.jobs.has(t.key)) return WAITS.refused(`there is no job ${t.key}`);
    const why = VERBS.work.check(st, workCmd(id, t.key));
    return why === null
      ? { ...workCmd(id, t.key), plan: { from: 'task', kind: t.kind, key: t.key } }
      : WAITS.refused(why);
  }
  // ---- what comes next ----
  const handOf = (pl) => pl.queue.find((c) => !c.plan) || null;
  // The first job of kind k of the pawn's household that its `work` verb would let it take now, or null.
  function routineJob(st, id, k) {
    const hid = st.pawns[id].household,
      js = hid === null ? null : st.jobsBy.get(`household:${hid}`);
    if (js) for (const j of js) if (j.kind === k && VERBS.work.check(st, workCmd(id, j.key)) === null) return j;
    return null;
  }
  // What the plan has the played pawn do next, as a command with its `plan` mark, or null: in its sleeping hours, sleep until `until`;
  // else the first routine kind not begun today with a job of its household it may take; else the first task that may be taken now
  // (taskCmd). A command queued by hand goes first: with one queued, null. Reads only; writes nothing.
  function nextOf(st) {
    const pl = st.player,
      pp = pl && pl.plan;
    if (!pp || living(st, pl.pawn) || handOf(pl)) return null;
    const id = pl.pawn;
    if (asleepAt(pp.sleep, cal(st.t).hour)) {
      const cmd = { actor: id, verb: 'sleep', target: null, args: { until: pp.sleep.until }, source: 'player' };
      return VERBS.sleep.check(st, cmd) === null ? { ...cmd, plan: { from: 'sleep', kind: null, key: null } } : null;
    }
    const done = pp.day === today(st) ? pp.done : [];
    for (const k of pp.routine) {
      if (done.includes(k)) continue;
      const j = routineJob(st, id, k);
      if (j) return { ...workCmd(id, j.key), plan: { from: 'routine', kind: k, key: j.key } };
    }
    for (const t of pp.tasks) {
      const cmd = taskCmd(st, id, t);
      if (cmd.verb) return cmd;
    }
    return null;
  }
  // Whether plan mark m (a command the plan fed) is task t's.
  const markOf = (m, t) =>
    !!m &&
    m.from === 'task' &&
    (chainOf(t) ? m.chain === t.kind && m[t.kind] === t[t.kind] : !m.chain && m.key === t.key);
  // Why each task of the plan waits now (VB-1623), in the plan's order: null for the one in hand and the one the plan does next, else a
  // WAITS reason: its own (taskCmd) first, then what goes before it (a command by hand, the sleeping hours, a routine kind, an earlier
  // task); and `idle`: null, or why the plan as a whole has the pawn do nothing now though it holds tasks or a routine (a command by
  // hand holding the queue, named with the hour it was begun; else the first task's reason). The reads nextOf makes; writes nothing.
  function waitsOf(st) {
    const pl = st.player,
      pp = pl && pl.plan;
    if (!pp) return { tasks: [], idle: null };
    const id = pl.pawn,
      dead = living(st, pl.pawn),
      hand = handOf(pl),
      head = pl.queue[0],
      inHand = head && head.plan && head.begun !== null ? head.plan : null,
      next = nextOf(st),
      asleep = asleepAt(pp.sleep, cal(st.t).hour),
      first = inHand || (next && next.plan);
    const tasks = pp.tasks.map((t) => {
      if (dead) return WAITS.refused(dead);
      if (markOf(inHand, t) || (next && markOf(next.plan, t))) return null;
      const own = taskCmd(st, id, t);
      if (!own.verb) return own;
      if (hand) return WAITS.hand(hand);
      if (asleep || (first && first.from === 'sleep')) return WAITS.sleep(pp.sleep ? pp.sleep.until : null);
      if (first && first.from === 'routine') return WAITS.routine(first.kind);
      const i = first ? pp.tasks.findIndex((u) => markOf(first, u)) : -1;
      return i >= 0 ? WAITS.before(i) : null;
    });
    let idle = null;
    if (pp.tasks.length || pp.routine.length) {
      if (hand) idle = WAITS.hand(hand);
      else if (dead) idle = WAITS.refused(dead);
      else if (!inHand && !next) idle = tasks.find((w) => w) || null;
    }
    return { tasks, idle };
  }
  // ---- the feeder's writes (sim/player's playerStep) ----
  // A new day clears the routine's `done`; a task whose job is finished or gone leaves the plan, the last one kept in `last`; a task at a
  // tile leaves when its chain says (chainGone).
  function planDay(st) {
    const pp = st.player.plan,
      d = today(st);
    if (pp.day !== d) {
      pp.day = d;
      pp.done = [];
    }
    for (let i = pp.tasks.length - 1; i >= 0; i--) {
      const t = pp.tasks[i];
      const name = chainOf(t);
      if (name) {
        const which = chainGone(st, st.pawns[st.player.pawn].household, name, t[name]);
        if (which) {
          pp.tasks.splice(i, 1);
          pp.last = { [name]: t[name], kind: name, site: t.site, t: st.t, which };
        }
        continue;
      }
      if (st.jobs.has(t.key)) continue;
      pp.tasks.splice(i, 1);
      pp.last = { key: t.key, kind: t.kind, t: st.t };
    }
  }
  // A routine kind's command was begun: it is done for the day.
  function planBegun(st, mark) {
    const pp = st.player.plan;
    if (mark.from === 'routine' && pp && !pp.done.includes(mark.kind)) pp.done.push(mark.kind);
  }
  // ---- the page's read: Sim.planView(st) ----
  // A task at a tile as the view shows it: its tile (under its chain's name), the kind of the step open or next (`step`, null with none
  // left), whether that step's job is posted (`stands`), and its job's key (null while not posted).
  function chainView(st, hid, t) {
    const s = chainSteps(st, hid, t.kind, t[t.kind]),
      x = s && s.steps[0];
    return {
      [t.kind]: t[t.kind],
      kind: t.kind,
      site: t.site,
      key: x && x.job ? x.job.key : null,
      step: x ? x.kind : null,
      stands: !!(x && x.job),
      ...(t.n !== undefined ? { n: t.n, got: t.got } : {}), // a fell task's trips planned and home (VB-1625)
    };
  }
  // The routine, each kind with whether it is done today and whether a job of it is posted for the household; the sleeping hours; the
  // tasks, each with whether its job stands and why it waits (`waits`, VB-1623); why the plan has the pawn idle (`idle`); the last task
  // that left; what the plan has the pawn on now (the queue's head, if the plan
  // fed it) and what it would feed next. null with no pawn played.
  function planView(st) {
    const pl = st.player;
    if (!pl) return null;
    const pp = pl.plan || empty(st),
      hid = st.pawns[pl.pawn].household,
      js = hid === null ? null : st.jobsBy.get(`household:${hid}`),
      done = pp.day === today(st) ? pp.done : [];
    const posted = (k) => {
      if (js) for (const j of js) if (j.kind === k) return true;
      return false;
    };
    const head = pl.queue[0],
      mark = head && head.plan,
      next = nextOf(st),
      W = waitsOf(st);
    return {
      routine: pp.routine.map((k) => ({ kind: k, done: done.includes(k), open: posted(k) })),
      sleep: pp.sleep ? { from: pp.sleep.from, until: pp.sleep.until } : null,
      tasks: pp.tasks.map((t, i) => ({
        ...(chainOf(t)
          ? chainView(st, hid, t)
          : { key: t.key, kind: t.kind, site: t.site, stands: st.jobs.has(t.key) }),
        waits: W.tasks[i] || null,
      })),
      idle: W.idle,
      last: pp.last ? { ...pp.last } : null,
      now: mark ? { what: mark.from, kind: mark.kind, key: mark.key } : null,
      next: next ? { what: next.plan.from, kind: next.plan.kind, key: next.plan.key } : null,
      followed: !pl.auto,
    };
  }
  // ---- the page's read of the fire (VB-1625): Sim.fireView(st) ----
  // How the fire stands for the played pawn's household: wood (firewood held), timber (held, not yet cut), peat (held), free (the pile's
  // free fuel, sim/chores fuelFree: what a project holds back left out, peat at its worth), goal (the season's, the head's plan's), nights
  // (whole nights the free pile lasts at the season's use, ECON.woodUse), cold (the house went cold last night), short (the pile below the
  // goal, or the house cold), mend (what would mend it, in order: [] when not short; 'firewood' first when timber is home, 'fell' when
  // none is or what is home falls short of the goal), planned ({fell, firewood}: whether the plan holds a task of each). null with no
  // pawn played or no household with a farm. Plain data; writes nothing.
  function fireView(st) {
    const pl = st.player;
    if (!pl) return null;
    const hid = st.pawns[pl.pawn].household,
      hh = hid === null ? null : st.households[hid];
    if (!hh || hh.dissolved || hh.farmstead === null) return null;
    const p = pileOf(st, hh),
      timber = timberOf(hh),
      use = st.ECON.woodUse[cal(st.t).season],
      cold = hh.cold > 0,
      short = cold || p.short,
      mend = [],
      tasks = pl.plan ? pl.plan.tasks : [];
    if (short) {
      if (timber > 0) mend.push('firewood');
      if (!timber || p.free + timber < p.goal) mend.push('fell');
      if (!timber) mend.push('firewood');
    }
    return {
      wood: hh.wood,
      timber,
      peat: hh.peat || 0,
      free: p.free,
      goal: p.goal,
      nights: use > 0 ? Math.floor(Math.max(0, p.free) / use + 1e-9) : Infinity,
      cold,
      short,
      mend,
      planned: {
        fell: tasks.some((t) => t.key === undefined && t.kind === 'fell'),
        firewood: tasks.some((t) => t.key === undefined && t.kind === 'firewood'),
      },
    };
  }
  return {
    PLAN_MAX,
    FELL_MAX,
    fireView,
    CHAINS,
    WAITS,
    plan,
    planView,
    nextOf,
    waitsOf,
    planDay,
    planBegun,
    asleepAt,
    chainOf,
    chainSteps,
  };
})();
