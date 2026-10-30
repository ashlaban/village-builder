# Backlog

Tasks for the village builder proof of concept. The nightly run takes only `Status: ready` tasks, in priority order (1 first), then ID order. Design refs point to sections of `design.md` ("Village builder: game design snapshot v0.3").

Each task has its own file, `backlog/VB-NNN.md`, which holds the full description and is the source of truth. The table below is the overview: when a task's name, status, priority or size changes, update its row too. A new task takes the next free ID, gets a file and a row.

A task is `ready` only when it needs no design decision: the goal, numbers and acceptance criteria are all stated. `needs-review` tasks list the questions Kim must answer first.

Refactor rules (every task titled "Refactor:"):
- Behaviour is unchanged: `npm test` passes and `tests/golden.json` (VB-011) is unchanged. Rebuild `index.html` before committing.
- Code moves verbatim apart from the module wrapper, the dependency lines at its top and its return list. Lines over 160 characters in moved code are wrapped at statement or argument boundaries; nothing else is reformatted.
- No renames: functions, state fields and the `Sim`, `ArchGen` and `Culture` APIs keep their names, so backlog references and greps stay valid.
- A new module follows the VB-012 convention, starts with an `@sys` header (VB-013), is listed in `src/manifest.json` after every module it reads, and stays under 400 lines.
- Depends on VB-011 to VB-015; if any is not done, mark the task blocked.

Once VB-011 is done, a non-refactor task that changes behaviour on purpose re-records the golden file with `node tests/golden.js --update` and lists the changed entries in its PR.

## Tasks

| ID | Name | Status | Priority | Size | Summary | File |
|----|------|--------|----------|------|---------|------|
| VB-001 | Make the test suite fail on regressions | done | 1 | S | Add assertions so `npm test` fails when the sim or page breaks. | [backlog/VB-001.md](backlog/VB-001.md) |
| VB-002 | Clock shows game time in 5-minute steps, apart from the simulation step | done | 1 | S | UI clock follows game time in 5-minute steps, redrawn every frame. | [backlog/VB-002.md](backlog/VB-002.md) |
| VB-003 | Every farm in a village, and an owner for every tile | blocked | 2 | M | Lone farms become one-farm villages; a per-tile owner map. | [backlog/VB-003.md](backlog/VB-003.md) |
| VB-004 | Ownership map overlay | blocked | 3 | S | Toggle overlay that tints each owned tile by its owner. | [backlog/VB-004.md](backlog/VB-004.md) |
| VB-005 | Trees per wooded tile | done | 2 | M | Forest tiles hold trees; firewood fells them, they regrow, 0 becomes meadow. | [backlog/VB-005.md](backlog/VB-005.md) |
| VB-006 | Stones on meadow tiles | done | 2 | S | Meadow tiles track stone content for field-making and building stone. | [backlog/VB-006.md](backlog/VB-006.md) |
| VB-007 | Tilling and threshing as multi-day work | done | 2 | M | Tilling takes several days per field; harvest gains a threshing step. | [backlog/VB-007.md](backlog/VB-007.md) |
| VB-008 | Summer upkeep of growing fields | done | 3 | S | Growing fields need weeding; neglect lowers the yield. | [backlog/VB-008.md](backlog/VB-008.md) |
| VB-009 | Hand-quern milling and making rations | blocked | 3 | M | Grind grain to flour on a hand quern and cook rations from it. | [backlog/VB-009.md](backlog/VB-009.md) |
| VB-010 | Founders start on unmade land and make their fields | ready | 3 | L | Founders start without fields and claim, clear and break meadow. | [backlog/VB-010.md](backlog/VB-010.md) |
| VB-011 | Golden-state test for world, simulation and calibration | done | 1 | S | Fingerprint world and sim output so refactors provably change nothing. | [backlog/VB-011.md](backlog/VB-011.md) |
| VB-012 | One module list, a module namespace and a Node loader | done | 1 | M | One module list, a `VB` namespace and a Node loader for tests. | [backlog/VB-012.md](backlog/VB-012.md) |
| VB-013 | Structure lint: module headers, file and line length | done | 1 | S | Lint module headers, file length and line length. | [backlog/VB-013.md](backlog/VB-013.md) |
| VB-014 | CLAUDE.md, a short guide for agents | done | 1 | S | Write CLAUDE.md, a short guide for agents. | [backlog/VB-014.md](backlog/VB-014.md) |
| VB-015 | State schema as greppable tags | done | 1 | M | Document every `w` and `st` field with greppable `@state` tags. | [backlog/VB-015.md](backlog/VB-015.md) |
| VB-016 | Refactor: sim rules, hex helpers and village layout into modules | done | 1 | S | Move sim rules, hex helpers and village layout out of `src/sim.js`. | [backlog/VB-016.md](backlog/VB-016.md) |
| VB-017 | Refactor: family records and agents into modules | done | 1 | S | Move family records and agents out of `src/sim.js`. | [backlog/VB-017.md](backlog/VB-017.md) |
| VB-018 | Refactor: job board and inheritance into modules | done | 1 | S | Move the job board and inheritance out of `src/sim.js`. | [backlog/VB-018.md](backlog/VB-018.md) |
| VB-019 | Refactor: culture wiring and the yearly round into modules | done | 1 | S | Move culture wiring and the yearly round out of `src/sim.js`. | [backlog/VB-019.md](backlog/VB-019.md) |
| VB-020 | Refactor: scenarios and the clock into modules; `Sim` as a facade | done | 1 | S | Move scenarios and the clock out; `Sim` becomes a facade. | [backlog/VB-020.md](backlog/VB-020.md) |
| VB-021 | Map generation screen with size, seed and starting scenario | done | 3 | L | Start screen for map size, seed and scenario; Populous Villages; shared generators. | [backlog/VB-021.md](backlog/VB-021.md) |
| VB-022 | Daily meals that always happen (unblocks VB-009) | needs-review | 2 | S | Make the daily cook job reliable so rations cause no hungry days. | [backlog/VB-022.md](backlog/VB-022.md) |
| VB-023 | Heirs scenario: the one-person household and the longer tilling | needs-review | 2 | S | Decide whether a one-person heirs household should fail to till its fields. | [backlog/VB-023.md](backlog/VB-023.md) |
| VB-024 | Wood supply: how fast the forest runs out | needs-review | 3 | S | Report how fast villages fell their woodlots; decide whether to retune. | [backlog/VB-024.md](backlog/VB-024.md) |
| VB-025 | Browser smoke test in real Chromium | needs-review | 3 | M | Playwright smoke test of `index.html` in real Chromium. | [backlog/VB-025.md](backlog/VB-025.md) |
| VB-026 | Farm names in big villages | needs-review | 3 | S | Choose a naming rule for farms beyond the direction names. | [backlog/VB-026.md](backlog/VB-026.md) |
| VB-027 | Births within marriage | done | 2 | M | Married women conceive, give birth and nurse; infant and child mortality. | [backlog/VB-027.md](backlog/VB-027.md) |
| VB-028 | Hunger has consequences | done | 2 | M | Hunger raises death risk, slows work, postpones marriage and births; `feedOrder` custom. | [backlog/VB-028.md](backlog/VB-028.md) |
| VB-029 | Marriage limit by degree, opening up when spouses are scarce | ready | 2 | M | `kinOk` judges by civil degree; scarcity of spouses loosens the custom. | [backlog/VB-029.md](backlog/VB-029.md) |
