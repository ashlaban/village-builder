// @sys page/portraits: portraits of pawns and icons of farms and villages for the panels, from the map's own rig parts and building art
// ======== portraits and icons ========
// A portrait is the pawn's bust as the map draws it, larger: the same parts, colours and headgear (lookOf, page/rigs), in profile. An icon
// is a building as it stands on the map. Both are data URLs for <img>, cached; the caches are the page's own and are cleared with the map.
const FACE = 3,
  BUST = 40; // texels per rig unit; the bust is a 40-unit square of the rig: head and shoulders
let faceParts = null;
const faceCache = new Map(),
  iconCache = new Map(),
  FACE_CAP = 600;
function clearPortraits() {
  faceCache.clear();
}
const wedded = (p) =>
  Sim.spouseOf(st, p.id) !== null || (p.sex === 'f' && st.unions.some((u) => u.a === p.id || u.b === p.id));
const rgb = (c, f = 1) => `rgb(${c.map((v) => Math.min(255, Math.round(v * f))).join(',')})`;
// A grey part multiplied by a colour, as a sprite's tint does on the map.
function tinted(part, colour) {
  if (!colour) return part;
  const c = makeCanvas(part.width, part.height),
    g = c.getContext('2d');
  g.drawImage(part, 0, 0);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = colour;
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(part, 0, 0);
  return c;
}
// Positions, anchors and order follow makeRig (page/rigs); the origin is the rig's hip, y grows downward.
function drawFace(p, married, winter) {
  if (!faceParts) faceParts = partCanvases(FACE);
  const look = lookOf(p),
    aged = agedLook(look, p.age), // its hair as the years have it, and a beard from 18 (VB-1029), as on the map
    c = makeCanvas(BUST * FACE, BUST * FACE),
    g = c.getContext('2d'),
    k = 0.6 + 0.4 * sizeAt(p.age);
  g.scale(FACE, FACE);
  g.translate(BUST / 2, BUST);
  g.scale(k, k);
  g.translate(-1, 16); // a child's bust is smaller, standing on the same edge
  const put = (name, colour, x, y, ax = 0.5, ay = 0, sx = 1, rot = 0) => {
    const part = faceParts[name],
      pw = part.width / FACE,
      ph = part.height / FACE;
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.scale(sx, 1);
    g.drawImage(tinted(part, colour), -ax * pw, -ay * ph, pw, ph);
    g.restore();
  };
  const cloth = rgb(look.cloth),
    hx = 1,
    hy = -27;
  put('sleeve', rgb(look.cloth, 0.74), -3, -24);
  if (p.sex === 'f') {
    put('dress', cloth, 0, -27);
    put('apron', rgb(LINEN, 0.97), 5.5, -14);
    put('belt', null, 0.5, -15, 0.5, 0, 0.78);
  } else {
    put('tunic', cloth, 0, -27);
    put('belt', null, 0, -11);
  }
  if (p.sex === 'f' && !married) put('braid', rgb(aged.hair, 0.9), hx - 9, hy - 16);
  put('head', rgb(look.skin), hx, hy, 0.46, 1);
  if (aged.grey >= 2) {
    // the old have lines in the face, which a hood or a headcloth does not hide: under the eye and by the mouth, and across the brow
    // of the oldest (the portrait's own: the map's figure is too small for them)
    g.strokeStyle = rgb(look.skin, 0.6);
    g.lineWidth = 0.7;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(hx + 3.6, hy - 12.3);
    g.quadraticCurveTo(hx + 5.4, hy - 11.2, hx + 7.4, hy - 12.2);
    g.moveTo(hx + 6.2, hy - 8.6);
    g.quadraticCurveTo(hx + 5.2, hy - 6.8, hx + 6.2, hy - 5.2);
    if (aged.grey >= 3) {
      g.moveTo(hx + 3.4, hy - 18.4);
      g.quadraticCurveTo(hx + 5.4, hy - 19.2, hx + 7.6, hy - 18.4);
    }
    g.stroke();
  }
  if (p.sex === 'm') {
    if (aged.beard) put('beard', rgb(aged.hair, 0.95), hx + 3, hy - 9);
    if (look.hood || winter) put('hood', rgb(look.hoodCol), hx, hy + 7, 0.47, 1);
    else put('hair', rgb(aged.hair), hx, hy - 2.5, 0.46, 1);
  } else if (married) put('headcloth', rgb(LINEN), hx, hy + 5, 0.46, 1);
  else {
    put('hair', rgb(aged.hair), hx, hy - 2.5, 0.46, 1);
    put('band', null, hx, hy - 19, 0.5, 0.5, 1, -0.15);
  }
  put('sleeve', cloth, 3, -24);
  return c.toDataURL('image/png');
}
// A pawn's portrait: redrawn only when what it wears or its size changes, looked at once a game day.
function faceOf(id) {
  const p = st.pawns[id],
    day = Math.floor(st.t / Sim.DAY);
  let e = faceCache.get(id);
  if (e && e.day === day) return e.url;
  const married = wedded(p),
    winter = Sim.cal(st.t).season === 3,
    aged = agedLook(lookOf(p), p.age),
    sig = `${married}|${winter}|${sizeAt(p.age)}|${aged.grey}|${aged.beard}`;
  if (!e || e.sig !== sig) {
    if (faceCache.size >= FACE_CAP) faceCache.clear();
    let url = '';
    try {
      url = drawFace(p, married, winter);
    } catch (err) {
      /* no canvas here: the panels do without portraits */
    }
    e = { sig, url };
    faceCache.set(id, e);
  }
  e.day = day;
  return e.url;
}
// What pawn id is to pawn `of` (VB-1026), as the simulation has it: the kin bond, in id's own word (wife, father), and of's opinion of
// id where it is not neutral (the living only: the dead hold and are held in no opinion). [{k (a key of BOND_PATHS), word, tone}].
function bondsOf(of, id) {
  const out = [],
    kin = Sim.bond(st, of, id);
  if (kin) out.push({ k: kin, word: Sim.bondWord(st, of, id), tone: '', at: 'kin' });
  if (st.pawns[of].died === null && st.pawns[id].died === null) {
    const word = Sim.opinionWord(Sim.opinionOf(st, of, id));
    if (word !== 'neutral') out.push({ k: word, word, tone: word.includes('friend') ? 'good' : 'bad', at: 'op' });
  }
  return out;
}
// A portrait; with `of`, the portrait as that pawn sees it: the bonds as badges on its right corners, kin below and opinion above, each icon
// the same wherever a bond is shown and the word its label.
const faceImg = (id, cls = 'face', of = -1) => {
  const url = faceOf(id);
  if (!url) return '';
  const img = `<img class="${cls}${st.pawns[id].died !== null ? ' gone' : ''}" src="${url}" alt="">`,
    bonds = of >= 0 && of !== id ? bondsOf(of, id) : [];
  if (!bonds.length) return img;
  const badges = bonds
    .map(
      (b) =>
        `<i class="bond ${b.at}${b.tone ? ' ' + b.tone : ''}" role="img" aria-label="${b.word}" title="${b.word}">${bondIcon(b.k)}</i>`,
    )
    .join('');
  return `<span class="bonded ${cls.split(' ')[0]}">${img}${badges}</span>`;
};
function icon(key, draw) {
  if (!iconCache.has(key)) {
    let url = '';
    try {
      const c = makeCanvas(120, 120);
      draw(c.getContext('2d'));
      url = c.toDataURL('image/png');
    } catch (err) {
      /* as for portraits */
    }
    iconCache.set(key, url);
  }
  return iconCache.get(key);
}
// A farm by its cottage (one of three, as on the map), its settlers' booth while the cottage is built, or the low walls of a ruin.
function farmIcon(f) {
  if (f.rung === 'shelter')
    return icon('booth', (g) => {
      g.translate(60, 70);
      g.scale(4.4, 4.4);
      g.translate(-15, -1);
      g.fillStyle = '#cc9a58';
      g.strokeStyle = '#2c201c';
      g.lineWidth = 1;
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(6, 8);
      g.lineTo(15, -6);
      g.lineTo(24, 8);
      g.closePath();
      g.fill();
      g.stroke();
      g.strokeStyle = '#96462f';
      g.lineWidth = 1.2;
      for (const dx of [-3, 0, 3]) {
        g.beginPath();
        g.moveTo(15 + dx, -6);
        g.lineTo(15 + dx * 2.6, -10);
        g.stroke();
      }
      g.fillStyle = '#2a1e14';
      g.fillRect(13, 2, 4, 6);
    });
  const v = f.id % 3,
    ruin = f.state === 'ruin';
  return icon(`stuga${v}${ruin ? 'r' : ''}`, (g) => {
    const b = stugaCanvas(v);
    const bw = b.width / ARTK,
      bh = b.height / ARTK;
    if (ruin) g.drawImage(b, 8, 100 - bh * 0.55, bw, bh * 0.55);
    else g.drawImage(b, 8, 100 - bh, bw, bh);
  });
}
// A field at its stage, or a meadow at its own, from the map's art (page/fieldart), the hex drawn whole in the icon's square.
function groundIcon(key, canvas) {
  return icon(`${key}@${w.R}`, (g) => {
    const c = canvas(),
      k = 112 / Math.max(c.width, c.height);
    g.drawImage(c, (120 - c.width * k) / 2, (120 - c.height * k) / 2, c.width * k, c.height * k);
  });
}
const fieldIcon = (look) => groundIcon(`field-${look}`, () => fieldCanvas(look, w.R));
const meadowIcon = (stage) => groundIcon(`meadow-${stage}`, () => meadowCanvas(stage, w.R));
// A village by a cluster of its buildings: barn and storehouse behind a cottage, and the well sweep where it has a well.
function villageIcon(v) {
  return icon(`village${v.well !== null ? 'w' : ''}`, (g) => {
    const at = (b, x, y, s0) => {
      const s = s0 / ARTK;
      g.drawImage(b, x, y - b.height * s, b.width * s, b.height * s);
    };
    at(ladaCanvas(), 2, 70, 0.62);
    at(harbreCanvas(), 78, 80, 0.62);
    if (v.well !== null) at(wellSweepCanvas(), 52, 74, 0.5);
    at(stugaCanvas(1), 18, 114, 0.72);
  });
}
const iconImg = (url, cls = 'badge') => (url ? `<img class="${cls}" src="${url}" alt="">` : '');
