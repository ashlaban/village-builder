// @sys sim/people: the household generators of the founders and populous scenarios
VB['sim/people'] = (() => {
  const { person, marry, makeHousehold, joinHousehold } = VB['sim/records'];

  // Founders: a young couple on every farm, and two servants who join two of the households.
  function foundersHouseholds(R, farmsteads) {
    const rand = R.rand, households = [];
    farmsteads.forEach((f) => {
      const hAge = 23 + ((rand() * 11) | 0), wAge = Math.max(19, hAge - 1 - ((rand() * 6) | 0));
      const man = person(R, { sex: 'm', age: hAge }), wife = person(R, { sex: 'f', age: wAge });
      households.push(makeHousehold(R, households.length, f, [man, wife], man));
      marry(R, man, wife, 1 + ((rand() * 4) | 0));
    });
    const order = households.map((h) => h.id).sort(() => rand() - 0.5);
    const hand = person(R, { sex: 'm', age: 16 + ((rand() * 4) | 0), servant: true }),
      maid = person(R, { sex: 'f', age: 16 + ((rand() * 4) | 0), servant: true });
    joinHousehold(R, households[order[0]], hand); joinHousehold(R, households[order[1 % order.length]], maid);
    return households;
  }

  // Household sizes 4 to 9, about 6 on average.
  const SIZES = [[4, 0.15], [5, 0.2], [6, 0.25], [7, 0.2], [8, 0.12], [9, 0.08]];
  function drawSize(rand) {
    let u = rand();
    for (const [n, p] of SIZES) { if (u < p) return n; u -= p; }
    return 6;
  }

  // Populous: a couple, their children (two years apart) and sometimes a servant. Two generations only: the parents have no
  // recorded parents, so there are no grandparents, living or on record.
  function populousHouseholds(R, farmsteads, sizes) {
    const rand = R.rand, households = [];
    for (const f of farmsteads) {
      const size = sizes[f.id], servant = size >= 6 && rand() < 0.25 ? 1 : 0, kids = size - 2 - servant;
      const youngest = (rand() * 3) | 0, eldest = youngest + 2 * (kids - 1);
      const wAge = Math.max(25 + ((rand() * 14) | 0), eldest + 19), hAge = wAge + ((rand() * 6) | 0) - 1;
      const man = person(R, { sex: 'm', age: hAge }), wife = person(R, { sex: 'f', age: wAge });
      const members = [man, wife];
      marry(R, man, wife, eldest + 1 + ((rand() * 3) | 0));
      for (let k = 0; k < kids; k++) members.push(person(R, { sex: rand() < 0.5 ? 'm' : 'f', age: youngest + 2 * k, father: man, mother: wife }));
      const hh = makeHousehold(R, households.length, f, members, man);
      if (servant) joinHousehold(R, hh, person(R, { sex: rand() < 0.5 ? 'm' : 'f', age: 15 + ((rand() * 6) | 0), servant: true }));
      households.push(hh);
    }
    return households;
  }
  return { foundersHouseholds, drawSize, populousHouseholds };
})();
