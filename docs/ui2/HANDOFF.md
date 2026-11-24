# New interface (ui2): where it stands

Branch `claude/new-ui-usability-wi3an6`. Kim's brief (24 November): hide the current interface, build a new one with an aggressive
focus on usability and expressiveness, phone and desktop, playtested by Opus agents; drafts shown from time to time; earlier UI
design instructions may be ignored. Scope: the solo scenario at the first player scale, choosing the site of the first farm and
planning days and weeks through the first year. Kim's later notes: the interface must feel part of the map, not a layer on top
(answered: state on the land, act by tapping the land, lighter chrome, site choice on the land; "map first, panels second").
Kim prefers clarifying questions and small batches.

Drafts page (screenshots and both rounds' findings, newest first): https://claude.ai/artifact/6ZDU7Uo3wRTw6m8DiAcJxG

## What is built
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
