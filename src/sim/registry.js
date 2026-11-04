// @sys sim/registry: load-time rules and ordered contributions; hot values and checked explanations
VB['sim/registry'] = (() => {
  // Code, never saved state. Nothing may register once a simulation has been seeded or loaded.
  const rules = new Map();
  let sealed = false;
  function atLoad() { if (sealed) throw new Error('Rules may only be registered at load time'); }
  function ruleOf(id) {
    const rule = rules.get(id);
    if (!rule) throw new Error('Unknown rule: ' + id);
    return rule;
  }
  const text = (s) => typeof s === 'string' && s.length > 0;
  const range = (r) => Array.isArray(r) && r.length === 2 && r.every(Number.isFinite) && r[0] <= r[1];
  function declare(spec) {
    atLoad();
    if (!spec || !text(spec.id) || !text(spec.owner) || typeof spec.base !== 'function'
      || !['product', 'sum'].includes(spec.combine) || (spec.clamp !== undefined && !range(spec.clamp))) {
      throw new Error('Invalid rule specification');
    }
    if (rules.has(spec.id)) throw new Error('Duplicate rule: ' + spec.id);
    const copy = Object.freeze({ ...spec, clamp: spec.clamp ? Object.freeze([...spec.clamp]) : undefined });
    rules.set(spec.id, { spec: copy, contributions: [] });
  }
  function contribute(c) {
    atLoad();
    if (!c || !text(c.source) || !text(c.key) || !text(c.label) || typeof c.value !== 'function'
      || !range(c.range) || !Array.isArray(c.tunables) || !c.tunables.every(text)
      || (c.cause !== undefined && !text(c.cause))) throw new Error('Invalid rule contribution');
    const rule = ruleOf(c.rule);
    if (rule.contributions.some((p) => p.key === c.key)) throw new Error('Duplicate contribution: ' + c.key);
    rule.contributions.push(Object.freeze({ ...c, range: Object.freeze([...c.range]), tunables: Object.freeze([...c.tunables]) }));
  }
  function seal() {
    if (sealed) return;
    for (const rule of rules.values()) Object.freeze(rule.contributions);
    sealed = true;
  }
  const clamped = (n, bounds) => bounds ? Math.max(bounds[0], Math.min(bounds[1], n)) : n;
  // Diagnostics validate callbacks without adding checks to the simulation's hot value path.
  function checked(id, origin, n, bounds = null) {
    if (!Number.isFinite(n)) throw new Error(`Rule ${id}: ${origin} returned a non-finite number (${String(n)})`);
    if (bounds && (n < bounds[0] || n > bounds[1])) {
      throw new Error(`Rule ${id}: ${origin} returned ${n} outside [${bounds}]`);
    }
    return n;
  }
  function value(st, id, ctx) {
    VB.count.ruleValue++;
    const { spec, contributions } = ruleOf(id);
    let n = spec.base(st, ctx);
    // Fixed load-time order preserves floating-point evaluation; no array, object or callback is made here.
    if (spec.combine === 'product') {
      for (let i = 0; i < contributions.length; i++) n *= contributions[i].value(st, ctx);
    } else {
      for (let i = 0; i < contributions.length; i++) n += contributions[i].value(st, ctx);
    }
    return clamped(n, spec.clamp);
  }
  function explain(st, id, ctx) {
    const { spec, contributions } = ruleOf(id), parts = [];
    const base = checked(id, 'base (' + spec.owner + ')', spec.base(st, ctx));
    let n = base;
    for (const c of contributions) {
      const factor = checked(id, 'contribution ' + c.key + ' (' + c.source + ')', c.value(st, ctx), c.range);
      n = checked(id, 'combined value after ' + c.key, spec.combine === 'product' ? n * factor : n + factor);
      parts.push({ key: c.key, source: c.source, label: c.label, cause: c.cause, factor });
    }
    return { value: clamped(n, spec.clamp), base, parts, combine: spec.combine,
      unclamped: n, clamp: spec.clamp ? [...spec.clamp] : null };
  }
  function list() {
    return Object.freeze([...rules.values()].map(({ spec, contributions }) => Object.freeze({
      rule: spec.id, owner: spec.owner, combine: spec.combine, clamp: spec.clamp || null,
      contributions: Object.freeze(contributions.map(({ key, source, label, cause, range, tunables }) =>
        Object.freeze({ key, source, label, cause, range, tunables }))),
    })));
  }
  return { declare, contribute, value, explain, list, seal };
})();
