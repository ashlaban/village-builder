// @sys sim/fieldrec: the one constructor of a field's record, for the generator (sim/layout) and for ground broken in play (sim/newground)
VB['sim/fieldrec'] = (() => {
  const { SOIL, GROUND, fertility } = VB['sim/crops'];
  const { BIOMES } = VB['gen/biomes'];
  // @state farmstead.fields[].ground: the key of the biome (gen/biomes BIOMES) the field's tile had when its project began, one with a row of
  // GROUND (sim/crops): 'meadow', 'heath', 'hills', 'marsh', or 'forest' or 'pine' (a wood broken, VB-1495). Not the tile's biome now: clearing
  // turns a wooded tile to meadow. Set here; its row gives the field's fertility (newField), and the invariant reads it.
  const groundKey = (w, tile) => (GROUND[w.biome[tile]] ? BIOMES[w.biome[tile]].key : 'meadow');
  // The biome of ground key `ground`, the tile's own when the key has no row (a plan from an older save). Allocates nothing.
  const groundBiome = (w, tile, ground) => {
    const b = BIOMES.findIndex((x) => x.key === ground);
    return GROUND[b] ? b : w.biome[tile];
  };
  const farmableKeys = () => Object.keys(GROUND).map((b) => BIOMES[b].key);
  // The one record of a field, in stubble on `tile`: a property a field starts with is set here, once (VB-1505). Its soil and the tick its tilth
  // was set differ by where it comes from: a laid-out farm's fields start at SOIL.start and no tilth (tilthAt 0: the tick is moot until dung is
  // spread, VB-717), ground broken in play at SOIL.start or SOIL.fresh and the tick it was broken.
  function newField(w, id, tile, soil = SOIL.start, tilthAt = 0, ground = groundKey(w, tile)) {
    return {
      id,
      tile,
      crop: 'barley',
      rotation: 'every',
      step: 0,
      stage: 'stubble',
      sown: null,
      reaped: null,
      held: 0,
      ground,
      fert: fertility(w, tile, groundBiome(w, tile, ground)), // its ground's, not the meadow a wood is grubbed to (VB-1495)
      soil,
      tilth: 0,
      tilthAt,
      weedOpen: false,
      weedPosted: null,
      weedMiss: 0,
    };
  }
  // A save from before VB-1490: each field's ground is its tile's biome, read at load (a field of ground with no row reads meadow).
  function grounded(st) {
    const w = st.w,
      all = [...st.farmsteads.flatMap((f) => f.fields), ...st.villages.flatMap((v) => v.commonFields || [])];
    for (const fd of all) if (fd.ground === undefined) fd.ground = groundKey(w, fd.tile); // lint-allow: owner older field, as newField
  }
  return { newField, groundKey, farmableKeys, grounded };
})();
