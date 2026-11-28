// @suite fast
// VB-082: customs made legible. A village meeting's log line for a changed custom gives the votes and the margin needed, read from the
// ballots sim/decisions keeps; a custom whose leading way came within 5% of the support it needed is noted in the meeting log only; the
// pawn's leanings against its village's practice (sim/leanings, leansOf); a cause taken up is notable and told with its pawn's name.
// A tiny state of one village, its voices' minds on one custom set by hand.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, Customs = VB['sim/customs'], M = VB['sim/meetings'], L = VB['sim/leanings'];
const { tinyWorld, tinyState } = require('./lib/tiny.js');

const w = tinyWorld(Array.from({ length: 10 }, () => '.'.repeat(14))),
  st = tinyState(w, [{ at: [6, 5], farms: 3 }], { seed: 5 });
const s = st.cenv.settlements[0],
  d = Customs.IDX.heirCount,
  o = Customs.OFF[d],
  n = Customs.NOPT[d],
  x = s.practice[d],
  y = (x + 1) % n,
  people = Sim.membersOf(st, 0);
// every voice gives way x share a and way y share b on the custom, and takes up no cause at this meeting
function minds(a, b) {
  for (const p of people) {
    for (let j = 0; j < n; j++) p.att[o + j] = j === x ? a : j === y ? b : 0;
    p.advocate = null;
    p.causeSince = st.cenv.t;
  }
}
function meet() {
  st.decisionLog = [];
  st.meetingLog = [];
  M.meetingStage(st, 0); // the village's meeting alone, not its culture's year
  return st.decisionLog.find((b) => b.kind === 'custom' && b.dim === d && b.body === 0);
}
const label = Customs.DIMS[d].label.toLowerCase(),
  way = (j) => Customs.DIMS[d].opts[j][1];

// nearly even: contested, far from the margin, no line
minds(0.49, 0.51);
const b = meet();
assert.ok(b && b.chosen === x && b.need > 0, 'a nearly even vote keeps the practice and keeps its ballot');
assert.ok(!st.meetingLog.some((e) => e.text.includes(label)), 'far from changing: no line');

// within 5% of what it needed: noted as close, in the meeting log only
const need = b.need;
minds(0.3, 0.3 * (1 + need) * 0.97);
const recorded = st.record.length;
meet();
const close = st.meetingLog.find((e) => e.close);
assert.ok(close, 'a near miss is noted');
assert.ok(close.text.startsWith(`At the ${s.name} meeting: ${label} stays “${way(x)}”, narrowly: “${way(y)}”`), close.text);
assert.ok(close.text.endsWith(`needed ${Math.round(need * 100)}% more.`), close.text);
assert.ok(!st.record.slice(recorded).some((e) => e.kind === 'custom'), 'the near miss is not a record event');
assert.strictEqual(s.practice[d], x);

// short by more: no line
minds(0.3, 0.3 * (1 + need) * 0.9);
meet();
assert.ok(!st.meetingLog.some((e) => e.close), 'short by a tenth: no line');

// past the margin: the change, with its votes and margin, in the log and the record
minds(0.2, 0.8);
const changed = meet();
const line = st.meetingLog.find((e) => e.text.includes(`${label} is now`));
assert.ok(line && changed.chosen === y, 'the custom changed');
assert.strictEqual(
  line.text,
  `At the ${s.name} meeting: ${label} is now “${way(y)}” (was “${way(x)}”), by 80% against 20%; it needed ${Math.round(changed.need * 100)}% more.`,
);
assert.ok(st.record.some((e) => e.kind === 'custom' && e.text === line.text), 'told in the record');

// leanings: the widest first, none under LEAN_MIN, none where the practice is favoured
const p = people[0],
  practice = Int8Array.from(s.practice);
assert.deepStrictEqual(L.leansOf(p, practice), [], 'its mind is the practice now');
practice[d] = x;
const l = L.leansOf(p, practice);
assert.strictEqual(l.length, 1);
assert.deepStrictEqual({ ...l[0], by: Math.round(l[0].by * 100) / 100 }, { dim: d, opt: y, practice: x, by: 0.6 });
for (let j = 0; j < n; j++) p.att[o + j] = j === x ? 0.48 : j === y ? 0.52 : 0;
assert.deepStrictEqual(L.leansOf(p, practice), [], `a lead under ${L.LEAN_MIN} is no leaning`);

// a cause taken up on its own is notable, told with the name; one ended or dropped is not
const ev = { t: st.t, kind: 'cause', pawn: p.id, text: 'Took up the cause: heirs, any child', reason: 'natural', village: 0 };
assert.deepStrictEqual(Sim.notable(st, ev), ['cause']);
assert.strictEqual(Sim.eventLine(st, ev), `${Sim.fullName(p)} took up the cause: heirs, any child.`);
assert.strictEqual(Sim.notable(st, { ...ev, reason: 'lapsed', text: 'x' }), null);
assert.strictEqual(Sim.notable(st, { ...ev, reason: undefined, text: 'Dropped the cause: heirs' }), null);
assert.ok(Sim.NOTABLE.cause);
console.log('customlog: ok');
