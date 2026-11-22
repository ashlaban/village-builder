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


## Priority 3

### VB-834: Should a busy place drift faster: a term in attitude.malleability? (raised 19 November 2026)
tools/contact.js (populous small, seeds 7, 11, 13, 40 years): villages in the top fifth by distinct people met at venues drift 0.0079 a key a year against 0.0096 for the rest (correlation -0.28); gathering hosts 0.0082 against 0.0095. Contact alone gives no faster drift.
Proposed answers: (a) leave it to contact: no term; (b) add a term to attitude.malleability reading those met at venues, with a range (e.g. 1 to 1.5 times), so a busy place drifts faster by mechanism.
