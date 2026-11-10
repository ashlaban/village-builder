// @sys sim/saves: saving and loading a run (VB-074): the state as JSON-compatible data, with shared objects, Maps, Sets and typed arrays kept
VB['sim/saves'] = (() => {
  const { setBiome } = VB['gen'];
  const { seal } = VB['sim/registry'];
  const { trimRoutes } = VB['sim/routes'];
  const { rebuildLiving } = VB['sim/records'];
  const { close: closeLedger } = VB['sim/stores'];
  const { migrateTies } = VB['sim/relations'];
  const { seedPlans } = VB['sim/plans'];
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
  function encode(root, stop = null) {
    // pass 1: which objects are reached more than once
    const count = new Map(), stack = [root];
    while (stack.length) {
      const v = stack.pop();
      if (v === null || typeof v !== 'object') continue;
      const n = (count.get(v) || 0) + 1; count.set(v, n);
      if (n > 1 || ArrayBuffer.isView(v)) continue;
      if (v instanceof Map) for (const [k, x] of v) stack.push(k, x);
      else if (v instanceof Set) for (const x of v) stack.push(x);
      else if (Array.isArray(v)) for (const x of v) stack.push(x);
      else for (const k of Object.keys(v)) stack.push(v[k]);
    }
    // pass 2: write it out
    const ids = new Map();
    const enc = (v, where) => {
      if (v === undefined) return { $undef: 1 };
      if (typeof v === 'number') {
        if (Number.isNaN(v)) return { $num: 'NaN' };
        if (!Number.isFinite(v)) return { $num: v > 0 ? 'Infinity' : '-Infinity' };
        return Object.is(v, -0) ? { $num: '-0' } : v;
      }
      if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
      if (typeof v !== 'object') throw new Error(`save: a ${typeof v} at ${where}`);
      if (stop && stop.has(v)) throw new Error(`save: ${where} reaches an object that is not saved with the state`);
      if (ids.has(v)) return { $ref: ids.get(v) };
      const shared = count.get(v) > 1, id = shared ? ids.size : -1;
      if (shared) ids.set(v, id);
      const tag = (o) => (shared ? { $id: id, ...o } : o);
      if (ArrayBuffer.isView(v)) {
        const type = v.constructor.name;
        if (TYPED[type] !== v.constructor) throw new Error(`save: a ${type} at ${where}`);
        return tag({ $ta: type, b64: bytesToB64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) });
      }
      if (v instanceof Map) return tag({ $map: [...v].map(([k, x], i) => [enc(k, `${where}<key ${i}>`), enc(x, `${where}.get(${k})`)]) });
      if (v instanceof Set) return tag({ $set: [...v].map((x, i) => enc(x, `${where}{${i}}`)) });
      if (Array.isArray(v)) {
        const a = [];
        for (let i = 0; i < v.length; i++) a.push(i in v ? enc(v[i], `${where}[${i}]`) : { $undef: 1 });
        return shared ? { $id: id, $arr: a } : a;
      }
      if (!isPlain(v)) throw new Error(`save: a ${v.constructor ? v.constructor.name : 'object'} at ${where}`);
      const o = shared ? { $id: id } : {};
      for (const k of Object.keys(v)) o[k[0] === '$' ? '$' + k : k] = enc(v[k], `${where}.${k}`);
      return o;
    };
    return enc(root, 'st');
  }
  function decode(data) {
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
  // also recomputes the tile's colours from it; dev, wear and worn are added to the world by seeding.
  const WORLD = ['trees', 'treesMax', 'stones', 'biome', 'dev', 'wear', 'worn'];
  const FORMAT = 1;
  // A save: the format, what makes the world (scenario, seed, size), the tiles above and the whole state, with st.w as null in its place.
  function save(st) {
    const w = st.w, state = {};
    for (const k of Object.keys(st)) state[k] = k === 'w' ? null : st[k];
    const world = {};
    for (const k of WORLD) if (w[k]) world[k] = encode(w[k]);
    return { format: FORMAT, scenario: st.scenario, seed: w.seed, cols: w.COLS, rows: w.ROWS, world, state: encode(state, new Set([w])) };
  }
  // A state from a save, on w: a world freshly generated from the save's seed and size.
  function load(w, data) {
    if (!data || data.format !== FORMAT) throw new Error(`load: format ${data && data.format}, this build reads ${FORMAT}`);
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
    const st = decode(enc);
    st.w = w;
    rebuildLiving(st);
    trimRoutes(st);
    for (const v of st.villages) if (!v.ledger) v.ledger = [];
    // VB-204: saves before the yearly totals keep their routine entries; new movements of those kinds go to totals.
    for (const h of [...st.households, ...st.villages]) if (!h.totals) h.totals = [];
    for (const hh of st.households) if (hh.dissolved && hh.ledger.length) closeLedger(st, hh); // older saves kept them (VB-204)
    // VB-159: older format-1 saves predate the cumulative barn-hay loss.
    for (const hh of st.households) if (hh.haySpoilt === undefined) hh.haySpoilt = 0;
    if (st.player === undefined) st.player = null; // VB-169: older saves have no player
    if (st.player && !st.player.wishes) st.player.wishes = { out: null, claim: null, serve: null }; // VB-212: nor a player's wishes
    if (st.player && st.player.left === undefined) st.player.left = null; // VB-213
    if (!st.plans) seedPlans(st); // VB-258: older saves have no plans
    migrateTies(st); // VB-127: older saves' ties go on a scale from now, at most the cap
    return st;
  }
  return { encode, decode, save, load, FORMAT };
})();
