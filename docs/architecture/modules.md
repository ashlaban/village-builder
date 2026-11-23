# Modules: where each system lives

Moved from `AGENTS.md` (7 November 2026), which keeps the rules these systems impose (Conventions there), with where the
tunables live and how a job kind or a custom is added (Adding things, below). The module map is
`grep -rn "^// @sys" src`, the state schema `grep -rn "@state" src`, and who writes each field `docs/architecture/ownership.md` and
`node tools/writes.js`. Every source module is listed once in the build manifests, or is the Node loader, and has a first-line
`@sys` declaration naming its responsibility. `npm test` checks that coverage. Keep this list current when a module changes purpose.

- `VB['sim/events']` (VB-229): `on(kind, fn)` at load, `emit(st, kind, data)` calls the subscribers at once in load order; they cannot veto. A
  lower layer's act reaches a higher one this way; `node tools/events.js` lists each kind's emitters and subscribers (`tests/events.js`).
- `VB['sim/registry']` combines load-time rule declarations and ordered contributions; `value` creates no per-call containers or closures.
  `explain` checks finite outputs and contribution ranges and reports each factor, the combination, the raw result and clamp bounds.
  The million-read heap test checks retained memory after GC; it does not prove zero temporary allocations in provider callbacks.
  Modules declare an owned rule or contribute a factor/term before the first seed/load, which seals the registry; rules never enter saved state.
- `ArchGen.generate(seed)` (`src/gen.js`) assembles the world's terrain, hex tiles and regions. Seeded noise comes from `src/gen/noise.js`.
  `src/gen/biomes.js` defines biome identities, cover thresholds and tile pigments, and updates a tile's biome and colour together.
  `src/gen/bake.js` rasterizes the generated world for the map at each level of detail, with land pigments, coastal contours, water and
  decorations. `src/gen/marks.js` draws the individual marks (trees, stones, humps, crags). `ArchGen` exposes the generator and the bake.
  Rivers (`w.river`, `w.riverTo`) and their fords (`w.crossing`) are traced and drawn by `src/gen/rivers.js`, listed before `gen.js`, which calls it.
  What lies in the ground is laid by `src/gen/geology.js`, called the same way: bedrock (`w.rock`) in provinces, with lenses of marble and
  soapstone, and finite deposits of clay and ores (`w.deposit`, `w.depositLeft`) as veins, each island drawing which kinds it has
  (`PROVINCES`, `VEINS`; `node tools/geology.js` reports the shares). Nothing digs yet. `src/sim/prospect.js` keeps what each village
  has found of the hidden upland ores (`st.finds`; `w.vein`, `w.veinNear`): a finished job near a vein may find it (`sim/agents` calls
  `worked`); `Sim.knowsDeposit` and `Sim.depositKnown` are the views' reads. They are shown by the tile panel
  and the Ground overlay (`src/page/ground.js`: bedrock tints, deposit marks and a key, drawn once a world; the map bar, key O), and the Reach overlay (`src/page/reach.js`: land banded by walking hours from the selected tile, by `reachCosts` of `sim/routes`, with contours and a key at the hours the rules compare against; the map bar, key H).
  The climate of a world is `src/gen/climate.js` (VB-342), also called by `gen.js`: it erodes the relief, draws the seed's wind (`w.wind`),
  carries rain over the map on it (`w.rain`) and deals the tiles' moisture (`w.hm`) out by that rain, so biomes follow the weather; its
  numbers are `CLIMATE`. Nothing in play reads the wind or the rain yet.
  What a tile's cover holds (a wood's trees at full cover, a meadow's stones) is `src/gen/cover.js`, read by `gen.js` as it lays the land.
- The panels' shared pieces are `src/page/meter.js` (VB-664; `AGENTS.md`, Deciding without Kim, 15): `meter(o)`, the one meter every level is
  shown on (its scale is the caller's argument: VB-665), `stat(o)` and `stats(list)` (a good or a measure: its icon from `goodIcon` of
  `src/page/icons.js`, its word, its value, its meter where it is a level), `traitsHTML(id)`, and the supply component (VB-667):
  `suppliesHTML(O, only)` draws a household's food, fuel and hay as season cells from its argument, the outlook `Sim.supplyOutlook` reads
  (VB-666; the page computes none), with whose reckoning it is and an i for the numbers, and `supplyChips(O)` the chips of a farm's row
  (`seasonIcon` of `src/page/icons.js` for the seasons). A supply is shown only through these. A new panel shows a level, a store or a
  trait through these, and a person or a farm by `memberRow` and `farmRow` of `src/page/cards.js`; a household is told of only on its
  farm's card (`houseStats`, `renderHouse`: the tabs Stores, Land and Animals), and the People sheet only finds.
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
- Walking: `src/sim/walking.js` defines tile passability, the cost of a step, the discomfort a route is chosen by (`DISCOMFORT`,
  `choiceCost`, VB-448) and the cached breadth-first reach lists. `src/sim/routes.js` searches for the route a walker of a load class
  chooses (its time weighed with discomfort; the quickest at weight 0), bounded by its time, including `reachCosts` for one search to many targets, and owns the bounded route cache
  (`st.pathCache`, `st.routeDirty`, `st.routeFallbacks`). `costChanged` marks that cache for daily refresh and tells walking to invalidate
  its reach lists if passability changed. `src/sim/villagehours.js` maintains the symmetric travel-time table `st.villageHours` (VB-286)
  through the route search and supplies the village-to-village distance queries. `src/sim/paths.js` counts and fades worn paths
  (`w.wear`, `w.worn`) and wears in generated villages; `src/gen/paths.js` draws them into the map chunks.
- `Sim.seed(w, seed, scenario)` (`src/sim/scenarios.js`) makes the state `st`; `Sim.advance(st, hours)` (`src/sim/clock.js`) runs it, by whole 6-minute steps only: any other number of hours is refused with an error (VB-244); the page keeps the part of a step and draws the pawns between steps.
  What runs, and in what order, is one table in `src/sim/clock.js`, `CALENDAR` (VB-241): each entry an `every` (step, hour, day, season,
  year), an `at` within it (hour, tick, season, sday, doy), a guard `when` that is not a date, an owner module, `run` and a note. Each step walks
  it once, in order; a module tests no date to decide whether its daily, seasonal or yearly work runs. `node tools/sim.js --report calendar` prints it.
  Scenarios: `founders`, `heirs`, `populous`. All build villages through `settlementGenerator` in `src/sim/layout.js`: cluster villages,
  a farm at a time round the green, each house where its land is best, its fields one block beside it and outward of it. `src/sim.js` only assembles the `Sim` object from the `src/sim/*` modules.
- Food quantities and paid stakes (VB-174): `src/sim/stores.js` owns grain, meals, sheaves and food ledgers.
- The larder (`src/sim/larder.js`) owns `household.larder`: lots of perishable food, withdrawn in expiry order and removed when they
  spoil. The byre, the drying rack and the daily meal use its operations. `src/sim/hunger.js` feeds households, runs the hearth, and
  applies food and shelter to pawn health. `src/sim/foodneed.js` owns the exchange `need` rule and contributes its food term based on
  the household's stock and the time to harvest.
