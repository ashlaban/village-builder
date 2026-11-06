# VB-196: moving-round cache work, 6 November 2026

**Partial implementation. VB-196 remains open:** the behavior-preserving cache work is retained, but the 50 ms step budget is not met.
The village scheduling experiment was removed because it failed the required demographic comparison. The golden file is unchanged.

Impact: `sim/lifecycle` coordinates the same marriage and handover commands, in the same order and with the same random draws.
`sim/heirs` owns a transient ranking view that reads kinship, household membership, holdings and village practice. It keeps reverse
dependencies on candidates, including rejected candidates and their spouses, and refreshes affected direct claims and full rankings.
There is no new module, saved state, owner, scheduler, UI change or module dependency. Caches last only for one synchronous round.

The round reads the events appended by its commands to identify moves, inheritances, shares and extinctions. This includes children
moving with a parent and third-party claimants; invalidation is not limited to the two newlyweds. Household means are refreshed for
changed households, while places and handover scores are refreshed for the affected rankings. A marriage moving waiting adults or a
claim removing them also invalidates handover fallback scores in affected villages. The handover and demand phases reuse the same ranking view. Direct-heir
queries no longer traverse wider family branches that they immediately discard. Under land residence, a man without a place considers
only the precomputed, ordered list of women with a place; rejected homeless pairs consume no random draws in either implementation.

## Measurement

Baseline: pulled `origin/main`, `f73de6c`. Node v24.22.1, AMD EPYC 9V74, two available CPUs. The fixtures were fetched from the published
`fixtures` branch (`4ee11e9`); their source stamp is `4df5766`. Their format and checksums pass; their golden hashes are stale, which the
fixture loader explicitly permits. Both versions use the identical saves.

Reproduce with `node tools/moving-bench.js --day`. For a baseline checkout with the same fixture files, add `--source /path/to/checkout`.
The direct call starts immediately after loading. The round-day check advances the loaded simulation to autumn day 11, then times all
240 calls to `Sim.advance(st, 0.1)` on that day, as VB-088 times six-minute steps. Wall times are diagnostic, not test assertions.
The tool also hashes the **complete serialized post-round save**, including RNG state, rather than a small summary.

| Measure | small-y40 before | small-y40 after | medium-y60 before | medium-y60 after |
|---|---:|---:|---:|---:|
| Live households | 183 | 183 | 618 | 618 |
| Direct round call, ms | 336.308 | 77.061 | 14,544.422 | 328.341 |
| `roundRank`, all source-counted rankings | 13,807 | 580 | 276,544 | 6,907 |
| Rankings/household/round | 75.448 | 3.169 | 447.482 | 11.176 |
| `roundPairs` | 390 | 369 | 12,928 | 9,178 |
| Longest round-day step, ms | 461.657 | **51.208** | 31,200.710 | **481.835** |

The cost is **households × ranking calls per household per round**: `183 × 75.448 → 183 × 3.169` and
`618 × 447.482 → 618 × 11.176`. Source-counted rankings include indirect calls and handovers, not only the round's direct calls.
This removes 95.8% and 97.5% of rankings respectively. Wall times were collected sequentially without parallel test workers.
The moving round is still the longest step in both cases; **the 50 ms acceptance criterion fails**.

Complete post-round save SHA-256 values match before and after:

- small-y40: `7803e23465d5a39d2f84cda21a868e2bbedb4896b33826ff2df81c85b6409edc`
- medium-y60: `faf3cfa79c594d5797504266f1049cc1113056589b74dd0f6e4d0a72cd0af04b`

The history growth baseline for `roundRank` is removed: its ratio is 1.025249, below the ordinary 1.25 limit.
The `roundPairs` history ceiling falls from 2.619689 to 2.478628, and `heirRank` from 2.317458 to 1.348733.
The scaling exponent for pairs remains 2; this patch does not solve the island-wide marriage market's quadratic scaling.
The tiny counter baseline changes only `roundPairs`, `heirRank` and `roundRank`.

## Validation

- `npm test`: all 68 scripts pass.
- New marriage regressions compare cached and uncached rankings before and after marriage and handover commands, with eldest/chosen
  birth order and behind/keeps heir customs. They also check that an unchanged household reuses its ranking without another ranking call.
- The history check passes, and existing cost ceilings are only lowered or removed. No ceiling is raised.
- Both late-fixture post-round save hashes match the baseline, including RNG state.
- `VB_CHROMIUM=/usr/bin/chromium VB_SOFTWARE_RENDER=1 VB_TEST_JOBS=2 npm run verify`: **81 scripts pass**, including all three
  real-browser suites, golden states, save/load determinism, invariants, all four late fixtures and history cost checks (233.4 s).
