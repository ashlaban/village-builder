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
  talkWeighed: 'Eligible partners weighed in talkHour',
  contactPairs: 'Indoor and outdoor pairs compared in noteContacts',
  walkStep: 'Agent records walked by the six-minute step',
  walkDaily: 'Pawn records walked by dailyLife and Culture.dailyStep',
  walkTies: 'Ties decayed by dailyLife',
  roundPairs: 'Candidate man/woman pairs visited in the moving round',
  heirRank: 'All heirRanking calls, including nested rankings and indirect callers',
  ruleValue: 'Rule values read (explanations excluded)',
};
VB.count = {};
VB.resetCounts = () => { for (const name of Object.keys(VB.COUNTERS)) VB.count[name] = 0; };
VB.resetCounts();
