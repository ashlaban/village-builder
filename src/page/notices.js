// @sys page/notices: toasts for notable events (VB-098), read from the record through Sim.notable, and the list that turns each kind on or off
  // ---- notifications ----
  // A toast for each notable event the record gains: at the bottom left for 6 s, at most 3 at once (a fourth replaces the oldest). Events of
  // one kind in one village on one game day share a toast while it is up ("3 births in Ulsäter"), which is what happens at high speed.
  // Which kinds show is the page's choice, kept in localStorage and never in st.
  const TOAST_SECONDS = 6, TOAST_MAX = 3, NOTICE_KEY = 'vb.notices.off';
  const MANY = { born: 'births', died: 'deaths', married: 'marriages', empty: 'farms left empty', claim: 'farms claimed', cottage: 'new cottages',
    left: 'parties setting out for new land', custom: 'changes of custom', split: 'partings of custom' };
  const noticeOff = new Set();
  try { for (const k of JSON.parse(localStorage.getItem(NOTICE_KEY) || '[]')) if (Sim.NOTABLE[k]) noticeOff.add(k); } catch (e) { noticeOff.clear(); }
  $('noticeList').innerHTML = Object.entries(Sim.NOTABLE).map(([k, label]) =>
    `<label class="dchk"><input type="checkbox" data-notice="${k}"${noticeOff.has(k) ? '' : ' checked'}> ${esc(label)}</label>`).join('');
  $('noticeList').addEventListener('change', (e) => {
    const k = e.target.dataset.notice; if (!k) return;
    if (e.target.checked) noticeOff.delete(k); else noticeOff.add(k);
    try { localStorage.setItem(NOTICE_KEY, JSON.stringify([...noticeOff])); } catch (err) { return; } // no storage: the choice lasts the visit
  });
  let noticeSt = null, noticeSeen = 0, noticeAbout = -1, toasts = [];
  function dropToast(t) { toasts = toasts.filter((x) => x !== t); t.el.remove(); }
  // What a click on a toast selects, as a link in a card does (page/cards): the newborn or the groom, the farm where it happened, else the village.
  function noticeTarget(ev) {
    if ((ev.kind === 'born' || ev.kind === 'married') && ev.pawn !== undefined) return { pawn: ev.pawn };
    if (ev.farm !== undefined) return { farm: ev.farm };
    if (ev.village !== undefined) return { village: ev.village };
    return ev.pawn !== undefined ? { pawn: ev.pawn } : null;
  }
  function openNotice(t) {
    const g = t.target; if (!g || st !== noticeSt) return;
    if (g.pawn !== undefined) focusPawn(g.pawn);
    else if (g.farm !== undefined) selectFarm(g.farm);
    else selectVillage(g.village);
  }
  function toast(ev) {
    const inVillage = ev.village !== undefined, key = `${ev.kind}|${inVillage ? ev.village : ''}|${Math.floor(ev.t / Sim.DAY)}`;
    let t = inVillage ? toasts.find((x) => x.key === key) : null;
    if (t) { t.n++; t.target = { village: ev.village }; t.el.textContent = `${t.n} ${MANY[ev.kind] || 'events'} in ${st.villages[ev.village].name}`; }
    else {
      t = { key, n: 1, target: noticeTarget(ev), left: 0, el: document.createElement('button') };
      t.el.type = 'button'; t.el.className = 'toast panel'; t.el.textContent = Sim.eventLine(st, ev);
      t.el.addEventListener('click', () => { openNotice(t); dropToast(t); });
      while (toasts.length >= TOAST_MAX) dropToast(toasts[0]);
      toasts.push(t); $('toasts').appendChild(t.el);
    }
    t.left = TOAST_SECONDS;
  }
  // Each frame: the events the record has gained since the last, judged for the pinned pawn (or the one pinned a frame ago, so that the
  // death of the selected pawn, which ends the selection, is still its own); then the toasts age in real time.
  function updateNotices(dt) {
    if (st !== noticeSt) { noticeSt = st; noticeSeen = st.record.length; noticeAbout = -1; for (const t of [...toasts]) dropToast(t); }
    const pinned = selectionPinned && selPawn >= 0 ? selPawn : -1, about = pinned >= 0 ? pinned : noticeAbout;
    noticeAbout = pinned;
    if (skipping) noticeSeen = st.record.length; // a debug skip passes its years untold
    for (; noticeSeen < st.record.length; noticeSeen++) {
      const ev = st.record[noticeSeen], why = Sim.notable(st, ev, about >= 0 ? about : null);
      if (why && why.some((k) => !noticeOff.has(k))) toast(ev);
    }
    for (const t of [...toasts]) { t.left -= dt; if (t.left <= 0) dropToast(t); }
  }
