# Plans at four scales: candidate designs

25 November 2026. For discussion with Kim. Nothing in the repository was changed. Read against `docs/review-jobs-2026-11-25/README.md`
(the review; its strains are cited as S1 to S7), `docs/review-jobs.md` (15 November), `design.md` sections 1, 7, 9 and 15,
`docs/architecture/target-v2.md` sections 2 and 4.5, and `docs/cost.md`. Type sketches are TypeScript-style: shape and ownership, not
code to build. Numbers marked *measured* come from those documents; every other number is a prediction, listed in section 6 so that
a mock can refute it.

Contents: 1 the problem; 2 what all candidates share (the calendar of plans, the task as a plan, a controller per pawn); 3 three
candidates; 4 comparison; 5 the recommendation in full (sovereignty, replanning, parity, the page, cost, migration); 6 predictions;
7 questions for Kim.

---

## 1. The problem in one page

**What is strained.** The review found one substrate below (verbs, eligibility, legs, closed-form progress) and two planners above.

| Strain (review, section 5) | What a hierarchy of plans does about it |
| --- | --- |
| S1 Two planners: the head has targets and a derived day; the player has an authored plan no other pawn can use | One plan record for every body and horizon, with an author on each step. The player's plan is that record |
| S2 Opportunity and task are one stored record: a task exists because a rule fired | A task exists because a plan step was opened. Opportunities are asked when a plan is written, not hourly |
| S3 The allotment: 44% of simulation time (75 of 171 ms a day, *measured*), 4.4 allotments a household-day (*measured*), every concern tuned into one number | The week's assignment is made once and repaired; the day is a reading of it. Hours, windows and precedence are separate quantities, not terms of one fit |
| S4 Carrying a task through its rare ends (VB-1548: an owed day ending on the road home) | A task holds no phase. Its next step is worked out from the state of the world, so every exit is the ordinary case |
| S5 Goods that move without a pawn; a carry hook per kind (27 kinds) | Carrying is a step of every task's method, written once |
| S6 The kinds record: 51 fields, 19 used by one or two kinds | A method (data) replaces the hooks `load`, `stack`, `back`, `carry`, `to`, `deliver`, `again`, stages |
| S7 Documents behind the code | Out of scope here; the design pass that this change needs rewrites section 7 |

**Requirements, as properties a test can check.**

- **R1 Four horizons.** Every piece of work a pawn does traces to a step at each horizon above it that applies: task, week, season,
  year. *Test:* for any task in a run, `why(task)` returns a chain of steps with no gap, ending at a year step, a custom or the pawn's own choosing.
- **R2 A task is a plan.** The steps of a task depend on where the pawn, its tools and the goods are. *Test:* the firewood task from
  the farm has the walk out and from the forest tile has not; both end with the same stock at the same store.
- **R3 Who and how far are separate.** Any body may hold a plan at any horizon. *Test:* a pawn holds a year step (to marry) and a
  household holds a day step (the meal) in the same structure, read by the same view.
- **R4 Sovereignty.** For every pawn and period, the claims on its hours and its own hours sum to its available hours; no hour is
  counted twice or by nobody. *Test:* an invariant, checked each day.
- **R5 Parity.** No rule reads who is played. *Test:* with nothing authored, a run with every pawn "controlled" by an empty external
  controller hashes equal to the unplayed run (the inhabited-pawn test of VB-169, widened to every pawn and level).
- **R6 Steerable.** Each level can be read and changed by its holder through verbs, and by nobody else. *Test:* every field of a plan
  that the default author writes can be written by a verb; `tests/commands.js` lists no author-only act.
- **R7 Stable.** A local deviation is absorbed locally. *Test:* replans per body-day and the share of steps that change hands at a
  review stay under named bounds (section 6).
- **R8 Affordable.** Work choice costs less than today at the late reference, by entities × cadence × work stated beforehand.
- **R9 No worse off.** Households are fed and windows met as often as today, within seed noise, before any tuning run.

**What has been rejected and still is** (`docs/review-jobs.md`, Rejected). No general planner: nothing below searches. Methods are
rows of data chosen by a first-match test, the year stays the culture's template, and assignment stays greedy. The board is not
removed: it stays as the store of today's open task instances (the village's among them); what goes is the board as the place where
work is decided.

---

## 2. What all three candidates share

The candidates differ in what passes between levels. They share three things, which could be built whichever candidate is chosen.

### 2.1 The calendar of plans, and the pawn's base unit

A year is 48 game days in four seasons of 12 (`sim/rules`); a game day stands for about a real week and lasts 1.6 seconds at 30×.

| Horizon | Span | Who mostly plans here | Unit of a step |
| --- | --- | --- | --- |
| Task | hours | the pawn doing it | a leg (walk, work, wait) |
| Day | 1 day, 12 working hours (6 to 18) | the pawn | a task with a start |
| Week | 6 days (half a season; two a season, eight a year) | the pawn, and the head for the household | a task, or a duty (a type of work) |
| Season | 12 days | the head | a store's target, a window of work, days owed |
| Year | 48 days | the alderman and the meeting; the head for land and projects; a pawn for its aims | a routine, a project, a claim in days |

**Day or week for the pawn: the week, executed by the day.** The day is the unit of doing: the working day, the meal, the night and
the due kinds (water, milking, cooking) all recur daily, and the day's list (`plan.day.lists`) has held up. It is too short to be the
unit of planning, for five reasons. (1) At play speed a day is gone in seconds; a player cannot author one each morning, and an LLM
controller called daily for 1,000 pawns is 48,000 calls a year where a weekly call is 8,000. (2) The day already repeats itself: 72
to 73% of member-days begin with the type of work of the day before (*measured*, section 7 of `design.md`, Standing duties). (3) A
day owed is called at least 3 days ahead (`DAYS.notice`), a head reviews every 1 to 3 days, a member asks leave once in 6
(`VOICE.days`): the existing cadences already sit between a day and a season. (4) Work with travel wants several days together
(two days at the far meadow, a stay at a booth). (5) Standing duties ("the wood is Olof's", Kim, 23 November) have no mechanism at
the grain of a day, where `MATCH.keep` failed (VB-1553), and are simply what a week's assignment is.

