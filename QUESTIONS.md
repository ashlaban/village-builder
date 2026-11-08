# Open questions for Kim

Questions that block backlog tasks or shape the design, gathered in one place, in priority order. Each has a proposed answer (**P:**). Answer inline (for example "yes", "P", or your own answer); the task files are then updated and set to `ready`. Answered questions move, unchanged, to `QUESTION_ARCHIVE.md`.

The questions marked "review" come from the review of 30 October 2026; the reasons and numbers behind them are in `REVIEW.md` and in `design.md`, "Systems overview". Those marked "planning" come from a pass over `design.md` for points with no task (30 October 2026); each names its task, whose file holds the draft criteria.

## Priority 1

Since 3 November the backlog is organised as vertical slices (`docs/roadmap.md`). Questions on tasks of slices 3 to 10 (marked by their task numbers below) wait for that slice's plan, which may reframe them; they need no answer now.

### Architecture review: the vision and the first steps (raised 3 November 2026)
From the architecture review (`docs/review-architecture.md`; ChatGPT's three documents are in `docs/architecture/`). Kim adopted the review's vision on 3 November: the player inhabits a pawn and lives a life the game does not prescribe, in a society that grows to towns, institutions and a wider world. Questions 1 to 5 settle the text for `design.md` (the review, section 3) and VB-079; questions 6 and 7 concern the new `ownership` arch (VB-172, VB-173). Questions 1 to 4 were answered on 3 November (`QUESTION_ARCHIVE.md`): the vision's text approved as written. Questions 1 to 5 and 7 were answered on 3 November (`QUESTION_ARCHIVE.md`).
6. Reads and writes. The review asks that no module expose its collections (Rule 2). **P:** reads stay free, since `st` is plain data for saves and the page reads it every frame; every field has one owner module, which alone writes it, and other modules call its operations; a static check enforces it (VB-173). The rule goes into `AGENTS.md` with VB-173.

### VB-199: bounded history (raised 3 November 2026, the plan of slice 0)
Bounded history was brought into slice 0 in the session that ran VB-181. Rule 9 of the Rules for cost (Decided) says the record keeps notable events in full and folds routine ones into yearly counts after a generation, and that a pawn's events are an index into the record. Measured at year 40 of populous small (seed 7): 110,278 events in `st.record`, of which `friend` 52,201 and `fellOut` 36,598 (81%); each pawn carries copies of its own events (80.6 on average, 8.1 MB of a 29 MB save); writing the save takes 1.6 s and reading it 0.9 s, against a budget of 0.5 s each. The answers make VB-199 `ready`.
1. Which kinds of event are notable, kept in full? **P:** those that make up a life and a place, which are also VB-098's list: births, marriages, deaths (with their cause), inheritances and handovers, moves and leaving, farms, plots, cottages and meadows made, claimed or left, customs changed and causes argued at the meeting, and inheritance shares paid. The rest are routine and folded: `friend`, `fellOut`, `gift`, `harvest`, `hay`, `frost`, `herdBirths`, `herdDeath`, `slaughter`, `spoiled` and `putOff`.
2. When do `friend` and `fellOut` fold? Folded after a generation (25 years), they still fill the save at the late reference: year 60 would keep 35 years of them. **P:** after 2 years, since a pawn's present friends and enemies are kept in its relations anyway, and slice 7 replaces them with stories; the other routine kinds after a generation, as rule 9 says.
3. If the save still takes over 0.5 s once history is bounded? **P:** VB-199 measures each part (encode, stringify, gzip; parse, decode) and proposes the next step in its PR rather than building it: pawn records in columns, or saving from a structured clone in a worker (roadmap, section 5.5).

### VB-164: may slice 3's plan run before slice 2's? (raised 7 November 2026, backlog review)
The rule of 3 November says a later slice's plan waits for the plan of the slice before it (now in `BACKLOG.md`, "How this backlog works"; slices 1 and 2 run side by side). VB-164, slice 3's plan, is `ready` at priority 2, so the nightly run takes it after VB-077, VB-127 and VB-163, while slice 2's plan (VB-079) is not done; its file names no exception, as VB-127's does for running ahead of its slice.
1. Should VB-164 wait for VB-079? **P:** yes, as the rule says: set it `blocked` with `Waits for: VB-079`, so the plans run in slice order (roadmap, section 4: "0, then 1 and 2 side by side, then 3"), since slices 1 and 2 "test the pieces every later slice uses", among them "opportunities and the player". If running it early was meant, say so and its file gets a note giving the reason.
   *8 Nov 2026:* VB-079 is done (slice 2's plan), so the plans now run in slice order whatever the answer; "P" closes this.

## Priority 2

### Target architecture v2: decisions waiting (raised 3 November 2026)
From `docs/architecture/target-v2.md`, section 10.1. None blocks slice 0, 1 or 2; each is needed by the slice named. Question 3 was answered on 3 November (`QUESTION_ARCHIVE.md`).
1. Bodies: one membership graph with rules per kind (Proposed; it passed the succession probe), or a domain per kind? Kim asked to iterate first. **P:** settle it by measurement in slice 5's plan: build the household cache from the graph at populous medium, and adopt the graph if the build and the updates stay under 50 ms (VB-043's bound).
2. The 600 / 325 / 75 target (target-v2, section 6.3). **P:** a band for a developed island at the end game, not a quota; strata counted by relation to production, not residence, so a rural smith or miller is in the 325. Reported nightly from slice 9.
4. A meeting that fails to decide its yearly routines (no quorum, a tie; needed in slice 3). **P:** a practice says what follows, "nothing" or "as last year", with "nothing" the default, which keeps Kim's decision that routines are decided afresh each year: a failed meeting means no common fence work that year, and the cattle in the crops become a story.
5. Who mints, and when coin is taken (needed in slice 8). **P:** only an established Crown mints, after silver has circulated by weight; whether coin is taken is a norm learned from deals (target-v2, section 5.3); a town mints only by the Crown's grant.

### Review, 2 November: where to spend Kim's answers (raised 2 November 2026; revised in the second pass the same day)
VB-033 was answered with the claims review and is built; the order of work, VB-127 and VB-129 were answered in the second pass (`QUESTION_ARCHIVE.md`). Measured in `REVIEW.md`, review of 2 November, second pass.
1. Who closes finished questions? **P:** this nightly review moves a question only after you answer it inline; "keep" or "P" counts. Say "P to all" on a block to answer it whole.

### VB-162, VB-163 and VB-165: the external review's new tasks (raised 2 November 2026)
From the external review (`docs/review-external.md`). The task files hold the draft criteria; the answers below make them `ready`. VB-162 and VB-165 are page features, so they wait for the feature freeze to lift; VB-163 is tooling and may run during it. Questions 1 and 2 were taken up by slice 0's plan (VB-181, 3 November): the roadmap, whose slices Kim decided, makes the floors of question 1 the first asserted bands, and Kim's decision 9 (target-v2, section 8) replaces question 2 (reduced scenarios asserted in verify, the long runs reported nightly). VB-163 is rewritten and `ready`; answer "P" to move them to the archive, or change a floor.
1. VB-163: what should the long-run test guard? **P:** a floor against collapse, not the design's targets: a scenario's population ends at or above its start; no village of 3 or more households at year 5 is empty at the end; hunger causes at most 2% of deaths after year 3; no household is hungry on more than 30% of its days in a year after year 3. Founders today stand at 25 to 28 in year 38, so a target of about 3% growth a year would fail at once; the targets belong in the wrap-ups (VB-035, VB-048).
2. VB-163: which runs? **P:** populous small at seeds 3, 7, 11, 42 for 30 years; founders small at the same seeds for 50; heirs small at seeds 7 and 42 for 30; under 60 s on its own, seeds in parallel.
3. VB-162: what does the village overview show? **P:** as in the task file: food in store in days of need, this year's harvest against a year's need, people by age band and the change in a year, hungry households in the last 30 days, idle share of adult work hours; four warnings (food short of the next harvest, a household hungry 5 of 30 days, a holder over 60 with no heir at home, a farm short of hands), each naming its households. Social tensions (grudges, disputes) wait for VB-062 and the record of events (VB-075).
4. VB-165: keyboard and lists. **P:** a Lists panel on `L` (villages, households, people as buttons; Enter selects and centres as a click does); `[` `]` step between villages, `,` `.` between households of the selected village, `Escape` clears; the selection is announced in an `aria-live` region. Full screen-reader play of the map is not a goal; reading every panel and selecting every pawn, household and village without a pointer is.

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

### VB-023: sowing a hoed field before the next (raised by the nightly run of 30 October; gathered in the review of 31 October)
The rule is built (no `plow` job while another field is hoed and its seed is in the house), but it does not bring in a crop in year 2 at seeds 7 and 11: a lone bachelor sows his first field only on spring day 4–7, after water, wood and cooking, so the stooks are lost to frost on summer day 11, and crops in year 3 fall from 3 to 0–1.
1. What should give? **P:** lower the assertion, since the lone bachelor of the founders scenario is a harsh case: at least 1 crop in years 1–3 taken together at each of seeds 3, 7, 11 and 42 (the run reports them per year); and sow before wood and water for any household with a hoed field and seed in the house (a one-line priority change in `ROLES`), as it is the one chore with a closing date.

### VB-117 to VB-119: fishing, gathering and mixed meals (job review, second pass)
Decided on 30 Oct: fishing and gathering are always posted, by urgency; mixed meals go further (2 sources 10% less food, 3 or more 20%); fresh food spoils after 3 days; milling (VB-009) is built with them. The numbers below are proposals for the second pull request.
1. Fishing grounds and catch. **P:** a shore tile within 6 steps of the house; a 3-hour trip brings 4 rations × the water tile's stock; a trip lowers a river or small lake tile's stock by 0.1 and it recovers 0.02 a day; the sea and lakes of 20 tiles or more never run down; no fishing in winter.
2. Gathering. **P:** forest and heath tiles within 5 steps, from summer day 6 to the end of autumn; a 3-hour trip brings 2.5 rations × the tile's stock and lowers it by 0.2; stocks refill each spring.
3. Urgency. **P:** 0.2 while grain above the seed reserve covers 24 days or more of the household's need, rising linearly to 2.0 at none; one job of each per household, two when under 12 days.
4. Who. **P:** a new type of work, foraging: farmer 3, wife 4, farmhand 6, maid 5, son 7, daughter 6, retired 3, child 5; fishing 2 for wife, maid and daughter, gathering 3 for son and farmhand.
5. When does a source count in a meal? **P:** when it gives at least a fifth of what is eaten that day; grain and flour are one source.
6. VB-009 was blocked because a missed cooking left people hungry although there was grain. **P:** the meal eats fresh food, then rations, then grain (as today), so milling makes food go further without new hungry days.

### VB-039 and VB-106: help as memories (relationships review)
Opinion is now the sum of timed memories (VB-060, `SOCIAL.memories`): each kind gains a value per event, up to a cap, and fades to 0 over its days. The gains Kim accepted for help become memories; their caps and durations are new.
1. A gift of food (VB-039). **P:** the receiving holder remembers "A gift of food", +0.1 per gift, cap +0.4, fading over 3 years; the giver gains nothing beyond the tie.
2. Help with work (VB-106). **P:** the helper and each adult of the helped household remember "Worked together", +0.05 per job, cap +0.3, fading over a year, both ways (the accepted +0.05 × (1 − opinion) becomes a plain +0.05 under a cap).

### VB-126: occasions (relationships review)
No two pawns of different villages ever meet today, so courting would keep marriages inside the village.
1. Which occasions first? **P:** the village meeting (the people with a voice on the green, 10:00 to the meeting at 12:00), the wedding (the day after, 16:00–21:00 at the couple's farm, near kin of both spouses from any village within a day's walk) and the funeral ale (the day after a death, 16:00–21:00 at the farm of the dead, its household and near kin).
2. Do occasions override work? **P:** the meeting and a funeral ale do (work stops for them); a wedding takes those who are free, as it falls in the evening.

## Priority 3

### VB-057: motivation for panel text snapshots (raised 5 November 2026)
The user questioned whether this task is necessary; it is `needs-review` pending better motivation.
1. What concrete, consequential UI regressions have escaped the existing smoke and browser checks?
2. Would focused assertions cover those failures with less maintenance than whole-panel snapshots?
3. What benefit justifies the baseline updates and review noise from intentional wording and simulation changes?


### VB-160: research the mechanism for long-term yield increase (reopened 5 November 2026)
The user asked to skip implementation: the mechanism for long-term yield increase needs better research.
The previous village-age manure cap (+0.1 per century) is reopened, and the task is `needs-review`.
1. Which historical mechanisms explain sustained yield increases in the game's medieval Nordic setting,
   and what evidence supports their magnitude and timescale (soil management, tools, practice or other changes)?
2. Which mechanisms should the game represent, and should gains follow actual changes in farming rather than village age?
3. After researching these questions, what model, rates and acceptance criteria should replace the current proposal?


### VB-158 and VB-033: stakes and empty farms, as built (raised 2 November 2026)
Measured over 20–30 years on the small map (populous seeds 7 and 42, founders at six seeds, heirs at seeds 7 and 42); the numbers are in `backlog/VB-158.md` and `backlog/VB-033.md`.
1. Contests never happen. A stake may be contested only after about 18 months unworked (below `CLAIMS.contestBelow` = 0.5), but projects are finished within days: 421 projects, no contest and no lapse. **P:** keep as built; the rule comes into play once projects can stall (a household losing its hands, winter work, larger projects), and then the custom decides as designed.
2. Empty farms go to singles. Under "with the land" a couple needs a place to marry, so landless couples are rare and nearly every claimant moves in alone (populous seed 7: 8 farms restored, all by one person; most marry there within a few years). Restored households are hungry on more days than others (populous seed 7: 7.8% of household-days against 1.0%; heirs 42: 11% against 5%). **P:** keep; a lone claimant takes a servant at the next moving round like any lone holder (VB-152), and courting (VB-036) is where spouses come from.
3. Short provisions. A claimant's start is made up from the old households' grain "as far as they can", so one moved in with 23 grain for 4 fields. **P:** keep, as settlers' families give; or, if you want a floor, a claimant whose provisions fall short of seed for one field and 30 days of food waits a year to move in, as settlers do.

### VB-120: village work days (job review, second pass)
1. Which days, and what work? **P:** set at the autumn meeting: spring day 1, the infield fence (stretches below 0.9); summer day 2, clearing scrub at the edge of the commons wood; village jobs with unlimited hands, at priority 8 for every adult.
2. What does staying away cost? **P:** a household with no adult working 2 hours on the day loses 0.1 of its holder's prestige for the year; each adult who works gains 0.05.

### VB-121: winter crafts (job review, second pass)
1. Tools. **P:** each household's tools from 0 to 1; 0.01 lost per 10 hours of field work; field work at (0.7 + 0.3 × tools) of the rate; a 4-hour craft job restores 0.1, posted in winter below 1 and in autumn below 0.6.
2. Fence poles. **P:** a 4-hour trip in winter brings 4 poles and fells a tree; mending a stretch uses one; posted while a household has under 8.
3. Who. **P:** a new type of work, crafts: farmer 6, farmhand 7, son 7, retired 5, wife 2, maid 1, daughter 1, child 0.

### VB-123: job steps (job review, second pass)
1. When? **P:** with the first building task (VB-032), so the steps are shaped by a real use; today's three shapes become step lists with behaviour unchanged.

### VB-115: building bridges (raised with VB-112)
Rivers are crossed only at fords (VB-112); bridges need construction (Kim, 30 Oct).
1. Where and when does a village build a bridge? **P:** at the yearly meeting, a village whose members walked more than 200 extra steps in the past year because of a river (route cost with a bridge at the best site less the cost over the nearest ford, summed over trips) builds one bridge at that site, at most one at a time.
2. What does it cost? **P:** 6 loads of timber felled from the commons wood (one felling trip each, as for firewood) and 40 hours of village work, at the priority of the green and well (VB-058); a bridge over a river (not a brook or stream) costs twice that.
3. Does a bridge decay? **P:** yes, like fences: its condition falls about 5% a year and a mend job restores it; below 20% it is impassable.

### VB-095: family tree by scope (planning)
1. What does the tree open on? **P:** the selected pawn's village: its living members, 2 generations up and 1 down from them, the rest folded behind "+ n more" nodes; a control switches to household, village, culture and the selected pawn's line.

### VB-098: notifications (planning)
1. Which events notify? **P:** a death, birth or marriage in the selected pawn's household or line; the death of a landholder; a farm emptied, claimed or newly built; a change of practice or of the culture's custom; a death from hunger. Each kind can be turned off.
2. How are they shown? **P:** toasts at the bottom left for 6 s, at most 3 at once, merged by kind at high speed ("3 births in Ulsäter"); a click selects and moves the camera.

### VB-099: a chronicle (planning)
1. **P:** a "History" tab in the pawn, household and village panels, read from the record of events (VB-075), newest first, filtered by kind; a farm's history follows the farm across households; the village log becomes a view of the same record.

### VB-100: common fields (planning)
Fields can be private or common (Decided); nothing makes a common field yet.
1. When does a village make a common field? **P:** at the moving round, a village of 3 or more occupied farms whose store holds less than 10 days of food for its members, with a free meadow tile within 3 steps of the green; at most one common field per 3 farms.
2. Who works it, and where does the harvest go? **P:** the village's adults, at the village-duty priorities of the green and well (VB-058); seed from the village store and the harvest into it (VB-039).
