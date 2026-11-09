# Scheduled agents

The instructions of the agents that work on this repository unattended, on a schedule. Each scheduled task's own prompt only points
here, so the instructions are versioned with the code, changed by PR, and their effect measured like any other change
(`docs/review-agent-workflow.md`, section 6). Each file is read in every run: keep it short, and leave how a thing is done to `AGENTS.md`.

| Role | File | Scheduled task | Time (Stockholm) | Changes |
|------|------|----------------|------------------|---------|
| Worker | `worker.md`, and `.claude/agents/vb-task.md` for each task | Village builder (worker) | 04:46 daily | code, tests, task files; never `design.md` |
| Reviewer | `reviewer.md` | Village builder (Reviewer) | 05:49 daily | `design.md`, `REVIEW.md`, the backlog, the questions |
| Project manager | `project-manager.md` | Village builder (Project manager) | 09:23 daily | the backlog and `QUESTIONS.md` only |

The prompt of each scheduled task, with its role and file:

> You are the <role> of the village builder, the GitHub repository `ashlaban/village-builder`, running unattended: nobody will
> answer questions. Clone the repository, then read `docs/agents/<file>` on `main` and follow it.

The worker orchestrates: it takes the ready tasks in order and hands each to a `vb-task` subagent with a fresh context (Sonnet for
size S, Opus for M and L), keeping only the result, so the cost of a night grows with its tasks and not with their square
(`docs/review-agent-workflow.md`, section 7). The scheduled task's model is the orchestrator's: Opus.

Each run ends by measuring itself (`tools/agent-usage.js`): one file per run in `docs/agents/usage/`, so runs never conflict;
`node tools/agent-usage.js --history docs/agents/usage` gives medians and quartiles by role, to compare before and after a change
to these files or to `AGENTS.md`.

The three scheduled tasks have been disabled since 2 and 3 November 2026, and until they are pointed here they carry their old prompts,
written for the backlog before 3 November (tasks as blocks inside `BACKLOG.md`).