Why six days and not four or twelve: six divides the season in two, so that a week never straddles a season's turn; it is twice the
notice of a called day, so that every called day is known when a week is planned; twelve is the season itself and leaves no level
between the head's season and the pawn's day. Four (three weeks a season) is the alternative to measure (prediction P11).

**The week rolls.** A body's week plan always covers the next six days. It is reviewed on the body's planning day (`sim/plandays`:
every 1 to 3 days by diligence, staggered) by keeping every step that still holds and adding the days that came into view. A fixed
week replanned from nothing every sixth day would be simpler to explain and worse at the seam; the page may still draw calendar weeks.

### 2.2 The task as a plan: a method chosen by the state of the world

Today a task is a job with a phase (`go`, `work`, `back`, `home`, `road`) and per-kind hooks. In every candidate a task is a **goal**
and its kind declares **methods**; the pawn's next leg is worked out from the world each time a leg ends.

```ts
type Goal   = { kind: KindKey; at: Tile; store: StoreRef; amount: number; made: Good };      // "a load of firewood in Norrgård's woodpile"
type Prim   = 'go' | 'fetch' | 'work' | 'load' | 'haul' | 'unload' | 'return' | 'wait';        // each becomes one leg (sim/legs, sim/work)
type Step   = { prim: Prim; place?: Tile; thing?: Good | Tool | 'cart'; hours?: number };
type Method = { name: string; when: (w: View, g: Goal, p: Pawn) => boolean; steps: Step[] };   // declared as data by the kind's domain
// The whole of a task's control: no phase is stored.
// next(w, g, p) -> the first step of the first method whose `when` holds and whose effects are not yet true, or 'done', or {blocked: why}
```

The firewood task, written out. Facts the test reads: where the pawn stands, what it carries, where the cart is, the felled timber
lying at the forest tile (a pile, a store at a tile, as stooks and hay cocks are today), the timber at the farm's chopping place.

| State when asked | Steps left |
| --- | --- |
| At home, the cart at home, no timber anywhere | fetch cart, go to the forest tile, work (fell), load, haul home, unload, work (cut to firewood) |
| On the forest tile for another reason, no cart | work (fell), load on the back, haul home, unload, work (cut) |
| Night cut the task after felling: timber lies at the tile | (next morning, any member) fetch cart, go, load, haul home, unload, work (cut) |
| Called off on the road home with a load | (whoever carries the load) haul home, unload; then the task's remaining steps are open to anyone |
| Timber already at the farm | work (cut) |

Rules that make this safe and cheap:

- **Progress lives in the world, not in the task.** Felled timber is a pile at the tile; a load is on a pawn or a cart; hours done on
  a stage are on the stage's record (as `sim/progress` keeps them). A task can therefore be cut at any leg, by anything (the night, a
  call, a death, the end of an owed day), and resumed by any eligible pawn: the method is asked again and answers from what is there.
  This is "The cut and the call" of section 7 carried to its end; there is no code for an exit, only for a state.
- **A load in hand is always brought to a store** (Finishing what was begun): one rule in `next`, before any method: a pawn carrying
  goods whose title is some body's hauls them to that body's store or, if the walk does not fit what is left of its hours, sets them
  down as a pile where it stands. VB-1548 is this rule: the owed day ends, the load goes to the creditor's store or is set down, and
  the pawn's own plan says "go home".
- **No search.** At most three methods a kind, tried in order; a method is a row of at most eight steps; `next` reads a handful of
  facts. It is the data table `CHAINS` of `sim/planchains`, the step lists of `sim/projects` and the phase machine of `sim/agents`
  made one mechanism, and is far from the general planner rejected on 10 and 15 November.
- **Repeating is the goal's business.** "Again" (another trip, the next stage) is `amount` not yet reached: `next` answers with the
  first step once more.
- **Re-planning the rest happens only at a leg's end or a cut**, which are events the simulation already handles (12.4 a pawn-day,
  *measured*, `docs/mocks/blocks/`). A helper joining or leaving re-rates the work leg as today and does not ask the method.
- **A step that cannot be taken says why** (`blocked`: no cart, the tile felled out, the store full). The reason goes up one level as
  a deviation (section 5.3) and is what the pawn's card shows.

What it removes: the phases; the inline cases in `agents.ended` and `complete`; the hooks `load`, `stack`, `back`, `carry`, `to`,
`deliver` (27 kinds), `again` and the stage fields; the fetch kinds that `sim/kinds` builds; `CHAINS` as a player-only structure.
What a kind keeps: `verb`, `name`, `at`, `needs`, `gives`, `hours`, `type`, `urgency`, `window`, `vital`, `hands`, and now `methods`.

### 2.3 A controller per pawn

The review's option B, taken as given: `pawn.controller = {auto: boolean, queue: Command[]}`; `st.player` shrinks to `{pawn, view}`;
`unplanned(st, id)` reads the pawn. Every candidate below needs it and none depends on how it is done.

---

## 3. Three candidates

### Candidate A: the ledger (hours are the plan)

**Idea.** Above the pawn nothing plans tasks. A higher body holds **claims**: so many hours of a pawn or a household, in a window,
for a purpose. Each pawn has a small scheduler that spends the hours claimed of it on the claimant's open work, and the rest as it likes.

