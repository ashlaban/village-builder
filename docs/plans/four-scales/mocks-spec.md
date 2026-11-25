# Mock studies for "Plans at four scales"

Three independent throwaway studies that strain the recommended design of `design-v1.md` (in this folder; section 5, predictions P1 to P16
in section 6). Each is run by one agent, in parallel with the others; none needs another's output.

## Rules for all three

- **Read the design first**: `design.md` sections 2.2, 5 and 6, whole, once. Then `AGENTS.md` (Commands, Finding things) as needed.
- **Never change `src/`**, tests, tools, the backlog or the design. A study lives in `docs/mocks/plans/<study>/`: one or two scripts
  and a `README.md` with its numbers, in the manner of `docs/mocks/blocks/` (read `docs/mocks/blocks/mock.js` lines 1 to 20 for the
  pattern: `require('src/load.js')`, generate the map, `Sim.seed`, step the run, read `st`, write nothing to it). Do not commit
  unless told to; `index.html` is never committed.
- **Two kinds of mock are allowed**: an *observer* that steps the real simulation and reads it, and a *standalone model* seeded with
  numbers the observer recorded. A standalone model may be as small as it likes; say what it leaves out.
- **Determinism**: every random draw from a seeded generator of the script's own (a small mulberry32 is enough); report the seeds.
- **Runs**: default `--scenario populous --seed 7 --map small`, and `founders --seed 7 --map small`; repeat the headline numbers at
  seeds 11 and 42. Years as each study says. A single run of the real simulation must stay under 5 minutes (two years of populous
  small is well within it); the whole study under 30 minutes of machine time and about 60 model calls.
- **Report** in the README: a table with one row a prediction tested: the number predicted, the number found (each seed), and a
  verdict of *confirmed*, *refuted* or *undecided* with the reason; then what the mock leaves out; then **surprises and what they
  suggest for the design**, which is the most useful part. A refutation is a good result: do not tune the mock until a prediction
  passes. Where a prediction's number is missed but the mechanism holds, say both.
- Useful reads: `VB.count` (the work counters, `tests/counters.js`: `dayPair`, `oppAsk`, `dayTake`), `tools/hours.js` (pawn-hours a
  household by kind: `--help`), `node tools/sim.js --report perf|hours|idle|plans`, `VB['sim/kinds'].KINDS`, `st.agents[id]`
  (`job`, `phase`, `load`, `basis`), `st.plans.households`, `plan.day.lists`, `st.jobs`.

---

## Study A: the task as a plan (`docs/mocks/plans/task/`)

**Question.** Can a task hold no phase, its next leg being worked out from the world each time (design 2.2), for the kinds the game
has; does that remove the rare exits and the per-kind hooks; and what does choosing a method by where the pawn stands save?

**Predictions tested.** P1, P2, P3, P4.

**Method.**

1. *A tally over the real kinds (P2).* Load `VB['sim/kinds'].KINDS`. For every kind, list which of the fields `load`, `stack`, `back`,
   `carry`, `to`, `deliver`, `again`, the stage fields, `setOut`, `inside`, `spot` and any function-valued field it uses, and write
   its method or methods by hand as data in the eight primitives (`go`, `fetch`, `work`, `load`, `haul`, `unload`, `return`, `wait`).
   Group kinds that share a method. Record every kind that does not fit, and why (what the ninth primitive or the remaining hook would
   be). Also read the inline cases of `agents.ended` and `complete` (`src/sim/agents.js`) and say which state fact replaces each.
2. *A standalone micro-world (P1, P4).* A grid with a farm, a forest tile, a well, a field, a meadow and a creditor's farm; stores,
   piles at tiles, pawns that carry, one cart. Implement `next(world, goal, pawn)` and the methods for at least eight kinds chosen to
   cover the shapes: firewood from felling to the pile (design 2.2's table, all five rows as tests), water, the sheaves' haul, hay
   from mowing to the barn, sowing (seed fetched from the store), a building step that needs timber at a site, fishing (no load out,
   a load home), milking (no walk). Beside it, a phase machine (`go`, `work`, `back`, `home`) for the same kinds, written as
   `src/sim/agents.js` does it (read `start`, `arrived`, `ended`, `complete`), without their special cases.
3. *Fuzz (P1).* 10,000 task runs for each engine: at a random leg, apply a random cut from {night, the head's call to another task,
   the pawn's death, a helper joining then leaving, the cart taken by another, the window of a day owed ending (the VB-1548 case:
   the pawn works for a creditor, is on the road with a load when its 8 hours end), illness}. Then let any eligible pawn continue
   for three days. Invariants: every good is in a store, a pile or a pawn's hands (mass is conserved); no task stays open with no
   next step and no `blocked` reason; no pawn holds a load with nowhere to take it; the goal's amount is reached or the task is
   resumable. Count violations by cut and kind for both engines.
