// @sys page/input: map input, panel navigation, UI visibility and speed controls
  // ---- input ----
  const pointers = new Map();
  let drag = null, pinch = null, moved = 0;
  // A brush on the map (page/editor): while one is held, a drag of one pointer paints, by mapBrush(sx, sy, first), and does not move the
  // map; two fingers, the wheel and the keys still do. `stroke`: such a drag is under way.
  let mapBrush = null, stroke = false;
  stage.addEventListener('pointerdown', (e) => {
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    stopIntro(); vel.x = vel.y = 0; zt = cam.z;
    if (pointers.size === 1 && mapBrush && e.button === 0) { stroke = true; drag = null; pinch = null; mapBrush(e.clientX, e.clientY, true); }
    else if (pointers.size === 1) { drag = { t: performance.now() }; moved = 0; pinch = null; stage.classList.add('dragging'); }
    else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: cam.z, m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      drag = null; moved = 99;
      if (stroke) { stroke = false; if (mapBrush) mapBrush(e.clientX, e.clientY, null); } // a second finger ends the stroke
    }
  });
  stage.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) { if (e.pointerType === 'mouse') pick(e.clientX, e.clientY, false); return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (stroke && mapBrush) { mapBrush(e.clientX, e.clientY, false); return; }
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      cam.x -= (mx - pinch.m.x) / cam.z; cam.y -= (my - pinch.m.y) / cam.z;
      zoomAt(mx, my, (pinch.z * d) / pinch.d / cam.z);
      pinch.m = { x: mx, y: my }; zt = cam.z;
    } else if (drag) {
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved >= 8) followPlayed = false; // dragging the map lets go of the played pawn (page/play)
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
      if (stroke) { stroke = false; if (mapBrush) mapBrush(e.clientX, e.clientY, null); return; } // null: the stroke is over
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
  const SHORTCUTS = {
    p: 'settlersBtn', t: 'treeBtn', c: 'customsBtn', g: 'gridBtn', r: 'regionBtn', l: 'landBtn', o: 'groundBtn', m: 'minimapBtn', f: 'centre' };
  window.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!$('tree').hidden) {
      if (e.key === 'Escape') { e.preventDefault(); closeTree(); }
      return;
    }
    // While choosing whom to play (page/choose) the map moves and zooms by its keys, and the rest of the interface's keys wait
    // In the archipelago editor (page/editor) too; there Esc is its Main menu
    const editing = !$('editor').hidden && $('landing').hidden && $('genScreen').hidden;
    if (editing && e.key === 'Escape' && !(e.target.closest && e.target.closest('input, select, textarea'))) { $('edMenu').click(); return; }
    const choosing = editing || (!$('choose').hidden && $('landing').hidden && $('genScreen').hidden);
    if (choosing && !/^(arrow(left|right|up|down)|[wasd+=-])$/.test(e.key.toLowerCase())) return;
    // Esc closes what is open; with nothing open it opens the main menu, and on the main menu it goes back to the game (VB-338)
    if (e.key === 'Escape' && !(e.target.closest && e.target.closest('input, select, textarea'))) {
      if (!$('landing').hidden) { if (!$('landBack').hidden) $('landBack').click(); return; }
      if (!$('genScreen').hidden) { startBack(); return; } // on the start, Main menu
      if (tool || barMenu) { if (tool) endTool(); else closeBarMenu(); renderActions(); return; } // the action bar's tool, then its list (page/actbar)
      const open = activePanel !== null || barOpen || $('clock').classList.contains('speed-open') || !$('noticePop').hidden;
      closeSpeedOptions(); closeNotices(); openPanel(null); closeBar();
      if (!open && st && !demo && !building && !skipping && $('genScreen').hidden) showLanding();
      return;
    }
    if (!$('genScreen').hidden || !$('landing').hidden) return; // a menu screen is up: the game's keys wait
    if (e.key.toLowerCase() === 'h' && !(e.target.closest && e.target.closest('input, select, textarea'))) { toggleUI(); return; }
    // panels and layers by a letter, wherever the focus is but in a text field; F centres the map on the selection
    const press = SHORTCUTS[e.key.toLowerCase()];
    if (press && !e.shiftKey && !(e.target.closest && e.target.closest('input, select, textarea')) && !document.body.classList.contains('ui-hidden')) {
      if (press === 'centre') centreSelection(); else $(press).click();
      return;
    }
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

  // Main menu, at the top bar's end (VB-338): the main menu, over the paused game; it has Back to game, so the button is put away with the bar
  $('menuBtn').addEventListener('click', () => { if (!building && !skipping) { openPanel(null); showLanding(); } });
  $('genMenu').addEventListener('click', () => startBack());
  $('landNew').addEventListener('click', () => openStart());
  // Quick start: a tiny populous island at one of the seeds that hold its villages, with no start screen and no choice of whom to play
  $('landQuick').addEventListener('click', () => { if (!building) build(DEMO.seeds[(Math.random() * DEMO.seeds.length) | 0], 'populous', 't', null, true); });
  $('landLoad').addEventListener('click', () => showSaves(true));
  $('landBack').addEventListener('click', () => { $('landing').hidden = true; $('menuBtn').focus(); });
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
  toggle($('groundBtn'), (on) => setGround(on));
  // Panel choices and folds belong to the page, never to saved simulation state.
  const mobileUI = matchMedia('(max-width: 1024px)');
  let activePanel = null, selectionPinned = false;
  function closeSpeedOptions() {
    $('clock').classList.remove('speed-open'); $('speedBtn').setAttribute('aria-expanded', 'false');
    $('speedOptions').inert = mobileUI.matches;
  }
  function openPanel(panel) {
    activePanel = panel; closeSpeedOptions();
    $('actionSheet').hidden = panel !== 'actions';
    // the action bar (page/actbar): its Queue opens the sheet, and stays open beside the card; the dock's other panels put it away
    if (panel === 'actions') barOpen = true; else if (panel && panel !== 'tile') { barOpen = false; endTool(); }
    if (panel) barMenu = null;
    paintBar();
    $('peopleSheet').hidden = panel !== 'people'; $('settlers').hidden = panel !== 'people';
    $('tile').hidden = panel !== 'tile';
    $('drawer').hidden = !['customs', 'debug'].includes(panel);
    drawerTab = ['customs', 'debug'].includes(panel) ? panel : null;
    $('settlersBtn').setAttribute('aria-pressed', String(panel === 'people'));
    $('customsBtn').setAttribute('aria-pressed', String(panel === 'customs'));
    $('debugBtn').setAttribute('aria-pressed', String(panel === 'debug'));
    if (mobileUI.matches && panel) setMinimap(false);
    if (document.body.classList.contains('ui-hidden')) $('minimap').inert = true;
    if (panel === 'people' && st) { settlersHTML = ''; renderSettlers(); }
    if (panel === 'actions' && st) renderActions();
  }
  // The eye at the end of the top bar hides the interface; it alone stays, where it was, to bring it back (VB-338).
  function paintUIToggle(hidden) {
    $('uiToggle').innerHTML = hidden ? ICON.eye : ICON.eyeOff;
    $('uiToggle').title = hidden ? 'Show the interface (H)' : 'Hide the interface (H)';
    $('uiToggle').setAttribute('aria-pressed', String(hidden));
  }
  paintUIToggle(false);
  function toggleUI() {
    const hidden = document.body.classList.toggle('ui-hidden');
    paintUIToggle(hidden);
    for (const el of document.querySelectorAll('#clock > :not(#uiToggle), .navigation, .sheet, .map-bar, .act-bar, .act-menu, .act-banner')) el.inert = hidden;
    closeSpeedOptions(); closeNotices(); $('uiToggle').focus();
  }
  // The minimap's toggle is the right end of the map's bar (VB-338): shut, it puts away the minimap and the bar's other buttons, and alone stays.
  function setMinimap(on) {
    document.body.classList.toggle('minimap-open', on);
    $('minimapBtn').setAttribute('aria-pressed', String(on));
    $('minimap').inert = !on;
    if (!on) closeNotices();
  }
  function adaptUI() { setMinimap(!mobileUI.matches); closeSpeedOptions(); }
  if (mobileUI.addEventListener) mobileUI.addEventListener('change', adaptUI);
  $('uiToggle').addEventListener('click', toggleUI);
  $('settlersBtn').addEventListener('click', () => openPanel(activePanel === 'people' ? null : 'people'));
  $('actionsBtn').addEventListener('click', () => (barOpen ? closeBar() : openBar()));
  $('actionClose').addEventListener('click', () => { openPanel(null); $(barOpen ? 'queueBtn' : 'actionsBtn').focus(); });
  $('peopleClose').addEventListener('click', () => { openPanel(null); $('settlersBtn').focus(); });
  $('tileClose').addEventListener('click', () => {
    selPawn = -1; sel = -1; selVillage = -1; selFarm = -1; selectionPinned = false; hoverDirty = true; openPanel(null); $('settlersBtn').focus();
  });
  $('personFamily').addEventListener('click', () => { treeSel = selPawn; openTree(); });
  $('minimapBtn').addEventListener('click', () => {
    const on = $('minimapBtn').getAttribute('aria-pressed') !== 'true';
    if (mobileUI.matches) openPanel(null);
    setMinimap(on);
  });
  // A panel's fold is a chevron (VB-338); its name says what a press does: Collapse, or Details (a card) or Expand (a panel).
  function nameFold(button) {
    const name = button.getAttribute('aria-expanded') === 'true' ? 'Collapse' : button.dataset.sheet === 'tile' ? 'Details' : 'Expand';
    button.setAttribute('aria-label', name); button.title = name;
  }
  document.querySelectorAll('.sheet-expand').forEach((button) => button.addEventListener('click', () => {
    const collapsed = $(button.dataset.sheet).classList.toggle('collapsed');
    button.setAttribute('aria-expanded', String(!collapsed)); nameFold(button);
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
  // Pause and the speeds are icons (VB-338): pause, then one to five arrows (page/icons); the phone's two buttons show the pause or play
  // to come and the speed chosen.
  function paintSpeed(v) {
    const chosen = v === 0 ? lastSpeed : v, name = chosen === Infinity ? 'uncapped' : `${chosen}×`;
    $('pauseBtn').innerHTML = v === 0 ? ICON.play : ICON.pause;
    $('pauseBtn').setAttribute('aria-label', v === 0 ? 'Resume game' : 'Pause game');
    $('pauseBtn').title = v === 0 ? 'Resume (Space)' : 'Pause (Space)';
    $('speedBtn').innerHTML = speedIcon(chosen);
    $('speedBtn').setAttribute('aria-label', `Game speed: ${name}`); $('speedBtn').title = `Game speed: ${name}`;
    document.querySelectorAll('.speed button').forEach((bt) => bt.setAttribute('aria-pressed', String(+bt.dataset.speed === v)));
  }
  document.querySelectorAll('.speed button').forEach((bt) => { bt.innerHTML = +bt.dataset.speed === 0 ? ICON.pause : speedIcon(+bt.dataset.speed); });
  paintSpeed(1); // the page opens at 1×
  function setSpeed(v) {
    if (v > 0) lastSpeed = v;
    speed = v;
    cancelSkip(); // choosing a speed, or pausing, ends a skip to the next event (page/speed)
    resetSpeedSample();
    paintSpeed(v);
  }
  document.querySelectorAll('.speed button').forEach((bt) =>
    bt.addEventListener('click', () => { setSpeed(+bt.dataset.speed); closeSpeedOptions(); if (mobileUI.matches) $('speedBtn').focus(); }));

