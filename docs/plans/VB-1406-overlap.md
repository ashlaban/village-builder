# Task overlap by file: is there a better structure than splitting by size?

Read-only analysis of `/home/user/village-builder`, PRs #149 to #198 (16-21 Nov 2026). Nothing in the repository was changed.

## Answer in short

Yes. The overlap is not mainly caused by modules being too large or by logic of two concerns sharing a file. It is caused by
**append points**: lists, tables and export blocks that every new feature adds one or two lines to. Of the 19 hottest files, 14 are
hot almost entirely because of such a list. Splitting a module by concern (the direction of the recent splits) does not remove an
append point; it only moves it. The structure that minimises task overlap is the one `sim/kinds` (VB-418), `sim/commands` (VB-228)
and `CALENDAR` already follow: **the module that owns a thing declares it, and a thin registry joins the declarations**. Extending
that pattern to seven more lists removes most of the collisions; three or four real splits by concern cover the rest.

Back-test on the same tasks (details in section 3):

| File | Tasks now | Tasks after | How |
|---|---|---|---|
| `tests/suites.js` | 28 | 1 | tier declared in each test file, discovered |
| `tests/lib/invariants.js` | 24 | max 3 per file (19 files) | checks per owning module |
| `src/sim/rules.js` | 21 | max 5 per file (13 files) | tunables per domain, no shared export list |
| `docs/tuning.md` | 18 | 1 each | one entry per task, gathered by a tool |
| `src/owners.json` | 18 | max 2 per owner | owner read from the `@state` line |
| `src/sim.js` | 17 | 1 to 4 | facade assembled from each module's declared list |
| `src/sim/notable.js` | 16 | 8 (skip) / 6 (chronicle) | split, plus event kinds declared by the emitter |
| `src/manifest.json` | 15 | 1 | order derived from load-time reads |
| `tests/counters.json` | 15 | 15 (inherent) | a recorded baseline; see 1 |
| `src/layers.json` | 13 | 1 | layer in the `@sys` line |
| `src/vb.js` | 12 | 0 | counter declared beside its loop |
| `src/sim/saves.js` | 12 | 4 | migrations registered by the field's owner |
| `src/culture.js` | 12 | 6 / 6 / 5 | customs table, causes, core |
| `src/head.html` | 14 | 6 / 6 / 4 | CSS per page area and theme |
| `src/page/words.js` | 11 | 7 / 4 / 3 | card rows contributed by feature |
| `src/page/icons.js` | 10 | 5 / 5 / 3 / 2 | icon tables per family |
| `src/sim/records.js` | 10 | 6 | `HISTORY` kinds declared by the emitter |
| `src/page/cards.js` | 13 | 11 | weak gain: see 3 |

## Data, method and limits

- `task_files.json` holds **134** task IDs, not 207; I could not find where 207 comes from (probably tasks that touched only the
  excluded bookkeeping files). All counts below are out of 134.
- I rebuilt the data at hunk level (`hunks.json`, `hunks.py` in the scratchpad): every diff hunk of the 381 non-root commits, with
  the nearest enclosing top-level declaration at that commit. It reproduces the given counts exactly (rules 21, sim.js 18,
  suites 29 and so on). 15 root commits of grafted history add whole trees and are left out, as in the original data.
