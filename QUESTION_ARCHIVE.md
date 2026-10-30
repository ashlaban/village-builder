# Answered questions

Questions from `QUESTIONS.md` that Kim has answered, kept as the record behind the task files and `design.md`. Each section keeps its questions, the proposed answer (**P:**) and Kim's answer (**A:**) as they stood when answered; the task files hold what was decided. A question moves here, unchanged, once it is answered; newer archives go on top.

# Archived 30 October 2026

## Priority 1: expansion and the food floor

### VB-003: every farm in a village (unblocks VB-003, VB-004, VB-010, VB-031, VB-033)
1. What is a lone farm's village called, in the customs panel, the settlers list and its meeting log? **P:** the farm's own name ("Strand"), so one place has one name.
   **A (Kim, 30 Oct):** a generated village name.
2. What does the map label show for a one-farm village? **P:** the farm name only, as today; the green, well and village label appear once the village has a second farm.
   **A (Kim, 30 Oct):** the farm name only. When a second farmstead appears, the green and well become buildable by the village, not created automatically (new task VB-058). VB-003 and VB-004 are now `ready`.

### VB-030: inheritance and expansion (unblocks VB-031 to VB-034)
1. Clearing a plot: the design's trigger (someone waiting, nothing claimable, a free site, one project per village) and site rule (within 4 steps of the green, own or neighbouring region, not the last commons wood). Keep both? **P:** yes.
   **A (Kim, 30 Oct):** up to two projects per village at once, sites up to 6 steps from the green. Houses may stand next to each other, and a field need not touch its house, though tiles next to the house are preferred when possible.
