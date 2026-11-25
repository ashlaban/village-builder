# Study C: the village's year, obligations, and parity

A throwaway mock study of "Plans at four scales" (the scratchpad design under review, sections 2.2, 5 and 6, predictions P10, P12 to
P16), run on 25 November against the simulation as it stands. No game code; nothing here is read by `src/`, tests or tools.

| Script | Kind | What it does | Cost |
| --- | --- | --- | --- |
| `observe.js` | observer | steps a real run a 6-minute step at a time (as `tools/hours.js`), reads `st`, writes nothing to it; records per household and game day the adults' (14 to 59, not retired) working hours (6 to 18) and how they were spent, its adults, fields and food outlook; per village its routines and work days; the counters a day | 38 s for 3 years of populous small |
| `model.js` | standalone, on the curves | P10 shares; P12 the alderman's year; P13 an estate's spring due | under 1 s |
| `parity.js` | observer (reach) + standalone (model) | P14: today's verbs tried for unplayed pawns on copies of one seeded state; P14/P16: a 20-household year with `decisions`, `command` and a default author, three controllers | 75 s a seed (1,000 random runs) |

```
node docs/mocks/plans/village/observe.js --scenario populous --seed 7 --map small --years 3   # writes out/curves-populous-7.json
node docs/mocks/plans/village/model.js --curves docs/mocks/plans/village/out/curves-populous-7.json [--json]
node docs/mocks/plans/village/parity.js --seed 7 --reps 1000
```

