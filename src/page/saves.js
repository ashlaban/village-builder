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
  const deleteSave = (key) => saveTx('readwrite', (m, b) => { m.delete(key); b.delete(key); });
  async function storeSave(slot) {
    if (!st || building || !SAVE_SLOTS.includes(slot)) return null;
    const s = st, arch = archOf(s), key = `${arch}:${slot}`, p = await packSave(s);
    const line = { key, arch, slot, build: BUILD, savedAt: p.savedAt, label: p.label, name: s.w.name, t: s.t, bytes: p.blob.size };
    await saveTx('readwrite', (m, b) => { m.put(line); b.put({ key, blob: p.blob }); });
    return line;
  }
  // The save of a slot, read and checked: {save} to load, or {refused} with why. A save of another build is never loaded (Kim, 8 Nov).
  async function readSave(blob) {
    let d;
    try { d = JSON.parse(await gunzip(blob)); } catch (e) { return { refused: 'This is not a save of the game.' }; }
    if (!d || !d.save) return { refused: 'This is not a save of the game.' };
    if (d.build !== BUILD) return { refused: 'Made by another build of the game; it cannot be loaded.', otherBuild: true };
    return { save: d.save };
  }
  async function loadStored(key) {
    const rec = await saveTx('readonly', (m, b) => b.get(key));
    const r = rec ? await readSave(rec.blob) : { refused: 'That save is gone.' };
    if (r.save && !building) { openPanel(null); await build(r.save.seed, r.save.scenario, sizeKey(r.save.cols, r.save.rows), r.save); }
    return r;
  }
  // ---- the menu's slots: this archipelago's four, each with when it was saved; Save writes over the slot ----
  const savedWhen = (ms) => new Date(ms).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  let saveMsg = '';
  async function drawSaveSlots() {
    const box = $('saveSlots');
    if (!st) { box.innerHTML = ''; return; }
    let lines = [];
    try { lines = await listSaves(); } catch (e) { box.innerHTML = '<p class="save-msg">Saves are not available in this browser.</p>'; return; }
    const arch = archOf(st), by = new Map(lines.filter((l) => l.arch === arch).map((l) => [l.slot, l]));
    box.innerHTML = SAVE_SLOTS.map((slot) => {
      const l = by.get(slot), other = l && l.build !== BUILD;
      const what = l ? `${esc(l.label.split('): ')[1] || l.label)}<small>${savedWhen(l.savedAt)}, ${(l.bytes / 1048576).toFixed(2)} MB${
        other ? '; another build' : ''}</small>` : '<small>empty</small>';
      return `<div class="save-slot"><b>${slot === 'auto' ? 'Auto' : `Slot ${slot}`}</b><span>${what}</span>${
        slot === 'auto' ? '' : `<button type="button" data-save="${slot}">${l ? 'Overwrite' : 'Save'}</button>`}${
        l && !other ? `<button type="button" data-load="${l.key}">Load</button>` : ''}</div>`;
    }).join('') + (saveMsg ? `<p class="save-msg" role="status">${esc(saveMsg)}</p>` : '');
  }
  $('saveSlots').addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b || building || skipping) return;
    try {
      if (b.dataset.save) { const l = await storeSave(b.dataset.save); saveMsg = l ? `Saved to slot ${l.slot}.` : ''; }
      else if (b.dataset.load) { const r = await loadStored(b.dataset.load); saveMsg = r.refused || ''; }
    } catch (err) { console.warn('save failed', err); saveMsg = 'The save could not be written.'; }
    drawSaveSlots();
  });
  // When the page is hidden the run is saved to its auto slot, unless nothing has passed since the last one.
  let autoAt = -1, autoOf = null;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden' || !st || building || skipping || (autoOf === st && autoAt === st.t)) return;
    autoOf = st; autoAt = st.t;
    storeSave('auto').then(drawSaveSlots).catch((err) => console.warn('autosave failed', err));
  });
