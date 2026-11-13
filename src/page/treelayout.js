// @sys page/treelayout: family records: where the people of a tree stand (everyone, one person's line, the path between two) and their relation in words
// ======== family records ========
const NODE_W = 168,
  NODE_H = 64,
  GAP = 30,
  SPOUSE_GAP = 18,
  ROW_H = 120;
function layoutTree(S) {
  const gen = new Map();
  const g = (id) => {
    if (gen.has(id)) return gen.get(id);
    const p = S.pawns[id];
    const v =
      p.father === null && p.mother === null
        ? 0
        : 1 + Math.max(p.father !== null ? g(p.father) : 0, p.mother !== null ? g(p.mother) : 0);
    gen.set(id, v);
    return v;
  };
  S.pawns.forEach((p) => g(p.id));
  // people who married in without parents on record sit in their spouse's row
  for (let pass = 0; pass < 3; pass++)
    for (const u of S.unions) {
      const a = S.pawns[u.a],
        b = S.pawns[u.b];
      if (a.father === null && a.mother === null && gen.get(u.a) < gen.get(u.b)) gen.set(u.a, gen.get(u.b));
      if (b.father === null && b.mother === null && gen.get(u.b) < gen.get(u.a)) gen.set(u.b, gen.get(u.a));
    }
  const rows = [];
  for (const p of S.pawns) {
    const k = gen.get(p.id);
    (rows[k] = rows[k] || []).push(p.id);
  }
  for (let k = 0; k < rows.length; k++) rows[k] = rows[k] || [];
  const pos = new Map(),
    spouses = (id) => S.unions.filter((u) => u.a === id || u.b === id).map((u) => (u.a === id ? u.b : u.a));
  let width = 0;
  rows.forEach((ids, k) => {
    const px = (id) => {
      const p = S.pawns[id],
        xs = [p.father, p.mother].filter((q) => q !== null && pos.has(q)).map((q) => pos.get(q).x);
      if (xs.length) return xs.reduce((a, b) => a + b, 0) / xs.length;
      const sp = spouses(id)
        .map((q) => S.pawns[q])
        .find((q) => q.father !== null || q.mother !== null);
      return sp ? 1e5 : (S.pawns[id].household ?? 99) * 1000;
    };
    const order = [...ids].sort((a, b) => px(a) - px(b) || S.pawns[a].born - S.pawns[b].born);
    const placed = [],
      seen = new Set();
    for (const id of order) {
      const p = S.pawns[id];
      if (seen.has(id)) continue;
      // an in-law without parents is placed beside their spouse instead of on their own
      if (
        p.father === null &&
        p.mother === null &&
        spouses(id).some((q) => gen.get(q) === k && (S.pawns[q].father !== null || S.pawns[q].mother !== null))
      )
        continue;
      seen.add(id);
      placed.push([id, GAP]);
      for (const sp of spouses(id))
        if (!seen.has(sp) && gen.get(sp) === k) {
          seen.add(sp);
          placed.push([sp, SPOUSE_GAP]);
        }
    }
    for (const id of ids)
      if (!seen.has(id)) {
        seen.add(id);
        placed.push([id, GAP]);
      }
    let x = 0;
    placed.forEach(([id, gap], n) => {
      if (n) x += gap;
      pos.set(id, { x, y: k * ROW_H, gen: k });
      x += NODE_W;
    });
    width = Math.max(width, x);
    rows[k] = placed.map(([id]) => id);
  });
  rows.forEach((ids) => {
    if (!ids.length) return;
    const last = pos.get(ids[ids.length - 1]).x + NODE_W,
      shift = (width - last) / 2;
    for (const id of ids) pos.get(id).x += shift;
  });
  return { pos, rows, width, height: rows.length * ROW_H - (ROW_H - NODE_H) };
}
// The line view: only one person's line is laid out (their ancestors, their father's or mother's line, or their descendants); the rest
// folds behind chips that open in place. Its cost follows the people shown, but for one pass over the unions.
const CHIP_W = 150,
  CHIP_H = 30,
  STEP = NODE_W + SPOUSE_GAP;
