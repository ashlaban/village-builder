// Validate the data-only ownership policy before any write is allowed or exempted.
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
function validateOwners(policy, { modules, entities }) {
  const errors = [], fail = (msg) => errors.push(`src/owners.json: ${msg}`);
  if (!object(policy)) return ['src/owners.json: expected an object'];
  const keys = new Set(['fields', 'creators', 'exempt', 'plannedOwners']);
  for (const key of Object.keys(policy)) if (!keys.has(key)) fail(`unknown key ${key}`);
  const planned = new Set();
  for (const key of ['creators', 'exempt', 'plannedOwners']) {
    const list = policy[key];
    if (!Array.isArray(list)) { fail(`${key} must be an array of module names`); continue; }
    const seen = new Set();
    for (const name of list) {
      if (typeof name !== 'string' || !/^[a-z][a-z0-9-]*(\/[a-z][a-z0-9-]*)*$/.test(name)) { fail(`${key}: invalid module ${JSON.stringify(name)}`); continue; }
      if (seen.has(name)) fail(`${key}: duplicate module ${name}`);
      seen.add(name);
      if (key === 'plannedOwners') {
        if (modules.has(name)) fail(`${name} already exists; remove it from plannedOwners`);
        planned.add(name);
      } else if (!modules.has(name)) fail(`${key}: unknown module ${name}`);
    }
  }
  if (!object(policy.fields) || !Object.keys(policy.fields).length) { fail('fields must be a nonempty object'); return errors; }
  for (const [field, spec] of Object.entries(policy.fields)) {
    if (!/^[A-Za-z]+\.[A-Za-z_$][\w$]*$/.test(field) || !entities.has(field.split('.')[0])) fail(`invalid field ${field}`);
    let owner = spec;
    if (object(spec)) {
      owner = spec.owner;
      for (const key of Object.keys(spec)) if (!['owner', 'category'].includes(key)) fail(`${field}: unknown key ${key}`);
      if (!['field', 'cache'].includes(spec.category)) fail(`${field}: category must be field or cache`);
    } else if (typeof spec !== 'string' || !spec) fail(`${field}: expected an owner name or {owner, category}`);
    if (owner === 'signal' && typeof spec === 'string') continue;
    if (typeof owner !== 'string' || (!modules.has(owner) && !planned.has(owner))) fail(`${field}: unknown or missing owner ${JSON.stringify(owner)}`);
  }
  return errors;
}
module.exports = { validateOwners };
