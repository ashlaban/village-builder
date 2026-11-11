// @sys page/ground: the Ground overlay: each land tile's bedrock as a tint, its deposit as a mark, and a key of the kinds the map has
  // ---- the Ground overlay (gen/geology): what lies in the ground ----
  // Bedrock tints the tile; a deposit is a disc in its kind's colour (clay a square), with a ring round a source that does not run out.
  // The ground is the generator's and nothing digs yet, so it is drawn once a world, when the overlay is first turned on.
  let groundG = null, groundOn = false, groundFor = null;
  const ROCK_COLOUR = [0, 0xc98a8a, 0xf0e8c8, 0xe0a050, 0x56627a, 0xffffff, 0x6fae8e]; // by ROCK code: granite..soapstone
  const DEPOSIT_COLOUR = [0, 0xc4552d, 0x8a5a2a, 0x33363c, 0x1fa98a, 0xdfe6ee, 0x7fb4e6, 0xf5c518]; // by DEPOSIT code: clay..gold
  const hex6 = (c) => '#' + c.toString(16).padStart(6, '0');
  function drawGround() {
    if (!w || !w.rock || groundFor === w) return;
    if (!groundG) { groundG = new PIXI.Graphics(); L.ground.addChild(groundG); }
    const g = groundG, R = w.R, rocks = Geo.ROCKS.map(() => 0), deps = Geo.DEPOSITS.map(() => 0);
    g.clear(); groundFor = w;
    for (let r = 1; r < Geo.ROCKS.length; r++) {
      for (let i = 0; i < w.N; i++) if (w.rock[i] === r) { g.poly(hexPoly(i)); rocks[r]++; }
      if (rocks[r]) g.fill({ color: ROCK_COLOUR[r], alpha: 0.5 });
    }
    for (let d = 1; d < Geo.DEPOSITS.length; d++) {
      for (let i = 0; i < w.N; i++) {
        if (w.deposit[i] !== d) continue;
        deps[d]++;
        if (d === Geo.DEPOSIT.CLAY) g.rect(w.hx[i] - R * 0.38, w.hy[i] - R * 0.38, R * 0.76, R * 0.76); else g.circle(w.hx[i], w.hy[i], R * 0.44);
      }
      if (deps[d]) g.fill({ color: DEPOSIT_COLOUR[d] }).stroke({ width: R * 0.09, color: 0x2a1a0c });
    }
    let endless = 0;
    for (let i = 0; i < w.N; i++) if (w.deposit[i] && w.depositLeft[i] === Geo.ENDLESS) { g.circle(w.hx[i], w.hy[i], R * 0.68); endless++; }
    if (endless) g.stroke({ width: R * 0.1, color: 0x2a1a0c });
    // the key: only the kinds this map has
    const row = (cls, colour, name) => `<li><i class="${cls}" style="background:${hex6(colour)}"></i>${name}</li>`;
    $('groundKey').innerHTML = '<h2 class="menu-label">Bedrock</h2><ul>'
      + Geo.ROCKS.map((r, k) => (rocks[k] ? row('rock', ROCK_COLOUR[k], r.name) : '')).join('') + '</ul><h2 class="menu-label">Deposits</h2><ul>'
      + (Geo.DEPOSITS.map((d, k) => (deps[k] ? row(k === Geo.DEPOSIT.CLAY ? 'clay' : 'ore', DEPOSIT_COLOUR[k], d.name) : '')).join('')
        || '<li>None on this map</li>') + (endless ? '<li><i class="ore endless"></i>Does not run out</li>' : '') + '</ul>';
  }
  function setGround(on) { groundOn = on; L.ground.visible = on; $('groundKey').hidden = !on; if (on) drawGround(); }
  // A new world: the old one's ground is wiped, and drawn anew if the overlay is on.
  function resetGround() { groundFor = null; if (groundG) groundG.clear(); if (groundOn) drawGround(); }
