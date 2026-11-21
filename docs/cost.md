# Cost: the late game's budget, the ten rules and cheap measurement

> Split from `docs/roadmap.md` on 16 November 2026: its section 5 is section 1 here (5.2 is 1.2, and so on) and its section 6 is section 2.
> The slices and their order are `docs/slices.md`; the timeline is `docs/roadmap.html` (`tools/roadmap.js`).

> Testing policy updated by VB-408 (12 November 2026): [Testing](testing.md) supersedes the golden-file,
> suite membership and CI requirements below. There are no permanent behavior baselines to update.
> Refactors preserve behavior through focused contracts and `tools/same.js` against their starting commit.
> Late fixtures and long measurements run in the extended/nightly tier, not routine PR verification.

Written on 3 November 2026, when Kim made `docs/architecture/target-v2.md` the project's architecture reference and asked how to keep
the game fast (above all late in a run) and how to make measuring that cheap. Read at `fc5c2fc`. The numbers in section 1.1 were measured
that day in this repository's container (4 cores, Node), with `tools/sim.js` and a 40-year save. They are one run each, so treat them as
accurate to about 10%. Kim decided on 3 November, marked **Decided**: about 1,000 living pawns on a medium map as the late game's
reference, the budget, the work counters, and the ten rules (section 1.3). The rest is **Proposed**.

## In short

  double (352 to 729) and a game day costs 3.3 times as much (68 to 227 ms). In year 41 the moving round takes 899 ms in one call,
  against about 20 ms in year 2. The year-40 save is 29 MB of JSON and takes 2.7 s to write. Ten rules for every system follow,
  in section 1.3.
- **Budget at the late reference, `medium-ref`** (Decided, Kim; section 1.2):
  - 200 ms a game day for today's systems, the mean over a whole game year; each system's share in `tools/bench.js`;
  - no step over 60 ms on `medium-ref` and `small-y40`;
  - the cost per living pawn-day flat in history (`small-y40` at most 1.25 times `small-y5`);
  - save and load under 0.5 s each of the page's main thread.
- **Measure work, not time.** Deterministic counters of work done, asserted in `npm test` at tiny scale, need no baseline machine and
  never flake. Scaling exponents come from two sizes, and history checks from an early and a late save. Late-game fixtures are loaded
  from saves: one year from the year-40 save took 11 s, against 4 minutes to get there. Wall-clock timing runs nightly, is reported
  with its history, and never fails.


## 1. The late game

### 1.1 What it costs today

Populous small at seed 7, `tools/sim.js` (year-by-year ms per game day, one run). The last three columns are slice 0's wrap-up
(VB-200, 10 November, at `7205992`: one run of 41 years, and year 41 from the year-40 fixture made at that commit):

| Year | Living | Pawn records | ms a game day | ms per living pawn-day | 10 Nov: living | 10 Nov: ms a game day | 10 Nov: ms per living pawn-day |
|---|---|---|---|---|---|---|---|
| 1 | 352 | about 355 | 68 | 0.19 | 323 | 35.5 | 0.11 |
| 10 | 424 | | 82 | 0.19 | 393 | 44.4 | 0.11 |
| 20 | 500 | | 132 | 0.26 | 459 | 49.8 | 0.11 |
| 30 | 610 | | 153 | 0.25 | 558 | 88.0 | 0.16 |
| 41 (from the year-40 save) | 729 | 1,274 | 227 | 0.31 | 695 (1,210 records at year 40) | 105.6 | 0.15 |

On 10 November the cost per living pawn-day still grows with the years (0.11 to 0.15, 1.4 times from year 1 to 41, against 1.6 before),
but the work counters say most of it is not history: 19 of 25 grow no faster than the living from `small-y5` to `small-y40`, and the wall
clock of those two windows is 1.10 (`tests/history.js`; `docs/bench/closure.md`, "Cost growth").

Populous medium at seed 7, years 1 to 4, `--report perf`: 807 to 859 living, 184 to 196 ms a game day. That figure includes the
timing wrapper and a second run sharing the machine; `REVIEW.md` measured 97 ms on another machine. The early reference is
therefore already near a budget of 160. On 10 November (VB-200, `tools/bench.js`, a whole year from each fixture, three runs):
`medium-y5`, 895 living, 135 ms a game day (121 to 143); `medium-ref`, 1,019 living, 165 ms (161 to 170), against Kim's 200.

Where a game day went in year 41, from the year-40 save (ms, with the share of the day):

