// @sys page/family: family records: the family tree, as a scope's people, one person's line, the path between two people, or everyone
// The links of a tree, from the people it shows: a marriage between two shown spouses, and each child under the parents shown above it.
// Each link carries its box, so that only those near the visible window are drawn (VB-095).
function treeLinks(L) {
  const groups = new Map(),
    wed = new Map(),
    key = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`),
    drawn = new Map(),
    out = [];
  for (const [id, q] of L.pos) {
    const p = st.pawns[id],
      ps = [p.father, p.mother].filter((x) => x !== null && L.pos.has(x) && L.pos.get(x).y < q.y);
    if (!ps.length) continue;
    const k = ps.join(',');
    if (!groups.has(k)) groups.set(k, { ps, kids: [] });
    groups.get(k).kids.push(q);
  }
  for (const [a, b] of L.pairs) wed.set(key(a, b), [a, b]);
  for (const { ps } of groups.values())
    if (ps.length === 2 && L.pos.get(ps[0]).y === L.pos.get(ps[1]).y) wed.set(key(ps[0], ps[1]), ps);
  for (const [k, [ia, ib]] of wed) {
    const a = L.pos.get(ia),
      b = L.pos.get(ib),
      [l, r] = a.x < b.x ? [a, b] : [b, a],
      y = l.y + NODE_H / 2,
      x1 = l.x + NODE_W,
      x2 = r.x,
      mx = (x1 + x2) / 2;
    // a spouse placed beside is linked only when nobody stands between the two
    if (x2 - x1 > GAP + 1 && (L.partner.has(ia) || L.partner.has(ib))) continue;
    // ended: the two are no longer each other's spouse (sim/records' index)
    const ended = Sim.spouseOf(st, ia) !== ib;
    out.push({
      box: [Math.min(x1, x2), y - 5, Math.max(x1, x2), y + 5],
      draw: (links) => {
        el('line', { x1, y1: y, x2, y2: y, class: 'marriage' + (ended ? ' ended' : '') }, links);
        el('circle', { cx: mx - 2.5, cy: y, r: 4, class: 'ring' }, links);
        el('circle', { cx: mx + 2.5, cy: y, r: 4, class: 'ring' }, links);
      },
    });
    drawn.set(k, [mx, y + 4]);
  }
  for (const { ps, kids } of groups.values()) {
    const one = L.pos.get(ps.find((x) => L.partner.has(x)) ?? ps[0]);
    const [ox, oy] = (ps.length === 2 && drawn.get(key(ps[0], ps[1]))) || [one.x + NODE_W / 2, one.y + NODE_H];
    const bar = Math.min(...kids.map((q) => q.y)) - (ROW_H - NODE_H) / 2,
      xs = kids.map((q) => q.x + NODE_W / 2);
    out.push({
      box: [Math.min(ox, ...xs), oy, Math.max(ox, ...xs), Math.max(...kids.map((q) => q.y))],
      draw: (links) =>
        el(
          'path',
          {
            d:
              `M${ox},${oy} V${bar} M${Math.min(ox, ...xs)},${bar} H${Math.max(ox, ...xs)} ` +
              kids.map((q) => `M${q.x + NODE_W / 2},${bar} V${q.y}`).join(' '),
            class: 'descent',
          },
          links,
        ),
    });
  }
  return out;
}
// what the tree shows: the mode, the person whose line or scope it is, how far up and down, and which chips are open; it opens on the
// selected person's village (Kim, 12 Nov: QUESTION_ARCHIVE, VB-095)
let treeSel = -1,
  treeMode = 'village',
  treeFocus = -1,
  treeUp = 2,
  treeDown = 1,
  treeCounts = '',
  treeOther = -1,
  treePick = false;
const treeOpen = new Set();
// the layout shown, its links and heirs, and the window last drawn (null: everything)
let treeL = null,
  treeLinkList = [],
  treeHeirs = new Set(),
  treeDrawn = null,
  treeFocused = false; // the view is of one person (a line, a path or a scope), who is marked and centred
const lineMode = () =>
  treeMode !== 'all' &&
  !TREE_SCOPES.includes(treeMode) &&
  treeFocus >= 0 &&
  !!st.pawns[treeFocus] &&
  (treeMode !== 'path' || (treeOther >= 0 && !!st.pawns[treeOther]));
const scopeMode = () => TREE_SCOPES.includes(treeMode) && treeFocus >= 0 && !!st.pawns[treeFocus];
const refocusTree = (id) => {
  if (treeMode === 'path') treeMode = 'line';
  treeFocus = id;
  treeUp = 2;
  treeDown = treeMode === 'desc' ? 3 : 1;
  treeOpen.clear();
};
const yearStr = (y) => (y < 0 ? `−${-y}` : String(y));
const deathYear = (p) => Math.floor(p.died / Sim.YEAR) + 1;
const SVGNS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs, parent) => {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
};
const TREE_PAD = 24,
  TREE_MARGIN = 600;
// Lays the tree out for what it shows, and draws the part of it in view.
function renderTree() {
  const svg = $('treeSvg'),
    line = lineMode(),
    scope = !line && scopeMode();
  const P = line && treeMode === 'path' ? findPath(st, treeFocus, treeOther) : null,
    cap = $('treeCaption');
  const L = P
    ? layoutPath(st, P)
    : line && treeMode === 'path'
      ? { ...layoutPath(st, { ids: [treeFocus], steps: [] }), none: true }
      : line
        ? layoutLine(st, treeFocus, treeMode, treeMode === 'line' ? treeUp : 0, treeDown, treeOpen)
        : scope
          ? layoutScope(st, treeFocus, treeMode, treeUp, treeDown, treeOpen)
          : { ...layoutTree(st), notes: [], partner: new Set(), more: new Map() };
  cap.textContent = treePick
    ? treeSel >= 0
      ? `Choose the second person, to see how they are related to ${Sim.fullName(st.pawns[treeSel])}.`
      : 'Choose the first person.'
    : P
      ? relationWords(st, P)
      : L.none
        ? `The records do not join ${Sim.fullName(st.pawns[treeFocus])} and ${Sim.fullName(st.pawns[treeOther])}.`
        : '';
  cap.hidden = !cap.textContent;
  const { pos, width, height } = L,
    pad = TREE_PAD;
  svg.setAttribute('viewBox', `${-pad} ${-pad} ${width + pad * 2} ${height + pad * 2}`);
  svg.setAttribute('width', width + pad * 2);
  svg.setAttribute('height', height + pad * 2);
  for (const b of $('treeModes').querySelectorAll('button'))
    b.setAttribute(
      'aria-selected',
      String(
        b.dataset.mode === 'path'
          ? treePick || (line && treeMode === 'path')
          : b.dataset.mode === (line || scope ? treeMode : 'all'),
      ),
    );
  $('treeSub').textContent = `${treeCounts}, ${
    line
      ? `${pos.size} shown`
      : scope
        ? `${pos.size} shown, ${L.core} living in the ${treeMode}`
        : `${L.rows.length} ${L.rows.length === 1 ? 'generation' : 'generations'}`
  }`;
  treeHeirs = new Set(
    st.households
      .filter((h) => !h.dissolved)
      .map((h) => Sim.heirRanking(st, h)[0])
      .filter((x) => x !== undefined),
  );
  treeL = L;
  treeLinkList = treeLinks(L);
  treeFocused = line || scope;
  drawTree();
}
// The window of the tree in view, in its own coordinates, with a margin around it; null where the page has no layout (a test's), and
// everything is drawn.
function treeWindow() {
  const box = $('treeSvg').parentNode;
  if (!box.clientWidth || !box.clientHeight) return null;
  const x = box.scrollLeft - TREE_PAD,
    y = box.scrollTop - TREE_PAD;
  return [x - TREE_MARGIN, y - TREE_MARGIN, x + box.clientWidth + TREE_MARGIN, y + box.clientHeight + TREE_MARGIN];
}
// Draws the people, chips and links of the laid-out tree that fall within the window; the one with the keyboard's focus keeps it.
function drawTree() {
  const svg = $('treeSvg'),
    L = treeL;
  if (!L) return;
  const win = treeWindow(),
    vis = (x0, y0, x1, y1) => !win || (x1 >= win[0] && x0 <= win[2] && y1 >= win[1] && y0 <= win[3]),
    had = document.activeElement && svg.contains(document.activeElement) ? document.activeElement : null,
    sel =
      had &&
      (had.dataset.pawn !== undefined ? `[data-pawn="${had.dataset.pawn}"]` : `[data-chip="${had.dataset.chip}"]`);
  treeDrawn = win;
  svg.textContent = '';
  const links = el('g', { class: 'links' }, svg);
  for (const k of treeLinkList) if (vis(...k.box)) k.draw(links);
  for (const [id, q] of L.pos) if (vis(q.x, q.y, q.x + NODE_W, q.y + NODE_H)) drawTreePerson(svg, L, id, q);
  for (const c of L.chips) {
    if (!vis(c.x, c.y, c.x + CHIP_W, c.y + CHIP_H)) continue;
    const g = el(
      'g',
      {
        class: 'chip',
        transform: `translate(${c.x},${c.y})`,
        tabindex: '0',
        role: 'button',
        'data-chip': c.key,
        'aria-label': c.label,
      },
      svg,
    );
    el('rect', { width: CHIP_W, height: CHIP_H, rx: CHIP_H / 2 }, g);
    el('text', { x: CHIP_W / 2, y: 20, class: 's', 'text-anchor': 'middle' }, g).textContent = c.label;
  }
  for (const n of L.notes) el('text', { x: n.x, y: n.y, class: 's' }, svg).textContent = n.text;
  const back = sel && svg.querySelector(sel);
  if (back) back.focus({ preventScroll: true });
}
function drawTreePerson(svg, L, id, q) {
  const p = st.pawns[id],
    f = farmOf(p),
    dead = p.died !== null,
    heir = treeHeirs.has(p.id);
  const g = el(
    'g',
    {
      class: `tn ${p.sex}${p.id === treeSel ? ' sel' : ''}${dead ? ' dead' : ''}${
        treeFocused && (p.id === treeFocus || (treeMode === 'path' && p.id === treeOther)) ? ' focus' : ''
      }`,
      transform: `translate(${q.x},${q.y})`,
      tabindex: '0',
      role: 'button',
      'data-pawn': p.id,
      'aria-label': `${Sim.fullName(p)}${dead ? ', died' : ''}`,
    },
    svg,
  );
  el('rect', { width: NODE_W, height: NODE_H, rx: 10 }, g);
  const t1 = el('text', { x: 14, y: 22, class: 'n' }, g);
  t1.textContent = Sim.fullName(p);
  const t2 = el('text', { x: 14, y: 40, class: 's' }, g);
  t2.textContent = dead
    ? `${yearStr(Sim.birthYear(p))} to ${yearStr(deathYear(p))}, aged ${Math.floor((p.died - p.born) / Sim.YEAR)}`
    : `${Sim.ROLES[p.role] ? (p.role === 'farmer' && p.sex === 'f' ? (isWidow(p) ? 'Widow' : 'Holder') : Sim.ROLES[p.role].title) : p.role}, ${p.age}`;
  const t3 = el('text', { x: 14, y: 56, class: 's' }, g);
  t3.textContent = dead
    ? f
      ? `Lived at ${f.name}`
      : 'Before the landing'
    : heir
      ? `Heir to ${heirTo(p.id)
          .map((x) => x.name)
          .join(', ')}`
      : f
        ? f.name
        : '';
  if (heir && !dead) {
    // the key, as the cards' chips carry it (VB-671: one mark for an heir)
    const key = el('g', { transform: `translate(${NODE_W - 22} 6)`, class: 'heir' }, g);
    key.innerHTML = goodIcon('heir');
    el('title', {}, key).textContent = 'Heir';
  }
  // children the view does not show
  if (L.more.has(id)) {
    const t = el('text', { x: NODE_W - 10, y: 56, class: 's more', 'text-anchor': 'end' }, g),
      n = L.more.get(id);
    t.textContent = `+${n}`;
    el('title', {}, t).textContent = `${n} ${n === 1 ? 'child' : 'children'} not shown`;
  }
}
// panning draws what comes into view once the window has moved by half its margin, or the view has changed size
$('treeSvg').parentNode.addEventListener('scroll', () => {
  const w = treeWindow();
  if (!treeL || !w) return;
  const d = treeDrawn;
  if (
    d &&
    Math.abs(w[0] - d[0]) < TREE_MARGIN / 2 &&
    Math.abs(w[1] - d[1]) < TREE_MARGIN / 2 &&
    w[2] - w[0] === d[2] - d[0] &&
    w[3] - w[1] === d[3] - d[1]
  )
    return;
  drawTree();
});
// brings the person the line or scope is of into the middle of the scrolled view
function centreTree() {
  const box = $('treeSvg').parentNode,
    q = treeL && treeFocused && treeL.pos.get(treeFocus);
  if (q) {
    box.scrollLeft = q.x + TREE_PAD + NODE_W / 2 - box.clientWidth / 2;
    box.scrollTop = q.y + TREE_PAD + NODE_H / 2 - box.clientHeight / 2;
  }
  drawTree();
}
// opening or folding a chip keeps it where it was on the screen, so the people it opens appear beside it; a "+ n more" chip, gone once
// open, keeps the person whose children it opened in place instead
function pickTreeChip(key) {
  const box = $('treeSvg').parentNode,
    kids = /^kids:(\d+)$/.exec(key),
    anchor = (L) => L.chips.find((c) => c.key === key) || (kids && L.pos.get(+kids[1])),
    was = anchor(treeL);
  if (key === 'up') treeUp += 2;
  else if (key === 'down') treeDown += 1;
  else if (!treeOpen.delete(key)) treeOpen.add(key);
  renderTree();
  const now = anchor(treeL);
  if (!now || !was) {
    centreTree();
    return;
  }
  box.scrollLeft += now.x - was.x;
  box.scrollTop += now.y - was.y;
  drawTree();
  const c = $('treeSvg').querySelector(
    kids && !treeL.chips.some((x) => x.key === key) ? `[data-pawn="${kids[1]}"]` : `[data-chip="${key}"]`,
  );
  if (c) c.focus({ preventScroll: true });
}
// choosing a person selects them; one the view does not show, or the selected one again, becomes the person the line or scope is of
function pickTreePerson(id, second) {
  // the path runs from the selected person to the one chosen next
  const first = treeSel >= 0 ? treeSel : treeFocus;
  if ((treePick || second) && first >= 0 && st.pawns[first] && id !== first) {
    treePick = false;
    treeFocus = first;
    treeOther = id;
    treeMode = 'path';
    treeSel = id;
    renderTree();
    renderTreeInfo();
    centreTree();
    focusTreePerson();
    return;
  }
  const shown = !!treeL && treeL.pos.has(id);
  const moved =
    treeMode === 'path' ? !shown : treeMode !== 'all' && ((!lineMode() && !scopeMode()) || id === treeSel || !shown);
  if (moved) refocusTree(id);
  treeSel = id;
  renderTree();
  renderTreeInfo();
  if (moved) centreTree();
  focusTreePerson();
}
function renderTreeInfo() {
  const box = $('treeInfo');
  if (treeSel < 0) {
    box.innerHTML =
      '<p class="hint">Choose a person to see their line. Heirs are marked with a key; the dead are greyed.</p>';
    return;
  }
  const p = st.pawns[treeSel],
    f = farmOf(p),
    v = f ? st.villages[f.village].name : null,
    dead = p.died !== null;
  const sp = Sim.spouseOf(st, p.id),
    kids = Sim.childrenOf(st, p.id),
    sibs = Sim.siblingsOf(st, p.id);
  const nm = (id) => `<button type="button" data-pawn="${id}">${esc(Sim.fullName(st.pawns[id]))}</button>`;
  const kin = sp !== null ? Sim.kinship(st, p.id, sp) : null;
  const spouses = Sim.spousesOf(st, p.id);
  const evs = Sim.recordOf(st, { pawn: p.id, life: true })
    .filter((e) => e.text)
    .slice(-8)
    .reverse()
    .map((e) => `<li>Year ${yearStr(Math.floor(e.t / Sim.YEAR) + 1)}: ${esc(e.text)}</li>`)
    .join('');
  box.innerHTML = `<h3 class="head">${esc(Sim.fullName(p))}</h3>
      <p>${
        dead
          ? `Lived from year ${yearStr(Sim.birthYear(p))} to ${yearStr(deathYear(p))}.`
          : `${esc(roleLine(p))}, ${p.age}. Born in year ${yearStr(Sim.birthYear(p))}${p.born < 0 ? ', before the landing' : ''}.`
      }</p>
      ${f ? `<p>${dead ? 'Lived' : 'Lives'} at ${esc(f.name)}${v ? ` in ${esc(v)}` : ''}.</p>` : ''}
      <dl>
        <dt>Father</dt><dd>${p.father !== null ? nm(p.father) : `${esc(p.fatherName)}, known only from the patronymic`}</dd>
        <dt>Mother</dt><dd>${p.mother !== null ? nm(p.mother) : 'Not on record'}</dd>
        <dt>${dead ? 'Married' : 'Spouse'}</dt><dd>${
          sp !== null
            ? `${nm(sp)}, ${kin > 0 ? `kinship coefficient ${kin.toFixed(4)}` : 'not related by blood'}`
            : spouses.length
              ? spouses.map(nm).join(', ') + (dead ? '' : ' (widowed)')
              : 'Unmarried'
        }</dd>
        <dt>Children</dt><dd>${kids.length ? kids.map(nm).join(', ') : 'None'}</dd>
        <dt>Siblings</dt><dd>${sibs.length ? sibs.map(nm).join(', ') : p.father === null && p.mother === null ? 'Not on record' : 'None'}</dd>
      </dl>
      ${evs ? `<ul class="evs">${evs}</ul>` : ''}
      ${
        lineMode() && treeMode !== 'path' && treeSel !== treeFocus
          ? `<p><button type="button" id="treeCentre">Show the line of ${esc(p.given)}</button></p>`
          : ''
      }
      ${dead ? '' : showButton}`;
}
const showButton =
  '<button type="button" class="sum-go in-flow" id="treeShow" title="Show on the map" aria-label="Show on the map">' +
  `${actIcon('target')}</button>`;
function openTree() {
  if (!st) return;
  openPanel(null);
  $('tree').hidden = false;
  for (const el of document.querySelectorAll('.hud, .navigation, .sheet, #uiToggle')) el.inert = true;
  // up to two villages are named; more are the island's records, by its name
  $('treeTitle').textContent =
    `Family records of ${st.villages.length > 2 ? w.name : st.villages.map((v) => v.name).join(' and ')}`;
  const living = st.pawns.filter((p) => p.died === null).length;
  treeCounts = `${living} living, ${st.pawns.length - living} dead, ${st.unions.length} marriages`;
  // it opens on a scope or a line, never on everyone: the selected person's, else the played pawn's (Everyone is a mode to choose)
  if (treeSel < 0) treeSel = selPawn >= 0 ? selPawn : played();
  treePick = false;
  if (treeSel !== treeFocus && (treeMode !== 'path' || treeSel !== treeOther)) refocusTree(treeSel);
  renderTree();
  renderTreeInfo();
  centreTree();
  $('treeClose').focus();
}
const closeTree = () => {
  $('tree').hidden = true;
  for (const el of document.querySelectorAll('.hud, .navigation, .sheet, #uiToggle')) el.inert = false;
  closeSpeedOptions();
  $('minimap').inert = $('minimapBtn').getAttribute('aria-pressed') !== 'true';
  $('treeBtn').focus();
};
$('treeBtn').addEventListener('click', openTree);
$('treeClose').addEventListener('click', closeTree);
$('tree').addEventListener('click', (e) => {
  if (e.target === $('tree')) {
    closeTree();
    return;
  }
  if (e.target.id === 'treeShow') {
    closeTree();
    focusPawn(treeSel);
    return;
  }
  if (e.target.id === 'treeCentre') {
    pickTreePerson(treeSel);
    return;
  }
  const m = e.target.closest('[data-mode]'),
    c = e.target.closest('[data-chip]'),
    n = e.target.closest('[data-pawn]');
  if (m) {
    // Path asks for the second person, and keeps what is shown until they are chosen; another mode leaves the choosing as it is
    if (m.dataset.mode === 'path') treePick = !treePick;
    else {
      treeMode = m.dataset.mode;
      if (treeSel >= 0) refocusTree(treeSel);
    }
    renderTree();
    renderTreeInfo();
    centreTree();
  } else if (c) pickTreeChip(c.dataset.chip);
  else if (n) pickTreePerson(+n.dataset.pawn, e.shiftKey);
});
const focusTreePerson = () => {
  const node = $('treeSvg').querySelector(`[data-pawn="${treeSel}"]`);
  if (node) node.focus();
};
$('tree').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeTree();
    return;
  }
  if (e.key === 'Tab') {
    const focusable = [...$('tree').querySelectorAll('button, [tabindex="0"]')].filter(
      (el) => !el.hidden && el.getClientRects().length,
    );
    const first = focusable[0],
      last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  const n = e.target.closest && e.target.closest('g[data-pawn], g[data-chip]');
  if (n && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    if (n.dataset.chip) pickTreeChip(n.dataset.chip);
    else pickTreePerson(+n.dataset.pawn, e.shiftKey);
  }
});
cardRow('person', 30, (id) => {
  const p = st.pawns[id];
  return p.stake
    ? `Share in hand: ${p.stake} rations${Sim.shareOwed(st, p.id) ? `, ${Sim.shareOwed(st, p.id)} still owed` : ''}`
    : '';
});
// what stands between it and a marriage (VB-631): the means held against those asked are a meter among its stats (VB-908), the other
// bars a line
cardRow('person', 50, (id) => {
  const bar = Sim.marryBar(st, id);
  return bar && !hasMeans(bar) ? marryWords(bar) : '';
});
