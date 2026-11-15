# Review: the job system, and whether to rethink it

15 November 2026. A review of how work is chosen and done in the game today (`src/sim/plans.js`, `kinds.js`, `jobs.js`, `agents.js`), set
against `design.md` section 7, against how other games and the literature allot work, and against the rules for cost. It answers one
question: would a rethink give better play, a cheaper simulation or cleaner code. Kim's answers of 15 November are in section 8; they
start option B and keep option C in scope.

Measurements are from `populous` on the small map, seed 7, at `4888394`. A source marked **[read]** was opened and read for this
review; **[snippet]** was seen only in search results; **[memory]** is the reviewer's own recollection, checked against nothing, and
is given because Kim asked for it. Nothing marked [memory] carries a conclusion alone.

## 1. In short

The matcher is not the problem. Its arithmetic is about 3.5% of simulation time and, by the literature, good enough. The three things
worth rethinking lie around it:

1. **Who decides.** The head keeps targets, an order and a project, but who does what each hour is settled by an auction with noise
   that no player can see or steer. Every source read names the same failure for this family of games: not poor matching, but that the
   player cannot see why work was or was not done.
2. **How work is executed.** Every awake pawn is stepped each 6 minutes through walking, working and carrying. That stepping is about
   20% of simulation time, the largest single part, and it polls what could be scheduled (rules for cost, 3 and 4).
3. **How a kind is declared.** A kind's record has grown some 25 optional hooks, and the matcher four special cases of priority and
   one of timing. Most of them exist to bend an hourly auction into something a head would simply have said in the morning.

The proposal is three steps of increasing reach: A, two fixes with no design change; B, the head's day; C, work as scheduled blocks.

## 2. How it works today

| Layer | Module | What it does | Cadence |
| --- | --- | --- | --- |
| Plans | `sim/plans`, `sim/projects` | Each household's head holds targets by store and season, a seasonal template and one project; each village the routines its meeting chose | A review on the holder's planning day, and when a window closes or a store crosses a target |
| Availability | `sim/kinds` (`available`, `ASK`) | Each of 38 kinds says where it could be done now for a holder: at each field by stage, at the farm, at the village, once for the island | At each review; time-bound kinds (water, cooking, milking, the haul) from a due-queue |
| The board | `sim/jobs` (`post`, `refreshJobs`) | What is reported is posted under a string key; a review marks the holder's jobs, re-asks, and sweeps those no longer reported | With availability |
| The matcher | `sim/jobs` (`planRound`, `helpRound`, `lookUp`, `callCooks`, `lookForWork`) | Each idle pawn bids for each open job of its household and village: role priority × urgency − distance, plus noise, times 0.8 for each hand already there; best bid first. A poor fit waits two hours. A pawn with no bid helps a neighbour. Each hour a working pawn leaves for a job 1.5 times as urgent plus 1. From 14:00 the best cook is called off | Every step for the idle; hourly for the switch and the cook |
| Execution | `sim/agents` (`stepAgents`, `stepWork`, `moveAgent`) | Walk to the site, work row by row, carry the load home; progress is the job's | Every 6-minute step, each awake pawn |

## 3. Measured

`node tools/sim.js --scenario populous --seed 7 --map small --years 3 --report perf`: 96.6 ms a game day at 348 to 374 living.

