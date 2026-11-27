// @sys page/ui2wood: the new interface's wood (VB-1653): felling on a forest tile, firewood cut at the house, and the fire's warning there
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
  const F = Sim.fireView ? Sim.fireView(st, st.player.pawn) : null;
  return F && (F.short || F.cold) ? F : null;
};
const fireTitle = (F) =>
  F.wood < 1 ? 'No firewood' : `Firewood for ${F.nights} ${F.nights === 1 ? 'night' : 'nights'}`;
// The warning's words, the band of the house's callout when its mark is tapped.
// the same verdict as the stores' (fireView reads the outlook's fuel: VB-1661)
const fireVerdict = (F) =>
  F.state === 'safe' || F.season === null
    ? 'enough for the year'
    : `it runs ${F.state === 'bad' ? 'badly ' : ''}short in ${Sim.SEASONS[(Sim.cal(st.t).season + F.season) % 4]}`;
const fireWords = (F) =>
  `${fireTitle(F)}: ${fireVerdict(F)}${F.cold ? ', and the house was cold last night' : ''}. ${WOOD_PATH}`;
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
// A fell button: the axe and the loads, its sentence its label to a screen reader and behind the callout's "i".
const fellBtn = (tile, n, cls, label, why) =>
  `<button type="button" class="${cls}" data-hud="fell" data-tile="${tile}" data-n="${n}"${
    why ? ` aria-label="${esc(why)}" title="${esc(why)}"` : ''
  }>${label}</button>`;
// The acts of a forest tile's callout: fell here, one load or more, or why not; or the task already planned here. Its words go to the
// callout's facts (page/ui2land hudCall).
function woodActs(i, f, facts) {
  if (!(w.trees[i] > 0) || !hudPlanned()) return '';
  const t = fellTask(i);
  if (t) {
    facts.push({
      k: 'fell',
      icon: actIcon('chop') + actIcon('queue'),
      n: `${t.got}/${t.n}`,
      label: 'Felling is in the plan',
      why: `Felling is in the plan here: ${t.got} of ${t.n} ${t.n === 1 ? 'load' : 'loads'} home.`,
    });
    return '';
  }
  const why = woodWhy(i, f);
  if (why) {
    facts.push({
      k: 'fell',
      icon: actIcon('no') + actIcon('chop'),
      n: '',
      label: 'Not for felling',
      why: `Not for felling: ${String(why).replace(/\b(at|tile) \d+\b/g, 'here')}.`,
    });
    return '';
  }
  const one = 'One load: a tree felled and its timber carried home. One task of the plan.';
  facts.push({ k: 'fellhow', chip: false, icon: actIcon('chop'), why: `Fell timber here. ${one}` });
  return (
    '<div class="u2-row2">' +
    fellBtn(i, 1, 'u2-act go', `${actIcon('plus')}${actIcon('chop')} Fell <b>1</b>`, `Fell timber here: ${one}`) +
    WOOD_LOADS.map((n) =>
      fellBtn(i, n, 'u2-chip', `${actIcon('chop')} <b>${n}</b>`, `Fell timber here: ${n} loads, one task of the plan.`),
    ).join('') +
    '</div>'
  );
}
// The first act that mends the fire (fireView's mend), as a button, or a chip that it is planned; its words to the callout's facts.
function fireAct(F, f, facts) {
  const k = F.mend[0];
  if (!k) return '';
  if (F.planned[k]) {
    const what = k === 'fell' ? 'Felling' : 'Cutting firewood';
    facts.push({
      k: 'mend',
      icon: actIcon(k === 'fell' ? 'chop' : 'build') + actIcon('queue'),
      n: '',
      label: `${what} is in the plan`,
      why: `${what} is in the plan.`,
    });
    return '';
  }
  if (k === 'firewood') {
    const why = `Cut firewood: ${woodTimber(F.timber)} at home, cut at the house.`;
    facts.push({ k: 'mend', chip: false, icon: goodIcon('wood'), why });
    return (
      `<button type="button" class="u2-act go" data-hud="cutwood" aria-label="${esc(why)}" title="${esc(why)}">` +
      `${actIcon('plus')}${goodIcon('wood')} Cut firewood</button>`
    );
  }
  const near = woodNear(f),
    n = Math.min(20, woodLoads(Math.max(1, F.goal - F.free - F.timber)));
  if (near.tile < 0) {
    facts.push({
      k: 'mend',
      icon: actIcon('no') + actIcon('chop'),
      n: '',
      cls: 'v2',
      why: 'No wood to fell within a day’s reach.',
    });
    return '';
  }
  const why =
    `Fell timber: ${n} ${n === 1 ? 'load' : 'loads'} at the nearest wood, ${near.d} ${near.d === 1 ? 'tile' : 'tiles'} off, ` +
    'carried home as timber. Or tap any forest tile.';
  facts.push({ k: 'mend', chip: false, icon: actIcon('chop'), why });
  return fellBtn(near.tile, n, 'u2-act go', `${actIcon('plus')}${actIcon('chop')} Fell <b>${n}</b>`, why);
}
// The house's wood: a chip of what lies at home ({fact}), and cutting it when it can be cut ({act}).
function houseWood(F) {
  if (!F) return { fact: null, act: '' };
  const fact = {
    k: 'wood',
    icon: goodIcon('wood'),
    n: String(F.nights),
    cls: F.short ? (F.wood < 1 ? 'v2' : 'v1') : '',
    label: fireTitle(F),
    why: `${fireTitle(F)}; ${woodTimber(F.timber)} at home to cut.`,
  };
  if (F.planned.firewood || !((F.timber > 0 || F.planned.fell) && F.short)) return { fact, act: '' };
  return {
    fact,
    act: `<button type="button" class="u2-chip" data-hud="cutwood" aria-label="Cut firewood">${actIcon('plus')}${goodIcon('wood')} Cut firewood</button>`,
  };
}
