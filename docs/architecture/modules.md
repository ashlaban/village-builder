# Modules: where each system lives

Moved from `AGENTS.md` (7 November 2026), which keeps the rules these systems impose (Conventions there), with where the
tunables live and how a job kind or a custom is added (Adding things, below). The module map is
`grep -rn "^// @sys" src`, the state schema `grep -rn "@state" src`, and who writes each field `docs/architecture/ownership.md` and
`node tools/writes.js`. Keep this list current when a module changes purpose.

- `VB['sim/registry']` combines load-time rule declarations and ordered contributions; `value` creates no per-call containers or closures.
  `explain` checks finite outputs and contribution ranges and reports each factor, the combination, the raw result and clamp bounds.
  The million-read heap test checks retained memory after GC; it does not prove zero temporary allocations in provider callbacks.
  Modules declare an owned rule or contribute a factor/term before the first seed/load, which seals the registry; rules never enter saved state.
- `ArchGen.generate(seed)` (`src/gen.js`) makes the world `w`: per-tile typed arrays, regions, and the painterly chunk bake.
  Rivers (`w.river`, `w.riverTo`) and their fords (`w.crossing`) are traced and drawn by `src/gen/rivers.js`, listed before `gen.js`, which calls it.
- Walking: `src/sim/routes.js` holds the cost of each tile (terrain, fords, worn paths; rivers are closed but at a ford or bridge), the A* route
  search, the route cache and `walkable(w)`, the rule every reach search (`bfs`) uses. `src/sim/paths.js` counts and fades worn paths
  (`w.wear`, `w.worn`) and wears in generated villages; `src/gen/paths.js` draws them into the map chunks.
- `Sim.seed(w, seed, scenario)` (`src/sim/scenarios.js`) makes the state `st`; `Sim.advance(st, hours)` (`src/sim/clock.js`) runs it.
  Scenarios: `founders`, `heirs`, `populous`. All build villages through `settlementGenerator` in `src/sim/layout.js`: cluster villages,
  houses round the green, each farm's fields one block beyond the yards. `src/sim.js` only assembles the `Sim` object from the `src/sim/*` modules.
- Food quantities and paid stakes (VB-174): `src/sim/stores.js` owns grain, rations, sheaves and food ledgers.
  Call operations with a good and a reason; signed ledger entries distinguish goods and pawn stakes. Owed shares stay in heirs/cottage.
