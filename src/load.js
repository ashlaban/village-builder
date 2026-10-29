// Node only: loads every module in src/manifest.json, in order, and returns the VB namespace.
const fs = require('fs'), path = require('path');
for (const f of JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'))) require('./' + f);
module.exports = globalThis.VB;
