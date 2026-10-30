# Open questions for Kim

Questions that block backlog tasks or shape the design, gathered in one place, in priority order. Each has a proposed answer (**P:**). Answer inline (for example "yes", "P", or your own answer); the task files are then updated and set to `ready`. Answered questions move, unchanged, to `QUESTION_ARCHIVE.md`.

The questions marked "review" come from the review of 30 October 2026; the reasons and numbers behind them are in `REVIEW.md` and in `design.md`, "Systems overview".

## Priority 1

### VB-080: a food balance before animals (review)
A household of 6 eats 192 rations a year with four young children and 288 when all are over 14. A meadow field gives about 78 in an ordinary year, less 20 of seed: three fields about 170, four about 230. In the populous scenario a quarter of household-days in year 2 are hungry, and 9 people die of hunger in 4 years.
1. Should a family be fed from its own fields in an ordinary year before animals exist? **P:** yes: `fieldYield` 100 and seed 25 (4:1 kept), so a field gives about 72 after seed; three fields then give about 218 and four about 290.
2. Should the populous generator give households of 7 or more a fourth field? **P:** yes, where a farmable tile is free within 2 steps of the house.
3. When milk and meat arrive (VB-048), is the yield tuned down again so animals fill part of the need? **P:** yes; 100 is a starting value for the years before animals.

### VB-076: commands (review)
The command system is Decided but not built: `planRound` matches and `start` acts in one step. Herds and a player role depend on it.
1. What is a command? **P:** a record of actor, verb, target and arguments, issued by a source (the planner, the player, a debug tool, the meeting); the simulation carries out commands and nothing else. First verbs: `work(job)`, `walkTo(tile)`, `goHome`, `idle(until)`.
2. The first step? **P:** the job matcher issues `work` commands instead of calling `start`, with no change in behaviour (golden file unchanged); the other sources follow in their own tasks.
3. Direct control? **P:** "Take control" on the pawn panel; the player then chooses the next command from a list (open jobs the pawn may take, walk to a clicked tile, go home), and the planner leaves that pawn alone until released.
4. Meetings, the moving round and debug actions as commands? **P:** yes, after the first step: the meeting issues `decide(custom, option)`; kill, retire and argue become debug commands.
5. Herds as command takers wait for the animals arch. **P:** yes.

## Priority 2

### VB-079: the player's role (review)
The largest open question. The options are not exclusive:
- (a) Watch and nudge: the player uses the advocacy slot to argue for customs, as the debug tools do today.
- (b) Follow a family line: the player acts through the head of one line, as that pawn's source of commands (choose work, court, claim, argue at the meeting), and carries on as the heir when the head dies, as in Crusader Kings III.
- (c) Steward: the player marks where to clear, which tiles to claim and what comes first, and pawns follow if their customs allow.
1. Which role? **P:** (b). The player's pawn sways customs as in (a), by arguing at the meeting with the weight of its prestige, and the player plans the land of its own household as in (c).
2. When the line dies out? **P:** the player picks a living relative, or anyone in the line's village; a run ends only when no one is left.
3. A goal or a score? **P:** none needed: a chronicle of the line, plus optional ambitions (hold three farms, change a custom, found a village).
4. When is it built? **P:** after commands (VB-076) and saving (VB-077); its plan writes the tasks then.

### VB-077: saving and loading in the page (review)
1. Where are saves kept? **P:** an autosave in the browser (IndexedDB) at each moving round and when the page is hidden, keeping the last 3; "Save to file" and "Load file" buttons for a JSON file, which is also how a bug report carries a run.
2. A save from another build? **P:** a save names its format version; one from another version is refused with a message, not converted, until the game has players.
3. Is the world saved or regenerated? **P:** regenerated from seed and size, with the tiles the simulation changed (trees, stones, biome, development) saved as arrays.

