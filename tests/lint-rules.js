// Line rules of tests/lint.js, kept apart so that tests/lintrules.js can feed them single lines.
const CLOCK = /\b(Math\.random|Date\.now|performance\.now)\b|\bnew Date\b/;
// A line that reads the clock or draws unseeded randomness, unless it carries `// lint-allow: clock <reason>`.
const clockUse = (line) => (/\/\/ lint-allow: clock \S/.test(line) || !CLOCK.test(line) ? null : line.match(CLOCK)[0]);

const PATH = String.raw`st((?:\.\w+|\[[^\]]*\])+)`, WRITE_OK = new Set(['visualDirty', 'naturalDeaths', 'driftMul']), CLEAR_OK = new Set(['rigDirty', 'treeDirty', 'biomeDirty', 'pathDirty', 'landDirty']);
const ASSIGN = new RegExp(String.raw`(?<![\w.$])${PATH}\s*(?:=(?!=)|[-+*/%&|^]=|\*\*=|<<=|>>>?=|\?\?=|\|\|=|&&=)`, 'g');
const STEP = new RegExp(String.raw`(?:(?:\+\+|--)\s*(?<![\w.$])${PATH}|(?<![\w.$])${PATH}\s*(?:\+\+|--))`, 'g');
const MUTATE = new RegExp(String.raw`(?<![\w.$])${PATH}\.(push|pop|shift|unshift|splice|set|add|delete|clear|sort|reverse|fill)\(`, 'g');
const top = (path) => path.match(/^\.(\w+)/) ? path.match(/^\.(\w+)/)[1] : path;
// Writes to the simulation state `st` on one line of the page script: the text of each forbidden write.
function pageWrites(line) {
  const code = line.replace(/\/\/.*$/, ''), out = [];
  for (const m of code.matchAll(ASSIGN)) if (!(/^\.\w+$/.test(m[1]) && WRITE_OK.has(top(m[1])))) out.push(m[0].trim());
  for (const m of code.matchAll(STEP)) out.push(m[0].trim());
  for (const m of code.matchAll(MUTATE)) {
    if (m[2] === 'clear' && /^\.\w+$/.test(m[1]) && CLEAR_OK.has(top(m[1]))) continue;
    out.push(m[0].trim());
  }
  return out;
}
module.exports = { clockUse, pageWrites };
