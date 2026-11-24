// The limits on a run's context, in one place (tools/inbox.js, tools/lib/reset-estimate.js).
// The ceiling (Kim, 18 November): a sub-agent has 120 model calls, since every call re-reads its context; WARN calls before it, `calls`
// warns; a task is continued at the ceiling at most CONTINUATIONS times. On 15 November 10 tasks of 45 went past 120 calls and took 71%
// of the night's cost.
// The voluntary reset (VB-1616): once a run's context reaches RESET_AT tokens, it may hand over at a boundary or when stuck, from its
// VOLUNTARY_FROM-th call, VOLUNTARY times a task, besides the continuations at the ceiling. RESET_AT is the estimate's proposal
// (docs/review-agent-workflow.md, section 10). STUCK is the failure streak, or the repeated reads and commands, at which `calls` hints.
module.exports = { CEILING: 120, WARN: 15, CONTINUATIONS: 2, RESET_AT: 160e3, VOLUNTARY_FROM: 30, VOLUNTARY: 1, STUCK: 3 };
