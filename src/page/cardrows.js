// @sys page/cardrows: the rows of the cards (VB-1948): the lists a feature's page file adds a card's row to, each at a declared place
// ---- card rows ----
// A card's rows are joined here, in the order of their places, never in the order of src/page.json (target-v2, principle 20): a
// feature adds its row beside its code with cardRow(card, place, row), at load, and the card reads cardRows(card, ...args). A row is a
// function of the card's arguments that gives one entry, an array of them, or nothing ('' or null; the card leaves those out as before).
// The cards: `person` (a living person's lines, row(id)), `farm` (the lines of a farm's house, row(f)), `tile` (an open tile's lines,
// row(i)) and `house` (a household's stats on its farm's card, row(hh), each a stat of page/meter or null). The places are numbers with
// room between them; two rows at one place of a card are an error, so the order is always declared.
const CARD_ROWS = { person: [], farm: [], tile: [], house: [] };
function cardRow(kind, place, row) {
  const list = CARD_ROWS[kind];
  if (!list) throw new Error(`cardRow: no card ${kind}`);
  if (typeof place !== 'number' || list.some((r) => r.place === place))
    throw new Error(`cardRow: the ${kind} card's place ${place} is taken or not a number`);
  list.push({ place, row });
  list.sort((a, b) => a.place - b.place);
}
const cardRows = (kind, ...args) => CARD_ROWS[kind].flatMap((r) => r.row(...args));