| System (the report's lines) | ms a day | Share |
| --- | --- | --- |
| Jobs refresh and matching | 40.4 | 41.8% |
| Agents: walking and working | 24.1 | 25.0% |
| Talk and contacts | 11.3 | 11.7% |
| Agents: idle strolls | 6.6 | 6.9% |
| Everything else | 14.2 | 14.6% |

`docs/review-work.md` recorded 10.2 ms a day for the first line on 10 November, same scenario and seed: it has grown about fourfold in
five days, as kinds and plans were added. (Another machine, so the ratio is indicative only.)

A CPU profile of the first two years (inclusive shares of the whole run, world generation included) says where it goes:

| Part | Share | Note |
| --- | --- | --- |
| `stepAgents` | 19.7% | `stepWork` 9.4%, `moveAgent` 4.3%, the loop itself 5.1% |
| `planRound` | 13.2% | of which `issue` → `start` → `walkTo` → `findRoute` about 10%; `bid` and `score` 3.5% |
| `refreshJobs` | 11.1% | `available` 8.0%, of which the search for a fishing ground (`sim/fish` `ground`) 4.8% |
| `idleAbout` | 5.4% | a route for each stroll |
| `lookUp` | 4.0% | every working pawn, every hour |
| `lookForWork` | 3.6% | |

Work counters (`tests/counters.js`), per pawn-day: 98 agent steps, 18.4 availability asks, 14.9 bids, 8.8 looks up, 4.8 help offers, 3.3
idle strolls.

Two readings. The bids are few and cheap, so a cleverer or coarser matcher saves little by itself. And the cost sits in what the
auction causes: a pawn that finishes or idles re-enters the round, takes a job, and pays for a route; a pawn at work is stepped ten
times an hour to add a tenth of an hour to a number.

The hours report (`--report hours --from 3`) shows what the hands do: a household of three fields spends 9% of its hands' working
hours cooking, 9% fishing, 7% each on racking fish, threshing and wood, 5% on water, and under 5% on each field kind. Farmers are idle
40 to 76% of working hours by season (`docs/review-work.md`, section 6). Most of a pawn-day is short household tasks and waiting, not
the field work the matcher's rules (several hands, the join factor) were written for.

## 4. Findings

### 4.1 Play

- **The player's levers stop above the auction.** As head the player sets a target, a tile, the order of the season's work and the
  project (`design.md` section 7, The player as head). Below that, the bid decides, with noise 0.3 against priorities of 1 to 10. The
  player cannot say "Lars goes for wood today", and cannot read why he did not.
- **`explainIdle` is the tell.** A function that lists every bid a pawn would make, with a reason for each refusal, exists because
  the outcome cannot be read from the world. It is good engineering for a system that is hard to see into.
- **Help is a fallback of the matcher, not an act.** A pawn with no bid of its own bids at half weight on a neighbour's job that has
  waited two hours. Nobody asks and nobody answers, though principle 1 (hunger presses, the feast binds) makes help the hinge of the
  goodwill economy.
- **The idle are expensive and say nothing.** An idle pawn strolls three times a day at 7% of simulation time. With no limit set on
  idle hours (Kim, 10 November), most of the pawn-day is this.

### 4.2 Cost

Against the rules for cost: the hourly `lookUp` and the per-step round are polls (rule 4); `stepWork` advances a linear quantity by
steps where a closed form would do (rule 3); `refreshJobs` recomputes the fishing ground by a search at every review though it changes
only when a ground is fished out (rule 6). At 1,000 living the two agent lines and the jobs line alone, scaled linearly, are near the
whole 200 ms budget.

### 4.3 Code

- **Hooks.** A `KINDS` record may carry `spot`, `urgency`, `done`, `deliver`, `load`, `again`, `reload`, `draw`, `worked`, `held`,
  `stack`, `carted`, `available`, `stages`, `window`, `attention`, `rate`, `reach`, `late`, `together`, `project`, `inside`, `field`,
  `pace`, `minAge`. `stepWork` reads eight of them in one function of 90 lines.
- **Special cases of one pattern.** Priority has four branches (`prioOf`: plot, claim, common, role). Timing has its own rule for
  cooks (`callCooks`), a flag for finishing after hours (`late`) and a flag for work days (`together`). "Two hands, each on a trip of
  its own" is a second job with a `b` on its key, three times (wood, fish, gather). By the working rules the third case of a pattern
  asks for the general rule.
- **Order as behaviour.** A job's id is its posting order, matching visits jobs by id, and so the order of `ASK` "is part of the
  behaviour" (`kinds.js`). A refactor that reorders declarations changes runs.
- **Duplication.** `onProject` is written twice (`kinds.js`, `jobs.js`); `fit` repeats `score` with reasons.
- Already filed and not repeated here: jobs hold objects, not ids (VB-247); kinds live in two places (VB-418); `sim/kinds` is over the
  line (VB-420).

## 5. What others do

### 5.1 Read for this review

- **Sylvester, "The Simulation Dream" (2013) [read].** "The whole value of a game is in the mental model of itself it projects into
  the player's mind"; what never reaches the player's model is wasted; choose "the minimum representation that supports the kinds of
  stories you want to generate". The bid's noise, join factor and switch ratio never reach the player's model.
- **Zubek, "Needs-based AI" [read].** The Sims' advertisements: cheap and modular, but distance attenuation "can be difficult to tune",
  global tuning parameters get hard as the game grows, and without feedback players "build an entirely different mental model".
- **Graham, "An Introduction to Utility Theory", Game AI Pro ch. 9 [read].** Pure best-pick feels robotic, pure weighted-random picks
  "something utterly stupid"; bucket by priority first, then score. The game's noise is the weighted-random half without the buckets.
- **Gerkey and Matarić, "A formal analysis and taxonomy of task allocation" (2004) [read].** Greedy assignment is at worst half the
  optimum and in practice "works extremely well"; an optimal assignment is affordable for tens of agents. So: keep greedy, and do it
  per household, where the numbers are four hands and ten tasks.
- **RimWorld's work grid [read, wiki].** A strict priority grid a player sets per pawn: legible, but it ignores distance and its
  micromanagement grows with headcount. It fits 10 pawns, not 1,000.
- **Manor Lords [read, guide].** The unit is the family, moved between workplaces by the player; assignment is a rare event.
- **The Settlers (1993) and Majesty [read, Wikipedia].** No command of individuals: the player sets distribution priorities, or posts
  a priced reward that classes of hero answer differently. Both were praised for it, and The Settlers also called passive.
- **Farthest Frontier's forum [read].** At scale, allocation that ignores where workers live turns output into walking, and players
  "can't easily see what laborers are supposed to be doing".
- **Oblivion's Radiant AI [read, GamesBeat].** Autonomy was cut back when its results could not be controlled or read.
- **Chayanov, and Gauthier's Silvanus model [read].** The peasant household works for its living, harder as dependents outnumber
  workers; Silvanus allots a household's labour between activities once a year by a closed form. A time budget, with no task matching.
- **Sid Meier, GDC 2012 [read].** An interesting decision has a trade-off, persists and is made with information. Which of four people
  fetches water is none of these; which work the household leaves undone in a short harvest window is all three.

### 5.2 The reviewer's own view, unchecked [memory]

Kim asked for this though it could not be grounded. Each is a recollection.

- **Songs of Syx** reaches tens of thousands of subjects by making employment a property of a room: a room has work slots, a subject
  holds a slot for a long time, and what the room makes is a rate from its filled slots and their skill. Individuals still walk and
  carry, which keeps it honest to the eye. The lesson for this game is the long-lived assignment, not the aggregate rate: the hard rule
  (nothing teleports) forbids the second and has no quarrel with the first.
- **Crusader Kings 3** simulates no labour at all, and is the reference for the run's length. Its lesson is about grain: over 40 to 80
  hours a player acts through a handful of standing choices and a stream of events, never through hourly allocation. The head's verbs
  should be of that grain: standing roles, a day's order, an answer to a neighbour who asks for help.
- **Dwarf Fortress** before its work details let every dwarf do every enabled labour, and its best-known complaint was that work went
  undone for reasons nobody could find; the redesign made assignment explicit. It is this game's nearest relative in ambition and the
  clearest warning.
- **Clanfolk** and **Medieval Dynasty** are closest in subject: a family's year on a farm. As I recall both give each person standing
  duties and let the season, not a bid, decide what is pressing. Players read these well because a person's work is the same today as
  yesterday unless something happened.
- **GOAP and HTN planners** (Orkin's F.E.A.R. work; hierarchical task networks) plan a sequence towards a goal. The plans of
  `sim/plans` are already a small hand-written HTN: a project is a method with ordered steps. A general planner would cost more and
  read worse than the template of the year; rejecting the optimiser on 10 November was right.
- **Sylvester's "Designing Games"** argues, as I recall it, that a story generator needs elastic failure (things go wrong by degrees)
  and characters whose reasons can be guessed. A head who lays in too little wood (the bias of foresight, already Decided) is such a
  character; a pawn that lost a bid by 0.2 of noise is not.
- **Adams and Dormans, "Game Mechanics"** describe an internal economy by sources, drains, converters and feedback. In those terms
  labour hours are this game's scarcest resource in two short windows (sowing, harvest) and nearly free the rest of the year. The
  design effort belongs to the two windows; outside them the allocation should be cheap and unremarkable.
- **Schell's lenses** would ask what the player feels they are doing. Today the honest answer is "watching"; with a day's plan they
  can read and change, "running a farm".

### 5.3 The patterns, and where this game stands

| Pattern | Seen in | Fits here |
| --- | --- | --- |
| A board with a strict priority grid | RimWorld, Going Medieval | No: micromanagement grows with headcount |
| A board with utility bids | The Sims, this game today | Kept for what has no one head: village work and help |
| Employment slots at a workplace | Manor Lords, Songs of Syx | Later, for the miller, the baker and town trades (slice 6 on) |
| A household's time budget | Chayanov, Silvanus | Yes, as the head's day, acted out by the pawns (option B) |
| Priced or asked-for work | Majesty, the contract net | Yes, for help between households, with goodwill as the price |
| Agents without identity, or detail by distance | SimCity 2013 | No: against rule 7 and the hard rule |

## 6. The options

### A. Two fixes, no design change

Cache each house's fishing ground until its ground changes; give the idle stroll a cheaper route or a longer wait. About 5% and up to
5% of simulation time by the profile. Tasks of size S; behaviour unchanged for the first (`tools/same.js`).

### B. The head's day

**The rule.** At its review the head allots the household's day: each member gets an ordered list of the household's tasks, and a
task that falls due at a known hour (water, milking, the meal) is in the list with its hour. A pawn works down its list. It is the
matcher's own sum, run once for the household where the head would run it, without noise, and with each member's working hours as a
capacity.

| Aspect | Today | B |
| --- | --- | --- |
| Who is matched | Every idle pawn against every open job of its household and village, each step | A household's members against its own tasks, at its review and when its day changes |
| Best fit | Best bid first, across pawns | The same, as greedy assignment: best fit first, each member up to its working hours |
| Noise | 0.3 on every bid | None: a head does not draw lots. Variety comes from who the head is (foresight, bias; Decided) |
| Several hands | All may join; each further hand's bid falls to 0.8 | As many hands as finish the task in the time it has, the rest to other work |
| A poor fit | Waits two hours | Gets the task when no good fit has hours left |
| More urgent work | Each working pawn looks up each hour | The same test (1.5 times and 1), when the day is allotted anew; not polled |
| The cook | Called off from 14:00 by a rule of its own | The meal is in the cook's list at its hour |
| Without the plan | A member with no task asks the household's opportunities, once a day | The same: its list is empty, so the day is allotted anew with them |
| Village work and help | The same round | The round as built, for a pawn whose list is empty (until the task below) |

**What the player gets.** The plan panel (Agreed, 10 November) shows who does what today and why; as head the player may reorder a
member's list or move a task to another member: a verb at the grain of a household, under parity of command.

**What moves in `design.md` section 7.** Matching (Agreed), More urgent work (Agreed) and Several hands (Decided) keep their substance
and change their cadence and wording; noise goes. Kim has agreed to this (section 8); the design text is rewritten by B's first task.

**Cost, before building.** Households (about 200 at 1,000 living) × allotments a day (a review, the due hours, a store crossing: 3 to
6) × tasks (about 10) × members (about 5): some 50,000 scores a day at the late reference, against 15,000 bids, 8,800 looks up and
18,400 asks a day per thousand pawns today, each of which also wakes the round. The saving expected is the round's bookkeeping, the
hourly `lookUp` (4%) and `lookForWork` (3.6%); the routes stay. To be measured, early and on a late save.

**Risks.** Behaviour changes everywhere work is chosen, so every balance number moves and is reported before and after; determinism is
simpler (fewer draws from `rng.work`); the day's lists are state and are saved.

**Help as an act** is B's second step and a task of its own: a head short of hands in a window asks named neighbours; who comes is
theirs to answer, by kinship, opinion and their own day; goodwill is booked as today. It lets the player ask and be asked.

### C. Work as scheduled blocks

A task taken becomes a block with three legs (walk, work, carry) whose ends are known when it starts: the route's hours, the hours
left over the hands' rates, the route home. The ends go into a due-queue (rule 4); progress is read in closed form (rule 3); the page
draws the pawn between the ends (rule 7). Nothing teleports: the journey is made, by a named pawn, in the time it takes.

What must be solved first, each by a small experiment: talk reads positions each hour (derive them from the leg); worn paths are
written by steps (write them at a leg's end, along its route); several hands change a task's end when one joins or leaves (re-queue
it); hunger changes a pawn's rate at meals (re-queue at the meal). The saving aimed at is most of `stepAgents`' 20%. It is measured by
a throwaway mock before any plan, as the balance mocks were (`docs/balance/mocks/`).

### Rejected

- *Detail by distance, or work as a rate with no pawn making the journey:* against rule 7 and the hard rule.
- *A priority grid per pawn for the player:* 200 households of grids; the head's day gives the same lever at the right grain.
- *An optimal assignment:* greedy is within the literature's bounds and reads the same.
- *A general planner (GOAP, HTN) for the head:* the template of the year is cheaper and readable; rejected already on 10 November.
- *Removing the board:* village work, plots and help have no one head; the round stays for them.

## 7. Tasks

| Task | Option | Size | What |
| --- | --- | --- | --- |
| The fishing ground is found once | A | S | Cache it by house until the ground changes; `tools/same.js` |
| The idle stroll costs less | A | S | Fewer routes for a stroll; idle share and talk reported |
| The head's day: design text and the allotment | B | M | `design.md` section 7 rewritten; the day's lists as saved state; household tasks taken from the list; numbers before and after |
| The head's day in the page | B | S | The plan panel shows who does what today; the head's verbs to reorder and reassign |
| Help is asked for | B | M | A head asks neighbours; the helper round's two-hour fallback goes |
| The matcher's leftovers | B | S | What only the round used is removed: the join factor, the poor-fit wait, where nothing reads them |
| A mock of scheduled blocks | C | M | A throwaway script: cost and the four problems of section 6 C, measured |

## 8. Kim's answers (15 November 2026)

- **B first.** The Agreed points of section 7 it rewrites may move.
- **C is in scope**, after B.
- The reviewer's unchecked view is wanted, labelled as such (section 5.2).

## 9. B as built (VB-449, 15 November 2026)

The head's day is in: `allot`, `takeDay` and `helpers` in `src/sim/jobs.js`, the day saved on the household's plan, `design.md` section 7
rewritten. Three things turned out other than section 6 says:

- **Not cheaper.** The jobs line is 40.9 ms a day against 38.6 (populous small, seed 7, 4 years), within the noise of the two runs. The
  pairs weighed are as many as the bids and looks up were, and the routes are the same. The cost argument now rests on C alone.
- **The join factor stays.** Without it every hand's best task was the same field and the spring raking was missed. It is the rule
  that spreads hands over simultaneous tasks, and it moved into the allotment unchanged.
- **Two faults that the old timing hid** came out and are fixed: a meeting looked hourly at a pawn that carried a load every hour, and
  an invariant forbade a state the firewood cart makes on `main` too.

Fewer households went hungry at each seed run (hungry household-days 40 to 29, 4 to 0, 1 to 0); the numbers are in `backlog/VB-449.md`.
Still to do of section 7's table: the day in the plan panel with the head's verbs, help as an ask, the two fixes of A, and C's mock.

## 10. C measured (15 November 2026)

`docs/mocks/blocks/` holds the mock and its numbers. In short: a scheduler would handle 12.4 events a pawn-day in place of 95 agent-steps;
a walk's end is foretold to the step in every case and a task's in 99.9%; wear and talk are no obstacle. But the plain stepping it
removes is 17.7% of simulation time, about 15 of 95 ms a game day, since a third of the agents' line is the events themselves; and it
changes every reader of a pawn's place. The reviews' availability asks (20.8%) are a larger item, and option A's two fixes are worth
about as much as C together. The order this suggests: A, then the availability cache `design.md` section 7 already agrees
(Opportunities: cached per holder), then C, perhaps as its half step (work legs only).

## 11. The shape of C, as discussed with Kim (15 November 2026)

C may be a breaking change: the timetable is the simulation, not a copy of the stepping. Decided in the discussion, to be written into
`design.md` by C's plan:

- **A call is instant.** The head calls a pawn off a block at once (knowledge moves at once, the hard rule's exemption). The cost is
  physical and shown before the call: the walk home, the load left. The engine needs the cut for the night, a death and an occasion in
  any case. An earshot rule (instant near the house, at the leg's end beyond) is a later option, not built.
- **The timetable is an estimate**, with a range, not a promise.
- **Two skills, kept apart.** The worker's skill changes the time taken; the head's skill changes the estimate. The player as head
  sees its pawn's estimate, flaws and all (parity of command).
- **Time taken and the uncertainty of the estimate are different things**, and each needs its cause:

| Quantity | Whose | What moves it | Drawn |
| --- | --- | --- | --- |
| The norm | The kind's | The hours everyone knows a task takes | Never |
| The time taken | The world's | Causes the world already holds: the worker's rate (skill at the type of work, age, hunger, health), the ground and the crop (a heavy stand takes longer to reap and carry, scrub to clear), the walk, worn tools when built, weather when built | No: computed |
| Its residual | The worker's | Mishaps and rework, fewer for a practised hand | Once, when the block starts, from a seeded stream |
| The estimate's centre | The head's | Which of the causes above it reckons with, and a persistent lean (one head always thinks it will go faster) | The lean once, when it becomes head |
| The estimate's width | The head's | What it cannot know (the residual, what may interrupt) and what it judges poorly; narrower with husbandry and years as head, and as the work proceeds and is seen | Never: derived |

  So most of the variation in time taken is explained by state, not dice; the residual is small and is the only new randomness. The
  estimate is wrong for reasons that can be named in the panel ("did not reckon with the heavy crop").
- **Heads allot by their estimates**, so a poor head mans the harvest too thinly and meets the frost: households differ by mechanism
  (principles 1 and 8), which answers the risk of a solved day.
- **Cost:** one draw a block, one stored lean a head, nothing polled.

Open: whether a poor head's range is honest and wide, or too narrow; which causes of time taken come first; whether skill at a type
of work grows from hours worked now or with slice 7's traits.