```ts
type Claim = { id; by: BodyRef; on: BodyRef; hours: number; window: [from: Hour, until: Hour];
               purpose: { store?: Good; target?: number; kind?: KindKey };     // "hay to two winters", not "mow tile 412"
               basis: 'member'|'villager'|'owed'|'helper'|'hired'; right: ObligationId | 'custom' | 'agreed';
               worked: number; state: 'open'|'met'|'lapsed'|'defaulted'|'released' };
// st.claims (owner: sim/claims); per pawn and week a compiled budget [household, village, owed, own] in hours
```

- **Levels.** The season plan is the head's list of targets, each with the hours it needs (the template of the year, as today), turned
  into claims on members by week. The year plan is the meeting's routines turned into claims on households in days a season.
- **Sovereignty** is the model itself: a pawn's week is partitioned among claimants; over-claiming is resolved by a precedence order.
- **Task choice** is the pawn's: within a household claim it takes the household's most urgent open work it is fit for (today's fit
  number, read by one pawn for itself).
- **Replanning** is nearly absent: there are no assignments to repair. A claim short of its purpose is raised at the head's review.
- **Parity.** Verbs `claim`, `release`, `call`; a controller steers by claiming hours for purposes and, as a member, by choosing tasks.
- **The page.** A band chart of whose hours are whose, by day, week and season; targets on meters. No list of who does what, except as a forecast.
- **Cost.** Claims: 200 households × 8 weeks × about 6 members a year, trivial. Task choice: 1,000 pawns × about 6 choices a day ×
  about 10 open tasks = 60,000 fits a day, the same order as today's 50,000, with no saving.
- **Kept / replaced.** Keeps the board, the rules that post, the fit. Replaces `allot` with a per-pawn choice; adds `sim/claims`.
- **Fails where** the history already shows: with each hand choosing alone, every hand's best task was the same field and the spring
  raking was missed (`docs/review-jobs.md`, section 9), which is why the join factor exists; coordination has to be re-invented as
  claims with ever narrower purposes, which is assignment by another name. S2 (a task exists because a rule fired) is untouched, and
  the head as player cannot order the season's work, which section 7 of `design.md` gives it.

### Candidate B: the tree (commitments refined downward)

**Idea.** One tree of commitments. A year step of the village ("the fence closed by spring day 1") is refined into season steps of
households, those into week steps of members, those into tasks, those into legs. Hours are derived by summing leaves.

```ts
type Node = { id; body: BodyRef; horizon: 'year'|'season'|'week'|'day'|'task'; what: Goal | Target | Routine;
              window: [Hour, Hour]; parent: NodeId | null; children: NodeId[]; assigned: BodyRef | null;
              author: 'custom' | 'pawn'; state: 'planned'|'open'|'done'|'failed' };
// st.plans.nodes (owner: sim/plans); a body's plan is the subtree it authors
```

- **Levels.** Each body refines its parent's nodes at its own cadence: the meeting yearly, the head each season and week, the pawn each day.
- **Sovereignty** is what is left: a pawn's own time is the hours no node covers. Obligations are nodes placed in the debtor's tree by the creditor.
- **The task as a plan** is the lowest refinement, stored as child nodes and patched when cut.
- **Replanning** propagates along the tree: a failed leaf marks its parent at risk, which re-refines; a changed parent invalidates its children.
- **Parity.** Verbs to add, move, assign and remove nodes; the default author is a refinement rule per node kind.
- **The page.** An outline or Gantt: the village's year opens into households' seasons, into members' weeks. It reads clearly.
- **Cost.** Nodes: 1,000 pawns × about 8 tasks a day × 6 days in view is about 50,000 live leaves, each with parents; every deviation
  walks up and down. Stored legs as nodes multiply that by five.
- **Kept / replaced.** Replaces the board, the day's lists, the projects' records and the player's plan with the tree; keeps the template as the refinement rule.
- **Fails where** plans meet a world that moves: a look finds new work in 92% of looks (*measured*, VB-1564), so a tree refined a week
  ahead to the task is mostly wrong by the time it is walked, and each repair travels the tree (thrashing, or a dead band so wide that
  the tree is ignored). Storing a task's legs as nodes is the phase machine again, with its exits. Most of all, a member is a
  resource of its head's tree: own time, leave and obligations are exceptions to it, where Kim's sovereignty makes them the rule.

### Candidate C: the exchange (asks and answers)

**Idea.** No body commands another. Every allocation between bodies is an **offer** (`sim/offers`: one asks, the other answers, once):
the alderman asks households for days, the head asks members for hours, a creditor's due is a standing contract agreed earlier.
A body's plan is what it has accepted plus what it means to do itself.

```ts
type Ask    = { id; from: BodyRef; to: BodyRef; hours: number; window: [Hour, Hour]; forWhat: Goal | Target;
                gives: { goodwill?: number; rations?: number; standing?: number } | 'due' };       // 'due': answers an obligation
type Answer = 'yes' | 'no' | { counter: Partial<Ask> };
// st.offers (owner: sim/offers), a commitment once accepted (owner: sim/claims)
```

- **Levels.** The same five horizons; a plan step that needs another body's hours becomes an ask at that body's planning cadence.
- **Sovereignty** is total: all hours are a pawn's own until it agrees otherwise; a household's authority is the habit of saying yes.
- **Replanning** is renegotiation: a body that cannot keep a commitment asks to be released or defaults.
- **Parity** is the strongest of the three: answering asks is an interface an LLM plays naturally; every decision is a decision point.
- **The page.** An inbox of asks and a ledger of commitments, at every level.
- **Cost.** Head to members: 200 households × about 5 members × about 15 steps a week is 15,000 asks a week, each an offer record, an
  answer weighed by opinion, and a memory on refusal; and the reaction to an urgent task waits on answers.