### VB-036: courting, the numbers (follow-up to the answers in `QUESTION_ARCHIVE.md`)
Courting builds on relationships (VB-060) and talk (VB-061). These numbers let the courting tasks be written.
1. When does courting start? **P:** for two unmarried pawns of 16 or more, of opposite sex, not barred by the marriage limit, with a tie of at least 1.5 and an opinion of at least 0.4: a chance of 2% a day. Each pawn courts one person at a time.
2. When does it end? **P:** when either's opinion of the other falls below 0, when either marries someone else, or by a chance of 1% a day once they have courted a year without being able to marry.
3. When do they marry? **P:** on any day once both are of age (18 and 20), have courted at least 12 days, have a place to live and hunger below 0.5: a chance of 5% a day. The yearly matchmaking in the moving round then goes.
4. Births while courting? **P:** a courting woman conceives at 0.1 times a married woman's chance, tuned in the wrap-up (VB-040) so that about 5% of births are outside marriage; after such a birth the couple marries at 3% a day under the same gates, about 3 in 4 within the year.

### VB-081: populous households with adult children (review)
Populous children are spaced 2 years from age 0–2, so the eldest is at most 14: 818 people and no marriage in years 1–3.
1. Should some households start with adult children? **P:** yes: children 2–3 years apart, the eldest up to 26 as the mother's age allows (at least 19 at the eldest's birth, at most 44 at the youngest's), so about a third of households have a child of 18 or more. Still two generations, no grandparents.

### VB-082: customs made legible (review)
1. The meeting log? **P:** each change shows the support for the old and the new option and the margin needed ("Any child 46% against Sons first 31%; needed 25% more"); a custom within 5% of changing is noted as "nearly changed".
2. The pawn panel? **P:** a "Leans" line with the customs where the pawn differs most from its village's practice, and the cause it argues for, if any.
3. Announcements? **P:** a pawn taking up a cause and a change of practice are shown as a toast and kept in the record of events (VB-075).

## Priority 3

### VB-067: empty fields and scrub (review)
1. Empty farms' fields turn to scrub after 8 years everywhere; the design says near woodland. **P:** until forest spread exists (with grazing, in the animals arch), only fields within 2 steps of a forest tile go to scrub; others stay grass.

### VB-083: seasons on the map (review)
1. Should the map show the seasons? **P:** yes: a tint per season over the painted land (fresh green in spring, full in summer, ochre and russet on broadleaf and meadow in autumn, bare broadleaf in winter; pine stays green), and snow on land from winter day 2 to spring day 3 with lakes iced over. After the Chromium test (VB-025).

### VB-084: speed (review)
1. At 10× a 150-year run takes about 10 hours, much of it uneventful. **P:** add 30× and "until something happens": the highest speed the frame rate allows until a notable event (a death, birth or marriage in the selected pawn's family, a change of practice, a farm emptied), then 1×. The simulation costs about 13% of a core at 30× on populous medium.

### VB-088: a performance budget (review)
1. **P:** steady state under 10% of real time at the fastest speed on populous medium at seed 7 (0.5 s of simulation per game day at 10×), and no single 6-minute step, meeting or moving round over 50 ms. `tests/perf.js` reports both in `npm run verify` and fails above twice the budget.

### VB-047: animals and husbandry (follow-up to question 2)
Answered so far (see `QUESTION_ARCHIVE.md`): roe deer first; not every founders farm keeps animals; at least one bull and one ram; farms with sheep keep 4 ewes; milk, meat, byre and task order accepted.
1. How many of the four founders farms keep cattle, and how many sheep? **P:** three keep cattle (2 cows each, and the first of them also a bull); two keep sheep (4 ewes each, and the first of them also a ram). One farm keeps neither and has to trade or marry into a herd.
2. Do cattle farms keep a pair of oxen at the start? **P:** one pair in the whole founders group, at the farm with the bull; the other farms hoe until they raise oxen from bull calves (castrated at 1 year, working from 3). This keeps the "ard is 2–3× faster than a hoe" advantage visible from year 1.

### Design points without a task (review)
1. Firewood: the design says winter use is about four times summer; the code uses 5.3 (1.6 against 0.3). **P:** keep the code and write "about five times" in the design, since VB-024 measures woodland use with it.
2. Walking ignores terrain: crossing mountains costs the same as meadow. **P:** when pathfinding moves to regions (HPA\*), cost by terrain: meadow and heath 1, forest 1.5, hills and marsh 2, mountains 3, snowfields closed; the same costs slow walking.
