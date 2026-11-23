# Review: a pawn's agency, and how it feels to play

23 November 2026. A review of everything a pawn chooses (its work, its free hours, its life), asked for by Kim for play feel. It follows
`docs/review-jobs.md` (15 November), which reviewed the job system alone and led to the head's day and to work as blocks; what that
review settled is not argued again here. Read for it: `src/sim/jobs.js`, `agents.js`, `wishes.js`, `offers.js`, `commands.js`,
`plandays.js`, `relations.js`, `mood.js`, `traits.js`; `design.md` section 7; `docs/architecture/target-v2.md` section 4.5.
Measurements are from `populous` on the small map, seed 7, two years, at `359be20c`.

## 1. In short

The household's head decides and its members carry it out: the pawn itself chooses almost nothing. That is right for work, and the
architecture stays. What play lacks is below the head: a member's day has no memory, its free hours no content, it has no way to ask,
and its card does not say why it does what it does. Four changes give it those; a fifth task takes up the cost of the jobs line; the
yearly wish waits for a design pass of its own.

## 2. The approach today

| Layer | Mechanism | Where |
| --- | --- | --- |
| The year | A template of targets by store, read through the head's biased estimate, and projects from a weighted menu | `sim/plans`, `sim/aims`, `sim/estimate` |
| The day | Greedy assignment by household: role priority × urgency − the walk, 0.8 for each further hand, each member up to its hours; an ordered list a member | `sim/jobs` (`allot`, `takeDay`) |
| Life | An ordinal ladder of wishes, settled once a year through offers answered yes or no | `sim/wishes`, `sim/asking`, `sim/offers`, `sim/round` |
| Execution | Legs (a walk, work, a wait) in one due-queue; every act a verb the planner and the player pass alike | `sim/legs`, `sim/commands` |
| Free hours | A stroll to one it likes, to the green or the yard, then a wait of 4 to 8 hours | `sim/jobs` (`idleAbout`), `sim/relations` (`companyFor`) |

What holds up: no noise in the choice, so households differ by their heads' misjudgement, a cause a player can guess; parity of
command for free, since the planner issues the verb the player does; the household as the unit, which keeps matching small.

## 3. Measured

| Measure | Value |
| --- | --- |
| Simulation time | 109 ms a game day at 332 to 346 living |
| Jobs refresh and matching | 49.1 ms a day, 44.9% (40.4 on 15 November, another machine) |
| Agents: walking and working | 18.2 ms, 16.6% |
| Talk and contacts | 13.8 ms, 12.7% |
| Agents: idle strolls | 7.3 ms, 6.7% |
| Idle share of work hours, farmers | 18 to 23% spring to autumn, 39% in winter |
| Idle share, sons, daughters, maids and farmhands | 25 to 56% spring to autumn, 53 to 66% in winter |
| Idle share, the retired | 50 to 83% |
| Why idle | 77% no task they may take, 19% waiting for the next look, 4% not worth the walk |

Scaled linearly to 1,000 living, the jobs line alone is about 145 ms of the 200 ms budget. The availability cache that `design.md`
section 7 agrees (Opportunities: cached per holder) is not built and had no task.

## 4. Findings, for play

- **The day has no memory.** Each morning's lists are made from nothing, ties broken by a task's id. Nobody is the one who sees to the
  wood; a member's work is the same today as yesterday only by accident of the scores. The review of 15 November named the lesson
  (the long-lived assignment) and did not build it.
- **Free hours are empty.** A fifth to two thirds of a member's working hours, by role and season, is a stroll and a wait, and the
  card reads "Strolling" or "Resting". It is the largest part of a pawn's day and the part with the least in it.
