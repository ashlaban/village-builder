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
// CPU seconds of the children reaped so far (user and system, Linux's /proc; null elsewhere): read as each script exits, the step is that
// script's CPU (VB-856), a measure that holds on a loaded machine where its wall time does not. Two that exit in the same tick share a step.
const TICK = 100; // clock ticks a second (getconf CLK_TCK; 100 on Linux)
function childCpu() {
  try {
    const f = require('fs').readFileSync('/proc/self/stat', 'utf8'), rest = f.slice(f.lastIndexOf(')') + 2).split(' ');
    return (+rest[13] + +rest[14]) / TICK; // cutime and cstime, the 16th and 17th fields
  } catch { return null; }
}
let cpuSeen = childCpu();
const isBrowser = (cmd) => cmd.some((a) => /^tests\/browser(?:-[\w-]+)?\.js$/.test(a));
function run(cmd, { cwd, timeoutMs = 120000, graceMs = 500, env } = {}) {
  return new Promise((resolve) => {
    const started = Date.now(), grouped = process.platform !== 'win32';
    const child = spawn(cmd[0] === 'node' ? process.execPath : cmd[0], cmd.slice(1), { cwd, detached: grouped, env: env || process.env });
    let output = '', error, timedOut = false, closed = false, code, signal, force;
    const kill = (sig) => {
      try { if (grouped && child.pid) process.kill(-child.pid, sig); else child.kill(sig); }
      catch (e) { if (e.code !== 'ESRCH') error ||= e; }
    };
    let cpu = null;
    const finish = () => { active.delete(stop); resolve({ cmd, code, signal, output, error, timedOut,
      ok: code === 0 && !signal && !error && !timedOut, ms: Date.now() - started, cpu }); };
    child.stdout.on('data', (d) => { output += d; });
    child.stderr.on('data', (d) => { output += d; });
    child.on('error', (e) => { error = e; });
    child.on('exit', () => { const now = childCpu(); if (now !== null && cpuSeen !== null) { cpu = now - cpuSeen; cpuSeen = now; } });
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
