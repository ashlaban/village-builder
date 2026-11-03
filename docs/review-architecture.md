# Architecture review, 3 November 2026

**Superseded as the target** by `docs/architecture/target-v2.md` (3 November 2026), which grew from this review in 17 batches with Kim and
is now the architecture reference; the order of work is `docs/roadmap.md`. This file stays as the record of the first response to the
external proposal: what the code met, Kim's adoption of the vision (section 3), and where each point went. Its proposed text for
`design.md` (section 3) still waits for Kim's approval in `QUESTIONS.md`.

A second review by another assistant (ChatGPT), from a session with Kim, passed on on 3 November 2026 and read here at `4ef37fa` (after VB-171).
Unlike the first (`docs/review-external.md`) it does not review the repository: it describes a target architecture for the game Kim wants, written
without reference to the code (it names no file, module or task). It came as three documents, kept verbatim in `docs/architecture/`:

| File | What it is |
| --- | --- |
| `target-architecture.md` | The vision; ten conceptual domains (Society, Households, Settlements, Land, Ecology, Production, Resources, Institutions, Exchange, the regional and outside world); cross-domain processes; infrastructure; venues; the player; 15 rules |
| `prompt.md` | Instructions to Claude Code: assess first (subsystem inventory, ownership map, dependency map, workflow traces, gap analysis), then refactor in six stages, with ten deliverables |
| `stress-tests.md` | 14 principles, questions for every interface, the multi-membership pawn test, economic, social, player and change-impact scenarios, a list of violations, a layered test strategy, and questions for every architectural change |

ChatGPT's advice on using them: give all three to Claude, ask for the assessment only, and have Kim review the ownership map and the dependency
graph before authorising the first refactor; and pay particular attention to the multi-membership pawn test, since "a person can participate in
several overlapping social, economic and political structures without any one of them owning their entire existence".

**Kim's decisions of 3 November:** keep the three documents in the repository; **adopt the review's vision** (the player inhabits a pawn and lives a
life the game does not prescribe, in a society that grows to towns, institutions and a wider world), with the change to `design.md` proposed in
section 3 for Kim's approval; this first batch writes this report, the task files and the questions, and no code.

## 1. The code against the review

Read from the source at `4ef37fa`. The counts are of assignment sites found with `grep`, a lower bound until VB-172 maps every field.

### Already met

| Review | In the code |
| --- | --- |
| Deterministic simulation (Rule 9; Principle 12; stress tests, section 11) | One seeded stream per system (VB-072); the lint bans `Math.random`, `Date` and `performance.now` in the modules; a loaded run matches the unbroken one (`tests/saves.js`) |
| The simulation runs without the UI (Rule 14) | The modules load in Node (`src/load.js`); `tools/sim.js` and every test run without the page; the page writes `st` only through the `Sim` API and three flags, which the lint enforces |
| Commands may fail; events are facts (section 7; Rules 10 and 13) | `issue(st, {actor, verb, target, args, source})` checks a verb and returns why not (VB-167 to VB-171); `st.record` keeps typed events, not every change (VB-075) |
| Persistence keeps references across domains (section 7) | The save codec keeps shared objects, Maps, Sets and typed arrays; `st` is plain data (VB-073, VB-074) |
| The player acts through the same rules (Principle 10) | Decided in `design.md` (Commands): the player is one more source of commands; VB-169 builds it |
| The work coordinator owns no production rule (section 4.3) | A job kind is one record in `KINDS` (`src/sim/kinds.js`) with its own finishing and delivering; matching (`src/sim/jobs.js`) ranks and assigns only. A new kind needs no change to the matcher |
| No event bus, no central manager (prompt, section 9) | There is none. `sim/clock` runs the systems in a fixed daily order and holds no rules of its own |
| Do not over-decompose; complexity is earned (Rule 12; Principle 14) | The refactor rules in `BACKLOG.md`, and the working rules of `CLAUDE.md`: a general rule at the third special case, a refactor says what fell |
| Questions for every change (stress tests, section 15) | Largely the impact note of `CLAUDE.md`: the modules and state a change reads and writes, new coupling, why an existing abstraction does not fit |

### Partly met: one owner per piece of state (Rules 1 and 3)