4. *Where pawns stand when a task begins (P3).* An observer over the real run, populous seed 7 small, 1 year from year 1, and founders
   3 years: at every task begun away from home (a change of `agent.job`), record the kind, the pawn's distance in steps to the site,
   to home, and the site of its previous task that day; and the hours walked by kind (from the legs). Then, offline, re-order each
   pawn-day's tasks that have equal urgency class by nearest-next and reckon the walking hours saved, using straight distances times
   the run's mean cost per step (say so). Report the share of tasks begun within one step of the site, and the saving by kind.
5. *Cost (P4).* Count leg ends a pawn-day in the observer; time `next` in the micro-world over a million calls.

**Metrics.** Violations per 10,000 runs by engine and cut; kinds expressed by ≤3 methods of ≤8 primitives, and the list of misfits;
fields of the kind record that fall away; share of tasks begun at or beside the site; walking hours saved, by kind and in all; calls
of `next` a pawn-day and microseconds a call.

**Pass or fail.** P1 confirmed if the derived engine has no violation and the phase engine shows the stuck owed day at least once in
1,000 runs of that cut (if the phase engine never sticks, say what in the real code makes VB-1548 and whether the mock missed it).
P2 confirmed if at most 5 kinds misfit and no carrying kind needs a hook. P3 confirmed at ≥8% begun beside the site and ≥10%
(wood, stone, haul) and ≥4% (all) of walking hours saved; report the numbers whatever they are. P4 at ≤14 calls and <1 ms a day
for 1,000 pawns.

**Also say.** Which goods lie in a pile at a tile today and which would need one; whether a partial load set down mid-road is ever
worth it; any kind whose "progress in the world" has no natural place.

**Bound.** One observer run of each scenario (under 3 minutes each); the fuzz under 2 minutes.

---

## Study B: the household's week and season under disruption (`docs/mocks/plans/week/`)

**Question.** Is a household's work foreseeable enough for a six-day rolling plan to stand; how often must it be repaired; what
would the claims on its members' hours be; and are households as well served as by today's twice-daily allotment, also when a
member falls ill or dies, the weather takes a day, or a neighbour asks for help?

**Predictions tested.** P5, P6, P7, P8, P9, P10 (the household's share and the ceiling), P11.

**Method.**

1. *Record (an observer).* Populous seed 7 small, 2 years from year 1 (and seeds 11, 42; founders seed 7, 3 years). Each game hour,
   for each household: each member's state (working on kind K at tile T, walking for K, idle, own time, abed, away, on a day owed or
   lent), its available hours (age, health), and at each day's start the stores, the targets and the seasonal plan
   (`st.plans.households`, `st.plans.seasons`), the open jobs of the household with their windows and hours, and `plan.day.lists`.
   Also the counters `dayPair` and `oppAsk` a day, and the number of allotments a household-day. Write one JSON-lines file per run
   under the study's folder (not committed if large).
2. *Shares (P10).* From the record: by season and household size (1, 2, 3+ adults), the share of adult working hours (12 a day times
   hands) spent on the household's tasks, the village's, a day owed or lent, and neither. Then how often a household's hours on its
   own tasks exceed 0.85 of a member's working hours in a six-day window (the ceiling would bind).
3. *Foresight (P5).* Build the forecaster the design's default author would be: at the start of each window, from the season's
   template and targets, the due kinds (water, cooking, milking, fodder at their daily hours) and each store projected at its recent
   rate (the woodpile crossing its mark), predict the household's task-hours by kind and day. Score against what was worked: a
   task-hour is foreseen when its kind was predicted within a day and the kind's hours for the window within 25%. Report by season
   and by kind which work is the surprise (this list decides what the repair must handle).
