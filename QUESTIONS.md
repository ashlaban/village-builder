# Open questions for Kim

Questions that block backlog tasks or shape the design, gathered in one place, in priority order. Each has a proposed answer (**P:**). Answer inline (for example "yes", "P", or your own answer); the task files are then updated and set to `ready`. Answered questions move, unchanged, to `QUESTION_ARCHIVE.md`. Agents record an answer under its question with `node tools/questions.js answer` and move answered questions with `archive`; `list` and `show VB-NNN` read this file without reading it whole.

The questions marked "review" come from the review of 30 October 2026; the reasons and numbers behind them are in `REVIEW.md` and in `design.md`, "Systems overview". Those marked "planning" come from a pass over `design.md` for points with no task (30 October 2026); each names its task, whose file holds the draft criteria.

## Priority 1

Since 3 November the backlog is organised as vertical slices (`docs/roadmap.md`). Questions on tasks of slices 3 to 10 (marked by their task numbers below) wait for that slice's plan, which may reframe them; they need no answer now.

### Architecture review: the vision and the first steps (raised 3 November 2026)
From the architecture review (`docs/review-architecture.md`; ChatGPT's three documents are in `docs/architecture/`). Kim adopted the review's vision on 3 November: the player inhabits a pawn and lives a life the game does not prescribe, in a society that grows to towns, institutions and a wider world. Questions 1 to 5 settle the text for `design.md` (the review, section 3) and VB-079; questions 6 and 7 concern the new `ownership` arch (VB-172, VB-173). Questions 1 to 4 were answered on 3 November (`QUESTION_ARCHIVE.md`): the vision's text approved as written. Questions 1 to 5 and 7 were answered on 3 November (`QUESTION_ARCHIVE.md`).
6. Reads and writes. The review asks that no module expose its collections (Rule 2). **P:** reads stay free, since `st` is plain data for saves and the page reads it every frame; every field has one owner module, which alone writes it, and other modules call its operations; a static check enforces it (VB-173). The rule goes into `AGENTS.md` with VB-173.

## Priority 2

### VB-270: the hunger floors, out on every full run (raised 10 November 2026)
Slice 0's wrap-up (VB-200) ran the full bands at `7205992`: 31 in, 19 out. All 19 are the hunger floors and one population floor:
hungry-households out on all ten runs (the worst household hungry on 0.48 to 1.0 of its days after year 3, line 0.30), hunger-deaths on
eight (0.024 to 0.286, line 0.02), heirs seed 42 at 0.72 of its start. The day's earlier records read the same (17 out). No task owns them.
1. Who takes them? **P:** VB-270 first, small: name the households behind each worst share and each hunger death, and say which are food
   (then VB-048 or a slice-3 task) and which the probe (a short-lived household read as hungry on all its days; then a band change for you).
2. Until then, are they residuals to report, not a reason to stop a slice's wrap-up? **P:** yes, as `docs/gates.md` row 21 proposes for
   the reduced runs; the invariants band stays hard.

### VB-227: jobs refresh and matching, short of its 30 ms (raised 10 November 2026)
The order-preserving cuts (golden file unchanged; numbers in `backlog/VB-227.md`) make the line 6 to 7% cheaper and the review 15%: on `tools/bench.js` at `medium-ref` it measures 25.4 to 32.8 ms a game day after (mean 28.7), against 25.1 to 34.7 before (mean 28.2) on a noisy machine about 15% faster than on 9 November, where the line was 35.1; on that scale it is now about 33. The rest is the review polling every holder 14 times a day and matching rebidding every idle pawn every six minutes, which only rules 4 and 5 cut, with a change of behaviour.
1. Does VB-227 land as it stands and its last 3 ms wait? **P:** yes: merge the cuts, keep VB-227 open (or close it with criteria 3 and 4 moved), and make "jobs refresh and matching at most 30 ms at `medium-ref`, paired bench runs" an acceptance criterion of VB-249, whose planning days and due-queue take the review off its hourly pass.
2. Is the bench's absolute ms the right gate on this machine? **P:** gate on the line's share of the whole simulation in paired runs (here 17.0% to 16.1%) beside the ms, since the whole step varied 146 to 211 ms a day between runs of the same code.
   **A (Kim, 10 Nov):** As VB-261's question 5, accepted as proposed: timings are judged by their share of the whole step in paired, alternated runs, beside the ms.

### VB-212: the wishes the survey could not sort (raised 10 November 2026)
VB-212 built the player's wishes for the moving round (`st.player.wishes`: `out`, `claim`, `serve`; the survey is in `backlog/VB-212.md`). Three wants in the round need a design choice, and each is left a rule, as the task's note asks. None blocks slice 2's wrap-up.
1. Settling new land. The round draws a chance for each waiting adult of a crowded village (`SETTLE.chance` by rounds waited, `src/sim/settle.js:215`), which reads as the pawn's own willingness, and the wishes have no field for it. Today the player's pawn leads a party only by that draw; a wish to stay (`out: false`) keeps it from leading one. **P:** a fourth wish, `settle`: `true` passes the draw and `false` never leads a party, with the round's other rules (age, provisions, land within reach, the village crowded) deciding as for anyone; a small task in slice 2.
2. Following a sibling to new land. A waiting unmarried sibling follows a settler by a draw (`SETTLE.follow`, `src/sim/settle.js:53`: "who choose to follow"). **P:** the same `settle` wish answers it: `false` never follows, `true` follows when a sibling leaves, `null` draws as now.
3. A married couple. The round treats a couple as one: one of them claims for both (`src/sim/farmclaims.js`, `claimants`), a settler's spouse goes along, and each is counted in `st.demand` on its own. So a played pawn wished to stay still moves when its spouse claims a farm or leaves, and a wish for one farm does not bind the spouse. **P:** leave it until marriage as a negotiation (VB-233) says who answers for a couple; then the player's wishes speak for the couple when its pawn heads it, and otherwise the spouse's own wish stands, as now. The pawn panel says so meanwhile.

### Target architecture v2: decisions waiting (raised 3 November 2026)
From `docs/architecture/target-v2.md`, section 10.1. None blocks slice 0, 1 or 2; each is needed by the slice named. Question 3 was answered on 3 November (`QUESTION_ARCHIVE.md`).
1. Bodies: one membership graph with rules per kind (Proposed; it passed the succession probe), or a domain per kind? Kim asked to iterate first. **P:** settle it by measurement in slice 5's plan: build the household cache from the graph at populous medium, and adopt the graph if the build and the updates stay under 50 ms (VB-043's bound).
2. The 600 / 325 / 75 target (target-v2, section 6.3). **P:** a band for a developed island at the end game, not a quota; strata counted by relation to production, not residence, so a rural smith or miller is in the 325. Reported nightly from slice 9.
5. Who mints, and when coin is taken (needed in slice 8). **P:** only an established Crown mints, after silver has circulated by weight; whether coin is taken is a norm learned from deals (target-v2, section 5.3); a town mints only by the Crown's grant.

