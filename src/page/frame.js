// @sys page/frame: the frame loop, and opening the page on the generation screen or a #hash
  // ---- frame loop ----
  let time = 0;
  const lodEl = $('lod');
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  let frameErrAt = -1e9;
  const onFrame = (tk) => {
    if (!w) return;
    const dt = Math.min(0.05, tk.deltaMS / 1000);
    time += dt; frameNo++;
    if (intro) {
      intro.t += dt;
      const k = ease(clamp(intro.t / intro.d, 0, 1));
      cam.x = intro.x0 + (intro.x1 - intro.x0) * k; cam.y = intro.y0 + (intro.y1 - intro.y0) * k;
      cam.z = Math.exp(Math.log(intro.z0) + (Math.log(intro.z1) - Math.log(intro.z0)) * k); zt = cam.z;
      if (intro.t >= intro.d) intro = null;
    }
    if (Math.abs(zt - cam.z) > 1e-4) zoomAt(anchor.x, anchor.y, (cam.z + (zt - cam.z) * Math.min(1, dt * 14)) / cam.z);
    if (!drag && !pinch) {
      cam.x += vel.x * dt; cam.y += vel.y * dt;
      const decay = Math.exp(-dt * 4.5); vel.x *= decay; vel.y *= decay;
    }
    if (keys.size) {
      const sp = 700 / cam.z;
      if (keys.has('arrowleft') || keys.has('a')) cam.x -= sp * dt;
      if (keys.has('arrowright') || keys.has('d')) cam.x += sp * dt;
      if (keys.has('arrowup') || keys.has('w')) cam.y -= sp * dt;
      if (keys.has('arrowdown') || keys.has('s')) cam.y += sp * dt;
    }
    if (followPlayed && st && !intro && !drag && !pinch) followCamera();
    // the showcase island behind the menu: the camera drifts slowly about its village
    if (demo && demoAt) {
      const k = reduceMotion ? 0 : 1;
      cam.x = demoAt.x + k * demoAt.r * Math.sin(time * 0.045); cam.y = demoAt.y + k * demoAt.r * 0.6 * Math.sin(time * 0.031 + 1);
    }
    clampCam();
    world.scale.set(cam.z);
    world.position.set(app.screen.width / 2 - cam.x * cam.z, app.screen.height / 2 - cam.y * cam.z);

    T = levelFor(cam.z, T);
    // paint in bigger slices while the view is still; keep frames smooth while it moves
    const busy = intro || drag || pinch || keys.size || Math.abs(vel.x) + Math.abs(vel.y) > 2 || Math.abs(zt - cam.z) > 1e-3;
    if (!building) schedule(intro ? 14 : busy ? 9 : 22);
    display();
    lodEl.hidden = pending === 0;
    if (pending) lodEl.textContent = `Painting detail, ${pending} ${pending === 1 ? 'area' : 'areas'} left`;

    // sea: the rows of wave scrolls only once they are big enough not to shimmer
    const wa = clamp((cam.z - 0.14) / 0.3, 0, 1);
    L.waves.visible = wa > 0.01;
    if (!reduceMotion) waves[0].tilePosition.x += 5 * dt;
    waves[0].alpha = (0.42 + (reduceMotion ? 0 : 0.06 * Math.sin(time * 0.8))) * wa;
    // clouds: visible on the overview, thinning out as you descend
    const zm = zMin(), fade = clamp((zm * 2.3 - cam.z) / (zm * 1.3), 0, 1);
    L.clouds.visible = L.shadows.visible = fade > 0.01;
    L.clouds.alpha = 0.85 * fade; L.shadows.alpha = 0.16 * fade;
    for (const c of clouds) {
      if (!reduceMotion) { c.spr.x += c.vx * dt; c.spr.y += c.vy * dt; }
      const hw = c.spr.width / 2;
      if (c.spr.x - hw > w.W + 200 * w.KS) c.spr.x = -hw - 200 * w.KS;
      c.sh.x = c.spr.x + 120 * w.KS; c.sh.y = c.spr.y + 90 * w.KS;
    }
    updateGrid();
    updateSettlement(dt);
    L.regions.alpha = clamp(1.25 - cam.z, 0.35, 1);
    if (hoverDirty || sel >= 0) { drawHover(); hoverDirty = false; }
    drawMinimapView();
  };
  // Pixi stops its ticker for good when a frame throws; catch it, say so, and keep the game running.
  app.ticker.add((tk) => {
    try { onFrame(tk); }
    catch (e) {
      console.error(e);
      if (performance.now() - frameErrAt > 5000) {
        frameErrAt = performance.now(); lodEl.hidden = false; lodEl.textContent = `Something went wrong in a frame: ${e.message}`; }
    }
  });

  // The page opens on the generation screen. A hash skips it: #<scenario><size><seed>, scenario s (founders), h (heirs) or p (populous),
  // size t, s, m or l (medium if left out); e.g. #s123, #h123, #pt123 (populous, tiny). #123 is founders on a medium map.
  const hm = location.hash.match(/^#([shp]?)([tsml]?)(\d{1,9})$/);
  if (hm) build(+hm[3], { s: 'founders', h: 'heirs', p: 'populous', '': 'founders' }[hm[1]], hm[2] || 'm');
  else { showLanding(); startDemo(); }
