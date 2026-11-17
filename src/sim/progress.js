// @sys sim/progress: a task's progress now in its closed form (VB-472, VB-514): the hours done at its last reckoning plus its rate since
VB['sim/progress'] = (() => {
  const { TICKS } = VB['sim/rules'];
  // The tick up to which the hands have worked: a step's work is done as the step's legs begin to be taken (sim/agents), so a hand leaving
  // at the calendar's hour (before the legs) does not work that step. Between steps (a fresh or a loaded run, st.stepAt absent or both its
  // marks at the tick) the step now has been worked.
  const workTick = (st) => (!st.stepAt || st.stepAt.moving === st.tick ? st.tick : st.tick - 1);
  // The job's hours done now, worked out from its last reckoning with no stepping; `hours` are the task's own. The one read of progress:
  // job.done is the hours at the last reckoning, written only by sim/agents.
  function doneOf(st, j, hours) {
    if (!(j.rate > 0)) return j.done;
    return Math.min(hours, j.done + (Math.max(0, workTick(st) - j.at) / TICKS) * j.rate);
  }
  return { workTick, doneOf };
})();
