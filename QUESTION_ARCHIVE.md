# Answered questions

Questions from `QUESTIONS.md` that Kim has answered, kept as the record behind the task files and `design.md`. Each section keeps its questions, the proposed answer (**P:**) and Kim's answer (**A:**) as they stood when answered; the task files hold what was decided. A question moves here, unchanged, once it is answered; newer archives go on top.

# Archived 30 October 2026 (discussion of all open questions)

## Priority 1

### VB-080: a food balance before animals (review)
A household of 6 eats 192 rations a year with four young children and 288 when all are over 14. A meadow field gives about 78 in an ordinary year, less 20 of seed: three fields about 170, four about 230. In the populous scenario a quarter of household-days in year 2 are hungry, and 9 people die of hunger in 4 years.
1. Should a family be fed from its own fields in an ordinary year before animals exist? **P:** yes: `fieldYield` 100 and seed 25 (4:1 kept), so a field gives about 72 after seed; three fields then give about 218 and four about 290.
   **A (Kim, 30 Oct):** as proposed (P). Also (new): the health drain falls from 9 to 4 × h² a day, so a starving adult dies in about 25 days, not 12; with both, populous seed 7 loses 7 to starvation in year 2 instead of 427.
2. Should the populous generator give households of 7 or more a fourth field? **P:** yes, where a farmable tile is free within 2 steps of the house.
   **A (Kim, 30 Oct):** yes, but the generator places a farm's fields as one contiguous shape within 4 tiles of the house; they need not be next to it. This holds for all generators and all farms; a field made in play prefers a tile touching the block within 4 steps, and only if none is free starts a new block (new task VB-109).
3. When milk and meat arrive (VB-048), is the yield tuned down again so animals fill part of the need? **P:** yes; 100 is a starting value for the years before animals.
   **A (Kim, 30 Oct):** as proposed (P).

### VB-076: commands (review)
The command system is Decided but not built: `planRound` matches and `start` acts in one step. Herds and a player role depend on it.
1. What is a command? **P:** a record of actor, verb, target and arguments, issued by a source (the planner, the player, a debug tool, the meeting); the simulation carries out commands and nothing else. First verbs: `work(job)`, `walkTo(tile)`, `goHome`, `idle(until)`.
   **A (Kim, 30 Oct):** as proposed (P).
2. The first step? **P:** the job matcher issues `work` commands instead of calling `start`, with no change in behaviour (golden file unchanged); the other sources follow in their own tasks.
   **A (Kim, 30 Oct):** as proposed (P).
3. Direct control? **P:** "Take control" on the pawn panel; the player then chooses the next command from a list (open jobs the pawn may take, walk to a clicked tile, go home), and the planner leaves that pawn alone until released.
   **A (Kim, 30 Oct):** as proposed (P).
4. Meetings, the moving round and debug actions as commands? **P:** yes, after the first step: the meeting issues `decide(custom, option)`; kill, retire and argue become debug commands.
   **A (Kim, 30 Oct):** as proposed (P).
5. Herds as command takers wait for the animals arch. **P:** yes.
   **A (Kim, 30 Oct):** as proposed (P).

## Priority 2

### VB-079: the player's role (review)
The largest open question. The options are not exclusive:
- (a) Watch and nudge: the player uses the advocacy slot to argue for customs, as the debug tools do today.
- (b) Follow a family line: the player acts through the head of one line, as that pawn's source of commands (choose work, court, claim, argue at the meeting), and carries on as the heir when the head dies, as in Crusader Kings III.
- (c) Steward: the player marks where to clear, which tiles to claim and what comes first, and pawns follow if their customs allow.
1. Which role? **P:** (b). The player's pawn sways customs as in (a), by arguing at the meeting with the weight of its prestige, and the player plans the land of its own household as in (c).
   **A (Kim, 30 Oct):** as proposed (P).
2. When the line dies out? **P:** the player picks a living relative, or anyone in the line's village; a run ends only when no one is left.
   **A (Kim, 30 Oct):** relatives only (by blood or marriage); with none left, the run ends.
3. A goal or a score? **P:** none needed: a chronicle of the line, plus optional ambitions (hold three farms, change a custom, found a village).
   **A (Kim, 30 Oct):** a prestige score: the line's prestige over time is the score, shown in the chronicle, with the optional ambitions as well.
4. When is it built? **P:** after commands (VB-076) and saving (VB-077); its plan writes the tasks then.
   **A (Kim, 30 Oct):** as proposed (P).

