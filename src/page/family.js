// @sys page/family: family records: the family tree, as one person's line (ancestors, father's or mother's line, descendants) or everyone
  // ======== family records ========
  const NODE_W = 168, NODE_H = 64, GAP = 30, SPOUSE_GAP = 18, ROW_H = 120;
  function layoutTree(S) {
    const gen = new Map();
    const g = (id) => {
      if (gen.has(id)) return gen.get(id); const p = S.pawns[id];
      const v = p.father === null && p.mother === null ? 0 : 1 + Math.max(p.father !== null ? g(p.father) : 0, p.mother !== null ? g(p.mother) : 0);
      gen.set(id, v); return v; };
    S.pawns.forEach((p) => g(p.id));
    // people who married in without parents on record sit in their spouse's row
    for (let pass = 0; pass < 3; pass++) for (const u of S.unions) {
      const a = S.pawns[u.a], b = S.pawns[u.b];
      if (a.father === null && a.mother === null && gen.get(u.a) < gen.get(u.b)) gen.set(u.a, gen.get(u.b));
      if (b.father === null && b.mother === null && gen.get(u.b) < gen.get(u.a)) gen.set(u.b, gen.get(u.a));
    }
    const rows = [];
    for (const p of S.pawns) { const k = gen.get(p.id); (rows[k] = rows[k] || []).push(p.id); }
    for (let k = 0; k < rows.length; k++) rows[k] = rows[k] || [];
    const pos = new Map(), spouses = (id) => S.unions.filter((u) => u.a === id || u.b === id).map((u) => (u.a === id ? u.b : u.a));
    let width = 0;
    rows.forEach((ids, k) => {
      const px = (id) => {
        const p = S.pawns[id], xs = [p.father, p.mother].filter((q) => q !== null && pos.has(q)).map((q) => pos.get(q).x);
        if (xs.length) return xs.reduce((a, b) => a + b, 0) / xs.length;
        const sp = spouses(id).map((q) => S.pawns[q]).find((q) => q.father !== null || q.mother !== null);
        return sp ? 1e5 : (S.pawns[id].household ?? 99) * 1000; };
      const order = [...ids].sort((a, b) => px(a) - px(b) || S.pawns[a].born - S.pawns[b].born);
      const placed = [], seen = new Set();
      for (const id of order) {
        const p = S.pawns[id];
        if (seen.has(id)) continue;
        // an in-law without parents is placed beside their spouse instead of on their own
        if (p.father === null && p.mother === null &&
          spouses(id).some((q) => gen.get(q) === k && (S.pawns[q].father !== null || S.pawns[q].mother !== null))) continue;
        seen.add(id); placed.push([id, GAP]);
        for (const sp of spouses(id)) if (!seen.has(sp) && gen.get(sp) === k) { seen.add(sp); placed.push([sp, SPOUSE_GAP]); }
      }
      for (const id of ids) if (!seen.has(id)) { seen.add(id); placed.push([id, GAP]); }
      let x = 0;
      placed.forEach(([id, gap], n) => { if (n) x += gap; pos.set(id, { x, y: k * ROW_H, gen: k }); x += NODE_W; });
      width = Math.max(width, x);
      rows[k] = placed.map(([id]) => id);
    });
    rows.forEach((ids) => {
      if (!ids.length) return; const last = pos.get(ids[ids.length - 1]).x + NODE_W, shift = (width - last) / 2; for (const id of ids) pos.get(id).x += shift;
      });
    return { pos, rows, width, height: rows.length * ROW_H - (ROW_H - NODE_H) };
  }
  // The line view: only one person's line is laid out (their ancestors, their father's or mother's line, or their descendants); the rest
  // folds behind chips that open in place. Its cost follows the people shown, but for one pass over the unions.
  const CHIP_W = 150, CHIP_H = 30, STEP = NODE_W + SPOUSE_GAP;
  function layoutLine(S, focus, mode, up, down, open) {
    const pos = new Map(), chips = [], notes = [], pairs = [], partner = new Set(), more = new Map(), byPawn = new Map(), seen = new Set([focus]);
    for (const u of S.unions) for (const id of [u.a, u.b]) { if (!byPawn.has(id)) byPawn.set(id, []); byPawn.get(id).push(u); }
    const byBirth = (a, b) => S.pawns[a].born - S.pawns[b].born || a - b;
    const put = (id, x, row) => pos.set(id, { x, y: row * ROW_H, gen: row });
    // below: each person over their children, spouses beside them; a subtree moves right as one when it would overlap its neighbour
    const edge = new Map(), placed = [];
    let later = false;
    const below = (id, row, depth) => {
      const from = placed.length, all = Sim.childrenOf(S, id), kids = depth < down ? all.filter((c) => !seen.has(c)).sort(byBirth) : [];
      if (depth >= down && all.length) { more.set(id, all.length); later = true; }
      const sps = depth < down || !depth ? (byPawn.get(id) || []).map((u) => (u.a === id ? u.b : u.a)).filter((q) => !seen.has(q)) : [], unit = [id];
      [...new Set(sps)].forEach((q, n) => { seen.add(q); partner.add(q); pairs.push([id, q]); if (n === 1) unit.unshift(q); else unit.push(q); });
      for (const c of kids) seen.add(c);
      const xs = kids.map((c) => below(c, row + 1, depth + 1));
      const w = unit.length * STEP - SPOUSE_GAP, at = unit.indexOf(id) * STEP + NODE_W / 2, free = edge.has(row) ? edge.get(row) : -Infinity;
      let left = xs.length ? (xs[0] + xs[xs.length - 1]) / 2 - (unit.length === 2 ? w / 2 : at) : free === -Infinity ? 0 : free;
      if (left < free) {
        const dx = free - left, rows = new Set();
        for (const q of placed.slice(from)) { pos.get(q).x += dx; rows.add(pos.get(q).gen); }
        for (const r of rows) edge.set(r, edge.get(r) + dx);
        left = free;
      }
      unit.forEach((q, n) => { put(q, left + n * STEP, row); placed.push(q); });
      edge.set(row, left + w + GAP);
      return left + at;
    };
    const fx = below(focus, 0, 0) - NODE_W / 2;
    let top = 0, earlier = false;
    if (mode === 'line') {
      // above: both parents of each ancestor, fanning out; a child sits under the middle of its parents
      const fan = new Map();
      let cur = 0;
      const rise = (id, row, depth) => {
        const p = S.pawns[id], ps = [p.father, p.mother].filter((q) => q !== null && !seen.has(q));
        if (depth >= up) { if (ps.length) earlier = true; return null; }
        for (const q of ps) seen.add(q);
        const xs = ps.map((q) => {
          const c = rise(q, row - 1, depth + 1), x = c === null ? cur : c - NODE_W / 2;
          fan.set(q, { x, row: row - 1 }); cur = Math.max(cur, x + NODE_W + GAP); top = Math.min(top, row - 1);
          return x + NODE_W / 2; });
        return xs.length ? (xs[0] + xs[xs.length - 1]) / 2 : null;
      };
      const c = rise(focus, 0, 0);
      for (const [q, f] of fan) put(q, f.x + fx + NODE_W / 2 - c, f.row);
    }
    const spine = [];
    if (mode === 'father' || mode === 'mother') {
      // above: one parent after another straight up, each with their spouse beside them
      for (let c = focus; ;) {
        const p = S.pawns[c], par = mode === 'father' ? p.father : p.mother, other = mode === 'father' ? p.mother : p.father;
        if (par === null || seen.has(par)) {
          notes.push({ x: fx, y: top * ROW_H - 12, text: par !== null ? '' : mode === 'mother' ? 'Mother not on record' : p.fatherName ?
            `Father ${p.fatherName}, known only from the patronymic` : 'Father not on record' });
          break;
        }
        top--; seen.add(par); put(par, fx, top); spine.push(c);
        if (other !== null && !seen.has(other)) { seen.add(other); partner.add(other); put(other, fx + STEP, top); }
        c = par;
      }
    }
    // siblings fold behind a chip to the left of their row, and open there
    for (const c of mode === 'line' ? [focus] : spine) {
      const sibs = Sim.siblingsOf(S, c).filter((q) => !seen.has(q)).sort(byBirth), row = pos.get(c).gen, key = `sib:${c}`;
      if (!sibs.length || (S.pawns[c].father === null || !pos.has(S.pawns[c].father)) && (S.pawns[c].mother === null || !pos.has(S.pawns[c].mother))) continue;
      let left = Infinity;
      for (const q of pos.values()) if (q.gen === row) left = Math.min(left, q.x);
      if (open.has(key)) for (const q of sibs.reverse()) {
        left -= NODE_W + GAP; seen.add(q); put(q, left, row);
        const n = Sim.childrenOf(S, q).length; if (n) more.set(q, n);
      }
      chips.push({ key, x: left - GAP - CHIP_W, y: row * ROW_H + (NODE_H - CHIP_H) / 2, label: open.has(key) ? 'Fold siblings' :
        `+ ${sibs.length} ${sibs.length === 1 ? 'sibling' : 'siblings'}` });
    }
    let bottom = 0;
    for (const q of pos.values()) bottom = Math.max(bottom, q.gen);
    const mid = pos.get(focus).x + (NODE_W - CHIP_W) / 2;
    if (earlier) chips.push({ key: 'up', x: mid, y: top * ROW_H - CHIP_H - 16, label: 'Earlier generations' });
    if (later) chips.push({ key: 'down', x: mid, y: bottom * ROW_H + NODE_H + 16, label: 'Later generations' });
    // shift everything so the drawing starts at the origin
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const span = (x, y, w, h) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h); };
    for (const q of pos.values()) span(q.x, q.y, NODE_W, NODE_H);
    for (const c of chips) span(c.x, c.y, CHIP_W, CHIP_H);
    for (const n of notes) if (n.text) span(n.x, n.y - 14, 300, 14);
    for (const q of [...pos.values(), ...chips, ...notes]) { q.x -= x0; q.y -= y0; }
    return { pos, chips, notes: notes.filter((n) => n.text), pairs, partner, more, byPawn, width: x1 - x0, height: y1 - y0 };
  }
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
  let treeSel = -1, treeMode = 'line', treeFocus = -1, treeUp = 2, treeDown = 1, treeCounts = '';
  const treeOpen = new Set();
  const lineMode = () => treeMode !== 'all' && treeFocus >= 0 && !!st.pawns[treeFocus];
  const refocusTree = (id) => { treeFocus = id; treeUp = 2; treeDown = treeMode === 'desc' ? 3 : 1; treeOpen.clear(); };
  const yearStr = (y) => (y < 0 ? `\u2212${-y}` : String(y));
  const deathYear = (p) => Math.floor(p.died / Sim.YEAR) + 1;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  function renderTree() {
    const svg = $('treeSvg'), line = lineMode(); svg.textContent = '';
    const L = line ? layoutLine(st, treeFocus, treeMode, treeMode === 'line' ? treeUp : 0, treeDown, treeOpen) : layoutTree(st);
    const { pos, width, height } = L, pad = 24;
    svg.setAttribute('viewBox', `${-pad} ${-pad} ${width + pad * 2} ${height + pad * 2}`);
    svg.setAttribute('width', width + pad * 2); svg.setAttribute('height', height + pad * 2);
    for (const b of $('treeModes').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.mode === (line ? treeMode : 'all')));
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
        class: `tn ${p.sex}${p.id === treeSel ? ' sel' : ''}${dead ? ' dead' : ''}${line && p.id === treeFocus ? ' focus' : ''}`,
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
  function pickTreePerson(id) {
    const moved = treeMode !== 'all' && (!lineMode() || id === treeSel || !$('treeSvg').querySelector(`[data-pawn="${id}"]`));
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
    const evs = (p.events || []).filter((e) => e.text).slice(-8).reverse().map((e) =>
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
      ${lineMode() && treeSel !== treeFocus ? `<p><button type="button" id="treeCentre">Show the line of ${esc(p.given)}</button></p>` : ''}
      ${dead ? '' : '<button type="button" class="primary" id="treeShow">Show on the map</button>'}`;
  }
  function openTree() {
    if (!st) return;
    openPanel(null);
    $('tree').hidden = false;
    for (const el of document.querySelectorAll('.hud, .navigation, .sheet, #uiToggle')) el.inert = true;
    $('treeTitle').textContent = `Family records of ${st.villages.map((v) => v.name).join(' and ')}`;
    const living = st.pawns.filter((p) => p.died === null).length;
    treeCounts = `${living} living, ${st.pawns.length - living} dead, ${st.unions.length} marriages`;
    if (treeSel < 0 && selPawn >= 0) treeSel = selPawn;
    if (treeSel !== treeFocus) refocusTree(treeSel);
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
      treeMode = m.dataset.mode; if (treeSel >= 0) refocusTree(treeSel);
      renderTree(); renderTreeInfo(); centreTree();
    } else if (c) pickTreeChip(c.dataset.chip);
    else if (n) pickTreePerson(+n.dataset.pawn);
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
      e.preventDefault(); if (n.dataset.chip) pickTreeChip(n.dataset.chip); else pickTreePerson(+n.dataset.pawn);
    }
  });

