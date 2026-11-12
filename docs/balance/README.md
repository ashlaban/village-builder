# The balance map: where this work stands (12 November 2026)

Kim wants one static diagram that shows what holds the game in balance at the macro scale, for development and for tuning: which
mechanisms act on which balance properties, in what way, how strongly and how fast. This folder holds the work towards it from the
session of 12 November 2026, so that it can be continued. The decisions are in `design.md`, Balance loops and targets, The balance review.

## What is here

- `cards.md`: the mechanisms, one card each. Cards 1 to 4 are finished, card 6 has its groundwork and Kim's answers, cards 5, 7 and 8
  are seeds, and five candidates have no card yet. It also holds the draft list of balance properties with targets and measured values.
- `findings.md`: what the eight experiments found, as numbers.
- `figures/`: twelve key figures from the experiments.
- `drafts/map-draft3.html`: draft 3 of the map, a causal loop diagram (open it in a browser; `gen4.py`, `balance.tpl` and `body3.html`
  rebuild it). `drafts/reflection.html` is the reflection page written after the experiments; it expects four figures beside it under
  other names (`fig-food.png` is `figures/food-budget.png`, `fig-levers.png` `lever-ranges.png`, `fig-roads.png` `elite-roads.png`,
  `fig-culture.png` `culture-trajectory.png`).
- `mocks/`: the experiments' scripts, one folder each, and `brief.md`, the brief they all read. Throwaway research code in Python and
  Node, not game code; no test or tool reads it. Their outputs were not kept (result tables, logs, saves, pickled runs, 24 more figures):
  each folder's scripts remake them (minutes; the culture runs take about 30). Four documents were: `wholemap/arrows.md` (every arrow of
  draft 3 as an equation, with what had to be invented), `estates/REPORT.md`, `measure/tables.md` (the measurements by decade) and
  `regimes/dial_table.csv` (the dial table that was tested blind).

## How the work went

1. A first map of the sixteen built and planned systems and what each passes to the next (not kept; superseded).
2. Cards: a mechanism from the vision, traced through the design and the code, with the history read for what is missing.
3. Drafts 1 to 3 of the map as a causal loop diagram: balance properties, levers, signed arrows, loops marked as balancing or
   reinforcing, slow links marked, the food's five outlets drawn as flows.
4. Eight experiments on draft 3, run by subagents: a demography cohort model; a 200-household model of surplus, debt and estates; the
   whole of draft 3 as one stock-and-flow model; a culture model of 12 villages; measurements on the game; a survey of abstractions;
   accounts built at the target; a household model of the whole 200-year arc with a blind test of a dial table.

## What the experiments concluded about the map

Draft 3 could not be simulated as drawn: only 3 of its 40 links could be written from their sign. A causal loop diagram stays useful for
collecting cards and talking about mechanisms; it is not the picture to tune by. Which perspectives earned their place:

