// Names (VB-026): farms of a village by compass, then landmark, then owner, numbered only when every generator fails; a lone farm's village
// bears its farm's name, unique on the island, so the map's labels (a village of two or more farms by its name, a lone farm by its
// farm's) repeat no name; each culture keeps its order of preference and a split culture inherits it.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, N = VB['sim/names'], Culture = VB['culture'];
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('NAMES FAIL:', m); } };
const world = (seed, cols, rows) => { const it = G.generate(seed, { cols, rows }); let r; while (!(r = it.next()).done); return r.value; };
const labels = (st) => st.villages.flatMap((v) => (v.green || v.farmsteads.length >= 2 ? [v.name] : v.farmsteads.map((id) => st.farmsteads[id].name)));
const dupes = (xs) => xs.filter((x, i) => xs.indexOf(x) !== i);
const out = [];
// 1. Seeding: populous medium at seeds 7 and 42
for (const seed of [7, 42]) {
  const st = Sim.seed(world(seed, 280, 200), seed, 'populous'), tag = `populous medium seed ${seed}`;
  let biggest = null;
  for (const v of st.villages) {
    const nm = v.farmsteads.map((id) => st.farmsteads[id].name);
    if (!biggest || nm.length > biggest.length) biggest = nm;
    check(!dupes(nm).length, `${tag}: ${v.name} has two farms named ${dupes(nm)[0]}`);
    check(nm.every((x) => !/ \d+$/.test(x)), `${tag}: ${v.name} numbers a farm (${nm.join(', ')})`);
    if (nm.length === 1) check(v.name === nm[0], `${tag}: the lone farm ${nm[0]} and its village ${v.name} differ`);
  }
  check(biggest.length >= 12, `${tag}: the biggest village has ${biggest.length} farms`);
  check(!dupes(st.villages.map((v) => v.name)).length, `${tag}: two villages named ${dupes(st.villages.map((v) => v.name))[0]}`);
  check(!dupes(labels(st)).length, `${tag}: map labels repeat ${dupes(labels(st)).join(', ')}`);
  check(st.cenv.cultures.every((c) => c.namePrefs.farm.join() === Culture.NAME_PREFS.farm.join()), `${tag}: a culture's name preference`);
  out.push(`seed ${seed}: ${st.villages.length} villages, biggest ${biggest.length} farms (${biggest.slice(-3).join(', ')})`);
  // a culture that splits off keeps its parent's preference, as a copy
  const s = st.cenv.settlements[st.villages.length - 1], parent = st.cenv.cultures[s.culture];
  parent.namePrefs.farm = ['owner', 'compass', 'landmark'];
  const nc = Culture.split(st.cenv, [s.id], 'test');
  check(nc.namePrefs.farm.join() === 'owner,compass,landmark' && nc.namePrefs.farm !== parent.namePrefs.farm, `${tag}: a split culture's preference`);
}
// 2. The generators in order: compass, landmark, owner, then a number; the farm's own stream (tileRand) gives the same name every time
{
  const st = Sim.seed(world(7, 120, 85), 7, 'populous'), v = st.villages.find((u) => u.farmsteads.length >= 3);
  const f = st.farmsteads[v.farmsteads[1]], olof = { given: 'Olof' }, hans = { given: 'Hans' };
  const ctx = { w: st.w, f, village: v, owner: olof }, rand = () => N.tileRand(f.house);
  const compass = N.compass(ctx), land = N.landmark(ctx, rand());
  check(compass.length === 3 && /gården$/.test(compass[0]), `compass names (${compass.join(', ')})`);
  check(land.length > 60 && !dupes(land).length, `landmark offers ${land.length} names, ${dupes(land).length} repeated`);
  check(N.farmName(ctx, new Set(), rand()) === compass[0], 'compass first');
  check(N.farmName(ctx, new Set(compass), rand()) === land[0], 'landmark when compass names are taken');
  const all = new Set([...compass, ...land]);
  check(N.farmName(ctx, all, rand()) === 'Olofsgården', `the owner's name (${N.farmName(ctx, all, rand())})`);
  check(N.farmName({ ...ctx, owner: hans }, all, rand()) === 'Hansgården', 'a given name ending in s takes no other');
  check(N.farmName(ctx, new Set([...all, 'Olofsgården']), rand()) === `${compass[0]} 2`, 'a number only when all fail');
  check(N.farmName(ctx, new Set(compass), rand()) === N.farmName(ctx, new Set(compass), rand()), 'the same stream gives the same name');
  // village names: the syllable names never loop for ever, and a founder's name comes first
  const taken = new Set(); for (let k = 0; k < 120; k++) taken.add(N.villageName(G.mulberry32(k), taken));
  check(taken.size === 120, `120 distinct village names (${taken.size})`);
  check(N.founderName({ given: 'Erik' }, new Set(['Erikstorp']), G.mulberry32(1)) === 'Eriksryd', 'the founder\'s next ending');
}
if (failed) process.exit(1);
console.log(`names ok: ${out.join('; ')}`);
