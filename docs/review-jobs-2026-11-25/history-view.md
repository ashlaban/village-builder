# Job system: what the closed-task record shows (history reviewer)

Evidence: `backlog/VB-*.md` (done ones), `QUESTIONS.md` list, `git log` (sparse: 344 commits, so the task files are the record). Reviews cited by tasks were not opened.

## 1. Timeline

1. **Bid-and-noise board (to 30 Oct 2026).** VB-018 (job board into modules), VB-071 (jobs indexed by owner), VB-102 (several hands on one field job), VB-103 ("Any allowed work beats idling": 110 of 119 open woodcutting jobs untouched because a bid was `role priority x urgency - 0.15 x distance + noise` and went to zero), VB-107 (urgent work interrupts a job), VB-116 (job kinds as one record each: "one job kind lived in nine places across four files").
2. **Commands and the player's door (7-13 Nov).** VB-167/168 (the matcher issues work commands), VB-169 (the player's queue goes before the pawn's own logic), VB-208 (each kind says where it is available; `refreshJobs` posts from them), VB-209 (`Opportunities.forPawn` plus the actor view), VB-212/680 (round wishes: the player's wish stands in for the pawn's own), VB-253 (the player as head: "every choice of the plan as a command").
3. **Holders' plans (11 Nov).** VB-249 (windows, due-queue), VB-250 (eligibility: a task is taken on a basis), VB-251 (attention: full, partial, background), VB-252 (seasonal plan), VB-123, VB-254/255 (foresight, projects).
4. **Auction becomes allotment, then blocks (15-16 Nov).** VB-466 "The head's day: a household's work is allotted, not bid for" (15 Nov, Kim: "Do B first. C is in scope."), VB-469 plan, VB-471/472/473/474 (work and walks as blocks, one queue of legs, no stepped workers), VB-476 head's estimate, VB-470 help is asked for.
5. **Kind split and physical consistency (15-22 Nov).** VB-418 (each domain declares its kinds; `sim/kinds` 859 to 150 lines), VB-422 (`sim/agents` 1277 to 683), VB-431 (`sim/plans` 1248 to 482), and a run of 11 "Teleport:" tasks (VB-581, 611, 645, 649, 650, 672, 674-677, 993) plus the collecting task VB-1175.
6. **Allotment tuning and cost (19-23 Nov).** VB-1186 (sow only what hands can work), VB-1197, VB-1546 (re-allot at 14:00), VB-1549 (a hungry household seeks food first), VB-1554 (jobs line cost by part), VB-1565, VB-1585 (thirsty pawn), VB-1591/1550 (split `sim/jobs` into `fit`, `day`, `idle`, `jobs`), VB-1405 (shared work candidates).
7. **The player's hand-plan path (24 Nov).** VB-1644 (agenda), 1646 (routine, sleep, ordered tasks feed the queue), 1647 (lays plan into days), 1649-1651 (plant/hay/harvest chains, side-by-side projects), 1653 (wood in two steps), 1655 (camp, `placeFarmstead`, build menu), 1657 (split `sim/playerplan`), 1658 (camp on automatic), 1660/1663/1666 (cottage, foundation, barn, shelter as plan tasks), 1668 (one-project limit removed).

## 2. Strain areas, ranked

**A. The head's day: the matcher/allotment is the cost centre and keeps being re-cut (VB-466, 1546, 1549, 1554, 1564, 1591, 1597, 1548).**
- VB-466 itself says "Cost: not cheaper... What B bought is the readable day and the code: the saving waits for scheduled blocks." Its main decision was to keep the **join factor** inside the allotment ("A close call: the review proposed dropping it"), because without it "every member's best task was the hoeing, the spring raking was missed".
- VB-1554 (23 Nov): jobs refresh and matching is "49 ms of 109 ms a game day... 45% of simulation time"; the allotment is 31% of it, and "a household's day is allotted 4.4 times a day"; behaviour-preserving cuts only bought "a tenth, not the third the task asked". Kim then had to be asked (QUESTIONS VB-1554) whether a newly due task may be slotted into the existing lists instead of re-weighing the day; she said yes (23 Nov). VB-1564 (cache the opportunities asks) is **needs-review**: a cheap cache found "a look finds new work in 92% of looks on a day without a review", so "households were worse off".
- VB-1546 added a second allotment at 14:00 and it caused a regression traced as "founders 7 hungry 3 -> 21". The cause was a priority inversion fixed by VB-1549 (the weighing ranked ploughing, wood and clearing "under" a foraging rank, with a hungry lone farmer at grain 0 not fishing); VB-1549's measurement criterion was left unticked ("skipped at Kim's word").
- Underlying cause as I read it: urgency/rank/fit are one weighed number, so every new kind or policy (food need, thirst, duties, calls) must be tuned against all the others; the fixes are numeric or timing special cases ("close call: one hour, not one at each hour an urgency changes").
- Duplicated rules: VB-1597 ("`takeDay` repeats `allotted`'s terms but for the commanded pawn") is still open and was found by the very refactor (VB-1591) that split the module.

