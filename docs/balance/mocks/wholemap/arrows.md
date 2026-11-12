# Arrow -> equation -> what I had to invent (draft 3, all 35 arrows and 5 flows)

Model: `model.py`, yearly step, 13 stocks: farm children C, adults A, old O; town T; elite E; land L; farm store S; goodwill G;
debt D; tenancy share Cn; brakes B; wanted goods W; money habit Mo (+ Ei, a smoothed elite income). Food in need-units (an adult's year).
"Invented" = the diagram's sign was not enough; the kind is in brackets: **[form]** functional form, **[thr]** threshold or gate,
**[sat]** saturation, **[unit]** unit or exchange rate, **[cons]** conservation or allocation order, **[dist]** needs a distribution, not a mean,
**[lag]** delay, **[stock]** a state the diagram does not name.

| # | Arrow (sign) | Equation used | Had to invent |
|---|---|---|---|
| 1 | births -> population (+) | C += births | none (a flow) |
| 2 | deaths -> population (-) | stage rates dC, dA, dO from the code's hazard | [stock] three age stages to carry the generation lag |
| 3 | population -> late marriage (+, slow) | couples = min(A/2, kH * L / f_home) | [unit] "home with means" = f_home fields; [thr] min(); kH share of homes held by fertile couples; [stock] land L and its clearing rule (clearing follows would-be couples) |
| 4 | late marriage -> births (-, slow) | births = fert * couples * (1 - h) | [lag] the generation lag lives in the stage structure, not the arrow |
| 5 | nursing gap -> births (-) | folded into fert (0.265 a married woman-year) | [form] a rate, not a link: no state varies it |
| 6 | deaths -> nursing (-, missing) | not modelled | the aggregate cannot represent it: it changes a per-woman interval |
| 7 | outside world -> population (+/-) | +imm a year, -emig * unmarried | [form] who leaves (the unmarried) |
| 8 | kept -> deaths (-) | d_stage * (1 + k_stage * h) | [dist] h is the mean deficit after help; "kept" as a mean is never below 1 at the target, so the arrow needs the share below need |
| 9 | kept -> disease (-) | dropped: hunger enters deaths directly | [form] disease needs its own state or it duplicates #8 |
| 10 | disease -> deaths (+) | town deaths dT0 + crowd * T/T50 | [form] [unit] |
| 11 | town -> disease (+) | as #10 | [sat] linear or crowding threshold, unknown |
| 12 | reach by water -> town (+, slow) | not modelled (a condition, per Kim) | it is a phase switch, not a lever |
| 13 | population -> food produced (-, slow) | P = y * min(target/y, L, lpw * workers * (1+owed)) | [thr] land ceiling Lmax and labour capacity lpw: the sign is negative only once land binds; before that it is positive. [form] Chayanov target output |
| 14 | share extracted -> kept (-) | Av = P - rent - tithe + S | [cons] order of claims: taken before eaten |
| 15/16 | kept -> help (-), help -> kept (+) | help = min(phi * D0, spare grain above floor) | [dist] D0 = E[(1-x)+] over a lognormal of households (cv_hh); [thr] floor; [form] coverage phi |
| 17/18 | help -> goodwill (+), goodwill -> help (+) | G' = G * 0.5^(1/4) + help + g_feast * feast + gift; phi = phi0 + (phimax - phi0) G/(G + G50) | [sat] G50, phimax; [unit] goodwill in food units |
| 19 | help -> debt (-) | borrow = beta * (deficit left after help), lenders' pool permitting | [cons] who lends (the elite's surplus); [form] beta |
| 20/21 | help -> patronage (-), goodwill -> patronage (+) | gift = pat * deficit left after borrowing | the +G arrow was not needed to write it; [form] |
| 22 | patronage -> concentration (+, slow) | dCn += k_pat * gift / fv / L | [unit] goodwill -> fields exchange rate k_pat |
| 23 | debt -> concentration (+, slow) | default = k_def * (D - 2 * repay); fields = default / (fv/2) * (1 - B) | [thr] two harvests; [form] k_def; repay rule rep_frac |
| 24/25 | concentration -> brakes (+), brakes -> concentration (-, slow) | B' = B + (kB Cn - B)/tau_B; heirs return split * Cn/25 * (1 + B) a year; default scaled by (1 - B) | [lag] tau_B; [form] how votes act; heirs' splitting is a separate always-on drain the diagram folds into B5 |
| 26 | concentration -> elite share (+, slow) | E* = smoothed(rent + tithe + repay)/cE; E moves by (E* - E)/tau_E | [unit] cE elite need a head; [stock] elite income; [lag] tau_E. The arrow is really "extraction income -> elite" |
| 27 | elite -> town (+, slow) | pass_ * elite surplus fed to the town | [cons] where elite income goes |
| 28/29 | wanted goods -> food produced (+), -> idle (-) | target = need (1 + m0 + m1 W/(W+W50)) / (1 - rent - tithe) + tax | [sat] W50; [form] m0, m1 |
| 30 | feasts -> goodwill (+) | g_feast per unit | [unit] |
| 31 | tax in silver -> sold (+) | offer = tax + share * surplus | [unit] tax level; [cons] the silver leaves, the grain goes to the town: one sale counted as both "taken" and "sold" |
| 32 | population -> town (+, slow) | mig = mu * unmarried * (1 - town hunger) | [form] who leaves; [thr] phase |
| 33 | concentration -> share extracted (+) | rent = 0.25 * Cn * P | (design gives the rate) |
| 34 | food sold -> town (+) | town food = sold to town + elite pass; town hunger raises deaths | [cons] buyers' capacity; export cap X_fair |
| 35 | goods from town and fair -> wanted goods (+) | W' = W + (goods/households - W)/tau_W | [unit] goods; [lag] tau_W |
| F1-F5 | made -> eaten, taken, feasted, sold, rots | ordered: taken, eaten (+ help), repay, tax and sale, feast above a reserve, rot by the code's tiers | [cons] the order of claims; [thr] reserve res, sale share s0+s1W+kMo Mo; feast share f_feast |

## Not on the diagram but needed

- **Land L and its ceiling Lmax** (a stock and a hard limit): the sign of #13 flips at the ceiling.
- **The farm's food store S** (a stock): without it food kept per head is a flow and bad years kill at once; with it, kept is about 1.6 and hunger nearly vanishes in the mean.
- **The spread between households** (cv_hh): every hunger-driven arrow (#8, #15, #19, #20, #23) acts on the tail, not the mean.
- **Elite income** as a stock between extraction and the elite: the elite tracks income, not concentration.
- **Money habit Mo**: R3 has no state on the diagram.
- **Phases**: six switches (fair, debt, crafts, ship, town) with dates; the diagram has a "planned" style but no time.
- **Who eats first** (the order of claims on the harvest) and **who lends** (a pool).
- **Labour capacity** (lpw): idle hours is a residual of target output over capacity.
