# Roadmap: vertical slices, the late game and cheap measurement

Written on 3 November 2026, when Kim made `docs/architecture/target-v2.md` the project's architecture reference. Kim asked four
things: which vertical slices to build, in what order, how to keep the game fast (above all late in a run), and how to make
measuring that cheap. Kim also noted that target-v2 is mostly a framework, and that the concrete systems built on it still need
designing. Read at `fc5c2fc`. The numbers in section 5 were measured that day in this repository's container (4 cores, Node), with
`tools/sim.js` and a 40-year save. They are one run each, so treat them as accurate to about 10%.

Kim decided on 3 November, marked **Decided**: the slices and their order, about 1,000 living pawns on a medium map as the late
game's reference, `design.md` v0.4 as a skeleton the slices fill in, the budget, the work counters, and the ten rules (now in
`AGENTS.md`). The rest is **Proposed**. The slices are archs of `BACKLOG.md` (keys in section 7). No code changes.

## 1. In short

- **A slice is one thing the player can do or see,** built through every layer it needs. Target-v2's framework pieces arrive with
  their first consumer, not before. There are ten slices, plus slice 0, the yardstick that measures the others.
- **The order** (Decided, Kim, 3 Nov): 0, the yardstick; then 1, kin help booked as goodwill (the walking skeleton), beside 2, a life (the player inhabits a
  pawn); 3, the household's year (opportunities, plans, tasks); 4, the autumn fair; 5, debt and land; 6, the mill and the loom;
  7, talk travels; 8, the ship; 9, the town; 10, roads, boats and ice. The gossip experiment runs beside them from slice 0 on.
- **Why this order:** the riskiest framework bets go first: plans replacing posted jobs, and goodwill as a currency. After them comes
  the cities review's road (fair, credit, specialists, ships, town). Each slice is playable on its own.
- **Each slice is an arch.** Its plan task is the design pass that makes its systems concrete and writes them into `design.md` v0.4.
  Its wrap-up reports its probes and what it costs.
- **The late game is the cost of history,** not only of 1,000 people. Measured on populous small: from year 1 to year 41, people
  double (352 to 729) and a game day costs 3.3 times as much (68 to 227 ms). In year 41 the moving round takes 899 ms in one call,
  against about 20 ms in year 2. The year-40 save is 29 MB of JSON and takes 2.7 s to write. Ten rules for every system follow,
  in section 5.3.
- **Proposed budget at a late reference state:**
  - 160 ms per game day (30× at 10% of a core);
  - no step over 60 ms (medium-y60 temporarily 400 ms until VB-201);
  - the cost per living pawn flat in history (year 60 at most 1.25 times year 5);
  - a save under 0.5 s.
- **Measure work, not time.** Deterministic counters of work done, asserted in `npm test` at tiny scale, need no baseline machine and
  never flake. Scaling exponents come from two sizes, and history checks from an early and a late save. Late-game fixtures are loaded
  from saves: one year from the year-40 save took 11 s, against 4 minutes to get there. Wall-clock timing runs nightly, is reported
  with its history, and never fails.

## 2. What a slice is

The idea is the walking skeleton (Cockburn, *Crystal Clear*, 2004) or the tracer bullet (Hunt and Thomas, *The Pragmatic
Programmer*, 1999): a thin piece that runs end to end, then grows. Both citations are from memory. Here it means:

1. **A slice ends in something the player can do or see, and a probe that measures it.** Plumbing alone is not a slice. Slice 0 is
   the exception: it is the measuring rod.
2. **Framework arrives with its first consumer.** A target-v2 module is built only as far as the slice needs. Stores gains typed
   goods when the fair needs a cow and a sack; land gains `use` beside `own` when the first tenancy needs it. This is the rule of
   `AGENTS.md` on special cases, applied to the architecture: an abstraction earns its place.
3. **Behaviour-preserving first.** A slice starts with refactors that move today's behaviour behind the target's interfaces, with the
   golden file unchanged. Behaviour then changes in tasks that re-record it.