| State | Modules that write it | Note |
| --- | --- | --- |
| Tile owners (`st.owner`) | 1: `sim/ownership` | What the review asks for |
| Household membership (`pawn.household`, `hh.members`) | 5: `sim/records` (`joinHousehold`, a new household), `sim/heirs` (`moveTo`, a household dissolved), `sim/births` (`births.js:27`), `sim/cottage` (`cottage.js:45`), `sim/lifecycle` (a death, `lifecycle.js:36`) | Helpers exist; births and the cottage write past them |
| Household food (`hh.grain`, `hh.larder`) | 9, about 20 sites: `sim/hunger` (meals, spoiling), `sim/kinds` (sowing, cooking, threshing), `sim/help` (gifts, the village store), `sim/heirs` (shares, handing on), `sim/cottage` (owed shares), `sim/farmclaims`, `sim/settle` (provisions), `sim/scenarios`, `sim/byre` (the larder) | `hh.ledger` records harvests, gifts and food from animals; seed, meals, shares, spoilage and handing on leave no trace but the total |
| The schema | 68 `@state` lines, most in `sim/scenarios`, where the state is made | They document the fields and name no owner |

Land meets the rule, membership half meets it, and food does not. Food also has the most readers to come: `tools/balance.js`, the store views
(VB-092), and the fair, loans, tithe and tax of the cities review (`docs/review-cities.md`).

### Dependencies

Modules import each other at their top, in the order of `src/manifest.json`, so no cycle can form while they load. Two lookups inside functions get
round the order: `farmclaims.js:181` calls `sim/heirs`, which imports `sim/farmclaims` at its top, so the two depend on each other; and
`expansion.js:172` calls `sim/cottage`, which loads after it. These are the circular dependencies the review asks to name; VB-172 lists them all.

### Not met, and not needed yet

- **One membership of each kind.** A pawn has one household, a household one farm, a farm one village. A tile is owned by a household or a village,
  never a pawn (`st.owner`). There is no employer, institution, tenancy or market, so the multi-membership pawn test fails on almost every line, as
  it must while those things do not exist.
- **Obligations.** The heirs' shares are one in all but name: `p.owed` and `p.stake` are set at a handover (`heirs.js:113`) and paid down at the
  moving round (`payOwed`, `cottage.js:62`), with no record of basis, due date or status.
- **Plans.** Households answer the jobs of the moment; nothing holds an intention over days or seasons (VB-164).
- **Knowledge.** Everything is known to all; for fathers this is Decided (30 October).

## 2. Where the review fits this codebase, and where it does not

1. **Reads stay free; writes go through the owner.** The review asks that no subsystem expose its mutable collections (Rule 2; prompt, section 5).
   Here `st` is plain data on purpose: saves depend on it (VB-073), the page reads it every frame for up to 1,000 pawns, and the tests read it
   directly. Getters that return copies would cost speed and duplicate the schema. What matters in the rule, no hidden mutation across systems
   (Rule 3), costs much less: every field has an owner module, only the owner writes it, others call the owner's operations, and a static check
   enforces it as `tests/commands.js` does for the command verbs (VB-173). Proposed as this codebase's form of Rules 1 to 3 (`QUESTIONS.md`).
2. **The ten domains are vocabulary, not modules.** The review says so itself (Rule 12). Where they live today, a first sketch for VB-172 to correct:

   | Domain | Modules today |
   | --- | --- |
   | Society | `sim/records`, `sim/births`, `sim/deaths`, `sim/relations`, `sim/society`; per-person attitudes in `culture` |
   | Households | `sim/heirs`, `sim/service`, `sim/cottage`; the moving round in `sim/lifecycle` |
   | Settlements | `sim/territory`, `sim/names`; the meetings in `sim/lifecycle`; practice in `culture` |
   | Land | `sim/ownership`, `sim/claims`, `sim/stakes`, `sim/farmclaims`, `sim/territory` |
   | Ecology | `sim/forest`, `sim/paths`; soil in `sim/fields`; rivers in `gen/rivers` |
   | Production | `sim/kinds`, `sim/fields`, `sim/meadows`, `sim/herds`, `sim/byre`, `sim/expansion` |
   | Resources | None: household and village food is written where it is used |
   | Institutions | The village meeting and its customs (`sim/lifecycle`, `culture`); nothing else |
   | Exchange | Gifts (`sim/help`); nothing else |
   | Regional and outside world | Moving to new land (`sim/settle`); nothing beyond the archipelago |
   | Processes | Job matching (`sim/jobs`), acting (`sim/agents`, `sim/commands`), the moving round (`sim/lifecycle`) |
   | Infrastructure | `sim/rng`, `sim/clock`, `sim/routes`, `sim/hex`, `sim/saves`, the record (`sim/records`), the page (`src/page/*`) |

   Resources is the one domain that has state and no home.
