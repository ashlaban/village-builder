# Slices: what each brings, and their order

> Split from `docs/roadmap.md` on 16 November 2026. The timeline of what was built when, and the estimate of when the rest is done,
> is `docs/roadmap.html`, made from the backlog by `tools/roadmap.js`. The late game's budget, the ten rules for cost and cheap
> measurement are `docs/cost.md`. Sections 1 to 4 keep the roadmap's numbers (a reference to "roadmap 3.4" is section 3.4 here);
> the roadmap's section 5 is `docs/cost.md` section 1, its section 6 is `docs/cost.md` section 2, and its sections 7 and 8 are 5 and 6 here.


> Testing policy updated by VB-408 (12 November 2026): [Testing](testing.md) supersedes the golden-file,
> suite membership and CI requirements below. There are no permanent behavior baselines to update.
> Refactors preserve behavior through focused contracts and `tools/same.js` against their starting commit.
> Late fixtures and long measurements run in the extended/nightly tier, not routine PR verification.


Written on 3 November 2026, when Kim made `docs/architecture/target-v2.md` the project's architecture reference. Kim asked four
things: which vertical slices to build, in what order, how to keep the game fast (above all late in a run), and how to make
measuring that cheap. Kim also noted that target-v2 is mostly a framework, and that the concrete systems built on it still need
designing. Read at `fc5c2fc`. The numbers in `docs/cost.md` section 1 were measured that day in this repository's container (4 cores, Node), with
`tools/sim.js` and a 40-year save. They are one run each, so treat them as accurate to about 10%.

Kim decided on 3 November, marked **Decided**: the slices and their order, about 1,000 living pawns on a medium map as the late
game's reference, `design.md` v0.4 as a skeleton the slices fill in, the budget, the work counters, and the ten rules (now in
`AGENTS.md`). The rest is **Proposed**. The slices are archs of `BACKLOG.md` (keys in section 5). No code changes.

## 1. In short

- **A slice is one thing the player can do or see,** built through every layer it needs. Target-v2's framework pieces arrive with
  their first consumer, not before. There are ten slices, plus slice 0, the yardstick that measures the others.
- **The order** (Decided, Kim, 3 Nov): 0, the yardstick; then 1, kin help booked as goodwill (the walking skeleton), beside 2, a life (the player inhabits a
  pawn); 3, the household's year (opportunities, plans, tasks); 4, the autumn fair; 5, debt and land; 6, the mill and the loom;
  7, talk travels; 8, the ship; 9, the town; 10, roads, boats and ice. Kim, 16 November: slice 8, the ship (the dealings with the outside world), is taken last of all, after the town and the roads; the numbers stay as names. The gossip experiment runs beside them from slice 0 on.
- **Why this order:** the riskiest framework bets go first: plans replacing posted jobs, and goodwill as a currency. After them comes
  the cities review's road (fair, credit, specialists, ships, town). Each slice is playable on its own.
- **Each slice is an arch.** Its plan task is the design pass that makes its systems concrete and writes them into `design.md` v0.4.
  Its wrap-up reports its probes and what it costs.
- **The late game is the cost of history,** not only of 1,000 people. Measured on populous small: from year 1 to year 41, people
- **The late game, its budget and how cost is measured:** `docs/cost.md`.

## 2. What a slice is

The idea is the walking skeleton (Cockburn, *Crystal Clear*, 2004) or the tracer bullet (Hunt and Thomas, *The Pragmatic
Programmer*, 1999): a thin piece that runs end to end, then grows. Both citations are from memory. Here it means:

1. **A slice ends in something the player can do or see, and a probe that measures it.** Plumbing alone is not a slice. Slice 0 is
   the exception: it is the measuring rod.
2. **Framework arrives with its first consumer.** A target-v2 module is built only as far as the slice needs. Stores gains typed
   goods when the fair needs a cow and a sack; land gains `use` beside `own` when the first tenancy needs it. This is the rule of
   `AGENTS.md` on special cases, applied to the architecture: an abstraction earns its place.
3. **Behaviour-preserving first.** A slice starts with refactors that move today's behaviour behind the target's interfaces, with the
   golden file unchanged. Behaviour then changes in tasks that re-record it.
4. **A slice is an arch,** with the three phases of `BACKLOG.md`:
   - plan: a design pass on the concrete system, its numbers, what the player sees and its cost; it writes the `design.md` sections
     and the tasks;
   - implement;
   - wrap-up: probes and bands, and the cost against the budget.
5. **A slice names its cost before it is built:** entities, times cadence, times work per call; and the line it adds to the budget
   table (`docs/cost.md`, section 1.2). Its wrap-up measures that line.

## 3. The slices

