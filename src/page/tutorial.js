// @sys page/tutorial: the tutorial (VB-396): on the tutorial's island, coach marks on the real interface, each advanced by the player doing
// what it names, then the first year's goals, kept in a chip that opens to a card. The page's own state, never saved, and it only reads the
// game: a step's test reads what the page already knows, a goal is judged from the played household's farm as the day turns
  // ======== the tutorial ========
  // {of (the st it teaches on), step, entered (the step whose `enter` has run), card and spot (what is shown, to write the DOM only on a change),
  // goals (each 'open', 'done' or 'missed'), day (the game day they were last judged), open (the goals' card, not its chip), news (the line of
  // the last goal settled, until the card is opened), show (a goal's Show me, as a step), chip (what the chip shows)}
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
    { title: 'The first year', next: 'Got it', at: () => tutRect('tutGoals'),
      text: (p) => { const f = farmOf(p), days = foodDays(liveHousehold(f));
        return `${f.name} has food for ${days} days, and the harvest is in autumn. What the year asks of the household is kept here. `
          + `${p.given}'s people work towards it on their own; lend a hand where you like.`; } },
  ];
  // The first year's goals (design.md, The founders' first year), one a season. judge(c, f, hh): 'done', 'missed' or null (still open), from
  // the calendar and the played household's farm, whoever did the work. show: its Show me, a step that opens what it points at.
  const tutHouseList = () => {
    if (!barOpen) openBar(); if (!barMenu || barMenu.g !== 'house') document.querySelector('#actBar [data-group="house"]').click(); };
  const tutListStep = (title, text) => ({ title, text: () => text, next: 'Got it', enter: tutHouseList, at: () => tutRect('actMenu') });
  const TUT_GOALS = [
    { season: 'Spring', goal: 'Break a first field and sow it, by day 10',
      judge: (c, f) => (f.fields.some((fd) => fd.sown !== null) ? 'done' : c.year > 1 || c.season > 0 ? 'missed' : null),
      won: 'The first field is sown. Next, in summer: hay.', lost: 'No field was sown in time. The stores must last until next year\'s harvest.',
      show: tutListStep('Field work', 'When there is a field to clear, hoe or sow, the work is listed here. Take it, or leave it to the household.') },
    { season: 'Summer', goal: 'Make hay for the winter',
      judge: (c, f) => (f.meadows.some((m) => m.mown !== null) ? 'done' : c.year > 1 || c.season > 1 ? 'missed' : null),
      won: 'The first hay is mown. Next, in autumn: the harvest.', lost: 'No hay was made this summer. The animals go into the winter short of fodder.',
      show: tutListStep('Haymaking', 'In summer, raking and mowing the meadows are listed here, and carrying the hay home.') },
    { season: 'Autumn', goal: 'Bring in the harvest before the frost',
      judge: (c, f) => (f.fields.some((fd) => fd.reaped !== null) ? 'done' : c.year > 1 || c.season > 2 ? 'missed' : null),
      won: 'The barley is reaped. Now the stores must last the winter.', lost: 'No harvest came in before the frost. It will be a hungry winter.',
      show: tutListStep('The harvest', 'When the barley is ripe, reaping it, bringing in the sheaves and threshing are listed here.') },
    { season: 'Winter', goal: 'Reach spring with food and firewood left',
      judge: (c, f, hh) => (c.year < 2 ? null : foodDays(hh) > 0 && hh.wood >= 1 ? 'done' : 'missed'),
      won: 'Spring again, with food and firewood left. You came through the first year.',
      lost: 'Spring again, but the stores are empty. The household came through the first year, only just.',
      show: { title: 'The stores', text: () => 'The Queue shows your household\'s food, in days, and its firewood.', next: 'Got it',
        enter: () => { if (!barOpen) openBar(); openPanel('actions'); }, at: () => tutRect('actionSheet') } },
  ];
  // Opened by the build of the tutorial's island (page/loader): paused, the camera down on the played pawn's farm
  function startTutorial() {
    const id = played(); if (id < 0) return;
    const f = farmOf(st.pawns[id]), x = w.hx[f.house], y = w.hy[f.house];
    setSpeed(0);
    if (reduceMotion) { intro = null; cam.x = x; cam.y = y; cam.z = zt = zMax; } else { flyTo(x, y, zMax); intro.d = 2.6; }
    tutorial = { of: st, step: 0, entered: null, card: '', spot: '', goals: TUT_GOALS.map(() => 'open'), day: -1, open: false, news: '', show: null, chip: '' };
  }
  function endTutorial() {
    if (!tutorial) return;
    tutorial = null; $('tutCard').hidden = $('tutHole').hidden = $('tutGoals').hidden = true;
  }
  // The goals are judged as the game day turns: one settled leaves its line on the chip, and the last opens the card
  function tutJudge() {
    const c = Sim.cal(st.t); if (c.day === tutorial.day) return;
    tutorial.day = c.day;
    const f = farmOf(st.pawns[played()]), hh = f && liveHousehold(f); if (!hh) return;
    TUT_GOALS.forEach((g, i) => {
      if (tutorial.goals[i] !== 'open') return;
      const r = g.judge(c, f, hh); if (!r) return;
      tutorial.goals[i] = r; tutorial.news = r === 'done' ? g.won : g.lost;
      if (i === TUT_GOALS.length - 1) tutorial.open = true;
    });
  }
  // The goals: a chip (the goal now open, or the last news), or the card with all four
  function tutGoalsPaint() {
    const el = $('tutGoals'), now = tutorial.goals.indexOf('open'), over = now < 0, n = tutorial.goals.filter((x) => x === 'done').length;
    let h;
    if (!tutorial.open) {
      h = `<button type="button" class="tut-chip" data-tut="open" aria-expanded="false"><b>The first year · ${n} of ${TUT_GOALS.length}</b>`
        + `<span>${esc(tutorial.news || `${TUT_GOALS[now].season}: ${TUT_GOALS[now].goal}`)}</span></button>`;
    } else {
      const f = farmOf(st.pawns[played()]), days = foodDays(liveHousehold(f));
      h = `<div class="tut-row"><h2>The first year</h2><button type="button" class="quiet" data-tut="${over ? 'leave' :
        'close'}" aria-label="Close">${actIcon('no')}</button></div>`
        + `<p class="sub">${esc(f.name)} has food for ${days} ${days === 1 ? 'day' : 'days'}.</p><ul>`
        + TUT_GOALS.map((g, i) =>
          `<li class="${tutorial.goals[i]}${i === now ? ' now' : ''}"><i>${tutorial.goals[i] === 'done' ? '✓' : tutorial.goals[i] === 'missed' ? '–' : ''}</i>`
          + `<div><b>${g.season}${tutorial.goals[i] === 'missed' ? ' · missed' : ''}</b><span>${esc(g.goal)}</span>`
          + `${i === now ? ` <button type="button" class="link" data-tut="show" data-goal="${i}">Show me</button>` : ''}</div></li>`).join('') + '</ul>'
        + (tutorial.news ? `<p class="news" role="status">${esc(tutorial.news)}</p>` : '')
        + (over ? '<div class="tut-row"><button type="button" class="primary" data-tut="leave">Keep playing</button></div>'
          : '<div class="tut-row"><button type="button" class="quiet" data-tut="leave">End the tutorial</button></div>');
    }
    if (h !== tutorial.chip) { tutorial.chip = h; el.innerHTML = h; el.classList.toggle('open', tutorial.open); }
    el.hidden = false;
  }
  // Each frame (page/frame): the step moves on when its test holds; the card and the spotlight follow what they point at
  function tutorialFrame() {
    if (tutorial.of !== st || played() < 0) { endTutorial(); return; }
    const card = $('tutCard'), hole = $('tutHole'), steps = tutorial.step < TUT_STEPS.length;
    if (intro || building || !$('landing').hidden || !$('savesScreen').hidden) {
      card.hidden = hole.hidden = $('tutGoals').hidden = true; tutorial.card = ''; return;
    }
    if (!steps) tutJudge();
    if (!steps || tutorial.step === TUT_STEPS.length - 1) tutGoalsPaint(); // the last step points at the chip
    let s = steps ? TUT_STEPS[tutorial.step] : tutorial.show;
    if (!s || skipping) { card.hidden = hole.hidden = true; tutorial.card = tutorial.spot = ''; return; }
    if (steps && s.back && s.back()) s = TUT_STEPS[--tutorial.step];
    else if (steps && s.done && s.done()) s = TUT_STEPS[++tutorial.step];
    if (tutorial.entered !== s) { tutorial.entered = s; if (s.enter) s.enter(); }
    const p = st.pawns[played()];
    const pips = TUT_STEPS.map((q, i) => `<i${i <= tutorial.step ? ' class="on"' : ''}></i>`).join('');
    const h = `<h2 id="tutTitle">${esc(s.title)}</h2><p>${esc(s.text(p))}</p>${s.todo ? `<p class="todo">${esc(s.todo)}</p>` : ''}<div class="tut-row">`
      + (steps ? `<span class="pips" role="img" aria-label="Step ${tutorial.step + 1} of ${TUT_STEPS.length}">${pips}</span>`
        + '<button type="button" class="quiet" data-tut="leave">Leave the tutorial</button>' : '<span class="pips"></span>')
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
  const tutClick = (e) => {
    const b = e.target.closest('button'), act = b && b.dataset.tut; if (!act || !tutorial) return;
    if (act === 'leave') endTutorial();
    else if (act === 'next') { if (tutorial.show) tutorial.show = null; else tutorial.step++; }
    else if (act === 'open') { tutorial.open = true; }
    else if (act === 'close') { tutorial.open = false; tutorial.news = ''; tutorial.show = null; }
    else if (act === 'show') { tutorial.show = TUT_GOALS[+b.dataset.goal].show; tutorial.entered = null; if (mobileUI.matches) tutorial.open = false; }
  };
  $('tutCard').addEventListener('click', tutClick); $('tutGoals').addEventListener('click', tutClick);
