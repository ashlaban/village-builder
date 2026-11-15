# Mock: work as scheduled blocks (option C of `docs/review-jobs.md`)

15 November 2026. A throwaway measurement, not game code: `mock.js` steps a real run a 6-minute step at a time, reads `st`, and counts
what a block scheduler would have had to do in place of the stepping. It writes nothing to `st`.

    node docs/mocks/blocks/mock.js [--scenario populous] [--seed 7] [--map small] [--years 2]

Measured at `17c9c14` (the head's day in), populous small, 2 years, seeds 7 and 42; the shares of simulation time are from a CPU
profile of 3 years at seed 7 (`node --cpu-prof tools/sim.js ...`), as shares of `Sim.advance`.

## The question

Today every awake pawn is stepped each 6 minutes: a walker is moved along its path, a worker adds a tenth of an hour to its task. A
block is a leg of walking or of work whose end is known when it begins and waits in a due-queue; nothing is done in between, and a
pawn's place is worked out from its leg when something asks. Three things decide whether that is worth building: how many steps it
removes, whether an end can be known at the start, and whether the four things that read the steps can live without them.

## Results

| Measure | Seed 7 | Seed 42 |
| --- | --- | --- |
| Agent-steps stepped, a pawn-day | 94.8 | 98.1 |
| Events a scheduler would handle, a pawn-day | 12.4 | 12.6 |
| of which legs begun or ended | 11.8 | 12.0 |
| of which a task's end moved by hands joining or leaving (the night included) | 0.52 | 0.58 |
| of which a task's end moved by a rate (hunger, health, the ox team) | 0.10 | 0.09 |
| Steps for each event | 7.6 | 7.8 |
| The queue's own cost (a binary heap, timed), ms a game day | 1.0 | 0.8 |

**Can an end be known at the start?** Yes.

| Leg | Foretold from | Within one step of the real end |
| --- | --- | --- |
| A walk (5.5 a pawn-day) | The route's points, each distance times its cost, at the pawn's pace | 100.0% (5% of walks are cut short, which is an event of its own) |
| A task's work (1.2 a pawn-day) | The hours left over the rates of the hands at work, told again when they change | 99.9% |
| The same, never told again | | 79% (the night and the hands) |

**The four problems.**

| Problem | Measured | Verdict |
| --- | --- | --- |
| Talk reads positions each hour | 176 pawns outdoors at an hour, 42 of them mid-walk: 2.8 places worked out from a leg a pawn-day | Small: a walker's place is one interpolation along its route; a worker stands at its site |
| Paths wear by steps | A tile is trodden when entered; the fade runs once a day, at midnight; 0.00% of walks cross it | None: the tiles of a leg can be trodden at its end, or at its cut, for the same wear |
| Hands join and leave a task | 0.45 to 0.5 moves of the end a task | Small: one more event in two tasks |
| Hunger changes a rate | 0.08 moves a task | Negligible; a rate changes at a meal, a known time |

**What it would save.** The plain stepping, which a queue would replace, is 17.7% of simulation time: the loop over the awake
(`stepAgents` itself, 7.8%), a worker's increment (`stepWork`, 4.6%), a walker's move (`moveAgent`, 3.5%), and the awake list, side
tasks and rates (1.8%). `stepAgents` is 25.0% with what it calls, but the other 7% is what happens at a leg's end (a task completed, a
load put down, an arrival), and that stays. Against it, the queue costs about 1 ms a day and the places worked out for talk less. At
this size that is some 15 of 95 ms a game day.

## What it means

1. **C works, and its problems are small.** Ends can be foretold to the step, wear is unchanged, talk needs three interpolations a
   pawn-day.
2. **Its ceiling is about a sixth of simulation time**, not the quarter the review's section 3 suggested: a third of the agents' line
   is the events themselves.
3. **It is not the largest item.** In the same profile the reviews and their availability asks are 20.8% (`refreshJobs`), talk 9.4%,
   route finding 6.9%, idle strolls 6.3%. The fishing-ground search and the stroll (option A) are worth about as much together as C,
   for two small tasks.
4. **Its price is the widest.** Every reader of a pawn's place changes: four simulation modules besides `sim/agents`
   (`jobs`, `lifecycle`, `relations`, `society`) and six page scripts, which would draw from legs. The field's row-by-row walk becomes
   the page's.
5. **A half step exists.** Work legs alone as blocks, with walking stepped as today, removes the worker's increment and part of the
   loop (5 to 9%) and touches no reader of a place.

Not measured: the late game (cost per pawn-day may differ on `medium-ref`), herding as a side task (`stepSide`, 0.8%), and the cart's
part in carting, which the mock's foretelling leaves out (manure is not among the kinds foretold worst).
