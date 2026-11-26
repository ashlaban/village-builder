// A household plan's season steps for the tests (VB-1752): its targets as one live view in the shape the tests read them (each a getter
// and a setter on the target step of the season the plan holds now, so a view outlasts the season's steps being made again), and its
// season as {steps: the routines' kinds in order, by: 'head' once its head set the order, else undefined, from, made: the day made, season,
// year}. Read-only but for the targets' levels.
const V = () => globalThis.VB; // the loaded modules of the test's own load (tests/lib/load.js wraps them)
const targetOf = (plan, k) => V()['sim/steps'].targetOf(plan, k);
function targets(plan) {
  const t = (k) => targetOf(plan, k);
  const field = (k, f) => ({ get: () => t(k)[f], set: (v) => { t(k)[f] = v; }, enumerable: true });
  return Object.defineProperties({}, {
    wood: field('wood', 'seasons'),
    woodSecond: field('wood', 'second'),
    hayWinters: field('hay', 'level'),
    seed: field('seed', 'level'),
    perHand: field('fields', 'perHand'),
    fields: field('fields', 'level'),
    workable: field('fields', 'workable'),
    ahead: { get: () => ({ season: t('wood').ahead.season, wood: t('wood').ahead.wood, hay: t('hay').ahead }), enumerable: true },
    goods: {
      get: () => {
        const G = plan.season.filter((s) => s.what.target && s.what.target.good);
        return G.length ? Object.fromEntries(G.map((s) => [s.what.target.good, s.what.target.level])) : undefined;
      },
      enumerable: true,
    },
  });
}
function season(plan) {
  const S = plan.season, R = S.filter((s) => s.what.routine), c = V()['sim/rules'].cal(S[0].from * V()['sim/rules'].DAY);
  return {
    steps: R.map((s) => s.what.routine),
    by: R.some((s) => s.author === 'pawn') ? 'head' : undefined,
    made: S[0].from,
    year: c.year,
    season: c.season,
    end: S[0].by,
  };
}
module.exports = { targets, season };
