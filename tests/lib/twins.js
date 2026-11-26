// VB-1776: the played pawn on automatic with nothing queued acts as the same pawn unplayed (design.md section 7, Plans at four scales:
// Authors, no rule reads who is played; section 15, Parity of command). A scene made twice: once with pawn id inhabited (its controller
// automatic, nothing queued, its wish the default, as inhabit makes it), once with the same pawn under a controller of its own made the
// same way (the verb auto, the default wish); the scene's step run on each; the two states, the frame taken out, compared.
const assert = require('assert');
const VB = require('../../src/load.js'),
  Sim = VB.sim;
const { canon, sha, kept, leaves } = require('./canon.js'),
  { dropKind } = require('./record.js');
// The state with the frame taken out (st.player, its marks and the lines logged for its audience): what a rule could have read of who
// is played. `me`: whose refusals are dropped (by default the played pawn's; the twins drop their pawn's in both, since a basis that
// logs every refusal logs the unplayed one's too).
function unframed(st, me = st.player ? st.player.pawn : null) {
  const s = structuredClone(st);
  s.player = null;
  dropKind(s, 'player');
  // a refusal logged where the player is one of the two: its audience (sim/hands, sim/voice); the others' stay compared
  dropKind(s, 'offerRefused', (e) => e.pawn === me || e.other === me);
  return s;
}
const hash = (st, me) => sha(canon(kept(unframed(st, me))));
// The first leaves where two states differ (for the message).
function differ(a, b, me) {
  const la = [],
    lb = [];
  leaves(kept(unframed(a, me)), '$', new Map(), la);
  leaves(kept(unframed(b, me)), '$', new Map(), lb);
  const sb = new Set(lb);
  return la
    .filter((l) => !sb.has(l))
    .slice(0, 6)
    .join('\n');
}
const same = (a, b, what, me) => assert.strictEqual(hash(a, me), hash(b, me), `${what}:\n${differ(a, b, me)}`);
// Pawn id of st played by the player, or under a controller of its own: automatic, nothing queued, the default wish.
function control(st, id, play) {
  if (play) return assert.strictEqual(Sim.inhabit(st, id), true, `pawn ${id} inhabited`);
  VB['sim/wishes'].resetWish(st, id); // as inhabit starts the played pawn from the default wish (sim/player)
  const r = VB['sim/commands'].issue(st, { actor: id, verb: 'auto', args: { on: true }, source: 'pawn' });
  assert.strictEqual(r, true, `pawn ${id}'s own controller, as inhabit makes it`);
}
// make(): a fresh scene; run(st, played): its step. The two states compared; [played, unplayed] returned for the scene's own asserts.
function twins(make, id, run, what) {
  const out = [true, false].map((play) => {
    const st = make();
    control(st, id, play);
    run(st, play);
    return st;
  });
  same(out[0], out[1], `${what}: the played pawn on automatic against the same pawn unplayed`, id);
  return out;
}
module.exports = { unframed, hash, differ, same, control, twins };
