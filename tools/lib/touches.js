// A task's footprint, its `Touches:` line (VB-1677; docs/agents/tasks.md): what the task will edit, at function level, so a tool can tell
// which tasks may run side by side (VB-1678). The line is a list of items separated by "; ":
//   sim/jobs (allot, lookForWork)    a module key (src/<key>.js) with the module-level functions or tables it edits
//   page/words                       a module key alone: the task edits it, where is not yet known
//   tests/jobs.js                    a path, with or without names in brackets
//   new sim/wells                    a module or a file the task creates
// or `unknown (<reason>)`, for a plan task or when the writer cannot tell. A module's import block, export list and `@sys` header are
// implied; the list and bookkeeping files (manifest, owners, layers, suites, the backlog) are not named while they are lists (VB-1406).
const fs = require('fs'), path = require('path');
const NAME = /^[A-Za-z_$][\w$]*$/, TARGET = /^[\w.-]+(\/[\w.-]+)*$/;
// the line's text -> { unknown: reason } | { items: [{ target, names: [], created }] }; throws with the reason when malformed
function parseTouches(text) {
  const t = String(text).trim();
  const u = /^unknown \((.+)\)$/.exec(t);
  if (u) return { unknown: u[1] };
  if (!t || t === '(to write)') throw new Error('empty: name what the task edits, or unknown (<reason>)');
  if (/^unknown\b/.test(t)) throw new Error('unknown takes its reason in brackets: unknown (<reason>)');
  const items = [];
  for (const part of t.split(/;\s*/)) {
    const m = /^(new )?([^\s(]+)(?: \(([^)]*)\))?$/.exec(part.trim());
    if (!m) throw new Error(`"${part}": a module key or a path, with the functions it edits in brackets`);
    const [, created, target, list] = m;
    if (!TARGET.test(target)) throw new Error(`"${target}" is not a module key or a path`);
    const names = list === undefined ? [] : list.split(/,\s*/);
    for (const n of names) if (!NAME.test(n)) throw new Error(`"${n}" in ${target}: a function or table name`);
    items.push({ target, names, created: !!created });
  }
  return { items };
}
// the file an item stands for: a path as it is, a module key as src/<key>.js (or .ts)
function fileOf(root, target) {
  if (/\.\w+$/.test(target)) return target;
  for (const ext of ['.js', '.ts']) if (fs.existsSync(path.join(root, 'src', target + ext))) return `src/${target}${ext}`;
  return `src/${target}.js`;
}
// a place ("src/sim/jobs.js:120", "AGENTS.md", ".claude/agents/vb-task.md:33") as a Touches item: a module key under src/, else the path
function targetOf(place) {
  const m = /((?:[\w.-]+\/)*[\w.-]+\.\w+)(?::\d+)?/.exec(String(place || ''));
  if (!m || !TARGET.test(m[1])) return null;
  return /^src\/.*\.(js|ts)$/.test(m[1]) ? m[1].replace(/^src\//, '').replace(/\.(js|ts)$/, '') : m[1];
}
module.exports = { parseTouches, fileOf, targetOf };
