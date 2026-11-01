# Backlog

Tasks for the village builder proof of concept. The nightly run takes only `Status: ready` tasks, in priority order (1 first), then ID order. Design refs point to sections of `design.md` ("Village builder: game design snapshot v0.3").

Done tasks are moved, row unchanged, to `BACKLOG_ARCHIVE.md`; their files stay in `backlog/`. Each task has its own file, `backlog/VB-NNN.md`, which holds the full description and is the source of truth. The table below is the overview of open tasks: when a task's name, arch, phase, status, priority or size changes, update its row too. A new task takes the next free ID, gets a file and a row.

A task is `ready` only when it needs no design decision: the goal, numbers and acceptance criteria are all stated. `needs-review` tasks list the questions Kim must answer first; `QUESTIONS.md` gathers the open questions of all tasks in one place, with proposed answers, and answered ones move to `QUESTION_ARCHIVE.md`.

Refactor rules (every task titled "Refactor:"):
- Behaviour is unchanged: `npm run verify` passes and `tests/golden.json` (VB-011) is unchanged. Rebuild `index.html` before committing.
- Code moves verbatim apart from the module wrapper, the dependency lines at its top and its return list. Lines over 160 characters in moved code are wrapped at statement or argument boundaries; nothing else is reformatted.
- No renames: functions, state fields and the `Sim`, `ArchGen` and `Culture` APIs keep their names, so backlog references and greps stay valid.
- A new module follows the VB-012 convention, starts with an `@sys` header (VB-013), is listed in `src/manifest.json` after every module it reads, and stays under 400 lines.
- Depends on VB-011 to VB-015; if any is not done, mark the task blocked.

Once VB-011 is done, a non-refactor task that changes behaviour on purpose re-records the golden file with `node tests/golden.js --update` and lists the changed entries in its PR.

## Pick order

Workers take `ready` tasks by priority, but several edit the same files, so this order avoids collisions (reviewed 1 November 2026):
1. VB-053 first: it moves `src/body.html` (1,894 lines, 250 more in a day), which VB-004, VB-062, VB-083, VB-084, VB-095, VB-098, VB-099 and every animals task with art all edit; done later, each of them conflicts with it.
2. The growth path: VB-142 (fix), then VB-032, then VB-033 once Kim has answered (`QUESTIONS.md`), then VB-034, VB-058, VB-090. Growth is still the largest gap in the game. Moving to new land (VB-146 to VB-150, review of 1 November, `docs/review-expansion.md`) runs in this order; VB-146 and VB-147 edit `src/sim/expansion.js` and the moving round, so they go before VB-033 and VB-090, which edit the same.
3. Diagnostics before tuning: VB-128 (hunger report) and VB-143 (profile report) before VB-130, VB-023 and VB-048.
4. Animals batch two (VB-135 to VB-138) is independent of the growth path and may run in parallel.

## Archs

An arch groups the tasks that build one part of the design. Its tasks go through three phases:
- **plan:** a plan task gathers the design questions; once Kim has answered them, it writes the arch's implement tasks with numbers and acceptance criteria, and sets them `ready`.
- **implement:** the tasks that build it, each small enough for one nightly run (size S or M where possible).
- **wrap-up:** a task that checks the arch as a whole against the design with long runs, reports the numbers and proposes tuning. It is `blocked` until the arch's implement tasks are done.

A task file names its arch and phase in `Arch: <key>` and `Phase: plan|implement|wrap-up` lines after `Size:`; a task outside every arch has neither, and its row shows `-`. List an arch's tasks with `grep -l "^Arch: <key>" backlog/*.md`. A new arch gets a row below.

