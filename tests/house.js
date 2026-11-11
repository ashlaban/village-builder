// A well-kept house (VB-306): the condition wears 0.1 a year by closed form (0.067 tarred), 4 hours of upkeep raise it 0.1, offered under 0.8;
// prestige gains 0.15 times the condition for a holder and a holder's spouse (0.18 tarred); the pawn panel's parts name the term.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
const { KINDS } = VB['sim/kinds'], { houseCondition, houseTerm, YEAR } = VB['sim/rules'];
const { refreshPrestige, prestigeParts } = VB['sim/society'];
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('HOUSE FAIL:', m); } };
const near = (a, b) => Math.abs(a - b) < 1e-6;
const it = G.generate(7, { cols: 180, rows: 130 }); let r; while (!(r = it.next()).done);
const st = Sim.seed(r.value, 7, 'founders');
const f = st.farmsteads.find((x) => x.household !== null), hh = st.households[f.household];
const holder = st.pawns[hh.holder], sp = Sim.spouseOf(st, holder.id);
f.condition = 1; f.condAt = 0;
st.t = 2 * YEAR; check(near(houseCondition(st, f), 0.8), `two years of wear: ${houseCondition(st, f)}`);
f.tarredUntil = YEAR; // tarred for the first year only
check(near(houseCondition(st, f), 1 - 0.067 - 0.1), `a year tarred, a year not: ${houseCondition(st, f)}`);
f.tarredUntil = 0; f.condition = 1; f.condAt = st.t; st.t += 20 * YEAR; check(houseCondition(st, f) === 0, 'never below 0');
// prestige: holder 1.6 + 0.15 * condition; the spouse 1.3 + the same
f.condition = 0.8; f.condAt = st.t; refreshPrestige(st);
const base = (p) => prestigeParts(st, p)[0][1] + (p.age >= 55 ? 0.2 : 0);
check(near(holder.prestige, base(holder) + 0.12), `holder prestige ${holder.prestige}`);
if (sp !== null && st.pawns[sp].alive) check(near(st.pawns[sp].prestige, base(st.pawns[sp]) + 0.12), `spouse prestige ${st.pawns[sp].prestige}`);
f.tarredUntil = st.t + 6 * YEAR; refreshPrestige(st);
check(near(holder.prestige, base(holder) + 0.144), `tarred holder prestige ${holder.prestige}`);
check(near(houseTerm(st, f), 0.144), 'tarred term 0.18 x 0.8');
check(prestigeParts(st, holder).some(([l]) => /house/.test(l)), 'the parts name the house');
f.tarredUntil = 0;
// the work: offered under 0.8, 4 hours, raises 0.1
const K = KINDS.repair, posted = [];
check(K.type === 'upkeep' && K.hours === 4, 'repair is upkeep of 4 hours');
const post = (key) => posted.push(key);
f.condition = 0.85; f.condAt = st.t; K.available(st, hh, f, null, post); check(posted.length === 0, 'not offered at 0.85');
f.condition = 0.79; K.available(st, hh, f, null, post); check(posted.length === 1, 'offered at 0.79');
K.done(st, { farm: f }); check(near(f.condition, 0.89) && f.condAt === st.t, `raised to ${f.condition}`);
if (failed) process.exit(1);
console.log('house: ok');
