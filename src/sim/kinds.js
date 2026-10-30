// @sys sim/kinds: job kinds, one record each: hours, type of work, labels, where to stand, urgency, and what finishing and delivering do
VB['sim/kinds'] = (() => {
  const { ROLES, cal } = VB['sim/rules'];
  const { log } = VB['sim/records'];
  const { fellTree } = VB['sim/forest'];
  const { dailyNeed, seedReserve } = VB['sim/hunger'];
  const { finishClear, finishBreak } = VB['sim/fields'];
  // A kind's fields:
  //   verb, go, back: what the pawn panel says while working, walking there and carrying home; name: the job in the settlers panel;
  //   label: the job in the line that says why a pawn is idle; anim: the page's work animation; hours: work hours to finish;
  //   hands: how many pawns may work one job at once (VB-102: field, land and threshing work takes the whole household);
  //   type: the type of work, which roles rank (ROLES in sim/rules); field: worked row by row across the tile, at `pace` map units an hour;
  //   inside: worked in the house; carry: what is carried home when the work is done, to the cottage door, the woodpile or the barn (`to`);
  //   spot(st, a, j): where on the site the pawn stands; urgency(st, j, c, U): the job's weight in a bid (U is MATCH.urgency; 1 without it);
  //   done(st, j, hh, c): what finishing the work does; deliver(st, j, hh, f): what arriving home with the load does.
  // Firewood is laid in for the winter from summer on, so the pile is topped up higher then.
  const woodGoal = (E, c) => (c.season === 1 || c.season === 2 ? E.woodWinter : E.woodTarget);
  const rowAngle = (j) => (j.farm ? j.farm.rowAngle : 0);
  // Several hands on one field start on different rows: the nth worker on row -12 + 6n, five rows across the tile.
  const firstRow = (j, a) => -12 + 6 * (Math.max(0, j.claims.indexOf(a.id)) % 5);
  // The start of the pawn's first row on a field tile.
  function onField(st, a, j) {
    const w = st.w, th = rowAngle(j), row = firstRow(j, a);
    return [w.hx[j.site] - Math.cos(th) * 13 - Math.sin(th) * row, w.hy[j.site] - Math.sin(th) * 13 + Math.cos(th) * row];
  }
  // Hoeing and sowing grow more urgent as the sowing window runs out.
  const inWindow = (st, j, c, U) => U.field + c.sday / U.fieldPerDay;
  const KINDS = {
    plow: {
      verb: 'Hoeing a field', go: 'Going to hoe a field', name: 'Hoe a field', label: 'Hoeing', anim: 'hoe', hours: 20, hands: Infinity, type: 'tilling',
      field: true, spot: onField, urgency: inWindow, done: (st, j) => { j.field.stage = 'plowed'; },
    },
    sow: {
      verb: 'Sowing', go: 'Going to sow', name: 'Sow a field', label: 'Sowing', anim: 'sow', hours: 2, hands: Infinity, type: 'tending',
      field: true, pace: 9,
      spot: onField, urgency: inWindow,
      done: (st, j, hh, c) => {
        const E = st.ECON;
        if (hh.grain < E.seedPerField) return;
        hh.grain -= E.seedPerField; j.field.stage = 'sown'; j.field.sown = c.day;
        j.field.weedOpen = false; j.field.weedPosted = null; j.field.weedMiss = 0;
      },
    },
    reap: {
      verb: 'Reaping', go: 'Going to reap', name: 'Reap a field', label: 'Reaping', anim: 'reap', hours: 5, hands: Infinity, type: 'harvest',
      field: true,
      spot: onField, urgency: (st, j, c, U) => U.reap + (c.season === 2 ? c.sday / U.reapFrostPerDay : 0),
      done: (st, j, hh, c) => {
        const E = st.ECON, fd = j.field;
        fd.stage = 'stooks'; fd.reaped = c.day;
        fd.held = Math.round(E.fieldYield * fd.fert * st.weather * (0.9 + st.rand() * 0.2) * (1 - Math.min(E.weedCutMax, E.weedCut * fd.weedMiss)));
        fd.weedOpen = false; fd.weedPosted = null; fd.weedMiss = 0;
      },
    },
    haul: {
      verb: 'Bringing in the sheaves', go: 'Going for the sheaves', back: 'Carrying sheaves to the barn', name: 'Bring in sheaves', label: 'Hauling sheaves',
      anim: 'gather', hours: 0.7, hands: Infinity, type: 'harvest', carry: 'sheaf', to: 'barn',
      spot: (st, a, j) => [st.w.hx[j.site] + a.ox * 0.6, st.w.hy[j.site] + a.oy * 0.6], urgency: (st, j, c, U) => U.haul,
      deliver: (st, j, hh, f) => {
        hh.unthreshed.push(j.field.held); hh.ledger.push({ t: st.t, kind: 'harvest', n: j.field.held });
        if (f.fields.every((q) => q.stage !== 'ripe' && q.stage !== 'stooks' || q === j.field)) log(st, `${f.name} has brought in its harvest.`);
        j.field.held = 0; j.field.stage = 'stubble'; j.field.sown = null;
      },
    },
    wood: {
      verb: 'Cutting firewood', go: 'Heading to the woods', back: 'Carrying firewood home', name: 'Cut firewood', label: 'Firewood', anim: 'chop',
      hours: 3, hands: 1, type: 'wood', carry: 'logs', to: 'woodpile',
      spot: (st, a, j) => [st.w.hx[j.site] - 8 + a.ox * 0.4, st.w.hy[j.site] + 6],
      // 2.2 when the pile is nearly out; else its shortfall of the goal, and more in autumn
      urgency: (st, j, c, U) => {
        const hh = st.households[j.farm.household];
        return hh.wood < U.woodLow ? U.woodLowUrgency : (woodGoal(st.ECON, c) - hh.wood) / woodGoal(st.ECON, c) + (c.season === 2 ? U.woodSummer : 0);
      },
      deliver: (st, j, hh) => { hh.wood += st.ECON.woodPerTrip; fellTree(st, j.farm); },
    },
    water: {
      verb: 'Drawing water', go: 'Going for water', back: 'Carrying water home', name: 'Fetch water', label: 'Water', anim: 'draw', hours: 0.5,
      hands: 1, type: 'household', carry: 'buckets', to: 'door',
      spot: (st, a, j) => {
        const w = st.w;
        return st.villages[j.farm.village].well ? [w.hx[j.site] - 10 + a.ox * 0.2, w.hy[j.site] + 8] : [w.hx[j.site] - 1, w.hy[j.site] + 4];
      },
      urgency: (st, j, c, U) => (c.hour < U.waterMorningHour ? U.waterMorning : U.water),
      deliver: (st, j, hh) => { hh.waterDay = cal(st.t).day; },
    },
    cook: {
      verb: 'Cooking at the hearth', go: 'Going home to cook', name: 'Cook', label: 'Cook', anim: null, hours: 2, hands: 1, type: 'household',
      inside: true,
      urgency: (st, j, c, U) => (c.hour >= U.cookEveningHour ? U.cookEvening : U.cook),
      // grain above the seed reserve becomes the rations still missing for the coming meal
      done: (st, j, hh, c) => {
        const make = Math.max(0, Math.min(dailyNeed(st, hh) - hh.rations, hh.grain - seedReserve(st, hh)));
        hh.grain -= make; hh.rations += make; hh.cookDay = c.day;
      },
    },
    weed: {
      verb: 'Weeding a field', go: 'Going to weed a field', name: 'Weed a field', label: 'Weed', anim: 'gather', hours: 2, hands: Infinity, type: 'tending',
      field: true, spot: onField, done: (st, j) => { j.field.weedOpen = false; },
    },
    thresh: {
      verb: 'Threshing in the barn', go: 'Going to the barn to thresh', name: 'Thresh the grain', label: 'Threshing', anim: null, hours: 6,
      hands: Infinity, type: 'threshing', inside: true, done: (st, j, hh) => { hh.grain += hh.unthreshed.shift() || 0; },
    },
    clear: {
      verb: 'Clearing scrub and stones', go: 'Going to clear land', name: 'Clear a new field', label: 'Clear', anim: 'hoe', hours: 10, hands: Infinity,
      type: 'tilling', field: true, spot: onField, done: (st, j, hh) => finishClear(st, j.farm, hh),
    },
    break: {
      verb: 'Breaking new ground', go: 'Going to break new ground', name: 'Break new ground', label: 'Break', anim: 'hoe', hours: 30, hands: Infinity,
      type: 'tilling', field: true, spot: onField, done: (st, j) => finishBreak(st, j.farm),
    },
    fell: { verb: 'Felling trees', go: 'Going to fell trees', name: 'Fell trees', label: 'Fell', anim: 'chop', hours: 10, hands: Infinity, type: 'wood' },
    grub: {
      verb: 'Grubbing out stumps', go: 'Going to grub out stumps', name: 'Grub out stumps', label: 'Grub', anim: 'hoe', hours: 6, hands: Infinity,
      type: 'tilling', field: true, spot: onField,
    },
    mend: {
      verb: 'Mending the fence', go: 'Going to mend the fence', name: 'Mend the fence', label: 'Mending', anim: 'mallet', hours: 2.5, hands: 1,
      type: 'upkeep',
      spot: (st, a, j) => {
        const w = st.w, s = j.stretch;
        return [s.mx + (w.hx[j.site] - s.mx) * 0.25, s.my + (w.hy[j.site] - s.my) * 0.25 + 3];
      },
      urgency: (st, j, c, U) => (1 - j.stretch.cond) * U.mendPerCond,
      done: (st, j) => { j.stretch.cond = 1; j.stretch.dirty = true; },
    },
  };
  // A job is open while it has work left and fewer workers than hands; a carried job whose work is done waits for its carrier.
  const isOpen = (j) => j.claims.length < KINDS[j.kind].hands && j.done < (j.hours ?? KINDS[j.kind].hours);
  // Each role's rank of every kind: its exception for the kind, else its rank of the kind's type of work, else 0.
  for (const r of Object.values(ROLES)) r.prio = Object.fromEntries(Object.entries(KINDS).map(([k, K]) => [k, r.except[k] ?? r.work[K.type] ?? 0]));
  return { KINDS, woodGoal, rowAngle, firstRow, isOpen };
})();
