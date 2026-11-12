// counts of notable events by decade, and custom changes that undo a settlement's previous change of the same custom
const { Sim, loadSave } = require('./lib.js');
const { st } = loadSave(process.argv[2]);
const pick = ['putOff', 'kinBarred', 'married', 'left', 'noLand', 'stayed', 'plot', 'custom', 'split', 'seedEaten', 'empty'];
const by = {};
for (const e of st.record) if (e && typeof e === 'object' && pick.includes(e.kind) && e.t >= 0) { const d = 10 * Math.floor(e.t / Sim.YEAR / 10); (by[d] ||= {})[e.kind] = ((by[d] ||= {})[e.kind] || 0) + 1; }
// reversals
const last = new Map(); let changes = 0, reversals = 0;
for (const e of st.record) if (e && typeof e === 'object' && e.kind === 'custom') {
  const m = /^(?:At the (.+?) meeting|Across the (.+?) culture): (.+?) is now “(.+?)”(?: \(was “(.+?)”\))?/.exec(e.text); if (!m) continue;
  const key = (m[1] || m[2]) + '|' + m[3]; changes++;
  const prev = last.get(key); if (prev && m[5] && prev.to === m[5] && prev.from === m[4]) reversals++;
  last.set(key, { from: m[5], to: m[4] });
}
const customs = {}; for (const e of st.record) if (e && e.kind === 'custom') { const m = /: (.+?) is now/.exec(e.text); if (m) customs[m[1]] = (customs[m[1]] || 0) + 1; }
console.log(JSON.stringify({ file: process.argv[2].split('/').pop(), byDecade: by, customChanges: changes, reversals, customs }));