- Fresh food and the pot (VB-119): `src/sim/pot.js` owns `household.fresh` (fish and gathered food in batches by day, lost past their shelf life when the store is next touched) and cooks the pot (fresh food, dried fish in winter, grain, and the seed a short household would eat, VB-388; a pot of several sources goes further), moving food through `sim/stores`; `sim/drying` lays the catch for the pot beyond what is eaten before it spoils by the rack (VB-388).
- The hand quern (VB-009): `src/sim/quern.js` owns `household.quern` (`{rock, made}`, worn out `QUERN.years` after `made`, read in closed form), grinds grain to `household.flour` (a store of `sim/stores`) and hews a new quern from a load of the heap (`grind`, `hewQuern`); the pot cooks flour 1:1 and grain unground at `ECON.unground`; the quern is a good of the fair (worth 25).
- Tar (VB-301): `src/sim/tar.js` owns `household.tarPit` (`{tile, village, built}`, a pit dug as a household project plan on the first pine tile of the village's wood, one a village, the making `tarpit` the head of the household its alderman charged (`village.tarBy`, the verb `chargeTar`, by most hands; VB-673) begins at its yearly look from summer, VB-678) and `farmstead.tarredUntil`; the reach test is pine standing in the village's wood (`pineTile`); burning (`burntar`, early summer, 12 hours, one pine tree felled) puts a barrel into `household.tar` (a store of `sim/stores`), and `tarhouse` and `tarboat` spend one on the house or the boat (`sim/drying` keeps `household.boat.tarred`: leaky after `BOAT.tarYears`, lost after `BOAT.lostYears`); tar's term of the rule `need`.
- Salt (VB-700): `src/sim/saltpan.js` owns `household.saltAt` (`{house, year, tile}`, the nearest salt spring within `SALT.reach` walking steps the household may use, searched when the want opens and kept, `VB.count.saltGround`); boiling (`boilsalt`, spring to autumn, 10 hours by one hand, a tree of the spring's tile or a neighbour's felled for the fire) carries `SALT.yield` measures home into `household.salt` (a store of `sim/stores`, reason `saltboil`); salt is a made good (`sim/targets`: `SALT.stock` while the household keeps animals), a keeping good of the fair (a sack of 10 measures) and has its term of the rule `need`, so a household without a spring asks for it (`sim/asks`). The salting (`sim/byre` `saltDone`) takes `HERD.saltPerRation` a ration of meat; what it has no salt for is smoked into `smoked meat`, which keeps `HERD.smokeDays`. The spring never runs out; sea salt is not made (the note at the head of the module).
- Iron tools (VB-701): `src/sim/ironwork.js` owns `household.tools` (the condition of the household's tools, 0 to 1, undefined for sound). Field work and felling (`TOOLS.kinds`: plow, break, reap, fell, wood, timber) wear it by `TOOLS.wear` an hour of work done, as `sim/work` settles a task (`Iron.wear`), and go at `1 - TOOLS.share + TOOLS.share × condition` of the rate (`Iron.rate`, read by `sim/work` `manning` and by the head's estimate, `sim/estimate` `known`): slowed, never barred. `smelt` (autumn and winter, at the farm, 2 hands, 10 hours, craft smelting) takes `IRON.ore` loads of bog ore and `IRON.wood` of firewood into a bloom (`household.iron`, a store of `sim/stores`, reason `smelt`); `mendtools` (winter, in the house, 4 hours, craft smithing) takes `TOOLS.mendIron` of a bloom and restores `TOOLS.mend`. Iron is a made good (`sim/targets`: its target the mending need), a keeping good of the fair (a bloom) with its term of the rule `need`, so a household with no bog in reach asks for it (`sim/asks`). `wearOf` and `shareOf` are the seams for the grade (VB-762) and the whetstone (VB-743).
  Meals are cooked by `cook` from a food of `FOODS` (`src/sim/rules.js`), by its worth in rations (VB-259).
  Call operations with a good and a reason; signed ledger entries distinguish goods and pawn stakes.
- Help asked for (VB-470): `src/sim/hands.js` owns `st.handsToday` (today's lent hands, by pawn: the household helped, the hours given
  and worked) and the offer basis `help` of `sim/offers`. At the morning's allotment `sim/jobs` reads the head's shortfall (`shortOf`: its
  windowed field work against the pace of the hands it gave it, kept to each window's end) and `askFor` asks the village's heads, near kin
  first, then by opinion; the head asked answers by kinship, opinion and its day (`plan.day.free`) and lends whom it can spare. A hand
  lent takes the asker's field work on the basis `helper` (`sim/eligibility`), through `dutyRound`; `step` sends it home when its hours
  are given and closes a day's help, the tie growing by the hours (`helped`, `sim/relations`). The helper round of VB-106 is gone.
- Obligations (VB-310): `src/sim/obligations.js` owns every explicit claim, `st.obligations` (by id: kind, debtor and creditor as party
  refs, what is owed, the hour its term ends, status, delivered), with two caches: the due-queue `st.obligationsDue` and the parties' live
  ones `st.obligationsBy`, read through `due(st, party, as, kind)`. Write only through `create`, `fulfil` (goods through `sim/stores`),
  `forgive`, `lapse` and `transfer`; `step` touches only those whose term has ended. A new kind is a row of `KINDS` (its term). The
  first kind is the heirs' share still owed: made by `sim/heirs` (`oweShare`), paid at the moving round by `sim/cottage` (`payOwed`).
- The climate by latitude (VB-807): `src/sim/climate.js`, the world layer's climate (target-v2 4.2): a world's latitude (`w.lat`, chosen at
  generation), its three bands of rows, the year's curve a band, the winter's dates reckoned on autumn day 1 and taken from a due-queue
  (`st.climate`), and how far a world's thaw and frost lie from the middle world's. The weather draws about this normal; this module is the normal.
- The seasons' weather (VB-354): `src/sim/weather.js`, the world layer's climate until the weather branch answers the same question a
  region (target-v2 4.2), owns `st.weather`: this year's and last year's seasons, each `[warmth, wetness]` in -1 to 1 drawn from the
  `weather` stream as the season begins (`seasonBegins`, first in the calendar), with the year's thaw (a spring sday) and first frost (an
  autumn sday). A crop reads its row's `weather` terms (`CROPS`, `sim/crops`) at reaping through `cropFactor` (`sim/fields` standing),
  the meadows theirs (`HAY_WEATHER`) at mowing through `factor`; `ripeShift` moves barley's and peas' ripening by the summer's warmth;
  `sowOpen` is the sowing window after the thaw (`sim/fieldwork`, `sim/plandays`); `frostDay` places the frost's calendar entries, the
  plans' closing window, the harvest estimate and the harvest's urgency. Its tunables are `WEATHER` there.
- Animals (VB-131 to VB-138): `src/sim/herds.js` (herds of named cattle and counted sheep, spring breeding, each scenario's herds, cows in milk, the team of oxen), `src/sim/meadows.js` (hay meadows and haymaking, only while hay is wanted), `src/sim/byre.js` (the stall period, the autumn count as the head's verb `cull`, VB-679, slaughter, salting, milking where the herd is, shearing at the fold, the job `shear`, the dung heap, an unherded herd in a crop), `src/sim/droving.js` (VB-674: animals that change household, handed on, given as a start or paid in for a share, are the new household's where they stand, `herd.at` on `st.herdsAway`, until a member leads them home with the kind `drove`; their hay is left lying in the old barn for `sim/lying`'s `fetchHay`; a herd with nobody to have it stays at its farm until the frost, taken in by the farm or lost), `src/sim/grazing.js` (VB-136: herding, the day's pasture, the herds out with the herder, the grazing pressure `w.graze`, halving each year in closed form, and `milkFactor`, the factor a crowded pasture puts on the milk that `byre` reads, VB-709); read by `src/sim/spread.js`, VB-091, where it keeps open land open or thins its scrub); grain spoiling in store is in `src/sim/hunger.js`; field demand is in `src/sim/fieldplans.js`; soil, tilth (VB-717) and manure are in `src/sim/soil.js` (VB-1479). Design and plan: `docs/review-animals.md`; balance and history: `docs/review-balance.md`.
- Carts (the distance review, 12 November): `src/sim/carts.js` (hand carts and ox carts as a household's items, `household.carts`; the load
  a pawn takes and its pace; wear, mending and the end of a cart; the head's count of misses, `household.cartMiss`, and the cart built as a
  project at the house; its tunables `CART`, with `TRAVEL` in `src/sim/rules.js`). `sim/agents` asks it at each load, `sim/kinds` takes its
  kinds (`cart`, `mendcart`) and the hay's loads from it, `sim/building` fells its timber, `sim/clock` runs its winter count.
- Loads left lying (VB-611): `src/sim/lying.js` owns `st.lying` and `st.lyingSeq`: a load whose carrier died on the road or whose household
  dissolved, put down where it was (`sim/agents` release), with its good, amount, tile and owner; a fetch kind for each kind that carries a
  load (`fetchHaul`, `fetchHay`, `fetchWood`, `fetchWellstone`, registered by `sim/kinds`) and the rule that posts them for the owner; one
  nobody fetches rots at the autumn frost (`sim/clock`).
- Away from home (VB-783; design.md, Moving to new land, Sleeping away from home): `src/sim/away.js` owns the open stays (`st.away`,
  `st.awaySeq`) and their index `agent.away` (a cache, one writer), their packs and meals, and a lodger's stay (the verbs `lodge`, `comeHome`);
  a stay's bed, turn and id are written through its `bedAt`, `turn`, `nextStay` and `unlodge`. VB-1474 split it in three: `sim/hosting`
  (before it) holds a guest's bed in another house (`hostWhy`, `askBed`); `sim/journeys` (after it) holds a journey's course and owns
  its parts of the stay (`why`, `to`, `from`, `gift`, `village`, `stay`, `guest`). `sim/away` hears `atBed` from `sim/agents`;
  `sim/journeys` hears `legEnd`, `legDue`, `stillAway`, `moveOn` (by `sim/events`), and `sim/heirs`' `rehoused` and `sim/births`' `placeBorn`. A journey
  (VB-287; design.md, Between villages) is a stay whose bed is where its leg ends: `moveTo` changes the household at the act and the
  `rehoused` event hands the pawn to `moved`: within a village it walks to the new door; to another village it sets out, its provisions
  (`TRAVEL.dayWalk` hours a ration) taken from the household it leaves through `sim/stores` (reason `away`), a leg a day from 6:00 to
  18:00 in the pawns' one queue of legs (`st.legDue`, VB-473), whose walking (`walkLeg`, `restOnRoad`, `turnTo`) stays in `sim/agents`.
  A lodger is a stay at a bed (a tile, or a guest's in another household's house), by the verbs `lodge` and `comeHome`: a pack of a
  ration a day planned (at most `AWAY.pack`), the tasks its stay names only (`dayAway`, before the household's day), home when its pack
  is down to the walk home's ration. Every pawn away eats from its pack (`feedAway`), out of its household's meal by the one test of
  `agent.away`. `sim/pose`'s `bed` is the tile a pawn's day starts from and ends at, which the walk home, a job's reach and the day's
  end read.
- Legs (VB-471 to VB-473; design.md section 7, A leg, and its end; split by VB-422): every pawn is in one leg, a walk, work or a wait
  (`agent.leg`, `src/sim/legs.js`, which holds the walk set out on, begun, cut and ended, and the queue `st.legDue` of the ends of walks
  and waits); a task's work is a block (`src/sim/work.js`: its progress in closed form, its rate by the hands at it, the ox team, and the
  ends of tasks in `st.workDue`); a pawn's side tasks are `src/sim/attention.js` (VB-251), told of a leg's change by the event
  `legChanged`; `src/sim/agents.js` holds the job's phases (start, arrival, a load home, completion, release), the step (`stepAgents`,
  which takes what is due and nothing else), a journey's walking and the verbs. A pawn's place is `src/sim/pose.js`, read only:
  `placeOf` (a walker along its leg's hours), `poseOf` (the page's), `tileAt`, and the bed; `sim/society`'s `outdoors`, `sim/jobs`'
  company and `sim/lifecycle`'s death on the road read it, and the page reads walkers' places through the shim `Sim.walkerPlaces` until
  VB-474.
- Claims (VB-042, VB-155 to VB-158, VB-033): `src/sim/claims.js` (claims on tiles: strength, lapse, the land each holds), `src/sim/disputes.js` (disputes settled by custom: support, scores, the winner and the losers' grievance; VB-1176), `src/sim/territory.js` (the
  village's outland, borders and cairns), `src/sim/stakes.js` (a field or meadow project stakes its tile; contests) and `src/sim/farmclaims.js`
  (empty farms: the birthright, claimants by custom, restoration and moving in). Design and plan: `docs/review-claims.md`.
- Project plans (VB-123): a holder's plan of steps in `st.plans.projects` (a household's new field or meadow, a village's plot with its
  cottage, a claimant's restoration of an empty farm), read through `src/sim/projects.js` (loaded just after `sim/records`, so every module
  may read it) and written only by `src/sim/projectplans.js` (split from `sim/plans` by VB-431; it also judges a plan `impossible` and words its dropping), which hears the lower modules by events: `projectBegun` (a plot, `sim/expansion`; a
  claim, `sim/farmclaims`), `stepDone` (`sim/newground`, `sim/meadows`, `sim/expansion`, `sim/cottageplan`, `sim/cottage`, `sim/farmclaims`), `rightLost` (a stake
  or a farm's claim lost, `sim/stakes`, `sim/farmclaims`) and `storeShort` (`sim/stores`). A step's reservation is a `build` reservation
  of `sim/stores`.
- Names (VB-026): `src/sim/names.js` holds the generators (farms by compass, landmark, owner; villages by syllables or founder) and each culture's
  order of preference (`c.namePrefs`); a lone farm's village bears its farm's name, and the page labels a village of two or more farms once.
- Households short of people (stability review, `docs/review-stability.md`): `src/sim/service.js` brings a guardian to an orphaned minor heir and a
  servant to a holder who lives alone; a household of at most one grown member whose ask for food falls short (`askFood`, `src/sim/help.js`, at its head's plan review, VB-691;
  names it) takes in kin, else a servant, at once (`takeIn`, VB-308), and with nobody to come, its people go to their nearest kin household,
  which holds the farm in trust (`src/sim/trust.js`, VB-309: `st.trusts`, the verbs `goToKin` and `goBack`; the trustee posts the farm's
  field work as its own in `src/sim/jobs.js`, and `src/sim/ownership.js` reads which farms are held); an orphaned heir with no guardian is
  held for the same way; at the moving round a landless adult from a household with hands to
  spare goes into service where labour is short, by hands per field (`serveWhereShort`, VB-090; the placement `reachSteps` is shared); marriage of two holders, handing a farm on (`handOn`) and the means to marry are in `src/sim/marriage.js`
  and `src/sim/heirs.js`.
- The moving round (`src/sim/round.js`, its marriages in `src/sim/marriage.js`, VB-201, VB-277): on autumn day 11, each village's own round (`villageRound`) a village a 6-minute
  step from noon in the order of village id (village k on step k up to 60 villages, else `floor(k * 60 / n)`): its store filled, the played pawn's wished match
  offered, its kin pressure, and a visit planned by each of its men who holds no offer (the round chooses nobody, VB-693: a wedding
  brings the handover its home's holder offers); then demand, claims and plots, settlement, and service, island-wide on fixed steps at 18:00, 18:06 and 18:12. The round lasts
  `ASK.passes` days (autumn days 11 to 13, VB-692): on each, a village's step first answers the offers due to its people (`answerDue`, in
  the order of `ASK.order`: handover, match, land, party, place); of the matches, the best as the side asked reads it first (`matchRead`), so that one asked by several
  takes the best and the rest lapse at its marriage; its choosers (land, party, place) run on the first day only, and each of their picks is an
  offer due at once on its basis (`match` and `handover` in `sim/marriage`, `land` in `sim/farmclaims`, `party` in `sim/settle`, `place` in
  `sim/service`), whose answers are whose yes the move needs (`moveWhy`, `sim/wishes`); a match refused asks anew that evening, due the next
  day; after the last day what is open of the round lapses. A pawn holds one open offer about its future (`pawn.ask`, `sim/offers`).
  `roundPhase(st, n, d)` is the step's entry; `movingRound` runs them all, after holding the asking of each who seeks (the year's askings
  and the round in one: the drawer's button, the tests).
  A match (VB-693; plan VB-682, 4.1) is asked by the spokesman of one who seeks (`sim/asking` `askMatch`: the man's side; a woman's from
  the season `ASK.womenFrom` if nobody asks her, and a woman who holds a farm and speaks for herself as a man), scored by `sideScore`
  (`matchScore`, the fancy drawn once and kept on the offer, and `MARRIAGE.headsLiking` a point of his opinion of the other spokesman),
  and answered at the round by the two and their spokesmen (`sim/marriage` `whyNo`: enmity, courting another unless it yields, not this
  year; a spokesman the score as he reads it and the means of the home). One who asks is asked by nobody, and one asked asks nobody.
  Remembered: `refusedMatch`, `refusedSuit`, `marriedAgainst` (`SOCIAL.memories`). The rules of a match and their memos, heir rankings ranked afresh and cleared after each
  marriage or handover, are `matchRules` (`src/sim/matching.js`), which the player's wish (`matchBar`) reads too.
- Succession, offered and taken up (VB-824; `src/sim/marriage.js`, `src/sim/heirranking.js`, `src/sim/heirs.js`): no step hands a farm on. `heirRanking`'s `asked`
  gives a farm's line in the order asked, each with why it would not take it (it holds a farm, lives on a spouse's, or is heir to a larger
  one under `ownHeir: keeps`); the ranking is its yes-sayers. In life an unplayed holder considers handing on (`handover`) at its heir's
  wedding into the house (an offer due at once) and on its birthday (the event `holderYear` of `sim/lifecycle`, heard by `sim/asking`; an
  offer due at the round), at the custom's time unless it is at enmity with the heir; a played holder offers by the verb when it chooses.
  The basis `handover` asks the first grown one in line; a no is told, leaves no memory, and passes the offer to the next at once
  (`gives.passed`). At a death `succession` logs who renounced (`renounced`) before the one who takes it up.
- The asking day (`src/sim/asking.js`, VB-823; plan VB-682, sections 2 and 7): each pawn who seeks (unmarried, or grown and holding no
  place) has one entry in the due-queue `st.asking` (`sim/wishes`: written at a birth for the first asking day after the 18th birthday,
  at a widowing, a marriage, a new head and a move, dropped at death or on taking a place), on season day `id mod SEASON_DAYS` at
  `ASK.hour`. A daily entry of the clock reads its head: the pawn's wish is reviewed (`chooseWish`) and, holding no open offer, it makes
  the offer of its best open rung, due at the round: a man's match by his spokesman (`askMatch`: the unmarried women of the queue within
  reach, nearest villages first, at most `ASK.pool` weighed, none asked by `ASK.held` open matches; the round's ask anew uses it too),
  or an empty farm (`askLand`); a plot, new land and service are left to the round's walk. An open offer whose people died, married or
  took a place lapses where it is next read (`staleWhy`: the asker's asking, or the round's step).
- The retired's voice (`src/sim/advice.js`, VB-1316; design, Inheritance: The retired; plan VB-1122, section 3): the basis `advice` of
  `sim/offers`, by which a retired member offers its head one of the head's verbs (`target`, `rotation`, `order`, `sowOutOfTurn`, or `match`,
  a grandchild's match the head asks by `sim/asking`'s `askMatch`); the check is the verb's own, for the head. The head takes it when its
  opinion of the adviser times the adviser's standing over its village's mean reaches `ADVICE.heed`, and issues the verb itself; a no books
  nothing (`memory: false`). An unplayed retired advises once a year (`pawn.advisedIn`) at its head's spring planning day (the event
  `planReviewed`): the custom's hay where the head's departs from it by more than `ADVICE.gap`, and, under "Who makes a match" by the
  heads, a match for a grandchild of age with the one who seeks in its village it thinks best of (`ADVICE.fancy`).
