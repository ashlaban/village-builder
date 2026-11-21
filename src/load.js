// @sys load: Node-only loader that requires every manifest module in order
// `globalThis.VB_AFTER_MODULE(key)`, when tests/lib/load.js has set it, is called as each module registers, so a tool can wrap an export
// before later modules capture it (VB-375). The source knows nothing of the tests: the hook is the only seam.
const after = globalThis.VB_AFTER_MODULE;
for (const file of require('./manifest.json')) {
  require('./' + file);
  if (after) after(file.replace(/\.[^.]+$/, ''));
}
module.exports = globalThis.VB;
