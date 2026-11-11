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
      || (spec.baseCause !== undefined && typeof spec.baseCause !== 'function')
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
      if (spec.baseCause) { // a rule that names causes: a product of factors that never fall below 1, each naming its cause
        if (spec.combine !== 'product') throw new Error(`Rule ${spec.id}: causes need a product rule`);
        for (const c of contributions) {
          if (c.range[0] < 1) throw new Error(`Rule ${spec.id}: ${c.key} may fall below 1, so its share of a draw is undefined`);
          if (!c.cause) throw new Error(`Rule ${spec.id}: ${c.key} names no cause`);
        }
      }
      if (spec.order) { // the declared order puts the keys it names first, in its order; others follow as registered (a module may add a term)
        const keys = contributions.map((c) => c.key);
        if (!spec.order.every((k) => keys.includes(k)) || new Set(spec.order).size !== spec.order.length) {
          throw new Error(`Rule ${spec.id}: order [${spec.order}] names a key that is not a contribution [${keys}]`);
        }
        const at = (c) => { const i = spec.order.indexOf(c.key); return i < 0 ? spec.order.length : i; };
        contributions.sort((a, b) => at(a) - at(b));
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
  // The cause of one draw u against a product rule with causes (VB-207): null when u is not below the value, else the cause of the part of
  // the hazard u falls in. Below the base it is the owner's (spec.baseCause); above it the excess is shared among the contributions in
  // proportion to the logarithm of each factor, so a share never depends on the order of registering. Allocates nothing; the factors are
  // read again, with their logarithms, only when a draw is below the value, that is when someone dies.
  function draw(st, id, ctx, u) {
    VB.count.ruleValue++;
    const { spec, contributions } = ruleOf(id);
    if (!spec.baseCause) throw new Error(`Rule ${id} names no causes`);
    const base = spec.base(st, ctx);
    let n = base, logs = 0;
    for (let i = 0; i < contributions.length; i++) n *= contributions[i].value(st, ctx);
    if (spec.clamp) n = clamped(n, spec.clamp);
    if (!(u < n)) return null;
    if (u < base) return spec.baseCause(st, ctx);
    for (let i = 0; i < contributions.length; i++) logs += Math.log(contributions[i].value(st, ctx));
    const excess = n - base;
    let upto = base, last = null;
    for (let i = 0; i < contributions.length; i++) {
      const l = Math.log(contributions[i].value(st, ctx));
      if (l <= 0) continue;
      last = contributions[i].cause; upto += excess * l / logs;
      if (u < upto) return last;
    }
    return last; // rounding at the top of the last share
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
    if (spec.baseCause) { // each part's share of the value above the base, by the logarithm of its factor (the split draw() uses)
      let logs = 0;
      for (const part of parts) logs += Math.log(part.factor);
      for (const part of parts) part.share = logs > 0 ? (n - base) * Math.log(part.factor) / logs : 0;
    }
    return { value: clamped(n, spec.clamp), base, baseCause: spec.baseCause ? spec.baseCause(st, ctx) : undefined, parts, combine: spec.combine,
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
  return { declare, contribute, value, draw, explain, list, seal, atLoad };
})();