| Key | Arch | Goal | Design ref |
|-----|------|------|------------|
| expansion | Inheritance and expansion | Landless adults find a household of their own: claim an empty farm, clear a plot, build a farmstead, split land, or leave a crowded village for new land; the customs for claims, cleared land and shares take effect. | Inheritance and expansion |
| courting | Relationships and courting | Marriages come from courting; the marriage limit by degree; kin and the village help a hungry family. | People, households and family records; Inheritance and expansion (Leaving home) |
| claims | Claims, ownership and territory | Owners and claims on every tile, the ownership overlay with filters, one scope model for overlays, stores and family trees. | Claims, ownership and territory |
| animals | Animals and husbandry | Herds, hay meadows and the winter limit; the food balance of a farm, and yields tuned once animals are in. | Animals; Land and ecology |
| food | Food, hunger and health | Daily food, seed, milling, hunger, health and causes of death. | Economy and jobs; People (Mortality) |
| social | Pawn interactions | Who meets whom, what happens between two pawns, and the relationships it builds; the base for courting, help between kin and persuasion. | People, households and family records; Customs and culture (How attitudes move) |
| tooling | Code and verification | Code structure, speed at 1,000 pawns, and automatic checks of the simulation and the page. | none |
| core | Commands, saves and the record of events | Pawns and other entities act through commands; a run can be saved and loaded exactly; every notable event is kept as a typed record. | Commands, time steps and views; Systems overview |
| player | The player's role | Decide and build what the player is and does: whose commands they give, how they sway customs, and what a run offers them. | Vision and scope (Player role); Systems overview |
| work | Work and jobs | Pawns work when there is work: several hands per job, children's work, help between households, interrupts, and the 6:00–18:00 day with a short night; steered by the player later. | Economy and jobs; Time and calendar (Daily rhythm) |

## Tasks

