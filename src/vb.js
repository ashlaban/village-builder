// ===== Module namespace =====
// src/<path>.js registers as VB['<path>'] (e.g. src/sim/hex.js is VB['sim/hex']):
//   VB['sim/hex'] = (() => { ...; return { ... }; })();
// and reads what it needs at the top of its IIFE: const { bfs } = VB['sim/hex'];
// A module reads only modules listed before it in src/manifest.json. Grep a key to find the module and its users.
var VB = globalThis.VB = globalThis.VB || {};
