// @sys page/actbar: the action bar (VB-341): the dock's Actions opens a second bar, Myself, Household and Village (and the Queue); each group lists
// the played pawn's acts by their basis, an act that needs a tile puts the map in a tool mode, and the gift is one form in the list
// ======== the action bar ========
// All of it is the page's own state, never saved: whether the bar is open (barOpen), the list open above it (barMenu: {g, view}, the group
// 'self', 'house' or 'village', and a view inside it, null, 'round' or 'give'), its last message (barMsg: {text, bad}), the tool
// (tool: an act waiting for a tile, below) and the gift's draft (gift). It reads st and queues through Sim, as the sheet does (page/play).
let barOpen = false,
  barMenu = null,
  barMsg = null,
  barHTML = '',
  tool = null,
  slander = { who: null, kind: null }, // the Speak ill of form's draft (VB-554): the party and the kind chosen
  toolKey = '',
  flash = null,
  bannerHTML = '';
const tapWord = coarse ? 'tap' : 'click'; // what a press on the map is called, by the pointer
const GROUPS = { self: 'Myself', house: 'Household', village: 'Village' };
const toolG = new PIXI.Graphics();
L.hover.addChild(toolG);
function paintBar() {
  const on = barOpen && played() >= 0,
    pl = st && st.player;
  $('actBar').hidden = !on;
  $('actMenu').hidden = !(on && barMenu);
  document.body.classList.toggle('bar-open', on);
  $('actionsBtn').setAttribute('aria-pressed', String(on));
  for (const b of document.querySelectorAll('#actBar [data-group]'))
    b.setAttribute('aria-expanded', String(!!(on && barMenu && barMenu.g === b.dataset.group)));
  $('queueBtn').setAttribute('aria-pressed', String(activePanel === 'actions'));
  const n = on && pl ? String(Sim.controlOf(st, pl.pawn).queue.length || '') : '';
  if ($('queueCount').textContent !== n) $('queueCount').textContent = n;
}
function openBar(queue = false) {
  barOpen = true;
  if (queue) openPanel('actions');
  else paintBar();
  if (st) renderActions();
}
function closeBar() {
  barOpen = false;
  barMenu = null;
  barMsg = null;
  endTool();
  if (activePanel === 'actions') openPanel(null);
  else paintBar();
}
function closeBarMenu() {
  barMenu = null;
  barMsg = null;
  paintBar();
}
// ---- rows: an icon, a name, a one-line note or, in red, why it is refused; a chevron when it leads to a list or a form ----
const cmdAttrs = (o) =>
  `data-play="do" data-cmd="${esc(JSON.stringify({ verb: o.verb, target: o.target, args: o.args || undefined }))}"`;
