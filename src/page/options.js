// @sys page/options: the main menu's Options screen and the interface's theme (VB-1123): glass or mural, the page's choice, kept in localStorage
// ---- options: the interface's theme ----
// A theme is a set of styles under :root[data-theme] in src/head.html; glass, the default, is the stylesheet as it stands and sets no
// attribute. The choice is the page's and the device's: kept in localStorage, never in st or a save. A theme's card shows a sample of
// its own look whatever theme is on, so its colours are written out in the stylesheet (.theme-pv), not taken from the palette.
const THEME_KEY = 'vb.theme';
const THEMES = {
  glass: { name: 'Glass', note: 'Frosted panels and line icons; light or dark with the system.' },
  mural: { name: 'Mural', note: 'Plaster, ochre and stencils, as the map is painted.' },
};
let theme = 'glass';
try {
  const kept = localStorage.getItem(THEME_KEY);
  if (THEMES[kept]) theme = kept;
} catch (e) {
  /* no storage: the default */
}
function applyTheme() {
  if (theme === 'glass') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}
function drawThemes() {
  $('themeList').innerHTML = Object.entries(THEMES)
    .map(
      ([k, t]) =>
        `<button type="button" class="theme" role="radio" data-theme-choice="${k}" aria-checked="${k === theme}" tabindex="${k === theme ? 0 : -1}">` +
        `<span class="theme-pv ${k}" aria-hidden="true"><span><b>Spring</b><i></i><i></i></span></span>` +
        `<span class="theme-name">${esc(t.name)}</span><small>${esc(t.note)}</small></button>`,
    )
    .join('');
}
function setTheme(k) {
  if (!THEMES[k] || k === theme) return;
  theme = k;
  applyTheme();
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (e) {
    /* no storage: the choice holds until the page is closed */
  }
  drawThemes();
  const on = $('themeList').querySelector('[aria-checked="true"]');
  if (on) on.focus();
}
applyTheme();
// Opened from the main menu, it takes the menu card's place, as Saves does, and closes back to it.
function showOptions(on) {
  $('optionsScreen').hidden = !on;
  if (on) {
    drawThemes();
    $('optionsClose').focus();
  } else if (!$('landing').hidden) $('landOptions').focus();
}
$('landOptions').addEventListener('click', () => showOptions(true));
$('optionsClose').addEventListener('click', () => showOptions(false));
$('themeList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-theme-choice]');
  if (b) setTheme(b.dataset.themeChoice);
});
$('optionsScreen').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.stopPropagation();
    showOptions(false);
    return;
  }
  // a radio group: the arrows move the choice
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  if (!step || !e.target.closest('#themeList')) return;
  e.preventDefault();
  const keys = Object.keys(THEMES);
  setTheme(keys[(keys.indexOf(theme) + step + keys.length) % keys.length]);
});
