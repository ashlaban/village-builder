// @sys page/ground: the Ground overlay: each land tile's bedrock as a tint, its deposit as a mark, and a key of the kinds the map has
// ---- the Ground overlay (gen/geology): what lies in the ground ----
// Bedrock tints the tile; a deposit is a mark in its kind's colour: a disc for an ore, a square for clay and peat, a diamond for salt,
// flint and amber; a ring goes round a source that does not run out.
// The ores hidden in the uplands are shown as the viewer knows them (sim/prospect): a played pawn sees what its village has found; a
// watcher sees all, a vein no village has found drawn faint. Nothing digs yet, so the ground is redrawn only for a new world, another
// viewer or a new find.
let groundG = null,
  groundOn = false,
  groundFor = null,
  groundSeen = '',
  groundAt = -1;
const ROCK_COLOUR = [0, 0xc98a8a, 0xf0e8c8, 0xe0a050, 0x56627a, 0xffffff, 0x6fae8e]; // by ROCK code: granite..soapstone
const DEPOSIT_COLOUR = [
  0, 0xc4552d, 0x8a5a2a, 0x33363c, 0x1fa98a, 0xdfe6ee, 0x7fb4e6, 0xf5c518, 0xffffff, 0x4a3526, 0x5d6675, 0xff9d1c,
]; // by DEPOSIT code: clay..amber
const DEPOSIT_MARK = ['', 'earth', 'ore', 'ore', 'ore', 'ore', 'ore', 'ore', 'gem', 'earth', 'gem', 'gem'];
const hex6 = (c) => '#' + c.toString(16).padStart(6, '0');
// Whose knowledge the map shows: the played pawn's village, or -1 for a watcher.
function seerVillage() {
  const id = st ? played() : -1,
    p = id >= 0 ? st.pawns[id] : null;
  return p && p.household !== null ? st.farmsteads[st.households[p.household].farmstead].village : -1;
}
// How the viewer sees a tile's deposit: 0 not at all, 1 plainly, 2 faintly (a watcher's view of a vein no village has found).
function depositShown(i) {
  if (!st) return 1;
  const v = seerVillage();
  return v >= 0 ? (Sim.knowsDeposit(st, v, i) ? 1 : 0) : Sim.depositKnown(st, i) ? 1 : 2;
}
const groundSight = () => (st ? `${seerVillage()}:${[...st.finds.values()].reduce((n, f) => n + f.length, 0)}` : '');
function drawGround() {
  if (!w || !w.rock) return;
  const sight = groundSight();
  if (groundFor === w && groundSeen === sight) return;
  if (!groundG) {
    groundG = new PIXI.Graphics();
    L.ground.addChild(groundG);
  }
  const g = groundG,
    R = w.R,
    rocks = Geo.ROCKS.map(() => 0),
    deps = Geo.DEPOSITS.map(() => 0);
  g.clear();
  groundFor = w;
  groundSeen = sight;
  groundAt = time;
  const shown = new Uint8Array(w.N);
  let faint = 0;
  for (let i = 0; i < w.N; i++) if (w.deposit[i]) shown[i] = depositShown(i);
  for (let r = 1; r < Geo.ROCKS.length; r++) {
    for (let i = 0; i < w.N; i++)
      if (w.rock[i] === r) {
        g.poly(hexPoly(i));
        rocks[r]++;
      }
    if (rocks[r]) g.fill({ color: ROCK_COLOUR[r], alpha: 0.5 });
  }
  for (let d = 1; d < Geo.DEPOSITS.length; d++)
    for (const how of [1, 2]) {
      let n = 0;
      for (let i = 0; i < w.N; i++) {
        if (w.deposit[i] !== d || shown[i] !== how) continue;
        n++;
        const x = w.hx[i],
          y = w.hy[i],
          m = DEPOSIT_MARK[d];
        if (m === 'earth') g.rect(x - R * 0.38, y - R * 0.38, R * 0.76, R * 0.76);
        else if (m === 'gem') g.poly([x, y - R * 0.52, x + R * 0.52, y, x, y + R * 0.52, x - R * 0.52, y]);
        else g.circle(x, y, R * 0.44);
      }
      if (!n) continue;
      deps[d] += n;
      if (how === 2) faint += n;
      g.fill({ color: DEPOSIT_COLOUR[d], alpha: how === 1 ? 1 : 0.35 }).stroke({
        width: R * 0.09,
        color: 0x2a1a0c,
        alpha: how === 1 ? 1 : 0.4,
      });
    }
  let endless = 0;
  for (let i = 0; i < w.N; i++)
    if (shown[i] && w.depositLeft[i] === Geo.ENDLESS) {
      g.circle(w.hx[i], w.hy[i], R * 0.68);
      endless++;
    }
  if (endless) g.stroke({ width: R * 0.1, color: 0x2a1a0c });
  // the key: only the kinds the viewer sees on this map
  const row = (cls, colour, name) => `<li><i class="${cls}" style="background:${hex6(colour)}"></i>${name}</li>`;
  $('groundKey').innerHTML =
    '<h2 class="menu-label">Bedrock</h2><ul>' +
    Geo.ROCKS.map((r, k) => (rocks[k] ? row('rock', ROCK_COLOUR[k], r.name) : '')).join('') +
    '</ul><h2 class="menu-label">Deposits</h2><ul>' +
    (Geo.DEPOSITS.map((d, k) => (deps[k] ? row(DEPOSIT_MARK[k], DEPOSIT_COLOUR[k], d.name) : '')).join('') ||
      '<li>None on this map</li>') +
    (endless ? '<li><i class="ore endless"></i>Does not run out</li>' : '') +
    (faint ? '<li><i class="ore faint"></i>Not yet found</li>' : '') +
    '</ul>';
}
function setGround(on) {
  groundOn = on;
  L.ground.visible = on;
  $('groundKey').hidden = !on;
  if (on) drawGround();
}
// Each frame while the overlay is on: a new find or another viewer redraws it, looked for at most twice a second.
function refreshGround() {
  if (groundOn && time - groundAt >= 0.5) {
    groundAt = time;
    drawGround();
  }
}
// A new world: the old one's ground is wiped, and drawn anew if the overlay is on.
function resetGround() {
  groundFor = null;
  if (groundG) groundG.clear();
  if (groundOn) drawGround();
}
