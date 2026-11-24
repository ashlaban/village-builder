// @sys page/ui2build: the new interface's build menu (Sim.buildMenu, VB-1627), the placing of what is chosen on the land, and the camp told apart
// ---- building: the menu, not tied to any tile, and the tap on the land that places what is chosen ----
// Kim (24 Nov): solo starts with nothing built; the menu offers the Farmstead, placed by a tap on the land with the site's reading shown
// there. The page's own state, never saved: hud.place, what is being placed ('farmstead') or null.
const BUILD_WHAT = {
  farmstead: {
    name: 'Farmstead',
    icon: () => actIcon('home'),
    line: 'A shelter to begin with: a roof for the nights. It is built up in place later.',
    here: 'Build the farmstead here',
  },
};
const placeG = new PIXI.Graphics(); // the tiles that would take what is being placed
L.hover.addChild(placeG);
let placeKey = '';
// The camp of farm f (farmstead.camp): 'camp' while nothing is placed, 'staked' once its shelter is staked on the house tile (VB-1638;
// an older save's booth beside it); null for a farm with no camp (its shelter raised, or a farm not landed by hand).
function hudCamp(f) {
  if (!f || f.camp !== true) return null;
  const { hexSteps } = VB['sim/hex'];
  if (f.shelter) return 'staked';
  return Sim.stakedBooths(st).some((t) => hexSteps(w, t, f.house) <= 1) ? 'staked' : 'camp';
}
const buildTasked = () => {
  const P = hudPlanned();
  return !!P && P.tasks.some((t) => t.kind === 'farmstead');
};
// The build button calls for a tap while there is a camp and no farmstead in the plan: the first thing to do.
const buildCalls = (f) => hudCamp(f) === 'camp' && !buildTasked();
// the whole work, as the plan reckons it (`work`, VB-1630), and what it is made of: the raising, and the timber fetched before it
const buildCost = (e) =>
  e.work > e.hours
    ? `About ${hudSpan(e.work)} of work in all: ${hudSpan(e.hours)} raising it, the rest felling ${woodTimber(e.timber)} ` +
      'and carrying it from the wood'
    : `About ${hudSpan(e.hours)} of work to raise, and ${woodTimber(e.timber)} felled and carried from the wood`;
// ---- the ladder: what stands at the farmstead and what can follow (Sim.farmView, VB-1631), built up by an upgrade task (VB-1632) ----
const LADDER = {
  camp: { name: 'Camp', icon: () => goodIcon('flour'), line: 'The goods landed, and nothing built.' },
  shelter: {
    name: 'Shelter',
    icon: () => actIcon('home'),
    line: 'Poles and bark on the house tile: a roof for the nights.',
  },
  booth: { name: 'Booth', icon: () => actIcon('home'), line: 'Poles and bark: a roof for the nights.' },
  cottage: {
    name: 'Cottage',
    icon: () => actIcon('home'),
    line: 'Log walls and a turf roof, in place of the shelter: a house to winter in.',
  },
  foundation: {
    name: 'Stone foundation',
    icon: () => goodIcon('stone'),
    line: 'The house raised onto stones: it wears slower, and a well-kept house on stone gives its holder standing.',
  },
  barn: { name: 'Barn', icon: () => goodIcon('sheaves'), line: 'Grain and hay spoil half as fast in it.' },
  byre: {
    name: 'Byre',
    icon: () => goodIcon('beast'),
    line: 'Houses six animals through the winter; without one, a winter day unfed counts double.',
  },
};
LADDER.stone = LADDER.foundation;
const ladderOf = (k) => LADDER[k] || { name: siteCap(k), icon: () => actIcon('build'), line: '' };
const ladderNeeds = (n) =>
  [
    n.hours ? `about ${hudSpan(n.hours)} of work` : '',
    n.timber ? woodTimber(n.timber) : '',
    n.stone ? `${n.stone} stone` : '',
  ]
    .filter(Boolean)
    .join(', ');
