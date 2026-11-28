// @sys sim/byre [material]: daily barn hay and spoilage, fodder, the autumn count and the head's verb cull (VB-679), slaughter, milk where the herd
// is, shearing at the fold, and hunger in the byre
VB['sim/byre'] = (() => {
  // The kinds of event it writes on the record (sim/eventkinds, VB-1946).
  VB['sim/eventkinds'].eventKinds('sim/byre', {
    slaughter: { keep: 'generation' },
    spoiled: { keep: 'generation' },
    cattleInCrop: { keep: 'generation' },
  });
  const Stores = VB['sim/stores'],
    { dayLoss } = VB['sim/goods'];
  const { next: rnd } = VB['sim/rng'];
  const { HERD, FOODS, WORK, DAY, YEAR_DAYS, BUILD, cal } = VB['sim/rules'],
    { SOIL } = VB['sim/crops'];
  const Rules = VB['sim/registry'],
    Norms = VB['sim/norms'],
    { inForce } = VB['sim/customs'];
  const { log, atFarm, atHousehold } = VB['sim/records'];
  const { addFood, larderOf, takeAll, spoilFood } = VB['sim/larder'];
  const { herdsOf, dailyHay, winterNeed, stalled, years, bullsNear, inMilk, milkCows } = VB['sim/herds'];
  const { unherded, milkFactor, unshorn } = VB['sim/grazing'];
  const { hexSteps } = VB['sim/hex'];
  const { trample } = VB['sim/fields'];
  const { emit } = VB['sim/events'];
  const Targets = VB['sim/targets'];
  const { register, issue } = VB['sim/commands'];
  const { living } = VB['sim/records'];
  // A herd's cull[]: animals to slaughter, {id (within the herd), head (cattle head id) or sheep ('ewe'|'ram'|'lamb') and lot (how many
  // of them, VB-1682), lean}; herd.cullSeq numbers them. herd.lean counts stall days without fodder since the last count; herd.unfed stall
  // days running without full hay (VB-134).

  // Stall days still to come after the day c, while in the byre.
  const stallLeft = (c) =>
    !stalled(c) ? 0 : c.doy >= HERD.stall[0] ? 47 - c.doy + HERD.stall[1] : HERD.stall[1] - 1 - c.doy;
  // ---- need (VB-299; design.md, The fair: Need): an animal is worth 1.5 times its customary worth to a household with none of its kind (the
  // same kind of cattle; any sheep), its worth otherwise, and nothing if the household's hay will not carry it through the winter: the stall
  // days still to come, or a whole stall period outside it. Giving one up costs what taking it back would bring. Allocates nothing. ----
  const ANIMAL = { none: 1.5 };
  // A lot of sheep marked for slaughter stands as at most this many slaughter jobs at once, each of one animal (VB-1682).
  const SLAUGHTER = { atOnce: 6 };
  function headsOf(st, hh, good) {
    let n = 0;
    for (const id of hh.herds) {
      const hd = st.herds[id];
      if (hd.species !== good.kind) continue;
      if (hd.species === 'sheep') n += hd.ewes + hd.rams + hd.lambs;
      else for (const h of hd.head) if (h.kind === good.subtype) n++;
    }
    return n;
  }
  Rules.contribute({
    rule: 'need',
    source: 'sim/byre',
    key: 'animal',
    label: 'An animal, and hay for the winter',
    tunables: ['HERD.hay', 'HERD.stall'],
    value: (st, c) => {
      const kind = c.good.kind;
      if ((kind !== 'cattle' && kind !== 'sheep') || c.n === 0) return 0;
      const doy = Math.floor(st.t / DAY) % YEAR_DAYS,
        inByre = doy >= HERD.stall[0] || doy < HERD.stall[1];
      const left = !inByre
        ? HERD.stallDays
        : doy >= HERD.stall[0]
          ? YEAR_DAYS - 1 - doy + HERD.stall[1]
          : HERD.stall[1] - 1 - doy;
      const hay = kind === 'sheep' ? HERD.hay.ewe : HERD.hay[c.good.subtype],
        worth = Norms.norm('worth', c.good.id);
      let daily = 0;
      for (const id of c.hh.herds) daily += dailyHay(st.herds[id]);
      const heads = headsOf(st, c.hh, c.good),
        k = Math.abs(c.n),
        sign = c.n > 0 ? 1 : -1;
      let v = 0;
      for (let i = 0; i < k; i++) {
        const after = c.n > 0 ? daily + (i + 1) * hay : daily - i * hay; // the herd's day of hay with this head
        if (c.hh.hay < after * left) break; // hay short: this head, and every further one, is worth nothing to keep
        v += (c.n > 0 ? heads + i === 0 : heads - 1 - i === 0) ? ANIMAL.none * worth : worth;
      }
      return sign * v;
    },
  });
  const houseOf = (st, hh) => st.farmsteads[hh.farmstead].house;
  const marked = (herd, head) => (herd.cull || []).some((e) => e.head === head.id);
  // The breeding male a farm relies on: the youngest bull of a year or more within reach not already marked for slaughter (an older one
  // goes once a young one can follow it), and whether another farm's ram, or a second ram of the herd, is within reach.
  function keptBull(st, house) {
    const live = bullsNear(st, house, 1).filter((b) => !marked(b.herd, b.head));
    return live.sort((a, b) => b.head.born - a.head.born || a.head.id - b.head.id)[0] || null;
  }
  const otherRam = (st, herd, house) =>
    st.herds.some(
      (hd) =>
        hd !== herd &&
        hd.species === 'sheep' &&
        hd.household !== null &&
        hd.rams > 0 &&
        hexSteps(st.w, house, houseOf(st, st.households[hd.household])) <= HERD.reach,
    );
  // The household's animals not yet marked for slaughter, least valuable first: {herd, head or sheep, n, hay (a stall day, of one), room
  // (in the byre, of one), value}: a head of cattle one entry (n 1), the sheep of a kind one entry of n (VB-1682: as many entries as kinds,
  // not as animals, so that a cull is linear in the entries, not the flock). Order (Agreed, 31 Oct): rams and bulls not needed, ewe lambs,
  // ewes, heifer calves, bull calves, heifers, steers, cows (oldest first), the bull the farms rely on, the only ram in reach, oxen last.
  function animals(st, hh, all = false) {
    // all: those marked for slaughter too
    const out = [],
      house = houseOf(st, hh),
      H = HERD.hay,
      bull = keptBull(st, house);
    for (const herd of herdsOf(st, hh)) {
      if (herd.species === 'cattle') {
        for (const h of herd.head) {
          if (!all && marked(herd, h)) continue;
          let v = {
            calf: h.sex === 'f' ? 3 : 3.5,
            heifer: 4,
            steer: 4.5,
            cow: 5 + Math.max(0, 12 - years(st, h)) / 20,
            ox: 7,
          }[h.kind];
          if (h.kind === 'bull') v = bull && bull.head === h ? 6 : 0.5;
          out.push({ herd, head: h, n: 1, hay: H[h.kind], room: h.kind === 'calf' ? 0.5 : 1, value: v });
        }
      } else {
        const n = { ewe: herd.ewes, ram: herd.rams, lamb: herd.lambs };
        if (!all) for (const e of herd.cull || []) n[e.sheep] -= e.lot;
        const only = !otherRam(st, herd, house) && n.ram > 0 ? 1 : 0;
        const lot = (sheep, k, value) => {
          if (k > 0) out.push({ herd, sheep, n: k, hay: H[sheep], room: 0, value });
        };
        lot('lamb', n.lamb, 1);
        lot('ewe', n.ewe, 2);
        lot('ram', only, 6);
        lot('ram', n.ram - only, 0.5);
      }
    }
    return out.sort((x, y) => x.value - y.value);
  }
  // Marks a head of cattle, or n sheep of a kind, for slaughter: one entry.
  function cullOne(a, lean, n = 1) {
    const herd = a.herd;
    herd.cull.push(
      a.head ? { id: herd.cullSeq++, head: a.head.id, lean } : { id: herd.cullSeq++, sheep: a.sheep, lot: n, lean },
    );
  }
  // How many of a lot of animals (an entry of `animals`) bring `need` down to `have`, each taking `unit` off it: at least 1, at most the lot.
  const enough = (a, need, have, unit) => Math.max(1, Math.min(a.n, Math.ceil((need - have) / unit)));
  // Words for the log: "Rosa, an old ewe and 3 ram lambs", from a Map of words to how many.
  const PLURAL = {
    'a lamb': 'lambs',
    'a ram lamb': 'ram lambs',
    'an old ewe': 'old ewes',
    'a ewe': 'ewes',
    'a ram': 'rams',
  };
  function listWords(n) {
    const parts = [...n].map(([x, k]) => (k === 1 ? x : `${k} ${PLURAL[x] || x}`));
    return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  }
  // The option of the custom `stocking` in force in the household's village, a key of HERD.margins (its head counts; the custom is his norm).
  const marginOf = (st, hh) => inForce(st, 'stocking', st.farmsteads[hh.farmstead].village);
  // The autumn count (autumn day 8): old animals go; bulls and rams not needed for breeding go; male young beyond the oxen's replacements
  // and a future bull go; half the lambs, the ram lambs, go; then, while the hay (with what still lies mown on the meadows) cannot carry the
  // winter's need × margin, or the byre is over full, the least valuable animal goes.
  function autumnCount(st, hh) {
    const f = st.farmsteads[hh.farmstead],
      house = houseOf(st, hh),
      names = new Map();
    let gone = 0;
    for (const herd of herdsOf(st, hh)) {
      herd.cull = [];
      herd.lean = 0;
    }
    const go = (a, word, k = a.n) => {
      cullOne(a, false, k);
      const w = a.head ? a.head.name : word || `a ${a.sheep}`;
      names.set(w, (names.get(w) || 0) + k);
      gone += k;
    };
    let list = animals(st, hh);
    let replacements = Math.max(0, 2 - list.filter((a) => a.head && a.head.kind === 'ox').length);
    let futureBull = bullsNear(st, house, 0).some((b) => years(st, b.head) < HERD.keepBullUnder);
    for (const a of list) {
      const h = a.head;
      if (h) {
        if (HERD.old[h.kind] && years(st, h) >= HERD.old[h.kind] && !(h.kind === 'bull' && a.value >= 6))
          go(a); // the farms' only bull stays
        else if (h.kind === 'bull' && a.value < 1) go(a);
        else if (h.kind === 'steer' || (h.kind === 'calf' && h.sex === 'm')) {
          if (h.kind === 'calf' && !futureBull) futureBull = true;
          else if (replacements > 0) replacements--;
          else go(a);
        }
      } else if (a.sheep === 'ram' && a.value < 1) go(a);
      else if (a.sheep === 'ewe') {
        let old = 0;
        for (let k = 0; k < a.n; k++) if (rnd(st.rng.herds) < HERD.oldEwe) old++;
        if (old) go(a, 'an old ewe', old);
      }
    }
    for (const herd of herdsOf(st, hh)) {
      if (herd.species !== 'sheep') continue;
      let males = Math.round(herd.lambs / 2);
      if (males && !herd.rams && !otherRam(st, herd, house)) males--; // a ram lamb is kept to serve the ewes
      if (males > 0) go({ herd, sheep: 'lamb' }, 'a ram lamb', males);
    }
    const hay = hh.hay + f.meadows.reduce((s, m) => s + (m.stage === 'mown' ? m.held : 0), 0);
    list = animals(st, hh);
    const margin = HERD.margins[marginOf(st, hh)];
    let need = list.reduce((s, a) => s + a.hay * a.n, 0) * HERD.stallDays * margin,
      room = list.reduce((s, a) => s + a.room * a.n, 0);
    while (list.length && (need > hay + 1e-6 || room > HERD.byre)) {
      const short = need > hay + 1e-6,
        i = short ? 0 : list.findIndex((a) => a.room > 0),
        a = list[i],
        unit = a.hay * HERD.stallDays * margin,
        k = short ? enough(a, need, hay + 1e-6, unit) : 1; // a lot of sheep has no room in the byre: room culls cattle, one at a time
      if (k === a.n) list.splice(i, 1);
      else a.n -= k;
      need -= unit * k;
      room -= a.room * k;
      go(a, undefined, k);
    }
    if (gone)
      log(st, `The autumn count at ${f.name}: ${listWords(names)} ${gone === 1 ? 'goes' : 'go'} to slaughter.`, {
        kind: 'slaughter',
        n: gone,
        ...atFarm(f),
      });
  }
  // When the hay left will not last the stall days to come, the household slaughters at once what it must; that meat is lean.
  function emergency(st, hh, c) {
    const left = stallLeft(c);
    if (!left) return;
    const list = animals(st, hh);
    let need = list.reduce((s, a) => s + a.hay * a.n, 0) * left,
      n = 0;
    for (let i = 0; i < list.length && need > hh.hay; i++) {
      const a = list[i],
        k = enough(a, need, hh.hay, a.hay * left); // a lot of sheep by its count (VB-1682), not one entry an animal
      need -= a.hay * left * k;
      cullOne(a, true, k);
      n += k;
    }
    if (n)
      log(
        st,
        `Hay runs short at ${st.farmsteads[hh.farmstead].name}: ${n === 1 ? 'an animal' : `${n} animals`} must be slaughtered now.`,
        {
          kind: 'slaughter',
          n,
          ...atHousehold(st, hh),
        },
      );
  }
  // The cull lists hold only animals that are still there.
  function tidy(herd) {
    if (herd.species === 'cattle') {
      const ids = new Set(herd.head.map((h) => h.id));
      herd.cull = herd.cull.filter((e) => ids.has(e.head));
      return;
    }
    const n = { ewe: herd.ewes, ram: herd.rams, lamb: herd.lambs };
    for (const e of herd.cull) {
      e.lot = Math.min(e.lot, n[e.sheep]);
      n[e.sheep] -= e.lot;
    }
    herd.cull = herd.cull.filter((e) => e.lot > 0);
  }
  // An animal of the herd dies or is slaughtered: it leaves the herd. Returns its kind, or null when it is no longer there.
  function remove(herd, e) {
    if (e.head !== undefined) {
      const i = herd.head.findIndex((h) => h.id === e.head);
      if (i < 0) return null;
      return herd.head.splice(i, 1)[0].kind;
    }
    const k = e.sheep + 's';
    if (!(herd[k] > 0)) return null;
    herd[k]--;
    return e.sheep;
  }
  // The slaughter is done: the animal (one of a lot of sheep) leaves the herd, its meat goes into the larder fresh; a beast of the cattle
  // gives its hide too, for leather (VB-911, sim/leather: the kind declared it, and nothing took it).
  function slaughterDone(st, herd, entry, hh) {
    const i = herd.cull.indexOf(entry);
    if (i < 0) return;
    const e = herd.cull[i];
    if (e.sheep === undefined || --e.lot <= 0) herd.cull.splice(i, 1);
    const kind = remove(herd, e),
      n = kind ? HERD.meat[kind] * (e.lean ? HERD.lean : 1) : 0;
    if (kind) {
      addFood(st, hh, 'meat', n);
      Stores.record(st, hh, 'meat', n, 'meat');
      if (herd.species === 'cattle') Stores.put(st, hh, 'hide', 1, 'slaughter');
    }
  }
  // Milked (VB-135): each cow in milk gives HERD.milk rations, less for the lean days of the winter, and half after a grazing day by the
  // farm with no herder (VB-136: milked in the morning, the cows give what yesterday's grazing made); part is churned to butter that keeps,
  // the rest is drunk fresh within the day; no more is churned than brings the butter held to its head's target (VB-698; by default all).
  function milkDone(st, hh, c, j = null) {
    let cows = 0,
      lost = 0,
      elsewhere = false;
    const f = milkFactor(st, hh); // a crowded pasture lowers the milk (VB-709, sim/grazing)
    for (const herd of herdsOf(st, hh)) {
      // a herd is milked where it is (VB-679): one that went out to pasture, or came home, since the job was posted waits for the next
      if (j && !milkedAt(herd, j)) {
        if (inMilk(st, herd, c).length || inMilkEwes(st, herd, c)) elsewhere = true;
        continue;
      }
      const un = unherded(st, herd, c),
        n =
          (inMilk(st, herd, c).length + inMilkEwes(st, herd, c) * (HERD.eweMilk / HERD.milk)) *
          (1 - Math.min(HERD.leanMax, HERD.leanPer * herd.lean)) *
          (un ? HERD.herding.milk : 1);
      cows += n * (un ? 1 : f);
      if (!un) lost += n * (1 - f);
    }
    if (!elsewhere) hh.milkDay = c.day;
    if (lost > 0) Stores.record(st, hh, 'milk', lost * HERD.milk, 'milkbite');
    const r = cows * HERD.milk,
      butter = Math.max(0, Math.min(r * HERD.butter, Targets.target(st, hh, 'butter') - larderOf(hh, 'butter')));
    if (r <= 0) return;
    addFood(st, hh, 'milk', r - butter);
    addFood(st, hh, 'butter', butter);
    Stores.record(st, hh, 'milk', r - butter, 'milk');
    Stores.record(st, hh, 'butter', butter, 'butter');
  }
  // Butter and salt meat as made goods (VB-698): what the milk and the meat give, with no cap by default (Infinity); a head's target caps
  // the churning, the rest drunk fresh, and the salting, the fresh meat left to be eaten or spoil. Their top bound: what is held, and
  // what the cows give over the butter's keeping days, or the fresh meat and the herds' carcasses.
  const cattleOf = (hd) => (hd.species === 'cattle' ? hd.head : []);
  Targets.made({
    good: 'butter',
    unit: 'ration',
    whole: false,
    need: () => Infinity,
    most: (st, hh) => {
      let cows = 0;
      for (const id of hh.herds) for (const h of cattleOf(st.herds[id])) if (h.kind === 'cow') cows++;
      return Math.ceil(larderOf(hh, 'butter') + cows * HERD.milk * HERD.butter * HERD.butterDays);
    },
    held: (st, hh) => larderOf(hh, 'butter'),
  });
  Targets.made({
    good: 'salt meat',
    unit: 'ration',
    whole: false,
    need: () => Infinity,
    most: (st, hh) => {
      let n = larderOf(hh, 'salt meat') + larderOf(hh, 'meat');
      for (const id of hh.herds) {
        const hd = st.herds[id];
        for (const h of cattleOf(hd)) n += HERD.meat[h.kind] || 0;
        if (hd.species !== 'cattle') n += HERD.meat.ewe * hd.ewes + HERD.meat.ram * hd.rams + HERD.meat.lamb * hd.lambs;
      }
      return Math.ceil(n);
    },
    held: (st, hh) => larderOf(hh, 'salt meat'),
  });
  // Salted: the fresh meat keeps as salt meat does (sim/goods), as far as the household's salt goes, HERD.saltPerRation a ration (VB-700);
  // the rest is smoked and keeps HERD.smokeDays, so a household without salt is worse off, not barred. The changes booked in the ledger.
  function saltDone(st, hh) {
    const n = takeAll(hh, 'meat');
    if (!(n > 0)) return;
    const salted = Math.min(n, (hh.salt || 0) / HERD.saltPerRation),
      smoked = n - salted;
    if (salted > 0) Stores.take(st, hh, 'salt', salted * HERD.saltPerRation, 'salting');
    Stores.record(st, hh, 'meat', -n, 'salting');
    if (salted > 0) {
      addFood(st, hh, 'salt meat', salted);
      Stores.record(st, hh, 'salt meat', salted, 'salting');
    }
    if (smoked > 0) {
      addFood(st, hh, 'smoked meat', smoked);
      Stores.record(st, hh, 'smoked meat', smoked, 'salting');
    }
  }
  // The hay household hh's barn would lose today with no barn standing: by hay's keeping (sim/goods), tiers of the herds' winter; mown hay
  // still on a meadow is untouched (VB-159). One reckoning for the doing (spoilHay) and the head's weighing of a barn (sim/aims).
  const hayLoss = (st, hh) => (hh.hay > 0 ? dayLoss(st, 'hay', hh.hay, winterNeed(st, hh)) : 0);
  // Barn hay spoils by winters of the animals now; BUILD.barn.loss as much on a farm with a barn (VB-255; the hay only, VB-1898).
  function spoilHay(st, hh) {
    let lost = hayLoss(st, hh);
    if (!(lost > 0)) return;
    if (hh.farmstead !== null && VB['sim/facilities'].standing(st, st.farmsteads[hh.farmstead], 'barn'))
      lost *= BUILD.barn.loss; // a barn halves it (VB-255)
    hh.hay -= lost;
    hh.haySpoilt = (hh.haySpoilt || 0) + lost;
  }
  // At the start of each game day: food past its day spoils; in the byre the herds eat their hay (a herd unfed starveDays running loses its
  // least valuable animal each day), a day without fodder is a lean day; an emergency slaughter when hay runs short. The autumn count is the
  // calendar's (sim/clock, CALENDAR: autumnCounts, on HERD.countDay, after this).
  // ---- a herd with no herder (VB-136; docs/review-animals.md, G7) ----
  // A standing crop, sown and not yet reaped.
  const STANDING = ['sown', 'growing', 'ripe'];
  // Yesterday the cattle stayed by the farm (sim/clock, CALENDAR: strays): where a stretch of the village's fence is broken (below
  // HERD.stray.below) beside a standing crop of the village, they get in with HERD.stray.chance: the crop nearest their grazing spot loses
  // HERD.stray.loss of its yield (sim/fields), and its holder remembers "Cattle in our crop" about the holder of the household that keeps
  // the stretch: the farm of the village whose house is nearest it, as the village fence was shared out among the farms (the Westgöta law
  // made its keeper liable).
  function stray(st, hh, herd) {
    const w = st.w,
      v = st.villages[st.farmsteads[hh.farmstead].village];
    let best = null;
    for (const s of v.fence) {
      if (s.cond >= HERD.stray.below) continue;
      for (const fid of v.farmsteads) {
        const g = st.farmsteads[fid];
        if (g.household === null) continue;
        for (const fd of g.fields) {
          if (!STANDING.includes(fd.stage) || !s.edges.some((e) => hexSteps(w, e.tile, fd.tile) <= 1)) continue;
          const d = hexSteps(w, herd.home, fd.tile);
          if (!best || d < best.d) best = { s, g, fd, d };
        }
      }
    }
    if (!best || rnd(st.rng.herds) >= HERD.stray.chance) return;
    const { s, g, fd } = best,
      f = st.farmsteads[hh.farmstead];
    trample(fd);
    log(st, `${f.name}'s cattle got into the crop at ${g.name} through a broken fence.`, {
      kind: 'cattleInCrop',
      ...atFarm(g),
    });
    let keeper = null,
      kd = Infinity;
    for (const fid of v.farmsteads) {
      const k = st.farmsteads[fid];
      if (k.household === null) continue;
      const d = hexSteps(w, s.tile, k.house);
      if (d < kd) {
        kd = d;
        keeper = k;
      }
    }
    const holder = st.households[g.household].holder,
      kept = keeper && st.households[keeper.household].holder;
    if (st.cenv && holder !== null && kept !== null && kept !== undefined && holder !== kept)
      emit(st, 'cattleInCrop', { holder, keeper: kept });
  }
  function byreDay(st, c) {
    for (const liveId of st.liveHouseholds) {
      const hh = st.households[liveId];
      if (hh.dissolved) continue;
      const spoilt = spoilFood(st, hh);
      for (const l of spoilt) Stores.record(st, hh, l.kind, -l.n, 'spoilage'); // the larder's losses in the ledger (VB-683)
      if (spoilt.length) {
        const meat = spoilt.filter((l) => l.kind === 'meat').reduce((s, l) => s + l.n, 0);
        if (meat >= 1)
          log(
            st,
            `${Math.round(meat)} rations of meat spoiled at ${st.farmsteads[hh.farmstead].name}: nobody salted it.`,
            {
              kind: 'spoiled',
              n: Math.round(meat),
              ...atHousehold(st, hh),
            },
          );
      }
      if (hh.manure > 0) hh.manure *= Math.pow(1 - SOIL.rot, 1 / YEAR_DAYS); // the heap rots and washes away (balance review)
      spoilHay(st, hh);
      if (!hh.herds.length) continue;
      const herds = herdsOf(st, hh);
      for (const herd of herds) tidy(herd);
      if (!stalled(c)) continue;
      const yesterday = { doy: (c.doy + 47) % 48 };
      if (stalled(yesterday) && c.doy !== HERD.stall[0] && hh.fodderDay !== c.day - 1)
        for (const herd of herds)
          herd.lean += VB['sim/facilities'].standing(st, st.farmsteads[hh.farmstead], 'byre') ? 1 : HERD.openLean; // in the open: faster (VB-1665)
      const need = herds.reduce((s, hd) => s + dailyHay(hd), 0);
      if (hh.hay >= need) {
        hh.hay -= need;
        for (const herd of herds) herd.unfed = 0;
      } else {
        hh.hay = 0;
        for (const herd of herds) {
          herd.unfed++;
          if (herd.unfed < HERD.starveDays) continue;
          const a = animals(st, hh, true).find((x) => x.herd === herd) || null; // the weakest: young first, marked or not
          if (!a) continue;
          remove(herd, a.head ? { head: a.head.id } : { sheep: a.sheep });
          tidy(herd);
          log(
            st,
            `Hunger in the byre at ${st.farmsteads[hh.farmstead].name}: ${a.head ? a.head.name : `a ${a.sheep}`} died.`,
            {
              kind: 'herdDeath',
              n: 1,
              ...atHousehold(st, hh),
            },
          );
        }
      }
      emergency(st, hh, c);
    }
    if (stalled(c)) for (const id of [...(st.herdsAway || [])]) starveAway(st, st.herds[id]);
  }
  // A herd standing away from its byre (st.herdsAway, sim/droving) has no hay where it stands and nobody to feed it (VB-1682): each stall
  // day it goes unfed, and from starveDays running its least valuable lot dies each day (the sheep of one kind, young first, or a head of
  // cattle), as there is no hay there to carry any of it. This bounds a herd left away by the hay, as the autumn count bounds one at home.
  const WEAK = ['calf', 'heifer', 'steer', 'cow', 'bull', 'ox'];
  function starveAway(st, herd) {
    herd.unfed = (herd.unfed || 0) + 1;
    if (herd.unfed < HERD.starveDays) return;
    let what = null,
      n = 0;
    if (herd.species === 'sheep') {
      const k = herd.lambs > 0 ? 'lambs' : herd.ewes > 0 ? 'ewes' : herd.rams > 0 ? 'rams' : null;
      if (!k) return;
      n = herd[k];
      herd[k] = 0;
      what = n === 1 ? `a ${k.slice(0, -1)}` : `${n} ${k}`;
    } else {
      let h = null;
      for (const x of herd.head) if (!h || WEAK.indexOf(x.kind) < WEAK.indexOf(h.kind)) h = x;
      if (!h) return;
      remove(herd, { head: h.id });
      what = h.name;
      n = 1;
    }
    tidy(herd);
    const f = st.farmsteads[herd.at];
    log(st, `Hunger at ${f.name}: ${what} left standing there with no hay died.`, {
      kind: 'herdDeath',
      n,
      ...atFarm(f),
    });
    VB['sim/droving'].emptied(st, herd); // its last animal gone, it no longer stands there (VB-1709)
  }
  // Ewes in milk now (VB-144): those that lambed this spring, from turn-out to the end of summer.
  const inMilkEwes = (st, herd, c) =>
    herd.species !== 'sheep' || stalled(c) || c.doy >= HERD.eweEnd ? 0 : Math.min(herd.lambed || 0, herd.ewes);
  const milkEwes = (st, hh, c) => herdsOf(st, hh).reduce((s, hd) => s + inMilkEwes(st, hd, c), 0);
  // Summer day 1 (VB-144): each sheep of a year or more has grown a fleece, to be shorn at the fold (the job `shear`, VB-679): the flock is
  // kept in until it is (sim/grazing's driveOut), and a fleece still on the sheep at the end of summer is shed and lost (sim/herds, unshorn).
  // The wool is spun at home (sim/textile, VB-362).
  function shearing(st) {
    for (const hd of st.herds) {
      if (hd.species !== 'sheep') continue;
      if (hd.household === null || !(hd.ewes + hd.rams > 0)) delete hd.fleece;
      else hd.fleece = hd.ewes + hd.rams;
    }
  }
  // The flock is shorn (the job `shear`): a fleece for each sheep of a year or more still in it (one sold or dead meanwhile gives none).
  // Only the flocks at the fold are shorn (VB-1175, from VB-674): one out with a herder or standing at another farm keeps its fleece.
  function shearDone(st, hh, c) {
    for (const herd of herdsOf(st, hh)) {
      if (!byFold(herd)) continue;
      const n = Math.min(unshorn(herd, c), herd.ewes + herd.rams);
      if (herd.fleece !== undefined) delete herd.fleece;
      if (n > 0) Stores.put(st, hh, 'wool', n, 'shear'); // spun at home (sim/textile, VB-362)
    }
  }
  // Whether the herd waits at its household's fold: not out with a herder, nor standing at another farm (sim/droving).
  const byFold = (herd) => herd.herder == null && herd.at === undefined;
  // The fleeces of the household's flocks waiting at its fold on day c.
  const atFold = (st, hh, c) => {
    let n = 0;
    for (const herd of herdsOf(st, hh)) if (byFold(herd)) n += unshorn(herd, c);
    return n;
  };
  // Fed and mucked out: the day's dung goes on the heap (VB-137).
  function fodderDone(st, hh, c) {
    hh.fodderDay = c.day;
    for (const herd of herdsOf(st, hh)) {
      hh.manure +=
        herd.species === 'cattle' ? SOIL.cattle * herd.head.length : SOIL.sheep * (herd.ewes + herd.rams + herd.lambs);
    }
  }
  // Fodder: hours a day by the size of the herds.
  const fodderHours = (st, hh) =>
    HERD.fodder[0] +
    herdsOf(st, hh).reduce(
      (s, hd) =>
        s +
        (hd.species === 'cattle' ? HERD.fodder[1] * hd.head.length : HERD.fodder[2] * (hd.ewes + hd.rams + hd.lambs)),
      0,
    );
  const hasAnimals = (st, hh) =>
    herdsOf(st, hh).some((hd) => (hd.species === 'cattle' ? hd.head.length : hd.ewes + hd.rams + hd.lambs) > 0);
  // The hours of a milking of household hh's animals in milk on the day of c (0 with none in milk, or the herds in the byre): the job's.
  function milkHours(st, hh, c) {
    if (stalled(c)) return 0;
    const cows = milkCows(st, hh, c),
      ewes = milkEwes(st, hh, c);
    return cows || ewes ? HERD.milkHours[0] + HERD.milkHours[1] * cows + HERD.eweHours * ewes : 0;
  }
  // The hours of household hh's daily byre work of `kind` (fodder, milk) on the day of c, as its job would be posted then; 0 where none
  // would be (VB-1906: read by the head's estimate of the season's daily routines, sim/estimate setLeft).
  const dayHours = (st, hh, kind, c) =>
    kind === 'fodder'
      ? stalled(c) && hasAnimals(st, hh)
        ? fodderHours(st, hh)
        : 0
      : kind === 'milk' && (hh.herds.length || hh.larder.length)
        ? milkHours(st, hh, c)
        : 0;
  // The byre's jobs for a household now: [key, kind, extra]; refreshJobs posts them.
  function byreJobs(st, hh, c) {
    const out = [];
    if (stalled(c) && hh.fodderDay !== c.day && hasAnimals(st, hh))
      out.push([`fodder:h${hh.id}:${c.day}`, 'fodder', { hours: fodderHours(st, hh) }]);
    for (const id of hh.herds) {
      const herd = st.herds[id];
      // a lot of sheep stands as up to SLAUGHTER.atOnce jobs, each the slaughter of one (VB-1682)
      for (const e of herd.cull)
        for (let k = 0; k < (e.sheep === undefined ? 1 : Math.min(e.lot, SLAUGHTER.atOnce)); k++)
          out.push([
            `slaughter:h${hh.id}:${herd.id}.${e.id}${k ? `/${k}` : ''}`,
            'slaughter',
            { herd, entry: e, hours: HERD.slaughter[herd.species] },
          ]);
    }
    const meat = hh.larder.length ? larderOf(hh, 'meat') : 0;
    if (meat > 0 && larderOf(hh, 'salt meat') < Targets.target(st, hh, 'salt meat'))
      out.push([`salt:h${hh.id}`, 'salt', { hours: Math.max(1, meat / HERD.saltPerHour) }]);
    // milking from 6:00 while the herds are out (VB-135); the cows in milk are counted only then (no cow is in milk in the byre, VB-227)
    const milk = hh.milkDay !== c.day && c.hour >= WORK[0] ? milkHours(st, hh, c) : 0;
    if (milk > 0) out.push([`milk:h${hh.id}:${c.day}`, 'milk', { hours: milk }, milkSite(st, hh)]);
    // shearing at the fold (VB-679), while the flock waits there with its fleeces
    const fleeces = atFold(st, hh, c);
    if (fleeces > 0) out.push([`shear:h${hh.id}`, 'shear', { hours: HERD.shearHours * fleeces }]);
    return out;
  }
  // Where the household's animals in milk are milked (VB-679): at the byre while its herds are by the farm, at the day's pasture while a
  // herder has them out (the milker walks to them); null for the house.
  function milkSite(st, hh) {
    if (!hh.pasture) return null;
    for (const herd of herdsOf(st, hh)) if (herd.herder != null) return hh.pasture.tile;
    return null;
  }
  // Whether the herd is where the milking job j is (VB-679): out with its herder for a job at the pasture, by the farm for one at the byre.
  const milkedAt = (herd, j) => (j && j.site !== j.farm.house ? herd.herder != null : herd.herder == null);
  // The autumn count of every household with herds (sim/clock, CALENDAR, on HERD.countDay): its head's act, the verb `cull` (VB-679) with
  // no list, so that the count's rule chooses (autumnCount), as every head's default; a played head may then choose otherwise by the verb.
  function autumnCounts(st) {
    for (const liveId of st.liveHouseholds) {
      const hh = st.households[liveId];
      if (hh.dissolved || !hh.herds.length) continue;
      const actor = hh.holder === null ? { household: hh.id } : hh.holder;
      issue(st, { actor, verb: 'cull', target: hh.id, source: 'pawn' });
    }
  }
  // ---- the cull, a head's choice (VB-679) ----
  // Why `actor` cannot choose household id's cull now (args.animals the list, or none for the count's rule), or null: it is the head (a
  // household with none, its own act), the household lives with herds, it is autumn from the count day, and each animal named is one of its
  // herds' (cattle by head, sheep by kind, no more of a kind than the flock holds).
  function cullWhy(st, actor, id, args) {
    const hh = Number.isInteger(id) ? st.households[id] : null;
    if (!hh || hh.dissolved || hh.farmstead === null) return `there is no household ${id}`;
    if (Number.isInteger(actor)) {
      const why = living(st, actor);
      if (why) return why;
      if (hh.holder !== actor) return `pawn ${actor} is not the head of the household: only its head chooses the cull`;
    } else if (!(actor && actor.household === id && hh.holder === null))
      return `only the head of the household chooses the cull`;
    if (!hh.herds.length) return `the household has no animals`;
    const c = cal(st.t);
    if (c.season !== 2 || c.doy < HERD.countDay) return 'the cull is chosen in autumn, from the day of the count';
    const list = args && args.animals;
    if (list === undefined) return null;
    if (!Array.isArray(list)) return 'the animals to cull are a list';
    const sheep = new Map(),
      heads = new Set();
    for (const e of list) {
      const herd = e && hh.herds.includes(e.herd) ? st.herds[e.herd] : null;
      if (!herd) return `herd ${e && e.herd} is not household ${id}'s`;
      if (herd.species === 'cattle') {
        if (!herd.head.some((h) => h.id === e.head) || heads.has(e.head))
          return `there is no head ${e.head} to cull in herd ${herd.id}`;
        heads.add(e.head);
      } else {
        if (!['ewe', 'ram', 'lamb'].includes(e.sheep)) return 'a sheep culled is a ewe, a ram or a lamb';
        const k = `${herd.id}.${e.sheep}`;
        sheep.set(k, (sheep.get(k) || 0) + 1);
        if (sheep.get(k) > herd[e.sheep + 's']) return `herd ${herd.id} has no more ${e.sheep}s to cull`;
      }
    }
    return null;
  }
  // The head's own list (the verb `cull` with args.animals): it replaces the count's, the slaughter forced by short hay (lean) kept.
  function chooseCull(st, hh, list) {
    const f = st.farmsteads[hh.farmstead],
      names = new Map(),
      word = (w) => names.set(w, (names.get(w) || 0) + 1);
    for (const herd of herdsOf(st, hh)) herd.cull = herd.cull.filter((e) => e.lean);
    for (const e of list) {
      const herd = st.herds[e.herd];
      if (herd.species === 'cattle') {
        const head = herd.head.find((h) => h.id === e.head);
        cullOne({ herd, head }, false);
        word(head.name);
      } else {
        cullOne({ herd, sheep: e.sheep }, false);
        word(`a ${e.sheep}`);
      }
    }
    log(
      st,
      list.length
        ? `The autumn count at ${f.name}: ${listWords(names)} ${list.length === 1 ? 'goes' : 'go'} to slaughter.`
        : `The autumn count at ${f.name}: every animal is kept.`,
      { kind: 'slaughter', n: list.length, ...atFarm(f) },
    );
  }
  // cull(household, {animals}) (VB-679): the head chooses which animals go to slaughter this autumn; with no list, the count's rule
  // chooses (autumnCount: old animals, males not needed, what the hay cannot carry), which every head makes on the count day.
  register('cull', {
    check: (st, c) => cullWhy(st, c.actor, c.target, c.args),
    run: (st, c) => {
      const hh = st.households[c.target],
        list = c.args && c.args.animals;
      if (list === undefined) autumnCount(st, hh);
      else chooseCull(st, hh, list);
    },
  });
  // Each household's cattle left by the farm yesterday may stray into a crop (sim/clock, CALENDAR: strays; VB-136).
  function strays(st, c) {
    for (const liveId of st.liveHouseholds) {
      const hh = st.households[liveId];
      if (hh.dissolved) continue;
      for (const id of hh.herds) {
        const herd = st.herds[id];
        if (herd.species === 'cattle' && herd.head.length && unherded(st, herd, c)) stray(st, hh, herd);
      }
    }
  }
  // By the byre door, left of the cottage (the page draws the byre there); at the pasture, among the herd (a milking there, VB-679).
  const byreSpot = (st, a, j) =>
    j.site === j.farm.house
      ? [st.w.hx[j.farm.house] - 20 + a.ox * 0.3, st.w.hy[j.farm.house] + 5 + a.oy * 0.2]
      : [st.w.hx[j.site] + a.ox * 0.5, st.w.hy[j.site] + a.oy * 0.4];
  // The byre's work at the cottage, for a household with herds or meat in its larder: fodder, slaughter, salting, milking (sim/byre).
  function byreWork(st, hh, f, c, post) {
    if (hh.herds.length || hh.larder.length)
      for (const [key, kind, extra, site] of byreJobs(st, hh, c))
        post(key, site ?? f.house, { farm: f, ...extra }, kind);
  }
  // Whether a byre stands on the farm of job j's household.
  const byreStands = (st, j) => {
    const hh = j.owner && j.owner.type === 'household' ? st.households[j.owner.id] : null,
      f = hh && hh.farmstead !== null ? st.farmsteads[hh.farmstead] : null;
    return !!(f && VB['sim/facilities'].standing(st, f, 'byre'));
  };
  // The job kinds (sim/kinds joins them into KINDS; a kind's fields are described there).
  const KINDS = {
    fodder: {
      daily: true, // its hours reserved before anything authored (VB-1755)
      verb: 'Feeding and mucking out in the byre',
      go: 'Going to the byre',
      // VB-1670: on a farm with no byre standing (farmstead.byre, sim/byrehouse) the animals are foddered where they stand
      words: (st, j) => (byreStands(st, j) ? {} : { verb: 'Foddering the animals', go: 'Going to the animals' }),
      name: 'Fodder the animals',
      at: ['byre'],
      needs: ['hay'],
      gives: ['manure'],
      label: 'Byre',
      anim: 'gather',
      hours: 1,
      hands: 1,
      type: 'husbandry',
      spot: byreSpot,
      window: { from: WORK[0] - 1 },
      urgency: (st, j, c, U) => U.fodder,
      done: (st, j, hh, c) => fodderDone(st, hh, c),
      available: byreWork,
    },
    milk: {
      daily: true, // its hours reserved before anything authored (VB-1755)
      verb: 'Milking the cows',
      go: 'Going to milk the cows',
      name: 'Milk the cows',
      at: ['byre'],
      needs: ['cattle'],
      gives: ['milk', 'butter'],
      label: 'Milking',
      anim: 'milk',
      hours: 0.5,
      hands: 1,
      type: 'husbandry',
      spot: byreSpot,
      window: { from: WORK[0] },
      urgency: (st, j, c, U) => (c.hour < U.milkLateHour ? U.milk : U.milkLate),
      done: (st, j, hh, c) => milkDone(st, hh, c, j),
      available: byreWork,
    },
    shear: {
      verb: 'Shearing the sheep',
      go: 'Going to the fold to shear',
      name: 'Shear the sheep',
      at: ['byre'],
      needs: ['sheep'],
      gives: ['fleece'],
      label: 'Shearing',
      anim: 'gather',
      hours: 1,
      hands: 2,
      type: 'husbandry',
      spot: byreSpot,
      window: { from: WORK[0] },
      urgency: (st, j, c, U) => U.shear,
      done: (st, j, hh, c) => shearDone(st, hh, c),
      available: byreWork,
    },
    slaughter: {
      verb: 'Slaughtering',
      go: 'Going to slaughter',
      name: 'Slaughter an animal',
      at: ['byre'],
      needs: ['cattle'],
      gives: ['meat', 'hide'],
      label: 'Slaughter',
      anim: 'mallet',
      hours: 3,
      hands: 2,
      type: 'husbandry',
      spot: byreSpot,
      urgency: (st, j, c, U) => (j.entry.lean ? U.slaughterNow : U.slaughter),
      done: (st, j, hh) => slaughterDone(st, j.herd, j.entry, hh),
      available: byreWork,
    },
    salt: {
      verb: 'Salting meat',
      go: 'Going home to salt the meat',
      name: 'Salt the meat',
      at: ['house'],
      needs: ['meat', 'salt'],
      gives: ['salt meat'],
      label: 'Salting',
      anim: null,
      hours: 1,
      hands: 1,
      type: 'household',
      urgency: (st, j, c, U) => U.salt,
      done: (st, j, hh) => saltDone(st, hh),
      available: byreWork,
    },
  };
  // worked indoors (VB-1820: the work step says it, sim/methods labour; no field of the kind)
  VB['sim/methods'].labour(KINDS.salt, { inside: true });
  return {
    KINDS,
    byreWork,
    spoilHay,
    hayLoss,
    autumnCounts,
    strays,
    stray,
    animals,
    autumnCount,
    emergency,
    tidy,
    slaughterDone,
    saltDone,
    milkDone,
    fodderDone,
    byreDay,
    milkEwes,
    shearing,
    shearDone,
    byreJobs,
    dayHours,
  };
})();