### Review, 2 November: where to spend Kim's answers (raised 2 November 2026; revised in the second pass the same day)
VB-033 was answered with the claims review and is built; the order of work, VB-127 and VB-129 were answered in the second pass (`QUESTION_ARCHIVE.md`). Measured in `REVIEW.md`, review of 2 November, second pass.
1. Who closes finished questions? **P:** this nightly review moves a question only after you answer it inline; "keep" or "P" counts. Say "P to all" on a block to answer it whole.

### VB-162, VB-163 and VB-165: the external review's new tasks (raised 2 November 2026)
From the external review (`docs/review-external.md`). The task files hold the draft criteria; the answers below make them `ready`. VB-162 and VB-165 are page features, so they wait for the feature freeze to lift; VB-163 is tooling and may run during it. Questions 1 and 2 were taken up by slice 0's plan (VB-181, 3 November): the roadmap, whose slices Kim decided, makes the floors of question 1 the first asserted bands, and Kim's decision 9 (target-v2, section 8) replaces question 2 (reduced scenarios asserted in verify, the long runs reported nightly). VB-163 is rewritten and `ready`; answer "P" to move them to the archive, or change a floor.
1. VB-163: what should the long-run test guard? **P:** a floor against collapse, not the design's targets: a scenario's population ends at or above its start; no village of 3 or more households at year 5 is empty at the end; hunger causes at most 2% of deaths after year 3; no household is hungry on more than 30% of its days in a year after year 3. Founders today stand at 25 to 28 in year 38, so a target of about 3% growth a year would fail at once; the targets belong in the wrap-ups (VB-035, VB-048).
2. VB-163: which runs? **P:** populous small at seeds 3, 7, 11, 42 for 30 years; founders small at the same seeds for 50; heirs small at seeds 7 and 42 for 30; under 60 s on its own, seeds in parallel.
5. VB-163 (raised 10 November 2026, by VB-163): two floors fail today. On the reduced run (populous tiny, 8 years) some 15 die after year 3, so one hunger death is 6 to 7% (seeds 3 and 42 have one each), and a household of seed 42 is hungry on 50% of its days in year 4 (one of seed 3 on 31% in year 7). On the full runs (`docs/bench/bands.jsonl`) 17 of 50 bands are out: hunger and starvation are 2.4 to 20% of deaths after year 3 in every populous run, and 3 to 38% in three of the four founders runs and in heirs at seed 42; some household is hungry on all its days (12 or more) of some year in seven runs, and heirs at seed 42 falls from 18 to 8. **P:** keep the floors as drafted on the full runs (reported, so they show the problem rather than hide it); on the reduced run assert hunger deaths at most 10% and the worst household at most 60% of its days, as `tests/lib/bands.js` now does, until a food task (the hunger of single households) brings them back to 2% and 30%.

