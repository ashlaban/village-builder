# Village builder

A village builder on a generated hex archipelago, in one HTML page (PixiJS 8). The page holds all its own code, but loads PixiJS from jsDelivr and its fonts from Google Fonts, so it needs a network connection; without the fonts it falls back to the browser's serif and sans-serif.

- **Play online:** <https://ashlaban.github.io/village-builder/>
- **Play locally:** open `index.html` in a browser.
- **Build:** `python3 build.py` inlines `src/` into `index.html`.
- **Test:** `npm install && npm test` (cheap checks, about 10 s, Node 20+); `npm run verify` adds the long runs, the golden file and the page smoke test.
