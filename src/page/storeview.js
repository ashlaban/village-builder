// @sys page/storeview: the Stores panel (VB-092; design.md, Store views): the stores of a scope's households in one table, opened from a
//   village's card and a household's Stores tab, in the dock's drawer
// ======== the Stores panel ========
// The page's own state, never saved: storesScope, the scope shown ({level, ids, dim}); storesKey, what was drawn (the scope and the game
// day: the table is rebuilt once a game day, not every frame).
let storesScope = null,
  storesKey = '',
  storesDrawn = '';
function openStores(scope) {
  storesScope = scope;
  storesKey = '';
  storesDrawn = ''; // another pane may have filled the drawer since
  if (activePanel !== 'stores') openPanel('stores');
  $('drawerTitle').textContent = DRAWER.stores.title;
  $('drawerClose').setAttribute('aria-label', 'Close stores');
  renderDrawer();
}
// A food in days of the row's need (its rations in the title); another store in its units, rounded.
function storeCell(r, c) {
  const x = r[c.key];
  if (x === null) return '<td class="none">·</td>';
  if (!c.food) return `<td>${Math.round(x)}</td>`;
  const days = r.need > 0 ? x / r.need : Infinity;
  const shown = days === Infinity ? (x >= 0.5 ? '∞' : '0') : days >= 10 ? Math.round(days) : days.toFixed(1);
  return `<td title="${Math.round(x)} rations">${shown}</td>`;
}
function renderStores() {
  const day = Math.floor(st.t / Sim.DAY),
    key = `${JSON.stringify(storesScope)}|${day}`;
  if (!storesScope || key === storesKey) return;
  storesKey = key;
  const S = Sim.storesOf(st, storesScope),
    all = [...S.rows, ...S.villages],
    cols = S.columns.filter((c) => c.key === 'grain' || all.some((r) => r[c.key] >= 0.5)),
    name = (r) => {
      if (r.type === 'total') return 'All households';
      if (r.type === 'village') return `${esc(st.villages[r.id].name)}'s store`;
      const f = st.farmsteads[st.households[r.id].farmstead];
      return `<button type="button" class="linkish" data-stores-farm="${f.id}">${esc(f.name)}</button>`;
    },
    line = (r) =>
      `<tr class="${r.type}"><th scope="row">${name(r)}</th>${cols.map((c) => storeCell(r, c)).join('')}</tr>`;
  const v = storesScope.level === 'household' ? st.farmsteads[st.households[storesScope.ids[0]].farmstead].village : -1;
  const h =
    '<p class="hint">Food in days of the household’s need (its rations in the title); the rest in loads, sheaves and rations. ' +
    'The seed is part of the grain.</p>' +
    (v >= 0
      ? `<p><button type="button" class="card-switch" data-stores-village="${v}">Every household of ${esc(st.villages[v].name)}</button></p>`
      : '') +
    `<div class="stores-wrap"><table class="stores"><thead><tr><th scope="col">Household</th>${cols
      .map((c) => `<th scope="col">${esc(c.label)}</th>`)
      .join('')}</tr></thead><tbody>${S.rows.map(line).join('')}</tbody><tfoot>${
      S.rows.length > 1 ? line(S.total) : ''
    }${S.villages.map(line).join('')}</tfoot></table></div>`;
  if (h !== storesDrawn) $('drawerBody').innerHTML = storesDrawn = h; // unchanged numbers keep the rows a click is on
}
// The buttons that open it (a village's card, a household's Stores tab), and its rows: a household's selects it, as clicking its farm does.
function storesClick(e) {
  const b = e.target.closest('[data-stores-village], [data-stores-household], [data-stores-farm]');
  if (!b || !st) return;
  if (b.dataset.storesFarm) selectFarm(+b.dataset.storesFarm);
  else if (b.dataset.storesVillage) openStores({ level: 'village', ids: [+b.dataset.storesVillage], dim: 'owns' });
  else openStores({ level: 'household', ids: [+b.dataset.storesHousehold], dim: 'owns' });
}
$('tile').addEventListener('click', storesClick);
$('drawer').addEventListener('click', storesClick);
