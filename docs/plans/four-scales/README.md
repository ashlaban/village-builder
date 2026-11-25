# Plans at four scales: the design after the mocks (v2, with Kim's answers of 25 November)

25 November 2026. v2 of the design, rewritten around **the levy** after Kim's answers of the same day (section 6, in Kim's words;
taken into sections 1 and 3). It replaces `design-v1.md` of this folder (kept for the record; the mocks tested it) and stands on its own.
Nothing in the repository's code, `design.md` or backlog is changed by it. It rests on the review of the job system
(`docs/review-jobs-2026-11-25/README.md`), on `design.md` sections 1, 7, 9 and 15, and on three mock studies run
against v1: `docs/mocks/plans/task/` (Study A), `docs/mocks/plans/week/` (Study B) and `docs/mocks/plans/village/` (Study C). Type
sketches are TypeScript-style: shape and ownership, not code to build. *Measured* means measured by a mock or an earlier document;
everything else is a proposal or a prediction (section 4). "Claim" means a land claim only; a body's hold on labour is a levy.

---

## 1. For discussion

### What is decided (Kim, 25 November; section 6)

1. **The day is the unit in which hours are allotted.** The head's day, as built, is kept. Ahead of today a plan holds only what
   can be known: who sees to what (duties), what has a date, and at the season how much is still to do. The days ahead are the
   player's main planning surface; the day is their outcome.
2. **The levy couples the levels.** Every body holds a concrete levy on the labour of those within it: an estate on its villages, a
   village on its households, a household on its members. A parent plan's levy is the budget a child plan runs within. What a levy
   leaves a pawn is its **own hours**; **sovereignty** is the measure, the share of a pawn's hours that are its own.