### VB-183: the gathering, the fair and goods of place (raised 10 November 2026)
From the markets review (`docs/review-markets.md`) and Kim's answers of 10 November, now in `design.md` (section 11, The gathering; section 9, The fair; section 8, Goods of place and side crafts). Kim's points are Decided there; these are the proposals written around them. Slice 4's plan (VB-183) writes its tasks from the answers, and still owes its own questions (quanta, the worth table, need curves, loans, boats).
1. What may be exchanged for what? Today's plan gives every good a worth in rations, so anything may be offered for anything: grain for a cow, a cow for a field. The alternative keeps the one unit of account but sorts goods into three classes (food; animals, cloth and labour; land), and lets custom say which exchanges across classes are proper. **P:** classes: within a class a swap is ordinary; grain for a cow in a good year is admired; a cow taken for grain in a dearth is allowed but remembered as a hard bargain; land is not offered at a fair until slice 5's custom "Debts are paid with" allows it. It costs one small table and keeps the hungry from being stripped at their first fair.
   **A (Kim, 10 Nov):** Classes.
2. Which goods of place first? **P:** dried fish (sea shore, lake or river) and tar (pine forest), both made as side crafts with a simple facility; bog iron with tools that wear (VB-121), stone with the mill (slice 6), salt and fine cloth with the ship (slice 8).
   **A (Kim, 10 Nov):** Yes. Can we add more? What would tar be used for? The value of the goods should be grounded in a pawn's need, or prestige or the like (see questions 9 and 10).
3. Specialised work as side crafts. **P:** a household stays a farm and takes a craft in its slack hours, aimed by its holder's project at something only the fair gives; skill by hours and one facility a household make a village's fisher or tar burner without a rule naming them; a craft household and a full specialist follow only as the market is held more often (the ladder).
4. How a village comes to host. **P:** a village with a green may offer at its autumn meeting; every village chooses there the gathering it attends next year, by nearness in travel and in customs, kin there, the hosts' prestige and how last year's went; one gathering a village; fewer than three villages and it is not held.
   **A (Kim, 10 Nov):** Yes.