- **Kept / replaced.** Builds on `sim/offers`, `sim/voice`, `sim/hands` (help asked). Replaces `allot` with a round of asks.
- **Fails where** it contradicts what is Decided and what the past records: "the head allots the household's day" (Kim, 15 November); a
  household is not a market, and a child or a servant does not negotiate its day. Between households, though, it is exactly right, and
  already built that way: help is an ask (VB-470), leave is an ask, a loan is an ask.

---

## 4. Comparison

| | A: the ledger | B: the tree | C: the exchange | Recommended: claims on a shallow tree |
| --- | --- | --- | --- | --- |
| What crosses a level | hours for a purpose | a node to refine | an ask to answer | a claim (hours, window, purpose) inside a body's authority; an ask outside it |
| Who chooses the task | the pawn | the level above | whoever agreed | the head assigns within the household; the pawn orders its day and its own hours |
| Sovereignty | the model | a remainder | total | the interface between bodies, with customary ceilings |
| Obligations | a claim | a foreign node | a standing contract | a claim whose right is an obligation |
| Coordination of hands | weak (the join-factor history) | strong | slow | strong within a household, by claim between them |
| Replanning | little to repair | travels the tree | renegotiation | absorbed at the lowest level with slack; only a shortfall of hours travels |
| Explicit intent (S1, S2) | no | yes | partly | yes, at four horizons, not below the task |
| Cost against today | equal | higher | higher | lower (section 5.6) |
| Parity for an LLM | coarse levers | many small edits | natural | decision points at each cadence, with fill-in by the default author |
| The page | bands | outline | inbox | one strip at four zooms: bands (whose hours) with steps on them |
| Breaks a Decided row | the head's day | no | the head's day | rewrites the cadence of the head's day (week first, day as a reading) |
| Main risk | hands pile up | thrash, stale plans | chatter, delay | the week going stale (P5 tests it) |

---

## 5. The recommendation: claims on a shallow tree

Take from B the explicit step, but keep the tree shallow: flat lists of steps per body and horizon, each step with at most one link
upward, and nothing stored below the task. Take from A the ledger as the *only* thing that crosses from one body to another: a
claim on hours. Take from C the ask, for every case where the claimant has no right. The sentence to remember: **a plan is a body's
own list of steps; a claim is how one body's step takes another body's hours; sovereignty is what claims leave.**

### 5.1 The data model

```ts
type BodyRef = { kind: 'pawn'|'household'|'village'|'estate'; id: number };
type Horizon = 'year' | 'season' | 'week';                       // the day is a view of the week; the task is section 2.2

type PlanStep = {
  id: number;
  what:    { goal: Goal } | { target: { store: StoreRef; good: Good; level: number } } | { duty: WorkType }
         | { routine: RoutineKey } | { project: ProjectId } | { aim: AimKey };          // an aim is a pawn's own (to marry, a portion)
  window:  [from: Hour, until: Hour];
  hours:   { lo: number; mid: number; hi: number };              // the planner's estimate (sim/estimate), never the world's hours
  who:     BodyRef | null;                                       // the body inside the planner's authority it is given to; null: open
  from:    { step: StepId; of: PlanKey } | { claim: ClaimId } | { custom: string } | null;   // the one link upward (R1)
  author:  'custom' | 'pawn';                                    // 'pawn': written through a verb by the body's agent, whoever controls it
  state:   'planned' | 'open' | 'at-risk' | 'done' | 'failed' | 'dropped';
};
type Plan = { body: BodyRef; horizon: Horizon; agent: PawnId; steps: PlanStep[]; reviewed: Hour };
// st.plans.of: Map<bodyKey, {year?: Plan; season?: Plan; week?: Plan}>         owner: sim/plans. Plain data, saved.
// st.claims, st.claimsOn (by debtor and week), st.claimsDue (a due-queue)      owner: sim/claims
// st.jobs: today's open task instances, each naming the PlanStep that opened it owner: sim/jobs (the board, kept as a store)
```

Who holds what, by default (R3: any body may hold any horizon; these are where each mostly plans):

| Plan | Agent | Steps | Written |
| --- | --- | --- | --- |
| Village, year | the alderman (or the eldest holder, as today) | the meeting's routines; each becomes claims on households in days a season | at the meeting; the alderman places dates at his review |
| Household, year | the head | land steps, projects, the rotation; what the season plans inherit | at the moving round's day and the year's first review |
| Household, season | the head | the template's rows for the season as steps with targets, windows and estimated hours; claims from above as hours already spoken for | at the season's first review (as `sim/seasonal` compiles today) |
| Household, week | the head | tasks and duties given to members; each gives rise to a claim on that member | on its planning day, rolling |
| Pawn, week | the pawn | the steps claimed of it, in its own order by day, and its own steps in its own hours | each morning, as a reading; on a change |
| Pawn, year | the pawn | aims: to marry, a portion to save, a craft at the side | yearly, and when an aim is met or fails |

A parent's step becomes a child's commitment in exactly one way: the parent's agent issues `assign` (inside its own body) or `claim`
(on another body), and the receiving body's plan gains a step whose `from` names it. The receiving body decides how: a household
claimed for "two days in spring, the fence" chooses which adult and, unless the claimant holds the right to name the day, which day.
**A claim is stated at the grain of the claimant's horizon and resolved by the claimed.**

### 5.2 Sovereignty: claims as nested budgets of hours

**Available hours.** `H(pawn, day)`: the working day's 12 hours times the pawn's hands by age and health (`AGES.hands`), nothing for
a day abed. The night is the pawn's own and is spent on sleep; working it is a choice with a cost (`sim/sleep`), open to every pawn.

**A claim** is `Claim` of candidate A, with two additions: `grain` (`'hours'`, `'days'`) and `notice` (hours ahead it must be made).
Its `right` says why it binds:

| Claimant → claimed | Right | Grain and window | Ceiling (a custom or the record, a named parameter) | Notice |
| --- | --- | --- | --- | --- |
| Household → its member | membership (`member`, `servant`) | hours in a week | a share of the member's working hours, by standing: adult 0.85, servant 0.9, the retired by their contract (undantag), a child by age | the morning; inside it, a call |
| Village → its household | the meeting's decision (a routine) | adult-days in a season | the routines chosen, at most four; a custom may set lots by fields (`wayDuty`) | a season; the date at least 3 days |
| Creditor (a household, an estate) → household | an obligation (`days`: debt, keep, patron's due) | adult-days in a season or year | the obligation's amount | the date at least 3 days (`DAYS.notice`) |
| Minded dependant → minder | the minder's charge | attention, partial | what the dependant needs | none |
| Anyone → anyone | none: an **ask** (help, hire, leave) | as offered | what the answerer agrees | as offered |

**The budget.** For each pawn and each week `sim/claims` compiles four numbers that sum to its available hours (R4): owed outward,
village, household, own. Higher claims are on a *household*, in days; the head resolves each to a member and the day's hours come off
that member's household share first. So the nesting is real: the village's share of a household's days is taken before the head's
share of its members' hours, and the member's own hours are what both leave.

**Sovereignty** of a pawn in a period is `own / H`, a measure (A label is read, never a switch): shown on its card, read by rules
that want it (a servant's opinion of its master, mood, whether one leaves), never a threshold that switches anything.

**Made.** By `claim`, by an agent with the right, with the notice its grain asks; a claim above a ceiling is refused by the verb's
check and may be sent as an ask. A head does not claim what its plan does not need: the claim's hours are its steps' estimates (the
head's, flaws and all), so a poor head that leans short claims too little and must call later.

**Honoured.** Hours worked on a task opened by the claim's step are booked to it (as `sim/days` books hours against an obligation).
A claim ends `met` (its hours or its step done), `lapsed` (the window passed uncalled, as keep days lapse), `released` or `defaulted`.

**Over-claimed.** Claims are made at different horizons by agents who do not see each other's plans, so the sum may exceed `H`.
Nothing in the simulation resolves it; the claimed body's agent does, on its planning day or when the second claim arrives, by a
judgement that is a threshold on what it weighs (A judgement is never a die): for each claim, the cost of shorting it. The default
author's order: vital work of its own household (water, the meal, the fire) → a claim with an enforcer (an obligation, a village day:
the cost is a case, standing lost, a memory held by the creditor) → its household's windowed work → the rest; with one exception that
makes the history: when keeping an outside claim would put the household's food outlook in "bad" by the head's estimate, the head
shorts the outside claim. That is a **default**, with a reason ("the rye stood ripe"), told in the record, heard at the meeting as
any default. Hunger presses; the corvée at harvest is a conflict the rules produce without being told to.

**Traded.** Four acts, each a verb with a check that holds for any pawn: `substitute` (a claim on a household is met by any of its
adults, or by a hand it hired); `commute` (the claimed offers goods for the hours at the worth table, 3 rations a day; the claimant
answers); `transfer` (a claimant gives its claim to another body: the alderman lends a day of his keep to a household in need);
`release` (the claimant gives hours back; the member's ask for leave is an ask for a release). Title to hours moves at once, as any right does.

**What own hours are for.** (1) Own time, as built: a pastime, a visit, courting (`sim/pastimes`). (2) Own aims: a pawn's year step
("a portion of 20 rations before I marry") opens work at the side that books to the pawn (spinning, slöjd, a patch). (3) Hours sold:
`hired` is a pawn spending own hours on another household's step for a wage; the landless adult's whole week is its own, which is
what makes it the hired hand. (4) Hours given: a member may work its own hours on its household's open steps ("Acting without the
plan"), by its diligence; so "work beats idling" becomes a trait's weight on a choice, not a rule, and a slack member in a hard
week is something the head sees and may call on. (5) Rest. A wait is the thing waited for: a couple that waits to marry is a pawn
whose own hours have not yet earned the portion.

### 5.3 Replanning: absorb below, pass up only a shortfall of hours

**Triggers**, all of them events that exist: a leg's end with `blocked`; a member's hours changing (ill, dead, away, a leave given, a
day called by a creditor); a step's projected end leaving the *range* of the planner's estimate (`sim/estimate`'s honest range is the
dead band: a head with a wide range re-plans rarely and is surprised late); a store crossing a target; a window closing; a new claim
or ask arriving; the planning day.

**The ladder.** A deviation is offered to each level in turn and stops at the first that can take it:

1. *The task:* `next` chooses another method (no cart: carry on the back).
2. *The pawn's day:* it reorders its own list (the wet field waits, the wood goes first).
3. *The pawn's week:* the step moves to another day inside its window, into the pawn's unassigned claimed hours.
4. *The household's week:* the head, at a review out of turn (at most one a day for one cause, as a store's crossing today), gives
   the step to another member, claims more of a member up to its ceiling, drops the least pressing step, or asks for help (an ask).
5. *The household's season:* a target is lowered (a field left fallow) or a default chosen (5.2). The outlook changes; the record says why.
6. *The village's year:* a household that defaults or is released leaves the alderman's step short; at his review he moves the days to other households or lets the routine fail (the cattle in the crop is a story).

What travels upward is one number, the hours short and by when, never a re-refinement of the levels above. What travels downward is a
changed claim, at its notice; inside the notice it is a **call**, instant as today, its cost (the walk, the load set down) named first.

**Stability.** (a) A step keeps its id and its holder across reviews; a review writes a difference. (b) A step moves to another member
only when the gain exceeds the cost of the handover, which is physical (the walk to the site, the tool to fetch), so What can be
undone costs something to undo holds without a tuned factor: this is the standing duty, and it differs from `MATCH.keep` in that a
step with a window is assigned by its window first, so work that opens with a season is never late for it. (c) The estimate's range is
the dead band. (d) Due kinds (water, the meal, milking, fodder) are slotted in as today (`slotIn`) and never cause a review.

### 5.4 Parity: one structure, several authors

**Authors.** Every step has an author: `custom` (the default author, the rule-based chooser running for the body's agent) or `pawn`
(written through a verb by the agent's controller: a human, a script, an LLM; the command's `source` says which, the plan does not
care). The rule that lets a manual and an automatic plan meet (the open question of `docs/ui2/HANDOFF.md`): **the default author
fills what is not authored and never rewrites what is.** An authored step stands until it is done, fails or is removed (question 6 of
the review; it generalises `plan.day.edited` and `ground`). A controller may thus author one season target and leave the weeks to the
rule, or author its own week under a head it does not play.

**Verbs** (each registered by the module that carries it out, its check binding any pawn; the right is the actor's position):

| Verb | Who may | What |
| --- | --- | --- |
| `plan` | the agent of the body | add, change, order or remove a step of the body's plan at a horizon (subsumes `target`, `tile`, `order`, `project`, `dayOrder`, and `Sim.plan`'s ops) |
| `assign` | the agent | give a step to a body inside its authority (subsumes `dayGive`) |
| `claim`, `call`, `release`, `transfer` | the claimant's agent, by its right | 5.2 (subsume `callDays`, `callWorkday`, `dayCall`) |
| `ask`, `answer` | anyone | help, hire, leave, commutation (as `sim/offers`; `wish` and `propose` become these) |
| `substitute`, `commute`, `default` | the claimed body's agent | 5.2 |
| `aim` | any pawn | a step of its own plan |
| `work`, `pastime`, `sleep`, ... | any pawn | as today |

**The `Sim` API**, keyed by body, never by "the player": `Sim.plans(st, body)` (the three plans, each step with its `why` chain and
estimate), `Sim.budget(st, pawn, week)` (the four shares), `Sim.claims(st, body)`, `Sim.strip(st, body, zoom)` (the view of 5.5:
`sim/timetable` and `sim/agenda` made one, by the looking pawn's estimate), `Sim.decisions(st, pawn)` (the decision points now open to
the bodies this pawn is agent of), `Sim.command(st, cmd)`. Everything is read through the actor view.

**Decision points, not polling.** A controller is consulted where the default author would run: the review of a plan (year, season,
week), an ask to answer, an over-claim to resolve, a step at risk, a leg's end for a pawn with `auto` off. Each has a deadline in game
time, after which the default author answers. Predicted load: about 1.2 a head-day, 0.15 an alderman-day, 2 a pawn-day for a pawn that
plans its own week (P14). Commands from a controller are inputs and are recorded for replay (the review's question 9).

**The default author, cheaply.** *Year (village):* the meeting chooses routines as today; the alderman turns each into days a
household by the custom's lots and places dates on the days his estimate shows the claimed households least loaded. *Year and season
(household):* the culture's template (kept), compiled to steps: target less store gives a quantity, the kind's hours give the
estimate, the template gives the window and the order. *Week (household):* greedy, as today's `allot`, over steps rather than jobs and
six days rather than one: steps by window's end, then urgency; each to the member with the best rank for its kind who has claimed hours
left, the holder of the same duty last week first when the handover cost says so; a further hand counts 0.8 as today. *Day (pawn):* due
steps at their hours, then by window, then nearest to where the last one ends, which is how "already at the forest tile" comes about
(section 2.2 then picks the short method). *Task:* `next`. The fit number survives as the rank inside the week's greedy; hunger,
thirst, calls and duties stop being terms of it and become precedence, due hours, claims and the handover cost.

### 5.5 The page: one strip at four zooms

Like is shown alike: every plan of every body is the same thing, a **strip** of time whose bands are coloured by who holds the
hours (own, household, village, owed, lent) and carry the steps as icons with at most a number. It is the day strip of
`src/page/ui2day.js` given three more zooms, and every planned step is also a pin on the land, as today.

| Zoom | Columns | A row | Shown on a band |
| --- | --- | --- | --- |
| Day | hours | a pawn | tasks, each a range by the looking pawn's estimate; the leg under way exact |
| Week | six days | a pawn | steps and duties by day; the claimed and own shares as a stacked bar a day |
| Season | twelve days | a member (household) or a store's target | windows as bars, targets on the one meter, days owed as blocks (hatched until a date is called) |
| Year | four seasons | a household (village) or a project | routines, claimed days against each household's load, projects, aims |

- **As a member.** My week: most of each day in the household's colour with its steps ("the wood, Olof's week"), a village day, the
  rest mine. A tap on a household step tells who chose it and why (Reasons shown, now the step's `why` chain) and offers "ask leave";
  a tap on my own hours offers what own hours are for: a pastime, a visit, side work towards my aim, hire myself out, give the hours
  to the household. My sovereignty is the share of the strip in my colour: a picture, with the number a tap away.
- **As head.** The household's week: a row a member, steps as chips to drag between members and days (the verbs `assign` and `plan`),
  a thin meter at each row's end (claimed against the ceiling). Steps the rule wrote are plain; mine carry a mark and stay. Above it
  the season: the template's rows as bars with their windows and estimates, targets on meters, and from above the hours already spoken
  for (the fence day; "three days to Ekeby, uncalled" with the acts `substitute`, `commute`). A step at risk is flagged with its cause.
- **As alderman.** The village's year: a row a household, a column a season, each cell the household's load by my estimate with the
  village's claim drawn on it; I place the work day where the cells are lightest and see whom it hurts. Defaults and releases show as
  gaps in the routine's bar. The same view serves an estate's steward.
- **One level up, read-only.** Any pawn may open the strip of the body that claims it (the household's week, the village's year):
  knowledge moves at once. It changes nothing there but may ask.

### 5.6 Cost, named before building (rule 10)

At the late reference: about 1,000 living, 200 households, 48 days a year.

| Work | Entities × cadence × work | A day |
| --- | --- | --- |
| Year plans (village, household) | (12 villages + 200 households) × 1 a year × about 40 rows | about 180 row-reads |
| Season plan | 200 × 4 a year × about 30 template rows, each asking its kind's opportunity once | about 500 asks |
| Week plan, in turn | 200 × 1 every 2 days (the mean cadence) × the *new* days' steps (about 5) × 5 members | about 2,500 pairs |
| Week plan, out of turn | 200 × 0.15 a day × about 15 steps × 5 members | about 2,250 pairs |
| Slot-in of due kinds | 200 × about 4 a day × 5 members | 4,000 pairs |
| The pawn's day | 1,000 × 1.3 a day × a sort of about 6 steps | 8,000 comparisons |
| `next` | 1,000 × 12.4 leg ends × at most 3 method tests | 37,000 tests of a few reads |
| Claims | budgets compiled 1,000 × 1 a week; a due-queue of a few hundred | under 200 |

Against today: about 44,000 pairs a day in `allot` (4.4 allotments × about 10 jobs × 5 members × 200) plus the hourly asks of about
45 rules for each holder due. Predicted: weighed pairs fall to under 40% of today's `dayPair`, rule asks to under 50% of `oppAsk`,
and the jobs-and-matching line from 75 ms to at most 35 ms a day on populous small (P6, P15). Cost follows activity (rule 1: closed
claims and done steps leave the live index and are folded yearly); nothing polls (rule 4: reviews and claims sit in due-queues);
everything is staggered by the planning day (rule 5); a pawn's budget is a compiled array (rule 6). Save: about 20 live steps a
household and 6 a pawn, some 10,000 small records, under 0.5 MB of JSON.

### 5.7 Kept, replaced, removed; and the path

**Kept as they are:** `sim/commands`, `sim/eligibility` (a basis is now a claim's basis), `sim/legs`, `sim/work`, `sim/progress`,
`sim/estimate` (it gains the step and the plan as things estimated: One quantity, one reckoning), `sim/plandays` (the stagger and the
due-queue), the template and targets of `sim/seasonal`, `sim/obligations` (the right behind a claim), `sim/decisions`, `sim/offers`,
`sim/pastimes`, `sim/stores`' reservations, `sim/fit`'s rank, `slotIn`, the kinds as records declared by their domains.

**Replaced:** `plan.day.lists` by the week plan read by the day; `allot` at 5:00 and 14:00 by the week's review and its repair;
`st.player.plan` with `sim/playerplan`, `sim/plannext`, `sim/planchains` by the pawn's and the household's plans and the kinds'
methods; `sim/agenda` and `sim/timetable` by one strip view; `st.daysCalls`, `st.daysToday`, `st.leaves`, the hands lent and the work
day's call by `st.claims`; the project plans' step lists by plan steps whose tasks have methods.

**Removed:** the phases of `st.agents[id]`; the hooks named in 2.2; the fetch kinds; the branches on the played household in `chores`,
`building`, `ladder`, `projects`, `camp`, `upgrade`; the `unplanned` gate's read of `st.player`; `MATCH.day.afternoon`.

**The path**, each step shippable and measured alone:

1. *Repairs* (the review's option A), but for VB-1548, which step 3 removes by construction.
2. *A controller per pawn* (2.3). Behaviour unchanged for unplayed pawns: `tools/same.js`.
3. *The task as a plan* for one family (the wood: `fell`, `firewood`, the haul), then the 27 carrying kinds, then all; piles at tiles
   where they are missing. Behaviour changes little; the walk's hours and stuck tasks are reported.
4. *One plan record.* Project steps, the player's tasks and chains, and the seasonal plan's steps become `PlanStep`s with authors;
   the rules stop reading who is played. The unplayed head's behaviour is unchanged while its default author writes what the rules posted.
5. *The ledger.* `sim/claims` takes over days owed, leaves, hands lent and work days; the budget is compiled; the strip shows bands.
   Behaviour unchanged: the claims describe what happens today.
6. *The week.* The head's week replaces the twice-daily allotment. This is the step that moves every balance number; it needs the
   design pass on section 7 (The day's work, The head calls, Standing duties, A member's voice) and a measurement Kim starts.
7. *The village's year and the estate*: the alderman's claims in days a season, over-claims, defaults, commutation.
8. *Tasks only by choice* (the review's option D): the board holds only instances of plan steps.

### 5.8 Failure modes and open points

- **The week goes stale** (the lesson of VB-1564). If under about 85% of a week's task-hours can be foreseen at its start, the repair
  runs as often as today's allotment and nothing is saved (P5 tests it; the fallback is a three-day window).
- **Ceilings that never bind** make sovereignty decoration; ceilings that bind often starve small households (P10).
- **A lone settler** is head, member and pawn at once: three plans for one pawn. The plans collapse (the week's assignment is trivial)
  and the page must show one strip, not three.
- **Giving own hours** (5.2, point 4) must reproduce "no one stands idle while there is work" closely enough, or households are
  worse off; the default diligence weights are the tuning surface that replaces the fit's terms.
- **Piles at tiles** widen what spoils, is stolen or forgotten; each needs a way out (What does not wear needs a way out).
- **Determinism** with authored steps: the order of steps in a plan is saved state, as the order of `KINDS` is.
- **Defaults at scale**: if the default author defaults often, meetings fill with cases (P13 bounds it).

---

## 6. Predictions

Each is a claim of the recommended design that a mock can confirm or refute. "Today" is the simulation at `1a8c44a`.

**The task as a plan**

- **P1.** Under cuts at random legs (the night, a call, a co-worker's death, a claim's window ending, the pawn's illness), a task
  whose next step is derived from the world leaves no task stuck and no good outside a store, a pile or a pawn's hands, in 10,000
  fuzzed task runs; a phase machine given the same cuts reproduces VB-1548 (an owed day ending on the road home) at least once in 1,000.
- **P2.** Eight primitives and at most three methods a kind express all of today's kinds; the 27 kinds with `back`/`carry`/`to`/`deliver`
  need no hook of their own; at most 5 kinds need a primitive or a hook beyond the eight. The kind record falls from 51 fields to at most 32.
- **P3.** In a real run, at least 8% of tasks at a place away from home begin with the pawn within one step of the place or of
  another task's site on the way; ordering a pawn's day by "nearest to where the last ended" within equal urgency cuts the walking
  hours of the wood, stone and haul kinds by at least 10% and of all work by at least 4%.
- **P4.** `next` is asked at most 14 times a pawn-day and costs under 1 ms a game day for 1,000 pawns.

**The household's week and season**

- **P5.** At the start of a six-day week, at least 85% of the task-hours a household then works are foreseeable from the season's
  template, the due kinds and its stores projected at their rates (kind, day ±1, hours ±25%). Under 70% refutes the week as the unit.
- **P6.** Full or partial reviews of a household's week number at most 0.7 a household-day (0.5 in turn, 0.2 out of turn), against
  4.4 allotments today; the pairs weighed are at most 40% of today's.
- **P7.** Without a disruption, at most 10% of assigned steps change member between two reviews; at least 80% of member-days begin
  with the type of work of the day before (today 72 to 73%), and windowed work (hay, sowing, reaping) is begun no later than under a
  daily allotment in at least 95% of cases, which `MATCH.keep` could not do.
- **P8.** On the same stream of demand, the week with repair leaves no more vital hours unmet and no more windows missed than a
  daily greedy allotment: within 10% on each, over seeds 7, 11 and 42, populous small and founders.
- **P9.** When an adult dies or lies ill for three days mid-season: the household re-plans in one review out of turn; the steps
  dropped are those with the latest windows; no season target is lowered in autumn or winter, nor in spring or summer for a
  household of three or more adults; a household of one or two adults lowers a target or asks for help in at least half the cases at a peak.
- **P10.** By the hours worked today, the household's claim would be 45 to 60% of adult working hours in spring and summer and 20 to
  40% in autumn and winter; the village's under 3% over a year; obligations under 2% over all and up to 20% for a debtor household
  in its called season; own hours at least 35% at the mean in every season. A ceiling of 0.85 binds in under 10% of member-weeks,
  nearly all of them in households of one or two adults at sowing and harvest.
- **P11.** Of windows of 3, 4, 6 and 12 days, reviews fall and stale steps rise with length; the sum of their costs (a review's
  pairs; a stale step's lost hours) is least at 4 or 6, and 6 is within 10% of 4.

**The village's year and obligations**

- **P12.** Village days claimed a season ahead and placed by the alderman on the claimed households' lightest days cost those
  households at least 30% fewer hours of displaced windowed work than the same days fixed by the calendar (spring day 1, summer day 2),
  with at least 90% of the routines' hours delivered.
- **P13.** An estate's due of 3 days a household in spring displaces under 2% of sowing hours in households of three or more adults
  and at least 10% in one-adult households. Under the default rule, defaults are under 5% of called days in a normal year, at least
  three times that in a lean year, and at least two thirds of them fall on households of one or two adults. With commutation at 3
  rations a day, households with a surplus commute and those without default.
- **P14.** A scripted external controller reaches every plan at every level through verbs: with nothing authored its run is identical
  to the default author's; with a simple lookahead (wood moved to winter, called days answered by substitution) it does at least as
  well on unmet vital hours and missed windows. Decision points: at most 1.5 a head-day, 0.2 an alderman-day, 2.5 a pawn-day for a
  pawn planning its own week. Against today's code, the same script finds at least five plan-authoring acts reachable only through
  `st.player` or by no verb at all.
- **P15.** The jobs-and-matching line falls from 75 ms to at most 35 ms a game day on populous small, by the counters: pairs weighed
  and rule asks both under half.
- **P16.** Fill, don't overwrite: with a random 30% of a household's week steps authored by a controller (valid by the verbs' checks),
  the default author's fill double-mans nothing, exceeds no ceiling, and leaves no more vital hours unmet than with nothing authored, plus 5%.

---

## 7. Questions for Kim

1. **Is the week the pawn's unit of planning, with the day as its reading?** Proposed: yes, six days, rolling (2.1). It rewrites the
   cadence of "The day's work" (Decided, 15 and 23 November): the 14:00 allotment becomes a repair.
2. **Is a claim binding inside a ceiling and an ask above it?** Proposed: yes; the ceilings are customs, so they differ between villages and can be argued at the meeting.
3. **May a head default on a village's or an estate's claim to save its harvest?** Proposed: yes, as a judgement with a cost; it is where "Hunger presses" meets obligations.
4. **Are a pawn's unclaimed hours its own, so that "work beats idling" becomes a weight?** Proposed: yes; it is what makes sovereignty more than a display, and the largest behavioural risk.
5. **Does the board stay?** Proposed: yes, as the store of today's open task instances; no rule decides there.
6. **Does the task keep no phase?** Proposed: yes; progress is in the world (piles, loads, stage hours). It needs piles at tiles for every carried good.
7. **Which trades of claims come first?** Proposed: `substitute` and `release` (leave) with the ledger; `commute` and `transfer` with the estate.
8. **May any pawn read the plan of the body that claims it?** Proposed: yes (knowledge moves at once); the actor view is where that would later narrow.