- Courting (`src/sim/courting.js`, VB-036; design, Traits, talk and stories: Courting): `pawn.courting` (the other's id, on both sides),
  `pawn.courtingSince`, `pawn.courtRefused` and the index `st.courtships` (the man of each couple). It starts at a good talk
  (`sim/relations` emits `goodTalk`; one check, `courtCheck`, never a pass over pairs) when each holds the other at `COURT.opinion` with
  a tie of `COURT.tie`, and ends when the liking cools under `COURT.end` (read where the pair is touched: `courtTouched`, and at the
  round's start: `review`), when one marries another or dies, or after `COURT.years` with no offer of theirs open. The pair's own offer is
  `sim/asking`'s (`askCourted`: at the event `courting` and on either's asking day, if the ages, the kin limit and a home allow; due at the
  round), a match of `sim/marriage` marked `courted`: the means and the two's hunger are read where it settles, and a head's no is
  remembered by both (`refused`: `SOCIAL.memories.refusedCourting`). One who courts is in no arranged match (`matchBar`, `askMatch`). At the next round one who holds the head who refused at an opinion under `COURT.leaveBelow` asks for a place in
  service whatever the hands at home (`leavers`, read by `serveWhereShort`).
  A child on the way (VB-555): `sim/births` lets a courting woman conceive (`courtChance`: `COURT.conceive` a year at the peak of the
  married curve), marks the pregnancy `pregnantCourting` and emits `conceivedCourting`; `sim/asking` files it in `st.courtDue` and, at
  the first asking hour `COURT.known` days on (`courtDay`, `offerKnown`), answers the pair's open offer of the round at once (`sim/offers`
  `conclude(st, o, null, true)`: the played pawn keeps the basis's days) or makes one due now (`askCourted(st, id, st.t, false)`),
  put off a day at a time while either is hungry (`COURT.wait`), never for a servant. A child born to an unmarried mother is
  `pawn.outside` (events `bornOutside`, `legitimated` at its parents' wedding); the custom `outside` ranks it in `sim/heirranking`.
  The means to marry is the registry rule `marriage.means` (declared there, base `MARRIAGE.means`, context the home's household; VB-631), read by `affords` and by `Sim.meansOf`, which also feeds `matchBar`'s reason and the pawn panel (`marryBar`). A later contribution (a custom, a head's caution, a servant's portion: VB-637) joins by `Rules.contribute({ rule: 'marriage.means', ... })` from its own module.
- The suitor's visit (`src/sim/visits.js`, VB-289; design, Between villages: The suitor's visit): a match joins two villages only
  within a day's walk (`TRAVEL.dayWalk`), or when one of the two has visited the other's village since the last round
  (`sim/matching` `courts`, read by the asking and `matchBar`; `poolFor` is the villages within a day's walk
  and those visited). A man who holds no offer at his village's round (he found nobody he could ask, or was refused) looks for the
  nearest village beyond a day's walk that holds a woman he could marry (`seekVisit`, one read of the asking queue, `visitWalk`)
  and plans a visit by the verb `visit`, whose check holds for any pawn; the plan waits in the due-queue `st.visits` for 6:00 of
  winter day 1 + (household id mod 6), when `visitsDue` sets him out if he is still single, of that household and at home, and the
  household can spare a ration a day away above its seed and its means (else the log says he stays, `visitOff`). The journey is
  `sim/journeys`' (`visit`: there, a day as a guest at the green, and back; `2 x ceil(hours / 12) + TRAVEL.stay` days); on arrival
  `sim/journeys` emits `visited` and this module writes `pawn.visited = {village, year}` and the event.
  The player's journey (VB-292): `visitChoices` lists, for any pawn, the villages it might visit (nearest first, at most 5, with
  the days and the pack by its own reckoning), which `sim/opportunities` turns into items (`when: 'winter'`) for the pawn and for
  each son or daughter of the house it speaks for; `orderVisit` (`Sim.orderVisit`) issues the same verb for the played pawn or one
  it speaks for, the visitor as actor; `visitState` (`Sim.visitState`) is what the sheet shows of a visit planned or under way.
  A woman's visit is read from her side: `poolFor` adds a woman who visited the village to its round's pool (one read of the
  asking queue a village's round, `guestWalk`), for its kin pressure and the played pawn's wish; an asking reads a visit from either side (`courts`). The module loads after `sim/matching`.
- The meetings (`src/sim/meetings.js`, VB-206, VB-278): on autumn day 10, each village's meeting (`villageMeeting`) on its own 6-minute
  step from noon, in the order of village id, by the round's turns (`villageTurn` in `src/sim/occasions.js`): its living's interests
  (`refreshInterests` for those pawns, its households' first heirs ranked once each), its tie to its culture's centre (`updateTie`,
  `src/sim/society.js`), the causes its adults take up and its meeting, whose lines go to the head of `st.meetingLog`; roles and standing
  island-wide, and the living of no settlement, at the first village's; then its choice of gathering (`chooseGathering`,
  `src/sim/gathering.js`, VB-294: the hosts it would walk to, ranked by effective hours from its row of `st.villageHours`, and whether it
  offers to host, by the meeting's verb `gathering`). At 18:00 the gatherings are settled (`settleGatherings`: who goes where, lodging,
  three villages or more; the district is read by `district`), then each culture's year; at 18:06 the land meeting.
  `meetingStage(st, n)` is the step's entry; `holdMeetings` runs the villages and the cultures. The meeting's occasion on each green is
  called for its village's turn: from two hours before its step to the step after.
- The fair (VB-302): `src/sim/fair.js`. As a household's goers set out for the gathering (`gatheringSetOut`, emitted by
  `src/sim/gathering.js` beside the lodging and the call of its days), its first adult goer packs the household's margin as `pawn.load`
  through `sim/stores` (reason `fair`), the goods that cost it least by need (`needValue`) against their customary worth first, a back
  load less a sack's room. At the fair's hours (`FAIR.hours`; one `sim/clock` row while loads are out) the dealers present propose, in
  the stream `fair`'s order, to their partners and then to `FAIR.others` others, the deal best for themselves, as an offer on the basis
  `swap` (`sim/offers`); the other answers by need and `dealAllowance` (`sim/exchange`: goodwill and opinion only, near zero between
  strangers). The verb `swap` moves the goods load to load and books the residual in customary worth between the two; a hard bargain is
  a memory. The fair's log line (kind `fair`) counts the deals, the worth by good, the deals that failed for want of change and the hard
  bargains. A dealer home again after its gathering puts its load into the store; one who dies on the road leaves its grain lying
  (`sim/lying`). Reads gathering, exchange, offers, relations, stores; writes `pawn.load` and `st.fair`.
- The asks for goods (VB-699): `src/sim/asks.js`, on `planReviewed`. At a household's review it closes its asks that are met (it holds
  its need) or a year old, and asks for each good of `FAIR.goods` that `sim/targets` says it needs, lacks and cannot make where it lives
  (the place's bound beyond the need is 0: no pit or pine for tar, no shore for dried fish); one ask a good, `ASKS.cap` a household, on
  the basis `swap` (or `gift`, with nothing to carry). From its first review of autumn, once a year, a head whose place makes a good reads
  that good's open asks (`st.asks.open[good]`; `VB.count.asksRead`) from its own village and, from a skill of `ASKS.hears`, the district
  of its gathering, and reckons `plan.placed`: the units asked times its lean (`plan.head.bias.hours`), within its spare hands and a back
  load. `sim/seasonal`'s `goodTargets` adds it to the need, so the maker makes more, and the dealer carries the margin to the fair, where
  a swap meets the ask. Nothing is priced and no good is moved here. Reads targets, fair, gathering, seasonal; writes `st.asks` and
  `plan.placed`.
- Saves (VB-074): `Sim.save(st)` and `Sim.load(w, data)` in `src/sim/saves.js`; a generic codec keeps shared objects, Maps, Sets and typed
  arrays, and the tiles the simulation changes are saved with the state (its `WORLD` list: a new world field the simulation writes goes there).
  `st` is plain data (VB-073, `tests/plaindata.js`): no functions, and no state kept aside in module closures, or a loaded run drifts
  (`tests/saves.js` catches it). A loaded run matches the unbroken one given the same `Sim.advance` calls.
  Derived state (VB-239) is one list, `DERIVED` in `sim/saves`: each field of `st` a save leaves out, with what rebuilds it on load (a new
  cache of `st` that can be rebuilt goes there; the tests comparing a loaded run and `tools/same.js` leave them out, the invariants check them
  against their sources). A save of another format is refused, and `load` keeps no migration: no one holds a save of an older build (Kim).
- The record of events (VB-075): `st.record`, typed events written by `log(st, text, event)` and `personEvent(...)` in `src/sim/records.js`
  (`false` when another call records the same happening); `Sim.recordOf(st, {pawn, household, farm, village, kinds, from, to})` queries it.
  A new log line names its event's kind, pawn and place (`atHousehold`, `atFarm`); `tests/record.js` checks every call.
  Bounded history (VB-199): `pawn.events` holds positions in `st.record`, read with `Sim.recordOf(st, {pawn, life: true})` (`sim/notable`,
  `lifeOf`); a new kind of event goes into `HISTORY` (`sim/records`), 0 to keep it or the years after which `foldHistory` folds it into
  `st.recordYears`, one count per kind, village and year (a folded slot of the record becomes its count's index; slots are never removed).
- Relationships (VB-127, VB-240): `src/sim/ties.js` owns familiarity (`pawn.ties`, on a decay scale per pawn). `src/sim/relations.js` owns memories of events
  (`pawn.rel`, kinds of `SOCIAL.memories`, written by `remember`; a record exists only while it holds one) and the close-friend and enemy
  bands (`pawn.bands`). Opinion is derived when read (`opinionOf`): the kin bond, plus affinity (the pair's compatibility, shown as the tie
  grows), plus the memories. Talk grows the tie only; its kind is the bubble's. A band is checked by `touch` where a pair's tie or memories
  change (a talk, a job together, the day's hours at home, the kin floor, `remember`, the season's pass), never by a pass over pairs.
- Encounters (VB-521): `src/sim/encounters.js` owns who meets whom, a table `ENCOUNTERS` of kinds (`house`, `outdoors`, `pasture`,
  `occasion`), each with who is present, how a partner is drawn and the mix that lets strangers meet; the talk round of `sim/relations` asks
  it for partners at each pawn's turn (every `SOCIAL.talk.every` waking hours, by id). `present` reads those who came to an occasion and
  `said` is the one door by which something is made known to them all. It keeps no state, reads no plan and has only social effects.
- Occasions (VB-126): `src/sim/occasions.js` calls a gathering at a place from a start to an end (the village meeting on the green on autumn
  day 10, for its village's turn, a wedding the day after a marriage, a funeral ale the day after a death), asks its guests and keeps `st.occasions`, a due-queue the
  six-minute step reads at its head only. Those asked set out by the verb `attend` and stand about the spot until the end (`agent.occasion`);
  talk there is talk as anywhere. The gathering of villages (VB-295) is the next kind. What the host lays out at its farm (the ale poured,
  the feast, what guests owe) is `src/sim/feast.js`; the ale evening and the season's rite (their asking, the verb `callAle`, and what their
  end does, declared to `onEnd`) are `src/sim/venues.js` (VB-1270). Every kind's end is a row of `onEnd`'s table (VB-1006): a new kind
  adds its row (the meeting's and the call's free those present; the wedding's and the funeral ale's pour, feast and log), not a branch.
- Notable events (VB-098): `Sim.notable(st, ev, about)` in `src/sim/notable.js` gives the reasons a record event is notable (keys of
  `Sim.NOTABLE`: family, holder, hunger, farm, custom) or null, for the pawn the player follows; `Sim.eventLine(st, ev)` tells an event in one
  sentence. A read-only view with no state. The page's toasts (`src/page/notices.js`) read both; a new notable kind is added there, not in the page.
- Gatherings while they are on (VB-1031, VB-1032): the record tells an occasion when it is over, so `Sim.gatherings(st, id, seen)`
  (`src/sim/notable.js`) reads `st.occasions` for those that concern a pawn as they begin: the page's notice, and the skip's stop for a
  wedding or a funeral ale. `src/page/gathering.js` draws a mark over each occasion that is on and opens its card of who is there.
- Opportunities (VB-209): `Sim.opportunities(st, id, near)` (`src/sim/opportunities.js`) lists what a pawn may do here, each a command with its
  holder, basis and the rule that bars it: its household's and village's work (from the kinds' `available`, with the planner's fit), its own
  acts, a cause, and the moving round's acts. Computed when asked, never stored; it reads through `actorView`, which filters nothing yet. A rule
  it shows says why not itself (`staysWhy`, `barred`, `unfit`, `fit`): a new bar is added to the rule, not here.
- The chronicle (VB-099): `Sim.chronicle(st, {pawn | farm | village}, group)` and `Sim.villageLog(st, n)`, also in `src/sim/notable.js`, are the
  record as a history, newest first, and as the village log (`st.events` is gone: `log` writes the record only). `CHRONICLE` names the
  filters by kind; a new event kind that belongs to one is added there. The History tab of the selection card is `src/page/history.js`.
- Customs on the page (VB-396 to VB-398): `src/page/customs.js` is the Customs tab of a village's card, the customs as sentences (`SAID`; a
  new custom or option gets its phrase there), who stands by which way, and a voice's note (its pulls from `src/sim/leanings.js`, a
  read-only view, weighed by `sim/attitudes`' `WEIGH`, the factors the daily drift itself reads, so the note and the drift cannot disagree); `src/page/culture.js` is the dock's Culture pane: a culture's villages, its own charter, the meetings.
- Decisions (VB-313; target-v2 4.5): `src/sim/decisions.js` settles a body's question with several voices. The module that poses a kind
  registers it at load (`defineKind(kind, {procedure, evaluate, fallback, choose?})`); `ask(st, question)` runs the body's procedure
  (`procedureFor`: `vote` or `agent`) and keeps a contested question's ballots in `st.decisionLog` (the last 30). A tie goes to the presiding
  pawn (`setPresider`, VB-314), else the fallback. The presider at home is the body's agent (`agentOf`, `agentWhy`; VB-673): the one pawn
  through whom a village acts, so that with the office vacant or its holder away nothing of the village's is begun. Today one kind, `custom` (`sim/meetings`; asked from `Culture.meeting` through
  `hooks.ask`); VB-293's marriage offers stay in `sim/offers` until a follow-up moves them.
