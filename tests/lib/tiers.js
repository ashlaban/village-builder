// The tiers, discovered (VB-1933; docs/testing.md). A test file run by a tier says so in its head, the comment lines it opens with,
// a line a tier and argument set:
//   // @suite fast|integration|extended [node:FLAG ...] [ARG ...]
// `node:--expose-gc` goes to node before the script; the other words after it, as `--integration`. A test with no such line runs in no
// tier. The runner starts a tier's scripts in tests/suites.js's FIRST order, then the rest by name.
const fs = require('fs'), path = require('path');
const TIERS = ['fast', 'integration', 'extended'];
const SUITE = /^\/\/ @suite\b(.*)$/;
// a file's text -> [{ tier, cmd }]; throws on a malformed line. Only the head counts: a quoted `// @suite` further down is data.
function headerOf(text, file) {
  const found = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('//')) break;
    const m = SUITE.exec(line);
    if (!m) continue;
    const [tier, ...words] = m[1].trim().split(/\s+/).filter(Boolean);
    if (!TIERS.includes(tier)) throw new Error(`${file}: "${line}": the tier is one of ${TIERS.join(', ')}`);
    const flags = [];
    while (words.length && words[0].startsWith('node:')) flags.push(words.shift().slice(5));
    if (words.some((w) => w.startsWith('node:'))) throw new Error(`${file}: "${line}": node: flags come before the script's arguments`);
    found.push({ tier, cmd: ['node', ...flags, file, ...words] });
  }
  return found;
}
// root -> { fast: [cmd], integration: [cmd], extended: [cmd] }, each in FIRST order then by file
function discover(root = path.join(__dirname, '../..'), first = require('../suites.js').FIRST) {
  const tiers = Object.fromEntries(TIERS.map((t) => [t, []]));
  const dir = path.join(root, 'tests');
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.js')).sort())
    for (const { tier, cmd } of headerOf(fs.readFileSync(path.join(dir, f), 'utf8'), `tests/${f}`)) tiers[tier].push(cmd);
  const rank = new Map(first.map((c, i) => [c.join(' '), i]));
  const at = (c) => (rank.has(c.join(' ')) ? rank.get(c.join(' ')) : first.length);
  for (const t of TIERS) tiers[t] = tiers[t].map((c, i) => [c, i]).sort((a, b) => at(a[0]) - at(b[0]) || a[1] - b[1]).map(([c]) => c);
  return tiers;
}
module.exports = { TIERS, headerOf, discover };