- **Noise in the given counts.** Commits naming several IDs credit every ID. One of them, `bc73b98` ("the mural theme's tasks
  renumbered VB-1161 to VB-1167"), only rewrote VB numbers in comments but credits four tasks to `head.html`, `icons.js`,
  `body.html` and `modules.md`. With that commit dropped and multi-ID commits credited to the first ID of the subject, 118 tasks
  remain and some files fall: `page/icons.js` 15 to 10, `head.html` 18 to 14, `docs/tuning.md` 26 to 18, `modules.md` 30 to 22,
  `counters.json` 19 to 15. The "now" column above uses the cleaned counts (`clean_task_files.json`).
- The back-test (`backtest.py`) assigns each hunk to the file that would hold it under the proposal, by its enclosing symbol and
  a few text rules. The symbol heuristic is approximate: a block appended after a table is credited to the table before it. I
  checked the hunk text by hand for `rules.js`, `sim.js`, `vb.js`, `saves.js`, `notable.js`, `records.js`; the page files and
  `invariants.js` are estimates.
- Distinct tasks per file is a proxy. I did not measure real merge conflicts, and I ran no tests.

## 1. Registries and bookkeeping

All of these are touched because a task adds a module, a field, a test, a counter or a parameter. None reflects mixed
responsibility. What the tools support today:

| File | Tasks | What the hunks are | Could it be per module? | Already supported? |
|---|---|---|---|---|
| `tests/suites.js` | 28 | one added line per new test (27 of 28 tasks) | Yes: a `// @suite fast` header per test file, `tests/run.js` discovers | No. `tests/run.js` reads the three arrays; the comment says the runner starts them "in this order", I did not check whether any test depends on order |
| `tests/lib/invariants.js` | 24 | one 1,578-line `checkState`, a block per feature | Yes: `tests/lib/invariants/<module>.js`, joined | No. Estimate after: 19 files, max 3 tasks |
| `src/owners.json` | 18 | one or two lines per new field | Yes: 216 `@state` lines already sit in the owning module; `tests/lint.js` already requires one per top-level key | Partly. `tests/ownership.js` reads only `owners.json`. Deriving the owner from the `@state` line's module needs a marker for caches, and for fields documented outside their owner |
| `src/manifest.json` | 15 | one line per new module (14 of 15) | Yes: order derived from load-time `VB['x']` reads | Partly. `tools/dependencies.js` already extracts those reads with `atLoad`, and says "so layers can replace load order". `build.js`, `tests/lib/load.js` and about ten tools read the list, all through two or three places |
| `src/layers.json` | 13 | one line per new module (12 of 13) | Yes: `// @sys sim/x [material]: ...` | Partly. `tests/lint.js` already parses line 1; only `tools/dependencies.js` reads `layers.json` |
| `src/vb.js` | 12 | all 12 are `COUNTERS` entries | Yes: declared beside the loop by the module | No, but `tests/counters.js` only reads `Object.keys(VB.COUNTERS)` |
| `tests/counters.json` | 15 | recorded values; three tasks rewrote 94 lines | **No.** It is a measured baseline, so any change of behaviour moves it. One commit (`29fbae1`) exists only to re-record after a merge | The remedy is procedural: record at merge or nightly, not in each task |
| `docs/architecture/modules.md` | 22 | all 22 in the bullet list of modules, which repeats each `@sys` line | Yes: generate the list from `@sys`, keep only "Adding things" by hand | The file itself says the module map is `grep "^// @sys"` |
| `docs/tuning.md` | 18 | 17 of 18 append to "Parameters waiting" | Yes: one entry per task, as `backlog/` does | No tool; `tools/backlog.js` is the model |
| `tools/stocks.js` | 10 | 7 of 10 add to `NOT_STOCKS` | Yes: a tag on the `@state` line | `tools/stocks.js` already parses the `@state` lines |
| `tests/width-baseline.json`, `tests/lint-baseline.json` | 6 | ratchets | No, by design | - |

All of these are tooling, which agents decide under target-v2. Principle 18 already lists registries as "code, built at load".
The manifest change is the only risky one: load order is behaviour (`sim/events` subscribers and rule contributions "run in a
fixed order", principle 18, and the `KINDS` order is part of saved state), so a derived order must be shown identical to today's
with `tools/same.js`.

## 2. Source files: append point or mixed logic?

Co-touch between the 14 named source files falls into two clusters, with `sim.js` as the bridge:

- **Kernel tables**: `rules.js`, `vb.js`, `saves.js`, `records.js`, `culture.js`, `marriage.js` (rules with vb 8, with saves 5,
  with records 5, with culture 5).
- **Page**: `head.html`, `icons.js`, `cards.js`, `words.js`, `play.js` (head with icons 11, cards with words 6).
- `sim.js` is touched with every page file (6 to 8 each) and with `notable.js` (5).

A typical feature task touches one file from each cluster plus the registries. VB-036 (courting) touched 9 of the 14, VB-314
(alderman) 6, VB-355 (the player sows) 6. Neither cluster matches a module boundary: both are what a new feature has to register.
79 of the 134 tasks touch at least one of the 14; only 32 touch exactly one.

| File | Tasks | Finding | Kind |
|---|---|---|---|
| `src/sim/rules.js` | 21 | 72 tunable tables behind one export block. 10 tasks touched the export block (one line each: `COURT,`, `ILLNESS,`, `CROWD,`...). The rest edit one table each; the busiest are `HEALTH`/`ILLNESS` 4, `SOCIAL` 3, `MARRIAGE` 3 | Append point |
| `src/sim.js` | 17 | Every hunk but one is an import destructure or a line in the export list. Only VB-1101 added logic (`skipAids`) | Append point |
| `src/vb.js` | 12 | Every hunk is a `COUNTERS` entry | Append point |
| `src/sim/saves.js` | 12 | 8 tasks added a line to `load` that fills a field missing from an older save (`if (!st.asking) seedAsking`, `prestige` to `standing`...). 4 tasks changed real save logic | Append point (migrations) |
| `src/sim/records.js` | 10 | 5 tasks added a kind to `HISTORY`. The rest is kin and household logic | Half append point |
| `src/sim/notable.js` | 16 | Two concerns: the skip (`SKIP`, `skipStop`, `stopsFor`, `skipFrom`, `roundEve`: 9 tasks) and the chronicle (`CHRONICLE`, `PERSONAL`, `chronicle`, `whole`, `foldRows`: 10 tasks). Both hold tables keyed by event kind that a new kind appends to | Mixed, and append point |
| `src/culture.js` | 12 | Three concerns: the customs table (`DIMS`, `ARCHETYPES`, `PRACTICES`: 6 tasks), causes and the meeting (`advocate`, `fewVoices`, `cultureYear`: 5), attitudes and drift (6) | Mixed logic |
| `src/head.html` | 14 | One `<style>` of 1,231 lines. Three areas: the mural theme (6 tasks, one feature), cards and meter (6), bar and panels (4) | Mixed by area |
| `src/page/icons.js` | 10 | Path tables by family; goods 5, people (bond, trait, state) 5 | Append point per family |
| `src/page/words.js` | 11 | The person card's text is one function; 8 tasks each added or changed a row (courting, visit, share owed, marriage bar) | Append point (card rows) |
| `src/page/cards.js` | 13 | `houseStats` gets one line per new stat (4 tasks); the rest is scattered across 14 symbols | Mostly real |
| `src/page/play.js` | 10 | The act dispatcher and the sheet gain a branch per verb (4 tasks); VB-1100 and VB-1121 are large features of their own | Mixed |
| `src/sim/marriage.js` | 8 | All from the marriage and succession slices (VB-036, 693, 823, 824, 826, 1314, 1363). `settleMatch` 6, `refusedMatch` 5 | Real: one concern, worked in sequence |
| `src/sim/fields.js` | 10 | Crops (4) and tilth (3) tasks, already split by VB-434 | Real |

A new event kind is the clearest missing extension point. VB-036 added `courting` to `HISTORY` in `records.js`, to `CHRONICLE`
and `PERSONAL` in `notable.js`, an icon in `icons.js`, a chip word in `cards.js` and a row in `words.js`. Five files, each a
line or two, for one kind.

## 3. Proposed structure

In order of gain per effort. "Respects" refers to target-v2 section 2.

**A. Declare beside the owner; join in a registry (no design change).**

1. **Counters** (`vb.js` 12 to 0). The module that holds the loop declares its counter at load. Fits principle 18.
2. **The `Sim` facade** (`sim.js` 17 to between 1 and 4). Each module names what it gives the page; `sim.js` joins them and keeps
   only the few functions it composes itself. The page still writes only through `Sim`. Check first: the width lint (VB-415)
   exempts the facade today, so the declared lists must be exempt too, or it would push modules over 15 exports.
3. **Save migrations** (`saves.js` 12 to 4). The owner of a field registers "fill what an older save lacks". This also removes
   writes that `sim/saves` makes to other owners' fields today (it is `exempt` in `owners.json`; one line carries
   `lint-allow: owner`), so it serves principle 2. The order of migrations must stay fixed.
4. **Event kinds** (`records.js` 10 to 6; `notable.js` 16 to 13 with the split below). One record per kind, declared by the module
   that emits it: how long it is kept (`HISTORY`), its chronicle group, whether it is personal, whether it stops a skip. Fits
   principle 18; `log` and `personEvent` stay the only writers.
5. **Tunables** (`rules.js` 21 to at most 5 in one file). Either `src/sim/rules/<domain>.js` files in the kernel layer, or each
   table in its owning module. The first is safer: 107 modules read `VB['sim/rules']`, and a lower layer may need a higher
   domain's number at load. Calendar, `ECON`, `ROLES` and `CROPS` stay in a small core. AGENTS.md ("defined once, in
   `src/sim/rules.js`") and modules.md, "Adding things", name the file, so both need the edit. A shared `VB['sim/rules']` view can
   keep the 107 readers unchanged. **This is tooling, but it touches every module, so by AGENTS.md Kim decides when it goes ahead.**
6. **The registries of section 1.** Suites, layers and `modules.md` are cheap. Owners and the manifest need care.

**B. Splits by concern (ordinary refactor tasks).**

7. `sim/notable` into the skip and the chronicle (16 to 8 and 6). They share only the record.
8. `culture` into the customs table, causes and the meeting, and attitudes (12 to 6, 6, 5). Principle 12 (custom read through one
   door) is kept if `Culture.inForce` and `Culture.norm` stay the door. A weaker gain than the others.
9. `head.html` into stylesheets per area, spliced by `build.js` as the page script is (14 to 6, 6, 4). The theme belongs in its
   own file whatever else is done.
10. Page card rows: a person card, farm card and tile card take rows from a list that each feature's page file adds to
    (`words.js` 11 to 7; `houseStats` in `cards.js`). The page files share one closure in `page.json` order, so a list works.
    **VB-668 (Kim, 16 Nov) fixed the three sections of the Stores tab; row order on a card is what the player sees, so the
    order must be declared, not left to load order.** I would surface this as a close call, not ask.

**Not worth doing.** `page/cards.js` (13 to 11), `sim/marriage.js` and `sim/fields.js`: their overlap is sequential work on one
concern inside one slice. A split would spread the same tasks over more files. `tests/counters.json` cannot be fixed by structure.

**Would need a design pass or Kim.** None of A or B changes a Decided mechanism. Three points to surface: the timing of the
`rules.js` change (5); the format of `docs/tuning.md`, which Kim reads to start tuning runs; and any change to the order of
`KINDS` or event subscribers, which is saved state and determinism (principle 18). I did not read `design.md` in full; I searched
it and target-v2 for `rules.js`, tunables, the facade, the manifest and migrations and found no Decided point about where they live.

## 4. The splits already done

Replay: tasks that touched the parent before its split, assigned by symbol to the file that holds that symbol today.

| Split | Tasks on parent before | Replayed on today's files | Verdict |
|---|---|---|---|
| `kinds` into `chores`, `fieldwork`, `byre` (VB-418) | 1 in window | after: `byre` 2, `fieldwork` 3, `kinds` only its own split | **Worked.** It replaced a table with a registry; later kinds land in their domain |
| `occasions` into `venues`, `feast` (VB-1270) | 4 | 2 / 1 / 1, none in two files | Worked, on small numbers |
| `claims` into `disputes` (VB-1176) | 2 | 1 / 1 | Clean, but too little data |
| `fields` into `fieldplans`, `rotations` (VB-434) | 9 | `fields` 8, `rotations` 3, `fieldplans` 2; 4 tasks in more than one | Little gain: the parent keeps 8 of 9, and 4 tasks now touch two files |
| `page/cards` into `villagecard` (VB-1190) | 12 | `cards` 11, `villagecard` 3; 2 in both | Moved code: 12 to 11 |
| `heirs` into `heirranking` | 8 | `heirs` 8, `heirranking` 2; both also in `heirs` | Moved code: the parent keeps all 8 |
| `relations` into `ties` | 7 | `relations` 7, `ties` 0 | Moved cold code |
| `stores` into `goods` (VB-416) | 4 | `stores` 4, `goods` 1 | Moved cold code |
| `page/rigs` into `look`, `routes` into `walking`, `gen` into `gen/bake` | 0 or 1 | - | No task data to judge |

The splits driven by the 700-line lint mostly carved off the part nobody was editing. That lowers line count and may help
reading, but the hot part stays hot. The one split that changed the shape (VB-418) is the one that reduced overlap. Most splits
are from the last three days of the window, so there is almost no "after" history; the replay is the only evidence, and the
`heirs` and `relations` split commits name no task.

## What I could not verify

- Whether any test depends on the order in `tests/suites.js`.
- Whether a derived manifest order can equal today's; `tools/dependencies.js` suggests it was intended, I did not run it.
- Actual merge conflicts between parallel agents; task counts per file stand in for them.
- The page-file and invariants back-tests rest on symbol heuristics and are the least certain numbers here.
