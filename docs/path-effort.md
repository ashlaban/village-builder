# Routes by effort and comfort: a design note (15 November 2026)

A note for Kim to answer before anything is built (VB-448). It changes a Decided point of `design.md` (Worn paths, 4: "route-finding
counts the faster walking"), which is why it is a note and not code: PR 132 built this inside a code task and was reverted for that
(14 November). Its research is kept in the history, `git show 0423f61:docs/path-effort-policy.md`, and section 3 draws on it.

## 1. The idea (Kim, 15 November)

"Effort and comfort influence pathing a lot. People will route to a bridge quite far to avoid getting wet. Even though the walking
speed might be similar on a path and through tall grass or uneven terrain, it requires more energy."

So a pawn does not take the quickest way. It takes the way it minds least, and what it minds is time, toil and discomfort together.

## 2. The proposal

Two numbers a tile where there is one today.

- **Time** is what it is: the ground's cost, the slope, the wear (`TERRAIN`, `SLOPE`, `PATHS`). The clock, the hours between villages
  and the bands of the Reach overlay run on it. Nothing here changes how long a walk takes.
- **Discomfort** is new: a named allowance a tile, 0 on firm dry ground, for what a walker avoids though it costs little time. Three
  causes, each with a physical meaning: *footing* (uneven or overgrown ground, by the kind of ground, taken away by wear as a path
  clears it), *wet* (a ford, marsh, soft low ground), and *load* (what is carried makes the first two worse).
- **The choice:** the route search minimises `time × (1 + weight × discomfort)`. With `weight` 0 it is today's search. One weight
  for all pawns to begin with; a trait could move it later (slice 7).

What follows from it, each a thing to check in a run and not a promise:

- A ford is slow today (cost 2) and would also be minded: a bridge draws routes from further off than its saving in time.
- A path through forest is preferred by more than its speed, so traffic gathers on few ways and they wear deeper. With dear forest
  (VB-444) this is what makes a path a bad road people keep to.
- Open meadow keeps a small footing allowance against a worn way, so desire lines form in the village as well.

## 3. Grounds (from PR 132's note; the sources are linked there)

- Uneven footing costs energy at the same speed: Voloshina and others measured 28% more net metabolic cost at 1 m/s on a surface
  uneven by up to 2.5 cm.
- Energy and time coefficients differ by ground (de Gruchy, Caswell and Edwards): by energy, grass 1.1, light brush 1.2, heavy brush
  1.5, bog 1.8, loose sand 2.1 against hard ground.
- Medieval ways show the two improvements apart: tracks braided round bad ground (use), and timber crossings, gravel and drains
  (building). Use gives footing; it does not drain.

None of this measures how far a person walks round to stay dry. That is a judgement for the game, and a tunable.

## 4. What it costs and what it risks

- **Two truths on the map.** The Reach overlay draws hours; the way taken would no longer be the quickest. The overlay should say so,
  and be able to draw the way a pawn would take.
- **Balance moves.** Longer ways round cost working hours. PR 132 switched it on by default with weight 1; this note proposes that it
  lands at weight 0 and that the weight is set in a tuning run of Kim's (Deciding without Kim, 3).
- **Cost.** One search a route, as now, on the choice cost; the compiled per-tile costs hold both numbers. If load enters the choice,
  the route cache is keyed by load class as well, and its bound (Rules for cost, 8) is shared between them: two or three classes, not
  a number a load.
- **No weather.** There is no daily rain or soil state, so *wet* can only be the standing kind (a ford, marsh, the generator's
  moisture). Mud after rain, snow and ice wait for slice 10.

## 5. Questions for Kim, with proposed answers

1. **Does discomfort only steer the choice, or does it also tire the pawn?** Proposed: only the choice, for now. Tiring needs a
   state a pawn (fatigue), its owner and its effect on work, which is a system of its own.
   **A (Kim, 2026-11-16):** Only the choice for now: discomfort alone. Fatigue is a system of its own.
2. **Does load count?** Proposed: yes, in two classes, on the back and with a cart: a laden pawn minds bad footing more, and a cart
   minds it most. It is what makes a built road worth its cost.
   **A (Kim, 2026-11-16):** Yes.
3. **How far round is a dry crossing worth?** Proposed as the first value to tune, with this meaning: a walker goes up to twice the
   time round to a bridge sooner than wade a ford, and no further.
   **A (Kim, 2026-11-16):** Yes.
4. **Is the same weight right for everyone?** Proposed: yes until slice 7; then a trait may move it (the hardy and the careful).
   **A (Kim, 2026-11-16):** Yes.
5. **May it land switched off (weight 0) with the numbers reported, and be switched on by your tuning run?** Proposed: yes.
   **A (Kim, 2026-11-16):** Yes, but it must be verified working first: shown to steer routes with the weight on, before it lands switched off.

## 6. Written into the design (VB-448, 23 November 2026)

The answers are in `design.md`, Worn paths (4, Sharing paths) and World and scale (Walking and terrain): discomfort steers the choice
only; footing, wet and two load classes; a ford's crossing minded as twice its time; one weight; weight 0 until Kim's tuning run.
The values are `DISCOMFORT` in `src/sim/walking.js`, read by `sim/routes`; the runs with the weight on are in `docs/tuning.md` (the `DISCOMFORT.weight` row).
