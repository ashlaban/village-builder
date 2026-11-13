const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { run, workers, isBrowser } = require('./lib/runner.js');
const node = (code) => [process.execPath, '-e', code];
(async () => {
  assert((await run(node("console.log('hello')"))).ok);
  const failed = await run(node("console.error('broken'); process.exit(3)"));
  assert(!failed.ok && failed.code === 3 && failed.output.includes('broken'));
  const missing = await run(['definitely-not-a-village-builder-command']);
  assert(!missing.ok && missing.error.code === 'ENOENT');
  if (process.platform !== 'win32') {
    const killed = await run(node("process.kill(process.pid, 'SIGKILL')"));
    assert(!killed.ok && killed.signal === 'SIGKILL');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-runner-')), marker = path.join(dir, 'survived');
    try {
      const grandchild = `process.on('SIGTERM',()=>{}); setTimeout(()=>require('fs').writeFileSync(${JSON.stringify(marker)},'bad'),1000); setInterval(()=>{},1000)`;
      const timeout = await run(node(`require('child_process').spawn(process.execPath,['-e',${JSON.stringify(grandchild)}],{stdio:'ignore'}); setInterval(()=>{},1000)`),
        { timeoutMs: 300, graceMs: 100 });
      assert(!timeout.ok && timeout.timedOut);
      await new Promise((resolve) => setTimeout(resolve, 1100));
      assert(!fs.existsSync(marker), 'timeout kills descendants even when the parent exits on SIGTERM');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  for (const value of ['0', '-1', '1.5', 'NaN', 'Infinity', '']) assert.throws(() => workers(value), /positive integer/);
  assert.strictEqual(workers('2'), 2);
  assert(isBrowser(['node', 'tests/browser-editor.js']));
  assert(isBrowser(['node', 'tests/browser-future.js']));
  assert(!isBrowser(['node', 'tests/speed.js']));
  const { FAST, INTEGRATION, EXTENDED } = require('./suites.js');
  const all = [...FAST, ...INTEGRATION, ...EXTENDED].map((c) => c.join(' '));
  assert.strictEqual(new Set(all).size, all.length, 'tiers do not duplicate commands');
  for (const cmd of [...FAST, ...INTEGRATION, ...EXTENDED]) {
    const script = cmd.find((a) => /\.(js|py)$/.test(a)); assert(fs.existsSync(path.join(__dirname, '..', script)), script);
  }
  console.log('runner: exits, signals, spawn errors, timeout cleanup, worker validation and tier inventory pass');
})().catch((e) => { console.error(e); process.exitCode = 1; });
