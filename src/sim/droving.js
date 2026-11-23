// @sys sim/droving: animals that change household (VB-674): handed on when a household ends or goes into trust, given as a start in life,
// paid in for a share; the owner changes where they stand, a member of the new household leads them home (the kind `drove`), and the hay
// that goes with them is left lying at the old farm for it to fetch (sim/lying); a herd with nobody to have it stays at its farm until the
// autumn frost, when the farm's household takes it in or it is lost. Writes st.herds' records that move and st.herdsAway.
VB['sim/droving'] = (() => {
  const { HERD, SHARES, TRAVEL } = VB['sim/rules'];
  const { log, atHousehold, atFarm } = VB['sim/records'];
  const { herdsOf, herdOf, winterNeed, makeHerd, homeTile } = VB['sim/herds'];
  const Lying = VB['sim/lying'];
  // @state st.herdsAway: absent, or [herd ids]: the herds standing at a farm not their household's (herd.at), in the order they were left
  //   there: owned by a household that has not yet led them home, or left with nobody (household null) when theirs ended. A small live
  //   list (Rules for cost 1): a herd leaves it when it is led home, taken in or lost at the frost; absent once empty. Written only here.
  // @state herd.at: the farmstead the herd stands at while it is on st.herdsAway (its `home` the grazing tile by that farm); absent otherwise.
  //   A herd standing away is listed by no household's herds: its animals are not milked, fed or worked by anyone until they are home.
  const away = (st) => st.herdsAway || [];
  function standAway(st, herd, owner, at) {
    herd.household = owner === null ? null : owner.id;
    herd.at = at;
    herd.home = homeTile(st, st.farmsteads[at]);
    herd.herder = null; // left by the farm where it stands
    herd.cull = [];
    if (!st.herdsAway) st.herdsAway = [];
    if (!st.herdsAway.includes(herd.id)) st.herdsAway.push(herd.id);
  }
  function unlist(st, herd) {
    delete herd.at;
    if (!st.herdsAway) return;
    st.herdsAway.splice(st.herdsAway.indexOf(herd.id), 1);
    if (!st.herdsAway.length) delete st.herdsAway;
  }
  // A herd of `to`'s of the species standing at farm `at`, made when there is none.
  function awayHerd(st, to, species, at) {
    for (const id of away(st)) {
      const hd = st.herds[id];
      if (hd.household === to.id && hd.species === species && hd.at === at) return hd;
    }
    const herd = makeHerd(st, to, species);
    to.herds.splice(to.herds.indexOf(herd.id), 1); // not by its farm: listed away, not by the household
    standAway(st, herd, to, at);
    return herd;
  }
  // The animals of `herd` join `hh`'s own herd of the species (made when it has none), and `herd` is emptied (kept with household null).
  function merge(st, herd, hh) {
    const dest = herdOf(st, hh, herd.species) || makeHerd(st, hh, herd.species);
    if (herd.species === 'cattle') {
      dest.head.push(...herd.head);
      herd.head = [];
    } else {
      dest.ewes += herd.ewes;
      dest.rams += herd.rams;
      dest.lambs += herd.lambs;
      herd.ewes = herd.rams = herd.lambs = 0;
    }
    herd.household = null;
    herd.cull = [];
    herd.herder = null;
  }
  const count = (hd) => (hd.species === 'cattle' ? hd.head.length : hd.ewes + hd.rams + hd.lambs);
  const sameFarm = (a, b) => a.farmstead !== null && a.farmstead === b.farmstead;
  // Hay that goes with animals from `from` to `to`: in the barn it was in, a load lying there for `to` to fetch (sim/lying, the kind
  // fetchHay), or straight into `to`'s barn when both live on one farm.
  function leaveHay(st, from, to, hay) {
    if (!(hay > 0)) return;
    if (sameFarm(from, to)) to.hay = (to.hay || 0) + hay;
    else
      Lying.leave(st, 'hay', hay / TRAVEL.hay, st.farmsteads[from.farmstead].house, { type: 'household', id: to.id });
  }

  // A household's herds go with its people when it ends or goes into trust: to the household `to` (an id), whose they are at once, standing
  // where they are until one of its members leads them home (at once when it lives on the same farm); its hay is left in the barn for `to`
  // to fetch. With nobody (null) they stay at the farm with no owner (frost). Its herds standing elsewhere pass to `to` where they stand.
  function passHerds(st, from, to) {
    const dest = to === null ? null : st.households[to];
    for (const herd of herdsOf(st, from)) {
      if (!count(herd)) {
        herd.household = null;
        herd.cull = [];
        herd.herder = null;
      } else if (dest && sameFarm(from, dest)) merge(st, herd, dest);
      else if (from.farmstead !== null) standAway(st, herd, dest, from.farmstead);
      else if (dest)
        merge(st, herd, dest); // a household with no farm has no byre to leave them in
      else herd.household = null;
    }
    for (const id of [...away(st)])
      if (st.herds[id].household === from.id) standAway(st, st.herds[id], dest, st.herds[id].at);
    if (dest && from.hay > 0) leaveHay(st, from, dest, from.hay);
    from.herds = [];
    from.hay = 0;
  }

  // Animals leave a household in shares (VB-140; design.md, Quanta and worth): a cow, an ox, a heifer, a steer or a ewe, by their customary worth
  // (Norms.norm). The old household is left a cow and its winter's hay (what the herd that stays eats over the stall period); the hay it
  // holds above that goes with the animal, up to the animal's own winter need, left lying in its barn for the new household to fetch.
  const cowsOf = (st, hh) =>
    herdsOf(st, hh).reduce((n, hd) => n + (hd.head ? hd.head.filter((h) => h.kind === 'cow').length : 0), 0);
  // Take one animal from `hh` to `to` ('cow', 'ox', 'heifer', 'steer' or 'ewe') when `hh` keeps a cow and its winter hay; true when moved.
  // It is `to`'s at once and stands at `hh`'s farm until led home; `led`: a member of `to` has led it home already (the kind `lead`).
  function giveAnimal(st, hh, to, kind, led) {
    const src = kind === 'ewe' ? herdOf(st, hh, 'sheep') : herdOf(st, hh, 'cattle');
    if (!src) return false;
    const idx = kind === 'ewe' ? (src.ewes > 0 ? 0 : -1) : src.head.findIndex((h) => h.kind === kind);
    if (idx < 0) return false;
    const need = HERD.hay[kind] * HERD.stallDays;
    if ((kind === 'cow' ? cowsOf(st, hh) - 1 : cowsOf(st, hh)) < 1 || hh.hay < winterNeed(st, hh) - need) return false;
    const species = kind === 'ewe' ? 'sheep' : 'cattle',
      home = led || sameFarm(hh, to) || hh.farmstead === null;
    const dest = home ? herdOf(st, to, species) || makeHerd(st, to, species) : awayHerd(st, to, species, hh.farmstead);
    if (kind === 'ewe') {
      src.ewes--;
      dest.ewes++;
    } else dest.head.push(...src.head.splice(idx, 1));
    // an animal marked for slaughter may be the one that went: the cull list names only animals still there (as sim/byre's tidy)
    const left = { ewe: src.ewes, ram: src.rams, lamb: src.lambs };
    src.cull = src.cull.filter((e) => (kind === 'ewe' ? left[e.sheep]-- > 0 : src.head.some((h) => h.id === e.head)));
    const hay = Math.min(Math.round(need), Math.floor(hh.hay - winterNeed(st, hh))); // winterNeed is now the herd that stays
    if (hay > 0) {
      hh.hay -= hay;
      leaveHay(st, hh, to, hay);
    }
    return true;
  }
  // A new household's start from its old one: a cow and two ewes. Returns the number of animals given.
  function startHerd(st, from, to) {
    let n = giveAnimal(st, from, to, 'cow') ? 1 : 0;
    for (let i = 0; i < SHARES.start.ewes; i++) if (giveAnimal(st, from, to, 'ewe')) n++;
    return n;
  }
  // Pay up to `due` rations of a share in animals to household `to`, the least valuable first, never past what is due. Returns the rations paid.
  // `to` is the sibling's own household: with none (null), a dissolved one or `from` itself, nothing is paid. `kinds`: the animals it may be
  // paid in, in that order (a cow led home in a deal or at a marriage is paid in its own kind, `led`; VB-390).
  function payInAnimals(st, from, to, due, kinds = ['ewe', 'heifer', 'steer', 'cow', 'ox'], led = false) {
    let paid = 0;
    if (!to || to.dissolved || to === from) return 0;
    for (const kind of kinds) {
      const worth = VB['sim/norms'].norm('worth', kind === 'ewe' ? 'sheep' : 'cattle/' + kind); // the one table of customary worth (VB-299)
      while (due - paid >= worth && giveAnimal(st, from, to, kind, led)) paid += worth;
    }
    return paid;
  }

  const plural = (n, one, many) => (n === 1 ? `a ${one}` : `${n} ${many}`);
  const what = (hd) =>
    hd.species === 'cattle'
      ? plural(hd.head.length, 'head of cattle', 'head of cattle')
      : plural(count(hd), 'sheep', 'sheep');
  // The herd is home: its animals join the household's herd (sim/kinds' `drove`, delivered at the barn).
  function ledHome(st, j, hh) {
    const herd = st.herds[j.herd];
    if (!herd || herd.at === undefined || herd.household !== hh.id) return;
    const from = st.farmsteads[herd.at],
      text = what(herd);
    unlist(st, herd);
    merge(st, herd, hh);
    log(st, `${st.farmsteads[hh.farmstead].name}: ${text} led home from ${from.name}.`, {
      kind: 'herdLed',
      ...atHousehold(st, hh),
    });
  }
  // The autumn frost (sim/clock): a herd standing with nobody to fetch it (no owner, or an owner with no farm) is taken in by the household
  // of the farm it stands at, or else is lost to the winter, named in the record.
  function frost(st) {
    for (const id of [...away(st)]) {
      const herd = st.herds[id],
        owner = herd.household === null ? null : st.households[herd.household];
      if (owner && owner.farmstead !== null) continue;
      const f = st.farmsteads[herd.at],
        keeper = f.household === null ? null : st.households[f.household];
      const text = what(herd),
        n = count(herd);
      unlist(st, herd);
      if (keeper && !keeper.dissolved) {
        merge(st, herd, keeper);
        log(st, `${f.name} takes in ${text} left there with nobody to keep them.`, {
          kind: 'herdLed',
          ...atHousehold(st, keeper),
        });
      } else {
        if (herd.species === 'cattle') herd.head = [];
        else herd.ewes = herd.rams = herd.lambs = 0;
        herd.household = null;
        log(
          st,
          `${text[0].toUpperCase() + text.slice(1)} left at ${f.name} with nobody to keep them were lost to the winter.`,
          {
            kind: 'herdDeath',
            n,
            ...atFarm(f),
          },
        );
      }
    }
  }
  // The kind `drove` (sim/kinds): a member walks to the farm where the household's herd stands and leads it home (no animal is in a byre it
  // was not led to). Posted at the household's farm for each of its herds standing away, in any season (its hay is fetched apart).
  const KIND = {
    verb: 'Haltering the animals',
    go: 'Going to fetch the animals',
    back: 'Leading the animals home',
    name: 'Fetch the animals',
    at: ['farm'],
    needs: ['cattle', 'sheep'],
    gives: ['cattle', 'sheep'],
    label: 'Fetching animals',
    anim: null,
    hours: 0.5,
    hands: 1,
    type: 'husbandry',
    carry: 'cow',
    to: 'barn',
    spot: (st, a, j) => [st.w.hx[j.site] - 20 + a.ox * 0.3, st.w.hy[j.site] + 5 + a.oy * 0.2], // by the byre door
    urgency: (st, j, c, U) => U.other,
    deliver: (st, j, hh) => ledHome(st, j, hh),
    available: (st, hh, f, c, post) => {
      for (const id of away(st)) {
        const hd = st.herds[id];
        if (hd.household === hh.id) post(`drove:H${id}`, st.farmsteads[hd.at].house, { farm: f, herd: id });
      }
    },
  };
  return { passHerds, startHerd, payInAnimals, frost, KIND };
})();
