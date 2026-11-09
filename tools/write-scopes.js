// Lexical bindings for the writes scanner. Acorn supplies real block/function/loop boundaries and binding patterns.
require('./help.js')(__filename);
const { parse } = require('acorn');
function scopesOf(src, { fragment = false } = {}) {
  // Page files are fragments of the built async closure, so return and await can occur at their apparent top level.
  const tree = parse(src, { ecmaVersion: 'latest', sourceType: 'script',
    allowReturnOutsideFunction: fragment, allowAwaitOutsideFunction: fragment });
  const root = { start: 0, end: src.length + 1, parent: null, function: true, names: new Map(), children: [] };
  const patterns = [], mutations = [], assignments = [];
  function scope(node, parent, fn = false) {
    const s = { start: node.start, end: node.end, parent, function: fn, names: new Map(), children: [] };
    parent.children.push(s); return s;
  }
  function declare(node, s) {
    if (!node) return;
    if (node.type === 'Identifier') s.names.set(node.name, undefined);
    else if (node.type === 'RestElement') declare(node.argument, s);
    else if (node.type === 'AssignmentPattern') declare(node.left, s);
    else if (node.type === 'ObjectPattern') node.properties.forEach((p) => declare(p.value || p.argument, s));
    else if (node.type === 'ArrayPattern') node.elements.forEach((p) => declare(p, s));
  }
  function walk(node, s, conditional = false) {
    if (!node || typeof node.type !== 'string') return;
    if (/^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(node.type)) {
      if (node.type === 'FunctionDeclaration') declare(node.id, s);
      s = scope(node, s, true);
      conditional = false;
      declare(node.id, s); node.params.forEach((p) => declare(p, s));
    } else if (/^(BlockStatement|ForStatement|ForOfStatement|ForInStatement|SwitchStatement|CatchClause)$/.test(node.type)) {
      s = scope(node, s);
      if (node.type === 'CatchClause') declare(node.param, s);
    }
    if (node.type === 'VariableDeclaration') {
      let dest = s; if (node.kind === 'var') while (!dest.function) dest = dest.parent;
      node.declarations.forEach((d) => declare(d.id, dest));
    }
    if (node.type === 'AssignmentExpression' && /Pattern$/.test(node.left.type)) patterns.push(node);
    if (node.type === 'AssignmentExpression' && node.operator === '=') assignments.push({ node, conditional });
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
      const c = node.callee, name = c.computed ? c.property.value : c.property.name;
      if ((c.object.name === 'Object' && ['assign', 'defineProperty', 'defineProperties'].includes(name)) ||
        (c.object.name === 'Reflect' && name === 'set')) mutations.push({ node, name });
    }
    const branch = conditional || /^(IfStatement|ConditionalExpression|LogicalExpression|ForStatement|ForOfStatement|ForInStatement|WhileStatement|DoWhileStatement|SwitchStatement|TryStatement)$/.test(node.type);
    for (const [k, child] of Object.entries(node)) {
      if (k === 'start' || k === 'end' || k === 'type') continue;
      if (Array.isArray(child)) child.forEach((c) => walk(c, s, branch)); else walk(child, s, branch);
    }
  }
  walk(tree, root);
  function at(pos, s = root) {
    for (const c of s.children) if (c.start <= pos && pos < c.end) return at(pos, c);
    return s;
  }
  function binding(name, pos) {
    for (let s = at(pos); s; s = s.parent) if (s.names.has(name)) return s;
    return root;
  }
  const fnOf = (s) => { while (!s.function) s = s.parent; return s; };
  function set(name, value, pos) {
    const s = binding(name, pos), a = assignments.find(({ node }) => node.left.end <= pos && pos < node.right.start);
    // A branch may not run, and a closure may run later. Retain every known state target in those cases.
    if (a && (a.conditional || fnOf(s) !== fnOf(at(pos)))) {
      const paths = [s.names.get(name), value].filter((p) => typeof p === 'string' && p !== 'local' && p !== 'unknown');
      if (paths.length) value = [...new Set(paths.flatMap((p) => p.split('|')))].join('|');
    }
    s.names.set(name, value);
  }
  return {
    tree, patterns, mutations,
    bindings(position) {
      return {
        get: (n, pos = position()) => binding(n, pos).names.get(n),
        set: (n, value) => set(n, value, position()),
        delete: (n) => binding(n, position()).names.set(n, undefined),
      };
    },
  };
}
module.exports = { scopesOf };