2. How big is a new plot at first? **P:** a house and 2 fields; the household makes more fields later itself (VB-010's rule, up to 4).
   **A (Kim, 30 Oct):** a house and 1 field.
3. Job hours. The design's numbers (break 6–8 h, fell 10 h, grub 6 h, cottage 40 h) predate the long-work notes, which made tilling 20 h and breaking ground 30 h. **P:** fields as VB-010 (clear 10 h + up to 20 h for stones, break 30 h); fell 10 h and grub 6 h per forest tile; the cottage 120 h in three steps (foundation 30, walls 60, roof 30), so a plot takes most of a year for two or three people.
   **A (Kim, 30 Oct):** accepted.
4. Who works on a plot, by role priority (0–10)? **P:** those waiting for it 9; farmhand and maid 7; son and daughter 5; farmer 3; others 0.
   **A (Kim, 30 Oct):** accepted.
5. Under "the village allots it", who gets the plot? **P:** as the design says: married couples first, then by age. Can a single adult get one? **P:** yes, after every couple.
   **A (Kim, 30 Oct):** accepted.
6. Inheritance shares (`stake`, today unused) become the new household's starting grain. Who pays the shares still `owed`, and when? **P:** the farm they came from, at each moving round, from grain above its reserve.
   **A (Kim, 30 Oct):** accepted.
7. Claims on empty farms: restoration hours by condition. **P:** roof repair 20 h above 40%, 60 h from 15% to 40%, a full rebuild (as a new cottage, 120 h) below 15%; fields gone to grass are cleared like a meadow (10 h), scrub 20 h.
   **A (Kim, 30 Oct):** accepted, but the repair time scales linearly with condition: about 3 h at 90%, and 20 + (60 − 20) / (40 − 15) × 10 = 36 h at 30%. Written as straight lines through 0 h at 100%, 20 h at 40%, 60 h at 15% and 120 h (a full rebuild) at 0%.
8. Under `claims: assembly` ("the meeting assigns"), how does the meeting choose? **P:** the claimant with the most voice-weighted support among those with a voice, using the existing ties; by age until that is built.
   **A (Kim, 30 Oct):** accepted.
9. Splitting land (VB-034): does a sibling who gets fields also need a new house before they can farm them? **P:** yes, a building site next to the fields (VB-032); until it is built, the old household works the fields and gives the sibling half the harvest.
   **A (Kim, 30 Oct):** accepted.

### VB-050: health (numbers to confirm)
1. Health 0–100, drained daily by 9 × h² (h = hunger 0–1), ×1.5 for under 5 and 60 and over; a fully fed day restores 3. At h = 1 a healthy adult dies on day 12, a small child on day 8. **P:** yes.
   **A (Kim, 30 Oct):** accepted.
2. Below 50, health raises the death risk (×3 at 0), and the agreed hunger multiplier stays. **P:** yes.
   **A (Kim, 30 Oct):** accepted.
3. Should low health also slow work or make illness likelier? **P:** not yet; hunger already slows work by up to 40%.
   **A (Kim, 30 Oct):** low health slows work too, by up to 30% at health 0, on top of hunger. VB-050 is now `ready`.

### VB-058: the village green and well, built by the village (new)
1. When may a village start its green and well? **P:** once it has two or more occupied farms and no well.
2. Where does the green go? **P:** a free, passable tile as close as possible to the farms' mean position; it becomes the village centre.
3. Jobs and hours? **P:** clear the green 10 h, dig and line the well 40 h, raise the well sweep 10 h.
4. Who works on it (role priority 0–10)? **P:** farmer 5, farmhand and son 6, wife, maid and daughter 3: a village duty below the farm's own work.
   **A (Kim, 30 Oct):** all four accepted; VB-058 is `ready`.

## Priority 2

### VB-022: daily meals (unblocks VB-009, milling)
There is no milling job today: VB-009 was built, failed its test (hungry days rose because the daily cook job is missed on busy days) and was reverted. The `cook` job exists, but it only marks the day as cooked; nothing depends on it.
1. Which fix makes meals reliable? (a) households start with a few days of rations; (b) cooking gets a higher priority, or may interrupt other work after 14:00; (c) the cook makes the next day's food. **P:** (a) and (c): start with 2 days of rations, and cook for the next day, so one missed cook uses the buffer rather than causing a hungry day.
   **A (Kim, 30 Oct):** all three. VB-022 is `ready`; it adds the rations store, cooked from grain, and VB-009 (milling) is `ready` after it.

### VB-023: the one-person household in the heirs scenario
1. Olof, alone at B3, cannot till 3 fields in the sowing window, so he brings in no crop. With health (VB-050) he would now starve. Options: widen the sowing window, give one-person farms fewer fields, give B3 a farmhand, or accept it. **P:** give B3 a farmhand in the scenario: a bachelor farmer of 47 would have kept a servant.
   **A (Kim, 30 Oct):** a farmer prioritises sowing over tilling: a tilled field is sown before the next field is tilled. VB-023 is rewritten as that rule, for every farm, and is `ready`.

### VB-024: wood supply
1. A commons wood tile is felled to meadow in about 1.5 years. The task only reports numbers first. **P:** set it `ready` as a report-only task.
   **A (Kim, 30 Oct):** accepted; `ready`.

### VB-025: browser smoke test (also unblocks VB-053)
1. May the project add `playwright` and `pixi.js` (served locally instead of the CDN) as dev dependencies? Chromium is already installed in the cloud sessions. **P:** yes; run it in `npm run verify` only.
   **A (Kim, 30 Oct):** accepted; VB-025 is `ready`.

### VB-026: farm names in big villages (new farmsteads need names too)
1. Farms beyond the direction names: numbers (today), names of owners or families, or landmarks. **P:** landmarks from the surroundings, as lone farms already get (Backa, Strand, Lunden, Myra, Ängen), then Nygården for a newly built farm, and numbers only as a last resort.
   **A (Kim, 30 Oct):** a name generation system with many generators for the different entities; in the long run cultures prefer different kinds of generators. For now, landmarks and owner names are two generators that combine with the compass-direction one. VB-026 is rewritten and `ready`.

### VB-036: relationships and courting
1. When do pawns court? **P:** unmarried adults (men 20+, women 18+) with a strong tie (time together at work, the well and the green) may start courting at any time of year; courting lasts a season or more and can end.
   **A (Kim, 30 Oct):** courting may start from 16; marriage stays at 18/20. A system for pawn interactions comes first, in its own arch (VB-059).
2. Is a courting couple's marriage still gated by a place to live and the marriage limit? **P:** yes, both; courting couples wait for a place (claims, new plots, inheritance).
   **A (Kim, 30 Oct):** accepted.
3. Births outside marriage: how often? **P:** a small chance per day while courting, about 5% of births at the start; the couple marries within the year in most cases (about 3 in 4) if they can.
   **A (Kim, 30 Oct):** accepted.
4. Who believes who is the father? **P:** the true father is recorded; when the mother is courting more than one man, or married to another, the believed father is her husband, or the man she is seen with most.
   **A (Kim, 30 Oct):** always the true father, for now.
5. Does hunger stop courting, or only marriage? **P:** only marriage, as today (hunger ≥ 0.5).
   **A (Kim, 30 Oct):** accepted. VB-036 now waits on VB-059.

### VB-059: pawn interactions (new; courting waits on it)
1. What kinds of interaction come first? **P:** talk (builds a tie), help (a gift of food or work, VB-039), quarrel (lowers a tie), court (VB-036); later trade and persuasion.
   **A (Kim, 30 Oct):** talk only, for the first version.
2. What does a relationship between two pawns hold? **P:** the existing tie weight (familiarity), plus an opinion from −1 to 1 (liking), and a courting flag; kin links stay in the family records.
   **A (Kim, 30 Oct):** accepted.
3. When do interactions happen? **P:** when two pawns meet (as `noteContacts` finds them: working near each other, at the well, on the green, at home), each pair at most once a game hour, with the kind drawn from their roles, ties and opinion.
   **A (Kim, 30 Oct):** accepted.
4. Are interactions visible? **P:** a short speech-bubble icon over the pair near the camera, and a line in each pawn's events for courting, help and quarrels; talk is not logged.
   **A (Kim, 30 Oct):** accepted; also, the pawn info screen shows active modifiers (e.g. mood +5, recently talked to a friend): new task VB-062.
5. Cost at 1,000 pawns: keep relationships only above a minimum tie (as ties today), check pairs by map bucket instead of all pairs. **P:** yes; a target of under 5 ms per game hour on a populous medium map.
   **A:** not asked; the proposal is used. VB-059 is done; VB-060 to VB-063 written.

### VB-039: food help from kin and the village
1. Each adult wants a buffer of 20–60 days of food before giving. **P:** yes, drawn per pawn; the holder's counts for the household.
   **A (Kim, 30 Oct):** accepted.
2. How is the village store filled? (a) a share of each harvest given to the village, (b) gifts from households above their buffer at the moving round, (c) only common fields, once they exist. **P:** (b) for now.
   **A (Kim, 30 Oct):** (b); a share of 25% of the surplus at each moving round. VB-039 is `ready`.
3. Is help a gift or a loan? **P:** a gift that raises the tie between the households (and so their influence on each other's customs); loans come with money and markets.
   **A (Kim, 30 Oct):** accepted.

### VB-041: claims, ownership and territory
1. Who may hold a claim: households and villages only, or pawns too (a pawn who wants to turn a commons tile into a field)? **P:** all three, as the design says.
   **A (Kim, 30 Oct):** accepted.
2. Do unrealised claims expire? **P:** yes, after 3 years without work on the tile.
   **A (Kim, 30 Oct):** after 3 idle years, decaying linearly; a claim can be renewed.
3. Two claims on one tile: who decides? **P:** the village meeting, by voice-weighted support; until then, the first claim wins.
   **A (Kim, 30 Oct):** a custom decides (a new custom dimension, drifting like the others); its options and default are a follow-up question below.
4. First version of the filters: which levels? **P:** household and village, with the selected entity highlighted; culture later.
   **A (Kim, 30 Oct):** accepted.
5. Adopt the proposed scope model (a level, the chosen entities and a dimension, over one membership graph) as the plan? **P:** yes.
   **A (Kim, 30 Oct):** yes.
6. Follow-up: the "Disputed claims" custom. **P:** options: the first claim stands (`first`); the strongest claim stands, the one most recently worked or renewed (`strongest`); kin of the tile's last owner first (`kin`); the meeting decides by voice-weighted support (`meeting`). Default `first`, malleability 0.7.
   **A (Kim, 30 Oct):** accepted. VB-041 is done; VB-042 to VB-045 are `ready`.

## Priority 3

### VB-047: animals and husbandry
1. The first wild grazer: roe deer, with elk later? **P:** roe deer.
   **A (Kim, 30 Oct):** roe deer.
2. The founders' livestock: **P:** per household 2 cows, a pair of oxen and 6 ewes, with hay for the first winter, as the design proposes.
   **A (Kim, 30 Oct):** some farms have animals, not all. At least one farm has a breeding male for cattle (recorded as a bull, since oxen are castrated) and at least one has a ram. Farms with sheep have 4 ewes. Open: how many farms keep each, and whether cattle farms keep a pair of oxen.
3. Food from animals, in rations: **P:** a cow in milk gives 0.5 rations a day in summer, part of it kept as butter for winter; a slaughtered cow 40 rations, a sheep 8.
   **A (Kim, 30 Oct):** accepted, but slaughter yields meat, which a household job processes into rations that can be stored; rations spoil after a year.
4. The byre: **P:** room for 6 cattle at first, enlarged later by a building job.
   **A (Kim, 30 Oct):** accepted.
5. The order of the implement tasks, listed in VB-047. **P:** as listed.
   **A (Kim, 30 Oct):** accepted. VB-047 next writes the animals implement tasks.

### VB-055: type checking
1. May the project add `typescript` (about 25 MB, dev only) to check the plain JavaScript with JSDoc types? **P:** yes, in `npm test`.
   **A (Kim, 30 Oct):** accepted; VB-055 is `ready`.
