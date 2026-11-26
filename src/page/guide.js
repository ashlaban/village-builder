// @sys page/guide: the game's guide (VB-1124): every kind of work, where it is done, what it needs and what it gives, the things it names
// with what makes and uses each, and the crops; read from what the simulation declares (sim/kinds' records, PLACES and THINGS; the goods
// registry; FOODS; CROPS), so that a kind added to the game appears here unchanged. Opened from the main menu and from plan mode
// (the Plan tab's key, the plan tool's banner); it only reads.
// What it says is what the rules have: an action's place, needs and gifts, and its hours as days of a middling hand's work. What an
// action would bring on this farm this year is an estimate, a pawn's, and stays in plan mode (principle "The future is someone's estimate").
const GUIDE_CHAPTERS = { work: 'Work', things: 'Things', crops: 'Crops' };
// A thing's icon in the panels' set (page/goodicons GOOD_PATHS), where its key is not already one.
const THING_ICON = {
  sheaves: 'sheaves',
  firewood: 'wood',
  timber: 'tree',
  ore: 'ore',
  iron: 'ore',
  tools: 'ore',
  'salt meat': 'meat',
  'dried fish': 'fish',
  'wild food': 'tile',
  hide: 'beast',
  fleece: 'wool',
  cattle: 'beast',
  sheep: 'wool',
  house: 'tile',
  barn: 'tile',
  booth: 'tile',
  well: 'water',
  green: 'tile',
  trail: 'tile',
  'tar pit': 'tar',
};
const thingIcon = (t) => goodIcon(THING_ICON[t] || t);
let guideChapter = 'work',
  guideFrom = null; // the control that opened the guide, focused again when it closes
// The kinds as the guide lists them: one row a name (the fetch kinds of each load share theirs), in the registry's order.
function guideKinds() {
  const seen = new Map();
  for (const [k, K] of Object.entries(VB['sim/kinds'].KINDS)) if (!seen.has(K.name)) seen.set(K.name, [k, K]);
  return [...seen.values()];
}
// Which kinds give and which need each thing: the chain from a thing to what makes it and what uses it.
function guideChains() {
  const by = {};
  for (const [k, K] of guideKinds()) {
    for (const t of K.gives) (by[t] ||= { made: [], used: [] }).made.push([k, K]);
    for (const t of K.needs) (by[t] ||= { made: [], used: [] }).used.push([k, K]);
  }
  return by;
}
const thingBtn = (t) => {
  const T = VB['sim/kinds'].THINGS[t];
  return (
    `<button type="button" class="guide-chip" data-guide-thing="${esc(t)}" title="${esc(capital(T.name))}">` +
    `${thingIcon(t)}<span>${esc(T.name)}</span></button>`
  );
};
const kindBtn = ([k, K]) =>
  `<button type="button" class="guide-chip" data-guide-kind="${esc(k)}" title="${esc(K.name)}">` +
  `${actIcon(KIND_ICON[k] || 'hoe')}<span>${esc(K.name)}</span></button>`;
// A row's line of chips under its label, or the words for none.
const guideIO = (label, chips, none) =>
  `<p class="guide-io"><span class="guide-lbl">${label}</span>${chips.length ? chips.join('') : `<span class="guide-none">${none}</span>`}</p>`;
