# VB-1965: why hunger rises in the gate's populous seed 7

The gate (`tools/gate.js`, docs/plans/four-scales/README.md 3.10) reported hungry household-days in populous seed 7 rising across
VB-1906, VB-1767 and VB-1769. This measures each step, names the mechanism from the run's records, and checks seeds 42 and 11.

## How it was measured

`docs/plans/VB-1965-probe.js ROOT SEED` runs the gate's own run (the same map, `Sim.seed`, and tools/accounts.js stepping an hour at a time)
in a commit extracted with `git archive`. It only reads: it gives the gate's hungry household-days exactly (VB-1906's own note has 324
after; the probe gives 324 at fb8ad2ba). Per household and season it keeps the stores at the season's start, fields and fields sown, the
working hours of members 7 and older by task kind, by who opened the leg (`head`, `pawn`, `owed`) and by the task's owner, the idle hours,
the labour budget's fit (short, lowered, demand), the hungry days; and at each year's turn the food ledger of each household hungry that
year. `PERTURB=talk` (or `people`, `work`) draws one number from that stream before the run: the same model, another realisation, a null
perturbation; the four realisations at a commit (none, talk, people, work) are its band. `PERTURB=stories` changes nothing (the
stream is not drawn before year 1), so it is not counted. `docs/plans/VB-1965-sum.js FILE...` prints the lines below; with `VILLAGES=0,7,4` it prints each village's rye in years 4-7 and
hungry days, a line a realisation.

## Seed 7 at each step: four realisations a commit

Hungry household-days (households hungry); deaths by hunger 0 in every run. The commits between the tasks change nothing
(fb8ad2ba = 255c4bfc, 613427af = 3c0cd5db, byte for byte), so each row is the after of one step and the before of the next.

| Commit   | What it is     | Unperturbed | talk     | people   | work     | Mean | Median |
| -------- | -------------- | ----------- | -------- | -------- | -------- | ---- | ------ |
| e4a2b6e4 | before VB-1906 | 224 (10)    | 328 (12) | 243 (9)  | 150 (10) | 236  | 234    |
| fb8ad2ba | after VB-1906  | 324 (14)    | 271 (11) | 363 (15) | 44 (5)   | 251  | 298    |
| 613427af | after VB-1767  | 391 (12)    | 436 (18) | 371 (12) | 337 (13) | 384  | 381    |
| d62bc903 | after VB-1769  | 468 (21)    | 560 (17) | 467 (22) | 106 (12) | 400  | 468    |
| 3f9d7953 | night-base now | 194 (12)    |          |          |          |      |        |

