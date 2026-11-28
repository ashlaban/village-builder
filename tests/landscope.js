// @suite integration
// The Land overlay's filter (VB-044) takes its scope from sim/scopes (VB-043; design.md, One scope model for overlays, stores and trees:
// each view asks the graph for the tiles in scope). page/land asks inScope for the tiles and bodies it shows and reckons none of its
// own: no walk over farms' fields and meadows or a village's farms, which disagreed with inScope on an emptied farm (the review of VB-044).
const assert = require('assert'),
  { readSource } = require('../tools/lib/source.js');
const src = readSource('src/page/land.js');
assert(/VB\['sim\/scopes'\]/.test(src), "page/land reads VB['sim/scopes']");
assert(/landInScope\(st, \{ level/.test(src), 'page/land asks inScope for its scope');
for (const [what, re] of [
  ["a farm's fields", /\.fields\b/],
  ["a farm's meadows", /\.meadows\b/],
  ["a village's common fields", /commonFields/],
  ["a village's farms", /villages\[[^\]]+\]\.farmsteads/],
])
  assert(!re.test(src), `page/land reckons ${what} itself instead of asking sim/scopes`);
console.log('landscope: the Land filter takes its tiles and bodies from sim/scopes inScope');
