# Backlog

Tasks for the village builder proof of concept. The nightly run takes only `Status: ready` tasks, in priority order (1 first), then ID order. Design refs point to sections of `design.md` ("Village builder: game design snapshot v0.3").

Each task has its own file, `backlog/VB-NNN.md`, which holds the full description and is the source of truth. The table below is the overview: when a task's name, arch, phase, status, priority or size changes, update its row too. A new task takes the next free ID, gets a file and a row.

A task is `ready` only when it needs no design decision: the goal, numbers and acceptance criteria are all stated. `needs-review` tasks list the questions Kim must answer first; `QUESTIONS.md` gathers the open questions of all tasks in one place, with proposed answers.

Refactor rules (every task titled "Refactor:"):
- Behaviour is unchanged: `npm run verify` passes and `tests/golden.json` (VB-011) is unchanged. Rebuild `index.html` before committing.
- Code moves verbatim apart from the module wrapper, the dependency lines at its top and its return list. Lines over 160 characters in moved code are wrapped at statement or argument boundaries; nothing else is reformatted.
- No renames: functions, state fields and the `Sim`, `ArchGen` and `Culture` APIs keep their names, so backlog references and greps stay valid.
- A new module follows the VB-012 convention, starts with an `@sys` header (VB-013), is listed in `src/manifest.json` after every module it reads, and stays under 400 lines.
- Depends on VB-011 to VB-015; if any is not done, mark the task blocked.

Once VB-011 is done, a non-refactor task that changes behaviour on purpose re-records the golden file with `node tests/golden.js --update` and lists the changed entries in its PR.

## Archs

An arch groups the tasks that build one part of the design. Its tasks go through three phases:
- **plan:** a plan task gathers the design questions; once Kim has answered them, it writes the arch's implement tasks with numbers and acceptance criteria, and sets them `ready`.
- **implement:** the tasks that build it, each small enough for one nightly run (size S or M where possible).
- **wrap-up:** a task that checks the arch as a whole against the design with long runs, reports the numbers and proposes tuning. It is `blocked` until the arch's implement tasks are done.

A task file names its arch and phase in `Arch: <key>` and `Phase: plan|implement|wrap-up` lines after `Size:`; a task outside every arch has neither, and its row shows `-`. List an arch's tasks with `grep -l "^Arch: <key>" backlog/*.md`. A new arch gets a row below.

| Key | Arch | Goal | Design ref |
|-----|------|------|------------|
| expansion | Inheritance and expansion | Landless adults find a household of their own: claim an empty farm, clear a plot, build a farmstead, split land; the customs for claims, cleared land and shares take effect. | Inheritance and expansion |
| courting | Relationships and courting | Marriages come from courting; the marriage limit by degree; kin and the village help a hungry family. | People, households and family records; Inheritance and expansion (Leaving home) |
| claims | Claims, ownership and territory | Owners and claims on every tile, the ownership overlay with filters, one scope model for overlays, stores and family trees. | Claims, ownership and territory |
| animals | Animals and husbandry | Herds, hay meadows and the winter limit; the food balance of a farm, and yields tuned once animals are in. | Animals; Land and ecology |
| food | Food, hunger and health | Daily food, seed, milling, hunger, health and causes of death. | Economy and jobs; People (Mortality) |
| tooling | Code and verification | Code structure, speed at 1,000 pawns, and automatic checks of the simulation and the page. | none |

## Tasks

