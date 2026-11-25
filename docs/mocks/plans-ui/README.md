# Plans UI mocks: the brief

Throwaway mocks of a presentation layer for the hierarchical plans of `docs/plans/four-scales/README.md` (branch
`claude/dreamy-allen-vhu47g`; its section 3 is the design, 3.7 its own idea of the page). Quick and many before good and few.
No game code is touched. The drafts page is `index.html`.

## Files
- `icons.js`: the game's own icons (80 line, 74 stencil), generated from `src/page/{kindicons,goodicons}.js`: `ICONS.line[name]`,
  `ICONS.stencil[name]`, 24x24 SVG bodies. Names: me home village queue walk idle round offer cause gift chop hoe target fence sow
  mow hay sack build fish water pot pail back next no emptyfarm ruin green road rake quern fork spade weed plus minus ale grain seed
  wheat oats rye peas fallow flour meals sheaves wood tree stone clay ore peat wool tar cart boat meat butter milk field meadow beast
  health hunger standing people cold soil heir courting holder mood married child grieving friend tile plan. A mock may draw a new
  glyph it needs; mark it new.
- `scene.js`: the shared fake world and helpers. Read it whole before starting. `NOW`, `PEOPLE` (Backa: Per the played head,
  Karin, Erik the diligent heir, Nils the idle second son, Anna 12), `TODAY` (each member's list, with whose hours, breaches,
  states, authors), `TASK_FIREWOOD` (a task cut last night, taken up from a stray pile), `DUTIES`, `AHEAD` (days 5 to 10: dated
  steps, outer levies named and to name, work done together, a leave), `LEVIES` (terms), `SEASON` (targets with hours left as
  lo/mid/hi, the labour budget, windows), `YEAR` (routines, a project, aims). The map: `tiles()`, `hexXY`, `at(placeKey)`,
  `mapSVG()`, `pawnSVG()`, `MAP_W`, `MAP_H`, `DEFS` (hatch patterns). The grammar: `icon(glyph, {frame, whose, breach, badge, num,
  size, set})`, `WHOSE`, `grammarLegend()`.

## The rules every mock keeps (Kim, and design.md)
- **Icons first.** A mark is an icon with at most one number; words are a tap or two away. Every icon is clickable: a tap opens an
  info bubble (what, why, who chose it, the estimate as a range), a second tap or a button in the bubble opens its menu of acts
  (verbs: `plan`, `assign`, `call`, `grant`, `release`, `name`, `substitute`, `commute`, `breach`, `ask`, `answer`, keep my order...).
  In a mock an act need only show what it would do (a toast "would issue `assign` Nils -> Reap the barley", and the icon moving).
- **Map first, panels second.** Plans live in the landscape where they can; something floats above the land only as a last resort.
  One mark per tile at rest; detail appears on the act in hand.
- **The future is someone's estimate.** Ahead is Per's estimate, a range (a striped end); the past is exact.
- **Like is shown alike.** One presentation of a kind of thing at every scale; the same meter everywhere.
- **Reasons shown.** Who chose a step (the rule or the player) and why is one tap away.
- **Problems where they are**, each with its remedies and their cost (the ladder: another adult, another day, ask release, 3 rations,
  breach and what this levier does).
- The player sees what Per knows: his household in full, other households only as he knows them.
- Desktop first (about 1280x800); phone later.

## The approach's stress cases (show how each mock handles them, or says honestly that it strains)
1. A task cut and taken up: Nils' firewood (the stray timber pile at Hagen wood; the method's steps read from the world).
2. A household of five at harvest: the levy line, Erik giving hours, Nils taking hours at 14:00 and Per demanding at 16:30.
3. A village levy with lots and days named three days ahead: one fence day named (Erik, day 6), one still to name; the ladder.
4. A long goal: the season targets against the labour budget (barley short), Nils' aim, the south field next spring.
5. An authored step at risk: "Reap the barley" written by Per, at risk (8 hours short by day 9): the rule may take it back unless kept.

## Each mock page
- One self-contained HTML file in this folder: `<!doctype html>`, charset, viewport, its own `<title>`, its own styles; loads
  `icons.js` and `scene.js` by relative path; no other network but Google Fonts. Single light theme is fine.
- At the top a thin band: the mock's name, the mode it is (Work, Calendar, Look, Muster, Ledger...), and a toggle or two for its
  variants. A small corner note, collapsed by default, "Scales to / strains at": an honest line or three.
- Quick: a few hundred lines, not polished; one screenshot to check it, then stop.

## Round 2 (25 November)

The owner's answers to round 1 and its review (`review-round1.md`):
- **Threads are a component for the why**, not a mode: any mock may open the thread (or the compact why-ladder card) from a tapped
  thing. In the household view, an arrow in each member's colour can show the coordination in its ideal form.
- **The grammar v2 is in `scene.js`** (read its header): three frames (`now`, `plan`, `target`); whose hours by fill *and* rim
  (pennants for outer leviers); a breach as a torn corner; the author top left (`player`, `kept`), the state top right; one number
  with its unit in the pill's shape (`day`, `hours`, `count`). Use `icon(glyph, {frame, whose, breach, author, state, num, unit})`.
- Take what the review kept: one sign at the place of work with the workers' dots; the cut-and-resumed route as numbered steps; the
  time bands (binding, the head's estimate, beyond the horizon) with solid turning striped at the estimate's end; **every remedy with
  its cost, and the default the rule will take** ("the rule will: add Nils"); the displaced edge with its cost; the why-ladder card.
- Avoid what it dropped: the hearth ring, wood skeuomorphs, a column of placeless reasons.
- One mark per tile is a rule of aggregation: the most urgent thing with a count pip; its callout lists the rest.
- The day belongs to the pawn; a farmstead shows an aggregate.
- Inspiration from mapmaking (flow maps, transit diagrams, small multiples, forecast cones, choropleths, insets) and from business
  coordination tools (Gantt and resource histograms, rosters, Kanban, RACI, envelope budgets, flight progress strips, an inbox
  ordered by deadline). Name the tool or map a mock borrows from, in its band.
- **Test at scale**: each mock has a "stress" toggle where it makes sense: a household of 10, three interrupted tasks at once, six
  open decisions, or the 20 households of `VILLAGE` (in `scene.js`).

## Round 3 (25 November): three more directions at the household and village scale

The owner: explore three more directions at this scale, then five at the pawn scale, then a synthesis of the whole hierarchy.
`review-round2.md` holds what round 2 carried and dropped, and eight decisions put to the owner; until answered they are
**provisional defaults** a mock may break where its direction tests something else: the unit follows the zoom (hours today, days
ahead, hours left against days in a window at the season); whose hours owns hue (members a dot, an initial, row order, a hue only when
focused); the strip owns time, the land previews; ahead holds only duties, dates and dated steps ("as the day brings"); the tray holds
the played pawn's decision points; a countdown only in the tray. Also from the review: red means at risk only (use another mark for
the now-line, a decision, a displacement); hatching means an estimate's range only; a cut-and-resumed task needs a state of its own.
The three directions: worker placement on the land (`placement.html`), the season as a route map (`routes.html`), and zoom that
changes what is drawn (`zoom.html`).
