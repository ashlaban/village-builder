// @sys page/family: family records: the family tree, as one person's line, the path between two people, or everyone
  // The links of a line view, from the people it shows: a marriage between two shown spouses, and each child under the parents shown above it.
  function drawLineLinks(L, links) {
    const groups = new Map(), wed = new Map(), key = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`), drawn = new Map();
    for (const [id, q] of L.pos) {
      const p = st.pawns[id], ps = [p.father, p.mother].filter((x) => x !== null && L.pos.has(x) && L.pos.get(x).y < q.y);
      if (!ps.length) continue;
      const k = ps.join(','); if (!groups.has(k)) groups.set(k, { ps, kids: [] });
      groups.get(k).kids.push(q);
    }
    for (const [a, b] of L.pairs) wed.set(key(a, b), [a, b]);
    for (const { ps } of groups.values()) if (ps.length === 2 && L.pos.get(ps[0]).y === L.pos.get(ps[1]).y) wed.set(key(ps[0], ps[1]), ps);
    for (const [k, [ia, ib]] of wed) {
      const a = L.pos.get(ia), b = L.pos.get(ib), [l, r] = a.x < b.x ? [a, b] : [b, a], y = l.y + NODE_H / 2, x1 = l.x + NODE_W, x2 = r.x, mx = (x1 + x2) / 2;
      // a spouse placed beside is linked only when nobody stands between the two
      if (x2 - x1 > GAP + 1 && (L.partner.has(ia) || L.partner.has(ib))) continue;
      const us = (L.byPawn.get(ia) || []).filter((u) => u.a === ib || u.b === ib), u = us[us.length - 1];
      el('line', { x1, y1: y, x2, y2: y, class: 'marriage' + (u && u.end !== null ? ' ended' : '') }, links);
      el('circle', { cx: mx - 2.5, cy: y, r: 4, class: 'ring' }, links); el('circle', { cx: mx + 2.5, cy: y, r: 4, class: 'ring' }, links);
      drawn.set(k, [mx, y + 4]);
    }
    for (const { ps, kids } of groups.values()) {
      const one = L.pos.get(ps.find((x) => L.partner.has(x)) ?? ps[0]);
      const [ox, oy] = (ps.length === 2 && drawn.get(key(ps[0], ps[1]))) || [one.x + NODE_W / 2, one.y + NODE_H];
      const bar = Math.min(...kids.map((q) => q.y)) - (ROW_H - NODE_H) / 2, xs = kids.map((q) => q.x + NODE_W / 2);
      el('path', { d: `M${ox},${oy} V${bar} M${Math.min(ox, ...xs)},${bar} H${Math.max(ox, ...xs)} ` + kids.map((q) =>
        `M${q.x + NODE_W / 2},${bar} V${q.y}`).join(' '), class: 'descent' }, links);
    }
  }
  // what the tree shows: the mode, the person whose line it is, how far up and down, and which chips are open
  let treeSel = -1, treeMode = 'line', treeFocus = -1, treeUp = 2, treeDown = 1, treeCounts = '', treeOther = -1, treePick = false;
  const treeOpen = new Set();
  const lineMode = () => treeMode !== 'all' && treeFocus >= 0 && !!st.pawns[treeFocus] && (treeMode !== 'path' || (treeOther >= 0 && !!st.pawns[treeOther]));
  const refocusTree = (id) => {
    if (treeMode === 'path') treeMode = 'line'; treeFocus = id; treeUp = 2; treeDown = treeMode === 'desc' ? 3 : 1; treeOpen.clear(); };
  const yearStr = (y) => (y < 0 ? `\u2212${-y}` : String(y));
  const deathYear = (p) => Math.floor(p.died / Sim.YEAR) + 1;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  function renderTree() {
    const svg = $('treeSvg'), line = lineMode(); svg.textContent = '';
    const P = line && treeMode === 'path' ? findPath(st, treeFocus, treeOther) : null, cap = $('treeCaption');
    const L = P ? layoutPath(st, P) : line && treeMode === 'path' ? { ...layoutPath(st, { ids: [treeFocus], steps: [] }), none: true }
      : line ? layoutLine(st, treeFocus, treeMode, treeMode === 'line' ? treeUp : 0, treeDown, treeOpen) : layoutTree(st);
    cap.textContent = treePick ? (treeSel >= 0 ? `Choose the second person, to see how they are related to ${Sim.fullName(st.pawns[treeSel])}.` :
      'Choose the first person.') : P ? relationWords(st, P) : L.none ?
      `The records do not join ${Sim.fullName(st.pawns[treeFocus])} and ${Sim.fullName(st.pawns[treeOther])}.` : '';
    cap.hidden = !cap.textContent;
    const { pos, width, height } = L, pad = 24;
    svg.setAttribute('viewBox', `${-pad} ${-pad} ${width + pad * 2} ${height + pad * 2}`);
    svg.setAttribute('width', width + pad * 2); svg.setAttribute('height', height + pad * 2);
    for (const b of $('treeModes').querySelectorAll('button')) b.setAttribute('aria-pressed',
      String(b.dataset.mode === 'path' ? treePick || (line && treeMode === 'path') : b.dataset.mode === (line ? treeMode : 'all')));
    $('treeSub').textContent = `${treeCounts}, ${line ? `${pos.size} shown` : `${L.rows.length} ${L.rows.length === 1 ? 'generation' : 'generations'}`}`;
    const heirSet = new Set(st.households.filter((h) => !h.dissolved).map((h) => Sim.heirRanking(st, h)[0]).filter((x) => x !== undefined));
    const links = el('g', { class: 'links' }, svg);
    if (line) drawLineLinks(L, links);
    else for (const u of st.unions) {
      const a = pos.get(u.a), b = pos.get(u.b);
      if (!a || !b || a.gen !== b.gen) continue;
      const [l, r] = a.x < b.x ? [a, b] : [b, a], y = l.y + NODE_H / 2, x1 = l.x + NODE_W, x2 = r.x, mx = (x1 + x2) / 2;
      el('line', { x1, y1: y, x2, y2: y, class: 'marriage' + (u.end !== null ? ' ended' : '') }, links);
      el('circle', { cx: mx - 2.5, cy: y, r: 4, class: 'ring' }, links); el('circle', { cx: mx + 2.5, cy: y, r: 4, class: 'ring' }, links);
      const kids = st.pawns.filter((p) => (p.father === u.a && p.mother === u.b) || (p.father === u.b && p.mother === u.a)).map((p) => pos.get(p.id));
      if (kids.length) {
        const ky = Math.min(...kids.map((q) => q.y)), bar = ky - (ROW_H - NODE_H) / 2, xs = kids.map((q) => q.x + NODE_W / 2);
        el('path', { d: `M${mx},${y + 4} V${bar} M${Math.min(mx, ...xs)},${bar} H${Math.max(mx, ...xs)} ` + kids.map((q) =>
          `M${q.x + NODE_W / 2},${bar} V${q.y}`).join(' '), class: 'descent' }, links);
      }
    }
    for (const [id, q] of pos) {
      const p = st.pawns[id], f = farmOf(p), dead = p.died !== null;
      const g = el('g', {
        class: `tn ${p.sex}${p.id === treeSel ? ' sel' : ''}${dead ? ' dead' : ''}${line &&
          (p.id === treeFocus || (treeMode === 'path' && p.id === treeOther)) ? ' focus' : ''}`,
        transform: `translate(${q.x},${q.y})`, tabindex: '0', role: 'button',
        'data-pawn': p.id, 'aria-label': `${Sim.fullName(p)}${dead ? ', died' : ''}` }, svg);
      el('rect', { width: NODE_W, height: NODE_H, rx: 10 }, g);
      const t1 = el('text', { x: 14, y: 22, class: 'n' }, g); t1.textContent = Sim.fullName(p);
      const t2 = el('text', { x: 14, y: 40, class: 's' }, g);
      t2.textContent = dead ? `${yearStr(Sim.birthYear(p))} to ${yearStr(deathYear(p))}, aged ${Math.floor((p.died - p.born) / Sim.YEAR)}` :
        `${Sim.ROLES[p.role] ? (p.role === 'farmer' && p.sex === 'f' ? (isWidow(p) ? 'Widow' : 'Holder') : Sim.ROLES[p.role].title) : p.role}, ${p.age}`;
      const t3 = el('text', { x: 14, y: 56, class: 's' }, g);
      t3.textContent = dead ? (f ? `Lived at ${f.name}` : 'Before the landing') : heirSet.has(p.id) ? `Heir to ${heirTo(p.id).map((x) =>
        x.name).join(', ')}` : f ? f.name : '';
      if (heirSet.has(p.id) && !dead) el('circle', { cx: NODE_W - 14, cy: 14, r: 4.5, class: 'heir' }, g);
      // children the view does not show
      if (line && L.more.has(id)) {
        const t = el('text', { x: NODE_W - 10, y: 56, class: 's more', 'text-anchor': 'end' }, g), n = L.more.get(id);
        t.textContent = `+${n}`; el('title', {}, t).textContent = `${n} ${n === 1 ? 'child' : 'children'} not shown`;
      }
    }
    if (!line) return;
    for (const c of L.chips) {
      const g = el('g', {
        class: 'chip', transform: `translate(${c.x},${c.y})`, tabindex: '0', role: 'button', 'data-chip': c.key, 'aria-label': c.label }, svg);
      el('rect', { width: CHIP_W, height: CHIP_H, rx: CHIP_H / 2 }, g);
      el('text', { x: CHIP_W / 2, y: 20, class: 's', 'text-anchor': 'middle' }, g).textContent = c.label;
    }
    for (const n of L.notes) el('text', { x: n.x, y: n.y, class: 's' }, svg).textContent = n.text;
  }
  // brings the person the line is of into the middle of the scrolled view
  function centreTree() {
    const box = $('treeSvg').parentNode, node = $('treeSvg').querySelector(`[data-pawn="${treeFocus}"]`);
    if (!node || !lineMode()) return;
    const [x, y] = node.getAttribute('transform').match(/-?[\d.]+/g).map(Number);
    box.scrollLeft = x + 24 + NODE_W / 2 - box.clientWidth / 2; box.scrollTop = y + 24 + NODE_H / 2 - box.clientHeight / 2;
  }
  // opening or folding a chip keeps it where it was on the screen, so the people it opens appear beside it
  function pickTreeChip(key) {
    const box = $('treeSvg').parentNode, find = () => $('treeSvg').querySelector(`[data-chip="${key}"]`), was = find().getBoundingClientRect();
    if (key === 'up') treeUp += 2; else if (key === 'down') treeDown += 1; else if (!treeOpen.delete(key)) treeOpen.add(key);
    renderTree();
    const c = find(); if (!c) { centreTree(); return; }
    const now = c.getBoundingClientRect(); box.scrollLeft += now.left - was.left; box.scrollTop += now.top - was.top; c.focus({ preventScroll: true });
  }
  // choosing a person selects them; one the line view does not show, or the selected one again, becomes the person the line is of
  function pickTreePerson(id, second) {
    // the path runs from the selected person to the one chosen next
    const first = treeSel >= 0 ? treeSel : treeFocus;
    if ((treePick || second) && first >= 0 && st.pawns[first] && id !== first) {
      treePick = false; treeFocus = first; treeOther = id; treeMode = 'path'; treeSel = id; renderTree(); renderTreeInfo(); centreTree(); focusTreePerson();
        return;
    }
    const shown = !!$('treeSvg').querySelector(`[data-pawn="${id}"]`);
    const moved = treeMode === 'path' ? !shown : treeMode !== 'all' && (!lineMode() || id === treeSel || !shown);
    if (moved) refocusTree(id);
    treeSel = id; renderTree(); renderTreeInfo(); if (moved) centreTree(); focusTreePerson();
  }
  function renderTreeInfo() {
    const box = $('treeInfo');
    if (treeSel < 0) { box.innerHTML = '<p class="hint">Choose a person to see their line. Heirs are marked with a dot; the dead are greyed.</p>'; return; }
    const p = st.pawns[treeSel], f = farmOf(p), v = f ? st.villages[f.village].name : null, dead = p.died !== null;
    const sp = Sim.spouseOf(st, p.id), kids = Sim.childrenOf(st, p.id), sibs = Sim.siblingsOf(st, p.id);
    const nm = (id) => `<button type="button" data-pawn="${id}">${esc(Sim.fullName(st.pawns[id]))}</button>`;
    const kin = sp !== null ? Sim.kinship(st, p.id, sp) : null;
    const spouses = st.unions.filter((u) => u.a === p.id || u.b === p.id).map((u) => (u.a === p.id ? u.b : u.a));
    const evs = Sim.recordOf(st, { pawn: p.id, life: true }).filter((e) => e.text).slice(-8).reverse().map((e) =>
      `<li>Year ${yearStr(Math.floor(e.t / Sim.YEAR) + 1)}: ${esc(e.text)}</li>`).join('');
    box.innerHTML = `<h3>${esc(Sim.fullName(p))}</h3>
      <p>${dead ? `Lived from year ${yearStr(Sim.birthYear(p))} to ${yearStr(deathYear(p))}.` :
        `${esc(roleLine(p))}, ${p.age}. Born in year ${yearStr(Sim.birthYear(p))}${p.born < 0 ? ', before the landing' : ''}.`}</p>
      ${f ? `<p>${dead ? 'Lived' : 'Lives'} at ${esc(f.name)}${v ? ` in ${esc(v)}` : ''}.</p>` : ''}
      <dl>
        <dt>Father</dt><dd>${p.father !== null ? nm(p.father) : `${esc(p.fatherName)}, known only from the patronymic`}</dd>
        <dt>Mother</dt><dd>${p.mother !== null ? nm(p.mother) : 'Not on record'}</dd>
        <dt>${dead ? 'Married' : 'Spouse'}</dt><dd>${sp !== null ? `${nm(sp)}, ${kin > 0 ? `kinship coefficient ${kin.toFixed(4)}` : 'not related by blood'}` :
          spouses.length ? spouses.map(nm).join(', ') + (dead ? '' : ' (widowed)') : 'Unmarried'}</dd>
        <dt>Children</dt><dd>${kids.length ? kids.map(nm).join(', ') : 'None'}</dd>
        <dt>Siblings</dt><dd>${sibs.length ? sibs.map(nm).join(', ') : p.father === null && p.mother === null ? 'Not on record' : 'None'}</dd>
      </dl>
      ${evs ? `<ul class="evs">${evs}</ul>` : ''}
      ${lineMode() && treeMode !== 'path' &&
        treeSel !== treeFocus ? `<p><button type="button" id="treeCentre">Show the line of ${esc(p.given)}</button></p>` : ''}
      ${dead ? '' : '<button type="button" class="primary" id="treeShow">Show on the map</button>'}`;
  }
  function openTree() {
    if (!st) return;
    openPanel(null);
    $('tree').hidden = false;
    for (const el of document.querySelectorAll('.hud, .navigation, .sheet, #uiToggle')) el.inert = true;
    // up to two villages are named; more are the island's records, by its name
    $('treeTitle').textContent = `Family records of ${st.villages.length > 2 ? w.name : st.villages.map((v) => v.name).join(' and ')}`;
    const living = st.pawns.filter((p) => p.died === null).length;
    treeCounts = `${living} living, ${st.pawns.length - living} dead, ${st.unions.length} marriages`;
    // it opens on a line, never on everyone: the selected person's, else the played pawn's (Everyone is a mode to choose)
    if (treeSel < 0) treeSel = selPawn >= 0 ? selPawn : played();
    treePick = false; if (treeSel !== treeFocus && (treeMode !== 'path' || treeSel !== treeOther)) refocusTree(treeSel);
    renderTree(); renderTreeInfo(); centreTree(); $('treeClose').focus();
  }
  const closeTree = () => {
    $('tree').hidden = true;
    for (const el of document.querySelectorAll('.hud, .navigation, .sheet, #uiToggle')) el.inert = false;
    closeSpeedOptions(); $('minimap').inert = $('minimapBtn').getAttribute('aria-pressed') !== 'true';
    $('treeBtn').focus();
  };
  $('treeBtn').addEventListener('click', openTree);
  $('treeClose').addEventListener('click', closeTree);
  $('tree').addEventListener('click', (e) => {
    if (e.target === $('tree')) { closeTree(); return; }
    if (e.target.id === 'treeShow') { closeTree(); focusPawn(treeSel); return; }
    if (e.target.id === 'treeCentre') { pickTreePerson(treeSel); return; }
    const m = e.target.closest('[data-mode]'), c = e.target.closest('[data-chip]'), n = e.target.closest('[data-pawn]');
    if (m) {
      // Path asks for the second person, and keeps what is shown until they are chosen; another mode leaves the choosing as it is
      if (m.dataset.mode === 'path') treePick = !treePick;
      else { treeMode = m.dataset.mode; if (treeSel >= 0) refocusTree(treeSel); }
      renderTree(); renderTreeInfo(); centreTree();
    } else if (c) pickTreeChip(c.dataset.chip);
    else if (n) pickTreePerson(+n.dataset.pawn, e.shiftKey);
  });
  const focusTreePerson = () => { const node = $('treeSvg').querySelector(`[data-pawn="${treeSel}"]`); if (node) node.focus(); };
  $('tree').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeTree(); return; }
    if (e.key === 'Tab') {
      const focusable = [...$('tree').querySelectorAll('button, [tabindex="0"]')].filter((el) => !el.hidden && el.getClientRects().length);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    const n = e.target.closest && e.target.closest('g[data-pawn], g[data-chip]');
    if (n && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault(); if (n.dataset.chip) pickTreeChip(n.dataset.chip); else pickTreePerson(+n.dataset.pawn, e.shiftKey);
    }
  });

