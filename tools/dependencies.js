// Module edges for the writes map and dependency gate. Policy is separate from extraction so layers can replace load order.
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
module.exports = { dependencies, violations };
