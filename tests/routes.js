// Routes: cache keys never collide on a Large map, and a far target is found by the second, longer search.
const VB = require('../src/load.js'), { route } = VB['sim/agents'];
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('ROUTES FAIL:', m); } };
const COLS = 380, ROWS = 270, N = COLS * ROWS, nb = new Int32Array(N * 6).fill(-1);
for (let i = 0; i < N; i++) {
  const c = i % COLS, r = (i / COLS) | 0, o = (r & 1) ? 1 : 0;
  const cand = [[c - 1, r], [c + 1, r], [c - 1 + o, r - 1], [c + o, r - 1], [c - 1 + o, r + 1], [c + o, r + 1]];
  cand.forEach(([x, y], k) => { if (x >= 0 && x < COLS && y >= 0 && y < ROWS) nb[i * 6 + k] = y * COLS + x; });
}
const st = { w: { N, nb, water: new Uint8Array(N) }, pathCache: new Map(), routeFallbacks: 0 };
// (100029, 100030) and (100030, 30) share the old key from * 100000 + to; the second is too far to walk, so it falls back
const p1 = route(st, 100029, 100030), p2 = route(st, 100030, 30);
check(p1.length === 2 && p1[0] === 100029 && p1[1] === 100030, 'first pair gets its own path');
check(p2.length === 1 && p2[0] === 30 && st.routeFallbacks === 1, 'second pair gets its own path, a counted fallback');
st.routeFallbacks = 0;
const far = route(st, 0, 100 + 100 * COLS);
check(far.length > 60 && far[far.length - 1] === 100 + 100 * COLS && st.routeFallbacks === 0, 'a far target is found by the 200-step search');
st.w.water.fill(1); st.w.water[0] = 0;
route(st, 0, N - 1);
check(st.routeFallbacks === 1, 'unreachable target counts one fallback');
if (failed) process.exit(1);
console.log('routes ok');
