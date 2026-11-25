// Moving a test state's clock by hand (VB-235): st.tick, the count of 6-minute steps, is the clock's source of truth and st.t follows it,
// so a test that jumps in time sets both, as sim/clock would have left them. Only tests do this; a run moves its clock with Sim.advance.
// Whole steps only, as Sim.advance (VB-244): a time between two steps is refused.
function setClock(st, hours) {
  const { TICKS } = globalThis.VB['sim/rules'], x = hours * TICKS, whole = Math.round(x);
  if (!(Math.abs(x - whole) < 1e-6)) throw new Error(`setClock: ${hours} hours is not a whole number of 6-minute steps`);
  st.tick = whole;
  st.t = st.tick / TICKS;
  // legs and tasks due before the new time are taken at the next step (tests/lib/invariants.js allows them in a state set by hand)
  // the roles a birthday in the days jumped over changes, as the days' life step would have (VB-1685: no lag)
  if (Array.isArray(st.living) && Array.isArray(st.pawns)) globalThis.VB['sim/heirs'].refreshRoles(st);
  if (!Object.prototype.hasOwnProperty.call(st, 'clockSet')) Object.defineProperty(st, 'clockSet', { value: true, writable: true });
}
const moveClock = (st, hours) => setClock(st, st.t + hours);
module.exports = { setClock, moveClock };