**The rise is real, not noise.** Before VB-1906 the band is 150 to 328; after VB-1769 three of four realisations (467 to 560) lie
above all of it, and the median rises by 234. (The first version of this report read the noise from one perturbed run at two commits
and called the rise noise: that was wrong, and the review's extra realisations showed it.) The `work` realisation is the exception at
every commit: in it village 0 keeps its rye (below), and the after-VB-1906 and after-VB-1769 values (44, 106) are the lowest of all.

**The step that adds most is VB-1767** (+133 in the mean, +83 in the median): its band (337 to 436) lies wholly above the band
before VB-1906 and above three of four realisations after VB-1906. VB-1906 (+15 mean, +64 median) and VB-1769 (+16 mean, +87
median) move the band less than its own spread. Main now (one realisation, 194) is back inside the before-VB-1906 band.

## Where it lands: villages 0 and 7, every realisation

Village 0's rye in years 4-7 and its hungry days, and village 7's hungry days (village 7 has no rye in any run, a constant of the map):

| Commit   | Unperturbed                      | talk                           | people                           | work                              |
| -------- | -------------------------------- | ------------------------------ | -------------------------------- | --------------------------------- |
| e4a2b6e4 | v0 1554/517/1720/1677, 1; v7 201 | v0 543/238/0/229, 155; v7 162  | v0 1554/517/1720/1612, 1; v7 222 | v0 1494/915/941/1299, 0; v7 126   |
| fb8ad2ba | v0 498/235/99/256, 177; v7 121   | v0 242/122/214/95, 121; v7 149 | v0 462/235/102/145, 204; v7 129  | v0 1411/618/1512/1843, 1; v7 42   |
| 613427af | v0 273/195/187/0, 104; v7 271    | v0 111/0/104/274, 122; v7 220  | v0 273/195/187/0, 101; v7 254    | v0 1346/1076/1364/1346, 0; v7 249 |
| d62bc903 | v0 265/110/121/198, 228; v7 211  | v0 152/0/0/0, 343; v7 194      | v0 265/110/121/201, 198; v7 215  | v0 1342/820/1872/1577, 0; v7 55   |
| 3f9d7953 | v0 937/965/1517/1418, 0; v7 160  |                                |                                  |                                   |

Village 0's hunger is all or nothing on its rye: with 900 or more rye a year it has 0 or 1 hungry days, with 300 or less it has 100 to 343. Before VB-1906 it loses its rye in one realisation of four; after VB-1906, VB-1767 and VB-1769 in three of four. **So VB-1906
makes village 0's rye the exception**: the labour budget leaves its autumn sowing 6 to 14 hours a season from year 2 against about 48
before (the unperturbed runs), and the loss holds in each later step. Village 7's hungry days are 126 to 222 before VB-1906, 42 to
149 after it, and **220 to 271 after VB-1767, all four above all four after VB-1906**: VB-1767's addition is in village 7.

## The mechanism

Every realisation has the same weather (its own stream, `st.rng.weather`), and in it years 6 and 7 fail: grain produced island-wide
8,400 to 12,800 against 26,000 to 30,000 in years 2 to 4. The hunger is in years 7 to 10: the harvests of the two failed years are
eaten by the summer of year 7, and a household that ate its seed sows nothing the next spring.

- **What the hungry lacked: food stored.** A hungry household-season starts with 7 (before VB-1906) or 24 (after) grain, against 261
  and 234 for the households not hungry in years 7 to 9 (unperturbed runs). Household 0 (10 members, 11 fields) sowed 150 in spring
  of year 7, harvested nothing, ate 235 of seed (`seedMeal`), and sowed none of its 12 fields in year 8.
- **VB-1906, village 0: the autumn rye.** A village whose rye is sown has grain from the summer harvest before the spring crops fail;
  village 0 without it is a village of spring crops only, as village 7 always is.
- **VB-1767, village 7: food from outside the fields.** In years 6 to 9, a household-season of village 7 after VB-1767 spends 19 to 22
  hours gathering against 20 to 31 before it, 13 to 17 fishing against 16 to 18, and 11 to 13 hours on wood, which is not among its
  seven largest kinds before; it starts the season with 112 to 117 grain against 124 to 132, and is idle 273 to 287 hours against 282
  to 357. This is a measured association across three realisations each side, not yet traced to VB-1767's code: which wood task
  is new for village 7 and whose it is (an obligation's term, sim/levies) is left for the mend's task to read.
- **Not the levy's hours.** Hours owed to outer levies in village 7 are 1.2 to 1.7 a household-season before and after VB-1767; across
  the island the hungry households owed 2.4% of their work. VB-1769 doubles the island's owed share (1.06% to 2.23%), a day or two a
  household a season.

## Seeds 42 and 11

| Seed | e4a2b6e4 (before VB-1906) | perturbed (talk) | fb8ad2ba (after VB-1906) | 613427af (after VB-1767) | d62bc903 (after VB-1769) | Now |
| ---- | ------------------------- | ---------------- | ------------------------ | ------------------------ | ------------------------ | --- |
| 42   | 153                       | 167              | 155                      | 88                       | 149                      | 223 |
| 11   | 118                       | 110              | 84                       | 58                       | 53                       | 119 |

Deaths by hunger 0 in all. Neither seed rises across the three steps (42: 153 to 149; 11: 118 to 53), one realisation a commit.
Each has its own failed year (seed 42: year 8; seed 11: year 9), and its hunger follows in villages with no rye (seed 42: villages 2
and 4; seed 11: villages 7, 0 and 2). The failed-year mechanism is common to the seeds; **the rise across the steps is seed 7's**:
its failed years come early and in pairs, so a village that loses its rye or its food from outside the fields pays inside the gate's
ten years.

## The mend proposed

The rise is real, about +150 to +230 household-days from before VB-1906 to after VB-1769, and main now is back in the before band
in its one realisation. Two tasks are noted, and the third follows from the step that adds most:

- **The gate's hunger as a band** (VB-1972, ready): the gate prints hungry household-days beside their spread over perturbed
  realisations of the base and of the task. Its spread must be read from four realisations a side, not two: one or two give a band
  that hides a rise like this one.
- **A seed loan before sowing** (VB-1973, Kim's question): design.md (Loans, slice 5) makes seed corn after a failed year the first
  loan and leaves its repayment open; it would end the second hungry year in every seed.
- **VB-1767's wood hours in village 7**: not yet a task, since main now no longer shows the rise; noted as a candidate to measure
  at main with four realisations before any mend is chosen.
