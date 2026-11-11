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
      const dispatch = dynamic && mod === 'sim/commands' && fn === 'later' &&
        n.computed && n.property.name === 'key';
      if (!dispatch) out.push({ key: dynamic ? '*' : key, line: line(n), atLoad: depth <= 1,
        allowed: command, dynamic });
    }
    // Include the verb dispatcher in the graph rather than hiding its edges behind VB[key].
    if (mod === 'sim/commands' && n.type === 'CallExpression' && n.callee.name === 'later') {
      out.push({ key: n.arguments[0]?.value || '*', line: line(n), atLoad: false,
        allowed: true, dynamic: typeof n.arguments[0]?.value !== 'string' });
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
// `issue` (the command door). Composition roots are apart. `emit` and hook contributions join the exclusions as they land (VB-229).
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
module.exports = { dependencies, violations, loadLayers, missingLayers, upward };
if (require.main === module) {
  const { build } = require('./writes.js'), r = build(), up = upward(r.deps);
  const n = r.deps.reduce((t, d) => t + d.lookups.length + (d.importSites || []).length, 0);
  console.log(up.map((u) => u.text).join('\n') + `\n${up.length} upward of ${n} edges`);
}
