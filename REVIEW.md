# Review, 30 October 2026

*Later reviews: animals and husbandry (`docs/review-animals.md`, 31 October); relationships (`docs/review-relationships.md`, 31 October); performance, the food balance and the animals' economics against history (`docs/review-balance.md`, 1 November), which answers points 1 (in part) and 2 of the summary below.*

A review of the game as built at `6b9149b` (after VB-049) against `design.md` v0.3: whether the stated design is implemented, what is broken or costly, and what would make development cheaper and safer. The design-level reflection (which systems the game needs, and whether they are fun, realistic and affordable) is in `design.md`, "Systems overview". Questions for Kim are in `QUESTIONS.md` under "Review, 30 October 2026"; new and changed tasks are in `BACKLOG.md`.

An addendum of the same day reviews the work and jobs system at `6e5e39b`, against the colony-sim genre: see "Work and jobs" below. A second pass the same day, at `243d9dd`, measures the job system again, profiles it, compares its design with the genre's and proposes new concrete jobs: see "Work and jobs, second pass". A review of 31 October, also at `243d9dd`, follows the paths, fords and village layout work: see "Review, 31 October 2026" at the end.

Numbers below come from `npm run verify --verbose` and from short scripts run on the Node loader, populous medium at seed 7 unless stated.

## Summary

1. **The population does not grow.** Ten founders become 14, 18, 13, 15 and 13 people at the end of each of five decades (seed 7; seed 42: 17, 21, 21, 17, 16). The design wants close to 3% a year. Marriage needs a farm, nobody can get a new one, and the landless never marry. The expansion arch (VB-010, VB-033, VB-031, VB-032) is the release valve; it is now first in the backlog.
2. **A grown family cannot feed itself.** A household of 6 eats about 190–290 rations a year, depending on how many children are over 14. Three meadow fields give about 3 × (80 × 0.97 − 20) ≈ 170 after seed, and four fields about 230. In the populous scenario a quarter of household-days in year 2 are hungry, and 9 people die of hunger in 4 years. The design leaves this to the animals wrap-up (VB-048), which is the last task of an arch that has not started.
3. **Two Decided foundations are missing: commands and save games.** Pawns start jobs directly (`start` in `src/sim/agents.js`), not through commands. Nothing can save a run, although a run is meant to last 40–80 hours. The state holds closures, so it cannot be written out as it stands.
4. **The simulation is fast enough in steady state but stalls once a year.** About 200 ms of simulation per game day at 818 pawns, so even 10× uses about 4% of a core. The meetings and the moving round freeze the page for 1.6 s and 2.6 s, which VB-052 addresses.
5. **Debugging leans on hashes and print-outs.** The golden test says which top-level key changed, not what changed. One random stream feeds every system, so a change to job matching also changes who dies. There is no way to run, query or dump a state from the command line. These are cheap to fix and make each later task cheaper.
6. **Pawns stand idle while work waits (addendum).** Farmers have no job for 35% of spring work hours and 83% of summer ones; children for all of them. One pawn per job, household-only jobs and a bid that can fall below zero leave work undone while hands are free. The new `work` arch (VB-101 to VB-108) addresses it.
7. **Starvation kills half the populous scenario in year 2 (addendum).** Since health (VB-050), the lean summer of year 2 is lethal: 427 of 820 people starve at seed 7, 321 of 851 at seed 42, and 8 of 11 founders at seed 7. The food balance (VB-080) is now urgent.

## Measurements

| Measure | Value |
| --- | --- |
| Populous medium, seed 7 | 818 pawns, 132 households, 25 villages; seeding 1.9 s |
| Simulation cost | about 190–220 ms per game day once warm, about 9 s per game year (Node) |
| Job matching | one full sweep of 818 idle pawns × 660 open jobs is 127,000 bids, 10 ms; it runs on every 6-minute step with idle pawns |
| Daily life step (ties and attitude drift) | 19 ms |
| Moving round, meetings | 2.6 s and 1.6 s (VB-052) |
| Page build in the jsdom smoke test | 6.1 s for a medium map |
| Founders, 50 years | births per decade 7, 6, 0, 6, 2 (seed 7); 10, 7, 1, 4, 5 (seed 42) |
| Populous, years 1–4 | marriages 0, 0, 0, 3; hungry household-days 468, 1,611, 595, 424 of 6,336; hunger deaths 0, 5, 3, 1 |
| Firewood walks | 1–7 steps from house to woodlot (at most 2.3 hours one way); in populous up to 15 farms share one commons-wood tile |

