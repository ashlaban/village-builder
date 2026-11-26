// Check the Jekyll output that Pages is about to deploy.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

const dom = new JSDOM(fs.readFileSync('_site/BACKLOG.html', 'utf8'), { runScripts: 'outside-only' });
const doc = dom.window.document;
const source = fs.readFileSync('BACKLOG.md', 'utf8');
for (const [heading, columns] of [['Ready', 6], ['Waiting for Kim', 6], ['Blocked', 7]]) {
  const section = source.split('\n## ' + heading + '\n')[1].split('\n## ')[0];
  const expected = [...section.matchAll(/^\| \[(VB-\d+)\]/gm)].map((match) => match[1]);
  let fold = doc.getElementById(heading.toLowerCase().replaceAll(' ', '-'))?.nextElementSibling;
  while (fold && !fold.matches('h2, details')) fold = fold.nextElementSibling;
  assert.ok(fold?.matches('details'), heading);
  const rows = [...fold.querySelectorAll('tbody tr')];
  assert.deepEqual(rows.map((row) => row.cells[0].textContent.trim()), expected, heading);
  for (const row of rows) {
    const id = row.cells[0].textContent.trim();
    assert.equal(doc.getElementById(id)?.closest('tr'), row, id);
    if (heading !== 'Blocked') continue;
    const waits = row.cells[5];
    const ids = waits.textContent.match(/VB-\d+/g) || [];
    assert.deepEqual([...waits.querySelectorAll('a')].map((link) => link.hash), ids.map((id) => '#' + id));
    for (const dependency of ids) assert.equal(doc.getElementById(dependency)?.closest('tr')?.cells[0].textContent.trim(), dependency);
  }
  assert.ok(rows.every((row) => row.cells.length === columns), heading);
}
// jsdom has no fetch: the overview's done counts read the archive page Pages built beside this one.
dom.window.fetch = async (url) => {
  assert.equal(url, 'BACKLOG_ARCHIVE.html');
  return { ok: true, text: async () => fs.readFileSync('_site/BACKLOG_ARCHIVE.html', 'utf8') };
};
dom.window.eval(fs.readFileSync('_site/docs/backlog-filter.js', 'utf8'));
const input = doc.querySelector('input[type=search]');
const row = doc.querySelector('details tbody tr:has(td a[href*="VB-"])');
if (row) {
  input.value = row.cells[0].textContent.trim();
  input.dispatchEvent(new dom.window.Event('input'));
  assert.ok(row.closest('details').open && !row.hidden);
  input.value = 'no such backlog task';
  input.dispatchEvent(new dom.window.Event('input'));
  assert.ok(row.hidden);
}

const dependency = doc.querySelector('a[href^="#VB-"]');
if (dependency) {
  const target = doc.getElementById(dependency.hash.slice(1)).closest('tr');
  const fold = target.closest('details');
  fold.open = false;
  target.scrollIntoView = () => {}; // jsdom has no layout.
  dependency.click();
  assert.ok(fold.open && !target.hidden);
}

// The overview: a row an arch with its open tasks by status, as BACKLOG.md lists them, and its done tasks from the archive.
const rowsOf = (markdown, heading) => markdown.split('\n## ' + heading + '\n')[1].split('\n## ')[0]
  .split('\n').filter((line) => /^\| \[VB-\d+\]/.test(line)).map((line) => line.split('|')[3].trim());
const expected = new Map();
const tally = (arch, status) => {
  if (!expected.has(arch)) expected.set(arch, { done: 0, ready: 0, waiting: 0, blocked: 0 });
  expected.get(arch)[status]++;
};
for (const [heading, status] of [['Ready', 'ready'], ['Waiting for Kim', 'waiting'], ['Blocked', 'blocked']]) {
  for (const arch of rowsOf(source, heading)) tally(arch, status);
}
const overview = doc.querySelector('table.bf-overview');
assert.ok(overview, 'the overview table');
const overviewRows = new Map([...overview.tBodies[0].rows].map((row) => [row.dataset.arch, row]));
for (const [arch, c] of expected) {
  const row = overviewRows.get(arch);
  assert.ok(row, 'overview row for ' + arch);
  assert.deepEqual([2, 3, 4].map((i) => Number(row.cells[i].textContent)), [c.ready, c.waiting, c.blocked], arch);
}
const archive = fs.readFileSync('BACKLOG_ARCHIVE.md', 'utf8');
const done = new Map();
for (const arch of rowsOf(archive, 'Done tasks')) done.set(arch, (done.get(arch) || 0) + 1);

// Choosing an arch in the overview lists only its tasks, in every section; choosing it again lists all.
const arch = [...expected.keys()].find((key) => key !== '-') || '-';
const archButton = overviewRows.get(arch).querySelector('button');
doc.getElementById('filter').scrollIntoView = () => {};
archButton.click();
const taskRows = [...doc.querySelectorAll('details tbody tr')].filter((row) => /^VB-\d+$/.test(row.cells[0].textContent.trim()));
const archOf = (row) => row.cells[2].textContent.trim();
const shown = taskRows.filter((row) => !row.hidden);
const c = expected.get(arch);
assert.equal(shown.length, c.ready + c.waiting + c.blocked, 'tasks shown for ' + arch);
assert.ok(shown.every((row) => archOf(row) === arch), 'only ' + arch);
assert.equal(doc.querySelector('select').value, arch);
// Size and priority narrow it further.
const selects = [...doc.querySelectorAll('.bf-controls select')];
const sizeSelect = selects[2];
sizeSelect.value = shown[0].cells[4].textContent.trim();
sizeSelect.dispatchEvent(new dom.window.Event('change'));
assert.ok(taskRows.filter((row) => !row.hidden).every((row) => archOf(row) === arch && row.cells[4].textContent.trim() === sizeSelect.value));
archButton.click();
sizeSelect.value = '';
sizeSelect.dispatchEvent(new dom.window.Event('change'));
assert.ok(taskRows.every((row) => !row.hidden), 'all tasks again');

setTimeout(() => {
  for (const [key, row] of overviewRows) assert.equal(Number(row.cells[1].textContent), done.get(key) || 0, 'done in ' + key);
  const allDone = [...done.values()].reduce((sum, n) => sum + n, 0);
  assert.equal(Number(overview.tFoot.rows[0].cells[1].textContent), allDone, 'every done task in the total');
  console.log('backlog page: ' + taskRows.length + ' open tasks, ' + overviewRows.size + ' archs in the overview');
}, 50);