4. *A standalone planner on the recorded demand (P6, P7, P8, P11).* Demand is the recorded stream of the household's tasks (kind,
   tile, hours, window, vital or not, the hour it became open). Two policies allot the same members' hours over it:
   **daily**: the rule of today in small (`design.md` section 7, The day's work: best fit first, a further hand at 0.8, anew at
   5:00 and 14:00 and when tasks change); **weekly**: the design's default author (5.4): a rolling window of W days reviewed on the
   household's planning day (every 1, 2 or 3 days, take the recorded cadence), steps to members by window's end then rank, the
   holder of the same duty first when the handover cost (the walk to the site) says so, due kinds slotted in, a review out of turn
   when a step's projected end leaves ±25% of its estimate or a store crosses its mark, at most once a day. W in {3, 4, 6, 12}.
   Use the kinds' ranks from `VB['sim/roles']` and walks as recorded distances.
5. *Disruptions (P9), injected into both policies on the same demand:* (a) an adult abed for three days from a random day; (b) an
   adult dead from a random day; (c) a wet day: no field or hay work that day; (d) a neighbour's ask for a hand for one day at a
   peak (answered yes when no vital or closing-window step wants the hours). Each at 200 random household-times a season, by
   household size.

**Metrics.** Share foreseen (P5) by season and kind. Reviews a household-day, in turn and out of turn, and pairs weighed against the
recorded `dayPair` (P6). Share of assigned steps that change member between reviews with no disruption; share of member-days that
begin with yesterday's type of work; the lateness of windowed work's start against the daily policy (P7). Vital hours unmet and
windows missed, weekly against daily (P8: a proxy for "fed as well", since the real simulation is not changed; say so). After a
disruption: reviews taken to settle, steps dropped and their windows, whether a target was lowered or help asked, by season and
household size (P9). For each W: reviews, stale steps (assigned and then moved or dropped), hours lost to them (P11).

**Pass or fail.** As the predictions state their numbers: P5 ≥85% (under 70% refutes the week); P6 ≤0.7 reviews a household-day and
≤40% of the pairs; P7 ≤10% moved, ≥80% same type, ≥95% of windowed work begun no later; P8 within 10% of daily on both measures at
each seed; P9 as written; P10's bands; P11 the least total cost at W of 4 or 6 with 6 within 10% of 4.

