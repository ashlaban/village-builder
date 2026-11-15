# Plan: work as blocks, the timetable and the estimate (VB-452, 15 November 2026)

A design pass; no code. It turns option C of `docs/review-jobs.md` (sections 6, 10 and 11) and Kim's answers of 15 November into
design text (`design.md` section 7, written by this pass), a cost named before building, and implement tasks. Sources: the mock
(`docs/mocks/blocks/README.md`), the head's day as built (VB-449), Rules for cost 3, 4 and 7, and the code at `799a32b`.

## 1. Survey: what a block replaces, and who reads what it changes

### 1.1 What is stepped today

| What | Where | Each 6-minute step | Becomes |
| --- | --- | --- | --- |
| The awake list | `sim/agents` `awake`, `wake`, `sleep`; `st.awake` | Rebuilt each hour over the living; walked each step | Gone: a pawn is touched when a leg of its own falls due |
| A walk | `walkTo`, `moveAgent` | The pawn is moved along `a.path`, point by point; a tile entered is trodden (`sim/paths` `tread`) | A walk leg: its hours are known from its points; the tiles are trodden when it ends or is cut |
| Work | `stepWork` | `j.done` grows by the hand's rate; the pawn walks the field's rows (`a.work`); the kind's `worked` hook runs | A work leg: the task holds its progress, the hands' rate and when it was last reckoned; its end is in the queue |
| A task held at the side | `stepSide` (herding) | Progress at the side rate while in reach; grazing by whole hours | The same closed form; reach is looked at when the holder's own leg begins or ends, as the code already looks at a walk's end |
| Waiting | `idle`, `idleUntil`, `wantsWork` | Looked at each step of the working day | A wait leg, due when the pause ends |
| A journey between villages | `st.journeys`, `leg`, `dueJourneys` | Already a queue of legs by due time | Joins the one queue |

`stepAgents` is 25.0% of simulation time; the plain stepping in it is 17.7% (the mock, populous small, seed 7).

### 1.2 Who reads a pawn's place

| Reader | Where | Reads | With blocks |
| --- | --- | --- | --- |
| Talk | `sim/relations` `talkHour` (cells of `a.x`, `a.y`), hourly | Every pawn outdoors: 176 an hour of 365 | `placeOf(st, a)`: a worker stands at its site, a walker is found along its leg (2.8 a pawn-day) |
| Who is near | `sim/society` (cells) | The same | The same |
| Company for the idle | `sim/jobs` `idleAbout` (`mate.x`) | One pawn | The same |
| A death on the road | `sim/lifecycle` | One pawn | The same |
| The page | `page/animate` `placePawns`, and eight other scripts for phase, facing and stride | Every frame, drawn between the last two steps (VB-244) | Drawn from the leg at the frame's own time; the row-by-row walk on a field is the page's alone |

### 1.3 Who reads or writes a task's progress

`isOpen` and `hoursLeft` (`sim/kinds`, `sim/jobs`); a plot's and a claim's steps, which keep `done` while a job is taken down and
posted (`sim/expansion`, `sim/farmclaims`); a plot's hours by pawn (`j.plot.hours`); the hooks `worked` (a stake renewed, `sim/kinds`;
a claim worked, `sim/farmclaims`; grazing by whole hours, `sim/grazing`). All read `j.done`: with blocks they read `doneOf(st, j)`,
and the hooks run when the task is reckoned, with the hours since.

### 1.4 What stays as built

The clock and its calendar (a 6-minute step; `st.tick`); the head's day and who takes what (VB-449); the kinds' `done`, `deliver`,
`load` and `again`; carts; eligibility; occasions; the end of the working day, which already visits each worker.

## 2. The design

