# Plans at four scales: the design after the mocks (v2)

25 November 2026. For discussion with Kim. It replaces `design-v1.md` of this folder (kept for the record; the mocks tested it) and stands on its own.
Nothing in the repository's code, design or backlog is changed by it. It rests on the review of the job system
(`docs/review-jobs-2026-11-25/README.md`), on `design.md` sections 1, 7, 9 and 15 of the repository, and on three mock studies run
against v1: `docs/mocks/plans/task/` (Study A), `docs/mocks/plans/week/` (Study B) and `docs/mocks/plans/village/` (Study C). Type
sketches are TypeScript-style: shape and ownership, not code to build. *Measured* means measured by a mock or an earlier document;
everything else is a proposal or a prediction (section 4).

---

## 1. For discussion

### What is proposed now

1. **One plan record for every body and horizon, with an author on each step.** A pawn, a household, a village and later an estate
   each hold plans at a year, a season and "the days ahead"; a step is written by the body's rule (the default author) or through a
   verb by whoever controls the body's agent. The played pawn's plan is this record; `st.player` holds the frame only.
2. **The day stays the unit in which hours are allotted.** The head's day, as built, is kept: it is what the data support. Beyond
   today a plan holds only what can be known: *who sees to what* (duties), *what has a date* (a called day, a village day, leave, a
   step with "from" or "by") and, at the season, *how much is still to do* against each target. Nobody plans hours for the day after tomorrow.
3. **A task is a plan, worked out from the world.** A task has no phase. Each kind declares up to three methods as rows of steps with
   a precondition and an effect; at each leg's end the next step is read backwards from the goal. A good set down anywhere is fetched
   by one general method. This removes the exit that causes VB-1548 and the hooks for carrying.
4. **Sovereignty is measured inside the household and contracted outside it.** Between bodies a claim is a counted right: so many
   adult-days in a window (the village's routine, the alderman's keep, a debt's labour, an estate's due). The claimed household names
   the day, may send any adult, and climbs a ladder of answers before it defaults. Inside the household the head's authority is
   membership: it assigns duties and steps and calls, with no ceiling in any check; the share of a pawn's hours that are its own is a
   measure that is shown and that rules may read, and a custom gives the share people expect.
5. **Own hours start as bookkeeping and become a mechanism one use at a time.** At first every pawn does what it does today, and the
   hours it works beyond the plan's need are booked as its own, given. Each later use of own hours (work toward a portion, hire) is a
   slice of its own, measured.
6. **A path of eleven steps**, seven of which leave unplayed behaviour unchanged and four of which need a measurement Kim starts.

### What the mocks overturned

