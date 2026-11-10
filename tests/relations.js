// Relationships (sim/relations): compatibility, opinion derived from standing, affinity (compatibility shown as a tie grows) and timed
// memories within their caps (VB-240), close friend and enemy bands told once and checked again each season, memories that fade and are
// forgotten (once a season), and death ending relationships.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, R = VB['sim/relations'], { SOCIAL, YEAR_DAYS, SEASON_DAYS, DAY } = VB['sim/rules'];
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('RELATIONS FAIL:', m); } };
const it = G.generate(7, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done);
const st = Sim.seed(r.value, 7, 'heirs'); st.naturalDeaths = false;

// compatibility: symmetric, fixed, within -1..1, about 0 on average
const ids = st.pawns.filter((p) => p.alive).map((p) => p.id);
let sum = 0, n = 0;
for (const a of ids) for (const b of ids) if (a < b) {
  const c = R.compat(st, a, b); sum += c; n++;
  check(c >= -1 && c <= 1, `compat(${a}, ${b}) = ${c}`);
  check(c === R.compat(st, b, a) && c === R.compat(st, a, b), `compat(${a}, ${b}) not symmetric or not fixed`);
}
check(Math.abs(sum / n) < 0.25, `mean compatibility ${(sum / n).toFixed(2)} over ${n} pairs`);

// two adults of different households with no kin between them
const adults = st.pawns.filter((p) => p.alive && p.age >= 18);
let a = null, b = null;
for (const x of adults) for (const y of adults) if (!a && x.household !== y.household && R.standing(st, x.id, y.id) === null) { a = x; b = y; }
check(a && b, 'two unrelated adults of different households');
check(R.opinionOf(st, a.id, b.id) === 0 && !a.rel.has(b.id), 'strangers start at opinion 0 with no record');

// affinity: the pair's compatibility, shown in full once a's tie to b reaches SOCIAL.affinity.known (VB-240)
const K = SOCIAL.memories, AF = SOCIAL.affinity, told = (p, kind) => Sim.recordOf(st, { pawn: p.id, life: true }).filter((e) => e.kind === kind).length;
const cab = R.compat(st, a.id, b.id);
R.addTie(st, a.id, b.id, AF.known / 2);
check(Math.abs(R.opinionOf(st, a.id, b.id) - AF.weight * cab / 2) < 1e-9, `half known: ${R.opinionOf(st, a.id, b.id)}, compat ${cab}`);
R.addTie(st, a.id, b.id, AF.known);
check(Math.abs(R.opinionOf(st, a.id, b.id) - AF.weight * cab) < 1e-9, `known well, the whole affinity: ${R.opinionOf(st, a.id, b.id)}`);
check(R.opinionOf(st, b.id, a.id) === 0 && !a.rel.has(b.id), 'opinion has a direction: b does not know a; a tie makes no record');
// a compatible stranger met at work: close friends once known well enough, told once
const unrelated = (x) => x.alive && x !== a && x !== b && x.household !== a.household && R.standing(st, a.id, x.id) === null;
const cf = adults.find((x) => unrelated(x) && R.compat(st, a.id, x.id) > SOCIAL.closeFriend / AF.weight + 0.02);
check(cf, 'a stranger compatible enough to be a close friend');
for (let k = 0; k < 2 * AF.known / SOCIAL.ties.work; k++) R.workedTogether(st, [a.id, cf.id]);
check(told(a, 'closeFriend') === 1 && a.bands.get(cf.id) === 1, `became close friends told ${told(a, 'closeFriend')} times`);
check(R.opinionWord(R.opinionOf(st, a.id, cf.id)) === 'close friend', `word ${R.opinionWord(R.opinionOf(st, a.id, cf.id))}`);
// with nothing touching the pair, the tie fades; the season's pass checks the band again, and leaving it is no news
a.tieT -= 3 * YEAR_DAYS * DAY; R.fadeRelations(st);
check(!a.bands.has(cf.id) && told(a, 'closeFriend') === 1, `left close friendship at ${R.opinionOf(st, a.id, cf.id)}`);
a.tieT += 3 * YEAR_DAYS * DAY;
// memories of things that happened, each within its cap; enough of them make an enemy, told once
const c = adults.find((x) => unrelated(x) && x !== cf);
for (let k = 0; k < 5; k++) { R.remember(st, a.id, c.id, 'claim'); R.remember(st, a.id, c.id, 'refusedMatch'); }
check(Math.abs(a.rel.get(c.id).mem.claim.v - K.claim.cap) < 1e-9, `claims capped at ${K.claim.cap}: ${a.rel.get(c.id).mem.claim.v}`);
const o = R.opinionOf(st, a.id, c.id), aff = AF.weight * R.compat(st, a.id, c.id) * Math.min(1, R.tieOf(st, a.id, c.id) / AF.known);
check(Math.abs(o - Math.max(-1, K.claim.cap + K.refusedMatch.cap + aff)) < 1e-9, `opinion ${o}, wanted the sum of both caps and affinity ${aff}`);
check(told(a, 'enemy') === 1 && a.bands.get(c.id) === -1, `became the enemy told ${told(a, 'enemy')} times, band ${a.bands.get(c.id)}`);
check(R.opinionWord(o) === 'enemy', `word ${R.opinionWord(o)}`);
check(R.reasonsOf(st, a.id, c.id).slice(0, 2).map((x) => x.label).join() === 'Took our claim,Refused the match I made', 'reasons, largest first');

