// Ale (VB-305; design.md, Goods, Ale and standing): brewed as a side craft from grain above the household's floor only (the floor holds the seed
// reserve), 10 rations of grain and 4 hours a barrel, which keeps one season; poured at a wedding or a funeral ale by the host household, a
// barrel to 20 guests, used up through sim/stores with the reason 'pour'; each guest remembers the host (SOCIAL.memories.ale) and the host's
// holder gains 0.05 prestige a barrel poured in the last 3 years, at most 0.2.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, S = VB['sim/stores'], K = VB['sim/kinds'], H = VB['sim/hunger'];
const { cal, BREW, DAY, YEAR, SEASON_DAYS } = VB['sim/rules'], { opinionOf, memNow } = VB['sim/relations'], Soc = VB['sim/society'];
const { checkState } = require('./lib/invariants.js');
const world = (seed) => { const it = G.generate(seed, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done); return r.value; };
const st = Sim.seed(world(7), 7, 'populous'); st.naturalDeaths = false;
const hh = st.households.find((h) => !h.dissolved && h.holder !== null), f = st.farmsteads[hh.farmstead];
const autumnT = (d) => SEASON_DAYS * 2 * DAY + d * DAY + 8, autumn = (d) => cal(autumnT(d)), jobs = (c) => { const out = []; K.KINDS.brew.available(st, hh, f, c, (key) => out.push(key)); return out; };

// 1. The rule: ale is wanted only from grain above the floor, in autumn and winter, and while the household holds no barrel.
const floor = H.floorOf(st, hh);
hh.grain = floor + BREW.grain - 0.5; assert.strictEqual(jobs(autumn(3)).length, 0, 'no brewing below the floor plus a barrel\'s grain');
hh.grain = floor + BREW.grain; assert.strictEqual(jobs(autumn(3)).length, 1, 'brewing from the surplus');
assert.strictEqual(jobs(cal(10 * DAY)).length, 0, 'not in spring') ; // spring day 10 (the plan\'s template leaves it out too)
assert.strictEqual(jobs(cal(SEASON_DAYS * DAY + 10 * DAY)).length, 0, 'not in summer');
// 2. The work, when done, re-checks the floor: grain taken is the surplus alone, never the seed reserve or the days of need.
hh.grain = floor + BREW.grain - 1; K.KINDS.brew.done(st, {}, hh); assert.strictEqual(S.aleOf(st, hh), 0, 'nothing brewed below the floor');
assert.strictEqual(hh.grain, floor + BREW.grain - 1);
st.t = autumnT(3); hh.grain = floor + BREW.grain; K.KINDS.brew.done(st, {}, hh);
assert.strictEqual(S.aleOf(st, hh), 1, 'a barrel'); assert.ok(Math.abs(hh.grain - floor) < 1e-9, 'it took the surplus only');
assert.ok(hh.grain >= floor, 'the household is left at its floor');
assert.strictEqual(jobs(autumn(3)).length, 0, 'no second barrel while one is held');
const e = hh.ledger.filter((x) => x.kind === 'brew'); assert.deepStrictEqual(e.map((x) => [x.good, x.n]), [['grain', -BREW.grain], ['ale', 1]], 'booked with its reason');
// 3. A barrel keeps one season, then is lost (booked as spoilage).
st.t += SEASON_DAYS * DAY - 1; S.spoilAle(st, hh); assert.strictEqual(S.aleOf(st, hh), 1, 'kept through the season');
st.t += 2; S.spoilAle(st, hh); assert.strictEqual(S.aleOf(st, hh), 0, 'lost after it'); assert.strictEqual(hh.ale.length, 0);
assert.strictEqual(S.yearSum(hh, 'spoilage', S.yearNow(st)) > 0 || hh.totals.some((x) => x.good === 'ale' && x.kind === 'spoilage'), true);
// 4. Pouring: a barrel to 20 guests, the oldest first, booked 'pour'; the host's standing counts the last 3 years, at most 0.2.
hh.grain += 1000; for (let i = 0; i < 6; i++) { st.t += 1; S.brew(st, hh); }
assert.strictEqual(S.aleOf(st, hh), 6); assert.strictEqual(S.pour(st, hh, 2), 2); assert.strictEqual(S.aleOf(st, hh), 4);
assert.strictEqual(S.pour(st, hh, 10), 4, 'only what it has'); assert.strictEqual(S.pour(st, hh, 1), 0);
assert.strictEqual(hh.poured.length, BREW.maxBarrels, 'the pours are bounded');
assert.ok(Math.abs(S.aleStanding(st, hh) - 0.2) < 1e-9, 'standing at most 0.2');
st.t += 2 * YEAR + 1; assert.ok(Math.abs(S.aleStanding(st, hh) - 0.2) < 1e-9, 'still there within 3 years'); st.t += YEAR;
assert.strictEqual(S.aleStanding(st, hh), 0, 'gone after 3 years');
{ const keep = hh.poured.length; st.t -= 2 * YEAR; S.prune(st); assert.strictEqual(hh.poured.length, keep, 'the year\'s turn keeps pours of the last 3 years');
  st.t += 2 * YEAR; S.prune(st); assert.strictEqual(hh.poured.length, 0, 'and drops older ones'); }
