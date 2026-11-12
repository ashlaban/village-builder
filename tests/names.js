// Names (VB-026, VB-399): a village by its site, the largest of a map as its old centre; farms of a village by compass, then landmark, then owner, numbered only when every generator fails; a lone farm's village
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
  const nc = Culture.split(st.cenv, Sim.hooks(st), [s.id], 'test');
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
  check(N.founderName({ given: 'Erik' }, new Set(['Erikstorp'])) === 'Eriksryd', 'the founder\'s next ending');
}
// 3. Village names (VB-399): one function by the site, from a stream of the centre tile's own
{
  const st = Sim.seed(world(42, 280, 200), 42, 'populous'), many = st.villages.filter((v) => v.farmsteads.length >= 2);
  const vctx = (v) => ({ w: st.w, site: v.center, founder: null, mother: null });
  // joining: the link -e-, no vowel against a vowel, no part joined to itself, three of a letter made two
  check(N.join('Ek', 'by') === 'Ekeby' && N.join('Ek', 'vik') === 'Ekvik' && N.join('Al', 'by') === 'Alby', 'the link -e- of some trees before -by');
  check(N.join('Furu', 'ö') === null && N.join('Grå', 'åker') === null && N.join('Sand', 'ö') === 'Sandö', 'a vowel against a vowel');
  check(N.join('Berg', 'berga') === null && N.join('Lund', 'lunda') === null, 'a part joined to itself');
  check(N.join('Hall', 'lunda') === 'Hallunda' && N.join('Sten', 'näs') === 'Stennäs', 'three of a letter');
  // every ending takes kinds that exist, and every pair that joins gives a name of one capital and letters only
  const all = new Set();
  for (const x of N.END) for (const t of x.takes) {
    check(!!N.FIRST[t], `-${x.e} takes ${t}, which is no kind of first part`);
    for (const a of N.FIRST[t] || []) { const nm = N.join(a, x.e); if (nm) { all.add(nm); check(/^[A-ZÅÄÖ][a-zåäö]+$/.test(nm), `the name ${nm}`); } }
  }
  check(all.size >= 250, `the old layer makes ${all.size} names`);
  for (const bad of ['nes', 'säter', 'tuna', 'hult']) check(![...all].some((nm) => nm.endsWith(bad)), `an old village ends in -${bad}`);
  // the site: an ending only where the ground suits it
  for (const v of many) {
    const g = N.ground(st.w, v.center), offers = N.site(vctx(v), N.tileRand(v.center, 1));
    check(offers.length >= 12 && !dupes(offers).length, `${v.name}: ${offers.length} names offered, ${dupes(offers).length} repeated`);
    for (const nm of offers) {
      if (/(vik|näs)$/.test(nm)) check(g.water > 0, `${nm} offered with no water within ${N.VILLAGE.reach} steps`);
      if (/berga$/.test(nm)) check(g.hills >= N.VILLAGE.hill, `${nm} offered with ${g.hills} hill tiles`);
      if (/ö$/.test(nm)) check(g.isle, `${nm} offered on the main land`);
    }
  }
  // the same site gives the same name; taken names are passed over, and a number comes only when all are taken
  const v = many[1], name = (taken, order) => N.villageName(vctx(v), taken, N.tileRand(v.center, 1), order);
  const first = name(new Set()), offers = N.site(vctx(v), N.tileRand(v.center, 1));
  check(first === name(new Set()) && first === offers[0], 'the same stream gives the same village name');
  check(name(new Set([first])) === offers[1], 'a taken village name is passed over');
  check(name(new Set(offers)) === `${first} 2`, 'a number only when every offer is taken');
  // the old centre: one village of the map, its largest, and no other bears such a name
  const holy = /(tuna|vi)$/, big = many.reduce((a, b) => (b.farmsteads.length > a.farmsteads.length ? b : a));
  check(N.PLACE.central(vctx(v), N.tileRand(v.center, 1)).every((nm) => holy.test(nm) || nm === 'Tuna'), 'the centre\'s names');
  check(holy.test(big.name) && st.villages.filter((u) => holy.test(u.name)).length === 1, `one old centre, the largest (${big.name})`);
  out.push(`villages of seed 42: ${many.slice(0, 6).map((u) => u.name).join(', ')}; ${all.size} names in the old layer`);
}
if (failed) process.exit(1);
console.log(`names ok: ${out.join('; ')}`);
