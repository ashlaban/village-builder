// Brief: all a task's agent needs to start, in one call: the task (header, goal, criteria; its notes only by size), its open
// questions, the sections of design.md its Design ref names (a short one whole, a long one by its subsections), what waits for it,
// and the rules of AGENTS.md and BACKLOG.md that apply to its kind (a refactor, a change of behaviour, the page, a plan, a wrap-up).
// It replaces  backlog.js show ID,  questions.js show ID  and a  doc.js  call a ref; it reads, and writes nothing.
// usage: node tools/brief.js VB-NNN [--refs N] [--root DIR]
//   --refs N    print a design section whole up to N KB (default 4); a longer one is listed with its subsections
require('./help.js')(__filename);
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const args = process.argv.slice(2);
const option = (k) => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const root = path.resolve(option('--root') || path.join(__dirname, '..')), cap = (+option('--refs') || 4) * 1000;
const fail = (msg) => { console.error('brief: ' + msg); process.exit(1); };
const id = args[0];
if (!/^VB-\d{3,}$/.test(id || '')) fail('a task ID (VB-NNN); --help');
const file = path.join(root, 'backlog', id + '.md');
if (!fs.existsSync(file)) fail(`no backlog/${id}.md`);
const tool = (name, ...a) => { const r = spawnSync(process.execPath, [path.join(__dirname, name), ...a], { encoding: 'utf8', cwd: root }); return { ok: r.status === 0, out: r.stdout.trim() }; };
const kb = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + ' KB' : n + ' B');
const text = fs.readFileSync(file, 'utf8'), lines = text.split('\n'), out = [];

