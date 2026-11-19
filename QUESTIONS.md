# Open questions for Kim

Only what Kim alone can answer: a question that moves a Decided point of `design.md`, or lets the player do something no existing
system covers, or that Kim has kept. Everything else an agent decides by `AGENTS.md`, Deciding without Kim, and writes in its task
file. Each question has a proposed answer (**P:**). Answer inline ("yes", "P", or your own answer); the task files are then updated
and set to `ready`, and the question moves, unchanged, to `QUESTION_ARCHIVE.md`. Agents record an answer with
`node tools/questions.js answer` and move it with `archive`; `list` and `show VB-NNN` read this file without reading it whole.

Not here: a shortfall that waits for a tuning run is in `docs/tuning.md`; a question for a later slice is in that slice's plan task
(`backlog/VB-188.md`, `backlog/VB-189.md`).

## Priority 1

## Priority 2

## Priority 3

### VB-834: Should a busy place drift faster: a term in attitude.malleability? (raised 19 November 2026)
tools/contact.js (populous small, seeds 7, 11, 13, 40 years): villages in the top fifth by distinct people met at venues drift 0.0079 a key a year against 0.0096 for the rest (correlation -0.28); gathering hosts 0.0082 against 0.0095. Contact alone gives no faster drift.
Proposed answers: (a) leave it to contact: no term; (b) add a term to attitude.malleability reading those met at venues, with a range (e.g. 1 to 1.5 times), so a busy place drifts faster by mechanism.