// standing: kin and housemates start above 0
const hh = st.households.find((h) => !h.dissolved && h.members.length >= 3), [h0, h1] = hh.members;
check(R.opinionOf(st, h0, h1) > 0 && R.standing(st, h0, h1) !== null, `housemates ${h0}, ${h1}: ${R.standing(st, h0, h1)}`);

// memories fade linearly and are forgotten once gone
const half = R.memNow(st, 'claim', { v: -0.4, t: st.t - K.claim.days * DAY / 2 });
check(Math.abs(half + 0.2) < 1e-9, `half-way through, a memory is at half: ${half}`);
R.remember(st, a.id, b.id, 'bull');
Sim.advance(st, (K.bull.days + 1) * DAY); R.fadeRelations(st);
check(!a.rel.has(b.id), 'a record with no memories left is dropped');
check(checkState(st).length === 0, 'invariants: ' + checkState(st).slice(0, 3).join('; '));

// death ends the relationships of others with the dead
R.remember(st, a.id, b.id, 'bull'); R.remember(st, b.id, a.id, 'bull'); b.bands.set(a.id, 1); a.bands.set(b.id, 1);
Sim.killPawn(st, b.id, 'killed');
check(!a.rel.has(b.id) && b.rel.size === 0 && !a.bands.has(b.id) && b.bands.size === 0, 'death ends relationships');
check(checkState(st).length === 0, 'invariants after a death: ' + checkState(st).slice(0, 3).join('; '));
// talk (VB-061): two pawns standing together outdoors in waking hours talk, and their tie grows by SOCIAL.ties.talk; it leaves no memory
const S = VB['sim/society'], T = SOCIAL.talk, TIES = SOCIAL.ties, pair = adults.filter((x) => x.alive && x !== b && x !== c).slice(0, 2), [ta, tb] = pair.map((x) => st.agents[x.id]);
const stand = () => { for (const [g, dx] of [[ta, 0], [tb, 4]]) { VB['sim/agents'].release(st, g); g.inside = false; g.path = null; g.phase = null; g.carry = null; g.x = 5000 + dx; g.y = 5000; } };
const tie0 = R.tieOf(st, pair[0].id, pair[1].id), talks0 = st.talks;
for (const ag of st.agents) if (ag !== ta && ag !== tb) ag.inside = true; // nobody else outdoors
let hours = 0;
ta.talk = null;
while (!(ta.talk && ta.talk.with === pair[1].id) && hours < 40) { stand(); R.talkHour(st, 10, S.outdoors(st)); hours++; }
check(st.talks > talks0 && ta.talk, `no talk in ${hours} hours together`);
check(!pair[0].rel.has(pair[1].id) && !pair[1].rel.has(pair[0].id), 'a talk leaves no memory (VB-240)');
check(['chat', 'goodTalk', 'crossWords'].includes(ta.talk.kind) && ta.talk.kind === tb.talk.kind, `the bubble's kind: ${ta.talk.kind}`);
const grew = (R.tieOf(st, pair[0].id, pair[1].id) - tie0) / TIES.talk; // housemates indoors talk too, so count the pair's talks by its tie
check(grew >= 1 - 1e-9 && Math.abs(grew - Math.round(grew)) < 1e-9, `the tie grew by ${grew} talks' worth`);
check(ta.talk && ta.talk.with === pair[1].id && tb.talk.with === pair[0].id && ta.talk.until - ta.talk.at === T.bubbleHours, 'the bubble names the other');
const before = st.talks; stand(); R.talkHour(st, 23, S.outdoors(st)); stand(); R.talkHour(st, 3, S.outdoors(st));
check(st.talks === before, 'no talk at night');
// in a busy hour each pawn is in one talk at most
for (const ag of st.agents) { ag.talk = null; if (st.pawns[ag.id].alive) { ag.inside = false; ag.path = null; ag.carry = null; ag.x = 6000 + (ag.id % 5) * 6; ag.y = 6000; } }
const t1 = st.talks; R.talkHour(st, 10, S.outdoors(st));
const talking = st.agents.filter((ag) => ag.talk).length;
check(st.talks > t1 && talking === 2 * (st.talks - t1), `${st.talks - t1} talks, ${talking} pawns talking`);
check(checkState(st).length === 0, 'invariants after talk: ' + checkState(st).slice(0, 3).join('; '));

