// @sys page/input: input: drag, pinch, wheel, keys, buttons and the speed control
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
    if (!p) { if (e.pointerType === 'mouse') pick(e.clientX, e.clientY); return; }
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
    if (e.pointerType === 'mouse' && !pointers.size) { sel = -1; selPawn = -1; hoverDirty = true; showTile(-1); } });
  stage.addEventListener('wheel', (e) => {
    e.preventDefault(); stopIntro();
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zt = clamp(zt * Math.exp(-dy * (e.ctrlKey ? 0.008 : 0.0016)), zMin(), zMax);
    anchor = { x: e.clientX, y: e.clientY };
  }, { passive: false });

  const keys = new Set();
  window.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('button')) return;
    if (!$('tree').hidden) return;
    const k = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd'].includes(k)) { keys.add(k); stopIntro(); e.preventDefault(); }
    if (k === ' ') { e.preventDefault(); setSpeed(speed === 0 ? lastSpeed : 0); }
    if (k === '1' || k === '2' || k === '3') setSpeed({ 1: 1, 2: 3, 3: 10 }[k]);
    if (k === '+' || k === '=' || k === '-') {
      stopIntro();
      const r = stage.getBoundingClientRect();
      anchor = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      zt = clamp(zt * (k === '-' ? 0.8 : 1.25), zMin(), zMax);
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  $('regen').addEventListener('click', () => { if (!building && !skipping) showGenScreen(); });
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
  toggle($('settlersBtn'), (on) => { $('settlers').hidden = !on; if (on && st) { settlersHTML = ''; renderSettlers(); } });
  let lastSpeed = 1;
  function setSpeed(v) {
    if (v > 0) lastSpeed = v;
    speed = v;
    document.querySelectorAll('.speed button').forEach((bt) => bt.setAttribute('aria-pressed', String(+bt.dataset.speed === v)));
  }
  document.querySelectorAll('.speed button').forEach((bt) => bt.addEventListener('click', () => setSpeed(+bt.dataset.speed)));

