# Open questions for Kim

Questions that block backlog tasks or shape the design, gathered in one place, in priority order. Each has a proposed answer (**P:**). Answer inline (for example "yes", "P", or your own answer); the task files are then updated and set to `ready`. Answered questions move, unchanged, to `QUESTION_ARCHIVE.md`. Agents record an answer under its question with `node tools/questions.js answer` and move answered questions with `archive`; `list` and `show VB-NNN` read this file without reading it whole.

The questions marked "review" come from the review of 30 October 2026; the reasons and numbers behind them are in `REVIEW.md` and in `design.md`, "Systems overview". Those marked "planning" come from a pass over `design.md` for points with no task (30 October 2026); each names its task, whose file holds the draft criteria.

## Priority 1

Since 3 November the backlog is organised as vertical slices (`docs/roadmap.md`). Questions on tasks of slices 3 to 10 (marked by their task numbers below) wait for that slice's plan, which may reframe them; they need no answer now.

## Priority 2

### VB-294: where the village's choice of gathering is made (raised 11 November 2026)
Raised by the backlog's curation of 11 November. VB-294's criterion reads "A village's choice is a routine of its meeting (VB-257), so the player's pawn argues for it by advocacy as for any cause." VB-257's routines are village work (at most four a year, each a source of tasks on the `villager` basis), set "as a decision of the meeting (a command of the meeting, as its other decisions)"; a choice among hosts posts no work. Slice 5's VB-313 builds `sim/decisions`, the one place where a body's questions, procedures and ballots are asked (the custom votes first; VB-293's offers are planned to move there), but it is slice 5 and P3, and VB-294 is slice 4 and P2.
1. Is the choice of gathering one of VB-257's routines, or a question of the meeting of its own? **P:** a question of its own, made as VB-257 makes its decisions (a command of the meeting, the player's pawn arguing by advocacy), not one of the four routines; VB-294 keeps waiting for VB-257 only, and VB-313 moves the choice into `sim/decisions` with the other questions when it lands, so slice 4 does not wait for slice 5. The other way: VB-294 waits for VB-313 as well, and the fair moves behind slice 5's refactor.

