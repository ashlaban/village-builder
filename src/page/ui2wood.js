// @sys page/ui2wood: the new interface's wood (VB-1625): felling on a forest tile, firewood cut at the house, and the fire's warning there
// ---- wood in two steps: timber felled at the forest tile and carried home, cut into firewood at the farmstead ----
// Kim (24 Nov): "Fell timber at the forest tile, and then cut firewood in the home. But this should be clear (warning at the home tile, no
// firewood. Tapping the warning gives you text 'No firewood' and a path to resolve it, 'Fell timber, then cut to firewood at the
// farmstead')." All of it reads Sim.fireView and acts through Sim.plan.
const WOOD_PATH = 'Fell timber, then cut to firewood at the farmstead.';
const WOOD_LOADS = [3, 6]; // the trips offered beside one, a tap each
const woodLoads = (u) => Math.max(1, Math.ceil(u / Sim.ECON.woodPerTrip - 1e-9));
const woodTimber = (u) =>
  u <= 0 ? 'no timber' : `${Math.round(u)} timber (${woodLoads(u)} ${woodLoads(u) === 1 ? 'load' : 'loads'})`;
// The fire, when it wants seeing to: short of the season's goal, or the house cold; else null.
const fireWarn = () => {
  const F = Sim.fireView ? Sim.fireView(st) : null;
  return F && (F.short || F.cold) ? F : null;
};
const fireTitle = (F) =>
  F.wood < 1 ? 'No firewood' : `Firewood for ${F.nights} ${F.nights === 1 ? 'night' : 'nights'}`;
// The warning's words, the band of the house's callout when its mark is tapped.
const fireWords = (F) =>
  `${fireTitle(F)}${F.cold ? ', and the house was cold' : F.wood < 1 ? '' : ', short of what the season wants'}. ${WOOD_PATH}`;
// Why forest tile i will not be felled by the played household, or null (sim/territory's woodWhy, the rule the fell task checks).
function woodWhy(i, f) {
  if (!(w.trees[i] > 0)) return 'no trees stand here';
  return VB['sim/territory'].woodWhy(st, st.villages[f.village], i);
}
// The nearest tile the household may fell on, from the house (once an hour), or -1.
function woodNear(f) {
  const key = `${Math.floor(st.t)}|${f.house}`;
  if (hud.woodNear && hud.woodNear.key === key) return hud.woodNear;
  let best = { key, tile: -1, d: Infinity };
  for (const [j, d] of VB['sim/hex'].bfs(w, f.house, 8, VB['sim/walking'].walkable(w)).dist)
    if (d < best.d && w.trees[j] > 0 && woodWhy(j, f) === null) best = { key, tile: j, d };
  return (hud.woodNear = best);
}
const fellTask = (i) => (hudPlanned() || { tasks: [] }).tasks.find((t) => t.kind === 'fell' && t.site === i) || null;
const fellBtn = (tile, n, cls, label, small) =>
  `<button type="button" class="${cls}" data-hud="fell" data-tile="${tile}" data-n="${n}">${label}${small ? `<small>${esc(small)}</small>` : ''}</button>`;
// The acts of a forest tile's callout: fell here, one load or more, or why not; or the task already planned here.
function woodActs(i, f) {
  if (!(w.trees[i] > 0) || !hudPlanned()) return '';
  const t = fellTask(i);
  const inplan = (icon, what, more = '') =>
    `<p class="u2-inplan">${actIcon(icon)}<span><b>${what}</b> is in the plan${more}.</span></p>`;
  if (t) return inplan('chop', 'Felling', ` here: ${t.got} of ${t.n} ${t.n === 1 ? 'load' : 'loads'} home`);
  const why = woodWhy(i, f);
  if (why) return `<p class="u2-legend">Not for felling: ${esc(why)}.</p>`;
  return (
    fellBtn(
      i,
      1,
      'u2-act go',
      'Fell timber here',
      'One load: a tree felled and its timber carried home. One task of the plan.',
    ) + `<div class="u2-row2">${WOOD_LOADS.map((n) => fellBtn(i, n, 'u2-chip', `${n} loads`)).join('')}</div>`
  );
}
// The first act that mends the fire (fireView's mend), as a button, or the words that it is planned.
function fireAct(F, f) {
  const k = F.mend[0];
  if (!k) return '';
  if (F.planned[k]) {
    const what = k === 'fell' ? 'Felling' : 'Cutting firewood';
    return `<p class="u2-inplan">${actIcon(k === 'fell' ? 'chop' : 'build')}<span><b>${what}</b> is in the plan.</span></p>`;
  }
  if (k === 'firewood')
    return (
      '<button type="button" class="u2-act go" data-hud="cutwood">Cut firewood' +
      `<small>${esc(woodTimber(F.timber))} at home, cut at the house</small></button>`
    );
  const near = woodNear(f),
    n = Math.min(20, woodLoads(Math.max(1, F.goal - F.free - F.timber)));
  return near.tile < 0
    ? '<p class="u2-legend">No wood to fell within a day’s reach.</p>'
    : fellBtn(
        near.tile,
        n,
        'u2-act go',
        `Fell timber: ${n} ${n === 1 ? 'load' : 'loads'}`,
        `At the nearest wood, ${near.d} ${near.d === 1 ? 'tile' : 'tiles'} off, carried home as timber. Or tap any forest tile.`,
      );
}
// The house's lines on wood: what lies at home, and cutting it when it can be cut.
function houseWood(F) {
  if (!F) return '';
  let h = `<p class="u2-legend">${goodIcon('wood')} ${esc(fireTitle(F))}; ${esc(woodTimber(F.timber))} at home to cut.</p>`;
  if (F.planned.firewood) return h;
  if ((F.timber > 0 || F.planned.fell) && F.short)
    h += `<button type="button" class="u2-chip" data-hud="cutwood">Cut firewood</button>`;
  return h;
}
