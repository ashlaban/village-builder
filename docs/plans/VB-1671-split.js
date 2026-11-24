// scratch (VB-1671): the conflicted merges since 15 Nov by their worst conflict: bookkeeping, list file, import block, body.
// node docs/plans/VB-1671-split.js OUT.json   (the replay's output). Research code, not game code.
const out = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8')).filter((m) => m.date >= '2026-11-15' && m.kind !== 'pr');
const BOOK = /^(BACKLOG|BACKLOG_ARCHIVE|QUESTIONS|QUESTION_ARCHIVE|REVIEW)\.md$|^docs\/(tuning|design-changelog|bench\/|agents\/)|^tests\/(counters|golden)\.json|baseline|^backlog\//;
const LIST = /^src\/(manifest|layers|owners|page)\.json$|^src\/(vb|sim)\.js$|^tests\/(suites|run)\.js$|^docs\/architecture\/modules\.md$|^src\/head\.html$/;
const MECH_SYM = new Set(['(imports)', '(head)', '(exports)']);
const unit = (c) => c.f === 'index.html' || BOOK.test(c.f) ? 'bookkeeping' : LIST.test(c.f) ? 'list'
  : /\.(js|ts)$/.test(c.f) && c.syms.length && c.syms.every((s) => MECH_SYM.has(s)) ? 'imports/head/exports' : /^(src|tests|tools)\//.test(c.f) ? 'body' : 'docs';
const conf = out.filter((m) => m.conflicts.length); const worst = {};
const order = ['body', 'docs', 'imports/head/exports', 'list', 'bookkeeping'];
for (const m of conf) { const u = new Set(m.conflicts.map(unit)); const w = order.find((k) => u.has(k)); worst[w] = (worst[w] || 0) + 1; }
console.log(`non-PR merges since 15 Nov: ${out.length}; conflicted ${conf.length}`); console.log('by worst unit:', worst);
const bodies = conf.flatMap((m) => m.conflicts.filter((c) => unit(c) === 'body').map((c) => `${m.date} ${c.f}: ${c.syms.filter((s) => !MECH_SYM.has(s)).join(', ')}  [${m.subj.slice(0, 60)}]`));
console.log(bodies.join('\n'));