3. **The work model already has the review's split, except plans.** Opportunity: `refreshJobs` posts jobs. Coordination: matching ranks and
   assigns, and commands carry it out. Execution: each kind's record. The missing layer is the plan held over time, which is the foresight arch
   (VB-164); the review's Change A ("replace village-posted jobs with household planning") is that arch, and its barn (stress tests, Test C) is a
   good acceptance scenario for it. One gap: a kind's execution writes household grain itself (`kinds.js:54` sowing, `:110` cooking, `:119`
   threshing), so Production writes Resources directly.
4. **Obligations wait for their second kind.** The shares are the first. Tithe, tax, rent and grain loans (cities review, phases 2 and 5) bring more;
   with the second, an obligation record (debtor, beneficiary, basis, amount, due, status, paid through the owner of food) has earned its place,
   by the `CLAUDE.md` rule on special cases. Not now.
5. **Rights and ownership are half separate.** The claims arch keeps owner, claim and stake apart, and VB-043's scope has the dimensions owns,
   claims, uses, works and is kin of. Missing: use by someone who is not the owner (tenancy, cities phase 2), and land held by a pawn.
6. **Multi-membership belongs in VB-043.** Its draft links pawn to household to village to culture as a chain. If links are typed edges a pawn may
   have several of, a later employer, guild or parish is a new kind of edge, not a redesign. Note added to VB-043.
7. **The player.** VB-169 marks a controlled pawn with `a.controller`, and nothing else in the pawn depends on it, as the review's Test E asks. The
   vision changes which pawn the player holds and what follows its death (section 3), not the mechanism.
8. **The review's stages are the backlog's phases.** Stages 1 and 2 (document, find the boundaries) are a plan task (VB-172); stages 3 to 5 its
   implement tasks, as refactors under the refactor rules, one boundary at a time; stage 6 the wrap-up, which reviews the stress tests against
   the code.

**Not taken:** an interface catalogue for every subsystem up front (prompt, deliverable 4); only the boundaries Kim chooses from the map get one.
Workflow diagrams as drawings: traces as tables, one row per state change with its file and line, and a diagram only where it helps. All ten
deliverables in one run: the plan, Kim's review, then one boundary per task.

## 3. The vision, adopted (Kim, 3 November)

| Aspect | `design.md` v0.3 | The review's vision |
| --- | --- | --- |
| Player role | Follows a family line through its head (Decided, 30 October); the score is the line's prestige; the run ends when no relative is left | Inhabits one pawn of any station and lives a life the game does not prescribe; sets its own challenges |
| Scale of society | Nordic peasant villages whose customs drift; towns, markets and money "Later" | The pawn, the household, the settlement (village to town), the region and the world beyond; institutions, markets, venues |
| The world beyond | Very limited immigration by boat, later (Decided) | Abstract until its people arrive: ships, merchants, pilgrims, officials, migrants, news |
| Knowledge | All known to all, fathers included (Decided, 30 October) | Knowledge has a source and travels |
| Unchanged | Setting, look, pace (40–80 hours), about 1,000 pawns simulated in full, customs, the systems built so far | |

The cities review (`docs/review-cities.md`) is already the road from the villages to this society: the fair (exchange), credit and tenancy
(obligations, use rights, the master household), ships (the outside world), the Church and the Crown (institutions, tithe and tax). Its nine
questions are open in `QUESTIONS.md`; with the vision adopted they are the next design decisions on that road.

**Proposed text for `design.md`.** Kim approves it in `QUESTIONS.md`; a design pass then writes it, since implementing tasks do not change
`design.md`.

