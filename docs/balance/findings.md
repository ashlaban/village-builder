# Balance review: findings of the eight experiments (12 November 2026)

What the experiments of the balance review found, as numbers. `README.md` says what they were for and what follows from them; `cards.md` holds
the mechanisms they tested. Each experiment's scripts and small data are in `mocks/<name>/` (`mocks/brief.md` is the brief they all read);
key figures are in `figures/`. Every mock uses the game's own numbers where they exist and invented ones elsewhere: read directions and
rough sizes as findings and exact percentages as illustrations. The measurements are of populous on small maps unless said.

Round 1 (six experiments) tested draft 3 of the balance map; round 2 (two) tested the abstractions round 1 pointed to.

## Measured on the real game (populous, small map, 3 seeds, 50 years; `measure/tables.md`)

- Growth 1.2 to 2.2% a year; births per woman 6.1 to 6.9; 20% die before 1, 34% before 15. Deaths: infancy 33%, illness 32%, childhood 22%,
  old age 9%, starvation 2.2%, childbirth 2%.
- First marriage: women 20 to 21, men 22 to 23. Almost nobody never marries. The marriage valve acts by delay: couples putting off marriage
  rose from 0 to 52-122 a decade; "no land within a day's walk" 62-74 a decade.
- Food produced over need, counting fish, meat, milk and gathering (39 to 52% of all food): 1.64 to 1.86 village-wide. By household the median
  is 1.7 to 2.0; 18 to 28% of households are under 1.0. Grain alone: 1.05 poor year, 1.36 ordinary, 1.52 good.
- Where the grain harvest goes: seed 33-35%, eaten 26-30%, rots in households 14-16%, to the village store 10-11% (68-85% of which rots),
  brewed 8%, given to other households 8%. About 22% rots in all. Stores hold about 2.2 years of need.
- Hungry households (over 30 days a year): 0 to 0.8%.
- Seed-to-yield: 3.7 at year 10 falling to 2.9 at year 50 (soil wear). 3.3 to 3.5 fields a household, 2.3 to 3.2 meadows.
- Labour: farmers idle 16-33% in summer and autumn, 59-70% in winter; walking and carrying take 30-47% of hours outside winter; the harvest
  peak leaves 18-25% of the day free.
- Goodwill: 65 to 163 gifts a year; about 88 rations outstanding a household; does not pile up with a few households.
- Land: houses and fields use 14% of the map at year 50; adults waiting for land rose from 3 to 47. Growth slows because land within a day's
  walk of a village runs out, not because the map is full. Land Gini 0.29, grain Gini 0.31 without any debt, neither rising.
- Culture: one culture in every run, no split; villages differ on about 1 of 14 customs; 29-46% of custom changes undo the previous one.
- Founders scenario: 10 people become 19 to 69 in 80 years (about 1% a year), a third of households single-person, marriage kin-barred.
- Cannot be measured (no mechanism yet): share extracted, tenancy, town share, elite share, trade, silver, goodwill from feasts, disease.

## Demography mock (cohort model with the game's numbers)

- Ceiling: +2.40% a year (marry at 18, no hunger), doubling in 29 years. 10 to 1,000 in 150 years needs 3.07%: above the ceiling.
- Most each lever can take off annual growth at 1,000 (points): disease x3 3.7; hunger to 0.49 2.3 (then marriage stops at 0.5: a cliff);
  marriage age 18 to 28 2.0; never married to 35% 1.5; nursing gap 0.5 to 2.5 years 1.1; famine every 5 years 0.6; migration of 5 a
  year 0.55 (5 points at 100 people).
- Zero growth at 1,000 by hunger alone: 49% of children die. By marriage at 18: 51% never marry. Marriage at 25 with 30% never: 33% of children die.
- The town adds nothing to the growth budget: its migrants are the unmarried, so the brake is still the rural marriage gate. It sets the split,
  not the rate. Holding 325 of 1,000 needs about 9.5 migrants a year and town deaths 1.2 to 3.8 times rural, depending on how many migrants marry.
- Marriage-held balance overshoots after a shock and echoes for a generation; hunger- and disease-held balance returns smoothly in about 50 years.

## Whole map as one stock-and-flow model (13 stocks, yearly)

- Only 3 of 40 links could be written from the sign alone; about 30 parameters invented. Missing: stocks (cleared land and its limit, the grain
  store, elite income, age groups), the spread between households, thresholds that flip a sign, the order of claims on the harvest, exchange
  rates (food, goodwill, fields, goods, silver), saturations, phase dates.
