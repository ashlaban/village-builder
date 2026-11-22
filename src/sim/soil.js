// @sys sim/soil: a field's soil and tilth: worn by a crop, mended by manure, the heap's loads carted to the field that wants them (VB-137, VB-717, VB-718)
VB['sim/soil'] = (() => {
  const { YEAR } = VB['sim/rules'],
    { CROPS, SOIL } = VB['sim/crops'];
  // @tunable TILTH: tilth (VB-717; docs/review-yields.md, 4): a field's slow soil, built by dung and fading over decades. Estimates, with no medieval
  // Nordic source. `perLoad`: what one load of manure adds to a field's tilth (on top of its soil); `years`: the time constant of its
  // fading, in game years (e^-1 left after that long without dung); `max`: a bound for the invariant, which play should never reach.
  // A harvest is multiplied by 1 + tilth ----
  const TILTH = { perLoad: 0.0011, years: 70, max: 0.4, surplus: 2 };
  // A reaped crop wears the field's soil.
  const wearSoil = (fd) => {
    const C = CROPS[fd.crop];
    fd.soil = C.gain
      ? Math.max(fd.soil, Math.min(SOIL.start, fd.soil + C.gain))
      : Math.max(SOIL.floor, fd.soil - C.wear); // peas mend it (VB-349)
  };
  // A fallow year's rest mends the soil (VB-348): CROPS.fallow.mend times the field's mark, to at most SOIL.start (a field manured above
  // it keeps its soil). Credited on the year's last day (sim/fields' rest).
  const rested = (fd) => {
    fd.soil = Math.max(fd.soil, Math.min(SOIL.start, fd.soil + CROPS.fallow.mend * fd.rest));
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
  return { TILTH, wearSoil, rested, surplusOf, manureWanted, manureDone, tilthOf };
})();
