# Closure table: the budget at `medium-ref`

VB-203, 9 November 2026, at `9f130e6` with the fixtures made there (fresh). Node 22, 4-core Xeon. Written by hand; the generated
numbers of each night are in `budget.md`. Kim's answers of 9 November: the shares below, a whole game year as the bench's window,
and the save line counted on the main thread.

## The lines, where each is measured

| Line (Kim) | Fixture | How | Today | Within? |
|---|---|---|---|---|
| Mean, 200 ms a game day for today's systems | `medium-ref`, a whole year (48 days) from the save | reported nightly (`tools/bench.js`) | 226, 233 and 237 ms (three runs) | over by about 15% |
| Each system's share (below) | `medium-ref`, a whole year | reported nightly (`budget.md`, the budget column) | below | four over |
| No 6-minute step over 60 ms | `medium-ref`, a whole year | reported nightly (`tools/bench.js`) | 96 to 103 ms; 11 to 14 steps a year over 60, all midnights | over |
| No 6-minute step over 60 ms | `small-y40`, 30 days and one round | reported in verify (`tests/history.js`) | 55 ms (a whole year) to 62 ms (verify's window) | at the line |
| Cost per living pawn-day, `small-y40` at most 1.25 times `small-y5` | `small-y5`, `small-y40` | work counters asserted in verify (`tests/history.js`); wall clock reported there | counters pass (two known excesses: `routeRefresh` 1.81, `roundPairs` 1.33); wall clock 0.99 and 1.07 (two runs) | within |
| Save, 0.5 s of main thread (encode + stringify) | `medium-ref` | reported nightly | 1.51 s (and 0.58 s of gzip, which may move to a worker) | over, 3 times |
| Load, 0.5 s (parse + load) | `medium-ref` | reported nightly | 0.33 to 0.55 s | at the line |
| Gzip, 10 MB | `medium-ref` | reported nightly | 6.9 MB | within |

None of them is asserted on wall-clock time: the bench and the step timings report, and only work counters fail a run.

## By system

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

## The steps

At `medium-ref`, over a whole year, every step over 60 ms is a midnight:
- the year's turn: 96 to 103 ms on its first midnight, 72 to 83 on its second and 79 on its third;
- the moving round's day (autumn day 11): 101 ms at midnight in the bench, 63 to 75 in the other runs; the round's own call is 51 to 56 ms;
- late autumn and winter: 63 to 87 ms on several midnights.
The meetings' call is 38 to 50 ms, and its noon step was 60 ms in one run. All three are VB-201's (midnight, the round's day) and
VB-206's (the meeting's step). On `small-y40` no step went over 60 ms in a whole year (55 at most); verify's window, with two workers
running at once, read 62 ms on the year's first day.

## The save

The state's 36.8 MB of JSON at `medium-ref`: pawns 14.5 (their copied events 5.3, ancestry 1.4, attitudes 1.4), the households'
ledgers 10.6, the record 7.9, the path cache 1.2, the rest 2.6. VB-204 folds the ledgers' routine entries and VB-199 the record's
routine kinds and the pawns' copies; by size alone they should bring the main thread's 1.51 s to about 0.65 s. VB-226 (new) measures
what is left and cuts it to 0.5 s, with gzip off the main thread.

## What changed in the tasks

- VB-205 and VB-206: confirmed, their numbers rewritten for `medium-ref` and a whole year.
- VB-201: rewritten for `medium-ref` (no `medium-y60`; the temporary allowance ended on 7 November), with the year's turn and the
  round's day as its targets, and daily life's share.
- VB-199 and VB-200: `medium-y60` replaced by `medium-ref`; the save counted on the main thread.
- New: VB-226 (the save, after the folds) and VB-227 (jobs).