### VB-077: saving and loading in the page (review)
1. Where are saves kept? **P:** an autosave in the browser (IndexedDB) at each moving round and when the page is hidden, keeping the last 3; "Save to file" and "Load file" buttons for a JSON file, which is also how a bug report carries a run.
   **A (Kim, 30 Oct):** as proposed (P).
2. A save from another build? **P:** a save names its format version; one from another version is refused with a message, not converted, until the game has players.
   **A (Kim, 30 Oct):** refused with a message, as proposed, but the page makes it easy to delete the save and start a new game.
3. Is the world saved or regenerated? **P:** regenerated from seed and size, with the tiles the simulation changed (trees, stones, biome, development) saved as arrays.
   **A (Kim, 30 Oct):** save everything: the whole world is saved, so a save does not depend on the generator staying the same.

### VB-089: the heir-to-their-own-farm rule as a custom (backlog review)
The design makes the rule a custom (Decided) with two options; the default and malleability are Proposed. The code hard-codes "steps behind".
1. Default and malleability? **P:** as the design proposes: "Steps behind" for Old Nordic and both heirs-scenario villages, malleability 0.6.
   **A (Kim, 30 Oct):** as proposed (P).
2. "Keeps their place, so farms may be combined": no household can hold two farms, and someone who already holds a farm is passed over (Agreed). **P:** under "keeps" the heir keeps their place in the other line; if they take that farm, they drop out of their own parents' line, which passes to the next in it. Farms are never actually combined until a household can hold two farms, which needs its own design.
   **A (Kim, 30 Oct):** the heir with places in two lines takes the farm with more fields and drops the other claim, which passes to the next in that line.
3. Self-interest? **P:** the first heir of their home leans "keeps" (it widens their chances); a landless adult leans "behind" (it keeps a farm open for them).
   **A (Kim, 30 Oct):** as proposed (P).

### VB-090: service where labour is short (backlog review)
Today only founders' and populous servants, and the members of a farm that dies out, live as servants. A landless adult stays at home for life.
1. What is "labour is short"? **P:** hands per field, counting members aged 14–59 who are not retired: short below 1 hand per field, hands to spare above 1.5. Meadows and herds join the count with the animals arch.
   **A (Kim, 30 Oct):** as proposed (P).
2. Who moves, and where? **P:** at the moving round, unmarried landless adults (in `st.demand`) from households with hands to spare, oldest first, as long as their household keeps at least 1 hand per field. They go to the shortest household of their own village, else of the nearest village within 15 steps, else they stay. Each household takes at most one new servant a year.
   **A (Kim, 30 Oct):** as proposed (P).
3. Pay? **P:** board and lodging only; wages wait for money.
   **A (Kim, 30 Oct):** as proposed (P).
4. Does hunger also send people into service (a hungry household sending out a mouth)? **P:** not in this task; reconsider in the food or courting wrap-up.
   **A (Kim, 30 Oct):** as proposed (P).

### VB-036: courting, the numbers (follow-up to the answers in `QUESTION_ARCHIVE.md`)
Courting builds on relationships (VB-060) and talk (VB-061). These numbers let the courting tasks be written.
1. When does courting start? **P:** for two unmarried pawns of 16 or more, of opposite sex, not barred by the marriage limit, with a tie of at least 1.5 and an opinion of at least 0.4: a chance of 2% a day. Each pawn courts one person at a time.
   **A (Kim, 30 Oct):** as proposed (P).
2. When does it end? **P:** when either's opinion of the other falls below 0, when either marries someone else, or by a chance of 1% a day once they have courted a year without being able to marry.
   **A (Kim, 30 Oct):** as proposed (P).
3. When do they marry? **P:** on any day once both are of age (18 and 20), have courted at least 12 days, have a place to live and hunger below 0.5: a chance of 5% a day. The yearly matchmaking in the moving round then goes.
   **A (Kim, 30 Oct):** as proposed for couples who court, but the yearly matchmaking at the moving round stays for pawns who are not courting (arranged marriages).
4. Births while courting? **P:** a courting woman conceives at 0.1 times a married woman's chance, tuned in the wrap-up (VB-040) so that about 5% of births are outside marriage; after such a birth the couple marries at 3% a day under the same gates, about 3 in 4 within the year.
   **A (Kim, 30 Oct):** as proposed (P).
5. Children born outside marriage inherit how? The design proposes a custom with three options: inherit like other children; inherit after children born in marriage; do not inherit. **P:** as the design proposes: default "after children born in marriage", malleability 0.5. Self-interest: a pawn born outside marriage leans "like other children"; a married heir with half-siblings born outside marriage leans "after". The custom is its own task, written with the courting tasks.
   **A (Kim, 30 Oct):** as proposed (P).

