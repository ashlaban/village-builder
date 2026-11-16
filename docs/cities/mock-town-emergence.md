# The town's emergence: a mock (VB-189, 16 November 2026)

A mock asked for by Kim before the town's plan (`docs/plans/VB-189.md`) is finished: throwaway research code under `docs/cities/mocks/`,
not game code. It explores two things: (A) how a household with a craft moves from farming to living by the craft, and (B) how often a
market meets, and where. Kim's direction, which it works under: a market place or a town is a **label** read from what people do, which no
rule reads; no threshold switches anything on; plots are grown; the 600 / 325 / 75 is counted by work.

Each finding names the run that gives it. `craft.js` takes 12 seconds and `market.js` 40; both are seeded and print the same tables each time.

## Findings

### A. The craftsman's transition (`node docs/cities/mocks/craft.js`)

1. **At the design's worths the crafts pay well by the hour and are starved of buyers, not of hours** (`--only sweep`, table A0). A bloom
   (worth 30) takes 33 hours of a novice and 16 of a master: 0.9 to 1.8 rations an hour. A pot (3) gives 1.2 to 1.9; a length of cloth
   (40) only 0.3 to 0.6. A field gives 0.6 (50 rations net of seed in 85 measured hours), a day's hire 0.4. But a farm in reach wears out
   0.27 of a bloom, 2 pots and 2 lengths a year, and gives a smith 4.7 rations a year, a potter 3.0, a weaver 16 (after the farms that
   make their own, or do not value it at its worth). A household of six needs 216 and its head wants 238.
2. **The craft's share of the household's food rises smoothly with the farms in reach; there is no jump** (table A1, 30 seeds). The smith:
   8% of its food at 5 farms, 26% at 20, 46% at 40, 62% at 60, 88% at 120, 95% at 160, while its fields go from 4.0 to 3.3, 2.4, 1.0 and 0.5.
   It is half fed by the craft at 50 farms (potter 50, weaver 30), keeps no field in the median year at 160 (potter 80, weaver 30), and
   no cow at 200 (potter 100, weaver 50) (`--only drops`, A2). The partial town Kim asked for is the normal state over a wide range.
3. **What keeps the smith half a farmer is lumps and its own caution, not the bad year** (A3, one thing changed at a time). Sold in
   fractions, the fields go at 50 farms, not 160. A head who plans on its mean craft income, not its second worst year of eight, drops
   them at 50 too, and is hungry in 2% of years (0% when cautious). With every harvest the same, nothing moves (160): farms at 1.1 to
   1.6 times their need hold stores and go on buying. At 5 farms the smith sells nothing in 47% of years (a bloom is a lump; the income's
   coefficient of variation is 1.1, against 0.5 at 60 farms).
4. **The result is most sensitive to what the farms make over their need.** On a full island (1.0 to 1.25) the smith is half-craft at
   120 farms and field-free at 200; on a lean one (1.0 to 1.1) the craft gives 9% of its food at 60 farms and never frees it. Next: the
   wear rate (twice as fast: field-free at 50; half: 200) and what part of its spare a farm gives for one craft (a tenth, not a third:
   400). Least: the worth itself. A bloom at 15 or at 60 gives no more than at 30 (51% and 52% of food at 60 farms against 65%), since
   fewer farms then value it.
5. **Hired days come last, and a household with no land goes hungry on a full island.** At 3 rations for 8 hours a day's hire is the
   poorest use of an hour, and no landed craft household takes it. A plot household (no fields; two cows, a garden, 14 to 16 hired days) is
   half-craft at 30 farms and fed, but on a full island it is hungry in 24% of years at 60 farms, where the same household with fields is
   not (A3, last rows). The cow outlasts the fields only if its care falls on hands the craft does not use (15 rations for 17 hours of
   haymaking; counted on all 45 of its hours it is the poorest work and goes first).
