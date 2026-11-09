// VB-088: history growth at fixed fixture windows; clocks are read here, never by simulation modules.
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const F = require('./lib/fixtures.js'), { measure, growth, check, timing, NAMES } = require('./lib/cost.js');
if (!isMainThread) {
  const notices = [], fixture = F.loadFixture(workerData, { fetch: false, notice: (s) => notices.push(s) });
  parentPort.postMessage(fixture ? { notices, stamp: fixture.stamp, stale: fixture.stale, result: measure(fixture.st, { timed: true }) }
    : { notices });
} else main().catch((e) => { console.error(e); process.exitCode = 1; });

function windowOf(name) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, { workerData: name });
    let result;
    worker.on('message', (data) => { result = data; });
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0 || !result) reject(new Error(`${name}: history worker exited ${code} without a result`));
      else resolve(result);
    });
  });
}
async function main() {
  const names = ['small-y5', 'small-y40'], started = performance.now();
  // Only the parent fetches: concurrent workers never replace the same fixture files.
  if (names.some((name) => F.status(name).status === 'missing')) F.fetchFixtures();
  const windows = await Promise.all(names.map(windowOf)), results = [];
  for (let i = 0; i < windows.length; i++) {
    const { notices, result, stamp, stale } = windows[i], name = names[i];
    notices.forEach((s) => console.log(s));
    if (!result) continue;
    console.log(`${name}: ${stale ? 'stale' : 'fresh'} fixture at ${stamp.commit.slice(0, 7)}`);
    console.log(`${name}: ${result.pawnDays.toFixed(3)} living pawn-days; work ${JSON.stringify(result.work)}`);
    timing(name, result); results.push(result);
  }
  if (results.length !== 2) console.log('history: skipped comparison; both small-y5 and small-y40 are required');
  else {
    check('history', growth(...results), { update: process.argv.includes('--update') });
    // Kim's line (7 November) on the wall clock: reported only, since both windows run at once on a shared machine (VB-203).
    const [early, late] = results.map((r) => r.ms / r.pawnDays);
    console.log(`history: ${early.toFixed(4)} and ${late.toFixed(4)} ms a living pawn-day, round included; wall-clock ratio`
      + ` ${(late / early).toFixed(3)} against the line's 1.25 (reported only)`);
    console.log(`history: ${NAMES.length} counters pass (including known excesses); timings reported only;`
      + ` ${((performance.now() - started) / 1000).toFixed(1)} s elapsed`);
  }
}
