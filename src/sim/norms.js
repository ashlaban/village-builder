// @sys sim/norms: the norms on goods: customary worth, the classes of goods and what custom calls an exchange between them
// A kernel module: pure tables and one pure reading of them; it imports nothing (VB-417: out of culture, which drifts and votes).
VB['sim/norms'] = (() => {
  // ===== Norms (VB-299; design.md, The fair and Goods of place, Quanta and worth; target-v2 4.4): usual quantities, one table for every
  // culture until norms learn from deals (slice 8). Rations are the one unit of account. =====
  // Customary worth of one quantum of each good the fair trades (Agreed, 10 Nov): a sack of grain, a lot of salt meat, butter or dried
  // fish (10 rations each), a barrel of tar or ale, a head of cattle by kind, a sheep. Heirs' shares paid in animals read the same table.
  const WORTH = Object.freeze({
    grain: 10,
    butter: 15,
    'salt meat': 15,
    'dried fish': 15,
    tar: 8,
    ale: 14,
    'cattle/cow': 40,
    'cattle/ox': 50,
    'cattle/heifer': 20,
    'cattle/steer': 20,
    sheep: 6,
    hide: 6, // a roe deer's hide, leather for shoes and harness (VB-424)
    salt: 20, // a sack of 10 measures, boiled at a spring (VB-700; Proposed): it salts 100 rations of meat, which then keep a year
    quern: 25, // a hand quern's stone, hewn of sandstone or granite (VB-009; Proposed, slice 6's plan): a good of place
  });
  // The three classes of goods (Decided, 10 Nov): food; wares (animals, cloth and labour; today animals, and tar beside them); land.
  const CLASSES = Object.freeze(['food', 'wares', 'land']);
  // What custom calls an exchange of a good of one class for one of another (Agreed, 10 Nov), from the side that gives `from` and takes `to`:
  // 'none' (not offered at all: land, until slice 5's "Debts are paid with"), 'hard' (a hard bargain: allowed, and remembered against the
  // side that drove it), 'ordinary' (within a class), 'admired' (food for an animal, freely). PROPER is their order, worst first.
  const PROPER = Object.freeze(['none', 'hard', 'ordinary', 'admired']);
  const NORMS = Object.freeze({ hardBelowDays: 60 }); // an animal given for food by a household holding fewer days of need is a hard bargain
  // norm('worth', good): rations a quantum (undefined for a good with no customary worth). norm('proper', fromClass, toClass, days): a word of
  // PROPER; days is the food the giving side's household holds, in days of its need. Pure: no state, no allocation.
  function norm(key, a, b, days) {
    if (key === 'worth') return WORTH[a];
    if (key !== 'proper') throw new Error('Unknown norm: ' + key);
    if (!CLASSES.includes(a) || !CLASSES.includes(b)) throw new Error(`Unknown class of goods: ${a}, ${b}`);
    if (a === 'land' || b === 'land') return 'none';
    if (a === b) return 'ordinary';
    return a === 'wares' && b === 'food' && days < NORMS.hardBelowDays ? 'hard' : 'admired';
  }

  return { WORTH, CLASSES, PROPER, NORMS, norm };
})();
