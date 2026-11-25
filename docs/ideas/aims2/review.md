# Review of the generational system's plan

25 November 2026. A review of `docs/plans/generations/README.md` against Kim's decisions of 25 November (`docs/design-changelog.md`,
0.4, "a generation"; `docs/review-growth-2026-11-25.md`, sections 7 and 8), the principles of `design.md`, the job system of the arch
`plans` (`origin/claude/dreamy-allen-vhu47g`, `docs/plans/four-scales/README.md`), `docs/cost.md` and target-v2. Nothing but this file
was written. Section numbers are the plan's; line numbers are of its README.

## Verdict

The plan is a sound skeleton and should go on, after six changes. It reads as one system: the stocks, flows and loops are named, every
flow has a pawn and a verb, nothing is drawn where a pawn judges, and it sits on the plan record, the levy and the obligation record
without building a second grammar. Its measured numbers reproduce exactly. What does not yet hold is the middle of it, the road from
surplus into land and out again at the handover. Land has three worths (the custom's 120, a holder's need of several hundred, a price)
and the plan keeps the valve, the report and the goodwill booking on the first while it expects trade at the others; the price itself
is not determined by anything written; the brake named first on the main reinforcing loop (hands) is contradicted by the plan's own
measurement; and the earmark, as written, shelters a house's beasts from its siblings' shares and stops the feast it was capped to
protect. Two monument kinds give standing for meeting an aim and for years in office, against two Decided rows. As it stands a house
would more likely rise by converting everything into under-counted land than be "held back each generation", and a village would
build its whole menu of works inside a decade and then have nothing to pursue. None of this needs a new mechanism; each fix below is a
narrowing or a number.

## What was checked, and how

- The two scripts and the plan's runs 1 and 3 were run again (populous, small, seed 7; to year 20, then to year 40). Every figure of
  section 2.4 taken from them reproduces: fields p10/p50/p90 2, 3, 7 and 1, 3, 6; land Gini 0.31 and 0.31; no beast in 61 of 105 and 99
  of 156 households; lasting wealth p50 480 and p90 1,016 at year 20, Gini 0.30 then 0.31; stakes 53 (median 146) and 102 (median 82);
  obligations at year 40: 125 shares, 80 loans, 144 days, 24 wages; rank ρ 0.27 (79 farms), −0.10 (28), 0.52 (18). Grain a field
  reaped by decade and class: 100.8, 106.2, 108.1 and 79.4, 94.4, 99.7, as stated.
- Run 2 was not run again; a copy of its output from the plan's own session was read. Field work a household-year: 2 fields 159 hours,
  4 fields 352 hours (80 and 88 a field, as stated).
- One further read of the year-40 save, for finding 8: the open share obligations.
- Not checked: anything on medium, any other seed, the levy (not built), cost.

Two things the table of 2.4 leaves out and the reader should see: between year 20 and year 40 the median household's lasting wealth
**falls** from 480 to 390 and its p90 from 1,016 to 810 (households grow from 105 to 156 on the same land), so the baseline a house
"rises" against is a falling one; and the year in which the hours were measured is one with 47 hungry household-days.

## Findings

### Blocking

