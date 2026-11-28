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

// The open task that splits a module (VB-414): the split collector (tools/lib/collect.js; Kim, 25 November) while it holds an unticked
// line naming the module's key ("- [ ] From VB-NNN: sim/stores: ..."); a task of its own no longer counts. tasks is [{id, title, status,
// text}]; a key matches whole, so `gen` is not found in `gen/rivers`. Returns the collector's id or null.
function splitTask(key, tasks) {
  const { COLLECT, namesModule } = require('../tools/lib/collect.js');
  const hit = tasks.find((k) => !/^done\b/.test(k.status) && k.title === COLLECT.split.name && namesModule(k.text || '', key));
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
// reads is counted; so is one a module reads that is no registry, or a '*' read by a non-registry. The names a module gives the page (page,
// the export names of its PAGE list, VB-1944) are read by the facade: one read by nobody else, or by registries alone, is left out with 'sim'
// among its readers, and so is the PAGE list itself.
function leftOut(names, readers = {}, registries, page = []) {
  const out = {}, given = new Set(page);
  for (const n of names) {
    const by = new Set([...(readers[n] || []), ...(readers['*'] || [])]);
    if (n === 'PAGE' || given.has(n)) by.add('sim');
    if (by.size && [...by].every((m) => m in registries || m === 'sim')) out[n] = [...by].sort();
  }
  return out;
}
module.exports.leftOut = leftOut;

// VB-1685 (the principles review of 24 November, S1): the owner of a cache is told after the write, not before. In each function of src
// (the source text), a `...Changed(st, key, ...)` notification followed, in the same function and outside its inner functions, by a write
// to `[key]` (an assignment or a step): `line: name(key)` for each.
function notedBefore(src) {
  const { tokenize } = require('../tools/wrap.js');
  const toks = tokenize(src).filter((t) => t.t !== 'com'), v = (i) => toks[i] && toks[i].v, close = new Map(), stack = [];
  toks.forEach((t, i) => {
    if (['(', '[', '{'].includes(t.v)) stack.push(i);
    else if ([')', ']', '}'].includes(t.v) && stack.length) close.set(stack.pop(), i);
  });
  const opens = new Map([...close].map(([o, c]) => [c, o]));
  // a function's body: a brace after an arrow, or after the parameters of `function [name](...)`
  const bodies = [];
  toks.forEach((t, i) => {
    if (t.v !== '{' || !close.has(i)) return;
    const p = i - 1, o = v(p) === ')' ? opens.get(p) : undefined;
    if (v(p) === '=>' || (o !== undefined && (v(o - 1) === 'function' || v(o - 2) === 'function'))) bodies.push([i, close.get(i)]);
  });
  const text = (a, b) => toks.slice(a, b).map((t) => t.v ?? '#').join('');
  const WRITE = new Set(['=', '+=', '-=', '*=', '/=', '|=', '&=', '++', '--', '??=', '||=', '&&=']), out = [];
  toks.forEach((t, i) => {
    if (t.t !== 'word' || !/.Changed$/.test(t.v) || v(i + 1) !== '(' || v(i - 1) === 'function') return;
    const end = close.get(i + 1), commas = [];
    for (let k = i + 2, d = 0; k < end; k++) {
      if (['(', '[', '{'].includes(v(k))) d++;
      else if ([')', ']', '}'].includes(v(k))) d--;
      else if (v(k) === ',' && d === 0) commas.push(k);
    }
    if (!commas.length) return;
    const key = text(commas[0] + 1, commas[1] ?? end);
    const fn = bodies.filter(([a, b]) => a < i && i < b).sort((x, y) => y[0] - x[0])[0];
    if (!fn) return;
    // a return (break, continue, throw) in the call's block, or one around it, ends the path: a write past it is on another
    for (let k = end + 1, d = 0; k < fn[1]; k++) {
      const inner = bodies.find(([a, b]) => a === k && b < fn[1]);
      if (inner) { k = inner[1]; continue; }
      if (v(k) === '{') d++;
      else if (v(k) === '}') d--;
      if (d <= 0 && ['return', 'break', 'continue', 'throw'].includes(v(k))) break;
      // a setter given the key (setBiome(w, key, ...), setOwner(st, key, ...)) writes it too
      if (toks[k].t === 'word' && /^set[A-Z]/.test(v(k)) && v(k + 1) === '(' && close.has(k + 1)) {
        const e = close.get(k + 1), args = [];
        for (let j = k + 2, d = 0, from = k + 2; j <= e; j++) {
          if (j === e || (v(j) === ',' && d === 0)) { args.push(text(from, j)); from = j + 1; }
          else if (['(', '[', '{'].includes(v(j))) d++;
          else if ([')', ']', '}'].includes(v(j))) d--;
        }
        if (args.includes(key)) {
          out.push(`${src.slice(0, t.s).split('\n').length}: ${t.v}(${key})`);
          break;
        }
      }
      if (v(k) !== '[' || !close.has(k)) continue;
      const c = close.get(k);
      if (text(k + 1, c) === key && (WRITE.has(v(c + 1)) || WRITE.has(v(k - 1)))) {
        out.push(`${src.slice(0, t.s).split('\n').length}: ${t.v}(${key})`);
        break;
      }
    }
  });
  return out;
}
module.exports.notedBefore = notedBefore;
