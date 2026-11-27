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

### VB-1554: The day's allotment is the largest part of the jobs line: may a task newly due be slotted in, not the day weighed anew? (raised 23 November 2026)
The measure (VB-1554, populous small, seed 7, 2 years): the allotment is 31% of the jobs line and its largest part; a household's day is allotted 4.4 times a day (the morning 1, the milking's opening at 6:00 0.55, the cooking's at 14:00 0.8, the village's review 0.7, its own review 0.4, a member's look 0.5, others 0.5), each time every member against every task. Within the Decided rule ("when its tasks change, every member is weighed for every task") only the village's review could go: dayPair 21.4 to 19.3 a pawn-day, a tenth, not the third the task asked.
1. May a task the due-queue opens (the milking, the cooking, fodder) be weighed alone, each member for that task, and slotted into the lists as they stand, the whole day weighed anew only at the morning, the review and a look? About 30% of the pairs weighed. **P:** yes: the head knows in the morning that the milking and the meal come; the lists otherwise stand, and the call for a task with a deadline stays.
   **A (Kim, 23 Nov):** Yes: a task newly due is slotted in (design.md section 7, The day's work; VB-1558).
2. Or may the morning's allotment move from 5:00 to the start of work at 6:00, after the due-queue has opened the morning's tasks (nobody takes a task before 6:00; the help asked for the day would be asked at 6:00)? About 12%. **P:** no, if 1 is yes: 1 covers it; alone it is too little.
   **A (Kim, 23 Nov):** No, as proposed: the slotting covers it.

### VB-834: Should a busy place drift faster: a term in attitude.malleability? (raised 19 November 2026)
tools/contact.js (populous small, seeds 7, 11, 13, 40 years): villages in the top fifth by distinct people met at venues drift 0.0079 a key a year against 0.0096 for the rest (correlation -0.28); gathering hosts 0.0082 against 0.0095. Contact alone gives no faster drift.
Proposed answers: (a) leave it to contact: no term; (b) add a term to attitude.malleability reading those met at venues, with a range (e.g. 1 to 1.5 times), so a busy place drifts faster by mechanism.

### VB-1892: The take-back of a step first found at risk past its by (raised 27 November 2026)
1. **A step first found at risk only after its `by`: is it taken back at once, or does its author get one review to answer?** VB-1886 found that 8 of the 15 `by` misses on the deadline arm were first found at risk past their `by` (the head's estimate said on time until then), and the other 7 were never weighed between the `by` and the task's end; today the take-back also needs an earlier review to have found the step at risk, so none was taken back. The design says the author is asked, and "unanswered by the deadline" the default author takes over (answer 17: after its deadline).
   **P:** At once, at the first review past the `by`: the `by` was the author's deadline, and a controller that wants the step left marks it kept. The decision point stays open from the first at-risk finding to that review.
2. **May a member's dated step bring its household's review out of turn on its `by` day and the day after?** README 3.5 allows the head's review "out of turn once a day for one cause"; today a slow head reviews every third day, so the deadline can pass two days unweighed.
   **P:** Yes, once a day, only for households with a member on its own plan (no cost in a run where none plans for itself).
3. **Which side of the head's range makes a step at risk?** Today the check uses the estimate's centre (`mid`); README 3.5 makes the head's own range "the band inside which nothing is at risk".
   **P:** Leave the centre for this task (a step past its `by` is at risk whatever the band); the band is a separate change if Kim wants the hysteresis.

### VB-1893: Who may set a load down by a call, and when the called hand is off (raised 27 November 2026)
1. **Who may set a load down by saying so?** The Decided row says "a call sets a load down only when the caller says so, the cost shown first". Calls that send a carrier home today: the head's `dayCall`, a controller's queued `goHome`, an occasion's summons (`sim/occasions`), a pastime at home.
   **P:** Only a command that names `setDown`: the head's call and the pawn's own controller. The rules' summons (occasions, pastimes, drink) never set a load down: they wait for it to be brought in, as the day's end and a lent hand's hours already do (`sim/clock`, `sim/hands`).
2. **Does a member called off while it brings a load in count as off from the call or from the delivery?** The hours of the walk home with the load are booked to the task's owner today (the six parts, VB-1761).
   **P:** From the delivery: the walk with the load is the task's (booked as its work), and the call takes effect when the load is in, as a levied day that ends on the road does (VB-1548).

## Priority 3

### VB-1894: A planner's steps given back when it cannot work: for good, and for any illness (raised 27 November 2026)
1. **When the planner is well again or back, do its steps return to its own plan?** The take-back moves a step to the household's plan for good (VB-1755).
   **P:** No: they stay the household's, as at a take-back; the card says why, and the controller may author them again (a decision point at its next review).
2. **Does an illness of a day or less count?** VB-1758 returns a lost holder's day-list tasks at once whatever the illness's length.
   **P:** Yes, at once, as the day's lists do: the step's author is a controller, and the default author cannot know the illness will be short (The future is someone's estimate).