// A kind's hours as a middling hand works them: hours under a working day (sim/rules WORK), else days of it with the hours beside.
const guideDays = (h) => {
  const day = VB['sim/rules'].WORK[1] - VB['sim/rules'].WORK[0],
    d = Math.round(h / day);
  return h < day ? `${h} ${h === 1 ? 'hour' : 'hours'}` : `about ${d} ${d === 1 ? 'day' : 'days'} (${h} hours)`;
};
// A kind's details, as its record has them: its work in days of a middling hand (the skill speeds a better one), how many may work
// at it, from what hour, at which stage of a field, and who may.
function kindDetails(k, K) {
  const PLACES = VB['sim/kinds'].PLACES,
    d = [
      `Where: ${K.at.map((p) => PLACES[p]).join('; ')}.`,
      K.hours ? `Work: ${guideDays(K.hours)} by a hand of middling skill.` : '',
      K.hands === 1
        ? 'One hand at a time.'
        : K.hands > 1 && K.hands < Infinity
          ? `Up to ${K.hands} hands at once.`
          : '',
      K.window ? `From ${K.window.from}:00.` : '',
      K.stages ? `When the field is ${K.stages.join(' or ')}.` : '',
      K.minAge ? `From the age of ${K.minAge}.` : '',
      K.craft ? `A craft: ${K.craft}.` : '',
      K.mind ? 'Done at the side of other work.' : '',
      K.together ? 'Worked by all together, on a work day.' : '',
    ];
  return d.filter(Boolean).join(' ');
}
function guideWork() {
  return guideKinds()
    .map(([k, K]) => {
      return (
        `<details class="guide-row" id="guide-kind-${esc(k)}" data-kind="${esc(k)}"><summary>${actIcon(KIND_ICON[k] || 'hoe')}` +
        `<b>${esc(K.name)}</b></summary>` +
        guideIO('Needs', K.needs.map(thingBtn), 'nothing') +
        guideIO('Gives', K.gives.map(thingBtn), 'the work itself') +
        `<p class="guide-more">${esc(kindDetails(k, K))}</p></details>`
      );
    })
    .join('');
}
// A thing: what it is (the good it is in the registry, the food it is), what makes it and what uses it.
function guideThings() {
  const { THINGS } = VB['sim/kinds'],
    { FOODS } = VB['sim/rules'],
    goods = VB['sim/goods'],
    by = guideChains();
  return Object.entries(THINGS)
    .map(([t, T]) => {
      const c = by[t] || { made: [], used: [] },
        good = T.good && goods.GOODS.get(T.good),
        food = T.food && FOODS[T.food],
        what = [
          good ? `Changes hands by the ${good.unit} (${good.class}).` : '',
          food ? `Eaten${food.raw ? ' as it is or' : ''} cooked${food.keeps ? `; keeps ${food.keeps} days` : ''}.` : '',
        ].filter(Boolean);
      return (
        `<details class="guide-row" id="guide-thing-${esc(t.replace(/ /g, '-'))}" data-thing="${esc(t)}"><summary>${thingIcon(t)}` +
        `<b>${esc(capital(T.name))}</b></summary>` +
        guideIO('Made by', c.made.map(kindBtn), 'no work: it is found, bought or kept') +
        guideIO('Used by', c.used.map(kindBtn), 'no work') +
        (what.length ? `<p class="guide-more">${esc(what.join(' '))}</p>` : '') +
        '</details>'
      );
    })
    .join('');
}
// The crops (sim/crops CROPS): when each is sown and the work of its stages, which are the field's kinds.
function guideCrops() {
  const { CROPS } = VB['sim/crops'],
    { SEASONS } = VB['sim/weather'],
    KINDS = VB['sim/kinds'].KINDS;
  return Object.entries(CROPS)
    .filter(([, C]) => C.seed > 0)
    .map(([c, C]) => {
      const stages = Object.entries(C.hours || {})
        .filter(([k]) => KINDS[k])
        .map(([k]) => kindBtn([k, KINDS[k]]))
        .join('');
      return (
        `<details class="guide-row" data-crop="${esc(c)}"><summary>${goodIcon(c in GOOD_PATHS ? c : 'grain')}<b>${esc(capital(c))}</b></summary>` +
        `<p class="guide-io"><span class="guide-lbl">Work</span>${stages}</p>` +
        `<p class="guide-more">${esc(
          `Sown in ${SEASONS[C.sow[0]]}${C.winter ? ', it stands the winter' : ''}; ripe ${C.ripe} days after sowing. ` +
            `Sown with ${C.seed} rations of seed a field.`,
        )}</p></details>`
      );
    })
    .join('');
}
function drawGuide() {
  $('guideTabs').innerHTML = Object.entries(GUIDE_CHAPTERS)
    .map(
      ([k, n]) =>
        `<button type="button" role="tab" data-guide-tab="${k}" aria-selected="${k === guideChapter}" tabindex="${k === guideChapter ? 0 : -1}">${n}</button>`,
    )
    .join('');
  $('guideBody').innerHTML =
    guideChapter === 'work' ? guideWork() : guideChapter === 'things' ? guideThings() : guideCrops();
}
// Open the guide at a chapter, and a row of it opened and shown (a kind's or a thing's key); from: the control to focus on closing.
function showGuide(on, at = null, from = null) {
  $('guideScreen').hidden = !on;
  if (!on) {
    const back = guideFrom;
    guideFrom = null;
    if (back && back.isConnected) back.focus();
    return;
  }
  if (from) guideFrom = from;
  if (at) guideChapter = at.chapter;
  drawGuide();
  const row =
    at && at.key
      ? [...$('guideBody').querySelectorAll(at.chapter === 'work' ? '[data-kind]' : '[data-thing]')].find(
          (r) => (r.dataset.kind || r.dataset.thing) === at.key,
        )
      : null;
  if (row) {
    row.open = true;
    if (row.scrollIntoView) row.scrollIntoView({ block: 'center' });
    row.querySelector('summary').focus();
  } else $('guideClose').focus();
}
$('landGuide').addEventListener('click', (e) => showGuide(true, null, e.currentTarget));
$('guideClose').addEventListener('click', () => showGuide(false));
$('guideScreen').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.guideTab) {
    guideChapter = b.dataset.guideTab;
    drawGuide();
    $('guideTabs').querySelector('[aria-selected="true"]').focus();
  } else if (b.dataset.guideThing) showGuide(true, { chapter: 'things', key: b.dataset.guideThing });
  else if (b.dataset.guideKind) showGuide(true, { chapter: 'work', key: b.dataset.guideKind });
});
$('guideScreen').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.stopPropagation();
    showGuide(false);
  }
});
// From plan mode: a link marked data-guide (the Plan tab's key, the plan tool's banner) opens the guide at its chapter and row.
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-guide]');
  if (!a || a.closest('#guideScreen')) return;
  e.preventDefault();
  const [chapter, key] = a.dataset.guide.split(':');
  showGuide(true, { chapter, key: key || null }, a);
});
