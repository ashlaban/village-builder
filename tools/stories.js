// The stories of a run (VB-523; sim/stories, its numbers in STORY), for tools/sim.js --report stories [--json]. The run advances a day at
// a time; this reads st.stories and pawn.known only, and the work counters.
//   made     stories made a year by kind (a story nobody could hold is not made; one made and forgotten within its day is missed)
//   held     at each year's end: live stories, the entries a living pawn of account holds (mean), and the share of pawns holding any
//   hops     at each year's end: the held entries by hops (0 first-hand), their count and the valence held against the source's (mean
//            v / source v; over 1 is sharpened, the noise beside it), and the share believed of those
//   spread   the experiment's spread curve (docs/gossip-experiment.md): for each story made, the share of the adults (of account) of the
//            subject's village holding it, and of the most-reached other village, on days 0, 1, 2, 4, 8, 12, 24, 48, 96 and 144 after it was
//            made; the mean over the stories alive to be sampled, and over all made (a dropped story holds 0)
//   strangers at each year's end: the opinion of the subject held by those who saw it (first-hand, not of the subject's household) and by
//            strangers who heard it (hearsay, no tie to the subject), by sign of the story; and their ratio (a stranger judges at about
//            a third of a witness: design.md, Stories)
//   cost     storyMade, storyWeighed and storyTold a living pawn-day over the run (rule 9; tools/counts.js)
require('./help.js')(__filename);
const DAYS = [0, 1, 2, 4, 8, 12, 24, 48, 96, 144];
function collector(VB, st) {
  const Sim = VB.sim, { DAY, YEAR_DAYS } = VB['sim/rules'], { SOCIAL, tieOf } = VB['sim/ties'], R = VB['sim/relations'];
  const settlement = (p) => Sim.settlementIdOf(st, p), adultOf = (p) => p.alive && p.age >= SOCIAL.account;
  const from = st.t, count0 = { storyMade: VB.count.storyMade, storyWeighed: VB.count.storyWeighed, storyTold: VB.count.storyTold };
  let seen = st.storySeq ?? 0;
  const tracked = new Map(), curve = DAYS.map(() => ({ n: 0, home: 0, away: 0 })), years = [];
  let year = Math.floor(st.t / Sim.YEAR);
  // the day's sampling: each tracked story due on one of DAYS, its holders by village
  function day() {
    for (; seen < (st.storySeq ?? 0); seen++) {
      const s = st.stories && st.stories.get(seen);
      if (!s) continue;
      const v = settlement(st.pawns[s.subject]);
      tracked.set(s.id, { kind: s.kind, village: v, t: s.t, next: 0 });
      years[years.length - 1].made[s.kind] = (years[years.length - 1].made[s.kind] || 0) + 1;
    }
    const due = new Map();
    for (const [id, x] of tracked) {
      const d = Math.floor((st.t - x.t) / DAY);
      while (x.next < DAYS.length && DAYS[x.next] < d) x.next++; // a day passed by (a story made before the collector)
      if (x.next >= DAYS.length) { tracked.delete(id); continue; }
      if (DAYS[x.next] === d) due.set(id, new Map());
    }
    if (!due.size) return;
    const adults = new Map();
    for (const id of st.living) {
      const p = st.pawns[id];
      if (!adultOf(p)) continue;
      const v = settlement(p);
      adults.set(v, (adults.get(v) || 0) + 1);
      if (p.known) for (const e of p.known) { const m = due.get(e.story); if (m) m.set(v, (m.get(v) || 0) + 1); }
    }
    for (const [id, m] of due) {
      const x = tracked.get(id), c = curve[x.next];
      let away = 0;
      for (const [v, n] of adults) if (v !== x.village) away = Math.max(away, (m.get(v) || 0) / n);
      c.n++; c.home += (m.get(x.village) || 0) / Math.max(1, adults.get(x.village) || 0); c.away += away;
      x.next++;
      if (!st.stories.has(id)) tracked.delete(id);
    }
    // the stories dropped before a sampling day count 0 there, so the curve's denominator is all made: noted in `made` below
  }
  function yearEnd() {
    const y = years[years.length - 1], hops = new Map(), str = { ill: [0, 0, 0, 0], well: [0, 0, 0, 0] };
    let held = 0, pawns = 0, any = 0;
    for (const id of st.living) {
      const p = st.pawns[id];
      if (!adultOf(p)) continue;
      pawns++;
      if (!p.known || !p.known.length) continue;
      any++; held += p.known.length;
      for (const e of p.known) {
        const s = st.stories.get(e.story), h = Math.min(e.hops, 4), b = hops.get(h) || hops.set(h, { n: 0, ratio: 0 }).get(h);
        b.n++; b.ratio += e.v / s.v;
        if (s.subject === id || !st.pawns[s.subject].alive || st.pawns[s.subject].household === p.household) continue;
        const o = R.opinionOf(st, id, s.subject), g = s.v < 0 ? str.ill : str.well;
        if (e.first) { g[0]++; g[1] += o; } else if (tieOf(st, id, s.subject) === 0) { g[2]++; g[3] += o; }
      }
    }
    const mean = (a, k) => (a[k] ? +(a[k + 1] / a[k]).toFixed(3) : null);
    const side = (g) => { const w = mean(g, 0), s = mean(g, 2); return { witnesses: g[0], witnessOpinion: w, strangers: g[2], strangerOpinion: s,
      ratio: w && s !== null ? +(s / w).toFixed(2) : null }; };
    Object.assign(y, { live: st.stories ? st.stories.size : 0, heldPerPawn: pawns ? +(held / pawns).toFixed(2) : 0, holdingAny: pawns ? +(any / pawns).toFixed(2) : 0,
      hops: Object.fromEntries([...hops].sort((a, b) => a[0] - b[0]).map(([h, b]) => [h === 4 ? '4+' : h, { n: b.n, held: +(b.ratio / b.n).toFixed(3) }])),
      strangers: { ill: side(str.ill), well: side(str.well) } });
  }
  return {
    advanceYear() {
      years.push({ year: ++year, made: {} });
      for (let d = 0; d < YEAR_DAYS; d++) { Sim.advance(st, DAY); day(); }
      yearEnd();
    },
    result() {
      const pawnDays = require('./counts.js').livingPawnDays(st, from, st.t, DAY), made = years.reduce((n, y) => n + Object.values(y.made).reduce((a, b) => a + b, 0), 0);
      const per = (k) => +((VB.count[k] - count0[k]) / Math.max(1, pawnDays)).toFixed(4);
      return {
        years,
        spread: DAYS.map((d, i) => { const c = curve[i]; return { day: d, sampled: c.n, home: c.n ? +(c.home / c.n).toFixed(3) : null,
          away: c.n ? +(c.away / c.n).toFixed(3) : null, homeOfAllMade: made ? +(c.home / made).toFixed(3) : null }; }),
        cost: { livingPawnDays: Math.round(pawnDays), storyMade: per('storyMade'), storyWeighed: per('storyWeighed'), storyTold: per('storyTold') },
      };
    },
  };
}
module.exports = { collector, DAYS };
