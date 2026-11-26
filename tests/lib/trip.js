// A whole trip of a kind that makes its good where the work is done (VB-1748), for the tests that called its delivery alone: the good made
// as the work ends (`make`, onto a carrier's load), then brought home (`deliver`, which puts the load). What the delivery returns.
module.exports = (K, st, j, hh, f, frac = 1) => {
  const a = { load: 0 };
  if (K.make) K.make(st, a, j, frac, hh);
  return K.deliver(st, j, hh, f, a);
};