### VB-081: populous households with adult children (review)
Populous children are spaced 2 years from age 0–2, so the eldest is at most 14: 818 people and no marriage in years 1–3.
1. Should some households start with adult children? **P:** yes: children 2–3 years apart, the eldest up to 26 as the mother's age allows (at least 19 at the eldest's birth, at most 44 at the youngest's), so about a third of households have a child of 18 or more. Still two generations, no grandparents.
   **A (Kim, 30 Oct):** as proposed (P).

### VB-082: customs made legible (review)
1. The meeting log? **P:** each change shows the support for the old and the new option and the margin needed ("Any child 46% against Sons first 31%; needed 25% more"); a custom within 5% of changing is noted as "nearly changed".
   **A (Kim, 30 Oct):** as proposed (P).
2. The pawn panel? **P:** a "Leans" line with the customs where the pawn differs most from its village's practice, and the cause it argues for, if any.
   **A (Kim, 30 Oct):** as proposed (P).
3. Announcements? **P:** a pawn taking up a cause and a change of practice are shown as a toast and kept in the record of events (VB-075).
   **A (Kim, 30 Oct):** as proposed (P).

### VB-102: several hands on one field job (jobs review)
A job takes one pawn; in spring 69% of adults' idle time is spent with no open job they may take, while plowing waits up to 27 hours (90th percentile).
1. How many hands per job? **P:** plow, clear and break 2; reap 3 (one cuts, others bind and stook); weed 2; thresh 2 (flails in pairs); sow, haul, wood, water, cook and mend 1.
   **A (Kim, 30 Oct):** basically the whole household can take part, with priorities by role: plow, sow, weed, reap, haul, thresh, clear and break take any number of workers; cook, water, wood and mend stay one pawn per job.
2. Does each extra hand work at full rate? **P:** yes, for now; crowding losses wait for the wrap-up (VB-108) to show whether they are needed.
   **A (Kim, 30 Oct):** as proposed (P).
3. How strongly is a free job preferred to joining one? **P:** a bid for a job with k workers is multiplied by 0.8^k.
   **A (Kim, 30 Oct):** as proposed (P).

### VB-103: any allowed work beats idling (jobs review)
110 of 119 open wood jobs on a summer evening could get no farmer's bid: urgency is about 0.1 with a full pile, and the walk costs more.
1. A floor for the bid? **P:** 0.1 plus the noise, for role priority 3 or more; poor fits (2 or less) keep the 2-hour wait and get no floor.
   **A (Kim, 30 Oct):** as proposed (P).
