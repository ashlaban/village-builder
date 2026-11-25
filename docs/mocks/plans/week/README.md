# Study B: the household's week and season under disruption

A throwaway mock of the plans design (`design.md` of the plans scratchpad, sections 2.1, 5, 6; the spec is `mocks-spec.md`, Study B).
It tests P5 to P11 against today's simulation at the working tree of 25 November 2026. No game code; nothing here is read by `src/`.

- `record.js`: the observer. It steps a real run 6 minutes at a time, reads `st` and writes nothing to it. For every household-day it records
  the members (age, adult, rate, ill, role), the woodpile and its target, the seasonal plan's steps, the head's cadence, the open jobs,
  the allotments (each new `plan.day`) and reviews (`plan.last` changes), and each member's hours by claimant and kind. For every job a
  household owns it records the pawn-hours its members spent on it (work and walk). It also records `dayPair` and `oppAsk` for each day.
  Output: `data/<scenario>-<seed>.jsonl`, 17 MB each, not committed (`.gitignore`).
- `planner.js FILE`: the analysis and a standalone planner over the recorded demand. It covers the record's own numbers (P6 baseline, P7
  baseline, P10), the forecaster (P5), two policies over the same demand (`daily`, today's allotment in small; `weekly`, the design's
  default author with W = 3, 4, 6, 12 days; P6 to P8, P11) and 200 injected disruptions a season of each kind (P9). It writes
  `data/<run>.json`.
- `summary.js`: the four runs side by side (`data/summary.txt`).

Runs: populous small seeds 7, 11 and 42, 2 years from year 1; founders small seed 7, 3 years. The planner's draws use mulberry32, seed 1.
Machine time: about 35 s per recording (run in parallel) and 35 s per planner run. Commands:

    node docs/mocks/plans/week/record.js --scenario populous --seed 7 --years 2
    node docs/mocks/plans/week/planner.js docs/mocks/plans/week/data/populous-7.jsonl --n 200 --json docs/mocks/plans/week/data/populous-7.json
    node docs/mocks/plans/week/summary.js

## First: is the daily mock a fair baseline?

The daily policy imitates `sim/day` `allot`: best fit first, with fit taken as the role's rank times urgency. A further hand counts 0.8.
The horizon is 6 hours. It allots anew at 6:00, at 14:00 and when a task of a non-due kind opens. A due kind is slotted (`slotIn`). A
vital task due today goes to the head of its hand's list, whatever its fit. On the same demand it places the members' hours as follows:

| | populous 7 | 11 | 42 | founders 7 |
| --- | --- | --- | --- | --- |
| member-by-kind hours placed differently from the record | 31.6% | 29.7% | 28.0% | 16.9% |
| total hours, mock against record | +4% | | | +2% |

The mock reproduces the founders' allotment well and the populous one only roughly. Reaching this took three fixes to the baseline, each
recorded in the code, never to the weekly policy:
- vital urgency;
- the heads of the lists;
- the precedence of a vital task due today. Without it, a lone farmer of cook rank 1 never cooked.

These fixes were made to match the record, before any prediction was read against them. The P8 comparison is therefore between two
small models of comparable fidelity, not between the design and the game.

## Results

Each row gives the number predicted, the numbers found at seeds 7 / 11 / 42 (populous) and on founders 7, and a verdict.

