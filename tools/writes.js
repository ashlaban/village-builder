// The writes map (VB-172): which module writes, and which reads, each field of the simulation state, and which modules depend on which.
// node tools/writes.js                  Markdown: the fields by entity with their writers and readers, the dependencies, the cycles, and the
//                                       writes whose receiver it could not place
// node tools/writes.js --json           the same as JSON
// node tools/writes.js --field household.grain    every write site of one field (or of an entity: --field household)
// It scans every module of src/manifest.json (src/sim, culture, gen); the page script (src/page/*.js) is scanned for reads only and reported as
// `page`, since the lint already limits what it writes. Writes found: assignments (= and compound), ++ and --, delete, and calls of push,
// splice, set, delete, add, clear, pop, shift, unshift, sort, reverse and fill; `x.f = x.f.filter(...)` is reported as `filter`. An element
// write (`w.trees[t] = 0`) is a write of the array field. Creating a record (`st.households.push({...})`) is a write of the collection only.
//
// Acorn supplies lexical scopes; receiver paths come from declarations and assignments from the state (`const hh = st.households[id]`),
// a `for ... of` or a callback over a collection. Conditional/deferred alias assignments retain their possible state targets.
// (`st.pawns.filter((p) => ...)`), destructuring (`const { owner } = st`), else the name's convention (hh, p, f, v, a, j, ...; CONV below).
// Bindings to object or array literals and new Maps or Sets are local; writes to them are counted, not listed. Writes whose receiver is
// neither are listed as unresolved, for a judgement by hand. Fields of nested records are reported by path (`farmstead.fields[].stage`);
// a nested object with no record type of its own is reported as its parent field (`farmstead.booth`).
require('./help.js')(__filename);
const fs = require('fs'), path = require('path');
const { tokenize } = require('./wrap.js');
const { scopesOf } = require('./write-scopes.js');
const { dependencies } = require('./dependencies.js');
const { validateOwners } = require('./owner-policy.js');
const ROOT = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/manifest.json'), 'utf8')).filter((f) => f !== 'vb.js');
const OWNERS = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/owners.json'), 'utf8'));
const ownerOf = (field) => typeof OWNERS.fields[field] === 'string' ? OWNERS.fields[field] : OWNERS.fields[field]?.owner;
const categoryOf = (field) => OWNERS.fields[field]?.category || (ownerOf(field) === 'signal' ? 'signal' : 'field');
const allowedWriter = (field, mod) => field.endsWith('.*') ?
  Object.keys(OWNERS.fields).filter((f) => f.startsWith(field.slice(0, -1))).every((f) => allowedWriter(f, mod)) :
  !ownerOf(field) || ownerOf(field) === 'signal' || ownerOf(field) === mod || OWNERS.creators.includes(mod) || OWNERS.exempt.includes(mod);

// the collections of the state and what their elements are; a path here, once indexed, becomes the entity named
const COLL = {
  'st.pawns': 'pawn', 'st.households': 'household', 'st.farmsteads': 'farmstead', 'st.villages': 'village', 'st.herds': 'herd',
  'st.agents': 'agent', 'st.unions': 'union', 'st.jobs': 'job', 'st.cenv.settlements': 'settlement', 'st.cenv.people': 'pawn',
  'st.cenv.cultures': 'culture', 'cenv.settlements': 'settlement', 'cenv.people': 'pawn', 'cenv.cultures': 'culture',
  'farmstead.fence': 'fence', 'village.fence': 'fence', 'st.claims[]': 'claim', 'st.plans.households': 'plan', 'st.plans.villages': 'plan',
};
// paths that name another record: a job's field is a farm's field, and so on
const ALIAS = {
  'st.w': 'w', 'st.cenv': 'cenv', 'job.field': 'farmstead.fields[]', 'job.meadow': 'farmstead.meadows[]', 'job.farm': 'farmstead',
  'job.plot': 'village.plots[]', 'job.stretch': 'fence', 'agent.job': 'job', 'job.tr': 'village.plots[].tiles[]', 'candidate.herd': 'herd',
};
// names whose meaning is the same in every module, used when a name has no binding of its own
const CONV = {
  st: 'st', w: 'w', env: 'cenv', cenv: 'cenv', hh: 'household', household: 'household', p: 'pawn', pawn: 'pawn', f: 'farmstead', farm: 'farmstead',
  farmstead: 'farmstead', v: 'village', village: 'village', a: 'agent', agent: 'agent', j: 'job', job: 'job', herd: 'herd',
  fd: 'farmstead.fields[]', field: 'farmstead.fields[]', meadow: 'farmstead.meadows[]', plot: 'village.plots[]', plan: 'plan',
};
// per module, names whose binding the scan cannot see (parameters, records made at seeding under other names); a judgement, kept short
const HINTS = {
  culture: { p: 'pawn', s: 'settlement', c: 'culture', nc: 'culture', a: 'local' }, // the culture's people are st.pawns
  'sim/saves': { v: 'local' }, 'sim/byre': { a: 'candidate' }, // byre: a candidate for slaughter {herd, head | sheep}
  'sim/rng': { r: 'st.rng' }, 'sim/records': { R: 'st', x: 'st.idx', l: 'st.idx' }, 'sim/people': { R: 'st' },
  'sim/layout': { used: 'st.used', farmsteads: 'st.farmsteads', villages: 'st.villages' },
  'sim/help': { from: 'household', to: 'household', a: 'pawn' }, 'sim/herds': { from: 'household', to: 'household', dest: 'herd' },
  'sim/heirs': { from: 'household', to: 'household', old: 'household' }, 'sim/relations': { g: 'agent', s: 'agent.talk', r: 'pawn.rel[]' },
  'sim/claims': { c: 'claim' }, 'sim/clock': { s: 'fence' }, 'sim/meadows': { m: 'farmstead.meadows[]' }, 'sim/births': { m: 'pawn' },
  'sim/commands': { q: 'pawn' }, 'sim/plans': { T: 'plan.targets' }, 'sim/settle': { use: 'local' }, 'sim/society': { customs: 'local' }, 'sim/scenarios': {
    R: 'st', A1: 'farmstead', A2: 'farmstead', B1: 'farmstead', f: 'farmstead' },
};
const KEYWORDS = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'case', 'delete', 'void', 'throw', 'await', 'yield', 'if', 'while',
  'for', 'switch', 'function', 'const', 'let', 'var', 'else', 'do', 'catch', 'export', 'default']);
