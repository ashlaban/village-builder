// @sys page/ui2site: the solo start of the new interface: the land with nobody on it, read as a site (Sim.landing), and the tile chosen for the settler's farm
// ======== where to settle ========
// The mode is the page's own state, never saved: site = {seed, best: the sites pointed to, at: the tile read or -1, read: its reading,
// lens: the overlay shown, msg, busy}. While it is open there is no state (st is null): the world is as generated, and Sim.seed lays
// the farm on the tile chosen (its option `site`).
let site = null,
  siteKey = '';
const siteG = new PIXI.Graphics(), // the ground read round the tile: one path, one fill
  siteAtG = new PIXI.Graphics(); // the tile itself
L.hover.addChild(siteG, siteAtG);
const SITE_LENS = [
  { id: '', name: 'Land', dot: '#7fae5b' },
  {
    id: 'freshwater',
    name: 'Water',
    dot: '#2b83ba',
    key: ['near', WATER_RAMP, 'far', '● a well can be dug; the bigger, the shallower'],
  },
  { id: 'fertility', name: 'Soil', dot: '#a0da39', key: ['poor', FERTILITY_RAMP, 'rich'] },
  { id: 'woodland', name: 'Wood', dot: '#2f6b4f', key: ['bare', WOOD_COLOUR, 'full wood'] },
];
const SITE_ICON = {
  water: ICON.freshwater,
  soil: ICON.fertility,
  wood: ICON.woodland,
};
const siteCap = (t) => t[0].toUpperCase() + t.slice(1);
const siteHex = (c) => '#' + c.toString(16).padStart(6, '0');
const sitePips = (b) =>
  `<span class="u2-pips b${b}" aria-label="${['poor', 'fair', 'good', 'fine'][b]}"><i></i><i></i><i></i></span>`;
// A reading in words: one row for each of water, soil and wood, [title, line].
function siteWords(r) {
  const wt = r.water,
    dur = (h) => (h < 0.75 ? 'about half an hour' : h < 1.25 ? 'about an hour' : `${h.toFixed(1)} hours`),
    src = wt.name ? siteCap(wt.name.replace(/^an? /, '')) : '',
    days = wt.dig ? Math.max(1, Math.round(wt.dig / 10)) : 0;
  const water =
    wt.hours === Infinity || (wt.name === null && wt.well === null)
      ? ['No water', 'No fresh water in reach, and no well can be dug here.']
      : !wt.byWell
        ? [
            `${src} ${wt.walk < 0.13 ? 'at the door' : walkWords(wt.walk) + ' away'}`,
            `${siteCap(dur(wt.hours))} a day fetching water.`,
          ]
        : wt.srcHours < 3
          ? [
              `${src} ${walkWords(wt.walk)} away`,
              `A long fetch: ${dur(wt.srcHours)} a day. A ${wt.well} well by the house, about ${days} ${days === 1 ? 'day' : 'days'} of digging, ` +
                `cuts it to ${dur(wt.hours)}.`,
            ]
          : [
              'Water only by a well',
              `No stream or lake near. A ${wt.well} well by the house takes about ${days} days of digging; then ${dur(wt.hours)} a day.`,
            ];
  const so = r.soil,
    soil = [
      ['Poor ground', 'Thin soil', 'Good soil', 'Rich soil'][so.band],
      so.open >= 6
        ? `${so.open} open tiles near the house to break into fields.`
        : so.open > 0
          ? `Only ${so.open} open ${so.open === 1 ? 'tile' : 'tiles'} near the house: more fields must be cut from the wood.`
          : 'No open ground near the house: every field must be cut from the wood.',
    ];
  const wd = r.wood,
    wood = [
      wd.n === 0 ? 'No wood' : wd.steps <= 1 ? 'Wood at the door' : `Wood ${wd.steps} tiles off`,
      wd.n === 0
        ? 'No timber and no firewood within a short walk.'
        : `${wd.n >= 20 ? 'Plenty' : wd.n >= 8 ? 'Enough' : 'A little'} for timber and the winter's fire.`,
    ];
  return { water, soil, wood };
}
const siteGrade = (r) => (!r.ok ? 0 : r.stars >= 8 ? 3 : r.stars >= 6 ? 2 : r.stars >= 4 ? 1 : 0);
const siteVerdict = (r) =>
  !r.ok ? 'No farm can stand here' : ['A poor place', 'A hard place', 'A good place', 'A fine place'][siteGrade(r)];
