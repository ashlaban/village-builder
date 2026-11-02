// @sys page/family: family records: the family tree
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
  let treeSel = -1;
  const yearStr = (y) => (y < 0 ? `\u2212${-y}` : String(y));
  const deathYear = (p) => Math.floor(p.died / Sim.YEAR) + 1;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  function renderTree() {
    const svg = $('treeSvg'); svg.textContent = '';
    const { pos, width, height } = layoutTree(st), pad = 24;
    svg.setAttribute('viewBox', `${-pad} ${-pad} ${width + pad * 2} ${height + pad * 2}`);
    svg.setAttribute('width', width + pad * 2); svg.setAttribute('height', height + pad * 2);
    const heirSet = new Set(st.households.filter((h) => !h.dissolved).map((h) => Sim.heirRanking(st, h)[0]).filter((x) => x !== undefined));
    const links = el('g', { class: 'links' }, svg);
    for (const u of st.unions) {
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
    for (const p of st.pawns) {
      const q = pos.get(p.id), f = farmOf(p), dead = p.died !== null;
      const g = el('g', {
        class: `tn ${p.sex}${p.id === treeSel ? ' sel' : ''}${dead ? ' dead' : ''}`, transform: `translate(${q.x},${q.y})`, tabindex: '0', role: 'button',
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
    }
  }
  function renderTreeInfo() {
    const box = $('treeInfo');
    if (treeSel < 0) { box.innerHTML = '<p class="hint">Choose a person to see their family. Heirs are marked with a dot; the dead are greyed.</p>'; return; }
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
      ${dead ? '' : '<button type="button" class="primary" id="treeShow">Show on the map</button>'}`;
  }
  function openTree() {
    if (!st) return;
    $('tree').hidden = false; $('treeTitle').textContent = `Family records of ${st.villages.map((v) => v.name).join(' and ')}`;
    const L2 = layoutTree(st), living = st.pawns.filter((p) => p.died === null).length;
    $('treeSub').textContent = `${living} living, ${st.pawns.length - living} dead, ${st.unions.length} marriages, ${L2.rows.length} ${L2.rows.length === 1 ?
      'generation' : 'generations'}`;
    if (treeSel < 0 && selPawn >= 0) treeSel = selPawn;
    renderTree(); renderTreeInfo(); $('treeClose').focus();
  }
  const closeTree = () => { $('tree').hidden = true; $('treeBtn').focus(); };
  $('treeBtn').addEventListener('click', openTree);
  $('treeClose').addEventListener('click', closeTree);
  $('tree').addEventListener('click', (e) => {
    if (e.target === $('tree')) { closeTree(); return; }
    if (e.target.id === 'treeShow') { closeTree(); focusPawn(treeSel); return; }
    const n = e.target.closest('[data-pawn]');
    if (n) { treeSel = +n.dataset.pawn; renderTree(); renderTreeInfo(); }
  });
  $('tree').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeTree();
    const n = e.target.closest && e.target.closest('g[data-pawn]');
    if (n && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); treeSel = +n.dataset.pawn; renderTree(); renderTreeInfo(); }
  });

