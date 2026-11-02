// @sys page/minimap: the minimap
  // ---- minimap ----
  const mmBase = $('mmBase'), mmView = $('mmView'), mmBox = $('minimap');
  let mmLast = '';
  function drawMinimap(wd, wc, over) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), cw = Math.round(mmBox.clientWidth * dpr), ch = Math.round((cw * wd.H) / wd.W);
    for (const c of [mmBase, mmView]) { c.width = cw; c.height = ch; }
    const g = mmBase.getContext('2d'), k = cw / wd.W, s = LV[2].size;
    g.imageSmoothingQuality = 'high';
    g.drawImage(wc, 0, 0, wc.width * wd.STEP * k, wc.height * wd.STEP * k);
    for (const o of over) g.drawImage(o.canvas, o.cx * s * k, o.cy * s * k, s * k, s * k);
    mmLast = '';
  }
  function drawMinimapView() {
    const vw = app.screen.width / cam.z, vh = app.screen.height / cam.z;
    const key = `${cam.x.toFixed(1)},${cam.y.toFixed(1)},${cam.z.toFixed(4)},${mmView.width}`;
    if (key === mmLast) return; mmLast = key;
    const g = mmView.getContext('2d'), sx = mmView.width / w.W, sy = mmView.height / w.H;
    g.clearRect(0, 0, mmView.width, mmView.height);
    const x = (cam.x - vw / 2) * sx, y = (cam.y - vh / 2) * sy, rw = vw * sx, rh = vh * sy;
    g.fillStyle = 'rgba(4,18,28,0.32)';
    g.fillRect(0, 0, mmView.width, mmView.height);
    g.clearRect(x, y, rw, rh);
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = Math.max(1.5, mmView.width / 120);
    g.strokeRect(x, y, rw, rh);
  }
  function mmJump(e) {
    if (!w) return;
    const r = mmBox.getBoundingClientRect();
    stopIntro(); vel.x = vel.y = 0;
    cam.x = ((e.clientX - r.left) / r.width) * w.W; cam.y = ((e.clientY - r.top) / r.height) * w.H;
  }
  mmBox.addEventListener('pointerdown', (e) => { mmBox.setPointerCapture(e.pointerId); mmJump(e); });
  mmBox.addEventListener('pointermove', (e) => { if (e.buttons) mmJump(e); });

