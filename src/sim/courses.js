// @sys sim/courses [material]: a field's course in its farm's rotation: the next step, a rotation taken and its fields staggered, a new field placed,
// two fields' steps swapped, a crop out of turn, and the crop last lost that the next year's choice remembers (VB-350, VB-351, VB-355)
VB['sim/courses'] = (() => {
  const { underCrop, fieldAt, courseFor } = VB['sim/rotations'];
  const { cal } = VB['sim/rules'],
    { CROPS, ROTATIONS } = VB['sim/crops'];
  const { log, atFarm } = VB['sim/records'];
  const isVillage = (x) => 'center' in x; // a village's common field (VB-100) remembers no lost crop
  // The crop year's part in a change of course (sim/fields owns the stage and the weeding): a hoed field whose course is now fallow lies
  // in stubble, and a field with no crop standing has no weeding left.
  function lies(fd) {
    if (CROPS[fd.crop].fallow && fd.stage === 'plowed') fd.stage = 'stubble'; // lint-allow: owner the stage a change of course leaves (sim/fields' record)
  }
  function unweeded(fd) {
    delete fd.weeds; // lint-allow: owner a field with no crop standing has no weeding (sim/fields' record)
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
    if (!underCrop(fd)) unweeded(fd);
    lies(fd);
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
      unweeded(fd); // no crop stands: a lost crop's weeding goes with it (VB-999's reviews at rye's close met it)
      lies(fd);
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
    // a farm that now sows one crop has no other to turn to after a failure (failed's own rule): what it remembers of one goes
    if (changed && f.failed && ROTATIONS[key].courses.filter((k) => CROPS[k].seed > 0).length < 2) delete f.failed;
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
  // The fields of farm f on tiles a and b exchange their courses (swapWhy holds; the verb courses, VB-351): each takes the other's step and
  // crop, so the farm's fields stay staggered and the worn one rests first. A hoed field going fallow lies in stubble.
  function swapSteps(st, f, a, b) {
    const x = fieldAt(f, a),
      y = fieldAt(f, b);
    [x.step, y.step] = [y.step, x.step];
    [x.crop, y.crop] = [y.crop, x.crop];
    for (const fd of [x, y]) lies(fd);
    const rest = CROPS[x.crop].seed > 0 ? y : x,
      sown = rest === x ? y : x;
    log(st, `${f.name} rests its poorer field and sows ${sown.crop} on the better one.`, {
      kind: 'field',
      ...atFarm(f),
    });
  }
  // @state farmstead.failed: absent, or {crop, year}: the crop last lost on a field of the farm, to the frost or left standing, and the year
  //   of cal it was lost in (VB-351): the year after, an ordinary or good head sows more of another crop (sim/rotations' fieldsChoice).
  //   Kept only on a farm whose rotation has two crops or more, so a farm of barley alone holds none.
  // @notstock farmstead.failed: land, buildings and their records (fields, meadows, a site's timber)
  function failed(st, f, fd) {
    if (isVillage(f) || ROTATIONS[fd.rotation].courses.filter((k) => CROPS[k].seed > 0).length < 2) return;
    f.failed = { crop: fd.crop, year: cal(st.t).year };
  }
  // The field on `tile` bears `crop` this year, out of turn (turnWhy holds): its step stays, and when the crop is in, or lost, or its
  // window closes, the field goes on to its next step as after any course. Nothing is sown here: the household's work does that.
  function outOfTurn(st, f, tile, crop) {
    const fd = fieldAt(f, tile);
    fd.crop = crop;
    if (ROTATIONS[fd.rotation].courses[fd.step] === crop) delete fd.turn;
    else fd.turn = true;
    lies(fd);
    log(
      st,
      fd.turn
        ? `${f.name} ${CROPS[crop].fallow ? 'rests a field' : `sows a field with ${crop}`} out of turn this year.`
        : `${f.name} puts a field back to its turn: ${crop}.`,
      { kind: 'field', ...atFarm(f) },
    );
  }
  return { nextStep, restagger, placeField, takeRotation, swapSteps, failed, outOfTurn };
})();