function actRow(attrs, icon, name, note, why = null, more = false, count = 0, title = '') {
  const how = why ? `data-bar="why" data-why="${esc(why)}" aria-disabled="true"` : attrs;
  return (
    `<button type="button" class="row act-row" ${how} data-k="${esc(icon + ':' + name)}"${title ? ` title="${esc(title)}"` : ''}>` +
    `${actIcon(icon)}<span class="nm">${esc(name)}<small>${esc(why || note)}</small></span>` +
    `${count > 1 ? `<b class="act-n" aria-label="${count} places">${count}</b>` : ''}${more ? actIcon('next') : ''}</button>`
  );
}
// The work it may take, one row a kind: queued at once where it is open at one place, or the tool, which marks the places, where at several.
function workRows(list) {
  const kinds = new Map();
  for (const o of list) {
    if (!kinds.has(o.kind)) kinds.set(o.kind, []);
    kinds.get(o.kind).push(o);
  }
  let h = '';
  for (const [k, items] of kinds) {
    const open = items.filter((o) => o.why === null),
      o = open[0],
      whom = (x) => `for ${holderName(x.holder)}, ${BASIS[x.basis]}`;
    const note = o ? `${whom(o)}` : null,
      title = open.length > 1 ? `${open.length} places ${whom(o)}: ${tapWord} one on the map` : '';
    h += actRow(
      `data-bar="work" data-kind="${k}" data-holder="${o ? o.holder.type : ''}"`,
      KIND_ICON[k] || 'hoe',
      Sim.KINDS[k].name,
      note,
      o ? null : items[0].why,
      open.length > 1,
      open.length,
      title,
    );
  }
  return h;
}
// "Hand the farm on" (VB-1140): the offer of the holding to the first in line, who is named with its own estimate of its answer (principle "The future is
// someone's estimate").
function handOnRow(o) {
  const { first, next } = o.handover,
    note = first
      ? `To ${first.name}, first in line${
          first.no ? `, who would not take it (${first.no})${next ? `; then ${next.name}` : ''}` : ', who would take it'
        }; you keep your place on the farm`
      : '';
  return actRow(cmdAttrs(o), 'offer', 'Hand the farm on', note, o.why);
}
// The open list: a group's acts, or a view inside it (the moving round's wishes, the causes, the gift's form).
function menuHTML(id, opps) {
  const p = st.pawns[id],
    m = barMenu,
    hh = p.household !== null ? st.households[p.household] : null;
  const by = { self: [], house: [], village: [], round: [], offers: [] };
  for (const o of opps) {
    if (o.when === 'offer') by.offers.push(o);
    else if (o.when === 'round') by.round.push(o);
    else if (o.verb === 'work') by[o.holder && o.holder.type === 'village' ? 'village' : 'house'].push(o);
    else if (o.verb === 'ask' && o.leave)
      by.self.push(o); // leave asked of its head (VB-1555): its own time
    else if (o.verb === 'callAle' || o.verb === 'offer')
      by.house.push(o); // the household's act, its holder's to choose (VB-522)
    else if (o.verb === 'argue' || o.verb === 'dropCause')
      continue; // a cause is no act: the dock's Agenda (page/drawer)
    else by.self.push(o);
  }
  const TITLES = {
    round: 'At the moving round',
    give: 'Give grain',
    slander: 'Speak ill of',
    swap: 'Deal at the fair',
  };
  let h =
    `<div class="mh">${
      m.view
        ? `<button type="button" class="icon-btn" data-bar="back" data-k="back" aria-label="Back to ${GROUPS[m.g]}">${actIcon('back')}</button>`
        : ''
    }` +
    `<h2 id="actMenuTitle" class="head">${m.view ? TITLES[m.view] : GROUPS[m.g]}</h2>` +
    `<button type="button" class="icon-btn" data-bar="close" data-k="close" aria-label="Close the list">${actIcon('no')}</button></div>`;
  if (barMsg) h += `<p class="act-msg${barMsg.bad ? ' bad' : ''}" role="status">${esc(barMsg.text)}</p>`;
  if (m.view === 'round') return `${h}<div class="play">${roundBox(id, by.round, Sim.wishesOf(st, id))}</div>`;
  if (m.view === 'give') return h + giveHTML(id);
  if (m.view === 'swap') return h + swapHTML(id);
  if (m.view === 'slander') return h + slanderHTML(by.self.find((o) => o.verb === 'slander'));
  if (m.g === 'self') {
    const home = by.self.find((o) => o.verb === 'goHome'),
      idle = by.self.find((o) => o.verb === 'idle');
    h += actRow('data-bar="walk"', 'walk', 'Walk here', `Then ${tapWord} an open tile on the map`);
    h += actRow(cmdAttrs(home), 'home', 'Go home', 'Indoors, for yourself', home.why);
    h += actRow(cmdAttrs(idle), 'idle', 'Rest an hour', 'You wait where you are', idle.why);
    // a drink at the nearest fresh water (VB-1601), the panel's thirst beside it
    const drink = by.self.find((o) => o.verb === 'drink');
    if (drink)
      h += actRow(
        cmdAttrs(drink),
        'water',
        'Drink',
        Sim.thirstLine(st, id) || 'At the nearest fresh water you may draw at',
        drink.why,
      );
    // its own time (VB-1552): the pastimes open to it, by the verb `pastime`
    for (const o of by.self.filter((x) => x.verb === 'pastime'))
      h += actRow(
        cmdAttrs(o),
        o.target === 'fire' ? 'home' : o.target === 'green' ? 'green' : 'walk',
        o.pastime.name,
        o.pastime.note,
        o.why,
      );
    // leave asked of its head (VB-1555): the rest of the working day free, with the head's likely answer as its pawn sees it
    const leave = by.self.find((o) => o.verb === 'ask' && o.leave);
    if (leave)
      h += actRow(
        cmdAttrs(leave),
        'home',
        `Ask ${leave.leave.head} for leave`,
        `The rest of the working day to yourself; ${leave.leave.likely ? 'likely yes' : 'likely no: there is work that will not wait'}`,
        leave.why,
      );
    // the ale evenings and rites called within reach (VB-522)
    for (const o of by.self.filter((x) => x.verb === 'attend')) {
      const ale = o.occasion.kind === 'ale';
      h += actRow(
        cmdAttrs(o),
        ale ? 'ale' : 'green',
        ale ? `Go to the ale evening at ${o.occasion.place}` : 'Go to the rite',
        ale ? 'From the end of work until ten' : `On the green of ${o.occasion.place}, at noon`,
        o.why,
      );
    }
    // the winter's gathering (VB-295): to go, or to stay home, until the household packs the day before
    for (const o of by.self.filter((x) => x.verb === 'goGathering' || x.verb === 'stayHome')) {
      const g = o.gathering,
        go = o.verb === 'goGathering';
      h += actRow(
        cmdAttrs(o),
        go ? 'green' : 'home',
        go ? `Go to the gathering at ${g.place}` : `Stay home from the gathering at ${g.place}`,
        go
          ? `Winter days 1 to 3, on its green; ${g.home ? 'you sleep at home' : "you lodge at a farm there, on a pack of the farm's grain"}`
          : 'Someone keeps the animals and the fire',
        o.why,
      );
    }
    // the fair (VB-303): standing at the gathering with a load, a swap with another dealer there (page/swap)
    const fair = Sim.fairSides(st, id);
    if (fair)
      h += actRow(
        'data-bar="view" data-view="swap"',
        'offer',
        'Deal at the fair',
        `${fair.dealers.length} ${fair.dealers.length === 1 ? 'dealer' : 'dealers'} here with a load`,
        fair.dealers.length ? null : 'no other dealer with a load is here now',
        true,
      );
    // a winter's visit (VB-292): its own, or that of a son or daughter of the house it speaks for; planned at once, set out in winter
    for (const o of by.self.filter((x) => x.verb === 'visit')) {
      const v = o.visit;
      h += actRow(
        `data-play="visit" data-who="${v.who}" data-village="${o.target}"`,
        'walk',
        v.name ? `Send ${v.name} to visit ${v.place}` : `Visit ${v.place}`,
        `${v.days} days away on ${+v.rations.toFixed(1)} rations of the farm's grain; sets out in winter`,
        o.why,
      );
    }
    // a call at a farm within a day's walk (VB-1271; the verb `call`): shown as a visit is, by place, with the verb's own reason when barred
    for (const o of by.self.filter((x) => x.verb === 'callAt'))
      h += actRow(
        cmdAttrs(o),
        'walk',
        `Call at ${o.call.place}`,
        `In ${o.call.village}; you spend tomorrow evening in its yard`,
        o.why,
      );
    // a tale made up about someone it knows (VB-554): the form, with what it risks
    const ill = by.self.find((o) => o.verb === 'slander');
    if (ill)
      h += actRow(
        'data-bar="view" data-view="slander"',
        'offer',
        'Speak ill of',
        'A tale about someone you know, told as your own',
        ill.why,
        true,
      );
    if (by.offers.length)
      h += actRow(
        'data-bar="sheet"',
        'offer',
        by.offers.every((o) => o.offer.basis === 'match') ? 'A match is offered' : 'An offer is made',
        `${by.offers.length} waiting for your answer`,
        null,
        true,
      );
    if (by.round.length)
      h += actRow(
        'data-bar="view" data-view="round"',
        'round',
        'At the moving round',
        'Your wishes: moving out, a farm, service, new land, a match',
        null,
        true,
      );
    return h;
  }
  if (m.g === 'house') {
    if (!hh) return `${h}<p class="act-empty">You belong to no household.</p>`;
    const work = by.house.filter((o) => o.verb === 'work'),
      ale = by.house.find((o) => o.verb === 'callAle');
    h += work.length ? workRows(work) : '<p class="act-empty">No work of your household you may take now.</p>';
    if (ale)
      h += actRow(cmdAttrs(ale), 'ale', 'Open the house for an ale evening', 'Tonight, on a barrel to spare', ale.why);
    const hand = by.house.find((o) => o.verb === 'offer');
    if (hand) h += handOnRow(hand);
    const own = givesFor(id);
    h += actRow(
      'data-bar="view" data-view="give"',
      'gift',
      'Give grain',
      own ? `To kin or a neighbour; ${giftMax(own)} rations above the seed` : '',
      own ? null : "only the household's holder gives its grain",
      true,
    );
    return h;
  }
  h += by.village.length ? workRows(by.village) : '<p class="act-empty">No village work you may take now.</p>';
  return h;
}
// The Speak ill of form (VB-554): whom (the grown it knows best) and what (a kind of tale), with the one line of what it risks.
function slanderHTML(o) {
  if (!o) return '<p class="act-empty">You may not speak ill of anyone now.</p>';
  const { parties, kinds } = o.slander;
  if (!parties.some((x) => x.id === slander.who)) slander.who = parties.length ? parties[0].id : null;
  if (!kinds.some((x) => x.kind === slander.kind)) slander.kind = kinds[0].kind;
  const opt = (v, label, on) => `<option value="${esc(String(v))}"${on ? ' selected' : ''}>${esc(label)}</option>`;
  return (
    '<div class="act-form">' +
    `<label class="fl" for="slanderWho">Of whom</label><select id="slanderWho">${parties
      .map((x) => opt(x.id, x.name, x.id === slander.who))
      .join('')}</select>` +
    `<label class="fl" for="slanderKind">That they</label><select id="slanderKind">${kinds
      .map((x) => opt(x.kind, x.words, x.kind === slander.kind))
      .join('')}</select>` +
    '<p class="hint" data-risk>If it reaches one who knows them better, it is found out: then it is told of you, and worse than you told it.</p>' +
    `<button type="button" class="primary" data-bar="slander" data-k="slander"${
      o.why || slander.who === null ? ' disabled' : ''
    }>Speak ill of them</button></div>`
  );
}
$('actMenu').addEventListener('change', (e) => {
  if (e.target.id === 'slanderWho') slander.who = +e.target.value;
  else if (e.target.id === 'slanderKind') slander.kind = e.target.value;
});
// Called by renderActions (page/play), with the opportunities it read, or null while neither the list nor the tool is open.
function renderBar(id, opps) {
  paintBar();
  if (tool && opps) toolSites(id, opps);
  paintBanner();
  if (!barOpen || !barMenu || !opps) {
    barHTML = '';
    return;
  }
  const menu = $('actMenu'),
    h = menuHTML(id, opps),
    act = document.activeElement,
    inside = menu.contains(act);
  if (h === barHTML || (inside && act.matches('input, select'))) return;
  const k = inside && act.dataset ? act.dataset.k : null;
  barHTML = h;
  menu.innerHTML = h;
  if (barMenu.view === 'give' && $('giveTo')) {
    $('giveTo').value = gift.to === null ? '' : String(gift.to);
    $('giveN').value = String(gift.n);
  }
  const back = k && [...menu.querySelectorAll('[data-k]')].find((el) => el.dataset.k === k);
  if (back) back.focus({ preventScroll: true });
}
document.querySelectorAll('#actBar [data-group]').forEach((b) =>
  b.addEventListener('click', () => {
    const g = b.dataset.group,
      was = barMenu && barMenu.g === g;
    endTool();
    if (activePanel) openPanel(null);
    barMenu = was ? null : { g, view: null };
    barMsg = null;
    barHTML = '';
    renderActions();
  }),
);
$('queueBtn').addEventListener('click', () => {
  endTool();
  openPanel(activePanel === 'actions' ? null : 'actions');
  renderActions();
});
$('actMenu').addEventListener('click', (e) => {
  const b = e.target.closest('button'),
    id = st ? played() : -1;
  if (!b || id < 0) return;
  const act = b.dataset.bar;
  barMsg = null;
  if (b.dataset.give) {
    giveClick(b, id);
  } else if (b.dataset.swap) {
    swapClick(b, id);
  } else if (b.dataset.play) {
    const r = playClick(b);
    if (r !== true) barMsg = { text: r, bad: true };
    else if (b.dataset.play === 'do') barMsg = { text: `Queued: ${commandWords(JSON.parse(b.dataset.cmd))}.` };
    else if (b.dataset.play === 'visit') barMsg = { text: 'The visit is planned: it sets out in winter.' };
  } else if (act === 'close') {
    const g = barMenu.g;
    closeBarMenu();
    document.querySelector(`#actBar [data-group="${g}"]`).focus();
    return;
  } else if (act === 'back') barMenu.view = null;
  else if (act === 'view') {
    barMenu.view = b.dataset.view;
    if (barMenu.view === 'give') {
      gift.warn = null;
      gift.msg = '';
    }
    if (barMenu.view === 'swap') {
      swap.warn = null;
      swap.msg = '';
    }
  } else if (act === 'why')
    barMsg = { text: `${b.querySelector('.nm').firstChild.textContent}: ${b.dataset.why}.`, bad: true };
  else if (act === 'sheet') {
    openPanel('actions');
  } else if (act === 'walk')
    startTool({ kind: 'walk', icon: 'walk', title: 'Walk here', needs: 'an open tile', keep: false });
  else if (act === 'work') workAct(id, b.dataset.kind, b.dataset.holder);
  else if (act === 'slander') {
    const r = Sim.queue(st, st.player.pawn, {
      actor: id,
      verb: 'slander',
      target: slander.who,
      args: { kind: slander.kind },
    });
    barMsg =
      r === true ? { text: `Queued: speak ill of ${Sim.fullName(st.pawns[slander.who])}.` } : { text: r, bad: true };
    if (r === true) barMenu.view = null;
  }
  barHTML = '';
  renderActions();
});
// A kind of work chosen: open at one place, it is queued at once; at several, the tool takes the place from the map.
function workAct(id, kind, holder) {
  const open = Sim.opportunities(st, id).filter(
    (o) => o.verb === 'work' && o.kind === kind && o.holder.type === holder && o.why === null,
  );
  if (open.length > 1) {
    startTool({
      kind: 'work',
      work: kind,
      holder,
      icon: KIND_ICON[kind] || 'hoe',
      title: Sim.KINDS[kind].name,
      needs: 'a marked tile',
      keep: true,
    });
    return;
  }
  if (!open.length) {
    barMsg = { text: `${Sim.KINDS[kind].name}: none you may take now.`, bad: true };
    return;
  }
  const r = Sim.queue(st, st.player.pawn, { actor: id, verb: 'work', target: open[0].target });
  barMsg = r === true ? { text: `Queued: ${commandWords(open[0])}.` } : { text: r, bad: true };
}
// ---- the tool: an act that waits for a tile ----
// tool: {kind ('walk', 'work', 'give' or 'plan': a tile of the plan panel's, page/plan), icon, title, needs (what to tap), keep (true:
// it stays in hand until Done, for repeated work), work and holder (the kind of work and whose), sites (the tiles marked as taking it),
// msg (the last tap's answer), facts (the plan's tool: what the tile pointed at is, page/plan's planPoint)}.
// The banner names it; the next click on the map (page/tileinfo asks first) is toolTap's. A refused tap
// says why and waits for another.
function startTool(t) {
  tool = { sites: [], msg: null, ...t };
  barMenu = null;
  barMsg = null;
  flash = null;
  if (activePanel) openPanel(null);
}
function endTool() {
  if (!tool) return;
  tool = null;
  paintBanner();
}
// the tiles that take the act: the places of the kind of work open to it, or the houses of the households it may give to
function toolSites(id, opps) {
  if (tool.kind === 'work') {
    tool.sites = opps
      .filter(
        (o) =>
          o.verb === 'work' && o.kind === tool.work && o.holder.type === tool.holder && o.why === null && o.site >= 0,
      )
      .map((o) => o.site);
  } else if (tool.kind === 'give') {
    const own = givesFor(id);
    tool.sites = own ? giftChoices(own).all.map((k) => st.farmsteads[st.households[k].farmstead].house) : [];
  }
}
function toolTap(pw, named, i) {
  const id = played();
  if (id < 0) {
    endTool();
    return;
  }
  tool.msg = null;
  if (tool.kind === 'walk') {
    const o = i >= 0 ? Sim.opportunities(st, id, i).find((x) => x.verb === 'walkTo') : null;
    if (!o || o.why) tool.msg = { text: `${o ? o.why : 'no one can walk there'}: ${tapWord} an open tile`, bad: true };
    else done(Sim.queue(st, st.player.pawn, { actor: id, verb: 'walkTo', target: i }), 'Queued: walk to the tile.');
  } else if (tool.kind === 'work') {
    const o = Sim.opportunities(st, id).find(
      (x) => x.verb === 'work' && x.kind === tool.work && x.holder.type === tool.holder && x.site === i,
    );
    if (!o)
      tool.msg = { text: `No ${Sim.KINDS[tool.work].name.toLowerCase()} there: ${tapWord} a marked tile`, bad: true };
    else if (o.why) tool.msg = { text: o.why, bad: true };
    else {
      const r = Sim.queue(st, st.player.pawn, { actor: id, verb: 'work', target: o.target });
      tool.msg = r === true ? { text: `Queued: ${commandWords(o)}.` } : { text: r, bad: true };
    }
  } else if (tool.kind === 'give') pickGift(pw, named, i);
  else if (tool.kind === 'plan') planTap(i); // the plan panel's tile (page/plan)
  renderActions();
}
// a tool that is done after one tap: put away, with a line in the banner for a moment
function done(r, text) {
  if (r !== true) {
    tool.msg = { text: r, bad: true };
    return;
  }
  tool = null;
  flash = { text, until: performance.now() + 3000 };
}
// The banner under the top bar while the tool is in hand: the act, what to tap, the last tap's answer, and Done (or Cancel).
// The guide's row for the work in hand (VB-1124): the plan tool's field or meadow (break, meadow), a kind's own.
function guideLink(t) {
  const k = t.kind === 'plan' ? (t.what === 'field' ? 'break' : 'meadow') : t.kind === 'work' ? t.work : null;
  return k && Sim.KINDS[k]
    ? `<a href="#" class="guide-link" data-guide="work:${esc(k)}">What ${esc(Sim.KINDS[k].name.toLowerCase())} needs and gives</a>`
    : '';
}
function paintBanner() {
  const el = $('actBanner');
  let h = '';
  if (tool) {
    h =
      `${actIcon(tool.icon)}<div class="txt"><b>${esc(tool.title)}</b>: ${tapWord} ${esc(tool.needs)}${
        tool.kind === 'work' && !tool.sites.length ? '<span class="bad">None is open to you now.</span>' : ''
      }${tool.facts ? `<span data-facts>${esc(tool.facts)}</span>` : ''}${guideLink(tool)}${
        tool.msg ? `<span class="${tool.msg.bad ? 'bad' : ''}">${esc(tool.msg.text)}</span>` : ''
      }` +
      `</div><button type="button" data-tool="end"${tool.keep ? ' class="primary"' : ''}>${tool.keep ? 'Done' : 'Cancel'}</button>`;
  } else if (flash && performance.now() < flash.until) h = `<div class="txt">${esc(flash.text)}</div>`;
  else flash = null;
  el.hidden = !h;
  document.body.classList.toggle('tool-on', !!h);
  if (h !== bannerHTML) {
    bannerHTML = h;
    el.innerHTML = h;
  }
}
$('actBanner').addEventListener('click', (e) => {
  if (!e.target.closest('button[data-tool]')) return;
  const back = tool && tool.kind === 'give';
  endTool();
  if (back && barOpen) barMenu = { g: 'house', view: 'give' };
  if (st) renderActions();
});
// The marks: a white hexagon, as the selection's, on each tile that takes the act, the same width on screen at any zoom; redrawn when
// they or the zoom change. Called each frame (page/animate).
function drawToolMarks() {
  const sites = tool && !document.body.classList.contains('ui-hidden') ? tool.sites : [];
  const key = sites.length ? `${sites.join(',')}|${cam.z.toFixed(3)}` : '';
  if (key === toolKey) return;
  toolKey = key;
  toolG.clear();
  for (const i of sites)
    toolG
      .poly(hexPoly(i, 0.9))
      .fill({ color: 0xffffff, alpha: 0.2 })
      .stroke({ width: 3 / cam.z, color: 0xffffff, alpha: 0.95 });
}
