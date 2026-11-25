# Review: the job system, 25 November 2026

How work is chosen, allotted and carried out, for simulated households and for the player, read against one lens set by Kim: *unless
well-motivated, there is no difference in the job and planning between a player and a non-player; the difference lies in the complexity
of the plans each can formulate. If every non-player pawn were controlled by an LLM agent, it should have the capacity to play as well
as a human player.*

**Method.** Three independent reviewers, each with one perspective and none shown the others' work or any earlier review
(`REVIEW.md`, `docs/review-*`): the design and architecture as written ([design-view.md](design-view.md)), the implementation at
`81cf8e8` ([code-view.md](code-view.md)), and the closed tasks, for where the system strains ([history-view.md](history-view.md)). A
fourth reviewer contrasted the three, spot-checked the claims they disagreed on in the repository (its section 10), and wrote the
overview below (sections 1 to 10). Section 11 is the session's own comparison with the review of 15 November (`docs/review-jobs.md`),
made last, so that the four reads above stayed independent of it.

**Status.** For discussion with Kim. No code, design text or backlog was changed by this review. Its options are lettered A to D;
they are not the options A to C of 15 November (section 11 maps them).

---

## 1. In short

1. **Parity holds at the bottom and breaks at the top.** Verbs, checks, eligibility, the `work` path and execution are one substrate for every pawn [checked]. The planning layer is two systems: an unplayed head has targets plus a derived day list; the played pawn has an authored plan (`st.player.plan`: routine, sleep, ordered tasks, tile chains), about 3,000 lines that no other pawn can use (I 6, H 3).
2. **The code contradicts a principle written the same day.** `design.md` section 1, "Every act is a pawn's" (Kim, 24 November): "whatever state the played pawn has, every pawn has, and `st.player` holds only the frame" [checked]. `st.player` holds the queue, the automatic switch and the whole plan, and 37 files under `src/sim` read it [checked]. The hand-plan tasks of 24 November (VB-1646 to 1668) built the opposite of the sentence.
3. **The played path is closer to the designed model than the unplayed path is.** The design says: opportunity, then a plan step, then a task (D 1). Only the player's plan has explicit steps that make tasks. Unplayed heads still run the older shape: availability rules post jobs on a board whenever stores fall short of targets. So parity and "nothing is posted" are the same unfinished migration seen from two sides. This is my reading, not a claim of any report.
4. **Shared rules now branch on the player.** Posting and project rules read `st.player` (`chores.js:155`, `building.js:72`, `ladder.js:273-283`, `projects.js:108`) [checked]. This is the costly form of divergence: each new plan task needs a mirrored "head's own rule", and H shows three same-day repairs from it (VB-1658, 1660, 1668).
5. **Choosing work is the cost centre and the tuning centre.** Jobs refresh and matching is 44% of simulation time, 75 ms of 171 ms a game day on populous [checked by rerun]. Every policy (hunger, thirst, calls, duties) is tuned into one weighed number (H A).
6. **The lower layers have held and should be kept**: commands, kinds as records, eligibility by basis, legs and closed-form progress. A change should move the planning layer onto them, not rebuild them.

## 2. The system in one picture

**Intended (D).** Work is available, not posted. A head holds a plan (standing, seasonal, projects). On its planning day the plan turns open steps into tasks. The head allots the household's day; each member works down its list; each act is a verb whose check binds any pawn; the player is one more source of commands.

**Actual (I).** Each hour `refreshJobs` asks about 45 availability rules for each holder due a review and stores what they report as jobs in `st.jobs`. The plan does not make tasks: it holds targets, and the rules compare stores with targets. `allot` weighs members against jobs into `plan.day.lists`; `takeDay` issues `work`. From `work` down, the path is shared. The played pawn is taken out of the planner by one gate, `unplanned(st, id)`, and fed instead by a queue of eight commands and, with automatic behaviour off, by its own plan.

**What history adds (H).** The shape is four weeks old and was replaced twice: bids to commands (7-13 November), auction to allotment and blocks (15-16 November). The hand-plan path arrived in one day (24 November) on top of an allotment still being tuned.