Vision and scope, the Player role row, replacing the Decided text of 30 October:

> The player inhabits one pawn as its source of commands (Commands, direct control) and lives a life the game does not prescribe: works and
> marries, inherits or leaves, takes service, clears land, argues at the meeting with the pawn's prestige, and later learns a craft, trades at the
> fair, joins the Church or moves to a town. The pawn keeps its needs and the rules every pawn has, and the world goes on without the player. When
> the pawn dies, the player goes on with another: by default the heir or another relative (the family line), or someone of its household or close
> ties. There is no fixed score: the player picks ambitions (hold three farms, change a custom, found a village, become a master household, leave
> service and hold land), and the chronicle shows their progress; the line's prestige over time is one of them. The player should be able to
> influence the world a lot, through all the systems.

Vision and scope, a new row "Scale of society":

> A society at five scales: the pawn, the household, the settlement (village, market place, town), the region of the archipelago, and the world
> beyond it, which stays abstract (ships, the Church, the Crown, migrants, news) until its people arrive and become pawns. Towns, institutions and
> markets grow out of the villages along the phases of the cities review. Up to about 1,000 pawns are simulated in full.

Open questions, a new item:

> What a pawn knows: today everything is known to all. Knowledge with a source (news, rumour, prices heard at a fair) where it changes a choice.

In the backlog, VB-079 (plan: the player's role) goes back to `needs-review`, since its answer of 30 October is reopened. VB-169 (take control) is
the first step of either role and is unaffected.

## 4. Where each point goes

### Already in the backlog

| Point | Task |
| --- | --- |
| Plans apart from jobs; a household plans a barn while its members farm (section 4.2; Rule 5; Test C; Change A) | VB-164 (foresight plan); note added |
| A pawn with several memberships (Rule 7; the multi-membership test) | VB-043 (the membership graph); note added |
| The player as a source of commands, and release (Principle 10; Test E of section 8) | VB-169 |
| Construction as fetch, carry and build (Test C) | VB-123 (a job as a few steps) |
| Gatherings that bring villages together (venues, section 5) | VB-126 (occasions); the fair, cities review phase 1 |
| Store views by scope | VB-092 |
| Long simulation scenarios as tests (layer 5) | VB-163 |
| The player's role | VB-079, back to `needs-review` |

### New

| Point | Now |
| --- | --- |
| The assessment: ownership map, dependency graph, workflow traces, gap table (prompt, section 2; stages 1 and 2) | VB-172, plan task of a new arch `ownership` |
| Only the owner writes a field: a static check (Rules 1 and 3; layer 6) | VB-173, `blocked` on VB-172 and Kim's review of its map |
| The vision in `design.md` | Proposed text in section 3; questions in `QUESTIONS.md` |
| Reads free, writes through the owner | A question in `QUESTIONS.md`; the rule goes into `CLAUDE.md` once VB-172 has named the owners |
| `docs/architecture/` as a reference for agents | A line in `CLAUDE.md` that names it as a proposal and points here |

### Kept for later, no task

| Point | When |
| --- | --- |
| Obligations as records (section 3.8; Tests A and B of section 5) | With the second kind of obligation (tithe, tax, rent or loans), in the towns arch |
| Exchange, markets and businesses; professions from skills and workplaces, not pawn types (sections 3.6 and 3.9; Rule 11; Tests D and E; section 6) | The towns arch (cities review, phases 1 and 3) |
| Institutions: the Church, the Crown, guilds (section 3.8; Test C of section 7) | Cities review, phase 5 |
| Venues as place, operator and activity (section 5) | With occasions (VB-126) and the fair |
| The outside world (section 3.10; Test C of section 6) | Cities review, phase 3 (ships) and its question 8 |
| Knowledge with a source (Rule 8; section 10) | An Open question in `design.md` (proposed) |
| The scenarios of sections 4 to 10 of the stress tests | The `ownership` arch's wrap-up reviews them against the code; each becomes an integration test when its systems exist |

### Not taken

- **Getters that return copies, and hidden collections.** Replaced by owner-only writes (section 2, point 1).
- **A module per domain.** The review agrees (Rule 12).
- **The whole programme in one run.** Replaced by the plan, Kim's review of the map, and one boundary per refactor task.
