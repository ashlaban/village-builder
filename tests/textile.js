// Wool to cloth (VB-362, sim/textile): a fleece spun into a skein as background work at the house, up to TEXTILE.yarnStock skeins; two
// skeins woven into a length of a drawn grade at the household's loom; the loom a small making; the practice "Spinning and weaving are"
// sets who spins (women's work, or everyone's indoor work). Populous at seed 8 on the small island of tests/lib/probe.js.
const VB = require('../src/load.js'), Sim = VB.sim, { island } = require('./lib/probe.js'), T = VB['sim/textile'];
const { KINDS, ASK } = VB['sim/kinds'], Customs = VB['sim/customs'], Stores = VB['sim/stores'];
const { score } = VB['sim/fit'];
const prioOf = (st, p, j, stand = 0) => T.rank(st, p, j, stand);
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('TEXTILE FAIL:', m); } };
const { TEXTILE, SPINNERS } = T, SEED = 8;

// --- the kinds: spinning at the side, at the house; weaving and the loom full work in the house
const S = KINDS.spin, W = KINDS.weave, L = KINDS.loom;
check(S && S.attention === 'background' && S.reach === TEXTILE.reach && S.hours === TEXTILE.spinHours && S.craft === 'spinning', 'spin: background work at the house');
check(W && !W.attention && W.hours === TEXTILE.weaveHours && W.craft === 'weaving' && W.needs.includes('loom'), 'weave: at the loom');
check(L && L.project && L.hours === TEXTILE.loomHours, 'the loom: a project step');
check(['spin', 'weave'].every((k) => ASK.farmAfterPlans.some((e) => e[0] === k)), 'both are asked at the farm');
check(Customs.PRACTICES.spinning.base === 'women' && Customs.PRACTICES.spinning.malleability === 0.4, 'the practice: women\'s work by default');
check(VB['sim/norms'].norm('worth', 'yarn') === 12 && VB['sim/norms'].norm('worth', 'cloth') === 40, 'worth: a skein 12, a length 40');

const st = Sim.seed(island(SEED), SEED, 'populous');
const all = st.liveHouseholds.map((id) => st.households[id]).filter((h) => h.farmstead !== null && h.members.length);
const hh = all[0], f = st.farmsteads[hh.farmstead];
const posted = (K) => { const o = []; K.available(st, hh, f, { season: 3 }, (key, site, extra) => o.push({ key, site, ...extra })); return o; };

// --- spinning: a fleece to a skein, through the stores, while there are fleeces and fewer skeins than the stock
hh.wool = 0;
check(posted(S).length === 0 && T.spun(st, hh) === 0, 'no fleece: nothing spun');
hh.wool = 2;
const p = posted(S);
check(p.length === 1 && p[0].site === f.house && p[0].key === `spin:h${hh.id}`, 'a fleece: spinning posted at the house');
check(T.spun(st, hh) === 1 && hh.wool === 1 && T.yarnOf(hh) === 1, 'a fleece makes a skein');
check(hh.ledger.some((e) => e.kind === 'spin' && e.good === 'wool' && e.n === -1) && hh.ledger.some((e) => e.kind === 'spin' && e.good === 'yarn' && e.n === 1), 'both through the ledger');
hh.yarn = TEXTILE.yarnStock;
check(posted(S).length === 0, 'at the stock of skeins: no more spun');

// --- weaving: needs the loom and two skeins; a length of a drawn grade
delete hh.loom;
check(posted(W).length === 0, 'no loom: nothing woven');
hh.loom = { built: st.t };
check(posted(W).length === 1, 'a loom and the skeins: weaving posted');
const maker = hh.members[0];
check(T.woven(st, hh, maker) === 1 && hh.yarn === TEXTILE.yarnStock - TEXTILE.skeins && T.clothOf(hh) === 1, 'two skeins make a length');
check(Array.isArray(hh.cloth) && hh.cloth.length === 5 && hh.cloth.reduce((a, b) => a + b) === 1, `cloth by grade: ${JSON.stringify(hh.cloth)}`);
Stores.put(st, hh, 'cloth', 2, { kind: 'weave', grade: 4 });
check(Stores.take(st, hh, 'cloth', 2, 'weave') === 2 && hh.cloth[4] === 1, 'a take spends the least worth first');
hh.yarn = 1;
check(posted(W).length === 0 && T.woven(st, hh, maker) === 0, 'one skein: nothing woven');

// --- who spins: by the practice, the role and the sex
const job = { kind: 'spin' };
const role = (r, sex) => ({ role: r, sex, household: hh.id });
check(prioOf(st, role('wife', 'f'), job) === SPINNERS.women.wife && prioOf(st, role('daughter', 'f'), job) === SPINNERS.women.daughter, 'the mistress and the daughter spin');
check(prioOf(st, role('son', 'm'), job) === 0 && prioOf(st, role('child', 'f'), job) === 0, 'women\'s work: no son, no child');
check(prioOf(st, role('farmer', 'm'), job, 1) === SPINNERS.women.wife, 'a holder standing in for an absent mistress spins as she would');
const s = st.cenv.settlements[f.village], c = st.cenv.cultures[s.culture];
c.practices = { ...(c.practices || {}), spinning: 'everyone' };
check(T.practice(st, hh) === 'everyone' && prioOf(st, role('son', 'm'), job) === SPINNERS.men && prioOf(st, role('wife', 'f'), job) === SPINNERS.women.wife, 'everyone\'s indoor work: men too');
c.practices.spinning = 'women';
{ // sim/fit reads the kind's rank: a woman of the household bids for the spinning, a man does not
  const w = hh.members.map((id) => st.pawns[id]).find((q) => q.sex === 'f' && q.role !== 'child'),
    m = hh.members.map((id) => st.pawns[id]).find((q) => q.sex === 'm' && q.role !== 'child' && q.role !== 'farmer');
  const sj = { kind: 'spin', site: f.house, claims: [] }, cal = VB['sim/rules'].cal(st.t);
  if (w) check(score(st, w, sj, cal) > 0, `the ${w.role} bids for the spinning`);
  if (m) check(score(st, m, sj, cal) === null, `the ${m.role} does not`);
}

// --- the loom, a making: why not, and its step
const M = VB['sim/makings'].makingOf('loom');
check(M && M.small && M.why(st, hh, f) === `the household has a loom`, 'a household with a loom builds none');
delete hh.loom;
const plan = M.begin(st, hh, f);
check(plan.steps.length === 1 && plan.steps[0].kind === 'loom' && plan.steps[0].timber === TEXTILE.loomTimber, 'the loom: one step, its timber');

// --- run: a year from the start, under the invariants: fleeces shorn and spun
hh.yarn = 0; hh.cloth = [0, 0, 0, 0, 0];
{ const bad = checkState(st); check(bad.length === 0, 'invariants: ' + bad.slice(0, 3).join('; ')); }
Sim.advance(st, Sim.YEAR);
const hs = st.liveHouseholds.map((id) => st.households[id]);
const spunN = hs.reduce((n, h) => n + (h.ledger || []).filter((e) => e.kind === 'spin' && e.good === 'yarn').length, 0);
check(spunN > 0, `a year: ${spunN} skeins spun`);
{ const bad = checkState(st); check(bad.length === 0, 'a year: ' + bad.slice(0, 3).join('; ')); }
if (failed) { console.error(`textile: ${failed} failed`); process.exit(1); }
const looms = hs.filter((h) => h.loom).length, cloth = hs.reduce((n, h) => n + T.clothOf(h), 0);
console.log(`textile ok: a year, ${spunN} skeins spun, ${looms} looms, ${cloth} lengths woven`);