const SKIP_ROOTS = new Set(['VB', 'module', 'globalThis', 'exports']);
const ENTITIES = new Set(['claim', 'st', 'w', 'cenv', ...Object.values(COLL)]);
const policyErrors = validateOwners(OWNERS, { modules: new Set(manifest.map((f) => f.replace(/\.js$/, ''))), entities: ENTITIES });
if (policyErrors.length) throw new Error(policyErrors.join('\n'));
const ASSIGN = new Set(['=', '+=', '-=', '*=', '/=', '%=', '**=', '||=', '&&=', '??=', '|=', '&=', '^=', '<<=', '>>=', '>>>=']);
const MUTATORS = new Set(['push', 'splice', 'set', 'delete', 'add', 'clear', 'pop', 'shift', 'unshift', 'sort', 'reverse', 'fill']);
const KEEP = new Set(['values', 'filter', 'slice', 'concat', 'flat', 'keys', 'entries']); // calls that return the same collection
const COPY = new Set(['filter', 'slice', 'concat', 'map', 'flat', 'flatMap']); // calls that return a new array
const ELEMENT = new Set(['find', 'get', 'at']); // calls that return one element
const CALLBACK = new Set(['forEach', 'filter', 'find', 'some', 'every', 'map', 'flatMap', 'findIndex', 'findLast']);

const canon = (p) => {
  if (p === null) return null;
  if (p.includes('|')) return [...new Set(p.split('|').map(canon))].join('|');
  if (ALIAS[p]) return ALIAS[p];
  if (p.endsWith('[]') && COLL[p.slice(0, -2)]) return COLL[p.slice(0, -2)];
  return p;
};
const element = (p) => (p === null || p === 'local' ? p : p.includes('|') ? p.split('|').map(element).join('|') :
  p.startsWith('[]') ? p.slice(2) : canon(p + '[]'));


function matches(toks) {
  const m = new Array(toks.length).fill(-1), stack = [];
  toks.forEach((t, i) => {
    if (t.t !== 'punct') return;
    if (t.v === '(' || t.v === '[' || t.v === '{') stack.push(i);
    else if (t.v === ')' || t.v === ']' || t.v === '}') { const o = stack.pop(); m[o] = i; m[i] = o; }
  });
  return m;
}

