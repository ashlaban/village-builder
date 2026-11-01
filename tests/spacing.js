// Spacing (VB-154, stability review): a new farm needs room (FIELDS.room free farmable tiles within FIELD_REACH of its house besides its first
// field), whether a village's plot, a settler joining a small village, or a new village; and a new village keeps SETTLE.apart steps from every
// other farm's house, green and fields and SETTLE.centreApart hex steps from every village centre.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, X = VB['sim/expansion'], S = VB['sim/settle'];
const { FIELDS, SETTLE } = VB['sim/rules'], { hexSteps } = VB['sim/hex'];
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('SPACING FAIL:', m); } };
const world = (seed) => { const it = G.generate(seed, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done); return r.value; };
const st = Sim.seed(world(7), 7, 'populous');
// 1. Every site findSite offers has room besides its field; with a room no site can have, it offers none.
let sites = 0;
for (const v of st.villages) {
  const site = X.findSite(st, v); if (!site) continue;
  sites++;
  check(X.roomAt(st, site.house, (t) => t === site.field || t === site.house) >= FIELDS.room, `${v.name}: the site at ${site.house} has room`);
}
check(sites > 0, 'some village has a site');
const room = FIELDS.room; FIELDS.room = 1000;
check(st.villages.every((v) => X.findSite(st, v) === null), 'no site when no farm can have the room');
FIELDS.room = room;
// 2. A new village from each village with land in reach: apart from every farm and village centre, with room.
let found = 0, nearest = Infinity;
for (const v of st.villages) {
  const use = S.landInUse(st), reach = S.reachOf(st, v), site = S.newSite(st, v, use, S.candidates(st, v, use, reach));
  if (!site) continue;
  found++;
  const d = Math.min(...st.villages.map((u) => hexSteps(st.w, u.center, site.house))); nearest = Math.min(nearest, d);
  check(d >= SETTLE.centreApart, `${v.name}: the new site lies ${d} hex steps from a village centre`);
  check(!use.near.has(site.house) && !use.near.has(site.field), `${v.name}: the new house and field keep ${SETTLE.apart} steps from other farms`);
  check(X.roomAt(st, site.house, (t) => use.taken.has(t) || use.near.has(t) || t === site.field || t === site.house) >= FIELDS.room,
    `${v.name}: the new site has room`);
}
check(found > 0, 'some village finds land for a new village');
if (failed) process.exit(1);
console.log(`spacing ok: ${sites} plot sites with room; ${found} new village sites, the nearest ${nearest} hex steps from a village centre`);
