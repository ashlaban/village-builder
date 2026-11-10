// @sys page/speed: simulation pacing, the uncapped frame budget and opt-in background progress
  const SIM_BUDGET_MS = 12, SIM_SLICE_HOURS = 0.1;
  const uncappedButton = document.querySelector('[data-speed="Infinity"]');
  const backgroundRun = $('backgroundRun');
  let windowFocused = document.hasFocus(), backgroundTimer = null, backgroundAt = 0;
  let speedSampleAt = 0, speedSampleHours = 0;
  // A skip to the next event (VB-234, page/play): where it began (Sim.skipFrom), or null; page state, never saved.
  let skipCursor = null;
  const simulationAway = () => document.hidden || !windowFocused;
  function resetSpeedSample() {
    speedSampleAt = performance.now(); speedSampleHours = 0;
    if (uncappedButton.textContent !== 'Uncapped') uncappedButton.textContent = 'Uncapped';
  }
  function advanceSimulation(dt) {
    if (!st || speed === 0 || building || skipping || !$('genScreen').hidden) { resetSpeedSample(); return; }
    const before = st.t;
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
    } else Sim.advance(st, (dt * speed) / HOUR_SECONDS);
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
