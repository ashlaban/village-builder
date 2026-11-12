// @sys page/tutorial: the tutorial (VB-396): on the tutorial's island, coach marks on the real interface, each advanced by the player doing
// what it names. The page's own state, never saved, and it only reads the game: a step's test reads what the page already knows
  // ======== the tutorial ========
  // {of (the st it teaches on), step, entered (the step whose entry was done), card and spot (what is shown, to write the DOM only on a change)}
  let tutorial = null;
  const tutRect = (id) => { const r = $(id).hidden ? null : $(id).getBoundingClientRect(); return r && r.width ? r : null; };
  // The played pawn on the screen, or its house while it is indoors
  function tutPawnRect() {
    const id = played(), a = st.agents[id], f = farmOf(st.pawns[id]), s = stage.getBoundingClientRect();
    const x = a.inside && f ? w.hx[f.house] : a.x, y = a.inside && f ? w.hy[f.house] : a.y;
    const sx = s.left + app.screen.width / 2 + (x - cam.x) * cam.z, sy = s.top + app.screen.height / 2 + (y - cam.y) * cam.z, k = cam.z / zMax;
    return { left: sx - 34 * k, top: sy - 58 * k, width: 68 * k, height: 76 * k };
  }
  const tutQueued = () => st.player.queue.length > 0 || !!(barMsg && !barMsg.bad && /^Queued/.test(barMsg.text));
  // A step: its words (of the played pawn p), where it points, and either `done` (the player did it) or `next` (a button's label);
  // `enter` runs once as the step opens, and `back` sends the player a step back when what the step stands on is gone
  const TUT_STEPS = [
    { title: 'This is you', next: 'Next', at: tutPawnRect, text: (p) => { const f = farmOf(p);
      return `${Sim.fullName(p)}, ${Math.floor(p.age)}, holder of ${f.name} in ${st.villages[f.village].name}. You play one person, not the village. `
        + 'Everyone else decides for themselves.'; } },
    { title: 'Time', todo: 'Start the day', at: () => tutRect('clock'), done: () => speed > 0,
      text: () => 'The game is paused. Start it here; the arrows run it faster.' },
    { title: 'What you can do', todo: 'Open Household', at: () => tutRect('actBar'), done: () => !!barMenu && barMenu.g === 'house',
      enter: () => { if (!barOpen) openBar(); },
      text: (p) => `Left alone, ${p.given} does what a holder would. Your own acts are in three groups, by whom you act for: yourself, your household, `
        + 'your village.' },
    { title: 'Take some work', todo: 'Pick a row that is not red', at: () => (tool ? tutRect('actBanner') : tutRect('actMenu')), done: tutQueued,
      back: () => !barMenu && !tool,
      text: (p) => `Each row is work you may take or, in red, the reason you may not. What you pick goes ahead of what ${p.given} would do otherwise.` },
    { title: 'That is how you play', next: 'Keep playing', at: () => null,
      text: (p) => `${p.given} does what you queued, then goes back to a holder's own work. The Queue shows what waits, and the household's food.` },
  ];
  // Opened by the build of the tutorial's island (page/loader): paused, the camera down on the played pawn's farm
  function startTutorial() {
    const id = played(); if (id < 0) return;
    const f = farmOf(st.pawns[id]), x = w.hx[f.house], y = w.hy[f.house];
    setSpeed(0);
    if (reduceMotion) { intro = null; cam.x = x; cam.y = y; cam.z = zt = zMax; } else { flyTo(x, y, zMax); intro.d = 2.6; }
    tutorial = { of: st, step: 0, entered: -1, card: '', spot: '' };
  }
  function endTutorial() {
    if (!tutorial) return;
    tutorial = null; $('tutCard').hidden = $('tutHole').hidden = true;
  }
  // Each frame (page/frame): the step moves on when its test holds; the card and the spotlight follow what they point at
  function tutorialFrame() {
    if (tutorial.of !== st || played() < 0) { endTutorial(); return; }
    const card = $('tutCard'), hole = $('tutHole');
    if (intro || building || skipping || !$('landing').hidden || !$('savesScreen').hidden) { card.hidden = hole.hidden = true; tutorial.card = ''; return; }
    let s = TUT_STEPS[tutorial.step];
    if (s.back && s.back()) s = TUT_STEPS[--tutorial.step];
    else if (s.done && s.done()) s = TUT_STEPS[++tutorial.step];
    if (tutorial.entered !== tutorial.step) { tutorial.entered = tutorial.step; if (s.enter) s.enter(); }
    const p = st.pawns[played()], last = tutorial.step === TUT_STEPS.length - 1;
    const pips = TUT_STEPS.map((q, i) => `<i${i <= tutorial.step ? ' class="on"' : ''}></i>`).join('');
    const h = `<h2 id="tutTitle">${esc(s.title)}</h2><p>${esc(s.text(p))}</p>${s.todo ? `<p class="todo">${esc(s.todo)}</p>` : ''}`
      + `<div class="tut-row"><span class="pips" role="img" aria-label="Step ${tutorial.step + 1} of ${TUT_STEPS.length}">${pips}</span>`
      + `${last ? '' : '<button type="button" class="quiet" data-tut="leave">Leave the tutorial</button>'}`
      + `${s.next ? `<button type="button" class="primary" data-tut="next">${esc(s.next)}</button>` : ''}</div>`;
    if (h !== tutorial.card) { tutorial.card = h; card.innerHTML = h; }
    card.hidden = false;
    // the spotlight on what the step points at, and the card beside it: under it or over it, where there is more room
    const r = s.at(), vw = innerWidth, vh = innerHeight, cw = card.offsetWidth, ch = card.offsetHeight;
    let spot = '', x = (vw - cw) / 2, y = vh * 0.3;
    if (r) {
      spot = `left:${Math.round(r.left - 6)}px;top:${Math.round(r.top - 6)}px;width:${Math.round(r.width + 12)}px;height:${Math.round(r.height + 12)}px`;
      x = r.left + r.width / 2 - cw / 2;
      y = r.top + r.height / 2 > vh / 2 ? r.top - 18 - ch : r.top + r.height + 18;
    }
    x = clamp(x, 10, Math.max(10, vw - cw - 10)); y = clamp(y, 10, Math.max(10, vh - ch - 10));
    spot += `|left:${Math.round(x)}px;top:${Math.round(y)}px|${tool ? 'ring' : ''}`;
    if (spot !== tutorial.spot) {
      tutorial.spot = spot;
      const [a, b, c] = spot.split('|');
      hole.hidden = !a; hole.style.cssText = a; hole.classList.toggle('ring', !!c); card.style.cssText = b;
    }
  }
  $('tutCard').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || !tutorial) return;
    if (b.dataset.tut === 'leave' || tutorial.step === TUT_STEPS.length - 1) endTutorial();
    else if (b.dataset.tut === 'next') tutorial.step++;
  });
