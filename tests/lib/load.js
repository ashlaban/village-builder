// Node tools install probes before later manifest entries capture their dependencies.
const manifest = require('../../src/manifest.json');
let loaded = false;

function loadModules({ wrap = {} } = {}) {
  if (loaded) {
    if (Object.keys(wrap).length) throw new Error('Install module hooks before loading the simulation');
    return globalThis.VB;
  }
  for (const file of manifest) {
    require('../../src/' + file);
    const key = file.replace(/\.[^.]+$/, '');
    if (!wrap[key]) continue;
    const mod = globalThis.VB[key];
    for (const [name, decorate] of Object.entries(wrap[key])) {
      if (typeof mod?.[name] !== 'function') throw new Error(key + '.' + name + ' is not exported');
      mod[name] = decorate(mod[name]);
    }
  }
  loaded = true;
  return globalThis.VB;
}

module.exports = { loadModules };
