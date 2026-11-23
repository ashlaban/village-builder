// tools/samepixels.js (VB-1489): its painter on a small generated island bakes the same hashes twice, and catches a pigment changed by a
// little and one mark moved by a few units; the cover set by hand shows and its restore leaves nothing stale; a stray option is refused.
const assert = require('assert'), path = require('path'), cp = require('child_process');
const VB = require('../src/load.js'), probe = require('./lib/probe.js');
const { painter, coverCase, compare, modules, drawing } = require('../tools/samepixels.js');
const D = drawing(VB);

// The sea, the overview, a level 0 and its level 1 chunk round a land tile with marks (a wood near the middle), and the cover case.
function bake(w) {
  const P = painter(VB);
  P.sea(w, 'w'); P.overview(w, 'w');
  let t = -1, best = Infinity;
  for (let i = 0; i < w.N; i++) {
    const d = Math.hypot(w.hx[i] - w.W / 2, w.hy[i] - w.H / 2);
    if (!w.water[i] && w.trees[i] > 0 && d < best) { best = d; t = i; }
  }
  P.round(w, 'w', [t]);
  assert(coverCase(P, w, 'w') >= 0, 'a land tile took another cover');
  return P.out;
}
const fresh = () => probe.generate(7);
const one = bake(fresh()), two = bake(fresh());
assert(Object.keys(one).length >= 10, `too few images: ${Object.keys(one).length}`);
assert.deepStrictEqual(compare(one, two), { differ: [], stale: [] }, 'two bakes of one world are the same');
const land = (stage) => Object.keys(one).filter((k) => k.startsWith(`w/${stage}/l0/`) && !k.endsWith('.way')).map((k) => one[k]);
assert(land('cover-before').length === 1 && land('cover-set')[0] !== land('cover-before')[0], 'a cover set by hand shows in its chunk');
assert(land('cover-restored')[0] === land('cover-before')[0], 'restored, the chunk is as before');

// one pigment: the meadow's colour moved by 6 in red
const meadow = VB['draw/pigments'].PIGMENTS[D.B.MEADOW];
meadow.c[0] += 6;
let pig;
try { pig = compare(one, bake(fresh())).differ; } finally { meadow.c[0] -= 6; }
assert(pig.some((k) => /\/l[01]\//.test(k)), `a changed pigment is not seen: ${pig.join(', ') || 'nothing differs'}`);

// one mark's place: the first item of each chunk's marks drawn 3 units to the right
const marks = modules(VB, /marks/).find((m) => typeof m.draw === 'function'), draw = marks.draw;
marks.draw = (ctx, items, ...rest) => { if (items.length) items[0] = { ...items[0], x: items[0].x + 3 }; return draw(ctx, items, ...rest); };
let moved;
try { moved = compare(one, bake(fresh())).differ; } finally { marks.draw = draw; }
assert(moved.some((k) => /\/l0\//.test(k)) && !moved.some((k) => k.endsWith('/sea')), `a moved mark is not seen, or the sea moved: ${moved.join(', ')}`);
assert.deepStrictEqual(compare(one, bake(fresh())), { differ: [], stale: [] }, 'put back, the bake is the same again');

// a restore that puts back the cover but not the rest (the colours among it): the tree reports a stale chunk
const cover = modules(VB, /cover/).find((m) => m.restore), restore = cover.restore;
cover.restore = (w, kept) => restore(w, { ...kept, arrays: { biome: kept.arrays.biome } });
let stale;
try { stale = compare({}, bake(fresh())).stale; } finally { cover.restore = restore; }
assert(stale.length === 1 && /restored is not the chunk before/.test(stale[0]), `a stale restore is not seen: ${stale.join('; ')}`);

// VB-1493: the paint kept up as the page keeps it (a tile recoloured where its cover is set by hand, the tiles of st.biomeDirty after a
// run's year) is the paint built anew; and a cover set with no recolour is caught, since the bake no longer mends a stale colour
const KEYS = ['tr', 'tg', 'tb', 'shade', 'cdist', 'chex', 'tile'];
const sameAs = (P, Q) => KEYS.filter((k) => Buffer.compare(Buffer.from(P[k].buffer), Buffer.from(Q[k].buffer)) !== 0);
{
  const w = fresh(), C = modules(VB, /cover/).find((m) => m.set && m.restore);
  D.paintOf(w);
  const covers = [];
  for (let i = 0; i < w.N && covers.length < 40; i++) if (!w.water[i] && D.setCover(w, i, w.biome[i] === D.B.HEATH ? D.B.PINE : D.B.HEATH)) covers.push(i);
  assert(covers.length === 40, 'forty tiles took another cover');
  assert.deepStrictEqual(sameAs(D.paintOf(w), D.Paint.paint(w)), [], 'recoloured where the cover was set, the paint is as built anew');
  const t = covers[0];
  C.set(w, t, w.biome[t] === D.B.HEATH ? D.B.PINE : D.B.HEATH);
  assert.deepStrictEqual(sameAs(D.paintOf(w), D.Paint.paint(w)), ['tr', 'tg', 'tb'], 'a cover set with no recolour leaves a stale colour, and is seen');
  D.recolour(w, [t]);
  const st = VB.sim.seed(w, 7, 'founders');
  VB.sim.advance(st, VB.sim.YEAR);
  assert(st.biomeDirty.size > 0, 'a year of the founders changes some biome');
  D.recolour(w, st.biomeDirty);
  assert.deepStrictEqual(sameAs(D.paintOf(w), D.Paint.paint(w)), [], 'the tiles of st.biomeDirty recoloured, the paint is as built anew');
}

const bad = cp.spawnSync(process.execPath, [path.join(__dirname, '../tools/samepixels.js'), '--record'], { encoding: 'utf8' });
assert(bad.status === 2 && /unknown option --record/.test(bad.stderr), 'nothing is recorded: there is no --record');
console.log(`samepixels: ${Object.keys(one).length} images the same twice; a pigment (${pig.length} differ) and a mark's place (${moved.length}) caught`);