| Perspective | Showed what nothing else did | Cannot show | Verdict |
| --- | --- | --- | --- |
| Budgets (accounts that must close) | 1.67 is a floor; rot is the decisive dial; the town is the residual claimant; rent cannot feed an elite; 15% of produce has no outlet | Thresholds, spread, timing, the order of claims, whether a balance returns | The main picture |
| Regimes (which limit binds, era by era) | Which dial is live now; three real transitions (homes within reach, the map filling at about year 150, the town's food) | Limits overlap a quarter of the time; some only mark unlock dates | A strip beneath |
| Dial table (setpoint, sensor, actuator, range, delay) | A dial's own property, well (80% right in direction) | Effects through population; gains that change with the regime | The legend |
| Spread between households | The mechanism behind estates, hunger and goodwill | Hard to draw statically | Must be marked |
| Loop diagram (draft 3) | Names the mechanisms and their kind | What adds up, thresholds, spread, time | The backing for the cards |

## Vocabulary the map needs

Draft 3 had two kinds of thing, properties and levers. The experiments needed seven:

| Kind | What it is | Examples |
| --- | --- | --- |
| Stock | Something that accumulates, with a target band | Farmers, townspeople, elite; grain in store; goodwill; land owned and tenanted |
| Flow | What moves between stocks or to a sink; flows add up | Births, deaths, moves to town; eaten, taken, sold, feasted, rotted |
| Gate | A threshold that opens or closes a flow | A home with means; hunger 0.5 stops marriage; the floor; default after two harvests |
| Setpoint | The number that says where a gate or rate sits; what is tuned | The means test, the tithe, rot rates, yield, the wish for goods |
| Condition | Sets where the limits sit; not tuned in a game | Reach on foot and by water; ships; the outside world |
| Process between households | Moves things within a class; invisible in class totals | Kin help, feasts, loans, patronage |
| Consequence | Follows from the rest; watched, not targeted | Idle hours; the food ratio needed; land inequality |

Draft 3 mixed them: births and deaths were levers but are flows; reach by water was a lever but is a condition; food produced was a
property but is a rate with a setpoint under it; idle hours was a property to tune but is the slack a household keeps.

## A shape for the single diagram (proposed, not drawn)

```
conditions   reach on foot and by water  .  ships and silver  .  the outside world
----------------------------------------------------------------------------------
PEOPLE       births ==> ( FARMERS 600 ) ==> ( TOWN 325 ) ==> deaths
               ^ gate: a home with means        ^ limited by migrants, then by food
                       \==> ( ELITE 75 )  by office and tithe; by debt once the map is full

FOOD         produced ==+== eaten on the farm
(one bar,               +== taken   ==> elite            setpoints on each outlet:
 widths add up)         +== sold    ==> town             means test, tithe, wanted
                        +== feasted ==> goodwill         goods, keeping, yield
                        +== rots    ==> lost
             marked: the two tight margins (the town's food, the full tenant)
             marked: where spread matters (households under need, hard lenders)
----------------------------------------------------------------------------------
ERAS         frontier | homes within reach | trade and town | map full | mature
             in charge:  mates  ->  marriage gate  ->  town  ->  town food, debt
----------------------------------------------------------------------------------
legend       each gate and setpoint: range, delay, what it holds, built or planned
```

The two second-round experiments disagreed on the one picture: the budget (is the target possible, and who goes short) or the regime
strip (which dial matters now). The shape above keeps both, since a tuner needs the second to know where to look and the first to know
what a change costs. Culture sits as dials on four gates and as a curve on the era strip.

## What changed in the picture of the game

1. Marriage holds the population, not hunger; the means a home must hold before a couple may marry is the master setpoint.
2. The surplus exists and about a fifth of the harvest rots; the target needs 1.7 to 2.15 times need, not 1.67.
3. The road from hunger through goodwill to a landed elite carries almost no traffic; office and a tithe give the 75; debt concentrates
   land only once the map is full, slowly, for hard lenders.
4. Growth has a ceiling of about 2.4% a year; 1,000 in 150 years needs 3.1%; founders reach about 1%.
5. The town decides where people live, not how fast the island grows; it is the residual claimant on food.
6. Reach is the condition under every limit: land within a day's walk is what runs out.
7. Culture needs a seed and a switch; the game's customs flicker and do not drift apart.

## Next steps

- Kim's answers to `QUESTIONS.md`, VB-404 (where the elite comes from), VB-405 (marriage, nursing and growth), VB-407 (feasts and keeping).
- Ready now: VB-403 (the accounts report; it also explains the 15% with no outlet) and VB-406 (the village store).
- Draft 4 of the map in the shape above, once VB-403 gives the numbers for its flows. Until then the measured values in `cards.md` serve.
- Cards still to write: 7 (idle hours and crafts), 8 (elite turnover), and the candidates at the end of `cards.md` (reach, disease,
  animals as stored wealth, the household's life cycle); card 6 (culture) has no task yet.
- To verify in the game: the village store's rot; the `landed` rule; founders stalling; customs flickering; the 15%.

## Limits

Every mock mixes the game's rules with invented numbers (each folder's scripts mark them): directions and rough sizes are findings,
exact percentages are not. The measurements are mostly the populous scenario on small maps over 50 years; one medium run was stopped at
year 10. The history is from the acoup blog (Roman and general pre-modern, not Scandinavian) and from summaries of the literature.
