// Goods for the fair (VB-299): the registry of goods (quantum, perishing, class, keeping), Culture's norms worth and proper as rules, and
// need: food against the year ahead, an animal against the household's herd and hay, tar and ale, a keeping good beyond need. Nothing of it
// is in saved state, and needValue allocates nothing.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, Rules = VB['sim/registry'], Culture = VB.culture;
const Stores = VB['sim/stores'], { needValue, propriety, KEEPING } = VB['sim/exchange'];
const { dailyNeed, toHarvest, NEED } = VB['sim/hunger'];
const { HERD, YEAR_DAYS, DAY, SEASON_DAYS } = VB['sim/rules'];
let checks = 0;
const near = (a, b, what) => { assert(Math.abs(a - b) < 1e-6, `${what}: ${a}, wanted ${b}`); checks++; };

// ---- the registry: every good the fair trades, and nothing else; worth as the agreed table ----
const WANT = { grain: 10, butter: 15, 'salt meat': 15, 'dried fish': 15, tar: 8, ale: 14, 'cattle/cow': 40, 'cattle/ox': 50, 'cattle/heifer': 20,
  'cattle/steer': 20, sheep: 6, quern: 25 }; // the hand quern (VB-009; Proposed)
assert.deepStrictEqual(Stores.goods().map((g) => g.id).sort(), Object.keys(WANT).sort(), 'the goods of the fair');
for (const [id, w] of Object.entries(WANT)) {
  near(Culture.norm('worth', id), w, `worth of ${id}`);
  near(Rules.value(null, 'worth', { good: Stores.goodOf(id) }), w, `the worth rule for ${id}`);
}
assert.deepStrictEqual(Stores.goods().filter((g) => g.keeping).map((g) => g.id).sort(), ['butter', 'dried fish', 'quern', 'salt meat', 'sheep', 'tar']);
for (const id of ['grain', 'butter', 'salt meat', 'dried fish']) {
  const g = Stores.goodOf(id); assert(g.class === 'food' && g.quantum === 10 && g.rations === 1 && g.unit === 'ration', id);
}
for (const id of ['cattle/cow', 'cattle/ox', 'cattle/heifer', 'cattle/steer', 'sheep', 'tar', 'quern']) assert.strictEqual(Stores.goodOf(id).class, 'wares', id);
assert(Stores.goods().every((g) => Object.isFrozen(g) && g.perish === null || g.perish.keepsDays > 0 || g.perish.lossPerYear > 0), 'perishing');
assert.throws(() => Stores.goodOf('wool'), /unknown good/); // wool and cheese are not goods yet
assert.throws(() => Stores.declareGood({ id: 'grain' }), /invalid or duplicate/);
checks += 4;

// ---- proper: each class rule ----
const P = (a, b, days = 100) => Culture.norm('proper', a, b, days);
assert.strictEqual(P('food', 'food'), 'ordinary'); assert.strictEqual(P('wares', 'wares'), 'ordinary'); // within a class
assert.strictEqual(P('food', 'wares'), 'admired'); assert.strictEqual(P('wares', 'food', 60), 'admired'); // food for an animal
assert.strictEqual(P('wares', 'food', 59.9), 'hard'); assert.strictEqual(P('food', 'wares', 10), 'admired'); // an animal given in dearth
for (const c of Culture.CLASSES) { assert.strictEqual(P('land', c), 'none'); assert.strictEqual(P(c, 'land'), 'none'); } // land in no deal
assert.throws(() => P('silver', 'food'), /Unknown class/);
for (const [a, b, d] of [['food', 'food', 0], ['wares', 'food', 10], ['wares', 'food', 90], ['land', 'food', 90]]) {
  assert.strictEqual(Culture.PROPER[Rules.value(null, 'proper', { from: a, to: b, days: d })], P(a, b, d), `the proper rule ${a} ${b} ${d}`);
}
checks += 6;

