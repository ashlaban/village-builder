// Pull the page's icon path tables into one JS file the mocks load.
// Run from the repository root: node docs/mocks/plans-ui/extract-icons.js docs/mocks/plans-ui/icons.js
const fs = require('fs'), vm = require('vm');
const src = ['icons', 'kindicons', 'goodicons', 'cardicons'].map((f) => fs.readFileSync(`src/page/${f}.js`, 'utf8')).join('\n');
const ctx = { document: { querySelectorAll: () => [] }, console };
vm.createContext(ctx);
vm.runInContext(src + '\n;globalThis.__out = {ACT_PATHS, ACT_STEN, GOOD_PATHS, GOOD_STEN, KIND_ICON};', ctx);
const o = ctx.__out;
const out = { line: {}, stencil: {} };
for (const [k, v] of Object.entries(o.ACT_PATHS)) out.line[k] = v;
for (const [k, v] of Object.entries(o.GOOD_PATHS)) out.line[k] ??= v;
for (const [k, v] of Object.entries(o.ACT_STEN)) out.stencil[k] = v;
for (const [k, v] of Object.entries(o.GOOD_STEN)) out.stencil[k] ??= v;
fs.writeFileSync(process.argv[2], '// Generated from src/page/{kindicons,goodicons}.js for the plans-UI mocks: 24x24 icon bodies, line (stroked) and stencil (filled).\nconst ICONS = ' + JSON.stringify(out, null, 0) + ';\n');
console.log(Object.keys(out.line).length, 'line', Object.keys(out.stencil).length, 'stencil');
console.log(Object.keys(out.line).join(' '));
