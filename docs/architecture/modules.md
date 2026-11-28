# Modules: where each system lives

Moved from `AGENTS.md` (7 November 2026), which keeps the rules these systems impose (Conventions there), with where the
tunables live and how a job kind or a custom is added (Adding things, below). The module map is
`node tools/modules.js` (by layer, from the `@sys` lines; or `grep -rn "^// @sys" src`), the state schema `grep -rn "@state" src`, and who writes each field `docs/architecture/ownership.md` and
`node tools/writes.js`. Every source module is listed once in the build manifests, or is the Node loader, and has a first-line
`@sys` declaration naming its responsibility and its layer. `npm test` checks that coverage. No list of the modules or of the
systems is kept here (VB-1941): a module's entry is its `@sys` line, and a new module or system adds nothing to this file. The notes
this file kept until then, how the systems that span modules fit together, are `docs/architecture/systems-2026-11.md`, a snapshot of
28 November that is not edited.

## Layers (VB-230)
Each module's layer is the tag of its first line, `// @sys key [layer]: what it owns` (VB-1941; a module of the manifest without one fails
`npm test`); `src/layers.json` holds only the layers' names, lowest first, and the composition roots, which have none and stand apart:
`sim/clock`, `sim/saves`, `sim/scenarios`, `sim`. The modules of a layer: `node tools/modules.js [--layer NAME]`, built from those lines,
or `grep -rln "^// @sys [^ ]* \[agency\]" src`; no list of them is kept here. target-v2 3.1 gives the rule: calls go downward, reads are
free, influence goes upward by a command, an event or a hook.
- Presentation (VB-1503): `draw/*`, the map's drawing, listed after `sim.js`. They read the world, and the bake a world's paint (VB-1504);
  no generator or simulation module names them (`tests/dependencies.js` refuses it, as an upward call and as a lookup of a later module).
  The page reads them by key.

## Adding things

Each kind of thing has one declaration, by the module that owns it, beside its code; a registry or a tool joins the declarations in
a declared order, never by load order (target-v2, principle 20; VB-1406). Where that one declaration goes, today and once its step
of VB-1406 has landed (`docs/plans/VB-1406-overlap.md`, section 5); until then, the list named "today" is still edited:
- **A module**: its `// @sys key [layer]: what it owns` line, which gives its layer (VB-1941) and its line in the module map
  (`node tools/modules.js`). Today also its line in `src/manifest.json` (after every module it reads); after VB-1943 the order is derived
  from the module's load-time reads. Find them: `grep -rn "^// @sys" src`.
- **A state field**: its `@state` line in the owning module (`grep -rn "@state" src`). Today also its line in `src/owners.json`;
  after VB-1942 the owner is the module that carries the line, with a marker for a cache and for a field documented elsewhere.
  A field that is no stored quantity is tagged `// @notstock FIELD: why` beside it (VB-1941; `grep -rn "@notstock" src`); a stored
  quantity still has its line in `QUANTITIES` of `tools/stocks.js`, with what happens at none.
- **A test**: a header line `// @suite fast|integration|extended [node:FLAG] [ARG]` in the test file, a line a tier and argument
  set, among the comment lines it opens with (VB-1933; `grep -rn "^// @suite" tests`); `tests/suites.js` is not touched.
- **A work counter**: declared at load by the module, beside the loop it counts, `VB.counter(name, meaning)` (VB-1934;
  `grep -rn "VB.counter('" src`); `VB.COUNTERS` joins them in load order, and `src/vb.js` holds none.
- **A tunable**: a table one domain reads, in that module with its `// @tunable NAME: meaning` line (`grep -rn "@tunable" src`); a
  table several read, in `src/sim/rules.js` until VB-1947 moves them into files by domain, `VB['sim/rules']` staying the joined view.
- **A migration** (what fills a field an older save lacks): today a line in `load` of `src/sim/saves.js`; after VB-1945 registered
  by the field's owner, run by `sim/saves` in a fixed order.
- **An event kind**: today its years in `HISTORY` (`src/sim/records.js`), its group in `CHRONICLE` and `PERSONAL` and its skip stop
  in `src/sim/notable.js`, its icon and its word on the page; after VB-1946 one record declared by the module that emits it.
- **A `Sim` name**: the module names what it gives the page in its namespace, `PAGE: ['name', ['nameOnSim', 'exportName']]` (VB-1944;
  `grep -rn "PAGE: \[" src`); `src/sim.js` joins the lists in load order, throws on a name given twice, and keeps only what it composes
  itself (the skip's aids, the reads through the actor view, `DEBUG`, `replay`). The width lint does not count a name given to the page alone.
- **A card's row** (a line of a person's, a farm's house or an open tile's card, a stat of a household on its farm's card): one
  `cardRow(card, place, row)` at load, in the feature's page file beside the code it shows (VB-1948; `page/cardrows`, which joins
  them by place, never by the order of `src/page.json`; `grep -rn "cardRow('" src/page`). The places are numbers with room between them;
  `tests/cardrows.js` fails for two rows at one place.
