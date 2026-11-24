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
read again *N − k* times. The turn of this session that wrote this review made 47 model calls; its context grew from about 84,000
tokens (system prompt, tool definitions, `AGENTS.md`) to 188,000, and its calls read 6.65 million tokens from the cache in all.
Reading `BACKLOG.md` at the second call cost about 5,800 × 45 ≈ 260,000 cached tokens, about 4% of the turn. (Measured with
`tools/agent-usage.js`, which counts each response once; the first version of this review counted transcript lines, of which a
response has several, and gave about twice these numbers.)

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

Going below 13 KB would mean dropping rules or the list of commands, which an agent cannot discover otherwise (`tools/sim.js` had no
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
`node tools/agent-usage.js [FILE]` (built 7 November) reports per session: model calls, context at the first call and at its peak,
the sums of fresh input, cache writes, cache reads and output, tool calls by tool with their result bytes and times, the largest
results by what was read or run, and with `--turns` a line per prompt. Each scheduled run ends by writing its own to
`docs/agents/usage/` (`--label ROLE --out DIR`, one file per run); `--history docs/agents/usage` gives medians and quartiles by role.

**Comparing before and after.** Tasks differ too much for one session to show anything, so use one of two designs.
- *Observational:* medians and interquartile ranges over the nightly sessions before and after a change, stratified by task size
  and phase (a plan task reads more than an implement task). Slow, but it measures real work.
- *Benchmark:* a fixed set of short scripted tasks at a pinned commit, for example "find the next task and summarise it",
  "mark VB-180 done", "add a task blocked on VB-164", "answer a question for VB-127". Run each in at least five fresh sessions
  before and after the change, with the same model and prompt. Compare medians of the measures above and the success rate (the
  checks pass and the diff is right). Agent runs vary from one run to the next; with five runs per side, report the spread, not only the medians.

Count quality as well as cost: whether the first PR passes its checks, the number of review rounds and fix-up commits, and
whether the task was taken in the right order. A cheaper session that skips verification costs more in the end.

## 7. Third batch (9 November 2026)

The one measured run (`docs/agents/usage/2026-11-08-worker-5972fa67.json`: 154 calls, context from 80,000 to 361,000 tokens, 35.3 million
tokens read from the cache) shows that `AGENTS.md`, about 3,500 tokens, is no longer what costs: the length of the session is. Done:

| Change | Where | Before | After |
|--------|-------|--------|-------|
| `--help` | `tools/sim.js`, `tools/bench.js`, `tools/fixtures.js` | `sim.js --help` ran a three-year medium run; the run above read `bench.js` and `fixtures.js` whole to learn them (40 KB, 15% of its tool output) | 0.6 to 0.7 KB each |
| Searches skip built and archived files | `.ignore`: `index.html`, `package-lock.json`, `docs/img/`, the two archives | a search from the root hit every line of `src/` twice | ripgrep (the Grep tool) skips them; name the file to search it |
| Diffs skip built files | `.gitattributes`: `index.html` and `package-lock.json` are `-diff` | `git show` and `git diff` printed the rebuilt page | "Binary files differ" |

Open, in order of payoff:
1. **One task per context: done** (9 November). `docs/agents/worker.md` now orchestrates and hands each task to a `vb-task` subagent
   (`.claude/agents/vb-task.md`) with a fresh context: Sonnet for size S, Opus for M and L (Kim). Not yet run: the first night
   measures it, and must show whether `tools/agent-usage.js` counts the subagents' tokens (it counts `isSidechain` entries of the
   session's transcript; subagents written to transcripts of their own would be missed). `tools/shot.js` got its `--help` too.
2. **`npm install` at session start: done** (9 November), as the setup script of Kim's cloud environment "Research" (`npm ci` in the
   checkout, when it is there); unproven until a fresh session starts on it. **A permission allowlist** in `.claude/settings.json` is
   Kim's to add: an agent may not widen its own permissions.
