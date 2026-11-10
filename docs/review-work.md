# Slice 3's plan: the household's year (VB-164, 10 November 2026)

A design pass; no code. It answers the acceptance criteria of VB-164: a survey of the code, the questions for Kim (in `QUESTIONS.md`, "VB-164:
the household's year"), proposed text for `design.md` section 7, the cost stated before building, and the implement tasks, written down as a
draft to be filed once Kim has answered. Sources: `docs/architecture/target-v2.md` sections 4.5, 5.6 and 7.2 and Kim's decisions 11, 12, 13 and
15; `docs/roadmap.md` section 3.3; `docs/review-architecture.md` section 2, point 3; `docs/architecture/stress-tests.md` Test C; `docs/review-life.md`
(slice 2).

Where the code stands: slice 2's VB-208 is done. Each `KINDS` record has `available(st, holder, at, c, post, f)` (`src/sim/kinds.js`), `refreshJobs`
(`src/sim/jobs.js:40`) asks the rules in the order of `ASK` (kinds.js, end), and `Opportunities.forPawn` (`src/sim/opportunities.js`) calls the same
rules for one pawn with `post` replaced by a recorder. So the first half of the target's "opportunities" exists for jobs. What is missing is
everything that is not a job: the choices made around the postings (below), a holder, a plan, a cache and a task that is not a posting.

## 1. Survey: what moves into `available`, and what acts as a hidden plan today

`available` is a function of state at a moment: "could this be done now, for this party". A *plan* is a commitment over time, a target, or a choice
among several things that could be done. Each row names its place in the code and where it goes.

### 1.1 Already availability (moved by VB-208; slice 3 only calls them from a plan)

| Rule | Where | Becomes |
|---|---|---|
| plow, sow, weed, reap, haul, reclaim, by field stage | `KINDS.*.available`, `ASK.field`/`fieldAt` (kinds.js) | Stay. Called by the standing plan; the field's stage is the field's state (VB-179) |
| manure, meadow work (rake, mow, hay), byre work (fodder, slaughter, salt, milk) | `ASK.farm`; `meadowWork`, `byreWork`; `byreJobs` (byre.js:213), `meadowJobs` (meadows.js:98) | Stay. `byreJobs` also reads the cull list, which a plan makes (1.2) |
| wood, thresh, water, cook, mend | `ASK.farmAfterPlans`; `mend` also `ASK.village` | Stay; their windows (water from 5:00, cook from 14:00, milk from 6:00) become declared windows (3.3) |
| a plot's steps, a claimed farm's restoration | `plotWork` (expansion.js:102), `claimWork` (farmclaims.js:131), asked once for the island | Stay as availability, but their holders are a village's and a claimant's project plans (1.3) |
| the cottage's stages for settlers | `boothWork`, `boothJob` (expansion.js) | Stay; a project plan's steps (1.3) |

### 1.2 Hidden plans: a choice or a target, not an availability

| Hidden plan | Where | What it does today | In the target |
|---|---|---|---|
| The fields a household wants | `fieldsWanted`, `fieldsWorkable` (fields.js:21-27); `startProject`, `chooseTile` (fields.js); called from `refreshJobs`, once a day at `WORK[0]`, jobs.js:55 | Chooses a tile and stakes it when the household has fewer fields than it can feed and till; the project then posts clear and break | A seasonal plan, "a new field"; the tile is a choice (the player's as head, Q7) |
| The hay meadow wanted | `wantsMeadow`, `startMeadow`, `chooseMeadow` (meadows.js:42-51, 31); same call site | The same, for hay once the fields are enough | The same plan kind, `meadow` |
| Hay wanted | `hayWanted` (meadows.js:92), `ENOUGH` = 2 winters | Rake and mow only while the barn and the mown hay hold under 2 winters' need | A standing target of the plan: "hay for two winters" |
| Firewood laid in from summer | `woodGoal` (kinds.js:31): `woodWinter` in summer and autumn, else `woodTarget`; `wood.available`, kinds.js | The woodpile is topped up higher from summer | A standing target by season, from the template (Q1) |
| Seed kept back | `seedReserve` (hunger.js:8), read by `cookWanted`, `floorOf`, `help.js`, `farmclaims.js:172`, lifecycle.js:183 | Grain for the unsown fields and the project is never eaten, never given | A reservation by the plan (Q8): its materials are held for it and not spent twice |
| Cook each afternoon | `cookWanted` (kinds.js:51); `callCooks` (jobs.js:26) | Posts from 14:00 while short of cooked food; calls the best cook off other work | A standing routine with a deadline; the call-off is the urgency switch, not a rule of its own |
| The cull | `emergency`, `autumnCount` (byre.js:101, 164) fill `herd.cull`, which `byreJobs` turns into slaughter | The household decides at the autumn count which animals go | A seasonal plan, "winter the herd"; availability is the entry in the list |
| Sowing first | The rule "no plow job while another field is hoed and its seed is in the house" (VB-023, `QUESTIONS.md`) is not in `plow.available` | The question's text says it is built; the code posts every stubble field in the window, and role priority orders the hands | An order within the seasonal plan: hoe one, sow it, hoe the next (task priority). A check for the task (Q9) |
| The means to marry | `affords` (lifecycle.js:175-185), `MARRIAGE.means` | Marriage waits until the home holds food for 1.5 years above the seed; households do not plan toward it | Stays a gate at the moving round (it is a precondition of a decision, not work); a plan may set aside later (not slice 3) |
| Landless adults into service | `takeServants`, `unfit`, `handsLeft` (service.js:86, 75, 82) | The moving round sends a free adult to a lone holder's household | The lone holder's "labour wanted" opportunity, and the `servant` basis of eligibility (Q2); VB-090 |
| A plot, a restoration | `plotJobs`, `claimJobs` | Steps open when the previous finishes; the village owns the plot, the claimant the farm | Project plans of the village and of the claimant (1.3) |
| Idle strolls | `idleAbout` (jobs.js, `VB.count.idleStroll`) | An idle pawn walks to a friend, the green or the yard | Free time, not planned; stays (the idle hours, Q6) |

### 1.3 What the plan adds that nothing does today

- A holder. Jobs have an `owner` (`{type, id}`) but no one who decides; `refreshJobs` runs over every occupied farm and village every hour of the
  day (hours 5 to 18). A holder is the household's head (its `holder` pawn) or the village's meeting.
- A project with steps. A land project is `f.project = {tile, stage, hours}` (fields.js, meadows.js), a plot is `village.plots[]`, a restoration is
  `f.claim`: three shapes of one thing, "a plan with steps, each opening when the one before is done". Test C (a barn) needs the fourth and the
  reservation of timber across plans.
- Reconsideration. Nothing revisits a choice: a field wanted at the start of work is staked, and `contest` (stakes.js) is the only undoing.
  The plan is reviewed on its planning day and when a window starts to close (3.3).
- The village's routines. The only village work today is the fence stretches (`ASK.village`) and plots. The meeting sets nothing about work.

### 1.4 What stays as built

The matcher (`score`, `bid`, `planRound`, `lookUp` in jobs.js: best fit first, the two-hour rule, the urgency switch, several hands), the four
planner sites and the player's queue (`unplanned`, commands.js:212), job ids as posting order, `Opportunities.forPawn`. Slice 3 changes what
the matcher reads, not how it matches.

## 2. The design

**Four pieces, in the order they are built.**

1. *Opportunity*: `available`, as built. New: a `window` for the time-bound kinds, so they can be scheduled instead of polled (Rule 4).
2. *Plan*: a record per holder in `st.plans`, plain data, written only by `sim/plans`. A holder has one *standing plan* (the routines of its
   kind's rules and its culture) and any number of *seasonal and project plans*. A plan has a `template`, targets (woodpile, hay, seed, fields
   wanted), its steps, and `nextReview`. Reviewing a plan asks the opportunities of its holder and turns those it wants into tasks.
3. *Task*: what `st.jobs` is today, with a `from` (plan and step, standing routine, or the pawn itself) and the same ids and keys. The first
   step keeps the name `st.jobs` and the posting order, so the golden file holds; the rename comes last.
4. *Eligibility*: `eligible(st, task, pawn)` returns a basis (`member`, `servant`, `villager`, `helper`, `debtor`, `hired`, `self`) or null.
   It replaces `mayTake` (jobs.js:80). `Opportunities.forPawn` already reports a basis for each opportunity (`member`, `servant`, `villager`,
   `self`); the others arrive with their slices.

**How a holder chooses (Q1).** Not an optimiser. A *template* is the year of a holder's kind in its culture: a table of season by routine, with
a target for each store (the woodpile by season, hay in winters, seed, fields per hand). A review reads the stores and the calendar, and
*urgency* raises or lowers what a target asks for: low wood in autumn raises the wood routine's priority above the field routine's. The
choice is among the plan's routines and steps, never over all possible acts. This is what the code does today with fixed numbers
(`woodGoal`, `ENOUGH`, `fieldsWanted`); the plan puts them in one place where a culture or a player can change them.

**Planning days (Q3).** A review runs on its holder's day: daily for a diligent holder, every second or third day for a slack one, offset by
the holder's id so the work spreads (Rule 5). A review also fires for a holder when a window is about to close and when a store crosses a
target (the change that matters: grain below the cooking need, the woodpile under its goal, hay sold or lost). Between reviews the tasks stand.
The time-of-day kinds do not wait for the next planning day: their windows are in the plan (the cook's from 14:00, water from 5:00) and a
due-queue in `st` opens each when its hour comes (Rule 4). A member without a task may act on the household's opportunities, the plan's
tasks first (Decided 13): `Opportunities.forPawn` already lists them.

**The village (Q4).** The meeting, once a year, sets the village's routines afresh (Decided 12): a short list from the village's work available
(fence stretches, a common field, a green and well, work days). Each routine is a task source for the village's pawns. When the meeting does
not decide, the practice says what follows; proposed "nothing", which keeps Decided 12.

**Eligibility (Q2)**, one basis each: `member` (the household's, servants included under `servant`); `villager` (the village's tasks);
`helper` (another household's adult in the same village with no work of their own and a task that has waited 2 hours; a gift, VB-106, built on
slice 1's gift); `debtor` (labour owed, from slice 5; the hours go against the obligation); `hired` (slice 5; a wage); `self` (a pawn's own act,
outside any plan). Only `member`, `servant`, `villager`, `helper` and `self` are built in slice 3.

**Attention (Q5).** A task is `full` (the default), `partial` (it can be left and returned to within the hour, spinning, minding the herd) or
`background` (done at the side, at a reduced rate). A pawn holds one partial and one background at once. In slice 3 only herding is
background (VB-136); spinning and weaving come with slice 6.

**The player as head (Q7).** The plan's choices are the rows the player may take over: the tile of the next field or meadow; the year's targets
(more hay, fewer fields); the order of the season's work. The rules that bind any holder (claims, the farm's block, reach, the stores) stay
checks of the command, not of the holder, so the player's choice and the holder's rule go through the same check. Where the player makes
no choice, the holder's rule runs, as now. A player in a pawn that is not a holder acts on opportunities (slice 2) and cannot change the
plan; asking the holder to change it is a later verb.

**Interruption and reservations (Q8).** A plan reserves what it will spend (timber for a barn, seed for the fields) in the household's store
as a *reservation*: a count the store keeps against a plan, so that two plans cannot both spend it, and the household's free stock is the rest.
`seedReserve` is the first reservation, moved out of `hunger` into the plan. When a store or a right changes so that a step is no longer
possible (the timber is lost, the land is contested away), the plan is reviewed at once and the step reopens or the plan is dropped, with the
reservation released.

## 3. Proposed text for `design.md` v0.4, section 7 (replaces "Jobs, owners and roles"; for Kim's approval)

> ## 7. Work: opportunities, plans and tasks
>
> Work is available, not posted. What could be done is computed from rights and stores (an *opportunity*); a *plan* turns some of it into
> *tasks*; those *eligible* take them. The matcher is unchanged: best fit first, a poor fit only after two hours, an urgent job pulling a
> pawn off a lesser one, several hands on field work.
>
> | Aspect | Design | Status |
> | --- | --- | --- |
> | Opportunities | Computed from rights and stores, never stored as a list a rule must keep true; each kind says where it could be done (`available`) and in what window. Cached per holder, rebuilt on its planning day and when its rights or stores change | Decided, 3 Nov (computed); Proposed (the cache) |
> | Holders and plans | A household's holder keeps a standing plan (routines from the kind's rules and the household's culture) and seasonal and project plans (a new field, a meadow, a barn). A plan makes tasks when its next step is open | Decided, 3 Nov; Proposed (the record) |
> | How a holder chooses | A template of the culture's year, adjusted by urgency and by the stores; never an optimiser. The choice is among the plan's routines and steps | Proposed |
> | Planning days | Each holder reviews its plan on its own day, daily when diligent, every few days when not, staggered; also when a window is closing or a store crosses a target | Decided, 3 Nov (staggered); Proposed (the cadence) |
> | Acting without the plan | Any member may act on the household's opportunities, preferring the plan's tasks | Decided, 3 Nov |
> | Village routines | The yearly meeting sets them afresh from the village work available; a meeting that does not decide sets nothing (a practice may say "as last year") | Decided, 3 Nov (afresh); Proposed (failure) |
> | Who may take a task | Members and servants; villagers for the village's; helpers by goodwill (a gift); later debtors owing labour (hours against the debt) and the hired (a wage). The basis decides what the work books | Decided (members, helpers); Proposed (the bases) |
> | Attention | A pawn holds one partial and one background task at once; herding is the first background work | Decided, 3 Nov; Proposed (the kinds) |
> | Reservations | A plan reserves what it will spend, so two plans do not spend the same timber or seed; a plan whose step becomes impossible is reviewed at once | Proposed |
> | Matching, several hands, more urgent work, multi-step tasks, role priorities and types of work, commons, help between households, village work days, winter crafts | As in v0.3 (the rows of Jobs, owners and roles keep their text and statuses, with "job" read as "task") | Decided / Agreed, as before |
> | How busy | Busy at sowing and harvest (75 to 90% of adults' work hours), 40 to 60% idle in the slack seasons; spare time goes to talk, and to spinning and weaving once they exist (slice 6) | Decided, 30 Oct; the target is the wrap-up's probe |
> | The player as head | The player may make the plan's choices (a field's or meadow's tile, the year's targets, the order of the season's work) under the rules that bind any holder; with no choice made the holder's rule runs | Decided (principle), 9 Nov; Proposed (the list) |
> | The plan panel | The holder's plan can be read and changed in the page: routines and targets, the next steps, what is reserved, who has which task | Proposed |
> | Player steering | Merged into "The player as head" | Decided, 30 Oct |

## 4. Cost, before building (roadmap section 3.3: under 10 ms a game day at the early reference)

Named as Rule 9 asks: entities times cadence times work per call.

- *Today.* `refreshJobs` runs 14 times a game day over every occupied farm and village: about 25 `available` calls per household (an estimate: the field rules
  for each field's stage, the 3 + 7 farm rules, 1 per village, 2 island), so households x 25 x 14 calls a day. Together with matching it is 10.2 ms a game
  day at populous small, seed 7, 2 years (352 living; `--report perf`, "jobs refresh and matching", 21% of the day's 47.9 ms), and 33.5 ms at
  medium-y5 (`docs/review-life.md`). The split between refresh and matching is not measured yet: the first task adds a counter (`oppAsk`,
  calls of an `available` rule) so that it is.
- *The plan, per holder.* A review: the same 25 calls, once on the planning day, so households x 25 x (1 / cadence) a day: 14 times fewer at
  a daily cadence, 28 to 42 times fewer at one in two or three days. Windowed kinds (water, cook, milk, fodder, thresh): one due-queue entry
  each, popped at its hour: households x 5 a day. A change-triggered review (a store crossing a target): at most one per holder per day,
  by a dirty flag that the store's operations set (`sim/stores`, the one route for food) and the plan reads, so no new coupling reaches
  from stores to plans except one flag.
- *The cache.* Per holder, bounded by the number of its fields, meadows, herds and open steps (a handful, at most 20); rebuilt on a review.
  One writer (`sim/plans`); a test checks that the cache equals a fresh computation at every review of a seeded run.
- *The village.* One review a year at the meeting, one per work day.
- *The matcher* is unchanged: it reads the same tasks.
- *Budget line:* the plan's share of "jobs refresh and matching" at most 10 ms a game day at medium-y5, and no more than today's refresh share;
  to be measured at `small-y40` and `medium-ref` too (late-game: holders grow with households, not with history; no loop walks the record).
- *Risk.* A cadence of 1 in 2 or 3 days delays tasks that appear between reviews (a ripe field, the haul after the stooks have dried). Those
  fall due at a known time, so they too go in the due-queue (`window.start`); only the choices a review makes wait for its day. The wrap-up
  measures sowing and harvest on time to confirm.

## 5. Tasks, in order (drafts; filed once Kim has answered; `blocked` on the one before)

Behaviour-preserving first. Numbers are assigned when filed.

1. **Plans and the cache, golden unchanged.** `sim/plans` (new, owner of `st.plans`), one standing plan per household and per village;
   `refreshJobs` becomes the plan's review, run every hour for every holder as today; `st.jobs` keeps its name, keys and posting order.
   Counters `oppAsk` and `planReview` in `VB.COUNTERS`. `@sys`/`@state` lines, invariants for `st.plans`, ownership entry. Golden and
   counters unchanged except the two new. Size M.
2. **The hidden plans made explicit, golden unchanged.** Targets (`woodGoal`, `ENOUGH`, `fieldsWanted`, the cull) read from the plan
   record; `startProject` and `startMeadow` become the plan's land step, with the seam for the player's choice of tile; `seedReserve`
   becomes the plan's first reservation. Size M.
3. **Windows and the due-queue, then planning days.** Declared windows for water, cook, milk, fodder, thresh, haul; reviews daily by
   diligence, staggered; a dirty flag from `sim/stores`. Behaviour changes: golden re-recorded; idle share, sowing and harvest on time and
   hungry household-days reported before and after at four seeds. Size M.
4. **Tasks and eligibility.** `Eligibility.eligible`, replacing `mayTake`; the basis in `Opportunities.forPawn` taken from it; help by goodwill
   as the `helper` basis (VB-106, over slice 1's gift); servants and `takeServants` (VB-090) as the lone holder's labour wanted. Size M.
5. **Attention.** Partial and background tasks; herding as background work (VB-136). Size M.
6. **Seasonal and project plans, and the player as head.** The plan kinds (new field, meadow, barn), reservations, reconsideration;
   Test C's barn as the acceptance scenario (timber reserved, field work and needs go on, interrupted and reconsidered); the player's choices
   (tile, targets, order). Sowing first (VB-023) as the order within the seasonal plan. Size L, to split by the plan kinds when filed.
7. **The plan panel in the page** and the village overview (VB-162): the holder's plan readable and changeable. Under `src/page/`: a
   screenshot, `npm run verify`. Size M.
8. **The village's routines.** The meeting's list and its failure; the fence, work days (VB-120), common fields (VB-100), the green and well
   (VB-058) as the first routines. Size M each, three tasks.
9. **Fishing, gathering and mixed meals** (VB-117, VB-118, VB-119) as opportunities of the household: the lean year's answer (trace 7.2).
10. **The wrap-up (VB-108, rewritten):** probes at four seeds (3, 7, 11, 42, populous small): idle share by season, sowing and harvest on time,
    hungry household-days; the holder's plan read and changed in the page.

### The tasks taken over

| Task | Proposal |
|---|---|
| VB-023 sow before hoeing the next | Rewrite: the order within the seasonal plan (6); its open question (`QUESTIONS.md`) is folded into Q9 |
| VB-058 green and well built by the village | Rewrite as a village routine (8) |
| VB-090 landless adults take service | Rewrite: `servant` basis and the lone holder's labour wanted (4) |
| VB-100 common fields | Rewrite as a village routine (8) |
| VB-106 neighbours help | Rewrite as the `helper` basis (4), over slice 1's gift |
| VB-117, VB-118, VB-119 fishing, gathering, mixed meals | Keep, rewrite as household opportunities (9); their questions stay with the tasks |
| VB-120 village work days | Rewrite as a village routine (8) |
| VB-123 a job as steps | Rewrite: a project plan's steps are the shape; the three job shapes become step lists, with the first building task |
| VB-136 herding | Rewrite: background work (5) |
| VB-162 village overview | Rewrite with the plan panel (7) |
| VB-179 | Done (the crop's life only through `sim/fields`); the field keeps resumable progress |
| VB-108 the wrap-up | Rewrite (10) |

## 6. Measured before (10 November 2026; fixtures not needed: populous small, 3 years from the start)

Farmers' idle share of work hours (spring / summer / autumn / winter, %), `node tools/sim.js --scenario populous --map small --years 3 --report idle`:

| Seed | Spring | Summer | Autumn | Winter |
|---|---|---|---|---|
| 3 | 48.1 | 45.3 | 62.1 | 71.2 |
| 7 | 45.7 | 42.7 | 61.1 | 68.9 |
| 11 | 45.5 | 39.7 | 59.8 | 66.7 |
| 42 | 46.3 | 42.7 | 65.2 | 76.3 |

The target is 40 to 60% in the slack seasons; today's winter is above it (the missing sink is textiles, target-v2 section 5.6, slice 6), so the
wrap-up's probe is "not worse than today", and the target is reported. Cost: 10.2 ms a game day for "jobs refresh and matching" at seed 7
(above). Sowing and harvest on time and hungry household-days are measured by the first behaviour-changing task (3) before it changes
anything, since the sim report for them is `--report hunger` and the field stages; the wrap-up's probes list them.

## 7. Rejected

- *An optimiser or utility search over all acts for the holder:* contrary to Kim's decision to use a seasonal template; costly; hard to read.
- *A plan per pawn:* the holder plans for the household; a member acts on opportunities without a plan (Decided 13).
- *Opportunities stored as a list that every rule must keep true:* the very thing the move away from posting avoids; the cache is derived,
  rebuilt, and tested against a fresh computation.
- *Moving the means to marry into the plan:* it gates a decision at the moving round; it is not work.
