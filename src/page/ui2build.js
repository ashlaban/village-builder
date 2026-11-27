// @sys page/ui2build: the new interface's build menu (Sim.buildMenu, VB-1655), the placing of what is chosen on the land, and the camp told apart
// ---- building: the menu, not tied to any tile, and the tap on the land that places what is chosen ----
// Kim (24 Nov): solo starts with nothing built; the menu offers the Farmstead, placed by a tap on the land with the site's reading shown
// there. The page's own state, never saved: hud.place, what is being placed ('farmstead') or null.
const BUILD_WHAT = {
  farmstead: {
    name: 'Farmstead',
    icon: () => actIcon('home'),
    line: 'A shelter to begin with, to sleep under at night. It is built up in place later.',
    here: 'Build the farmstead here',
  },
};
const placeG = new PIXI.Graphics(); // the tiles that would take what is being placed
L.hover.addChild(placeG);
let placeKey = '';
// The camp of farm f (farmstead.camp): 'camp' while nothing is placed, 'staked' once its shelter is staked on the house tile (VB-1666;
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
// the whole work, as the plan reckons it (`work`, VB-1658), and what it is made of: the raising, and the timber fetched before it
const buildCost = (e) =>
  e.work > e.hours
    ? `About ${hudSpan(e.work)} of work in all: ${hudSpan(e.hours)} raising it, the rest felling ${woodTimber(e.timber)} ` +
      'and carrying it from the wood'
    : `About ${hudSpan(e.hours)} of work to raise, and ${woodTimber(e.timber)} felled and carried from the wood`;
