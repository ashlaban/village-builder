// @sys sim/away: the nights a pawn spends away from its household's house (VB-783): the open stays (a journey's, a bed where its leg
// ends, and a lodger's, a bed at a place or a guest's in another house), their packs and meals; a lodger's stay by the verbs lodge and
// comeHome, its day away, and its judgement to stake a booth at its bed (VB-1172). A journey's course is sim/journeys'; a guest's bed, sim/hosting's
VB['sim/away'] = (() => {
  const { living } = VB['sim/records'];
  const { release, goHome, free } = VB['sim/agents'];
  const { cal, DAY, WORK, SPEED, HEALTH, TRAVEL, BOOTH } = VB['sim/rules'];
  const { route, routeCost } = VB['sim/routes'];
  const Stores = VB['sim/stores'];
  const { ate, rationOf, nightCost } = VB['sim/hunger'];
  const Kin = VB['sim/records'];
  const { driveHome } = VB['sim/grazing'];
  const { on, emit } = VB['sim/events'];
  const { setDown } = VB['sim/agents'];
  const { stayOf, travelling, tileAt, placeOf } = VB['sim/pose'];
  const { hostWhy } = VB['sim/hosting'];
  const { hexSteps } = VB['sim/hex'];
  // @tunable AWAY: sleeping away from home (VB-783; design.md, Sleeping away from home): pack, the rations a pawn away carries at most (12 days of the
  // 30 rations a back carries, the rest of the load being tools and seed); walk, the walking hours there and back over which a place is
  // worked from a bed there rather than from home (a third of the working day); yard, the steps from its house within which a pawn is at
  // home and packs from its barn (VB-1175: the house and the tiles about it, where the barn and the woodpile stand)
  const AWAY = { pack: 12, walk: 4, yard: 1 };
  // Acts this module's pawns choose (going home, coming home from a stay, work at it) go through the verbs (AGENTS.md, Every act is a pawn's).
  const { issue, register } = VB['sim/commands'];
  // ---- the stays (design.md, Moving to new land, Sleeping away from home) ----
  // @state st.away[]: the open stays, in the order they began (by id), each {id, pawn, why, bed, roof, food, from, to}: why 'move', 'carry',
  //   'fetch', 'haul' or 'visit' for a journey (VB-287, VB-291, VB-461, VB-849, VB-289), else the lodger's (the caller's word: 'work', 'visit'); bed the
  //   tile it sleeps at, null on the road (a journey's bed is where its leg ends, sim/agents' bed); roof 'none', 'booth', 'house' (a
  //   guest's) or 'barn' (a guest's in its host's barn, VB-295); food the rations of its pack, parts the grain it was taken as, by crop (VB-962: home as
  //   grain, or lying where it fell);
  //   from the farm it left (a lodger's household's), or null; to the tile it walks to (a journey:
  //   the house of the pawn's household, a carrier's receiver's, a fetcher's stop; a lodger: its bed). A journey's carrier or fetcher
  //   also holds its gift and back (VB-291, VB-461: fetchGift); a lodger its jobs (the keys of the tasks it is away for), walk (the hours
  //   from its house to its bed, its estimate when it set out), host (a guest's: the household whose house or barn it sleeps in), back (true
  //   once it has turned for home), noWater (absent, or the day on which it found no source to drink at from a bed under the open sky:
  //   VB-1601) and, for a stay at an occasion (VB-295: the gathering), until (the game hour from which it turns for
  //   home: it takes no work, and waits at its bed to be asked to the occasion's days). A journey's course by its kind is read from
  //   JOURNEYS (below, VB-1409), keyed by why; a stay keeps only the word. Plain data, saved; a save with st.journeys loads them as stays.
  //   When a journey's legs start and stop is its pawn's (st.legDue, VB-473): a walk that stops for the night, a wait on the road until
  //   6:00. A visit (VB-289) also holds
  //   village (the one visited), back (false until it has arrived there), stay (the days it has still to stay as a guest) and guest
  //   (true while it is there).
  // @state st.awaySeq: number; the next stay's id; ids are never reused (a save's journeySeq)
  // @state agent.away: the id of the pawn's open stay, absent when it is at home: st.away's index, a cache written only here
  // A pawn's stay begins: it is in st.away, and its agent knows it.
  function open(st, s) {
    st.away.push(s);
    st.agents[s.pawn].away = s.id;
  }
  // A new stay's id (st.awaySeq): ids are never reused.
  const nextStay = (st) => st.awaySeq++;
  // Stay `stay`'s bed is tile `bed` (null: on the road) under `roof`, a guest of household `host` (absent: no one's guest).
  function bedAt(stay, bed, roof, host) {
    if (host !== undefined) stay.host = host;
    stay.bed = bed;
    stay.roof = roof;
    if (host === undefined) delete stay.host;
  }
  // Stay `stay` has turned for home (`back` true), or not yet.
  const turn = (stay, back) => {
    stay.back = back;
  };
  // A lodger's stay becomes a journey: what was the lodger's goes (its tasks, walk, host, turn and occasion).
  function unlodge(stay) {
    for (const k of ['jobs', 'walk', 'host', 'back', 'until']) delete stay[k];
  }
  // Stay s ends: out of st.away and the index.
  function close(st, s) {
    st.away.splice(st.away.indexOf(s), 1);
    delete st.agents[s.pawn].away;
  }
  // Stay j's pack topped up to `want` rations from the grain above the seed of the households `from`, in turn (eaten uncooked: a ration
  // away costs 1 / ECON.uncooked of grain).
  function provide(st, j, from, want) {
    const R = 1 / st.ECON.uncooked;
    for (const src of from) {
      const n = Math.min(want - j.food, Math.max(0, Stores.grainOf(src) - Stores.reserved(st, src, 'grain')) / R);
      if (n > 1e-9) {
        if (!j.parts) j.parts = {};
        Stores.takeSpare(st, src, n * R, { kind: 'away', pawn: j.pawn }, j.parts);
        j.food += n;
      }
    }
  }
  // What is left of stay j's pack as grain, by crop (VB-962): the crops it was taken as, in the same mix, for the rations left (each cost
  // 1 / ECON.uncooked of grain). Null when none is left (or an old save's pack, which has no crops).
  function packLeft(st, j) {
    const n = j.food / st.ECON.uncooked,
      parts = {};
    let sum = 0;
    for (const c in j.parts || {}) sum += j.parts[c];
    if (!(n > 1e-9) || !(sum > 0)) return null;
    for (const c in j.parts) parts[c] = (j.parts[c] * n) / sum;
    return { n, parts };
  }
  // What is left of the pack goes into the store of the household it came from, as the grain it was (home: the household's barn; with the
  // household gone, its village's), not into meals: no grain becomes meals without a cook.
  function packHome(st, j, hh) {
    const g = packLeft(st, j);
    if (!g) return;
    const at = hh.dissolved ? st.villages[st.farmsteads[hh.farmstead].village] : hh;
    Stores.put(st, at, 'grain', g.n, { kind: 'away', pawn: j.pawn }, g.parts);
  }
  // The day's meal away (sim/clock, after the households' meals): each pawn away eats from its pack, a ration a day (half below 14). A
  // lodger whose stay is over by its meal (stayOver) comes home.
  // Its night has the cold and the wet of its roof (VB-785, sim/hunger nightCost): a booth's fire burns once for all who sleep in it.
  function feedAway(st) {
    const { season, day: ended } = cal(st.t - 1),
      fires = new Map();
    for (const j of st.away) {
      VB.count.awayMeals++;
      const p = st.pawns[j.pawn],
        need = rationOf(st, p),
        eat = Math.min(j.food, need);
      j.food = Math.max(0, j.food - eat);
      let fire = 0,
        booth = null;
      if (j.roof === 'booth' && (booth = VB['sim/building'].boothAt(st, j.bed))) {
        if (!fires.has(booth)) fires.set(booth, VB['sim/building'].burnBooth(st, booth, st.ECON.woodUse[season]));
        fire = fires.get(booth);
      }
      const [cold, dry] = nightCost(st, season, j.roof, j.host == null ? null : st.households[j.host], fire);
      // its drink is its roof's: a host's water (a host's part-dry day still gives its guest a drink); a booth's when its day's fetch
      // came in (VB-1601: walked for, sim/building; marsh water is poor); under the open sky none (water on a journey is Open). Read
      // back as the pawn's own thirst, so that one with no water where it stays goes to drink at the site's source (VB-1585)
      const given = booth ? booth.waterDay >= ended : dry < 1;
      ate(st, p, eat, need, cold, ...VB['sim/thirst'].dayEnd(st, p, given, !!booth && booth.marshDay === ended));
      if (j.bed !== null && !j.back && stayOver(st, j, eat < need - 1e-9))
        issue(st, { actor: j.pawn, verb: 'comeHome', source: 'pawn' });
    }
  }
  // ---- a lodger: a stay at a bed, by the verbs lodge and comeHome (design: Sleeping away from home) ----
  // The walking hours between two tiles, by the route a pawn would take (its estimate of the walk).
  const walkHours = (st, from, to) => (from === to ? 0 : routeCost(st.w, route(st, from, to)) / SPEED);
  const houseOf = (st, hh) => st.farmsteads[hh.farmstead].house;
  // The pack for `days` planned away: a ration a day, at most AWAY.pack.
  const packOf = (st, p, days) => Math.min(days, AWAY.pack) * rationOf(st, p);
  // Why pawn id cannot lodge at tile `at` (args {why, days, jobs, host, barn, until, walk}), or null: it is at home with a household that has a farm, the
  // household can spare the whole pack from its food above its seed (one with nothing to spare sends nobody), and a guest's bed is in a
  // house of another household whose head says yes (it does not dislike the guest).
  function lodgeWhy(st, id, at, args) {
    const p = st.pawns[id],
      hh = p.household === null ? null : st.households[p.household],
      o = args || {};
    if (st.agents[id].away !== undefined) return `pawn ${id} is away from home already`;
    if (!hh || hh.dissolved || hh.farmstead === null) return `pawn ${id} has no home to go out from`;
    const kept = Kin.mindsWhy(st, id); // the last one at home with a child under 7 (VB-1602)
    if (kept) return kept;
    if (typeof o.why !== 'string' || !o.why) return 'a stay names why the pawn is away';
    if (!(Number.isInteger(o.days) && o.days >= 1)) return 'a stay plans a whole number of days, one or more';
    if (o.jobs !== undefined && !Array.isArray(o.jobs)) return 'the tasks of a stay must be a list';
    if (o.until !== undefined && !(o.until > st.t)) return 'a stay for an occasion ends after now';
    if (o.walk !== undefined && !(o.walk >= 0)) return 'a walk is a number of hours';
    if (o.barn && (o.host === undefined || o.host === null)) return "a bed in a barn is in a host's barn";
    if (o.host !== undefined && o.host !== null) {
      const host = st.households[o.host];
      if (host && host.id === hh.id) return `there is no other household ${o.host} to stay with`;
      const why = hostWhy(st, id, host);
      if (why) return why;
    } else if (!(Number.isInteger(at) && at >= 0 && at < st.w.N)) return `there is no tile ${at}`;
    else {
      // a booth's bed (VB-784): for its household and whom its maker let in, BOOTH.sleeps at most
      const b = VB['sim/building'].boothAt(st, at);
      if (b) {
        if (!VB['sim/building'].boothOpenTo(st, b, id)) return `the booth at tile ${at} is not for pawn ${id}`;
        if (st.away.filter((s) => s.bed === at && s.roof === 'booth').length + packingFor(st, b, at) >= BOOTH.sleeps)
          return `the booth at tile ${at} sleeps ${BOOTH.sleeps}, and its beds are taken`;
      }
    }
    const R = 1 / st.ECON.uncooked,
      spare = Math.max(0, Stores.grainOf(hh) - Stores.reserved(st, hh, 'grain')) / R;
    return spare + 1e-9 < packOf(st, p, o.days) ? `household ${hh.id} has no food to spare for the pack` : null;
  }
  // The pawns booth b is open to that walk home to pack for a bed at tile `at` (agent.packing, VB-1175): its beds are theirs already.
  function packingFor(st, b, at) {
    let n = 0;
    for (const id of [...st.households[b.by].members, ...b.guests]) {
      const t = st.agents[id] && st.agents[id].packing;
      if (t && t.at === at && (t.args.host === undefined || t.args.host === null)) n++;
    }
    return n;
  }
  // The roof over a bed on tile b: a standing booth's (VB-784), else the open sky.
  const roofAt = (st, b) => {
    return VB['sim/building'].boothAt(st, b) ? 'booth' : 'none';
  };
  // The booth at tile t is gone (sim/building's rot): the stays that slept under it are under the open sky.
  const unroof = (st, t) => {
    for (const s of st.away) if (s.bed === t && s.roof === 'booth') s.roof = 'none';
  };
  // Booth b is raised (sim/building): the stays at its tile under the open sky that it is open to sleep under its roof, BOOTH.sleeps at most.
  function roofOver(st, b) {
    let n = st.away.filter((s) => s.bed === b.tile && s.roof === 'booth').length;
    for (const s of st.away)
      if (n < BOOTH.sleeps && s.bed === b.tile && s.roof === 'none' && VB['sim/building'].boothOpenTo(st, b, s.pawn)) {
        s.roof = 'booth';
        n++;
      }
  }
  // A lodger's own judgement (VB-1172; design: a stay of more than a night or two wants a booth): one that will sleep under the open sky
  // at its bed for more than BOOTH.worth nights, where no booth stands or is staked, stakes one there (the verb raiseBooth, as the played
  // pawn may), and works its wood and its raising before the tasks it came for. The played pawn's own rule is the player's while it is
  // commanded or its automatic behaviour is off (unplanned).
  function stakeIfRough(st, a, days) {
    const s = stayOf(st, a.id);
    if (!s || s.roof !== 'none' || s.host !== undefined || s.bed === null || !(days > BOOTH.worth)) return;
    if (Kin.unplanned(st, a.id) || VB['sim/building'].stakedAt(st, s.bed)) return;
    const bid = st.boothSeq;
    if (issue(st, { actor: a.id, verb: 'raiseBooth', target: s.bed, source: 'pawn' }) === true)
      s.jobs.unshift(`timber:o${bid}`, `timber:o${bid}b`, `booth:o${bid}`);
  }
  // Pawn a lodges (the verb `lodge`, its only caller): it lets go of what it has in hand, takes its pack from its household's food above
  // the seed, and its stay is open; the verb walks it to its bed (sim/agents' goHome reads the bed). With args.host its bed is that
  // household's house, roof 'house'; else tile `at`, under the open sky until a booth is built there.
  function lodge(st, a, at, args) {
    const p = st.pawns[a.id],
      hh = st.households[p.household],
      host = args.host === undefined || args.host === null ? null : st.households[args.host],
      b = host ? houseOf(st, host) : at,
      s = {
        id: nextStay(st),
        pawn: a.id,
        why: args.why,
        bed: b,
        roof: host ? 'house' : roofAt(st, b),
        food: 0,
        from: hh.farmstead,
        to: b,
        jobs: [...(args.jobs || [])],
        walk: args.walk === undefined ? walkHours(st, houseOf(st, hh), b) : args.walk,
      };
    if (host) s.host = host.id;
    if (host && args.barn) s.roof = 'barn';
    if (args.until !== undefined) s.until = args.until;
    setDown(st, a);
    provide(st, s, [hh], packOf(st, p, args.days));
    open(st, s);
    emit(st, 'lodged', s); // its stay is open, its pack taken at the house (sim/gathering: its dealer loads, VB-302)
  }
  // @state agent.packing: absent, or {at, args}: the lodge it was asked to make while away from its house (VB-1175, from VB-302): it walks
  //   home, and packs there (the verb lodge again, from its door). Its household's store is in its barn, so the pack and a dealer's load
  //   are taken where the household's goods are, never from where the pawn happened to stand.
  // Whether pawn a stands at its household's house, or in its yard (AWAY.yard).
  const atHouse = (st, a) =>
    hexSteps(st.w, tileAt(st, ...placeOf(st, a)), houseOf(st, st.households[st.pawns[a.id].household])) <= AWAY.yard;
  // Pawn a, asked to lodge while away from its house, will pack at home first (the verb lodge walks it there: no stay is open yet).
  function homeToPack(st, a, at, args) {
    setDown(st, a);
    a.packing = { at, args };
  }
  // Pawn a is home with a lodge to pack for: it lodges now, from its door, if it still may (else it stays home).
  function packed(st, a) {
    const t = a.packing;
    delete a.packing;
    if (!t || !st.pawns[a.id].alive) return;
    issue(st, { actor: a.id, verb: 'lodge', target: t.at, args: t.args, source: 'pawn' });
  }
  // Why pawn id cannot come home from a stay, or null: it lodges away and has not turned for home yet.
  function comeHomeWhy(st, id) {
    const s = stayOf(st, id);
    return s && s.bed !== null && !s.back ? null : `pawn ${id} is not lodging away from home`;
  }
  // Pawn a turns for home (the verb `comeHome`, its only caller): its bed is its household's house again; the verb walks it there, now in
  // the working hours, else when its day starts (dayAway). Its stay ends when it is home (atBed).
  function comeHome(st, a) {
    stayOf(st, a.id).back = true;
  }
  // Whether lodger s's stay is over at its meal: its household changed (it wed, its head died: from is no longer its farm), it went hungry
  // (`hungry`: its pack fell short) or is ill (health below HEALTH.riskBelow), or its pack is down to the walk home's ration (none for a walk
  // home within the day: it eats at home that night).
  function stayOver(st, s, hungry) {
    const p = st.pawns[s.pawn],
      hh = p.household === null ? null : st.households[p.household];
    if (!hh || hh.dissolved || hh.farmstead !== s.from) return true;
    if (hungry || p.health < HEALTH.riskBelow) return true;
    return s.food <= rationOf(st, p) * (Math.ceil(s.walk / TRAVEL.dayWalk) - 1) + 1e-9;
  }
  // A lodger's water comes before its tasks (VB-1601; design.md, Water by the site: water first, and walked for). Under a booth it takes
  // the booth's fetch while that stands open (sim/building: one trip covers all the booth sleeps, and who draws drinks). Under the open
  // sky there is no pot to fetch for, so it goes to the site's source for its own drink (the verb `drink`), once a day, before it has
  // drunk that day; where the verb refuses (no source in reach) it is not asked again that day (stay.noWater). True if it set out.
  function waterFirst(st, a, s) {
    if (s.host !== undefined || s.bed === null) return false;
    if (s.roof === 'booth') {
      const key = `boothwater:o${(VB['sim/building'].boothAt(st, s.bed) || { id: -1 }).id}`;
      return st.jobs.has(key) && issue(st, { actor: a.id, verb: 'work', target: key, source: 'planner' }) === true;
    }
    const day = Math.floor(st.t / DAY);
    if (st.pawns[a.id].drank >= day * DAY || s.noWater === day) return false;
    if (issue(st, { actor: a.id, verb: 'drink', source: 'pawn' }) === true) return true;
    s.noWater = day;
    return false;
  }
  // The working day of the pawns away (sim/clock, before the household's day): of the free pawns `idle`, each lodger takes the first open
  // task of those its stay names, and no other (no chore of its house, no help, no idling about); one with none left, or turned for home,
  // walks home. The others, for the household's day; `idle` itself when none is away.
  function dayAway(st, idle) {
    let rest = null;
    for (let i = 0; i < idle.length; i++) {
      const a = idle[i];
      if (a.away === undefined || travelling(a)) {
        if (rest) rest.push(a);
        continue;
      }
      if (!rest) rest = idle.slice(0, i);
      const s = stayOf(st, a.id);
      if (s.back) {
        issue(st, { actor: a.id, verb: 'goHome', source: 'pawn' });
        continue;
      }
      if (s.until !== undefined) {
        // at an occasion's bed (VB-295): it waits to be asked to its days, and turns for home once they are over
        if (st.t >= s.until) issue(st, { actor: a.id, verb: 'comeHome', source: 'pawn' });
        continue;
      }
      if (waterFirst(st, a, s)) continue;
      let got = false;
      for (const key of s.jobs) {
        const j = st.jobs.get(key);
        if (j && issue(st, { actor: a.id, verb: 'work', target: key, source: 'planner' }) === true) {
          got = true;
          break;
        }
      }
      // its work is done, or none is open; one whose booth is staked at its bed waits for its wood and its raising to be posted (VB-1172)
      if (!got && !VB['sim/building'].stakedAt(st, s.bed)) issue(st, { actor: a.id, verb: 'comeHome', source: 'pawn' });
    }
    return rest || idle;
  }
  // A pawn away has come to its bed (sim/agents' arrived): one that turned for home is home, and its stay ends; what is left of its pack
  // goes into its household's meals, and the herds it brought home are by the farm.
  function atBed(st, a) {
    const s = stayOf(st, a.id);
    if (!s || !s.back || s.bed === null) return;
    const hh = st.households[st.pawns[a.id].household];
    close(st, s);
    packHome(st, s, hh);
    driveHome(st, hh, a.id);
  }
  // What sim/agents tells of the pawns away (sim/events): one away is at its bed; a booth over beds is gone or raised.
  on('atBed', atBed);
  on('homeToPack', packed); // VB-1175: home, with a lodge to pack for
  on('boothGone', unroof); // VB-784: a booth rotted away
  on('boothRaised', roofOver); // VB-1172: a booth raised where pawns lodge
  // lodge(tile, {why, days, jobs, host}) (VB-783; design.md, Sleeping away from home): walk to the tile and sleep there, working only
  // the tasks `jobs` names, on a pack of a ration a day for `days` (at most AWAY.pack) from the household's food above its seed; with
  // `host`, a guest in that household's house (in its barn with `barn`), with its head's yes (sim/away lodgeWhy); with `until`, at an
  // occasion's bed until that hour (VB-295); `walk`, the hours there by the walker's estimate, else by its route
  register('lodge', {
    check: (st, c) => free(st, c.actor) || lodgeWhy(st, c.actor, c.target, c.args),
    run: (st, c) => {
      const a = st.agents[c.actor];
      if (!atHouse(st, a)) {
        homeToPack(st, a, c.target, c.args); // it packs at its house (VB-1175, from VB-302)
        return goHome(st, a);
      }
      lodge(st, a, c.target, c.args);
      stakeIfRough(st, a, c.args.days);
      goHome(st, a); // to its bed
    },
  });
  // comeHome: a pawn lodging away turns for home, now in the working hours or when it is outdoors, else at 6:00; its stay ends at home
  register('comeHome', {
    check: (st, c) => living(st, c.actor) || comeHomeWhy(st, c.actor),
    run: (st, c) => {
      const a = st.agents[c.actor],
        h = cal(st.t).hour;
      comeHome(st, a);
      if (a.inside && (h < WORK[0] || h >= WORK[1])) return; // it walks when its day starts (sim/away dayAway)
      release(st, a);
      goHome(st, a);
    },
  });
  return {
    AWAY,
    open,
    close,
    provide,
    packLeft,
    packHome,
    nextStay,
    bedAt,
    turn,
    unlodge,
    feedAway,
    dayAway,
    lodgeWhy,
  };
})();
