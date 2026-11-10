# Village builder

A village builder on a generated hex archipelago, in one HTML page (PixiJS 8). The page holds all its own code, but loads PixiJS from jsDelivr and its fonts from Google Fonts, so it needs a network connection; without the fonts it falls back to the browser's serif and sans-serif.

- **Play online:** <https://ashlaban.github.io/village-builder/>
- **Play locally:** open `index.html` in a browser.
- **Build:** `python3 build.py` inlines `src/` into `index.html`.
- **Test:** `npm install && npm test` (cheap headless checks, Node 20+); `npm run verify` adds long runs, golden states, saved fixtures and browser checks.
- **Late-game fixtures:** a local cache under `tests/fixtures/<key>/`, keyed by the simulation's sources and made on demand
  (`node tools/fixtures.js status|make|clean`; `npm run verify` makes the two small ones when missing). Nothing is published or fetched.
- **Bench:** `node tools/bench.js` reports 30 days on each medium fixture, codec costs, systems, A* and rules;
  appends machine-labelled results to `docs/bench/history.jsonl` and regenerates `docs/bench/budget.md`.
  `node tools/bench.js --budget` regenerates the table alone. Nightly runs it after fixture preparation;
  include both bench files in the nightly PR. Measurements and 20% regression flags are diagnostic and never fail the run.

- **Route cache:** `node tools/route-bench.js small-y40` (or `medium-ref`) reports 30 days of cache work, hit rate and save size.
  The cache retains at most 60,000 routes in least-recently-used order, including in saves.
- **Moving round:** `node tools/moving-bench.js` reports late-fixture time, ranking and pair counts, and complete post-round save hashes.
  Add `--day` for six-minute round-day step timings or `--source DIR` to measure another checkout against its fixtures.
  `node tools/moving-profile.js` reports stage costs and cache misses; `node tools/marriage-demography.js [7 42]` reports the 30-year
  marriage acceptance measures and exact cohort counts (`--source DIR` selects a baseline checkout).

On phones and tablets, the bottom bar opens People, Family records, Customs, or the Menu. People can be searched by person, farm, or village; expand a village and household to inspect its members and supplies. Select a person to find them on the map. Panels have collapse and close controls. Map layers, the minimap, and background-running settings are in Menu. Tap the current speed to choose another speed.

**Hide UI** leaves the map visible and keeps time running at the chosen speed; **Show UI** restores the previous panel and selection. On a keyboard, H toggles the UI, Space pauses/resumes, and 1–5 choose speeds.

The browser tests render each generated world once and then a frame a second, while simulation and UI updates keep their normal cadence; `VB_FULL_RENDER=1` renders every frame. `VB_TEST_JOBS=2` limits test workers; `VB_CHROMIUM` optionally selects a Chromium executable.
