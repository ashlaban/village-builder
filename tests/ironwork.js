// @suite integration
// Iron tools (VB-701, sim/ironwork): a household's tools have a condition from 0 to 1 that ploughing, reaping and felling wear by
// TOOLS.wear an hour, and that slows that work to 1 - TOOLS.share + TOOLS.share × condition of a hand's rate (never barred); bog ore and
// firewood smelted at the farm into a bloom; a winter's mending takes a tenth of a bloom and restores a tenth. Iron's target is its
// mending need; it is a keeping good of the fair. Populous at seed 8 on the small island of tests/lib/probe.js.
const VB = require('../src/load.js'), Sim = VB.sim, { island } = require('./lib/probe.js'), I = VB['sim/ironwork'];
const { KINDS, ASK } = VB['sim/kinds'], Targets = VB['sim/targets'], Goods = VB['sim/goods'];
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('IRONWORK FAIL:', m); } };
const near = (a, b) => Math.abs(a - b) < 1e-9;
const { TOOLS, IRON } = I, SEED = 8;

// --- the kinds and the good
const S = KINDS.smelt, M = KINDS.mendtools;
check(S && S.hours === IRON.hours && S.hands === IRON.hands && S.craft === 'smelting', 'smelt: its hours, hands and craft');
check(M && M.hours === TOOLS.mendHours && M.hands === 1 && M.craft === 'smithing' && M.methods[0].steps.some((s) => s.inside), 'mendtools: one hand, in the house, smithing');
check(['smelt', 'mendtools'].every((k) => ASK.farmAfterPlans.some((e) => e[0] === k)), 'both are asked at the farm');
const G = Goods.goodOf('iron');
check(G && G.class === 'wares' && G.unit === 'bloom' && G.quantum === 1 && G.perish === null && G.keeping, 'iron: a keeping good, a bloom');
check(VB['sim/fair'].FAIR.goods.includes('iron'), 'iron is a good of the fair');

const st = Sim.seed(island(SEED), SEED, 'populous');
const hh = st.liveHouseholds.map((id) => st.households[id]).find((h) => h.farmstead !== null);
const f = st.farmsteads[hh.farmstead];
const job = (kind, owner = { type: 'household', id: hh.id }) => ({ kind, owner });

// --- the condition and the rate: sound at the start, a tooled kind slowed by wear, never barred, other kinds untouched
check(hh.tools === undefined && I.condition(hh) === 1 && I.rate(st, job('plow')) === 1, 'a new household has sound tools');
I.wear(st, job('plow'), 100);
check(near(hh.tools, 1 - 100 * TOOLS.wear), `100 hours of ploughing wear ${1 - hh.tools}`);
I.wear(st, job('cook'), 100);
check(near(hh.tools, 1 - 100 * TOOLS.wear), 'cooking does not wear the tools');
I.wear(st, job('reap'), 1e6);
check(hh.tools === 0, 'worn to nothing, not below');
for (const k of TOOLS.kinds) check(near(I.rate(st, job(k)), 1 - TOOLS.share), `${k} with worn tools goes at ${I.rate(st, job(k))}`);
check(I.rate(st, job('cook')) === 1 && I.rate(st, job('plow', { type: 'village', id: 0 })) === 1, 'other work and a village\'s work are not slowed');
hh.tools = 0.5;
check(near(I.rate(st, job('fell')), 1 - TOOLS.share / 2), 'half worn: half the share lost');

// --- the target: the mending need, in blooms
// (the head's review compiles it into the plan, sim/seasonal goodTargets; dropped here, the target reads the need now)
const compiled = () => {
  const S = st.plans.households.get(hh.id).season, i = S.findIndex((s) => s.what.target && s.what.target.good === 'iron');
  if (i >= 0) S.splice(i, 1);
};
compiled();
check(near(Targets.target(st, hh, 'iron'), I.mendingNeed(hh)) && near(I.mendingNeed(hh), 0.5 * TOOLS.mendIron / TOOLS.mend), `the target is the mending need (${I.mendingNeed(hh)})`);
const posted = (K, season) => { const o = []; K.available(st, hh, f, { season }, (key, site, extra) => o.push({ key, site, ...extra })); return o; };

// --- smelting: needs the ore and the wood, in autumn and winter, while iron is wanted
hh.bogOre = IRON.ore - 1; hh.wood = 50;
check(posted(S, 2).length === 0, 'too little ore: no smelting');
hh.bogOre = IRON.ore;
check(posted(S, 0).length === 0, 'no smelting in spring');
const p = posted(S, 2);
check(p.length === 1 && p[0].site === f.house && p[0].key === `smelt:h${hh.id}`, 'smelting at the farm in autumn');
const wood0 = hh.wood;
check(I.smelted(st, hh) === 1 && hh.iron === 1 && hh.bogOre === 0 && near(hh.wood, wood0 - IRON.wood), `a bloom from ${IRON.ore} ore and ${IRON.wood} wood`);
check(hh.ledger.some((e) => e.kind === 'smelt' && e.good === 'iron' && e.n === 1) && hh.ledger.some((e) => e.kind === 'smelt' && e.good === 'bogOre' && e.n === -IRON.ore), 'through the ledger');
check(I.smelted(st, hh) === 0 && hh.iron === 1, 'no ore left: nothing smelted');
hh.bogOre = IRON.ore;
check(posted(S, 2).length === 0, 'holding its need, the household smelts no more');

// --- mending: in winter, a tenth of a bloom for a tenth of condition, up to whole
check(posted(M, 2).length === 0 && posted(M, 3).length === 1, 'mending in winter');
const t0 = hh.tools;
check(I.mended(st, hh) === 1 && near(hh.tools, t0 + TOOLS.mend) && near(hh.iron, 1 - TOOLS.mendIron), `a mending: ${t0} to ${hh.tools}`);
hh.tools = 0.97; I.mended(st, hh);
check(hh.tools === 1, 'mended to whole, not beyond');
check(posted(M, 3).length === 0, 'sound tools are not mended');
hh.tools = 0.5; hh.iron = 0;
check(posted(M, 3).length === 0 && I.mended(st, hh) === 0 && hh.tools === 0.5, 'no iron: no mending');

// --- the need term: a bloom short is worth the good's worth, beyond the target nothing
{ compiled(); const Rules = VB['sim/registry'], need = (n) => Rules.value(st, 'need', { hh, good: G, n, kept: 0 });
  hh.iron = 0; hh.tools = 0; check(near(need(1), 30), `a bloom short is worth ${need(1)}`);
  hh.tools = 1; check(need(1) === 0, 'sound tools: a bloom is worth nothing by need'); }

// --- worked: the progress of a ploughing wears the tools, and the rate reads them
{ const bad = checkState(st).filter((m) => /iron|tools|ledger/.test(m)); check(bad.length === 0, 'invariants: ' + bad.slice(0, 3).join('; ')); }
delete hh.tools;
Sim.advance(st, 0.5 * Sim.YEAR);
const worn = st.liveHouseholds.map((id) => st.households[id]).filter((h) => h.tools !== undefined);
check(worn.length > 0 && worn.every((h) => h.tools < 1), `half a year: ${worn.length} households' tools worn`);
{ const bad = checkState(st); check(bad.length === 0, 'half a year: ' + bad.slice(0, 3).join('; ')); }
if (failed) { console.error(`ironwork: ${failed} failed`); process.exit(1); }
const mean = worn.reduce((s, h) => s + h.tools, 0) / Math.max(1, worn.length);
console.log(`ironwork ok: half a year, ${worn.length} households' tools worn, mean condition ${mean.toFixed(3)}`);
