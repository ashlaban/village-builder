// Seasons on the map (VB-083; draw/season): a band's look from its state and its normal dates, the north turning before the south, no snow in a
// winter that has none, and a chunk baked in each look: the land tinted and under snow, a lake iced, pine staying green, the summer's
// paint unchanged when no look is given.
const VB = require('../src/load.js'), S = VB['draw/season'], C = VB['sim/climate'], { DAY, SEASON_DAYS, YEAR_DAYS } = VB['sim/rules'];
const { tinyWorld } = require('./lib/tiny.js'), { B } = VB['world/biomes'];
let failed = 0;
const check = (ok, m) => { if (!ok) { failed++; console.error('SEASON FAIL:', m); } };
const { TINT, ICE } = S;

// 1. One band through a winter on the middle world's middle band, at its normal dates (sim/climate datesOf, warmth 0).
const LAT = 59, N = C.datesOf(LAT, 0), at = (k) => ((2 * SEASON_DAYS + k) * DAY) + 4; // k days after autumn day 1, year 1
const look = (state, t) => { const c = S.bandLook(state, LAT, t); return [S.tintOf(c), S.lakeOf(c), S.seaOf(c)]; };
const same = (a, b) => a.join() === b.join();
check(same(look('open', SEASON_DAYS * DAY + 5 * DAY), [TINT.summer, 0, 0]), 'midsummer: full green, open water');
check(same(look('open', at(N.frost - 1)), [TINT.autumn, 0, 0]), 'the day before the normal frost: autumn');
check(same(look('open', at(N.frost + 3)), [TINT.autumn, 0, 0]), 'a frost later than the normal: autumn until snow lies');
check(same(look('open', at(N.frost - S.TURN.autumn - 1)), [TINT.summer, 0, 0]), 'autumn starts TURN.autumn days before the frost');
check(same(look('frost', at(N.frost)), [TINT.snow, ICE.weak, 0]), 'the frost: snow, lake ice that does not bear');
check(same(look('lakeBears', at(N.lakeBears)), [TINT.snow, ICE.bears, 0]), 'lakeBears: lake ice bears');
check(same(look('soundShut', at(N.soundShut)), [TINT.snow, ICE.bears, ICE.weak]), 'soundShut: the sound skins over, not bearing');
check(same(look('soundBears', at(N.soundShut + 4)), [TINT.snow, ICE.bears, ICE.bears]), 'soundBears: every ice bears');
check(same(look('thaw', at(N.thaw)), [TINT.spring, ICE.weak, ICE.weak]), 'the thaw: the break-up, alike on lake and sea; no snow');
check(same(look('open', at(N.open)), [TINT.spring, 0, 0]), 'open water, fresh green');
check(same(look('open', at(N.open + S.TURN.spring + 1)), [TINT.summer, 0, 0]), 'summer after the fresh green');
// the south of the southern world, where the sound does not shut: a thaw breaks up the lakes alone
check(C.datesOf(57.5, 0).soundShut === null && S.seaOf(S.bandLook('thaw', 57.5, at(26))) === 0, 'no sea ice at a thaw where the sound does not shut');
// a band whose normal winter has no frost: never snow, never ice; the broadleaf bare in winter by the calendar
let snowy = 0, iced = 0;
for (let d = 0; d < YEAR_DAYS; d++) {
  const c = S.bandLook('open', 55, d * DAY + 12);
  if (S.tintOf(c) === TINT.snow) snowy++;
  if (S.lakeOf(c) || S.seaOf(c)) iced++;
}
check(C.datesOf(55, 0).frost === null && snowy === 0 && iced === 0, `no snow or ice in a winter with no frost (${snowy}, ${iced})`);
check(S.tintOf(S.bandLook('open', 55, at(SEASON_DAYS + 5))) === TINT.bare, 'bare broadleaf in a winter with no snow');

// 2. The bands of a northern world through a winter, its states as the dates fall: the north's leaves turn, and its snow lies, first.
const st = { w: { ROWS: 200, lat: C.CLIMATE.worlds.northern }, t: at(0), climate: null };
C.reckon(st, 1, 0);
const firstOf = (tint) => st.climate.bands.map((b, k) => {
  for (let h = at(0); h < at(36); h += 6) {
    let state = 'open';
    for (const d of C.DATES) if (b.dates[d] !== null && b.dates[d] <= h) state = d;
    if (S.tintOf(S.bandLook(state, C.bandLat(st.w, k), h)) === tint) return h;
  }
  return Infinity;
});
const turn = firstOf(TINT.autumn), snow = firstOf(TINT.snow);
check(turn[0] < turn[2] && snow[0] < snow[2], `the north turns before the south: autumn ${turn}, snow ${snow}`);
check(S.looks(null).length === C.CLIMATE.bands && S.looks(st).length === C.CLIMATE.bands, 'a look a band');

// 3. A chunk baked in each look on a tiny world: meadow, broadleaf, pine and a lake.
const w = tinyWorld(['..FFPP..', '..FFPP..', '..oooo..', '..oooo..', '........']);
const P = VB['draw/paint'].paint(w), Bake = VB['draw/bake'];
const bake = (code) => {
  const img = { data: new Uint8ClampedArray(Bake.TEX * Bake.TEX * 4) };
  const rows = code === null ? null : S.rowLooks(w, new Array(C.CLIMATE.bands).fill(code));
  for (const _ of Bake.bakeChunk(w, P, 0, 0, 0, img, rows));
  return img.data;
};
const px = (d, i) => { const p = ((Math.round(w.hy[i]) * Bake.TEX) + Math.round(w.hx[i])) * 4; return [d[p], d[p + 1], d[p + 2], d[p + 3]]; };
const tile = (b) => { for (let i = 0; i < w.N; i++) if (w.biome[i] === b && (i / w.COLS | 0) < 4) return i; return -1; };
const meadow = 4 * w.COLS + 3, forest = tile(B.FOREST), pine = tile(B.PINE), lake = tile(B.LAKE);
const plain = bake(null), summer = bake(S.code(TINT.summer, 0, 0));
check(Buffer.compare(Buffer.from(plain.buffer), Buffer.from(summer.buffer)) === 0, 'summer\'s look paints as no look');
const autumn = bake(S.code(TINT.autumn, 0, 0)), winter = bake(S.code(TINT.snow, ICE.bears, 0)), freeze = bake(S.code(TINT.snow, ICE.weak, 0));
const [fr, fg] = px(autumn, forest), [sr, sg] = px(summer, forest);
check(fr - fg > sr - sg + 20, `autumn's broadleaf is russet (${px(summer, forest)} -> ${px(autumn, forest)})`);
check(same(px(autumn, pine), px(summer, pine)), 'pine stays green in autumn');
const light = (c) => c[0] + c[1] + c[2];
check(light(px(winter, meadow)) > 650, `snow on the meadow (${px(winter, meadow)})`);
check(px(winter, pine)[1] < px(winter, meadow)[1], 'the pine wood under snow darker than the open snow');
check(px(summer, lake)[3] === 0, 'open lake water is the water layer\'s, not the chunk\'s');
const bears = px(winter, lake), weak = px(freeze, lake);
check(bears[3] === 255 && weak[3] === 255 && light(bears) - light(weak) > 150, `ice that bears and ice that does not told apart (${bears}, ${weak})`);

if (failed) { console.error(`season: ${failed} failed`); process.exit(1); }
console.log('season: ok');
