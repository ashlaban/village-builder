// The module map (VB-1941): every module of src/manifest.json by layer, in load order, with the purpose its first line gives
// (`// @sys key [layer]: purpose`); the composition roots, which have no layer, after them. Read from the `@sys` lines alone, so nothing
// is kept by hand: docs/architecture/modules.md points here instead of listing the modules.
// node tools/modules.js                 the map, a heading a layer, a line a module
// node tools/modules.js --layer NAME    one layer only (kernel, material, social, agency, derived, presentation, or roots)
// node tools/modules.js --json          [{key, layer, purpose, file}], in load order
require('./help.js')(__filename);
const fs = require('fs'), path = require('path'), { readSource } = require('./lib/source.js'), { sysLines } = require('./dependencies.js');

function map() {
  const L = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'layers.json'), 'utf8'));
  const rows = sysLines().map((s) => {
    const head = readSource(s.file).split('\n', 1)[0];
    return { key: s.key, layer: s.layer || (L.roots.includes(s.key) ? 'roots' : null), purpose: head.slice(head.indexOf(': ') + 2), file: s.file };
  });
  return { order: [...L.layers, 'roots'], rows };
}
function markdown({ order, rows }, only = null) {
  const out = [];
  for (const layer of order) {
    if (only && layer !== only) continue;
    const of = rows.filter((r) => r.layer === layer);
    out.push(`## ${layer} (${of.length})`, '', ...of.map((r) => `- \`${r.key}\`: ${r.purpose}`), '');
  }
  return out.join('\n');
}
module.exports = { map, markdown };
if (require.main === module) {
  const m = map(), at = process.argv.indexOf('--layer'), only = at > 0 ? process.argv[at + 1] : null;
  if (process.argv.includes('--json')) console.log(JSON.stringify(m.rows.filter((r) => !only || r.layer === only), null, 1));
  else console.log(markdown(m, only));
}