| # | Slice | The player can | Framework it brings (target-v2 section) |
|---|---|---|---|
| 0 | The yardstick | (the team can measure every later slice at its own cost) | Work counters, fixtures, bands (6.2), the rules registry with `death.hazard` (4.1), indexes of the living |
| 1 | Kin help, booked | See who owes whom goodwill, and why help was given or refused | Stores with goods (4.3), goodwill and `allowance` (4.4), Exchange's gift (4.5), `explain` |
| 2 | A life | Inhabit a pawn, queue what it does, argue at the meeting, answer an offer of marriage, read its line's history, skip to the next event, go on as kin after its death; save in the page | Opportunities for a pawn (4.5), the player's doors (4.7) but `Decisions.answer`, the actor view |
| 3 | The household's year | As holder, set the season's plan and place the next field; as a member, follow it or not | Opportunities, plans, tasks, eligibility, planning days, the meeting's routines, attention (4.5) |
| 4 | The autumn fair | Barter at the fair, borrow, lend | Typed goods and custody (4.3), venues, occasions, reach on foot (4.2), swap and loan, norms (5.1–5.3), Obligations (4.4) |
| 5 | Debt and land | Press a debt, sit at the hearing, farm as a tenant | Land rights (4.3), Enforcement and Decisions (4.5), class with hysteresis (4.6), the bodies decision |
| 6 | The mill and the loom | Build a mill with the village, learn a craft, spin and weave | Facilities and construction (4.3), recipes with subtypes, skills, the textile chain (5.6), occupation |
| 7 | Talk travels | Hear what people say; carry a reputation; lie, and be found out | Traits (4.4), encounters at venues, stories (4.4, 10.2) |
| 8 | The ship | Sell butter for silver, take passage, meet a priest | The outside world, silver, institutions and rank (4.4, 4.5); disease (10.3) |
| 9 | The town | Deal on the green at a rite or a meeting, walk to a maker's door, live partly by a craft and let fields go, ask for a plot where the custom is (16 Nov: the town itself waits, 3.9) | A place's label as a derived view (4.6), crowding in `death.hazard`, the strata and the sink reported (6.1, 6.3) |
| 10 | Roads, boats and ice | Cross the frozen sound to the winter fair; build a road or a bridge | Modes, vehicles and climate (4.2), built ways and passage (4.3) |

Each slice below lists what it brings and what it takes over from today's backlog. It also says what must be designed concretely
first: that design pass is its plan task.

### 3.0 The yardstick

