// Process supervision shared by the suite and its subprocess regression tests.
const { spawn } = require('child_process');
const os = require('os');
const active = new Set();
function stopAll() { for (const stop of active) stop(); }
function positive(value, fallback, name) {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) throw new Error(`${name} must be a positive integer`);
  return n;
}
const workers = (value) => positive(value, os.availableParallelism?.() || os.cpus().length, 'VB_TEST_JOBS');
const isBrowser = (cmd) => cmd.some((a) => /^tests\/browser(?:-[\w-]+)?\.js$/.test(a));
function run(cmd, { cwd, timeoutMs = 120000, graceMs = 500 } = {}) {
  return new Promise((resolve) => {
    const started = Date.now(), grouped = process.platform !== 'win32';
    const child = spawn(cmd[0] === 'node' ? process.execPath : cmd[0], cmd.slice(1), { cwd, detached: grouped });
    let output = '', error, timedOut = false, closed = false, code, signal, force;
    const kill = (sig) => {
      try { if (grouped && child.pid) process.kill(-child.pid, sig); else child.kill(sig); }
      catch (e) { if (e.code !== 'ESRCH') error ||= e; }
    };
    const finish = () => { active.delete(stop); resolve({ cmd, code, signal, output, error, timedOut,
      ok: code === 0 && !signal && !error && !timedOut, ms: Date.now() - started }); };
    child.stdout.on('data', (d) => { output += d; });
    child.stderr.on('data', (d) => { output += d; });
    child.on('error', (e) => { error = e; });
    function stop() {
      if (timedOut) return;
      timedOut = true; kill('SIGTERM');
      // Always kill the group after grace, even if its parent exits first.
      force = setTimeout(() => { kill('SIGKILL'); force = null; if (closed) finish(); }, graceMs);
    }
    active.add(stop);
    const timer = setTimeout(stop, timeoutMs);
    child.on('close', (c, s) => {
      closed = true; code = c; signal = s; clearTimeout(timer);
      if (!force) finish();
    });
  });
}
module.exports = { positive, workers, isBrowser, run, stopAll };
