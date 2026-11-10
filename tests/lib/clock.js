// Moving a test state's clock by hand (VB-235): st.tick, the count of 6-minute steps, is the clock's source of truth and st.t follows it,
// so a test that jumps in time sets both, as sim/clock would have left them. Only tests do this; a run moves its clock with Sim.advance.
// Whole steps only, as Sim.advance (VB-244): a time between two steps is refused.
function setClock(st, hours) {
  const { TICKS } = globalThis.VB['sim/rules'], x = hours * TICKS, whole = Math.round(x);
  if (!(Math.abs(x - whole) < 1e-6)) throw new Error(`setClock: ${hours} hours is not a whole number of 6-minute steps`);
  st.tick = whole;
  st.tickPart = 0;
  st.t = st.tick / TICKS;
}
const moveClock = (st, hours) => setClock(st, st.t + hours);
module.exports = { setClock, moveClock };
