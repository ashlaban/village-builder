// Node tools install probes before later manifest entries capture their dependencies: src/load.js requires the manifest in order and
// calls the hook set here after each module registers.
const SRC = '../../src/load.js';

function loadModules({ wrap = {} } = {}) {
  const hooked = Object.keys(wrap).length > 0;
  if (require.cache[require.resolve(SRC)]) {
    if (hooked) throw new Error('Install module hooks before loading the simulation');
    return require(SRC);
  }
  if (!hooked) return require(SRC);
  const seen = new Set();
  globalThis.VB_AFTER_MODULE = (key) => {
    if (!wrap[key]) return;
    seen.add(key);
    const mod = globalThis.VB[key];
    for (const [name, decorate] of Object.entries(wrap[key])) {
      if (typeof mod?.[name] !== 'function') throw new Error(key + '.' + name + ' is not exported');
      mod[name] = decorate(mod[name]);
    }
  };
  try {
    const VB = require(SRC);
    for (const key of Object.keys(wrap)) if (!seen.has(key)) throw new Error(key + ' is not a manifest module');
    return VB;
  } finally {
    delete globalThis.VB_AFTER_MODULE;
  }
}

module.exports = { loadModules };
