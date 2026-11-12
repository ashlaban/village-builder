// @sys page/culture: the Culture pane of the dock: a culture's villages and what is unusual in each, its own charter, the meetings (VB-390)
  // ======== culture ========
  // The pane tells of one culture: where the island has several, chips choose. Its tabs: the villages, those with something stirring or a
  // way of their own first; the custom, the culture's own charter (page/customs); the meetings, by year.
  const KEEPERS = 6; // more villages than this that keep the custom throughout fold into one line
  let cultureOf = 0, cultureWanted = -1, cultureTab = 'villages', cultureOpen = -1, cultureKept = false, cultureStamp = '';
  const culturesLive = () => st.cenv.cultures.filter((c) => st.cenv.settlements.some((s) => s.culture === c.id));
  // The culture the pane opens on: the one asked for by a link, else that of the village selected, else of the played pawn's village.
  function chooseCulture() {
    const env = st.cenv, of = (v) => (v >= 0 && env.settlements[v] && env.settlements[v].id === v ? env.settlements[v].culture : -1);
    const me = played(), home = me >= 0 ? Sim.settlementIdOf(st, st.pawns[me]) : -1, live = culturesLive().map((c) => c.id);
    const want = [cultureWanted, of(selVillage), of(home === null || home === undefined ? -1 : home), cultureOf].find((c) => live.includes(c));
    cultureOf = want === undefined ? live[0] : want; cultureWanted = -1; cultureOpen = -1; cultureStamp = '';
  }
  // From a village's Customs tab: the pane at that village's culture.
  function openCulture(id) { cultureWanted = id; cultureTab = 'villages'; openDrawer('culture'); }
  function cultureVillages(cu, setts) {
    const cn = esc(cu.name), read = setts.map((s) => {
      const r = readCustoms(s), own = r.dims.filter((c) => c.differs), turn = r.dims.find((c) => c.state === 'turning'),
        cont = r.dims.find((c) => c.state === 'contested');
      return { s, own, turn, cont, rank: (turn ? 100 : 0) + (cont ? 10 : 0) + own.length };
    }).sort((a, b) => b.rank - a.rank || a.s.id - b.s.id);
    const row = (v) => `<button type="button" class="row" data-charter="${v.s.id}">${iconImg(villageIcon(st.villages[v.s.id]), 'mini')}<span class="who">${
      esc(v.s.name)}<i>${v.own.length ? `Its own way: ${v.own.map((c) =>
        `${esc(c.d.label.toLowerCase())}: ${esc(optLabel(c.k, c.x).toLowerCase())}`).join('; ')}`
      : 'Keeps the custom throughout'}</i>${v.turn ? `<i class="stir"><span class="mark hungry"></span>${esc(v.turn.d.label)}: set to change</i>`
      : v.cont ? `<i class="stir"><span class="mark short"></span>${esc(v.cont.d.label)}: contested</i>` : ''}</span><span class="state">›</span></button>`;
    const quiet = read.filter((v) => !v.rank), fold = quiet.length > KEEPERS;
    return `<p class="note">A village keeps the ${cn} custom until its own meeting decides otherwise. Open a village to read its customs.</p>${
      read.filter((v) => v.rank || !fold).map(row).join('')}${fold ? `<details class="kept" ${cultureKept ? 'open' : ''}><summary>${quiet.length
      } villages keep the custom throughout</summary>${quiet.map(row).join('')}</details>` : ''}`;
  }
  function cultureCharter(cu, setts) {
    const split = (k) => setts.some((s) => s.practice[k] !== cu.customs[k]);
    const ways = (k) => `<div class="stand" id="cultureStand"><p class="of">${esc(Culture.DIMS[k].label)}</p>${Culture.DIMS[k].opts.map((o, j) => {
      const at = setts.filter((s) => s.practice[k] === j);
      return `<div class="way${j === cu.customs[k] ? ' in' : ''}"><p>${esc(o[1])}${j === cu.customs[k] ? '<em class="tag">The custom</em>' : ''}</p>${
        !at.length ? '<p class="none">No village.</p>' : at.length === setts.length ? `<p class="none">All ${setts.length} villages.</p>`
          : `<div class="links">${at.map((s) => villageChip(st.villages[s.id])).join('')}</div>`}</div>`;
    }).join('')}</div>`;
    return `<p class="note">What the ${esc(
      cu.name)} villages hold in common. A tinted phrase is one some village has changed; choose a phrase to see which.</p>${
      charterHTML('custom', (k) => cu.customs[k], (k) => (split(k) ? 'differs' : ''), cultureOpen, ways)}`;
  }
  function cultureMeetings() {
    const days = nextMeeting(), NONE = 'The meetings changed nothing this year.';
    let h = `<p class="note">The villages meet after harvest: next in ${days} ${days === 1 ? 'day' : 'days'}.</p>`, year = null, quiet = [];
    const flush = () => {
      if (quiet.length) h += `<p class="note">${quiet.length > 1 ? `Years ${quiet[quiet.length - 1]} to ${quiet[0]}` :
        `Year ${quiet[0]}`}: nothing changed.</p>`;
      quiet = [];
    };
    for (const e of st.meetingLog) {
      if (e.text === NONE) { quiet.push(e.year); continue; }
      flush();
      if (e.year !== year) { year = e.year; h += `<h3 class="lead">Year ${year}</h3>`; }
      h += `<p class="said">${esc(e.text)}</p>`;
    }
    flush();
    return h + (st.meetingLog.length ? '' : '<p class="note">No meeting held yet.</p>');
  }
  // Drawn when the day, the culture, the tab, the open phrase, a practice or the meeting log changes, not every frame.
  function renderCulture() {
    const env = st.cenv, live = culturesLive();
    if (!live.some((c) => c.id === cultureOf)) chooseCulture();
    const cu = env.cultures[cultureOf], setts = env.settlements.filter((s) => s.culture === cu.id);
    const stamp = [Math.floor(st.t / Sim.DAY), cu.id, cultureTab, cultureOpen, cultureKept, played(), live.length, cu.customs, st.meetingLog.length,
      st.meetingLog[0] && st.meetingLog[0].year, ...setts.map((s) => `${s.id}/${s.practice}`)].join(':');
    if (stamp === cultureStamp) return;
    cultureStamp = stamp;
    $('drawerTitle').textContent = `${cu.name} culture`;
    const people = setts.reduce((a, s) => a + Sim.membersOf(st, s.id).filter((p) => p.alive).length, 0),
      tabs = [['villages', 'Villages'], ['custom', 'The custom'],
      ['meetings', 'Meetings']];
    const h = `<div class="culture customs">${live.length > 1 ? `<div class="links" role="group" aria-label="Culture">${live.map((c) =>
      `<button type="button" class="chip" data-culture="${c.id}" aria-pressed="${c.id === cu.id}">${esc(c.name)}</button>`).join('')}</div>` : ''}
      <p class="note"><strong>${setts.length} ${setts.length === 1 ? 'village' : 'villages'}</strong> · ${people} people · centred on ${
      esc(env.settlements[cu.centres[0]].name)}${cu.parent !== null ? `, split from ${esc(env.cultures[cu.parent].name)}` : ''}</p>
      <div class="tabs" role="tablist" aria-label="About the culture">${tabs.map(([k, t]) =>
      `<button type="button" role="tab" data-ctab="${k}" aria-selected="${cultureTab === k}">${t}</button>`).join('')}</div>${
      cultureTab === 'villages' ? cultureVillages(cu, setts) : cultureTab === 'custom' ? cultureCharter(cu, setts) : cultureMeetings()}</div>`;
    updatePanelHTML($('drawerBody'), h);
  }
  // The pane's clicks: a tab, a culture, a village (its card, at the Customs tab), a phrase of the custom (also by Enter or Space).
  function cultureClick(e) {
    if (drawerTab !== 'culture') return;
    const hit = (sel) => e.target.closest(sel), tab = hit('[data-ctab]'), cu = hit('[data-culture]'), v = hit('[data-charter], [data-village]'),
      p = hit('[data-phrase]');
    if (e.type === 'keydown' && (!p || (e.key !== 'Enter' && e.key !== ' '))) return;
    if (v) { cardTab = 'customs'; selectVillage(+(v.dataset.charter || v.dataset.village)); return; }
    if (tab) { cultureTab = tab.dataset.ctab; cultureOpen = -1; } else if (cu) { cultureOf = +cu.dataset.culture; cultureOpen = -1; }
    else if (p) { e.preventDefault(); cultureOpen = cultureOpen === +p.dataset.phrase ? -1 : +p.dataset.phrase; } else return;
    renderCulture();
    const again = p ? $(`custom${p.dataset.phrase}`) : tab ? $('drawerBody').querySelector(`[data-ctab="${cultureTab}"]`) : null, stand = $('cultureStand');
    if (again) again.focus({ preventScroll: true });
    if (p && stand && stand.scrollIntoView) stand.scrollIntoView({ block: 'nearest' });
  }
  $('drawerBody').addEventListener('click', cultureClick);
  $('drawerBody').addEventListener('keydown', cultureClick);
  $('drawerBody').addEventListener('toggle', (e) => { if (e.target.classList.contains('kept')) { cultureKept = e.target.open; cultureStamp = ''; } }, true);
