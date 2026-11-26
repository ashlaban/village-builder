// Enhance the rendered Markdown. Agents still read and rewrite the original tables.
// Adds an overview of each arch's tasks (done, ready, waiting, blocked) and a filter by arch, priority, size and text.
(() => {
  const sections = ['ready', 'waiting-for-kim', 'blocked'].map((id) => {
    const heading = document.getElementById(id);
    let fold = heading?.nextElementSibling;
    while (fold && !fold.matches('details, h2')) fold = fold.nextElementSibling;
    if (!fold?.matches('details')) return null;
    return { id, heading, fold, rows: Array.from(fold.querySelectorAll('tbody tr')), open: fold.open };
  });
  if (sections.some((section) => !section)) return;

  // The column of a table whose header reads `name`, or -1.
  const column = (table, name) => Array.from(table?.querySelectorAll('thead th') || []).findIndex((th) => th.textContent.trim() === name);
  const cell = (row, index) => (index >= 0 && row.cells[index] ? row.cells[index].textContent.trim() : '');

  const tasks = [];
  for (const section of sections) {
    const table = section.fold.querySelector('table');
    const at = { arch: column(table, 'Arch'), pri: column(table, 'Pri'), size: column(table, 'Size') };
    for (const row of section.rows) {
      tasks.push({
        row,
        section,
        arch: cell(row, at.arch) || '-',
        pri: cell(row, at.pri),
        size: cell(row, at.size),
        text: Array.from(row.cells, (c) => c.textContent).join(' ').toLowerCase(),
      });
    }
  }

  // The archs in the order of the Archs table, then those only the tasks name, then the tasks outside every arch.
  const archs = [];
  let archFold = document.getElementById('archs')?.nextElementSibling;
  while (archFold && !archFold.matches('details, h2')) archFold = archFold.nextElementSibling;
  const listed = archFold?.matches('details') ? archFold.querySelector('table') : null;
  const names = new Map();
  if (listed) {
    const key = column(listed, 'Key');
    const name = column(listed, 'Arch');
    for (const row of listed.querySelectorAll('tbody tr')) {
      const k = cell(row, key);
      if (k && !names.has(k)) {
        names.set(k, cell(row, name));
        archs.push(k);
      }
    }
  }
  for (const task of tasks) if (task.arch !== '-' && !archs.includes(task.arch)) archs.push(task.arch);
  if (tasks.some((task) => task.arch === '-')) archs.push('-');
  const archLabel = (key) => (key === '-' ? 'no arch' : key);

  const style = document.createElement('style');
  style.textContent = `
#bf-overview { display: table; width: 100%; border-collapse: collapse; font-size: 0.9em; margin: 0 0 0.5em; font-variant-numeric: tabular-nums; }
#bf-overview th, #bf-overview td { padding: 0.3em 0.45em; border: 0; border-bottom: 1px solid rgba(128, 128, 128, 0.18); text-align: right; white-space: nowrap; background: none; }
#bf-overview tr { background: none !important; border: 0; }
#bf-overview thead th { font-size: 0.78em; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; color: #6a737d; border-bottom-width: 2px; }
#bf-overview thead a { color: inherit; text-decoration: underline dotted; }
#bf-overview th:first-child, #bf-overview td:first-child { text-align: left; padding-left: 0.6em; }
#bf-overview td.bf-bar { width: 100%; min-width: 3em; }
#bf-overview td.bf-zero { color: rgba(128, 128, 128, 0.6); }
#bf-overview tfoot td { font-weight: 600; border-bottom: 0; border-top: 2px solid rgba(128, 128, 128, 0.25); }
#bf-overview tbody tr:hover td { background: rgba(128, 128, 128, 0.06); }
#bf-overview tr.bf-current td { background: rgba(3, 102, 214, 0.1); }
#bf-overview tr.bf-current td:first-child { box-shadow: inset 3px 0 #0366d6; }
.bf-arch { background: none; border: 0; padding: 0; color: #0366d6; cursor: pointer; font: inherit; }
.bf-arch:hover, .bf-arch:focus-visible { text-decoration: underline; }
.bf-meter { display: flex; height: 0.55em; border-radius: 1em; overflow: hidden; background: rgba(128, 128, 128, 0.18); }
.bf-meter span { display: block; height: 100%; }
.bf-done { background: #2da44e; } .bf-ready { background: #54aeff; } .bf-waiting { background: #d4a72c; }
.bf-key { font-size: 0.85em; color: #6a737d; }
.bf-key i { display: inline-block; width: 0.75em; height: 0.75em; border-radius: 50%; vertical-align: -0.05em; margin: 0 0.3em 0 0.7em; }
.bf-key i:first-child { margin-left: 0; }
.bf-controls { display: flex; flex-wrap: wrap; gap: 0.5em 0.9em; align-items: center; padding: 0.6em 0.8em; border: 1px solid rgba(128, 128, 128, 0.25); border-radius: 8px; background: rgba(128, 128, 128, 0.06); font-size: 0.9em; }
.bf-controls label { white-space: nowrap; color: #6a737d; }
.bf-controls select, .bf-controls input[type=search] { font: inherit; color: inherit; padding: 0.2em 0.4em; border: 1px solid rgba(128, 128, 128, 0.4); border-radius: 6px; background: Canvas; }
.bf-controls input[type=search] { width: 13em; max-width: 100%; }
.bf-controls button { font: inherit; padding: 0.2em 0.8em; border: 1px solid rgba(128, 128, 128, 0.4); border-radius: 1em; background: Canvas; color: inherit; cursor: pointer; }
.bf-controls button:hover { border-color: #0366d6; color: #0366d6; }
.bf-controls output { font-weight: 600; }
.bf-scroll { overflow-x: auto; }
/* The task tables: a little tighter, the ID kept on one line. */
h2[id] ~ details table { font-size: 0.9em; }
h2[id] ~ details table th, h2[id] ~ details table td { padding: 0.35em 0.6em; vertical-align: top; }
h2[id] ~ details table td:first-child { white-space: nowrap; }
h2[id] ~ details > summary { cursor: pointer; font-weight: 600; margin: 0.3em 0; }
`;
  document.head.append(style);

  // The overview: one row an arch, its tasks by status, and a bar of the done part.
  const statusOf = { ready: 'ready', 'waiting-for-kim': 'waiting', blocked: 'blocked' };
  const counts = new Map(archs.map((key) => [key, { done: null, ready: 0, waiting: 0, blocked: 0 }]));
  for (const task of tasks) counts.get(task.arch)[statusOf[task.section.id]]++;

  const overviewHeading = document.createElement('h2');
  overviewHeading.id = 'overview';
  overviewHeading.textContent = 'Archs at a glance';
  const overviewNote = document.createElement('p');
  overviewNote.className = 'bf-key';
  overviewNote.innerHTML = '<i class="bf-done"></i>done <i class="bf-ready"></i>ready <i class="bf-waiting"></i>waiting for Kim'
    + ' <i style="background: rgba(128,128,128,0.2)"></i>blocked. Choose an arch to list only its tasks.';
  const overview = document.createElement('table');
  overview.className = 'bf-overview';
  overview.id = 'bf-overview';
  overview.innerHTML = '<thead><tr><th>Arch</th><th><a href="BACKLOG_ARCHIVE.html#done-tasks">Done</a></th><th>Ready</th>'
    + '<th title="Waiting for Kim">Wait</th><th>Blocked</th><th></th></tr></thead><tbody></tbody><tfoot></tfoot>';
  const overviewRows = new Map();
  const fill = (tr, c) => {
    const open = c.ready + c.waiting + c.blocked;
    const done = c.done ?? 0;
    const total = done + open || 1;
    const percent = (n) => (100 * n / total).toFixed(1) + '%';
    tr.cells[1].textContent = c.done === null ? '…' : String(c.done);
    tr.cells[2].textContent = String(c.ready);
    tr.cells[3].textContent = String(c.waiting);
    tr.cells[4].textContent = String(c.blocked);
    for (const i of [1, 2, 3, 4]) tr.cells[i].classList.toggle('bf-zero', tr.cells[i].textContent === '0');
    tr.cells[5].title = c.done === null ? open + ' open' : Math.round(100 * done / total) + '% done, ' + open + ' open';
    tr.cells[5].firstChild.innerHTML = `<span class="bf-done" style="width:${percent(done)}"></span>`
      + `<span class="bf-ready" style="width:${percent(c.ready)}"></span><span class="bf-waiting" style="width:${percent(c.waiting)}"></span>`;
  };
  const newRow = () => {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td></td><td></td><td></td><td></td><td></td><td class="bf-bar"><div class="bf-meter"></div></td>';
    return tr;
  };
  for (const key of archs) {
    const tr = newRow();
    tr.dataset.arch = key;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'bf-arch';
    button.textContent = archLabel(key);
    if (names.get(key)) button.title = names.get(key);
    button.addEventListener('click', () => {
      state.arch = state.arch === key ? '' : key;
      apply();
      controls.scrollIntoView({ block: 'start' });
    });
    tr.cells[0].append(button);
    overview.tBodies[0].append(tr);
    overviewRows.set(key, tr);
  }
  let closedDone = 0;
  const totalRow = newRow();
  totalRow.cells[0].title = 'Done includes the tasks of closed archs';
  totalRow.cells[0].textContent = 'All';
  overview.tFoot.append(totalRow);
  const refreshOverview = () => {
    const total = { done: 0, ready: 0, waiting: 0, blocked: 0 };
    for (const [key, c] of counts) {
      fill(overviewRows.get(key), c);
      for (const k of Object.keys(total)) total[k] = total[k] === null || c[k] === null ? null : total[k] + c[k];
    }
    if (total.done !== null) total.done += closedDone;
    fill(totalRow, total);
  };
  refreshOverview();
  const overviewBox = document.createElement('div');
  overviewBox.className = 'bf-scroll';
  overviewBox.append(overview);

  // Done tasks are in the archive's page: count them by arch when it loads, and leave '…' if it does not.
  if (typeof fetch === 'function' && typeof DOMParser === 'function') {
    fetch('BACKLOG_ARCHIVE.html')
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error(response.status))))
      .then((html) => {
        const archive = new DOMParser().parseFromString(html, 'text/html');
        let fold = archive.getElementById('done-tasks')?.nextElementSibling;
        while (fold && !fold.matches('table, details, h2')) fold = fold.nextElementSibling;
        const table = fold?.matches('table') ? fold : fold?.querySelector?.('table');
        if (!table) return;
        const at = column(table, 'Arch');
        for (const c of counts.values()) c.done = 0;
        closedDone = 0;
        for (const row of table.querySelectorAll('tbody tr')) {
          const c = counts.get(cell(row, at) || '-');
          if (c) c.done++;
          else closedDone++; // A closed arch's: counted in the total only.
        }
        refreshOverview();
      })
      .catch(() => {});
  }

  // The filter: arch, priority and size, and words that must all be found in the row.
  const state = { arch: '', pri: '', size: '', text: '' };
  const select = (labelText, key, values, label) => {
    const element = document.createElement('select');
    element.innerHTML = '<option value="">all</option>';
    for (const value of values) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label ? label(value) : value;
      element.append(option);
    }
    element.addEventListener('change', () => {
      state[key] = element.value;
      apply();
    });
    const wrap = document.createElement('label');
    wrap.append(labelText + ' ', element);
    return { wrap, element };
  };
  const distinct = (key) => [...new Set(tasks.map((task) => task[key]).filter(Boolean))];
  const sizes = ['S', 'M', 'L'];
  const bySize = (a, b) => (sizes.indexOf(a) + 1 || 9) - (sizes.indexOf(b) + 1 || 9) || a.localeCompare(b);
  const archSelect = select('Arch', 'arch', archs, (key) => archLabel(key) + ' (' + tasks.filter((t) => t.arch === key).length + ')');
  const priSelect = select('Pri', 'pri', distinct('pri').sort((a, b) => a - b));
  const sizeSelect = select('Size', 'size', distinct('size').sort(bySize));

  const textLabel = document.createElement('label');
  textLabel.textContent = 'Words ';
  const input = document.createElement('input');
  input.type = 'search';
  input.placeholder = 'ID, title or summary';
  textLabel.append(input);
  input.addEventListener('input', () => {
    state.text = input.value;
    apply();
  });
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.textContent = 'Show all';
  clear.addEventListener('click', () => {
    Object.assign(state, { arch: '', pri: '', size: '', text: '' });
    apply();
  });
  const count = document.createElement('output');
  const controls = document.createElement('p');
  controls.className = 'bf-controls';
  controls.id = 'filter';
  controls.append(archSelect.wrap, priSelect.wrap, sizeSelect.wrap, textLabel, clear, count);

  sections[0].heading.before(overviewHeading, overviewNote, overviewBox, controls);

  let filtering = false;
  function apply() {
    archSelect.element.value = state.arch;
    priSelect.element.value = state.pri;
    sizeSelect.element.value = state.size;
    if (input.value !== state.text) input.value = state.text;
    const terms = state.text.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const active = terms.length > 0 || state.arch !== '' || state.pri !== '' || state.size !== '';
    const visible = new Map(sections.map((section) => [section, 0]));
    for (const section of sections) if (!filtering) section.open = section.fold.open;
    let matches = 0;
    for (const task of tasks) {
      task.row.hidden = (state.arch !== '' && task.arch !== state.arch)
        || (state.pri !== '' && task.pri !== state.pri)
        || (state.size !== '' && task.size !== state.size)
        || !terms.every((term) => task.text.includes(term));
      if (!task.row.hidden) {
        visible.set(task.section, visible.get(task.section) + 1);
        matches++;
      }
    }
    for (const section of sections) section.fold.open = active ? visible.get(section) > 0 : section.open;
    filtering = active;
    count.textContent = active ? matches + (matches === 1 ? ' task' : ' tasks') : '';
    clear.hidden = !active;
    for (const [key, tr] of overviewRows) tr.classList.toggle('bf-current', key === state.arch);
    // Keep the choice in the address, so a filtered page can be bookmarked or shared.
    try {
      const params = new URLSearchParams(location.search);
      for (const key of ['arch', 'pri', 'size']) state[key] ? params.set(key, state[key]) : params.delete(key);
      state.text.trim() ? params.set('q', state.text.trim()) : params.delete('q');
      const search = params.toString();
      const url = location.pathname + (search ? '?' + search : '') + location.hash;
      if (url !== location.pathname + location.search + location.hash) history.replaceState(history.state, '', url);
    } catch {
      // An address that cannot be changed (a file:// page in some browsers) leaves the filter working.
    }
  }

  try {
    const params = new URLSearchParams(location.search);
    state.arch = archs.includes(params.get('arch')) ? params.get('arch') : '';
    state.pri = params.get('pri') || '';
    state.size = params.get('size') || '';
    state.text = params.get('q') || '';
  } catch {
    // No address to read: start unfiltered.
  }
  apply();

  function revealTask(hash) {
    if (!/^#VB-\d+$/.test(hash)) return;
    const row = document.getElementById(hash.slice(1))?.closest('tr');
    if (!row) return;
    if (row.hidden) {
      Object.assign(state, { arch: '', pri: '', size: '', text: '' });
      apply();
    }
    row.closest('details').open = true;
    row.scrollIntoView({ block: 'nearest' });
  }
  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('a[href^="#VB-"]');
    if (link && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) revealTask(link.hash);
  });
  window.addEventListener('hashchange', () => revealTask(location.hash));
  revealTask(location.hash);
})();
