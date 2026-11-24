# Changes that may move token use

Each row is a change to how agents work: their instructions (`AGENTS.md`, `.claude/agents/`, `docs/agents/`), the tools they run, the
models they run on, or the ceiling on their calls. Each row starts a period, and `node tools/agent-usage.js --history docs/agents/usage
--periods docs/agents/changes.md` compares the periods stratum by stratum (`tools/usage-page.js` marks them on its charts). A change of
that kind adds its row here in the same commit (VB-1615). The time is the commit's, in UTC. A change to what is measured, rather than to
how agents work, is a row too, so that a jump in a measure is not read as an effect.

The rows before 24 November were written from `git log` and `docs/review-agent-workflow.md` (sections 3 to 9).

| When (UTC) | Change | Files | Expected to move | Ref |
|------------|--------|-------|------------------|-----|
| 2026-11-07T19:11Z | `tools/backlog.js`: the backlog read and changed without reading its tables | `tools/backlog.js`, `AGENTS.md` | boot | af1982b1; review-agent-workflow 3 |
| 2026-11-09T21:59Z | One task a sub-agent: the nightly worker orchestrates `vb-task` sub-agents, Sonnet for size S and Opus for M and L (models) | `docs/agents/worker.md`, `.claude/agents/vb-task.md` | calls a run, orchestrator share, weighted a task | 73ea6ca6; review-agent-workflow 7 |
| 2026-11-15T09:03Z | Sub-agents side by side with the inbox; `tools/brief.js`; `vb-task` names its tools; `AGENTS.md` Commands cut; sub-agents measured from their own transcripts (measure) | `tools/inbox.js`, `tools/brief.js`, `.claude/agents/vb-task.md`, `AGENTS.md`, `tools/agent-usage.js` | first context, boot; sub-agents measured from here on | bc4459d1; review-agent-workflow 8, 9 |
| 2026-11-16T14:41Z | A plan task runs on the strongest model offered, whatever its size (models) | `docs/agents/worker.md` | weighted a plan task | ef906773 |
| 2026-11-18T19:41Z | The ceiling: 120 model calls a sub-agent, then a handover to a fresh one, at most twice a task | `tools/inbox.js`, `.claude/agents/vb-task.md`, `docs/agents/worker.md` | calls a run, runs a task, weighted of long tasks | aceb81a3 |
| 2026-11-20T23:28Z | Agent guidance consolidated: `AGENTS.md` cut by about 150 lines; the GitHub Actions worker removed | `AGENTS.md`, `docs/agents/`, `tools/brief.js` | first context | bf435eae |
| 2026-11-23T20:03Z | A session on one task measures itself with `--task` at closeout (measure) | `AGENTS.md` | sessions measured | e0d4ed6f |
| 2026-11-23T20:12Z | `AGENTS.md`, Spending turns: reads sent together, sections read whole, a file's edits in one call | `AGENTS.md` | calls a run, cache reads | e0841e8a |
| 2026-11-24T20:41Z | `inbox.js calls` prints the context and weighted cost beside the count, and works in a session of its own (no ceiling there); runs record repeats, tests, continuations and the context's curve (measure) | `tools/inbox.js`, `tools/agent-usage.js`, `tools/lib/transcript.js` | calls a run (what an agent sees of its own cost) | VB-1615 |
| 2026-11-24T20:59Z | Adaptive context reset: past 160k tokens a run hands over at a boundary or when stuck, once a task, besides the ceiling; handovers kept in the inbox (`docs/agents/handover.md`); a session of its own hands the rest to a fresh `vb-task` sub-agent | `.claude/agents/vb-task.md`, `AGENTS.md`, `docs/agents/worker.md`, `docs/agents/handover.md`, `tools/inbox.js`, `tools/lib/ceiling.js` | weighted a task that passes 160k; calls a run; runs a task; quality (done, reopened); the orchestrator's calls a continuation | VB-1616 |
