# Scheduled agents

The instructions of the agents that work on this repository unattended, on a schedule. Each scheduled task's own prompt only points
here, so the instructions are versioned with the code, changed by PR, and their effect measured like any other change
(`docs/review-agent-workflow.md`, section 6). Each file is read in every run: keep it short, and leave how a thing is done to `AGENTS.md`.

| Role | File | Scheduled task | Time (Stockholm) | Changes |
|------|------|----------------|------------------|---------|
| GitHub Actions worker | [github-actions-worker.md](github-actions-worker.md) | Nightly worker (GitHub Actions) | 04:46 daily | code, tests, task files; never `design.md` |
| Worker | [worker.md](worker.md) | Village builder (worker) | 04:46 daily (disabled) | code, tests, task files; never `design.md` |
| Reviewer | `reviewer.md` | Village builder (Reviewer) | 05:49 daily | `design.md`, `REVIEW.md`, the backlog, the questions |
| Project manager | `project-manager.md` | Village builder (Project manager) | 09:23 daily | the backlog and `QUESTIONS.md` only |

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

Each run ends by measuring itself (`tools/agent-usage.js`): one file per run in `docs/agents/usage/`, so runs never conflict;
`node tools/agent-usage.js --history docs/agents/usage` gives medians and quartiles by role, to compare before and after a change
to these files or to `AGENTS.md`. Three measures say whether a night gave the most work for the least overhead: the weighted cost of
a done task, by size; the overhead, as the orchestrator's share of the cost and the sub-agents' median boot (their context at the
first edit); and the share of tasks done at the first attempt.

The original Claude-scheduled tasks have been disabled since 2 and 3 November 2026. The GitHub Actions worker takes two medium
tasks on its schedule by default. Set the repository variable `WORKER_BATCH` to `small` to schedule ten small tasks. To run the
worker manually from `main`, open **Actions → Nightly worker → Run workflow** and select `medium` or `small`.

Add the repository secrets `ANTHROPIC_API_KEY` and `WORKER_GITHUB_TOKEN`. The latter is a fine-grained token scoped to this
repository, with Contents and Pull requests read/write access. It lets GitHub trigger the PR checks and publish Pages after the
merge. The workflow requests a merge immediately after opening a complete batch's PR. Rules on `main` must allow the token's
account to merge at that point. The workflow uploads each usage report as an artifact and commits it alongside the task changes
when it opens a PR.