6. **A district of 160 farms (about 1,000 people) carries about 8 households that hold no field and 12 that are half-craft** (A2: smith
   1.0 and 3.2, potter 2.0 and 3.2, weaver 5.3 and 5.3), each alone of its craft in its reach. On real maps
   (`--only maps`, A4) a village has 7 to 38 households within a day's walk there and back at the start of populous small, 25 to 69 at
   year 30, and 14 to 83 on medium (the most: 95). A smith alone on its island is half-craft in none of the 39 villages of four small maps
   at year 0, in 15 of 44 at year 30, in 22 of 81 on medium, and field-free nowhere.
7. **What the work line would read** (`--only work`, A5; an account, not a simulation). The planned goods take a household of six 242
   hours a year, 76% of it dress (184 hours of spinning and weaving). Against the 769 hours a farm household works today (55% idle), that
   is **239 per 1,000 of hours worked if home-made dress counts, 70 without it**, 403 if grinding and building also count, and 140 of all
   work hours. The 8 field-free households are 48 heads of 1,000 but far less in work: a fed smith works 385 hours a year at its craft.
   So 325 by work is not reached by crafts before the ship, and what the line reads turns on whether work for one's own household counts.
8. **A town can exist before the ship, small, and it goes short first** (`--only food`, A6). The three crafts ask 3,800 rations a year of
   160 farms: food for 16 households (96 people). The farms can spare that at 1.1 to 1.3 times their need (5,500) and not on a full or lean
   island (3,200 and 1,100: 14 and 5 households). In a year with a harvest under 0.85 (one in ten) the farms at 1.1 to 1.3 spare food for 2
   households, at 1.0 to 1.25 for less than one. This agrees with the cities review's toy town (18 to 23 people on the tiny map).

### B. How often a market meets (`node docs/cities/mocks/market.js`)

9. **A frequency does emerge without a rule, and it stays low** (`--only freq`, B1; 6 seeds, years 31 to 40). With 54 to 56 households
   on a small map no date holds (0.0 to 0.5 at the fullest place). With 129 to 147 a place holds about one a year (0.4 to 3.2); with 258,
   2.5; with 516, 4.0 (seasonal), each date drawing 5 to 10 households. No run reached a monthly or weekly calendar of called dates.
10. **Most dealing is a walk to a maker's house, not a date.** 72% to 98% of deals were made at a maker's village on an ordinary day; a
    walk of 3 hours each way and a morning costs 1.6 to 3.2 rations against gains of 4 to 20. What rises with people is the number of
    busy days (three or more households that walked there and dealt) at the busiest village: 3 to 6 a year at 55 households, 3 to 9 at
    130 to 147, 21 at 258, 35 at 516. A weekly market appears as busy days where makers live, not as a calendar.
11. **Makers living in one village make the place; their number does not** (`--only sellers`, B2; 129 households). Scattered, the
    busiest village has 8 to 10 busy days and 22% to 44% of all deals, whether there are 1 or 8 makers a good. All in the most central
    village: 32 busy days and 95% of deals. With no makers at all, only dates remain: one a year, and 11% of wants met.
12. **Perishable goods do not make the market more frequent** (`--only perish`, B3). With all wants lapsing in 3 days, dates fall
    (1.6 to 1.3 at the fullest place; 4.0 to 2.4 at 516 households) and busy days barely rise (9.4 to 10.1; 34.7 to 38.4): a want that
    cannot wait is met by walking to the maker, or not at all. The game's goods nearly all keep a year, so this lever is weak either way.
13. **The frequency is set by what a host needs to call a date again, which the mock cannot supply** (`--only host`, B4). At 2
    households from other villages: 3.6 dates at the fullest place; at 6: 1.6; at 12: 0.7; at 24: none (516 households: 6.0, 4.0, 2.6,
    0.6). And by what an hour is worth: at 4 times the walk's cost no date holds.