**Also say.** What kinds of work are the unforeseen 15% (or more); whether the daily policy in the mock reproduces the recorded
allotment well enough to be a fair baseline (compare its member-kind hours with the record's and report the gap first); whether a
ceiling under 0.85 would change anything; whether a lone settler's week differs from its day at all.

**Bound.** Recording under 5 minutes a run; the planner and the injections in seconds. If the recorder's hourly pass is slow, sample
households (every third) and say so.

---

## Study C: the village's year, obligations, and parity (`docs/mocks/plans/village/`)

**Question.** Can an alderman claim households' days a season ahead without breaking their peaks; what does an estate's spring due
cost and who defaults; and can an external controller author plans at every level through verbs alone?

**Predictions tested.** P10 (the village's and the obligations' shares), P12, P13, P14, P16; P15 in part (the counters).

**Method.**

1. *Load curves (an observer, of this study's own).* Populous seed 7 small, 3 years from year 1 (and seeds 11, 42): for each
   household and game day, adult hours available, hours worked on its own windowed kinds (plow, sow, harrow, mow, reap, haul: take
   the kinds whose record has a window), on vital kinds, on village work (`owner.type === 'village'`, work days of `sim/workdays`),
   on days owed (`st.daysToday`), and idle; its adults, its fields, its food outlook's state if present; the village's routines of
   the year (`plan.routines`) and each work day's turnout. Report the village's and the obligations' share of adult hours (P10).
2. *The alderman's year (P12), a standalone model on the load curves.* For each village and year, take its routines' hours as
   recorded and turn them into claims of adult-days a household a season, by equal lots and by lots in proportion to fields. Three
   placements: **calendar** (the fixed days of today: spring day 1, summer day 2, the common field's days as recorded); **alderman**
   (the design's default author: each claim's day placed, at least 3 days ahead, on the claimed households' lightest day in the
   window by an estimate of their load, which is the previous year's curve with noise of ±20%); **household's choice** (the
   household places its own days within the season). Reckon for each: hours of windowed work displaced (demand that day beyond the
   hours left), the routine's hours delivered, and whom it hurts by household size.
3. *An estate's due (P13).* Add a claim of N adult-days in spring on every household of two villages, N in {1, 3, 6}, the dates
   called by the estate at 3 days' notice (worst case: on its own sowing days, which are the households' too; and spread).
   The claimed head resolves an over-claim by the default rule of design 5.2 (vital, then a claim with an enforcer, then its own
   windowed work, except that it shorts the outside claim when keeping it would put its food in "bad": model the food outlook as
   the season's expected crop reduced in proportion to sowing hours lost, against need). Options allowed in turn: none; substitution;
   commutation at 3 rations a day when the household's store holds a surplus. Make one year in three lean (the crop at 0.6).
   Report displaced sowing hours and default and commutation rates by household size, N, the year and the options.
4. *Parity against today's code (P14, first half).* Write a controller script that, for a pawn that is *not* the played pawn (a head
   in populous; the alderman or eldest holder of a village), tries to author each thing the design's plans hold, through
   `Sim.command` / `issue` only: a target, the order of the season's work, a tile for the next field, a project, a member's day
   order, giving a task to another member, calling a member, calling a day owed, a work day, a routine, leave asked and answered,
   help asked, a pastime, a queued command, a multi-step task at a tile (the player's chains), automatic behaviour off. For each:
   reachable by a verb for any pawn; reachable only for the played pawn (`st.player`); reachable by no verb. Run it on a copy of a
   seeded state only (never saved). This is the gap list the migration must close.
5. *Parity in a model (P14 second half, P16).* A small standalone household-and-village model with the design's interface:
   `decisions(pawn)` lists the open decision points (a week to review, a season, a year, an ask, an over-claim, a step at risk),
   `command(cmd)` authors, and the default author fills what is not authored at each point's deadline. Three controllers over the
   same seeded year of 20 households (demand from the load curves): **empty** (authors nothing: the run's state hash must equal the
   default author's); **random-valid** (authors a random 30% of week steps that pass the checks: P16's invariants: no double
   manning, no ceiling exceeded, vital hours unmet within 5% of the default); **lookahead** (moves wood cutting to the winter's
   slack, answers called days by substituting the adult with the lightest week, places village days as the alderman): unmet vital
   hours and missed windows against the default. Count decision points a head-day, an alderman-day and a pawn-day.

**Metrics.** Shares of adult hours by claimant (P10). Displaced windowed hours and routine hours delivered by placement (P12).
Displaced sowing hours, defaults, commutations by household size, N and year (P13). The reachability table (P14). Hash equality,
the invariants, the lookahead's gain, decision points a day (P14, P16). From the observer, `dayPair` and `oppAsk` a day as the
baseline that P15 is judged against later (report them; this study does not test P15 further).

**Pass or fail.** P12: the alderman's placement displaces at least 30% fewer windowed hours than the calendar's, with ≥90% of the
routine's hours delivered (also report whether the household's own choice beats the alderman's: if it does, the design should give
the date to the claimed, not the claimant). P13: under 2% of sowing hours displaced for three or more adults and at least 10% for
one adult at N = 3; defaults under 5% of called days in a normal year and at least three times that in a lean one, two thirds of
them in households of one or two adults. P14: the empty controller's hash equal; the lookahead no worse on both measures; decision
points within 1.5, 0.2 and 2.5 a day; at least five acts found reachable only through the played pawn or by no verb. P16: all three
invariants hold over 1,000 random authorings.

**Also say.** Whether the estimate's noise (±20%) matters to the alderman's placement, and at what noise it stops beating the
calendar; whether a claim in days is the right grain for village work or hours would serve small households better; what an
alderman, a head and a member would each need to see on the page to make these choices (one paragraph each); any decision point
the design did not list.

**Bound.** One observer run a seed (under 5 minutes); the models in seconds; the reachability script on one seeded state.
