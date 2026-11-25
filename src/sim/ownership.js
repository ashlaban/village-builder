// @sys sim/ownership: who holds each tile: its user (st.owner, the household or village that works it, which every rule of work reads) and,
// where another party owns it, the title (st.titles: own and use held apart, VB-311); and which farms are held in trust (read only; VB-309)
VB['sim/ownership'] = (() => {
  // @state st.owner: Int32Array, one per tile, its user (who works it); 0 = nobody, n > 0 = household n - 1, n < 0 = village -n - 1. The
  //   user's cache: a farm's tiles are its household's (its village's when it stands empty) unless a title gives a holding another user.
  const party = (n) => (n === 0 ? null : n > 0 ? { type: 'household', id: n - 1 } : { type: 'village', id: -n - 1 });
  const code = (p) => (!p ? 0 : p.type === 'household' ? p.id + 1 : -p.id - 1);
  const userOf = (st, tile) => party(st.owner[tile]);
  // owner is {type: 'household'|'village', id} or null; the tile is marked for the Land overlay (st.landDirty, sim/claims)
  const setOwner = (st, tile, owner) => {
    st.owner[tile] = code(owner);
    if (st.landDirty) st.landDirty.add(tile);
  };
  // Seeding: house and fields belong to the household, or to the village when the farm stands empty; the centre (unless it is a house)
  // belongs to the village. Its wood is claimed as outland (sim/territory, VB-326).
  function seedOwners(st) {
    st.owner = new Int32Array(st.w.N);
    for (const v of st.villages) {
      setOwner(st, v.center, { type: 'village', id: v.id });
    }
    for (const f of st.farmsteads) {
      const o = f.household === null ? { type: 'village', id: f.village } : { type: 'household', id: f.household };
      setOwner(st, f.house, o);
      for (const fd of f.fields) setOwner(st, fd.tile, o);
    }
  }
  // A farm that stands empty passes to its village, with its fields and meadows.
  function farmToVillage(st, f) {
    const o = { type: 'village', id: f.village };
    setOwner(st, f.house, o);
    for (const fd of f.fields) setOwner(st, fd.tile, o);
    for (const m of f.meadows || []) setOwner(st, m.tile, o);
  }
  // ---- farms held in trust (VB-309; st.trusts and st.liveTrusts, written by sim/trust) ----
  // A farm held in trust is worked by a kin household that does not own it: the owner stays the household that holds it. Read here, by the
  // systems loaded before sim/trust (the job board, the plans, the clock); a few live trusts at most, so a walk over them allocates nothing.
  const NONE = [];
  // The live trust of the farm of household hhId, or null.
  function trustOf(st, hhId) {
    const live = st.liveTrusts || NONE;
    for (let i = 0; i < live.length; i++) if (st.trusts[live[i]].household === hhId) return st.trusts[live[i]];
    return null;
  }
  // The live trust whose farm pawn `id` holds (it lives with the trustee), or null.
  function trustOfHolder(st, id) {
    const live = st.liveTrusts || NONE;
    for (let i = 0; i < live.length; i++)
      if (st.households[st.trusts[live[i]].household].holder === id) return st.trusts[live[i]];
    return null;
  }
  // The farms household hhId holds in trust for kin, in the order of the trusts (none: a shared empty list).
  function heldFarms(st, hhId) {
    const live = st.liveTrusts || NONE;
    let out = NONE;
    for (let i = 0; i < live.length; i++) {
      const t = st.trusts[live[i]];
      if (t.trustee !== hhId) continue;
      if (out === NONE) out = [];
      out.push(st.farmsteads[st.households[t.household].farmstead]);
    }
    return out;
  }
  // ---- titles: own and use held apart (VB-311; design.md, Land and rights) ----
  // @state st.titles: Map of holding to title, only for the holdings split off their farm or whose own and use lie with different parties;
  //   absent until the first. A holding is named by its tile: a farm by its house (with its fields and meadows not split off), a field or a
  //   meadow by its own. A title: {kind 'farm'|'field'|'meadow', farm (farmstead id), owner, user ({type, id}), since (hour), basis, rent
  //   (the share of each harvest owed the owner), why}. st.owner[t] is the title's user on each of its holding's tiles.
  const titlesOf = (st) => (st.titles && st.titles.size ? st.titles : null);
  // The tiles of holding `key` under title t: a field or meadow its own; a farm its house and the fields and meadows not split off.
  function tilesOf(st, key, t) {
    if (t.kind !== 'farm') return [key];
    const f = st.farmsteads[t.farm],
      out = [f.house];
    for (const x of [...f.fields, ...(f.meadows || [])]) if (!st.titles.has(x.tile)) out.push(x.tile);
    return out;
  }
  // The title over tile `tile` (its own holding's, else its farm's), or null; a walk over the titles, tens at most.
  function titleAt(st, tile) {
    const T = titlesOf(st);
    if (!T) return null;
    const t = T.get(tile);
    if (t) return t;
    for (const [key, u] of T) if (u.kind === 'farm' && tilesOf(st, key, u).includes(tile)) return u;
    return null;
  }
  // Who owns tile: the title's owner, else its user ({type, id} or null).
  const ownerOf = (st, tile) => {
    const t = titleAt(st, tile);
    return t ? { ...t.owner } : userOf(st, tile);
  };
  // The owner's code (st.owner's coding) of every tile under a title, for a reader that walks the tiles: null when there is none.
  function ownedCodes(st) {
    const T = titlesOf(st);
    if (!T) return null;
    const m = new Map();
    for (const [key, t] of T) for (const tile of tilesOf(st, key, t)) m.set(tile, code(t.owner));
    return m;
  }
  const same = (a, b) => !!a && !!b && a.type === b.type && a.id === b.id;
  // The holdings (their keys) whose `right` ('own' or 'use') lies with party {type, id}: the farms, by farmstead, then the holdings split off.
  function holdingsOf(st, who, right) {
    if (right !== 'own' && right !== 'use') throw new Error(`holdingsOf: no right ${right}`);
    const T = st.titles || new Map(),
      out = [];
    for (const f of st.farmsteads) {
      const t = T.get(f.house),
        p = right === 'own' && t ? t.owner : userOf(st, f.house);
      if (same(p, who)) out.push(f.house);
    }
    for (const [key, t] of T) if (t.kind !== 'farm' && same(right === 'own' ? t.owner : t.user, who)) out.push(key);
    return out;
  }
  // The fields household hhId owns (the share rule counts them, SHARES.perField): its farm's, with the titles' gains and losses.
  function fieldsOwned(st, hhId) {
    const own = st.farmsteads[st.households[hhId].farmstead],
      T = titlesOf(st);
    if (!T) return own.fields.length;
    const farms = new Set([own.id]);
    for (const t of T.values()) if (t.owner.type === 'household' && t.owner.id === hhId) farms.add(t.farm);
    let n = 0;
    for (const id of farms) for (const fd of st.farmsteads[id].fields) if (code(ownerOf(st, fd.tile)) === hhId + 1) n++;
    return n;
  }
  const mark = (st, key, t) => {
    if (st.landDirty) for (const tile of tilesOf(st, key, t)) st.landDirty.add(tile);
  };
  // The title of holding `key`, made (own and use with today's holders) if it has none: a farm by its house, or a holding split off.
  function titleFor(st, key, why) {
    if (!st.titles) st.titles = new Map();
    let t = st.titles.get(key);
    if (t) return t;
    const f = st.farmsteads.find((x) => x.house === key);
    if (!f) throw new Error(`no holding at ${key}: a field is split off its farm first`);
    t = {
      kind: 'farm',
      farm: f.id,
      owner: ownerOf(st, key),
      user: userOf(st, key),
      since: st.t,
      basis: null,
      rent: 0,
      why,
    };
    st.titles.set(key, t);
    return t;
  }
  // Field (or meadow) record fd of farm f becomes a holding of its own, held as its farm was; returns its key (its tile).
  function split(st, f, fd, why) {
    const kind = f.fields.includes(fd) ? 'field' : (f.meadows || []).includes(fd) ? 'meadow' : null;
    if (!kind) throw new Error(`split: tile ${fd.tile} is not a field or meadow of ${f.name}`);
    if (!st.titles) st.titles = new Map();
    if (!st.titles.has(fd.tile)) {
      const t = {
        kind,
        farm: f.id,
        owner: ownerOf(st, fd.tile),
        user: userOf(st, fd.tile),
        since: st.t,
        basis: 'split',
        rent: 0,
        why,
      };
      st.titles.set(fd.tile, t);
      mark(st, fd.tile, t);
    }
    return fd.tile;
  }
  // The holding's own passes to party `to` on `basis` (a ruling, an inheritance); its user works it as before.
  function transfer(st, key, right, to, basis, why) {
    if (right !== 'own') throw new Error(`transfer: only own passes (${right})`);
    const t = titleFor(st, key, why);
    Object.assign(t, { owner: { type: to.type, id: to.id }, since: st.t, basis, why });
    mark(st, key, t);
    return t;
  }
  // The holding's use is granted to party `to` for `rent`, its owner unchanged: its tiles are worked by `to` (st.owner).
  function grant(st, key, right, to, rent, why) {
    if (right !== 'use') throw new Error(`grant: only use is granted (${right})`);
    const t = titleFor(st, key, why);
    Object.assign(t, { user: { type: to.type, id: to.id }, since: st.t, rent, why });
    for (const tile of tilesOf(st, key, t)) setOwner(st, tile, t.user);
    return t;
  }
  // The title ends: the holding is one with its farm again, owned and worked as the farm is (a farm: by its household, or its village when it
  // stands empty). Returns whether there was one.
  function end(st, key, why) {
    const t = st.titles && st.titles.get(key);
    if (!t) return false;
    const tiles = tilesOf(st, key, t);
    st.titles.delete(key);
    const f = st.farmsteads[t.farm],
      back =
        t.kind !== 'farm'
          ? userOf(st, f.house)
          : f.household === null
            ? { type: 'village', id: f.village }
            : { type: 'household', id: f.household };
    for (const tile of tiles) setOwner(st, tile, back);
    void why;
    return true;
  }
  return {
    ownerOf,
    setOwner,
    seedOwners,
    farmToVillage,
    trustOf,
    trustOfHolder,
    heldFarms,
    titleAt,
    ownedCodes,
    holdingsOf,
    fieldsOwned,
    split,
    transfer,
    grant,
    end,
  };
})();
