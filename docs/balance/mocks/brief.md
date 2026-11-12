# Balance map: shared brief for the mock experiments

The village builder (repo `/home/user/village-builder`, read `AGENTS.md` there for tools) is a simulation of a medieval Nordic peasant
society on a hex archipelago, about 1,000 living pawns late in the game. Its designer, Kim, wants **one static diagram** that helps reason
about game balance at the macro scale: which mechanisms push on which balance properties, in what way (steady push, balancing loop,
reinforcing loop), how strongly (range), and how fast (lag). We have collected four "cards" of mechanisms and drawn draft 3 of that map
(`../balance-map.html`, a causal loop diagram). Kim suspects **we may not have the right abstractions yet**. These experiments explore the
balance space with small mock models to find out which perspectives are actually useful for tuning. The mocks are throwaway research
code in Python (numpy, scipy, matplotlib, pandas are installed); they are not game code. Do not change, commit or push anything in the repo.

## Kim's vision (decided)

- End game on a medium map: about 1,000 living, split **600 farming / 325 town and specialised / 75 elite** (12 to 15 elite households).
  Held by balance loops, never by a cap. A deliberate choice: far more urban than history (80 to 90% farmed).
- Growth mostly by births and deaths. Immigration and emigration very limited and mostly fixed (a merchant, an elite with a retinue,
  a settling family; an elite recruiting young adults for service).
- Starts as a primitive frontier society (a few founding homesteads) and grows into a city-state with satellite villages. 10 to 1,000
  people takes about 150 game years (5 generations).
- Barter with decaying goodwill first; silver later, from ships; a tax asked in silver drives monetisation.
- Two distinct cultures on a map, most different in the mid to late game, converging in the very late game. Like-seeks-like should work
  through **opinion**: pawns whose customs differ think less of each other (not through an ad hoc distance penalty). Hardship should
  push on customs directly. Some scenarios start with different customs.
- Land use is not a tunable: it fills toward about 95% of the map in a mature economy.
- "Reach by water" (boats, ice, roads) is **not a lever** in Kim's view. It may be a condition or a phase of the game instead.

## Balance properties on draft 3 (what Kim tunes toward)

