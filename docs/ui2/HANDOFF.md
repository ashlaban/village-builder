# New interface (ui2): where it stands

Branch `claude/bold-lamport-xsgshf` (24 November, second session; it holds `claude/new-ui-usability-wi3an6` merged onto main). Kim's brief (24 November): hide the current interface, build a new one with an aggressive
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
- VB-1616, `Sim.agenda(st)` (`src/sim/agenda.js`): the queue laid end to end in working hours and the open work, each with the
  pawn's own estimate `{lo, mid, hi}`, its deadline, a verdict (`in time`, `tight`, `late`), and for a field project's step `then`,
  the steps left before sowing.
- VB-1615, sleep (`src/sim/sleep.js`, `st.player.sleep`, the verb `sleep`, `Sim.sleepOf`): half an hour owed for each hour awake;
  the mood modifier `tired` past 8 hours owed, health from a whole night owed. Only the played pawn (VB-1617 opens it to all).
- Measured with automatic off, before: ordered work ran through the night at no cost; nobody fetched water or cooked.

## Built in the third batch (24 November)
- Planned by hand: at "Begin the first day" (`hudBegin`) automatic planning goes off, the routine is water, cooking, fodder and
  milking, and sleep is 22 to 6.
- VB-1618, the plan (`src/sim/playerplan.js`, `st.player.plan`, `Sim.plan(st, op, args)`, `Sim.planView(st)`): the routine once a
  day, the sleeping hours, tasks in order by job key; the feeder in `playerStep` follows it when the hand queue is empty; a task
  broken off for the night is taken up in the morning. A command queued by hand ("Do it now") goes first and is not broken off for
  sleep: that is how a night is worked.
- VB-1619, `Sim.agenda(st)` gains `days` (three days of segments by the hour), `plan` (each task's hours, end, verdict), `owed`
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
- No playtest round has been run on any of the second session's work. VB-1620 splits `page/ui2hud` (over the lint's line).
- The agenda's estimate assumes the pawn's own hands only.

## After the third batch: plant task, roof warning, and round 3 of playtests (24 November)
- VB-1621: a plant task (`Sim.plan(st, 'add', {plant: tile})`) carries a field from clearing to sowing as one task; the callout
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
  Left: Stores, and the settler's card (`meHTML`: what it does and why, health, mood, what ails it, the log). VB-1620: the play
  screen is `page/ui2hud` (ribbon, sheets, clicks), `page/ui2plan` (the plan bar and cards), `page/ui2land` (pins, callout),
  `page/ui2day` (the strip).
- VB-1622: tile tasks are chains declared as data (`CHAINS` in `src/sim/playerplan.js`): `plant`, `hay`, `harvest`; a marked tile's
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

## For the next session
- Start with 1 (find and explain a standing plan), then 2, 3, 4, 5: they are why a year fails or misleads.
- Seeing the page: `node build.js`, then patch a copy of `index.html` as `tests/browser.js` does (replace the `let st = null,`
  line to add `window.__play = { get st() { return st; }, Sim, setSpeed }`) and drive it with Playwright; the playtest harness is
  `docs/ui2/playtest.js`. Do not rebuild `index.html` while testers play.
- Sim work goes to Opus `vb-task` sub-agents through backlog tasks (`tools/inbox.js init --fresh`, `start ID`, then `apply`); the
  page is the orchestrator's. Kim wants clarifying questions and small batches. No PR is open; none was asked for.

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
