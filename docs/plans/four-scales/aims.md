# Aims and personal goods: plans at the year and beyond, and what a pawn owns

25 November 2026, revised the same day after a review (`aims.md` v2). A design pass on Kim's answer 21 (`README.md` in this folder,
section 6): long-term plans and aims are designed into the four-scales model, so that a pawn may work towards being a potter and a
head may plan a new house for his second child, and **personal goods are pulled forward from slice 8** into the arch `plans`. It stands
on `README.md` (3.1, 3.3, 3.4, 3.6; section 6 governs), on `design.md` section 7 and on the code as it is. All of it is **Proposed**
but Kim's two decisions (aims designed in; personal goods pulled forward); the points that revise a Decided mechanism or give the
player a new act are Kim's, in `QUESTIONS.md` (12). `design.md` carries it at its own density (section 7, Aims and personal goods).
Type sketches are shape and ownership, not code. *Reckoned* marks arithmetic on the design's values, not a measurement.

**Set aside, 25 November (Kim):** its tasks (VB-1781 to VB-1798) were taken out of the backlog and kept in `docs/ideas/aims/`, with
the questions of section 12 and the tuning entries; the design stands as written, and nothing builds it yet.

---

## 1. In short

- **An aim is a year step of the plan record** whose goal is a state the world can show (a pawn lives by a craft; a member has a
  house to marry into), with a `by`, an author and a measure. It opens no task: at its holder's season review it writes the season's
  steps under it. Hours are counted at the season and the day, never at the aim. Three kinds: `craft`, `home`, `portion`.
- **A pawn's aim runs in its own hours and store; a household's in its labour budget and stores.** The levy couples them; a member's
  aim and its head's plan for it meet through the levy's acts and the wish's rungs, nothing new.
- **The holder chooses**: a threshold on what it weighs at fixed decision points, never a draw; any controller uses the verb `aim`.
- **Progress is read from the world; when it will be done is the holder's estimate.** At risk: dropped, scaled down or postponed in
  that order by its own weighing; it names what it waits for; no count of years ends it.
- **Personal goods** are the stake widened: title to what a pawn makes or earns in its own hours from material it may take, in a store
  that lies where it sleeps and moves only with it. The head pair holds none; at death it passes by custom; the household's share is a
  custom; more is a breach.
- **The craft is bound by buyers, not hours** (7). The lever is a mechanism already designed and not built, **make or buy by the
  head's estimate**, with clay's scarcity (measured first) as Place; the pot's worth is a parameter for Kim's run; cloth, a craft whose
  hours bind, gets a task. Skill already grows (VB-360).
- **The road stops** at a maker household on a plot whose plan carries the craft's target for exchange; its food sized by the craft is
  slice 9's (VB-768); the town is slice 9's. Slice 8 keeps silver and personal debts. Cost under 0.3 ms a game day (*reckoned*).

---

## 2. What the code already holds

