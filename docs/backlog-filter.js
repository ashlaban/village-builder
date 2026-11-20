// Enhance the rendered Markdown. Agents still read and rewrite the original tables.
(() => {
  const sections = ['ready', 'waiting-for-kim', 'blocked'].map((id) => {
    const heading = document.getElementById(id);
    let fold = heading?.nextElementSibling;
    while (fold && !fold.matches('details, h2')) fold = fold.nextElementSibling;
    if (!fold?.matches('details')) return null;
    return { heading, fold, rows: Array.from(fold.querySelectorAll('tbody tr')), open: fold.open };
  });
  if (sections.some((section) => !section)) return;

  const label = document.createElement('label');
  label.textContent = 'Filter open tasks ';
  const input = document.createElement('input');
  input.type = 'search';
  input.placeholder = 'ID, arch, title or summary';
  label.append(input);
  const count = document.createElement('output');
  const controls = document.createElement('p');
  controls.append(label, ' ', count);
  sections[0].heading.before(controls);

  let filtering = false;
  input.addEventListener('input', () => {
    const terms = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let matches = 0;
    for (const section of sections) {
      if (!filtering) section.open = section.fold.open;
      let visible = 0;
      for (const row of section.rows) {
        const text = Array.from(row.cells, (cell) => cell.textContent).join(' ').toLowerCase();
        row.hidden = !terms.every((term) => text.includes(term));
        if (!row.hidden) visible++;
      }
      section.fold.open = terms.length ? visible > 0 : section.open;
      matches += visible;
    }
    filtering = terms.length > 0;
    count.textContent = filtering ? matches + (matches === 1 ? ' task' : ' tasks') : '';
  });
})();
