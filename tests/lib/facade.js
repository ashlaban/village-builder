// The Sim facade's functions by what they do to st (VB-1756, tests/commands.js): each is listed once, in ISSUES (it issues a verb),
// FRAME, WORLD, DEBUG, CACHES or READS. A function in no list, or in two, is returned, so a new one is placed by hand (review F2: a
// new mutator that a few calls on a state leave unchanged is still seen as new).
function misplaced(Sim, lists) {
  const fns = Object.keys(Sim).filter((k) => typeof Sim[k] === 'function');
  return fns.filter((k) => Object.values(lists).filter((l) => l.includes(k)).length !== 1);
}
module.exports = { misplaced };