**1. The earmark shelters more than Kim decided, and it stops the feast (3.1, lines 304 to 313; 2.5, year 2).**
Kim's row (Vision and scope, Ambitions) names three readings that leave a reserve alone: the feast, the gift's allowance and a
lender's spare. The plan adds "a share paid in animals, a dowry, a deal at the gathering" (line 308). So an heir who takes "a farm to
hand on" and reserves his beasts holds them back from his siblings' shares, and a father's reserve holds a cow back from his
daughter's dowry: the aim outranks the two payouts that A generation names as the brake. Nothing in Kim's decision puts a wish before
an obligation. Second, the cap does not do what line 311 says. The reserve is taken from the spare above the floor (seed and 20 days),
and the feast's threshold (seed and 2 years of need, `FEAST.above`) then subtracts it. With grain at 2.2 years of need and half the
spare reserved, 0.9 of a year is held back and 1.3 years remain: no feast. A holder who reserves half feasts only above about 3.6 years
of need, one who reserves three quarters above about 6.7; today it is 2. Year 2 of the story (line 219: "his reserve takes half the
spare; the rest is the harvest home") is therefore not what 3.1 does, and prediction 7 (feasts fall by at most a fifth) cannot hold
for the holders who save, which is most holders with children. Third, the floor: `floorOf` is `reserved(grain)` plus 20 days
(`sim/hunger`), and it is read to excuse a household from owed days (`sim/days`: "its household is below its floor") and to decide who
asks for help. A reserve added there lets a household with grain in the store ask and be excused.
*Why:* Kim's decision 2; Hunger presses, the feast binds; the valve of 3.H.
*Fix:* (a) the reserve is subtracted only by the three discretionary readings Kim named; an obligation due (a share, a dowry agreed, a
price, a loan) is paid before it, and paying it is not "breaking the earmark"; (b) the reserve is taken from grain above the feast's
threshold first, or the feast reads the store whole to decide and lays out from the unreserved part, so plenty still feasts; state
which, with the arithmetic; (c) the aim's reservation is a reason of its own that `floorOf` does not count: a floor is what a
household must keep, not what it would like to.

**2. Land has three worths, and question 1's answer hides what follows from keeping them apart (3.0, 3.6, 3.H; question 1).**
The plan's "one reckoning of lasting wealth" values a field at the custom's 120. Its own market values the same field to its holder at
the net yield times a horizon of 10 to 20 years, "several hundred rations" (line 554), and its story sells one at 220. Three
consequences are not told to Kim. (a) The valve under-counts land by two to five times while it counts beasts, grain and claims at
their worth: a house that turns every surplus into land pays shares on a fraction of it, so the favoured store of value is the one
the handover sees least. That is the run-away the report is meant to catch, built in. (b) The barter row is Decided (The fair, A
barter economy, 10 November): "customary worth says what the deal was worth, and the residual is booked as goodwill between the two
who dealt". The plan says a land deal is "the exchange that exists". Then a field bought at 220 against a custom of 120 books 100
rations of goodwill to the buyer's credit, several times a year's good-year gift, at every purchase; and prediction 5 expects prices
above the custom as the normal case. The rich buyer becomes the village's great giver by buying. (c) The report measures persistence
and the spread on the 120, so it cannot see a house rising by land bought dear. The plan's road out, "until norms learn from deals
(target-v2, 5.3)", is not designed or built anywhere.
*Why:* One quantity, one reckoning; Kim's row Land's worth ("years of what it yields its holder above the work it takes": the plan
measured 1.5 to 2 years and proposes to leave it there); the Decided booking.
*Fix:* give land's customary worth one source that follows what happens: a number a village, the running middle of its witnessed
sales (the public act already gathers them; one write a sale, no loop), starting at 120, read by shares, by `Wealth.lasting`, by the
hard bargain and by the booking. Shares then grow with what land is worth, and question 2 (the heir takes the farm at a part) becomes
the real setpoint it is offered as. If Kim prefers the 120 to stand, say in question 1 that the valve then counts land at a part of
its worth, and say what a land deal books. Either way the report gives land at both the custom's worth and the prices paid.

**3. Nothing in 3.6 says what the price is, so "dear by mechanism" is not yet delivered (3.6, lines 543 to 569).**
"A deal passes when both sides gain by need" gives a range, not a price: between the seller's need of the field and the buyer's. For
the supply the plan leans on most, a field a household would let go to waste, the seller's need is close to nothing (it was about to
abandon it), and the buyer's is up to 20 years of yield. The offer is "one offer answered once", to "the households of its village,
nearest first" (line 567): the first household asked that gains takes it, at whatever the one who proposed named. With one buyer at a
time and no rule for the asking, fields that follow hands go for almost nothing, and the 220 and the 80 of the story are not derived
from anything. "Nearest first" is also an order the simulation imposes where a seller's judgement belongs. While free land is in
reach the plan itself bounds a buyer's need by the hours of clearing (line 559), so in an open village the story's 220 contradicts
3.6, and prediction 5 ("near the custom's worth before") has no ground: the bound is the clearing, whatever that is in rations.
*Why:* Kim's decision 4 and the row Land is bartered and sold (dear, by mechanism); Mechanisms, not prescriptions; A judgement is never
a die (nor an order of asking).
*Fix:* say who names the price and how. The simplest that fits what exists: the seller asks at the meeting (the public act is already
there), every holder present may answer with what it would give, and the seller takes the answer worth most to it by its own need, if
any passes its own; between meetings, before the alderman, there is one buyer and the kin's right of redemption is the price of the
haste. State the clearing of a field in hours and rations beside the 120, and say in the story whether Ås is full.