// ---- the task: its file up to the end of the criteria; what follows (notes, reports) only by size
const crit = lines.findIndex((l) => /^Acceptance criteria:/.test(l));
let end = lines.length;
if (crit >= 0) { end = crit + 1; while (end < lines.length && (/^\s*- \[[ x]\]/.test(lines[end]) || /^\s{2,}\S/.test(lines[end]))) end++; }
out.push(lines.slice(0, end).join('\n').trim());
const rest = lines.slice(end).join('\n').trim();
if (rest) {
  const flags = rest.split('\n').filter((l) => /^Flag:/.test(l));
  out.push(`(notes and reports, ${kb(rest.length)}, left out: node tools/backlog.js show ${id})` + (flags.length ? '\n' + flags.join('\n') : ''));
}
const field = (k) => ((text.match(new RegExp(`^${k}: (.*)$`, 'm')) || [])[1] || '').trim();
const name = (lines[0] || '').replace(/^# VB-\d+: /, ''), phase = field('Phase') || 'implement';

// ---- its questions
const q = tool('questions.js', '--root', root, 'show', id);
if (q.ok && q.out && !/^\(no block names/.test(q.out)) out.push('## Questions (QUESTIONS.md)\n' + q.out);

// ---- the design sections its ref names
const ref = field('Design ref');
if (ref && !/^none\b/i.test(ref)) {
  // "Section (Subsection: ...; ...); Other section. A sentence." : candidates are the parts between ";" and sentence ends, outside brackets
  const parts = [];
  let depth = 0, cur = '';
  for (let i = 0; i < ref.length; i++) {
    const ch = ref[i];
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && (ch === ';' || (ch === '.' && /\s|$/.test(ref[i + 1] || '')))) { parts.push(cur); cur = ''; } else cur += ch;
  }
  parts.push(cur);
  const seen = new Set(), found = [];
  for (const raw of parts) {
    const p = raw.replace(/^\s*`?design\.md`?,?\s*/i, '').trim();
    if (!p || p.length > 160 || /backlog\/|docs\/|\.md\b|^Kim\b/.test(p.replace(/\s*\(.*$/, ''))) continue;
    const inner = p.match(/^.*?\((.*?):\s*(.*?)\)$/); // "Section (Subsection: Row)": the row inside the subsection first
    for (const query of [...(inner ? [`${inner[1]} (${inner[2]})`] : []), p, p.replace(/\s*\(.*$/, ''), ...p.replace(/\s*\(.*$/, '').split(/,\s*/).reverse()]) {
      if (!query || seen.has(query)) continue;
      const r = tool('doc.js', 'design.md', query);
      if (!r.ok) continue;
      seen.add(query);
      const head = r.out.split('\n')[0];
      if (/^# /.test(head)) continue; // the whole document is no reference
      if (found.some((f) => f.head === head)) break;
      if (r.out.length <= cap) found.push({ head, body: r.out });
      else {
        const toc = tool('doc.js', 'design.md', query, '--toc');
        found.push({ head, body: `${head}\n(${kb(r.out.length)}: read with  node tools/doc.js design.md "${query}" [--shallow]; its sections:)\n${toc.out.split('\n').slice(1, 14).join('\n')}` });
      }
      break;
    }
  }
  if (found.length) out.push('## Design (design.md), by the task\'s Design ref\n' + found.map((f) => f.body).join('\n\n'));
  else out.push(`## Design\nNo section of design.md found for the ref; look with  node tools/doc.js --toc`);
}

// ---- who waits for it
const waiting = fs.readdirSync(path.join(root, 'backlog')).filter((f) => new RegExp(`^Waits for: .*\\b${id}\\b`, 'm').test(fs.readFileSync(path.join(root, 'backlog', f), 'utf8')))
  .map((f) => f.slice(0, -3));
if (waiting.length) out.push(`Waited for by ${waiting.join(', ')}.`);

// ---- the rules for its kind: pointers, each to the section that holds the rule
const refactor = /^Refactor:/.test(name), page = /src\/page|the page\b|screenshot/i.test(text.slice(0, text.length - rest.length));
const rules = ['Decide what the task leaves open by AGENTS.md, Deciding without Kim; nothing teleports. Surface principle candidates, teleports found and close calls.'];
if (phase === 'plan') {
  rules.push('A plan is a design pass: it makes the design concrete in its sections of design.md (a row in docs/design-changelog.md), and writes the arch\'s implement tasks with numbers and criteria.',
    'Name each system\'s cost before it is built: entities, times cadence, times work per call (AGENTS.md, Rules for cost, 9).');
} else if (phase === 'wrap-up') {
  rules.push('A wrap-up checks the arch against the design with long runs and reports the numbers; it names the parameters a tuning run would move, as rows of docs/tuning.md, and tunes nothing.',
    'It adds the arch\'s bands to tests/lib/bands.js (AGENTS.md, Working rules).');
} else if (refactor) {
  rules.push('Behaviour unchanged: `node tools/same.js --base REF` prints `same`, REF the commit you start from; its line goes into your result.',
    'Code moves verbatim, no renames; a new module has an `@sys` header and its place in src/manifest.json (BACKLOG.md, How this backlog works, Refactor rules).',
    'Say what fell: lines, couplings, duplicated rules.');
} else {
  rules.push('A change to behaviour reports numbers before and after, at named seeds and maps (tools/sim.js, tools/balance.js), and says whether households, not only averages, are better off.',
    'A new state field: its invariants (tests/lib/invariants.js), the WORLD list if the world holds it, a line in tools/stocks.js if it is a stored quantity. A new loop over a growing collection: a work counter.',
    'A parameter may be tried in at most five short runs, the values and results written in the task file (Deciding without Kim, 3).');
}
if (page) rules.push('The page changed: `node tests/smoke.js` and the `tests/browser*.js` it touches; a screenshot, if you take one to check your work, stays outside the repository (Kim, 18 November).');
if (/\bms\b|counter|medium-ref|small-y40|\bcost\b/i.test(text.slice(0, text.length - rest.length))) rules.push('Cost: AGENTS.md, Rules for cost; report counters, and leave times to the nightly bench when others share the machine.');
rules.push('To finish: `npm run format`, `npm run verify`; tick the criteria and write your notes in the task file.');
out.push('## Rules for this task\n' + rules.map((r) => '- ' + r).join('\n'));

console.log(out.join('\n\n'));
