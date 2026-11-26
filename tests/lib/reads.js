// VB-1753: the reads of who is played in a module's source (tests/played.js, tests/played-reads.js).
const path = require('path');
// The reads in a module's code (comments left out), by the function around each: the last `function NAME(`, `const NAME = (...) =>` or
// `on('EVENT'` above it. A read is `X.player` through any name (`st`, `view`, a copy), or `player` taken apart (`const { player } = st`).
function reads(file, src) {
  const out = new Map(),
    mod = path.basename(file).replace(/\.(js|ts)$/, '');
  let fn = '(top)';
  for (const line of src.split('\n')) {
    const m = line.match(
      /^\s*(?:function\s+(\w+)\s*\(|(?:const|let)\s+(\w+)\s*=\s*(?:\([^)]*\)|\w+)\s*=>|on\('(\w+)')/,
    );
    if (m) fn = m[1] || m[2] || `on:${m[3]}`;
    const code = line.replace(/\/\/.*$/, ''),
      n =
        (code.match(/\b\w+\.player\b/g) || []).length +
        (code.match(/\{[^}]*\bplayer\b[^}]*\}\s*=(?![=>])/g) || []).length;
    if (!n) continue;
    const key = `${mod}:${fn}`;
    out.set(key, (out.get(key) || 0) + n);
  }
  return out;
}
module.exports = { reads };