- After the final fallback-cache correction, the golden and marriage checks also pass independently, and both full late-fixture
  post-round save hashes still match. The build is current and `git diff --check` passes.
- No screenshots are needed for this simulation-only patch; browser behavior is covered by verification.

## Rejected scheduling experiment

The experiment ran village marriages, handovers, claims and plots in village order on consecutive six-minute steps, followed by
remaining matches across villages, kin pressure, settlement and service work. Its ranking cache and progress were plain data so a save
could resume between steps. It is absent from the retained patch; these numbers describe that experiment, not the retained code.

Populous small, 30 years from seeding, natural deaths enabled:

| Seed | Metric | Baseline | Experiment | Change |
|---|---|---:|---:|---:|
| 7 | Marriages/year | 6.5333 | 6.3667 | -2.6% |
| 7 | Mean age at first marriage, years | 21.3606 | 21.1080 | -1.2% |
| 7 | Living women 45–54, never married | 1/24 (4.17%) | 0/29 (0%) | **Fails 10% band** |
| 42 | Marriages/year | 5.9667 | 6.5000 | +8.9% |
| 42 | Mean age at first marriage, years | 22.0028 | 20.9504 | -4.8% |
| 42 | Living women 45–54, never married | 0/15 (0%) | 0/12 (0%) | Unchanged share |

Marriages/year counts unions starting during the run. First-marriage age includes people whose first union starts during the run,
both sexes, including those who later die. Never-married share uses living women aged 45 through 54 at year 30 and their entire union
history. These are deliberately unrounded cohort counts: a small absolute difference must not be hidden by reporting only averages.

The experiment also left medium-fixture spikes in initial ranking setup and the final cross-village phase. Retaining it would require
both a scheduling solution to those spikes and a passing demographic comparison. No golden entries were re-recorded to accept it.

## Investigation of the remaining work

`node tools/moving-profile.js` times coarse exports before their importers capture them, plus the transient view's `rank` and
`invalidate` methods. It reports inclusive and exclusive times, call counts, and the complete post-round save hash. It does not
instrument saves or fixture generation. Internal lexical calls (notably `kinPressure`) remain in their enclosing function's self time;
this is a stage profile, not a claim that every function is independently timed. Instrumentation overhead means these times are
diagnostic; use the uninstrumented `moving-bench.js --day` for the actual step budget.

One sequential diagnostic run of the retained patch, on the same fixtures:

| Stage | small-y40 self ms | medium-y60 self ms | Medium calls |
|---|---:|---:|---:|
| Cached ranking reads, including cache misses | 10.193 | 149.229 | 2,168 |
| Initial direct-heir view construction | 4.072 | 28.776 | 1 |
| Ranking invalidation | 0.537 | 4.427 | 24 |
| Settlement | 36.571 | 80.147 | 1 |
| Service placement | 2.718 | 34.350 | 1 |
| A marrying holder hands on a farm | 1.825 | 31.728 | 8 |
| Starting plots | 5.530 | 25.210 | 1 |
| Moving round remainder, including matching and lexical kin pressure | 27.219 | 38.118 | 1 |

Total instrumented round: 97.397 / 417.463 ms. Both hashes and deterministic ranking/pair counts match the uninstrumented tool.
The small invalidation cost means another wholesale cache rewrite is not the first next step. Ranking misses and work after matching
must be distributed too. Eight nested `handOn` calls still use ordinary uncached succession ranking; passing a shared view here must
refresh it **after** the union and moves, before ranking the farm being handed on. A pre-marriage ranking would be incorrect.

The settlement source explains another large indivisible cost. `landInUse` scans all world tiles and runs a radius BFS from every
built mark; duplicate marks repeat the BFS. First try deduplicating marks and sharing the resulting occupancy/distance view for the
whole round, retaining the same candidate order and exact `taken`/`near` sets. Only measure that as a speedup after asserting set
equivalence on both fixtures. A village wrapper alone still pays this initialization in the first village that needs a site.

### Why the first scheduling attempt is insufficient

Source review of the discarded experiment found concrete semantic hazards, beyond the demographic gate it failed:

- Each scope rebuilt eligible singles. A man who had a viable local match but failed the go-ahead or means check could enter the final
  cross-village pass and receive another attempt. Preserve an explicit per-round decision state; do not infer it from marital status.
- The old kin-pressure code identifies new marriages by `union.start === st.t`. That omits marriages from previous slices. Carry the
  round's union IDs (or an explicit round start/end interval), while retaining each marriage's actual event time.
