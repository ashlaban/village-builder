// @sys page/water: fresh water on the map (VB-1581): the tile card's lines of a tile's source, the walk to the nearest and the well's band, and
// the Fresh water overlay: land coloured by the walk to fresh water, with a mark for the band of a well there
// ---- fresh water: the tile card's lines and the overlay (world/water; design.md, Water by the site, What is shown) ----
// What is read: w.fresh (a tile's source), w.freshWalk (hours on foot over pathless ground to the nearest source that is not marsh) and
// w.waterDepth, shown only as its band, the pawn's estimate, with the hours a well of that band takes: never the metres. They are laid
// once from the land as generated, so the overlay is drawn once a world (and again when the walk is laid, with the state).
const WATER_WALKS = [0.25, 0.5, 1, 2, 4], // hours: the upper bounds of the walk's bands; beyond the last, further
  WATER_RAMP = [0x1d4e89, 0x2b83ba, 0x7fc8a9, 0xe6e089, 0xf0a04b, 0xc8553d], // near to far
  WATER_NONE = 0x6b6b6b, // no fresh water to walk to
  WATER_MARK = 0x0b1d33, // the well's mark
  WATER_DOT = [0.3, 0.19, 0.09]; // the mark's radius, of the hex's, by band: shallow, middling, deep; no mark where no well can be dug
let waterG = null,
  waterOn = false,
  waterFor = null,
  waterLaid = false;
