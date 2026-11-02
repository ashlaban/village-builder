// Canonical text and hashes of state values, shared by tests/golden.js and tests/saves.js.
const crypto = require('crypto');
const sha = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);

// canonical text of a value: sorted keys, Maps/Sets in insertion order, typed arrays as arrays, back-references for shared objects
function canon(v, seen = new Map(), where = '$') {
  if (v === null || v === undefined) return String(v);
  if (typeof v === 'function') return 'fn';
  if (typeof v === 'number') return Number.isFinite(v) ? Number(v).toPrecision(12) : String(v);
  if (typeof v !== 'object') return JSON.stringify(v);
  if (seen.has(v)) return `&${seen.get(v)}`;
  seen.set(v, where);
  if (ArrayBuffer.isView(v)) return `[${Array.from(v, (x) => canon(x)).join(',')}]`;
  if (Array.isArray(v)) return `[${v.map((x, i) => canon(x, seen, `${where}[${i}]`)).join(',')}]`;
  if (v instanceof Map) return `Map{${[...v].map(([k, x], i) => `${canon(k, seen, `${where}.k${i}`)}=>${canon(x, seen, `${where}.v${i}`)}`).join(',')}}`;
  if (v instanceof Set) return `Set{${[...v].map((x, i) => canon(x, seen, `${where}.s${i}`)).join(',')}}`;
  return `{${Object.keys(v).sort().filter((k) => typeof v[k] !== 'function').map((k) => `${k}:${canon(v[k], seen, `${where}.${k}`)}`).join(',')}}`;
}
// one line per leaf: `pawns[41].household = 7`; shared objects print as back-references, as in canon
function leaves(v, where, seen, lines) {
  if (v === null || v === undefined || typeof v !== 'object') { lines.push(`${where} = ${canon(v)}`); return lines; }
  if (seen.has(v)) { lines.push(`${where} = &${seen.get(v)}`); return lines; }
  seen.set(v, where);
  if (Array.isArray(v) || ArrayBuffer.isView(v)) { if (!v.length) lines.push(`${where} = []`); v.forEach((x, i) => leaves(x, `${where}[${i}]`, seen, lines)); }
  else if (v instanceof Map) { if (!v.size) lines.push(`${where} = Map{}`); let i = 0; for (const [k, x] of v) { leaves(x, `${where}<${canon(k)}>`, seen, lines); i++; } }
  else if (v instanceof Set) { if (!v.size) lines.push(`${where} = Set{}`); let i = 0; for (const x of v) leaves(x, `${where}{${i++}}`, seen, lines); }
  else for (const k of Object.keys(v).sort()) if (typeof v[k] !== 'function') leaves(v[k], `${where}.${k}`, seen, lines);
  return lines;
}

module.exports = { sha, canon, leaves };