- A plausible fit ends at 959 = 574 / 312 / 73 with 3% hungry; 18% of output taken and 34% sold. The elite lives on the tithe (12% of output), not rent (1%).
- Land barely concentrates (tenancy 5%): with averages there is little shortfall, so the hunger-to-debt road is empty.
- The marriage gate governs every phase (off: +72% people, 64% hungry). Land binds through homes, not through food. The trade loop builds the
  town (off: 103 instead of 301). Brakes on estates, patronage and disease change almost nothing.
- Regimes in sequence: frontier, filling, trade and town, mature. Hidden setpoint: yield x fields a home / a home's need.
- Population is knife-edge (24% of 400 sampled runs within 900 to 1,100); farm share, food kept and hungry share are robust.
- The estates loop acts in about 2 years, its brakes in 30 to 44; the money loop has no brake. The silver tax is one sale counted as both taken and sold.

## Household mock of estates (200 households, 150 years)

- Concentration is a slow, concave ratchet (+6 to +8 estates a century), not a runaway. Estates (15+ fields) per 200 households at year 150 by
  food produced over need: 35 at 1.2, 18 at 1.67, 6 at 2.0, 1 at 2.4.
- The household life cycle matters as much as yield: identical households cut estates from 18 to 4.5. Weather, interest and the floor matter little.
- Debtors' politics is the steepest brake (remedy turns to labour at 30% debtor voice: 15 estates; at 20%: 6.6). Tenants leaving is no brake.
  Fully partible inheritance cuts estates but pauperises (Gini rises).
- Hard lenders become landed, not the generous. Kin help slows concentration (26 estates without it). Patronage as proposed is negligible.
- Rent and interest come to 6-10% of output; a full tenant falls below need at rent 0.39 (median year), 0.26 (1-in-4 bad year).
- Feasting mostly replaces rot. The design's "landed" rule (rents and stores 1.5 times need) counts 45 to 100 of 200 households with no rents at all.

## Culture mock (12 villages, two islands, 200 years)

- An opinion malus keeps differences but does not create them. Two cultures need a seed (different start, or different land). The link is a
  threshold, near malus x distance = 1, not a smooth dial.
- The designer's rise-then-fall appeared only with: poorer land on one island, a full-land push on "how many heirs", and a pull of attitudes
  toward the practice in force (the game lacks it). The fall came from the town and a Church doctrine. Peak around year 150.
- Easy customs flicker and carry no identity; hard customs never move in 200 years, so only a starting difference in them persists.
- Best property: the attitude gap between the two largest blocks over time (peak value, peak year); check: share of marriages across the divide.

## Desk research on abstractions

- A causal loop diagram misleads at every stock and cannot show conserved splits, gates or which loop is in charge when. Draft 3 mixes stocks,
  flows and rates; conserved flows with influences; four kinds of "lever" (parameters, gates, conditions or eras, processes between households);
  targets with consequences; totals with spread.
- Shortlist: (1) a stock-and-flow budget map with three people stocks (farming, town, elite), one food budget whose widths add up, land as a
  second conserved stock, gates as their own symbol, conditions outside the frame; (2) a timeline of eras showing which loop dominates and which
  limit binds; (3) a dial table (setpoint, sensor, actuator, range, delay, opposes, band).

## Round 2: budgets at the target (`mocks/budgets/`; `figures/food-budget.png`, `growth-budget.png`, `dial-slack.png`)

One steady year of six accounts at 1,000 = 600 farm / 325 town / 75 elite (13.5 households); static, no feedback. Invented and decisive: elite
consumption 1.5 times a peasant's, 4 retinue a household, the town growing 15% of its own food, the tithe going to the elite, reserves of 5%
(town) and 10% (harvest hours).

