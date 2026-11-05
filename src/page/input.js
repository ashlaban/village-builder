// @sys page/input: map input, panel navigation, UI visibility and speed controls
  // ---- input ----
  const pointers = new Map();
  let drag = null, pinch = null, moved = 0;
  stage.addEventListener('pointerdown', (e) => {
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    stopIntro(); vel.x = vel.y = 0; zt = cam.z;
    if (pointers.size === 1) { drag = { t: performance.now() }; moved = 0; pinch = null; stage.classList.add('dragging'); }
    else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: cam.z, m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      drag = null; moved = 99;
    }
  });
  stage.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) { if (e.pointerType === 'mouse') pick(e.clientX, e.clientY, false); return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      cam.x -= (mx - pinch.m.x) / cam.z; cam.y -= (my - pinch.m.y) / cam.z;
      zoomAt(mx, my, (pinch.z * d) / pinch.d / cam.z);
      pinch.m = { x: mx, y: my }; zt = cam.z;
    } else if (drag) {
      moved += Math.abs(dx) + Math.abs(dy);
      cam.x -= dx / cam.z; cam.y -= dy / cam.z;
      const now = performance.now(), dt = Math.max(8, now - drag.t) / 1000;
      vel.x = 0.75 * vel.x + 0.25 * (-dx / cam.z / dt); vel.y = 0.75 * vel.y + 0.25 * (-dy / cam.z / dt);
      drag.t = now;
    }
  });
  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      if (drag && moved < 8) pick(e.clientX, e.clientY);
      if (!drag || performance.now() - drag.t > 90) { vel.x = vel.y = 0; }
      drag = null; pinch = null; stage.classList.remove('dragging');
    } else if (pointers.size === 1) {
      pinch = null; drag = { t: performance.now() }; vel.x = vel.y = 0;
    }
  }
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);
  stage.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && !pointers.size && !selectionPinned) {
      sel = -1; selPawn = -1; hoverDirty = true; showTile(-1);
    } });
  stage.addEventListener('wheel', (e) => {
    e.preventDefault(); stopIntro();
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zt = clamp(zt * Math.exp(-dy * (e.ctrlKey ? 0.008 : 0.0016)), zMin(), zMax);
    anchor = { x: e.clientX, y: e.clientY };
  }, { passive: false });

  const keys = new Set();
  window.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!$('tree').hidden) {
      if (e.key === 'Escape') { e.preventDefault(); closeTree(); }
      return;
    }
    if (e.key === 'Escape' && !(e.target.closest && e.target.closest('input, select, textarea'))) {
      closeSpeedOptions(); openPanel(null); return;
    }
    if (e.key.toLowerCase() === 'h' && !(e.target.closest && e.target.closest('input, select, textarea'))) { toggleUI(); return; }
    if (e.target.closest && e.target.closest('button, input, select, textarea, summary, .table-scroll')) return;
    const k = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd'].includes(k)) { keys.add(k); stopIntro(); e.preventDefault(); }
    if (k === ' ') { e.preventDefault(); setSpeed(speed === 0 ? lastSpeed : 0); }
    if (/^[1-5]$/.test(k)) setSpeed({ 1: 1, 2: 3, 3: 10, 4: 30, 5: Infinity }[k]);
    if (k === '+' || k === '=' || k === '-') {
      stopIntro();
      const r = stage.getBoundingClientRect();
      anchor = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      zt = clamp(zt * (k === '-' ? 0.8 : 1.25), zMin(), zMax);
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  $('regen').addEventListener('click', () => { if (!building && !skipping) { openPanel(null); showGenScreen(); } });
  $('genCancel').addEventListener('click', () => { $('genScreen').hidden = true; $(mobileUI.matches ? 'menuBtn' : 'regen').focus(); });
  $('genForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const seed = $('genSeed').value.trim();
    if (!/^\d{1,9}$/.test(seed)) { $('genMsg').textContent = 'The seed is a whole number of up to 9 digits.'; $('genMsg').hidden = false; return; }
    if (!building) build(+seed, $('genScenario').value, $('genSize').value);
  });
  function toggle(btn, fn) {
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on)); fn(on);
    });
  }
  toggle($('gridBtn'), (on) => { gridOn = on; });
  toggle($('regionBtn'), (on) => { L.regions.visible = on; });
  toggle($('landBtn'), (on) => { landOn = on; L.land.visible = on; if (on) drawLand(); });
  // Panel choices and folds belong to the page, never to saved simulation state.
  const mobileUI = matchMedia('(max-width: 1024px)');
  let activePanel = null, selectionPinned = false;
  function closeSpeedOptions() {
    $('clock').classList.remove('speed-open'); $('speedBtn').setAttribute('aria-expanded', 'false');
    $('speedOptions').inert = mobileUI.matches;
  }
  function openPanel(panel) {
    activePanel = panel; closeSpeedOptions();
    $('peopleSheet').hidden = panel !== 'people'; $('settlers').hidden = panel !== 'people';
    $('tile').hidden = panel !== 'tile';
    $('drawer').hidden = !['customs', 'debug'].includes(panel);
    drawerTab = ['customs', 'debug'].includes(panel) ? panel : null;
    $('worldMenu').hidden = mobileUI.matches && panel !== 'menu';
    $('settlersBtn').setAttribute('aria-pressed', String(panel === 'people'));
    $('customsBtn').setAttribute('aria-pressed', String(panel === 'customs'));
    $('debugBtn').setAttribute('aria-pressed', String(panel === 'debug'));
    $('menuBtn').setAttribute('aria-pressed', String(panel === 'menu'));
    if (mobileUI.matches && panel) setMinimap(false);
    if (document.body.classList.contains('ui-hidden')) $('minimap').inert = true;
    if (panel === 'people' && st) { settlersHTML = ''; renderSettlers(); }
  }
  function toggleUI() {
    const hidden = document.body.classList.toggle('ui-hidden');
    $('uiToggle').textContent = hidden ? 'Show UI' : 'Hide UI';
    $('uiToggle').setAttribute('aria-pressed', String(hidden));
    for (const el of document.querySelectorAll('.hud, .navigation, .sheet')) el.inert = hidden;
    closeSpeedOptions(); $('uiToggle').focus();
  }
  function setMinimap(on) {
    document.body.classList.toggle('minimap-open', on);
    $('minimapBtn').setAttribute('aria-pressed', String(on));
    $('minimap').inert = !on;
    if (!mobileUI.matches) $('minimap').style.visibility = on ? '' : 'hidden';
  }
  function adaptUI() {
    $('worldMenu').hidden = mobileUI.matches && activePanel !== 'menu';
    $('minimap').style.visibility = '';
    setMinimap(!mobileUI.matches); closeSpeedOptions();
  }
  if (mobileUI.addEventListener) mobileUI.addEventListener('change', adaptUI);
  $('uiToggle').addEventListener('click', toggleUI);
  $('menuBtn').addEventListener('click', () => openPanel(activePanel === 'menu' ? null : 'menu'));
  $('menuClose').addEventListener('click', () => { openPanel(null); $('menuBtn').focus(); });
  $('settlersBtn').addEventListener('click', () => openPanel(activePanel === 'people' ? null : 'people'));
  $('peopleClose').addEventListener('click', () => { openPanel(null); $('settlersBtn').focus(); });
  $('tileClose').addEventListener('click', () => {
    selPawn = -1; sel = -1; selectionPinned = false; hoverDirty = true; openPanel(null); $('settlersBtn').focus();
  });
  $('personFamily').addEventListener('click', () => { treeSel = selPawn; openTree(); });
  $('minimapBtn').addEventListener('click', () => {
    const on = $('minimapBtn').getAttribute('aria-pressed') !== 'true';
    if (mobileUI.matches) openPanel(null);
    setMinimap(on);
  });
  $('minimapClose').addEventListener('click', () => {
    setMinimap(false); $(mobileUI.matches ? 'menuBtn' : 'minimapBtn').focus();
  });
  document.querySelectorAll('.sheet-expand').forEach((button) => button.addEventListener('click', () => {
    const collapsed = $(button.dataset.sheet).classList.toggle('collapsed');
    button.setAttribute('aria-expanded', String(!collapsed));
    button.textContent = collapsed ? (button.dataset.sheet === 'tile' ? 'Details' : 'Expand') : 'Collapse';
    if (!collapsed && button.dataset.sheet === 'peopleSheet') renderSettlers();
    if (!collapsed && button.dataset.sheet === 'drawer') renderDrawer();
  }));
  $('speedBtn').addEventListener('click', () => {
    const open = $('clock').classList.toggle('speed-open');
    $('speedBtn').setAttribute('aria-expanded', String(open)); $('speedOptions').inert = !open;
  });
  document.addEventListener('pointerdown', (e) => { if (!$('clock').contains(e.target)) closeSpeedOptions(); });
  $('pauseBtn').addEventListener('click', () => setSpeed(speed === 0 ? lastSpeed : 0));
  adaptUI();
  let lastSpeed = 1;
  function setSpeed(v) {
    if (v > 0) lastSpeed = v;
    speed = v;
    resetSpeedSample();
    $('pauseBtn').textContent = v === 0 ? 'Play' : 'Pause';
    $('pauseBtn').setAttribute('aria-label', v === 0 ? 'Resume game' : 'Pause game');
    const chosen = v === 0 ? lastSpeed : v;
    $('speedBtn').textContent = chosen === Infinity ? 'Max' : `${chosen}×`;
    document.querySelectorAll('.speed button').forEach((bt) => bt.setAttribute('aria-pressed', String(+bt.dataset.speed === v)));
  }
  document.querySelectorAll('.speed button').forEach((bt) =>
    bt.addEventListener('click', () => { setSpeed(+bt.dataset.speed); closeSpeedOptions(); if (mobileUI.matches) $('speedBtn').focus(); }));