// One module. `returns` maps 'module:function' to the path the function returns (from the first pass over every module).
function scan(file, mod, returns = {}, src = fs.readFileSync(path.join(ROOT, file), 'utf8')) {
  const tokens = tokenize(src), toks = tokens.filter((t) => t.t !== 'com');
  const allowed = new Set();
  for (const t of tokens) if (t.t === 'com' && /^\/\/ lint-allow: owner \S/.test(src.slice(t.s, t.e))) {
    allowed.add(src.slice(0, t.s).split('\n').length);
  }
  const lines = []; for (let i = 0, l = 1, k = 0; k < toks.length; k++) { for (; i < toks[k].s; i++) if (src[i] === '\n') l++; lines.push(l); }
  const lineOf = (i) => lines[i];
  const M = matches(toks);
  const hints = HINTS[mod] || {};
  let position = 0;
  const scopes = scopesOf(src, { fragment: mod === 'page' }), bind = scopes.bindings(() => position);
  const imported = new Map(); // name -> module key, from `const { a, b: c } = VB['m']`
  const writes = [], reads = [], rets = {};
  let locals = 0;
  const v = (i) => (toks[i] && (toks[i].t === 'punct' || toks[i].t === 'word') ? toks[i].v : null);
  const isWord = (i) => toks[i] && toks[i].t === 'word';
  const text = (a, b) => src.slice(toks[a].s, toks[b].e).replace(/\s+/g, ' ');
  const typeOfName = (n, pos) => {
    if (bind.get(n, pos) === 'unknown') return hints[n] || null; // bound by array destructuring: the convention does not hold
    if (bind.get(n, pos)) return bind.get(n, pos);
    return hints[n] || CONV[n] || null;
  };
  const returnOf = (n) => (rets[n] !== undefined ? rets[n] : imported.has(n) ? (returns[imported.get(n) + ':' + n] ?? null) : null);

  // the first token of the chain ending at token k (a word, or a closing bracket)
  function chainStart(k) {
    for (;;) {
      if (isWord(k)) {
        if (v(k - 1) === '.' || v(k - 1) === '?.') { k -= 2; continue; }
        return k;
      }
      if (v(k) === ']' || v(k) === ')') {
        const o = M[k], b = o - 1;
        const chained = (isWord(b) && !KEYWORDS.has(toks[b].v)) || v(b) === ']' || v(b) === ')';
        if (chained) { k = b; continue; }
        return o;
      }
      return k;
    }
  }
  // the end of the chain starting at token s
  function chainEnd(s) {
    let i = s;
    if (isWord(i)) i++; else if (v(i) === '[' || v(i) === '(') i = M[i] + 1; else return s - 1;
    for (;;) {
      if ((v(i) === '.' || v(i) === '?.') && isWord(i + 1)) i += 2;
      else if (v(i) === '[' || v(i) === '(') i = M[i] + 1;
      else return i - 1;
    }
  }
  // the steps of the chain from token s to token e: {root} | {spread} | {group}, then {field} | {index} | {call, args}
  function steps(s, e) {
    const out = []; let i = s;
    if (isWord(i)) { out.push({ root: toks[i].v, at: toks[i].s }); i++; }
    else if (v(i) === '[' && v(i + 1) === '...' && chainEnd(i + 2) === M[i] - 1) { out.push({ spread: [i + 2, M[i] - 1] }); i = M[i] + 1; }
    else if (v(i) === '(' || v(i) === '[') { out.push({ group: true }); i = M[i] + 1; }
    else return null;
    while (i <= e) {
      if ((v(i) === '.' || v(i) === '?.') && isWord(i + 1)) {
        if (v(i + 2) === '(') { out.push({ call: toks[i + 1].v, args: i + 2 }); i = M[i + 2] + 1; } else { out.push({ field: toks[i + 1].v }); i += 2; }
      } else if (v(i) === '[') {
        const prop = toks[i + 1];
        if (prop.t === 'str' && M[i] === i + 2 && /^[A-Za-z_$][\w$]*$/.test(src.slice(prop.s + 1, prop.e - 1))) {
          const name = src.slice(prop.s + 1, prop.e - 1), close = M[i];
          if (v(close + 1) === '(') { out.push({ call: name, args: close + 1 }); i = M[close + 1] + 1; continue; }
          out.push({ field: name });
        }
        else out.push({ index: true });
        i = M[i] + 1;
      }
      else if (v(i) === '(') { out.push({ call: null, args: i }); i = M[i] + 1; }
      else return null;
    }
    return out;
  }
  // a map callback with an expression body that is a chain: `(id) => st.pawns[id]` gives the collection of pawns
  function mapped(open) {
    const close = M[open]; let k = open + 1;
    if (v(k) === '(') k = M[k] + 1; else if (isWord(k)) k++; else return null;
    if (v(k) !== '=>') return null;
    const s = k + 1, e = chainEnd(s);
    if (e !== close - 1 && !(v(e + 1) === ',' )) return null;
    const p = pathOf(steps(s, e));
    return p && p !== 'local' ? '[]' + p : null;
  }
  function pathOf(st) {
    if (!st || !st.length) return null;
    let p, rest = st.slice(1);
    if (st[0].root !== undefined) {
      if (rest.length && rest[0].call === null) { p = returnOf(st[0].root); rest = rest.slice(1); }
      else p = typeOfName(st[0].root, st[0].at);
    } else if (st[0].spread) { const [a, b] = st[0].spread; p = pathOf(steps(a, b)); }
    else return null;
    return follow(p, rest);
  }
  function follow(p, rest) {
    if (p && p.includes('|')) return [...new Set(p.split('|').map((v) => follow(v, rest)))].filter((v) => v && v !== 'local').join('|') || 'local';
    for (const x of rest) {
      if (p === null || p === 'local') return p;
      if (x.field) p = canon(p + '.' + x.field);
      else if (x.index) p = element(p);
      else if (x.call && ELEMENT.has(x.call)) p = element(p);
      else if (x.call && COPY.has(x.call) && x.call !== 'map') p = '[]' + element(p); // a new array of the same records
      else if (x.call && KEEP.has(x.call)) { /* the same collection */ }
      else if (x.call === 'map') p = mapped(x.args);
      else return null;
    }
    return p;
  }
  const pathOfRange = (a, b) => (a > b ? null : chainStart(b) === a ? pathOf(steps(a, b)) : null);
  // the path of the expression starting at s: a literal is local; a chain followed by the end of the expression (or by || / ?? when `loose`)
  function exprPath(s, loose) {
    const t = toks[s];
    if (!t) return null;
    if (v(s) === '{' || (v(s) === '[' && v(s + 1) !== '...') || v(s) === 'new' || t.t === 'num' || t.t === 'str' || t.t === 'tpl') return 'local';
    const e = chainEnd(s), nx = v(e + 1);
    if (e < s) return null;
    if (loose && nx === '&&') return exprPath(e + 2, loose); // a && b is b when it matters
    const ends = nx === ';' || nx === ',' || nx === ')' || nx === '}' || nx === null || (loose && (nx === '||' || nx === '??')) ||
      (isWord(e + 1) && lineOf(e + 1) > lineOf(e));
    return ends ? pathOf(steps(s, e)) : null;
  }
  function addWrite(k, p, field, how, s) {
    if (p && p.includes('|')) { for (const v of p.split('|')) addWrite(k, v, field, how, s); return; }
    if (p === 'local') { locals++; return; }
    if (p === null || p === undefined) { writes.push({ path: null, name: field, line: lineOf(k), how, text: text(s, k) }); return; }
    writes.push({ path: field ? p + '.' + field : p, line: lineOf(k), how,
      site: toks.slice(s, k + 1).map((t) => src.slice(t.s, t.e)).join(' '), allowed: allowed.has(lineOf(k)) });
  }
  // a write whose lvalue chain ends at token k
  function lvalue(k, how) {
    const s = chainStart(k), parsed = steps(s, k);
    if (!parsed || (parsed[0].root && SKIP_ROOTS.has(parsed[0].root))) return;
    if (parsed[parsed.length - 1].index) {
      const receiver = pathOf(parsed.slice(0, -1));
      if (receiver && receiver.split('|').some((p) => ENTITIES.has(p))) { addWrite(k, receiver, '*', how, s); return; }
    }
    let st = parsed;
    while (st.length > 1 && st[st.length - 1].index) st = st.slice(0, -1); // an element write is a write of the array
    // a local record put into a collection of the state is that collection's record from here on: st.herds.push(herd)
    const whole = pathOf(st);
    if (whole && whole !== 'local' && (how === 'push' || how === 'set') && v(k + 3) === '(') {
      const arg = how === 'push' ? k + 4 : (() => {
        let q = k + 4; while (q < M[k + 3] && v(q) !== ',') q = v(q) === '(' || v(q) === '[' || v(q) === '{' ? M[q] + 1 : q + 1; return q + 1; })();
      if (isWord(arg) && bind.get(toks[arg].v) === 'local' && (v(arg + 1) === ')' || v(arg + 1) === ',')) bind.set(toks[arg].v, element(whole));
    }
    const last = st[st.length - 1];
    if (last.field && last.field !== 'length') { addWrite(k, pathOf(st.slice(0, -1)), last.field, how, s); return; }
    if (last.field === 'length') st = st.slice(0, -1);
    if (parsed.length === 1 && !MUTATORS.has(how)) return; // a variable assigned
    if (MUTATORS.has(how) && (st[0].spread || st.some((x) => x.call && COPY.has(x.call)))) return; // sorting a copy: [...hh.larder].sort()
    const p = pathOf(st);
    if (p && p.startsWith('[]') && MUTATORS.has(how)) return; // a copy: men.sort() where men = alive.filter(...)
    if (p && ENTITIES.has(p) && parsed.length > st.length && !last.field) { addWrite(k, p, '*', how, s); return; } // herd[k]--: a computed field
    addWrite(k, p, null, how, s);
    if (p === null) writes[writes.length - 1].name = st[0].root || null;
  }
  // the function each token is in: a stack of {name, end}
  const fstack = [];
  const starts = new Map(toks.map((t, i) => [t.s, i])), ends = new Map(toks.map((t, i) => [t.e, i]));
  const patterns = new Map(scopes.patterns.map((n) => [toks[ends.get(n.left.end) + 1].s, n]));
  const mutations = new Map(scopes.mutations.map((m) => [m.node.start, m]));
  const property = (p) => p.computed ? p.key.value : p.key.name ?? p.key.value;
  function patternWrite(node, from) {
    if (!node) return;
    if (node.type === 'MemberExpression') lvalue(ends.get(node.end), '=');
    else if (node.type === 'Identifier') bind.set(node.name, from);
    else if (node.type === 'AssignmentPattern') patternWrite(node.left, from);
    else if (node.type === 'RestElement') patternWrite(node.argument, 'local');
    else if (node.type === 'ArrayPattern') node.elements.forEach((n) => patternWrite(n, element(from)));
    else if (node.type === 'ObjectPattern') for (const p of node.properties) {
      if (p.type === 'RestElement') patternWrite(p, 'local');
      else patternWrite(p.value, !from || from === 'local' ? from : canon(from + '.' + (property(p) ?? '*')));
    }
  }
  function builtInWrite({ node, name }) {
    const target = node.arguments[0]; if (!target) return;
    const s = starts.get(target.start), k = ends.get(target.end), paths = pathOfRange(s, k);
    if (name === 'defineProperty' || name === 'set') {
      const key = node.arguments[1]; addWrite(k, paths, key?.type === 'Literal' ? String(key.value) : '*', name, s); return;
    }
    for (const p of paths ? paths.split('|') : [paths]) for (const source of node.arguments.slice(1)) {
      if (!ENTITIES.has(p)) { addWrite(k, p, null, name, s); continue; }
      if (source.type !== 'ObjectExpression') { addWrite(k, p, '*', name, s); continue; }
      for (const prop of source.properties) addWrite(k, p, prop.type === 'SpreadElement' ? '*' : property(prop) ?? '*', name, s);
    }
  }

  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]; position = t.s;
    if (mutations.has(t.s)) builtInWrite(mutations.get(t.s));
    if (patterns.has(t.s)) {
      const n = patterns.get(t.s); patternWrite(n.left, exprPath(starts.get(n.right.start), true));
    }
    while (fstack.length && i > fstack[fstack.length - 1].end) fstack.pop();
    // Imported return aliases; the AST pass below supplies the complete dependency list.
    if (t.t === 'word' && t.v === 'VB' && v(i - 1) !== '.') {
      let key = null, after = i;
      if (v(i + 1) === '[' && toks[i + 2].t === 'str') { key = src.slice(toks[i + 2].s + 1, toks[i + 2].e - 1); after = i + 3; }
      else if (v(i + 1) === '.' && isWord(i + 2)) { key = toks[i + 2].v; after = i + 2; }
      if (key && v(after + 1) !== '=') {
        const atLoad = fstack.length <= 1 && v(i - 1) === '=';
        if (atLoad && v(i - 2) === '}' ) {
          const o = M[i - 2]; for (let q = o + 1; q < i - 2; q++) if (isWord(q) && (v(q + 1) === ',' || v(q + 1) === '}')) imported.set(toks[q].v, key);
          else if (isWord(q) && v(q + 1) === ':') { imported.set(toks[q + 2].v, key); q += 2; } }
      }
    }
    // functions: function name(...) {, const name = (...) => {...} or => expression; parameters are bound by convention
    if (t.t === 'word' && t.v === 'function') {
      const named = isWord(i + 1), o = named ? i + 2 : i + 1;
      if (v(o) === '(') {
        for (let q = o + 1; q < M[o]; q++) if (isWord(q) && (v(q - 1) === '(' || v(q - 1) === ',')) bind.delete(toks[q].v);
        if (v(M[o] + 1) === '{') fstack.push({ name: named ? toks[i + 1].v : null, end: M[M[o] + 1] });
      }
    }
    if (t.t === 'punct' && t.v === '=>') {
      const params = [];
      let open = -1;
      if (v(i - 1) === ')') {
        open = M[i - 1]; for (let q = open + 1; q < i - 1; q++) if (isWord(q) && (v(q - 1) === '(' || v(q - 1) === ',')) params.push(toks[q].v); }
      else if (isWord(i - 1)) { open = i - 1; params.push(toks[i - 1].v); }
      const name = v(open - 1) === '=' && isWord(open - 2) && /^(const|let|var|,)$/.test(v(open - 3) || '') ? toks[open - 2].v : null;
      // a callback over a collection binds its element
      const call = v(open - 1) === '(' ? open - 1 : -1;
      const meth = call > 0 && isWord(call - 1) && v(call - 2) === '.' ? toks[call - 1].v : null;
      let el = null;
      if (meth && (CALLBACK.has(meth) || meth === 'reduce' || meth === 'sort')) el = element(pathOfRange(chainStart(call - 3), call - 3));
      params.forEach((n, x) => {
        const b = meth === 'reduce' ? (x === 1 ? el : null) : (meth === 'sort' || x === 0 ? el : null);
        if (b) bind.set(n, b); else bind.delete(n);
      });
      if (v(i + 1) === '{') fstack.push({ name, end: M[i + 1] });
      else if (name) { const p = exprPath(i + 1, true); if (p) rets[name] = p; }
    }
    if (t.t === 'word' && t.v === 'return' && fstack.length && fstack[fstack.length - 1].name) {
      const n = fstack[fstack.length - 1].name, p = exprPath(i + 1, true);
      if (p && (rets[n] === undefined || (rets[n] === 'local' && p !== 'local'))) rets[n] = p; // a path of the state over a literal
    }
    // declarations
    if (t.t === 'word' && (t.v === 'const' || t.v === 'let' || t.v === 'var')) {
      let k = i + 1;
      for (;;) {
        if (isWord(k) && v(k + 1) === '=') bind.set(toks[k].v, exprPath(k + 2, true));
        else if (isWord(k) && v(k + 1) === 'of' && v(i - 1) === '(' && v(i - 2) === 'for') {
          const e = M[i - 1] - 1, s0 = k + 2;
          bind.set(toks[k].v, chainStart(e) === s0 ? element(pathOf(steps(s0, e))) : null);
        } else if (v(k) === '{' && v(M[k] + 1) === '=') { // const { a, b: c } = chain
          const from = exprPath(M[k] + 2, true);
          for (let q = k + 1; q < M[k]; q++) {
            if (!isWord(q) || !(v(q - 1) === '{' || v(q - 1) === ',')) continue;
            const name = toks[q].v, as = v(q + 1) === ':' && isWord(q + 2) ? toks[q + 2].v : name;
            bind.set(as, from && from !== 'local' ? canon(from + '.' + name) : from);
            if (from && from !== 'local') reads.push({ path: from + '.' + name, line: lineOf(q) });
          }
        } else if (v(k) === '[' && (v(M[k] + 1) === '=' || v(M[k] + 1) === 'of')) {
          for (let q = k + 1; q < M[k]; q++) if (isWord(q)) bind.set(toks[q].v, 'unknown'); }
        let q = k; // the next declarator, if any
        while (q < toks.length && v(q) !== ',' && v(q) !== ';' && v(q) !== 'of' && v(q) !== ')' && v(q) !== '}') q = (v(q) === '(' || v(q) === '[' ||
          v(q) === '{') ? M[q] + 1 : q + 1;
        if (v(q) === ',') { k = q + 1; continue; }
        break;
      }
    }
    // writes
    if (t.t === 'punct' && ASSIGN.has(t.v) && (v(i - 1) === ']' || isWord(i - 1))) {
      const s = chainStart(i - 1), before = v(s - 1);
      if (t.v === '=' && s === i - 1 && isWord(s)) bind.set(toks[s].v, exprPath(i + 1, true));
      const declared = /^(const|let|var)$/.test(before || '') || (s === i - 1 && (before === ',' || before === '(' || before === '{'));
      if (!declared) {
        let how = t.v;
        if (t.v === '=' && text(i + 1, Math.min(i + 1 + (i - s), toks.length - 1)).startsWith(text(s, i - 1)) &&
          /\.filter\(/.test(src.slice(toks[i + 1].s, toks[chainEnd(i + 1)].e))) how = 'filter';
        lvalue(i - 1, how);
      }
    }
    if (t.t === 'punct' && (t.v === '++' || t.v === '--')) {
      if (v(i - 1) === ']' || (isWord(i - 1) && !KEYWORDS.has(v(i - 1)))) lvalue(i - 1, t.v);
      else if (isWord(i + 1)) lvalue(chainEnd(i + 1), t.v);
    }
    if (t.t === 'word' && t.v === 'delete' && v(i - 1) !== '.' && isWord(i + 1)) lvalue(chainEnd(i + 1), 'delete');
    if (t.t === 'word' && MUTATORS.has(t.v) && v(i - 1) === '.' && v(i + 1) === '(' && (isWord(i - 2) || v(i - 2) === ']' || v(i - 2) === ')')) lvalue(i - 2,
      t.v);
    if (t.t === 'str' && MUTATORS.has(src.slice(t.s + 1, t.e - 1)) && v(i - 1) === '[' && v(i + 1) === ']' && v(i + 2) === '(') {
      lvalue(i - 2, src.slice(t.s + 1, t.e - 1));
    }
    // reads: a field on a receiver that resolves
    if (t.t === 'word' && (v(i - 1) === '.' || v(i - 1) === '?.') && v(i + 1) !== '(') {
      const p = pathOfRange(chainStart(i - 2), i - 2);
      if (p && p !== 'local') for (const path of follow(p, [{ field: t.v }]).split('|')) reads.push({ path, line: lineOf(i) });
    }
  }
  return { file, mod, writes, reads, locals, deps: dependencies(scopes.tree, src, mod), rets };
}

