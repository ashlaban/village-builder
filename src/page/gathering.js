// @sys page/gathering: a gathering while it is on (VB-1032): its mark on the map, a sign of its kind over the spot where its people stand,
// and its card, opened by the mark: what it is, for whom, until when, and who is there, each portrait with what it is to the played pawn
// ======== gatherings ========
// The page's own state, never saved: the occasion whose card is open (selOcc, an id of st.occasions, or -1), the selection as it was when
// the card opened (occKey: another selection closes it), and a mark an occasion that is on (occMarks).
let selOcc = -1,
  occKey = '';
const occMarks = new Map(),
  occLayer = new PIXI.Container();
L.hover.addChild(occLayer);
const OCC_WORDS = {
  meeting: 'The village meeting',
  rite: 'The rite',
  wedding: 'A wedding',
  funeral: 'A funeral ale',
  ale: 'An ale evening',
};
const OCC_R = 11, // the mark's radius on screen, in pixels
  OCC_LIFT = 30; // and how far over the spot it floats, in map units: over the heads
const occOn = () => (st ? st.occasions.filter((o) => st.t >= o.start && st.t < o.end) : []);
const occScale = () => 1 / Math.max(cam.z, 0.35); // the same size on screen down to a far view, then smaller with the map
const occSelection = () => `${selPawn}|${selVillage}|${selFarm}|${sel}`;
// One mark: a pale disc, ringed in gold while its card is open, and on it the occasion's icon, the interface's own (page/icons), drawn
// by PixiJS from the same path.
function makeOccMark(kind) {
  const c = new PIXI.Container(),
    disc = new PIXI.Graphics(),
    glyph = new PIXI.Graphics();
  if (typeof glyph.svg === 'function') {
    const ink = ' fill="none" stroke="#2c201c" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"';
    glyph.svg(`<svg viewBox="0 0 24 24">${OCCASION_PATHS[kind].replace(/<(path|circle)/g, `<$1${ink}`)}</svg>`);
  }
  glyph.scale.set((OCC_R * 1.35) / 24);
  glyph.position.set(-OCC_R * 0.675, -OCC_R * 0.675);
  c.addChild(disc);
  c.addChild(glyph);
  occLayer.addChild(c);
  return { c, disc, sel: null };
}
// Each frame (page/animate): a mark for each occasion that is on, where its people stand; the marks of those over are taken away.
function drawGatherings(show) {
  const on = show ? occOn() : [],
    k = occScale();
  for (const [id, m] of occMarks)
    if (!on.some((o) => o.id === id)) {
      m.c.destroy({ children: true });
      occMarks.delete(id);
    }
  for (const o of on) {
    let m = occMarks.get(o.id);
    if (!m) occMarks.set(o.id, (m = makeOccMark(o.kind)));
    m.c.position.set(o.x, o.y - OCC_LIFT - OCC_R * k);
    m.c.scale.set(k);
    const picked = o.id === selOcc;
    if (m.sel !== picked) {
      m.sel = picked;
      m.disc
        .clear()
        .circle(0, 0, OCC_R)
        .fill({ color: 0xfbf6e6 })
        .stroke({ width: picked ? 2.6 : 1.4, color: picked ? 0xf2c14e : 0x2c201c });
    }
  }
}
// The occasion whose mark is at map point (x, y), or -1.
function gatheringAt(x, y) {
  const k = occScale(),
    r = (OCC_R + 3) * k;
  for (const o of occOn()) if (Math.hypot(x - o.x, y - (o.y - OCC_LIFT - OCC_R * k)) <= r) return o.id;
  return -1;
}
function selectGathering(id) {
  selectionPinned = true;
  openPanel('tile');
  selPawn = -1;
  selVillage = -1;
  selFarm = -1;
  sel = -1;
  hoverDirty = true;
  selOcc = id;
  occKey = occSelection();
  showGathering();
}
// Is a gathering's card the one open: until something else is selected, or the gathering is over (the card then closes).
function gatheringShown() {
  if (selOcc < 0) return false;
  if (occSelection() !== occKey) {
    selOcc = -1;
    return false;
  }
  if (!st.occasions.some((o) => o.id === selOcc)) {
    selOcc = -1;
    if (activePanel === 'tile') openPanel(null);
    return false;
  }
  return true;
}
// The card: the occasion in words, where and until when, and who is there and who is on the way, as chips; with a pawn played, each
// portrait carries what that one is to it (VB-1026).
function showGathering() {
  const o = st.occasions.find((x) => x.id === selOcc);
  if (!o) return;
  const me = played(),
    name = (id) => Sim.fullName(st.pawns[id]),
    place = o.farm !== null && o.farm !== undefined ? st.farmsteads[o.farm] : null,
    v = st.villages[o.village];
  const set = st.agents.filter((a) => a.occasion === o.id && st.pawns[a.id].died === null),
    there = set.filter((a) => !a.path).map((a) => a.id),
    coming = set.filter((a) => a.path).map((a) => a.id);
  const chips = (ids) => ids.map((id) => pawnChip(id, '', me)).join('');
  const what =
    o.kind === 'wedding'
      ? `For ${o.for.map(name).join(' and ')}`
      : o.kind === 'funeral'
        ? `For ${o.for.map(name).join(' and ')}, who died`
        : o.kind === 'ale' && o.for.length
          ? `Opened by ${name(o.for[0])}`
          : '';
  card(
    OCC_WORDS[o.kind],
    [
      what,
      `${place ? `At ${place.name}` : `On the green of ${v.name}`}, until ${clockOf(o.end)}`,
      `${there.length} there${coming.length ? `, ${coming.length} on the way` : ''}`,
    ].filter(Boolean),
    '',
    {
      badge: `<span class="occ-badge">${occasionIcon(o.kind)}</span>`,
      links: (place ? farmChip(place) : '') + villageChip(v),
      list:
        (there.length ? `<h3>There</h3><div class="links">${chips(there)}</div>` : '') +
        (coming.length ? `<h3>On the way</h3><div class="links">${chips(coming)}</div>` : ''),
    },
  );
}