- Own-household places are insufficient dependencies: a holder marrying away can move children, transfer another farm, pay shares or
  admit a claimant. The existing dependency invalidation must survive the scheduling boundary.
- Ordinary jobs, commands, cottage completion and restoration can change membership, stores or field counts between slices. A retained
  cache needs mutation invalidation across those boundaries; the means cache should be rebuilt for each slice. Frozen means would use
  obsolete stores. Rankings also depend on holdings, spouse status, field counts for `keeps`, and practice.

These are source findings, not proof that a particular hazard caused the one-woman cohort difference. To establish causation, trace
the baseline's never-married pawn and the earliest differing marriage/eligibility decision; do not tune randomness to make seed 7 pass.
The experiment changed random draw order and local versus cross-village opportunities as well, so fixing a retry alone is not evidence
that the demographic gate will pass.

### Proposed implementation sequence and gates

1. Keep this behavior-preserving PR as the measured first stage; leave VB-196 open. Add isolated optimizations for settlement's duplicate
   work and the nested handover ranking path, each checked against full post-round hashes before introducing a new order of play.
2. Introduce a plain-data annual workflow with `startedAt`, the initial village IDs, phase/cursors, per-man decision status, unmatched
   candidates, round union IDs and cache dependencies. `sim/lifecycle` owns its progress; `sim/heirs` maintains the ranking view through
   its operations. Recreate functions after loading; do not persist closures, a generator, or module-global workflow state.
3. Prepare direct claims and prewarm full rankings in deterministic household batches on the round's day. Pick batch sizes from the late
   fixtures and declared work counts, not runtime clocks. One initial full ranking pass would merely move the stall to the first slice.
4. Process local marriages, handovers and claims in village order, with no second chance for an already attempted man. Keep matches
   across villages in the final phase, then kin pressure, final demand, settlement, service and payments. Preserve global ordering within
   each phase and snapshots of village IDs so newly founded villages are not visited again in the same round.
5. Measure the final phase separately. Settlement alone was 80 ms in this diagnostic run: the literal **one final step** is not yet a
   viable budget assumption. Optimize it first. If it still exceeds budget, propose an explicit acceptance-criterion change to a bounded,
   resumable final phase: cross-village men in fixed batches, occupancy initialization in tile/mark batches, settlement in source-village
   order, then service in holder order. Splitting service must preserve its current household order and tie-breakers. Do not silently
   substitute this for the task's current one-step requirement.
6. Check that all work fits in the round day, including preparation and finalization; the initial noon trigger leaves only 120 six-minute
   slots. Count required slots on both fixtures before choosing the start time and batch sizes. A round spilling into the next day can
   interleave births/deaths and daily work and is a separate behavior change, not a scheduling detail.
7. Test save/load after every workflow phase and mid-batch; partial-hour advances; pause/resume; debug draining; an external marriage,
   inheritance or cottage completion between slices; exactly-once execution; and new villages founded during settlement. Compare a loaded
   run with an uninterrupted run using identical advances. No simulated decision may read wall time or depend on the camera.
8. Rerun `node tools/marriage-demography.js --source BASELINE 7 42` and the same command without `--source` over 30 years. The reusable
   tool reports first-marriage counts, exact denominators and never-married pawn IDs as well as the requested three measures. Its unit
   cases cover remarriage, first unions predating observation, death, the 45/54 age boundaries and empty cohorts. Apply the existing 10%
   gate literally; a zero baseline requires a zero result. Empty cohorts report `null` and cannot establish a passing comparison.
   A failing small cohort must be reported, not rounded away or replaced with a
   different statistical test without a design decision.
9. Only after demographics pass, re-record the intended golden changes, list each changed entry, ratchet the work baselines down, and run
   full verification. Report the uninstrumented longest step across the **whole round day**, not just the new slices.

The all-day gate has a separate known dependency: the earlier medium timing also recorded a 227 ms midnight after the moving round.
VB-201 owns the midnight work and is blocked on VB-127. Even perfect round slicing would not establish the literal whole-day <50 ms
criterion while that independent midnight still exceeds it. Report the midnight and round slice separately and coordinate with VB-201;
do not drop midnight samples from the acceptance report or imply the whole-day gate is solved.

Follow-up PR validation: full verification rerun with the new demographic regression included, using the same Chromium/software-render
configuration above: **82 scripts pass in 225.1 s**. Both instrumented fixture runs reproduce the complete post-round hashes and exact
ranking/pair counts reported above. The build and whitespace checks pass; `tests/golden.json` is unchanged. This PR completes the cache
stage and investigation; it does not close VB-196 or claim that the proposed scheduler has passed its demographic or timing gates.