function openSite(seed) {
  Sim.landing.lay(w);
  site = { seed, best: Sim.landing.best(w, 3), at: -1, read: null, lens: '', msg: '', busy: false };
  setSpeed(0);
  u2.lens.hidden = u2.sitecard.hidden = false;
  u2.lens.innerHTML = SITE_LENS.map(
    (l) =>
      `<button type="button" data-lens="${l.id}" aria-pressed="false"><i style="background:${l.dot}"></i>${l.name}</button>`,
  ).join('');
  siteLens('');
  renderSite();
}
function closeSite() {
  site = null;
  siteKey = '';
  siteG.clear();
  siteAtG.clear();
  u2Marks([]);
  u2.lens.hidden = u2.key.hidden = u2.sitecard.hidden = true;
}
function siteLens(id) {
  site.lens = id;
  chooseOverlay(null);
  if (id) chooseOverlay(id);
  const l = SITE_LENS.find((x) => x.id === id);
  for (const b of u2.lens.children) b.setAttribute('aria-pressed', String(b.dataset.lens === id));
  u2.key.hidden = !l.key;
  if (l.key)
    u2.key.innerHTML =
      `<span>${l.key[0]}</span><i style="background:linear-gradient(90deg, ${l.key[1].map(siteHex).join(',')})"></i>` +
      `<span>${l.key[2]}</span>${l.key[3] ? `<span class="note">${l.key[3]}</span>` : ''}`;
}
// The map's tap, while choosing (page/tileinfo's pick): the tile is read where it lies; the map is not moved under the finger.
function siteAt(sx, sy) {
  const i = loc(...toWorld(sx, sy), [0, 0]);
  if (i >= 0) siteChoose(i, false);
}
function siteChoose(i, fly) {
  if (!site || site.busy) return;
  site.at = i;
  site.read = i >= 0 ? Sim.landing.read(w, i) : null;
  site.msg = '';
  renderSite();
  if (fly && i >= 0) {
    // the tile comes to rest below the middle of the screen, the room above it left for its callout
    const z = Math.max(cam.z, clamp(30 / w.HW, zMin(), zMax)),
      dx = 0,
      dy = innerHeight * 0.22;
    flyTo(w.hx[i] - dx / z, w.hy[i] - dy / z, z);
  }
}
// What is on the land while choosing: a flag on each place scouted, and on the tile read a callout with its reading and the one act,
// Settle here. Below the map only a line of help and the three places' buttons, for when their flags are off the screen.
function renderSite() {
  if (!site) return;
  const r = site.read,
    marks = [];
  site.best.forEach((b, k) => {
    if (r && b.tile === r.tile) return;
    marks.push({
      id: `scout${k}`,
      tile: b.tile,
      cls: 'u2-flag',
      html:
        `<button type="button" data-scout="${k}" aria-label="Scouted place ${k + 1}: ${siteVerdict(b)}"><b>${k + 1}</b>` +
        `<span>${siteVerdict(b).replace(/^A /, '')}</span>` +
        `<i class="mini">${sitePips(b.water.band)}${sitePips(b.soil.band)}${sitePips(b.wood.band)}</i></button>`,
    });
  });
  if (r) {
    const wd = siteWords(r),
      k = site.best.findIndex((b) => b.tile === r.tile);
    let h =
      `<div class="u2-verdict"><span class="u2-stamp s${r.ok ? siteGrade(r) : 'x'}" aria-hidden="true">` +
      `${r.ok ? (k < 0 ? '★' : k + 1) : '×'}</span>`;
    h += `<div><h2>${siteVerdict(r)}</h2><p class="sub">${r.ok ? `${r.stars} of 9 for water, soil and wood` : esc(r.why)}</p></div>`;
    h += '<button type="button" class="u2-x" data-site="back" aria-label="Close">×</button></div>';
    if (r.ok) {
      // each of the three in a line, and in words the one that weighs most: the weakest (water first among equals)
      const weak = ['water', 'soil', 'wood'].reduce((a, key) => (r[key].band < r[a].band ? key : a), 'water');
      h += '<div class="u2-rows">';
      for (const key of ['water', 'soil', 'wood'])
        h += `<div class="u2-row">${SITE_ICON[key]}<b>${esc(wd[key][0])}</b>${sitePips(r[key].band)}</div>`;
      h += `</div><p class="sub">${esc(wd[weak][1])}</p>`;
      if (site.msg) h += `<p class="u2-msg">${esc(site.msg)}</p>`;
      h +=
        `<button type="button" class="u2-btn go" data-site="settle"${site.busy ? ' disabled' : ''}>` +
        `${site.busy ? 'Raising the house…' : 'Settle here'}</button>`;
    }
    marks.push({ id: 'read', tile: r.tile, cls: 'u2-call', call: true, html: h });
  }
  u2Marks(marks);
  u2.sitecard.innerHTML =
    (r ? '' : '<span><b>Where will you settle?</b> Tap the land to read it.</span>') +
    '<span class="u2-scouts">Scouted:' +
    site.best
      .map(
        (b, k) =>
          `<button type="button" data-scout="${k}" aria-pressed="${!!r && b.tile === r.tile}" aria-label="Go to scouted place ${k + 1}">` +
          `${k + 1}</button>`,
      )
      .join('') +
    '</span>';
}
// The marks drawn on the map itself: the tile read, and the ground its first fields are looked for in; again when the tile or zoom changes.
function siteMarks() {
  const mk = `${site.at}|${cam.z.toFixed(3)}`;
  if (mk === siteKey) return;
  siteKey = mk;
  siteG.clear();
  siteAtG.clear();
  if (site.at < 0) return;
  const near = VB['sim/hex'].bfs(w, site.at, Sim.landing.LANDING.soilSteps, VB['sim/walking'].walkable(w)).dist;
  for (const [j] of near) if (j !== site.at) siteG.poly(hexPoly(j, 0.96));
  siteG.fill({ color: 0xffffff, alpha: 0.22 });
  siteAtG
    .poly(hexPoly(site.at, 0.92))
    .fill({ color: site.read && site.read.ok ? 0xa8392b : 0x1f2a26, alpha: 0.45 })
    .stroke({ width: 4 / cam.z, color: 0xfff7ec, alpha: 1 });
}
// Settle: the scenario is seeded with its farm on the tile chosen, the settler is played, and the game waits, paused, on a welcome.
async function siteSettle() {
  if (!site || !site.read || !site.read.ok || site.busy) return;
  site.busy = true;
  renderSite();
  await frame();
  await frame();
  let sim = null;
  try {
    sim = Sim.seed(w, site.seed, 'solo', null, { site: site.at });
  } catch (e) {
    console.warn('No farm could be laid there', e);
  }
  if (!sim) {
    site.busy = false;
    site.msg = 'No farm could be laid out there. Try a tile close by.';
    renderSite();
    return;
  }
  chooseOverlay(null);
  closeSite();
  await swapWorld(w, sim, stagePainted);
  for (const k of chunks.keys()) staleChunk(k); // the land was painted with nobody on it
  setSpeed(0);
  const id = suggestedPawn(),
    f = sim.farmsteads[0];
  if (id >= 0) playAs(id);
  flyTo(w.hx[f.house], w.hy[f.house], clamp(46 / w.HW, zMin(), zMax));
  u2Welcome(id, f);
}
function u2Welcome(id, f) {
  const p = id >= 0 ? st.pawns[id] : null;
  u2.welcome.hidden = false;
  const who = p ? `You are <b>${esc(Sim.fullName(p))}</b>, ${p.age}, alone on new land. ` : '';
  u2.welcome.innerHTML =
    `<h2>${esc(f.name)} stands</h2><p>${who}It is the first morning of spring. Break a field and sow before the season turns; ` +
    'make hay in summer; reap in autumn; live on your stores through winter.</p>' +
    '<button type="button" class="u2-btn go" data-site="begin">Begin the first day</button>';
  u2.welcome.querySelector('button').focus({ preventScroll: true });
}
// Esc, while choosing: from a place read back to the places scouted (before the page's own keys, which would open the main menu).
if (UI2)
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape' || !site || site.at < 0 || !$('landing').hidden) return;
      e.stopImmediatePropagation();
      siteChoose(-1, false);
    },
    true,
  );
if (UI2)
  u2.u2.addEventListener('click', (e) => {
    const sc = e.target.closest('[data-scout]'),
      b = e.target.closest('[data-site]'),
      l = e.target.closest('[data-lens]');
    if (l && site) siteLens(l.dataset.lens);
    else if (sc && site) siteChoose(site.best[+sc.dataset.scout].tile, true);
    else if (b && b.dataset.site === 'back') siteChoose(-1, false);
    else if (b && b.dataset.site === 'settle') siteSettle();
    else if (b && b.dataset.site === 'begin') {
      u2.welcome.hidden = true;
      setSpeed(1);
    }
  });
