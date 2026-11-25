# Aims and personal goods: tasks set aside

Kim, 25 November 2026: the tasks written for long-term aims and personal goods were taken out of the backlog and kept here for future
reference. The design they build stands: `docs/plans/four-scales/aims.md` (with its review's outcomes) and `design.md` section 7,
Aims and personal goods; nothing builds it now. `docs/plans/four-scales/README.md`, section 6, answers 21 and 22, records the decision.

What is here, as it stood when it was set aside (merged in PR 326):

- the eighteen task files, unchanged, each with its `Status:` and `Waits for:` as they were in the arch `plans`;
- `questions.md`: the questions for Kim that belonged to them, unanswered (moved from `QUESTIONS.md`);
- `tuning.md`: their tuning entries (moved from `docs/tuning.md`).

Their IDs stay theirs: `tools/lib/ids.js` counts `docs/ideas/**/VB-N.md`, so no new task takes VB-1781 to VB-1798 (`tests/ids.js`).

| ID | Task | Size | Status then | Waited for |
| --- | --- | --- | --- | --- |
| [VB-1781](VB-1781.md) | Refactor: sim/aims renamed sim/projectmenu, freeing the name for aims | S | ready | - |
| [VB-1782](VB-1782.md) | A pawn's store replaces the stake: personal goods, the holder pair's poured in, a member eats of its own | M | blocked | VB-1774 |
| [VB-1783](VB-1783.md) | A task a pawn owns, its material by its household's right, and the custom of a member's making | M | blocked | VB-1782, VB-1762, VB-366 |
| [VB-1784](VB-1784.md) | The aim record, its registry and the verb aim | M | blocked | VB-1781, VB-1754 |
| [VB-1785](VB-1785.md) | A household's aim home: a house for a member planned ahead of its marriage, and the wish while it is built | M | blocked | VB-1793 |
| [VB-1786](VB-1786.md) | A pawn's aim craft: the farmer's second son works towards being a potter in his own hours | M | blocked | VB-1783, VB-1793, VB-1787, VB-1795, VB-1796 |
| [VB-1787](VB-1787.md) | A pawn's goods at the fair: its lot, its accept rule, and its income from others | M | blocked | VB-1782 |
| [VB-1788](VB-1788.md) | A household's aim portion: goods set aside for a member who will leave | S | blocked | VB-1793, VB-1792 |
| [VB-1789](VB-1789.md) | A maker's wish, and the craft aim's end when the maker founds its household | S | blocked | VB-1785, VB-1786, VB-1787 |
| [VB-1790](VB-1790.md) | The page: aims at the year zoom, on the pawn's card and in the head's view, and the pawn's store | M | blocked | VB-1793, VB-1782, VB-1787, VB-1765 |
| [VB-1791](VB-1791.md) | A pawn's store moves with its keeper, and passes at death by custom | M | blocked | VB-1782, VB-1749 |
| [VB-1792](VB-1792.md) | Goods given between a pawn and a household, and a head's take of a member's goods as a breach | S | blocked | VB-1782, VB-1779 |
| [VB-1793](VB-1793.md) | The aims' review: their own due day, the estimate, at risk, waiting, and the decision points | M | blocked | VB-1784, VB-1755, VB-1757, VB-1778 |
| [VB-1794](VB-1794.md) | Hours bought with goods, and a head backing a member's craft | M | blocked | VB-1763, VB-1782, VB-1786 |
| [VB-1795](VB-1795.md) | Measure: households with no clay in their digging ground, by village and gathering district | S | ready | - |
| [VB-1796](VB-1796.md) | A household's need of pots at the fair, and make or buy by the head's estimate | M | blocked | VB-366, VB-1774 |
| [VB-1797](VB-1797.md) | A maker's household carries the craft's target for exchange | S | blocked | VB-1789, VB-1796 |
| [VB-1798](VB-1798.md) | A craft aim at the loom: cloth made in own hours, a daughter's chest | M | blocked | VB-1786, VB-1787 |

## To bring them back

1. `git mv docs/ideas/aims/VB-*.md backlog/`, then `node tools/backlog.js sync`; check each `Waits for:` line against the backlog of
   the day (tasks it names may be done, renamed or gone) and that `node tests/backlog.js` passes.
2. Make the wrap-up of their arch wait for them again (VB-1773, or its successor) and restore its criterion on aims and personal goods
   (in its history: `git show 5eb30a32:backlog/VB-1773.md`).
3. Move `questions.md`'s block back into `QUESTIONS.md` and the rows of `tuning.md` back into `docs/tuning.md`.
4. VB-366 (pots) was raised to priority 2 because five of these waited for it; it went back to 3 when they were set aside.
