# Food balance, first pass: where rations fall short (VB-284, 11 November 2026)

VB-048's measuring step, after VB-282 (a hungry household eats its seed). Nothing in the game changed; the numbers are for Kim's tuning questions
(`QUESTIONS.md`, "VB-284: tuning the food balance"). Base: the integration branch at `f46852e` (VB-274 merged).

How it was measured:
- `node tools/balance.js --scenario populous --seeds 3,7,11,42 --map small --years 15` (the task's command; 4,630 household-years, years 2 to 15), and the
  same at 30 years, years 16 to 30, a seed a process (`--from 16 --json`; 7,792 household-years), for soil, meadows and weather.
- `node docs/bench/food-season.js populous SEED 30` (new, reads only, as `hunger-causes.js`): each household and season, its shape on its first day of the
  season (members, adults and children by ration, hands 14 to 59, fields, cattle, sheep, food held), its need and its shortfall in rations (each living
  member's unmet share of the day's ration, from the hunger log), its hungry days; each household-year its harvest net of seed and its replay row (hungry
  over 0.3 of its days after year 3, 12 days or more, as `hunger-causes.js`). `node docs/bench/food-season-report.js FROM TO fs-*.json` prints the tables
  below. A season is 12 days; the crop is sown in spring days 0 to 9 and ripens 26 days later, so it is reaped and threshed through autumn and new grain
  is in store only late in autumn: the stores carry a household from one autumn to the next.

## What the numbers say

1. **Nobody is short before year 16.** Years 4 to 15: 16,495 household-seasons, a shortfall of 0.0 to 0.1 % of need in every season, 2 rows hungry over
   0.3 (seeds 7 and 42, 22 and 16 days); the 15-year `balance.js` run has every household size at 1.38 to 2.3 times its need, 0 to 3 % of household-years
   with a hungry day and 0 to 0.3 hungry days a year (table A). The shortage the task asks about (VB-270's 166 short rows) is a late one: years 16 to 30
   have **196 rows** (seed 3 141, 42 38, 11 12, 7 5; 98 households), 2.1 % of need short over the year.
2. **The rows are VB-270's short rows, now with the seed eaten.** VB-270's 166 short rows (137 of them populous): 4.1 members on 3.2 fields, 2.2 adults,
   1.9 children, 0.2 herds. Here: 4.0 members (2.3 adults, 1.6 children, 2.2 hands) on 2.9 fields, **0.0 cattle**, 0.2 sheep; 97 with 2 or more adults
   and 2 or more children, 41 with one adult at most; 1 row has a day its stores covered (VB-282 closed the reserve rows); 8 dissolved in the year.
3. **The season: summer and autumn.** Short 0.5 % of need in spring, 3.3 % in summer, 4.4 % in autumn, 0.1 % in winter (the rows' hungry days 554 /
   2,100 / 1,389 / 128). The gap runs from the end of spring until the new grain is threshed late in autumn. What a household holds at the start of the
   season decides it: under 12 days of food, 11.2 % of need short and 73 % of springs hungry; 24 days or more, 0.3 % and none after spring (table "food held").
4. **By household size:** the lone adult is worst (3.5 % short, and in winter too: 1.2 %), then the couple with 4 or more children (3.1 %; 17 % of their
   autumns hungry); households of 4 to 8 are short 2.1 to 2.4 %; couples and couples with one child 1.3 to 1.4 % (tables "members", "adults + children").
5. **By farm:** 3 fields is the worst common farm (2.8 %; 15 % of its household-years hungry; harvest net of seed 0.96 of need), 1 field 2.9 %; 5 fields
   1.3 %, 6 or more 0.6 % (tables "fields", "harvest"). Need a field: under 1 ration a day 0.8 to 1.0 % short, over 1.25 2.7 to 2.8 % ("need a field").
   **Hands do not decide it** (one hand 2.3 %, three or more 2.3 %; "hands"): land and soil do, not labour.
6. **By herd, the strongest split: households without cattle carry the shortage.** No herd: 3.2 % short, 69 % of household-seasons; cattle 3 or more:
   0.1 % ("herd"). On the 30-year `balance.js` rows, years 16 to 30, households of 3.5 to 6.5 adult-equivalents of need on 3 fields: without cattle make
   **0.71** of their need (hungry 21 %), with cattle 1.33 (2.5 %); on 4 fields 0.87 against 1.63 (23 % against 0 %). Without cattle the soil is worn
   (0.80 to 0.84 against 1.07: no manure; `SOIL.wear` 0.08 a crop down to the floor 0.75) and the farm has few meadows (0.9 against 5.9). Households
   with cattle are about as many in years 16 to 30 (1,971 household-years) as in 4 to 15 (1,940); all the growth is in households without cattle (2,098 to
   5,813), on 3.0 fields, soil 0.91 (0.99 before), 49 grain a field (63.6 before).
7. **The farm plans to be short.** `fieldsWanted` (`src/sim/fields.js`) asks for `FIELDS.want` 1.1 of a year's rations at `FIELDS.expect` 0.75 of the
   full yield, gross: 75 a field; but 25 of it is seed, so the plan's harvest is 1.1 × 50 / 75 = **0.73 of the need** net. A household of 2 adults and 2
   children (3 adult-equivalents, 144 rations) wants 3 fields; at worn soil a field nets about 50 (table "harvest", 3 fields: 51 net a field reaped), 0.96
   of its need in an ordinary year and less in a poor one. Its hands are not the bind: the rows have 2.2 hands, room for 4 fields at 2 a hand.
8. **Poor years in a row tip it.** Seed 3 has 141 of the 196 rows: weather 0.754, 0.907, 0.833, 0.886, 0.872, 0.822 in years 21 to 26 (drawn uniform 0.75
   to 1.2, mean 0.975), harvests 0.82 to 1.05 of the village's need for six years, and its rows peak in year 27 (38). Grain kept a second year loses 20 %
   a year (`ECON.storeLoss`), so the stores of good years do not carry a run of poor ones for the households that only just cover a year.

Where the rations fall short, in one line: **households of about 4 without cattle, on 3 fields of worn soil, in summer and autumn after the second or third
poor harvest, from year 16 on, when every new household is one without cattle.**

## Tables

A. `balance.js`, populous small, seeds 3, 7, 11, 42, years 2 to 15, by household size (adult-equivalents of need), rations a year:

| size | household-years | grain | milk + butter | meat | made / need | hungry % | hungry days | fields | cattle | soil |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 278 | 108.8 | 0.7 | 0.9 | 2.30 | 3 | 0.3 | 1.6 | 0.2 | 1.15 |
| 2 | 661 | 163.9 | 4.5 | 6.7 | 1.84 | 1 | 0.1 | 2.6 | 1.0 | 1.11 |
| 3 | 1005 | 190.0 | 6.8 | 5.4 | 1.53 | 0 | 0.0 | 2.9 | 1.3 | 0.99 |
| 4 | 886 | 265.4 | 20.8 | 15.9 | 1.67 | 0 | 0.0 | 3.5 | 3.7 | 1.01 |
| 5 | 863 | 323.4 | 25.3 | 20.0 | 1.62 | 0 | 0.0 | 4.2 | 4.5 | 1.05 |
| 6 | 580 | 355.9 | 21.8 | 20.8 | 1.45 | 0 | 0.0 | 4.6 | 3.9 | 1.03 |
| 7 | 218 | 399.9 | 20.6 | 22.8 | 1.38 | 1 | 0.1 | 5.0 | 3.5 | 1.04 |
| 8 | 99 | 464.5 | 24.3 | 20.0 | 1.38 | 0 | 0.0 | 5.8 | 4.4 | 1.08 |
| 9 | 40 | 556.2 | 21.8 | 28.2 | 1.40 | 0 | 0.0 | 6.9 | 3.5 | 1.11 |

By weather (years 2 to 15): good 1.92, ordinary 1.59, poor 1.29 of need; the reference household (about 6 on 3 fields with cattle; 30 household-years)
1.19, 1.13 and 0.88 in good, ordinary and poor years (the balance review: 1.17, 0.93, 0.92). By cattle: none 1.39 (2,347 household-years), 1 to 2 1.60,
3 to 4 1.76, 5 or more 1.94. Years 16 to 30 (the same tool at 30 years): good 1.66, ordinary 1.37, poor 1.13 of need, with 13.5 %, 14.5 % and 8.0 % of
household-years hungry (the hunger follows a poor harvest by a year).

The tables of `food-season.js`, populous small, seeds 3, 7, 11, 42, years 16 to 30; each season's cell is the shortfall as a share of the season's need,
and in brackets the share of household-seasons with a hungry day. Years 4 to 15 read 0.0 to 0.1 % in every cell and are not printed.

| season (all) | household-seasons | spring: short % of need (hungry %) | summer: short % of need (hungry %) | autumn: short % of need (hungry %) | winter: short % of need (hungry %) | year: short % | hungry days a year |
|---|---:|---:|---:|---:|---:|---:|---:|
| all | 31760 | 0.5 (1.6) | 3.3 (7.6) | 4.4 (10.9) | 0.1 (0.2) | 2.1 | 1.1 |

| members | household-seasons | spring: short % of need (hungry %) | summer: short % of need (hungry %) | autumn: short % of need (hungry %) | winter: short % of need (hungry %) | year: short % | hungry days a year |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | 4125 | 1.7 (2.7) | 3.7 (8.0) | 7.0 (11.6) | 1.2 (1.5) | 3.5 | 1.7 |
| 2 | 4947 | 0.2 (1.0) | 1.9 (4.6) | 3.0 (6.8) | 0.0 (0.0) | 1.2 | 0.6 |
| 3 | 5577 | 0.2 (0.7) | 1.7 (5.1) | 3.4 (8.4) | 0.0 (0.0) | 1.3 | 0.7 |
| 4 | 5210 | 0.4 (1.5) | 3.6 (7.7) | 4.9 (11.8) | 0.0 (0.0) | 2.2 | 1.1 |
| 5 | 4456 | 0.8 (2.3) | 3.8 (10.2) | 5.1 (13.4) | 0.1 (0.1) | 2.4 | 1.2 |
| 6 | 3490 | 0.7 (2.0) | 3.7 (9.9) | 4.7 (13.3) | 0.0 (0.0) | 2.3 | 1.2 |
| 7 | 1897 | 0.5 (1.7) | 3.8 (9.2) | 4.4 (12.4) | 0.0 (0.0) | 2.2 | 1.1 |
| 8+ | 2058 | 0.3 (1.6) | 3.8 (9.5) | 4.1 (11.7) | 0.0 (0.0) | 2.1 | 1.2 |

| adults + children | household-seasons | spring: short % of need (hungry %) | summer: short % of need (hungry %) | autumn: short % of need (hungry %) | winter: short % of need (hungry %) | year: short % | hungry days a year |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1 + 0 | 4125 | 1.7 (2.7) | 3.7 (8.0) | 7.0 (11.6) | 1.2 (1.5) | 3.5 | 1.7 |
| 1 + 1 | 378 | 0.0 (0.0) | 0.2 (2.2) | 0.4 (2.0) | 0.0 (0.0) | 0.2 | 0.1 |
| 1 + 2 | 223 | 0.0 (0.0) | 0.0 (0.0) | 1.8 (4.7) | 0.0 (0.0) | 0.5 | 0.3 |
| 1 + 3 | 98 | 0.0 (0.0) | 0.0 (0.0) | 2.4 (6.5) | 0.0 (0.0) | 0.8 | 0.4 |
| 1 + 4+ | 43 | 0.0 (0.0) | 0.2 (7.1) | 2.1 (7.1) | 0.0 (0.0) | 0.8 | 0.4 |
| 2 + 0 | 4569 | 0.2 (1.0) | 2.0 (4.8) | 3.2 (7.3) | 0.0 (0.0) | 1.3 | 0.7 |
| 2 + 1 | 4550 | 0.3 (0.8) | 2.0 (5.6) | 3.6 (8.8) | 0.0 (0.0) | 1.4 | 0.8 |
| 2 + 2 | 3614 | 0.4 (1.4) | 3.3 (7.3) | 4.9 (11.0) | 0.0 (0.0) | 2.1 | 1.1 |
| 2 + 3 | 2343 | 0.3 (1.4) | 3.1 (10.5) | 5.6 (13.8) | 0.0 (0.0) | 2.2 | 1.2 |
| 2 + 4+ | 1488 | 0.7 (1.9) | 4.4 (13.9) | 7.4 (17.4) | 0.0 (0.0) | 3.1 | 1.5 |
| 3+ + 0 | 1452 | 0.2 (0.6) | 1.9 (4.6) | 3.0 (9.1) | 0.0 (0.0) | 1.3 | 0.7 |
| 3+ + 1 | 2013 | 0.7 (2.6) | 3.8 (8.6) | 3.9 (11.5) | 0.0 (0.0) | 2.1 | 1.2 |
| 3+ + 2 | 2684 | 0.8 (2.5) | 4.0 (9.4) | 4.1 (12.2) | 0.1 (0.2) | 2.3 | 1.2 |
| 3+ + 3 | 2372 | 0.6 (1.9) | 3.8 (8.8) | 4.2 (12.8) | 0.0 (0.0) | 2.2 | 1.2 |
| 3+ + 4+ | 1808 | 0.3 (1.8) | 4.1 (9.8) | 4.5 (12.5) | 0.0 (0.0) | 2.2 | 1.2 |

| fields | household-seasons | spring: short % of need (hungry %) | summer: short % of need (hungry %) | autumn: short % of need (hungry %) | winter: short % of need (hungry %) | year: short % | hungry days a year |
|---|---:|---:|---:|---:|---:|---:|---:|
| 0 | 168 | 0.0 (0.0) | 0.0 (0.0) | 0.0 (0.0) | 0.0 (0.0) | 0.0 | 0.0 |
| 1 | 3702 | 0.9 (1.9) | 3.9 (9.1) | 6.7 (13.7) | 0.5 (0.9) | 2.9 | 1.5 |
| 2 | 5932 | 0.5 (1.8) | 2.9 (7.4) | 4.8 (10.6) | 0.1 (0.3) | 2.0 | 1.1 |
| 3 | 8289 | 0.6 (2.0) | 4.4 (10.5) | 6.0 (14.2) | 0.0 (0.0) | 2.8 | 1.4 |
| 4 | 5868 | 0.8 (2.1) | 4.4 (7.7) | 4.8 (11.1) | 0.0 (0.0) | 2.5 | 1.1 |
| 5 | 5132 | 0.2 (0.5) | 2.2 (4.8) | 2.9 (7.4) | 0.0 (0.0) | 1.3 | 0.6 |
| 6+ | 2669 | 0.1 (0.6) | 0.8 (2.3) | 1.6 (4.6) | 0.0 (0.1) | 0.6 | 0.4 |

| hands (14-59) | household-seasons | spring: short % of need (hungry %) | summer: short % of need (hungry %) | autumn: short % of need (hungry %) | winter: short % of need (hungry %) | year: short % | hungry days a year |
|---|---:|---:|---:|---:|---:|---:|---:|
| 0 | 1000 | 0.2 (0.4) | 1.5 (3.6) | 2.4 (4.0) | 0.0 (0.0) | 1.0 | 0.4 |
| 1 | 5622 | 0.9 (2.0) | 2.7 (6.9) | 4.8 (10.1) | 0.6 (1.1) | 2.3 | 1.4 |
| 2 | 16952 | 0.3 (1.2) | 2.7 (7.2) | 4.5 (10.5) | 0.0 (0.0) | 1.9 | 0.9 |
| 3+ | 8186 | 0.7 (2.4) | 4.1 (9.5) | 4.3 (12.9) | 0.0 (0.0) | 2.3 | 1.2 |

| herd | household-seasons | spring: short % of need (hungry %) | summer: short % of need (hungry %) | autumn: short % of need (hungry %) | winter: short % of need (hungry %) | year: short % | hungry days a year |
|---|---:|---:|---:|---:|---:|---:|---:|
| cattle 1-2 | 438 | 0.0 (0.0) | 0.6 (2.8) | 1.3 (2.8) | 0.0 (0.0) | 0.5 | 0.2 |
| cattle 3+ | 7481 | 0.0 (0.1) | 0.1 (0.5) | 0.4 (0.8) | 0.0 (0.0) | 0.1 | 0.1 |
| none | 21995 | 0.8 (2.3) | 5.1 (10.5) | 6.8 (14.8) | 0.1 (0.3) | 3.2 | 1.5 |
| sheep only | 1846 | 0.1 (0.6) | 2.4 (3.9) | 3.3 (7.0) | 0.0 (0.0) | 1.5 | 0.6 |

| need a field a day (rations) | household-seasons | spring: short % of need (hungry %) | summer: short % of need (hungry %) | autumn: short % of need (hungry %) | winter: short % of need (hungry %) | year: short % | hungry days a year |
|---|---:|---:|---:|---:|---:|---:|---:|
| a <0.75 | 6255 | 0.3 (1.1) | 0.9 (3.6) | 2.1 (5.8) | 0.1 (0.4) | 0.8 | 0.6 |
| b 0.75-1 | 4061 | 0.1 (0.4) | 1.3 (4.2) | 2.8 (8.6) | 0.0 (0.0) | 1.0 | 0.6 |
| c 1-1.25 | 13519 | 0.5 (1.8) | 3.6 (8.3) | 5.0 (12.3) | 0.1 (0.3) | 2.3 | 1.2 |
| d 1.25-1.5 | 5182 | 1.0 (2.5) | 4.8 (10.5) | 5.3 (13.2) | 0.1 (0.1) | 2.8 | 1.3 |
| e 1.5+ | 2575 | 0.5 (2.2) | 4.9 (13.4) | 5.7 (15.8) | 0.0 (0.0) | 2.7 | 1.4 |
| f no field | 168 | 0.0 (0.0) | 0.0 (0.0) | 0.0 (0.0) | 0.0 (0.0) | 0.0 | 0.0 |

| hands a field | household-seasons | spring: short % of need (hungry %) | summer: short % of need (hungry %) | autumn: short % of need (hungry %) | winter: short % of need (hungry %) | year: short % | hungry days a year |
|---|---:|---:|---:|---:|---:|---:|---:|
| a <0.34 | 3862 | 0.1 (0.6) | 1.2 (3.8) | 2.3 (5.4) | 0.0 (0.1) | 0.9 | 0.5 |
| b 0.34-0.5 | 2044 | 0.1 (0.4) | 1.5 (3.7) | 2.2 (5.8) | 0.0 (0.0) | 0.9 | 0.5 |
| c 0.5-0.75 | 11339 | 0.4 (1.5) | 2.7 (7.6) | 4.4 (11.3) | 0.0 (0.2) | 1.9 | 1.1 |
| d 0.75+ | 14347 | 0.8 (2.2) | 4.5 (9.3) | 5.2 (12.9) | 0.1 (0.3) | 2.7 | 1.3 |
| e no field | 168 | 0.0 (0.0) | 0.0 (0.0) | 0.0 (0.0) | 0.0 (0.0) | 0.0 | 0.0 |

| food held at the season's start (days of need) | household-seasons | spring: short % of need (hungry %) | summer: short % of need (hungry %) | autumn: short % of need (hungry %) | winter: short % of need (hungry %) | year: short % | hungry days a year |
|---|---:|---:|---:|---:|---:|---:|---:|
| a <12 | 5462 | 39.0 (73.1) | 12.7 (27.3) | 10.2 (25.5) | 14.2 (45.5) | 11.2 | 5.9 |
| b 12-24 | 3387 | 5.2 (12.9) | 0.0 (2.9) | 0.0 (0.1) | 0.0 (0.7) | 0.3 | 0.2 |
| c 24-48 | 6751 | 1.0 (3.8) | 0.0 (0.0) | 0.0 (0.0) | 0.0 (0.0) | 0.3 | 0.2 |
| d 48-96 | 10313 | 0.0 (0.2) | 0.0 (0.0) | 0.0 (0.0) | 0.0 (0.0) | 0.0 | 0.0 |
| e 96+ | 5847 | 0.0 (0.0) | 0.0 (0.0) | 0.0 (0.0) | 0.0 (0.0) | 0.0 | 0.0 |

Harvest (the table "harvest"), by fields at the year's start, households present the whole year, years 16 to 30. Years 4 to 15 for comparison: net a
field reaped 72.7 to 83.9 and harvest 1.24 to 1.65 of need on every size of farm (3 fields: 74.3 and 1.33; hungry 0 to 0.7 %).

| fields (year's start; whole years) | household-years | fields reaped | harvest net of seed | net a field reaped | need at the start | harvest / need | hungry % |
|---|---:|---:|---:|---:|---:|---:|---:|
| 0 | 15 | 0.00 | 0 | 0.0 | 48 | 0.00 | 6.7 |
| 1 | 866 | 0.95 | 61 | 64.5 | 71 | 0.85 | 14.1 |
| 2 | 1517 | 1.96 | 116 | 59.2 | 111 | 1.05 | 11.0 |
| 3 | 2039 | 2.90 | 148 | 51.0 | 154 | 0.96 | 15.2 |
| 4 | 1432 | 3.66 | 217 | 59.3 | 179 | 1.21 | 11.1 |
| 5 | 1267 | 4.21 | 266 | 63.3 | 195 | 1.36 | 7.6 |
| 6+ | 657 | 4.84 | 346 | 71.5 | 228 | 1.52 | 4.9 |



## Proposals for Kim

In `QUESTIONS.md`, "VB-284: tuning the food balance" (no value committed): fields wanted net of seed; the soil's floor without manure; `fieldYield`
unchanged; grain kept a second year; the animals' yields unchanged and the herd spread to new households instead. Each says what it would move, read
against the tables above; the runs to check them are the same commands (`food-season.js` at 30 years, `balance.js` at 15 and 30).