4. **A slice is an arch,** with the three phases of `BACKLOG.md`:
   - plan: a design pass on the concrete system, its numbers, what the player sees and its cost; it writes the `design.md` sections
     and the tasks;
   - implement;
   - wrap-up: probes and bands, and the cost against the budget.
5. **A slice names its cost before it is built:** entities, times cadence, times work per call; and the line it adds to the budget
   table (section 5.2). Its wrap-up measures that line.

## 3. The slices

| # | Slice | The player can | Framework it brings (target-v2 section) |
|---|---|---|---|
| 0 | The yardstick | (the team can measure every later slice at its own cost) | Work counters, fixtures, bands (6.2), the rules registry with `death.hazard` (4.1), indexes of the living |
| 1 | Kin help, booked | See who owes whom goodwill, and why help was given or refused | Stores with goods (4.3), goodwill and `allowance` (4.4), Exchange's gift (4.5), `explain` |
| 2 | A life | Inhabit a pawn, queue what it does, argue at the meeting, go on as kin after its death; save in the page | Opportunities for a pawn (4.5), the player's doors (4.7) but `Decisions.answer`, the actor view |
| 3 | The household's year | As holder, set the season's plan; as a member, follow it or not | Opportunities, plans, tasks, eligibility, planning days, the meeting's routines, attention (4.5) |
| 4 | The autumn fair | Barter at the fair, borrow, lend | Typed goods and custody (4.3), venues, occasions, reach on foot (4.2), swap and loan, norms (5.1–5.3), Obligations (4.4) |
| 5 | Debt and land | Press a debt, sit at the hearing, farm as a tenant | Land rights (4.3), Enforcement and Decisions (4.5), class with hysteresis (4.6), the bodies decision |
| 6 | The mill and the loom | Build a mill with the village, learn a craft, spin and weave | Facilities and construction (4.3), recipes with subtypes, skills, the textile chain (5.6), occupation |
| 7 | Talk travels | Hear what people say; carry a reputation; lie, and be found out | Traits (4.4), encounters at venues, stories (4.4, 10.2) |
| 8 | The ship | Sell butter for silver, take passage, meet a priest | The outside world, silver, institutions and rank (4.4, 4.5); disease (10.3) |
| 9 | The town | Move to town, take service there, buy food at the market | Settlement tier and regions (4.6), the urban sink (6.1) |
| 10 | Roads, boats and ice | Cross the frozen sound to the winter fair; build a road or a bridge | Modes, vehicles and climate (4.2), built ways and passage (4.3) |

Each slice below lists what it brings and what it takes over from today's backlog. It also says what must be designed concretely
first: that design pass is its plan task.

### 3.0 The yardstick