**A leg.** A pawn is always in one leg: a walk, work, or a wait. A leg has a start and an end known when it begins, both whole steps
of the clock (an end is rounded up to the step, so the calendar, the page's stepping and determinism stay as they are). Its end
waits in one queue in `st`, plain data, sorted by step, then pawn. A step of the simulation takes what is due and nothing else
(Rules for cost 4).

**Reckoning.** A task holds `done`, the step it was last reckoned at, and the summed rate of its hands at work. Its progress now is
`done + rate × hours since` (Rules for cost 3). It is reckoned, and its end queued again, when a hand joins or leaves, when a hand's
rate changes (a meal: a known hour), and at the end of work. A pawn's place is its leg's start for work and a wait, and for a walk
the point its hours so far reach along the route.

**The cut.** Any leg can be cut: the task is reckoned, the walk's tiles so far are trodden, the pawn stands where it had come to. The
night, a death, an occasion and the head's call all cut.

**The call is instant** (Kim, 15 November): the head calls a pawn off a leg at once; knowledge moves at once (the hard rule's
exemption). The cost is the walk home and the load left, and the panel names it before the call.

**Time taken** is computed, not drawn: a task's hours over its hands' rates.

| Cause | Today | With this plan |
| --- | --- | --- |
| The worker | `rateOf`: role and age, hunger, health; the ox team; the cart | The same, and the hand's skill at the type of work (a stand-in until slice 7): a practised hand up to a tenth faster, a poor one a tenth slower |
| The crop | Reaping takes the crop's fixed hours; the carrying already goes by loads | Reaping and threshing go by the size of the crop: the kind's hours times the field's sheaves over a normal crop's, between a half and one and a half |
| The ground | A field gone to scrub takes its scrub's hours | The same |
| The walk | The route's cost | The same |
| Tools, weather | Not built | When their systems are (VB-121; Weather, seasons and daylight) |
| The residual | None | Mishaps: each hand's rate for a leg is lowered by a draw between nothing and a most that falls with its skill (a fifth for the poorest, a twentieth for the best), from a stream of its own. A hand of middling skill works at the norm on average, by construction |

So a task takes longer because the crop is heavy or the hand is hungry, which the world can show; the draw is the small part.

**The estimate** is the head's, and is what the player sees (Kim, 15 November).

| Part | From | Notes |
| --- | --- | --- |
| The centre | The same sum as the time taken, with only the causes the head reckons with; the others at their norm. Every head reckons with the walk, the hands' age and the norm; with judgement it adds hunger and health, then the crop's size, then each hand's skill. Times one plus its lean | Judgement is VB-254's skill as head (wits, husbandry, years as head); the lean is one more of its biases, drawn once |
| The width | The mishaps' spread for the hands at their norm, plus a fixed part for each cause the head does not reckon with | Honest: a poor head's range is wide. A proud head's may be too narrow: slice 7 |
| As work goes on | The centre moves to the pace seen (done over hours worked) in proportion to the share done; the width shrinks with it | Closed form, nothing stored |
| Afterwards | When a task or a window ends outside the range, the record says which cause was not reckoned with | A notable event only when a window was missed |

**Heads allot by their estimates.** The head's day gives a task hands until its *estimated* hours are covered, each member up to its
*believed* hours. A poor head mans a heavy harvest as a normal one.

**The timetable** is a view, not state: each member's list (VB-449) laid end to end with the walks between, each task a range. It is
worked out when asked for (the panel, the allotment), never each step. Nothing the player sees shows hours left other than as an
estimate; progress so far is seen and is exact.

**The player in a pawn** sees the estimates of the pawn it inhabits, by that pawn's judgement, of its own household's tasks; as head
it reorders a member's list, moves a task to another member, and calls a member off.

## 3. Cost, before building

At the late reference, 1,000 living (the mock's rates):

| Work | Entities × cadence × a call | A game day |
| --- | --- | --- |
| Legs begun and ended | 1,000 pawns × 11.8 a day × one insertion into a sorted queue of at most 1,000 | 11,800 events |
| A task's end moved | 1,000 × 0.6 a day × a reckoning and an insertion | 600 |
| Places worked out | Talk and nearness: pawns outdoors each hour, one read each; 2.8 a pawn-day along a walk | 2,800 walks searched by halving |
| Estimates | With each allotment: the pairs it weighs already (21 a pawn-day), a few multiplications more | No new loop |
| The timetable | On demand, a household at a time | None in a step |

The stepping removed is 95 agent-steps a pawn-day, 17.7% of simulation time at the early reference; the queue was timed at 1 ms a
game day for 4,400 events. No pass over history or pairs; the queue is bounded by the living (one entry a pawn, one a task under
work). Each implement task measures early (`populous` small, year 3) and on a late save.

## 4. The order of building

Each step lands the closed form beside the stepping first and checks the two agree, then removes the stepping. So the risky part of
each step is a check that fails loudly, not a change in balance.

| Step, task | What | Size | What shows it right |
| --- | --- | --- | --- |
| 1, VB-454 | The end foretold, beside the stepping: `walkHours`, a task's due step, `placeOf`, `doneOf`; an invariant that a leg ends within a step of its foretelling | S | `tools/same.js` clean: nothing is changed |
| 2, VB-455 | Work legs as blocks: a worker is not stepped; progress in closed form; the hooks at the reckoning; the rows walked by the page | M | Step 1's invariant; numbers before and after; saves; `walkStep` falls |
| 3, VB-456 | Walks and waits as blocks, journeys in the same queue; `st.awake` goes; the readers of a place use `placeOf` | M | The same; talks a pawn-day unchanged within a twentieth |
| 4, VB-457 | The page draws from legs | S | `tests/smoke.js`, the browser tests, a screenshot before and after |
| 5, VB-458 | Time taken from causes: the crop's size, the hand's skill, mishaps | M | Balance numbers at the bands' seeds; the hours report by kind |
| 6, VB-459 | The head's estimate, and allotting by it (after VB-254) | M | A constructed state: a poor and a good head, a heavy crop; hungry households by the head's judgement, reported |
| 7, VB-460 | The timetable in the page: the day, the ranges, the call's cost, the head's verbs; no view leaks the truth | M | The page's functional tests |
| 8, VB-453 | Help is asked for (VB-453): a request sized in hours from the estimate | M | |
| 9, VB-461 | Wrap-up: bands, the bench on `medium-ref`, the idle share, a tuning proposal | S | |

Steps 2 and 3 cannot be shown by `tools/same.js`: the state's shape changes and a worker no longer moves within its tile. They are
shown by step 1's invariant, the island's numbers and the counters.

## 5. Decisions made here (Deciding without Kim)

- **An end is a whole step.** The clock keeps its 6 minutes; a leg due between steps ends at the next. No principle needed: the mock
  shows the stepping's ends are these already.
- **Mishaps only slow, and skill also speeds**, so that a middling hand averages the norm and today's balance is the centre
  (principle 3: a named tunable with a physical meaning; the values are first values).
- **The hand's skill is one stand-in number by pawn and type of work**, drawn from the `traits` stream, until slice 7 (as the traits
  of VB-254). A close call: one number a pawn would be simpler, but a type's skill is what slice 7 will bring.
- **A missed estimate is told only when a window is missed.** Otherwise the record would fill with routine misses (Rules for cost 8).
- **A pawn that is not head sees estimates by its own judgement.** It follows from parity of command; surfaced as a close call.
- **The plan panel's "who holds which task" (VB-256) is the timetable's.** VB-256 keeps the rest.

Principle candidate, for Kim: *what the player is shown of the future is some pawn's estimate, never the simulation's knowledge.* It
is the third decision of this kind (the head's needs, the timetable, a helper's request).

## 6. Rejected

- *Ends between steps (continuous time):* a second clock beside the calendar's; nothing gained that the page does not already give.
- *A draw on a task's hours:* it has no cause to point at, and with several hands it belongs to no one. The draw is on a hand's leg.
- *The estimate as stored state:* it would be a list every rule must keep true. It is worked out when read.
- *A messenger for the call:* a copy of the day for each pawn, against the hard rule's exemption (Kim, 15 November).
- *Building the plan panel's list first and the timetable later:* built twice.

## 7. Questions for Kim

In `QUESTIONS.md`, "VB-452: work as blocks". Two: what the player does while its pawn works a long leg, and the order against
foresight (VB-254).
