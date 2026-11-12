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

### VB-184: debt and land, slice 5 (raised 11 November 2026)
One question of slice 5's plan (`backlog/VB-184.md`) is left; the others stand as answered (`QUESTION_ARCHIVE.md`, 12 November).
Kim asked to iterate on this one before deciding (target-v2, decision 3). It holds VB-043 and the scope views after it (VB-044,
VB-092, VB-095).
7. Bodies: one membership graph, or a domain per kind ("Target architecture v2: decisions waiting", question 1). Measured on 11 November, as that question proposed (populous medium, seed 7, year 12: 1,031 living, 1,288 ever born, 211 live households): today's memberships as a graph of typed edges (residence, service, holding, a household's village, unions, and the dead's ended residences outside the live index) have 2,009 edges; the graph builds in 0.55 ms, the household cache derived from it in 0.33 ms and equal to today's for every household, and 1,000 moves (an edge ended, one made, the cache kept) take 0.86 ms; VB-043's bound is 50 ms. The cost that remains is history: about 2 ended edges a pawn ever born in the save, to be folded into the record like other history (rule 9). **P:** adopt the graph as Membership's truth, with the household cache Membership's own (VB-043 as rewritten). Only VB-043 and the scope views after it (VB-044, VB-092, VB-095) wait for this; the debt chain names households and villages as today.

### VB-283: a household nobody can come to (raised 10 November 2026)
VB-283 replayed the ten full runs of the bands (`docs/bench/lone-households.js`; tables in `backlog/VB-283.md`). At `38b920d`, after VB-282 (a hungry household may eat its seed), 56 of the 225 household-years hungry over 0.3 after year 3 are of households with at most one grown member (34 households; 35 rows hold one field). The orchestrator decided, for you to overturn, that such a household is taken in when its seasonal ask for help falls short: a free relative moves in, else a servant (VB-308, ready; `design.md`, Households short of people, Taken in before it starves). That reaches 14 or 15 of the 56. In 42, nobody could come; 33 of those had a parent's, child's or sibling's household within reach. What becomes of them moves a Decided point, so it waits for you (VB-309, blocked).
1. Who holds the farm when its people go to kin? **P:** the kin household holds it in trust: it works the fields and takes the harvest, the owner and the holder stay the same, the house stands empty and decays; the trust ends when the holder marries or takes a servant at a moving round (they move back), when a ward comes of age, or at the holder's death (succession as today). The farm stays the family's, as the task asks, and the relation is the one splitting land already has (`design.md`, Handover and shares: the old household works the sibling's fields, Agreed 30 Oct), so VB-034 can reuse it. The other way: the farm is given up and stands empty, held by the village, with the family's birthright to claim it back (the machinery of a farm that dies out; nothing new, but the owner changes and the land goes out of use).
2. The orphan rule (Decided, 1 Nov: with no relative to be guardian, the children go to kin and the farm stands empty). **P:** the kin who take the children hold the farm in trust in the same way until the heir is 18, so the farm stays the family's. The other way: keep the rule as decided; VB-309 then serves lone adults only.

## Priority 3

### VB-055: the move to TypeScript (raised 12 November 2026)
The first decision is whether to make the move at all, and when; say no and the fourteen tasks (VB-373 to VB-386) are closed. The
questions below matter only on a yes, and their proposals then stand unless you change one. The survey and the fourteen tasks are in `backlog/VB-055.md` and `docs/typescript-plan.md`. Behaviour, `tests/golden.json` and `tests/counters.json` do not move in any of them.
1. The formatter. **P:** Prettier at an exact version, print width 120, single quotes; one sweep in P8 over `src/` (modules and the page script), then `tests/` and `tools/`, each in a commit of its own listed in `.git-blame-ignore-revs`, with `prettier --check` in `npm test`. Measured: `src/sim`, `src/gen` and the root modules go from 11,917 lines to 19,722; 26 functions pass 60 lines, against 11 now.
2. The bundler. **P:** esbuild, one dev dependency at an exact version, in place of `build.py` (P2); `index.html` stays one self-contained file. It also strips types for the page, so nothing else is built: Node runs the `.ts` of the modules, tests and tools as they are (Node 22.23 does, with explicit `.ts` extensions in imports and erasable syntax only).
3. The hook for timing and replacing functions (ten files, P3). **P:** the build's own instrumenting (an esbuild plugin that wraps named exports in a bundle made for the tool), because `tools/perf.js` adds nothing to `src/` and production pays nothing; the fallback is a `probe(key, name, fn)` registry in the source, an identity unless a hook is installed.
4. The width measures at the start. **P:** the baseline holds today's offenders at today's numbers (18 modules over 15 exports; 26 functions over 60 formatted lines) and only falls; the `src/sim.js` facade (106 exports, which only gathers the others) is in the baseline too, not exempt, so that no one is told it is allowed to grow. The other choice: exempt it as an aggregator.
5. When. **P:** P1 to P3 and P7 now, beside anything; P4 to P6 (every module is rewritten) in one window at a slice boundary, with no other task that edits `src/` open or merged between them, and P8 (the formatter and the rename) in a second window right after; P9 to P14 beside other work. The slice boundary: after slice 3's wrap-up (VB-108) if it comes soon, or at any night when the orchestrator holds the other tasks back (about three agent sessions for the first window, one for the second). A window costs the tasks held back about a day each.
6. The page script and the tests. **P:** the page script (`src/page/*.js`, one closure of 623 top-level names) stays a script and is formatted but not typed; the tests and tools stay `.js` and keep reaching modules through `VB` from `src/load.js`; the follow-up (the page as modules, the tests as `.ts`) is a note at the end of P14, not part of this plan.
7. `strict`. **P:** not switched on for the project; a second `tsconfig.strict.json` with a ratchet of errors by file (P12) falls to zero over P13 and P14, and only then `strict` goes into the main config. Types are written for the state first (P10) and for commands and holders (P11), which are what the code review found.