**4. Two monument kinds break Decided rows: an aim met, and years in office (3.5, lines 524 to 533; 3.H, point 6).**
`Monument.kind` includes `'aim'` ("an aim met of a house's kind") and `'office'`. The first makes an aim grant standing. The Ambitions
row is Decided since 3 November: "Read from the state and the record of events; they grant nothing", and the plan repeats it (line
403). Worse, the played pawn "chooses its aims and targets on its sheet" (line 462): a target set low is met, and the farm gains a term
of standing for a generation. The second carries the office across the handover by another door: years in office become a term of the
farm's name, read as standing by the next holder, and standing "wins the election" (Roads to the elite, By office). A generation is
Decided: "Standing, goodwill and skill keep their decay, and the office stays a life's: an heir follows only where a village's
practice of choosing says so"; The alderman: "office goodwill never passes". A half-life of 25 years on a stock whose design brake is
4 years is the lengthening the review itself declined ("the fix is a hard stock to convert into, not a slower decay"). The memorial
stone's row also keeps its term "under one cap with the well-kept house"; the generalised sum (up to 8 terms, sizes unnamed) does not
say the cap stands.
*Why:* the two Decided rows; An elite is what the rules leave over; parity (a gain only a controller who sets its own targets can farm).
*Fix:* a monument is a thing in the world that someone made or paid for: the stone, a work credited, a masterwork. Drop `'aim'` and
`'office'`. Keep one cap over the farm's name and the well-kept house, and give each kind's size. Loop "A house's name" then has a
brake that is not only its own fading.

**5. The brake named first on "Land begets land" is not shown, and the plan's own hours argue against it (2.3, line 137; 1, line 81; 3.6, line 590).**
"Hands (a field takes 60 to 90 hours a year, *measured*)" is offered as the fast brake, and By land bought would gain it in
`design.md`. A working adult has 576 working hours a year (48 days of 12); under the levy about 470. The measurement the plan cites
shows a household of 4 fields spending 149 of its 340 hands' hours on its fields in spring, its busiest season, and standing idle 36%
of them; 2 fields, 74 of 288 and 52% idle. By the idle hours of its busiest season alone a household could work
nearly twice to three times the fields it has. What holds fields
down today is a rule the plan does not mention: `FIELDS.perHand` (2 fields a working adult) and `FIELDS.want` (1.1 years of rations),
the head's count of what it wants. An aim for more land overrides the second; the plan does not say whether the first stays. And a
buyer who lets the field needs no hands at all. Target-v2 6.2 asks that a reinforcing loop faster than its opposers be given its
ceiling: here the loop runs in a few good years and the opposers named run in a year (kin, for inherited land sold in haste only) and a
generation (shares, under-counted by finding 2).
*Why:* target-v2, 6.1 and 6.2; the measurement of 2.4; Parameters, not patches (a brake must be a named thing).
*Fix:* name the ceiling that binds and measure it: either the windowed peak (a field's hours inside its sowing and harvest windows
against the levy's hours in those days, which run 2 already reports) or `FIELDS.perHand` kept as the head's estimate of what its hands
can till, said so; and for land let, the supply of tenants (landless couples a village) and of sellers. Put that, not "hands", in the
row for By land bought.

**6. A work at risk is answered by a pawn who is not the village's agent, and its levy has no end (3.4, lines 482 to 492).**
In the four-scales grammar a body's plan is written through its agent, the meeting decides and the alderman carries out by `levy`
(3.6: "The meeting is a body that decides; pawns act on it"), and a step at risk asks its author. The plan asks **the proposer**
"(extend, cut the work, or let it go to the meeting to drop)". A holder who is not alderman thereby moves a step of the village's year
plan and, since the work is "paid by a levy each year until done", lengthens a levy on every household without a vote. The story votes
"3 days a farm a year for 2 years"; the mechanism votes no term.
*Why:* Every act is a pawn's (a meeting's decision is carried out by its alderman); the plan record's authorship; the payers' pull is
the brake of this loop and is bypassed.
*Fix:* the meeting votes a work with its days a year and its years; the step on the village's plan is authored by the meeting's
decision and the alderman is asked when it is at risk; more days or more years are a new proposal (the proposer's, or anyone's) and a
new vote; unanswered, the levy ends at its voted term and the work stands as far as it got (its progress is in the world).

