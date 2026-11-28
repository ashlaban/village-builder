// @suite fast
// tools/agents-page.js on constructed files: the frontmatter and the hint read; the parameters are the first list under the arguments
// or parameters heading, a wrapped bullet joined and the list ended by prose; a bullet without a leading code span is a note; the page is
// escaped. Then the project's own skills and agents: each has its hint and at least one named parameter, so the page explains them all.
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { parse, read, render } = require('../tools/agents-page.js');

const skill = `---
name: demo
description: A demo <skill>.
argument-hint: SIZE [N]
---
# The demo

## 0. Read the arguments
- \`SIZE\`: \`S\` or \`M\`. Required.
- \`N\` or \`--count N\`: how many; default
  8, wrapped.
Prose after the list.
- \`--late\`: not a parameter, after the prose.

## 1. Then
- \`--other\`: in another section.
`;
const s = parse(skill, 'skill', '.claude/skills/demo/SKILL.md');
assert.ok(s.name === 'demo' && s.title === 'The demo' && s.hint === 'SIZE [N]' && s.description === 'A demo <skill>.', 'frontmatter and title');
assert.deepStrictEqual(s.params, [{ name: '`SIZE`', text: '`S` or `M`. Required.' },
  { name: '`N` or `--count N`', text: 'how many; default 8, wrapped.' }], 'the first list only, a wrapped bullet joined, ended by prose');

const agent = `---
name: helper
description: Helps.
tools: Bash, Read
prompt-hint: Help VB-NNN
---
# Help

## Parameters
- \`Help VB-NNN\`: the task.
- The model is the caller's.
`;
const a = parse(agent, 'agent', '.claude/agents/helper.md');
assert.ok(a.hint === 'Help VB-NNN' && a.tools === 'Bash, Read', "an agent's hint is its prompt-hint");
assert.deepStrictEqual(a.params.map((p) => p.name), ['`Help VB-NNN`', null], 'a bullet with no leading code span is a note');
const lead = parse('---\nname: lead\n---\n# Lead\n\nArguments: `$ARGUMENTS`\n\nProse first.\n\n- `ID`: the task.\n- `--to S`: whom.\n\n## 1. Do\n- `--x`: no.\n',
  'skill', 'x/lead/SKILL.md');
assert.deepStrictEqual(lead.params.map((p) => p.name), ['`ID`', '`--to S`'], 'no arguments heading: the list after the Arguments: line');
assert.strictEqual(parse('# Bare\n', 'agent', 'x/bare.md').name, 'bare', 'no frontmatter: named after its file, no parameters');

const html = render([s, a]);
assert.ok(html.includes('A demo &lt;skill&gt;.') && !html.includes('<skill>'), 'the page escapes the text');
assert.ok(html.includes('/demo SIZE [N]') && html.includes('subagent_type &quot;helper&quot;'), 'how each is started');
assert.ok(html.includes('<dt><code>N</code> or <code>--count N</code></dt>'), 'a parameter rendered with its code spans');

// The files on disk: written to a scratch copy, then the project's own.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-page-'));
fs.mkdirSync(path.join(dir, 'skills', 'demo'), { recursive: true });
fs.mkdirSync(path.join(dir, 'agents'));
fs.writeFileSync(path.join(dir, 'skills', 'demo', 'SKILL.md'), skill);
fs.writeFileSync(path.join(dir, 'agents', 'helper.md'), agent);
assert.deepStrictEqual(read(dir, dir).map((x) => x.kind + ' ' + x.file), ['skill skills/demo/SKILL.md', 'agent agents/helper.md'], 'read from disk');
fs.rmSync(dir, { recursive: true, force: true });

const own = read(path.join(__dirname, '..', '.claude'), path.join(__dirname, '..'));
assert.ok(own.some((x) => x.kind === 'skill') && own.some((x) => x.kind === 'agent'), 'the project has skills and agents');
for (const x of own) {
  assert.ok(x.description, `${x.file} has a description`);
  assert.ok(x.hint, `${x.file} has its ${x.kind === 'skill' ? 'argument-hint' : 'prompt-hint'} in its frontmatter`);
  assert.ok(x.params.some((p) => p.name), `${x.file} lists its parameters, under an arguments heading or after its Arguments: line`);
}
console.log(`agents-page: ok (${own.length} skills and agents, ${own.reduce((n, x) => n + x.params.length, 0)} parameters)`);
