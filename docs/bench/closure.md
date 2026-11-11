# Closure table: the budget at `medium-ref`

Written by hand; the generated numbers of each night are in `budget.md`. The first section is slice 0's wrap-up (VB-200, 10 November,
at `7205992`); the sections dated 9 November are VB-203's, at `9f130e6` with the fixtures made there (fresh), Node 22, 4-core Xeon,
after Kim's answers of 9 November: the shares, a whole game year as the bench's window, and the save line counted on the main thread.
The cost-growth table is kept current.

## The hunger floors: who is hungry, and which task closes each (VB-270, 10 November)

The bands' full runs at `756c693` (`bands.jsonl`, 28 of 50 in; every hunger band out on all ten runs; population out on founders 3 and
heirs 42). Each run was replayed a day at a time as `tests/lib/bands.js` does (`docs/bench/hunger-causes.js`; it reproduces the recorded
worst shares and death shares to the last digit), naming each household over 0.3 of its days after year 3 (280 household-years in all)
and each hunger or starvation death (141). A hungry day is sorted by what the household held after it: **reserve** when its grain and
meals still covered the day's need (the seed reserve, `seedReserve` in `src/sim/hunger.js`, is never eaten: design.md, Seed, Agreed), **short**
when they did not. Nothing in the game changed; bands before and after are the same record.

| Run | Worst share | Rows (reserve / short) | Hunger deaths after y3 (share) | Of them: reserve / short | Share without the reserve deaths | Share of household-years over 0.3 (without reserve) |
|---|---:|---|---:|---|---:|---|
| populous 3 | 1.00 | 92 (40 / 52) | 38 of 360 (0.106) | 30 / 7 | 0.022 | 0.030 (0.017) |
| populous 7 | 0.92 | 16 (10 / 6) | 10 of 341 (0.029) | 2 / 8 | 0.023 | 0.006 (0.002) |
| populous 11 | 1.00 | 79 (36 / 43) | 66 of 412 (0.160) | 42 / 24 | 0.058 | 0.025 (0.014) |
| populous 42 | 1.00 | 44 (8 / 36) | 10 of 341 (0.029) | 6 / 4 | 0.012 | 0.014 (0.012) |
| founders 3 | 0.73 | 6 (2 / 4) | 1 of 20 (0.050) | 1 / 0 | 0.000 | 0.027 (0.018) |
| founders 7 | 0.56 | 7 (2 / 5) | 2 of 30 (0.067) | 1 / 1 | 0.033 | 0.024 (0.017) |
| founders 11 | 0.44 | 2 (0 / 2) | 1 of 27 (0.037) | 0 / 1 | 0.037 | 0.007 (0.007) |
| founders 42 | 1.00 | 21 (7 / 14) | 7 of 32 (0.219) | 4 / 3 | 0.094 | 0.085 (0.057) |
| heirs 7 | 1.00 | 5 (5 / 0) | 2 of 13 (0.154) | 2 / 0 | 0.000 | 0.026 (0.000) |
| heirs 42 | 0.86 | 8 (4 / 4) | 4 of 21 (0.190) | 3 / 1 | 0.048 | 0.047 (0.023) |

