// @sys page/overlays: the map's overlays (VB-1496): their registry, one shown at a time, and the map bar's button and list that choose one
// ---- the overlays' registry and list ----
// An overlay is drawn over the map and has a key over the minimap. Each registers here, from its own file before page/input:
// registerOverlay({id, name, key, icon, group, set(on), refresh(), reset(), layer, keyEl}). `set` shows or hides its layer and draws it;
// `refresh` is called every frame, on or off (off, it only drops its dirty marks); `reset` is called for a new world; `keyEl` is its key
// panel, shown only while it is on; `layer` its drawing's container (the browser check holds that one alone is seen); `key` is its
// letter, or none for the next free digit.
// The map bar's overlay button shows the overlay on (layers, with none) and unfolds the list of them above the bar, as the bell does its
// own: a row for each, grouped by `group`. The list stays open after a choice, so that overlays can be compared; it shuts on the button,
// on Esc and on a press on the map. The hex grid and the regions are not overlays: they are toggles of their own.
// The list's fold is the page's (never `st`). The digits 1 to 5 choose a speed and 0 shows none, so an overlay's digit is 6 to 9; past
// those, the free letters under them, Y, U and I, are handed out in turn (VB-1499).
const OVERLAYS = [],
  OVERLAY_DIGITS = '6789yui';
let overlayOn = null;
function registerOverlay(o) {
  if (OVERLAYS.some((p) => p.id === o.id || (o.key && p.key === o.key)))
    throw new Error(`overlay ${o.id}: its id or key is taken`);
  if (!o.key) o.key = [...OVERLAY_DIGITS].find((k) => !OVERLAYS.some((p) => p.key === k)) || '';
  OVERLAYS.push(o);
  const list = $('overlayList'),
    last = list.lastElementChild,
    b = document.createElement('button');
  b.type = 'button';
  b.id = o.id + 'Btn';
  b.className = 'overlay-row';
  b.dataset.overlay = o.id;
  b.dataset.group = o.group || '';
  b.setAttribute('role', 'radio');
  b.setAttribute('aria-checked', 'false');
  b.setAttribute('aria-controls', o.keyEl.id);
  if (o.key) b.setAttribute('aria-keyshortcuts', o.key);
  b.innerHTML = ICON[o.icon] + '<span></span>' + (o.key ? `<kbd>${o.key.toUpperCase()}</kbd>` : '');
  b.querySelector('span').textContent = o.name;
  if (last && last.dataset.group !== b.dataset.group) b.classList.add('group-start');
  b.addEventListener('click', () => chooseOverlay(o.id));
  list.appendChild(b);
  paintOverlays();
}
// Show the overlay `id`, the one shown before put away; the one shown again, or null, puts it away and shows none.
function chooseOverlay(id) {
  const o = OVERLAYS.find((p) => p.id === id) || null,
    was = overlayOn;
  if (was) {
    overlayOn = null;
    was.set(false);
    was.keyEl.hidden = true;
  }
  if (o && o !== was) {
    overlayOn = o;
    o.keyEl.hidden = false;
    o.set(true);
  }
  paintOverlays();
}
// [ and ]: the overlay before or after the one on; with none on, the last or the first.
function stepOverlay(by) {
  const n = OVERLAYS.length,
    i = overlayOn ? OVERLAYS.indexOf(overlayOn) : by > 0 ? -1 : n;
  if (n) chooseOverlay(OVERLAYS[(i + by + n) % n].id);
}
function paintOverlays() {
  for (const b of $('overlayList').children)
    b.setAttribute('aria-checked', String(!!overlayOn && overlayOn.id === b.dataset.overlay));
  const btn = $('overlayBtn'),
    icon = overlayOn ? overlayOn.icon : 'layers';
  btn.classList.toggle('on', !!overlayOn);
  btn.setAttribute('aria-pressed', String(!!overlayOn)); // the one pressed look (the button piece)
  btn.title = overlayOn ? `Overlays: ${overlayOn.name}` : 'Overlays';
  if (btn.dataset.shows !== icon) {
    btn.dataset.shows = icon;
    btn.innerHTML = ICON[icon];
  }
}
function closeOverlayList() {
  $('overlayPop').hidden = true;
  $('overlayBtn').setAttribute('aria-expanded', 'false');
}
function openOverlayList() {
  closeNotices(); // the bell's list and this one are never both open
  $('overlayPop').hidden = false;
  $('overlayBtn').setAttribute('aria-expanded', 'true');
}
// The overlays' keys, for page/input: an overlay's letter or digit, 0 for none, [ and ] for the one before and after.
function overlayShortcut(k) {
  if (k === '0') return () => chooseOverlay(null);
  if (k === '[' || k === ']') return () => stepOverlay(k === '[' ? -1 : 1);
  const o = OVERLAYS.find((p) => p.key === k);
  return o ? () => chooseOverlay(o.id) : null;
}
const refreshOverlays = () => {
  for (const o of OVERLAYS) o.refresh();
};
const resetOverlays = () => {
  for (const o of OVERLAYS) o.reset();
};
$('overlayBtn').addEventListener('click', () => {
  if ($('overlayPop').hidden) {
    openOverlayList();
    const on = $('overlayList').querySelector('[aria-checked="true"]') || $('overlayList').firstElementChild;
    if (on && document.activeElement === $('overlayBtn')) on.focus({ preventScroll: true });
  } else closeOverlayList();
});
$('stage').addEventListener('pointerdown', closeOverlayList);
// Within the list the arrows move between its rows, as in a group of radio buttons.
$('overlayList').addEventListener('keydown', (e) => {
  const d = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key],
    bs = [...$('overlayList').children],
    i = bs.indexOf(document.activeElement);
  if (!d || i < 0) return;
  e.preventDefault();
  bs[(i + d + bs.length) % bs.length].focus();
});