// ---- need, on a seeded founders run ----
const it = G.generate(3, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done);
const st = Sim.seed(r.value, 3, 'founders');
assert(!JSON.stringify(Sim.save(st)).includes('dried fish'), 'nothing of the goods in saved state');
assert.throws(() => Stores.declareGood({ id: 'cloth' }), /load time/, 'goods close with the rules registry');
checks += 2;
// a household whose pot lacks a source below more than a sack of it (10 rations): the fifth of its need to the harvest (the first
// household at this seed is too small for that since the villages were laid out anew, VB-402)
const hh = st.households.find((h) => !h.dissolved && h.holder !== null && NEED.lackingShare * toHarvest(st.t) * dailyNeed(st, h) > 10);
const need = dailyNeed(st, hh), days = toHarvest(st.t), buffer = st.pawns[hh.holder].buffer;
const reach = Stores.reserved(st, hh, 'grain') + (days + buffer) * need, ample = Math.max(reach, 2 * YEAR_DAYS * need);
hh.larder = [{ kind: 'meat', n: 1e-9, until: st.t + DAY }]; // no butter, salt meat or dried fish: those sources the pot lacks
const stock = (g) => { hh.grain = { barley: g }; };
// food: 1 a ration at the reach; 3 at empty stores; 0.5 beyond two years' need
stock(reach); near(needValue(st, hh, 'grain', 1), 10, 'a sack at the reach');
stock(ample + 100); near(needValue(st, hh, 'grain', 1), 5, 'a sack beyond two years');
// at empty stores the pot lacks grain too, so the sack counts NEED.lacking times; the mean of the line over 10 rations
stock(0); near(needValue(st, hh, 'grain', 1), NEED.lacking * (30 - 2 * 100 / (2 * reach)), 'a sack at empty stores');
assert(reach / 2 > NEED.lackingShare * days * need + 10, 'halfway, the pot has grain');
stock(reach / 2); near(needValue(st, hh, 'grain', 1), 10 * (3 - 2 * (reach / 2 + 5) / reach), 'halfway down the line');
stock(reach); near(needValue(st, hh, 'grain', -1), -(10 * (1 + 2 * 5 / reach)), 'giving a sack at the reach costs the line below it');
// a food the pot lacks: 1.2 times, up to a fifth of the need to the next harvest
const fifth = NEED.lackingShare * days * need;
assert(fifth > 10, `a fifth of the need ${fifth} holds a lot`);
stock(reach); near(Rules.value(st, 'need', { hh, good: Stores.goodOf('salt meat'), n: 1, kept: 0 }), 12, 'salt meat the pot lacks');
hh.larder.push({ kind: 'salt meat', n: fifth, until: st.t + 40 * DAY });
const held = Sim.grainOf(hh) + hh.larder.reduce((s, l) => s + l.n, 0);
assert(held > reach); stock(reach - fifth - 1e-9); // stores at the reach again
near(Rules.value(st, 'need', { hh, good: Stores.goodOf('salt meat'), n: 1, kept: 0 }), 10, 'salt meat the pot has');
hh.larder = [];
// a keeping good to a full household: its worth, up to 30 rations' worth held at once
stock(ample + 1000);
near(needValue(st, hh, 'butter', 1), 15, 'butter beyond need, as a keeping good');
near(needValue(st, hh, 'butter', 2), 30, 'two lots fill the back load');
near(needValue(st, hh, 'butter', 3), 30, 'a third lot is beyond the load');
near(needValue(st, hh, 'butter', 1, 20), 10 * NEED.beyond * NEED.lacking, 'beyond the load, need alone (the pot lacks milk)');
near(needValue(st, hh, 'grain', 1), 10 * NEED.beyond, 'grain does not keep');
near(needValue(st, hh, 'tar', 1), 8, 'tar as a keeping good'); near(needValue(st, hh, 'tar', 1, KEEPING.cap - 7), 0, 'no room for tar');
near(Rules.value(st, 'need', { hh, good: Stores.goodOf('tar'), n: 1, kept: 0 }), 0, 'no boat or house due');
near(needValue(st, hh, 'ale', 1), 7, 'ale with no occasion ahead');
// animals: 1.5 times with none of its kind, 1 otherwise, nothing without hay for the winter
const cows = (h) => h.herds.map((id) => st.herds[id]).filter((hd) => hd.species === 'cattle').reduce((s, hd) => s + hd.head.filter((x) => x.kind === 'cow').length, 0);
const any = st.households.filter((h) => !h.dissolved && h.herds.length);
const withCow = any.find((h) => cows(h) > 0);
assert(withCow, 'a founders household with a cow');
withCow.hay = 1e6;
near(needValue(st, withCow, 'cattle/cow', 1), 40, 'a cow to a household with cows');
near(needValue(st, withCow, 'cattle/ox', 1), withCow.herds.some((id) => st.herds[id].head && st.herds[id].head.some((x) => x.kind === 'ox')) ? 50 : 75,
  'an ox, by whether it has one');
