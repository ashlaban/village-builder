# Open questions for Kim

Questions that block backlog tasks or shape the design, gathered in one place, in priority order. Each has a proposed answer (**P:**). Answer inline (for example "yes", "P", or your own answer); the task files are then updated and set to `ready`. Answered questions move, unchanged, to `QUESTION_ARCHIVE.md`.

The questions marked "review" come from the review of 30 October 2026; the reasons and numbers behind them are in `REVIEW.md` and in `design.md`, "Systems overview". Those marked "planning" come from a pass over `design.md` for points with no task (30 October 2026); each names its task, whose file holds the draft criteria.

## Priority 1

### VB-033: claiming an empty farm (raised by the nightly run of 30 October)
The criteria from VB-030 leave four gaps the nightly run could not fill. VB-031 (clearing a plot) no longer waits for this task, but growth needs both: empty farms are the cheapest new places.
1. What does the claimants' new household start with? **P:** as a new plot's household (VB-032): the claimants' inheritance shares (`stake`) as grain; if that is less than seed for the farm's fields plus 60 days of food for them, their old households give the difference from grain above their own buffer and seed reserve, as far as they can; firewood and rations as a founders household (`ECON.startWood`, 2 days of rations under VB-022).
2. May a ruin (below 15%) be claimed before the full rebuild (VB-032) exists? **P:** no: ruins are left out of claims until VB-032 is done; derelict farms (15% and up) can be claimed now.
3. Who works on the restoration, and where do the claimants live meanwhile? **P:** they live and eat in their old household until they move in. The claimants take the restoration at priority 9, and the members of their old households may help at 5, as for a cleared plot (VB-031).
4. Under "the meeting assigns", until support through ties is built: oldest claimant first, or youngest? **P:** oldest first, as elders carry more voice at the meeting.

## Priority 2

### Moving to new land: the tuned values (VB-150, expansion review of 1 November)
Built in VB-146 to VB-149 with the starting values below (`SETTLE` and `SOIL.fresh` in `src/sim/rules.js`); the measurements are in `docs/review-expansion.md`, Results. In populous small at seed 7 over 40 years, adults waiting with no room fall from 32 to 4, deaths by starvation in years 31–40 from 46 to 0, and the population at year 40 rises from 662 to 780.
1. Provisions. 36 days of the party's rations last from the moving round (autumn day 10) to the first threshing with no margin; a settler alone starts spring with about 21 days of food. Fresh land then feeds them well. **P:** 42 days (a week's margin), so a late sowing does not mean hunger.
2. Who leaves and when. 0.3, 0.6 and 0.8 by moving rounds waited in a crowded village; ages 18–45; a sibling follows with 0.5, at most 2. **P:** keep; the queue of waiting adults stays at 2–8 in 40 years.
3. Join or found. Settlers mostly join small villages (seed 7, 40 years: 25 farms joined, 8 villages founded), so hamlets of up to 4 farms grow around the generated lone farms and the first daughter villages. **P:** keep; the green and well (VB-058) make such hamlets villages.
4. Fresh land. Soil 1.4 on ground never farmed. Households of 1 and 2 (mostly settlers) are hungry in 19% and 10% of years, against 36% and 24% without it. **P:** keep 1.4.
5. Lone settlers. Many settlers leave alone and stay alone for years (seed 42, after 10 years: 4 of 16 settlers ever married): courting does not cross villages yet (no two pawns of different villages meet, VB-126), and the yearly match favours a spouse of the same village. **P:** nothing now; occasions (VB-126) and courting (VB-036) should bring brides from the mother village.
6. The founders do not grow, with or without the new rule: their village never fills, and at seeds 7 and 42 they die out by year 80–100. **P:** a question for VB-035, outside this review.

