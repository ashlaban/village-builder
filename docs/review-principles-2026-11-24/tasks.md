# Backlog against the principles: review of 24 November 2026

Reviewer: a read-only agent run. No code, task, or design file was changed; this file is the only output.

## Scope, method, counts

- Open tasks: all 203 of `node tools/backlog.js list` (107 ready, 83 blocked, 13 needs-review). I read the Goal line of every one.
  I read the full notes or criteria of about 60 of them (the ones named below), and skimmed the rest by title and goal.
  Where this file says "verified" it means I read the line cited; "inferred" means I reasoned from titles or goals only.
- Done tasks: 106 of the 741 rows of `BACKLOG_ARCHIVE.md`, sampled systematically (every 7th row, offset 3, so the sample
  is spread over the archive's order, which runs newest first). They span 29 Oct (VB-002, VB-017) to 24 Nov (VB-1668).
  By task-file date: 29 Oct to 2 Nov, 22 tasks; 8 to 12 Nov, 20; 13 to 16 Nov, 27; 17 to 19 Nov, 25; 21 to 24 Nov, 13.
  I read the summary of each and, for 40 of them, the decision, close-call and candidate lines of the file.
- Beyond the sample I read all 44 archive rows with repair-like titles (Fix, Repair, Mend, Teleport, throw) and the notes of
  about 20 of them, to cluster the repairs. I also read the principle-candidate lines in `backlog/` and `docs/plans/`,
  `QUESTIONS.md` (4 blocks) and the titles of the 160 blocks of `QUESTION_ARCHIVE.md`.
- Cross-checks by `grep` over all of `backlog/` (944 files): phrase counts for the principles (table below), the `principle N`
  citations, and the invariants file `tests/lib/invariants.js` (2,084 lines).
- Limits: git history holds only 22 to 24 November (squashed), so "before and after 12 to 16 November" rests on the dates inside
  task files. Counts of phrases are file counts, not applications, and "candidate" is noisy (many tasks mean a job's candidates).

## Summary

1. The same defect keeps being found one case at a time: a holder or household that ends (death, dissolution) leaves goods,
   stakes, rights or plans pointing at a dead party. VB-779, VB-650, VB-1476, VB-1481, VB-1485, VB-1362, VB-1620, VB-850, VB-962 and
   VB-1562 each found a different instance, mostly as a throw on one seed. No stated invariant says "nothing is held by,
   owed to, or booked between a dead or dissolved party". This is the strongest finding.
2. Three principle candidates written into plans were never accepted or struck, and are not in `design.md`'s list (verified by grep):
   "a chance that stands for a judgement becomes the judgement" (VB-682, the third of its kind), "a bound argued in hours is kept
   in hours" (VB-444), "a body exists from the day people live as it" (VB-445). The surfacing procedure has no register of
   pending candidates, so they stay "in force" (the decision stands) but unnamed.
3. `principle N` citations are ambiguous. About 124 task files cite `principle 1`..`19`. The numbering is not `design.md`'s
   (bullets, unnumbered) and collides with `target-v2.md` section 2 (14 is level of detail, 15 the player is a source, 16 the actor view).
   In tasks, 14 means the estimate, 15 "like is shown alike" (VB-763, VB-773) but also parity of the player (VB-1645), 16 "every act is a
   pawn's". 48 files cite "principle 14", 38 "15", 28 "16". A reviewer given only the current docs cannot resolve them.
4. Unit and reckoning mismatches form a second cluster: a quantity in one unit, read in another, or an estimate computed by a
   different function from the thing it estimates. VB-1621 (shoeDays in game days, a week each), VB-685 (reach in three units),
   VB-444 (200 steps meant 67 hours), VB-1670 (a move reckoned 27 hours took about 620), VB-1662 (trips counted, loads stacked),
   VB-1587 (site water estimated 0.37 to 0.89 h, real fetch over pathless wood far worse).
5. The player-first pattern recurs: a state or verb is built for the played pawn and generalised to every pawn only later.
   `st.player.sleep` (VB-1643, then VB-1645), `st.player.wishes` (VB-680), VB-212, VB-1316, VB-1613 (a seeding argument in place of a verb).
   "Every act is a pawn's" names the acts; nothing guards state in `st.player`.
6. "Nothing teleports" is a hard rule, but the remedy is deferred: VB-1175 holds 11 collected teleports (4 mended, 7 open) and VB-650
   (the barn of a household that dies out) was closed "folded into VB-1175" by Kim on 18 Nov, then half-mended on 23 Nov (grain and
   wood only; stone, flour, peat, tar, hides, salt, iron, clay, ore and the rack still vanish). New tasks still add small teleports
   (VB-1585: a booth's roof brings the day's water; VB-1586: a cart is taken at the field), against "no task adds a teleport".
7. Omniscience leaks into estimates despite "the future is someone's estimate": VB-1551's window read the year's drawn frost
   (listed in VB-1175); VB-1670 fixed the same in the move's deadline. A checkable rule exists: deciders never read the
   weather's future draws.
8. Conservation is checked for grain and food (tests/accounts.js closes within 1% with `unexplained`) and for the fair's goods,
   but not for timber, hay, shoes, hides, stone, tar. VB-1620, VB-1662, VB-645, VB-328 and VB-850 are non-grain vanishings or
   appearances. VB-1662 notes the obstacle: the routine totals are pruned after three years.
9. The care of dependants is a recurring mechanic with no name: no child under 7 alone (VB-1602, VB-1606, VB-1585 excludes under 7 and
   the bedridden from leaving to drink, VB-1240 line on a child alone), orphans (VB-695), VB-283's "a household nobody can come to".
   Each fix is a local guard (`mindsWhy`, `fetchChild`).
10. Latent defects surface only when an unrelated change moves a trajectory: VB-1562 states it outright; VB-1565, VB-1471, VB-1224,
   VB-1225, VB-1313, VB-1360, VB-1361 are "red check after the night's merge" repairs. The invariants run on whatever the seeds
   reach; no check sweeps states. Related: the browser-test flakiness family (VB-1507, VB-1654, VB-1495, VB-1593, VB-1145).
11. A mechanism can ship switched off because the tests encode a prescription: VB-1553's standing duties ship at `MATCH.keep` 1
   (no memory) because hay and meadow checks (`tests/hay.js`: 89% of meadows in by day 4) went red at any value above 1.
12. Derived caches are eager at some events and lazy at others: VB-1369 and VB-1460 (roles at the age-14 birthday), and the invariant itself
   carries a loosening (`checkRoles(..., { allowAgeLag: true })`, `tests/lib/invariants.js:26`, verified).
13. Open tasks carry stale criteria that later notes contradict (VB-312 says verb `lend`, the 16 Nov note says an offer of basis
   `loan`; VB-276 and VB-319 likewise). The implementer must reconcile; this is a risk to "mechanisms, not prescriptions".
14. Design and code have diverged by Kim's order: VB-1668 removed the one-project limit from every check, while VB-1472
   (the design that replaces it) is blocked on Kim and `design.md` section 7 still states the limit.
15. Principle usage is lopsided: "Nothing teleports" (64 files), "Every act is a pawn's" (22), "a label" (13), "made good is graded" (19) are
   used widely; "Hunger presses, the feast binds", "Customs may prescribe", "Detail where it is a decision", "The island grows without
   the player" are cited by name in 0 files (they are used as numbers, so this undercounts), and "Parameters, not patches" in 1.

## Missed general principles

Each is a proposal, one line, with the evidence and the principle it sits beside. Evidence IDs were read unless marked inferred.

### G1. What ends hands on what it holds
Rule: when a holder (pawn, household, village) ends, everything it holds, owes or is owed passes by a named process to a
successor, or leaves play by a process; nothing is left pointing at the ended party.
Evidence: VB-779 (extinct dissolved before dropPlan, timber thrown), VB-650 (barn left to no one; now partly mended through VB-1175),
VB-1476 (a dead pawn's grain stake: up to 8,435 rations, 23% of the produce in year 50, found by VB-403's accounts), VB-1481
(a marriage hands a farm to a dissolved home), VB-1485 (goodwill with a dead holder), VB-1362 (goodwill between a holder and itself),
VB-1620 (a dissolved household's shoes vanish), VB-850 and VB-962 (a carrier's or a pack's grain on a pawn who dies),
VB-1562 (a pawn away in no phase), VB-315 and VB-317 (open: partial failure and tenancy end).
Sits beside: Nothing teleports (its "vanishes" half), target-v2 principles 6 and 8 (rights point at rights; a body exists only
when something needs its identity). The existing text covers the rule; the missing piece is a general ending procedure.

### G2. A quantity carries its unit, and a bound is kept in the unit it was argued in
Rule: each tunable states its unit (hours, days, game days, steps, loads, trips, rations); conversions live in one function; a bound
argued in one unit is stored in that unit.
Evidence: VB-1621 (shoeDays read as game days), VB-685 (reach named three ways: hours, any route, hex steps), VB-444 and VB-780
(`ROUTE.reach` 200 steps stood for 67 hours), VB-781 (reaches in steps for daily work, still open), VB-684 (one unit of load, open),
VB-1662 (trip against load), VB-335 and VB-394 (a load of sheaves and of hay), VB-1540 (tables read by narrower readers).
Sits beside: Parameters, not patches; this is the pending candidate of VB-444 ("a bound argued in hours is kept in hours"),
generalised. Test: a lint that a `@tunable` has a unit in its name or doc.

### G3. The estimate and the doing share one reckoning
Rule: what a head or the player is shown as an estimate (a walk, a move's cost, a task's end, a site's water) is computed by the same
function the doing uses, from the estimator's knowledge, so the two can only differ by what the estimator does not know.
Evidence: VB-1670 (moveCost 27 h reckoned against about 620 h by the route), VB-471 (legs foretold beside the stepping),
VB-1644 (agenda hours against deadline), VB-1558 and VB-1554 (the day weighed anew against slotted), VB-1583 and VB-1587 (site water:
the search's estimate 0.37 to 0.89 h, 13 of 13 sites "by the well"), VB-1551 (reads the drawn frost).
Sits beside: The future is someone's estimate (which says whose, not how).

### G4. A decider reads no draw that has not happened
Rule: nothing a pawn decides reads the simulation's future (the year's frost, a birth, a find) before it falls; it reads an expectation.
Evidence: VB-1551 (window to the drawn frost, listed in VB-1175), VB-1670 (the deadline keeps the frost the head expects),
VB-1553 (haymaking and harvest checks), VB-1612 and VB-1614 (a lone settler's crop lost to the frost leaves no seed: how does it
know when it comes?). Sits beside: The future is someone's estimate; target-v2 principle 16 (actor view).
Test: lint that `sim/weather` draws are read by deciders only through an `expected` accessor.

### G5. Whatever state the player has, a pawn has; the player is a source, not a store
Rule: no field of `st.player` holds game state that a pawn would have; the played pawn's own fields hold it, and every verb with
source `player` has the other sources registered or a written reason.
Evidence: VB-1645 (sleep: `st.player.sleep`, verb sleep with source player only), VB-680 (wishes existed only for the played pawn),
VB-212 (the player's wish stands in), VB-1316, VB-1585 (thirst built for every pawn from the start: the good case), VB-1613 (the
unplayed settler "takes the first" by default, the player's choice a seeding argument, not a verb), VB-1484 and VB-1123 (the page's
modes; fine if each has verbs), VB-1240 (the open line: sleep verb is player-only).
Sits beside: Every act is a pawn's; target-v2 principle 15 (parity of command), which says acts, not state.
Test: `tests/commands.js` could list the verbs whose `sources` are `['player']` only, and a lint flags `st.player.` writes
outside the player module.

### G6. A dependant is never left without a minder
Rule: a pawn that cannot fend for itself (a child under 7, the bedridden, the frail) is always in the care of a pawn who can; a
verb that would leave it alone refuses and says why.
Evidence: VB-1602 (`mindsWhy`, the last of 7 or over does not leave), VB-1606 (a settler alone with a child), VB-1585 (children
under 7 and the bedridden do not go to drink), VB-1240 line 3 (a child moved to a household of children alone), VB-695 (orphans,
guardian acts as head), VB-283 (a household nobody can come to). Sits beside: Every act is a pawn's (the check holds for any pawn).
Test: a state invariant: no day ends with a pawn under 7 in a house with no pawn of 7 or over in it, unless in transit with one.

### G7. A chance that stands for a judgement becomes the judgement (pending candidate, unaccepted)
Rule: chance is kept for what nobody decides (weather, a birth, a death, a find); a pawn's yes is a threshold on what it weighs.
Evidence: VB-682 (stated, the third decision of its kind), VB-693 (the go-ahead roll removed), VB-405 (a wait is the thing waited for,
accepted as its sibling), VB-523 (belief at chance `0.6 + 0.5 x ...`, `STORY.tell` 0.3: still draws for a decision; open, medium
size), VB-1552 (the pastime: "company first at its chance"). Sits beside: A wait is the thing waited for; Mechanisms, not
prescriptions. It needs Kim's accept or strike; it has been in the plans since 16 Nov.

### G8. A body exists from the day people live as it (pending candidate, unaccepted)
Evidence: VB-445 (household and village at the move, a stake held by a pawn), VB-787, VB-788, VB-789, VB-1607 (open: site under
`st.sites` before the move; the settling in steps), VB-1587 (the household "founded at the round, lives in its booth" before its
well). Sits beside target-v2 principle 8. Unresolved because VB-787 (L) is not built: the half-way states (a booth household with a
`wellMeant` mark on the farmstead) are the price.

### G9. A guard that is never reached hides the next fault; a refusal comes from a check, not an owner's write
Evidence: VB-1598 (the guard in `weigh` removed, the invariant added), VB-1485 ("not by skipping the booking silently"), VB-779,
VB-1481 (the loud owner throws that found them are the real invariant detectors: `goodwill: cannot add`, `stores: missing or
dissolved holder`). Sits beside target-v2 principle 19. Rule: an owner's write refuses loudly; the fix is upstream, never a skip.
It is already practised; naming it would stop the next "skip the booking" repair.

### G10. A statement of design stands until a plan rewrites it, so code must not run ahead of it
Evidence: VB-1668 and VB-1472 (limit removed in code, design silent), VB-1553 (built but off), VB-1126 (design.md lacks two rules
VB-1106 built; "a worker does not edit it"). A rule: a task that removes or adds a Decided mechanism opens
the design task in the same PR. Process, not game.

## Missed invariants (system and mechanics)

Each is stated to be checkable. "Exists" means I found a partial check in `tests/lib/invariants.js`.

| # | Invariant | Evidence | How to test |
|---|-----------|----------|-------------|
| I1 | No dead pawn or dissolved household is a party to anything live: no stake, store, obligation, offer, goodwill entry, plan, job, trust or claim names one (except as history) | VB-1476, 779, 1481, 1485, 650, 1620 | in `checkState`, one pass over each registry; `peopleCheck`, `stake` and plans already do their own. Add stakes of dead pawns, `relations`, `offers`, `jobs.owner` |
| I2 | A goodwill or obligation entry has two distinct parties | VB-1362 (holder with itself), VB-1485 | check in `addGoodwill` (exists, throws) and on saved state |
| I3 | A pawn holds at most one household (as holder); no household has a dissolved home | VB-1481 (pawn 17 held two) | existing `holds` index check plus a per-pawn count |
| I4 | Per good, produced + brought in - consumed - made-into - rotted - carried-out = change in stock, for every good in `Stores` (timber, hay, wood, shoes, hides, stone, tar), not only grain and food | VB-1620, 1662, 645, 328, 850 | extend `tests/accounts.js` per good; needs the ledger's totals not pruned (VB-1662's obstacle), or a per-run counter |
| I5 | Every stored quantity is non-negative and finite, every good has a source and a sink process | VB-1175 lines, VB-698 | `tools/stocks.js` has one line per stored quantity (verified 392 lines); a test that every `Stores` good has both a source and a sink listed |
| I6 | A pawn under 7 is never alone in a house for a day end | VB-1602, 1606, 1240 | day-end invariant over households with children under 7 |
| I7 | A pawn's job/phase is always one of the declared phases; no task has its work done and nobody to claim it | VB-1548 (stuck, done, never taken), VB-1562, VB-1565 | extend the `a.job` phase check (VB-1565 added `go|work|back` only); add "no job with done >= need left unclaimed for more than a day" |
| I8 | A pawn carrying a load is a pawn in transit with a place; a carried load is lying or in a store, never nowhere | VB-1548, 850, 962 | invariant: sum of loads on pawns = sum of `carry` fields; lying loads have an owner and tile |
| I9 | Reckoning equals doing: a move's, a walk's and a task's foretold hours are within a stated ratio (say 1.25) of the hours the run takes, on constructed tiny states | VB-1670 (`tests/move.js` now asserts a quarter at 2, 10, 24 steps), 471, 1644 | one generic `foretold` probe per verb with an estimate |
| I10 | Units: every `@tunable` states its unit; tunables named `*Days` or `*Hours` are compared against values of that unit | VB-1621, 685, 444 | lint on `@tunable` doc and name |
| I11 | Derived caches equal their sources with no lag allowance at any step (roles at 14; `w.tended`; the votes) | VB-1460, 1369, 1506, 1656, 247, 1412 | `checkRoles` without `allowAgeLag`; fix the owner so the birthday refreshes in the same step |
| I12 | A save loaded onto a used world equals a fresh load (no stale `w.*` fields) | VB-1656 | load the same save into a fresh state and a used one; `tools/same.js` compares |
| I13 | Every `st.player.*` write is by `sim/player`; no game state lives there that a pawn lacks | VB-1645, 680 | owners check plus a list of `st.player` fields reviewed once |
| I14 | Every verb has a check that names why not; every verb registered with source `player` has sources for pawns or a written reason | VB-1240, VB-1645, VB-1613 | extend `tests/commands.js` |
| I15 | An open offer's parties and carried loads exist at the time of the answer (the fair, a gift in transit, a swap) | VB-1598 (fixed one case in `unload`) | generic offer invariant: every open offer's `gives` is covered by its giver's holdings |
| I16 | Plot numbers are distinct non-negative integers (not contiguous): the invariant should say the property the rule keeps | VB-1191, VB-959, VB-1158 | done in VB-1191; the lesson is that three tasks fixed one invariant's wording, not the code |
| I17 | A decision never reads a future draw: only registered `expected` accessors reach `sim/weather` draws from agency-layer modules | VB-1551, 1670 | `tests/dependencies.js` extension |
| I18 | A single night's red checks are classified, at the time, as a bug, a stale test, or a moved trajectory | VB-1471, 1224, 1225, 1313, 1360, 1361, 1223, 1247 | process; see Repair clusters |
| I19 | Time and the calendar: no module reads a game time in a unit other than hours (`DAY`, `SEASON_DAYS`) except through `sim/rules` | VB-1621, VB-1540 | grep lint |

## Tensions and erosions

Severity is my judgement of the damage if left as written.

| Task | Principle | What happens | Severity |
|------|-----------|--------------|----------|
| VB-1175 (VB-650, 672, 677, 675, 637, 1586) | Nothing teleports ("no task adds one, however small") | 11 teleports collected, 4 mended; new tasks add more (VB-1585 water with the roof, VB-1586 cart taken at the field, VB-1551 drawn frost); the hard rule has the weakest follow-up of any principle | high |
| VB-1240 | Every act is a pawn's | culture's change was an act with no pawn (mended by VB-1104 through `decide`); a child walks alone by `goHome` (VB-1602 line) | medium |
| Principle numbering (about 124 files: VB-1123, 1645, 763, 773, 693, 708, 1494...) | Like is shown alike / Parity / Estimate | "principle 15" means two things (VB-1645 against VB-773); "principle 2" means growth in VB-693 (target-v2 2 is "one writer per field"); unresolvable from current docs | high (traceability; the review tool quotes principles) |
| VB-318 (blocked) | A label is read, never a switch; Class feeds a rule only through hysteresis | derived class (tenant, cottager, peasant, elite at `CLASS.eliteIn` 1.25) drives rule contributions (priority falls to 2 of 10; standing +0.2). Target-v2 principle 7 permits it through hysteresis, but Kim's 16 Nov says a label gets a cut point only where a measure falls into two groups; VB-318 predates it and was not re-opened | medium |
| VB-312 and VB-276 (criteria text) | Mechanisms, not prescriptions; Every act is a pawn's | criteria still name verb `lend`, fixed "quarter more" and "whole sacks of 10"; later notes (16 Nov) replace the verb with an offer; fixed interest is a custom, fine, but the stale text is not | medium |
| VB-1553 | Mechanisms, not prescriptions | a mechanism ships disabled (`keep` 1) because `tests/hay.js` and `tests/meadows.js` encode result thresholds | medium |
| VB-1668 / VB-1472 | Design leads code | project limit removed in code ("Kim, 24 Nov"), the design that replaces it is blocked; guards stay as "the head's prudence" | medium |
| VB-459 | Customs may prescribe; Hunger presses, the feast binds | a yearly feast called on a threshold (`FEAST.above`), "at most one a household a year", "until 20 guests are asked", and "if more than half host, try FEAST.above 2.5": tuned toward a share (low quota flavour). Fine as a first version, but the same shape recurs in VB-644 and VB-769 | low |
| VB-708 | An elite is what the rules leave over | "Kim expects about one or two big men a village" is reported as a description, no count set; consistent. But "no cycle, no depth cap" and "pyramids wanted in place before the outside world" is a target stated as a design aim | low |
| VB-523 | A chance that stands for a judgement (G7) | belief by chance `belief` 0.6 + trust and fit; telling by chance 0.3 x sociability; in a design explicitly "model B" by Kim; defensible, but a draw per hearing is exactly what VB-682 asked to avoid | low |
| VB-1613 | Every act is a pawn's | the played settler's site choice is "the start screen's or a seeding argument"; the unplayed settler "takes the first" | low |
| VB-1587 | Detail where it is a decision; A wait is the thing waited for | two settler sites in three never dig (no stone within 3 h); households "not better off"; a waiting rule whose thing waited for does not exist | medium |
| VB-1606, VB-1602 | Every act is a pawn's; Hunger presses | the lone parent is refused to protect the child (close call noted: the hungry lone parent is the one refused); hungry child-days doubled on seed 42, untraced | medium |
| VB-1610, VB-1611 | Nothing teleports | a lodger at a booth takes the water with the roof; the page says a source, not that none was fetched | medium |
| VB-1476 | Nothing vanishes, Food moves through stores | the biggest silent sink of the accounts: 23% of the produce by year 50; found only because VB-403's accounts exist | high (already a ready P2 task; priority should be P1) |
| VB-1175 line "Stone, flour, peat, tar, hides, salt, iron, clay, ore and the rack still stay in the closed record" | Nothing teleports | a dissolved household's goods are fetched by no one; VB-650 closed as folded | high |
| VB-1122 / VB-1121 | Every act is a pawn's | "the line" succession: whom the player inhabits is not an act (close call, noted); correct, but it shows the principle needs a stated exception, "a game rule about the player's line, not a pawn's act" | low |
| VB-523, VB-554, VB-63 (stories) | The future is someone's estimate; Like is shown alike | none; listed because the player's "what its pawn has heard" will need its own presentation | low |
| VB-1405 (done) | Parity of command | the matcher's search and the player's list share a read-only evaluation (good); execution rechecks eligibility in the verb (a close call): the verb's check is the one door | low (positive) |
| VB-1619 (done, the review) | Principle statements | the reviewer's blocking findings need a quoted authority; with ambiguous principle numbers a quote is hard to cite | medium |

## Repair clusters

| Cluster | Tasks | Shared root cause | Invariant that would have caught it |
|---------|-------|-------------------|-------------------------------------|
| End-of-life: a party is gone | VB-779, 650, 1476, 1481, 1485, 1362, 1620, 850, 962, 1562, 1548 | each ending (death, dissolution, move, marriage merge) handles its own holdings; no common "ending" procedure, only owner throws on the next write | I1, I2, I3 |
| Vanishing and appearing goods | VB-328, 645, 675, 677, 850, 962, 1175, 1620, 1662 | goods start or end with no process; checks only for grain and food | I4, I5, I8 |
| Units and reckonings | VB-1621, 685, 1670, 1662, 444, 781, 684 | one quantity read in two units; foretold and actual hours by different functions | I9, I10, I19 |
| Red checks after merges | VB-1471, 1224, 1225, 1313, 1360, 1361, 1223, 1247, 1159, 1191, 959, 1158, 1157, 427, 661, 1565, 1562 | checks run on trajectories, not states; invariants worded for the old state; a test per feature plus no generic sweep | I16, and a constructed-state sweep per verb; I18 |
| The page tests (flaky) | VB-1507, 1654, 1495, 1593, 1145, 1235 | wall-clock steps and detached elements; tests drive the page at speed and compare with headless | not an invariant: a deterministic page clock (VB-1654 already finds the page at 60 fps and 30x ends in another state than `Sim.advance`) |
| The skip and its stops | VB-1108, 1109, 1135, 1101, 1222 (done) | the skip's cursor and stop kinds were listed by hand per event | an event table with a `stops` flag per kind |
| The caches that lag | VB-1369, 1460, 1506, 1656, 247, 1412, 1405 | derived fields refreshed at some events only; ownership absent for `w.biome` and kin | I11, I12, owners for every `w.*` field |
| Children and dependants | VB-1602, 1606, 1585, 1240 line, 695 | care is a guard added after a playtest finding | I6 |
| Quarrels with children and similar social rules built for adults | VB-1106, 1107 (kin by marriage), 1126, 1230 | a rule built on adult pairs applied to children or step-kin | an "age of account" gate as a named general term (VB-1126 names it) |
| The reckoning of reach | VB-685, 444, 781, 1494, 1595 | reach as steps, hours, any finite route | G2, I10 |

## Principle usage table

File counts over `backlog/` (944 files) by phrase; numeric citations as "principle N" are in the next table. "By name" undercounts, since
many files cite by number only.

| Principle | Files by name | Notes, misapplications |
|-----------|---------------|------------------------|
| Nothing teleports | 64 (with "vanish" wording) | most used; remedy slow (see VB-1175); VB-1585 and VB-1586 add small ones |
| Hunger presses, the feast binds | 0 by name; used as "hunger is an engine" in VB-048, VB-459, VB-407 | only island-wide numbers are judged; household-level fed-ness is reported (VB-1602, VB-1585 "households not better off") without a verdict rule |
| The island grows without the player | 0 by name; "growth by principle 2" in VB-693, 695, 696 | the number "2" is the old index; the targets are cited correctly in PR text |
| Parameters, not patches | 1 by name | the intent runs through every "tuning" row and `@tunable`; VB-1553 `keep` 1 is a mechanism with no parameter value that works |
| Mechanisms, not prescriptions | 3 | applied well in VB-405, VB-1668; weakly in VB-523 (draws), VB-459 (counts) |
| Customs may prescribe | 0 by name | used implicitly (VB-312, VB-714, VB-710 practices). A task that makes a custom a hard rule would not be caught |
| Place matters | 2 | VB-814, VB-738; roads and boats tasks cite it as "principle 9" |
| Detail where it is a decision | 0 by name; "principle 17" in 7 files | VB-744, VB-743, VB-736; sometimes strained (VB-1587 well depth bands) |
| The future is someone's estimate | 6 by name; "principle 14" in 48 files | VB-1123, VB-773, VB-763, VB-682; breaches: VB-1551 (frost), VB-1670 (the deadline) |
| Like is shown alike | 6 by name; "principle 15" in about 38 | the best-enforced in the page (VB-665, VB-664, VB-671, VB-927, VB-1532); the numeral collides with target-v2 15 |
| Practice before institution | 1 | VB-186 introduced; VB-1034 (a grave, a wake) and VB-745 apply it silently |
| A wait is the thing waited for | 3 | VB-405, VB-1557 (open, design); few later tasks check it, e.g. VB-1587's "move waits for the well" |
| A label is read, never a switch | 13 | VB-771, 773, 365 correct; VB-318 stands against it (see tensions) |
| What does not wear needs a way out | 3 | VB-741, 742 (the hoard), VB-745 (memorial); good |
| A made good is graded | 19 | VB-702's plan, VB-761-763; consistent |
| An elite is what the rules leave over | 2 by name; "principle 13" in 5 | VB-708, 705, 404; good |
| Every act is a pawn's | 22 (counting "no pawn" and "parity") | VB-1240 collects breaches; state parity not covered (G5) |
| References | 0 by name | founders and populous used constantly as "seeds"; heirs reported without a target |

Numbered citations in `backlog/` (grep `principle N`): 14 x48, 15 x38, 16 x28, 2 x26, 9 x9, 3 x8, 8 x7, 5 x7, 17 x7, 7 x6, 13 x5,
19 x4, 18 x3, 1 x3, 12 x2, 6 x2, 11 x2, 4 x1, 10 x1. The 1 to 19 range matches target-v2 section 2, but 14, 15 and 16 are used in
the sense of the design principles (estimate, like is shown alike, every act) in the tasks I read (VB-763, VB-773, VB-1123). Those
are inferred senses; the old numbering may be in a retired version of AGENTS.md.

Before and after 12 to 16 November (sample, verified by counting): 31 of the 106 sampled tasks carry a "close call", "candidate" or
"teleport" line; 28 of them are dated 13 Nov or later (the earliest three, VB-224, VB-212, VB-220, use "candidate" in the sense of
heirs or wishes, not principle candidates). None of the 22 tasks of 29 Oct to 2 Nov has one; "Decided" notes begin about 10 Nov
(VB-163, VB-212, VB-240). The early tasks (VB-002 to VB-170) rest on the design documents and state no principle; most are
still sound because their scope was small. The principles were applied to earlier systems after the fact, through the teleport sweeps
(VB-645, 650, 675, 677, 850, 962) and the plans (VB-444, 445, 682, 702), not by re-reading old tasks.

## Per-task notes (open tasks)

IDs not listed had nothing to add (mostly the refactor splits VB-1482 to VB-1493, VB-1538 to VB-1540, VB-1413, VB-1480, and the
TypeScript chain VB-376 to VB-386, which are structure, not game).

Ready, priority 1
- VB-1406: proposes a principle (declare beside the owner); wait to land it in target-v2 section 2 before code, as it says.
- VB-1471: a repair of one night; add the invariant classification rule (I18) rather than fixing red checks one by one.
- VB-1481: cause is "a pawn holds two households"; add I3 first; the criterion already asks for a pawn-holds-one invariant.
- VB-1485: the criterion forbids a silent skip (G9); add I1/I2.
- VB-1495, VB-1507: test flakiness, see the cluster; VB-1507's "steps in working hours" check against wall clock is the cause.
- VB-1548: a stuck task, its work done, never taken: I7, I8; "Nothing teleports" is the criterion.
Ready, priority 2
- VB-459: calendar-called feast, counts; see tensions. Fits "the feast binds" but call it by a household's plenty, which it does.
- VB-523: belief and telling by chance (G7); the story store drops stories nobody holds (a bounded history: good).
- VB-644: dried fish for the fair, a head's project; check the "quota" shape ("for the fair").
- VB-665: the one scale for meters; "Like is shown alike" and in need of Kim.
- VB-706, VB-707, VB-708: standing and followers; consistent with "elite is what rules leave over"; VB-707's breach is a deed, which fits.
  VB-708 adds a tenth `looksTo` relation; third dependency table in a row (client, tenant, debtor, servant): good use of the third-special-case rule.
- VB-781: plan to replace step reaches by the head's judgement of the walk; this is G2's pending candidate; do it before more reach tasks.
- VB-787: settling in steps: G8; the large open item behind VB-788, VB-789, VB-791, VB-1587, VB-1595, VB-1607.
- VB-1123: plan mode; every change is a verb any head has (good); the Plan tab is replaced; large and blocks VB-893.
- VB-1476: stakes vanish at death; G1/I1; priority should be 1 (23% of produce).
- VB-1478: the fair's animals and carts: the animal walks to the gathering and is led home; consistent with nothing teleports.
- VB-1541: names the cause of dry-day health loss; "the label is read" applies to the sim's words to the player (VB-1670 does the same).
- VB-1562: "a latent defect any change may turn red" is the clearest statement of the sweep problem; do not fix by trajectory.
- VB-1606: lone settler and child: part of G6; VB-1602 chose not to lodge the child; a close call for Kim if the numbers keep hungry days up.
- VB-1612, VB-1614: both end in "a lone village starves"; check that the cure is not a prescription (a lone settler's crop reaped early by rule); the principle says tune, do not patch.
- VB-1613: parity (G5).
- VB-1620, VB-1621: G1 and G2; VB-1621's fix (a unit) is more general than shoes: grep every `*Days` tunable.
Ready, priority 3
- VB-043, VB-044, VB-092, VB-095: the scope model; target-v2 principle 8 (a body exists only when needed) applies; a derived view.
- VB-048: wrap-up of yields; "tunes nothing, names parameters" matches Parameters, not patches.
- VB-083: seasons on the map; presentation only.
- VB-188: the plan of the ship (slice 8): will decide iron, salt, silver; apply "practice before institution" for the Church.
- VB-247: jobs hold objects, not ids (plain-data state); the save codec exists for it; a refactor with a determinism payoff.
- VB-276, VB-312, VB-319: stale text (see tensions); VB-319 wage of 3 rations a day is a worth-table entry (fine).
- VB-296, VB-297, VB-298, VB-303: the gathering: "the villages tied" and "marriages made at the gathering"; mind the label rule (a gathering host is not a switch, VB-834's measure asks that).
- VB-329: no pawn walks where there is no route: a teleport (the straight leg over the sea); P3 for a hard-rule breach; should be higher.
- VB-361: facilities registry; VB-363 dress; VB-366 pots: "graded" and "wear needs a way out" (pots break).
- VB-446: cattle lanes in the outland: G2 (reach); VB-714 and VB-710: commons by custom (customs may prescribe).
- VB-638, VB-663: the marriage valve measured; "a wait is the thing waited for": long runs against the growth budget.
- VB-684: one unit of load; G2.
- VB-687: a tile changes holder one way: an invariant stated as a task, good.
- VB-694, VB-695, VB-696, VB-697, VB-825, VB-827: the round as offers; consistent with "every act is a pawn's"; VB-695 adds the dissolved household's people (an act with no pawn found in `extinct`).
- VB-736 to VB-745: ores, kettles, bell, hoard: each a decision; they apply "what does not wear needs a way out" and "graded"; blocked chains, low risk.
- VB-762, VB-763: grades drawn when forged, one mark: consistent.
- VB-769, VB-770, VB-771, VB-772, VB-773, VB-774: the town; labels shown, none reads; VB-772 "a maker may move to its buyers" is a pawn's own wish.
- VB-782: land cover by seed; VB-809, VB-810, VB-811, VB-812, VB-813, VB-814, VB-815, VB-817: roads, boats, sledges: "place matters"; VB-817's right of way by village grant fits "rights are exempt".
- VB-1034: births and deaths leave something to see: "practice before institution".
- VB-1152, VB-1389, VB-1404, VB-1410, VB-1415, VB-1420, VB-1425, VB-1465: measure tasks owed by earlier tasks: 10 of the 203 are measures a task closed without; they end up unscheduled; see the observation below.
- VB-1175, VB-1240: collectors; both name "swept at a slice's wrap-up", but no slice has been wrapped since they opened (VB-304, VB-035, VB-371, VB-818 still blocked). Suggest a deadline or a named owner.
- VB-1412: one order for every due-queue; invariant on `st.obligationsDue` exists (verified); this extends it.
- VB-1460, VB-1369: the lag of roles (I11).
- VB-1494: a village blazes a trail: "the alderman carries out what the meeting decides": consistent with every act is a pawn's; the criterion asks whose hands, correct.
- VB-1526: crops by ground: a table, not a rule; good.
- VB-1560: report shares of pastimes; "parameters not patches": weights need measuring.
- VB-1597: "one rule for whom the head allots": the third special case in `takeDay`.
- VB-1645: G5 and I6; the sleep of every pawn; the verb for a pawn's own logic.
- VB-1656: I12.
Needs-review
- VB-455: split sim/records: the register and the log; owner questions (VB-395, VB-372, VB-456 blocked on it).
- VB-1470, VB-1126, VB-1292: Goal "(to write)": three tasks with no goal; flag.
- VB-1564, VB-1369: cost; VB-1364: not built, waits on VB-312.
- VB-1583, VB-1585, VB-1587, VB-1602: water and child; each notes a "close call" and measured "households not better off" in VB-1587 and, for seed 42, VB-1602: the tension is between the keep-a-child and the hungry parent.
- VB-697: asks for a plot answered by the custom: fine.
- VB-722: seed as a strain fitted to its climate; "nothing now" per Kim, 16 Nov.
- VB-1506: owners for `w.biome`, `w.trees`, `w.stones` (about ten writers each): the ownership check is silent on them; I11/I13.
Blocked
- VB-1472, VB-1553 (the second half), VB-1557, VB-1472: waits on Kim; the question in each is the design pass behind code already merged (G10).
- VB-1618, VB-1617: evaluations of the review and the context reset; process.
- VB-315, VB-316, VB-317, VB-318, VB-320, VB-321, VB-034, VB-035: slice 5 chain: debt and land; this is where I1 and G1 matter most (a debtor household dissolved, a creditor dissolved, a tenancy ended); VB-315 specifies partial failure; make I1 the first criterion of each.
- VB-464: patronage: the closest cousin of VB-708; the `PATRON.days`, `PATRON.above` thresholds are numbers on a balance, no tie stored: "a label is read".
- VB-554, VB-063: stories wrap-up.
- VB-636: settling families come with the ship: immigrants must arrive carried (Nothing teleports applies to people).
- VB-788, VB-789, VB-790, VB-791, VB-1595, VB-1607: the far-settling chain: all wait on VB-787 (L, ready).
- VB-893, VB-1556: Plan tab show; a member's voice: after VB-1123 and VB-1553.
- VB-411: the carts' tuning; Kim starts it.

## Observations that cut across sections

- Measures owed. Ten ready P3 tasks (VB-1152, 1389, 1404, 1410, 1415, 1420, 1425, 1465, 1292 and VB-1470) are measurements a closed task
  deferred. VB-662 and VB-997 are done examples of the same. A task closed with an unticked "measure" criterion has no due date: a
  cheap rule would be that a task with an owed measure does not close, or its measure joins the night's report automatically.
- Surfacing leaves a pending-candidate gap. `design.md`'s principle list shows what Kim accepted; the candidates (G2, G7, G8 above, plus VB-228's
  "a guard is a lookup, and lives where its subject does", VB-418's "a kind that takes from one module and puts into another lives at or above both")
  live in plan files. I found no list of the unresolved ones. A file `docs/principle-candidates.md` with a line each (status: proposed,
  accepted, struck, with the decisions behind it) would close the loop `AGENTS.md` describes.
- Cost against mechanism. VB-1554 and VB-1558 asked Kim whether a newly due task may be slotted in rather than the day weighed anew;
  VB-1564 caches a holder's opportunities. Each cost cut touches a Decided mechanism; the questions to Kim are answered, so the
  process works, but the rule ("when its tasks change, every member is weighed for every task") has no statement of what is an
  equivalent cheaper computation: a principle candidate: "a cheaper computation must give the same answer as the Decided one on a
  constructed state, or the difference is a design decision" (see `tools/same.js`, used in VB-1668, VB-1553).
- Found-by-playtest. A large share of the post-17 Nov defects (VB-1101, 1106, 1107, 1108, 1109, 1110, 1121, 1662, 1670) came from
  one human or agent playing the page; the simulation's own checks had not seen them. The invariants are strong on structure and weak on play
  states: a "played pawn's day" probe in the bands would catch kin gates, skip stops, and the like.
- Verified against inferred. Verified by reading: VB-1175's counts, `allowAgeLag`, the VB-650 closing note, the VB-1553 `keep` decision,
  the VB-1620/1476/1481/1485/1362/779/1565/1662/1670/1598/1587/1602 notes, all candidate lines quoted in G7 and G8. Inferred: principle
  numbering history, the sense of "principle 9/17" in tasks, severity of VB-318 (blocked, unread beyond its first criteria), the
  states of tasks I read only by Goal (about 140 of the 203).
