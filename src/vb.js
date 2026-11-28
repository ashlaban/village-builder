// @sys vb [kernel]: module namespace and the convention for registering modules
// ===== Module namespace =====
// src/<path>.js registers as VB['<path>'] (e.g. src/sim/hex.js is VB['sim/hex']):
//   VB['sim/hex'] = (() => { ...; return { ... }; })();
// and reads what it needs at the top of its IIFE: const { bfs } = VB['sim/hex'];
// A module reads only modules listed before it in src/manifest.json. Grep a key to find the module and its users.
var VB = (globalThis.VB = globalThis.VB || {});
// Work measurements only: never part of st or an input to a simulation decision. A module declares each counter at load, beside
// the loop it counts: VB.counter(name, meaning) (VB-1934; `grep -rn "VB.counter('" src`). VB.COUNTERS is the joined list, name to
// meaning, in the order declared: the modules' load order (src/manifest.json), then each module's own order. Loading the modules
// again (tools/q5.js) starts from this file, so the list is made anew.
VB.COUNTERS = {};
VB.count = {};
VB.counter = (name, meaning) => {
  if (Object.hasOwn(VB.COUNTERS, name)) throw new Error(`counter ${name} declared twice`);
  VB.COUNTERS[name] = meaning;
  VB.count[name] = 0;
};
VB.resetCounts = () => {
  for (const name of Object.keys(VB.COUNTERS)) VB.count[name] = 0;
};
VB.resetCounts();
