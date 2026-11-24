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
// ---- marks on the land ----
// What the interface puts on the map itself: elements anchored to tiles (a field's badge, the house's gauges, a callout with what can
// be done there). u2Marks(list) sets them, [{id, tile, html, cls, call}]: an element is kept while its id stays and rewritten only
// when its html changes; u2Place puts each at its tile every frame the camera or the list has changed. A callout (call) is kept inside
// the screen and flips under its tile when there is no room above.
const u2Anchor = new Map(); // id -> {el, tile, html, call}
let u2PlaceKey = '';
function u2Marks(list) {
  const seen = new Set();
  for (const m of list) {
    seen.add(m.id);
    let a = u2Anchor.get(m.id);
    if (!a) {
      a = { el: document.createElement('div'), html: null };
      u2.pins.appendChild(a.el);
      u2Anchor.set(m.id, a);
      u2PlaceKey = '';
    }
    if (a.tile !== m.tile || a.call !== !!m.call) u2PlaceKey = '';
    a.tile = m.tile;
    a.call = !!m.call;
    if (a.html !== m.html || a.el.className !== `u2-mark ${m.cls || ''}`) {
      a.html = m.html;
      a.el.className = `u2-mark ${m.cls || ''}`;
      a.el.innerHTML = m.html;
      u2PlaceKey = '';
    }
  }
  for (const [id, a] of u2Anchor)
    if (!seen.has(id)) {
      a.el.remove();
      u2Anchor.delete(id);
    }
}
function u2Place() {
  if (!u2Anchor.size || !w) return;
  const r = stage.getBoundingClientRect(),
    key = `${cam.x.toFixed(1)},${cam.y.toFixed(1)},${cam.z.toFixed(4)},${r.width},${r.height}`;
  if (key === u2PlaceKey) return;
  u2PlaceKey = key;
  const hex = w.R * cam.z, // a tile's radius on the screen
    top =
      Math.max(
        ...[u2.top, u2.lens, u2.key, u2.alert, u2.help]
          .filter((e) => !e.hidden)
          .map((e) => e.getBoundingClientRect().bottom),
      ) + 6,
    bot =
      Math.min(
        r.height,
        ...[u2.sitecard, u2.does, u2.dock, u2.sheet].filter((e) => !e.hidden).map((e) => e.getBoundingClientRect().top),
      ) - 6;
  u2.pins.classList.toggle('far', hex < 15);
  for (const a of u2Anchor.values()) {
    let x = r.left + r.width / 2 + (w.hx[a.tile] - cam.x) * cam.z,
      y = r.top + r.height / 2 + (w.hy[a.tile] - cam.y) * cam.z,
      below = false;
    if (a.call) {
      // above its tile where there is room, else under it, else where there is most, and never under the bars
      // a callout taller than the land between the bars scrolls within it, its top and its close never under a bar
      a.el.style.maxHeight = '';
      const room = Math.max(120, bot - top),
        tall = a.el.offsetHeight > room;
      a.el.classList.toggle('scroll', tall);
      if (tall) a.el.style.maxHeight = `${room}px`;
      const cw = a.el.offsetWidth,
        ch = a.el.offsetHeight,
        over = y - hex * 0.9 - ch >= top,
        under = y + hex * 0.9 + ch <= bot;
      x = Math.max(cw / 2 + 6, Math.min(r.width - cw / 2 - 6, x));
      below = !over && (under || bot - y > y - top);
      y += below ? hex * 0.9 : -hex * 0.9;
      y = below ? Math.max(top, Math.min(bot - ch, y)) : Math.min(bot, Math.max(top + ch, y));
    }
    a.el.classList.toggle('below', below);
    const up = a.call && !below ? '-100%' : a.call ? '0' : '-50%';
    a.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, ${up})`;
  }
}
function u2Init() {
  if (!UI2) return;
  document.body.classList.add('ui2');
  const root = document.createElement('div');
  root.className = 'u2';
  root.id = 'u2';
  root.innerHTML = `
    <div id="u2Pins"></div>
    <div class="u2-top" id="u2Top">
      <div class="u2-date" id="u2Date" hidden><b id="u2Day"></b><span id="u2Year"></span></div>
      <button type="button" class="u2-year" id="u2Ribbon" aria-label="The year: open the plan" hidden></button>
      <div class="u2-speed" id="u2Speed" role="group" aria-label="Game speed" hidden>
        <button type="button" id="u2Pause" class="pause" aria-label="Pause"></button>${U2_SPEEDS.map(
          (v) =>
            `<button type="button" data-u2speed="${v}" aria-pressed="false" aria-label="Speed ${v}×" title="Speed ${v}×">${v}×</button>`,
        ).join('')}</div>
      <button type="button" class="u2-menu" id="u2Menu" aria-label="Main menu" title="Main menu">${ICON.menu}</button>
    </div>
    <p class="u2-alert" id="u2Alert" hidden></p>
    <div class="u2-help u2-card" id="u2Help" role="status" hidden></div>
    <div class="u2-lens" id="u2Lens" role="group" aria-label="What the map shows" hidden></div>
    <div class="u2-key" id="u2Key" hidden></div>
    <div class="u2-mid" id="u2Mid"><div class="u2-welcome u2-card" id="u2Welcome" hidden></div></div>
    <div class="u2-sitebar" id="u2SiteCard" aria-live="polite" hidden></div>
    <section class="u2-sheet u2-card" id="u2Sheet" aria-live="polite" hidden></section>
    <p class="u2-does" id="u2Does" hidden></p>
    <div class="u2-dock" id="u2Dock" hidden>
      <div class="u2-pcard u2-card" id="u2Pcard" aria-live="polite" hidden></div>
      <div class="u2-days" id="u2Days" role="group" aria-label="The days ahead by the hour" hidden></div>
      <div class="u2-dockrow"><div class="u2-planbar" id="u2Plan" role="group" aria-label="The plan" hidden></div>
      <div class="u2-tabs" id="u2Tabs" role="group" aria-label="Your farm"></div></div></div>`;
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
  u2.dock.hidden = u2.ribbon.hidden = u2.does.hidden = !playing || played() < 0 || !u2.welcome.hidden;
  if (u2.dock.hidden) {
    u2.sheet.hidden = u2.alert.hidden = true;
    if (!site) u2Marks([]);
  } else renderHud();
  u2Place();
  if (site) siteMarks();
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
      idle = id >= 0 && typeof hudWaits === 'function' ? hudIdle() : '',
      does = id >= 0 ? `${st.pawns[id].given}: ${Sim.describe(st, id)}${idle ? `. ${idle}` : ''}` : '';
    if (does !== u2Doing) {
      u2Doing = does;
      u2.does.textContent = does;
    }
  }
}
u2Init();