| Concept | Designed meaning | Code meaning | Divergence |
|---|---|---|---|
| Opportunity | Computed, never stored; cached per holder | A kind's `available` calling `put`; the result is stored as a job | Opportunity and task are one record |
| Task | What a plan makes of an opportunity | A posted job with `claims`, `done`, `live` | Every opportunity is a task; no plan chose it |
| Plan | Routines, seasonal plan, projects that make tasks | Targets and choices; projects are step lists; the rest is rules | Only projects, and the player's plan, have steps |
| Day | The head's ordered list per member, saved | `plan.day.lists`, written by `allot` | As designed |
| Player's plan | Not in `design.md` | `st.player.plan`, one pawn only | No design home; contradicts the state rule |
| Verb | Check holds for any pawn | About 70 verbs; six restrict their sources [checked] | As designed |
| Eligibility | Basis: member, servant, villager, helper, self | Table of six bases (adds `owed`), 29 lines | As designed |
| Leg | End known at start; one queue | `sim/legs`, `sim/work` due-queues | As designed; rare exits leak (H B) |
| Actor view | What a pawn may know | Returns `st` unfiltered [checked] | A stub |

## 3. Where the three perspectives agree

- **The verb layer is sound and is the parity anchor.** D: "a verb's check binds both". I: one `issue` path, a `source` on every command. H: few repairs since it landed (VB-167/168, 681, 1405).
- **Parity of acts is real; parity of planning is not.** D's verdict, I's layer list and H's 24 November account say the same thing in different words.
- **The allotment is where cost and tuning concentrate.** D records the redesign, I measures 44%, H lists eight tasks re-cutting it.
- **Kinds as records work for adding ordinary kinds** (water, leather, byre added without touching the matcher, H 4), but the record has grown a long tail of single-use fields (I 5).
- **Vocabulary is overloaded.** "Plan" has five meanings, "task" three, "routine" three (D 7.8). The code keeps "job" where the design says "task".
- **"How a manual and an automatic plan meet is for later"** (`docs/ui2/HANDOFF.md:20` [checked]) is the open design question all three reports arrive at.

## 4. Where they disagree or see different things

