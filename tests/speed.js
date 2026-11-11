// VB-084: pacing contracts with a controlled wall clock, focus and background timers.
const assert = require('assert'), fs = require('fs'), vm = require('vm'), path = require('path');
const listeners = {}, timers = new Map();
const listen = (target) => (event, fn) => { listeners[target + ':' + event] = fn; };
const button = { title: '', label: '', setAttribute(k, v) { if (k === 'aria-label') this.label = v; } };
const screen = { hidden: true };
let now = 0, calls = 0, clocks = 0, cost = 3, nextTimer = 0;
const ctx = {
  document: { hidden: false, hasFocus: () => true, querySelector: () => button, addEventListener: listen('document') },
  window: { addEventListener: listen('window') }, performance: { now: () => now },
  $: () => screen,
  st: { t: 6, agents: [] }, speed: 1, building: false, skipping: false, HOUR_SECONDS: 2, demo: false, DEMO: { speed: 3 }, reduceMotion: false,
  // whole 6-minute steps only (VB-244): the page keeps the part of a step its frames have asked for
  Sim: { advance(st, hours) { assert.strictEqual(hours, 0.1, 'the page asks for whole steps, one at a time'); calls++; st.t += hours; now += cost; } },
  setInterval: (fn) => { const id = ++nextTimer; timers.set(id, fn); return id; }, clearInterval: (id) => timers.delete(id),
  updateClock: () => clocks++,
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/page/speed.js'), 'utf8'), ctx);
const tick = () => { now += 100; for (const fn of timers.values()) fn(); };
const share = () => vm.runInContext('stepShare', ctx);
for (const speed of [1, 3, 10, 30]) {
  ctx.speed = speed; const before = ctx.st.t + share() * 0.1;
  for (let k = 0; k < 50; k++) {
    ctx.advanceSimulation(0.016);
    assert(share() >= 0 && share() < 1, 'the part of a step kept is under a step');
  }
  assert(Math.abs(ctx.st.t + share() * 0.1 - before - 50 * 0.016 * speed / 2) < 1e-9, 'fixed speed uses elapsed time, steps and the part kept');
}
ctx.speed = Infinity; ctx.resetSpeedSample(); calls = 0;
const before = now; ctx.advanceSimulation(0.016);
assert.strictEqual(calls, 4, 'yield at the 12 ms budget');
assert.strictEqual(now - before, 12);
cost = 20; calls = 0; ctx.advanceSimulation(0.016);
assert.strictEqual(calls, 1, 'a costly step must not start a second step'); cost = 3;
ctx.resetSpeedSample(); const sampleAt = now, sampleT = ctx.st.t;
for (let k = 0; k < 40; k++) { now += 5; ctx.advanceSimulation(0.016); }
assert.strictEqual(button.label, `Uncapped (${Math.round((ctx.st.t - sampleT) * 2 / ((now - sampleAt) / 1000))}×)`);
for (const flag of ['building', 'skipping']) {
  ctx[flag] = true; const t = ctx.st.t; ctx.advanceSimulation(1); assert.strictEqual(ctx.st.t, t); ctx[flag] = false;
}
screen.hidden = false; const t = ctx.st.t; ctx.advanceSimulation(1); assert.strictEqual(ctx.st.t, t); screen.hidden = true;
const state = ctx.st; ctx.st = null; ctx.advanceSimulation(1); ctx.st = state;
listeners['window:blur'](); assert(vm.runInContext('simulationAway()', ctx)); assert.strictEqual(timers.size, 0, 'background is opt in');
// the background run has no control for now (VB-338): the flag a control would set
vm.runInContext('keepRunning = true; syncBackgroundRun()', ctx); assert.strictEqual(timers.size, 1);
for (let i = 0; i < 3; i++) { listeners['window:blur'](); listeners['document:visibilitychange'](); }
assert.strictEqual(timers.size, 1, 'repeated focus/visibility notifications never stack timers');
ctx.speed = 30; const t0 = ctx.st.t + share() * 0.1; tick(); assert(Math.abs(ctx.st.t + share() * 0.1 - t0 - 1.5) < 1e-9); assert(clocks > 0);
now += 60000; const t1 = ctx.st.t + share() * 0.1; tick(); assert(Math.abs(ctx.st.t + share() * 0.1 - t1 - 3.75) < 1e-9, 'no accumulated catch-up');
ctx.speed = 0; const t2 = ctx.st.t; tick(); assert.strictEqual(ctx.st.t, t2, 'pause also stops background progress');
listeners['window:focus'](); assert(!vm.runInContext('simulationAway()', ctx)); assert.strictEqual(timers.size, 0, 'one driver at a time');
ctx.document.hidden = true; listeners['document:visibilitychange'](); assert(vm.runInContext('simulationAway()', ctx)); assert.strictEqual(timers.size, 1);
ctx.speed = Infinity; const hidden = ctx.st.t; tick(); assert(ctx.st.t > hidden, 'uncapped also runs in the background');
listeners['window:focus'](); assert.strictEqual(timers.size, 1, 'hidden document still uses the background driver');
ctx.document.hidden = false; listeners['document:visibilitychange'](); assert.strictEqual(timers.size, 0);
listeners['window:blur'](); assert.strictEqual(timers.size, 1);
vm.runInContext('keepRunning = false; syncBackgroundRun()', ctx); assert.strictEqual(timers.size, 0);
// Load the actual input script too: browser shortcuts and text editing must not select a speed.
const keyHandlers = {}, controls = { hidden: true, addEventListener() {} }, elements = new Map();
const control = (id) => {
  if (!elements.has(id)) elements.set(id, {
    hidden: true, style: {}, classList: { remove() {} }, addEventListener() {}, setAttribute() {},
  });
  return elements.get(id);
};
const input = {
  stage: { addEventListener() {} }, window: { addEventListener: (event, fn) => { keyHandlers[event] = fn; } },
  document: { querySelectorAll: () => [], addEventListener() {}, body: { classList: { toggle() {} } } },
  matchMedia: () => ({ matches: false }), $: control, speed: 0, resetSpeedSample() {}, cancelSkip() {},
};
vm.createContext(input);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/page/icons.js'), 'utf8'), input); // the speeds' icons (VB-338)
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/page/input.js'), 'utf8'), input);
const key = (key, flags = {}) => keyHandlers.keydown({ key, target: { closest: () => null }, preventDefault() {}, ...flags });
for (const modifier of ['ctrlKey', 'metaKey', 'altKey', 'defaultPrevented', 'isComposing']) {
  key('4', { [modifier]: true }); assert.strictEqual(input.speed, 0, 'modified number keys leave speed unchanged');
}
key('5', { target: { closest: () => controls } }); assert.strictEqual(input.speed, 0, 'editing a form leaves speed unchanged');
key('4'); assert.strictEqual(input.speed, 30);
key('5'); assert.strictEqual(input.speed, Infinity);
key(' '); assert.strictEqual(input.speed, 0);
key(' '); assert.strictEqual(input.speed, Infinity);
console.log('speed: fixed rates, 12 ms budget, measured speed, keyboard, pause, focus and bounded background progress');
