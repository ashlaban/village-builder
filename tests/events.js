// VB-229: the event channel. Every kind has an emitter and a subscriber; subscribers run at once, in the order they registered; registering
// closes with the registries; a subscriber whose command is refused changes nothing further.
const assert = require('assert');
const { scan, problems } = require('../tools/events.js');
const kinds = scan();
assert.deepStrictEqual(problems(kinds), []);
for (const k of ['claimTaken', 'borderLost', 'bullLent']) assert(kinds[k] && kinds[k].subscribers.every((s) => s.startsWith('sim/relations')), k);
assert.strictEqual(problems({ x: { emitters: ['a:1'], subscribers: [] }, y: { emitters: [], subscribers: ['b:2'] } }).length, 2, 'both kinds of orphan fail');

const VB = require('../src/load.js'), Events = VB['sim/events'], { issue } = VB['sim/commands'], Sim = VB.sim, G = VB.gen;
const seen = [];
Events.on('test', (st, d) => seen.push(['a', d.n]));
Events.on('test', (st, d) => seen.push(['b', d.n]));
Events.emit({}, 'test', { n: 1 });
Events.emit({}, 'none', { n: 2 });
assert.deepStrictEqual(seen, [['a', 1], ['b', 1]], 'at once, in registration order; an unheard kind does nothing');

// a subscriber that issues a command and is refused changes nothing further, and the next subscriber still runs
let why, st, before;
const dump = () => JSON.stringify(st, (k, v) => (v instanceof Map ? [...v] : v instanceof Set ? [...v] : v));
Events.on('refuse', (s) => { before = dump(); why = issue(s, { actor: 999999, verb: 'work', target: -1, args: {}, source: 'planner' }); });
Events.on('refuse', () => seen.push('after'));
const it = G.generate(7, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done);
st = Sim.seed(r.value, 7, 'heirs');
assert.throws(() => Events.on('late', () => {}), /load time/, 'sealed with the registries (the seed sealed them)');
Events.emit(st, 'refuse', {});
assert.strictEqual(typeof why, 'string', 'the command is refused with a reason');
assert.strictEqual(dump(), before, 'a refused command changes nothing');
assert.strictEqual(seen[seen.length - 1], 'after', 'the next subscriber still runs');
console.log(`events: ${Object.keys(kinds).length} kinds, each emitted and subscribed; a refused command is inert`);
