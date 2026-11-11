# Hunger after the night's merges: which task, and why (11 Nov 2026)

A measurement only: no game code, tunable or golden entry changed. The question (from VB-308's measuring): household-years hungry on over
0.3 of their days, on the ten full runs of the bands, rose from 225 (56 short of people) at `38b920d` to 364 (102) at `85bfc19`. Which
merge, by what mechanism, what the tip of `claude/relaxed-faraday-2gg0gu` (`4ff49d4`) reads, and a fix.

## How it was measured
- The rows are `docs/bench/lone-households.js`'s: household-years after year 3, present a season or more, hungry over 0.3 of their days;
  "short" is at most one member of 16 or more and fields on the first hungry day. To also see the fields, a lighter replay (a scratch script,
  the same rows, no kin search) counted for each household-year the sowing days, reaping, yields, hungry days by season and by what the
  fields were doing, the record's events (`frost`: "a crop was lost to frost"), the stores' yearly flows and the herds at each year's end.
  It reproduces the replay's rows exactly where both ran (38b920d: populous 3 141, 7 6, 11 12, 42 39; 85bfc19: 7 46, 11 88, 42 65).
- Each commit was extracted (`git archive`) and run as populous small, 30 years, a day at a time, at seeds 3, 7, 11, 42 (the bands'),
  and 5, 13 for the divergence. Founders and heirs were not re-run per commit (they carry 27 of the 225 rows and 47 of the 364).
- Reproduction: 225 -> 364 reproduces. At `38b920d` my run of the replay gives populous 3: 141 rows, 38 short (VB-283's table); at
  `85bfc19` the ten replay outputs left by VB-308's measuring sum to 364 rows, 102 short, and my replay at 85bfc19 matches them seed by seed.
- `6872a55` and `85bfc19` give identical runs (populous 7, 11, 42: every number equal): VB-284, VB-323 and VB-078 are inert, as claimed.

## Measurements

Rows over 0.3 (short of people in brackets) and hungry household-days, populous small, 30 years:

| Commit | seed 3 | seed 7 | seed 11 | seed 42 | sum 4 | seed 5 | seed 13 |
|---|---:|---:|---:|---:|---:|---:|---:|
| `38b920d` (base) | 141 (37) 5,754 | 6 (4) 459 | 12 (0) 626 | 39 (1) 1,695 | 198 | 41 (6) 1,890 | 101 (26) 4,136 |
| `1caa291` (VB-275) | 93 3,713 | 10 927 | 10 710 | 25 1,599 | 138 | | |
| `a41440f` (VB-126) | 82 (22) 3,786 | 13 (4) 709 | 25 (6) 1,106 | 41 (10) 1,703 | 161 | | |
| `6872a55` (VB-249) = `85bfc19` | 118 (46) 5,256 | 46 (3) 2,192 | 88 (13) 3,531 | 65 (13) 2,749 | 317 | 39 (7) 1,804 | 82 (13) 3,100 |
| tip `4ff49d4` | 0 55 | 0 0 | 0 5 | 0 1 | 0 | 0 3 | 0 1 |

Crops lost to the frost, as a share of fields sown, years 4 to 30 (the count of lost fields in brackets), and the mean sowing day (day of spring):

| Commit | seed 3 | seed 7 | seed 11 | seed 42 | seed 5 | seed 13 | sowing day (3, 7, 11, 42) |
|---|---:|---:|---:|---:|---:|---:|---|
| `38b920d` | 6.6% (660) | 4.7% (409) | 5.0% (516) | 4.9% (499) | 5.4% (499) | 5.4% (535) | 3.82, 3.69, 3.85, 3.75 |
| `a41440f` | 6.7% (672) | 5.0% (432) | 5.9% (597) | 5.4% (525) | | | 3.87, 3.73, 3.90, 3.84 |
| `6872a55` | 9.0% (902) | 6.9% (586) | 7.9% (808) | 6.8% (704) | 8.5% (809) | 7.0% (685) | 4.13, 3.93, 4.12, 4.04 |
| tip | 8.2% (823) | 6.9% (594) | 8.5% (873) | 5.8% (533) | 7.0% (669) | 6.6% (640) | 4.02, 3.93, 4.17, 3.88 |

The tip on the other six full runs (founders 3, 7, 11, 42 for 50 years; heirs 7, 42): 0 rows each (hungry household-days 6, 0, 4, 2, 0, 1),
so **all ten runs read 0 rows at the tip** (from 364 at `85bfc19`). Its frost losses stay at VB-249's level (founders 7 to 16%, heirs 17 to 20%).
What removed the hunger is fishing (VB-117): at its merge's first parent `2da2c57` populous 7 and 11 read 13 and 18 rows (VB-140's livestock
and VB-250 already between), at `9d227c3` 0 and 0, the same runs as the tip.

### Divergence
- An inert change moves the rows a lot: VB-275 (`1caa291`, golden unchanged) changes the four-seed sum from 198 to 138 (-30%), seed 3 from
  141 to 93, seed 42 from 39 to 25. Rows come in famine years (populous 11 at 85bfc19: 46 of its 88 in years 23 and 24; populous 42: 32 of
  65 in year 30), so one take-in or one bad year moves a seed by tens.
- VB-249's effect on the rows is at the edge of that: four seeds 198 -> 317 (+60%), but six seeds 340 -> 438 (+29%), and seeds 3, 5 and 13
  fall (141 -> 118, 41 -> 39, 101 -> 82). On hungry household-days, three seeds rise 1.6 to 5.6 times, three fall by up to a quarter.
- The frost losses are the clear signal: up on every one of six seeds, by 1.4 to 3.1 points (+27% to +62%), where VB-126 moves them by
  0.1 to 0.9 and the inert seeds of one commit spread little. The sowing day is later on every seed (+0.20 to +0.31 days).

So: the 225 -> 364 is about half VB-249 and half divergence; VB-249's harm itself (lost harvests) is real and reproducible.

## Which merge
- **VB-249 (`6872a55`)**: frost losses +27 to +62% on all six seeds, sowing later on all, rows +60% on the bands' four seeds.
- VB-126 (`a41440f`): rows 198 -> 161 against VB-275's 138, frost +0.1 to +0.9 points: within divergence, perhaps a small loss of hands at
  the harvest (funeral ales override work); not the cause.
- VB-275 (`1caa291`): inert in effect, the divergence probe above. VB-323, VB-284 and VB-078: identical runs.

## The mechanism
A field's next step now waits for its household's review. Before VB-249 each holder's plan was reviewed every working hour, so a hoed
field was offered for sowing the next hour and a ripe field for reaping at 5:00. Now `refreshJobs` (`src/sim/jobs.js`) reviews a plan only
when `reviewWhy` (`src/sim/plans.js`) says so: its planning day (every 1, 2 or 3 days by `cadence`, at a slot hour spread by `nextSlot`
over 5:00 to 18:00), `closing` (the last sowing days and autumn's last two days), or a store's flag. Field kinds (`plow`, `sow`, `reap` in
`src/sim/kinds.js`) have no `window`, so the due-queue does not ask them; between reviews only `lookForWork` posts them, once a household
a day (`mayLook`), and only for a member that matching left idle. So hoeing to sowing, and ripening to reaping, lose up to a day even for a
daily household.

What that costs is set by the frost. A crop ripens 26 days after sowing (`ripeAfterDays`) and the frost takes every field ripe, growing
or in stooks at the end of autumn's day 10 (`fieldsDay`, `src/sim/fields.js`), so a field sown on spring day 7 or later ripens on autumn
day 9 or later and is lost unless reaped, dried a day (`dryDays`) and hauled at once; the sowing window runs to day 9. Populous 7, years 1
to 15 (a scratch probe of every autumn day): fields lost at the frost 245 at `38b920d`, 332 at `6872a55`: ripe and not reaped 60 -> 119,
still growing (sown on days 8 and 9) 35 -> 51, in stooks 150 -> 162; sown on day 7 or later 233 -> 309. The households that lose them are
the ones with a field sown late, whatever their cadence: pooled over the six seeds at `6872a55` the mean sowing day by cadence is 4.02,
4.04 and 4.06 (daily, every second, every third day) and the rows' rate 2.1%, 2.6% and 2.3% of household-years. It is the review's
granularity (a day instead of an hour), not the diligence.

The harvest's `closing` review comes too late to help: it is on autumn's days 10 and 11, and a field reaped on day 10 is still in stooks
at the frost. (That is older than VB-249; it is why stooks are the largest loss at both commits.)

The hungry household-years are those of the gap before the harvest: hungry days fall in summer and early autumn (populous 11 at
`6872a55`: spring 296, summer 1,409, autumn 1,808, winter 19), in famine years, in households with less grain at the start of the year
(populous 7: the year's opening grain 77 days of need at `38b920d`, 70.5 at `6872a55`; grain threshed in years 21 to 30 down 7%). On
populous 7 the herds also shrank (cattle and sheep at year 30: 161/180 -> 108/45; milk and meat years 21 to 30 -26%), but that is not
consistent over seeds (seeds 3, 5, 13 have more milk and meat at `6872a55`), so it is not claimed as part of the mechanism.

Trials at `6872a55` (scratch copies), rows on populous 7 and 11: every household on a daily cadence (`cadence` returns 1) 23 and 31,
sowing day 3.91 and 4.07, not enough; every plan reviewed every review hour (`reviewWhy` returns 'day') sowing day 3.62 and 3.84, the base's
again. The cadence is not the cause; the review being daily rather than hourly is.

## The proposal
**A household is reviewed out of turn, at the first review hour, on any day one of its fields is ripe, and on each day of the sowing window
while one of its fields is still to hoe or sow** (`reviewWhy`, `src/sim/plans.js`; the one new rule). The patch (trial, not committed):

```diff
--- src/sim/plans.js (tip 4ff49d4)
+++ src/sim/plans.js (trial A)
@@ -143,4 +143,14 @@
+  // A household whose field is ripe, or that has a field still to hoe or sow while the sowing window is open: its fields' window is
+  // closing on it, so it is reviewed on each such day, at the first review hour (the crop that waits for a planning day meets the frost).
+  function fieldsDue(st, plan, c) {
+    if (plan.holder.type !== 'household' || c.hour !== FIRST) return false;
+    const hh = st.households[plan.holder.id], f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
+    if (!f || f.household !== hh.id) return false;
+    const sow = c.season === 0 && c.sday <= st.ECON.sowWindow[1];
+    for (const fd of f.fields) if (fd.stage === 'ripe' || (sow && (fd.stage === 'stubble' || fd.stage === 'plowed'))) return true;
+    return false;
+  }
   function reviewWhy(st, plan, hour, c) {
     if (hour >= plan.nextReview) return 'day';
-    if (plan.last !== c.day && closing(st, c)) return 'window';
+    if (plan.last !== c.day && (closing(st, c) || fieldsDue(st, plan, c))) return 'window';
```

A variant B reviews such a household at every review hour while the condition holds (drop `c.hour !== FIRST`, and test `fieldsDue`
outside the `plan.last` guard): the old hourly behaviour, only for those days.

| Run (populous small, 30 years) | rows, seeds 3/7/11/42 (sum) | frost loss share, 3/7/11/42 | sowing day, 3/7/11/42 |
|---|---|---|---|
| `38b920d` | 141/6/12/39 (198) | 6.6/4.7/5.0/4.9% | 3.82/3.69/3.85/3.75 |
| `6872a55` | 118/46/88/65 (317) | 9.0/6.9/7.9/6.8% | 4.13/3.93/4.12/4.04 |
| `6872a55` + A | 66/13/36/70 (185) | 6.8/5.2/6.8/6.0% | 4.00/3.88/4.01/3.92 |
| `6872a55` + B | 67/6/31/30 (134) | 7.3/4.4/5.9/4.6% | 3.90/3.68/3.82/3.70 |
| tip | 0/0/0/0 | 8.2/6.9/8.5/5.8% | 4.02/3.93/4.17/3.88 |
| tip + A | 4/0/0/0 | 6.0/4.5/6.2/4.4% | 3.98/3.78/4.11/3.90 |
| tip + B | 0/0/0/0 | 6.2/4.7/6.1/4.4% | 3.78/3.60/3.92/3.75 |

Tip + A on seeds 5 and 13: frost 6.5% and 5.2% (tip 7.0%, 6.6%), 0 rows. At the tip A gives back what VB-249 lost to the frost (the
base's 4.7 to 6.6%), as B does; at `6872a55` A brings the rows back to the base's level (185 against 198), B a little below.

Cost (`node tests/counters.js`, 30 days of two tiny villages from spring, a living pawn-day; and `node tools/sim.js --scenario populous
--seed 7 --map small --years 2 --report counts`, the second year): `oppAsk` tip 8.13 / 6.57, A 8.61 / 6.98 (+6%), B 13.38 / 10.74 (+64%);
`planReview` 0.249 / 0.174, A 0.281 / 0.203, B 0.637 / 0.478. Before VB-249 `oppAsk` was 39.1 (counters), so A keeps 4.5 of VB-249's 4.8-fold
saving, B 2.9 of it. A puts `planReview` and the route counters slightly over their recorded baselines in `tests/counters.js` (planReview
+0.007, routeExpand +0.05, routeRefresh +0.006: the behaviour change), so its task re-records them. **Proposed: A**; B only if a later
measure shows the within-day wait (hoed at noon, sown the next morning) matters.

A second, older point for the same task or Kim: the harvest's `closing` days (autumn 10 and 11) are after the last day a reaped crop can
still be dried and hauled before the frost; with A they matter less, but moving them two days earlier would make them mean what they say.

## How sure
- That VB-249 is the cause of the extra crop losses and the later sowing: sure (every one of six seeds, effect several times the
  spread of an inert change; the trials that restore hourly reviews of the fields restore the losses).
- That it is the cause of the 225 -> 364 in the rows: about half of it. The rows are dominated by a few famine years and swing by a third
  on an inert change; three of six seeds have fewer rows after VB-249.
- At the tip the measure reads 0 on all ten runs (fishing), so the night's net effect on hunger is strongly positive; the lost harvests
  remain (frost losses at the tip 5.8 to 8.5% on populous, against 4.7 to 6.6% at the base), hidden by the fish, and fix A recovers them.