3. **`--help` everywhere: done** (9 November). `tools/help.js` prints a tool's header comment and exits before anything loads; every tool without its own usage text starts with it; nine at first
   tools start with it (`nightly.js --help` had started a real nightly run). The Commands section of `AGENTS.md` lost only its option
   lists (4.0 to 3.9 KB): its lines are what tells an agent a tool exists, so it stays.
4. **Checks on pull requests: done** (9 November), not yet run. `.github/workflows/checks.yml`: `verify`, and `late-game` (the published
   fixtures, then `tests/fixtures.js` and `tests/history.js`). Verify costs a session one line but 190 s, of which the page takes 150
   (`smoke.js` 44 s, `browser-speed.js` 40, `browser-mobile.js` 36, `browser.js` 30); so a session now runs `npm test` and
   `tests/golden.js`, and verify only for size M or L or a change under `src/page/`; the workflow is the gate for the rest (Kim). With fresh fixtures `tests/history.js` fails on `main` as of
   this date (`roundPairs` 6.1 against a baseline of 1.33): sessions never saw it, having no fixtures.
5. Suggestions 2 and 7 of section 4 (targeted test runs; spec and report apart in task files).
6. **More than one measured run**: the run above was not unattended (25 minutes waiting for answers), so there is no baseline yet.

## 8. Fourth batch (14 November 2026): side by side, an inbox, and three measures

Kim's aim: the most work for the least overhead, with sub-agents working side by side. Done:

| Change | Where | Before | After |
|--------|-------|--------|-------|
| Sub-agents side by side | `docs/agents/worker.md`, `.claude/agents/vb-task.md` | one sub-agent at a time, in the shared checkout | three or four, each in a worktree; the orchestrator merges one at a time and runs `npm test` on each merge |
| The inbox | `tools/inbox.js` (`tests/inbox.js`): a local SQLite file in the git common directory, never committed | a sub-agent took "the next free ID" in its own checkout and edited `BACKLOG.md`, `QUESTIONS.md` and `docs/tuning.md`, which collide between worktrees | IDs reserved in blocks of five; claims name who else edits a file; notes (task, question, tuning, candidate, teleport, decision) are written into the shared files once, by `apply`; `report` prints the PR's "For Kim" |
| A reserved ID | `tools/backlog.js new id=VB-NNN` | the next free ID only | a named free ID |
| Sub-agents measured | `tools/agent-usage.js` | counted `isSidechain` lines of the session's transcript; sub-agents are written to `<session>/subagents/agent-*.jsonl`, so a night's sub-agents were not counted at all (the doubt of section 7, settled) | each sub-agent measured from its own transcript, with the task its prompt names |

The three measures (`node tools/agent-usage.js --results FILE`, at each run's wrap-up; kept in the run's file under `docs/agents/usage/`):
1. **Weighted cost of a done task, by size.** One number, in fresh-input tokens: input + 1.25 × cache writes + 0.1 × cache reads +
   5 × output, about the prices' ratios. Raw sums mislead: cache reads are most of the count and the cheapest tokens.
2. **Overhead.** The orchestrator's share of the run's weighted cost, and the sub-agents' median boot: the context at the first edit,
   which is what a task reads before it changes anything (`AGENTS.md`, the task, its Design refs).
3. **Done at the first attempt.** The share of ended tasks that are done; a cheaper night that leaves tasks `needs-review` is not cheaper.

A static guard beside them: `tests/context-size.js` reports, as a target, the bytes every sub-agent loads before it reads its task
(`AGENTS.md` and `.claude/agents/vb-task.md`), since each of its calls re-reads them.

Not yet known: any of the three for a real night. The history holds two worker runs from before this batch, one of them attended;
five nights or more are needed before medians by size mean anything. The inbox saves few tokens by itself: what it buys is no
merge conflicts in the shared files and an orchestrator that reads one line a note.

## 9. Fifth batch (15 November 2026): the starting context, after a trial of three tasks

The trial (VB-349, VB-236, VB-291; three Sonnet sub-agents side by side): each started at 69.9k tokens of context before reading
anything, read about 53k more before its first edit (nearly all of it code and tests; one design section among the three), and made
39 to 68 calls. Cache reads were over half of each task's weighted cost (VB-349: 4.65M read, 465k of 757k), so the cost of a task is
about its calls times its context, and what is in the context at the first call is paid on every call.