// ---- assembling the report ----
const keyOf = (f) => f.replace(/\.js$/, '');
const order = manifest.map(keyOf);
const GEN = new Set(['gen', 'gen/rivers', 'gen/paths', 'gen/marks']); // the world generator: runs before the state exists
// a field: the entity and its first field (household.larder[].n -> household.larder)
const fieldOf = (p) => { const m = p.match(/^([A-Za-z]+)\.([A-Za-z_$*][\w$]*)/); return m ? `${m[1]}.${m[2]}` : p; };
const entityOf = (p) => p.split('.')[0];

// The ownership check needs only the simulation modules, without generator writes or page reads.
function build(sources = {}, { stateOnly = false } = {}) {
  const files = stateOnly ? manifest.filter((f) => f === 'culture.js' || f.startsWith('sim/')) : manifest;
  const first = files.map((f) => scan('src/' + f, keyOf(f), {}, sources['src/' + f]));
  const returns = {};
  for (const m of first) for (const [n, p] of Object.entries(m.rets)) returns[m.mod + ':' + n] = p;
  const mods = files.map((f) => scan('src/' + f, keyOf(f), returns, sources['src/' + f]));
  const pageFiles = stateOnly ? [] : JSON.parse(fs.readFileSync(path.join(ROOT, 'src/page.json'), 'utf8'));
  const pages = pageFiles.map((f) => scan('src/' + f, 'page', returns));
  const fields = new Map();
  const get = (f) => { if (!fields.has(f)) fields.set(f, { field: f, entity: entityOf(f), writes: [], readers: new Set() }); return fields.get(f); };
  const isState = (p) => p && p.includes('.') && ENTITIES.has(entityOf(p));
  for (const m of mods) {
    for (const w of m.writes) if (isState(w.path)) {
      const field = fieldOf(w.path);
      get(field).writes.push({ ...w, mod: m.mod, file: m.file, outsideOwner: !allowedWriter(field, m.mod) && !w.allowed });
    }
    for (const r of m.reads) if (isState(r.path)) get(fieldOf(r.path)).readers.add(m.mod);
  }
  for (const pg of pages) for (const r of pg.reads) if (isState(r.path)) get(fieldOf(r.path)).readers.add('page');
  const byOrder = (a, b) => (a === 'page') - (b === 'page') || order.indexOf(a) - order.indexOf(b);
  const list = [...fields.values()].map((f) =>
    ({ ...f, owner: ownerOf(f.field) || null, category: categoryOf(f.field),
      writers: [...new Set(f.writes.map((w) => w.mod))].sort(byOrder), readers: [...f.readers].sort(byOrder) }));
  // unresolved writes: listed when the name written is the name of a field of the state (else counted), outside the world generator
  const names = new Set(list.map((f) => f.field.split('.')[1]));
  for (const f of list) for (const w of f.writes) for (const n of w.path.split('.').slice(1)) names.add(n.replace('[]', ''));
  const unresolved = [], uncounted = {};
  for (const m of mods) for (const w of m.writes) {
    if (isState(w.path)) continue;
    const n = w.path ? w.path.split('.').pop() : w.name;
    if (!GEN.has(m.mod) && n && names.has(n.replace('[]', ''))) unresolved.push({ mod: m.mod, file: m.file, line: w.line, how: w.how, text: w.text || w.path });
    else uncounted[m.mod] = (uncounted[m.mod] || 0) + 1;
  }
  const locals = Object.fromEntries(mods.map((m) => [m.mod, m.locals]));
  // dependencies: imports at load and lookups inside functions; cycles from both
  const deps = mods.map((m) => {
    const own = order.indexOf(m.mod);
    const imports = [...new Set(m.deps.filter((d) => d.atLoad && d.key !== m.mod).map((d) => d.key))];
    const seen = new Set(), lookups = [];
    for (const d of m.deps) if (!d.atLoad && d.key !== m.mod && !seen.has(d.key + ':' + d.line + ':' + d.allowed)) {
      seen.add(d.key + ':' + d.line + ':' + d.allowed); lookups.push({ ...d, later: order.indexOf(d.key) > own }); }
    return { mod: m.mod, imports, importSites: m.deps.filter((d) => d.atLoad && d.key !== m.mod), lookups };
  });
  const edges = new Map(deps.map((d) => [d.mod, new Set([...d.imports, ...d.lookups.map((l) => l.key)].filter((k) => order.includes(k)))]));
  const idx = new Map(), low = new Map(), on = new Set(), stack = [], cycles = []; let n = 0; // Tarjan's strongly connected components
  const strong = (u) => {
    idx.set(u, n); low.set(u, n); n++; stack.push(u); on.add(u);
    for (const x of edges.get(u) || []) {
      if (!idx.has(x)) { strong(x); low.set(u, Math.min(low.get(u), low.get(x))); } else if (on.has(x)) low.set(u, Math.min(low.get(u), idx.get(x)));
    }
    if (low.get(u) === idx.get(u)) {
      const c = []; let x; do { x = stack.pop(); on.delete(x); c.push(x); } while (x !== u);
      if (c.length > 1) cycles.push(c.sort((a, b) => order.indexOf(a) - order.indexOf(b)));
    }
  };
  for (const k of order) if (!idx.has(k)) strong(k);
  // imports go only to modules loaded earlier, so every cycle runs through a lookup of a later module: from its target, the shortest way back
  const loops = [];
  for (const d of deps) for (const l of d.lookups.filter((x) => x.later)) {
    const prev = new Map([[l.key, null]]), queue = [l.key];
    while (queue.length && !prev.has(d.mod)) {
      const u = queue.shift(); for (const x of edges.get(u) || []) if (!prev.has(x)) { prev.set(x, u); queue.push(x); } }
    if (!prev.has(d.mod)) continue;
    const way = []; for (let x = d.mod; x !== null; x = prev.get(x)) way.unshift(x);
    loops.push({ from: d.mod, line: l.line, via: [d.mod, ...way] });
  }
  return { fields: list, unresolved, uncounted, locals, deps, cycles, loops };
}

