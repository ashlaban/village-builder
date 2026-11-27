// VB-1753: no rule reads who is played (design.md section 7, Plans at four scales: Authors; section 15, Parity of command).
// 1. Every read of `st.player` in src/sim (sim/outlook's two mended here as well), by module and function, classed: the frame (who is played, what the page follows of it), a
//    log line's or the sheet's audience, both kept; or a rule, on an allow-list that only falls (VB-1776 empties it). A new reader fails,
//    and so does one gone from the list, which is then lowered. The six modules of VB-1753 (chores, building, ladder, projects, camp,
//    upgrade) read it nowhere.
// 2. On the tiny village of three cottages on the ground (tests/farmtasks.js): a stone foundation authored through the plan by an
//    unplayed head's controller is raised as the played head's is, outside the slack, to the same state; with nothing authored, the
//    played head and the same head unplayed build the same with the switch off, and run to the same state with it on.
// 3. On the solo camp (tests/camp.js): the farmstead task authored for an unplayed head is checked against that head (it was refused as
//    'no pawn is played'), and placed and raised as the played head's.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readSource } = require('../tools/lib/source.js');
const VB = require('../src/load.js'),
  Sim = VB.sim;
const { tinyWorld, tinyState } = require('./lib/tiny.js'),
  { checkState } = require('./lib/invariants.js');
const { projectsOf } = VB['sim/projects'],
  { resetWish } = VB['sim/wishes'],
  { issue } = VB['sim/commands'],
  { BUILD, DAY } = VB['sim/rules'],
  Stores = VB['sim/stores'];

// ---- 1. the reads of st.player ----
const SIX = ['chores', 'building', 'ladder', 'projects', 'camp', 'upgrade'];
// Kept: module:function -> [reads, class, why]. Classes: 'frame' (who is played and what the page follows of it), 'audience' (a log
// line or an event for the played pawn's sheet, which no rule reads).
// @merge union
const KEPT = {
  'agents:complete': [2, 'audience', "the yield told on the played pawn's sheet (event yielded, sim/player)"],
  'doing:unload': [2, 'audience', "the trip's yield told on the played pawn's sheet (event yielded)"],
  'hands:refused': [2, 'audience', 'a refusal logged where the player is one of the two'],
  'hunger:updateHealth': [2, 'audience', "the day's health told on the played pawn's sheet (event health, sim/player)"],
  'notable:skipFrom': [1, 'frame', 'the skip follows the played pawn'],
  'notable:skipStop': [1, 'frame', "the skip stops on the played pawn's events"],
  'opportunities:successor': [3, 'frame', "the played pawn's successor, by the customs it died under (st.player.left)"],
  'opportunities:succeed': [1, 'frame', 'the player goes on as the successor'],
  'opportunities:firsts': [
    1,
    'audience',
    "(in round, after its inner firsts) the played pawn's own answer beside the round's, on its sheet and the skip's choice",
  ],
  'player:inhabit': [2, 'frame', 'the player inhabits a pawn'],
  'player:uninhabit': [4, 'frame', 'the player leaves it'],
  'player:playerDied': [1, 'frame', "the played pawn's death, told to the player"],
  'player:goOnAs': [2, 'frame', 'the player goes on as another pawn, or the line ends'],
  'player:on:yielded': [1, 'audience', "the played pawn's sheet"],
  'player:on:health': [1, 'audience', "the played pawn's sheet"],
  'player:yieldWords': [1, 'audience', "the played pawn's sheet"],
  'player:movedWords': [1, 'audience', "the played pawn's sheet"],
  'player:ailingWords': [1, 'audience', "the played pawn's sheet"],
  'reasons:reasonOf': [2, 'audience', 'the card says "you gave the order" on the played pawn only (VB-1745)'],
  'sleep:sleepOf': [1, 'frame', "the page's read of the played pawn's sleep"],
  'stories:notice': [1, 'audience', 'a story the played pawn comes to hold, an event of its life for the skip'],
  'timetable:taskFrom': [1, 'frame', "the skip until the played pawn's task ends"],
  'timetable:taskStop': [1, 'frame', "the same skip's stop"],
  'voice:refused': [2, 'audience', 'a refusal logged where the player is one of the two'],
};
// Rules that read who is played: module:function -> reads. Emptied by VB-1776 (each read now the controller's, sim/records unplanned, or
// the authored wish, sim/wishes authored; tests/lib/twins.js checks each changed rule); it stays empty.
const RULES = {};
// The reads in a module's code (comments left out), by the function around each: the last `function NAME(`, `const NAME = (...) =>` or
// `on('EVENT'` above it. A read is `X.player` through any name (`st`, `view`, a copy), or `player` taken apart (`const { player } = st`).
function reads(file, src) {
  const out = new Map(),
    mod = path.basename(file).replace(/\.(js|ts)$/, '');
  let fn = '(top)';
  for (const line of src.split('\n')) {
    const m = line.match(
      /^\s*(?:function\s+(\w+)\s*\(|(?:const|let)\s+(\w+)\s*=\s*(?:\([^)]*\)|\w+)\s*=>|on\('(\w+)')/,
    );
    if (m) fn = m[1] || m[2] || `on:${m[3]}`;
    const code = line.replace(/\/\/.*$/, ''),
      n =
        (code.match(/\b\w+\.player\b/g) || []).length +
        (code.match(/\{[^}]*\bplayer\b[^}]*\}\s*=(?![=>])/g) || []).length;
    if (!n) continue;
    const key = `${mod}:${fn}`;
    out.set(key, (out.get(key) || 0) + n);
  }
  return out;
}
// tests/played-reads.js checks the count; required, the rest of this script does not run.
module.exports = { reads };
if (require.main !== module) return;
{
  const dir = path.join(__dirname, '..', 'src', 'sim'),
    found = new Map();
  for (const f of fs.readdirSync(dir).sort())
    if (/\.(js|ts)$/.test(f)) for (const [k, n] of reads(f, readSource(path.join(dir, f)))) found.set(k, n);
  const errors = [];
  for (const [k, n] of found) {
    if (SIX.includes(k.split(':')[0]))
      errors.push(`${k}: ${n} read(s) of st.player in a module VB-1753 freed of them: read the plan`);
    else if (KEPT[k]) {
      if (KEPT[k][0] !== n) errors.push(`${k}: ${n} read(s), ${KEPT[k][0]} listed as ${KEPT[k][1]}: list them again`);
    } else if (RULES[k] === undefined)
      errors.push(`${k}: ${n} new read(s) of st.player: a rule reads the controller or the plan, or class it`);
    else if (n > RULES[k]) errors.push(`${k}: ${n} read(s), the allow-list has ${RULES[k]}: it only falls`);
    else if (n < RULES[k]) errors.push(`${k}: ${n} read(s), the allow-list has ${RULES[k]}: lower it (it only falls)`);
  }
  for (const k of [...Object.keys(KEPT), ...Object.keys(RULES)])
    if (!found.has(k)) errors.push(`${k}: listed but read no more: take it off the list`);
  assert.deepStrictEqual(errors, [], 'the reads of st.player in src/sim');
  const rules = Object.values(RULES).reduce((s, n) => s + n, 0);
  assert.strictEqual(rules, 0, 'no rule reads who is played (VB-1776): the allow-list stays empty');
  console.log(
    `  st.player: ${found.size} readers; ${Object.keys(KEPT).length} kept (frame, audience), ${Object.keys(RULES).length} rules on the allow-list (${rules} reads, VB-1776 emptied it)`,
  );
}

