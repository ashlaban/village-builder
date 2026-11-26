// A whole trip of a kind that makes its good where the work is done (VB-1748), for the tests that called its delivery alone: the good made
// as the work ends (`make`, onto a carrier's load), then brought home (`deliver`, which puts the load). What the delivery returns.
const VB = require('../../src/load.js');
module.exports = (K, st, j, hh, f, frac = 1) => {
  const a = { load: 0 },
    k = Object.keys(VB['sim/kinds'].KINDS).find((x) => VB['sim/kinds'].KINDS[x] === K); // the delivery is its method's (VB-1820)
  if (K.make) K.make(st, a, j, frac, hh);
  return VB['sim/doing'].said(k).deliver(st, j, hh, f, a);
};
