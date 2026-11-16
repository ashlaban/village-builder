# The town's emergence: a mock (VB-189, 16 November 2026)

A mock asked for by Kim before the town's plan (`docs/plans/VB-189.md`) is finished: throwaway research code under `docs/cities/mocks/`,
not game code. It explores two things: (A) how a household with a craft moves from farming to living by the craft, and (B) how often a
market meets, and where. Kim's direction, which it works under: a market place or a town is a **label** read from what people do, which no
rule reads; no threshold switches anything on; plots are grown; the 600 / 325 / 75 is counted by work.

**Part two** (below, after part one's choices) is the second mock, `move.js`, made after Kim answered those choices on 16 November:
makers who may move, and dealing that rides on gatherings. It withdraws three things said here (its section "What part two withdraws").

**Part three** (at the end) is the third mock, `share.js` (VB-776): a shared facility, an elite household and a ship's buyer, tried
in part two's toy. None gathers makers at parameters near the game's, and part two's finding stands.

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

Answered by Kim on 16 November 2026 (`docs/plans/VB-189.md`, section 1): 1 (d); 2 (b), against the proposal; 3 dealing days on the green;
4 neither: no pawn calls a market, dealing rides on gatherings; 5 (b); 6 (b), after the second mock, which is part two. Kept as asked.

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

# Part two: makers who may move, and dealing that rides on gatherings (16 November 2026)

The second mock, asked for by Kim after the first: `docs/cities/mocks/move.js` (a minute and a half; seeded; `--only` takes one table).
It works under Kim's answers of 16 November to the first part's choices (`docs/plans/VB-189.md`, section 1): nobody calls a market;
pawns bring goods to gatherings that happen anyway, each by its own estimate; a gathering day's dealing is on the green; on other days
a pawn may walk to a named household; a head sizes its fields against its estimate of all its food, by its trait; a plot household may
hold what land it can get; and a maker may move to its buyers. The host-called date of part one (finding 13, choice 4) is gone.

## Findings (`node docs/cities/mocks/move.js`; C1 to C9 are its tables)

15. **Makers do not gather by positive feedback. They spread.** (C1, C2.) A farm gives a smith 4.7 rations a year, a potter 3.0, a
    weaver 16, so a new household on a plot lives by the custom of 25, 39 or 7 farms, and a maker's best place is where no maker of
    its craft has the buyers yet. On the real maps (129 to 147 households) the island ends with 17 to 21 maker households, one to 6 to
    8 farms, and the fullest village holds 2.3 to 3.9 of them (13% to 19%); at twice the households 5.3 to 6.2 (12% to 14%), at four
    times 8.1 to 12.6 (10% to 14%); at a populous start (54 to 56 households) 5 to 7 makers, 1.7 to 3.0 of them at the fullest.
    Nothing changed that share: makers who judge a place by distance alone (15%), who do not count
    their rivals (17% to 20%), with no yearly gathering (13% to 14%), or with nobody allowed to move (16%). Over 24 variants of C8 it
    stayed between 10% and 22%.
16. **A place begun gathered comes apart within a generation, so nothing locks in** (C4, C2). With all six first makers begun in one
    middling village, it holds 4.6 maker households at year 10, 2.9 at 20, 2.0 at 40 and 1.4 at 60, and leads at year 60 in none of 30
    runs. Begun in the most central village, it ends as the unforced runs do (3.1 against 2.8 makers at the fullest place; 5.9 against
    6.2). (My first run of this table showed the opposite, 16 of 16: it had let a dead maker's farm stand as free fields for the next
    maker. A farm is now taken up by a farming household.)
17. **Where makers are is set by reach, smoothly, and by who hosts the gathering** (C3; 984 villages over ten maps at 1, 2 and 4 times
    their households). Of villages with under 20 households within 3 hours' walk, 3% hold three or more makers; with 20 to 40, 16%;
    40 to 80, 46%; 80 to 160, 65%; 160 to 320, 73%. No step. A village with all three crafts is rarer: 1%, 5%, 13%, 18%, 19%. The host
    of a yearly gathering holds 1.3 to 1.8 times the makers of other villages of the same reach (4.2 against 3.3 at 40 to 80).
18. **Which place leads wanders at the real maps' sizes, and settles on the most central host only with many more people** (C4; the
    same map, deposits and first makers, 10 runs differing by chance). At 129 households four villages led at year 60, and the same
    one led at years 20 and 60 in 4 runs of 10 (the leader has 2.6 makers: there is little to lead). At 272 (medium), six villages and
    2 of 10. At 516 the most central host led in 10 of 10 and held 9.6. That is geography, not lock-in (finding 16).
