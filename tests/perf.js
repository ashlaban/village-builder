// Speed of a populous medium map (seed 7) after 2 years: ms per game day, the moving round and the meetings. Not part of either suite.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
const it = G.generate(7, { cols: 280, rows: 200 }); let r; while (!(r = it.next()).done);
const st = Sim.seed(r.value, 7, 'populous'), ms = (f) => { const t = Date.now(); f(); return Date.now() - t; };
const adv = ms(() => Sim.advance(st, 2 * Sim.YEAR));
const round = ms(() => Sim.movingRound(st)), meet = ms(() => Sim.holdMeetings(st));
console.log(`populous medium seed 7, ${st.pawns.filter((p) => p.alive).length} alive of ${st.pawns.length}: ${(adv / (2 * Sim.YEAR_DAYS)).toFixed(1)} ms/day, ` +
  `moving round ${round} ms, meetings ${meet} ms`);
