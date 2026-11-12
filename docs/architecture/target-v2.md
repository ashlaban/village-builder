# Target architecture, version 2

Written on 3 November 2026 in a design conversation between Kim and Claude, in 17 batches: a review of the external target
architecture (`target-architecture.md`, ChatGPT), a reshaping of its layers and domains, interface sketches tested against concrete
cases from the game's design, and two reflections on how the pieces interact. It supersedes `target-architecture.md` as the
project's target. It builds on `docs/review-architecture.md` and on the ownership map (`ownership.md`, VB-172), which it does not
replace: the map says who writes what today, this says where the code is going.

This is a target, not design truth. `design.md` stays the design; where this document implies a change to a Decided or Agreed
point there, it says so (section 11), and the change goes through a design pass first. No code changes here.

Status words follow `design.md`. **Decided** (written "Decided, Kim, 3 Nov") marks Kim's answers in the conversation; section 8
lists them all. **Proposed** marks what Claude proposed and Kim has not yet ruled on. Interfaces are TypeScript-style types, chosen to fit the
JavaScript repo: sketches of shape and ownership, not code to build. The full batch sketches (`interfaces-batch2.ts` to
`interfaces-batch16.ts`) were working files; this document carries their final form, with every later correction applied.

Revised in place on 9 November 2026 after a review of this target against the code (Kim's decisions 25 to 30, section 8). Two
conventions for the sketches follow from it: `| Refusal` on an owner's write means the paired query refuses (4.1, Workflows), and a
`step(st, dt)` is built under the rules for cost (`docs/roadmap.md`, 5.3: decay lazily, schedule what falls due), not as a daily pass.

## 1. In short

- **The form holds.** Domains own truth, processes coordinate, infrastructure serves: the external review's three parts, and what
  the code already does. Sixteen batches of probes and three whole-system traces (section 7) needed no new layer after the first batch.
- **Five layers** (world and kernel; material and land; social; agency; derived views) plus the player. Calls go downward; reads are
  free; influence goes upward only by commands, events, or three declared hooks (section 3).
- **The review's domain list was reshaped in five places:** one Obligations domain for every explicit claim (goodwill, debt, rent,
  tithe, tax, toll, wage, shares); Exchange narrowed to mechanisms; typed resources with subtypes; culture as a policy provider;
  derived views for strata, settlement tiers, regions and balance probes.
- **Goodwill is a currency.** A pawn-pawn balance beside opinion, coupled to it by custom; trade in whole lumps leaves a residual that
  goodwill absorbs; silver, divisible by weight, shrinks it. Need decides whether a deal is accepted; customary worth decides what
  it was worth.
- **Nothing is posted.** Work is available (computed from rights and state), becomes a task only through someone's plan (a holder's
  routine or seasonal plan, the meeting's yearly decision), and is taken by those eligible (members, debtors, helpers, the hired).
- **Bodies:** one membership graph with rules per kind (proposed, after the succession probe), founded only when something needs an
  identity of its own. The estate is a derived view until its holder gains rank.
- **Land is a bundle of rights that point at rights,** so ownership can pass (to an heir, a creditor, an estate) while tenancies
  stand. Foreclosure usually changes who is owed, not who farms: the main road by which the elite grows.
- **One reach query** over land, water, ice and roads, by person-hours and by freight; transport cost is the coupling between
  geography and society, through the draw of every gathering.
- **About twenty balance loops,** declared with probes and setpoints, calibrated fast loops first. Full-simulation bands are reported
  nightly; reduced scenarios are asserted.
- **Twenty-one modules** besides the page, against 43 on 3 November and 48 on 9 November; many of today's become kind rules,
  providers or contributions inside them. The count is not a goal: the owner boundaries are.

## 2. Principles

These are the invariants. Each later section applies them; a change that breaks one needs a design decision, not a code review.

1. **Domains own truth; processes coordinate; infrastructure serves.** A domain owns its state and the rules about it. A process
   (a workflow, a decision, a plan) coordinates domains and owns only its own progress. (External review, kept.)
2. **One writer per field, and per cache.** Every field of `st` has one owning module (VB-173's owners table). A derived cache
   (`pawn.household`, `st.owner`) has one writer too, and a check that it equals what it is derived from.
3. **Layers.** A module calls its own layer and those below; reads are free everywhere (Decided, Kim, 9 Nov). It acts upward only
   by issuing a command, emitting an event, or one of three declared hooks: a rule contribution, an escalation target, a procedure
   choice (section 3.2).
4. **Opportunity, plan, task and activity are four things.** What could be done is computed and never stored. What will be done is
   a plan's. What is to be done now is a task, held by a party. What a pawn is doing is its activity. Nothing is posted.
5. **Rights, ownership, authority and possession are distinct; so are title and custody.** Who owns a cow and where it stands;
   whose grain and which mill holds it; whose cargo and which boat carries it; whose building and whose land it stands on.
6. **Rights point at rights, not at holders.** A tenant's use right hangs off the owner's own right, so the own right can pass and
   the tenancy stands.
7. **Class, occupation, settlement tier and region are derived, with hysteresis.** They are computed from rights, obligations,
   stores and hours of work, never stored as truth. Only rank (frälse, clergy, burgher) is stored: an institution grants it.
8. **A body exists only when something needs its identity:** holdings, obligations owed to or by it, an agent, or a succession
   distinct from its members'. Otherwise it is a derived view.
9. **Every explicit claim is an obligation;** goodwill is the unspecific balance between persons. Obligations name what is owed;
   their consequences (labour days, a field) are workflows run by the enforcer, not side effects of marking a default.
10. **Decisions aggregate; commands carry out.** The domain that poses a question owns what its options mean and acts on the
    outcome by commands. Decisions owns only procedures, sittings, ballots and escalation. A command decides nothing (VB-167).
11. **Rules combine contributions.** A quantity is owned by one domain; other domains contribute factors or terms to it, declared
    with a range. Traits and derived views act on behaviour only this way, or through a decider's evaluation.
12. **Custom is read through one door.** Everything that varies by custom asks `Culture.inForce` or `Culture.norm`; no module reads
    practice arrays. The door is in the kernel layer, because every layer asks it; what changes custom is social (3.1).
13. **Distance has one source.** Every consumer of distance (fairs, mills, marriage, culture drift, arbiters, regions, venues,
    news) asks the reach query, so they agree.
14. **Level of detail by cadence, not by a second model.** Off-map pawns follow the same rules at a coarse cadence; the outside
    world acts through the ordinary owners.
15. **The player is a source.** The player's pawn enters by the same four doors as any pawn (section 4.7), without privileges.
    Traits act on what happens to the player's pawn, never on what the player chooses.
    Parity of command (Kim, 10 Nov): every act a pawn may take is a verb the player can issue, in whatever position its pawn
    holds, unless a gameplay reason against it is written beside the verb; a pawn's own logic and the player choose among the
    same verbs under the same checks. The player may be offered more options than the pawns' logic uses (a cheap chooser must
    serve 1,000 pawns); never fewer. So a decider's choices are arguments of a command, not branches inside the system.
16. **Deciders read through an actor view.** Omniscient today; the seam where knowledge will come in. Stories (gossip) are its
    first content.
17. **Balance loops are declared, measured and tuned, never steered at run time.** Equilibria emerge; a loop's band is a probe's
    target, not a controller's.
18. **Determinism.** Plain data in `st`; registries (rules, recipes, kinds, verbs, event subscribers, question kinds) are code,
    built at load; contributions and subscribers run in a fixed order; every random draw comes from a named seeded stream.
19. **A command changes everything or nothing.** Refusals come from queries and from a command's check, never from an owner's
    write (4.1, Workflows; Decided, Kim, 9 Nov).

## 3. Layers and modules

### 3.1 The layers

| Layer | Modules | What they own |
|---|---|---|
| Derived views (read-only) | `derived` | Class and occupation, settlement tier, regions and central places, desire lines, probes and loops |
| Agency and coordination | `decisions`, `plans`, `work`, `exchange`, `enforcement`, `outside` | Questions and sittings; plans, occasions and tasks; matching; deals; cases; voyages |
| Social | `persons`, `relations`, `membership`, `obligations`, `culture`, `encounters`, `institutions` | Traits and skills; opinion, goodwill, memories, stories; bodies and roles; claims; attitudes, drift and what changes custom; who meets whom; the Crown and the Church |
| Material and land | `stores`, `land`, `facilities`, `production` | Goods and custody; holdings and rights; built things, ways included; recipes and their runs |
| World and kernel | `world`, `movement`, `kernel` | Terrain, ecology and climate; modes, vehicles, worn ways and reach; time, the calendar, seeded streams, commands, events, records, saves, the rules registry, the customs in force (read side) |
| Player and presentation | `page` | What the player sees and the commands it issues |

Twenty-one modules besides the page, against 43 today. Most of today's modules survive inside them: `herds`, `meadows`, `byre` and `fields` as
domain steps and job kinds in `production` and `world`; `heirs`, `cottage`, `settle` and `farmclaims` as kind rules and workflows in
`membership`; `claims`, `stakes`, `territory` and `ownership` in `land`; `help` as a mechanism in `exchange`; `jobs` as `work`.