| Property | Target | Today in the game |
|---|---|---|
| Population | about 1,000 (medium map) | populous small doubles in 40 years (352 to 729) |
| Food produced (per farming household, over its own need, after seed and spoilage) | 1.67 follows from the split; more to carry bad years | 1.1 to 1.6, falling as the island fills |
| Share extracted (rent, tithe, tax, interest, owed labour) | not set; about 40% of output must leave the farm by extraction and sale together | 0 |
| Food kept per head (hunger when below need) | above the floor for most households | uneven; single-person households hungry beside full barns |
| Goodwill in circulation | not set | booked, made only by help in hunger |
| Idle hours | no limit set; enough must remain for subsistence after owed work | 55 to 79% of adult hours |
| Town and craft share | 325 of 1,000 (fewer if farmers' slack hours make goods) | 0 |
| Elite share | 75 of 1,000 | 0 |
| Land concentration (land Gini, tenancy share) | a band, unset | 0 tenancy |
| (card 6, not drawn) Spread of customs between villages, number of cultures | two cultures; peak difference mid to late game | calibrated drift only |

## Where a farm's food goes (the surplus split)

Eaten (kept), **taken** (rent, tithe, tax), **feasted** (ale, gifts in good years: builds goodwill and standing), **sold** (for goods, later
silver), **rots** (a sink). Animals as stored wealth are a sixth outlet, not yet discussed.

## Loops and pushes on draft 3

- **B1 marriage valve:** more people per farm, fewer homes with means, later and fewer marriages, fewer births. Lag: a generation.
  Built as a gate only (marriage needs a home that can feed another mouth); marriage ages are fixed at 18 (women) and 20 (men).
- **B2 hunger check:** more people, less food produced per farmer as land fills, less kept, more deaths (and conception stops). Lag: a season. Built.
- **B3 kin help:** a short household asks kin once a season; the gift is booked as goodwill; one who owes gives back more readily. Built.
- **B4 town sink:** the unmarried and landless move to town, where crowding breeds disease and deaths outrun births. Planned; disease is not designed.
  Town size settles near `M / (d - b)` (migrants a year over its excess of deaths over births) and cannot exceed `S / c` (surplus reaching it over need a head).
- **B5 brakes on estates:** debtors vote the debt custom toward labour, heirs split land, tenants leave, gossip thins the creditor's voice. Planned. Slow (decades).
- **B6 feasting:** a good year's surplus is feasted and given; guests owe goodwill, which returns as help and standing. Ale for standing is built; goodwill from feasts is proposed.
- **R1 estates and the squeeze:** where help falls short a household borrows (a quarter interest); two unpaid harvests make a case; a field passes
  (one a hearing) and the old family stays as tenant paying a quarter of the harvest plus 2 days' labour; concentrated land raises the share extracted, which lowers what is kept. Planned (slice 5).
- **R2 trade:** goods from town and fair give farmers a reason to produce past need; surplus sold feeds the town. Planned. Has a low and a high resting point.
- **R3 money:** a tax asked in silver makes farms sell; less is left to feast. Planned.
- **Patronage (proposed):** where kin help falls short a rich household gives; large one-sided goodwill is worked off as days on its farm and weighed in the debtor's vote.
- **Nursing gap:** a birth blocks the next for the nursing time; an infant's death should end it early (missing). Narrow range: about 6 to 9 births a woman.
- **Disease (not designed):** hunger and crowding raise sickness, which raises deaths; deaths follow a bad harvest by months.
- **The outside world:** a small fixed push in and out.
- **Culture (card 6):** attitudes drift, anchored to upbringing; a village changes practice at its yearly meeting by a 25% margin; customs set the dials of
  other loops (inheritance: land concentration and elite turnover; marriage rules: births; who eats first: child deaths; who speaks: debtors' politics).

## Numbers from the game's code (`src/sim/rules.js`, `births.js`, `deaths.js`, `hunger.js`, `culture.js`)

- Annual death hazard at age a: `0.006 + 0.0007*exp(0.07*a) + 0.381*exp(-1.265*a)` (about 20% die before 1, a third before 15).
  Hunger h in 0..1 multiplies it by `1 + k*h`, k = 1.5 under 5 and from 60, 0.6 for 5 to 14, 0.3 for adults; poor health multiplies up to 3.
- Births: married women living with their husband, 15 to 50. Chance to conceive a game day `0.015 * ageFactor`, ageFactor per 5 years from 15:
  `[0.89, 1, 0.94, 0.86, 0.7, 0.36, 0.05]`, times `(1 - hunger)`. A game year is 48 days (4 seasons of 12). Pregnancy 36 days, nursing 48 days
  (no conception while nursing; an infant's death does not end it). 1% of births kill the mother.
- Marriage: men from 20, women from 18; needs a home with means; nobody marries with hunger at or above 0.5.
- Rations: adult 1 a day, child 0.5. Floor: seed reserve plus 20 days of need; no deal takes a household below it.
- Grain in store rots: 5% a year of the grain up to a year's need, 20% of the next year's worth, 40% of the rest.
- Goodwill: one number a pair of holders, in rations, halves in 4 years; at most 32 counterparts. Gratitude adds up to +0.15 to the debtor's opinion.
- Ale: a barrel poured gives the host 0.05 prestige for 3 years, at most 4 barrels counted. Prestige: holder 1.6, holder's spouse 1.3, else 1; +0.2 from age 55; a house term; landed +0.2 (planned).
- Culture: 15 customs; fission when a settlement's divergence is at least 0.3 and its tie to the centre under 0.35 for 3 years; tie = `exp(-d/25)` plus kin links.
  Calibrated pace: easiest custom drifts in about 3 generations (300 people), hardest not within 200 years.
- Design numbers for slice 5: rent a quarter of the harvest plus 2 days; loans repaid with a quarter more; default after two unpaid harvests;
  a field passes when the debt is at least half a field's worth (60 rations); landed when rents and stores cover need 1.5 times three year ends running; a hired day costs 3 rations.

## History, for scale (acoup, Devereaux; treat as rough)

- About half of children dead by 10; about 5.8 live births a woman against about 9 at maximum; late marriage (women about 25, a quarter to a third never) was the north-west European valve.
- Yields 4:1 to 8:1; at 6:1 farms use 56 to 70% of available workdays, at 4:1 84 to 110%. Tithe a tenth; tenants on shares kept 40 to 60%.
- Peasants aim for "subsistence and a little more", and put surplus into feasts and relationships, not savings. Coin fails when most needed.
- Water transport about 20 times cheaper than land by sea, 5 times by river. Monetisation is fragile.

## What a report should contain

Write your report to the file named in your task, in Markdown, under about 900 words, with figures saved as PNG beside it and referenced by file name.
State plainly what you ran and what you did not; give the numbers; separate what the mock shows from what you infer. Most valuable of all: say
**which abstractions were needed to write the model that the diagram does not have** (a missing property, a link whose sign was not enough, a
threshold, a phase, a rate that had to be invented), and **which views of the results were most useful for understanding balance** (a time series,
a phase plot, a sensitivity ranking, a budget, a regime map). Keep scripts in your own subfolder so results can be re-run.
