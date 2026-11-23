// @sys sim/fieldrec: the one constructor of a field's record, for the generator (sim/layout) and for ground broken in play (sim/newground)
VB['sim/fieldrec'] = (() => {
  const { SOIL, fertility } = VB['sim/crops'];
  // The one record of a field, in stubble on `tile`: a property a field starts with is set here, once (VB-1505). Its soil and the tick its tilth
  // was set differ by where it comes from: a laid-out farm's fields start at SOIL.start and no tilth (tilthAt 0: the tick is moot until dung is
  // spread, VB-717), ground broken in play at SOIL.start or SOIL.fresh and the tick it was broken.
  function newField(w, id, tile, soil = SOIL.start, tilthAt = 0) {
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
      fert: fertility(w, tile),
      soil,
      tilth: 0,
      tilthAt,
      weedOpen: false,
      weedPosted: null,
      weedMiss: 0,
    };
  }
  return { newField };
})();
