// @sys sim/weather: the seasons' weather a crop asks for (VB-354; design.md, Crops and the weather): for the archipelago, each season's
// warmth and wetness drawn at its start, and each year's thaw and first autumn frost; read by the crops and the meadows at reaping and
// mowing, by the sowing window (the thaw) and by the frost's day. The world layer's climate (target-v2 4.2) until the weather branch
// answers the same question a region.
VB['sim/weather'] = (() => {
  const { next: rnd } = VB['sim/rng'];
  const { CROPS } = VB['sim/rules'];
  const { log } = VB['sim/records'];
  // @tunable SEASONS: the seasons' names, in the year's order
  const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  // The draw (Agreed, 11 Nov, starting values): a season's warmth and wetness each from -1 to 1 about the normal, most seasons near it (the
  // sum of two draws: a triangle); the thaw on spring day 1 to 4 (sday 0 to 3, `thaw` the weights of each), the first frost on autumn day 8
  // to 12 (sday 7 to 11, `frost` the weights from `frostFrom`), most often on sday 11, where it was fixed before (the design's "most often
  // 11, where it is fixed today" read as the code's sday, as sim/rules' haul does; VB-354's close call). A crop's reading R (the sum of its row's terms, CROPS
  // weather) gives the harvest factor base x (1 + scale x R), within `range`: base and scale are set so barley's factor has the mean and
  // spread of the yearly factor it replaces (0.75 to 1.2 evenly: mean 0.975, deviation 0.13; tests/weather.js prints both). ripen: the
  // days a cold summer (warmth -1) puts on a ripening crop's ripening, and those a warm one (1) takes off.
  const WEATHER = Object.freeze({
    base: 1.076,
    scale: 1.87,
    range: Object.freeze([0.5, 1.3]),
    thaw: Object.freeze([1, 1, 1, 1]),
    frostFrom: 7,
    frost: Object.freeze([1, 1, 1, 2, 10]),
    ripen: Object.freeze({ late: 2, early: 1 }),
  });
  const pick = (r, weights) => {
    let x = rnd(r) * weights.reduce((s, w) => s + w, 0);
    for (let i = 0; i < weights.length; i++) if ((x -= weights[i]) < 0) return i;
    return weights.length - 1;
  };
  const round2 = (x) => Math.round(x * 100) / 100;
  const tri = (r) => round2(rnd(r) + rnd(r) - 1);
  // @state st.weather: [{year, seasons: [[warmth, wetness] for each season drawn so far], thaw, frost}]: this year's weather, and last
  //   year's (rye stands across two), oldest first, nothing older; warmth and wetness from -1 to 1, thaw a spring sday, frost an autumn
  //   sday. Plain data; written only here.
  function newYear(st, year) {
    const r = st.rng.weather;
    st.weather.push({
      year,
      seasons: [],
      thaw: pick(r, WEATHER.thaw),
      frost: WEATHER.frostFrom + pick(r, WEATHER.frost),
    });
    while (st.weather.length > 2) st.weather.shift();
  }
  // A season begins (sim/clock, the first step of its first day): its warmth and wetness are drawn, on spring's after the year's days, and
  // a line names them (not at a run's start: `quiet`). Drawn once: a run seeded or loaded within the season keeps what it has.
  function seasonBegins(st, c, quiet = false) {
    const now = st.weather[st.weather.length - 1];
    if (c.season === 0 && (!now || now.year < c.year)) newYear(st, c.year);
    const y = st.weather[st.weather.length - 1];
    if (y.seasons.length !== c.season) return;
    const r = st.rng.weather,
      s = [tri(r), tri(r)];
    y.seasons.push(s);
    if (!quiet) log(st, `${words(c.season, s)}.`, { kind: 'weather', n: c.season });
  }
  // The weather at the start of a run (sim/scenarios): last year whole, as the rye sown in its autumn stood it, and this year's spring.
  function seedWeather(st, c) {
    st.weather = [];
    newYear(st, c.year - 1);
    const r = st.rng.weather;
    for (let s = 0; s < 4; s++) st.weather[0].seasons.push([tri(r), tri(r)]);
    for (let s = 0; s <= c.season; s++) seasonBegins(st, { year: c.year, season: s }, true);
  }
  const WARM = ['cold', '', 'warm'],
    WET = ['dry', '', 'wet'],
    band = (x) => (x < -1 / 3 ? 0 : x > 1 / 3 ? 2 : 1);
  function words(season, [w, r]) {
    const name = SEASONS[season][0].toUpperCase() + SEASONS[season].slice(1),
      said = [WARM[band(w)], WET[band(r)]].filter(Boolean);
    return said.length ? `${name} comes in ${said.join(' and ')}` : `${name} comes in as most do`;
  }
  // The season `s` of the year `ago` years back (0: this year), [warmth, wetness], or the normal [0, 0] for one not drawn yet or forgotten.
  function season(st, s, ago = 0) {
    const y = st.weather[st.weather.length - 1 - ago];
    return (y && y.seasons[s]) || [0, 0];
  }
  // A reading of `terms` (a crop's row's weather, or the meadows'), at the time of the harvest of this year: the sum of its terms.
  function reading(st, terms) {
    let sum = 0;
    for (const [s, kind, k] of terms) {
      const [w, r] = s < 0 ? season(st, 4 + s, 1) : season(st, s);
      if (kind === 'w') sum += k * w;
      else if (kind === 'r') sum += k * r;
      else if (kind === 'dry') sum -= k * Math.max(0, -r);
      else if (kind === 'wet') sum -= k * Math.max(0, r);
      else if (kind === 'bare') sum -= k * Math.max(0, -w) * Math.max(0, -r);
      else throw new Error(`weather: no term ${kind}`);
    }
    return sum;
  }
  // The harvest factor of a reading: what multiplies the yield at reaping or mowing in place of the yearly factor it replaces.
  const factorOf = (sum) =>
    Math.min(WEATHER.range[1], Math.max(WEATHER.range[0], WEATHER.base * (1 + WEATHER.scale * sum)));
  const factor = (st, terms) => factorOf(reading(st, terms));
  const cropFactor = (st, crop) => factor(st, CROPS[crop].weather || []);
  // Days the summer's warmth adds to a ripening crop's `ripe` (negative: takes off); 0 for a crop that does not read it, or before summer.
  function ripeShift(st, crop) {
    if (!CROPS[crop].ripens) return 0;
    const w = season(st, 1)[0];
    return w < 0 ? Math.round(-w * WEATHER.ripen.late) : -Math.round(w * WEATHER.ripen.early);
  }
  // This year's thaw (a spring sday: no ground is tilled or sown before it) and first frost (an autumn sday).
  const year = (st) => st.weather[st.weather.length - 1];
  const thawDay = (st) => year(st).thaw;
  const frostDay = (st) => year(st).frost;
  // Is crop k's window (its row's sow: [season, first day, last day]) open on c, the thaw passed for a crop sown in spring.
  function sowOpen(st, k, c) {
    const W = CROPS[k].sow;
    return c.season === W[0] && c.sday >= (W[0] === 0 ? Math.max(W[1], thawDay(st)) : W[1]) && c.sday <= W[2];
  }
  return {
    SEASONS,
    WEATHER,
    seasonBegins,
    seedWeather,
    season,
    reading,
    factorOf,
    factor,
    cropFactor,
    ripeShift,
    thawDay,
    frostDay,
    sowOpen,
  };
})();