14. **Centrality explains the site loosely; a maker explains it better; the sea not at all; and dates do not lock in** (`--only place`,
    B5 and B6). Over 120 runs the fullest dates were at the most central village (Harris potential on walking hours) in 55, among the
    three most central in 88, at a village with a maker in 94 (49% of villages have one), by the sea in 51 (60% of villages are); the
    village with most deals of all had a maker in all 120. The same place led at years 15 and 40 in only 35 runs. With the map and the
    makers fixed, 16 runs led at 3 to 6 different villages (the commonest 7 to 10 times). A middling village given four protected dates
    for 10 years led at year 40 in none of 48 runs.

## What the mock says the labels are

Two measures of a place, each over the last 3 years, read at the year's end, shown and reported, read by no rule:

- **w, work for others:** of the hours its people worked, the share whose product or service left their household (craft goods given in
  deals, carrying to deal, service and days for another household). Home-made dress and grinding are left out (finding 7).
- **d, dealing days:** days a year on which at least 3 households that walked there dealt with someone living there or met there.

| Label | Enters, 3 year ends running | Leaves, 3 year ends running | In the mock |
| --- | --- | --- | --- |
| Village | | | Scattered makers at 130 to 147 households: d 3 to 9 |
| Market place | d at least 12 and w at least 0.15 | d under 8 or w under 0.10 | Makers in one village at 129 households: d 32; w not computed (about a third, from A1's hours) |
| Town | d at least 36 and w at least 0.5 | d under 24 or w under 0.35 | d 35 at 516 households; w of a half only where most households are past A2's "half its food" |

A household's own label is the ladder the design has (`design.md`, Goods of place: side craft, craft household, specialist), read from
the craft's share of its food over 3 years (under a third, to two thirds, above), with the same hysteresis. The numbers 12, 36, 0.15
and 0.5 are proposals to be set against the first real run; the mock supports the two measures, not the cut points.

## Can a town exist before the ship

Yes, as 8 to 16 households of about 1,000 people (findings 6 and 8), if they live in one place, most of them still holding a field or a
cow, and going short in one year in ten. Two things stand against even that. Each craft is tied to its material (bog iron within 12
steps of 12% of villages, clay of half), so makers are scattered unless something gathers them (finding 11). And on a full island (farms at 1.0 to
1.25 times their need), where the late game is, the farms spare food for 14 households in an average year and for less than one in a
bad year (finding 8).

## Mechanisms the game would need, against what is built and planned

| Mechanism | State |
| --- | --- |
| Goods that wear, so that the want returns: tools, pots, dress | Planned: VB-701, VB-121, VB-366, VB-362. None built |
| Skill that grows with hours (the maker's edge over the farm: 0.6 to 1.3) and a facility as a lump | Planned: VB-360, VB-361 (both ready) |
| A head makes more than its need for a purpose | Planned: VB-698 (ready). It sets what to make, not what to stop |
| **A head sizes its fields by its estimate of all its food, not by need alone** | **Lacking.** `fieldsWanted` (`src/sim/fields.js`) reads only the household's rations: a household fed by fish or iron still wants the same fields. Without this no household moves along the ladder |
| **A head's memory of what a source brought, and its caution** (principle 14) | **Lacking.** Finding 3: this is what holds the smith to its fields |
| A swap between two pawns in one place, anywhere | Planned: VB-690, VB-302 (freed from the gathering, 16 Nov) |
| **A walk to a named household to deal, between gatherings** | Named, not planned: VB-302's note leaves "the trading trip as a pawn's own act" to the visit (VB-289, VB-292). Finding 10: this carries most deals |
| A yearly gathering whose site villages choose | Planned: VB-294 |
| **A date a host calls as his own act, kept by who came; a household's estimate of a place from what it found there** | **Lacking** (the draft's step rule is a rule of the simulation). The host's cost, which sets the frequency (finding 13), has no number |
| Hired days | Planned: VB-319. Finding 5: at 3 rations a day nobody with land takes them |
| Service offered and taken | Planned: VB-694 |
| **A maker settling where buyers come, carrying its material there** | **Lacking.** A plot asked for (VB-697) gives the place; nothing makes a smith weigh the bog against the buyers. The mock did not model it either |
| A garden crop; a cow on the common for a household with no meadow | Garden lacking (invented here); grazing rights planned (VB-141) |
| The labels: occupation of a pawn, by hours, with hysteresis | Planned: VB-365. The place's label is the same view one level up |

## What in the draft plan no longer stands

- **Section 2, decision 1, and 3.1: "a town grows out of a gathering by one quantity, how often its market is held".** In the mock called
  dates stay yearly to seasonal while dealing grows where makers live (findings 9 to 11). Frequency of dates is a weak reading.
- **3.1, the step rule (`MARKET.full` 8, `MARKET.thin` 3) and the tiers' "what it changes"** (the culture's kind `city`, booths, a town
  meeting, the first row of plots "in the year the place first holds 12 dates", the square of 7 "when the place first becomes a market
  place"): each is a threshold that switches something on. What they switch needs a quantity of its own to read, or goes.
- **3.1 and 3.8: "a household on a plot that also farms village fields does not count".** The ladder is a share, and the work line counts hours.
- **3.3: the laid street** (Kim: grown), and **"a plot's own food: no fields"**, with town fields left out "because they blur the 325"
  (finding 5; and by work nothing is blurred).
- **3.8: the band on the work line, 250 to 400, "side crafts a few points".** The line reads 70 or 239 by one definition (finding 7).
- **Section 7: VB-728 and VB-729** as written (the step rule, the tiers, the street), and the scenario's "3 plot households (fishers, a
  tar burner, a brewer)" as the unit counted. **Section 9: choices 1, 2, 3 and 6** are answered.
