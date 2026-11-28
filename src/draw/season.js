// @sys draw/season: the season's look of the map, a band at a time (VB-083; design.md, Climate and travel beyond walking): the tint of
// the land, the snow and the ice of each band of rows, read from the band's state and dates (sim/climate) and the hour; and the colours
// the land, the water and the ways are painted in for each. It reads the run and writes nothing (Rules for cost 7).
VB['draw/season'] = (() => {
  const { DAY, SEASON_DAYS, YEAR_DAYS } = VB['sim/rules'];
  const { B } = VB['world/biomes'];
  const Climate = VB['sim/climate'];
  // The land's tint: summer's full green, spring's fresh green, autumn's ochre and russet, winter's bare broadleaf with no snow, snow.
  const TINT = Object.freeze({ summer: 0, spring: 1, autumn: 2, bare: 3, snow: 4 });
  // The ice on a band's water: none, ice that does not bear (the freeze-up and the break-up), ice that bears.
  const ICE = Object.freeze({ none: 0, weak: 1, bears: 2 });
  // How long the turn of the colours lasts, in days: the leaves turn `autumn` days before the band's frost (snow lies), and the green is
  // fresh from the thaw to `spring` days after the water is open. A look, not a rule: no decider reads it.
  const TURN = Object.freeze({ autumn: 8, spring: 10 });
  const SNOWY = new Set(['frost', 'lakeBears', 'soundShut', 'soundBears']);
  // A band's look as one code: tint, lake and river ice, sea ice within reach of land (sim/walking's seaNear, as the ice is walked).
  const code = (tint, lake, sea) => tint * 9 + lake * 3 + sea;
  const tintOf = (c) => (c / 9) | 0,
    lakeOf = (c) => ((c / 3) | 0) % 3,
    seaOf = (c) => c % 3;
  // The tint of the calendar alone, where the band has no frost this year (or no climate yet): autumn's last days and the winter bare,
  // spring's first days fresh.
  function calendarTint(t) {
    const doy = Math.floor(t / DAY) % YEAR_DAYS,
      season = Math.floor(doy / SEASON_DAYS),
      day = doy % SEASON_DAYS;
    if (season === 3) return TINT.bare;
    if (season === 2 && day >= SEASON_DAYS - TURN.autumn) return TINT.autumn;
    if (season === 0 && day < TURN.spring) return TINT.spring;
    return TINT.summer;
  }
  // A band's normal winter (warmth 0) at its latitude, its dates as days of the year (0-based; sim/climate datesOf counts from autumn
  // day 1): what the turn of the colours follows. The year's own dates are a draw ahead of the day (sim/climate's @drawn), read by no one
  // before they fall; the look reads the band's state now (bandState) and this normal. A pure function of the latitude, kept a latitude.
  const AUTUMN = 2 * SEASON_DAYS,
    normals = new Map(); // lint-allow: derived from the latitude alone, as sim/climate's shifts; holds nothing of a run
  function normalOf(lat) {
    let n = normals.get(lat);
    if (!n) {
      const d = Climate.datesOf(lat, 0),
        doy = (k) => (k === null ? null : (AUTUMN + k) % YEAR_DAYS);
      n = Object.freeze({ frost: doy(d.frost), open: doy(d.open), shuts: d.soundShut !== null });
      normals.set(lat, n);
    }
    return n;
  }
  // The look of a band in state `state` (sim/climate bandState) at latitude `lat`, at hour t: snow from the frost to the thaw; the
  // leaves turning TURN.autumn days before the band's normal frost and until snow lies, the green fresh from the thaw to TURN.spring days
  // after its normal open water; lake ice from the frost, bearing from lakeBears; sea ice from soundShut, bearing from soundBears; at the
  // thaw no ice bears, until the water is open (the sea's where the sound shuts in a normal winter). No state: the calendar's tint.
  function bandLook(state, lat, t) {
    if (!state) return code(calendarTint(t), ICE.none, ICE.none);
    const n = normalOf(lat),
      doy = Math.floor(t / DAY) % YEAR_DAYS;
    let tint, lake, sea;
    if (SNOWY.has(state)) tint = TINT.snow;
    else if (state === 'thaw') tint = TINT.spring;
    else if (n.frost === null) tint = calendarTint(t);
    else if (doy >= AUTUMN) tint = doy >= n.frost - TURN.autumn ? TINT.autumn : TINT.summer;
    else tint = doy < n.open + TURN.spring ? TINT.spring : TINT.summer;
    if (state === 'frost') lake = ICE.weak;
    else if (SNOWY.has(state)) lake = ICE.bears;
    else lake = state === 'thaw' ? ICE.weak : ICE.none;
    if (state === 'soundShut') sea = ICE.weak;
    else if (state === 'soundBears') sea = ICE.bears;
    else sea = state === 'thaw' && n.shuts ? ICE.weak : ICE.none;
    return code(tint, lake, sea);
  }
  // Each band's look now: an array of codes, by band (0 the northmost).
  function looks(st) {
    const out = [],
      on = !!(st && st.w); // a run with no climate yet (a save before VB-807): every band open, its normal winter's tint
    for (let b = 0; b < Climate.CLIMATE.bands; b++)
      out.push(
        on ? bandLook(Climate.bandState(st, b), Climate.bandLat(st.w, b), st.t) : bandLook(null, 0, st ? st.t : 0),
      );
    return out;
  }
  // The rows' looks from the bands' (a Uint8Array a row), for the painters: what a chunk is painted in.
  function rowLooks(w, bands) {
    const rows = new Uint8Array(w.ROWS);
    for (let r = 0; r < w.ROWS; r++) rows[r] = bands[Climate.bandOfRow(w, r)];
    return rows;
  }
  // ---- the colours ----
  // The tint mixes a land tile's own colour towards a colour by an amount, by biome: [r, g, b, amount]. Pine stays green; snow lies thinner
  // on the eye where trees stand. By TINT, then biome code (world/biomes B).
  const toward = (c, k) => [c[0], c[1], c[2], k];
  const FRESH = [168, 204, 112],
    OCHRE = [204, 170, 92],
    RUSSET = [178, 110, 62],
    BARE = [146, 128, 102],
    STRAW = [184, 170, 124],
    SNOW = [240, 243, 247];
  const MIX = [];
  MIX[TINT.summer] = {};
  MIX[TINT.spring] = {
    [B.MEADOW]: toward(FRESH, 0.35),
    [B.FOREST]: toward(FRESH, 0.3),
    [B.HEATH]: toward(FRESH, 0.12),
  };
  MIX[TINT.autumn] = {
    [B.MEADOW]: toward(OCHRE, 0.45),
    [B.FOREST]: toward(RUSSET, 0.5),
    [B.HEATH]: toward(RUSSET, 0.3),
    [B.MARSH]: toward(OCHRE, 0.3),
    [B.HILLS]: toward(OCHRE, 0.2),
  };
  MIX[TINT.bare] = {
    [B.MEADOW]: toward(STRAW, 0.45),
    [B.FOREST]: toward(BARE, 0.55),
    [B.HEATH]: toward(BARE, 0.3),
    [B.MARSH]: toward(STRAW, 0.35),
  };
  MIX[TINT.snow] = {};
  for (let b = B.BEACH; b <= B.SNOW; b++)
    MIX[TINT.snow][b] = toward(SNOW, b === B.PINE ? 0.62 : b === B.FOREST ? 0.74 : 0.84);
  // The ice: that which bears is white and solid, that which does not is a dark slate with pale streaks; the same on a lake, a river and
  // the sea (principle "Like is shown alike"), and the key says which is which (page/chunks).
  const ICE_RGB = Object.freeze([null, [124, 150, 160], [226, 234, 240]]);
  const ICE_STREAK = Object.freeze([null, [176, 196, 204], [204, 216, 226]]);
  const ICE_CSS = Object.freeze([null, 'rgb(124,150,160)', 'rgb(226,234,240)']);
  // The ways under snow: trodden snow, blue-grey at the edge and pressed pale in the middle (paths' LOOK.layers, a layer a width).
  const TRODDEN = Object.freeze([
    [2.3, [null, 'rgba(120,140,160,0.14)', 'rgba(120,140,160,0.20)', 'rgba(120,140,160,0.26)']],
    [1.35, [null, 'rgba(110,128,146,0.22)', 'rgba(104,122,142,0.36)', 'rgba(98,116,138,0.46)']],
    [1, [null, 'rgba(198,206,214,0.55)', 'rgba(196,204,214,0.88)', 'rgba(192,202,212,0.95)']],
    [0.42, [null, null, 'rgba(226,230,236,0.45)', 'rgba(230,234,240,0.6)']],
  ]);
  return {
    TINT,
    ICE,
    TURN,
    code,
    tintOf,
    lakeOf,
    seaOf,
    bandLook,
    looks,
    rowLooks,
    MIX,
    ICE_RGB,
    ICE_STREAK,
    ICE_CSS,
    TRODDEN,
  };
})();
