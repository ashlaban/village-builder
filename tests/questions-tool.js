// tools/questions.js on small QUESTIONS.md and QUESTION_ARCHIVE.md files: answers go under their question; archive refuses unanswered
// questions, moves answered ones alone (with the block's intro and "(question N)") or the whole block, into the newest group when it is
// the same date and occasion and into a new group before it otherwise.
const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const tool = path.join(__dirname, '..', 'tools', 'questions.js'), errors = [];
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-questions-'));
const Q = path.join(dir, 'QUESTIONS.md'), A = path.join(dir, 'QUESTION_ARCHIVE.md');
fs.writeFileSync(Q, ['# Open questions for Kim', '', 'Intro.', '', '## Priority 1', '', '### VB-901: first (raised today)', 'Intro of first.',
  '1. One? **P:** yes.', '2. Two? **P:** no.', '', '### Second thing (planning)', '3. Three? **P:** maybe.', '', '## Priority 2', '',
  '### VB-902: third', '1. Four? **P:** x.', ''].join('\n'));
fs.writeFileSync(A, ['# Answered questions', '', 'Intro.', '', '# Archived 1 January 2026 (old)', '', '## Old block', '1. Old? **A:** yes.', '']
  .join('\n'));
const run = (...args) => {
  const r = spawnSync(process.execPath, [tool, '--root', dir, '--date', '2026-01-02', ...args], { encoding: 'utf8' });
  return { ok: r.status === 0, out: r.stdout + r.stderr };
};
const expect = (what, cond, out) => { if (!cond) errors.push(what + '\n    ' + out.trim().split('\n').join('\n    ')); };
const q = () => fs.readFileSync(Q, 'utf8'), a = () => fs.readFileSync(A, 'utf8');

let r = run('list');
expect('list: three blocks with priorities and counts', r.ok && /^P1 {2}2 q \(0 answered\)/m.test(r.out) && /^P2 {2}1 q/m.test(r.out)
  && /3 blocks/.test(r.out), r.out);
r = run('show', 'VB-902');
expect('show by ID, with its priority', r.ok && r.out.startsWith('(Priority 2)\n### VB-902: third\n1. Four?'), r.out);
r = run('answer', 'VB-90', '1', 'x');
expect('answer refuses an ambiguous query', !r.ok && /2 blocks match/.test(r.out), r.out);
r = run('archive', 'VB-901');
expect('archive refuses a block without answers', !r.ok && /nothing to move/.test(r.out), r.out);
r = run('answer', 'VB-901', '2', 'No,', 'never.');
expect('answer goes under its question', r.ok && q().includes('2. Two? **P:** no.\n   **A (Kim, 2 Jan):** No, never.\n\n### Second'), r.out);
r = run('archive', 'VB-901', '--questions', '1,2');
expect('archive refuses an unanswered question it is asked to move', !r.ok && /question 1 .*has no answer/.test(r.out), r.out);
r = run('archive', 'VB-901');
expect('an answered question moves alone, with the intro, into a new group first', r.ok
  && a().includes('Intro.\n\n# Archived 2 January 2026 (VB-901)\n\n## VB-901: first (raised today) (question 2)\nIntro of first.\n2. Two?')
  && a().includes('**A (Kim, 2 Jan):** No, never.\n\n# Archived 1 January 2026 (old)')
  && q().includes('### VB-901: first (raised today)\nIntro of first.\n1. One? **P:** yes.\n\n### Second'), r.out);
run('answer', 'VB-901', '1', 'Yes.');
r = run('archive', 'VB-901');
expect('the last question takes the whole block, into the same group', r.ok && !q().includes('VB-901')
  && q().includes('## Priority 1\n\n### Second thing') && /No, never\.\n\n## VB-901: first \(raised today\)\nIntro of first\.\n1\. One\?/.test(a()), r.out);
r = run('archive', 'Second thing', '--force', '--group', 'planning', '--intro', 'Answered in passing.');
expect('another occasion makes a new group before the newest', r.ok
  && a().includes('Intro.\n\n# Archived 2 January 2026 (planning)\n\nAnswered in passing.\n\n## Second thing (planning)\n3. Three?')
  && a().indexOf('(planning)') < a().indexOf('(VB-901)') && q().includes('## Priority 1\n\n## Priority 2'), r.out);
fs.rmSync(dir, { recursive: true, force: true });

r = spawnSync(process.execPath, [tool, 'list'], { encoding: 'utf8' });
expect('list reads this checkout', r.status === 0 && /\d+ blocks/.test(r.stdout), r.stdout + r.stderr);
if (errors.length) { console.error('QUESTIONS TOOL FAIL:\n  ' + errors.join('\n  ')); process.exit(1); }
console.log('questions tool: list, show, answers under their question, partial and whole archiving into dated groups');