**B. Carrying a task through ends (stuck tasks, dropped loads, helpers) (VB-1548, 1565, 1585, 1610, 1586).**
- VB-1548 (open, P1): "A day owed that ends on the road home drops its load: the task is stuck, its work done, never taken again"; "The defect is older than VB-1546"; stuck-task counts 2, 3, 9 on three runs.
- VB-1565: a helper who goes home kept being credited ("no work credited to a hand not there"), found only because `tests/oxen.js` failed after a merge ("an interaction"), fixed by a new invariant.
- VB-1585 (needs-review): the pawn's own thirst needed a verb by which "it leaves its work to drink", one that overrides rank that "never interrupts" mowing or reaping; the measure was "not clearly better off by dry days" with two builds giving 1,628 and 2,223 hungry pawn-days against 2,819. VB-1610 and VB-1586 (a booth's late fetch; carts taken at the field) are the same shape: a leg or load rule written for the daytime case.
- Read: execution (legs, loads, helpers, owed days, interruptions) is a separate concern from choosing, with a many-state phase machine (`go/work/back/home`) whose rare exits are only caught by invariants after the fact.

**C. Teleports and acts with no pawn: the job record did not carry goods (VB-575..677, VB-1175).**
- 11 done "Teleport:" tasks plus a collecting task with 16 lines, 8 still unticked: "stone, flour, peat, tar, hides, salt, iron, clay, ore and the rack still stay in the closed record: no fetch kind carries them" (VB-1175, 23 Nov); VB-1682 adds "a herd standing away (herd.at) eats no hay". Each is a rule that moves stock without a pawn. The kinds that carry a fetch were added by hand per good (VB-461 "Help is carried", VB-849, VB-1111).
- Read: "carry" is a per-kind hook, not a general property of every job; each new good or transfer needs a fetch kind or becomes a teleport.

**D. Optional hooks and special cases around KINDS, and the splits they forced (VB-116, 418, 420, 422, 431, 1550, 1591, 1473, 1488, 1413).**
- VB-116 already says one kind lived in nine places; VB-418 had to redo the split "(the one rule with two shapes (29 kinds...". Four split tasks (418, 422, 431, 1591) ran 15-23 Nov because modules crossed the line: `sim/agents` was "1277 lines and 47 counted exports". VB-1550 is a second `sim/jobs` split, then VB-1591 a third go in two days. Still open: VB-1488 (`sim/fieldplans`), VB-1413 (`sim/projects`).
- VB-1472 ("blocked, Waits for: Kim"): "a second kind left out would be the third special case" in the plans' `ownOf`, and the one-project limit's "guards that stand in for the rule" (`Projects.mayBegin`, `landWhy`, `buildStep`, `barnWhy`, `heirWhy`). VB-1668 removed the limit from every check but kept "an unplayed head's own rule still begins one large project at a time until VB-1472 designs how it chooses".

**E. Opportunities as a second source of truth (VB-209, 1197, 1564).** The list a pawn "may do here" and what the planner takes drift: VB-1197 ("A pawn takes a clear job not on its opportunity list") widened it to a 'helper' basis because the planner's help round took a neighbour's job the view did not list. The view and matcher both ask the ~40 kind availability rules (VB-1564: "14.1 oppAsk a pawn-day, spread thin over some forty rules"), so every kind is evaluated twice in design and often once in cost.

**F. Cost of work code (VB-205, 227, 453, 1169, 1554, 1563).** Repeated cost tasks in the jobs and agents lines; the Kim-agreed shortcut (slot a newly due task in) still unbuilt per the record; the blocks tasks (VB-472/473) removed stepping but VB-478 "Wrap-up: work as blocks" is still ready.

## 3. Parity (player vs non-player)

