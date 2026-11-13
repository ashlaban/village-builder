# Estates mock: the surplus split and the road from hunger to a landed elite

**What I ran.** I wrote a yearly agent-based mock (`model.py`) of 200 farming households on 1,200 fields. The island is full from year 1
(there is no frontier). Each household has people with the game's death hazard, its age-factor births and hunger multipliers, a stem-family
succession, and non-heirs leaving at 18. It also has a store, the brief's rot bands, kin links, and goodwill that halves in 4 years. Yield
is calibrated so that realised food produced over need is R. Loans follow the brief: a quarter interest, default after two unpaid harvests,
and one field (worth 120) passing per case. Rent is a quarter plus 2 days. I ran 150 years, 3 to 8 seeds a setting, about 450 runs
(`exp.py`, `figs.py`, `ceiling.py`, `results/*.pkl`). **Main measure.** I count "estates": owners of 15 or more fields, 2.5 times the mean
holding, per 200 households (the target is 12 to 15). Seed noise is about ±2 on a 4-seed mean, so smaller effects are noise. Everything
here is about the mock, not the game.

## Answers

**1. Surplus split, extraction off** (`fig1_budget.png`, years 20 to 150):

| R | eaten | feasted | rotted | unmet need |
|---|---|---|---|---|
| 1.2 | 76% | 15% | 10% | 6.5% |
| 1.67 | 59% | 27% | 15% | 1.8% |
| 2.0 | 50% | 34% | 17% | 0.5% |

With feasting off, rot takes 22%, 41% and 50%: under these rot bands, feasting replaces rot. Even at R 1.2, 6 to 13% of households are
hungry in an average year. That comes from the life cycle and bad years, not from a shortage.

**2. Loans on, no brakes** (`fig2_concentration.png`). Land Gini goes from 0.19 to 0.41 by year 50 and 0.55 by year 150. Tenancy peaks at
19% around year 80, then falls to 14%, because estates find hired hands cheaper than tenants (a field nets 23 rations with hands, 18 with
a tenant). Landless households reach 37%, and estates 8.5, 15 and 18 at years 50, 100 and 150. The curve is concave: a slow ratchet of
+6 to +8 a century, not a runaway. It saturates near 35 even at R 1.2 (`fig4_regime.png`).

**What sets the speed** (`fig3_sensitivity.png`):
- Mean yield matters most. Estates are 35, 18, 6 and 1 at R 1.2, 1.67, 2.0 and 2.4.
- The household life cycle comes next. Fixing every household at the mean composition cuts estates from 18 to 4.5 and Gini from 0.54 to 0.34.
- Kin help comes next: removing it adds 7 estates.
- Village weather variance, interest (0.1 to 0.5), the floor and the default delay each move estates by 3 or less.

**3. Brakes** (`fig5_brakes.png`, `fig6_brake_combos.png`):
- **Debtors' politics.** Switching the remedy at a 30% debtor voice share gives 15 estates. A 20% switch gives 6.6, and 15% gives 1. It
  is the steepest single dial.
- **Partible inheritance.** At half strength it gives 13 estates, but Gini stays 0.53. At full strength estates fall to 10 while the
  households grow to 290, Gini rises to 0.67 and landless to 51%. It breaks estates and makes paupers.
- **Tenants leaving.** This gives no brake: estates stay 17 to 22. Gini falls to 0.34 only because the poor leave (households 200 to 150,
  people down 25%). It also switches off politics, because the debtors who would vote are gone.
- **Combinations.** Impartible with a 30% politics switch gives 15 at +2 a century. Half partible with no politics gives 12.8 at +1.
  Half partible with a 30% switch gives 8.9. Only full partibility (−2 to −7 a century) gives a level that holds or falls; every other
  setting in the band is a slow ratchet of +1 to +3 a century.

**4. Goodwill and patronage** (`fig7_goodwill.png`):
- **Kin help slows concentration.** Without it there are 26 estates, against 18 with it.
- **Feasting speeds it up a little.** Estates are 18 with feasting and 15 without; Gini is 0.54 and 0.47. Feasting empties the middling
  households' buffers, and the dispersed goodwill it earns does not cover a bad year.
