// @sys page/ui2: the new interface's shell (`?classic` shows the old one): its top bar (date, speed, menu) and the settler's strip; styles: src/ui2.css
// ======== the new interface ========
// A second interface over the same map and the same Sim, built for a phone's thumb first and a desk's pointer second. It is the page's
// own: it reads st and acts through Sim, as the old one does. With it on (body.ui2) the old panels are hidden, not removed: the old
// interface's tests and tools ask for it (window.VB_CLASSIC, tests/lib/page.js), and `?classic` in the address shows it by hand.
const UI2 = !window.VB_CLASSIC && !/[?&]classic\b/.test(location.search);
// The speeds offered: pause and three paces, named by what they are for (a day at 1× is a slow walk; a week wants 10×).
const U2_SPEEDS = [
  [0, 'Pause', null],
  [1, 'Play', '1×'],
  [10, 'Fast', '10×'],
  [30, 'Faster', '30×'],
];
let u2 = null, // the shell's elements, by name
  u2Clock = -1,
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
      <div class="u2-card u2-speed" id="u2Speed" role="group" aria-label="Game speed" hidden>${U2_SPEEDS.map(
        ([v, name, word]) =>
          `<button type="button" data-u2speed="${v}" aria-pressed="false" aria-label="${name}" title="${name}">${word || ICON.pause}</button>`,
      ).join('')}</div>
      <button type="button" class="u2-card u2-menu" id="u2Menu" aria-label="Main menu" title="Main menu" style="margin-left:auto">${ICON.menu}</button>
    </div>
    <div class="u2-site-head u2-card" id="u2SiteHead" hidden></div>
    <div class="u2-lens u2-card" id="u2Lens" role="group" aria-label="What the map shows" hidden></div>
    <div class="u2-key u2-card" id="u2Key" hidden></div>
    <div class="u2-mid" id="u2Mid"><div class="u2-welcome u2-card" id="u2Welcome" hidden></div></div>
    <section class="u2-sitecard u2-card" id="u2SiteCard" aria-live="polite" hidden></section>
    <div class="u2-me u2-card" id="u2Me" hidden><b id="u2Name"></b><span id="u2Does"></span></div>`;
  document.body.appendChild(root);
  u2 = Object.fromEntries(
    [root, ...root.querySelectorAll('[id]')].map((el) => [el.id.slice(2).toLowerCase() || 'u2', el]),
  );
  u2.speed.addEventListener('click', (e) => {
    const b = e.target.closest('[data-u2speed]');
    if (b) setSpeed(+b.dataset.u2speed);
  });
  u2.menu.addEventListener('click', () => showLanding());
}
// Each frame (page/frame): the date, the speed pressed and what the settler does, written only when they change.
function u2Frame() {
  if (!UI2 || !u2) return;
  const playing = !!st && !site && !demo;
  u2.date.hidden = u2.speed.hidden = !playing;
  u2.menu.style.marginLeft = playing ? '0' : 'auto';
  u2.me.hidden = !playing || played() < 0;
  if (site) sitePins();
  if (!playing) return;
  for (const b of u2.speed.children) {
    const on = String(+b.dataset.u2speed === speed);
    if (b.getAttribute('aria-pressed') !== on) b.setAttribute('aria-pressed', on);
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
      does = id >= 0 ? `${st.pawns[id].given}|${Sim.describe(st, id)}` : '';
    if (does !== u2Doing) {
      u2Doing = does;
      u2.name.textContent = id >= 0 ? Sim.fullName(st.pawns[id]) : '';
      u2.does.textContent = id >= 0 ? Sim.describe(st, id) : '';
    }
  }
}
u2Init();
