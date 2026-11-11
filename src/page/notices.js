// @sys page/notices: toasts for notable events (VB-098), read from the record through Sim.notable, and the list that turns each kind on or off
  // ---- notifications ----
  // A toast for each notable event the record gains: at the top centre, under the top bar (VB-324), for 6 s, at most 3 at once (a fourth replaces
  // the oldest). Events of one kind in one village on one game day share a toast while it is up ("3 births in Ulsäter"), which is what
  // happens at high speed. Which kinds show is the page's choice, kept in localStorage and never in st.
  const TOAST_SECONDS = 6, TOAST_MAX = 3, NOTICE_KEY = 'vb.notices.off';
  const MANY = { born: 'births', died: 'deaths', married: 'marriages', empty: 'farms left empty', claim: 'farms claimed', cottage: 'new cottages',
    left: 'parties setting out for new land', custom: 'changes of custom', split: 'partings of custom' };
  const noticeOff = new Set();
  try { for (const k of JSON.parse(localStorage.getItem(NOTICE_KEY) || '[]')) if (Sim.NOTABLE[k]) noticeOff.add(k); } catch (e) { noticeOff.clear(); }
  $('noticeList').innerHTML = Object.entries(Sim.NOTABLE).map(([k, label]) =>
    `<label class="dchk"><input type="checkbox" data-notice="${k}"${noticeOff.has(k) ? '' : ' checked'}> ${esc(label)}</label>`).join('');
  // The list is the bell's, in the map's bar under the minimap (VB-324): it opens over the minimap, and shuts on a press elsewhere or Esc.
  function closeNotices() { $('noticePop').hidden = true; $('noticeBtn').setAttribute('aria-expanded', 'false'); }
  $('noticeBtn').addEventListener('click', () => {
    const open = $('noticePop').hidden; $('noticePop').hidden = !open; $('noticeBtn').setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('pointerdown', (e) => { if (!$('mapTools').contains(e.target)) closeNotices(); });
  $('noticeList').addEventListener('change', (e) => {
    const k = e.target.dataset.notice; if (!k) return;
    if (e.target.checked) noticeOff.delete(k); else noticeOff.add(k);
    try { localStorage.setItem(NOTICE_KEY, JSON.stringify([...noticeOff])); } catch (err) { return; } // no storage: the choice lasts the visit
  });
  // The toasts stand just under the top bar, however tall a narrow screen's date makes it (VB-324): its bottom edge, as a CSS length.
  const barBottom = () => document.documentElement.style.setProperty('--bar-bottom', `${Math.round($('clock').getBoundingClientRect().bottom)}px`);
  if (window.ResizeObserver) new ResizeObserver(barBottom).observe($('clock'));
  window.addEventListener('resize', barBottom); barBottom();
  let noticeSt = null, noticeSeen = 0, noticeAbout = -1, toasts = [];
  function dropToast(t) { toasts = toasts.filter((x) => x !== t); t.el.remove(); }
  // What a click on a toast selects, as a link in a card does (page/cards): the newborn or the groom, the farm where it happened, else the village.
  function noticeTarget(ev) {
    if ((ev.kind === 'born' || ev.kind === 'married') && ev.pawn !== undefined) return { pawn: ev.pawn };
    if (ev.kind === 'offered' && st.player) return { play: true };
    if (ev.farm !== undefined) return { farm: ev.farm };
    if (ev.village !== undefined) return { village: ev.village };
    return ev.pawn !== undefined ? { pawn: ev.pawn } : null;
  }
  function openNotice(t) {
    const g = t.target; if (!g || st !== noticeSt) return;
    if (g.play) { if (st.player) { focusPawn(st.player.pawn); openPanel('actions'); } }
    else if (g.pawn !== undefined) focusPawn(g.pawn);
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
  // The marriage offers that wait for the played pawn (VB-273): when one has gone from st.offers, how it ended is told in the pawn panel, from the
  // record's event of its ending (married, matchRefused, offerLapsed), until the next offer or the next moving round. Page state, never st.
  let offerSt = null, offerSeen = new Map(), offerEnd = null;
  function watchOffers() {
    if (offerSt !== st) { offerSt = st; offerSeen = new Map(); offerEnd = null; }
    const pl = st.player;
    if (!pl) { offerSeen.clear(); offerEnd = null; return; }
    const open = new Set();
    for (const o of st.offers) {
      if (!o.answers.some((a) => a.by === pl.pawn)) continue;
      open.add(o.id);
      if (!offerSeen.has(o.id)) { offerSeen.set(o.id, { man: o.man, woman: o.woman, made: o.made }); offerEnd = null; }
    }
    for (const [oid, o] of [...offerSeen]) {
      if (open.has(oid)) continue;
      offerSeen.delete(oid);
      for (let i = st.record.length - 1; i >= 0 && st.record[i].t >= o.made; i--) {
        const ev = st.record[i];
        if (ev.pawn === o.man && ev.other === o.woman && (ev.kind === 'married' || ev.kind === 'matchRefused' || ev.kind === 'offerLapsed')) {
          offerEnd = { pawn: pl.pawn, text: Sim.eventLine(st, ev), until: Sim.skipFrom(st).eve };
          break;
        }
      }
    }
  }
  function updateNotices(dt) {
    watchOffers();
    if (st !== noticeSt) { noticeSt = st; noticeSeen = st.record.length; noticeAbout = -1; for (const t of [...toasts]) dropToast(t); }
    const pinned = selectionPinned && selPawn >= 0 ? selPawn : -1, about = pinned >= 0 ? pinned : noticeAbout;
    noticeAbout = pinned;
    if (skipping) noticeSeen = st.record.length; // a debug skip passes its years untold
    for (; noticeSeen < st.record.length; noticeSeen++) {
      const ev = st.record[noticeSeen], why = Sim.notable(st, ev, about >= 0 ? about : null);
      if (why && why.some((k) => !noticeOff.has(k))) toast(ev);
      else if (ev.kind === 'offered' && st.player && st.offers.some((o) => o.man === ev.pawn && o.woman === ev.other
        && o.answers.some((a) => a.by === st.player.pawn))) toast(ev); // a match waits for the played pawn's answer (VB-273)
    }
    for (const t of [...toasts]) { t.left -= dt; if (t.left <= 0) dropToast(t); }
  }