- **A style**: in the stylesheet of its area under `src/styles/` (the bar and panels, the cards and the meter, the screens, a theme
  each, the icons' sets), spliced by `build.js` in the order of `src/styles.json`, which is the cascade's (VB-1948); a new theme is a
  file of its own, listed after `mural.css`.
- Already declarations: a job kind (`KINDS`, joined by `sim/kinds`), a verb (`register` of `sim/commands`), an overlay
  (`registerOverlay`), a journey kind (`JOURNEYS`). A calendar entry stays a line of `CALENDAR` in `src/sim/clock.js`: there the
  order is the rule itself, declared in one place and held by `tests/clock.js`.

To time or count a function in Node, call `loadModules({ wrap })` from `tests/lib/load.js` before loading the simulation. Key each wrapper factory by module and export name, as in `tools/perf.js`.
- Put the module in its load list and name what it owns or supplies in the first-line `@sys` declaration. Describe the boundary
  in terms of the work and state the module handles. A module that changes another's state calls the owner's operations.
- A module has no cap on its length (VB-413): over 700 formatted lines (`src/` is formatted by Prettier, `npm run format`) the lint asks for an open line naming it in the split collector, "Refactor: module splits, collected", added by the task that
  takes it there with `node tools/backlog.js collect split where=<key> what=...` (VB-414; Kim, 25 November). The same line is asked for when a module over 15 exports gains one (VB-415; the `sim` facade is not counted, nor an export read only by a registry: a job kind's `done`, a calendar entry's `run`, a verb's body; the list is `REGISTRIES` in `tests/lint.js`, VB-454). Put code where its concern lives, not where there is room.
- Tunables: a table one domain reads lives in that domain's module with a `// @tunable NAME: meaning` line above it (VB-419;
  `grep -rn "@tunable" src`, the lint holds it for each table that left `sim/rules`); the tables several domains read (the calendar, `ECON`,
  `FOODS`, `HERD`, `TRAVEL` and the like) stay in `src/sim/rules.js`; `KINDS` (job kinds) in each domain's module, joined by `src/sim/kinds.js`; `RIVERS` and `FORDS` in `src/gen/rivers.js`; `LOOK`
  (worn paths) in `src/draw/paths.js`; `DIMS`, `ARCHETYPES` and `PRACTICES` in `src/sim/customs.js`.
- A new job kind is one record in the `KINDS` of the module whose state its work changes (VB-418): numbers, type of work, labels, where to
  stand, urgency, and what finishing does, beside the rules its `done` and `available` call (the field's kinds in
  `sim/fieldwork`, the byre's in `sim/byre`, the household's daily work at the house in `sim/chores`). How its task goes on is its
  `methods` (`sim/methods`; a helper's `trip`, `carry`, `bring`, `labour`): what a load is drawn as (`look`), the haul leg's words
  (`words`), its delivery (`deliver`) and work done indoors (`inside`) are said by the method's steps, never by fields of the kind
  (VB-1820); the field stages a field kind is asked at are `sim/fieldwork`'s `STAGES` (ASK.stages). A kind that takes from one module and
  puts into another lives in a module at or above the layer of both (their `@sys` lines), never in the lower one. `src/sim/kinds.js` is the
  registry: it describes a kind's fields, joins every module's `KINDS` in a fixed order (a new kind is added at the end: the order is part
  of saved state), and holds `ASK`, the order in which `refreshJobs` (`src/sim/jobs.js`) asks the kinds' `available`; a new kind gets its
  line in both. It holds no kind's record and no domain's rule. Roles rank types of work (`work` in `ROLES`, with `except` for single
  kinds), so a kind of an existing type needs no role numbers. Its `anim` names an animation in the page script.
  It declares `at`, `needs` and `gives` (VB-1124): where its work is done, of `PLACES`, and what it takes and makes, of `THINGS`, both
  in `sim/kinds` (a new place or thing is a line there); a name outside them fails at load, and the game's guide (`page/guide`) lists the kind.
- Something that runs at a time (each step, hour, day, season or year, or on a named day or step) is one entry of `CALENDAR` in
  `src/sim/clock.js`, inserted where it should run in the order; `tests/clock.js` holds that order (`ORDER`, re-recorded on purpose).
- A new stored quantity (a household's, a farm's, a village's or a tile's) adds its line to `QUANTITIES` in `tools/stocks.js`, with
  what happens when there is none; a field that is none is tagged `// @notstock FIELD: why` beside its `@state` line, in the same module;
  `tests/review-tools.js` fails for a field of the `@state` lines in neither its lines nor a tag.
- A new crop is one row of `CROPS` in `src/sim/crops.js` (VB-346): `yield`, `seed`, `sow` ([season, first day, last day]), `ripe` (days from
  sowing), `wear` (the soil a harvest takes) and `hours` (plow, sow, weed, reap, thresh). A field holds
  the key as `fd.crop`; `sim/fields` and the kinds read the field's row, never a constant. The KINDS hold barley's hours (`CROPS.barley.hours`), and a
  field's job carries its crop's hours where they differ (VB-348). Optional keys (VB-348): `winter` (stands the frost), `lost` ([season, day] a ripe
  field still standing is lost), `weeds` (rounds of weeding, else one every `ECON.weedEvery` days). A row without `seed` is a course, not a crop:
  `fallow` (tilled in its `sow` window, `mend` to the soil at the year's end); `sim/stores` holds as grain only the rows with seed (`CROP_LIST`).
  The table is a plain constant, never in saved state.
- A new resource on the Stores tab (VB-668, Kim 16 November) goes in one of three sections, by what the player wants to know of it: a
  **supply** is used up as time passes (how long does it last: a meter in days); a **material** is held until a work asks for it (is there
  enough for what is planned: a count, and where a project plan asks for it, its framed work block with held against asked on the one
  meter); a **gear** wears (what condition is it in). A material is one row of `MATERIALS` in `src/page/cards.js`, its kinds a list under
  the total, shown only where more than one is held; a work's asks are read from the project plan's `build` reservations.
- A new map overlay (VB-1496) is one file under `src/page/`, its line in `src/page.json` after `page/overlays.js` and before `page/input.js`,
  an icon in both sets of `src/page/icons.js` (`ICON` and `ICON_STEN`: the interface's own icons, not the kinds' of `src/page/kindicons.js`
  or the goods' of `src/page/goodicons.js`), and a key panel (`class="ground-key panel"`, `hidden`) beside the
  others over the minimap in `src/body.html`. The file ends with `registerOverlay({id, name, short, key, icon, group, set(on), refresh(), reset(), layer, keyEl})`:
  `set` shows or hides its layer and draws it, `refresh` runs every frame on or off, `reset` for a new world. With no `key` it takes the next
  free digit (6 to 9: 1 to 5 are the speeds; then Y, U and I). The overlay button, its list, the keys and `tests/browser-overlays.js` follow the registry: none
  of them names an overlay.
- A new custom adds a `DIMS` entry (its `key` and `opts`) and a value in each `ARCHETYPES` entry; offsets are computed from `DIMS`.
- A new set of icons (VB-1533; `line` and `stencil` today) is one entry of `ICON_SETS` in `src/page/icons.js` and its drawings, given
  by name where an icon is made (`drawings(svg, { stencil: ..., <set>: ... })`, drawn on a 24 box); an icon left without one shows its
  `line` drawing. In `src/styles/icons.css`, beside the stencil's, its one rule (hidden unless the root's `data-icons` names it, and then the
  `line` drawing beside it hidden) and the styles its shapes are drawn with; then a theme names it, the `icons` field of its entry in
  `THEMES` (`src/page/options.js`), which `applyTheme` puts on the root as `data-icons`. No rule of the icons names a theme.
  The drawings are in four files, by what they show (VB-1589), in this order in `src/page.json`, each reading only those before it:
  `src/page/icons.js` (the makers `svgIcon` and `drawings`, `ICON_SETS`, and the interface's own `ICON` and `ICON_STEN`),
  `src/page/kindicons.js` (the acts' and the job kinds': `ACT_PATHS`, `ACT_STEN`, `actIcon`, `KIND_ICON`), `src/page/goodicons.js`
  (the goods' and measures': `GOOD_PATHS`, `GOOD_STEN`, `goodIcon`) and `src/page/cardicons.js` (the seasons', traits', bonds', states'
  and occasions', several of them the goods' and the acts' drawings). A new set gets its drawings in each.
- A new theme (VB-1531) is two edits. An entry in `THEMES` (`src/page/options.js`): its key, `name`, `note` and the `icons` it shows; its
  card in Options, and `tests/page.js`'s walk of the themes, follow. And a block `[data-theme="<key>"] { ... }` in a stylesheet of its own, `src/styles/<key>.css`, listed after `mural.css` in `src/styles.json`,
  that sets every token listed at the head of the stylesheet, in one rule (`tests/themes.js` checks it); written without `:root`, it
  applies to any element with the attribute, so the card's sample (a panel, a head, a pressed and an unpressed button) is drawn in the
  theme whatever theme is on. Then its styling of the pieces (VB-1534), listed beside the tokens: panel, head, button (pressed and
  primary by one rule), icon button, row, card, meter. What the tokens cannot say is a rule in the theme's own section,
  `[data-theme="<key>"] .piece`, as Mural's medallion, leaf and beads; a rule there names a piece, or a component on the list's `counted:`
  line with its reason beside it (`tests/themes.js` checks it). The tokens are scales and plain meanings (VB-1535): a theme sets its
  three corners (`--r-0` to `--r-2`) and its three shadows (resting, raised, floating), not one corner a component; a value only one
  theme's piece would read is that piece's rule, not a token. A sample's panel carries the theme itself, so a theme's panel rule names
  it twice, `[data-theme="<key>"] .panel, .panel[data-theme="<key>"]`.
- A new component uses pieces (VB-1534): its markup carries `panel`, `head`, `icon-btn`, `row`, `card` or `meter` (a button is the
  element), a popup's opener `aria-haspopup` so that it shows pressed while open; its own rules carry layout (place, size, gaps), and
  corners from a step of the radius scale (or round, for a pill or a circle), its shadow from a step of the shadow scale, not a look
  a theme would want to change.