Three placements matter most. **The customs in force sit in the kernel** (Decided, Kim, 9 Nov): the practice and norm tables and
their read functions (`inForce`, `norm`) are plain data any layer may ask, as land does for contested claims and passage, movement
for `move.cost` and enforcement for the remedy; `culture`, in Social, is their only writer (attitudes, drift, sittings, doctrine,
the resolver). It is the registry's shape: a low table that higher layers fill. **Material and land sits below Social:** stores and rights refer to
holders by opaque `PartyRef`, so a
pawn, a household, a church or a ship can hold goods and land without those modules knowing what a household is. **Derived views
sit on top:** they read everything and write nothing but their own classifications.

### 3.2 The three upward hooks

Reads are free (the project's rule), so the layers constrain calls and writes. Influence on a lower layer's behaviour from a
higher one goes only through:

1. **Rule contributions** (section 4.1): the landed class lowering a holder's priority for field work; a trait raising allowance.
2. **Escalation targets** (section 4.5): an undecided dispute going to an arbiter that a derived view names.
3. **Procedure choice** (section 4.5): which procedure a body uses for a kind of question, read from custom.

Each is declared in a registry, so a lint (`tools/rules.js`, beside `tools/writes.js`) can list every upward influence; a
contribution that reads something it has not declared is the hidden coupling this rule exists to catch.

A lower layer's act reaches a higher layer in two ways, both in the kernel (4.1):

- **Events** (Decided, Kim, 9 Nov): the lower module emits; higher modules subscribe at load, and run at once, in load order. A
  subscriber reacts and cannot veto. It replaces a land module calling `remember` (a claim taken, a border lost, a bull lent).
- **Commands:** each domain registers its own verbs at load, as it does rules, so `sim/commands` imports no domain and a verb's body
  lives with its owner. A lower layer issues a verb only for a consequence its own act completes (a cottage finished).

Measured on 9 November, with today's modules placed in these layers: 29 of 250 calls between modules go upward. Sixteen are
`sim/commands` importing or looking up its verbs' modules, five are land modules calling `remember` or `tieOf`, five read custom
from `culture`, and three are odd ones (`hunger` for a constant of `relations`; `heirs` and `births` to `agents`). The first three
groups are what the two channels and the kernel's door remove.

### 3.3 The calendar

`sim/clock` holds rules today (`ownership.md`, section 1). In the target it holds only an ordered schedule: each domain registers
its steps at its natural rate (hourly agents and encounters; daily stores and attitudes; each holder's
planning day; seasonal fairs and plan reviews; yearly meetings, strata and culture; voyages by season). Their order is design and is
declared in one table, because it decides outcomes (what decays, such as goodwill and worn ways, has no step: it is read in closed
form, by the rules for cost): in autumn, harvest, then stores, then dues, then plans, then the meeting
(autumn day 10), then the moving round (day 11).

The table exists (VB-241, 12 November): `CALENDAR` in `src/sim/clock.js`, entries by step, hour, day, season or year, or at a named day and
step, each with its owner; `node tools/sim.js --report calendar` prints it, and `tests/clock.js` holds its order.

## 4. Domains

### 4.1 Kernel

Time and the calendar (3.3); seeded streams (`st.rng.*`, one per concern: `deaths`, `talk`, `outside`, and so on); commands (VB-167,
VB-169: one verb per kind of change, `source: 'player' | 'pawn'`, registered by its owner); events and their subscribers (3.2); the
record (the chronicle); saves (plain data, versioned); the customs in force (3.1).

**Workflows** (Decided, Kim, 9 Nov). Today a command checks, then runs, and no owner's write refuses; the target keeps that.

1. A refusal comes only from a query or from a command's check. An owner's write throws if its precondition is false.
2. Every write that can be impossible has a paired read-only query that gives the reason (`LandRights.may`, `Stores.available`). A
   workflow's check is the conjunction of its owners' queries, so no check copies an owner's rule.
3. A workflow that spans ticks (a case, a plan, a building, a voyage, a succession) keeps its progress as data with its process
   owner. Each tick's step is one command; the states between steps are named and legal.
4. An event's subscriber cannot veto; a command it issues and is refused changes nothing further.

**The rules registry** is the kernel's one new piece. A rule is a quantity one domain owns; contributions from other domains combine
into it. Today's `deathRoll` is already one in small (base hazard by age, times one plus hunger, times frailty, with one draw naming
the cause by which share it fell in).

```ts
interface RuleSpec<C> { id: RuleId; owner: string; combine: 'product' | 'sum' | 'min' | 'max';
  base(st, ctx: C): number; clamp?: [number, number]; attributes?: boolean /* shares name causes */ }
interface Contribution<C> { rule: RuleId; source: string; key: string; label: string; cause?: string;
  range: [number, number]; tunables: string[]; value(st, ctx: C): number }
interface Rules {
  declare<C>(spec: RuleSpec<C>): void; contribute<C>(c: Contribution<C>): void;     // at load only
  value<C>(st, rule: RuleId, ctx: C): number;                                        // hot path, no allocation
  explain<C>(st, rule: RuleId, ctx: C): { value: number; base: number; parts: Part[] };   // panel, causes, probes
  compile(rule: RuleId, grid: string, dirty: string): void;   // a rule used in an inner loop, kept as an array, rebuilt on a dirty flag
  list(): ReadonlyArray<{ rule: RuleId; owner: string; contributions: ReadonlyArray<{ key; source; range }> }>;
}
```

Rules named so far, in two groups. **Quantities** combine into one number: `death.hazard`, `conception`, `work.rate`, `yield`,
`allowance` (owned by relations), `attitude.malleability`, `move.cost` (compiled into a cost grid per mode set and season).
**Scores** feed a chooser that their owner keeps: `marriage.ready` (a gate), `work.priority` (per pawn and task), `leisure.choice`
(among options); the registry gives each option's score, never the choice. A continuous derived value may feed a contribution
directly; a categorical one (class, tier) only through its hysteretic value.

Built so far (VB-197): `declare`, `contribute`, `value`, `explain`, `list`, with `product` and `sum`. The review of 9 November adds:

- A contribution's `source` is the module that registers it, checked by a lint; else the list of upward influences is hearsay.
- A `product` rule's ranges are tight (hunger: 1 to 2.5); a `sum` rule's may be left open, since a bound of ±1e9 checks nothing.
- **Causes do not depend on load order** (Decided, Kim, 9 Nov). A product's excess over its base is shared among contributions by
  the logarithm of each factor. Walking them in order would give the joint part of two causes to whichever module loads later.
- A contribution may not read another rule's `value`; a load-time check rejects a cycle between rules.
- `value` allocates nothing, and neither may its caller: a rule over a pair (`work.priority`) needs a context that is reused or
  passed as two arguments, and `compile` covers contexts that are a tile or a pawn.

### 4.2 World and movement

**Terrain and ecology** stay as built: tiles, rivers crossed only at fords and bridges (VB-112), forests regrowing tree by tree, fish
and game stocks. Crops, herds, forests and fish grow by their domains' own steps and the `yield` rule, not by recipes.

**Climate** (Decided, Kim, 3 Nov: frozen water opens travel where the climate is cold enough) is set at world generation by
latitude: growing season and frost windows, snow, and whether and when lakes, rivers and sounds freeze.

```ts
interface Climate { latitude: number; frozen(st, tile, t): boolean; snow(st, tile, t): number;
  season(st, t): { growing: boolean; frostRisk: number } }
```

**Movement** extends `sim/routes` with modes. A route is a list of legs; a vehicle is a good whose title Stores holds and whose
place and passengers Movement holds; goods aboard have custody `{ at: 'vehicle' }`. People and bulk goods travel differently, so
every cost has two figures: hours for a person, freight for a load. Water within 3 tiles of land costs 0.35 a tile and 3 to put out
(the cities review's figures); frozen water opens foot and sledge legs; a sledge on snow carries more than a cart.

```ts
type Mode = 'foot' | 'cart' | 'sledge' | 'boat' | 'ship';
interface Vehicle { id; lot: { holder: PartyRef; ref: number }; kind: string; at: Tile; capacity: number; crew: number;
  aboard: PawnId[]; condition: number }
interface Movement {
  modesOf(st, p: PartyRef): Mode[];                      // own boat, borrowed, a ferry bought as a service
  route(st, from: Tile, to: Tile, o: { modes: Mode[]; vehicle?: number; load?: number }): Leg[] | Refusal;
  cost(st, from: Tile, to: Tile, o: { modes: Mode[] }): { hours: number; freightPerLoad: number };
  reachFrom(st, origin: Tile, o: { modes: Mode[]; budget: number }): ReadonlyMap<number, { hours; freightPerLoad }>;
}
```

Costs come from the compiled `move.cost` rule: terrain, the worn stage, a built way and its condition, climate, and the `passage`
custom where a tile lies. Routes and reach are cached by mode set (about six distinct sets) and season, and dropped by
`st.pathDirty` when a way, a bridge, a harbour or a ford changes.

**Worn ways** stay as built in `sim/paths`: crossings counted per tile, halving each game year; trodden (50), path (200), lane (800),
with hysteresis; a walker gains ×1.05, ×1.15, ×1.3. Built ways are facilities (4.3); `Ways.factor(tile, mode, t)` combines both
for the cost rule. Roads matter little to a walker on meadow: they matter on hard ground (a causeway over marsh, a track through
forest), for wheels (a cart needs a track or better, or a field), and at crossings.

### 4.3 Material and land

**Stores** generalise VB-174's `sim/stores`. Goods are typed by a registry (not an enum, so a ship can bring a good no island
makes): kind, subtype, tags, unit, the quantum that changes hands (one head, one sack; silver by weight is nearly continuous), and
perishing. Recipes and needs ask by query: one good, any of a kind, or any with a tag.

