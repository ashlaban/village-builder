// The collecting tasks: findings of one kind are lines of one open task, not a task each (Kim, 18 November; module splits too, Kim,
// 25 November). `node tools/backlog.js collect KIND where=... what=... [from=VB-NNN]` appends a line to the kind's open collector, found
// by its name, or opens the next one; `tools/inbox.js apply` collects its teleport and act notes through it, and the lint reads the
// split collector's open lines (tests/lint-rules.js, splitTask). A line is ticked when its finding is mended; the task stays open until
// every line is.
const fs = require('fs'), path = require('path');

const COLLECT = {
  split: { name: "Refactor: module splits, collected: each over the lint's line, split by its concerns", arch: '-', size: 'L',
    ref: 'AGENTS.md, Conventions (a module\'s length and width; VB-413, VB-414, VB-415); BACKLOG.md, Refactor rules',
    goal: 'Each module listed is split by its concerns, not by the line count: it falls under the lint\'s line (700 formatted lines, 15 exports) and '
      + 'leaves the lint baselines. A session takes one line: it names the module\'s responsibilities and where each belongs before any code moves, '
      + 'splits by them, and ticks the line',
    // taken only in a session with Kim (Kim, 25 November): `backlog.js next --unattended` leaves it out
    notes: ['- Flag: Kim takes part (Kim, 25 November): every split is taken in a session with Kim, not by an unattended run.'],
    summary: 'The modules over the lint\'s line of length or width, a line each; a session splits one by its concerns and ticks it' },
  // a rule the code built that design.md does not say: a worker never edits design.md, so a design pass with Kim writes them (VB-1126)
  design: { name: 'Design: rules built that design.md does not say, collected', arch: '-', size: 'M',
    ref: 'AGENTS.md, Surfacing; design.md, Status of this snapshot (who edits it)',
    goal: 'design.md says each rule listed, in its section, marked Decided with its date and a row of docs/design-changelog.md; or Kim strikes '
      + 'it and a task changes the code to what the design says. Taken in a session with Kim, the lines read together',
    summary: 'Rules the code built that design.md does not say yet, a line each: written into the design together, with Kim',
    notes: ['- Flag: Kim takes part (Kim, 25 November): design.md is edited in a session with Kim, not by an unattended run.'] },
  teleport: { name: "Teleports found, collected: swept at a slice's wrap-up", arch: 'physical', size: 'M', ref: 'AGENTS.md, Surfacing',
    goal: 'Each teleport listed is mended or shown to be none: goods arrive by being carried',
    summary: 'The teleports tasks found in the code, a line each; swept together when a slice wraps up' },
  act: { name: "Acts with no pawn, collected: swept at a slice's wrap-up", arch: 'acts', size: 'M', ref: 'AGENTS.md, Surfacing',
    goal: 'Each act listed is a pawn\'s, through a verb any pawn may use',
    summary: 'The acts with no pawn, and the choices only the player has, that tasks found; a line each, swept when a slice wraps up' },
};

const one = (s) => String(s).replace(/\s+/g, ' ').trim();
const lineOf = ({ from, where, what }) => `- [ ] ${from ? `From ${from}: ` : ''}${one(where)}: ${one(what)}`;
const isOpen = (text) => !/^Status: done/m.test(text);
// The open collector of a kind among task texts ({id: text}), or null.
const openIn = (texts, kind) => {
  const c = COLLECT[kind];
  return Object.keys(texts).find((id) => texts[id].startsWith(`# ${id}: ${c.name}\n`) && isOpen(texts[id])) || null;
};
// The same, read from a checkout's backlog/.
function openCollector(root, kind) {
  const dir = path.join(root, 'backlog'), texts = {};
  for (const n of fs.readdirSync(dir).filter((n) => /^VB-\d{3,}\.md$/.test(n))) texts[n.slice(0, -3)] = fs.readFileSync(path.join(dir, n), 'utf8');
  return openIn(texts, kind);
}
// An unticked line of the split collector that names a module key ("From VB-NNN: sim/stores: ..."); a ticked line splits nothing.
const namesModule = (text, key) =>
  new RegExp(String.raw`^- \[ \] (?:From VB-\d+: )?${key.replace(/[/.]/g, '\\$&')}(?:\.js)?:`, 'm').test(text);

module.exports = { COLLECT, lineOf, openIn, openCollector, namesModule };