| Found | What it means here |
| --- | --- |
| `sim/skills` holds **crafts learnt by doing** (VB-360, done 22 Nov), `pottery` among them: `practise`, a level 0 to 1 in closed form, half at 400 hours at aptitude 1, a tenth lost a year unused, `grownBy` as its estimate. What does not grow is VB-475's stand-in for the **types of work** | The potter's skill grows today; design.md's "waits for skill that grows" was out of date |
| `sim/workmanship` (VB-761) grades a piece by its maker's skill and gives a household's making to its most skilled hand; `expectedWorth` is the head's estimate of its own hand's piece. Pots are VB-366 (ready, not built): `fire` at home, 4 hours, a load of clay and one of wood, 4 pots, while under `POTS.want` (8) | Pots are graded with no new rule. The road waits for VB-366; `sim/pot` exists (the cook's pot), so VB-366's module is named `sim/pottery` |
| The pawn is a `sim/stores` holder: `pawn.stake`, grain, paid by the servant's wage (VB-637), counted in the means and a party's provisions, poured into a new household at its founding | Personal goods are this store widened; the servant's portion is its grain |
| `sim/aims` is the **head's project menu** (field, meadow, farm for the heir, barn, trial), run "only for a holder with a surplus and no project"; `heirFarm` builds a plot and cottage for a member of 18 with no place, "beside any other project" (VB-1668) | Renamed `sim/projectmenu` (VB-1781). The farm for the heir becomes the means of the aim `home` |
| `sim/wishes`: a wish is a ranking of seven rungs (heir, match, farm, plot, party, service, stay) with two switches (ambition ranks new land above a plot; hunger declines a match); `service` ranks above `stay` | An aim acts on the wish only as two more switches of this kind (3.6) |
| `sim/fair`: a household's one dealer swaps by need (`needValue`, a rule of the registry), its floor and the keeping goods | A pawn needs its own accept rule, and a household a need of pots (5.5) |

---

## 3. Aims

### 3.1 What an aim is

```ts
// An aim: a PlanStep in plan.year (st.plans: owner sim/plans for the record, sim/aims for its rules), with what: {aim}.
type AimKind = 'craft' | 'home' | 'portion';
type AimStep = PlanStep & {                        // PlanStep (README 3.4): id, from, by, who, why, left, author, kept, state
  what: { aim: { kind: AimKind; for: PawnId; args: { craft?: Craft; plot?: PlotId; n?: number } } };
  since: Day; by: Day;                             // formed; meant done by (at forming, its own estimate's hi)
  waits: 'hours' | 'material' | 'site' | 'skill' | 'buyers' | 'budget' | 'yes' | null;   // what it lacks now, for the card
  tally: { hours: number; worth: number; last: [number, number] };   // this season's, folded into last at the season's end
};
type AimRule = {                                   // a kind, declared at load by the module whose state its work changes
  holders: ('pawn' | 'household')[];
  why(st, holder: BodyRef, forId: PawnId, args): string | null;     // the verb's check: position and possibility, never need
  measure(st, aim): { have: number; need: number; unit: string };    // read from the world now; nothing stored
  estimate(st, aim, judge: PawnId): { lo: Day; mid: Day; hi: Day } | null;   // the judge's, by the doing's reckoning
  season(st, aim, spare: number): StepDraft[];     // this season's steps under it, sized to the spare
  weigh(st, holder, forId): number;                // the default author's score: forms at AIM[kind].form, kept above .keep
  lesser?(st, aim): AimArgs | null;                // a lesser form (a portion's lower n; a cottage on bare ground)
  ends(st, aim, how): void;                        // what it holds passes on (Nothing is left to no one)
};
```

`sim/aims` is the registry and the review and holds no kind's rule, as `sim/makings` is a registry. The kind's `why` checks position
and possibility only (a member of the household; no place held); need is a weight of the default author, so a controller may plan
what the rule would not.

### 3.2 Who holds one, and the kinds

A **pawn** holds aims of its own while it has own hours: a levied member (a son, a daughter, other kin, a servant) or an adult of no
household. **The head pair holds none**: they are not levied and the household's plan is theirs. A **household** holds aims through
its head, for itself or for a member. A village's aims wait for their slices.

| Kind | Holder, for | Its measure | Ends |
| --- | --- | --- | --- |
| `craft` | a pawn, itself | worth got from others for its makings in the last year against its need (48 rations), read against `AIM.craft.lives` (0.5) | **a standing state, not a finish**: held while the pawn holds pawn aims; reaching `lives` changes its card and its wish (3.6), not its state, and its steps go on. It ends *done* when its holder founds or joins a household as its head pair at or above `lives` (the craft passes to the household, 8.3), *failed* below it, or *dropped* by its weighing |
| `home` | a household, a member | a plot staked and cleared and a cottage roofed, held for the member (`intended`) | done when the plot is the member's at the round; failed when the member can no longer take it (married onto another holding, holds a farm or a plot, dead); then the head may `revise` its `for` to another member, else the plot goes to the village as an unclaimed plot does today |
| `portion` | a household, a member | worth given into the member's store, against `n` | done at `n` or when the member leaves; failed at its death |

The fourth kind of the first draft, `trade` (a head backing a member's craft), is no aim: its holder cannot advance it and its goal is
another's. It is a standing grant (VB-1763) whose `why` names the member's aim, and the material given (4.3).

### 3.3 How an aim becomes work

| Horizon | What the aim puts there | Written by, when |
| --- | --- | --- |
| Year and beyond | the aim: goal, `by`, state, what it waits for | its author, at a decision point (3.5); reviewed each season |
| Season | steps with `why` the aim: a target (a pawn's pots for exchange, 7.2; timber at a site), a project's next stage, a gathering, goods to give | the kind's `season` at its holder's review: a household's at the head's first review of a season; a pawn's on its own due day (3.5); sized to the spare |
| Days ahead | a dated step where the work has a date: the firing before the gathering; the haul on the snow; the roof before the round | the season step |
| Day, task | nothing new: the allotment takes up a household aim's tasks; a pawn takes up its own when its own hours come; each task names its step, the step its aim | as today |

**The spare.** A household's: the season's labour budget less the hours left of the targets it lives by and of the aims and projects
ranked before it (by `by`), VB-1778's reckoning by the head's estimate. A pawn's: the own hours it expects this season (the levy in
force, less what it keeps for courting and rest) times the share it has put to the aim lately. An aim given none waits.

**Own tasks across days.** Own hours are 1.5 to 2.5 a day; a firing at the pit (4 to 6.7 hours) or a dig and its walk spans days. A task
a pawn owns is a task as a plan like any (Progress lives in the world): its clay and wood lie at the pit as piles with its title, the
firing's hours on the firing, and it is taken up again in its next own hours.

### 3.4 Progress, the estimate, and revision

**Progress is read, never kept**: a craft's worth got (`pawn.trade`, 5.5) and level; a home's stages (`sim/progress`, the cottage's
rung) and the timber at its site; a portion's worth given. **When it will be done is the holder's estimate** by the function that does
the work (One quantity, one reckoning): for a home, the stages' hours left (the head's lean and range) over the hours a season the
budget has spared it lately; for a craft, the level the hours to come bring (`grownBy`) and what its pieces placed last year. Nothing
of the future is read.

At its season review an aim is under way (its estimate's centre at or before `by`: steps written), **waiting** (it lacks what the
estimate cannot price: a site, material by right, buyers, the member's yes; no steps; `waits` named; reviewed next season or on an
event), or **at risk** (the centre after `by`). At risk, its author is asked (deadline its next review); unanswered, the default author
answers **in this order**: (1) its score is under `AIM[kind].keep`: drop; (2) the kind has a lesser form whose estimate meets `by`:
scale down; (3) else postpone, `by` to the estimate's hi. A kept aim is left. A `craft` aim has no `by` to miss once it stands at
`lives`: its risk is its score.

**A wait is the thing waited for.** No rule ends an aim for its age: it waits for what it lacks and says so (the house for its winters
of timber, the potter for buyers). The marriage at the round waits for the house (the gate's place to live). **What can be undone
costs something to undo**: a dropped aim loses what nothing else uses (practice fades; a cleared plot goes back), and that loss is in
the weighing, so no dead band is added.

### 3.5 How aims are chosen

The default author forms an aim when a score of what its holder weighs passes `AIM[kind].form` and keeps it above the lower
`AIM[kind].keep`: a threshold, never a draw (A judgement is never a die). A pawn's aims are reviewed on **a due day of their own**
(`sim/due`, the asking day's formula, from 16, the courting age), not on `sim/wishes`' queue of those who seek.

| Kind | Decision point | What it weighs (`AIM[kind]` names the weights) |
| --- | --- | --- |
| `craft` | the pawn's aim day, once a season | position (the heir to the home farm weighs 0); aptitude (`SKILLS.aptitude`'s trait); level (practice at the household's makings counts); own hours by the levy in force; material in reach by its rights (5.1); the share its household's custom leaves it (5.3); **demand it sees**: the pieces the district's households will buy (7.2), read from a count made once a district, good and season at the gathering's review and read by every weighing (a work counter); ambition |
| `home` | the head's yearly review, and when a member who would need a place turns 16, begins courting or is betrothed | a member with no place in prospect under the residence custom (under "the husband's" or "the wife's" custom, the sex that stays has its place and scores 0: a controller may still form one); the partner's place, and a `home` aim under way for the pair in the partner's household (two houses for one couple score low); a site in reach; the head's estimate of the house's hours against the spare until `by` (the custom's least age to marry, or the courting pair's round); generosity; food against the means; the member's wish (3.6) |
| `portion` | the head's yearly review, for a member of age who will leave (a daughter under "the husband's", a son for service or new land) | food above the means; the leaving foreseen; generosity |

**Parity: the verb `aim`** (`form`, `revise` its `by`, its args or its `for`, `drop`, `keep`), registered by `sim/aims`: any pawn on its
own aims while it has own hours, a head on its household's; never one pawn on another's own. The default author forms no aim of a kind
for a body that holds an authored one and takes back an authored aim at risk only after its deadline, unless kept (`README.md` 3.4).

**Decision points added** (design.md section 15): an aim to form; an aim at risk; a member's aim bearing on the head's plan for it;
goods offered for hours. *Reckoned*: under 0.05 a pawn-day and 0.1 a head-day.

### 3.6 The wish, in rungs

The wish stays the pawn's answer to "where do I live next year": a ranking of the seven rungs, chosen by its own chooser (two switches
today: ambition, hunger) or by the verb `wish` (VB-1744). Aims add two switches of the same kind, thresholds on what the pawn weighs:

| While | The pawn's own chooser | Why |
| --- | --- | --- |
| its household holds a `home` aim for it that is under way or waiting only for its yes, and it is not at the hunger that bars a match | declines `service` (ranks it after `stay`) and ranks `plot` above `party` | a house is being built for it; the rest of the ranking is as before, so an empty farm (`farm` above `plot`) is still taken, and the aim then fails and is revised to another member |
| its `craft` aim stands at `AIM.craft.lives` | declines `service` and ranks `plot` above `farm` | a maker wants a holding it can work beside its craft, and does not hire out its hours |

**The member's yes is its wish**, not a new answer. Service taken (by a controller's wish) does not fail a `home`: the plot stays
`intended` and the aim fails only when the member can no longer take it. The roof, the costliest stage, **waits for `yes`** while the
member's wish declines `plot` or ranks `party` first; the default chooser does neither while the first switch holds, so only a
controller, or the aim going off course, holds the roof back.

### 3.7 What aims do not duplicate

The wish (above); the project menu (a field, a meadow, a barn, a trial stay projects, year steps with no aim; only the farm for the
heir moves, section 11); projects (a home's stages are a project plan, its steps naming the aim); targets (a pawn's target of pots is a
target like a household's, VB-698).

---

## 4. Coupling with the levy

### 4.1 Whose hours each aim runs in

| Aim | Hours | Booked (the six parts) | Goods |
| --- | --- | --- | --- |
| A pawn's `craft` | its own: what the levy leaves, what a grant adds, hours it takes | **kept**, tallied on the aim; levy hours kept for it **taken** | its store; material by its rights; the household's only when given |
| A household's `home`, `portion` | the household's labour budget, the member it is for among the hands | levied, given or demanded | the household's stores |

The own-hours judgement of VB-1759 gains the aim among what a pawn wants its hours for, weighed by its season step's lack; no share is
set (Kim's answer 6). A home's timber and stages go to winter and late autumn because there the budget has spare (winter levy 9.5
hours a day; 67 to 76% of farmers' winter hours idle, *measured* 10 Nov).

### 4.2 A member's aim against the head's plan for it

| Case | What happens | Consequence |
| --- | --- | --- |
| They agree (a `home` for him; his `craft` in his own hours) | the house in levied hours, the pots in his own; his wish declines service and ranks the plot above new land | a potter in a cottage at home, the likeliest end (8.1) |
| He wants more own hours | he asks a lighter levy citing his aim, or offers goods (4.3) | the head answers once by need, opinion and whether it backs the aim; a no is a memory |
| He takes them | levy hours kept for the aim, booked **taken** | goodwill he owes; the head reads his standing where it sizes a portion and chooses an heir |
| The head needs him beyond the levy | it **demands**; he weighs it against his aim and the goodwill | a refusal is his right, a breach of the head's |
| He sets his wish against the plot (a controller's; VB-772's plot elsewhere when built) | the head is asked; the roof waits for `yes` | if he takes another place the aim fails; the head revises its `for` or the plot goes back |
| The head opposes the craft | it grants nothing | he works his own hours only; he may leave at the round without leave (Whose yes) |

### 4.3 Hours bought with goods, backing, and the head's aims for a member

A member may offer goods from its store for levy hours: the ask `lighter` (or leave) carries goods priced **by the hour at the worth
table's day's work, 3 rations for 8 hours** (`COMMUTE.hour`, 0.375, the rate help and the outer levies' commutation already use), so
a day's leave costs 3.6 to 3.9 rations by season. The head answers by its judgement: the goods' worth to it against the hours its
season needs from the member (no at the harvest, yes in winter). Goods move to the household's store where they lie.

**Backing a member's craft** is a standing grant (VB-1763) whose `why` is the member's `craft` aim, and material given (`give`): the
head's default author weighs it at its review after a member forms a craft aim, and on an ask citing it, by the member's measure and
estimate, the budget's spare, opinion and generosity. The card reads "Olof backs Erik's craft" from the grant's `why`.

`home` and `portion` are the levy's other face: a head that levies a son's hours gives him a house or a portion, by its values. A
household's aims compete for the spare in the order of their `by`, after the targets it lives by. Whether the labour budget is the
limit on a holder's large projects is VB-1472's, Kim's (12).

---

## 5. Personal goods

### 5.1 Title, and the material

**A pawn holds title to what it makes or earns in its own hours from material it may take**: the pots it fires, what it gets for them,
a servant's wage, a portion given it. What it makes in levied hours, or of another body's material, is that body's until given. A task
opened by a pawn's own aim is owned by the pawn (`{type: 'pawn', id}`, the basis `self`), its good into the owner's store at the work.

**Material.** A pawn takes for its own hours what its household may take by the village's custom (clay from the household's digging
ground or the outland, wood from the village's wood), and what it takes is its own: the villager's right, held through its household
while a member. What lies in the household's store it uses only when given.

### 5.2 The store, where it lies, and the head pair

**The store is the stake widened** (`pawn.stake` becomes `pawn.goods`), kept by `sim/stores` with a good and a reason for every
movement, booked in its household's ledger with the pawn named. **It lies where its keeper sleeps**, the chest in its household's house;
what it makes at the house goes in there; what it gets at the gathering it carries home. **It moves only with its keeper, by its
journey**: at a move it carries its store as its load (`TRAVEL.load`); what it cannot carry stays at the old house as a pile with its
title, fetched by the stray-pile method. Title moves at once; custody by a journey.

```ts
// pawn.goods (owner sim/stores; replaces pawn.stake; FORMAT raised): absent, or the goods the pawn holds title to, in the fields a
//   household's store uses: { grain?; pots?: Graded; clay?; wood?; cloth?; butter?; ... }, Graded = { [kind]: [5 counts] } (VB-366).
// pawn.trade (owner sim/stores): absent, or { year, got: [this, last], gave: [this, last], placed: { [good]: [this, last] } }:
//   customary worth got and given for its goods, and pieces placed by good, folded at the year's turn.
// Customs (sim/customs): memberMaking: 'maker' | 'share' | 'household' (5.3); personalEstate: 'kin' (one value for now).
```

**The head pair holds none.** A pawn that becomes its household's holder or the holder's spouse (a founding, a handover, a marriage
onto the holding) puts its store into the household's, title at once where it lies, as a founding does with stakes; its `pawn.trade`
goes with it as the household's (8.3). Retired parents keep theirs.

### 5.3 What the household may take; eating

**A custom, the household's share of a member's own making** (`memberMaking`): `maker` (the default: the maker keeps it), `share`
(`HOUSESHARE`, a quarter of each making to the household's store), or `household` (all of it until the member marries or leaves). The
sources found none (`levy-custom.md` 3.2). The default author reads it: where the household takes all, no craft aim forms. Beyond the
custom the household takes nothing but what the member gives when asked (`give`, widened to persons). A head that takes unasked
**breaches**: the verb `take`, the worth booked as goodwill it owes the member, as for hours demanded; its default author takes only
when the household is hungry and the member refused its ask. `take` is a new act for a played head (12).

**A member eats at its household's table.** When the household's meal falls short, a member with grain or food in its store eats of
its own first, an operation with its reason; it gives the rest by the judgement it gives hours by.

### 5.4 At death, at marriage, on leaving home

- **At death**: title passes at once by `personalEstate`: the spouse; else the children in equal shares, a child not of age's share to
  the household that keeps it (its minder's), a holder's or a holder's spouse's to its household; else the household it lived in; else
  the nearest kin's household; else the village's store. Custody does not move (Nothing is left to no one).
- **At marriage** title does not move; custody goes with the move; the means to marry count each store's grain and foods, as stakes.
- **On leaving home** the store goes with the pawn by its journey; a wage owed stays the master's obligation.

### 5.5 Trade: what a pawn takes, what a household needs

**A pawn's accept rule.** `sim/fair` swaps by need, and a levied son is fed by his household: by the household's rule he wants nothing.
His store has its own targets, what his goods are **for**: (1) **his portion**: grain and the foods that keep, up to `PORTION.food`, his
share of the means to marry (`MARRIAGE.means` years of one adult's need, 72 rations); (2) **his craft's material** for the coming
season (clay, wood, by digging and fetching, seldom at the fair); (3) **hours to buy** (4.3), which grain serves. So a pawn values food
by the household's food curve up to `PORTION.food`, and the keeping goods beyond it at customary worth up to a back load, as any dealer
does (The fair, Keeping goods); its own pieces it values at nothing beyond its target for exchange (7.2), and its floor is the material
of its next firing. It is a contribution to the rule `need` for a pawn holder, read through `needValue` as a household's is. A member
deals its own lot or asks its household's dealer to carry it (each swap booked to its store); it does not swap with its own household's
dealer, with whom it gives and buys hours at home.

**A household's need of pots.** VB-366 makes pots for a household's own use under `POTS.want`; at the fair a household under it values
pots by grade at customary worth up to the shortfall, **when its head's estimate says buy** (7.3): always where its digging ground
holds no clay, else by make or buy.

**Income from others** (`pawn.trade`) is read by the craft's measure and the wish's switch, against need. Barter only; dealing on the
green and at a door (VB-769, VB-770) take a pawn's lot alike when built.

### 5.6 What does not wear, the portion, and slice 8

A pawn holds only what wears or is eaten (grain, pots, cloth, clay, wood, the keeping foods); **no animal and no thing that does not
wear** (silver, gold, amber, a bronze pot) is offered to it until slice 8 gives a pawn's things of worth their way out. **The servant's
portion is the store's grain**; "stake" is left to land. **Slice 8 keeps** silver and coin, personal debts, a pawn's things of worth
and animals, norms from a pawn's deals.

---

## 6. Skill that grows

No new rule: own hours at the clay practise the craft as levied hours do (`practise` runs where a craft's task is reckoned, whoever
owns it), and the household's making goes to its most skilled hand, so a son who fires the household's pots has the skill first.
*Reckoned*: at aptitude trait 0.6 (a learning factor of 1.05) "able" (0.25) takes about 160 hours of practice and "skilled" (0.5) about
380. The types of work stay a stand-in (slice 7's to place).

---

## 7. The craft in hours: what binds, and the lever

### 7.1 The arithmetic

*Reckoned* from VB-366's and the design's numbers. A firing is a load of clay (3 h and the walk), a load of wood (about 2 h) and the pit
(4 h at the norm: 6.7 for a novice, 5.2 at "able", 3.1 for a master): **9 to 12 hours for 4 pots**, 12 rations at the sound pot's 3
(VB-366's Proposed worth): about 1 to 1.3 rations an hour against the day's work, 0.375 an hour.

- **Buyers bind, hours do not.** A household keeps 8 pots and breaks a quarter a year (a shoddy one 0.36): it wants **2 to 3 pots a
  year**, 6 to 9 rations. Half a pawn's need, `AIM.craft.lives`, is 24 rations: 8 pots, two firings, **about 23 hours a year**. A
  pawn has about 100 own hours a year; pottery for buyers absorbs a fifth of them where 3 or 4 households buy from it, all of them only
  where some 40 do.
- **So "living by a craft" at these worths is a small craft.** Its measure (worth against need) is met by a man who fires twice a year
  for four clayless neighbours; the potter Kim describes, whose hours go to the clay, needs a district's custom or a pot worth its
  hours. What "living by a craft" should mean, and so the pot's worth, is Kim's (12).

### 7.2 The pawn's target for exchange

A pawn fires no pot it has no place for: its **target for exchange** is its estimate of what it can place by the next gathering, the
pieces it placed in the last year (`pawn.trade.placed`) plus the shortfall of the district's buyers it knows of (the count of 3.5), less
what it holds, at most what its own hours can make. Practice beyond the target is none. One function serves a pawn and a maker
household (8.3): One quantity, one reckoning.

### 7.3 The lever: make or buy by the head's estimate

Chosen by the principles. **Mechanisms, not prescriptions**: no demand is set and no potter is subsidised; the lever is a head's own
decision already in the design and not built (The metals and the stones, Choosing among grades: a head "gets the piece from a better
maker, by its estimate of what its own hand's work will be worth"). **Place matters**: a potter lives where clay is scarce or hands
are short. **Detail where it is a decision**: whether to fire one's own or buy is a head's real choice. The rule: at its review a head
short of pots weighs **make** (its own hand's hours at their season's worth, its clay, and the life of the grade its hand would make,
`expectedWorth`) against **buy** (the price of a better maker's pot in reach, by the grade it has seen him place, and its longer life).
A household with no clay always buys; one short of hands in the season buys; one whose hand is a novice buys a master's pot where the
longer life pays. **Demand then grows with the potter's skill**, which is the road.

The other levers, named in `docs/tuning.md` for Kim's run, not built here: **the pot's worth** (VB-366's 3 rations is a third of a
day's work for an hour's; a worth nearer its hours, about 1 ration, makes half a need 24 pots and some 70 hours); and **a craft whose
hours bind**: cloth (about 180 hours a household a year, `sim/textile`), which is also a daughter's chest and `portion`'s partner; its
aim at the loom has a task, blocked behind the potter's (VB-1798).

**Measured before it is built**: how many households have no clay in their digging ground, by village and gathering district (populous
small, seeds 7, 11, 42; VB-1795, ready now). If few, pottery's road is short in play, and the cloth task and the pot's worth carry more.

---

## 8. The worked examples, end to end

### 8.1 The farmer's second son becomes a potter

Erik, 17, second son at Norrgård; his brother inherits; clay lies in the household's digging ground; in the gathering's district six
farms have none; the custom is `maker`. *Reckoned*.

| When | Level | What happens |
| --- | --- | --- |
| Year 0 | task | The household's pots are low; its making goes to its most skilled hand, all at 0, so the first: Erik fires 4 pots in his levy. They are the household's |
| Year 0, winter | year | On his aim day the default author weighs `craft`: not the heir; aptitude 0.6; 30 own hours this winter; clay by right; the custom leaves him all; the district's count shows six clayless households wanting about 16 pots a year; ambition middling. **Aim formed**. Card: "Erik means to live by the potter's craft (his estimate: 4 to 7 years)" |
| Year 0 to 1 | season, own hours | His target for exchange is the known shortfall: two firings a season in winter and autumn, about 23 of his own hours in each, across days (the pit holds his clay and wood as his piles); pots into his store; booked `kept` |
| Year 1, autumn | the fair | At the gathering he swaps 12 pots, mostly shoddy, with the clayless households, which need pots and have no clay: grain to his portion, a lot of butter beyond it. `pawn.trade`: 30 rations, 0.6 of his need: **past `lives`**; his wish now declines service and ranks a plot above a farm; the aim stands |
| Year 2 | ask, grant | He offers 6 rations for 16 winter hours; the head, short of nothing in winter, says yes, and grants him a standing winter hour, its `why` his aim: "Olof backs Erik's craft" |
| Year 3 | demand | A late harvest: the head demands two days; Erik complies: `demanded`, goodwill the head owes him |
| Year 4 | skill, make or buy | Level 0.25 ("able", about 160 hours): mostly sound pots. Two farms with clay but novice hands now buy his sound pots by their heads' estimates: his target grows to some 22 pots, his own hours bind for the first time |
| Year 5 | the round | The house his father's `home` aim built (8.2) is roofed; his wish ranks the plot (first switch) and he marries Karin onto it. As he becomes head of the new household his store and his `pawn.trade` go into it: **the craft aim is done** |
| Year 6 on | household | 8.3 |

Nothing steers Erik: a custom that takes his pots, a district where every farm has clay and a skilled hand, or an idle temper ends the
road at year 0, and the card says which. With two clayless farms in place of six he places about 5 pots a year, does not reach "able"
in five years, and his aim waits for `buyers`.

### 8.2 A head plans a new house for his second child

Olof, holder of Norrgård, residence custom "with whoever holds land": Erik will need a place to marry; his brother inherits.

| When | Level | What happens |
| --- | --- | --- |
| Year 2, summer | event | Erik begins courting Karin, who has no place either and for whom no house is being built. The head's default author weighs `home`: a site in reach; the house (clearing, timber felled and hauled, foundation, walls, roof: about 600 h, range 450 to 800) against the spare until the pair's likely round when Erik is 20; generosity; food against the means. **Aim formed**, `by` year 5's round. Card: "Olof plans a house for Erik by his marriage (his estimate: year 4 to 6)" |
| Year 2, autumn | project | Its means is the farm for the heir: the plot begun, staked, `intended` Erik, as the household's project plan beside its others (it is not the menu's one project), its steps naming the aim. Erik's wish declines service while it is under way |
| Year 2, winter | season, budget | The winter budget (4 levied adults × 9.5 h × 12 days, less 2 days owed: about 440 h) less what the household lives by (about 250 h by the head's estimate) leaves 190; the aim takes 120: the clearing |
| Year 3, winter | dated step | Timber felled on the snow, hauled to the site as a pile with the household's title, 120 h; Erik fells some in his levy |
| Year 3, summer | at risk | A poor harvest takes the summer's spare; the centre moves to year 6. Unanswered, the default author: score above `keep`; a cottage on bare ground would not meet `by` either; so **postpone** to year 6. Card: "Erik's house is late: the timber is felled, the walls wait for hands". At year 5's round the marriage waits: no place to live yet |
| Years 4 to 5 | stages | Foundation and walls in winter, the roof in late autumn |
| Year 5 | the child's wish | His own aim agrees (8.1); his wish ranks the plot; the roof goes on without waiting |
| Year 6, autumn | the round | The plot is given to Erik; he marries Karin onto it: a move, his store carried. **Aim done**; the household's levy on him ends |

New against today: the house is planned three years ahead, not begun when Erik is grown and the household has a surplus; its work is
spread by the budget; a poor year postpones it where all can see and the marriage waits for it. Planning the house is the head's lever
on the age his son marries at: Mechanisms, not prescriptions.

### 8.3 The maker household

On founding, the new head's household **carries the craft's target for exchange**: its plan gains a target of pots above `POTS.want`
by the target for exchange of 7.2, read now from the household's record of pieces placed (the founder's `pawn.trade`, poured in), and
reviewed each year by the same function. Its pottery is household work, levied; its income from others its household's. Whether its
**fields** shrink against the craft's food is slice 9's (A craftsman's food; VB-767, VB-768, the arch `town`): until those land, a maker
household farms as any and makes pots beside. That is where the road stops in this arch; a market town waits with the town (No town
before the ship).

---

## 9. The page

An aim is a row of the strip's **year zoom** (`README.md` 3.7), the same wherever it appears: its kind's icon and goal; a bar from
`since` to `by`; the measure on the one meter; the holder's estimate as a whisker, as the outlook draws its doubt; what it waits for, in
words. The pawn's card shows its aims and its household's aims for it, its store (a graded good as the strip of five) and its income
against its need; the head's view shows each member's aims beside the household's for it, marked where they bear on each other, and
each aim's share of the season's budget. `aim`, the ask with goods and `give` are reached from them.

---

## 10. Cost

At about 1,000 living, 200 households (`docs/cost.md`), *reckoned*: a pawn's aim day, about 700 adults × 4 a year × about 15 reads,
the district's demand read from a count made once a district, good and season (about 900 reads a game day); a household's aims, 200 × 4
reviews × 1 to 2 aims × tens of reads (about 300); `home`'s events, about 100 a year; about 700 stores of a few numbers read where a job,
a move or a swap runs; make or buy, a few reads at a head's review when short of pots. Claimed: under 0.3 ms a game day. Nothing polls;
no loop over pairs; ended aims leave the live list at the season's fold.

---

## 11. What it changes in today's design

| Where | It was | It becomes |
| --- | --- | --- |
| design.md 7, How a holder chooses: projects (**Decided, 10 Nov**) | the farm for the heir on the menu, taken once a year at a surplus, one project at a time, for an heir of 18 (a sole heir offered one when the ranking has one name) | **revised**: the farm for the heir leaves the menu and becomes the means of `home`, formed years ahead with no surplus, for a member of 16 who will need a place, beside other projects; a sole heir, who inherits the home farm, is no longer offered one. Kim's direction (answer 21: the house planned ahead), the mechanism Kim's to confirm (12) |
| design.md 7, Plans at four scales: The year; The build and its gate | a pawn's aims "wait for slice 8"; the order ends "with slice 8" | aims and personal goods, in this arch |
| design.md 7, The levy: What own hours are for; Own hours, booked; Own hours as a livelihood | "before slice 8"; "later an aim"; from slice 8, waiting for goods, skill, a town, a right to material | an aim among the uses; kept includes it; **replaced** by Aims and personal goods |
| design.md 5, Who owes; The rungs; 4, The portion; 8, Pots; 9, The gift, Deals between strangers; 10, Custom dimensions; 11, Who goes; 15, Decision points | | personal goods exist and pass by custom (debts still slice 8); two switches of the wish; the stake is the servant's store; pots made for exchange and bought by make or buy; `give` between persons; a pawn's lot; two customs; a member with goods to deal; the aims' points |
| `docs/slices.md` 3.8; `target-v2.md` 4.4; `README.md` 1, 3.3, 3.10 | personal goods with slice 8 | pointers here |

---

## 12. Decisions, close calls and questions

### Decisions, with reasons

1. An aim is a year step with a goal, `by`, author and measure, opening no task. *The record names `{aim}`; hours at season and day.*
2. A pawn holds aims while it has own hours; the head pair's are the household's. *The head pair is not levied (answer 10).*
3. Three kinds, declared by their domains: `craft`, `home`, `portion`; backing a craft is a grant's `why`, not an aim. *An aim its
   holder cannot advance is a special case.*
4. A `craft` aim is a standing state: reaching `lives` changes its card and the wish; it ends at founding or by its weighing. *A
   livelihood is kept, not finished.*
5. Progress read from the world; the estimate the holder's, by the doing's reckoning. *Progress lives in the world; One quantity.*
6. At risk, in order: drop under `keep`, scale down if the lesser form meets `by`, else postpone; never by a count of years. *A wait is
   the thing waited for; a checkable order.*
7. Formation on a threshold at fixed decision points; a kind's `why` checks position, not need. *A judgement is never a die; parity.*
8. One verb `aim`, `revise` reaching `for`. *Every act is a pawn's; 400 hours of a house need not be lost.*
9. Aims act on the wish only as switches of its own kind (3.6); the member's yes is its wish; service does not fail a `home`. *The wish
   is the round's one read; no second answer.*
10. A pawn's aim in its own hours (`kept`), a household's in its budget; their conflicts through the levy's acts. *Answer 2.*
11. Hours bought with goods, by the hour at 3 rations for 8 hours. *One price with help and the outer levies.*
12. Title follows the hours, and the material's title comes by the right to take it. *What own hours are for (answer 6).*
13. The store is the stake widened; custody with its keeper; the rest a titled pile. *Unify the same; Nothing teleports.*
14. A member eats of its own store when the household's meal falls short. *A store of food beside a hungry pawn would be a rule against
   itself.*
15. At death by `personalEstate`; a minor's share to its minder's household. *Nothing is left to no one; Whoever cannot keep itself.*
16. A pawn holds only what wears. *What does not wear needs a way out.*
17. A pawn's accept rule from what its store is for (portion, material, hours), as a contribution to `need`. *The fair's one rule.*
18. The craft is bound by buyers; its lever is make or buy by the head's estimate; the pot's worth and cloth are named, not built here;
    clay's scarcity measured first. *Mechanisms, not prescriptions; Place matters; Detail where it is a decision.*
19. One target-for-exchange function for a pawn and a maker household. *One quantity, one reckoning.*
20. The maker household carries the craft's target; its fields are slice 9's. *Slice 9 owns A craftsman's food.*
21. No new skill rule. *VB-360 and VB-761.*
22. `sim/aims` renamed `sim/projectmenu`; VB-366's module `sim/pottery`. *Naming (Kim, 15 Nov); `sim/pot` exists.*

### Close calls (decided here, surfaced)

- The pawn's own store, not titled lots in the household's (custody follows the keeper).
- The head pair holds none (one plan, one purse); was question 2.
- `memberMaking` defaults to `maker` (no source; it gives the levy its point); was question 1.
- Inheritance: spouse, children (a minor's to its minder's household), household, kin, village; was question 3.
- No animal and no thing of worth for a pawn before slice 8; was question 6.
- Types-of-work skill stays a stand-in; was question 7.
- Pottery first; cloth opened as a blocked task, not "no new rule"; was question 8.
- A daughter's house follows the residence custom (A2 of the review); was question 9.
- Aim hours `kept`, not a seventh part; income a fold on the pawn; the old module renamed rather than the new called `sim/goals`.
- The wish's switches: service declined and the plot above new land while a home is built; service declined and the plot above a farm
  at `lives`. Another agent might have left `farm` below `plot` in the first too.
- The at-risk order puts scale-down before postpone: a smaller house in time before a larger one late.

### Questions for Kim (in `QUESTIONS.md`, block "VB-1472, VB-1785, VB-1786, VB-1792, VB-1794")

1. **The farm for the heir leaves the surplus menu** (revises How a holder chooses: projects, Decided 10 Nov). P: yes, as 11 says.
2. **The labour budget as the limit on parallel large projects** (VB-1472). P: yes, ranked by `by`.
3. **Hours bought with goods** (a new act for a played member). P: yes, 0.375 a ration an hour.
4. **A head's `take` of a member's goods as a breach** (a new act for a played head). P: yes, symmetric with a demand.
5. **What "living by a craft" is**, and the pot's worth (7.1). P: keep the measure (worth against need, one quantity with income from
   others); make or buy the mechanism; the pot's worth for the tuning run; cloth for a craft whose hours bind.

**For Kim, no question**: a pawn's lot at the fair makes a played son a trader on his own account (it follows from answer 21).

**Principle candidate** (Kim to accept or strike): *Title follows the hours, and the material's title comes by the maker's right to
take it. What a pawn makes in its own hours, of material it may take, is its own; what it makes in hours another body holds, or of
another body's material, is that body's until given; a body's hold on a member's goods is a custom, like its hold on its hours.*

---

## 13. The path: the tasks

In the arch `plans`, after the plan record (step 4) and the levy (step 6), before the wrap-up (VB-1773); the gated ones carry the
arch's gate (`tools/gate.js`, VB-1774). The tasks' files are the reference; in order of dependency:

| ID | Task | Size | Waits for |
| --- | --- | --- | --- |
| VB-1795 | Measure: households with no clay in their digging ground, by village and district | S | ready |
| VB-1781 | Refactor: `sim/aims` renamed `sim/projectmenu` | S | ready |
| VB-1782 | A pawn's store replaces the stake; the head pair's poured in; a member eats of its own | M | VB-1774 |
| VB-1791 | A pawn's store moves with its keeper, and passes at death by custom | M | VB-1782, VB-1749 |
| VB-1783 | A task a pawn owns, its material, and the custom of a member's making | M | VB-1782, VB-1762, VB-366 |
| VB-1792 | `give` between persons, and a head's `take` of a member's goods | S | VB-1782, VB-1779 |
| VB-1784 | The aim record, its registry and the verb `aim` | M | VB-1781, VB-1754 |
| VB-1793 | The aims' review: their own due day, the estimate, at risk, waiting, decision points | M | VB-1784, VB-1755, VB-1757, VB-1778 |
| VB-1796 | A household's need of pots at the fair, and make or buy by the head's estimate | M | VB-366, VB-1774 |
| VB-1787 | A pawn's goods at the fair: its lot, its accept rule, its income | M | VB-1782 |
| VB-1785 | A household's aim `home`, and the wish while a house is built | M | VB-1793 |
| VB-1786 | A pawn's aim `craft`: the potter | M | VB-1783, VB-1793, VB-1787, VB-1795, VB-1796 |
| VB-1788 | A household's aim `portion` | S | VB-1793, VB-1792 |
| VB-1794 | Hours bought with goods, and a head backing a member's craft | M | VB-1763, VB-1782, VB-1786 |
| VB-1789 | A maker's wish, and the craft aim's end at founding | S | VB-1785, VB-1786, VB-1787 |
| VB-1797 | The maker household carries the craft's target for exchange | S | VB-1789, VB-1796 |
| VB-1798 | A craft aim at the loom: cloth in own hours, a daughter's chest | M | VB-1786, VB-1787 |
| VB-1790 | The page: aims, the store and income | M | VB-1793, VB-1782, VB-1787, VB-1765 |