- The accounts close only if farmers sell 88% of their disposable surplus and rot falls from 17.5% of output to 3%.
- Food produced over need that the target requires: 1.69 (all spare food sold, rot 3%); 1.91 (half the surplus feasted); 1.96 (today's rot,
  all sold); 2.15 (today's rot, half feasted). "1.67 follows from the split" is a floor: no rot, no feasts, an elite that eats like peasants.
- Out of the farm at the target: taken 21.6% of output (tithe 12.7, rent 3.0, tax 3.0, interest 1.0, tolls 1.9), sold 16%, feasted 2%.
- The elite needs 535 rations a household a year. By rent alone: 385 tenant fields, 89% of all farm fields. With the tithe: no tenancy
  needed, income 57% over need. A tithe falls on the gross of every field; rent on the grain of tenant fields only.
- Growth budget: the 2.40% ceiling is spent on marriage delay 0.89, never marrying 0.66, the town 0.54, disease 0.28, hunger 0.16; net
  immigration adds 0.13. The brakes are far from additive: the town removes 0.05 alone and 1.00 when added last.
- Recipes: held by hunger needs hunger 0.42, just under the cliff at 0.5; marriage at 26 costs the fewest lives (38% of children die, life
  expectancy 33); a town at 3.3 times the farms' death rate gives 51% and 23.
- Labour: winter idle hours could replace about 91 of the 325 townspeople; the harvest has about 7.5% of hours free.
- Land: the target uses about 5% of a medium map and fewer fields than populous medium has at year 10. Land does not bind.
- Binding constraints: (1) the town's food: it is the residual claimant, short at a yield 2% lower and 61% short at 20% lower; (2) the full
  tenant: designed claims take 38% of its output, leaving 2.5% over need and a 12% shortfall in a one-in-four bad year; (3) the people
  stocks, knife-edged (a year later marriage, or town deaths 20% lower, breaks the split). Nearly free: land, the elite's income, walking.
- Found only by closing the accounts: about 15% of today's gross produce has no outlet in the measured split (VB-389).
- Goodwill is not a budget at class level: help moves food inside the farm class and nets out.
- What no budget shows: thresholds, the spread between households, timing, the order of claims on the harvest, whether a balance returns.

## Round 2: regimes and dials (`mocks/regimes/`; `figures/regime-timeline.png`, `elite-roads.png`, `dial-test.png`)

A household-agent model of the whole arc: 3 founding homesteads to about 1,000 people in 200 to 250 years, 9 village sites of 60 fields,
mechanisms unlocking by date (fair 40, debt and land 60, crafts 80, ship and silver tax 100, town and tithe 110); about 2,500 runs.

- Regimes are half real. Three transitions survive any order of unlocks: homes and land within reach (median year 48), the map filling
  (152; 114 to 186 across 300 samples) and the town's food binding (154). The town's earlier limits (migrants, demand for goods) only mark
  the unlock dates. Limits overlap in 26% of years. Food, labour and extraction never bound growth in any sample. The order mates, then
  homes, then town held in 61% of samples.
- The contradiction of round 1: land concentrates only once the map is full and the food ratio after that is low. Debt alone at a ratio of
  1.7: land Gini 0.20 at year 150, 0.31 at 250, 0 to 1 elite households. With a weak marriage valve (means test 1.05, ratio 1.24): Gini
  0.53, tenancy 32%, 4 elite households by year 250.
- Tithe plus office alone: 12 elite households (77 people) at year 150, 15 at 200, land Gini unchanged; the elite moves +21% for +20%
  tithe and nothing opposes it. The designer's road (goodwill to land): 70 fields in 250 years, no elite household. Kin inheriting the land
  of households that die out: Gini 0.61, 2 elite households. A silver tax whose arrears become debt: tenancy 58%, Gini 0.89 by year 250.
- Growth: founders alone 1.7% a year, 102 people at year 150 (12 to 239 across seeds; 8% die out; the kin limit binds first). Faster
  demography alone: 565, overshooting into 19% hunger. One immigrant family every 2 years: 1,034, 62% of seeds reach 1,000 by year 150;
  for the first 60 years only: 848.
- The setpoint the map lacked is the means test of the marriage gate: +10% raises the late food ratio by 4.7%, and land concentration,
  tenancy, the town's food and hunger follow that ratio.
- The dial table tested blind (5 dials, 6 properties, 40 seeds): direction right in 80% of 30 predictions, size within a factor of 2 in
  73%; of the 8 significant effects, 7 right in direction and 4 in size. Right for a dial's own property (tithe on elite households: +20%
  predicted, +21% found); wrong for effects that pass through population and for gains that change with the regime.
- Half-recovery after a pulse: offices 1 year, stores 1, trade habit 2, goodwill 4, town 5, land concentration 39, population 49.
  Reinforcing loops faster than their brakes: debt to land (2 years against about 40), kin inheriting land (no brake), the silver tax with
  arrears (no brake), offices (no brake), births against the marriage valve (a generation, so population echoes).