| System | Years 1 to 8 (352 to 420 living) | Year 41 (729 living) | Growth, for 1.9 times the people | 10 Nov: year 41 (695 living) |
|---|---|---|---|---|
| Agents and walking | 20.4 | 72.2 (32%) | 3.5× | 41.1 (39%): idle strolls 21.9, walking and working 16.3, the rest 2.9 |
| Talk and contacts | 26.9 | 62.0 (27%) | 2.3× | 25.8 (24%) |
| Daily life and births | 9.3 | 36.8 (16%) | 4.0× | 14.8 (14%); its longest call 14.9 |
| Jobs refresh and matching | 12.5 | 29.5 (13%) | 2.4× | 16.5 (16%) |
| The moving round (one call) | 72.7 longest | **899** | 12× | 16.7 longest (a phase; VB-201) |

The year-40 state:
- 0.76 dead records per living pawn (perhaps 4 to 5 by year 150, after 5 to 6 generations);
- 110,000 events in `st.record` (12 MB of the save), and pawn records of 14 MB, each with 80 events of its own;
- 29 MB of JSON, 5.2 MB gzipped;
- 2.7 s to save and 0.27 s to load.

On 10 November (`7205992`): 1,210 pawn records for 689 living (still 0.76 dead a living pawn), 110,090 events in the record, folded
by VB-199; 12.0 MB of JSON, 3.1 MB gzipped. At `medium-ref` the save blocks the main thread 0.32 s (0.29 to 0.33) and loads in 0.22 s
(0.17 to 0.27), against 0.5 s each (VB-199, VB-204, VB-226).

An autosave in the page by the same codec would freeze it for nearly three seconds.

**Reading.** Cost grows faster than the number of people, and the systems that grow fastest are those that loop over history
or over pairs:
- the 6-minute step walks every agent ever made, dead included (`clock.js:118`);
- 17 loops in the modules walk every pawn record ever made, four of them in `dailyLife` each day;
- `dailyLife` decays every tie and resets every kin floor daily (`lifecycle.js:232-241`);
- talk counts pairs in crowds.

The moving round grew twelvefold, and it is the one that freezes. None of this shows in the early benchmark (`tests/perf.js`,
year 2), which is why late fixtures matter (section 2).

### 1.2 Budget (Decided, Kim, 3 Nov)

The **late reference** is populous medium at year 60, with about 1,000 living (Decided, Kim, 3 Nov: about 1,000 living on a medium map
is the reference; a large map may reach about 2,000 at half the speed), saved as a fixture and regenerated nightly when behaviour changes, so it
always carries the slices built so far. The **early reference** is populous medium at year 2 (`tests/perf.js` today).

| Measure | Budget | Today |
|---|---|---|
| Mean per game day, late reference | 160 ms (30× at 10% of a core); ceiling 400 ms (25%) | not measured on medium; 227 ms on small at year 41 |
| Longest single 6-minute step | 60 ms; medium-y60 temporarily 400 ms until VB-201 | 899 ms (the moving round, small, year 41) |
| Cost per living pawn-day, year 60 against year 5 | at most 1.25× | 1.6× (year 41 against year 5, small) |
| Save and load, late reference | 0.5 s each; 10 MB gzipped | 2.7 s and 0.27 s; 5.2 MB at year 40 on small |
| Page frames | VB-166's baseline, 95th percentile | not measured |

Each slice adds lines to a budget table by system, kept in `docs/bench/budget.md` with the bench (section 2). A slice's plan states
its line; its wrap-up measures it.

**6 November update (user decision):** the single-step gate increases from 50 to 60 ms. Other budgets and demographic tolerances are unchanged. The subsequent user decision temporarily allows 400 ms on medium-y60; VB-201 must restore its 60 ms gate, including the moving-round day and midnight. Small-y40 stays at 60 ms.

**7 November update (Kim):** the late reference becomes the first year populous medium reaches 1,000 living, year 14 at `6eaa6bc`, since the year-60 fixture holds 2,492. Balance work will move that year, and the fixture follows it (VB-202). The basis of 160 ms, 30× at 10% of a core, was an agent's proposal; Kim decided its replacement and three more lines (`QUESTION_ARCHIVE.md`, VB-203):
- mean: 400 ms a game day for the finished game, a quarter of the main thread at 30×; the systems built so far may use half of it, 200 ms, and each later slice's plan claims its line from the other half;
- steps: no 6-minute step over 60 ms on `medium-ref` and `small-y40`; the temporary medium-y60 allowance has ended;
- history: the cost per living pawn-day at `small-y40` at most 1.25 times `small-y5`, the pair VB-088 already checks with counters;
- save and load: 0.5 s each, at `medium-ref`;
- `medium-y60` is a stress state, reported nightly against twice these lines, never gating.

**8 November update (Kim, VB-202):** `medium-y60` is dropped from the fixtures, the bench and the budget, replacing its stress role;
`medium-ref` is the only late medium fixture. The fixtures move to release assets and a nightly GitHub workflow remakes them (VB-223).