### Advisory

**7. Hours given are booked as goodwill by a row that does not say so (3.2, lines 346 to 350; 2.2).**
"Hours a member gives, and hours a head demands, are booked as goodwill the head owes the member (the arch `plans`, What a breach
costs)". The Decided row books hours **demanded** (owed by the head) and hours **taken** (owed by the member); hours given are kept as
a tally for the card. The portion earned, the plan's answer to "what does a diligent son get", rests on the extension. It is a
reasonable one (a gift of work books as a gift of grain does), but it moves a Decided row of the same day and makes diligence earn a
claim. *Fix:* state it as Proposed, add it to the questions, and give the unit (the row has "a day's work"; the worth table's 3
rations).

**8. The valve already backs up, and the plan widens what is owed without saying what pays it (3.H; 2.4).**
In the year-40 save, 125 share obligations are open, owed by 35 of 156 farms: 7,517 rations owed, 688 delivered; the median owing farm
owes about 200 against a median lasting wealth of 390; half are 3 years old or more, a tenth 14 or more, the oldest 24. (One seed, one
save, open shares only: those paid in full are not in it.) Shares are paid "from grain above the reserve, then in beasts"; 99 of 156
households keep no beast. There is no term and no remedy, so a share unpaid is never a case and never moves a field. The handover is
then less a transfer to the younger children than a debt that stands; counting more wealth raises the debt, not the paying. Two things
follow. The heir's `Lasting.claims` is negative by most of the farm's worth for years, so the persistence measure depends entirely on
whether wealth is read gross or net and on which side of the handover "the handover's snapshot" falls: neither is said. And "a house
falls in one generation" has no path through shares: the farm keeps every field. *Fix:* report shares owed, paid and their age in the
report from step 1; define persistence on both gross holdings and net wealth, snapshot before the shares are booked; say whether a
share long overdue is a debt like any (overdue, a case, its remedy by "Debts are paid with"), as a `price` is in 3.6: one mechanism,
and it is what lets land leave a house that cannot pay.

**9. The dowry's base changes without a word (3.0, line 256; 2.5, year 12).**
Built (`sim/terms`, `shareOf`): a dowry is `TERMS.dowryShare` of the bride's share of the **estate** (fields and grain). The plan reads
it from `movable` only. Beasts are a tenth of lasting wealth (*measured*), so the dowry of a landed house shrinks to a fraction, where
A generation names "a daughter's dowry" beside the shares as what holds a house back. *Fix:* keep the dowry as a share of her share of
all lasting wealth, paid in movables as today; or say the change and why.