### VB-184: debt and land, slice 5 (raised 11 November 2026)
Slice 5's plan (`backlog/VB-184.md`), written while Kim was away: `design.md`, Households and other bodies, Land and rights, Exchange's Loans, obligations and cases, and slice 5's practices (all Proposed, 11 Nov); tasks VB-310 to VB-321, with VB-034, VB-035 (now the wrap-up), VB-043 to VB-045, VB-082, VB-092, VB-095 and VB-141 confirmed or rewritten and VB-046 closed into VB-035. Where the roadmap (3.5), target-v2 or an archived answer pointed the way, the orchestrator decided in Kim's place and the tasks are ready or wait only for other tasks; each such answer is marked "decided in Kim's place" and stands until Kim overturns it. Only question 7 (bodies) holds a task (VB-043, and the scope views after it). Question 4 of "Towns" (the elite) is answered by questions 1 to 6 below. Numbers for scale: a field is worth 120 rations (`SHARES.perField`), a household of four needs about 190 rations a year, a day's work is worth 3.
1. Remedies, and the custom "Debts are paid with". **P (decided in Kim's place):** a new practice with three options: labour; labour, then land; land; default "labour, then land", malleability 0.5. Labour: a day (8 work hours) for each 3 rations owed, within a year, worked as the creditor's tasks. Land: a field passes when the debt left is at least half a field's worth (60 rations), the field of least worth first, one field a hearing (the ceiling that tunes land concentration, target-v2 6.2); its worth above the debt is booked as goodwill to the debtor's holder; the debtor's household stays on it as tenant. Under "labour, then land" land is taken only for labour owed and not given within its year. No animals and no persons are taken. The cities review proposed "labour" as the default; under it land would not move in the default culture until the custom drifted, and the slice's probes (land Gini, tenancy share) would read nothing at four seeds.
2. Tenancy terms. **P (decided in Kim's place):** a quarter of each harvest of the holding and 2 days' labour a year at the owner's harvest (`docs/roadmap.md` 3.5); the tenancy runs for its household while the owner's holder agrees at each handover (it does unless its opinion of the heir is below 0), and ends when the household dissolves or leaves; then the owner works the land or lets it again, a farm as an empty farm is claimed. No fixed term (the Crown's six years waits for the Crown, slice 8). A vacant tenancy is a home for a landless couple under "with the land".
3. Interest, and when a loan is due. **P (decided in Kim's place):** a new practice "Loans of grain are repaid": with a quarter more (default) or as lent, malleability 0.4, which an established Church may later claim as doctrine (usury, slice 8). Due when the borrower's next harvest is threshed, paid from grain above its floor, in part if it must; unpaid after the second harvest, defaulted (target-v2, trace 7.1). A short household borrows only after help has gone round, first in its own village (most grain to spare first), then from its trade partners of the gathering; no lending to a household its holder holds in enmity (below −0.3), nor to one with no field and a loan unpaid.
4. Procedures per culture. **P (decided in Kim's place):** two new practices. "Who judges a case": the meeting's voices (default, weighted as customs are voted) or the alderman alone; "One's own cause": the parties' households stand aside (default) or vote. A tie goes to the alderman's voice; with no alderman the case is extended a year. Escalation to a landed arbiter beyond the village (target-v2 4.5, the implicit Crown) waits for a body above the village.
5. Class thresholds, and what landed changes. **P (decided in Kim's place):** target-v2's thresholds (4.6): landed after three year ends running with rents and stores at least 1.5 times the household's need, and no longer after three below 1.1; also tenant, cottager and peasant, from rights. Landed changes two things, through rule contributions: the holder's field work falls to 2 of 10, and its prestige gains 0.2. The cities review's prestige for wealth and for feasts given is left to ale's prestige (VB-305) for now.
6. The office of alderman. **P (decided in Kim's place):** chosen at the autumn meeting when vacant, among the village's holders, by a new practice "How the alderman is chosen" (elected by the meeting, default; by turns among the farms, a year each; malleability 0.3); held until death, retirement, leaving or the turn's end; he decides ties, he is the village's agent (the village store's help and loans are booked as goodwill to him in person, target-v2 5.5), and gains 0.3 prestige while in office. No land goes with the office in slice 5: the common meadow of target-v2's trace waits for grazing rights (VB-141).
7. Bodies: one membership graph, or a domain per kind ("Target architecture v2: decisions waiting", question 1). Measured on 11 November, as that question proposed (populous medium, seed 7, year 12: 1,031 living, 1,288 ever born, 211 live households): today's memberships as a graph of typed edges (residence, service, holding, a household's village, unions, and the dead's ended residences outside the live index) have 2,009 edges; the graph builds in 0.55 ms, the household cache derived from it in 0.33 ms and equal to today's for every household, and 1,000 moves (an edge ended, one made, the cache kept) take 0.86 ms; VB-043's bound is 50 ms. The cost that remains is history: about 2 ended edges a pawn ever born in the save, to be folded into the record like other history (rule 9). **P:** adopt the graph as Membership's truth, with the household cache Membership's own (VB-043 as rewritten). Only VB-043 and the scope views after it (VB-044, VB-092, VB-095) wait for this; the debt chain names households and villages as today.
8. Bands for the wrap-up's probes (VB-035), populous small at year 30, four seeds. **P:** land Gini (fields owned by live households) 0.25 to 0.45 (about 0.26 today, the cities review); tenancy share (fields worked under a tenancy) 3 to 15%; landed households 5 to 20 per 1,000 living (the end game's 75 elite per 1,000 is about 12 to 15 households, and slice 5 is only its first cause); elite turnover: 30 to 70% of the households landed at a year end no longer landed 30 years later. Reported, never failing; asserted on the reduced run only for loans and defaults.
9. Hired hands' wage. **P (decided in Kim's place):** 3 rations a day of 8 work hours, the worth table's day's work, paid at the day's end; hired at sowing, haymaking and harvest when a field task has waited 2 hours, from the landless adults of the village with no task of their own; a landed household hires first, and none hires below its floor.
10. Who owes. **P (decided in Kim's place):** a loan, rent or wage binds the household (or village) its agent dealt for, so a holder's death leaves it standing, and there is no personal estate until personal goods exist (silver, slice 8); a dissolved debtor's obligations pass to the household that takes its farm, else to the one its last holder's heir lives in, else they lapse and the creditor remembers it.

### VB-284: tuning the food balance (raised 11 November 2026)
VB-284 measured where rations fall short (`docs/bench/food-balance.md`; populous small, seeds 3, 7, 11, 42, 15 and 30 years, after VB-282). Nobody is short
before year 16; in years 16 to 30, 196 household-years are hungry over 0.3 of their days: households of about 4 (2.3 adults, 1.6 children) on 2.9 fields,
**without cattle**, on worn soil, in summer and autumn after the second or third poor harvest. Households without cattle are 69 % of household-seasons and
all of the growth; on 3 fields they make 0.71 of their need (with cattle 1.33). No value is changed until you answer; the answers become one tuning task,
measured with the same runs. VB-048's fourth criterion points here.
1. Fields a household wants. `fieldsWanted` (`src/sim/fields.js`) counts the gross yield: `FIELDS.want` 1.1 of the need at `FIELDS.expect` 0.75 of 100,
   75 a field, of which 25 is seed, so the plan nets 0.73 of the need. **P:** count it net of seed, `ceil(FIELDS.want × rations / (FIELDS.expect ×
   fieldYield − seedPerField))` (the same as `FIELDS.want` 1.1 to 1.65 in today's formula), still capped by 2 fields a hand. Moves: a household of 2 adults and
   2 children wants 4 fields, not 3, a lone adult 2, not 1; the rows' farms from about 0.96 to about 1.3 of need in an ordinary year; more land taken
   (villages fill sooner, `FIELDS.room`), more hours in the fields, and the work counters of field jobs rise.
2. The soil without manure. `SOIL.wear` 0.08 a crop to `SOIL.floor` 0.75, so a farm without cattle farms at 0.80 to 0.84 against 1.07 with them. **P:**
   `SOIL.floor` 0.75 to 0.85 (stubble grazed and a field rested keep some of their strength). Moves: an unmanured field yields up to 13 % more; households
   without cattle on 3 fields from 0.71 to about 0.78 of need; manure's worth falls by as much (cattle keep their lead at 1.07); the early game unchanged
   (soil there is 0.99 to 1.15).
3. Yield. **P:** `ECON.fieldYield` stays 100. Years 4 to 15 net 73 to 84 a field reaped and no household is short, stores at 126 to 517 rations; a higher
   yield moves the early game, which needs nothing, and the rise over a game is VB-160's. It would move: every harvest by the same share, stores and
   spoilage, the deals' surplus.
4. The hungry gap before harvest. The gap is summer and autumn (3.3 % and 4.4 % of need short; spring 0.5 %, winter 0.1 %), as new grain is in store only
   late in autumn; the households short are those that start a season with under 12 days of food, after two or three poor years, since grain kept a second
   year loses 20 % a year. **P:** `ECON.storeLoss` [0.05, 0.2, 0.4] to [0.05, 0.1, 0.4], after 1 and 2 are measured. Moves: a household with a year and a
   half in store keeps about 2 to 3 days of its need more a year; little on its own (1 and 2 are the levers), more grain held by the good farms.
5. What the animals give. Milk (`HERD.milk` 0.5) and manure (`SOIL.perLoad` 0.04) already make a household with cattle 1.33 to 2.0 of its need; the
   shortage is in the households that have none (new farms: 0.9 meadows against 5.9). **P:** no change to the animals' yields; instead a task in the animals
   arch for the herd's spread: a new household of 2 or more hands with a meadow wants a cow in its standing plan (from kin's herd at a marriage, or by a
   deal), so the share of household-years without cattle after year 16 falls from 0.75. It would move: herds, hay and meadows taken, manure on the new
   farms' fields, and the deals in cattle.

### VB-212: the wishes the survey could not sort (raised 10 November 2026)
VB-212 built the player's wishes for the moving round (`st.player.wishes`: `out`, `claim`, `serve`; the survey is in `backlog/VB-212.md`). Three wants in the round need a design choice, and each is left a rule, as the task's note asks. None blocks slice 2's wrap-up.
1. Settling new land. The round draws a chance for each waiting adult of a crowded village (`SETTLE.chance` by rounds waited, `src/sim/settle.js:215`), which reads as the pawn's own willingness, and the wishes have no field for it. Today the player's pawn leads a party only by that draw; a wish to stay (`out: false`) keeps it from leading one. **P:** a fourth wish, `settle`: `true` passes the draw and `false` never leads a party, with the round's other rules (age, provisions, land within reach, the village crowded) deciding as for anyone; a small task in slice 2.
2. Following a sibling to new land. A waiting unmarried sibling follows a settler by a draw (`SETTLE.follow`, `src/sim/settle.js:53`: "who choose to follow"). **P:** the same `settle` wish answers it: `false` never follows, `true` follows when a sibling leaves, `null` draws as now.
3. A married couple. The round treats a couple as one: one of them claims for both (`src/sim/farmclaims.js`, `claimants`), a settler's spouse goes along, and each is counted in `st.demand` on its own. So a played pawn wished to stay still moves when its spouse claims a farm or leaves, and a wish for one farm does not bind the spouse. **P:** leave it until marriage as a negotiation (VB-233) says who answers for a couple; then the player's wishes speak for the couple when its pawn heads it, and otherwise the spouse's own wish stands, as now. The pawn panel says so meanwhile.

### VB-283: a household nobody can come to (raised 10 November 2026)
VB-283 replayed the ten full runs of the bands (`docs/bench/lone-households.js`; tables in `backlog/VB-283.md`). At `38b920d`, after VB-282 (a hungry household may eat its seed), 56 of the 225 household-years hungry over 0.3 after year 3 are of households with at most one grown member (34 households; 35 rows hold one field). The orchestrator decided, for you to overturn, that such a household is taken in when its seasonal ask for help falls short: a free relative moves in, else a servant (VB-308, ready; `design.md`, Households short of people, Taken in before it starves). That reaches 14 or 15 of the 56. In 42, nobody could come; 33 of those had a parent's, child's or sibling's household within reach. What becomes of them moves a Decided point, so it waits for you (VB-309, blocked).
1. Who holds the farm when its people go to kin? **P:** the kin household holds it in trust: it works the fields and takes the harvest, the owner and the holder stay the same, the house stands empty and decays; the trust ends when the holder marries or takes a servant at a moving round (they move back), when a ward comes of age, or at the holder's death (succession as today). The farm stays the family's, as the task asks, and the relation is the one splitting land already has (`design.md`, Handover and shares: the old household works the sibling's fields, Agreed 30 Oct), so VB-034 can reuse it. The other way: the farm is given up and stands empty, held by the village, with the family's birthright to claim it back (the machinery of a farm that dies out; nothing new, but the owner changes and the land goes out of use).
2. The orphan rule (Decided, 1 Nov: with no relative to be guardian, the children go to kin and the farm stands empty). **P:** the kin who take the children hold the farm in trust in the same way until the heir is 18, so the farm stays the family's. The other way: keep the rule as decided; VB-309 then serves lone adults only.

### Target architecture v2: decisions waiting (raised 3 November 2026)
From `docs/architecture/target-v2.md`, section 10.1. None blocks slice 0, 1 or 2; each is needed by the slice named. Question 3 was answered on 3 November (`QUESTION_ARCHIVE.md`).
1. Bodies: one membership graph with rules per kind (Proposed; it passed the succession probe), or a domain per kind? Kim asked to iterate first. **P:** settle it by measurement in slice 5's plan: build the household cache from the graph at populous medium, and adopt the graph if the build and the updates stay under 50 ms (VB-043's bound). Measured by slice 5's plan on 11 November: 0.55 ms to build, 0.33 ms to derive the household cache; the numbers and the proposal are question 7 of "VB-184: debt and land".
2. The 600 / 325 / 75 target (target-v2, section 6.3). **P:** a band for a developed island at the end game, not a quota; strata counted by relation to production, not residence, so a rural smith or miller is in the 325. Reported nightly from slice 9.
5. Who mints, and when coin is taken (needed in slice 8). **P:** only an established Crown mints, after silver has circulated by weight; whether coin is taken is a norm learned from deals (target-v2, section 5.3); a town mints only by the Crown's grant.

### VB-162, VB-163 and VB-165: the external review's new tasks (raised 2 November 2026)
From the external review (`docs/review-external.md`). The task files hold the draft criteria; the answers below make them `ready`. VB-162 and VB-165 are page features, so they wait for the feature freeze to lift; VB-163 is tooling and may run during it. Questions 1 and 2 were taken up by slice 0's plan (VB-181, 3 November): the roadmap, whose slices Kim decided, makes the floors of question 1 the first asserted bands, and Kim's decision 9 (target-v2, section 8) replaces question 2 (reduced scenarios asserted in verify, the long runs reported nightly). VB-163 is rewritten and `ready`; answer "P" to move them to the archive, or change a floor.
1. VB-163: what should the long-run test guard? **P:** a floor against collapse, not the design's targets: a scenario's population ends at or above its start; no village of 3 or more households at year 5 is empty at the end; hunger causes at most 2% of deaths after year 3; no household is hungry on more than 30% of its days in a year after year 3. Founders today stand at 25 to 28 in year 38, so a target of about 3% growth a year would fail at once; the targets belong in the wrap-ups (VB-035, VB-048).
2. VB-163: which runs? **P:** populous small at seeds 3, 7, 11, 42 for 30 years; founders small at the same seeds for 50; heirs small at seeds 7 and 42 for 30; under 60 s on its own, seeds in parallel.
5. VB-163 (raised 10 November 2026, by VB-163): two floors fail today. On the reduced run (populous tiny, 8 years) some 15 die after year 3, so one hunger death is 6 to 7% (seeds 3 and 42 have one each), and a household of seed 42 is hungry on 50% of its days in year 4 (one of seed 3 on 31% in year 7). On the full runs (`docs/bench/bands.jsonl`) 17 of 50 bands are out: hunger and starvation are 2.4 to 20% of deaths after year 3 in every populous run, and 3 to 38% in three of the four founders runs and in heirs at seed 42; some household is hungry on all its days (12 or more) of some year in seven runs, and heirs at seed 42 falls from 18 to 8. **P:** keep the floors as drafted on the full runs (reported, so they show the problem rather than hide it); on the reduced run assert hunger deaths at most 10% and the worst household at most 60% of its days, as `tests/lib/bands.js` now does, until a food task (the hunger of single households) brings them back to 2% and 30%.

### Towns: the bases of city formation (cities review of 1 November)
The review (`docs/review-cities.md`) names eight bases of a town; the game has the landless (1), a surplus (2) and the sites (5), and lacks a way to move the surplus (3), work only a town does (4), rules (6), a patron (7) and a town's way of life (8). It proposes a new arch `towns` in five phases. No tasks yet: the answers let its plan task be written. Folded in by slice 4's plan (VB-183, 10 November): question 2 is replaced by the gathering and its fair (`design.md`, The gathering; The fair), on winter days 1 to 3, with no rule of two years' need (need and the floor decide); question 3 is answered (barter until coin, taxes drive money; `design.md`, Money); question 1 has a proposal (a town grows from a gathering by how often it is held; `design.md`, Towns and regions) and waits with 7 for slice 9's plan (VB-189); question 4 is folded into slice 5's block ("VB-184: debt and land", questions 1 to 6, 11 November), question 8 waits for slice 8's (VB-188). Questions 5 and 6 are about the game as it is and concern the expansion wrap-up (VB-035).
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

### VB-187: the gossip experiment, for the talk plan VB-186 (raised 12 November 2026)
From the experiment of target-v2 10.2 (`docs/gossip-experiment.md`; `node tools/gossip.js`, seeds 1 to 10): stories meet the spread and
lie bands, averaging only its own; forgetting is the weak band. None blocks a task; VB-186 takes them up.
1. Which model for gossip. Averaging fails the forgetting, lie and counter-story bands by construction and makes strangers judge the
   subject as harshly as the witness (-0.60 against -0.19 under stories, at a year). **P:** model B, stories, as decided; averaging
   stays for attitudes (customs).
2. Saturation per audience. A story from spring is stale by the winter gathering: an island joined by ice hears it in 3 of 10 seeds
   (8 of 10 when the story is six days old), because its tellers lost zeal at home. **P:** a held story keeps two zeals, for its own
   village and for others, so news is told afresh to people from elsewhere. (The other way: only what happens at the gathering crosses
   the water, and other news only while fresh.)
3. Forgetting as a cohort. A village that retold a story together forgets it within a few days; at a heard story's half-life of one
   game year it is mostly forgotten by year 3 in 4 of 10 seeds, at 40 days in 10 of 10. **P:** a heard story's half-life of 40 game
   days, first-hand memories three times as long, and a per-pawn factor of 0.5 to 1.5 (wits, or seeded), so forgetting is a curve.
4. The forgetting band's measure. **P:** "mostly forgotten within three years" is held by under half of those who held it at its peak.
5. Sharpening and the hop discount. Without a discount on what a heard story writes, 54% of held opinions reach the extremes, since each
   hop sharpens. **P:** both: 8% sharper a hop on the told valence, 0.8 a hop on the memory it writes; the Proposed polarisation band
   measured as extremes (|opinion| at 0.8 or more) under 0.25 of held opinions and no village with 20% on each side of 0.3, checked in
   slice 7's wrap-up on the game (one story cannot test it).
6. The alehouse, not the gathering, carries news to the neighbouring village (the share of goers changes nothing; halving B's alehouse
   visits drops the fair-village band to 7 of 10). **P:** tune that band on the alehouse's draw from neighbouring villages.
7. Belief is the parameter everything hangs on (a base of 0.3 leaves the fair's other village unaware in 7 of 10 seeds). **P:** a base of
   0.6, moved by the tie to and opinion of the teller and by fit, as in the experiment; fitted in the wrap-up.

### VB-136: herding, as built (raised 12 November 2026)
Herding is merged (children do 69% of it; the numbers are in `backlog/VB-136.md`). Three things it showed that are yours to judge; none blocks a task.
1. A household without a child of 8 seldom herds: founders herd 0 to 22 of 54 grazing days (the mistress and the maid have herding priority 0, the
   farmer 2 and he is at the wood, the hay or the fishing), so their cows give about half their milk (7.3 rations a cow a year against 13.5).
   Nobody went hungrier for it in the runs (founders small, seeds 7 and 42: hungry household-days 4 to 0 and 0 to 0). **P:** leave it for now, as
   the real cost of a household without children; if it should not be, the lever is a village herd (one herder for the village's cattle, a
   routine of VB-257's kind, which is how it was done), not the women's priority.
2. Cattle never got into a crop in any run: fences are mended at 0.65 and break in at 0.45, so the rule is exercised only by `tests/herding.js`,
   and VB-257's "an unmended fence lets the cattle in" has shown no consequence yet (two failed meetings in 30 years at seed 11, no crop lost).
   **P:** leave the numbers; the consequence comes when a village's routines can leave the fence out (VB-058, VB-100 and VB-120 add routines
   that compete for the four places).
3. With herding, gifts and close friendships fall in the heirs run of `tests/record.js` (seed 7, 3 years: gifts 21 to 7, close friends 7 to 4;
   births, deaths and marriages the same): the herders are away from the houses by day. **P:** accept it for now and let the talk plan
   (VB-186) say whether herders meet each other on the pasture, which would give some of it back.

### VB-300: dried fish and the boat, as built (raised 12 November 2026)
Dried fish and the fishing boat are merged (`backlog/VB-300.md` has the numbers and the builder's decisions). Two things for you; none blocks a task.
1. Every eligible shore household builds a boat (about 64 and 71 households at populous small, seeds 7 and 42, in 15 years), and a boat doubles
   the catch, so those households fish less and summer idle rises (28.1 to 32.7% and 32.7 to 36.9%) where the task hoped the craft would fill
   slack hours. Hunger barely moves (shore villages 19 to 18 hungry household-days at seed 7; 0 to 2 at seed 42). **P:** make the boat rarer
   and dearer rather than change the catch: it is a holder's project chosen by its values (VB-255), needs tar to keep (VB-301), and until
   then only a household with a surplus and two free hands builds one; and let the extra catch go to the rack for the fair (VB-255's target
   in rations), which is where the hours should go.
2. After the first year most dried fish is eaten from the larder before it would spoil, not through the pot; in winter the cook takes it
   for a quarter of the meals, a fixed share. **P:** VB-119 (mixed meals, now ready to be applied on dried fish) replaces the fixed quarter:
   dried fish is a `fish` source of the pot after fresh batches and before grain.

### VB-333: the longer harvest loses crops to frost (raised 12 November 2026)
Reaping is 15 hours a field and threshing 20, as you decided, and it is merged: reaping and threshing are each about 4.5% of the hands' year
(1.8% before), and hunger and deaths are no worse. One thing moved the wrong way.
1. Crops lost to frost about double at populous small over 15 years (field-years: seed 7, 60 to 113; seed 42, 46 to 72; founders 3 to 2 and
   0 to 3), nearly all in households with 4 to 6 fields and few hands. The task's lever, the reaping's urgency against the frost
   (`reapFrostPerDay` 5 to 2), made it no better (135 and 73) and was reverted: the limit is hands, not urgency. **P:** keep the hours and
   treat the loss as the signal the design wants: a household sows what it can reap. Two things then follow in tasks that exist: the fields a
   household wants (`fieldsWanted`) counts its hands at the harvest (a line in VB-254, the head's foresight), and neighbours help at the
   reaping (VB-106) and hired hands at the peaks (VB-319) take the rest. If the loss should fall sooner, reaping could start a few days before
   the crop is fully ripe at a small cost in yield.

### VB-335: what a load of hay is (raised 12 November 2026)
Sheaves now come home by the load, 30 rations on the back and 90 on a cart with two oxen (`TRAVEL.load`, `TRAVEL.cart`). Hay is the same
question and is not changed: `KINDS.hay` still brings a meadow's 30 units (`HAY` in `src/sim/meadows.js`) home in one job of 4 hours and one
carry. A unit of hay is a cow's stall day (`HERD.hay`: cow 1, calf 0.4, ewe 0.2), so 30 units is 30 cow-days, a bulky load for one back.
1. What is a load of hay? **P:** by weight rather than by ration: a load is a third of a meadow, 10 units on the back and 60 on a cart (two
   oxen draw twice what a sheaf cart takes, for hay is light), so a meadow of 30 is three trips on the back or one cart; the job keeps its
   hours a load (4 hours for the whole meadow becomes 1.5 a load), and the household's hands come in as they do at the sheaves. The cost is
   the same walks as VB-335's (rule 9).

## Priority 3

### VB-158 and VB-033: stakes and empty farms, as built (raised 2 November 2026)
Measured over 20–30 years on the small map (populous seeds 7 and 42, founders at six seeds, heirs at seeds 7 and 42); the numbers are in `backlog/VB-158.md` and `backlog/VB-033.md`.
1. Contests never happen. A stake may be contested only after about 18 months unworked (below `CLAIMS.contestBelow` = 0.5), but projects are finished within days: 421 projects, no contest and no lapse. **P:** keep as built; the rule comes into play once projects can stall (a household losing its hands, winter work, larger projects), and then the custom decides as designed.
2. Empty farms go to singles. Under "with the land" a couple needs a place to marry, so landless couples are rare and nearly every claimant moves in alone (populous seed 7: 8 farms restored, all by one person; most marry there within a few years). Restored households are hungry on more days than others (populous seed 7: 7.8% of household-days against 1.0%; heirs 42: 11% against 5%). **P:** keep; a lone claimant takes a servant at the next moving round like any lone holder (VB-152), and courting (VB-036) is where spouses come from.
3. Short provisions. A claimant's start is made up from the old households' grain "as far as they can", so one moved in with 23 grain for 4 fields. **P:** keep, as settlers' families give; or, if you want a floor, a claimant whose provisions fall short of seed for one field and 30 days of food waits a year to move in, as settlers do.

### VB-121: winter crafts (job review, second pass)
1. Tools. **P:** each household's tools from 0 to 1; 0.01 lost per 10 hours of field work; field work at (0.7 + 0.3 × tools) of the rate; a 4-hour craft job restores 0.1, posted in winter below 1 and in autumn below 0.6.
   **A (Kim, 11 Nov):** P, with iron: without iron tools mend only to 0.5, with it to 1 (slice 6's plan, VB-185).
2. Fence poles. **P:** a 4-hour trip in winter brings 4 poles and fells a tree; mending a stretch uses one; posted while a household has under 8.
3. Who. **P:** a new type of work, crafts: farmer 6, farmhand 7, son 7, retired 5, wife 2, maid 1, daughter 1, child 0.

### VB-115: building bridges (raised with VB-112)
Rivers are crossed only at fords (VB-112); bridges need construction (Kim, 30 Oct).
1. Where and when does a village build a bridge? **P:** at the yearly meeting, a village whose members walked more than 200 extra steps in the past year because of a river (route cost with a bridge at the best site less the cost over the nearest ford, summed over trips) builds one bridge at that site, at most one at a time.
2. What does it cost? **P:** 6 loads of timber felled from the commons wood (one felling trip each, as for firewood) and 40 hours of village work, at the priority of the green and well (VB-058); a bridge over a river (not a brook or stream) costs twice that.
3. Does a bridge decay? **P:** yes, like fences: its condition falls about 5% a year and a mend job restores it; below 20% it is impassable.

### VB-095: family tree by scope (planning)
1. What does the tree open on? **P:** the selected pawn's village: its living members, 2 generations up and 1 down from them, the rest folded behind "+ n more" nodes; a control switches to household, village, culture and the selected pawn's line.

### VB-180: the next ownership boundaries (raised 12 November 2026)
The wrap-up of the ownership arch reran the map (`docs/architecture/ownership.md`, sections 10 and 11): 76 fields have an owner; 38 fields are still written by two or more modules (189 sites); the ownership baseline holds 7 sites (`pawn.role`, written by `sim/heirs.refreshRoles`). Slice 5 will give `pawn.owed` an owner (VB-310) and `st.owner` a companion (VB-311).
1. The baseline's last 7 sites. **P:** a small task moves `refreshRoles` into `sim/records`, as the cache's rebuild, so the baseline is empty and stays a ratchet at zero.
2. Which of the remaining boundaries to take, and when. **P:** none as a task of its own until a slice needs it, with two exceptions. First, the land fields (7.8: `w.dev`, `w.stones`, `st.used`, `w.trees`, `st.regrow`; 18 write sites outside layout and scenarios) and the farm occupancy fields (7.7) wait for VB-311, which decides land's owners, and are done with it or just after. Second, hay, larder and manure (7.6) go to `sim/stores` with the first slice-7 or later task that touches the byre's feeding (VB-136, herding and grazing, is the next); `herd.head`, `herd.cull` and the job store (7.9) wait until a task touches them.
3. The groups the rerun found that the map did not list: the pawn's vital fields (`pawn.alive`, `pawn.age`: `sim/society`, `sim/lifecycle`, `sim/births`) and projects and plots (`village.plots`: 18 sites in 5 modules; `farmstead.project`, `farmstead.meadows`). **P:** the vital fields are one small task (`sim/records` writes them, called by lifecycle and births: S); plots and projects wait for slice 5's land work (VB-311) and the expansion's next change, since `sim/expansion` is their main writer.
4. The stress tests as tests. **P:** do not write them as code now; section 11 of `ownership.md` is the review. Each slice's wrap-up adds the lines of section 11 it moves (for example slice 5's wrap-up, VB-035: rent, tenancy and obligations, tests 4 and 5A and 5B) and, where a stress test can run on the simulation, one integration test then.

### VB-055: the move to TypeScript (raised 12 November 2026)
The survey and the fourteen tasks are in `backlog/VB-055.md` and `docs/typescript-plan.md`. Behaviour, `tests/golden.json` and `tests/counters.json` do not move in any of them.
1. The formatter. **P:** Prettier at an exact version, print width 120, single quotes; one sweep in P8 over `src/` (modules and the page script), then `tests/` and `tools/`, each in a commit of its own listed in `.git-blame-ignore-revs`, with `prettier --check` in `npm test`. Measured: `src/sim`, `src/gen` and the root modules go from 11,917 lines to 19,722; 26 functions pass 60 lines, against 11 now.
2. The bundler. **P:** esbuild, one dev dependency at an exact version, in place of `build.py` (P2); `index.html` stays one self-contained file. It also strips types for the page, so nothing else is built: Node runs the `.ts` of the modules, tests and tools as they are (Node 22.23 does, with explicit `.ts` extensions in imports and erasable syntax only).
3. The hook for timing and replacing functions (ten files, P3). **P:** the build's own instrumenting (an esbuild plugin that wraps named exports in a bundle made for the tool), because `tools/perf.js` adds nothing to `src/` and production pays nothing; the fallback is a `probe(key, name, fn)` registry in the source, an identity unless a hook is installed.
4. The width measures at the start. **P:** the baseline holds today's offenders at today's numbers (18 modules over 15 exports; 26 functions over 60 formatted lines) and only falls; the `src/sim.js` facade (106 exports, which only gathers the others) is in the baseline too, not exempt, so that no one is told it is allowed to grow. The other choice: exempt it as an aggregator.
5. When. **P:** P1 to P3 and P7 now, beside anything; P4 to P6 (every module is rewritten) in one window at a slice boundary, with no other task that edits `src/` open or merged between them, and P8 (the formatter and the rename) in a second window right after; P9 to P14 beside other work. The slice boundary: after slice 3's wrap-up (VB-108) if it comes soon, or at any night when the orchestrator holds the other tasks back (about three agent sessions for the first window, one for the second). A window costs the tasks held back about a day each.
6. The page script and the tests. **P:** the page script (`src/page/*.js`, one closure of 623 top-level names) stays a script and is formatted but not typed; the tests and tools stay `.js` and keep reaching modules through `VB` from `src/load.js`; the follow-up (the page as modules, the tests as `.ts`) is a note at the end of P14, not part of this plan.
7. `strict`. **P:** not switched on for the project; a second `tsconfig.strict.json` with a ratchet of errors by file (P12) falls to zero over P13 and P14, and only then `strict` goes into the main config. Types are written for the state first (P10) and for commands and holders (P11), which are what the code review found.