| ID | Name | Arch | Phase | Status | Priority | Size | Summary | File |
|----|------|------|-------|--------|----------|------|---------|------|
| VB-004 | Ownership map overlay | claims | implement | ready | 3 | S | Toggle overlay that tints each owned tile by its owner. | [backlog/VB-004.md](backlog/VB-004.md) |
| VB-009 | Hand-quern milling and making rations | food | implement | ready | 3 | M | Grind grain to flour on a hand quern and cook rations from it. | [backlog/VB-009.md](backlog/VB-009.md) |
| VB-023 | Sow a hoed field before hoeing the next | food | implement | needs-review | 2 | S | A hoed field is sown before the next is hoed, so small households bring in some crop. | [backlog/VB-023.md](backlog/VB-023.md) |
| VB-024 | Wood supply: how fast the forest runs out | - | - | ready | 3 | S | Report how fast villages fell their woodlots; decide whether to retune. | [backlog/VB-024.md](backlog/VB-024.md) |
| VB-026 | Name generators, and farm names in big villages | expansion | implement | ready | 3 | M | Name generators per entity kind, preferred per culture; farms: compass, landmark, owner. | [backlog/VB-026.md](backlog/VB-026.md) |
| VB-033 | Claiming an empty farm | expansion | implement | needs-review | 1 | M | Landless adults claim empty farms under the `claims` custom and restore them before moving in. | [backlog/VB-033.md](backlog/VB-033.md) |
| VB-034 | Splitting land between heirs | expansion | implement | blocked | 2 | M | Under "land split between heirs" the fields are divided, so the custom stops behaving like a buy-out. | [backlog/VB-034.md](backlog/VB-034.md) |
| VB-035 | Wrap-up: inheritance and expansion | expansion | wrap-up | blocked | 2 | S | Long runs check that landless adults find households and the population grows; tune and report. | [backlog/VB-035.md](backlog/VB-035.md) |
| VB-036 | Plan: relationships and courting | courting | plan | ready | 2 | S | Design courting, relationships and food help between kin, so the courting tasks can be written. | [backlog/VB-036.md](backlog/VB-036.md) |
| VB-040 | Wrap-up: relationships and courting | courting | wrap-up | blocked | 3 | S | Long runs check marriage age, never-married share and help between kin against history; report. | [backlog/VB-040.md](backlog/VB-040.md) |
| VB-042 | Tile claims, realised and unrealised | claims | implement | ready | 2 | M | Any entity can hold a claim on a tile it does not own: realised (in force) or unrealised (wanted). | [backlog/VB-042.md](backlog/VB-042.md) |
| VB-043 | One scope model: a membership graph of entities | claims | implement | ready | 3 | M | A scope (level, entities, dimension) asks one membership graph for the tiles, stores or people it covers. | [backlog/VB-043.md](backlog/VB-043.md) |
| VB-044 | Overlay filters by scope, and claims on the overlay | claims | implement | ready | 3 | M | The ownership overlay can be filtered by any entity level and also shows claims. | [backlog/VB-044.md](backlog/VB-044.md) |
| VB-045 | Overlay cached per map chunk | claims | implement | ready | 3 | S | Draw the overlay per chunk and redraw only the chunks whose owners or claims changed. | [backlog/VB-045.md](backlog/VB-045.md) |
| VB-046 | Wrap-up: claims, ownership and territory | claims | wrap-up | blocked | 3 | S | Check owners, claims and the overlay at full scale; report speed and readability. | [backlog/VB-046.md](backlog/VB-046.md) |
| VB-048 | Wrap-up: tune yields and the food balance of a farm | animals | wrap-up | needs-review | 3 | M | With animals in, tune field yield, fields per farm and food from animals so a family of 6 is fed in an ordinary year. | [backlog/VB-048.md](backlog/VB-048.md) |
| VB-053 | Refactor: page script into modules under lint | tooling | implement | ready | 1 | L | Split the 1,900-line page script in `src/body.html` into `src/page/*.js` modules that lint and greps cover. | [backlog/VB-053.md](backlog/VB-053.md) |
| VB-055 | Type checking of the JavaScript with checkJs | tooling | implement | ready | 3 | M | Run the TypeScript checker over the plain JavaScript, with JSDoc types for `st` and `w`, to catch misspelt fields. | [backlog/VB-055.md](backlog/VB-055.md) |
| VB-057 | Golden text of the page's panels | tooling | implement | ready | 3 | S | Record the text of every panel for a fixed seed and day, so unintended UI changes fail the verify run. | [backlog/VB-057.md](backlog/VB-057.md) |
| VB-058 | The village green and well, built by the village | expansion | implement | blocked | 2 | M | A village that gains a second farm lays out a green and digs a well; they are not created automatically. | [backlog/VB-058.md](backlog/VB-058.md) |
| VB-062 | Mood and its modifiers, shown in the pawn panel | social | implement | ready | 2 | M | Each pawn has a mood made of timed modifiers ("Talked with a friend +5"); the pawn panel lists them. | [backlog/VB-062.md](backlog/VB-062.md) |
| VB-063 | Wrap-up: pawn interactions | social | wrap-up | blocked | 3 | S | Check talk, relationships and mood at full scale; report cost and patterns. | [backlog/VB-063.md](backlog/VB-063.md) |
| VB-072 | Random streams per system, with saveable state | core | implement | ready | 2 | M | One seeded stream per system as plain data, so systems do not reshuffle each other and saves can hold them. | [backlog/VB-072.md](backlog/VB-072.md) |
| VB-073 | Simulation state as plain data, without closures | core | implement | ready | 2 | M | No functions in `st`: `countDemand` and the culture lookups become plain functions and hooks. | [backlog/VB-073.md](backlog/VB-073.md) |
| VB-074 | Save and restore the simulation state | core | implement | ready | 2 | M | `Sim.save` and `Sim.load` in Node; a saved and loaded run continues exactly like an unbroken one. | [backlog/VB-074.md](backlog/VB-074.md) |
| VB-075 | A typed record of events | core | implement | ready | 2 | M | An append-only `st.record` of typed events, queryable by pawn, household, farm, village and kind. | [backlog/VB-075.md](backlog/VB-075.md) |
| VB-076 | Plan: commands | core | plan | ready | 1 | S | Design the command layer (Decided, not built) so its implement tasks can be written. | [backlog/VB-076.md](backlog/VB-076.md) |
| VB-077 | Plan: saving and loading in the page | core | plan | ready | 2 | S | Where saves live, autosave, and saves from older builds. | [backlog/VB-077.md](backlog/VB-077.md) |
| VB-078 | Wrap-up: commands, saves and the record of events | core | wrap-up | blocked | 3 | S | Long runs saved and loaded many times match unbroken runs; report sizes and times. | [backlog/VB-078.md](backlog/VB-078.md) |
| VB-079 | Plan: the player's role | player | plan | ready | 2 | S | Settle the player's role (Open) so the player arch can be planned. | [backlog/VB-079.md](backlog/VB-079.md) |
| VB-082 | Customs made legible: votes, leanings and causes | - | - | ready | 2 | M | Votes in the meeting log, leanings in the pawn panel, causes and changes announced. | [backlog/VB-082.md](backlog/VB-082.md) |
| VB-083 | Seasons on the map | - | - | blocked | 3 | M | Seasonal tints and winter snow on the painted map. | [backlog/VB-083.md](backlog/VB-083.md) |
| VB-084 | A 30× speed and an uncapped speed | - | - | ready | 3 | S | Speeds of 30× and "Max", as fast as a 12 ms frame budget allows. | [backlog/VB-084.md](backlog/VB-084.md) |
| VB-088 | A performance budget in the verify run | tooling | implement | blocked | 3 | S | `tests/perf.js` in verify, failing above twice the budget per game day and per step. | [backlog/VB-088.md](backlog/VB-088.md) |
| VB-090 | Landless adults take service where labour is short | expansion | implement | ready | 2 | M | At the moving round, landless adults from farms with hands to spare go into service where a farm is short of hands. | [backlog/VB-090.md](backlog/VB-090.md) |
| VB-091 | Forest spread into open land | animals | implement | blocked | 3 | M | Open land next to forest goes to scrub and then woodland unless farming, mowing or grazing keeps it open. | [backlog/VB-091.md](backlog/VB-091.md) |
| VB-092 | Store views for households and villages | claims | implement | blocked | 3 | M | A stores table for any household or village scope, on the VB-043 scope model. | [backlog/VB-092.md](backlog/VB-092.md) |
| VB-093 | A village windmill | food | implement | blocked | 3 | M | A village of 3 or more farms builds a windmill that grinds 5 times faster than the quern; other villages pay a toll. | [backlog/VB-093.md](backlog/VB-093.md) |
| VB-095 | Family tree by scope, fast at full scale | claims | implement | needs-review | 3 | M | The tree opens on a scope, folds the rest and draws only what is on screen. | [backlog/VB-095.md](backlog/VB-095.md) |
| VB-097 | Routes over regions (HPA*), if routes cost too much | tooling | implement | ready | 3 | M | Measure route cost first; bound the cache, and build HPA* over regions only if needed. | [backlog/VB-097.md](backlog/VB-097.md) |
| VB-098 | Notifications for notable events | - | - | needs-review | 3 | M | One `notable` rule over the record of events; toasts that select what happened. | [backlog/VB-098.md](backlog/VB-098.md) |
| VB-099 | A chronicle: the history of a pawn, farm and village | - | - | needs-review | 3 | M | A History tab per pawn, household and village, read from the record of events. | [backlog/VB-099.md](backlog/VB-099.md) |
| VB-100 | Common fields worked by the village | - | - | needs-review | 3 | M | A village with an empty store makes a common field; its harvest fills the store. | [backlog/VB-100.md](backlog/VB-100.md) |
| VB-106 | Neighbours help with each other's work, and it builds ties | work | implement | needs-review | 3 | M | Idle adults may take a waiting field job of another household in their village; help raises tie and opinion. | [backlog/VB-106.md](backlog/VB-106.md) |
| VB-108 | Wrap-up: work and jobs | work | wrap-up | blocked | 3 | S | Long runs check idleness, sowing and harvest in time, help and cost against VB-101's numbers; report and tune. | [backlog/VB-108.md](backlog/VB-108.md) |
| VB-115 | Building bridges | - | - | needs-review | 3 | M | A village builds a bridge where a ford detour costs it most; needs timber and labour. | [backlog/VB-115.md](backlog/VB-115.md) |
| VB-117 | Fishing in rivers, lakes and the sea | food | implement | needs-review | 2 | M | Fishing from spring to autumn, always posted, urgent when food is short; fish stocks per water tile. | [backlog/VB-117.md](backlog/VB-117.md) |
| VB-118 | Gathering berries, mushrooms and nuts | food | implement | needs-review | 2 | S | Women and children gather in the woods in late summer and autumn; stocks refill each spring. | [backlog/VB-118.md](backlog/VB-118.md) |
| VB-119 | Mixed meals go further, and fresh food spoils | food | implement | needs-review | 2 | M | A meal from 2 sources needs 10% less food, from 3 or more 20% less; fish and gathered food spoil after 3 days; with milling (VB-009). | [backlog/VB-119.md](backlog/VB-119.md) |
| VB-120 | Village work days | work | implement | needs-review | 3 | M | The meeting sets days when the whole village mends the fence or clears the commons; staying away costs prestige. | [backlog/VB-120.md](backlog/VB-120.md) |
| VB-121 | Winter crafts: tools and fence poles | work | implement | needs-review | 3 | M | Tools wear with field work and are mended in winter; fence poles are cut in winter and used for mending. | [backlog/VB-121.md](backlog/VB-121.md) |
| VB-122 | The idle report measures waits from when a job is free, and counts switches | tooling | implement | ready | 3 | S | Waits counted per free spell in work hours; switches per pawn per year in `--report idle`. | [backlog/VB-122.md](backlog/VB-122.md) |
| VB-123 | A job as a few steps: go, work, fetch, carry | work | implement | needs-review | 3 | M | Job kinds list their steps, so building and milling can fetch and carry; with the first building task. | [backlog/VB-123.md](backlog/VB-123.md) |
| VB-126 | Occasions: the meeting, weddings and funeral ales bring people together | social | implement | needs-review | 2 | M | Gatherings on the map where several households, and other villages, meet and talk. | [backlog/VB-126.md](backlog/VB-126.md) |
| VB-127 | Familiarity from talk and time at home, not from standing near each other | social | implement | needs-review | 3 | M | Ties from talk, home and shared work; a shared decay scale and at most 150 ties; customs recalibrated. | [backlog/VB-127.md](backlog/VB-127.md) |
| VB-128 | Report: who is hungry and why | tooling | implement | ready | 2 | S | `tools/sim.js --report hunger`: hungry households with grain, fields, members and the cause. | [backlog/VB-128.md](backlog/VB-128.md) |
| VB-129 | Spread the moving round over several steps | tooling | implement | needs-review | 2 | S | The yearly moving round ran in one 1 s step; VB-145 brought it to 20 ms; close or keep for saves. | [backlog/VB-129.md](backlog/VB-129.md) |
| VB-130 | Grain outlets: what a hoard of grain does | food | implement | needs-review | 3 | S | Founders end up with 1,000+ grain and nothing to spend it on; add storage loss or another outlet. | [backlog/VB-130.md](backlog/VB-130.md) |
| VB-136 | Herding and grazing pressure | animals | implement | ready | 2 | M | A herder takes the herds to pasture; grazing pressure and cattle lanes; unherded herds in the crops. | [backlog/VB-136.md](backlog/VB-136.md) |
| VB-139 | Roe deer | animals | implement | ready | 3 | M | Deer stock per region, crop damage by broken fences, hunting. | [backlog/VB-139.md](backlog/VB-139.md) |
| VB-140 | Livestock in shares and a new household's start | animals | implement | blocked | 3 | S | Shares paid partly in animals; a cow and two ewes start a new household. | [backlog/VB-140.md](backlog/VB-140.md) |
| VB-141 | Plan: customs of the animals | animals | plan | ready | 3 | S | Commons grazing, hunting rights, common hay, winter keep, village herd. | [backlog/VB-141.md](backlog/VB-141.md) |
| VB-142 | A pawn is allotted at most one cleared plot | expansion | implement | ready | 2 | S | Fix: `allot` gives a second cleared plot to a pawn who already holds one. | [backlog/VB-142.md](backlog/VB-142.md) |
| VB-143 | A profile report: where a game day's time goes | tooling | implement | ready | 2 | S | `tools/sim.js --report perf`: milliseconds per system per game day, so the next slow step is found, not guessed. | [backlog/VB-143.md](backlog/VB-143.md) |
| VB-144 | Ewes' milk and wool | animals | implement | needs-review | 3 | S | Ewes milked until summer's end, as 13th-century husbandry counted them; wool for the winter crafts. | [backlog/VB-144.md](backlog/VB-144.md) |
| VB-148 | Booths, new villages and the crowded note on the page | expansion | implement | ready | 2 | M | Booth and cottage art, labels for villages founded in play, the crowded note and origin in panels, `--report villages`. | [backlog/VB-148.md](backlog/VB-148.md) |
| VB-149 | Fresh land yields more for its first crops | expansion | implement | ready | 2 | S | A field on never-farmed ground starts at soil 1.4 and wears to normal in about 4 crops, in every scenario. | [backlog/VB-149.md](backlog/VB-149.md) |
| VB-150 | Measure moving to new land in long runs | expansion | implement | blocked | 2 | S | Long runs before and after: villages founded, waiting adults, population, never-married share; tuning proposed to Kim. | [backlog/VB-150.md](backlog/VB-150.md) |
