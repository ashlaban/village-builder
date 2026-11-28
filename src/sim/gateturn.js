// @sys sim/gateturn [material]: turning a farmstead's gate (VB-1951 batch 2; Kim, 27 Nov 2026: the player may turn a farmstead's gate, a building's
//   entrance being a general property; not a church's): the small making `gate` (args {side}), a project of the household at its house
//   whose one step, the job kind turngate, moves the gate to that side when it is done (sim/entrances turnGate)
VB['sim/gateturn'] = (() => {
  // The kinds of event it writes on the record (sim/eventkinds, VB-1946).
  VB['sim/eventkinds'].eventKinds('sim/gateturn', {
    gateTurned: {}, // a farmstead's gate moved (VB-1951)
  });
  const Projects = VB['sim/projects'];
  const { declare } = VB['sim/makings'];
  const { GATE, turnGate } = VB['sim/entrances'];
  const { through } = VB['sim/walking'];
  const { costChanged } = VB['sim/routes'];
  const { log, atFarm } = VB['sim/records'];
  // Why household hh, holding farm f, may not turn its gate to side `side` now, or null: a side of the house (0 to 5) other than the
  // gate's own, opening onto land a walk may cross; one turning at a time.
  function gateWhy(st, hh, f, side) {
    if (!f || f.household !== hh.id) return 'the household has no farm of its own';
    if (!Number.isInteger(side) || side < 0 || side > 5) return 'a gate is turned to a side of the house, 0 to 5';
    if (st.w.gate && st.w.gate[f.house] === side) return `${f.name}'s gate is on that side`;
    const n = st.w.nb[f.house * 6 + side];
    if (n < 0 || !through(st.w, n)) return 'that side opens onto nothing a walk may cross';
    return Projects.underWay(st, hh.id, 'gate') ? `${f.name}'s gate is being turned` : null;
  }
  declare('gate', {
    small: true,
    why: (st, hh, f, args) => gateWhy(st, hh, f, args && args.side),
    begin: (st, hh, f, args) => ({
      side: args.side,
      steps: [{ kind: 'turngate', place: f.house, hours: GATE.turnHours }],
    }),
  });
  // The step done: the gate stands on its new side, and routes are reckoned from it (sim/routes costChanged).
  function turned(st, j, hh, plan) {
    const f = j.farm;
    if (!f || !Number.isInteger(plan.side)) return;
    turnGate(st.w, f.house, plan.side);
    costChanged(st, f.house);
    st.farmDirty.add(f.id);
    log(st, `${f.name} has moved its gate.`, { kind: 'gateTurned', ...atFarm(f) });
  }
  const KINDS = {
    turngate: {
      at: ['farm'],
      needs: [],
      gives: [],
      verb: 'Moving the gate',
      go: 'Going to move the gate',
      name: 'Move the gate',
      label: 'Gate',
      anim: 'mallet',
      hours: GATE.turnHours,
      hands: 2,
      type: 'wood',
      project: true,
      spot: (st, a, j) => {
        const p = VB['sim/entrances'].gatePoint(st.w, j.site) || [st.w.hx[j.site], st.w.hy[j.site]];
        return [p[0] + a.ox * 0.3, p[1] + a.oy * 0.3];
      },
      done: (st, j) =>
        Projects.stepEnds(st, j, j.owner && j.owner.type === 'household' ? st.households[j.owner.id] : null, turned),
    },
  };
  return { KINDS, gateWhy };
})();