// company: an idle pawn joins someone it likes who idles in its village, never someone it dislikes
const A = VB['sim/agents'], seek0 = SOCIAL.seek, vill = (p) => Sim.settlementIdOf(st, p);
SOCIAL.seek = 1;
const [x, fr, foe] = (() => {
  for (const p of adults) {
    if (!p.alive) continue;
    const same = adults.filter((q) => q.alive && q !== p && vill(q) === vill(p) && R.standing(st, p.id, q.id) === null);
    const liked = same.find((q) => R.compat(st, p.id, q.id) > 0.2), other = same.find((q) => q !== liked);
    if (liked && other) return [p, liked, other];
  }
  return [];
})();
check(x && fr && foe, 'three unrelated adults of one village');
R.addTie(st, x.id, fr.id, AF.known);
for (let k = 0; k < 5; k++) { R.remember(st, x.id, foe.id, 'claim'); R.remember(st, x.id, foe.id, 'refusedMatch'); }
const home = st.farmsteads[st.households[x.household].farmstead].house, hx = st.w.hx[home], hy = st.w.hy[home];
for (const ag of st.agents) { ag.inside = true; ag.talk = null; }
const idleAt = (p, dx) => { const g = st.agents[p.id]; VB['sim/agents'].release(st, g); g.inside = false; g.phase = null; g.path = null; g.x = hx + dx; g.y = hy; };
idleAt(fr, 40); st.idlers = null; // the hour's idlers are a cache (sim/relations): the test placed them by hand
const ax = st.agents[x.id];
VB['sim/jobs'].idleAbout(st, ax); // the planner's idle choice (VB-168)
const end = ax.path[ax.path.length - 1];
check(Math.abs(end[0] - (hx + 40)) <= 8 && Math.abs(end[1] - hy) <= 4, `walks to the friend: ends at ${end.slice(0, 2).map(Math.round)}, friend at ${hx + 40},${hy}`);
st.agents[fr.id].inside = true; idleAt(foe, 40); st.idlers = null;
check(R.companyFor(st, ax) === null, 'never joins someone it dislikes');
SOCIAL.seek = seek0;

// familiarity (VB-127): stored on the pawn's own decay scale, read as halving every year; put back on today's scale without change
const TS = SOCIAL.ties, YEAR = YEAR_DAYS * DAY, [f0, f1] = adults.filter((p) => p.alive && p.id !== x.id).map((p) => p.id);
const fp = st.pawns[f0], tieT0 = fp.tieT;
fp.ties.delete(f1); R.raiseTie(st, f0, f1, 3);
check(Math.abs(R.tieOf(st, f0, f1) - 3) < 1e-9, `a raised tie reads 3: ${R.tieOf(st, f0, f1)}`);
fp.tieT -= YEAR; // as if the scale had started a year earlier: the same stored weight is a year older
check(Math.abs(R.tieOf(st, f0, f1) - 1.5) < 1e-9, `a year on, it reads half: ${R.tieOf(st, f0, f1)}`);
R.addTie(st, f0, f1, TS.talk);
check(Math.abs(R.tieOf(st, f0, f1) - 1.5 - TS.talk) < 1e-9, `a talk adds ${TS.talk} as of now: ${R.tieOf(st, f0, f1)}`);
const atDay = [...fp.ties.keys()].map((j) => [j, R.tieOf(st, f0, j)]);
R.renormalise(st, fp);
check(fp.tieT === st.t && tieT0 <= st.t, `renormalised: tieT ${fp.tieT}, now ${st.t}`);
check(atDay.every(([j, v]) => (fp.ties.has(j) ? Math.abs(R.tieOf(st, f0, j) - v) < 1e-9 * Math.max(1, v) : v < TS.forget)),
  'renormalising keeps every tie as it was, and drops those under TIES.forget');
