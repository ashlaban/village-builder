# VB-174 implementation plan and impact

Stores will own grain, cooked rations, sheaves, paid pawn stakes and food ledgers.
Owed shares remain in heirs/cottage as obligations, following target-v2 and the
later note in VB-174. Rules for meals, help, production and provisions stay with
their current modules; those modules call Stores with a good and a reason.

Ledger entries distinguish goods so conversions net to zero in the combined
food balance, while legacy harvest/gift/meat/milk/butter amounts retain their
meaning. Village ledgers are initialized for new villages and older saves.
No changes to choices, random draws, nutrition or resource quantities are intended.

Validation: conservation across three years for founders/populous seed 7 tiny,
operation errors and capped transfers, ownership scan, invariants, golden dumps
(only ledger changes), small-map yearly/balance comparisons and full verify.
Costs: ledger entries, save bytes and suite time; count ledger traversal work.

## Implementation

The new `sim/stores` module owns quantity changes, cooking, sheaves, threshing,
paid stakes, spoilage accounting, village spoilage and annual ledger pruning.
Rules call it in the original order. Village spoilage keeps the original
multiplication to preserve floating-point rounding. Existing production and gift
entries retain their kind, amount and descriptive from/to fields; each new entry
also identifies its good. Pawn stake entries carry `pawn` and `stake: true`, so a
household's food balance excludes the separately held paid share. Owed amounts
and their debtor remain in heirs/cottage under the later target-v2 decision.

New households record their starting provisions, including constructor supplies
replaced by a cottage, claimant or settler's own provisions. New villages get
empty ledgers; format-1 loads initialize missing village ledgers without inventing
historical transactions. Old household ledger entries remain readable. Larder
lots, animal husbandry and nutrition rules retain their existing owners.

The ownership allowance falls from 62 to 20 sites: 39 food/stake writes move to
Stores, while three owed-share sites leave this goods-only ownership check.
No new ownership exemption was added. There is no new pair pass or simulation
state cache. `storeWalk` counts village spoilage visits and annual ledger pruning;
all existing counter baselines are unchanged. Its tiny baseline is 0.0666666667
visits per living pawn-day over the 30-day measurement window.

## Evidence

- `tests/stores.js` checks capped transfers, conversions, invalid amounts,
  dissolved recipients and unknown reasons. Annual reconciliation covers 22,311
  food entries across founders 7 and populous 7 on tiny maps over three years.
- Before/after canonical golden dumps differ only on ledger lines: village keys
  at seeding, and household/village keys at years 1–3, for founders and heirs at
  seeds 7 and 42 (28 changed keys total). The calibration, public API, pawn,
  world and all other state hashes are unchanged.
- Populous 7, small, eight-year `tools/balance.js --json` reports are identical,
  including every household-year, hunger and food production, not just averages.
- Yearly `tools/sim.js` lines match, excluding measured `ms/day`, for founders 7
  small over ten years and populous 7 small over eight. The eight-year decoded
  populous saves are deeply equal after removing household and village ledgers.

At populous 7 small after eight years (94 occupied households), retained entries
per occupied household per year in the last three-year window rise from 27.13 to
227.23. This is the explicit cost of recording seed, meals, conversions and daily
spoilage. Raw save JSON rises from 8,701,753 to 13,030,614 bytes; gzip from
1,671,326 to 2,218,225 bytes. Ledgers retain the existing three-year annual-pruning
policy. These are storage costs; the simulation's choices and food outcomes are
unchanged.

The strict dissolved-holder contract exposed a health-test setup that continued
to feed its emptied household after all members died. The production clock
already skips dissolved households. The test now follows that same guard; the
100-year founders health report passes without changing nutrition rules.

The historical ownership scanner could not see generic `holder[k]` writes.
Stores therefore uses explicit quantity setters and a village-ledger writer;
`tests/tools.js` and ownership checks pass without loosening their thresholds.

`npm test`: 71 scripts pass (300.2 seconds, with other validation jobs running).
All four late fixtures, save/load continuity, five long invariant runs, desktop
and mobile browsers, golden states and all 15 history counters pass. The first
full suite exposed the health-test setup above; the corrected health test also
passes on its own. A final clean full-suite run is recorded below when complete.
The prior source commit recorded 241.7 seconds for its 83-script verify suite;
wall-clock totals here must be interpreted with concurrent validation load.

## Final verification

The final `npm run verify` passes all 84 scripts in 284.4 seconds, using
`VB_CHROMIUM=/usr/bin/chromium`, `VB_SOFTWARE_RENDER=1` and four test workers.
The previous source commit's recorded 83-script verification took 241.7 seconds;
this is a reported suite cost, not a controlled performance benchmark. Four of
four late saves checked, no missing fixtures; five invariant runs, deterministic
saved continuation, golden states, desktop/mobile browsers and all 15 history
counters pass. Build freshness and whitespace checks pass. VB-174 is complete.