Runs: populous small seeds 7, 11, 42 and founders small seed 7, 3 years each (the curves are not kept: 0.8 MB a seed; rerun
`observe.js`). The printed outputs are in `out/` (`observe-*`, `model-*`, `parity-*`). Every draw of the models is from mulberry32:
`model.js` seed 1 (P12's lots and noise use `1 × 7919 + noise × 1000`); `parity.js` random controller seeds 1000 to 1999.
Machine time for the whole study: about 8 minutes.

How hours are counted. An adult's working hour is *village* when its job's owner is the village (`owner.type === 'village'`: the work
days' `workfence`/`workclear`, the fence's `mend`, the green's and well's building, the common field's plow, sow and reap), *owed* when
the pawn is on `st.daysToday`, *vital* for `KINDS[k].vital` (wood, water, cook, firewood, boothwater, drink), *field* for plow, sow,
reap, mow, rake, hay, haul (sowing = plow + sow), *other* for any other job, *idle* with no job; walking and carrying count to the
job. "The household's claim" is field + vital + other, i.e. by the hours worked today; "own" is idle.

## Results

| Prediction | Predicted | Found (seeds 7 / 11 / 42; founders 7) | Verdict |
| --- | --- | --- | --- |
| P10 household's share, spring and summer | 45 to 60% | 66.7, 73.3 / 72.4, 73.9 / 74.4, 76.7; f 78.8, 85.0 | **refuted** |
| P10 household's share, autumn and winter | 20 to 40% | 72.6, 49.9 / 76.3, 55.0 / 76.3, 52.5; f 83.0, 74.5 | **refuted** (autumn is a peak season here: reaping and hauling) |
| P10 village's share over a year | under 3% | 3.5 / 2.9 / 3.1; f 5.5 (winter 5 to 7%; f 12.8) | **refuted, narrowly** (the green, well and common field are village work too) |
| P10 obligations over all; a debtor in its called season | under 2%; up to 20% | 0.8 / 0.7 / 0.7; f 1.1. Debtor season p90 8.1 / 6.7 / 8.3, max 30.3 / 17.0 / 24.2 | **confirmed** (overall; the worst debtor seasons exceed 20% in 2 of 3 seeds) |
| P10 own hours at the mean, every season | ≥ 35% | 30.3, 24.2, 23.7, 42.1 / 25.1, 23.6, 20.3, 38.8 / 23.5, 20.9, 20.2, 40.2; f 11 to 18 | **refuted** (only winter) |
| P10 a 0.85 ceiling binds | < 10% of member-weeks, nearly all 1 to 2 adults | 33.6 / 39.4 / 44.1% of household-weeks; f 54.6%; of them 70 / 77 / 76% in 1 to 2 adults; spread over spring, summer, autumn | **refuted** (the number; the "small households" half holds) |
| P12 alderman vs calendar: displaced windowed hours | ≥ 30% fewer | 24.8 / 46.7 / 22.7% fewer (equal lots); by fields 22.9 / 40.5 / 20.8; one date for all 21.7 / 43.2 / 52.7; f 53.6 | **refuted on the number, mechanism holds** (always fewer; 2 of 3 seeds miss 30%) |
| P12 routine hours delivered | ≥ 90% | 97.7 / 98.7 / 99.2 (calendar 97.4 / 99.2 / 99.2) | **confirmed** |
| P12 household's own choice beats the alderman? | (asked) | yes: 100 / 99.2 / 96.8% fewer than the calendar | the date should go to the claimed (see surprises) |
| P13 N=3 sowing displaced, 3+ adults | under 2% | worst dates: 5.8 / 2.0 / 2.5 (all villages 3.5 / 2.6 / 2.0); spread dates 0.9 / 0.5 / 0.4 | **refuted** for dates on the sowing days, **confirmed** for spread dates |
| P13 N=3 sowing displaced, 1 adult | ≥ 10% | worst 48 / 82 / 76 (all villages 52 / 68 / 65); spread 15 / 24 / 0 | **confirmed** (but 1-adult samples are 2 to 17 household-years) |
| P13 defaults in a normal year | under 5% of called days | 8.0 / 0.8 / 1.1 (two villages); all villages 2.0 / 1.0 / 1.0 | **confirmed** (2 of 3 at two villages, 3 of 3 at all) |
| P13 defaults in a lean year | ≥ 3× normal | 4.6 / 1.6 / 5.4 (×0.6 / 2.0 / 4.9); all villages 1.5 / 2.7 / 2.6 (×0.75 / 2.7 / 2.6); with a monotone trigger ×1.4 / 1.6 / 1.1 | **refuted** |
| P13 defaults in households of 1 or 2 adults | ≥ two thirds | 100 / 100 / 80%; all villages 100 / 100 / 90 | **confirmed** |
| P13 commutation at 3 rations a day | the surplus commute, the rest default | commuted 62 / 46 / 68% of called days, every surplus household whose day would displace sowing; of households without a surplus the 1-adult default 44 / 0 / 0% and the 2-adult 33 / 11 / 8% of their days: the rest keep the day and lose sowing | **half confirmed** (the first half) |
| P14 empty controller: run identical to the default author's | hash equal | equal on every seed (the model's hash) | **confirmed, by construction only** (see what the mock leaves out) |
| P14 lookahead no worse (unmet vital, missed windows) | no worse on both | full lookahead: vital 0.6 / 0 / 0 vs 0 / 0 / 0 h, missed 840 / 913 / 1192 vs 106 / 70 / 230 h. Village days and substitution only: vital 0.6 / 0 / 0, missed 84 / 86 / 185 | **refuted** as specified; the village-days half is no worse in 2 of 3 |
| P14 decision points a head-day, alderman-day, pawn-day | ≤ 1.5, 0.2, 2.5 | model 0.34, 0.08, 1.17; reckoned from today's cadences: 0.61 to 0.66 reviews + 0.15 out of turn + 0.07 to 0.11 leave asks + under 0.01 called days ≈ 0.85 to 0.95; alderman ≈ 0.10 to 0.15; pawn 1.17 | **confirmed as a reckoning** (no point was counted in a real run) |
| P14 acts reachable only through the played pawn or by no verb | ≥ 5 | 10 (3 played pawn only, 7 no verb), the same on seeds 7, 11, 42 | **confirmed** |
| P16 random 30% authored: no double manning, no ceiling exceeded, vital unmet ≤ default + 5% | all three over 1,000 | due work slotted in (design 5.3 d): 0 / 0 / 0 doubles, 0 ceilings, 0 of 1,000 runs over, each seed. Due work planned as any step: 0, 0, and 1000 / 999 / 603 of 1,000 runs over (mean +89 / +70 / +58 h) | **confirmed, conditionally** (holds only with slot-in) |
| P15 baseline (reported, not tested) | | dayPair 6,805 / 6,604 / 6,664 a day; oppAsk 5,629 / 5,757 / 5,696; dayTake 2,332 / 2,381 / 2,133; f 232, 410, 82 | |

### P12 in detail (displaced windowed hours per household-season, 1 / 2 / 3+ adults, equal lots)

| Placement | seed 7 | seed 11 | seed 42 |
| --- | --- | --- | --- |
| calendar (today's days: the work days, the common field's days, as recorded) | 1.02 / 0.75 / 0.45 | 2.85 / 0.78 / 0.65 | 2.04 / 0.49 / 0.25 |
| alderman, each household's lightest days (last year's curve ± 20%) | 0.44 / 0.68 / 0.30 | 0.86 / 0.64 / 0.14 | 1.51 / 0.43 / 0.11 |
| alderman, one date for all | 1.27 / 0.50 / 0.34 | 1.43 / 0.49 / 0.33 | 0.67 / 0.31 / 0.02 |
| household's choice (this year's load ± 20%) | 0 / 0 / 0 | 0.10 / 0 / 0 | 0.34 / 0 / 0 |
| random days in the season | 1.02 / 1.16 / 0.27 | 1.96 / 1.07 / 0.39 | 2.08 / 0.66 / 0.28 |
| alderman in hours (2-hour lots) | 1.29 / 0.25 / 0.17 | 1.09 / 0.21 / 0.10 | 1.11 / 0.15 / 0.03 |

