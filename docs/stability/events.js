// Counts the log lines of the review's rules over one populous run (every line, since st.events keeps only the last 40).
//   node docs/stability/events.js [REPO] SEED YEARS [tiny|small]
const [repo, seed, years, map = 'tiny'] = process.argv.slice(2);  // REPO '.' for this checkout
const VB = require(require('path').resolve(repo) + '/src/load.js'), G = VB.gen, Sim = VB.sim;
const SIZES = { tiny: [120, 85], small: [180, 130] };
const it = G.generate(+seed, { cols: SIZES[map][0], rows: SIZES[map][1] }); let r; while (!(r = it.next()).done);
const st = Sim.seed(r.value, +seed, 'populous'), lines = [];
const f = function (...a) { for (const e of a) lines.push(e.text); return Array.prototype.unshift.apply(this, a); }; st.events.unshift = f;
Sim.advance(st, +years * Sim.YEAR);
const pat = { putOff: /put off marrying/, marriesAway: /marries away/, claimed: /left with no heir when/, emptyMarried: /married away, and nobody/,
  service: /goes into service with/, guardian: /as guardian of/, emptyChild: /is a child, with no grown kin/, marry: / marry and live at /, settle: /leaves crowded/ };
const n = Object.fromEntries(Object.entries(pat).map(([k, re]) => [k, lines.filter((l) => re.test(l)).length]));
let putOffCouples = 0; for (const l of lines) { const m = l.match(/(\d+) couples? put off/); if (m) putOffCouples += +m[1]; }
console.log(`seed ${seed} ${years}y:`, JSON.stringify({ ...n, putOffCouples }));
for (const k of ['marriesAway', 'claimed', 'emptyMarried', 'putOff']) { const l = lines.find((x) => pat[k].test(x)); if (l) console.log('  e.g.', l); }
