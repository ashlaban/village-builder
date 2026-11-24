# Writing a task

Every task is written the same way, wherever it is written (VB-1671): by a session with Kim, a `/task` session, a plan task, the
project manager, the reviewer, the nightly orchestrator from a sub-agent's note, or a `vb-task` sub-agent through that note. The rules
for statuses, order, archs and phases are in `BACKLOG.md`, "How this backlog works"; this page is how to write one task so that an
agent can take it alone, and a tool can tell what it may run beside.

## How

- With a backlog of your own (a session, a plan, the project manager, the reviewer): `node tools/backlog.js new name=... status=blocked|needs-review
  priority=... size=... summary=... [arch= phase= waits= cause= ref= goal= touches=]`, then fill in what the file says "(to write)", then
  `node tools/backlog.js set VB-NNN status=ready` when nothing undecided is left. A new task never starts ready.
- In an orchestrated run (a `vb-task` sub-agent): `node tools/inbox.js note VB-NNN task id=<a reserved ID> name=... priority=... size=...
  summary=... [status=ready goal= ref= touches= ...] --body -`, the criteria as the body; the orchestrator writes the file (`inbox.js apply`).
- The ID: `backlog.js new` takes the next free one above the task files of this checkout and of the branches pushed lately; a run's
  sub-agents use the IDs `inbox.js start` reserved. One that met main's is moved before main is merged: `node tools/renumber.js --onto origin/main`.

## The file

```
# VB-NNN: <name>
Status: ready | blocked | needs-review | done
Waits for: VB-NNN, Kim          (blocked only)
Cause: VB-NNN                   (a repair: the task whose change brought the defect; optional)
Priority: 1 | 2 | 3
Size: S | M | L
Arch: <key>                     (inside an arch only, with Phase)
Phase: plan | implement | wrap-up
Design ref: <design.md sections, docs/plans/..., or "none (code structure)">
Touches: <what it will edit: below>
Goal: <one sentence: what is true when it is done>
Acceptance criteria:
- [ ] <one checkable thing a line>
Notes:
- <date>: <decisions, reasons, what is left: at most ten lines>
```

`tools/backlog.js` keeps the lines above `Design ref:` in this order and the tables in step; `tests/backlog.js` checks them.

- **Name**: what changes, in the game's words or the code's, not the activity ("A widow keeps the farm until the heir is grown", not
  "Work on inheritance"). A plan is "Plan: ...", a wrap-up "Wrap-up: ...", a refactor "Refactor: ...", a mend of a red check "Repair: ...".
- **Goal**: the outcome, so that an agent deciding a close call (`AGENTS.md`, Deciding without Kim) knows what to keep.
- **Criteria**: each one checked by a command or a reading, never by taste: the test that shows it, the number with its before and its
  target, the file that says it. "verify passes" means its hard checks pass. A measurement does not hold a task (Kim, 16 November): the
  criterion stays unticked with its reason.
- **Size**: the change one session makes. S: one module and its test. M: several modules, or a new one. L: more than a session holds;
  a plan or the project manager splits it into S and M tasks.
- **Priority**: 1 mends a red check, or Kim asked for it first; otherwise 2, and 3 for what can wait. Priorities are the only order (`BACKLOG.md`).
- **Ready** only when its goal and criteria are stated and nothing in it waits for Kim; a question only Kim can answer makes it
  `needs-review`, with the question and a proposed answer in `QUESTIONS.md`.

## Touches: what the task will edit

The line says which functions the task will edit, so that tasks that edit different functions run side by side and tasks that edit the
same one run one after another (VB-1672). Merges conflict where two branches edit the same lines; replayed over the merges since
15 November, function level flags 41% fewer pairs than file level and misses no conflict (`docs/plans/VB-1671-conflicts.md`).

```
Touches: sim/jobs (allot, lookForWork); page/words (showPawn); tests/jobs.js; new sim/wells; new tests/wells.js
```

- A module by its key (`sim/jobs` is `src/sim/jobs.js`), any other file by its path; items separated by "; ".
- In brackets, the module-level functions and tables the task edits or adds (`allot`, `KINDS`, a new `wellJob`): the ones whose lines
  change, not the ones it reads. A module alone means "somewhere in it".
- `new` before a module or file the task creates.
- Implied, not named: a module's import block, its export list and its `@sys` header, and the tables marked `// @merge union`: they
  merge by themselves (`tools/merge.js`).
- Not named while they are lists every task appends to (VB-1406): `src/manifest.json`, `src/layers.json`, `src/owners.json`,
  `src/page.json`, `src/vb.js`, `src/sim.js`, `tests/suites.js`, `tests/counters.json`, and the bookkeeping (`BACKLOG*.md`,
  `QUESTIONS.md`, `docs/tuning.md`, `docs/agents/changes.md`).
- `Touches: unknown (<reason>)` for a plan task, or an investigation whose cause is not yet found.

To write it, find where the change goes: the module map (`grep -rn "^// @sys" src`), the function (`grep -n "const name = \|function name("`),
and the tests that check it. A line that is roughly right is worth more than none: the agent that takes the task corrects it before its
first edit (`.claude/agents/vb-task.md`, step 3), and each merge reports the declared against the actual. It replaces the free-text
"runs beside" and "one at a time with" notes of older tasks, which stay as they are.