Displaced hours are small against what is claimed (calendar: 271 / 360 / 192 h of 6,696 / 4,760 / 5,456 claimed), and they fall
on the one-adult households: 2 to 4 times the 3+-adult households' a household-season under the calendar.

**The estimate's noise.** Cut against the calendar by noise (alderman each; one date): ±0: 29 / 40 / 34 (33 / 51 / 45); ±20%:
25 / 47 / 23 (22 / 43 / 53); ±50%: 23 / 40 / 31; ±100%: 18 / 17 / 35; ±200%: 26 / 38 / -8; ±500%: -2 / 38 / 10. Noise of ±20% does not
matter: a noise-free estimate from last year gains 4 to 11 points at most. The alderman stops beating the calendar at ±200 to 500%,
where his placement becomes the random one. What limits him is the predictor, not its noise (surprise 1).

**Days or hours.** Claims in 2-hour lots on the lightest days cut the alderman's displaced hours by a further 35 / 51 / 59%, but not
for one-adult households (0.44 → 1.29, 0.86 → 1.09, 1.51 → 1.11): a lot of 2 hours on a one-adult day with field work still
displaces it, and lots spread over more days meet more of them. Hours serve the 2- and 3+-adult households; for the one-adult
household the date matters more than the grain.

### P13 in detail

