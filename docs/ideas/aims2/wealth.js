// Throwaway (docs/ideas/aims2, section 2.4): lasting wealth by household in a save (fields x 120, beasts at customary worth),
// its spread, the stakes held and the live obligations. Not game code; no test reads it. node docs/ideas/aims2/wealth.js SAVE.json.gz
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const root = path.join(__dirname, '../../..');
const VB = require(root + '/src/load.js'), G = VB.gen, Sim = VB.sim;
const f = process.argv[2];
const d = JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString('utf8'));
const it = G.generate(d.seed, { cols: d.cols, rows: d.rows }); let r; while (!(r = it.next()).done);
const st = Sim.load(r.value, d);
const W = { cow: 40, ox: 50, heifer: 20, steer: 20, calf: 10, bull: 50 };
const rows = [];
for (const hh of st.households) {
  if (hh.dissolved || !hh.members || !hh.members.length) continue;
  const fs_ = st.farmsteads[hh.farmstead];
  const fields = fs_.fields.length, meadows = (fs_.meadows || []).length;
  let beasts = 0, nb = 0;
  for (const id of hh.herds || []) { const h = st.herds[id]; if (!h) continue;
    if (h.species === 'sheep') { const n = (h.ewes || 0) + (h.rams || 0) + (h.lambs || 0); nb += n; beasts += 6 * n; }
    else for (const a of h.head || []) { nb++; beasts += W[a.kind] || 30; } }
  let grain = 0; for (const k in hh.grain) grain += hh.grain[k];
  let stakes = 0; for (const id of hh.members) stakes += st.pawns[id].stake || 0;
  rows.push({ id: hh.id, v: fs_.village, members: hh.members.length, fields, meadows, nb, beasts, grain: Math.round(grain), stakes, wealth: fields * 120 + beasts });
}
const gini = (xs) => { xs = xs.slice().sort((a, b) => a - b); const n = xs.length, s = xs.reduce((a, b) => a + b, 0); let c = 0; xs.forEach((x, i) => c += (2 * (i + 1) - n - 1) * x); return c / (n * s); };
const q = (xs, p) => { xs = xs.slice().sort((a, b) => a - b); return xs[Math.floor(p * (xs.length - 1))]; };
const ws = rows.map((r) => r.wealth), fl = rows.map((r) => r.fields), be = rows.map((r) => r.beasts);
console.log('year', Math.floor(st.t / Sim.YEAR), 'households', rows.length);
console.log('fields: gini', gini(fl).toFixed(2), 'p10/50/90', q(fl, .1), q(fl, .5), q(fl, .9));
console.log('beasts worth: gini', gini(be).toFixed(2), 'p10/50/90', q(be, .1), q(be, .5), q(be, .9), 'none', be.filter((x) => !x).length);
console.log('lasting (fields*120+beasts): gini', gini(ws).toFixed(2), 'p10/50/90', q(ws, .1), q(ws, .5), q(ws, .9), 'max', Math.max(...ws));
console.log('share of lasting wealth in beasts', (be.reduce((a, b) => a + b, 0) / ws.reduce((a, b) => a + b, 0)).toFixed(2));
const sk = []; for (const p of st.pawns) if (p.alive && p.stake > 0) sk.push(p.stake);
console.log('pawns with a stake', sk.length, 'p50', q(sk, .5), 'max', Math.max(0, ...sk));
const obl = st.obligations ? Object.values(st.obligations).filter((o) => o && ['open', 'part', 'overdue'].includes(o.status)) : [];
const byKind = {}; for (const o of obl) byKind[o.kind] = (byKind[o.kind] || 0) + 1; console.log('live obligations by kind', JSON.stringify(byKind));