(A death is sorted by its household's hungry days that year; one death, of an infant fed that day, is in neither. "Without the reserve
deaths" subtracts the reserve column from the hunger deaths and keeps the denominator: an upper bound on what a rule change would give, since
a household that eats its seed sows less. The worst-share column's households are named below.)

**Cause 1, the seed reserve: 114 of 280 household-years and 91 of 141 deaths.** A household keeps back 25 rations of seed for each field that
is stubble or plowed (all of them from harvest to spring), and nothing may be eaten below that, so a household of one with 3 to 5 fields
(114 rows average 3.9 fields and 1.2 members; 90 are households of one) starves with a granary that holds a few days to weeks of its food.
Named: populous 3, year 18, household 124 (a 19-year-old woman and a 4-year-old holder, 6 fields, 73 grain against a reserve of 75; both died,
hungry on all 20 days it lasted: this is the 1.00); populous 11, year 23, household 69 (two children of 4 and under, a holder of 11, 24 grain
against 50; dissolved, 30 of 30 days); populous 42, year 21, household 142 (a 19-year-old and a 1-year-old holder, 5 fields, 45 against 75);
founders 42, year 38, household 10 (holder 5, 1 field, 24 against 25) and year 47, household 11 (a lone adult, 48 of 48 days, 4 fields, 89
grain); founders 3, year 26, household 6 (a lone adult, 35 of 48 days, 1 field, 46 grain); heirs 7, year 17, household 4 (a man of 40 with a
holder of 10, 3 fields, 49 against 50) and year 24, household 3 (21 and 15, 5 fields, 90 against 125); heirs 42, year 17, household 3 (a man of
68 and a holder of 68: 5 fields, 122 grain against 125). Within these, the lone adult, the heir and the ward (21 rows have a holder under 16) is
the shape, and the reserve is the mechanism: the household cannot work the fields its reserve is held for. 30 of populous 3's 38 deaths and 42 of
populous 11's 66 are of this kind.
Closing: a design change, so a question for Kim (QUESTIONS.md, VB-270, 1) and the proposed task **VB-270-a**; the lone survivor is **VB-270-b**.

**Cause 2, real shortage: 166 of 280 household-years and 49 of 141 deaths.** Households of 4.1 members on 3.2 fields (2.2 adults, 1.9 children
or infants; 78 of the 166 have 2 or more adults and 2 or more children; 36 have one adult at most), 0.2 herds, short in spring to autumn
before the harvest (populous 42, year 30, household 9: 2 adults and an infant, 5 fields, 4 sown, 9, 12 and 11 hungry days in spring, summer and
autumn, none in winter; populous 3 has 52 such rows, populous 42 has 36, and the same households recur: 55 households make populous 3's 92 rows, 27 make populous 42's 44). Labour, land and herd all play: this is the food balance VB-048 was written for (its goal: "a couple with 4 or more children
runs short every year before harvest"), and none of its prerequisites are in. VB-048 stays blocked, behind VB-136 (VB-251), VB-144 (VB-185,
VB-121) and VB-139, VB-160 (ready), so the proposed task **VB-270-c** is its first, measuring pass, runnable now.
*Measured (VB-284, 11 November; `docs/bench/food-balance.md`):* after VB-282, populous small at four seeds has no shortage in years 4 to 15 and 196
household-years hungry over 0.3 in years 16 to 30, of the same shape (4.0 members, 2.9 fields) and with no cattle; short in summer and autumn after poor
harvests in a row, on worn soil, with fields planned on the gross yield (0.73 of need net). Five tuning questions for Kim: QUESTIONS.md, "VB-284: tuning
the food balance".

**Cause 3, the household of one and the heir: 90 of the 114 reserve rows and 36 of the short ones are households of one adult or fewer; 25
rows have a holder under 16.** Their deaths mostly show above as reserve deaths (the lone adult at 19 or 20 next to a child holder). A
household that dissolves within the year, or is made in it, counts as hungry on all its days: 46 of the 280 rows are such (populous 3: 15;
populous 11: 17), but they are real hunger (a dissolved household's last days are those of a starving one), so the probe is right about them;
leaving them out the worst share is still 1.00 in populous 3 and founders 42, and moves populous 7 (0.92 to 0.73), populous 42 (1.00 to
0.67) and heirs 7 (1.00 to 0.65), never under 0.44.
Closing: **VB-270-b**, with VB-090 (landless adults take service) and VB-034 for the land of heirs.

**Cause 4, the measure.** The worst household is an extreme value: it grows with the number of households (92 rows and 55 households in
populous 3, 16 and 10 in populous 7) and is 1.00 on six of ten runs while the share of household-years over 0.3 is 0.006 to 0.085. The hunger
share of deaths is fine. A question for Kim (QUESTIONS.md, VB-270, 2): the band reads the share of household-years hungry over 0.3, at most 0.05;
today's values read 9 of 10 in (founders 42 at 0.085 is out, heirs 42 at 0.047 in), and 0.057 for founders 42 without the reserve deaths.

**Population.** Founders 3 (10 to 7) and heirs 42 (18 to 12) are small numbers: hunger caused 2 of 26 and 4 of 21 of their deaths, so these
are not diagnosed here; they stay residuals of the early game's small founding groups.

| Residual | Where | Closed by |
|---|---|---|
| Seed reserve never eaten: 91 of 141 hunger deaths, 114 rows | all ten runs but founders 11 | Kim's question 1; VB-270-a |
| Real shortage before harvest: 49 deaths, 166 rows | all ten | measured by VB-284 (`food-balance.md`); Kim's answers to its questions, then VB-048 |
| Lone survivors and wards | populous 3, 11, heirs, founders 42 | VB-270-b, planned by VB-283: VB-307, VB-308, VB-309 (with VB-090, VB-034); the wards are lone adults after their death (`backlog/VB-283.md`) |
| The worst household as the band's reading | six of ten runs at 1.00 | Kim's question 2 |

## Slice 0's wrap-up: the lines at `7205992` (VB-200, 10 November)

Fresh fixtures made at `7205992` (format 2; `medium-ref` at year 12 with 1,010 living, `medium-y5` 883, `small-y40` 689, `small-y5`
359). `node tools/bench.js` three times in a row, nothing else running: the mean, then the range. The steps on `small-y40` from
`tests/history.js` (its 30 days and one round), twice alone and once inside verify. Kim's rule of 10 November (`docs/gates.md`):
each line is a target, in or out, with its residual; nothing here fails a run.

| Line (Kim) | Where | 10 November (mean; range) | Line | In? | Residual | Closed by |
|---|---|---|---:|---|---:|---|
| Mean simulation, ms a game day | `medium-ref`, a year | 164.8 (161.0 to 170.4) | 200 | in | | |
| (the same, the early reference) | `medium-y5`, a year | 135.1 (120.5 to 143.4) | | reported | | |
| Each system's share | `medium-ref`, a year | below: 9 of 15 in | | 6 out | +0.01 to +1.56 | below |
| Longest 6-minute step | `medium-ref`, a year | 38.4 (34.9 to 41.8); the round's call 24.6 (21.7 to 29.6), the meetings' 19.7 (19.1 to 20.9) | 60 | in | | |
| (the same) | `medium-y5`, a year | 33.9 (28.0 to 38.8) | 60 | in | | |
| Longest 6-minute step | `small-y40`, `tests/history.js` | 31.5 and 40.3 alone; 43.0 inside verify (the year's second midnight) | 60 | in | | |
| Cost per living pawn-day, `small-y40` / `small-y5` | work counters, `tests/history.js` | 6 of 25 counters out (below) | 1.25 | 6 out | +0.019 to +11.92 | below |
| (the same, wall clock) | `tests/history.js` | 1.101 and 1.098 alone, 0.953 inside verify | 1.25 | in | | |
| (the same, `medium-ref` / `medium-y5`) | the bench | 1.043, 0.999, 1.187 | reported | | | |
| Save, main thread (encode + stringify) | `medium-ref` | 315 ms (290 to 334); gzip 322 more (304 to 339) | 500 | in | | |
| Load (parse + load) | `medium-ref` | 221 ms (170 to 268) | 500 | in | | |
| Gzip size | `medium-ref` | 4.24 MB (16.55 MB of JSON) | 10 | in | | |

Every Kim line but two is in: the systems' shares (6 out, 4.5 ms in all, while the whole day is 35 ms under its 200) and the counters'
growth (6 out). VB-201 (the steps), VB-199, VB-204 and VB-226 (the save: 1.51 s on 9 November, 0.32 s now) and VB-205 (the agents)
closed the four lines that were out on 9 November.

**By system at `medium-ref`** (ms a game day; the shares are `tools/bench.js`'s, 192.1 of the 200):

| System | 10 Nov | Range | Share | In? | Residual | Closed by |
|---|---:|---|---:|---|---:|---|
| talk and contacts | 39.92 | 38.77 to 41.18 | 55 | in | | |
| agents: idle strolls | 34.56 | 32.89 to 36.70 | 33 | out | +1.56 | VB-245 (idle pawns wait 2 to 4 hours; about 40 ms of strolls a day by its count) |
| jobs refresh and matching | 26.39 | 25.95 to 27.20 | 30 | in | | (VB-227, needs review, was written for this line; it is in now) |
| agents: walking and working | 24.14 | 23.52 to 24.64 | 23 | out | +1.14 | VB-245 (fewer strolls, fewer walks); measure again after it |
| daily life and births | 24.05 | 23.88 to 24.15 | 35 | in | | |
| paths and routes | 5.77 | 5.49 to 6.18 | 5.3 | out | +0.47 | VB-236 (the route cache cleared when a tile's cost changes; no nightly refresh) |
| agents and walking (the rest of `Sim.advance`) | 4.11 | 3.99 to 4.32 | 4 | out, at the line | +0.11 | VB-245; the range spans the line |
| hunger and meals | 2.39 | 2.26 to 2.52 | 3 | in | | |
| the moving round (its day's mean) | 1.30 | 1.18 to 1.50 | 1.1 | out | +0.20 | VB-242 (the round a village a step) |
| meetings (their day's mean) | 1.01 | 0.90 to 1.20 | 1 | out, at the line | +0.01 | VB-242; two runs of three under |
| byre | 0.84 | 0.81 to 0.87 | 1.2 | in | | |
| herds, meadows, trees, kin help | 0.29 | | 0.5 | in | | |
| **Total** | **164.8** | 161.0 to 170.4 | **192.1 + 7.9** | in | | |

At `medium-y5` every system is within its share (135.1 ms a day in all). The day by season and the five longest steps of each run are in
`history.jsonl`: at `medium-ref` the longest are the year's second midnight (hour 14,687.9, 34.9 to 41.8 ms) and late-winter midnights.

**Two readings settled.**
- The longest step at `small-y40`: VB-201's 34.0 ms is right; 143.7 (VB-261's survey, at `aea615a`) was one sample, the maximum of one
  run inside verify, where its 103 scripts share four cores and a step's time includes being descheduled or a collection.
  It is neither the code nor a stale fixture: `aea615a`'s own `tests/history.js` on the same `d196f68` fixtures reads 38.8 and 37.3 ms
  run alone, and `7205992` reads 25.0 on them, 31.5 and 40.3 on fresh fixtures, and 43.0 inside verify.
- `walkTies`: VB-235's 0.970 was measured on the `d196f68` fixtures (`7205992` gives 0.970 on them too); on fresh fixtures it is 1.277,
  out by 0.027. The ratio moves with the state the fixtures hold, so VB-269 stays open.

## The lines, where each is measured (9 November, VB-203)

| Line (Kim) | Fixture | How | Today | Within? |
|---|---|---|---|---|
| Mean, 200 ms a game day for today's systems | `medium-ref`, a whole year (48 days) from the save | reported nightly (`tools/bench.js`) | 226, 233 and 237 ms (three runs) | over by about 15% |
| Each system's share (below) | `medium-ref`, a whole year | reported nightly (`budget.md`, the budget column) | below | four over |
| No 6-minute step over 60 ms | `medium-ref`, a whole year | reported nightly (`tools/bench.js`) | 96 to 103 ms; 11 to 14 steps a year over 60, all midnights | over |
| No 6-minute step over 60 ms | `small-y40`, 30 days and one round | reported in verify (`tests/history.js`) | 55 ms (a whole year) to 62 ms (verify's window) | at the line |
| Cost per living pawn-day, `small-y40` at most 1.25 times `small-y5` | `small-y5`, `small-y40` | work counters reported as targets in verify (`tests/history.js`, VB-263); wall clock reported there | ten counters out, see "Cost growth" below; wall clock 0.99 and 1.07 (two runs) | towards the target |
| Save, 0.5 s of main thread (encode + stringify) | `medium-ref` | reported nightly | 1.51 s (and 0.58 s of gzip, which may move to a worker) | over, 3 times |
| Load, 0.5 s (parse + load) | `medium-ref` | reported nightly | 0.33 to 0.55 s | at the line |
| Gzip, 10 MB | `medium-ref` | reported nightly | 6.9 MB | within |

None of them is asserted on wall-clock time: the bench and the step timings report, and only work counters fail a run.

## By system (9 November, VB-203)

ms a game day at `medium-ref`, a whole year: the mean of three runs (the bench, and two runs of the same window), with their range.
The shares are in `tools/bench.js` (`SYSTEM_BUDGETS`): 192 ms among today's systems, 8 kept back for noise between runs and growth.

| System (`tools/perf.js`) | Today | Range | Share | Gap | Closed by |
|---|---:|---|---:|---:|---|
| talk and contacts | 74.2 | 74.0 to 74.5 | 55 | 19.2 | VB-127: ties from talk, a shared decay scale, at most 150 ties |
| agents and walking (the rest of `Sim.advance`) | 70.2 | 68.5 to 71.9 | 60 | 10.2 | VB-205: name its parts, then cut them |
| daily life and births | 41.1 | 39.2 to 42.9 | 35 | 6.1 | VB-127 (the daily decay of every tie moves to the shared scale), then VB-201 (what is left of midnight, spread) |
| jobs refresh and matching | 35.1 | 33.2 to 36.5 | 30 | 5.1 | VB-227 (new), after VB-208 |
| paths and routes | 5.2 | 5.1 to 5.3 | 5.3 | | within |
| hunger and meals | 2.9 | 2.9 to 3.0 | 3 | | within |
| byre | 1.1 | 1.1 to 1.2 | 1.2 | | within |
| the moving round (its day's mean) | 1.1 | 1.1 to 1.2 | 1.1 | | within; its step is VB-201's |
| meetings (their day's mean) | 1.0 | 0.8 to 1.1 | 1 | | within; their step is VB-206's |
| herds, meadows, trees | 0.2 | | 0.4 | | within |
| **Total** | **232** | 226 to 237 | **192 + 8** | **about 32** | |

By season (the first run): spring 262, summer 205, autumn 219, winter 244 ms a game day. Spring holds the year's turn and the most job
postings, winter the most talk (87 ms a day). The old 30-day window, spring and the first half of summer, read 215: 7% under the year.

## Cost growth: counters out, and who closes each

VB-200, 10 November 2026, at `7205992` with fresh fixtures (VB-263's first table, at `acb5dcf` on stale fixtures, is in git history).
`tests/scaling.js` (exponent, line 1.15) and `tests/history.js` (ratio, line 1.25) report each work counter as a target
(`docs/bench/targets.md`); neither fails for a value out. `tests/cost-baseline.json` is gone: its ceilings are the first records of
these targets in `targets.jsonl`. Residual is how far past the line. `node tests/counters.js` passes (25 counters, none moved).

| Counter | Check | Value | Residual | Closed by |
|---|---|---:|---:|---|
| `routeExpand` | history | 1.436 | +0.186 | VB-236 (the route cache cleared when a tile's cost changes, and a lower bound) |
| `routeRefresh` | history | 1.598 | +0.348 | VB-236 (the nightly selective refresh goes) |
| `routeRefresh` | scaling | 1.265 | +0.115 | VB-236 |
| `walkTies` | history | 1.277 | +0.027 | VB-269 (needs review); 0.970 on the `d196f68` fixtures, so it moves with the state saved |
| `roundPairs` | history | 13.17 | +11.92 | VB-242 (the round a village a step; pairs only among the present) |
| `roundPairs` | scaling | 2.00 | +0.85 | VB-242 |
| `heirRank` | history | 1.269 | +0.019 | VB-242 (the heir cache's end) |
| `recordFold` | history | 2.859 | +1.609 | VB-268 |

In since VB-263's table (fresh fixtures and VB-235): `roundRank` 1.219, `oppAsk` 1.133, `planReview` 1.103, `cookFarm` 1.124. The rest
of the 25 counters are in at both checks: 19 of 25 at history, 23 of 25 at scaling. A new counter out has its closing task named here
in the same PR that adds it.

## The steps (9 November, VB-203)

At `medium-ref`, over a whole year, every step over 60 ms is a midnight:
- the year's turn: 96 to 103 ms on its first midnight, 72 to 83 on its second and 79 on its third;
- the moving round's day (autumn day 11): 101 ms at midnight in the bench, 63 to 75 in the other runs; the round's own call is 51 to 56 ms;
- late autumn and winter: 63 to 87 ms on several midnights.
The meetings' call is 38 to 50 ms, and its noon step was 60 ms in one run. All three are VB-201's (midnight, the round's day) and
VB-206's (the meeting's step). On `small-y40` no step went over 60 ms in a whole year (55 at most); verify's window, with two workers
running at once, read 62 ms on the year's first day.

## The save (9 November, VB-203)

The state's 36.8 MB of JSON at `medium-ref`: pawns 14.5 (their copied events 5.3, ancestry 1.4, attitudes 1.4), the households'
ledgers 10.6, the record 7.9, the path cache 1.2, the rest 2.6. VB-204 folds the ledgers' routine entries and VB-199 the record's
routine kinds and the pawns' copies; by size alone they should bring the main thread's 1.51 s to about 0.65 s. VB-226 (new) measures
what is left and cuts it to 0.5 s, with gzip off the main thread.

## What changed in the tasks (9 November, VB-203)

- VB-205 and VB-206: confirmed, their numbers rewritten for `medium-ref` and a whole year.
- VB-201: rewritten for `medium-ref` (no `medium-y60`; the temporary allowance ended on 7 November), with the year's turn and the
  round's day as its targets, and daily life's share.
- VB-199 and VB-200: `medium-y60` replaced by `medium-ref`; the save counted on the main thread.
- New: VB-226 (the save, after the folds) and VB-227 (jobs).

## recordFold's history ratio (11 November, VB-268)

The fold walked its whole window once for each village and once more for the events of none, so its work was window times
(villages + 1), and the window itself doubles at year 25, when the long (generation) fold starts: at `small-y5` only the short
window runs, at `small-y40` both. History ratio 2.993 tonight (1.558 when VB-199 landed). The fold now takes a slice of the slots a
day over four days (one scan to mark, one to fold, no village loop): 1.382, residual +0.13. What is left is the long window itself:
each routine event is passed twice at two years and twice again at 25, so the work per slot at year 40 is about twice that at year 5
(361 and 1,017 slots passed at the two saves, 0.033 and 0.046 a living pawn-day). Cutting it further needs the marking scan replaced
by a position index per year (a new state field); the work is under 0.05 a pawn-day, so it is left as a residual.
