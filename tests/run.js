// Test runner: scripts in parallel, one per core; the real browsers share one lane, one at a time (they render sparsely: tests/lib/browser.js).
// Prints a failing script's full output and the summary; a passing script's last line only with `--list` or in a terminal (agents
// read the output, so a run that passes costs one line).
// `node tests/run.js test` runs the cheap checks; `node tests/run.js verify` runs those and the long verification runs.
// `--verbose` prints every script's full output (the reported, not asserted, numbers of births.js and hunger.js, for example).
const { spawn } = require('child_process'), os = require('os'), path = require('path');
const root = path.join(__dirname, '..');
const TEST = [
  ['node', 'tests/marriage-demography.js'],
  ['node', 'tests/spread.js'], ['node', 'tests/clock.js'], ['node', 'tests/dependencies.js'], ['node', 'tests/stores.js'], ['node', 'tests/cost-rules.js'], ['node', 'tests/scaling.js'],
  ['node', 'tests/fixture-tools.js'],
  ['node', '--expose-gc', 'tests/goods.js'],
  ['node', 'tests/bench.js'],
  ['node', 'tests/speed.js'],
  ['node', '--expose-gc', 'tests/registry.js'],
  ['node', 'tests/ownership.js'], ['node', 'tests/ownershiprules.js'],
  ['node', 'tests/cacheowners.js'], ['node', 'tests/living.js'],
  ['python3', 'build.py', '--check'], ['node', 'tests/lint.js'], ['node', 'tests/lintrules.js'], ['node', 'tests/deaths.js'], ['node', 'tests/notable.js'], ['node', 'tests/counters.js'], ['node', 'tests/rng.js'], ['node', 'tests/plaindata.js'], ['node', 'tests/codec.js'], ['node', 'tests/record.js'], ['node', 'tests/commands.js'], ['node', 'tests/player.js'], ['node', 'tests/wishes.js'], ['node', 'tests/succession.js'], ['node', 'tests/skip.js'], ['node', 'tests/chronicle.js'], ['node', 'tests/opportunities.js'], ['node', 'tests/backlog.js'], ['node', 'tests/backlog-tool.js'], ['node', 'tests/targets-tool.js'], ['node', 'tests/doc-tool.js'], ['node', 'tests/questions-tool.js'], ['node', 'tests/agent-usage.js'], ['node', 'tests/regress.js'], ['node', 'tests/names.js'], ['node', 'tests/guardians.js'], ['node', 'tests/takenin.js'], ['node', 'tests/marriage.js'], ['node', 'tests/spacing.js'],
  ['node', 'tests/trees.js'], ['node', 'tests/stones.js'], ['node', 'tests/rivers.js'], ['node', 'tests/newfields.js'], ['node', 'tests/weeding.js'], ['node', 'tests/crops.js'], ['node', 'tests/children.js'], ['node', 'tests/kinds.js'], ['node', 'tests/hands.js'], ['node', 'tests/interrupts.js'], ['node', 'tests/heirs.js'], ['node', 'tests/guardian.js'], ['node', 'tests/ownheir.js'], ['node', 'tests/owners.js'], ['node', 'tests/kinlimit.js'], ['node', 'tests/kinship.js'], ['node', 'tests/daylight.js'], ['node', 'tests/service.js'], ['node', 'tests/routes.js'], ['node', 'tests/paths.js'], ['node', 'tests/layout.js'], ['node', 'tests/tools.js'], ['node', 'tests/indexes.js'], ['node', 'tests/meals.js'], ['node', 'tests/plans.js'], ['node', 'tests/plots.js'], ['node', 'tests/cottage.js'], ['node', 'tests/settle.js'], ['node', 'tests/relations.js'], ['node', 'tests/help.js'], ['node', 'tests/exchange.js'], ['node', 'tests/goodwill.js'], ['node', 'tests/herds.js'], ['node', 'tests/meadows.js'], ['node', 'tests/hay.js'], ['node', 'tests/byre.js'], ['node', 'tests/milk.js'], ['node', 'tests/soil.js'], ['node', 'tests/fresh.js'], ['node', 'tests/oxen.js'], ['node', 'tests/tiny.js'], ['node', 'tests/claims.js'], ['node', 'tests/territory.js'], ['node', 'tests/borders.js'], ['node', 'tests/stakes.js'], ['node', 'tests/farmclaims.js'], ['node', 'tests/offers.js'], ['node', 'tests/occasions.js'],
];
const VERIFY = [
  ...TEST, ['node', 'tests/golden.js'], ['node', 'tests/populous.js'], ['node', 'tests/births.js'], ['node', 'tests/hunger.js'], ['node', 'tests/health.js'], ['node', 'tests/invariants.js'], ['node', 'tests/saves.js'],
  ['node', 'tests/smoke.js'], ['node', 'tests/browser.js'], ['node', 'tests/browser-speed.js'], ['node', 'tests/browser-mobile.js'], ['node', 'tests/browser-saves.js'],
  ['node', 'tests/fixtures.js'],
  ['node', 'tests/history.js'],
  ['node', 'tests/bands.js'], ['node', 'tests/line.js'],
];
const suite = process.argv[2], verbose = process.argv.includes('--verbose'), list = process.argv.includes('--list') || process.stdout.isTTY;
const cmds = { test: TEST, verify: VERIFY }[suite];
if (!cmds) { console.error('usage: node tests/run.js test|verify [--list] [--verbose]'); process.exit(2); }
// The static checks first, since they fail most often and cost seconds; then longest first, so the slow scripts do not start last.
const FIRST = ['build.py', 'lint', 'ownership', 'dependencies', 'backlog.js'];
const SLOW = ['smoke', 'tools', 'populous', 'saves', 'golden', 'births', 'invariants', 'bands', 'paths', 'fixtures.js', 'indexes'];
const rank = (c) => {
  const name = c.join(' '), first = FIRST.some((s) => name.includes(s)), k = SLOW.findIndex((s) => name.includes(s));
  return first ? -1 : k < 0 ? SLOW.length : k;
};
const isBrowser = (c) => c.some((a) => /^tests\/browser(?:-speed|-mobile|-saves)?\.js$/.test(a));
// The late fixtures are a local cache (VB-272): the small pair is made first, when the sources lack it (about 2 minutes on one core,
// beside the other scripts), and the two scripts that load it follow in the same lane.
const usesFixtures = (c) => c.some((a) => /^tests\/(?:fixtures|history)\.js$/.test(a));
const late = cmds.filter(usesFixtures), loose = (c) => !isBrowser(c) && !usesFixtures(c);
const chains = [cmds.filter(isBrowser), late.length ? [['node', 'tools/fixtures.js', 'make-missing', 'small-y5', 'small-y40'], ...late] : []]
  .filter((c) => c.length);
