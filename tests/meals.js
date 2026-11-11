// Meals: meals are eaten first, grain covers a missed cook, the cook makes the next meal and may leave other work after 14:00.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
const { setClock } = require('./lib/clock.js');
const { feedHousehold, dailyNeed, seedReserve } = VB['sim/hunger'], { callCooks, refreshJobs } = VB['sim/jobs'], { complete, start } = VB['sim/agents'];
const { DAY, cal } = VB['sim/rules'];
const it = G.generate(7); let r; while (!(r = it.next()).done);
const fresh = () => Sim.seed(r.value, 7, 'founders');
const setup = (st, hh) => { for (const fd of st.farmsteads[hh.farmstead].fields) fd.stage = 'growing'; if (st.farmsteads[hh.farmstead].project) st.farmsteads[hh.farmstead].project = null; };

// every household starts with two days of meals, in every scenario
for (const sc of ['founders', 'heirs', 'populous']) {
  const it2 = G.generate(7); let r2; while (!(r2 = it2.next()).done);
  const st = Sim.seed(r2.value, 7, sc);
  for (const hh of st.households) assert(Math.abs(hh.meals - 2 * dailyNeed(st, hh)) < 1e-9 && hh.meals > 0, `${sc}: two days of meals`);
}
{ // meals are eaten before grain; a household whose cook was busy all day still eats from grain; with nothing it is short
  const st = fresh(), hh = st.households[0]; setup(st, hh);
  const need = dailyNeed(st, hh);
  hh.meals = need; hh.grain = 50; feedHousehold(st, hh);
  assert(Math.abs(hh.meals) < 1e-9 && hh.grain === 50 && hh.hungryDays === 0, 'meals first');
  hh.meals = 0; hh.cookDay = -1; feedHousehold(st, hh);
  assert(Math.abs(hh.grain - (50 - need)) < 1e-9 && hh.hungryDays === 0, 'no cook, no meals: grain is eaten, nobody is hungry');
  hh.grain = 0; feedHousehold(st, hh);
  assert.strictEqual(hh.hungryDays, 1, 'no grain and no meals: short');
}
{ // the cook turns grain into the meals still missing, keeping the seed reserve
  const st = fresh(), hh = st.households[0], f = st.farmsteads[hh.farmstead]; setup(st, hh);
  const need = dailyNeed(st, hh), cook = st.agents[hh.members.find((m) => st.pawns[m].role === 'wife')];
  hh.meals = need / 2; hh.grain = 100; hh.cookDay = -1;
  const c = cal(st.t), j = { kind: 'cook', farm: f, key: 'k', done: 0, claims: [cook.id] };
  st.jobs.set('k', j); cook.job = j; complete(st, cook);
  assert(Math.abs(hh.meals - need) < 1e-9 && Math.abs(hh.grain - (100 - need / 2)) < 1e-9 && hh.cookDay === c.day, 'cooked up to the next meal');
  hh.meals = 0; hh.grain = 0.2; hh.cookDay = -1; st.jobs.set('k', j); complete(st, cook);
  assert(Math.abs(hh.meals - 0.2) < 1e-9 && hh.grain === 0, 'only the grain there is');
  f.project = { tile: f.house, stage: 'clear', hours: 1 }; hh.meals = 0; hh.grain = seedReserve(st, hh); st.jobs.set('k', j); complete(st, cook);
  assert.strictEqual(hh.meals, 0, 'seed is not cooked');
}
{ // from 14:00 a household short of meals calls its best cook off other work; the job it leaves keeps its progress
  const st = fresh(), hh = st.households[0], f = st.farmsteads[hh.farmstead]; setup(st, hh);
  setClock(st, Math.floor(st.t / DAY) * DAY + 14); st.jobs.clear();
  const c = cal(st.t), mate = hh.members.filter((m) => st.pawns[m].role === 'wife')[0], a = st.agents[mate];
  hh.meals = 0; hh.grain = 100; hh.cookDay = -1;
  const wood = { id: 99, key: 'wood:x', kind: 'wood', owner: { type: 'household', id: hh.id }, site: st.villages[f.village].wood[0], done: 1.5, claims: [], posted: st.t, farm: f, live: true };
  st.jobs.set(wood.key, wood); start(st, a, wood); a.path = null; a.phase = 'work';
  refreshJobs(st, c); callCooks(st, c);
  assert.strictEqual(a.job.kind, 'cook', 'the cook goes home to cook'); assert.strictEqual(wood.claims.length, 0); assert.strictEqual(wood.done, 1.5);
  assert(st.jobs.has('wood:x'), 'the other job stays on the board');
}
{ // a larder that covers the day in pieces: their sum may pass the want by a rounding error, and the meal must not take a negative amount
  // (populous 3, small, stepped a year at a time, crashed in year 15: 8 rations, 0.3 eaten early, then 7.700000000000001 from the larder)
  const st = fresh(), hh = st.households[0]; setup(st, hh);
  const adults = hh.members.filter((id) => VB['sim/records'].age(st, st.pawns[id]) >= 14).length;
  st.ECON = { ...st.ECON, ration: { adult: 4 / adults, child: 0 } }; // a need of 4 rations, so 0.1 early leaves 3.9
  hh.meals = 0; hh.grain = seedReserve(st, hh);
  hh.larder = [{ kind: 'fresh meat', n: 0.1, until: st.t + 2 * DAY }, ...Array.from({ length: 6 }, (_, i) => ({ kind: 'butter', n: 0.2, until: st.t + (10 + i) * DAY })),
    { kind: 'salt meat', n: 100, until: st.t + 40 * DAY }];
  assert.doesNotThrow(() => feedHousehold(st, hh), 'a rounding error in the larder\'s sum is not a negative meal');
  assert.strictEqual(hh.hungryDays, 0, 'the larder fed them');
}
{ // VB-259: a ration is only the unit; the foods table names every food, and the cook makes meals by a food's worth
  const { FOODS } = VB['sim/rules'], S = VB['sim/stores'];
  for (const k of ['grain', 'meat', 'salt meat', 'milk', 'butter']) assert(FOODS[k] && FOODS[k].worth > 0, `FOODS has ${k}`);
  assert(FOODS.grain.keeps === null && FOODS.grain.source === 'grain' && !FOODS.grain.raw, 'grain: no shelf life, its own source, cooked');
  const st = fresh(), hh = st.households[0], worth = FOODS.grain.worth;
  hh.meals = 0; hh.grain = 10;
  try { FOODS.grain.worth = 2; S.cook(st, hh, 'grain', 3); } finally { FOODS.grain.worth = worth; }
  assert(hh.grain === 7 && hh.meals === 6, `cooking reads the table: ${hh.grain} grain, ${hh.meals} meals`);
  assert.throws(() => S.cook(st, hh, 'milk', 1), /cannot hold/, 'only stored foods are cooked');
}
console.log('meals ok');
