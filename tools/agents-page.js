// Skills and agents: writes docs/agents.html, the page of the project's own skills (.claude/skills/*/SKILL.md, started as /NAME in a
// prompt) and sub-agents (.claude/agents/*.md, started by a session through the Agent tool), each with how it is invoked and its
// parameters explained. The Pages workflow runs it before its Jekyll step; the page is derived and never committed (as the roadmap is not).
// Usage: node tools/agents-page.js [--dir DIR] [--out FILE] [--json]
//   --dir DIR   the directory holding skills/ and agents/ (default .claude)
//   --out FILE  the page to write (default docs/agents.html)
//   --json      print the data the page is drawn from, and write nothing
// Read from each file: its frontmatter's name, description, argument-hint (a skill) or prompt-hint (an agent), tools and model; its
// first `# ` heading; and its parameters, the first bullet list under its first `## ` heading that names arguments or parameters.
// A bullet that starts with a `code` span and a colon is a parameter and its meaning; any other bullet is a note beside them.
require('./help.js')(__filename);
const fs = require('fs'), path = require('path');

// The frontmatter as { key: value }, one line a key, and the body after it.
function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const l of m[1].split('\n')) { const i = l.indexOf(':'); if (i > 0) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim(); }
  return { meta, body: text.slice(m[0].length) };
}

// The bullets of the first list under the first `## ` heading that names arguments or parameters, each joined to one line.
function bullets(body) {
  const lines = body.split('\n'), at = lines.findIndex((l) => /^## .*(argument|parameter)/i.test(l));
  if (at < 0) return [];
  const out = [];
  for (const l of lines.slice(at + 1)) {
    if (/^#{1,2} /.test(l)) break;
    if (/^- /.test(l)) out.push(l.slice(2).trim());
    else if (out.length && /^\s+\S/.test(l)) out[out.length - 1] += ' ' + l.trim();
    else if (out.length) break; // the list ended: a blank line or prose
  }
  return out;
}

// A bullet as { name, text } when it starts with code spans joined by "and" or "or" and then a colon; else { name: null, text }.
function param(b) {
  const m = b.match(/^(`[^`]+`(?:,? (?:and|or) `[^`]+`)*):\s+(.*)$/);
  return m ? { name: m[1], text: m[2] } : { name: null, text: b };
}

function parse(text, kind, file) {
  const { meta, body } = frontmatter(text), title = (body.match(/^# (.*)$/m) || [null, ''])[1];
  const name = meta.name || path.basename(kind === 'skill' ? path.dirname(file) : file, '.md');
  const hint = meta[kind === 'skill' ? 'argument-hint' : 'prompt-hint'] || '';
  return { kind, name, title, description: meta.description || '', hint, tools: meta.tools || '', model: meta.model || '', file,
    params: bullets(body).map(param) };
}

function read(dir, root) {
  const rel = (f) => path.relative(root, f).split(path.sep).join('/'), out = [];
  const sk = path.join(dir, 'skills'), ag = path.join(dir, 'agents');
  if (fs.existsSync(sk)) for (const d of fs.readdirSync(sk).sort()) {
    const f = path.join(sk, d, 'SKILL.md');
    if (fs.existsSync(f)) out.push(parse(fs.readFileSync(f, 'utf8'), 'skill', rel(f)));
  }
  if (fs.existsSync(ag)) for (const f of fs.readdirSync(ag).filter((x) => x.endsWith('.md')).sort())
    out.push(parse(fs.readFileSync(path.join(ag, f), 'utf8'), 'agent', rel(path.join(ag, f))));
  return out;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// The little Markdown the files use inline: `code` and **strong**, on escaped text.
const md = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

function card(x) {
  const call = x.kind === 'skill' ? `/${x.name}${x.hint ? ' ' + x.hint : ''}` : `Agent: subagent_type "${x.name}", prompt "${x.hint || '…'}"`;
  const named = x.params.filter((p) => p.name), notes = x.params.filter((p) => !p.name);
  const facts = [x.kind === 'agent' && x.tools && `Tools: ${esc(x.tools)}`, x.model && `Model: ${esc(x.model)}`, `<code>${esc(x.file)}</code>`]
    .filter(Boolean).join(' · ');
  return `<section class="card" id="${x.kind}-${esc(x.name)}">
<h3>${x.kind === 'skill' ? '/' : ''}${esc(x.name)}${x.title ? ` <span>${esc(x.title)}</span>` : ''}</h3>
<p>${md(x.description)}</p>
<pre class="call"><code>${esc(call)}</code></pre>
${named.length ? `<dl>${named.map((p) => `<dt>${md(p.name)}</dt><dd>${md(p.text)}</dd>`).join('')}</dl>` : '<p class="none">No parameters listed.</p>'}
${notes.length ? `<ul>${notes.map((p) => `<li>${md(p.text)}</li>`).join('')}</ul>` : ''}
<p class="facts">${facts}</p>
</section>`;
}

function render(items) {
  const skills = items.filter((x) => x.kind === 'skill'), agents = items.filter((x) => x.kind === 'agent');
  const toc = (xs) => xs.map((x) => `<a href="#${x.kind}-${esc(x.name)}">${x.kind === 'skill' ? '/' : ''}${esc(x.name)}</a>`).join(' · ');
  return `<h2>Skills</h2>
<p class="note">Started by a prompt that begins <code>/NAME</code>, followed by its arguments. ${toc(skills)}</p>
${skills.map(card).join('\n') || '<p class="none">None.</p>'}
<h2>Agents</h2>
<p class="note">Sub-agents a session starts through the Agent tool, with the agent's name as <code>subagent_type</code> and the parameters in
its prompt. ${toc(agents)}</p>
${agents.map(card).join('\n') || '<p class="none">None.</p>'}`;
}

if (require.main === module) {
  const root = path.join(__dirname, '..'), args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
  const items = read(path.resolve(root, opt('--dir', '.claude')), root);
  if (args.includes('--json')) process.stdout.write(JSON.stringify(items) + '\n');
  else {
    const page = fs.readFileSync(path.join(__dirname, 'lib', 'agents-page.html'), 'utf8').replace('<!--BODY-->', () => render(items));
    const out = path.resolve(root, opt('--out', 'docs/agents.html'));
    fs.writeFileSync(out, page);
    const n = (k) => items.filter((x) => x.kind === k).length;
    console.log(`agents: ${path.relative(root, out)}: ${n('skill')} skills, ${n('agent')} agents, ${items.reduce((a, x) => a + x.params.length,
      0)} parameters`);
  }
}
module.exports = { frontmatter, bullets, param, parse, read, render };