const queue = cmds.filter(loose).sort((a, b) => rank(a) - rank(b));
const t0 = Date.now(), failed = [], targets = [];
const { parse } = require('./lib/targets.js');
function run(cmd) {
  return new Promise((done) => {
    const t = Date.now(), p = spawn(cmd[0], cmd.slice(1), { cwd: root }); let out = '';
    p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { out += d; });
    p.on('close', (code) => {
      targets.push(...parse(out));
      const name = cmd.slice(1).join(' '), secs = ((Date.now() - t) / 1000).toFixed(1), lines = out.trim().split('\n');
      if (code) { failed.push(name); console.log(`FAIL ${name} (${secs} s)\n${out.trim()}\n`); }
      else if (verbose) console.log(`ok   ${name} (${secs} s)\n${out.trim()}\n`);
      else if (list) console.log(`ok   ${name} (${secs} s): ${lines[lines.length - 1].slice(0, 120)}`);
      done();
    });
  });
}
const jobs = Number(process.env.VB_TEST_JOBS) || os.cpus().length;
// The browsers take one lane, one after another, beside the other scripts, and the fixture scripts another; a lane joins the queue
// when its chain is done.
const lanes = Math.max(1, Math.min(jobs, queue.length + chains.length));
(async () => {
  await Promise.all(Array.from({ length: lanes }, async () => {
    while (chains.length) for (const cmd of chains.shift()) await run(cmd);
    while (queue.length) await run(queue.shift());
  }));
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (failed.length) { console.log(`${suite}: ${failed.length} failed (${failed.join(', ')}) in ${secs} s`); process.exit(1); }
  // targets are reported, never gating: the summary names those out (docs/gates.md, section 2)
  const outs = targets.filter((t) => t.status === 'out');
  const more = outs.length ? `; ${outs.length} targets out (${outs.slice(0, 6).map((t) => `${t.name} +${t.residual}`).join(', ')}${outs.length > 6 ? ', ...' : ''})` : '';
  console.log(`${suite}: ${cmds.length} scripts passed in ${secs} s${more}`);
})();
