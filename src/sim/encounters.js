// @sys sim/encounters: who meets whom (VB-521; design.md, Where pawns meet; target-v2, section 4.4): a table of encounter kinds, each saying
//   who is present, whom a pawn may draw as a partner, how strangers mix and what is said to all; the talk round (sim/relations) asks it for
//   partners. Encounters read no plan and have only social effects.
VB['sim/encounters'] = (() => {
  const { next: rnd } = VB['sim/rng'];
  const { SOCIAL } = VB['sim/rules'];
  const T = SOCIAL.talk;
  // Scratch (derived, not state): seen[id] === look marks a pawn already drawn for the pawn whose partners are sought; lists, the cells read.
  let seen = new Int32Array(1024),
    look = 0;
  const lists = [];
  const fit = (n) => {
    if (seen.length < n) seen = new Int32Array(2 * n);
  };
  // Up to `sample` of the n pawns in the cell lists `lists` (indexes into `out`), drawn on the talk stream; all of them when there are at
  // most sample + 1. Each drawn pawn not yet seen, not talking this hour (busy[id] === round) and passing ok(near, a, b, lim) goes into `found`.
  function draw(st, a, near, sample, n, busy, round, found, ok, lim) {
    const out = near.out;
    const draws = n <= sample + 1 ? n : sample;
    for (let d = 0; d < draws; d++) {
      let k = draws === n ? d : Math.floor(rnd(st.rng.talk) * n),
        b = null;
      for (const l of lists) {
        if (k < l.length) {
          b = out[l[k]];
          break;
        }
        k -= l.length;
      }
      if (seen[b.id] === look) continue;
      seen[b.id] = look;
      if (busy[b.id] !== round && ok(near, a.id, b.id, lim)) found.push(b);
    }
  }
  // Two pawns i and j by their places in `near` (placeOf's, VB-473: a walker where it has come to along its leg): face to face, within S
  // in x and y; at calling distance, within R.
  const within = (near, i, j, S) => Math.abs(near.x[i] - near.x[j]) < S && Math.abs(near.y[i] - near.y[j]) < S,
    calling = (near, i, j, R) => (near.x[i] - near.x[j]) ** 2 + (near.y[i] - near.y[j]) ** 2 < R * R;
  // The cells of `grid` ({cells, size}) about a, into `lists`; their pawns counted.
  function around(grid, near, a) {
    const S = grid.size,
      cx = Math.floor(near.x[a.id] / S),
      cy = Math.floor(near.y[a.id] / S);
    let n = 0;
    lists.length = 0;
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const l = grid.cells.get(near.cellOf(cx + dx, cy + dy));
        if (l) {
          lists.push(l);
          n += l.length;
        }
      }
    return n;
  }
  // A herder at its herds: a pawn outdoors holding a herding task at the side (VB-136; sim/agents' agent.side, sim/grazing's kind 'herd').
  const herding = (a) => !a.inside && !!a.side && !!a.side.background && a.side.background.kind === 'herd';
  // A pawn at an occasion it has arrived at, and one standing at occasion o: it set out for it and has arrived (no path left to walk).
  const atOccasion = (a) => a.occasion !== null && a.path === null;
  const standing = (st, a, o) => a.occasion === o.id && a.path === null && st.pawns[a.id].alive;
  const occasionOf = (st, id) => {
    for (const o of st.occasions) if (o.id === id) return o;
    return null;
  };

  // ---- the kinds (design.md, Where pawns meet): present(st, ...) says who is there; sample(st, a, near, busy, round, found) puts into
  // `found` whom a may draw as a partner, and returns the kind's mix, a floor added to each partner's weight so that strangers are drawn;
  // said, for a kind where something can be said to all present. House and outdoors are as built (VB-061, VB-127). ----
  const ENCOUNTERS = {
    // the members inside a house: a pawn inside draws from its housemates inside (one standing at an occasion is there, not at home)
    house: {
      present: (st, hh) => hh.members.filter((m) => st.agents[m].inside),
      sample(st, a, near, busy, round, found) {
        const hh = st.households[st.pawns[a.id].household];
        if (hh)
          for (const m of hh.members)
            if (m !== a.id && st.agents[m].inside && !atOccasion(st.agents[m]) && busy[m] !== round)
              found.push(st.agents[m]);
        return ENCOUNTERS.house.mix;
      },
      mix: 0,
      said: null,
    },
    // those outdoors within `size` (30) map units in x and y, in cells of that size: up to T.sample drawn from the cells about the pawn
    outdoors: {
      size: 30,
      present: (st, near) => near.out,
      sample(st, a, near, busy, round, found) {
        const S = near.size;
        look++;
        seen[a.id] = look;
        draw(st, a, near, T.sample, around(near, near, a), busy, round, found, within, S);
        return ENCOUNTERS.outdoors.mix;
      },
      mix: 0,
      said: null,
    },
    // herders at their herds (Kim, 12 Nov, on VB-136's question 3: yes): a herder draws, besides those near it outdoors, up to `draws` of
    // the herders within `reach` map units, calling distance, kept in a second grid of that cell
    pasture: {
      reach: 120,
      draws: 8,
      present: (st, near) => near.herders.list.map((n) => near.out[n]),
      sample(st, a, near, busy, round, found) {
        const P = ENCOUNTERS.pasture;
        draw(st, a, near, P.draws, around(near.herders, near, a), busy, round, found, calling, P.reach);
        return P.mix;
      },
      mix: 0,
      said: null,
    },
    // those who came to an occasion (sim/occasions: st.occasions, agent.occasion), indoors or out: a pawn standing at one draws up to
    // `draws` of those standing there, weighed by familiarity and liking plus `mix`, so that people who did not know each other meet; a
    // kind of occasion may name its own mix in `kinds`
    occasion: {
      draws: 8,
      mix: 0.2,
      kinds: {},
      present: (st, id) => present(st, id),
      sample(st, a, near, busy, round, found) {
        const O = ENCOUNTERS.occasion,
          o = occasionOf(st, a.occasion);
        if (!o) return O.mix;
        look++;
        seen[a.id] = look;
        const come = o.come,
          n = come.length,
          draws = n <= O.draws + 1 ? n : O.draws;
        for (let d = 0; d < draws; d++) {
          const b = st.agents[come[draws === n ? d : Math.floor(rnd(st.rng.talk) * n)]];
          if (seen[b.id] === look) continue;
          seen[b.id] = look;
          if (busy[b.id] !== round && standing(st, b, o)) found.push(b);
        }
        const k = O.kinds[o.kind];
        return k && k.mix !== undefined ? k.mix : O.mix;
      },
      said: (st, id, by) => said(st, id, by),
    },
  };

  // Those who came to occasion `id` and stand there now, in the order they set out; empty when it is over or unknown.
  function present(st, id) {
    const o = occasionOf(st, id);
    return o ? o.come.filter((p) => standing(st, st.agents[p], o)) : [];
  }
  // The one door by which something is made known to all present at occasion `id` (VB-522's rite, VB-523's stories): those who hear what
  // pawn `by` says there, everyone present but the speaker. It changes nothing itself; the caller makes it known to them.
  function said(st, id, by) {
    return present(st, id).filter((p) => p !== by);
  }

  // Whom pawn a (an agent) could talk with this hour, into `found`, with the mix of the kind it meets in: at an occasion it stands at,
  // those who came; inside, its housemates inside; outdoors, those near it, and a herder also the herders within calling distance. Pawns
  // talking already this hour (busy[id] === round) are left out.
  function partners(st, a, near, busy, round, found) {
    found.length = 0;
    fit(st.agents.length);
    if (atOccasion(a)) return ENCOUNTERS.occasion.sample(st, a, near, busy, round, found);
    if (a.inside) return ENCOUNTERS.house.sample(st, a, near, busy, round, found);
    const mix = ENCOUNTERS.outdoors.sample(st, a, near, busy, round, found);
    if (herding(a)) ENCOUNTERS.pasture.sample(st, a, near, busy, round, found); // seen carries over: no pawn drawn twice
    return mix;
  }

  // The pawns outdoors in a talk hour, in cells of ENCOUNTERS.outdoors.size map units, and the herders among them in cells of the
  // pasture's reach, filled in the same pass: {out (agents), cells (cell key to indexes into out), cellOf (cell x, y to key), size,
  // herders: {cells, size, list (indexes into out)}, x, y (each one's place, by pawn id, from `placeOf` (sim/agents, passed in by the
  // clock: a walker is found along its leg; VB-473)}; derived, not state. x and y are scratch arrays reused by every call, read only
  // until the next. (Moved from sim/society's outdoors, VB-521.)
  const cellOf = (cx, cy) => cx * 65536 + cy;
  let px = new Float64Array(0),
    py = new Float64Array(0);
  function outdoors(st, placeOf) {
    const NEAR = ENCOUNTERS.outdoors.size,
      FAR = ENCOUNTERS.pasture.reach;
    const out = [];
    if (px.length < st.agents.length) {
      px = new Float64Array(2 * st.agents.length);
      py = new Float64Array(2 * st.agents.length);
    }
    for (const id of st.living) {
      const a = st.agents[id];
      if (a.inside) continue;
      out.push(a);
      [px[id], py[id]] = placeOf(st, a);
    }
    const cells = new Map(),
      far = new Map(),
      list = [];
    const put = (m, k, n) => {
      const l = m.get(k);
      if (l) l.push(n);
      else m.set(k, [n]);
    };
    out.forEach((a, n) => {
      put(cells, cellOf(Math.floor(px[a.id] / NEAR), Math.floor(py[a.id] / NEAR)), n);
      if (herding(a)) {
        list.push(n);
        put(far, cellOf(Math.floor(px[a.id] / FAR), Math.floor(py[a.id] / FAR)), n);
      }
    });
    return { out, cells, cellOf, size: NEAR, herders: { cells: far, size: FAR, list }, x: px, y: py };
  }
  return { ENCOUNTERS, partners, outdoors, present, said };
})();
