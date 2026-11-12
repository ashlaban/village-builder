// @sys page/saves: saves in the browser (VB-214): each archipelago's auto slot and three by hand, in IndexedDB, named by their build
  // ---- saves ----
  // A page save is {build, savedAt, label, save: Sim.save(st)}, as gzipped JSON. An archipelago (scenario, seed and size) has four slots:
  // `auto`, written when the page is hidden, and 1 to 3, written by hand; a slot is overwritten in place and no older save is kept.
  // The database keeps each slot's line (`saves`) apart from its bytes (`blobs`), so a list never reads the bytes.
  const BUILD = '__BUILD_ID__', SAVE_SLOTS = ['auto', '1', '2', '3'];
  const archOf = (s) => `${s.scenario}-${s.w.seed}-${s.w.COLS}x${s.w.ROWS}`;
  const sizeKey = (cols, rows) => Object.keys(SIZES).find((k) => SIZES[k][0] === cols && SIZES[k][1] === rows);
  const SIZE_NAMES = { t: 'tiny', s: 'small', m: 'medium', l: 'large' };
  function saveLabel(s) {
    const c = Sim.cal(s.t), pl = s.player ? `, playing ${Sim.fullName(s.pawns[s.player.pawn])}` : '';
    return `${s.w.name} (${s.scenario}, seed ${s.w.seed}, ${SIZE_NAMES[sizeKey(s.w.COLS, s.w.ROWS)] || `${s.w.COLS} by ${s.w.ROWS}`}): `
      + `year ${c.year}, ${Sim.SEASONS[c.season]}${pl}`;
  }
  const gzip = (text) => new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
  const gunzip = (blob) => new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text();
  async function packSave(s) {
    const savedAt = Date.now(), label = saveLabel(s);
    return { savedAt, label, blob: await gzip(JSON.stringify({ build: BUILD, savedAt, label, save: Sim.save(s) })) };
  }
  let saveDb = null;
  const openSaves = () => saveDb || (saveDb = new Promise((res, rej) => {
    const r = indexedDB.open('village-builder', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('saves', { keyPath: 'key' }); r.result.createObjectStore('blobs', { keyPath: 'key' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  // One transaction over both stores: f gets them and returns the request whose result is wanted, or nothing.
  async function saveTx(mode, f) {
    const d = await openSaves();
    return new Promise((res, rej) => {
      const t = d.transaction(['saves', 'blobs'], mode), q = f(t.objectStore('saves'), t.objectStore('blobs'));
      t.oncomplete = () => res(q ? q.result : undefined); t.onerror = t.onabort = () => rej(t.error);
    });
  }
  const listSaves = () => saveTx('readonly', (m) => m.getAll());
  const deleteSaves = (keys) => saveTx('readwrite', (m, b) => { for (const k of keys) { m.delete(k); b.delete(k); } });
  async function storeSave(slot) {
    if (!st || demo || unsaved || building || !SAVE_SLOTS.includes(slot)) return null;
    const s = st, arch = archOf(s), key = `${arch}:${slot}`, p = await packSave(s);
    const line = { key, arch, slot, build: BUILD, savedAt: p.savedAt, label: p.label, name: s.w.name, scenario: s.scenario, seed: s.w.seed,
      size: sizeKey(s.w.COLS, s.w.ROWS), bytes: p.blob.size };
    await saveTx('readwrite', (m, b) => { m.put(line); b.put({ key, blob: p.blob }); });
    return line;
  }
  // The save of a slot, read and checked: {save} to load, or {refused} with why. A save of another build is never loaded (Kim, 8 Nov).
  async function readSave(blob) {
    let d;
    try {
      const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
      d = JSON.parse(head[0] === 0x1f && head[1] === 0x8b ? await gunzip(blob) : await blob.text());
    } catch (e) { return { refused: 'This is not a save of the game.' }; }
    if (!d || !(d.save || (d.format && d.state))) return { refused: 'This is not a save of the game.' };
    if (d.build !== BUILD) return { refused: 'Made by another build of the game; it cannot be loaded.', otherBuild: true };
    return { save: d.save };
  }
  // Goes on from a save read from a slot or a file; a file's run takes no slot until it is saved (Kim, 10 Nov).
  async function loadBlob(blob) {
    const r = blob ? await readSave(blob) : { refused: 'That save is gone.' };
    if (r.save && !building) { openPanel(null); await build(r.save.seed, r.save.scenario, sizeKey(r.save.cols, r.save.rows), r.save); }
    return r;
  }
  const loadStored = async (key) => { const rec = await saveTx('readonly', (m, b) => b.get(key)); return loadBlob(rec && rec.blob); };
  async function saveToFile() {
    if (!st || demo || unsaved || building) return;
    const s = st, p = await packSave(s), a = document.createElement('a'), url = URL.createObjectURL(p.blob);
    a.href = url; a.download = `${s.w.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${s.scenario}-${s.w.seed}-year${Sim.cal(s.t).year}.json.gz`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  // ---- the Saves overlay (Kim, 10 Nov), opened from the menu and from the generation screen: the open archipelago first, with its four
  // slots to save to, then each other archipelago's saves, newest first. Continue and Delete a save, or delete an archipelago's saves at
  // once. A save of another build cannot be loaded: it offers Delete it, and Start a new game on the same archipelago. ----
  const savedWhen = (ms) => new Date(ms).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  const OTHER_BUILD = 'Made by another build of the game; it cannot be loaded.';
  const slotName = (slot) => (slot === 'auto' ? 'Auto' : `Slot ${slot}`);
  const saveBtn = (act, value, text) => `<button type="button" data-${act}="${esc(value)}">${text}</button>`;
  function slotRow(slot, l, open) {
    const what = !l ? '<small>empty</small>' : `${esc(l.label.split('): ')[1] || l.label)}<small>${savedWhen(l.savedAt)}, ${
      (l.bytes / 1048576).toFixed(2)} MB</small>${l.build !== BUILD ? `<small class="save-other">${OTHER_BUILD}</small>` : ''}`;
    const acts = (open && slot !== 'auto' ? saveBtn('save', slot, l ? 'Overwrite' : 'Save') : '') + (!l ? ''
      : l.build === BUILD ? saveBtn('load', l.key, 'Continue') + saveBtn('del', l.key, 'Delete')
        : saveBtn('del', l.key, 'Delete it') + saveBtn('new', l.key, 'Start a new game'));
    return `<div class="save-slot"><b>${slotName(slot)}</b><span>${what}</span><div class="save-acts">${acts}</div></div>`;
  }
  const stOpen = () => st; // the game open, which the showcase island is not
  let saveMsg = '', saveLines = [];
  async function drawSaves() {
    const box = $('savesBody'), st = demo || unsaved ? null : stOpen(), fromEditor = !demo && unsaved && stOpen();
    try { saveLines = await listSaves(); } catch (e) { box.innerHTML = '<p class="save-msg">Saves are not available in this browser.</p>'; return; }
    const archs = new Map(), open = st ? archOf(st) : null;
    for (const l of saveLines) { if (!archs.has(l.arch)) archs.set(l.arch, []); archs.get(l.arch).push(l); }
    const newest = (ls) => Math.max(...ls.map((l) => l.savedAt));
    const section = (arch, head, ls, isOpen) => `<section class="save-arch"><h3>${esc(head)}${
      ls.length ? saveBtn('delarch', arch, 'Delete archipelago') : ''}</h3>${
      SAVE_SLOTS.map((s) => [s, ls.find((l) => l.slot === s)]).filter((x) => isOpen || x[1]).map(([s, l]) => slotRow(s, l, isOpen)).join('')}</section>`;
    const others = [...archs].filter(([a]) => a !== open).sort((a, b) => newest(b[1]) - newest(a[1]));
    box.innerHTML = (st ? section(open, saveLabel(st).split('): ')[0] + '), the game open now', archs.get(open) || [], true) : '')
      + others.map(([a, ls]) => section(a, ls[0].label.split('): ')[0] + ')', ls, false)).join('')
      + (fromEditor ? '<p class="save-msg">The game open now was started from the editor, and cannot be saved yet.</p>' : '')
      + (st || others.length ? '' : '<p class="save-msg">No saved games yet.</p>')
      + `<div class="save-acts save-files">${st ? saveBtn('file', 'save', 'Save to file') : ''}${saveBtn('file', 'load', 'Load file')}</div>`
      + (saveMsg ? `<p class="save-msg" role="status">${esc(saveMsg)}</p>` : '');
  }
  function showSaves(on) {
    // It opens from the main menu (VB-307; the game's own Saves button went with its menu panel, VB-338), with Back to the menu: Saves while
    // a game is open, which can be saved there; Load archipelago over the showcase island.
    const menu = !$('landing').hidden;
    $('savesScreen').hidden = !on;
    if (on) {
      $('savesTitle').textContent = st && !demo ? 'Saves' : 'Load archipelago'; $('savesClose').textContent = menu ? 'Back' : 'Close';
      saveMsg = ''; openPanel(null); drawSaves(); $('savesClose').focus();
    } else if (menu) $('landLoad').focus();
  }
  const saveFile = document.createElement('input');
  saveFile.type = 'file'; saveFile.accept = '.gz,.json,application/gzip,application/json'; saveFile.hidden = true; document.body.appendChild(saveFile);
  // Goes on from a slot or a file, and closes the overlay; a refusal is said in it.
  async function loadFrom(blobOf) {
    if (building) return;
    $('savesScreen').hidden = true;
    const r = await blobOf();
    if (r.refused) { showSaves(true); saveMsg = r.refused; drawSaves(); }
  }
  saveFile.addEventListener('change', () => { const f = saveFile.files[0]; saveFile.value = ''; if (f) loadFrom(() => loadBlob(f)); });
  $('savesBody').addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b || building || skipping) return;
    const d = b.dataset;
    try {
      if (d.save) { const l = await storeSave(d.save); saveMsg = l ? `Saved to ${slotName(l.slot).toLowerCase()}.` : ''; }
      else if (d.load) { loadFrom(() => loadStored(d.load)); return; }
      else if (d.del) { await deleteSaves([d.del]); saveMsg = ''; }
      else if (d.delarch) { await deleteSaves(saveLines.filter((l) => l.arch === d.delarch).map((l) => l.key)); saveMsg = ''; }
      else if (d.new) { const l = saveLines.find((x) => x.key === d.new); if (l) { showSaves(false); build(l.seed, l.scenario, l.size); } return; }
      else if (d.file === 'save') { await saveToFile(); saveMsg = 'Saved to a file.'; }
      else if (d.file === 'load') { saveFile.click(); return; }
    } catch (err) { console.warn('save failed', err); saveMsg = 'The save could not be written.'; }
    drawSaves();
  });
  $('savesClose').addEventListener('click', () => showSaves(false));
  $('savesScreen').addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); showSaves(false); } });
  // When the page is hidden the run is saved to its auto slot, unless nothing has passed since the last one.
  let autoAt = -1, autoOf = null;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden' || !st || demo || building || skipping || (autoOf === st && autoAt === st.t)) return;
    autoOf = st; autoAt = st.t;
    storeSave('auto').catch((err) => console.warn('autosave failed', err));
  });
