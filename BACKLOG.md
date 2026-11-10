# Backlog

Open tasks of the village builder. Each task's file, `backlog/VB-NNN.md`, holds its full description; the tables here are the overview.

Done tasks: [`BACKLOG_ARCHIVE.md`](BACKLOG_ARCHIVE.md) · Questions for Kim: [`QUESTIONS.md`](QUESTIONS.md) · Slices and their order: [`docs/roadmap.md`](docs/roadmap.md)

On this page: [Ready](#ready) · [Waiting for Kim](#waiting-for-kim) · [Blocked](#blocked) · [Archs](#archs) · [How this backlog works](#how-this-backlog-works)

## Ready

The order tasks are taken in, the first first (`node tools/backlog.js next`). Sorted by priority (1 first), then ID.

| ID | Name | Arch | Pri | Size | Summary |
|----|------|------|-----|------|---------|
| [VB-233](backlog/VB-233.md) | Plan: marriage as a negotiation between households | life | 2 | S | Design the negotiation: who speaks for whom, consent, the offer, terms, courting's place and the player's answers; write its tasks. |
| [VB-240](backlog/VB-240.md) | Opinion is derived: compatibility shown by familiarity, and memories only of what happened | - | 2 | M | Talk writes 99% of opinion's memories and they restate the fixed compatibility; derive opinion from standing, compatibility and the tie, keep memories for events, and record only close friends and enemies. |
| [VB-242](backlog/VB-242.md) | The meetings and the moving round, a village a step: survey and tasks | - | 2 | S | The round matches the whole map in one step, which is why its heir cache exists; Kim decided each village holds its meeting and round in its own step. Survey the code and write the tasks. |
| [VB-244](backlog/VB-244.md) | The page runs whole steps and draws pawns between them | - | 2 | M | A step in the page is as long as a frame, so the frame rate changes the run; the page asks for whole six-minute steps and interpolates each pawn's place between the last two. |
| [VB-248](backlog/VB-248.md) | The hidden plans made explicit: targets, the land step and the seed's reservation, golden unchanged | year | 2 | M | woodGoal, ENOUGH, fieldsWanted and the cull are read from the plan record; startProject and startMeadow become its land step; seedReserve its first reservation. |
| [VB-259](backlog/VB-259.md) | Meals and foods: a ration is only the unit | year | 2 | M | The household's cooked store is renamed from rations to meals, and every food gets a row in one table (worth in rations, shelf life, source); behaviour unchanged. |
| [VB-264](backlog/VB-264.md) | Counters and the reduced bands as targets | - | 2 | S | tests/counters.js reports each counter over +10% of counters.json as a residual (structure asserts stay hard); tests/bands.js reports the balance bands at full strength as targets, the invariants band stays hard. |
| [VB-265](backlog/VB-265.md) | Bench, bands and demography write target records, with noise | - | 2 | S | tools/bench.js (lines and system shares, each also as a share of the whole step), tools/bands.js and tools/marriage-demography.js append target records with their noise (runs, seeds); paired, alternated runs for before and after. |
| [VB-267](backlog/VB-267.md) | Targets in the rules: AGENTS.md, roadmap 5 and 6, BACKLOG.md, open criteria reworded | - | 2 | S | AGENTS.md, docs/roadmap.md sections 5.2 and 6 and BACKLOG.md's rules say which checks are hard and how targets are reported; open tasks' criteria worded as gates are reworded towards targets. |
| [VB-055](backlog/VB-055.md) | TypeScript: real modules, typed state, a formatter and measures of width: survey and tasks | yardstick | 3 | S | The checker sees little through VB[...]; plan the move to modules and TypeScript in three steps, with a formatter, and caps on exports and function length in place of the 400-line cap. |
| [VB-139](backlog/VB-139.md) | Roe deer | animals | 3 | M | Deer stock per region, crop damage by broken fences, hunting. |
| [VB-160](backlog/VB-160.md) | Plan: what raised yields over the centuries, and a model for it | animals | 3 | S | Survey the historical causes of rising grain yields, their size and timescale, and propose a model in which a gain follows a change in farming; no code. |
| [VB-180](backlog/VB-180.md) | Wrap-up: state ownership and boundaries | ownership | 3 | S | Rerun the map, see what fell, review the external stress tests against the code. |
| [VB-183](backlog/VB-183.md) | Plan: the autumn fair (slice 4) | fair | 3 | S | Design the fair: goods and quanta, worth and need, how deals are found, grain loans as obligations. |
| [VB-187](backlog/VB-187.md) | The gossip experiment: stories against opinion averaging, in a reduced scenario | talk | 3 | M | Stories against opinion averaging in a reduced scenario: spread, distortion and forgetting, before stories are built. |
| [VB-207](backlog/VB-207.md) | death.hazard: the cause read from its contributions | yardstick | 3 | S | `deathRoll` takes a death's cause from the contributions of `death.hazard`, not by calling all extra risk hunger; golden unchanged. |
| [VB-215](backlog/VB-215.md) | Autosave at the moving round, once a save takes under 0.5 s | life | 3 | S | The page autosaves after the round once a save at `medium-ref` is under 0.5 s in Chromium; Kim's "build now, round later". |
| [VB-228](backlog/VB-228.md) | Refactor: each domain registers its own verbs | - | 3 | M | Verbs are registered at load by the module that carries them out, as rules are; `sim/commands` imports no domain and `later()` goes. |
| [VB-229](backlog/VB-229.md) | Refactor: events in the kernel, and land's memories as their first subscribers | - | 3 | S | An event channel with subscribers declared at load; `stakes`, `territory`, `herds` and `claims` emit instead of calling `sim/relations`. |
| [VB-230](backlog/VB-230.md) | The dependency check by layer, with a baseline that only falls | - | 3 | S | Each module names its layer; the check lists calls that go upward outside the declared channels, against a baseline that only falls (29 on 9 November). |
| [VB-231](backlog/VB-231.md) | Refactor: the customs in force, read from the kernel layer | - | 3 | M | A kernel-layer `inForce` is the one door to custom; the four modules that index practice arrays ask it, and `culture` stays the only writer. |
| [VB-232](backlog/VB-232.md) | Refactor: a rule's contribution is registered by its source | - | 3 | S | A contribution may be registered before its rule is declared, in a declared order; a lint holds `source` to the registering module; the hunger and goodwill terms move home. |
| [VB-236](backlog/VB-236.md) | The route cache is cleared when a tile's cost changes | - | 3 | S | The nightly selective refresh of 30,000 cached routes costs as much as the searches it saves: clear the cache on a change and lower its bound. |
| [VB-237](backlog/VB-237.md) | Refactor: stores refuses a holder that is not a household, a village or a pawn | - | 3 | S | type() in sim/stores takes anything that is not a household or a village for a pawn, and writes a stake onto it; test for the pawn and throw otherwise. |
| [VB-238](backlog/VB-238.md) | Refactor: a tie's eviction and floor in sim/relations, written as plain cases | - | 3 | S | put and raiseTie in sim/relations fold three cases into one nested condition and a double negation; write them as the cases they are. |
| [VB-239](backlog/VB-239.md) | Saves: derived state by one rule, no empty movements, old formats refused | - | 3 | M | Caches leave a save in three ways, 13% of ledger entries move nothing, and load carries seven migrations for saves nobody holds: one rule each, and format 2. |
| [VB-241](backlog/VB-241.md) | Refactor: the calendar, one ordered table of what runs each step, hour, day, season and year | - | 3 | M | What runs when is spread over a dozen date tests in eight modules; gather it in one ordered table in sim/clock, with behaviour unchanged. |
| [VB-243](backlog/VB-243.md) | The ownership scan's unresolved writes, a baseline that only falls | - | 3 | S | A write whose receiver the scan cannot place is listed, not checked, and up to 20 are allowed; make the list a baseline that only falls and place the 19 there are. |
| [VB-245](backlog/VB-245.md) | Idle pawns wait 2 to 4 hours before strolling again | - | 3 | S | Idle strolls cost about 40 ms of the 204 ms simulation day at the late reference; an idle pawn waits 2 to 4 hours, not 0.75 to 2. |
| [VB-246](backlog/VB-246.md) | A benchmark that shows the three engine workarounds still pay | - | 3 | S | Three places are shaped by how V8 stores objects and compiles loops, each by a comment and one old measurement; a benchmark in verify notices when one stops helping. |
| [VB-247](backlog/VB-247.md) | A job names its farm, field and meadow by id | - | 3 | M | Jobs hold the farmstead, field, meadow and fence objects themselves, which is why the save codec must find shared objects; hold ids, and the codec's sharing pass can go. |
| [VB-268](backlog/VB-268.md) | recordFold grows faster than the living from small-y5 to small-y40 | - | 3 | S | The fold of the record passes 1.56 times the slots per living pawn-day at small-y40 as at small-y5 (target 1.25): find why and whether rule 1 or 8 is broken, then cut it or name the cause. |

## Waiting for Kim

Status `needs-review`: each file lists the questions Kim must answer first, and [`QUESTIONS.md`](QUESTIONS.md) gathers them with proposed answers.

| ID | Name | Arch | Pri | Size | Summary |
|----|------|------|-----|------|---------|
| [VB-227](backlog/VB-227.md) | Jobs: refresh and matching within their share | yardstick | 2 | M | Jobs refresh and matching from 35 to its share of 30 ms a game day at medium-ref, by the rules for cost; measured over a whole year. |
| [VB-270](backlog/VB-270.md) | The hunger floors out on every full run: who is hungry, and which task closes each | animals | 2 | S | The full bands (VB-163) at 7205992: hungry-households out on all 10 runs, hunger-deaths on 8, heirs seed 42 shrinking; no task owns them. |
| [VB-269](backlog/VB-269.md) | walkTies grows faster than the living from small-y5 to small-y40 | - | 3 | S | tests/history.js reported walkTies at 1.436 against 1.25 before VB-235 (0.970 after it): confirm it is within on fresh fixtures and close, or find whether the ties walked grow with history or with the cap. |

## Blocked

By arch, in the order of the Archs table, then priority and ID. Each waits for the tasks in its `Waits for:` line (or for Kim).

| ID | Name | Arch | Pri | Size | Waits for | Summary |
|----|------|------|-----|------|-----------|---------|
| [VB-225](backlog/VB-225.md) | The release and the orphan branch of the fixtures deleted | yardstick | 1 | S | Kim | Since VB-272 nothing reads the release fixtures or the orphan branch fixtures: Kim deletes both. |
| [VB-166](backlog/VB-166.md) | A frame-time budget for the page, in headless Chromium | yardstick | 3 | S | Kim | Measure the page's frame times in headless Chromium, so a costly drawing change is caught when it lands. |
| [VB-078](backlog/VB-078.md) | Wrap-up: a life: a played line over three generations, commands and saves | life | 3 | S | VB-233 | A scripted player over 75 founders years at two seeds; played runs saved and loaded match unbroken ones; no cost without a player; slice 2's budget line. |
| [VB-023](backlog/VB-023.md) | Sowing first: the seasonal plan's order for field work | year | 2 | S | VB-252 | A hoed field is sown before the next is hoed, so small households bring in some crop. |
| [VB-058](backlog/VB-058.md) | The village green and well, built by the village | year | 2 | M | VB-257, VB-123 | A village that gains a second farm lays out a green and digs a well; they are not created automatically. |
| [VB-090](backlog/VB-090.md) | Landless adults take service where labour is short | year | 2 | M | VB-250 | At the moving round, landless adults from farms with hands to spare go into service where a farm is short of hands. |
| [VB-117](backlog/VB-117.md) | Fishing in rivers, lakes and the sea | year | 2 | M | VB-249 | Fishing from spring to autumn, always posted, urgent when food is short; fish stocks per water tile. |
| [VB-118](backlog/VB-118.md) | Gathering berries, mushrooms and nuts | year | 2 | S | VB-249 | Women and children gather in the woods in late summer and autumn; stocks refill each spring. |
| [VB-119](backlog/VB-119.md) | Mixed meals go further, and fresh food spoils | year | 2 | M | VB-117, VB-118, VB-259 | A meal from 2 sources needs 10% less food, from 3 or more 20% less; fish and gathered food spoil after 3 days; with milling (VB-009). |
| [VB-136](backlog/VB-136.md) | Herding and grazing pressure | year | 2 | M | VB-251 | A herder takes the herds to pasture; grazing pressure and cattle lanes; unherded herds in the crops. |
| [VB-249](backlog/VB-249.md) | Windows and the due-queue, then planning days by diligence | year | 2 | M | VB-248 | Time-bound kinds declare a window and are opened by a due-queue; reviews run on each holder's planning day, staggered, and when a store crosses a target. |
| [VB-250](backlog/VB-250.md) | Eligibility: a task is taken on a basis | year | 2 | S | VB-249 | eligible(st, task, pawn) returns member, servant, villager, self or null and replaces mayTake; behaviour unchanged. |
| [VB-251](backlog/VB-251.md) | Attention: full, partial and background tasks | year | 2 | S | VB-250 | A task has an attention; a pawn holds one partial and one background task at once; no kind uses them until herding (VB-136). |
| [VB-252](backlog/VB-252.md) | The seasonal plan: the culture's year as a template, golden unchanged | year | 2 | M | VB-249 | A table of season by routine with a target per store and an order, per culture, with today's numbers as its values; the review reads it. |
| [VB-253](backlog/VB-253.md) | The player as head: every choice of the plan as a command | year | 2 | M | VB-252, VB-123 | Verbs for a target, the tile of the next field or meadow, the season's order and the project, under the holder's checks; the holder's rule where none is made. |
| [VB-254](backlog/VB-254.md) | Foresight: stand-in traits, a head's horizon and its bias | year | 2 | M | VB-252, VB-023 | A head plans from an estimate of its needs: wits, husbandry and years as head set the horizon and a persistent bias; the poorest tenth leave the template's order. |
| [VB-255](backlog/VB-255.md) | Projects: a head with a surplus takes one, by its values | year | 2 | M | VB-123, VB-254 | With targets met and hands and stores to spare, a head takes one project from the menu (more fields, a claim, a farm or cottage for the heir, a barn), weighted by ambition and generosity. |
| [VB-256](backlog/VB-256.md) | The plan panel: a holder's plan read and changed in the page | year | 2 | M | VB-253, VB-255 | The household panel shows routines and targets, next steps, the project, reservations and who holds which task; the player as head changes them. |
| [VB-257](backlog/VB-257.md) | The meeting sets the village's routines, and a practice for when it does not | year | 2 | M | VB-250 | The yearly meeting chooses at most four routines from the village work available; the fence is the first; a practice says what follows no decision. |
| [VB-100](backlog/VB-100.md) | Common fields worked by the village | year | 3 | M | VB-257 | A village with an empty store makes a common field; its harvest fills the store. |
| [VB-106](backlog/VB-106.md) | Neighbours help with each other's work, and it builds ties | year | 3 | M | VB-250 | Idle adults may take a waiting field job of another household in their village; help raises tie and opinion. |
| [VB-108](backlog/VB-108.md) | Wrap-up: the household's year | year | 3 | S | VB-023, VB-058, VB-090, VB-100, VB-106, VB-117, VB-118, VB-119, VB-120, VB-123, VB-136, VB-162, VB-253, VB-254, VB-255, VB-256 | Check slice 3 with long runs at four seeds: work with a date done in time, households no hungrier, planning cheap early and late; idle share reported. |
| [VB-120](backlog/VB-120.md) | Village work days | year | 3 | M | VB-257 | The meeting sets days when the whole village mends the fence or clears the commons; staying away costs prestige. |
| [VB-123](backlog/VB-123.md) | Project plans: steps, reservations and reconsideration | year | 3 | M | VB-252 | The land project, the plot and the restoration become one project plan in st.plans, whose steps reserve what they spend and are reviewed when impossible. |
| [VB-162](backlog/VB-162.md) | A village overview: food, people, idle hands and warnings | year | 3 | M | VB-256 | One panel per village: food against need, people by age, hungry households, idle hands, and warnings that name the households. |
| [VB-126](backlog/VB-126.md) | Occasions: the meeting, weddings and funeral ales bring people together | fair | 2 | M | VB-183 | Gatherings on the map where several households, and other villages, meet and talk. |
| [VB-140](backlog/VB-140.md) | Livestock in shares and a new household's start | fair | 3 | S | VB-183 | Shares paid partly in animals; a cow and two ewes start a new household. |
| [VB-220](backlog/VB-220.md) | Goodwill acts: gratitude, an old debt, and allowance's goodwill term | fair | 3 | S | VB-183 | Switch on the curves of The gift (the debtor's gratitude, the creditor's souring) and allowance's goodwill term; golden re-recorded; help and hunger numbers before and after. |
| [VB-034](backlog/VB-034.md) | Splitting land between heirs | debt | 2 | M | VB-184 | Under "land split between heirs" the fields are divided, so the custom stops behaving like a buy-out. |
| [VB-035](backlog/VB-035.md) | Wrap-up: inheritance and expansion | debt | 2 | S | VB-034, VB-090 | Long runs check that landless adults find households and the population grows; tune and report. |
| [VB-082](backlog/VB-082.md) | Customs made legible: votes, leanings and causes | debt | 2 | M | VB-184 | Votes in the meeting log, leanings in the pawn panel, causes and changes announced. |
| [VB-043](backlog/VB-043.md) | One scope model: a membership graph of entities | debt | 3 | M | VB-184 | A scope (level, entities, dimension) asks one membership graph for the tiles, stores or people it covers. |
| [VB-044](backlog/VB-044.md) | Overlay filters by scope, and claims on the overlay | debt | 3 | M | VB-184, VB-043 | The ownership overlay can be filtered by any entity level and also shows claims. |
| [VB-045](backlog/VB-045.md) | Overlay cached per map chunk | debt | 3 | S | VB-184 | Draw the overlay per chunk and redraw only the chunks whose owners or claims changed. |
| [VB-046](backlog/VB-046.md) | Wrap-up: claims, ownership and territory | debt | 3 | S | VB-043, VB-044, VB-045, VB-092, VB-095 | Check owners, claims and the overlay at full scale; report speed and readability. |
| [VB-092](backlog/VB-092.md) | Store views for households and villages | debt | 3 | M | VB-043 | A stores table for any household or village scope, on the VB-043 scope model. |
| [VB-095](backlog/VB-095.md) | Family tree by scope, fast at full scale | debt | 3 | M | VB-184, VB-043 | The tree opens on a scope, folds the rest and draws only what is on screen. |
| [VB-141](backlog/VB-141.md) | Plan: customs of the animals | debt | 3 | S | VB-184 | Commons grazing, hunting rights, common hay, winter keep, village herd. |
| [VB-184](backlog/VB-184.md) | Plan: debt and land (slice 5) | debt | 3 | S | VB-183 | Design the alderman's road: default, cases, foreclosure into tenancy, the landed household; the bodies decision. |
| [VB-009](backlog/VB-009.md) | Hand-quern milling and making rations | mill | 3 | M | VB-185 | Grind grain to flour on a hand quern and cook rations from it. |
| [VB-093](backlog/VB-093.md) | A village windmill | mill | 3 | M | VB-009 | A village of 3 or more farms builds a windmill that grinds 5 times faster than the quern; other villages pay a toll. |
| [VB-121](backlog/VB-121.md) | Winter crafts: tools and fence poles | mill | 3 | M | VB-185 | Tools wear with field work and are mended in winter; fence poles are cut in winter and used for mending. |
| [VB-144](backlog/VB-144.md) | Ewes' milk and wool | mill | 3 | S | VB-185, VB-121 | Ewes milked until summer's end, as 13th-century husbandry counted them; wool for the winter crafts. |
| [VB-185](backlog/VB-185.md) | Plan: the mill and the loom: facilities, recipes and crafts (slice 6) | mill | 3 | S | VB-184 | Design facilities and crafts: construction as recipes, the mill, the textile chain, skills, occupations. |
| [VB-036](backlog/VB-036.md) | Plan: relationships and courting | talk | 2 | S | VB-186 | Design courting, relationships and food help between kin, so the courting tasks can be written. |
| [VB-062](backlog/VB-062.md) | Mood and its modifiers, shown in the pawn panel | talk | 2 | M | VB-186 | Each pawn has a mood made of timed modifiers ("Talked with a friend +5"); the pawn panel lists them. |
| [VB-040](backlog/VB-040.md) | Wrap-up: relationships and courting | talk | 3 | S | VB-036 | Long runs check marriage age, never-married share and help between kin against history; report. |
| [VB-063](backlog/VB-063.md) | Wrap-up: pawn interactions | talk | 3 | S | VB-062 | Check talk, relationships and mood at full scale; report cost and patterns. |
| [VB-186](backlog/VB-186.md) | Plan: talk travels: traits, venues and stories (slice 7) | talk | 3 | S | VB-185 | Design traits, encounters at venues and stories, with lies and counter-stories, from the experiment. |
| [VB-188](backlog/VB-188.md) | Plan: the ship: the outside world, silver, institutions and disease (slice 8) | ship | 3 | S | VB-186 | Design ships, silver, the Church and the Crown, rank, tithe and tax, and disease by sea. |
| [VB-189](backlog/VB-189.md) | Plan: the town (slice 9) | town | 3 | S | VB-188 | Design the market place and the town: plots, food bought, the urban sink, tiers and regions. |
| [VB-083](backlog/VB-083.md) | Seasons on the map | roads | 3 | M | VB-190 | Seasonal tints and winter snow on the painted map. |
| [VB-097](backlog/VB-097.md) | Routes over regions (HPA*), if routes cost too much | roads | 3 | M | VB-190 | Measure route cost first; bound the cache, and build HPA* over regions only if needed. |
| [VB-115](backlog/VB-115.md) | Building bridges | roads | 3 | M | VB-190 | A village builds a bridge where a ford detour costs it most; needs timber and labour. |
| [VB-190](backlog/VB-190.md) | Plan: roads, boats and ice (slice 10) | roads | 3 | S | VB-189 | Design carts, sledges and boats, climate and ice, built ways, passage and upkeep. |
| [VB-048](backlog/VB-048.md) | Wrap-up: tune yields and the food balance of a farm | animals | 3 | M | VB-136, VB-139, VB-144, VB-160 | With animals in, tune field yield, fields per farm and food from animals so a family of 6 is fed in an ordinary year. |
| [VB-091](backlog/VB-091.md) | Forest spread into open land | animals | 3 | M | VB-136 | Open land next to forest goes to scrub and then woodland unless farming, mowing or grazing keeps it open. |
| [VB-266](backlog/VB-266.md) | Checks back on pull requests, hard checks only | - | 2 | S | VB-264 | The Checks workflow runs on pull requests again and fails only on the hard checks; targets out are printed in the job summary; the late-game job reports and never fails. |

## Archs

The vertical slices of `docs/roadmap.md` in Kim's order, then the two older archs with open tasks. Closed archs are in the archive.

| Key | Arch | Goal | Design ref |
|-----|------|------|------------|
| yardstick | Slice 0: the yardstick | Every later slice measured at its own cost, early and late in a run, cheaply: work counters, scaling and history checks, late-game fixtures, a bench history, the reduced-scenario harness with bands, the rules registry, indexes of the living; the moving round, the meetings and midnight under 60 ms, a bounded route cache and a bounded history. Since 7 November (Kim) the late reference is the first year populous medium reaches 1,000 living (`medium-ref`, VB-202), with 200 ms a game day for today's systems and `medium-y60` as a stress state; VB-203 measures it and writes the closure table by system. | `docs/roadmap.md`, sections 3.0, 5 and 6 |
| life | Slice 2: a life | The player inhabits a pawn: chooses what it does from what it may do here, answers at the meeting, goes on as kin after its death, saves in the page, picks ambitions. | Vision and scope (Player role); roadmap 3.2 |
| year | Slice 3: the household's year | Work is available, not posted: plans (standing routines, seasonal plans, the meeting's yearly routines) make tasks that eligible pawns take; planning days; attention. | Work: opportunities, plans and tasks; roadmap 3.3 |
| fair | Slice 4: the autumn fair | Barter between villages in whole goods; need decides, customary worth books goodwill; grain loans as obligations. | Roadmap 3.4; `docs/review-cities.md`, phase 1 |
| debt | Slice 5: debt and land | Land rights with `own` and `use` apart; default, cases at the meeting, foreclosure into tenancy; the landed household; the bodies decision. | Claims, ownership and territory; Inheritance and expansion; roadmap 3.5 |
| mill | Slice 6: the mill and the loom | Facilities and construction as recipes, crafts and skills, the textile chain, occupations seen in hours worked. | Goods, production and animals; roadmap 3.6 |
| talk | Slice 7: talk travels | Traits, encounters at venues, stories, lies and counter-stories; talk cheaper than today. | People, households and family records; Customs and culture; roadmap 3.7 |
| ship | Slice 8: the ship | The outside world, silver, the Church and the Crown, rank, tithe and tax, disease by sea. | Roadmap 3.8; `docs/review-cities.md`, phases 3 and 5 |
| town | Slice 9: the town | Market places and towns, burgage plots, the urban sink, settlement tiers and regions. | Roadmap 3.9; `docs/review-cities.md`, phase 4 |
| roads | Slice 10: roads, boats and ice | Carts, sledges and boats, climate and ice, built ways, passage rights and upkeep. | World and scale; Weather, seasons and daylight; roadmap 3.10 |
| animals | Animals and husbandry | Open beside the slices: VB-160, VB-139, VB-091 and the wrap-up VB-048 (after slice 6). Herds, hay meadows and the winter limit; the food balance of a farm, and yields tuned once animals are in. | Animals; Land and ecology |
| ownership | State ownership and boundaries | Open beside the slices: VB-173 to VB-179 are done (target-v2 found they fit it unchanged); the wrap-up VB-180 remains. Every piece of state the simulation keeps has one owning module, which alone writes it; other modules read it freely and change it through the owner's operations; a static check keeps it so, and the map of owners and dependencies stays current (architecture review, 3 November 2026, `docs/review-architecture.md`). | none |

