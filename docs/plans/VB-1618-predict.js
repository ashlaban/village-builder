// scratch (VB-1618): how well a done task's text (before its notes) names the src files its VB-NNN: commits edited.
// node docs/plans/VB-1618-predict.js   Research code, not game code.
// For done tasks: files actually edited under src/ (commits whose subject starts "VB-NNN:") vs modules named in the task file text.
const { execSync } = require('child_process'); const fs = require('fs'); const path = require('path');
const sh = (c) => execSync(c, { encoding: 'utf8', maxBuffer: 1 << 28 });
const log = sh('git log --no-merges --name-only --format="@@%s" -- src').split('@@').slice(1);
const actual = {};
for (const block of log) { const [subj, ...files] = block.trim().split('\n'); const m = /^(VB-\d+):/.exec(subj); if (!m) continue;
  (actual[m[1]] ||= new Set()); files.filter((f) => f.startsWith('src/') && /\.(js|ts|json|html)$/.test(f)).forEach((f) => actual[m[1]].add(f)); }
const srcFiles = sh('git ls-files src').trim().split('\n');
// names a file can be referred to by: path, path without src/ and ext (module key), basename without ext (only if unique and length>4)
const base = {}; for (const f of srcFiles) { const b = path.basename(f).replace(/\.\w+$/, ''); (base[b] ||= []).push(f); }
const names = (f) => { const key = f.replace(/^src\//, '').replace(/\.\w+$/, ''); const b = path.basename(key);
  const n = [f, key, `VB['${key}']`]; if (base[b].length === 1 && b.length > 4) n.push(b); return n; };
const LISTS = new Set(['src/manifest.json', 'src/owners.json', 'src/vb.js', 'src/sim.js', 'src/page.json', 'src/layers.json', 'src/sim/rules.js']);
let tp = 0, fn = 0, fp = 0, tasks = 0, pairs = { both: 0, predOnly: 0, actOnly: 0, none: 0 }; const pred = {};
for (const [id, files] of Object.entries(actual)) { const tf = `backlog/${id}.md`; if (!fs.existsSync(tf) || !files.size) continue;
  // the text as written before the work: header up to Notes (approximation: notes written later are excluded)
  const text = fs.readFileSync(tf, 'utf8').split(/^Notes/m)[0];
  const p = new Set(srcFiles.filter((f) => names(f).some((n) => new RegExp(`(^|[^\\w/])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\w]|$)`).test(text))));
  const a = [...files].filter((f) => !LISTS.has(f) && srcFiles.includes(f)); const pp = [...p].filter((f) => !LISTS.has(f));
  if (!a.length) continue; tasks++; pred[id] = { p: new Set(pp), a: new Set(a) };
  tp += a.filter((f) => p.has(f)).length; fn += a.filter((f) => !p.has(f)).length; fp += pp.filter((f) => !files.has(f)).length; }
console.log(`tasks ${tasks}; file-level recall ${(tp / (tp + fn)).toFixed(2)}, precision ${(tp / (tp + fp)).toFixed(2)} (list files excluded)`);
// pairwise: do predicted footprints overlap when actual ones do? (last 150 tasks by id)
const ids = Object.keys(pred).sort((x, y) => +y.slice(3) - +x.slice(3)).slice(0, 150);
for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const A = pred[ids[i]], B = pred[ids[j]];
  const ov = (s, t) => [...s].some((f) => t.has(f)); const act = ov(A.a, B.a), pr = ov(A.p, B.p);
  pairs[act && pr ? 'both' : pr ? 'predOnly' : act ? 'actOnly' : 'none']++; }
console.log('pairs (recent 150 tasks):', pairs, `conflict recall ${(pairs.both / (pairs.both + pairs.actOnly)).toFixed(2)}, precision ${(pairs.both / (pairs.both + pairs.predOnly)).toFixed(2)}`);