const short = (m) => m.replace(/^sim\//, '');
const ENT_ORDER = ['st', 'w', 'pawn', 'household', 'farmstead', 'village', 'herd', 'job', 'agent', 'union', 'fence', 'claim', 'cenv', 'settlement', 'culture'];
function markdown(r) {
  const out = [];
  const written = r.fields.filter((f) => f.writes.length);
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  out.push(`Fields written: ${written.length}, of which ${written.filter((f) => f.writers.length > 1).length} by more than one module. ` +
    `Write sites: ${written.reduce((s, f) => s + f.writes.length, 0)} on the state; ${r.unresolved.length} unresolved (listed below); ` +
    `${sum(r.locals)} on local objects and ${sum(r.uncounted)} on other receivers not named like a state field (counted, not listed).`, '');
  for (const e of ENT_ORDER) {
    const fs0 = written.filter((f) => f.entity === e).sort((a, b) => b.writers.length - a.writers.length || a.field.localeCompare(b.field));
    if (!fs0.length) continue;
    out.push(`#### ${e}`, '', '| Field | Owner | Writers: lines (! past owner) | Other readers |', '| --- | --- | --- | --- |');
    for (const f of fs0) {
      const sites = f.writers.map((m) =>
        `${short(m)} ${[...new Set(f.writes.filter((w) => w.mod === m).map((w) => `${w.line}${w.outsideOwner ? '!' : ''}`))].join(',')}`).join('; ');
      const others = f.readers.filter((x) => !f.writers.includes(x)).map(short).join(', ') || '-';
      const owner = f.owner ? short(f.owner) + (f.category === 'cache' ? ' (cache)' : '') : '-';
      out.push(`| \`${f.field}\`${f.writers.length > 1 ? ` **${f.writers.length}**` : ''} | ${owner} | ${sites} | ${others} |`);
    }
    out.push('');
  }
  out.push('#### Dependencies', '', '| Module | Imports at load | Lookups inside functions (later: a module loaded after it) |', '| --- | --- | --- |');
  for (const d of r.deps) out.push(`| ${d.mod} | ${d.imports.map(short).join(', ') ||
    '-'} | ${d.lookups.map((l) => `${short(l.key)}:${l.line}${l.later ? ' (later)' : ''}`).join(', ') || '-'} |`);
  out.push('', `Strongly connected: ${r.cycles.length ? r.cycles.map((c) =>
    c.map(short).join(', ')).join('; ') : 'none'}. Each cycle, through a lookup of a later module:`, '');
  for (const l of r.loops) out.push(`- ${l.via.map(short).join(' → ')} (the lookup at ${l.from.replace(/^sim\//, '')}.js:${l.line})`);
  out.push('');
  out.push('#### Unresolved writes', '', '| Module | Line | How | Lvalue |', '| --- | --- | --- | --- |');
  for (const u of r.unresolved) out.push(`| ${u.mod} | ${u.line} | ${u.how} | \`${String(u.text).replace(/\|/g, '\\|').slice(0, 70)}\` |`);
  return out.join('\n');
}

if (require.main === module) {
  const args = process.argv.slice(2), r = build();
  const fi = args.indexOf('--field');
  if (fi >= 0) {
    const want = args[fi + 1];
    for (const f of r.fields) if (f.field === want || f.entity === want) for (const w of f.writes) {
      console.log(`${w.file}:${w.line}\t${w.how}\t${w.path}\towner: ${f.owner || '-'}${w.outsideOwner ? ' ! past owner' : ''}`);
    }
  } else if (args.includes('--json')) console.log(JSON.stringify(r, null, 1));
  else console.log(markdown(r));
}
module.exports = { build, markdown, scan, fieldOf, OWNERS, ownerOf, allowedWriter };
