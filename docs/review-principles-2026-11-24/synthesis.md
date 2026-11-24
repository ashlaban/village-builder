# Principles review, synthesis: 24 November 2026

Synthesis reviewer: a read-only agent run. Nothing in code, tasks, `design.md` or the two reports was changed; this file is the only output.
Everything proposed here is a proposal for Kim. Kim decides principles; until then nothing below is in force.

**Inputs.** `tasks.md` (203 open tasks, 106 sampled done ones) and `prs.md` (293 PRs, bodies only) in this folder.

**Read for this synthesis.** `design.md` lines 51 to 151 (vision, Kim's terms, Principles for decisions); `target-v2.md` section 2 (the
19 principles) and its contents; `AGENTS.md`; `docs/cost.md` 1.3 (the ten rules); `docs/balance/cards.md` (the balance properties).

**Checked against the repository** (marked *verified* below): `backlog/VB-1175.md`, `VB-318.md`, `VB-1553.md`; the status of 17 tasks
by `tools/backlog.js show`; `tests/lib/invariants.js`, `tests/accounts.js`, `tests/clock.js`, `tests/suites.js`; `src/sim/rng.js`,
`src/sim/weather.js` and every reader of `frostDay` and `frostExpected`; `src/owners.json`; `tools/inbox.js`; `QUESTIONS.md`; the body of
PR #199; grep of the principle documents for each pending candidate. Everything else is taken from the reports and marked *inferred* or
*from the report*. Git history here begins on 22 November, so nothing earlier could be checked in history.

**A warning on labels.** Both reports number their proposals G1, G2, ... and I1, I2, ... with different meanings. Below, `T-G1` is
`tasks.md`'s G1 and `P-G1` is `prs.md`'s.

## In short

1. The reports agree on the main finding and it holds up: **endings are the weakest part of the game's rules.** When a pawn dies or a
   household dissolves, what it held, owed and was owed is handled case by case. Four such repairs are still open (VB-1476, VB-1481,
   VB-1485, VB-1620; verified).
2. **Candidates are surfaced and then never decided** (verified). About 20 candidates raised since 16 November have no outcome. `inbox.js`
   sends them to the PR text and to no file, so there is no list to decide from. "The decision made stands" has made agents the authors
   of standing rules.
