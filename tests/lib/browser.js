// The browser tests render sparsely: each generated world once, then one frame a second. They assert the page's DOM and the simulation's
// state, not its pixels, and in software-rendered Chromium every 12 fps frame cost six to twelve times the tests' own work; the frame a
// second still draws each changed scene (overlays, panels, a skipped year), so a frame that throws is caught as a page error.
// Simulation, camera, sprite transforms and HTML updates keep their normal cadence. `VB_FULL_RENDER=1` renders every frame, as the page does.
function browserHTML(html) {
  if (process.env.VB_FULL_RENDER === '1') return html;
  const hook = 'app.ticker.add((tk) => {';
  if (!html.includes(hook)) throw new Error('browserHTML: the page no longer has the ticker hook');
  return html.replace(hook, `
    app.ticker.remove(app.render, app);
    let fixtureWorld = null, fixtureAt = 0;
    app.ticker.add(() => {
      if (!w || building) return;
      const now = performance.now();
      if (fixtureWorld === w && now - fixtureAt < 1000) return;
      app.render(); fixtureWorld = w; fixtureAt = now;
    }, null, -25);
    app.ticker.add((tk) => {`);
}
module.exports = { browserHTML };
