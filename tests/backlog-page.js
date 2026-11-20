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
