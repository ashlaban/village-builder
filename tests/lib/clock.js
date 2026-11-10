// Moving a test state's clock by hand (VB-235): st.tick, the count of 6-minute steps, is the clock's source of truth and st.t follows it,
// so a test that jumps in time sets both, as sim/clock would have left them. Only tests do this; a run moves its clock with Sim.advance.
function setClock(st, hours) {
  const { TICKS } = globalThis.VB['sim/rules'], x = hours * TICKS, whole = Math.round(x);
  st.tick = Math.abs(x - whole) < 1e-6 ? whole : Math.floor(x);
  st.tickPart = x - st.tick > 1e-6 ? x - st.tick : 0;
  st.t = (st.tick + st.tickPart) / TICKS;
}
const moveClock = (st, hours) => setClock(st, st.t + hours);
module.exports = { setClock, moveClock };
