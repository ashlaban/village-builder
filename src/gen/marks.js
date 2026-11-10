// @sys gen/marks: what stands on the land in the map chunks, drawn as a church mural: trees, stones, flowers, marsh pools, hill humps and crags
// ===== The marks of the land. gen.js chooses what stands on each tile (decorateChunk); this module only draws the items it is given. =====
// One dark contour round flat earth colours, as in page/farmart, so that the ground and the farms on it are of one hand. Relief that the
// light of the bake cannot show at a tile's size is drawn as a figure: a hump for a hill, a peaked crag with a lit and a shaded face for a
// mountain, capped with limewash where the snow lies.
// Listed before gen.js, which calls it.
VB['gen/marks'] = (() => {
  const INK = 'rgb(44,32,28)', LEAF = 'rgb(84,116,70)', PETALS = ['rgb(250,246,232)', 'rgb(232,190,70)', 'rgb(190,64,46)'];
  const path = (ctx, pts) => { ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); };
  // a point of the tile round (x, y), within k tile radii
  const strew = (rnd, x, y, R, k) => { const a = rnd() * 6.283, d = Math.sqrt(rnd()) * R * k; return [x + Math.cos(a) * d, y + Math.sin(a) * d * 0.9]; };

  function stone(ctx, it) {
    ctx.beginPath(); ctx.ellipse(it.x, it.y, it.r * 1.05, it.r * 0.74, 0, 0, 7);
    ctx.fillStyle = 'rgb(222,214,198)'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.75; ctx.stroke();
  }
  // sprigs of three strokes in green earth, and flowers as trefoils of three dots on a stalk
  function flowers(ctx, it, R, rnd) {
    const c0 = PETALS[(rnd() * 3) | 0];
    ctx.strokeStyle = LEAF; ctx.lineWidth = 0.8;
    for (let k = 0; k < 6; k++) {
      const [x, y] = strew(rnd, it.x, it.y, R, 0.72);
      ctx.beginPath(); ctx.moveTo(x - 1.8, y - 2.6); ctx.lineTo(x, y); ctx.lineTo(x, y - 3.4); ctx.moveTo(x, y); ctx.lineTo(x + 1.8, y - 2.6); ctx.stroke();
    }
    for (let k = 0; k < 4; k++) {
      const [x, y] = strew(rnd, it.x, it.y, R, 0.7);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 3); ctx.stroke();
      ctx.fillStyle = rnd() < 0.75 ? c0 : PETALS[(rnd() * 3) | 0];
      for (const [ox, oy] of [[-1.1, -3.4], [1.1, -3.4], [0, -5]]) { ctx.beginPath(); ctx.arc(x + ox, y + oy, 1.05, 0, 7); ctx.fill(); }
    }
  }
  // pools inside a contour with one pale ripple, and up close reeds with red-brown heads
  function marsh(ctx, it, R, rnd, full, lw) {
    for (let k = 1 + ((rnd() * 2) | 0); k > 0; k--) {
      const [x, y] = strew(rnd, it.x, it.y, R, 0.45), rw = 4.5 + rnd() * 5;
      ctx.beginPath(); ctx.ellipse(x, y, rw, rw * 0.48, 0, 0, 7);
      ctx.fillStyle = 'rgb(124,160,164)'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.8 * lw; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - rw * 0.5, y); ctx.quadraticCurveTo(x - rw * 0.25, y - 1.4, x, y);
        ctx.quadraticCurveTo(x + rw * 0.25, y + 1.4, x + rw * 0.5, y);
      ctx.strokeStyle = 'rgb(232,236,222)'; ctx.lineWidth = 0.7; ctx.stroke();
    }
    if (!full) return;
    for (let k = 0; k < 5; k++) {
      const [x, y] = strew(rnd, it.x, it.y, R, 0.7);
      ctx.strokeStyle = LEAF; ctx.lineWidth = 0.8; ctx.beginPath();
      for (let s = -1; s <= 1; s++) { ctx.moveTo(x + s * 1.1, y); ctx.lineTo(x + s * 2.2, y - 5); }
      ctx.stroke();
      ctx.fillStyle = 'rgb(150,70,48)';
      for (let s = -1; s <= 1; s++) { ctx.beginPath(); ctx.ellipse(x + s * 2.2, y - 5.6, 0.7, 1.3, 0, 0, 7); ctx.fill(); }
    }
  }
  // a hill: a pale hump under one contour, hatched on its far side
  function hump(ctx, it, lw) {
    const { x, y, wd, h } = it, top = () => { ctx.beginPath(); ctx.moveTo(x - wd, y); ctx.quadraticCurveTo(x - wd * 0.1, y - h * 2.3, x + wd, y); };
    top(); ctx.closePath(); ctx.fillStyle = 'rgb(222,210,146)'; ctx.fill();
    top(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2 * lw; ctx.stroke();
    ctx.beginPath();
    for (let q = 0; q < 3; q++) {
      const a = x + wd * (0.25 + q * 0.22), b = y - h * (0.78 - q * 0.26); ctx.moveTo(a, b); ctx.lineTo(a + wd * 0.1, b + h * 0.5); }
    ctx.strokeStyle = 'rgb(140,110,70)'; ctx.lineWidth = 0.8 * lw; ctx.stroke();
  }
  // a mountain: a peak of straight edges, its ridge running down from the summit between a lit face and a shaded one
  function crag(ctx, it, lw) {
    const { x, y, wd, h, v } = it, top = y - h;
    const edge = [[x - wd, y], [x - wd * 0.58, y - h * (0.4 + v * 0.1)], [x - wd * 0.3, y - h * 0.66], [x, top], [x + wd * 0.36, y - h * (0.5 + v * 0.1)],
      [x + wd * 0.62, y - h * 0.3], [x + wd, y]];
    const ridge = [[x, top], [x + wd * 0.1, y - h * 0.64], [x - wd * 0.08, y - h * 0.36], [x + wd * 0.14, y]];
    path(ctx, edge); ctx.closePath(); ctx.fillStyle = v < 0.5 ? 'rgb(224,214,196)' : 'rgb(216,204,184)'; ctx.fill();
    path(ctx, [...ridge, ...edge.slice(3).reverse()]); ctx.closePath(); ctx.fillStyle = v < 0.5 ? 'rgb(156,140,130)' : 'rgb(166,138,124)'; ctx.fill();
    if (it.snow) {
      const line = []; for (let q = 0; q <= 8; q++) line.push([x - wd + (q * wd) / 4, y - h * (0.5 + (q % 2 ? 0.1 : 0))]);
      ctx.save(); path(ctx, edge); ctx.closePath(); ctx.clip();
      path(ctx, [[x - wd, top - 2], ...line, [x + wd, top - 2]]); ctx.closePath(); ctx.fillStyle = 'rgb(248,246,236)'; ctx.fill();
      path(ctx, [...ridge.slice(0, 2), ...edge.slice(3, 5).reverse()]); ctx.closePath(); ctx.fillStyle = 'rgb(206,212,216)'; ctx.fill();
      path(ctx, line); ctx.strokeStyle = INK; ctx.lineWidth = 0.6 * lw; ctx.stroke();
      ctx.restore();
    }
    path(ctx, ridge); ctx.strokeStyle = INK; ctx.lineWidth = 0.75 * lw; ctx.stroke();
    path(ctx, edge); ctx.lineWidth = 1.4 * lw; ctx.stroke();
  }

  // Draws items ({t, x, y, ...}, sorted by y) on a context already set to map units. S: the sprites of trees and shrubs (page/farmart's
  // landSprites); rng(seed): gen's generator, for the items that scatter their own parts.
  function draw(ctx, items, S, R, full, rng) {
    const lw = full ? 1 : 1.9; // on the middle level a line needs its width in texels
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.fillStyle = 'rgba(28,36,24,0.26)';
    for (const it of items) {
      if (it.t === 'broad' || it.t === 'pine') { ctx.beginPath(); ctx.ellipse(it.x + 3, it.y + 1, 6 * it.sc, 2.8 * it.sc, -0.3, 0, 7); ctx.fill(); }
    }
    for (const it of items) {
      if (it.t === 'broad') { const k = it.sc * 0.74; ctx.drawImage(S.broad[it.v], it.x - 14 * k, it.y - 26 * k, 28 * k, 30 * k); }
      else if (it.t === 'pine') { const k = it.sc * 0.72; ctx.drawImage(S.pine[it.v % 8], it.x - 10 * k, it.y - 32 * k, 20 * k, 34 * k); }
      else if (it.t === 'shrub') ctx.drawImage(S.shrub[it.v], it.x - 6, it.y - 7, 12, 10);
      else if (it.t === 'stone') stone(ctx, it);
      else if (it.t === 'flowers') flowers(ctx, it, R, rng(it.s));
      else if (it.t === 'marsh') marsh(ctx, it, R, rng(it.s), full, lw);
      else if (it.t === 'hump') hump(ctx, it, lw);
      else if (it.t === 'crag') crag(ctx, it, lw);
    }
  }
  return { draw };
})();
