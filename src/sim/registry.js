// @sys sim/registry: load-time rules and ordered contributions; hot values and checked explanations
VB['sim/registry'] = (() => {
  // Code, never saved state. Nothing may register once a simulation has been seeded or loaded.
  const rules = new Map();
  // Contributions to a rule not yet declared wait here (a module loading before the rule's owner registers its own terms).
  const waiting = new Map();
  let sealed = false;
  function atLoad() { if (sealed) throw new Error('Rules may only be registered at load time'); }
  function ruleOf(id) {
    const rule = rules.get(id);
    if (!rule) throw new Error('Unknown rule: ' + id);
    return rule;
  }
  const text = (s) => typeof s === 'string' && s.length > 0;
  const range = (r) => Array.isArray(r) && r.length === 2 && r.every(Number.isFinite) && r[0] <= r[1];
  // A clamp may be open on one side (Infinity); a contribution's range, when it has one, is finite.
  const clampOf = (r) => Array.isArray(r) && r.length === 2 && r.every((x) => typeof x === 'number' && !Number.isNaN(x)) && r[0] <= r[1];
  const needsRange = (rule, c) => { if (rule.spec.combine === 'product' && !c.range) throw new Error('A product rule needs a range for ' + c.key); };
  function declare(spec) {
    atLoad();
    if (!spec || !text(spec.id) || !text(spec.owner) || typeof spec.base !== 'function'
      || !['product', 'sum'].includes(spec.combine) || (spec.clamp !== undefined && !clampOf(spec.clamp))
      || (spec.order !== undefined && !(Array.isArray(spec.order) && spec.order.every(text)))) {
      throw new Error('Invalid rule specification');
    }
    if (rules.has(spec.id)) throw new Error('Duplicate rule: ' + spec.id);
    const copy = Object.freeze({ ...spec, clamp: spec.clamp ? Object.freeze([...spec.clamp]) : undefined,
      order: spec.order ? Object.freeze([...spec.order]) : undefined });
    const rule = { spec: copy, contributions: [] };
    rules.set(spec.id, rule);
    for (const c of waiting.get(spec.id) || []) attach(rule, c);
    waiting.delete(spec.id);
  }
  function contribute(c) {
    atLoad();
    if (!c || !text(c.source) || !text(c.key) || !text(c.label) || typeof c.value !== 'function'
      || (c.range !== undefined && !range(c.range)) || !Array.isArray(c.tunables) || !c.tunables.every(text)
      || (c.cause !== undefined && !text(c.cause))) throw new Error('Invalid rule contribution');
    const frozen = Object.freeze({ ...c, range: c.range ? Object.freeze([...c.range]) : undefined, tunables: Object.freeze([...c.tunables]) });
    const rule = rules.get(c.rule);
    if (rule) return attach(rule, frozen);
    if (!text(c.rule)) throw new Error('Invalid rule contribution');
    const list = waiting.get(c.rule) || [];
    if (list.some((p) => p.key === c.key)) throw new Error('Duplicate contribution: ' + c.key);
    waiting.set(c.rule, list); list.push(frozen);
  }
  function attach(rule, c) {
    needsRange(rule, c);
    if (rule.contributions.some((p) => p.key === c.key)) throw new Error('Duplicate contribution: ' + c.key);
    rule.contributions.push(c);
  }
  function seal() {
    if (sealed) return;
    if (waiting.size) throw new Error('Contributions to rules never declared: ' + [...waiting.keys()].join(', '));
    for (const { spec, contributions } of rules.values()) {
      if (spec.order) { // the declared order names every contribution's key once; it overrides the order registered
        const keys = contributions.map((c) => c.key);
        if (spec.order.length !== keys.length || !keys.every((k) => spec.order.includes(k)) || new Set(spec.order).size !== keys.length) {
          throw new Error(`Rule ${spec.id}: order [${spec.order}] does not name its contributions [${keys}]`);
        }
        contributions.sort((a, b) => spec.order.indexOf(a.key) - spec.order.indexOf(b.key));
      }
      Object.freeze(contributions);
    }
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
      const factor = checked(id, 'contribution ' + c.key + ' (' + c.source + ')', c.value(st, ctx), c.range || null);
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
        Object.freeze({ key, source, label, cause, range: range || null, tunables }))),
    })));
  }
  // atLoad: other load-time tables (sim/stores' goods) close with the rules.
  return { declare, contribute, value, explain, list, seal, atLoad };
})();
