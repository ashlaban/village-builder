# Answered questions

Questions from `QUESTIONS.md` that Kim has answered, kept as the record behind the task files and `design.md`. Each section keeps its questions, the proposed answer (**P:**) and Kim's answer (**A:**) as they stood when answered; the task files hold what was decided. A question moves here, unchanged, once it is answered; newer archives go on top. `node tools/questions.js archive` makes the move.

# Archived 8 November 2026 (VB-182)

## VB-182: kin help, booked as goodwill (raised 8 November 2026, the plan of slice 1)
Slice 1 re-expresses help in hunger (`src/sim/help.js`, `shareFood`) through the target's pieces: the gift as Exchange's first mechanism, moving grain through `sim/stores`, its customary worth booked as goodwill between the two holders, and accepted by the floor and `allowance`. Today a kin household gives what lies above its seed reserve and its holder's buffer (20 to 60 days of the household's need, drawn per pawn), and the two holders' ties (familiarity, not opinion) gain 0.5 each way; the village store gives the rest and books nothing. Measured over a year (fixtures at `4ee11e9`, stale but usable): 33 to 75 gifts between holders at populous small (350 to 420 living), 163 among 129 pairs at `small-y40` (729 living), 486 among 364 pairs at `medium-y60` (2,531); a gift is about 22 rations; no pawn had more than 9 counterparts over 8 years. Question 2 takes over VB-039's first question (a gift as a memory).
1. Goodwill's unit and decay. **P:** customary rations, grain worth 1 a unit (the only good given in slice 1; worth as a norm, `Culture.norm('worth')`, comes with slice 4). A signed balance per pair that has dealt, with the time it was last booked and the time it was opened; it decays with a half-life of 4 years, read in closed form; a balance under 1 ration is dropped at the seasonal pass over relationships; at most 32 counterparts a pawn, the smallest balance dropped to make room.
   **A (Kim, 8 Nov):** as proposed (P).
2. The curves coupling goodwill to opinion (the culture's; one set of values for every culture for now). Today a gift raises familiarity only. **P:** the tie gain stays. The debtor's opinion of the creditor gains gratitude, +0.15 × s / (s + 20) for a balance of s rations (a gift of 22 rations: +0.08; never above +0.15), fading linearly to 0 between 2 and 5 years after the balance opened. The creditor's opinion is untouched for 2 years, then sours by up to −0.05 × s / (s + 20) at 5 years: an old debt unpaid. These replace VB-039's proposed memory "A gift of food".
   **A (Kim, 8 Nov):** as proposed (P).
3. Does goodwill act in slice 1? The roadmap's "done when" (section 3.1) says the golden file changes for the booking only, so goodwill would be read only by the panel. **P:** as the roadmap says: booked and shown in slice 1; the curves (2) and allowance's goodwill term (5) designed now and switched on in a task of their own at the head of slice 4 (the fair, where swaps need them), with numbers before and after. The other way: a third implement task in slice 1.
   **A (Kim, 8 Nov):** as proposed (P).
4. The floor. **P:** the seed reserve and 20 days of the household's need (today's lowest buffer). The rest of today's buffer, the holder's own 0 to 40 days more, becomes allowance's `reserve` (5), a stand-in for generosity until traits (slice 7); together they give today's rule exactly. The player's pawn may go below the floor, with a warning that names who goes hungry (Kim, 3 Nov); that warning is slice 2's page work.
   **A (Kim, 8 Nov):** as proposed (P).
5. `allowance`'s contributions and their ranges: a sum in rations, clamped at 0 below, owned by `sim/relations`, from the giver's agent toward the receiver's. **P:** `slack` (`sim/hunger`): the giving household's grain above its floor, 0 or more. `reserve` (`sim/help`, until traits): minus the holder's buffer beyond 20 days, times the household's need; from −40 days of need to 0. `goodwill` (`sim/relations`, switched on when 3 says): plus what the giver owes the receiver, minus what the receiver owes beyond 30 days of its household's need. No kinship term yet, since kin are whom help asks and all kin give alike today; it comes when help reaches beyond kin (VB-106). No custom term until a custom of helping exists.
   **A (Kim, 8 Nov):** as proposed (P).
6. Whose goodwill: the village store, households without a holder, and handovers. **P:** the store's gifts and the yearly filling book nothing until the village has an agent (slices 3 and 5); a household without a holder books nothing. At a handover (retirement or a holder's death, `sim/heirs`), half of the old holder's balances pass to the new holder and a retired holder keeps the rest (Decided: a share, set by custom; one value until a custom holds it). Other deaths end the pawn's balances until slice 5's `PersonalEstate`.
   **A (Kim, 8 Nov):** as proposed (P).
7. What the pawn panel shows. **P:** under "Knows best", up to 5 balances by size: "Owes Erik Larsson 34 rations" or "Is owed 12 rations by Anna Persdotter", with the last booking's reason and year ("help in hunger, year 12"). On a holder's panel, each row also says "would give up to N rations", with `explain(allowance)`'s parts on hover.
   **A (Kim, 8 Nov):** as proposed (P).

# Archived 8 November 2026 (VB-079, slice 2's plan)

Asked by VB-079 in the session Kim started on 7 November and answered there, in the app, late on 7 November and early on 8 November.
Recorded in the slice 2 tasks (VB-169, VB-208 to VB-215, VB-078), `design.md` (Vision and scope, section 15) and `docs/roadmap.md`
(section 3.2). Kim's answers are quoted as given.

## VB-079: a life, the player inhabits a pawn (raised 7 November 2026)
Measured that day on the fixtures (all stale golden hash): a save takes 1.09 s at medium-y5 (budget 0.5 s); `recordOf` for one
holder takes 1.76 ms at small-y40; at 30× a game day lasts 1.6 s.
1. When the player inhabits a pawn and gives it no command, who chooses its work? **P:** the planner chooses for it as for anyone; a
   player's command takes precedence until done; a "Hold" toggle (VB-076's control) makes the planner leave it alone until released.
   **A (Kim, 7 Nov):** "So the player input should be that they can override the pawns own agency, primarily through queueing commands
   that gets priority before the pawns own logic. But if the player-controlled pawn is left to it's own device it should fall-back to
   an appropriate automatic behaviour for its role. The player should have the option to toggle automatically behaviour off."
2. How does the inhabited pawn's answer count at the yearly meeting? **P:** a ballot: for each custom it answers, its whole weight
   (voice × prestige) on the chosen option, at that sitting only.
   **A (Kim, 7 Nov):** advocacy only.
3. Autosave at each moving round would freeze the page for about 1.1 s at medium-y5 until VB-199 and VB-204. **P:** build saves now
   (to file, from file, IndexedDB keeping the last 3, autosave when the page is hidden, a Save button); autosave at the moving round
   once a save at `medium-ref` is under 0.5 s.
   **A (Kim, 7 Nov):** P.
4. Which ambitions should the first version offer besides the line's prestige? **P:** hold three farms, change a custom, hold land
   after service, found a village.
   **A (Kim, 7 Nov):** "The ambitions system is tentative (that they should be inside the game is not my idea, but from an agent). It
   feels to me this can be postponed to late in the design (nothing else depends on it)."
5. With the automatic behaviour off and nothing queued, what does the pawn do at dark (the end of work)? **P:** it goes home, since
   needs go on for every pawn.
   **A (Kim, 8 Nov):** "Goes home unless the players commands otherwise. If there are no commands, it follows its usual automatic
   behaviour."
6. The moving round decides claims on empty farms, service and moving out. When the player queues one of these acts, when does it
   happen? **P:** kept as the player's wish and done first at the next round, if its check passes then.
   **A (Kim, 8 Nov):** "The same rules should apply to player controlled pawn as to other paws to the extent possible."
7. What say does the player have over its pawn's marriage in slice 2? **P:** none until courting (VB-036, slice 7); the round matches
   the player's pawn as anyone.
   **A (Kim, 8 Nov):** P.
8. Saves: decided on 30 October, "the whole world is saved" and "a save from another build is refused"; VB-074 regenerates the world
   from its seed and refuses only by a hand-kept format number, and saving the whole world would add 14.3 MB at medium. **P:** each
   save names its build (a hash of `src/` written by `build.py`); a save from any other build is refused, with the message and the
   button to delete it and start a new game; within one build the world regenerates exactly, so the save stays small.
   **A (Kim, 8 Nov):** P.