- **Still standing:** crowding (3.6); offers, not a pull (3.7); the town goes short first, with no rule of its own (finding 8); potential
  as an explanation that places nothing (finding 14); the reports of VB-725; "small and few until the ship".

## Method

**A** (`craft.js`). One craft household among N farms an hour's walk off (or at a real map's hours). Each year one harvest factor for
the island (0.75 to 1.2). Each farm makes 1.1 to 1.6 times its need, eats, keeps a reserve, loses stored grain at the game's rates, and
buys whole pieces of the good it has worn out when it cannot make it, values it above its worth and the walk, and can spare the grain.
The head plans in spring, before the craft's income is known: among fields (0 to 6), cows (0 to 2), a garden and hired days it takes the
plan whose estimate reaches 1.1 times need with the fewest adult hours; its estimate of the craft is the second lowest of the last 8
years. Skill grows with hours and fades, as VB-360. 60 years a run, the last 40 counted, 12 to 30 seeds.

**B** (`market.js`). The households of a real map (`hours.json`, made by `hours.js` from ten populous starts and two runs of 30 years)
come to want five makers' goods and something of another farm's (met by one household in twenty). A want loses worth daily. Every third
day a head weighs a walk to a maker's village, a date held today, and waiting for a date within 12 days, by its village's estimate of
what it found at that place before, less the walk at the season's worth of an hour. A host tries a new date with chance 0.3 a year and
calls it again if 6 households of other villages came. 40 years a run, the last 10 counted, 6 to 16 seeds.

## What was invented

From the game or its plans (`numbers.js`, `GAME`, each with its source): need, the head's want of 1.1, the field's yield, seed and
measured hours, the harvest factor, the farms' ratio, storage loss, idle shares, the cow, a day's hire, loads, skills, tool wear, the
bloom, the pot, cloth, the share of villages with bog iron and clay, the walking hours.

