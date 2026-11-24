// @sys sim/playerplan: the player's plan (VB-1618; Kim, 24 Nov): a daily routine of job kinds, the sleeping hours and an ordered list of
//   tasks, edited by the player (Sim.plan); its writes: the ops, the feeder's (planDay, planBegun, called by sim/player's playerStep) and
//   a fell task's trips home (the event timberHome). The chains of a task at a tile are sim/planchains, what the plan has the pawn do
//   next and why each task waits sim/plannext, the page's reads sim/planview (VB-1629)
VB['sim/playerplan'] = (() => {
  const { DAY } = VB['sim/rules'];
  const { KINDS } = VB['sim/kinds'];
  const { eligible } = VB['sim/eligibility'];
  const { living } = VB['sim/records'];
  const { on } = VB['sim/events'];
  const { CHAINS, chainOf, chainWhy, chainGone, taskAt } = VB['sim/planchains'];
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
  // A trip of timber is home from `tile` (sim/chores' wood, the event timberHome): a fell task of the played household's there counts it.
  on('timberHome', (st, { household, tile }) => {
    const pl = st.player;
    if (!pl || !pl.plan || st.pawns[pl.pawn].household !== household) return;
    const t = taskAt(st, 'fell', tile);
    if (t && t.got < t.n) t.got++;
  });
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
  return { PLAN_MAX, plan, planDay, planBegun, asleepAt, empty, today };
})();
