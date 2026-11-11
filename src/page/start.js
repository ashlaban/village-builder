// @sys page/start: the start of a new game (VB-340): the built scenarios as picture cards; the chosen one on the showcase island re-seeded
// with it, in a framed view of the stage with callouts on its real farms and tiles; who starts and the story archetypes, as a look
  // ======== the start ========
  // The start is page state, never saved. The showcase island of DEMO.start's seed is raised once for each scenario (its world, run and
  // painted overview), the chosen one shown on the stage; a game that is open is kept aside meanwhile (`aside`) and comes back with Back.
  // design.md, Starting a game: one choice made once (the scenario, size and seed here; the person after the land is raised), nothing
  // drawn by hand, no number that is not read from a run, nothing that moves under the pointer.
  let start = null, aside = null;
  const START_ORDER = ['founders', 'heirs', 'populous'];
  // The words are the mock's (docs/mocks/setup.html, SCENARIOS), without the numbers a run gives.
  const START_WORDS = {
    founders: { name: 'Founders', line: 'Strangers, a few houses, and land no one has broken.',
      year: [['Spring', 'Break fields, sow'], ['Summer', 'Clear meadows, make hay'], ['Autumn', 'A small first harvest'], ['Winter', 'Live on stores']],
      stores: 'A year’s grain to eat and seed to sow, and next to no fields or meadows' },
    heirs: { name: 'Heirs and empty farms', line: 'Old villages with long memories, and more heirs than farms.', year: null, stores: null },
    populous: { name: 'Populous Villages', line: 'A settled archipelago, already full of neighbours.',
      year: [['Now', 'Grown children at home'], ['The round', 'Service, a farm, new land'], ['The gathering', 'Trade and marriages'],
        ['Later', 'Land runs short']], stores: null },
  };
  // The living at the start, for each map size: the least and the most of Sim.seed at the seeds of DEMO.seeds (tests/start.js runs them).
  const START_PEOPLE = {
    founders: { t: [10, 10], s: [10, 10], m: [10, 10], l: [10, 10] }, heirs: { t: [18, 18], s: [18, 18], m: [18, 18], l: [18, 18] },
    populous: { t: [135, 157], s: [320, 352], m: [807, 835], l: [800, 859] },
  };
  const START_SIGNS = {
    well: 'M6 21V7M3 10l14-6M17 4v7M15 11h4v4h-4zM10 21h10', tree: 'M12 21v-6M12 3l6 12H6z',
    meadow: 'M12 21V11M9 8a3 3 0 1 0 6 0 3 3 0 1 0-6 0M12 16q-4 0-5-3M12 18q4 0 5-3',
    gens: 'M12 3a2 2 0 1 0 0 4 2 2 0 1 0 0-4M6 16a2 2 0 1 0 0 4 2 2 0 1 0 0-4M18 16a2 2 0 1 0 0 4 2 2 0 1 0 0-4M12 7v4M6 16v-2.5h12V16',
    village: 'M2 13l5-4 5 4M3.5 12v7h7v-7M12 11l5-4 5 4M13.5 10v9h7v-9',
  };
  const startSign = (k) => (SIGN_PATHS[k] ? sign(k) : svgIcon(24, 24, `<path d="${START_SIGNS[k]}"/>`, ICON_STROKE));
  const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  const inWords = (n) => NUMBER_WORDS[n] || String(n);
  const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
  const startOpen = () => !!start && !$('genScreen').hidden;

  // ---- the showcase runs ----
  // The seed of the start's island: the menu's own where all three scenarios fit there, else one of those seeds.
  function startSeed() {
    if (demoRun && DEMO.start.includes(demoRun.seed)) return demoRun.seed;
    return DEMO.start[(Math.random() * DEMO.start.length) | 0]; // a visit's island: the page's choice, as the menu's is
  }
  // How many generations the run has on record: the longest line of parents, the dead included.
  function generations(s) {
    const depth = new Map();
    const of = (id) => {
      if (id === null || id === undefined) return 0;
      if (!depth.has(id)) { const p = s.pawns[id]; depth.set(id, 0); depth.set(id, 1 + Math.max(of(p.father), of(p.mother))); }
      return depth.get(id);
    };
    return s.pawns.reduce((m, p) => Math.max(m, of(p.id)), 0);
  }
  const liveIn = (s, f) => f.household !== null && f.household !== undefined && !s.households[f.household].dissolved;
  const yearsEmpty = (s, f) => Math.max(1, Math.floor((s.t - f.emptySince) / Sim.YEAR));
  // The open tile nearest a point that passes a test, 2 to 7 steps from it: a meadow with no field, a stand of forest.
  function nearTile(wd, from, ok) {
    let best = -1, bd = Infinity;
    for (let i = 0; i < wd.N; i++) {
      if (wd.water[i] || (wd.dev && wd.dev[i]) || !ok(i)) continue;
      const d = Math.hypot(wd.hx[i] - wd.hx[from], wd.hy[i] - wd.hy[from]) / wd.HW;
      if (d >= 2 && d <= 7 && d < bd) { bd = d; best = i; }
    }
    return best;
  }
  // What the picture frames and the callouts on it, each {x, y} in the world (none for one said in words), an icon or a picture, the
  // words, and `edge` for one that may lie outside the picture and is then put at its edge, towards it.
  function pinsOf(wd, s, sc) {
    const T = (i) => ({ x: wd.hx[i], y: wd.hy[i] }), B = G.B, farms = (v) => v.farmsteads.map((id) => s.farmsteads[id]);
    const pic = (url, gone) => ({ img: url, gone });
    let v, pins;
    if (sc === 'founders') {
      v = s.villages[0];
      const fs = farms(v), meadow = nearTile(wd, v.center, (i) => wd.biome[i] === B.MEADOW);
      const wood = nearTile(wd, v.center, (i) => (wd.biome[i] === B.FOREST || wd.biome[i] === B.PINE) && wd.trees[i] > 0);
      pins = [{ ...T(fs[0].house), ...pic(farmIcon(fs[0])), text: 'The houses stand ready' },
        v.well ? { x: wd.hx[v.center] + 1, y: wd.hy[v.center] + 10, icon: 'well', text: 'One well between them' } : null,
        meadow >= 0 ? { ...T(meadow), icon: 'meadow', text: 'No field broken yet' } : null,
        wood >= 0 ? { ...T(wood), icon: 'tree', text: 'Forest to clear for hay meadows' } : null];
    } else if (sc === 'heirs') {
      v = s.villages[0];
      const fs = farms(v), lived = fs.filter((f) => liveIn(s, f)), empty = fs.find((f) => !liveIn(s, f));
      const ruin = s.farmsteads.find((f) => f.state === 'ruin'), field = lived.find((f) => f.fields.length);
      pins = [empty ? { ...T(empty.house), ...pic(farmIcon(empty), true), text: `Empty for ${plural(yearsEmpty(s, empty), 'year')}: no smoke at the hearth` }
        : null,
      lived.length ? { ...T(lived[0].house), ...pic(farmIcon(lived[0])), text: `${capital(inWords(lived.length))} farms lived in` } : null,
      field ? { ...T(field.fields[0].tile), icon: 'field', text: 'Fields worked for generations' } : null,
      ruin ? { ...T(ruin.house), ...pic(farmIcon(ruin), true), edge: true,
        text: `A ruin, ${plural(yearsEmpty(s, ruin), 'year')} empty, in ${s.villages[ruin.village].name}` } : null];
    } else {
      v = s.villages.reduce((a, b) => (b.farmsteads.length > a.farmsteads.length ? b : a));
      const field = farms(v).find((f) => f.fields.length), n = v.farmsteads.length;
      pins = [{ ...T(v.center), ...pic(villageIcon(v)), text: `${v.name}: ${inWords(n)} farms${v.green ? ' round a green' : ''}` },
        field ? { ...T(field.fields[0].tile), icon: 'field', text: 'Every farm has its fields' } : null,
        { x: null, y: null, icon: 'village', text: `${capital(inWords(s.villages.length))} villages on this island` }];
    }
    // the frame: the village's houses and the callouts on it, a step and a half round
    const pts = [...farms(v).map((f) => T(f.house)), ...pins.filter((p) => p && p.x !== null && !p.edge)], m = wd.HW * 1.5;
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const frame = { x0: Math.min(...xs) - m, x1: Math.max(...xs) + m, y0: Math.min(...ys) - m, y1: Math.max(...ys) + m };
    return { village: v.id, frame, pins: pins.filter(Boolean) };
  }
  async function raiseRun(seed, sc) {
    const wd = await drive(G.generate(seed, { cols: DEMO.cols, rows: DEMO.rows }), () => {});
    const sim = Sim.seed(wd, seed, sc);
    const painted = await paintOverview(wd, () => {});
    return { wd, sim, painted, sc, gens: generations(sim), ...pinsOf(wd, sim, sc) };
  }
  // A scenario's run on the start's island: raised once, then kept until a game is raised or loaded.
  function runOf(sc) {
    if (!start.runs.has(sc)) {
      const job = raiseRun(start.seed, sc).then((r) => { if (start && start.runs.get(sc) === job) { start.ready.set(sc, r); renderCards(); } return r; });
      start.runs.set(sc, job);
    }
    return start.runs.get(sc);
  }

  // ---- opening, choosing, leaving ----
  // New archipelago, Back from whom to play, or a build that found no room (msg, shown in the bar). A game that is open is kept aside.
  function openStart(msg) {
    $('genSeed').value = String(choice.seed); $('genSize').value = choice.size;
    $('genMsg').hidden = !msg; $('genMsg').textContent = msg || '';
    if (!start) {
      start = { sc: choice.scenario, seed: startSeed(), runs: new Map(), ready: new Map(), look: null, pressed: null, shown: null, place: null, off: null };
      if (demo && demoRun && demoRun.seed === start.seed && st) { // the menu's island is the start's: its run is the one of that scenario
        const r = { wd: w, sim: st, painted: stagePainted, sc: demoRun.sc, gens: generations(st), ...pinsOf(w, st, demoRun.sc) };
        start.runs.set(r.sc, Promise.resolve(r)); start.ready.set(r.sc, r);
      }
    }
    if (w && !demo && !aside) aside = { wd: w, sim: st, painted: stagePainted, cam: { x: cam.x, y: cam.y, z: cam.z } };
    openPanel(null); closeSpeedOptions(); closeNotices();
    $('landing').hidden = true; $('genScreen').hidden = false; loader.classList.add('done');
    start.shown = null; renderStart(); chooseScenario(start.sc);
    if (!msg) $('startCards').querySelector(`[data-sc="${start.sc}"]`).focus({ preventScroll: true });
  }
  // A card chosen: the island is shown with that scenario (raised first, the first time), then the other two are raised behind it.
  function chooseScenario(sc) {
    start.sc = sc; start.look = start.pressed = null; $('genScenario').value = sc;
    renderCards();
    onStage(async () => {
      if (!startOpen() || building || start.sc !== sc) return;
      let r;
      try { r = await runOf(sc); } catch (e) { console.warn('The showcase island has no room for', sc, e); return; }
      if (!startOpen() || building || start.sc !== sc) return;
      if (st !== r.sim) { demo = true; document.body.classList.add('demo'); await swapWorld(r.wd, r.sim, r.painted); }
      demoAt = null; intro = null; start.shown = r; start.place = r.frame; renderStart();
      for (const o of START_ORDER) if (!start.runs.has(o)) onStage(() => (startOpen() && !building ? runOf(o).catch(() => {}) : null));
    });
  }
  // Back: the game kept aside comes back, or, with none, the start's island stays behind the main menu.
  function startBack() {
    if (!start) { showLanding(); return; }
    $('genScreen').hidden = true; $('genMsg').hidden = true;
    onStage(async () => {
      if (aside) await restoreAside();
      else if (demo && start && start.shown) { const v = st.villages[start.shown.village]; demoAt = { x: w.hx[v.center], y: w.hy[v.center], r: w.HW * 5 }; }
      if ($('genScreen').hidden && loader.classList.contains('done') && !building) showLanding();
    });
  }
  async function restoreAside() {
    const a = aside; aside = null;
    demo = false; demoAt = null; document.body.classList.remove('demo');
    await swapWorld(a.wd, a.sim, a.painted);
    intro = null; cam.x = a.cam.x; cam.y = a.cam.y; cam.z = zt = a.cam.z; vel.x = vel.y = 0;
    settlersHTML = ''; $('settlers').textContent = ''; customsStamp = '';
    if (choose && choose.farm >= 0) { sel = st.farmsteads[choose.farm].house; selectionPinned = true; hoverDirty = true; renderChoose(); }
  }
  // A game raised or loaded drops the start's islands and the game kept aside (page/loader, build).
  function dropStart() { start = null; aside = null; }
  // The jobs that change the stage, one after another: the menu's island, the start's, the game kept aside (build waits for them).
  function onStage(fn) {
    const job = (demoJob || Promise.resolve()).then(fn).catch((e) => console.warn('The stage could not be changed', e));
    demoJob = job; job.then(() => { if (demoJob === job) demoJob = null; });
    return job;
  }

  // ---- what the start shows ----
  function renderCards() {
    if (!start) return;
    const size = $('genSize').value;
    $('startCards').innerHTML = START_ORDER.map((k) => {
      const r = start.ready.get(k), n = (START_PEOPLE[k] || {})[size], words = START_WORDS[k];
      const people = n ? `${n[0] === n[1] ? n[0] : `${n[0]}–${n[1]}`} people` : '';
      const gens = r ? plural(r.gens, 'generation') : '';
      const pic = r ? [...(r.sim.villages[r.village].green ? [iconImg(villageIcon(r.sim.villages[r.village]), 'fi')] : []),
        ...r.sim.villages[r.village].farmsteads.slice(0, 6).map((id) => r.sim.farmsteads[id])
          .map((f) => iconImg(farmIcon(f), `fi${liveIn(r.sim, f) ? '' : ' gone'}`))].join('') : '';
      return `<button type="button" class="scard" data-sc="${k}" aria-pressed="${k === start.sc}"><span class="cpic ${k}">${pic}</span>`
        + `<b>${esc(words.name)}</b><small>${esc(words.line)}</small><span class="stats"><span>${startSign('people')}${people}</span>`
        + `<span>${startSign('gens')}${gens}</span></span></button>`;
    }).join('');
  }
  function renderStart() {
    renderCards();
    const r = start.shown, words = START_WORDS[start.sc];
    $('startName').textContent = words.name;
    $('startPins').innerHTML = ''; $('startPinList').innerHTML = ''; $('startYear').innerHTML = ''; $('startRows').innerHTML = '';
    $('startWho').innerHTML = ''; $('startStories').innerHTML = '';
    if (!r) return;
    const mark = (p) => (p.img ? iconImg(p.img, `fi${p.gone ? ' gone' : ''}`) : startSign(p.icon));
    $('startPins').innerHTML = r.pins.map((p, k) => `<span class="pin${p.x === null ? ' fixed' : ''}" data-pin="${k}"><span class="mk">${mark(p)}`
      + `${sign('next')}</span><b>${esc(p.text)}</b></span>`).join('');
    $('startPinList').innerHTML = r.pins.map((p) => `<li>${mark(p)}<span>${esc(p.text)}</span></li>`).join('');
    $('startYear').innerHTML = yearAhead(r).map(([a, b]) => `<div><b>${esc(a)}</b>${esc(b)}</div>`).join('');
    $('startRows').innerHTML = unusual(r).map(([ic, t]) => `<li>${startSign(ic)}<span>${esc(t)}</span></li>`).join('');
    $('startStories').innerHTML = storyCards(start.sc, start.pressed);
    renderWho();
  }
  // The year ahead in four steps: the mock's, with the heirs' ages read from the run.
  function yearAhead(r) {
    if (START_WORDS[r.sc].year) return START_WORDS[r.sc].year;
    const living = st.pawns.filter((p) => p.died === null), oldest = (k) => living.filter((p) => positionOf(p.id) === k).sort((a, b) => b.age - a.age)[0];
    const heir = oldest('heir'), single = oldest('bachelor');
    return [['Now', heir ? `An heir of ${Sim.age(st, heir)} waits` : 'An heir waits'], ['The round', 'An empty farm, a ruin'],
      ['The meeting', 'Who may inherit?'], ['Soon', single ? `An unmarried holder of ${Sim.age(st, single)}` : 'A holder with no heir']];
  }
  // What is unusual in the stores (the scenario's) and in the customs: each village's practice where it is not the old Nordic one.
  function unusual(r) {
    const base = Culture.ARCHETYPES.oldNordic, groups = new Map();
    for (const v of st.villages) {
      const p = Sim.practice(st, v.id), odd = Culture.DIMS.filter((d) => base[d.key] && p[d.key] !== base[d.key])
        .map((d) => `${d.label.toLowerCase()}: ${d.opts.find((o) => o[0] === p[d.key])[1].toLowerCase()}`).join('; ');
      if (!groups.has(odd)) groups.set(odd, []);
      groups.get(odd).push(v.name);
    }
    const rows = START_WORDS[r.sc].stores ? [['sack', START_WORDS[r.sc].stores]] : [];
    const say = (odd) => `Old Nordic customs${odd ? `, but ${odd}` : ''}`;
    if (groups.size === 1) rows.push(['scroll', `${say([...groups.keys()][0])}${st.villages.length > 1 ? ', in every village' : ''}`]);
    else for (const [odd, names] of groups) rows.push(['scroll', `${names.length > 2 ? 'The other villages' : names.join(' and ')}: ${say(odd)}`]);
    return rows;
  }
  // Who starts: the run's people, an example; few, every farm as a card; many, an age pyramid. The archetype looked at lights its people.
  function renderWho() {
    if (!start || !start.shown) return;
    const cur = start.look || start.pressed, story = cur ? (STORIES[start.sc] || []).find((x) => x[0] === cur) : null;
    const all = [];
    for (const hh of st.households) if (!hh.dissolved) all.push(...householdPeople(hh));
    const on = (id) => !!cur && st.pawns[id].age >= ADULT && inStory(cur, id), lit = all.filter(on).length;
    const face = (id) => faceImg(id, `pf${cur ? (on(id) ? ' on' : ' off') : ''}`);
    const said = (rest) => (story ? `${lit} of ${all.length}: ${esc(story[1].toLowerCase())}` : rest);
    let h;
    if (all.length <= 30) {
      const fs = st.farmsteads.slice().sort((a, b) => a.village - b.village || a.id - b.id), named = start.sc !== 'founders';
      h = `<div class="fcards">${fs.map((f) => {
        const hh = liveIn(st, f) ? st.households[f.household] : null, who = hh ? householdPeople(hh) : [];
        const gone = !hh ? `<small>${f.state === 'ruin' ? 'A ruin' : 'Empty'}, ${plural(yearsEmpty(st, f), 'year')}</small>` : '';
        return `<div class="fcard${hh ? '' : ' none'}${who.some(on) ? ' has' : ''}">${iconImg(farmIcon(f), `fi${hh ? '' : ' gone'}`)}`
          + `${named ? `<b>${esc(f.name)}</b>` : '<span></span>'}${hh ? `<span class="faces">${who.map(face).join('')}</span>` : gone}`
          + `${named ? `<small>${esc(st.villages[f.village].name)}</small>` : ''}</div>`;
      }).join('')}</div><small class="picked">${said(`${plural(all.length, 'person', 'people')} on ${
        plural(fs.filter((f) => liveIn(st, f)).length, 'farm')}.`)}</small>`;
    } else {
      const bands = [[60, 200, '60 and over'], [45, 59, '45 to 59'], [30, 44, '30 to 44'], [18, 29, '18 to 29'], [10, 17, '10 to 17'], [0, 9, 'Under 10']];
      const rows = bands.map(([a, b, l]) => {
        const g = all.filter((id) => { const x = Sim.age(st, st.pawns[id]); return x >= a && x <= b; });
        const f = g.filter((id) => st.pawns[id].sex === 'f'), m = g.filter((id) => st.pawns[id].sex === 'm');
        return [l, f.length, f.filter(on).length, m.length, m.filter(on).length];
      });
      const max = Math.max(1, ...rows.flatMap((x) => [x[1], x[3]]));
      const bar = (n, k, left) => `<span class="pb${left ? ' l' : ''}"><i style="width:${((n / max) * 100).toFixed(1)}%;--on:${
        n ? ((k / n) * 100).toFixed(1) : 0}%"></i></span>`;
      h = `<div class="pyr">${rows.map(([l, f, fk, m, mk]) => `<span class="n f">${f}</span>${bar(f, fk, true)}<span class="lab">${l}</span>`
        + `${bar(m, mk, false)}<span class="n">${m}</span>`).join('')}</div><small class="picked">${said(
        `Women to the left, men to the right. ${all.length} people in ${plural(st.villages.length, 'village')}.`)}</small>`;
    }
    $('startWho').innerHTML = h;
  }
  // An archetype is a look: pointing at it, or a tap that stays until the next, lights its people in Who starts; nothing is chosen.
  function lookAt(key) {
    if (!start || start.look === key) return;
    start.look = key; renderWho();
  }
  $('startStories').addEventListener('pointerover', (e) => {
    const b = e.target.closest('[data-story]');
    if (b && e.pointerType === 'mouse') lookAt(b.dataset.story);
  });
  $('startStories').addEventListener('pointerout', (e) => {
    const b = e.target.closest('[data-story]');
    if (b && !b.contains(e.relatedTarget)) lookAt(null);
  });
  $('startStories').addEventListener('click', (e) => {
    const b = e.target.closest('[data-story]');
    if (!b || !start) return;
    start.pressed = start.pressed === b.dataset.story ? null : b.dataset.story;
    for (const x of $('startStories').querySelectorAll('[data-story]')) x.setAttribute('aria-pressed', String(x.dataset.story === start.pressed));
    renderWho();
  });
  $('startCards').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sc]');
    if (b && start && b.dataset.sc !== start.sc) { $('genMsg').hidden = true; chooseScenario(b.dataset.sc); }
  });
  $('genSize').addEventListener('change', () => { $('genMsg').hidden = true; renderCards(); });
  $('genReroll').addEventListener('click', () => { $('genSeed').value = String((Math.random() * 1e6) | 0); $('genMsg').hidden = true; });

  // ---- the framed view: the camera keeps the frame's world in the picture, and the callouts follow it (page/frame) ----
  function startCamera() {
    const v = $('startView').getBoundingClientRect(), r = stage.getBoundingClientRect();
    if (!v.width || !v.height) return clampCam();
    const off = { x: v.left + v.width / 2 - (r.left + r.width / 2), y: v.top + v.height / 2 - (r.top + r.height / 2) };
    const b = start.place;
    if (b) {
      const z = clamp(Math.min(v.width / (b.x1 - b.x0), v.height / (b.y1 - b.y0)), Math.max(zMin(), 18 / w.HW), Math.min(zMax, 64 / w.HW));
      cam.z = zt = z; cam.x = (b.x0 + b.x1) / 2 - off.x / z; cam.y = (b.y0 + b.y1) / 2 - off.y / z; vel.x = vel.y = 0; start.place = null;
    } else if (start.off) { cam.x -= (off.x - start.off.x) / cam.z; cam.y -= (off.y - start.off.y) / cam.z; } // the picture scrolled or moved
    start.off = off;
    cam.z = clamp(cam.z, zMin(), zMax);
    const mx = cam.x + off.x / cam.z, my = cam.y + off.y / cam.z; // the middle of the picture stays over the island
    cam.x += clamp(mx, 0, w.W) - mx; cam.y += clamp(my, 0, w.H) - my;
  }
  // Each callout's mark at its thing, or at the picture's edge with an arrow towards it when it is outside; its words beside it, on the
  // first side with room that covers no other callout.
  function placeCallouts() {
    const box = $('startView'), W = box.clientWidth, H = box.clientHeight, r = start.shown, off = start.off;
    if (!r || !off || !W) return;
    const fx = cam.x + off.x / cam.z, fy = cam.y + off.y / cam.z, R = 15, G2 = 5, taken = [];
    const hits = (b) => taken.some((t) => b[0] < t[2] && b[2] > t[0] && b[1] < t[3] && b[3] > t[1]);
    const els = [...$('startPins').children], at = els.map((el) => {
      const p = r.pins[+el.dataset.pin];
      if (p.x === null) return { el, x: R + 10, y: H - R - 10 };
      const px = W / 2 + (p.x - fx) * cam.z, py = H / 2 + (p.y - fy) * cam.z, out = px < 0 || px > W || py < 0 || py > H, e = out ? 28 : 2;
      const x = clamp(px, R + e, W - R - e), y = clamp(py, R + e, H - R - e);
      el.classList.toggle('edge', out);
      if (out) el.style.setProperty('--turn', `${Math.atan2(py - y, px - x).toFixed(3)}rad`);
      return { el, x, y };
    });
    for (const a of at) taken.push([a.x - R, a.y - R, a.x + R, a.y + R]);
    for (const a of at) {
      a.el.style.transform = `translate(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px)`;
      const b = a.el.lastElementChild, bw = b.offsetWidth, bh = b.offsetHeight;
      if (!bw) continue; // the words are in the list under the picture on a phone
      const tries = [];
      for (const dy of [0, -(bh + 4), bh + 4, -2 * (bh + 4), 2 * (bh + 4)]) {
        tries.push([R + G2, dy - bh / 2], [-R - G2 - bw, dy - bh / 2]);
      }
      const fits = ([dx, dy]) => a.x + dx >= 2 && a.x + dx + bw <= W - 2 && a.y + dy >= 2 && a.y + dy + bh <= H - 2;
      const box2 = ([dx, dy]) => [a.x + dx, a.y + dy, a.x + dx + bw, a.y + dy + bh];
      const pick = tries.find((t) => fits(t) && !hits(box2(t))) || tries.find(fits) || tries[0];
      taken.push(box2(pick));
      b.style.transform = `translate(${pick[0].toFixed(1)}px, ${pick[1].toFixed(1)}px)`;
    }
  }
