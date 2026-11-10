// @sys page/speed: simulation pacing, the uncapped frame budget and opt-in background progress
  const SIM_BUDGET_MS = 12, SIM_SLICE_HOURS = 0.1;
  const uncappedButton = document.querySelector('[data-speed="Infinity"]');
  const backgroundRun = $('backgroundRun');
  let windowFocused = document.hasFocus(), backgroundTimer = null, backgroundAt = 0;
  let speedSampleAt = 0, speedSampleHours = 0;
  // A skip to the next event (VB-234, page/play): where it began (Sim.skipFrom), or null; page state, never saved.
  let skipCursor = null;
  function cancelSkip() { if (skipCursor) { skipCursor = null; $('skipBtn').setAttribute('aria-pressed', 'false'); } }
  const simulationAway = () => document.hidden || !windowFocused;
  function resetSpeedSample() {
    speedSampleAt = performance.now(); speedSampleHours = 0;
    if (uncappedButton.textContent !== 'Uncapped') uncappedButton.textContent = 'Uncapped';
  }
  // ---- whole steps, drawn between (VB-244): the page asks the simulation for whole 6-minute steps only, so a seed is the same run at any
  // frame rate as headless; it keeps here, never in st, the part of the next step its frames have asked for (stepShare, in [0, 1)) and
  // each agent's place before the last step, and page/animate draws each pawn between that place and its own by stepShare. ----
  let stepShare = 0, stepSt = null, stepTick = -1, drawBetween = false;
  let prevX = new Float64Array(0), prevY = new Float64Array(0), prevStride = new Float64Array(0), prevIn = new Uint8Array(0), prevN = 0;
  // the run changed (a new game, a load): nothing of the last run's steps is drawn
  function syncSteps() { if (stepSt !== st) { stepSt = st; stepShare = 0; prevN = 0; drawBetween = false; } }
  // copies each agent's place before a step: once a frame at most, before the frame's last step
  function notePlaces() {
    const n = st.agents.length;
    if (prevX.length < n) {
      const cap = Math.max(64, n * 2);
      prevX = new Float64Array(cap); prevY = new Float64Array(cap); prevStride = new Float64Array(cap); prevIn = new Uint8Array(cap);
    }
    for (let i = 0; i < n; i++) { const a = st.agents[i]; prevX[i] = a.x; prevY[i] = a.y; prevStride[i] = a.stride || 0; prevIn[i] = a.inside ? 1 : 0; }
    prevN = n;
  }
  // runs n whole steps, noting the places before the last, so the frame draws the last step's walk
  function runSteps(n) {
    for (let k = 0; k < n; k++) { if (k === n - 1) notePlaces(); Sim.advance(st, SIM_SLICE_HOURS); }
    if (n > 0) { drawBetween = true; stepTick = st.tick; }
  }
  // whether this frame draws between steps: the run is the one stepped here and nothing else (a load, a debug skip) moved its clock since
  const drawingBetween = () => drawBetween && stepSt === st && st.tick === stepTick;
  function advanceSimulation(dt) {
    if (!st || speed === 0 || building || skipping || !$('genScreen').hidden || !$('landing').hidden) { resetSpeedSample(); return; }
    syncSteps();
    const before = st.t;
    // a skip or the uncapped speed runs many steps a frame: the pawns are drawn where the last step left them
    if (skipCursor || speed === Infinity) { stepShare = 0; drawBetween = false; }
    if (skipCursor) {
      // as the uncapped speed, a step at a time, asking the simulation after each whether the skip has reached its stop
      const deadline = performance.now() + SIM_BUDGET_MS;
      let stop = Sim.skipStop(st, skipCursor);
      while (!stop) { Sim.advance(st, SIM_SLICE_HOURS); stop = Sim.skipStop(st, skipCursor); if (performance.now() >= deadline) break; }
      if (stop) endSkip(stop);
    } else if (speed === Infinity) {
      const deadline = performance.now() + SIM_BUDGET_MS;
      // Yield between ordinary six-minute steps; one indivisible step can exceed the budget.
      do { Sim.advance(st, SIM_SLICE_HOURS); } while (performance.now() < deadline);
      speedSampleHours += st.t - before;
      const now = performance.now(), elapsed = (now - speedSampleAt) / 1000;
      if (elapsed >= 0.5) {
        uncappedButton.textContent = `Uncapped (${Math.round(speedSampleHours * HOUR_SECONDS / elapsed)}×)`;
        speedSampleAt = now; speedSampleHours = 0;
      }
    } else {
      stepShare += (dt * speed) / HOUR_SECONDS / SIM_SLICE_HOURS;
      const n = Math.floor(stepShare);
      stepShare -= n;
      runSteps(n);
    }
  }
  function syncBackgroundRun() {
    if (backgroundTimer !== null) { clearInterval(backgroundTimer); backgroundTimer = null; }
    resetSpeedSample();
    if (!simulationAway() || !backgroundRun.checked) return;
    backgroundAt = performance.now();
    // Browsers may throttle hidden timers. Advance only a bounded interval, never a backlog on return.
    backgroundTimer = setInterval(() => {
      const now = performance.now(), dt = Math.min(0.25, (now - backgroundAt) / 1000);
      backgroundAt = now;
      advanceSimulation(dt);
      if (st) updateClock();
    }, 100);
  }
  backgroundRun.addEventListener('change', syncBackgroundRun);
  document.addEventListener('visibilitychange', syncBackgroundRun);
  window.addEventListener('focus', () => { windowFocused = true; syncBackgroundRun(); });
  window.addEventListener('blur', () => { windowFocused = false; syncBackgroundRun(); });
