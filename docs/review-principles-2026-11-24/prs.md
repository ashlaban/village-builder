# PRs against the design principles: a review of the pull-request record

Date: 24 November 2026. Reviewer: a read-only agent. Nothing in code, docs or GitHub was changed except this file.

**Scope.** All 293 PRs of `ashlaban/village-builder` (#1, 29 Oct to #293, 24 Nov): 289 merged, 4 closed unmerged (#44, #52, #81, #134), 0 open. Titles and bodies only, no diffs.
**How fetched.** The GitHub MCP tool connected, but `gh api -X GET search/issues` (3 pages of 100, sorted by creation) was used to save the bodies to a file in the scratchpad, which was then mined with `jq` and `node` (1.0 MB of text; every "For Kim" section, 120 of them, was read in full; the other sections were grepped).
**Read:** 293 of 293; unreadable: none. One body is empty (#81, closed). Bodies of #1-#103 are mostly planning and nightly summaries and are thin; #104-#293 carry the structured sections (For Kim 117 PRs, Reads/writes/coupling 74, Targets 156, close calls 114).
**Limits.** (1) Review findings are almost invisible in PR bodies: no PR carries a "Review" section with findings (the review procedure began with #286 on 24 Nov), so "review findings by root cause" is inferred from For Kim, Close-call and repair PRs. (2) "Fate" of a candidate is checked by grepping the exact phrase in `design.md`, `AGENTS.md`, `docs/architecture/*.md`, `QUESTIONS.md`, `QUESTION_ARCHIVE.md`, `docs/tuning.md` (paraphrased promotion could be missed). (3) There is no ledger of candidates: nothing records "struck". Verified = said in a PR body (or grep result); Inferred = my reading.

Principle dates: the "Principles for decisions" were decided 12-16 Nov (PRs #119, #145, #150, #151, #152 carry them). 114 PRs (#1-#118) predate; 179 follow.

---

## Summary

1. **The surfacing channel works but ends in a pile.** 117 PRs carry "For Kim"; they surface about 26 principle candidates (table below). The ones Kim decided in sessions (#145, #150, #151, #152) became principles within a day; of the ~20 candidates raised afterwards (#154 onward) **none is verifiably promoted** (one reached `modules.md`), and there is no record of any being struck. They sit "standing until struck" indefinitely.
2. **Teleports are the most repeated finding: 27 PRs found, mended or logged one** (#139, #145, #147, #150, #154, #155, #181, #208, #212, #219, #223, #248, #261, #263, #271, #272, #279, #282, #289 ...). Each was found by luck of the task at hand. The common cause is that "nothing teleports" is stated as a ban on adding, not as a conserved quantity with a check. The same family includes **what the dead and the dissolved leave behind** (#203, #263, #147, #154, #261), which is a single missing rule.
3. **Dangling references after death or dissolution** are the commonest crash cause (#152, #173, #174, #199, #201, #203, #212, #263): a missing referential-integrity invariant.
4. **The principle "the future is someone's estimate" (15 Nov) was applied to displays first and to rules a week later**: #211 chose the frost's day, #271 found `windowEnd` reading the drawn frost (filed as a teleport), #282 found four readers of the drawn frost. The general rule is "no rule reads a quantity the world has not yet realised".
5. **A count of years or a die standing for a judgement recurs after principle 19 ("a wait is the thing waited for")**: #154 (VB-646, two years), #168 (VB-1103, `causeGrace`), #171, #173 (VB-1118: every illness ends in death, the roll decided at onset), and the candidate in #154 (VB-682). It was caught each time by the agent, not by a check.
6. **Reversible choices need a dead band; nobody has said so.** Hysteresis was rediscovered in #247 (`FIELDS.slack`), #171 (`P.hold`; 8 of 13 village changes back within 10 years), #199 (heirs' churn 71 to 141), #234, with the target-v2 hysteresis rule limited to class.
7. **Tests are repaired by moving the seed** (#169, #173, #175, #272, #279: `head.js`, `hay.js`, `byre.js` seeds moved) because adding a custom dimension or draw shifts every seeded run. The principle candidate in #271 ("ship the nearest tried value that passes") treats the symptom; the missing invariant is draws that do not move when an unrelated feature is added.
8. **Extended-tier red checks were merged red on six nights (#168-#175)**, each time the same kind of cause: hand-written lists in tests that a registry change invalidated (`tests/line.js`, `smoke.js` layer index, charter heads).
9. **Task IDs collided across parallel branches in 32 PRs** (renumbering in #158, #160, #201, #252, #271, #289 ...), while the code rule is "ids are never reused": the process has the wrong allocation rule.
10. **Design drift is systematic.** Agents may not edit `design.md`, so "Proposed" text and stale words accumulate (#111, #154, #159 item 3, #164, #250, #264). One Decided sentence (teleport) was lost in a doc simplification and noticed only by a later review (#189 to #199).
11. **Decided points were revised inside code tasks twice**, before the escalation rules existed: #132 and #133 (reverted by #135 the next day). After 12 Nov the pattern is the reverse: tasks stop short and leave a criterion unticked (#224, #252, #261), and a few interpretations are made silently (#241, #162).
12. **Owed measurements pile up as tasks.** #147 (8 tasks merged with a criterion open), #201 (7 owed-measurement tasks), #175, #182; one was impossible (#201 VB-1319: repo history begins after the merge to be measured). 3 to 21 targets were "out" on every PR from #99 to #293, described as advisory; a +25 to +97 hungry-household-years change (#211) was accepted as a tuning row and found later by bisect (#259).
13. **Process rules themselves show principles**: a fact is checked at the cheapest tier that can see it (#124), evaluations are fixed before data (#283, #286), ratchets only fall (#178, but cf. #176 vs #154), tooling reads less (#74, #267), and simple beats cached (#91). Two rules reversed within days (#183 added the GitHub Actions worker, #189 removed it; #132/#133 reverted).
14. **Same-kind close calls were decided differently**: who may issue a household's verb (#221 head, #252 any grown member, #275 a member), carts versus backs (#139, #223, #252), re-recording the counters baseline (#154 refused, #176 done), "done" with an unmet tuning measure (#139 says needs-review, #175 sets done).

---

## Principle candidates surfaced in PRs

"Accepted" means the idea is in `design.md`'s principle list or `AGENTS.md`. "Pending" means the exact idea was not found in any principle document (verified by grep); "lost" means raised and then not mentioned again.

| # | Candidate (one line) | PRs | Fate |
|---|---|---|---|
| 1 | A venue/office/good named before its institution is built as the practice that produced it (ale evening before alehouse) | #147 (VB-186) | **Accepted** 16 Nov: "Practice before institution" |
| 2 | A retired random draw is kept so seeds hold (VB-520) | #147 | Pending; recurs as invariant gap (#168, #175, #279) |
| 3 | Elite is what rules leave over, no quota | #145 (principle 13) | **Accepted** |
| 4 | Decided fixes the mechanism, not its bounds; enforcing is not asking; tooling is the agent's | #145 (10-12) | **Accepted** (AGENTS.md, Deciding without Kim) |
| 5 | A good that does not wear needs a way out (given, buried, lost) | #151 (VB-702) | **Accepted** |
| 6 | A grade of workmanship belongs to a piece one maker finishes | #151 (VB-702) | **Accepted** (design: "made good graded, built thing not") |
| 7 | A name for what a place/person is is a label read, never a switch | #151 (VB-189) | **Accepted** |
| 8 | Every act is a pawn's | #150 (principle 16) | **Accepted**; its violations are in the erosion table |
| 9 | Goods made of a material, kind sets quality (17) | #151 | **Accepted** in part (materials; "skill never multiplies yield" was the orchestrator's assumption, flagged) |
| 10 | A limit on where a pawn works is its judgement of the walk; a bound argued in hours is kept in hours | #152 (VB-444); evidence #128 item 4, #154 VB-190, #250 | Pending (reaches were later rewritten in the journey scale, #249, but the rule is not stated) |
| 11 | A body exists from the day people live as it | #154 (VB-445) | Pending (practised in #250/#252 settling) |
| 12 | A chance that stands for a judgement becomes the judgement | #154 (VB-682) | Pending; recurs (#171, #173) |
| 13 | A kept distance is what people know of a normal season; only the journey reads the day's ground | #154 (VB-190) | Pending; built in #281 |
| 14 | A good's keeping is declared once, in its registry row | #213 (VB-683) | Pending (built) |
| 15 | A guard is a lookup that lives where its subject does (three decisions) | #165 (VB-228) | Pending (built) |
| 16 | Nothing breaks off what a pawn chose but the pawn | #165 | Pending |
| 17 | A kind that takes from one module and puts into another lives at or above both layers | #167 (VB-418) | **Promoted to `modules.md`, Adding things** (the only one found there); not in design.md |
| 18 | A kind of work says whether it is a daily chore (flag in `sim/kinds`) | #156 | Lost |
| 19 | The automatic head gets by; the surplus is the player's to find | #158, carried from 17 Nov | Pending |
| 20 | A range's spread is z times the root of its parts' squares over 3 | #236 (VB-476) | Pending, and **conflicts** with #220's linear sum of doubts |
| 21 | A side task that rides along gives way to the main work | #278 (VB-362) | Pending |
| 22 | A popup's opener carries `aria-haspopup`; a fold does not | #258 | Pending (UI, likely local) |
| 23 | Work answering a present need ranks above work months away, by urgency, whatever the role | #265 (VB-1545/1549) | Pending |
| 24 | A working role's absence is read from who the head allots the day to | #265 | Pending |
| 25 | A proposed number that turns a hard check red ships at the nearest passing tried value; the design's number goes to the tuning run | #271 | Pending |
| 26 | A place's drawback is a cost someone pays by walking or working, shown as an estimate before the choice, never a rule forbidding it | #272 (VB-1543) | Pending (strongly Mechanisms not prescriptions) |
| 27 | What a pawn cannot know before the work is weighed at its estimate's middle and provided for at its worst | #272 (VB-1584) | Pending |
| 28 | A household's state (dry, cold, hungry) is its people's: count households with someone at home | #272 (VB-1585) | Pending |
| 29 | Whoever cannot keep itself is some pawn's charge: no act takes the last able one from the house | #272 (VB-1602); #284 | Pending; **recurrent evidence** (#222, #284, #289) |
| 30 | A bar on thirds is a pooled difference over at least eight seeds with paired SE, never a sign at every seed | #285 | Pending (measurement rule) |

Observations (verified): of ~30 candidates, the 9 accepted all came from sessions with Kim (#145, #150, #151, #152 and the 15-16 Nov round); the 20 raised by unattended runs after #154 have no recorded outcome. Nightly PRs #168-#182 and #201 say "no principle candidate" while their own close calls repeat earlier candidates (e.g. #168 VB-1103 and #171 VB-1104 on counts of years, after #154's VB-682). Candidates that recur without being promoted: 12 (chance as judgement), 10 (hours), 29 (charge), 20 (combining doubts), 25 (red check/seed).

---

## Missed general principles

Each is stated as one rule, with evidence and the existing principle it extends.

**G1. What the dead, the dissolved and the absent hold is accounted for by a process.**
Goods, animals, stakes, carts and obligations of a holder that dies, dissolves, leaves or loses its carrier go somewhere by a named process (found, fetched, inherited, lost to frost) at a tile, never to nothing and never to `null`.
Evidence: #203 (VB-1476: a pawn's grain stake stays on a dead pawn; the whole of the food account's `unexplained`), #263 (VB-1175: `extinct` read members after the moves; a dead-out household's herds went to no one), #147 (VB-649 cart and ox team free when the carrier dies; VB-650 a dead household's stores vanish; VB-645 dropped boat's timber), #154 (VB-850 gift on a dead bearer; VB-962 a pawn who died away lost its pack), #139 (carrier who dies loses the gift), #261 (stake as a number moves with the pawn), #152 (crash: household that dies out with timber at a building step).
Relation: extends Nothing teleports (which covers movement and creation, not endings) and target-v2 5 (title and custody).

**G2. No decision rule reads what the world has not yet realised.** Extends "The future is someone's estimate" from what is shown to what is decided.
Evidence: #211 (frost day: head plans on the drawn day's commonest), #271 (`sim/hands windowEnd` reckons to this year's drawn frost; filed as a teleport), #282 (three other readers of the drawn frost, all changed "on the principle that the future is someone's estimate"), #209 (pace on the work leg, not in `rateOf`, so the head's estimate does not know a mishap), #236, #220, #272 (VB-1584: depth weighed at middle, provided at worst). The information flows were treated as teleports of knowledge, but knowledge is exempt from Nothing teleports; this rule is the one that actually binds.

**G3. No act is held back or let through by a chance or a count alone.** Extends principle 19 (A wait is the thing waited for) from waits to every rule: a die that stands for a judgement, a count of years, a calendar date.
Evidence: #154 (VB-682 candidate; VB-646 unclaimed plot released after two years, flagged as principle 19), #168 (VB-1103 `causeGrace` 0.25 year), #171 (VB-1104 avoided the count by moving anchors, `P.hold`), #173 (VB-1118: roll at onset decides death), #179 (VB-1246 repairs it), #247 (hysteresis replaces "years"), #175 (VB-711 loss window "about a year" with nothing recording it). Four of these are agents flagging a violation they then shipped.

**G4. A rule that lets go of what it just took needs a dead band.** One statement of hysteresis for any reversible decision (fields, farms, customs, advice, trials).
Evidence: #247 (`FIELDS.slack` 1: "households let fields go and broke them again"), #171 (8 of 13 customs back within 10 years; `returnMargin`), #199 (heirs' larger-farm rule churn: 71 to 141 moves), #234 (`ADVICE.gap`, `heed` never fired), #210 (trial sown out of turn), #168 (VB-1101). Currently target-v2 4.1 allows only class through hysteresis.

**G5. A bound is kept in the unit it is argued in (hours for walks and reaches, years for histories, rations for needs).**
Evidence: #128 item 4 (reaches of 6, 12, 8 hours applied as Decided though walking four times faster), #152 (`ROUTE.reach` 67 hours written as 200 steps; `WOOD.far` a day's trip in steps; tuning rows "pull opposite ways"), #154 (VB-190), #250 (design row still says "10 to 30"), #249 (journey scale). Cost: an entire slice (VB-444, VB-780) to repair.

**G6. A shared quantity has one scale and one combining rule.**
Evidence: #220 (doubt added linearly), #236 (spread as root of squares, flagged as "second range of this kind"), #265 (food beats late ploughing 24 vs 23.8), #280 (shelter 3.5 over cold firewood 3), #247, #158 (gold/red already mean short and bad; new food colours). Priorities close to ties and constants chosen to break them are a symptom (Inferred).

**G7. A verb belongs to a position, and the position's holder is checked by the verb, for any pawn.**
Evidence: #215 (VB-681: legitimacy in the verbs), #165 (VB-228: guards live where subject does; `unplanned` skips the played pawn only), #221 (head begins a boat), #252 (any grown member may blaze; VB-787 to narrow), #234 (`routines` is the village's verb, `order` stands for it), #275 (a member's voice, leave asked of the head), #222 (cull a head's verb; no page control). Same question answered three ways.
Relation: Every act is a pawn's; parity of command (target-v2 15).

**G8. Whoever cannot keep itself is some pawn's charge.** (candidate 29, upgraded to a rule with evidence)
Evidence: #272 (VB-1602 child left alone; household "with nobody at home has no dry day"), #284 (VB-1240: child under 7 moved alone; a household of only children), #222 (penned ewes unherded), #289 (unattended solo settler died), #263 (no one for the herds), #239 (guardian/ward; #199 guardianship left on the old farm).

**G9. A change to the world does not disturb unrelated draws.** Adding a feature must not reshuffle another's randomness.
Evidence: #168 (VB-1107 changed the seeds of four tests), #175 (VB-826/711: "draws at seeding move with each custom"), #272 (byre/head seeds moved), #279 (`head.js` seed 4 to 12, `hay.js` 7 to 6), #210 (a draw made only when needed so barley-only runs keep every draw), #147 (VB-520 retired draw kept). Rule: a draw is keyed to its (system, entity, day), so a new consumer cannot move another.

**G10. Task criteria name a responsibility, not a module.** The module-length rule (VB-413/419) and the width rule contradict criteria text in #233 (`CLIMATE` not `sim/rules`), #268 (`STONE`), #269 (`sim/workmanship`), #216, #231, #245, #249, #269 (each opened a split task). Close call every time; same answer every time.

**G11. A design document that cannot be edited by the agents who change its subject drifts.** "Proposed (VB-NNN)" text needs a sweep (promote or strike), and any word, number or row changed by a task is listed in a "design owed" line of the task. Evidence: #154 and #159 item 3 (Proposed not moved to Decided), #164 (prestige in 13 places), #250, #264, #111, #199 (#189 dropped Nothing teleports).

**G12. What a carrier can carry is a table by carrier and ground.** Back or cart, kind of load, trail or road.
Evidence: #139 (far-kin gift on the back only, "carts are tied to field jobs"), #223 (settlers carry on their backs only), #252 (criterion unticked: carts cross a blazed trail), #208 (cart's 90 split off), #281 (winter table), #257 (felled timber lies and rots). Decided each time in the PR.

**G13. Measure a measure's meaning once.** Hunger counted by household-days, by years, or with empty houses (#272: 92% and 81% of dry days were empty houses), changes meaning between PRs.
Evidence: #259 (new measure 4.4% against 0.19-0.34%, bisected to #211), #285 (thirds), #272 (VB-1585), #201 (VB-1319 history unmeasurable), #159 (stale fixture year 12 vs 13).

---

## Missed invariants (system and mechanics)

Stated so that each can be checked in code; "test" says how.

**I1. Referential integrity across ends.** Every pawn, household, farm, village and holder id found in `st` (fields typed in `src/owners.json`) refers to a live entity or to a recorded tombstone, and no entity is held by two parents (a pawn in at most one household; a household on at most one farm; a trust's holder lives; a dissolved household holds nothing).
Evidence: #152 (`stores: missing or dissolved holder` crash, VB-779), #199 (trust left open on an heir's old place; guardian/ward left set), #172-#174 (fixtures: "trust 29: household 28 held in trust has members 171"; `ties<204>: not a living other pawn`), #201 (VB-1217 `village.alderman` null read `st.pawns[null]`; VB-1369 reverted: role cache after inheritance), #212 (VB-1481: a marriage hands a farm to a dissolved household and one pawn holds two households), #263.
Test: after each day on 4 seeds x 3 scenarios, walk all id-typed fields from the schema; plus a death-sweep property test killing a random pawn/household at each state of a day. Also the `tests/invariants.js` band already fails `away[2]` fetch for household 19 by a pawn of household 26 (#173); this is the same class.
Verified: the failing invariants are listed in #172-#175. Inferred: that a schema-driven walk would have caught all eight.

**I2. The goods ledger closes everywhere, and a unit's place changes only with a carrier.** For every good and every holder: stock(t+1) = stock(t) + made - used - spoiled +/- moves; `unexplained == 0`; any move across tiles has a carrier pawn present and a journey.
Evidence: #203 (accounts closed to `unexplained`; found the dead pawn's stake because of it; test uses heirs/tiny only), #212 (a reaping after the crop was lost reaped it: "food from nothing", NaN), #248, #208, #219, #223 (restored farm 2 days of meals from nothing), #279 (2 straight-line fallbacks).
Test: make `unexplained == 0` a hard check on every scenario at small and a nightly late save (it is a report today; the test was kept to tiny to stay near 5 s, #203). Add a movement log asserting carrier != null when distance > 1 tile.

**I3. Dependants have a carer.** At the end of every day, each household member under 7, bedridden or ill, and each stalled or penned animal group has a pawn of its own household at home or in company, or the household is dissolved/fostered that day.
Evidence: #272 (VB-1602), #284 (VB-1240; household 79 of one baby), #222, #289. Test: `invariants.js` rule over the household-day, constructed state with a lone settler plus a child.

**I4. No rule reads an unrealised draw.** Fields written by a chance (this year's frost day, a mishap, a crop's size) are tagged; modules that make plans (`sim/plans`, `sim/hands`, `sim/head`, `sim/asks`) may not read them.
Evidence: #211, #271, #282, #209. Test: an ownership-style lint (the lint already enforces owners): list of `@oracle` fields and a readers allow-list.

**I5. A cache is notified after the write, and equals a fresh derivation.** (target-v2 principle 2 already says derived caches need a check.)
Evidence: #281 (four writers called `costChanged` before writing the tile: `expansion`, `newground`, `meadows`, `passage`; harmless while the cost was live, wrong once compiled), #135 (VB-440: developing a tile did not tell the route cache), #139 (VB-236), #273 (routes kept over a cache emptying), #201 (role cache at age 14, VB-1460), #214 (records index stale in three tests), #141, #62.
Test: after every command on constructed states, compare each cache with its derivation (route cost, role cache, record index); order-of-call lint: notify call must follow a write in the same function.

**I6. Everything written to the world is saved or derived.** A `w.*` field written by simulation modules is in `WORLD` or declared derived and rebuilt by `load`; seeding the same world twice gives an identical world.
Evidence: #133 (bridge lost on save/load: `w.crossing` not in `WORLD`; one of the reasons for the revert), #281 (`w.shut` and walking reach lists survived a second seeding, discovered through tests that reuse a world), #214 (derived state by one rule), #256 (VB-1504 paint dropped on restore), #233 (`st.climate` saved whole). Test: static scan of assignments to `w.` against `WORLD`; run-save-load-run equals run-run (`tests/saves.js` exists; the gap is fields not in `WORLD`).

**I7. Every container that grows with history is bounded or folded, and says how.**
Evidence: #62 (route cache 60,000), #180 (`st.decisionLog` last 30), #181 (VB-1170 kin pairs "counted but not bounded", 0.015 to 0.107 reads per living from year 5 to 40), #159 (bench rose 244 to 432 ms), #179, #182 (VB-1380 round call doubled), #202 (`st.plans.due` insertion order), #167 (KINDS order is saved state). Test: late-save counters (exist, `tests/counters.js`); add a check that no `st` array has unbounded growth per year per pawn beyond a declared band.

**I8. Time and draws do not depend on how the run is chunked.** #91 records that `st.t` as a float drifted past its tolerance in year 2 and the same seed gave a different run by how `Sim.advance` was chunked (verified for #91; later PRs #93, #98, #122, #251, #253 mention chunks, but I could not verify the clock's fix from bodies). Test: `advance(1h x N)` equals `advance(N h)` on a late save.

**I9. Registry membership is read, never listed, in tests.** Hand lists broke: #173 (`tests/line.js` ends with `trust` and `succession`), #175 (smoke charter lacks four heads since VB-711; family tree buttons since VB-671), #254 (smoke counts the objects layer by index; each overlay shifted it), #178 (`DISPUTE` as a literal list kept equal to culture's options by a test), #169 (`fresh.js`). Test: lint rejecting literal enumerations that match a registry's keys in tests (inferred).

**I10. Id allocation is unique across branches.** Task ids (and renumbered commits) collide: #158 (VB-1026 to 1123), #160 (1123-1129 to 1161-1167), #201 (VB-1405 to 1470), #252, #271 (1538-1550 taken, renumbered to 1551-1565), #289 (28 tasks renumbered +28), #240 ("fewer task IDs left unused"), #154 (tool tests broke when ids passed VB-999). Test: `backlog.js new` reserves from a shared counter on origin and a lint finds duplicates (the lint already finds missing ones).

**I11. A baseline ratchet moves only down.** `tests/counters.json`, width and lint baselines. Verified inconsistency: #154 (orchestrator put the counters back), #178 (reverted a loosening of the width baseline), #176 (counters re-recorded after a merge moved 10 counters). Test: CI reads the baseline diff and fails if a value rises without a task id in the commit.

**I12. A health definition is versioned with its target.** #259, #272 (VB-1585), #285. Test: `tools/targets.js` records the definition hash with the value.

---

## Recurring close calls

Decision kind, PRs, how each went. Counts are PRs (verified from For Kim text).

1. **A defect found in passing: fix here, file, or leave.** #111 (farms with animals and no meadow: "worth a task"), #136, #147, #169 (VB-1197 P1), #172, #178, #203 (filed VB-1476), #212 (teleport fixed, VB-1481 filed), #244 (ASKS.cap bug fixed), #263 (fixed), #271 (fixed in merge), #280 (VB-1614 filed), #281 (fixed), #139 ("not verified", loosened invariant). Rule needed: a defect with a reproducing seed gets a test and a fix when it blocks the criterion, else a task with the seed; never a note alone.
2. **A test fails because of a shifted draw.** #168, #172?, #175, #272, #279, #147 ("tests narrowed, each flagged"), #271. Outcomes: seed moved (#175, #272, #279), assertion loosened (#147), invariant narrowed (#139), reverted (#168 VB-1107). Leads to G9.
3. **A criterion names a module that the length/width rule forbids.** #233, #268, #269, #216, #231, #245, #249. Outcome identical (code goes where its concern lives, split task opened): G10.
4. **Close to reading a criterion literally.** #239 (born-outside only if conceived while courting), #284, #288 ("within 5%" as relative), #293 (literal reading), #163 (a test contradicts the plan; plan wins), #206 (drop an old commit's merge), #206 ("nobody sent over the sea"). Almost always decided in favour of the plan, but undocumented.
5. **Estimate versus truth.** #211, #236, #209, #220, #282, #271, #272. Different modules each time, same call: the head knows the estimate. See G2.
6. **A new hysteresis or hold parameter.** #247, #171, #199, #234: see G4.
7. **Who carries and what is lost on the road.** #139 (back only, dies loses it), #223, #252, #219 (herd left until frost, then lost), #257 (felled timber rots), #208. G12.
8. **Who may issue a household verb.** #221, #222, #252, #275, #234, #247. Head in 4, any grown member in 1, "a member asks of its own accord" in 1. G7.
9. **Is a chain "done" with an unmet measure?** #139 ("would be `needs-review`" under Kim's rule), #147 (8 merged with a criterion open), #175 (VB-711 set done "by Kim's 16 Nov rule"), #201 (merged with criteria unmet), #272 (needs-review for unbuilt views), #274 and #273 (missed target, `dayPair` -18% not -25%). Inconsistent disposition.
10. **Numbers that break ties.** #265 (24 vs 23.8), #280 (3.5 vs 3), #244 (`TOOLS.share` 0.15 not 0.3, `ASKS.cap` 3 to 4), #234, #222 (`shearHours` 0.3). Pending parameters with no unit semantics.
11. **A new unit's start: placed or learnt.** #227 ("placed adults start with no crafts, the tilth precedent"), #209 (skill drawn around 0.5), #262, #269 (every quern a novice's). Two precedents quoted as decided each time; no principle.
12. **A custom or a rule?** #279 (`passage` is a custom), #151 (rite days a rule of the culture, not voted), #141 (hunting and hay sharing rules), #165, #284 (the culture's reckoning gets no verb), #175 (`matchBy`). Principles: Customs may prescribe; but the line between "rule of the culture" and "voted custom" was decided case by case (4+ PRs).

---

## Tensions and erosions

| PR | Principle | What happened | Later fixed? |
|---|---|---|---|
| #132, #133 | Decided mechanisms need a design pass | Effort-aware routing rewrote a Decided point in a code task and enabled it by default on two seeds; bridges lost on save and departed from answers | Reverted #135 (14 Nov, Kim). Also #132 was driven by "researched effort costs", i.e. a prescription from a source rather than a parameter. |
| #139 (VB-291) | Nothing teleports; carriers | A far-kin gift carried on the back only; if the carrier dies the gift is lost | VB-850 (#154). Also: loosened an invariant ("awake check no longer flags a pawn resting with its route kept"), unverified |
| #145 (found), #147 | Nothing teleports | Help from kin and village store "arrives at once"; a journey ordered mid-walk; a road load booked at the barn; cart and team free at the farm when their carrier dies; a dead household's stores vanish; a dropped boat's timber | Mended in #154 (VB-461, 849, 850, 962, 473, 581, 611); cost: hungry household-days 104 to 166 over 4 seeds (#154) |
| #150 | Nothing teleports | Herds spliced between households, a start in life arrives at once, a traveller's provisions from the store it walks to, shares/trust/inheritance grain change barn at once, tar and sheaves | #219 (VB-674), #223 (VB-675), #154 (VB-676), others partly; #261 and #181 still log a share/stake "moves at once": **not yet fixed** (verified in #261: "criterion 2 unticked") |
| #154 | Wait is the thing waited for | VB-646 unclaimed plot released after two years (a count of years) | Not verified |
| #151 | A made good is graded; mechanisms not prescriptions | A target (600/325/75 work line) the plan expects not to meet (263 to 275 per 1,000 against 325), with the rule left; "not expected to be met" | Flagged to Kim; open |
| #162 | Every act is a pawn's vs a Decided line | Built the played head's visit as Decided, with an unplanned head never choosing it | VB-1168 opened (in #172 second criterion not taken: "the head's weighing is kept") |
| #165 | Parity of command | `sim/jobs`, `sim/occasions` and the clock skip the played pawn through `unplanned`, a rule no pawn can invoke | Found, not changed |
| #171 | Every act is a pawn's | `cultureYear` changes custom and practice with no pawn's verb | #284 (VB-1240) |
| #173 | A wait is the thing waited for | VB-1118: every illness ends in death, the roll decides at onset | #179 (VB-1246) |
| #189 | Nothing teleports (and its collection procedure) | Consolidation of the agent guide dropped "no task adds a teleport, however small or temporary" from both files | Restored in #199 (3 days later) by a review |
| #203 | Nothing vanishes | A dead pawn's grain stake leaves the world with no movement and no reason | VB-1476 opened; fix not verified in the bodies; #261 extends stake to wages as a number |
| #208 | Nothing teleports | A goer's pack and a dealer's load leave the store at the packing step wherever the goer stands | #248 (VB-1175; `AWAY.yard: 1`) |
| #211 | Future is someone's estimate; households | Frost, thaw and cold summer change hungry household-years 25 to 97; accepted as a tuning row | #259 (VB-571) found hunger on a different scale by bisect to #211 |
| #212 | Nothing appears from nothing | Reaping after the crop was lost still reaped it, NaN, throw at year 36 | Fixed in the PR |
| #219 | No loss without process | A herd left with nobody stays until the autumn frost, then lost "recorded" | Accepted close call |
| #224 | Every act is a pawn's | The meeting's routines chosen by `chooseRoutines` not a `sim/decisions` kind; moving them revises a Decided mechanism, so criterion 2 left unticked | Open |
| #241 | Hunger presses; design says "a gift, nothing is owed" | Goodwill booked for help hours (a reading of "nothing is owed") | Disclosed ("tell me if you meant none") |
| #261 | Nothing teleports | A pawn's stake and wages move as a number, not as a load | Logged under VB-1175; criterion unticked |
| #265, #280 | Mechanisms not prescriptions; parameters | Urgency decided by constants that differ by 0.2 (24 vs 23.8; 3.5 vs 3) | Not revisited |
| #271 | Future is someone's estimate | `windowEnd` reckons reaping's window to this year's drawn frost | #282 |
| #272 | Every act is a pawn's; nothing teleports | Booth sleepers' water came with the roof; cart a load goes home on taken at the field with the pawn gone without it; a child under 7 whose household moves goes alone | VB-1601 closes booth; child #284 partly (a household of only children remains) |
| #279 | Nothing teleports | 2 straight-line fallbacks in 10 years: a pocket the cut-off test let close, cause not found | Open (VB-1175) |
| #168, #169, #172-175 | Hard failures block merging (AGENTS) | Red checks merged red "per Kim's standing answer" for six nights; the same VB-1223/1225/1313/1360 repair tasks chased new reds | Mended, then recurred; #170 (18 Nov) made the nightly record measurements on red |
| #176 | Ratchets only fall | Counters re-recorded after merging main moved 10 work counters | Not reverted; contrast #154 |
| #264, #164, #250 | Design is the source | design.md out of date (prestige 13 places, "a holder's is 1.6", "10 to 30") | Opened as tasks (VB-1171); partly open |

Pre-12 Nov erosions with no principle yet (inferred): #28, #29 (job system kinds nine places), #91 (review: three pressures produced caches, packed code, the golden rule imitating old code: "the cleverness answers three pressures"), #23 (VB-088: the budget's round of 1,016 ms vs 100 ms limit "Kim to decide").

---

## Repair clusters

| Cluster | PRs | Root cause | Invariant that would have caught it |
|---|---|---|---|
| **Teleport and conservation** (~27 PRs) | #139, #147, #150, #154, #155, #181, #203, #208, #212, #219, #223, #248, #261, #263, #271, #272, #279, #282, #289 | Moves and endings not wrapped in a carrier/ledger; each found by a task near it | I2 + G1 (movement log with carrier; ledger closed in every scenario) |
| **Dangling reference after death or dissolution** (8 PRs) | #152, #173, #174, #199, #201, #203, #212, #263 | A holder ends without an owner for what it held; handovers each hand-written | I1 |
| **Stale derived cache or wrong notify order** (9 PRs) | #62, #65, #135, #139, #141, #201, #214, #273, #281 | The cache is told before the write, or only partly refreshed | I5 |
| **Seed-shift test repairs** (6 PRs) | #168, #169, #175, #272, #279, #147 | One shared draw order across features | I9/G9 (keyed draws) |
| **Hand lists in tests / red extended tier** (7 PRs) | #168, #169, #172, #173, #174, #175, #254 | Tests enumerate what a registry owns | I9 (registry membership read, not listed) |
| **Cost regressions found late** (9 PRs) | #159, #179, #182, #201, #203, #273, #274, #275, #204/#205 | Loops over pairs added without bound or counter; measured only at nightly | I7 + the "estimate entities x cadence" rule in AGENTS (not checked) |
| **Owed measurements** (8 PRs) | #139, #147, #175, #182, #201, #203, #281, #148 | Task closes before its measure can run (shared machine, late fixture, history that begins late) | A done task's measurement is recorded by the nightly, not by a follow-up task (#170 started it); ids of owed tasks stay linked |
| **ID collisions** (32 PRs) | #158, #160, #201, #240, #252, #271, #289, ... | Parallel branches allocate from the same counter | I10 |
| **Design drift** (7 PRs) | #111, #154, #159, #164, #189, #250, #264 | Agents may not edit design.md | G11 sweep |
| **Dependants left alone** (4 PRs) | #222, #272, #284, #289 | Acts check only the actor's own state | I3 |
| **Future-reading rules** (4 PRs) | #211, #271, #282, #209 | The frost's draw is a world field any module can read | I4 |
| **Modules over the line from a task's own addition** (9 PRs) | #245 (706), #249 (711), #269 (714), #232, #252, #246 ... | Criteria add lines to near-full modules; split tasks are opened, never done in the PR | G10; "split tasks open" is the working rule, but each PR reopens it |

Of the 12 clusters, nine have a single root cause that could be expressed as one check. Verified: counts of PRs per cluster come from the bodies; "root cause" is the agents' own words in 6 clusters (teleport, dangling, cache, seeds, cost, design drift) and my inference in the others.

---

## Evolution over time

**Before 12 Nov (#1-#118).** Decisions were queued: tasks blocked, questions written with a proposed answer (#7, #8, #12, #15, #17, #19, #23, #43-#45; QUESTIONS.md mentioned in 30 of the 114 PRs, 12 of the 179 later). Kim answered in batches; PRs were backlog and review work ("Nightly", "Review of ..."). Principles were architectural (target-v2, #47-#49; ownership #53, layers #70) and about cost (counters #51, #57). Two decision-level erosions were found only after merge (#132/#133). "Teleport" does not occur in any PR before #128.

**12-16 Nov (#119-#155).** The principles for decisions arrive in four sessions (#119, #145, #150, #151, #152). The first teleports found cluster in #145-#155 as the principles take effect; #138 introduces surfacing ("principle candidates, teleports found and close calls head the night's PR"); #154 reports about 145 close calls as `decision` notes of which the PR lists the ones worth a look. For Kim goes from 3 PRs (pre-12 Nov) to 117. Targets sections are on in 156 of 179 PRs, and "Reads, writes, coupling" in 74.

**17-24 Nov (#156-#293).** Surfacing becomes routine and the candidates stop being decided: candidates #11-#30 above. Process rules multiply: sub-agents and handovers (#138, #166), ceiling on a sub-agent's calls (#166), measure on red nights (#170), spending turns (#267), adaptive resets (#283), independent review with a fresh reviewer (#286: replaying eligibility over 238 tasks gave 72% eligible, not 50%; left unchanged), /chain and /night skills (#287, #290). Reverted or reversed: GitHub Actions worker (#183 then #189 in a day), module cap 400 to 700 (#126/#127), golden file retired (#124).

**Process principles implied (inferred), none stated as such:**
- *A fact is checked at the cheapest tier that can see it* (#124: fast, verify, extended; "every script over 5 seconds moved to extended").
- *Fix the evaluation before the data* (#283, #286: "the method was fixed before any data"; #285 rule for thirds).
- *A ratchet only falls* (#178, #154 against #176).
- *A report of a number carries before, after, residual and cause* (AGENTS step 7; applied in 156 PRs, but #274 and #273 missed their targets with the cause stated).
- *The simplest instrument first* (#91: "spreading work over steps is simpler than caching"; #271: standing duties built, measured and removed).
- *Tools read less than files* (#74 questions.js: read 24 KB to 2.4 KB; #267).
- *Findings go to a collecting task* (#166: `teleport` and `act` notes appended to one open task each; VB-1175 and VB-1240). The collection works as a tracker: VB-1175 closed items one by one (#248, #263, #282) while new ones kept arriving (#272, #279, #289).

**What does not exist (verified).** (1) A ledger of candidates with outcomes. (2) A rule that two candidates of one kind trigger a promotion decision: AGENTS says "the third decision of one kind" is a candidate, but no PR shows anyone counting. (3) A check on doc-simplifying PRs against the Decided text (#189). (4) A way for the surfaced candidates to reach Kim in order of recurrence rather than night order.

**Recommendations for the next principle pass (ordered by evidence):** G1 + I1/I2 (dead holders and conservation), G2 + I4 (no future oracle), G3 + G4 (counts, dice, dead bands), G9 (draw independence), G8 + I3 (dependants), G5 (units), G10/G11 (criterion and design hygiene), then the tooling rules I9-I12.
