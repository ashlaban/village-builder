# TypeScript: the tasks (VB-055's plan)

> Testing policy updated by VB-408 (12 November 2026): [Testing](testing.md) supersedes the golden-file,
> suite membership and CI requirements below. There are no permanent behavior baselines to update.
> Refactors preserve behavior through focused contracts and optional comparisons to their starting commit.
> Late fixtures and long measurements run in the extended/nightly tier, not routine PR verification.


Written 12 November 2026 by VB-055 (survey in `backlog/VB-055.md`; questions in `QUESTIONS.md`, "VB-055: the move to TypeScript"). Each section below is
one task, as a complete task file's text, in the order they would run. The orchestrator creates them in the backlog (`node tools/backlog.js new`);
`P1` to `P14` are names in this document; in the backlog they are VB-373 to VB-386, in that order (created 12 November). Arch `yardstick` throughout (outside the slices, as VB-228 to VB-232 are),
phase `implement`, design ref "none (code structure); `docs/architecture/target-v2.md`, section 2". Every task is behaviour-preserving: `tests/golden.json`
and `tests/counters.json` do not change, and a PR that must change them is wrong.

Three things hold for all of them, and the tasks do not repeat them:
- A fixture's key hashes the modules of `src/manifest.json` (`tests/lib/fixtures.js`), so any task that rewrites `src/` makes the local fixtures
  stale: the first `npm run verify` after it makes them again (about 2 minutes for the small pair, 1.5 for the medium).
- `npm test` and `node tests/golden.js` before the last commit; `npm run verify` once, for every task that touches more than 10 files of `src/`
  (P4 to P6, P8, P10, P13, P14) or `src/page/`.
- Each task writes the one line it owes to `AGENTS.md`, `docs/architecture/modules.md` and `docs/architecture/target-v2.md` (named in the task);
  the last task, P14, checks that none is missing.

When, in short. Step 1 (P1 to P7) rewrites the way every module is joined and so touches every file of `src/`. P1 to P3 and P7 touch tools, tests and
the build only and may run beside any open task. P4 to P6 and P8 rewrite every module and must not run beside any task that edits `src/`
(every open task that is not a plan or a survey; on 12 November that is nearly all of the 119 open ones). The window is at a slice boundary
(question 5): P4, P5 and P6 in one window, one after the other, P8 in a second, with nothing else merged in between. P9 to P14 are small edits spread over
many files and may run beside other work, merging one at a time (rebasing is a matter of a few lines a file).

---

## P1: Tools read source through one function

Priority: 3
Size: S
Arch: yardstick
Phase: implement
Design ref: none (tooling). `docs/typescript-plan.md`.
Goal: Eight tools and tests parse or scan the source of `src/` as JavaScript text: `tools/writes.js` (acorn; also used by `tests/dependencies.js`, `tools/stocks.js`,
`tools/write-scopes.js`), `tests/lint.js` and `tests/lintrules.js` (by line), `tests/ownershiprules.js`, `tests/record.js`, `tests/commands.js`,
`tests/registry.js` and `tools/wrap.js`. After the move to `.ts` they would meet type annotations, which acorn rejects. Give them one function,
`readSource(file)` in `tools/lib/source.js`, that returns the text as JavaScript: the file as it is for `.js`, and for `.ts` the text with its types
blanked by `node:module`'s `stripTypeScriptTypes` (experimental in Node 22.23; it keeps every line and column, which was checked in a scratch directory on 12 November). No behaviour change today, since no file is `.ts` yet.
Acceptance criteria:
- [ ] `tools/lib/source.js` exports `readSource(file)`; a test (`tests/source.js`, in `npm test`) feeds it a `.ts` text with annotations, generics, `type` imports and an `as` cast, parses the result with acorn, and checks that the positions of the tokens are those of the original.
- [ ] The eight files above read `src/` only through it (a grep in the test fails for a direct `readFileSync` of a `src/` file in them).
- [ ] If `stripTypeScriptTypes` is gone or warns on the Node of the Checks workflow, the task says so and uses `typescript`'s `transpileModule` (dev dependency, pinned) behind the same function; the choice and the Node versions tried are in the task file.
- [ ] `AGENTS.md`, "Finding things": one line saying source is read through `readSource`.
Waits for: nothing.
May run beside: any task. It touches `tools/`, `tests/` and `AGENTS.md` only.