**10. What saves, in the first decades (3.1; 2.4).**
The stores offered are land, beasts, claims and things of worth. Things of worth wait for slice 6b. Longer loans are refused ("a
loan's term stays one harvest"), though the review's priority 1 listed them. Land is cheap and the market thin while clearing is open,
by the plan's own bound. That leaves beasts, and 58 to 63% of households keep none; the plan reports it and does not ask why. If hay or
meadow is what stops them, the herd as a store is closed to most houses and an aim that saves has only grain that rots in two years.
*Fix:* find what keeps a household without a beast (a read of the save: meadow tiles, hay, the stint) before the earmark is built; if
it is hay, say which store a house of 3 fields and no meadow has, or bring forward one that keeps (cloth, target-v2 5.6; a first thing
of worth of place, the review's suggestion).

**11. The works on the menu are too small to span years, and the menu runs out (3.4; 2.5).**
The mill is 100 hours by water (Decided). A lot of 4 days a farm (`WORKS.lot`) is 32 hours: eight farms give 256 hours a year, three
give 96. A mill is one year's levy; the story's bridge (48 days) is a year and a half. Only the goods (millstones, iron) can make a
work last years, and the yearly-levy, at-risk and `WORKS.abandon` machinery is built for a span the works do not have. With six or
seven works on the menu and one proposal a holder a year, a village whose estimates pass builds them all in its first decade;
prediction 9 (one to three a generation) then fails upward, and for the rest of the twenty years the village pursues nothing. Also not
said: what a household of one adult bears when a work's 4 days come on top of the keep's 4 and the routines' lots (the four-scales
mocks: such a household loses a quarter to four fifths of its sowing to three badly placed days). *Fix:* a table of the works with
hours, goods and the saving a year each by the reckoning proposed, for a village of 3, 8 and 15 farms; then either works that are
large (the church, a stretch of way a year, a meadow drained in stages, upkeep that grows) or the honest statement that a work is a
year's effort and the twenty-year agenda is their sequence and their upkeep. Give the sum of a household's outer days a year.

**12. Counts where a judgement belongs (3.3, lines 420, 434, 448; 3.4, lines 478, 511).**
The plan answers VB-1472 with "no count" for projects and is right to. It then caps aims at `AIMS.held` (2), drops an aim "at risk a
second time running", sends a work to the meeting after `WORKS.abandon` (2 years) and allows "one proposal a holder a year". A wait is
the thing waited for says a pawn's yes or no is "never a count of years"; Mechanisms, not prescriptions keeps hard limits for physical
facts. *Fix:* an aim is dropped when its holder's estimate, at its upper end, no longer reaches the least target it would still hold
(the same threshold `AIMS.least` that took it); aims are limited as projects are, by the own hours and the reserve they compete for,
and `AIMS.held` stays only as a declared cap of a per-pawn collection (Rules for cost 2), high enough never to decide; the meeting's
agenda already limits proposals.

**13. Aims and their reservations at the handover (3.3, lines 399 to 400; 3.H, point 4).**
A holder's aim is a step of its own plan that reserves the **household's** goods and is the `why` of steps on the **household's**
plan. At the handover "aims of a house's kind lapse". Nothing is left to no one asks what becomes of each thing in its keeping: the
reservation in the household's store, the open project steps whose `why` is now nobody's, the aims a retired holder keeps (the
children placed, with his son's grain reserved for it?). The `why` also points from the household's plan down to a member's, where the
record's `why` is "the one link upward". *Fix:* say the process: at the handover each of the old holder's aims that reserves household
goods or is a `why` of household steps is offered to the new head as a decision point (take it as its own, with the old target, or let
it go); let go, its reservation is released and its projects are at risk like any unauthored step. That also does the work of
`AIMS.heirloom` without a special weight.

**14. The kin's right: its default, the buyer's risk, and the origins (3.6, lines 571 to 578, 596 to 599; 2.5; question 4).**
(a) The default is "the offer to kin" in 3.6, "an offer with redemption" in 2.5, and question 4 proposes redemption for every quick
sale: one of the three is wrong. (b) Redemption is "at the price paid". A buyer in a dearth pays in grain at up to three times its
worth to him and is repaid, within a year and a day, in grain at one; he has sown the field meanwhile. What can be undone costs
something to undo: the redeemer should pay the price and what the buyer put into the land (seed, the season's hours at the worth
table), and the buyer's answer must weigh the chance of redemption, or no one buys in haste and prediction 4 (a dearth triples sales)
fails. (c) The text lists four origins, the type three; land its holder cleared himself is merged with land his line cleared, so the
plan does not say whether the right binds it (in the sources it is acquired land, free). Foreclosed land's standing under the right is
not said. (d) `st.titles` exists (`sim/ownership`: holdings split off or let, with owner, user, rent); the `Title` sketched is a
different record under the same name. Add fields to the one that exists.

**15. Cost: the cadence of an aim's progress, and what is missing from the table (4; 3.3, line 429).**
"Each review the holder's estimate reckons the measure at `by`" against the table's "about 200 households × a few reads a year". The
head's review runs about 0.7 times a household-day (four-scales, 3.8): 200 × 0.7 × 2 aims is some 280 reckonings of lasting wealth a
game day, each walking a herd's head and the household's obligations, not a few a year. It is still small, but it is not what is
claimed, and the same function is called per voice in a vote (up to 60 voices × each proposal) and per household asked in a land offer.
*Fix:* an aim's progress is reckoned at the season's first review (800 a year) and when a deal or a handover changes it; name the
vote's work (voices × proposals × one estimate) and the kin search of a land offer in the table. The `Lasting` snapshot on the
handover's event is fine. Titles: "a few hundred records" holds only while absence means the line's own land; say so in the type.

**16. Smaller points of fit with the four-scales grammar.**
(a) The plan says the job system is "merged into main as PR #325". It is on `origin/main`, but this branch is not built on it (no
`docs/plans/four-scales/` here), and Kim's answers 20 and 21 are two commits on the branch that main does not have. (b) `AimStep` adds
`what.target`, `what.of`, `gap` and `reserve` to `PlanStep`: list them as changes to the one record, as the arch's design pass will
want them, not as a type of this plan's. (c) The herd's target is set by "the verb `target`" (line 323); the arch replaces `target`
with `plan`. (d) `plan.reserved` is the household's standing plan's, by good, with grain by crop; a pawn's plan reserving in its stake
lots, and a village plan reserving for a work, are new uses and should be named as such. (e) The alderman "spends a work's reservation
of the village store on help" (line 317): a second act on a reserve the meeting voted; it wants the meeting, or to be said.

**17. Special cases where one mechanism would do.**
The bell "brings no saving; its case is its proposer's standing and the village's piety" (line 476): a second way of judging a work.
One will do: each voice weighs what the work is worth to its household by its own estimate, in which piety values a bell as hunger
values a mill. A servant's stake at death goes "to its birth household's heir if living, else its master's household" (line 363),
beside an order for everyone else (spouse, children, the household), where Kim's row says the stake passes "as its household's
inheritance custom passes a share": use the succession order that exists for both. Aims "of a house's kind" are a class with their
own rule at the handover and their own heirloom weight (finding 13 removes it).

**18. Gaps a twenty-year arc needs.**
- *Whole farms.* The Vision's first ambition is "hold three farms", mapped to "a farm to hand on, target in farms". 3.6 sells fields
  and meadows. Succession is Decided: "farms are not combined while someone else can take them ... so no household holds two farms".
  Say whether a farm (its house and yard) can be bought, and how that sits with the row; sale with `stay` covers only the seller who
  remains.
- *A meadow's worth.* `Culture.norm('worth', 'meadow')` is read; no number exists (shares count fields only today).
- *Grain in the estate.* "Grain only above the reserve, at half its worth, as today": today `estateWorth` counts all the grain at
  half and the reserve limits only what is paid. Say which is meant.
- *Why a holder sells.* The Proposed row lists "the means to marry, and its class by land". The plan drops both; dropping class is
  right (A label is read, never a switch) and should be said, since the row will be rewritten.
- *The own-hours road in numbers.* 54 kept hours a year are about 20 rations at the worth table's day; a stake of grain that rots a
  fifth a year tops out near 100. If the provisions are the 84 of the page's example, own hours alone reach them in about eight years
  and barely. That may be the intended answer (the head's gift is what makes the road), but it should be stated, with `TEACH` and the
  skill's rate beside it.
- *Two worked falls.* The story shows a rise. B is "rise over two or three generations and lose it in one": the plan should walk one
  house down, naming the acts (finding 8 says shares alone cannot do it).

**19. The questions for Kim.**
The ten are the right kind, and 7 is rightly marked as moving a Decided row. Missing, and Kim's to answer: whether an aim's reserve
stands before a share or a dowry (finding 1); what a land deal books against the custom's worth and what the valve counts land at
(finding 2, which changes question 1's proposed answer from "keep 120" to "keep 120 and know that it under-counts", or to a worth that
follows sales); whether hours given earn goodwill (finding 7); whether a share overdue becomes a debt with a remedy (finding 8); the
dowry's base (finding 9); the mill as a facility let for a share of its tolls, which is new beside the Decided toll. Question 3's
proposed answer follows from Who owes. Question 4 should offer the three forms and name the default once. Question 10's default
("every person") is a custom and may prescribe; it follows.

### Preference

**20.** Prediction 1 gives 0.4 to 0.6 as a band with refutation at 0.3 and 0.7. Kim's row reports persistence "with no target", and the
review calls its ranges "a scale for the report, not targets". Word it as what the design expects and what Kim would be shown, so no
later task tunes toward it. Its interval on 18 pairs is ±0.4, as the plan says; three seeds to year 150 give about 12 handovers a
village, so report by island, not "by village and by culture", until the numbers bear it.

**21.** The story of 2.5 should be re-run through the rules after the fixes: year 2 (finding 1), year 4's price (finding 3), year 8's
redemption (finding 14), and years 18 to 26, where Erik's farm by the plan's own reckoning is worth 810 less 540 owed, a third of his
father's and below the village's median, not "near his father's rank".

**22.** Four new modules (`sim/wealth`, `sim/repute`, `sim/landsale`, `sim/works`) for four concerns is fair; `sim/repute` could be
part of where standing's terms are declared already, since after finding 4 it holds three kinds.

## What is strong and should be kept

- **The system view** (2.1 to 2.3): stocks with their owner modules, each flow with its actor and verb, each loop with a brake and
  both timescales. It is the form target-v2 6.1 asks for and the first document here that shows the handover as one valve.
- **Nothing is drawn.** Every yes or no in the plan is a threshold on what a pawn weighs by its own estimate; chance is left to
  harvest, breeding, rot and death. No rule reads class or any other label.
- **Parity holds throughout.** Aims, stakes, the earmark, `propose`, `offer` on land and `redeem` are verbs of any pawn; the player
  gets nothing an unplayed pawn lacks, but the target-setting of finding 4.
- **It builds on the grammar and not beside it**: aims as year steps with `by`, at risk as the decision point, works as outer levies
  on the obligation record with the ladder and commutation, the craft in kept hours with `Goal.owner`.
- **The report first** (3.0, step 1), with the handover's snapshot on an event that exists, and predictions written so that they can
  fail (section 5). Grounding the plan in a run and saying how weak 18 pairs are is the right habit.
- **The stake's custody** (3.2): lots with a place, a back load carried on the move, the rest fetched, rot as the village store's.
  It removes a teleport found while grounding and settles VB-1476.
- **VB-1472's answer**: no count; hours and goods by the head's estimate against the season's budget; the settler's cottage and the
  stone foundation as steps like any other.
- **Land follows hands**, and fields a household would let go offered first: a levelling flow drawn from the family cycle, and the
  one supply of land that needs no hunger.
- **The kin's right placed where fire-sales happen**, with bought land free in its buyer's hands and inherited in his heir's: a brake
  with a year's lag on the fast loop, which is what that loop lacks.
- **Learning beside a master** as a contribution to a declared rule with no pair searched, and the mill as a pawn's proposal in place
  of a rule of the simulation.

## Response (designer, 25 November)

One line a finding; section numbers are the revised README's. Kim's decisions of 25 November were not in conflict with any finding.

1. Mended (3.1): the reserve is read only by the three readings Kim named; obligations (a share, a dowry, a price, a loan, the keep, a commuted day) are paid first; the feast decides on the store whole and lays out from the unreserved part, with the arithmetic; the aim's reservation carries a reason `floorOf` leaves out. Question 4; story year 2.
2. Mended (3.6, "Land's worth"; 3.0; 3.H): a village's worth of land is the median of its last 8 witnessed sales, from 120, read by shares, lasting wealth, the dowry, the hard bargain, a deal's goodwill and the remedy; the report shows prices against both. Question 1 rewritten to say what keeping 120 would mean.
3. Mended (3.6, "How the price is found"): the seller offers at the meeting, every holder present bids its need × `LAND.bid`, the seller takes the best bid above its own need, kin may take inherited land at it; a quick sale has one buyer, discounted by the redemption risked; "nearest first" removed; clearing measured from the rules (40 to 90 hours, 15 to 35 rations) and stated beside the 120; Ås stated full (2.5); prediction 5 rewritten.
4. Mended (3.5): monuments are the stone, a work credited and a masterwork; `'aim'` and `'office'` dropped; one cap (`REPUTE.cap` 0.25 with the well-kept house) and each kind's size given. The 25-year fade is kept as the memorial stone's own Proposed "fading over a generation", applied only to things made; question 12.
5. Mended (2.3, 3.6 "By land bought", section 1 table): "hands" withdrawn as the brake; the ceiling named is `FIELDS.perHand` held as the head's estimate, re-derived from the windowed peak in step 4; land let is bounded by tenants; an aim raises `FIELDS.want`, never `perHand`; the idle shares of run 2 added to 2.4.
6. Mended (3.4, points 2, 4, 5): the meeting votes days a farm a year and years; the step is the meeting's decision carried by the alderman, who is asked at risk; more is a new proposal and vote; unanswered, the levy ends at its term and the work stands as far as it got.
7. Mended (3.2, "A portion earned"): stated as Proposed, extending the arch's booking; unit the worth table's 3 rations for 8 hours (as `GOODWILL` books help today); question 6.
8. Mended (3.H point 3; 3.0; 2.4; 2.5 "A fall"): a share unpaid `SHARES.term` (6) years becomes a debt with the case and the remedy; the report gives shares owed, paid and their age; persistence on gross and net, snapshot before the shares are booked; the open-shares read added to 2.4; question 5; prediction 6.
9. Mended (3.0; 2.2; 3.H): the dowry stays a share of the bride's share of the estate, the estate now its lasting wealth, paid in movables; question 13.
10. Mended (2.4; 3.1): a read of the year-40 save: households without beasts have a median of 2 meadow tiles and no hay (6 and hay with beasts), 70% never had a herd; meadow made and cloth (which keeps) named as the beastless house's first stores; longer loans declined with the reason (land's `price` is the long claim needed).
11. Mended (3.4, "What works cost" and "A household's outer days"): a table of works with hours, goods and years of levy at 3, 8 and 15 farms; stated that a work is a year's effort or less, bounded by goods, and the agenda is sequence, upkeep and long ways; outer days 8 to 16 a farm a year; prediction 9 rewritten.
12. Mended (3.3, 3.4): `AIMS.held` (4) kept only as a declared cap that does not decide; an aim is let go when its estimate falls below the least target its holder would hold; `WORKS.abandon` removed (the voted term ends a levy); one-proposal-a-year removed (the meeting's agenda limits).
13. Mended (3.3, "Whose plan holds it", "At the handover"): household aims are steps of the household's plan, so `why` points upward; at the handover each is the new head's decision point, let go releases its reservation; `AIMS.heirloom` removed.
14. Mended (3.6, "The kin's right"; 2.5; question 3): (a) three forms, "the offer and redemption" the default, said once; (b) redemption pays the price and what was put into a standing crop, and a buyer in haste discounts its bid where kin could redeem; (c) inherited against acquired (bought, cleared by its holder, foreclosed), four origins in the type; (d) fields added to the existing `st.titles`.
15. Mended (4; 3.3): progress at the season's first review and on a change; the vote's work and the kin search named in the table.
16. Mended: (a) intro corrected; (b) the four changes to `PlanStep` tabled (3.3); (c) the verb `plan` (3.1); (d) the stake's and the village's reservations named as new uses (3.1); (e) a work's reservation released only by the meeting, an alderman's spending it a breach (3.1).
17. Mended: one judgement for every work, piety valuing a bell (3.4); the stake at death by the succession order for everyone (3.2); no class of "house" aims with a rule of their own (3.3).
18. Mended: whole farms (3.6, question 9); a meadow at half a field's worth (3.0, 3.6); grain counted all at half as today (3.0); "the means to marry" carried by the child's rung term and class dropped, said (section 1 table); the own-hours road in numbers (3.2); a fall walked (2.5).
19. Mended (6): questions added for the reserve before obligations, the worth of land and its booking, hours given, a share come due, the dowry's base, the mill's let; question 4 offers the three forms; the old questions 3 (personal debt) and 10 (the commons) noted as following from existing rows.
20. Taken (5, 3.0): expectations worded as what the design leads one to expect, no target; reported for the island.
21. Taken (2.5): the story re-run through the revised rules (year 2's feast, year 4's bids, year 8's quick sale and redemption, years 18 to 24 on gross and net).
22. Taken (3.5, 2.1): monuments live in `sim/house`, beside the well-kept house's term; no `sim/repute`.
