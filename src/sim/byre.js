// @sys sim/byre: the stall period: daily hay and fodder, the autumn count and what goes to slaughter, emergency slaughter, hunger in the byre
VB['sim/byre'] = (() => {
  const { HERD, WORK } = VB['sim/rules'];
  const { log } = VB['sim/records'];
  const { addFood, larderOf } = VB['sim/hunger'];
  const { herdsOf, dailyHay, stalled, years, bullsNear, inMilk, milkCows } = VB['sim/herds'];
  const { hexSteps } = VB['sim/hex'];
  // A herd's cull[]: animals to slaughter, {id (within the herd), head (cattle head id) or sheep ('ewe'|'ram'|'lamb'), lean}; herd.cullSeq
  // numbers them. herd.lean counts stall days without fodder since the last count; herd.unfed stall days running without full hay (VB-134).

  // Stall days still to come after the day c, while in the byre.
  const stallLeft = (c) => (!stalled(c) ? 0 : c.doy >= HERD.stall[0] ? 47 - c.doy + HERD.stall[1] : HERD.stall[1] - 1 - c.doy);
  const houseOf = (st, hh) => st.farmsteads[hh.farmstead].house;
  const marked = (herd, head) => (herd.cull || []).some((e) => e.head === head.id);
  // The breeding male a farm relies on: the youngest bull of a year or more within reach not already marked for slaughter (an older one
  // goes once a young one can follow it), and whether another farm's ram, or a second ram of the herd, is within reach.
  function keptBull(st, house) {
    const live = bullsNear(st, house, 1).filter((b) => !marked(b.herd, b.head));
    return live.sort((a, b) => b.head.born - a.head.born || a.head.id - b.head.id)[0] || null;
  }
  const otherRam = (st, herd, house) => st.herds.some((hd) => hd !== herd && hd.species === 'sheep' && hd.household !== null && hd.rams > 0
    && hexSteps(st.w, house, houseOf(st, st.households[hd.household])) <= HERD.reach);
  // The household's animals not yet marked for slaughter, least valuable first: {herd, head or sheep, hay (a stall day), room (in the byre),
  // value}. Order (Agreed, 31 Oct): rams and bulls not needed, ewe lambs, ewes, heifer calves, bull calves, heifers, steers, cows (oldest
  // first), the bull the farms rely on, the only ram in reach, oxen last.
  function animals(st, hh, all = false) { // all: those marked for slaughter too
    const out = [], house = houseOf(st, hh), H = HERD.hay, bull = keptBull(st, house);
    for (const herd of herdsOf(st, hh)) {
      if (herd.species === 'cattle') {
        for (const h of herd.head) {
          if (!all && marked(herd, h)) continue;
          let v = { calf: h.sex === 'f' ? 3 : 3.5, heifer: 4, steer: 4.5, cow: 5 + Math.max(0, 12 - years(st, h)) / 20, ox: 7 }[h.kind];
          if (h.kind === 'bull') v = bull && bull.head === h ? 6 : 0.5;
          out.push({ herd, head: h, hay: H[h.kind], room: h.kind === 'calf' ? 0.5 : 1, value: v });
        }
      } else {
        const n = { ewe: herd.ewes, ram: herd.rams, lamb: herd.lambs };
        if (!all) for (const e of herd.cull || []) n[e.sheep]--;
        const only = !otherRam(st, herd, house);
        for (let k = 0; k < n.lamb; k++) out.push({ herd, sheep: 'lamb', hay: H.lamb, room: 0, value: 1 });
        for (let k = 0; k < n.ewe; k++) out.push({ herd, sheep: 'ewe', hay: H.ewe, room: 0, value: 2 });
        for (let k = 0; k < n.ram; k++) out.push({ herd, sheep: 'ram', hay: H.ram, room: 0, value: k === 0 && only ? 6 : 0.5 });
      }
    }
    return out.sort((x, y) => x.value - y.value);
  }
  function cullOne(a, lean) {
    const herd = a.herd;
    herd.cull.push(a.head ? { id: herd.cullSeq++, head: a.head.id, lean } : { id: herd.cullSeq++, sheep: a.sheep, lean });
  }
  // Words for the log: "Rosa, an old ewe and 3 ram lambs".
  const PLURAL = { 'a lamb': 'lambs', 'a ram lamb': 'ram lambs', 'an old ewe': 'old ewes', 'a ewe': 'ewes', 'a ram': 'rams' };
  function listWords(names) {
    const n = new Map(); for (const x of names) n.set(x, (n.get(x) || 0) + 1);
    const parts = [...n].map(([x, k]) => (k === 1 ? x : `${k} ${PLURAL[x] || x}`));
    return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  }
  // The autumn count (autumn day 8): old animals go; bulls and rams not needed for breeding go; male young beyond the oxen's replacements
  // and a future bull go; half the lambs, the ram lambs, go; then, while the hay (with what still lies mown on the meadows) cannot carry the
  // winter's need × margin, or the byre is over full, the least valuable animal goes.
  function autumnCount(st, hh) {
    const f = st.farmsteads[hh.farmstead], house = houseOf(st, hh), names = [];
    for (const herd of herdsOf(st, hh)) { herd.cull = []; herd.lean = 0; }
    const go = (a, word) => { cullOne(a, false); names.push(a.head ? a.head.name : word || `a ${a.sheep}`); };
    let list = animals(st, hh);
    let replacements = Math.max(0, 2 - list.filter((a) => a.head && a.head.kind === 'ox').length);
    let futureBull = bullsNear(st, house, 0).some((b) => years(st, b.head) < HERD.keepBullUnder);
    for (const a of list) {
      const h = a.head;
      if (h) {
        if (HERD.old[h.kind] && years(st, h) >= HERD.old[h.kind] && !(h.kind === 'bull' && a.value >= 6)) go(a); // the farms' only bull stays
        else if (h.kind === 'bull' && a.value < 1) go(a);
        else if (h.kind === 'steer' || (h.kind === 'calf' && h.sex === 'm')) {
          if (h.kind === 'calf' && !futureBull) futureBull = true;
          else if (replacements > 0) replacements--;
          else go(a);
        }
      } else if (a.sheep === 'ram' && a.value < 1) go(a);
      else if (a.sheep === 'ewe' && st.rand() < HERD.oldEwe) go(a, 'an old ewe');
    }
    for (const herd of herdsOf(st, hh)) {
      if (herd.species !== 'sheep') continue;
      let males = Math.round(herd.lambs / 2);
      if (males && !herd.rams && !otherRam(st, herd, house)) males--; // a ram lamb is kept to serve the ewes
      for (let k = 0; k < males; k++) go({ herd, sheep: 'lamb' }, 'a ram lamb');
    }
    const hay = hh.hay + f.meadows.reduce((s, m) => s + (m.stage === 'mown' ? m.held : 0), 0);
    list = animals(st, hh);
    let need = list.reduce((s, a) => s + a.hay, 0) * HERD.stallDays * HERD.margin, room = list.reduce((s, a) => s + a.room, 0);
    while (list.length && (need > hay || room > HERD.byre)) {
      const i = need <= hay ? list.findIndex((a) => a.room > 0) : 0, a = list.splice(i, 1)[0];
      need -= a.hay * HERD.stallDays * HERD.margin; room -= a.room;
      go(a);
    }
    if (names.length) log(st, `The autumn count at ${f.name}: ${listWords(names)} ${names.length === 1 ? 'goes' : 'go'} to slaughter.`);
  }
  // When the hay left will not last the stall days to come, the household slaughters at once what it must; that meat is lean.
  function emergency(st, hh, c) {
    const left = stallLeft(c);
    if (!left) return;
    const list = animals(st, hh);
    let need = list.reduce((s, a) => s + a.hay, 0) * left, n = 0;
    while (list.length && need > hh.hay) { const a = list.shift(); need -= a.hay * left; cullOne(a, true); n++; }
    if (n) log(st, `Hay runs short at ${st.farmsteads[hh.farmstead].name}: ${n === 1 ? 'an animal' : `${n} animals`} must be slaughtered now.`);
  }
  // The cull lists hold only animals that are still there.
  function tidy(herd) {
    if (herd.species === 'cattle') { const ids = new Set(herd.head.map((h) => h.id)); herd.cull = herd.cull.filter((e) => ids.has(e.head)); return; }
    const n = { ewe: herd.ewes, ram: herd.rams, lamb: herd.lambs };
    herd.cull = herd.cull.filter((e) => n[e.sheep]-- > 0);
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
    herd[k]--; return e.sheep;
  }
  // The slaughter is done: the animal leaves the herd, its meat goes into the larder fresh.
  function slaughterDone(st, herd, entry, hh) {
    const i = herd.cull.indexOf(entry);
    if (i < 0) return;
    herd.cull.splice(i, 1);
    const kind = remove(herd, entry), n = kind ? HERD.meat[kind] * (entry.lean ? HERD.lean : 1) : 0;
    if (kind) { addFood(st, hh, 'meat', n, HERD.freshDays); hh.ledger.push({ t: st.t, kind: 'meat', n }); }
  }
  // Milked (VB-135): each cow in milk gives HERD.milk rations, less for the lean days of the winter; part is churned to butter that keeps,
  // the rest is drunk fresh within the day.
  function milkDone(st, hh, c) {
    hh.milkDay = c.day;
    let cows = 0;
    for (const herd of herdsOf(st, hh)) cows += inMilk(st, herd, c).length * (1 - Math.min(HERD.leanMax, HERD.leanPer * herd.lean));
    const r = cows * HERD.milk, butter = r * HERD.butter;
    if (r <= 0) return;
    addFood(st, hh, 'milk', r - butter, 1); addFood(st, hh, 'butter', butter, HERD.butterDays);
    hh.ledger.push({ t: st.t, kind: 'milk', n: r - butter }, { t: st.t, kind: 'butter', n: butter });
  }
  // Salted: the fresh meat keeps a year.
  function saltDone(st, hh) {
    const n = larderOf(hh, 'meat');
    hh.larder = hh.larder.filter((l) => l.kind !== 'meat');
    addFood(st, hh, 'salt meat', n, HERD.saltDays);
  }
  // At the start of each game day: food past its day spoils; in the byre the herds eat their hay (a herd unfed starveDays running loses its
  // least valuable animal each day), a day without fodder is a lean day; the count on its day; an emergency slaughter when hay runs short.
  function byreDay(st, c) {
    for (const hh of st.households) {
      if (hh.dissolved) continue;
      const spoilt = hh.larder.filter((l) => l.until <= st.t);
      if (spoilt.length) {
        hh.larder = hh.larder.filter((l) => l.until > st.t);
        const meat = spoilt.filter((l) => l.kind === 'meat').reduce((s, l) => s + l.n, 0);
        if (meat >= 1) log(st, `${Math.round(meat)} rations of meat spoiled at ${st.farmsteads[hh.farmstead].name}: nobody salted it.`);
      }
      if (!hh.herds.length) continue;
      const herds = herdsOf(st, hh);
      for (const herd of herds) tidy(herd);
      if (c.doy === HERD.countDay) autumnCount(st, hh);
      if (!stalled(c)) continue;
      const yesterday = { doy: (c.doy + 47) % 48 };
      if (stalled(yesterday) && c.doy !== HERD.stall[0] && hh.fodderDay !== c.day - 1) for (const herd of herds) herd.lean++;
      const need = herds.reduce((s, hd) => s + dailyHay(hd), 0);
      if (hh.hay >= need) { hh.hay -= need; for (const herd of herds) herd.unfed = 0; } else {
        hh.hay = 0;
        for (const herd of herds) {
          herd.unfed++;
          if (herd.unfed < HERD.starveDays) continue;
          const a = animals(st, hh, true).find((x) => x.herd === herd) || null; // the weakest: young first, marked or not
          if (!a) continue;
          remove(herd, a.head ? { head: a.head.id } : { sheep: a.sheep }); tidy(herd);
          log(st, `Hunger in the byre at ${st.farmsteads[hh.farmstead].name}: ${a.head ? a.head.name : `a ${a.sheep}`} died.`);
        }
      }
      emergency(st, hh, c);
    }
  }
  // Fodder: hours a day by the size of the herds.
  const fodderHours = (st, hh) => HERD.fodder[0] + herdsOf(st, hh).reduce((s, hd) => s + (hd.species === 'cattle'
    ? HERD.fodder[1] * hd.head.length : HERD.fodder[2] * (hd.ewes + hd.rams + hd.lambs)), 0);
  const hasAnimals = (st, hh) => herdsOf(st, hh).some((hd) => (hd.species === 'cattle' ? hd.head.length : hd.ewes + hd.rams + hd.lambs) > 0);
  // The byre's jobs for a household now: [key, kind, extra]; refreshJobs posts them.
  function byreJobs(st, hh, c) {
    const out = [];
    if (stalled(c) && hh.fodderDay !== c.day && hasAnimals(st, hh)) out.push([`fodder:h${hh.id}:${c.day}`, 'fodder', { hours: fodderHours(st, hh) }]);
    for (const herd of herdsOf(st, hh)) for (const e of herd.cull) {
      out.push([`slaughter:h${hh.id}:${herd.id}.${e.id}`, 'slaughter', { herd, entry: e, hours: HERD.slaughter[herd.species] }]);
    }
    const meat = larderOf(hh, 'meat');
    if (meat > 0) out.push([`salt:h${hh.id}`, 'salt', { hours: Math.max(1, meat / HERD.saltPerHour) }]);
    const cows = milkCows(st, hh, c); // milking from 6:00 while the herds are out (VB-135)
    if (cows && hh.milkDay !== c.day && c.hour >= WORK[0]) {
      out.push([`milk:h${hh.id}:${c.day}`, 'milk', { hours: HERD.milkHours[0] + HERD.milkHours[1] * cows }]);
    }
    return out;
  }
  return { stallLeft, animals, autumnCount, emergency, tidy, slaughterDone, saltDone, milkDone, byreDay, fodderHours, byreJobs };
})();
