// @sys sim/crops: the crops, their rotations and the soil (VB-419, from sim/rules): each crop's row, the rotations a field keeps,
// how a harvest wears the soil and dung restores it, and which land can be farmed and how fertile it is
VB['sim/crops'] = (() => {
  const { B } = VB['gen'];
  const { SEASON_DAYS } = VB['sim/rules'];
  // @tunable CROPS: crops (VB-346; design.md, Crops and rotations): one row each, and a field holds the key of its crop (`fd.crop`). A plain table here,
  // not the registry's: nothing yet changes a row at run time, so it is no rule with contributions; it never enters saved state. Barley is today's
  // grain. Days are game days. yield: rations a field gives at fertility and soil 1; seed: rations sown on a field (a 4:1 ratio); sow: the window
  // [season, first day, last day]; ripe: days from sowing to ripe; wear: the soil a harvest takes (the frost's day is the
  // year's, sim/weather frostDay; it takes every crop but a winter one). hours: the work of each stage; KINDS plow, sow, weed, reap and thresh (sim/kinds)
  // read them from here.
  // weather (VB-354; design.md, Crops and the weather): the crop's reading of its seasons, terms [season, kind, k] summed by sim/weather
  // (reading): the season 0 to 3 of the year it is reaped in, -1 the winter before it; kind 'w' adds k x warmth, 'r' k x wetness, 'dry'
  // takes k at the driest, 'wet' k at the wettest, 'bare' k when the season is both coldest and driest (the bare frost). ripens: the
  // summer's warmth moves its ripening (sim/weather ripeShift). ----
  const CROPS = {
    barley: {
      yield: 100,
      seed: 25,
      sow: [0, 0, 9],
      ripe: 26,
      wear: 0.08,
      weeds: 2,
      weather: [
        [1, 'w', 0.1],
        [1, 'dry', 0.15],
        [2, 'wet', 0.15],
      ],
      ripens: true,
      hours: { plow: 20, sow: 2, weed: 5, reap: 15, thresh: 20 },
    },
    // winter rye (VB-348): sown in autumn days 1 to 6, it stands the winter and the frost (winter), and is ripe in summer days 7 to 12; a
    // ripe field still standing on `lost` [season, day] is lost; weeds: the rounds of weeding it gets (barley 2, at ECON.weedDays)
    rye: {
      yield: 100,
      seed: 25,
      sow: [2, 0, 5],
      ripe: 42,
      wear: 0.08,
      winter: true,
      lost: [2, 0],
      weeds: 1,
      weather: [
        [-1, 'bare', 0.3],
        [1, 'wet', 0.15],
      ],
      hours: { plow: 20, sow: 2, weed: 5, reap: 15, thresh: 20 },
    },
    // peas (VB-349): a spring crop, the soil mended `gain` a crop (to SOIL.start; a field manured above it keeps its soil) and no wear; hoed
    // (plow), pulled (reap) and threshed in fewer hours; lost to the frost as barley is; cooked in the pot as the food `pulses`, a source of its own
    peas: {
      yield: 60,
      seed: 20,
      sow: [0, 0, 9],
      ripe: 18,
      wear: 0,
      gain: 0.04,
      weeds: 2,
      weather: [
        [0, 'r', 0.05],
        [1, 'dry', 0.25],
      ],
      ripens: true,
      hours: { plow: 20, sow: 2, weed: 5, reap: 10, thresh: 10 },
    },
    // fallow (VB-348), a course and not a crop: never sown, no seed and no grain (sim/stores holds only the rows with seed); tilled once in
    // `sow`, the summer; at the year's end a field that stood fallow through the summer gains `mend` of soil if tilled, half if not, to
    // at most SOIL.start
    fallow: { fallow: true, sow: [1, 0, SEASON_DAYS - 1], mend: 0.08, hours: { plow: 10 } },
  };
  // @tunable ROTATIONS: rotations (VB-350; design.md, Crops and rotations, The rotation): a field holds one (`fd.rotation`, a key) and the step it is at
  // (`fd.step`); its crop is the step's course (a key of CROPS, fallow among them). A plain table, as CROPS. Barley every year is today's
  // farming; in three courses a field is fallow a year, then rye sown that autumn, then barley the spring after its rye is in. ----
  const ROTATIONS = {
    every: { courses: ['barley'], label: 'barley every year' },
    two: { courses: ['barley', 'fallow'], label: 'two courses' },
    three: { courses: ['fallow', 'rye', 'barley'], label: 'three courses' },
    peas: { courses: ['barley', 'peas'], label: 'barley and peas by turns' },
    peasRye: { courses: ['peas', 'rye', 'barley'], label: 'peas, rye, barley' },
  };
  // @tunable SOIL: soil (VB-137): a field's soil multiplies its yield; each reaped crop wears it by `wear` to `floor`; a load of manure, carted to a field in
  // stubble or hoed in spring days 1 to 6 (sday window), raises it by perLoad to `cap`. Fodder collects loads a stall day: a head of cattle, a sheep.
  // The heap loses `rot` of what lies on it in a year (balance review). perLoad 0.02 would make about 3 head of cattle, not 1.5, hold 3 fields, but
  // cost a quarter more hungry days over 8 seeds, so it stays at 0.04 until Kim chooses (QUESTIONS.md). A field broken on ground never farmed
  // (w.dev 0) starts at `fresh`, above the cap: virgin and burnt-over land gave far more its first crops (VB-149, docs/review-expansion.md) ----
  const SOIL = {
    start: 1,
    fresh: 1.4,
    floor: 0.75,
    perLoad: 0.04,
    cap: 1.15,
    cattle: 0.2,
    sheep: 0.04,
    window: [0, 5],
    rot: 0.5,
  };
  // @tunable GROUND: what a farmable ground is worth as a field, by its biome (a tile of a biome with no row cannot be farmed):
  // fert its fertility, clear the hours its clearing adds (VB-1522; estimates, a track's hours over heath and hills; marsh waits for VB-721);
  // wood: a wood broken to a field (VB-1525; Kim, 23 Nov), felled and grubbed before its clearing (sim/fieldplans' fieldProject), its trees
  // carted home; the generator's farms and a plot's field keep to open ground (openGround). Forest 0.9, pine 0.6: estimates (leaf mould
  // against the needles' sour ground).
  const GROUND = {
    [B.MEADOW]: { fert: 1, clear: 0 },
    [B.HEATH]: { fert: 0.65, clear: 3 },
    [B.HILLS]: { fert: 0.7, clear: 8 },
    [B.MARSH]: { fert: 0.5, clear: 0 },
    [B.FOREST]: { fert: 0.9, clear: 0, wood: true },
    [B.PINE]: { fert: 0.6, clear: 0, wood: true },
  };
  // @tunable RIVER: rivers (src/gen/rivers.js): no house or field on a river tile; a field next to one is watered from it
  // irrigation: extra fertility of a field next to a river tile; site: added to a village site's score by steps to the nearest river tile (0..3).
  const RIVER = { irrigation: 0.2, site: [0, 10, 10, 5] };
  const farmable = (w, i) => i >= 0 && !w.water[i] && !w.river[i] && GROUND[w.biome[i]] !== undefined;
  // Farmable and not a wood: where a field is made without felling (the generator's farms, a plot's field, a farm's room). Allocates nothing.
  const openGround = (w, i) => farmable(w, i) && !GROUND[w.biome[i]].wood;
  const byRiver = (w, i) => {
    for (let k = 0; k < 6; k++) {
      const j = w.nb[i * 6 + k];
      if (j >= 0 && w.river[j]) return true;
    }
    return false;
  };
  // Fertility of a farmable tile as a field: by its biome (or the ground `b` it had, a wood felled and grubbed to meadow, VB-1525), and more
  // when a river waters it.
  const fertility = (w, i, b = w.biome[i]) => GROUND[b]?.fert * (byRiver(w, i) ? 1 + RIVER.irrigation : 1);

  return { CROPS, ROTATIONS, SOIL, GROUND, RIVER, farmable, openGround, byRiver, fertility };
})();
