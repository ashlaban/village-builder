// @sys world/rivers: what the water running through a tile is called, by its flow
VB['world/rivers'] = (() => {
  // A river tile's w.river (its catchment) below `brook` is a brook, below `stream` a stream, and a river from there: the names the drawn
  // widths 8 and 16 gave at the default hex size R = 28 (Kim, 23 November: the name goes by the flow, not by how wide it is drawn).
  const KIND = { brook: 38, stream: 225 };
  // What the tile card calls the water through tile i, or null.
  const kind = (w, i) =>
    !w.river[i] ? null : w.river[i] < KIND.brook ? 'Brook' : w.river[i] < KIND.stream ? 'Stream' : 'River';
  return { KIND, kind };
})();