### Balance review: the tuned values (raised 1 November 2026)
The balance review (`docs/review-balance.md`) built milk, manure and oxen and tuned the food balance; the values below are in the code as Proposed. Numbers are from `tools/balance.js` over 4 seeds.
1. Fields by labour (your rule: no fixed cap). **P:** a household wants fields for 1.1 times its rations at three quarters of the full yield, but no more than 2 a working adult (14 to 59, not retired) and 1.5 more with a team of oxen (`FIELDS` in `src/sim/rules.js`); every scenario makes fields and meadows; heath, hills or marsh only when no meadow is free.
2. Grain spoils in store. **P:** 5% a year of the first year's need held, 20% of the second, 40% of the rest; the village store 20% a year (`ECON.storeLoss`, `ECON.villageStoreLoss`).
3. Haymaking to need. **P:** rake and mow only while the barn and the hay lying mown hold less than 2 winters' need of the animals now; none without animals.
4. Manure. Built: the heap loses half a year and carting goes before the hoe (urgency 1.7). With +0.04 a load, 1.5 head of cattle keep 3 fields at full strength and more cattle add nothing to the corn; +0.02 (about 3 head) makes herd size show in the harvest, as dung was scarce in history, but cost about a quarter more hungry days over 8 seeds. **P:** keep +0.04 now; revisit with herding (VB-136) and food from the wild (VB-117, VB-118), when farms have more slack.
5. Remarriage. **P:** a widowed partner's age gap counts half (`MARRIAGE.widowedGapWeight` 0.15).
6. Meat. History puts a small medieval cow's meat at about 9 rations; the game has 15. With milk in, a cow alive gives 15 to 32 rations a year (milk, a calf, and dung while the fields need it), so the carcass is worth about a year of her life either way. **P:** keep 15 (it stands in for the offal, blood, tallow and hide the game does not count).
7. Ewes' milk and wool. Walter of Henley (13th century) counts 20 ewes on salt-marsh pasture as giving the cheese and butter of 2 cows, and the *Hosebondrie* milks ewes only until August. **P:** a later task (VB-144): ewes in milk from turn-out to summer's end at 0.05 rations a day, wool with the winter crafts (VB-121).
8. Yields rising over a game (VB-048). **P:** the soil's cap rises with a village's years of farming, from 1.15 by 0.1 a century, so well-dunged old farms out-yield new ones by about 10% after 100 years.


### Towns: the bases of city formation (cities review of 1 November)
The review (`docs/review-cities.md`) names eight bases of a town; the game has the landless (1), a surplus (2) and the sites (5), and lacks a way to move the surplus (3), work only a town does (4), rules (6), a patron (7) and a town's way of life (8). It proposes a new arch `towns` in five phases. No tasks yet: the answers let its plan task be written. Questions 5 and 6 are about the game as it is and concern the expansion wrap-up (VB-035).
1. How does a town come about? **P:** both ways, as in Sweden: a yearly fair at the site of highest market potential grows into a market place (*köping*) once 3 households there live by trade or craft; the Crown charters a market place of 5 such households as a town (*stad*), and without the Crown a market place of 10 with a church counts as one.
2. What comes first? **P:** the fair (Phase 1): once a year after threshing (autumn days 6–8), one adult from each household within a day's walk or a boat crossing brings what it can spare above its seed and buffer, or buys what it lacks; it is also an occasion (VB-126) for people of different villages. In every run the households above their need make more than those below it lack, in the same years (section 3.2). A household sells only grain above its seed and two years of its need: in the review's toy town, a town fed from grain above one year's need left the countryside a fifth the size after 100 years (290 people against 1,402 over four seeds), and one fed from what would rot left its hunger unchanged.
3. Money. **P:** none at first: everything valued in rations at fixed rates, paid in grain, animals, labour days or on credit; prices that move, and a silver unit of account, come with goods from outside (Phase 3).
4. The elite. **P:** grain loans repaid with a quarter more at the next harvest; unpaid after two harvests, paid in labour days, or with a field under a new custom "Debts are paid with" (labour; land; labour, then land; default labour); land beyond a household's hands let to landless tenants (*landbor*) for a quarter of the harvest; a master household (rents and stores at least 1.5 times its need for 3 years) ranks field work 2 of 10; prestige gains a term for wealth and for feasts given. Wealth now is flat (Gini about 0.3) but sticky (rank correlation 0.9 after 10 years), so it needs mechanisms to grow, not to persist.
5. Two holders who wish to marry. Under "with the land" a couple needs exactly one place: two people who each hold a farm, or are first heir to one, cannot marry each other (`homeFor` in `src/sim/lifecycle.js`). Settlers who found farms alone become such holders. **P:** they may: the couple lives on the farm with more fields, and the other passes to its next heir, or to tenants once tenancy exists; heir–heiress marriages were the old way farms were joined.
6. Households of one. A quarter of all household-years on the tiny map are one person, mostly settlers and widowed holders; they are hungry in half their years although they make 1.5 times their need and hold nearly 3 years of it, because one person cannot farm and keep house at once. **P:** a lone waiter leaves only with a companion (a sibling, or a landless adult of the village as servant), and a lone holder takes a servant at the moving round when one is free.
7. The urban penalty. **P:** the death hazard times 1.8 in towns (Stockholm had 52 deaths per 1,000 a year in the 1750s). The review's arithmetic shows a town of historical size (5% of the people) absorbs only a small share of the countryside's surplus of births; the main brake must stay late marriage and celibacy, which the game barely has (0–5% of women 45–54 never married, against 10–20% in the European marriage pattern).
8. The outside world. **P:** ships, the Church and the Crown as actors with fixed rules: ships call in summer at the best shore site with prices set per decade; the Church comes at about 300 people, takes a tenth of the grain and builds a church; the Crown taxes each farm, charters towns and frees masters who serve it from tax (*frälse*).
9. Scenarios. **P:** first "No land left" (a full island, buildable now: it shows the ceiling and the two problems above), then "The fair meadow" with Phase 1; the other five (`docs/review-cities.md`, section 6) as their phases are built.

