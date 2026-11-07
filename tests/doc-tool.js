// tools/doc.js on a small document: the table of contents with sizes, a section by its heading (numbers and bracketed notes ignored),
// a Design ref's "Section (Subsection)", a table row or bold bullet inside a section, headings in code blocks ignored, ambiguity refused.
const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const tool = path.join(__dirname, '..', 'tools', 'doc.js'), errors = [];
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-doc-')), file = path.join(dir, 'd.md');
fs.writeFileSync(file, ['# Title', 'Intro.', '## 1. Goods and food', 'Goods intro.', '### Farming year (Agreed, 30 Oct)', 'Sowing.',
  '| Aspect | Design | Status |', '| --- | --- | --- |', '| Help in hunger | Kin first. | Decided |', '| Milling | Querns. | Proposed |',
  '### Animals', '- **Grazing at low cost:** on the commons.', '```', '## Not a heading', '```', '## 2. Customs', '### Pace', 'Slowly.',
  '### Pace of drift', 'Slower.', ''].join('\n'));
const run = (...args) => {
  const r = spawnSync(process.execPath, [tool, file, ...args], { encoding: 'utf8' });
  return { ok: r.status === 0, out: r.stdout + r.stderr };
};
const expect = (what, cond, out) => { if (!cond) errors.push(what + '\n    ' + out.trim().split('\n').join('\n    ')); };

let r = run('--toc');
expect('toc lists headings with lines and sizes, not the one in a code block', r.ok && /\b3 {2}\s*1\. Goods and food {2}\(\d+ B\)/.test(r.out)
  && r.out.includes('Farming year (Agreed, 30 Oct)') && !r.out.includes('Not a heading'), r.out);
r = run('Goods and food');
expect('a section and its subsections, numbers ignored', r.ok && r.out.startsWith('## 1. Goods and food') && r.out.includes('Grazing at low cost')
  && r.out.includes('## Not a heading') && !r.out.includes('Customs'), r.out);
r = run('Goods and food (Farming year: when to sow)');
expect('Section (Subsection) finds the subsection; bracketed notes ignored', r.ok && r.out.startsWith('### Farming year') && !r.out.includes('Animals'),
  r.out);
r = run('Goods and food (Help in hunger)');
expect('a table row with its header and heading', r.ok && r.out.trim().split('\n').length === 4 && r.out.includes('| Aspect |')
  && r.out.includes('| Help in hunger | Kin first.') && !r.out.includes('Milling'), r.out);
r = run('Grazing at low cost');
expect('a bold bullet', r.ok && r.out.includes('- **Grazing at low cost:**'), r.out);
r = run('Pace');
expect('an exact heading wins over a longer one', r.ok && r.out.startsWith('### Pace\n') && !r.out.includes('Slower'), r.out);
r = run('Pa');
expect('an ambiguous query is refused with the candidates', !r.ok && /2 headings/.test(r.out), r.out);
r = run('Goods and food', '--shallow');
expect('--shallow stops at the first subheading and lists them', r.ok && !r.out.includes('Sowing') && /\(subsections/.test(r.out), r.out);
fs.rmSync(dir, { recursive: true, force: true });

if (errors.length) { console.error('DOC TOOL FAIL:\n  ' + errors.join('\n  ')); process.exit(1); }
console.log('doc tool: contents, sections, subsections of Design refs, table rows and bullets, ambiguity refused');
