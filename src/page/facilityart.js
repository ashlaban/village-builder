// @sys page/facilityart: the facilities drawn on the map (VB-361): one being built, one standing, by its kind until each has its art
// the facilities (VB-361; sim/facilities): one being built is a plot of stakes, a stake a stage (the raised ones filled); one built a
// marker by its kind, until each has its art: a gabled block tinted by the kind's name, faded as it wears
function drawFacilities(wd) {
  const Fac = VB['sim/facilities'];
  for (const fac of st.facilities || []) {
    const K = VB['sim/facilityrecords'].FACILITY[fac.kind];
    if (!K) continue;
    const x = wd.hx[fac.tile],
      y = wd.hy[fac.tile],
      g = new PIXI.Graphics();
    if (fac.built === null) {
      const n = Math.max(4, K.stages.length);
      g.poly([x - 9, y - 2, x + 9, y - 2, x + 9, y + 7, x - 9, y + 7]).stroke({ width: 0.5, color: INK, alpha: 0.5 });
      for (let k = 0; k < n; k++) {
        const sx = x - 9 + (18 * k) / (n - 1),
          raised = k < fac.stage;
        g.rect(sx - 0.6, y - 5, 1.2, 6).fill({ color: raised ? 0x7a5636 : 0xb89a72 });
        g.rect(sx - 0.6, y + 4, 1.2, 6).fill({ color: raised ? 0x7a5636 : 0xb89a72 });
      }
    } else {
      let h = 0;
      for (const ch of fac.kind) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      const tint = [0x8a6a4a, 0x6a7a5a, 0x7a6a8a, 0x8a5a4a, 0x5a6a7a][h % 5];
      g.poly([x - 7, y + 6, x - 7, y - 1, x, y - 7, x + 7, y - 1, x + 7, y + 6])
        .fill({ color: tint })
        .stroke({ width: 0.7, color: INK });
      g.alpha = 0.55 + 0.45 * Fac.conditionOf(st, fac);
    }
    g.zIndex = y + 6;
    L.objects.addChild(g);
  }
}