**10 November update (Kim, VB-261):** the lines of this section are targets with residuals, not gates: the nightly records each in
`docs/bench/targets.jsonl` (read with `node tools/targets.js`), and a check that is out reports its residual and never fails. The history
line (1.25) and the 60 ms step stay as targets. A task whose criterion is a line is done when it has moved towards it and reports the
residual, naming who closes what is left (`docs/bench/closure.md`). Timings are judged against noise (`docs/gates.md`, section 2).

**10 November update (Kim, VB-272):** the fixtures are no longer published: they are a local cache keyed by the simulation's sources,
made on demand (one run a map, about 2 minutes), so none is stale and none is stored on GitHub; the release and the workflow go.

**9 November update (Kim, VB-203):** the mean is taken over a whole game year from the save (48 days), so winter, the meetings and
the moving round count; the 30-day window read 7% low. Each system has a share of the 200 ms, 192 ms in all and 8 kept back, in the
budget column of `tools/bench.js`. The save's line counts the time the main thread is blocked (encode and stringify); gzip may run
in a worker and is reported beside it. Measured at `9f130e6`, `medium-ref` costs about 232 ms a game day, and the save 1.51 s of main
thread; the closure table, `docs/bench/closure.md`, names the task that closes each gap.

**11 November update (VB-184, slice 5's plan; Proposed):** the slices' claims on the other half (200 ms, the finished game's), in one
place: slice 1, 0.1 ms, taken from the 8 kept back (VB-219); slice 2, 0 ms (VB-078); slice 3, its opportunities under 10 ms at the
early reference (`docs/slices.md`, 3.3); slice 4, 2 ms a game day and no step over 60 ms at `medium-ref` (VB-183); **slice 5, 4 ms a game day at
`medium-ref`, a year's mean, and no 6-minute step over 60 ms:** 2 ms for the two new bases of eligibility (`debtor`, `hired`) inside
the matcher, read from compiled per-pawn indexes so a check stays one lookup; 1.5 ms for five new practices in the attitudes'
daily drift (14 customs with 44 options to 19 with 55, a quarter more of that work); 0.5 ms for the rest (the obligations' due-queue,
loans asked once a season over a village's households, a few cases a village a year in its own meeting step, the class yearly a
village a step, the alderman). Entities at `medium-ref`: 211 households, a few hundred open obligations, tens of titles after
decades. Save: under 0.1 MB more JSON, and the membership graph's ended edges, about 2 a pawn ever born, if Kim adopts it and until
they are folded into the record. `docs/bench/budget.md` is generated: the slice's systems join `tools/bench.js`'s shares with the
wrap-up (VB-035), as slice 1's did with VB-219.

The table above keeps the lines of 3 and 6 November for the record.

### 1.3 Ten rules for systems

Decided (Kim, 3 Nov), and in `AGENTS.md` (Rules for cost) in short form. Each slice's plan is checked against them.

1. **Cost follows activity, not history.** No loop in a step walks every record ever made: dead pawns, dissolved households, ended
   edges, met obligations, the record. The owner keeps an index of the live ones (a cache with one writer, checked against its
   source, as target-v2's principle 2 asks).
2. **No pass over pairs.** Pairs meet only among the present (cells, a venue, a household). Every per-pawn collection has a
   declared cap: ties 150 (VB-127), goodwill counterparts, stories (a few), memories.
3. **Decay lazily.** A decaying quantity stores its value and when it was set, and is read in closed form; or it is stored against a
   shared scale (VB-127's device). There is no daily pass to decay. Pruning runs yearly, spread over days.
4. **Schedule, don't poll.** What falls due at a known time (an obligation, a perishing lot, a plan step, an occasion, a voyage, a
   freeze) goes into a due-queue in `st`, ordered by tick, as plain data. A step touches only what is due. The idea of timing
   wheels (Varghese and Lauck 1987, from memory) applies; a sorted array per day is enough at this scale.
5. **Stagger and spread.** Per-holder work runs on its planning day, a seventh of holders a day. Yearly work (the moving round,
   meetings, derived views, Harris potential) is spread over steps, one village or a few households per step, as VB-129 asked.
   VB-145 made the moving round fast at year 2; the fixture shows it is not fast at year 41.
6. **Compile what is hot.** A rule read in an inner loop is compiled into an array: `move.cost` per mode set and season; the death
   hazard's slow parts per pawn, refreshed at their cadence. `value()` allocates nothing, and `explain()` runs only in panels.
7. **Detail by state, never by camera.** A pawn abroad steps yearly; a household plans on its own day. Making detail depend on
   what the camera shows would make the simulation depend on the view and break determinism and the golden file. Only the page may
   interpolate.
8. **Bound every cache:** routes least recently used (VB-097), reach maps per village and mode set, recomputed yearly or on
   `pathDirty`.
9. **Bound history.**
   - The record keeps notable events in full, and folds routine ones into yearly counts after a generation.
   - A pawn's events are an index into the record, not a second copy.
   - The family tree reads records lazily.
   - Save size grows with the living and with a bounded history.
10. **Name the cost before building.** Entities, times cadence, times work per call, in the plan; measured in the wrap-up.

### 1.4 Today's debts, as tasks for slice 0 and slice 7

- **Indexes of the living:** `st.living`, live households and live agents, kept by their owners. The step, `dailyLife` and the 17
  full loops then walk them. Behaviour is preserved if the order is kept, so the golden file is unchanged.
- **Lazy decay of ties and the kin floor:** part of VB-127, or before it.
- **The moving round spread over days in the late game,** measured on the fixture. VB-201 spread it over four phases; Kim decided
  on 10 November that each village holds its own round and meeting, a village a step (VB-242's plan: VB-277 to VB-280).
- **Bounded history:** pawn events as an index into `st.record`; a compaction rule for routine events. A small design question:
  what counts as notable (VB-098 asks the same).
- **The route cache bounded** (VB-097's first criterion).

### 1.5 Threads

The simulation runs on the page's main thread. A Web Worker would remove frame stalls, but the page reads `st` every frame, so
a worker would need a snapshot of positions per frame and requests for panels. **Proposed:** not now, but keep it possible. `st`
stays plain data, and the page's reads stay narrow (positions, animation, the selected panel). Revisit if VB-166 fails at 30× with
the simulation's share of frame time above a third. Autosave is the exception to weigh early: it could serialise in a worker
from a structured clone, if the late save cannot reach 0.5 s.

## 2. Cheap measurement

Timing is noisy, depends on the machine and needs long runs. Most of what matters can be measured more cheaply.

| Measure | What it catches | Cost | Where it runs |
|---|---|---|---|
| **Work counters:** nodes a route search expands, pairs talk considers, records a loop walks, opportunities computed, rule values read, deals assessed, stories picked | A loop that does more work than it should | Nil. Deterministic, so reported with tight targets at tiny scale (exact residuals, never flaky); their structure stays asserted | `npm test`; targets in `docs/bench/targets.jsonl` |
| **Scaling exponent:** the same scenario at two sizes (tiny and small, or populous at one and two times the density) | Work per day growing faster than the people (target: exponent at most 1.15; the residual is reported) | Two tiny runs, seconds | `npm test`; reported as a target |
| **History check:** work per living pawn at year 5 and at the late fixture | Loops over history (rule 1; target 1.25, residual reported) | One fixture year from counters | `npm run verify`; reported as a target |
| **Late fixtures:** saves at year 40 (small) and year 60 (medium), made by the nightly long runs and regenerated when the save format or the golden file changes | Late-only costs such as the moving round's 899 ms | 11 s for a year on small, against 4 minutes to get there | verify (small), nightly (medium) |
| **Bench history:** ms a game day per calendar step, worst step, heap, save time and size, per commit, appended to `docs/bench/history.jsonl` | Drift over many commits | One nightly run | Nightly; reported to `targets.jsonl`, never failing; a jump of 20% over the median of the last five is flagged |
| **Microbenchmarks:** `Rules.value`, the `move.cost` grid, A*, opportunities for one holder | A hot path's cost in ns per call | Seconds | Nightly |
| **Synthetic stress:** a scenario with 2,000 living pawns, 8,000 dead with families, 10,000 obligations and 50,000 goodwill pairs | Data structures beyond what play reaches yet | Seconds, no simulation to get there | On demand |
| **Frames:** VB-166 | Drawing | 30 s in headless Chromium | On demand; required for page drawing changes |

**How counters stay out of the state.** A counter is instrumentation, not state. It lives in `VB.count`, outside `st`: not saved,
read only by tools and tests, and it never changes what the simulation does. The lint's rule against module state needs one
allowance for it. Reading one is a single increment where the work happens.

**How timing gets cheaper.** Once the calendar is a declared schedule (target-v2 3.3), one hook in the clock times every step, with
`now` injected by the tool, since modules may not read clocks. That replaces `tools/perf.js`'s hand-kept list of systems, and every
new system is timed the day it is scheduled.

**Precedent** (from memory): projects that track performance per commit often count work instead of timing it, for the same reason.
SQLite reports CPU cycles measured with cachegrind; the Rust compiler's performance site uses instruction counts as its main
metric. Deterministic counts suit this project even better: they come from the game's own loops, need no profiler, and the
determinism the lint already enforces makes them exact.
