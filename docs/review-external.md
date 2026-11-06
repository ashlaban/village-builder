# External review, 2 November 2026

*A second external review, of the architecture, is `docs/review-architecture.md` (3 November).*

A review of the repository by another assistant (ChatGPT), read from GitHub, not run. Kim passed it on on 2 November 2026; this file records what it said
and where each point goes, at `68cd81b` (after VB-053). The review's own text is not kept here; its points are summarised in its order, with its
priorities (P0 to P2).

Kim's decisions of 2 November: every point the backlog did not already hold becomes a task or a rule (below), and **feature work is frozen until the
foundations are in** (see the pick order in `BACKLOG.md`).

## Already done when the review was read

| Point | Where |
| --- | --- |
| Split the 2,000-line `body.html` (P0) | VB-053, done 2 November: `src/body.html` is 103 lines, the page script is 17 files in `src/page/`. VB-161 wraps their long lines. |
| Golden failures should show the field that changed (`pawns[41].household: 7 → 9`) | VB-069, done 30 October: `tests/golden.js` prints the first 10 differing lines per key as `old → new`. |
| Structural lint, invariants, browser smoke test, seeded runs | VB-011 to VB-015, VB-054 and the lint; the review counts them as strengths. |

## Already in the backlog

| Point | Tasks |
| --- | --- |
| Commands: pawns start jobs directly (`start` in `src/sim/agents.js`) (P0) | VB-076 (plan, priority 1), then its implement tasks. |
| Save and load; the state holds closures (P0) | VB-073 (state as plain data), VB-074 (save and restore), VB-077 (saves in the page), VB-078 (wrap-up). |
| One random stream for every system | VB-072 (one stream per system, saveable). |
| A typed event log, not text messages (P1) | VB-075 (the record of events), then VB-098 (notifications) and VB-099 (the chronicle). |
| Economic and demographic balance across seeds; household food, not averages (P1) | VB-048 and `tools/balance.js` (per household-year); the wrap-ups VB-035, VB-108, VB-063. |
| Growth of ties and caches (P2) | VB-127 (at most 150 ties a pawn), VB-097 (bound the route cache; HPA* only if measured), VB-088 (speed budget). |
| Multi-stage work: fetch, carry, build | VB-123 (a job as a few steps). |
| Explain why pawns act (P2, in part) | VB-082 (customs legible), VB-062 (mood and its modifiers). |

## New tasks and rules

| Point | Now |
| --- | --- |
| A village overview: food against need, people, poor households, idle hands, warnings (P2) | VB-162 (needs-review; questions in `QUESTIONS.md`). |
| Long-run acceptance tests: does a village stay viable for 50 years, across seeds? | VB-163 (needs-review; the bands are a decision). |
| Needs, intentions and actions; households that plan ahead; personality in choices (P1) | New arch `foresight`, plan task VB-164. Job matching stays the means of acting, not the place where decisions are made. |
| Keyboard and non-canvas ways to inspect the map (P2) | VB-165 (needs-review). Keys already pan, zoom and set the speed (`src/page/input.js`); selection and inspection need the pointer. |
| A budget for drawing, apart from the simulation's | VB-166 (ready, tooling): frame times in headless Chromium, in verify. |
| "Self-contained" page, but PixiJS comes from jsDelivr and the fonts from Google Fonts | `README.md` and `AGENTS.md` now say so. Inlining both stays possible if offline play is wanted, at the cost of a larger page. |
| Rules for agent contributions: name the boundaries touched, numbers before and after, prefer a general rule to the third special case, say why an existing abstraction does not fit, a refactor must make things simpler | `AGENTS.md`, "Working rules". |
| Shift from features to consolidation | The feature freeze in the pick order of `BACKLOG.md`. |

## Considered and not taken

- **"Stop adding complexity to the UI until the script is split."** Already met by VB-053.
- **Hierarchical path finding.** The review advises against building it before profiling shows a need; VB-097 already says so.
- **A rewrite.** The review advises against one too.
