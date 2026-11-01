// Marriage limit by civil degree (VB-029): degrees on a constructed pedigree, who may never marry, and the scarcity and plenty pulls on kinLimit.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, C = VB.culture, rules = VB['sim/rules'];
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('KINSHIP FAIL:', m); } };
// pedigree: 0,1 grandparents; 2,3 their children; 4 spouse of 2 from outside (no parents on record); 5 child of 2,4 (first cousin of 7 via 0,1)
const mk = (father, mother) => ({ father, mother });
const st = { pawns: [mk(null, null), mk(null, null), mk(0, 1), mk(0, 1), mk(null, null), mk(2, 4), mk(null, null), mk(3, 6), mk(5, null), mk(8, null), mk(7, null), mk(null, 1), mk(10, null), mk(null, null)] };
const D = (a, b) => Sim.kinDegree(st, a, b);
check(D(2, 3) === 2, 'full siblings are degree 2'); check(D(5, 7) === 4, 'first cousins are degree 4');
check(D(2, 11) === 2 && D(3, 11) === 2, 'half-siblings are degree 2 (11 shares mother 1)');
check(D(3, 5) === 3 && D(5, 3) === 3, 'uncle and niece are degree 3');
check(D(8, 7) === 5, 'first cousins once removed are degree 5 (child of 5 and 7)');
check(D(9, 7) === 6, 'second cousins are degree 6'); check(D(12, 9) === 8, 'third cousins are degree 8 (through 7 and 9 line)');
check(D(0, 5) === 0 && D(5, 0) === 0 && D(9, 0) === 0, 'a direct line is degree 0'); check(D(13, 5) === Infinity, 'no common ancestor means no limit');
const opts = C.DIMS[C.IDX.kinLimit].opts.map((o) => o[0]);
check(opts.join() === 'second,first,close,uncle', 'kinLimit options are second, first, close, uncle');
for (const o of opts) {
  const cu = { kinLimit: o }, ok = (a, b) => VB['sim/lifecycle'].kinOk(st, a, b, cu);
  check(!ok(2, 3) && !ok(2, 11) && !ok(0, 5) && !ok(5, 0), `${o}: siblings, half-siblings and direct lines never marry`);
  check(ok(3, 5) === (rules.MARRIAGE.kinDegree[o] <= 3), `${o}: uncle-niece`); check(ok(5, 7) === (rules.MARRIAGE.kinDegree[o] <= 4), `${o}: first cousins`);
  check(ok(8, 7) === (rules.MARRIAGE.kinDegree[o] <= 5), `${o}: first cousins once removed`); check(ok(13, 5), `${o}: unrelated`);
}
const world = (seed) => { const it = G.generate(seed); let r; while (!(r = it.next()).done); return r.value; };
const w = world(7), k = C.IDX.kinLimit, off = C.OFF[k];
// scarcity: with the strictest custom, kin-blocked adults pull towards the next looser option; the meeting log counts them
{
  const s = Sim.seed(w, 7, 'heirs'); s.naturalDeaths = false;
  for (const set of s.cenv.settlements) set.practice[k] = 0;
  const everPushed = new Set(); // new cottages (VB-032) give adults homes, so count those pulled in any year, not only at the end
  for (let y = 0; y < 8; y++) { Sim.advance(s, Sim.YEAR); for (const p of s.pawns) if (p.alive && p.kinPush) everPushed.add(p.id); }
  const pushed = s.pawns.filter((p) => p.alive && p.kinPush);
  console.log('strictest custom: adults pulled', pushed.length, 'log:', s.meetingLog.filter((e) => /only because of kin/.test(e.text)).length);
  check(everPushed.size > 0, 'some adults are pulled'); check(pushed.every((p) => [rules.MARRIAGE.scarcePush, rules.MARRIAGE.plentyPush].includes(p.kinPush.w)), 'pull weights');
  check(s.meetingLog.some((e) => /only because of kin/.test(e.text)), 'the meeting log counts adults blocked only by kin');
}
// the pulls move attitudes: a population pulled to a looser option drifts towards it faster than an unpulled one
const drift = (push, opt = 'uncle') => {
  const s = Sim.seed(w, 7, 'heirs'); s.naturalDeaths = false;
  for (const p of s.pawns) if (p.alive && p.age >= 16) p.kinPush = push;
  Sim.refreshInterests(s);
  const pulled = s.pawns.filter((p) => p.alive && p.interest);
  for (let d = 0; d < 4 * Sim.YEAR_DAYS; d++) C.dailyStep(s.cenv, 1 / Sim.YEAR_DAYS, s.rand);
  const mean = (opt) => pulled.reduce((a, p) => a + p.att[off + opts.indexOf(opt)], 0) / pulled.length;
  return mean(opt);
};
const none = drift(null), loose = drift({ to: 'uncle', w: rules.MARRIAGE.scarcePush });
const noneS = drift(null, 'second'), strict = drift({ to: 'second', w: rules.MARRIAGE.plentyPush }, 'second');
console.log('mean support for uncle', none.toFixed(3), '->', loose.toFixed(3), '| for second', noneS.toFixed(3), '->', strict.toFixed(3));
check(loose > none * 1.1, 'scarcity pull raises support for the looser option'); check(strict > noneS, 'plenty pull raises support for the stricter option');
if (failed) process.exit(1);
console.log('kinship ok');