```ts
interface GoodType { id: GoodId /* 'stone/granite', 'milk/sheep', 'cattle/cow' */; kind: string; subtype: string | null;
  tags: string[]; unit: string; quantum: number; perish?: { spoilsAfter: Tick } | { lossPerYear: number }; individual?: boolean }
type GoodQuery = GoodId | { kind: string } | { tag: string };
interface Lot { good: GoodId; n: number; quality?: number; since?: Tick; ref?: number /* the named cow */ }
type Custody = { at: 'holder' } | { at: 'facility'; id: number } | { at: 'tile'; tile: Tile } | { at: 'vehicle'; id: number };
interface Stores {
  held(st, p: PartyRef, q: GoodQuery): number; available(st, p, q): number;
  lots(st, p, q): ReadonlyArray<Lot & { custody: Custody }>;
  reserve(st, p, q, n, forWhat: Why): ReservationId | Refusal; release(st, r: ReservationId): void;
  put(st, p, lot: Lot, why: Why): void; take(st, p, q, n, why: Why): Lot[];
  move(st, from: PartyRef, to: PartyRef, lots: Lot[], why: Why, custody?: Custody): void | Refusal;   // title moves; both ledgers record
}
```

Every change names its reason (VB-174's rule). Stores own goods only: heirs' shares and other debts are obligations (4.4).

**Land** holds rights per holding, a bundle after Honoré (1961). A holding is a farm, a field split off it, a meadow, a commons, a
site, a water; it can be split (foreclosure, VB-034) or merged. `st.owner` becomes a cache that `land` alone writes (the holder of
the right that works each tile); `sim/claims` and `sim/stakes` stay as the way a party gains `own` on land no one holds.

```ts
type RightKind = 'own' | 'use' | 'occupy' | 'develop' | 'graze' | 'gather' | 'fell' | 'fish' | 'pass';
interface Right { id: RightId; holding: number; kind: RightKind; holder: PartyRef; under?: RightId;
  basis: 'inherited' | 'cleared' | 'claimed' | 'bought' | 'granted' | 'foreclosed' | 'custom' | 'charter'; since: Tick;
  term?: { until?: Tick; whileEdge?: number; lives?: number }; conditions: ObligationId[];
  status: 'claimed' | 'held' | 'contested' | 'lapsed' | 'ended'; strength?: number }
interface LandRights {
  rightsOn(st, holding, kind?): ReadonlyArray<Right>; holdingsOf(st, p, kind?): ReadonlyArray<number>;
  may(st, p: PartyRef, tile: Tile, act: LandAct): { via: RightId } | Refusal;     // the one permission question
  grant(st, under: RightId, kind, to: PartyRef, term, conditions, why): RightId | Refusal;
  transfer(st, r: RightId, to: PartyRef, basis, why): void | Refusal; end(st, r, why): void;
  split(st, holding, tiles: Tile[], why): number; claim(st, holding, p, why): RightId | Refusal;
}
```

Until the first tenancy, `own` and `use` always have the same holder, so nothing changes for the page. **Passage** (Decided, Kim,
3 Nov): the village grants a `pass` right for its own land; every other holder must agree, by deal or refusal, and that binds an
established Crown too. A new practice, `passage`, says whether one may walk across another's meadow and pasture or only along ways;
fields and yards are never crossed.

**Facilities** are built things on sites: houses, barns, byres, wells, fences, mills, ovens, smithies, quarries, alehouses, churches,
markets, harbours, and every built way (tracks, roads, causeways, bridges, ferry landings, streets). The external review's triad
(place, operator, activity) for venues and workplaces alike. A facility owns its own state, building progress included, so a
half-built mill outlives any plan.

```ts
interface Facility { id: FacilityId; kind: FacilityKind; stretches: Array<{ tiles: Tile[]; condition: number }>;
  via: RightId[] /* the land rights it stands on or crosses */; owner: PartyRef; operator?: PartyRef;
  state: 'planned' | 'building' | 'standing' | 'worn' | 'ruined'; progress?: number[];
  capabilities: Capability[]; access: Access; duty?: { basis: 'village' | 'estate' | 'crown'; perHolding: Deliverable } }
interface Capability { id: 'grind' | 'bake' | 'forge' | 'brew' | 'quarry' | 'store' | 'serve' | 'gather' | 'worship' | 'trade'
  | 'moor' | 'cross' | 'carry' | string; recipes?: string[]; capacity: number; needs?: 'wind' | 'water' | 'fire' }
interface Access { who: 'owner' | 'members' | 'village' | { reachHours: number } | 'anyone' | { custom: string };
  toll?: number; fee?: Deliverable; hours?: [number, number] }
interface Facilities {
  get(st, id): Readonly<Facility>; at(st, tile): ReadonlyArray<FacilityId>;
  usable(st, p: PartyRef, cap: string, from: Tile): ReadonlyArray<{ id: FacilityId; hours: number }>;
  found(st, kind, stretches, owner, via: RightId[], why): FacilityId | Refusal;   // a project: its stages become plan steps
  use(st, f, user: PartyRef, cap: string, why): number | Refusal;               // access, capacity, hours; the toll from the output
  lease(st, f, operator: PartyRef, term, rent: Deliverable, why): ObligationId; transfer(st, f, to, why): void;
  step(st, dt): void;   // wear by traffic and season; a road falls to a track, a track to the worn way; a bridge below 20% closes
}
```

A built way needs a `pass` right for each holding it crosses; a refusal leaves a gap, and the route bends around it. Wear on a
facility posts nothing: it shows as an opportunity to mend. Movement reads `cross`, `moor` and `carry`; encounters read venues'
hours and capacity; opportunities read capabilities. None of them writes a facility.

Where a sketch of this layer names something of a higher one, the higher layer's workflow makes the call and holds the reference:
the lease's rent and a toll are obligations that Exchange creates around `lease` and `use`; a right's `conditions` and `whileEdge`
are ids that Obligations and Membership act on by calling `end`; `Production.start` takes a holder and a recipe, the task being
Work's; `Production.available` returns what a recipe needs and yields, which Opportunities (4.5) wraps.

**Production** holds recipes: human transformation only. A recipe's input can bind the subtype that matched, so `hew/block` turns
any stone into blocks of the same stone and `cheese` turns sheep's milk into sheep's cheese, without a recipe per subtype.
Construction is a recipe too, whose output is a facility's stage, so making and building share one execution path.

```ts
interface Recipe { id: string; inputs: Array<{ q: GoodQuery; n: number; bind?: string; consumed: boolean; wear?: number }>;
  outputs: Array<{ good: string /* 'block/$S' */; n: number }>;
  labour: { hours: number; work: WorkType; skill?: string; attention: 'full' | 'partial' | 'background' };
  at: { capability: string } | 'hand'; wait?: Tick; when?: { seasons?: number[]; indoor?: boolean };
  builds?: { kind: FacilityKind; stage: number } }
interface Production {
  recipes(st, q?: { output?: GoodQuery; capability?: string; work?: WorkType }): ReadonlyArray<Recipe>;
  available(st, holder: PartyRef, near?: Tile): Opportunity[];     // the craft kinds' provider (4.5)
  start(st, task: number, recipe: string, lots?: Lot[]): number | Refusal;   // reserves inputs: oldest first if they perish
  advance(st, run: number, pawn: PawnId, hours: number): void;    // outputs to the holder, in the facility's custody while waiting
}
```

The quern and the mill are two recipes for one output; the household's plan weighs hours against the toll. Spinning is a
background recipe, weaving a partial one with a loom as a tool input (section 5.4).

### 4.4 Social

**Persons** own traits and skills. Twelve traits (Decided, Kim, 3 Nov), continuous and latent (0 to 1), shown only as labels at the
tails (above the 85th percentile of generosity "open-handed", below the 15th "tight-fisted"): values after Schwartz (1992),
temperament after the Big Five, and aptitudes for families of skills.

| Group | Traits | Mostly from |
|---|---|---|
| Values | generosity, piety, ambition, honour | upbringing: parents and culture (Cavalli-Sforza and Feldman 1981) |
| Temperament | sociability, temper, diligence, openness | inheritance (heritability about 0.4 to 0.5) and chance |
| Aptitudes | body, hands, husbandry, wits | inheritance, and a childhood with or without hunger |

At birth the heritable part is the midparent value plus noise and the rest the culture's draw; the learned part then moves toward
the household and the culture until the trait sets in youth (the anchor mechanism `src/culture.js` already uses for attitudes).
Founders draw from their culture. This answers `design.md`'s open question on inherited traits.

```ts
interface Traits { of(st, p: PawnId, t: Trait): number; labelsOf(st, p): string[];
  born(st, child, mother, father): void; step(st, dt): void }
interface Skills { level(st, p, skill): number; practise(st, p, skill, hours): void }   // learning by doing; fades unused
```

Traits act only as rule contributions and through a decider's evaluation (principle 11):

| Trait | Acts on |
|---|---|
| Generosity | allowance (never the floor) |
| Ambition | craft and trade priority, pressing a debt, standing for office, emigration |
| Honour | how a breach is felt; how a lie is judged |
| Piety | going to the service; the doctrine's side in a contested key |
| Sociability | leisure choice for the alehouse and feasts, chance of talk, reach of gossip |
| Temper | cross words up, good talks down |
| Diligence | work over idling, a daily rather than weekly planning day, a member's initiative |
| Openness | per-person malleability of attitudes, the chance to advocate (today's `entrepreneur`) |
| Aptitudes | the learning rate and cap of skills, and through skill work rate and quality |

A trait earns its place by changing at least two existing rules. Pair chemistry (`compat`) becomes similarity of values and
sociability, with temper as friction, plus a seeded personal term kept from today's hash. Apprenticeship is a role edge in a
workshop (4.4, Membership) with a contribution to the learning rate, not a separate system.

**Relations** own opinion, goodwill, memories and stories.

- **Opinion** stays the one number the rest of the game reads: standing (kin, spouse, housemate), plus timed memories, plus the
  culture's coupling of goodwill.
- **Goodwill** (Decided, Kim, 3 Nov) is its own signed balance per pawn pair, in customary rations: `balance(a, b) > 0` means b
  owes a. As built (VB-217; `design.md`, The gift, is the current statement): one number per pair, decaying lazily, at most 32
  counterparts a pawn; it colours opinion by size only (gratitude; Kim, 8 Nov), and an old debt's souring is left to stories.
  Custom sets its decay and the shares passed on (section 5). The sketch's `standing` and `step` are not built.
- **Allowance** (Decided: agent to agent) is a rule owned here: how much one pawn would give up to another in one deal, with
  contributions from goodwill, opinion, kinship, need slack, generosity and custom. A household's allowance is its agent's.
  Goodwill and opinion both count, coupled as they are (Decided, Kim, 9 Nov): goodwill is the quasi-currency a deal is settled in,
  and a high opinion makes an unfavourable deal likelier to pass.

```ts
interface Goodwill { balance(st, a: PawnId, b: PawnId): number; standing(st, a, b): Tick;
  book(st, creditor: PawnId, debtor: PawnId, rations: number, why): void;
  transfer(st, from: PawnId, to: PawnId, share: number, why): void; step(st, dt): void }
interface Opinion { opinion(st, a: PawnId, b: PawnId): number }
```

**Stories** (Decided, Kim, 3 Nov: model B, after the experiment of section 10; pawns and the player may lie). A story is an event
and who was in it; a pawn keeps a few, the most salient. Witnesses and parties know it first-hand; what is said at the meeting or
the service is known to all who attend. A teller picks by salience, the hearer's tie to the subject, sociability and how often it
has been told; the hearer believes by its opinion of the teller and the story's fit (confirmation, deliberately); a story already
held is not passed on with new zeal (saturation: Daley and Kendall 1965); each retelling sharpens it (Allport and Postman 1947). A
believed story writes a secondhand memory of its subject, discounted by belief and hops. Each kind of story belongs to a domain
(trade, kin, faith, law); a lie is exposed when a hearer has a first-hand memory of the subject in that domain of the opposite
sign, and **a discovered lie is the source of a counter-story about the liar, of higher valence, by how the culture judges lies**
(Decided, Kim, 3 Nov), weighed by each hearer's honour.

```ts
interface Rumours {
  witness(st, event: number, present: ReadonlyArray<PawnId>): number | null;
  pick(st, teller: PawnId, hearer: PawnId): Known | null; tell(st, teller, hearer, k: Known): void;
  invent(st, teller, about: PawnId, kind: StoryKind, why): number; expose(st, story: number, by: PawnId): number;
  knownBy(st, p: PawnId): ReadonlyArray<Known & { story: Readonly<Story> }>; step(st, dt): void;
}
```

**Membership** (Proposed: one membership graph, rules per kind; it passed the succession probe, section 9). Bodies are households,
villages, towns, parishes, courts, estates, workshops, crews, ships and the `abroad` body; members are pawns or bodies, along typed
edges with roles (`resides`, `holder`, `spouse`, `servant`, `alderman`, `priest`, `member`, `apprentice`). Ended edges stay, as
history, outside the index of live edges that every step reads (cost rule 1). Overlapping memberships form a graph, not a tree: a parish draws
households from three villages.

```ts
type PartyRef = { kind: 'pawn'; id: PawnId } | { kind: 'body'; id: number };
interface Body { id: number; kind: BodyKind; name: string; seat?: Tile; founded: Tick; dissolved?: Tick; successor?: number }
interface Edge { id: number; from: { pawn: PawnId } | { body: number }; to: number; role: string; since: Tick; until?: Tick }
interface Membership {
  body(st, id): Readonly<Body>; edges(st, q: { to?; from?; role?; live? }): ReadonlyArray<Edge>;
  holderOf(st, body, role): PawnId | null; link(st, from, to, role, why): number | Refusal; unlink(st, edge, why): void;
  found(st, kind, seat, links, why): number;                     // the one founding act (ownership.md 7.2)
  dissolve(st, body, successor: number | undefined, why): void;
  reside(st, p: PawnId, household: number, why): void | Refusal;  // who comes along: the household kind's rule, on every move
  succeed(st, body, role, vacancy: Vacancy, why): PawnId | Refusal;
}
interface KindRules { kind: BodyKind; roles: Record<string, RoleRule>; agent(st, b): PawnId | null;
  voices(st, b): Array<{ pawn: PawnId; weight: number }>;   // for Decide only
  needs: Needs; procedures: Partial<Record<QuestionKind, Procedure>>; escalateTo(st, b, kind): PartyRef | null;
  candidates(st, b, role, vacated): PawnId[]; passedOver?(st, b, heir, vacated): ObligationDraft[] }
```

Succession is one pipeline for every kind: vacancy, candidates, the body's choice, eligibility, relinking, the move to the seat,
the old holder's new role (`undantag`, former alderman), prestige, the claims of those passed over (the household's only kind-specific
step: siblings' shares as obligations), derived roles, the record. Holdings and the body's own obligations need no step: they belong
to the body. Goodwill is personal: at retirement a share passes to the new holder, set by custom (Decided, Kim, 3 Nov); at death
`PersonalEstate` passes the pawn's own goods, land in its own name, personal debts and a share of its goodwill to its heirs as
persons; office goodwill never passes. A testament is the practice `birthOrder: 'chosen'` (Decided: only where custom allows).
The household hot path keeps a derived cache (`pawn.household`, `hh.members`, `pawn.role`) that Membership alone writes, and role
rules declare the household's cardinality (one residence per living pawn, at most one holder).

**Obligations** are every explicit claim: deal, loan, share, rent, tithe, tax, toll, wage, dowry, fine, service. Goodwill is the
unspecific balance; an obligation names what is owed, when, and who enforces it (none: social only).

```ts
interface Obligation { id; debtor: PartyRef; creditor: PartyRef; basis: Basis; source?: { deal?: number; right?: number };
  owes: Deliverable; due: Tick | [Tick, Tick]; every?: Tick; enforcer: PartyRef | null;
  status: 'open' | 'part' | 'met' | 'overdue' | 'defaulted' | 'forgiven'; delivered: number }
type Deliverable = { goods: Lot[] } | { labour: { hours; work: WorkType; site?: Tile; window: [Tick, Tick] } }
  | { claim: ObligationId } | { service: { facility: FacilityId; capability: string; amount: number } };
interface Obligations { create(st, o: ObligationDraft, why): ObligationId; due(st, p, as, window?): ReadonlyArray<Obligation>;
  fulfil(st, id, part: Deliverable, why): void | Refusal; forgive(st, id, by): void; transfer(st, id, to, why): void; step(st, t): void }
```

A deal names the party it binds, at the time of the deal: the holder borrowing for the household or for himself. The player's
screen must show which.

**Culture** is a policy provider over four kinds of content:

| Kind | What | Changes by | Examples |
|---|---|---|---|
| Practice | a shared rule with options | sittings; attitudes drift (today's 14 customs) | heirs, voice, how debts are paid, who judges in his own cause, who cooks and spins, passage, procedures |
| Norm | a usual quantity learned from what people do | evidence, weighted by reach | customary worth of each good, a fair toll, the usual marriage age, whether coin is taken |
| Doctrine | an institution's rule on the keys it claims | establishment | the Church's kin limit; later the Crown's law |
| Value distribution | each culture's mean and spread for the value traits | as the culture drifts | an honour culture, a pious one |

```ts
interface CustomSpec { key: string; label: string; kind: 'practice' | 'norm' | 'doctrine'; options?: Array<[string, string]>;
  m: number; jurisdiction: Array<'church' | 'crown' | 'court' | 'settlement' | 'culture'>; readBy: string[] }
interface Culture {
  inForce<T>(st, key, ctx: { at: Tile; actor?: PartyRef }): { value: T; source: Holder; contested?: Array<{ holder; value: T }> };
  attitude(st, p: PawnId, key): ReadonlyArray<number>; norm(st, key, ctx: { at: Tile; good?: GoodId }): number;
  observe(st, key, at: Tile, evidence: number, weight: number): void;   // norms learn from deals, weddings, tolls
  claim(st, institution: number, keys: string[], doctrine: Record<string, string>, why): void; step(st, dt): void;
}
```

A key is in force from the highest holder in its jurisdiction list that has ruled on it for that place. A lower holder whose ruling
differs leaves the key **contested**, which is a state, not an error. **The resolver** (Decided, Kim, 3 Nov): yearly, pressure grows
with the institution's enforcement, the share of pawns favouring the doctrine (sermons push it) and the years contested; past a
threshold the practice tips to the doctrine; while contested the key's malleability is raised, so minds move fast both ways; a
polarised faction with dense ties and a leader can split off as a splinter of the institution, as cultures split today. Per-person
malleability is the rule `attitude.malleability` (the key's own, openness, a contested key, a town's faster drift). About ten new
practices and four norms join today's 14 customs (about 80 attitude options per pawn); `tools/customs.js` lists each key's readers.

**Encounters** own who meets whom. Today's two kinds stay exactly as built (housemates inside; outdoors within 30 units, by cells),
so the golden file holds; venues and work sites add kinds. An occasion is a plan (4.5); Plans opens and closes a venue's gathering
by a call down to Encounters, which never reads plans. An encounter rule says how a kind of gathering mixes people (kin,
village, stratum or rank, age bands), how often they talk, which acts happen (chat, good talk, cross words, courting, gossip,
sermon), and how much the meeting counts in culture's social pull. Encounters have only social effects: deals, matches and hiring
arise in agency from who is present.

```ts
interface Encounters { step(st, hour: number): void; present(st, venue: FacilityId): ReadonlyArray<PawnId>;
  contactsOf(st, p: PawnId): ReadonlyArray<{ other: PawnId; weight: number }> }   // read by culture, instead of st.contacts
```

**Institutions** are the Crown and the Church. Before contact they have no body (Decided, Kim, 3 Nov): the implicit Crown is the
landed class, and a landed big man can be its arbiter; the implicit Church is a priestly role by a settlement's practice, and each
pawn's spiritual life (piety, sacred sites as facilities); offerings to an implicit priest are gifts, not obligations. Only an
established institution grants rank or takes tithe and tax as obligations; contact (a ship, an envoy, once there is a port)
founds it, and `absorb` meets the implicit holders: confirmed, replaced or contested.

```ts
interface Institutions { establish(st, which: 'crown' | 'church', contact, why): number; absorb(st, inst, why): void;
  splinter(st, from: number, faction: PawnId[], doctrine: Record<string, string>, why): number }
interface Rank { grant(st, by: number, to: PawnId, rank: string, terms: { obligations: ObligationId[] }, why): void | Refusal;
  rankOf(st, p: PawnId): string | null }   // a rank edge to the granting body; granting founds the holder's estate body
```

### 4.5 Agency and coordination

**Decisions** aggregate and do nothing else. A question is posed by the domain that owns its consequences (Membership for heirs,
Culture for customs, Enforcement for cases, Plans for projects, Institutions for appointments), with its options and a preference
function read through each participant's view. Which procedure a body uses for which kind of question is a practice of its culture,
with defaults from its kind's rules: one village's meeting votes by prestige, another's defers to its elders, a third needs consensus.

```ts
type Procedure = { kind: 'custom'; rank: string } | { kind: 'agent' } | { kind: 'consult' }
  | { kind: 'vote'; voice: 'prestige' | 'equal' | 'land'; quorum?: number; majority?: number } | { kind: 'consensus'; veto: number }
  | { kind: 'appoint'; by: number } | { kind: 'policy'; id: string } | { kind: 'lot' };
interface Question<T> { id; kind: QuestionKind; body: PartyRef; poser: string; options: T[];
  evaluate(view: ActorView, pawn: PawnId, option: T): number; interested?: PartyRef[]; deadline?: Tick; fallback?: T }
interface Decisions {
  procedureFor(st, body: PartyRef, kind: QuestionKind): Procedure;
  ask<T>(st, q): { decided: Decision<T> } | { pending: QuestionId };   // queued when a sitting or the player is needed
  answer<T>(st, q: QuestionId, pawn: PawnId, option: T): void | Refusal;   // the player's answer, as a command
  agenda(st, body): ReadonlyArray<QuestionId>; outcome<T>(st, q): Decision<T> | null; step(st, t): void;
}
```

A pending question is saved, so it is plain data: its `evaluate` is not stored but found by its `kind` in a registry of question
kinds that the posing domain fills at load. A decision records its ballots and its margin; a narrow or forced outcome is weak, and losers remember
it. Ties, vetoes and missing
quorums escalate along the kind's `escalateTo` (household, village, court where one exists), which may name a pawn: a landed big man
as arbiter is the implicit Crown taking up justice. Interested parties sit out or not by custom. Hourly single-voice choices (which
job next) stay in Work; Decide is for questions with several voices, a sitting, or the player.

**Plans** hold commitments over time; Decide chooses and re-chooses them. Three tempos:

- **Standing plans:** routines kept without deciding each day (cook each afternoon, keep the woodpile at its target, milk the cows
  in milk). A household's come from its kind's rules and its culture; **the village's only by the meeting, decided afresh each
  year** (Decided, Kim, 3 Nov: no renewal by default).
- **Seasonal and project plans:** "rye on the east field this year", "a new field by the brook", a barn (VB-164); each opens its next
  step when that step's opportunity appears.
- **Planning days** (Decided, Kim, 3 Nov): each holder reviews on a day of its own, daily or weekly by diligence, staggered across
  the week; reviews also fire when an opportunity's window starts to close.

**Occasions** are plans too: the alehouse keeper opens of an evening by a routine, the priest holds the service, a household its
wedding, the village its fair, a ship its market at the quay. An occasion has a venue, a window, an access rule, an expectation (who
should attend, by custom or doctrine; staying away is remembered), and a draw in hours of reach.

**Opportunities** are computed, never stored. Each kind's record in `KINDS` gains `available(st, holder)`: where the kind could be
done for this party, by its rights (`LandRights.may`) and its stores. Today's posting rules in `refreshJobs` move there almost line
for line. Labour owed to a party surfaces as its opportunity; the creditor's plan chooses what the debtor does.

```ts
interface Opportunity { kind: string; site: Tile; about?: { field?; herd?; fence?; holding?; facility? }; holder: PartyRef;
  via?: RightId; window?: [Tick, Tick]; urgency(st, t): number; hours: number; needs?: Array<{ good: GoodQuery; n: number }> }
interface Opportunities { forHolder(st, holder: PartyRef): Opportunity[];
  forPawn(st, view: ActorView, pawn: PawnId, near?: Tile): Array<Opportunity & { basis: Basis2 }> }   // "what can I do here"
```

**Tasks** are what plans make of opportunities: concrete, held by a party, in the store that `st.jobs` becomes. Who may take one is
composed: members and servants (Membership), debtors owing labour to the holder (Obligations), helpers by custom and goodwill
(VB-106), the hired (a wage obligation), or the pawn itself. **A member may act on the household's opportunities without the plan,
but prefers the plan's tasks** (Decided, Kim, 3 Nov). The basis decides what doing the task books: a helper's work a gift, a debtor's
hours against the obligation, a hand's a wage.

```ts
interface Task { id; key: string; from: { plan: PlanId; step: number } | { standing: number } | { self: PawnId };
  holder: PartyRef; kind: string; site: Tile; about?; hands: number; priority: number; deadline?: Tick }
interface Eligibility { eligible(st, task: Task, pawn: PawnId): { basis: Basis2; obligation?: ObligationId } | null }
```

**Work** keeps the matcher as built (best fit first, the two-hour rule for poor fits, the urgency switch, several hands), reading
tasks and Eligibility instead of job owners. Hours are reported to whoever owns the progress: the domain for resumable land and
building work (a field half hoed stays half hoed, whoever comes next), the task only for work that cannot resume. **Attention**
(Decided, Kim, 3 Nov): a pawn may hold one `partial` task and one `background` task at once (minding the herd while spinning), the
background one at a reduced rate.

**Exchange** owns no goods and no balances: it is mechanisms (gift, help, swap, loan, fair, market, service) that move goods through
Stores, create obligations for anything delivered later, and book the residual in goodwill.

```ts
interface Offer { from: PartyRef; to: PartyRef; give: Deliverable[]; get: Deliverable[]; mechanism: Mechanism; venue?: FacilityId }
interface Assessment { party: PartyRef; gain: number; fair: number; allowance: number; floorOk: boolean; accept: boolean; why: string }
interface Exchange { assess(st, offer, side: 'from' | 'to'): Assessment;   // through the agent's view
  propose(st, from, to, want: Deliverable[], mechanism): Offer | null;      // whole quanta only
  settle(st, offer): SettledDeal | Refusal }                               // only by the command verb `trade`
```

Section 5 gives the rules of acceptance and booking.

**Enforcement** runs cases over a year: the creditor's agent presses, extends or forgives (a decision of its body); the enforcer
hears at its sitting (the autumn meeting), with the custom "Debts are paid with" proposing the remedy and a custom on judging in one's
own cause; the ruling is carried out through the owners. Partial failure is a state: no land to take, land worth less than the debt,
a debtor household dissolved (its successor takes the debt). Cases are plain data, so saves keep them.

```ts
type Remedy = { goods: Lot[] } | { labour: { hours; work; window } }
  | { land: { holding: number; tenant: boolean; rent?: Deliverable; term? } };
interface Enforcement { press(st, o: ObligationId, by: PartyRef, why): CaseId | Refusal; hear(st, c: CaseId): Ruling;
  execute(st, c: CaseId): void }
```

**The outside world** is a scheduled actor with fixed rules and its own stream (`st.rng.outside`). Places abroad have no tiles: a
distance in days, goods sold and bought, prices per decade. Only a facility with `moor` draws ships: the port is the trigger. A
voyage arrives through the ordinary owners (Membership: the ship's body and its pawns, made new or brought back; Stores: its cargo;
Facilities: a market at the quay; Institutions: an envoy), and leaves the same way: its pawns go away, alive, ties kept, with no
agent, residing in the `abroad` body and following the same rules at a coarse cadence. A merchant who returns next summer is the
same pawn. Islanders can take passage: emigration, pilgrimage, trade, service abroad. **Money** (Decided, Kim, 3 Nov): silver
arrives from outside first, as payment; minting comes later, by an established institution.

```ts
interface Outside { step(st, t): void; arrive(st, v: Voyage): void; depart(st, v: Voyage): void;
  passage(st, p: PawnId, v: Voyage, fare: Deliverable, why): void | Refusal }
```

### 4.6 Derived views

Read-only, recomputed at their cadence, never stored as truth, categorical ones with hysteresis.

- **Class** (`landless`, `cottager`, `peasant`, `specialist`, `landed`): from rights, obligations owed and held, and stores. A
  household enters `landed` when rents and stores cover its need 1.5 times for three years and leaves only after three years below
  1.1 (the cities review's master household). The implicit elite.
- **Occupation:** where a pawn's or household's hours went and which facility it operates: the household that runs the mill and
  spends its hours grinding is the miller's. No pawn types.
- **Settlement tier** (village, market place, town, city) and **regions:** central places by market potential (Harris 1954: people
  within reach weighted by `exp(-cost / 12)`, as the cities review computes it), each village belonging to the centre it reaches
  most cheaply, with hysteresis (after Christaller 1933). About two cities a map should emerge from geography, not a quota.
- **Desire lines:** where a way would pay (heavy wear on hard ground; the pairs of places a way would bring closest), offered to
  planners as opportunities. It builds nothing.
- **Probes and loops** (section 6).

### 4.7 The player

The player's pawn enters by four doors, as a source like any pawn: commands (direct control), `Decisions.answer` (a vote, a
testament, a plan as holder), `Opportunities.forPawn` (what it may do here, for whom), and offers in Exchange. It may lie, like
anyone, and be found out. Its traits act on what happens to it on its own (talk, learning, how others' acts land) and never choose
for it. Its view is the actor view: what people say is what its pawn has heard.

## 5. How the economy works

### 5.1 Two valuations, one allowance

A deal is judged on two scales with two owners (Decided, Kim, 3 Nov).

- **Need decides acceptance.** `Needs.value` (the party's kind rules: a household's needs) says what a deliverable is worth to this
  party now, in rations of its own welfare: grain to a hungry household is worth more than its count.
- **Customary worth decides value.** `Culture.norm('worth', good)` says what the village holds fair ("a cow is forty rations, a
  day's reaping three"), moved by need as far as the culture's `needWeight` allows. The residual on this scale is booked.

A party accepts when nothing falls below its floor (seed and some days of food: no one starves themselves) and its gain plus its
allowance toward the other side is at least zero:

`accept = floorOk && gain + allowance >= 0`

Allowance is between the two agents (Decided), and so is booking: the customary residual of a settled deal goes to their goodwill
balance, and memories follow (gratitude for a gift; resentment for a deal driven in dearth; a breach for a promise broken).

### 5.2 Lumps, change and money

Goods change hands in whole quanta: a cow, a day's work, a sack. Most deals therefore leave a residual, and goodwill is the change in
an economy without small coin. Strangers have opinions near zero and so allowances near zero; only deals both gain from pass, and the
lumps defeat many of them. Two things widen this: reputation (5.4), which gives strangers an opinion of each other, and silver.
Silver arrives with the ships, by weight, nearly divisible: the first good that can give change. Where it circulates the residual
shrinks and reciprocity thins, which is the historical effect, here with a cause. The deals that fail for want of change are a probe:
the game's measure of demand for money, and the case for an institution to mint.

### 5.3 Norms learn from markets

Every settled deal, toll and wedding is evidence for a norm (`Culture.observe`), weighted by reach. The first ships paying silver for
grain slowly move what a cow is worth in rations across the island; islands apart keep apart their sense of what is fair until boats
or ice join them.

### 5.4 The moral economy, and what enforces it

Exchange is acceptable while it leaves the weaker side its subsistence (Scott 1976). A hard bargain in a dearth is accepted by the
hungry, because their need-gain is large, but booked against the customary scale as a breach. What makes the breach cost the doer
beyond the one he wronged is gossip: the story spreads where people meet, and the doer's allowance and votes thin in villages he never
dealt with (indirect reciprocity: Nowak and Sigmund 2005; gossip sustaining cooperation: Feinberg et al. 2014). A lie found out costs
the liar more than his lie cost its subject.

### 5.5 How the elite grows

The alderman's road (section 7.1): an office in the village; fees and gifts as goodwill to him in person; loans in lean years as
obligations of the borrowing household; default; a case at the meeting he may preside over; a field split off, owned now by his
household and still worked by its old family as tenants, paying rent; repeated, until his household holds three farms; `landed` by
the derived view, the implicit elite; a mill on village land by a develop grant, its toll a service deal; and, once an outside
institution is established, rank, which founds his estate as a body and moves his own rights to it while every tenancy stands. The
counterweights are in the same machinery: gossip, the meeting where debtors vote and the debt custom can drift back toward labour,
tenants who leave for town or new land, heirs who split an estate or a line that dies out, and younger sons who drop a stratum.

### 5.6 The household's labour, and the idle hours

`design.md` measures 55 to 79% of adult work hours idle across the year, against a target of 40 to 60% in the slack seasons. The
missing sink is textiles: spinning was around 85% of the labour of making cloth, and textile work a major activity for perhaps 40% of
the people of most pre-modern societies (acoup, "Clothing, How Did They Make It?", part III, 2021); much household work was flexible,
fitting into pockets of time beside other tasks (acoup, "Life, Work, Death and the Peasant", part IVd, 2025, after Barber 1994).
Recipes with attention levels supply it: spinning as background, indoor, winter work, its gendering a practice; weaving with a loom
as partial work; cloth as a good that holds its worth, and a candidate store of value before coin.

## 6. Balance loops

### 6.1 The loops

A loop is declared: the stock it regulates, the probe that measures it, how the world answers a change (each response through a rule
or a process, with sign and lag), its setpoints (the tunables that move the equilibrium), the loops it opposes, and its bands.

| Loop | Kind | Stock (probe) | Setpoints |
|---|---|---|---|
| Food store | balancing (built) | grain held | spoil rates, fair sale threshold |
| Land and people | balancing | people per farm, landless adults | yield, marriage custom, hazard; vents: settling, town, emigration |
| Urban sink | balancing | people in towns, a town's natural decrease | urban hazard and crowding, servant demand; disease (section 10) |
| Extraction | balancing | rural surplus after rent, tithe, tax | rates, who may take |
| Export | balancing | grain sold to ships after good years | ships' demand, prices |
| Imports | reinforcing | specialists supplied (iron for the smith) | voyages, prices |
| Silver and the elite | reinforcing | silver held by the landed | export prices, what silver buys |
| Land concentration | reinforcing | land Gini, share of farms under tenancy | loan interest, "Debts are paid with" |
| Debtors' politics | balancing, opposes the one above | the same | anchoring, voice by prestige |
| Elite turnover | balancing | landed and ranked households | inheritance custom (younger sons to town, Church, service) |
| Gossip and social control | balancing | reputation of those who break custom | story salience, belief, how lies are judged |
| Norm learning | balancing | customary worth against deal prices | norms' rates, reach |
| Traffic and wear | reinforcing | worn stage of the ways | wear half-life, stage thresholds |
| Upkeep | balancing | condition of built ways | duty, decay |
| Centralisation and bypass | reinforcing | the largest centre against the second; hinterlands | way costs, potential's distance scale |
| Doctrine tipping | balancing | contested keys | enforcement, sermon pull, threshold |
| Splinters | reinforcing | factions in a contested key | fission thresholds |
| Culture drift | balancing (built) | attitude spread within and between settlements | anchor, social pull, towns' rate |
| Trait drift | watched, not tuned | each trait's mean by generation and village | heritability, the learned share |

Six loops are reinforcing and one names what opposes it. Each reinforcing loop's plan names its opposer or the ceiling that stops
it, and both timescales. Gossip is balancing as social control, but belief by opinion of the teller and by fit is reinforcing
within it: its experiment tests for that (10.2). Since opinion feeds allowance (decision 30), a story reaches deals: story,
opinion, allowance, deal, story is a fast reinforcing loop. Opinion's contribution to allowance therefore has a tight range, and
the loop a probe, before stories are built (slice 7).

### 6.2 Calibration and bands

The loops act on very different timescales: food in seasons, people in years, land in decades, culture over generations. They are
calibrated in that order, fast loops first, each with the slower ones held fixed; the separation of timescales is what makes some
twenty loops tunable at all. The order assumes the fast loop is the balancing one. Where a reinforcing loop is faster than its
opposer, it is tuned by its ceiling, not by the opposer: land concentration runs in years (two unpaid harvests and a hearing),
debtors' politics and elite turnover in decades and generations, and the 75 of section 6.3 rests on that pair. Before tuning a town, find the
constraint that binds: its population settles near `M / (d - b)`
(migrants a year over its excess of deaths over births) and cannot exceed `S / c` (the surplus that reaches it over each person's
need); if food binds, the urban hazard changes how many die getting there, not how many live there.

**Bands** (Decided, Kim, 3 Nov): full-simulation bands are reported, run nightly on any commit not yet benchmarked, and never fail;
reduced scenarios (a tiny map, a few years, toy setups) are asserted in `npm run verify`.

```ts
interface Loop { id: string; stock: string; probe: string; kind: 'balancing' | 'reinforcing' | 'watched';
  responses: Array<{ via: RuleId | string; sign: '+' | '-'; lag: 'days' | 'seasons' | 'years' | 'generations' }>;
  setpoints: string[]; opposes?: string[];
  report?: { lo: number; hi: number; afterYear: number; scenario: string; map: string };
  assert?: { lo: number; hi: number; afterYear: number; scenario: string; map: 'tiny' } }
```

### 6.3 The 600 / 325 / 75 target

Kim's end-game target: 600 farming, 325 in towns and specialised work, 75 elite, of 1,000. Historically far above medieval
Scandinavia (pre-industrial urbanisation peaked near 8 to 15%, Bairoch 1988; Sweden near 4% around 1500, both in the cities review),
closer to the early-modern Low Countries. It needs net food output near 1.67 times farmers' own need before losses and the elite's
larger share, against 1.1 to 1.5 measured today, which the licensed higher productivity and a working route for the surplus can give.
**Proposed reading:** a band for a developed island at the end game, not a quota; strata counted by relation to production, not
residence (a rural smith or miller is in the 325); 75 is about 12 to 15 elite households, a cast the player can know. The 600 is set
by land and people, extraction and the urban sink together; the 75 by land concentration against debtors' politics and elite
turnover; elite turnover also feeds the 325.

## 7. Traces

Each row names the interface that acts and the state it changes, as `ownership.md` section 5 does. Every step stays inside its
owners' interfaces; no step calls upward outside the declared hooks.

### 7.1 The alderman, end to end

| # | What happens | Interface | State changed |
|---|---|---|---|
| 1 | The meeting elects Olof alderman | `Membership.succeed(V, 'alderman')` by the village's procedure (a vote by prestige) | a role edge; his prestige |
| 2 | The office carries the use of a common meadow | `LandRights.grant(use, term: whileEdge)` | a use right that ends with the office |
| 3 | Neighbours bring gifts; he settles quarrels | `Exchange.settle` (gift), `Goodwill.book` | balances with Olof the pawn |
| 4 | In a lean year Bengt's household borrows grain | `Exchange.settle` (loan): `Stores.move`, `Obligations.create` (enforcer: the village) | grain; a loan |
| 5 | Two harvests unpaid | `Obligations.step` | overdue, then defaulted |
| 6 | Olof presses | `Enforcement.press`, by his household's decision | a case on the meeting's agenda |
| 7 | The meeting hears it, Olof presiding | `Enforcement.hear`: the village's procedure, the remedy custom, the own-cause custom | upheld; land; Bengt stays as tenant |
| 8 | A field passes; Bengt works it still | `LandRights.split`, `transfer(own)`, `grant(use)`; `Obligations.create` (rent, yearly) | a holding owned by Olof's household, used by Bengt's |
| 9 | Bengt resents it, the village sees, the story travels | memories; `Rumours.witness`, gossip at the alehouse | opinions of Olof, here and beyond |
| 10 | Repeated: three farms, all worked by their old families | (no new calls) | own rights; three tenancies; rents |
| 11 | He becomes an implicit elite | `derived` class turns `landed` | nothing stored; his priority for field work falls |
| 12 | He builds a mill on village land | `LandRights.grant(develop)` by the meeting; `Facilities.found`; a plan of construction recipes | a site right; a facility; tolls as service deals |
| 13 | An established institution grants him rank | `Rank.grant`; `Membership.found('estate')`; his own rights pass to it | a rank edge with its service obligation; an estate body; tenancies unchanged |

### 7.2 A lean year

| # | What happens | Batch interfaces |
|---|---|---|
| 1 | A wet summer: `yield` combines soil, weather, missed weeding | rules |
| 2 | On his planning day, Bengt's holder revises the plan: fish, gather, ask for help | plans, decisions |
| 3 | Kin give grain within their allowance and above their floor; the residual is booked between the agents | exchange, relations |
| 4 | Still short, he borrows from Olof's household | exchange, obligations |
| 5 | Two harvests unpaid; Olof presses; the case is on the agenda | enforcement, decisions |
| 6 | The meeting rules land, with Bengt as tenant | decisions, enforcement |
| 7 | A field split off: owned by Olof's household, used by Bengt's, rent due each autumn | land, obligations |
| 8 | Bengt's household still has the field's tasks, through its use right | opportunities, eligibility, work |
| 9 | Resentment, through the culture's coupling to opinion; the story spreads | relations, culture |
| 10 | Land Gini and tenancy share rise; Olof's class turns `landed` | derived |

### 7.3 A winter fair, and a lie

| # | What happens | Batch interfaces |
|---|---|---|
| 1 | On a northern island the sound freezes; a sledge route opens across the ice | climate, movement |
| 2 | The shore village holds its winter fair; its draw is in hours, and the ice makes them short | plans (occasion), movement |
| 3 | Pawns choose to go, weighing distance, sociability and piety | opportunities, rules, traits |
| 4 | A smith sells tools forged from iron a summer ship brought; the elite pay in silver, others barter | production, outside, exchange |
| 5 | Every deal is evidence: the customary worth of tools moves, weighted by reach | culture |
| 6 | At the alehouse a rival, low in honour and high in ambition, says the smith's iron is soft | encounters, relations (stories), traits |
| 7 | The story spreads among the villages at the fair | encounters, relations |
| 8 | A buyer whose tools held contradicts it; the lie is exposed, and the counter-story costs the rival more | relations, culture |
| 9 | The smith's hours make him "the smith"; his skill grows with his aptitude | derived, persons |
| 10 | In the thaw the ice goes and the roads turn to mud; the fair's catchment shrinks, the region falls apart until summer | movement, facilities, derived |

Step 10 shows the coupling: one quantity, transport cost, sets how wide a region's social life reaches, and through it gossip,
marriage, culture and prices.

## 8. Kim's decisions of 3 November

| # | Question | Decision | After batch |
|---|---|---|---|
| 1 | Notation for interface sketches | TypeScript-style types, to fit the repo | 1 |
| 2 | What goodwill is | An opinion that is also a currency, in discrete units (helped build a house, gave a cow); it makes parties willing to accept unfavourable terms, short of starving themselves; an unfavourable trade in turn changes goodwill | 1 |
| 3 | One membership graph or a domain per kind | Iterate in design before deciding (see 10.1) | 1 |
| 4 | What makes a deal unfavourable | Goodwill is its own metric on the pawn-pawn relation, tightly coupled to opinion by culture; customary worth decides value, possibly influenced by need; need decides acceptance | 2 |
| 5 | Whose goodwill records a deal's residual | The two acting pawns only | 3 |
| 6 | The alderman's growing estate | A derived view first (an implicit elite, no title); later perhaps an explicit elite with a title, whose estate is a body of its own | 4 |
| 7 | Goodwill at a living holder's retirement | A share passes, set by custom | 4 |
| 8 | Who may grant rank before the Crown | Only outside institutions; both have implicit forms before contact: a landed alderman is the implicit Crown; pawns have a spiritual life, and a town may have an implicit priest, before the Church | 5 |
| 9 | Loop bands as tests | Full simulations are expensive: reported, run nightly when a commit is not benchmarked, not failing; reduced scenarios may fail outside their band | 6 |
| 10 | Choosing an heir outside the custom's order | Only where custom allows a testament | 7 |
| 11 | Jobs | Available, not posted; a holder's plan makes concrete tasks that the farmer or a farmhand executes; the yearly meeting can plan from available village work; its plan makes tasks for the village's pawns | 7 |
| 12 | The meeting's village routines | Decided afresh each year | 8 |
| 13 | A member acting without the holder's plan | Yes, any member, preferring the plan; the farmer plans daily or weekly, on different days for different farmers | 8 |
| 14 | A household's trade allowance | Agent to agent, like booking | 9 |
| 15 | Attention | One partial and one background task at once | 10 |
| 16 | Travel on frozen water | Depends on climate: colder further north | 11 |
| 17 | Where money first comes from | Silver arrives from outside first; minting comes later | 11 |
| 18 | Doctrine against village practice | A resolver tips practice to doctrine at some point; the conflict drives rapid change and may produce a splinter faction in the Church | 12 |
| 19 | Personal values | A batch on traits | 12 |
| 20 | How many traits | Twelve, as sketched | 14 |
| 21 | Gossip | Needs exploring; then model B, stories, after the experiment | 13, 16 |
| 22 | Passage for a way across others' holdings | The village grants for its land; every other holder must agree | 15 |
| 23 | Slander | Pawns and the player alike; a discovered lie is the source of a counter-story of higher valence, depending on cultural values | 16 |
| 24 | Consolidation | One document, this one | 17 |
| 25 | How a lower layer's act reaches a higher one (9 Nov) | Events: subscribers declared at load, run at once, in load order; they cannot veto | review |
| 26 | Reads across layers (9 Nov) | Free everywhere; the layers constrain calls and writes | review |
| 27 | Where custom is read (9 Nov) | The customs in force and their read side sit in the kernel; `culture` writes them | review |
| 28 | A death's cause when several contributions raise the hazard (9 Nov) | Shares must not depend on load order: split by the logarithm of each factor | review |
| 29 | A workflow that could fail halfway (9 Nov) | It cannot: refusals from queries and checks only; the four rules of 4.1 | review |
| 30 | Does opinion feed allowance, beside goodwill (9 Nov) | Yes, both, though they are coupled: goodwill is the quasi-currency of the deal; a high opinion makes an unfavourable deal likelier to pass | review |

## 9. Tensions resolved, and the succession probe

Two reflections (after batches 8 and 16) found places where two batches had each given a thing an owner. Each was resolved by
choosing one, and the resolutions are applied above.

1. Allowance aggregated household members' goodwill while booking touched only agents: allowance is agent to agent (4.4).
2. An undecided question escalated to the implicit Crown, a derived view that cannot decide: `escalateTo` may name a pawn (4.5).
3. Work read labour owed directly as well as through tasks: Work reads tasks only; labour owed is the creditor's opportunity (4.5).
4. Two homes for how a body decides: kind rules give default procedures and escalation; Decisions runs them (4.4, 4.5).
5. Allowance was both a rule and a method: a rule owned by relations (4.4).
6. Goodwill at succession: a share at retirement by custom; at death through the personal estate; office goodwill never (4.4).
7. Exchange evaluated without the actor view: every evaluation by an acting pawn reads through its view (4.5).
8. Built ways had two owners: Facilities owns every built thing, ways included, with stretches and many rights; worn wear and the
   cost factor stay with movement (4.2, 4.3).
9. Five sources fed one tile's travel cost inside the search: a compiled rule, a grid per mode set and season (4.1, 4.2).
10. A venue's draw used a pawn's own modes, derived views a village's: one cache keyed by mode set (4.2).
11. Values lived in both culture and traits: traits own them; culture gives their distribution (4.4).
12. Three sources of attitude malleability: one rule (4.4).
13. An invented story had nothing to contradict: story kinds have domains, contradicted by first-hand memories (4.4).
14. A facility's "within reach" counted steps: it is measured in hours by the reach query (4.3).

**The succession probe.** Succession written out step by step for a household's holder, a village's alderman, a parish's priest and
a workshop's master: of twelve steps, six are shared outright, five share their shape with kind data or the kind's own procedure
plugged in, and one (the claims of those passed over) is the household's alone. With a domain per kind, each would re-implement
eleven of the twelve. The probe also moved goodwill out of succession, moving house out of succession (into `reside`, where it
replaces three copies of co-moving in `farmclaims`, `cottage` and `settle`), and the choice of heir into Decide.

One cross-check passed with no change: under decision 22 even the Crown must buy passage, and that is simply `passage` being
absent from the Crown's place in the jurisdiction list (4.4).

## 10. Open questions and gaps

### 10.1 Waiting for a decision

- **Bodies.** One membership graph with rules per kind is Proposed: it passed the succession probe (section 9), and its costs (the
  household hot path behind a cache; cardinality declared rather than implicit) are named in 4.4. Kim asked to iterate before
  deciding (decision 3); the next iteration is a measurement: the cache's build and update cost at populous medium, which VB-043
  already bounds (under 50 ms).
- **The 600 / 325 / 75 reading** of section 6.3 is Proposed.
- **The player and the floor.** May the player accept a deal that takes its household below the floor that binds every pawn?
- **A meeting that fails to decide** its yearly routines (no quorum, a tie): no fence work that year, or a fallback by custom?
- **Who mints, and when** coin is taken: an established Crown, a norm for acceptance (5.2), and whether a town may mint.

### 10.2 The gossip experiment

Before stories are built (decision 21), a reduced scenario (a tiny map, three villages, a fair, an alehouse, seeded stories)
compares them with the baseline of opinion averaging, by three probes: the spread curve (share of each village's adults holding a
story, by day), distortion (valence held against valence at the source, by hops), and strangers' opinion of the subject. Bands to
tune, then assert:

- a notable breach is known to most of its own village within a season, and to the villages sharing its fair within a year; an
  island across water hears it only once boats, ice or a ship join them;
- an untold story is mostly forgotten within three years;
- a slander with a living witness to deny it spreads less far than a true story of the same kind; and an exposed lie's
  counter-story further than the lie;
- the baseline, on the same seed, converges everyone's opinion and forgets nothing;
- stories do not polarise (Proposed): the share of opinions about a story's subject held at either extreme stays under a band, and
  a village does not split into two camps over one story.

The counterpoint to test, not assume: online, false news has been found to spread faster than true (Vosoughi, Roy and Aral 2018); a
crowded town may show it, villages with witnesses near may not.

### 10.3 Gaps no batch has sketched

- **Disease and epidemics:** a contribution to `death.hazard`; ships bringing sickness; crowding in towns. The largest gap, and the
  most historical part of the urban sink.
- **Childcare and the household's division of labour:** minding as a partial-attention task; nursing deciding who can take which
  work (acoup, part IVd), on which culture's practices of who does what rest.
- **The knowledge seam proper:** most knowledge is still omniscient; stories are its first content. A rule's contributions read
  `st`, not the actor view, so a contribution inside a decision passes the seam by; it needs a rule when knowledge comes in.
- **Crime and law beyond debt:** theft and fines exist only as kinds of story.
- **Quality** of goods: hooks only, nothing yet consumes it.
- **Legibility:** how the player reads all this (labels, `explain`, what people say), and save versioning across the migration.

## 11. What it means for the repo

### 11.1 The design

These points of `design.md` change and need a design pass before code follows:

- **Jobs, owners and roles** (Decided, 30 October): jobs posted by things that need doing, each with an owner, become opportunities,
  plans and tasks (4.5); the rule "members of the owning household, or adults of the owning village" becomes Eligibility.
- **Stats and traits** ("come later") and **inherited traits** (open): twelve traits, partly inherited (4.4).
- **Customs:** about ten new practices and four norms; doctrine and the resolver (4.4).
- **Seasons on the map** and VB-083: climate by latitude; ice that carries traffic where the climate is cold enough (4.2).

### 11.2 The refactors under way

VB-173 to VB-180 (`ownership.md` section 7) fit this target unchanged in order. Each gains a note:

- **VB-173 (the owners table):** add a "cache" category, so `pawn.household`, `hh.members`, `pawn.role` and `st.owner` are checked
  like fields (principle 2).
- **VB-174 (food):** give every operation a `good` argument (grain, rations and sheaves for now), and leave `pawn.owed` and
  `owedFrom` out of `sim/stores`: they are the first obligations (4.3, 4.4).
- **VB-175 (membership and founding):** the one founding act is `Membership.found`, and the co-moving now copied in `farmclaims`,
  `cottage` and `settle` is `Membership.reside` (4.4).
- **VB-176 (the dependency rule):** the five layers and the three upward hooks (section 3).
- **VB-177 (a pawn's movement):** room for modes and legs beside walking (4.2).
- **VB-178 (ties):** opinion and goodwill as separate quantities in relations (4.4).
- **VB-179 (the crop's life):** progress on resumable work belongs to the field, not the job (4.5).

### 11.3 Proposed tasks, in order of dependency

Unnumbered here; each would be written up under the task rules in `BACKLOG.md`, behaviour-preserving first where it can be.
`docs/roadmap.md` (the slices) has since set the order; this list stays as the inventory of what the target asks for.

1. The rules registry, with `deathRoll` as its first rule, unchanged in behaviour; `tools/rules.js`.
2. Reduced-scenario harness and nightly band reports (6.2); `tools/loops.js`.
3. Obligations as a module, starting with the heirs' shares.
4. Goodwill as a balance in relations, and allowance as a rule; `help` as a gift mechanism in Exchange.
5. Typed goods and custody in Stores (the registry, queries, `Custody`).
6. Jobs as opportunities, plans and tasks, in four steps: posting rules into `KINDS` with one standing plan per household and one
   for the village (golden unchanged); matching through Eligibility (unchanged until the first tenancy or labour owed); village
   routines by the meeting, decided afresh each year; seasonal household plans (VB-164).
7. Land rights with `own` and `use` split and `st.owner` as their cache; enforcement and foreclosure.
8. Facilities generalising venues and buildings; recipes with subtype binding; construction as recipes.
9. Attention and the textile chain.
10. Movement modes and the reach query; climate and ice; built ways.
11. Culture's one door (`inForce`, `norm`) over today's practice arrays; `tools/customs.js`; new practices as they are needed.
12. Traits, and chemistry from traits.
13. Encounters at venues and occasions.
14. The gossip experiment (10.2), then stories.
15. Decisions as a module (procedures, sittings, escalation), absorbing today's meeting.
16. The outside world, institutions and rank.

### 11.4 This folder

`target-architecture.md`, `prompt.md` and `stress-tests.md` stay as the external proposal and its brief; `ownership.md` stays as the
map of today. This file is the target. `AGENTS.md` and `docs/review-architecture.md` can point here.