- **Brings:** work counters, scaling and history checks, late-game fixtures and a bench history (`docs/cost.md`, section 2). The reduced-scenario
  harness asserts bands in `npm run verify`; the full bands run nightly (target-v2 6.2, Kim's decision 9). It also brings the rules
  registry, with `death.hazard` as its first rule and behaviour unchanged, so `value()` is measured from the start; disease
  contributes to that rule later. Indexes of the living take the dead out of the hot loops (`docs/cost.md`, section 1.4).
- **Takes over:** VB-088 (rewritten around counters and fixtures), VB-163 (its floors become the harness's first asserted bands),
  VB-166 (frame times, unchanged), VB-097 (measured on the fixture), VB-173 (the owners check, with target-v2's "cache" category),
  VB-055 (tooling); VB-057 was closed, not built, on 10 November.
- **Design pass:** the late reference state and the budget (`docs/cost.md`, section 1.2).

### 3.1 Kin help, booked

The walking skeleton. It is the smallest slice that touches five layers, and today's behaviour barely changes.

- **Brings:**
  - kernel: the `allowance` rule;
  - material: `sim/stores` (VB-174, with a `good` argument);
  - social: a goodwill balance per pair of pawns, beside opinion (after VB-178); the household's agent is today's holder;
  - agency: Exchange with one mechanism, the gift, which `sim/help` becomes;
  - page: the pawn panel shows balances and `explain(allowance)`;
  - derived: a probe of the balances.
- **Takes over:** VB-174, VB-178; the questions on VB-039 and VB-106 (help as memories).
- **Design pass:**
  - goodwill's unit (customary rations) and its decay;
  - the culture's curve coupling goodwill to opinion, starting from what a gift does to the tie today;
  - the floor (seed and some days of food);
  - the contributions to `allowance`, with their ranges.
- **Done when:** help in hunger works as today; balances are booked and shown; the golden file changes for the booking only.

**8 November update (Kim, VB-182's plan; `QUESTION_ARCHIVE.md`, "VB-182").**
- **Decided in the design pass** (`design.md`, section 9, The gift): goodwill in customary rations, halving in 4 years, 32 counterparts
  a pawn; the floor at the seed reserve and 20 days of need; `allowance` as grain above the floor (`slack`), less the holder's own
  reserve (`reserve`, generosity's stand-in until slice 7), plus a `goodwill` term; the debtor's gratitude and the creditor's souring
  over an old debt. Goodwill is booked and shown only in this slice: its curves and its term in `allowance` act from the head of
  slice 4 (VB-220), so "done when" above stands. The two holders book; the village store books nothing; half passes at a handover.
- **The tasks.** VB-216 (the gift through Exchange and the verb `give`, the floor and `allowance`, golden unchanged), VB-217 (goodwill
  booked, golden re-recorded for it only), VB-218 (the panel), and the wrap-up VB-219 with its probe of the balances. Beside them:
  VB-220 in slice 4 (goodwill acts) and VB-221 in slice 2 (the player's gift, to any household, not bound by its pawn's allowance).
- **Budget line:** under 0.1 ms a game day at the late reference (about 500 gifts a year among 2,531 living at `medium-y60`, no pawn
  with more than 6 counterparts in a year). The save: its balances under 0.5% of the late save's JSON (Kim, 8 Nov), about 300 KB at
  `medium-y60`, in place of the plan's 50 KB, counted from one year's pairs before measuring that balances accumulate (VB-217's Flag).
- **Revised while building (Kim, 8 Nov; `QUESTION_ARCHIVE.md`, "VB-217").** Goodwill is one decaying number a pair, read from its value
  and when it last changed, with no step of its own; dealings are for stories. Help in hunger becomes rarer and larger, by a new principle
  (Lumps and occasions): at most once a season, a household asks for enough to reach the next harvest (VB-222). So "done when" above now
  reads: help in hunger as a seasonal ask, measured against today's; balances booked and shown; the golden file changed for these two.

### 3.2 A life

The vision's core (Kim, 3 November). Every later slice should be tried through the player's pawn, and the four doors of target-v2
4.7 shape the interfaces built after it. That is cheap now and dear later.

- **Brings:**
  - the first step of the jobs rework: each `KINDS` record gains `available(st, holder)`, and the posting rules of `refreshJobs`
    move there, with the golden file unchanged;
  - `Opportunities.forPawn` ("what can I do here, for whom, on what basis");
  - the player as a command source (VB-169);
  - `Decisions.answer` over today's meeting (only the answer door);
  - the player's succession: on death, choose among kin, household and close ties;
  - ambitions read from the record;
  - the actor view, omniscient for now.
- **Takes over:** VB-177, VB-169, VB-077 (saves in the page), VB-079 (its design pass), and the parts of VB-099 (the chronicle) that
  ambitions need.
- **Design pass:**
  - the player-role text of `docs/review-architecture.md` section 3 (`QUESTIONS.md`, Priority 1, questions 1 to 5);
  - what the player sees of the pawn: needs, what it may do, the household's plan;
  - ambitions for the first version;
  - whether the player may go below the floor (target-v2 10.1).
- **Cost:** nothing per game day; opportunities for one pawn, on demand.

**8 November update (Kim, VB-079's plan; `QUESTION_ARCHIVE.md`, "VB-079").**
- **Changes to the list above.**
  - The player is a source with a queue: its commands go before the pawn's own logic, and the role's automatic behaviour is the
    fallback, with a switch to turn it off.
  - The meeting is reached through advocacy only, so `Decisions.answer` waits for the first question that needs the player's answer
    (a holder's plan, slice 3, or a testament, slice 5).
  - Ambitions are postponed to late in the design, and so are the parts of VB-099 they needed.
  - The round's acts take the player's wish where the round reads a pawn's own want, under the same rules.
  - Each save names its build.
- **The tasks.** VB-208 (each kind's `available`, golden unchanged), VB-209 (`Opportunities.forPawn` and the actor view), VB-169 (the
  player's queue), VB-210 (playing a pawn in the page), VB-211 (advocacy), VB-212 (the round's acts as the player's wishes), VB-213 (the
  player's succession), VB-214 (saves in the page), VB-215 (autosave at the round, once a save is under 0.5 s), and the wrap-up VB-078.
  Their order and costs are in `docs/review-life.md`.
- **Budget line:** 0 ms a game day of simulation, and, without a player, the state and counters unchanged. In the page,
  opportunities for one pawn under 1 ms a call.

**9 November update (Kim, the gameplay review).** The review found slice 2 thin as planned: the queue offers the chores the pawn would
do anyway, real choices come about once a year, and the largest of a life, marriage, was not the player's. Kim's decisions:
- **Marriage is a negotiation** between two households, and the player takes part, for its pawn and as head for its members
  (`design.md`, Marriage as a negotiation). This replaces "no say until courting". VB-233 plans it: a first version here (the round's
  match becomes an offer both sides answer, the first question through `Decisions.answer`), terms with slice 4's goods, courting in slice 7.
- **The chronicle is built here**, apart from ambitions (VB-099, priority 2): it is the game's memory.
- **Skip to the next event** that concerns the played pawn (VB-234), on VB-098's list of notable events (priority 2 with it).
- **The player steers by position:** what its pawn's position commands, the player chooses. Head of a household is the first such
  position, and slice 3 designs it (below).
- Kim accepted the proposals for all three the same day (`QUESTION_ARCHIVE.md`, "VB-233", "VB-234", "VB-099"): an offer waits 7 game days;
  a skip pauses on what concerns the played pawn, and at the eve of the moving round at the latest; the chronicle is a History tab.
- VB-233's plan (10 Nov) wrote marriage's tasks: VB-293 (each match an offer both households answer, kept in `st.offers` with a
  due time when the player must answer; no player, no change), VB-273 (the offer in the page), VB-274 (the wish for a match), and
  VB-275 (opinion in the answers, waiting for Kim's answer in `QUESTIONS.md`). The terms are VB-276, in slice 4; courting's part is
  VB-036's, in slice 7. Cost: no stored offer without a player, about 0.06 a household a year with one, nothing polled between rounds.
- An offer is made in the man's village's round. VB-242's plan (10 Nov) makes the round a village a step (VB-277, after VB-293;
  `design.md`, Leaving home: A village's round), so a pair held by an offer is not free to a later village's men the same day.
- **Distance between villages governs what reaches between them, and the pawn travels** (Kim, 10 Nov; `design.md`, Between
  villages). VB-281's plan: VB-286 (walking hours between villages, a table a village a step), VB-287 (journeys: a mover walks,
  a leg a day), VB-288 (the round's pool within reach, nearer women preferred; after VB-277), VB-289 (the suitor's visit, waiting
  for Kim), VB-290 (claims, service and the tie read hours), VB-291 (kin help carried, waiting for Kim) and VB-292 (the player's
  visit, waiting for Kim). They run beside the slices, after VB-241, as VB-277 to VB-280 do; only VB-292 is slice 2's.
- The wrap-up (VB-078) waits for VB-099, VB-233 and VB-234 as well. The budget line stands: a skip changes nothing the simulation does.
- **Wrap-up (VB-078, 11 Nov):** a scripted player (`tests/lib/line.js`, `node tools/player.js`) played the founders scenario at seeds 7 and 42 for 75
  years: three and six pawns played, followed as heir, kin or a break; saved and loaded every 5 years it ends with the unbroken run's hashes; every job
  taken in a stepped window was taken by a work command; the budget table's line for the slice is 0 ms. Numbers are in `backlog/VB-078.md`.

### 3.3 The household's year

The riskiest change, because it rewires the core loop. It goes before the fair because every later slice stands on it: the fair is
an occasion (a plan), labour owed is the creditor's opportunity, and a mill is a project plan.

- **Brings:**
  - opportunities for every holder;
  - one standing plan per household that reproduces today's posting (golden unchanged);
  - tasks, the store that `st.jobs` becomes;
  - eligibility: members, servants, helpers by goodwill (the hired come in slice 5);
  - planning days, staggered and set by diligence;
  - seasonal and project plans;
  - the village's routines, set afresh by the meeting each year;
  - progress on resumable work kept by the field (VB-179);
  - attention: one partial and one background task;
  - fishing and gathering as opportunities: the lean year's answer in trace 7.2.
- **Takes over:** VB-179, VB-164 (its design pass), VB-023, VB-090, VB-106, VB-058, VB-120, VB-100, VB-123, VB-117, VB-118,
  VB-119, VB-136 (herding as background work), VB-162 (the holder's overview).
- **Design pass (done, VB-164, 10 November; `design.md`, section 7):**
  - a holder chooses in three layers: the culture's year as a template, foresight by the head's skill (a horizon and a persistent
    bias), and one project at a time by its values; never an optimiser. Traits are stand-ins until slice 7;
  - four bases of eligibility now (`member` with `servant`, `villager`, `helper`, `self`); `debtor` and `hired` with slice 5;
  - the meeting chooses at most four routines; when it does not decide, a practice says what follows, "nothing" by default;
  - no limit on idle hours (Kim, 10 November): possible work is added as design goes on, and tuned at a review Kim asks for;
  - the plan panel shows routines and targets, next steps, the project, reservations and who holds which task; the player as
    head makes every choice of the plan (parity of command, `design.md`, section 15).
- **Tasks, in order:** VB-258, VB-248, VB-249, VB-250, VB-251, VB-252, VB-023, VB-123, VB-253, VB-254, VB-255, VB-256, VB-257; then
  the tasks taken over, and the wrap-up VB-108.
- **Done when:** sowing and harvest on time and hungry household-days are at or better than today, at four seeds, for the worst
  household as well as the mean; the idle share by season is reported; the holder's plan can be read and changed in the page.
- **Cost risk:** opportunities are "computed, never stored". Computing them for every holder every hour would be the largest new
  cost in the game. They should be computed on a holder's planning day and on a change to its rights or stores. They are cached
  per holder by one writer, with a test that the cache equals a fresh computation. Budget line: under 10 ms a game day at the
  early reference.

**9 November update (Kim, the gameplay review).** A player who is head of a household directs it directly: it places the next field,
meadow or building to be made and sets the season's work, in place of the holder's rule and under the rules that bind any holder
(`design.md`, The player and what they see, As head of the household). The design pass (VB-164) adds: which of a holder's choices the
player may make, and what the household does where the player makes none.

### 3.4 The autumn fair

The cities review's phase 1, and the loans of its phase 2.

**Revised 10 November** (Kim, on `docs/review-markets.md`; `design.md`, sections 8, 9 and 11): the slice is built on a yearly gathering of
near and like-minded villages at a host village's centre, where customs are held together, marriages between villages are made and border
disputes resolved; the fair is held at it, as barter. It also brings two goods of place (dried fish, tar) made as side crafts, so that
villages differ, and ale. The gathering is after the harvest. Grain loans, and Obligations as a module, move to slice 5 (3.5). The list below stands
where it does not contradict this. The plan (VB-183) closed on 10 November; its tasks are VB-294 to VB-306, and the gathering is on winter days 1 to 3.

- **Brings:**
  - the goods registry for the goods the fair trades: grain, butter, salt meat, cheese, cattle, sheep, wool, labour days;
  - quanta and custody;
  - a venue (the fair meadow, a minimal facility);
  - the fair as an occasion with a draw in hours, from `Movement.reachFrom` on foot, computed yearly per village;
  - swap and loan;
  - the two valuations: need decides, customary worth books;
  - `Culture.norm`, with fixed rates first;
  - Obligations as a module, now that it has its second kind (grain loans after the heirs' shares);
  - encounters at the venue, so villages mix.
- **Takes over:** VB-126 (occasions), VB-140 (livestock in shares), VB-276 (marriage terms: a dowry and a morning gift, from VB-233),
  the probe of VB-130 (hoarding); the cities questions in `QUESTIONS.md`.
- **Design pass:**
  - goods and their quanta;
  - the worth table: a cow 40 rations, a sheep 6, a day's work 3, from the cities review;
  - each good's need curve;
  - who goes and with what;
  - how deals are found at the fair: agents in seeded order, each proposing to a few, so the cost is bounded;
  - loan terms;
  - what the player sees (booths, a fair report, a trade dialog).
- **Done when:** hungry household-days fall and spoilt grain falls; deals that failed for want of change are counted; marriages
  across villages are reported.

### 3.5 Debt and land

The alderman's road (target-v2 7.1), and the first test of whether bodies need a membership graph.

- **Brings:**
  - land rights with `own` and `use` split, `st.owner` as their cache, holdings that split, and tenancy with rent as an obligation;
  - Enforcement, with cases at the meeting;
  - Decisions as a module (procedures, sittings, escalation), absorbing the meeting;
  - class as a derived view with hysteresis (`landed`), acting through a priority contribution;
  - the membership graph, or not, decided by measurement (section 8).
- **Takes over:** VB-034 (splitting land is `LandRights.split`), VB-043 to VB-046 and VB-092 (scope and overlay, on membership
  edges), VB-175, VB-176, VB-180, VB-082 (ballots shown), VB-141 (grazing rights), VB-035.
- **Design pass:**
  - remedies and the custom "Debts are paid with";
  - tenancy terms (a quarter of the harvest and labour days);
  - interest;
  - procedures per culture;
  - class thresholds;
  - the office of alderman.
- **Done when:** the land Gini, the tenancy share and landed households per 1,000 are reported against a band, at four seeds.

**Design pass (written 11 November, VB-184; `design.md`, sections 5 (Households and other bodies), 6 (Land and rights), 9 (Loans,
obligations and cases) and 10 (slice 5's practices); all Proposed).** Written while Kim was away: where this section, target-v2 or an
archived answer pointed the way, the orchestrator decided in Kim's place, and those answers stand (Kim, 12 November;
`QUESTION_ARCHIVE.md`, "VB-184: debt and land", questions 1 to 6 and 8 to 10). In short:
- grain loans, moved here from slice 4 (Kim, 10 November), asked when help falls short, repaid at the next harvest with a quarter more
  under a new practice; defaulted after two harvests unpaid;
- Obligations as a module, its first kind the heirs' shares (moved in unchanged), then loans, rent, labour owed and wages;
- the creditor presses, extends or forgives; a case is heard at the debtor's village meeting by its practice (the meeting's voices or
  the alderman; the parties stand aside or vote); the remedy by "Debts are paid with" (labour; labour, then land, the default; land),
  a field of least worth a hearing when at least half a field's worth is owed, the debtor's household staying as tenant;
- tenancy: a quarter of the harvest and 2 days' labour, for the household while the owner agrees at each handover; a vacant tenancy is
  a home;
- the alderman, chosen at the meeting by a practice (elected or by turns), deciding ties and booking the village's gifts and loans to
  himself; class (tenant, cottager, peasant, landed) yearly with target-v2's hysteresis, landed lowering field work to 2 of 10 and adding
  0.2 prestige; hired hands at 3 rations a day; debtors' politics as the opposing loop.
- Bodies, by measurement (section 8): today's memberships as a graph build in 0.55 ms and derive the household cache in 0.33 ms at
  populous medium, year 12; adopting the graph is Kim's question 7, and only VB-043 and the scope views after it wait for it.
- **Tasks, in order:** VB-310 (Obligations, a refactor), VB-311 (land rights), VB-313 (Decisions, a refactor) side by side; VB-312
  (loans), VB-314 (the alderman); VB-315 (cases and labour, after slice 3's VB-250); VB-316 (foreclosure and rent); VB-317
  (tenancies over time), VB-318 (class), VB-320 (debtors' politics); VB-319 (hired hands, after VB-250); VB-321 (the page); VB-034
  (splitting between heirs, on VB-311); VB-045 (the overlay by chunk) and VB-082 (ballots, after VB-313); VB-043 and, after it,
  VB-044, VB-092 and VB-095, waiting for Kim; VB-141 (grazing rights, a plan); the wrap-up VB-035, which absorbs VB-046 (closed).
  VB-175 and VB-176 are done; VB-180 (the ownership wrap-up) runs apart, and slice 5's new owners (`sim/obligations`,
  `sim/decisions`, `sim/enforcement`, the land rights) join `src/owners.json` as they land.
- **Cost (claimed, `docs/cost.md`, section 1.2):** 4 ms a game day at `medium-ref`, a year's mean, and no 6-minute step over 60 ms.

### 3.6 The mill and the loom

- **Brings:**
  - facilities for buildings, with construction as recipes in stages;
  - production with subtype binding;
  - skills that grow by doing;
  - the textile chain: spinning as background work, weaving as partial work, cloth as a good that keeps;
  - tool wear;
  - quern against mill;
  - occupation as a derived view.
- **Takes over:** VB-009, VB-093, VB-121, VB-144 (wool), the steps of VB-123 not taken in slice 3; VB-048 (the food wrap-up) after it.
- **Design pass:**
  - recipes and their hours (acoup's textile figures were checked by search; others need sources);
  - skill curves;
  - who spins and weaves, as a practice;
  - what a mill costs and its toll.
- **Done when:** the idle share in the slack seasons has fallen and is reported (no limit is set: Kim, 10 November); mills are built where they pay; "the smith" emerges by
  hours worked.
- **16 November update (the plan of VB-702;** `design.md`, Goods, production and animals, The metals and the stones**):** the
  slice's second half also brings the island's own metals and the stones' other goods (Kim, 16 November, moving the decision of
  11 November that left the metals for the ship): goods carry the kind of their material, which sets their quality (design.md, "A good, its material and its kind");
  mining a found vein by hand, prospecting, the furnace; the copper kettle, bronze for the cast pot and the village's bell; silver,
  gold and amber as things of worth, and the hoard; whetstones and grindstones; soapstone pots, marble for lime, the memorial
  stone; tin twice as likely (VB-733 to VB-745). Coin and the church's uses stay with 3.8. Later the same day Kim moved two more
  points of 11 November: a maker's skill sets the quality of a made good as well as its speed, in five counted grades of
  workmanship (VB-761 to VB-763), and a millstone may be granite, a fifth slower (VB-093); and tin alone is raised, not copper.

### 3.7 Talk travels

- **Brings:** VB-127 first (ties from talk), the largest saving available today; then twelve traits and chemistry from them;
  encounters at venues (the alehouse, the service); stories, lies and counter-stories, after the experiment.
- **Takes over:** VB-127, VB-062, VB-063, VB-036 and VB-040 (courting), the gossip experiment (target-v2 10.2), which may run any
  time from slice 0 on as a reduced scenario.
- **Design pass:**
  - trait distributions and heritability;
  - the two rules each trait changes;
  - venue rules;
  - story kinds and their numbers, from the experiment.
- **Done when:** the bands of target-v2 10.2 hold. Talk must cost less at the end of this slice than at its start.
- **9 November update:** courting no longer replaces the round's matches; it feeds the negotiation between households (VB-233).
- **15 November update (the plan, VB-186;** `design.md`, People, Traits, talk and stories; Customs, A culture's values**):**
  - the saving first: the talk round by turns (four a pawn a day, not sixteen), with venues as kinds of one encounter table (VB-521);
  - traits (VB-519) and the two rules each changes, with chemistry and Like seeks like (VB-520);
  - the venues are the ale evening, a holder's open house on a barrel of its own, and the season's rite, which the Church's service
    takes over in slice 8 (VB-522); herders meet on the pasture, at calling distance;
  - stories (VB-523), then lies, counter-stories and what the player hears; courting (VB-036, rewritten) and births outside marriage;
    mood (VB-062, rewritten);
  - the wrap-up is VB-063, with VB-040's report merged into it: the bands of target-v2 10.2 measured on the game, trait drift, and
    talk's share at the slice's start (55.3 ms a game day at `medium-ref`, 10 November) and end.

### 3.8 The ship

- **Brings:**
  - the outside world as a scheduled actor;
  - a harbour (`moor`);
  - pawns abroad, at a coarse cadence;
  - silver by weight;
  - norms that learn from deals;
  - the Church and the Crown established by contact;
  - rank;
  - tithe and tax as obligations;
  - sickness brought by ships, the start of the disease gap (10.3).
- **Takes over:** the cities review's phases 3 and 5.
- **Design pass:**
  - voyages, goods and prices per decade;
  - immigrants;
  - the disease model: one compartment model per settlement, feeding a contribution to `death.hazard`, so the cost is per
    settlement, not per pair of pawns;
  - what establishment does.
- **16 November update (the plan of VB-702):** the island's own metals no longer wait for this slice (3.6). When the ship comes,
  silver and gold are already in households as things of worth, kept, given, worn and buried, and bronze is cast: "silver by
  weight" here becomes silver as a means of exchange, and coin when the Crown mints, first from the island's own silver. The slice
  keeps the church's uses (the bell, lead for roofs and windows, fonts and altars, soapstone carving, amber) and pewter's lead.
- **16 November update (the plan of VB-405;** `design.md`, People, Marriage, nursing and growth; Balance loops and targets, The
  growth budget**):** there is no immigration before the ship (Kim, 13 November), so the settling families are this slice's: VB-636
  holds the proposal (a family lands at the harbour and walks to a plot or an empty farm; one in 2 years while fewer than 300
  live, one in 10 after) for this slice's plan to confirm, and the ship's year decides when a founders' island passes 1,000
  (about year 230 to 300 by births alone). Disease is designed for the town only, against its line of the budget (0.28 of a
  point of yearly growth).
- **25 November update (Kim; `docs/plans/four-scales/aims.md`):** this slice no longer brings **personal goods**. A pawn's title to
  what it makes and earns in its own hours, a store of its own, its goods at death and at the fair, and the aims that use them (the
  farmer's second son who becomes a potter) are pulled forward into the arch `plans`; their tasks (VB-1781 to VB-1798) were set aside the same day in `docs/ideas/aims/` (Kim), so no arch builds them yet. This slice keeps silver
  and coin, personal debts, a pawn's things of worth and animals (with their way out), and norms that learn from a pawn's deals.

### 3.9 The town

**Rewritten 16 November** (the plan of VB-189, `docs/plans/VB-189.md`, on Kim's answers of that day; `design.md`, Settlements,
Towns and regions). The list this section held (settlement tier and regions by Harris potential, burgage plots, households that buy
their food, urban hazard, the pull at the moving round) no longer stands: a market place and a town are labels no rule reads,
nobody calls a market, and two mocks find that makers spread and do not gather, so **no town is expected before the ship**. Kim
accepted that. The slice is now what the island has before the ship: village craftsmen who still farm, and a yearly market at each
gathering's host.

- **Brings:**
  - the strata counted by work and by heads, and the sink's two bounds, as a report (VB-765);
  - crowding, a contribution to `death.hazard` by the people within 2 steps of a house (VB-766);
  - a head's memory of what each source of food brought, and fields sized against its estimate of all the household's food
    (VB-767, VB-768): this changes today's farms that fish or keep cows, and is measured for it;
  - dealing on the green on every gathering day, with goods carried there on the household's own estimate of that green (VB-769);
  - the walk to a named household to deal, on other days (VB-770);
  - rites on each village's own days, so that neighbours attend each other's (VB-775);
  - a place's label and its report: "market place" by the households of other villages dealing on its green; no cut point for
    "town" (VB-771);
  - a landless maker's ask for a plot where its custom is best, through the offers of the reworked moving round (VB-772);
  - the page (VB-773), and a test bed, the scenario "The market town", known to decay (VB-778).
- **Waits, with the town itself:** something that gathers makers. A third mock (VB-776) tries the first candidate, a shared
  facility that is costly to build (a kiln, a bloomery), and compares it with the other two: the elite's household as buyer and
  patron (slice 5) and outside demand with a granted market (slice 8, the ship). Service and lodging in a town, the standing
  alehouse, booths and "Marriage in town" wait with it.
- **Hands on:** to the ship's plan (VB-188), the granted market, outside demand, coin and the town's disease; to the plan of roads,
  boats and ice (VB-190), regions and market potential as reports that its changes of reach move (`docs/plans/VB-189.md`,
  section 9).
- **Order inside the slice:** VB-765, VB-766 and VB-767 wait for nothing, and VB-768 only for VB-767; the dealing tasks wait for
  the fair (VB-302), offers (VB-690), targets (VB-698) and the rite (VB-522); the maker's plot waits for VB-682's tasks (VB-692,
  VB-697) and for skills (VB-360).
- **Done when:** the 600 / 325 / 75 target (target-v2 6.3) is reported nightly on the work line and the heads line, with its
  residual, never failing; every place's measures (outsiders, dealing days, work that is not farming) and its sink, `M / (d - b)`
  and `S / c`, are reported by decade. The target is not expected to be met before the ship (the second mock reads 263 to 275 on
  the middle figure), and only Kim changes it.
- **Takes over:** what is left of the cities review's phase 4 once the labels are views: its crowding and its sink.
- **13 November, kept (the plan of VB-405):** the town is the second brake of the growth budget, not the first: its deaths at
  about 1.5 times the farms' (Kim, 13 November; at 3.3 times life expectancy falls to 23), its line 0.54 of a point of yearly
  growth. It takes its people from those the marriage gate already holds, so it decides where people live and the valve still
  holds the number (`design.md`, Balance loops and targets, The growth budget). With no town before the ship, the valve carries
  that line until then.

### 3.10 Roads, boats and ice

- **Brings:** modes and vehicles, climate by latitude, ice, built ways as facilities, passage rights, desire lines and upkeep.
- **Takes over:** VB-115 (bridges), VB-083 (seasons on the map), VB-097 (routes over regions, if the fixture shows they are needed).
- **Design pass:**
  - freeze and thaw dates by latitude, a few a winter, so the cost grid changes a few times a year and not daily;
  - capacities of cart, sledge and boat;
  - what a cart needs underfoot;
  - upkeep duty.
- **16 November update (the plan of VB-190;** `docs/plans/VB-190.md`; `design.md`, Climate and travel beyond walking**):** the
  slice is planned, unattended, on proposed answers that Kim may strike. A world has a latitude chosen at generation (the
  references stay on the middle world) and three bands a map; a winter has at most six dates a band, taken from a due-queue. A
  boat lies where it was left, so a journey by water is a walk, a leg by water and a walk, and no search mixes modes; a table
  of hours is what people know of a normal season. Carts need a way, sledges need snow. Built ways (track, causeway, bridge)
  are facilities built only along worn ways, by the alderman's reckoning put to the meeting, kept by a custom. Tasks: VB-807 to
  VB-818, with VB-083 and VB-115 rewritten, VB-721 confirmed, VB-097 left to the wrap-up's measure and VB-722 closed. The slice
  claims 4 ms a game day at `medium-ref` on the middle world. Measured at year 0 on four medium islands: boats and ice widen
  the 12-hour circle (35 to 61 pairs of villages on foot, 42 to 109 by boat, 63 to 101 over sound ice) and leave the 3-hour one
  where it was, so nothing here gathers a town.

## 4. The order, and why

0, then 1 and 2 side by side, then 3, 4, 5, 6, 7, 8, 9 and 10 in turn. Slice 7 can move, and its experiment runs from slice 0 on.

1. **Slice 0 first.** It is cheap, everything later is measured by it, and the measurements change designs. The cache of slice 3's
   opportunities and the disease model of slice 8 are both shaped by cost.
2. **Slices 1 and 2 in parallel.** They touch different files: food and relations against commands, agents and the page. Between
   them they test the pieces every later slice uses: the registry, stores, goodwill and exchange; opportunities and the player.
3. **Slice 3 before the fair:** see 3.3. A fair built on posted jobs would be built twice.
4. **Fair, then debt and land, then the mill:** the cities review's order. Rights matter once there is debt (the first tenancy), and
   a mill on village land needs a `develop` grant.
5. **Slice 7 is the movable one.** It depends only on venues. If the budget binds sooner, VB-127 moves up into slice 0's
   neighbourhood.
6. **The ship before the town:** imports feed the first specialists, silver arrives with ships, and disease comes first by sea.
   Roads come last, since the winter fair (trace 7.3) needs everything else. **Changed, 16 November** (Kim): the ship is taken
   last of all, after the town and the roads. The town's plan (3.9) then found what this point had guessed: without the ship's
   imports and demand no town forms. So slice 9 builds the craftsmen and the markets the island has before the ship, slice 10
   widens their reach, and the town proper arrives with slice 8, unless the third mock (VB-776) or slice 5's elite gathers
   makers sooner.

**Alternatives weighed.**
- *The fair first*, for the most new play soonest. It builds exchange on posted jobs, so its occasion and its loans' labour are
  built twice.
- *The player last*, to watch the world first. Against the adopted vision; the player's doors are cheapest to fit before the
  interfaces set.
- *Boats with the fair*, since an archipelago's fair should draw across water. This is reasonable if the fair islands of the
  reference seeds are too small; slice 4's plan should measure it.

**Beside the slices:** small tasks that touch nothing above may run at any time: VB-159, VB-160 (since 10 November a survey of what raised yields), VB-084 (speeds), VB-091 (VB-165 was closed on 10 November).
They run as long as they do not edit the files of the slice in progress.
Five archs also run beside the slices, each opened by Kim: `between` (11 November), `far` (15 November), `physical` (14 November),
`acts` (16 November) and, since 25 November, `plans` (plans at four scales and the levy: `docs/plans/four-scales/README.md`, its path
in section 3.10; tasks VB-1743 to VB-1780; step 9 of the path, aims and personal goods, is the arch's own since 25 November,
`docs/plans/four-scales/aims.md`; its tasks set aside in `docs/ideas/aims/`).

**Size and pace.** The plan of 3 November guessed 60 to 70 tasks at one a night. The real numbers, and the estimate of when
the rest is done, are in `docs/roadmap.html` (`tools/roadmap.js`).

## 5. `design.md` v0.4, and the backlog

**`design.md`.** v0.3 says each version is its own document, left unchanged once a newer one exists.
- **Decided (Kim, 3 Nov):** keep v0.3 as `docs/design-v0.3.md`, unchanged. `design.md` becomes v0.4, written in two kinds of pass.
- **The skeleton pass (one task, VB-191; done 3 November):**
  - the vision and the scale of society, from `docs/review-architecture.md` section 3, once Kim approves it;
  - the new section list;
  - every v0.3 point carried over with its status;
  - each point target-v2 11.1 changes marked "Under revision (slice N)", so implementing tasks stop building against it;
  - implementation detail moved out to target-v2.
- **Then each slice's plan task** writes its own sections, as the concrete design of that slice.

Proposed sections of v0.4, ordered as the player meets the world:
1. Vision and scope
2. World, climate and travel
3. Time
4. People: persons, traits, skills, health
5. Households and other bodies
6. Land and rights
7. Work: opportunities, plans, tasks
8. Goods, production and facilities
9. Exchange, goodwill and obligations
10. Customs and culture
11. Settlements, towns and regions
12. Institutions and the world beyond
13. Balance loops and targets
14. The player and what they see
15. Open questions
16. Change log

**The backlog** (done 3 November). Each slice is an arch: `yardstick`, `kin-help`, `life`, `year`, `fair`, `debt`, `mill`, `talk`,
`ship`, `town`, `roads`. Its plan task is VB-181, VB-182, VB-079, VB-164, VB-183 to VB-186, VB-188 to VB-190 in turn; the gossip
experiment is VB-187 and the skeleton of `design.md` v0.4 is VB-191. The tasks of the earlier archs moved to the slices as section 3
lists. Those of slices 3 to 10 are `blocked` until their slice's plan confirms, rewrites or closes them, so Kim need not answer their
old questions now. Two earlier archs stay open beside the slices:
- `ownership`: VB-173 to VB-180 run in their order (target-v2, section 11.2, found that they fit it unchanged); VB-174 and VB-178 go
  first, since slice 1 builds on them;
- `animals`: VB-159, VB-160, VB-139, VB-091, and the wrap-up VB-048 after slice 6.

VB-127 (ties from talk) stays `ready` ahead of its slice, since the budget already binds (`docs/cost.md`, section 1.1).

## 6. Questions for Kim

Raised in `QUESTIONS.md`, Priority 1, with these proposals.

1. **The slices and their order** (sections 3 and 4). **P:** as proposed, with slices 1 and 2 in parallel. **Decided (Kim, 3 Nov):** P.
2. **The late game's size.** `design.md` says "up to about 1,000 pawns simulated in full" (Decided). Populous medium starts at 807
   and grows about 2% a year (small grew 1.8% a year over 40 years), so it passes 1,000 by about year 12 unless a loop holds it.
   Is 1,000 living the target for medium, or a band for the late game, with large maps allowed more? **P:** about 1,000 living on
   medium is the budget's reference; large may reach 2,000 at half the speed. **Decided (Kim, 3 Nov):** P.
3. **The budget** (`docs/cost.md`, section 1.2). **P:** as proposed: 160 ms a game day at the late reference, steps under 50 ms, cost per living pawn
   flat in history, save under 0.5 s. **Decided (Kim, 3 Nov):** P.
4. **`design.md` v0.4** (section 5). **P:** keep v0.3 as `docs/design-v0.3.md`; a skeleton pass now; each slice's plan writes its
   own sections. **Decided (Kim, 3 Nov):** P.
5. **Counters in `VB.count`** (`docs/cost.md`, section 2). **P:** yes, with one lint allowance; counters never feed the simulation. **Decided (Kim, 3 Nov):** P.
6. **The ten rules** (`docs/cost.md`, section 1.3) into `AGENTS.md`'s working rules. **P:** yes, once Kim agrees with them. **Decided (Kim, 3 Nov):** P.

All six were answered on 3 November (`QUESTION_ARCHIVE.md`).
