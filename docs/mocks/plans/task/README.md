# Study A: the task as a plan (P1 to P4)

A throwaway study of design 2.2 of "Plans at four scales" (`docs/plans/four-scales/design-v1.md`, not the repository's `design.md`). It asks
whether a task can hold no phase, its next leg worked out from the world each time a leg ends; whether that removes the rare exits and
the per-kind hooks; and what choosing the method by where the pawn stands saves. No game code is changed; nothing here is game code.

| Script | What it does | Time |
| --- | --- | --- |
| `tally.js` | Reads `VB['sim/kinds'].KINDS`. Lists each kind's control fields and gives its methods, written by hand as data in the eight primitives. Sorts the 27 `deliver` hooks by what they do. | 1 s |
| `micro.js` | A standalone micro-world with two engines: the derived `next` and a phase machine written as `sim/agents` does it. It fuzzes both with seven cuts, plays design 2.2's firewood table, and times `next`. | 2 s |
| `observe.js` | An observer over the real run (6-minute steps, reads `st` only). It records the tasks begun with their distances, the walking hours by kind, the leg ends a pawn-day, and offline nearest-next re-ordering. | 4 s to 21 s a run |

```
node docs/mocks/plans/task/tally.js --json docs/mocks/plans/task/out/tally.json
node docs/mocks/plans/task/micro.js --runs 10000 --time 1000000 --json docs/mocks/plans/task/out/micro.json
node docs/mocks/plans/task/observe.js --scenario populous --seed 7 --map small --from 1 --years 1 --json docs/mocks/plans/task/out/populous-7.json
node docs/mocks/plans/task/observe.js --scenario founders --seed 7 --map small --from 0 --years 3 --json docs/mocks/plans/task/out/founders-7.json
```

Seeds: the observer runs populous small at seeds 7, 11 and 42 (year 1 observed, year 0 run first) and founders small at the same seeds
(years 0 to 2). The micro-world's fuzz run *i* draws from `mulberry32(i + 1)`, i < 10,000. The forced owed-day case uses seeds 50001 to
51000 and the timing states 900 to 1099. Total machine time was about 3 minutes.

## Results

| Prediction | Predicted | Found | Verdict |
| --- | --- | --- | --- |
| **P1** derived engine | 0 violations in 10,000 fuzzed runs | **With the methods as 2.2 writes them** (a method names its sources: the forest, the field, the store): **191 / 10,000** (1.9%). All are *stranded*: a load set down by night (13), illness (92) or death (86) lies where no method of its kind looks. Sow (100) is seed set down at the field; hay (48) and sheaves (43) are loads set down at the farm tile, not in the store. Mass is conserved and no pawn is left holding a load, but `next` answers `blocked: no seed` while the seed lies on the field, which is a false reason. **With one generic method added** (the nearest pile of a good the goal uses, lying where its kind neither makes nor wants it, brought home): **0 / 10,000**, and all 10,000 goals met. | **Refuted as written, confirmed with one more method.** The mechanism holds; 2.2 leaves out the method that finds a stray pile, which is what the fetch kinds do today. |
| **P1** phase machine | VB-1548 at least once in 1,000 runs of the owed-day cut | Owed-day cut: **225 of 1,421 runs** in the mixed fuzz (202 stuck, 109 with a load lost). Forced case, the wood job on an owed day: **258 / 1,000 stuck**, with the job's work done and no carrier (`stuck:doneNoCarrier`). Every other cut: **0**. | **Confirmed.** The derived engine has 0 in the same forced case. |
| **P2** | ≤3 methods of ≤8 primitives a kind; the 27 carrying kinds need no hook; ≤5 misfits; the kind record falls from 51 fields to ≤32 | 94 kinds become 87 (the 7 fetch kinds become a method of their base kind). Every kind fits in at most 3 methods of at most 7 steps, in 14 shapes. 2 misfits: `herd` and `spin`. Neither carries a load, so no carrying kind needs a hook. 15 control fields fall away, leaving **51 → 37** with `methods`. 10 of the 27 `deliver` hooks carry the work's *effect* (the tree felled, the catch rolled, the bog dug, all at the door): those hooks move to the work leg, they do not vanish. | **Mechanism confirmed, number refuted** (37, not ≤32). The kept fields are labels, effects, timing and ranks, not control. |
| **P3** begun beside | ≥8% of tasks away from home begun within 1 step of the site | populous 26.8 / 22.7 / 24.7%; founders 32.0 / 39.0 / 28.8% (seeds 7 / 11 / 42). Within 1 step of the site, or within 1 of the previous site and 2 of this one: 31 to 48%. Water alone gives a quarter of the beside cases (1,217 of 4,791 in populous seed 7); without water the share is still 23%. | **Confirmed.** |
| **P3** walk saved | Nearest-next within equal urgency: ≥10% of wood, stone and haul walking; ≥4% of all walking | All: populous 1.9 / 1.7 / 2.1%, founders 1.3 / 1.5 / 1.1%. Wood 0.1 to 0.6%; stone 2.0 to 4.9%; haul 0.7 to 3.7%. | **Refuted**, at every seed, by 2× (all) to 20× or more (wood). The reason is under Surprises. |
| **P4** calls | `next` asked ≤14 times a pawn-day | Leg ends during a task: 5.9 to 6.3 a working pawn-day in populous, 7.9 to 8.6 in founders (3.9 to 7.4 per living pawn-day). In the micro-world `next` is asked 1.64 times a leg (its `done`, `blocked` and rule answers included), which gives **9.7 to 14.1** asks a working pawn-day. | **Confirmed, at the bound** for founders. |
| **P4** cost | <1 ms a game day for 1,000 pawns | 0.24 µs a call in the micro-world (10⁶ calls, the stray search included). 1,000 pawns × 9.7 to 14.1 asks ≈ **2.3 to 3.4 ms a day**. On leg ends alone: 1.4 to 2.0 ms. | **Refuted on the number, by 2 to 3×**, in a world far smaller than the game's. It is still small beside the 75 ms jobs-and-matching line. |

### P2 in detail: the kinds as methods (`tally.js`, `out/tally.json`)

| Shape (methods; steps each) | Kinds |
| --- | --- |
| work at the site (2) | 35: plow reap weed clear break meadow reclaim restore rake mow fodder milk slaughter shear grub foundation roof barnroof booth shelter raise green sweep mend repair herd* mendcart tarpit ditch blaze drink byreroof timberroof raisestage mendfacility (and fell) |
| work at home (2) | 12: cook brew thresh salt grind hewQuern mendtools cobble harness spin* weave firewood |
| input brought, then work (5) + work (2) | 16: sow walls barnbase barnwalls well dry boat cart burntar tarhouse tarboat smelt housewell loom byrewalls timberframe |
| gather and carry home (5) | 5: fish gather hunt rackfish boilsalt; with a cart (7) + on the back (5): pick quarry dig |
| a pile to a store, cart (6) + back (4) | 5: haul hay leftTimber leftGrain wellstone; the 7 fetch kinds become the back method of their base kind |
| cut and stack: cart (7) + back (5) + pile (4) | wood. It is the only kind with three methods. `stack` becomes "the load waits until the pile fills the cart or the trees give out", a precondition. |
| barrel (6) + back (4) | water boothwater |
| led home (4) | lead drove leftCart (the load walks) |
| carted out, spread (5) + work (2) | manure (`carted` becomes the cart's return) |
| wait for hands, work (3) | workfence workclear |

The control fields that fall away (15): `load stack back carry to deliver again stages reload setDown fetch setOut carted inside trip`.
The 36 kept are `verb go name at needs gives label anim hours hands type field spot urgency done available pace norm window vital
draw evening first late project worked words craft together minAge attention reach rate held yields rank`. Adding `methods` makes 37.
Design 2.2's list of what a kind keeps misses `spot` (75 functions), `available` (68), `done` (66) and `worked` (11). These are the
work's placement, its opportunity and its effect, and no method replaces them.

The misfits: **`herd`** is held at the side for a day while other legs run (`held`, `attention`, the side slot). **`spin`** is worked at
the side of minding (`attention`, `reach`, `rate`). Each needs a ninth primitive, `mind` (a charge held across other legs), or keeps
its hook. **`restore`** fits but founds a household and moves its actor, so `next` must re-read the pawn after its `work`.

The `deliver` hooks, sorted:
- **A plain unload**, which the generic `unload` replaces: 11 (`haul`, `hay`, `leftTimber`, `leftGrain` and the 7 fetch kinds).
- **The effect at the door**, which moves to the work or load leg: 10. `wood` and `timber` fell the tree on delivery; `pick` takes the
  stones off the tile on delivery; `dig` digs the bog on delivery; `hunt`, `fish`, `gather` and `rackfish` roll the catch on delivery;
  `boilsalt` fells its fuel on delivery.
- **No store at all**: 6. `water` is the household's cover, `boothwater` a booth's day, `wellstone` a project's step, `lead` and
  `drove` the herd, `leftCart` the cart.

For these 16 the load in hand today is a promise, not a good. "Progress lives in the world" is only true once the good is made where
the work is done.

What replaces the inline cases of `sim/agents`:

| Inline case | The fact `next` reads instead |
| --- | --- |
| `ended`: `K.stack` (cut again while the cart has room, the pile short, and the day has hours) | The pile at the tile against the cart's room, and the goal's amount; the load step's precondition |
| `ended`: `Carts.take`, `Carts.missed` (a load on the back while more waits) | The cart's place and holder. The miss becomes a `blocked: no cart` reason passed up. |
| `ended`: `K.carry` and `again` (`j.done = 0`, `reload` hours) | The pile still at the tile; the goal's amount not reached |
| `ended`: the destination (`to`: woodpile, door, barn, site; a common field to the green) | The goal's store and its place |
| `ended`: `K.carted` (the dung cart home, worn) | A cart in hand off the goal: the rule returns it |
| `complete`: `j.plot` (`finishStep`) | The stage's progress record (`sim/progress`); the project's step is done when it is |
| `complete`: `freeHands` (the others stop) | The goal met: `next` answers `done` to each |
| `complete` and `deposit`: a delivery that moved its pawn | The pawn re-read at the next ask |
| `deposit`: `again` reopens the job for the next load | The amount not reached |
| `arrived` and `start`: `K.inside`, `K.setOut` (the barrel) | The place (the house); a `fetch cart` step |
| `arrived`: a load brought in after the work day (VB-1547) | The rule for a load in hand |
| `release`: `setDown` at its own field, `Lying.lay` elsewhere, spilt if no kind fetches it | A pile at the tile. At the source tile the pile *is* the source (stooks, hay cocks). The spill needs a container pile (water). |
| `release`: `standCart` | The cart is a thing at a tile |
| `stopWorkFor`: the household going | The rule, with no owner's store: a pile |
| `sim/days goHome` (VB-1548: job and load held, the claim cut at 18:00) | Nothing: the owed window ending takes the goal from the pawn, and the rule for a load in hand runs |

### P1 in detail: the fuzz (`micro.js`, `out/micro.json`)

The micro-world: a farm, a forest (100 trees), a well, a field with 12 stooks, a meadow, a shore, a building site and a creditor's
farm. Walks are hex distance × 0.30 h a step (the observer measured 0.27 to 0.34), × 1.2 with a cart. The cart carries 4, the back 1.
Eight kinds: firewood (fell, load, haul, unload, cut), water, sheaves, hay (mow then haul), sow (seed fetched from the store), build
(timber brought to the site), fish and milk. Pawn A works the goal, on an owed day for the creditor when the cut is `owedEnd`. B and C,
the goal owner's people, take it up from day 1 and work three days.

| Engine | Violations | By cut | Goals met |
| --- | --- | --- | --- |
| D, backward reading, methods as written | 191 (stranded 191) | night 13, illness 92, death 86 | 9,809 |
| D, backward reading, plus the stray method | **0** | none | 10,000 |
| D, forward reading (the text of 2.2, literally) | 1,879 (stranded) | every cut | 3,977 (a livelock: `go`, `haul`, `go`, `haul`) |
| P, the phase machine | 225: stuck 202, mass 109 | all `owedEnd` (15.8% of its 1,421 runs) | 9,629 |
| P, forced owed-day wood case | 258 / 1,000 stuck | | |
| D, forced owed-day wood case | 0 / 1,000 | | |

Design 2.2's firewood table, asked of `next` (backward reading):

| State | Steps `next` gives |
| --- | --- |
| At home, the cart at home, no timber | fetch, go, work (fell), work (fell), load, haul, unload, work (cut), work (cut), leave the cart, done |
| On the forest tile, no cart | work (fell), load, haul, unload, work (cut), go, load, ... (back loads until the amount is met) |
| Timber lies at the tile (the night cut) | fetch, go, load, haul, unload, work (cut), work (cut), leave the cart, done |
| Called off on the road with a load | haul, unload, work (cut), work (cut), done |
| Timber already at the farm | work (cut), work (cut), done |

All five rows match the design. The forward reading fails every row: after `haul home`, the effect of `go to the forest` is no longer
true, so it walks back.

### P3 and P4 in detail: the observer (`observe.js`, `out/*.json`)

| Run | Tasks begun | Away from home | Beside (≤1 step) | Mean steps to the site | Walking h | Saved h (share) | Wood / stone / haul saved | Leg ends a pawn-day (in a task, a working pawn-day) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| populous 7 | 29,789 | 17,878 | 26.8% | 3.09 | 22,049 | 421 (1.9%) | 0.4 / 3.4 / 2.6% | 8.1 (5.9) |
| populous 11 | 31,331 | 17,137 | 22.7% | 3.34 | 23,758 | 400 (1.7%) | 0.3 / 3.7 / 1.5% | 7.9 (6.0) |
| populous 42 | 30,502 | 17,724 | 24.7% | 3.22 | 24,176 | 496 (2.1%) | 0.4 / 4.9 / 3.7% | 7.8 (6.3) |
| founders 7 | 5,415 | 2,579 | 32.0% | 2.83 | 3,643 | 46 (1.3%) | 0.5 / 2.0 / 0.7% | 9.4 (7.9) |
| founders 11 | 5,764 | 3,153 | 39.0% | 2.44 | 3,666 | 55 (1.5%) | 0.6 / 4.4 / 0.8% | 9.7 (8.6) |
| founders 42 | 5,322 | 2,757 | 28.8% | 2.55 | 3,634 | 40 (1.1%) | 0.1 / 3.2 / 2.2% | 10.1 (8.0) |

How the observer reckons the saving:
- Walking hours are 0.1 h for each 6-minute step a pawn has a path and a job. The mean cost a step comes from the walks themselves
  (hours over straight hex distance, 0.27 to 0.34).
- The saving is reckoned on straight distances times that mean.
- A task is re-ordered only within a pawn-day's consecutive run of one class (vital, windowed, other). That stands in for "equal
  urgency"; the kinds' `urgency` functions were not evaluated.
- A task moves only to a slot after it was posted.
- A carrying task's approach starts from home.

Families: wood = wood, fell, timber, firewood, leftTimber and their fetch kinds; stone = pick, quarry, wellstone, clear; haul = haul,
hay, leftGrain, leftCart, manure and their fetch kinds.

## What the mock leaves out

- **The micro-world.**
  - One cart, three pawns, eight kinds, one goal at a time. No competing goals, so no choice of goal and no claim.
  - No hunger, weather, spoilage or frost (a stray pile does not rot, as `sim/lying`'s do).
  - No owner title on a pile: a pile is the goal owner's by where it lies.
  - Helpers are modelled crudely, as an hour of work added.
  - The "cart taken" cut only takes an empty cart.
  - Work is cut at 18:00 by the day's end (the progress kept); walks finish.
- **The phase machine** has the real exits (`release` with its `dropJob`, the call deferred on the road, `sim/days` sending a pawn
  home with its job held) and none of the special cases: no ox team, no helper's side slot, no `stopWorkFor`, no fetch kind's `src`.
  It gives no pawn the cart at the load site. The real `wood` takes one there, and this mock does not check whether that is a teleport.
- **The derived engine's rule** ("haul it home if the walk fits the hours left, else set it down") follows the design literally. At
  18:00 every load in hand is set down, where the real code carries it on home (VB-1547).
- **`next`'s cost** is measured on closures over a tiny world. The game's `next` reads piles by tile, carts, stores and stage records.
  It would cost more, not less.
- **The observer**:
  - "Beside" is measured when `agent.job` changes, with the pawn's tile then.
  - Leg ends are changes of `agent.leg` sampled at 6-minute steps, so legs shorter than a step merge. That is why it finds 7.8 to 10.1
    leg ends a pawn-day where design 5.6 assumes 12.4.
  - The re-ordering is an offline bound on the tasks the pawn actually did. It cannot add a task it did not take.
  - It does not model the shorter method that standing at the site would choose (2.2's row 2). The saving there is the walk home for
    the cart, which nearest-next does not count.

## Surprises, and what they suggest for the design

1. **Steps need preconditions, and `next` must read them from the goal backwards.** Taken literally, "the first step of the first
   method whose effects are not yet true" livelocks on every carrying kind. `haul home` undoes the effect of `go to the forest`, so the
   pawn walks back. The working reading is a triangle table (Nilsson's teleo-reactive programs): scan from the last step and take the
   last whose precondition holds and whose effect is not yet true. Write `Step` with `pre` and `eff`, not effects alone. "Wait until the
   cart is full" (the `stack` branch) is then a precondition on `load`.
2. **Removing the fetch kinds strands goods unless one generic method replaces them.** Methods name their sources. A load set down by
   the night, an illness or a death lies where no method looks, and `next` gives a false reason ("no seed" with the seed on the field).
   One generic method makes the derived engine perfect in the fuzz (0 of 10,000): "a pile of a good the goal uses, lying where its kind
   neither makes nor wants it, is fetched to the owner's store first". It must also say who has title to a pile (`sim/lying`'s `owner`
   already does) and how a pile leaves the world (`sim/lying`'s frost).
3. **VB-1548 is one exit that skips `release`, and the phase machine is only as safe as its least careful exit.** Every cut that went
   through `release` gave 0 violations. The owed day's end, which sends the pawn home with its job held, gave 15.8% stuck or lost. The
   first draft of this mock's phase machine left out `release`'s `dropJob` (one line), and its death and illness cuts then stuck too.
   The derived engine has no exit code to forget. That, not the count of violations, is the case for design 2.2.
4. **"Progress lives in the world" is false today for 16 of the 27 carrying kinds.** Their `deliver` makes the good, or its effect, at
   the door: the tree falls, the stones leave the tile, the catch is rolled. A load in hand is a promise, so a load set down is a promise
   set down. Step 3 of the path must first move each effect to the work or load leg. That is a behaviour change, and should be counted as
   one: trees fall a walk earlier, and a dead carrier's catch now exists.
5. **Re-ordering a pawn's day saves almost nothing, because carrying tasks are stars from home.** 73 to 75% of walking is the approach,
   but a carrying task begins and ends at the farm, so its order does not change its walk. Only half the tasks fall in a run of two or
   more of one class. Wood is one long trip a day (0.1 to 0.6% saved). The quarter to third of tasks begun beside their site come from
   *when* and *by whom* the task is taken (water, at the farm's own source, is a quarter of them), not from re-ordering. Design 5.4's "nearest
   to where the last one ends" is cheap and harmless, but it should not be counted as a saving. The case for choosing the method by where
   the pawn stands rests on the cart and the stray pile, not on the walk.
6. **The set-down threshold is too eager.** With "set down if the walk does not fit the hours left", every load in hand at 18:00 is set
   down: 915 set-downs in 10,000 runs. Each is a walk out and back the next morning, against an overtime walk home that averages under
   an hour (3 steps × 0.3 h). The rule should compare the walk home with the fetch it would cost, allowing the overtime that VB-1547
   already allows. Death, illness and a household gone always set down.
7. **The cost is about calls, not tests.** The bound of ≤14 asks a pawn-day is met only because the observer counts 6 to 9 leg ends,
   not design 5.6's 12.4, and each leg's end asks `next` about 1.6 times (the rule, `done`, `blocked`). Budget about 2 to 3 ms a day
   for 1,000 pawns, not under 1 ms, and keep `next` from scanning piles: index the stray piles by owner.

**Also asked.**
- **Which goods lie in a pile at a tile today?** Sheaves (stooks, `field.held`), hay (cocks, `meadow.held`), stones on the land
  (`w.stones`), and `sim/lying`'s loads: leftTimber, leftGrain, leftCart, hay, and the haul, wood and wellstone loads released on the
  road.
- **Which would need a pile?** Water (spilt today, VB-1604; it needs a container left standing), the catch, game, gathered food, dug
  clay, ore and peat, salt, a stone basket (`pick` and `quarry` are spilt today), seed carried to a field, and animals led home, which
  would be a herd standing at a tile.
- **Is a partial load set down mid-road ever worth it?** Only when the carrier cannot walk on (death, illness, a household dissolving).
  For the night and an owed day's end, carrying on to the owner's store is cheaper than the fetch.
- **Which kinds' progress has no natural place?**
  - Fishing, hunting and gathering. Their partial hours mean nothing until the catch. The mock kept them on a record at the shore, so
    B finishes A's two hours of fishing, which is odd. A cut there should lose the hours.
  - Herding and spinning at the side, which are a held charge (the misfits).
  - Water.
