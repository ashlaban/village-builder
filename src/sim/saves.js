// @sys sim/saves: saving and loading a run (VB-074): the state as JSON-compatible data, with shared objects, Maps, Sets and typed arrays kept
VB['sim/saves'] = (() => {
  const { seal } = VB['sim/registry'];
  const { rebuildLiving } = VB['sim/records'];
  // ---- encoding a graph of plain data ----
  // encode(v) gives JSON-compatible data; decode(encode(v)) is a deep copy of v with the same sharing: an object reached twice comes back as
  // one object. An object reached more than once carries "$id" where it first appears (in the order of a depth-first walk) and is "$ref"
  // after. Maps are {"$map": [[k, v], ...]}, Sets {"$set": [...]}, typed arrays {"$ta": type, "b64": bytes}, arrays shared or not plain
  // arrays; NaN, Infinity, -Infinity, -0 and undefined are {"$num": ...} and {"$undef": 1}; a key starting with "$" gets one more "$".
  // Any other kind of object (a function, a class instance) is an error: the state is plain data (VB-073).
  const TYPED = {
    Float32Array,
    Float64Array,
    Int8Array,
    Int16Array,
    Int32Array,
    Uint8Array,
    Uint16Array,
    Uint32Array,
    Uint8ClampedArray,
  };
  const isPlain = (v) => {
    const p = Object.getPrototypeOf(v);
    return p === Object.prototype || p === null;
  };
  function bytesToB64(bytes) {
    if (typeof Buffer !== 'undefined')
      return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function b64ToBytes(b64) {
    if (typeof Buffer !== 'undefined') {
      const b = Buffer.from(b64, 'base64');
      return new Uint8Array(b.buffer, b.byteOffset, b.length).slice();
    }
    const s = atob(b64),
      out = new Uint8Array(s.length);
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
  const asIs = (x) =>
    typeof x === 'string' ||
    typeof x === 'boolean' ||
    (typeof x === 'number' && x === x && x !== Infinity && x !== -Infinity && (x !== 0 || 1 / x > 0));
  function encode(root, stop = null, pack = null) {
    // pass 1: which objects are reached more than once. count holds 1, 2... for an object reached once, twice...; a packed object starts
    // at -1 and goes down (-2 reached once, -3 or less shared), so neither pass looks it up in pack.
    const count = new Map(),
      stack = [root];
    if (pack) for (const o of pack.keys()) count.set(o, -1);
    while (stack.length) {
      const v = stack.pop(),
        c = count.get(v);
      if (c !== undefined) {
        count.set(v, c < 0 ? c - 1 : c + 1);
        continue;
      }
      count.set(v, 1);
      if (ArrayBuffer.isView(v)) continue;
      if (v instanceof Map) {
        for (const [k, x] of v) {
          if (k !== null && typeof k === 'object') stack.push(k);
          if (x !== null && typeof x === 'object') stack.push(x);
        }
      } else if (v instanceof Set) {
        for (const x of v) if (x !== null && typeof x === 'object') stack.push(x);
      } else if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++) {
          const x = v[i];
          if (x !== null && typeof x === 'object') stack.push(x);
        }
      } else
        for (const k in v) {
          const x = v[k];
          if (x !== null && typeof x === 'object' && Object.hasOwn(v, k)) stack.push(x);
        }
    }
    // pass 2: write it out; the path to the value being written is kept as (kind, key) pairs and spelled out only for an error
    const ids = new Map(),
      path = [];
    const SPELL = [(x) => `[${x}]`, (x) => `.${x}`, (x) => `<key ${x}>`, (x) => `.get(${x})`, (x) => `{${x}}`];
    const where = () => {
      let s = 'st';
      for (let i = 0; i < path.length; i += 2) s += SPELL[path[i]](path[i + 1]);
      return s;
    };
    const tagged = (id, o) => (id < 0 ? o : { $id: id, ...o });
    const enc = (v) => {
      if (v === null || asIs(v)) return v;
      if (typeof v === 'number')
        return Number.isNaN(v)
          ? { $num: 'NaN' }
          : !Number.isFinite(v)
            ? { $num: v > 0 ? 'Infinity' : '-Infinity' }
            : { $num: '-0' };
      if (v === undefined) return UNDEF;
      if (typeof v !== 'object') throw new Error(`save: a ${typeof v} at ${where()}`);
      if (stop && stop.has(v)) throw new Error(`save: ${where()} reaches an object that is not saved with the state`);
      const c = count.get(v),
        shared = c > 1 || c < -2;
      if (shared && ids.has(v)) return { $ref: ids.get(v) };
      const id = shared ? ids.size : -1;
      if (shared) ids.set(v, id);
      if (c < 0) {
        const p = pack.get(v);
        return tagged(id, { $as: p.as, v: enc(p.data) });
      }
      if (ArrayBuffer.isView(v)) {
        const type = v.constructor.name;
        if (TYPED[type] !== v.constructor) throw new Error(`save: a ${type} at ${where()}`);
        return tagged(id, { $ta: type, b64: bytesToB64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) });
      }
      if (v instanceof Map) {
        const a = [];
        let i = 0;
        for (const [k, x] of v) {
          path.push(2, i++);
          a.push(enc(k));
          path[path.length - 2] = 3;
          path[path.length - 1] = k;
          a.push(enc(x));
          path.length -= 2;
        }
        return tagged(id, { $kv: a });
      }
      if (v instanceof Set) {
        const a = [];
        let i = 0;
        for (const x of v) {
          path.push(4, i++);
          a.push(enc(x));
          path.length -= 2;
        }
        return tagged(id, { $set: a });
      }
      if (Array.isArray(v)) {
        let a = null;
        for (let i = 0; i < v.length; i++) {
          const x = v[i];
          let e = x;
          if (!(x === null || asIs(x))) {
            if (i in v) {
              path.push(0, i);
              e = enc(x);
              path.length -= 2;
            } else e = UNDEF;
          }
          if (a !== null) a.push(e);
          else if (e !== x || e === UNDEF) {
            a = v.slice(0, i);
            a.push(e);
          }
        }
        return shared ? { $id: id, $arr: a || v } : a || v;
      }
      if (!isPlain(v)) throw new Error(`save: a ${v.constructor ? v.constructor.name : 'object'} at ${where()}`);
      const keys = Object.keys(v);
      let o = shared ? { $id: id } : null;
      for (let j = 0; j < keys.length; j++) {
        const k = keys[j],
          x = v[k];
        let e = x;
        if (!(x === null || asIs(x))) {
          path.push(1, k);
          e = enc(x);
          path.length -= 2;
        }
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
      const keep = (v) => {
        if ('$id' in d) byId[d.$id] = v;
        return v;
      };
      if ('$ta' in d) {
        const T = TYPED[d.$ta],
          bytes = b64ToBytes(d.b64);
        if (!T) throw new Error(`load: unknown typed array ${d.$ta}`);
        return keep(new T(bytes.buffer, 0, bytes.byteLength / T.BYTES_PER_ELEMENT));
      }
      if ('$as' in d) {
        if (!Object.hasOwn(revive, d.$as)) throw new Error(`load: no way to make a packed ${d.$as}`);
        return keep(revive[d.$as](dec(d.v)));
      }
      if ('$kv' in d) {
        const m = keep(new Map()),
          a = d.$kv;
        for (let i = 0; i < a.length; i += 2) {
          const key = dec(a[i]);
          m.set(key, dec(a[i + 1]));
        }
        return m;
      }
      if ('$map' in d) {
        const m = keep(new Map());
        for (const [k, x] of d.$map) {
          const key = dec(k);
          m.set(key, dec(x));
        }
        return m;
      }
      if ('$set' in d) {
        const s = keep(new Set());
        for (const x of d.$set) s.add(dec(x));
        return s;
      }
      if ('$arr' in d) {
        const a = keep([]);
        for (const x of d.$arr) a.push(dec(x));
        return a;
      }
      const keys = Object.keys(d);
      if (!keys.some((k) => k[0] === '$')) {
        const o = {};
        for (const k of keys) o[k] = dec(d[k]);
        return o;
      }
      const own = keys.filter((k) => k !== '$id'),
        name = (k) => (k[0] === '$' ? k.slice(1) : k);
      const o = keep({});
      for (const k of own) o[name(k)] = dec(d[k]);
      return o;
    };
    return dec(data);
  }
  // ---- a run ----
  // The tiles the simulation changes (grep writes to w. in src/sim): kept whole, one value a tile (the page recolours a world
  // loaded onto, page/loader); dev, wear, worn, fish, fishDay, forage and forageYear are added to the world by seeding.
  const WORLD = [
    'trees',
    'treesMax',
    'stones',
    'biome',
    'dev',
    'wear',
    'worn',
    'fish',
    'fishDay',
    'forage',
    'forageYear',
  ];
  WORLD.push('depositLeft', 'depositFull', 'dugDay'); // VB-359: what has been dug (sim/dig); a save without them was never dug
  WORLD.push('graze'); // VB-136: grazing pressure (sim/herds); a save without it was never grazed
  WORLD.push('fresh'); // VB-1582: the wells (sim/water); a save without it has the natural sources its world was generated with
  WORLD.push('shut'); // VB-816: passage (sim/passage); a save without it has its fields closed at the next day's sweep
  WORLD.push('tended'); // VB-091: the last work on a tile (sim/spread); a save without it has its front made anew
  // Format 2 (VB-226): Maps as "$kv", and each pawn's relationship records (pawn.rel) packed in one flat array, [other, band, the number
  // of memories, then kind, v, t for each, ...]: they were two thirds of the objects a save walked.
  // Format 3 (VB-259): the household's cooked store is hh.meals, no longer hh.rations; older saves are refused, as another build's.
  // Since VB-240 a record has no band (pawn.bands holds them): its slot is written 0 and not read.
  // Format 4 (VB-342): the same data, on another island: the generator's climate and rivers changed what a seed makes, and a save lies on
  // its seed's island as generated (heights, rivers and moisture are not saved), so older saves are refused.
  // Format 5 (VB-247): st.idlers lists agent ids, not agents, and st.cenv holds no people (it was st.pawns); older saves are refused.
  // Format 6 (VB-1751): a pawn's task has no phase (agent.phase is gone: its state is its leg and its hands), a journey's state is
  // agent.journey and the walk home agent.homeward; a save holding a pawn mid-phase is another build's, and refused.
  // Format 7 (VB-1752): every body's plan is a record of steps (plan.body, year, season, ahead; st.plans.pawns, stepSeq), a project's steps
  // carry their ids and links and a task names its step; a save without them is another build's, and refused (no migration is written).
  // Format 8 (VB-1745): a pawn's switch and queue are its controller's (pawn.control, st.controlled, st.queued), not st.player's; a save
  // holding them in st.player is another build's, and refused (no migration is written).
  // Format 9 (VB-1746): a pawn's plan is its controller's (pawn.control.plan), not st.player's, and st.player is the frame only (no
  // `since`, no `plan`); a save holding st.player.plan is another build's, and refused (no migration is written).
  const FORMAT = 9,
    READS = [9];
  function packRel(rel) {
    const a = [];
    for (const [j, r] of rel) {
      a.push(j, 0, 0);
      const at = a.length - 1;
      for (const kind in r.mem) {
        const m = r.mem[kind];
        a.push(kind, m.v, m.t);
        a[at]++;
      }
    }
    return a;
  }
  function unpackRel(a) {
    const rel = new Map();
    for (let i = 0; i < a.length;) {
      const j = a[i],
        n = a[i + 2],
        mem = {};
      i += 3;
      for (let q = 0; q < n; q++, i += 3) mem[a[i]] = { v: a[i + 1], t: a[i + 2] };
      rel.set(j, { mem });
    }
    return rel;
  }
  const REVIVE = { rel: unpackRel };
  // ---- derived state (VB-239) ----
  // The fields of st a save leaves out, each with what rebuilds it on load (null: left null, built where it is next used). Two derivable
  // fields stay saved: st.idlers, since who is in it depends on when in the hour it was made (VB-074), and st.pathCache, since a route
  // searched again after a load may differ from the one cached, so a loaded run would leave the saved one.
  const DERIVED = {
    living: rebuildLiving, // and liveHouseholds with it (sim/records)
    liveHouseholds: null,
    idx: null, // sim/records index, built at its first use
    graph: null, // sim/graph's index of live edges, built at its first use
    stepAt: null, // sim/agents loaded, at the end of a load
    jobsBy: rebuildJobsBy,
    lyingBy: null, // sim/lying, the piles by owner, built at its first use (VB-1775)
    routeKept: null, // sim/routes, built at its first use: a route kept aside is searched again after a load, and found the same (VB-1563)
    routeCosts: null,
    facilityIdx: null, // sim/facilities, by tile and by owner, built at its first use (VB-361)
    followers: null, // sim/followers, the followers by lord, built at its first use (VB-708)
  };
  // st.jobsBy from st.jobs: each owner's open jobs, in the order they were posted (sim/jobs post adds a job to both together)
  function rebuildJobsBy(st) {
    st.jobsBy = new Map();
    for (const j of st.jobs.values()) {
      const k = `${j.owner.type}:${j.owner.id}`;
      if (!st.jobsBy.has(k)) st.jobsBy.set(k, new Set());
      st.jobsBy.get(k).add(j);
    }
  }
  // A save: the format, what makes the world (scenario, seed, size), the tiles above and the whole state, with st.w as null in its place.
  // It shares parts with the state (encode): write it out before the state changes.
  function save(st) {
    const w = st.w,
      state = {};
    for (const k of Object.keys(st)) if (!(k in DERIVED)) state[k] = k === 'w' ? null : st[k];
    const world = {};
    for (const k of WORLD) if (w[k]) world[k] = encode(w[k]);
    const pack = new Map();
    for (const p of st.pawns) if (p.rel instanceof Map) pack.set(p.rel, { as: 'rel', data: packRel(p.rel) });
    return {
      format: FORMAT,
      scenario: st.scenario,
      seed: w.seed,
      lat: w.lat, // VB-807: the climate, which the seed does not make
      cols: w.COLS,
      rows: w.ROWS,
      world,
      state: encode(state, new Set([w]), pack),
    };
  }
  // A save made before a custom was added (VB-555: `outside`, the catalogue's last) holds its arrays by custom shorter than the catalogue:
  // each gains the new customs' blocks from the archetype every culture starts from, which every culture held then, with no draw: the
  // cultures' customs and the villages' practice the archetype's option; an attitude, its anchor and its interest the block of a pawn
  // that holds that option at 0.7, the rest shared; a meeting's last support the same.
  function grownCustoms(st) {
    const C = VB['sim/customs'];
    if (!st.cenv || !st.cenv.cultures.length) return;
    const old = st.cenv.cultures[0].customs.length;
    if (old >= C.DIMS.length) return;
    const base = C.fromArchetype('oldNordic'),
      from = C.OFF[old],
      block = new Float32Array(C.TOTAL - from);
    for (let k = old; k < C.DIMS.length; k++)
      for (let j = 0; j < C.NOPT[k]; j++) block[C.OFF[k] - from + j] = j === base[k] ? 0.7 : 0.3 / (C.NOPT[k] - 1);
    const grow = (a) => {
      if (!a || a.length !== from) return a;
      const out = new Float32Array(C.TOTAL);
      out.set(a);
      out.set(block, from);
      return out;
    };
    const longer = (a) => Int8Array.from([...a, ...base.slice(a.length)]);
    for (const c of st.cenv.cultures) c.customs = longer(c.customs);
    for (const v of st.cenv.settlements) {
      if (v.practice) v.practice = longer(v.practice);
      v.lastSupport = grow(v.lastSupport);
    }
    for (const p of st.pawns) {
      p.att = grow(p.att);
      p.anc = grow(p.anc);
      p.interest = grow(p.interest);
    }
  }
  // A state from a save, on w: a world freshly generated from the save's seed and size.
  function load(w, data) {
    if (!data || !READS.includes(data.format))
      throw new Error(`load: format ${data && data.format}, this build reads ${READS.join(' and ')}`);
    if (w.seed !== data.seed || w.COLS !== data.cols || w.ROWS !== data.rows) {
      throw new Error(
        `load: the save is of seed ${data.seed}, ${data.cols} by ${data.rows}; the world is seed ${w.seed}, ${w.COLS} by ${w.ROWS}`,
      );
    }
    seal();
    VB['sim/water'].layWalk(w); // VB-1581: before the saved fields are put back, so from the land as generated, as at seeding
    w.lat = typeof data.lat === 'number' ? data.lat : VB['sim/climate'].CLIMATE.worlds.middle; // a save before VB-807: the middle world
    for (const k of WORLD) {
      if (!(k in data.world)) continue;
      const a = decode(data.world[k]);
      if (w[k] && w[k].constructor === a.constructor && w[k].length === a.length) w[k].set(a);
      else w[k] = a;
    }
    const st = decode(data.state, REVIVE);
    st.w = w;
    for (const k in DERIVED) st[k] = null;
    for (const k in DERIVED) if (DERIVED[k]) DERIVED[k](st);
    VB['sim/climate'].layGround(st); // VB-808: the ground compiled on the bands' states, from the land as loaded
    VB['sim/fieldrec'].grounded(st); // VB-1520
    VB['sim/water'].wellsLoaded(st); // VB-1584: an older save's well, a boolean, is its tile
    VB['sim/thirst'].loaded(st); // VB-1585: a save from before a pawn's own thirst loads as having drunk
    VB['sim/stores'].heapsLoaded(st); // VB-733: an older save's heap of no rock, and its quern's `rock`
    VB['sim/quern'].quernsLoaded(st);
    VB['sim/byrehouse'].byresLoaded(st); // VB-1665: an older save's farms read as having their byres
    for (const hd of st.herds) for (const e of hd.cull || []) if (e.sheep) e.lot ??= 1; // VB-1682: a sheep marked alone
    const R = VB['sim/rng']; // a save from before a system's stream (VB-761's `making`): its stream from the seed and its name, as at seeding
    for (const k of R.SYSTEMS) if (!st.rng[k]) st.rng[k] = R.makeStream(data.seed, k);
    grownCustoms(st); // a save from before the last custom (VB-555)
    for (const p of st.pawns)
      if (p.cropBias) {
        p.cropBias.wheat ??= 1;
        p.cropBias.oats ??= 1;
      }
    for (const p of st.pawns) if (p.att) VB['sim/attitudes'].compileLeans(p); // VB-520: compiled from the attitude, as it was saved or made
    VB['sim/agents'].loaded(st); // VB-472: the step's agents have begun; older saves' work is reckoned from now
    return st;
  }
  return { encode, decode, save, load, FORMAT, READS, DERIVED };
})();