- **The week as the unit of assignment** (v1's centre). Only 31 to 32% of a household's task-hours can be foreseen a week ahead with
  their hours (the *kinds* 76 to 80%). Assigning by the week starts windowed work later, misses two to four times as many windows,
  leaves more vital hours unmet, and weighs as many pairs as today. v1 was wrong here, and wrong about the cost saving it promised (P6, P15).
- **The hours budget and its ceiling.** Households take 67 to 85% of adult working hours from spring to autumn, autumn being a peak;
  a ceiling of 0.85 would bind in a third to a half of household-weeks. v1's shares (P10) were derived from idle figures, not measured.
- **The alderman as scheduler.** A household naming its own day within the claimant's window removes almost all the harm; the
  alderman, with last year as his guide, removes a quarter to a half. He lacks information, not accuracy.
- **The default rule.** v1 switched it on the outlook's label "bad", which breaks A label is read, never a switch, and is not monotone.
- **Three details of the task engine.** Steps need preconditions and a backward reading (the forward reading of v1 walks in circles);
  a general method must fetch stray goods; and for 16 of the 27 carrying kinds the good is made at the door today, so "progress
  lives in the world" needs a change of behaviour first. Ordering a pawn's day by nearness saves 1 to 2% of walking, not 4 to 10%.

### What held

The task without phases (0 stuck in 10,000 once the general method is added, against 258 in 1,000 for the phase machine in the
owed-day case); methods as data for all 94 kinds bar two; obligations as claims in days; substitution; "fill, don't overwrite",
given slot-in; the count of decision points an external controller would face; and the list of ten plan-authoring acts that no
unplayed pawn can reach today.

### Decisions only Kim can make (section 5 has each with a proposed answer)

1. Is the day the unit of allotment for every pawn, with only duties and dated things planned ahead?
2. Is there a ceiling on what a head may ask of a member, or is sovereignty a measure with consequences?
3. Does "work beats idling" stay as the default use of a pawn's spare hours, booked as given?
4. May a household default on an outside claim, and by which ladder of answers first?
5. Who names the day of a claim: the claimed, but for work done together?
6. Are a village's lots sized by adults, by fields or equally (a custom)?
7. May the good be made where the work is done, for the ten kinds that make it at the door?
8. In what order should the four behaviour-changing steps be measured?

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
| P10 | Household 45 to 60% at peaks, 20 to 40% otherwise; own ≥35%; a 0.85 ceiling binds under 10% | Household 67 to 85% spring to autumn, about 50 to 55% in winter; own 18 to 30% outside winter; the ceiling binds 33 to 55%; village 3 to 5.5% | **Refuted** (measured on hours worked, which "work beats idling" fills) | No ceiling in a check; the household's share is reckoned from need; the rest is own, given (3.3) |
| P11 | Cost least at 4 or 6 days | Reviews flat in the window's length; stale hours and missed windows rise with it; least at 3 | **Refuted** | Dated commitments reach 3 days ahead by rule (the notice); the page shows six |
| P12 | Alderman's placement displaces ≥30% fewer windowed hours than the calendar | 21 to 53% fewer, 2 of 3 seeds under 30%. The household's own choice: 97 to 100% fewer, with near-foresight. Random days are worse than the calendar | Number missed, mechanism holds | The claimed names the day; the calendar's days stay for work done together; the alderman's load estimate is dropped |
| P13 | An estate's 3 days cost 3+ adults under 2% of sowing and one adult ≥10%; defaults under 5%, three times that in a lean year | 3+ adults 2 to 6% on the worst dates, under 1% spread; one adult 48 to 82%; defaults 1 to 8%; lean year 0.6 to 4.9×, not monotone | Half confirmed | The trigger reads a measure (seasons of food covered); a ladder of answers before default; lots sized against need |
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
- **Claims in two-hour lots** (C, days or hours). They help households of two or more adults and hurt the one-adult household, which
  is the one in trouble; the right and the record are in days. Kept in days.
- **A floor exempting a one-adult household at its sowing** (C 5). Not as a rule of the simulation. Sizing lots by adults is offered
  as a custom (An elite is what the rules leave over: a plan sizes each claim against a household's need), and the ladder of answers does the rest.
- **Pooling unforeseen arrivals to own hours** (B's `w6pool`). It left vital hours worse; arrivals go to the day's lists.

### 2.4 How far the evidence carries

Study B compares two small models; its daily model differs from the recorded allotment by 28 to 32% of member-kind hours on
populous. I accept its direction because the mechanism is plain (one holder for a week against three hands this morning), not
because of the factor. Study C's "household's choice" was given this year's load with 20% noise, close to foresight; the next
round tests it with what a head can know three days ahead (Q10). P10 was measured on hours worked; how much of that is need is the
most important number nobody has yet (Q8).

---

## 3. The revised design

### 3.1 Bodies, horizons and the pawn's base unit

A year is 48 game days in four seasons of 12; a game day stands for about a week and has 12 working hours (6 to 18).

| Horizon | Holds | Unit | Mostly whose |
| --- | --- | --- | --- |
| **Task** | a goal and its method | a leg | the pawn doing it |
| **Day** | each member's ordered list for today; hours and hands | a task | the head for its household (the allotment, as built); a pawn for its own hours |
| **Days ahead** (six shown, three binding) | duties; dated commitments (a called day, a village day named, leave, a stay away); dated steps ("reap the rye from day 5, by day 9") | a duty, a date | the head; the pawn for its own |
| **Season** | a target for each store with the hours still to do, by the head's estimate; the windows of the template; claims from outside in days | a target, a window, days | the head |
| **Year** | routines and their claims; land, projects, the rotation; a pawn's aims | a routine, a project, an aim | the meeting and the alderman; the head; the pawn |

Who plans and how far are separate: the table says where each body mostly plans, and the record (3.4) lets any body hold any row. A
pawn has a year (an aim to marry), a household has a day (the meal at its hour).

**The pawn's base unit is the day.** Kim asked day or week; v1 answered the week and the data say otherwise. A household's work
arrives with its kind known and its hours not (76 to 80% against 26 to 32%, *measured*); the harvest kinds are the worst (reaping
8% foreseen with hours). What a pawn can hold for more than a day is therefore not a schedule but three kinds of commitment:

- **a duty**: a type of recurring work without a window that is this member's to see to (the wood, the water, the beasts, the
  cooking). It gives the holder the first place for that type in each day's allotment and nothing more. It is the mechanism that
  Standing duties (Kim, 23 November) lacks, and it avoids what sank `MATCH.keep` by construction: work with a window is never a duty,
  so no hand comes late to the hay for keeping to yesterday's type;
- **a date**: a day on which some of the pawn's hours are spoken for, known at least three days ahead for a claim from outside;
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

### 3.3 Sovereignty and claims

**The measure.** For a pawn and a day, its working hours `H` (12 times its hands by age and health) fall into four parts that sum to
`H`: **owed** (worked for a body outside its household under a claim: the village, a creditor, an estate, a household it was lent or
hired to), **needed** (worked on its household's vital work, windowed work and work toward a store below its target), **given**
(worked for its household beyond that) and **kept** (a pastime, an aim, rest). Its **sovereignty** is `(given + kept) / H`: the
hours nobody could demand of it. The night is always its own. Past days are exact; nothing shows it for a day to come.

It is a measure in the sense of A label is read, never a switch: shown on the pawn's card and the household's strip, read by the
rules that want what it stands for (a servant's opinion of its master, whether one leaves, whether leave is asked), and never a
threshold in a verb's check. A custom gives the share a village expects for a member's standing and season (a norm, as other
customs are); a head who keeps its people far under it is remembered for it.

**Why there is no ceiling inside the household.** v1 proposed that a head may claim at most 0.85 of a member's hours. Measured on
today's hours it would bind in 33 to 55% of household-weeks, in large households too, and cut work that feeds people. A ceiling
near 1.0 by season would bind never and mean nothing. And a hard share is a prescription where the principles ask for a mechanism:
what holds a head back should be what its people do about it. So: membership is the head's right to assign and to call; the check
of `assign` asks only that the member is of the household and able. (If Kim wants a rule, the alternative is a custom "the day kept"
giving each adult so many days a season of its own, which is historical and countable; question 2.)

**Claims between bodies.** A claim is a counted right of one body on another's labour:

```ts
type Claim = { id; by: BodyRef; on: BodyRef;                        // on: a household (or a pawn with no household: a hired hand)
               right: ObligationId | { decision: DecisionId } | { agreed: OfferId };
               days: number; window: [from: Day, until: Day];       // adult-days of 8 work hours, as sim/days
               together: Day | null;                                // a date the claimant fixes: only work that must be done together
               named: { day: Day; pawn: PawnId | null }[];          // days the claimed has named, and whom it sends, at least 3 days ahead
               basis: 'villager' | 'owed' | 'helper' | 'hired'; worked: number;
               state: 'open' | 'met' | 'lapsed' | 'released' | 'commuted' | 'defaulted' };
// st.claims, st.claimsBy (claimant, claimed), st.claimsDue (a due-queue by the window's end and by each named day)   owner: sim/claims
```

| Claimant → claimed | Right | Amount | Who names the day |
| --- | --- | --- | --- |
| Village → household | the meeting's routine | the routine's hours as lots, by the custom of lots (equal, by fields, by adults) | the household, in the window; the alderman for work done together (the fence), on the custom's day unless he names another |
| Alderman's household → household | the keep (`OFFICE.keepDays`) | days a year | the household, in the season the alderman asks |
| Creditor → debtor household | a debt's remedy, a patron's due, an estate's due | the obligation's days | the household, in the window; the creditor may fix a day only where the obligation says so |
| Household → household | agreed (help asked, a day swapped) | as agreed | as agreed |
| Household → a pawn outside it | agreed (hire) | a day, for a wage | as agreed |

The household's own hours are thus nested as Kim described: the village and the creditors take days of the household's season first,
known when the season is planned; the head disposes of what is left, day by day; each member keeps what the head does not need.

**The life of a claim.** *Made* by the claimant's agent through `claim`, on the strength of its right, at the start of the window or
when the right arises; the claimed household's season plan gains a step for it at once. *Named* by the claimed head through `name`
(a day and optionally a pawn), at least three days ahead; a day not named by three days before the window's last possible day is
named by the default author of the claimed (its lightest open day by its own estimate). *Worked*: on a named day the pawn sent takes
the claimant's tasks on the claim's basis for 8 hours, walking there with its meal; hours are booked to the claim. *Ended*: met;
lapsed (the claimant gave it no work, as keep days lapse); released; commuted; defaulted.

**When a named day cannot be kept** (the day is over-claimed, the one sent is ill, the rye stands ripe), the claimed head has, in
this order by the default author, each a verb any head may issue:

1. `substitute`: another adult goes (worth most: it takes the sowing lost by households of three or more from 11 to 13% to 2 to 6%, *measured*);
2. `name` again: another day in the window, while three days' notice is left;
3. `ask` the claimant for a `release` or a `transfer` (the alderman lends a day of his keep to a household in need; the claimant answers by its opinion and its own need);
4. `commute`: goods for the day at the worth table (3 rations), offered when the household holds a surplus; the claimant answers;
5. `default`: the day is not worked. It is told in the record with its reason, remembered by the claimant, and, where the claim has
   an enforcer, heard at the meeting as any default.

**The trigger for a default is a threshold on a measure.** A head defaults when keeping the day would leave its household's food
covering fewer than `CLAIMS.cover` seasons by its own estimate (the supply outlook's number, not its label). It is a judgement,
never a die, it rises with want, and it is the head's estimate, flaws and all: a poor head defaults too late or too soon. Hunger
presses: the day's work owed at sowing is a conflict the rules produce.

**Who is hurt.** Under every rule tried, households of three or more adults do not default in a normal year and one-adult households
lose a quarter to four fifths of their sowing to three days owed on the worst dates (*measured*, small samples). Lots sized by adults,
the claimed naming the day, and release before default are what the design offers them; whether a village holds such a custom is the village's.

**What own hours are for**, in the order they would be built:

1. *Given* to the household: the default. A pawn with spare hours takes the household's open work as today ("work beats idling"),
   and the hours are booked as given. Behaviour is unchanged; the books are honest.
2. *Own time*: a pastime, a visit, courting (`sim/pastimes`), and leave, which is now an ask to be released from a duty or a day (`sim/voice`).
3. *An aim*: a pawn's year step ("a portion before I marry") opens work at the side whose product is the pawn's. A wait is the thing
   waited for: the couple that waits is the one whose hours have not yet earned it.
4. *Hire*: a pawn sells a day to another household for a wage; the landless adult's days are all its own, which is what makes it the hired hand.

Uses 3 and 4 take hours from "given" and so from the household; each is a slice with its own measurement.

### 3.4 Plans, steps and authors

```ts
type BodyRef  = { kind: 'pawn' | 'household' | 'village' | 'estate'; id: number };
type PlanStep = {
  id: number;
  what:   { goal: Goal } | { target: { store: StoreRef; good: Good; level: number } } | { duty: WorkType }
        | { claim: ClaimId } | { routine: RoutineKey } | { project: ProjectId } | { aim: AimKey };
  from?:  Day;  by?: Day;                              // a dated step; `by` is also the day after which an authored step is the rule's again
  who:    BodyRef[];                                   // inside the planner's authority; empty: whoever the day allots
  why:    { step: StepId; of: PlanKey } | { claim: ClaimId } | { custom: string } | null;      // the one link upward
  left?:  { lo: number; mid: number; hi: number };     // hours still to do, by the planner's estimate; season and year steps only
  author: 'custom' | 'pawn';
  state:  'planned' | 'open' | 'at-risk' | 'done' | 'failed' | 'dropped';
};
type Plan = { body: BodyRef; agent: PawnId; year: PlanStep[]; season: PlanStep[]; ahead: PlanStep[]; reviewed: Hour };
// st.plans.of: Map<bodyKey, Plan>            owner: sim/plans (plain data, saved; the order of steps is saved behaviour)
// plan.day.lists                              owner: sim/day, as today: the day's allotment, a reading of `ahead` and the open tasks
// st.jobs                                     owner: sim/jobs: today's open task instances (the board, kept as a store), each naming its PlanStep
```

**How a step above becomes work below.** A season target below its level, a window opening, a project's step, a claim's named day or
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
| The season | a target lowered (never for an absence shorter than the step's window); the ladder of 3.3 for a claim | at a review |
| The village | the alderman answers a default or a release; a routine short of hands fails, and that is a story | at his review |

Upward travels one fact: a step at risk, with the hours short and by when, by the planner's estimate. Downward travels a new date at
its notice, or inside the notice a call, instant as today with its cost shown first. Stability comes from the day's lists being
edited in place, from duties moving only at a review, and from the estimate's range as the band inside which nothing is at risk;
Study B found a ±25% band narrower than these estimates' real spread, so the band is the head's own range, not a constant.

### 3.6 Parity: verbs, the API and decision points

**Verbs.** Each is registered by the module that carries it out; its check asks the actor's position, never whether it is played.

| Verb | Who may | Replaces or adds |
| --- | --- | --- |
| `plan` | the agent of a body, on that body's plan | `target`, `tile`, `order`, `project`, `dayOrder`, and `Sim.plan`'s ops; **new for any pawn**: its own day's order, its own dated steps, a multi-step task at a tile (the player's chains become goals with methods) |
| `assign`, `call` | a head, within its household | `dayGive`, `dayCall`; **new**: a duty |
| `claim`, `release`, `transfer` | a claimant's agent, by its right | `callDays`; **new**: a claim on a household's days a season ahead |
| `name`, `substitute`, `commute`, `default` | the claimed head | **new** |
| `callWorkday` | the alderman | **changed**: a date he chooses, at least three days ahead; today the calendar fixes it and it is called in the day's first hour |
| `ask`, `answer` | any pawn | `offer`; **new as verbs**: leave asked and answered (`sim/voice` writes it by rule today), hands asked |
| `propose` | a holder of the village | **new**: a routine put on the meeting's agenda by a pawn |
| `aim` | any pawn | **new** |
| `auto`, `queue` | any pawn, for itself | today `Sim.setAuto` and `Sim.queue`, which read `st.player` |
| `work`, `pastime`, `sleep`, ... | any pawn | as today |

The bold entries are the ten acts Study C found no unplayed pawn can reach.

**The meeting is a body that decides; pawns act on it.** The routines' verb has the settlement as its actor, which stands
(`design.md` section 15: a meeting's decisions are commands). A pawn's acts toward it are `propose` and taking up a cause; the
decision is the meeting's by its procedure (`sim/decisions`), and the alderman carries it out by `claim` and `callWorkday`. The
played pawn has no ballot, as decided on 7 November; no controller has.

**The `Sim` API**, keyed by body or pawn: `Sim.plans(st, body)`, `Sim.claims(st, body)`, `Sim.hours(st, pawn, from, until)` (the
four parts of 3.3, past days only), `Sim.strip(st, body, zoom)` (3.7; `sim/timetable` and `sim/agenda` made one view, by the looking
pawn's estimate), `Sim.why(st, task)` (the chain of steps: Reasons shown), `Sim.decisions(st, pawn)`, `Sim.command(st, cmd)`. All
read through the actor view.

**Decision points.** A controller is asked where the default author would act, each with a deadline in game time after which the
default author answers:

| Point | Whose | Deadline |
| --- | --- | --- |
| The year's review; a routine to propose | a head; a holder | the meeting's agenda closing |
| The season's review: targets, windows, claims to name | a head | the season's first review |
| The review of the days ahead: duties, dated steps | a head; a pawn for its own | its planning day |
| The morning's and the 14:00 allotment | a head | the hour |
| A leg's end, for a pawn with `auto` off | a pawn | at once (the queue first) |
| A step at risk | its author | the next review |
| A claim made on the household; a day to name | the claimed head | three days before the window's last day |
| A named day that cannot be kept (the ladder) | the claimed head | the day before |
| A claimed adult dead or ill on its day | the claimed head | at once: substitution, or the ladder |
| An ask to answer: leave, hands, help, a release, a commutation offered | the one asked | the hour it would begin |
| A work day to call | the alderman | three days before the custom's day |
| A claim about to lapse uncalled | the claimant | the window's end (carry over, where the right allows, or let lapse) |
| A default to answer | the claimant | its next review (press, extend, forgive, as for a loan) |

Measured or reckoned load: about 0.9 a head-day, 0.15 an alderman-day, 1.2 a pawn-day for a pawn that plans for itself. Commands
from a controller are inputs and are recorded for replay.

### 3.7 The page

One presentation for every plan of every body (Like is shown alike): a **strip** of time. What has happened is drawn exactly, as
bands coloured by whose the hours were (owed, needed, given, kept). What is to come is drawn only as what is committed, each estimate
with its range; an empty stretch of a future day says "the household's, as the day brings", which is the truth.

| Zoom | Columns | Rows | Drawn |
| --- | --- | --- | --- |
| Today | hours | a pawn, or a household's members | the day's list as ranges by the looking pawn's estimate; the leg under way exact |
| Days ahead | six days, the last six beside them as bands | the same | duty icons at the row's head; named days as blocks in the claimant's colour; dated steps from their "from" to their "by" |
| Season | twelve days | a store's target; a claim | the target's meter with the hours left (a range); the template's windows as bars; a claim's window with its days named (solid) and to name (hatched) |
| Year | four seasons | a household (the village's view); a project; an aim | routines and their lots; days claimed, named, met, lapsed, defaulted |

- **As a member.** Today's list with who chose each and why (`Sim.why`). Ahead: my duties, the days spoken for and for whom, the walk
  on a called day and what I leave undone. Behind: my last six days as bands, the share that was mine beside what my village expects.
  From my own hours: a pastime, a visit, an aim, a day for hire; from the household's: ask leave.
- **As head.** Today's rows, tasks to drag between members (`assign`). Ahead: duties to give, dated steps to place; a step at risk
  flagged with its cause; steps I wrote carry a mark, and one the rule took back says so. The season: targets on meters with hours
  left; claims from outside as hatched blocks in their windows, each with what naming a day would displace by my estimate, and the
  answers with their prices (another adult, another day, ask release, 3 rations, default) beside the food covered in seasons.
- **As alderman.** The year: a row a household, a column a season; each cell the days claimed and whether named, met, lapsed or
  defaulted, a default with its reason and my answers (`release`, `transfer`, press). Work done together shows its date and the
  last turnout. He is not shown the households' loads: he does not need them and could not use them.
- **A lone settler** sees one strip: it is head, member and pawn, and the household's rows collapse.
- Any pawn may open the strip of a body that claims it, read-only; knowledge moves at once.

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
| Claims | a few hundred open; a due-queue; hours booked at a leg's end | under 0.5 ms |
| Decision points | computed when a controller asks, for its pawn only | none in an unplayed run |

**No saving is claimed from the plans.** v1's 75 to 35 ms is withdrawn. The line asked for is today's plus 5 ms. One saving is
predicted and must be shown: slotting in every arrival instead of allotting anew takes allotments from 3.5 to about 2.4 a
household-day and `dayPair` down by a fifth or more (Q6). The larger cost question (opportunities asked hourly, the review's option D)
is untouched here. Rules for cost: nothing polls; closed claims and done steps leave the live index; every review is on the
staggered planning day; no new loop over pairs.

### 3.9 Kept, replaced, removed

**Kept as they are:** `sim/commands`, `sim/eligibility` (a basis is a claim's basis), `sim/legs`, `sim/work`, `sim/progress`,
`sim/estimate`, `sim/plandays`, the template and targets of `sim/seasonal`, **`sim/day`'s allotment, `slotIn` and `sim/fit`**,
`sim/jobs` as the store of today's tasks, `sim/obligations` (the right behind a claim), `sim/decisions`, `sim/offers`,
`sim/pastimes`, `sim/lying`, the stores' reservations, kinds declared by their domains.

**Replaced:** `st.player.plan`, `sim/playerplan`, `sim/plannext`, `sim/planchains` by the plan record and the kinds' methods;
`sim/agenda` and `sim/timetable` by one strip view; `st.daysCalls`, `st.daysToday`, `st.leaves`, the hands lent and the work day's
call by `st.claims` and dated steps; the projects' step lists by plan steps; `sim/voice`'s rule by an ask its default author issues.

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
| 6 | The ledger as bookkeeping: `sim/claims` takes over days owed, work days, leave, hands lent; the four parts of a pawn's hours; the strip | unchanged | `tools/same.js`; the invariant that the parts sum to `H` |
| 7 | Verbs for the ten unreachable acts, each issued by a default author that does what its rule does today | unchanged | `tests/commands.js`: no act reachable only through `Sim` |
| 8 | Partial repair: every arrival slotted in; a lost holder's tasks to the pool | **changes** | **a measurement Kim starts** |
| 9 | Duties and dated steps; further hands by the window | **changes** | **a measurement Kim starts** |
| 10 | The village's year: the claimed names the day; substitution; release and transfer; commutation; default on the measure; the custom of lots | **changes** | **a measurement Kim starts**; a design pass on section 9, Days owed and Remedies |
| 11 | Own hours used: aims, then hire, a slice each | **changes** | each its own plan |

Steps 1, 2 and 4 to 7 can go ahead on agents' decisions. Steps 8 to 10 revise Decided rows of `design.md` section 7 (The day's
work, Standing duties, A member's voice, Village routines) and section 9; each needs the design pass first. The order of 8, 9 and
10 is free; I propose 8 first, since it is the smallest and the only one that should lower cost.

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
- **Q8.** The hours a household *needs* (vital, windowed, and work toward stores below target) are at least 10 points of `H` below
  the hours it works, in every season; that is, at least 10% of adult working hours are "given".
- **Q9.** Sovereignty so measured differs by household size by at least 15 points between one-adult and 3+-adult households at the peaks.

**The village and obligations**

- **Q10.** A household naming its own day three days ahead, knowing only its open tasks and windows by its head's estimate, removes
  at least 70% of the windowed hours the calendar's days displace.
- **Q11.** With the trigger on seasons of food covered, defaults rise with leanness (crop 1.0, 0.8, 0.6) for each household size
  taken alone; 3+-adult households do not default in a normal year; release and transfer asked first halve the defaults; lots by
  adults bring a one-adult household's sowing lost to three days owed under 15% on the worst dates.
- **Q12.** A controller that levels its own load, with `by` and the hand-back, misses windows within 10% of the default author's;
  with 30% of steps authored at random and due kinds reserved, no vital hour is crowded out.
- **Q13.** Counted in a real run from the events themselves: at most 1.0 decision points a head-day, 0.2 an alderman-day, 1.5 a pawn-day.

**Not for a mock, but acceptance tests of the path:** an empty controller on every pawn hashes equal to the unplayed run (steps 2
and 5); the four parts of every pawn-day sum to `H` (step 6); no act reachable through `Sim` is unreachable through `issue` (step 7).

**What would refute the design, part by part.**

| If | Then |
| --- | --- |
| Q1 fails with competing goals, or Q4 exceeds 10 ms | Keep the phases and repair their exits through `release`; keep methods only as the player's chains |
| Q3 is far over 3%, or the ten kinds' amounts move by 5% or more | The good stays made at the door for those kinds; they keep a `deliver` hook and a load in hand is carried home by whoever holds it |
| Q5 fails (duties cannot raise continuity without late or unmet work) | Drop duties; "the days ahead" holds dates and dated steps only, and Standing duties stays an idea without a mechanism |
| Q6 fails | No saving at all from this design; cost is option D's business |
| Q8 finds under 5 points | Sovereignty reads near zero from spring to autumn for everyone: it is then a winter's measure, own hours have little to fund aims or hire, and step 11 is not worth building as designed |
| Q10 is under 40% | Naming the day is worth little without foresight; the calendar's days stay and the claim's page is the only gain |
| Q11's monotone rise fails | The default needs a better measure than seasons covered, or should be the player's and the meeting's matter only |

A fairness note for the next round: Study B's daily model was the weak point. A mock that wraps a module's function in its own
process (never editing a file) can run the real allotment with one rule changed, and would test Q5 to Q7 against the game itself.

---

## 5. Questions for Kim

1. **Is the day the unit of allotment for every pawn, and are only duties and dated things planned ahead?** Proposed: yes. *Why it
   matters:* it keeps the head's day you decided on 15 November, on the evidence that hours cannot be foreseen; it means "plan the
   week" in the page is choosing duties, dates and dated steps, not filling a timetable.
2. **A ceiling on what a head may ask, or a measure with consequences?** Proposed: a measure, a custom's norm beside it, no ceiling
   in a check. The alternative with content is a custom of days kept (so many days a season an adult's own). *Why:* it decides
   whether sovereignty is a rule or a reading; a share-of-hours ceiling either binds half the time or never.
3. **Does "work beats idling" stay as the default, booked as hours given?** Proposed: yes; own hours take from it one use at a time.
   *Why:* a quarter or more of today's household work may rest on it; making it a weight at once (v1) would move every balance number.
4. **May a head default on an outside claim to save its food, after substitution, another day, an ask for release and commutation?**
   Proposed: yes, on a threshold of seasons covered by its own estimate. *Why:* it is where Hunger presses meets obligations, and
   who defaults turns out to be the one-adult households.
5. **Does the claimed name the day?** Proposed: yes, within the claimant's window, at three days' notice; the claimant fixes a day
   only for work done together, by default the custom's. *Why:* the household knows its week and nobody else can; it revises
   "called by the creditor's holder" (section 9, Days owed).
6. **Is the size of a village's lots a custom: equal, by fields, by adults?** Proposed: yes, by fields as the start (it is
   `wayDuty`'s form), with "by adults" an option a village may come to. *Why:* it is the lever that protects small households
   without a rule of the simulation doing so.
7. **May the good be made where the work is done** (the tree falls when felled, the catch exists when caught)? Proposed: yes.
   *Why:* without it a load in hand is a promise, and neither the task without phases nor Nothing teleports holds for those kinds.
8. **Is a fishing, hunting or gathering trip that is cut lost?** Proposed: yes; its hours have no place in the world. *Why:* the
   alternative is a record at the shore that another pawn finishes, which is odd.
9. **May the default author take back an authored step that is at risk and unanswered?** Proposed: yes, after its deadline, and the
   card says so. *Why:* it is how a manual and an automatic plan meet without a player's forgotten step costing the harvest.
10. **May any holder propose a routine to the meeting, the decision staying the meeting's and no controller having a ballot?**
    Proposed: yes. *Why:* it closes the last parity gap at the top without touching the decision of 7 November.
11. **In what order are steps 8, 9 and 10 measured?** Proposed: 8 (partial repair), then 10 (the village's year), then 9 (duties).
    *Why:* 8 is small and may lower cost; 10 has the clearest gain for households; 9 has the weakest evidence.
12. **May the next round's mocks wrap a module's function in their own process**, so that a changed rule runs in the real
    simulation without a change to `src/`? Proposed: yes. *Why:* it removes the weakest link of this round's evidence.