## How this backlog works

**Files and rows.** Each task has its own file, `backlog/VB-NNN.md`, which holds the full description and is the source of truth.
Its row here is the overview: when a task's name, arch, priority, size or what it waits for changes, update its row too; when its status
changes, move the row to that status's section. A new task takes the next free ID, gets a file and a row. Done tasks are moved, row unchanged, to `BACKLOG_ARCHIVE.md`;
their files stay in `backlog/`. Ready and Waiting for Kim are sorted by priority, then ID; Blocked by arch (in the order of the Archs table,
tasks outside every arch last), then priority, then ID; the archive by when a task was done, newest at the bottom.
`tests/backlog.js` checks that files and rows agree, and the order. `node tools/backlog.js` makes these moves from the task files
(`done`, `set`, `new`, `close-arch`, `sync`) and reads the backlog without these tables (`next`, `list`, `show`); `AGENTS.md`, Commands.

**Order and statuses.** Agents take only `Status: ready` tasks, in the Ready table's order: priority (1 first), then ID.
To change what runs first, change priorities; there is no other order. A task's notes say what it may run beside (tasks that edit the
same files run one at a time).
A task is `ready` only when it needs no design decision: the goal, numbers and acceptance criteria are all stated.
`needs-review` tasks list the questions Kim must answer first; [`QUESTIONS.md`](QUESTIONS.md) gathers the open questions of all tasks
in one place, with proposed answers, and answered ones move to [`QUESTION_ARCHIVE.md`](QUESTION_ARCHIVE.md).
A `blocked` task has a `Waits for:` line after `Status:`, naming the open tasks it waits for, or `Kim`, separated by ", " (`Waits for: VB-185, VB-009`).
That line, not the prose of the goal or notes, is what holds it: when a task is done, the tasks that wait for it drop it, and a task left
waiting for nothing is set `ready` (the check fails until it is). A task taken over by a slice waits for the slice's plan, which confirms,
rewrites or closes it. Only blocked tasks have the line.

