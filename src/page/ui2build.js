// @sys page/ui2build: the new interface's build menu (Sim.buildMenu, VB-1627), the placing of what is chosen on the land, and the camp told apart
// ---- building: the menu, not tied to any tile, and the tap on the land that places what is chosen ----
// Kim (24 Nov): solo starts with nothing built; the menu offers the Farmstead, placed by a tap on the land with the site's reading shown
// there. The page's own state, never saved: hud.place, what is being placed ('farmstead') or null.
const BUILD_WHAT = {
  farmstead: {
    name: 'Farmstead',
    icon: () => actIcon('home'),
    line: 'A booth to begin with: a roof for the nights. It can be built up later.',
    here: 'Build the farmstead here',
  },
};
const placeG = new PIXI.Graphics(); // the tiles that would take what is being placed
L.hover.addChild(placeG);
let placeKey = '';
// The camp of farm f (farmstead.camp): 'camp' while nothing is placed, 'staked' once its booth is staked beside the house; null for a
// farm with no camp (its booth raised, or a farm not landed by hand).
function hudCamp(f) {
  if (!f || f.camp !== true) return null;
  const { hexSteps } = VB['sim/hex'];
  return Sim.stakedBooths(st).some((t) => hexSteps(w, t, f.house) <= 1) ? 'staked' : 'camp';
}
const buildTasked = () => {
  const P = hudPlanned();
  return !!P && P.tasks.some((t) => t.kind === 'farmstead');
};
// The build button calls for a tap while there is a camp and no farmstead in the plan: the first thing to do.
const buildCalls = (f) => hudCamp(f) === 'camp' && !buildTasked();
const buildCost = (e) =>
  `About ${hudSpan(e.hours)} of work to raise, and ${woodTimber(e.timber)} cut and carried from the wood`;
// ---- the ladder: what stands at the farmstead and what can follow (Sim.farmView, VB-1631), built up by an upgrade task (VB-1632) ----
const LADDER = {
  camp: { name: 'Camp', icon: () => goodIcon('flour'), line: 'The goods landed, and nothing built.' },
  booth: { name: 'Booth', icon: () => actIcon('home'), line: 'Poles and bark: a roof for the nights.' },
  cottage: { name: 'Cottage', icon: () => actIcon('home'), line: 'Log walls and a turf roof: a house to winter in.' },
  stone: {
    name: 'Stone foundation',
    icon: () => goodIcon('stone'),
    line: 'The cottage raised onto stones: its sills do not rot.',
  },
  barn: { name: 'Barn', icon: () => goodIcon('sheaves'), line: 'A barn for the harvest: less of it lost in store.' },
};
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
// The card of the upgrade icon, and the build menu under the Farmstead once it stands: what stands, what can follow and what it takes.
function ladderHTML(f) {
  const V = Sim.farmView(st, f.id);
  if (!V) return '';
  const row = (k, words, act) => {
    const L = ladderOf(k);
    return `<div class="u2-build u2-rung">${L.icon()}<span><b>${esc(L.name)}</b><span>${esc(L.line)}</span>${words}${act}</span></div>`;
  };
  let h = `<p class="sub">Stands now: <b>${esc(ladderOf(V.rung).name)}</b>. ${esc(ladderBuilding(V))}</p>`;
  for (const e of V.next)
    h += row(
      e.what,
      `<small>${esc(siteCap(ladderNeeds(e.needs)))}.</small>`,
      e.planned
        ? '<em class="ok">In the plan.</em>'
        : e.ok
          ? `<button type="button" class="u2-chip go" data-hud="upgrade" data-what="${esc(e.what)}">Build</button>`
          : `<em>Not now: ${esc(e.why)}.</em>`,
    );
  for (const o of V.outbuildings)
    h += row(
      o.what,
      '',
      o.built
        ? '<em class="ok">It stands.</em>'
        : o.ok
          ? '<em>It cannot be planned yet: its task is still to come.</em>'
          : `<em>Not now: ${esc(o.why)}.</em>`,
    );
  return h;
}
function ladderAdd(what) {
  const { f } = hudHouse();
  hudMsg(
    Sim.plan(st, 'add', { upgrade: f.house, what }),
    `Added to the plan: the ${ladderOf(what).name.toLowerCase()}.`,
  );
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