- **Built with intent**: VB-169 (the inhabited pawn "is indistinguishable" with no commands: a test hashes equal to the no-player run), VB-212 and 680 ("the same rules should apply to player controlled pawn as to other pawns to the extent possible", Kim, 8 Nov), VB-253 ("Parity of command: every act a pawn may take is the player's to command"), VB-681 ("A verb's check holds for any pawn: legitimacy in the verbs, not in who issues them"), VB-1405 (shared work candidates; "execution rechecks eligibility in the verb's check"; the player's queued work "is now refused if the pawn changed household").
- **Where it diverged (24 Nov: the hand-plan path)**:
  - The player's plan is a second feeder: "the feeder, in `playerStep`, only with automatic planning off... a command queued by hand goes before the plan, as an order for now" (VB-1646), with its own chain code (`chainCmd`, `planchains`), its own day layout (agenda, VB-1647), and `heldOff` suppressing the head's own rule: "With automatic behaviour off, nothing is begun that the player did not plan" (VB-1651).
  - A capability granted only to the player: "the limit is lifted for the played head only, since VB-1472 (blocked, Kim) holds the design for every head" (VB-1651); later VB-1668 lifts it for every check but keeps the unplayed head to one large project. The player can keep several land projects; the unplayed head cannot.
  - Camps: VB-1655 introduced a new farm state `camp` and verb `placeFarmstead` that only a played head reaches (nothing places a camp's farmstead on automatic: "Left"), repaired by VB-1658 the same day ("A hand start switched to automatic behaviour still gets a roof") and again in VB-1660 ("a played head with automatic behaviour on, from a camp start, still never begins a cottage").
  - Wood in two steps (VB-1653) and the ladder (VB-1659, 1663, 1666) were forced to "one rule for every household (Kim)" for unplayed heads, but with changed behaviour (`tools/same.js` differs wherever a settler household is founded; tests moved their days). Parity was bought by changing the simulation, not by sharing code.
  - Estimates: VB-469 recorded "a pawn that is not head sees estimates by its own judgement" as a close call; VB-477's timetable gives the player's head the verbs `dayOrder, dayGive, dayCall`; VB-1651 and VB-1646 note a manual/automatic plan "meet" is "for later".
  - Open: a task to list "player-only verbs against an allow-list with reasons" (tests/commands.js, ready) and VB-1720 (the head's match for a member has no page door). The 'player mode' is a flag swapped through checks (`automatic`), so the divergence is visible in test lists.
- Read: the record shows the player path built as a facade over verbs and then, on 24 Nov, as a distinct planning layer (agenda, tasks, chains) whose pieces are mirrored by the head's own rules (`ownRung`, `placeOwn`, `buildStep`). Where the same plan step exists twice, tasks of 24 Nov have to say "the head's own rule exactly as today". The estimate-based timetable, the player's plan and the head's allotment are three representations of one day.

## 4. What held up

- **The commands/verbs layer** (VB-167/168, 681, 1405): few repairs after it landed; later kinds (water, leather, shelter) register as verbs without reopening it. VB-911's defects (VB-1620, 1621) were data, not structure.
- **Job kinds as records** (VB-116, 418) once split: the water (VB-1582), leather and byre kinds were added without edits to the matcher.
- **Legs and blocks** (VB-471-474): 4 tasks in two days with before/after numbers and no later repair tasks naming them as Cause; the block model is what lets the agenda and timetable exist.
- **Eligibility on a basis** (VB-250) and **attention slots** (VB-251): untouched since 11 Nov apart from VB-1197.
- **Save/determinism rules**: VB-466 added `plan.day` as saved state and a loaded run goes on as an unloaded one; no job-related determinism repairs recorded.

## 5. Open follow-ups bearing on these strains

- VB-1548 (stuck day-owed task, P1), VB-1597 (one rule for whom the head allots), VB-1564 (needs-review, cache), VB-1585 (needs-review, thirst), VB-1610, VB-1672 (move's frost warning counted in the wrong days).
- VB-1472 (blocked: a holder's parallel projects, Kim) with its list of guards that stand in for the rule.
- VB-478 (wrap-up: work as blocks), VB-1175 (teleports collected, 8 lines open), VB-1123 (plan mode in the page replaces the Plan tab), the tests/commands player-only allow-list task, VB-1720.
- VB-247 (needs-review): jobs hold farmstead/field objects, not ids, "which is why the save codec must find shared objects".
- Questions: VB-1553 answered ("this mechanism (the keep factor, the verb and its buttons) is removed", standing duties kept as an idea; 23 Nov), VB-1554 answered (slot-in), VB-356 unanswered (crops).