3. **A household's levy on a member is in hours a day, by season**, set by custom by the member's position, lowered by the head's
   grant, asked about by the member, and breachable by either side at a social cost. **Outer levies** (a village's routine, the
   alderman's keep, a creditor's days, an estate's due) are in adult-days in a window.
4. **Realistic levies from the first build**: below a member's working hours, so every balance number moves and Kim starts a measurement.
5. **Own hours, before slice 8**, go to pastimes, courting, rest, and some given back to the household by the pawn's diligence. Own
   hours as a road to a livelihood (the potter, 3.3) wait for personal goods and for skill that grows; they are why the levy exists.
6. **Who names the day is a term of each levy.** Power shows in the terms, not in a rule.
7. **Breach is one mechanism at every level**: the ladder first, then the head's judgement of what keeping costs against what this
   levier does to those who breach. There is no separate threshold.
8. **The size of a village's lots is a village custom**, starting by fields.

### What is proposed and still open

- **One plan record for every body and horizon, with an author on each step** (3.4): the body's rule, or a verb issued by whoever
  controls the body's agent. The played pawn's plan is this record; `st.player` holds the frame only.
- **A task is a plan, worked out from the world** (3.2): no phase; methods as rows of steps with a precondition and an effect, read
  backwards from the goal; a stray good fetched by one general method. This removes the exit behind VB-1548 and the carrying hooks.
- **The levy's starting values, its bookkeeping and its relation to `sim/obligations`** (3.3), all Proposed.
- **A path of twelve steps** (3.10), six of which leave unplayed behaviour unchanged.
- **Questions 7 to 12** of section 5, and the new questions that taking the answers in raised (section 5, 13 to 20).

### What the mocks overturned

- **The week as the unit of assignment** (v1's centre). Only 31 to 32% of a household's task-hours can be foreseen a week ahead with
  their hours (the *kinds* 76 to 80%). Assigning by the week starts windowed work later, misses two to four times as many windows,
  leaves more vital hours unmet, and weighs as many pairs as today. v1 was wrong here, and wrong about the cost saving it promised (P6, P15).
- **The hours budget as v1 reckoned it.** Households work 67 to 85% of adult working hours from spring to autumn, autumn being a peak;
  one flat share of 0.85 for everyone would bind in a third to a half of household-weeks. v1's shares (P10) were derived from idle
  figures, not measured. The levy answers this by being a custom by position and season, in hours a day, and by being breachable.
- **The alderman as scheduler.** A household naming its own day within the levier's window removes almost all the harm; the
  alderman, with last year as his guide, removes a quarter to a half. He lacks information, not accuracy.
- **A rule for not turning up.** v1 switched it on the outlook's label "bad", which breaks A label is read, never a switch, and is not monotone.
- **Three details of the task engine.** Steps need preconditions and a backward reading (the forward reading of v1 walks in circles);
  a general method must fetch stray goods; and for 16 of the 27 carrying kinds the good is made at the door today, so "progress
  lives in the world" needs a change of behaviour first. Ordering a pawn's day by nearness saves 1 to 2% of walking, not 4 to 10%.

### What held

The task without phases (0 stuck in 10,000 once the general method is added, against 258 in 1,000 for the phase machine in the
owed-day case); methods as data for all 94 kinds bar two; days owed as levies in days; substitution; "fill, don't overwrite",
given slot-in; the count of decision points an external controller would face; and the list of ten plan-authoring acts that no
unplayed pawn can reach today.

---

## 2. What the mocks showed

### 2.1 Prediction by prediction

| | Predicted (v1) | Found | Verdict | What changed in the design |
| --- | --- | --- | --- | --- |
| P1 | No stuck task, no stray good in 10,000 fuzzed runs; the phase machine sticks on an owed day ending on the road | As written: 191 stranded loads (a set-down load lies where no method looks). With one general method: 0. Read forwards, as v1's text says: a livelock. Phase machine: 258 of 1,000 stuck in the owed-day case, 0 in every cut that goes through `release` | Refuted as written; the mechanism confirmed | Steps carry `pre` and `eff` and are read from the goal backwards; a general "bring a stray pile home" method; piles have title (3.2) |
| P2 | ≤3 methods of ≤8 primitives a kind; ≤5 misfits; the record falls from 51 to ≤32 fields | 94 kinds become 87; all fit but `herd` and `spin`; 15 control fields go, 37 remain. 10 `deliver` hooks carry the work's effect, 6 have no store | Mechanism confirmed, number missed | A ninth primitive, `mind`; `spot`, `available`, `done`, `worked` are kept; the effect moves to the work leg as a step of the path |
| P3 | ≥8% of tasks begin beside their site; nearest-next ordering saves ≥4% of walking | 23 to 39% begin beside; ordering saves 1.1 to 2.1% (wood 0.1 to 0.6%) | First confirmed, second refuted | Nearest-next is kept as a tie-break and no longer counted as a saving. The case for choosing a method by place is the cart and the stray pile |
| P4 | ≤14 asks a pawn-day; under 1 ms a day | 9.7 to 14.1 asks; 2.3 to 3.4 ms in a toy world | Calls confirmed, cost missed 2 to 3× | Budget 5 ms; stray piles indexed by owner |
| P5 | ≥85% of a week's task-hours foreseeable; under 70% refutes the week | 26 to 32% with hours ±25%; 76 to 80% by kind alone | **Refuted** | The week no longer holds hours. Ahead of today: duties and dated things only (3.1) |
| P6 | ≤0.7 reviews a household-day; ≤40% of today's pairs | 1.3 reviews; 85 to 125% of the pairs. Today is 3.5 allotments a household-day, not 4.4 | **Refuted** | No saving claimed from planning ahead. A smaller one is sought from partial repair (3.5) |
| P7 | ≤10% of steps move; ≥80% of days begin as yesterday; windowed work no later in ≥95% | 13 to 15% move; 62 to 64% (today 63 to 66% on populous: the 72 to 73% I cited is founders'); 58 to 61% no later | **Refuted** | Duties only for recurring work without a window; windowed work is allotted by the day, all hands, as today |
| P8 | Vital hours unmet and windows missed within 10% of a daily allotment | Vital 1.4 to 2.3× worse; windows 2 to 3.7× worse on populous | **Refuted** (between two models: the daily mock misplaces 28 to 32% of member-kind hours on populous) | The day's allotment is kept as the default author of the day |
| P9 | One review after a death or illness; no target lowered off-peak or for 3+ adults | One review, by construction. Autumn is a peak. A three-day illness costs twice the vital hours under the week and lowers a target in 30% of small households | Mixed | A step whose holder cannot work falls to the pool at once; no target is lowered for an absence shorter than the step's window |
| P10 | Household 45 to 60% at peaks, 20 to 40% otherwise; own ≥35%; a 0.85 ceiling binds under 10% | Household 67 to 85% spring to autumn, about 50 to 55% in winter; own 18 to 30% outside winter; the ceiling binds 33 to 55%; village 3 to 5.5% | **Refuted** (measured on hours worked, which "work beats idling" fills) | After Kim's answers: the levy, a custom in hours a day by position and season, not one flat share; breachable; own hours given by diligence (3.3) |
| P11 | Cost least at 4 or 6 days | Reviews flat in the window's length; stale hours and missed windows rise with it; least at 3 | **Refuted** | Dated commitments reach 3 days ahead by rule (the notice); the page shows six |
| P12 | Alderman's placement displaces ≥30% fewer windowed hours than the calendar | 21 to 53% fewer, 2 of 3 seeds under 30%. The household's own choice: 97 to 100% fewer, with near-foresight. Random days are worse than the calendar | Number missed, mechanism holds | Who names the day is a term of the levy: for a village's routine the levied household; the calendar's days stay for work done together; the alderman's load estimate is dropped |
| P13 | An estate's 3 days cost 3+ adults under 2% of sowing and one adult ≥10%; defaults under 5%, three times that in a lean year | 3+ adults 2 to 6% on the worst dates, under 1% spread; one adult 48 to 82%; defaults 1 to 8%; lean year 0.6 to 4.9×, not monotone | Half confirmed | After Kim's answers: no trigger of its own. A ladder of answers, then breach by the head's judgement of cost against this levier's consequences; lots a village custom |
| P14 | Empty controller identical; lookahead no worse; ≤1.5 / 0.2 / 2.5 decision points; ≥5 acts unreachable | Identical by construction only; the lookahead that levels its own load misses 5 to 13× more windows; about 0.9 / 0.15 / 1.2; 10 acts unreachable | Mixed | An authored step carries a `by` and can be handed back when at risk; five more decision points; the ten acts are the migration's list |
| P15 | Jobs and matching from 75 to ≤35 ms | Not tested directly; P6 removes its basis | **Withdrawn** | Section 3.8 claims no saving beyond partial repair |
| P16 | With 30% of steps authored: no double manning, no ceiling exceeded, vital within 5% | Holds only when due work is slotted in; planned as ordinary steps, vital work is crowded out in 60 to 100% of runs | Confirmed conditionally | Slot-in of due and vital kinds takes precedence over any authored step, by the `plan` verb's check |

### 2.2 Surprises taken up

- **The kinds can be foreseen; the hours cannot** (B 1). This decides the shape of every level above the day: a plan ahead names
  types of work, holders and dates; hours are counted only at the season, against a target, and allotted only today.
- **The week serialises what the day parallelises** (B 3). A dated step that its holders cannot finish by its window's end wants a
  further hand, by the same rule the day's allotment already uses against its horizon.
- **Most reviews out of turn come from work that arrives, not from disruption** (B 2, B 5). An arrival is slotted in, as due kinds
  are since VB-1558; only what a deviation touches is repaired.
- **Illness hurts more than death** (B 7): the pool, at once.
- **The phase machine is as safe as its least careful exit** (A 3). This, not a count of bugs, is the case for the task without phases.
- **A load in hand is a promise for 16 kinds** (A 4): counted as a behaviour change in the path.
- **The set-down rule was too eager** (A 6): carry on home unless the carrier cannot walk.
- **The alderman lacks information** (C 1) and **today's calendar days were well chosen** (C 2).
- **Who defaults is decided by the household's size** (C 5), and **substitution is worth more than commutation** (C 6).
- **Authored steps drift to the end of their window** (C 8): `by`, and the hand-back.
- **Decision points v1 did not list** (C 10), and **the meeting is an actor no pawn can author for** (C 9).
- **A lone settler's week is its day** (B 8): the household level collapses for a household of one adult, in the model and on the page.

### 2.3 Surprises not taken as offered

- **"A rolling assignment of 3 to 4 days"** (B 6). I go further: no assignment of hours beyond today at all. Three days is how far
  *dated commitments* reach, because that is the notice of a called day and the slowest head's cadence.
- **Outer levies in two-hour lots** (C, days or hours). They help households of two or more adults and hurt the one-adult household, which
  is the one in trouble; the right and the record are in days. Kept in days.
- **A floor exempting a one-adult household at its sowing** (C 5). Not as a rule of the simulation. Sizing lots by adults is offered
  as a custom (An elite is what the rules leave over: a plan sizes each due against a household's need), and the ladder of answers does the rest.
- **Pooling unforeseen arrivals to own hours** (B's `w6pool`). It left vital hours worse; arrivals go to the day's lists.

### 2.4 How far the evidence carries

Study B compares two small models; its daily model differs from the recorded allotment by 28 to 32% of member-kind hours on
populous. I accept its direction because the mechanism is plain (one holder for a week against three hands this morning), not
because of the factor. Study C's "household's choice" was given this year's load with 20% noise, close to foresight; the next
round tests it with what a head can know three days ahead (Q10). P10 was measured on hours worked; how much of that lies beyond a realistic levy, and what households lose when it must be given
or demanded, is the most important number nobody has yet (Q8).

---

## 3. The revised design

### 3.1 Bodies, horizons and the pawn's base unit

A year is 48 game days in four seasons of 12; a game day stands for about a week and has 12 working hours (6 to 18).

| Horizon | Holds | Unit | Mostly whose | The levy here (3.3) |
| --- | --- | --- | --- | --- |
| **Task** | a goal and its method | a leg | the pawn doing it | hours booked to the levier or to the pawn's own |
| **Day** | each member's ordered list for today; hours and hands | a task | the head for its household (the allotment, as built); a pawn for its own hours | a member's levy in hours today is the allotment's capacity for it |
| **Days ahead** (six shown, three binding) | duties; dated commitments (a called day, a village day named, leave, a stay away); dated steps ("reap the rye from day 5, by day 9") | a duty, a date | the head; the pawn for its own | named days of outer levies; dated grants |
| **Season** | a target for each store with the hours still to do, by the head's estimate; the windows of the template; outer levies in days | a target, a window, days | the head | the household's labour budget: its members' levies less the outer days |
| **Year** | routines and their levies; land, projects, the rotation; a pawn's aims | a routine, a project, an aim | the meeting and the alderman; the head; the pawn | an estate's on a village, a village's on households, the custom's table for members |

Who plans and how far are separate: the table says where each body mostly plans, and the record (3.4) lets any body hold any row. A
pawn has a year (an aim to marry), a household has a day (the meal at its hour).

**The pawn's base unit is the day.** Kim asked day or week; v1 answered the week and the data say otherwise. A household's work
arrives with its kind known and its hours not (76 to 80% against 26 to 32%, *measured*); the harvest kinds are the worst (reaping
8% foreseen with hours). What a pawn can hold for more than a day is therefore not a schedule but three kinds of commitment:

- **a duty**: a type of recurring work without a window that is this member's to see to (the wood, the water, the beasts, the
  cooking). It gives the holder the first place for that type in each day's allotment and nothing more. It is the mechanism that
  Standing duties (Kim, 23 November) lacks, and it avoids what sank `MATCH.keep` by construction: work with a window is never a duty,
  so no hand comes late to the hay for keeping to yesterday's type;
- **a date**: a day on which some of the pawn's hours are spoken for, known at least three days ahead for an outer levy where the levied names the day;
- **a dated step**: a piece of work with "from" or "by", which the day's allotment takes up when its day comes and mans by its window.

The page shows six days ahead (half a season) because a player thinks in that span; the rule binds three. The week as a calendar
unit exists nowhere in the simulation.

### 3.2 The task as a plan

A task is a **goal**; its kind declares **methods**; a pawn's next leg is worked out from the world each time a leg ends or is cut.

```ts
type Goal   = { kind: KindKey; at: Tile; store: StoreRef; amount: number; made: Good; owner: BodyRef };
type Prim   = 'go' | 'fetch' | 'work' | 'load' | 'haul' | 'unload' | 'return' | 'wait' | 'mind';
type Fact   = { pawnAt?: Place; carries?: Good; has?: 'cart' | Tool; pileAt?: [Tile, Good, min: number]; stage?: [StageRef, 'done'];
                inStore?: [StoreRef, Good, min: number] };            // read from the world; none is stored on the task
type Step   = { prim: Prim; pre: Fact[]; eff: Fact[]; place?: Place; thing?: Good | Tool | 'cart'; hours?: number };
type Method = { name: string; when: (w: View, g: Goal, p: Pawn) => boolean; steps: Step[] };     // data, declared by the kind's domain
// next(w, g, p): 1. the rule for a load in hand; 2. the stray method; 3. the first method whose `when` holds: scan its steps from the
//                last to the first and take the last step whose `pre` holds and whose `eff` does not; all effects hold: 'done';
//                no step's `pre` holds: {blocked: why}.
```

**The backward reading.** v1 said "the first step whose effect is not yet true", which fails: hauling home undoes "the pawn is at
the forest", so the pawn walks back. Reading from the goal (a triangle table, as in teleo-reactive programs) takes the step
nearest the goal that can be taken now. "Wait until the cart is full" is then a precondition of `load`, not a branch.

Firewood, as Study A played it, all five rows matching:

| State | Steps `next` gives |
| --- | --- |
| At home, the cart at home, no timber | fetch cart, go, fell, load, haul, unload, cut, leave the cart |
| On the forest tile for another reason, no cart | fell, load on the back, haul, unload, cut (and back for more until the amount is met) |
| Timber lies at the tile (the night cut the task) | fetch cart, go, load, haul, unload, cut |
| Called off on the road with a load | haul, unload; the cutting is then open to anyone |
| Timber at the farm | cut |

**Progress lives in the world**, which is what lets any cut be the ordinary case:

- *Piles with title.* A good set down or made away from a store is a pile at a tile with an owner (`sim/lying` already keeps one, and
  its frost is the pile's way out). Stooks, hay cocks and stones on the land are piles today. Water needs a container left standing;
  the catch, game, gathered food, dug clay, ore and peat, salt, a basket of stone and seed carried to a field need a pile; animals
  led are a herd standing at a tile.
- *The good is made where the work is done.* Ten kinds make their effect at the door today (the tree falls, the stones leave the tile,
  the catch is rolled, the bog is dug on delivery). Each effect moves to the work or load leg. This changes behaviour (a tree falls a
  walk earlier; a dead carrier's catch exists) and is its own step of the path.
- *What has no place is lost.* A fishing, hunting or gathering trip cut before the catch loses its hours: they are the trip's, not
  the world's. A stage's hours stay on the stage (`sim/progress`).
- *The stray method.* One method, tried before any kind's own: a pile of a good the goal uses, owned by the goal's owner and lying
  where its kind neither makes nor wants it, is fetched to the owner's store. It replaces the seven fetch kinds and is what makes the
  fuzz clean. Without it `next` gives a false reason ("no seed", with the seed lying on the field).
- *The rule for a load in hand,* weighed again after Study A: a pawn carrying a body's goods hauls them to that body's store, past
  the end of the working day if need be (Finishing what was begun, VB-1547). It sets them down only when it cannot walk on: death,
  illness, its household gone. A call does not set a load down either unless the caller says so, having been shown the cost. v1's
  "set down if the walk does not fit the hours left" set down 915 loads in 10,000 runs, each costing a walk out and back next morning.
- *A held charge.* `mind` holds across other legs: the herd at the side, spinning beside it, and a minder's dependant (Whoever cannot
  keep itself is someone's charge). It is the Attention slot of today under one name.

**What it removes and keeps.** Gone: the phases (`go`, `work`, `back`, `home`, `road`); the inline cases of `agents.ended` and
`complete`; `sim/days`' own way home (VB-1548); 15 control fields of the kinds (`load stack back carry to deliver again stages reload
setDown fetch setOut carted inside trip`); the fetch kinds; `CHAINS` as a structure of the player's. Kept on a kind: its labels,
`hours`, `hands`, `spot`, `available`, `done`, `worked`, `urgency`, `window`, `vital`, the ranks, and `methods`: 37 fields from 51.

**This is not the planner rejected on 10 and 15 November.** Nothing searches: at most three methods of at most seven steps, a
backward scan, a handful of facts. It is `CHAINS`, the projects' step lists and the phase machine made one table.

**Choosing by place.** A quarter to two fifths of tasks away from home already begin beside their site (*measured*), by when and by
whom they are taken. What the method adds there is small: the walk home for the cart not taken, a stray pile picked up in passing.
It is not a saving in walking to count on.

### 3.3 The levy and own hours

Decided in its shape by Kim (section 6, answers 2 to 9); the numbers, the records and the names of verbs here are Proposed.

**The idea.** A pawn cannot decide entirely for itself what to do without consequences: it stands inside bodies, and each body holds
a **levy** on the labour of those within it. An estate levies its villages, a village its households, a household its members. The
levy is what couples the plans: a parent plan's levy is the budget a child plan runs within. What the levies leave a pawn is its
**own hours**. **Sovereignty** is the measure: the share of a pawn's working hours that are its own.

#### The levy at each level

| Levier → levied | Unit | Set by | Record |
| --- | --- | --- | --- |
| Household → member | hours a day, by season | custom, by the member's position; a contract for a servant or an elder | follows from membership: no obligation record; the head's grants on the household's plan |
| Village → household | adult-days in a window (a season) | the meeting's routines, split into lots by the custom of lots | an obligation, kind `days`, source `routine`, enforcer the village |
| Alderman's household → household | adult-days a year | the practice "What the alderman is kept with" | an obligation, kind `days`, source `keep` (as today) |
| Creditor or patron → household | adult-days in a year | a debt's remedy, a patron's due | an obligation, kind `days`, source `debt` or `patron` (as today) |
| Estate → village, or → household | adult-days in a window | the estate's right (a later slice) | an obligation, kind `days`, source `due`; on a village, the alderman splits it into lots as a routine's |

**How levies relate to `sim/obligations`.** That module already holds "every explicit claim of one party on another": debtor,
creditor, what is owed (`{hours}`), a term, an enforcer, a due-queue; and `sim/days` already works the kind `days` for three
sources. So every **outer levy is an obligation record**, of the kind `days`, with two new sources (`routine`, `due`) and its
**terms** added. Nothing parallel is built: v2's `Claim`, `st.claims` and `sim/claims` are withdrawn. A **household's levy on a
member is not an obligation**: it follows from membership and custom, as a child's keep does, and ends when membership ends. Where a
contract exists (a servant's year, an elder's undantag), the contract's terms give the levy in place of the custom's row.

```ts
// An outer levy: fields on the obligation record (st.obligations; owner sim/obligations), worked by sim/levies (sim/days, widened)
type LevyTerms = {
  names: 'levied' | 'levier' | 'together';     // who names the day: the levied household; "at the lord's call"; one date for all
  notice: number;                              // days ahead a day must be named (3)
  substitute: boolean;                         // any adult may be sent, or the one named must come
  commute: number | null;                      // rations a day the levier takes instead, or null: not for sale
  carry: boolean;                              // days unworked at the window's end carry over, or lapse
  onBreach: BreachKey;                         // what this levier does: 'memory' | 'fine' | 'case' | 'penalty' | 'eviction'
};
type OuterLevy = Obligation & { kind: 'days'; source: 'routine'|'keep'|'debt'|'patron'|'due'; window: [Day, Day]; terms: LevyTerms;
                                named: { day: Day; pawn: PawnId | null }[]; worked: number };

// A household's levy on its members: on the household's plan (st.plans.of[household]; owner sim/levies)
type Position   = 'heir' | 'son' | 'daughter' | 'kin' | 'servant' | 'elder' | 'child';
type MemberLevy = { grant: [spring: number, summer: number, autumn: number, winter: number] | null;   // the head's standing grant; null: the custom's
                    tally: { demanded: number; taken: number; given: number } };                      // this season's hours; folded at its end
// plan.levies: { [pawnId]: MemberLevy }.  The levy in force: levyOf(st, pawn, day) = grant ?? contract ?? Culture.norm('levy', position, season),
// times the pawn's hands (age, health). Computed when read, compiled per member at the season's turn and when a grant changes.
```

**The custom, by position and season** (hours a day of the 12; grounded in `levy-custom.md`, Kim, 25 November: one levy for every
adult member, whatever its position; to be set against the measurement):

| Position | Spring | Summer | Autumn | Winter | Ground |
| --- | --- | --- | --- | --- | --- |
| The head pair | (none) | | | | not levied: the household's plan is theirs; what they keep is their own choice (question 13) |
| An adult member: the heir, another son, a daughter, other adult kin, a servant | 9.5 | 10 | 10.5 | 9.5 | inferred from law and the calendar: the Sundays and holy days (about 82 a year in Lutheran Sweden) are the member's, the rest the household's; holy days are fewest at hay and harvest |
| A servant, in addition | | | | | a free game day at the term (the moving round), by its contract |
| A lodger | 0 | 0 | 0 | 0 | plus 1 adult-day in summer and 1 in autumn (a guess) |
| An elder (undantag) | 0 | 0 | 0 | 0 | sourced: the contracts set no work; what an elder does is given |
| A child of 7 to 13 | 6 | 10 | 7 | 3 | inferred (the herding summer); the hours a guess; times its hands by age |

Position does not change the hours levied (the sources show none between an heir, a younger son and a farmhand). It changes a
member's fate: who stays at home and who goes into service (`sim/service`, the moving round), the servant's wage and portion, who
inherits, and what the head grants. The social ladder is climbed through those, and through what a pawn does with its own hours.

Against what is worked today (67 to 85% of 12 hours from spring to autumn, 50 to 55% in winter, *measured*) these levies cover the
average household's work and fall short of the busiest; that shortfall is where giving, asking, granting and breach begin.

#### The coupling, horizon by horizon

| Horizon | The budget from above | What the plan below does within it |
| --- | --- | --- |
| Year | An estate's days on a village; the meeting's routines as lots on households; the custom's levy table, known to every member | The village's plan must deliver the estate's days; the household's year knows its outer days by window; a pawn's aims are sized to its own hours |
| Season | **The household's labour budget**: the sum of its members' levies over the season's days, less the outer levies' days (8 hours each) | The head's season plan sets each target's hours left against the budget, by its estimate; a season that does not fit is seen at its start (ask for hands, lower a target, ask members for more) |
| Days ahead | Named days of outer levies; dated grants (leave) | Duties and dated steps go to members within their levies; an outer day comes out of the household's levy on the one sent, not out of that pawn's own hours |
| Day | Each member's levy in hours today | **The allotment's capacity for a member is its levy**, not 12 (today: "each member up to its own hours"). Levy hours the allotment leaves unassigned fall to the member for the day; the head may still call within the levy |
| Task | The step that opened the task says whose hours they are | Hours are booked at a leg's end: owed, levied, demanded, given, kept or taken (below) |

#### Grant, ask and breach, on both sides

| Act | By | What it does | Consequence, and where it is kept |
| --- | --- | --- | --- |
| **Grant** | the levier (a head; an alderman; a creditor) | lowers a levy: a standing grant by season, a dated one (leave), a `release` of an outer day, a `transfer` of it to another body | goodwill and opinion to the granter's credit; `plan.levies[].grant`, a dated step, or the obligation's `delivered` |
| **Ask** | the levied (a member; a head) | asks for a grant: leave, a lighter levy, a release, another day, commutation | answered once, by the levier's judgement of its need and its opinion; a no is a memory (as `sim/voice` today) |
| **Breach by the levier** | a head who calls or assigns beyond the levy (**demands**); a levier who calls outside its terms | the levied may comply or refuse, by its own judgement | hours booked `demanded`; a memory of the member's; opinion of the head falls; a servant weighs it at its term; a household weighs it against its alderman or patron |
| **Breach by the levied** | a member who keeps hours within its levy (**takes**); a household that does not work a named day | the work is not done | hours booked `taken`; a memory of the head's; the member's standing in the household, which the head reads when it chooses an heir and sizes a portion; a servant not kept on. For an outer levy: what its `onBreach` term names (a memory; the meeting's fine; a case, as for a debt; an estate's penalty or eviction), told in the record with the reason |

Each of these is a verb (3.6), so the played pawn and any controller have every one of them, on either side. Each consequence runs
through what exists: memories and opinion (`sim/records`' `personEvent`), standing, the meeting's cases (`sim/decisions`), the
moving round's choices. The season's tally is the one new stored thing, and it is folded at the season's end.

**Breach is one judgement at every level** (A judgement is never a die). The one who would breach weighs, by its own estimate,
what keeping costs against what this levier does to those who breach, and breaches when the first is greater. For a head and an
outer day: the food and sowing the day displaces (in rations, by its estimate, flaws and all) against the fine, the standing and
opinion lost, a case, eviction. For a member: what it wants the hours for (courting, a visit long owed, later its craft) against its
standing with the head and what hangs on it. For a head demanding more: the work at risk against its people's resentment. There is
no separate threshold: a village whose only answer is a memory is breached sooner than an estate that evicts, for the same day.

**The ladder before a breach** of an outer levy, tried in order by the default author, each a verb any head may issue and each
allowed only where the levy's terms allow it:

1. `substitute`: another adult goes (worth most: it takes the sowing lost by households of three or more adults from 11 to 13% to 2 to 6%, *measured*);
2. `name` another day in the window, while the notice allows (only where the levied names the day);
3. `ask` the levier for a `release` or a `transfer` (the alderman lends a day of his keep to a household in need);
4. `commute`: goods for the day at the levy's rate (3 rations by the worth table), where the terms allow and the household holds them;
5. breach.

**Who names the day is a term.** A village's routine: the levied household names its days within the window at three days' notice;
the levier fixes a date only for work done together (the fence), by default the custom's day, which Study C found well chosen. The
alderman's keep and a debt's days: the levied names, in the season the levier asks. An estate's due may read `names: 'levier'`, no
substitution, no commutation, eviction on breach: at the lord's call. The same record and the same verbs carry both; the
difference between a village and a lord is in the terms. A day not named in time is named by the levied's default author.

**Lots.** A village's routine is split into lots by the village's custom of lots: by fields at the start (the form of `wayDuty`'s
road lots), which the meeting may change, for one to "by adults" or "equal". It matters most to the small: under every rule the
mocks tried, households of three or more adults keep their days and one-adult households lose a quarter to four fifths of their
sowing to three days on the worst dates (*measured*, small samples).

#### Own hours

A pawn's working hours on a day (`H`: 12 times its hands) are booked, at each leg's end, to exactly one of six parts that sum to `H`:

| Part | What | Whose |
| --- | --- | --- |
| **owed** | worked for a body outside the household under an outer levy (out of the household's levy on the pawn) | the levier's |
| **levied** | worked on the household's tasks within the levy | the household's |
| **demanded** | worked for the household beyond the levy, at the head's call | own, breached by the head |
| **given** | worked for the household beyond the levy, of the pawn's own accord | own |
| **kept** | a pastime, courting, a visit, rest; later an aim | own |
| **taken** | hours within the levy the pawn kept for itself | the household's, breached by the member |

**Before slice 8** own hours go four ways. *Pastimes and visits* (`sim/pastimes`, as built). *Courting.* *Rest.* And *given back*:
a pawn with own hours and work open in its household gives some of them, by a judgement of its own: its diligence and its
opinion of the head, weighed against what it wants the hours for. A diligent son gives most of his; an idle one sits by the fire
while the hay is out; the difference shows on the strip and in the head's memory. This replaces "work beats idling" as a rule of
the simulation with a pawn's choice, from the first build, and it is the largest change to behaviour in this design.

**From slice 8: the potter.** The farmer's second son owes his household what any adult member owes: 10 hours a day in summer and
9.5 in winter. His own hours (30 in a winter, 24 in a summer, at the table's values, more if his head grants them) he spends at the clay: the pots are *his*, kept in a store of
his own. His skill grows with the hours; the pots are graded (A made good is graded); he carries them to the gathering and trades
them; his income from others rises against his need. A head who grants him more hours is his patron; a head who demands them back
finds him taking them, or gone at the moving round. In time he lives by the craft, leaves the household (its levy ends with
membership) and sits in a market town. Nothing steers him there: the levy leaves him hours, and the rest is what he does with them.
Its preconditions, none of which this design builds:

- *Personal goods* (slice 8): title to what a pawn makes in its own hours, and a store that is a pawn's.
- *Skill that grows with practice*: VB-475's skill is a stand-in that does not grow; the road needs one that does.
- *Markets*: the gathering and the fair exist; a town to live in is slice 9's.
- *A right to the material* (clay, fuel) for a pawn that holds no land.

Until then the levy already does its other work: it gives every adult member hours of its own, it gives the head
something to grant and the member something to ask for, and it makes an outer levy cost the household hours it can count.

#### Sovereignty, the measure

For a pawn and a span of days: by right, `1 - levy / H` (what custom, contract and grants leave it); as lived, `(demanded + given +
kept) / H` beside the hours it took. Past days are exact; nothing shows it for a day to come but the levy in force. It is **shown**
on the pawn's card, as the colours of every strip (3.7), and for a household and a village as the spread over their members. It is
**read**, as a measure and never as a switch, where a pawn compares positions: taking service, staying on at a term, leaving home at
the moving round, and later the class view (a pawn most of whose hours are another's). The rules that respond to a head's hardness
or a member's idleness read the season's tally of breaches, not the measure.

### 3.4 Plans, steps and authors

```ts
type BodyRef  = { kind: 'pawn' | 'household' | 'village' | 'estate'; id: number };
type PlanStep = {
  id: number;
  what:   { goal: Goal } | { target: { store: StoreRef; good: Good; level: number } } | { duty: WorkType }
        | { levy: ObligationId } | { routine: RoutineKey } | { project: ProjectId } | { aim: AimKey };
  from?:  Day;  by?: Day;                              // a dated step; `by` is also the day after which an authored step is the rule's again
  who:    BodyRef[];                                   // inside the planner's authority; empty: whoever the day allots
  why:    { step: StepId; of: PlanKey } | { levy: ObligationId } | { custom: string } | null;      // the one link upward
  left?:  { lo: number; mid: number; hi: number };     // hours still to do, by the planner's estimate; season and year steps only
  author: 'custom' | 'pawn';
  state:  'planned' | 'open' | 'at-risk' | 'done' | 'failed' | 'dropped';
};
type Plan = { body: BodyRef; agent: PawnId; year: PlanStep[]; season: PlanStep[]; ahead: PlanStep[]; reviewed: Hour };
// st.plans.of: Map<bodyKey, Plan>            owner: sim/plans (plain data, saved; the order of steps is saved behaviour)
// plan.day.lists                              owner: sim/day, as today: the day's allotment, a reading of `ahead` and the open tasks
// st.jobs                                     owner: sim/jobs: today's open task instances (the board, kept as a store), each naming its PlanStep
```

**How a step above becomes work below.** A season target below its level, a window opening, a project's step, a levy's named day or
a dated step reaching its day *opens* tasks, at the body's review or by the due-queue, as rules post jobs today; the day's allotment
weighs them. The difference from today is that each task names the step that opened it, and that a step may be there because someone
authored it. Whether a task then exists only because a plan chose it (the review's option D) is left for later.

**Authors.** The default author is the body's rule: the template of the year for the season, the customs for duties, today's
allotment for the day, `next` for the task. A controller (a person, a script, an LLM) writes steps through verbs for the bodies its
pawn is agent of. The rule that lets the two meet: **the default author fills what is not authored and does not rewrite what is**,
with three conditions the mocks showed are needed:

- *Due and vital kinds are slotted in before anything authored* (the water, the meal, the fire, milking, fodder). The `plan` verb's
  check reserves their expected hours of each day; without this an authored week crowds out the cooking.
- *An authored step carries `by`.* When the planner's estimate says it will not be done by then, the step is at risk: a decision
  point for its author; unanswered by its deadline, the default author takes it over (adds hands, moves it), and says so on the card.
- *A step whose holder cannot work returns to the pool at once.*

### 3.5 Replanning

A deviation is taken at the lowest level that can take it, without a review where a slot-in will do:

| Rung | What happens | Cost |
| --- | --- | --- |
| The task | `next` is asked again: another method, a stray pile fetched, `blocked` with its reason | a scan |
| The day's lists | a task that arrives is slotted into the lists as they stand (as due kinds are, VB-1558); a holder ill, dead or called away has its tasks returned to the pool and slotted to others | the task × members |
| The day | the whole allotment, at the morning and at 14:00, and when a slot-in finds nobody | as today |
| The head's review | duties re-given; a dated step that its hands cannot finish by its window's end given further hands; hands asked of a neighbour; a named day moved | on its planning day; out of turn once a day for one cause |
| The season | a target lowered (never for an absence shorter than the step's window); the ladder of 3.3 for an outer levy; a member asked for more, or more demanded | at a review |
| The village | the alderman answers a breach or an ask for release; a routine short of hands fails, and that is a story | at his review |

Upward travels one fact: a step at risk, with the hours short and by when, by the planner's estimate. Downward travels a new date at
its notice, or inside the notice a call, instant as today with its cost shown first. Stability comes from the day's lists being
edited in place, from duties moving only at a review, and from the estimate's range as the band inside which nothing is at risk;
Study B found a ±25% band narrower than these estimates' real spread, so the band is the head's own range, not a constant.

### 3.6 Parity: verbs, the API and decision points

**Verbs.** Each is registered by the module that carries it out; its check asks the actor's position, never whether it is played.

| Verb | Who may | Replaces or adds |
| --- | --- | --- |
| `plan` | the agent of a body, on that body's plan | `target`, `tile`, `order`, `project`, `dayOrder`, and `Sim.plan`'s ops; **new for any pawn**: its own day's order, its own dated steps, a multi-step task at a tile (the player's chains become goals with methods) |
| `assign`, `call` | a head, within its household | `dayGive`, `dayCall`; **new**: a duty. Beyond the member's levy either is a demand: a breach, named as such before it is issued |
| `levy` | a levier's agent, by its right | `callDays`; **new**: an outer levy laid on a household's days a season ahead, with its terms |
| `grant`, `release`, `transfer` | a levier's agent | **new**: a head lowers a member's levy (standing or dated); a levier gives a day back or to another body |
| `name`, `substitute`, `commute` | the levied head, where the terms allow | **new** |
| `breach` | the levied: a head for an outer day; a member for hours of its levy | **new**: the act of not working what is levied, with its reason |
| `callWorkday` | the alderman | **changed**: a date he chooses for work done together, at least three days ahead; today the calendar fixes it and it is called in the day's first hour |
| `ask`, `answer` | any pawn | `offer`; **new as verbs**: leave and a lighter levy asked and answered (`sim/voice` writes leave by rule today), hands asked, a release asked, a commutation offered |
| `propose` | a holder of the village | **new**: a routine, or the custom of lots, put on the meeting's agenda by a pawn |
| `aim` | any pawn | **new** |
| `auto`, `queue` | any pawn, for itself | today `Sim.setAuto` and `Sim.queue`, which read `st.player` |
| `work`, `pastime`, `sleep`, ... | any pawn | as today; `work` on a household task in own hours is how hours are given |

The bold entries cover the ten acts Study C found no unplayed pawn can reach.

**The meeting is a body that decides; pawns act on it.** The routines' verb has the settlement as its actor, which stands
(`design.md` section 15: a meeting's decisions are commands). A pawn's acts toward it are `propose` and taking up a cause; the
decision is the meeting's by its procedure (`sim/decisions`), and the alderman carries it out by `levy` and `callWorkday`. The
played pawn has no ballot, as decided on 7 November; no controller has.

**The `Sim` API**, keyed by body or pawn: `Sim.plans(st, body)`, `Sim.levies(st, body)` (those it lays and those laid on it, with
their terms), `Sim.levyOf(st, pawn, day)`, `Sim.hours(st, pawn, from, until)` (the six parts of 3.3, past days only),
`Sim.strip(st, body, zoom)` (3.7; `sim/timetable` and `sim/agenda` made one view, by the looking pawn's estimate), `Sim.why(st,
task)` (the chain of steps: Reasons shown), `Sim.decisions(st, pawn)`, `Sim.command(st, cmd)`. All read through the actor view.

**Decision points.** A controller is asked where the default author would act, each with a deadline in game time after which the
default author answers:

| Point | Whose | Deadline |
| --- | --- | --- |
| The year's review; a routine or the custom of lots to propose | a head; a holder | the meeting's agenda closing |
| The season's review: targets against the labour budget, windows, days to name, standing grants | a head | the season's first review |
| The review of the days ahead: duties, dated steps, dated grants | a head; a pawn for its own | its planning day |
| The morning's and the 14:00 allotment, within each member's levy | a head | the hour |
| Work at risk with the levies spent: demand more, or not | a head | the hour |
| A demand received: comply or refuse | the member | at once |
| Own hours to spend: give, a pastime, courting, rest; or take hours of the levy | a pawn | when its levied work ends; at once |
| A leg's end, for a pawn with `auto` off | a pawn | at once (the queue first) |
| A step at risk | its author | the next review |
| An outer levy laid on the household; a day to name | the levied head | the notice before the window's last day |
| A named day that cannot be kept: the ladder, then breach or keep | the levied head | the day before |
| A levied adult dead or ill on its day | the levied head | at once: substitution, or the ladder |
| An ask to answer: leave, a lighter levy, hands, help, a release, a commutation offered | the one asked | the hour it would begin |
| A work day to call | the alderman | three days before the custom's day |
| A levy about to lapse unworked | the levier | the window's end (carry over, where the terms allow, or let lapse) |
| A breach to answer | the levier | its next review (what the terms name; or forgive) |

Measured or reckoned load before the levy's own points: about 0.9 a head-day, 0.15 an alderman-day, 1.2 a pawn-day for a pawn that
plans for itself; the levy adds about one a pawn-day (own hours to spend) and few for a head. Commands from a controller are inputs
and are recorded for replay.

### 3.7 The page

One presentation for every plan of every body (Like is shown alike): a **strip** of time, **coloured by levy**. Each hour has the
colour of whose it is: an outer levier's (owed), the household's (levied), the pawn's own; a breach is the other side's colour
hatched (demanded: own hours hatched in the household's colour; taken: the household's hatched in the pawn's). What has happened is
drawn exactly. What is to come is drawn as the levy in force (a line across each day at its hours) and what is committed, each
estimate with its range; below the line an unfilled stretch says "the household's, as the day brings", above it "mine".

| Zoom | Columns | Rows | Drawn |
| --- | --- | --- | --- |
| Today | hours | a pawn, or a household's members | the day's list as ranges by the looking pawn's estimate; the levy's line; the leg under way exact |
| Days ahead | six days, the last six beside them as bands | the same | duty icons at the row's head; named days as blocks in the levier's colour; dated grants; dated steps from their "from" to their "by" |
| Season | twelve days | a store's target; an outer levy; the labour budget | the target's meter with the hours left (a range); the budget against them; the template's windows as bars; a levy's window with its days named (solid) and to name (hatched), its terms a tap away |
| Year | four seasons | a household (the village's view); a member (the levy table); a project; an aim | routines and their lots; days levied, named, worked, lapsed, breached; each member's levy by season, the custom's and the head's grant |

- **As a member.** Today: the household's list up to my levy's line, with who chose each and why (`Sim.why`); above the line my own
  hours, with what I may do with them: give them, a pastime, a visit, courting, rest, later my aim. Ahead: my duties, the days
  spoken for and for whom, a leave granted. Behind: my last six days in their colours, my sovereignty beside what my position's
  custom gives. Toward the head: ask leave, ask a lighter levy; refuse a demand; take hours (shown with what it will cost me: the
  head's opinion, my standing).
- **As head.** Today's rows, each with its levy's line; tasks to drag between members (`assign`); dragging past a line is a demand
  and says so, with the member's likely answer by my pawn's judgement. Ahead: duties to give, dated steps to place, leave to grant;
  a step at risk flagged with its cause; a step I wrote carries a mark, and one the rule took back says so. The season: targets
  with hours left against the labour budget (short or long, by my estimate); each member's levy with the custom's value and my
  grant; outer levies as hatched blocks in their windows with their terms, what naming a day would displace, and the ladder with
  its prices (another adult, another day, ask release, 3 rations) beside what a breach brings from this levier.
- **As alderman.** The year: a row a household, a column a season; each cell the days levied and whether named, worked, lapsed or
  breached, a breach with its reason and my answers (`release`, `transfer`, the fine, a case). Work done together shows its date
  and the last turnout; the custom of lots shows what each farm bears under it. He is not shown the households' loads: he does not
  need them and could not use them.
- **A lone settler** sees one strip: it is head, member and pawn, it is not levied by itself, and the household's rows collapse.
- Any pawn may open the strip of a body that levies it, read-only; knowledge moves at once.

### 3.8 Cost, named before building

At the late reference (about 1,000 living, 200 households). Today, *measured* on populous small: jobs and matching 75 ms of a 171 ms
day; 3.5 allotments a household-day; `dayPair` 6,600 to 6,800 and `oppAsk` 5,600 to 5,800 a day.

| Work | Entities × cadence × work | A day |
| --- | --- | --- |
| The day's allotment | unchanged | as today |
| Slot-in of arrivals and of a lost holder's tasks | 200 × about 1.5 a day × 1 task × 5 members, in place of about 1.5 whole allotments | about 1,500 pairs replacing about 15,000 |
| `next` | 1,000 × 6 to 9 leg ends × 1.6 asks | 2.3 to 3.4 ms in a toy world; **budget 5 ms**; stray piles indexed by owner, never scanned |
| Duties and dated steps | 200 × 0.7 reviews a day × about 8 | 1,100 reads |
| Season plans | 200 × 4 a year × about 30 rows | 500 |
| Outer levies | a few hundred open obligation records, plus about 200 households × 2 to 4 routine lots a year; the due-queue of `sim/obligations` | under 0.5 ms |
| A member's levy | compiled per member at the season's turn and on a grant (1,000 × 4 a year); read by the allotment as one array lookup | under 0.1 ms |
| Hours booked to the six parts | 1,000 × 6 to 9 leg ends | under 0.5 ms |
| Giving, taking, a demand answered | 1,000 pawns × about 1 judgement a day, each a few reads | under 1 ms |
| Decision points | computed when a controller asks, for its pawn only | none in an unplayed run |

**No saving is claimed from the plans.** v1's 75 to 35 ms is withdrawn. The line asked for is today's plus 7 ms (5 for `next`, 2 for the levy). One saving is
predicted and must be shown: slotting in every arrival instead of allotting anew takes allotments from 3.5 to about 2.4 a
household-day and `dayPair` down by a fifth or more (Q6). The larger cost question (opportunities asked hourly, the review's option D)
is untouched here. Rules for cost: nothing polls; met levies and done steps leave the live index, and a season's tally is folded at its end; every review is on the
staggered planning day; no new loop over pairs.

### 3.9 Kept, replaced, removed

**Kept as they are:** `sim/commands`, `sim/eligibility` (a basis is a levy's basis), `sim/legs`, `sim/work`, `sim/progress`,
`sim/estimate`, `sim/plandays`, the template and targets of `sim/seasonal`, **`sim/day`'s allotment, `slotIn` and `sim/fit`**,
`sim/jobs` as the store of today's tasks, `sim/obligations` (every outer levy is one of its records), `sim/decisions`, `sim/offers`,
`sim/pastimes`, `sim/lying`, the stores' reservations, kinds declared by their domains.

**Replaced:** `st.player.plan`, `sim/playerplan`, `sim/plannext`, `sim/planchains` by the plan record and the kinds' methods;
`sim/agenda` and `sim/timetable` by one strip view; `st.daysCalls`, `st.daysToday`, `st.leaves`, the hands lent and the work day's
call by outer levies (obligation records worked by `sim/levies`, which takes over `sim/days`) and dated steps; "work beats idling" by the levy and giving; the projects' step lists by plan steps; `sim/voice`'s rule by an ask its default author issues.

**Removed:** the phases; the 15 control fields and the fetch kinds; the branches on the played household in `chores`, `building`,
`ladder`, `projects`, `camp`, `upgrade`; the `unplanned` gate's read of `st.player`.

### 3.10 The path

| Step | What | Unplayed behaviour | Shown by |
| --- | --- | --- | --- |
| 1 | Repairs: the review's option A (VB-1597, the `askFor` and `voice` skips, `wish` and `propose` as verbs) | unchanged | tests |
| 2 | A controller per pawn: `auto` and `queue` on the pawn; `st.player` the frame | unchanged | `tools/same.js`; the inhabited-pawn test for any pawn |
| 3 | The good is made where the work is done, for the ten kinds; piles or containers for the six with no store | **changes, slightly** | before and after on the PR; Kim decides whether it wants a run |
| 4 | The task as a plan: the wood first, then the carrying kinds, then all; VB-1548 falls out | unchanged but for the exits repaired | `tools/same.js` up to the exits; a fuzz test kept in `tests/` |
| 5 | One plan record with authors; the default author writes what the rules post; the rules stop reading who is played; the player's chains become goals | unchanged; the played path changes | `tools/same.js` |
| 6 | Outer levies as obligation records with terms: `sim/days` becomes `sim/levies`; work days, hands lent and leave join it; the terms set to what happens today (the levier names, the calendar's days) | unchanged | `tools/same.js` |
| 7 | Verbs for the ten unreachable acts, each issued by a default author that does what its rule does today | unchanged | `tests/commands.js`: no act reachable only through `Sim` |
| 8 | **The household's levy**: the custom's table by season (one row for every adult member); the allotment's capacity is the levy; the six parts booked; giving by diligence; grant, ask, demand and take with their consequences; the strip in its colours | **changes: every balance number** | **a measurement Kim starts**; the invariant that the parts sum to `H`; a design pass on section 7 (The day's work, Own time, A member's voice) |
| 9 | Partial repair: every arrival slotted in; a lost holder's tasks to the pool | **changes** | **a measurement Kim starts** |
| 10 | Duties and dated steps; further hands by the window | **changes** | **a measurement Kim starts** |
| 11 | The village's year: the levied names the day; the ladder; breach by judgement; the custom of lots | **changes** | **a measurement Kim starts**; a design pass on section 9, Days owed and Remedies |
| 12 | Own hours as a livelihood: aims, personal goods, skill that grows (slice 8) | **changes** | slice 8's plan |

Steps 1, 2 and 4 to 7 can go ahead on agents' decisions. Step 8 is the levy as Kim decided it: realistic from the first build, so
it cannot be had as bookkeeping first, and it revises Decided rows of `design.md` section 7. Steps 9 to 11 revise further rows of
sections 7 and 9; each needs its design pass. Where step 8 stands among 9 to 11 is question 11.

---

## 4. Revised predictions, and what would refute the design

**The task**

- **Q1.** With `pre`, `eff`, the backward scan, the stray method and titled piles, all 87 kinds written as data, in a world with
  several goals competing for one cart, piles that rot and two owners: no stuck task, no false `blocked`, no good outside a store, a
  pile or a hand, in 10,000 fuzzed runs.
- **Q2.** With "carry on home unless the carrier cannot walk", set-downs fall from 915 to under 100 in 10,000 runs, all from death,
  illness or a household gone; overtime walked is under one hour a set-down avoided.
- **Q3.** Under 3% of carrying tasks are cut between the work's end and the delivery in a real run, so making the good where the
  work is done changes each such good's yearly amount by under 2%.
- **Q4.** `next` costs under 5 ms a game day for 1,000 pawns with piles, carts and stores at the game's size.

**The household**

- **Q5.** Duties for recurring work without a window raise the share of member-days that begin with yesterday's type of work from
  63 to 66% to at least 72% on populous, with windowed work begun no later than today in at least 95% of cases and vital hours unmet
  within 10% of today's.
- **Q6.** Slotting in every arrival takes allotments from 3.5 to at most 2.4 a household-day and `dayPair` down at least 20%, with
  vital hours unmet and windows missed within 10% of today's.
- **Q7.** With a lost holder's tasks returned to the pool at once, a three-day illness costs no more vital hours than under today's
  allotment (within 10%), and no target is lowered for it.
- **Q8.** With the levy table of 3.3 run in the real simulation, 5 to 15% of the household hours worked today from spring to
  autumn lie beyond the levies, and under 5% in winter. With giving by diligence at its default, households' hours of work fall by
  at most 8%, windows missed and hungry household-days rise by at most 15% before any tuning, and one-adult households are unchanged.
- **Q9.** A diligent son differs visibly from an idle one: the third of levied members highest in diligence give at least three
  times the hours of the lowest third; demands are under 5% of levied hours and fall mostly on households of one or two levied members.

**The village and obligations**

- **Q10.** A household naming its own day three days ahead, knowing only its open tasks and windows by its head's estimate, removes
  at least 70% of the windowed hours the calendar's days displace.
- **Q11.** With breach as the head's judgement of cost against consequence, breaches rise with leanness (crop 1.0, 0.8, 0.6) for
  each household size taken alone, and fall as the levier's consequence grows (a memory, a fine, eviction) for the same day;
  3+-adult households do not breach in a normal year; release and transfer asked first halve the breaches; lots by
  adults bring a one-adult household's sowing lost to three days owed under 15% on the worst dates.
- **Q12.** A controller that levels its own load, with `by` and the hand-back, misses windows within 10% of the default author's;
  with 30% of steps authored at random and due kinds reserved, no vital hour is crowded out.
- **Q13.** Counted in a real run from the events themselves: at most 1.0 decision points a head-day, 0.2 an alderman-day, 1.5 a pawn-day.

**Not for a mock, but acceptance tests of the path:** an empty controller on every pawn hashes equal to the unplayed run (steps 2
and 5); the six parts of every pawn-day sum to `H` (step 8); no act reachable through `Sim` is unreachable through `issue` (step 7).

**What would refute the design, part by part.**

| If | Then |
| --- | --- |
| Q1 fails with competing goals, or Q4 exceeds 10 ms | Keep the phases and repair their exits through `release`; keep methods only as the player's chains |
| Q3 is far over 3%, or the ten kinds' amounts move by 5% or more | The good stays made at the door for those kinds; they keep a `deliver` hook and a load in hand is carried home by whoever holds it |
| Q5 fails (duties cannot raise continuity without late or unmet work) | Drop duties; "the days ahead" holds dates and dated steps only, and Standing duties stays an idea without a mechanism |
| Q6 fails | No saving at all from this design; cost is option D's business |
| Q8's losses are far over 15% at any sensible giving | The table's levies are too low for this economy as tuned: the custom's values rise, or the tuning run must find the hours elsewhere; the mechanism stands, since Kim has decided it |
| Q9 fails (givers and keepers do not differ) | Giving needs a different judgement (question 20) |
| Q10 is under 40% | Naming the day is worth little without foresight; the calendar's days stay as the term for routines too |
| Q11's rise with leanness or its fall with consequence fails | The head's estimate of what a day costs is too coarse to judge by; it needs the day's displaced work, not the season's food |

A fairness note for the next round: Study B's daily model was the weak point. A mock that wraps a module's function in its own
process (never editing a file) can run the real allotment with one rule changed, and would test Q5 to Q7 against the game itself.

---

## 5. Questions for Kim

**Answered on 25 November** (section 6 has Kim's words; sections 1 and 3 take them in):

1. *Is the day the unit of allotment, with only duties and dated things planned ahead?* **Yes** (answer 1).
2. *A ceiling on what a head may ask, or a measure with consequences?* **Neither as put: the levy.** A mechanism in hours a day by
   season, set by custom by position, changed by grant and ask, breachable by either side at a social cost; sovereignty is its measure (answers 2 to 4).
3. *Does "work beats idling" stay as the default?* **No.** Levies are realistic from the first build; own hours go to pastimes,
   courting, rest and some given back by diligence (answers 5 and 6).
4. *May a head default on an outside levy?* **Yes, always: breach is one mechanism at every level**, the ladder first, then the
   head's judgement of cost against this levier's consequences, with no separate threshold (answer 8).
5. *Does the levied name the day?* **It is a term of each levy** (answer 7).
6. *Is the size of a village's lots a custom?* **Yes, starting by fields** (answer 9).

**Open, as put in v2:**

7. **May the good be made where the work is done** (the tree falls when felled, the catch exists when caught)? Proposed: yes.
   *Why:* without it a load in hand is a promise, and neither the task without phases nor Nothing teleports holds for those kinds.
8. **Is a fishing, hunting or gathering trip that is cut lost?** Proposed: yes; its hours have no place in the world. *Why:* the
   alternative is a record at the shore that another pawn finishes, which is odd.
9. **May the default author take back an authored step that is at risk and unanswered?** Proposed: yes, after its deadline, and the
   card says so. *Why:* it is how a manual and an automatic plan meet without a player's forgotten step costing the harvest.
10. **May any holder propose a routine to the meeting, the decision staying the meeting's and no controller having a ballot?**
    Proposed: yes. *Why:* it closes the last parity gap at the top without touching the decision of 7 November.
11. **In what order are the behaviour-changing steps measured?** It was: 8, 10, 9 of v2's numbering. With the levy a step of its own
    the proposal is: partial repair (9), then the household's levy (8), then the village's year (11), then duties (10). *Why:* partial
    repair is small and may lower cost; the levy moves every number, so later steps should be measured on top of it; duties have the
    weakest evidence. The alternative is the levy first, since everything else is read through it.
12. **May the next round's mocks wrap a module's function in their own process**, so that a changed rule runs in the real
    simulation without a change to `src/`? Proposed: yes. *Why:* it removes the weakest link of the first round's evidence, and the
    levy's effect on households (Q8) can hardly be judged otherwise.

**New, raised by taking the answers in** (none is decided by the text above; where 3.3 had to assume one, it says so here):

*Questions 13 to 20 are answered (section 6, points 10, 11 and 13).*

13. **Is the head pair levied?** 3.3 assumes not: the household's plan is theirs, and their own hours are what they leave
    themselves. *Why:* otherwise who grants the head leave; and a one-adult household has no levy inside it at all.
14. **Do levy hours the allotment leaves unassigned fall to the member for that day, with a later call inside the levy still no
    breach?** 3.3 assumes yes. *Why:* the alternative, a member waiting out its levy with nothing to do, is today's idling under another name.
15. **Does a day worked under an outer levy come out of the household's levy on the one sent, or out of that pawn's own hours?**
    3.3 assumes the household's ("a parent plan's levy is the budget a child plan runs within"). *Why:* it decides whether the
    village's work costs the household or the member.
16. **Is work the household lives by (water, the meal, the fire) inside the levy like any other, so that a head who needs it
    beyond the levy must demand or be given it?** 3.3 assumes yes, with the breach's cost small because every member sees the need.
    *Why:* an exemption would be a second, hidden levy.
17. **Does an estate's levy on a village come within what the village's custom lets it lay on its households, or on top of it?**
    3.3 leaves it open. *Why:* it decides whether a lord's due crowds out the fence or the households' own work.
18. **The custom's rows**: does a daughter's levy differ from a son's, and how; is a child levied by the table or only through its
    hands; and may a village's custom differ from another's in the table (it is a custom, so presumably yes)? The values in 3.3 are
    placeholders. *Why:* the table carries the social structure and wants a historical ground, not my guess.
19. **Are a village's routine levies obligation records** (kind `days`, source `routine`, the village as enforcer), as 3.3
    proposes, while a household's levy on a member is not? *Why:* it puts every outer levy under one record and one due-queue, and
    makes `sim/obligations` grow by a few hundred records a year at the late reference, which the yearly fold must take.
20. **Is giving a threshold or a share?** 3.3 makes it a judgement (diligence and opinion of the head against what the pawn wants
    the hours for), which may come out as all or nothing on a given day; a share of own hours by diligence is smoother and is
    closer to a die. *Why:* it decides how visibly "a diligent son differs from an idle one", and how hard step 8 hits the households.

## 6. Kim's answers (25 November 2026)

Given in discussion after v2. Taken into sections 1 and 3 on 25 November.

1. **The day is the unit of allotment** (question 1): yes. Duties and dates are committed ahead, hours are allotted by the day, and
   the days ahead are the player's main planning surface; the day is their outcome.
2. **The levy.** Kim's sovereignty is a mechanism, not only a measure: it couples the plans of the levels and carries the society's
   structure, in which a pawn cannot decide entirely for itself what to do without consequences. Every body holds a concrete claim on
   the labour of those within it (an estate on its villages, a village on its households, a household on its members), and a parent
   plan's claim is the budget a child plan runs within. Its name is **levy**: a household's levy on a member, a village's levy on a
   household. What is left is the pawn's **own hours**; **sovereignty** is the measure, the share of a pawn's hours that are its own.
   ("Claim" stays land claims; v2's `Claim` and `st.claims` are renamed.)
3. **A household's levy on a member is in hours a day, by season** (e.g. all 12 at harvest, 9 in winter). The outer levies (village,
   the alderman's keep, a creditor, an estate) are in adult-days in a window.
4. **Changing a levy.** Custom sets the norm by position (heir, another son, a daughter, a servant's contract, an elder). The head may
   lower it by grant; the member may ask (`sim/voice`). Either side may breach it (the head demands more, the member takes more), at
   a social cost: opinion, standing, inheritance, a servant leaving at term.
5. **Realistic levies from the start**, not all hours: customs set levies below a member's working hours from the first build, so
   every balance number moves and the first build needs a measurement Kim starts.
6. **What own hours are for, before slice 8.** Pastimes, courting, rest, and some given back to the household by the pawn's own
   diligence, so that a diligent son differs visibly from an idle one. Own hours as a road to a livelihood (the farmer's second son
   who makes masterwork cookware, sells it at market and in time lives by his craft in a market town) wait for personal goods in slice
   8; they are the reason the levy exists. Skill that grows with practice (VB-475's stand-in does not) is a precondition of that road.
7. **Who names the day of an outer levy is a term of the levy** (question 5). A village's routine: the levied household names it
   within the window, at three days' notice, and the levier fixes a date only for work done together. An estate's due may be "at the
   lord's call". Power shows in the terms, not in a rule.
8. **Breach is one mechanism at every level** (question 4). A levied household may always breach. First it tries the ladder:
   substitute another adult, name another day, ask for release or transfer, commute for goods. Breaching is the head's judgement by
   its own estimate, weighing what keeping the day costs (its food, the sowing) against what this levier does to those who breach
   (for a village, opinion and the meeting's fine; for an estate, penalties, eviction). There is no separate default threshold.
9. **The size of a village's levy lots is a village custom** (question 6), starting "by fields" (as `wayDuty`'s lots); the meeting
   may change it, e.g. to "by adults".

10. **The designer's assumptions for questions 13 to 16, 19 and 20 are accepted** (as section 3.3 assumes them): the head pair is
    not levied; levy hours the day leaves unassigned fall to the member, and a later call inside the levy is no breach; a day worked
    under an outer levy comes out of the household's levy on the one sent; vital work is inside the levy, slotted in first; a village's
    routine levies are obligation records (met ones pruned, as cost grows with history); giving back is a judgement (diligence and the
    need the pawn sees), not a fixed share.
11. **An estate's levy on a village comes on top** of the village's own levies on its households (question 17), as historically: the
    lord's burden is felt by every household and shows in the strip.
12. **The custom table's values are to be grounded in historical sources** (question 18) by a research pass before the measurement
    sets them: `levy-custom.md` in this folder.

13. **One levy for every adult member, grounded** (question 18; revises point 4's "by position" for the hours levied): an adult
    member owes the same hours whatever its position, at the values of `levy-custom.md` (9.5, 10, 10.5 and 9.5 hours a day, spring to
    winter); a lodger, an elder and a child have rows of their own. Position works through fate: who stays and who goes into service,
    the wage and portion, inheritance and the head's grants.
14. **Breach's consequences are goodwill only for now.** The design leaves room for inspections, fines and the court (through the
    cases of `design.md`, Loans, obligations and cases) without elaborating them.
15. **The working day's length does not vary by season.** The levy's load over the year is the mechanic.

Questions 7 to 12 are open.
