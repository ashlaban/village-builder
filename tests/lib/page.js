// The page as its tests and tools load it (VB-449): built from src/ at each call (python3 build.py --stdout, a fifth of a second), never
// read from an index.html on disk, so a run tests the sources as they are and no built file has to be kept beside them.
const { execFileSync } = require('child_process'), path = require('path');
const builtPage = () => execFileSync('python3', [path.join(__dirname, '..', '..', 'build.py'), '--stdout'], { encoding: 'utf8', maxBuffer: 64 << 20 });
module.exports = { builtPage };
