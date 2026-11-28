// The page with roads.js in place of draw/paths' own trail curves, for mode 'A' or 'B' (null: the page as it is).
const fs = require('fs'), path = require('path');
function patch(html, mode) {
  if (!mode) return html;
  const src = fs.readFileSync(path.join(__dirname, 'roads.js'), 'utf8');
  const HOOKS = [
    ['function segments(w, i) {', 'function segments(w, i) { if (window.__roadMode) return window.__roadsSeg(w, i); return segments0(w, i); }\n  function segments0(w, i) {'],
    [/function thin\(w, items, loc\) \{\s*if \(!w\.worn\) return items;/, 'function thin(w, items, loc) { if (window.__roadMode) return window.__roadsThin(w, items); if (!w.worn) return items;'],
    ['<body>', `<body><script>window.__roadMode = ${JSON.stringify(mode)};\n${src}</script>`],
  ];
  for (const [from, to] of HOOKS) {
    if (typeof from === 'string' ? !html.includes(from) : !from.test(html)) throw new Error(`roads hook not found: ${String(from).slice(0, 50)}`);
    html = html.replace(from, () => to);
  }
  return html;
}
module.exports = { patch };
