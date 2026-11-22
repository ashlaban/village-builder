// Preloaded into every script of the fast and integration tiers, and their children, by tests/run.js (NODE_OPTIONS --require; VB-1477).
// A script of a short run spends about half its CPU on V8's background compilers optimizing functions it then calls too few times to
// repay (VB-862's profile of `hay`). TurboFan's threshold raised from 3000 calls to 20000 cuts verify's CPU by a fifth and lengthens no
// script by more than half a second; Sparkplug and the interpreter still serve the rest. The night's tiers keep V8's defaults: the bench
// and the bands measure the game as it runs. The flag is a V8 option NODE_OPTIONS refuses, so it is set here, before any module loads.
require('v8').setFlagsFromString('--invocation-count-for-turbofan=20000');