// What is being built at farm f now, in words, or ''.
function ladderBuilding(V) {
  const b = V && V.building;
  if (!b || !b.step) return '';
  return `Building the ${ladderOf(b.what).name.toLowerCase()}: ${hudKind(b.step).toLowerCase()} now, about ${hudSpan(b.hoursLeft)} of work left.`;
}
// The card of the upgrade icon, and the build menu under the Farmstead once it stands: what stands, what can follow and what it takes:
// the next rung of the house, its foundation, the outbuildings (Sim.farmView, VB-1631, VB-1635, VB-1637), each built by a plan task.
function ladderHTML(f) {
  const V = Sim.farmView(st, f.id);
  if (!V) return '';
  const row = (k, e, kind, built) => {
    const L = ladderOf(k),
      b = e.building && e.building.step ? e.building : null,
      act = built
        ? '<em class="ok">It stands.</em>'
        : b
          ? `<em class="ok">Being built: ${esc(hudKind(b.step).toLowerCase())} now, about ${esc(hudSpan(b.hoursLeft))} of work left.</em>`
          : e.planned
            ? '<em class="ok">In the plan.</em>'
            : e.ok
              ? `<button type="button" class="u2-chip go" data-hud="upgrade" data-kind="${kind}" data-what="${esc(k)}">Build</button>`
              : `<em>Not now: ${esc(String(e.why).replace(/\bhousehold \d+/g, 'the household'))}.</em>`,
      cost = built || !e.needs ? '' : `<small>${esc(siteCap(ladderNeeds(e.needs)))}.</small>`;
    return `<div class="u2-build u2-rung">${L.icon()}<span><b>${esc(L.name)}</b><span>${esc(L.line)}</span>${cost}${act}</span></div>`;
  };
  const stone = V.foundation && V.foundation.grade === 'stone' ? ', on stone' : '';
  let h = `<p class="sub">Stands now: <b>${esc(ladderOf(V.rung).name)}</b>${stone}. ${esc(ladderBuilding(V))}</p>`;
  for (const e of V.next) h += row(e.what, e, 'upgrade', false);
  if (V.foundation) h += row('foundation', V.foundation, 'foundation', V.foundation.grade === 'stone');
  for (const o of V.outbuildings) h += row(o.what, o, 'outbuilding', o.built);
  return h;
}
// Build: the next rung (upgrade), the foundation, or an outbuilding, as one task of the plan at the house.
function ladderAdd(kind, what) {
  const { f } = hudHouse(),
    args = kind === 'foundation' ? { foundation: f.house } : { [kind]: f.house, what };
  hudMsg(Sim.plan(st, 'add', args), `Added to the plan: the ${ladderOf(what).name.toLowerCase()}.`);
}
function buildHTML() {
  const M = Sim.buildMenu(st),
    { f } = hudHouse();
  if (!M.length) return '<p class="sub">Nothing can be built now.</p>';
  // once the farmstead stands, what can follow it, as its upgrade icon shows it (one list, two ways in)
  if (f && !hudCamp(f)) return `<h3>The farmstead</h3>${ladderHTML(f)}`;
  return (
    M.map((e) => {
      const B = BUILD_WHAT[e.what] || { name: siteCap(e.what), icon: () => actIcon('build'), line: '' };
      return (
        `<button type="button" class="u2-build" data-hud="buildpick" data-what="${esc(e.what)}"${e.ok ? '' : ' disabled'}>` +
        `${B.icon()}<span><b>${esc(B.name)}</b><span>${esc(B.line)}</span><small>${esc(buildCost(e))}.</small>` +
        `${e.ok ? '' : `<em>Not now: ${esc(e.why)}.</em>`}</span></button>`
      );
    }).join('') + (M.some((e) => e.ok) ? '<p class="sub">Choose one, then tap the land where it is to stand.</p>' : '')
  );
}
function buildPick(what) {
  hud.place = what || null;
  hud.tab = null;
  hud.at = -1;
  hud.msg = null;
  sel = -1;
  hoverDirty = true;
}
// The tiles round the camp that would take what is placed (Sim.placeWhy), within the reach of the site's reading; once an hour.
function placeTiles(f) {
  const hour = Math.floor(st.t),
    key = `${hud.place}|${hour}|${f.house}`;
  if (hud.placeTiles && hud.placeTiles.key === key) return hud.placeTiles.set;
  const set = new Set(),
    R = Sim.landing.LANDING.soilSteps;
  for (const [j] of VB['sim/hex'].bfs(w, f.house, R, () => true).dist)
    if (Sim.placeWhy(st, hud.place, j) === null) set.add(j);
  hud.placeTiles = { key, set };
  return set;
}
// Each frame in play (renderHud): the line of help while placing, and the tiles that take it marked on the map.
function renderBuild(f) {
  if (hud.place && !Sim.buildMenu(st).some((e) => e.what === hud.place && e.ok)) hud.place = null; // it can no longer be placed
  const B = hud.place ? BUILD_WHAT[hud.place] : null;
  u2.help.hidden = !B;
  const key = B ? `${hud.place}|${Math.floor(st.t)}|${cam.z.toFixed(3)}|${hud.at}` : '';
  if (B && u2.help.dataset.what !== hud.place) {
    u2.help.dataset.what = hud.place;
    u2.help.innerHTML =
      `${B.icon()}<span>Tap the land where the ${B.name.toLowerCase()} is to stand. The marked tiles take it.</span>` +
      '<button type="button" class="u2-chip" data-hud="placeoff">Cancel</button>';
  } else if (!B) delete u2.help.dataset.what;
  for (const b of u2.tabs.children)
    if (b.dataset.tab === 'build') b.classList.toggle('call', buildCalls(f) && !hud.place && hud.tab !== 'build');
  if (key === placeKey) return;
  placeKey = key;
  placeG.clear();
  if (!B) return;
  for (const j of placeTiles(f)) if (j !== hud.at) placeG.poly(hexPoly(j, 0.86));
  placeG.fill({ color: 0xfff7ec, alpha: 0.28 }).stroke({ width: 2.5 / cam.z, color: 0xfff7ec, alpha: 0.9 });
}
// A tile's callout while placing: the site's reading, as the landing screen words it, and the one act, or why the tile will not take it.
function placeCall(i) {
  const B = BUILD_WHAT[hud.place],
    r = Sim.landing.read(w, i, false),
    wd = siteWords(r),
    why = Sim.placeWhy(st, hud.place, i),
    E = Sim.buildMenu(st).find((e) => e.what === hud.place);
  let h =
    `<div class="u2-verdict"><div><h2>${esc(VB['world/biomes'].BIOMES[w.biome[i]].name)}</h2>` +
    `<p class="sub">${why ? 'The farmstead cannot stand here.' : 'The farmstead can stand here.'}</p></div>` +
    '<button type="button" class="u2-x" data-hud="shut" aria-label="Close">×</button></div>';
  if (!w.water[i]) {
    h += '<div class="u2-rows">';
    for (const k of ['water', 'soil', 'wood'])
      h += `<div class="u2-row">${SITE_ICON[k]}<b>${esc(wd[k][0])}</b>${sitePips(r[k].band)}</div>`;
    h += `</div><p class="sub">${esc(wd.water[1])} ${esc(wd.soil[1])}</p>`;
  }
  if (hud.msg) h += `<p class="u2-msg${hud.msg.bad ? '' : ' ok'}">${esc(hud.msg.text)}</p>`;
  h += why
    ? `<p class="u2-msg">${esc(siteCap(why.replace(/\btile \d+/g, 'this tile')))}.</p>`
    : `<div class="u2-acts"><button type="button" class="u2-act go" data-hud="buildhere">${esc(B.here)}` +
      `<small>${E ? `${esc(buildCost(E))}. ` : ''}Added to the plan, done by ${esc(st.pawns[played()].given)}</small></button></div>`;
  return h;
}
function buildHere() {
  const what = hud.place,
    r = Sim.plan(st, 'add', { [what]: hud.at });
  hudMsg(r, `Added to the plan: the ${BUILD_WHAT[what].name.toLowerCase()}.`);
  if (r === true) hud.place = null;
}
// Esc leaves placing (before the page's own keys).
if (UI2)
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape' || !hud.place || !$('landing').hidden) return;
      e.stopImmediatePropagation();
      buildPick(null);
    },
    true,
  );