5. Who decides a border case at the gathering? **P:** the holders present from the villages not party to it, under the Disputed claims custom of the gathering's villages; two villages of different gatherings settle it as now.
   **A (Kim, 10 Nov):** Yes. Does this imply a disposition between villages? (see question 11)
6. Marriages between villages. **P:** the round's matcher may pair pawns of different villages only if both were at the same gathering within the last 3 years; spokesmen negotiate there.
   **A (Kim, 10 Nov):** Fine, but this system needs revamping later: marriage as a negotiation should take the dowry, for one, into account.
7. Keeping goods. **P:** butter, dried fish, tar, cloth and a sheep are accepted beyond the taker's own need, at customary worth and up to a cap, to pass on later: barter's way round "you have nothing I want", and the island's nearest thing to money before silver.
   **A (Kim, 10 Nov):** Yes.
8. The dates. **P:** autumn days 6 to 8, before the village meetings of day 10.
9. A third good for slice 4, grounded in standing? Kim asked on 10 November for more goods, each grounded in a need or in prestige (`design.md`, What each good is for). **P:** ale: brewed from surplus grain, poured by the host at the gathering and at weddings and funeral ales (VB-126); the guests' opinion of the host rises with what was poured, and prestige gains a small term for it. It gives the plain villages' grain a use and the host a cost. Furs wait for roe deer (VB-139), the rest for slices 6 and 8.
10. Does tar give standing? **P:** yes, a little: a tarred farm counts toward its holder's prestige, as the first answer to the open point "what a more prestigious house brings its owner"; its main use stays the need (boats, timber).
11. Disposition between villages. Judging a border case implies that villages stand in some relation to each other. **P:** no new stored number: it is read from the opinions and goodwill balances the holders of one village already hold toward those of another, border grudges included; it leans a judge, weighs in the choice of gathering, and moves with cases, matches and deals.

### Towns: the bases of city formation (cities review of 1 November)
The review (`docs/review-cities.md`) names eight bases of a town; the game has the landless (1), a surplus (2) and the sites (5), and lacks a way to move the surplus (3), work only a town does (4), rules (6), a patron (7) and a town's way of life (8). It proposes a new arch `towns` in five phases. No tasks yet: the answers let its plan task be written. Questions 5 and 6 are about the game as it is and concern the expansion wrap-up (VB-035).
1. How does a town come about? **P:** both ways, as in Sweden: a yearly fair at the site of highest market potential grows into a market place (*köping*) once 3 households there live by trade or craft; the Crown charters a market place of 5 such households as a town (*stad*), and without the Crown a market place of 10 with a church counts as one.
2. What comes first? **P:** the fair (Phase 1): once a year after threshing (autumn days 6–8), one adult from each household within a day's walk or a boat crossing brings what it can spare above its seed and buffer, or buys what it lacks; it is also an occasion (VB-126) for people of different villages. In every run the households above their need make more than those below it lack, in the same years (section 3.2). A household sells only grain above its seed and two years of its need: in the review's toy town, a town fed from grain above one year's need left the countryside a fifth the size after 100 years (290 people against 1,402 over four seeds), and one fed from what would rot left its hunger unchanged.
3. Money. **P:** none at first: everything valued in rations at fixed rates, paid in grain, animals, labour days or on credit; prices that move, and a silver unit of account, come with goods from outside (Phase 3).
4. The elite. **P:** grain loans repaid with a quarter more at the next harvest; unpaid after two harvests, paid in labour days, or with a field under a new custom "Debts are paid with" (labour; land; labour, then land; default labour); land beyond a household's hands let to landless tenants (*landbor*) for a quarter of the harvest; a master household (rents and stores at least 1.5 times its need for 3 years) ranks field work 2 of 10; prestige gains a term for wealth and for feasts given. Wealth now is flat (Gini about 0.3) but sticky (rank correlation 0.9 after 10 years), so it needs mechanisms to grow, not to persist.
5. Two holders who wish to marry: answered 1 November (stability review); in `QUESTION_ARCHIVE.md`, built in VB-153.
6. Households of one: answered 1 November (stability review); in `QUESTION_ARCHIVE.md`, built in VB-152.
7. The urban penalty. **P:** the death hazard times 1.8 in towns (Stockholm had 52 deaths per 1,000 a year in the 1750s). The review's arithmetic shows a town of historical size (5% of the people) absorbs only a small share of the countryside's surplus of births; the main brake must stay late marriage and celibacy, which the game barely has (0–5% of women 45–54 never married, against 10–20% in the European marriage pattern).
8. The outside world. **P:** ships, the Church and the Crown as actors with fixed rules: ships call in summer at the best shore site with prices set per decade; the Church comes at about 300 people, takes a tenth of the grain and builds a church; the Crown taxes each farm, charters towns and frees masters who serve it from tax (*frälse*).
9. Scenarios. **P:** first "No land left" (a full island, buildable now: it shows the ceiling and the two problems above), then "The fair meadow" with Phase 1; the other five (`docs/review-cities.md`, section 6) as their phases are built.

