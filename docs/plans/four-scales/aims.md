# Aims and personal goods: plans at the year and beyond, and what a pawn owns

25 November 2026. A design pass on Kim's answer 21 of that day (`README.md` in this folder, section 6): long-term plans and aims are
designed into the four-scales model, so that a pawn may work towards being a potter and a head may plan a new house for his second
child, and **personal goods are pulled forward from slice 8** into the arch `plans`, so the potter's road is built here. It stands on
`README.md` (3.1, 3.3, 3.4, 3.6; section 6 governs), on `design.md` section 7 (Plans at four scales; The levy and own hours) and on
the code as it is. All of it is **Proposed** but the two points Kim decided (aims designed in; personal goods pulled forward).
`design.md` carries it at its own density (section 7, Aims and personal goods); this is the reasoning. Type sketches are
TypeScript-style: shape and ownership, not code. *Reckoned* marks arithmetic on the design's values, not a measurement.

---

## 1. In short

- **An aim is a year step of the plan record** whose goal is a state the world can show (a pawn lives by a craft; a member has a
  house to marry into), with a `by`, an author and a measure. It opens no task: at its holder's season review it writes the
  season's steps under it, each naming it as `why`. Hours are counted at the season and the day, never at the aim.
- **A pawn's aim runs in its own hours and store; a household's aim in its labour budget and stores.** The levy couples them.
- **The holder chooses**: its default author forms an aim on a threshold of what it weighs, at fixed decision points, never a draw;
  any controller forms, revises, drops or keeps one through the verb `aim`.
- **Progress is read from the world; when it will be done is the holder's estimate.** An aim at risk is asked of its author, and
  is postponed, scaled down or dropped by the weighing that formed it. It names what it waits for; no count of years ends it.
- **Personal goods** are today's stake widened: a pawn's title to what it makes or earns in its own hours, in a store that lies
  where it sleeps and moves only with it. The head pair holds none. At death it passes by custom. What a household may take of it
  is a custom; more is a breach, booked as goodwill, as hours are. A member may buy levy hours with goods.
- **Skill that grows is already built for crafts** (VB-360, pottery among them) and grades by it (VB-761): no new rule.
- **The potter's road stops** at a maker household on a plot, part-fed by its craft; the town is slice 9's. Slice 8 keeps silver
  and personal debts. Cost: under 0.3 ms a game day at the late reference (*reckoned*).

---

## 2. What the code already holds

Reading the systems the brief names changed four of its assumptions.

| Found | What it means here |
| --- | --- |
| `sim/skills` holds **crafts learnt by doing** (VB-360, done 22 Nov): `practise`, a level 0 to 1 in closed form, half at 400 hours at aptitude 1, a tenth lost a year unused, `grownBy` as its estimate; `pottery` is one of `SKILLS.crafts`. What does not grow is VB-475's stand-in for the **types of work** | The potter's skill grows today. design.md's "waits for skill that grows (VB-475's stand-in does not)" is out of date |
| `sim/workmanship` (VB-761) grades a made piece by its maker's skill; pots are the first graded good in a store, by VB-366 (ready, not built): `fire` at home, 4 hours, a load of clay and one of wood, 4 pots | The pots are graded with no new rule; the road waits for VB-366 |
| The pawn is already a holder of `sim/stores`: `pawn.stake`, grain of no crop, paid by the servant's wage (VB-637), counted in the means to marry and a party's provisions, moved into a new household at its founding, walked on by settlers | Personal goods are this store widened. The servant's portion and personal goods are one thing |
| `sim/aims` is the **head's project menu** (VB-255: a field, a meadow, a farm for the heir, a barn, a trial crop); `heirFarm` builds a plot and cottage for an adult heir, begun only at a surplus | The name is taken by what is not an aim: renamed `sim/projectmenu`. The house for the second child exists as a project; it becomes an aim's means |

Also: `sim/eligibility` already has the basis `self` (a task owned by neither a household nor a village); `sim/wishes` gives every
pawn who seeks an asking day once a season, which the pawn's aim review rides on; slice 9 has designed A landless maker asks for a
plot (VB-772) and A craftsman's food. Not built: title from own hours, a store of more than grain, a pawn's goods at death or at the
fair, any goal longer than a project, the plan record (VB-1752), the levy (VB-1760 to VB-1763), pots (VB-366).

---

## 3. Aims as plans at the year horizon and beyond

### 3.1 What an aim is

The plan record (`README.md` 3.4) already lists `{aim}` among a step's `what`s. An aim is a **year step** whose goal is a state of a
body, not an amount of work:

```ts
// An aim: a PlanStep in plan.year (st.plans: owner sim/plans for the record, sim/aims for its rules), with what: {aim}.
type AimKind = 'craft' | 'home' | 'trade' | 'portion';
type AimStep = PlanStep & {                        // PlanStep (README 3.4): id, from, by, who, why, left, author, kept, state
  what: { aim: { kind: AimKind; for: PawnId;       // whom it is for: the pawn itself, or a member of the household
                 args: { craft?: Craft; plot?: PlotId; n?: number } } };
  since: Day; by: Day;                             // formed; meant done by (at forming, its own estimate's hi)
  waits: 'hours' | 'material' | 'site' | 'skill' | 'buyers' | 'budget' | 'yes' | null;   // what it lacks now, for the card
  tally: { hours: number; worth: number; last: [number, number] };   // this season's hours and worth, folded into last:
};                                                 //   the rate its estimate reads; the only progress kept on the aim
// state: 'planned' | 'open' | 'at-risk' | 'done' | 'failed' | 'dropped', as every step's.

type AimRule = {                                   // a kind, declared at load by the module whose state its work changes
  holders: ('pawn' | 'household')[];
  why(st, holder: BodyRef, forId: PawnId, args): string | null;      // the verb's check
  measure(st, aim): { have: number; need: number; unit: string };     // read from the world now; nothing stored
  estimate(st, aim, judge: PawnId): { lo: Day; mid: Day; hi: Day } | null;   // the judge's, by the doing's reckoning
  season(st, aim, spare: number): StepDraft[];     // this season's steps under it, sized to the hours its holder can spare
  weigh(st, holder, forId): number;                // the default author's score: forms at AIM[kind].form, drops under .keep
  ends(st, aim, how): void;                        // what it holds passes on (Nothing is left to no one)
};
```

`sim/aims` is the registry and the review, as `sim/makings` and `sim/kinds` are registries: it holds no kind's rule.

### 3.2 Who holds one, and the first kinds

A **pawn** holds aims of its own only while it has own hours: a levied member (a son, a daughter, other kin, a servant) or an adult
of no household. **The head pair holds no pawn aims**: they are not levied, the household's plan is theirs, and their aims are the
household's. A **household** holds aims through its head, for itself or for a member. A village's aims (a mill, a church) wait for
their slices.