R.dailyTies(st);
// the kin floor, once a season: raised with a season's fading to spare, kin are still at the floor at the pawn's next turn
const kin0 = VB['sim/records'].kinNear(st, f0).filter((q) => st.pawns[q].alive);
check(kin0.length > 0, 'a pawn with living near kin');
for (const q of kin0) { fp.ties.delete(q); R.floorKin(st, f0, q); }
fp.tieT -= SEASON_DAYS * DAY - 1e-6; // a season on, less a moment
for (const q of kin0) check(R.tieOf(st, f0, q) >= TS.kin - 1e-9, `kin ${q} at ${R.tieOf(st, f0, q)} a season after the floor`);
fp.tieT += SEASON_DAYS * DAY - 1e-6;
// waking hours at home: two housemates both inside for every talk hour grow by TIES.home over the day
const hm = st.households.find((h) => !h.dissolved && h.members.length >= 2 && h.members.every((m) => st.pawns[m].alive));
const [m0, m1] = hm.members, home0 = R.tieOf(st, m0, m1);
for (const id of st.living) st.pawns[id].homeHours = 0;
for (const ag of st.agents) { ag.inside = st.pawns[ag.id].household === hm.id; ag.talk = null; }
const talks1 = st.talks;
for (let h = 0; h < DAY; h++) { for (const ag of st.agents) ag.inside = st.pawns[ag.id].household === hm.id; R.talkHour(st, h, S.outdoors(st)); }
check(st.pawns[m0].homeHours === T.to - T.from, `the talk hours counted at home: ${st.pawns[m0].homeHours}`);
const talked = R.tieOf(st, m0, m1) - home0;
R.dailyTies(st);
const homeGain = R.tieOf(st, m0, m1) - home0 - talked;
check(Math.abs(homeGain - TS.home * (T.to - T.from) / DAY) < 1e-6, `a day at home adds ${homeGain}`);
check(st.pawns[m0].homeHours === 0, 'the hours start again at midnight');
check(st.talks >= talks1, 'housemates talk at home');
// a job finished together
const job0 = R.tieOf(st, m0, m1); R.workedTogether(st, [m0, m1]);
check(Math.abs(R.tieOf(st, m0, m1) - job0 - TS.work) < 1e-9 && R.tieOf(st, m1, m0) > 0, 'a job finished together adds TIES.work');
// the cap: at most TIES.cap ties; a new tie stronger than the weakest replaces it, a weaker one is not kept, kin always are
const cp = st.pawns[f0], others = st.pawns.filter((p) => p.alive && p.id !== f0 && !VB['sim/records'].kinNear(st, f0).includes(p.id));
const fake = [];
for (const [j, w] of cp.ties) cp.ties.set(j, w + 2); // all real ties above the fakes
for (let k = 0; cp.ties.size < TS.cap; k++) { const id = 100000 + k; fake.push(id); cp.ties.set(id, 1 + k * 1e-3); } // ids beyond the pawns, removed below
const weakest = fake.length ? fake[0] : null, newcomer = others.find((p) => !cp.ties.has(p.id));
if (weakest !== null && newcomer) {
  R.addTie(st, f0, newcomer.id, 0.1);
  check(!cp.ties.has(newcomer.id) && cp.ties.size === TS.cap, 'a tie weaker than the weakest is not kept at the cap');
  R.addTie(st, f0, newcomer.id, 5);
  check(cp.ties.has(newcomer.id) && !cp.ties.has(weakest) && cp.ties.size === TS.cap, 'a stronger tie replaces the weakest at the cap');
}
for (const id of fake) cp.ties.delete(id);
check(checkState(st).length === 0, 'invariants after familiarity: ' + checkState(st).slice(0, 3).join('; '));
if (failed) process.exitCode = 1; else console.log(`relations ok: ${n} pairs, mean compatibility ${(sum / n).toFixed(2)}; ${st.talks - t1} talks in one crowded hour`);