**Flags.** When a task finds that a decided number or reference no longer holds, or that its change moves a budget line it does
not own, it raises it in the same PR: a question in `QUESTIONS.md` or a new task, and a line at the top of its notes that begins `Flag:`.
A sentence deep in the notes is not enough. On 5 and 6 November the late fixture's 2,492 living (against about 1,000) and VB-174's
ledgers adding half to the save were written in task files, and no one acted on them until the review of 7 November.

**Archs and phases.** An arch groups the tasks that build one part of the design. Its tasks go through three phases:
- **plan:** a plan task gathers the design questions; once Kim has answered them, it writes the arch's implement tasks with numbers and acceptance criteria, and sets them `ready`.
- **implement:** the tasks that build it, each small enough for one agent session (size S or M where possible).
- **wrap-up:** a task that checks the arch as a whole against the design with long runs, reports the numbers and proposes tuning. It is `blocked` until the arch's implement tasks are done.

Since 3 November 2026 the archs are the vertical slices of `docs/roadmap.md`, in the order Kim chose (slice 0 to slice 10). Each slice's plan task
is a design pass: it makes the slice's systems concrete, proposes its sections of `design.md` v0.4, and confirms, rewrites or closes the tasks
it took over from the earlier archs, which stay `blocked` until it has. A later slice's plan waits for the plan of the slice before it
(slices 1 and 2 run side by side); a slice's other tasks wait for its plan. The earlier archs are closed and kept in `BACKLOG_ARCHIVE.md` for their
done tasks; two, `ownership` and `animals`, still have open tasks that run beside the slices.