2. Firewood for the winter? **P:** from summer day 0 to the end of autumn the target is 40 (winter use about 19, autumn's 6, and a margin), 30 the rest of the year.
   **A (Kim, 30 Oct):** as proposed (P).

### VB-104: children's work (jobs review)
Kim decided: from 7, at reduced efficiency. The numbers:
1. Which jobs? **P:** water 6, weed 5, haul 4, reap 3; adults' priorities stay higher.
   **A (Kim, 30 Oct):** as proposed (P).
2. Rate by age? **P:** 0.3 at 7, plus 0.1 a year, 0.9 at 13; full rate with the adult role at 14.
   **A (Kim, 30 Oct):** as proposed (P).
3. Do girls and boys differ before 14? **P:** no; the roles split at 14 as today.
   **A (Kim, 30 Oct):** as proposed (P).

### VB-105: daylight by season (jobs review)
Kim decided: daylight changes with the season; night is a fixed, short (compressed) block of game hours.
1. The night? **P:** 21:00 to 05:00, home and indoors.
   **A (Kim, 30 Oct):** as proposed (P).
2. The day length? **P:** 12.25 + 6.25 × cos(2π (doy − 15) / 48) hours, at most the 16 hours outside the night, centred on 13:00: about 10–16 at midwinter, 5–21 at midsummer, 8–18 at the start of spring.
   **A (Kim, 30 Oct):** as proposed (P).
3. Work from sunrise to sunset, with no midday rest? **P:** yes; the midday meal is not modelled. Average work hours rise from 10 a day to about 12.
   **A (Kim, 30 Oct):** as proposed (P).

## Priority 3

### VB-091: forest spread (backlog review)
Forest spread is Decided, but open land never closes today. Grazing pressure is planned in the animals arch (VB-047).
1. Does spread wait for grazing? **P:** yes: it is built after the grazing-pressure task, so the land the founders need is not overgrown before anything can keep it open. Until then VB-067 covers empty fields.
   **A (Kim, 30 Oct):** as proposed (P).
2. How fast? **P:** open tiles next to forest, or to scrub at half cover or more, reach scrub (a quarter of full cover) in 8 years and full forest in 30, the same 30 years as regrowth. The front then advances about one tile in 15 years.
   **A (Kim, 30 Oct):** as proposed (P).
3. What keeps land open? **P:** a field in use, a house, a green, a hay meadow mown that year, work on the tile in the last year, or grazing pressure at or above a "keeps open" threshold; pressure at or above a higher "thins" threshold removes scrub slowly. The thresholds are set in the grazing task.
   **A (Kim, 30 Oct):** as proposed (P).
4. Does heath close too? **P:** yes, like meadow; heath was kept open by grazing and burning.
   **A (Kim, 30 Oct):** as proposed (P).

### VB-092: store views (backlog review)
Store views for every level of entity are Decided; the scope model (VB-043) is Agreed.
1. First version? **P:** households and villages, as for the overlay filters; families, cultures and pawns later.
   **A (Kim, 30 Oct):** as proposed (P).
2. Where is it shown? **P:** a "Stores" panel opened from the village and household panels: one row per household, a total row and the village store, food in days of the household's need, updated once a game day.
   **A (Kim, 30 Oct):** as proposed (P).
3. History? **P:** not in the first version; the household ledger stays in the household panel.
   **A (Kim, 30 Oct):** as proposed (P).

### VB-093: a village windmill (backlog review)
Milling at a mill is Decided (much faster, often village-owned, built as a commons job); rivers do not exist, so the first mill is a windmill. It comes after the quern (VB-009) and building (VB-032).
1. When does a village build one? **P:** at the moving round, a village of 3 or more farms with no mill and a free open tile within 6 steps of the green, hills preferred.
   **A (Kim, 30 Oct):** as proposed (P).
2. Hours and materials? **P:** foundation 20 h with 10 loads of stone, frame 80 h with 20 loads of timber, sails and millstones 40 h: 140 h, a little more than a cottage, as "likely dearer to build" suggests.
   **A (Kim, 30 Oct):** as proposed (P).
3. How fast? **P:** 1 work hour per 20 grain, 5 times the quern; a household walks there with its grain and carries flour home, and uses the quern when the walk costs more than it saves.
   **A (Kim, 30 Oct):** as proposed (P).
4. Other villages? **P:** a household of another village within 10 steps may mill for a toll of 1 in 16 of its grain, paid into the owning village's store.
   **A (Kim, 30 Oct):** as proposed (P).
5. Wind? **P:** ignored in the first version: the mill turns every day.
   **A (Kim, 30 Oct):** as proposed (P).

### VB-094: worn paths (backlog review)
Proposed in the Systems overview; no task yet.
1. Thresholds and fade? **P:** one count per crossing, halving each game year; trodden at 50, path at 200, lane at 800 (about 1, 4 and 16 crossings a day, kept up).
   **A (Kim, 30 Oct):** as proposed (P).
2. Do lanes speed walking? **P:** not now: they are only drawn. Revisit with terrain costs for routes (see "Design points without a task", question 2).
   **A (Kim, 30 Oct):** as proposed (P).
3. Lanes under snow (VB-083)? **P:** lanes stay visible as trodden snow; paths and trodden ground are covered.
   **A (Kim, 30 Oct):** as proposed (P).

### VB-067: empty fields and scrub (review)
1. Empty farms' fields turn to scrub after 8 years everywhere; the design says near woodland. **P:** until forest spread exists (with grazing, in the animals arch), only fields within 2 steps of a forest tile go to scrub; others stay grass.
   **A (Kim, 30 Oct):** as proposed (P).

### VB-083: seasons on the map (review)
1. Should the map show the seasons? **P:** yes: a tint per season over the painted land (fresh green in spring, full in summer, ochre and russet on broadleaf and meadow in autumn, bare broadleaf in winter; pine stays green), and snow on land from winter day 2 to spring day 3 with lakes iced over. After the Chromium test (VB-025).
   **A (Kim, 30 Oct):** as proposed (P).

### VB-084: speed (review)
1. At 10× a 150-year run takes about 10 hours, much of it uneventful. **P:** add 30× and "until something happens": the highest speed the frame rate allows until a notable event (a death, birth or marriage in the selected pawn's family, a change of practice, a farm emptied), then 1×. The simulation costs about 13% of a core at 30× on populous medium.
   **A (Kim, 30 Oct):** 30× and an uncapped speed (as fast as the frame budget allows), ready now; no run-until-event mode.

### VB-088: a performance budget (review)
1. **P:** steady state under 10% of real time at the fastest speed on populous medium at seed 7 (0.5 s of simulation per game day at 10×), and no single 6-minute step, meeting or moving round over 50 ms. `tests/perf.js` reports both in `npm run verify` and fails above twice the budget.
   **A (Kim, 30 Oct):** as proposed (P).

### VB-047: animals and husbandry (follow-up to question 2)
Answered so far (see `QUESTION_ARCHIVE.md`): roe deer first; not every founders farm keeps animals; at least one bull and one ram; farms with sheep keep 4 ewes; milk, meat, byre and task order accepted.
1. How many of the four founders farms keep cattle, and how many sheep? **P:** three keep cattle (2 cows each, and the first of them also a bull); two keep sheep (4 ewes each, and the first of them also a ram). One farm keeps neither and has to trade or marry into a herd.
   **A (Kim, 30 Oct):** as proposed (P).
2. Do cattle farms keep a pair of oxen at the start? **P:** one pair in the whole founders group, at the farm with the bull; the other farms hoe until they raise oxen from bull calves (castrated at 1 year, working from 3). This keeps the "ard is 2–3× faster than a hoe" advantage visible from year 1.
   **A (Kim, 30 Oct):** as proposed (P).

### VB-106: help between households (jobs review)
Kim decided: help between households is allowed, and it builds relationships.
1. Which jobs? **P:** plow, sow, weed, reap, haul, thresh, clear, break and mend; not cook, water or wood, which are the household's own.
   **A (Kim, 30 Oct):** as proposed (P).
2. When may a neighbour help? **P:** the job has waited 2 hours, the helper is an adult (14 or more) of the same village and has no bid on its own household's or village's jobs in that round.
   **A (Kim, 30 Oct):** as proposed (P).
3. Whom do they help first? **P:** bid × 0.5, plus 1 for near kin of the holder, plus the helper's opinion of the holder.
   **A (Kim, 30 Oct):** as proposed (P).
4. What does help build? **P:** per finished job, tie +0.2 and opinion +0.05 × (1 − opinion) between the helper and each adult of the household; nothing is owed.
   **A (Kim, 30 Oct):** as proposed (P).

### VB-107: interrupts (jobs review)
1. When does a pawn leave its job? **P:** when the best other bid is more than 1.5 × the current job's bid plus 1, checked at every full hour, at most one switch an hour.
   **A (Kim, 30 Oct):** as proposed (P).
2. May a pawn walking to a job switch? **P:** no; only pawns at work, not walking or carrying.
   **A (Kim, 30 Oct):** as proposed (P).

### Design points without a task (review)
1. Firewood: the design says winter use is about four times summer; the code uses 5.3 (1.6 against 0.3). **P:** keep the code and write "about five times" in the design, since VB-024 measures woodland use with it.
   **A (Kim, 30 Oct):** as proposed (P).
2. Walking ignores terrain: crossing mountains costs the same as meadow. **P:** when pathfinding moves to regions (HPA\*), cost by terrain: meadow and heath 1, forest 1.5, hills and marsh 2, mountains 3, snowfields closed; the same costs slow walking.
   **A (Kim, 30 Oct):** as proposed (P).

# Archived 30 October 2026 (jobs review)

## Work and jobs (become the work arch, VB-101 to VB-108)

1. What is the job system for: something to watch, or something the player steers (per-pawn priorities, forced jobs)? **P:** decided by the player's role (VB-079).
   **A (Kim, 30 Oct):** player-steerable, but that comes later; the player should be able to influence the world a lot, through all the systems.
2. May children work before animals exist, beyond "children herd"? If so, from what age? **P:** from about 7, at reduced speed.
   **A (Kim, 30 Oct):** yes, from 7, at reduced efficiency.
3. May neighbours help with each other's work? As a gift that builds ties, or as a debt that is paid back? **P:** a gift that raises the tie.
   **A (Kim, 30 Oct):** allowed; it builds relationships.
4. Should daylight change with the season, or are clock hours abstract under the compression? **P:** daylight by season.
   **A (Kim, 30 Oct):** daylight changes with the season, but the part of the day that is night stays fixed (and compressed).
5. Is that night a fixed short block of game hours, or a night played faster on screen? **P:** none.
   **A (Kim, 30 Oct):** a fixed short block of game hours; sunrise and sunset move by season in the rest of the day, and work follows daylight.

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
