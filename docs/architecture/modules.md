# Modules: where each system lives

Moved from `AGENTS.md` (7 November 2026), which keeps the rules these systems impose (Conventions there), with where the
tunables live and how a job kind or a custom is added (Adding things, below). The module map is
`grep -rn "^// @sys" src`, the state schema `grep -rn "@state" src`, and who writes each field `docs/architecture/ownership.md` and
`node tools/writes.js`. Keep this list current when a module changes purpose.

- `VB['sim/events']` (VB-229): `on(kind, fn)` at load, `emit(st, kind, data)` calls the subscribers at once in load order; they cannot veto. A
  lower layer's act reaches a higher one this way; `node tools/events.js` lists each kind's emitters and subscribers (`tests/events.js`).
- `VB['sim/registry']` combines load-time rule declarations and ordered contributions; `value` creates no per-call containers or closures.
  `explain` checks finite outputs and contribution ranges and reports each factor, the combination, the raw result and clamp bounds.
  The million-read heap test checks retained memory after GC; it does not prove zero temporary allocations in provider callbacks.
  Modules declare an owned rule or contribute a factor/term before the first seed/load, which seals the registry; rules never enter saved state.
- `ArchGen.generate(seed)` (`src/gen.js`) makes the world `w`: per-tile typed arrays, regions, and the chunk bake, painted as a church mural's
  ground (flat pigments under the relief's light, a contour on the coast); `src/gen/marks.js` draws what stands on it (trees, stones, humps, crags).
  Rivers (`w.river`, `w.riverTo`) and their fords (`w.crossing`) are traced and drawn by `src/gen/rivers.js`, listed before `gen.js`, which calls it.
  What lies in the ground is laid by `src/gen/geology.js`, called the same way: bedrock (`w.rock`) in provinces, with lenses of marble and
  soapstone, and finite deposits of clay and ores (`w.deposit`, `w.depositLeft`) as veins, each island drawing which kinds it has
  (`PROVINCES`, `VEINS`; `node tools/geology.js` reports the shares). Nothing digs yet. `src/sim/prospect.js` keeps what each village
  has found of the hidden upland ores (`st.finds`; `w.vein`, `w.veinNear`): a finished job near a vein may find it (`sim/agents` calls
  `worked`); `Sim.knowsDeposit` and `Sim.depositKnown` are the views' reads. They are shown by the tile panel
  and the Ground overlay (`src/page/ground.js`: bedrock tints, deposit marks and a key, drawn once a world; the map bar, key O).
  The climate of a world is `src/gen/climate.js` (VB-342), also called by `gen.js`: it erodes the relief, draws the seed's wind (`w.wind`),
  carries rain over the map on it (`w.rain`) and deals the tiles' moisture (`w.hm`) out by that rain, so biomes follow the weather; its
  numbers are `CLIMATE`. Nothing in play reads the wind or the rain yet.
  What a tile's cover holds (a wood's trees at full cover, a meadow's stones) is `src/gen/cover.js`, read by `gen.js` as it lays the land.
- The archipelago editor is `src/page/editor.js`: a world alone on the stage with no run (`edit`, page state as the showcase island is), its
  tools' panels in one scene, Regenerate, and Play, which calls the loader's `build` with the generation options and `apply(wd)`. The
  terrain brush changes a world only before a run is seeded on it, through `VB['gen/cover'].set` (a land tile's cover) and the geology's
  `setDeposit` and `reveins`; what was painted is kept as tile maps and laid again on the land raised anew. The Settlement tool (`src/page/editplace.js`)
  settles by a scenario, or by hand: `Sim.seed(w, seed, 'manual', places)` (`sim/scenarios`, seedManual; `tests/manual.js`) lays each place in order, a
  village by the generator or a household on its very tile (`sim/byhand`, farmAt, which joins it to a village whose centre is within
  `SETTLE.centreApart`), with people as in Populous. A field or a meadow placed is of the farm nearest within `HAND_REACH`
  (`sim/byhand`, fieldAt; `sim/meadows`, meadowAt), and a road is wear laid as a lane (`sim/paths`, layWay), drawn or found by `findRoute`. The editor shows that run, standing still (`still`), and puts the world back
  (`gen/cover`, keep and restore) before it is painted or seeded again. A game begun there is
  `unsaved`: a save rebuilds its world from seed and size alone (`tests/browser-editor.js`).
- Walking: `src/sim/routes.js` holds the cost of each tile (terrain, fords, worn paths; rivers are closed but at a ford or bridge), the A* route
  search, `reachCosts` (one Dijkstra from a green to many, for the table of walking hours between villages, `st.villageHours`, VB-286),
  the route cache and `walkable(w)`, the rule every reach search (`bfs`) uses. `src/sim/paths.js` counts and fades worn paths
  (`w.wear`, `w.worn`) and wears in generated villages; `src/gen/paths.js` draws them into the map chunks.
- `Sim.seed(w, seed, scenario)` (`src/sim/scenarios.js`) makes the state `st`; `Sim.advance(st, hours)` (`src/sim/clock.js`) runs it, by whole 6-minute steps only: any other number of hours is refused with an error (VB-244); the page keeps the part of a step and draws the pawns between steps.
  What runs, and in what order, is one table in `src/sim/clock.js`, `CALENDAR` (VB-241): each entry an `every` (step, hour, day, season,
  year), an `at` within it (hour, tick, season, sday, doy), a guard `when` that is not a date, an owner module, `run` and a note. Each step walks
  it once, in order; a module tests no date to decide whether its daily, seasonal or yearly work runs. `node tools/sim.js --report calendar` prints it.
  Scenarios: `founders`, `heirs`, `populous`. All build villages through `settlementGenerator` in `src/sim/layout.js`: cluster villages,
  a farm at a time round the green, each house where its land is best, its fields one block beside it and outward of it. `src/sim.js` only assembles the `Sim` object from the `src/sim/*` modules.
- Food quantities and paid stakes (VB-174): `src/sim/stores.js` owns grain, meals, sheaves and food ledgers.
- Fresh food and the pot (VB-119): `src/sim/pot.js` owns `household.fresh` (fish and gathered food in batches by day, lost past their shelf life when the store is next touched) and cooks the pot (fresh food, dried fish in winter, grain, and the seed a short household would eat, VB-388; a pot of several sources goes further), moving food through `sim/stores`; `sim/drying` lays the catch for the pot beyond what is eaten before it spoils by the rack (VB-388).
- The hand quern (VB-009): `src/sim/quern.js` owns `household.quern` (`{rock, made}`, worn out `QUERN.years` after `made`, read in closed form), grinds grain to `household.flour` (a store of `sim/stores`) and hews a new quern from a load of the heap (`grind`, `hewQuern`); the pot cooks flour 1:1 and grain unground at `ECON.unground`; the quern is a good of the fair (worth 25).
  Meals are cooked by `cook` from a food of `FOODS` (`src/sim/rules.js`), by its worth in rations (VB-259).
  Call operations with a good and a reason; signed ledger entries distinguish goods and pawn stakes. Owed shares stay in heirs/cottage.
- Animals (VB-131 to VB-138): `src/sim/herds.js` (herds of named cattle and counted sheep, spring breeding, each scenario's herds, cows in milk, the team of oxen), `src/sim/meadows.js` (hay meadows and haymaking, only while hay is wanted), `src/sim/byre.js` (the stall period, the autumn count, slaughter, salting, milking, the dung heap, an unherded herd in a crop), `src/sim/grazing.js` (VB-136: herding, the day's pasture, the herds out with the herder, the grazing pressure `w.graze`, halving each year in closed form); the larder of stored food and grain spoiling in store are in `src/sim/hunger.js`; soil, manure and how many fields a household wants in `src/sim/fields.js`. Design and plan: `docs/review-animals.md`; balance and history: `docs/review-balance.md`.
- Carts (the distance review, 12 November): `src/sim/carts.js` (hand carts and ox carts as a household's items, `household.carts`; the load
  a pawn takes and its pace; wear, mending and the end of a cart; the head's count of misses, `household.cartMiss`, and the cart built as a
  project at the house; its tunables `CART`, with `TRAVEL` in `src/sim/rules.js`). `sim/agents` asks it at each load, `sim/kinds` takes its
  kinds (`cart`, `mendcart`) and the hay's loads from it, `sim/building` fells its timber, `sim/clock` runs its winter count.
- Journeys (VB-287; design.md, Between villages): `src/sim/agents.js` owns `st.journeys` and `st.journeySeq`. `sim/heirs`' `moveTo`
  changes the household at the act and hands the pawn to `moved`: within a village it walks to the new door; to another village it sets
  out on a journey, its provisions (`TRAVEL.dayWalk` hours a ration) taken from the household it leaves through `sim/stores` (reason
  `journey`), a leg a day from 6:00 to 18:00 as due entries the calendar reads at 6:00 (`dueJourneys`) and stops at 18:00
  (`stopJourneys`); on the road it eats what it carries (`feedTravellers`, through `sim/hunger`'s `ate`), out of its household's meal.
- Claims (VB-042, VB-155 to VB-158, VB-033): `src/sim/claims.js` (claims on tiles: strength, lapse, disputes by custom), `src/sim/territory.js` (the
  village's outland, borders and cairns), `src/sim/stakes.js` (a field or meadow project stakes its tile; contests) and `src/sim/farmclaims.js`
  (empty farms: the birthright, claimants by custom, restoration and moving in). Design and plan: `docs/review-claims.md`.
- Project plans (VB-123): a holder's plan of steps in `st.plans.projects` (a household's new field or meadow, a village's plot with its
  cottage, a claimant's restoration of an empty farm), read through `src/sim/projects.js` (loaded just after `sim/records`, so every module
  may read it) and written only by `src/sim/plans.js` (which also judges a plan `impossible` and words its dropping), which hears the lower modules by events: `projectBegun` (a plot, `sim/expansion`; a
  claim, `sim/farmclaims`), `stepDone` (`sim/fields`, `sim/meadows`, `sim/expansion`, `sim/cottage`, `sim/farmclaims`), `rightLost` (a stake
  or a farm's claim lost, `sim/stakes`, `sim/farmclaims`) and `storeShort` (`sim/stores`). A step's reservation is a `build` reservation
  of `sim/stores`. Old saves' farm projects, plots and claims become plans at load (`sim/saves`, `oldProjects`).
- Names (VB-026): `src/sim/names.js` holds the generators (farms by compass, landmark, owner; villages by syllables or founder) and each culture's
  order of preference (`c.namePrefs`); a lone farm's village bears its farm's name, and the page labels a village of two or more farms once.
- Households short of people (stability review, `docs/review-stability.md`): `src/sim/service.js` brings a guardian to an orphaned minor heir and a
  servant to a holder who lives alone; a household of at most one grown member whose ask for food falls short (`shareFood`, `src/sim/help.js`,
  names it) takes in kin, else a servant, at once (`takeIn`, VB-308), and with nobody to come, its people go to their nearest kin household,
  which holds the farm in trust (`src/sim/trust.js`, VB-309: `st.trusts`, the verbs `goToKin` and `goBack`; the trustee posts the farm's
  field work as its own in `src/sim/jobs.js`, and `src/sim/ownership.js` reads which farms are held); an orphaned heir with no guardian is
  held for the same way; at the moving round a landless adult from a household with hands to
  spare goes into service where labour is short, by hands per field (`serveWhereShort`, VB-090; the placement `reachSteps` is shared); marriage of two holders, handing a farm on (`handOn`) and the means to marry are in `src/sim/lifecycle.js`
  and `src/sim/heirs.js`.
- Saves (VB-074): `Sim.save(st)` and `Sim.load(w, data)` in `src/sim/saves.js`; a generic codec keeps shared objects, Maps, Sets and typed
  arrays, and the tiles the simulation changes are saved with the state (its `WORLD` list: a new world field the simulation writes goes there).
  `st` is plain data (VB-073, `tests/plaindata.js`): no functions, and no state kept aside in module closures, or a loaded run drifts
  (`tests/saves.js` catches it). A loaded run matches the unbroken one given the same `Sim.advance` calls.
- The record of events (VB-075): `st.record`, typed events written by `log(st, text, event)` and `personEvent(...)` in `src/sim/records.js`
  (`false` when another call records the same happening); `Sim.recordOf(st, {pawn, household, farm, village, kinds, from, to})` queries it.
  A new log line names its event's kind, pawn and place (`atHousehold`, `atFarm`); `tests/record.js` checks every call.
  Bounded history (VB-199): `pawn.events` holds positions in `st.record`, read with `Sim.recordOf(st, {pawn, life: true})` (`sim/notable`,
  `lifeOf`); a new kind of event goes into `HISTORY` (`sim/records`), 0 to keep it or the years after which `foldHistory` folds it into
  `st.recordYears`, one count per kind, village and year (a folded slot of the record becomes its count's index; slots are never removed).
- Relationships (VB-127, VB-240): `src/sim/relations.js` owns familiarity (`pawn.ties`, on a decay scale per pawn), memories of events
  (`pawn.rel`, kinds of `SOCIAL.memories`, written by `remember`; a record exists only while it holds one) and the close-friend and enemy
  bands (`pawn.bands`). Opinion is derived when read (`opinionOf`): kin standing, plus affinity (the pair's compatibility, shown as the tie
  grows), plus the memories. Talk grows the tie only; its kind is the bubble's. A band is checked by `touch` where a pair's tie or memories
  change (a talk, a job together, the day's hours at home, the kin floor, `remember`, the season's pass), never by a pass over pairs.
- Occasions (VB-126): `src/sim/occasions.js` calls a gathering at a place from a start to an end (the village meeting on the green on autumn
  day 10, a wedding the day after a marriage, a funeral ale the day after a death), asks its guests and keeps `st.occasions`, a due-queue the
  six-minute step reads at its head only. Those asked set out by the verb `attend` and stand about the spot until the end (`agent.occasion`);
  talk there is talk as anywhere. The gathering of villages (VB-295) is the next kind.
- Notable events (VB-098): `Sim.notable(st, ev, about)` in `src/sim/notable.js` gives the reasons a record event is notable (keys of
  `Sim.NOTABLE`: family, holder, hunger, farm, custom) or null, for the pawn the player follows; `Sim.eventLine(st, ev)` tells an event in one
  sentence. A read-only view with no state. The page's toasts (`src/page/notices.js`) read both; a new notable kind is added there, not in the page.
- Opportunities (VB-209): `Sim.opportunities(st, id, near)` (`src/sim/opportunities.js`) lists what a pawn may do here, each a command with its
  holder, basis and the rule that bars it: its household's and village's work (from the kinds' `available`, with the planner's fit), its own
  acts, a cause, and the moving round's acts. Computed when asked, never stored; it reads through `actorView`, which filters nothing yet. A rule
  it shows says why not itself (`staysWhy`, `barred`, `unfit`, `fit`): a new bar is added to the rule, not here.
- The chronicle (VB-099): `Sim.chronicle(st, {pawn | farm | village}, group)` and `Sim.villageLog(st, n)`, also in `src/sim/notable.js`, are the
  record as a history, newest first, and as the village log (`st.events` is gone: `log` writes the record only). `CHRONICLE` names the
  filters by kind; a new event kind that belongs to one is added there. The History tab of the selection card is `src/page/history.js`.
- Customs on the page (VB-396 to VB-398): `src/page/customs.js` is the Customs tab of a village's card, the customs as sentences (`SAID`; a
  new custom or option gets its phrase there), who stands by which way, and a voice's note (its pulls from `src/sim/leanings.js`, a
  read-only view, weighed by `Culture.WEIGH`, the factors the daily drift itself reads, so the note and the drift cannot disagree); `src/page/culture.js` is the dock's Culture pane: a culture's villages, its own charter, the meetings.
- Commands (VB-167 to VB-171): `src/sim/commands.js` holds the verbs (`work`, `walkTo`, `goHome`, `idle`, `attend`; `decide`; `marry`, `handOn`, `serve`,
  `claim`, `leave`; debug `kill`, `retire`, `argue`, `rally`, `skip`). The planner, the meeting, the moving round and the debug drawer act by
  `issue(st, {actor, verb, target, args, source})` (`Sim.command` for the page); a verb checks that the act is possible and returns why not.
  A new act a pawn or the round chooses gets a verb; `tests/commands.js` checks statically that only the verbs call the acts they wrap.
  The player (VB-169) is one more source: `st.player` holds the inhabited pawn and its queue, written by `Sim.inhabit`, `uninhabit`, `queue`,
  `unqueue` and `setAuto`; `playerStep` issues the queue's head each step, and the planner's sites ask `commanded` and `unplanned` before they
  move a pawn (`tests/player.js`). The page plays it in `src/page/play.js` (VB-210, VB-221): the Actions sheet of the bottom bar, shown
  while a pawn is played, with `Sim.opportunities` once per rebuild while it is open, Walk here, Give grain (the verb `give`, after
  `Sim.giftWarning`), Follow and its mark on the map; Play as and Stop playing are the Debug panel's. Follow, the tile or household being
  chosen and the gift's draft are page state, never `st`.
- Membership (VB-175): `sim/records` alone writes household members, a pawn's household and service (`joinHousehold`,
  `leaveHousehold`, `clearMembers`, `setServant`). Death retains the last household on the historical record.
  `sim/membership.foundHousehold` creates, supplies, owns and populates a farm's household; restoration reaches it by the
  `foundHousehold` command, and a completed plot reaches `sim/cottage` by `finishCottage`.
- `Culture` (`src/culture.js`) holds customs: culture-wide customs, per-settlement practice, per-person attitudes.
- Saves in the page (VB-214) are `src/page/saves.js`: `{build, savedAt, label, save: Sim.save(st)}`, gzipped, in IndexedDB (an auto slot and
  three by hand for each archipelago) or a file; the build id is written by `build.py`, and a save of another build is refused by the
  page, not by `Sim.load`. The landing page and the loader (`src/page/loader.js`) lead to it; it keeps nothing in `st`.
  With no game open, the loader raises a tiny showcase island behind the menu screens, on one of a pool of seeds (VB-307; `demo`, page state): a run of its own at 3x,
  never saved and never a game to go back to; `build` drops it.
- The page script (`src/page/*.js`) draws and only reads `st`. It writes to `st` through the `Sim` API and three flags:
  `visualDirty`, `naturalDeaths`, `driftMul` (and it clears `rigDirty`, `treeDirty`, `biomeDirty`, `pathDirty` and `landDirty` after redrawing); the lint enforces this.
- `src/vb.js` creates the `VB` namespace; `src/load.js` loads the modules in Node for the tests.
- Review tools (VB-337), outside the simulation: `tools/hours.js` (`node tools/sim.js --report hours`) samples a run's agents and fields at
  every step for a household's pawn-hours by job kind and the farming year's days; `tools/stocks.js` maps each stored quantity's adders,
  takers and readers from the writes map (`tools/writes.js`), with a hand-written line a quantity on what happens at none.

## Layers (VB-230)
Each module's layer is in `src/layers.json` (a module without one fails `npm test`); target-v2 3.1 gives the rule: calls go downward, reads are
free, influence goes upward by a command, an event or a hook. Composition roots stand apart: `sim/clock`, `sim/saves`, `sim/scenarios`, `sim`.
- Kernel and world: `vb`, `gen`, `gen/*`, `sim/rules`, `sim/registry`, `sim/events`, `sim/rng`, `sim/hex`, `sim/names`, `sim/routes`, `sim/paths`,
  `sim/fish` (a river's stock, no actors), `sim/layout`, `sim/forest`, `sim/people`, `sim/records`, `sim/commands`.
- Material and land: `sim/projects` (the project plans' record and reads, VB-123; `sim/plans` writes them), `sim/stores`, `sim/pot`, `sim/hunger`, `sim/quern`, `sim/fields`, `sim/meadows`, `sim/byre`, `sim/carts`, `sim/grazing`, `sim/herds`, `sim/ownership`, `sim/claims`,
  `sim/stakes`, `sim/territory`, `sim/expansion`, `sim/building` (the cottage's stages as kinds, and what building takes: timber, VB-328),
  `sim/green` (the village green and well as a project plan of the village and its job kinds, a village duty, VB-058).
- Social: `culture`, `sim/relations`, `sim/society`, `sim/deaths`, `sim/births`, `sim/heirs`, `sim/membership`, `sim/cottage`, `sim/settle`,
  `sim/farmclaims`, `sim/service`, `sim/matching` (marriage rules), `sim/occasions` (gatherings), `sim/workdays` (the village's work days,
  a routine of its meeting: the fence closed in spring, the commons cleared in summer, who turned out and who stayed away, VB-120).
- Agency: `sim/agents`, `sim/trust` (farms held in trust by kin, VB-309), `sim/jobs`, `sim/kinds`, `sim/exchange`, `sim/help`, `sim/lifecycle`, `sim/eligibility`, `sim/plans`.
- Derived views: `sim/notable`, `sim/opportunities` (read-only, computed when asked).

## Adding things
- A module has no cap on its length (VB-413): over 700 formatted lines (`src/` is formatted by Prettier, `npm run format`) the lint asks for an open task titled "Refactor: split <key> ...", opened by the task that
  takes it there (VB-414). The same task is asked for when a module over 15 exports gains one (VB-415; the `sim` facade is not counted). Put code where its concern lives, not where there is room.
- Tunables: `ECON`, `FIELDS`, `ROLES`, `MARRIAGE`, `SOCIAL`, `SHARES`, `MATCH`, `HERD`, `SOIL`, `RIVER`, `TERRAIN`, `SLOPE`, `ROUTE`, `PATHS`, `SETTLE`
  and `SERVICE` in `src/sim/rules.js`; `KINDS` (job kinds) in `src/sim/kinds.js`; `RIVERS` and `FORDS` in `src/gen/rivers.js`; `LOOK`
  (worn paths) in `src/gen/paths.js`; `DIMS` and `ARCHETYPES` in `src/culture.js`.
- A new job kind is one record in `KINDS` (`src/sim/kinds.js`): numbers, type of work, labels, where to stand, urgency, and what finishing
  and delivering do. It is posted from `refreshJobs` (`src/sim/jobs.js`); roles rank types of work (`work` in `ROLES`, with `except` for
  single kinds), so a kind of an existing type needs no role numbers. Its `anim` names an animation in the page script.
- Something that runs at a time (each step, hour, day, season or year, or on a named day or step) is one entry of `CALENDAR` in
  `src/sim/clock.js`, inserted where it should run in the order; `tests/clock.js` holds that order (`ORDER`, re-recorded on purpose).
- A new stored quantity (a household's, a farm's, a village's or a tile's) adds its line to `QUANTITIES` in `tools/stocks.js`, with
  what happens when there is none; `tests/review-tools.js` fails for a field of the `@state` lines in neither its lines nor `NOT_STOCKS`.
- A new crop is one row of `CROPS` in `src/sim/rules.js` (VB-346): `yield`, `seed`, `sow` ([season, first day, last day]), `ripe` (days from
  sowing), `wear` (the soil a harvest takes) and `hours` (plow, sow, weed, reap, thresh). A field holds
  the key as `fd.crop`; `sim/fields` and the kinds read the field's row, never a constant. The KINDS hold barley's hours (`CROPS.barley.hours`), and a
  field's job carries its crop's hours where they differ (VB-348). Optional keys (VB-348): `winter` (stands the frost), `lost` ([season, day] a ripe
  field still standing is lost), `weeds` (rounds of weeding, else one every `ECON.weedEvery` days). A row without `seed` is a course, not a crop:
  `fallow` (tilled in its `sow` window, `mend` to the soil at the year's end); `sim/stores` holds as grain only the rows with seed (`CROP_LIST`).
  The table is a plain constant, never in saved state.
- A new custom adds a `DIMS` entry (its `key` and `opts`) and a value in each `ARCHETYPES` entry; offsets are computed from `DIMS`.