### VB-219: slice 1's wrap-up, kin help booked (raised 9 November 2026)
From the wrap-up's measurements (`backlog/VB-219.md`, notes of 9 November): help as a seasonal ask over 16 runs (seeds 3, 7, 11 and 42,
populous small, 15 years, four ways of stepping the clock each), the probe of the balances, the slice's cost, and The gift against the
code. None blocks a task.
1. The slice's share of the budget. `docs/bench/budget.md` gains `kin help and goodwill` (the gift's check, the booking, handovers and
   ends: 0.06 to 0.13 ms a game day at `medium-ref` in six runs, median 0.07), and its 0.1 ms has to come from somewhere, since the shares
   of 9 November sum to 192 ms with 8 kept back. **P:** from the 8 kept back (now 7.9): slice 1 is growth among today's systems. Help's own
   daily ask (about 0.45 ms) and the gift's moves and events (about 0.07 ms), which were help's before the slice, stay in hunger and meals'
   3 ms. (The other way: take 0.1 from hunger and meals, which measured 2.5 to 2.9 ms without the ask and 3.0 to 3.5 with it.)
2. Households of one under the seasonal ask. Over the 16 runs, hungry household-days hardly moved (7,547 before VB-216, 7,648 now; the
   17% VB-222 saw is one way of stepping, and the others give +26%, -32% and +1%), but deaths from hunger and starvation rose from 32 to 43,
   and those in households of one person from 0 to 14 (in 9 of the 16 runs). A lone person whose ask brings nothing (no kin with a
   surplus, the store empty) waits a whole season. **P:** an ask that brings nothing at all does not count as the season's ask, so the
   household may ask again on a later day; a task builds it as a behaviour change and measures it by the same 16 runs, and the rule is
   otherwise kept (Lumps and occasions).
3. The store's last grain. In a lean season the village store gives its whole remainder to the first household that asks (the lowest
   id that day). At founders 7 (small), the store held about 80 rations for two hungry households: asking for 12 days at a time, as
   before VB-222, each got 36 in the first winter and household 4 the last 7.7 in spring; asking once a season, each got 29 in winter
   and household 4 the last 21.8 in spring, and household 5's one member starved in the autumn of year 2. **P:** keep it until the
   village has an agent that decides its store's gifts (The gift, Who books); question 2's change covers the worst case.
