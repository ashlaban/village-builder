# Open questions for Kim

Only what Kim alone can answer: a question that moves a Decided point of `design.md`, or lets the player do something no existing
system covers, or that Kim has kept. Everything else an agent decides by `AGENTS.md`, Deciding without Kim, and writes in its task
file. Each question has a proposed answer (**P:**). Answer inline ("yes", "P", or your own answer); the task files are then updated
and set to `ready`, and the question moves, unchanged, to `QUESTION_ARCHIVE.md`. Agents record an answer with
`node tools/questions.js answer` and move it with `archive`; `list` and `show VB-NNN` read this file without reading it whole.

Not here: a shortfall that waits for a tuning run is in `docs/tuning.md`; a question for a later slice is in that slice's plan task
(`backlog/VB-188.md`, `backlog/VB-189.md`).

## Priority 1

### VB-1107: marriage to kin by marriage (raised 16 November 2026)
From the playtest of 16 November (founders small seed 7, 80 years in the page): the round offered a widow of 52 her late husband's son of
23, raised in her house. `kinOk` (`src/sim/matching.js`) judges kin by blood alone, and The gate (Decided, 13 Nov: "keep the gate, add
nothing") allows no other bar; so a step-parent and stepchild, or a parent-in-law and child-in-law, may be matched. Every culture the
setting draws on forbade at least the direct line: Leviticus 18, the Church's prohibited degrees of affinity (to the fourth from 1215),
and the Swedish provincial laws after them.
1. May kin by marriage bar a match, as a reading of the gate's "kin no closer than the custom's limit" and not as a fifth condition?
   **P:** yes, as a custom of its own (principle 5), "Kin by marriage who may marry": none within the Church's fourth degree, none in the
   direct line, or no bar; the Nordic default "none in the direct line". Step-siblings marry under every option. `backlog/VB-1107.md`
   holds the criteria; marriages and growth reported before and after.

## Priority 2

### VB-445: Settling in steps: what the plan decided in your place (raised 16 November 2026)
The plan (`docs/plans/VB-445.md`) and its tasks are built on the proposed answers, and the design text is marked Proposed; strike what you would have otherwise.

1. A new village's distance was Decided on 1 November as 10 to 30 walking steps from home, which were 3.3 to 10 hours then, 2.5 at most at 12 tiles an hour and 3.75 at 8. May it be hours: within 6 hours' walk of the home green, counted along the trail the party blazes, and at least 12 steps from every village's centre? At the journey scale, year 0, within 3.75 hours of pathless ground 1 to 19 villages an island have no site on meadow or forest. **P:** Yes: 6 hours is there and back in a day, so the mother farm can feed the clearing and the daughter comes to the mother's gathering; the 12 steps stay a distance, as room.
2. A small village is joined within 30 walking steps (Decided, 1 November). The same 6 hours, by the villages' table? **P:** Yes.
3. The party no longer moves at the round. The site is staked then; the party's adults blaze, raise a booth, clear and build as members of their old households, which feed them; the household and the village are founded when the roof is on and a field broken. The other way was a household founded at the round with its members lodged at their old homes. **P:** Founded at the move: a household is one place.
4. May a leader choose which of the search's five best sites to stake? A leader not played takes the first; the played pawn would choose, which is a new act for the player. **P:** Yes, as an offer of the round answered within 7 days.
5. (From VB-447.) May the player order a trail? **P:** Yes: `blaze` is a verb any pawn has, for a body it may act for; a party's leader to its site, and a village's trail through its meeting and alderman.
6. (From VB-447.) Does a trail need upkeep beyond being walked? **P:** No. It fades as any wear does, and whoever needs it blazes it again, 1 hour a tile still trodden and 3 where it is gone: that is what makes it cheap and a built road dear.
7. Should a night without a roof cost health as a night in an unheated house does? It makes the winter journeys the design has (the suitor's visit) dearer, and gives the booth its use. **P:** Yes, by the house's own rule and no new number, measured on the journeys that exist before anything depends on it (VB-785).

## Priority 3

### VB-190: roads, boats and ice (slice 10): the plan's proposed answers, on which its design text and tasks are built (raised 16 November 2026)
The plan is `docs/plans/VB-190.md`; the design text is `design.md`, Climate and travel beyond walking, all Proposed. It was written unattended, and its tasks (VB-807 to VB-818) are built on the proposed answers: striking one means rewriting the task named with it.
1. Freeze and thaw dates by latitude. **P:** a world has a latitude, one of four climates (southern 57 degrees, middle 59, northern 62, far north 65); the map's north is 3 degrees colder than its south on medium, read in three bands; a winter has at most six dates a band (frost and snow, lake ice bears, the sound shuts to boats, sound ice bears, the thaw, open water), computed in autumn from one curve and the winter's warmth and taken from a due-queue. A normal winter: none at 57; at 59, snow winter day 2 to spring day 3 and lake ice winter day 5 to spring day 4, sound ice only in a hard winter; at 62, lake ice winter day 2 to spring day 6 and sound ice winter day 7 to spring day 5; at 65, lake ice autumn day 12 to spring day 7. Every figure is from memory (plan, section 3). (VB-807)
2. The capacities of cart, sledge and boat. **P:** carts as Decided (30 on the back, 90, 300); a hand sledge 90 and an ox sledge 450; the small boat (the fishing boat) 150 rations beyond its rower, a passenger counting 40; a large boat 900 or 12 people beyond its crew of 4. (VB-811, VB-812, VB-814)
3. What a cart needs underfoot. **P:** a hand cart crosses open ground (meadow, field, stubble, shore, heath) and other ground only on a path, a lane or a built way; an ox cart open ground but heath, and other ground only on a lane or a built way; neither takes a steep step; marsh only on a causeway. Today a cart goes wherever a walker does. (VB-810)
4. Upkeep duty. **P:** a custom, `wayDuty`, with three options: the village mends its ways on its work days (the start of every culture), each farm keeps a lot in proportion to its fields (the Swedish road lots), or the builder keeps what it built. A neglected stretch is named at the meeting; fines wait for the cases. (VB-815)
5. Desire lines. **P:** a way is built only along a worn way: once a year the alderman reckons, from the crossings counted on its tiles and the loads that went on the back for want of a way, what a stretch would save, and puts to the meeting the one whose saving over 5 years most exceeds its building hours; a cart wears a tile as three walkers do. This generalises your answer of 12 November on where a bridge is built. (VB-815, VB-115)
6. A boat's pace. **P:** 0.5 a tile of water for the small boat (twice a walker's pace on meadow) and 0.35 for the large boat; 3 to put out. target-v2 has 0.35 for every boat. Measured: between the two the pairs of villages within 12 hours move by a tenth to three tenths; where the boat lies matters more. (VB-812, VB-814)
7. A slow cooling over centuries (asked by VB-160). **P:** no. In the curve used, a degree colder is a game day or two off a growing season of 27; the cooling from the 13th to the 17th century is put at half a degree to a degree (from memory), and Swedish tithes follow summer wetness more than warmth (Ljungqvist et al. 2023, as VB-160 read it); it would move every target slowly for little play. If wanted later it is one term of the curve, as a scenario's setting.
8. The gathering on a cold island (this moves a Decided date). **P:** the gathering after the harvest, on winter days 1 to 3 (Decided, 10 Nov), falls in the freeze-up, when boats are laid up and no ice bears, so islands gather apart. The day becomes a custom of the culture with two options, after the harvest (every culture of today) and midwinter (winter days 8 to 10, when the ice bears, as the winter fairs were); the cultures of a northern or far north world start with midwinter. (VB-809)
9. Open water for a small boat. **P:** the sea within 3 tiles of land and any lake; the large boat within 8; wider water is the ship's. At 3, two of four medium islands keep 40 to 42 pairs of villages apart. (VB-812, VB-814)
10. The climate as a choice when a world is made. **P:** yes: four climates beside size, seed and scenario, the middle one the default and the references' (so no target moves); the other climates are reported with no target. (VB-807)
