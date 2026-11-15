// What every sub-agent loads before it reads its task: AGENTS.md and .claude/agents/vb-task.md. Each of its calls re-reads them, so
// their size is paid a hundred times a task. A target, never a failure (docs/review-agent-workflow.md, section 8).
const fs = require('fs'), path = require('path'), { target } = require('./lib/targets.js');
const root = path.join(__dirname, '..'), files = ['AGENTS.md', '.claude/agents/vb-task.md'];
const bytes = files.map((f) => fs.statSync(path.join(root, f)).size), sum = bytes.reduce((a, b) => a + b, 0);
target('agents.always-read', { where: files.join(' + '), unit: 'B', dir: 'max', target: 32000, measured: sum });
console.log(`context size: ${files.map((f, i) => `${f} ${bytes[i]} B`).join(', ')}`);
