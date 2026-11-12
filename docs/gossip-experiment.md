# The gossip experiment: stories against opinion averaging (VB-187, 12 November 2026)

Before stories are built (Kim's decision 21: model B, stories, after the experiment), a reduced scenario compares them with the
baseline of opinion averaging by the three probes and the bands of `docs/architecture/target-v2.md`, section 10.2. The tool is
`node tools/gossip.js` (`--help`; `--sweep` for the sensitivities); it loads no module of `src/` and touches nothing in the game.
Every number below is from `node tools/gossip.js` and `node tools/gossip.js --sweep` at seeds 1 to 10 (a few checks at 1 to 20), the
median over the seeds and [min, max]; the same seed gives the same numbers.

## In short

- **Stories meet the spread bands and the lie bands; averaging meets only its own.** Under stories the own village mostly knows within
  a season (0.86 [0.45, 1.00], 8 of 10 seeds), the fair's other village within a year (0.98, 9 of 10), the unjoined island never
  (10 of 10); a slander with three living witnesses reaches fewer than the true story (0.90 against 0.98 of A and B, 10 of 10) and its
  counter-story reaches more than the lie (0.96, 10 of 10). Averaging spreads faster and further (1.00 in A by day 12), forgets
  nothing, cannot expose a lie, and makes strangers judge the subject as harshly as the witness (-0.60, against -0.19 under stories).
- **Forgetting is the weak band, and a cliff.** Under the default half-life (a game year untold) only 4 of 10 seeds have the story
  mostly forgotten by year 3 (held by 0.55 of its peak); at 40 days 10 of 10 (0.12), at 96 none. A village that heard and retold a
  story together forgets it together, within a few days: a cohort, not a curve.
- **Saturation decides when talk ends, and so everything after it.** Without it (`stifle` 1) the story is never forgotten; with more
  talk (`tellP` doubled) it saturates sooner and is forgotten sooner (0.06). And a story from spring is stale by the winter gathering:
  an island joined by ice hears it in only 3 of 10 seeds (in 8 of 10 when the story is six days old).
- **The alehouse, not the gathering, carries a story to the neighbouring village.** The share of goers changes nothing; halving B's
  visits to A's alehouse drops the fair-village band to 7 of 10. A story that starts just after the gathering still reaches B within
  the year (0.98, 10 of 10).
- **Polarisation cannot be tested here** (one story, one subject, four people with the other view): no extremes, no split, under both
  models. That band waits for the game.

## The scenario, and every choice in it

The documents give the calendar (a season is 12 game days, a year 48; the gathering on winter days 1 to 3, at most 6 new contacts a
goer; islands gather apart: `design.md`, The gathering) and the shape of model B (target-v2 4.4, Stories). Everything else is this
experiment's choice, printed by the tool as `parameters` and changeable with `--set`:

| Choice | Value | Why |
|---|---|---|
| Villages | A 10 households, B 8, C 8; 2 to 4 adults a household (about 29, 24 and 24 adults) | A tiny map's villages; A hosts the gathering and the alehouse |
| Geography | A and B on one island; C on another, joined only with `link ice` (C's households go to the gathering) | Band 1's three cases |
| Household talk | each pair of adults once a day | |
| Village talk (well, green, fields) | 1.5 conversations an adult a day, with a random adult of the village | Not in the task's list; without it B and C have no talk outside the house |
| Alehouse, in A | an adult of A goes on a day with chance 0.25 × (0.5 + sociability), of B 0.08 × (...); 2 conversations there | "Alehouses mix villages" (`design.md`, Markets and towns) |
| Gathering | winter days 1 to 3 in A; each household sends its first adult and others by sociability (0.4 × ...), one adult stays; 6 contacts a goer | `design.md`, The gathering |
| Traits | sociability and honour, uniform 0..1 | The two traits target-v2 gives to gossip and to judging lies |
| Ties | 0.9 in the household, 0.5 in the village, 0.2 elsewhere | No game ties; a stand-in for opinion of the teller |
| The story | a breach by the smith (subject, in A), valence -0.6, witnessed by one pawn of another household of A, who tells it (the source); day 0 is spring day 1 | |
| The lie | the same story invented by the same pawn; the subject and three customers (two in A, one in B) hold a first-hand good memory of him (+0.6) | "A slander with a living witness to deny it", of the same kind as the true story |
| A talk | in each conversation each side tells a story with chance `tellP` 0.3, picking a held story by weight \|valence\| × zeal × memory × 1.3 if negative × (1 + hearer's tie to the subject) against `background` 1 for other topics | The design's pick, "by salience, the hearer's tie to the subject ... how often told" |
| Saturation | telling a story to someone who holds it multiplies the teller's zeal by 0.5; below 0.05 he stops; the hearer is reminded | Daley and Kendall's stifling, softened |
| Distortion | the told valence is the teller's × 1.08, plus noise of sd 0.05, within -1..1; the teller's own version does not change | Sharpening along a chain (Allport and Postman) |
| Belief | chance 0.6 + 0.5 × (trust - 0.5) + 0.5 × fit, where trust is the tie plus half the hearer's opinion of the teller and fit the hearer's opinion of the subject times the story's sign | "By its opinion of the teller and the story's fit" |
| Memory | strength halves every 48 days untold (first-hand: 144); forgotten under 0.2; refreshed to 1 by telling or hearing it again; at most 8 stories a pawn | See the sources |
| Opinion of the subject | first-hand memories plus each held story's valence × 0.8 per hop × strength, within -1..1 | "A secondhand memory ... discounted by belief and hops" |
| Exposure | a lie told to someone with a first-hand memory of the subject of the other sign is not believed; the hearer starts (or holds first-hand) the counter-story about the liar, valence -min(1, 0.6 × 1.5 × (0.5 + honour)); the teller stops telling the lie and is told the counter-story | Kim's decision 23, weighed by the hearer's honour |
| Averaging (the baseline) | the same meetings and the same chance and weight of raising the subject (no zeal, no memory); an unaware hearer takes the teller's opinion, an aware one moves 0.3 of the way to it (DeGroot) | The simplest model of "opinion averaging"; the customs' anchored version (Friedkin and Johnsen) would only slow it |

The meetings are drawn from their own seeded stream, so for a seed both models hear the same conversations in the same order; the
population from another; each model's choices from a third.

### Grounding the story model

- **Retelling.** About two thirds of conversation time is on social topics (Dunbar, Marriott and Duncan 1997, *Human Nature* 8); a
  pawn tells a story about a third party in 0.3 of its talks, and the subject must win against other topics, so a fresh story is
  passed on in about one talk in six. Negative news is more often passed on (Bebbington, MacLeod, Ellison and Fay 2017, *Evolution
  and Human Behavior* 38): the weight 1.3. Saturation: in Daley and Kendall's rumour model (1965) a spreader who meets a knower becomes
  a stifler, which leaves about a fifth of a well-mixed population unaware; with the softer stifling here (zeal halves) nearly
  everyone in a village of 30 hears.
- **Distortion.** Serial reproduction levels (detail falls away) and sharpens (what is kept becomes starker) (Bartlett 1932,
  *Remembering*; Allport and Postman 1947, *The Psychology of Rumor*); transmission chains make information more negative (Bebbington
  et al. 2017), while social information is passed on more faithfully than other kinds (Mesoudi, Whiten and Dunbar 2006, *British
  Journal of Psychology* 97). None gives a rate per hop for village gossip: 8% and a small noise are a choice, and only valence is
  modelled, not detail.
- **Forgetting.** Diary studies of one's own life find slow loss, a few per cent of events a year (Linton 1975) to about a fifth
  unrecalled after a year without cues (Wagenaar 1986, *Cognitive Psychology* 18); oral tradition survives by retelling, not by
  memory alone (Rubin 1995, *Memory in Oral Traditions*). Hearsay about others has no such measure. A first-hand memory three times as
  durable as a heard one, and a heard story's half-life of one game year, are choices that put the forgetting band at its edge.
- **Compression.** A game year has 48 days, so a game day of talk stands for about a week of a real year. The literature's rates are per
  real time; the bands are per game season and year. Rates per talk (retelling, sharpening) transfer; rates per day do not.

## Results

### The bands of target-v2 10.2, both models, seeds 1 to 10

| Band | Measure | Stories | In band | Averaging | In band |
|---|---|---|---|---|---|
| Own village knows within a season | share of A holding at day 12 > 0.5 | 0.86 [0.45, 1.00] | 8/10 | 1.00 [1.00, 1.00] | 10/10 |
| Fair's villages know within a year | share of B at day 48 > 0.5 | 0.98 [0.00, 1.00] | 9/10 | 1.00 [1.00, 1.00] | 10/10 |
| An island hears nothing unjoined | share of C, at most | 0 | 10/10 | 0 | 10/10 |
| ... and only once ice joins it | C hears nothing before the gathering it attends | | 10/10 | | 10/10 |
| ... C knows 12 days after (story from day 0; day 30) | reported | 0.00 [0, 0.92]; 0.85 [0, 0.92] | 3/10; 8/10 | 1.00; 1.00 | 10/10 |
| Untold story mostly forgotten within 3 years | holders at day 144 / peak < 0.5 | 0.55 [0.35, 0.64] | 4/10 | 1.00 | 0/10 |
| Slander with a witness spreads less | reach (ever held) of A and B, lie < true | 0.90 [0.02, 0.95] against 0.98 [0.58, 1.00] | 10/10 | 1.00 against 1.00 | 0/10 |
| Exposed lie's counter-story further | reach of counter-story > lie | 0.96 [0.94, 0.98] | 10/10 | no counter-story | 0/10 |
| The baseline converges | sd of holders' opinion at day 144 < 0.05, both cases | 0.07 [0.06, 0.09] | 0/10 | 0.00 [0.00, 0.01] | 10/10 |
| The baseline forgets nothing | holders at day 144 / peak = 1 | 0.55 | 0/10 | 1.00 | 10/10 |
| No extremes (Proposed) | share of held opinions at \|0.8\| or beyond, at most, < 0.25 (my threshold) | 0.00 | 10/10 | 0.00 | 10/10 |
| No village splits (Proposed) | days a village has 20% above 0.3 and 20% below -0.3 | 0 | 10/10 | 0 | 10/10 |

At seeds 1 to 20 the stories' column holds: 18, 17, 20, 9, 20 and 20 of 20 for the first six bands.

### Probe 1: the spread curve (median share of each village's adults holding the true story)

| Day | 1 | 3 | 6 | 12 | 24 | 36 | 40 | 48 | 96 | 144 | 192 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Stories, A | 0.07 | 0.21 | 0.54 | 0.86 | 0.97 | 1.00 | 1.00 | 1.00 | 1.00 | 0.52 | 0.04 |
| Stories, B | 0 | 0 | 0.08 | 0.64 | 0.98 | 0.98 | 0.98 | 0.98 | 0.98 | 0.58 | 0 |
| Averaging, A | 0.09 | 0.45 | 0.91 | 1.00 | 1.00 | ... | | | | | 1.00 |
| Averaging, B | 0 | 0 | 0.06 | 0.89 | 1.00 | ... | | | | | 1.00 |

The lie under stories: A 0.66 at day 12 and 0.89 at day 48, B 0.02 and 0.89, then 0.34 and 0.57 at day 144; its counter-story A 0.86
and B 0.19 at day 12, 0.96 and 0.96 at day 48. Exposures: 13 [1, 21] a run; in one seed the lie met a witness at once and died (reach
0.02).

### Probe 2: distortion (valence held / valence at the source, at day 48, true story)

| Hops | 0 | 1 | 2 | 3 | 4 | 5 | 6 or more |
|---|---|---|---|---|---|---|---|
| Stories, median | 1.00 | 1.07 | 1.17 | 1.25 | 1.38 | 1.51 | 1.67 (the bound, -1) |
| Averaging | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |

Most holders are three or more hops from the source by the year's end. Averaging copies one source exactly; it moves only where
opinions differ (the lie case), and then towards the mean.

### Probe 3: strangers' opinion of the subject (mean over B's adults, holders or not)

| | Day 12 | Day 48 | Day 144 | Lie, day 48 |
|---|---|---|---|---|
| Stories | -0.12 [-0.30, 0] | -0.19 [-0.27, 0] | -0.03 [-0.05, 0] | -0.07 [-0.26, 0.03] |
| Averaging | -0.54 [-0.60, -0.26] | -0.60 | -0.60 | -0.56 [-0.58, -0.35] |

Under stories a stranger's opinion is a third of the witness's, by the hop discount and belief, though the valence held has sharpened,
and it fades with the story; under averaging a stranger holds the witness's verdict for ever.

### Sensitivity (`--sweep`: each parameter halved and doubled, stories, seeds 1 to 10)

Seeds in band, of 10, for the first six bands (own village, fair village, island, forgotten, lie less, counter-story further):

| Parameter | Halved | Default 8 9 10 4 10 10 | Doubled | What moves |
|---|---|---|---|---|
| `tellP` (0.3) | 2 9 10 0 10 10 | | 10 7 10 10 8 9 | Speed, and forgetting the wrong way: more talk saturates sooner and forgets sooner (kept 0.06) |
| `villageTalks` (1.5) | 9 8 10 0 10 10 | | 10 10 10 10 10 10 | The same |
| `background` (1) | 10 9 10 10 10 10 | | 6 8 10 0 10 10 | The same; at 0.5 the lie reaches 0.52 (exposed sooner) |
| `stifle` (0.5) | 8 9 10 6 6 8 | | 10 10 10 0 10 10 | Without saturation (1) nothing is forgotten |
| `halfLife` (48 days) | 8 9 10 7 8 10 | | 9 9 10 0 9 10 | Forgetting: at 40 days 10/10 (0.12), 36 10/10, 32 9/10 |
| `forgetAt` (0.2) | kept 1.00, 0/10 | | kept 0.02, 10/10 | Forgetting, as the half-life |
| `belief0` (0.6) | 4 3 10 0 8 9 | | 10 10 10 9 10 10 | Everything: at 0.3 B hears in 3/10 |
| `beliefTie` (0.5) | lie 0.69 | | forgetting 0/10 | The lie's reach |
| `aleB` (0.08) | fair village 7/10, lie 0.71 | | 10/10 | B's link to A |
| `aleA` (0.25) | 8 7 10 3 8 10 | | 10 9 10 7 8 9 | Little |
| `sharpen` (0.08) | lie 0.81 | | lie 0.72 | Little on the bands; the valence by hop |
| `hopDiscount` (0.8) | strangers -0.01 | | strangers -0.70, extremes 0.54 | Strangers' opinion and extremes only |
| `witnesses` (3) | 1: lie 0.95, counter further 5/10 | | 6: lie 0.58 | The lie bands |
| `goerShare`, `fitW`, `trustOp`, `lieJudge` | no change | | no change | Not exercised by one story (the gathering comes after B already knows) |

`negBias` is left out: with one story it only scales against `background`, as `background` does.

## What the scenario can show, and what it cannot

It can show how the mechanisms of model B shape spread, distortion and forgetting against a baseline on identical meetings, and which
parameters the bands hang on. It cannot:

- **test polarisation.** One story about one subject, with four people of the other view, cannot split a village; the band needs many
  stories, many subjects and kin camps, that is the game;
- **test confirmation.** Fit only acts where the hearer already has an opinion of the subject; here that is the four witnesses, so
  `fitW` changes nothing measurable;
- **test the pick among stories.** With one story (and a counter-story) the cap and the salience order never bind, and negativity
  bias equals less background talk;
- **give real rates.** The meeting rates, ties and population are stand-ins; no game ties, no deaths or moves, no service, no traits
  but two. The bands are met or missed at values that are themselves choices, so the result is a ranking of sensitivities and a set of
  mechanisms that do or do not produce a band, not calibrated numbers;
- **test Vosoughi, Roy and Aral (2018).** The lie spreads less only because witnesses deny it; with one witness it reaches 0.95 to the
  true story's 0.98, and its counter-story outruns it in only 5 of 10 seeds. A crowded town without witnesses is not modelled.

## Questions for Kim (also in `QUESTIONS.md`, for the talk plan, VB-186)

1. Model B as decided: averaging fails the forgetting, lie and counter-story bands by construction and makes strangers judge as
   witnesses do. **P:** stories for gossip; averaging stays for attitudes (customs), where it is the agreed mechanism.
2. Saturation per audience. A story from spring is stale by the winter gathering (an island joined by ice hears it in 3 of 10 seeds),
   because its tellers lost zeal at home. **P:** a held story keeps two zeals, for its own village and for others, so news is told
   afresh at the gathering and the alehouse; or the gathering's "breach ... told in every village that was there" covers only stories
   of the gathering itself, and other news crosses water only while fresh.
3. Forgetting as a cohort. A village forgets a story within a few days, since it was last reminded together. **P:** a heard story's
   half-life of 40 game days (10 of 10 seeds in band), first-hand three times as long, and a per-pawn spread (a trait, wits, or a
   seeded factor of 0.5 to 1.5), so forgetting is a curve.
4. The band's measure of forgetting. **P:** "mostly forgotten" is held by under half of those who held it at the peak, three years on.
5. Sharpening and the hop discount go together: without the discount (1 per hop) 54% of held opinions reach the extremes. **P:** keep
   both, sharpening 8% a hop on the told valence and a discount of 0.8 a hop on the memory it writes; extremes under 0.25 and a split
   (20% on each side of 0.3) as the Proposed band's measures, checked in slice 7's wrap-up on the game.
6. The alehouse carries news between neighbouring villages, not the gathering. **P:** tune the fair-village band on the alehouse's draw
   from neighbouring villages, and let the gathering matter for villages without one.
7. Belief is the most sensitive parameter (at 0.3 base belief, B hears in 3 of 10 seeds). **P:** a base of 0.6, raised by the tie
   and opinion of the teller as here; to be fitted in the wrap-up.

## Cost, for slice 7

Per talk: the teller's held stories (at most 8) are weighed; per hearer: one lookup, and on a lie one lookup of first-hand memories by
subject. Forgetting is lazy (strength in closed form; a story is dropped when read below the line), as cost rule 3 asks; this tool's
daily sweep is for its probes only. Memory: at most 8 known stories a pawn, each a few numbers.
