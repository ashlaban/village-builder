// Module edges for the writes map and dependency gate. Policy is separate from extraction so layers can replace load order. `node tools/dependencies.js` lists the upward calls by layer (VB-230; `src/layers.json`).
require('./help.js')(__filename);
function dependencies(tree, src, mod) {
  const out = [];
  const prop = (n) => n.computed ? n.property.value : n.property.name;
  const line = (n) => src.slice(0, n.start).split('\n').length;
  function walk(n, parent, depth = 0, fn = null) {
    if (!n || typeof n.type !== 'string') return;
    if (/^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(n.type)) {
      depth++;
      fn = n.id?.name || (parent?.type === 'VariableDeclarator' ? parent.id.name : null);
    }
    if (n.type === 'MemberExpression' && n.object.type === 'Identifier' && n.object.name === 'VB' &&
      !(parent?.type === 'AssignmentExpression' && parent.left === n)) {
      const key = prop(n), dynamic = typeof key !== 'string';
      const command = key === 'sim/commands' && parent?.type === 'MemberExpression' &&
        parent.object === n && prop(parent) === 'issue';
      out.push({ key: dynamic ? '*' : key, line: line(n), atLoad: depth <= 1,
        allowed: command, dynamic });
    }
    for (const child of Object.values(n)) {
      if (Array.isArray(child)) child.forEach((c) => walk(c, n, depth, fn));
      else if (child && typeof child.type === 'string') walk(child, n, depth, fn);
    }
  }
  walk(tree, null);
  return out;
}

function violations(deps) {
  const errors = [];
  for (const d of deps) {
    for (const l of d.importSites || []) if (l.dynamic) {
      errors.push(`src/${d.mod}.js:${l.line} forbidden lookup of dynamic module`);
    }
    for (const key of d.imports) if (deps.findIndex((m) => m.mod === key) > deps.indexOf(d)) {
      const line = d.importSites?.find((s) => s.key === key)?.line || 1;
      errors.push(`src/${d.mod}.js:${line} import of later module ${key}`);
    }
    for (const l of d.lookups) if (l.dynamic || l.later && !l.allowed) {
      errors.push(`src/${d.mod}.js:${l.line} forbidden lookup of ${l.dynamic ? 'dynamic module' : l.key}`);
    }
  }
  return errors;
}

// VB-230: the layer rule (target-v2 3.1). Calls go downward; a module of a lower layer naming a higher one is an upward call, unless it is
// `issue` (the command door). Composition roots are apart. `emit` needs no exclusion: it is a call down into `sim/events` (VB-229); hook contributions join the exclusions as they land.
const fs = require('fs'), path = require('path');
function loadLayers() {
  const l = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'layers.json'), 'utf8'));
  const of = {};
  l.layers.forEach((name, i) => (l.modules[name] || []).forEach((m) => { of[m] = i; }));
  return { names: l.layers, roots: l.roots, of };
}
function missingLayers(mods, L = loadLayers()) {
  return mods.filter((m) => L.of[m] === undefined && !L.roots.includes(m)).map((m) => `${m} has no layer in src/layers.json`);
}
// Upward edges as {from, to, line, kind}; deps is the list of {mod, importSites, lookups}.
function upward(deps, L = loadLayers()) {
  const out = [];
  for (const d of deps) {
    const a = L.of[d.mod];
    if (a === undefined) continue;
    const edges = [...(d.importSites || []).map((s) => ({ ...s, kind: 'import' })), ...d.lookups.map((s) => ({ ...s, kind: 'lookup' }))];
    for (const e of edges) {
      const b = L.of[e.key];
      if (e.allowed || b === undefined || b <= a) continue;
      out.push({ from: d.mod, to: e.key, line: e.line, kind: e.kind, text: `src/${d.mod}.js:${e.line} ${L.names[a]} -> ${L.names[b]}: ${e.key}` });
    }
  }
  return out;
}
// VB-1686: no decision reads an unrealised draw. The fields tagged `// @drawn FIELD (what): NAME, ...` beside their `@state`, each NAME an
// export of the tagging module that reads the draw raw, or `.prop`, a property of the state itself. drawnTags(files) parses the tags from
// [{mod, src}]; drawnReads(tree, src, mod, tags) lists where module mod names one: [{owner, name, line, text}] (the policy, who may, is the
// caller's: tests/dependencies.js). A line ending `// drawn-allow: <reason>` is exempt: a read of what has fallen by now, in a module that
// is not a natural process.
function drawnTags(files) {
  const tags = [];
  for (const { mod, src } of files)
    for (const m of src.matchAll(/^\s*\/\/ @drawn (\S+)[^:\n]*:\s*([^\n]+)$/gm))
      tags.push({ owner: mod, field: m[1], names: m[2].split(',').map((x) => x.trim()).filter(Boolean) });
  return tags;
}
function drawnReads(tree, src, mod, tags) {
  const out = [], line = (n) => src.slice(0, n.start).split('\n').length;
  const key = (n) => (n.computed ? (n.property.type === 'Literal' ? n.property.value : null) : n.property.name);
  const ownerOf = (n, alias) => {
    if (!n) return null;
    if (n.type === 'MemberExpression' && n.object.type === 'Identifier' && n.object.name === 'VB') return key(n);
    return n.type === 'Identifier' && alias.has(n.name) ? alias.get(n.name) : null;
  };
  const lines = src.split('\n'), allowed = (n) => /\/\/ drawn-allow: \S/.test(lines[line(n) - 1] || '');
  const alias = new Map(), taken = new WeakSet(), found = (owner, name, n) => {
    if (allowed(n)) return;
    for (const t of tags)
      if (t.owner !== mod && (name.startsWith('.') ? t.names.includes(name) : t.owner === owner && t.names.includes(name)))
        out.push({ owner: t.owner, name, line: line(n), text: `src/${mod}.js:${line(n)} reads ${t.field}'s draw (${name}, ${t.owner})` });
  };
  function walk(n) {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'VariableDeclarator' && n.init) {
      const o = ownerOf(n.init, alias);
      if (o && n.id.type === 'Identifier') alias.set(n.id.name, o);
      if (o && n.id.type === 'ObjectPattern') {
        taken.add(n.id);
        for (const p of n.id.properties) if (p.type === 'Property' && !p.computed) found(o, p.key.name, p);
      }
    }
    if (n.type === 'ObjectPattern' && !taken.has(n))
      for (const p of n.properties) if (p.type === 'Property' && !p.computed && p.key.type === 'Identifier') found(null, '.' + p.key.name, p);
    if (n.type === 'MemberExpression') {
      const k = key(n), o = ownerOf(n.object, alias);
      if (typeof k === 'string') found(o, o ? k : '.' + k, n);
    }
    for (const child of Object.values(n)) {
      if (Array.isArray(child)) child.forEach(walk);
      else if (child && typeof child.type === 'string') walk(child);
    }
  }
  walk(tree);
  return out;
}
module.exports = { dependencies, violations, loadLayers, missingLayers, upward, drawnTags, drawnReads };
if (require.main === module) {
  const { build } = require('./writes.js'), r = build(), up = upward(r.deps);
  const n = r.deps.reduce((t, d) => t + d.lookups.length + (d.importSites || []).length, 0);
  console.log(up.map((u) => u.text).join('\n') + `\n${up.length} upward of ${n} edges`);
}
