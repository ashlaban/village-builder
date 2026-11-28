// @sys sim/graph: the membership graph (VB-043): typed edges from pawns and bodies to bodies, written by Membership (sim/records, sim/membership,
// sim/marriage, sim/society) as each membership changes; the index of live edges; the household caches derived from the edges and checked against them
VB['sim/graph'] = (() => {
  // Each role: the kind of its `from` and of its `to`. A pawn may hold several edges of one role over time, and edges of several roles at once
  // (the multi-membership test, docs/architecture/stress-tests.md, section 4): a later employer, guild or parish is a new role, not a redesign.
  // resides: the household a pawn lives in (pawn.household, household.members); service: in service (pawn.servant, pawn.servedSince), to the
  // household it served when it began; holder: household.holder; spouse: a union, one edge each way; village: a household's village (its
  // farm's); culture: a village's culture (its settlement's, st.cenv); alderman: the village's office (VB-314); family: a pawn's family, the
  // founder its descent goes back to (by the father, else the mother); line: a farm's line (farmstead.line, VB-224).
  const ROLES = Object.freeze({
    resides: ['pawn', 'household'],
    service: ['pawn', 'household'],
    holder: ['pawn', 'household'],
    spouse: ['pawn', 'pawn'],
    village: ['household', 'village'],
    culture: ['village', 'culture'],
    alderman: ['pawn', 'village'],
    family: ['pawn', 'pawn'],
    line: ['pawn', 'farmstead'],
  });
  const NAMES = Object.keys(ROLES),
    R_ID = Object.fromEntries(NAMES.map((r, i) => [r, i]));
  const SPAN = 2 ** 26; // a key of the live index: role number × SPAN + id
  VB.counter(
    'graphBuild',
    "Edges read to build the membership graph's live index, at its first use after a seed or load (sim/graph, VB-043)",
  );
  // @state st.edges[]: {id, from, to, role, since, until, left?}: the membership graph, appended in play and saved; `until` null while the edge
  //   is live, the hour it ended after; `left` true when the member gave it up (a move, the end of service), absent when it ended with a
  //   death or a dissolution, which the person's record keeps (its last household, its service). Absent until the first seed or load
  //   (rebuildLiving), when it is built from the caches (migrate). Written only here, by the calls of Membership.
  // @state st.graph: {from: Map, to: Map} of key (role, id) to the ids of the live edges, in the order made; the index every step reads
  //   (cost rule 1: ended edges stay outside it); derived, not saved (`sim/saves` DERIVED), built at its first use.
  function index(st) {
    if (st.graph) return st.graph;
    const g = (st.graph = { from: new Map(), to: new Map() });
    for (const e of st.edges) if (e.until === null) add(g, e);
    VB.count.graphBuild += st.edges.length;
    return g;
  }
  const put = (m, k, id) => {
    const l = m.get(k);
    if (l) l.push(id);
    else m.set(k, [id]);
  };
  const drop = (m, k, id) => {
    const l = m.get(k);
    if (!l) return;
    const i = l.indexOf(id);
    if (i >= 0) l.splice(i, 1);
    if (!l.length) m.delete(k);
  };
  function add(g, e) {
    const r = R_ID[e.role] * SPAN;
    if (e.from !== null) put(g.from, r + e.from, e.id);
    if (e.to !== null) put(g.to, r + e.to, e.id);
  }
  const NONE = Object.freeze([]);
  // The ids of the live edges of `role` from (or to) id, in the order made: read only.
  const liveFrom = (st, role, id) => (st.edges ? index(st).from.get(R_ID[role] * SPAN + id) || NONE : NONE);
  const liveTo = (st, role, id) => (st.edges ? index(st).to.get(R_ID[role] * SPAN + id) || NONE : NONE);
  // A new live edge; its id, or -1 before the graph is built (a scenario's record kit, which migrate reads afterwards).
  function link(st, from, to, role, since = st.t || 0) {
    if (!st.edges) return -1;
    if (!(role in ROLES)) throw new Error(`no role ${role}`);
    const g = index(st), // built before the edge joins st.edges, which it reads
      e = { id: st.edges.length, from, to, role, since, until: null };
    st.edges.push(e);
    add(g, e);
    return e.id;
  }
  function close(st, id, left = false, until = st.t || 0) {
    const e = st.edges[id];
    if (e.until !== null) return;
    const g = index(st),
      r = R_ID[e.role] * SPAN;
    if (e.from !== null) drop(g.from, r + e.from, id);
    if (e.to !== null) drop(g.to, r + e.to, id);
    e.until = until;
    if (left) e.left = true;
  }
  // The edges ids end (a copy is read: ids may be a list of the index).
  const end = (st, ids, left = false) => {
    for (const id of ids.slice()) close(st, id, left);
  };
  VB.counter(
    'graphScan',
    "Edges read back along st.edges for a pawn kept on a dissolved household's record that leaves it (sim/graph leave, VB-043)",
  );
  // ---- the moves of Membership: a pawn joins a household by link (sim/records joinHousehold), service begins by link and ends by end ----
  // A pawn leaves household hh: moved (left), or dead, or its household dissolved, which its record keeps (sim/records leaveHousehold,
  // clearMembers). A pawn kept on a dissolved household's record has no live edge left: its last one, ended, is marked left (rare: a look
  // back along st.edges).
  function leave(st, id, hh, left) {
    if (!st.edges) return;
    const live = liveFrom(st, 'resides', id).filter((k) => st.edges[k].to === hh);
    if (live.length) return end(st, live, left);
    if (!left) return;
    for (let k = st.edges.length - 1; k >= 0; k--) {
      VB.count.graphScan++;
      const e = st.edges[k];
      if (e.role === 'resides' && e.from === id) {
        if (e.to === hh) e.left = true;
        return;
      }
    }
  }
  // The one live edge of `role` to `to` is from `from` (null: none): a holder, a farm's line, an alderman.
  function single(st, role, to, from) {
    if (!st.edges) return;
    let has = false;
    for (const k of liveTo(st, role, to).slice()) {
      if (st.edges[k].from === from) has = true;
      else close(st, k, true);
    }
    if (!has && from !== null && from !== undefined) link(st, from, to, role);
  }
  // A village's one live culture edge is to `culture`.
  function cultureOf(st, v, culture) {
    if (!st.edges) return;
    let has = false;
    for (const k of liveFrom(st, 'culture', v).slice()) {
      if (st.edges[k].to === culture) has = true;
      else close(st, k, true);
    }
    if (!has) link(st, v, culture, 'culture');
  }
  // A household is made on its farm (sim/records makeHousehold): its village and its holder; its members join one by one.
  function made(st, hh, village) {
    if (!st.edges) return;
    link(st, hh.id, village, 'village');
    single(st, 'holder', hh.id, hh.holder);
    for (const m of hh.members) link(st, m, hh.id, 'resides');
  }
  // A household is dissolved: its village and holder edges end with it (its members' end as they leave, or with clearMembers).
  function dissolved(st, hh) {
    if (!st.edges) return;
    end(st, liveFrom(st, 'village', hh.id));
    end(st, liveTo(st, 'holder', hh.id));
  }
  // A union begins or ends (sim/marriage, sim/lifecycle by sim/records noteUnionEnd).
  function wed(st, a, b, since = st.t || 0) {
    link(st, a, b, 'spouse', since);
    link(st, b, a, 'spouse', since);
  }
  function unwed(st, a, b) {
    if (!st.edges) return;
    end(
      st,
      liveFrom(st, 'spouse', a).filter((k) => st.edges[k].to === b),
    );
    end(
      st,
      liveFrom(st, 'spouse', b).filter((k) => st.edges[k].to === a),
    );
  }
  // The founder a pawn's descent goes back to, by the father, else the mother: its family. At most its generations a call.
  function familyHead(st, id) {
    let p = st.pawns[id];
    while (p.father !== null || p.mother !== null) p = st.pawns[p.father !== null ? p.father : p.mother];
    return p.id;
  }
  const born = (st, id) => link(st, id, familyHead(st, id), 'family', st.pawns[id].born);
  // A death ends the pawn's own memberships, outside the live index: its service (kept on its record) and its family. Its residence ends as
  // it leaves its household (sim/records leaveHousehold, historical); its holding and its line pass with the farm (sim/heirs).
  function died(st, id) {
    if (!st.edges) return;
    end(st, liveFrom(st, 'service', id));
    end(st, liveFrom(st, 'family', id));
  }
  // ---- built from the caches: at a seed (the scenario's records), or a save made before VB-043 ----
  // Since: a union's start, a servant's servedSince, a pawn's birth; for the rest the hour of the build (an older save does not say).
  function migrate(st) {
    if (st.edges) return;
    st.edges = [];
    st.graph = null;
    const t = st.t || 0,
      mk = (from, to, role, since = t, until = null) => {
        const id = link(st, from, to, role, since);
        if (until !== null) close(st, id, false, until);
      };
    for (const p of st.pawns) mk(p.id, familyHead(st, p.id), 'family', p.born, p.died);
    for (const u of st.unions) {
      mk(u.a, u.b, 'spouse', u.start, u.end);
      mk(u.b, u.a, 'spouse', u.start, u.end);
    }
    const kept = new Set();
    for (const hh of st.households) {
      if (hh.dissolved) continue;
      mk(hh.id, st.farmsteads[hh.farmstead].village, 'village');
      if (hh.holder !== null && hh.holder !== undefined) mk(hh.holder, hh.id, 'holder');
      for (const m of hh.members) {
        mk(m, hh.id, 'resides');
        kept.add(m);
      }
    }
    // the dead, and the living kept on a dissolved household's record: an ended residence
    for (const p of st.pawns)
      if (p.household !== null && !kept.has(p.id)) mk(p.id, p.household, 'resides', t, p.died !== null ? p.died : t);
    for (const p of st.pawns)
      if (p.servant) mk(p.id, p.household, 'service', p.servedSince !== null ? p.servedSince : t, p.died);
    for (const f of st.farmsteads) if (f.line !== null && f.line !== undefined) mk(f.line, f.id, 'line');
    if (st.cenv) for (const s of st.cenv.settlements) mk(s.id, s.culture, 'culture');
    for (const v of st.villages || [])
      if (v.alderman !== null && v.alderman !== undefined)
        mk(
          v.alderman,
          v.id,
          'alderman',
          v.aldermanSince !== null && v.aldermanSince !== undefined ? v.aldermanSince : t,
        );
  }
  // ---- the caches, derived ----
  // pawn.household, pawn.servant, pawn.servedSince by pawn and household.members by household, from the edges alone: a pawn's last
  // residence (its last service) counts unless it left it; a household's members are its live residents in the order they came.
  function derive(st) {
    const n = st.pawns.length,
      household = new Array(n).fill(null),
      servant = new Array(n).fill(false),
      servedSince = new Array(n).fill(null),
      members = new Map();
    for (const e of st.edges) {
      if (e.role === 'resides') {
        household[e.from] = e.left ? null : e.to;
        if (e.until === null) put(members, e.to, e.from);
      } else if (e.role === 'service') {
        servant[e.from] = !e.left;
        servedSince[e.from] = e.left ? null : e.since;
      }
    }
    return { household, servant, servedSince, members };
  }
  // The role cache (pawn.role) as the edges say it, where they settle it: the holder of the household it lives in is its farmer, the spouse
  // of that holder its wife (or farmer), one in service its farmhand or maid (unless a child or retired, which age and retirement say);
  // null where the edges leave it to age (child, son, daughter) or retirement.
  function roleOf(st, p) {
    const hh = p.household;
    if (hh === null || st.households[hh].dissolved) return null;
    const holder = liveTo(st, 'holder', hh).map((k) => st.edges[k].from)[0];
    if (holder === p.id) return 'farmer';
    if (holder !== undefined && liveFrom(st, 'spouse', p.id).some((k) => st.edges[k].to === holder))
      return p.sex === 'f' ? 'wife' : 'farmer';
    if (p.role === 'farmer' || p.role === 'wife') return '(neither holder nor its spouse)';
    if (p.role === 'child' || p.role === 'retired') return null;
    return liveFrom(st, 'service', p.id).length ? (p.sex === 'm' ? 'farmhand' : 'maid') : null;
  }
  // What in the caches the edges do not say, as lines (empty: they agree): the household caches, each live household's holder and village,
  // each farm's line, each open union, each living pawn's one family and the role its edges settle, each village's culture and alderman
  // (tests/lib/invariants.js).
  function check(st) {
    if (!st.edges) return [];
    const bad = [],
      d = derive(st),
      one = (l) => (l.length === 1 ? st.edges[l[0]] : null),
      eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
    for (const p of st.pawns) {
      if (p.household !== d.household[p.id])
        bad.push(`pawns[${p.id}].household ${p.household}, the edges ${d.household[p.id]}`);
      if (p.servant !== d.servant[p.id]) bad.push(`pawns[${p.id}].servant ${p.servant}, the edges ${d.servant[p.id]}`);
      else if (p.servant && p.servedSince !== d.servedSince[p.id])
        bad.push(`pawns[${p.id}].servedSince ${p.servedSince}, the edges ${d.servedSince[p.id]}`);
      if (p.died === null) {
        if (liveFrom(st, 'family', p.id).length !== 1) bad.push(`pawns[${p.id}]: not one live family edge`);
        const r = roleOf(st, p);
        if (r !== null && r !== p.role) bad.push(`pawns[${p.id}]: role cache ${p.role}, the edges ${r}`);
      }
    }
    for (const hh of st.households) {
      const m = hh.dissolved ? [] : d.members.get(hh.id) || [];
      if (!eq(hh.members, m)) bad.push(`households[${hh.id}].members ${hh.members}, the edges ${m}`);
      if (hh.dissolved) continue;
      const h = liveTo(st, 'holder', hh.id).map((k) => st.edges[k].from);
      if (!eq(h, hh.holder === null || hh.holder === undefined ? [] : [hh.holder]))
        bad.push(`households[${hh.id}].holder ${hh.holder}, the edges ${h}`);
      const v = one(liveFrom(st, 'village', hh.id));
      if (!v || v.to !== st.farmsteads[hh.farmstead].village) bad.push(`households[${hh.id}]: its village edge`);
    }
    for (const f of st.farmsteads) {
      const l = liveTo(st, 'line', f.id).map((k) => st.edges[k].from);
      if (!eq(l, f.line === null || f.line === undefined ? [] : [f.line]))
        bad.push(`farmsteads[${f.id}].line ${f.line}, the edges ${l}`);
    }
    for (const u of st.unions)
      if (u.end === null && u.start <= st.t)
        for (const [a, b] of [
          [u.a, u.b],
          [u.b, u.a],
        ])
          if (!liveFrom(st, 'spouse', a).some((k) => st.edges[k].to === b))
            bad.push(`unions[${u.id}]: no live spouse edge ${a} to ${b}`);
    if (st.cenv)
      for (const s of st.cenv.settlements) {
        const c = one(liveFrom(st, 'culture', s.id));
        if (!c || c.to !== s.culture) bad.push(`villages[${s.id}]: its culture edge`);
      }
    for (const v of st.villages || []) {
      const a = liveTo(st, 'alderman', v.id).map((k) => st.edges[k].from),
        want = v.alderman === null || v.alderman === undefined ? [] : [v.alderman];
      if (!eq(a, want)) bad.push(`villages[${v.id}].alderman ${v.alderman}, the edges ${a}`);
    }
    return bad;
  }
  return {
    liveFrom,
    liveTo,
    link,
    end,
    leave,
    single,
    cultureOf,
    made,
    dissolved,
    wed,
    unwed,
    born,
    died,
    migrate,
    check,
  };
})();
