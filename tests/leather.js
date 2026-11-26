// Leather (VB-911, sim/leather): a household's shoes wear by its walkers a day and its team's harness by the years; a hide is cut at home into
// LEATHER.pairs pairs of shoes, or into harness that makes good LEATHER.harnessMend of it; in winter, or in any season when nearly worn out.
// A slaughtered beast of the cattle gives a hide (sim/byre). The hide's need term reads a year of the wear. Populous at seed 8 on the small
// island of tests/lib/probe.js.
const VB = require('../src/load.js'), Sim = VB.sim, { island } = require('./lib/probe.js'), L = VB['sim/leather'];
const { KINDS, ASK } = VB['sim/kinds'], { YEAR_DAYS } = VB['sim/rules'], { hasTeam } = VB['sim/herds'];
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('LEATHER FAIL:', m); } };
const near = (a, b) => Math.abs(a - b) < 1e-9;
const { LEATHER } = L, SEED = 8;

// --- the kinds: one hand, in the house, asked at the farm; the work is a job, taken by the verb `work`
const C = KINDS.cobble, H = KINDS.harness;
check(C && C.hours === LEATHER.shoeHours && C.hands === 1 && C.methods[0].steps.some((s) => s.inside) && C.needs.includes('hide'), 'cobble: one hand, in the house, from a hide');
check(H && H.hours === LEATHER.harnessHours && H.hands === 1 && H.methods[0].steps.some((s) => s.inside) && H.needs.includes('hide'), 'harness: one hand, in the house, from a hide');
check(['cobble', 'harness'].every((k) => ASK.farmAfterPlans.some((e) => e[0] === k)), 'both are asked at the farm');

const st = Sim.seed(island(SEED), SEED, 'populous');
const all = st.liveHouseholds.map((id) => st.households[id]).filter((h) => h.farmstead !== null && h.members.length);
const hh = all.find((h) => hasTeam(st, h)) || all[0];
const f = st.farmsteads[hh.farmstead];
const posted = (K, season) => { const o = []; K.available(st, hh, f, { season }, (key, site, extra) => o.push({ key, site, ...extra })); return o; };

// --- the wear: the first day counts the members' own shoes, then each walker wears 1 / shoeDays a day
const n = L.walkers(st, hh);
check(n > 0 && n <= hh.members.length, `walkers ${n} of ${hh.members.length}`);
check(hh.shoes === undefined && posted(C, 3).length === 0, 'before the first day\'s wear, no shoes are wanted');
L.wearDay(st);
check(near(hh.shoes, n * LEATHER.keep - n / LEATHER.shoeDays), `a day's wear: ${hh.shoes}`);
const team = hasTeam(st, hh);
if (team) check(near(hh.harness, 1 - 1 / (LEATHER.harnessYears * YEAR_DAYS)), `the team's harness worn a day: ${hh.harness}`);
else check(hh.harness === undefined, 'no team: no harness worn');
hh.shoes = 0.5;
for (let d = 0; d < 10 * LEATHER.shoeDays; d++) L.wearDay(st);
check(hh.shoes === 0, 'worn to nothing, not below');

// --- cobbling: needs a hide; in winter, or in any season when nearly worn out
hh.hides = 0;
check(posted(C, 3).length === 0 && L.cobbled(st, hh) === 0 && hh.shoes === 0, 'no hide: no shoes');
hh.hides = 2;
const p = posted(C, 1);
check(p.length === 1 && p[0].site === f.house && p[0].key === `cobble:h${hh.id}`, 'worn out: shoes made in summer too');
check(L.cobbled(st, hh) === 1 && near(hh.shoes, LEATHER.pairs) && hh.hides === 1, `a hide makes ${LEATHER.pairs} pairs`);
check(hh.ledger.some((e) => e.kind === 'leather' && e.good === 'hide' && e.n === -1), 'the hide taken through the ledger');
hh.shoes = L.shoeTarget(st, hh) * (LEATHER.low + 0.1);
check(posted(C, 1).length === 0 && posted(C, 3).length === 1, 'below the target but not nearly worn out: in winter only');
hh.shoes = L.shoeTarget(st, hh);
check(posted(C, 3).length === 0, 'at the target: no shoes made');

// --- the harness: a team's, mended by a hide in winter, up to whole
hh.hides = 1;
hh.harness = 0.6;
check(posted(H, 3).length === (team ? 1 : 0) && posted(H, 1).length === 0, `the harness mended in winter, where there is a team (${team})`);
check(L.harnessed(st, hh) === 1 && near(hh.harness, Math.min(1, 0.6 + LEATHER.harnessMend)) && hh.hides === 0, 'a hide mends the harness');
check(L.harnessed(st, hh) === 0, 'no hide: no mending');

// --- the hide's need: a year's leather, its worth each hide short, nothing beyond
{ const Rules = VB['sim/registry'], G = VB['sim/goods'].goodOf('hide'), need = (k) => Rules.value(st, 'need', { hh, good: G, n: k, kept: 0 });
  const due = L.hidesWanted(st, hh);
  check(due === Math.ceil(n * YEAR_DAYS / LEATHER.shoeDays / LEATHER.pairs + (team ? 1 / (LEATHER.harnessYears * LEATHER.harnessMend) : 0) - 1e-9), `a year's hides: ${due}`);
  hh.hides = 0; check(near(need(1), VB['sim/norms'].norm('worth', 'hide')), 'a hide short is worth its worth');
  hh.hides = due; check(need(1) === 0, 'a year\'s hides held: no more wanted');
  hh.hides = 0; }

// --- the slaughter: a beast of the cattle gives a hide
{ const herd = st.herds[hh.herds.find((id) => st.herds[id].species === 'cattle')];
  if (herd && herd.head.length) {
    const entry = { head: herd.head[herd.head.length - 1].id };
    herd.cull.push(entry);
    KINDS.slaughter.done(st, { herd, entry }, hh);
    check(hh.hides === 1 && hh.ledger.some((e) => e.kind === 'slaughter' && e.good === 'hide'), 'a slaughtered beast gives its hide');
  } else check(false, 'the household keeps cattle'); }

// --- run: half a year from the start, under the invariants: shoes worn, and the hides of the slaughter made into shoes
{ const bad = checkState(st); check(bad.length === 0, 'invariants: ' + bad.slice(0, 3).join('; ')); }
Sim.advance(st, Sim.YEAR);
const shod = st.liveHouseholds.map((id) => st.households[id]).filter((h) => h.shoes !== undefined);
check(shod.length > 0, `a year: ${shod.length} households' shoes counted`);
const made = shod.filter((h) => (h.ledger || []).some((e) => e.kind === 'leather'));
{ const bad = checkState(st); check(bad.length === 0, 'a year: ' + bad.slice(0, 3).join('; ')); }
if (failed) { console.error(`leather: ${failed} failed`); process.exit(1); }
const mean = shod.reduce((s, h) => s + h.shoes / Math.max(1, L.shoeTarget(st, h)), 0) / shod.length;
console.log(`leather ok: a year, ${shod.length} households shod, mean ${mean.toFixed(2)} of their target, ${made.length} made leather`);
