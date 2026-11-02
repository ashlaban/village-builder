// @sys sim/rng: seeded random streams as plain data (mulberry32), one per system, so systems do not reshuffle each other and saves can hold them
VB['sim/rng'] = (() => {
  // A stream is { s }: a 32-bit state. next() gives exactly the sequence of gen's mulberry32 closure started from the same state, and a stream
  // copied with JSON continues identically. A test may set `fix` on a stream: next() then returns it without advancing (every chance comes up).
  function next(r) {
    if (r.fix !== undefined) return r.fix;
    r.s = (r.s + 0x6d2b79f5) | 0;
    let t = Math.imul(r.s ^ (r.s >>> 15), 1 | r.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  // a stream from a raw state, as mulberry32(a) starts from a
  const fromState = (a) => ({ s: a | 0 });
  // a stream from a scenario's seed and a system's name (FNV-1a of the name, mixed with the seed)
  function makeStream(seed, name) {
    let h = 0x811c9dc5;
    for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 0x01000193);
    return fromState(Math.imul(seed | 0, 0x9e3779b1) ^ h);
  }
  // a draw function over a stream, for code that takes one (Culture, the generators)
  const drawer = (r) => () => next(r);
  return { next, fromState, makeStream, drawer };
})();
