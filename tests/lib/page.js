// The page as its tests and tools load it (VB-449): built from src/ at each call (node build.js --stdout, under half a second), never
// read from an index.html on disk, so a run tests the sources as they are and no built file has to be kept beside them.
const { execFileSync } = require('child_process'), path = require('path');
const builtPage = () => execFileSync('node', [path.join(__dirname, '..', '..', 'build.js'), '--stdout'], { encoding: 'utf8', maxBuffer: 64 << 20 });
module.exports = { builtPage };
