// @sys page/speed: simulation pacing, the uncapped frame budget and background progress (off, with no control for now)
const SIM_BUDGET_MS = 12,
  SIM_SLICE_HOURS = 0.1;
const uncappedButton = document.querySelector('[data-speed="Infinity"]');
// Keep running in background (VB-084) is off and has no control for now (11 Nov, VB-338); a control would set keepRunning and call
// syncBackgroundRun. While it is off, the run pauses when the page is hidden or the window loses focus.
let keepRunning = false;
let windowFocused = document.hasFocus(),
  backgroundTimer = null,
  backgroundAt = 0;
let speedSampleAt = 0,
  speedSampleHours = 0;
// A skip to the next event (VB-234, page/play): where it began (Sim.skipFrom), or null; page state, never saved.
// skipLast is the cursor of the skip that last ended (VB-1108): the next one goes on from it, so that the other events of the step
// that stopped it are told in turn.
// A skip "until my task ends" (VB-477) keeps beside it taskCursor (Sim.taskFrom), whose stops (Sim.taskStop) it adds to the skip's own.
let skipCursor = null,
  skipLast = null,
  taskCursor = null;
function cancelSkip() {
  if (skipCursor) {
    skipLast = skipCursor;
    skipCursor = null;
    taskCursor = null;
    $('skipBtn').setAttribute('aria-pressed', 'false');
    $('taskBtn').setAttribute('aria-pressed', 'false');
  }
}
// Has the skip reached a stop: the skip's own, or, until the task ends, the task's.
const skipStopNow = () => Sim.skipStop(st, skipCursor) || (taskCursor ? Sim.taskStop(st, taskCursor) : null);
const simulationAway = () => document.hidden || !windowFocused;
// The uncapped speed's button is an icon (VB-338): the rate it reaches is in its name and tooltip.
function nameUncapped(name) {
  uncappedButton.setAttribute('aria-label', name);
  uncappedButton.title = `${name} (5)`;
}
function resetSpeedSample() {
  speedSampleAt = performance.now();
  speedSampleHours = 0;
  if (uncappedButton.title !== 'Uncapped (5)') nameUncapped('Uncapped');
}
// ---- whole steps, drawn between (VB-244, VB-474): the page asks the simulation for whole 6-minute steps only, so a seed is the same run at
// any frame rate as headless; it keeps here, never in st, the part of the next step its frames have asked for (stepShare, in [0, 1)), and
// page/animate draws each walker at tick + stepShare along its leg (Sim.poseOf), so nothing of the last step is kept to be drawn. ----
let stepShare = 0,
  stepSt = null;
// the run changed (a new game, a load): the part of a step kept was the last run's
function syncSteps() {
  if (stepSt !== st) {
    stepSt = st;
    stepShare = 0;
  }
}
// runs n whole steps
function runSteps(n) {
  for (let k = 0; k < n; k++) Sim.advance(st, SIM_SLICE_HOURS);
}
function advanceSimulation(dt) {
  // behind the menu a game waits, paused; the showcase island (page/loader) goes on at its own speed, unless motion is to be reduced
  if (demo) {
    if (st && !still && !building && !reduceMotion) {
      // `still`: the editor's picture of what is placed (page/editor)
      syncSteps();
      stepShare += (dt * DEMO.speed) / HOUR_SECONDS / SIM_SLICE_HOURS;
      const n = Math.floor(stepShare);
      stepShare -= n;
      runSteps(n);
    }
    return;
  }
  if (!st || speed === 0 || building || skipping || !$('genScreen').hidden || !$('landing').hidden) {
    resetSpeedSample();
    return;
  }
  syncSteps();
  const before = st.t;
  // a skip or the uncapped speed runs many steps a frame: the pawns are drawn where the last step left them
  if (skipCursor || speed === Infinity) stepShare = 0;
  if (skipCursor) {
    // as the uncapped speed, a step at a time, asking the simulation after each whether the skip has reached its stop
    const deadline = performance.now() + SIM_BUDGET_MS;
    let stop = skipStopNow();
    while (!stop) {
      Sim.advance(st, SIM_SLICE_HOURS);
      stop = skipStopNow();
      if (performance.now() >= deadline) break;
    }
    if (stop) endSkip(stop);
  } else if (speed === Infinity) {
    const deadline = performance.now() + SIM_BUDGET_MS;
    // Yield between ordinary six-minute steps; one indivisible step can exceed the budget.
    do {
      Sim.advance(st, SIM_SLICE_HOURS);
    } while (performance.now() < deadline);
    speedSampleHours += st.t - before;
    const now = performance.now(),
      elapsed = (now - speedSampleAt) / 1000;
    if (elapsed >= 0.5) {
      nameUncapped(`Uncapped (${Math.round((speedSampleHours * HOUR_SECONDS) / elapsed)}×)`);
      speedSampleAt = now;
      speedSampleHours = 0;
    }
  } else {
    stepShare += (dt * speed) / HOUR_SECONDS / SIM_SLICE_HOURS;
    const n = Math.floor(stepShare);
    stepShare -= n;
    runSteps(n);
  }
  autosaveRound(before);
}
function syncBackgroundRun() {
  if (backgroundTimer !== null) {
    clearInterval(backgroundTimer);
    backgroundTimer = null;
  }
  resetSpeedSample();
  if (!simulationAway() || !keepRunning) return;
  backgroundAt = performance.now();
  // Browsers may throttle hidden timers. Advance only a bounded interval, never a backlog on return.
  backgroundTimer = setInterval(() => {
    const now = performance.now(),
      dt = Math.min(0.25, (now - backgroundAt) / 1000);
    backgroundAt = now;
    advanceSimulation(dt);
    if (st) updateClock();
  }, 100);
}
document.addEventListener('visibilitychange', syncBackgroundRun);
window.addEventListener('focus', () => {
  windowFocused = true;
  syncBackgroundRun();
});
window.addEventListener('blur', () => {
  windowFocused = false;
  syncBackgroundRun();
});
