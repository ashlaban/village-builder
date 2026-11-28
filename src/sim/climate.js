// @sys sim/climate [kernel]: the climate by latitude (VB-807; design.md, Climate and travel beyond walking): a world's latitude, the map read in
// bands of rows, each band's curve of the year's temperature, and the winter's dates, reckoned once a year on autumn day 1 from the
// curve and the winter's warmth and taken from a due-queue as they fall; and how far a world's growing year lies from the middle world's.
// The weather (sim/weather) draws the seasons and the year's thaw and frost about the normal; this module holds the normal itself, by
// latitude, and the dates it gives the ground and the water: as a date falls, its band's rows come to the ground of its state
// (sim/walking's compiled ground, VB-808), and the ground of a normal winter is what the winter table of hours is searched over.
VB['sim/climate'] = (() => {
  const { DAY, SEASON_DAYS, YEAR_DAYS } = VB['sim/rules'];
  // A table one domain reads lives in its domain (VB-419).
  // @tunable CLIMATE: worlds, the four climates a world is made in, by the latitude of its middle row in degrees north (middle, the default:
  //   every world made before VB-807 is the middle world); degPerRow, how much further north a row is than the row below it, so the map's
  //   north is colder (a compression of 200 rows to 3 degrees, as the distances are compressed); bands, the map read in that many bands of
  //   rows, each at its middle row and at sea level. The year's curve of a band's daily mean temperature (degrees C): janAt56, the January
  //   mean at 56 north, falling janPerDeg a degree further north; julAt56 and julPerDeg the July mean's; coldest, the winter day (1 to 12)
  //   the curve is coldest; swing, the degrees a hard (the winter's warmth -1) or a mild (1) winter moves the cold half of the year at its
  //   coldest. The winter's dates, each the first day of its kind: snow, the mean below which snow lies and the ground bears (the frost);
  //   lake, soundShut and sound, the degree-days of frost by which lake ice bears, the sound shuts to boats and sound ice bears; rot, the
  //   degree-days of thaw by which no ice bears, snow goes and the ground is soft (the thaw); open, those by which water is open and the
  //   ground firm. realDays, the days of freezing or thawing a game day stands for (365 / 48). grow, the mean at which growth starts and
  //   ends: a world's thaw and first frost move by the days its curve crosses it later or earlier than the middle world's (VB-354's draw
  //   stands on the middle world). lapse, the degrees colder at the top of the land's height than at sea level, for a field's thaw and frost
  //   on high ground: declared, read by no rule yet (docs/tuning.md).
  const CLIMATE = Object.freeze({
    worlds: Object.freeze({ southern: 57, middle: 59, northern: 62, farNorth: 65 }),
    degPerRow: 0.015,
    bands: 3,
    janAt56: 0.5,
    janPerDeg: -1.25,
    julAt56: 17,
    julPerDeg: -0.15,
    coldest: 7,
    swing: 3,
    snow: -1,
    lake: 60,
    soundShut: 150,
    sound: 300,
    rot: 20,
    open: 60,
    realDays: 365 / 48,
    grow: 5,
    lapse: 8,
  });
  const C = CLIMATE;
  const { log } = VB['sim/records'];
  const Due = VB['sim/due'];
  const Walk = VB['sim/walking'],
    { groundChanged } = VB['sim/routes'];
  // The winter's dates, in the order they fall in a winter: each the first day of its kind (CLIMATE's thresholds).
  const DATES = Object.freeze(['frost', 'lakeBears', 'soundShut', 'soundBears', 'thaw', 'open']);
  const AUTUMN = 2 * SEASON_DAYS, // the day of the year (0-based) the dates are reckoned from
    COLDEST = 3 * SEASON_DAYS + C.coldest - 1, // the coldest day of the year, 0-based
    TURN = COLDEST - AUTUMN; // the coldest day, counted from autumn day 1
  // A world's latitude, the middle world's for one made before it had one.
  const latOf = (w) => (w && typeof w.lat === 'number' ? w.lat : C.worlds.middle);
  // The band of a row (0 the northmost), and a band's latitude, read at its middle row: row 0 is the map's north.
  const bandOfRow = (w, row) => Math.min(C.bands - 1, Math.floor((row * C.bands) / w.ROWS));
  const bandLat = (w, b) => latOf(w) + (w.ROWS / 2 - ((b + 0.5) * w.ROWS) / C.bands) * C.degPerRow;
  const BAND_NAMES = ['the north', 'the middle', 'the south'];
  const bandName = (b) => (C.bands === 3 ? BAND_NAMES[b] : `band ${b + 1}`);
  // The curve at a latitude: its yearly mean and half its range (the January and July means), in degrees.
  function curve(lat) {
    const jan = C.janAt56 + C.janPerDeg * (lat - 56),
      jul = C.julAt56 + C.julPerDeg * (lat - 56);
    return { mean: (jan + jul) / 2, amp: (jul - jan) / 2 };
  }
  // The day's mean on day doy (0-based) at a latitude, in a winter of warmth `warmth` (-1 hard to 1 mild, sim/weather's draw): the
  // winter's warmth moves the cold half of the year only, by up to C.swing at its coldest.
  function temp(lat, warmth, doy) {
    const { mean, amp } = curve(lat),
      c = Math.cos((2 * Math.PI * (doy - COLDEST)) / YEAR_DAYS);
    return mean - amp * c + (c > 0 ? C.swing * warmth * c : 0);
  }
  // The winter's dates at a latitude in a winter of warmth `warmth`, each as the days after autumn day 1 it falls on (0 to 47), or null:
  // the year walked once, a day at a time, from autumn day 1 (48 steps, once a year a band). No date where snow never lies; the dates fall
  // in the order of DATES.
  function datesOf(lat, warmth) {
    const d = { frost: null, lakeBears: null, soundShut: null, soundBears: null, thaw: null, open: null };
    let fdd = 0,
      tdd = 0;
    for (let k = 0; k < YEAR_DAYS; k++) {
      const t = temp(lat, warmth, (AUTUMN + k) % YEAR_DAYS);
      if (d.frost === null && t < C.snow) d.frost = k;
      if (t < 0) {
        fdd += -t * C.realDays;
        tdd = 0;
      } else if (fdd > 0 && k > TURN) tdd += t * C.realDays;
      if (d.frost === null) continue;
      if (d.lakeBears === null && fdd >= C.lake) d.lakeBears = k;
      if (d.soundShut === null && fdd >= C.soundShut) d.soundShut = k;
      if (d.soundBears === null && fdd >= C.sound) d.soundBears = k;
      if (d.thaw === null && k > TURN && tdd >= C.rot) d.thaw = k;
      if (d.thaw !== null && d.open === null && tdd >= C.open) d.open = k;
    }
    if (d.frost !== null && d.thaw === null) d.thaw = YEAR_DAYS - 1; // a winter that never ends is not this curve's; held in the year
    if (d.thaw !== null && d.open === null) d.open = Math.min(YEAR_DAYS - 1, d.thaw + 1);
    for (const k of ['lakeBears', 'soundShut', 'soundBears']) if (d[k] !== null && d[k] >= d.thaw) d[k] = null; // bears only before the thaw
    return d;
  }
  // The day of the year (0-based, fractional) the normal curve rises through C.grow in spring, and falls through it in autumn.
  function growDays(lat) {
    const { mean, amp } = curve(lat),
      x = Math.max(-1, Math.min(1, (mean - C.grow) / amp)),
      half = (Math.acos(x) * YEAR_DAYS) / (2 * Math.PI);
    return { on: COLDEST + half - YEAR_DAYS, off: COLDEST - half };
  }
  // How many days a world's thaw lies after the middle world's, and its first frost before it (negative: earlier, warmer): VB-354's
  // draw stands on the middle world, and a colder world's falls later in spring and earlier in autumn. The world's latitude, not its
  // band's: a field's band, and its height (C.lapse), are for a later task (VB-807's close call).
  const shifts = new Map(); // a pure function of the latitude, kept once a latitude; not state
  function shiftOf(w) {
    const lat = latOf(w);
    if (!shifts.has(lat)) {
      const at = growDays(lat),
        mid = growDays(C.worlds.middle);
      shifts.set(lat, Object.freeze({ thaw: Math.round(at.on - mid.on), frost: Math.round(at.off - mid.off) }));
    }
    return shifts.get(lat);
  }

  // ---- the state and the due-queue ----
  // @state st.climate: {year, bands: [{lat, state, dates}], due: [{at, band, date}]}: the winter reckoned on autumn day 1 of `year`; a
  //   band's latitude, its state (the name of the last of DATES fallen, 'open' before the first) and its dates (each of DATES a game
  //   hour, DATE_HOUR of its day, or null); due, the dates still to fall, by hour then band. Plain data; written only here. Missing in a
  //   save made before VB-807, until the next autumn.
  // @drawn st.climate (its bands' dates and due, the winter's dates reckoned ahead on autumn day 1): .climate
  //   (VB-1686) A decider reads a band's state now (bandState), or the normal winter's ground (normalGround).
  const atOf = (e) => e.at;
  // A date falls at DATE_HOUR of its day, when nobody is out (VB-808: no pawn is on the ice when it stops bearing).
  const DATE_HOUR = 4;
  const dayStart = (year, k) => ((year - 1) * YEAR_DAYS + AUTUMN + k) * DAY + DATE_HOUR;
  // The winter that begins this autumn (`year`, in a winter of warmth `warmth`), reckoned for every band: its dates go into the queue.
  function reckon(st, year, warmth) {
    if (st.climate) fallDue(st, Infinity, true); // anything left of the last winter has fallen by now
    const w = st.w,
      bands = [],
      due = [];
    for (let b = 0; b < C.bands; b++) {
      const lat = bandLat(w, b),
        d = datesOf(lat, warmth),
        dates = {};
      for (const k of DATES) {
        dates[k] = d[k] === null ? null : dayStart(year, d[k]);
        if (d[k] !== null) due.push({ at: dates[k], band: b, date: k });
      }
      const was = st.climate && st.climate.bands[b];
      bands.push({ lat: Math.round(lat * 1000) / 1000, state: was ? was.state : 'open', dates });
    }
    due.sort((a, b) => a.at - b.at || a.band - b.band || DATES.indexOf(a.date) - DATES.indexOf(b.date));
    st.climate = { year, bands, due };
  }
  // The dates due by hour t fall: each sets its band's state, and a line says so (none when `quiet`: a run's start).
  function fallDue(st, t, quiet = false) {
    const cl = st.climate;
    if (!cl || !cl.due.length || cl.due[0].at > t) return;
    for (const e of Due.take(cl.due, t, atOf)) {
      cl.bands[e.band].state = e.date;
      groundOfBand(st, e.band);
      if (!quiet) log(st, `${LINES[e.date]} in ${bandName(e.band)}.`, { kind: 'climate', band: e.band, date: e.date });
    }
  }
  const LINES = Object.freeze({
    frost: 'Snow lies and the ground bears',
    lakeBears: 'The lakes ice over and bear',
    soundShut: 'The sound skins over and shuts to boats',
    soundBears: 'The sound ice bears',
    thaw: 'The thaw: the ice no longer bears, the snow goes, the ground is soft',
    open: 'The water is open and the ground firm',
  });
  // A run's start at hour st.t (sim/scenarios): the winter reckoned on the last autumn day 1 at or before now, in its winter's warmth;
  // what has fallen by now is set quietly.
  function seedClimate(st, c, warmth) {
    Walk.dropGround(st.w); // compiled again at the run's first step, on the bands' states (VB-808)
    st.climate = null;
    reckon(st, c.season >= 2 ? c.year : c.year - 1, warmth);
    fallDue(st, st.t, true);
  }
  // ---- the ground by season (VB-808; design.md, Climate and travel beyond walking, The ground by season) ----
  // The ground of each state of a band, as sim/walking's flags (GROUND): what each date brings, from the frost to firm ground.
  const G = Walk.GROUND;
  const SNOW = G.snow | G.marsh,
    ICE = SNOW | G.lake;
  const GROUND_OF = Object.freeze({
    open: 0,
    frost: SNOW,
    lakeBears: ICE,
    soundShut: ICE,
    soundBears: ICE | G.sea,
    thaw: G.soft,
  });
  // The rows of band b, first and last.
  const bandRows = (w, b) => [Math.ceil((b * w.ROWS) / C.bands), Math.ceil(((b + 1) * w.ROWS) / C.bands) - 1];
  // The world's ground compiled on the bands' states (sim/walking compileGround): at a run's first step (sim/clock) and at a load.
  function layGround(st) {
    const w = st.w,
      rows = new Uint8Array(w.ROWS);
    for (let r = 0; r < w.ROWS; r++) rows[r] = GROUND_OF[bandState(st, bandOfRow(w, r))];
    Walk.compileGround(w, rows);
  }
  // The ground of a normal winter (warmth 0) of the world's climate, a row's flags: each band at the deepest ground its normal winter
  // reaches (sound ice, lake ice, snow, or none). What people know of the winter ways (principle "The future is someone's estimate"), for the winter table
  // of hours
  // (sim/villagehours); null where no band has lake ice in a normal winter.
  function normalGround(w) {
    const deep = [];
    let ice = false;
    for (let b = 0; b < C.bands; b++) {
      const d = datesOf(bandLat(w, b), 0),
        s =
          d.soundBears !== null
            ? 'soundBears'
            : d.lakeBears !== null
              ? 'lakeBears'
              : d.frost !== null
                ? 'frost'
                : 'open';
      if (d.lakeBears !== null) ice = true;
      deep.push(GROUND_OF[s]);
    }
    if (!ice) return null;
    const rows = new Uint8Array(w.ROWS);
    for (let r = 0; r < w.ROWS; r++) rows[r] = deep[bandOfRow(w, r)];
    return rows;
  }
  // Band b's rows come to the ground of its state; where any tile's cost changed, the routes cached are emptied now (sim/routes).
  function groundOfBand(st, b) {
    if (!st.w.ground) return;
    const [lo, hi] = bandRows(st.w, b);
    if (Walk.setRows(st.w, lo, hi, GROUND_OF[st.climate.bands[b].state])) groundChanged(st);
  }
  // A band's state now (what VB-808 and on will read), by band or by a tile's row.
  const bandState = (st, b) => (st.climate ? st.climate.bands[b].state : 'open');
  return {
    CLIMATE,
    DATES,
    latOf,
    bandOfRow,
    bandLat,
    bandName,
    curve,
    temp,
    datesOf,
    growDays,
    shiftOf,
    reckon,
    fallDue,
    seedClimate,
    bandState,
    layGround,
    normalGround,
  };
})();
