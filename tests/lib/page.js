// The page as its tests and tools load it (VB-449): built from src/ at each call (node build.js --stdout, under half a second), never
// read from an index.html on disk, so a run tests the sources as they are and no built file has to be kept beside them.
const { execFileSync } = require('child_process'), path = require('path');
// The old interface is what the page's tests and tools drive (page/ui2 hides it by default): `{ ui2: true }` asks for the new one.
const built = () => execFileSync('node', [path.join(__dirname, '..', '..', 'build.js'), '--stdout'], { encoding: 'utf8', maxBuffer: 64 << 20 });
const builtPage = ({ ui2 = false } = {}) => (ui2 ? built() : built().replace('<script>', '<script>window.VB_CLASSIC = true;</script>\n<script>'));
module.exports = { builtPage };
