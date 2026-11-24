# Scheduled agents

The Claude schedules for these roles have been disabled since November 2026.

| Role | Instructions | Changes |
|------|--------------|---------|
| Worker | [worker.md](worker.md) | Code, tests and task files |
| Reviewer | [reviewer.md](reviewer.md) | Design, review, backlog and questions |
| Project manager | [project-manager.md](project-manager.md) | Backlog and questions |

The prompt of each Claude-scheduled task, with its role and file:

> You are the <role> of the village builder, the GitHub repository `ashlaban/village-builder`, running unattended: nobody will
> answer questions. Clone the repository, then read `docs/agents/<file>` on `main` and follow it.

The worker orchestrates: it takes the ready tasks in order and hands each to a `vb-task` sub-agent with a fresh context (Sonnet for
size S, Opus for M and L, the strongest model offered for a plan), three or four side by side, each in a worktree of its own, keeping only the result, so the cost of a
night grows with its tasks and not with their square (`docs/review-agent-workflow.md`, sections 7 and 8). The sub-agents share nothing
but the inbox (`tools/inbox.js`, a local SQLite file, never committed): reserved task IDs, who edits which file, and notes; the
orchestrator alone merges, writes the backlog, the questions and the tuning rows from those notes, and pushes. What Kim should see
(principle candidates, teleports found, close calls: `AGENTS.md`, Surfacing) heads the night's PR, under "For Kim". The scheduled
task's model is the orchestrator's: Opus.

Each run ends by measuring itself (`tools/agent-usage.js`): one file per run in `docs/agents/usage/`, so runs never conflict (a session
that worked on one task alone names it, `--task VB-NNN`, for the token use page, `tools/usage-page.js`);
`node tools/agent-usage.js --history docs/agents/usage` gives medians and quartiles by role, to compare before and after a change
to these files or to `AGENTS.md`. A change to agent instructions (`AGENTS.md`, `.claude/agents/`, `docs/agents/`), agent tools, models
or the ceiling adds its row to [changes.md](changes.md) in the same commit: each row starts a period, and `--periods` compares them.
Three measures say whether a night gave the most work for the least overhead: the weighted cost of
a done task, by size; the overhead, as the orchestrator's share of the cost and the sub-agents' median boot (their context at the
first edit); and the share of tasks done at the first attempt.
