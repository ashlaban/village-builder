// @sys sim/herds: households' cattle and sheep: the herds and their hay, breeding and ageing each spring, the herds of each scenario, handing on
VB['sim/herds'] = (() => {
  const { next: rnd } = VB['sim/rng'];
  const { B } = VB['gen'];
  const { DAY, YEAR, TICKS, HERD, SHARES } = VB['sim/rules'];
  const { log, atFarm } = VB['sim/records'];
  const { bfs, hexSteps } = VB['sim/hex'];
  const { walkable } = VB['sim/routes'];
  const { emit } = VB['sim/events'];
  // @state st.herds[]: {id, species 'cattle'|'sheep', household, home (tile where it grazes by the farm), head[] (cattle), ewes, rams, lambs
  //   (sheep), cull[] ({id, head (cattle id) or sheep 'ewe'|'ram'|'lamb', lean}: marked for slaughter), cullSeq, lean (stall days without
  //   fodder since the count), unfed (stall days running without full hay) (sim/byre)}; id = index, never reused; a herd emptied by a
  //   dissolved household is kept with household null (sim/herds)
  //   head[]: {id, name, sex 'f'|'m', born (game hours), kind 'calf'|'heifer'|'cow'|'bull'|'steer'|'ox', calved (game year a cow last
  //   calved, 1 first; absent before her first calf; VB-135)}
  // @state st.headSeq: number; counter for the ids of cattle heads
  // A household's herds are listed in hh.herds (herd ids); hh.hay is its hay in units, hh.larder its stored food (sim/hunger).
  const COWS = ['Stjärna', 'Rosa', 'Docka', 'Gullros', 'Blomma', 'Lilja', 'Svana', 'Stolta', 'Majros', 'Dagros', 'Fagerlin', 'Silverhorn',
    'Gullhorn', 'Krona', 'Rödkulla', 'Svärta', 'Brokros', 'Ljusa', 'Smörblomma', 'Hjärtros'];
  const BULLS = ['Brante', 'Bläsen', 'Stolt', 'Ståtlig', 'Raske', 'Bjälle', 'Prydler', 'Pålle', 'Dunder', 'Grålle', 'Svarten', 'Bråke', 'Rödingen',
    'Kalle'];
  // An animal's age in years, from whole 6-minute steps (VB-235): born is a whole hour (an older save's may have drifted, hence the round),
  // so an age of whole years is exact and compares with no tolerance.
  const years = (st, h) => (st.tick - Math.round(h.born * TICKS)) / (YEAR * TICKS);
  // A herd's daily hay in the byre, and a household's need for a whole stall period.
  function dailyHay(herd) {
    if (herd.species === 'sheep') return (herd.ewes + herd.rams) * HERD.hay.ewe + herd.lambs * HERD.hay.lamb;
    let n = 0; for (const h of herd.head) n += HERD.hay[h.kind]; return n;
  }
  const herdsOf = (st, hh) => hh.herds.map((id) => st.herds[id]);
  const householdHay = (st, hh) => herdsOf(st, hh).reduce((s, hd) => s + dailyHay(hd), 0);
  const winterNeed = (st, hh) => householdHay(st, hh) * HERD.stallDays;
  // In the byre: from autumn day 9 to spring day 5.
  const stalled = (c) => c.doy >= HERD.stall[0] || c.doy < HERD.stall[1];
  // Room the cattle take in the byre: a calf half a place.
  const byreRoom = (herd) => (herd.species === 'cattle' ? herd.head.reduce((s, h) => s + (h.kind === 'calf' ? 0.5 : 1), 0) : 0);
  const herdOf = (st, hh, species) => { for (const id of hh.herds) if (st.herds[id].species === species) return st.herds[id]; return null; };
  const houseOf = (st, herd) => st.farmsteads[st.households[herd.household].farmstead].house;
  // Where a farm's animals graze by day: the most open free tile within 2 steps of the house, not built on, not water, not a green.
  function homeTile(st, f) {
    const w = st.w, greens = new Set(st.villages.map((v) => v.center));
    let best = f.house, bs = -Infinity;
    for (const [t, d] of bfs(w, f.house, 2, walkable(w)).dist) {
      if (d < 1 || st.used.has(t) || w.water[t] || w.river[t] || greens.has(t)) continue;
      const s = (w.biome[t] === B.MEADOW || w.biome[t] === B.HEATH ? 1 : 0) - 0.3 * d;
      if (s > bs) { bs = s; best = t; }
    }
    return best;
  }
  function makeHerd(st, hh, species) {
    const herd = { id: st.herds.length, species, household: hh.id, home: homeTile(st, st.farmsteads[hh.farmstead]), cull: [], cullSeq: 0, lean: 0, unfed: 0 };
    if (species === 'cattle') herd.head = []; else { herd.ewes = 0; herd.rams = 0; herd.lambs = 0; }
    st.herds.push(herd); hh.herds.push(herd.id);
    return herd;
  }
  const herdFor = (st, hh, species) => herdOf(st, hh, species) || makeHerd(st, hh, species);
  // A new head of cattle, named for its sex with a name no other head of the village's herds has, while names last.
  function addHead(st, herd, sex, born, kind) {
    const v = st.farmsteads[st.households[herd.household].farmstead].village, taken = new Set();
    const villageOf = (hd) => st.farmsteads[st.households[hd.household].farmstead].village;
    for (const hd of st.herds) if (hd.head && hd.household !== null && villageOf(hd) === v) for (const h of hd.head) taken.add(h.name);
    const list = sex === 'f' ? COWS : BULLS, free = list.filter((n) => !taken.has(n));
    const pool = free.length ? free : list, name = pool[(rnd(st.rng.herds) * pool.length) | 0];
    const h = { id: st.headSeq++, name, sex, born, kind };
    herd.head.push(h);
    return h;
  }
  // Born on spring day 3, `age` years before year 1's.
  const bornAgo = (age) => HERD.springDay * DAY - age * YEAR;
  // Bulls of at least minAge (years) within reach of a farm's house, nearest first: [{herd, head}].
  function bullsNear(st, house, minAge = HERD.bullAge) {
    const out = [];
    for (const herd of st.herds) {
      if (herd.species !== 'cattle' || herd.household === null) continue;
      const d = hexSteps(st.w, house, houseOf(st, herd));
      if (d > HERD.reach) continue;
      for (const h of herd.head) if (h.kind === 'bull' && years(st, h) >= minAge) out.push({ herd, head: h, d });
    }
    return out.sort((a, b) => a.d - b.d || a.herd.id - b.herd.id || a.head.id - b.head.id);
  }
  const ramNear = (st, house) => st.herds.some((hd) => hd.species === 'sheep' && hd.household !== null && hd.rams > 0
    && hexSteps(st.w, house, houseOf(st, hd)) <= HERD.reach);
  const binom = (st, n, p) => { let k = 0; for (let i = 0; i < n; i++) if (rnd(st.rng.herds) < p) k++; return k; };

  // ---- spring: the animals age, the old and some others die, then cows calve and ewes lamb ----
  function ageCattle(st, herd) {
    const house = houseOf(st, herd);
    for (const h of herd.head) {
      const a = years(st, h);
      if (h.kind === 'calf' && a >= 1) {
        // a bull calf is kept as a bull when no bull within reach is young enough to serve for years; otherwise it is gelded
        if (h.sex === 'f') h.kind = 'heifer';
        else h.kind = bullsNear(st, house, 0).some((b) => years(st, b.head) < HERD.keepBullUnder) ? 'steer' : 'bull';
      } else if (h.kind === 'heifer' && a >= HERD.grown) h.kind = 'cow';
      else if (h.kind === 'steer' && a >= HERD.grown) h.kind = 'ox';
    }
  }
  function spring(st) {
    const born = new Map(); // household id -> {calves, lambs, died[]}
    const wintered = st.t >= YEAR; // in the game's first spring no animal has wintered here yet: none is lost over the winter
    const note = (hd) => { if (!born.has(hd.household)) born.set(hd.household, { calves: 0, lambs: 0, died: [] }); return born.get(hd.household); };
    for (const herd of st.herds) {
      if (herd.household === null) continue;
      if (herd.species === 'cattle') {
        ageCattle(st, herd);
        herd.head = herd.head.filter((h) => {
          const gone = years(st, h) >= HERD.maxAge || (wintered && h.kind !== 'calf' && rnd(st.rng.herds) < HERD.death.cattle);
          if (gone) note(herd).died.push(h.name);
          return !gone;
        });
      } else {
        // last year's lambs grow up: the ram lambs went at the autumn count (sim/byre), so they are ewes, but for one kept as the ram
        // when there is none within reach
        if (herd.lambs) { const ram = herd.rams || ramNear(st, houseOf(st, herd)) ? 0 : 1; herd.rams += ram; herd.ewes += herd.lambs - ram; herd.lambs = 0; }
        const ewes = wintered ? binom(st, herd.ewes, HERD.death.sheep) : 0, rams = wintered ? binom(st, herd.rams, HERD.death.sheep) : 0;
        herd.ewes -= ewes; herd.rams -= rams;
        if (ewes) note(herd).died.push(ewes === 1 ? 'a ewe' : `${ewes} ewes`);
        if (rams) note(herd).died.push(rams === 1 ? 'a ram' : `${rams} rams`);
      }
    }
    for (const herd of st.herds) {
      if (herd.household === null) continue;
      const hh = st.households[herd.household], house = houseOf(st, herd);
      if (herd.species === 'cattle') {
        const bulls = bullsNear(st, house), own = bulls.find((b) => b.herd === herd), bull = own || bulls[0];
        if (!bull) continue;
        let calves = 0;
        for (const cow of herd.head.filter((h) => h.kind === 'cow')) {
          if (rnd(st.rng.herds) >= HERD.calve) continue;
          cow.calved = Math.floor(st.t / YEAR) + 1; // in milk this summer, whether or not the calf lives (VB-135)
          const sex = rnd(st.rng.herds) < 0.5 ? 'f' : 'm';
          if (rnd(st.rng.herds) < HERD.calfDeath) continue;
          addHead(st, herd, sex, st.t, 'calf'); calves++;
        }
        if (!calves) continue;
        note(herd).calves += calves;
        // the cows were taken to another farm's bull: a favour remembered
        const other = st.households[bull.herd.household];
        if (bull.herd !== herd && st.cenv && hh.holder !== null && other.holder !== null && other.holder !== hh.holder) {
          emit(st, 'bullLent', { borrower: hh.holder, lender: other.holder });
        }
      } else {
        if (!herd.ewes || !(herd.rams > 0 || ramNear(st, house))) continue;
        let lambs = 0;
        for (let e = 0; e < herd.ewes; e++) {
          if (rnd(st.rng.herds) >= HERD.lamb) continue;
          const n = rnd(st.rng.herds) < HERD.twins ? 2 : 1;
          for (let k = 0; k < n; k++) if (rnd(st.rng.herds) >= HERD.lambDeath) lambs++;
        }
        herd.lambs += lambs; note(herd).lambs += lambs;
      }
    }
    for (const [hid, b] of born) {
      const f = st.farmsteads[st.households[hid].farmstead], parts = [];
      if (b.calves) parts.push(`${b.calves} ${b.calves === 1 ? 'calf' : 'calves'}`);
      if (b.lambs) parts.push(`${b.lambs} ${b.lambs === 1 ? 'lamb' : 'lambs'}`);
      if (parts.length) log(st, `${f.name}: ${parts.join(' and ')} born this spring.`, {
        kind: 'herdBirths', n: (b.calves || 0) + (b.lambs || 0), ...atFarm(f) });
      const d = b.died, lost = d.length > 1 ? `${d.slice(0, -1).join(', ')} and ${d[d.length - 1]}` : d[0];
      if (d.length) log(st, `${f.name} lost ${lost} over the winter.`, { kind: 'herdDeath', n: d.length, ...atFarm(f) });
    }
  }
  // Once a game day, at its start (sim/clock): the spring round, and a new grazing spot for a herd whose old one was built on.
  function herdsDay(st, c) {
    for (const herd of st.herds) {
      if (herd.household !== null && st.used.has(herd.home)) herd.home = homeTile(st, st.farmsteads[st.households[herd.household].farmstead]);
    }
    if (c.doy === HERD.springDay) spring(st);
  }

  // ---- the herds each scenario starts with ----
  // Founders (Kim, 30 Oct): three farms keep 2 cows each, the first also a bull and the group's one pair of oxen; the first two keep 4 ewes,
  // the first also a ram; the lone farm keeps none.
  function foundersHerds(st) {
    const hhs = st.households.filter((h) => !h.dissolved), lone = (h) => st.villages[st.farmsteads[h.farmstead].village].farmsteads.length < 2;
    const keep = hhs.filter((h) => !lone(h)).slice(0, 3);
    keep.forEach((hh, k) => {
      const cattle = makeHerd(st, hh, 'cattle');
      for (let c = 0; c < 2; c++) addHead(st, cattle, 'f', bornAgo(4 + ((rnd(st.rng.herds) * 5) | 0)), 'cow');
      if (k === 0) { addHead(st, cattle, 'm', bornAgo(4), 'bull'); addHead(st, cattle, 'm', bornAgo(5), 'ox'); addHead(st, cattle, 'm', bornAgo(6), 'ox'); }
      if (k < 2) { const sheep = makeHerd(st, hh, 'sheep'); sheep.ewes = 4; sheep.rams = k === 0 ? 1 : 0; }
    });
    startHay(st, HERD.stall[1] + HERD.stallDays);
  }
  // Populous: 3 in 4 farms keep cattle (2 to 4 cows by household size, a heifer at half of them), half keep 4 to 8 ewes; in each village the
  // farm with most cows keeps the bull and the one with most ewes the ram; a farm of 3 or more cows keeps a pair of oxen if the byre has room.
  function populousHerds(st) {
    for (const v of st.villages) {
      const hhs = v.farmsteads.map((id) => st.farmsteads[id]).filter((f) => f.household !== null).map((f) => st.households[f.household]);
      for (const hh of hhs) {
        const n = hh.members.length;
        if (rnd(st.rng.herds) < 0.75) {
          const cattle = makeHerd(st, hh, 'cattle'), cows = n <= 5 ? 2 : n <= 7 ? 3 : 4;
          for (let c = 0; c < cows; c++) addHead(st, cattle, 'f', bornAgo(3 + ((rnd(st.rng.herds) * 8) | 0)), 'cow');
          if (rnd(st.rng.herds) < 0.5) addHead(st, cattle, 'f', bornAgo(1 + ((rnd(st.rng.herds) * 2) | 0)), 'heifer');
        }
        if (rnd(st.rng.herds) < 0.5) { const sheep = makeHerd(st, hh, 'sheep'); sheep.ewes = 4 + ((rnd(st.rng.herds) * 5) | 0); }
      }
      const most = (species, size) => hhs.map((hh) => herdOf(st, hh, species)).filter(Boolean).sort((a, b) => size(b) - size(a) || a.id - b.id)[0];
      const cows = (hd) => hd.head.filter((h) => h.kind === 'cow').length;
      const bullHerd = most('cattle', cows);
      if (bullHerd) addHead(st, bullHerd, 'm', bornAgo(3 + ((rnd(st.rng.herds) * 5) | 0)), 'bull'); // at most 4 cows and a heifer: the byre has room
      const ramHerd = most('sheep', (hd) => hd.ewes);
      if (ramHerd) ramHerd.rams = 1;
      for (const hh of hhs) {
        const cattle = herdOf(st, hh, 'cattle');
        if (cattle && cows(cattle) >= 3 && byreRoom(cattle) + 2 <= HERD.byre) {
          addHead(st, cattle, 'm', bornAgo(4 + ((rnd(st.rng.herds) * 4) | 0)), 'ox');
            addHead(st, cattle, 'm', bornAgo(4 + ((rnd(st.rng.herds) * 4) | 0)), 'ox');
        }
      }
    }
    startHay(st, HERD.stall[1]);
  }
  // Heirs: the established farms by their size; village B's first farm and A1 keep the bulls, rams and oxen.
  function heirsHerds(st, plan) {
    for (const [hid, cows, heifers, bull, ewes] of plan) {
      const hh = st.households[hid];
      if (cows) {
        const cattle = makeHerd(st, hh, 'cattle');
        for (let c = 0; c < cows; c++) addHead(st, cattle, 'f', bornAgo(4 + c * 2), 'cow');
        for (let c = 0; c < heifers; c++) addHead(st, cattle, 'f', bornAgo(2), 'heifer');
        if (bull) { addHead(st, cattle, 'm', bornAgo(5), 'bull'); addHead(st, cattle, 'm', bornAgo(6), 'ox'); addHead(st, cattle, 'm', bornAgo(7), 'ox'); }
      }
      if (ewes) { const sheep = makeHerd(st, hh, 'sheep'); sheep.ewes = ewes; sheep.rams = bull ? 1 : 0; }
    }
    startHay(st, HERD.stall[1]);
  }
  // Hay in the barn for `days` stall days, with a margin.
  function startHay(st, days) { for (const hh of st.households) if (!hh.dissolved) hh.hay = Math.round(householdHay(st, hh) * days * HERD.startMargin); }

  // A dissolved household's herds go with its people: to the household `to`, merged into its herd of the same species; with none, they are lost.
  function passHerds(st, from, to) {
    for (const herd of herdsOf(st, from)) {
      if (to !== null) {
        const dest = herdFor(st, st.households[to], herd.species);
        if (herd.species === 'cattle') dest.head.push(...herd.head);
        else { dest.ewes += herd.ewes; dest.rams += herd.rams; dest.lambs += herd.lambs; }
      }
      if (herd.species === 'cattle') herd.head = []; else herd.ewes = herd.rams = herd.lambs = 0;
      herd.household = null; herd.cull = [];
    }
    if (to !== null && from.hay > 0) st.households[to].hay += from.hay;
    from.herds = []; from.hay = 0;
  }

  // Animals leave a household in shares (VB-140; design.md, Quanta and worth): a cow, an ox, a heifer, a steer or a ewe, by their customary worth
  // (Culture.norm).
  // The old household is left a cow and its winter's hay (what the herd that stays eats over the stall period); the hay it holds above that
  // goes with the animal, up to the animal's own winter need.
  const cowsOf = (st, hh) => herdsOf(st, hh).reduce((n, hd) => n + (hd.head ? hd.head.filter((h) => h.kind === 'cow').length : 0), 0);
  // Take one animal from `hh` to `to` ('cow', 'ox', 'heifer', 'steer' or 'ewe') when `hh` keeps a cow and its winter hay; true when moved.
  function giveAnimal(st, hh, to, kind) {
    const from = kind === 'ewe' ? herdOf(st, hh, 'sheep') : herdOf(st, hh, 'cattle');
    if (!from) return false;
    const idx = kind === 'ewe' ? (from.ewes > 0 ? 0 : -1) : from.head.findIndex((h) => h.kind === kind);
    if (idx < 0) return false;
    const need = HERD.hay[kind] * HERD.stallDays;
    if ((kind === 'cow' ? cowsOf(st, hh) - 1 : cowsOf(st, hh)) < 1 || hh.hay < winterNeed(st, hh) - need) return false;
    const dest = herdFor(st, to, kind === 'ewe' ? 'sheep' : 'cattle');
    if (kind === 'ewe') { from.ewes--; dest.ewes++; } else dest.head.push(...from.head.splice(idx, 1));
    // an animal marked for slaughter may be the one that went: the cull list names only animals still there (as sim/byre's tidy)
    const left = { ewe: from.ewes, ram: from.rams, lamb: from.lambs };
    from.cull = from.cull.filter((e) => (kind === 'ewe' ? left[e.sheep]-- > 0 : from.head.some((h) => h.id === e.head)));
    const hay = Math.min(Math.round(need), Math.floor(hh.hay - winterNeed(st, hh))); // winterNeed is now the herd that stays
    if (hay > 0) { hh.hay -= hay; to.hay = (to.hay || 0) + hay; }
    return true;
  }
  // A new household's start from its old one: a cow and two ewes. Returns the number of animals moved.
  function startHerd(st, from, to) {
    let n = giveAnimal(st, from, to, 'cow') ? 1 : 0;
    for (let i = 0; i < SHARES.start.ewes; i++) if (giveAnimal(st, from, to, 'ewe')) n++;
    return n;
  }
  // Pay up to `due` rations of a share in animals to household `to`, the least valuable first, never past what is due. Returns the rations paid.
  // `to` is the sibling's own household: with none (null), a dissolved one or `from` itself, nothing is paid.
  function payInAnimals(st, from, to, due) {
    let paid = 0;
    if (!to || to.dissolved || to === from) return 0;
    for (const kind of ['ewe', 'heifer', 'steer', 'cow', 'ox']) {
      const worth = VB['culture'].norm('worth', kind === 'ewe' ? 'sheep' : 'cattle/' + kind); // the one table of customary worth (VB-299)
      while (due - paid >= worth && giveAnimal(st, from, to, kind)) paid += worth;
    }
    return paid;
  }

  // Whether the household has a team (team(st, hh) !== null), without making the list: read every step a ploughman works (VB-205).
  function hasTeam(st, hh) {
    let n = 0;
    for (const id of hh.herds) {
      const hd = st.herds[id]; if (hd.species !== 'cattle') continue;
      for (const h of hd.head) if (h.kind === 'ox' && ++n >= HERD.team.oxen) return true;
    }
    return n >= HERD.team.oxen;
  }
  // The household's team (VB-138): its two oldest oxen, or null without two.
  function team(st, hh) {
    const oxen = herdsOf(st, hh).flatMap((hd) => (hd.species === 'cattle' ? hd.head.filter((h) => h.kind === 'ox') : []));
    return oxen.length >= HERD.team.oxen ? oxen.sort((a, b) => a.born - b.born || a.id - b.id).slice(0, HERD.team.oxen) : null;
  }
  // Cows in milk now (VB-135): those that calved this spring, while the herds are out of the byre.
  const inMilk = (st, herd, c) => (herd.species !== 'cattle' || stalled(c) ? []
    : herd.head.filter((h) => h.kind === 'cow' && h.calved === Math.floor(st.t / YEAR) + 1));
  const milkCows = (st, hh, c) => herdsOf(st, hh).reduce((s, hd) => s + inMilk(st, hd, c).length, 0);
  // ---- words, for the panels and the reports ----
  const plural = (n, one, many) => (n === 1 ? `a ${one}` : `${n} ${many}`);
  function describeHerds(st, hh) {
    const out = [];
    for (const herd of herdsOf(st, hh)) {
      if (herd.species === 'cattle') {
        const by = (k) => herd.head.filter((h) => h.kind === k), parts = [];
        const cows = by('cow'), bulls = by('bull'), oxen = by('ox');
        if (cows.length) parts.push(`${cows.length === 1 ? 'a cow' : `${cows.length} cows`} (${cows.map((h) => h.name).join(', ')})`);
        for (const b of bulls) parts.push(`the bull ${b.name}`);
        if (oxen.length) parts.push(`${oxen.length === 1 ? 'an ox' : `${oxen.length} oxen`} (${oxen.map((h) => h.name).join(', ')})`);
        for (const [k, one, many] of [['heifer', 'heifer', 'heifers'], ['steer', 'steer', 'steers'], ['calf', 'calf', 'calves']]) {
          if (by(k).length) parts.push(plural(by(k).length, one, many));
        }
        if (parts.length) out.push(`Cattle: ${parts.join(', ')}`);
      } else {
        const parts = [];
        if (herd.ewes) parts.push(plural(herd.ewes, 'ewe', 'ewes'));
        if (herd.rams) parts.push(plural(herd.rams, 'ram', 'rams'));
        if (herd.lambs) parts.push(plural(herd.lambs, 'lamb', 'lambs'));
        if (parts.length) out.push(`Sheep: ${parts.join(', ')}`);
      }
    }
    return out.join(' · ');
  }
  // A plain record of a household's herds, for tools/sim.js --report herds.
  function herdReport(st, hh) {
    return {
      household: hh.id, farm: st.farmsteads[hh.farmstead].name, hay: Math.round(hh.hay), winterNeed: Math.round(winterNeed(st, hh)),
      herds: herdsOf(st, hh).map((hd) => (hd.species === 'cattle'
        ? { species: 'cattle', head: hd.head.map((h) => ({ name: h.name, kind: h.kind, sex: h.sex, age: Math.floor(years(st, h)) })) }
        : { species: 'sheep', ewes: hd.ewes, rams: hd.rams, lambs: hd.lambs })),
      text: describeHerds(st, hh), cull: herdsOf(st, hh).reduce((s, hd) => s + hd.cull.length, 0),
      larder: Object.fromEntries(['meat', 'salt meat', 'milk', 'butter']
        .map((k) => [k, Math.round(hh.larder.reduce((s, l) => s + (l.kind === k ? l.n : 0), 0))])),
      // rations of fresh milk and of butter made since the start of this game year (VB-135), from the stores' yearly totals (VB-204)
      ...Object.fromEntries(['milk', 'butter'].map((k) => [k + 'Year', +hh.totals.filter((x) => x.kind === k && x.year === Math.floor(st.t / YEAR) + 1)
        .reduce((s, x) => s + x.n, 0).toFixed(1)])),
    };
  }
  return {
    COWS, BULLS, years, dailyHay, herdsOf, householdHay, winterNeed, stalled, byreRoom, herdOf, homeTile, makeHerd, addHead, bullsNear, ramNear,
    spring, herdsDay, foundersHerds, populousHerds, heirsHerds, startHay, passHerds, startHerd, payInAnimals,
    team, hasTeam, inMilk, milkCows, describeHerds, herdReport,
  };
})();