function layoutLine(S, focus, mode, up, down, open) {
  const pos = new Map(),
    chips = [],
    notes = [],
    pairs = [],
    partner = new Set(),
    more = new Map(),
    byPawn = new Map(),
    seen = new Set([focus]);
  for (const u of S.unions)
    for (const id of [u.a, u.b]) {
      if (!byPawn.has(id)) byPawn.set(id, []);
      byPawn.get(id).push(u);
    }
  const byBirth = (a, b) => S.pawns[a].born - S.pawns[b].born || a - b;
  const put = (id, x, row) => pos.set(id, { x, y: row * ROW_H, gen: row });
  // below: each person over their children, spouses beside them; a subtree moves right as one when it would overlap its neighbour
  const edge = new Map(),
    placed = [];
  let later = false;
  const below = (id, row, depth) => {
    const from = placed.length,
      all = Sim.childrenOf(S, id),
      kids = depth < down ? all.filter((c) => !seen.has(c)).sort(byBirth) : [];
    if (depth >= down && all.length) {
      more.set(id, all.length);
      later = true;
    }
    const sps =
        depth < down || !depth
          ? (byPawn.get(id) || []).map((u) => (u.a === id ? u.b : u.a)).filter((q) => !seen.has(q))
          : [],
      unit = [id];
    [...new Set(sps)].forEach((q, n) => {
      seen.add(q);
      partner.add(q);
      pairs.push([id, q]);
      if (n === 1) unit.unshift(q);
      else unit.push(q);
    });
    for (const c of kids) seen.add(c);
    const xs = kids.map((c) => below(c, row + 1, depth + 1));
    const w = unit.length * STEP - SPOUSE_GAP,
      at = unit.indexOf(id) * STEP + NODE_W / 2,
      free = edge.has(row) ? edge.get(row) : -Infinity;
    let left = xs.length
      ? (xs[0] + xs[xs.length - 1]) / 2 - (unit.length === 2 ? w / 2 : at)
      : free === -Infinity
        ? 0
        : free;
    if (left < free) {
      const dx = free - left,
        rows = new Set();
      for (const q of placed.slice(from)) {
        pos.get(q).x += dx;
        rows.add(pos.get(q).gen);
      }
      for (const r of rows) edge.set(r, edge.get(r) + dx);
      left = free;
    }
    unit.forEach((q, n) => {
      put(q, left + n * STEP, row);
      placed.push(q);
    });
    edge.set(row, left + w + GAP);
    return left + at;
  };
  const fx = below(focus, 0, 0) - NODE_W / 2;
  let top = 0,
    earlier = false;
  if (mode === 'line') {
    // above: both parents of each ancestor, fanning out; a child sits under the middle of its parents
    const fan = new Map();
    let cur = 0;
    const rise = (id, row, depth) => {
      const p = S.pawns[id],
        ps = [p.father, p.mother].filter((q) => q !== null && !seen.has(q));
      if (depth >= up) {
        if (ps.length) earlier = true;
        return null;
      }
      for (const q of ps) seen.add(q);
      const xs = ps.map((q) => {
        const c = rise(q, row - 1, depth + 1),
          x = c === null ? cur : c - NODE_W / 2;
        fan.set(q, { x, row: row - 1 });
        cur = Math.max(cur, x + NODE_W + GAP);
        top = Math.min(top, row - 1);
        return x + NODE_W / 2;
      });
      return xs.length ? (xs[0] + xs[xs.length - 1]) / 2 : null;
    };
    const c = rise(focus, 0, 0);
    for (const [q, f] of fan) put(q, f.x + fx + NODE_W / 2 - c, f.row);
  }
  const spine = [];
  if (mode === 'father' || mode === 'mother') {
    // above: one parent after another straight up, each with their spouse beside them
    for (let c = focus; ;) {
      const p = S.pawns[c],
        par = mode === 'father' ? p.father : p.mother,
        other = mode === 'father' ? p.mother : p.father;
      if (par === null || seen.has(par)) {
        notes.push({
          x: fx,
          y: top * ROW_H - 12,
          text:
            par !== null
              ? ''
              : mode === 'mother'
                ? 'Mother not on record'
                : p.fatherName
                  ? `Father ${p.fatherName}, known only from the patronymic`
                  : 'Father not on record',
        });
        break;
      }
      top--;
      seen.add(par);
      put(par, fx, top);
      spine.push(c);
      if (other !== null && !seen.has(other)) {
        seen.add(other);
        partner.add(other);
        put(other, fx + STEP, top);
      }
      c = par;
    }
  }
  // siblings fold behind a chip to the left of their row, and open there
  for (const c of mode === 'line' ? [focus] : spine) {
    const sibs = Sim.siblingsOf(S, c)
        .filter((q) => !seen.has(q))
        .sort(byBirth),
      row = pos.get(c).gen,
      key = `sib:${c}`;
    if (
      !sibs.length ||
      ((S.pawns[c].father === null || !pos.has(S.pawns[c].father)) &&
        (S.pawns[c].mother === null || !pos.has(S.pawns[c].mother)))
    )
      continue;
    let left = Infinity;
    for (const q of pos.values()) if (q.gen === row) left = Math.min(left, q.x);
    if (open.has(key))
      for (const q of sibs.reverse()) {
        left -= NODE_W + GAP;
        seen.add(q);
        put(q, left, row);
        const n = Sim.childrenOf(S, q).length;
        if (n) more.set(q, n);
      }
    chips.push({
      key,
      x: left - GAP - CHIP_W,
      y: row * ROW_H + (NODE_H - CHIP_H) / 2,
      label: open.has(key) ? 'Fold siblings' : `+ ${sibs.length} ${sibs.length === 1 ? 'sibling' : 'siblings'}`,
    });
  }
  let bottom = 0;
  for (const q of pos.values()) bottom = Math.max(bottom, q.gen);
  const mid = pos.get(focus).x + (NODE_W - CHIP_W) / 2;
  if (earlier) chips.push({ key: 'up', x: mid, y: top * ROW_H - CHIP_H - 16, label: 'Earlier generations' });
  if (later) chips.push({ key: 'down', x: mid, y: bottom * ROW_H + NODE_H + 16, label: 'Later generations' });
  // shift everything so the drawing starts at the origin
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  const span = (x, y, w, h) => {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x + w);
    y1 = Math.max(y1, y + h);
  };
  for (const q of pos.values()) span(q.x, q.y, NODE_W, NODE_H);
  for (const c of chips) span(c.x, c.y, CHIP_W, CHIP_H);
  for (const n of notes) if (n.text) span(n.x, n.y - 14, 300, 14);
  for (const q of [...pos.values(), ...chips, ...notes]) {
    q.x -= x0;
    q.y -= y0;
  }
  return {
    pos,
    chips,
    notes: notes.filter((n) => n.text),
    pairs,
    partner,
    more,
    byPawn,
    width: x1 - x0,
    height: y1 - y0,
  };
}
// The path between two people: up from the first to the nearest ancestors they share and down to the second; where they share none, the
// shortest chain of parents, children and spouses. Null when the records do not join them. Its cost follows their ancestors, or, for a
// chain through marriages, the people within reach.
function findPath(S, a, b) {
  const ups = (id) => {
    const d = new Map([[id, [0, -1]]]);
    for (let gen = [id], n = 1; gen.length; n++) {
      const next = [];
      for (const c of gen)
        for (const q of [S.pawns[c].father, S.pawns[c].mother])
          if (q !== null && !d.has(q)) {
            d.set(q, [n, c]);
            next.push(q);
          }
      gen = next;
    }
    return d;
  };
  const da = ups(a),
    db = ups(b);
  let top = -1;
  for (const [q, [n]] of da) if (db.has(q) && (top < 0 || n + db.get(q)[0] < da.get(top)[0] + db.get(top)[0])) top = q;
  if (top >= 0) {
    const chain = (d) => {
      const out = [];
      for (let c = top; c !== -1; c = d.get(c)[1]) out.push(c);
      return out;
    }; // from the top down
    const ua = chain(da).reverse(),
      ub = chain(db).slice(1),
      ca = ua[ua.length - 2],
      cb = ub[0],
      steps = ua.slice(1).map(() => 'up');
    // both parents shared: the other one stands beside the first at the top
    const both = (c) => c !== undefined && S.pawns[c].father !== null && S.pawns[c].mother !== null;
    const mate =
      both(ca) && both(cb) && S.pawns[ca].father === S.pawns[cb].father && S.pawns[ca].mother === S.pawns[cb].mother
        ? S.pawns[ca].father === top
          ? S.pawns[ca].mother
          : S.pawns[ca].father
        : -1;
    if (mate >= 0) {
      ua.push(mate);
      steps.push('spouse');
    }
    return {
      ids: [...ua, ...ub],
      steps: [...steps, ...ub.map(() => 'down')],
      blood: [da.get(top)[0], db.get(top)[0], mate >= 0],
      top,
      mate,
    };
  }
  const from = new Map([[a, null]]),
    kin = new Map();
  for (const u of S.unions)
    for (const [x, y] of [
      [u.a, u.b],
      [u.b, u.a],
    ]) {
      if (!kin.has(x)) kin.set(x, []);
      kin.get(x).push(y);
    }
  for (let gen = [a]; gen.length && !from.has(b);) {
    const next = [],
      go = (c, q, step) => {
        if (q !== null && !from.has(q)) {
          from.set(q, [c, step]);
          next.push(q);
        }
      };
    for (const c of gen) {
      go(c, S.pawns[c].father, 'up');
      go(c, S.pawns[c].mother, 'up');
      for (const q of kin.get(c) || []) go(c, q, 'spouse');
      for (const q of Sim.childrenOf(S, c)) go(c, q, 'down');
    }
    gen = next;
  }
  if (!from.has(b)) return null;
  const ids = [b],
    steps = [];
  for (let c = b; from.get(c); c = from.get(c)[0]) {
    ids.unshift(from.get(c)[0]);
    steps.unshift(from.get(c)[1]);
  }
  return { ids, steps, blood: null };
}
// The path as a drawing: a step up or down changes the row, a marriage or a turn starts a new column.
function layoutPath(S, P) {
  const pos = new Map(),
    pairs = [],
    byPawn = new Map();
  let col = 0,
    row = 0,
    x0 = 0,
    y0 = 0,
    x1 = 0,
    y1 = 0;
  P.ids.forEach((id, n) => {
    const step = n ? P.steps[n - 1] : null,
      before = n > 1 ? P.steps[n - 2] : null;
    if (step === 'spouse') {
      col++;
      pairs.push([P.ids[n - 1], id]);
    } else if (step) {
      row += step === 'up' ? -1 : 1;
      if (before && before !== 'spouse' && before !== step) col++;
    }
    pos.set(id, { x: col * STEP, y: row * ROW_H, gen: row });
    x0 = Math.min(x0, col * STEP);
    y0 = Math.min(y0, row * ROW_H);
    x1 = Math.max(x1, col * STEP + NODE_W);
    y1 = Math.max(y1, row * ROW_H + NODE_H);
  });
  for (const q of pos.values()) {
    q.x -= x0;
    q.y -= y0;
  }
  for (const u of S.unions)
    if (pos.has(u.a) && pos.has(u.b))
      for (const id of [u.a, u.b]) {
        if (!byPawn.has(id)) byPawn.set(id, []);
        byPawn.get(id).push(u);
      }
  return {
    pos,
    chips: [],
    notes: [],
    pairs,
    partner: new Set(),
    more: new Map(),
    byPawn,
    width: x1 - x0,
    height: y1 - y0,
  };
}
// What the second person is to the first, in words.
function relationWords(S, P) {
  const a = S.pawns[P.ids[0]],
    b = S.pawns[P.ids[P.ids.length - 1]],
    m = b.sex === 'm',
    greats = (n) => 'great-'.repeat(Math.max(0, n));
  const times = ['', ' once removed', ' twice removed'],
    nth = ['', 'first', 'second', 'third', 'fourth', 'fifth'];
  const name = (id) => Sim.fullName(S.pawns[id]);
  if (!P.blood) {
    const word = {
      up: (q) => (q.sex === 'm' ? 'father' : 'mother'),
      down: (q) => (q.sex === 'm' ? 'son' : 'daughter'),
      spouse: (q) => (q.sex === 'm' ? 'husband' : 'wife'),
    };
    const wed = P.steps.filter((x) => x === 'spouse').length,
      chain = P.steps.map((x, n) => word[x](S.pawns[P.ids[n + 1]])).join("'s ");
    return `${name(b.id)} is ${
      P.steps.length <= 5
        ? `${name(a.id)}'s ${chain}`
        : `${P.steps.length} steps from ${name(a.id)}, ${wed} of them marriages`
    }. They share no ancestor on record.`;
  }
  const [up, down, full] = P.blood,
    half = full || !up || !down ? '' : 'half-';
  const rel = !up
    ? down === 1
      ? m
        ? 'son'
        : 'daughter'
      : `${greats(down - 2)}grand${m ? 'son' : 'daughter'}`
    : !down
      ? up === 1
        ? m
          ? 'father'
          : 'mother'
        : `${greats(up - 2)}grand${m ? 'father' : 'mother'}`
      : up === 1 && down === 1
        ? `${half}${m ? 'brother' : 'sister'}`
        : up === 1
          ? `${half}${greats(down - 2)}${m ? 'nephew' : 'niece'}`
          : down === 1
            ? `${half}${greats(up - 2)}${m ? 'uncle' : 'aunt'}`
            : `${half}${nth[Math.min(up, down) - 1] || `${Math.min(up, down) - 1}th`} cousin${times[Math.abs(up - down)] ?? ` ${Math.abs(up - down)} times removed`}`;
  const through = up && down ? `, through ${name(P.top)}${P.mate >= 0 ? ` and ${name(P.mate)}` : ''}` : '';
  return `${name(b.id)} is ${name(a.id)}'s ${rel}${through}. Kinship coefficient ${Sim.kinship(S, a.id, b.id).toFixed(4)}.`;
}
