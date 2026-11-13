// @sys page/deer: roe deer (VB-139) at the forest edges near the camera at dawn and dusk: their art, and a few drawn where a region's stock is
// ---- the art: a roe deer side on, facing right; `coat` 0 the summer's red-brown, 1 the winter's grey-brown; `look` 0 grazes with the head
// down, 1 looks up, ears pricked. The white rump patch shows either way ----
const DEER_COATS = [
  [170, 92, 50],
  [116, 98, 82],
];
function deerCanvas(coat, look) {
  const K = artKit(34, 32, 71 + coat * 5 + look),
    { g, col, under } = K,
    base = DEER_COATS[coat],
    sh = (f) => base.map((v) => v * f),
    hx = 28,
    hy = look ? 7 : 21;
  K.shadow(16, 30, 11, 1.8);
  under(
    [
      ...[8, 11, 20, 23].map((x, k) => [
        sh(k % 2 ? 0.8 : 0.7),
        () => {
          g.beginPath();
          g.rect(x, 17, 1.6, 12);
        },
      ]),
      [
        base,
        () => {
          g.beginPath();
          g.ellipse(15.5, 15, 10, 5.4, -0.05, 0, 7);
        },
      ],
      [
        base,
        () => {
          g.beginPath();
          g.moveTo(21, 11.5);
          g.quadraticCurveTo(25, look ? 7 : 14, hx - 2, hy);
          g.lineTo(hx + 1, hy + 2.5);
          g.quadraticCurveTo(26, look ? 13 : 19, 23, 17);
          g.closePath();
        },
      ],
      [
        sh(0.85),
        () => {
          g.beginPath();
          g.ellipse(hx - 1.5, hy - 3, 1.2, 2.6, look ? -0.3 : 0.5, 0, 7);
        },
      ],
      [
        base,
        () => {
          g.beginPath();
          g.ellipse(hx, hy + 0.5, 3.3, 2.2, look ? 0.3 : 1.1, 0, 7);
        },
      ],
    ],
    0.45,
  );
  g.fillStyle = col([246, 240, 228]);
  g.beginPath();
  g.ellipse(6.4, 14.5, 2.6, 3.4, 0, 0, 7);
  g.fill(); // the rump patch
  g.fillStyle = col(MP.dark);
  g.beginPath();
  g.arc(hx + (look ? 2.6 : 1.2), hy + (look ? 1.4 : 2.6), 0.9, 0, 7);
  g.fill(); // the nose
  g.beginPath();
  g.arc(hx - 0.3, hy - 0.2, 0.6, 0, 7);
  g.fill(); // the eye
  return K.c;
}
// ---- on the map: only in the twilight, within DEER_TWILIGHT hours of the dark's end or start, and near the camera; a forest-edge tile in
// view shows a group of one to three by a draw on the tile and the day, more often where its region holds more deer against its capacity
// (sim/deer), at most DEER_MAX in all. Page state only: the pool of sprites; nothing is written to st ----
const DEER_TWILIGHT = 2.5,
  DEER_MAX = 12,
  DEER_SEEN = 0.12,
  DEER_SCALE = 0.3;
let deerSprites = [];
// Whether hour h of date c is in the twilight: within DEER_TWILIGHT hours before the dark begins or after it ends.
function deerHour(h, c) {
  const [a, b] = Sim.dark(c);
  return (a - h + 24) % 24 <= DEER_TWILIGHT || (h - b + 24) % 24 <= DEER_TWILIGHT;
}
function drawDeer(c, show) {
  let used = 0;
  if (show && cam.z > 0.3 && st.deer && deerHour(c.hour, c)) {
    const D = VB['sim/deer'],
      [x0, y0, x1, y1] = viewRect(40),
      coat = c.season === 3 || (c.season === 2 && c.sday >= 6) ? 1 : 0;
    for (let r = 0; r < st.deer.edges.length && used < DEER_MAX; r++) {
      const e = st.deer.edges[r];
      if (!e.length) continue;
      const d = D.density(st, r);
      if (!(d > 0)) continue;
      for (const t of e) {
        const x = w.hx[t],
          y = w.hy[t];
        if (x < x0 || x > x1 || y < y0 || y > y1 || hash(t * 13 + c.day * 7) >= DEER_SEEN * d) continue;
        // out of the trees, on the open ground beside them: towards the first open neighbour
        let ox = 0,
          oy = 0;
        for (let k = 0; k < 6; k++) {
          const j = w.nb[t * 6 + k];
          if (j >= 0 && !w.water[j] && w.biome[j] !== G.B.FOREST && w.biome[j] !== G.B.PINE) {
            ox = (w.hx[j] - x) * 0.55;
            oy = (w.hy[j] - y) * 0.55;
            break;
          }
        }
        const n = 1 + ((hash(t * 5 + c.day) * 3) | 0);
        for (let k = 0; k < n && used < DEER_MAX; k++, used++) {
          let s = deerSprites[used];
          if (!s) {
            s = new PIXI.Sprite(art.deer[0][0]);
            s.anchor.set(0.5, 0.92);
            L.objects.addChild(s);
            deerSprites[used] = s;
          }
          const key = t * 31 + k * 17 + c.day,
            ph = hash(key + 3) * 6.283,
            u = time * 0.05 + ph,
            px = x + ox + (hash(key + 1) - 0.5) * 20 + Math.sin(u) * 3,
            py = y + oy + (hash(key + 2) - 0.5) * 10 + Math.cos(u * 0.7) * 1.2,
            look = Math.sin(time * 0.3 + ph * 3) > 0.4 ? 1 : 0,
            tex = art.deer[coat][look];
          if (s.texture !== tex) s.texture = tex;
          s.visible = true;
          s.position.set(px, py);
          s.zIndex = py;
          s.scale.set(Math.cos(u) >= 0 ? DEER_SCALE : -DEER_SCALE, DEER_SCALE);
        }
      }
    }
  }
  for (let k = used; k < deerSprites.length; k++) deerSprites[k].visible = false;
}
