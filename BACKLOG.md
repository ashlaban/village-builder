# Backlog

Open tasks of the village builder. Each task's file, `backlog/VB-NNN.md`, holds its full description; the tables here are the overview.
Done tasks: [`BACKLOG_ARCHIVE.md`](BACKLOG_ARCHIVE.md). Questions for Kim: [`QUESTIONS.md`](QUESTIONS.md).
Order of work: [`docs/roadmap.md`](docs/roadmap.md). How tasks, statuses and archs work: [the last section](#how-this-backlog-works).

## Pick order

Workers take `ready` tasks by priority, but several edit the same files, so this order avoids collisions (reviewed 3 November 2026, after `docs/roadmap.md`; done tasks dropped 7 November; the history of earlier orders is in git):

The feature freeze of 2 November 2026 was lifted by Kim on 3 November: its foundations are in, and the slice order below, with the `blocked` tasks of later slices, now governs what runs.

1. **The slices, in order** (Decided, Kim, 3 November; `docs/roadmap.md`, sections 3 and 4): 0 `yardstick`; 1 `kin-help` and 2 `life` side by side (they touch different files); then 3 `year`, 4 `fair`, 5 `debt`, 6 `mill`, 7 `talk`, 8 `ship`, 9 `town`, 10 `roads`. Each starts with its plan task: VB-181 (done), VB-182, VB-079, VB-164, VB-183 to VB-186, VB-188 to VB-190. A later slice's plan is `blocked` until the slice before it has written its tasks; its implement tasks wait for its plan.
   - **Slice 0's order** (VB-181, 3 November): VB-192, VB-193, VB-088 and VB-194 to VB-198 are done. Left: VB-163 (bands) at priority 2; VB-201 (midnight) after VB-127; VB-199 (bounded history) waits for Kim; VB-200 wraps up. VB-055, VB-057 and VB-166 stay at priority 3.
2. **Beside the slices:**
   - The ownership refactors VB-173 to VB-179 are done; VB-180 wraps up the arch and is `ready`.
   - VB-127 (ties from talk) runs early, since the late game already exceeds the budget (roadmap, section 5.1); it measures itself with `tests/perf.js` and one year from a late save (roadmap, section 6).
   - `design.md` v0.4's skeleton (VB-191) is done (3 November); each slice's plan fills in its sections.
   - Small tasks that touch nothing above: VB-160, VB-165, VB-139.

## Archs

The vertical slices of `docs/roadmap.md` in Kim's order, then the two older archs with open tasks. Closed archs are in the archive.

| Key | Arch | Goal | Design ref |
|-----|------|------|------------|
| yardstick | Slice 0: the yardstick | Every later slice measured at its own cost, early and late in a run, cheaply: work counters, scaling and history checks, late-game fixtures, a bench history, the reduced-scenario harness with bands, the rules registry, indexes of the living; the moving round and midnight targeting 60 ms (medium-y60 temporarily 400 ms until VB-201), a bounded route cache and a bounded history. | `docs/roadmap.md`, sections 3.0, 5 and 6 |
| kin-help | Slice 1: kin help, booked | The walking skeleton: help in hunger as a gift through Exchange, goodwill booked between the two pawns, `allowance` as a rule, shown in the pawn panel. | Goods, production and animals (Help in hunger); Exchange, goodwill and obligations; roadmap 3.1 |
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

## Tasks

| ID | Name | Arch | Phase | Status | Priority | Size | Summary | File |
|----|------|------|-------|--------|----------|------|---------|------|
| VB-009 | Hand-quern milling and making rations | mill | implement | blocked | 3 | M | Grind grain to flour on a hand quern and cook rations from it. | [backlog/VB-009.md](backlog/VB-009.md) |
| VB-023 | Sow a hoed field before hoeing the next | year | implement | blocked | 2 | S | A hoed field is sown before the next is hoed, so small households bring in some crop. | [backlog/VB-023.md](backlog/VB-023.md) |
| VB-034 | Splitting land between heirs | debt | implement | blocked | 2 | M | Under "land split between heirs" the fields are divided, so the custom stops behaving like a buy-out. | [backlog/VB-034.md](backlog/VB-034.md) |
| VB-035 | Wrap-up: inheritance and expansion | debt | wrap-up | blocked | 2 | S | Long runs check that landless adults find households and the population grows; tune and report. | [backlog/VB-035.md](backlog/VB-035.md) |
| VB-036 | Plan: relationships and courting | talk | plan | blocked | 2 | S | Design courting, relationships and food help between kin, so the courting tasks can be written. | [backlog/VB-036.md](backlog/VB-036.md) |
| VB-040 | Wrap-up: relationships and courting | talk | wrap-up | blocked | 3 | S | Long runs check marriage age, never-married share and help between kin against history; report. | [backlog/VB-040.md](backlog/VB-040.md) |
| VB-043 | One scope model: a membership graph of entities | debt | implement | blocked | 3 | M | A scope (level, entities, dimension) asks one membership graph for the tiles, stores or people it covers. | [backlog/VB-043.md](backlog/VB-043.md) |
| VB-044 | Overlay filters by scope, and claims on the overlay | debt | implement | blocked | 3 | M | The ownership overlay can be filtered by any entity level and also shows claims. | [backlog/VB-044.md](backlog/VB-044.md) |
| VB-045 | Overlay cached per map chunk | debt | implement | blocked | 3 | S | Draw the overlay per chunk and redraw only the chunks whose owners or claims changed. | [backlog/VB-045.md](backlog/VB-045.md) |
| VB-046 | Wrap-up: claims, ownership and territory | debt | wrap-up | blocked | 3 | S | Check owners, claims and the overlay at full scale; report speed and readability. | [backlog/VB-046.md](backlog/VB-046.md) |
| VB-048 | Wrap-up: tune yields and the food balance of a farm | animals | wrap-up | blocked | 3 | M | With animals in, tune field yield, fields per farm and food from animals so a family of 6 is fed in an ordinary year. | [backlog/VB-048.md](backlog/VB-048.md) |
| VB-055 | Type checking of the JavaScript with checkJs | yardstick | implement | ready | 3 | M | Run the TypeScript checker over the plain JavaScript, with JSDoc types for `st` and `w`, to catch misspelt fields. | [backlog/VB-055.md](backlog/VB-055.md) |
| VB-057 | Golden text of the page's panels | yardstick | implement | needs-review | 3 | S | Needs a concrete regression case and justification for snapshot maintenance before implementation. | [backlog/VB-057.md](backlog/VB-057.md) |
| VB-058 | The village green and well, built by the village | year | implement | blocked | 2 | M | A village that gains a second farm lays out a green and digs a well; they are not created automatically. | [backlog/VB-058.md](backlog/VB-058.md) |
| VB-062 | Mood and its modifiers, shown in the pawn panel | talk | implement | blocked | 2 | M | Each pawn has a mood made of timed modifiers ("Talked with a friend +5"); the pawn panel lists them. | [backlog/VB-062.md](backlog/VB-062.md) |
| VB-063 | Wrap-up: pawn interactions | talk | wrap-up | blocked | 3 | S | Check talk, relationships and mood at full scale; report cost and patterns. | [backlog/VB-063.md](backlog/VB-063.md) |
| VB-077 | Plan: saving and loading in the page | life | plan | ready | 2 | S | Where saves live, autosave, and saves from older builds. | [backlog/VB-077.md](backlog/VB-077.md) |
| VB-078 | Wrap-up: commands, saves and the record of events | life | wrap-up | blocked | 3 | S | Long runs saved and loaded many times match unbroken runs; report sizes and times. | [backlog/VB-078.md](backlog/VB-078.md) |
| VB-079 | Plan: a life, the player inhabits a pawn (slice 2) | life | plan | ready | 1 | S | Design slice 2 and write its tasks: the player picks a pawn, chooses its acts, goes on as kin, saves in the page. | [backlog/VB-079.md](backlog/VB-079.md) |
| VB-082 | Customs made legible: votes, leanings and causes | debt | implement | blocked | 2 | M | Votes in the meeting log, leanings in the pawn panel, causes and changes announced. | [backlog/VB-082.md](backlog/VB-082.md) |
| VB-083 | Seasons on the map | roads | implement | blocked | 3 | M | Seasonal tints and winter snow on the painted map. | [backlog/VB-083.md](backlog/VB-083.md) |
| VB-090 | Landless adults take service where labour is short | year | implement | blocked | 2 | M | At the moving round, landless adults from farms with hands to spare go into service where a farm is short of hands. | [backlog/VB-090.md](backlog/VB-090.md) |
| VB-091 | Forest spread into open land | animals | implement | blocked | 3 | M | Open land next to forest goes to scrub and then woodland unless farming, mowing or grazing keeps it open. | [backlog/VB-091.md](backlog/VB-091.md) |
| VB-092 | Store views for households and villages | debt | implement | blocked | 3 | M | A stores table for any household or village scope, on the VB-043 scope model. | [backlog/VB-092.md](backlog/VB-092.md) |
| VB-093 | A village windmill | mill | implement | blocked | 3 | M | A village of 3 or more farms builds a windmill that grinds 5 times faster than the quern; other villages pay a toll. | [backlog/VB-093.md](backlog/VB-093.md) |
| VB-095 | Family tree by scope, fast at full scale | debt | implement | blocked | 3 | M | The tree opens on a scope, folds the rest and draws only what is on screen. | [backlog/VB-095.md](backlog/VB-095.md) |
| VB-097 | Routes over regions (HPA*), if routes cost too much | roads | implement | blocked | 3 | M | Measure route cost first; bound the cache, and build HPA* over regions only if needed. | [backlog/VB-097.md](backlog/VB-097.md) |
| VB-098 | Notifications for notable events | life | implement | needs-review | 3 | M | One `notable` rule over the record of events; toasts that select what happened. | [backlog/VB-098.md](backlog/VB-098.md) |
| VB-099 | A chronicle: the history of a pawn, farm and village | life | implement | needs-review | 3 | M | A History tab per pawn, household and village, read from the record of events. | [backlog/VB-099.md](backlog/VB-099.md) |
| VB-100 | Common fields worked by the village | year | implement | blocked | 3 | M | A village with an empty store makes a common field; its harvest fills the store. | [backlog/VB-100.md](backlog/VB-100.md) |
| VB-106 | Neighbours help with each other's work, and it builds ties | year | implement | blocked | 3 | M | Idle adults may take a waiting field job of another household in their village; help raises tie and opinion. | [backlog/VB-106.md](backlog/VB-106.md) |
| VB-108 | Wrap-up: work and jobs | year | wrap-up | blocked | 3 | S | Long runs check idleness, sowing and harvest in time, help and cost against VB-101's numbers; report and tune. | [backlog/VB-108.md](backlog/VB-108.md) |
| VB-115 | Building bridges | roads | implement | blocked | 3 | M | A village builds a bridge where a ford detour costs it most; needs timber and labour. | [backlog/VB-115.md](backlog/VB-115.md) |
| VB-117 | Fishing in rivers, lakes and the sea | year | implement | blocked | 2 | M | Fishing from spring to autumn, always posted, urgent when food is short; fish stocks per water tile. | [backlog/VB-117.md](backlog/VB-117.md) |
| VB-118 | Gathering berries, mushrooms and nuts | year | implement | blocked | 2 | S | Women and children gather in the woods in late summer and autumn; stocks refill each spring. | [backlog/VB-118.md](backlog/VB-118.md) |
| VB-119 | Mixed meals go further, and fresh food spoils | year | implement | blocked | 2 | M | A meal from 2 sources needs 10% less food, from 3 or more 20% less; fish and gathered food spoil after 3 days; with milling (VB-009). | [backlog/VB-119.md](backlog/VB-119.md) |
| VB-120 | Village work days | year | implement | blocked | 3 | M | The meeting sets days when the whole village mends the fence or clears the commons; staying away costs prestige. | [backlog/VB-120.md](backlog/VB-120.md) |
| VB-121 | Winter crafts: tools and fence poles | mill | implement | blocked | 3 | M | Tools wear with field work and are mended in winter; fence poles are cut in winter and used for mending. | [backlog/VB-121.md](backlog/VB-121.md) |
| VB-123 | A job as a few steps: go, work, fetch, carry | year | implement | blocked | 3 | M | Job kinds list their steps, so building and milling can fetch and carry; with the first building task. | [backlog/VB-123.md](backlog/VB-123.md) |
| VB-126 | Occasions: the meeting, weddings and funeral ales bring people together | fair | implement | blocked | 2 | M | Gatherings on the map where several households, and other villages, meet and talk. | [backlog/VB-126.md](backlog/VB-126.md) |
| VB-127 | Familiarity from talk and time at home, not from standing near each other | talk | implement | ready | 2 | M | Ties from talk, home and shared work; a shared decay scale and at most 150 ties; customs recalibrated. | [backlog/VB-127.md](backlog/VB-127.md) |
| VB-136 | Herding and grazing pressure | year | implement | blocked | 2 | M | A herder takes the herds to pasture; grazing pressure and cattle lanes; unherded herds in the crops. | [backlog/VB-136.md](backlog/VB-136.md) |
| VB-139 | Roe deer | animals | implement | ready | 3 | M | Deer stock per region, crop damage by broken fences, hunting. | [backlog/VB-139.md](backlog/VB-139.md) |
| VB-140 | Livestock in shares and a new household's start | fair | implement | blocked | 3 | S | Shares paid partly in animals; a cow and two ewes start a new household. | [backlog/VB-140.md](backlog/VB-140.md) |
| VB-141 | Plan: customs of the animals | debt | plan | blocked | 3 | S | Commons grazing, hunting rights, common hay, winter keep, village herd. | [backlog/VB-141.md](backlog/VB-141.md) |
| VB-144 | Ewes' milk and wool | mill | implement | blocked | 3 | S | Ewes milked until summer's end, as 13th-century husbandry counted them; wool for the winter crafts. | [backlog/VB-144.md](backlog/VB-144.md) |
| VB-160 | The soil's cap rises with a village's years of farming | animals | implement | needs-review | 3 | S | Research the mechanism for long-term yield increase before choosing a model and rate; the village-age manure cap is reopened. | [backlog/VB-160.md](backlog/VB-160.md) |
| VB-162 | A village overview: food, people, idle hands and warnings | year | implement | blocked | 3 | M | One panel per village: food against need, people by age, hungry households, idle hands, and warnings that name the households. | [backlog/VB-162.md](backlog/VB-162.md) |
| VB-163 | Bands: reduced scenarios asserted in verify, full runs reported nightly | yardstick | implement | ready | 2 | M | One table of bands; the floors against collapse asserted on tiny maps in verify; the long runs at four seeds reported nightly, never failing. | [backlog/VB-163.md](backlog/VB-163.md) |
| VB-164 | Plan: the household's year: opportunities, plans and tasks (slice 3) | year | plan | ready | 2 | S | Design slice 3 and write its tasks: work available, plans that make tasks, eligibility, the meeting's routines. | [backlog/VB-164.md](backlog/VB-164.md) |
| VB-165 | Inspect the map from the keyboard, and lists beside the canvas | - | - | needs-review | 3 | M | A keyboard-driven list of villages, households and people that selects on the map, with keys to step between them and announced selections. | [backlog/VB-165.md](backlog/VB-165.md) |
| VB-166 | A frame-time budget for the page, in headless Chromium | yardstick | implement | blocked | 3 | S | Presentation budget deferred by Kim, 4 November; resume when presentation measurement is requested again. | [backlog/VB-166.md](backlog/VB-166.md) |
| VB-169 | Take control of a pawn | life | implement | needs-review | 2 | M | "Take control" on the pawn panel: the player chooses the pawn's next command from a list; the planner leaves it alone until released. | [backlog/VB-169.md](backlog/VB-169.md) |
| VB-180 | Wrap-up: state ownership and boundaries | ownership | wrap-up | ready | 3 | S | Rerun the map, see what fell, review the external stress tests against the code. | [backlog/VB-180.md](backlog/VB-180.md) |
| VB-182 | Plan: kin help, booked as goodwill (slice 1) | kin-help | plan | ready | 1 | S | Design the walking skeleton: help in hunger as a gift through Exchange, goodwill booked, allowance as a rule. | [backlog/VB-182.md](backlog/VB-182.md) |
| VB-183 | Plan: the autumn fair (slice 4) | fair | plan | blocked | 3 | S | Design the fair: goods and quanta, worth and need, how deals are found, grain loans as obligations. | [backlog/VB-183.md](backlog/VB-183.md) |
| VB-184 | Plan: debt and land (slice 5) | debt | plan | blocked | 3 | S | Design the alderman's road: default, cases, foreclosure into tenancy, the landed household; the bodies decision. | [backlog/VB-184.md](backlog/VB-184.md) |
| VB-185 | Plan: the mill and the loom: facilities, recipes and crafts (slice 6) | mill | plan | blocked | 3 | S | Design facilities and crafts: construction as recipes, the mill, the textile chain, skills, occupations. | [backlog/VB-185.md](backlog/VB-185.md) |
| VB-186 | Plan: talk travels: traits, venues and stories (slice 7) | talk | plan | blocked | 3 | S | Design traits, encounters at venues and stories, with lies and counter-stories, from the experiment. | [backlog/VB-186.md](backlog/VB-186.md) |
| VB-187 | The gossip experiment: stories against opinion averaging, in a reduced scenario | talk | implement | blocked | 3 | M | Stories against opinion averaging in a reduced scenario: spread, distortion and forgetting, before stories are built. | [backlog/VB-187.md](backlog/VB-187.md) |
| VB-188 | Plan: the ship: the outside world, silver, institutions and disease (slice 8) | ship | plan | blocked | 3 | S | Design ships, silver, the Church and the Crown, rank, tithe and tax, and disease by sea. | [backlog/VB-188.md](backlog/VB-188.md) |
| VB-189 | Plan: the town (slice 9) | town | plan | blocked | 3 | S | Design the market place and the town: plots, food bought, the urban sink, tiers and regions. | [backlog/VB-189.md](backlog/VB-189.md) |
| VB-190 | Plan: roads, boats and ice (slice 10) | roads | plan | blocked | 3 | S | Design carts, sledges and boats, climate and ice, built ways, passage and upkeep. | [backlog/VB-190.md](backlog/VB-190.md) |
| VB-199 | Bounded history: a pawn's events as an index, routine events folded | yardstick | implement | needs-review | 2 | M | Pawn events as indexes into `st.record`; routine events folded into yearly counts; save and load under 0.5 s on the year-40 fixture. | [backlog/VB-199.md](backlog/VB-199.md) |
| VB-200 | Wrap-up: the yardstick | yardstick | wrap-up | blocked | 2 | S | The budget table at both references, every line within or over it with its task, and the suites' times before and after. | [backlog/VB-200.md](backlog/VB-200.md) |
| VB-201 | Tighten medium steps to 60 ms and spread midnight work | yardstick | implement | blocked | 2 | M | Remove the temporary medium-y60 400 ms allowance; moving-round scheduling and midnight work under 60 ms, with deterministic saves and demographic gates. | [backlog/VB-201.md](backlog/VB-201.md) |

## How this backlog works

**Files and rows.** Each task has its own file, `backlog/VB-NNN.md`, which holds the full description and is the source of truth.
Its row here is the overview: when a task's name, arch, phase, status, priority or size changes, update its row too.
A new task takes the next free ID, gets a file and a row. Done tasks are moved, row unchanged, to `BACKLOG_ARCHIVE.md`;
their files stay in `backlog/`. `tests/backlog.js` checks that files and rows agree.

**Statuses.** The nightly run takes only `Status: ready` tasks, in priority order (1 first), then ID order, as the pick order arranges them.
A task is `ready` only when it needs no design decision: the goal, numbers and acceptance criteria are all stated.
`needs-review` tasks list the questions Kim must answer first; [`QUESTIONS.md`](QUESTIONS.md) gathers the open questions of all tasks
in one place, with proposed answers, and answered ones move to [`QUESTION_ARCHIVE.md`](QUESTION_ARCHIVE.md).

**Archs and phases.** An arch groups the tasks that build one part of the design. Its tasks go through three phases:
- **plan:** a plan task gathers the design questions; once Kim has answered them, it writes the arch's implement tasks with numbers and acceptance criteria, and sets them `ready`.
- **implement:** the tasks that build it, each small enough for one nightly run (size S or M where possible).
- **wrap-up:** a task that checks the arch as a whole against the design with long runs, reports the numbers and proposes tuning. It is `blocked` until the arch's implement tasks are done.

Since 3 November 2026 the archs are the vertical slices of `docs/roadmap.md`, in the order Kim chose (slice 0 to slice 10). Each slice's plan task
is a design pass: it makes the slice's systems concrete, proposes its sections of `design.md` v0.4, and confirms, rewrites or closes the tasks
it took over from the earlier archs, which stay `blocked` until it has. The earlier archs are closed and kept in `BACKLOG_ARCHIVE.md` for their
done tasks; two, `ownership` and `animals`, still have open tasks that run beside the slices.

A task file names its arch and phase in `Arch: <key>` and `Phase: plan|implement|wrap-up` lines after `Size:`; a task outside every arch
has neither, and its row shows `-`. List an arch's tasks with `grep -l "^Arch: <key>" backlog/*.md`. A new arch gets a row in the Archs table;
an arch with no open tasks left moves to the archive's closed archs.

**Design refs** point to sections of `design.md` ("Village builder: game design snapshot v0.4"). Refs written before 3 November point to
v0.3's sections (`docs/design-v0.3.md`); v0.4 keeps v0.3's subsection names, so most still find their place (v0.4's Status of this snapshot
says where each section went).

**Refactor rules** (every task titled "Refactor:"):
- Behaviour is unchanged: `npm run verify` passes and `tests/golden.json` (VB-011) is unchanged. Rebuild `index.html` before committing.
- Code moves verbatim apart from the module wrapper, the dependency lines at its top and its return list. Lines over 160 characters in moved code are wrapped at statement or argument boundaries; nothing else is reformatted (`tools/wrap.js` does it, and `--compare` checks the build).
- No renames: functions, state fields and the `Sim`, `ArchGen` and `Culture` APIs keep their names, so backlog references and greps stay valid.
- A new module follows the VB-012 convention, starts with an `@sys` header (VB-013), is listed in `src/manifest.json` after every module it reads, and stays under 400 lines.

**Golden file, work counters and cost growth:** a task that changes behaviour or work counters on purpose re-records them and lists
the changes in its PR; the commands and limits are in `AGENTS.md` (Commands and Working rules).
