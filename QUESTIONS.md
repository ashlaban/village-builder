# Open questions for Kim

Only what Kim alone can answer: a question that moves a Decided point of `design.md`, or lets the player do something no existing
system covers, or that Kim has kept. Everything else an agent decides by `AGENTS.md`, Deciding without Kim, and writes in its task
file. Each question has a proposed answer (**P:**). Answer inline ("yes", "P", or your own answer); the task files are then updated
and set to `ready`, and the question moves, unchanged, to `QUESTION_ARCHIVE.md`. Agents record an answer with
`node tools/questions.js answer` and move it with `archive`; `list` and `show VB-NNN` read this file without reading it whole.

Not here: a shortfall that waits for a tuning run is in `docs/tuning.md`; a question for a later slice is in that slice's plan task
(`backlog/VB-188.md`, `backlog/VB-189.md`).

## Priority 1

## Priority 2

### VB-356: crops and rotations, after the wrap-up (raised 22 November 2026)
The long runs (`node tools/crops.js`: populous small 4 seeds 30 years, founders small 15 seeds 50 years, heirs 2 seeds 30 years; numbers in
`backlog/VB-356.md`). None of the peas' numbers nor the crops' readings of the weather has a source (design.md, The first crops, Crops and the
weather); the shortfalls are rows of `docs/tuning.md` (Crops, VB-356).
1. Crops do not follow new farms: farms in three courses fall from 50% to 29% of populous farms over 30 years and barley alone rises from 21%
   to 50% (founders: 40% to 70% over 50 years); of the 246 barley-only farms at populous' end, 189 were founded after year 1 and 101 lie in a
   village that holds rye seed. A new farm takes a rotation only with a field's seed of each crop, and a start in life carries grain in the
   giver's proportion, rarely a field's seed of rye. Should a start in life (a settler's grain, a restored farm's, a cottage's) carry a field's
   seed of each crop of the farm it comes from? **P:** yes, the seed counted inside the grain it brings, not added to it, so no food appears;
   a task under the crops' arch, measured by the share of farms by rotation (band `mixed-farms`).
2. The peas fade: 469 pea fields sown in populous against 30,487 of barley, below a field's seed on 3 of 4 seeds at the end, lost to the
   island in founders seed 15 (an emptied island) and heirs seed 42; the backup farm kept them on 14 of 15 founders seeds. Their numbers
   (60 a field, 20 of seed, 3:1) are guesses. **P:** keep them until VB-048 retunes a farm's food; a tuning run may try 70 and 3.5:1, the band
   `crops-lost` its measure.
3. The hedge is real but small in hunger: barley's yield a sown field correlates with rye's at 0.15 (populous), -0.03 (founders), -0.13
   (heirs), and with the peas' at 0.10 and 0.00; in the same village-years, farms sowing one crop were hungry in 0.06% of years against 0.04%
   (populous), 0.43% against 0 (founders). Across all years barley-only farms are hungrier (0.96% against 0.03%; 1.31% against 0), since they
   are the new, small farms. **P:** no change: the mix is worth having and the weather's readings stand as starting values until slice 10.
4. Barley loses a field to the frost on 24% of populous farm-years and 38% of founders' (rye and peas never), with VB-354's timing. **P:** the
   tuning row "The seasons' timing" (VB-354) settles it; no threshing for winter (design.md, What crops touch): the autumn is not crowded by
   it (the harvest is the peak of the fields' hours, summer of all hours).

### VB-1541: The day's allotment is the largest part of the jobs line: may a task newly due be slotted in, not the day weighed anew? (raised 23 November 2026)
The measure (VB-1541, populous small, seed 7, 2 years): the allotment is 31% of the jobs line and its largest part; a household's day is allotted 4.4 times a day (the morning 1, the milking's opening at 6:00 0.55, the cooking's at 14:00 0.8, the village's review 0.7, its own review 0.4, a member's look 0.5, others 0.5), each time every member against every task. Within the Decided rule ("when its tasks change, every member is weighed for every task") only the village's review could go: dayPair 21.4 to 19.3 a pawn-day, a tenth, not the third the task asked.
1. May a task the due-queue opens (the milking, the cooking, fodder) be weighed alone, each member for that task, and slotted into the lists as they stand, the whole day weighed anew only at the morning, the review and a look? About 30% of the pairs weighed. **P:** yes: the head knows in the morning that the milking and the meal come; the lists otherwise stand, and the call for a task with a deadline stays.
   **A (Kim, 23 Nov):** Yes: a task newly due is slotted in (design.md section 7, The day's work; VB-1545).
2. Or may the morning's allotment move from 5:00 to the start of work at 6:00, after the due-queue has opened the morning's tasks (nobody takes a task before 6:00; the help asked for the day would be asked at 6:00)? About 12%. **P:** no, if 1 is yes: 1 covers it; alone it is too little.
   **A (Kim, 23 Nov):** No, as proposed: the slotting covers it.

### VB-1540: Standing duties: which gives way, the memory or the haymaking checks (raised 23 November 2026)
The mechanism of design.md section 7, Standing duties, is built and tested (`tests/duties.js`, at the proposed 1.25), and ships with `MATCH.keep` at 1: no memory, and a duty the head sets weighs nothing. On the merged branch every value above 1 turned a hard check red: `tests/hay.js` (populous 3 small: 89% of meadows mown and carried by autumn day 4 at 1.05, 1.1 and 1.2, 86% at 1.15 in a trial; 90 asked, 92% at keep 1) and `tests/meadows.js` (founders 42: a farm with animals and no meadow by its second spring, at 1.1, 1.2 and 1.25). Hands that keep to yesterday's type come later to work that opens with a season. A trial that counted every task with a window or of a project as held by all (so duties decide only among the standing chores) did not mend it (1.1: both red; 1.15: hay 86%; 1.25: meadows red), and was reverted.

1. Does the memory go live before the haymaking is retuned? **P:** No: keep stays 1 until the tuning run, which raises it to 1.25 together with the haymaking's urgency (`MATCH.urgency.mowPerDay`, `rake`) so that `tests/hay.js` holds its 90%; VB-1542 and VB-1543 are built against the mechanism at 1.25 in their tests, as `tests/duties.js` is.
2. Or is the bound of `tests/hay.js` (90% in by autumn day 4) the one to move, the memory being worth three points of it? **P:** No: the hay is what the animals winter on; the check stands.
3. While keep is 1, should the Plan tab offer the head's Set and Lift buttons, which then change the record and the card's line but no one's day? **P:** Yes, as built: the choice is kept and shown ("set by the head") and weighs from the day keep is raised; say if they should be hidden until then.

## Priority 3

### VB-834: Should a busy place drift faster: a term in attitude.malleability? (raised 19 November 2026)
tools/contact.js (populous small, seeds 7, 11, 13, 40 years): villages in the top fifth by distinct people met at venues drift 0.0079 a key a year against 0.0096 for the rest (correlation -0.28); gathering hosts 0.0082 against 0.0095. Contact alone gives no faster drift.
Proposed answers: (a) leave it to contact: no term; (b) add a term to attitude.malleability reading those met at venues, with a range (e.g. 1 to 1.5 times), so a busy place drifts faster by mechanism.