### VB-023: sowing a hoed field before the next (raised by the nightly run of 30 October; gathered in the review of 31 October)
The rule is built (no `plow` job while another field is hoed and its seed is in the house), but it does not bring in a crop in year 2 at seeds 7 and 11: a lone bachelor sows his first field only on spring day 4–7, after water, wood and cooking, so the stooks are lost to frost on summer day 11, and crops in year 3 fall from 3 to 0–1.
1. What should give? **P:** lower the assertion, since the lone bachelor of the founders scenario is a harsh case: at least 1 crop in years 1–3 taken together at each of seeds 3, 7, 11 and 42 (the run reports them per year); and sow before wood and water for any household with a hoed field and seed in the house (a one-line priority change in `ROLES`), as it is the one chore with a closing date.

### VB-129: the moving round in slices (raised by VB-145, balance review of 31 October)
VB-145 cached the heir rankings that made the round cost 1.3 s; it now takes about 20 ms in one step on populous medium at seed 7.
1. Is VB-129 still wanted? **P:** close it as met by VB-145; if saves (VB-074) ever need to stop inside the round, that task can slice it.

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

### VB-127: familiarity from talk and time at home (relationships review)
Kim kept the tie model unchanged in VB-061; this is the later rework.
1. Replace counting hours near each other with talk, waking hours at home and work together? **P:** yes: +0.5 per talk, +1 per 24 waking hours under one roof, +0.5 per job worked together; the kin floor stays at 0.4.
2. Cap ties at the 150 strongest per pawn, kin always kept? **P:** yes.

## Priority 3

### VB-130: what grain does once a household is fed (raised in the review of 31 October)
Founders at seed 7 hold 300 grain per household in year 2 and 1,700 in year 38, with 12–14 people: a surplus has no use and no loss.
1. What is the first outlet? **P:** storage loss, which is the cheapest and historically true (damp, mice, weevils): each year 8% of the grain above a year's food for the household is lost at the autumn count (so a household keeps a buffer but a hoard shrinks), shown in the household panel as "spoilt"; a tithe and trade stay for later (Open, "Outlets for grain").
   - Balance review, 1 November: built as a daily loss by tiers instead (question 2 under "Balance review: the tuned values"): 8% above a year's need left founders' stores near 600 and rising; with 5%, 20% and 40% by years of need held they level off near 350–400. If accepted, VB-130 is done.

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