- Animals (VB-131 to VB-138): `src/sim/herds.js` (herds of named cattle and counted sheep, spring breeding, each scenario's herds, cows in milk, the team of oxen), `src/sim/meadows.js` (hay meadows and haymaking, only while hay is wanted), `src/sim/byre.js` (the stall period, the autumn count, slaughter, salting, milking, the dung heap); the larder of stored food and grain spoiling in store are in `src/sim/hunger.js`; soil, manure and how many fields a household wants in `src/sim/fields.js`. Design and plan: `docs/review-animals.md`; balance and history: `docs/review-balance.md`.
- Claims (VB-042, VB-155 to VB-158, VB-033): `src/sim/claims.js` (claims on tiles: strength, lapse, disputes by custom), `src/sim/territory.js` (the
  village's outland, borders and cairns), `src/sim/stakes.js` (a field or meadow project stakes its tile; contests) and `src/sim/farmclaims.js`
  (empty farms: the birthright, claimants by custom, restoration and moving in). Design and plan: `docs/review-claims.md`.
- Names (VB-026): `src/sim/names.js` holds the generators (farms by compass, landmark, owner; villages by syllables or founder) and each culture's
  order of preference (`c.namePrefs`); a lone farm's village bears its farm's name, and the page labels a village of two or more farms once.
- Households short of people (stability review, `docs/review-stability.md`): `src/sim/service.js` brings a guardian to an orphaned minor heir and a
  servant to a holder who lives alone; marriage of two holders, handing a farm on (`handOn`) and the means to marry are in `src/sim/lifecycle.js`
  and `src/sim/heirs.js`.
- Saves (VB-074): `Sim.save(st)` and `Sim.load(w, data)` in `src/sim/saves.js`; a generic codec keeps shared objects, Maps, Sets and typed
  arrays, and the tiles the simulation changes are saved with the state (its `WORLD` list: a new world field the simulation writes goes there).
  `st` is plain data (VB-073, `tests/plaindata.js`): no functions, and no state kept aside in module closures, or a loaded run drifts
  (`tests/saves.js` catches it). A loaded run matches the unbroken one given the same `Sim.advance` calls.
- The record of events (VB-075): `st.record`, typed events written by `log(st, text, event)` and `personEvent(...)` in `src/sim/records.js`
  (`false` when another call records the same happening); `Sim.recordOf(st, {pawn, household, farm, village, kinds, from, to})` queries it.
  A new log line names its event's kind, pawn and place (`atHousehold`, `atFarm`); `tests/record.js` checks every call.
- Notable events (VB-098): `Sim.notable(st, ev, about)` in `src/sim/notable.js` gives the reasons a record event is notable (keys of
  `Sim.NOTABLE`: family, holder, hunger, farm, custom) or null, for the pawn the player follows; `Sim.eventLine(st, ev)` tells an event in one
  sentence. A read-only view with no state. The page's toasts (`src/page/notices.js`) read both; a new notable kind is added there, not in the page.
- The chronicle (VB-099): `Sim.chronicle(st, {pawn | farm | village}, group)` and `Sim.villageLog(st, n)`, also in `src/sim/notable.js`, are the
  record as a history, newest first, and as the village log (`st.events` is gone: `log` writes the record only). `CHRONICLE` names the
  filters by kind; a new event kind that belongs to one is added there. The History tab of the selection card is `src/page/history.js`.
- Commands (VB-167 to VB-171): `src/sim/commands.js` holds the verbs (`work`, `walkTo`, `goHome`, `idle`; `decide`; `marry`, `handOn`, `serve`,
  `claim`, `leave`; debug `kill`, `retire`, `argue`, `rally`, `skip`). The planner, the meeting, the moving round and the debug drawer act by
  `issue(st, {actor, verb, target, args, source})` (`Sim.command` for the page); a verb checks that the act is possible and returns why not.
  A new act a pawn or the round chooses gets a verb; `tests/commands.js` checks statically that only the verbs call the acts they wrap.
  The player (VB-169) is one more source: `st.player` holds the inhabited pawn and its queue, written by `Sim.inhabit`, `uninhabit`, `queue`,
  `unqueue` and `setAuto`; `playerStep` issues the queue's head each step, and the planner's sites ask `commanded` and `unplanned` before they
  move a pawn (`tests/player.js`).
- Membership (VB-175): `sim/records` alone writes household members, a pawn's household and service (`joinHousehold`,
  `leaveHousehold`, `clearMembers`, `setServant`). Death retains the last household on the historical record.
  `sim/membership.foundHousehold` creates, supplies, owns and populates a farm's household; restoration reaches it by the
  `foundHousehold` command, and a completed plot reaches `sim/cottage` by `finishCottage`.
- `Culture` (`src/culture.js`) holds customs: culture-wide customs, per-settlement practice, per-person attitudes.
- The page script (`src/page/*.js`) draws and only reads `st`. It writes to `st` through the `Sim` API and three flags:
  `visualDirty`, `naturalDeaths`, `driftMul` (and it clears `rigDirty`, `treeDirty`, `biomeDirty`, `pathDirty` and `landDirty` after redrawing); the lint enforces this.
- `src/vb.js` creates the `VB` namespace; `src/load.js` loads the modules in Node for the tests.

## Adding things
- Tunables: `ECON`, `FIELDS`, `ROLES`, `MARRIAGE`, `SOCIAL`, `SHARES`, `MATCH`, `HERD`, `SOIL`, `RIVER`, `TERRAIN`, `ROUTE`, `PATHS`, `SETTLE`
  and `SERVICE` in `src/sim/rules.js`; `KINDS` (job kinds) in `src/sim/kinds.js`; `RIVERS` and `FORDS` in `src/gen/rivers.js`; `LOOK`
  (worn paths) in `src/gen/paths.js`; `DIMS` and `ARCHETYPES` in `src/culture.js`.
- A new job kind is one record in `KINDS` (`src/sim/kinds.js`): numbers, type of work, labels, where to stand, urgency, and what finishing
  and delivering do. It is posted from `refreshJobs` (`src/sim/jobs.js`); roles rank types of work (`work` in `ROLES`, with `except` for
  single kinds), so a kind of an existing type needs no role numbers. Its `anim` names an animation in the page script.
- A new custom adds a `DIMS` entry (its `key` and `opts`) and a value in each `ARCHETYPES` entry; offsets are computed from `DIMS`.
