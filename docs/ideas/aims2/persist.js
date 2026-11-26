// Throwaway (docs/ideas/aims2, section 2.4): a farm's lasting-wealth rank in its village at two saves of one run, all farms, the same
// holder, and the holder's own child. Not game code; no test reads it. node docs/ideas/aims2/persist.js EARLY.json.gz LATE.json.gz
const fs = require('fs'), zlib = require('zlib');
const VB = require(require('path').join(__dirname, '../../../src/load.js')), G = VB.gen, Sim = VB.sim;
const W = { cow: 40, ox: 50, heifer: 20, steer: 20, calf: 10, bull: 50 };
function open(f) { const d = JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString('utf8'));
  const it = G.generate(d.seed, { cols: d.cols, rows: d.rows }); let r; while (!(r = it.next()).done); return Sim.load(r.value, d); }
function farms(st) { const m = new Map();
  for (const hh of st.households) { if (hh.dissolved || !hh.members || !hh.members.length || hh.holder == null) continue;
    const f = st.farmsteads[hh.farmstead]; let beasts = 0;
    for (const id of hh.herds || []) { const h = st.herds[id]; if (!h) continue;
      if (h.species === 'sheep') beasts += 6 * ((h.ewes || 0) + (h.rams || 0) + (h.lambs || 0)); else for (const a of h.head || []) beasts += W[a.kind] || 30; }
    m.set(f.id, { v: f.village, holder: hh.holder, w: f.fields.length * 120 + beasts }); } return m; }
function ranks(m) { const byV = new Map(); for (const [id, x] of m) { if (!byV.has(x.v)) byV.set(x.v, []); byV.get(x.v).push([id, x.w]); }
  const r = new Map(); for (const [, xs] of byV) { if (xs.length < 3) continue; xs.sort((a, b) => a[1] - b[1]); xs.forEach(([id], i) => r.set(id, i / (xs.length - 1))); } return r; }
const spearman = (pairs) => { const n = pairs.length; if (n < 3) return NaN; const rk = (k) => { const s = pairs.map((p, i) => [p[k], i]).sort((a, b) => a[0] - b[0]); const o = []; s.forEach(([, i], j) => o[i] = j); return o; };
  const a = rk(0), b = rk(1); let d = 0; for (let i = 0; i < n; i++) d += (a[i] - b[i]) ** 2; return 1 - 6 * d / (n * (n * n - 1)); };
const A = open(process.argv[2]), B = open(process.argv[3]);
const fa = farms(A), fb = farms(B), ra = ranks(fa), rb = ranks(fb);
const all = [], heir = [], same = [];
for (const [id, x] of fb) { if (!ra.has(id) || !rb.has(id)) continue; const pair = [ra.get(id), rb.get(id)]; all.push(pair);
  const old = fa.get(id).holder, now = x.holder; const p = B.pawns[now];
  if (now === old) same.push(pair); else if (p && (p.father === old || p.mother === old || (p.parents || []).includes(old))) heir.push(pair); }
console.log('farms at both', all.length, 'rank rho', spearman(all).toFixed(2));
console.log('same holder', same.length, 'rho', spearman(same).toFixed(2));
console.log('holder to its child', heir.length, 'rho', spearman(heir).toFixed(2));
const g = (xs) => { xs = xs.slice().sort((a, b) => a - b); const n = xs.length, s = xs.reduce((a, b) => a + b, 0); let c = 0; xs.forEach((x, i) => c += (2 * (i + 1) - n - 1) * x); return c / (n * s); };
console.log('lasting wealth gini', g([...fa.values()].map((x) => x.w)).toFixed(2), '->', g([...fb.values()].map((x) => x.w)).toFixed(2), 'households', fa.size, '->', fb.size);
