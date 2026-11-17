// Marriage limit by civil degree (VB-029): degrees on a constructed pedigree, who may never marry, and the scarcity and plenty pulls on kinLimit.
const VB = require('../src/load.js'), Sim = VB.sim, C = VB.culture, rules = VB['sim/rules'];
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
  const cu = { kinLimit: o }, ok = (a, b) => VB['sim/matching'].kinOk(st, a, b, cu);
  check(!ok(2, 3) && !ok(2, 11) && !ok(0, 5) && !ok(5, 0), `${o}: siblings, half-siblings and direct lines never marry`);
  check(ok(3, 5) === (rules.MARRIAGE.kinDegree[o] <= 3), `${o}: uncle-niece`); check(ok(5, 7) === (rules.MARRIAGE.kinDegree[o] <= 4), `${o}: first cousins`);
  check(ok(8, 7) === (rules.MARRIAGE.kinDegree[o] <= 5), `${o}: first cousins once removed`); check(ok(13, 5), `${o}: unrelated`);
}
// On the small heirs island (VB-854): the scarcity and plenty pushes at one moving round, on a pedigree laid over the scenario's people,
// where the long run waited eight years of heirs for kin to block a match.
const { scenario } = require('./lib/probe.js'), Rec = VB['sim/records'];
const k = C.IDX.kinLimit, off = C.OFF[k];
const round = (opt, kin) => {
  const s = scenario('heirs'); s.naturalDeaths = false;
  for (const set of s.cenv.settlements) set.practice[k] = opts.indexOf(opt);
  for (const h of s.households) h.grain.barley += 5000; // the means to marry (VB-153)
  // kin 'cousins': every single man a son of A, every single woman a daughter of B, A and B brother and sister, so that each match is of
  // first cousins; 'strangers': the single have no parents on record, so that no match is of kin
  const single = s.pawns.filter((p) => p.alive && p.age >= 16 && Rec.spouseOf(s, p.id) === null), [G, A, B] = s.pawns.filter((p) => !single.includes(p));
  G.father = G.mother = null; A.father = B.father = G.id; A.mother = B.mother = null;
  for (const p of single) { p.father = kin === 'strangers' ? null : p.sex === 'm' ? A.id : B.id; p.mother = null; }
  const u0 = s.unions.length;
  Sim.movingRound(s);
  return { s, wed: s.unions.length - u0, pushed: s.pawns.filter((p) => p.alive && p.kinPush) };
};
{ // scarcity: under "first", first cousins may not marry; each single adult is pulled towards "close", and the meeting log counts them
  const { s, wed, pushed } = round('first', 'cousins');
  console.log('first cousins only, custom "first": adults pulled', pushed.length, 'log:', s.meetingLog.filter((e) => /only because of kin/.test(e.text)).length);
  check(wed === 0, 'no cousins marry under "first"');
  check(pushed.length > 0, 'some adults are pulled');
  check(pushed.every((p) => p.kinPush.to === 'close' && p.kinPush.w === rules.MARRIAGE.scarcePush), 'pulled towards the next looser option, by scarcePush');
  check(s.meetingLog.some((e) => /only because of kin/.test(e.text)), 'the meeting log counts adults blocked only by kin');
}
{ // under "close" the same cousins marry, and nobody is pulled looser
  const { wed, pushed } = round('close', 'cousins');
  check(wed > 0 && pushed.every((p) => p.kinPush.w !== rules.MARRIAGE.scarcePush), `cousins marry under "close" (${wed}), none pulled looser`);
}
{ // plenty: strangers married under "close", who would be allowed under "first" too, pull towards it, by plentyPush
  const { wed, pushed } = round('close', 'strangers');
  check(wed > 0 && pushed.length >= 2 && pushed.every((p) => p.kinPush.to === 'first' && p.kinPush.w === rules.MARRIAGE.plentyPush),
    `the married unrelated pull stricter (${wed} married, ${pushed.length} pulled)`);
}
// the pulls move attitudes: a population pulled to a looser option drifts towards it faster than an unpulled one
const drift = (push, opt = 'uncle') => {
  const s = scenario('heirs'); s.naturalDeaths = false;
  for (const p of s.pawns) if (p.alive && p.age >= 16) p.kinPush = push;
  Sim.refreshInterests(s);
  const pulled = s.pawns.filter((p) => p.alive && p.interest);
  for (let d = 0; d < 4 * Sim.YEAR_DAYS; d++) C.dailyStep(s.cenv, Sim.hooks(s), 1 / Sim.YEAR_DAYS, VB['sim/rng'].drawer(s.rng.culture));
  const mean = (opt) => pulled.reduce((a, p) => a + p.att[off + opts.indexOf(opt)], 0) / pulled.length;
  return mean(opt);
};
const none = drift(null), loose = drift({ to: 'uncle', w: rules.MARRIAGE.scarcePush });
const noneS = drift(null, 'second'), strict = drift({ to: 'second', w: rules.MARRIAGE.plentyPush }, 'second');
console.log('mean support for uncle', none.toFixed(3), '->', loose.toFixed(3), '| for second', noneS.toFixed(3), '->', strict.toFixed(3));
check(loose > none * 1.1, 'scarcity pull raises support for the looser option'); check(strict > noneS, 'plenty pull raises support for the stricter option');
if (failed) process.exit(1);
console.log('kinship ok');