// A walk of h hours one way, in words: the tile card's.
function walkWords(h) {
  const q = Math.round(h * 4);
  if (q < 1) return 'a few minutes';
  if (q < 4) return ['', 'a quarter of an hour', 'half an hour', 'three quarters of an hour'][q];
  const n = Math.round(h * 2) / 2;
  return n === 1 ? 'an hour' : n === 1.5 ? 'an hour and a half' : `${n} hours`;
}
// The tile card's lines on water for tile i: its own source ("Fresh water: a stream"), or the nearest and the walk to it; marsh
// is named as poor water, with the nearest good water; then, on land no river runs through, the band of a well there with its hours.
function waterLines(i) {
  if (!w.fresh) return [];
  const { FRESH, FRESHES, BANDS, band, bandHours, sourceNear } = Water,
    f = w.fresh[i];
  if (w.water[i]) return f === FRESH.LAKE ? ['Fresh water: a lake'] : [];
  const out = [],
    near = sourceNear(w, i),
    far = () =>
      near >= 0
        ? `${FRESHES[w.fresh[near]].name}, ${walkWords(w.freshWalk[i])} away on foot`
        : 'none to walk to from here';
  if (near === i) out.push(`Fresh water: ${FRESHES[f].name}`);
  else if (f === FRESH.MARSH) out.push(`Fresh water: marsh, poor water${w.freshWalk ? `; ${far()}` : ''}`);
  else if (w.freshWalk) out.push(`Fresh water: ${far()}`);
  if (w.river[i]) return out;
  const k = band(w.waterDepth[i]),
    hours = bandHours(k);
  out.push(
    hours ? `A well here: ${BANDS[k].name}, ${hours[0]} to ${hours[1]} hours of digging` : 'No well can be dug here',
  );
  // what a farm placed here would spend on its water each day (VB-1583): the leader's estimate, as its choice of site shows it
  if (st && st.w === w && w.freshWalk) out.push(`A farm here: ${siteWaterWords(Sim.siteWater(st, i)).fetch}`);
  return out;
}
// A site's water in words, from the leader's estimate e (Sim.siteWater; design.md, Water by the site, In the leader's choice):
// {source: the nearest good water and the walk there and back, or that none is in reach; fetch: the day's fetch in hours, as a share of
// one hand's day, for how many people it is reckoned, by hand alone (VB-1604: who settles brings no hand cart), and where it is drawn;
// well: the band of a well there with its range of hours, or that none can be dug}. The site choice (VB-788, VB-1544) shows the
// three; the tile card has the first and the last in its own lines, and adds the fetch, for one trip's people.
function siteWaterWords(e) {
  const from = {
    source: () => `from ${e.source.name}`,
    village: () => `from ${e.village.name}'s well, ${walkWords(2 * e.village.walk)} there and back`,
    well: () => `with a well dug by the house, about ${Math.round(e.well.dig)} hours of work`,
    none: () => 'no fresh water in reach, and no well to dig',
  }[e.by]();
  return {
    source: e.source ? `${e.source.name}, ${walkWords(2 * e.source.walk)} there and back` : 'no fresh water in reach',
    fetch:
      `water ${e.hours.toFixed(1)} hours a day for ${e.people} ${e.people === 1 ? 'person' : 'people'} by hand, ` +
      `${Math.round(e.share * 100)}% of one hand's day (${from})`,
    well: e.well
      ? `a well here: ${e.well.name}, ${e.well.range[0]} to ${e.well.range[1]} hours`
      : 'no well can be dug here',
  };
}
const waterBand = (h) => {
  const k = WATER_WALKS.findIndex((x) => h <= x);
  return k < 0 ? WATER_WALKS.length : k;
};
function drawWater() {
  if (!w) return;
  if (waterFor === w && waterLaid === !!w.freshWalk) return;
  if (!waterG) {
    waterG = new PIXI.Graphics();
    L.freshwater.addChild(waterG);
  }
  const g = waterG,
    { BANDS, band, bandHours } = Water,
    n = WATER_WALKS.length + 2,
    tiles = Array.from({ length: n }, () => []),
    wells = [[], [], []];
  waterFor = w;
  waterLaid = !!w.freshWalk;
  g.clear();
  if (w.fresh && w.freshWalk)
    for (let i = 0; i < w.N; i++) {
      if (w.water[i]) continue;
      tiles[w.freshWalk[i] < Infinity ? waterBand(w.freshWalk[i]) : n - 1].push(i);
      const k = band(w.waterDepth[i]);
      if (k < 3 && !w.river[i]) wells[k].push(i);
    }
  const colour = (k) => (k === n - 1 ? WATER_NONE : WATER_RAMP[k]);
  tiles.forEach((list, k) => {
    if (!list.length) return;
    for (const i of list) g.poly(hexPoly(i));
    g.fill({ color: colour(k), alpha: 0.6 });
  });
  wells.forEach((list, k) => {
    if (!list.length) return;
    for (const i of list) g.circle(w.hx[i], w.hy[i], w.R * WATER_DOT[k]);
    g.fill({ color: WATER_MARK, alpha: 0.8 });
  });
  const walkName = (k) =>
      k === 0
        ? `Within ${walkWords(WATER_WALKS[0])}`
        : k < WATER_WALKS.length
          ? `Within ${walkWords(WATER_WALKS[k])}`
          : k === n - 1
            ? 'None to walk to'
            : 'Further',
    row = (k) =>
      tiles[k].length ? `<li><i class="rock" style="background:${hex6(colour(k))}"></i>${walkName(k)}</li>` : '',
    dot = (k) => {
      const d = Math.round(14 * WATER_DOT[k] * 2.4);
      return (
        `<li><i class="ore" style="background:${hex6(WATER_MARK)};width:${d}px;height:${d}px;margin:0 ${(14 - d) / 2}px;border:0"></i>` +
        `A ${BANDS[k].name} well: ${bandHours(k).join(' to ')} hours of digging</li>`
      );
    };
  $('freshwaterKey').innerHTML =
    '<h2 class="menu-label">The walk to fresh water</h2>' +
    (waterLaid
      ? `<ul>${tiles.map((t, k) => row(k)).join('')}</ul>` +
        '<p>One way on foot over pathless ground, to a lake or running water; marsh is poor water, and not counted.</p>' +
        `<ul>${[0, 1, 2].map(dot).join('')}</ul>` +
        '<p>The dot: how deep a well would be here, as it is guessed from the land. No dot: no well can be dug.</p>'
      : '<p>The walk is laid when the land is settled.</p>');
}
function setWater(on) {
  waterOn = on;
  L.freshwater.visible = on;
  if (on) drawWater();
}
// Each frame while the overlay is on: drawn again only for another world, or once its walk is laid.
function refreshWater() {
  if (waterOn) drawWater();
}
function resetWater() {
  waterFor = null;
  if (waterG) waterG.clear();
  if (waterOn) drawWater();
}
registerOverlay({
  id: 'freshwater',
  name: 'Fresh water',
  icon: 'freshwater',
  group: 'nature',
  set: setWater,
  refresh: refreshWater,
  reset: resetWater,
  layer: L.freshwater,
  keyEl: $('freshwaterKey'),
});
// The cards' lines on water (page/cardrows): a person's thirst (sim/thirst), and an open tile's water after its river.
cardRow('person', 70, (id) => Sim.thirstLine(st, id));
cardRow('tile', 30, waterLines);
