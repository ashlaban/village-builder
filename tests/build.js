// @suite fast
// The page builds (VB-450): index.html is derived and not kept, so nothing compares a kept copy with the sources; this checks that the
// build itself works on the sources as they are: every module of src/manifest.json and src/page.json is found, the placeholders are all
// filled, and the same sources give the same page and build id.
const { builtPage } = require('./lib/page');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('BUILD FAIL:', m); } };
const page = builtPage(), id = (page.match(/const BUILD = '([0-9a-f]{10})'/) || [])[1];
check(page.startsWith('<!'), 'the page starts with its doctype');
for (const left of ['__BUILD_ID__', '<!--__MODULES__-->', '<!--__PAGE__-->']) check(!page.includes(left), `the placeholder ${left} is filled`);
for (const key of ['VB["sim"] =', 'VB["gen"] =']) check(page.includes(key), `the page holds the module ${key}`);
check(page.includes('app.ticker.add('), 'the page holds the page script');
check(!!id, 'the page names its build, a hash of its sources');
check(builtPage() === page, 'the same sources build the same page, in any directory');
if (failed) process.exit(1);
console.log(`build ok: ${page.length.toLocaleString('en-US')} bytes`);
