# A handover

Read this only when you hand a task over (VB-1616): at the ceiling (`reason=ceiling`), or by choice once your context is past the
threshold (`reason=boundary`, `reason=stuck`; `node tools/inbox.js calls` says when). The next context starts from what you write and
from the code: write what it cannot find quickly, and nothing it can.

## When

- **boundary**: the investigation is done and nothing under `src/` is edited yet, or a coherent part is built and committed with
  `npm test` green. Not in the middle of a change.
- **stuck**: the same test has failed three times running, or you are reading again what you read before, and your next idea is not
  better than the last. A fresh context with the rejected hypotheses listed may see past them; a second `stuck` ends the task `needs-review`.
- Never below the threshold, before the run's 30th call, or with nothing committed since the run started (`inbox.js result` refuses);
  at most one voluntary reset a task. A task that fits in one context is not split.

## How

1. Commit what you have (`VB-NNN: <title> (work in progress)`), `npm test` passing or the failing script named in the handover.
2. Tick the criteria met in the task file.
3. `node tools/inbox.js note VB-NNN handover --body -` with the text below (at most 60 lines, 4 KB; the inbox refuses more). A session
   with no inbox runs `node tools/inbox.js init` first (never `--fresh`).
4. `node tools/inbox.js result VB-NNN status=continue reason=ceiling|boundary|stuck commit=SHA summary=...`.
5. A sub-agent ends with `VB-NNN <title>: continue <commit> on <branch>`; its orchestrator starts the next.
6. A session of its own hands over to a fresh `vb-task` sub-agent itself, and explores no further:
   - `node tools/inbox.js start VB-NNN` reserves the IDs for the tasks the sub-agent may note;
   - the sub-agent (the Agent tool, `vb-task`, in a worktree of its own, on the model the session runs on) gets the prompt "Task VB-NNN,
     continued from `<branch>` at <commit>; the run's branch is `<branch>`; your reserved task IDs are <IDs>; the handover: `node
     tools/inbox.js handover VB-NNN`";
   - when it ends, the session merges its branch (`git merge --no-ff`), runs `npm test`, `node tools/inbox.js apply`, and closes the
     task as `AGENTS.md`, Taking a task, says, measuring itself with `--task VB-NNN` (its sub-agent is measured with it).

## The text

Each line short and checkable. A fact without its evidence goes under Unverified. No transcript, no file contents beyond a quoted line.

```
Verified:     facts, each with the command or file:line that shows it
Unverified:   hypotheses and conclusions not yet checked
Rejected:     each hypothesis ruled out, and what ruled it out
Decisions:    each decision, and its reason
Invariants:   the rules the rest of the work must keep
Criteria left: the unticked criteria, and what each still needs
Commands:     to reproduce the problem, and to test the work
Places:       file, function and line where the work goes on
Not carried:  assumptions that turned out wrong or stale; the next context should not make them
```

The continuing context trusts Verified, checks Unverified before building on it, and does not read again what Places and Verified already say.