assert.deepStrictEqual(checkState(st).filter((x) => /ale|pours|stores/.test(x)), [], 'invariants (ale)'); // the clock was moved by years, so ages are stale

// 5. At an occasion the host pours what it has and the guests remember it; a host with no ale pours nothing and is not remembered.
{
  const s2 = Sim.seed(world(7), 7, 'populous'); s2.naturalDeaths = false;
  const O = VB['sim/occasions'], host = s2.households.find((h) => !h.dissolved && h.holder !== null && h.members.length >= 3);
  const fm = s2.farmsteads[host.farmstead], guests = s2.households.filter((h) => !h.dissolved && h !== host && h.holder !== null).slice(0, 3).map((h) => h.holder);
  const mk = (come) => ({ id: 900 + s2.occasionSeq++, kind: 'wedding', for: [host.holder, host.members[1]], village: fm.village, farm: fm.id, tile: fm.house, x: 0, y: 0, start: 0, end: 1,
    overrides: false, asked: [], come, due: 1 });
  const hold = (o) => { for (const id of o.come) s2.agents[id].occasion = o.id; s2.occasions.push(o); s2.t = o.end; };
  const prestige = s2.pawns[host.holder].prestige, run = (o) => { hold(o); O.occasionsDue(s2); };
  s2.t = 0; host.grain += 100; const o1 = mk([host.holder, ...guests]);
  run(o1); // no ale
  assert.strictEqual(host.poured.length, 0); assert.strictEqual(s2.pawns[host.holder].prestige, prestige);
  assert.strictEqual(opinionOf(s2, guests[0], host.holder) === opinionOf(s2, guests[0], host.holder), true);
  s2.t = 0; S.brew(s2, host); const before = guests.map((g) => opinionOf(s2, g, host.holder));
  const o2 = mk([host.holder, ...guests]); o2.end = 2; run(o2);
  assert.strictEqual(S.aleOf(s2, host), 0, 'the barrel is used up'); assert.strictEqual(host.poured.length, 1);
  assert.ok(host.ledger.some((x) => x.kind === 'pour' && x.good === 'ale' && x.n === -1), 'booked with its reason');
  const ale = Soc.prestigeParts(s2, s2.pawns[host.holder]).find((x) => x[0] === 'Ale poured');
  assert.ok(ale && Math.abs(ale[1] - BREW.prestige) < 1e-9, 'the host gains 0.05, listed among the parts');
  assert.ok(s2.pawns[host.holder].prestige > prestige - 0.2, 'and the prestige follows');
  guests.forEach((g, i) => assert.ok(opinionOf(s2, g, host.holder) - before[i] > 0.04, `guest ${g} thinks the better of the host`));
  assert.ok(s2.pawns[guests[0]].rel.get(host.holder).mem.ale, 'a memory of it');
  assert.deepStrictEqual(checkState(s2).filter((x) => /ale|pours|stores|occasion/.test(x)), [], 'invariants after (the clock was set by hand)');
}
console.log('ale: ok');
