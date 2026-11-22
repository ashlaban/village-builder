// @sys sim/fields: field state from breaking ground through the crop year, including rotation changes, soil and manure
VB['sim/fields'] = (() => {
  const { underCrop, fieldAt, courseFor } = VB['sim/rotations'];
  const { next: rnd } = VB['sim/rng'];
  const { CROPS, ROTATIONS, SOIL, TILTH, HERD, DEER, fertility, DAY, SEASON_DAYS, YEAR } = VB['sim/rules'];
  const { costChanged } = VB['sim/routes'];
  const { log, atFarm } = VB['sim/records'];
  const { woodTaken } = VB['sim/territory'];
  const { realiseStake } = VB['sim/stakes'];
  const Stores = VB['sim/stores'],
    Projects = VB['sim/projects'];
  const { emit } = VB['sim/events'];
  const { clearScrub, tended, SPREAD } = VB['sim/spread'];
  const STONES_PER_LOAD = 25;
  // Clearing done: the stones go to the household's store, the tile is bare ground; the project's next step, breaking, opens.
  // `plan` is the household's field plan whose step the job was (sim/projects' onProject).
  function finishClear(st, f, hh, plan) {
    const tile = plan.steps[plan.open].place;
    clearStones(st, tile, hh);
    emit(st, 'stepDone', { type: 'household', id: f.household, plan }); // the project's next step opens (sim/plans)
  }
  // The stones cleared off `tile` go to household hh's heap (VB-332: through the stores; a common field's to the household of the one who
  // finished the clearing, VB-100), and the tile is bare ground.
  function clearStones(st, tile, hh) {
    const w = st.w,
      loads = Math.round(w.stones[tile] / STONES_PER_LOAD);
    if (loads > 0 && hh) Stores.put(st, hh, 'stone', loads, 'clear');
    w.stones[tile] = 0;
    clearScrub(st, tile); // its scrub too, and it is tended (VB-091)
    st.biomeDirty.add(tile);
  }
  // Breaking done: the stake is the household's own land, a field in stubble; on ground never farmed (w.dev 0) its soil starts fresh
  // (SOIL.fresh, VB-149). The project is finished.
  function finishBreak(st, f, plan) {
    const tile = plan.steps[plan.open].place;
    realiseStake(st, st.households[f.household], tile);
    const fd = broken(st, tile, f.fields.length);
    f.fields.push(fd);
    placeField(st, f, st.households[f.household], fd);
    st.farmDirty.add(f.id); // its new field is drawn (VB-442)
    emit(st, 'stepDone', { type: 'household', id: f.household, plan }); // the project is finished (sim/plans)
    log(st, `${f.name} has broken a new field.`, { kind: 'field', ...atFarm(f) });
  }
  // A new field in stubble on `tile`, its ground broken: farmed land from now. A farm's (finishBreak) or a village's common field (VB-100,
  // sim/commons), whose holder adds it to its list.
  function broken(st, tile, id) {
    const w = st.w,
      fd = {
        id,
        tile,
        crop: 'barley',
        rotation: 'every',
        step: 0,
        stage: 'stubble',
        sown: null,
        reaped: null,
        held: 0,
        fert: fertility(w, tile),
        soil: w.dev[tile] ? SOIL.start : SOIL.fresh,
        tilth: 0,
        tilthAt: st.t,
        weedOpen: false,
        weedPosted: null,
        weedMiss: 0,
      };
    tended(st, tile); // VB-091
    st.used.add(tile);
    woodTaken(st, tile); // a wood tile broken to a field leaves its village's wood (VB-326)
    if (!w.dev[tile]) costChanged(st, tile); // developed ground walks as open ground (sim/routes, tileCost)
    w.dev[tile] = 1;
    st.biomeDirty.add(tile);
    return fd;
  }
  // The field goes on to its next step: its crop is in, or lost, or its window passed with it unsown, or its fallow year is over. A field
  // hoed for a crop it will not bear now lies in stubble (a fallow field is never hoed).
  function nextStep(fd) {
    const R = ROTATIONS[fd.rotation].courses;
    if (fd.turn)
      delete fd.turn; // its year out of turn is over (VB-355): back to the rotation, at the next step
    else if (R.length === 1) return; // barley every year: as it was
    fd.step = (fd.step + 1) % R.length;
    fd.crop = R[fd.step];
    if (!underCrop(fd)) delete fd.weeds;
    if (CROPS[fd.crop].fallow && fd.stage === 'plowed') fd.stage = 'stubble';
  }
  // The days after the crops' sowing windows close: [season, day, crop].
  const CLOSED = Object.keys(CROPS)
    .filter((k) => CROPS[k].seed > 0)
    .map((k) => {
      const [s, , last] = CROPS[k].sow;
      return last + 1 < SEASON_DAYS ? [s, last + 1, k] : [(s + 1) % 4, 0, k];
    });
  // A crop's course whose sowing window closed with its field unsown is a year lost: the field goes on to its next step, so that the farm's
  // fields stay staggered. Walked on those days only.
  function unsown(st, c) {
    for (const [s, d, k] of CLOSED) {
      if (c.season !== s || c.sday !== d) continue;
      for (const f of st.farmsteads)
        if (f.household !== null)
          for (const fd of f.fields)
            if (fd.crop === k && (fd.stage === 'stubble' || fd.stage === 'plowed')) nextStep(fd);
    }
  }
  // How well a step's course suits a field when the farm changes rotation: its own crop first, then fallow.
  const suits = (course, crop) => (course === crop ? 2 : CROPS[course].fallow ? 1 : 0);
  // The farm's fields take rotation `key`, staggered: a field under a crop keeps it (the caller checks the rotation has it); each other
  // field, in order, takes a step fewest of the fields are at, the one that suits it best, else the first.
  function restagger(f, key) {
    const R = ROTATIONS[key].courses;
    for (const fd of f.fields) {
      delete fd.turn;
      fd.rotation = key;
      fd.step = underCrop(fd) ? R.indexOf(fd.crop) : -1; // -1: placed below
    }
    const at = (j) => f.fields.filter((q) => q.step === j).length;
    for (const fd of f.fields) {
      if (fd.step >= 0) continue;
      const n = R.map((k, j) => at(j)),
        least = Math.min(...n);
      let i = -1;
      for (let j = 0; j < R.length; j++)
        if (n[j] === least && (i < 0 || suits(R[j], fd.crop) > suits(R[i], fd.crop))) i = j;
      fd.step = i;
      fd.crop = R[i];
      delete fd.weeds; // no crop stands: a lost crop's weeding goes with it (VB-999's reviews at rye's close met it)
      if (CROPS[fd.crop].fallow && fd.stage === 'plowed') fd.stage = 'stubble';
    }
  }
  // A new field takes the farm's rotation (with no field yet, the household's: rotationOf) and the step fewest of the farm's fields are
  // at; of those, the course sown soonest from today (fallow last), then the first.
  function placeField(st, f, hh, fd) {
    const { key, i } = courseFor(
      st,
      f.fields.filter((q) => q !== fd),
      hh,
    );
    fd.rotation = key;
    fd.step = i;
    fd.crop = ROTATIONS[key].courses[i];
  }
  // Farm f takes rotation `key` (rotationWhy holds), its fields staggered anew when it changes. hold: its head keeps it against the
  // village's usual one, until it chooses again; key null, or a choice without hold, gives the choosing back to the rule. short: the crop
  // whose seed ran out, when the rule falls back (logged once, at the change).
  function takeRotation(st, f, hh, key, { hold = false, short = null } = {}) {
    const changed = key !== null && f.fields[0].rotation !== key;
    if (changed) restagger(f, key);
    if (hold && key !== null) f.rotationBy = hh.id;
    else if (f.rotationBy === hh.id) delete f.rotationBy;
    if (!changed || (short === null && !hold)) return;
    log(
      st,
      short !== null
        ? `${f.name} has no seed of ${short} to sow and falls back on ${ROTATIONS[key].label}.`
        : `${f.name} now farms ${ROTATIONS[key].label}, by its head's choice.`,
      { kind: 'field', ...atFarm(f) },
    );
  }
  // The field on `tile` bears `crop` this year, out of turn (turnWhy holds): its step stays, and when the crop is in, or lost, or its
  // window closes, the field goes on to its next step as after any course. Nothing is sown here: the household's work does that.
  function outOfTurn(st, f, tile, crop) {
    const fd = fieldAt(f, tile);
    fd.crop = crop;
    if (ROTATIONS[fd.rotation].courses[fd.step] === crop) delete fd.turn;
    else fd.turn = true;
    if (CROPS[crop].fallow && fd.stage === 'plowed') fd.stage = 'stubble';
    log(
      st,
      fd.turn
        ? `${f.name} ${CROPS[crop].fallow ? 'rests a field' : `sows a field with ${crop}`} out of turn this year.`
        : `${f.name} puts a field back to its turn: ${crop}.`,
      { kind: 'field', ...atFarm(f) },
    );
  }
  // ---- soil and manure (VB-137) ----
  // A reaped crop wears the field's soil.
  const wearSoil = (fd) => {
    const C = CROPS[fd.crop];
    fd.soil = C.gain
      ? Math.max(fd.soil, Math.min(SOIL.start, fd.soil + C.gain))
      : Math.max(SOIL.floor, fd.soil - C.wear); // peas mend it (VB-349)
  };
  // The loads a field has taken this year beyond its soil's need (VB-718): read as 0 when the year is not this one, so nothing resets it.
  // @state farmstead.fields[].surplus: loads of surplus dung taken in year surplusYear (absent: none); written only at manuring.
  const surplusOf = (st, fd) => (fd.surplusYear === Math.floor(st.t / YEAR) ? fd.surplus : 0);
  // In spring, while the heap holds a load, manure goes to the field with the poorest soil that is not yet sown: [field, loads, surplus] or null.
  // When no field wants dung for its soil, the heap's loads go for tilth to the field with the least, up to TILTH.surplus a field-year.
  function manureWanted(st, f, hh, c) {
    if (c.season !== 0 || c.sday < SOIL.window[0] || c.sday > SOIL.window[1] || !(hh.manure >= 1)) return null;
    let best = null;
    for (const fd of f.fields) {
      if ((fd.stage !== 'stubble' && fd.stage !== 'plowed') || fd.soil >= SOIL.cap - 1e-9) continue;
      if (!best || fd.soil < best.soil) best = fd;
    }
    if (best) return [best, Math.min(hh.manure, (SOIL.cap - best.soil) / SOIL.perLoad), false];
    let low = null,
      lowT = Infinity,
      room = 0;
    for (const fd of f.fields) {
      if (fd.stage !== 'stubble' && fd.stage !== 'plowed') continue;
      const left = TILTH.surplus - surplusOf(st, fd);
      if (left < 1 - 1e-9) continue;
      const t = tilthOf(st, fd);
      if (t < lowT) {
        low = fd;
        lowT = t;
        room = left;
      }
    }
    return low ? [low, Math.min(Math.floor(hh.manure + 1e-9), Math.floor(room + 1e-9)), true] : null;
  }
  // The manure is spread: each load the job carried raises the soil, as far as the heap still holds it; never below a fresh field's soil.
  function manureDone(st, fd, hh, loads) {
    const n = Math.max(0, Math.min(loads, hh.manure));
    hh.manure -= n;
    const extra = Math.max(0, n - Math.max(0, (SOIL.cap - fd.soil) / SOIL.perLoad)); // loads beyond the soil's need (VB-718)
    if (extra > 1e-9) {
      fd.surplus = surplusOf(st, fd) + extra;
      fd.surplusYear = Math.floor(st.t / YEAR);
    }
    fd.soil = Math.max(fd.soil, Math.min(SOIL.cap, fd.soil + n * SOIL.perLoad));
    fd.tilth = tilthOf(st, fd) + n * TILTH.perLoad; // the ground's slow soil, whatever the soil (VB-717)
    fd.tilthAt = st.t;
  }
  // @state farmstead.fields[].tilth: the field's tilth when last set (0 or more); tilthAt: the tick it was set; it fades as e^-(t/TILTH.years),
  //   read in closed form by tilthOf, and written only at manuring (VB-717). A field starts at 0 in every scenario.
  function tilthOf(st, fd) {
    VB.count.tilthRead++;
    return fd.tilth * Math.exp(-(st.t - fd.tilthAt) / (TILTH.years * YEAR));
  }
  // @state farmstead.fields[]: crop (a key of CROPS, sim/rules: a crop, or the course fallow, VB-348), stage, sown/reaped days, held sheaves and
  // weeding progress; changed only here after seeding.
  //   trampled: absent, or the times cattle got into the standing crop since it was sown (VB-136; each takes HERD.stray.loss of its yield)
  //   hoursOwn, hoursOther (VB-462): absent, or the year's work hours given by the user household's own members and by others
  //   weeds: absent, or the rounds of weeding posted since sowing (CROPS weeds; VB-334, VB-348)
  //   rest: absent, or a fallow field's rest this year (VB-348): 0.5 once it stood fallow at the summer's start, 1 once tilled; credited
  //   to the soil at the year's end, whatever the field bears by then (rye is sown on it in autumn)
  // A stubble field hoed for its crop; a fallow field (the course, not the stage) is tilled and stays in stubble.
  //   browsed: absent, or the times roe deer got into it since it was sown (VB-139; each takes DEER.crop.loss of its yield)
  const hoed = (fd) => {
    if (CROPS[fd.crop].fallow) fd.rest = 1;
    else fd.stage = 'plowed';
  };
  function sown(fd, c) {
    fd.stage = 'sown';
    fd.sown = c.day;
    fd.weedOpen = false;
    fd.weedPosted = null;
    fd.weedMiss = 0;
    delete fd.trampled;
    delete fd.weeds;
    delete fd.browsed;
  }
  // farmstead.fields[] also has hoursOwn (VB-462): the year's work hours given by its user household's own members, and
  // hoursOther: those given by others (owed days, later the hired: VB-319); absent until the first; zeroed after the class is reckoned (VB-318).
  //   Written only here, as work is reckoned (sim/agents).
  const book = (fd, own, dt) => {
    const k = own ? 'hoursOwn' : 'hoursOther';
    fd[k] = (fd[k] || 0) + dt;
  };
  // Cattle got into the standing crop (sim/byre, VB-136), or roe deer (`deer`; sim/deer, VB-139).
  const trample = (fd, deer = false) => {
    if (deer) fd.browsed = (fd.browsed || 0) + 1;
    else fd.trampled = (fd.trampled || 0) + 1;
  };
  // The crop as it stands on field fd, in rations (VB-475): what the field would give at reaping but for the reaping's own draw: its
  // crop's yield by the field's fertility, soil and tilth, the year's weather, the weeding missed (`missed` more rounds: the one open at
  // reaping), the strays' trampling and the deer's browsing. Read by the reaping's hours (sim/fieldwork) and by the reaping.
  function standing(st, fd, missed = 0) {
    const E = st.ECON;
    return (
      CROPS[fd.crop].yield *
      fd.fert *
      fd.soil *
      (1 + tilthOf(st, fd)) *
      st.weather *
      (1 - Math.min(E.weedCutMax, E.weedCut * (fd.weedMiss + missed))) *
      (1 - HERD.stray.loss) ** (fd.trampled || 0) *
      (1 - DEER.crop.loss) ** (fd.browsed || 0)
    );
  }
  function reaped(st, fd, c) {
    if (fd.weedOpen) fd.weedMiss++;
    fd.stage = 'stooks';
    fd.reaped = c.day;
    fd.held = Math.round(standing(st, fd) * (0.9 + rnd(st.rng.fields) * 0.2));
    delete fd.trampled;
    delete fd.browsed;
    delete fd.bin;
    delete fd.weeds;
    wearSoil(fd); // the crop takes from the soil (VB-137)
    fd.weedOpen = false;
    fd.weedPosted = null;
    fd.weedMiss = 0;
  }
  const hauled = (fd) => {
    fd.held = 0;
    fd.stage = 'stubble';
    fd.sown = null;
    nextStep(fd); // the crop is in (VB-350)
  };
  // A load of at most `cap` rations is taken from the stooks (VB-335); the field is hauled when the last is gone. `bin` is the barn entry
  // (sim/stores sheaf) holding the field's loads so far.
  function carried(fd, cap) {
    const n = Math.min(cap, fd.held);
    fd.held -= n;
    if (fd.held <= 0) hauled(fd);
    return n;
  }
  // A load set down by a carrier released on the road (VB-581) lies with the stooks for the next hand: the field is not hauled after all.
  function laidDown(fd, n) {
    fd.held += n;
    fd.stage = 'stooks';
  }
  const binned = (fd, seq) => {
    fd.bin = seq;
  };
  function reclaimed(st, fd) {
    clearScrub(st, fd.tile); // the forest's scrub on it is cleared with the grass (VB-091)
    if (fd.stage === 'fallow' || fd.stage === 'scrub') fd.stage = 'stubble'; // its picture follows the stage (page/animate)
  }
  const weeded = (fd) => {
    fd.weedOpen = false;
  };
  function abandoned(f) {
    for (const fd of f.fields) {
      if (fd.stage !== 'stubble') fd.held = 0;
      fd.stage = 'stubble';
      fd.sown = null;
    }
  }
  // A ripe field still standing on its crop's `lost` day is lost (rye by the autumn's first day; VB-348).
  function lostRipe(st, f, fd, c) {
    const L = CROPS[fd.crop].lost;
    if (!L || fd.stage !== 'ripe' || c.season !== L[0] || c.sday !== L[1]) return;
    fd.stage = 'stubble';
    fd.sown = null;
    fd.weedOpen = false;
    delete fd.weeds;
    delete fd.trampled;
    nextStep(fd); // the crop is lost: the field goes on to its next course (VB-350)
    log(st, `A crop at ${placeName(f)} was lost, left standing too long.`, { kind: 'frost', ...placeOf(f) });
  }
  // A field's holder as its log line names it: a farm, or a village for its common fields (VB-100).
  const isVillage = (x) => 'center' in x;
  const placeName = (x) => (isVillage(x) ? `the common field of ${x.name}` : x.name);
  const placeOf = (x) => (isVillage(x) ? { village: x.id } : atFarm(x));
  // The fields being worked: each occupied farm's, then each village's common fields (VB-100), as fn(holder, field).
  function eachWorked(st, fn) {
    for (const f of st.farmsteads) if (f.household !== null) for (const fd of f.fields) fn(f, fd);
    for (const v of st.villages) if (v.commonFields) for (const fd of v.commonFields) fn(v, fd);
  }
  // Fallow's rest (VB-348): marked on the summer's first day on each fallow field of an occupied farm (tilled since: 1), credited on the
  // year's last day: CROPS.fallow.mend times the mark, to at most SOIL.start (a field manured above it keeps its soil).
  // A fallow course whose field stood the summer (its rest marked) ends on the autumn's first day, and the field goes on to its next step:
  // in three courses, rye sown that autumn (VB-350).
  function rest(st, c) {
    const summer = c.season === 1 && c.sday === 0,
      autumn = c.season === 2 && c.sday === 0,
      end = c.season === 3 && c.sday === SEASON_DAYS - 1;
    if (!summer && !end && !autumn) return;
    for (const f of st.farmsteads)
      for (const fd of f.fields) {
        if (summer && f.household !== null && CROPS[fd.crop].fallow && fd.rest === undefined) fd.rest = 0.5;
        if (autumn && CROPS[fd.crop].fallow && fd.rest !== undefined) nextStep(fd);
        if (end && fd.rest !== undefined) {
          fd.soil = Math.max(fd.soil, Math.min(SOIL.start, fd.soil + CROPS.fallow.mend * fd.rest));
          delete fd.rest;
        }
      }
  }
  // Daily crop rules, after routes and before buildings and fences decay. No random draws.
  function fieldsDay(st, c) {
    const E = st.ECON;
    const day = Math.floor(st.t / DAY);
    eachWorked(st, (f, fd) => {
      if (fd.sown === null || fd.stage === 'stooks') return;
      const g = day - fd.sown;
      if (g >= CROPS[fd.crop].ripe) fd.stage = 'ripe';
      else if (g >= 3 && fd.stage === 'sown') fd.stage = 'growing';
      lostRipe(st, f, fd, c);
    });
    // upkeep: a growing field wants its crop's rounds of weeding (CROPS weeds), the next falling due E.weedDays[round] days after sowing; a
    // round still open when the next falls due, or at ripening (reaped), counts as missed
    eachWorked(st, (f, fd) => {
      if (fd.stage !== 'growing') return;
      const n = fd.weeds || 0;
      if (n >= CROPS[fd.crop].weeds || day - fd.sown < E.weedDays[n]) return;
      if (fd.weedOpen) fd.weedMiss++;
      fd.weedOpen = true;
      fd.weedPosted = day;
      fd.weeds = n + 1;
    });
    rest(st, c);
    unsown(st, c);
    // Untended fields go to grass, unless a claimant is restoring the farm; a field the forest has grown into is scrub (sim/spread, VB-091).
    for (const f of st.farmsteads)
      if (f.household === null && !Projects.onFarm(st, f.id)) {
        const yrs = (st.t - f.emptySince) / YEAR;
        for (const fd of f.fields) {
          const w = st.w,
            scrub = w.treesMax[fd.tile] > 0 && w.trees[fd.tile] >= SPREAD.scrub * w.treesMax[fd.tile];
          const want = scrub ? 'scrub' : yrs > 1 || fd.stage === 'scrub' ? 'fallow' : fd.stage;
          fd.stage = want;
        }
      }
  }
  // The autumn frost, on the season's last day (sim/clock, CALENDAR: fieldsFrost, after fieldsDay): a crop still standing or in stooks is lost;
  // a winter crop (rye) standing green is not (VB-348).
  function fieldsFrost(st) {
    const lost = new Map(); // one line a holder, not one a field: holder -> {stage: count}
    eachWorked(st, (f, fd) => {
      if (CROPS[fd.crop].winter && fd.stage === 'growing') return;
      if (['ripe', 'growing', 'stooks'].includes(fd.stage)) {
        const k = fd.crop + ' ' + (STOOD[fd.stage] || fd.stage);
        if (!lost.has(f)) lost.set(f, new Map());
        lost.get(f).set(k, (lost.get(f).get(k) || 0) + 1);
        fd.stage = 'stubble';
        fd.sown = null;
        fd.held = 0;
        fd.weedOpen = false;
        delete fd.weeds; // the crop is gone, and its weeding with it (a lost barley field going fallow kept its rounds)
        delete fd.trampled;
        delete fd.browsed;
        nextStep(fd); // VB-350
      }
    });
    for (const [f, m] of lost) {
      const what = [...m].map(([k]) => k.split(' ')),
        crops = [...new Set(what.map((w) => w[0]))],
        stood = [...new Set(what.map((w) => w.slice(1).join(' ')))];
      log(st, `Frost took the ${crops.join(' and ')} at ${placeName(f)}, ${stood.join(' and ')}.`, {
        kind: 'frost',
        ...placeOf(f),
      });
    }
  }
  const STOOD = { ripe: 'ripe and not yet reaped', stooks: 'in stooks', growing: 'still growing' };
  return {
    takeRotation,
    outOfTurn,
    restagger,
    book,
    hoed,
    sown,
    trample,
    reaped,
    standing,
    tilthOf,
    carried,
    laidDown,
    binned,
    reclaimed,
    weeded,
    abandoned,
    fieldsDay,
    fieldsFrost,
    finishClear,
    clearStones,
    finishBreak,
    broken,
    manureWanted,
    surplusOf,
    manureDone,
  };
})();
