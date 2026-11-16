# Open questions for Kim

Only what Kim alone can answer: a question that moves a Decided point of `design.md`, or lets the player do something no existing
system covers, or that Kim has kept. Everything else an agent decides by `AGENTS.md`, Deciding without Kim, and writes in its task
file. Each question has a proposed answer (**P:**). Answer inline ("yes", "P", or your own answer); the task files are then updated
and set to `ready`, and the question moves, unchanged, to `QUESTION_ARCHIVE.md`. Agents record an answer with
`node tools/questions.js answer` and move it with `archive`; `list` and `show VB-NNN` read this file without reading it whole.

Not here: a shortfall that waits for a tuning run is in `docs/tuning.md`; a question for a later slice is in that slice's plan task
(`backlog/VB-188.md`, `backlog/VB-189.md`).

## Priority 1

### VB-907: marriage to kin by marriage (raised 16 November 2026)
From the playtest of 16 November (founders small seed 7, 80 years in the page): the round offered a widow of 52 her late husband's son of
23, raised in her house. `kinOk` (`src/sim/matching.js`) judges kin by blood alone, and The gate (Decided, 13 Nov: "keep the gate, add
nothing") allows no other bar; so a step-parent and stepchild, or a parent-in-law and child-in-law, may be matched. Every culture the
setting draws on forbade at least the direct line: Leviticus 18, the Church's prohibited degrees of affinity (to the fourth from 1215),
and the Swedish provincial laws after them.
1. May kin by marriage bar a match, as a reading of the gate's "kin no closer than the custom's limit" and not as a fifth condition?
   **P:** yes, as a custom of its own (principle 5), "Kin by marriage who may marry": none within the Church's fourth degree, none in the
   direct line, or no bar; the Nordic default "none in the direct line". Step-siblings marry under every option. `backlog/VB-907.md`
   holds the criteria; marriages and growth reported before and after.

## Priority 2

## Priority 3