Two villages (the largest), every household, N adult-days in spring at 3 days' notice, three years each normal (crop 1) and lean
(crop 0.6). The household's food outlook is modelled from its own outlook on spring's first day (store + expected intakes − spoilage,
the intakes cut by the crop factor and by the share of its spring sowing hours lost, walked against four seasons' need; "bad" as
`sim/outlook`: the first short season met below half). Table: seed 7, worst dates (the household's own heaviest sowing days),
sowing displaced 1 / 2 / 3+ adults, defaults of called days.

| Option | N=1 normal | N=3 normal | N=3 lean | N=6 normal |
| --- | --- | --- | --- | --- |
| none (the named adult goes; its share of the work stays its own) | | 48 / 24 / 13%, def 8.0% | 57 / 24 / 13%, def 6.9% | |
| substitution (any adult goes: pooled hours) | 22 / 6 / 3%, def 6.9% | 48 / 12 / 6%, def 8.0% | 57 / 13 / 6%, def 4.6% | 81 / 14 / 6%, def 1.1% |
| commutation (with substitution; surplus households pay 3 rations a day) | | 16 / 1 / 0%, def 5.7%, commuted 62% | 45 / 3 / 0%, def 4.6%, commuted 48% | |

All villages, substitution, worst dates, defaults normal → lean, with the label trigger and with a monotone one (default while the
reckoning covers under 3.5 seasons of need): N=1 1.5 → 6.8 / 2.2 → 3.6 / 3.8 → 4.6 (label); 3.8 → 9.8 / 4.4 → 8.8 / 6.2 → 6.9 (cover).
N=3 2.0 → 1.5 / 1.0 → 2.7 / 1.0 → 2.6 (label); 5.6 → 8.1 / 3.6 → 5.6 / 3.6 → 4.1 (cover). N=6 is lower than N=3 in default rate
because the extra days fall on days without sowing to lose. 3+-adult households default in no cell of a normal year.

### P14: reachability against today's code

A controller tries each act for unplayed pawns (head = holder of household 0, member = its other adult, the village's alderman by
`sim/decisions.agentOf`) at year 2, spring day 1, 0:30, each on a `structuredClone` of the seeded state; what is refused is retried
as the played pawn (`Sim.inhabit`, then the player's routes). Refusals for state ("there is no work for another hand", "it holds no
herd at the side", "the work day is called") are read as the verb being there; refusals by right are not. Same on seeds 7, 11, 42.

| Act | Verdict | Verb, and why |
| --- | --- | --- |
| a target; the order of the season's work; a tile for the next field; a project | verb, any pawn | `target`, `order`, `tile`, `project`: the head's right (`heads`) |
| a member's day order (by the head); giving a task to another member; calling a member | verb, any pawn | `dayOrder`, `dayGive`, `dayCall`: the head's right |
| calling a day owed | verb, any pawn | `callDays` (accepted on seed 11; refused on 7 and 42 for state) |
| a work day | verb, any pawn, but on the calendar's day only | `callWorkday`: the alderman (`agentWhy`); already called by 0:30 on all seeds |
| a routine | verb for the meeting as a body, not for any pawn | `routines`: its actor is `{settlement}`; the alderman's id is refused |
| help asked (food) | verb, any pawn | `offer` on the basis `ask`, issued by `sim/help` (read, not executed) |
| a pastime | verb, any pawn | `pastime` |
| a queued command; a multi-step task at a tile (the chains); automatic behaviour off | **played pawn only** | `Sim.queue`, `sim/playerplan.plan`, `Sim.setAuto`: all read `st.player` |
| a pawn's own day order; a week of a pawn's own steps | **no verb** | `dayOrder` is the head's alone |
| a work day on a date the alderman chooses | **no verb** | `WORKDAY.days` fixes it |
| a claim on a household's days a season ahead | **no verb** | |
| leave asked and answered | **no verb** | `sim/voice` writes `st.leaves` by rule |
| hands asked (help with work) | **no verb** | |
| an aim of a pawn's own | **no verb** | |

The gap list for the migration: the player's three (`queue`, chains, `auto`), the pawn's own day and week, leave, hands asked, the
claim and the date of village work, aims, and the routine authored by a pawn for the meeting.

### P14 and P16: the parity model

20 households of the curves, year 2 (days 48 to 95), one village. Each recorded day's hours become steps of at most 4 hours: vital
(window 0 days), field (window 3), other (window 5). The village claims 1 adult-day a household a season; an estate calls 1 day in
spring on every second household. Decision points: the alderman's season review (places the village days; default: the season's
first day, as today), the head's week review every 3 days staggered (default author: greedy by window's end, then vital, each step to
the first day in its window with planned hours under 0.85 × 12 × adults, never rewriting a planned or authored step), the called
day 3 days ahead; the day is worked claims first, then the day's steps vital first, from 12 hours an adult. Controllers: empty;
random-valid (a random 30% of the week's open steps put on a random day of their window that the ceiling check passes); lookahead
(village days on the household's lightest day from the season's fourth; other work moved to the least planned day of its window;
called days answered by substitution), and the same without moving other work.

## What the mock leaves out

- **The real run's hours are a demand that was met.** The curves are what was worked under today's allotment, not what was wanted;
  displaced and missed hours are counted as lost on the day, though a windowed task can often be done the next day.
- **Households are pools of adult hours** in P12 and P13 (substitution); the "none" option of P13 is the other extreme (each adult's
  share its own). Skill (the plowman, the ox team) is in neither. Children's and elders' work is not counted.
- **The food outlook model** scales every expected intake by the sowing lost, not only the spring-sown crop, and reads one outlook
  on spring's first day; the default is decided with perfect knowledge of the called days' work.
- **P12's alderman** estimates from the same calendar day last year; the household's choice is given this year's curve with ±20%
  noise, which is close to foresight. Year 1 is skipped (no year before it); the first work days are in year 2.
- **P13's samples are small**: one-adult household-years number 2 to 17 a seed; the 1-adult rates move by whole households.
- **The parity model is not the simulation.** Its hash equality is by construction (the empty controller calls nothing); the real
  test needs the implementation. It has no step-at-risk decision point, no asks, no leave, no deaths; decision points are counted at
  cadences assumed, so the reckoning from today's cadences (plan reviews 0.61 to 0.66 a household-day and leaves 0.07 to 0.11
  measured on seeds 7, 11, 42 in `parity.js`) is the better number.
