// @sys page/setup: start-up of the page script: the PixiJS app, daylight wash, layers, static textures (waves, clouds), and the camera state
  const G = ArchGen, LV = G.LV, TEX = G.TEX, Rivers = VB['gen/rivers'], Paths = VB['gen/paths'];
  const $ = (id) => document.getElementById(id);
  const stage = $('stage');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const makeCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  $('hint').textContent = coarse ? 'Drag to explore, pinch to zoom, tap a settler, farm, village name or tile for details.' :
    'Drag to explore, scroll to zoom. Point for a glance, click to keep it open. Keys: P people, T family, C customs, F centre, Space pause.';

  function failed(msg) {
    const p = $('loadText'); p.textContent = msg; p.classList.add('err');
    document.querySelector('.loader .bar').style.display = 'none';
  }
  if (!window.PIXI) { failed('The rendering library didn’t load. Check your connection and reload the page.'); return; }
  const app = new PIXI.Application();
  try {
    await app.init({ resizeTo: stage, background: '#16395f', antialias: true, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2),
      preference: 'webgl' });
  } catch (e) { failed('This browser couldn’t start WebGL, which the map needs. Try another browser or enable hardware acceleration.'); return; }
  stage.appendChild(app.canvas);
  // Daylight: a dark wash over the map that follows Sim.dark: full day, 2 hours of dusk before the dark, night, 2 hours of dawn after it.
  const dayLight = document.createElement('div'); dayLight.id = 'dayLight';
  dayLight.style.cssText = 'position:absolute;inset:0;pointer-events:none;background:#0a1830;opacity:0';
  stage.appendChild(dayLight);
  function lightAt(hour, c) {
    const [a, b] = Sim.dark(c), len = (b - a + 24) % 24, since = (hour - a + 24) % 24; // hours since the dark began
    if (since < len) return 1;
    const dawn = since - len; if (dawn < 2) return 1 - dawn / 2;
    const dusk = 24 - since; return dusk <= 2 ? 1 - dusk / 2 : 0;
  }
  const texFrom = (canvas, opts = {}) => new PIXI.Texture({ source: new PIXI.CanvasSource({ resource: canvas, ...opts }) });

  // ---- layers, bottom to top ----
  const world = new PIXI.Container();
  app.stage.addChild(world);
  const L = {};
  for (const k of ['water', 'waves', 'lod2', 'lod1', 'lod0', 'fields', 'fences', 'land', 'grid', 'regions', 'objects', 'labels', 'hover', 'shadows',
    'clouds']) { L[k] = new PIXI.Container(); world.addChild(L[k]); }
  const lodLayer = [L.lod0, L.lod1, L.lod2];
  L.regions.visible = false; L.land.visible = false;

  // ---- static textures ----
  let SPR = null; // the trees and shrubs the chunks are decorated with: landSprites (page/farmart), made at the first chunk
  function waveCanvas(seed, n, alpha) {
    const S = 256, c = makeCanvas(S, S), g = c.getContext('2d'), r = G.mulberry32(seed);
    g.lineCap = 'round';
    for (let k = 0; k < n; k++) {
      const x = r() * S, y = r() * S, rad = 5 + r() * 9, a0 = Math.PI * (1.2 + r() * 0.1), a1 = Math.PI * (1.68 + r() * 0.12);
      g.strokeStyle = `rgba(255,255,255,${alpha * (0.5 + r() * 0.5)})`; g.lineWidth = 1 + r() * 0.7;
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { g.beginPath(); g.arc(x + ox, y + oy, rad, a0, a1); g.stroke(); }
    }
    return c;
  }
  const PSTY = globalThis.VB_STYLE || {}; // PROTOTYPE
  // ordered rows of wave scrolls, as a painted sea
  function waveCanvasMural() {
    const S = 256, c = makeCanvas(S, S), g = c.getContext('2d');
    g.lineCap = 'round'; g.strokeStyle = 'rgba(236,240,226,1)'; g.lineWidth = 1.5;
    for (let row = 0; row < 4; row++) for (let k = 0; k < 2; k++) {
      const x = k * 128 + (row % 2) * 64 + 18, y = row * 64 + 30;
      for (const ox of [-S, 0]) {
        g.beginPath(); g.moveTo(x + ox, y); g.quadraticCurveTo(x + ox + 9, y - 9, x + ox + 18, y); g.quadraticCurveTo(x + ox + 27, y - 9, x + ox + 36, y);
        g.quadraticCurveTo(x + ox + 45, y - 9, x + ox + 54, y); g.stroke(); }
    }
    return c;
  }
  // a flat cloud of scallops inside one contour
  function cloudCanvasMural(seed) {
    const c = makeCanvas(400, 240), g = c.getContext('2d'), r = G.mulberry32(seed), pts = [];
    for (let k = 0; k < 9; k++) {
      const u = k / 8; pts.push([70 + u * 260 + (r() - 0.5) * 16, 150 - Math.sin(u * Math.PI) * (26 + r() * 22), 30 + Math.sin(u * Math.PI) * 26 + r() * 10]); }
    g.save(); g.beginPath(); g.rect(0, 0, 400, 164); g.clip();
    g.strokeStyle = '#2c201c'; g.lineWidth = 7; for (const [x, y, rad] of pts) { g.beginPath(); g.arc(x, y, rad, 0, 7); g.stroke(); }
    g.fillStyle = 'rgb(244,240,226)'; for (const [x, y, rad] of pts) { g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(120,130,140,0.7)'; g.lineWidth = 2.2;
    for (const [x, y, rad] of pts) { g.beginPath(); g.arc(x, y + 3, rad * 0.6, Math.PI * 1.1, Math.PI * 1.75); g.stroke(); }
    g.restore();
    g.strokeStyle = '#2c201c'; g.lineWidth = 3.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(pts[0][0] - pts[0][2], 164);
      g.lineTo(pts[8][0] + pts[8][2], 164); g.stroke();
    return c;
  }
  function cloudCanvas(seed) {
    const c = makeCanvas(400, 240), g = c.getContext('2d'), r = G.mulberry32(seed);
    for (let k = 0; k < 28; k++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r());
      const x = 200 + Math.cos(a) * d * 115, y = 122 + Math.sin(a) * d * 48, rad = 26 + r() * 42 * (1 - d * 0.45);
      const gr = g.createRadialGradient(x, y - rad * 0.25, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(255,255,255,0.6)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.28)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
    }
    return c;
  }
  const waveTexA = texFrom(PSTY.sea === 'mural' ? waveCanvasMural() : waveCanvas(11, 34, 0.9), { addressMode: 'repeat' });
  const waveTexB = texFrom(waveCanvas(23, 22, 0.8), { addressMode: 'repeat' });
  const cloudTex = [1, 2, 3, 4].map((s) => texFrom(PSTY.clouds === 'mural' ? cloudCanvasMural(s * 97) : cloudCanvas(s * 97)));

  // ---- state ----
  let w = null, loc = null;
  const cam = { x: 0, y: 0, z: 0.2 };
  let zt = 0.2, anchor = { x: 0, y: 0 };
  const vel = { x: 0, y: 0 };
  let intro = null, sel = -1, hoverDirty = true, waves = [], clouds = [], regionG = null;
  const hoverG = new PIXI.Graphics();
  L.hover.addChild(hoverG);

  const zMin = () => (w ? Math.min(app.screen.width / w.W, app.screen.height / w.H) : 0.1);
  const zMax = 2.6;
  function clampCam() {
    if (!w) return;
    cam.z = clamp(cam.z, zMin(), zMax);
    const vw = app.screen.width / cam.z, vh = app.screen.height / cam.z;
    cam.x = vw >= w.W ? w.W / 2 : clamp(cam.x, vw / 2, w.W - vw / 2);
    cam.y = vh >= w.H ? w.H / 2 : clamp(cam.y, vh / 2, w.H - vh / 2);
  }
  function zoomAt(sx, sy, f) {
    const r = stage.getBoundingClientRect();
    const ox = sx - r.left - r.width / 2, oy = sy - r.top - r.height / 2;
    const wx = cam.x + ox / cam.z, wy = cam.y + oy / cam.z;
    cam.z = clamp(cam.z * f, zMin(), zMax);
    cam.x = wx - ox / cam.z; cam.y = wy - oy / cam.z;
  }
  const toWorld = (sx, sy) => {
    const r = stage.getBoundingClientRect();
    return [cam.x + (sx - r.left - r.width / 2) / cam.z, cam.y + (sy - r.top - r.height / 2) / cam.z];
  };
  const viewRect = (m = 0, c = cam) => {
    const vw = app.screen.width / c.z, vh = app.screen.height / c.z;
    return [c.x - vw / 2 - m, c.y - vh / 2 - m, c.x + vw / 2 + m, c.y + vh / 2 + m];
  };
  const stopIntro = () => { intro = null; };

