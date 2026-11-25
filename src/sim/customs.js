// @sys sim/customs: the catalogue of customs and practices, and the one door every layer reads the customs in force through
// ===== The customs in force, read (VB-231; target-v2, principle 12 and 3.1): the catalogue (DIMS, ARCHETYPES, PRACTICES) and the door =====
// A kernel module: it imports nothing, and culture (loaded after it) is the only writer of customs, attitudes and drift. Outside culture
// and this module no module under src/sim indexes a settlement's practice or a culture's customs (tests/lint.js holds it).
VB['sim/customs'] = (() => {
  // malleability m: 1 changes most easily; the order follows the agreed ranking
  const DIMS = [
    {
      key: 'claims',
      label: 'Claims on empty farms',
      m: 1.0,
      opts: [
        ['kin', 'Kin of the old family first'],
        ['villagers', 'Villagers first'],
        ['anyone', 'Anyone may claim'],
        ['assembly', 'The meeting assigns'],
      ],
    },
    {
      key: 'newLand',
      label: 'Cleared land belongs to',
      m: 0.9,
      opts: [
        ['village', 'The village allots it'],
        ['labour', 'Whoever worked most'],
        ['intended', 'Whoever it was cleared for'],
      ],
    },
    {
      key: 'handover',
      label: 'When the heir takes over',
      m: 0.8,
      opts: [
        ['death', 'At the holder’s death'],
        ['marriage', 'When the heir marries'],
        ['age60', 'When the holder turns 60'],
      ],
    },
    {
      key: 'daughterShare',
      label: 'A daughter’s share',
      m: 0.65,
      opts: [
        ['equal', 'Equal to a son’s'],
        ['half', 'Half a son’s'],
      ],
    },
    {
      key: 'heirCount',
      label: 'How many heirs',
      m: 0.55,
      opts: [
        ['one', 'One heir takes all'],
        ['buyout', 'One heir buys out the rest'],
        ['split', 'Land split between heirs'],
      ],
    },
    {
      key: 'widow',
      label: 'The widow',
      m: 0.45,
      opts: [
        ['life', 'Keeps the farm for life'],
        ['keep', 'Keeps a right to her keep'],
        ['outright', 'Inherits outright'],
      ],
    },
    {
      key: 'heirSex',
      label: 'Who can inherit',
      m: 0.35,
      opts: [
        ['sons', 'Sons only'],
        ['sonsFirst', 'Sons first'],
        ['any', 'Any child'],
        ['daughtersFirst', 'Daughters first'],
      ],
    },
    {
      key: 'voice',
      label: 'Who speaks at the meeting',
      m: 0.3,
      opts: [
        ['landholders', 'Landholders'],
        ['heads', 'All household heads'],
        ['adults', 'All adults'],
      ],
    },
    {
      key: 'birthOrder',
      label: 'Which child inherits',
      m: 0.25,
      opts: [
        ['eldest', 'The eldest'],
        ['youngest', 'The youngest'],
        ['chosen', 'Chosen by the parent'],
      ],
    },
    {
      key: 'residence',
      label: 'Where a married couple lives',
      m: 0.2,
      opts: [
        ['land', 'With whoever holds land'],
        ['husband', 'At the husband’s home'],
        ['wife', 'At the wife’s home'],
      ],
    },
    {
      key: 'kinLimit',
      label: 'Closest kin who may marry',
      m: 0.12,
      opts: [
        ['second', 'Third cousins or further'],
        ['first', 'Second cousins or further'],
        ['close', 'First cousins or further'],
        ['uncle', 'Uncle–niece or further'],
      ],
    },
    {
      key: 'feedOrder',
      label: 'Who eats first when food is short',
      m: 0.5,
      opts: [
        ['equal', 'Equal shares'],
        ['children', 'Children first'],
        ['workers', 'Those who work first'],
      ],
    },
    {
      key: 'ownHeir',
      label: 'Heir to their own parents’ farm',
      m: 0.6,
      opts: [
        ['behind', 'Steps behind other relatives'],
        ['keeps', 'Keeps their place'],
      ],
    },
    {
      key: 'dispute',
      label: 'Disputed claims',
      m: 0.7,
      opts: [
        ['first', 'The first claim stands'],
        ['strongest', 'The strongest claim stands'],
        ['kin', 'Kin of the last holder first'],
        ['meeting', 'The meeting decides'],
      ],
    },
    // VB-100 (Kim, 10 Nov): how the village's common fields rank beside a household's own work (sim/commons; COMMONS.lean)
    {
      key: 'commons',
      label: 'Work on the common fields',
      m: 0.5,
      opts: [
        ['own', 'After the household’s own work'],
        ['fair', 'As the village’s other duties'],
        ['first', 'Before the household’s own work'],
      ],
    },
    {
      key: 'affinity',
      label: 'Kin by marriage who may marry',
      m: 0.12,
      opts: [
        ['fourth', 'None within the fourth degree of affinity'],
        ['line', 'None in the direct line (step-parent, parent-in-law)'],
        ['free', 'No bar'],
      ],
    },
    // VB-711 (Kim, 16 Nov): how hard a household stocks for winter: the margin its autumn count keeps (sim/byre, HERD.margins)
    {
      key: 'stocking',
      label: 'Stocking for winter',
      m: 0.6,
      opts: [
        ['hay', 'To the hay'],
        ['herd', 'Keep the herd'],
      ],
    },
    // VB-826 (design.md, Marriage as a negotiation, 9 Nov): whose voice counts in a match, read where it is offered and answered
    // (sim/records spokesmanOf, sim/asking, sim/marriage); both who marry consent under every option
    {
      key: 'matchBy',
      label: 'Who makes a match',
      m: 0.4,
      opts: [
        ['heads', 'The heads'],
        ['consent', 'The heads, with consent'],
        ['couple', 'The couple'],
      ],
    },
    // VB-463 (Kim, 15 Nov): what the alderman is kept with (sim/keep; OFFICE.keepDays, OFFICE.keepShare)
    {
      key: 'keep',
      label: 'What the alderman is kept with',
      m: 0.4,
      opts: [
        ['days', 'Days of work'],
        ['share', 'A share of the surplus'],
        ['nothing', 'Nothing'],
      ],
    },
    // VB-555 (Kim, 30 Oct; design.md, Custom dimensions): how a child born outside marriage inherits, read where children are ranked
    // (sim/heirranking); a child whose parents have married each other since is born in marriage
    {
      key: 'outside',
      label: 'Children born outside marriage',
      m: 0.5,
      opts: [
        ['equal', 'Inherit like other children'],
        ['after', 'Inherit after children born in marriage'],
        ['none', 'Do not inherit'],
      ],
    },
    // VB-816 (design.md, Built ways, passage and upkeep: Passage on foot, Decided 3 Nov): whether a walker may cross another's meadow while
    // its hay stands, or only along a path or a lane over it; read where the tile lies, by the village whose land it is (sim/passage).
    // Fields in crop are never crossed, whatever the custom.
    {
      key: 'passage',
      label: 'Passage over standing hay',
      m: 0.5,
      opts: [
        ['free', 'Anyone may cross a meadow'],
        ['ways', 'A meadow in grass is crossed only along its ways'],
      ],
    },
    // VB-312 (design.md, Loans, obligations and cases: Interest and due; Slice 5's practices): what a grain loan is repaid with at the
    // harvest, read where the loan is made, by the borrower's village (sim/loans)
    {
      key: 'loans',
      label: 'Loans of grain are repaid',
      m: 0.4,
      opts: [
        ['quarter', 'With a quarter more'],
        ['asLent', 'As lent'],
      ],
    },
  ];
  const OFF = [],
    NOPT = [],
    IDX = {};
  let TOTAL = 0;
  DIMS.forEach((d, k) => {
    OFF.push(TOTAL);
    NOPT.push(d.opts.length);
    TOTAL += d.opts.length;
    IDX[d.key] = k;
  });
  const optIndex = (dim, key) => DIMS[IDX[dim]].opts.findIndex((o) => o[0] === key);

  const ARCHETYPES = {
    oldNordic: {
      claims: 'kin',
      newLand: 'village',
      handover: 'marriage',
      daughterShare: 'half',
      heirCount: 'buyout',
      widow: 'life',
      heirSex: 'sonsFirst',
      voice: 'landholders',
      birthOrder: 'eldest',
      residence: 'land',
      kinLimit: 'first',
      affinity: 'line',
      feedOrder: 'equal',
      ownHeir: 'behind',
      dispute: 'first',
      stocking: 'hay',
      matchBy: 'consent',
      keep: 'days',
      outside: 'after',
      passage: 'free',
      loans: 'quarter',
      commons: 'fair', // its claims favour kin, not the village (`first` where an archetype's claims are the village's: villagers, assembly)
    },
  };

  // A culture's practices that are not customs (VB-257; design.md section 7, Village routines): a rule the culture holds, declared here
  // with the customs, before the first seed, each with its options and the one every culture starts with; not voted on, not drifting,
  // and a culture that splits off keeps its parent's. noDecision: what follows when a village's meeting does not decide its routines (no
  // quorum, or a tie): no village work that year, or last year's work again.
  const PRACTICES = Object.freeze({
    noDecision: Object.freeze({
      label: 'When the meeting does not decide',
      opts: Object.freeze([
        ['nothing', 'No village work that year'],
        ['asLastYear', 'The work of last year'],
      ]),
      base: 'nothing',
    }),
    // How the alderman is chosen (VB-314; design.md, The alderman): at the autumn meeting, when the office is vacant. A practice a culture
    // holds, not a custom: its malleability (0.3) is how readily a culture changes it, kept with its declaration.
    alderman: Object.freeze({
      label: 'How the alderman is chosen',
      opts: Object.freeze([
        ['elected', 'Elected by the meeting'],
        ['byTurns', 'By turns among the farms, a year each'],
      ]),
      base: 'elected',
      malleability: 0.3,
    }),
    // On which days a village keeps its rites (VB-775; design.md, The season's rite): its own, drawn at its founding, as a parish kept its
    // feast day, or the same everywhere (VB-522 as built). A custom cultures may come to differ in, not a dimension: nothing yet gives
    // a pawn a stake in it.
    riteDays: Object.freeze({
      label: 'The days of the rite',
      opts: Object.freeze([
        ['own', 'Each village its own days'],
        ['common', 'The same days everywhere'],
      ]),
      base: 'own',
    }),
    // Whose work spinning and weaving are (VB-362; design.md, The mill and the loom: Who spins, Decided 11 Nov): it sets their ranks
    // (sim/textile SPINNERS), and so whose winter is idle.
    spinning: Object.freeze({
      label: 'Spinning and weaving are',
      opts: Object.freeze([
        ['women', 'Women’s work'],
        ['everyone', 'Everyone’s indoor work'],
      ]),
      base: 'women',
      malleability: 0.4,
    }),
  });
  // The culture's practice of key k: its own, or the one every culture starts with (a save made before VB-257).
  const practiceOf = (c, k) => (c && c.practices && c.practices[k] !== undefined ? c.practices[k] : PRACTICES[k].base);

  // ---- the door: the option of a custom in force ----
  // `at` is a settlement id (a village id). With no culture seeded, no such settlement, or a practice array
  // shorter than the catalogue (a save made before the custom was added), the option is the one of the archetype every
  // culture starts from (oldNordic), as each reader had it. Allocates nothing: the option key is the catalogue's own string.
  // inForceAt gives the option's index for custom index k, for the readers that compare indexes (a cause, the meeting's check).
  const BASE = DIMS.map((d) => d.opts.findIndex((o) => o[0] === ARCHETYPES.oldNordic[d.key]));
  const inForceAt = (st, k, at) => {
    const s = st.cenv && at !== null && at !== undefined ? st.cenv.settlements[at] : undefined;
    return s && s.practice[k] !== undefined ? s.practice[k] : BASE[k];
  };
  const inForce = (st, key, at) => {
    const k = IDX[key];
    return DIMS[k].opts[inForceAt(st, k, at)][0];
  };
  // The culture-wide option of custom key (a culture's customs, changed at its yearly reckoning): what villages of one culture that differ
  // in their practice fall back on (sim/territory, borderRule).
  const customOf = (st, key, culture) => {
    const k = IDX[key];
    return DIMS[k].opts[st.cenv.cultures[culture].customs[k]][0];
  };

  // An archetype's customs, an option index a custom (in the order of DIMS).
  function fromArchetype(name) {
    const a = ARCHETYPES[name];
    return DIMS.map((d) => optIndex(d.key, a[d.key]));
  }

  return {
    DIMS,
    OFF,
    NOPT,
    TOTAL,
    IDX,
    optIndex,
    ARCHETYPES,
    PRACTICES,
    practiceOf,
    fromArchetype,
    inForce,
    inForceAt,
    customOf,
  };
})();
