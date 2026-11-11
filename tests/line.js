// The played line, reduced (VB-078; the full runs are `node tools/player.js`): the scripted player of tests/lib/line.js plays populous on the tiny
// map; a run saved and loaded every year ends with the same golden hashes as the unbroken one, with and without the player; every job a pawn
// takes in a stepped window was taken by a work command; the commands are counted by source; and the played pawn, for one game day with the
// automatic behaviour off, does only what its queue and the dark told it.
const assert = require('assert');
const { playLine } = require('./lib/line.js');
const SOURCES = new Set(['planner', 'player', 'round', 'meeting', 'debug', 'talk', 'help', 'construction', 'restoration', 'occasion']);
const diff = (a, b) => Object.keys({ ...a, ...b }).filter((k) => a[k] !== b[k]);
const base = { scenario: 'populous', seed: 7, map: 'tiny', years: 3 }, window = { autoOffDay: 20, takeFrom: 60 };

// 1. A played run, saved and loaded every year, plays as the unbroken one.
const a = playLine({ ...base, player: true, stepDays: window }), b = playLine({ ...base, player: true, stepDays: window, saveEvery: 1 });
assert.deepStrictEqual(diff(a.hashes, b.hashes), [], 'a played run, saved and loaded every year, ends with the unbroken run\'s hashes');
assert.strictEqual(b.saves.n, 3);
assert.ok(a.report().pawns.length >= 1 && a.state.player, 'a pawn is played');

// 2. The same with no player.
const c = playLine({ ...base, player: false }), d = playLine({ ...base, player: false, saveEvery: 1 });
assert.deepStrictEqual(diff(c.hashes, d.hashes), [], 'an unplayed run, saved every year, ends with the unbroken run\'s hashes');
assert.ok(!c.state.player && Object.keys(c.counts).every((s) => s !== 'player'), 'no player, no command of the player\'s');

// 3. Every command has a source we know, the player's among them; jobs are taken by work commands only.
assert.ok(Object.keys(a.counts).every((s) => SOURCES.has(s)), `sources: ${Object.keys(a.counts)}`);
assert.ok(a.counts.planner.work > 0 && a.counts.player && a.counts.player.work > 0, JSON.stringify(a.counts));
assert.ok(a.jobs.took > 0 && a.jobs.stray === 0 && a.jobs.commanded === a.jobs.took, `jobs taken by commands: ${JSON.stringify(a.jobs)}`);

// 4. One game day with the automatic behaviour off: the played pawn takes no work and walks nowhere of its own; the planner only sends it
// home at the end of work.
assert.ok(a.autoOff && a.autoOff.player >= 1, JSON.stringify(a.autoOff));
const own = a.autoOff.others.filter((x) => !/^talk:haltForTalk/.test(x));
assert.ok(own.every((x) => /^planner:goHome@(1[89]|2\d|[0-5])\./.test(x)), `only the dark sent it home: ${own}`);
console.log(`line ok: ${a.report().pawns.length} pawn(s) played over 3 years; hashes equal when saved yearly (${Object.keys(a.hashes).length} keys), played and not; `
  + `${a.jobs.took} jobs taken in the window, all by commands; commands by source ${JSON.stringify(Object.fromEntries(Object.entries(a.counts).map(([s, v]) => [s, Object.values(v).reduce((x, y) => x + y, 0)])))}`);
