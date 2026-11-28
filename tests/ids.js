// @suite integration
// tools/lib/ids.js: a task set aside as an idea keeps its ID (`docs/ideas/**/VB-N.md`, Kim, 25 November), so the highest ID in
// sight counts the ideas beside the backlog and no ID is reused; on a small constructed tree, outside git.
const fs = require('fs'), os = require('os'), path = require('path');
const { highestId } = require('../tools/lib/ids.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-ids-'));
const touch = (f) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), '# x\n'); };
touch('backlog/VB-5.md');
touch('backlog/VB-12.md');
const errors = [];
if (highestId(dir).max !== 12) errors.push('the backlog alone: expected 12, got ' + highestId(dir).max);
touch('docs/ideas/aims/VB-40.md');
touch('docs/ideas/aims/README.md');
if (highestId(dir).max !== 40) errors.push('an idea above the backlog: expected 40, got ' + highestId(dir).max);
fs.rmSync(dir, { recursive: true, force: true });
if (errors.length) { console.error('ids: ' + errors.join('; ')); process.exit(1); }
console.log('ids: ok (ideas keep their IDs)');