A task file names its arch and phase in `Arch: <key>` and `Phase: plan|implement|wrap-up` lines after `Size:`; a task outside every arch
has neither, and its row shows `-` as its arch. The phase has no column: a plan task's name starts with "Plan:", a wrap-up's with "Wrap-up:",
and the check holds name and phase together. List an arch's tasks with `grep -l "^Arch: <key>" backlog/*.md`. A new arch gets a row in the Archs table;
an arch with no open tasks left moves to the archive's closed archs.

**Design refs** point to sections of `design.md` ("Village builder: game design snapshot v0.4"). Refs written before 3 November point to
v0.3's sections (`docs/design-v0.3.md`); v0.4 keeps v0.3's subsection names, so most still find their place (v0.4's Status of this snapshot
says where each section went).

**Refactor rules** (every task titled "Refactor:"):
- Behaviour is unchanged: `node tests/golden.js` passes with `tests/golden.json` (VB-011) unchanged, and the PR's Checks pass. Rebuild `index.html` before committing.
- Code moves verbatim apart from the module wrapper, the dependency lines at its top and its return list. Lines over 160 characters in moved code are wrapped at statement or argument boundaries; nothing else is reformatted (`tools/wrap.js` does it, and `--compare` checks the build).
- No renames: functions, state fields and the `Sim`, `ArchGen` and `Culture` APIs keep their names, so backlog references and greps stay valid.
- A new module follows the VB-012 convention, starts with an `@sys` header (VB-013), is listed in `src/manifest.json` after every module it reads, and stays under 400 lines.

**Golden file, work counters and cost growth:** a task that changes behaviour or work counters on purpose re-records them and lists
the changes in its PR; the commands and limits are in `AGENTS.md` (Commands and Working rules).
