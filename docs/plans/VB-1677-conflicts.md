# Merge conflicts between parallel work: where they are, and what would predict them

Opened 24 November 2026 in a session with Kim. The question: how to tell automatically which tasks can run side by side, so that
parallel work stops meeting a merge conflict at nearly every merge. Kim's answers: the aim is fewer conflicts (no task is lost to
one, but no parallel batch goes without one); a task's footprint is declared when the task is written, from one guide every writer of
tasks follows; function level if it pays; the list files are ignored until VB-1406 turns them into declarations.

## Answer in short

- Since VB-450 (15 November) 91 of 405 merges that were not GitHub PR merges conflicted (22%). 44 were main merged into a session's
  branch, that is separate sessions running side by side; 36 were inside an orchestrated run. A scheduler inside a run sees only the
  second half: it must also read the branches in flight.
- 62 of the 91 conflicted only where the conflict is mechanical: 37 in the backlog and other bookkeeping files only, 11 in the list
  files (manifest, layers, owners, suites...), 11 in a module's import block, `@sys` header or export list, 3 in other documents.
  29 had a conflict inside a function or table body. The mechanical ones are VB-1679's; the body ones VB-1677's and VB-1678's.
- What a task's text names today predicts its edits poorly: over 482 done tasks it names 37% of the `src/` files they edited, and
  26% of the files it names were edited (list files left out). A footprint has to be written on purpose; it cannot be read off the goal.
- Function level pays. With each side's actual edits, "both sides edited the same file" flags 126 of the 405 merges to catch the 29
  body conflicts (precision 0.23); "both sides edited the same function or table" flags 74 and still catches all 29 (precision 0.39).
  41% fewer false alarms at no loss, so a footprint names functions, and parallelism is not given up for nothing.

## Data and method

- Full history (`git fetch --unshallow`): 3,111 commits, 809 merges, from 29 October. Period: merges dated from 15 November, after
  `index.html` left the repository; GitHub's "Merge pull request" merges are left out, since GitHub refuses a conflicting one.
- `VB-1677-replay.js` replays each two-parent merge with `git merge-tree --write-tree` and, in each conflicted text file of the
  result, finds the enclosing symbol of each conflict marker: a declaration at indent 0 or 2 (a module's body is indented 2 inside
  `VB['key'] = (() => {`), the import block (`const { ... } = VB['x']`), the export list (`return {`), a Markdown heading.
- `VB-1677-split.js` groups the conflicted merges by their worst conflict (body, documents, import/head/export, list, bookkeeping).
- `VB-1677-granularity.js` takes, for each merge, each side's diff from the merge base, maps every hunk to its enclosing symbol in
  the base, and tests file overlap and symbol overlap against the replay's conflicts.
- `VB-1677-predict.js` compares the files and module keys a done task's text names (before its notes) with the `src/` files of its
  `VB-NNN:` commits.

## Limits

- The symbol finder is a line heuristic: a hunk appended after a table is credited to the table before it, and page files without the
  module wrapper fall to their nearest top-level `const`. Big tables (`ICON`, `REPORTS`, `KINDS`, `CHRONICLE`, the rules' tables)
  are append points as much as the list files are: several of the 29 body conflicts are in them.
- The granularity test uses what each side actually edited, the ceiling a declared footprint can reach, not what a planner would write.
  VB-1678 measures the declared against the actual after each merge.
- A merge that resolved cleanly can still break the build (a semantic conflict); none of this measures those. `npm test` after each
  merge stays the check.
- Merges are counted, not tasks: one session's branch merging main twice counts twice.

## The mechanical conflicts by kind (VB-1679)

`VB-1679-hunks.js` replays the conflicted merges with diff3 markers and sorts each hunk in a bookkeeping or list file:

| File | Hunks | Kind |
|------|------:|------|
| `BACKLOG_ARCHIVE.md` | 30 | all both sides adding rows at the end |
| `BACKLOG.md` | 62 | 30 both adding rows, 22 edits on neighbouring rows, 10 the same row changed on both sides |
| `tests/counters.json` | 46 | 36 the same measured value re-recorded on both sides, 10 neighbouring keys |
| `docs/design-changelog.md`, `docs/tuning.md`, `QUESTION_ARCHIVE.md` | 10 | all both adding |
| `src/owners.json`, `src/page.json`, `tests/suites.js` | 10 | all both adding |
| `src/manifest.json`, `src/layers.json` | 13 | a one-line array changed on both sides |
| `src/sim.js`, `src/vb.js` | 7 | both adding, or neighbouring lines |

Every kind but a row or value changed differently on both sides has a mechanical answer: rows keyed by task ID, union for files that
only grow, a key-wise three-way merge for JSON objects, an element-wise one for arrays.

## With the drivers (VB-1679)

Replayed with `tools/merge.js` installed (`git merge-tree` runs the drivers), the non-PR merges since 15 November:

| Worst conflict | Before | With the drivers |
|----------------|-------:|-----------------:|
| bookkeeping only | 37 | 19 |
| list files | 11 | 5 |
| imports, `@sys` header, exports | 11 | 3 |
| other documents | 3 | 3 |
| a function or table body | 29 | 29 |
| **conflicted merges** | **91** | **59** |

About 4 more resolve through the tables marked `// @merge union` since, which the old files do not carry. What is left of the
bookkeeping is mostly task IDs taken by two branches (VB-1680) and the old `index.html`; the bodies are VB-1678's.

