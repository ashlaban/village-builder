# Village builder

A village builder on a generated hex archipelago, in one HTML page (PixiJS 8). The page holds all its own code, but loads PixiJS from jsDelivr and its fonts from Google Fonts, so it needs a network connection; without the fonts it falls back to the browser's serif and sans-serif.

- **Play online:** <https://ashlaban.github.io/village-builder/>
- **Play locally:** open `index.html` in a browser.
- **Build:** `python3 build.py` inlines `src/` into `index.html`.
- **Test:** `npm install && npm test` (cheap headless checks, Node 20+); `npm run verify` adds long runs, golden states, saved fixtures and browser checks.
- **Late-game fixtures:** `node tools/fixtures.js fetch` downloads reference saves; `status` checks freshness and `make` regenerates them.
  `npm run nightly` prepares and publishes them on the dedicated `fixtures` branch.

On phones and tablets, the bottom bar opens People, Family records, Customs, or the Menu. People can be searched by person, farm, or village; expand a village and household to inspect its members and supplies. Select a person to find them on the map. Panels have collapse and close controls. Map layers, the minimap, and background-running settings are in Menu. Tap the current speed to choose another speed.

**Hide UI** leaves the map visible and keeps time running at the chosen speed; **Show UI** restores the previous panel and selection. On a keyboard, H toggles the UI, Space pauses/resumes, and 1–5 choose speeds.

For software-rendered CI, `VB_SOFTWARE_RENDER=1` renders each generated world once in browser fixtures while simulation and UI updates keep their normal test cadence. `VB_TEST_JOBS=2` limits test workers; `VB_CHROMIUM` optionally selects a Chromium executable.