- **Reachability** was tried on one state a seed; arguments were built by hand, so a state refusal may hide a right refusal for an
  act that was never reached. The help ask was read, not executed.
- **The ceiling** is measured on household-weeks, not member-weeks: a member-week ceiling binds at least as often.

## Surprises, and what they suggest for the design

1. **The alderman lacks information, not accuracy.** Even a noise-free copy of last year's curve cuts displacement by only 29 to
   40%; the same day a year later is a poor predictor because sowing and haymaking move with the weather. The claimed household,
   placing its own days a few days ahead, removes 97 to 100% of the displacement. *Suggest:* make the default **"the claimed names
   the day within the claimant's window"** (5.1 already allows it: "unless the claimant holds the right to name the day"), keep the
   alderman's date for work done together (the fence, where one date for all is the point), and drop the alderman's load estimate
   from the default author. The alderman's strip would show windows and who has named a day, not load.
2. **Today's calendar is not the straw man.** Random placement is as good as the calendar at best and up to 84% *worse*: spring's first day falls before
   the sowing peak and summer's second before the hay. The fixed days were well chosen; P12's 30% was set against a weaker baseline.
3. **The household claims far more than the design expects, and the 0.85 ceiling would bind every third to second week.** By the
   hours worked today the household takes 67 to 85% in spring to autumn (autumn is a peak, reaping and hauling, not a slack season),
   own hours are 20 to 30% outside winter, and a 0.85 ceiling binds 34 to 55% of household-weeks, three quarters of them in
   households of one or two adults. Either the ceiling is near 1 in peak seasons (a custom by season), or "own hours given" (5.2,
   point 4) carries a quarter of all work, which is the behavioural risk of question 4 made concrete. *Suggest:* a ceiling by season
   and household size, or sovereignty read only as a measure, and P10 re-stated before building step 5 of the path.
4. **The default rule switches on a label, and the label is not monotone.** "Bad" (the first short season met below half) can turn
   into "short" when the crop is leaner, because the first short season moves earlier and is met above half; in several cells a lean
   year shows *fewer* defaults. This is the design's own rule, A label is read, never a switch, broken by 5.2. *Suggest:* the head
   defaults on a threshold of a measure (seasons of food covered, as `cover` here), which also makes defaults rise with leanness
   (×1.1 to 1.6 here, still not ×3).
