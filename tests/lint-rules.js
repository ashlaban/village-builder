// Line rules of tests/lint.js, kept apart so that tests/lintrules.js can feed them single lines.
const CLOCK = /\b(Math\.random|Date\.now|performance\.now)\b|\bnew Date\b/;
// A line that reads the clock or draws unseeded randomness, unless it carries `// lint-allow: clock <reason>`.
const clockUse = (line) => (/\/\/ lint-allow: clock \S/.test(line) || !CLOCK.test(line) ? null : line.match(CLOCK)[0]);

const PATH = String.raw`st((?:\.\w+|\[[^\]]*\])+)`, WRITE_OK = new Set(['visualDirty', 'naturalDeaths', 'driftMul']), CLEAR_OK = new Set(['rigDirty', 'farmDirty', 'villageDirty', 'treeDirty', 'biomeDirty', 'pathDirty', 'landDirty']);
const ASSIGN = new RegExp(String.raw`(?<![\w.$])${PATH}\s*(?:=(?!=)|[-+*/%&|^]=|\*\*=|<<=|>>>?=|\?\?=|\|\|=|&&=)`, 'g');
const STEP = new RegExp(String.raw`(?:(?:\+\+|--)\s*(?<![\w.$])${PATH}|(?<![\w.$])${PATH}\s*(?:\+\+|--))`, 'g');
const MUTATE = new RegExp(String.raw`(?<![\w.$])${PATH}\.(push|pop|shift|unshift|splice|set|add|delete|clear|sort|reverse|fill)\(`, 'g');
const top = (path) => path.match(/^\.(\w+)/) ? path.match(/^\.(\w+)/)[1] : path;
// Writes to the simulation state `st` on one line of the page script: the text of each forbidden write.
function pageWrites(line) {
  const code = line.replace(/\/\/.*$/, ''), out = [];
  for (const m of code.matchAll(ASSIGN)) if (!(/^\.\w+$/.test(m[1]) && WRITE_OK.has(top(m[1])))) out.push(m[0].trim());
  for (const m of code.matchAll(STEP)) out.push(m[0].trim());
  for (const m of code.matchAll(MUTATE)) {
    if (m[2] === 'clear' && /^\.\w+$/.test(m[1]) && CLEAR_OK.has(top(m[1]))) continue;
    out.push(m[0].trim());
  }
  return out;
}
module.exports = { clockUse, pageWrites };

// Only increments of declared counters are allowed; consuming their values would affect the run.
function counterUses(line, names) {
  const code = line.replace(/\/\/.*$/, '');
  const allowed = code.replace(/(?:^|(?<=[;{}]))\s*VB\.count\.(\w+)\s*(?:\+\+|\+=\s*[^;{}]+)\s*;/g,
    (text, name) => names.has(name) && !/VB\s*(?:\.|\[)/.test(text.slice(text.indexOf('VB.count.') + 'VB.count.'.length)) ? '' : text);
  const hits = [...allowed.matchAll(/\bVB\s*(?:\.\s*count\b|\[\s*['"]count['"]\s*\])/g)].map((m) => m[0]);
  if (/\}\s*=\s*(?:globalThis\s*\.\s*)?VB\s*(?:[;,)]|$)/.test(code)) hits.push('destructured VB');
  return hits;
}
module.exports.counterUses = counterUses;

// The open task that splits a module (VB-414): a task not done, titled "Refactor: ..." and naming the module's key (`sim/relations`) in its
// title. tasks is [{id, title, status}]; a key matches whole, so `gen` is not found in `gen/rivers`. Returns the task's id or null.
function splitTask(key, tasks) {
  const named = new RegExp(String.raw`(?<![\w/.-])${key.replace(/[/.]/g, '\\$&')}(?:\.js)?(?![\w/-])`);
  const hit = tasks.find((k) => !/^done\b/.test(k.status) && /^Refactor:/.test(k.title) && named.test(k.title));
  return hit ? hit.id : null;
}
module.exports.splitTask = splitTask;

// Who reads each export (VB-454). sources is {key: text} of the modules of src/manifest.json; the result maps a module key to a map of
// export name to the set of module keys that read it, found in the text: `const { a, b: c } = VB['m']`, `VB['m'].a`, and `A.a` for an
// alias `A = VB['m']`. A use that cannot be followed (the namespace passed whole) counts as reading every export of it: the set holds '*'.
// A module's own file and the facades (the `sim` facade is not a reader, as it is not counted) are skipped.
function exportReaders(sources, facades = new Set(['sim'])) {
  const out = {}, add = (m, name, by) => { const r = out[m] || (out[m] = {}); (r[name] || (r[name] = new Set())).add(by); };
  for (const [by, raw] of Object.entries(sources)) {
    if (facades.has(by)) continue;
    let text = raw.split('\n').map((l) => l.replace(/(^|\s)\/\/.*$/, '$1')).join('\n');
    const take = (re, fn) => { text = text.replace(re, (...a) => { fn(...a); return ' '; }); };
    take(/\{([^{}]*)\}\s*=\s*VB\[['"]([\w/]+)['"]\]/g, (_, names, m) => {
      if (m !== by) for (const n of names.split(',')) { const k = n.split(':')[0].replace(/=.*$/, '').trim(); if (k) add(m, k, by); }
    });
    take(/\bVB\[['"]([\w/]+)['"]\]\s*(?:\.\s*(\w+)|\[\s*['"](\w+)['"]\s*\])/g, (_, m, a, b) => { if (m !== by) add(m, a || b, by); });
    const aliases = [];
    take(/\b(\w+)\s*=\s*VB\[['"]([\w/]+)['"]\](?!\s*=[^=])/g, (_, a, m) => { if (m !== by) aliases.push([a, m]); });
    for (const [a, m] of aliases) {
      let followed = 0, any = 0;
      text.replace(new RegExp(String.raw`(?<![\w.$])${a}\s*(?:\.\s*(\w+)|\[\s*['"](\w+)['"]\s*\])`, 'g'), (_, x, y) => { followed++; add(m, x || y, by); return ''; });
      text.replace(new RegExp(String.raw`(?<![\w.$])${a}(?![\w$])`, 'g'), () => { any++; return ''; });
      if (any > followed) add(m, '*', by);
    }
    text.replace(/\bVB\[['"]([\w/]+)['"]\](?!\s*=[^=])/g, (_, m) => { if (m !== by) add(m, '*', by); return ''; });
  }
  return out;
}
module.exports.exportReaders = exportReaders;

// The exports of a module that the width lint leaves out: those read by registries alone. names are the module's exports, readers its entry of
// exportReaders, registries the list of tests/lint.js. Returns {name: [registry keys that read it]} for each export left out. An export nobody
// reads is counted; so is one a module reads that is no registry, or a '*' read by a non-registry.
function leftOut(names, readers = {}, registries) {
  const out = {};
  for (const n of names) {
    const by = new Set([...(readers[n] || []), ...(readers['*'] || [])]);
    if (by.size && [...by].every((m) => m in registries)) out[n] = [...by].sort();
  }
  return out;
}
module.exports.leftOut = leftOut;
