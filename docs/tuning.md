# Tuning: what waits for a run

Parameters are tuned together, for gameplay balance, in runs that Kim starts (`AGENTS.md`, Deciding without Kim, 3). An agent that
measures a shortfall changes no value: it adds a row here, with what the parameter means and what was measured. Two things are not
tuning and do not wait: a formula that computes something other than it says (a fix), and a collapse (a reference scenario whose
median seed shrinks).

A tuning run reads this list, moves the parameters it chooses, measures with `node tools/bands.js` and the runs each row names, and
removes the rows it settles. What is judged is island-wide: growth over a scenario's seeds (`tests/lib/bands.js`, `GROWTH`).

## Where growth stands (12 November 2026, at `aa8c2f7`)

| Scenario | Seeds | Median growth a year | Seeds above their start | Range |
|---|---|---|---|---|
| Founders small, 50 years | 16 | 2.2% | 16 of 16 | 0.9% to 3.1% |
| Populous small, 30 years | 4 | 1.8% | 4 of 4 | 1.5% to 2.2% |
| Heirs small, 30 years (no target) | 2 | | 1 of 2 | -1.3% to 0.5% |

Both references meet the target (median at least 1%), so nothing below is urgent.

## Parameters waiting

| Parameter | What it means | Measured | Proposed, not applied | From |
|---|---|---|---|---|
| `SOIL.floor` 0.75 (`SOIL.wear` 0.08 a crop) | How far an unmanured field's strength falls; stubble grazed and a field rested keep some of it | A farm without cattle farms at 0.80 to 0.84 against 1.07 with them, and on 3 fields makes 0.71 of its need; such households are 69% of household-seasons | 0.85: an unmanured field yields up to 13% more, 0.71 becomes about 0.78; manure's worth falls by as much | VB-284, question 2; `docs/bench/food-balance.md` |
| `ECON.storeLoss` [0.05, 0.2, 0.4] | The share of grain lost in its first, second and later years in store | The hungry gap is summer and autumn (3.3% and 4.4% of need short), in households that start a season with under 12 days of food after two or three poor years | [0.05, 0.1, 0.4]: a household with a year and a half in store keeps 2 to 3 days of need more a year | VB-284, question 4 |
| `ECON.fieldYield` 100 | Rations a field in an ordinary year, before seed | Years 4 to 15 net 73 to 84 a field and no household is short | No change; the rise over centuries is VB-160's | VB-284, question 3 |
| Fences: mended at 0.65, broken through at 0.45 | The condition at which a fence is mended, and at which cattle get into a crop | Cattle never got into a crop in any run, so the rule has shown no consequence | No change until a village's routines can leave the fence out (VB-058, VB-100, VB-120) | VB-136, question 2 |
| `CLAIMS.contestBelow` 0.5 | How unworked a stake must be before it may be contested (about 18 months) | 421 projects, no contest and no lapse: projects finish within days | No change until projects can stall | VB-158, question 1 |
| The carts' numbers (`TRAVEL`, `CART`) | Loads of 30, 90 and 300 rations; paces; wear 2% a trip, mended below half; 6 misses a year for another cart; hours and timber to build | Seed 7, small: founders build 6 hand carts in 12 years and none wears out; populous 32 in 6 years; 179 hours a year of walking and carrying on a 4-field farm become 171 | None yet: VB-411 measures them over seeds first | The distance review, 13 Nov; VB-411 |

## Mechanisms on their way that move the same numbers

Measure after these, not before: VB-389 (fields wanted, net of seed), VB-390 (a cow for a new household), VB-391 (an ask that brings
nothing), VB-254 (the fields a head wants count its hands at the harvest), VB-106 and VB-319 (neighbours and hired hands at the reaping),
VB-312 (grain loans, which hunger is meant to drive).