- Commands (VB-167 to VB-171; VB-228): `src/sim/commands.js` is the dispatcher alone (`register`, `issue`, the table `VERBS`) and imports no
  domain. Since VB-1405 `perform` gives the queue done, refused(why) or pending(ref), through the one path `issue` takes; a verb whose act
  lasts registers `active(st, cmd, ref)`, and the queue (`sim/player`) asks it, keeping the reference in the save (work's: the pawn's
  numbered assignment in its slot, `agent.assigned`, sim/attention). Each module registers, at load, the verbs of the acts it carries out: `sim/agents` (`work`, `walkTo`, `goHome`, `idle`,
  `haltForTalk`), `sim/away` (`lodge`, `comeHome`), `sim/building` (`raiseBooth`, `dropBooth`, `letIn`: a staked booth is its maker's project plan, VB-1172), `sim/gifts` (`give`, `deliver`), `sim/occasions` (`attend`, `call`), `sim/venues` (`callAle`),
  `sim/offers` (`offer`, `answer`), `sim/visits` (`visit`), `sim/plans` (the head's plan), `sim/routines` (`routines`; the alderman's `layOut`, VB-673), `sim/workdays` (`callWorkday`),
  `sim/tar` (`chargeTar`), `sim/help` (`fillStore`), `sim/aims`
  (`plotToVillage`), `sim/society` (`decide`, `argue`, `dropCause`, `rally`), `sim/gathering`, `sim/trust` (`goBack`, `goToKin`),
  `sim/marriage` (`marry`), `sim/heirs` (`handOn`, `move`), `sim/farmclaims` (`claim`), `sim/settle` (`leave`), `sim/membership`
  (`foundHousehold`), `sim/cottage` (`finishCottage`), `sim/lifecycle` (debug `kill`, `retire`), `sim/clock` (`skip`). A verb's home is
  the module of its act, and where its body calls several, the highest in load order, so that it imports downward. The guards the
  checks share are lookups where their subject lives: `living`, `home`, `settlement` in `sim/records`, `free` in `sim/agents`. The
  player (its queue, wish, answer and choices as head) is `sim/player`. The planner, the meeting, the moving round and the debug drawer act by
  `issue(st, {actor, verb, target, args, source})` (`Sim.command` for the page); a verb checks that the act is possible and returns why not.
  A new act a pawn or the round chooses gets a verb; `tests/commands.js` checks statically that only the verbs call the acts they wrap.
  The head's plan (VB-253): `target` (hay, fields, wood, cow, within bounds), `tile` (the next field's or meadow's, under `fieldWhy` and
  `meadowWhy`), `order` (the season's routines), `project` (a field or meadow begun, or `none`: projects held off) and `dropProject`; only
  the household's head may issue them. The player's go through `Sim.head(st, verb, args)`, the holder's land step issues `project` with
  source `pawn`; the choices lie in `plan.chosen`, `plan.tiles` (`src/sim/plans.js`) and the seasonal plan's `by` (`src/sim/seasonal.js`, whose `setOrder` the verb `order` calls), and `Sim.headView` reads
  them for the page (`tests/head.js`), with the custom's targets beside the head's and the head's skill and horizon (VB-254).
  The head's crops (VB-355): `rotation` (the farm takes any rotation it has seed for; `hold` keeps it against the village's usual one, `null`
  gives the choosing back to the rule, which itself issues the verb with source `pawn`: `rotationChoice`, `sim/rotations`) and `sowOutOfTurn`
  (one field bears another crop, or rests, for a year: `fd.turn`); their checks are `rotationWhy` and `turnWhy`, and `Sim.fieldView` reads a
  field, with each choice and why not, for its tile's card (`src/page/tileinfo.js`; `tests/sowing.js`).
  The automatic head's choice by foresight (VB-351): `sim/rotations` sorts heads by skill into the fifths of `SOWING` (`tierOf`), and gives
  `sim/plans`' review its rotation (`rotationChoice`: a poor head keeps its own, an ordinary one the village's, a good one with a second
  crop weighs them at the winter's first day by its bias, `pawn.cropBias`) and one act on its fields (`fieldsChoice`: the verb `courses`,
  two free fields exchanging their steps so the worn one rests, its check `swapWhy`, its act `sim/courses`' `swapSteps`; or `sowOutOfTurn`
  for a poor head's hungry year and the year after a failed crop, `farmstead.failed`). The trial is a good head's project of `sim/aims`'
  menu with no project plan (`plan.aim.trial`), sown out of turn in its window (`tests/foresight.js`).
