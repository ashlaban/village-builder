# New interface (ui2): where it stands

**On main since 24 November (PR #289), as partial work: the new interface shows in the solo scenario only** (`u2Live()` in
`src/page/ui2.js`; every other scenario, the start's menus and the editor are the old interface's; `?classic` shows the old one in
solo too). The task numbers below are as renumbered at that merge (this work's VB-1615..1642 became VB-1643..1670: main had taken
the first seven; commit messages before the merge keep the old numbers). Kim's brief (24 November): hide the current interface, build a new one with an aggressive
focus on usability and expressiveness, phone and desktop, playtested by Opus agents; drafts shown from time to time; earlier UI
design instructions may be ignored. Scope: the solo scenario at the first player scale, choosing the site of the first farm and
planning days and weeks through the first year. Kim's later notes: the interface must feel part of the map, not a layer on top
(answered: state on the land, act by tapping the land, lighter chrome, site choice on the land; "map first, panels second").
Kim prefers clarifying questions and small batches.

Drafts page (screenshots and both rounds' findings, newest first): https://claude.ai/artifact/6ZDU7Uo3wRTw6m8DiAcJxG

## Kim's direction, 24 November (second session)
- Icons are the primary means of communication on the map: a mark is an icon with at most a number; the words are a tap or two away.
  Not everything is visible at once, but everything is discoverable.
- The played settler is planned by hand, automatic planning off (the automatic mode is for unplayed pawns). The player needs tools to
  plan the day, the week, the season and in the end the year; what is explicit in the interface is ours to explore. How a manual and
  an automatic plan meet is for later.
- Night work is possible at a cost; sleep is a planned act; lack of sleep costs mood and, less at first, health.
- The daily necessities (water, cooking, the animals) are a daily routine in the plan, set sensibly at the start, changeable.
- Sub-agents for this work are Opus.

## Built in the second session
- Pins (`fieldPin`, `hudMarks` in `src/page/ui2hud.js`): a field is its crop with the days to ripe, or the tool it waits for with
  the days left to sow; the work site its tool; the house three goods over their meters. A queued job is a pin at its tile with its
  place in the queue (square, left) and the days until it is done (round, right), coloured by its verdict. One pin a tile.
- The callout's job buttons say the hours and the verdict in words (`hudStake`).
- VB-1644, `Sim.agenda(st)` (`src/sim/agenda.js`): the queue laid end to end in working hours and the open work, each with the
  pawn's own estimate `{lo, mid, hi}`, its deadline, a verdict (`in time`, `tight`, `late`), and for a field project's step `then`,
  the steps left before sowing.
- VB-1643, sleep (`src/sim/sleep.js`, `st.player.sleep`, the verb `sleep`, `Sim.sleepOf`): half an hour owed for each hour awake;
  the mood modifier `tired` past 8 hours owed, health from a whole night owed. Only the played pawn (VB-1645 opens it to all).
- Measured with automatic off, before: ordered work ran through the night at no cost; nobody fetched water or cooked.

## Built in the third batch (24 November)
- Planned by hand: at "Begin the first day" (`hudBegin`) automatic planning goes off, the routine is water, cooking, fodder and
  milking, and sleep is 22 to 6.
- VB-1646, the plan (`src/sim/playerplan.js`, `st.player.plan`, `Sim.plan(st, op, args)`, `Sim.planView(st)`): the routine once a
  day, the sleeping hours, tasks in order by job key; the feeder in `playerStep` follows it when the hand queue is empty; a task
  broken off for the night is taken up in the morning. A command queued by hand ("Do it now") goes first and is not broken off for
  sleep: that is how a night is worked.
- VB-1647, `Sim.agenda(st)` gains `days` (three days of segments by the hour), `plan` (each task's hours, end, verdict), `owed`
  (sleep owed at each day's end) and `routine` (each kind's hours a day).
- The plan bar (`renderPlan`, `planCard` in `src/page/ui2hud.js`): routine chips, the sleep chip (its number once a night is owed),
  then the tasks in order with their days; a chip's card holds the words and the acts (earlier, later, remove, the sleeping hours).
  Work is added from the land: a tile's callout offers "Add to the plan", and "Do it now" beside it.
- The day strip (`src/page/ui2day.js`): today by the hour; a tap opens three days. Every planned task is pinned on the land.
- The three sheets are icon buttons now and predate this direction.

## Known after the third batch
- A task is one job: when a clearing is done, the breaking, hoeing and sowing that follow are not in the plan until the player adds
  each (the callout says how many days the chain takes). A task that follows its project through is the likely next sim step.
- With the routine alone the settler loses health to cold and damp: no booth is raised unless planned (the automatic settler raises
  one). The sleep card says so after a rough night; the house should show it as an icon.
- The agenda's `owed` counts free daytime hours as awake, though a free pawn at home sleeps: it can read too high.
- A task is matched by its job's key; a clearing posted again under the same key would be taken for the same task.
- No playtest round has been run on any of the second session's work. VB-1648 splits `page/ui2hud` (over the lint's line).
- The agenda's estimate assumes the pawn's own hands only.

## After the third batch: plant task, roof warning, and round 3 of playtests (24 November)
- VB-1649: a plant task (`Sim.plan(st, 'add', {plant: tile})`) carries a field from clearing to sowing as one task; the callout
  offers "Plant this field", and "Break a field here" plans the field through when begun at once. Seen in the page: one task, the
  field sown on spring day 7.
- What took of the settler's health last night is an icon at the house (`hudAils`: no roof is the red cold mark), words in its callout.
- Round 3 (two Opus players, phone and desktop, on the build before these two; neither reached the next spring; the desktop year
  failed: barley lost to frost, no hay, food and wood at 0 in winter). Open, by weight:
  1. Hay cannot be planned by hand: no meadow or mowing is offered anywhere; "Make a hay meadow here" only marks the tile. Likewise
     "Break a field here" with work under way only marks, adds nothing to the plan, and the tile then offers only "Walk here".
  2. Two plans compete: the old sheets (Today's queue and "Do next yourself", Plan's building and order of work) against the plan
     bar. Both players queued from Today and saw nothing in the bar. The sheets must go, or become views of the one plan.
  3. Nothing warns when a crop is ripe or a window is closing while the plan holds no task for it (the frost took the barley unseen
     at 30x); no reaping was planned and none offered ahead of time.
  4. The day strip showed overlaps and work in the sleeping hours (hand-queued work laid over sleep and routine); routine kinds
     vanish from it under a long task, so one cannot tell whether the animals are fed.
  5. No reading of health or mood on the screen outside the sleep card; "No sleep" seemed to cost nothing (owed 4 to 7 hours).
  6. Numbers are not understood: the round badge on pins and chips (days until done), the two numbers on a task chip, the number
     on the sleep chip against the card's (floor against round), the strip's right-hand number, faded routine chips (done today),
     the house's three bars. The rule "a number is days" is not learnable without a word on the first tap.
  7. Pause does not hold after some clicks; the camera moves by itself (following), so taps land on other tiles; "Do next
     yourself" reflows under the finger; the banner hides a callout's close on phone; the sleeping hours are forgotten by "No sleep".
  8. Sowing offered late with contradicting words ("too late for ... to be sown today"); hoeing called ploughing.
  Worked: the sleep card, the deadline banner and ribbon, the hours-and-verdict line in callouts, reordering a task, Stores' bars.

## Fourth batch and round 4 of playtests (24 November)
- One plan: the Today and Plan sheets are removed (Kim: for now; later one representation, possibly edited from several places).
  Left: Stores, and the settler's card (`meHTML`: what it does and why, health, mood, what ails it, the log). VB-1648: the play
  screen is `page/ui2hud` (ribbon, sheets, clicks), `page/ui2plan` (the plan bar and cards), `page/ui2land` (pins, callout),
  `page/ui2day` (the strip).
- VB-1650: tile tasks are chains declared as data (`CHAINS` in `src/sim/playerplan.js`): `plant`, `hay`, `harvest`; a marked tile's
  task begins its project in its turn; `Sim.planGaps(st)` lists the windows pressing with nothing planned (red pulsing pins).
  Seen in the page: a plant task sown, a harvest task planned in spring brought in by autumn.
- Kim's rule for explanations, to give every playtester word for word: "If you want clarification, click the thing you want
  explained. Missing information on expansion is a bug. The information can be a few clicks away though."
- Harness traps to tell testers: `click ×` matches the speed buttons ("1×") and resumes the game (round 3's "pause does not hold");
  close by `click Close` or by tapping the button's coordinates.
- Round 4 (two Opus players, a whole first year each). Phone: field sown and harvested, hay made, no roof, no firewood, health 55.
  Desktop: nothing planned was ever done all year; animals starved. Open, by weight:
  1. UNEXPLAINED, first thing to find: on desktop the plan never ran (plant and hay tasks added, the strip showed the clearing
     every day, the settler only did the routine; a hand-ordered "walk here" stayed queued for 5 days and more). Not reproduced:
     a hand-ordered walk to the nearest tile of every terrain ends, on the probe island and in the page (`ot7`, site 1). Suspects:
     a walk to a tile that cannot be reached, a task on a marked tile waiting for a project that never begins, "No sleep".
     Whatever the cause, the screen must say why the plan stands still (the tester found no reason after any number of clicks).
  2. No way to raise a roof or to cut firewood by hand: the house's callout offers neither, forest tiles offer nothing, the booth
     and wood jobs have no tile the player thinks of. Work without an obvious tile needs a place: the house's callout (or the "+").
  3. Taps go through: the tap that opens a callout also presses the button that appears under the finger ("Added to the plan",
     "Queued: walk here" unasked). Likely the source of the stray walk orders.
  4. The map moves by itself: opening a task chip flies to its tile (`flyTo` in the plan bar's click), the callout's place jumps,
     and the next tap lands on another tile; the scouted button does not centre its place under the screen's middle.
  5. Pins and warnings cannot be tapped (they pass the tap to the tile under them, often another tile's): the red cold mark, the
     gap pin, the work pin. Against Kim's rule: every mark must explain itself on a tap.
  6. Not explained on a tap: health and mood bars, the moon's number at the strip's end, the "Resting" pill, the stores' colours,
     "Your order: you have turned its own plans off".
  7. The day strip is not believable: routine pieces overlap, a task shows daily though it does not happen, sleep is cut at
     midnight ("22:00 to 00:00"); a hand-ordered walk is named "null".
  8. Stores count on work nobody planned ("about 35 more counted on from work still to do": the head's automatic reckoning).
  9. Sleep costs too little to see: five nights without sleep showed "Owes 4 hours"; mood never left 50. (A pawn at home with
     nothing to do sleeps in the day; the cost needs work at night to bite.)
  10. Words: chain cards say "to a sown field" for hay and harvest (`hudStake`); the estimate's days and the pin's differ (work
      days against calendar days); "it" for the settler; "Break a field here" then a second tap to plan it.

## Kim's answers after round 4 (24 November)
- Wood: you cut wood or timber on a forest tile, and take it home, where it is 1) worked into firewood or 2) left as timber for
  building. So the forest tile offers the cutting (any forest tile within reach, not only the one the job picked: sim work), and
  the further working is at the house.
- A tapped mark: B, accepted for now: a tap on a pin (or anything standing on a tile) opens that tile's callout, with the mark's
  explanation in a band on top, its icon repeated beside the words, and the act right below. No popup of a mark's own.
- The booth: Kim does not see why a booth stands without a roof. The solo settler stakes a booth and sleeps under the open sky
  until it is raised (VB-1544), but the map draws the tent from the first morning, so the screen shows a shelter while the nights
  are cold. To do: draw a staked booth as staked (poles, no cover) until it is raised, and offer "Raise the booth" at the house.
  A booth, once raised, has its roof; nothing is built roofless.
- Sleep: two effects, both from the accumulated debt (the hours owed). Short term as now, but biting harder on the second and
  third night (one night lost is usually fine; much more and the wits go quickly). Long term, health is increasingly affected the
  longer the debt stands. Also: an idle settler at home sleeps by day, so five nights with no sleeping hours owed only 4 hours;
  the cost must bite when nights are not slept.
- Stores count what is in the plan. There is no "automatic plan": there could be automatic planning, and it is turned off. So
  nothing the head would have planned by itself may be counted on while the player plans (the outlook's `intakes`).

## Fifth batch (24 November, third session; branch `claude/zen-gauss-hpj14o`, which holds `claude/bold-lamport-xsgshf`)
- Round 4's stalled plan, found: a task on a tile only marked for the next field or meadow waited for the household's open project
  (the first field's clearing, begun at settling), which no task covered, so nothing was ever done; the agenda laid the clearing
  into every day all the same. Reproduced headless on `ot7`, site 1. The stray walk was not the cause (2,600 walks all ended).
- Kim: "that limitation should be removed. You should be able to start work at e.g. several fields at once, and realise that you
  need to focus on one"; and the start begins with nothing under way.
- VB-1651 (sim, done): the played head may begin fields and meadows side by side (`headView().projects`; unplayed heads keep the
  limit until VB-1472, with Kim); with automatic off the head begins nothing by its own rule; `Sim.seed(..., {site, hand: true})`
  lands with nothing under way; a task at a free tile needs no mark; `planView().tasks[i].waits` and `planView().idle` name why a
  task or the whole plan waits (`WAITS` in `src/sim/playerplan.js`). VB-1652 (ready): `unposted` should name the household rule.
- The page: a free tile's callout offers "Plant a field here" and "Make a hay meadow here" as plan tasks (the marking step and
  "Break a field here" are gone); a pin for every project; a task's card and the settler's pill say why it waits; a held task's
  chip is dashed. Seen in the page: two fields and a meadow planned on the first morning, all carried on side by side.
- Batch 2 (taps), done: a tap on a pin or the gauges is its tile's, the callout opening with the mark's words in a band on top
  (`hudBand`, `hud.pins`); the tap that opens a callout presses nothing in it (450 ms); a task chip no longer flies the map; the
  callout keeps clear of the deadline banner; a scouted place comes to rest in the free land between the bars.
- Open: on a phone a callout with no room above or below covers its own tile. `tests/browser.js` fails on this branch since
  before this session ("the page at 60 frames a second, 30x, ends 240 steps on in another state than Sim.advance headless"; also
  at d00fdc0): it wants its own repair task. No playtest round on any of this yet.
- Next, in order: items 3 to 7 below (1 and 2 are done).

## Sixth batch (24 November, third session, later): land first, the build menu, wood in two steps, the ladder
Kim's answers, 24 November:
- Wood: "Fell timber at the forest tile, and then cut firewood in the home. But this should be clear (warning at the home tile,
  no firewood. Tapping the warning gives you text 'No firewood' and a path to resolve it, 'Fell timber, then cut to firewood at
  the farmstead')."
- Building: "When starting the game in solo, nothing should be built, a construction menu (not tied to any tile) should be
  clickable and show an option 'Farmstead'. The farmstead initially, when built, is just a cottage. It should then be possible to
  upgrade the main building to a timber house, and then to a stone house, and also to add additional buildings, like the byre.
  The upgrade icons should be accessible from the farmstead tile through an upgrade icon." Asked: the booth is the first rung;
  the settler lands first and the Farmstead is placed from the menu; first the menu and the Farmstead from nothing.
- No playtest round for now. Work is off-loaded to Opus sub-agents (sim tasks by `vb-task`, the page by a general agent with a
  written brief and its own browser checks).
Built (all merged on `claude/zen-gauss-hpj14o`):
- VB-1653: wood in two steps for every household: felling (`wood`, 2 h) brings timber home (`household.timber`), cutting
  (`firewood`, 1 h) at the house; plan tasks `fell` (a tile, n trips) and `firewood`; `Sim.fireView`.
- VB-1655: the hand start lands on a camp (`farmstead.camp`, `src/sim/camp.js`): goods and animals, nothing built, nights in the
  open; the plan task `farmstead` places it (within 3 steps of the landing: decided without Kim, the farm record is the camp) and
  raises the booth; `Sim.buildMenu`, `Sim.placeWhy`. VB-1658: a camp on automatic does the same by the head's own rule.
- VB-1659: `src/sim/ladder.js`: `RUNGS` (camp, booth, cottage, stone), `OUTBUILDINGS` (barn), `Sim.farmView`. VB-1660: the plan
  task `upgrade` builds the booth up to a cottage (`src/sim/upgrade.js`), timber at home first (the played household only).
- VB-1657: sim/playerplan split into `playerplan` (state), `planchains` (CHAINS), `plannext` (nextOf, WAITS, HOLDS), `planview`.
  VB-1652: an `unposted` wait names the household's rule (`rule`, `text`). VB-1654: `tests/browser.js` mended (a shared world).
- The page: `src/page/ui2build.js` (the build button, the menu, placing with the site's reading, the upgrade card),
  `src/page/ui2wood.js` (felling on a forest tile, cutting at the house, the warning on the house's wood gauge with its path);
  the camp, the staked booth and the raised booth each drawn as what they are.
Open:
- VB-1661 (running at the time of writing): the outlook and `fireView` disagree on the fire; stores count only what the plan
  covers (Kim); `farmView().building` reports unplanned stone work; a firewood task waits days for a review.
- Kim's answers wanted: what a timber house gives over today's log-walled cottage; whether "stone house" is today's stone
  foundation; what a byre gives; whether the ladder is one rule for every household; how far from the landing the Farmstead may
  be placed (3 steps now).
- Not built: the stone rung and the barn as plan tasks, the timber house, the byre; the page shows `hours` 12 in the build menu
  though `buildMenu().work` now gives the plan's estimate; sleep's two effects (item 5 below); the day strip and the remaining
  explanations (item 6); a playtest round (item 7, held off by Kim).
- The inbox's reserved IDs clash with tasks made by `backlog.js new` in the same run: reserve through the inbox, or make
  follow-ups by hand as this session did.

## Seventh batch (24 November, third session, last): the ladder, placing anywhere, no project limit; merged into main
Kim's answers, 24 November:
- A timber house gives more room and a smaller fire; "If a household is over housing capacity tenants will receive a mood malus",
  and: "I meant everyone in the house (every one should be affected by crowding)."
- The stone house is today's stone foundation: "Yes. Maybe have the foundation as a separate property. It is also more prestigious."
- The byre (without one the animals lose condition faster in winter): "Agreed." The ladder is one rule for every household: "Yes!"
- Placing: "They should be unrestricted (but it will be more difficult to survive of course)."
- "Is the booth still in? If so remove it in favour of the farmstead ladder." Asked: a shelter on the house tile, each upgrade
  replacing it in place; settler households follow the ladder, travellers keep their booths.
- "The one project limit should be gone. For all projects."
- Words: "What is this thing about 'a cottage being roofed'? [...] When building a house/cottage/shelter you of course also build a
  roof." A building is "finished", never "roofed", in what the player reads; its stages are only the step under way.
- "I think we are ready to merge this as partial work. Enable the new gui only in the solo scenario and merge with main."
Built:
- VB-1661: one reckoning of the fire (`fireView().short` reads the outlook); for a household planned by hand the outlook counts an
  intake only when a task covers it, and lists what it left out (`parts.left`); no unplanned stone work; a firewood task waits a
  night at most. VB-1662: a fell task counts loads (a load is a tree, 3 timber), not trips.
- VB-1663: the foundation is a property of the house (`farmstead.grade`, `farmView().foundation`), not a rung; plan tasks
  `foundation` and `outbuilding` (barn). Its prestige is the standing term sim/society already reads ("A well-kept house on stone").
- VB-1665: the byre (`src/sim/byrehouse.js`, `farmstead.byre`; `HERD.openLean` 2 without one). VB-1666: the shelter
  (`farmstead.shelter`) on the house tile in place of a farm's booth, for settler households too.
- VB-1664: room (shelter 4, cottage 6, timber house 10: `ROOM` in `src/sim/house.js`), the mood modifier `crowded` for every member,
  the timber house (`src/sim/timberhouse.js`, `farmstead.rung`; an unplayed head builds one in winter when crowded). VB-1669: the
  woodpile's goals follow the house's fire.
- VB-1667: the farmstead placed anywhere reachable; the goods lie at the landing as loads and are fetched, the cart and herds brought
  over, by the farmstead task; a lone farm's village follows its house; `Sim.moveCost`. VB-1670: walks reckoned by the route, one
  trip count for the estimate, the plan and the agenda; a trip under way is not dropped at bedtime; the frost's day; the sim's words.
- VB-1668: no check refuses a project because another is under way; an unplayed head's own rule still begins one large project at a
  time (VB-1472 designs how heads choose).
- The page: the shelter in its three states; the upgrade card and the build menu (one list) with the cottage, the timber house, the
  foundation, the barn and the byre; placing anywhere with the move's cost; the landing's loads, cart and herds drawn; the stores'
  "Not counted" lists and their key; crowding in the house's callout.
Open:
- Left unattended after a far move the solo settler died in its second winter (no firewood, short food, sleep owed): the game by
  hand may be too hard to survive without close attention. No playtest round has been run on any of the third session's work.
- VB-1671, VB-1672, VB-1673 (below). VB-1656: `Sim.load` on a used world. VB-1645: sleep for every pawn. VB-1472: how heads choose
  among projects.
- `HERD.openLean` has never been seen to bite; cold household-days rose 522 to 533 on populous after VB-1669 (one seed).

## For the next session: the plan, in order
Kim wants clarifying questions and small batches; sub-agents are Opus. Items 1 to 4 of the earlier plan are done.
1. A playtest round (two Opus players, phone and desktop, a whole first year from the landing), when Kim says so: with Kim's rule
   for explanations and the harness traps given to the testers. It will say whether the year can be survived by hand.
2. Sleep's two effects from the debt (Kim's answers after round 4), and the day sleeping of an idle settler.
3. Explanations on a tap, what is left of round 4's finding 6; the day strip made believable (finding 7).
4. VB-1671 (the cart's first trip brings a load), VB-1672 (the move's frost warning in the plan's days), VB-1673 (the sim's reasons
   name a farm, not a household's number).
5. The site screen and the start's menus are still the old interface's in part (VB-1613, the site's choice).

How to work here:
- Seeing the page: `node build.js`, then patch a copy of `index.html` as `tests/browser.js` does (replace the `let st = null,`
  line to add `window.__play = { get st() { return st; }, Sim, setSpeed }`) and drive it with Playwright; the playtest harness is
  `docs/ui2/playtest.js`. Do not rebuild `index.html` while testers play.
- Sim work goes to Opus `vb-task` sub-agents through backlog tasks (`tools/inbox.js init --fresh`, `start ID`, then `apply` after
  merging the worktree's branch); the page is the orchestrator's. Checks: `npm test`, `npm run verify`, `node tests/smoke.js`.
- The page's work was given to an Opus general agent with a written brief (what the sim gives, what to build, Kim's words, how to
  check in a browser), one batch at a time, never two page agents at once; sim tasks side by side when their modules differ.
- The inbox's reserved IDs clash with tasks made by `backlog.js new` in the same run: use one or the other.

## What is built (first session)
- The flag: `UI2` (`src/page/ui2.js`). On by default; `?classic` in the address, or `window.VB_CLASSIC` (set by `tests/lib/page.js`
  for the page's tests and tools), shows the old interface. The old panels are hidden by one rule in `src/ui2.css`, not removed.
  The start menus are still the old ones.
- `src/ui2.css`: the new styles, spliced after `head.html` by `build.js`.
- `src/sim/landing.js` (`Sim.landing`): a site read before anyone settles (water, soil, wood banded 0 to 3, 9 in all; `why` no farm
  can stand; `best` the places scouted). `Sim.seed(..., {site})` lays the solo farm on the tile chosen.
- `src/page/ui2site.js`: the solo start. `build()` (page/loader) shows the land with `st` null (`landFirst`); the reading is a
  callout at the tile, scouted places are flags, lenses switch the old overlays; Settle seeds and plays the settler.
- `src/page/ui2.js`: the top band (date, year ribbon, speed, menu) and the marks on the land: `u2Marks(list)` / `u2Place()` anchor
  elements to tiles; a callout keeps clear of the bars.
- `src/page/ui2hud.js`: play. The year ribbon and deadline (`hudYear`), field badges, the house's three gauges, the work site's
  name, the tap callout (`hudCall`: open jobs at the tile, break a field or make a meadow here, walk here), and the Today, Plan and
  Stores sheets (through `Sim.head`, `Sim.queue`, `Sim.setAuto`).
- `pick()` (page/tileinfo) hands the map's taps to `siteAt` while choosing and to `hudTap` in play.

## Known and open
- **Not as Kim asked:** the homestead stands at once on the chosen tile. Kim wants the settler to land with goods and raise a booth
  or simple house. That needs a household without a farm in the sim (`hh.farmstead === null` is handled in places; `raiseBooth`
  exists). Its own batch; a sim change, to be scoped with Kim.
- The on-the-land version (Draft 2) has had no playtest round yet.
- Round 2 (a full first year each, on the earlier panels), still open: the player's choices barely mattered (the settler does the
  same alone); no hours, progress or yield on any job; the order of work is a long list with arrows; the settler's choices are not
  explained (why something more urgent was passed over; aims that change on their own); the stores are the head's reckoning and no
  ledger of in and out (food fell 100 to 43 in spring: seed, spoilage, unexplained on screen).
- Proposed next, awaiting Kim's word: an agenda of the next days with each job's estimated days against its deadline and a reason
  on each skipped item (partly sim work); or the booth start; or a playtest round on Draft 2 first.
- A rendering fault at phone widths: a panel that scrolls over the map made the map's canvas vanish in a box beside it (headless
  Chromium). `.u2-sheet { opacity: 0.999 }` gives the panel its own layer and cures it there. Not checked on a real phone. Any new
  scrolling element over the map needs the same.
- The page's closure is shared: a new top-level name in `src/page/ui2*.js` must not clash with an old one (`hex6` did).
- `npm test` passes (120/120). `npm run verify` and the browser tests were last run in full before the planning screens; run
  them before a PR. No backlog task or PR exists for this work yet; no PR was asked for.

## Playtesting
`docs/ui2/playtest.js` is the testers' harness: a browser session kept open by a small server, driven one command at a time
(`serve NAME phone|desk HASH`, then `NAME text | shot | tap X Y | click TEXT | drag | zoom | wait | key | stop`). Run
`node build.js` first; hashes: `ot7` is solo, tiny map, seed 7 (`os42` small). Each round: two Opus agents (`general-purpose`,
model `opus`), one phone and one desktop, told to behave as players, not to read the source, about 45 to 50 harness calls and at
most 10 screenshots, reporting ranked problems with severity and exact on-screen text. `click TEXT` matches the first button
containing the text, so labels that share a word collide.
