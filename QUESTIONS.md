# Open questions for Kim

Questions that block backlog tasks, gathered in one place, in priority order. Each has a proposed answer (**P:**). Answer inline (for example "yes", "P", or your own answer); the task files are then updated and set to `ready`. Prepared 30 October 2026.

## Priority 1: expansion and the food floor

### VB-003: every farm in a village (unblocks VB-003, VB-004, VB-010, VB-031, VB-033)
1. What is a lone farm's village called, in the customs panel, the settlers list and its meeting log? **P:** the farm's own name ("Strand"), so one place has one name.
2. What does the map label show for a one-farm village? **P:** the farm name only, as today; the green, well and village label appear once the village has a second farm.

### VB-030: inheritance and expansion (unblocks VB-031 to VB-034)
1. Clearing a plot: the design's trigger (someone waiting, nothing claimable, a free site, one project per village) and site rule (within 4 steps of the green, own or neighbouring region, not the last commons wood). Keep both? **P:** yes.
2. How big is a new plot at first? **P:** a house and 2 fields; the household makes more fields later itself (VB-010's rule, up to 4).
3. Job hours. The design's numbers (break 6–8 h, fell 10 h, grub 6 h, cottage 40 h) predate the long-work notes, which made tilling 20 h and breaking ground 30 h. **P:** fields as VB-010 (clear 10 h + up to 20 h for stones, break 30 h); fell 10 h and grub 6 h per forest tile; the cottage 120 h in three steps (foundation 30, walls 60, roof 30), so a plot takes most of a year for two or three people.
4. Who works on a plot, by role priority (0–10)? **P:** those waiting for it 9; farmhand and maid 7; son and daughter 5; farmer 3; others 0.
5. Under "the village allots it", who gets the plot? **P:** as the design says: married couples first, then by age. Can a single adult get one? **P:** yes, after every couple.
6. Inheritance shares (`stake`, today unused) become the new household's starting grain. Who pays the shares still `owed`, and when? **P:** the farm they came from, at each moving round, from grain above its reserve.
7. Claims on empty farms: restoration hours by condition. **P:** roof repair 20 h above 40%, 60 h from 15% to 40%, a full rebuild (as a new cottage, 120 h) below 15%; fields gone to grass are cleared like a meadow (10 h), scrub 20 h.
8. Under `claims: assembly` ("the meeting assigns"), how does the meeting choose? **P:** the claimant with the most voice-weighted support among those with a voice, using the existing ties; by age until that is built.
9. Splitting land (VB-034): does a sibling who gets fields also need a new house before they can farm them? **P:** yes, a building site next to the fields (VB-032); until it is built, the old household works the fields and gives the sibling half the harvest.

### VB-050: health (numbers to confirm)
1. Health 0–100, drained daily by 9 × h² (h = hunger 0–1), ×1.5 for under 5 and 60 and over; a fully fed day restores 3. At h = 1 a healthy adult dies on day 12, a small child on day 8. **P:** yes.
2. Below 50, health raises the death risk (×3 at 0), and the agreed hunger multiplier stays. **P:** yes.
3. Should low health also slow work or make illness likelier? **P:** not yet; hunger already slows work by up to 40%.

## Priority 2

### VB-022: daily meals (unblocks VB-009, milling)
There is no milling job today: VB-009 was built, failed its test (hungry days rose because the daily cook job is missed on busy days) and was reverted. The `cook` job exists, but it only marks the day as cooked; nothing depends on it.
1. Which fix makes meals reliable? (a) households start with a few days of rations; (b) cooking gets a higher priority, or may interrupt other work after 14:00; (c) the cook makes the next day's food. **P:** (a) and (c): start with 2 days of rations, and cook for the next day, so one missed cook uses the buffer rather than causing a hungry day.

### VB-023: the one-person household in the heirs scenario
1. Olof, alone at B3, cannot till 3 fields in the sowing window, so he brings in no crop. With health (VB-050) he would now starve. Options: widen the sowing window, give one-person farms fewer fields, give B3 a farmhand, or accept it. **P:** give B3 a farmhand in the scenario: a bachelor farmer of 47 would have kept a servant.

### VB-024: wood supply
1. A commons wood tile is felled to meadow in about 1.5 years. The task only reports numbers first. **P:** set it `ready` as a report-only task.

### VB-025: browser smoke test (also unblocks VB-053)
1. May the project add `playwright` and `pixi.js` (served locally instead of the CDN) as dev dependencies? Chromium is already installed in the cloud sessions. **P:** yes; run it in `npm run verify` only.

### VB-026: farm names in big villages (new farmsteads need names too)
1. Farms beyond the direction names: numbers (today), names of owners or families, or landmarks. **P:** landmarks from the surroundings, as lone farms already get (Backa, Strand, Lunden, Myra, Ängen), then Nygården for a newly built farm, and numbers only as a last resort.

### VB-036: relationships and courting
1. When do pawns court? **P:** unmarried adults (men 20+, women 18+) with a strong tie (time together at work, the well and the green) may start courting at any time of year; courting lasts a season or more and can end.
2. Is a courting couple's marriage still gated by a place to live and the marriage limit? **P:** yes, both; courting couples wait for a place (claims, new plots, inheritance).
3. Births outside marriage: how often? **P:** a small chance per day while courting, about 5% of births at the start; the couple marries within the year in most cases (about 3 in 4) if they can.
4. Who believes who is the father? **P:** the true father is recorded; when the mother is courting more than one man, or married to another, the believed father is her husband, or the man she is seen with most.
5. Does hunger stop courting, or only marriage? **P:** only marriage, as today (hunger ≥ 0.5).

### VB-039: food help from kin and the village
1. Each adult wants a buffer of 20–60 days of food before giving. **P:** yes, drawn per pawn; the holder's counts for the household.
2. How is the village store filled? (a) a share of each harvest given to the village, (b) gifts from households above their buffer at the moving round, (c) only common fields, once they exist. **P:** (b) for now.
3. Is help a gift or a loan? **P:** a gift that raises the tie between the households (and so their influence on each other's customs); loans come with money and markets.

### VB-041: claims, ownership and territory
1. Who may hold a claim: households and villages only, or pawns too (a pawn who wants to turn a commons tile into a field)? **P:** all three, as the design says.
2. Do unrealised claims expire? **P:** yes, after 3 years without work on the tile.
3. Two claims on one tile: who decides? **P:** the village meeting, by voice-weighted support; until then, the first claim wins.
4. First version of the filters: which levels? **P:** household and village, with the selected entity highlighted; culture later.
5. Adopt the proposed scope model (a level, the chosen entities and a dimension, over one membership graph) as the plan? **P:** yes.

## Priority 3

### VB-047: animals and husbandry
1. The first wild grazer: roe deer, with elk later? **P:** roe deer.
2. The founders' livestock: **P:** per household 2 cows, a pair of oxen and 6 ewes, with hay for the first winter, as the design proposes.
3. Food from animals, in rations: **P:** a cow in milk gives 0.5 rations a day in summer, part of it kept as butter for winter; a slaughtered cow 40 rations, a sheep 8.
4. The byre: **P:** room for 6 cattle at first, enlarged later by a building job.
5. The order of the implement tasks, listed in VB-047. **P:** as listed.

### VB-055: type checking
1. May the project add `typescript` (about 25 MB, dev only) to check the plain JavaScript with JSDoc types? **P:** yes, in `npm test`.