| Prediction | Predicted | Found (populous 7 / 11 / 42; founders 7) | Verdict |
| --- | --- | --- | --- |
| P5 foreseen (kind ±1 day and the kind's window hours ±25%) | ≥85%; <70% refutes | 31.0 / 32.4 / 31.9; 25.6 | **refuted** (number and, partly, mechanism) |
| P5, kind only (±1 day, any hours) | (not stated) | 75.7 / 78.0 / 80.5; 76.5 | the kinds are mostly foreseeable, but not their hours |
| P5, hours ±50% | | 47.8 / 49.5 / 50.1; 41.9 | |
| P6 reviews a household-day, weekly W=6 | ≤0.7 (0.5 in turn + 0.2 out) | 0.51+0.80 / 0.55+0.82 / 0.59+0.84; 0.47+0.77 | **refuted**: in turn as predicted, out of turn 4× |
| P6 pairs, weekly against daily | ≤40% | against the daily mock: 92 / 89 / 85%; 72%. Against the recorded `dayPair` (117 / 107 / 117; 47): 104 / 119 / 125%; 111% | **refuted** |
| (today, recorded) allotments and reviews a household-day | "4.4 allotments" | allotments 3.52 / 3.54 / 3.55; 3.33. Plan reviews already 0.67 / 0.68 / 0.74; 0.65 | the baseline is lower than the design's |
| P7 steps that change member between reviews, no disruption | ≤10% | 15.0 / 13.3 / 13.4; 6.2 | **refuted** for populous, confirmed for founders |
| P7 member-days beginning with yesterday's type of work | ≥80% (today 72 to 73%) | weekly 61.6 / 63.6 / 63.1; 73.8. Daily mock 67 / 70 / 70; 74. Record 62.9 / 64.6 / 65.7; 71.7 | **refuted**. The 72 to 73% is a founders' number; populous today is 63 to 66% |
| P7 windowed work begun no later than daily | ≥95% | 60.8 / 59.5 / 58.3; 49.1 (within 6 h: 78 / 77 / 75; 70) | **refuted** |
| P8 vital hours unmet, weekly against daily | within 10% | weekly 1.1 / 1.7 / 2.3; 1.3% against daily 0.8 / 1.2 / 1.0; 0.9% | **refuted** (1.4 to 2.3×, on small numbers) |
| P8 windows missed, weekly against daily | within 10% | weekly 3.0 / 2.9 / 2.2; 0.7% against daily 1.1 / 1.5 / 0.6; 0.7% | **refuted** for populous (2 to 3.7×), equal on founders |
| P9 re-plans in one review out of turn | 1 | after a death or 3 days ill: the disruption's review, then −1.2 to −0.2 further reviews against the undisturbed run | **confirmed**, partly by construction: at most one review out of turn a day |
| P9 steps dropped are those with the latest windows | yes | yes, but by construction: the greedy takes steps by window's end | **undecided** (not a test in this mock) |
| P9 no target lowered in autumn or winter | 0 | lowered or help asked, 1 or 2 adults, after a death: autumn 62%, winter 5%. After illness: autumn 30%, winter 0% | **refuted** for autumn (harvest and threshing fall there in this game) |
| P9 none in spring or summer for 3+ adults | 0 | death 14 / 15%, illness 7 / 8% | **refuted** (the number; the effect is small) |
| P9 1 or 2 adults lower a target or ask for help at a peak | ≥50% | death: spring 54%, summer 59%. Illness: spring 29%, summer 33% | **confirmed for a death, refuted for illness** |
| P10 household's share of adult working hours, spring and summer | 45 to 60% | spring 68 / 72 / 76; 77%. Summer 75 / 75 / 79; 85% | **refuted** |
| P10 household's share, autumn and winter | 20 to 40% | autumn 72 / 75 / 78; 83%. Winter 51 / 55 / 55; 75% | **refuted** |
| P10 village's share over a year | <3% | 3.6 / 3.3 / 3.5; 5.5% (winter 7 to 8%) | **refuted** narrowly |
| P10 obligations' share over all | <2% | 0.6 / 0.7 / 0.7; 1.1% | **confirmed** (debtors in their called season not separated) |
| P10 own hours at the mean in every season | ≥35% | spring 26 / 22 / 18; 17%. Summer 24 / 23 / 19; 13%. Autumn 24 / 21 / 18; 11%. Winter 40 / 36 / 36; 11% | **refuted** except in winter for populous |
| P10 a 0.85 ceiling binds | <10% of member-weeks, mostly 1 or 2 adults | 33 / 37 / 43; 53%. Also in 3+ households: 29 to 43% in spring and summer | **refuted** |
| P11 cost least at W 4 or 6, with 6 within 10% of 4 | | reviews and pairs nearly flat in W (1.33 / 1.32 / 1.31 / 1.29 a household-day at seed 7). Stale hours rise: 6.3 / 7.0 / 8.8 / 15.9. Windows missed rise: 1.5 / 2.2 / 3.0 / 4.3%. Least at **W = 3** for every exchange rate of pairs to hours. At 10 pairs an hour, 6 is 10% over 4; at 100, 23% over | **refuted** |

P9 in full, all four runs pooled. In each pair of figures the daily policy comes first and the weekly second. "Out of turn" counts the
further reviews out of turn against the undisturbed run.

| Disruption, adults | Δ vital hours | Δ windows missed | Out of turn | Steps dropped at the review | Lowered or asked |
| --- | --- | --- | --- | --- | --- |
| death, 1 or 2, spring / summer / autumn / winter | 5.0/4.8, 2.1/2.2, 2.6/2.1, 1.3/1.2 | 0.90/0.71, 1.46/1.56, 0.91/0.77, 0.01/0.03 | −0.9 to −0.5 | 7.6, 9.8, 11.4, 5.0 | 54, 59, 62, 5% |
| death, 3+ | ≤0.1/≤0.18 | ≤0.13/≤0.21 | | 1.9 to 5.5 | 14, 15, 9, 2% |
| illness of 3 days, 1 or 2 | 5.0/6.3, 1.1/2.6, 1.3/2.7, 0.5/1.6 | 0.28/0.21, 0.30/0.29, 0.13/0.11, 0/0 | | 5.2, 7.7, 8.9, 2.8 | 29, 33, 30, 0% |
| a wet day, any size | ≈0 | ≤0.15 a case, equal | ≈0 | 0 | 0 |
| a neighbour's ask, 1 or 2 | weekly costs 0.1 to 0.2 h more | equal | ≈0 | 0 | yes: daily 83 to 88%, weekly 86 to 89% |

Under the week a death costs no more than under the day. A three-day illness costs about twice the vital hours under the week (1.6 to
2.7 h against 0.5 to 1.3 h a case). Before the review, the ill member's assigned steps sit unworked, and the healthy members are busy
with their own steps. The day spreads the same work over the healthy members within hours.

## What the mock leaves out

- **Demand is fixed to the record.** A task's demand is the pawn-hours the household actually spent on it, walking included. Tasks the
  household never worked, work begun only because a member was idle, and the food that work produced are not re-simulated. "Fed as
  well" (P8) is approximated by vital hours unmet and by windowed tasks missed.
- **Deadlines are this mock's, not the game's.** Due and vital kinds are due by 20:00 of their day (the evening, `MATCH.day.evening`) and
  wood within 2 days. A windowed kind (plow, sow, weed, reap, haul, rake, mow, hay and their fetches) is due by the end of its season,
  and at least 3 days after it opens. Threshing has no window.
- **Capacity.** It is 12 working hours times the rate (2 more in the evening, for vital work only), less what the record shows went to the
  village, owed or lent days, away or abed. The 0.85 ceiling shapes only the weekly assignment. Members give their remaining own hours to
  open steps by rank, so the ceiling cuts no work in execution.
- **No walking model.** Rank does not change the work rate, a handover costs nothing, and the nearest-next order is absent.
- **The forecaster** is mine, made from the design's words. It uses due kinds at their rate over the last 6 days. Kinds that recur on 3 or
  more of those days come in at the same rate. Open jobs come in at their hours left, times the kind's median ratio of hours spent to
  estimate (taken from the whole record: slight foresight). The seasonal plan's steps come in at last year's same days, or else at the last
  12 days' rate. Targets and store projections are not modelled separately; the woodpile enters through the template's `wood` step. A
  better forecaster could do better, but the gap to 85% is large.
- **The weekly author.** Each step goes to the best rank with claimed hours left. The holder keeps it unless the rank gain times the hours
  exceeds the walk. A further hand at 0.8 is added only where one member's window does not cover the step. Placeholders stand for
  forecast steps and are matched by kind within a day. An unforeseen arrival, or a step leaving ±25% of its estimate, asks a review out
  of turn, at most one a day. Due kinds are slotted to their holder.
- **Disruptions** run on a 12-day season slice from a fresh plan, so a step carried in from before the slice starts with its whole demand.
  "Lowered or asked" means the disruption's review dropped a windowed step, or projected the season's windowed and due hours above 0.85
  of the members' hours.
- **The daily mock** misplaces 28 to 32% of member-kind hours on populous (see above).

## Surprises and what they suggest for the design

1. **The kinds can be foreseen; the hours cannot.** With the kind alone, 76 to 80% of task-hours are foreseen (±1 day). With the window's
   hours held to ±25%, only 26 to 32% are, and only 42 to 50% at ±50%. The surprises are the harvest kinds (reap 8% foreseen with hours,
   thresh 18%, plow 10%, weed 8%) and the opportunistic kinds that fill a slack hour (fish, rackfish, gather, hunt, grind). The week can
   carry *which* work and *who* holds it, but not how many hours it takes. This suggests making the week's step a **duty with a
   priority, not a quantity of hours**: "the wood is Olof's", "the reaping is Anna's and Per's". Only the season should count hours,
   against a target.
2. **Most reviews out of turn are caused by store-driven and filler kinds, not by disruption.** Arrivals the forecast did not hold cause
   0.56 to 0.59 reviews a household-day: weed, grind, dry, haul, brew, reap. The estimate's range causes 0.18 to 0.24 more. The
   design's 0.2 assumes the estimate's band is the main trigger. Pooling unforeseen arrivals to own hours instead (variant `w6pool`, not
   the design) brings reviews to 0.87 to 1.21 a household-day. It is still over 0.7, and leaves vital hours slightly worse (1.5 to 2.8%).
   The range trigger alone keeps the floor near 0.25: a ±25% band is narrower than these estimates' real spread.
3. **Week-grain assignment serializes work that the day parallelizes.** A 20-hour field step fits one member's week, so the week gives it
   to one member. The day puts three on it this morning. Windowed work therefore starts later: only 58 to 61% start no later than under the
   day, and 74 to 79% within 6 hours. Windows are missed 2 to 3.7 times as often. Further hands at 0.8 change little, because the week's
   capacity is seldom the limit. What the week lacks is the date. The design should let a windowed step say "by day X", and treat a step
   whose holder cannot finish by its window's end as wanting a further hand, as the daily `allot` already does against its horizon.
4. **Today's households leave far less own time than P10 assumes.** Adults spend 68 to 79% of working hours on household tasks in spring
   to autumn, and 51 to 55% in winter. Own hours fall to 18 to 26%. A 0.85 ceiling would bind in a third to two fifths of member-weeks,
   in households of three or more adults too. Much of this is "work beats idling" filling hours with fish, gather, grind and rackfish. The
   claim and the sovereignty measure must therefore be computed from the **plan's steps (need), not the hours worked**. The filler then
   books as own hours given (5.2, point 4). Otherwise sovereignty reads near zero and the ceiling cuts work that today feeds people. This
   needs a decision before step 5 of the path (the ledger). Which of the filler work is food a household lives by (fish, gather, grind)
   is a question for the balance map.
5. **The pairs do not fall.** A full repair weighs every step against every member. At about 0.8 reviews out of turn a day, the weekly
   policy weighs 85 to 92% of the daily mock's pairs, and more than the recorded `dayPair` (today already slots due kinds cheaply). P6's
   and P15's cost case rests on out-of-turn repairs being rare and partial. A review out of turn should **repair only the steps the
   deviation touches** (the dead member's steps, the kind that arrived), not re-weigh the week. Today's allotments are 3.5, not 4.4, a
   household-day, and today's plan reviews are already 0.67 to 0.74.
6. **Window length hardly matters for cost and matters for quality.** In-turn reviews are fixed by the cadence (1 to 3 days), so W changes
   almost no review count. A long W only adds stale placeholders (stale hours 6 → 16 a household-day from W 3 to 12) and missed windows
   (1.5 → 4.3%). Together with surprise 1, this argues that the week should be a short rolling commitment of duties (3 to 4 days, about
   the head's cadence), and that the season should carry the quantities. The design's six days rest on the calendar (half a season,
   twice `DAYS.notice`), not on the household's work. It could stay as the page's unit while the assignment looks 3 days ahead.
7. **Illness hurts the week more than death does.** A death changes the household's hours for good, and one review absorbs it. Three days
   abed leave the ill member's assigned steps waiting until the review, and the review lowers targets in about 30% of 1- and 2-adult
   cases, all for a three-day absence. A step whose holder becomes unavailable should **fall to the pool at once** (the ladder's rung 3 or
   4 without a review), and a target should not be lowered for an absence shorter than its window.
8. **A lone settler's week is its day.** On founders, steps moved between reviews are 6%, and the weekly and daily policies tie on missed
   windows (0.7%). The household-week level adds nothing for a household of one adult, which the design's failure modes already expect.
9. **Wet days and a neighbour's ask cost almost nothing under either policy.** A wet day costs at most 0.15 missed windows a case, in
   summer. The week says yes to a neighbour's ask more often (86 to 100% against 83 to 97%) and pays about 0.1 to 0.2 vital hours for it.
