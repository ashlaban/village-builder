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
