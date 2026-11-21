// @sys sim/rotations: crop courses, sowing choices and village rotation customs
VB['sim/rotations'] = (() => {
  const { CROPS, ROTATIONS, cal, SEASON_DAYS, YEAR_DAYS } = VB['sim/rules'];
  const { log } = VB['sim/records'];
  const Stores = VB['sim/stores'];
  // ---- rotations (VB-350; design.md, Crops and rotations, The rotation) ----
  // @state farmstead.fields[].rotation: a key of ROTATIONS (sim/rules), the same on every field of a farm; step: the field's place in it,
  //   whose course is the field's crop. A village's common fields (VB-100) hold barley every year.
  // @state village.rotation: the village's usual rotation, a key of ROTATIONS: the one most of its farms hold, brought up to date at its
  //   autumn meeting and at no other time (usualRotation; Kim, 11 Nov). Owned here, as a reading of its farms' fields (target-v2 4.3).
  // @state farmstead.fields[].turn: absent, or true: the field's crop was chosen out of turn for a year (the verb sowOutOfTurn, VB-355) and
  //   is not its step's course; cleared when the field goes on to its next step, or its farm changes rotation.
  // @state farmstead.rotationBy: absent, or the id of the household whose head chose the farm's rotation to keep (the verb rotation with
  //   hold, VB-355): while that household holds the farm, its rule (rotationChoice) leaves the rotation alone.
  // @state farmstead.firstRotation: absent, or a key of ROTATIONS: the rotation the farm's first fields take where its own differs from its
  //   village's (the scenarios' crops, VB-353; rotationOf)
  // @state farmstead.keeps: absent, or crops[] the farm holds a field's seed of and does not sow (the founders' backup farm; sim/hunger
  //   seedNeed, sim/plans reserveSeed)
  const underCrop = (fd) =>
    fd.stage === 'sown' || fd.stage === 'growing' || fd.stage === 'ripe' || fd.stage === 'stooks';
  // The rotation a farm's household holds: its fields' (the same on each); with no field yet, its village's usual one where it has the
  // seed, else barley every year.
  function rotationOf(st, hh) {
    const f = hh.farmstead === null || hh.farmstead === undefined ? null : st.farmsteads[hh.farmstead];
    if (!f) return 'every';
    if (f.fields.length) return f.fields[0].rotation;
    if (f.firstRotation && hasSeed(st, f, hh, f.firstRotation)) return f.firstRotation; // the farm's own (VB-353), else its village's
    const v = f.village === null ? null : st.villages[f.village];
    return v && v.rotation && hasSeed(st, f, hh, v.rotation) ? v.rotation : 'every';
  }
  // Has household hh crop k: a field's seed of it in store, or a field of its farm f bearing it now (its seed is in the ground).
  const hasCrop = (st, f, hh, k) =>
    Stores.grainOf(hh, k) >= CROPS[k].seed || f.fields.some((fd) => fd.crop === k && underCrop(fd));
  // Has it every crop of rotation `key` (design.md, The rotation, Seed bounds them).
  const hasSeed = (st, f, hh, key) => ROTATIONS[key].courses.every((k) => CROPS[k].fallow || hasCrop(st, f, hh, k));
  // The crop of a field due for sowing, in its window, that the household holds less than a field's seed of; null for none.
  function shortOf(f, hh, c) {
    for (const fd of f.fields) {
      const C = CROPS[fd.crop];
      if (!(C.seed > 0) || fd.turn || (fd.stage !== 'stubble' && fd.stage !== 'plowed')) continue; // a field out of turn waits (VB-355)
      if (c.season === C.sow[0] && c.sday >= C.sow[1] && c.sday <= C.sow[2] && Stores.grainOf(hh, fd.crop) < C.seed)
        return fd.crop;
    }
    return null;
  }
  // The rotation a holder short of crop `short` falls back on: of those without it that it has seed for, the one that keeps most of its
  // sown crops, then one with a fallow course (the field it cannot sow lies fallow), then the first in ROTATIONS; null for none (it keeps
  // what it holds, and the field waits unsown: barley is in every rotation).
  function fallback(st, f, hh, from, short) {
    const was = ROTATIONS[from].courses;
    let best = null,
      bs = -1;
    for (const key in ROTATIONS) {
      if (ROTATIONS[key].courses.includes(short) || !hasSeed(st, f, hh, key)) continue;
      const R = ROTATIONS[key].courses;
      let s = R.some((k) => CROPS[k].fallow) ? 1 : 0;
      for (const k of R) if (!CROPS[k].fallow && was.includes(k)) s += 2;
      if (s > bs) {
        bs = s;
        best = key;
      }
    }
    return best;
  }
  // The rotation and course a new field beside `others` takes (placeField's rule): {key, i}.
  function courseFor(st, others, hh) {
    const key = others.length ? others[0].rotation : hh ? rotationOf(st, hh) : 'every',
      R = ROTATIONS[key].courses,
      at = R.map((k, i) => others.filter((q) => q.step === i).length),
      least = Math.min(...at),
      c = cal(st.t),
      wait = (k) => {
        const W = CROPS[k].sow,
          first = W[0] * SEASON_DAYS + W[1],
          last = W[0] * SEASON_DAYS + W[2];
        return CROPS[k].fallow
          ? Infinity
          : c.doy >= first && c.doy <= last
            ? 0
            : (first - c.doy + YEAR_DAYS) % YEAR_DAYS;
      }; // days until course k is sown
    let i = -1;
    for (let j = 0; j < R.length; j++) if (at[j] === least && (i < 0 || wait(R[j]) < wait(R[i]))) i = j;
    return { key, i };
  }
  // The holder's rule for its rotation, at each review of its plan (the simplest head, VB-350): it takes its village's usual rotation when
  // it has the seed for it; short of a crop's seed at its sowing, it falls back on a rotation it has seed for, and the field at that course
  // lies fallow. A change waits while a field stands under a crop the new rotation has not. {to, short} for the verb `rotation`, which
  // carries it out (sim/plans issues it, source 'pawn'; VB-355), or null: no change, or its head chose the rotation to keep (rotationBy).
  function rotationChoice(st, f, hh, c) {
    if (!f.fields.length || f.rotationBy === hh.id) return null;
    const from = f.fields[0].rotation,
      v = f.village === null ? null : st.villages[f.village],
      usual = (v && v.rotation) || 'every';
    let to = null,
      short = null;
    if (usual !== from && hasSeed(st, f, hh, usual)) to = usual;
    else if ((short = shortOf(f, hh, c)) !== null) to = fallback(st, f, hh, from, short);
    return to === null || waitsFor(f, to) ? null : { to, short };
  }
  // The field of farm f under a crop that rotation `key` has not, for which a change to it waits; undefined for none.
  const waitsFor = (f, key) => f.fields.find((fd) => underCrop(fd) && !ROTATIONS[key].courses.includes(fd.crop));
  // ---- the head's choice (VB-355; design.md, How the head chooses what to sow, The player as head): the checks and the acts of the verbs
  // `rotation` and `sowOutOfTurn` (sim/commands), which bind any holder alike: the seed, the window, a free field ----
  const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  const windowOf = (k) => `in ${SEASONS[CROPS[k].sow[0]]}, days ${CROPS[k].sow[1] + 1} to ${CROPS[k].sow[2] + 1}`;
  const noSeed = (f, hh, k) =>
    `${f.name} has no seed of ${k}: a field takes ${CROPS[k].seed} and its store holds ${Math.floor(Stores.grainOf(hh, k))}`;
  // Why household hh cannot take rotation `key` on its farm f, or null. null as the key gives the choice back to its rule.
  function rotationWhy(st, f, hh, key) {
    if (key === null) return null;
    if (typeof key !== 'string' || !Object.prototype.hasOwnProperty.call(ROTATIONS, key))
      return `there is no rotation ${key}`;
    if (!f.fields.length) return `${f.name} has no field yet`;
    const lacks = ROTATIONS[key].courses.find((k) => !CROPS[k].fallow && !hasCrop(st, f, hh, k));
    if (lacks) return noSeed(f, hh, lacks);
    const fd = waitsFor(f, key);
    return fd
      ? `a field stands under ${fd.crop}, which ${ROTATIONS[key].label} has not: the change waits for its harvest`
      : null;
  }
  const fieldAt = (f, tile) => f.fields.find((fd) => fd.tile === tile);
  // Why the field of farm f on `tile` cannot bear `crop` (a crop of the table, or fallow: a year's rest) out of turn this year, or null:
  // the field is free (in stubble or hoed), the crop's sowing window is open today and the store holds a field's seed of it. Its own
  // course is a choice too, while it stands out of turn: back to its turn.
  function turnWhy(st, f, hh, tile, crop, c) {
    const fd = fieldAt(f, tile);
    if (!fd) return `${f.name} has no field on tile ${tile}`;
    if (typeof crop !== 'string' || !Object.prototype.hasOwnProperty.call(CROPS, crop))
      return `there is no crop ${crop}`;
    if (fd.stage !== 'stubble' && fd.stage !== 'plowed')
      return underCrop(fd)
        ? `the field is under ${fd.crop}: it is free when its crop is in`
        : 'the field is untended: it is reclaimed first';
    if (fd.crop === crop) return `the field bears ${crop} next as it is`;
    const C = CROPS[crop];
    if (C.fallow) return null;
    if (!(c.season === C.sow[0] && c.sday >= C.sow[1] && c.sday <= C.sow[2]))
      return `${crop} is sown ${windowOf(crop)}`;
    return Stores.grainOf(hh, crop) < C.seed ? noSeed(f, hh, crop) : null;
  }
  // A farm's field as its tile's card shows it (the page; VB-355): its crop and whether it stands out of turn, its rotation and step, what
  // is sown on it next and when, the seed its household holds of each crop, and, for its head, each rotation and each crop out of turn
  // with why it cannot be chosen today (the verbs' own checks). Computed when asked, stored nowhere; null where no farm has a field.
  function fieldView(st, tile) {
    const f = st.farmsteads.find((q) => fieldAt(q, tile));
    if (!f) return null;
    const fd = fieldAt(f, tile),
      hh = f.household === null ? null : st.households[f.household],
      R = ROTATIONS[fd.rotation].courses,
      c = cal(st.t),
      free = fd.stage === 'stubble' || fd.stage === 'plowed';
    let next = free && CROPS[fd.crop].seed > 0 ? fd.crop : null;
    for (let i = 1; next === null && i <= R.length; i++) {
      const k = R[(fd.step + i) % R.length];
      if (CROPS[k].seed > 0) next = k;
    }
    return {
      farm: f.id,
      household: f.household,
      crop: fd.crop,
      stage: fd.stage,
      turn: fd.turn === true,
      rotation: fd.rotation,
      label: ROTATIONS[fd.rotation].label,
      courses: [...R],
      step: fd.step,
      kept: hh !== null && f.rotationBy === hh.id,
      next: next === null ? null : { crop: next, when: windowOf(next) },
      seed: hh
        ? Object.keys(CROPS)
            .filter((k) => CROPS[k].seed > 0)
            .map((k) => ({ crop: k, held: Stores.grainOf(hh, k), field: CROPS[k].seed }))
        : [],
      rotations: hh
        ? Object.keys(ROTATIONS).map((key) => ({
            key,
            label: ROTATIONS[key].label,
            courses: [...ROTATIONS[key].courses],
            why: rotationWhy(st, f, hh, key),
          }))
        : [],
      crops: hh ? Object.keys(CROPS).map((k) => ({ crop: k, why: turnWhy(st, f, hh, tile, k, c) })) : [],
    };
  }
  // The village's usual rotation, a step of its autumn meeting (sim/meetings): the one most of its occupied farms hold; a tie keeps the
  // one it has, else the first in ROTATIONS.
  function usualRotation(st, v) {
    const n = {};
    VB.count.rotationWalk += v.farmsteads.length;
    for (const id of v.farmsteads) {
      const f = st.farmsteads[id];
      if (f.household !== null && f.fields.length) n[f.fields[0].rotation] = (n[f.fields[0].rotation] || 0) + 1;
    }
    let best = v.rotation,
      bn = n[v.rotation] || 0;
    for (const key in ROTATIONS)
      if ((n[key] || 0) > bn) {
        best = key;
        bn = n[key];
      }
    if (best === v.rotation) return;
    v.rotation = best;
    log(st, `${v.name} now farms ${ROTATIONS[best].label} as a rule.`, { kind: 'custom', village: v.id });
  }
  return { underCrop, fieldAt, rotationOf, courseFor, rotationChoice, rotationWhy, turnWhy, fieldView, usualRotation };
})();
