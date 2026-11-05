// Optional fixture mode for software-only environments: render each generated world once.
// Simulation, camera, sprite transforms and HTML updates keep their normal test cadence.
function browserHTML(html) {
  if (process.env.VB_SOFTWARE_RENDER !== '1') return html;
  return html.replace('app.ticker.add((tk) => {', `
    app.ticker.remove(app.render, app);
    let fixtureWorld = null;
    app.ticker.add(() => {
      if (!w || building || fixtureWorld === w) return;
      app.render(); fixtureWorld = w;
    }, null, -25);
    app.ticker.add((tk) => {`);
}
module.exports = { browserHTML };
