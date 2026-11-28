// @suite integration
// Encounters and the talk round by turns (VB-521; design.md, Where pawns meet), on a small constructed state: a pawn starts a talk only at
// its turn and is in one talk an hour at most; two guests in a host's house at an occasion can talk (housemates only, without it); two
// herders 100 units apart can, at 150 they cannot; an occasion's mix lets a pawn be drawn whom familiarity and liking alone would not;
// present and said read those who came.
const VB = require('../src/load.js'), R = VB['sim/relations'], E = VB['sim/encounters'], A = VB['sim/agents'];
const { SOCIAL } = VB['sim/ties'], T = SOCIAL.talk;
const { state } = require('./lib/probe.js');
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('ENCOUNTERS FAIL:', m); } };
const st = state();
st.naturalDeaths = false;
const ag = st.agents, turnOf = (id, h) => (h + id) % T.every === 0;
// everyone at home indoors, but `out`, standing where it is put: free, not herding, at no occasion
const place = (spots) => {
  for (const id of st.living) { const g = ag[id]; g.inside = true; g.talk = null; g.occasion = null; }
  for (const [id, x, y, inside = false] of spots) {
    const g = ag[id];
    A.release(st, g);
    A.standStill(st, g);
    delete g.mind;
    Object.assign(g, { inside, carry: null, x, y, occasion: null });
  }
};
const adults = st.living.filter((id) => st.pawns[id].age >= 16);
// two adults of different households, of different turns, with no bond between them
let a = null, b = null;
for (const x of adults) for (const y of adults)
  if (a === null && st.pawns[x].household !== st.pawns[y].household && x % T.every !== y % T.every && R.bond(st, x, y) === null) { a = x; b = y; }
check(a !== null, 'two unrelated adults of different households and turns');
const lone = (id) => st.pawns[id].household; // their housemates stay inside at home: nobody else can reach them

// 1. Turns: alone together outdoors, the pair talks in the hours of either's turn, never in another hour; each talk is one an hour
for (let h = T.from; h < T.to; h++) {
  place([[a, 500, 500], [b, 504, 500]]);
  const t0 = st.talks, asked = VB.count.talkTurn;
  R.talkHour(st, h, E.outdoors(st, VB['sim/pose'].placeOf));
  const turn = st.living.filter((id) => turnOf(id, h)).length;
  check(VB.count.talkTurn - asked === turn, `hour ${h}: ${VB.count.talkTurn - asked} asked, ${turn} at their turn`);
  const talked = ag[a].talk !== null && ag[a].talk.with === b;
  check(talked === (turnOf(a, h) || turnOf(b, h)), `hour ${h}: the pair ${talked ? 'talked' : 'did not talk'} (turns ${turnOf(a, h)}, ${turnOf(b, h)})`);
  const talking = st.living.filter((id) => ag[id].talk).length;
  check(talking === 2 * (st.talks - t0), `hour ${h}: ${st.talks - t0} talks, ${talking} pawns talking`);
}
const hourOf = (id) => { for (let h = T.from; h < T.to; h++) if (turnOf(id, h)) return h; };

// 2. An occasion in a host's house: two guests of other households inside it can talk; without the occasion they cannot
const hostHh = st.households.find((h) => !h.dissolved && h.id !== lone(a) && h.id !== lone(b));
const host = st.farmsteads[hostHh.farmstead], hx = st.w.hx[host.house], hy = st.w.hy[host.house];
const occ = (come, kind = 'wedding') => {
  const o = { id: st.occasionSeq++, kind, for: [], village: host.village, farm: host.id, tile: host.house, x: hx, y: hy,
    start: st.t, end: st.t + 5, overrides: false, asked: [], come, due: st.t + 5 };
  st.occasions.push(o);
  for (const id of come) ag[id].occasion = o.id;
  return o;
};
const end = (o) => { st.occasions.splice(st.occasions.indexOf(o), 1); for (const id of o.come) ag[id].occasion = null; };
const h = hourOf(a);
place([[a, hx, hy, true], [b, hx + 2, hy, true]]);
R.talkHour(st, h, E.outdoors(st, VB['sim/pose'].placeOf));
check(!(ag[a].talk && ag[a].talk.with === b), 'two guests inside without an occasion do not talk: only housemates do indoors');
place([[a, hx, hy, true], [b, hx + 2, hy, true]]);
let o = occ([a, b]);
check(E.present(st, o.id).join() === [a, b].join(), `present: ${E.present(st, o.id)}`);
check(E.said(st, o.id, a).join() === String(b), `said by ${a} is heard by ${E.said(st, o.id, a)}`);
ag[b].path = [[0, 0]]; // still walking there: not present
check(E.present(st, o.id).join() === String(a), 'one still on its way is not present');
ag[b].path = null;
R.talkHour(st, h, E.outdoors(st, VB['sim/pose'].placeOf));
check(ag[a].talk !== null && ag[a].talk.with === b, 'two guests in the host\'s house at an occasion talk');
end(o);
check(E.present(st, o.id).length === 0, 'an occasion over has nobody present');

