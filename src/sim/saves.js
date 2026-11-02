// @sys sim/saves: saving and loading a run (VB-074): the state as JSON-compatible data, with shared objects, Maps, Sets and typed arrays kept
VB['sim/saves'] = (() => {
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
  function encode(root) {
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
      const o = keep({});
      for (const k of Object.keys(d)) if (k !== '$id') o[k[0] === '$' ? k.slice(1) : k] = dec(d[k]);
      return o;
    };
    return dec(data);
  }
  return { encode, decode };
})();