- Foresight (VB-254): `src/sim/traits.js` holds the stand-in traits (`pawn.traits`: wits, husbandry, diligence, ambition, generosity), drawn
  from the stream `traits` at birth (`sim/births`) and for the living at the start (`sim/scenarios`' `startStreams`, after the streams are
  split), and read only through `Traits.of`. `sim/seasonal` (split from `sim/plans` by VB-431) keeps each household's head as planner (`plan.head`: its pawn, since when, its bias
  on the wood, hay, seed and fields targets), drawn at the plan's making and on the event `newHead` (`sim/heirs`, a succession), never at a
  review; the bias multiplies the template's targets at the seasonal plan, and the head's horizon (by its skill) adds what it projects to the
  woodpile and the hay at each review (`targets.ahead`). Tests written against the template's targets make their heads plan by it
  (`tests/lib/heads.js`); `tests/traits.js` checks the rest.
- A head's projects (VB-255): `src/sim/aims.js` (agency, after `sim/heirs`) hears `sim/plans`' `planReviewed` and `stepDone`; once a
  year after the autumn count, and after a project of the head's ends, it reads the surplus (the plan's targets met, food over 1.5 years
  of need and the seed, the hands idle over a third of the last season by `household.workHours`, which `sim/work` counts as work is
  reckoned), computes the menu (a field, a claim as a new meadow, a farm for the heir, a barn) and draws one from the stream `plans` by the
  head's lean (`Traits.of`: ambition, generosity); it acts through the verb `project` (`sim/plans`), whose whats beyond a field and a
  meadow are the makings of `src/sim/makings.js` (VB-678: a registry, each making declared at load by the module that carries it out,
  with its one check `why` and its plan `begin`: the barn and the farm for the heir here, which tells `sim/expansion` by the event
  `heirFarm` to begin a plot held by the household, `plot.by`; the boat by `sim/drying`, the cart by `sim/carts`, the tar pit by
  `sim/tar`). Those three have a `look`: once a year, at its first review on or after the making's `from` (the drying season, summer,
  winter), a head not holding off projects asks the making's `want` (grain and hands to spare; loads carried on the back; the most hands
  of a pine village) and begins it through the verb; `plan.weighed` keeps the year of each look. No project is begun by the calendar.
  It keeps `plan.aim` and drops its project when the food has stood under the measure a season. The barn's stages are `sim/building`'s kinds, which set `farmstead.barn`;
  `sim/hunger` and `sim/byre` halve the spoilage on a farm with one (`BUILD.barn.loss`). `tests/aims.js`.
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
- `Culture` (`src/culture.js`) holds the customs in force: culture-wide customs and per-settlement practice, and their only writer
  (`setPractice` the one write of a settlement's practice), with the causes (`advocate`, `entrepreneurs`, `endCause`), the villages'
  meetings, the yearly reckoning and the split. `sim/attitudes` (VB-417) holds what each person holds: the attitude, its anchor and its
  leanings, their only writer (`seedAttitude`, `inherit`, the daily drift `dailyStep`/`settlementStep` weighed by `WEIGH`; culture moves
  them through `pull` and `hold`). `sim/norms` (VB-417, kernel) holds the norms on goods (`WORTH`, `CLASSES`, `PROPER`, `norm`).
  `sim/customs` (VB-231, kernel) holds the catalogue (`DIMS`, `ARCHETYPES`, `PRACTICES`, `fromArchetype`) and the one door every module reads a custom in force through: `inForce(st, key, settlement)` (the option's key),
  `inForceAt(st, k, settlement)` (its index) and `customOf(st, key, culture)`; outside the two, no module of `src/sim` indexes a practice array
  (the lint). `node tools/customs.js` lists each custom's readers.
- Saves in the page (VB-214) are `src/page/saves.js`: `{build, savedAt, label, save: Sim.save(st)}`, gzipped, in IndexedDB (an auto slot and
  three by hand for each archipelago) or a file; the build id is written by `build.py`, and a save of another build is refused by the
  page, not by `Sim.load`. The landing page and the loader (`src/page/loader.js`) lead to it; it keeps nothing in `st`.
- The interface's theme (VB-1161) is `src/page/options.js`: the main menu's Options screen, and `glass` (the default, the stylesheet as it
  stands) or `mural`, set as `data-theme` on the page's root and kept in localStorage (`vb.theme`), never in `st` or a save. A theme is the
  rules under `:root[data-theme="..."]` at the end of `src/head.html`; the meter gives its fill's start and end as `--lo` and `--hi`, so a
  theme can draw a level another way than as a bar's width.
  With no game open, the loader raises a tiny showcase island behind the menu screens, on one of a pool of seeds (VB-307; `demo`, page state): a run of its own at 3x,
  never saved and never a game to go back to; `build` drops it.
- The page script (`src/page/*.js`) draws and only reads `st`. It writes to `st` through the `Sim` API and three flags:
  `visualDirty`, `naturalDeaths`, `driftMul` (and it clears `rigDirty`, `farmDirty`, `villageDirty`, `treeDirty`, `biomeDirty`, `pathDirty` and `landDirty` after redrawing); the lint enforces this.
- `src/vb.js` creates the `VB` namespace; `src/load.js` loads the modules in Node for the tests.
- Review tools (VB-337), outside the simulation: `tools/hours.js` (`node tools/sim.js --report hours`) samples a run's agents and fields at
  every step for a household's pawn-hours by job kind and the farming year's days; `tools/stocks.js` maps each stored quantity's adders,
  takers and readers from the writes map (`tools/writes.js`), with a hand-written line a quantity on what happens at none.

## Layers (VB-230)
Each module's layer is in `src/layers.json` (a module without one fails `npm test`); target-v2 3.1 gives the rule: calls go downward, reads are
free, influence goes upward by a command, an event or a hook. Composition roots stand apart: `sim/clock`, `sim/saves`, `sim/scenarios`, `sim`.
- Kernel and world: `vb`, `gen`, `gen/*`, `sim/norms` (the norms on goods, VB-417), `sim/rules`, `sim/crops` (the crops, rotations and soil), `sim/roles` (the roles and their work, `MATCH`), `sim/house` (a well-kept house), `sim/registry`, `sim/events`, `sim/rng`, `sim/due` (the due-queue helper: search, insert, removal and take over a sorted list its owner keeps, VB-1473), `sim/hex`, `sim/names`, `sim/walking`, `sim/routes`,
  `sim/villagehours`, `sim/paths`,
  `sim/fish` (a river's stock, no actors), `sim/layout`, `sim/forest`, `sim/people`, `sim/records`, `sim/traits` (the stand-in traits and a
  head's skill and bias, VB-254), `sim/skills` (VB-475: a pawn's skill at each type of work, a stand-in that does not grow, from the stream
  `traits`, and a work leg's pace: skill and a mishap from the stream `mishap`; `sim/agents` writes `agent.pace` at the leg's start and
  `manning` reads it; VB-360: a pawn's crafts, `pawn.skills`, learnt by doing and fading, read in closed form: a kind names its `craft`,
  the leg's pace reads its level, and `sim/work`'s `settle` practises it with the hours worked), `sim/commands`, `sim/customs` (the catalogue of customs and the door to the customs in force, VB-231).
- Material and land: `sim/projects` (the project plans' record and reads, VB-123), `sim/holding` (who may come to hold a farm: one table of the bars, each way to a farm the list it reads, and the household that goes with a new holder, VB-688), `sim/makings` (the registry of what a head begins through the verb `project`, VB-678), `sim/projectplans` (their one writer; VB-431), `sim/goods` (trade goods, grain subtype identifiers and the worth and propriety rules of `sim/norms`), `sim/stores`, `sim/targets` (the head's target on each made good, VB-698: the registry of goods with a maker, each declared by its maker; `sim/seasonal` compiles `plan.targets.goods` at the review and the verb `target` sets one within `bounds`), `sim/larder`, `sim/pot`, `sim/hunger`, `sim/foodneed`, `sim/quern`, `sim/fieldplans` (household demand, site selection and project planning), `sim/rotations` (crop choices and the village custom), `sim/courses` (a field's course in its rotation: the next step, a rotation taken and staggered, a new field placed, steps swapped, a crop out of turn, the crop last lost; VB-1479), `sim/newground` (a field's site cleared and its ground broken; VB-1479), `sim/fieldrec` (the one constructor of a field's record, `newField`; VB-1528), `sim/soil` (soil, tilth and manure; VB-1479), `sim/fields` (a field's crop year), `sim/meadows`, `sim/byre`, `sim/carts`, `sim/tar`, `sim/saltpan` (salt boiled at a spring, VB-700), `sim/ironwork` (the tools' condition, smelting and mending, VB-701), `sim/grazing`, `sim/spread` (forest spread into open land: the front `st.front`, scrub, what keeps land open, the hours scrub adds to clearing; VB-091; the lapsed ground `st.lapsed` of fields let go, wild again after `LAPSE.years`; VB-1527), `sim/herds`, `sim/ownership`, `sim/claims`, `sim/disputes`,
  `sim/stakes`, `sim/territory`, `sim/cottageplan` (the cottage as stages of a plan, a plot's and a settler household's), `sim/expansion`, `sim/building` (the cottage's stages as kinds, and what building takes: timber, VB-328),
  `sim/fieldwork` (the job kinds of a farm's fields, beside `sim/fields`, VB-418), `sim/chores` (the job kinds of the household's daily work at
  the house: firewood, water, cooking, brewing, gathering, VB-418),
  `sim/green` (the village green and well as a project plan of the village and its job kinds, a village duty, VB-058), `sim/lying` (loads left
  lying where their carrier fell, VB-611), `sim/droving` (animals that change household, led home from where they stand, VB-674).
- Social: `sim/attitudes`, `culture`, `sim/encounters`, `sim/relations`, `sim/courting` (VB-036), `sim/society`, `sim/deaths`, `sim/births`, `sim/heirranking`, `sim/heirs`, `sim/membership`, `sim/allotment` (who gets a plot, and the moving round's plots), `sim/cottage`, `sim/settle`, `sim/obligations`,
  `sim/farmclaims`, `sim/service`, `sim/matching` (marriage rules), `sim/workdays` (the village's work days,
  a routine of its meeting: the fence closed in spring, the commons cleared in summer, who turned out and who stayed away, VB-120).
- Agency: `sim/legs`, `sim/work`, `sim/attention`, `sim/agents` (VB-422), `sim/away` (the stays away from home, VB-783), `sim/gifts` (how a gift gets from here to there: the verbs `give` and
  `deliver`, VB-228; a new household's start laid at its old homes and borne or fetched, VB-675), `sim/occasions` (gatherings; agency since VB-228, as target-v2 4.5 has it: its verb `attend` walks the pawn), `sim/player`
  (the player as a source of commands, VB-169, VB-228), `sim/trust` (farms held in trust by kin, VB-309), `sim/jobs`, `sim/kinds`, `sim/exchange`, `sim/help`, `sim/lifecycle` (deaths, retirement, the daily life step), `sim/marriage`, `sim/gathering` (the village's choice of gathering, VB-294), `sim/meetings`, `sim/asking` (the asking day, VB-823), `sim/round` (split from it, VB-876), `sim/eligibility`, `sim/seasonal` (a household's seasonal plan and targets: the template of the year, the head's bias and foresight), `sim/routines` (the village's routines and its review's steps), `sim/plandays` (planning days and the due-queue), `sim/plans` (the standing plans and the head's choices; split by VB-431),
  `sim/estimate` (the head's estimate of a task, VB-476: its hours by the causes the head's judgement reckons with, in the order of
  `ESTIMATE.reckons`, leaned by `plan.head.bias.hours`, with an honest range; worked out when read, nothing stored; `sim/jobs`' `allot` mans a
  task by it, and a window missed (`sim/fields`' event `windowMissed`) outside the range is told on the record as `misjudged`; a kind's
  `norm` gives a normal crop's hours), `sim/outlook` (the supply outlook, VB-666: how long food, fuel and hay last, in seasons, by the head's reckoning at its review, with its doubt, VB-669; kept
  in `plan.outlook`, read by `Sim.supplyOutlook`; it follows `planReviewed` and nothing reads it to decide).
- Derived views: `sim/notable`, `sim/opportunities`, `sim/overview` (a village at a glance, `Sim.villageSummary`, VB-162) (read-only, computed when asked).

## Adding things

To time or count a function in Node, call `loadModules({ wrap })` from `tests/lib/load.js` before loading the simulation. Key each wrapper factory by module and export name, as in `tools/perf.js`.
- Put the module in its load list and name what it owns or supplies in the first-line `@sys` declaration. Describe the boundary
  in terms of the work and state the module handles. A module that changes another's state calls the owner's operations.
- A module has no cap on its length (VB-413): over 700 formatted lines (`src/` is formatted by Prettier, `npm run format`) the lint asks for an open task titled "Refactor: split <key> ...", opened by the task that
  takes it there (VB-414). The same task is asked for when a module over 15 exports gains one (VB-415; the `sim` facade is not counted, nor an export read only by a registry: a job kind's `done`, a calendar entry's `run`, a verb's body; the list is `REGISTRIES` in `tests/lint.js`, VB-454). Put code where its concern lives, not where there is room.
- Tunables: a table one domain reads lives in that domain's module with a `// @tunable NAME: meaning` line above it (VB-419;
  `grep -rn "@tunable" src`, the lint holds it for each table that left `sim/rules`); the tables several domains read (the calendar, `ECON`,
  `FOODS`, `HERD`, `TRAVEL` and the like) stay in `src/sim/rules.js`; `KINDS` (job kinds) in each domain's module, joined by `src/sim/kinds.js`; `RIVERS` and `FORDS` in `src/gen/rivers.js`; `LOOK`
  (worn paths) in `src/gen/paths.js`; `DIMS`, `ARCHETYPES` and `PRACTICES` in `src/sim/customs.js`.
- A new job kind is one record in the `KINDS` of the module whose state its work changes (VB-418): numbers, type of work, labels, where to
  stand, urgency, and what finishing and delivering do, beside the rules its `done`, `deliver` and `available` call (the field's kinds in
  `sim/fieldwork`, the byre's in `sim/byre`, the household's daily work at the house in `sim/chores`). A kind that takes from one module and
  puts into another lives in a module at or above the layer of both (`src/layers.json`), never in the lower one. `src/sim/kinds.js` is the
  registry: it describes a kind's fields, joins every module's `KINDS` in a fixed order (a new kind is added at the end: the order is part
  of saved state), and holds `ASK`, the order in which `refreshJobs` (`src/sim/jobs.js`) asks the kinds' `available`; a new kind gets its
  line in both. It holds no kind's record and no domain's rule. Roles rank types of work (`work` in `ROLES`, with `except` for single
  kinds), so a kind of an existing type needs no role numbers. Its `anim` names an animation in the page script.
- Something that runs at a time (each step, hour, day, season or year, or on a named day or step) is one entry of `CALENDAR` in
  `src/sim/clock.js`, inserted where it should run in the order; `tests/clock.js` holds that order (`ORDER`, re-recorded on purpose).
- A new stored quantity (a household's, a farm's, a village's or a tile's) adds its line to `QUANTITIES` in `tools/stocks.js`, with
  what happens when there is none; `tests/review-tools.js` fails for a field of the `@state` lines in neither its lines nor `NOT_STOCKS`.
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
- A new custom adds a `DIMS` entry (its `key` and `opts`) and a value in each `ARCHETYPES` entry; offsets are computed from `DIMS`.
