// Relationships (sim/relations): compatibility, timed memories within their caps, opinion, friend and dislike bands told once,
// memories that fade and are forgotten (once a season), and death ending relationships.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, R = VB['sim/relations'], { SOCIAL, YEAR_DAYS, DAY } = VB['sim/rules'];
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

// good talks raise opinion up to the memory's cap, and becoming friends is told once
const K = SOCIAL.memories;
for (let k = 0; k < 20; k++) R.remember(st, a.id, b.id, 'goodTalk');
check(Math.abs(a.rel.get(b.id).mem.goodTalk.v - K.goodTalk.cap) < 1e-9, `good talks capped at ${K.goodTalk.cap}: ${a.rel.get(b.id).mem.goodTalk.v}`);
check(Math.abs(R.opinionOf(st, a.id, b.id) - K.goodTalk.cap) < 1e-9, 'opinion is the memory');
check(R.opinionOf(st, b.id, a.id) === 0, 'opinion has a direction: b remembers nothing');
const told = (p, kind) => p.events.filter((e) => e.kind === kind).length;
check(told(a, 'friend') === 1 && a.rel.get(b.id).band === 1, `became friends told ${told(a, 'friend')} times`);
check(R.opinionWord(R.opinionOf(st, a.id, b.id)) === 'friend', `word ${R.opinionWord(R.opinionOf(st, a.id, b.id))}`);

// cross words pull it down to the sum of both caps: no longer friends, which is not news
for (let k = 0; k < 20; k++) R.remember(st, a.id, b.id, 'crossWords');
const o = R.opinionOf(st, a.id, b.id);
check(Math.abs(o - (K.goodTalk.cap + K.crossWords.cap)) < 1e-9, `opinion ${o}, wanted the sum of both caps`);
check(a.rel.get(b.id).band === 0 && told(a, 'fellOut') === 0, `band ${a.rel.get(b.id).band} after leaving friendship`);
check(R.reasonsOf(st, a.id, b.id).map((x) => x.label).join() === 'Cross words,A good talk', 'reasons, largest first');
// with nothing good to remember, cross words make a pair fall out, told once
const c = adults.find((x) => x !== a && x !== b && x.household !== a.household && R.standing(st, a.id, x.id) === null);
for (let k = 0; k < 20; k++) R.remember(st, a.id, c.id, 'crossWords');
check(told(a, 'fellOut') === 1 && a.rel.get(c.id).band === -1, `fell out told ${told(a, 'fellOut')} times, band ${a.rel.get(c.id).band}`);
check(R.opinionWord(R.opinionOf(st, a.id, c.id)) === 'enemy', `word ${R.opinionWord(R.opinionOf(st, a.id, c.id))}`);

// standing: kin and housemates start above 0
const hh = st.households.find((h) => !h.dissolved && h.members.length >= 3), [h0, h1] = hh.members;
check(R.opinionOf(st, h0, h1) > 0 && R.standing(st, h0, h1) !== null, `housemates ${h0}, ${h1}: ${R.standing(st, h0, h1)}`);

// memories fade linearly and are forgotten once gone
const half = R.memNow(st, 'crossWords', { v: -0.6, t: st.t - K.crossWords.days * DAY / 2 });
check(Math.abs(half + 0.3) < 1e-9, `half-way through, a memory is at half: ${half}`);
R.remember(st, a.id, b.id, 'chat');
Sim.advance(st, (K.chat.days + 1) * DAY); R.fadeRelations(st);
check(!('chat' in a.rel.get(b.id).mem), 'a chat is forgotten after its days');
Sim.advance(st, (K.goodTalk.days - K.chat.days) * DAY); R.fadeRelations(st);
check(!a.rel.has(b.id), 'a record with no memories left is dropped');
check(checkState(st).length === 0, 'invariants: ' + checkState(st).slice(0, 3).join('; '));

// death ends the relationships of others with the dead
R.remember(st, a.id, b.id, 'goodTalk'); R.remember(st, b.id, a.id, 'goodTalk');
Sim.killPawn(st, b.id, 'killed');
check(!a.rel.has(b.id) && b.rel.size === 0, 'death ends relationships');
check(checkState(st).length === 0, 'invariants after a death: ' + checkState(st).slice(0, 3).join('; '));
// talk (VB-061): two pawns standing together outdoors in waking hours talk, both remember it, and their tie grows by SOCIAL.talk.tie
const S = VB['sim/society'], T = SOCIAL.talk, pair = adults.filter((x) => x.alive && x !== b && x !== c).slice(0, 2), [ta, tb] = pair.map((x) => st.agents[x.id]);
const stand = () => { for (const [g, dx] of [[ta, 0], [tb, 4]]) { g.inside = false; g.path = null; g.job = null; g.phase = null; g.carry = null; g.x = 5000 + dx; g.y = 5000; } };
const tie0 = pair[0].ties.get(pair[1].id) || 0, talks0 = st.talks;
for (const ag of st.agents) if (ag !== ta && ag !== tb) ag.inside = true; // nobody else outdoors
let hours = 0;
while (st.talks === talks0 && hours < 20) { stand(); S.noteContacts(st); R.talkHour(st, 10, S.noteContacts(st)); hours++; }
check(st.talks > talks0, `no talk in ${hours} hours together`);
check(pair[0].rel.has(pair[1].id) && pair[1].rel.has(pair[0].id), 'both remember the talk');
const grew = ((pair[0].ties.get(pair[1].id) || 0) - tie0) / T.tie; // housemates indoors talk too, so count the pair's talks by its tie
check(grew >= 1 - 1e-9 && Math.abs(grew - Math.round(grew)) < 1e-9, `the tie grew by ${grew} talks' worth`);
check(ta.talk && ta.talk.with === pair[1].id && tb.talk.with === pair[0].id && ta.talk.until - ta.talk.at === T.bubbleHours, 'the bubble names the other');
const before = st.talks; stand(); R.talkHour(st, 23, S.noteContacts(st)); stand(); R.talkHour(st, 3, S.noteContacts(st));
check(st.talks === before, 'no talk at night');
// in a busy hour each pawn is in one talk at most
for (const ag of st.agents) { ag.talk = null; if (st.pawns[ag.id].alive) { ag.inside = false; ag.path = null; ag.carry = null; ag.x = 6000 + (ag.id % 5) * 6; ag.y = 6000; } }
const t1 = st.talks; R.talkHour(st, 10, S.noteContacts(st));
const talking = st.agents.filter((ag) => ag.talk).length;
check(st.talks > t1 && talking === 2 * (st.talks - t1), `${st.talks - t1} talks, ${talking} pawns talking`);
check(checkState(st).length === 0, 'invariants after talk: ' + checkState(st).slice(0, 3).join('; '));
if (failed) process.exitCode = 1; else console.log(`relations ok: ${n} pairs, mean compatibility ${(sum / n).toFixed(2)}; ${st.talks - t1} talks in one crowded hour`);
