// VB-173: only an owned field's owner writes it. --update removes fixed sites; it never adds allowances.
// The baseline groups sites by field, then by module, operation and tokenized receiver (independent of line numbers).
const fs = require('fs'), path = require('path');
const { build, OWNERS, ownerOf, allowedWriter, fieldOf } = require('../tools/writes.js');
const BASE = path.join(__dirname, 'ownership-baseline.json'), UNRESOLVED = path.join(__dirname, 'unresolved-baseline.json');
const inScope = (mod) => mod === 'culture' || mod.startsWith('sim/');
function violations(writes) {
  return writes.flatMap((w) => {
    const field = fieldOf(w.path), fields = field.endsWith('.*') ?
      Object.keys(OWNERS.fields).filter((f) => f.startsWith(field.slice(0, -1))) : [field];
    return fields.filter((f) => inScope(w.mod) && !w.allowed && !allowedWriter(f, w.mod)).map((f) => ({ ...w, field: f }));
  });
}
const signature = (w) => `${w.mod} ${w.how} ${w.site}`;
function collect(writes) {
  const counts = {};
  for (const w of violations(writes)) {
    const f = w.field, sites = counts[f] || (counts[f] = {}), k = signature(w);
    sites[k] = (sites[k] || 0) + 1;
  }
  return Object.fromEntries(Object.keys(counts).sort().map((f) => [f,
    Object.fromEntries(Object.entries(counts[f]).sort(([a], [b]) => a.localeCompare(b)))]));
}
function audit(writes, baseline, { update = false } = {}) {
  const errors = [], seen = {};
  for (const [f, sites] of Object.entries(baseline)) {
    if (!ownerOf(f)) errors.push(`src/owners.json: baseline field ${f} has no owner`);
    for (const [k, n] of Object.entries(sites)) if (!Number.isInteger(n) || n <= 0) errors.push(`${f}: invalid baseline count for ${k}`);
  }
  for (const w of violations(writes)) {
    const f = w.field, k = signature(w), sites = seen[f] || (seen[f] = {});
    sites[k] = (sites[k] || 0) + 1;
    if (sites[k] > (baseline[f]?.[k] || 0)) {
      errors.push(`${w.file}:${w.line} ${w.how} writes ${f} (${w.path}) outside owner ${ownerOf(f)} in ${w.mod}`);
    }
  }
  if (!update) for (const [f, sites] of Object.entries(baseline)) for (const [k, n] of Object.entries(sites)) {
    if ((seen[f]?.[k] || 0) < n) errors.push(`${f}: stale baseline allowance for ${k}; run node tests/ownership.js --update`);
  }
  return errors;
}
// Writes the scan cannot place (a name of a state field written through a receiver it cannot follow) are not checked against the owners:
// each must be placed or be in the baseline (`mod how text`: count; --update only removes entries). Keep a reason beside any entry kept
// (the file holds only counts; the reason for an entry kept goes in a comment of the task file).
const usig = (u) => `${u.mod} ${u.how} ${u.text}`;
function auditUnresolved(list, baseline, { update = false } = {}) {
  const errors = [], seen = {};
  for (const u of list) {
    const k = usig(u); seen[k] = (seen[k] || 0) + 1;
    if (seen[k] > (baseline[k] || 0)) errors.push(`${u.file}:${u.line} unplaced write \`${u.text}\` (${u.how}): the scan cannot tell which record it writes, ` +
      `so the owner check does not see it; place it: declare the receiver from the state (const x = st.<collection>[i]), use a conventional name ` +
      `(hh, p, f, v, a, ...), or add a hint for the name in HINTS of tools/writes.js ('local' for a scratch object)`);
  }
  if (!update) for (const [k, n] of Object.entries(baseline)) if ((seen[k] || 0) < n) errors.push(`stale unresolved baseline entry ${k}; run node tests/ownership.js --update`);
  return errors;
}
function main() {
  const started = performance.now(), report = build({}, { stateOnly: true }), writes = report.fields.flatMap((f) => f.writes);
  const baseline = JSON.parse(fs.readFileSync(BASE, 'utf8')), update = process.argv.includes('--update');
  const ub = JSON.parse(fs.readFileSync(UNRESOLVED, 'utf8')), errors = audit(writes, baseline, { update }).concat(auditUnresolved(report.unresolved, ub, { update }));
  if (errors.length) { console.error('OWNERSHIP FAIL:\n  ' + errors.join('\n  ')); process.exitCode = 1; return; }
  const current = collect(writes);
  if (update) {
    fs.writeFileSync(BASE, JSON.stringify(current, null, 2) + '\n');
    const kept = {}; for (const u of report.unresolved) { const k = usig(u); if (ub[k] && (kept[k] || 0) < ub[k]) kept[k] = (kept[k] || 0) + 1; }
    fs.writeFileSync(UNRESOLVED, JSON.stringify(kept, null, 2) + '\n');
  }
  const count = Object.values(current).reduce((n, sites) => n + Object.values(sites).reduce((a, b) => a + b, 0), 0);
  console.log(`ownership ok: ${Object.keys(OWNERS.fields).length} owned fields/signals, ${count} baselined writes ` +
    `(${Math.round(performance.now() - started)} ms)${process.argv.includes('--update') ? '; baseline lowered' : ''}`);
}
if (require.main === module) main();
module.exports = { collect, audit, auditUnresolved };