withCow.hay = 0;
near(needValue(st, withCow, 'cattle/cow', 1), 0, 'no hay for the winter');
near(needValue(st, withCow, 'cattle/cow', -1), 0, 'hay short: giving one up costs nothing');
const empty = st.households.find((h) => !h.dissolved && h.holder !== null);
const saveHerds = empty.herds; empty.herds = []; empty.hay = 1e6;
near(needValue(st, empty, 'cattle/cow', 1), 60, 'a first cow');
near(needValue(st, empty, 'cattle/cow', 2), 100, 'a first and a second cow');
near(needValue(st, empty, 'sheep', 1), 9, 'a first sheep');
const doy = Math.floor(st.t / DAY) % YEAR_DAYS; // the stall days to come: the rest of this winter's, or a whole stall period
const left = doy < HERD.stall[1] ? HERD.stall[1] - 1 - doy : doy >= HERD.stall[0] ? YEAR_DAYS - 1 - doy + HERD.stall[1] : HERD.stallDays;
empty.hay = 1.5 * left * HERD.hay.cow; near(needValue(st, empty, 'cattle/cow', 2), 60, 'hay for one cow only');
empty.herds = saveHerds;
withCow.hay = 1e6; const n0 = cows(withCow);
near(needValue(st, withCow, 'cattle/cow', -n0), -(40 * (n0 - 1) + 60), 'giving up every cow: the last costs the most');
// propriety from a household's stores
stock(60 * need + 1e-6 - hh.larder.reduce((s, l) => s + l.n, 0)); assert.strictEqual(propriety(st, hh, 'cattle/cow', 'grain'), 'admired');
stock(59 * need); assert.strictEqual(propriety(st, hh, 'cattle/cow', 'grain'), 'hard');
assert.strictEqual(propriety(st, hh, 'grain', 'cattle/cow'), 'admired'); assert.strictEqual(propriety(st, hh, 'butter', 'grain'), 'ordinary');
checks += 4;
// the harvest's days: a season in autumn, else to the start of autumn
near(toHarvest(0), 2 * SEASON_DAYS, 'spring day 1'); near(toHarvest(2 * SEASON_DAYS * DAY), SEASON_DAYS, 'autumn');
near(toHarvest(3 * SEASON_DAYS * DAY), 3 * SEASON_DAYS, 'winter day 1');

// ---- needValue allocates nothing ----
if (global.gc) {
  stock(reach); const goods = ['grain', 'butter', 'cattle/cow', 'sheep', 'tar', 'ale'];
  let sink = 0; for (let i = 0; i < 1000; i++) sink += needValue(st, withCow, goods[i % 6], 1 + (i & 1)); // warm up
  global.gc(); const heap = process.memoryUsage().heapUsed;
  for (let i = 0; i < 300000; i++) sink += needValue(st, withCow, goods[i % 6], 1 + (i & 1));
  global.gc(); const growth = process.memoryUsage().heapUsed - heap;
  assert(growth < 500000 && Number.isFinite(sink), `300,000 need values retain under 0.5 MB: ${growth}`);
  checks++;
}
console.log(`goods: ${Stores.goods().length} goods, worth and proper as rules, need by food, animals, tar and ale; ${checks} checks`);