The populous scenario has no marriages for three years because no child is an adult at the start. Children are spaced two years apart from age 0–2, so the eldest is at most 14 (`src/sim/people.js:35`), and servants have no place to marry into.

## Design against code

Status: **done** means it is built as designed, **partly** means some of it is built, **differs** means it is built another way, **missing** means it is not built and has no task, and **task** means it is not built and a backlog task covers it.

| Design point | Status | Notes |
| --- | --- | --- |
| Map sizes, generation screen, seeded world | done | VB-021 |
| Regions used for overview, territory, off-screen simulation, HPA\* | partly | Drawn as borders only. The simulation never reads regions; routes are plain BFS up to 60 steps, cached per pair of tiles |
| Calendar, 6-minute step, 5-minute clock | done | `advance` steps 0.1 h; VB-002 |
| Founders: houses standing, next to no fields | task | VB-010; founders still start with 3 fields per farm |
| Heirs scenario | done | Its code names people (Olof, Erik, Ingrid) and the game gives them other, generated names, so the code, the tests and `QUESTIONS.md` call one person by two names |
| Populous scenario | done | No adult children at the start (see above) |
| Person and union records, life events | done | |
| Kinship by civil degree, four options | task | VB-029. Today `kinOk` compares Malécot's coefficient with 1/64, 1/16 and 1/8, and there are three options |
| Roles by household position | done | |
| Gompertz–Makeham mortality, births with pregnancy and nursing | done | VB-027 |
| Births outside marriage, courting | task | Social and courting archs |
| Hunger: kills, slows work, postpones marriage and births | done | VB-028; health is VB-050 |
| Jobs owned by household or village; matching best fit first; poor fit waits 2 h | done | One pawn per job; many posted jobs never get a bid (see Work and jobs) |
| Daily rhythm: work 7:00–17:00, indoors at night | done | Kim, 30 Oct: work 6:00–18:00 and a dark of 4–8 hours by season (main's design, kept when merging); VB-105 |
| Long work: tilling, threshing, weeding | done | VB-007, VB-008 |
| Cooking makes food | task | The cook job only marks the day; VB-022 |
| Milling | task | VB-009, after VB-022 |
| Firewood: winter about 4× summer | differs | `woodUse` gives winter 1.6 against summer 0.3, 5.3× (`src/sim/rules.js:18`) |
| Soil wear and manure | task | Animals arch (VB-047, VB-048) |
| Weather factor and frost | done | |
| Yield rising over a game | missing | Open in the design; VB-048 |
| Trees per tile, regrowth, stones | done | VB-005, VB-006 |
| Forest spread into meadow and fields | missing | Decided; no task |
| Empty farms: fields to meadow, then to scrub near woodland | differs | Every empty farm's fields go to scrub after 8 years, near woodland or not (`src/sim/clock.js:61`) |
| Fences wear and are mended | done | A broken fence costs nothing until animals exist |
| Every farm in a village; ownership per tile | done | VB-003 |
| Claims, overlay, scope model | task | Claims arch |
| Village green and well as village work | task | VB-058 (blocked) |
| Succession order, own-farm rule, minor heir and guardian | partly | A guardian is chosen (`src/sim/heirs.js:140`) but never read, never cleared at 18 and not in the `@state` schema |
| Shares, reserve, owed | partly | Paid and recorded; never used (VB-032 uses them) |
| Claims on empty farms, clearing plots, splitting land | task | Expansion arch |
| Customs: every system reads customs | partly | `claims` and `newLand` have no effect yet; `split` acts as a buy-out |
| Attitude drift, meetings, reckoning, fission | done | Calibrated (`tests/calibrate.js`) |
| Unified commands; direct control; meetings and herds as commands | missing | Decided. No command layer: planning and acting are one step in `planRound` and `start` |
| Store views and family tree for every level of entity | partly | The family tree exists; store views wait on the scope model (VB-043) |
| Family tree kept fast | partly | `layoutTree` lays out every pawn ever born on each open |
| Signs of life (woodpile, smoke, stooks) | done | |
| Animation list | done | Except herding, milking and haymaking, which wait on animals |
| Save and load | missing | Not in the design either |

## Defects

| Where | What goes wrong | Size |
| --- | --- | --- |
| `src/sim/agents.js:24` | The route cache key `from * 100000 + to` collides once a map has more than 100,000 tiles. The Large map has 102,600, so two different routes can share a key and a pawn walks the wrong path | S |
| `src/sim/heirs.js:114` | When a farm dies out, a member with no kin nearby moves into the smallest household on the whole map, possibly on another island; the comment and the design say "elsewhere in the village" | S |
| `src/sim/heirs.js:140` | `hh.guardian` is written and never read or cleared | S |
| `src/sim/agents.js:26` | A route longer than 60 steps falls back to a straight walk to the target, across water if need be. No current job is that far, but VB-031 sites, claims across a village and later trips can be | S |
| `src/sim/clock.js:61` | Scrub regardless of woodland (above) | S |
| `src/sim/agents.js:130` | `j.kind === 'logs'` is never true (the kind is `wood`); harmless, since `K.carry === 'logs'` catches it | S |
| `src/sim/hunger.js:41`, `src/sim/deaths.js` | Addendum: since VB-050 a pawn dies when health reaches 0, and the lean summer of year 2 drains it to 0 for about half of all pawns (populous seed 7: 427 of 820 starve, all in summer and autumn days 0–4, in households with no grain left, before the harvest; seed 42: 321 of 851; founders seed 7: 8 of 11). The seed reserve is not the cause: it is 0 then. VB-080 (food balance) is the fix; the drain rate (`HEALTH.drain` 9) may also be too fast for a 12-day season | M |
| `src/sim/lifecycle.js:77` | `placeIfMarried(st, m.id)` is recomputed for every woman, and each call ranks heirs across all households. It belongs outside the loop; add it to VB-052 | S |

## Performance

- **Job matching** bids every idle pawn against every open job, then sorts the bids. Most bids fail at once on `mayTake`, since a pawn may only take jobs of its own household and village. With jobs indexed by owner, a pawn looks at its household's and village's jobs only, about 5–15 instead of 660. This matters most at 7:00, when everyone is idle at once.
- **Family queries** scan all pawns, unions or households (`childrenOf`, `siblingsOf`, `spouseOf`, `isHolder`). VB-052 covers it; `s.members()` and `refreshRoles` on every birth and death are part of the same problem.
- **The route cache** grows without bound and is keyed per pair of tiles. Fine at today's scale; HPA\* over regions, as designed, is the long-term answer.
- **Contacts** compare every pair of outdoor pawns each hour. Cheap today (under 1 ms); VB-061 buckets them by map area.
- **Kinship** in the marriage match starts a fresh memo for each pair. VB-029 replaces it with degrees, which can be computed from ancestor sets once per pawn.

## Development, debugging and inspection

What exists is good: a golden file, a lint for structure and state tags, a backlog check, parallel test suites, `@sys` and `@state` greps, and a short CLAUDE.md. The gaps:

1. **No command-line view of a run.** Each test prints its own report. A `tools/sim.js` that seeds a scenario, advances N years and prints or dumps households, pawns, jobs, customs and the event log, as text or JSON, would give every task the same way to look at the simulation, and give an agent a way to answer "what happened to household 12 in year 7".
2. **The golden test names a key, not a change.** On a mismatch it should write both canonical texts and print the first differing path (for example `pawns[41].household: 7 → 9`), so an unintended change is found in seconds.
3. **One random stream for everything.** Splitting `st.rand` into named streams (world, jobs, births, deaths, culture, layout) keeps a change in one system from reshuffling the others. Tuning comparisons then measure the change, not the noise. It costs one golden re-record.
4. **No save files.** A JSON save, with the RNG state in it, is a game feature (40–80 hour runs) and a debugging tool (a bug report carries the save; a test starts from it). It needs the closures out of `st`: `st.rand`, `st.countDemand` and the functions on `st.cenv` and on each settlement.
5. **The event log keeps 40 lines of text.** A typed, append-only event record (kind, time, pawn, household, farm, village, numbers) would serve the chronicle, the panels, the tests and debugging at once; the 40-line text log becomes one view of it.
6. **Determinism is a convention, not a check.** `Math.random` and `Date` are absent from the modules today; a lint rule keeps it so.
7. **Magic numbers outside the tunables tables.** Share value (`120` per field, `0.5` per grain, `src/sim/heirs.js:84`), the reserve (`60 + 30` per member), urgencies (`src/sim/jobs.js`), tie and prestige weights. VB-038 does it for the marriage match; the same treatment for inheritance and jobs makes balance work a data change.
8. **Long lines in `culture.js`** (16 over 160 characters, in the baseline). The calibration depends on this file, so a verbatim rewrap under the refactor rules is safe and cheap.

## Work and jobs (addendum, 30 October 2026, at `6e5e39b`)

A review of the job system (`src/sim/jobs.js`, `src/sim/agents.js`, `ROLES` and `KINDS` in `src/sim/rules.js`) against the design and against the colony-sim genre. Numbers are from populous medium at seed 7, year 1 (year 2 is distorted by the starvation above), from scratch scripts on the Node loader; VB-101 makes them a standard report (`tools/sim.js --report idle`).

**How it works.** Every work hour `refreshJobs` re-posts the jobs of fields, households and fences, keyed so progress survives the night. Each idle pawn bids on each job it may take: role priority × urgency − 0.15 × steps + noise up to 0.3, with poor fits (priority 2 or less) waiting 2 hours. The best bids are assigned first; a job holds one pawn (`j.claim`). Walking, working and carrying home are phases of one job; everyone is released at 17:00.

**What is good.** Carrying is part of each job, so there is no separate hauling chore (the part of Dwarf Fortress and RimWorld players least enjoy). Matching is best fit, not first come. Multi-day progress is kept on the job. Owners give work a social meaning that most colony sims lack.

### Measurements

Share of work hours (7–17) with no job, by role and season:

| Role | Spring | Summer | Autumn | Winter |
| --- | --- | --- | --- | --- |
| Farmer | 35% | 83% | 56% | 69% |
| Mistress of the house | 38% | 59% | 49% | 61% |
| Son | 71% | 79% | 67% | 63% |
| Farmhand | 52% | 86% | 66% | 65% |
| Daughter, maid | 53–56% | 67–69% | 57–62% | 68–70% |
| Child | 100% | 100% | 100% | 100% |

| Measure | Value |
| --- | --- |
| Adults' idle time with no open job they may take | spring 69%, summer 38%, autumn 82%, winter 46% (the rest is spent next to open jobs they do not bid for) |
| Wait from posting to claim, median / 90th percentile | plow 2.7 / 27 h, sow 1.9 / 19 h, wood 14 / 73 h, thresh 1.1 / 14 h; water, cook, weed, reap about 1 h |
| Unclaimed jobs at the end of the work day | about 42 wood, 10 cook, 5 plow, 3 sow |
| Wood jobs no farmer can bid for | 110 of 119 on a summer evening: urgency about 0.1 with a full pile, so 7 × 0.1 − 0.15 × 6–8 steps < 0 even with the largest noise |
| Work hours by kind | cook 26%, plow 21%, wood 17%, water 9%, weed 8%, thresh 7%, reap 6%, mend 3%, sow 2%, haul 1% |

### Against the genre

| Area | In the genre | Here | Task |
| --- | --- | --- | --- |
| Workers per job | RimWorld splits a large build into many frames; Banished and Manor Lords staff a workplace with several workers | One pawn per job: a 20-hour field has one hoer | VB-102 |
| Idle against low-value work | RimWorld and Oxygen Not Included: any allowed job beats idling; priority orders the jobs | A bid can fall below 0, so a posted job is never taken | VB-103 |
| Children | Period settings put children to work from about 7 | Idle until 14 | VB-104 (Kim: from 7, at reduced efficiency) |
| Working day | RimWorld schedules; daylight in historical builders | 7:00–17:00 all year | VB-105 (Kim: work 6:00–18:00, a short dark that follows the season) |
| Help between households | Village-scale builders let anyone work anywhere | A household's jobs are for its members only | VB-106 (Kim: allowed; builds relationships) |
| Interrupts | RimWorld's think tree lets urgent work and needs preempt a job | A job is kept until done or 17:00; VB-022 adds it for the cook only | VB-107 |
| Legibility | Oxygen Not Included lists each worker's errands with reasons; RimWorld explains on hover | "Resting" or "Strolling", no reason | VB-101 |
| Per-pawn differences | Skills, passions and a per-pawn priority grid (RimWorld, Oxygen Not Included, Dwarf Fortress) | Fixed per role; hunger and health slow work | None: "stats and traits" is Open in the design |
| Player control | Player-set priorities and forced jobs | None; commands are VB-076 | Later (Kim: the player steers jobs, after the player's role, VB-079) |
| Planning ahead | Mostly reactive in the genre too | Reactive; VB-023 patches one sowing case | None yet: a household plan, made by the head each morning as commands, would suit the setting and the player role |

### Other observations

- Cooking and water are posted once per game day, although a day stands for a week, and they take 35% of all hours worked. Worth a look when the food arch is tuned.
- 10 cook jobs a day are still unclaimed at 17:00 (VB-022).
- Help between households changes VB-071's index: a pawn must also see the other households' jobs of its village (VB-106 says so).

## Backlog changes from this review

- Fixed: VB-034 and VB-058 were `ready` but depend on blocked VB-032; VB-010 was priority 3 while priority-1 tasks wait on it; VB-025 was priority 3 while VB-053 (priority 2) depends on it; VB-031 did not name VB-010 and VB-033.
- Defects: VB-064 (routes), VB-065 (extinct farm's people), VB-066 (guardian), VB-067 (scrub; needs review); the loop-invariant marriage call joins VB-052.
- Inspection and development: VB-068 (`tools/sim.js`), VB-069 (golden diffs), VB-070 (determinism lint), VB-071 (jobs by owner), VB-086 (tunables), VB-087 (culture.js long lines), VB-088 (performance budget; needs review).
- New arch `core`: VB-072 (random streams), VB-073 (state without closures), VB-074 (save and restore), VB-075 (record of events), VB-076 (plan: commands), VB-077 (plan: saving in the page), VB-078 (wrap-up).
- New arch `player`: VB-079 (plan: the player's role).
- Design gaps: VB-080 (food balance), VB-081 (populous adult children), VB-082 (legible customs), VB-083 (seasons), VB-084 (speed), VB-085 (heirs names).
- Addendum, work and jobs: new arch `work`, VB-101 (why idle; ready), VB-102 (several hands), VB-103 (bid floor, winter wood), VB-104 (children's work), VB-105 (daylight), VB-106 (help between households), VB-107 (interrupts), VB-108 (wrap-up); questions in `QUESTIONS.md`. VB-079 notes that the player steers jobs later.

## Work and jobs, second pass (30 October 2026, at `243d9dd`)

A second review of the job system, after VB-101 (why idle), VB-103 (work beats idling) and VB-104 (children's work): its design against Dwarf Fortress, RimWorld, Oxygen Not Included, Banished, Manor Lords, Going Medieval and Songs of Syx; what it costs; and which concrete jobs would make the village's year worth watching. Numbers are from populous medium at seed 7, year 1, unless stated, from scratch scripts on the Node loader; screenshots were taken in Chromium. An illustrated version with the screenshots and charts is published as a private page (https://claude.ai/artifact/6DSjSpb7WqMgDGJckzCaDH). The answers to its questions are in `QUESTION_ARCHIVE.md` ("job review, second pass"); it led to VB-116, VB-102 and VB-107 (built, below) and VB-117 to VB-123.

### Findings

1. **The matching works; the economy asks for too little work.** A household has about 400 adult work hours a season; its fields, hearth, well, woodpile and fences ask for 41 (winter) to 113 (spring) of them. Adults are idle 55% of work hours in spring and 79% in winter, and for 87% of that idle time there is no open job they may take.
2. **One pawn per job wasted the two peaks.** On spring day 3 at 10:25 in Sandnes (13 farms, 62 people aged 7 or more) 28 were hoeing, one per field, and 25 idle; on autumn day 9, 3 reaped and 45 waited. On summer day 5, 60 of 62 were idle, and on winter day 6 all were.
3. **A job kind lived in nine places across four files**, and every new kind added a number to all eight roles.
4. **Every job has one shape:** walk there, work, maybe carry home. Building, milling and anything that fetches materials first cannot be expressed.
5. **Performance is not the problem.** 97 ms per game day at 826 pawns; jobs, walking and routes about 16 ms of it, the social systems about two thirds.
6. **The best new jobs fill the slack seasons with work that has a consequence:** fishing and gathering, village work days and winter crafts now; haymaking, herding and milking with the animals arch.

### Where a household's hours go

| Season | Adult hours | Field work | Hearth and well | Firewood | New land and fences | Walking and carrying | Idle |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Spring | 396 | 77 | 19 | 17 | 0.3 | 64 | 55% |
| Summer | 400 | 14 | 23 | 15 | 1.5 | 58 | 72% |
| Autumn | 401 | 41 | 22 | 6 | 5 | 56 | 67% |
| Winter | 405 | 0 | 23 | 9 | 9 | 45 | 79% |

Cooking is a quarter of all work done; walking and carrying take about as long as the work itself in summer and winter. Idle adults' reasons (VB-101, 2 years): no open job they may take 86.9%, a bid waiting for the next 6-minute round 8.2%, a poor fit waiting 2 hours 4.4%, not worth the walk 0.5%.

### Against the genre

| Area | Genre | Here | Lesson |
| --- | --- | --- | --- |
| Where jobs come from | Designations, workshops and work orders (Dwarf Fortress); work givers scanning the map per work type (RimWorld); errands with a priority 1–9 (Oxygen Not Included); workplaces (Banished, Manor Lords) | Sources post onto a board hourly | Keep: owners give jobs a social meaning the genre lacks |
| Who may do it, and how a worker chooses | Labors on or off per dwarf; work types ranked 1–4 per pawn, then the nearest reachable thing over a region graph; personal priority, then errand priority, then proximity | One best-fit auction: role priority × urgency − distance + noise | Priority bands read more easily than sums; expose the sum as a few bands per type of work when the player steers (VB-079) |
| Grouping | About 20 work types over many more work givers; labors grouped | Each role ranked each kind | Rank types of work (VB-116) |
| Several workers | Workplaces with capacity; a big build split into frames | One pawn per job | Several hands (VB-102) |
| Idle time | Rare: there is always low-value work (hauling, cleaning, digging, supply) | Nothing to sink time into | New concrete jobs, and talk once pawns talk |
| Interrupts | Think trees and needs pre-empt work every tick | Only the cook after 14:00 | An hourly look up from the work (VB-107) |
| Materials | Haulers move everything to stockpiles, the most criticised chore | Carrying is part of the job | Keep it inside the job; fetching as a job step (VB-123) |
| Individuality | Skills by use, passions, interests | Role only | Open in the design (stats and traits) |

Dwarf Fortress and RimWorld wiki pages could not be fetched from the review's environment; their entries rest on search summaries and familiarity with both games.

### Performance

Node's CPU profile of 24 game days of populous medium (826 pawns, 188 open jobs) after a 60-day warm-up: 97 ms per game day, 0.2% of a core at 1× and 2% at 10×. Shares of simulation time: daily social life and contacts 65%, moving round and meetings 9%, walking 4.5%, matching 4%, routes for new walks 3.5%, posting, working, arriving and delivering 5%. Job features stay cheap if they run hourly rather than every 6-minute step (VB-107 does), keep candidate lists bounded (VB-106 note: a household offers helpers its most urgent waiting job per kind) and, once sources multiply, post on change instead of polling every farm each hour. Scheduling each pawn at its next decision instead of visiting all pawns every step would remove most of the per-step loop (about 10%), but is not needed before the uncapped speed (VB-084).

### Gaps

| Gap | Task |
| --- | --- |
| Too little work in the economy | VB-117 to VB-121 (fishing, gathering, mixed meals, work days, crafts); animals arch |
| One pawn per job | VB-102, done |
| A job kind in nine places; roles ranking kinds | VB-116, done |
| One fixed shape per job | VB-123 |
| No interrupts | VB-107, done |
| No individuality at work | Open in the design (stats and traits) |
| Little village work | VB-120 |
| Waits measured from the first posting, so a two-day field counts its night as waiting | VB-122 |
| The weather comes from the matching's random stream, so runs that differ in jobs get different harvests from year 2 | VB-072; compare runs with the weather held fixed until then |

### Built in this pass

- **VB-116:** each job kind is one record in `src/sim/kinds.js`; roles rank seven types of work with exceptions; behaviour and golden file unchanged.
- **VB-102:** several hands on field, land and threshing jobs. Founders no longer go hungry (seed 7: 22/57/0 hungry household-days in years 1–3 before, 0/0/0 after; seed 42: 25/77/0 before, 0/11/0 after, and the colony no longer dies out); populous loses fewer crops to frost; populous idleness hardly moves, since a big household already put one hand on each field.
- **VB-107:** an hourly look up from the work. Switches are rare (about 0.3 per pawn per year); a farmer keeps hoeing when the woodpile runs out and a son goes for wood.

The full before-and-after tables are in the task files. In these runs adults are still idle 55–81% of work hours outside the founders' first spring: the new jobs (VB-117 to VB-121) and the animals are what fill the year.

## Review, 31 October 2026 (at `243d9dd`, after the paths, fords and village layout work)

Since the first review 59 tasks are done, among them the food balance (VB-080), health (VB-050), meals (VB-022), jobs by owner (VB-071), indexes (VB-052), the work arch's first half (VB-101, VB-103, VB-104), rivers and fords (VB-111, VB-112), A* routes (VB-096), worn paths (VB-094, VB-110, VB-114) and cluster villages (VB-109, VB-113). `npm test` passes (25 scripts, 19 s) and `npm run verify` passes (32 scripts, 37 s). Numbers are from `tools/sim.js`, seed 7, medium map.

*Rebased onto main at `b3a6b0a` (31 October 2026). The findings and numbers below are as of `243d9dd`. Built on main since then, so out of date below: job kinds as one record each (VB-116), several hands (VB-102), interrupts (VB-107), the 6:00–18:00 day (VB-105), the browser smoke test (VB-025), the marriage limit by degree (VB-029), and relationships and talk (VB-060, VB-061, VB-124, VB-125). This review's new tasks were renumbered VB-128 to VB-130, as main had used VB-116 to VB-118.*

### Summary

1. **The critical path was blocked by a stale status.** VB-032 (a new farmstead) said it waited for VB-031, which is done, and so did the tasks behind it (VB-034, VB-058). It is `ready` now, for cleared plots; ruins wait for VB-033. Growth is still the largest gap: founders stay at 9–14 people for 40 years with no marriage and about one birth per four years, and populous holds at 815–837 people with births equal to deaths.
2. **Food: enough in total, short in places.** Founders pile up grain (300 per household in year 2, 1,700 in year 38) with nothing to spend it on (VB-130). Populous has a median household grain of 324, yet in year 6 32 of 120 households (239 people) are hungry for over 30 days and 35 people starve; years 3, 5 and 6 each lose 11–35 people to starvation. The year-2 collapse of the first review is gone (no starvation deaths in year 2). The remaining problem is distribution, which food help from kin and the village (VB-039) is meant to solve; VB-128 adds the report to see it.
3. **Cost fell a long way.** About 62 ms of simulation per game day at 830 pawns, against 190–220 ms. The one remaining spike is the yearly moving round (about 1 s in one step, VB-088's draft), now VB-129.
4. **Idle work is better but not gone.** Populous at the end of the work day leaves on average 20 `plow`, 23 `cook`, 10 `wood` and 4 `sow` and `thresh` jobs unclaimed (`--report idle`). Several hands on one job (VB-102) and interrupts (VB-107) are still to do.
5. **Walking is now a real system.** Terrain costs, fords, worn paths that speed walking and A* routes with a cache are built and tested; the first review's defects in routes (key collision, 60-step fallback) are gone. Remaining cost: `refreshRoutes` compares every cached route with every changed tile once a day, and the route cache has no bound (VB-097 is the answer if either shows up in a profile).

### Design against code (changes since the first review)

| Design point | Status | Notes |
| --- | --- | --- |
| Rivers, fords, bridges as a rule | done | VB-111, VB-112; building bridges is VB-115 |
| Terrain costs, A* routes | done | VB-096; HPA\* only if needed (VB-097) |
| Worn paths: wear, fade, speed, drawing, generated villages | done | VB-094, VB-110, VB-114; "animals wear paths" still open |
| Generated villages: cluster, fields one block beyond the yards | done | VB-109, VB-113 |
| Health, meals, food balance | done | VB-050, VB-022, VB-080 |
| Children work from 7; any allowed work beats idling | done | VB-104, VB-103 |
| Clearing a new plot | done | VB-031; the plot becomes a farm only with VB-032 |
| Claims on empty farms | task | VB-033, needs Kim's four answers |
| Weather, seasons on the map, day and night | missing | VB-083 waits for the Chromium smoke test (VB-025); VB-105 for daylight |

### Code observations

- `src/body.html` is the largest file (1,640 lines) and the only one outside the module convention and the line-length lint; every presentation task (seasons, notifications, overlays, chronicle) lands in it. VB-053 (page script into modules) is `ready` at priority 2 and should go before VB-083, VB-098 and VB-004/044.
- `tests/lint-baseline.json` should keep falling; the baseline is lowered, never raised.
- Founders is now the scenario that shows the growth gap most plainly and costs 1 ms a day; `tools/sim.js --scenario founders --years 40` is the quickest check for any expansion task (VB-032, VB-033, VB-034).
- No gaps found between `design.md` and code for the walking, rivers and layout sections; the Systems overview tables are brought up to date below.

### Backlog changes from this review

- `BACKLOG_ARCHIVE.md` now holds the done rows (59 at `243d9dd`, 69 after the rebase); `tests/backlog.js` checks both files.
- VB-032 set `ready` (was blocked on a task that is done).
- New: VB-128 (hunger report, `ready`), VB-129 (spread the moving round, `ready`, unblocks VB-088), VB-130 (grain outlets, `needs-review`).
- VB-023 set `needs-review`: its blocking question was in the task file only; it is now in `QUESTIONS.md`.

## Review, 1 November 2026 (at `7e92296`, after the animals' first batch)

Since the review of 31 October: VB-131 to VB-134 (herds, hay meadows, haymaking, the byre and the autumn count), VB-039 (food help from kin and the village), VB-029, VB-025, VB-105 and the relationships work (VB-060, VB-061, VB-124, VB-125) are done and archived. `npm test` passes (36 scripts, 28 s) and `npm run verify` passes (44 scripts, 69 s). No question in `QUESTIONS.md` has been answered, so none moved to the archive.

### Summary

1. **Growth is still the gap.** Founders at seed 7 hold 11, 13, 13, 13, 14, 13 ... 13 people over 12 years, with 2 marriages. The animals arch was built first; the critical path (VB-142, VB-032, VB-033, VB-034) is untouched. VB-033's four questions have waited since 30 October; if they stay open, their proposed answers (**P**) are a safe default for the next review to adopt.
2. **Animals work as designed in the first batch.** Founders keep named cattle and counted sheep; calves and lambs are born in year 2; hay over winter need is 0.57 to 1.45 (median 1.05) across 20 populous households; the byre counts and culls each autumn. The cost is not visible: 95-100 ms per game day on populous medium both before (`c613a9b`) and after.
3. **Hunger is uneven and returned in year 5.** Populous medium at seed 7: hungry household-days 0, 33, 61, 59, 246, 132 in years 1-6 with mean grain 260-350. The cause is unknown until VB-128 (hunger report) exists; it is the cheapest task that unblocks tuning (VB-130, VB-023, VB-048).
4. **The page script is the collision point for parallel work.** `src/body.html` is 1,894 lines, 250 more than a day ago, and seven open presentation tasks edit it. VB-053 is now priority 1 and first in the new "Pick order" of `BACKLOG.md`.
5. **Two cost numbers disagree.** `tools/sim.js` shows about 100 ms a game day; the Systems overview said 62. VB-143 (profile report) finds out which systems take the time and why.
6. **Idle work is lower in the small populous run.** Mean unclaimed jobs at the end of a work day, seed 7 small, 3 years: plow 7, wood 9, mow 6, cook 3, sow 1. The jobs queue for wood and plowing is the thing to watch once herding (VB-136) adds work.

### Design against code (changes since 31 October)

| Design point | Status | Notes |
| --- | --- | --- |
| Herds as named cattle and counted sheep, spring breeding, bull in reach | done | VB-131 |
| Hay meadows, haymaking, hay barn, winter limit | done | VB-132, VB-133 |
| Byre, autumn count, slaughter, salt meat | done | VB-134 |
| Milk, herding, manure, oxen, deer | task | VB-135 to VB-139 |
| Food help from kin and the village | done | VB-039 |
| A farmstead on a cleared plot | task | VB-032, `ready`, priority 1, not started |

### Code observations

- Module sizes are within the convention (largest module `src/gen.js`, 672 lines, in the lint baseline); the animals modules (`herds.js` 280, `byre.js` 186) are small and have their own tests (`tests/herds.js`, `hay.js`, `byre.js`, `meadows.js`).
- Inspectability is good: `tools/sim.js` has ten reports, and `--report herds` was added with the herds. What is missing is time per system (VB-143) and the reason for hunger (VB-128).
- The `--report` names are listed in three places in `tools/sim.js` (usage line, validation list, tables). A new report must be added to all three; a worker adding two reports at once should check the usage line.

### Backlog changes from this review

- New: VB-143 (profile report, `ready`, priority 2).
- VB-053 raised to priority 1; "Pick order" added to `BACKLOG.md`; VB-128 got a note on the year-5 hunger numbers.
- Nothing to archive (VB-131 to VB-134 were archived with the merge) and no answered question to move.
