// @sys page/choose: whom to play (VB-339): after a new game is raised, the game itself, paused, in a mode where a farm is clicked on the map,
// its people are met in a panel and one is played, or none (design.md, Starting a game)
// ======== whom to play ========
// The mode is the page's own state, never saved: the farm and the person chosen, the archetype pressed, and the speed to go on at. It
// opens after a new game is built (not a load, not the showcase island), in place of the old offer to play the suggested pawn.
let choose = null;
const firstName = (id) => st.pawns[id].given;
function openChoose() {
  const sug = suggestedPawn();
  choose = { farm: -1, pawn: -1, story: null, sug, speed: speed > 0 ? speed : lastSpeed, msg: '' };
  setSpeed(0);
  openPanel(null);
  closeSpeedOptions();
  closeNotices();
  if (document.body.classList.contains('ui-hidden')) toggleUI();
  document.body.classList.add('choosing');
  $('choose').hidden = false;
  selectionPinned = true;
  selPawn = -1;
  $('chooseStories').innerHTML = storyCards(st.scenario, null);
  const f = sug >= 0 ? farmOf(st.pawns[sug]) : st.farmsteads.find((g) => liveHousehold(g));
  if (f) chooseFarm(f.id, sug, false);
  else renderChoose();
  // the build's glide ends on the suggested farm (page/loader); on a phone, in the strip of map above the panels
  if (f && intro) intro.y1 += mapOffset() / intro.z1;
  else if (f) cam.y += mapOffset() / cam.z;
}
// Leaving the mode: by Play as or Watch only, or because another game is built or loaded. The game takes the speed it had before.
function closeChoose() {
  if (!choose) return;
  const back = choose.speed;
  choose = null;
  $('choose').hidden = true;
  document.body.classList.remove('choosing');
  sel = -1;
  selectionPinned = false;
  hoverDirty = true;
  setSpeed(back);
}
// On a narrow screen the map is the strip above the panels: a farm is brought to the middle of that strip, not of the screen.
function mapOffset() {
  const m = $('chooseMap'),
    r = m.getBoundingClientRect(),
    s = stage.getBoundingClientRect(),
    top = r.top + $('choose').scrollTop;
  return r.height > 0 ? s.top + s.height / 2 - (top + r.height / 2) : 0;
}
function chooseFly(f) {
  const z = Math.max(cam.z, 1.5);
  flyTo(w.hx[f.house], w.hy[f.house] + mapOffset() / z, z);
}
// A farm chosen, by the map or an archetype: its household, and a person in it (the one given, else one of the archetype pressed, else
// the first adult). An empty farm or a ruin is chosen too, and has no one.
function chooseFarm(fid, pawn = -1, fly = true) {
  const f = st.farmsteads[fid],
    hh = liveHousehold(f);
  let id = pawn;
  if (id < 0 && hh) {
    const grown = householdPeople(hh).filter((q) => st.pawns[q].age >= ADULT);
    id = (choose.story && grown.find((q) => inStory(choose.story, q))) ?? grown[0] ?? -1;
  }
  choose.farm = fid;
  choose.pawn = id;
  choose.msg = '';
  sel = f.house;
  hoverDirty = true;
  if (fly) chooseFly(f);
  renderChoose();
}
// A click on the map while choosing (page/tileinfo hands it over): a person outdoors, a farm's name, its house, a field or a meadow.
function chooseAt(sx, sy) {
  const [x, y] = toWorld(sx, sy),
    pw = pawnAt(x, y);
  if (pw >= 0) {
    const f = farmOf(st.pawns[pw]);
    if (f) chooseFarm(f.id, st.pawns[pw].age >= ADULT ? pw : -1, false);
    return;
  }
  const named = labelAt(x, y);
  if (named && named.farm !== undefined) {
    chooseFarm(named.farm, -1, false);
    return;
  }
  const i = loc(x, y, [0, 0]);
  if (i < 0) return;
  const f = st.farmsteads.find(
    (g) => g.house === i || g.fields.some((q) => q.tile === i) || (g.meadows || []).some((q) => q.tile === i),
  );
  if (f) chooseFarm(f.id, -1, false);
}
// The household's panel: the farm's icon, name and village and its food in days; its people as portraits (children shown, not to be
// chosen); then the person chosen: name, age and position, one line on the life, whom the player would go on as after a death (the
// first of Sim.successors), and what the position can do and what lies ahead, as chips.
function renderChoose() {
  if (!choose) return;
  const f = choose.farm >= 0 ? st.farmsteads[choose.farm] : null,
    hh = f ? liveHousehold(f) : null,
    id = choose.pawn;
  let h = '';
  if (!f) h = '<p class="hint">Drag the map and pick a farm.</p>';
  else {
    const days = hh ? foodDays(hh) : null,
      v = st.villages[f.village];
    const food = !hh ? '' : days === null ? ' · no one to feed' : ` · food for ${days} ${days === 1 ? 'day' : 'days'}`;
    h += `<div class="hhead">${iconImg(farmIcon(f), `fi${hh ? '' : ' gone'}`)}<h2>${esc(f.name)}</h2><span>${esc(v.name)}${food}</span></div>`;
    if (!hh) {
      const yrs =
        f.emptySince !== null && f.emptySince !== undefined ? Math.floor((st.t - f.emptySince) / Sim.YEAR) : null;
      const how = f.state === 'ruin' ? 'A ruin' : 'An empty farm';
      h += `<p class="hint">${how}${yrs ? `, for ${yrs} ${yrs === 1 ? 'year' : 'years'}` : ''}. No one lives here.</p>`;
    } else {
      h += `<div class="people">${householdPeople(hh)
        .map((q) => {
          const p = st.pawns[q],
            minor = p.age < ADULT,
            hit = choose.story && inStory(choose.story, q);
          return `<button type="button" class="person${hit ? ' hit' : ''}" data-p="${q}" aria-pressed="${q === id}"${minor ? ' disabled' : ''}>${faceImg(
            q,
            'pf',
          )}<span>${esc(p.given)}</span><small>${Sim.age(st, p)}${minor ? ', a child' : ''}</small></button>`;
        })
        .join('')}</div>`;
    }
  }
  if (id >= 0) {
    const p = st.pawns[id],
      k = positionOf(id),
      after = Sim.successors(st, id)[0],
      { can, ahead } = chipsOf(id);
    h +=
      `<div class="detail"><h2>${esc(Sim.fullName(p))}${id === choose.sug ? ` ${SUGGESTED}` : ''}</h2>` +
      `<p class="posline">${sign(POS_ICON[k])}<span>${Sim.age(st, p)} · ${esc(positionName(id).toLowerCase())}</span></p>` +
      `<p class="hint">${esc(LIFE_LINE[k])}</p>` +
      `<p class="posline">${sign('next')}<span>${
        after
          ? `After ${p.sex === 'm' ? 'him' : 'her'}, you go on as ${esc(Sim.fullName(st.pawns[after.id]))}, ${esc(
              after.why,
            )}`
          : 'No one after: the line would break'
      }</span></p>` +
      `<h3>Can</h3>${chipList(can)}<h3>Ahead</h3>${chipList(ahead)}</div>`;
  }
  if (choose.msg) h += `<p class="refused" role="status">${esc(choose.msg)}</p>`;
  $('chooseCard').innerHTML = h;
  $('choosePlay').disabled = id < 0;
  $('choosePlay').textContent = id >= 0 ? `Play as ${firstName(id)}` : 'No one chosen';
}
$('choose').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || !choose || !st) return;
  if (b.dataset.story) {
    // an archetype takes the player to one who holds it, and another click to the next
    const key = b.dataset.story,
      who = (storyPeople(st.scenario).find((s) => s.key === key) || { who: [] }).who;
    if (!who.length) return;
    const i = choose.story === key ? who.indexOf(choose.pawn) : -1,
      id = who[(i + 1) % who.length];
    choose.story = key;
    $('chooseStories').innerHTML = storyCards(st.scenario, key);
    chooseFarm(farmOf(st.pawns[id]).id, id);
    if ($('chooseMap').offsetHeight) $('choose').scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); // on a phone, back to the map
  } else if (b.dataset.p !== undefined) {
    choose.pawn = +b.dataset.p;
    choose.msg = '';
    renderChoose();
  } else if (b.id === 'chooseMenu') {
    if (!building && !skipping) showLanding();
  } // the game waits, in this mode, behind the main menu
  else if (b.id === 'chooseWatch') closeChoose();
  else if (b.id === 'choosePlay' && choose.pawn >= 0) {
    const id = choose.pawn,
      r = playAs(id);
    if (r !== true) {
      choose.msg = r;
      renderChoose();
      return;
    }
    closeChoose();
    focusPawn(id);
    openBar(!mobileUI.matches); // on a narrow screen the bar alone: the sheet would cover the farm
  }
});
