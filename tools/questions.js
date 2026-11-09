// Questions tool: read QUESTIONS.md by task or title, record Kim's answers, and move answered questions to QUESTION_ARCHIVE.md, without
// reading either file. A block is a "### <title>" under "## Priority N": intro lines, then numbered questions ("N. ... **P:** ..."), each
// followed by its answer lines ("   **A (Kim, 7 Nov):** ..."). The archive keeps groups "# Archived <date> (<occasion>)", newest first,
// each holding blocks as "## <title>", with "(questions 5 and 7)" when only some of a block's questions moved.
const fs = require('fs'), path = require('path');
const USAGE = `usage: node tools/questions.js <command> [--root DIR]
  list [--priority N]          one line per block: priority, questions (answered), size, title
  show QUERY...                blocks whose title names VB-NNN (else whose text does), or whose title contains the text
  answer QUERY N TEXT          add "   **A (Kim, <date>):** TEXT" under question N of the one block QUERY finds  [--date YYYY-MM-DD]
  archive QUERY [--questions 1,3] [--group OCCASION] [--intro TEXT] [--date YYYY-MM-DD] [--force]
                               move the answered questions (or those listed) to the archive's group of that date and occasion
                               (default: the block's first VB-NNN); the whole block when all of them move; --force moves unanswered ones too`;

const args = process.argv.slice(2);
const option = (k) => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const flag = (k) => { const i = args.indexOf(k); if (i < 0) return false; args.splice(i, 1); return true; };
const root = path.resolve(option('--root') || path.join(__dirname, '..'));
const date = option('--date') || new Date().toISOString().slice(0, 10), priority = option('--priority');
const pick = option('--questions'), group = option('--group'), intro = option('--intro'), force = flag('--force');
const fail = (msg) => { console.error('questions: ' + msg); process.exit(1); };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const [y, m, d] = date.split('-').map(Number), longDate = `${d} ${MONTHS[m - 1]} ${y}`, shortDate = `${d} ${MONTHS[m - 1].slice(0, 3)}`;
const Q = path.join(root, 'QUESTIONS.md'), A = path.join(root, 'QUESTION_ARCHIVE.md');
let lines = fs.readFileSync(Q, 'utf8').split('\n');

