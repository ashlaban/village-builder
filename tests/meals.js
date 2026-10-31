// Meals: cooked rations are eaten first, grain covers a missed cook, the cook makes the next meal and may leave other work after 14:00.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
const { feedHousehold, dailyNeed, seedReserve } = VB['sim/hunger'], { callCooks, refreshJobs } = VB['sim/jobs'], { complete, start } = VB['sim/agents'];
const { DAY, cal } = VB['sim/rules'];
const it = G.generate(7); let r; while (!(r = it.next()).done);
const fresh = () => Sim.seed(r.value, 7, 'founders');
const setup = (st, hh) => { for (const fd of st.farmsteads[hh.farmstead].fields) fd.stage = 'growing'; if (st.farmsteads[hh.farmstead].project) st.farmsteads[hh.farmstead].project = null; };

// every household starts with two days of rations, in every scenario
for (const sc of ['founders', 'heirs', 'populous']) {
  const it2 = G.generate(7); let r2; while (!(r2 = it2.next()).done);
  const st = Sim.seed(r2.value, 7, sc);
  for (const hh of st.households) assert(Math.abs(hh.rations - 2 * dailyNeed(st, hh)) < 1e-9 && hh.rations > 0, `${sc}: two days of rations`);
}
{ // rations are eaten before grain; a household whose cook was busy all day still eats from grain; with nothing it is short
  const st = fresh(), hh = st.households[0]; setup(st, hh);
  const need = dailyNeed(st, hh);
  hh.rations = need; hh.grain = 50; feedHousehold(st, hh);
  assert(Math.abs(hh.rations) < 1e-9 && hh.grain === 50 && hh.hungryDays === 0, 'rations first');
  hh.rations = 0; hh.cookDay = -1; feedHousehold(st, hh);
  assert(Math.abs(hh.grain - (50 - need)) < 1e-9 && hh.hungryDays === 0, 'no cook, no rations: grain is eaten, nobody is hungry');
  hh.grain = 0; feedHousehold(st, hh);
  assert.strictEqual(hh.hungryDays, 1, 'no grain and no rations: short');
}
{ // the cook turns grain into the rations still missing, keeping the seed reserve
  const st = fresh(), hh = st.households[0], f = st.farmsteads[hh.farmstead]; setup(st, hh);
  const need = dailyNeed(st, hh), cook = st.agents[hh.members.find((m) => st.pawns[m].role === 'wife')];
  hh.rations = need / 2; hh.grain = 100; hh.cookDay = -1;
  const c = cal(st.t), j = { kind: 'cook', farm: f, key: 'k', done: 0, claims: [cook.id] };
  st.jobs.set('k', j); cook.job = j; complete(st, cook);
  assert(Math.abs(hh.rations - need) < 1e-9 && Math.abs(hh.grain - (100 - need / 2)) < 1e-9 && hh.cookDay === c.day, 'cooked up to the next meal');
  hh.rations = 0; hh.grain = 0.2; hh.cookDay = -1; st.jobs.set('k', j); complete(st, cook);
  assert(Math.abs(hh.rations - 0.2) < 1e-9 && hh.grain === 0, 'only the grain there is');
  f.project = { tile: f.house, stage: 'clear', hours: 1 }; hh.rations = 0; hh.grain = seedReserve(st, hh); st.jobs.set('k', j); complete(st, cook);
  assert.strictEqual(hh.rations, 0, 'seed is not cooked');
}
{ // from 14:00 a household short of rations calls its best cook off other work; the job it leaves keeps its progress
  const st = fresh(), hh = st.households[0], f = st.farmsteads[hh.farmstead]; setup(st, hh);
  st.t = Math.floor(st.t / DAY) * DAY + 14; st.jobs.clear();
  const c = cal(st.t), mate = hh.members.filter((m) => st.pawns[m].role === 'wife')[0], a = st.agents[mate];
  hh.rations = 0; hh.grain = 100; hh.cookDay = -1;
  const wood = { id: 99, key: 'wood:x', kind: 'wood', owner: { type: 'household', id: hh.id }, site: f.woodlot, done: 1.5, claims: [], posted: st.t, farm: f, live: true };
  st.jobs.set(wood.key, wood); start(st, a, wood); a.path = null; a.phase = 'work';
  refreshJobs(st, c); callCooks(st, c);
  assert.strictEqual(a.job.kind, 'cook', 'the cook goes home to cook'); assert.strictEqual(wood.claims.length, 0); assert.strictEqual(wood.done, 1.5);
  assert(st.jobs.has('wood:x'), 'the other job stays on the board');
}
console.log('meals ok');