3. **Principle numbers no longer mean anything** (verified, and worse than reported). The numbered list the tasks cite (1 to 20) exists
   nowhere in the repository today. `target-v2.md`, `design.md` and `docs/slices.md` still cite it, and two other number spaces
   (target-v2's 1 to 19, the cost rules 1 to 10) collide with it. Principles need names, or stable ids.
4. Five of Kim's principles are one rule seen from five sides: **the simulation has no hand of its own.** It may not move a thing
   (Nothing teleports), do an act (Every act is a pawn's), know ahead for a pawn (The future is someone's estimate), judge for a pawn
   (A wait is the thing waited for) or set an outcome (Mechanisms, not prescriptions; An elite is what the rules leave over). Stating
   it once closes the gaps the reports found between them: the die that stands for a judgement, the rule that reads a draw not yet
   fallen, state held for the player alone.
5. One new principle is needed, not a corollary of any existing one: **nothing is left to no one.** A party ends only as the last
   step of a process that passes on or ends each thing it holds, each right and each obligation.
6. "Nothing teleports" needs one sharpening that the text already implies: **title moves at once, custody only by a journey.** It decides
   the stake cases (VB-1476, VB-637, VB-672) that are now filed as teleports with no agreed cure.
7. The principle documents contradict each other in three places: whether class may feed a rule (design says no label does;
   target-v2 7 and VB-318 say class may); whether the player may have more choices than a pawn (design says a player's choice is every
   pawn's; target-v2 15 says the player may be offered more); and "no class is given a count to reach" beside the 600 / 325 / 75 split.
8. Readings of the drawn frost were filed as teleports (VB-1175). They are not: knowledge is exempt from that rule. The rule that binds
   is the estimate principle, whose text covers only what the player is shown. The frost is now mended (verified), by convention only.
9. Several of the reports' invariants already exist: chunk-independent time (`tests/clock.js`), about twenty per-collection checks on
   the dead and the dissolved, a hard 1% close on the food and grain accounts. The gap is that each was added after its bug. The two
   with the largest payoff are general ones: a schema-driven walk of every id in `st`, and a ledger that closes for every good.
10. A hard check that asserts an outcome on a seed (`tests/hay.js`: 89% of meadows in by day 4) acts as a prescription: it kept a
    Decided mechanism switched off (VB-1553, verified) and it is what makes tests break when a draw shifts. Hard checks should state
    what holds in any state; outcomes on seeds belong to the bands.
11. The carer rule both reports propose (a child under 7 is never left alone) conflicts with "Mechanisms, not prescriptions" as built:
    a verb refuses the hungry lone parent. It needs Kim's choice between a ban, a custom and a weighed cost.
12. Recommended order: decide the candidate backlog (a ledger, six questions), fix the numbering, then build four invariants
    (ids resolve, every good's ledger closes, no decider reads an unrealised draw, caches equal their sources with no lag).

## Verification of the reports

| # | Claim | Report | Verdict | Evidence |
|---|---|---|---|---|
| 1 | Candidates raised after 16 Nov are never promoted or struck; there is no ledger | both | **Confirmed** | grep of `design.md`, `AGENTS.md`, `docs/architecture/*.md`, `QUESTIONS.md`, `docs/tuning.md` for "stands for a judgement", "argued in hours", "live as it", "dead band", "cannot keep itself": no hit. `tools/inbox.js` line 384: "candidates and decisions go to the PR (report), not to a file". `QUESTIONS.md` holds 4 blocks, none a candidate |
| 2 | Dead and dissolved holders are the largest repair cluster, with no invariant | both | **Confirmed, with a correction** | VB-1476 (ready, P2), VB-1481 and VB-1485 (ready, P1), VB-1620 (ready, P2). But `tests/lib/invariants.js` already holds about twenty such checks (trusts 117, plans 209 and 342, claims 1184, herds 1906, goodwill 2003, ties 2025, members 772, holder 777, ledger 957, ale 885). They are per collection, each added after its bug. Not checked: a dead pawn's stake (lines 185 to 190 test only a finite number and a living pawn with no household), and a dissolved household's goods other than its ledger and ale |
| 3 | "principle N" citations are ambiguous | tasks | **Confirmed, and worse** | The numbered list is in neither `AGENTS.md` nor `design.md` today, nor at the first commit of the history kept here. Live citations of it: `target-v2.md` line 71 ("`AGENTS.md`, Deciding without Kim, 20"), `design.md` line 598 ("principle 16"), `docs/slices.md` line 331 ("principle 17"). `docs/plans/VB-1406-overlap.md` uses "principle 18" for target-v2's determinism. The reports disagree on old 17: `tasks.md` reads it as "Detail where it is a decision", `prs.md` as "goods carry their material's kind"; `slices.md` supports `prs.md`. Old 2 was growth, 9 place, 13 elite, 14 the estimate, 15 like alike, 16 every act, 19 the wait, 20 the label (from the citations' context) |
| 4 | Only the grain and food accounts close | tasks | **Confirmed** | `tests/accounts.js` lines 46 and 47 assert food and grain within 1% of produce; no other good |
| 5 | The accounts' `unexplained` is "a report today" | prs | **Partly wrong** | It is a hard assertion in the suite (`tests/suites.js` line 146), on one scenario and at 1%, not at zero and not on every scenario |
| 6 | VB-1175 holds 11 teleports, 4 mended | tasks | **Confirmed** | 11 lines, 4 ticked. A twelfth (VB-1655: a moved house takes the herd's home tile and the water with it) is in the notes of 24 Nov, not yet a line |
| 7 | New tasks add teleports against "no task adds one" (VB-1585, VB-1586) | tasks | **Partly right** | VB-1585 built thirst with the booth's water arriving with the roof, logged it, and VB-1601 mended it the next day (ticked). VB-1586's cart is open. They were added knowingly and logged, which the rule's words forbid and the collection procedure in practice allows |
| 8 | VB-318 stands against "A label is read, never a switch" | tasks | **Confirmed as a conflict of texts**; severity overstated | VB-318's second criterion feeds elite into two rule contributions and cites `AGENTS.md`'s hysteresis line. But its fifth criterion measures "the households between 0.75 and 1.25 on each measure", which is the test the label principle asks for (a cut point only where a measure falls into two groups). See Inconsistencies, c1 |
| 9 | Deciders read the drawn frost | both | **Confirmed, and now mended** | `frostExpected` is read by `sim/hands`, `sim/fieldwork`, `sim/fieldplans`, `sim/agenda`, `sim/reasons`, `sim/plandays`. `frostDay` is left in `sim/clock`, `sim/fields`, `sim/meadows` (the frost falling), `sim/planchains` (`frosted`: has it come) and `sim/plandays` (on the day). No lint keeps it so |
| 10 | The roles invariant carries a loosening | tasks | **Confirmed** | `tests/lib/invariants.js` line 26: `checkRoles(st, globalThis.VB, { allowAgeLag: true })` |
| 11 | Standing duties ship switched off because of `tests/hay.js` | tasks | **Confirmed** | `backlog/VB-1553.md`, note of the decision: `MATCH.keep` ships at 1; every value above turned `tests/hay.js` (89% of 90 asked) and `tests/meadows.js` red. Kim's three answers are in `QUESTIONS.md`; the task is still blocked on Kim |
| 12 | Code ran ahead of design on the one-project limit | tasks | **Confirmed** | VB-1668 done 24 Nov; `design.md` line 919 still says "the head takes one project at a time", line 1499 "one project by values"; VB-1472 blocked on Kim |
| 13 | A doc simplification dropped the teleport ban, restored three days later | prs | **Confirmed** | PR #199's title: "Review follow-ups: restore the teleport prohibition ..." |
| 14 | Time may depend on how a run is chunked (P-I8, "could not verify the fix") | prs | **Already checked** | `tests/clock.js`: the same state hash by chunks of the whole, a day, an hour and 0.1 hours; over a year in `verify` |
| 15 | Tests break because of "one shared draw order across features" (P-G9) | prs | **Partly wrong** | `src/sim/rng.js` gives each system its own stream (Kim, 2 Nov). A new draw shifts only later draws of the same stream. The cases cited (customs at seeding) are within one stream |
| 16 | State and verbs built for the player alone (T-G5) | tasks | **Confirmed in part** | `src/owners.json` has `st.player.sleep`; exactly one verb is registered with `sources: ['player']` (`src/sim/player.js` line 263). The rest of T-G5's list was not checked |

Not verified, taken from the reports: the six nights merged red (#168 to #175), the counters re-recorded in #176, the 32 PRs with
task id collisions, the name-citation counts of `tasks.md`'s usage table.

## Inconsistencies

### a. Between the two reports

- **Is reading the drawn frost a teleport?** `tasks.md` lists VB-1551 under erosions of Nothing teleports; `prs.md` says knowledge is
  exempt and the estimate principle binds. `prs.md` is right by the principle's own words ("Rights and knowledge are exempt"). VB-1175
  holds the finding as a teleport line (verified), so the collection procedure filed a knowledge fault under the wrong rule because
  no other collecting task existed.
- **How many candidates are pending?** `tasks.md` says three (plus two in passing), `prs.md` about twenty. Not a contradiction:
  `tasks.md` read plan files, `prs.md` every "For Kim" section. `prs.md`'s list is the fuller one.
- **Old principle 17**: see verification 3.
- **VB-1553.** `tasks.md` treats shipping the mechanism at its off value as an erosion; `prs.md` records the same decision as a
  candidate principle (25: "ship the nearest tried value that passes"). The candidate would make the erosion the rule. See d5.
- **The accounts.** `tasks.md` calls them a check, `prs.md` a report. They are a check on one scenario (verification 5).
- **The dead-holder invariant.** Both say none exists. Many exist (verification 2); neither report opened the checks before proposing
  T-I1 and P-I1. Their proposals are still right in kind: a general walk instead of the next single check.
- **The carer.** Both propose it (T-G6, P-G8) as a refusal. Neither notes that `prs.md`'s own candidate 26 ("a place's drawback is a
  cost someone pays ..., never a rule forbidding it") argues against a refusal. See c7.

### b. Where a report misreads a principle

- `prs.md` P-G4 says target-v2 "allows only class through hysteresis". Principle 7 is about a *derived view feeding a rule*. A dead
  band on a pawn's *choice* (keep the field or let it go) is another thing, and nothing forbids it; it is merely unstated.
- `tasks.md` holds VB-459 (the feast) and VB-708 (big men) against "An elite is what the rules leave over". A threshold on a
  household's plenty and a reported expectation are not quotas. Dropped as tensions.
- `tasks.md` says "Every act is a pawn's" needs an exception for the player's line (VB-1121). It does not: whom the player inhabits
  is a rule of the game's frame, not an act in the world. One sentence in the principle would say so (see P1).
- `prs.md` P-G9 asks for draws keyed to (system, entity, day). The streams are already per system, and keyed draws would change every
  seed in the game. The cheaper cure is in the tests (d5).
- Both read "The future is someone's estimate" as covering decisions. Its text covers "what the player is shown". The decision side
  is target-v2 16 (the actor view, "omniscient today") and `design.md`'s "All is known to all for now". Read together, these three
  permit a head to read the drawn frost. The fix was right; the texts do not yet say so (c3).

### c. Among the principles themselves

1. **May a class feed a rule?** `design.md`: a person's name for what it is ("smith, landed") "feeds no rule". Target-v2 7: "Class may
   feed a rule, through its hysteretic value only"; a place's label feeds none. `AGENTS.md`: "A categorical derived view (class, tier)
   feeds a rule only through hysteresis", where "tier" is the very thing target-v2 7 says a place does not have. VB-318 follows
   target-v2. Three texts, two answers. P4 proposes one.
2. **A count to reach.** "No road, office or class is given a share or a count to reach" stands beside the balance property "600
   farming / 325 town and craft / 75 elite" (`docs/balance/cards.md`; target-v2 6.3), which #151 already expects not to meet (from the
   report). Target-v2 17 offers the way out (a band is a probe's target, not a controller's), but the elite principle's words do not
   admit even a probe's count.
3. **Who knows what.** "All is known to all for now" (section 1), "The future is someone's estimate", and target-v2 16 fit together
   only with a line nobody wrote: all of the present and the past is known to all; nothing of the future is.
4. **Parity, stated twice and differently.** `design.md` (16 Nov): "a choice the player is given is a choice every pawn makes".
   Target-v2 15 (10 Nov): "The player may be offered more options than the pawns' logic uses ...; never fewer." The first reads as
   equal choice sets, the second allows the player more. The workable reading is: the same verbs and checks for all; a pawn's own
   chooser may consider fewer of them for cost. Neither text mentions state, which is where the breaches are (`st.player.sleep`).
5. **The same rule at three layers.** "Every act is a pawn's" (design), parity of command and "the player is a source" (target-v2
   15), "decisions aggregate; commands carry out" (target-v2 10) and the verb convention (`AGENTS.md`) are one rule. So are "A label
   is read" (design), target-v2 7 and the hysteresis line of `AGENTS.md`; and "Nothing teleports" with target-v2 5 (title and
   custody) and "Food moves through stores operations" (`AGENTS.md`). Each copy has drifted a little (c1, c4). One statement each,
   with the other layers pointing at it, would stop that.
6. **Overlap within the list.** "A wait is the thing waited for" repeats the example of "Mechanisms, not prescriptions" (what makes a
   couple wait) as a rule of its own; "Customs may prescribe" is the exception to both. "Practice before institution" and "A label is
   read" both say that the name comes after the doing.
7. **A body's beginning.** Target-v2 8: "A body exists only when something needs its identity" (as late as possible). Pending
   candidate: "a body exists from the day people live as it" (as early as people do). They agree once the end is added: a body exists
   exactly from its first holding, obligation or agent to its last. That is also the missing rule of endings (P2).
8. **The one hard rule.** `design.md` calls Nothing teleports "the one hard rule". Target-v2 section 2 calls its nineteen "the
   invariants", and "Every act is a pawn's" is enforced by `tests/commands.js`. In practice there are several hard rules and
   the hardest-worded one has the slowest remedy (d2).
9. **Cost against conservation.** Cost rule 1 (no loop walks the dead) and rule 9 (routine records are folded) are sound, but rule 1
   means that whatever is left on a dead pawn is never visited again, and rule 9 is the obstacle VB-1662 names to closing a
   good's account (from the report). The rules need a clause: a party's end empties it; an account closes before its year is folded.
10. **Dead references in the rule documents themselves.** `docs/cost.md` 1.3 cites "`AGENTS.md` (Rules for cost)", a section that no
    longer exists, and rule 7 argues from "the golden file", retired (`AGENTS.md`: "No golden file").

### d. Between the principles and how the project runs

1. **Kim decides principles; the channel has no end.** Verification 1. `AGENTS.md` says "the third decision of one kind" raises a
   candidate, and "At the third special case, propose a general rule", but nothing counts decisions by kind, so recurrence is noticed
   only by chance (`prs.md`: nights that say "no principle candidate" while repeating an earlier one).
2. **The hard rule has the softest follow-up.** The teleport collector VB-1175 is P3, "swept at a slice's wrap-up", and no slice has
   wrapped since it opened (from `tasks.md`). VB-329 (a pawn walks a straight line where there is no route; `src/sim/journeys.js`
   line 71 keeps the fallback, verified) is P3.
3. **`design.md` is read-only for the agents who change its subject.** Verification 12 is one case; `prs.md` lists seven PRs of drift.
4. **The review needs a quoted authority** (VB-1619) and the authorities are cited by numbers that no longer resolve (verification 3).
5. **"A new check is built on a small constructed state" against hard checks on seeded outcomes.** `tests/hay.js` asserts a share on a
   seed. Such a check breaks when any draw moves (the seed-moving repairs of `prs.md`) and holds a mechanism off (VB-1553). Target-v2
   17 already says a band is a probe's target. The hard tier does not follow it.
6. **Ratchets only fall, hard failures block merging**: both were bent on named nights (from `prs.md`: #176; #168 to #175). Not verified.
7. **Measurements owed** become P3 tasks with no date (ten open, from `tasks.md`), while AGENTS step 6 lets a task close with the
   criterion unticked.
8. **Four number spaces** (old principles, target-v2 principles, cost rules, design sections) are cited as bare numbers ("rule 5",
   "principle 2") in tasks and code comments.

## A coherent vision

**What the game is about.** A society grows by itself on an island, out of what individual people do with land, labour, food and each
other, and the player lives one life (then a line of lives) inside it with no power the others lack. The interest is in watching, and
steering from within, how strata, customs and places emerge from ordinary pressures: hunger, distance, plenty, inheritance.

Everything Kim has decided follows from four axioms.

1. **The world is physical and keeps its books.** Things are somewhere, in someone's keeping. They move by journeys, come to be and
   cease by processes, and time and distance cost. (Nothing teleports; Place matters; What does not wear needs a way out; Detail where
   it is a decision; the cost of carrying.) Rights and knowledge of the present are the declared exception: they are free.
2. **Only people act, with what they have and can know.** The simulation supplies nature and chance and nothing else: it does not
   carry, choose, foresee, judge or aim. (Every act is a pawn's; The future is someone's estimate; A wait is the thing waited for;
   Mechanisms, not prescriptions; Customs may prescribe, because a custom is a rule people hold; the player is a source.)
3. **Structure is what is left over.** Classes, towns, offices, institutions and cultures are read from what people did, and are never
   switched on, named ahead or given a size. (An elite is what the rules leave over; A label is read; Practice before institution;
   Hunger presses, the feast binds; The island grows without the player; balance loops tuned, never steered.)
4. **The game is legible.** What the player sees is true to the first three: the past as it was, the future as someone's estimate,
   one presentation for one kind of thing. (Like is shown alike; the estimate; Parameters, not patches, since a named parameter with a
   meaning is legibility for the one who tunes.)

**Where today's set does not fit this.**

- **Endings are missing from axiom 1.** The principles say how things begin and move, not what happens to them when their holder is
  gone. This is the largest repair cluster.
- **Axiom 2 is stated in pieces**, so its gaps go unnoticed: no piece says a die may not stand for a judgement, that a decider may not
  read a draw before it falls, or that the player may hold no state a pawn lacks.
- **The free exception of axiom 1 has no edge.** Title and custody are told apart in target-v2 5 but not in "Nothing teleports", so a
  stake that is a right to grain is treated as grain and filed as a teleport.
- **Axiom 3 is contradicted in two places**: class feeding rules by a cut point (c1), and the 600 / 325 / 75 split (c2).
- **Reckoning has no principle.** Axioms 1 and 4 both need quantities to mean one thing (the hours a walk is estimated at and the
  hours it takes), and the unit and estimate repairs show they often do not.
- **The principles list mixes kinds.** "References" is a reporting convention; "A made good is graded, a built thing is not" is a
  design decision about one system. They are right, but they are not rules for deciding other questions.

## Proposed principles

For Kim. Seven proposals: one umbrella that restates five existing principles and closes their gaps, one sharpening, three new
principles, one question, and one process rule. Existing principles keep their names and remain as the named cases.

### P1. The simulation has no hand of its own (umbrella; restates and extends)

*Statement.* The simulation supplies nature and chance. It never moves a thing, does an act, knows ahead, judges or aims: each of
those is some pawn's, with what that pawn has and can know.

*The five cases, each with the gap it closes.*

| Case | Existing principle | Extension proposed |
|---|---|---|
| It moves nothing | Nothing teleports | none here (see P2, P3) |
| It does no act | Every act is a pawn's | **State too**: whatever state the played pawn has, every pawn has; `st.player` holds only the frame (who is played, the view, the line). A verb names the position that may issue it (head, grown member, alderman), and its check tests the position for any pawn. The game's frame (whom the player inhabits, the skip, a save) is not an act |
| It knows nothing ahead | The future is someone's estimate | **Decisions too**: no decision reads a draw before it falls or a quantity not yet realised. All of the present and the past is known to all (for now); nothing of the future is |
| It judges nothing | A wait is the thing waited for | **Chance too**: chance is for what nobody decides (weather, a birth, a death, a find). A pawn's yes or no is a threshold on what it weighs, never a die and never a count of years |
| It aims at nothing | Mechanisms, not prescriptions; An elite is what the rules leave over; target-v2 17 | **Checks too**: a hard check states what holds in any state; an outcome on seeds (a share, a rate) is a band's target and never blocks a mechanism |

*Rationale.* The five are found and repaired separately because they are written separately. One sentence lets an agent ask of any
new line of code "whose hand is this?", and the answer is a pawn, nature or chance.

*Subsumes.* Pending candidates: "a chance that stands for a judgement becomes the judgement" (VB-682), T-G4 and P-G2 (no unrealised
draw), T-G5 (player state), P-G3 (no count or chance alone), P-G7 (a verb belongs to a position), candidate 16 ("nothing breaks off
what a pawn chose but the pawn"), candidate 26 (a drawback is a cost, not a ban), candidate 25 (struck: see the last case).

*Evidence.* VB-1551, VB-1670, #211, #271, #282 (the frost); VB-682, VB-693, VB-646, VB-1103, VB-1118 (dice and counts); VB-1645,
VB-680, VB-1613 (player-only state and choices); VB-1553 (the outcome check that held a mechanism off); #221, #252, #275 (who may
issue a household's verb, answered three ways).

*How it decides open cases.*
- VB-523 (belief at chance 0.6 + ..., telling at chance 0.3): believing and telling are judgements, so each becomes a threshold on
  trust, fit and sociability. Which story is overheard at a venue may stay a draw: nobody decides it.
- VB-1612, VB-1614 (a lone settler's crop lost to frost): the settler reaps by the frost it expects; no rule reaps early for it.
- VB-1613: the settler's site is chosen by a verb any settler issues; the start screen issues it for the played one.
- VB-1645: `st.player.sleep` moves to the pawn; the sleep verb gains the pawn's own source.
- VB-1553: `tests/hay.js`'s 89% becomes a band; `MATCH.keep` is then set by Kim's tuning, not by which value keeps a test green.
- VB-787: who may blaze is the position the verb names; the answer is then the same for the boat (#221) and the cull (#222).

### P2. Nothing is left to no one (new)

*Statement.* A party (a pawn, a household, a village, a plan) ends only as the last step of a process that passes on or ends each
thing in its keeping, each right it holds and each obligation it owes or is owed. A body exists from its first holding to its last.

*Rationale.* Conservation needs a rule for endings, and the cost rules make the need sharper: no loop visits the dead, so whatever
stays on them is lost for good. The household that has died out is not dissolved while its barn is full: it stands as an estate,
with no members, until the last good has gone by a process (inherited, fetched, passed with the farm, rotted where it lies).
`sim/heirs` already does this for grain and wood (`handingOn`, `estate: true`; VB-1175's note of 23 Nov, verified).

*Subsumes.* T-G1, P-G1; the pending candidate "a body exists from the day people live as it" (VB-445) and target-v2 8, joined into one
rule of a body's lifetime; target-v2 6 (rights point at rights, so the right passes and the tenancy stands) as its case for rights.

*Evidence.* VB-779, VB-650, VB-1476, VB-1481, VB-1485, VB-1362, VB-1620, VB-850, VB-962, VB-1562; #152, #199, #203, #212, #263.

*How it decides open cases.*
- VB-650's remainder (stone, flour, peat, tar, hides, salt, iron, clay, ore, the rack): the household stays an estate until they
  pass. The cheapest process is that they pass with the farm to whoever takes it. No new fetch kind is needed.
- VB-1481: the handover orders its steps so the old home is emptied before it is dissolved; "a pawn holds two households" cannot arise.
- VB-1620: a dissolving household's shoes go with their wearers or with the estate.
- VB-315, VB-317 (debt and tenancy, slice 5): each names, as a first criterion, what happens when either party ends.

### P3. Title moves at once; custody moves by a journey (sharpening of Nothing teleports)

*Statement.* What is owned may change owner where it lies, at once. Where it lies changes only by a journey. Whoever uses a good
must have it in reach, not merely own it.

*Rationale.* The principle already says "a gift, a share or a loan changes owner where it lies and waits to be fetched", and
target-v2 5 holds title and custody apart. The sharpening is the last sentence: an owner far from its goods cannot eat them.

*Subsumes.* P-G12 in part (who carries what stays a table, not a principle).

*How it decides open cases.*
- VB-637 (a pawn's stake moves with it as a number): the stake is title to grain in a named store. It does not move when the pawn
  does; the pawn's provisions on the road are what it carried from that store.
- VB-1476 (a dead pawn's stake vanishes): title passes at once to the pawn's successor by custom; the grain stays in its store. No
  fetch is needed, and the largest term of the food account's `unexplained` (from the report) closes.
- VB-672 (shares, trust and inheritance grain change barn at once): the owner changes at once, the barn does not.

### P4. A rule reads the measure, never the name (merges and resolves)

*Statement.* What a person, a household or a place is called is read from what it does and feeds no rule. A rule that wants what the
name stood for reads the measure behind it. A name gets a cut point only where the measure falls into two groups; the practice
comes before the institution that later keeps it.

*Rationale.* This is "A label is read, never a switch" extended to class, with "Practice before institution" as the same rule in
time. It settles c1: target-v2 7 and the `AGENTS.md` line would then say that class is shown with hysteresis and feeds no rule.

*Subsumes.* A label is read; Practice before institution; candidate 24 (a role's absence is read from whom the head allots).

*How it decides an open case.* VB-318: the two effects of being elite read the measure. The holder's priority for field work falls
as income from others rises against need, and standing rises with it, both as declared contributions with a range. "Elite" is then
only shown. If Kim prefers the cut, VB-318's fifth criterion (households between 0.75 and 1.25) is the evidence to wait for.
*Also for Kim under this heading:* whether 600 / 325 / 75 is a probe's band (then the elite principle's words should admit it) or is
dropped (c2).

### P5. One quantity, one reckoning (new)

*Statement.* A quantity has one unit, one scale and one function that reckons it. A bound is kept in the unit it was argued in. An
estimate is reckoned by the same function as the doing, from what the estimator knows, so the two differ only by what it cannot know.

*Rationale.* The principle of legibility for numbers. Target-v2 13 (distance has one source), 12 (custom through one door) and 2 (one
writer per field) are its code-level cases, and "Like is shown alike" is its case for presentation.

*Subsumes.* T-G2, P-G5 and the pending candidate "a bound argued in hours is kept in hours" (VB-444); T-G3; P-G6; P-G13; candidate 13
(a kept distance is a normal season's); candidate 20 against #220 (two rules for combining doubts: pick one); candidate 27 (weigh at
the estimate's middle, provide for its worst) as a rule about estimates.

*Evidence.* VB-1621, VB-685, VB-444, VB-780, VB-1670 (27 hours reckoned, about 620 taken), VB-1662, VB-1587, VB-471; #128, #152, #259.

*How it decides open cases.* VB-781: the step reaches become hours of the head's judged walk. VB-684: one unit of load. VB-1621: every
`*Days` tunable is checked for which day it means. VB-1587: a site's water is estimated by the fetch's own route function.

### P6. What can be undone costs something to undo (new, small)

*Statement.* A choice a pawn can reverse (keep a field or let it go, hold a custom or return, move or stay) is held by the cost of
reversing it. Where the world already charges that cost (the hours to break a field again), the chooser weighs it; only where it
charges none is a named dead band added.

*Rationale.* Hysteresis was rediscovered four times as a slack parameter (#247 `FIELDS.slack`, #171 `P.hold`, #199, #234; from
`prs.md`). By "Mechanisms, not prescriptions" a bare slack is a patch when a real cost of switching exists and is not being weighed.

*Subsumes.* P-G4. *How it decides:* for `FIELDS.slack`, first check that the head weighs the hours of breaking the field again
against its yield; keep the slack only for what remains.

### P7. Whoever cannot keep itself is someone's charge (a question for Kim, not a proposal of one form)

Both reports propose it (T-G6, P-G8; pending candidate 29). The evidence is solid (VB-1602, VB-1606, VB-1585, VB-1240, VB-695; #222,
#272, #284, #289). The form is the open point. As built, a verb refuses to take the last able pawn from the house, and the refused
one is the hungry lone parent (VB-1602's close call; hungry child-days doubled on one seed, untraced; from `tasks.md`). Three forms:

1. **A ban** in the verb's check, as built. Simple; a prescription.
2. **A custom**: the village holds that a child is not left alone (Customs may prescribe).
3. **A charge**: every dependant has a named living minder (an obligation, which passes at once like any right and is covered by P2
   at the minder's death). Leaving is allowed and costs what it costs the child, which the parent weighs. This fits P1 best.

The catalogue below words the invariant for form 3 (a charge always has a living holder) and gives the stricter one for forms 1 and 2.

### Process rule: names, a ledger and design owed (for Kim and the tooling; not a game principle)

- Principles are cited by name. A numbered citation is a lint error.
- Candidates go to a file with a status (proposed, accepted, struck) and a count of the decisions behind each; the nightly report
  orders them by recurrence.
- A task that builds past a Decided row of `design.md` writes a "design owed" line that a design pass collects (T-G10, P-G11).

### What became of each candidate

| Candidate | From | Outcome |
|---|---|---|
| What ends hands on what it holds | T-G1, P-G1 | **Kept**: P2 |
| A body exists from the day people live as it | T-G8, cand. 11 | **Merged** into P2 with target-v2 8 |
| A quantity carries its unit; a bound kept in its unit | T-G2, P-G5, cand. 10 | **Kept**: P5 |
| The estimate and the doing share one reckoning | T-G3 | **Merged** into P5 |
| A shared quantity has one scale and one combining rule | P-G6, cand. 20 | **Merged** into P5 |
| Measure a measure's meaning once | P-G13, cand. 30 | **Merged** into P5; the versioned definition is a system invariant (S11) |
| A decider reads no draw that has not happened | T-G4, P-G2 | **Kept**: P1, third case |
| A chance that stands for a judgement becomes the judgement | T-G7, cand. 12 | **Kept**: P1, fourth case |
| No act held back by a chance or a count alone | P-G3 | **Merged** into P1, fourth case |
| Whatever state the player has, a pawn has | T-G5 | **Kept**: P1, second case |
| A verb belongs to a position | P-G7 | **Merged** into P1, second case |
| Nothing breaks off what a pawn chose but the pawn | cand. 16 | **Merged** into P1 (the hand that breaks it off is a pawn's or nature's) |
| A place's drawback is a cost, never a rule forbidding it | cand. 26 | **Merged** into P1, fifth case; it is Mechanisms, not prescriptions restated |
| A dependant is never without a minder | T-G6, P-G8, cand. 29 | **Put to Kim** as P7, three forms |
| A rule that lets go of what it took needs a dead band | P-G4 | **Kept, reworded**: P6 |
| A change does not disturb unrelated draws | P-G9, cand. 2 | **Dropped as a principle.** Streams are per system already; the cure is P1's fifth case in the tests (S2). A retired draw kept so seeds hold (cand. 2) stays a convention |
| A red check ships at the nearest passing value | cand. 25 | **Struck (proposed)**: it lets an outcome check set a parameter, against P1 |
| A guard never reached hides the next fault; refusals come from checks | T-G9 | **Dropped as new**: it is target-v2 19. Kept as invariant S6 |
| Design stands until a plan rewrites it | T-G10, P-G11 | **Process rule** |
| Criteria name a responsibility, not a module | P-G10 | **Process rule** for whoever writes criteria; already `AGENTS.md`'s "code goes where its concern lives" |
| What a carrier can carry is a table | P-G12 | **Dropped as a principle**: a design table. Its rule-like part is P3 |
| A kept distance is a normal season's | cand. 13 | **Merged** into P5 and P1 (what people know) |
| Weigh at the estimate's middle, provide for its worst | cand. 27 | **Kept as a design rule** under the estimate; too specific for the list |
| A household's state is its people's | cand. 28 | **Dropped**: a definition of a measure (P5) |
| A good's keeping is declared once; a guard lives where its subject does; a kind lives at or above both modules | cand. 14, 15, 17 | **Architecture**: cases of target-v2 1 and 2. Belong in `modules.md` (17 is there), not in the design principles |
| Present need ranks above work months away | cand. 23 | **Dropped**: a tuning of urgency. The near-ties it broke (24 against 23.8) are a P5 symptom |
| A side task gives way to the main work; a kind says whether it is a daily chore | cand. 21, 18 | **Dropped**: local |
| The automatic head gets by; the surplus is the player's to find | cand. 19 | **Put to Kim**: a real design stance (how good the unplayed head is), bearing on parity (c4). Not derivable from the others |
| A popup's opener carries `aria-haspopup` | cand. 22 | **Dropped**: a page convention |
| A cheaper computation gives the same answer or is a design decision | `tasks.md`, observations | **Kept as invariant** S8 |

## Invariant catalogue

"Checked" was verified in `tests/` for this synthesis unless marked. Each test is on a small constructed state (`tests/tiny.js`,
`tests/lib/probe.js`) unless it says otherwise. Ranked by the repairs each would have caught.

### Mechanics invariants (the world)

| Rank | Invariant | Principle | Checked today | How to test | Would have caught |
|---|---|---|---|---|---|
| M1 | **Every id resolves.** Every pawn, household, farm, village and holder id reachable in `st` names a live party, or lies in a field declared as history. No party has two parents (a pawn in one household; a pawn holding one household) | P2 | Partly: about twenty hand-written per-collection checks in `invariants.js`. No general walk; a dead pawn's stake and a dissolved household's goods are unchecked | Declare id-typed fields beside `@state` (or in `owners.json`); one walk in `checkState`. Add an **ending sweep**: on a constructed village, end each pawn and each household in turn at each phase of a day, then run `checkState` | VB-779, 1476, 1481, 1485, 1362, 1562; #152, #199, #201, #212, #263 |
| M2 | **Every good's account closes.** For each good in `Stores` and each year: made + brought in - used - spoiled - taken out = change in stock, `unexplained` within rounding. Closed before the year's totals are folded | Nothing teleports; P2 | Food and grain only, 1%, one scenario (`tests/accounts.js`) | Extend the accounts to every good, with a per-run counter where totals are pruned (VB-1662's obstacle); assert on tiny states at zero, on a nightly late save at 1% | VB-328, 645, 850, 962, 1620, 1662; #203, #212, #223 |
| M3 | **A dissolved party holds nothing.** A household marked dissolved has an empty store in every good, no herd, no cart, no claim, no right and no obligation; a dead pawn has no stake, load or task | P2 | Partly: ledger, ale, plans, claims, herds, goodwill | One loop over a dissolved household's `Stores` goods and a dead pawn's fields in `checkState` | VB-650, 1620, 1476 |
| M4 | **Custody changes tile only with a carrier.** A good or animal whose tile changes in a step is on a pawn, a cart, a boat or a led herd whose own tile changed by a leg. No leg crosses ground with no route | Nothing teleports; P3 | No. The straight-line fallback remains (`src/sim/journeys.js` line 71) with no counter found | A declared counter of fallback legs, asserted zero. In `sim/stores`, a debug assertion that a `put` and its matching `take` are on one tile or name a carrier | VB-302, 674, 675, 816, 1586, 1655, 329; #208, #279 |
| M5 | **No decision reads an unrealised draw.** A field written by chance for a time not yet come (the year's frost, the season's weather) is read by agency-layer modules only through an `expected` accessor | P1, third case | No (the frost is mended by convention) | Tag such fields (`@drawn`) and extend `tests/dependencies.js`: only the owner and the natural processes (`sim/clock`, `sim/fields`, `sim/meadows`) may name the raw reader | VB-1551, 1670; #211, #271, #282 |
| M6 | **Foretold is close to taken.** For each verb with an estimate (a walk, a move, a fetch, a task's end), the estimate on a constructed state with nothing unknown is within a stated ratio of the hours the run takes | P5 | One case: `tests/move.js` (from `tasks.md`) | One generic `foretold` probe, a line per estimating verb | VB-1670, 471, 1587, 1644 |
| M7 | **A title names its store.** Every stake, share or right to goods names the store the goods lie in; the sum of titles on a store is at most its stock; using goods requires custody | P3 | No: `pawn.stake` is a bare number (`invariants.js` 185 to 190) | After P3 is decided: a `checkState` sum per store | VB-637, 1476, 672 |
| M8 | **The player holds only the frame.** `st.player` has no field a pawn could have. Every verb has a non-player source or a written reason. Each verb's check passes or fails alike for a played and an unplayed pawn in the same state | P1, second case | Partly: `st.player` writes are owned (`owners.json`). One verb is player-only (`sim/player.js` line 263); nothing flags it | In `tests/commands.js`: list verbs whose sources are `['player']` against an allow-list with reasons; run each check twice on a tiny state with the played flag swapped | VB-1645, 680, 1613; #165 |
| M9 | **A check draws nothing.** A verb's `check` and a decider's yes or no leave every stream of `st.rng` unchanged | P1, fourth case | Not found | In `tests/commands.js`: snapshot `st.rng`, call every verb's check on a tiny state, compare. A lint for `rnd(` inside a `check` | VB-682, 693, 1118, 523 |
| M10 | **No work is stranded.** A pawn's phase is one of its kind's declared phases; no task has its work done and nobody to claim it for more than a day; a load is on a pawn, lying on a tile with an owner, or in a store | Nothing teleports; P2 | Partly: the `go`, `work`, `back` phase check (VB-1565, from `tasks.md`) | Extend the phase check to every kind from `KINDS`; a day-end check for done and unclaimed tasks | VB-1548, 1562, 1565 |
| M11 | **A dependant has a living charge-holder.** (Form 3.) Each pawn under 7 or bedridden has a named minder who is alive. For forms 1 and 2: at each day's end such a pawn has a grown member at home or with it | P7, P2 | No (the guard `mindsWhy` is in the verbs) | Day-end rule in `checkState`; a tiny state of a lone settler with a child | VB-1602, 1606, 1240; #272, #284, #289 |
| M12 | **A name feeds no rule.** No module below the page reads a class, an occupation or a place's label except the view that derives it and a declared contribution through its hysteretic value (or none, if P4 is accepted) | P4 | Not found | A read allow-list in `tests/dependencies.js` for the derived-view fields | VB-318; the town chain VB-769 to 774 |
| M13 | **A quantity states its unit.** Every `@tunable` names its unit in its doc; a `*Days` or `*Hours` name is compared only with values of that unit; game time is read in hours through `sim/rules` | P5 | No | A lint on `@tunable` lines (75 today) for a unit word; a grep lint for day arithmetic outside `DAY` and `SEASON_DAYS` | VB-1621, 685, 444 |

### System invariants (the code)

| Rank | Invariant | Principle | Checked today | How to test | Would have caught |
|---|---|---|---|---|---|
| S1 | **A cache equals its derivation after every command, with no lag.** The owner is told after the write, not before | target-v2 2 | Partly; the roles check allows a lag (`allowAgeLag`, `invariants.js` line 26) | Mend the birthday refresh, then drop the allowance. On tiny states, compare each cache with a fresh derivation after each verb. A lint: a `...Changed(` call follows the write in its function | VB-1369, 1460, 1506, 440; #135, #201, #273, #281 |
| S2 | **Hard checks state what holds in any state.** A test in the fast or verify tier asserts no share, rate or count on a seeded run; such numbers are bands. Tests read a registry's members, never list them | P1, fifth case; target-v2 17 | No | Review once: move seeded outcome assertions (`tests/hay.js`, `tests/meadows.js`, `tests/byre.js`, `tests/head.js`) to bands or rebuild them on constructed states. A lint for literal lists equal to a registry's keys | VB-1553; the seed moves of #169, #175, #272, #279; the hand lists of #173, #175, #254 |
| S3 | **What the simulation writes to the world is saved or derived.** Every `w.*` field assigned in `src/sim` is in `WORLD` or declared derived and rebuilt at load; a save loaded onto a used world equals a fresh load; seeding one world twice gives one state | Determinism (target-v2 18) | Partly: `tests/saves.js` round-trips; no static scan found (no test names `WORLD`) | A static scan of `w.` assignments against `WORLD`; load one save into a fresh and a used state and compare with `tools/same.js` | VB-1656; #133, #281, #256 |
| S4 | **Every field has an owner**, the `w.*` fields too | target-v2 2 | Partly (`tests/ownership.js`; `w.biome`, `w.trees`, `w.stones` have about ten writers each, VB-1506, from `tasks.md`) | Extend `owners.json` to `w.*` | VB-1506, 1656 |
| S5 | **History is bounded.** No array in `st` grows per year per living pawn beyond a declared band on a late save | Cost rules 1, 2, 9 | Partly (`tests/counters.js` counts work, not size) | A nightly check on a late save: the length of each `st` collection against its declared bound | #181, #159, #182 |
| S6 | **A command changes everything or nothing; an owner's write throws.** A refused verb leaves `st` identical; no owner skips a write silently | target-v2 19 | Not verified | In `tests/commands.js`: for each verb on a tiny state where its check fails, the canonical hash of `st` is unchanged after `issue` | VB-1598, 1485 |
| S7 | **Every citation resolves.** A "principle", "rule" or section cited in `backlog/`, `docs/` or `src/` names a heading that exists; principles are cited by name | Process rule | No | A docs lint beside `tools/doc.js`; it would fail today on `target-v2.md` line 71, `design.md` line 598, `slices.md` line 331 and `cost.md` 1.3 | The numbering fault; #189 |
| S8 | **A cheaper computation gives the same answer.** A cached or slotted version of a Decided reckoning equals the full one on constructed states, or the difference is recorded as a design decision | Decided mechanisms | Per task (`tools/same.js`) | Keep the full reckoning as a test oracle beside each cache | VB-1554, 1558, 1564 |
| S9 | **A baseline only falls.** A rise in `tests/counters.json`, the lint or width baselines needs a task id in the commit | `AGENTS.md` | No | A check on the baseline files' diff in the nightly | #176 against #154 |
| S10 | **Task ids are unique across branches** | Process | No (the lint finds missing ids; from `prs.md`) | `backlog.js new` reserves from a counter on origin; the lint finds duplicates | 32 PRs of renumbering |
| S11 | **A measure's definition is versioned with its target** | P5 | No | `tools/targets.js` stores a hash of the measure's function with each value | #259, #272, #285 |
| S12 | **Time does not depend on chunking** | Determinism | **Yes** (`tests/clock.js`) | none needed | #91 |

Already well covered and left out: plain data and saves (`tests/plaindata.js`, `tests/saves.js`), single writers (`tests/ownership.js`),
layers (`tests/dependencies.js`), verbs wrap their acts (`tests/commands.js`), record lines (`tests/record.js`).

## Recommended next steps

Nothing here has been created.

**Questions to put to Kim** (`node tools/questions.js`), in this order:

1. **P2, Nothing is left to no one**: accept as a principle? With it: does a household that has died out stand as an estate until
   its goods have passed, and do the remaining goods of VB-650 pass with the farm?
2. **P3, title and custody**: accept the sharpening? With it: a stake is title to grain in a named store (VB-637), inherited at once
   at death (VB-1476).
3. **P1, the umbrella**, and its three extensions separately, since Kim may take some and not others: (a) decisions read no
   unrealised draw; (b) a judgement is never a die or a count of years (the candidate of VB-682, pending since 16 Nov); (c) the
   player holds no state a pawn lacks. And the parity wording (c4): the same verbs and checks, with a cheaper chooser allowed?
4. **P4, class and rules** (c1): does elite feed rules through its measure, through a cut point, or not at all? And is 600 / 325 /
   75 a band or dropped (c2)?
5. **P7, the charge**: a ban, a custom or a weighed cost?
6. **P5 and P6** (one reckoning; the cost of undoing), and candidate 19 (how good the automatic head is).
7. **Strike** candidate 25 (ship the nearest passing value)?

**Invariants worth a backlog task each**, in order of payoff: M1 with the ending sweep; M2; S1 (drop `allowAgeLag`); M5; S2 (the
review of seeded outcome checks, which also unblocks VB-1553); M3 (small, can ride with M1); M4's fallback counter (small); M8 and M9
(both small, in `tests/commands.js`); S3's static scan; M13's unit lint. M7, M11 and M12 wait for Kim's answers on P3, P7 and P4.

**Process fixes.**

- A candidate ledger (a file, or a kind in `tools/questions.js`), fed by `inbox.js apply` as teleports are, with status and a count of
  recurrences. Seed it with the table "What became of each candidate" above.
- Cite principles by name. Mend the four dead citations (S7), and remove "the one hard rule" or say which rules are hard (c8).
- State each cross-layer rule once (c5) and point the other documents at it; mend `AGENTS.md`'s "(class, tier)" either way Kim decides c1.
- A collecting task for knowledge faults ("Foresight found, collected") so they stop being filed as teleports, or widen the
  teleport collector's name.
- Give the teleport collector a date or a priority that matches "the one hard rule": VB-1175 and VB-329 are P3; VB-1476 is P2 and
  carries the largest unexplained term of the food account.
- A "design owed" line for a task that builds past a Decided row, starting with `design.md` lines 919 and 1499 (VB-1668).
- An owed measurement joins the night's report instead of becoming a P3 task.
- For the next review of this kind: have the reviewers open `tests/lib/invariants.js` before proposing invariants, and agree one set
  of labels.