5. **Who defaults is decided by the household's size, not the year.** Households of three or more never default in a normal year:
   substitution absorbs the day. One-adult households default up to 40% of their called days even in a normal year (33 to 39% with the monotone trigger, 0 to 14% with the label), so a lean year
   has little left to triple. *Suggest:* lots by adults (or a floor that exempts a one-adult household at its sowing) would do more
   than any default rule; and P13's "×3" should be stated per household size.
6. **Substitution is worth more than commutation to most households.** A named adult (no substitution) loses 3+-adult households 11
   to 13% of their sowing against 2 to 6% with substitution. Commutation helps the half that hold a surplus; households without one
   mostly *keep* the day and lose their sowing, since the rule defaults only on "bad": the poor pay in sowing what the others pay in
   grain. *Suggest:* `substitute` first, as question 7 proposes; and a `release` or `transfer` by the claimant (the alderman lends the
   day) as the default answer for a household that can neither commute nor spare the day, before the default.
7. **P16 holds only because due work is slotted in.** If vital work were planned as ordinary steps, a random 30% authored crowds it
   out in 60 to 100% of runs (+58 to +89 vital hours unmet a year): the ceiling check passes, but the vital work of tomorrow has no
   room. *Suggest:* state slot-in (5.3 d) as a precondition of "fill, don't overwrite", or have the `plan` verb's check reserve the due
   kinds' expected hours of each day.
8. **A lookahead that levels its own planned load misses 5 to 13 times more windows.** Days further ahead always look lighter, because
   their demand is not yet known, so work drifts to the end of its window and, authored and never rewritten, is missed there. The same
   trap as surprise 1, inside the household. *Suggest:* the "step at risk" decision point (5.4) must be able to hand an authored step
   back to the default author, or an authored step should carry a latest day after which it is the rule's again.
9. **Parity gaps sit at the bottom and the top, not in the middle.** Every household-plan act a head has is already a verb any head
   can issue; the gaps are the pawn's own (day order, week, aims, leave), the village's dating (the work day is fixed by the calendar
   and called by the first hour, leaving no deadline for a controller), the routine (a verb whose actor is the meeting, not a pawn),
   and the player's queue, chains and `auto`.
10. **Decision points the design did not list:** the work day's call (today at the day's first hour, so its deadline is the day
    before); a claimed adult dying or falling ill on a called day (substitution forced); a commutation offered, which the claimant must
    answer (an ask in reverse); a claim lapsing uncalled at its window's end (the claimant may carry it over); the meeting's choice of
    routines, which no pawn authors.

### What each would need to see on the page

**The alderman** needs the year at a glance: a row a household, a column a season, each cell the days claimed, whether the household
has named its day (a hatched block until it has), and the claims met, lapsed and defaulted. He does not need the households' load
(surprise 1); he needs the work done together marked with its date and the turnout of the last one, and a household's default with
its reason ("the rye stood ripe") where he can answer it with `release` or `transfer`.

**The head** needs the season with its claims from above as blocks in their windows (village, estate), each with the days still to
name, and beside it the household's own peaks: the sowing and the hay as bars. To choose well it needs to see what a day named costs
(the field work it would displace, by its own estimate), the options `substitute` and `commute` with their prices, and the food
outlook as a measure (seasons covered), never only its label.

**The member** needs its week: which days are the household's, which are claimed from outside (a village day, a called day) and whom
they are for, and its own hours left; and, when it is the one named for a called day, the walk and what it leaves undone.

## Machine time

Observer: 4 runs, 6 to 40 s each (twice, the second recording the food outlook's parts); models under 1 s each; parity 75 s a seed
(the reachability state, a year's cadence count, 2 × 1,000 random runs). About 8 minutes in all.