19. **How many places an island has.** Villages with three or more maker households: 0 to 1.5 on the real maps (780 to 900 people),
    4 to 6 at twice that, 13 at four times (C1). With eight or more: none, 0 to 0.3, and 0.5 to 3.0. At the late reference (1,000
    people, about 170 households) that is one to three villages with three makers and none with eight.
20. **A place stops growing because its makers share one custom, not for want of food, unless the island is full** (C5). The fullest
    place holds 3.1 maker households (19 people) with 82 farms within a day there and back, 6.0 (36) with 191, 8.4 (50) with 332, 12.7
    (76) with 376. All makers in its reach take 25% to 30% of what those farms make over their need, and 4% to 10% of wants go unmet.
    With three times the would-be makers the place has 14.6 households and still 1.6 half fed by their craft. On a full island (farms
    at 1.0 to 1.25 of need) the makers take 46% and 26% of wants go unmet for want of grain; on a lean one (1.0 to 1.1), 40%. Crowding,
    by the draft's rule, starts at about four plot households close together (factor 1.1) and reaches 1.5 to 1.63 at six and more
    (arithmetic from the layout, not simulated).
21. **Most of a place's makers are still part-farmers.** At the fullest place 63% to 85% of maker households hold a field (C5); over
    the island 69% to 81% do, and 36% to 46% are half fed by their craft (C1: of 20.5 maker households, 5.0 hold no field and 7.3
    are half fed by craft). Fields sized by need alone, as built, leaves 7.4 field-free against 12.6 (C8, 258 households): the
    estimate of all food is what lets a maker put its fields down. A maker with no field ends under 0.85 of its need in 31% of years
    on an ordinary island (C7), and of 56 would-be makers who found a place in 60 years, 15 gave up and 19 more found none (C1).
22. **A bad year: the makers go short first on a full island, and the green empties** (C7; a harvest under 0.85, one year in eight).
    Farms at 1.1 to 1.6 of need: a maker's craft brings 139 rations in other years and 124 in a bad one; makers under 0.85 of need go
    from 15% to 19%. Farms at 1.0 to 1.25: 99 and 64 rations; wants filled 80% and 58%; hungry makers 19% and 33%, of those with no
    field 42% and 58%; the island's green dealing days 44.6 and 30.1, its busy house days 11.2 and 3.5; the year after, a maker still
    gets 80. Fields keep a maker fed in the bad year (food at 1.09 of need with fields, 1.12 without, against 1.41 and 1.57).