Invented (`numbers.js`, `INVENTED`): hours to dig and carry a load of ore or clay (1.5); what a peak hour is worth to a farm (0 to
0.58, evenly spread); the part of its spare a farm gives for one craft (a third); a farm's reserve (a quarter of a year's need); the
share of households that buy cloth (0.2) and what cloth is worth to them (60); the garden (17 rations for 22 hours); hired days on
offer (0.4 a near farm a peak, halved in a bad year); that haymaking alone falls on the craft's hands; the head's memory (8 years, second
lowest). In B: the wants a year and their gains (iron 0.3 and 15, pots 0.5 and 6, cloth 0.4 and 20, fish 1 and 5, tar 0.25 and 4,
another farm's 0.5 and 8), the loss by waiting, the one-in-twenty match, the prior of 0.5, the host's chance to try (0.3) and what he
needs (6), two makers a good, and three deals for a busy day. The household of six with three hands is rounded from the scenario.

## What a toy model cannot show

- **Prices.** Worths are the design's fixed table; nothing bargains. Finding 4's flat response to worth is a property of my spread of
  what an hour is worth to a farm, which is invented.
- **Competition and entry.** A craft household is alone of its craft in A; B's makers are placed, never move, never fail, and always
  have stock. So B cannot show a town forming, only what happens if makers are together (finding 11). Lock-in through makers settling
  where buyers come, the likeliest kind, is outside it.
- **Everything else a farm's surplus goes to:** feasts, help, rent, tithe, seed for new fields. A6's "spared" is an upper bound.
- **The elite's demand,** which fed most historical towns, and the 75 altogether.
- **Demography:** who becomes a smith, servants, marriage, the urban sink, crowding.
- **The social draw of a gathering** (courting, kin, cases), which the markets review puts before trade, and which may fill dates the
  mock leaves empty.
- **Carrying limits:** a length of cloth (40) is more than a back's load of grain (30); buyers here pay without weight.
- **The real cut points** of the labels, and any number in B to better than a factor of two: finding 13 says why.

## Design choices for Kim

1. **How does a head weigh a craft against its fields?**
   (a) As built: fields by need alone; a craft fills slack hours and never frees a field.
   (b) By its estimate of all its food, cautiously (the second worst year it remembers).
   (c) By its mean, trusting its store.
   (d) As (b) to (c), the caution taken from the head's own trait.
   **Proposed: (d).** It is what moves a household along the ladder at all, and it makes craftsmen differ: field-free at 160 farms when cautious, at 50 when bold (2% hungry years).
2. **What counts as work on the 600 / 325 / 75 line?**
   (a) Only work whose product or service leaves the household.
   (b) All craft hours, home-made dress included.
   (c) As (b), with grinding and building.
   **Proposed: (a).** Under (b) every farm reads 239 by its loom alone; under (a) the line reads what Kim means by a town, and is honestly far below 325 before the ship.
3. **What does a place's label read on the dealing side?**
   (a) Dates called and kept.
   (b) Dealing days: days when at least 3 households walked there and dealt.
   (c) Customary worth changing hands there.
   **Proposed: (b).** 72% to 98% of the mock's deals were walks to a maker on an ordinary day, which (a) does not see.
4. **Is there a market date between gatherings, and who makes it?**
   (a) No: the yearly gathering only; dealing between is visits.
   (b) A host may call a date as his own act and call it again by who came, at a cost to him (what he pours, his day).
   (c) The draft's step rule at the meeting.
   **Proposed: (a) first, (b) when the host's cost has a number.** The frequency is that cost (3.6 dates at 2 households, none at 24), and visits carry the dealing meanwhile.
5. **What may a household on a plot hold?**
   (a) No fields: a cow, a garden, hired days.
   (b) Whatever land it has or can get; a plot forbids nothing.
   (c) Town fields let by the village.
   **Proposed: (b).** A plot household with no field was hungry in 24% of years on a full island; the transition Kim described is (b).
6. **What gathers makers into one place?**
   (a) Nothing: they stay by their bog and clay, and a town is where several happen to be.
   (b) A maker may take a plot where buyers come and carry or buy its material, weighing the two walks.
   (c) A scenario places them.
   **Proposed: (b), with a second mock first.** Makers together turn 9 busy days into 32; no other lever in B came near it, and B did not model the move.
