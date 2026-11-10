// @sys vb: module namespace and the convention for registering modules
// ===== Module namespace =====
// src/<path>.js registers as VB['<path>'] (e.g. src/sim/hex.js is VB['sim/hex']):
//   VB['sim/hex'] = (() => { ...; return { ... }; })();
// and reads what it needs at the top of its IIFE: const { bfs } = VB['sim/hex'];
// A module reads only modules listed before it in src/manifest.json. Grep a key to find the module and its users.
var VB = globalThis.VB = globalThis.VB || {};
// Work measurements only: never part of st or an input to a simulation decision.
VB.COUNTERS = {
  routeSearch: 'A* searches started',
  routeExpand: 'Tiles removed from the A* heap (including duplicates)',
  routeHit: 'Routes served from the cache, in either direction',
  routeRefresh: 'Cached routes tested for invalidation',
  routeEvict: 'Cached routes evicted to enforce the bound (including legacy loads)',
  talkWeighed: 'Eligible partners weighed in talkHour',
  walkStep: 'Agent records walked by the six-minute step (the awake ones, sim/agents)',
  walkAwake: 'Agent records walked to rebuild the awake list, once a game hour (VB-205)',
  idleStroll: 'Idle pawns sent strolling by idleAbout when the planner found them no work (VB-205)',
  companyWeighed: 'Idle pawns drawn and weighed as company in companyFor (VB-205)',
  walkPoint: 'Path points walked past by moveAgent (VB-205)',
  walkDaily: 'Pawn records walked by dailyLife and Culture.dailyStep',
  walkTies: 'Ties walked to put a pawn\'s ties back on today\'s scale, or to make room under the cap (sim/relations, VB-127)',
  tiePairs: 'Pairs given familiarity for waking hours at home (daily) or a job finished together (sim/relations, VB-127)',
  roundPairs: 'Candidate man/woman pairs visited in the moving round',
  heirRank: 'All heirRanking calls, including nested rankings and indirect callers',
  storeWalk: 'Village stores and retained ledger entries visited for spoilage and pruning',
  ruleValue: 'Rule values read (explanations excluded)',
  oppAsk: 'Calls of a kind\'s `available` rule by the hourly review of the standing plans (sim/jobs, refreshJobs; VB-258)',
  planReview: 'Standing plans reviewed, one per live household on a farm and per village each review hour (sim/plans, VB-258)',
};
VB.count = {};
VB.resetCounts = () => { for (const name of Object.keys(VB.COUNTERS)) VB.count[name] = 0; };
VB.resetCounts();