4. Goodwill at a handover: section 9 says "a share of the holder's goodwill passes to the new holder, set by custom" (Decided, 3 Nov);
   The gift and the code pass a fixed half (`GOODWILL.share`, Agreed 8 Nov). **P:** half, for every culture, until a custom of
   inheritance takes it up (customs, or slice 5's estates); the row of section 9 gains "(half for now; The gift)".
5. A balance between the old holder and the heir. At a handover, the half of the old holder's balance with the heir himself has nowhere
   to go, so it is cancelled, and the old holder keeps the other half (`passGoodwill`); since kin help runs between parents, children
   and in-laws, the heir can be the counterpart. The design does not say. **P:** keep it, and write it into Who books: "a balance with
   the heir is halved".
6. Help in hunger (section 8) says "each adult keeps a buffer of 20–60 days' food (drawn per pawn) before giving"; the code reads only
   the holder's (a household without a holder keeps 60 days), as The gift's Allowance says. **P:** reword the row: "the holder keeps a
   reserve of 20–60 days' food (drawn per pawn) before giving; a household without a holder keeps 60".

### VB-126: occasions (relationships review)
No two pawns of different villages ever meet today, so courting would keep marriages inside the village.
1. Which occasions first? **P:** the village meeting (the people with a voice on the green, 10:00 to the meeting at 12:00), the wedding (the day after, 16:00–21:00 at the couple's farm, near kin of both spouses from any village within a day's walk) and the funeral ale (the day after a death, 16:00–21:00 at the farm of the dead, its household and near kin).
2. Do occasions override work? **P:** the meeting and a funeral ale do (work stops for them); a wedding takes those who are free, as it falls in the evening.

## Priority 3



### VB-158 and VB-033: stakes and empty farms, as built (raised 2 November 2026)
Measured over 20–30 years on the small map (populous seeds 7 and 42, founders at six seeds, heirs at seeds 7 and 42); the numbers are in `backlog/VB-158.md` and `backlog/VB-033.md`.
1. Contests never happen. A stake may be contested only after about 18 months unworked (below `CLAIMS.contestBelow` = 0.5), but projects are finished within days: 421 projects, no contest and no lapse. **P:** keep as built; the rule comes into play once projects can stall (a household losing its hands, winter work, larger projects), and then the custom decides as designed.
2. Empty farms go to singles. Under "with the land" a couple needs a place to marry, so landless couples are rare and nearly every claimant moves in alone (populous seed 7: 8 farms restored, all by one person; most marry there within a few years). Restored households are hungry on more days than others (populous seed 7: 7.8% of household-days against 1.0%; heirs 42: 11% against 5%). **P:** keep; a lone claimant takes a servant at the next moving round like any lone holder (VB-152), and courting (VB-036) is where spouses come from.
3. Short provisions. A claimant's start is made up from the old households' grain "as far as they can", so one moved in with 23 grain for 4 fields. **P:** keep, as settlers' families give; or, if you want a floor, a claimant whose provisions fall short of seed for one field and 30 days of food waits a year to move in, as settlers do.

### VB-121: winter crafts (job review, second pass)
1. Tools. **P:** each household's tools from 0 to 1; 0.01 lost per 10 hours of field work; field work at (0.7 + 0.3 × tools) of the rate; a 4-hour craft job restores 0.1, posted in winter below 1 and in autumn below 0.6.
2. Fence poles. **P:** a 4-hour trip in winter brings 4 poles and fells a tree; mending a stretch uses one; posted while a household has under 8.
3. Who. **P:** a new type of work, crafts: farmer 6, farmhand 7, son 7, retired 5, wife 2, maid 1, daughter 1, child 0.

### VB-115: building bridges (raised with VB-112)
Rivers are crossed only at fords (VB-112); bridges need construction (Kim, 30 Oct).
1. Where and when does a village build a bridge? **P:** at the yearly meeting, a village whose members walked more than 200 extra steps in the past year because of a river (route cost with a bridge at the best site less the cost over the nearest ford, summed over trips) builds one bridge at that site, at most one at a time.
2. What does it cost? **P:** 6 loads of timber felled from the commons wood (one felling trip each, as for firewood) and 40 hours of village work, at the priority of the green and well (VB-058); a bridge over a river (not a brook or stream) costs twice that.
3. Does a bridge decay? **P:** yes, like fences: its condition falls about 5% a year and a mend job restores it; below 20% it is impassable.

### VB-095: family tree by scope (planning)
1. What does the tree open on? **P:** the selected pawn's village: its living members, 2 generations up and 1 down from them, the rest folded behind "+ n more" nodes; a control switches to household, village, culture and the selected pawn's line.