// 3. Herders: two at their herds 100 units apart talk, at calling distance; at 150 they do not; two pawns not herding at 100 do not
const herd = (id) => { ag[id].mind = [{ kind: 'herd', key: 'probe' }]; };
for (const [dx, herding, can] of [[100, true, true], [150, true, false], [100, false, false]]) {
  let talked = false;
  for (let k = T.from; k < T.to && !talked; k++) {
    place([[a, 800, 800], [b, 800 + dx, 800]]);
    if (herding) { herd(a); herd(b); }
    R.talkHour(st, k, E.outdoors(st, VB['sim/pose'].placeOf));
    talked = ag[a].talk !== null && ag[a].talk.with === b;
  }
  check(talked === can, `${herding ? 'herders' : 'pawns'} ${dx} units apart ${talked ? 'talked' : 'did not talk'}`);
  delete ag[a].mind; delete ag[b].mind;
}

// 4. Mix: a pawn whose weight by familiarity and liking is nothing (a's opinion of b at -1) is not drawn outdoors, and is at an occasion
for (let k = 0; k < 3; k++) for (const m of ['claim', 'border', 'crop', 'stayedAway', 'refusedMatch']) R.remember(st, a, b, m);
check(R.opinionOf(st, a, b) === -1, `a's opinion of b ${R.opinionOf(st, a, b)}`);
const quiet = (id) => { if (turnOf(id, h)) for (const x of st.living) if (x !== a && x !== b) ag[x].inside = true; };
place([[a, 900, 900], [b, 902, 900]]);
const bTurn = turnOf(b, h);
check(!bTurn, 'b has no turn in a\'s hour');
quiet(a);
R.talkHour(st, h, E.outdoors(st, VB['sim/pose'].placeOf));
check(!(ag[a].talk && ag[a].talk.with === b), 'outdoors, a pawn at opinion -1 is never drawn (mix 0)');
place([[a, 900, 900], [b, 960, 900]]); // 60 units apart: beyond face to face, but both at the occasion
o = occ([a, b], 'funeral');
R.talkHour(st, h, E.outdoors(st, VB['sim/pose'].placeOf));
check(ag[a].talk !== null && ag[a].talk.with === b, 'at an occasion its mix lets the pair be drawn');
const mix0 = E.ENCOUNTERS.occasion.mix;
E.ENCOUNTERS.occasion.kinds.funeral = { mix: 0 };
place([[a, 900, 900], [b, 960, 900]]);
for (const id of o.come) ag[id].occasion = o.id;
R.talkHour(st, h, E.outdoors(st, VB['sim/pose'].placeOf));
check(!(ag[a].talk && ag[a].talk.with === b), 'a kind of occasion names its own mix (0 here)');
delete E.ENCOUNTERS.occasion.kinds.funeral;
check(E.ENCOUNTERS.occasion.mix === mix0, 'the default mix is kept');
end(o);
st.pawns[a].rel.delete(b);
st.pawns[a].bands.delete(b);
// 5. (VB-561) Indoors at another house is not at home: a pawn waiting inside a farm not its own is drawn by none of its housemates and
// draws none; the same pawn by its own door is, and counts its hours at home
{
  const hh = st.households.find((x) => !x.dissolved && x.members.length >= 2 && x.id !== hostHh.id);
  const [m1, m2] = hh.members;
  const own = st.farmsteads[hh.farmstead], ox = st.w.hx[own.house] - 12, oy = st.w.hy[own.house] + 14;
  const reset = () => { for (const id of st.living) { ag[id].talk = null; ag[id].occasion = null; } };
  const found = [], busy = new Int32Array(st.agents.length + 8);
  const near = E.outdoors(st, VB['sim/pose'].placeOf);
  place([]); reset();
  ag[m1].x = ox; ag[m1].y = oy; ag[m2].x = ox; ag[m2].y = oy;
  check(E.atHome(st, ag[m1]), 'indoors by its own door is at home');
  E.partners(st, ag[m1], near, busy, 1, found);
  check(found.some((g) => g.id === m2), 'at home, a pawn draws its housemate at home');
  ag[m2].x = hx; ag[m2].y = hy; // m2 waits indoors at the other farm
  check(ag[m2].inside && !E.atHome(st, ag[m2]), 'indoors at another farm is not at home');
  E.partners(st, ag[m1], near, busy, 2, found);
  check(!found.some((g) => g.id === m2), 'its housemates at home do not draw a pawn indoors elsewhere');
  E.partners(st, ag[m2], near, busy, 3, found);
  check(found.length === 0, 'a pawn indoors elsewhere draws none');
  const h = hourOf(m2), before = st.pawns[m2].homeHours, b1 = st.pawns[m1].homeHours;
  R.talkHour(st, h, E.outdoors(st, VB['sim/pose'].placeOf));
  check(st.pawns[m2].homeHours === before, 'its turn adds no hours at home');
  if (turnOf(m1, h)) check(st.pawns[m1].homeHours === b1 + T.every, 'a pawn at home counts its turn');
  for (const id of st.living) st.pawns[id].homeHours = 0;
}

for (const id of st.living) st.pawns[id].homeHours = 0; // the hours above were walked more than once
check(checkState(st).length === 0, 'invariants: ' + checkState(st).slice(0, 3).join('; '));

if (failed) process.exit(1);
console.log(`encounters ok: turns every ${T.every} hours; the house, the occasion, the pasture (${E.ENCOUNTERS.pasture.reach} units) and the mix`);
