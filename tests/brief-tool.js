// tools/brief.js on a small constructed backlog: the task up to its criteria with its notes only by size (a Flag line kept), its
// questions, a short design section whole and a long one by its subsections, a row found inside a subsection, who waits for it,
// and the rules by kind (a change of behaviour, a refactor, the page).
const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const tool = path.join(__dirname, '..', 'tools', 'brief.js'), errors = [];
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-brief-'));
fs.mkdirSync(path.join(dir, 'backlog'));
const write = (f, s) => fs.writeFileSync(path.join(dir, f), s);
write('design.md', `# Design\n\n## 2. World\n\n### Carts (12 November)\nA cart carries more.\n\n| Aspect | Design | Status |\n| --- | --- | --- |\n| Loads | Thirty on the back. | Decided |\n| Wear | Slow. | Agreed |\n\n`
  + `### Long\n${'A long line of design. '.repeat(250)}\n\n#### Part one\nx\n\n#### Part two\ny\n`);
write('QUESTIONS.md', '# Open questions for Kim\n\n## Priority 1\n\n### VB-900: the cart (raised 2 January 2026)\n1. Two wheels? **P:** yes.\n\n## Priority 2\n\n## Priority 3\n');
write('backlog/VB-900.md', '# VB-900: A cart is drawn\nStatus: ready\nPriority: 2\nSize: S\nDesign ref: design.md, World (Carts: Loads); Long. docs/review-work.md\n'
  + 'Goal: draw it on the page (`src/page/draw.js`).\nAcceptance criteria:\n- [ ] It is drawn.\n  With its wheels.\n- [x] It is tested.\n\nFlag: the load is wrong.\nNotes: SECRET-NOTES\n');
write('backlog/VB-901.md', '# VB-901: Refactor: split the cart\nStatus: blocked\nWaits for: VB-900\nPriority: 3\nSize: M\nDesign ref: none (code structure)\nGoal: split.\nAcceptance criteria:\n- [ ] Split.\n');
const run = (...a) => { const r = spawnSync(process.execPath, [tool, '--root', dir, ...a], { encoding: 'utf8' }); return { ok: r.status === 0, out: r.stdout + r.stderr }; };
const expect = (what, cond, out) => { if (!cond) errors.push(what + '\n    ' + String(out).trim().split('\n').join('\n    ')); };

let r = run('VB-900');
expect('the task up to its criteria', r.ok && r.out.startsWith('# VB-900: A cart is drawn') && r.out.includes('  With its wheels.') && r.out.includes('- [x] It is tested.'), r.out);
expect('the notes by size only, the Flag kept', /notes and reports, \d+ B, left out/.test(r.out) && r.out.includes('Flag: the load is wrong.') && !r.out.includes('SECRET-NOTES'), r.out);
expect('its questions', r.out.includes('## Questions') && r.out.includes('Two wheels? **P:** yes.'), r.out);
expect('a row inside a subsection, and not the other rows', r.out.includes('| Loads | Thirty on the back. | Decided |') && !r.out.includes('| Wear |'), r.out);
expect('a long section by its subsections', /KB: read with {2}node tools\/doc\.js design\.md "Long"/.test(r.out) && r.out.includes('Part one') && !r.out.includes('A long line of design. A long'), r.out);
expect('who waits for it', r.out.includes('Waited for by VB-901.'), r.out);
expect('the rules of a change of behaviour on the page', r.out.includes('## Rules for this task') && r.out.includes('Numbers are measured once') && r.out.includes('tests/smoke.js')
  && !r.out.includes('tools/same.js'), r.out);
r = run('VB-901');
expect('a refactor: same.js, no design, no page', r.ok && r.out.includes('tools/same.js --base REF') && !r.out.includes('## Design') && !r.out.includes('tests/smoke.js')
  && !r.out.includes('Numbers are measured once'), r.out);
r = run('VB-999');
expect('an unknown task', !r.ok && /no backlog\/VB-999\.md/.test(r.out), r.out);
r = run('--help');
expect('--help', r.ok && /usage: node tools\/brief\.js/.test(r.out), r.out);

fs.rmSync(dir, { recursive: true, force: true });
if (errors.length) { console.error('BRIEF FAIL\n  ' + errors.join('\n  ')); process.exit(1); }
console.log('brief: the task, its questions, its design sections, who waits and the rules by kind');
