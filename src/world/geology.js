// @sys world/geology: the codes and names of what lies in the ground: bedrock and deposits, the endless source, and how near a hidden vein shows
// The setting is Europe of 1300 to 1700, continental and Scandinavian: granite and gneiss are the common ground, limestone and sandstone
// the building stones, slate, marble and soapstone the rarer ones; iron comes from bogs and from rock, silver with lead, tin only in
// granite (uplands and hills). gen/geology lays them.
VB['world/geology'] = (() => {
  // Bedrock, w.rock's codes. weight: a province's chance of each of the four common rocks; marble and soapstone are lenses (gen/geology VEINS).
  const ROCK = { NONE: 0, GRANITE: 1, LIMESTONE: 2, SANDSTONE: 3, SLATE: 4, MARBLE: 5, SOAPSTONE: 6 };
  const ROCKS = [
    { key: 'none', name: '' },
    { key: 'granite', name: 'Granite', weight: 45 },
    { key: 'limestone', name: 'Limestone', weight: 22 },
    { key: 'sandstone', name: 'Sandstone', weight: 18 },
    { key: 'slate', name: 'Slate', weight: 15 },
    { key: 'marble', name: 'Marble' },
    { key: 'soapstone', name: 'Soapstone' },
  ];
  // Deposits, w.deposit's codes. hidden: an ore that does not show at the surface, and must be found (sim/prospect).
  const DEPOSIT = {
    NONE: 0,
    CLAY: 1,
    BOG_IRON: 2,
    IRON: 3,
    COPPER: 4,
    LEAD_SILVER: 5,
    TIN: 6,
    GOLD: 7,
    SALT: 8,
    PEAT: 9,
    FLINT: 10,
    AMBER: 11,
  };
  const DEPOSITS = [
    { key: 'none', name: '' },
    { key: 'clay', name: 'Clay' },
    { key: 'bogIron', name: 'Bog iron ore' },
    { key: 'iron', name: 'Iron ore', hidden: true },
    { key: 'copper', name: 'Copper ore', hidden: true },
    { key: 'leadSilver', name: 'Lead and silver ore', hidden: true },
    { key: 'tin', name: 'Tin ore', hidden: true },
    { key: 'gold', name: 'Gold', hidden: true },
    { key: 'salt', name: 'Salt spring' },
    { key: 'peat', name: 'Peat' },
    { key: 'flint', name: 'Flint' },
    { key: 'amber', name: 'Amber' },
  ];
  // A deposit tile's w.depositLeft of ENDLESS is a source that does not run out in any game.
  const ENDLESS = 65535;
  // A hidden vein can be come on by work within `reach` tiles of it (w.veinNear).
  const FIND = { reach: 2 };

  // The key of a tile's bedrock in ROCKS ('granite'), or null where it has none or the world was made without the ground layers.
  const rockKey = (w, t) => (w.rock && w.rock[t] ? ROCKS[w.rock[t]].key : null);

  return { ROCK, ROCKS, DEPOSIT, DEPOSITS, ENDLESS, FIND, rockKey };
})();
