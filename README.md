# Village builder

A village builder on a generated hex archipelago, in one HTML page (PixiJS 8). The page holds all its own code, but loads PixiJS from jsDelivr and its fonts from Google Fonts, so it needs a network connection; without the fonts it falls back to the browser's serif and sans-serif.

- **Play online:** <https://ashlaban.github.io/village-builder/>
- **Play locally:** open `index.html` in a browser.
- **Build:** `python3 build.py` inlines `src/` into `index.html`.
- **Test:** `npm install && npm test` (cheap headless checks, Node 20+); `npm run verify` adds long runs, golden states, saved fixtures and browser checks.
- **Late-game fixtures:** `node tools/fixtures.js fetch` downloads reference saves; `status` checks freshness and `make` regenerates them.
  `npm run nightly` prepares and publishes them on the dedicated `fixtures` branch.