| Kind | Holder, for | Goal (its measure) | Means |
| --- | --- | --- | --- |
| `craft` | a pawn, itself | to live by a craft: worth got from others for its makings in the last year against its need (48 rations), at `AIM.craft.lives` (0.5: the part-fed maker of A craftsman's food) | own hours at the craft: material dug and fetched, makings, the gathering |
| `home` | a household, a member | a house the member can marry into under the residence custom: a plot staked and cleared, a cottage roofed, held for it (`intended`) | today's farm for the heir (`heirFarm`), begun years ahead, spread over slack seasons |
| `trade` | a household, a member | the member's own `craft` aim done | own hours granted (a standing grant of the levy), material given: the head as patron |
| `portion` | a household, a member | goods of `n` worth in the member's store by `by` (a daughter's chest, a son's start) | goods given from the household's store, a season at a time |

Two kinds for the examples, two for a head's aims for a member: a house, a trade and a portion are what a head gives a child who will
not inherit (`levy-custom.md` 3.2: position works through fate). An office stood for, a match sought over years, a farm bought wait
for the systems that carry them.

### 3.3 How an aim becomes work

| Horizon | What the aim puts there | Written by, when |
| --- | --- | --- |
| Year and beyond | the aim: goal, `by`, state, what it waits for | its author, at a decision point (3.5); reviewed each season |
| Season | steps with `why` the aim: a target (clay loads, firings, pots in the pawn's store; timber at a site), a project's next stage, a gathering, goods to give | the kind's `season` at the holder's season review (a household's at its head's first review of a season; a pawn's at its asking day), sized to the spare |
| Days ahead | a dated step where the work has a date (the firing before the gathering; the timber's haul on the snow; the roof before the round) | the season step, when its window is known |
| Day, task | nothing new: the allotment takes up a household aim's tasks as any target's; a pawn takes up its own when its own hours come; each task names its step, the step its aim ("for Erik's house, by his marriage") | as today |

**The spare.** For a household aim: the season's labour budget less the hours left of the targets the household lives by and of the
aims and projects ranked before it (VB-1778's reckoning, by the head's estimate). For a pawn's aim: the own hours it expects this
season (the levy in force, less what it keeps for courting and rest) times the share it has been putting to the aim (`tally.last`).
An aim given no spare writes no steps and waits for `budget` or `hours`.

### 3.4 Progress, the estimate, and revision

**Progress is read, never kept.** A craft's measure is the year's worth got from others (`pawn.trade`, 5.5) over need, beside the
craft's level; a home's, the plot's stages done (`sim/progress`, the cottage's rung) and the timber at its site; a portion's, the
worth given into the member's store. The aim keeps only the season's tally, folded, as the levy's tally is.

**When it will be done is its holder's estimate**, by the function that does the work (One quantity, one reckoning): for a home, the
stages' hours left (the head's estimate of a task's hours, with its lean and range) over the hours a season the budget has spared it
lately; for a craft, the level the hours to come bring (`grownBy`), the grades' odds at that level, and what a piece fetched last
year. A centre and a range; a poor judge's is wide. No frost and no buyer is known ahead.

| At its season review an aim is | When | What happens |
| --- | --- | --- |
| under way | the estimate's centre is at or before `by` | its season steps are written |
| **at risk** | the centre is after `by` | its author is asked (deadline its next review); unanswered, the default author **postpones** (`by` to the estimate's hi), **scales down** (a lower `n`; a cottage on bare ground) or **drops** it, by the weighing that formed it, under `AIM[kind].keep`; a kept aim is left |
| **waiting** | it lacks what the estimate cannot price: a site, material by its rights, a buyer seen, the member's yes | no steps; `waits` names it; reviewed again next season or on an event (a plot freed, a household short of pots) |
| done, failed | the measure meets its need; or its holder or `for` dies, leaves, marries elsewhere | `ends`: what it made stays in the world with its title |

**A wait is the thing waited for.** No rule ends an aim for its age. An aim that does not move says why, and the wait is what that
takes: the house waits for the winters its timber needs, and the marriage at the round waits for the house (the gate's place to
live); the potter waits for buyers ("no household within reach lacks pots"). **What can be undone costs something to undo**: a
dropped aim loses its hours where nothing else uses them (practice fades a tenth a year; a cleared plot with no house goes back to
the village as an unworked plot does), and that loss is in the weighing that drops it, so no dead band is added.

### 3.5 How aims are chosen

**The default author** forms an aim when a score of what its holder weighs passes `AIM[kind].form`, and drops it under the lower
`AIM[kind].keep`: a threshold, never a draw (A judgement is never a die). It reads the present and the past only.

| Kind | Decision point | What it weighs (`AIM[kind]` names the weights) |
| --- | --- | --- |
| `craft` | the pawn's asking day, once a season (the due-queue of `sim/wishes` widened from those who seek to every adult with own hours) | its position (the heir to the home farm weighs 0); its aptitude (the trait `SKILLS.aptitude` reads); its level (practice at the household's makings counts: VB-761 gives a making to the most skilled hand); its own hours by the levy in force; material in reach by its rights (5.1); the share its household's custom leaves it (5.3); demand it sees: households within its gathering's reach under their target of the good with no maker of their own; its ambition |
| `home` | the head's yearly review, and when a member who will need a place turns 16, begins courting or is betrothed | a member who will need a place under the residence custom (not the heir); a site in reach (`findSite`); the head's estimate of the house's hours against the spare of the seasons until `by` (the custom's least age to marry, or the courting pair's round); generosity; food against the means to marry; the member's wish (a place elsewhere ranked above home lowers it) |
| `trade` | the head's review after a member forms a `craft` aim, and a member's ask for a lighter levy citing it | the member's measure and estimate; the budget's spare (a grant costs levied hours); opinion; generosity |
| `portion` | the head's yearly review, for a member of age who will leave | food above the means; the leaving foreseen (a betrothal, the wish, the residence custom); generosity |

**Parity: the verb `aim`** (ops `form`, `revise`, `drop`, `keep`), registered by `sim/aims`; its check is the kind's `why` and the
actor's position: any pawn on its own aims while it has own hours; a head on its household's, for itself or a member; never one pawn
on another's own. A controller authors through it; the default author forms no aim of a kind for a body that holds an authored one,
and takes back an authored aim at risk only after its deadline and unless it is kept, as any step (`README.md` 3.4).

**Decision points added** (design.md section 15): an aim to form (deadline the review's end); an aim at risk (its next review); a
member's aim bearing on the head's plan for it (the head's next review); goods offered for hours (at once). *Reckoned*: under 0.05
a pawn-day and 0.1 a head-day, beside the four-scales load of about 1 and 2.

### 3.6 What aims do not duplicate

- **The wish** (`sim/wishes`) stays the pawn's answer to "where do I live next year", read by the round: a standing aim at the scale
  of a life. An aim moves it only through the world: the craft's measure is one weight on the plot rung (7.1), and a `home` aim done
  makes the plot rung open for its member (`intended`, as today).
- **The project menu** (renamed `sim/projectmenu`): a field, a meadow, a barn and a trial crop stay projects, year steps with no aim
  above them. Only `heir` goes: the farm for the heir is the `home` aim's means.
- **Projects**: a home's stages are a project plan as today, their steps naming the aim. **Targets**: a pawn's target of pots in its
  store is a target like a household's (VB-698), on the pawn's plan.

---

## 4. Coupling with the levy

### 4.1 Whose hours each aim runs in

| Aim | Hours | Booked (the six parts) | Goods |
| --- | --- | --- | --- |
| A pawn's own (`craft`) | its own hours: what the levy leaves, what the head grants, hours it takes | **kept**, tallied on the aim; levy hours kept for it are **taken** (a breach) | its store; material by its rights; the household's only when given |
| A household's for a member (`home`, `portion`) | the household's labour budget: levied hours of any member, the member it is for among them | levied, given or demanded, as any household work | the household's stores |
| A household's `trade` | none of the household's: a grant moves the member's levied hours to its own | the member's, **kept** | material given into the member's store |

A pawn's aim competes inside its own hours with courting, a visit, rest and giving. The own-hours judgement of VB-1759 (diligence
and the need it sees, against what it wants the hours for) gains the aim among what it wants them for, weighed by its season step's
lack: a son with a firing due before the gathering gives fewer hours to the hay. No share is set (Kim's answer 6).

Felling a house's timber is household work, levied, whoever fells it. Winter's levy (9.5 hours a day) and winter's idleness (67 to
76% of farmers' hours, *measured* 10 Nov) are why the default author places a home's timber and stages in winter: they fit there.

### 4.2 A member's aim against the head's plan for it

The second son wants pottery; the head plans a house and a marriage for him. The levy's acts mediate, and each side weighs the
other's aim because knowledge moves at once.

| Case | What happens | Consequence |
| --- | --- | --- |
| They agree (a `home` for him; his `craft` in his own hours) | the house in levied hours, the pots in his own | none: a potter in a cottage at home is the likeliest end (7.1) |
| He wants more own hours | he **asks** a lighter levy (VB-1763, `lighter`), citing his aim, or offers goods (4.3) | the head answers once, by its need, its opinion and whether it backs the aim; a yes that backs it is a `trade` aim; a no is a memory |
| He takes them | levy hours kept for the aim, booked **taken** | goodwill he owes the head; the head reads his standing where it sizes a portion and chooses an heir |
| The head needs him beyond the levy | it **demands** | he weighs the demand against his aim and the goodwill; a refusal is his right, a breach of the head's |
| His wish ranks a place elsewhere above home (VB-772) | the head is asked; by default its `home` aim **waits** for `yes` before the roof, the costliest stage | if he leaves, the aim fails and the plot and timber stay the household's or go to the village as an unclaimed plot does; if he stays, the roof goes on |
| The head opposes the craft | it grants nothing | he works his own hours only, slower; at the round he may leave for service or new land without leave (Whose yes) |

### 4.3 Hours bought with goods, and the head's aims for a member

A member who earns may offer goods from its store for levy hours: the ask `lighter` (or leave) carries an offer at the worth table's
day's work, **3 rations for 8 hours**, the outer levies' commutation (section 9, The ladder). The head answers by its judgement (the
goods' worth to it against the hours its season needs from him: no at the harvest, yes in winter). The goods move from his store
to the household's where they lie, with a reason of their own. One rate for both commutations; a custom may later change it.

`home`, `trade` and `portion` are household aims with `for` a member: the plan the head's, the hours and goods the household's, the
benefit the member's. They are the levy's other face: a head that levies a son's hours gives him, in return, a house, a trade or a
portion, by its values. The member's yes is needed only for a move (the plot given at the round). A household's aims compete for the
budget's spare in the order of their `by`, after the targets it lives by; whether that is the limit on a holder's large projects is
VB-1472's question (11, Q4).

---

## 5. Personal goods

### 5.1 Title, and the material

**A pawn holds title to what it makes or earns in its own hours** from material it has a right to: the pots it fires, the grain it
gets for them, a servant's wage, a portion given it, goods got for goods. What it makes in levied hours is the household's, as today.
The hours' part names the owner of what they make. A task opened by a pawn's own aim is owned by the pawn (`{type: 'pawn', id}`,
which the basis `self` already takes), and its good goes into the owner's store at the work.

**Material.** A pawn takes for its own hours what its household may take by the village's custom (clay from the household's digging
ground or the outland, wood from the village's wood), and what it takes is its own: the villager's right, held through its household
while a member and through its own after. What lies in the household's store it uses only when given (`give`, 5.5). The "landless
pawn's right to the material" the levy section asked for is no new right: the household's, held by its members.

### 5.2 The store, and where it lies

**The store is the stake widened** (`pawn.stake` becomes `pawn.goods`), kept by `sim/stores` with the household's operations, each
movement with a good and a reason, booked in the household's ledger with the pawn named, as a stake's is today.

**It lies where its keeper sleeps**: the chest in its household's house, as the servant's stake "lies in the master's house". What
the pawn makes at the house goes in where it is made; what it gets at the gathering it carries home. **It moves only with its keeper,
by its journey**: at a move the pawn carries its store as its load (`TRAVEL.load`), as settlers walk on their stakes; what it cannot
carry stays at the old house as a pile with its title (`sim/lying`), fetched by the stray-pile method (A stray pile). Title moves at
once; custody by a journey.

```ts
// pawn.goods (owner sim/stores; replaces pawn.stake; FORMAT raised): absent, or the goods the pawn holds title to, in the fields a
//   household's store uses for them: { grain?: number; pots?: Graded; clay?: number; wood?: number; cloth?: number; ... }, where
//   Graded = { [kind]: [shoddy, sound, good, fine, masterwork] } (VB-366's shape). Custody: its keeper's house, or a titled pile.
// pawn.trade (owner sim/stores): absent, or { year, got: [this, last], gave: [this, last] }: customary worth (rations) got from and
//   given to others for its goods, folded at the year's turn; written where a swap is booked.
// Customs (sim/customs, its one door): ownMaking: 'own' | 'share' | 'household'; personalEstate: 'kin' (one value for now).
```

**The head pair holds none.** A pawn that becomes its household's holder or the holder's spouse (a founding, a handover, a marriage
onto the holding) puts its store into the household's, title at once where it lies, as a founding does with stakes today. Personal
goods exist exactly for those whose hours are levied; a second purse for the head pair would be a second purse for one plan. Retired
parents (*undantag*) keep theirs: what they make in their own hours is theirs.

### 5.3 What the household may take

**A custom, the household's share of a member's own making** (`ownMaking`): `own` (the default: nothing), `share` (`OWN.share`, a
quarter of each making, to the household's store at the making), or `household` (all of it, until the member marries or leaves). The
sources found none (`levy-custom.md` 3.2: nothing on sons' own earnings; a plot of one's own was a known payment for labour), so
the default leaves the son his pots and a village may drift. The default author reads it: where the household takes all, no craft
aim forms, and own hours go to pastimes, courting and giving. The custom and the levy are two dials of one hold.

**Beyond the custom** the household takes nothing but by an ask the member answers by its own judgement (`give`, widened to persons).
A head that takes a member's goods unasked **breaches**, as a demand of hours does: the worth booked as goodwill the head owes,
opinion following. In hunger the member gives of its store by the judgement it gives hours by, and the head may ask, as it asks kin.

### 5.4 At death, at marriage, on leaving home

- **At death** (Nothing is left to no one): title passes at once by `personalEstate`: to the spouse; else the children in equal
  shares (a holder's or a holder's spouse's share to its household); else the household it lived in; else the nearest kin's
  household; else the village's store. Custody does not move: what lies in the house is used there; a pile is fetched by the heir.
- **At marriage** title does not move; custody goes with the move; the means to marry count both stores, as stakes are counted today.
  One who marries onto the holding puts its store in (5.2).
- **On leaving home** the store goes with the pawn by its journey; a servant's wage owed stays the master's household's obligation.

### 5.5 Trade, giving, and income

- **The fair** (VB-302, built): a lot in a dealer's load names its owner, a pawn or a household. A member with goods over its own
  target goes to the gathering (the unmarried of age go already), or asks its household's dealer to carry its lot: answered by the
  dealer's opinion, each swap booked to its store. Goodwill as change is between the persons who dealt. Barter only.
- **The green and the door** (VB-769, VB-770; slice 9's, designed, not built): a pawn deals there as a household does when they land;
  the road uses them and does not wait for them.
- **`give`** widens to persons: from a pawn's store to a household or a pawn, and from a household's to a member's (a portion,
  material); the receiver answers, as today.
- **Income from others** (`pawn.trade`): worth got for its goods this year and last, read by the craft's measure and the wish's
  plot rung against its need (48 rations a year). It is "income from others against need", the measure A label is read names, for
  one person; a fold on the pawn, because the pawn moves and the ledger is its household's.

### 5.6 What does not wear, the portion, and what slice 8 keeps

What a pawn holds in this arch wears or is eaten: grain (lost in store as its household's is), pots (a quarter break a year by
grade), cloth, clay and wood. **A deal that would give a pawn a thing that does not wear (silver, gold, amber, a bronze pot) or an
animal is not offered to it** until slice 8 brings silver and the way out of a pawn's things of worth, and a pawn's herd needs a
pasture right of its own. So What does not wear needs a way out holds by construction, at a cost: the potter cannot take a sheep for
his pots (11, Q6).

**The servant's portion and the stake are one thing**: the wage (VB-637) is paid into the servant's store; "stake" is left to land
(`sim/stakes`), which it also names today.

**Slice 8 keeps** silver and coin; personal debts (Who owes) and a personal estate's debts; a pawn's things of worth and animals;
norms learned from a pawn's deals. It no longer brings personal goods.

---

## 6. Skill that grows

No new rule. The potter's skill is the craft level of `sim/skills`: own hours at the clay practise it as levied hours do
(`practise` runs where a craft's task is reckoned, whoever owns it); the household's making goes to its most skilled hand (VB-761),
so a son who fires the household's pots is the first to have the skill; each pot's grade is drawn by it. *Reckoned*: aptitude 1 and
50 own hours a year reach 0.08 in a year, 0.29 ("able") in four and 0.5 ("skilled") in eight; with a head's grant of 40 hours more a
year, 0.5 in four, near the historical seven years of an apprenticeship. The dials are `SKILLS.half` and the grant. The types of
work (VB-475's stand-in) stay as they are: neither example needs a ploughman who improves (11, Q7). A pawn's estimate of its road
reads `grownBy`, the function the doing uses.

---

## 7. The two worked examples, end to end

### 7.1 The farmer's second son becomes a potter

Erik, 17, second son at Norrgård; his brother inherits; a clay bank lies in the household's digging ground; two of the village's nine
farms have no clay in reach; the custom of own making is `own`. *Reckoned*, not measured.

| When | Level | What happens |
| --- | --- | --- |
| Year 0 | task | The household's pots are low (VB-366's target); its making goes to its most skilled hand at pottery, all at 0, so to the first: Erik fires 4 pots in his levy. They are the household's; his level 0.01 |
| Year 0, winter | year, own hours | At his asking day the default author weighs `craft`: not the heir; aptitude 0.6; own hours 30 this winter; clay by right; the custom leaves him all; two farms short of pots with no maker; ambition middling. It passes `AIM.craft.form`: **aim formed**, `by` his estimate's hi, 9 years. Card: "Erik means to live by the potter's craft (his estimate: 6 to 9 years)" |
| Year 0, winter | season | His step: 2 firings (a load of clay dug, 3 h; a load of wood fetched; 4 h at the pit at a novice's 0.6, 6.7 h), about 23 of his 30 own hours, pots into **his** store, booked `kept` and on the aim. His idle brother gives nothing either: the strip shows two different own hours |
| Year 1 | day, levy | At the hay he works his levy (10 h) and gives two of his own; his firing waits for autumn. Mostly shoddy pots; 6 in his store |
| Year 1, autumn | the fair | He goes to the gathering (unmarried, of age) and swaps his 6 pots with two households short of them for grain, goodwill as change: `pawn.trade.got` 11 rations, 0.23 of his need |
| Year 2 | ask, grant | He asks a lighter winter levy citing the aim and offers 6 rations for 16 hours; the head, short of nothing in winter and fond of him, says yes, and forms a **`trade` aim** for him: a standing grant of 3 h a day in winter, the household's spare clay given into his store. Card: "Olof backs Erik's craft" |
| Year 3 | demand | A late harvest: the head demands two days beyond his levy; Erik weighs his firing against his goodwill with his father and complies: booked `demanded`, goodwill the head owes him |
| Year 4 | skill, trade | Level 0.3 ("able"): mostly sound pots; 40 rations a year from households in three villages, 0.8 of his need. The head's `home` aim for him (7.2) is under way: the two aims agree |
| Year 5 | the round | With his measure past `AIM.craft.lives` and the house roofed, the plot his father's aim holds ranks first in his wish; he marries Karin at the round; their household is founded on the plot, his store goes in, his levy at Norrgård ends. **The craft aim is done** |
| Year 6 on | household | A part-fed maker (A craftsman's food): a field or two, a cow, and pots made as household work, its fields sized against its estimate of all its food, the craft's among it. With no house at home, his wish would have ranked a plot elsewhere (VB-772) |

**Where the road stops in this arch**: a maker household on a plot in its village or another, part-fed by its craft, dealing at the
fair, and on greens and at doors as those land. "Sits in a market town" is slice 9's and waits with the town (No town before the
ship). Nothing steers Erik: a custom that took his pots, a village where every farm has clay or an idle temper ends the road at year 0,
and the card says which.

**The limit, honestly** (*reckoned*): pots break a quarter a year and a household wants 8, so one that buys all its pots buys 2 a
year, 6 rations of worth. Two farms without clay buy 12 rations a year; Erik's 40 needs the gathering's district. A potter lives by
the craft only where clay is scarce: Place matters, and that is the intended result. The wrap-up counts how many do.

### 7.2 A head plans a new house for his second child

Olof, holder of Norrgård, residence custom "with whoever holds land": Erik will need a place to marry; his brother inherits.

| When | Level | What happens |
| --- | --- | --- |
| Year 2, summer | event, year | Erik begins courting Karin. The head's default author weighs `home` for him: a member who will need a place; a site in reach (`findSite`); the head's estimate of the house (clearing, felling and hauling the timber, foundation, walls, roof: about 600 h, range 450 to 800) against the spare of the seasons until the pair's likely round, when Erik is 20, three autumns away; generosity; food against the means. **Aim formed**, `by` year 5's round. Card: "Olof plans a house for Erik by his marriage (his estimate: year 4 to 6)" |
| Year 2, autumn | project | The means is today's farm for the heir: the plot begun (`startPlot`, staked, `intended` Erik) as the household's project plan, its steps naming the aim |
| Year 2, winter | season, budget | The winter budget (4 levied adults × 9.5 h × 12 days, less 2 days owed to the village: about 440 h) less the targets the household lives by (wood, water, beasts, threshing: about 250 h by the head's estimate) leaves 190 h; the aim's step takes 120 of them: the clearing |
| Year 3, winter | dated step | Timber felled on the snow (a dated step: the haul when the ground bears), carried to the site as a pile with the household's title, 120 h; Erik fells some of it in his levy, his own hours stay his |
| Year 3, summer | at risk | A poor harvest takes the summer's spare for the hay; the estimate's centre moves to year 6, after `by`. The head (unplayed) does not answer; the default author **postpones** `by` to year 6. Card: "Erik's house is late: the timber is felled, the walls wait for hands". At year 5's round the marriage waits: the gate's place to live is not met |
| Years 4 to 5 | stages | Foundation and walls in winter, the roof in late autumn before the round; the cottage's rung read from its stages (`sim/ladder`) |
| Year 5 | the child's aim | Erik's own aim agrees: his wish ranks the plot at home first. Had it ranked a plot elsewhere, the head would have been asked and by default the roof would wait for his yes; had he left, the aim would fail and the plot go back with its stages |
| Year 6, autumn | the round | The plot is given to Erik (`intended`); he marries Karin onto it: a move, his store carried. **Aim done**; the household's levy on him ends |

New against today: the house is planned three years ahead rather than begun when Erik is grown and the household has a surplus; its
work is spread over slack seasons by the budget; a poor year postpones it where everyone can see, and the marriage waits for the
house; Erik's own aim can make it wait or fail. Planning the house is the head's lever on the age his son marries at, which is how
Mechanisms, not prescriptions wants the age reached.

---

## 8. The page

An aim is a row of the strip at its **year zoom** (`README.md` 3.7), the same wherever it appears (Like is shown alike): its kind's
icon and goal; a bar from `since` to `by`; the measure on the one meter; the holder's estimate as a whisker from lo to hi with a dot
at the centre, as the outlook draws its doubt; what it waits for, in words. At the season zoom its steps show against the budget.

- **The pawn's card**: its aims and its household's aims for it ("Olof plans a house for Erik by his marriage"); its store as a row
  of goods, a graded good as the strip of five; its year's income from others against its need.
- **The head's view**: a row a member, with the member's aims and the household's aims for it side by side, marked where they bear
  on each other; each household aim's share of the season's budget.
- **Steering**: `aim` (form from the kinds open, a closed one with its check's reason; revise `by`; drop, with what it loses; keep);
  as a member, ask a lighter levy citing an aim, goods offered; as head, grant, back a member's aim, give a portion. A decision point
  opens the aim's row with its question.

---

## 9. Cost

At the late reference (about 1,000 living, 200 households; `docs/cost.md`), *reckoned* from the design's cadences; each task measures
its line, and the wrap-up on a late save.

| Work | Entities × cadence × work | A game day |
| --- | --- | --- |
| A pawn's review and the craft weighing | about 700 adults with own hours × 4 asking days a year × about 15 reads (demand read from the ~10 households of its village and the gathering's counts; no pass over pairs) | ~900 reads, under 0.05 ms |
| A household's aims | 200 households × 4 reviews × 1 to 2 aims × tens of reads | ~300 reads, under 0.05 ms |
| `home`'s events | about 100 sixteenth birthdays and courtships a year, one weighing each | negligible |
| Personal stores | about 700 stores of a few numbers, read where a job, a move or a swap runs; `pawn.trade` folded yearly | nothing in a step; a few KB of a save |
| Own makings; fair lots | under 5% of hours worked, as tasks like any; a few dozen pawn lots a gathering | inside the jobs and the fair's lines |

Claimed: under 0.3 ms a game day, a year's mean. Nothing polls (reviews are on due days and events); no loop over pairs; aims done,
failed or dropped leave the live list at the season's fold.

---

## 10. What it changes in today's design

| Where | It was | It becomes |
| --- | --- | --- |
| design.md 7, Plans at four scales: The year; The build and its gate | a pawn's aims "wait for slice 8"; the order ends "own hours as a livelihood with slice 8" | aims of a pawn and of a household for a member; the order ends with aims and personal goods, in this arch |
| design.md 7, The levy: What own hours are for; Own hours, booked | "Before slice 8"; kept: "later an aim" | an aim of its own among the uses; kept includes an aim's hours |
| design.md 7, The levy: Own hours as a livelihood | from slice 8; waits for personal goods, skill that grows, a town, a right to the material | **Replaced** by Aims and personal goods: built here; skill grows for crafts already (VB-360); the material is the household's right held by its members; the town stays slice 9's |
| design.md 7, How a holder chooses: projects | the menu's farm for the heir | the household aim `home`, formed ahead of a member's marriage |
| design.md 5, Households and other bodies: Who owes | no personal debts until personal goods (silver, slice 8); no personal estate needed | personal goods exist and pass by custom at death; personal debts still slice 8's |
| design.md 4, The portion; 9, The fair; 15, Decision points | the servant's stake; a dealer carries its household's margin; the list | the stake is the servant's store; a lot names its owner; the aims' points added |
| `docs/slices.md` 3.8; `target-v2.md` 4.4 | personal goods with silver; `PersonalEstate` passes goods, land, debts | slice 8 keeps silver, personal debts and things of worth; `PersonalEstate`'s goods part is built by the arch `plans` |

No Decided point moves but by Kim's answer 21.

---

## 11. Decisions, close calls and questions

### Decisions, with reasons

1. **An aim is a year step with a goal, a `by`, an author and a measure, opening no task.** The record already names `{aim}`;
   hours are counted at the season and the day only.
2. **A pawn holds aims only while it has own hours; the head pair's are the household's.** The head pair is not levied (answer 10).
3. **Kinds are a registry declared by their domains; four: `craft`, `home`, `trade`, `portion`.** Two for the examples, two for a
   head's aims for a member; another craft is an ordinary decision.
4. **Aims extend, never duplicate: the wish and the project menu stay; `heir` becomes `home`.** One truth a thing.
5. **Progress is read from the world; the aim keeps a season's tally.** Progress lives in the world.
6. **When it will be done is the holder's estimate, by the doing's reckoning.** The future is someone's estimate; One quantity.
7. **An aim at risk is its author's; unanswered, postponed, scaled down or dropped by its own weighing; never ended by a count of
   years; it names what it waits for.** A wait is the thing waited for; the take-back.
8. **The default author forms on a threshold at fixed decision points; no draw.** A judgement is never a die; cheap.
9. **One verb, `aim` (form, revise, drop, keep), with the kind's check.** Every act is a pawn's; parity.
10. **A pawn's aim in its own hours (`kept`), a household's in its budget and stores.** The levy is the coupling (answer 2).
11. **A member's aim and the head's plan meet only through the levy's acts, each weighing the other's aim.** Nothing new is needed.
12. **The head's aims for a member are household aims with `for`.** Position works through fate (answer 13).
13. **Levy hours may be bought with goods at 3 rations a day.** The renegotiation needs a price; one rate with the outer levies'.
14. **Title follows the hours.** It is what own hours are for (answer 6), and what makes the levy a hold and not a cage.
15. **The pawn's store is the stake widened; the servant's portion is its grain.** Unify what is the same.
16. **Custody is the keeper's house; the store moves with the keeper by its journey; the rest is a titled pile.** Nothing teleports.
17. **The head pair holds none.** One plan, one purse; a founding already pours stakes in.
18. **Material is the household's right held by its members.** No new right, and it ends with membership as the levy does.
19. **The household's share is a custom (`own`); beyond it, taking is a breach booked as goodwill.** No source; symmetric with hours.
20. **At death, by `personalEstate`; custody stays.** Nothing is left to no one.
21. **A pawn holds only what wears or is eaten.** What does not wear needs a way out; the minimum.
22. **A fair lot names its owner; a dealer may carry a member's.** The fair exists; a father takes his son's pots.
23. **Income from others is a fold on the pawn.** The pawn moves; the ledger is its household's.
24. **No new skill rule.** Crafts grow (VB-360) and grade (VB-761); neither example needs more.
25. **`sim/aims` is renamed `sim/projectmenu`.** A menu of projects named aims would mislead (naming is very important, Kim, 15 Nov).
26. **The road stops at a maker household on a plot; the town is slice 9's.** No town before the ship.
27. **A `home` aim is formed ahead (16, courting, betrothal), placed in slack seasons, and waits for the member's yes before the
    roof.** A house is what a marriage waits for; the roof is the stage worth holding back.

### Close calls

- **The pawn's own store (chosen) or titled lots in the household's.** Lots keep one store a house, but custody would be the
  household's and a store that follows its keeper would split at every move; the stake already follows its keeper.
- **The head pair holds none (chosen) or every pawn a store.** A farmer's own chest is historical, but holds things of worth (slice 8);
  with goods that wear, a second purse for one plan doubles the books.
- **`ownMaking` defaults to `own` (chosen) or `household` until married.** No source either way; `own` gives the levy its point.
- **Aim hours booked `kept` (chosen) or a seventh part.** A seventh would show crafts on every strip but break Kim's six; the aim's
  tally shows them.
- **The roof waits for the member's yes (chosen) or is finished regardless.** A late house against a wasted roof.
- **At death, the spouse first (chosen) or the household.** The spouse is the historical heir of movables.
- **Income as a fold on the pawn (chosen) or a read of the ledger.** The ledger is the household's and the pawn moves.
- **Rename the old module (chosen) or call the new one `sim/goals`.** "Goal" is the task's; the record and Kim say "aim".

### Questions for Kim, each with a proposed answer

1. **The default of the custom of a member's own making?** Proposed: `own`, with `share` and `household` as a village's
   alternatives. *Why:* no source decides it, and `own` makes own hours a road.
2. **Does the head pair hold personal goods?** Proposed: no; theirs goes into the household. *Why:* one plan, one purse, until things
   of worth give a head something of its own.
3. **Who inherits a pawn's goods?** Proposed: spouse, children equally, the household it lived in, nearest kin's household, the
   village. *Why:* Nothing is left to no one, in the commonest historical order for movables.
4. **Is the labour budget the limit on a holder's parallel large projects (VB-1472)?** Proposed: yes: any number, each sized to the
   season's spare after what the household lives by, ranked by `by`. *Why:* the levy gives the mechanism, it needs no count, and the
   home aim needs an answer.
5. **May a member buy levy hours with goods at 3 rations a day?** Proposed: yes, by the head's judgement. *Why:* the potter's
   renegotiation needs a price, and one rate is simplest.
6. **May a pawn hold an animal or a thing of worth before slice 8?** Proposed: no. *Why:* the way out of a thing of worth, and a
   pawn's pasture right, are not built.
7. **Should skill at the types of work grow too?** Proposed: not in this arch; slice 7's traits are its place.
8. **Which crafts may a pawn's aim take?** Proposed: any whose making exists and needs no facility the pawn cannot use; pottery
   first; spinning and weaving (a daughter's chest) follow with no new rule.
9. **A house for a daughter?** Proposed: by the residence custom: under "with whoever holds land", any member who will need a place;
   under "the husband's", a daughter gets a `portion`.

**Principle candidate** (for Kim to accept or strike): *Title follows the hours.* What a pawn makes in its own hours is its own, and
what it makes in hours another body holds is that body's; a body's hold on a member's goods is a custom, like its hold on its hours.
Decisions 14 and 19 rest on it; no principle names it.

---

## 12. The path: the tasks

In the arch `plans`, after the plan record (step 4) and the levy (step 6), before the wrap-up (VB-1773). Each behaviour-changing
task carries the arch's gate (`README.md` 3.10; `tools/gate.js`, VB-1774).

| ID | Task | Size | Waits for |
| --- | --- | --- | --- |
| VB-1781 | Refactor: `sim/aims` renamed `sim/projectmenu` | S | nothing (ready) |
| VB-1782 | A pawn's store: the stake widened, custody with its keeper, the head pair's poured in, at death by custom | M | VB-1749 |
| VB-1783 | What a pawn makes in its own hours is its own: tasks a pawn owns, material by the household's right, `ownMaking`, `give` between persons | M | VB-1782, VB-1762, VB-366 |
| VB-1784 | The aim record and the verb `aim`: kinds, the season review, measure and estimate, at risk, waiting, decision points | M | VB-1781, VB-1755, VB-1757, VB-1778 |
| VB-1785 | A household's aim `home`: a house for a member, planned ahead of its marriage | M | VB-1784 |
| VB-1786 | A pawn's aim `craft`: the potter in his own hours | M | VB-1783, VB-1784 |
| VB-1787 | A pawn's goods at the fair: a lot with its owner, and income from others | M | VB-1782 |
| VB-1788 | The head's aims for a member, `trade` and `portion`, and levy hours bought with goods | M | VB-1786, VB-1763 |
| VB-1789 | Leaving home as a maker: the wish reads the craft's income; the store goes into the new household | S | VB-1786, VB-1787 |
| VB-1790 | The page: aims at the year zoom, on the card and in the head's view; the pawn's store | M | VB-1784, VB-1782, VB-1765 |

The wrap-up gains: aims formed, done, dropped and waiting by kind and by what they wait for; makers who left home, and where to;
homes built ahead and the marriages that waited for them, beside the age at first marriage; pots made in own hours and worth got;
the cost on a late save against this document's 0.3 ms.
