// @sys sim/makings: the makings (VB-678), the registry of what a head may begin through the verb `project` (sim/plans) beyond a field and
// a meadow: each declared at load by the module that carries it out (a boat by sim/drying, a cart by sim/carts, a tar pit by sim/tar, a
// barn and a farm for the heir by sim/aims), as sim/kinds and sim/commands are; it holds no domain's rule and no state
VB['sim/makings'] = (() => {
  const { atLoad } = VB['sim/registry'];
  // A making is {why(st, hh, f, args): why household hh, holding farm f, may not begin it now, or null (the verb's one check for every
  // head, played or not); begin(st, hh, f, args): the project plan's record {steps, ...} for sim/plans to make, or null when the making's
  // own module begins it (heirFarm's plot, sim/expansion); small (a small construction, VB-1414); look (absent for a large project, which
  // sim/aims' menu offers): {from (the day of the year from which the head weighs it, once a year at its first review on or after it),
  // want(st, hh, f, c): the args the head's rule begins it with, or null: what makes it possible and attractive to the head}}.
  const MAKINGS = {};
  function declare(what, M) {
    atLoad();
    if (MAKINGS[what] || what === 'field' || what === 'meadow' || what === 'none')
      throw new Error('Duplicate making: ' + what);
    if (typeof M.why !== 'function' || typeof M.begin !== 'function')
      throw new Error(`Making ${what} needs why and begin`);
    if (M.look && !(Number.isInteger(M.look.from) && typeof M.look.want === 'function'))
      throw new Error(`Making ${what}: a look names from and want`);
    MAKINGS[what] = Object.freeze({ ...M, what });
  }
  // The making `what`, or null.
  const makingOf = (what) => (typeof what === 'string' && Object.hasOwn(MAKINGS, what) ? MAKINGS[what] : null);
  // The makings a head weighs on its own once a year (those with a look), in the order declared; the list is made at its first read,
  // after load.
  let LOOKS = null;
  const looks = () => LOOKS || (LOOKS = Object.values(MAKINGS).filter((M) => M.look));
  return { declare, makingOf, looks };
})();
