# Closure table: the budget at `medium-ref`

Written by hand; the generated numbers of each night are in `budget.md`. The first section is slice 0's wrap-up (VB-200, 10 November,
at `7205992`); the sections dated 9 November are VB-203's, at `9f130e6` with the fixtures made there (fresh), Node 22, 4-core Xeon,
after Kim's answers of 9 November: the shares, a whole game year as the bench's window, and the save line counted on the main thread.
The cost-growth table is kept current.

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
