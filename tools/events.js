// Every event kind of `sim/events` with its emitters and subscribers (VB-229), found in the sources: `emit(st, 'kind', ...)` and `on('kind', ...)`.
// node tools/events.js [--json]
require('./help.js')(__filename);
const fs = require('fs'), path = require('path');
function scan(root = path.join(__dirname, '..', 'src')) {
  const kinds = {}, files = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) =>
    (e.isDirectory() ? walk(path.join(d, e.name)) : /\.js$/.test(e.name) && files.push(path.join(d, e.name))));
  walk(root);
  for (const f of files.sort()) {
    const mod = path.relative(root, f).replace(/\.js$/, ''), src = fs.readFileSync(f, 'utf8');
    if (mod === 'sim/events') continue;
    const add = (kind, how, i) => {
      const k = kinds[kind] || (kinds[kind] = { emitters: [], subscribers: [] });
      k[how].push(`${mod}:${src.slice(0, i).split('\n').length}`);
    };
    for (const m of src.matchAll(/\bemit\(\s*st\s*,\s*'([A-Za-z]+)'/g)) add(m[1], 'emitters', m.index);
    for (const m of src.matchAll(/(?<![.\w])on\(\s*'([A-Za-z]+)'/g)) add(m[1], 'subscribers', m.index);
  }
  return kinds;
}
// Kinds with no subscriber, and kinds subscribed to that nothing emits.
function problems(kinds) {
  const out = [];
  for (const [k, v] of Object.entries(kinds)) {
    if (!v.subscribers.length) out.push(`event ${k} is emitted (${v.emitters.join(', ')}) and nothing subscribes`);
    if (!v.emitters.length) out.push(`event ${k} is subscribed to (${v.subscribers.join(', ')}) and nothing emits it`);
  }
  return out;
}
module.exports = { scan, problems };
if (require.main === module) {
  const kinds = scan();
  if (process.argv.includes('--json')) console.log(JSON.stringify(kinds, null, 1));
  else for (const [k, v] of Object.entries(kinds)) console.log(`${k}\n  emitted by: ${v.emitters.join(', ') || '-'}\n  subscribed by: ${v.subscribers.join(', ') || '-'}`);
}
