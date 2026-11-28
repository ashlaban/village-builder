# VB-1965: why hunger rises in the gate's populous seed 7

The gate (`tools/gate.js`, docs/plans/four-scales/README.md 3.10) reported hungry household-days in populous seed 7 rising across
VB-1906, VB-1767 and VB-1769. This measures each step, names the mechanism from the run's records, and checks seeds 42 and 11.

## How it was measured

`docs/plans/VB-1965-probe.js ROOT SEED` runs the gate's own run (the same map, `Sim.seed`, and tools/accounts.js stepping an hour at a time)
in a commit extracted with `git archive`. It only reads: it gives the gate's hungry household-days exactly (VB-1906's own note has 324
after; the probe gives 324 at fb8ad2ba). Per household and season it keeps the stores at the season's start, fields and fields sown, the
working hours of members 7 and older by task kind, by who opened the leg (`head`, `pawn`, `owed`) and by the task's owner, the idle hours,
the labour budget's fit (short, lowered, demand), the hungry days; and at each year's turn the food ledger of each household hungry that
year. `PERTURB=talk` draws one number from `st.rng.talk` before the run: the same model, another realisation, the null perturbation
the noise band is read from. `docs/plans/VB-1965-sum.js FILE...` prints the lines below.

## Seed 7 at each step

| Commit | What it is | Hungry household-days | Deaths by hunger | Households hungry |
| --- | --- | --- | --- | --- |
| e4a2b6e4 | before VB-1906 | 224 | 0 | 10 |
| e4a2b6e4, perturbed | the same, one draw of `talk` | 328 | 0 | 12 |
| fb8ad2ba | after VB-1906 | 324 | 0 | 14 |
| fb8ad2ba, perturbed | the same, one draw of `talk` | 271 | 0 | 11 |
| 255c4bfc | before VB-1767 | 324 | 0 | 14 |
| 613427af | after VB-1767 | 391 | 0 | 12 |
| 3c0cd5db | before VB-1769 | 391 | 0 | 12 |
| d62bc903 | after VB-1769 | 468 | 0 | 21 |
| 3f9d7953 | night-base now (after VB-1768 and others) | 194 | 0 | 12 |

The step that adds most is VB-1906 (+100). The commits between the tasks change nothing (fb8ad2ba = 255c4bfc, 613427af = 3c0cd5db,
byte for byte). The null perturbation moves the before commit by +104 and the after commit by -53: **the size of every step is inside
the spread of one realisation**. Before VB-1906 the two realisations give 224 and 328, after it 324 and 271. No step shows a rise that
the noise does not show as well, and main now is below all of them.

## The mechanism (seed 7, VB-1906's runs)

Every realisation has the same weather (its own stream, `st.rng.weather`), and in it years 6 and 7 fail: grain produced island-wide
8,600 to 12,600 against 27,000 to 29,000 in years 2 to 4. The hunger is in years 7 to 9 of every run (224 of 224 days before VB-1906,
298 of 324 after): the harvests of two failed years are eaten by the summer of year 7.

- **Who**: the households of the villages that grow spring crops only. Village 7 has no rye in any run and is among the two worst in
  all four seed-7 realisations. Village 0 goes hungry exactly in the realisations where it stopped sowing winter rye: before VB-1906
  it sowed rye each autumn (about 48 hours of autumn sowing a year, rye 1,720 in year 6) and had 1 hungry day; after it, it sowed
  6 to 14 hours an autumn from year 2 (rye 99 in year 6) and had 177; in the perturbed before run its rye fell to 0 in year 6 and it had
  155. Whether a village keeps its autumn rye is the realisation's, not the step's. The hungry households are larger than the mean
  (5.8 members against 5.2 after VB-1906).
- **When**: the seasons equally (82/86/91/65 days, spring to winter, after VB-1906): once the grain is gone, a household is hungry every
  day until a harvest or a gift.
- **What they lacked: food stored.** A hungry household-season starts with 7 (before) or 24 (after) grain, against 261 and 234 for the
  households not hungry in years 7 to 9. Their ledgers show the seed sown and then eaten: household 0 (10 members, 11 fields) sowed
  150 in spring of year 7, harvested nothing that year, ate 235 of seed (`seedMeal`), and sowed nothing in year 8 (0 of 12 fields sown
  at summer's start), so year 8 was hungry too, though it got gifts (68, 47) and loans (90, 20), which it ate. It came out in year 9
  on gifts of 146 and loans of 230.
- **Not hours.** Hungry household-seasons were idle 54% of their working hours after VB-1906 (70% before), against 51% (49%) for the
  rest; they worked as many hours (277 against 274). The budget was rarely short for them.
- **Not the levy.** Hours owed to outer levies were 2.4% of the hungry households' work (2.1% before) against 1.2% for the rest: about
  6 hours a season. VB-1769 doubles the island's owed share (1.06% to 2.23%), which is still a day or two a household a season.

## Seeds 42 and 11

| Seed | Before VB-1906 | Perturbed | After VB-1906 | Now (3f9d7953) |
| --- | --- | --- | --- | --- |
| 42 | 153 | 167 | 155 | 223 |
| 11 | 118 | 110 | 84 | 119 |

Deaths by hunger 0 in all. The perturbation moves seed 42 by +14 and seed 11 by -8; VB-1906 moves them by +2 and -34: no sign
shared with seed 7. Each seed has its own failed year in its weather (seed 42: year 8, grain 6,000 to 8,000 against 21,000 to 33,000;
seed 11: year 9, 4,800 to 5,500 against 23,000 to 38,000), and the hunger follows it in years 9 and 10, in villages with no rye (seed 42:
villages 2 and 4; seed 11: villages 7, 0 and 2). The cause is not seed 7's alone: it is a failed year in a village of spring crops,
the seed eaten, and the next year unsown. Seed 7's failed years come earlier and in pairs, so its hunger is larger and lands inside the
gate's ten years in full.

## The mend proposed

The rise is not a mend's to undo: no step moves hunger outside the spread of one realisation, and labour is not what the hungry lack.
Two tasks are noted:

- **The gate's hunger as a band** (ready): the gate prints hungry household-days and deaths by hunger beside their spread over two
  perturbed realisations of the base and of the task, so that a task is not charged with the noise (a +100 here is noise).
- **A seed loan before sowing** (needs Kim's answer, filed as a question): design.md (Loans, slice 5) makes seed corn after a failed
  year the first loan and leaves its repayment open. A household that ate its seed sows nothing the next spring although its village
  holds grain and its idle hours would sow it; a loan of seed set aside for the sowing (not eaten) would end the second hungry year.