| ID | Name | Arch | Phase | Status | Priority | Size | Summary | File |
|----|------|------|-------|--------|----------|------|---------|------|
| VB-001 | Make the test suite fail on regressions | - | - | done | 1 | S | Add assertions so `npm test` fails when the sim or page breaks. | [backlog/VB-001.md](backlog/VB-001.md) |
| VB-002 | Clock shows game time in 5-minute steps, apart from the simulation step | - | - | done | 1 | S | UI clock follows game time in 5-minute steps, redrawn every frame. | [backlog/VB-002.md](backlog/VB-002.md) |
| VB-003 | Every farm in a village, and an owner for every tile | claims | implement | ready | 1 | M | Lone farms become one-farm villages; a per-tile owner map. | [backlog/VB-003.md](backlog/VB-003.md) |
| VB-004 | Ownership map overlay | claims | implement | ready | 3 | S | Toggle overlay that tints each owned tile by its owner. | [backlog/VB-004.md](backlog/VB-004.md) |
| VB-005 | Trees per wooded tile | - | - | done | 2 | M | Forest tiles hold trees; firewood fells them, they regrow, 0 becomes meadow. | [backlog/VB-005.md](backlog/VB-005.md) |
| VB-006 | Stones on meadow tiles | - | - | done | 2 | S | Meadow tiles track stone content for field-making and building stone. | [backlog/VB-006.md](backlog/VB-006.md) |
| VB-007 | Tilling and threshing as multi-day work | - | - | done | 2 | M | Tilling takes several days per field; harvest gains a threshing step. | [backlog/VB-007.md](backlog/VB-007.md) |
| VB-008 | Summer upkeep of growing fields | - | - | done | 3 | S | Growing fields need weeding; neglect lowers the yield. | [backlog/VB-008.md](backlog/VB-008.md) |
| VB-009 | Hand-quern milling and making rations | food | implement | ready | 3 | M | Grind grain to flour on a hand quern and cook rations from it. | [backlog/VB-009.md](backlog/VB-009.md) |
| VB-010 | Founders start on unmade land and make their fields | claims | implement | ready | 3 | L | Founders start without fields and claim, clear and break meadow. | [backlog/VB-010.md](backlog/VB-010.md) |
| VB-011 | Golden-state test for world, simulation and calibration | - | - | done | 1 | S | Fingerprint world and sim output so refactors provably change nothing. | [backlog/VB-011.md](backlog/VB-011.md) |
| VB-012 | One module list, a module namespace and a Node loader | - | - | done | 1 | M | One module list, a `VB` namespace and a Node loader for tests. | [backlog/VB-012.md](backlog/VB-012.md) |
| VB-013 | Structure lint: module headers, file and line length | - | - | done | 1 | S | Lint module headers, file length and line length. | [backlog/VB-013.md](backlog/VB-013.md) |
| VB-014 | CLAUDE.md, a short guide for agents | - | - | done | 1 | S | Write CLAUDE.md, a short guide for agents. | [backlog/VB-014.md](backlog/VB-014.md) |
| VB-015 | State schema as greppable tags | - | - | done | 1 | M | Document every `w` and `st` field with greppable `@state` tags. | [backlog/VB-015.md](backlog/VB-015.md) |
| VB-016 | Refactor: sim rules, hex helpers and village layout into modules | - | - | done | 1 | S | Move sim rules, hex helpers and village layout out of `src/sim.js`. | [backlog/VB-016.md](backlog/VB-016.md) |
| VB-017 | Refactor: family records and agents into modules | - | - | done | 1 | S | Move family records and agents out of `src/sim.js`. | [backlog/VB-017.md](backlog/VB-017.md) |
| VB-018 | Refactor: job board and inheritance into modules | - | - | done | 1 | S | Move the job board and inheritance out of `src/sim.js`. | [backlog/VB-018.md](backlog/VB-018.md) |
| VB-019 | Refactor: culture wiring and the yearly round into modules | - | - | done | 1 | S | Move culture wiring and the yearly round out of `src/sim.js`. | [backlog/VB-019.md](backlog/VB-019.md) |
| VB-020 | Refactor: scenarios and the clock into modules; `Sim` as a facade | - | - | done | 1 | S | Move scenarios and the clock out; `Sim` becomes a facade. | [backlog/VB-020.md](backlog/VB-020.md) |
| VB-021 | Map generation screen with size, seed and starting scenario | - | - | done | 3 | L | Start screen for map size, seed and scenario; Populous Villages; shared generators. | [backlog/VB-021.md](backlog/VB-021.md) |
| VB-022 | Daily meals that always happen (unblocks VB-009) | food | implement | ready | 2 | M | A rations store, starting rations, cooking for the next day; the cook may leave other work after 14:00. | [backlog/VB-022.md](backlog/VB-022.md) |
| VB-023 | Sow a hoed field before hoeing the next | food | implement | ready | 2 | S | A hoed field is sown before the next is hoed, so small households bring in some crop. | [backlog/VB-023.md](backlog/VB-023.md) |
| VB-024 | Wood supply: how fast the forest runs out | - | - | ready | 3 | S | Report how fast villages fell their woodlots; decide whether to retune. | [backlog/VB-024.md](backlog/VB-024.md) |
| VB-025 | Browser smoke test in real Chromium | tooling | implement | needs-review | 3 | M | Playwright smoke test of `index.html` in real Chromium. | [backlog/VB-025.md](backlog/VB-025.md) |
| VB-026 | Farm names in big villages | expansion | implement | needs-review | 3 | S | Choose a naming rule for farms beyond the direction names. | [backlog/VB-026.md](backlog/VB-026.md) |
| VB-027 | Births within marriage | - | - | done | 2 | M | Married women conceive, give birth and nurse; infant and child mortality. | [backlog/VB-027.md](backlog/VB-027.md) |
| VB-028 | Hunger has consequences | - | - | done | 2 | M | Hunger raises death risk, slows work, postpones marriage and births; `feedOrder` custom. | [backlog/VB-028.md](backlog/VB-028.md) |
| VB-029 | Marriage limit by degree, opening up when spouses are scarce | courting | implement | ready | 2 | M | `kinOk` judges by civil degree; scarcity of spouses loosens the custom. | [backlog/VB-029.md](backlog/VB-029.md) |
| VB-030 | Plan: inheritance and expansion | expansion | plan | needs-review | 1 | S | Answer the open points so the expansion tasks VB-031 to VB-034 become ready. | [backlog/VB-030.md](backlog/VB-030.md) |
| VB-031 | Clearing a new plot | expansion | implement | needs-review | 1 | L | The village clears a plot for those who want to move out; the `newLand` custom decides who gets it. | [backlog/VB-031.md](backlog/VB-031.md) |
| VB-032 | Constructing a new farmstead | expansion | implement | needs-review | 1 | L | Build the cottage on a cleared or ruined site; a new household moves in, starting from its shares. | [backlog/VB-032.md](backlog/VB-032.md) |
| VB-033 | Claiming an empty farm | expansion | implement | needs-review | 1 | M | Landless adults claim empty farms under the `claims` custom and restore them before moving in. | [backlog/VB-033.md](backlog/VB-033.md) |
| VB-034 | Splitting land between heirs | expansion | implement | needs-review | 2 | M | Under "land split between heirs" the fields are divided, so the custom stops behaving like a buy-out. | [backlog/VB-034.md](backlog/VB-034.md) |
| VB-035 | Wrap-up: inheritance and expansion | expansion | wrap-up | blocked | 2 | S | Long runs check that landless adults find households and the population grows; tune and report. | [backlog/VB-035.md](backlog/VB-035.md) |
| VB-036 | Plan: relationships and courting | courting | plan | needs-review | 2 | S | Design courting, relationships and food help between kin, so the courting tasks can be written. | [backlog/VB-036.md](backlog/VB-036.md) |
| VB-037 | Founders start with a looser marriage limit | courting | implement | ready | 1 | S | The founders scenario starts with "First cousins or further" as custom and practice. | [backlog/VB-037.md](backlog/VB-037.md) |
| VB-038 | Marriage numbers as tunables | courting | implement | ready | 2 | S | Move the magic numbers of the marriage match into a `MARRIAGE` table in `src/sim/rules.js`. | [backlog/VB-038.md](backlog/VB-038.md) |
| VB-039 | Food help from kin and the village commons | courting | implement | needs-review | 2 | M | A hungry household asks kin and the village for food; givers keep a personal buffer before they give. | [backlog/VB-039.md](backlog/VB-039.md) |
| VB-040 | Wrap-up: relationships and courting | courting | wrap-up | blocked | 3 | S | Long runs check marriage age, never-married share and help between kin against history; report. | [backlog/VB-040.md](backlog/VB-040.md) |
| VB-041 | Plan: claims, ownership and territory | claims | plan | needs-review | 2 | S | Settle the claims model, the scope model and the overlay filters so the claims tasks become ready. | [backlog/VB-041.md](backlog/VB-041.md) |
| VB-042 | Tile claims, realised and unrealised | claims | implement | needs-review | 2 | M | Any entity can hold a claim on a tile it does not own: realised (in force) or unrealised (wanted). | [backlog/VB-042.md](backlog/VB-042.md) |
| VB-043 | One scope model: a membership graph of entities | claims | implement | needs-review | 3 | M | A scope (level, entities, dimension) asks one membership graph for the tiles, stores or people it covers. | [backlog/VB-043.md](backlog/VB-043.md) |
| VB-044 | Overlay filters by scope, and claims on the overlay | claims | implement | needs-review | 3 | M | The ownership overlay can be filtered by any entity level and also shows claims. | [backlog/VB-044.md](backlog/VB-044.md) |
| VB-045 | Overlay cached per map chunk | claims | implement | needs-review | 3 | S | Draw the overlay per chunk and redraw only the chunks whose owners or claims changed. | [backlog/VB-045.md](backlog/VB-045.md) |
| VB-046 | Wrap-up: claims, ownership and territory | claims | wrap-up | blocked | 3 | S | Check owners, claims and the overlay at full scale; report speed and readability. | [backlog/VB-046.md](backlog/VB-046.md) |
| VB-047 | Plan: animals and husbandry | animals | plan | needs-review | 3 | M | Confirm the first version of herds, hay and the winter limit, then write the implement tasks. | [backlog/VB-047.md](backlog/VB-047.md) |
| VB-048 | Wrap-up: tune yields and the food balance of a farm | animals | wrap-up | blocked | 3 | M | With animals in, tune field yield, fields per farm and food from animals so a family of 6 is fed in an ordinary year. | [backlog/VB-048.md](backlog/VB-048.md) |
| VB-049 | Seed corn kept back for every field | food | implement | ready | 1 | S | Households set aside seed for all their fields before they eat, so a hungry farm can still sow. | [backlog/VB-049.md](backlog/VB-049.md) |
| VB-050 | Health: hunger drains it, and a starving pawn dies within a season | food | implement | ready | 1 | M | Each pawn has health 0–100; hunger drains it, fast at hunger 1, and health 0 is death. | [backlog/VB-050.md](backlog/VB-050.md) |
| VB-051 | Death causes by age, in their own module | food | implement | ready | 2 | S | Infants no longer die of "old age"; death causes and the death roll leave `sim/hunger`. | [backlog/VB-051.md](backlog/VB-051.md) |
| VB-052 | Indexes for children, spouses and holders | tooling | implement | ready | 1 | M | Keep indexes so family queries stop scanning every pawn ever born; the moving round drops from 2.6 s to under 0.3 s. | [backlog/VB-052.md](backlog/VB-052.md) |
| VB-053 | Refactor: page script into modules under lint | tooling | implement | ready | 2 | L | Split the 1,600-line page script in `src/body.html` into `src/page/*.js` modules that lint and greps cover. | [backlog/VB-053.md](backlog/VB-053.md) |
| VB-054 | State invariant checker in the long runs | tooling | implement | ready | 2 | M | A `checkState(st)` that asserts the simulation's invariants, run daily in the long test runs. | [backlog/VB-054.md](backlog/VB-054.md) |
| VB-055 | Type checking of the JavaScript with checkJs | tooling | implement | needs-review | 3 | M | Run the TypeScript checker over the plain JavaScript, with JSDoc types for `st` and `w`, to catch misspelt fields. | [backlog/VB-055.md](backlog/VB-055.md) |
| VB-056 | Lint: the page only reads the simulation state | tooling | implement | ready | 2 | S | A lint rule fails when the page script writes to `st` other than through the allowed flags. | [backlog/VB-056.md](backlog/VB-056.md) |
| VB-057 | Golden text of the page's panels | tooling | implement | ready | 3 | S | Record the text of every panel for a fixed seed and day, so unintended UI changes fail the verify run. | [backlog/VB-057.md](backlog/VB-057.md) |
| VB-058 | The village green and well, built by the village | expansion | implement | needs-review | 2 | M | A village that gains a second farm lays out a green and digs a well; they are not created automatically. | [backlog/VB-058.md](backlog/VB-058.md) |