// ---- the ladder: what stands at the farmstead and what can follow (Sim.farmView, VB-1659), built up by an upgrade task (VB-1660) ----
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
  timber: {
    name: 'Timber house',
    icon: () => goodIcon('wood'),
    line: 'Room for ten against six, and a smaller fire: it burns less wood than a cottage.',
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
// What is being built at farm f now, in words, or ''.
function ladderBuilding(V) {
  const b = V && V.building;
  if (!b || !b.step) return '';
  return `Building the ${ladderOf(b.what).name.toLowerCase()}: ${hudKind(b.step).toLowerCase()} now, about ${hudSpan(b.hoursLeft)} of work left.`;
}
// What a building takes, as chips: the work (stopwatch), the timber, the stone; pre: the row's key prefix. needs: {hours, timber, stone}.
function buildNeedFacts(n, pre, workWhy) {
  if (!n) return [];
  return [
    n.hours
      ? {
          k: `${pre}w`,
          icon: actIcon('clock'),
          n: laneSpanN(n.hours),
          label: `${hudSpan(n.hours)} of work`,
          why: workWhy || `About ${hudSpan(n.hours)} of work.`,
        }
      : null,
    n.timber
      ? {
          k: `${pre}t`,
          icon: actIcon('timber'),
          n: String(Math.round(n.timber)),
          label: woodTimber(n.timber),
          why: `${siteCap(woodTimber(n.timber))}, felled and carried from the wood.`,
        }
      : null,
    n.stone
      ? {
          k: `${pre}s`,
          icon: goodIcon('stone'),
          n: String(n.stone),
          label: `${n.stone} stone`,
          why: `${n.stone} stone.`,
        }
      : null,
  ].filter(Boolean);
}
// The card of the upgrade icon, and the build menu under the Farmstead once it stands: what stands, what can follow and what it takes:
// the next rung of the house, its foundation, the outbuildings (Sim.farmView, VB-1659, VB-1663, VB-1665), each built by a plan task.
// A row is its icon, its name, the chips of what it takes and how it stands, and Build; its words behind its own "i" or the slot's.
function ladderHTML(f, slot = 'cinfo') {
  const V = Sim.farmView(st, f.id, st.player ? st.player.pawn : null);
  if (!V) return '';
  const row = (k, e, kind, built) => {
    const L = ladderOf(k),
      pre = `r-${k}-`,
      b = e.building && e.building.step ? e.building : null,
      facts = [{ k: `${pre}line`, chip: false, icon: L.icon(), why: L.line }];
    if (!built) facts.push(...buildNeedFacts(e.needs, pre));
    facts.push(
      built
        ? { k: `${pre}ok`, icon: actIcon('vok'), n: '', cls: 'v0', label: 'It stands', why: 'It stands.' }
        : b
          ? {
              k: `${pre}ok`,
              icon: actIcon('build'),
              n: laneSpanN(b.hoursLeft),
              cls: 'v1',
              label: 'Being built',
              why: `Being built: ${hudKind(b.step).toLowerCase()} now, about ${hudSpan(b.hoursLeft)} of work left.`,
            }
          : e.planned
            ? { k: `${pre}ok`, icon: actIcon('queue'), n: '', label: 'In the plan', why: 'In the plan.' }
            : e.ok
              ? {
                  k: `${pre}ok`,
                  icon: actIcon('vok'),
                  n: '',
                  cls: 'v0',
                  label: 'Can be built',
                  why: 'Can be built now: Build adds it to the plan.',
                }
              : {
                  k: `${pre}ok`,
                  icon: actIcon('no'),
                  n: '',
                  cls: 'v2',
                  label: 'Not now',
                  why: `Not now: ${String(e.why).replace(/\bhousehold \d+/g, 'the household')}.`,
                },
    );
    const act =
      !built && !b && !e.planned && e.ok
        ? `<button type="button" class="u2-chip go" data-hud="upgrade" data-kind="${kind}" data-what="${esc(k)}" ` +
          `aria-label="${esc(`Build the ${L.name.toLowerCase()}`)}">${actIcon('plus')} Build</button>`
        : '';
    return (
      `<div class="u2-build u2-rung">${L.icon()}<span><span class="u2-rhead"><b>${esc(L.name)}</b>${factI(slot, pre, `${L.name}: what it means`)}</span>` +
      `<span class="u2-facts">${factChips(facts, slot)}${act}</span>${factWords(facts, slot, pre)}</span></div>`
    );
  };
  const stone = V.foundation && V.foundation.grade === 'stone' ? ', on stone' : '';
  let h = `<p class="sub">Stands now: <b>${esc(ladderOf(V.rung).name)}</b>${stone}.</p>`;
  // the house's next rung under way is farmView's own `building` (its entry has none)
  for (const e of V.next)
    h += row(
      e.what,
      { ...e, building: V.building && V.building.what === e.what ? V.building : null },
      'upgrade',
      false,
    );
  if (V.foundation) h += row('foundation', V.foundation, 'foundation', V.foundation.grade === 'stone');
  for (const o of V.outbuildings) h += row(o.what, o, 'outbuilding', o.built);
  return h;
}
// Build: the next rung (upgrade), the foundation, or an outbuilding, as one task of the plan at the house.
function ladderAdd(kind, what) {
  const { f } = hudHouse(),
    args = kind === 'foundation' ? { foundation: f.house } : { [kind]: f.house, what };
  hudMsg(Sim.plan(st, st.player.pawn, 'add', args), `Added to the plan: the ${ladderOf(what).name.toLowerCase()}.`);
}
function buildHTML() {
  const M = Sim.buildMenu(st, st.player.pawn),
    { f } = hudHouse();
  if (!M.length) return '<p class="sub">Nothing can be built now.</p>';
  // once the farmstead stands, what can follow it, as its upgrade icon shows it (one list, two ways in)
  if (f && !hudCamp(f)) return `<h3>The farmstead</h3>${ladderHTML(f, 'binfo')}`;
  // an entry: its icon and name (the button that places it), then chips of its cost (work, timber) and an ok or no mark; words behind "i"
  return M.map((e) => {
    const B = BUILD_WHAT[e.what] || { name: siteCap(e.what), icon: () => actIcon('build'), line: '' },
      pre = `m-${e.what}-`,
      facts = [
        { k: `${pre}line`, chip: false, icon: B.icon(), why: B.line },
        ...buildNeedFacts({ hours: Math.max(e.work || 0, e.hours || 0), timber: e.timber }, pre, `${buildCost(e)}.`),
        e.ok
          ? {
              k: `${pre}ok`,
              icon: actIcon('vok'),
              n: '',
              cls: 'v0',
              label: 'Can be built',
              why: 'Can be built now: choose it, then tap the land where it is to stand.',
            }
          : { k: `${pre}ok`, icon: actIcon('no'), n: '', cls: 'v2', label: 'Not now', why: `Not now: ${e.why}.` },
      ];
    return (
      `<div class="u2-build u2-rung">${B.icon()}<span><span class="u2-rhead">` +
      `<button type="button" class="u2-chip go" data-hud="buildpick" data-what="${esc(e.what)}"${e.ok ? '' : ' disabled'} ` +
      `aria-label="${esc(`${B.name}: choose it, then tap the land`)}">${actIcon('plus')} ${esc(B.name)}</button>` +
      `${factI('binfo', pre, `${B.name}: what it means`)}</span>` +
      `<span class="u2-facts">${factChips(facts, 'binfo')}</span>${factWords(facts, 'binfo', pre)}</span></div>`
    );
  }).join('');
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
// Placing is unrestricted (VB-1667; Kim: "unrestricted, but it will be more difficult to survive"): the tiles in view only are asked
// (Sim.placeWhy, cheap for any tile), again when the view or the hour changes; none when the land is too far out to tap a tile.
const PLACE_MAX = 900; // tiles in view asked at most
function placeTiles(f) {
  const [x0, y0, x1, y1] = viewRect(w.R),
    q = (v) => Math.round(v / (w.R * 4)),
    key = `${hud.place}|${Math.floor(st.t)}|${f.house}|${q(x0)},${q(y0)},${q(x1)},${q(y1)}`;
  if (hud.placeTiles && hud.placeTiles.key === key) return hud.placeTiles.set;
  const set = new Set(),
    seen = [];
  for (let j = 0; j < w.N && seen.length <= PLACE_MAX; j++)
    if (w.hx[j] >= x0 && w.hx[j] <= x1 && w.hy[j] >= y0 && w.hy[j] <= y1 && !w.water[j]) seen.push(j);
  if (seen.length <= PLACE_MAX)
    for (const j of seen) if (Sim.placeWhy(st, st.player.pawn, hud.place, j) === null) set.add(j);
  hud.placeTiles = { key, set };
  return set;
}
// The move of the farm from its landing to tile i (Sim.moveCost), in words: how far, the trips, the days, and the frost.
function moveWords(i) {
  const M = Sim.moveCost ? Sim.moveCost(st, st.player.pawn, i) : null;
  if (!M || !M.steps) return '';
  const trips = (n) => `${n} ${n === 1 ? 'trip' : 'trips'}`;
  return (
    `${M.steps} ${M.steps === 1 ? 'tile' : 'tiles'} from the landing. The goods stay at the landing and are fetched: ` +
    `${trips(M.trips.cart)} by cart (${trips(M.trips.back)} on the back without it), about ${hudSpan(M.hours)} of work, ` +
    'the animals driven over first. What still lies at the landing at the frost is lost.' +
    (M.frost ? ' The frost comes before it can all be fetched.' : '')
  );
}
// Each frame in play (renderHud): the line of help while placing, and the tiles that take it marked on the map.
function renderBuild(f) {
  if (hud.place && !Sim.buildMenu(st, st.player.pawn).some((e) => e.what === hud.place && e.ok)) hud.place = null; // it can no longer be placed
  const B = hud.place ? BUILD_WHAT[hud.place] : null;
  u2.help.hidden = !B;
  const key = B
    ? `${hud.place}|${Math.floor(st.t)}|${cam.z.toFixed(3)}|${Math.round(cam.x / w.R)},${Math.round(cam.y / w.R)}|${hud.at}`
    : '';
  if (B && u2.help.dataset.what !== hud.place) {
    u2.help.dataset.what = hud.place;
    u2.help.innerHTML =
      `${B.icon()}<span>Tap a marked tile</span>` +
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
    why = Sim.placeWhy(st, st.player.pawn, hud.place, i),
    E = Sim.buildMenu(st, st.player.pawn).find((e) => e.what === hud.place),
    facts = [
      why
        ? {
            k: 'can',
            icon: actIcon('no'),
            n: '',
            cls: 'v2',
            label: 'Cannot stand here',
            why: `The ${B.name.toLowerCase()} cannot stand here: ${siteCap(why.replace(/\btile \d+/g, 'this tile'))}.`,
          }
        : {
            k: 'can',
            icon: actIcon('vok'),
            n: '',
            cls: 'v0',
            label: 'Can stand here',
            why: `The ${B.name.toLowerCase()} can stand here.`,
          },
    ];
  if (!w.water[i]) facts.push({ k: 'site', chip: false, icon: goodIcon('tile'), why: `${wd.water[1]} ${wd.soil[1]}` });
  const move = why ? '' : moveWords(i);
  if (move) {
    const M = Sim.moveCost(st, st.player.pawn, i);
    facts.push({
      k: 'move',
      icon: goodIcon('cart'),
      n: String(M.steps),
      cls: M.frost ? 'v2' : '',
      label: `${M.steps} ${M.steps === 1 ? 'tile' : 'tiles'} from the landing`,
      why: move,
    });
  }
  const cost =
    !why && E
      ? buildNeedFacts({ hours: Math.max(E.work || 0, E.hours || 0), timber: E.timber }, 'c-', `${buildCost(E)}.`)
      : [];
  if (!why)
    facts.push({
      k: 'who',
      chip: false,
      icon: actIcon('plus'),
      why: `Added to the plan, done by ${st.pawns[played()].given}.`,
    });
  let h =
    `<div class="u2-verdict"><h2>${esc(VB['world/biomes'].BIOMES[w.biome[i]].name)}</h2>${factI('cinfo')}` +
    '<button type="button" class="u2-x" data-hud="shut" aria-label="Close">×</button></div>' +
    `<div class="u2-facts">${factChips(facts, 'cinfo')}</div>`;
  if (!w.water[i]) {
    h += '<div class="u2-rows">';
    for (const k of ['water', 'soil', 'wood'])
      h += `<div class="u2-row">${SITE_ICON[k]}<b>${esc(wd[k][0])}</b>${sitePips(r[k].band)}</div>`;
    h += '</div>';
  }
  h += factWords([...facts, ...cost], 'cinfo');
  if (hud.msg) h += `<p class="u2-msg${hud.msg.bad ? '' : ' ok'}">${esc(hud.msg.text)}</p>`;
  if (!why)
    h +=
      `<div class="u2-acts"><button type="button" class="u2-act go" data-hud="buildhere" aria-label="${esc(B.here)}">` +
      `${actIcon('plus')}${B.icon()} Build here</button>` +
      (cost.length ? `<div class="u2-facts">${factChips(cost, 'cinfo')}</div>` : '') +
      '</div>';
  return h;
}
function buildHere() {
  const what = hud.place,
    r = Sim.plan(st, st.player.pawn, 'add', { [what]: hud.at });
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