23. **The gatherings carry a quarter to two fifths of the makers' dealing, and the yearly gathering most of that** (C1, C2, C9). Of
    the makers' goods, 23% to 40% were dealt on a green; without the yearly gathering 14% to 24%. A host's calendar reads: ten and
    more households dealing on each of the gathering's three days, one to seven on a rite day or the meeting, nothing between (C9).
    Two things raise the green's share: rites held on each village's own days, not the same day everywhere (36% to 50%: a household
    can then go to a neighbour's), and ale evenings counted as gatherings (59% at 6 a village a year, 73% at 24). Neither gathers makers.
24. **The walk to the material did not decide where makers live** (C8). Carrying ore from a bog 3 hours off adds 24 hours to a bloom
    of 16 to 34, clay 3 hours to two pots of 3 to 5; by cart or at no cost the island has 41 maker households against 45 and the same
    spread. Makers are short of buyers, not of hours (finding 1), so hours spent carrying cost them little. What moved the counts: the
    fields to be had (19 makers with none, 61 with fields free at 30% of those held), the would-be makers a year (20 to 60), how long
    a maker's household lasts (29 to 51), and the farms' surplus (30 on a lean island).
25. **Moving itself matters little.** With nobody moving, and a would-be maker settling only at home, the real map ends with 13.6
    maker households against 20.5 and the medium one with 42.8 against 43.6 (C2): on a small island a third more find a place, and
    wants filled stay at 89% to 92%. A maker moves 0.1 to 1.3 times in 30 years (0.2 if a move must better its year by 40% of its need).

## What the label would read (C6)

Over 10,471 village-years (villages of 3 households or more, years 31 to 60, six cases):

| Measure | What it read | A natural cut? |
| --- | --- | --- |
| Dealing days on the green a year | 0 in 40% of village-years, 1 in 19%, 2 in 15%, 3 in 13%, 4 in 8%, 5 to 7 in 5%; never above 7 | No. It is capped by the calendar: a village has four gathering days of its own, a host seven. No gap anywhere |
| Households of other villages that dealt on its green in a year | 0 in 75%, 1 to 2 in 12%, 3 to 11 in 5%, 12 to 23 in 3%, 24 and more in 5% | **Yes, one.** The upper group is the hosts of a gathering (27 to 37 a year at a host of the real map, 66 to 79 at four times the households); the rest see almost nobody |
| Busy house days (3 or more households of other villages dealt at houses there) | 0 in 85%, 1 to 5 in 12%, 12 and more in 2% | No |
| Work that is not farming, per 1,000 of hours worked there | 239 with no maker (the farms' own crafts); median 257 with one maker, 265 with two, 275 with five to seven, 287 with twelve and more; nine in ten under 313 to 341; the most 548 | No. It moves by 20 to 50 points between a village and the fullest place |

So the mock gives one honest label, and it is not the one sought: **a market place is a green where the households of other villages
deal**, which today means the host of a gathering. Entering at 12 such households a year and leaving under 6, over 3 year ends,
separates the two groups of the second row; the numbers are read off the histogram and wait for a real run. For **town** the mock gives
no cut point at all: nothing in it reaches what part one proposed (36 dealing days, half the work not farming), and the measures that
would carry the word (work not farming, maker households) vary smoothly and little. The first part's table of labels (above, "What
the mock says the labels are") is withdrawn, but for the household's own ladder, which stands.

**The work line.** With all craft hours counted (Kim), the island reads 263 to 275 per 1,000 (C1): 239 from every farm's own dress,
iron and pots, and 25 to 35 from the makers. So the band's lower edge is nearly met by the looms alone, and the line measures how
much of the island's working time is not spent on food, not how many live by a craft. To read 325 the island needs 128 more hours of
such work for each farm household a year, on top of 242 (`(0.325 x 1011 - 242) / 0.675`); the makers of the mock add about 45. And
the line falls as work specialises: a master weaves a length in 71 hours, a novice in 153, so cloth bought of a weaver is fewer hours
than cloth made at home (the mock does not take a buying farm's hours away, so its 263 to 275 is an upper reading).

## What part two withdraws from part one

- **Finding 11's lesson, "makers living in one village make the place".** It holds as arithmetic (if they did, the place would be
  busy) and fails as a mechanism: given the choice, they do not, and placed together they leave (findings 15 and 16).
- **"Can a town exist before the ship: yes, as 8 to 16 households ... if they live in one place."** The households exist, 17 to 21 to
  an island of the real size; they do not live in one place. What the island has is village craftsmen, and a yearly market at each
  district's host.
- **Choice 6's proposal (b)** as the lever that gathers makers. It stands as a way for a would-be maker to find a place (finding 25).
- **Choice 4, the host-called date,** by Kim's answer; and with it finding 13's break-even.

## Method (part two)

The households of a real map (`hours.json`) farm, and come to want five things as in part one: iron, pots and cloth of a maker, dried
fish of a fisher by the sea, and something of another farm's. A farm pays in grain, from what it holds above a reserve. Each village
has its meeting (autumn day 10) and, with three households or more, three rites (spring day 1, summer day 6, winter day 7); the most
central villages host a yearly gathering of the villages within a day's walk (winter days 1 to 3; at least three villages). A household
has someone at its own village's days with chance 0.9 and sends a goer to its gathering with chance 0.8. On a gathering day everyone
there deals on the green with whoever is there; a household of another village comes only if its village's remembered share of wants
met on that green pays the walk and two hours, and a maker of another village only if its remembered sales there do. Every third day
a household with a want may walk to a village where a maker or a fisher lives, or wait for a gathering it will be at anyway.

A maker's head sizes its fields each spring by its estimate of its craft's rations (its caution times the second lowest of the 8
years it remembers, the rest its mean), a garden and two cows. At the round a maker, and each new would-be maker (one a year per 100
farms, of a random craft, with no land), weighs every village within a day's walk: the households it believes would come there for
its good (by how far it has seen its buyers walk, or because they are known to go there already), shared with the makers of its craft
there and near; less the hours of carrying its material from the nearest deposit, the fields it could get there, and its kin (20
rations a year). It asks for one place a year, moves if the place betters its year by 15% of its need, and is always given a plot. A
maker's household ends with chance 3% a year; one with no land that is under 0.85 of its need two years running gives up. 60 years a
run, the last 10 counted, 2 to 10 seeds a row.

**What I assumed of the moving round** (VB-682's plan is not written; Kim's answers of 16 November to it are): an ask for a plot is
an offer made at any time of the year and concluded at the round; a pawn pursues one rung at a time, so a maker asks one village a
year; the move needs the maker's yes and the receiving village's (here always given; VB-697's alderman by custom is not modelled); an
adult needs no leave from the head it leaves; its household goes with it.

## What was invented (part two; `numbers.js`, `INVENTED.move`)

From the game or its plans: the gatherings and their days (VB-522, VB-294, the village meeting), the three households for a green and a
gathering, the day's walk, the loads of a bloom, the hours of each good and the skill that shortens them, the field, the cow, need.
From part one: what a farm gives each craft a year (A0) and what a want filled is worth (B).

Invented: the share of fishers by the sea (a sixth) and a want of fish (4 rations); the chances of being at one's own gathering days
(0.9, 0.8); two hours on a green; material carried on the back, a load a trip; a would-be maker a year per 100 farms; a maker's
household ending at 3% a year; a new household's need (150 for 8 years); two cows and a garden on a plot; fields to be had at a
tenth of those held; kin worth 20 rations a year; the 15% a move must better; the trust in a place not lived in (0.8); what a maker
first guesses of who buys by their walk (1, 0.6, 0.3, 0.1, 0); giving up at two lean years; the rule that picks the gathering's hosts
(a stand-in for VB-294's choice); that a village knows at once who goes where (news, which the hard rule exempts).

## What remains a toy

- **Three goods that every farm wants, at fixed worths.** Makers spread because each good's buyers are everywhere and a buyer goes to
  the nearest maker. A good few want (finding 15 tried wants a quarter as frequent: still spread, 11% at the fullest place) or that
  only a few can make is not in it, nor a maker's name for better work (skill here only shortens the hours).
- **No lump that is shared.** A bloomery, a kiln and a loom's house are facilities raised in stages (VB-361); a second maker beside a
  standing kiln needs none. That is a force for gathering which the mock leaves out, and the likeliest one before the ship.
- **No elite and no outside.** Rent carried to a landed household, its retinue and its feasts, a harbour, a granted market: what fed
  and held most historical towns is slice 5's and the ship's.
- **No people.** Nobody is born, marries, serves or dies of crowding; a would-be maker appears at a rate I made up, and that rate
  sets how many makers there are (finding 24). The fields to be had are a number, not land.
- **The receiving village always says yes,** and a plot always has a garden and grazing for two cows.
- **The gatherings' social draw is a constant** (0.9, 0.8), and the hosts are fixed for a run.
- **Buyers pay without weight, and a maker always has stock while it has hours.**
- **Dealing days off the calendar cannot arise:** by Kim's answer 7 dealing on other days is at a house. Whether a customary day could
  grow from people meeting at a maker's door is not tried here; part one's nearest evidence is finding 13 (3.6 dates a year at the
  fullest place when two households from elsewhere were enough to hold one).
- **No number here is good to better than a factor of two;** the spread of makers (finding 15) is the one result that held through
  every variant.

# Part three: a shared facility, an elite household and a ship (VB-776, 16 November 2026)

**Nothing in this part is evidence about the game beyond a factor of two.** It is the second mock's toy with three things switched
on, on one generated map, with numbers that are mostly made up (listed below). Its shares are good to a factor of two and its
directions (what raises a share, what does not) are the result; no cell of a table is a measurement of the game.

The third mock, asked for by Kim on 16 November when the finding of part two (no town before the ship) was accepted:
`docs/cities/mocks/share.js` (`--only` takes one table; it runs `move.js`'s toy, whose own tables C1 to C9 read as before with the
three switched off). The question: does a facility that is costly to build and worth sharing gather makers, where free movement and
dealing at gatherings did not? And, in the same toy, the two other candidates of `design.md`, What the town waits for: an elite
household as buyer and patron, and a ship's buyer at one harbour.

**The answer: no.** A facility at the game's planned costs changes nothing. A costly one raises the fullest village's share from
14% to about 22%, by leaving the island with fewer makers and not by making a place larger. Neither candidate beside it, nor all
three together, brings a place to a third of the island's makers at parameters near the game's. What does, in the toy, is demand at
a point that cannot be served from a walk away, and a great deal of it: a ship that takes only of the makers who live at its harbour.

## Findings (`node docs/cities/mocks/share.js`; D1 to D7 are its tables)

26. **The planned facilities are too cheap to matter, and the sweep the task asked for lies far outside them.** A household's year of
    spare hours is 959 (three adults at 576 hours, idle 55% of them). The planned bloomery is 20 hours and 6 loads, about 0.03 of
    that; a brick or lime kiln 0.04; a loom 0.01; a mill 0.10 to 0.15; pots are fired in a pit with no facility at all. Twice the
    dearest of them is 0.3 of a year. The sweep of 0.5 to 4 years is 17 to 132 times a bloomery: it asks what a facility would do if
    it cost what a house or a ship costs, which nothing planned does.
27. **At the planned cost the facility does nothing** (D1, D2, D4). The fullest village holds 12% of the island's maker households at
    year 60 against 14% without (10 seeds, the real map), 17% against 23% on the medium map (3 seeds), 12% against 13% at four times
    the households (one seed, some 80 makers). A maker builds its own in a fortnight; 48 are built in 60 years and 28 newcomers take a
    place at one standing.
28. **A costly facility raises the share by thinning the island, not by filling a place** (D1, D4). At 2 years of spare hours, open
    to any maker for a due: the island has 13.9 maker households where it had 19.6, the fullest village 3.1 where it had 2.8, and so
    22% where it had 14%. One seed in ten reaches a third at year 60 (none of them had it at year 30). What changed is who can
    begin: a landless would-be maker cannot live through a two-year build, so 40 find no place where 19 did, and the makers left are
    those who took a place at a standing facility (26) or had fields to build on (13). At four times the households the share is 11%.
29. **Capacity never binds, because a place's makers of one craft share one custom** (D4, D5). A facility in use has 1.1 to 1.5
    makers, the most at one 2 to 4, whether it takes 2, 4 or 8; none to 5% of those in use are full. A kiln gathers potters, and the
    second potter at a kiln halves the first one's buyers: part two's finding 15, unchanged. One workshop serving all three crafts
    (which nothing plans) gives 21% (D5).
30. **Who may use it moves the answer little** (D4; 2 seeds a cell, so read the columns and not a cell). Its builder's household
    only: 12% to 19% at year 60 across the costs. Any maker for a due: 12%, 17%, 15%, 28%, 27% at 0.03, 0.5, 1, 2 and 4 years. The
    village's, raised in common as a mill: 14%, 14%, 28%, 18%; at 2 years a village needs 10 farms to raise one, and the larger
    villages get the makers; at 4 years none on this map can (20 farms), and it falls back to a maker's own. The step is between 1
    and 2 years, where a build outlasts a year's spare hours.
31. **A place begun gathered holds a generation longer, and still comes apart** (D2; 4 runs). With all six first makers at one
    middling village and their facilities standing: 4.1 maker households at year 10, 1.9 at year 30 and 1.3 at year 60 without a
    facility (part two: 4.6 and 1.4); at the planned cost 4.2, 1.5 and 1.0; with a costly one 4.9 to 5.3, 3.3 to 3.5 and 2.1 to 2.5,
    which is 24% to 25% of the island's makers at year 30 and 16% to 21% at year 60. It leads at year 60 in 3 of 4 runs when a
    facility is its builder's only (a newcomer takes up one left standing: the place is inherited), 1 of 4 for a due, 0 of 4 without.
32. **The leader still wanders; the places with a facility stay** (D3; the same map, deposits and first makers, 10 runs). Four
    villages led at year 60 with a costly facility, as without; the same one led at years 20 and 60 in 3 runs of 10 (4 without), at
    years 40 and 60 in 7 (4 without). Of the villages with a facility at year 20, 94% have one at year 60. So a facility fixes where
    a craft is done, one or two households of it, and does not make that place grow.
33. **The due can be paid in the game's terms, and it becomes a rent** (D4). A maker who uses a facility that is not its own leaves a
    fifth of its make there; the owner lives beside it and deals the pieces as its own, so nothing is carried but by the maker who
    made it, to the place it was made. 8 to 11 of the island's makers pay one, 18 to 41 rations' worth a year each. But 66% to 100%
    of the dues go to a builder's heir who is no maker: the builder's household ended and the kiln outlived it. That is a toy's
    assumption (an heir keeps the facility and the due), and it is also how a small rentier would arise: a claim sized at about a
    seventh of a household's need for each user (Deciding without Kim, 13).
34. **What stops the place is custom, then land; not ore, and not fuel at these sizes** (D5; one thing changed on the costly
    facility, 2 seeds). Material carried at no cost: 15.1 maker households against 15.2, the fullest place 4.4 against 4.3. Wants
    twice as often: 16.2, the place 3.7. Three times the would-be makers: 17.2, the place 4.5, and 175 who found no place. A full
    island (farms at 1.0 to 1.25 of need): 11.5, the place 2.9, wants unmet 31% against 22%. Fields free at 30% of those held: 33.8
    makers and the share falls to 12%, since with land a newcomer can build anywhere and they spread again. Fuel is arithmetic here,
    nothing burns: a bloom takes 6 loads of wood and a hearth 35 a year, and the mock's smiths sell 4 to 8 blooms, one hearth more
    each; a smith who did nothing else would burn as 11 hearths, which a place of eight smiths would feel and a place of two does not.
35. **An elite household as buyer adds its custom and no more** (D6; the real map, the elite at the most central village). Wanting 5
    farms' goods: the fullest village 15% at year 60; 20 farms': 15%, with 3.3 maker households at its village as before. Twenty
    farms' worth is 474 rations a year, two maker households' living, and its servant walks to a maker within half a day as any
    household does. Wanting 80 farms' goods and dealing only with makers of its own village (D6b, outside the 5 to 20 of slice 5):
    5.2 maker households there, 25%.
36. **A ship's buyer on known days feeds the makers within a walk of the harbour, not the harbour** (D6). Taking 500, 1,000 and
    2,000 rations' worth a year (the island's farms give its makers about 3,060): the island has 23.7, 24.1 and 26.1 maker households
    against 19.6, the harbour village 2.3, 2.5 and 3.3, the villages within half a day of it 16 to 19, and the fullest village 12%,
    15% and 17%. A maker an hour away carries its cloth to the ship for two hours' walk three days a year; it has no reason to move.
37. **All three together, at parameters near the game's, do not reach a third** (D6). The planned facility, an elite wanting 20
    farms' goods and a ship taking 1,000, both at the harbour: 17% at year 60 (6 seeds). The same with the costly facility: 25% at
    year 30, 24% at year 60, no seed of 10 at a third.

    | The fullest village's share of the island's maker households | Seeds | Maker households, year 60 | At the fullest, year 60 | Year 30 | Year 60 | Seeds at a third, year 60 |
    | --- | --- | --- | --- | --- | --- | --- |
    | None (part two) | 10 | 19.6 | 2.8 | 14% | 14% | 0 |
    | A facility at the planned cost | 10 | 19.0 | 2.4 | 15% | 12% | 0 |
    | A costly facility (2 years, a due) | 10 | 13.9 | 3.1 | 21% | 22% | 1 |
    | An elite household wanting 5 farms' goods | 3 | 22.3 | 3.4 | 15% | 15% | 0 |
    | Wanting 20 | 3 | 22.1 | 3.3 | 15% | 15% | 0 |
    | A ship's buyer taking 500 a year | 3 | 23.7 | 2.8 | 14% | 12% | 0 |
    | Taking 1,000 | 3 | 24.1 | 3.7 | 17% | 15% | 0 |
    | Taking 2,000 | 3 | 26.1 | 4.3 | 16% | 17% | 0 |
    | All together, the facility at the planned cost | 6 | 24.4 | 4.2 | 15% | 17% | 0 |
    | All together, the facility costly | 10 | 18.4 | 4.5 | 25% | 24% | 0 |

38. **What does gather, in the toy: demand at a point that only those who live there can serve** (D6b; all of it beyond what is
    planned). A ship that takes 2,000 only of makers who live at the harbour: 6.2 maker households there, 26%. Taking 4,000, more
    than all the island's farms give its makers: 12.0 there, 41%, 3 seeds of 3 at a third. All together and all at the harbour (a
    costly facility, an elite that deals at home, such a ship taking 2,000): 7.5 there, 36% at year 60, 4 seeds of 5 at a third, but
    24% at year 30: the place is still growing at the end, it was not held. The same with the facility at the planned cost: 29%,
    1 seed of 3. So the lever is whether outside demand can be met from a walk away. Where it can, it raises the country's makers;
    where it cannot (a ship whose day nobody knows, goods too heavy to carry to it, a buyer who deals only with those under its
    roof), it makes a place.

## What the place's measures read (D7)

Over 2,280 to 2,313 village-years (villages of 3 households or more, years 31 to 60, up to 4 seeds):

| Measure | None | A costly facility | All together, the facility costly | A natural cut? |
| --- | --- | --- | --- | --- |
| Outsiders on the green a year: 0, 1 to 2, 3 to 11, 12 to 23, 24 and more | 73%, 13%, 9%, 0%, 5% | 72%, 14%, 8%, 0%, 5% | 69%, 11%, 11%, 4%, 5% | The one of part two, and the facility leaves it alone. The ship's harbour reads 13.8 a year and fills the gap between the two groups: with a ship the cut at 12 falls on a place, and wants looking at again when the ship is planned |
| Dealing days on the green a year: 0, 1 to 2, 3 to 4, 5 to 7, 8 and more | 66%, 28%, 6%, 0%, 0% | 68%, 26%, 6%, 0%, 0% | 63%, 26%, 6%, 5%, 0% | No. Capped by the calendar as before; the ship's three days make the harbour a second kind of host |
| Work that is not farming per 1,000: median, nine in ten under, the most | 259, 325, 525 | 239, 307, 422 | 243, 325, 558 | No. At the fullest place 267, 301 and 396: it rises, smoothly |

So nothing here gives "town" a cut point. The fullest place of the best case reads 396 per 1,000 of its work not farming and 8
outsiders a year on its green, less than a gathering's host (25): its makers sell at their doors and to the ship. A place that held
a third of the makers would be told from the rest by its maker households, a count, and not by any measure the label reads today.

## What reopens the town's design, and whether it happened

The test (`design.md`, What the town waits for): a variant, at parameters within a factor of two of the game's planned costs, in
which the fullest place holds a third or more of the island's maker households and still holds them at year 60, in most of 10 seeds.
Read here as: a facility of up to 0.3 of a year (finding 26), an elite within slice 5's 5 to 20 farms' goods, and a third counted
only at a place of three maker households or more (one maker of three is not a town).

**It did not happen.** No variant within those bounds has a seed at a third: 0 of 10 with the planned facility, 0 of 6 with all three
together. Outside them, a costly facility has 1 seed of 10, and all three with a costly facility 0 of 10. The finding of part two
stands, and the town waits for slice 5 and the ship. Two things are handed on:

- **To the ship's plan:** whether its demand is a point or a district decides whether the ship makes a town (findings 36 and 38). A
  buyer on known days whom any maker within half a day can walk to raises the country's makers by a quarter and the harbour's by one
  household. This mock cannot say which the ship should be; it says the plan must choose, and that the worth it takes must be of the
  order of what the island's farms give its makers (3,000 rations a year at 130 households) before a place holds a third.
- **To slice 6 (the mill and the loom):** nothing to change. Its facilities are cheap, a household builds its own, and they fix where
  a craft is done without gathering anyone. A facility dear enough to matter (a year or more of spare hours) keeps the landless out
  of the craft and turns its builder's heir into a collector of dues (findings 28 and 33); if one is ever planned, that is its price.

## Method (part three)

`move.js`'s run (part two's method, unchanged) with three options, each off by default:

- **A facility.** A maker makes only at a facility of its craft in its village: a bloomery, a kiln, a loom's house. It costs a
  multiple of 959 hours and takes 2, 4 or 8 makers. The six first makers have theirs (the world a run starts with is placed). A
  would-be maker, or a maker thinking of moving, weighs each village as in part two, and now also: a standing facility there with a
  place free (under a due, a fifth off its craft's worth); or one the village would raise (under "the village's", if the work is
  within a tenth of its farms' spare hours for two years, and it has three farms); or one to build itself, the hours spread over 10
  years in its weighing. A builder's spare hours go to the facility first and it sells nothing until it stands; if the build is longer
  than a year's spare hours, it takes what fields it can and must reach 0.85 of its need on fields, garden and cows, or it does not
  go. A facility whose builder's household ends stands, with the heir its owner; under "its builder's only" one newcomer may take
  it up. One nobody uses for 10 years falls in.
- **An elite household** at the most central village (a gathering's host), or at the harbour in the rows that say so: it wants 5, 20
  or 80 farms' worth of iron, pots and cloth, always has the grain to pay, walks and attends as any household, and feeds the makers
  of its village in a lean year (none of them gives up for hunger). "Deals at home": it buys only of makers of its own village.
- **A ship's buyer** on the green of the best-placed village by the sea, summer days 9 to 11: it takes a fixed worth a year, a third
  of each craft, of the makers standing on that green, at the makers' usual worths. A maker within half a day comes if its
  remembered sales there pay the walk, as for any green; it reckons the ship's custom as shared among the makers of its craft who
  can reach it. "Only of those who live there": the reach is the harbour village alone.

The measure is the fullest village's share of the island's maker households, the mean of years 26 to 30 and of years 56 to 60, a
household still building counted. 60 years a run. Seeds: 13, 26, ... (10 for the rows the test rests on, 2 to 6 for the rest, said
in each table); D2 and D3 keep the map's deposits and first makers fixed (their own stream, seed 5) and differ by chance (19, 38,
...). The real map is `populous-small-7-y30` (129 households, 21 villages); D1 adds `populous-medium-7-y0` (136) and the real map at
four times its households. The whole script is some 165 runs, about 0.15 s each on a quiet machine; on the shared machine of the
night it took 73 s with a load of 12 on 4 cores, and each table by `--only` under half of that.

## What was invented (part three; `numbers.js`, `INVENTED.share`, and the options named in `share.js`)

From the game or its plans: the facilities' costs (VB-364: a bloomery 20 hours, 4 loads of stone and 2 of clay; VB-368: a kiln 30
hours and 6 loads of stone; VB-362: a loom 12 hours; the mill 100 to 140 hours), the mill as a thing a village of 3 farms raises,
the 5 to 20 farms' goods of an elite household (slice 5, by the task), and everything part two took.

Invented: that every craft needs a facility (in the game pots are fired in a pit and a loom stands in the house); 959 hours as "a
household's year of spare hours" (the idle hours of a farm's three adults); the multiples above 0.15; the capacities; the due of a
fifth (the mill's toll is 1 in 16); 10 years to spread a build over; 10 years unused before one falls in; a tenth of a farm's spare
hours for two years as what a village gives to common work; that a builder sells nothing until the facility stands; that an heir
keeps it and its due; that one newcomer may take up a private one left standing; that the elite always has grain and feeds its
village's makers; where the elite and the ship are; the ship's three days, its worths (500 to 4,000), its equal thirds, and that
what it cannot spend in a day it carries over by at most a day's worth; that the ship pays in rations at the makers' worths and
brings nothing to sell; the reading of the test (0.3 of a year; three households).

## What remains a toy (part three)

- **A lump on the supply side only.** The facility saves a newcomer the build. It does not make work faster, better or cheaper per
  piece when shared (a kiln fired full, charcoal burnt for several hearths), and since part two's makers are short of buyers and not
  of hours (finding 24), a saving of hours would move little. A facility that makes a *better* good (workmanship, `design.md`, The
  metals and the stones) is not here: a buyer who walks further for a master's work is demand that concentrates, the same lever as
  finding 38, and the likeliest thing this mock leaves out.
- **Goods every farm wants, sold a piece at a time.** Still three goods at fixed worths. Nothing is made of another maker's output
  (a smith's iron for a wright), so no maker is another's buyer; that link is what makes crafts sit together and is slice 6's and
  later slices' to give.
- **The elite is one household with a number.** No retinue, no rent carried in, no feast, no hall that hires. The mock tests its
  purchases only.
- **The ship is a purse.** It sells nothing, brings no one, grants no market, and its harbour is no better a place to live. A
  ship's goods drawing the country's households to the harbour green would add outsiders there (D7), which this cannot show.
- **No people, as before:** would-be makers appear at a made-up rate, which sets how many makers there are; nobody inherits a craft.
- **One map for most tables,** and 2 to 3 seeds in the sweeps. A cell of D4 or D5 moves by a third between seeds.