- **A member has no voice.** Its traits change how long it idles, not what it does; mood feeds one rule (the gift's allowance). A
  played pawn that is not the head can act on opportunities and nothing else: asking the holder was "a later verb".
- **The reasons are not shown.** The card says what a pawn does, not who chose it or why. `explainIdle` answers for the idle only.
- **The wish is thin.** The yearly ladder reads ambition and hunger; whom the pawn is tied to and what it thinks of its head do not weigh.

## 5. Alternatives weighed

| Alternative | Gives | Verdict |
| --- | --- | --- |
| Utility or needs by pawn (The Sims, RimWorld) for work | Character in work | No: the unreadable auction removed on 15 November |
| The same for free hours only | A pawn's own motives where the head's list is empty | Yes, as Own time: a table of pastimes, social effects only |
| A long-lived assignment (a time budget; Songs of Syx's slots) | "The same as yesterday unless something happened" | Yes, as Standing duties, by a keep factor in the allotment as built |
| A general planner (GOAP, HTN) | Plans found, not written | No: the year's template is a small hand-written one, cheaper and readable |
| An optimal assignment | A slightly better match | No: greedy is near enough for five hands and ten tasks |
| A learned or language-model policy | Variety | No: against determinism, cost and reading the reasons |
| A market for labour between households | Hired hands | Slice 5's, with the wage; help asked for is its first form |

## 6. Kim's answers (23 November 2026)

- Scope: all of a pawn's agency. Motive: play feel; cost is always a motivator.
- Into the design and the backlog: Reasons shown, Own time, Standing duties, A member's voice (`design.md` section 7, the four rows
  of 23 November; `docs/architecture/target-v2.md` section 4.5, Agency below the head).
- The wish: later, as a design task.
- The tasks run side by side, the complex ones on the larger model.

## 7. Tasks

| Task | What | Size | Waits for |
| --- | --- | --- | --- |
| VB-1538 | Reasons shown: who chose a pawn's act, and why, on its card | M | |
| VB-1539 | Own time: a pawn with no task chooses a pastime | M | |
| VB-1540 | Standing duties: the head's day remembers | M | |
| VB-1541 | Cost: the jobs line measured by part, and its largest part cut | M | |
| VB-1542 | A member's voice: leave asked of the head | M | VB-1539, VB-1540 |
| VB-1543 | A member's voice: a duty asked of the head | S | VB-1540, VB-1542 |
| VB-1544 | Design: the wish reads a pawn's ties and its opinion of its head | S | Kim |

VB-1538 to VB-1541 touch `sim/jobs` and `sim/agents` side by side: each claims its files (`tools/inbox.js claim`) and keeps its change
to a shared file small. `sim/jobs` stands at 644 formatted lines and `sim/agents` at 707: Own time moves `idleAbout` out of `sim/jobs`,
and a task that takes either over the line names VB-1487 or opens the split.

## 8. Outcome of the run (23 November 2026)

| Task | Outcome |
| --- | --- |
| VB-1538 Reasons shown | Done: `sim/reasons`, a view; the line on the pawn's card and the played pawn's sheet |
| VB-1539 Own time | Done: `sim/pastimes`, six pastimes, the verb `pastime`; hungry household-days 55 to 46 at seed 7, friends 9.2% to 10.2% of relations |
| VB-1540 Standing duties | Built, measured and removed. Finding 4's first point was wrong in its effect: with no memory at all 72 to 73% of member-days begin with the type of work of the day before. The keep factor added three points at 1.25, delayed the haymaking and raised hungry days at one seed of two. Kim: the idea is kept, this mechanism removed; `design.md` section 7, Standing duties, is Open |
| VB-1541 Cost | The allotment, not the asks, is the largest part of the jobs line (31%; commands issued 22%, asks 17.5%, the review 17%). A village's review alone no longer allots its households anew: pairs weighed 21.4 to 19.3 a pawn-day. Kim: a task newly due is slotted in (VB-1545) |

Follow-ups filed by the run: VB-1545 (the slotting), VB-1547 (a caller indoors), VB-1548 (own time reported), VB-1549 (a hay target met
early), VB-1550 (a pawn away in no phase), VB-1551 (routes begun by the planner), VB-1552 (the asks' cache).