- **Hard lenders become landed.** Mean generosity is 0.35 to 0.40 among estate holders, against 0.50 overall.
- **Patronage barely matters as written.** It moves 0.7% of output and makes no patron with 5 clients, because labour pays the gift back
  within a year or two. It slightly raises the estate holders' generosity (0.42), and with no loans it makes no elite at all. It is a
  second road only if owed days accumulate faster than they are worked off.

**5. Extraction ceiling** (`fig8_rent_ceiling.png`, `ceiling.py`). At R 1.67, a full tenant falls below need in these cases:
- at a rent of 0.39 or more in a median year;
- at 0.26 or more in a 1-in-4 bad year;
- at 0.09 or more in a 1-in-10 bad year.

At a rent of a quarter that is 24 short years a century; at R 2.0 the thresholds are 0.49, 0.38 and 0.24. In the simulation, with loans
against collateral only, tenants' hunger rises from 24% to 47% as rent goes from 0.1 to 0.6, and village hunger from 4% to 13%. Estates do
not move (15 to 17), because tenants have no land left to lose. Rent decides whether estates *live off rents*: rent-covers-need
households go from 0.2 to 10.6. **Rent plus interest are only 6 to 10% of output.** The brief's 40% leaving the farm cannot come from
debt estates; tithe, tax and sale must carry it.

**6. Distribution against the average.** The mean comes first, but at R 1.67 removing the life cycle equals raising R to about 2.1. Village
weather variance matters little, since it hits lenders too. The variance that sorts households into lenders and borrowers is
idiosyncratic: dependants per worker range from 1 to 2, single-person widow households, extinctions. Without the life cycle, weather sd
matters more (estates go from 0.7 to 4.0).

## Reflection

**What I had to add that the diagram lacks:**
- **A rule for who lends.** Unlimited credit masks hunger entirely; with collateral, landless hunger appears (32% of tenants).
- **A labour market.** Hands against tenants decides whether concentration shows as tenancy at all.
- **Store targets and a feasting propensity.** These are the surplus split's real dials.
- **Heir-split thresholds.** A minimum viable share decides whether partibility breaks estates or makes paupers.
- **A voice rule.** Who counts as a debtor, landed weight, a 10-point hysteresis.
- **An exit for the landless.** What becomes of tenants who leave.

**Where a link's sign was not enough:**
- "Tenants leave → weaker estates" has the wrong sign here.
- "Partible → less concentration" is positive for estates and negative for Gini.
- "Feasting → goodwill → slower concentration" is net slightly faster.

**The brief's landed rule (rents plus stores at least 1.5 times need) is not usable.** It counts 45 to 100 of 200 households, even with no
rents at all. Rent of at least need needs about 17 tenanted fields, so it counts 2 to 4. "Landed" needs a size or income-share
definition.

**Most useful views:**
1. The **regime map**, estates over R against a second dial with a trend label. It showed at once that the mean dominates and weather
   barely matters.
2. The **brake-combination grid** with trend per century. It shows the band is reachable but is a ratchet, not a level.
3. The **surplus budget bar.**

The Lorenz curves and the tornado were useful for diagnosis. The household trajectories showed estates growing in steps, one case at a
time, from year 10 to 50.

**For the balance diagram** I propose two views:
- a **surplus budget bar per R** (eaten, feasted, rotted, taken, sold) with the 40% extraction line;
- an **estate regime map** (R against brake strength) labelled "no elite / elite band / mass estates" with a ratchet rate.

**Inventions** (all in `P` in `model.py`):
- 6 fields a household, 8 days a field, 40 working days a worker;
- weather sd 0.2 with 8% bad years at ×0.55, household sd 0.15;
- a store target of 1 year;
- feast rate 0.5 times (0.5 + generosity), feast credit 0.5;
- 4 kin links;
- lenders keep floor plus half a year's need, and a lender is the richest of 12 asked;
- interest charged yearly on the balance;
- half of slack days are for hire;
- a vacant block is let to a village child at 0.3 a year;
- a minimum heir share of 4 fields;
- landed voice ×2;
- leaving only for indebted, hungry, landless tenants.