## P2: A bundler in place of build.py

Priority: 3
Size: S
Arch: yardstick
Phase: implement
Design ref: none (build). `docs/typescript-plan.md`.
Goal: `build.py` inlines every file of `src/manifest.json` as its own `<script>` and splices `src/page/*.js` into a closure in `body.html`. Replace it
with `build.js` (Node, so one language): one dev dependency, esbuild at an exact version, bundling an entry `src/main.js` that imports the manifest's modules in the manifest's order,
for their effects (the `VB` namespace is still how they meet), into one IIFE inlined in `index.html`, with the page script spliced as now. `index.html` stays one
self-contained file (PixiJS and the fonts still come from the network), `--check` is kept, and the build id (a hash of the page's sources) is kept.
Acceptance criteria:
- [ ] `node build.js` writes `index.html`; `node build.js --check` fails if it is stale; `build.py` is deleted; `package.json` has the dependency at an exact version and a `build` script; `tests/run.js`, `.github/workflows/checks.yml`, `AGENTS.md` and `BACKLOG.md` name the new command.
- [ ] The built page behaves as before: `tests/smoke.js`, `tests/browser.js` and the other page scripts of `npm run verify` pass, and `tests/golden.js` is unchanged. Not required: a byte-identical `index.html` (the wrapper changes).
- [ ] A build is deterministic: two builds in two directories give the same bytes, and the build id is a function of the sources alone (as VB-214 has it).
- [ ] The size of `index.html` and the build time before and after are in the task file (before: 1,226,620 bytes, `python3 build.py --check` 0.06 s on 12 November). Source maps are not shipped.
- [ ] The task file says whether esbuild's output keeps the `// @sys` comment lines the module map greps (`grep -rn "^// @sys" src` reads `src/`, not the page, so it should not matter).
Waits for: nothing.
May run beside: any task; it touches the build, `package.json`, the workflow and `index.html`, which every task regenerates, so a rebase takes the generated file.

## P3: One loader with a hook for timed and replaced functions

Priority: 3
Size: M
Arch: yardstick
Phase: implement
Design ref: none (tooling). `docs/typescript-plan.md`.
Goal: An ES module's exports cannot be reassigned, and ten files do that today to count or time a function: `tools/perf.js` (about 25 functions of 12 modules), `tools/moving-profile.js`,
`tools/route-bench.js`, `tools/wood.js`, `tests/spread.js`, `tests/plans.js` (`R.value`), `tests/lib/owner-caches.js` (`heirs.refreshRoles`) and `tests/lib/record.js`, `tests/lib/line.js`
and `tests/bench.js` (which patch data tables or a fixture loader, and may need nothing). Seven of them also read `src/manifest.json` and `require` each module in turn to wrap
one right after it registers, so that the modules loaded later destructure the wrapper. Choose, build and use one hook for all of them, and put the loading itself in one place
(`src/load.js` today, read by 120 files) so that the later tasks change one file. Three ways were weighed in the survey: (a) a registry in the source, `probe(key, name, fn)`, an identity
unless a hook is installed before load; (b) the build's own instrumenting, an esbuild plugin that wraps the named exports in a bundle made for the tool; (c) a Node module-customisation hook. Proposed: (b), because
`tools/perf.js` states that "nothing is added to `src/`", production has no cost, and it needs no change to the sources when the modules become ES modules; (a) is the fallback if the plugin proves fragile. The first step of the task is to prototype (b) on `tools/perf.js` and `tests/spread.js` and say what it cost.
Acceptance criteria:
- [ ] `tests/lib/load.js` exports `loadModules({ wrap })`, `wrap` being `{ 'sim/lifecycle': { roundPhase: (fn) => wrapped } }`; with no argument it is `src/load.js` as now. Today it works as the seven tools do (require in manifest order, wrap after each registers); it is the one place the later tasks change.
- [ ] The ten files above use it; none reads `src/manifest.json` to load (the fixtures hash and the lint still read it as a list).
- [ ] A wrapped function is seen by every caller outside its module, as now. The task states whether a call inside its own module is seen too (it is not today) and `tools/perf.js`'s report and `tests/bench.js` are unchanged.
- [ ] The task file records the cost of loading a hooked bundle once (esbuild over 63 modules), measured, and the choice among (a), (b) and (c) with the reason.
- [ ] `docs/architecture/modules.md`, "Adding things": one line on how to time or count a function.
Waits for: P2 (the bundler), if (b) is chosen.
May run beside: any task that does not edit those ten files.

## P4: ES modules, part 1: the first 21 modules of the manifest

Priority: 3
Size: M
Arch: yardstick
Phase: implement
Design ref: none (code structure). `docs/architecture/target-v2.md`, section 2.
Goal: Turn the first 21 modules of `src/manifest.json` (`vb`, the five `gen/*`, `gen`, `culture`, then `sim/rules` through `sim/records`), from `VB['key'] = (() => { ... return { ... }; })();` into files with `import` and `export`.
A codemod (`tools/esm-codemod.js`, kept until P6 is done and then deleted) does the common shape: the IIFE's wrapper and `return { ... }` go, `const { a, b } = VB['x']` becomes `import { a, b } from './x.js'`,
`export` goes before each name of the return list. The body is not re-indented (that is the formatter's work, in P8, so the diff of this task is the head, the imports and the exports of each file, a few hundred lines in all). While some modules are converted and some not, a converted file ends with `VB.register('key', ns)` (`import * as ns from './self.js'`; to verify that a module may import itself), and `src/vb.js` keeps the `VB` object, so an unconverted module's `VB['key']` and every test still work. Chunk boundaries follow the manifest, so a converted module imports only converted ones.
Acceptance criteria:
- [ ] The first 21 modules of the manifest are ES modules; an unconverted module still finds them through `VB[...]`; the 120 files that load `src/load.js` are unchanged and pass.
- [ ] `loadModules` (P3) loads the mixed set: Node needs to see `.js` as ES modules (to verify: a `"type": "module"` in `src/package.json`, or `.mjs`, and `require()` of an ES module, which Node 22.23 allowed for `.ts` in a scratch directory on 12 November), or loads the esbuild bundle; the choice is in the task file.
- [ ] Every module reached at load (not inside a function) from a cycle is listed; the task checks whether there is one in this chunk (not checked in the survey; the 19 cycles `tools/writes.js` lists all start at `sim/relations`, `sim/help`, `sim/expansion`, `sim/farmclaims` or `sim/commands`).
- [ ] `tests/golden.json`, `tests/counters.json`, `index.html`'s behaviour: unchanged. Lines changed (git diff --stat) are in the task file.
- [ ] `tests/dependencies.js` still passes unchanged (P7 changes it).
Waits for: P1, P2, P3.
May run beside: nothing that edits `src/` (a window: P4 to P6 together).

## P5: ES modules, part 2: the next 21 modules

Priority: 3
Size: M
Arch: yardstick
Phase: implement
Design ref: none (code structure). `docs/architecture/target-v2.md`, section 2.
Goal: The same for the modules numbered 22 to 42 of the manifest (`sim/prospect` through `sim/kinds` as listed on 12 November). All four forward lookups into `sim/commands` (`sim/relations`, `sim/farmclaims`, `sim/help`, `sim/expansion`: `const issue = (st, cmd) => VB['sim/commands'].issue(st, cmd)`) are in this chunk: they stay lookups through `VB` until P6, since `sim/commands` is not converted yet.
Acceptance criteria:
- [ ] As P4's, for modules 22 to 42; the four `issue` shims are untouched and marked "until P6" in a comment.
- [ ] `kinds.js:376` (`KINDS.dig = VB['sim/dig'].KIND`, a lookup at load) and any other use at load of a later module are listed in the task file with the order they need.
Waits for: P4.
May run beside: nothing that edits `src/`.

## P6: ES modules, part 3: the rest, the late lookups, the shim gone

Priority: 3
Size: M
Arch: yardstick
Phase: implement
Design ref: none (code structure). `docs/architecture/target-v2.md`, section 3.2 (the three upward hooks).
Goal: Convert modules 43 to 63 (`sim/eligibility`, `sim/agents`, `sim/commands`, `sim/occasions` to `sim.js`). Then the late lookups go: the 17 `later('...')` calls of `sim/commands` (nine modules: `sim/lifecycle` 5, `sim/heirs` 2, `sim/settle` 2, `sim/occasions` 2, `sim/farmclaims` 2, `sim/service`, `sim/membership`, `sim/cottage`, `sim/clock` 1 each) and the four `issue` shims become plain imports. All 19 cycles `tools/writes.js` finds
pass through `sim/commands`, command dispatch, the one upward door; ES modules allow such a cycle if no module uses an import of the cycle at load, only inside functions, so they stay as they are (decision, with the evidence: `tools/writes.js` and the new import graph).
`VB.register`, the `VB` object in `src/vb.js`, and the codemod go; `src/load.js` builds `globalThis.VB` for the tests from the namespaces, as the only place that still does (the 120 test and tool files keep `VB['sim/x']`).
Acceptance criteria:
- [ ] Every module of `src/` is an ES module with imports; no `VB[` in `src/` outside `src/load.js` and the page script (the page's 64 `VB` references stay: it reads the namespaces the bundle puts on `VB`, or imports them in a later task).
- [ ] No import used at load time is part of a cycle (a check in `tests/dependencies.js`: for each cycle, every use of the cyclic import is inside a function); the 19 cycles are listed in the task file with the sites that cause them.
- [ ] Module evaluation order does not change a result: `tests/golden.js`, `tests/counters.js`, `tests/saves.js` unchanged; the first `npm run verify` makes new fixtures (the key changed) and `tests/fixtures.js`, `tests/history.js` pass on them.
- [ ] `docs/architecture/modules.md`, "Adding things": a module is a file with imports and exports and no longer an entry in the manifest's order; `AGENTS.md`, "Finding things" and "Conventions": the module map greps, and "a module reads only modules listed before it" goes.
Waits for: P5.
May run beside: nothing that edits `src/`.

## P7: The dependency check reads the import graph

Priority: 3
Size: S
Arch: yardstick
Phase: implement
Design ref: none (tooling). VB-230 and `src/layers.json`.
Goal: `tools/writes.js` finds each module's dependencies by looking for `VB['key']` in its syntax tree and calls a lookup inside a function a "late" one; `tests/dependencies.js` and `tools/dependencies.js` check them against the layers of `src/layers.json` (20 upward edges of 500, all through command dispatch or `culture` and the like, on 12 November). After P6 the edges are `import` declarations: read those, keep the layer rule and the rule that every cycle passes through `sim/commands`, and give each import a flag "used at load" or "used only in functions". `src/manifest.json` stays as the list of modules (for the lint and the fixtures hash) with no order meaning; a test checks it equals the files reachable from the entry.
Acceptance criteria:
- [ ] `tools/writes.js`, `tools/dependencies.js` and `tests/dependencies.js` read the import graph; the output of `node tools/dependencies.js` lists the same upward edges as before (20), and `tests/dependencies.js` fails on an import from a higher layer that is not through the door, on a cycle not through `sim/commands`, and on a cycle whose import is used at load.
- [ ] `tools/writes.js`'s other results (each field's writers and readers) are unchanged: `tests/ownership.js` passes without `--update`.
- [ ] `src/manifest.json`: its comment or neighbour file says it is no longer an order; a test checks the list against the import graph.
- [ ] `docs/architecture/target-v2.md`, section 3.2, and `modules.md`: a line each on how the check reads imports.
Waits for: P6.
May run beside: any task that does not edit `tools/writes.js` or `tests/dependencies.js`.

## P8: A formatter, and the files become TypeScript

Priority: 3
Size: M (L by lines; mechanical)
Arch: yardstick
Phase: implement
Design ref: none (code structure). Kim's decision of 10 November (code review).
Goal: One sweep, so that every file is rewritten once: (1) rename the 63 modules `*.js` to `*.ts` with `git mv` in a commit of its own (rename only, so history follows); (2) format `src/` (the modules and `src/page/*.js`, which stay `.js`: the page is a script spliced into one closure, 623 top-level names on 12 November) with Prettier at an exact version, print width 120, single quotes, in a commit of its own, listed in `.git-blame-ignore-revs`; tests and tools in a third commit, the same way. This also re-indents the module bodies that P4 to P6 left as they were. Imports name the extension (`from './x.ts'`; Node's type stripping needs it, tried in a scratch directory on 12 November), only erasable syntax is allowed (no `enum`, `namespace` or parameter properties; Node refused all three there), nothing but the page's bundle is built: Node runs the `.ts` modules as they are. `tools/wrap.js`, its test, the lint's 160 columns and its 400 lines go in this task (the formatted `sim/relations` is 691 lines, `sim/heirs` 651, so the cap cannot stay); `tsconfig.json` is added with `noEmit`, `allowImportingTsExtensions`, `erasableSyntaxOnly` (TypeScript 5.8 or later: to verify), not strict, and the files are `// no checking yet` in effect, since nothing is annotated (`tsc --noEmit` joins `npm test` in P10).
Measured on 12 November (Prettier 3.3.3, width 120, single quotes, the defaults otherwise, over a copy of `src/sim`, `src/gen`, `src/gen.js`, `src/culture.js`, `src/sim.js`, `src/vb.js`): 11,917 lines become 19,722; `sim/relations` 691, `sim/heirs` 651, `sim/records` 725, `gen.js` 1,044. Functions over 60 lines go from 11 to 26 (largest: `gen.js:generate` 257 to 486).
Acceptance criteria:
- [ ] The three commits above; `.git-blame-ignore-revs` lists the formatting commits and the README line `git config blame.ignoreRevsFile .git-blame-ignore-revs` is in `AGENTS.md`.
- [ ] Equivalence: esbuild minifying the bundle of the sources before and after the formatting commit gives the same bytes (the formatter changes no token); the task file shows the check.
- [ ] `npm test` runs the modules with Node's type stripping as they are, and `node build.js` strips types in the bundle; the Node floor (to verify: type stripping without a flag since 22.18; the Checks workflow's `node-version: 22` takes the latest 22, 22.23.4 here) is written into `package.json` `engines` and `AGENTS.md`.
- [ ] `tests/lint.js` has no line or column cap, `tools/wrap.js` and `tests/wrap*.js` are gone, `AGENTS.md`'s and `BACKLOG.md`'s mentions (the refactor rules: "stays under 400 lines", "lines over 160 characters") go.
- [ ] Prettier is a dev dependency at an exact version, with `npm run format` and a check in `npm test` (`prettier --check`, listing the files, so an unformatted file fails).
- [ ] The tools that scan the source (P1) work on the `.ts` files; `tests/dependencies.js`, `tests/ownership.js` pass; golden and counters unchanged. The first `npm run verify` makes new fixtures.
Waits for: P6, P7.
May run beside: nothing that edits `src/`, `tests/` or `tools/`: it is the second window.

## P9: Measures of width in place of the cap on length

Priority: 3
Size: S
Arch: yardstick
Phase: implement
Design ref: none (code structure). Kim's decision of 10 November (code review).
Goal: The lint holds a module's exports to 15 and a function's formatted length to 60 lines, each with a baseline that only falls (`tests/width-baseline.json`, updated with `node tests/lint.js --update`, a ratchet as the lint's), and no cap on a module's length. A function is a declaration, expression or arrow with a block body; a one-line arrow is not counted. Counted from the source (`export` declarations and the names of `export { ... }`).
Today's numbers, from the code on 12 November, to be recounted by the task (exports are counted on the loaded namespaces, constants included; functions on the formatted copy described in P8): 62 modules export, median 9, 18 over 15: `sim` 106 (the facade), `sim/rules` 56, `sim/records` 52, `sim/agents` 34, `sim/relations` 32, `sim/stores` 32, `sim/herds` 30, `sim/fields` 22, `culture` 20, `sim/lifecycle` 19, `sim/layout`, `sim/claims`, `sim/plans` 18 each, `sim/hunger`, `sim/meadows`, `sim/heirs`, `sim/commands` 17 each, `sim/farmclaims` 16. Functions over 60 formatted lines: 26 in `src/sim`, `src/gen` and the root modules (`generate` 486, `gen/geology.lay` 186, `sim/scenarios.makeState` 186, `sim/lifecycle.marriageRound` 159, `sim/saves.encode` 134, `sim/scenarios.seedHeirs` 134, `sim/layout.layVillage` 133, `gen.bakeChunk` 126, `sim/heirs.heirRanking` 116, ...). `heirRanking` (116 formatted lines) is among them; `movingRound`, which Kim also named, is exported by `sim/lifecycle` but did not appear among the longest functions in the survey's count (it is probably a short wrapper over `roundPhase`; not checked), and the task says what it measures.
Acceptance criteria:
- [ ] `tests/lint.js` fails a module that exports more than 15 names, or a function longer than 60 lines, unless the baseline allows it; the baseline holds today's offenders at today's numbers and only falls; a new module or function starts at the limit.
- [ ] The task file lists every module and function in the baseline, with the recounted numbers; where this differs from the survey's, it says so. The `sim.js` facade is handled as Kim's answer to question 4 says.
- [ ] `AGENTS.md` (Conventions) and `BACKLOG.md`'s refactor rules ("stays under 400 lines" at line 221 of `BACKLOG.md` on 12 November) give the two measures in place of the cap.
- [ ] `docs/architecture/modules.md`, "Adding things": the same, one line.
Waits for: P8.
May run beside: any task that does not edit `tests/lint.js`.

## P10: The state's shapes as types, and tsc in npm test

Priority: 3
Size: M
Arch: yardstick
Phase: implement
Design ref: none (code structure). `docs/architecture/target-v2.md`, section 4 (the interface sketches are already TypeScript-style types) and `docs/architecture/ownership.md`.
Goal: `src/types.ts` holds the shapes of the state: `State`, `World` (`w`), `Pawn`, `Household`, `Farmstead`, `Village`, `Job`, `Agent`, `Plot`, `Store` and the like, written from the 117 `@state` lines (24 files; 33 in `sim/scenarios`, 21 in `gen.js`) and from the plain-data invariants in `tests/lib/invariants.js`. `st` is plain data as a type: `Plain<T>` (no function, no class instance, no `Map` or `Set` where `tests/plaindata.js` forbids them; typed arrays where the world has them). The `@state` lines go, or each becomes one line pointing to its type (`// @state: see State.tick`), and `tests/lint.js`'s rule "every top-level key of `w` and `st` has an `@state` tag" is replaced by a type check: a list of keys `as const satisfies readonly (keyof State)[]` and a type that fails when a key is missing (to verify that this is expressible), compared in a test with the keys of a seeded state. `tsc --noEmit` runs in `npm test`. Modules are annotated only at the signatures of exported functions that take `st`, `hh`, `pawn`, `farm`, `village` and `job` (`st: State`), not yet inside.
Acceptance criteria:
- [ ] `src/types.ts`, `tsconfig.json` (not strict yet) and a script `tests/types.js` that runs `tsc --noEmit -p .` (TypeScript at an exact version; the time it takes in `npm test` before and after is in the task file; on 12 November it took 5.4 s over the 62 modules with `checkJs`, on a loaded machine, against 2 s on 10 November).
- [ ] The exported functions of the modules take their holders by type; the errors it finds are fixed where the code is wrong and annotated `// @ts-expect-error <why>` (counted in the task file) where the type is too narrow; the number of expect-errors is a baseline that only falls.
- [ ] A misspelt field of a household (`hh.grian`) fails `npm test`: a test file `tests/types-negative.ts` holds a few lines that must not compile and `tsc` is run on it expecting errors.
- [ ] `tests/plaindata.js` and `tests/saves.js` still hold; a `Plain<State>` assertion shows no function field.
- [ ] `AGENTS.md` (Finding things: "state schema: `grep -rn "@state" src`" becomes `src/types.ts`; Conventions on `st` and the `WORLD` list) and `docs/architecture/modules.md`, `target-v2.md` (section 4's note): a line each.
Waits for: P8.
May run beside: any task that does not add a state field (a new field then adds its type; the merging order matters, not the files).

## P11: Commands and holders typed

Priority: 3
Size: M
Arch: yardstick
Phase: implement
Design ref: none (code structure). VB-237 (a holder in `sim/stores`).
Goal: What the code review said types would have caught: `type(holder)` in `sim/stores` taking any object for a pawn, and the positional parameters of `heirRanking` (seven) and `post` (three optional). Give `sim/stores` a `Holder` as a union of three (pawn, household, village; VB-237 states the three) with a `kind` the functions narrow on; give `issue(st, command)` a `Command` that is a union over the verbs of `src/sim/commands.ts` (`actor`, `verb`, `target`, `args`, `source`), so a verb's `args` are checked at every `issue` call; type `heirRanking`'s parameters and `post`'s optionals as they are (changing them to an options object is a refactor of its own and out of scope; the task may add it to the backlog).
Acceptance criteria:
- [ ] `Holder` in `src/types.ts`; every call of a `sim/stores` operation passes a typed holder; the calls that did not are listed in the task file with what each was (a bug found, a test, a narrowing).
- [ ] `Command` and the verb table typed; the 17 `later(...)` calls of `sim/commands` are gone already (P6), so the verbs call their handlers by import, and `tests/commands.js` ("only the verbs call the acts they wrap") reads the import graph or the type.
- [ ] `tests/types-negative.ts` holds a wrong `args` and a household passed as a pawn, each failing.
- [ ] Golden and counters unchanged; if a bug is found it is a separate task (the finding is in the task file), not fixed here unless it leaves the golden unchanged.
Waits for: P10.
May run beside: any task that does not edit `sim/stores`, `sim/commands` or `sim/heirs`.

## P12: strict, measured, with a baseline that only falls

Priority: 3
Size: S
Arch: yardstick
Phase: implement
Design ref: none (code structure).
Goal: Add `tsconfig.strict.json` (`strict`, plus `noUncheckedIndexedAccess` to be decided) over all modules and a script that counts its errors by file and compares them with `tests/tsc-baseline.json`, which holds each file's count at the start and only falls (as the lint's baselines; `--update` lowers). A file new after this task starts at zero. The error count is not known today (not checked: nothing is annotated, so the answer is the number of implicit `any`s); the task records it by file and by kind of error, and splits P13 and P14 if the largest layers hold more than about 300 errors each.
Acceptance criteria:
- [ ] `tests/tsc-strict.js` in `npm test`: fails if a file's count rises or a new file has any; prints the total, as a ratchet.
- [ ] The baseline and the counts by module and by error code are in the task file.
- [ ] `AGENTS.md` (Commands): a line on the ratchet beside the lint's and the ownership's.
Waits for: P10.
May run beside: any task.

## P13: strict for the kernel and material layers

Priority: 3
Size: M
Arch: yardstick
Phase: implement
Design ref: none (code structure). `src/layers.json`.
Goal: Bring the modules of the kernel and material layers (`src/layers.json`: 23 and 13 modules) to zero errors under `tsconfig.strict.json`, without changing behaviour. The layer's files are removed from the baseline (or left at zero). Split by the task itself if P12's counts say the layers are larger than M.
Acceptance criteria:
- [ ] Each listed module has zero strict errors; the baseline has them at zero; golden, counters and the saves tests unchanged.
- [ ] No `any` is added to silence an error (a `// @ts-expect-error` carries a reason; their number is in the task file and falls task by task).
- [ ] The hot paths named in `AGENTS.md` (membership caches, per-tile travel cost, the death roll, rule `value()`) are timed before and after at `small-y5` (`node tools/sim.js --years 1 --report perf`): types are erased, so the numbers do not move beyond the noise; the check is in the task file.
Waits for: P12.
May run beside: tasks that do not edit the layer's modules.

## P14: strict for social, agency and derived; gen; the page; and the docs checked

Priority: 3
Size: M
Arch: yardstick
Phase: implement
Design ref: none (code structure). `src/layers.json`.
Goal: The same for the social, agency and derived layers (13, 8 and 2 modules), `src/gen/*`, `src/gen.js`, `src/culture.js`, `src/sim.js`, so that `tsc --strict` passes over all modules and the baseline is empty (a ratchet at zero). Then close the plan: check that `AGENTS.md`, `docs/architecture/modules.md` and `docs/architecture/target-v2.md` each carry the line the earlier tasks owed them, and write the follow-up the survey left open: the page script (`src/page/*.js`, one closure of 623 top-level names, 64 references to `VB`) as modules or as a checked JavaScript script, as its own plan. Split by the task itself if P12's counts say it is larger than M.
Acceptance criteria:
- [ ] `tests/tsc-strict.js` reports zero, and any new file with an error fails; golden, counters, saves unchanged.
- [ ] The three documents are checked, with the lines they carry listed in the task file.
- [ ] A task, or a note to Kim, for the page script and for the tests and tools as `.ts` (they stay `.js` and keep `VB` from `src/load.js`).
Waits for: P13.
May run beside: tasks that do not edit the modules of the layers it names.

---

## The cost, in one place

Counted on 12 November (details and how in `backlog/VB-055.md`):
- Files. `src/` has 63 modules (11,980 lines) and 32 page files (5,035 lines); `tests/` 131 scripts and 13 libraries; `tools/` 37 scripts. Step 1 (P4 to P6) changes the head, the imports and the export list of 63 modules, about 1,000 lines in all (416 imports at load and 506 `VB['...']` references in the modules); no body is re-indented. P8 rewrites every line that Prettier changes: the modules from 11,917 lines to 19,722 and the page and the tests and tools by the same ratio, 63 renames, and every file of `src/` in the blame (hence `.git-blame-ignore-revs`). P10 to P14 touch the signatures: about 1,800 functions (1,798 counted).
- Agent sessions. 14 tasks, each one session, and an estimated 3 or 4 retries or splits (P4 to P6, P8, P13 and P14 are the likely ones): 16 to 20 sessions. Two windows in which nothing else edits `src/`, each of about three sessions (P4 to P6) and one (P8).
- `npm test`. `tsc --noEmit` adds 2 s (10 November) to 5.4 s (12 November, a loaded machine, 62 modules, no types) and will add more once the types exist (not checked); `prettier --check` over `src/` (not checked); the build, `build.py` 0.06 s, becomes esbuild's (not checked, expected tens of milliseconds). `npm run verify` gains `tests/tsc-strict.js` and the same `tsc`.
- What does not move: speed (types are erased; the bundle holds the same code), `tests/golden.json`, `tests/counters.json`, the saves. The fixtures are made again after P6 and P8 (the key changes), 2 minutes for the small pair and 1.5 for the medium.