// Blocks, with their questions: [from, to) line ranges, 0-based.
function parse() {
  const blocks = [];
  let prio = '-';
  lines.forEach((l, i) => {
    const p = l.match(/^## Priority (\d)/);
    if (p) prio = p[1];
    if (/^#{1,3} /.test(l) && blocks.length && blocks[blocks.length - 1].to == null) blocks[blocks.length - 1].to = i;
    if (/^### /.test(l)) blocks.push({ title: l.slice(4), priority: prio, from: i, to: null });
  });
  for (const b of blocks) {
    if (b.to == null) b.to = lines.length;
    while (b.to > b.from + 1 && !lines[b.to - 1].trim()) b.to--;
    b.items = [];
    for (let i = b.from + 1; i < b.to; i++) {
      const n = lines[i].match(/^(\d+)\. /);
      if (n) b.items.push({ n: +n[1], from: i, to: i + 1 });
      else if (b.items.length) b.items[b.items.length - 1].to = i + 1;
    }
    for (const q of b.items) q.answered = lines.slice(q.from, q.to).some((l) => /\*\*A\b/.test(l));
    b.text = lines.slice(b.from, b.to).join('\n');
  }
  return blocks;
}
let blocks = parse();
function find(query) {
  if (/^VB-\d{3}$/.test(query)) {
    const named = blocks.filter((b) => new RegExp(`\\b${query}\\b`).test(b.title));
    return named.length ? named : blocks.filter((b) => b.text.includes(query));
  }
  return blocks.filter((b) => b.title.toLowerCase().includes(query.toLowerCase()));
}
function one(query) {
  const hits = find(query);
  if (hits.length !== 1) fail(`${hits.length} blocks match "${query}"${hits.length ? ':\n  ' + hits.map((b) => b.title).join('\n  ') : ''}`);
  return hits[0];
}
const kb = (s) => (s.length >= 1000 ? (s.length / 1000).toFixed(1) + ' KB' : s.length + ' B');
const and = (ns) => (ns.length === 1 ? `question ${ns[0]}` : `questions ${ns.slice(0, -1).join(', ')} and ${ns[ns.length - 1]}`);

const [cmd, ...rest] = args;
if (cmd === 'list') {
  for (const b of blocks.filter((b) => !priority || b.priority === priority)) {
    const answered = b.items.filter((q) => q.answered).length;
    console.log(`P${b.priority} ${String(b.items.length).padStart(2)} q (${answered} answered) ${kb(b.text).padStart(7)}  ${b.title}`);
  }
  console.log(`${blocks.length} blocks, ${kb(lines.join('\n'))}; read one with  node tools/questions.js show VB-NNN|TEXT`);
} else if (cmd === 'show') {
  if (!rest.length) fail('show QUERY...');
  for (const query of rest) {
    const hits = find(query);
    if (!hits.length) console.log(`(no block names "${query}")`);
    for (const b of hits) console.log(`(Priority ${b.priority})\n${b.text}\n`);
  }
} else if (cmd === 'answer') {
  const [query, n, ...words] = rest, text = words.join(' ').trim();
  if (!query || !/^\d+$/.test(n || '') || !text) fail('answer QUERY N TEXT');
  const b = one(query), q = b.items.find((q) => q.n === +n) || fail(`"${b.title}" has no question ${n}`);
  lines.splice(q.to, 0, `   **A (Kim, ${shortDate}):** ${text}`);
  fs.writeFileSync(Q, lines.join('\n'));
  console.log(`answered question ${n} of "${b.title}"`);
} else if (cmd === 'archive') {
  const b = one(rest.join(' ') || fail('archive QUERY'));
  const wanted = pick ? pick.split(/,\s*/).map(Number) : b.items.filter((q) => q.answered || force).map((q) => q.n);
  const moving = b.items.filter((q) => wanted.includes(q.n));
  for (const n of wanted) if (!b.items.some((q) => q.n === n)) fail(`"${b.title}" has no question ${n}`);
  const unanswered = moving.filter((q) => !q.answered).map((q) => q.n);
  if (unanswered.length && !force) fail(`${and(unanswered)} of "${b.title}" ${unanswered.length > 1 ? 'have' : 'has'} no answer ("**A"): answer or --force`);
  if (!moving.length && !(force && !b.items.length)) fail(`nothing to move from "${b.title}": no answered questions (--questions N, --force)`);
  const whole = moving.length === b.items.length, introLines = lines.slice(b.from + 1, b.items.length ? b.items[0].from : b.to);
  const block = [`## ${b.title}${whole ? '' : ` (${and(moving.map((q) => q.n))})`}`, ...introLines,
    ...moving.flatMap((q) => lines.slice(q.from, q.to))];
  // the questions leave QUESTIONS.md: the whole block, with the blank line after it, or only the moved questions
  if (whole) lines.splice(b.from, b.to - b.from + (lines[b.to] === '' ? 1 : 0));
  else for (const q of [...moving].reverse()) lines.splice(q.from, q.to - q.from);
  // into the archive: the newest group, if it is this date's and occasion's, else a new group before it
  const occasion = group || (b.title.match(/VB-\d{3}/) || [])[0] || fail('give the archive group with --group OCCASION');
  const heading = `# Archived ${longDate} (${occasion})`, arch = fs.readFileSync(A, 'utf8').split('\n');
  const first = arch.findIndex((l) => /^# Archived /.test(l));
  if (first < 0) fail('QUESTION_ARCHIVE.md has no "# Archived ..." group to insert before');
  if (arch[first] === heading) {
    let end = arch.findIndex((l, i) => i > first && /^# /.test(l));
    if (end < 0) end = arch.length;
    while (end > first && !arch[end - 1].trim()) end--;
    arch.splice(end, 0, '', ...block);
  } else arch.splice(first, 0, heading, '', ...(intro ? [intro, ''] : []), ...block, '');
  fs.writeFileSync(Q, lines.join('\n'));
  fs.writeFileSync(A, arch.join('\n'));
  console.log(`moved ${whole ? 'the block' : and(moving.map((q) => q.n))} "${b.title}" to QUESTION_ARCHIVE.md, "${heading.slice(2)}"`
    + (whole ? '' : `; ${and(b.items.filter((q) => !wanted.includes(q.n)).map((q) => q.n))} stay`));
} else { const help = !cmd || ['help', '--help', '-h'].includes(cmd); (help ? console.log : console.error)(USAGE); process.exit(help ? 0 : 1); }
