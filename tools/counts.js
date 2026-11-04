// Measurements for tools and tests only; never loaded by the simulation.
function livingPawnDays(st, from, to = st.t, day = 24) {
  return st.pawns.reduce((sum, p) => sum + Math.max(0,
    Math.min(p.died ?? to, to) - Math.max(p.born, from)) / day, 0);
}
module.exports = { livingPawnDays };
