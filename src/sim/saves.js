// @sys sim/saves: saving and loading a run (VB-074): the state as JSON-compatible data, with shared objects, Maps, Sets and typed arrays kept
VB['sim/saves'] = (() => {
  const { setBiome } = VB['gen'];
  const { seal } = VB['sim/registry'];
  const { trimRoutes } = VB['sim/routes'];
  const { rebuildLiving, indexEvents } = VB['sim/records'];
  const { close: closeLedger } = VB['sim/stores'];
  const { migrateTies } = VB['sim/relations'];
  const { seedPlans, fillPlans } = VB['sim/plans'], Plans = VB['sim/plans'], { BREAK_HOURS } = VB['sim/fields'], { seedPer } = VB['sim/hunger'];
  const { TICKS } = VB['sim/rules'];
  const { makeStream } = VB['sim/rng'];
  const { reckonWood } = VB['sim/territory'];
  const { initFish } = VB['sim/fish'], { initForage } = VB['sim/forage'];
  // ---- encoding a graph of plain data ----
  // encode(v) gives JSON-compatible data; decode(encode(v)) is a deep copy of v with the same sharing: an object reached twice comes back as
  // one object. An object reached more than once carries "$id" where it first appears (in the order of a depth-first walk) and is "$ref"
  // after. Maps are {"$map": [[k, v], ...]}, Sets {"$set": [...]}, typed arrays {"$ta": type, "b64": bytes}, arrays shared or not plain
  // arrays; NaN, Infinity, -Infinity, -0 and undefined are {"$num": ...} and {"$undef": 1}; a key starting with "$" gets one more "$".
  // Any other kind of object (a function, a class instance) is an error: the state is plain data (VB-073).
  const TYPED = { Float32Array, Float64Array, Int8Array, Int16Array, Int32Array, Uint8Array, Uint16Array, Uint32Array, Uint8ClampedArray };
  const isPlain = (v) => { const p = Object.getPrototypeOf(v); return p === Object.prototype || p === null; };
  function bytesToB64(bytes) {
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function b64ToBytes(b64) {
    if (typeof Buffer !== 'undefined') { const b = Buffer.from(b64, 'base64'); return new Uint8Array(b.buffer, b.byteOffset, b.length).slice(); }
    const s = atob(b64), out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  // VB-226: what JSON already writes as it is (a plain object or array, not shared, of finite numbers, strings, booleans, null and such
  // objects, with no key starting with "$") is returned as it is, not copied: the save shares those parts with the state, so it is
  // written out (JSON.stringify) before the state changes. A Map is {"$kv": [k, v, k, v, ...]} (format 2; "$map" is still read).
  const UNDEF = Object.freeze({ $undef: 1 });
  // pack: a Map of an object to {as, data}; the object is written as {"$as": as, "v": data} and decode(..., revive) makes it again with
  // revive[as](data). The object and what it holds are not walked: they must be reached from nowhere else.
  // A value JSON writes as it is: a string, a boolean or a finite number other than -0 (null is checked apart).
  const asIs = (x) => typeof x === 'string' || typeof x === 'boolean' || (typeof x === 'number' && x === x && x !== Infinity && x !== -Infinity
    && (x !== 0 || 1 / x > 0));
  function encode(root, stop = null, pack = null) {
    // pass 1: which objects are reached more than once. count holds 1, 2... for an object reached once, twice...; a packed object starts
    // at -1 and goes down (-2 reached once, -3 or less shared), so neither pass looks it up in pack.
    const count = new Map(), stack = [root];
    if (pack) for (const o of pack.keys()) count.set(o, -1);
    while (stack.length) {
      const v = stack.pop(), c = count.get(v);
      if (c !== undefined) { count.set(v, c < 0 ? c - 1 : c + 1); continue; }
      count.set(v, 1);
      if (ArrayBuffer.isView(v)) continue;
      if (v instanceof Map) {
        for (const [k, x] of v) {
          if (k !== null && typeof k === 'object') stack.push(k);
          if (x !== null && typeof x === 'object') stack.push(x);
        }
      } else if (v instanceof Set) { for (const x of v) if (x !== null && typeof x === 'object') stack.push(x); }
      else if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) { const x = v[i]; if (x !== null && typeof x === 'object') stack.push(x); } }
      else for (const k in v) { const x = v[k]; if (x !== null && typeof x === 'object' && Object.hasOwn(v, k)) stack.push(x); }
    }
    // pass 2: write it out; the path to the value being written is kept as (kind, key) pairs and spelled out only for an error
    const ids = new Map(), path = [];
    const SPELL = [(x) => `[${x}]`, (x) => `.${x}`, (x) => `<key ${x}>`, (x) => `.get(${x})`, (x) => `{${x}}`];
    const where = () => { let s = 'st'; for (let i = 0; i < path.length; i += 2) s += SPELL[path[i]](path[i + 1]); return s; };
    const tagged = (id, o) => (id < 0 ? o : { $id: id, ...o });
    const enc = (v) => {
      if (v === null || asIs(v)) return v;
      if (typeof v === 'number') return Number.isNaN(v) ? { $num: 'NaN' } : !Number.isFinite(v) ? { $num: v > 0 ? 'Infinity' : '-Infinity' } : { $num: '-0' };
      if (v === undefined) return UNDEF;
      if (typeof v !== 'object') throw new Error(`save: a ${typeof v} at ${where()}`);
      if (stop && stop.has(v)) throw new Error(`save: ${where()} reaches an object that is not saved with the state`);
      const c = count.get(v), shared = c > 1 || c < -2;
      if (shared && ids.has(v)) return { $ref: ids.get(v) };
      const id = shared ? ids.size : -1;
      if (shared) ids.set(v, id);
      if (c < 0) { const p = pack.get(v); return tagged(id, { $as: p.as, v: enc(p.data) }); }
      if (ArrayBuffer.isView(v)) {
        const type = v.constructor.name;
        if (TYPED[type] !== v.constructor) throw new Error(`save: a ${type} at ${where()}`);
        return tagged(id, { $ta: type, b64: bytesToB64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) });
      }
      if (v instanceof Map) {
        const a = [];
        let i = 0;
        for (const [k, x] of v) {
          path.push(2, i++); a.push(enc(k));
          path[path.length - 2] = 3; path[path.length - 1] = k; a.push(enc(x));
          path.length -= 2;
        }
        return tagged(id, { $kv: a });
      }
      if (v instanceof Set) {
        const a = [];
        let i = 0;
        for (const x of v) { path.push(4, i++); a.push(enc(x)); path.length -= 2; }
        return tagged(id, { $set: a });
      }
      if (Array.isArray(v)) {
        let a = null;
        for (let i = 0; i < v.length; i++) {
          const x = v[i];
          let e = x;
          if (!(x === null || asIs(x))) {
            if (i in v) { path.push(0, i); e = enc(x); path.length -= 2; } else e = UNDEF;
          }
          if (a !== null) a.push(e);
          else if (e !== x || e === UNDEF) { a = v.slice(0, i); a.push(e); }
        }
        return shared ? { $id: id, $arr: a || v } : a || v;
      }
      if (!isPlain(v)) throw new Error(`save: a ${v.constructor ? v.constructor.name : 'object'} at ${where()}`);
      const keys = Object.keys(v);
      let o = shared ? { $id: id } : null;
      for (let j = 0; j < keys.length; j++) {
        const k = keys[j], x = v[k];
        let e = x;
        if (!(x === null || asIs(x))) { path.push(1, k); e = enc(x); path.length -= 2; }
        if (o === null) {
          if (e === x && k.charCodeAt(0) !== 36) continue;
          o = {};
          for (let q = 0; q < j; q++) o[keys[q]] = v[keys[q]];
        }
        o[k.charCodeAt(0) === 36 ? '$' + k : k] = e;
      }
      return o === null ? v : o;
    };
    return enc(root);
  }
  function decode(data, revive = {}) {
    const byId = [];
    const dec = (d) => {
      if (d === null || typeof d !== 'object') return d;
      if (Array.isArray(d)) return d.map(dec);
      if ('$ref' in d) return byId[d.$ref];
      if ('$undef' in d) return undefined;
      if ('$num' in d) return d.$num === '-0' ? -0 : Number(d.$num);
      const keep = (v) => { if ('$id' in d) byId[d.$id] = v; return v; };
      if ('$ta' in d) {
        const T = TYPED[d.$ta], bytes = b64ToBytes(d.b64);
        if (!T) throw new Error(`load: unknown typed array ${d.$ta}`);
        return keep(new T(bytes.buffer, 0, bytes.byteLength / T.BYTES_PER_ELEMENT));
      }
      if ('$as' in d) {
        if (!Object.hasOwn(revive, d.$as)) throw new Error(`load: no way to make a packed ${d.$as}`);
        return keep(revive[d.$as](dec(d.v)));
      }
      if ('$kv' in d) {
        const m = keep(new Map()), a = d.$kv;
        for (let i = 0; i < a.length; i += 2) { const key = dec(a[i]); m.set(key, dec(a[i + 1])); }
        return m;
      }
      if ('$map' in d) { const m = keep(new Map()); for (const [k, x] of d.$map) { const key = dec(k); m.set(key, dec(x)); } return m; }
      if ('$set' in d) { const s = keep(new Set()); for (const x of d.$set) s.add(dec(x)); return s; }
      if ('$arr' in d) { const a = keep([]); for (const x of d.$arr) a.push(dec(x)); return a; }
      // The object gets all its keys at once, in order, and then its values (VB-205): given one keyed store at a time, an object of more
      // than a few dozen keys (a pawn, the state) becomes a slow dictionary, and every read of it a hash lookup for the rest of the run.
      // Most have no key that starts with $ and are copied whole ({...d}); a shared one ($id) or one with an escaped key is built from its
      // list of keys.
      const keys = Object.keys(d);
      if (!keys.some((k) => k[0] === '$')) {
        const o = { ...d };
        for (const k of keys) o[k] = dec(d[k]);
        return o;
      }
      const own = keys.filter((k) => k !== '$id'), name = (k) => (k[0] === '$' ? k.slice(1) : k);
      const o = keep(Object.fromEntries(own.map((k) => [name(k), undefined])));
      for (const k of own) o[name(k)] = dec(d[k]);
      return o;
    };
    return dec(data);
  }
  // ---- a run ----
  // The tiles the simulation changes (grep writes to w. in src/sim): kept whole, one value a tile. biome is applied with setBiome, which
  // also recomputes the tile's colours from it; dev, wear, worn, fish, fishDay, forage and forageYear are added to the world by seeding.
  const WORLD = ['trees', 'treesMax', 'stones', 'biome', 'dev', 'wear', 'worn', 'fish', 'fishDay', 'forage', 'forageYear'];
  WORLD.push('depositLeft', 'depositFull', 'dugDay'); // VB-359: what has been dug (sim/dig); a save without them was never dug
  // Format 2 (VB-226): Maps as "$kv", and each pawn's relationship records (pawn.rel) packed in one flat array, [other, band, the number
  // of memories, then kind, v, t for each, ...]: they were two thirds of the objects a save walked.
  // Format 3 (VB-259): the household's cooked store is hh.meals, no longer hh.rations; older saves are refused, as another build's.
  // Since VB-240 a record has no band (pawn.bands holds them): its slot is written 0 and not read.
  // Format 4 (VB-342): the same data, on another island: the generator's climate and rivers changed what a seed makes, and a save lies on
  // its seed's island as generated (heights, rivers and moisture are not saved), so older saves are refused.
  const FORMAT = 4, READS = [4];
  function packRel(rel) {
    const a = [];
    for (const [j, r] of rel) {
      a.push(j, 0, 0);
      const at = a.length - 1;
      for (const kind in r.mem) { const m = r.mem[kind]; a.push(kind, m.v, m.t); a[at]++; }
    }
    return a;
  }
  function unpackRel(a) {
    const rel = new Map();
    for (let i = 0; i < a.length;) {
      const j = a[i], n = a[i + 2], mem = {};
      i += 3;
      for (let q = 0; q < n; q++, i += 3) mem[a[i]] = { v: a[i + 1], t: a[i + 2] };
      rel.set(j, { mem });
    }
    return rel;
  }
  const REVIVE = { rel: unpackRel };
  // A save: the format, what makes the world (scenario, seed, size), the tiles above and the whole state, with st.w as null in its place.
  // It shares parts with the state (encode): write it out before the state changes.
  function save(st) {
    const w = st.w, state = {};
    for (const k of Object.keys(st)) state[k] = k === 'w' ? null : st[k];
    const world = {};
    for (const k of WORLD) if (w[k]) world[k] = encode(w[k]);
    const pack = new Map();
    for (const p of st.pawns) if (p.rel instanceof Map) pack.set(p.rel, { as: 'rel', data: packRel(p.rel) });
    return { format: FORMAT, scenario: st.scenario, seed: w.seed, cols: w.COLS, rows: w.ROWS, world, state: encode(state, new Set([w]), pack) };
  }
  // A state from a save, on w: a world freshly generated from the save's seed and size.
  function load(w, data) {
    if (!data || !READS.includes(data.format)) throw new Error(`load: format ${data && data.format}, this build reads ${READS.join(' and ')}`);
    if (w.seed !== data.seed || w.COLS !== data.cols || w.ROWS !== data.rows) {
      throw new Error(`load: the save is of seed ${data.seed}, ${data.cols} by ${data.rows}; the world is seed ${w.seed}, ${w.COLS} by ${w.ROWS}`);
    }
    seal();
    for (const k of WORLD) {
      if (!(k in data.world)) continue;
      const a = decode(data.world[k]);
      if (k === 'biome') { for (let i = 0; i < a.length; i++) if (w.biome[i] !== a[i]) setBiome(w, i, a[i]); }
      else if (w[k] && w[k].constructor === a.constructor && w[k].length === a.length) w[k].set(a);
      else w[k] = a;
    }
    // VB-127: older saves kept the hours spent near each other (st.contacts); it is left out here rather than deleted after, so st keeps
    // fast properties (VB-205).
    let enc = data.state;
    // VB-099: nor the 40-line text log (st.events), which the record replaces.
    if (enc && ('contacts' in enc || 'events' in enc)) { enc = { ...enc }; delete enc.contacts; delete enc.events; }
    const st = decode(enc, REVIVE);
    st.w = w;
    if (!w.fish) initFish(w); // VB-117: older saves have no fish stocks
    if (!w.forage) initForage(w); // VB-118: nor stocks of wild food
    // VB-235: older saves have no count of 6-minute steps; their st.t, a float, gives it (st.t is rewritten from it by the next step)
    if (st.tick === undefined) { st.tick = Math.round(st.t * TICKS); }
    // VB-244: the page no longer runs a part of a step; a save made in the middle of one goes on from its last whole step
    // VB-285: and the field that held that part is gone
    if ('tickPart' in st) { if (st.tickPart) st.t = st.tick / TICKS; delete st.tickPart; }
    rebuildLiving(st);
    indexEvents(st); // VB-199: older saves kept a copy of each event on its pawn, and no fold
    trimRoutes(st);
    for (const v of st.villages) if (!v.ledger) v.ledger = [];
    // VB-204: saves before the yearly totals keep their routine entries; new movements of those kinds go to totals.
    for (const h of [...st.households, ...st.villages]) if (!h.totals) h.totals = [];
    for (const hh of st.households) if (hh.dissolved && hh.ledger.length) closeLedger(st, hh); // older saves kept them (VB-204)
    // VB-159: older format-1 saves predate the cumulative barn-hay loss.
    for (const hh of st.households) if (hh.haySpoilt === undefined) hh.haySpoilt = 0;
    for (const hh of st.households) if (hh.clay === undefined) { hh.clay = 0; hh.bogOre = 0; } // VB-359: nor dug loads
    if (st.player === undefined) st.player = null; // VB-169: older saves have no player
    if (st.player && !st.player.wishes) st.player.wishes = { out: null, claim: null, serve: null }; // VB-212: nor a player's wishes
    if (st.player && st.player.wishes.match === undefined) st.player.wishes.match = null; // VB-274: nor a wish for a match
    if (st.player && st.player.left === undefined) st.player.left = null; // VB-213
    if (!st.rng.traits) st.rng.traits = makeStream(st.w.seed, 'traits'); // VB-249: nor the stream of the traits' stand-ins
    // VB-257: older saves' cultures hold no practices (each holds those every culture starts with); their villages' plans no routines
    const practices = () => Object.fromEntries(Object.entries(VB['culture'].PRACTICES).map(([k, x]) => [k, x.base]));
    if (st.cenv) for (const c of st.cenv.cultures) if (!c.practices) c.practices = practices();
    if (!st.plans) seedPlans(st); // VB-258: older saves have no plans
    else fillPlans(st); // VB-248: nor targets and reservations
    oldProjects(st); // VB-123: nor project plans
    if (!st.offers) { st.offers = []; st.offerSeq = 0; } // VB-293: nor marriage offers
    if (!st.occasions) { st.occasions = []; st.occasionSeq = 0; } // VB-126: nor occasions, nor their stream
    if (!st.rng.occasions) st.rng.occasions = makeStream(data.seed, 'occasions');
    if (!st.finds) { st.finds = new Map(); st.rng.prospect = makeStream(data.seed, 'prospect'); } // VB-358: nor what the villages have found
    for (const a of st.agents) if (a.occasion === undefined) a.occasion = null;
    // VB-326: older saves had one tile of wood a village (v.commonsWood) and a farm (f.woodlot); the village's wood is reckoned now
    if (!st.rng.forest) st.rng.forest = makeStream(data.seed, 'forest');
    for (const f of st.farmsteads) if ('woodlot' in f) delete f.woodlot;
    for (const v of st.villages) if (!v.wood) { delete v.commonsWood; reckonWood(st, v); }
    for (const f of st.farmsteads) if (f.grade === undefined) f.grade = 'ground'; // VB-332: older saves' houses stand on the ground
    for (const f of st.farmsteads) for (const fd of f.fields) if (fd.crop === undefined) fd.crop = 'barley'; // VB-346: older saves' fields held barley
    migrateTies(st); // VB-127: older saves' ties go on a scale from now, at most the cap; VB-240: talk's memories go, bands are set
    return st;
  }
  // ---- saves made before project plans (VB-123; sim/plans makes them now) ----
  // A save made before project plans held a farm's land project on the farm ({tile, stage, hours}): its household's plan now.
  function fromFarms(st) {
    for (const f of st.farmsteads) {
      const p = f.project, hh = p && f.household !== null ? st.households[f.household] : null, why = p && p.stage === 'meadow' ? 'meadow' : 'field';
      const step = (kind, hours) => ({ kind, place: p.tile, hours, stake: why });
      if (hh && !hh.dissolved) Plans.makeProject(st, 'household', hh.id, { what: why, hold: { grain: seedPer(st, hh) },
        steps: p.stage === 'clear' ? [step('clear', p.hours), step('break', BREAK_HOURS)] : [step(p.stage, p.hours)] });
      if ('project' in f) delete f.project;
    }
  }
  // A save made before plot plans (VB-123) kept every plot in village.plots: one under way becomes its village's project plan (its jobs
  // pointed at it), one built the village's record of it (sim/expansion).
  function fromPlots(st) {
    const HOURS = { foundation: 30, walls: 60, roof: 30 };
    for (const v of st.villages) {
      if (!(v.plots || []).some((p) => 'done' in p)) continue;
      const old = v.plots; v.plots = [];
      for (const p of old) {
        const { id, intended, holder, started, farmstead } = p;
        const tiles = p.tiles.map((t) => ({ tile: t.tile, kind: t.kind }));
        if (p.built) { v.plots.push({ id, village: v.id, intended, holder, started, farmstead, tiles }); continue; }
        const k = p.cottage || { i: 0, done: 0 }, stage = (kind, i) => ({ kind, place: p.tiles[0].tile, hours: HOURS[kind],
          done: i < k.i ? HOURS[kind] : i === k.i ? k.done : 0, ...kind === 'walls' ? { wood: p.wood || 0 } : {} });
        const plan = Plans.makeProject(st, 'village', v.id, { what: 'plot', plot: p.id, intended: p.intended, to: p.done ? p.holder : null,
          hours: p.hours, started: p.started, steps: [{ kind: 'clear', places: p.tiles }, ...['foundation', 'walls', 'roof'].map(stage)] });
        plan.open = p.done ? Math.min(3, 1 + k.i) : 0;
        if (k.i >= 3) plan.steps[3].done = HOURS.roof;
        for (const j of st.jobs.values()) { if (j.plot === p) j.plot = plan; if (j.timberFor === p) j.timberFor = plan.steps[2]; }
      }
    }
  }
  // Both, at every load (a save made since has none of either).
  const oldProjects = (st) => { fromFarms(st); fromPlots(st); };
  return { encode, decode, save, load, FORMAT, READS, oldProjects };
})();