## VB-169: take control (raised 2 November 2026, writing the commands tasks)
Answer 3 to VB-076 says the planner leaves a controlled pawn alone until released. One detail is open.
1. Does a controlled pawn still eat and go home at dark? **P:** yes: needs go on as for any pawn (it eats, and at dark, when no command of the player's is under way, it goes home); only the choice of work and of idle walks passes to the player. Otherwise a pawn left in control overnight would stand in a field until it starves.
   **A (Kim, 8 Nov, VB-079's question 5 above):** "Goes home unless the players commands otherwise. If there are no commands, it follows its usual automatic behaviour."

# Archived 7 November 2026 (review of the work since 3 November)

Asked in the review session of 7 November and answered by Kim there. Recorded in VB-202 and VB-203, in `docs/roadmap.md` (section 5.2), `design.md` (Performance budget) and `AGENTS.md` (Rules for cost).

## The late reference and the budget's basis (raised 7 November 2026)
From the review of the 22 commits since 3 November: the `medium-y60` fixture holds 2,492 living, against the decided "about 1,000", and the mean budget of 160 ms rests on "30× at 10% of a core".
1. Should a balance loop hold populous medium near 1,000 living, or should the reference change, for example to the year populous medium reaches about 1,000?
   **A (Kim, 7 Nov):** the reference can change to the year it reaches 1,000; the balance loop is continually being worked towards.
2. Is "30× at 10% of a core" the real requirement?
   **A (Kim, 7 Nov):** not from Kim; it came from an agent, and may be changed.

## VB-203: the budget re-derived (raised 7 November 2026, review of the work since 3 November)
Kim decided on 7 November that the late reference is the first year populous medium reaches 1,000 living (VB-202), and that the budget's basis, "30× at 10% of a core", was an agent's proposal and may be changed (`QUESTION_ARCHIVE.md`). Measured that day (VB-203's file has the full table):
- at year 5 (880 living) a game day costs 176 ms;
- at 1,000 living (year 13 today) about 230 ms;
- at year 60 (2,492 living) 652 ms;
- the cost per living pawn-day rises from 0.16 ms in year 1 to about 0.26 by year 16, and is still about 0.26 at year 60.

The answers let VB-203 write the budget and its closure table.
1. What should the mean budget rest on? **P:** 30× stays smooth on a player's laptop once every slice is built. At 30× a game day lasts 1.6 s; the simulation may take at most a quarter of the page's main thread, which is 400 ms a game day at the late reference. The systems built so far may use half of that, 200 ms, and each later slice's plan claims its line from the other half (roadmap, section 2, point 5). The 400 ms ceiling of 3 November becomes the target for the finished game. It is measured in the container as today; VB-166 (frames in headless Chromium) checks the quarter once it runs.
   **A (Kim, 7 Nov):** P.
2. Where is the history ratio measured? With the late reference early in a run (year 13 today), year 60 against year 5 no longer measures it. **P:** on `small-y40` against `small-y5`, at most 1.25 times, as VB-088's history check already does for the counters; reported nightly on `medium-y60` against `medium-y5`.
   **A (Kim, 7 Nov):** P, with the rationale given in the session (recorded in VB-203's notes).
3. What becomes of `medium-y60`, now 2.5 times the reference? **P:** a stress fixture, reported nightly and never gating, whose mean line is twice the reference's (3 November: "a large map may reach about 2,000 at half the speed"). Its temporary 400 ms step allowance (VB-196) then ends: the 60 ms step limit is asserted on `medium-ref` and `small-y40`.
   **A (Kim, 7 Nov):** P.
4. Save and load? **P:** unchanged: 0.5 s each, now at `medium-ref`. VB-199 (bounded history) and VB-204 (ledgers folded) aim at it there.
   **A (Kim, 7 Nov):** P.

# Archived 3 November 2026 (the roadmap)

Answered by Kim in the session of 3 November; recorded in `docs/roadmap.md` and the slice archs of `BACKLOG.md`.

## Architecture review: the vision and the first steps (raised 3 November 2026) (questions 5 and 7)
From the architecture review (`docs/review-architecture.md`; ChatGPT's three documents are in `docs/architecture/`). Kim adopted the review's vision on 3 November: the player inhabits a pawn and lives a life the game does not prescribe, in a society that grows to towns, institutions and a wider world. Questions 1 to 5 settle the text for `design.md` (the review, section 3) and VB-079; questions 6 and 7 concern the new `ownership` arch (VB-172, VB-173). Questions 1 to 4 were answered on 3 November (`QUESTION_ARCHIVE.md`): the vision's text approved as written.
5. What a pawn knows. **P:** unchanged for now: all know all, fathers included (Decided 30 October), and an Open question in `design.md` as proposed. Knowledge with a source comes first where it changes a choice: prices at another fair, news brought by a ship.
   **A (Kim, 3 Nov):** P: omniscient for now; slice 2 builds the actor view as a seam that filters nothing until stories (slice 7); an Open question in v0.4.
7. The feature freeze. Its condition was met on 2 November, but the paragraph in `BACKLOG.md` still stands. **P:** strike it now. Its foundations are in, and the review asks only that refactors wait for Kim's review of the map, not features; until VB-173 lands, a feature task that writes household food or membership says so in its impact note. Keeping the freeze until the map is reviewed would spare the first refactor some merging, at the cost of a pause in the growth and animals tasks.
   **A (Kim, 3 Nov):** P: lifted; the slice order governs.

## Target architecture v2: decisions waiting (raised 3 November 2026) (question 3)
From `docs/architecture/target-v2.md`, section 10.1. None blocks slice 0, 1 or 2; each is needed by the slice named.
3. May the player accept a deal that takes its household below the floor that binds every pawn (needed in slice 2)? **P:** yes, with a warning that names who goes hungry; the floor is a rule of how pawns choose, not a law of the world, and the player choosing badly is no privilege.
   **A (Kim, 3 Nov):** P: yes, with a warning that names who goes hungry.

## Roadmap: vertical slices, the late game and `design.md` v0.4 (questions 3, 5 and 6)
From `docs/roadmap.md`; questions 1, 2 and 4 are below.
3. The budget (roadmap, section 5.2). **P:** at a late reference (populous medium at year 60, a saved fixture): 160 ms a game day (30× at 10% of a core), no 6-minute step over 50 ms, cost per living pawn-day at year 60 at most 1.25 times year 5, save and load under 0.5 s each.
   **A (Kim, 3 Nov):** P, as proposed.
5. Work counters (roadmap, section 6): deterministic counts of work done, kept in `VB.count` outside `st` and asserted at tiny scale in `npm test`. **P:** yes, with one lint allowance; counters never feed the simulation.
   **A (Kim, 3 Nov):** P: yes, with one lint allowance; counters never feed the simulation.
6. The ten rules for systems (roadmap, section 5.3) into `AGENTS.md`'s working rules. **P:** yes.
   **A (Kim, 3 Nov):** P: yes; they are in `AGENTS.md`, Working rules.

## Architecture review: the vision and the first steps (raised 3 November 2026) (questions 1 to 4)
From the architecture review (`docs/review-architecture.md`; ChatGPT's three documents are in `docs/architecture/`). Kim adopted the review's vision on 3 November: the player inhabits a pawn and lives a life the game does not prescribe, in a society that grows to towns, institutions and a wider world. Questions 1 to 5 settle the text for `design.md` (the review, section 3) and VB-079; questions 6 and 7 concern the new `ownership` arch (VB-172, VB-173).
1. The player role: write the text proposed in section 3 of the review into `design.md`, in place of the family line Decided on 30 October? **P:** yes, as written; VB-079 then writes the player arch's tasks from it, after VB-169 (take control) and VB-077 (saves in the page).
   **A (Kim, 3 Nov):** P: approved as written; VB-191 writes it into `design.md` v0.4, and VB-079 plans slice 2 from it.
2. Which pawn does the player inhabit? **P:** at the start, any living adult, chosen from the pawn panel; each scenario suggests one (a holder in founders and heirs). After a death, the player chooses from the pawn's kin by blood or marriage, its household and its close ties, with the heir first in the list; if none is alive, any adult, and the chronicle marks the break. The rule of 30 October ended the run there; an open life should not end with one family.
   **A (Kim, 3 Nov):** P.
3. The score. **P:** no fixed score. The player picks ambitions, each with its progress in the chronicle (VB-099): hold three farms, change a custom, found a village, become a master household, leave service and hold land; the line's prestige over time is one of them and the default. Ambitions are read from the state and the record of events and grant nothing.
   **A (Kim, 3 Nov):** P.
4. The scale of society: add the row proposed in section 3 (the pawn, the household, the settlement, the region, and the world beyond, abstract until its people arrive)? **P:** yes. The cities review's phases become the road to the vision, so its questions ("Towns", Priority 2 below) are the next design decisions worth answering.
   **A (Kim, 3 Nov):** P: yes; the row goes into v0.4's Vision and scope (VB-191).

## Roadmap: vertical slices, the late game and `design.md` v0.4 (raised 3 November 2026) (questions 1, 2 and 4)
From `docs/roadmap.md`, written when Kim made `docs/architecture/target-v2.md` the architecture reference. The answers set the order of work and let the backlog be rewritten as slices, one arch per slice.
1. The slices and their order (roadmap, sections 3 and 4): 0 the yardstick; 1 kin help, booked, beside 2 a life; then 3 the household's year, 4 the autumn fair, 5 debt and land, 6 the mill and the loom, 7 talk travels, 8 the ship, 9 the town, 10 roads, boats and ice. **P:** as proposed; slices 1 and 2 in parallel; the gossip experiment from slice 0 on.
   **A (Kim, 3 Nov):** as proposed (P).
2. The late game's size. `design.md` says "up to about 1,000 pawns simulated in full" (Decided), but populous medium starts at 807 and grows about 2% a year, so it passes 1,000 by about year 12 unless a loop holds it. **P:** about 1,000 living on medium is the budget's reference; a large map may reach 2,000 at half the speed.
   **A (Kim, 3 Nov):** P: about 1,000 living on medium is the budget's reference; a large map may reach about 2,000 at half the speed.
4. `design.md` v0.4 (roadmap, section 7). **P:** keep v0.3 unchanged as `docs/design-v0.3.md`; one skeleton pass now (the vision, the new section list, v0.3's points carried over, target-v2's changes marked "Under revision"); each slice's plan task then writes its own sections.
   **A (Kim, 3 Nov):** P: v0.4 as a skeleton now, filled in by each slice's plan; v0.3 kept unchanged.

# Archived 3 November 2026 (VB-172, the ownership map)

Answered by Kim in the session of 3 November; the tasks are VB-173 to VB-180.

## VB-172: the ownership map (raised 3 November 2026)
VB-172 has mapped who writes each piece of state, the dependencies and the candidate boundaries: `docs/architecture/ownership.md` (rerun with `node tools/writes.js`). In short: tile owners have one writer; household food has ten writer modules and leaves no record of seed, meals, spoilage, shares or provisions; household membership has five, and three places found a household with copies of the same steps; four dependency cycles run through lookups of later modules. The refactors and VB-173 wait for these answers; the plan then writes the arch's tasks.
1. Which boundaries first, and in which order? **P:** the ranking of the map, section 7: household and village food (7.1), then membership and founding (7.2), then agent movement (7.3) and ties (7.4), both small and wanted before VB-169 and VB-127, then the crop's life (7.5). The others (other stores, farm occupancy, land use, herds, the job store) wait until a task touches them. One refactor task per boundary, run one at a time and not beside the food and growth tasks, since they edit the same files.
   **A (Kim, 3 Nov):** P: food (VB-174), membership and founding (VB-175), the dependency rule (VB-176), agent movement (VB-177), ties (VB-178), the crop's life (VB-179); the rest wait for a task that touches them.
2. Who owns household and village food: a new module or an existing one? **P:** a new module, `sim/stores` (about 80 lines), loaded after `sim/records` and before `sim/hunger`. It holds the operations put, take, move, cook, sheaf and thresh, which check the amounts and say why. The rules stay where they are and call it: meals and the feed order in `sim/hunger`, gifts in `sim/help`, shares in `sim/heirs`, spoilage in `spoilGrain`. Neither hunger nor help is a natural owner, and Resources is the one domain with state and no home (the review, section 2).
   **A (Kim, 3 Nov):** P: a new module, `sim/stores`.
3. What does the first refactor leave unchanged? **P:** behaviour. `tests/golden.json` stays unchanged, the ledger records what it records today, and nothing is renamed (the refactor rules). A later task, which changes behaviour on purpose and re-records the golden file, adds a ledger entry for every movement of food (seed, meal, cooking, spoilage, share, handing on, provisions), so a household's balance can be read from its ledger (VB-092, `tools/balance.js`); it measures what the entries cost.
   **A (Kim, 3 Nov):** record every movement now, in the food task itself (VB-174), which therefore changes behaviour on purpose and re-records the golden file; only the ledgers may change in it.
4. How is an owner declared (for VB-173)? **P:** one table, `src/owners.json`, keyed by the fields as `tools/writes.js` names them (`household.grain`), with `signal` for page flags, the seeding modules as creators and the save codec exempt (the map, section 8). One `@state` line documents a whole record, so an owner per field does not fit there. VB-173's check is the scan plus a lookup in the table, with a baseline that only goes down. The alternative is one `@state ... (owner ...)` line per owned field.
   **A (Kim, 3 Nov):** P: one table, `src/owners.json` (VB-173).
5. The page flags (`st.visualDirty`, `biomeDirty`, `rigDirty`, `treeDirty`, `pathDirty`, `landDirty`; 16 writer modules). **P:** declare them as signals that any module may set and only the page clears; leave them out of the check. Nothing in the simulation decides on them.
   **A (Kim, 3 Nov):** P: signals, outside the check.
6. Dependencies. **P:** an import at load goes only to a module loaded earlier, and the only lookup into a later module is `issue` (and the verbs' own `later()`). Founding a household becomes one act reached by a command (the map, 7.2), and the round passes `startPlots` who may claim a farm; that ends the four cycles or turns them into calls through the command layer. `tools/writes.js` lists every lookup, so a check can follow once the refactors are in.
   **A (Kim, 3 Nov):** P: only `issue` (and the verbs' `later()`) reaches a later module; a check follows (VB-176).
7. The rules held in `sim/clock` (ripening, weeding, frost, decay of empty farms and fences, firewood use, the village store's spoilage). **P:** each moves out with the boundary that owns its state (crop's life to `sim/fields`, empty farms to `sim/farmclaims`, fences to `sim/kinds`, firewood and the store to `sim/stores`); no task of its own. The clock keeps the order of the day.
   **A (Kim, 3 Nov):** P: each moves out with the boundary that owns its state; no task of its own.

# Archived 2 November 2026 (review, second pass)

Answered by Kim in the session of 2 November.

## Review, 2 November, second pass: where to spend Kim's answers (question 1)
1. Which to answer first? **P:** VB-127 (talk is 37% of a game day; ties from talk, capped at 150 a pawn, is the fix); then VB-129 (close it, which unblocks the speed budget VB-088); then the tuned values of moving to new land, balance and stability, which are all "keep" (one "P to all" settles each block, and VB-130 with the balance block).
   **A (Kim, 2 Nov):** after the page split (VB-053), the foundations first (VB-072 to VB-076), then the growth path; VB-127 yes; VB-129 closed; the tuned-value blocks to be gone through one by one.

## Stability review: the tuned values (raised 1 November 2026)
The stability review (`docs/review-stability.md`) built Kim's decisions of 1 November in VB-151 to VB-154; the values below are in the code as Proposed. Numbers are means over six long runs (populous small, seeds 7 and 42, 60 years; tiny, seeds 3, 7, 11 and 42, 80 years), before and after.
1. The means to marry. At a year of food the check seldom bound (the moving round falls just after the harvest); at a year and a half, with homes of fewer than two adults exempt, deaths from hunger fell by about 45% against the baseline and women marry 2–3 years later, while households of one fell from 16–24% to 6–9%. **P:** keep `MARRIAGE.means` 1.5 and the exemption.
   **A (Kim, 2 Nov):** keep (P).
2. Service for the lone. **P:** keep `SERVICE` (unmarried adults of 18 to 50, from a household that keeps 2 working hands, from the holder's village or one within 15 steps); VB-090 adds the general rule by hands per field later.
   **A (Kim, 2 Nov):** keep (P).
3. Farms left empty by the orphan rule. With no landless relative to be guardian, the children go to kin and the farm stands empty (as decided): 11–30 farms over 60 years at tiny seeds 3 and 7, holding 3–6% of the farmable land, against 1–3 before. Nothing takes them up until claims exist, so the land in use rose (25% at year 60 against 21%) although villages lie farther apart. **P:** raise VB-033 (claiming an empty farm) to priority 1; until then, a farm emptied this way goes to the landless adult of its village who has waited longest, as a farm left by a holder who marries away does (VB-153).
   **A (Kim, 2 Nov):** overtaken: VB-033 (claiming an empty farm) was answered and built on 2 November.
4. Spacing. The nearest village is 13.5–15.9 steps away in every decade (falling from 14.5 to 7.9 before). **P:** keep `SETTLE.apart` 5, `SETTLE.centreApart` 12 and `FIELDS.room` 6.
   **A (Kim, 2 Nov):** keep (P).
5. Late marriage. Almost every woman still marries. **P:** nothing more now; service in other households (VB-090) and courting (VB-036) are where the north-west European pattern of late marriage and celibacy should come from.
   **A (Kim, 2 Nov):** nothing more now (P).
6. The design. **P:** record in `design.md` at the next design pass: one map label for a village of two or more farms, and a lone farm's village named for its farm; two people with a place may marry, and the farm left behind is handed on; the means to marry; a guardian for an orphaned heir and a servant for a lone holder; the spacing of new villages and the room of a new farm.
   **A (Kim, 2 Nov):** done in the review of 2 November (design.md, Households short of people).
7. Speed. **P:** raise VB-127 (familiarity from talk, at most 150 ties a pawn) to priority 1: the social model is most of a late game day, and ties per pawn grow with the village.
   **A (Kim, 2 Nov):** priority 2, after the page split and the foundations, with the speed budget VB-088 before it (VB-127 answered the same day).

## Balance review: the tuned values (raised 1 November 2026)
The balance review (`docs/review-balance.md`) built milk, manure and oxen and tuned the food balance; the values below are in the code as Proposed. Numbers are from `tools/balance.js` over 4 seeds.
1. Fields by labour (your rule: no fixed cap). **P:** a household wants fields for 1.1 times its rations at three quarters of the full yield, but no more than 2 a working adult (14 to 59, not retired) and 1.5 more with a team of oxen (`FIELDS` in `src/sim/rules.js`); every scenario makes fields and meadows; heath, hills or marsh only when no meadow is free.
   **A (Kim, 2 Nov):** keep (P).
2. Grain spoils in store. **P:** 5% a year of the first year's need held, 20% of the second, 40% of the rest; the village store 20% a year (`ECON.storeLoss`, `ECON.villageStoreLoss`).
   **A (Kim, 2 Nov):** keep (P); VB-130 is done.
3. Haymaking to need. **P:** rake and mow only while the barn and the hay lying mown hold less than 2 winters' need of the animals now; none without animals.
   **A (Kim, 2 Nov):** keep as built, but hay spoils too: in tiers like grain, 5%, 25% and 50% a year by winters of need held (VB-159).
4. Manure. Built: the heap loses half a year and carting goes before the hoe (urgency 1.7). With +0.04 a load, 1.5 head of cattle keep 3 fields at full strength and more cattle add nothing to the corn; +0.02 (about 3 head) makes herd size show in the harvest, as dung was scarce in history, but cost about a quarter more hungry days over 8 seeds. **P:** keep +0.04 now; revisit with herding (VB-136) and food from the wild (VB-117, VB-118), when farms have more slack.
   **A (Kim, 2 Nov):** +0.04 now (P).
5. Remarriage. **P:** a widowed partner's age gap counts half (`MARRIAGE.widowedGapWeight` 0.15).
   **A (Kim, 2 Nov):** keep (P).
6. Meat. History puts a small medieval cow's meat at about 9 rations; the game has 15. With milk in, a cow alive gives 15 to 32 rations a year (milk, a calf, and dung while the fields need it), so the carcass is worth about a year of her life either way. **P:** keep 15 (it stands in for the offal, blood, tallow and hide the game does not count).
   **A (Kim, 2 Nov):** keep 15 (P).
7. Ewes' milk and wool. Walter of Henley (13th century) counts 20 ewes on salt-marsh pasture as giving the cheese and butter of 2 cows, and the *Hosebondrie* milks ewes only until August. **P:** a later task (VB-144): ewes in milk from turn-out to summer's end at 0.05 rations a day, wool with the winter crafts (VB-121).
   **A (Kim, 2 Nov):** accept (P); VB-144 is `ready`.
8. Yields rising over a game (VB-048). **P:** the soil's cap rises with a village's years of farming, from 1.15 by 0.1 a century, so well-dunged old farms out-yield new ones by about 10% after 100 years.
   **A (Kim, 2 Nov):** accept (P); built in VB-160.

## VB-130: what grain does once a household is fed (raised in the review of 31 October)
Founders at seed 7 hold 300 grain per household in year 2 and 1,700 in year 38, with 12–14 people: a surplus has no use and no loss.
1. What is the first outlet? **P:** storage loss, which is the cheapest and historically true (damp, mice, weevils): each year 8% of the grain above a year's food for the household is lost at the autumn count (so a household keeps a buffer but a hoard shrinks), shown in the household panel as "spoilt"; a tithe and trade stay for later (Open, "Outlets for grain").
   - Balance review, 1 November: built as a daily loss by tiers instead (question 2 under "Balance review: the tuned values"): 8% above a year's need left founders' stores near 600 and rising; with 5%, 20% and 40% by years of need held they level off near 350–400. If accepted, VB-130 is done.
   **A (Kim, 2 Nov):** the tiers of the balance review (question 2 there); VB-130 is done.

## Review, 2 November, second pass (question 2)
2. Founders do not grow (25 people in year 38 at seed 7, even with empty farms claimable, against 353 to 427 in 8 years in populous). Is that wanted? **P:** yes for the first decades: a scenario of ten people on one farm should be a struggle; the courting and occasions tasks (VB-036, VB-126) are where brides come from. Check at VB-035 that it does not die out before year 80.
   **A (Kim, 2 Nov):** intended (P).

## Moving to new land: the tuned values (VB-150, expansion review of 1 November)
Built in VB-146 to VB-149 with the starting values below (`SETTLE` and `SOIL.fresh` in `src/sim/rules.js`); the measurements are in `docs/review-expansion.md`, Results. In populous small at seed 7 over 40 years, adults waiting with no room fall from 32 to 4, deaths by starvation in years 31–40 from 46 to 0, and the population at year 40 rises from 662 to 780.
1. Provisions. 36 days of the party's rations last from the moving round (autumn day 10) to the first threshing with no margin; a settler alone starts spring with about 21 days of food. Fresh land then feeds them well. **P:** 42 days (a week's margin), so a late sowing does not mean hunger.
   **A (Kim, 2 Nov):** 42.
2. Who leaves and when. 0.3, 0.6 and 0.8 by moving rounds waited in a crowded village; ages 18–45; a sibling follows with 0.5, at most 2. **P:** keep; the queue of waiting adults stays at 2–8 in 40 years.
   **A (Kim, 2 Nov):** keep.
3. Join or found. Settlers mostly join small villages (seed 7, 40 years: 25 farms joined, 8 villages founded), so hamlets of up to 4 farms grow around the generated lone farms and the first daughter villages. **P:** keep; the green and well (VB-058) make such hamlets villages.
   **A (Kim, 2 Nov):** keep.
4. Fresh land. Soil 1.4 on ground never farmed. Households of 1 and 2 (mostly settlers) are hungry in 19% and 10% of years, against 36% and 24% without it. **P:** keep 1.4.
   **A (Kim, 2 Nov):** keep 1.4.
5. Lone settlers. Many settlers leave alone and stay alone for years (seed 42, after 10 years: 4 of 16 settlers ever married): courting does not cross villages yet (no two pawns of different villages meet, VB-126), and the yearly match favours a spouse of the same village. **P:** nothing now; occasions (VB-126) and courting (VB-036) should bring brides from the mother village.
   **A (Kim, 2 Nov):** nothing now (P).
6. The founders do not grow, with or without the new rule: their village never fills, and at seeds 7 and 42 they die out by year 80–100. **P:** a question for VB-035, outside this review.
   **A (Kim, 2 Nov):** intended for the first decades; check at VB-035 that they do not die out before year 80.
   Measured after the change (populous small, seeds 3, 7 and 42, 25 years, 36 against 42 days): 1,639 against 1,682 alive, 42 against 50 deaths from hunger and starvation, 5,019 against 5,145 hungry household-days; the seeds disagree in sign, so the effect is within the noise of one shared random stream (VB-072).

## VB-127: familiarity from talk and time at home (relationships review)
Kim kept the tie model unchanged in VB-061; this is the later rework.
1. Replace counting hours near each other with talk, waking hours at home and work together? **P:** yes: +0.5 per talk, +1 per 24 waking hours under one roof, +0.5 per job worked together; the kin floor stays at 0.4.
   **A (Kim, 2 Nov):** yes, as proposed.
2. Cap ties at the 150 strongest per pawn, kin always kept? **P:** yes.
   **A (Kim, 2 Nov):** yes.

## VB-129: the moving round in slices (raised by VB-145, balance review of 31 October)
VB-145 cached the heir rankings that made the round cost 1.3 s; it now takes about 20 ms in one step on populous medium at seed 7.
1. Is VB-129 still wanted? **P:** close it as met by VB-145; if saves (VB-074) ever need to stop inside the round, that task can slice it.
   **A (Kim, 2 Nov):** close it (P).

# Archived 2 November 2026 (claims review, borders)

## VB-157: how borders become contested (raised in the session of 2 November)
As built, villages almost never dispute a border: over 20 years on 3 seeds (populous tiny) there were no disputes and no cairns, since villages claim outland nearest first while land is free, and once the land between them is held a crowded village has nothing left to claim.
1. How should borders become contested? **P:** border pressure: a village short of outland may claim a neighbour's outland that lies nearer its own green; the holder's right counts as the older claim and the custom decides at the next meeting. Alternatives: frontier only (as built), or leave it for herding and trespass (VB-136).
   **A (Kim, 2 Nov):** border pressure. (Built with "a neighbour that holds more outland a farm" in place of "nearer its own green", which almost never held; `backlog/VB-157.md`.)

# Archived 1 November 2026 (claims review)

Asked with the review of claims, ownership and territory (`docs/review-claims.md`). Kim answered in the session of 1 November: the outland claimed by need at the meetings; all four effects (no taking in of another village's land, settlers in wilderness only, border grudges, the commons wood in the village's land), "the basis for land based taxation later (and the aristocracy/big men)"; stakes before clearing, with contests; and claiming empty farms in this change, with VB-033's proposed answers below.

## VB-033: claiming an empty farm (raised by the nightly run of 30 October)
The criteria from VB-030 leave four gaps the nightly run could not fill. VB-031 (clearing a plot) no longer waits for this task, but growth needs both: empty farms are the cheapest new places.
1. What does the claimants' new household start with? **P:** as a new plot's household (VB-032): the claimants' inheritance shares (`stake`) as grain; if that is less than seed for the farm's fields plus 60 days of food for them, their old households give the difference from grain above their own buffer and seed reserve, as far as they can; firewood and rations as a founders household (`ECON.startWood`, 2 days of rations under VB-022).
2. May a ruin (below 15%) be claimed before the full rebuild (VB-032) exists? **P:** no: ruins are left out of claims until VB-032 is done; derelict farms (15% and up) can be claimed now.
3. Who works on the restoration, and where do the claimants live meanwhile? **P:** they live and eat in their old household until they move in. The claimants take the restoration at priority 9, and the members of their old households may help at 5, as for a cleared plot (VB-031).
4. Under "the meeting assigns", until support through ties is built: oldest claimant first, or youngest? **P:** oldest first, as elders carry more voice at the meeting.
   **A (Kim, 1 Nov):** as proposed (P), all four; and a birthright: the old family's claim on an empty farm for 20 years (`design.md`, Infield, outland and wilderness).

# Archived 1 November 2026 (stability review)

Questions 5 and 6 under "Towns: the bases of city formation" (cities review, `docs/review-cities.md`), answered when Kim asked for the long-term stability work (`docs/review-stability.md`). The other questions of that section stay open.

## Towns: the bases of city formation (questions 5 and 6)
5. Two holders who wish to marry. Under "with the land" a couple needs exactly one place: two people who each hold a farm, or are first heir to one, cannot marry each other (`homeFor` in `src/sim/lifecycle.js`). Settlers who found farms alone become such holders. **P:** they may: the couple lives on the farm with more fields, and the other passes to its next heir, or to tenants once tenancy exists; heir–heiress marriages were the old way farms were joined.
   **A (Kim, 1 Nov):** as proposed (P): two holders may marry; the couple lives on one farm and the other goes to its next heir, or else to a landless adult of its village who waits for land (VB-153). Kim also chose: marriage needs means (the home holds food for a year of its people and one more), and no later minimum ages.
6. Households of one. A quarter of all household-years on the tiny map are one person, mostly settlers and widowed holders; they are hungry in half their years although they make 1.5 times their need and hold nearly 3 years of it, because one person cannot farm and keep house at once. **P:** a lone waiter leaves only with a companion (a sibling, or a landless adult of the village as servant), and a lone holder takes a servant at the moving round when one is free.
   **A (Kim, 1 Nov):** a lone holder takes a servant at the moving round, as proposed (VB-152); settlers need not leave in pairs. Also: an orphaned minor heir left with no adult takes in a landless adult relative as guardian, or else the children go to their kin and the farm stands empty (VB-152).

# Archived 31 October 2026 (animals review)

Asked with the review of the animals design against history and the game (`docs/review-animals.md`). Kim answered questions 1 to 4 in the session of 31 October; the others were taken as proposed.

## VB-047: animals review (review of 31 October)
The review of the animals design against history and the game is in `docs/review-animals.md`; its sections give the reasons and numbers. Answers let VB-047 write the implement tasks VB-131 to VB-141.
1. The first pull request. **P:** the review, the task files VB-131 to VB-141, and VB-131 to VB-134 built (herds at the farm, hay meadows, haymaking, the byre and the autumn count with slaughter and salt meat), one commit each.
   **A (Kim, 31 Oct):** as proposed (P): VB-131 to VB-134.
2. Cattle as named head inside the herd: the herd stays the one unit that moves, grazes and posts jobs, but its cattle are a short list of named animals (sex, birth, kind: calf, heifer, cow, bull, steer, ox), so calving, gelding, oxen and culling work and the log can name them; sheep stay counts. **P:** yes.
   **A (Kim, 31 Oct):** yes: named cattle, counted sheep.
3. Meat. A cow at 40 rations and a sheep at 8 (Kim, 30 Oct) are about 4 and 6 times the history (about 9 and 1.5); at 40 a cow is worth more dead than alive. **P:** a cow 15, an ox 18, a sheep 3; lean meat from an emergency slaughter half that.
   **A (Kim, 31 Oct):** as proposed (P): a cow 15, an ox 18, a sheep 3.
4. Soil wear. **P:** as Agreed, each harvest lowers a field's soil by 0.08 to a floor of 0.75 and each load of manure raises it by 0.04 to at most 1.15, in one task (VB-137); VB-048 retunes the yield. The alternative: manure as a bonus only, soil 1.0 to 1.15 and never below today's yield.
   **A (Kim, 31 Oct):** as proposed (P): wear and manure.
5. Calving. **P:** a cow of 3 or more calves on spring day 3 with chance 0.85 if a bull of 2 or more lives within 12 steps of her farm, else not; her holder remembers "Lent us the bull" (+0.05, cap +0.2, 3 years) about the bull's holder. A ewe lambs (0.3 chance of twins) if a ram is within reach.
   **A (31 Oct):** not answered separately; taken as proposed (P), as the review said it would be.
6. The founders' hay. **P:** hay for one winter of each farm's animals; no founders farm has a meadow at the start.
   **A (31 Oct):** not answered separately; taken as proposed (P), as the review said it would be.
7. A herd without a herder stays by the farm, gives half the milk that day, and may get into a crop through a broken fence stretch: the crop loses 10%, and its holder remembers "Cattle in our crop" (−0.1, cap −0.3, 2 years) about the household that keeps the stretch, as the Westgöta law makes the fence's keeper liable. **P:** yes, in VB-136.
   **A (31 Oct):** not answered separately; taken as proposed (P), as the review said it would be.
8. Who works with animals. **P:** two new types of work, husbandry (milking and the byre: mistress 9, maid 10, daughter 9, farmhand 4, farmer 3, son 3, retired 3) and herding (child from 8: 8, daughter 6, son 5, retired 4, farmhand 3, farmer 2); mowing is harvest work with exceptions for women (4) and children (0); slaughter is husbandry with exceptions for men (farmer 8, farmhand 8, son 7) and women (2).
   **A (31 Oct):** not answered separately; taken as proposed (P), as the review said it would be.
9. Numbers not asked above (hay per head, meadow yield and hours, milk, butter share, the autumn count's order, byre and fodder hours, manure) are starting values in the review, section 4. **P:** take them as starting values, tuned in VB-048.
   **A (31 Oct):** not answered separately; taken as proposed (P), as the review said it would be.

# Archived 30 October 2026 (job review, second pass)

Asked with the second review of the job system (`REVIEW.md`, "Work and jobs, second pass"), which measured adults idle 55–79% of work hours, mostly with no job they may take, and proposed a registry of job kinds, several hands, interrupts and new concrete jobs.

1. Which job-system changes go into this pull request? **P:** the job-kind registry with roles by type of work, several hands (VB-102) and interrupts (VB-107).
   **A (30 Oct):** as proposed (P): the registry (VB-116), VB-102 and VB-107.
2. Which new concrete jobs first? **P:** fishing.
   **A (30 Oct):** fishing, gathering, village work days and winter crafts.
3. When does a household fish or gather? **P:** only when its food is short (grain above the seed reserve under about 24 days of its need).
   **A (30 Oct):** both, by urgency: always posted, with low urgency in good times and high urgency when food is short. Rations made from several food sources should be more nutritious, combined with the flour mechanism.
4. How busy should the village be? **P:** busy at the peaks (75–90% of work hours at sowing and harvest), partly idle in the slack seasons (40–60%), spare time going to talk once VB-061 exists.
   **A (30 Oct):** as proposed (P).
5. What does a meal from several food sources do? **P:** it goes further: a day's meal from 2 sources needs 10% less food, from 3 or more 20% less.
   **A (30 Oct):** as proposed (P).
6. Is the flour mechanism VB-009 (hand-quern milling), and is it built with the food jobs? **P:** yes; milling becomes a daily indoor job and the food balance is checked once with fish, gathered food and flour together.
   **A (30 Oct):** as proposed (P).
7. How is the work split into pull requests? **P:** two: the registry, VB-102 and VB-107 now; the new concrete jobs after, with their numbers agreed first.
   **A (30 Oct):** as proposed (P).
8. Do fish and gathered food keep like grain? **P:** no: they are eaten first and spoil after 3 game days; drying and salting later.
   **A (30 Oct):** as proposed (P).
9. VB-107's test has a farmer leave hoeing for the woods when the woodpile drops under 8, but with today's priorities a farmer's firewood bid (at most about 15) never passes 1.5 × his hoeing bid + 1 (at least 16); sons and farmhands do switch, early in the sowing window. **P:** keep the rule and test a son: the farmer keeps hoeing and a son or farmhand goes for wood.
   **A (30 Oct):** as proposed (P).

# Archived 30 October 2026 (paths, fords and village layout)

Asked when Kim set the work on paths, river crossings and village layout (VB-094, VB-096, VB-109, VB-110, VB-112 to VB-115). Kim's request: paths form where people walk and fade over about five years unused; paths are cheaper to walk and routes use them; rivers are passable only at fords or bridges, and bridges need construction; fields lie a short way from the homesteads and are contiguous; homesteads may touch; generated villages look grown.

1. Where do fords come from? **P:** generated with the world along every course, brooks included, at flat and shallow spots, about one every 6 to 10 tiles; every other river tile is impassable.
   **A (Kim, 30 Oct):** generate a few fords along every river, brook and so on. Village generation (homestead placement) respects pathfinding: no houses on the far bank if it cannot be reached.
2. How much of bridges now? **P:** the rule now (route search, walking and drawing know bridge tiles); building them later, as a village job that needs timber and labour.
   **A (Kim, 30 Oct):** as proposed (P).
3. How do unused paths fade? **P:** halving each game year, as designed: a lane (800) is a path after 2 years, trodden after 4 and gone after 4 to 5.
   **A (Kim, 30 Oct):** as proposed (P).
4. Which village layout? **P:** houses cluster around the green and may touch; each farm's fields form one connected block 2 to 4 steps from its house and never next to any house, so a ring of yards separates houses and fields; neighbouring blocks may adjoin into one fenced infield.
   **A (Kim, 30 Oct):** as proposed (P).

# Archived 30 October 2026 (VB-111: rivers)

Asked when VB-111 was set, before the rivers were built; the design's "River courses" is Proposed and these settle the points it leaves open.

1. How do rivers sit on the hex grid? **P:** through tile centres: a river tile stays land, drawn with a smooth river from a narrow brook to almost a tile wide; no house or field on it; walking unchanged for now.
   **A (30 Oct):** as proposed (P).
2. Besides drawing villages to rivers, do rivers change the simulation now? **P:** placement only; an irrigation or wet-bank bonus later.
   **A (30 Oct):** placement and an irrigation bonus: fields next to a river yield more (about +20%).
3. What happens where a river reaches a lake? **P:** the river ends at the lake, as the design proposes.
   **A (30 Oct):** lakes drain onward: a river that enters a lake leaves it at its lowest shore and runs on to the sea.
4. How many rivers? **P:** about one source per 700 land tiles of an island, none on islets.
   **A (30 Oct):** as proposed (P).

# Archived 30 October 2026 (merging main: conflicts between decisions)

Main (PRs #17 and #18) and the discussion on this branch decided some points differently; Kim settled them while merging.

1. Night and workday: main's work 6:00–18:00 every day with a dark part of 4–8 hours by season (22:00–4:00 at the equinoxes), or this branch's fixed night 21:00–05:00 with work from sunrise to sunset? **P:** none.
   **A (Kim, 30 Oct):** main's: work 6:00–18:00, the dark varies by season. This replaces the jobs review's answers 4 and 5 and the answers under "VB-105: daylight by season" below; VB-105 is rewritten to it.
2. Worn paths: main's speeds (5%, 15%, 30% faster, routes merge onto paths), or VB-094's "drawn only"? **P:** none.
   **A (Kim, 30 Oct):** paths are drawn first (VB-094); the speed-up, with main's numbers, comes in a follow-up task (VB-110).
3. Snow: by temperature (main, Proposed) or on fixed dates (VB-083)? **P:** none.
   **A (Kim, 30 Oct):** fixed dates now (VB-083); snow follows temperature once a temperature model exists.
4. VB-105 under main's design: the dark lasts 6 − 2 × cos(2π (doy − 15) / 48) hours, centred on 1:00 (23:00–3:00 at midsummer, 21:00–5:00 at midwinter), with main's twilight of 2 hours of dusk and dawn? **P:** yes.
   **A (Kim, 30 Oct):** yes, with 2 hours of twilight.

### VB-096: walking costs by terrain (was "Design points without a task", question 2; asked again when merging main)
Walking ignores terrain: crossing mountains costs the same as meadow.
1. **P:** cost by terrain: meadow, heath, shore and fields 1, forest 1.5, hills and marsh 2, mountains 3, snowfields closed; the same costs slow walking. Built in the current route search first (VB-096); routes over regions (HPA\*, VB-097) only if measuring shows routes cost too much.
   **A (Kim, 30 Oct):** as proposed (P): costs in the current route search now; HPA* only if measuring shows routes cost too much. This replaces the answer to "Design points without a task", question 2, below.

# Archived 30 October 2026 (discussion of all open questions)

## Priority 1

### VB-080: a food balance before animals (review)
A household of 6 eats 192 rations a year with four young children and 288 when all are over 14. A meadow field gives about 78 in an ordinary year, less 20 of seed: three fields about 170, four about 230. In the populous scenario a quarter of household-days in year 2 are hungry, and 9 people die of hunger in 4 years.
1. Should a family be fed from its own fields in an ordinary year before animals exist? **P:** yes: `fieldYield` 100 and seed 25 (4:1 kept), so a field gives about 72 after seed; three fields then give about 218 and four about 290.
   **A (Kim, 30 Oct):** as proposed (P). Also (new): the health drain falls from 9 to 4 × h² a day, so a starving adult dies in about 25 days, not 12; with both, populous seed 7 loses 7 to starvation in year 2 instead of 427.
2. Should the populous generator give households of 7 or more a fourth field? **P:** yes, where a farmable tile is free within 2 steps of the house.
   **A (Kim, 30 Oct):** yes, but the generator places a farm's fields as one contiguous shape within 4 tiles of the house; they need not be next to it. This holds for all generators and all farms; a field made in play prefers a tile touching the block within 4 steps, and only if none is free starts a new block (new task VB-109).
3. When milk and meat arrive (VB-048), is the yield tuned down again so animals fill part of the need? **P:** yes; 100 is a starting value for the years before animals.
   **A (Kim, 30 Oct):** as proposed (P).

### VB-076: commands (review)
The command system is Decided but not built: `planRound` matches and `start` acts in one step. Herds and a player role depend on it.
1. What is a command? **P:** a record of actor, verb, target and arguments, issued by a source (the planner, the player, a debug tool, the meeting); the simulation carries out commands and nothing else. First verbs: `work(job)`, `walkTo(tile)`, `goHome`, `idle(until)`.
   **A (Kim, 30 Oct):** as proposed (P).
2. The first step? **P:** the job matcher issues `work` commands instead of calling `start`, with no change in behaviour (golden file unchanged); the other sources follow in their own tasks.
   **A (Kim, 30 Oct):** as proposed (P).
3. Direct control? **P:** "Take control" on the pawn panel; the player then chooses the next command from a list (open jobs the pawn may take, walk to a clicked tile, go home), and the planner leaves that pawn alone until released.
   **A (Kim, 30 Oct):** as proposed (P).
4. Meetings, the moving round and debug actions as commands? **P:** yes, after the first step: the meeting issues `decide(custom, option)`; kill, retire and argue become debug commands.
   **A (Kim, 30 Oct):** as proposed (P).
5. Herds as command takers wait for the animals arch. **P:** yes.
   **A (Kim, 30 Oct):** as proposed (P).

## Priority 2

### VB-079: the player's role (review)
The largest open question. The options are not exclusive:
- (a) Watch and nudge: the player uses the advocacy slot to argue for customs, as the debug tools do today.
- (b) Follow a family line: the player acts through the head of one line, as that pawn's source of commands (choose work, court, claim, argue at the meeting), and carries on as the heir when the head dies, as in Crusader Kings III.
- (c) Steward: the player marks where to clear, which tiles to claim and what comes first, and pawns follow if their customs allow.
1. Which role? **P:** (b). The player's pawn sways customs as in (a), by arguing at the meeting with the weight of its prestige, and the player plans the land of its own household as in (c).
   **A (Kim, 30 Oct):** as proposed (P).
2. When the line dies out? **P:** the player picks a living relative, or anyone in the line's village; a run ends only when no one is left.
   **A (Kim, 30 Oct):** relatives only (by blood or marriage); with none left, the run ends.
3. A goal or a score? **P:** none needed: a chronicle of the line, plus optional ambitions (hold three farms, change a custom, found a village).
   **A (Kim, 30 Oct):** a prestige score: the line's prestige over time is the score, shown in the chronicle, with the optional ambitions as well.
4. When is it built? **P:** after commands (VB-076) and saving (VB-077); its plan writes the tasks then.
   **A (Kim, 30 Oct):** as proposed (P).

### VB-077: saving and loading in the page (review)
1. Where are saves kept? **P:** an autosave in the browser (IndexedDB) at each moving round and when the page is hidden, keeping the last 3; "Save to file" and "Load file" buttons for a JSON file, which is also how a bug report carries a run.
   **A (Kim, 30 Oct):** as proposed (P).
2. A save from another build? **P:** a save names its format version; one from another version is refused with a message, not converted, until the game has players.
   **A (Kim, 30 Oct):** refused with a message, as proposed, but the page makes it easy to delete the save and start a new game.
3. Is the world saved or regenerated? **P:** regenerated from seed and size, with the tiles the simulation changed (trees, stones, biome, development) saved as arrays.
   **A (Kim, 30 Oct):** save everything: the whole world is saved, so a save does not depend on the generator staying the same.

### VB-089: the heir-to-their-own-farm rule as a custom (backlog review)
The design makes the rule a custom (Decided) with two options; the default and malleability are Proposed. The code hard-codes "steps behind".
1. Default and malleability? **P:** as the design proposes: "Steps behind" for Old Nordic and both heirs-scenario villages, malleability 0.6.
   **A (Kim, 30 Oct):** as proposed (P).
2. "Keeps their place, so farms may be combined": no household can hold two farms, and someone who already holds a farm is passed over (Agreed). **P:** under "keeps" the heir keeps their place in the other line; if they take that farm, they drop out of their own parents' line, which passes to the next in it. Farms are never actually combined until a household can hold two farms, which needs its own design.
   **A (Kim, 30 Oct):** the heir with places in two lines takes the farm with more fields and drops the other claim, which passes to the next in that line.
3. Self-interest? **P:** the first heir of their home leans "keeps" (it widens their chances); a landless adult leans "behind" (it keeps a farm open for them).
   **A (Kim, 30 Oct):** as proposed (P).

### VB-090: service where labour is short (backlog review)
Today only founders' and populous servants, and the members of a farm that dies out, live as servants. A landless adult stays at home for life.
1. What is "labour is short"? **P:** hands per field, counting members aged 14–59 who are not retired: short below 1 hand per field, hands to spare above 1.5. Meadows and herds join the count with the animals arch.
   **A (Kim, 30 Oct):** as proposed (P).
2. Who moves, and where? **P:** at the moving round, unmarried landless adults (in `st.demand`) from households with hands to spare, oldest first, as long as their household keeps at least 1 hand per field. They go to the shortest household of their own village, else of the nearest village within 15 steps, else they stay. Each household takes at most one new servant a year.
   **A (Kim, 30 Oct):** as proposed (P).
3. Pay? **P:** board and lodging only; wages wait for money.
   **A (Kim, 30 Oct):** as proposed (P).
4. Does hunger also send people into service (a hungry household sending out a mouth)? **P:** not in this task; reconsider in the food or courting wrap-up.
   **A (Kim, 30 Oct):** as proposed (P).

### VB-036: courting, the numbers (follow-up to the answers in `QUESTION_ARCHIVE.md`)
Courting builds on relationships (VB-060) and talk (VB-061). These numbers let the courting tasks be written.
1. When does courting start? **P:** for two unmarried pawns of 16 or more, of opposite sex, not barred by the marriage limit, with a tie of at least 1.5 and an opinion of at least 0.4: a chance of 2% a day. Each pawn courts one person at a time.
   **A (Kim, 30 Oct):** as proposed (P).
2. When does it end? **P:** when either's opinion of the other falls below 0, when either marries someone else, or by a chance of 1% a day once they have courted a year without being able to marry.
   **A (Kim, 30 Oct):** as proposed (P).
3. When do they marry? **P:** on any day once both are of age (18 and 20), have courted at least 12 days, have a place to live and hunger below 0.5: a chance of 5% a day. The yearly matchmaking in the moving round then goes.
   **A (Kim, 30 Oct):** as proposed for couples who court, but the yearly matchmaking at the moving round stays for pawns who are not courting (arranged marriages).
4. Births while courting? **P:** a courting woman conceives at 0.1 times a married woman's chance, tuned in the wrap-up (VB-040) so that about 5% of births are outside marriage; after such a birth the couple marries at 3% a day under the same gates, about 3 in 4 within the year.
   **A (Kim, 30 Oct):** as proposed (P).
5. Children born outside marriage inherit how? The design proposes a custom with three options: inherit like other children; inherit after children born in marriage; do not inherit. **P:** as the design proposes: default "after children born in marriage", malleability 0.5. Self-interest: a pawn born outside marriage leans "like other children"; a married heir with half-siblings born outside marriage leans "after". The custom is its own task, written with the courting tasks.
   **A (Kim, 30 Oct):** as proposed (P).

### VB-081: populous households with adult children (review)
Populous children are spaced 2 years from age 0–2, so the eldest is at most 14: 818 people and no marriage in years 1–3.
1. Should some households start with adult children? **P:** yes: children 2–3 years apart, the eldest up to 26 as the mother's age allows (at least 19 at the eldest's birth, at most 44 at the youngest's), so about a third of households have a child of 18 or more. Still two generations, no grandparents.
   **A (Kim, 30 Oct):** as proposed (P).

### VB-082: customs made legible (review)
1. The meeting log? **P:** each change shows the support for the old and the new option and the margin needed ("Any child 46% against Sons first 31%; needed 25% more"); a custom within 5% of changing is noted as "nearly changed".
   **A (Kim, 30 Oct):** as proposed (P).
2. The pawn panel? **P:** a "Leans" line with the customs where the pawn differs most from its village's practice, and the cause it argues for, if any.
   **A (Kim, 30 Oct):** as proposed (P).
3. Announcements? **P:** a pawn taking up a cause and a change of practice are shown as a toast and kept in the record of events (VB-075).
   **A (Kim, 30 Oct):** as proposed (P).

### VB-102: several hands on one field job (jobs review)
A job takes one pawn; in spring 69% of adults' idle time is spent with no open job they may take, while plowing waits up to 27 hours (90th percentile).
1. How many hands per job? **P:** plow, clear and break 2; reap 3 (one cuts, others bind and stook); weed 2; thresh 2 (flails in pairs); sow, haul, wood, water, cook and mend 1.
   **A (Kim, 30 Oct):** basically the whole household can take part, with priorities by role: plow, sow, weed, reap, haul, thresh, clear and break take any number of workers; cook, water, wood and mend stay one pawn per job.
2. Does each extra hand work at full rate? **P:** yes, for now; crowding losses wait for the wrap-up (VB-108) to show whether they are needed.
   **A (Kim, 30 Oct):** as proposed (P).
3. How strongly is a free job preferred to joining one? **P:** a bid for a job with k workers is multiplied by 0.8^k.
   **A (Kim, 30 Oct):** as proposed (P).

### VB-103: any allowed work beats idling (jobs review)
110 of 119 open wood jobs on a summer evening could get no farmer's bid: urgency is about 0.1 with a full pile, and the walk costs more.
1. A floor for the bid? **P:** 0.1 plus the noise, for role priority 3 or more; poor fits (2 or less) keep the 2-hour wait and get no floor.
   **A (Kim, 30 Oct):** as proposed (P).
2. Firewood for the winter? **P:** from summer day 0 to the end of autumn the target is 40 (winter use about 19, autumn's 6, and a margin), 30 the rest of the year.
   **A (Kim, 30 Oct):** as proposed (P).

### VB-104: children's work (jobs review)
Kim decided: from 7, at reduced efficiency. The numbers:
1. Which jobs? **P:** water 6, weed 5, haul 4, reap 3; adults' priorities stay higher.
   **A (Kim, 30 Oct):** as proposed (P).
2. Rate by age? **P:** 0.3 at 7, plus 0.1 a year, 0.9 at 13; full rate with the adult role at 14.
   **A (Kim, 30 Oct):** as proposed (P).
3. Do girls and boys differ before 14? **P:** no; the roles split at 14 as today.
   **A (Kim, 30 Oct):** as proposed (P).

### VB-105: daylight by season (jobs review)
Kim decided: daylight changes with the season; night is a fixed, short (compressed) block of game hours.
1. The night? **P:** 21:00 to 05:00, home and indoors.
   **A (Kim, 30 Oct):** as proposed (P).
2. The day length? **P:** 12.25 + 6.25 × cos(2π (doy − 15) / 48) hours, at most the 16 hours outside the night, centred on 13:00: about 10–16 at midwinter, 5–21 at midsummer, 8–18 at the start of spring.
   **A (Kim, 30 Oct):** as proposed (P).
3. Work from sunrise to sunset, with no midday rest? **P:** yes; the midday meal is not modelled. Average work hours rise from 10 a day to about 12.
   **A (Kim, 30 Oct):** as proposed (P).

## Priority 3

### VB-091: forest spread (backlog review)
Forest spread is Decided, but open land never closes today. Grazing pressure is planned in the animals arch (VB-047).
1. Does spread wait for grazing? **P:** yes: it is built after the grazing-pressure task, so the land the founders need is not overgrown before anything can keep it open. Until then VB-067 covers empty fields.
   **A (Kim, 30 Oct):** as proposed (P).
2. How fast? **P:** open tiles next to forest, or to scrub at half cover or more, reach scrub (a quarter of full cover) in 8 years and full forest in 30, the same 30 years as regrowth. The front then advances about one tile in 15 years.
   **A (Kim, 30 Oct):** as proposed (P).
3. What keeps land open? **P:** a field in use, a house, a green, a hay meadow mown that year, work on the tile in the last year, or grazing pressure at or above a "keeps open" threshold; pressure at or above a higher "thins" threshold removes scrub slowly. The thresholds are set in the grazing task.
   **A (Kim, 30 Oct):** as proposed (P).
4. Does heath close too? **P:** yes, like meadow; heath was kept open by grazing and burning.
   **A (Kim, 30 Oct):** as proposed (P).

### VB-092: store views (backlog review)
Store views for every level of entity are Decided; the scope model (VB-043) is Agreed.
1. First version? **P:** households and villages, as for the overlay filters; families, cultures and pawns later.
   **A (Kim, 30 Oct):** as proposed (P).
2. Where is it shown? **P:** a "Stores" panel opened from the village and household panels: one row per household, a total row and the village store, food in days of the household's need, updated once a game day.
   **A (Kim, 30 Oct):** as proposed (P).
3. History? **P:** not in the first version; the household ledger stays in the household panel.
   **A (Kim, 30 Oct):** as proposed (P).

### VB-093: a village windmill (backlog review)
Milling at a mill is Decided (much faster, often village-owned, built as a commons job); rivers do not exist, so the first mill is a windmill. It comes after the quern (VB-009) and building (VB-032).
1. When does a village build one? **P:** at the moving round, a village of 3 or more farms with no mill and a free open tile within 6 steps of the green, hills preferred.
   **A (Kim, 30 Oct):** as proposed (P).
2. Hours and materials? **P:** foundation 20 h with 10 loads of stone, frame 80 h with 20 loads of timber, sails and millstones 40 h: 140 h, a little more than a cottage, as "likely dearer to build" suggests.
   **A (Kim, 30 Oct):** as proposed (P).
3. How fast? **P:** 1 work hour per 20 grain, 5 times the quern; a household walks there with its grain and carries flour home, and uses the quern when the walk costs more than it saves.
   **A (Kim, 30 Oct):** as proposed (P).
4. Other villages? **P:** a household of another village within 10 steps may mill for a toll of 1 in 16 of its grain, paid into the owning village's store.
   **A (Kim, 30 Oct):** as proposed (P).
5. Wind? **P:** ignored in the first version: the mill turns every day.
   **A (Kim, 30 Oct):** as proposed (P).

### VB-094: worn paths (backlog review)
Proposed in the Systems overview; no task yet.
1. Thresholds and fade? **P:** one count per crossing, halving each game year; trodden at 50, path at 200, lane at 800 (about 1, 4 and 16 crossings a day, kept up).
   **A (Kim, 30 Oct):** as proposed (P).
2. Do lanes speed walking? **P:** not now: they are only drawn. Revisit with terrain costs for routes (see "Design points without a task", question 2).
   **A (Kim, 30 Oct):** as proposed (P).
3. Lanes under snow (VB-083)? **P:** lanes stay visible as trodden snow; paths and trodden ground are covered.
   **A (Kim, 30 Oct):** as proposed (P).

### VB-067: empty fields and scrub (review)
1. Empty farms' fields turn to scrub after 8 years everywhere; the design says near woodland. **P:** until forest spread exists (with grazing, in the animals arch), only fields within 2 steps of a forest tile go to scrub; others stay grass.
   **A (Kim, 30 Oct):** as proposed (P).

### VB-083: seasons on the map (review)
1. Should the map show the seasons? **P:** yes: a tint per season over the painted land (fresh green in spring, full in summer, ochre and russet on broadleaf and meadow in autumn, bare broadleaf in winter; pine stays green), and snow on land from winter day 2 to spring day 3 with lakes iced over. After the Chromium test (VB-025).
   **A (Kim, 30 Oct):** as proposed (P).

### VB-084: speed (review)
1. At 10× a 150-year run takes about 10 hours, much of it uneventful. **P:** add 30× and "until something happens": the highest speed the frame rate allows until a notable event (a death, birth or marriage in the selected pawn's family, a change of practice, a farm emptied), then 1×. The simulation costs about 13% of a core at 30× on populous medium.
   **A (Kim, 30 Oct):** 30× and an uncapped speed (as fast as the frame budget allows), ready now; no run-until-event mode.

### VB-088: a performance budget (review)
1. **P:** steady state under 10% of real time at the fastest speed on populous medium at seed 7 (0.5 s of simulation per game day at 10×), and no single 6-minute step, meeting or moving round over 50 ms. `tests/perf.js` reports both in `npm run verify` and fails above twice the budget.
   **A (Kim, 30 Oct):** as proposed (P).

### VB-047: animals and husbandry (follow-up to question 2)
Answered so far (see `QUESTION_ARCHIVE.md`): roe deer first; not every founders farm keeps animals; at least one bull and one ram; farms with sheep keep 4 ewes; milk, meat, byre and task order accepted.
1. How many of the four founders farms keep cattle, and how many sheep? **P:** three keep cattle (2 cows each, and the first of them also a bull); two keep sheep (4 ewes each, and the first of them also a ram). One farm keeps neither and has to trade or marry into a herd.
   **A (Kim, 30 Oct):** as proposed (P).
2. Do cattle farms keep a pair of oxen at the start? **P:** one pair in the whole founders group, at the farm with the bull; the other farms hoe until they raise oxen from bull calves (castrated at 1 year, working from 3). This keeps the "ard is 2–3× faster than a hoe" advantage visible from year 1.
   **A (Kim, 30 Oct):** as proposed (P).

### VB-106: help between households (jobs review)
Kim decided: help between households is allowed, and it builds relationships.
1. Which jobs? **P:** plow, sow, weed, reap, haul, thresh, clear, break and mend; not cook, water or wood, which are the household's own.
   **A (Kim, 30 Oct):** as proposed (P).
2. When may a neighbour help? **P:** the job has waited 2 hours, the helper is an adult (14 or more) of the same village and has no bid on its own household's or village's jobs in that round.
   **A (Kim, 30 Oct):** as proposed (P).
3. Whom do they help first? **P:** bid × 0.5, plus 1 for near kin of the holder, plus the helper's opinion of the holder.
   **A (Kim, 30 Oct):** as proposed (P).
4. What does help build? **P:** per finished job, tie +0.2 and opinion +0.05 × (1 − opinion) between the helper and each adult of the household; nothing is owed.
   **A (Kim, 30 Oct):** as proposed (P).

### VB-107: interrupts (jobs review)
1. When does a pawn leave its job? **P:** when the best other bid is more than 1.5 × the current job's bid plus 1, checked at every full hour, at most one switch an hour.
   **A (Kim, 30 Oct):** as proposed (P).
2. May a pawn walking to a job switch? **P:** no; only pawns at work, not walking or carrying.
   **A (Kim, 30 Oct):** as proposed (P).

### Design points without a task (review)
1. Firewood: the design says winter use is about four times summer; the code uses 5.3 (1.6 against 0.3). **P:** keep the code and write "about five times" in the design, since VB-024 measures woodland use with it.
   **A (Kim, 30 Oct):** as proposed (P).
2. Walking ignores terrain: crossing mountains costs the same as meadow. **P:** when pathfinding moves to regions (HPA\*), cost by terrain: meadow and heath 1, forest 1.5, hills and marsh 2, mountains 3, snowfields closed; the same costs slow walking.
   **A (Kim, 30 Oct):** as proposed (P).

# Archived 30 October 2026 (jobs review)

## Work and jobs (become the work arch, VB-101 to VB-108)

1. What is the job system for: something to watch, or something the player steers (per-pawn priorities, forced jobs)? **P:** decided by the player's role (VB-079).
   **A (Kim, 30 Oct):** player-steerable, but that comes later; the player should be able to influence the world a lot, through all the systems.
2. May children work before animals exist, beyond "children herd"? If so, from what age? **P:** from about 7, at reduced speed.
   **A (Kim, 30 Oct):** yes, from 7, at reduced efficiency.
3. May neighbours help with each other's work? As a gift that builds ties, or as a debt that is paid back? **P:** a gift that raises the tie.
   **A (Kim, 30 Oct):** allowed; it builds relationships.
4. Should daylight change with the season, or are clock hours abstract under the compression? **P:** daylight by season.
   **A (Kim, 30 Oct):** daylight changes with the season, but the part of the day that is night stays fixed (and compressed).
5. Is that night a fixed short block of game hours, or a night played faster on screen? **P:** none.
   **A (Kim, 30 Oct):** a fixed short block of game hours; sunrise and sunset move by season in the rest of the day, and work follows daylight.

# Archived 30 October 2026

## Priority 1: expansion and the food floor

### VB-003: every farm in a village (unblocks VB-003, VB-004, VB-010, VB-031, VB-033)
1. What is a lone farm's village called, in the customs panel, the settlers list and its meeting log? **P:** the farm's own name ("Strand"), so one place has one name.
   **A (Kim, 30 Oct):** a generated village name.
2. What does the map label show for a one-farm village? **P:** the farm name only, as today; the green, well and village label appear once the village has a second farm.
   **A (Kim, 30 Oct):** the farm name only. When a second farmstead appears, the green and well become buildable by the village, not created automatically (new task VB-058). VB-003 and VB-004 are now `ready`.

### VB-030: inheritance and expansion (unblocks VB-031 to VB-034)
1. Clearing a plot: the design's trigger (someone waiting, nothing claimable, a free site, one project per village) and site rule (within 4 steps of the green, own or neighbouring region, not the last commons wood). Keep both? **P:** yes.
   **A (Kim, 30 Oct):** up to two projects per village at once, sites up to 6 steps from the green. Houses may stand next to each other, and a field need not touch its house, though tiles next to the house are preferred when possible.
2. How big is a new plot at first? **P:** a house and 2 fields; the household makes more fields later itself (VB-010's rule, up to 4).
   **A (Kim, 30 Oct):** a house and 1 field.
3. Job hours. The design's numbers (break 6–8 h, fell 10 h, grub 6 h, cottage 40 h) predate the long-work notes, which made tilling 20 h and breaking ground 30 h. **P:** fields as VB-010 (clear 10 h + up to 20 h for stones, break 30 h); fell 10 h and grub 6 h per forest tile; the cottage 120 h in three steps (foundation 30, walls 60, roof 30), so a plot takes most of a year for two or three people.
   **A (Kim, 30 Oct):** accepted.
4. Who works on a plot, by role priority (0–10)? **P:** those waiting for it 9; farmhand and maid 7; son and daughter 5; farmer 3; others 0.
   **A (Kim, 30 Oct):** accepted.
5. Under "the village allots it", who gets the plot? **P:** as the design says: married couples first, then by age. Can a single adult get one? **P:** yes, after every couple.
   **A (Kim, 30 Oct):** accepted.
6. Inheritance shares (`stake`, today unused) become the new household's starting grain. Who pays the shares still `owed`, and when? **P:** the farm they came from, at each moving round, from grain above its reserve.
   **A (Kim, 30 Oct):** accepted.
7. Claims on empty farms: restoration hours by condition. **P:** roof repair 20 h above 40%, 60 h from 15% to 40%, a full rebuild (as a new cottage, 120 h) below 15%; fields gone to grass are cleared like a meadow (10 h), scrub 20 h.
   **A (Kim, 30 Oct):** accepted, but the repair time scales linearly with condition: about 3 h at 90%, and 20 + (60 − 20) / (40 − 15) × 10 = 36 h at 30%. Written as straight lines through 0 h at 100%, 20 h at 40%, 60 h at 15% and 120 h (a full rebuild) at 0%.
8. Under `claims: assembly` ("the meeting assigns"), how does the meeting choose? **P:** the claimant with the most voice-weighted support among those with a voice, using the existing ties; by age until that is built.
   **A (Kim, 30 Oct):** accepted.
9. Splitting land (VB-034): does a sibling who gets fields also need a new house before they can farm them? **P:** yes, a building site next to the fields (VB-032); until it is built, the old household works the fields and gives the sibling half the harvest.
   **A (Kim, 30 Oct):** accepted.

### VB-050: health (numbers to confirm)
1. Health 0–100, drained daily by 9 × h² (h = hunger 0–1), ×1.5 for under 5 and 60 and over; a fully fed day restores 3. At h = 1 a healthy adult dies on day 12, a small child on day 8. **P:** yes.
   **A (Kim, 30 Oct):** accepted.
2. Below 50, health raises the death risk (×3 at 0), and the agreed hunger multiplier stays. **P:** yes.
   **A (Kim, 30 Oct):** accepted.
3. Should low health also slow work or make illness likelier? **P:** not yet; hunger already slows work by up to 40%.
   **A (Kim, 30 Oct):** low health slows work too, by up to 30% at health 0, on top of hunger. VB-050 is now `ready`.

### VB-058: the village green and well, built by the village (new)
1. When may a village start its green and well? **P:** once it has two or more occupied farms and no well.
2. Where does the green go? **P:** a free, passable tile as close as possible to the farms' mean position; it becomes the village centre.
3. Jobs and hours? **P:** clear the green 10 h, dig and line the well 40 h, raise the well sweep 10 h.
4. Who works on it (role priority 0–10)? **P:** farmer 5, farmhand and son 6, wife, maid and daughter 3: a village duty below the farm's own work.
   **A (Kim, 30 Oct):** all four accepted; VB-058 is `ready`.

## Priority 2

### VB-022: daily meals (unblocks VB-009, milling)
There is no milling job today: VB-009 was built, failed its test (hungry days rose because the daily cook job is missed on busy days) and was reverted. The `cook` job exists, but it only marks the day as cooked; nothing depends on it.
1. Which fix makes meals reliable? (a) households start with a few days of rations; (b) cooking gets a higher priority, or may interrupt other work after 14:00; (c) the cook makes the next day's food. **P:** (a) and (c): start with 2 days of rations, and cook for the next day, so one missed cook uses the buffer rather than causing a hungry day.
   **A (Kim, 30 Oct):** all three. VB-022 is `ready`; it adds the rations store, cooked from grain, and VB-009 (milling) is `ready` after it.

### VB-023: the one-person household in the heirs scenario
1. Olof, alone at B3, cannot till 3 fields in the sowing window, so he brings in no crop. With health (VB-050) he would now starve. Options: widen the sowing window, give one-person farms fewer fields, give B3 a farmhand, or accept it. **P:** give B3 a farmhand in the scenario: a bachelor farmer of 47 would have kept a servant.
   **A (Kim, 30 Oct):** a farmer prioritises sowing over tilling: a tilled field is sown before the next field is tilled. VB-023 is rewritten as that rule, for every farm, and is `ready`.

### VB-024: wood supply
1. A commons wood tile is felled to meadow in about 1.5 years. The task only reports numbers first. **P:** set it `ready` as a report-only task.
   **A (Kim, 30 Oct):** accepted; `ready`.

### VB-025: browser smoke test (also unblocks VB-053)
1. May the project add `playwright` and `pixi.js` (served locally instead of the CDN) as dev dependencies? Chromium is already installed in the cloud sessions. **P:** yes; run it in `npm run verify` only.
   **A (Kim, 30 Oct):** accepted; VB-025 is `ready`.

### VB-026: farm names in big villages (new farmsteads need names too)
1. Farms beyond the direction names: numbers (today), names of owners or families, or landmarks. **P:** landmarks from the surroundings, as lone farms already get (Backa, Strand, Lunden, Myra, Ängen), then Nygården for a newly built farm, and numbers only as a last resort.
   **A (Kim, 30 Oct):** a name generation system with many generators for the different entities; in the long run cultures prefer different kinds of generators. For now, landmarks and owner names are two generators that combine with the compass-direction one. VB-026 is rewritten and `ready`.

### VB-036: relationships and courting
1. When do pawns court? **P:** unmarried adults (men 20+, women 18+) with a strong tie (time together at work, the well and the green) may start courting at any time of year; courting lasts a season or more and can end.
   **A (Kim, 30 Oct):** courting may start from 16; marriage stays at 18/20. A system for pawn interactions comes first, in its own arch (VB-059).
2. Is a courting couple's marriage still gated by a place to live and the marriage limit? **P:** yes, both; courting couples wait for a place (claims, new plots, inheritance).
   **A (Kim, 30 Oct):** accepted.
3. Births outside marriage: how often? **P:** a small chance per day while courting, about 5% of births at the start; the couple marries within the year in most cases (about 3 in 4) if they can.
   **A (Kim, 30 Oct):** accepted.
4. Who believes who is the father? **P:** the true father is recorded; when the mother is courting more than one man, or married to another, the believed father is her husband, or the man she is seen with most.
   **A (Kim, 30 Oct):** always the true father, for now.
5. Does hunger stop courting, or only marriage? **P:** only marriage, as today (hunger ≥ 0.5).
   **A (Kim, 30 Oct):** accepted. VB-036 now waits on VB-059.

### VB-059: pawn interactions (new; courting waits on it)
1. What kinds of interaction come first? **P:** talk (builds a tie), help (a gift of food or work, VB-039), quarrel (lowers a tie), court (VB-036); later trade and persuasion.
   **A (Kim, 30 Oct):** talk only, for the first version.
2. What does a relationship between two pawns hold? **P:** the existing tie weight (familiarity), plus an opinion from −1 to 1 (liking), and a courting flag; kin links stay in the family records.
   **A (Kim, 30 Oct):** accepted.
3. When do interactions happen? **P:** when two pawns meet (as `noteContacts` finds them: working near each other, at the well, on the green, at home), each pair at most once a game hour, with the kind drawn from their roles, ties and opinion.
   **A (Kim, 30 Oct):** accepted.
4. Are interactions visible? **P:** a short speech-bubble icon over the pair near the camera, and a line in each pawn's events for courting, help and quarrels; talk is not logged.
   **A (Kim, 30 Oct):** accepted; also, the pawn info screen shows active modifiers (e.g. mood +5, recently talked to a friend): new task VB-062.
5. Cost at 1,000 pawns: keep relationships only above a minimum tie (as ties today), check pairs by map bucket instead of all pairs. **P:** yes; a target of under 5 ms per game hour on a populous medium map.
   **A:** not asked; the proposal is used. VB-059 is done; VB-060 to VB-063 written.

### VB-039: food help from kin and the village
1. Each adult wants a buffer of 20–60 days of food before giving. **P:** yes, drawn per pawn; the holder's counts for the household.
   **A (Kim, 30 Oct):** accepted.
2. How is the village store filled? (a) a share of each harvest given to the village, (b) gifts from households above their buffer at the moving round, (c) only common fields, once they exist. **P:** (b) for now.
   **A (Kim, 30 Oct):** (b); a share of 25% of the surplus at each moving round. VB-039 is `ready`.
3. Is help a gift or a loan? **P:** a gift that raises the tie between the households (and so their influence on each other's customs); loans come with money and markets.
   **A (Kim, 30 Oct):** accepted.

### VB-041: claims, ownership and territory
1. Who may hold a claim: households and villages only, or pawns too (a pawn who wants to turn a commons tile into a field)? **P:** all three, as the design says.
   **A (Kim, 30 Oct):** accepted.
2. Do unrealised claims expire? **P:** yes, after 3 years without work on the tile.
   **A (Kim, 30 Oct):** after 3 idle years, decaying linearly; a claim can be renewed.
3. Two claims on one tile: who decides? **P:** the village meeting, by voice-weighted support; until then, the first claim wins.
   **A (Kim, 30 Oct):** a custom decides (a new custom dimension, drifting like the others); its options and default are a follow-up question below.
4. First version of the filters: which levels? **P:** household and village, with the selected entity highlighted; culture later.
   **A (Kim, 30 Oct):** accepted.
5. Adopt the proposed scope model (a level, the chosen entities and a dimension, over one membership graph) as the plan? **P:** yes.
   **A (Kim, 30 Oct):** yes.
6. Follow-up: the "Disputed claims" custom. **P:** options: the first claim stands (`first`); the strongest claim stands, the one most recently worked or renewed (`strongest`); kin of the tile's last owner first (`kin`); the meeting decides by voice-weighted support (`meeting`). Default `first`, malleability 0.7.
   **A (Kim, 30 Oct):** accepted. VB-041 is done; VB-042 to VB-045 are `ready`.

## Priority 3

### VB-047: animals and husbandry
1. The first wild grazer: roe deer, with elk later? **P:** roe deer.
   **A (Kim, 30 Oct):** roe deer.
2. The founders' livestock: **P:** per household 2 cows, a pair of oxen and 6 ewes, with hay for the first winter, as the design proposes.
   **A (Kim, 30 Oct):** some farms have animals, not all. At least one farm has a breeding male for cattle (recorded as a bull, since oxen are castrated) and at least one has a ram. Farms with sheep have 4 ewes. Open: how many farms keep each, and whether cattle farms keep a pair of oxen.
3. Food from animals, in rations: **P:** a cow in milk gives 0.5 rations a day in summer, part of it kept as butter for winter; a slaughtered cow 40 rations, a sheep 8.
   **A (Kim, 30 Oct):** accepted, but slaughter yields meat, which a household job processes into rations that can be stored; rations spoil after a year.
4. The byre: **P:** room for 6 cattle at first, enlarged later by a building job.
   **A (Kim, 30 Oct):** accepted.
5. The order of the implement tasks, listed in VB-047. **P:** as listed.
   **A (Kim, 30 Oct):** accepted. VB-047 next writes the animals implement tasks.

### VB-055: type checking
1. May the project add `typescript` (about 25 MB, dev only) to check the plain JavaScript with JSDoc types? **P:** yes, in `npm test`.
   **A (Kim, 30 Oct):** accepted; VB-055 is `ready`.