- **Brings:** work counters, scaling and history checks, late-game fixtures and a bench history (section 6). The reduced-scenario
  harness asserts bands in `npm run verify`; the full bands run nightly (target-v2 6.2, Kim's decision 9). It also brings the rules
  registry, with `death.hazard` as its first rule and behaviour unchanged, so `value()` is measured from the start; disease
  contributes to that rule later. Indexes of the living take the dead out of the hot loops (section 5.4).
- **Takes over:** VB-088 (rewritten around counters and fixtures), VB-163 (its floors become the harness's first asserted bands),
  VB-166 (frame times, unchanged), VB-097 (measured on the fixture), VB-173 (the owners check, with target-v2's "cache" category),
  VB-057 and VB-055 (tooling).
- **Design pass:** the late reference state and the budget (section 5.2).

### 3.1 Kin help, booked

The walking skeleton. It is the smallest slice that touches five layers, and today's behaviour barely changes.

- **Brings:**
  - kernel: the `allowance` rule;
  - material: `sim/stores` (VB-174, with a `good` argument);
  - social: a goodwill balance per pair of pawns, beside opinion (after VB-178); the household's agent is today's holder;
  - agency: Exchange with one mechanism, the gift, which `sim/help` becomes;
  - page: the pawn panel shows balances and `explain(allowance)`;
  - derived: a probe of the balances.
- **Takes over:** VB-174, VB-178; the questions on VB-039 and VB-106 (help as memories).
- **Design pass:**
  - goodwill's unit (customary rations) and its decay;
  - the culture's curve coupling goodwill to opinion, starting from what a gift does to the tie today;
  - the floor (seed and some days of food);
  - the contributions to `allowance`, with their ranges.
- **Done when:** help in hunger works as today; balances are booked and shown; the golden file changes for the booking only.

**8 November update (Kim, VB-182's plan; `QUESTION_ARCHIVE.md`, "VB-182").**
- **Decided in the design pass** (`design.md`, section 9, The gift): goodwill in customary rations, halving in 4 years, 32 counterparts
  a pawn; the floor at the seed reserve and 20 days of need; `allowance` as grain above the floor (`slack`), less the holder's own
  reserve (`reserve`, generosity's stand-in until slice 7), plus a `goodwill` term; the debtor's gratitude and the creditor's souring
  over an old debt. Goodwill is booked and shown only in this slice: its curves and its term in `allowance` act from the head of
  slice 4 (VB-220), so "done when" above stands. The two holders book; the village store books nothing; half passes at a handover.
- **The tasks.** VB-216 (the gift through Exchange and the verb `give`, the floor and `allowance`, golden unchanged), VB-217 (goodwill
  booked, golden re-recorded for it only), VB-218 (the panel), and the wrap-up VB-219 with its probe of the balances. Beside them:
  VB-220 in slice 4 (goodwill acts) and VB-221 in slice 2 (the player's gift, to any household, not bound by its pawn's allowance).
- **Budget line:** under 0.1 ms a game day at the late reference (about 500 gifts a year among 2,531 living at `medium-y60`, no pawn
  with more than 6 counterparts in a year), and under 50 KB more JSON in its save.

### 3.2 A life

The vision's core (Kim, 3 November). Every later slice should be tried through the player's pawn, and the four doors of target-v2
4.7 shape the interfaces built after it. That is cheap now and dear later.

- **Brings:**
  - the first step of the jobs rework: each `KINDS` record gains `available(st, holder)`, and the posting rules of `refreshJobs`
    move there, with the golden file unchanged;
  - `Opportunities.forPawn` ("what can I do here, for whom, on what basis");
  - the player as a command source (VB-169);
  - `Decisions.answer` over today's meeting (only the answer door);
  - the player's succession: on death, choose among kin, household and close ties;
  - ambitions read from the record;
  - the actor view, omniscient for now.
- **Takes over:** VB-177, VB-169, VB-077 (saves in the page), VB-079 (its design pass), and the parts of VB-099 (the chronicle) that
  ambitions need.
- **Design pass:**
  - the player-role text of `docs/review-architecture.md` section 3 (`QUESTIONS.md`, Priority 1, questions 1 to 5);
  - what the player sees of the pawn: needs, what it may do, the household's plan;
  - ambitions for the first version;
  - whether the player may go below the floor (target-v2 10.1).
- **Cost:** nothing per game day; opportunities for one pawn, on demand.

**8 November update (Kim, VB-079's plan; `QUESTION_ARCHIVE.md`, "VB-079").**
- **Changes to the list above.**
  - The player is a source with a queue: its commands go before the pawn's own logic, and the role's automatic behaviour is the
    fallback, with a switch to turn it off.
  - The meeting is reached through advocacy only, so `Decisions.answer` waits for the first question that needs the player's answer
    (a holder's plan, slice 3, or a testament, slice 5).
  - Ambitions are postponed to late in the design, and so are the parts of VB-099 they needed.
  - The round's acts take the player's wish where the round reads a pawn's own want, under the same rules.
  - Each save names its build.
- **The tasks.** VB-208 (each kind's `available`, golden unchanged), VB-209 (`Opportunities.forPawn` and the actor view), VB-169 (the
  player's queue), VB-210 (playing a pawn in the page), VB-211 (advocacy), VB-212 (the round's acts as the player's wishes), VB-213 (the
  player's succession), VB-214 (saves in the page), VB-215 (autosave at the round, once a save is under 0.5 s), and the wrap-up VB-078.
  Their order and costs are in `docs/review-life.md`.
- **Budget line:** 0 ms a game day of simulation, and, without a player, the state and counters unchanged. In the page,
  opportunities for one pawn under 1 ms a call.

### 3.3 The household's year

The riskiest change, because it rewires the core loop. It goes before the fair because every later slice stands on it: the fair is
an occasion (a plan), labour owed is the creditor's opportunity, and a mill is a project plan.

- **Brings:**
  - opportunities for every holder;
  - one standing plan per household that reproduces today's posting (golden unchanged);
  - tasks, the store that `st.jobs` becomes;
  - eligibility: members, servants, helpers by goodwill (the hired come in slice 5);
  - planning days, staggered and set by diligence;
  - seasonal and project plans;
  - the village's routines, set afresh by the meeting each year;
  - progress on resumable work kept by the field (VB-179);
  - attention: one partial and one background task;
  - fishing and gathering as opportunities: the lean year's answer in trace 7.2.
- **Takes over:** VB-179, VB-164 (its design pass), VB-023, VB-090, VB-106, VB-058, VB-120, VB-100, VB-123, VB-117, VB-118,
  VB-119, VB-136 (herding as background work), VB-162 (the holder's overview).
- **Design pass:**
  - how a holder chooses a plan: a seasonal template from the culture, adjusted by urgency and stores, not an optimiser;
  - each basis of eligibility;
  - the meeting's routine list, and what happens when it fails to decide (target-v2 10.1);
  - the idle-hour target (40 to 60% in the slack seasons);
  - what the plan panel shows.
- **Done when:** idle share by season, sowing and harvest on time, and hungry household-days are at or better than today, at four
  seeds; the holder's plan can be read and changed in the page.
- **Cost risk:** opportunities are "computed, never stored". Computing them for every holder every hour would be the largest new
  cost in the game. They should be computed on a holder's planning day and on a change to its rights or stores. They are cached
  per holder by one writer, with a test that the cache equals a fresh computation. Budget line: under 10 ms a game day at the
  early reference.

### 3.4 The autumn fair

The cities review's phase 1, and the loans of its phase 2.

- **Brings:**
  - the goods registry for the goods the fair trades: grain, butter, salt meat, cheese, cattle, sheep, wool, labour days;
  - quanta and custody;
  - a venue (the fair meadow, a minimal facility);
  - the fair as an occasion with a draw in hours, from `Movement.reachFrom` on foot, computed yearly per village;
  - swap and loan;
  - the two valuations: need decides, customary worth books;
  - `Culture.norm`, with fixed rates first;
  - Obligations as a module, now that it has its second kind (grain loans after the heirs' shares);
  - encounters at the venue, so villages mix.
- **Takes over:** VB-126 (occasions), VB-140 (livestock in shares), the probe of VB-130 (hoarding); the cities questions in
  `QUESTIONS.md`.
- **Design pass:**
  - goods and their quanta;
  - the worth table: a cow 40 rations, a sheep 6, a day's work 3, from the cities review;
  - each good's need curve;
  - who goes and with what;
  - how deals are found at the fair: agents in seeded order, each proposing to a few, so the cost is bounded;
  - loan terms;
  - what the player sees (booths, a fair report, a trade dialog).
- **Done when:** hungry household-days fall and spoilt grain falls; deals that failed for want of change are counted; marriages
  across villages are reported.

### 3.5 Debt and land

The alderman's road (target-v2 7.1), and the first test of whether bodies need a membership graph.

- **Brings:**
  - land rights with `own` and `use` split, `st.owner` as their cache, holdings that split, and tenancy with rent as an obligation;
  - Enforcement, with cases at the meeting;
  - Decisions as a module (procedures, sittings, escalation), absorbing the meeting;
  - class as a derived view with hysteresis (`landed`), acting through a priority contribution;
  - the membership graph, or not, decided by measurement (section 8).
- **Takes over:** VB-034 (splitting land is `LandRights.split`), VB-043 to VB-046 and VB-092 (scope and overlay, on membership
  edges), VB-175, VB-176, VB-180, VB-082 (ballots shown), VB-141 (grazing rights), VB-035.
- **Design pass:**
  - remedies and the custom "Debts are paid with";
  - tenancy terms (a quarter of the harvest and labour days);
  - interest;
  - procedures per culture;
  - class thresholds;
  - the office of alderman.
- **Done when:** the land Gini, the tenancy share and landed households per 1,000 are reported against a band, at four seeds.

### 3.6 The mill and the loom

- **Brings:**
  - facilities for buildings, with construction as recipes in stages;
  - production with subtype binding;
  - skills that grow by doing;
  - the textile chain: spinning as background work, weaving as partial work, cloth as a good that keeps;
  - tool wear;
  - quern against mill;
  - occupation as a derived view.
- **Takes over:** VB-009, VB-093, VB-121, VB-144 (wool), the steps of VB-123 not taken in slice 3; VB-048 (the food wrap-up) after it.
- **Design pass:**
  - recipes and their hours (acoup's textile figures were checked by search; others need sources);
  - skill curves;
  - who spins and weaves, as a practice;
  - what a mill costs and its toll.
- **Done when:** the idle share in the slack seasons is inside 40 to 60%; mills are built where they pay; "the smith" emerges by
  hours worked.

### 3.7 Talk travels

- **Brings:** VB-127 first (ties from talk), the largest saving available today; then twelve traits and chemistry from them;
  encounters at venues (the alehouse, the service); stories, lies and counter-stories, after the experiment.
- **Takes over:** VB-127, VB-062, VB-063, VB-036 and VB-040 (courting), the gossip experiment (target-v2 10.2), which may run any
  time from slice 0 on as a reduced scenario.
- **Design pass:**
  - trait distributions and heritability;
  - the two rules each trait changes;
  - venue rules;
  - story kinds and their numbers, from the experiment.
- **Done when:** the bands of target-v2 10.2 hold. Talk must cost less at the end of this slice than at its start.

### 3.8 The ship

- **Brings:**
  - the outside world as a scheduled actor;
  - a harbour (`moor`);
  - pawns abroad, at a coarse cadence;
  - silver by weight;
  - norms that learn from deals;
  - the Church and the Crown established by contact;
  - rank;
  - tithe and tax as obligations;
  - sickness brought by ships, the start of the disease gap (10.3).
- **Takes over:** the cities review's phases 3 and 5.
- **Design pass:**
  - voyages, goods and prices per decade;
  - immigrants;
  - the disease model: one compartment model per settlement, feeding a contribution to `death.hazard`, so the cost is per
    settlement, not per pair of pawns;
  - what establishment does.

### 3.9 The town

- **Brings:**
  - settlement tier and regions by Harris potential, with hysteresis;
  - burgage plots;
  - households that buy their food;
  - urban hazard and crowding;
  - the pull at the moving round.
- **Takes over:** the cities review's phase 4.
- **Done when:** the 600 / 325 / 75 band (target-v2 6.3) is reported nightly; a town's natural decrease and its migrants match
  `M / (d - b)`.

### 3.10 Roads, boats and ice

- **Brings:** modes and vehicles, climate by latitude, ice, built ways as facilities, passage rights, desire lines and upkeep.
- **Takes over:** VB-115 (bridges), VB-083 (seasons on the map), VB-097 (routes over regions, if the fixture shows they are needed).
- **Design pass:**
  - freeze and thaw dates by latitude, a few a winter, so the cost grid changes a few times a year and not daily;
  - capacities of cart, sledge and boat;
  - what a cart needs underfoot;
  - upkeep duty.

## 4. The order, and why

0, then 1 and 2 side by side, then 3, 4, 5, 6, 7, 8, 9 and 10 in turn. Slice 7 can move, and its experiment runs from slice 0 on.

1. **Slice 0 first.** It is cheap, everything later is measured by it, and the measurements change designs. The cache of slice 3's
   opportunities and the disease model of slice 8 are both shaped by cost.
2. **Slices 1 and 2 in parallel.** They touch different files: food and relations against commands, agents and the page. Between
   them they test the pieces every later slice uses: the registry, stores, goodwill and exchange; opportunities and the player.
3. **Slice 3 before the fair:** see 3.3. A fair built on posted jobs would be built twice.
4. **Fair, then debt and land, then the mill:** the cities review's order. Rights matter once there is debt (the first tenancy), and
   a mill on village land needs a `develop` grant.
5. **Slice 7 is the movable one.** It depends only on venues. If the budget binds sooner, VB-127 moves up into slice 0's
   neighbourhood.
6. **The ship before the town:** imports feed the first specialists, silver arrives with ships, and disease comes first by sea.
   Roads come last, since the winter fair (trace 7.3) needs everything else.

**Alternatives weighed.**
- *The fair first*, for the most new play soonest. It builds exchange on posted jobs, so its occasion and its loans' labour are
  built twice.
- *The player last*, to watch the world first. Against the adopted vision; the player's doors are cheapest to fit before the
  interfaces set.
- *Boats with the fair*, since an archipelago's fair should draw across water. This is reasonable if the fair islands of the
  reference seeds are too small; slice 4's plan should measure it.

**Beside the slices:** small tasks that touch nothing above may run at any time: VB-159, VB-160, VB-084 (speeds), VB-165, VB-091.
They run as long as they do not edit the files of the slice in progress.

**Size.** About 60 to 70 tasks of size S or M. At one task a night, that is two to three months, slices 0 to 4 being the first
month and a half.

## 5. The late game

### 5.1 What it costs today

Populous small at seed 7, `tools/sim.js` (year-by-year ms per game day, one run):

| Year | Living | Pawn records | ms a game day | ms per living pawn-day |
|---|---|---|---|---|
| 1 | 352 | about 355 | 68 | 0.19 |
| 10 | 424 | | 82 | 0.19 |
| 20 | 500 | | 132 | 0.26 |
| 30 | 610 | | 153 | 0.25 |
| 41 (from the year-40 save) | 729 | 1,274 | 227 | 0.31 |

Populous medium at seed 7, years 1 to 4, `--report perf`: 807 to 859 living, 184 to 196 ms a game day. That figure includes the
timing wrapper and a second run sharing the machine; `REVIEW.md` measured 97 ms on another machine. The early reference is
therefore already near a budget of 160.

Where a game day went in year 41, from the year-40 save (ms, with the share of the day):

| System | Years 1 to 8 (352 to 420 living) | Year 41 (729 living) | Growth, for 1.9 times the people |
|---|---|---|---|
| Agents and walking | 20.4 | 72.2 (32%) | 3.5× |
| Talk and contacts | 26.9 | 62.0 (27%) | 2.3× |
| Daily life and births | 9.3 | 36.8 (16%) | 4.0× |
| Jobs refresh and matching | 12.5 | 29.5 (13%) | 2.4× |
| The moving round (one call) | 72.7 longest | **899** | 12× |

The year-40 state:
- 0.76 dead records per living pawn (perhaps 4 to 5 by year 150, after 5 to 6 generations);
- 110,000 events in `st.record` (12 MB of the save), and pawn records of 14 MB, each with 80 events of its own;
- 29 MB of JSON, 5.2 MB gzipped;
- 2.7 s to save and 0.27 s to load.

An autosave in the page by the same codec would freeze it for nearly three seconds.

**Reading.** Cost grows faster than the number of people, and the systems that grow fastest are those that loop over history
or over pairs:
- the 6-minute step walks every agent ever made, dead included (`clock.js:118`);
- 17 loops in the modules walk every pawn record ever made, four of them in `dailyLife` each day;
- `dailyLife` decays every tie and resets every kin floor daily (`lifecycle.js:232-241`);
- talk counts pairs in crowds.

The moving round grew twelvefold, and it is the one that freezes. None of this shows in the early benchmark (`tests/perf.js`,
year 2), which is why late fixtures matter (section 6).

### 5.2 Budget (Decided, Kim, 3 Nov)

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

Each slice adds lines to a budget table by system, kept in `docs/bench/budget.md` with the bench (section 6). A slice's plan states
its line; its wrap-up measures it.

**6 November update (user decision):** the single-step gate increases from 50 to 60 ms. Other budgets and demographic tolerances are unchanged. The subsequent user decision temporarily allows 400 ms on medium-y60; VB-201 must restore its 60 ms gate, including the moving-round day and midnight. Small-y40 stays at 60 ms.

**7 November update (Kim):** the late reference becomes the first year populous medium reaches 1,000 living, year 14 at `6eaa6bc`, since the year-60 fixture holds 2,492. Balance work will move that year, and the fixture follows it (VB-202). The basis of 160 ms, 30× at 10% of a core, was an agent's proposal; Kim decided its replacement and three more lines (`QUESTION_ARCHIVE.md`, VB-203):
- mean: 400 ms a game day for the finished game, a quarter of the main thread at 30×; the systems built so far may use half of it, 200 ms, and each later slice's plan claims its line from the other half;
- steps: no 6-minute step over 60 ms on `medium-ref` and `small-y40`; the temporary medium-y60 allowance has ended;
- history: the cost per living pawn-day at `small-y40` at most 1.25 times `small-y5`, the pair VB-088 already checks with counters;
- save and load: 0.5 s each, at `medium-ref`;
- `medium-y60` is a stress state, reported nightly against twice these lines, never gating.

The table above keeps the lines of 3 and 6 November for the record. VB-203 measures the new ones on VB-202's fixtures and writes the closure table by system.

### 5.3 Ten rules for systems

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

### 5.4 Today's debts, as tasks for slice 0 and slice 7

- **Indexes of the living:** `st.living`, live households and live agents, kept by their owners. The step, `dailyLife` and the 17
  full loops then walk them. Behaviour is preserved if the order is kept, so the golden file is unchanged.
- **Lazy decay of ties and the kin floor:** part of VB-127, or before it.
- **The moving round spread over days in the late game,** measured on the fixture.
- **Bounded history:** pawn events as an index into `st.record`; a compaction rule for routine events. A small design question:
  what counts as notable (VB-098 asks the same).
- **The route cache bounded** (VB-097's first criterion).

### 5.5 Threads

The simulation runs on the page's main thread. A Web Worker would remove frame stalls, but the page reads `st` every frame, so
a worker would need a snapshot of positions per frame and requests for panels. **Proposed:** not now, but keep it possible. `st`
stays plain data, and the page's reads stay narrow (positions, animation, the selected panel). Revisit if VB-166 fails at 30× with
the simulation's share of frame time above a third. Autosave is the exception to weigh early: it could serialise in a worker
from a structured clone, if the late save cannot reach 0.5 s.

## 6. Cheap measurement

Timing is noisy, depends on the machine and needs long runs. Most of what matters can be measured more cheaply.

| Measure | What it catches | Cost | Where it runs |
|---|---|---|---|
| **Work counters:** nodes a route search expands, pairs talk considers, records a loop walks, opportunities computed, rule values read, deals assessed, stories picked | A loop that does more work than it should | Nil. Deterministic, so asserted with tight bands at tiny scale and never flaky | `npm test` |
| **Scaling exponent:** the same scenario at two sizes (tiny and small, or populous at one and two times the density) | Work per day growing faster than the people (exponent over 1.15) | Two tiny runs, seconds | `npm test` |
| **History check:** work per living pawn at year 5 and at the late fixture | Loops over history (rule 1) | One fixture year from counters | `npm run verify` |
| **Late fixtures:** saves at year 40 (small) and year 60 (medium), made by the nightly long runs and regenerated when the save format or the golden file changes | Late-only costs such as the moving round's 899 ms | 11 s for a year on small, against 4 minutes to get there | verify (small), nightly (medium) |
| **Bench history:** ms a game day per calendar step, worst step, heap, save time and size, per commit, appended to `docs/bench/history.jsonl` | Drift over many commits | One nightly run | Nightly; reported, never failing; a jump of 20% over the median of the last five is flagged |
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

## 7. `design.md` v0.4, and the backlog

**`design.md`.** v0.3 says each version is its own document, left unchanged once a newer one exists.
- **Decided (Kim, 3 Nov):** keep v0.3 as `docs/design-v0.3.md`, unchanged. `design.md` becomes v0.4, written in two kinds of pass.
- **The skeleton pass (one task, VB-191; done 3 November):**
  - the vision and the scale of society, from `docs/review-architecture.md` section 3, once Kim approves it;
  - the new section list;
  - every v0.3 point carried over with its status;
  - each point target-v2 11.1 changes marked "Under revision (slice N)", so implementing tasks stop building against it;
  - implementation detail moved out to target-v2.
- **Then each slice's plan task** writes its own sections, as the concrete design of that slice.

Proposed sections of v0.4, ordered as the player meets the world:
1. Vision and scope
2. World, climate and travel
3. Time
4. People: persons, traits, skills, health
5. Households and other bodies
6. Land and rights
7. Work: opportunities, plans, tasks
8. Goods, production and facilities
9. Exchange, goodwill and obligations
10. Customs and culture
11. Settlements, towns and regions
12. Institutions and the world beyond
13. Balance loops and targets
14. The player and what they see
15. Open questions
16. Change log

**The backlog** (done 3 November). Each slice is an arch: `yardstick`, `kin-help`, `life`, `year`, `fair`, `debt`, `mill`, `talk`,
`ship`, `town`, `roads`. Its plan task is VB-181, VB-182, VB-079, VB-164, VB-183 to VB-186, VB-188 to VB-190 in turn; the gossip
experiment is VB-187 and the skeleton of `design.md` v0.4 is VB-191. The tasks of the earlier archs moved to the slices as section 3
lists. Those of slices 3 to 10 are `blocked` until their slice's plan confirms, rewrites or closes them, so Kim need not answer their
old questions now. Two earlier archs stay open beside the slices:
- `ownership`: VB-173 to VB-180 run in their order (target-v2, section 11.2, found that they fit it unchanged); VB-174 and VB-178 go
  first, since slice 1 builds on them;
- `animals`: VB-159, VB-160, VB-139, VB-091, and the wrap-up VB-048 after slice 6.

VB-127 (ties from talk) stays `ready` ahead of its slice, since the budget already binds (section 5.1).

## 8. Questions for Kim

Raised in `QUESTIONS.md`, Priority 1, with these proposals.

1. **The slices and their order** (sections 3 and 4). **P:** as proposed, with slices 1 and 2 in parallel. **Decided (Kim, 3 Nov):** P.
2. **The late game's size.** `design.md` says "up to about 1,000 pawns simulated in full" (Decided). Populous medium starts at 807
   and grows about 2% a year (small grew 1.8% a year over 40 years), so it passes 1,000 by about year 12 unless a loop holds it.
   Is 1,000 living the target for medium, or a band for the late game, with large maps allowed more? **P:** about 1,000 living on
   medium is the budget's reference; large may reach 2,000 at half the speed. **Decided (Kim, 3 Nov):** P.
3. **The budget** (section 5.2). **P:** as proposed: 160 ms a game day at the late reference, steps under 50 ms, cost per living pawn
   flat in history, save under 0.5 s. **Decided (Kim, 3 Nov):** P.
4. **`design.md` v0.4** (section 7). **P:** keep v0.3 as `docs/design-v0.3.md`; a skeleton pass now; each slice's plan writes its
   own sections. **Decided (Kim, 3 Nov):** P.
5. **Counters in `VB.count`** (section 6). **P:** yes, with one lint allowance; counters never feed the simulation. **Decided (Kim, 3 Nov):** P.
6. **The ten rules** (section 5.3) into `AGENTS.md`'s working rules. **P:** yes, once Kim agrees with them. **Decided (Kim, 3 Nov):** P.

All six were answered on 3 November (`QUESTION_ARCHIVE.md`).
