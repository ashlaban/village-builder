// @sys page/history: the History tab of the selection card, read from the record of events, and the names in a line as links (VB-099)
  // ======== history ========
  // The card of a pawn, a farm or a village has two tabs, Details and History; the tab chosen stays as the selection changes, so a name
  // followed in one history opens the next. The filter by kind is the page's own state too.
  let cardTab = 'facts', historyGroup = '', historyStamp = '', historyHTML = '';
  const HISTORY_ROWS = 200; // lines drawn; a filter by kind reaches the older ones
  $('historyKinds').innerHTML = [['', 'All'], ...Object.entries(Sim.CHRONICLE).map(([key, g]) => [key, g.label])].map(([key, label]) =>
    `<button type="button" data-history="${key}" aria-pressed="${key === ''}">${label}</button>`).join('');
  // When an event happened: the year, and for those of the run its season and day (the dates from before the start are only years).
  function whenOf(t) {
    const c = Sim.cal(t);
    return t < 0 ? `Year ${String(c.year).replace('-', '−')}` : `Year ${c.year}, ${Sim.SEASONS[c.season]}, day ${c.sday + 1}`;
  }
  // A line of the record with the names of its pawns, farm and village as links that select them: each name where the line first has it.
  function linkNames(text, ev) {
    const names = [], marks = [];
    if (ev.pawn !== undefined) names.push([Sim.fullName(st.pawns[ev.pawn]), `data-pawn="${ev.pawn}"`]);
    if (ev.other !== undefined) names.push([Sim.fullName(st.pawns[ev.other]), `data-pawn="${ev.other}"`]);
    if (ev.farm !== undefined) names.push([st.farmsteads[ev.farm].name, `data-farm="${ev.farm}"`]);
    if (ev.village !== undefined) names.push([st.villages[ev.village].name, `data-village="${ev.village}"`]);
    names.sort((a, b) => b[0].length - a[0].length); // the longer name first, where one holds another
    for (const [name, attr] of names) {
      let i = -1;
      do i = text.indexOf(name, i + 1); while (i >= 0 && marks.some((m) => i < m[1] && i + name.length > m[0]));
      if (i >= 0) marks.push([i, i + name.length, attr]);
    }
    marks.sort((a, b) => a[0] - b[0]);
    let h = '', at = 0;
    for (const [from, to, attr] of marks) {
      h += `${esc(text.slice(at, from))}<button type="button" class="name" ${attr}>${esc(text.slice(from, to))}</button>`; at = to;
    }
    return h + esc(text.slice(at));
  }
  // What the History tab tells of: the selected pawn, village, or farm (a farm's history follows the farm, whoever lives there).
  const historySubject = () => (selPawn >= 0 ? { pawn: selPawn } : selVillage >= 0 ? { village: selVillage } : selFarm >= 0 ? { farm: selFarm } : null);
  function renderHistory(q) {
    const stamp = `${JSON.stringify(q)}|${historyGroup}|${st.record.length}`;
    if (stamp === historyStamp) return; // the record grows by appending: nothing new, nothing to tell
    historyStamp = stamp;
    const rows = Sim.chronicle(st, q, historyGroup || null);
    let h = rows.slice(0, HISTORY_ROWS).map((r) =>
      `<p><time>${whenOf(r.ev.t)}</time>${linkNames(r.text, r.ev)}${r.note ? `<i>${esc(r.note)}</i>` : ''}</p>`).join('');
    if (!rows.length) h = `<p class="more">${historyGroup ? 'Nothing of this kind on record.' : 'Nothing on record yet.'}</p>`;
    if (rows.length > HISTORY_ROWS) h += `<p class="more">${rows.length - HISTORY_ROWS} earlier events are not listed; choose a kind to reach them.</p>`;
    if (h !== historyHTML) { historyHTML = h; updatePanelHTML($('historyList'), h); }
  }
  // Called whenever the card is filled (page/words, card): the tabs show for a pinned pawn, farm or village, and the open one is drawn.
  function syncTabs() {
    const q = st && selectionPinned ? historySubject() : null, history = !!q && cardTab === 'history';
    $('tileTabs').hidden = !q; $('tileFacts').hidden = history; $('tileHistory').hidden = !history;
    for (const b of $('tileTabs').children) {
      const on = (b.dataset.tab === 'history') === history;
      b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1;
    }
    for (const b of $('historyKinds').children) b.setAttribute('aria-pressed', b.dataset.history === historyGroup);
    if (history) renderHistory(q);
  }
  $('tile').addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]'), kind = e.target.closest('[data-history]');
    if (tab) cardTab = tab.dataset.tab; else if (kind) historyGroup = kind.dataset.history; else return;
    syncTabs();
  });
  // Left and right move between the tabs, as in any tab list.
  $('tileTabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    cardTab = cardTab === 'history' ? 'facts' : 'history'; syncTabs();
    $(cardTab === 'history' ? 'tabHistory' : 'tabFacts').focus(); e.preventDefault();
  });