// ---- 2. the village of cottages: the played head and the unplayed one ----
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const sound = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants, ${what}`);
const { same } = require('./lib/twins.js');
// The village of three cottages on the ground; pawn 0 heads its household, its projects dropped. `play`: inhabited; `auto`: its switch;
// `sleep`: the hours its plan sets.
function village(play, auto) {
  const st = tinyState(tinyWorld(rows, { stones: 200 }), [{ at: [8, 7], farms: 3 }], { seed: 4 });
  st.naturalDeaths = false;
  Sim.advance(st, 3);
  if (play) Sim.inhabit(st, 0);
  else {
    resetWish(st, 0); // as inhabit starts the played pawn from the default wish (sim/player)
    issue(st, { actor: 0, verb: 'auto', args: { on: true }, source: 'pawn' }); // its controller, as inhabit makes it
  }
  Sim.setAuto(st, 0, auto);
  const hh = st.households[st.pawns[0].household],
    f = st.farmsteads[hh.farmstead];
  for (const p of projectsOf(st, 'household', hh.id))
    issue(st, { actor: 0, verb: 'dropProject', target: hh.id, args: { id: p.id }, source: 'pawn' });
  return { st, hh, f };
}
// 2a. A stone foundation authored by the head's controller, the stone at the heap: raised outside the slack, played or not, the same.
{
  const runs = [true, false].map((play) => {
    const v = village(play, false);
    assert.strictEqual(
      Sim.plan(v.st, 0, 'add', { foundation: v.f.house }),
      true,
      `the foundation authored (${play ? 'played' : 'unplayed'})`,
    );
    Stores.put(v.st, v.hh, 'stone/granite', BUILD.foundationStone, 'pick');
    for (let d = 0; d < 30 && v.f.grade !== 'stone'; d++) Sim.advance(v.st, DAY);
    assert.strictEqual(v.f.grade, 'stone', `the house set on stone by the plan (${play ? 'played' : 'unplayed'})`);
    assert.strictEqual(Sim.cal(v.st.t).season, 0, 'in spring, outside the slack: the authored step stands');
    sound(v.st, 'raised by the plan');
    return v.st;
  });
  same(runs[0], runs[1], 'the authored foundation, the played head against the unplayed');
}
// 2b. Nothing authored, the switch off: neither head begins a project or a stone step by itself, and the two run to the same state: an ask of leave to a head with its switch off waits for its controller's answer, played
// or not, and the played head's controller is the player's (sim/offers make, VB-1776).
{
  const built = (v) => ({
    build: v.st.plans.households.get(v.hh.id).build,
    projects: projectsOf(v.st, 'household', v.hh.id).map((p) => p.what),
    farm: { grade: v.f.grade, booth: !!v.f.booth, rung: v.f.rung, barn: !!v.f.barn, byre: !!v.f.byre },
    jobs: [...v.st.jobs.values()]
      .filter((j) => j.owner && j.owner.type === 'household' && j.owner.id === v.hh.id)
      .map((j) => j.key)
      .sort(),
  });
  const [a, b] = [true, false].map((play) => {
    const v = village(play, false);
    Sim.advance(v.st, 20 * DAY);
    assert.strictEqual(v.st.plans.households.get(v.hh.id).build, null, 'with the switch off, no stone step by itself');
    assert.deepStrictEqual(built(v).projects, [], 'with the switch off, no project begun by itself');
    sound(v.st, play ? 'played, the switch off' : 'unplayed, the switch off');
    return v;
  });
  assert.deepStrictEqual(built(a), built(b), 'nothing authored, the switch off: the household builds the same, played or not');
  same(a.st, b.st, 'nothing authored, the switch off: the played head against the unplayed');
}
// 2c. Nothing authored, the switch on: the played head and the unplayed one run to the same state.
{
  const [a, b] = [true, false].map((play) => {
    const v = village(play, true);
    Sim.advance(v.st, 20 * DAY);
    return v.st;
  });
  sound(b, 'unplayed');
  same(a, b, 'nothing authored, the switch on: the played head against the unplayed');
}

// ---- 3. the solo camp: the farmstead task authored for an unplayed head ----
{
  const runs = [true, false].map((play) => {
    const st = Sim.seed(tinyWorld(rows), 7, 'solo', null, { hand: true });
    st.naturalDeaths = false;
    const id = st.households[0].holder,
      f = st.farmsteads[0];
    if (play) Sim.inhabit(st, id);
    else {
      resetWish(st, id);
      issue(st, { actor: id, verb: 'auto', args: { on: true }, source: 'pawn' });
    }
    Sim.setAuto(st, id, false);
    assert.strictEqual(Sim.placeWhy(st, id, 'farmstead', f.house), null, 'the landing takes it, for this head');
    assert.strictEqual(
      Sim.plan(st, id, 'add', { farmstead: f.house }),
      true,
      `the farmstead authored (${play ? 'played' : 'unplayed'})`,
    );
    for (let d = 0; d < 20 && VB['sim/steps'].pawnPlan(st, id).tasks.some((t) => t.kind === 'farmstead'); d++)
      Sim.advance(st, DAY);
    assert(
      f.shelter && f.shelter.built !== null && f.camp === false,
      `the shelter raised by the plan (${play ? 'played' : 'unplayed'})`,
    );
    sound(st, 'the camp roofed');
    return st;
  });
  same(runs[0], runs[1], 'the authored farmstead, the played head against the unplayed');
  // Then a cottage authored with the switch on (sim/building cottageAsked): roofed outside the slack, not held to winter, played or not.
  for (const st of runs) {
    const id = st.households[0].holder,
      f = st.farmsteads[0],
      t0 = st.t;
    Sim.setAuto(st, id, true);
    assert.strictEqual(Sim.plan(st, id, 'add', { upgrade: f.house, what: 'cottage' }), true, 'the cottage authored');
    for (let d = 0; d < 30 && f.booth; d++) Sim.advance(st, DAY);
    assert(!f.booth, `the cottage roofed by the plan within 30 days (${st.player ? 'played' : 'unplayed'})`);
    assert.notStrictEqual(Sim.cal(st.t).season, 3, 'the authored cottage did not wait for the winter slack');
    assert(st.t - t0 < 30 * DAY);
    sound(st, 'the cottage roofed');
  }
  same(runs[0], runs[1], 'the authored cottage, the switch on, the played head against the unplayed');
}
console.log(
  'played.js: OK: the reads of st.player classed; an authored step stands for any head; nothing authored, played and unplayed the same',
);
