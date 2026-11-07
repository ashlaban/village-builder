# Review: the agent workflow and its context cost (7 November 2026)

What an agent has to read to take, do and close a task, what `tools/backlog.js` (this review's first batch) changes, further
suggestions in order of payoff, and how to measure the effect of each. Token counts are estimated as bytes / 4.

## 1. What an agent reads today

| Read | Bytes | ≈ tokens | When |
|------|------:|---------:|------|
| `AGENTS.md` | 20,700 | 5,200 | every session and every subagent, before anything else (19,800 before this batch) |
| of it: Architecture | 5,900 | 1,500 | the same; it restates the modules' `@sys` headers |
| of it: Commands | 5,300 | 1,300 | the same (the backlog lines are 900 bytes of it) |
| `BACKLOG.md` | 23,200 | 5,800 | to find the next task, and to change any task's status |
| `BACKLOG_ARCHIVE.md` | 30,500 | 7,600 | to archive a done task (or its tail and headings) |
| a task file | up to 12,200 | 3,000 | the task, and the done tasks it refers to (reports make done files long) |
| `design.md` | 126,200 | 31,600 | Design refs name a section; there is no way to read one section but grep and offsets |
| `QUESTIONS.md`, `QUESTION_ARCHIVE.md` | 23,600, 76,200 | 5,900, 19,000 | a task's questions; moving an answered question |
| `docs/architecture/target-v2.md`, `ownership.md`, `docs/roadmap.md` | 72,200, 69,700, 34,500 | 18,000, 17,400, 8,600 | architecture work, slice plans |
| `npm test` output | 7,600 | 1,900 | every run (78 lines, one per script); 62 s at 4 jobs |

## 2. Why what is read early costs most

Every model call re-reads the whole context, mostly from the prompt cache. A file read at call *k* of a session of *N* calls is
read again *N − k* times. This session (the one that wrote this review) made about 98 calls; its context grew from about 100,000
tokens (system prompt, tool definitions, `AGENTS.md`) to 174,000, and its calls read 12.8 million tokens from the cache in all.
Reading `BACKLOG.md` at the fourth call cost about 5,800 × 94 ≈ 550,000 cached tokens, about 4% of the session.

Cached tokens are billed at a fraction of fresh input, but they still fill the context window, count against rate limits, and a
long context dilutes the model's attention to the instructions that matter. So, in order:
1. shrink what every session loads (`AGENTS.md`);
2. shrink what a task reads at its start (backlog, task file, design sections);
3. shrink output that repeats (test runs after every change).

## 3. Done in this batch: `tools/backlog.js`

The task files are the source of truth; the tool rewrites the task tables from them and runs `tests/backlog.js` after every change.

| Operation | Before | After |
|-----------|--------|-------|
| Find the next task | read `BACKLOG.md` (23 KB) | `next`: 0.6 KB |
| Overview of open work | read `BACKLOG.md` (23 KB) | `list`: 6.1 KB, or filtered by status, arch or what a task waits for |
| Read a task without its reports | read the file (up to 12 KB) | `show ID --brief`: 3.0 KB for the longest |
| Close a task | read both tables (54 KB), move its row, find and edit every `Waits for:` line naming it, set freed tasks ready and move and re-sort their rows | `done ID`: 0.4 KB of output, no table read |
| Change status or priority, add a task | read the table, edit the file and the row, re-sort | `set`, `new`: the same small output |

The tool's lines in `AGENTS.md` cost 900 bytes in every session, repaid the first time a session does not read `BACKLOG.md`.
`tests/backlog-tool.js` (in `npm test`) checks that `sync` changes nothing on the checkout and that `new`, `set`, `done` and
`close-arch` on a copy keep the backlog check passing. `tests/backlog.js` now also refuses a ready task without a goal and criteria.

## 4. Suggestions, in order of payoff for effort

1. **Quiet test runs** (XS). `tests/run.js` prints one line per passing script. Print only failures and the summary line by
   default, keep `--verbose`, and add `--list` for the old output. Saves about 1,900 tokens per run, and runs happen after each change.
2. **Targeted test runs** (S). `node tests/run.js test --only stores,backlog`, or `--changed`, mapping the files changed since
   `HEAD` to the tests that load them (`VB['<key>']`). Between edits an agent then waits seconds, not a minute; the full suite stays
   the gate before each commit.
3. **A slimmer `AGENTS.md`** (S). Move Architecture (5.9 KB) to `docs/architecture/modules.md` and keep a three-line pointer, since
   `grep -rn "^// @sys" src` gives the module map. Drop provenance ("Kim, 3 November", "revised 6 November", task IDs) wherever the
   rule stands without it: it belongs to git history and the task files. Aim at 10 KB; each KB less is saved in every session and subagent.
4. **A section reader for the long documents** (S). `node tools/doc.js design.md --toc` lists headings with their sizes;
   `node tools/doc.js design.md "Help in hunger"` prints one section. Design refs name sections, so a task reads 2 to 5 KB instead
   of 126 KB. The same works for `target-v2.md`, `roadmap.md` and `REVIEW.md`.
5. **A questions tool, the backlog tool's twin** (S). `questions.js VB-127` prints the questions that name a task; `answer` moves a
   question to `QUESTION_ARCHIVE.md`, the costliest file to append to by reading (76 KB).
6. **One checklist for taking a task** (XS). Today the steps are spread over four sections of `AGENTS.md`. Seven lines, in order:
   `next`; `show`; read only the Design ref's sections; implement in small commits with quiet, targeted tests; `npm test`, then
   verify once; notes in the task file and `done`; PR with the impact note.
7. **Spec and report apart in task files** (S). A fixed heading for reports (for example `## Report`, checked by `tests/backlog.js`)
   makes `show --brief` exact instead of a guess at "Notes:", "Implementation" and "Validation". Or reports go to the PR body and
   the file keeps three lines and the commit.
8. **The summary in the task file** (S, a scripted change to 201 files). A `Summary:` header line would make every table
   fully generated; the summary is the only thing now held only in a row.
9. **The nightly prompt in the repository** (XS). The prompt the nightly run starts from is not versioned. Kept as, say,
   `docs/agents/nightly.md`, a change to it can be reviewed and its effect measured like any other change.
10. **No SessionStart hook for the backlog.** Printing `next` at the start of every session would cost the sessions that take no task.

## 5. Done in the second batch (7 November 2026)

Kim chose suggestions 1, 3, 4, 5 and 6, done directly rather than as backlog tasks. Section 1 stays as the baseline.

| Suggestion | Where | Before | After |
|------------|-------|-------:|------:|
| 1. Quiet test runs | `tests/run.js` (`--list` for the old lines) | 7.6 KB per passing `npm test` | 68 B |
| 3. A slimmer `AGENTS.md` | Architecture and "Adding things" to `docs/architecture/modules.md` (7.3 KB, read when needed); every rule kept | 20.7 KB in every session | 13.3 KB |
| 4. Section reader | `tools/doc.js`; headings, a ref's "Section (Subsection)", table rows and bold bullets | "Goods, production and animals (Help in hunger)": the 18.1 KB section, or the whole 126 KB file | 0.6 KB; `--toc` 4.0 KB |
| 5. Questions tool | `tools/questions.js`: `list`, `show`, `answer`, `archive` | 23.6 KB to find a task's questions; 76 KB archive read to append | `list` 2.3 KB; `show VB-163` 2.4 KB; archiving reads neither file |
| 6. A checklist for a task | `AGENTS.md`, Taking a task | spread over four sections | seven steps, 750 B |

Going below 13 KB would mean dropping rules or the list of commands, which an agent cannot discover otherwise (`tools/sim.js` has no
`--help`); not done.

**The nightly run (suggestion 9).** "The nightly run" of `BACKLOG.md` and older task notes is a scheduled task on Kim's account,
"Village builder (worker)", beside "Village builder (Project manager)" and "Village builder (Reviewer)"; all three have been disabled since
2 and 3 November. Their prompts describe the backlog as it was before 3 November (tasks as `## VB-NNN` blocks inside `BACKLOG.md`, status
set there, v0.3 design refs), so re-enabled as they stand they would work against the current files. They are rewritten in `docs/agents/`
against `AGENTS.md` (Taking a task; the backlog and questions tools), with the short prompt each scheduled task should carry instead,
pointing to its file, so a change to them is reviewed and measured like any other; the scheduled tasks themselves are not yet changed.

## 6. Measuring the effect

**Static measures** (deterministic and cheap; nightly, beside the bench history). A `tools/context-report.js` would print the
bytes of what every session loads (`AGENTS.md`), the bytes each standard operation reads (find the next task, read a task, close
a task, read a Design ref), the bytes and seconds of a test run, and append them to `docs/bench/agent-context.jsonl`. A growth past
a threshold shows in the nightly PR as the budget table does. This catches regressions, but not how agents actually behave.

**Session measures.** Claude Code writes a transcript per session (`~/.claude/projects/<directory>/<session>.jsonl`). Each model
call records its `usage` (fresh input, cache writes, cache reads, output tokens), and each tool call and result is recorded. A
`tools/agent-usage.js FILE [--json]` would report per session: model calls, peak context, the sums of cache reads, cache writes and
output, tool calls by tool, result bytes by tool and by file read, wall time and time spent waiting for tests. The nightly run
would append one line per session to a history.

**Comparing before and after.** Tasks differ too much for one session to show anything, so use one of two designs.
- *Observational:* medians and interquartile ranges over the nightly sessions before and after a change, stratified by task size
  and phase (a plan task reads more than an implement task). Slow, but it measures real work.
- *Benchmark:* a fixed set of short scripted tasks at a pinned commit, for example "find the next task and summarise it",
  "mark VB-180 done", "add a task blocked on VB-164", "answer a question for VB-127". Run each in at least five fresh sessions
  before and after the change, with the same model and prompt. Compare medians of the measures above and the success rate (the
  checks pass and the diff is right). Agent runs vary from one run to the next; with five runs per side, report the spread, not only the medians.

Count quality as well as cost: whether the first PR passes its checks, the number of review rounds and fix-up commits, and
whether the task was taken in the right order. A cheaper session that skips verification costs more in the end.
