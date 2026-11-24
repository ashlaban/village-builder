// @sys page/ui2: the new interface's shell (`?classic` shows the old one): its top bar (date, speed, menu) and the settler's strip; styles: src/ui2.css
// ======== the new interface ========
// A second interface over the same map and the same Sim, built for a phone's thumb first and a desk's pointer second. It is the page's
// own: it reads st and acts through Sim, as the old one does. With it on (body.ui2) the old panels are hidden, not removed: the old
// interface's tests and tools ask for it (window.VB_CLASSIC, tests/lib/page.js), and `?classic` in the address shows it by hand.
const UI2 = !window.VB_CLASSIC && !/[?&]classic\b/.test(location.search);
// The speeds offered: pause and three paces, named by what they are for (a day at 1× is a slow walk; a week wants 10×).
const U2_SPEEDS = [1, 10, 30]; // a day at 1× is a slow walk; a week wants 10×
let u2 = null, // the shell's elements, by name
  u2Clock = -1,
  u2Pace = '',
  u2Doing = '';
function u2Init() {
  if (!UI2) return;
  document.body.classList.add('ui2');
  const root = document.createElement('div');
  root.className = 'u2';
  root.id = 'u2';
  root.innerHTML = `
    <div id="u2Pins"></div>
    <div class="u2-top" id="u2Top">
      <div class="u2-card u2-date" id="u2Date" hidden><b id="u2Day"></b><span id="u2Year"></span></div>
      <div class="u2-card u2-speed" id="u2Speed" role="group" aria-label="Game speed" hidden>
        <button type="button" id="u2Pause" class="pause" aria-label="Pause"></button>${U2_SPEEDS.map(
          (v) =>
            `<button type="button" data-u2speed="${v}" aria-pressed="false" aria-label="Speed ${v}×" title="Speed ${v}×">${v}×</button>`,
        ).join('')}</div>
      <button type="button" class="u2-card u2-menu" id="u2Menu" aria-label="Main menu" title="Main menu" style="margin-left:auto">${ICON.menu}</button>
    </div>
    <button type="button" class="u2-year u2-card" id="u2Ribbon" hidden></button>
    <div class="u2-site-head u2-card" id="u2SiteHead" hidden></div>
    <div class="u2-lens u2-card" id="u2Lens" role="group" aria-label="What the map shows" hidden></div>
    <div class="u2-key u2-card" id="u2Key" hidden></div>
    <div class="u2-mid" id="u2Mid"><div class="u2-welcome u2-card" id="u2Welcome" hidden></div></div>
    <section class="u2-sitecard u2-card" id="u2SiteCard" aria-live="polite" hidden></section>
    <section class="u2-sheet u2-card" id="u2Sheet" aria-live="polite" hidden></section>
    <div class="u2-dock u2-card" id="u2Dock" hidden><p id="u2Does"></p><div class="u2-tabs" id="u2Tabs" role="group" aria-label="Your farm"></div></div>`;
  document.body.appendChild(root);
  u2 = Object.fromEntries(
    [root, ...root.querySelectorAll('[id]')].map((el) => [el.id.slice(2).toLowerCase() || 'u2', el]),
  );
  u2.speed.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b === u2.pause) setSpeed(speed === 0 ? lastSpeed : 0);
    else setSpeed(+b.dataset.u2speed);
    if (e.detail) b.blur(); // pressed by a pointer: Space stays the game's pause, not this button's press
  });
  u2.menu.addEventListener('click', () => showLanding());
}
// Each frame (page/frame): the date, the speed pressed and what the settler does, written only when they change.
function u2Frame() {
  if (!UI2 || !u2) return;
  const playing = !!st && !site && !demo;
  u2.date.hidden = u2.speed.hidden = !playing;
  u2.menu.style.marginLeft = playing ? '0' : 'auto';
  u2.dock.hidden = u2.ribbon.hidden = !playing || played() < 0 || !u2.welcome.hidden;
  if (u2.dock.hidden) u2.sheet.hidden = true;
  else renderHud();
  if (site) sitePins();
  if (!playing) return;
  const pace = speed === 0 ? `p${lastSpeed}` : `r${speed}`;
  if (pace !== u2Pace) {
    u2Pace = pace;
    u2.pause.innerHTML = speed === 0 ? ICON.play : ICON.pause;
    u2.pause.setAttribute('aria-label', speed === 0 ? 'Resume' : 'Pause');
    u2.pause.title = speed === 0 ? 'Resume (Space)' : 'Pause (Space)';
    u2.pause.classList.toggle('paused', speed === 0);
    for (const b of u2.speed.querySelectorAll('[data-u2speed]'))
      b.setAttribute('aria-pressed', String(+b.dataset.u2speed === (speed === 0 ? lastSpeed : speed)));
  }
  const step = Math.floor(st.t * 12);
  if (step !== u2Clock) {
    u2Clock = step;
    const c = Sim.cal(st.t),
      m = (((step * 5) % 1440) + 1440) % 1440,
      s = Sim.SEASONS[c.season];
    u2.day.textContent = `${s[0].toUpperCase() + s.slice(1)} · day ${c.sday + 1}`;
    u2.year.textContent = `Year ${c.year} · ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const id = played(),
      does = id >= 0 ? `${st.pawns[id].given}: ${Sim.describe(st, id)}` : '';
    if (does !== u2Doing) {
      u2Doing = does;
      u2.does.textContent = does;
    }
  }
}
u2Init();