| Change | Before | After |
|--------|--------|-------|
| `vb-task` names its tools (Bash, Read, Edit, Write, Grep, Glob) | a sub-agent loaded every tool of the session (publishing, cloud sessions, schedules): most of the 69.9k | not measured: a session loads the definition at its start, so the first night shows it |
| `AGENTS.md`, Commands | 27.3 KB in all | 21.4 KB: a short list; the full entries, unchanged, in `docs/commands.md` |
| `design.md`, Change log | 303.5 KB with 31 KB of log | 272.9 KB; the log is `docs/design-changelog.md` |
| `tools/brief.js ID` | three or four calls to gather the task, its questions and its design sections | one call, 3 KB at the median over the 48 ready tasks (11.5 KB at most), with the rules for the task's kind |

Also from the trial: the built `index.html` conflicts between tasks side by side, and the orchestrator rebuilds it; a linked
`node_modules` and the worktrees themselves are ignored; times measured beside other sub-agents are descriptions; the fixtures cache
is linked into a worktree. Still open: whether a task with a criterion unmet keeps its commit as `needs-review`.

## 10. The offline estimate of a context reset (VB-1615, 24 November 2026)

Before any agent is changed, what could a voluntary reset save? `node tools/agent-usage.js --history docs/agents/usage --estimate
--from 2026-11-18T19:41Z` (`tools/lib/reset-estimate.js`, its model in its header) takes each run since the 120-call ceiling began
(each sub-agent, and each session with no sub-agents; orchestrators left out), 138 runs and 139.9M weighted, and costs its context curve
twice: with the ceiling alone, and with one voluntary reset once the context reaches T (from the run's 30th call, with 20 calls or more
left). A reset starts again from the run's first call plus a handover of H tokens, then R calls of reading again. None of these runs had
`context.series` yet (it is recorded from VB-1615 on), so every curve is the straight line from the first call to the peak.

Saved, as a share of the runs' measured weighted cost (the share of runs that reset in brackets):

| T | H 5k, R 0 | H 15k, R 6 | H 15k, R 15 | H 30k, R 6 | H 30k, R 15 | runs reset |
|---|-----------|------------|-------------|------------|-------------|------------|
| 100k | 8.3% | 1.9% | −4.7% | −1.9% | −9.0% | 36% |
| 130k | 8.0% | 2.5% | −3.5% | −0.8% | −7.3% | 32% |
| 160k | 7.7% | 3.9% | −0.1% | 1.7% | −2.6% | 25% |
| 200k | 4.3% | 2.8% | 1.1% | 1.9% | 0.2% | 13% |

- **Where it is.** At T 160k, H 15k and R 6, the saving is 4.8M of the sessions' 84.5M (5.7%; 32 of 39 sessions reset) and 0.6M of the
  sub-agents' 55.4M (1.1%; 2 of 99 reset). Since the ceiling, sub-agents seldom pass 160k; sessions of one task on Opus do, and have no
  ceiling of their own (6 of them passed 120 calls).
- **What decides it.** Reading again. A reset that costs 15 calls of re-reading loses money below T 200k; one that costs 6 or fewer saves
  a few per cent. A short handover matters less than few calls of reconstruction, which is what the handover's Verified and Places
  sections are for.
- **Why it is a bound.** The model resets at any call once over T, knowing how many calls are left; a real reset waits for a boundary
  and guesses what is left. Output is left out (the same either way), the first call's prefix is taken as cached across agents, and the
  work after a reset adds what it added in the run, so no exploration is repeated beyond R. It says nothing of quality: whether a fresh
  context fixates less, or loses what it needed, only the period comparison (VB-1616) can show.
- **Proposed for VB-1616:** T = 160k tokens. It saves the most at a middling handover (3.9%), stays above nothing unless re-reading
  reaches 15 calls with a handover of 15k or more, and touches a quarter of the runs, nearly all of them long sessions. The guards of the
  model are VB-1616's: no voluntary reset before a run's 30th call, one a task.
