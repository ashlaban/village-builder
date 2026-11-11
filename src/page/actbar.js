// @sys page/actbar: the action bar (VB-341): the dock's Actions opens a second bar, Myself, Household and Village (and the Queue); each group lists
// the played pawn's acts by their basis, an act that needs a tile puts the map in a tool mode, and the gift is one form in the list
  // ======== the action bar ========
  // All of it is the page's own state, never saved: whether the bar is open (barOpen), the list open above it (barMenu: {g, view}, the group
  // 'self', 'house' or 'village', and a view inside it, null, 'round', 'causes' or 'give'), its last message (barMsg: {text, bad}), the tool
  // (tool: an act waiting for a tile, below) and the gift's draft (gift). It reads st and queues through Sim, as the sheet does (page/play).
  let barOpen = false, barMenu = null, barMsg = null, barHTML = '', tool = null, toolKey = '', flash = null, bannerHTML = '';
  const GROUPS = { self: 'Myself', house: 'Household', village: 'Village' };
  const toolG = new PIXI.Graphics();
  L.hover.addChild(toolG);
  function paintBar() {
    const on = barOpen && played() >= 0, pl = st && st.player;
    $('actBar').hidden = !on; $('actMenu').hidden = !(on && barMenu);
    document.body.classList.toggle('bar-open', on);
    $('actionsBtn').setAttribute('aria-pressed', String(on));
    for (const b of document.querySelectorAll('#actBar [data-group]')) b.setAttribute('aria-expanded',
      String(!!(on && barMenu && barMenu.g === b.dataset.group)));
    $('queueBtn').setAttribute('aria-pressed', String(activePanel === 'actions'));
    const n = on && pl ? String(pl.queue.length || '') : '';
    if ($('queueCount').textContent !== n) $('queueCount').textContent = n;
  }
  function openBar(queue = false) {
    barOpen = true;
    if (queue) openPanel('actions'); else paintBar();
    if (st) renderActions();
  }
  function closeBar() {
    barOpen = false; barMenu = null; barMsg = null; endTool();
    if (activePanel === 'actions') openPanel(null); else paintBar();
  }
  function closeBarMenu() { barMenu = null; barMsg = null; paintBar(); }
  // ---- rows: an icon, a name, a one-line note or, in red, why it is refused; a chevron when it leads to a list or a form ----
  const cmdAttrs = (o) => `data-play="do" data-cmd="${esc(JSON.stringify({ verb: o.verb, target: o.target, args: o.args || undefined }))}"`;
  function actRow(attrs, icon, name, note, why = null, more = false) {
    const how = why ? `data-bar="why" data-why="${esc(why)}" aria-disabled="true"` : attrs;
    return `<button type="button" class="act-row" ${how} data-k="${esc(icon + ':' + name)}">${actIcon(icon)}<span class="nm">${esc(name)}`
      + `<small>${esc(why || note)}</small></span>${more ? actIcon('next') : ''}</button>`;
  }
  // The work it may take, one row a kind: queued at once where it is open at one place, or the tool, which marks the places, where at several.
  function workRows(list) {
    const kinds = new Map();
    for (const o of list) { if (!kinds.has(o.kind)) kinds.set(o.kind, []); kinds.get(o.kind).push(o); }
    let h = '';
    for (const [k, items] of kinds) {
      const open = items.filter((o) => o.why === null), o = open[0], whom = (x) => `for ${holderName(x.holder)}, ${BASIS[x.basis]}`;
      const note = open.length > 1 ? `${open.length} places ${whom(o)}: tap one on the map` : o ? `${whom(o)}` : null;
      h += actRow(`data-bar="work" data-kind="${k}" data-holder="${o ? o.holder.type : ''}"`, KIND_ICON[k] || 'hoe', Sim.KINDS[k].name, note,
        o ? null : items[0].why, open.length > 1);
    }
    return h;
  }
  // The open list: a group's acts, or a view inside it (the moving round's wishes, the causes, the gift's form).
  function menuHTML(id, opps) {
    const p = st.pawns[id], m = barMenu, hh = p.household !== null ? st.households[p.household] : null;
    const by = { self: [], house: [], village: [], causes: [], round: [], offers: [] };
    for (const o of opps) {
      if (o.when === 'offer') by.offers.push(o);
      else if (o.when === 'round') by.round.push(o);
      else if (o.verb === 'work') by[o.holder && o.holder.type === 'village' ? 'village' : 'house'].push(o);
      else if (o.verb === 'argue' || o.verb === 'dropCause') by.causes.push(o);
      else by.self.push(o);
    }
    const TITLES = { round: 'At the moving round', causes: p.advocate ? 'Its cause' : 'Argue a cause', give: 'Give grain' };
    let h = `<div class="mh">${m.view ? `<button type="button" data-bar="back" data-k="back" aria-label="Back to ${GROUPS[m.g]}">${actIcon('back')}</button>` :
      ''}`
      + `<h2 id="actMenuTitle">${m.view ? TITLES[m.view] : GROUPS[m.g]}</h2>`
      + `<button type="button" data-bar="close" data-k="close" aria-label="Close the list">${actIcon('no')}</button></div>`;
    if (barMsg) h += `<p class="act-msg${barMsg.bad ? ' bad' : ''}" role="status">${esc(barMsg.text)}</p>`;
    if (m.view === 'round') return `${h}<div class="play">${roundBox(id, by.round, st.player.wishes)}</div>`;
    if (m.view === 'causes') {
      return `${h}<div class="play">${causeNote(p)}</div>${by.causes.map((o) =>
        actRow(cmdAttrs(o), o.verb === 'argue' ? 'cause' : 'no', commandWords(o), o.verb === 'argue' ? 'Argue for it before the village' : 'It argues no more',
          o.why)).join('')}`;
    }
    if (m.view === 'give') return h + giveHTML(id);
    if (m.g === 'self') {
      const home = by.self.find((o) => o.verb === 'goHome'), idle = by.self.find((o) => o.verb === 'idle');
      h += actRow('data-bar="walk"', 'walk', 'Walk here', 'Then tap an open tile on the map');
      h += actRow(cmdAttrs(home), 'home', 'Go home', 'Indoors, for itself', home.why);
      h += actRow(cmdAttrs(idle), 'idle', 'Rest an hour', 'It waits where it is', idle.why);
      if (by.offers.length) h += actRow('data-bar="sheet"', 'offer', 'A match is offered', `${by.offers.length} waiting for its answer`, null, true);
      if (by.round.length) h += actRow('data-bar="view" data-view="round"', 'round', 'At the moving round', 'Its wishes: moving out, a farm, service, a match',
        null, true);
      return h;
    }
    if (m.g === 'house') {
      if (!hh) return `${h}<p class="act-empty">It belongs to no household.</p>`;
      h += by.house.length ? workRows(by.house) : '<p class="act-empty">No work of its household it may take now.</p>';
      const own = givesFor(id);
      h += actRow('data-bar="view" data-view="give"', 'gift', 'Give grain', own ? `To kin or a neighbour; ${giftMax(own)} rations above the seed` : '',
        own ? null : "only the household's holder gives its grain", true);
      return h;
    }
    h += by.village.length ? workRows(by.village) : '<p class="act-empty">No village work it may take now.</p>';
    if (by.causes.length || p.advocate) {
      const a = p.advocate;
      h += actRow('data-bar="view" data-view="causes"', 'cause', TITLES.causes, a ? `For “${Culture.DIMS[a.dim].opts[a.opt][1]}”, `
        + `${Math.max(0, a.until - st.cenv.t).toFixed(1)} more years` : 'A custom of the village it would change', null, true);
    }
    return h;
  }
  // Called by renderActions (page/play), with the opportunities it read, or null while neither the list nor the tool is open.
  function renderBar(id, opps) {
    paintBar();
    if (tool && opps) toolSites(id, opps);
    paintBanner();
    if (!barOpen || !barMenu || !opps) { barHTML = ''; return; }
    const menu = $('actMenu'), h = menuHTML(id, opps), act = document.activeElement, inside = menu.contains(act);
    if (h === barHTML || (inside && act.matches('input, select'))) return;
    const k = inside && act.dataset ? act.dataset.k : null;
    barHTML = h; menu.innerHTML = h;
    if (barMenu.view === 'give' && $('giveTo')) { $('giveTo').value = gift.to === null ? '' : String(gift.to); $('giveN').value = String(gift.n); }
    const back = k && [...menu.querySelectorAll('[data-k]')].find((el) => el.dataset.k === k);
    if (back) back.focus({ preventScroll: true });
  }
  document.querySelectorAll('#actBar [data-group]').forEach((b) => b.addEventListener('click', () => {
    const g = b.dataset.group, was = barMenu && barMenu.g === g;
    endTool();
    if (activePanel) openPanel(null);
    barMenu = was ? null : { g, view: null }; barMsg = null; barHTML = '';
    renderActions();
  }));
  $('queueBtn').addEventListener('click', () => { endTool(); openPanel(activePanel === 'actions' ? null : 'actions'); renderActions(); });
  $('actMenu').addEventListener('click', (e) => {
    const b = e.target.closest('button'), id = st ? played() : -1;
    if (!b || id < 0) return;
    const act = b.dataset.bar;
    barMsg = null;
    if (b.dataset.give) { giveClick(b, id); }
    else if (b.dataset.play) {
      const r = playClick(b);
      if (r !== true) barMsg = { text: r, bad: true };
      else if (b.dataset.play === 'do') barMsg = { text: `Queued: ${commandWords(JSON.parse(b.dataset.cmd))}.` };
    } else if (act === 'close') { const g = barMenu.g; closeBarMenu(); document.querySelector(`#actBar [data-group="${g}"]`).focus(); return; }
    else if (act === 'back') barMenu.view = null;
    else if (act === 'view') { barMenu.view = b.dataset.view; if (barMenu.view === 'give') { gift.warn = null; gift.msg = ''; } }
    else if (act === 'why') barMsg = { text: `${b.querySelector('.nm').firstChild.textContent}: ${b.dataset.why}.`, bad: true };
    else if (act === 'sheet') { openPanel('actions'); }
    else if (act === 'walk') startTool({ kind: 'walk', icon: 'walk', title: 'Walk here', needs: 'an open tile', keep: false });
    else if (act === 'work') workAct(id, b.dataset.kind, b.dataset.holder);
    barHTML = '';
    renderActions();
  });
  // A kind of work chosen: open at one place, it is queued at once; at several, the tool takes the place from the map.
  function workAct(id, kind, holder) {
    const open = Sim.opportunities(st, id).filter((o) => o.verb === 'work' && o.kind === kind && o.holder.type === holder && o.why === null);
    if (open.length > 1) {
      startTool({ kind: 'work', work: kind, holder, icon: KIND_ICON[kind] || 'hoe', title: Sim.KINDS[kind].name, needs: 'a marked tile', keep: true });
      return;
    }
    if (!open.length) { barMsg = { text: `${Sim.KINDS[kind].name}: none it may take now.`, bad: true }; return; }
    const r = Sim.queue(st, { actor: id, verb: 'work', target: open[0].target });
    barMsg = r === true ? { text: `Queued: ${commandWords(open[0])}.` } : { text: r, bad: true };
  }
  // ---- the tool: an act that waits for a tile ----
  // tool: {kind ('walk', 'work' or 'give'), icon, title, needs (what to tap), keep (true: it stays in hand until Done, for repeated work),
  // work and holder (the kind of work and whose), sites (the tiles marked as taking it), msg (the last tap's answer)}. The banner names it;
  // the next click on the map (page/tileinfo asks first) is toolTap's. A refused tap says why and waits for another.
  function startTool(t) {
    tool = { sites: [], msg: null, ...t }; barMenu = null; barMsg = null; flash = null;
    if (activePanel) openPanel(null);
  }
  function endTool() { if (!tool) return; tool = null; paintBanner(); }
  // the tiles that take the act: the places of the kind of work open to it, or the houses of the households it may give to
  function toolSites(id, opps) {
    if (tool.kind === 'work') {
      tool.sites = opps.filter((o) => o.verb === 'work' && o.kind === tool.work && o.holder.type === tool.holder && o.why === null && o.site >= 0)
        .map((o) => o.site);
    } else if (tool.kind === 'give') {
      const own = givesFor(id);
      tool.sites = own ? giftChoices(own).all.map((k) => st.farmsteads[st.households[k].farmstead].house) : [];
    }
  }
  function toolTap(pw, named, i) {
    const id = played();
    if (id < 0) { endTool(); return; }
    tool.msg = null;
    if (tool.kind === 'walk') {
      const o = i >= 0 ? Sim.opportunities(st, id, i).find((x) => x.verb === 'walkTo') : null;
      if (!o || o.why) tool.msg = { text: `${o ? o.why : 'no one can walk there'}: tap an open tile`, bad: true };
      else done(Sim.queue(st, { actor: id, verb: 'walkTo', target: i }), 'Queued: walk to the tile.');
    } else if (tool.kind === 'work') {
      const o = Sim.opportunities(st, id).find((x) => x.verb === 'work' && x.kind === tool.work && x.holder.type === tool.holder && x.site === i);
      if (!o) tool.msg = { text: `No ${Sim.KINDS[tool.work].name.toLowerCase()} there: tap a marked tile`, bad: true };
      else if (o.why) tool.msg = { text: o.why, bad: true };
      else { const r = Sim.queue(st, { actor: id, verb: 'work', target: o.target });
        tool.msg = r === true ? { text: `Queued: ${commandWords(o)}.` } : { text: r, bad: true }; }
    } else if (tool.kind === 'give') pickGift(pw, named, i);
    renderActions();
  }
  // a tool that is done after one tap: put away, with a line in the banner for a moment
  function done(r, text) {
    if (r !== true) { tool.msg = { text: r, bad: true }; return; }
    tool = null; flash = { text, until: performance.now() + 3000 };
  }
  // The banner under the top bar while the tool is in hand: the act, what to tap, the last tap's answer, and Done (or Cancel).
  function paintBanner() {
    const el = $('actBanner');
    let h = '';
    if (tool) {
      h = `${actIcon(tool.icon)}<div class="txt"><b>${esc(tool.title)}</b>: tap ${esc(tool.needs)}${tool.kind === 'work' && !tool.sites.length
        ? '<span class="bad">None is open to it now.</span>' : ''}${tool.msg ? `<span class="${tool.msg.bad ? 'bad' : ''}">${esc(tool.msg.text)}</span>` : ''}`
        + `</div><button type="button" data-tool="end"${tool.keep ? ' class="primary"' : ''}>${tool.keep ? 'Done' : 'Cancel'}</button>`;
    } else if (flash && performance.now() < flash.until) h = `<div class="txt">${esc(flash.text)}</div>`;
    else flash = null;
    el.hidden = !h; document.body.classList.toggle('tool-on', !!h);
    if (h !== bannerHTML) { bannerHTML = h; el.innerHTML = h; }
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
    toolKey = key; toolG.clear();
    for (const i of sites) toolG.poly(hexPoly(i, 0.9)).fill({ color: 0xffffff, alpha: 0.2 }).stroke({ width: 3 / cam.z, color: 0xffffff, alpha: 0.95 });
  }