1. **"Nothing is posted" against the job board.** D quotes target-v2 principle 4; I describes "a board of posted jobs". *Both are right about their source* [checked]. `jobs.js:31` has `post`, jobs persist between reviews ("Between reviews the tasks stand", `jobs.js:83`), and `modules.md:460` itself calls `sim/jobs` "the job board". What is true of the principle: no party posts; work comes from rules computed over rights and stores. What is not: the result is stored, and it becomes a task without a plan's choice. Target-v2 principle 3 (opportunity, plan, task and activity are four things) is the one actually unmet.
2. **Is the slot-in built?** H says the shortcut Kim agreed (VB-1554) is "still unbuilt per the record". *H is wrong* [checked]: VB-1558 is done (24 November) and `slotIn` is in `sim/day`. I and D have it right.
3. **How many modules read the player.** I says "≥12". *An undercount* [checked]: 37 files under `src/sim` contain `st.player`; 16 use the `unplanned` gate. About ten of the 37 are the player's own modules and views; the rest are shared rules and social systems.
4. **Target-v2 against design section 7.** Target-v2 4.5 still says Work "keeps the matcher as built (best fit first, the two-hour rule for poor fits...)" (`target-v2.md:610` [checked]); design section 7 removed the two-hour rule on 15 November and moved choice to the head's day. *Design is current and the code follows it.* Target-v2 4.5 is stale on this.
5. **The cost share.** H cites 49 of 109 ms (45%, VB-1554); I cites 75 of 171 ms (44%). *Both stand*: my rerun of I's command gives 44.0%, 75.2 ms a day [checked]. The two absolute figures come from different runs; I did not establish whether the scenario was the same, so I draw no conclusion about a regression.
6. **Does the player lack an act unplayed pawns have?** I lists `askFor` (help) as skipping the player. *Partly right* [checked]: `hands.js:200` skips a played head, but the comment says it "asks for itself, by the same verb". The skip is unconditional, though, not tied to the automatic switch. So a played head on automatic with an empty queue appears not to ask for help, which would break "does exactly what it would if no one played it" (design section 15). I read the line only; I did not run a test. `voice.js:209` deserves the same look.
7. **Day verbs.** I says `dayOrder`, `dayGive`, `dayCall` are issued by no unplayed head. *Right* [checked]: registered in `day.js:469-540`, named only in `player.js:393-395` and the page. This is the permitted direction (design section 1: a pawn's own chooser may weigh fewer verbs).
8. **Kinds.** I's count is exact [checked]: 94 kinds, 51 distinct fields, 9 on every kind, 19 fields used by one or two kinds.

## 5. Strain areas, ranked

**1. Two planners (design gap and implementation gap).**
Evidence. D: the player's plan has no row in `design.md`. I: `playerplan`, `plannext`, `planchains`, `planview`, `agenda`, `camp`, `upgrade` form a second planner that "pokes back into shared posting rules". H: camps reachable only by a played head, repaired twice the same day; "parity was bought by changing the simulation, not by sharing code".
Root cause as I read it. The unplayed head has no explicit intent to share. Its plan is implicit in targets and rules, so when the player needed "fell this tile, then cut it, then build", there was nothing to extend, and a new structure was built beside it. The player's structure is the one the design describes; the head's is not.

**2. Opportunity and task are one stored record (implementation gap against a Decided design).**
Evidence. I: `refreshJobs` posts everything every rule reports. H E: the opportunity view and the matcher drift (VB-1197). VB-1564 found that a look finds new work in 92% of looks, so caching the asks made households worse off.
Root cause. A task exists because a rule fired, not because someone chose it. The whole decision therefore lands in `allot`'s one number, and the board must be refreshed often to stay true.

**3. The allotment: cost and one-number tuning (both).**
Evidence. 44% of simulation time [checked]. H A: the 14:00 allotment caused founders hungry 3 to 21, traced to a rank inversion (VB-1549). VB-1597 is ready: `takeDay` repeats `allotted`'s terms.
Root cause. Fit is rank times urgency less the walk; each new concern must be tuned against all the others. Cost is jobs times members for every household twice a day and on every change.

**4. Carrying a task through its ends (implementation gap).**
Evidence. VB-1548 (ready, priority 1 [checked]): a day owed that ends on the road home leaves the task stuck. VB-1565, 1585, 1610. I: `agents.ended` and `complete` hold inline cases for `K.stack`, `K.load`, `j.plot`, `j.common`.
Root cause. The phases `go`, `work`, `back`, `home` are a state machine whose rare exits (owed days, helpers, night, calls) each have their own code. Legs made the common path clean; the exits are not legs' business yet.

**5. Goods that move without a pawn (design gap, known and tracked).**
Evidence. H C: eleven teleport tasks, VB-1175 with eight lines open. Carrying is a hook per kind (`back`, `carry`, `to`, `deliver` on 27 kinds), so each good needs its own fetch kind.

**6. The kinds record and its fixed order (implementation gap).**
Evidence. I 5 and 8: 51 fields; core files name kinds literally (`jobs.js:62` names `restore`, `booth`, `boothwater` [checked]); job id is posting order and `st.plans.due` stores indexes, so order is saved behaviour. H D: four split tasks in eight days. This is the designed trade (fixed order buys determinism), but the cost is that a new kind must be appended last, and `ASK` lives in two forms.

**7. Documents behind the code (design gap).** Target-v2 4.5 stale; section 8's fixed hours unmarked; section 7 keeps "Jobs, owners and roles" verbatim under a table that replaces parts of it (D 7.2, 7.3, 7.10).

## 6. Parity, layer by layer

| Layer | Design | Code | History | Parity |
|---|---|---|---|---|
| Acts and verbs | Same verbs, same checks (section 15; section 1) | One `issue`; about 70 verbs, six restrict sources; `wish` and `propose` are functions, not verbs | Stable since 13 November | **Holds**, two gaps |
| Eligibility | Bases, same for all | `BASES` table; the verb rechecks at execution | VB-1405 made the player's queued work obey it | **Holds** |
| Execution (legs, loads, progress) | Nothing is done to the pawn between leg ends | Shared entirely | No player-specific repairs | **Holds** |
| Opportunities view | `forPawn` for any pawn | `Sim.opportunities(st, id)` for any pawn; actor view unfiltered | VB-1197 drift repaired | **Holds**; knowledge not modelled |
| The gate | Automatic behaviour may be turned off (section 15) | `unplanned` reads `st.player` in 16 modules | Flag "swapped through checks" | **Singleton**: only one pawn can be un-planned |
| Queue | Up to 8 commands before the pawn's own logic | `st.player.queue`; `actor === pl.pawn` enforced | VB-169 | **Singleton** |
| Day list | Head's list per member | `plan.day.lists`; hand edits marked `edited` | VB-466, 477 | **Shared state**, player-only use of the editing verbs (allowed) |
| Plan, intent | "A plan makes tasks"; the state rule of 24 November | Head: targets and rules. Player: routine, sleep, tasks, chains | Built 24 November as a second feeder | **Broken** |
| Rules that make work | One rule for every household | Branches on the played household in chores, building, ladder, projects, camp, upgrade | "The head's own rule exactly as today" | **Broken** |
| Projects | One-project limit removed (Kim, 21 November) | Unplayed head still begins one large project at a time | VB-1472 blocked on Kim | **Asymmetric**, awaiting design |
| API | The player is a source | `Sim.command` generic; `queue`, `plan`, `head`, `agenda`, `planView`, `planGaps`, `buildMenu` bound to `st.player` | n/a | **Half** |
| Views | Views of the pawn's own estimate | `timetable`, `reasons` generic; `agenda` assumes own hands only (`HANDOFF.md:60` [checked]) | Three representations of one day | **Mostly**; one divergent estimate |

### What "an LLM agent could play any pawn as well as a human" requires

Fact: today an external agent can issue any verb for any pawn through `Sim.command`, and can read `Sim.opportunities` for any pawn. It cannot do the rest. Concretely it would need:

1. **State per pawn, not per game.** A pawn's controller mode (own logic on or off), its queue, and its authored list live on the pawn or its agent record. `st.player` shrinks to `{pawn, view}`, as the principle says. `unplanned(st, id)` keeps its name and callers and reads the pawn.
2. **One plan structure with more than one author.** The plan of a household holds explicit steps (a task at a tile, a chain, a routine entry). The automatic head writes steps by its rule; a human or an LLM writes them by verbs. Rules that make work read the plan, never who is played. `plan.day.edited` already shows the pattern in small: a hand change stands until the next allotment.
3. **An API keyed by pawn.** `Sim.queue(st, id, cmd)`, `Sim.plan(st, id, op)`, `Sim.agenda(st, id)`, `Sim.planView(st, id)`, `Sim.waits(st, id)`; the page passes the played pawn. This is mostly a signature change, since the checks already test the actor.
4. **Complete verbs.** `wish` and `propose` become verbs. The allow-list task for player-only verbs (ready, in `tests/commands.js`'s list) becomes a test that an act reachable through `Sim` is reachable through `issue` for any pawn.
5. **An honest observation.** The actor view is where "what a pawn knows" would be enforced. For parity it need only be the same for every controller; it can stay unfiltered for now.
6. **Decision points, not polling.** An external controller is called at the cadences the head already has (planning day, morning, 14:00, a task ending, a refusal), which also bounds its cost.
7. **Determinism.** Commands from a controller are inputs, like the player's; a replay needs them recorded. This exists for no source today and is a design choice, not a repair.

### Which differences are well-motivated

- **Well-motivated, keep and write down**: the frame (who is played, the camera); the automatic chooser weighing fewer verbs for cost; presentation aids (pins, the day strip); debug verbs; the queue cap.
- **Arguable, Kim's call**: the automatic switch existing for one pawn only (under the LLM lens it should be per pawn); night work as the player's option.
- **Accidental**: plan state in `st.player`; shared rules branching on the played household; `askFor` skipping a played head regardless of the switch; the agenda's own-hands estimate beside `sim/estimate`'s team-aware one; `wish` and `propose` outside the verbs; camps and several land projects reachable by one kind of head; `workCmd` defined twice (`plannext.js:14`, `fit.workCommand`).

## 7. What has held up

- **Commands** (`sim/commands`, 95 lines): one check, one path, a source on every act. Every option below builds on it.
- **Eligibility by basis** and **attention slots**: untouched since 11 November.
- **Legs, due-queues, closed-form progress**: no stepped workers; what makes the timetable and the agenda possible.
- **Kinds declared by the domain whose state they change**, with `done` going through the owner.
- **The planning-day stagger, the due-queue for windowed kinds, slot-in**: the cost rules applied.
- **The estimate as someone's judgement**: allotment by a head's estimate, which can be wrong. It is also the right basis for a non-omniscient LLM controller.
- **Plain saved state and determinism**: `plan.day` saved; no determinism repairs in the record.
- **The inhabited-pawn test** (VB-169: an unplayed and a played-but-idle run hash equal). It is the strongest parity test in the repository; its coverage should grow with every change here.

## 8. Options

**A. Repairs within the present shape.** Fix VB-1548 and VB-1597. Check and, if confirmed, fix the `askFor` and `voice` skips to follow the switch. Make `wish` and `propose` verbs. Land the player-only allow-list test. Bring target-v2 4.5 and section 8's hours up to date; give the player's plan a row in section 7. *Cost*: about six S tasks and a design note. *Risk*: low. *Relieves*: strains 4 and 7 in part; names the parity gaps without closing them. *Does not relieve*: 1, 2, 3.

**B. A controller per pawn (state and API parity).** Move queue, switch and authored list from `st.player` to the pawn; key the `Sim` planning API by pawn; `st.player` becomes the frame. Shared rules still read "this household's authored plan", but through the plan, not through `st.player`. *Cost*: one M plan and perhaps five M tasks; a save migration; 37 files touched, most by one line. *Risk*: moderate and mechanical; `tools/same.js` can show unplayed behaviour unchanged. *Relieves*: the singleton rows of the table; makes an LLM-driven pawn possible in principle; honours the 24 November sentence. *Does not*: unify the two planners; an unplayed head still has no authored steps.

**C. One plan, several authors (planner parity).** The household plan gains explicit steps. `CHAINS` and project steps become one mechanism. The automatic head becomes a producer of steps through the same verbs (`project` already works this way at `aims.js:189`). The branches in chores, building, ladder, projects and camp collapse to "is there a step in this plan". A design pass first: this revises Decided rows of section 7. *Cost*: a slice; the behaviour of unplayed heads changes, so targets move and Kim must start the measurement. *Risk*: high on balance (VB-1653 to 1666 show each such unification moved test days), moderate on cost if the head's producer runs on planning day. *Relieves*: strain 1 fully, VB-1472 by construction, much of the special-case list.

**D. Tasks only by choice (finish "nothing is posted").** `st.jobs` holds only tasks a plan took; opportunities are computed and cached per holder. The allotment weighs chosen tasks, a smaller set. *Cost*: the largest; it touches `refreshJobs`, `allot`, the opportunity view and saves. *Risk*: VB-1564 is direct evidence that naive caching hurts households. *Relieves*: strains 2 and 3 at the root. Sensible only after C, since C supplies the chooser.

**Recommendation.** A now. B next, as the smallest change that makes the code agree with the principle already decided, and because it is behaviour-preserving for unplayed pawns. C as a designed slice, begun with the design pass and with VB-1472 folded in rather than answered alone. D deferred until C shows what the allotment still costs. The alternative worth weighing is to skip B and go to C directly: less rework of the API, but a long period in which the principle and the code disagree and every new plan task adds another mirrored rule.

## 9. Questions for discussion

1. **Is the played pawn's plan the same structure every head has?** Proposed: yes, one plan with steps, authored by rule or by hand (option C). It decides whether the 24 November work is a prototype of the model or a side path.
2. **Per pawn or per household?** The player's list is one pawn's; the head's plan is a household's. Proposed: both levels exist. The household plan holds steps and targets (the head's); each pawn has an ordered list (today `plan.day.lists[pawn]`), which the head allots and the pawn, if un-planned, may author for itself. It settles who allots the other members while the player plans by hand: the head's rule does, unless the player is head and edits.
3. **Is "automatic off" a property of any pawn?** Proposed: yes, per pawn, default on. It is what an LLM controller needs and costs nothing when unused.
4. **What is the player's edge?** Section 1 says "foresight and attention", and also that the future is only someone's estimate. Proposed: the edge is planning depth over the same estimate, never extra knowledge; so views show the pawn's estimate and the actor view stays the single place to restrict knowledge.
5. **May an unplayed head keep several large projects (VB-1472)?** Proposed: yes, ranked by its values and bounded by the hours of its plan, decided as part of C. Until then the asymmetry is a documented exception.
6. **Should hand-authored steps stand against the head's rule, and for how long?** Proposed: a named step stands until it fails or is renamed, as `ground` already says (section 7, The player). It generalises `plan.day.edited`.
7. **Does the board stay?** Proposed: yes for now; say so in target-v2 ("opportunities are materialised as tasks at review; nobody posts") and revisit with option D. The alternative is to commit to D and stop tuning the allotment's cost meanwhile.
8. **Is a played head on automatic meant to ask for help by itself?** Proposed: yes, by the section 15 rule; then `hands.js:200` should test `unplanned`, not `st.player.pawn`. A small question that tests whether the rule is meant literally.
9. **Is determinism under an external controller a goal?** Proposed: record controller commands as inputs, as a later task; needed for replays and for any measurement of an LLM-played village.
10. **What budget does the work system get?** Jobs and matching take 75 ms of a 200 ms day on populous-small. Proposed: name a share (say a third) in `docs/cost.md`, so allotment changes are judged against a number.

## 10. Verification log

| Claim | Source | Result |
|---|---|---|
| Jobs are posted and stored; `modules.md` calls `sim/jobs` "the job board" | I 1, D 7.1 | Confirmed: `jobs.js:31-58`, `jobs.js:80-83`; `modules.md:460` |
| Target-v2 says "Nothing is posted" and keeps "the two-hour rule" | D 7.1, 7.2 | Confirmed: `target-v2.md:38`, `:63`, `:610` |
| 94 kinds, 51 fields, 9 required | I 5 | Confirmed by loading `Sim.KINDS`; identical tally |
| Jobs refresh and matching is 44% (75 ms a day) | I 7 | Confirmed by rerun: 7,222.9 ms of 16,413.5 ms; 75.24 ms a day |
| 45%, 49 of 109 ms (VB-1554) | H A | Not re-measured; a different run. Compatible in share |
| "≥12 modules read `st.player`" | I 8 | Undercount: 37 files in `src/sim`; `unplanned` in 16 |
| `unplanned` is the planner's gate | I 6 | Confirmed: `records.js:778-781`; `fit.js:58`, `clock.js:751` |
| Day verbs issued only for the player | I 4 | Confirmed: `day.js:469,493,540`; `player.js:393-395`; page only |
| Fell job posted only for the played household's plan | I 6 | Confirmed: `chores.js:33-37`, `:154-158` |
| `heldOff` suppresses the head's projects when the player is off automatic | I 6, H 3 | Confirmed: `projects.js:104-110` |
| `building.played()`, `ladder` `hand ?` branches | I 6 | Confirmed: `building.js:72`; `ladder.js:273,283` |
| `askFor` skips the player | I 6 | Confirmed, with a nuance: skips any played head, whatever the switch (`hands.js:200`); effect on the idle-player test not run |
| `wish`, `propose` are not verbs | I 6 | Confirmed: plain functions, `player.js:150,176` |
| Verbs are open to any source | D 5, I 6 | Confirmed: six `sources:` restrictions among about 70 registrations; one is `['player','pawn']` (sleep) |
| Actor view filters nothing | I 6 | Confirmed: `opportunities.js:34` |
| Principle text: `st.player` holds only the frame | D 5 | Confirmed: `design.md:170-177` |
| "A manual and an automatic plan meet is for later"; agenda assumes own hands | D 5 | Confirmed: `HANDOFF.md:20`, `:60`, `:137` |
| Slot-in "still unbuilt" | H F | Wrong: VB-1558 done 24 November; `slotIn` in `sim/day` |
| VB-1548 ready P1; 1597 ready; 1564, 1585 needs-review; 1472 blocked on Kim | H 5 | Confirmed with `tools/backlog.js show` |
| `islandJob` names kinds literally | I 5 | Confirmed: `jobs.js:62` |
| `sim/agents` is 717 lines, "slightly over" | I 8 | 717 raw lines confirmed; not in the lint baseline; whether the lint counts it over 700 not checked |

Not verified, taken from the reports: the per-task quotations in H (task files not opened beyond their headers), the `ASK` rule count of about 45, the special cases in `fit` and `agents` other than those listed above, and D's reading of documents other than the lines quoted here.

**Addendum to the verification log** (the session, after the overview): `src/sim/hands.js:200` returns early when
`st.player.pawn === h`, whatever the automatic switch; `src/sim/voice.js:209`, beside it, asks `unplanned(st, hh.holder)`, which is the
gate the rest of the planner uses (`src/sim/records.js:778-781`). So question 8's asymmetry is confirmed by reading: a played head on
automatic with an empty queue does not ask for help, where an unplayed head would. Not run: whether `tests/player.js` (the
inhabited-pawn hash test) reaches a day with help short, which would show why it has not caught this.

## 11. Against the review of 15 November

`docs/review-jobs.md` asked whether to rethink the job system and proposed A (two fixes), B (the head's day) and C (work as scheduled
blocks); Kim chose B first, C in scope. What has become of it, read against today's findings:

| 15 November | Since | Today's review |
| --- | --- | --- |
| A: the fishing ground found once; the idle stroll cheaper | Done, VB-467, VB-468 (15 Nov) | Not mentioned: settled |
| B: the head's day replaces the auction | Done, VB-466 (15 Nov); slot-in VB-1558; the day's verbs in `sim/day` | The day list is the one shared planning state (section 6, "Day list"); the allotment is the cost and tuning centre (strain 3) |
| B, step two: help as an ask | Done, VB-470 (23 Nov) | Built, with one parity defect (`hands.js:200`, the addendum above) |
| B: "the matcher's leftovers" removed | No task by that name; the join factor stayed by design (15 Nov, section 9) | Core code still names `j.plot`, `j.claim`, `j.common` and kinds by name (strain 6) |
| C: work as scheduled blocks | Mock, then VB-469 to VB-474 (15 and 16 Nov) | Held up: legs and closed-form progress are among the best parts (section 7); only the rare exits leak (strain 4, VB-1548) |

Three things that comparison shows:

1. **C worked and B did not lower cost.** 15 November already found B "not cheaper" (its section 9). Today the jobs line is 44% of
   simulation time against the stepping's 20% then; the two runs differ, so the shares are not a trend, but choosing work is now
   plainly the largest cost, where on 15 November executing it was. The 15 November mock had pointed at this: "the reviews'
   availability asks (20.8%) are a larger item". Today's strain 2 (opportunity and task are one stored record) is the same item,
   reached independently from the design side.
2. **The record's hooks were expected to fall away, and doubled.** 15 November counted some 25 optional hooks on a kind's record and
   read most of them as "bending an hourly auction into something a head would simply have said in the morning". After B the record has
   51 fields, 9 required (today's verification log). The kinds added since (water, leather, byre, salt, textile) explain much of the
   growth, but the four priority branches and the kind-name checks it named are still in core code. The prediction did not hold; the
   hooks are now the price of kinds as records, not of the auction.
3. **Today's central finding was not visible then.** On 15 November the player's lever was to be "a verb at the grain of a household"
   (reorder, reassign), and that is what was built (`dayOrder`, `dayGive`, `dayCall`). The player's own authored plan arrived on 24
   November, after it, and with it the second planner that today's review ranks first. Two of 15 November's rejections bear on today's
   options: it rejected "a general planner (GOAP, HTN) for the head", in favour of the template of the year, and "removing the board",
   since village work, plots and help have no one head. Today's option C (one plan, several authors) is compatible with the first only
   if the automatic head's steps come from the same template and rules as now, not from a search; today's option D (tasks only by
   choice) reopens the second, and would need an answer for the work that no one head chooses.
