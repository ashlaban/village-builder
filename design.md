# Village builder: game design snapshot v0.4

Nov 3, 2026 · @Kim

## Status of this snapshot

Version 0.4 begins on 3 November 2026, when `docs/architecture/target-v2.md` became the architecture reference and Kim chose to grow the game
in vertical slices (`docs/roadmap.md`). It is a skeleton: every point of version 0.3 is carried over with its status, in a new order of
sections, and Kim's decisions of 3 November are added. Points those decisions change are marked **Under revision**, with the slice whose
plan task rewrites them; until then they stand as written. Sections marked "to be written" are filled in by that slice's plan. It is a
reference for later work, not the truth: where it and the game differ, either may be wrong, and any point can be reopened.

Each version is its own document and is left unchanged once a newer one exists: version 0.3 is `docs/design-v0.3.md`.

Implementation details (rendering, code structure, performance) are left out: the architecture is target-v2, and the budget and the rules
for cost are in `docs/roadmap.md` and `AGENTS.md`. Numbers are design targets or starting values to tune, not fixed values.

| Label | Meaning |
| --- | --- |
| Decided | Stated by Kim |
| Agreed | Proposed in planning and accepted, or adopted without objection |
| Proposed | Suggested, not yet accepted |
| Open | Not decided |
| Under revision | Decided or Agreed, but changed by a later decision; it stands as written until the named slice's plan rewrites it |

**Where version 0.3's sections went.**

| v0.3 | v0.4 |
| --- | --- |
| Vision and scope | 1, with the player role replaced and four rows added; and The game, in Kim's terms |
| World and scale; Weather, seasons and daylight | 2, as subsections |
| Time and calendar | 3 |
| People, households and family records | 4 |
| Economy and jobs: its opening line, Jobs, owners and roles | 7 |
| Economy and jobs: Goods and the farming year, Long work and processing, Known gaps | 8 |
| Land and ecology | 6, except Worn paths, which is in 2 |
| Animals | 8, as a subsection |
| Settlements and look | 11 |
| Customs and culture | 10 |
| Inheritance and expansion | 5 |
| Claims, ownership and territory | 6, as a subsection |
| Starting scenarios | 14 |
| Commands, time steps and views | 15 |
| Systems overview | Appendix |
| Open questions and proposals | 16 |
| Change log | Change log |

New in v0.4: section 9 (Exchange, goodwill and obligations), 12 (Institutions and the world beyond), 13 (Balance loops and targets), and
the subsections "to be written" in 2, 4, 5, 6, 8, 10 and 11.

## 1. Vision and scope

A village builder on a generated hex archipelago, played at the level of individual pawns with family histories, for about 1,000 living pawns on a medium map.

| Aspect | Design | Status |
| --- | --- | --- |
| Genre | Village builder and colony simulation; pawns plan their own work | Decided |
| Population | About 1,000 living pawns on a medium map is the reference for the late game and its budget; a large map may reach about 2,000, at half the speed. Every pawn is individually represented; balance loops, not a cap, hold the number (see Balance loops and targets) | Decided, 3 Nov (was: up to about 1,000 pawns) |
| Setting | Medieval Nordic peasant society, with inspiration from medieval Sweden. Swedish and continental customs may be mixed: history is the source of systems and of their plausibility, and where the two part, engaging play decides. The founders scenario is a frontier settlement, growing faster than a settled medieval society would; other starting scenarios begin elsewhere | Decided; mixing, and the frontier, Decided 9 Nov (Kim, gameplay review) |
| Look | Naturalistic, painterly hex terrain; medieval Swedish farmsteads | Decided |
| Society | Families, inheritance and customs that shift over generations | Decided |
| Pace | A game about incremental progress; one run lasts 40–80 hours | Decided |
| Start | Several starting scenarios; by default the founders arrive to almost unprepared land and spend the first year making fields and meadows | Decided |
| Player role | The player inhabits one pawn as its source of commands (Commands, direct control) and lives a life the game does not prescribe: works and marries, inherits or leaves, takes service, clears land, argues at the meeting with the pawn's prestige, and later learns a craft, trades at the fair, joins the Church or moves to a town. The pawn keeps its needs and the rules every pawn has, and the world goes on without the player. When the pawn dies, the player goes on with another: by default the heir or another relative (the family line), or someone of its household or close ties. There is no fixed score: the player picks ambitions (hold three farms, change a custom, found a village, become a master household, leave service and hold land), and the chronicle shows their progress; the line's prestige over time is one of them. The player should be able to influence the world a lot, through all the systems. The player steers what its pawn does, and through the pawn's position whatever that position commands: as head of a household it directs the household itself (where the next field is made, what the season's work is, whom its children marry), as any holder does but by the player's choice (see The player and what they see). Slice 2 (backlog VB-079) plans it | Decided, 3 Nov (replaces the family line of 30 Oct); its ambitions postponed, 7 Nov (see Ambitions); steering by position, 9 Nov |
| Which pawn | At the start, any living adult, chosen on the game itself once the land is raised (Starting a game, in The player, commands and views; was: from the pawn panel); each scenario suggests one (a holder in founders and heirs). After a death, the player chooses among the pawn's kin by blood or marriage, its household and its close ties, the heir first; if none is alive, any adult, and the chronicle marks the break | Decided, 3 Nov |
| Ambitions | Read from the state and the record of events; they grant nothing. Postponed (Kim, 7 Nov): the idea came from an agent and is tentative; it is designed late, since nothing else depends on it, and slice 2 builds none | Decided, 3 Nov; postponed, 7 Nov |
| Scale of society | A society at five scales: the pawn, the household, the settlement (village, market place, town), the region of the archipelago, and the world beyond it, which stays abstract (ships, the Church, the Crown, migrants, news) until its people arrive and become pawns. Towns, institutions and markets grow out of the villages along the phases of the cities review (`docs/review-cities.md`) | Decided, 3 Nov |
| What a pawn knows | All is known to all for now, fathers included. Those who decide read through an actor view, a seam that filters nothing until stories arrive (slice 7); knowledge with a source is Open (see Open questions) | Decided, 30 Oct; kept 3 Nov |

### The game, in Kim's terms (3 November 2026)

Kim's description of the game in the architecture conversation of 3 November (`docs/architecture/target-v2.md`); Decided as aims. The
slices of `docs/roadmap.md` build towards them, and the sections below say how far each is designed.

- **Society and economy.** Several strata: an agricultural base supports town life and a specialised economy, with a land-owning elite on
  top. Many systems balance themselves, and tuning the game means tuning their balance points (peasant fertility held in check by taxation and
  by higher death rates in crowded towns). Social hierarchy grows from a few founding homesteads; homesteads, families and households are
  distinct. An alderman can gather wealth and prestige, collect a debt in land, pay for a mill, and become the first level of landed elite.
- **Exchange.** Goods are exchanged for goods and decaying goodwill; elites and merchants use currency once it exists. Markets arise between
  villages and can grow into towns; a region holds a town or city and its villages, about two cities a map; alehouses mix villages.
- **Culture.** Values are held by individuals, by institutions (the Church) and by social bodies (a village, a city, a court). Inheritance
  (patri-, matri- or mixed) and marriage rules differ between villages.
- **World and work.** An island world, where terrain and water separate cultures; boats are few early (fishermen) and more common later
  (merchants). Late in the game there is limited contact with an abstract outside world: a port draws merchant ships that sell exotic goods
  and buy in bulk; diplomats and a few immigrants arrive. Resources come in subtypes (granite and marble are both stone; cow's and sheep's
  milk), extracted and refined through work; pawns plan simply, and specialised roles such as miller and baker emerge. Pawns track relations,
  stats and skills.
- **Inspiration.** The acoup blog (Bret Devereaux), especially "Bread, How Did They Make It?", "Clothing, How Did They Make It?" and "Life,
  Work, Death and the Peasant".

### Principles for decisions (Kim, 12 November 2026)

Decided, in a discussion of the open questions. They say how a question is answered when the sections below do not; `AGENTS.md`,
Deciding without Kim, is their working form and says which questions still go to Kim.

- **Hunger is an engine.** Shortage drives the gift and goodwill, and through them loans, land passing and the landed class. A household
  may fail; the design does not aim for every household to be fed.
- **The island grows without the player.** The island as a whole must grow reliably with nobody steering it: at least 1% a year in the
  long term, over most seeds (Balance loops and targets, Growth). Only island-wide numbers are judged.
- **Parameters, not patches.** What balance depends on is a named parameter with a meaning in the physical world or in a gameplay
  system. Parameters are tuned together, for gameplay balance, in runs Kim starts; otherwise only to avoid a collapse.
- **History, leaning to gameplay.** Systems, customs and their defaults are grounded in history; where history and play part, play
  decides. Customs may be added freely for now; a later review will look for a smaller set with the same effects.
- **Detail where it is a decision.** Quantities and logistics are grounded in history, and the kinds modelled are those that give the
  head or the player a decision: key kinds, not every kind, as with the crops (Crops and rotations).
- **References.** Founders is the reference for the early game, populous for the late game (many pawns).

## 2. World, climate and travel

### World and scale

One finite, seeded archipelago of 280 × 200 hex tiles, each about 10–12 m across, so a house is one tile; distances, farmland and time are compressed rather than tiles mixed in size. The one grid is read at two scales, a site and land (Two readings of one grid, below).

| Aspect | Design | Status |
| --- | --- | --- |
| Map | One finite archipelago per seed, regenerable | Decided |
| Tiles | Pointy-top hexes | Decided |
| Terrain | Deep sea, sea, shallows, lakes, sandy shore, meadow, heath, broadleaf forest, pine forest, marsh, hills, mountains, snowfields | Agreed |
| Ground | Under the terrain, a layer a tile, for a Europe of 1300 to 1700, continental and Scandinavian. Bedrock on all land: granite (the common ground), limestone, sandstone and slate in provinces, with lenses of marble and soapstone. Deposits on few tiles, as veins: clay in low, damp ground; bog iron in marsh and on lake shores; iron, copper and lead with silver (one ore) in the uplands; tin only in upland granite; gold in the high mountains; peat in marsh; flint in low limestone and on its shores; amber, rare, on sandy shores; salt springs, rare, inland on limestone or sandstone, which flow on. Each island draws which kinds it has, by tuned chance: an island with everything is uncommon, and islands commonly differ. Deposits are finite, counted in loads, and a few sources do not run out (to be weighed when play is balanced). Nothing digs yet (backlog VB-357) | Decided, 11 Nov (the kinds, the layer, chance by island, finite); Proposed (the shares and amounts) |
| Mountains | Multi-tile rock relief; no peak glyphs | Decided |
| Rivers | The world has rivers | Decided, 30 Oct |
| River courses | Rivers rise in hills, mountains and marshes and run downhill to a lake or the sea, a few on each large island; brooks are narrow, larger rivers a tile wide; they carry fresh water and fish, drive water mills, and wet the ground along their banks, where hay grows well. Crossing is at fords and, later, bridges | Proposed |
| Tile scale | About 10–12 m per hex, a building plot; one house holds a family | Agreed |
| Mixed scale | By compression: distance about 15×, farmland about 200× in area, which is the same 15× in length, time compressed (see Time). One grid, two readings: a site about 10 m across, land about 150 m across (Two readings of one grid) | Agreed; the two readings Agreed, 11 Nov (VB-345); land at 150 m (it was 100 m) Decided, 12 Nov (Kim) |
| Map size | Four sizes: Tiny 120 × 85, Small 180 × 130, Medium 280 × 200 (56,000 tiles, about 20,000 of them land; the earlier single size), Large 380 × 270 | Decided |
| Generation screen | The game opens on a screen to set map size, seed and starting scenario, then generates the map; the same seed, size and scenario always give the same world | Decided |
| Regions | Hexagonal patches of radius 7 (169 tiles, centres 13 tiles apart) | Agreed |
| Walking and terrain | Routes and walking cost by terrain: meadow, heath, shore and fields 1, forest 1.5, hills and marsh 2, mountains 3, snowfields closed, in the current route search (backlog VB-096). A step also costs more by its slope: 6 for each unit of elevation between its two tiles (elevation runs 0 to 1 over the land), at most 2, the same up and down, so routes keep to flat ground and a pawn walks slower on a steep step; a worn path does not flatten a slope (VB-271; the two numbers are `SLOPE` in `src/sim/rules.js`, to be tuned with the balance). Routes over regions (HPA\*) only if routes then cost too much (VB-097) | Agreed, 30 Oct; slopes Decided, 10 Nov |
| Uses of regions | Overview, territory, simplified simulation off screen, hierarchical pathfinding for 1,000 pawns (HPA\*, Botea, Müller and Schaeffer 2004) | Agreed |

#### Compression

- **Distance:** villages sit 13–15 tiles apart instead of a realistic 100–250 tiles of 10 m (1–3 km); at the land's 150 m they are 2.0–2.3 km apart.
- **Farmland:** a farm has 2–4 field tiles, each standing for about 2 hectares of sown land, about 200 hexes of 10 m (Two readings of one grid), so a farm sows 4 to 8 ha. A medieval household's about 12 ha counted its fallow, meadow and pasture too, which the game holds as other tiles.
- **Rejected alternative:** a separate world map with local maps to enter (as in RimWorld or Dwarf Fortress). It only pays off with hundreds of settlements and breaks continuous scrolling.

#### Two readings of one grid (Agreed, 11 November; VB-345)

A tile is read at one of two scales by what stands on it, and nothing is drawn finer than a hex.

- **A site** is about 10–12 m across: a house, a well, a pawn walking.
- **Land** is about 150 m across, about 1.95 ha a hex: a field, a meadow, a stretch of forest, the way between two villages. It is the 15× of distance applied to area. (Decided, 12 Nov, Kim; it was 100 m and 0.87 ha, Agreed 11 Nov. Of 100, 150 and 200 m, 150 leaves no quantity off by more than about 2.5 times: the farm's sown land and the villages' spacing fit, and the yield and the hours a hectare run low.)
- **Today's yields against it.** A field nets 75 rations after seed. A game day stands for about a week (7.6 days), so that is about 570 days of an adult's food; at 0.75 to 1 kg of grain a day, 430 to 570 kg net and 570 to 760 kg gross, or about 290 to 390 kg a hectare on 1.95 ha (650 to 900 at the earlier 100 m). Medieval grain is usually put at some hundreds of kilograms to a tonne a hectare (the order of magnitude only, from memory: no source was checked for it), so the game's field yields at the low end. Ploughing a field takes 20 hours, where an acre a day would make 1.95 ha about 48: work a hectare runs about 2.4 times fast.
- **Distances agree:** villages 13–15 tiles apart are 2.0–2.3 km apart at the land's scale, inside the realistic 1–3 km. Walking does not yet agree: 3 tiles an hour is 0.45 km an hour at this scale (the distance review of 12 November; 12 tiles an hour is agreed with Kim and not yet built).
- **Time is the third compression:** a game day is about a week (Time and calendar).

#### Sizing at 1,000 pawns

| Unit | Size | People |
| --- | --- | --- |
| Farm | 3–5 tiles: a house and 2–4 fields | One household, 4–5 people |
| Village of 5 farms | 20–30 tiles, with well, hall and lanes | About 25 |
| Town with a market | 35–40 tiles: about 11 houses, a 7-tile market, workshops, streets | About 50, fed by surrounding villages |
| Whole population | About 1,000 built tiles plus 4,000–5,000 of woodlots, pasture, quarries and fishing | About 1,000 in 220 households and 25–30 settlements |

Hay meadows (see Animals) add 2–3 tiles to a farm that keeps animals, private or shared; the figures above predate them and need revising (Open).

### Weather, seasons and daylight

The map has a day and night cycle, seasons with a temperature, and simple weather with wind and rain patterns. (Decided, 30 Oct.) How they show on the map and act on the simulation is Proposed.

| Aspect | Design | Status |
| --- | --- | --- |
| Day and night | Light changes over the day: dawn, full day, dusk and night are visible on the map | Decided, 30 Oct |
| Weather | Simple weather with wind and rain patterns | Decided, 30 Oct |
| Seasons | Seasons with temperature | Decided, 30 Oct |
| Seasons on the map | Seasons show on the map: spring green, autumn colour, snow and ice in winter; on fixed dates first, then following temperature (see Settlements and look; backlog VB-083) | Agreed, 30 Oct; **Under revision** (slice 10, VB-190): climate by latitude, with ice |
| Determinism | Weather comes from the world's seed, so the same seed gives the same weather | Proposed |

#### Daylight (Decided, 30 Oct; the look at night Proposed)

- **Night is short:** dark from 22:00 to 4:00 at the equinoxes, with 2 hours of dusk and dawn (see Time and calendar).
- **The seasons move it a little:** the dark part runs from about 4 hours at midsummer to 8 at midwinter, a mild echo of Sweden's light summer nights and long winter dark that keeps winter nights short.
- **At night** the land darkens and cools in tone but stays readable; hearths glow through doorways and smoke holes, and the few pawns still out carry their own light.

#### Temperature (Proposed)

- **One curve for the year,** cold in winter and warm in summer, plus spells of a few days warmer or colder than usual; high ground is colder.
- **Below freezing,** snow lies on land and lakes ice over; the snow and the season's colours on the map follow temperature, not fixed dates.
- **Firewood use** follows the temperature instead of a fixed winter-to-summer ratio.
- **Spring work** waits for thawed ground, and growth starts with the warmth; a late frost or an early one in autumn is the frost risk of the farming year (see Goods and the farming year).

#### Wind and rain (Proposed)

- **Wind** has a direction and a strength for the whole archipelago that change slowly, mostly from the south-west and west, as in Scandinavia.
- **Rain** comes in fronts: large soft areas, a few regions wide, that drift across the map with the wind, so it can rain on one island and be dry on the next.
- **Rain stops** haymaking and the carrying in of sheaves, which need dry weather, and slows field work; hay rained on while drying loses value.
- **Wind** turns the windmill only above a set strength, carries smoke and moves the trees.
- **The year's weather factor** (see Goods and the farming year) comes from the season's actual weather instead of a separate draw: a wet harvest or a dry early summer makes a poor year. What a crop asks of the weather, and what answers until this is built, is in Goods and the farming year, Crops and the weather (11 Nov).
- **A game day stands for about a week,** so a day's weather reads as a week's weather.

### Worn paths

Paths are not built; they are worn into the land by people and animals walking. (Decided, 30 Oct; the speeds Decided; the counts, stages, fading and snow Agreed, 30 Oct; the rest Proposed.) Built in two steps: drawn first (backlog VB-094), then the faster walking and routes that prefer paths (VB-110), after terrain costs (VB-096).

1. **Each crossing counts:** every tile keeps a count of the pawns and animals that cross it, halving each game year so unused paths fade.
2. **Three stages:** trodden ground at a count of 50, a path at 200, a lane at 800, about 1, 4 and 16 crossings a day kept up.
3. **Faster walking:** walking is 5% faster on trodden ground, 15% on a path and 30% on a lane than on the bare terrain, so paths draw routes without lanes ruling all travel.
4. **Sharing paths:** route-finding counts the faster walking, so a pawn takes a path when it is quicker even if it is longer; routes merge, and the merged path wears deeper. Lanes form between farms, the well, the fields and the commons wood, as desire paths do.
5. **Land kept open:** grass does not grow back on a path, and forest does not spread onto one while it is used.
6. **Under snow,** lanes stay visible as trodden snow; paths and trodden ground are covered.

Villages had a village street (*bygata*) and fenced cattle lanes (*fägator*) that led the herds through the infield to the outland pastures; in the game such lanes are worn by use, not laid out.

### Climate and travel beyond walking (to be written: slice 10, VB-190)

| Aspect | Design | Status |
| --- | --- | --- |
| Climate | Set at world generation by latitude: the growing season, frost, snow, and whether and when lakes, rivers and sounds freeze | Proposed (target-v2, section 4.2) |
| Frozen water | Opens travel where the climate is cold enough: colder further north | Decided, 3 Nov |
| Modes | Foot, cart, sledge, boat and ship, each with a cost for a person and one for a load; one reach query serves every use of distance | Proposed (target-v2, section 4.2) |
| Built ways | Tracks, roads, causeways, bridges and ferry landings are built things (see Goods, production and facilities), with passage rights over the holdings they cross (see Land, ecology and rights) | Proposed |

## 3. Time and calendar

A year has 4 seasons of 12 days, so one game day stands for about a week; at 1× a day lasts 48 seconds and a year about 38 minutes.

| Aspect | Design | Status |
| --- | --- | --- |
| Calendar | 4 seasons × 12 days = 48 days a year | Agreed |
| Day length | 48 s at 1×, slow enough that walking reads as walking | Agreed |
| Speeds | Pause, 1×, 3×, 10×, 30×, uncapped (backlog VB-084) | Agreed (to 10×), Decided (30× and uncapped, 30 Oct) |
| Uncapped speed | "Uncapped" runs the simulation as fast as the computer allows | Decided, 30 Oct |
| Running in the background | An option lets the simulation keep running while the game's tab or window is not in focus (backlog VB-084) | Decided, 30 Oct |
| Short nights | The dark part of the day is shorter than a real night, and pawns need less sleep, so more of each day is active; nights are not interesting to watch, and this speeds up play | Decided, 30 Oct |
| Daily rhythm | Work from 6:00 to 18:00, home by evening, indoors at night; lengthened from 7:00–17:00 because nights are short (backlog VB-105). Kim kept this over a fixed night with work from sunrise to sunset, when merging the two lines of design (30 Oct) | Decided, 30 Oct |
| Night and sleep | Dark for about 6 hours at the equinoxes (22:00 to 4:00), from about 4 hours at midsummer to 8 at midwinter; pawns sleep in the dark (backlog VB-105) | Decided, 30 Oct |
| Twilight | Dusk and dawn of 2 hours each; pawns sleep about 6 hours. The dark lasts 6 − 2 × cos(2π (doy − 15) / 48) hours, centred on 1:00 (backlog VB-105) | Agreed, 30 Oct |
| Yearly round | Sowing in spring; haymaking in summer; harvest in early autumn; village meetings on autumn day 10; moving round on autumn day 11; the gathering of villages and its fair after the harvest (Decided, 10 Nov), on winter days 1 to 3 (see The gathering) | Agreed |
| Stall period | Animals stand in the byre from about autumn day 9 to spring day 6, 21 of 48 days (see Animals) | Agreed |
| Pace of play | A year takes about 38 minutes at 1× and about 4 at 10× | Agreed, trade-off noted |

**Growth and time conflict.** Frontier populations with open land grew close to 3% a year from births. From 10 to 1,000 takes about 150 years, 5–6 generations, or roughly 10 hours at 10×. The game is meant to be slow: 40 hours or more to reach full population is fine, with growth from births and, in a later stage, very limited immigration by boat (Decided). The target is at least 1% a year in the long term (Decided, 12 Nov; Balance loops and targets, Growth); at exactly 1%, 10 to 1,000 takes about 460 years, about 29 hours at 10×, so a run of the intended length rests on growth nearer 2 to 3%, or on a scenario that starts larger.

**Run length.** A single run should last 40–80 hours (Decided). At about 38 minutes a year, 150 years is about 95 hours at 1×, so a run would mostly play between 1× and 3×.

## 4. People, households and family records

Every pawn is a person on record with parents, marriages and life events; households are where people live and work, which is not the same as family.

| Aspect | Design | Status |
| --- | --- | --- |
| Founders | 10 unrelated founders, 5 women and 5 men | Decided |
| Founder households | Four couples on four farmsteads (three around a village green, one lone farm), plus a farmhand and a maid serving in two of them | Agreed |
| Household and family | Separate: servants live in households not their own | Agreed |
| Records | Person records (sex, birth, death, father, mother) kept apart from union records with start and end dates, as GEDCOM (the Genealogical Data Communication standard) separates individuals and families | Agreed |
| Life events | Born, married, moved, inherited, share received, cause taken up, died | Agreed |
| Naming | Given name and patronymic (-son, -dotter); married women keep theirs. Founders' fathers are known only from the patronymic, all different and never another founder's given name | Agreed |
| Kinship | Malécot's kinship coefficient, shown for spouses. The marriage limit is judged by civil degree: generations up from one person to the nearest common ancestor and down to the other (uncle–niece 3, first cousins 4, second cousins 6); siblings and half-siblings (2) never marry | Decided (limit by degree), Agreed (coefficient shown) |
| Roles | Farmer (*bonde*), mistress of the house (*husfru*), farmhand (*dräng*), maid (*piga*), son and daughter of the house, retired (*undantag*), child | Agreed |
| How roles are assigned | By position in the household; seeding follows medieval custom, but roles are data and not tied to sex | Agreed |
| Children's work | From 7, children work at reduced efficiency: fetching water, weeding and helping at the harvest; from about 8 they can herd animals, as herding was children's work (see Animals). Starting values: a rate of 0.3 of an adult's at 7, rising by 0.1 a year to 0.9 at 13 (backlog VB-104) | Decided (from 7, reduced), Agreed (herding, jobs, rates), 30 Oct |
| Mortality | Age-based pre-industrial risk of death, shaped like a Gompertz–Makeham curve and roughly matched to Coale and Demeny's (1966) model life tables; can be switched off | Agreed |
| Health | Each pawn has health from 0 to 100. Hunger h (0–1) drains 4 × h² a day (9 until backlog VB-080), 1.5 times as fast under 5 and from 60; a fully fed day restores 3; health 0 is death, so a starving adult dies in about 25 days and a small child in 17. Below 50, health raises the death risk, up to 3 times at 0, and it slows work by up to 30% at 0, on top of hunger | Decided (slows work; drain 4, 30 Oct), Agreed (rest), 30 Oct |
| Births | Natural births drive growth; very limited immigration by boat comes in a later stage. Children are spaced by explicit pregnancy and nursing; some are born outside marriage, from courting and relationships between pawns, with the man she was with as father; an unmarried mother and the father often marry quickly. Starting targets: about 7 births for a woman married at 20 and 5.5 at 25; about 20% of children die before age 1 and a third before 15; 1% of mothers die in childbirth | Decided (growth from births, spacing), Agreed (starting targets) |
| Courting | Unmarried pawns may court from 16; marriage stays at 18 for women and 20 for men, and still needs a place to live and kin no closer than the limit, and is made as an offer at the moving round that both households answer. Hunger of 0.5 or more postpones the marriage, not the courting. About 5% of births at first come while courting, and about 3 in 4 such couples marry within the year if they can. The true father is recorded and, for now, known to all. A widow or widower minds the age gap half as much, so a widowed holder may marry a younger landless adult and bring the farm to the marriage (balance review; remarriage was common in pre-industrial Sweden, Lundh 2007) | Decided (from 16; true father), Agreed (rest), 30 Oct; Agreed (remarriage), 2 Nov; from 9 Nov a courting couple marries through the households' negotiation: their wish moves their heads to an offer at the moving round, and is enough by itself for those who speak for themselves (Inheritance, Marriage as a negotiation: Decided 9 Nov; the courting row Agreed 9 Nov; brought in line by VB-233, 10 Nov) |
| Pawn interactions | Pawns who meet (working near each other, at the well, on the green, at home) may interact, each pair at most once a game hour; the first kind is talk. A relationship holds familiarity (the tie), an opinion from −1 to 1 and a courting flag; kin links stay in the family records. Opinion has a direction and is the sum of the standing (spouse, parent, child, sibling, housemate) and timed memories that gain up to a cap and fade, as in RimWorld; becoming friends or falling out is a life event. In each waking hour a pawn talks with at most one partner, chosen by familiarity and liking; by the pair's fixed compatibility the talk is a chat, a good talk or cross words. Idle pawns seek out those they like. Talk shows as a short bubble near the camera, and the pawn panel lists the people a pawn knows best and mood modifiers such as “talked with a friend +5” | Decided (talk first; mood shown; 30 Oct), Agreed (rest, 30 Oct); Decided (opinion from memories, one partner an hour, numbers in backlog VB-060, VB-061, VB-125; 31 Oct) |
| Stats and traits | Come later | Decided; **Under revision** (slice 7, VB-186): twelve traits, Decided 3 Nov (below) |
| Inherited traits | Whether founders get hidden values that children inherit (parents' average plus noise) | Open; **Under revision** (slice 7, VB-186): partly inherited, Decided 3 Nov (below) |
| Family tree | Generations in rows, spouses linked, children under their parents; the dead greyed, heirs marked; father, mother, spouse with kinship, children, siblings and life events per person | Decided (a view), Agreed (content) |

### Traits, talk and stories (to be written: slice 7, VB-186)

| Aspect | Design | Status |
| --- | --- | --- |
| Traits | Twelve, continuous and latent, shown only as labels at the tails: values (generosity, piety, ambition, honour), temperament (sociability, temper, diligence, openness) and aptitudes (body, hands, husbandry, wits). Values come mostly from upbringing, temperament and aptitudes partly by inheritance. A trait acts on at least two rules and never chooses for the player (target-v2, section 4.4) | Decided, 3 Nov (twelve, as sketched); numbers Open |
| Personal values | Held as traits; each culture gives their distribution | Decided, 3 Nov |
| Skills | Learnt by doing, faster with the matching aptitude; they fade unused | Proposed (target-v2, section 4.4) |
| Opinion | Derived, never stored: a's opinion of b is the kin standing's value (spouse, parent, child, sibling, housemate), plus affinity, 0.6 × the pair's fixed compatibility × min(1, a's tie to b / 8), plus a's memories of things that happened between them (a claim taken, a border lost, a bull lent, a refused match), clamped to -1..1; goodwill's gratitude adds to the same sum. Talk grows the tie only: its kind (a chat, a good talk, cross words) is drawn from compatibility for the bubble and leaves no memory, so two compatible neighbours become friends at the pace their tie grows. Only reaching close friends (0.45) or enemies (-0.5) is an event, left only 0.1 past its line; friend (0.25) and dislike (-0.2) are the page's words. The band is checked where the pair's tie or memories change, never by a pass over pairs (VB-240) | Decided (Kim), 10 Nov |
| Gossip | Stories: an event and who was in it, passed on where people meet, believed by the hearer's opinion of the teller and the story's fit; tested first against opinion averaging in an experiment (backlog VB-187) | Decided, 3 Nov |
| Slander | Pawns and the player alike may lie; a discovered lie is the source of a counter-story about the liar, of higher valence, scaled by the culture's values | Decided, 3 Nov |

## 5. Inheritance, expansion and other bodies

A couple needs a household of its own to marry, and one heir takes each farm, so younger siblings become landless adults who must serve, marry an heir or a widow, claim an empty farm, or clear new land.

This follows the Northwestern European pattern of household formation (Hajnal 1965). All rules below read the village's customs. (Agreed)

### Succession

1. **The surviving spouse** first, as the widow custom allows: keeps the farm for life, keeps only her keep, or inherits outright.
2. **Children** in the order the sex and birth-order customs give; a dead child's children stand in their place.
3. **The holder's siblings** and their lines, then the parents' siblings (cousins) and theirs.

- Someone who already holds a farm, or lives on a spouse's farm, is passed over.
- Someone first in line for their own parents' farm steps behind the other relatives: farms are not combined while someone else can take them. This is a custom (Decided; see Custom dimensions). Under "keeps their place", an heir first in two lines takes the farm with more fields and drops the other claim, which passes to the next in that line, so no household holds two farms (Decided, 30 Oct).
- A minor heir holds in name, with a guardian (*förmyndare*) until 18: the surviving parent or the nearest adult relative.
- No heir: the farm stands empty and the village holds it, owning its house and field tiles (Decided). Historically, heirless property (*danaarv*) went to the Crown.

### Handover and shares

- **Timing** follows the custom: at the holder's death, when the heir marries (the parents retire on the farm, *undantag*), or when the holder turns 60.
- **Shares:** under “one heir buys out the rest” each sibling receives a share of the farm's value; under *systerlott* a daughter gets half a son's share. Shares can be paid partly in animals.
- **A reserve** of seed, food and winter hay is never paid out; any shortfall is recorded as owed.
- **Shares still owed** are paid by the farm the sibling came from, at each moving round, from grain above its reserve; the shares become the new household's starting grain (Agreed, 30 Oct).
- **Splitting land** between heirs is designed as a custom, but behaves like a buy-out until splitting exists. A sibling who gets fields also needs a house next to them; until it is built, the old household works those fields and gives the sibling half the harvest (Agreed, 30 Oct).

### Leaving home

- **The moving round** follows the meetings each autumn: handovers and a fresh count of who wants to move out. It is also when households negotiate marriages: each match the round finds is an offer both households answer, made in the round of the man's village (Marriage as a negotiation, below; Decided, 9 Nov; the offer Agreed, 9 Nov). (Was, Decided 30 Oct: marriages come mostly from courting, at any time of year, and the yearly matchmaking stays for pawns who are not courting, as arranged marriages.)
- **A village's round** (Decided, 10 Nov; Kim, code review: the game is about locally supported community). Every village holds its own round on autumn day 11, as today, each in its own six-minute step from noon, in the order of village id. A lone farm is a village of one farm and holds its own. A village's round matches its own unmarried men, by today's score, and a woman of any village may be chosen; the same-village bonus stands. A woman married in an earlier village's round, or held by an open offer from it, is no longer free. Its handovers follow, for its own farms and for the homes in other villages that its marriages chose, and so does its count of those who found no spouse only because of kin. The order changes who asks first. The whole island's men used to ask in one list, those with a place first, then the oldest. Now every man of village 0 asks before any man of village 1, so a woman of a later village may be chosen by an earlier village's man before her own village's men ask. Measured, the first third of villages' men lose the woman they score best about half as often as before (backlog VB-242). So the starting village turns by the year: the round starts at village `year mod count` and goes on in id order, wrapping, and the meetings with it (Decided, Kim, 10 Nov; VB-280 builds it). Who wants to move out, claims on empty farms, plots, settlement and service follow once every village has held its round, over the whole island as before (Proposed, VB-242; tasks VB-277, VB-279); since 10 November the distance they reach is walking hours (Between villages, below; Proposed, VB-281, `QUESTIONS.md`, VB-281, question 2).
- **Marriage** is negotiated between the two households (Decided, 9 Nov; was: comes from courting, at any time of year). It needs a place to live under the residence custom, kin no closer than the custom's limit, by civil degree, and the means to marry in the home. Matches favour the same village and an age gap of about 3 years; since 10 November, villages near by walking hours, and no woman beyond walking reach (Between villages, Ease of mixing; Proposed, VB-281). The two marry when both and their spokesmen have said yes: at once when no player answers, else within 7 days of the round (Marriage as a negotiation, The offer).
- **Wants to move out:** an adult of 18 or more with no farm, no spouse with a farm, and no place in line for one.
- **Service:** a landless adult may take service where labour is short: below 1 hand (members 14–59, not retired) per field. At the moving round unmarried landless adults from households above 1.5 hands per field go, oldest first, to the shortest household of their village, else of the nearest village within 15 steps; board and lodging only (backlog VB-090; Agreed, 30 Oct). Proposed, VB-281: the nearest village within a day's walk (12 h) in place of 15 steps, and the servant walks there (Between villages).
- **A start in life:** a cow and a few ewes from the family's share give a new household its start.

### Marriage as a negotiation (9 November)

From the gameplay review of 9 November. A peasant marriage between landholding families was a settlement between two households, of people, land and goods, and it is the largest choice of a life; so it is a negotiation the player takes part in, not a match the round makes over its head. The first row is Kim's; the rest was proposed with it and accepted the same day (`QUESTION_ARCHIVE.md`, "VB-233"). VB-233's plan (10 Nov) checked them against the code and corrected two rows to the form the round can carry, marked below; its tasks are VB-293 (offers), VB-273 (the offer in the page), VB-274 (the wish for a match), VB-275 (opinion, waiting for Kim) and VB-276 (terms, slice 4).

| Aspect | Design | Status |
| --- | --- | --- |
| The principle | A marriage is negotiated between two households, and the player takes part: for its own pawn, and as head of a household for the household's members | Decided, 9 Nov |
| Who negotiates | Each side's spokesman (*giftoman*): the head of the household the pawn lives in as a son or daughter of the house; an adult with no such head (a holder, a widow or widower, a servant, a cottager) speaks for itself. A son or daughter of the house is a child of the holder, of the holder's spouse or of the holder's parent who lives in the household and is not in service (VB-233) | Agreed, 9 Nov |
| Consent | Both who are to marry must consent, as canon law asked; a pawn that refuses a match its head made loses some of the head's opinion (a memory, "Refused the match I made", -0.2 for 3 years). In the first version only the player refuses, so only the player's refusal costs it; where opinion enters the answers of pawns without a player is open (`QUESTIONS.md`, VB-275). A cause for a custom ("Who makes a match": the heads; the heads with consent; the couple) is a candidate | Agreed, 9 Nov; the memory's size Proposed (VB-233) |
| The offer | First version: the round's matcher finds the pairs it finds today, in the round of the man's village, and each becomes an offer that both sides answer; a side with no player answers yes, so a run with no player is unchanged. An offer the player must answer is kept as plain data with its due time, the round goes on without it, and the two are not free to anyone else while it is open, a later village's round of the same day included (VB-242); it closes with the marriage (and the handover a marriage brings) when all have said yes, refused at the first no, or at its due time, when those who have not answered say yes. A refused match waits for the next round: the round does not look again for the two that year. The spouse whose new home lies in another village walks there after the marriage (Between villages, A journey; Proposed, VB-281). Later, heads look for matches themselves and weigh the other household's land, stores, standing and the tie between the two | Agreed, 9 Nov; corrected 10 Nov (VB-233, orchestrator's decision for Kim to overturn): the round marries as it goes and each marriage changes the homes and heirs the next choice reads, so an offer cannot hold the round open; it is answered after it |
| Terms | First version: none beyond the means to marry and A start in life, above. With slice 4's goods and worth: a dowry (*hemföljd*), counted against the bride's share of the inheritance, and a morning gift (*morgongåva*) from the groom's side, hers if she is widowed; both booked in customary worth | Agreed, 9 Nov |
| Courting | Keeps its place from slice 7: a courting couple's wish is what moves their heads to negotiate, and is enough by itself for those who speak for themselves; a courted match the heads refuse may end in a birth outside marriage, or in the couple leaving for service. The negotiation is the round's offer: a courting couple's wish works as the player's wish for a match does, for both of them (backlog VB-036 writes it) | Agreed, 9 Nov |
| The player's doors | As the one to marry: a wish for a match (carried to the round as its other wishes are) and yes or no to an offer. The wish is "not this year", which keeps the pawn out of the round's matching, or a partner, offered at the man's village's round before the matcher chooses, if the round's rules allow the pair (age, kin, a home with the means to marry) and its score, with chance at its mean, reaches the round's lowest accepted score; the wish is the pawn's own yes. As head: yes or no for a member, and, later (with the terms, slice 4), proposing a match and its terms. An offer is the first question asked through `Decisions.answer`; it stays open for 7 game days, the world does not wait, and unanswered the pawn answers as it would unplayed | Agreed, 9 Nov; the wish's form Proposed (VB-233, orchestrator's decision for Kim to overturn: a wished partner must pass the round's rules and its lowest score, which stands for the other side's judgement until opinion enters) |

### Between villages: distance and journeys (10 November)

Kim's decision of 10 November (`QUESTION_ARCHIVE.md`, "VB-242", question 2) on what reaches between villages: a wife from another village, claims on empty farms, settlement, service. Until now each reached by its own measure, hex steps as the crow flies or nothing, and nobody walked: a bride married into a village 60 hours away stood at her husband's door in the same six-minute step. VB-281's plan (survey and numbers: `backlog/VB-281.md`) proposes the rows below; its open forks are in `QUESTION_ARCHIVE.md`, "VB-281", and its tasks are VB-286 (the distance), VB-287 (journeys), VB-288 (the matching), VB-289 (the suitor's visit), VB-290 (the round's other acts), VB-291 (kin help) and VB-292 (the player's journey).

| Aspect | Design | Status |
| --- | --- | --- |
| The principle | "It should be governed by intra village distance, there should be easy mixing for close villages, but preparing for a long trip is not cheap. The pawn should physically travel." (Kim; "intra village" read as between villages) | Decided, 10 Nov |
| Distance | One measure between two villages: the walking hours between their greens, by the route search's costs (terrain, slope, worn paths) at 3 tiles an hour on meadow. Compiled into a table, a village's row a step on autumn day 9 (so at most a year old) and at a village's founding, bounded at the route search's reach (200 meadow steps, 67 hours); beyond it, or with no route by land, a pair is out of walking reach. At `medium-ref` (29 villages) the median pair is 41 hours apart and a village's nearest neighbour 3.6 to 16 (median 5.2); at `small-y40` (23 villages) 27 hours, and 3.6 to 9.6 (median 6.2). This is the "one reach query" of Climate and travel beyond walking, on foot; boats, carts and ice add to it in slice 10 | Proposed (VB-286) |
| Near and far | A day's walk is 12 hours, 6:00 to 18:00. **There and back in a day:** 6 hours or less; work done from home reaches this far (VB-281 counts 14 pairs at `medium-ref`, 6 at `small-y40`). **A day's walk:** 12 hours or less; villages this close mix as neighbours (52 pairs, a median of 4 neighbours a village, at `medium-ref`; 38 and 3 at `small-y40`). **A long trip:** more than 12 hours, nights on the road. **Out of reach:** no route by land, or more than 67 hours | Proposed |
| Ease of mixing | The round's choice of a wife weighs the walking hours between the two villages: its village term is 2 × exp(-hours / 8), so 2 within the village, as before, 1.2 at 4 hours, 0.45 at 12, 0.1 at 24 and nothing at two days; it replaces the term of the two villages' ties to their culture's centre. A woman out of walking reach is not in the pool. In the fixtures' last ten years, 56 of 118 marriages at `medium-ref` joined villages more than a day's walk apart or over the sea | Proposed (VB-288) |
| The suitor's visit | A woman of a village beyond a day's walk may be chosen only by a man who visited her village since the last round. A man who found no one at his village's round, and whose home has the means to marry and the visit's food, sets out in winter for the nearest village beyond a day's walk that holds a free woman he could marry; he stays a day as a guest and walks home. | Decided, 10 Nov (Kim) (VB-289) |
| A journey | A move within a village is walked too, as a walk home to the new door and no journey (Agreed, 10 Nov; VB-287). A pawn whose new home lies in another village walks there: its household changes at the act (the marriage, the service, the claim), and the pawn walks the route from where it stands, a leg a day from 6:00 to 18:00, sleeping where it stops, takes no work on the road, and arrives. Each leg is a due entry, so nothing is polled; the walk is the simulation's whether or not the camera sees it | Proposed (VB-287) |
| Provisions and the season | A pawn on the road eats food carried from the household it leaves (or, short of it, from the one it joins), a ration a day of walking, and is left out of the household's meals meanwhile; settlers walk on their provisions. A visit costs its household a ration a day away and the visitor's hands: 2 × ceil(hours / 12) + 1 days, so 5 days for a village 13 to 24 hours away, 9 for 41 hours, 13 for 67. Moves walk in any season, as the act falls; a visit is made in winter, the farm's slack season, on the stored food that makes it dear | Proposed (VB-287, VB-289) |
| Who travels | Before the act: the suitor's visit. After it, to the new home: the spouse who moves, a servant, a guardian and its family, children sent to kin or service, a claimant's household when its farm is mended, and a settlers' party to its site or the small village it joins. Work done away from home (a claimant mending a farm, a plot) is walked to daily as any job is, within its reach | Proposed |
| The round's other acts | Claims on empty farms from villages within 6 hours (there and back in a day: the claimant mends the farm from home), service within a day's walk (12 hours), an orphan's service home in the nearest village by walking hours, guardians and kin homes within walking reach, the tie to the culture's centre as exp(-hours / 8); today's 15 hex steps measured 3.6 to 10.8 hours. They stay island-wide steps after the villages' rounds (open: `QUESTIONS.md`, "VB-281", question 2). Settlement's sites stay a search of tiles from the green | Decided, 10 Nov (Kim) (VB-290) |
| Kin help | Kin within a day's walk give as now; then the village store; then kin further away, whose gift one of their adults carries on a journey (at most a load: 30 rations on the back, 90 with a cart and two oxen, one number with the fair's; Kim, 10 Nov, was 60) and which arrives with him. Of one year's kin gifts, 34 of 116 at `medium-ref` and 49 of 80 at `small-y40` came from beyond a day's walk or over the sea. | Decided, 10 Nov (Kim) (VB-291) |
| Over the sea | No marriage, claim, service or help between villages with no route by land until slice 10's boats and ice (Climate and travel beyond walking); every village of both fixtures has a neighbour by land within 16 hours. | Decided, 10 Nov (Kim) |
| The player's journey | By parity of command, the played pawn, or as head an unmarried son or daughter of the house, may set out on a visit at the same cost and season. | Decided, 10 Nov (Kim) (VB-292) |
| Cost | Village pairs are few (406 at `medium-ref`): the table holds villages² hours, a row a step (a bounded search from the green, 2.4 ms median and 19 ms at most at `medium-ref`; the table 95 ms a year, spread). About 26 journeys a year at `medium-ref` and 10 at `small-y40`, each one route search and a due entry a leg. The pool of the round shrinks to the women within reach, so fewer pairs are scored | Proposed |

### Empty farms

- **Buildings** lose about 8% of their condition a year; below 40% the turf roof has fallen in, below 15% the farm is a ruin to rebuild.
- **Fields** turn to meadow within 1–2 years; near woodland, without grazing or farming, meadow goes on to scrub and young forest. Each stage needs a longer clearing job.
- **Claims** follow the claims custom, married couples before singles. A claim posts restoration jobs owned by the claimant's household; they move in once the roof is repaired. Agreed. Proposed, VB-281: a claimant from another village must live within 6 walking hours of the farm's village, in place of 15 hex steps (Between villages, The round's other acts).
- **Restoration hours** grow as the farm decays, along straight lines through 0 hours at 100% condition, 20 at 40%, 60 at 15% and 120 (a full rebuild, as a new cottage) at 0%: about 3 hours at 90% and 36 at 30%. Fields gone to grass are cleared like a meadow (10 hours), scrub in 20. Under “the meeting assigns”, the claimant with the most voice-weighted support wins. Decided (the curve), Agreed (rest), 30 Oct.

### Clearing a new plot

The village clears a plot when adults want to move out and there is room. (Decided; details Agreed, next batch)

- **Trigger:** at least one person waiting, nothing claimable, and a free site. Up to two projects per village at a time (Decided, 30 Oct).
- **Room:** a house tile and its first field within about 6 steps of the green, not owned, not the green, not the last commons forest, passable, in the village's own or a neighbouring region. Houses may stand next to each other, and a field need not touch its house, though tiles next to the house are preferred (Decided, 30 Oct).
- **Size:** a new plot is a house and 1 field; the household makes more fields itself (Decided, 30 Oct).
- **Jobs, owned by the village:** clear a meadow tile (10 hours, plus up to 20 for stones) and break the ground (30 hours); fell forest (10 hours, yielding firewood and timber), then grub out the stumps (6 hours); build the cottage in three steps, foundation 30 hours, walls 60 and roof 30, using the timber, so a plot takes most of a year for two or three people (Agreed, 30 Oct).
- **Who works:** role priorities (0–10) of 9 for those waiting for the plot, 7 for farmhands and maids, 5 for sons and daughters and 3 for farmers; landholders treat it as a lower village duty. Labour per person is recorded (Agreed, 30 Oct).
- **Who gets it:** decided by the “cleared land belongs to” custom. Default: the village allots it, married couples first, then by age; a single adult can get one after every couple (Agreed, 30 Oct).
- **What you see:** turned soil and stumps, then foundation stones, rising log walls and the turf roof.

The job hours were revised to the long-work scale on 30 October 2026; stones in meadows lengthen clearing.

**Concern:** with one heir per farm and few empty farms, most younger siblings end up as servants or unmarried at home. Clearing new land is the release valve.

### Households short of people (built 1 November; recorded 2 November)

The stability review (`docs/review-stability.md`) added rules that keep a household from dying out for want of hands. Built, numbers in `MARRIAGE`, `SERVICE` and `SETTLE` (`src/sim/rules.js`). (Decided by Kim, 1 Nov; the numbers Agreed, 2 Nov)

- **Marriage of two holders.** Two people who each hold a place may marry; the farm they leave is handed on to an heir who can keep it, else to the landless adult of its village who has waited longest, else it stands empty until claimed (VB-033).
- **The means to marry.** A couple marries only with a year and a half of food in store (`MARRIAGE.means` 1.5); a home with fewer than two adults is exempt.
- **A guardian for an orphaned heir.** A household with no adult takes in a landless relative as guardian, else its children go to kin and the farm stands empty.
- **A servant for a lone holder.** A holder who lives alone takes in an unmarried landless adult of 18 to 50 from a household that keeps 2 working hands, in its village or within 15 steps. Proposed, VB-281: within a day's walk (12 hours) in place of 15 steps, and the servant walks there.
- **Short of people, checked at the change** (Proposed, VB-283, 10 Nov 2026). Whether a household still has a grown member is checked when its membership changes (a death, a member who leaves, a household founded), not by a daily pass over every household: the change notes the household, and the guardian rule reads only the households noted. Same behaviour, cost by change (backlog VB-323).
- **Taken in before it starves** (Proposed, VB-283, 10 Nov 2026; the orchestrator's decision for Kim to overturn). A household is short of people when at most one of its members is 18 or more and it holds fields: a lone adult, or a minor holder with one grown housemate. The sign is help falling short: when such a household's seasonal ask for help (Goods and the farming year, Help in hunger) leaves it short of food to the next harvest, it is taken in at once. Kin first: its nearest landless grown relative free to move (chosen as a guardian is, by kinship, then the oldest; unmarried, 18 to 50, from a household that keeps a grown member) moves in, with spouse and minor children. Else a servant, by the rule for the lone holder above, at once rather than at the next moving round. People come to the farm, so its owner, holder and fields are unchanged (backlog VB-308). Measured (VB-283, the ten full runs at `38b920d`): 56 of 225 household-years hungry over 0.3 after year 3 are of households short of people (34 households; 35 of them hold one field); a free relative was within reach for 14, a servant for 1.
- **Held by kin when nobody can come** (Proposed for Kim, VB-283, 10 Nov 2026; `QUESTIONS.md`, VB-283). When no relative and no servant can come, the household's people move to its nearest kin household within walking reach (parents and children before siblings, as help asks), and that household holds the farm in trust: it works the fields and takes their harvest, while the owner and the holder stay the same; the house stands empty and decays as an empty farm's does. The trust ends when the holder can return (marries, or takes a servant at a moving round), when a ward comes of age, or at the holder's death (succession as today). An orphaned heir whom no guardian can come to is held for the same way, by the kin who take the children, in place of the farm standing empty (would change the Decided guardian rule above). 42 of the 56 household-years had nobody to come; 33 of them had a kin household within reach (backlog VB-309).
- **Room.** A new village lies 5 steps or more from other farms and 12 from any village centre; a new farm needs 6 free farmable tiles within reach besides its first field.
- **Names on the map.** A village of two or more farms is labelled once; a lone farm's village bears its farm's name (VB-026).

### Moving to new land

When a village is full, its landless adults may leave to found a farm of their own on new land, or join a small village nearby: the daughter settlements (*torp*, *-ryd*, *-boda*) of the medieval colonisation of the outland. Review and sources: `docs/review-expansion.md`. (Decided, 1 Nov: who leaves, fresh land, small villages, distance; Agreed, 2 Nov: deciding, provisions, where, the bonus of fresh land; the rest Proposed)

| Aspect | Design | Status |
| --- | --- | --- |
| Crowded | At the moving round, after plots are started, a village is crowded when adults of it wait for land (no plot, no cottage coming) and no plot site can be found; the village panel shows how many wait | Proposed |
| Who leaves | Landless adults only, with their spouse, their minor children and siblings who follow; holders never leave their farms | Decided, 1 Nov |
| Deciding | A waiting adult of 18–45 in a crowded village leaves at a moving round with a chance of 0.3 after one round of waiting there, 0.6 after two, 0.8 from three; older waiters first. Each unmarried sibling also waiting there follows with a chance of 0.5, at most 2, as farmhand or maid, still landless | Agreed, 2 Nov |
| Provisions | Food until the next harvest and a week's margin (42 days of the party's rations; 36 left none) and seed for one field, from the party's stakes and then from their old households' grain above their own seed and food until the harvest (or the holder's buffer, if longer); short of it, they stay a year and the log says why. A household that took in a spouse at this round gives none in it: the grain the marriage was allowed on is not given away the same afternoon (backlog VB-330) | Agreed, 2 Nov (42 days); Agreed, 10 Nov (none from a home that just married) |
| Where | First a small village: one of 1 to 3 farms, within 30 walking steps of home, not crowded (room for a plot, none of its own adults waiting, fewer than 2 plots or booths under way), with kin first, then the nearest. Otherwise a new village, 10 to 30 walking steps from home. The party walks there, a leg a day (Between villages, A journey; Proposed, VB-281) | Decided (small villages, distance), 1 Nov; Agreed (rest), 2 Nov |
| The new site | Meadow nobody owns, at least 3 steps from any house, green or field, with a block of 3 free fields and a wood within reach; the best by land, wood, water and nearness, its fields at least 0.9 times as fertile as the home village's | Proposed |
| The booth | The party moves at once into a booth (*bod*) on the site and builds the cottage as its own household's work: foundation 30 hours, walls 60, roof 30; it clears its first field and makes more as any farm does | Proposed |
| The new village | A village of one farm, no green or well, named for its founder (Erikstorp, Olofsboda); it keeps its mother village's customs and culture and records where it came from; its tie to the centre is computed as for any village, so a far daughter drifts more easily and may split off | Proposed |
| Fresh land | A field broken on ground never farmed starts with soil 1.4, above manure's cap of 1.15, and wears 0.08 a crop as any field: on a manured farm it is down to the cap in about 3 crops; without manure it stays 0.4 ahead of an old field until both reach the floor (about 9 crops); in every scenario | Decided, 1 Nov (the bonus); Agreed, 2 Nov (soil 1.4); Proposed (wear) |

### Households and other bodies (slice 5, 11 November)

Proposed by slice 5's plan (backlog VB-184, 11 November 2026), from `docs/roadmap.md` 3.5 and target-v2 (4.4, 4.6, trace 7.1). A body is
what holds land, owes and is owed: in slice 5 the household and the village; the alderman is the village's first office. Its
answers stand as Agreed (Kim, 12 Nov; `QUESTION_ARCHIVE.md`, VB-184); only the membership graph is open (`QUESTIONS.md`, VB-184, question 7).

| Aspect | Design | Status |
| --- | --- | --- |
| Bodies | Households, villages, parishes, courts, estates, workshops, crews and ships as bodies, with members along typed role edges; a body exists only when something needs its own identity. One membership graph with rules per kind is Proposed: it passed the succession probe (target-v2, section 9). Measured on 11 November (VB-184; populous medium, seed 7, year 12: 1,031 living, 1,288 ever born, 211 live households): the graph of today's memberships (residence, service, holding, a household's village, unions; the dead's ended edges kept outside the live index) has 2,009 edges, builds in 0.55 ms, and the household cache derived from it in 0.33 ms, equal to today's for every household; a move (an edge ended, one made, the cache kept) costs under 1 µs; VB-043's bound is 50 ms. Proposed: adopt the graph, with the household cache as Membership's own (`QUESTIONS.md`, VB-184, question 7) | Open (Decided, 3 Nov: iterate before deciding); measured, 11 Nov |
| The alderman's estate | A derived view first: the alderman is an implicit elite with no title; once a holder has rank, his estate is a body of its own | Decided, 3 Nov |
| Testament | Choosing an heir outside the custom's order only where custom allows a testament | Decided, 3 Nov |
| Who owes | A loan, a rent or a wage binds the body its agent dealt for, named at the time of the deal: in slice 5 always a household (its holder deals for it) or a village (its alderman deals for it). A holder's death or retirement leaves its household's obligations standing. There are no personal debts until personal goods exist (silver, slice 8), so no personal estate is needed yet; a pawn's goodwill at death goes as The gift says | Proposed, 11 Nov |
| A dissolved debtor | Its obligations pass to its successor: the household that takes its farm, else the household its last holder's heir lives in; with neither they lapse, and the creditor's holder remembers it ("Never paid us") | Proposed, 11 Nov |
| The alderman | The village's office (*ålderman*). Chosen at the autumn meeting when the office is vacant, among the village's holders, by the practice "How the alderman is chosen": elected by the meeting's voices (default), or by turns among the farms, a year each, in the order of their founding. Held until death, retirement, leaving the village or the turn's end. He presides: his voice decides a tie at the meeting, and he is the village's agent, so the village store's help and the village's loans are booked as goodwill to him in person (target-v2, section 5.5); office goodwill never passes. He gains 0.3 prestige while in office. No land goes with the office in slice 5 (a common meadow's use, target-v2 trace 7.1, waits for grazing rights, VB-141) | Proposed, 11 Nov |
| Class | A derived view, never stored as truth, recomputed yearly a village at a time, after its meeting (rule 5), with hysteresis: a household is a tenant when it works more land than it owns, a cottager on a cottage with one field or none, a peasant when it owns most of what it works, and landed when its rents received and its stores have covered its need 1.5 times at three year ends running; it stays landed until three year ends running below 1.1 (target-v2, section 4.6; the cities review's master household). Specialist comes with slice 6; the landless are adults with no household of their own, counted as now | Proposed (target-v2, section 4.6), 11 Nov |
| What landed changes | Through rule contributions only, never a rule of its own: the holder's priority for field work falls to 2 of 10 (it works the fields only when no one else will: tenants' and debtors' days, servants and the hired do it), and the holder gains 0.2 prestige, which weighs its voice at the meeting. The implicit elite (Institutions: the implicit Crown); nothing else reads the class | Proposed, 11 Nov |

## 6. Land, ecology and rights

### Land and ecology

Tiles carry their own state (trees, stones, grazing), and work, grazing or neglect moves them from one kind of land to another.

| Aspect | Design | Status |
| --- | --- | --- |
| Trees per tile | Each wooded tile holds a sensible number of trees, at full cover about 60 broadleaf or 80 pine (±20% per tile); cutting fells them one by one, one per firewood trip, on a tile drawn at random from the village's wood (below). A partly felled tile grows back to full in about 30 game years, by one growth model for all trees | Decided; Decided, 10 Nov (the random tile) |
| Showing trees | Not every tree is drawn: a tile shows stages for about 100%, 75%, 50% and 25% of its trees remaining | Decided |
| Cleared woodland | At 0% trees the tile becomes meadow; regrowth applies only to tiles that still have trees | Decided |
| The village's wood | A village cuts in an allotted area of wooded tiles, not on one tile: cut on one tile, a household's 11 trees a year outrun the tile's regrowth of 2 to 3, and the tile goes bare and to meadow for good (in 40 years of populous small, a quarter of the island's forest tiles, plots included). The area is sized to the village's hearths so that its regrowth meets their cutting, 5 tiles a household, at least 6 and at most 150; the nearest wooded tiles within 12 walking steps of the centre (4 hours each way, so a trip fits the working day), in the village's own land first, then forest no other village holds or claims; reckoned at the autumn meeting. A trip's tile is drawn evenly among those with more than a quarter of their trees, so the wood thins and is seldom cut bare. A village with no forest in reach has no wood, and its houses are cold (Goods and the farming year, Fuel); generated villages stand within reach of one (backlog VB-326) | Decided, 10 Nov (an area, larger; a random tile of it); Agreed, 10 Nov (the numbers, generated villages) |
| Timber | Building takes wood as burning does: a cottage's walls take 18 loads (six trees), from its plot's felled tiles or felled in the village's wood; what a felled plot leaves over fills the woodpiles of the new household and of those who worked it; a new household's first wood comes from the homes its members leave. A boat, a bridge and a barrel of tar fell their trees in the same wood (backlog VB-328, VB-300, VB-301, VB-115) | Agreed, 10 Nov (a cottage's 18 loads, the plot's wood, the first wood) |
| Stone | The stones cleared from fields and meadows lie on the household's heap and are built with: a cheap house is timber on the bare ground, and a household may later raise it onto a stone foundation, which lifts what a well-kept house gives in standing (Goods of place, A well-kept house). Stone also comes from picking on stony meadows and from quarrying in hills and mountains, a load a trip (backlog VB-332) | Decided, 11 Nov (stone is used, for the better house at least; the cheap house can be upgraded; picked or quarried); Agreed, 11 Nov (a foundation takes 12 loads and 40 hours; on stone the prestige term is 0.20 times the condition and the wear 0.08 a year; picking 2 hours a load within 12 steps, quarrying 4; the well takes 6 loads) |
| Stones | Meadow tiles track their stone content: every untouched meadow tile has some, and tiles near hills have more, the extra fading to nothing within about 2 tiles | Decided |
| Meadow to field | Breaking ground takes long where stones are many; the stones cleared become building material | Decided |
| Abandoned fields | An untended field becomes a stone-free meadow | Decided |
| Fresh land | Ground never farmed yields more for its first crops: a new field there starts with soil 1.4 and wears to manure's cap in about 3 crops (see Inheritance and expansion, Moving to new land) | Decided, 1 Nov (the bonus); Agreed, 2 Nov (soil 1.4); Proposed (wear) |
| Forest spread | Forest turns nearby meadow, and fields by way of meadow, into scrub and then woodland, unless grazing or farming keeps the land open. Built after grazing pressure: open land next to forest reaches scrub in 8 years and forest in 30; a field in use, a house, a green, a meadow mown that year, work in the last year or enough grazing keep it open; heath closes like meadow (backlog VB-091) | Decided; Agreed (rates), 30 Oct |
| Grazing | Herds of wild and domestic animals graze, and grazing pressure shapes the land (see Animals) | Decided |
| Worn paths | Where pawns walk often, trodden paths show in the world; a path speeds up walking, so routes prefer existing paths and pawns come to share them | Decided, 30 Oct |

#### Making a hay meadow

A hay meadow is built land: it has to be found, claimed and prepared before it yields hay, and it can be private or common. (Decided; the steps are Agreed)

1. **Find a suitable tile:** open grass, a shore, or damp ground where hay grows well; northern Swedish farms also mowed mires and lakeshores.
2. **Claim it** as a tile claim, for the household or for the village.
3. **Clear it** of scrub and the worst stones, which takes longer on stony ground.
4. **Fence it into the infield** where animals graze nearby.
5. **Each spring, rake it clean** of twigs, leaves and fallen branches before the summer mowing (*fagning*).

After mowing, herds may graze the regrowth (*efterbete*). A meadow left unmown and ungrazed falls under the forest-spread rule.

#### Grazing at low cost (Agreed, see Animals)

- **Herds, not individuals:** animals live as herds with a species, a count and a home range.
- **One number per tile:** grazing pressure, updated once a game day from the herds whose ranges cover the tile; about 56,000 values, a negligible cost.
- **Pressure feeds forest spread:** it decides whether meadow near woodland stays open, and heavy grazing thins it.
- **Near the camera:** each herd shows a handful of animal sprites wandering inside its range; the same few stand for the whole herd.
- **Farther out:** grazing shows only in the painted ground as shorter, browner grass, repainted for an area only when its pressure has changed enough.
- **Individuals where the story needs them:** a herd's cattle, by name (Agreed, 31 Oct); hunting and herding act on the herd.
- **Pressure where herds graze:** a herd adds pressure only on the tile it grazes with its herder, which fades by half each year as worn paths do; cheaper than updating every tile of a home range, and it shows where herds have been (Agreed, 31 Oct; backlog VB-136).

### Claims, ownership and territory

Ownership and claims are tracked on tiles: every tile has an owner, and any entity may hold a claim on it that is realised (in force) or unrealised (wanted). (Decided)

| Aspect | Design | Status |
| --- | --- | --- |
| Ownership | Each tile records its owner (none, a household or a village); the village commons belong to the village, and an empty farm's tiles pass to its village | Decided |
| Claims | Entities can claim tiles they do not own: realised, or unrealised, such as a pawn who wants to turn a commons tile into a field | Decided |
| Who may claim | Households, villages and pawns | Agreed, 30 Oct |
| Expiry | An unrealised claim decays linearly after 3 years without work on the tile, and can be renewed | Decided, 30 Oct |
| Disputes | Two claims on one tile are settled by a custom, “Disputed claims” (see Custom dimensions) | Decided, 30 Oct |
| Fields and meadows | Claimed tile by tile before they are made, for a household (private) or the village (common) | Decided |
| Overlay | Ownership and claims, realised and unrealised, can be shown as a map overlay; a simple first version tints tiles by owner | Decided |
| Filters | As for resource stores and family trees: any level and dimension of entity can be chosen (pawn, family, household, village, city, culture and more). The first version filters by household and village, with the selected entity highlighted; culture later | Decided (Agreed: first version, 30 Oct) |
| Challenge | The overlay and filter systems must be both modular and performant | Open challenge |

A household making a new field first claims its meadow tile (Decided). Claims on empty farms would become tile claims under this model too (Proposed).

#### Infield, outland and wilderness (claims review, 1 Nov)

Land lies in three rings, as in the medieval village: the infield of houses, fields and meadows (*inägor*), held by households, with the green and plots held by the village; the village's outland (*utmark*), its common pasture, wood and land to take in, held by the village; and wilderness, held by nobody. Review and sources: `docs/review-claims.md`. (Decided by Kim, 1 Nov: the parts and their effects; numbers Proposed)

| Aspect | Design | Status |
| --- | --- | --- |
| Outland | Claimed by need at each autumn meeting: free tiles nearest the green, within 8 walking steps, until the village holds about 8 tiles of outland a farm; the nearest forest first when it holds none | Decided (by need), Proposed (numbers), 1 Nov |
| A year and a day | An outland claim that stands unopposed until the next meeting becomes village land; the village claims a tile another village wants only when it lies nearer its own green | Decided, 1 Nov |
| Borders | Two villages claiming one tile: the Disputed claims custom settles it at the meeting (the custom both hold; if they differ, the culture's); the border is marked with cairns (*rå och rör*), drawn on the map and told in the log | Decided, 1 Nov; **Under revision** (slice 4): Kim, 10 Nov: disputes between villages are resolved at the gathering (see The gathering); a village with no gathering keeps this rule |
| Border pressure | A village still short of outland once no free land is left in its reach may claim the outland of a neighbour that holds more a farm (at most 4 tiles a meeting); the holder's right is the oldest claim, so under "the first claim stands" the holder keeps it and under "the meeting decides" the village with more voices takes it; a village with no occupied farm cannot defend its land; a cairn keeps the loser off a tile for 3 years | Decided (pressure), 2 Nov; Proposed (rule and numbers) |
| Border grudges | The losing village's holders remember the winners' holders ("Won the border from us"), fading over 3 years; its households lean towards the rules that would have let it win | Decided, 1 Nov |
| Taking in land | Households and plots take in land only from their own village's outland or from wilderness, never from another village's land or claims | Decided, 1 Nov |
| Settlers | New villages are founded in wilderness only | Decided, 1 Nov |
| The commons wood | Chosen in the village's own land when it holds forest. From VB-326 an area of tiles (Land and ecology, The village's wood): those in the village's own land first, and its outland claim counts the rest as need | Decided, 1 Nov; Decided, 10 Nov (an area) |
| Stakes | A field or meadow project stakes an unrealised claim; breaking the ground makes it the household's; a household with no free tile within reach may contest a neighbour's claim weakened below half (about 18 months unworked); the custom decides and the loser remembers it ("Took our claim") | Decided, 1 Nov |
| Birthright | When a farm empties, its last holder's family keeps a birthright claim on it (*bördsrätt*) for 20 years, which puts them first under "kin first" (VB-033) | Decided, 1 Nov |
| Land and tax | The land each household and village holds, by ring and kind, is counted in one place, as the base for a land tax and for landholding elites later | Decided (as a base), 1 Nov |

#### One scope model for overlays, stores and trees (Agreed, 30 Oct)

- **A scope** is an entity level, the entities chosen, and a dimension (owns, claims, uses, works, is kin of). The same scope drives the ownership overlay, the store views and the family tree.
- **A membership graph** links the entities: pawn to household, household to village, village to culture; families cut across households. Each view asks the graph for the tiles, stores or people in scope.
- **Compact tile data:** one owner per tile, and claims as a short list per tile, since most tiles have none.
- **Cached overlay:** drawn per map chunk; when ownership or claims change, only the chunks they touch are redrawn.
- **Cheap filtering:** changing the filter recolours from the cached data; nothing is recomputed from the simulation.

### Land and rights (slice 5, 11 November)

Proposed by slice 5's plan (backlog VB-184, 11 November 2026). The Decided rows of Claims, ownership and territory stand: every tile
still records its owner. What slice 5 adds is that the one who owns a holding and the one who works it may differ.

| Aspect | Design | Status |
| --- | --- | --- |
| A bundle of rights | Land is held as a bundle of rights per holding (own, use, occupy, develop, graze, gather, fell, fish, pass), after Honoré (1961). A right may hang off another (a tenancy off the owner's right), so ownership can pass while tenancies stand; foreclosure usually changes who is owed, not who farms | Proposed (target-v2, section 4.3) |
| Slice 5's rights | Only `own` and `use` are held apart. Grazing rights come with VB-141's plan, `develop` with the mill (slice 6), `pass` with built ways (slice 10). A holding is a farm (its house and yard), a field or a meadow; most holdings have one holder of both rights, and only those held apart are recorded, so the cost follows tenancies, not tiles | Proposed, 11 Nov |
| Owner and user | Each tile records the household or village that works it (the user, which every rule of work reads, as the owner is read today) and, where another owns it, its owner, the tenancy's start and its rent. The Land overlay shows both: the owner's tint, the user's edge | Proposed, 11 Nov |
| Tenancy | Land worked by a household that does not own it, for rent: a quarter of each harvest of the holding, delivered when it is threshed, and 2 days' labour a year at the owner's harvest, taken as the owner's tasks on the basis `debtor` (Work, Who may take a task). It runs for the tenant holder's life, and passes with its household at the handover if the owner's holder agrees (it does unless its opinion of the heir is below 0); it ends when the tenant household dissolves or leaves at the moving round, and the owner then works the land itself or lets it again, a farm to a landless couple of its village as an empty farm is claimed. A vacant tenancy is a home: under "with the land" a landless couple may marry onto it | Proposed, 11 Nov (the quarter and labour days: `docs/roadmap.md`, 3.5) |
| Foreclosure | A ruling of land (Exchange, Loans, obligations and cases) splits a field off the debtor's farm, the field of least worth first: `own` passes to the creditor's household, `use` stays with the debtor's, now its tenant. The house and yard go last, with the last field; the old family is then the tenant of all of it. Repeated, a household comes to own several farms, each worked by its old family (target-v2, trace 7.1) | Proposed, 11 Nov |
| Splitting between heirs | Under "land split between heirs" the same split gives a sibling fields (VB-034); until the sibling's house stands, the old household works them and gives half the harvest: a tenancy's relation with another share. A farm held in trust (VB-309) is the same relation with the whole harvest | Agreed, 30 Oct (the rule); Proposed (as a split of rights), 11 Nov |
| Land is not sold | Land changes hands by inheritance, claims, splits and foreclosure only; it is not offered at the fair or bought (The fair: land is not offered until "Debts are paid with" allows it, and then only as a remedy) | Proposed, 11 Nov |
| Passage | The village grants passage for its own land; every other holder must agree, the Crown included. A practice says whether one may cross another's meadow and pasture or keep to ways; fields and yards are never crossed | Decided, 3 Nov (passage); Proposed (the practice) |

## 7. Work: opportunities, plans and tasks

Work is available, not posted (target-v2, section 4.5). What could be done is computed from rights and stores (an *opportunity*); a *plan*
turns some of it into *tasks*; those *eligible* take them. The matcher is as before: best fit first, a poor fit only after two hours, an
urgent task pulling a pawn off a lesser one, several hands on field work. Written by slice 3's plan (backlog VB-164, `docs/review-work.md`)
with Kim's answers of 10 November. The rules of v0.3 under Jobs, owners and roles, below, stand where this table does not replace them,
with "job" read as "task".

| Aspect | Design | Status |
| --- | --- | --- |
| Opportunities | Computed from rights and stores, never stored as a list a rule must keep true; each kind says where it could be done and in what window of time. Cached per holder, rebuilt on its planning day and when its rights or stores change | Decided, 3 Nov (computed); Agreed, 10 Nov (the cache) |
| Holders and plans | A household's head is its holder and keeps a standing plan (the routines of its kind and its culture), the seasonal plan and at most one project. A plan makes tasks when its next step is open. The yearly meeting may plan from the village work available, and its plan makes tasks for the village's pawns | Decided, 3 Nov; the record Agreed, 10 Nov |
| How a holder chooses: the year | Layer 1. A template of the culture's year: season by routine, with a target for each store (the woodpile, hay, seed, fields per hand), in the order the work is done; what everyone in the village knows how to do. Today's fixed numbers are its first values. Never an optimiser: the choice is among the plan's routines and steps | Decided, 10 Nov |
| How a holder chooses: foresight | Layer 2. The head reads an estimate of the household's needs, not the needs. Wits, husbandry and years as head set how far ahead it looks (a poor head reacts when a store crosses its target; a good one projects a season ahead) and a persistent bias (one head always lays in too little wood), drawn once when it becomes head. Only the poorest heads, about one in ten, depart from the template's order | Decided, 10 Nov; numbers Open |
| How a holder chooses: projects | Layer 3. With the year's targets met and labour and stores to spare, the head takes one project at a time from a short menu of what is open to it, weighted by its values: ambition leans to more land, generosity to a farm for the heir, help to kin and village work. A capable head reaches a surplus more often, so reaches more. Slice 3's menu: more fields than the household needs, a claim on land, a farm or cottage for the heir, a barn. Standing for alderman and other offices wait for the slice that builds offices. These are the pawns' own aims, apart from the player's ambitions (Vision and scope), which stay postponed | Decided, 10 Nov; weights Open |
| Traits before slice 7 | The traits these layers read (wits, husbandry, diligence, ambition, generosity) are stand-ins until slice 7: one number per pawn and trait, drawn from a seeded stream, neutral on average. Slice 7 replaces them with the twelve traits | Decided, 10 Nov |
| How a holder chooses: what is sown | Each field's rotation and course, by the same three layers: the template names the village's usual rotation, foresight decides how well the head fits crop to field and when it sows, and a crop new to the household is a project (Goods and the farming year, Crops and rotations) | Decided, 11 Nov (the head, by skill); Proposed (the rest) |
| Planning days | Each holder reviews its plan on its own day: daily when diligent, every second day on average, every third when slack, staggered by id; also at once when a window is closing or a store crosses a target. Work that falls due at a known hour (water, cooking, milking, fodder, the haul once the stooks are dry) is opened by a due-queue and waits for no review | Decided, 3 Nov (staggered); Decided, 10 Nov (the cadence) |
| Acting without the plan | Any member may act on the household's opportunities, preferring the plan's tasks | Decided, 3 Nov |
| Village routines | The yearly meeting sets them afresh from the village work available (the fence's stretches, a common field, the green and well, work days), at most four a year. When the meeting does not decide (no quorum, a tie), a practice says what follows: "nothing" by default, so no village work that year and the cattle in the crops become a story; "as last year" is a practice a culture may hold | Decided, 3 Nov (afresh); Decided, 10 Nov (failure) |
| Who may take a task | A basis each: `member` (servants as `servant`); `villager` for the village's tasks; `helper`, an adult of the village with no work of their own, for a task that has waited 2 hours, as a gift, kin and friends first; `self`. Debtors owing labour (hours against the debt) and the hired (a wage) come with slice 5. The basis decides what the work books | Decided, 10 Nov |
| Attention | A task is full (the default), partial (left and returned to within the hour) or background (done at the side, at a reduced rate); a pawn holds one partial and one background task at once. In slice 3 only herding is background; fodder, milking and cooking stay full; spinning and weaving come with slice 6 | Decided, 3 Nov; the kinds Decided, 10 Nov |
| Reservations | A plan reserves what it will spend in the household's store, a count kept against the plan, and the household's free stock is the rest, so two plans do not spend the same timber or seed; the seed kept for sowing is the first. A step made impossible by a lost store or a lost right is reviewed at once, and a dropped plan releases what it reserved | Decided, 10 Nov |
| Sowing first | The template's order: hoe one field, sow it, hoe the next, so a small household brings in some crop (at least one crop in years 1 to 3 for the lone bachelor of the heirs scenario). A poor head may depart from it (foresight, above) | Decided, 30 Oct; as the plan's order, 10 Nov |
| How busy | No limit is set on idle hours (Kim, 10 Nov; was: 75 to 90% busy at the peaks, 40 to 60% idle in the slack seasons). Possible work is introduced as development and design go on, and the system is tuned at a review Kim will ask for. Each wrap-up reports the idle share by season. Measured on 10 Nov, farmers at populous small, four seeds: 40 to 48% idle in spring and summer, 60 to 65% in autumn, 67 to 76% in winter | Decided, 10 Nov |
| The player as head | By parity of command (section 15), the player as head may make every choice of the plan: a target (more hay, fewer fields), the tile of the next field or meadow, the order of the season's work, the project; under the checks that bind any holder (claims, reach, the farm's block). With no choice made the holder's rule runs. A player in a pawn that is not the holder acts on opportunities and cannot change the plan; asking the holder is a later verb | Decided, 9 and 10 Nov |
| The plan panel | The holder's plan can be read, and by its holder changed, in the page: routines and targets, the next steps, the project, what is reserved, who holds which task | Agreed, 10 Nov |

### Jobs, owners and roles

Jobs come from things that need doing (a field, a meadow, a herd, a household, a fence), each with an owner that decides who may take it; pawns pick by role, matched best fit first. (v0.3; revised 10 Nov (the table above))

| Aspect | Design | Status |
| --- | --- | --- |
| Sources | Each field and meadow posts its stage's job; herds post herding, milking and feeding; households post firewood when low, water daily and cooking each afternoon; fences wear, faster in winter, and each stretch posts a mend job | Decided; revised 10 Nov (the table above) |
| Owners | Each job is owned by a household (its fields, meadows, herds, cooking, cooking) or a village (common fields and meadows, the village fence, also a one-farm village's fence); city commons later | Decided; revised 10 Nov (the table above) |
| Who may take a job | Members of the owning household, servants included, or adults of the owning village | Decided; revised 10 Nov (the table above) |
| Help between households | Adults of another household in the same village may help with a household's work, and the help builds the relationship between them; it is a gift, nothing is owed. Starting values: field, threshing and fence work that has waited 2 hours, by helpers with no work of their own; near kin and friends first (backlog VB-106) | Decided (help, relationships), Agreed (rules), 30 Oct |
| Commons | Village well, green, commons wood (*allmänning*), common fields and meadows, and the infield's roundpole fence (*gärdesgård*), kept by the village as medieval provincial laws such as Upplandslagen (1296) required | Decided (common land), Agreed (the rest) |
| Role priorities | Each role ranks job kinds; farmers favour fields, firewood and fences; the mistress of the house and maids favour water, cooking and milking; children fetch water, weed, help at the harvest and herd | Decided (by role, children's work), Agreed (rankings) |
| Types of work | Roles rank types of work (tilling, tending, harvest, threshing, wood, upkeep, household; more as kinds arrive) rather than each job kind, with exceptions for single kinds where a role differs; a new kind of an existing type needs no new rankings, and types are the natural unit for the player's steering later (backlog VB-116) | Agreed, 30 Oct |
| Matching | Idle pawns and open jobs are matched best fit first; a poor fit only takes a job that has waited two hours | Agreed |
| Work beats idling | A pawn takes any allowed job that suits its role rather than stand idle, however far or low in urgency, so every posted job gets done; firewood for the winter is laid in from summer (backlog VB-103) | Agreed, 30 Oct |
| Several hands | The whole household can take part in field, land and threshing work at once (tilling, sowing, weeding, reaping, carrying sheaves, threshing, clearing, breaking), ordered by role priority, each hand at full rate; cooking, water, firewood and mending take one pawn each (backlog VB-102) | Decided, 30 Oct |
| More urgent work | A pawn at work leaves its job, which keeps its progress, when another is much more urgent: checked each hour, at most one switch an hour, not while walking or carrying, never for a job finished within the hour; much more urgent is a bid above 1.5 times the current job's plus 1. So a farmer keeps hoeing when the woodpile runs low and a son or farmhand goes for wood. The cook's call after 14:00 stays its own rule (backlog VB-107; see Multi-day jobs) | Agreed, 30 Oct |
| Village work days | The meeting sets days on which the whole village works together: closing the infield fence before the animals go out, clearing the commons; a household that does not turn up loses standing (backlog VB-120) | Decided (work days), Proposed (rules) |
| Winter crafts | In winter men make and mend tools and cut fence poles indoors and in the woods (*slöjd*); field work wears tools and worn tools slow it; fences are mended with poles (backlog VB-121) | Decided (crafts), Proposed (numbers) |
| Player steering | Merged into The player as head, above | Decided, 30 Oct; merged 10 Nov |
| Multi-step jobs | Walk to the site, work, carry the load home (sheaves to the barn, hay to the hay barn, wood to the woodpile, water indoors) | Agreed |

## 8. Goods, production and animals

Goods, the farming year, processing and animals as v0.3 has them. Typed goods, recipes and facilities are written by slices 4 and 6 (backlog VB-183, VB-185).

### Goods and the farming year

| Aspect | Design | Status |
| --- | --- | --- |
| Food | A ration is the unit of food and nothing else: one adult's food for one day; a child eats half. Every food (grain, later flour, fish, gathered food, milk, butter, meat) is worth so many rations and has a shelf life; debts and worth are counted in rations too (see Animals for milk and meat) | Agreed; a ration only the unit, Decided 10 Nov (Kim) |
| Fuel | Firewood in loads; winter use about five times summer (1.6 against 0.3 loads a day) | Agreed |
| Out of firewood | A household that cannot feed its hearth is cold, which lowers its members' mood and health, and it cannot cook. Cold by the day: the part of the day's wood it lacked, times the season's use over winter's, so a summer day barely counts. Health: 2 a cold winter day (3 for infants and the old) and no recovery from the meal that day, so a winter without wood costs an adult a quarter of its health and kills beside hunger. Uncooked grain feeds 0.75 of a ration. Mood: a modifier, with mood itself (backlog VB-062). Until this is built the woodpile is read only by the firewood job (backlog VB-327) | Decided, 10 Nov (cold, mood, health, no cooking); Agreed, 10 Nov (the numbers; uncooked grain feeds 0.75 whether or not there is wood; the use stays a hearth's, the same for every household) |
| Water | Fetched each day, from the village's well or at a farm's own house. A day with no water fetched is a day nothing is cooked (the meal is eaten uncooked, at 0.75) and costs each member a little health, 1 (1.5 for infants and the old), with no recovery from the meal that day; the water job grows urgent from 14:00 so that it comes before the cooking (backlog VB-331) | Decided, 11 Nov (no cooking, a small health cost); Proposed (the numbers, starting values) |
| Built land | Fields and meadows have to be made by work before they produce; either can be private or common | Decided |
| Making a field | Claim the tile, clear scrub and stones (many stones make it slow, and the stones become building material), then break the ground. A household starts one field at a time when it needs more (2–4 per farm); the people who till do the work; a typical meadow tile takes about 50 work hours (scrub 10, stones up to 20, breaking 30). A farm's fields lie together as one contiguous block within 4 steps of the house, not necessarily next to it, in every scenario; a new field joins the block where a free tile touches it (backlog VB-109). Balance review, 1 Nov: no fixed number of fields: a household wants fields for its food but no more than its hands can till (about 2 a working adult, 1.5 more with a team of oxen); households in every scenario make fields and meadows; heath, hills or marsh are broken only when no meadow is free (`docs/review-balance.md`) | Decided, Agreed (hours); Decided (block), 30 Oct; Decided (no fixed cap; by labour and household size), 1 Nov; Agreed (numbers, poorer land), 2 Nov |
| Field cycle | Stubble, tilled over several days, sown, sprouting, growing with light upkeep, ripe, reaped into stooks, dried, threshed, grain stored | Decided (long work), Agreed (stages) |
| Seed | Sowing costs a quarter of the expected harvest, a 4:1 yield ratio as Slicher van Bath (1963) reports for medieval Europe; a household keeps back seed for all its fields before it eats, unless it would go hungry: then it eats the seed, as the last step, and the fields it cannot sow go unsown (backlog VB-282 builds it) | Agreed; the hungry household eats its seed, Decided, Kim, 10 Nov |
| Field yield | Before animals, a meadow field gives about 100 rations in an ordinary year, less 25 of seed, so 3 fields give about 218 and 4 about 290 and a family of 6 is fed from its own fields; populous households of 7 or more get a fourth field. Retuned when milk and meat arrive (backlog VB-080, VB-048) | Decided, 30 Oct |
| Meals | A household keeps a store of meals, cooked from its foods and counted in rations; each afternoon the cook makes the next day's meals, and may leave other work after 14:00 to do it; households start with 2 days of meals, so one missed cooking uses the buffer, not a hungry day. The cook puts in what spoils first. Variety is judged in the pot: a pot of 2 sources goes 10% further, of 3 or more 20%, a source being a food that gives at least a fifth of the pot (grain and flour are one source, and so are milk and butter: butter's source is milk, dairy one source; Decided, Kim, 10 Nov). A household with no meals eats its grain uncooked, at a penalty (starting value: 1.25 rations of grain for a ration of need) | Decided, 30 Oct; meals, the pot and the penalty Decided 10 Nov (Kim); the penalty's number Proposed |
| Food from the wild | Fishing in rivers, lakes and the sea from spring to autumn, and gathering berries, mushrooms and nuts in the woods in late summer and autumn. Both are always posted, with an urgency that is low while the household has food and high when it runs short, so they fill slack hours and answer a lean summer; each water or wood tile holds a stock that use lowers and time restores (backlog VB-117, VB-118) | Decided (by urgency), Proposed (numbers), 30 Oct |
| Mixed meals | Judged in the pot, at cooking (see Meals; 10 Nov). A day's meals cooked from 2 food sources needs 10% less food, from 3 or more 20% less; grain or flour, fish and gathered food are sources now, milk and meat with the animals. Fresh fish and gathered food are eaten first and spoil after 3 game days; drying and salting come later. Built with hand-quern milling (backlog VB-119, VB-009) | Decided, Agreed (numbers), 30 Oct |
| Help in hunger | A household short of food asks at most once a season, for enough to reach the next harvest (the start of autumn; in autumn, a season's need): its kin first, then the village store; if the gifts fall short, it waits for the next season. An ask that brings nothing at all is to be asked again on a later day (Agreed, 12 Nov; backlog VB-391). The holder keeps a reserve of 20–60 days' food (drawn per pawn) before giving; a household without a holder keeps 60. The village store is filled with 25% of each household's surplus at the moving round. Help is a gift, and it raises the tie between the households and is booked as goodwill between their holders (see Exchange, goodwill and obligations, The gift); loans come with money | Decided (the store), Agreed (rest), 30 Oct; revised as a gift, 8 Nov (VB-182); once a season, until the harvest (Kim), 8 Nov |
| Soil | Each harvest wears a field down; manure from the byre restores it. Starting values: −0.08 a harvest to a floor of 0.75, +0.04 a load of manure to 1.15 (backlog VB-137). Balance review: the dung heap loses half of what lies on it in a year, and is carted before the hoe; +0.02 a load (so about 3 head of cattle, not 1.5, keep 3 fields) was tried and cost a quarter more hungry days, so +0.04 stays until herding (VB-136) and food from the wild (VB-117, VB-118) give farms more slack | Agreed; numbers Agreed, 31 Oct; Agreed (the heap rots; +0.04 for now), 2 Nov |
| Risk | Frost destroys whatever is left in the field; each year has a weather factor. With several crops the factor gives way to a season's weather, read by each crop in its own way (Crops and rotations, Crops and the weather; Proposed, 11 Nov) | Agreed |
| Yield over time | Yields rise slightly over the course of a game (better practice, tools and manuring); the soil's cap (1.15 from manure) rises by 0.1 a century of a village's years of farming, so a well-dunged old farm out-yields a new one by about 10% after 100 years (backlog VB-160) | Decided (rise), 30 Oct; Agreed (rate), 2 Nov |
| Tilling power | An ard drawn by a pair of oxen tills perhaps 2–3 times faster than a hoe. The advantage can be raised (Kim, 11 Nov): at 2.5 a team saves a farm of three fields about 30 hours a year and few keep one; the team's rate becomes 5 (backlog VB-336) | Agreed; Decided, 11 Nov (may be raised); Agreed, 11 Nov (5) |
| Field work | The hours of a field's year: hoeing 20, sowing 2, weeding in two rounds of 5 (it was a round of 2 every 6 days, four or five a crop, with as much walking as work), reaping 15 and threshing 20 (they were 5 and 6), so that grain takes a larger share of the year and the harvest is its peak; measured before, three fields took a household about 215 pawn-hours, under a fifth of two hands' year and less than its water and cooking. A missed round of weeding cuts the yield by 0.2, at most 0.4 (backlog VB-333, VB-334) | Decided, 11 Nov (a larger share by reaping and threshing; two rounds of weeding); Agreed, 11 Nov (15 and 20); Proposed (the weeding's numbers) |
| Bringing in the harvest | Sheaves come home by the load, the one load of the game: 30 rations on the back, 90 on a cart with two oxen, so a field is three or four trips on the back or one or two with a cart (backlog VB-335) | Decided, 11 Nov |

### Crops and rotations (slice plan VB-345, 11 November; being written)

The game grows several crops. Each is a row of rules, and a field holds its crop and its place in a rotation; the field cycle above is read through the crop's row. Written by the plan task VB-345 from Kim's answers of 11 November (`QUESTION_ARCHIVE.md`, VB-345). The table of crops, the rotation, the head's choice, seed, the scenarios' crops, the weather and what crops touch stand; the tasks that build them are VB-346 to VB-356, released on 11 November when Kim had read and accepted the plan.

| Aspect | Design | Status |
| --- | --- | --- |
| What crops are for | Three things alike: risk and the labour calendar (crops fail in different years and want their work at different times), the goods chains (ale, linen), and the flavour of a region (villages on different ground, and with different starts, grow different things) | Decided, 11 Nov |
| Who chooses | The household's head plans what is sown, through the plan's three layers (Work: opportunities, plans and tasks); how well depends on its skill. Not a custom of the village | Decided, 11 Nov |
| Where skill acts | On choices and timing only: which crop on which field, the mix, when to sow. Never a multiplier on the yield, or a poor head is punished twice | Decided, 11 Nov |
| Knowing a crop | A household can sow what it has seed for; there is no knowledge kept apart from seed. A new crop arrives as seed | Decided, 11 Nov |
| Fallow | Rest only, at first: a fallow field restores its soil and is not grazed. Grazed fallow needs the village to keep step and is left for later | Decided, 11 Nov |
| Different starts | Villages start with different crops, by a preset a scenario: in founders, barley in both villages and one crop of its own in each, rye in one and peas in the other | Decided, 11 Nov (a mix, presets); Agreed, 11 Nov (rye and peas) |
| Order of building | A first batch of barley, winter rye, fallow and peas, as its own arch (`crops`) after slice 3; the fibre and ale crops with their chains in slice 6 | Agreed, 11 Nov |

#### The first crops (Agreed, 11 Nov; starting values to tune)

Barley is today's grain, unchanged. Days are game days, a day about a week; hours are a field's.

| | Barley | Winter rye | Peas | Fallow |
| --- | --- | --- | --- | --- |
| Sown | Spring days 1–10 | Autumn days 1–6 | Spring days 1–10 | Not sown |
| Ripe | 26 days after sowing: autumn days 3–12 | 42 days after sowing: summer days 7–12 of the next year | 18 days after sowing: summer day 7 to autumn day 4 | |
| Harvest and seed | 100 rations, 25 of seed (4:1) | 100, 25 of seed (4:1) | 60, 20 of seed (3:1) | None |
| Net of seed | 75 | 75 | 40 | 0 |
| Soil | −0.08 a crop | −0.08 a crop | +0.04 a crop, to at most 1.0 | +0.08 a year, to at most 1.0 |
| Hours | Hoeing 20, sowing 2, weeding 2 × 5, reaping 15, threshing 20: 67 | Tilling 20, sowing 2, weeding 5, reaping 15, threshing 20: 62 | Hoeing 20, sowing 2, weeding 2 × 5, pulling 10, threshing 10: 52 | One tilling in summer, 10 |
| Left in the field | Lost to the frost of autumn day 11 | Stands through the winter; lost if not reaped by autumn | Lost to the frost | |
| In store | Spoils as grain does | As grain | As grain (dried) | |
| In the pot | Grain | Grain, one source with barley | Pulses, a source of their own | |

- **Rye differs by its calendar, not its yield.** It is sown when the barley is coming in and reaped in summer, before it, so it moves work out of the harvest's weeks and into the autumn's first days and the haymaking; and a year that fails the barley need not fail the rye (the weather, to be written). Late medieval Scandinavian rye is put at about four grains for one sown on permanent fields, and far more on burnt-over ground (Climate of the Past 19, 2463, 2023, on Nordic rye, read only in a search summary: to be read in full); so it gets the 4:1 that Slicher van Bath (1963) gives grain, not the 5:1 first suggested (4:1 accepted by Kim, 11 Nov), and takes its bonus from fresh land (soil 1.4), as every crop does.
- **Rye needs a free field in early autumn,** which a field under barley is not: it follows fallow or peas. The three courses of one field are fallow, rye, barley.
- **Peas give less food and more besides:** they restore the soil a little, they are a second source in the pot (10% further), and they are reaped in time for rye. Their numbers have no source yet and are guesses to tune.
- **Rest and peas restore soil only to 1.0;** only manure raises it above, to its cap of 1.15. A field in three courses wears 0.08 in three years, not 0.24, so it wants a third of the manure.
- **What it does to a farm's food, before any tuning:** three fields in three courses at soil 1.0 net about 150 rations (75 + 75 + 0), as much as three barley fields worn to the floor net today (3 × 50), for two-thirds of the field hours. A farm fed by three well-dunged barley fields (about 218) is not fed by three courses on the same three fields: it needs a fourth, which is why a fallow field does not count against the fields a hand can till (Agreed, 11 Nov). The retune belongs to the wrap-up of the food balance (VB-048).
- **Oats** (wet, poor and high ground; a lower yield) come in a second batch. **Flax, hops, turnips and wheat** come with their chains (linen, ale, the garden, standing) in slice 6. None has numbers yet.

#### The rotation (Agreed, 11 Nov, but where a row says otherwise)

| Aspect | Design | Status |
| --- | --- | --- |
| A field's rotation | A field holds a rotation, a sequence of at most four courses, and the step it is at; when its crop is in, it moves to the next step. A course is a crop of the table or fallow | Agreed, 11 Nov |
| The rotations there are | A short list, as rules: every year (barley, barley: today's farming); two courses (barley, fallow); three courses (fallow, rye, barley); with peas, barley and peas by turns, and peas, rye, barley, where peas take the fallow's place | Agreed, 11 Nov |
| Seed bounds them | A household may hold only a rotation it has seed for, every crop of it. A village with barley alone has every year and two courses to choose from, so today's farming is what a run with barley only does | Proposed |
| A farm's fields are staggered | The fields of one farm stand at different steps of the same rotation, so each year has each course and the work and the risk are spread; a new field takes the step fewest of the farm's fields are at | Agreed, 11 Nov |
| Fallow and the hands | A fallow field does not count against the fields a household's hands can till (about 2 a working adult), so a farm in three courses holds half as many fields again | Agreed, 11 Nov |
| The culture's year | The template (Work: opportunities, plans and tasks, layer 1) names the village's usual rotation: what everyone there knows how to do. It is the rotation most of the village's farms hold, brought up to date at the autumn meeting and at no other time, and a new farm starts with it if it has the seed | Decided, 11 Nov (most farms; updated at the meeting) |
| How a crop spreads | A rotation enters a village's template only when most farms hold it, so a new crop is first one head's trial, then a few good heads', then the village's: slow at first, as customs are | Proposed |

#### How the head chooses what to sow (the head choosing, by skill, on choices and timing only: Decided, 11 Nov; the heads' thresholds and the trial as a project: Agreed, 11 Nov)

The choice is made on the head's planning day when a field falls free or a sowing window opens, among the rotations it has seed for and the fields it holds: never an optimiser (Work: opportunities, plans and tasks). The traits are that section's stand-ins until slice 7: wits, husbandry and years as head for foresight, diligence for the planning days, ambition for projects.

| Head | The rotation | The fields | Timing | A new crop |
| --- | --- | --- | --- | --- |
| Poor (the lowest fifth of foresight) | Keeps the one it took over, whatever the soil; in a hungry year sows the fallow field too, with whatever seed it has, and so wears the soil it meant to rest | As they come | Sows when its review reaches it, often late in the window: a field sown on spring day 10 ripens after the frost | Eats the seed, or leaves it in the store |
| Ordinary | Holds the village's usual rotation; reacts to what has happened: a field whose soil has fallen below 0.85 is rested or put under peas next, and after a failed crop it sows more of the other the year after | The worn field rests first | Sows as the window opens | Takes it up once the village's template has it |
| Good (the highest fifth) | Looks a year ahead: compares what each rotation it has seed for would give with the household's need and its hands, by its estimate, and changes rotation when another serves better | Fits course to field: the poorest soil rests, fresh land takes the rye; keeps two crops in the ground when it has the seed for both | Sows early, and once the weather is in, waits out a cold spell inside the window | Tries it on one field the year the seed comes |

- **An estimate, not the truth.** The head reads an estimate of need and of a rotation's yield, off by its bias, drawn once when it becomes head: one head always trusts barley too much, another sows too little rye.
- **Timing needs no new rule to matter.** Planning days already come daily to the diligent and every third day to the slack, and a late-sown field already ripens nearer the frost; the weather adds the cold spring and the wet harvest (to be written).
- **A trial is a project** (layer 3): a head with its targets met, seed to spare and ambition sows a crop new to it on one field. Flax and a hop yard join the menu in slice 6.
- **The player as head** sets a field's rotation, or sows one field out of turn for a year, through verbs of the plan (VB-253), under the checks that bind any holder: the seed, the window, a free field. The player chooses freely among the rotations there is seed for, not only the village's usual one: the other heads are held to a short choice only to keep their choosing cheap, not because the world forbids more (Decided, Kim, 11 Nov). With no choice made, the holder's rule runs.
- **What skill never does:** a good head's field of barley yields what a poor head's does, on the same soil, sown the same day and weeded as well.
- **Cost:** a choice a field a year, made on the holder's planning day; the village's usual rotation once a year at its meeting, over its farms. No new loop, and nothing daily.

#### Seed (Agreed, 11 Nov; the first row Decided)

Seed is not a good of its own: seed rye is rye. So every way grain already moves carries a crop with it, and no rule is needed for the spread of crops.

| Aspect | Design | Status |
| --- | --- | --- |
| Having seed is knowing the crop | A household can sow a crop when its store holds a field's seed of it (25 rations of barley or rye, 20 of peas) | Decided, 11 Nov |
| Grain in subtypes | The household's grain is held a crop: barley and rye are subtypes of grain, peas the first of pulses (Goods, recipes and facilities: goods in subtypes). The village's store holds them the same way. A ration of any of them feeds as a ration | Agreed, 11 Nov |
| The reserve | The plan reserves, of each crop, the seed for the fields its rotation sows with it next; a trial reserves one field's seed. What is not reserved is food | Agreed, 11 Nov |
| What is eaten first | The cook takes what spoils first, as now, and unreserved grain whatever its crop. A hungry household eats its seed as the last step (Seed, above): the crop it holds most seed of first, and the last field's seed of each crop last of all, so a household loses a crop only by real hunger | Agreed, 11 Nov |
| Losing a crop and getting it back | A household with less than a field's seed of a crop cannot sow it; its fields at that course lie fallow, and the head falls back on a rotation it has seed for. It has the crop again when a field's seed of it comes in | Agreed, 11 Nov |
| How a crop moves inside a village | By what moves grain already: help in hunger and gifts (most often eaten, sometimes kept by a good head), the heirs' shares, the village's store. A new household's start in life takes a field's seed of each crop its old home holds above its own reserve, and so do settlers' provisions | Agreed, 11 Nov |
| How a crop moves between villages | A marriage between villages (the start in life above; a dowry once slice 4 has it) and the fair: a field's seed is under one back load, and a head who wants a trial is the one who has a need for it. Later the ship, for crops the island has not got | Agreed, 11 Nov |
| Loans of seed | Seed corn after a failed year is slice 5's first loan; whether it is repaid in the crop lent is left to that slice | Open (slice 5) |
| Cost | A few numbers a household in place of one; nothing is walked that is not walked today | |

#### The scenarios' crops (a mix, by presets: Decided, 11 Nov; the presets as written: Agreed, 11 Nov)

Every village has barley. What else it has is its scenario's preset, so villages differ from the first day and have something to get from each other.

| Scenario | Crops | Status |
| --- | --- | --- |
| Founders | Its two villages are the village of three farms and the lone farm, a village of one. The three farms bring barley and rye, and start in three courses; the lone farm brings barley and peas, and starts with barley and peas by turns. Each household brings a year's food in barley, as now, and seed for the fields it wants, by its rotation. One farm of the village, the backup, also carries a field's seed of peas, held as reserved seed that it does not sow and eats only in hunger, so one bad year at the lone farm does not lose the island its peas (Kim, 11 Nov). Where the map has no room for the lone farm, the third farm of the village grows the peas | Agreed, 11 Nov (barley in both, rye in one, peas in the other); Decided, 11 Nov (a backup household) |
| Heirs and empty farms | Village A, the culture's centre, has barley and rye in three courses; village B, the remote one, barley and peas. The marriage between the villages in the parents' generation has not carried a crop across | Agreed, 11 Nov |
| Populous Villages | Drawn a village from its ground, by a seeded draw: rye where forest is most of the land within reach (fresh land to break), peas where meadow is, both in a large village of 12 farms or more, barley alone on heath and high ground. About a third of villages have barley alone | Agreed, 11 Nov (shares to tune) |

#### Crops and the weather (Agreed, 11 Nov, as starting values with no source, to be fitted to the weather branch's harvest factor when it lands)

One yearly weather factor cannot make crops differ. It is replaced by a season's weather, which each crop reads in its own way over its own months, so that crops fail in different years and a mix is worth having. The crops are built before the weather (slice 10), so the question a crop asks is fixed now, and what answers it changes later.

| Aspect | Design | Status |
| --- | --- | --- |
| What a crop asks | For a place and a season: its warmth and its wetness, each from −1 (cold, dry) to 1 (warm, wet) about the place's normal; and for a place and a year, two days: the thaw in spring, before which no ground is tilled or sown, and the first frost of autumn | Agreed, 11 Nov |
| What answers before the weather does | The weather is being built on a branch of its own (Kim, 11 Nov): its first batch (VB-342, on `main` since 11 Nov) gives each land tile its rain from the seed's wind, and its next is to bring fronts, temperature and the harvest's factor. If that lands first, it answers the question and nothing here is drawn. If the crops land first: a draw for the whole archipelago at the start of each season, from the `weather` stream, most seasons near the normal: 8 numbers a year, and the two days (the thaw on spring day 1 to 4, the frost on autumn day 8 to 12, most often 11, where it is fixed today). Nobody knows a season ahead: the spring's line "the year promises well" gives way to a line a season (fine to lose it for now: Kim, 11 Nov) | Agreed, 11 Nov; losing the forecast Decided, 11 Nov |
| What answers once the weather is in | The same question, a region, from the weather itself (Weather, seasons and daylight): the temperature curve and its spells, the rain fronts, the colder high ground and north. The weather keeps running sums a region, once a day; a field reads the difference between its sowing and its reaping. Crops do not change when it lands | Agreed, 11 Nov |
| How the yield reads it | Once, at reaping, as today: harvest = the crop's yield × soil × the crop's reading of its seasons × weeding × the field's small chance. No pass over fields is added | Agreed, 11 Nov |
| Warmth also moves the ripening | A cold summer ripens barley and peas up to 2 days later, a warm one a day earlier; so a cold year pushes the late-sown field into the frost, and sowing early is worth a good head's care | Agreed, 11 Nov |
| The frost | Kills what stands unreaped of the spring-sown crops, as today, but on a day that differs a year. Rye is past it: it is reaped in summer and its seedlings stand the winter | Agreed, 11 Nov |
| Wind | No part in the first version; a storm that flattens ripe grain waits for slice 10 | Agreed, 11 Nov |
| Hay | The meadows read the same seasons, in place of the same yearly factor | Agreed, 11 Nov |
| Cost | Before slice 10: 10 numbers drawn a year and two years of them kept in `st` (rye stands across two); a reading a field at its reaping. From slice 10: regions × days for the sums, the weather's own line of the budget, and the same reading | |

What each reads (the harvest is multiplied by each line that applies; w and r are the season's warmth and wetness):

| | Helped by | Hurt by | The year that fails it |
| --- | --- | --- | --- |
| Barley | A warm summer: + 0.10 × w | A dry summer: − 0.15 at the driest; a wet autumn, on the sheaves: − 0.15 at the wettest | A dry summer and a wet harvest; a cold summer, by the frost |
| Winter rye | Nothing; it is the steady crop of a dry year | A cold winter with little snow, the bare frost: − 0.30 when both are at their worst; a wet summer at its reaping: − 0.15 | A hard, snowless winter |
| Peas | A wet spring: + 0.05 × r | A dry summer: − 0.25 at the driest | A drought |
| Hay | A wet spring: + 0.15 × r | A wet summer, on the swathes: − 0.15 at the wettest | A dry spring and a wet haymaking |

- **The hedges this gives:** a dry summer is poor for barley and peas and leaves the rye whole; a wet summer is good to no crop but worst for rye and hay; a hard winter touches only the rye. Barley and hay, which every farm has today, fail in different years.
- **Barley alone stays about as it is:** its reading is tuned so that its mean and spread are today's factor's (0.75 to 1.2, about 0.975 on average), so a village with barley only is fed as now. The golden file changes all the same, and the tasks say so.
- **A head cannot see the season coming,** so foresight is not prediction: a good head's answer to the weather is the mix, the early sowing and the seed kept of two crops.
- **Not yet in:** the wetness of a place (a river bank, a marsh's edge; the weather's rain a tile, once merged, is its normal), high ground's short season, and oats, the crop for both.

#### What crops touch (11 November)

| System | What changes | Where it is settled |
| --- | --- | --- |
| The work calendar | Rye is sown in the harvest's first days and reaped at haymaking; fallow is tilled in summer; peas come in before the barley. The harvest stays the peak, but less sharply, and the autumn's start is more crowded | Threshing waiting for winter is not built by this arch: the wrap-up (VB-356) measures hours by season against VB-333's first, and proposes it only if the autumn needs it (Agreed, 11 Nov) |
| Sowing first (VB-023) | Holds within a season: a hoed field is sown before the next is hoed, whatever its crop | VB-350 |
| Soil and manure (VB-137) | Wear and mending become the crop's; rest and peas mend to 1.0, manure alone above. Manure's numbers stand | VB-348, VB-349 |
| Fresh land | Soil 1.4 serves every crop; a good head puts the rye there | VB-351 |
| Yield over time (VB-160) | Unchanged. Its survey weighs rotations as a cause of rising yields, and may then replace its rule by what this arch builds | VB-160 |
| Animals, fences and deer (VB-136, VB-139) | Rye stands green while the herds are on the stubble in autumn, so a broken fence costs more; fallow is not grazed; straw and oats as fodder wait for oats | Left to VB-136 and VB-139, which read the field's crop and stage; noted in the wrap-up |
| The pot | Barley and rye are one source, grain; peas are pulses, a second | VB-349 |
| The stores | Grain a crop, as goods in subtypes; the seed reserve a crop | VB-347 |
| Help, gifts, shares | Move grain in the proportion the giver holds it; they carry crops with them without a rule of their own | VB-347, VB-352 |
| The fair (slice 4) | A sack of rye is a good like another; a head who wants a trial has a need for seed. Villages with different crops have a first thing to trade | Slice 4's worth table gains the crops; no task here |
| Loans (slice 5) | Seed corn after a failed year is the first loan; whether it is repaid in the crop lent is that slice's | Open (slice 5) |
| Mill and loom (slice 6) | Flax, hops, turnips and wheat come with their chains; ale is brewed of barley by its rule as now | Slice 6's plan |
| The food balance (VB-048) | A farm in three courses needs a fourth field; the retune of yields and fields a farm reads rations by crop | The wrap-up VB-356 hands its numbers to VB-048 |
| The player (VB-253, VB-256) | Verbs for a field's rotation and for sowing out of turn; the plan panel lists fields and seed | VB-355 |
| The page | Each crop drawn at each stage; rye green in autumn | VB-355 |
| Saves and the golden file | New fields on fields, stores, villages and pawns, each with invariants. Barley-only runs stay as they are until the scenarios' crops (VB-353) and the weather (VB-354), which re-record it | Each task |
| Cost | A choice a field a year; a village a year at its meeting; a reading a field at its reaping. Nothing daily, nothing over pairs, nothing that grows with history | Named in each task; measured in VB-356 |

### Long work and processing

Farm work and building are slow and span several days; a game is about incremental progress, and a single run lasts 40–80 hours. (Decided)

| Aspect | Design | Status |
| --- | --- | --- |
| Multi-day jobs | A job keeps its progress when pawns stop to sleep, eat or answer something more urgent; they go home at night and carry on next day, or someone else allowed to take it does | Decided |
| Tilling | Several days of work per field, scaled to the internal time: about 20 work hours with a hoe | Decided, Agreed (hours) |
| Sowing | Quicker than tilling | Decided |
| Summer upkeep | Growing fields post a little work to keep them up; neglect lowers the yield. Weeding takes 2 work hours every 6 days per field; each round missed cuts the yield by 8%, at most 40% | Decided, Agreed (numbers) |
| Harvest | Work-intensive: reap the ripe crop, dry it, then thresh to get the grain out. Sheaves wait unthreshed in the barn; threshing takes about 6 work hours per field's crop | Decided, Agreed (hours) |
| Haymaking | Several days per meadow: mow, dry, carry to the hay barn | Agreed |
| Milling at home | Grain is ground into flour in the house with a hand quern (*handkvarn*); slow, about 1 work hour per 4 units of grain. Flour goes further than grain: a daily household job makes rations from flour at 1:1, or from grain at 1.25 grain per ration | Decided, Agreed (numbers) |
| Milling at a mill | Much faster; a water mill by a river, or a windmill, likely dearer to build; often owned by the village and built as a commons job | Decided |
| Windmill | The first mill is a windmill, until rivers for water mills are generated: a village of 3 or more farms builds one at the moving round on a free open tile within 6 steps of the green, hills preferred; 140 work hours with 10 loads of stone and 20 of timber; it grinds 5 times as fast as the quern; households of other villages within 10 steps pay a toll of 1 in 16; wind is ignored at first (backlog VB-093) | Agreed, 30 Oct |
| Miller and baker | In towns, milling becomes the miller's role, which supplies the baker | Decided |
| Building | Slow: clear the site and prepare the foundation; fancier, more prestigious houses also need lumber prepared and stone hewn and carted | Decided |
| Building jobs | Each key step is a job; a person or the village may prepare materials over a long time | Decided |
| Run length | 40–80 hours for one run, comparable to Europa Universalis IV and Crusader Kings III | Decided |

Water mills need rivers, which the world does not generate yet; what a more prestigious house brings its owner is not yet defined (both Open).

### Known gaps

- Grain still lacks outlets beyond feed and seed: storage losses, tithes or trade are needed. Balance review (Agreed, 2 Nov): grain in store spoils, 5% a year of the first year's need held, 20% of the second, 40% of the rest, and the village store 20% a year, so a good farm's store levels off at a year or two of need; tithes and trade stay open.
- Hunger now has consequences (backlog VB-028): it can kill, mostly infants and the old, slows work, and postpones marriages and births; who eats first when food is short is a custom (Decided). Starting values: a year of hunger about doubles deaths, mostly infants and the old; work slows by up to 40%; marriages wait while hunger is at half or more (Agreed). Health (see People) adds a starving pawn's death within a season.
- A grown family eats more than 3–4 fields give after seed; see Systems overview, Food balance (Proposed).
- Money only makes sense once towns and markets exist.

### Animals

Hay sets how many animals a household can winter, and the animals give milk, meat, wool, draught and manure; the first version has cattle, sheep and one wild grazer, and a hard winter limit. (Decided: species, wild grazers only, hard limit. Mechanics: Agreed)

The old Swedish saying *äng är åkers moder*, “the meadow is the mother of the field”, sums up the loop: meadow hay fed the animals through winter and their manure fed the fields. Myrdal's volume on medieval farming in *Det svenska jordbrukets historia* (1999) describes it, with the fenced infield of fields and meadows and the open outfield where animals grazed in summer.

#### Herds

| Herd | Made of | Gives | Needs | Status |
| --- | --- | --- | --- | --- |
| Cattle | Cows, a pair of oxen, young stock | Milk in summer (butter keeps for winter), calves in spring, meat at slaughter, manure, draught | Byre (*fähus*) space; about 1 hay unit per cow per stall day | Decided (species), Agreed (rest) |
| Sheep | Ewes, rams, lambs | Wool, lambs, meat, manure | About 0.2 hay units per head per stall day; graze heath and hills that cattle do poorly on | Decided (species), Agreed (rest) |
| Wild grazers | One species to start: roe deer, with elk perhaps later | Meat and hides when hunted | Forest edges and meadows; can damage crops | Decided (wild grazers only; roe deer, 30 Oct) |

- **Ownership:** each household owns its cattle herd and its sheep flock as two herds. A herd is the one unit that moves, grazes and posts jobs; its cattle are a short list of named animals (sex, birth, kind: calf, heifer, cow, bull, steer, ox), so calving, gelding, oxen and culling work and the log can name them, while sheep are counts (Agreed, 31 Oct; backlog VB-131).
- **The founders' herds:** not every farm keeps animals; at least one farm keeps a bull, since oxen are castrated, and at least one keeps a ram; a farm with sheep keeps 4 ewes (Decided, 30 Oct). Three of the four founders farms keep cattle (2 cows each, the first also a bull) and two keep sheep (4 ewes each, the first also a ram); one keeps neither. One pair of oxen in the group, at the bull's farm; the others hoe until they raise oxen from bull calves (Agreed, 30 Oct).
- **Food from animals:** a cow in milk gives 0.5 rations a day in summer, part of it kept as butter for winter (Agreed). Slaughter gives meat, a cow 15 rations' worth, an ox 18 and a sheep 3, which a household job salts into food that keeps; stored food spoils after a year (Decided, 30 Oct; meat values lowered from 40 and 8 after the review, so a living cow is worth more than her carcass, Agreed 31 Oct).
- **The byre** holds 6 cattle at first and is enlarged later by a building job (Agreed, 30 Oct).
- **Numbers** are starting values to tune.

#### The year

- **Spring:** turn the herds out around spring day 6, cart the winter's manure to the fields, till with the oxen.
- **Summer:** daily herding and milking; haymaking as the main work.
- **Autumn:** after harvest, the household decides how many animals to keep against its stored hay; the rest are slaughtered for salted meat.
- **Winter:** daily feeding and mucking out in the byre, from about autumn day 9 to spring day 6, 21 of 48 days.

#### Hay and the hard winter limit

- **Stored hay** is counted daily against the animals in the byre. (Decided)
- **When hay runs out,** the household slaughters in an emergency for lean meat; if nobody acts, animals die and give nothing. (Decided)
- **Hay comes from meadows** the household has made and claimed, and its share of common meadows (see Land and ecology). A meadow tile might yield about 30 hay units, enough for 1–1.5 cows over winter. A household rakes and mows only while its barn and the hay lying mown hold less than two winters' need of its animals; with no animals it mows nothing (balance review, Agreed 2 Nov). Hay in the barn spoils as grain does, by winters held: 5% a year of the hay up to one winter's need, 25% of the second winter's worth, 50% of the rest (Kim, 2 Nov; backlog VB-159).
- **The first winter** of a new settlement needs a hay stock brought along, or the founders' animals die in their first season.

#### Ties to existing systems

| System | What animals add | Status |
| --- | --- | --- |
| Land and ecology | Herd grazing and haymaking keep land open under the forest-spread rule | Agreed |
| Fields | Manure restores soil worn down by harvests; oxen speed up tilling | Agreed |
| Jobs | Summer work: haymaking, herding, milking; autumn slaughter; spring manure | Agreed |
| Fences | A broken stretch lets cattle or deer into the crops and costs yield | Agreed |
| Roles | Children from about 8 herd; milking ranks high for the mistress of the house and maids | Agreed |
| Customs | Candidates: grazing on the commons (limited per farm by land share, open to all, or set by the meeting); hunting rights; how hay from common meadows is shared | Proposed |
| Inheritance | Livestock is the main movable wealth: siblings' shares can be paid partly in animals, and a cow and a few ewes give a new household its start | Agreed |
| Buildings | A byre and hay barns join the building jobs; the byre's size caps the herd | Agreed |
| Commands | A herd is a non-person entity acting through commands: move, graze, come home | Agreed |

Limiting grazing per farm (“stinting”) was a common rule for village commons; Ostrom's *Governing the Commons* (1990) is the standard account of such rules, against Hardin's “tragedy of the commons” (1968). Vera's *Grazing Ecology and Forest History* (2000) argues that large grazers keep landscapes a mix of open land and forest.

#### First version (Agreed, 31 October 2026)

The review of 31 October (`docs/review-animals.md`) set starting values for the first version, to tune in backlog VB-048; its questions and answers are in `QUESTION_ARCHIVE.md`.

| Point | Starting value | Task |
| --- | --- | --- |
| Hay a stall day | Cow, bull, ox 1; heifer, steer 0.6; calf 0.4; ewe, ram 0.2; lamb 0.1; 21 stall days, autumn day 9 to spring day 5 | VB-131, VB-134 |
| Breeding | On spring day 3 a cow of 3 or more calves with chance 0.85 if a bull of 2 or more lives within 12 steps of her farm; a ewe lambs (0.3 chance of twins) with a ram within reach; 15% of calves and 20% of lambs die. Taking the cow to another farm's bull is remembered as a favour ("Lent us the bull") | VB-131 |
| Meadows | 30 hay a tile × site (meadow 1, marsh 0.8, heath 0.6; × 1.3 by a river or water) × weather; claimed and cleared (4 h + stones), within 6 steps; households with animals want 1.2 times their winter need | VB-132 |
| Haymaking | Rake 2 h in spring (unraked 80%); mow 16 h a tile from summer day 1 to autumn day 3 (men); dry a day; carry 4 h | VB-133 |
| The byre | A daily fodder job (women's work); the autumn count on autumn day 8 keeps what the hay × 1.1 and the byre's 6 cattle allow, the least valuable going first, oxen last; meat is salted within 3 days or spoils | VB-134 |
| Milk | 0.5 rations a cow in milk a day, half without a herder; 40% churned to butter | VB-135 |
| Herding | One herder from 8 years for a household's herds, 9 hours a day to a pasture within 8 steps; an unherded herd may get into a crop through a broken fence, and the field's holder blames the fence's keeper, as the provincial laws did | VB-136 |
| Soil | −0.08 a harvest to a floor of 0.75; a load of manure +0.04 to 1.15; 0.2 loads a head of cattle a stall day | VB-137 |
| Oxen | A team works one tilling hand at 2.5 times | VB-138 |

#### Cost

About 440 domestic herds and up to 100 wild ones at full scale; only a few dozen sprites are drawn near the camera. Counting grazing where herds graze makes it a few hundred updates a day (Agreed, 31 Oct). A profile of 31 October puts the work and economy systems at under a tenth of the simulation's time and the social layer at two thirds; the animals' budget is 10 ms a game day at populous medium (`docs/review-animals.md`, Performance).

#### Later

Predators, pigs, horses, poultry, disease, breeding and traits, summer farms (*fäbod*), and leaf fodder from pollarded trees, which would tie trees per tile to the hay economy.

### Goods, recipes and facilities (to be written: slices 4 and 6, VB-183 and VB-185)

| Aspect | Design | Status |
| --- | --- | --- |
| Goods in subtypes | Goods are typed with subtypes (granite and marble are both stone; cow's and sheep's milk), each with the quantum that changes hands (one head, one sack) and how it perishes | Decided, 3 Nov (subtypes, Kim's description); Proposed (the rest, target-v2, section 4.3) |
| Title and custody | Who owns a thing and where it is are apart: a cow in a neighbour's byre, grain at the mill, cargo aboard | Proposed (target-v2, section 2) |
| Recipes | Human transformation of goods; a recipe may bind the subtype it was given (any stone hewn into blocks of the same stone); building is a recipe whose output is a stage of a facility | Proposed (target-v2, section 4.3) |
| Facilities | Built things on sites, from houses and mills to roads and harbours, each with an owner, perhaps an operator, its capabilities and who may use it | Proposed (target-v2, section 4.3) |
| Textiles | Spinning as background work and weaving as partial work: the missing labour sink of the slack seasons; cloth keeps its worth | Proposed (target-v2, section 5.6) |

### The mill and the loom, the kiln and the quarry (slice 6, 11 November)

Slice 6's plan (backlog VB-185), on Kim's answers of 11 November. The slice is built in two halves: the mill and the loom first (the
quern and the mill, wool to cloth and dress, tools and iron, skills, occupations), taking from the ground only iron and the stone of
querns and millstones; then the kiln and the quarry (pots, peat, brick, tiles and lime, and the two better houses). The shape is
Decided; the numbers are Proposed, in the game's work hours (576 an adult a year), each task reporting its own and the wrap-up tuning them.

| Aspect | Design | Status |
| --- | --- | --- |
| Skills | A skill a craft and pawn from 0 to 1, learnt by doing, faster with aptitude: a novice works at 60% of the rate and a master at 130%; halfway in about 400 hours; a tenth lost a year unused. So "the smith" and "the weaver" come of hours worked, and a beginner is still of use (VB-360) | Decided, 11 Nov (moderate); Proposed (numbers) |
| Facilities | Built things on sites, kept in one registry: an owner, a kind, a condition, and building in stages, each stage a recipe of hours and loads and a step of the owner's plan. The bloomery, the kilns and the mill are the first; houses and barns move in when a slice needs it (VB-361) | Proposed (target-v2, 4.3, cut to the slice) |
| Wool to cloth | A fleece is spun into a skein of yarn as background work indoors, beside minding the house, mostly in winter (40 hours); two skeins are woven into a length of cloth on a loom the household builds (12 hours, partial work). Cloth keeps and is a good of the fair. Dress for a household of six takes about a third of one adult's year, nearly all of it spinning (VB-144, VB-362) | Decided, 11 Nov (spin, weave, wear); Proposed (numbers) |
| Dress | Each person wears a length of cloth out in about 3 years. In rags, winter's cold costs half as much health again and standing falls. Dyed and fine cloth wait for the ships (VB-363) | Decided, 11 Nov; Proposed (numbers) |
| Who spins | A practice, "Spinning and weaving are": women's work (default) or everyone's indoor work. It decides whose winter is idle, and villages may drift apart on it (VB-362) | Decided, 11 Nov |
| The quern | A hand quern makes grain go a quarter further. The stone is a good of place and wears out in about 20 years, so the need never ends: sandstone grinds at full speed, granite a fifth slower; a household without one eats its grain unground. The first households have one (VB-009) | Decided, 11 Nov (a good of place, and it wears); Proposed (numbers) |
| The mill | A village of 3 farms or more builds a water mill where it has a river in reach (100 hours), else a windmill (140 hours, as agreed on 30 Oct); it grinds 5 times as fast, and other villages pay a toll of 1 in 16. Both need a pair of sandstone millstones and iron fittings, so a village may have to trade before it can build (VB-093) | Decided, 11 Nov (water where possible, millstones and iron); Agreed, 30 Oct (hours, toll) |
| Tools | A household's tools wear with field work and are mended in winter; work goes at 70 to 100% by their condition. Iron lifts the ceiling: without it tools mend only to half (wooden spades and ards, work at 85%), with it to full. Iron is worth trading for, and nobody starves without it (VB-121) | Decided, 11 Nov; Proposed (numbers) |
| Iron | Two steps. A household with bog ore builds a bloomery, a small furnace, and smelts ore with wood into blooms (4 loads of ore and 6 of wood, 10 hours, a bloom); mending and making tools is winter craft work at home. A smithy comes when someone specialises; rock iron waits for mines (VB-364, on VB-359's digging) | Decided, 11 Nov (smelt, then forge); Proposed (numbers) |
| Occupations | A pawn is called by the craft that leads its hours of the last three years, with hysteresis; a view only, read by no rule (VB-365) | Proposed |
| Pots | Clay's first use: pots fired in a pit at home keep the store from damp and mice, halving the grain's yearly loss where they cover it; a quarter break a year (VB-366) | Decided, 11 Nov (pots, then brick); Proposed (numbers) |
| Peat | A household short of wood near a bog cuts peat in summer; dried, two loads burn as one of wood. It spares the forest near marsh villages (VB-367) | Decided, 11 Nov; Proposed (numbers) |
| Brick, tiles and lime | A brick kiln fires clay into brick and roof tiles; a lime kiln burns limestone to lime; both eat much wood (VB-368) | Decided, 11 Nov (brick after pots; lime for mortared walls); Proposed (numbers) |
| The houses | Four grades. The cottage on the bare ground; the cottage on a dry stone foundation (VB-332); the fine timber house, of hewn lumber on that foundation, not mortared, with a roof of slate or tiles and a brick hearth (VB-369); and the stone house, the most prestigious, its walls of stone or brick laid in lime mortar (VB-370). Each grade gives more standing through the well-kept house and wears more slowly; a village with no limestone must get its lime by exchange | Decided, 11 Nov (the four grades; no mortar under timber; mortar for stone); Proposed (numbers) |
| Left for the ships | Salt from springs, flint and amber; copper, tin, lead, silver and gold; marble and soapstone for the church (slice 8) | Decided, 11 Nov |
| Cost | Every craft is a job on its household's planning day; skills, dress, querns and the store's pots are values read in closed form, with no yearly pass; facilities are few and indexed by owner and tile. Each task names its line, and the wrap-up measures the slice on the late saves (VB-371) | Proposed |

### Goods of place and side crafts (slice 4, 10 November)

Villages must differ before they need each other: where neighbours make the same things, a market has little to move
(`docs/review-markets.md`, sections 2.2 and 5). So some goods can be made only where the land gives them, and households make them
beside their farming, for the fair. The first row and the principle of the second are Kim's (10 November); the rest is the approach
proposed with them, for slice 4's plan (VB-183) to confirm.

| Aspect | Design | Status |
| --- | --- | --- |
| Local differences | Villages differ in what their land lets them make, and this is what draws them to deal with each other | Decided, 10 Nov |
| More specialised work | There are more specialised jobs, so that villagers can turn to producing more than their sustenance | Decided, 10 Nov (the need); Agreed, 10 Nov (side crafts and the ladder below) |
| Goods of place | A good of place needs a resource within a village's reach: fish (sea shore, lake or river), tar and charcoal (pine forest), bog iron (marsh, smelted with charcoal), stone for querns and whetstones (stone ground). A village without the resource cannot make the good and must get it by exchange. The plain's own goods are those every farm has: grain, butter, cattle, wool | Agreed, 10 Nov |
| First goods | Slice 4 builds two, and ale beside them: dried fish, a food that keeps and counts as a source in the pot (Mixed meals), and tar, for boats and timber (What each good is for, below); they need a drying rack, a tar pit (*tjärdal*) and, for the sea, a fishing boat. Iron waits for tools that wear (VB-121), stone for the mill (slice 6), salt and cloth of quality for the ship (slice 8) | Agreed, 10 Nov |
| Side crafts | A household stays a farm and takes up a side craft in its slack hours (*bisyssla*; the many trades of the Nordic peasant), as a kind of long work with its own job kinds. It is the sink the idle hours lack beside textiles (target-v2, section 5.6), and it needs no new kind of household | Agreed, 10 Nov |
| Why make more than is needed | The surplus is a holder's project (Work, the third layer: one project by values): a household aims its side craft at something it lacks and can only get at the fair: the other villages' goods, an animal, a dowry. Nobody produces for sale in general; with no coin there is nothing general to sell for | Agreed, 10 Nov |
| Skill and tools | Hours at a craft raise the pawn's skill at it, and a craft's facility (a boat, a tar pit, later a smithy) is a lump one household builds and owns. Both make the household that began a craft better at it than its neighbours, so a village comes to have "the fisher" and "the tar burner" without any rule naming them (the derived roles of the vision) | Agreed, 10 Nov |
| The ladder | Three steps, each needing a wider market than the last: a side craft (the yearly fair is enough); a craft household, which holds less land than it needs and lives partly by exchange (a fair twice a year or a monthly market); a specialist with a plot and no fields (a weekly market: see Towns and regions). A household moves up or down by what its craft brought it over the last years, with hysteresis | Agreed, 10 Nov |
| A well-kept house | A well-maintained house gives its holder prestige, up to a cap: the first answer to what a better house brings its owner. The house has a condition from 0 to 1 that wears 0.1 a year; 4 work hours of upkeep raise it 0.1, offered once it is under 0.8. Prestige gains 0.15 times the condition (a holder's is 1.6), and a holder's spouse gains the same; so it is earned by work and lost by neglect. Tar makes this source easier: tarred, a barrel lasting 6 years, the house wears 0.067 a year and the term is 0.18 times the condition. The cap is the ceiling that tunes it (target-v2, section 6.2) | Decided, 10 Nov (prestige, the cap, tar's two effects); Agreed, 10 Nov (numbers) |
| The fishing boat | The game had no boats, and tar needs one to be needed. A household by the sea or a lake of 20 tiles or more may build a fishing boat, a facility kept on a shore tile, as long work of 20 hours from timber. A trip in it brings 8 rations where the bank gives 4. It needs a barrel of tar every second year: untarred for two years it fishes at half, after four it is lost. Nobody travels in it; travel by water is slice 10's | Agreed, 10 Nov |
| Ale and standing | Ale is brewed as a side craft from grain above the household's floor and reserve: 10 rations of grain and 4 hours give a barrel, which keeps one season and serves 20 guests. A guest's opinion of the host gains 0.05, fading over 3 years; the host's prestige gains 0.05 a barrel poured in the last 3 years, at most 0.2. At the gathering the gain is shared among the host village's holders by what each poured | Agreed, 10 Nov |
| Quanta and worth | Customary worth in rations, one table for every culture until norms learn from deals (slice 8): grain, a sack of 10 rations, 10; salt meat, butter and dried fish, a lot of 10 rations, 15 (they keep, and add a source to the pot); a barrel of tar 8; a barrel of ale 14; a cow 40, an ox 50, a heifer or steer 20, a sheep 6. Heirs' shares paid in animals use the same table (VB-140). Wool and cheese are not goods yet and wait for slice 6 | Agreed, 10 Nov |
| Cost | A side craft is ordinary jobs on a household's planning day; goods of place add one reach test per village and resource, refreshed when its land changes | Proposed |

**In the ground (11 November, VB-357).** The world holds the resources these goods of place need (World and scale, Ground): bog iron
lies where it is drawn, not in every marsh, and "stone ground" is the bedrock, so a village's stone has a kind. Kim's answers of 11
November (Decided; the numbers are each slice's plan's to set):
- Known and found. Bedrock, clay, peat and bog iron are known to all: they show at the surface. The upland ores (iron, copper, lead and
  silver, tin, gold) are found: a vein is unknown until a pawn has worked or herded near it for a season, or prospects for it, and the
  views show only what is known. Built (VB-358): knowledge is the village's; a finished job within 2 tiles of a vein finds it with chance
  work hours / 60; a played pawn sees what its village knows, a watcher everything, the unfound faint. Prospecting as work of its own waits
  for the first good that needs ore.
- Bog iron grows back, slowly, up to what the tile began with: the peasant's lasting source, where rock iron is the rich and finite one.
- Quarried stone (VB-332) is of the tile's bedrock. A foundation takes any kind; later uses want the right one. Picked field stone is granite.
- What each is for: clay, limestone and sandstone with slice 6 (pots, daub and brick; lime burnt for mortar; querns, whetstones and
  grindstones); bog and rock iron with tools that wear (VB-121), rock iron from a mine; slate, marble and soapstone for standing (roof,
  church, carving); copper, tin, lead, silver and gold with slice 8 (coin, bells and vessels). Peat, flint, amber and salt springs
  are laid and have no use yet (Proposed: peat as fuel where wood is short, flint for fire, amber for standing and the ships, a spring
  for salt where the ships do not reach).
- Amounts and the share of endless sources stay placeholders until the first good that digs names a year's use: then a village's vein
  should last about three generations, and an endless source be worth a town.

**What each good is for.** A good has worth only through a need of pawns or households, or through standing (Kim, 10 November: Decided);
no good is wanted because a table says so. The goods of place, and the goods beside them that the gathering gives a use, with what
grounds each and when it could come. Dried fish, tar and ale are Agreed for slice 4 (10 November); the rest is Proposed.

| Good | Made where | What it is for | When |
| --- | --- | --- | --- |
| Dried fish | Sea shore, lake or river | Need: food that keeps through winter and spring, and a second source in the pot (Mixed meals) | Slice 4, on fishing (VB-117) |
| Tar | Pine forest | Need: a fishing boat must be tarred or it leaks and is lost, so the fishers need the forest; tarred timber decays more slowly. Standing: through the well-kept house (below) | Slice 4 |
| Ale | Any village with grain to spare | Standing: what a host pours, at the gathering, a wedding or a funeral ale, is what its guests remember; a use for surplus grain other than letting it rot | Slice 4 |
| Furs and hides | Forest and wilderness with game | Need: winter dress and footwear. Standing: dress | With roe deer (VB-139) |
| Honey and wax | Broadleaf wood and meadow | Standing: mead at a feast; later wax for the Church | Slice 6 or 8 |
| Lumber and hewn stone | Pine forest; stone ground | Standing: the fancier houses of Long work need both, and a village without them must get them | Slice 6 |
| Querns and whetstones | Stone ground | Need: flour goes further than grain (Milling at home); edged tools | Slice 6 |
| Bog iron | Marsh, with charcoal from pine | Need: tools that wear and are mended (VB-121), so faster work | With VB-121 |
| Salt | Ships | Need: keeping meat, fish and butter | Slice 8 |
| Cloth | Every farm with sheep; fine cloth from ships | Need: dress. Standing: dyed and fine cloth. It keeps its worth | Slice 6; fine cloth slice 8 |


## 9. Exchange, goodwill and obligations

Help in hunger is the first exchange, a gift (The gift, below, from slice 1's plan, backlog VB-182; see also Goods and the farming
year). The fair, below, is barter between villages, begun on 10 November for slice 4's plan (VB-183); loans, obligations and cases, below, are
slice 5's (VB-184, 11 November).

| Aspect | Design | Status |
| --- | --- | --- |
| Goodwill | An opinion that is also a currency, in discrete units (helped build a house, gave a cow): its own measure on the relation between two pawns, tightly coupled to opinion by culture. It makes parties accept unfavourable terms, short of starving themselves; an unfavourable deal changes it in turn | Decided, 3 Nov |
| Value and acceptance | Customary worth decides what a deal was worth, possibly influenced by need; need decides whether it is accepted | Decided, 3 Nov |
| Booking | A deal's residual is booked between the two acting pawns only; a household's allowance in a deal is likewise its agent's, toward the other agent | Decided, 3 Nov |
| Goodwill at retirement | A share of the holder's goodwill passes to the new holder, set by custom (half for now, in every culture, until a custom of inheritance takes it up; The gift, Who books) | Decided, 3 Nov; half, 12 Nov |
| The floor | No pawn accepts a deal that takes its household below its floor (seed and some days of food); the player's pawn may, with a warning that names who goes hungry | Decided, 3 Nov |
| Lumps | Goods change hands in whole quanta, so most deals leave a residual that goodwill absorbs; silver, divisible by weight, shrinks it | Proposed (target-v2, section 5.2) |
| Obligations | Every explicit claim (deal, loan, share, rent, tithe, tax, toll, wage, dowry, fine, service) names a debtor, a creditor, what is owed, when, and who enforces it; the heirs' shares are the first | Proposed (target-v2, section 4.4) |
| Money | Until coin, the economy is barter: goods for goods, with goodwill as the change (Decided, 10 Nov). Silver arrives from outside first, as payment by weight; minting comes later, by an established institution. Taxes drive the adoption of money (Decided, 10 Nov): the Crown first takes its tax in named goods, then asks for it in silver, and a household that owes silver must sell for silver, so coin spreads from those who have it (ships' merchants, the landed) to every farm that is taxed. Slice 8 designs it (VB-188) | Decided, 3 Nov; barter and taxes, 10 Nov |

### The gift (slice 1, 8 November)

| Aspect | Design | Status |
| --- | --- | --- |
| Lumps and occasions | Goods change hands in whole quanta, at notable moments (a lean spell, the fair), not in daily top-ups, so that each record (an event, a ledger entry, a goodwill balance) marks something worth remembering. Help in hunger is the first occasion, once a season; whole quanta arrive with goods and the worth table (slice 4) | Decided, 8 Nov |
| Goodwill is one decaying number | Between two pawns, one signed balance that decays toward zero in proportion to its size; the dealings themselves are remembered by stories (slice 7), not by goodwill | Decided, 8 Nov |
| The gift | Exchange's first mechanism: one party gives goods and asks nothing back. Help in hunger is a gift: the hungry household asks, and the kin household's holder gives. The goods move through the stores; the gift's customary worth is booked as goodwill to the giver's credit | Agreed (help), 30 Oct; Proposed (as Exchange's mechanism, VB-182) |
| Acceptance | A gift goes ahead when it leaves the giver's household at or above its floor and is no larger than the giver's allowance toward the receiver. Whom help asks, and for how much, stays help's rule | Proposed (VB-182) |
| The floor | The seed reserve and 20 days of the household's need | Agreed, 8 Nov |
| Allowance | How much one agent would give up to another in one deal, in rations, never below 0: the giving household's grain above its floor; less the holder's own reserve beyond the floor, 0 to 40 days of the household's need, drawn per pawn (a stand-in for generosity until traits, slice 7); plus goodwill's term, what the giver owes the receiver less what the receiver owes beyond 30 days of its household's need, which slice 4 switches on. No kinship term until help reaches beyond kin; no custom term until a custom of helping exists. With goodwill's term off, a kin household gives what it gives today. Opinion feeds allowance beside goodwill (Kim, 9 Nov, target-v2's decision 30): with slice 4, a term of the giver's opinion of the receiver (−1 to 1) times 10 rations, one sack, so never more than a sack either way (VB-220) | Agreed, 8 Nov; opinion's term Agreed, 10 Nov |
| Unit and decay | Customary rations; grain is worth 1 a ration until worth becomes a norm (slice 4). A balance is read from its value and when it last changed, so it decays with no step of its own: it halves in 4 years (tunable from 2 to 20). One under a ration counts as forgotten, and is dropped when either pawn next deals, reaches its cap, or dies. A pawn has at most 32 counterparts; the smallest balance goes to make room | Agreed, 8 Nov; one number decaying when read (Kim), 8 Nov |
| Goodwill and opinion | The debtor is grateful: +0.15 × s / (s + 20) for a balance of s rations, fading as the balance decays; it adds to the derived opinion (kin standing, affinity and memories: Traits, talk and stories, Opinion) as one more term. How long a debt has stood, and an old debt souring the creditor, are for stories (slice 7), since a balance keeps no age. One set of values for every culture for now. Slice 4 switches this on with allowance's goodwill term; until then goodwill is booked and shown only. It replaces the memory "A gift of food" proposed for VB-039 | Agreed, 8 Nov; by size only (Kim: one number), 8 Nov; adds to the derived opinion (Kim), 10 Nov |
| Who books | The two holders. The village store's gifts and its yearly filling book nothing until the village has an agent; a household without a holder books nothing. At a handover (a retirement, or a holder's death), half of the old holder's balances pass to the new holder, and a retired holder keeps the rest. A balance with the heir himself is halved: the half that would pass has nowhere to go. Other deaths end a pawn's balances until a person's estate is designed (slice 5) | Agreed, 8 Nov |
| What the player sees | The pawn panel lists up to 5 balances by size ("Owes Erik Larsson 34 rations", "Is owed 12 rations by Anna Persdotter"). On a holder's panel, each row adds how much it would give that pawn, with the parts of its allowance on hover | Agreed, 8 Nov; no reason or year (one number), 8 Nov |
| The player's gift | The player's pawn gives by the same command as any holder, to any household. Its pawn's allowance does not bind it, since the player decides for its pawn; it may give below its floor, with a warning that names who goes hungry (Decided, 3 Nov). The page's side follows slice 2 | Decided (the floor), 3 Nov; Agreed (rest), 8 Nov |

### The fair: barter between villages (10 November)

From the markets review (`docs/review-markets.md`) and Kim's answers of 10 November. Inside a village goods move as they do now, by
help and goodwill; the fair is where households of different villages, who owe each other nothing, exchange. It is not a thing of its
own: it is held at the gathering of villages (Settlements, The gathering), which is why people are there. Slice 4's plan (VB-183) adds
quanta, the worth table and need curves. Grain loans, once part of this slice, move to slice 5 with debt (Kim, 10 Nov; VB-184).

| Aspect | Design | Status |
| --- | --- | --- |
| A barter economy | Goods are exchanged for goods, in whole quanta; need decides whether a party accepts, customary worth says what the deal was worth, and the residual is booked as goodwill between the two who dealt (Value and acceptance, Booking and Lumps, above). There is no coin and no price list until money arrives (Money, above) | Decided, 10 Nov |
| The fair follows the gathering | A gathering has the fair its attendance bears: a few households swapping at a small gathering, rows of loads and animals at a large one. The fair has no site, date or reach of its own | Decided, 10 Nov (the principle); Proposed (the rest) |
| Deals between strangers | Two pawns who have not dealt before have no goodwill, so their allowance toward each other is near zero: a deal passes only when both gain by need, and many fail because the lumps do not fit. Deals that failed for want of change are counted, as the measure of how much the island wants money. One pawn deals for its household (its holder or spokesman); a back load is 30 rations' worth of weight (3 sacks or lots, or 2 barrels), a cart with two oxen 90, and an animal walks | Agreed, 10 Nov (target-v2, section 5.2) |
| Trade partners | A deal leaves a small balance, and a balance is a reason to deal again: on each of the fair's 3 days a dealing pawn proposes to every pawn present it holds a balance with, then to 4 others, in seeded order. Over the years two holders of different villages become partners, and that tie is what later carries a lodging (The gathering, Lodging), a loan or a match between their children | Agreed, 10 Nov |
| Keeping goods | To get round the double coincidence of wants, the goods that keep and that every household can use (butter, salt meat, dried fish, tar, a sheep; cloth once it exists) are accepted beyond the taker's own need, at their customary worth, up to 30 rations' worth held at once (one back load), to be passed on in a later deal. They are goods and nothing more; the one accepted most widely is the island's nearest thing to money before silver | Agreed, 10 Nov |
| What may be exchanged for what | Goods fall into three classes: food; animals, cloth and labour; land. The second holds only animals for now: cloth comes with slice 6, and a day's work given later is a promise, which moves with the loans to slice 5. Everything keeps a worth in rations, the one unit of account, and custom says which exchanges across classes are proper: within a class a swap is ordinary; grain for a cow in a good year is admired; a cow taken for grain in a dearth is allowed, and remembered as a hard bargain (target-v2, section 5.4); land is not offered at a fair at all, until slice 5's custom "Debts are paid with" allows it | Decided, 10 Nov (classes); Agreed, 10 Nov (the rules; no labour days yet) |
| Need | What a good is worth to the household taking it, against its customary worth. Food: 1 a ration when its stores reach the next harvest with its reserve, rising in a line to 3 at empty stores and falling to 0.5 for food beyond two years' need; a food the pot lacks counts 1.2 times, up to a fifth of the household's need. An animal: 1.5 times its worth to a household with none of its kind, 1 otherwise, 0 if its hay will not carry it through the winter. Tar: its worth when a boat or the house is due, else only as a keeping good. Ale: its worth to a household with an occasion ahead (a wedding, a funeral ale, hosting), half otherwise | Agreed, 10 Nov |
| A small fair is the right result | Households that feed themselves and owe nothing bring only their margin. The fair grows when villages differ (Goods of place), when households owe (slice 5) and when they are taxed (slice 8); it is not tuned to move much grain before then | Agreed, 10 Nov |
| Cost | At most 60 dealing pawns a gathering times about 12 proposals a day for 3 days: about 2,000 a gathering and 12,000 a year on medium, spread over the hours of the fair's days so that no 6-minute step carries more than a few hundred. The work grows with those at the fair, not with their pairs | Agreed, 10 Nov |

### Loans, obligations and cases (slice 5, 11 November)

Proposed by slice 5's plan (backlog VB-184, 11 November 2026): the alderman's road of target-v2 (section 5.5, trace 7.1), with grain
loans moved here from slice 4 (Kim, 10 Nov). A lean year lends grain; two unpaid harvests make a case at the meeting; the remedy
is labour, or a field that passes to the creditor while its old family farms it as tenants (Land and rights). Its answers
stand as Agreed (Kim, 12 Nov; `QUESTION_ARCHIVE.md`, VB-184).

| Aspect | Design | Status |
| --- | --- | --- |
| Obligations | One record for every explicit claim (Obligations, above): a debtor, a creditor (bodies: households or villages), what is owed (goods in whole quanta, or work hours), when it falls due, and the enforcer (the debtor's village). Slice 5's kinds: the heirs' shares (today's, moved in unchanged), loans, rent, labour owed and wages. Each open one is in a due-queue by its due hour; a step touches only what is due (rule 4), and a met, forgiven or lapsed one leaves the live index and is told once in the record (rule 1) | Proposed (target-v2, section 4.4), 11 Nov |
| Grain loans | When help in hunger has gone round and a household is still short (The gift; help's rule, kin first), its holder asks to borrow: from households of its own village, the most grain to spare first, then from its trade partners met at the gathering. A lender spares what it holds above its floor and its own need to the next harvest, and lends at most what the borrower lacks to reach that harvest with its floor, in whole sacks; it does not lend to a household whose holder it holds in enmity (opinion below −0.3), nor to one that holds no field and has a loan unpaid. A loan is one command that changes everything or nothing (target-v2, 4.1); the grain moves through the stores, and nothing is booked as goodwill, since the debt is explicit | Proposed, 11 Nov (Kim, 10 Nov: grain loans are slice 5's) |
| Interest and due | The practice "Loans of grain are repaid": with a quarter more (default) or as lent. Due when the borrower's next harvest is in (the end of autumn, after threshing); paid then from grain above its floor, in part if it must | Proposed, 11 Nov |
| Overdue and default | A loan unpaid at its due is overdue, and falls due again at the next harvest; unpaid after the second, it is defaulted, and its creditor may press (target-v2, trace 7.1: two harvests unpaid) | Proposed, 11 Nov |
| Pressing | On its planning day after a default, the creditor's holder presses, extends a year, or forgives: it presses more the larger the debt against its own year's need and the higher its ambition (a stand-in trait until slice 7), less the higher its opinion of the debtor's holder; forgiving books the debt's worth as goodwill to its credit (The gift). The player as holder chooses, by the same verbs | Proposed, 11 Nov |
| Cases at the meeting | A pressed debt is a case on the agenda of the debtor's village's next meeting (autumn day 10), heard in that village's own step. The procedure is the practice "Who judges a case": the meeting's voices (default; weighted as customs are, under "Who speaks at the meeting") or the alderman alone. Under the practice "One's own cause", the parties' households stand aside (default) or vote. Each voice upholds or not by its opinion of the creditor's holder against the debtor's, its own position (a household that owes leans to the debtor) and its leaning on "Debts are paid with"; a tie goes to the alderman's voice, and with no alderman the case is extended. Upheld: the remedy is carried out; not upheld: the debt is extended a year, and the creditor remembers it. A decision keeps its ballots and margin (target-v2, 4.5) | Proposed, 11 Nov |
| Remedies: "Debts are paid with" | A new practice: labour; labour, then land (default); land. **Labour:** the debtor household's adults owe days of work to the creditor, a day (8 work hours) for each 3 rations owed (the worth table's day's work), within a year, as tasks of the creditor's plan taken on the basis `debtor`; each hour is booked against the debt. **Land:** a field passes (Land and rights, Foreclosure) when the debt left is at least half a field's worth (60 rations, `SHARES.perField` / 2); the field's worth above the debt is booked as goodwill to the debtor's holder. Under "labour, then land", land is taken only for labour owed and not given within its year, at the next meeting. Nothing else is taken: no animals, no person | Proposed, 11 Nov |
| Partial failure | No land left to take, or a debt under half a field: what remains stands as labour owed; a debtor dissolved: its successor owes (Households and other bodies, A dissolved debtor); a creditor dissolved: its successor is owed | Proposed, 11 Nov |
| Debtors' politics | Self-interest pulls attitudes by a household's position (How attitudes move): one that owes leans to "labour" and "as lent", one that is owed to "land" and "a quarter more". It is the loop that opposes land concentration (target-v2, section 6.1), slower than it: land moves in years, practice in decades, so land concentration is tuned by its ceiling (the share of a debtor's fields a case may take, one a hearing) and not by this opposer (target-v2, 6.2) | Proposed, 11 Nov |
| Hired hands | The basis `hired` (Work, Who may take a task): at sowing, haymaking and harvest, a holder whose task has waited 2 hours for hands hires a landless adult of its village with no task of its own for the rest of the day, at 3 rations a day, a wage paid at the day's end from its stores; a landed household hires first, and a household below its floor does not hire | Proposed, 11 Nov |
| What the player sees | The village log tells each loan, default and case in one line ("At the Ås meeting: Olof Persson's case against Bengt Eriksson was upheld; a field passes to Olof's household, and Bengt's household farms it as tenants"); the meeting log shows a case's ballots as a custom's (VB-082); the household panel lists its debts owed and held, its tenancies let and held, and its class; the Land overlay shows tenancies. The player as holder borrows, lends, presses, extends, forgives and lets land by the same verbs as any holder | Proposed, 11 Nov |
| Cost | At `medium-ref` (211 households, 1,005 living): a few hundred open obligations at most, in the due-queue; loans asked once a season by a short household, each looking over its village's households (at most about 30); cases a few a village a year, each heard over at most 60 voices in the village's own meeting step; the class yearly per household, a village a step; two new bases of eligibility read from a compiled index (labour owed per pawn, the day's hired), so a task's check stays one lookup. Five new practices add a quarter to each pawn's attitudes (14 customs with 44 options to 19 with 55). Claimed: 4 ms a game day, a year's mean, and no 6-minute step over 60 ms (`docs/roadmap.md`, 5.2) | Proposed, 11 Nov |

## 10. Customs and culture

One culture holds a single set of customs with a default when generated; members' attitudes drift every game day, villages change their practice only at a yearly meeting, and remote villages can drift off into new cultures. (Decided)

Customs are grounded in history, and a custom's default leans to gameplay where the two part. New customs may be added freely for now; Kim will later review them for a smaller set with the same effects. (Decided, 12 Nov)

&#91;embedded content: customs cycle · daily drift, yearly round\]

Daily contact moves attitudes; only the yearly round turns them into practice, customs and splits, and its moves, like marriages from courting, change who meets whom.

### Two layers

- **Attitudes, per pawn:** a preference over each custom's options, updated every game day (about weekly). Decided.
- **Custom in force, per settlement:** a village applies the culture's custom unless its own practice differs. Practice changes only at the yearly village meeting (*bystämma*) after harvest. Decided.
- **The culture's customs** change only at the yearly reckoning after all meetings. Decided.
- **Every system reads customs** rather than hard-coded rules: succession, marriage, claims, who may speak. Agreed.

### Custom dimensions

Gender eligibility, number of heirs, timing of succession and claims on empty farms are customs (Decided). The full set, default “Old Nordic” positions and malleability (1 = easiest to change) are Agreed. Candidates from the animal design (grazing on the commons, hunting rights, sharing hay from common meadows) are Proposed and not yet in the table.

| Custom | Options | Default | Malleability |
| --- | --- | --- | --- |
| Claims on empty farms | Kin of the old family first (*bördsrätt*); villagers first; anyone; the meeting assigns | Kin first | 1.0 |
| Cleared land belongs to | The village allots it; whoever worked most; whoever it was cleared for | The village | 0.9 |
| When the heir takes over | At the holder's death; when the heir marries, parents retiring on the farm; when the holder turns 60 | When the heir marries | 0.8 |
| A daughter's share | Equal to a son's; half a son's (*systerlott*) | Half | 0.65 |
| How many heirs | One heir takes all; one heir buys out the rest; land split between heirs | Buys out the rest | 0.55 |
| The widow | Keeps the farm for life; keeps a right to her keep; inherits outright | For life | 0.45 |
| Who can inherit | Sons only; sons first; any child; daughters first | Sons first | 0.35 |
| Who speaks at the meeting | Landholders; all household heads; all adults | Landholders | 0.3 |
| Which child inherits | The eldest; the youngest; chosen by the parent | The eldest | 0.25 |
| Where a married couple lives | With whoever holds land; at the husband's home; at the wife's home | With the land | 0.2 |
| Closest kin who may marry | Third cousins or further; second cousins or further; first cousins or further; uncle–niece or further (civil degree 8, 6, 4 or 3 and up; siblings never) | Second cousins or further | 0.12 |
| Heir to their own parents' farm | Steps behind other relatives, so farms are not combined; keeps their place, so farms may be combined | Steps behind (Agreed) | 0.6 (Agreed) |
| Who eats first when food is short | Equal shares; children first; those who work first | Equal shares (Agreed) | 0.5 (Agreed) |
| Children born outside marriage | Inherit like other children; inherit after children born in marriage; do not inherit | After children born in marriage (Agreed) | 0.5 (Agreed) |
| Disputed claims | The first claim stands; the strongest claim stands (the one most recently worked or renewed); kin of the tile's last owner first; the meeting decides by voice-weighted support | The first claim stands (Agreed) | 0.7 (Agreed) |

### How attitudes move (Agreed)

- **Anchored social influence:** a pull towards the weighted average of one's contacts, anchored to what was learned young (Friedkin and Johnsen 1990).
- **Contacts:** weighted by time together at work, in the household and at the well or green, plus kin; ties fade with a half-life of about a year.
- **Prestige:** landholders and elders weigh more (Boyd and Richerson 1985; Henrich and Gil-White 2001); traits later.
- **Self-interest:** a pull towards options that would help one's position, such as a landless daughter towards equal shares, or parents of young children towards feeding children first when food is short.
- **Scarcity:** when adults cannot find a spouse the marriage limit allows, attitudes shift towards letting closer kin marry; siblings never. When allowed spouses are plentiful, attitudes drift slowly back towards a stricter limit (Decided).
- **Upbringing:** children start from their parents and the village norm (Cavalli-Sforza and Feldman 1981).
- **Norm entrepreneurs:** now and then an adult takes up a cause for 5–15 years, usually one already in the air locally. Added in calibration.
- **Persuasion:** advocates pull directly on their contacts, in proportion to their share of each contact's ties. Added in calibration.
- **Advocacy input:** one slot used by entrepreneurs, events and influential pawns, and by any later player role.
- **Legible customs:** each change in the meeting log shows the support for the old and new option and the margin needed, and customs within 5% of changing are noted; the pawn panel shows where a pawn leans and the cause it argues for; a cause taken up and a change of practice are announced (backlog VB-082; Agreed, 30 Oct).

### Meetings, culture and splits

- **Village meeting:** practice moves from one option to another only if voice-weighted support beats it by a margin, about 25%. The margin grows with the village's tie to the centre and below 10 voices; returning to the culture's custom is easier. Agreed.
- **A village's meeting** (Decided, 10 Nov; Kim, code review). Every village meets on autumn day 10, as today, each in its own six-minute step from noon, in the order of village id, and a lone farm meets as a village of one. In its step: the interests of its people, its tie to the centre, the causes its adults take up, and its meeting. The culture's reckoning follows once all its villages have met, and then the land meeting, which settles outland between villages (backlog VB-278; the turn of the first village by the year, VB-280, waits for Kim).
- **Culture reckoning:** support across settlements, weighted by size, tie and centrality. The margin grows with roughly the square root of the culture's size, with extra inertia below 40 people. Agreed.
- **Tie to the centre:** travel distance, with sea crossings costing more, plus living kin across the gap. Distant villages drift more easily. Decided (principle), Agreed (measure).
- **Fission:** automatic when a weakly tied settlement stays far from the culture's customs for 3 years; hard customs count most. The same split function can be called by events later. Decided.
- **Cities:** will count more at the reckoning and change faster, through more contacts and newcomers. Decided (principle).
- **The gathering:** like-minded villages near each other meet once a year, and meeting draws their customs together (Settlements, The gathering). Decided, 10 Nov (the purpose); how it joins the reckoning and the tie to the centre is Proposed there.

### Pace

All customs change on the scale of generations; concentrated effort can do it within one; villages are stable and larger cultures slower (Decided). Current calibration, one generation taken as 30 years:

| Test | Easiest custom | Middle | Hardest |
| --- | --- | --- | --- |
| Natural drift, 300 people | About 3 generations | 4.6–5.7 generations | None within 200 years |
| A coalition with 20% of the voice | 1.1 generations | 1.4–1.7 generations | 2.1 generations |

A village with a 10% tie forms local practice after about 1.5 generations, against 2.1 for a 60% tie. Cultures of 100, 300 and 1,000 people first change in about 2.2, 2.8 and over 6.7 generations.

### Practice, norm and doctrine (to be written with slices 4, 5 and 8; slice 5's practices Proposed, 11 November)

| Aspect | Design | Status |
| --- | --- | --- |
| Kinds of custom | Practice (a shared rule with options: today's customs), norm (a usual quantity learned from what people do, such as what a cow is worth), doctrine (an institution's rule on the keys it claims), and each culture's distribution of personal values | Proposed (target-v2, section 4.4) |
| Who holds values | Individuals, institutions (the Church) and social bodies (a village, a city, a court) | Decided, 3 Nov (Kim's description) |
| Doctrine against practice | A resolver tips practice to doctrine at some point; while a key is contested, attitudes change fast, and a splinter faction of the Church may form | Decided, 3 Nov |
| New customs | About ten new practices and four norms arrive with the slices that need them, each read through one door | Proposed (target-v2, section 4.4) |
| Slice 5's practices | Five, in the table below, read through the customs in force like today's 14; each joins the meeting's votes, the drift of attitudes and the culture's reckoning as they are, and each pulls on self-interest as Debtors' politics says (Exchange, Loans, obligations and cases). Usury as a doctrine waits for an established Church (slice 8), which may claim the key "Loans of grain are repaid" | Proposed, 11 Nov (VB-184) |

Slice 5's practices (Proposed, 11 November 2026; VB-184), with default and malleability as the custom dimensions give them:

| Practice | Options | Default | Malleability |
| --- | --- | --- | --- |
| Debts are paid with | Labour; labour, then land; land | Labour, then land | 0.5 |
| Loans of grain are repaid | With a quarter more; as lent | With a quarter more | 0.4 |
| Who judges a case | The meeting's voices; the alderman | The meeting's voices | 0.3 |
| One's own cause | The parties stand aside; the parties vote | The parties stand aside | 0.35 |
| How the alderman is chosen | Elected by the meeting; by turns among the farms | Elected by the meeting | 0.3 |

## 11. Settlements, towns and regions

### Settlements and look

Villages are clusters of farmsteads around a green with a well sweep, fenced together; the buildings follow medieval Swedish practice rather than later Falu red farmhouses.

| Aspect | Design | Status |
| --- | --- | --- |
| Village | Farmsteads around a green with a well sweep (*brunnsvinge*); the infield fenced by a roundpole fence; a commons wood nearby. The green is the village's centre: the houses stand round it and their fields lie outward of them (Generated villages) | Decided (look), Agreed (layout); the green as the centre Decided, 12 Nov (Kim) |
| Every farm in a village | Every farm belongs to a village; a lone farm is an ordinary village of one farm, with its own meeting and a generated village name, and its map label shows the farm name only; an empty farm is owned by its village. When a village gains a second farm, it can lay out a green and dig a well as village work; they are not made automatically | Decided |
| Farmstead | Unpainted log cottage (*stuga*) with a turf roof on birch bark and a smoke hole (*ljore*) instead of a chimney; storehouse on posts (*härbre*); gapped barn (*lada*); yard; woodpile | Decided (look), Agreed (buildings) |
| For animals | A byre (*fähus*) on the farm; small hay barns out in the meadows | Agreed |
| Signs of life | The woodpile grows and shrinks with the stock; smoke thickens when cooking, in the evening and in winter; sheaf stooks (*skylar*) stand on reaped fields; herds graze near the farms | Agreed |
| Seasons on the map | A tint per season over the painted land (fresh green in spring, full in summer, ochre and russet on broadleaf and meadow in autumn, bare broadleaf in winter; pine stays green), and snow from winter day 2 to spring day 3 with lakes iced over, until snow can follow temperature (backlog VB-083) | Agreed, 30 Oct |
| Worn paths | Walking wears the ground: trodden, path and lane by crossings, fading over a year; lanes show as trodden snow. Drawn first (backlog VB-094); the faster walking decided under Land and ecology, Worn paths, follows (VB-110) | Agreed, 30 Oct |
| Farm names | Village farms by compass direction from the green (Norrgården, Södergården); lone farms (one-farm villages) by surroundings (Strand, Lunden, Backa, Myra, Ängen) | Agreed |
| Name generators | Names come from generators, several per kind of entity, and in the long run cultures prefer different generators. For farms, landmarks and owners' names combine with compass directions, so big villages need no numbers | Decided, 30 Oct |
| Pawns | Wool kirtles in undyed or plant-dyed colours, hose and turnshoes; hoods for men, and for all men in winter; a linen headcloth for married women, braids and a band for unmarried ones | Decided (good-looking), Agreed (dress) |
| Pawn size | Drawn about twice true size against buildings, so individuals read at play zoom; children smaller | Agreed |
| Animation | Walking, hoeing, broadcast sowing along the rows, reaping with a sickle, chopping, drawing water, mending fences, carrying sheaves, firewood and water | Decided |
| Empty farms | Buildings grey and decay into ruins; fields go to meadow and, near woodland (within 2 steps of forest, until forest spread exists), to scrub; full decay art comes with claims | Agreed |
| Generated villages | The village generator makes more varied and realistic villages, which look like villages that have grown in play; once worn paths exist, generated villages have them | Decided, 30 Oct |

#### Generated villages (Proposed)

- **Grown, not stamped:** the generator grows each village farm by farm by the rules of play: a household builds where a household in play would, takes fields near its house, and the village lays out a green and digs a well once it has two farms. A generated village and one grown over a run then look alike.
- **Worn in:** after the farms stand, the generator walks a few simulated years of daily trips (fields, well, wood, the neighbours) so the village starts with its paths and lanes.
- **Laid out by the land (Decided, 12 Nov, Kim; built in the generator, `src/sim/layout.js`):** a village is a green and then a farm at a time. A house stands on a tile touching the green, or hanging together with the village so far (beside one of its houses or fields); of the best such sites it takes the one whose land is best: the worth of the block of three fields it would take counts for it, and the fertility of the house's own tile against it, since a house stands on the poorer ground and spares the good, as a Swedish village sits on the stony rise beside its clay. Its fields lie no nearer the green than the house, so the green stays the centre, and the ring of tiles round the green stays open.
- **Fields beside the houses (Decided, 12 Nov, Kim):** a field may touch a house, its own or a neighbour's; there is no ring of yards kept free (the yard is drawn inside the house's own tile). A field is chosen by its fertility less 0.3 a step from the house (`FIELD_NEAR`; it was 0.15), within 4 steps. On populous small at four seeds the mean way from a house to its fields fell from 2.9 steps to 1.5, and nine houses in ten have a field touching them. Placement in play (a plot, a household's next field, a meadow) still keeps a step off every building, and follows (to be built).
- **One form:** the irregular cluster village (*klungby*), the most common form in medieval Sweden, and lone farms (*ensamgårdar*). The laid street and its row (*radby*, the regulated villages of the plains under *solskifte*) were built with VB-113 and removed on 12 November: a village has no laid street, and its lanes wear in where its people walk. Farms differ in age, size and number of buildings.
- **Fitted to the land:** villages follow shores, slopes, rivers and the edge of the forest, and avoid stony and wet ground for houses.

### The gathering (slice 4, 10 November)

The first thing that happens between villages, and what the fair, marriages across villages and the settling of borders are latched
onto. In history the gathering came first and the market rode on it: people met for law, cult and matchmaking, and traded because they
were there (`docs/review-markets.md`, section 2.3; the *ting*, and the Disting at Uppsala, a thing, a sacrifice and a fair in one). The
rows marked Decided are Kim's of 10 November; the rest is proposed with them for slice 4's plan (VB-183), which takes over the occasions
of VB-126.

| Aspect | Design | Status |
| --- | --- | --- |
| The gathering | Once a year, villages that lie near each other and think alike gather at a village's centre (a *ting*). Its purposes are to hold their customs together, to make marriages between villages, and to resolve disputes over borders; a fair is held at it (Exchange, The fair) | Decided, 10 Nov |
| The host | A village hosts, on its green. Villages compete to host | Decided, 10 Nov |
| How a village comes to host | At its autumn meeting a village with a green may offer to host; at the same meeting every village chooses the gathering it will attend that winter. The choice is counted in hours of walking: a village goes to the host with the fewest effective hours, if under 12, a day's walk (Between villages, Near and far). The walking hours between the two greens (Between villages, Distance); plus up to 4 for customs that differ (hard customs count double); less half an hour for each household of kin in the villages that went there last year, at most 2; less or plus up to 2 for the disposition between the two villages (below); less 1 if it was held last year; less up to 1 for the ale its host poured. A host's own walk is 0. A village attends one gathering. A gathering that fewer than three villages choose is not held, and its villages choose again; a lone village far from any has none | Agreed, 10 Nov |
| Who gathers | Villages at most a day's walk from the host, 12 walking hours by the one measure of Between villages (Inheritance, Between villages: distance and journeys), on foot; water is not crossed, so islands gather apart for now (Kim, 10 Nov; Over the sea, there) and travel by boat waits for slice 10. And close enough in customs to wish to: a village that has split from a culture (Meetings, culture and splits) is not drawn to its old gathering | Decided, 10 Nov (near and like-minded; a day's walk; islands apart); Agreed, 10 Nov (measures) |
| When | After the harvest: winter days 1 to 3. Fields sown in spring ripen from autumn day 3 to 12 and are then dried and threshed, so these are the first days free of it: the grain is in, the autumn slaughter is done (the count is on autumn day 8), the animals stand in the byre, and the first snow lies from day 2. It comes after the village meetings (autumn day 10) and the moving round (day 11), so each village goes to the gathering it chose at its meeting a few days before, and a border claim raised at a meeting is heard the same year | Decided, 10 Nov (after the harvest; the days) |
| Going there | Pawns prepare and travel in person. The household plans it as an occasion (a kind of plan, Work): it chooses who goes, packs provisions for the days away and what it means to exchange, as loads (a back load, or a cart with oxen), and those who go walk there and back as a journey (Between villages, A journey; Provisions and the season); those who stay keep the animals and the fire | Decided, 10 Nov (prepare and travel); Proposed (details) |
| Who goes | From each household: its holder or spokesman; its unmarried of marrying age; anyone party to a dispute; others as hands for the loads and by their own wish (sociability, until traits a stand-in). Never everyone: at least one adult stays | Proposed |
| Lodging | Those who come need a place to sleep, in winter and under a roof. As at the things and fairs of the North, where guests lodged with kin and guest-friends and the rest were quartered by the hosts or raised booths, a goer sleeps: at home, if its village is within two hours' walk; else with kin in the host village; else with a pawn there it holds a goodwill balance with (its partner); else where the host village puts it, in a barn. A farm of the host village lodges up to 10 guests (4 in the house, 6 in the barn), kin and partners first. A village whose goers the host cannot lodge is turned away at the choice and goes to its next gathering, so a larger village can host a larger gathering. Lodging a guest who is not kin is booked as a small gift, 1 ration a night, to the lodging holder's credit: the start of a partnership. Booths on the green, for a fair too large for the farms, come with the market place (slice 9) | Decided, 10 Nov (they need a place to sleep); Agreed, 10 Nov (the rule) |
| Customs drawn together | Those present meet (encounters at a venue), at most 6 new contacts a pawn a gathering, and attitudes move by contact as they do within a village, so villages that gather drift toward each other and away from those that gather elsewhere. The culture's reckoning counts a gathering's villages as tied to each other; a culture that fills more than one gathering is a candidate to split along them | Decided, 10 Nov (the purpose); Agreed, 10 Nov (the mechanism, the cap) |
| Marriages between villages | The round pairs villages by distance, and a match beyond a day's walk asks a suitor's visit (Inheritance, Between villages: Ease of mixing; The suitor's visit); the gathering adds to that and does not narrow it. Having been at the same gathering within the last 3 years counts as the visit (two villages of one gathering may lie up to 24 hours apart) and adds 0.5 to the matcher's score, where the village term is 2 at home and 0.45 at a day's walk. Spokesmen (Marriage as a negotiation) negotiate there, and a match agreed at the gathering is concluded there, by the acts the moving round uses, since the round is past. The suitor's winter visit falls in the same days, so a man looking for a wife goes to the gathering first. Courting across villages starts there too, once courting exists. Still a first version (Kim, 10 Nov), to be revamped as the negotiation weighs terms such as the dowry (VB-276) | Decided, 10 Nov (the purpose); Agreed, 10 Nov (the rule, as reconciled with Between villages; the term's 0.5 a starting value) |
| Borders | A dispute between two villages over a tile (Land, Infield, outland and wilderness) is brought to the gathering both attend and decided by the holders present from the other villages, under the Disputed claims custom of the gathering's villages; the cairns are raised after it. Two villages of different gatherings, or of none, settle it as now | Decided, 10 Nov (resolved at the gathering); Agreed, 10 Nov (who decides) |
| Disposition between villages | That others judge a border implies that villages stand in some relation to each other. It is read, never stored: the opinions and goodwill balances that the holders of one village already hold toward the holders of another (each pawn's counterparts are capped, so the reading is bounded), with the border grudges of 1 Nov among them. It leans a judge toward one party, weighs in a village's choice of gathering, and moves with what happens at one: a case lost, a match made, a fair deal or a hard one | Agreed, 10 Nov |
| The peace of the gathering | For its days no one presses a grudge: the host village's holders keep the peace and hear a quarrel over a deal on the spot. A breach is an event of the record, told in every village that was there | Proposed |
| What the host gains | Prestige for the host village's holders, and for the one who presides most, by the ale they pour (Goods, Ale and standing); the trade nearest home; later, when there are obligations, a due from those who trade (slice 5 or 8). This is why villages compete, and the first step of the alderman's road (target-v2, section 7.1) | Proposed |
| The district | The villages of one gathering are a district (*bygd*, later *härad*): the first unit above the village, read from where villages go, never stored apart from that choice | Proposed |
| What the player sees | Households packing the day before; lines of walkers and carts on the paths to the host village; the green full for three days, with loads and animals set out; a report in the log (who came, what was settled, matches made, what changed hands). The player's pawn goes or stays by the player's choice and takes part in person: deals, a match for a child, a voice in a border case | Proposed |
| Cost | Named before building, on medium at about 1,000 living: the choice, a read of the table of walking hours (Between villages, Distance), no search of its own; the walk, about 220 households times 2 to 3 goers once a year, less than the moving round; encounters, at most 6 a pawn present; the gathering's days are entries in the due-queue. With the fair (Exchange, The fair) the slice claims 2 ms of the budget's 200 ms a game day, a year's mean, and no step over 60 ms on `medium-ref`; its wrap-up (VB-304) measures both | Agreed, 10 Nov |

### Towns and regions (to be written: slice 9, VB-189)

| Aspect | Design | Status |
| --- | --- | --- |
| Markets and towns | Markets arise between villages and can grow into towns; a region holds a town or city and its villages, about two cities a map, from geography rather than a quota; alehouses mix villages | Decided, 3 Nov (Kim's description) |
| Settlement tier and regions | Derived from market potential (Harris 1954) with hysteresis, never stored; the cities review's phases are the road (`docs/review-cities.md`) | Proposed (target-v2, section 4.6) |
| From gathering to town | A town grows out of a gathering by one quantity, how often it is held. A gathering that fills gains a second date (before sowing; midwinter where ice opens the way), then a market day each month and each week, as the households within reach bring more to exchange; a craft household can live beside it once the days are close enough to feed it (Goods, The ladder), and a market that is held every few days with households living by it is a town. The dates are a list the host keeps; the tier reads the list, with hysteresis. Villages compete at every step, so where the towns stand, about two a map, follows from geography and from which hosts drew the others. Slice 9 designs it (VB-189); slice 4 builds the yearly gathering only | Proposed (`docs/review-markets.md`, section 3.2) |
| The region | A district is a gathering's villages (The gathering); a region is the districts whose people go to one town's market. Market potential explains which hosts win; attendance is what is read | Proposed |

## 12. Institutions and the world beyond

Not built yet; slice 8 writes this section (backlog VB-188).

| Aspect | Design | Status |
| --- | --- | --- |
| Rank | Only outside institutions grant rank. Before contact there is an implicit Crown (the landed; a landed big man may act as arbiter) and an implicit Church (each pawn's spiritual life; an implicit priest in a town) | Decided, 3 Nov |
| The outside world | Late in the game, limited contact with an abstract outside world: a port draws merchant ships that sell exotic goods and buy in bulk; diplomats and a few immigrants arrive | Decided, 3 Nov (Kim's description) |
| Immigration | Very limited immigration by boat, in a later stage | Decided (v0.3) |
| Pawns abroad | Keep their identity and ties and follow the same rules at a coarse cadence; a merchant who returns next summer is the same pawn | Proposed (target-v2, section 4.5) |
| Disease | Ships bring sickness, and towns crowd it; the largest gap in the design (target-v2, section 10.3) | Open |

## 13. Balance loops and targets

Slices 0 and 9 write this section (backlog VB-181, VB-189); the loops and their probes are listed in target-v2, section 6.

| Aspect | Design | Status |
| --- | --- | --- |
| Balance points | Many systems balance themselves, and tuning the game means tuning their balance points: peasant fertility is held in check by taxation and by higher death rates in crowded towns | Decided, 3 Nov (Kim's description) |
| Population | About 1,000 living pawns on a medium map (see Vision and scope) | Decided, 3 Nov |
| Growth | The island grows without the player. Yearly growth of a run is `(end / start)^(1 / years) − 1`. Over a scenario's seeds: the median seed grows at least 1% a year; at least three seeds in four end above their start; at most one in eight ends below half its start. Not every seed need grow. Founders is held to it as the early reference; populous while land is free (the loops hold it after); heirs is reported without a target | Decided, 12 Nov (1%, most seeds, the references); Agreed, 12 Nov (the three numbers) |
| What is judged | Island-wide numbers only. Hunger is an engine (Vision and scope, Principles), so measures of single households (the hungriest household, the share of households hungry, hunger's share of deaths) are reported as descriptions and have no target | Decided, 12 Nov |
| Collapse and tuning | A collapse is a reference scenario whose median seed shrinks; it may be tuned away at once. Anything short of a target but not a collapse is reported and left: parameters are tuned together, for gameplay balance, in runs Kim starts. A formula that computes something other than it says is a fix, not tuning | Decided, 12 Nov |
| Strata | 600 farming, 325 in towns and specialised work, 75 elite, per 1,000, at the end game; open to challenge. Proposed reading: a band for a developed island, not a quota, with strata counted by relation to production, not residence | Decided (the target), Proposed (the reading) |
| Bands | Full-simulation bands are reported nightly and never fail; reduced scenarios (a tiny map, a few years) are asserted and may fail outside their band | Decided, 3 Nov |
| Loops | About twenty loops, each declared with its stock, probe, setpoints and bands, calibrated fast loops first | Proposed (target-v2, section 6) |

## 14. Starting scenarios

There are several starting scenarios; the base and default one is the 10 founders, and unless a scenario says otherwise it starts with as few fields and meadows already made as possible, so the first year goes to making them. (Decided) Founders is the reference for the early game and populous for the late game (Decided, 12 Nov).

| Scenario | Start | Purpose | Status |
| --- | --- | --- | --- |
| Founders (base, default) | 10 unrelated founders: four couples, a farmhand and a maid, in two villages: a village of three farms and a lone farm, which is a village of one (Kim, 11 Nov; as built). The two differ in their crops (Goods and the farming year, The scenarios' crops); houses already standing, next to no fields or meadows made; a year's food and seed brought along; the land mass it needs scales with the map size. The marriage limit starts at “first cousins or further”, since the founders' grandchildren are mostly cousins | The normal game | Decided |
| Heirs and empty farms | Two established villages, three generations, adult heirs and younger siblings, an empty farm and a ruin | Exploring inheritance, expansion and customs | Decided |
| Populous Villages | Only villages, in three sizes: small 2–5 farms (about 60% of villages), medium 6–10 (about 30%), large 12–16 (about 10%). Households of 4–9 people, about 6: a couple, their children, sometimes a servant; children 2–3 years apart, the eldest up to 26, so about a third of households have a child of 18 or more (backlog VB-081; Agreed, 30 Oct). At most two generations made, no grandparents on record. 130–170 people on Tiny, 320–380 on Small, 800–950 on Medium and Large | A high population from the start | Decided (scenario, population), Agreed (village and household sizes) |

All scenarios build their villages and households through the same generators; a scenario only chooses what to build and where (Decided).

How a scenario is chosen and shown, and the story archetypes it names, are in The player, commands and views, Starting a game (11 November).

### The founders' first year (Proposed, partly Decided)

- **Spring:** claim and break the first fields in time to sow; a field not ready before the sowing window closes waits a year. A household claims a meadow tile and makes it a field when it needs one (Decided).
- **Summer:** find, claim and clear hay meadows, and make hay for the first winter.
- **Autumn:** a first, probably small harvest; decide how many animals to keep.
- **Stores to bring:** food for a full year plus seed, since the first harvest may be small (Decided), and a hay stock for the first winter (Proposed).
- **Houses:** the founders arrive to houses already standing (Decided).

### Heirs and empty farms

| Village | Farm | Household | What it tests |
| --- | --- | --- | --- |
| A, the culture's centre | 1 | Couple aged 61 and 58; children 29, 25 and 20 | Eldest inherits; younger two want out |
| A | 2 | Widow aged 54; only child a daughter of 22 | Heiress; widow's rights |
| A | 3 | Empty for 6 years after a couple and their baby died | Claims; decay |
| A | 4 | Couple aged 33 and 30; children 8 and 5 | A minor heir and guardian |
| B, remote, ideally across water | 1 | Couple aged 52 and 49; children 27, 24, 20 and 16 | Sons first against any child; landless eldest daughter |
| B | 2 | A ruin, empty for 15 years | Rebuilding; scrub |
| B | 3 | Childless bachelor aged 47 | Inheritance by a younger nephew |

- **Three generations on record**, with the founding grandparents dead.
- **One marriage between the villages** in the parents' generation, so first cousins exist across both and the marriage limit matters.
- **Village B leans differently** on some customs: any child inherits, handover at death, looser claims, a wider voice.
- **Debug tools:** skip one or ten years; hold the meetings now; run the moving round; speed up drift tenfold or a hundredfold; switch natural deaths; kill or retire someone; make someone argue for an option, or rally a fifth of a village's voice.

## 15. The player, commands and views

The player's role is in Vision and scope; how the player plays its pawn and what it sees are in The player and what they see, below, from slice 2's plan (backlog VB-079).

Every actor, pawn or not, acts through one command system, so the player or a debug tool can take direct control without changing the systems underneath. (Decided; close to implementation, kept here because it shapes the design)

| Aspect | Design | Status |
| --- | --- | --- |
| Unified commands | Pawns act only by issuing commands; planning chooses them, the simulation carries them out | Decided |
| Parity of command | Every act a pawn may take is the player's to command, in whatever position its pawn holds (a pawn, the head of a household, a holder of land, later an office), unless there is a well-motivated gameplay reason against it, which is then written beside the act. The command system is how pawns and the player alike act on the world: a pawn's own logic and the player choose among the same verbs, and each verb's check binds both. The player may be offered more options than a pawn's own logic ever uses (choices of a plan, of a deal, of a project), because a complex planner for 1,000 pawns is not feasible; a pawn never has an act the player lacks. A new act is not done until the player can reach it | Decided, 10 Nov (Kim) |
| Direct control | For debugging, the player can be wired in as a pawn's source of commands, with no change to the systems below | Decided |
| Non-person entities | The same holds for entities such as the village's yearly meeting and herds: their decisions are commands too | Decided (meeting), Agreed (herds) |
| Simulation step | The simulation advances in steps of at most 6 minutes of game time | Decided |
| Clock and picture | Neither the clock nor the picture needs to move in lock-step with the simulation steps, but both stay in sync with it. The clock is UI state of its own, derived from simulation time and shown in steps of at most 5 game minutes; UI state and simulation state are not automatically the same | Decided |
| Store views | Resource stores can be inspected for every level and dimension of entity: pawn, family, household, village, city, culture and more. First version: households and villages, in a Stores panel with food in days of need, no history (backlog VB-092) | Decided; Agreed (first version), 30 Oct |
| Commands | A command is a record of actor, verb, target and arguments, issued by a source (the planner, the player, a debug tool, the meeting); the simulation carries out commands and nothing else. First verbs: work, walk to, go home, idle. The job matcher is the first source; the meeting, the moving round and debug actions follow; herds wait for the animals arch. "Take control" on the pawn panel lets the player choose a pawn's next command (backlog VB-076) | Agreed, 30 Oct; take control widened to the player's queue, 7 Nov (see The player and what they see) |
| Saving | Saves in the browser, in slots, and saving to and loading from a file. Each archipelago (scenario, seed and size) has one auto slot, written when the page is hidden, and three slots written by hand; a slot is overwritten in place and no other history of saves is kept. The auto slot is written at each moving round as well once a save at the late reference takes under 0.5 s (backlog VB-214, VB-215). The page opens on a landing page with Play a Scenario (the start; New archipelago until 12 Nov), Archipelago editor (The archipelago editor; a game begun there is not saved yet) and Load archipelago (the Saves overlay, apart from the menu and the start); from a running game the menu's Main menu leads there, and the game stays, paused, until another is generated or loaded (Back to game). The three menu screens share one card; opened from the main menu the Saves overlay is titled Load archipelago and takes the menu card's place. Behind them the stage shows through, its interface put away: the paused game, or, with no game open, a very small showcase island, one of a pool of seeds chosen for their looks, with its villages living at 3× under a slowly drifting camera, which is no game (not saved, not gone back to) and stands still when motion is to be reduced (VB-307). An archipelago's saves can be deleted at once; a loaded file starts playing and takes no slot until it is saved. Each save names the build that made it: a save from any other build is refused with a message, and the page makes it easy to delete it and start a new game. Within one build the world is regenerated from the save's seed and size, exactly, with the tiles the simulation changed saved | Agreed, 30 Oct; revised 7 and 8 Nov (Kim: the build named, the world regenerated within a build, autosave at the round once a save is under 0.5 s) and 10 Nov (Kim: slots in place of the last 3, the Saves overlay, the landing page, deleting an archipelago's saves) and 10 Nov (Kim: the menu screens as one family on a live showcase island, VB-307) (was, Decided 30 Oct: autosave at each moving round; the whole world saved, not regenerated from its seed) |
| Performance budget | At the late reference, the first year populous medium reaches 1,000 living (`medium-ref`; year 12 on 8 November): 200 ms of simulation a game day, the mean over a whole game year, for the systems built so far, half of the finished game's 400 ms, which is a quarter of the page's main thread at 30× (a game day lasts 1.6 s); each later slice's plan claims its line from the other half. Each system's share of the 200 ms is in `tools/bench.js` (192 ms shared, 8 kept back; VB-203). No 6-minute step over 60 ms on `medium-ref` and on populous small at year 40. The cost per living pawn-day at year 40 of populous small at most 1.25 times year 5. Save and load under 0.5 s each at `medium-ref`, counting the time the page's main thread is blocked (gzip may run in a worker). Measured by slice 0, the yardstick: work counters in `npm test`, scaling and history checks, late fixtures and a nightly bench that reports and never fails (`docs/roadmap.md`, sections 5 and 6; backlog VB-192 to VB-206, VB-088) | Decided, 3 Nov; step gate revised to 60 ms, 6 Nov; reference, basis, history ratio and stress state revised, 7 Nov; populous medium at year 60 dropped, 8 Nov; a whole year's mean, the systems' shares and the save's main thread, 9 Nov (Kim; VB-202, VB-203) (was, 7 Nov: populous medium at year 60 a stress state, reported nightly against twice these lines; was, 3 Nov: at populous medium year 60, 160 ms a game day as 30× at 10% of a core, year 60 against year 5; medium-y60 temporarily 400 ms, 6 Nov; before that: under 10% of real time at the fastest speed on populous medium, checked in the verify run; Agreed, 30 Oct) |
| Family tree | Shows the genealogy of any such entity, from one pawn to a whole culture | Decided |
| Performance | The family tree view must stay fast | Decided (requirement), Open (how) |

The debug panel's actions (kill, retire, argue for a custom) would become commands as well (Proposed).

### The player and what they see (slice 2, 7 and 8 November)

| Aspect | Design | Status |
| --- | --- | --- |
| The player's commands | The player plays its pawn by queueing commands, which go before the pawn's own logic: while one is queued or under way, the pawn's automatic choices (which work, leaving work for more urgent work, being called off to cook, idle walks) leave it alone. Left to itself, the pawn falls back to the automatic behaviour of its role, as any pawn; the player may turn that automatic behaviour off. Without commands and with the automatic behaviour on, an inhabited pawn does exactly what it would if no one played it | Decided, 7 Nov |
| Needs and dark | Needs go on for the player's pawn as for anyone: it eats with its household, and at dark (the end of work) it goes home unless a command of the player's says otherwise, also with the automatic behaviour off | Decided, 8 Nov |
| The queue | Up to 8 commands. Each is checked when its turn comes; one refused then is dropped, and its reason shown. A command is done when its act ends: work when the job is finished or left, a walk on arrival, going home once indoors, idling when its time is up | Proposed (VB-079) |
| What it may do here | Opportunities for one pawn, computed when asked: the open work of its household and its village it may take, best fit first, with the reason for any it may not; walking to an open tile, going home, idling; a cause to argue for; and the moving round's acts (claiming an empty farm, taking service, moving out to new land). Each names its basis: member, servant, villager or itself. Read through the actor view, which filters nothing for now | Proposed (VB-079) |
| The meeting | Through advocacy only: the player's pawn may take up a cause, as any pawn does, and drop it. Its argument weighs with those it has ties to by its prestige; its own attitudes count at the meeting as anyone's. No ballot | Decided, 7 Nov |
| The round's acts | The same rules as for any pawn, as far as possible: where the moving round asks what a pawn wants (to move out, to claim an empty farm, to take service), the player's wish stands in for the pawn's own, and the round decides by its rules, at the round | Decided, 8 Nov |
| Marriage | The player has a say: a marriage is a negotiation between two households, and the player answers for its pawn, and as head for its household's members (Inheritance, Marriage as a negotiation; backlog VB-233) | Decided, 9 Nov (was, Decided 8 Nov: no say until courting, slice 7; the round matches the player's pawn as it matches anyone); how, Agreed 9 Nov, planned 10 Nov (VB-233: backlog VB-293 to VB-274 in this slice) |
| As head of the household | The player directs the household directly, as its holder would but by choice: it places the next field, meadow or building to be made, within the rules that bind any holder (claims, the farm's block of fields), and sets the season's work. Slice 3's plan (VB-164) designs it with the holder's plan | Decided (the principle), 9 Nov; how, to be written (slice 3) |
| Skip to the next event | The game is long, so the player may run ahead until something happens that concerns its pawn, and the page then pauses there, with the camera on what happened and a line saying why. It runs at the uncapped speed until an event that concerns the played pawn, its household or its line (a birth, marriage or death; a farm inherited, emptied or claimed; hunger in the household; a change of practice in its village), a question that waits for the player's answer, a refused command, an empty queue with the automatic behaviour off, or the eve of the moving round, so never longer than a year (backlog VB-234) | Decided (the principle), 9 Nov; Agreed (what stops it, the pause, the limit), 9 Nov |
| The chronicle | A History of each pawn, household, farm and village, read from the record of events, is built with slice 2 and apart from ambitions: it is the game's memory, and what the player reads its line's story in. A History tab in the pawn, household and village panels, newest first and filtered by kind; a farm's history follows the farm across households; the village log becomes a view of the same record (backlog VB-099) | Decided, 9 Nov (was: postponed with ambitions, 8 Nov); Agreed (the tab), 9 Nov |
| After a death | The page pauses and offers the successors of Which pawn (Vision and scope), the heir first; the world does not wait for the choice. A break in the line, when none is left, is recorded | Proposed (VB-079) |
| What the player sees | The played pawn's sheet (the action bar's Queue): its hunger and health, its household's food in days of need and its firewood, what it is doing, the queue (each command can be removed), the automatic switch, the offers that wait for its answer, and the last refused command and why. A Follow switch keeps the camera on the pawn. What it may do, and its cause with how the village leaned on it at the last meeting, are in the action bar | Proposed (VB-079); the acts moved to the action bar, Decided for now, 11 Nov (Kim; VB-341) (was: the pawn panel also listed what it may do here and its cause) |
| The action bar | The played pawn's acts are gathered in one bar across the lower part of the screen, opened by the dock's Actions button: three groups by the act's basis, Myself (itself), Household (member, servant, or holder) and Village (villager, later an office), and the Queue. A group opens a list: each act a row with its icon, its name and one line, a note or the reason it is refused, shown always and not only on hover; a chevron marks a row that leads to kinds or a form. A list stays open after an act is queued, with a line saying what was queued, so several can be queued in turn. It works by touch as by mouse. A stepping stone: it will be revised again (mock-up `docs/mockups/action-menu.html`, its Menu draft) | Decided for now, 11 Nov (Kim; VB-341) |
| An act and its slots | Every act is a verb and the slots it needs filled: a tile, a kind, another party, an amount. One description of each act (its basis, its slots, where it may land, why it is refused) serves any interface, so a new act needs no interface of its own. In the bar the verb comes first. An act with no place is queued from its row; a kind is a second list; a party and an amount are one form in the list (the gift: who, what, how much, with its warning beside it); a tile is asked for on the map, below. The mock-up's examples of acts to come: a foundation is a kind, then a tile, then turned and placed; sowing is a kind, then fields; hosting a gathering is a kind and no tile | Agreed, 11 Nov (the model); the acts to come Proposed, with their slices |
| The tool on the map | An act that needs a tile closes its list and takes the map: a banner names the act and what to tap, the tiles that would take it are marked, a tap queues the command, and a refused tap says why. Repeated work stays in hand until Done; an act done once (Walk here, choosing who is given to) ends with its tap. Work open at a single place is queued from its row at once, with no tap; an act every open tile takes (Walk here) marks none | Decided for now, 11 Nov (Kim; VB-341) |
| Icons on the tile | The other draft, not taken for now: a ring of icons around the selected tile, the tile first and each further slot one more ring (kinds, an amount, turn and place). It is quickest for one act on one tile and shows only what is possible there; on a phone it holds about five icons, covers the neighbouring tiles, needs names beside its icons, has none for abstract choices (a cause), and cannot repeat an act. A later revision may join the two: the ring for acts on a tile, the bar for acts with no place and for repeated work, or the bar filtered to the selected tile | Proposed, 11 Nov (mock-up, its Ring draft) |
| Village acts and the green | The acts of village life (building commons, hosting a gathering, calling a meeting; an alderman's with the office, VB-314) are in the bar's Village group, reachable wherever the camera is; a pawn without the office sees them refused, with the reason. The village green is the village's handle on the map, as a farmstead is its household's: selecting it leads to the same acts, never to acts found only there | Proposed, 11 Nov |

### Starting a game: the scenario and whom to play (11 November)

How a new game begins, worked out by Kim on a clickable mock (`docs/mocks/setup.html`, 11 November 2026). Two steps follow Play a Scenario
(New archipelago until 12 November, when the main menu gained the Archipelago editor beside it; The archipelago editor, below):
the start, before the land is raised, and whom to play, after it. The mock stands on data taken once from the game (seed 7, tiny map) and
is the reference for the look; where it and this section differ, this section holds.

**Principles** (Decided, Kim, 11 Nov; they hold for later screens of the menu's family too):

- **One choice, made once.** Each thing the player decides is decided on one screen. The start chooses the scenario, the map's size and the
  seed; whom to play chooses the person. A screen may show what a later one decides, as a look, and never selects it.
- **Show it on the land.** A scenario is shown by a picture of the game that tells what the scenario is (the founders' houses with no
  field broken, the heirs' empty farm beside three with smoke at the hearth), with a few callouts on it. A landscape that could be any
  scenario does not do.
- **The game's own graphics.** People are shown by the game's portraits and farms by the game's farm icons, as in the panels. Drawn icons
  are for what the game has no picture of (a field, a well, a position).
- **Few words, none hidden.** An icon and a few words before a sentence; but what the player needs is on the screen, never only in a tooltip,
  since a phone has none.
- **No invented measures.** A number or a meter on these screens is read from the state or the customs in force (who speaks at the meeting
  follows the village's custom); a figure made up to rank lives is not shown.
- **Nothing moves under the pointer.** Pointing at a thing may light up other things; it never changes the layout.
- **Only what exists.** Before the land is raised a screen shows what the scenario fixes and marks the rest as an example; after it, the
  real people of that land.
- **After the land is raised, the game is the screen.** A choice made then is made on the map and in the game's panels, in a mode of
  theirs, not on a separate screen with its own list.
- **The menu's family.** These screens use the main menu's card, title face and buttons, over the stage.
- **The inputs by the button.** What the player sets is beside the button that acts on it, apart from what only explains.

| Aspect | Design | Status |
| --- | --- | --- |
| The steps | Play a Scenario opens the start; Raise the land builds the world and opens whom to play, on the game itself; Play as, or Watch only, closes it. Whom to play replaces the small offer to play the suggested pawn | Decided, 11 Nov; the button's name 12 Nov (was: New archipelago) |
| Main menu, and no Back | No screen has a Back button: each (the start, whom to play, the game, the editor) has the Main menu button in its top-right corner, at the same place, and the main menu leads on. From whom to play the game waits behind the menu, and Back to game returns there. The Saves overlay closes with Close wherever it was opened | Decided, Kim, 12 Nov (was, 11 Nov: Back returns one step) |
| The start: scenarios | The built scenarios of Starting scenarios are picture cards in one row, each with its name, a line, the people it starts with and the generations on record. The people of a scenario that grows with the map (populous) are a range for each map size, measured from runs and checked by a test. Scenarios that are ideas only are not offered | Decided, 11 Nov |
| The start: the chosen scenario | Below the cards: the annotated picture; beside it who starts and the story archetypes; under it the year ahead in four short steps (the founders' first year) and what is unusual in stores and customs | Decided, 11 Nov |
| The annotated picture | A close view of a village of that scenario with three or four callouts, each an icon and a few words, on the things that define the scenario. One view, no inset: what lies outside it gets a callout at the picture's edge (the heirs' ruin on the far shore) or is said in words (how many villages the populous island has). It is the showcase island behind the menu, re-seeded with the chosen scenario, with the callouts anchored to its real farms and tiles, so nothing is drawn by hand; the heirs scenario asks for less land where the map is small, so that it fits that island. A game that is open is kept aside while the start shows the showcase, and Back to game returns to it | Decided, 11 Nov (Kim's answers to VB-340's questions: no inset, heirs fits small islands, the open game kept aside); Proposed: the showcase island as the picture, built by VB-340 for Kim to accept |
| Who starts | The people as the scenario fixes them. Where they are few, every farm as a small card with its icon, name and its people's portraits, empty farms and ruins among them (founders: the households without names); where they are many, an age pyramid, women to the left and men to the right, with the count. Before the land is raised these are the showcase island's people, marked as an example | Decided (the two forms), 11 Nov; Proposed (the showcase's people as the example) |
| Story archetypes | A scenario names a few positions worth beginning from (a founding holder, the heir who waits, a younger child, the widow, the heiress, a servant): a card each, with the position's icon, a name, one line on what that life is like, and the portraits of those who hold it. The same cards on both steps. On the start a card is a look: pointing at or tapping one lights up those people in Who starts. On whom to play it takes the player to such a person, and to the next at another click. The scenario's suggestion (Which pawn) is starred | Decided (cards, the same on both steps, a look on the first), 11 Nov; the name, Proposed by Kim ("story archetypes maybe"); which archetypes a scenario names, Proposed (the mock's lists) |
| Size and seed | In the bottom bar of the start, beside Raise the land | Decided, 11 Nov; without Back, 12 Nov |
| Whom to play | The game, paused, after the land is raised: the map is dragged and zoomed as always; clicking a farm selects its household. A panel shows the household (the farm's icon and name, its village, its food in days) and its people as portraits; clicking a person shows who they are, with Play as. Children are shown and cannot be played (Which pawn: any living adult). An empty farm or a ruin can be clicked and says that no one lives there. The panel opens on the scenario's suggested pawn | Decided, 11 Nov |
| A person's details | Name, age and position; one line on the life; whom the player would go on as after a death (After a death); what the position can do and what lies ahead, as icon chips, read from the rules and the customs in force in that village (a holder places fields, sets the work, arranges marriages and speaks at the meeting; under a wider voice any adult speaks) | Decided (what is shown), 11 Nov; Proposed (the chips' words; the heir shown is the one the customs name, by the game's succession rule, not a rule of the page) |
| Watch only | The game goes on with no one played, as after "Not now" today; a pawn may be played later from its panel | Decided, 11 Nov |
| On a phone | The start stacks to one column. Whom to play puts the map first, the household under it and the archetypes last; the bar with Play as stays at the bottom of the screen | Agreed, 11 Nov |

**Not part of this** (ideas of the mock, Proposed and unbuilt): four more scenarios (a year in service, the far shore, the alderman's ledger,
market day), which wait for the slices they belong to; and a preview of the island for the chosen seed.

### The archipelago editor (12 November)

A second way into a game, beside Play a Scenario on the main menu: the player makes the world, settles it and plays it. Decided by Kim in a
session on 12 November as the editor was built in steps; what was chosen in building and not yet weighed by Kim is Proposed. Where a
scenario is a setting someone else made, the editor is where such a setting is made; saving one is not built.

| Aspect | Design | Status |
| --- | --- | --- |
| The main menu | Play a Scenario (a story on a new archipelago: the start) and Archipelago editor (shape a world of your own, and play it), then Quick start and Load archipelago | Decided, Kim, 12 Nov |
| One scene | The editor is an interface of its own, not the game's: the world alone on the stage, dragged and zoomed as ever, with none of the game's panels. The tools are buttons at the top left (Generation, Terrain, Settlement), each opening its panel under them in the same scene, one at a time; Play and the Main menu button are at the top right. There is no Back | Decided, Kim, 12 Nov |
| Generation | The generator's parameters, set and seen: the seed, the map's size (the four sizes, or columns and rows), the share of land and the regions' radius; under them what the raised world holds (the land by kind, regions, lakes, rivers, deposits). Regenerate raises the land again from them, never while a control moves. The climate, rivers, fords and geology are still fixed numbers of the generator | Decided, Kim, 12 Nov (these four parameters first) |
| Regenerate resets | Regenerating clears all that was painted and placed on the land; the editor asks once before it does | Decided, Kim, 12 Nov; the asking Agreed |
| Terrain | A brush of one to nine tiles across lays a ground cover (shore, meadow, heath, the two woods, marsh, hills, mountains, snow) or a deposit of any kind, or takes deposits away; with no brush the map is dragged. The relief is not changed: the sea, lakes, rivers and heights stay as raised | Agreed, 12 Nov (the terrain brush as the first step); sea and height Open |
| Settlement: by a scenario or by hand | Settled by one of the built scenarios, the land is settled when Play is pressed. Placed by hand is the fourth choice, the "manual" scenario: what is placed is laid at once by the game's own generators and stands on the map as a run that never advances, so the picture is what Play begins on | Decided, Kim, 12 Nov |
| What is placed | Each with its icon: a village (laid about the tile by the village generator, with the farms asked for that find room); a household on the very tile, a family or a young couple; a person of a chosen sex, age and place in the house, who joins the household of the house pressed on; an empty farm and a ruin; a green with a well; a field and a hay meadow; a road. One placed thing can be taken away, or all | Decided, Kim, 12 Nov |
| Close households are one village | A household placed within the least distance between village centres (12 tiles) of a village's centre is of that village; farther off it is a village of its own, which later households near it join. A green placed by such a village becomes its centre | Decided, Kim, 12 Nov (grouped as in play); the distance Proposed |
| Building a household by hand | On an empty farm the first adult placed founds the household and holds the farm; a child cannot be the first, and no one lives in a ruin. People added to a family are of its household and not its kin. An empty farm has stood three years and a ruin fifteen, as the heirs' two do | Decided, Kim, 12 Nov (built person by person); the details Proposed |
| The people of what is placed | Villages and families placed are as in Populous Villages: households that have stood a while, with a year's grain, herds and the meadows they want | Proposed |
| Fields and meadows | A field or a meadow placed is of the nearest farm within six tiles, the reach a household looks for a meadow in; a meadow takes free meadow, marsh or heath | Decided, Kim, 12 Nov (placeable); the reach Proposed |
| Roads | Drawn by a drag over the tiles, or found between two presses by the route search the walkers use. A placed road is a lane, the most worn stage of a path, and fades as any path does where no one walks it (Worn paths) | Decided, Kim, 12 Nov (by hand, with an automatic option); the fading Proposed |
| Play | Play is beside the Main menu button and begins the game on the world as shown: the same land raised again, with what was painted and placed, then whom to play. By hand, Play waits until someone lives there. The editor keeps its world, to come back to from the main menu | Decided, Kim, 12 Nov |
| Saving | A game begun in the editor is not saved yet, by hand or when the page is hidden, and the Saves overlay says so: a save rebuilds its world from seed and size alone (Saving). Saving the world as a scenario, with its preview screen edited, is the next step and will carry what a save of such a game needs | Decided, Kim, 12 Nov (no saving yet; the scenario later) |
| Not yet | Undo; the sea, lakes, rivers and heights by hand; the generator's other numbers; saving as a scenario | Open |

### Keeping the family tree fast (Proposed)

- **Draw only what is on screen**, and fold distant branches until opened.
- **Lay out incrementally:** a birth or a marriage moves only its own branch.
- **Filter first:** a village's tree starts from its living members and reaches a set number of generations up and down.
- **Cache kinship:** coefficients are kept per pair and recomputed only along new lines of descent.

## 16. Open questions and proposals

The player's role is the largest open question; most proposals concern growth, the economy and keeping views fast.

### Open

- [x] The player's role, and whether and how the player influences customs. Decided: the player follows a family line and argues at the meeting through its head (30 Oct; see Vision and scope).
- [x] Births: fertility, child mortality, spacing of children. Decided: spacing by explicit pregnancy and nursing; starting targets for fertility and child mortality Agreed.
- [x] Stats and traits, and whether children inherit them. Decided (3 Nov): twelve traits, partly inherited (see People, Traits, talk and stories).
- [ ] A historical division of labour by sex, or free job assignment by role only.
- [ ] What hunger does: weakness, sickness, death, leaving. Decided: it can kill, mostly infants and the old, slows work, and postpones marriages and births, and who eats first is a custom. Decided (12 Nov): hunger is an engine of the gift, of loans and of the landed class, and a household may fail (Vision and scope, Principles). Sickness and leaving still open.
- [x] Faster speeds or skipping nights, given that a generation takes hours of play. A slow game is intended: 40 hours or more to full population is fine (Decided), so growth no longer forces this. Decided (30 Oct): 30× and uncapped speeds, running in the background, and short nights with less sleep; nights are not skipped (backlog VB-084, VB-105).
- [ ] Cities: how they arise and how much faster they change customs.
- [ ] Trade and money.
- [x] Seasons on the map, such as snow in winter. Seasons with temperature, a day and night cycle, and wind and rain are Decided (30 Oct). Agreed (30 Oct): seasonal tints and snow on fixed dates first (backlog VB-083), following temperature once a temperature model exists (see Weather, seasons and daylight).
- [x] Rivers, which water mills need; the world does not generate them yet. Decided (30 Oct): the world has rivers; their courses are Proposed.
- [ ] How strongly weather acts on work and yields, and whether weather differs between islands.
- [x] Whether rivers can be waded anywhere or only at fords, and when bridges come. Decided (30 Oct): only at fords or bridges; the rule is built (VB-112), building bridges is VB-115.
- [ ] Whether animals wear paths as people do. (The speed of each stage is Decided, 30 Oct.)
- [ ] What a more prestigious house brings its owner. Partly decided (10 Nov): a well-maintained house gives prestige up to a cap, and tar helps (Goods of place and side crafts); built (VB-306: condition by closed form, upkeep work, prestige term, tar's effects waiting for VB-301); what a fancier house adds is still open.
- [ ] How to make the ownership overlay and its filters both modular and fast. The backlog builds a simple overlay first (VB-004), then filters by scope (VB-043, VB-044) and a cache per chunk (VB-045).
- [ ] How to keep the family tree fast at full scale.
- [ ] Farm, village and population sizing revised for hay meadows. Partly covered: 2–4 fields per farm (VB-010), village size bands and population targets (VB-021); meadow area per farm still open.
- [x] Whether the founders arrive to houses already standing or build them in the first year. Decided: houses already standing (backlog VB-010).
- [x] Which wild grazer comes first. Decided: roe deer (30 Oct).
- [ ] Courting and relationships between pawns, which births outside marriage depend on: whether they also drive ordinary marriages, and who knows who a child's father is. Decided: courting drives most marriages, and the yearly matchmaking stays for pawns who are not courting (30 Oct); the true father is recorded and, for now, known to all (30 Oct); courting rests on pawn interactions (talk first).

### Proposed, not yet accepted

- [x] Newcomers arriving by boat, for growth and for marriage partners beyond the founders' families. Decided: very limited immigration by boat, in a later stage.
- [ ] Outlets for grain: storage losses, tithes, trade.
- [ ] Farm names as surnames (*gårdsnamn*) in place of, or beside, patronymics.
- [x] Next batch: claims on empty farms, clearing and building new plots, splitting land between heirs. Agreed on 30 October 2026; now backlog tasks VB-031 to VB-034.
- [x] One scope model shared by the ownership overlay, the store views and the family tree. Agreed (30 Oct).
- [x] Claims on empty farms and cleared plots as tile claims. New fields are claimed by tile (Decided, VB-010); empty farms with a birthright claim, Decided 1 Nov (VB-033).
- [ ] The debug panel's actions as commands.
- [ ] New customs: grazing on the commons, hunting rights, sharing hay from common meadows.
- [ ] The founders' first year as sketched under Starting scenarios, with a year's food, seed and a winter's hay brought along. Standing houses, a year's food and seed, and making fields are Decided (VB-010); hay meadows, hay and animals are not yet tasks.

### Added in v0.4 (3 November 2026)

- [ ] What a pawn knows beyond all-know-all: knowledge with a source (news, rumour, prices heard at a fair) where it changes a choice; stories are its first content (slice 7).
- [ ] Bodies: one membership graph with rules per kind, or a domain per kind (slice 5; Kim asked to iterate first). Measured by slice 5's plan, 11 Nov: the graph is cheap (Households and other bodies, Bodies); adopting it is `QUESTIONS.md`, VB-184, question 7.
- [ ] What follows when a meeting fails to decide its yearly routines (slice 3).
- [ ] Who mints, and when coin is taken (slice 8).
- [ ] The reading of 600 / 325 / 75 (slice 9).
- [ ] Ambitions, postponed (Kim, 7 Nov): whether the game offers them at all, and which; designed late, since nothing else depends on them.
- [x] Marriage as a negotiation (Decided, 9 Nov): who speaks for whom, consent, terms (dowry and morning gift), courting's place, and what the player answers. Agreed, 9 Nov (Inheritance, Marriage as a negotiation); VB-233 writes its tasks.
- [x] What stops a skip to the next event. Agreed, 9 Nov (The player and what they see; VB-234).
- [ ] Gaps no design pass has covered (target-v2, section 10.3): disease and epidemics; childcare and the household's division of labour; crime and law beyond debt; the quality of goods; legibility, and save versions across the changes.

## Appendix: Systems overview (Proposed, review of 30 October 2026)

Kept as it stood in v0.3. Its cost figures are superseded by `docs/roadmap.md`, section 5, and its findings by the slices.

The game's systems at four levels: the player's experience, the simulation, the presentation, and what cuts across them. For each it asks whether the game needs the system, whether it is fun, whether it is realistic, and what it costs at 1,000 pawns. Everything in this section is Proposed; it changes no Decided or Agreed point, and the questions it raises are in `QUESTIONS.md`. The state of each system in the game is from `REVIEW.md`.

State: **built** (as designed), **partly** (some of it built), **planned** (a backlog task or arch covers it), **missing** (no task yet).

### The player's experience

| Scale | What the player gets today | What the design promises | Gap |
| --- | --- | --- | --- |
| A minute | Pawns hoe, sow, reap, chop and carry; smoke, stooks and the woodpile show the state of each farm; any pawn, farm or tile can be inspected | The same, with herds, haymaking and the seasons visible | Small: animals and seasons |
| A session (1–2 hours, 2–3 game years at 1×) | A harvest or two, a village meeting, a handful of births, marriages and deaths | The same, plus land made, farms claimed, courting | Founders see about one birth per hour of play, and no new farm |
| A run (40–80 hours) | Customs drift; nothing else accumulates, since the population stays flat | 5–6 generations, growth to about 1,000 people, villages that split into cultures | Large: growth needs expansion |
| Agency | Debug tools only | Open | The largest gap: without a role, inheritance and customs have no stakes for the player |

**Fun.** The design's draw is the family saga in a changing society: the eldest son who inherits, the younger daughter who marries a widower in the next village, the custom her generation overturns. That is the pleasure of Crusader Kings III and of reading a parish register, set at village scale. It needs three things the game lacks: a stake for the player (a role), a growing cast (expansion), and a memory (a chronicle of what happened to whom).

### Simulation systems

| System | Needed for | Fun | Realism | Cost at 1,000 pawns | State |
| --- | --- | --- | --- | --- | --- |
| World and terrain | Everything | Each seed is a new archipelago to read: shores, woods, stony hills | Compressed on purpose; terrain types fit Sweden | 2–6 s once, at generation | Built |
| Calendar and the yearly round | Pacing, farming, meetings | The harvest and the meeting give each year a shape | 48 days a year, a day standing for a week; consistent | Negligible | Built |
| Work: jobs, matching, walking | The visible life of the village | Reading a village at a glance; watching a family get through the harvest | Role-based work fits medieval practice; walking follows terrain, fords and worn paths (A*); children work from 7; at `243d9dd`, before several hands, adults still left 20–25 jobs a day unclaimed (plow, cook, wood) | Jobs are indexed by owner; about 62 ms a game day at 830 pawns (at `243d9dd`) | Built, with several hands, the 6:00–18:00 day and interrupts (VB-102, VB-105, VB-107); help between households planned (VB-106) |
| Fields, grain and food | The material base and its scarcity | The harvest as the year's climax; a lean spring as drama | Seed at 4:1 fits Slicher van Bath; a farm feeds about 3.5 adult-equivalents, against 5–6 historically | Negligible | Built; a fed household hoards (1,700 grain after 38 years, VB-130) while a quarter of populous households go hungry (VB-039, VB-128) |
| Forest, wood and stones | Fuel, building, land-making | The commons wood visibly shrinking is a readable tragedy of the commons | Good; regrowth over 30 years | Negligible | Built |
| Making land: fields, meadows, plots | Incremental progress, growth | The game's "build" verb: land won by work, tile by tile | Good; hours scaled from history | Small | Planned (VB-010, VB-031) |
| Animals and hay | The second economy, the winter limit | The autumn decision of how many animals to keep is a real choice under risk | *Äng är åkers moder*; good | About 22,000 tile updates a day; small | Partly built (VB-131 to VB-134: herds, hay meadows, haymaking, the byre and the autumn count); milk, herding, manure, oxen and deer planned (VB-135 to VB-139) |
| Households and family records | The cast and its stories | The core of the fantasy | GEDCOM-like; good | Queries scan all records today (VB-052) | Built |
| Births, deaths, health | The cast changes | Death and birth are the main events | Matched to model life tables | Small | Built; health planned (VB-050) |
| Pawn interactions and courting | Ties, marriages, persuasion | Romance and friendship are what players retell | Courting at any time of year; good | One talk per pawn and hour, partners from map cells; about 20 ms a game day at 850 pawns (VB-061) | Partly (talk and opinion built; courting planned) |
| Inheritance and succession | Who gets the farm, who must leave | The strongest system today: every death reshuffles a family | Close to Northwestern European practice | Ranks heirs across all farms (VB-052) | Built |
| Expansion: claims, plots, splitting | The release valve; growth | Seeing a younger son found a farm is the payoff of a generation | Hajnal's pattern needs land to marry | Small | Plots are cleared (VB-031); the farmstead to build on them is next (VB-032); without it the population stays flat |
| Ownership and claims | Territory, expansion, disputes | Disputes over a tile are stories | Good | One value per tile | Partly (owners built, claims planned) |
| Customs, meetings, culture | Society that drifts over generations | The signature system, but slow and hard to see: a change every few decades, announced in one log line | Grounded in social-influence models; calibrated | 19 ms a day | Built |
| Village commons (green, well, fence, wood) | Shared duties, the village as a unit | Free riders on the commons are a source of conflict | Upplandslagen; good | Small | Partly |
| Commands | Direct control, herds, the meeting, a player role | Lets the player act as one pawn without new systems | — | Small | Missing (Decided in the design) |
| Save and load | 40–80 hour runs | A run that cannot be saved is not playable at this length | — | A JSON state of a few MB | Missing |
| Chronicle (a typed record of events) | Stories, panels, notifications, tests | "What happened to my grandmother's farm" | Parish registers and court rolls were exactly this | Small, append-only | Missing; the event log keeps 40 lines |
| Towns, markets, money | Grain outlets, specialists | Later | — | — | Later |

### Presentation systems

| System | Needed for | Fun | Realism | Cost | State |
| --- | --- | --- | --- | --- | --- |
| Painterly terrain, level-of-detail chunks | The look | The main visual appeal | Naturalistic | Chunk bakes spread over frames | Built |
| Farmsteads, decay, signs of life | Reading a farm's state without a panel | Woodpile, smoke and stooks already tell stories | Medieval Swedish buildings | Small | Built |
| Pawns: jointed rigs and work animations | The village feels alive | Watching the work is the minute-to-minute pleasure | Dress after the period | About 1,000 batched sprites | Built |
| Seasons on the map | The yearly round made visible | Snow and autumn colour mark time passing; without them a year looks the same throughout | Strong in Sweden | A tint and a snow layer per chunk | Missing (Proposed; seasons with temperature Decided 30 Oct, see Weather, seasons and daylight) |
| Panels: settlers, pawn, tile, household | Inspection | Necessary; text-heavy | — | Small | Built |
| Customs drawer and meeting log | Seeing society change | Bars and one line per change; the argument itself is not shown | — | Small | Built |
| Family tree | The saga | Strong once there are generations | — | Lays out every record on each open | Built; needs the "fast" proposals at scale |
| Ownership and claims overlay | Territory | Shows who holds what at a glance | — | Cached per chunk (VB-045) | Planned |
| Speech bubbles, mood | Feedback on social life | Makes ties visible | — | Near the camera only | Partly (bubbles, the people a pawn knows and a lens of them built; mood planned, VB-062) |
| Notifications | Drawing the eye to an event | A death, a marriage or a custom change otherwise passes unseen | — | Small | Missing |
| Worn paths | Showing where people walk | Lanes appear between farms, well and woods over years | Desire paths are real | One counter per tile, repainted with the chunk | Built (VB-094, VB-110, VB-114) |

### Across systems

**Food balance.** A ration is one adult's food for a day; a child under 14 eats half. A household of 6 eats 192 rations a year with four young children and 288 when they are all over 14. A meadow field gives about 80 × 0.97 ≈ 78 in an ordinary year, less 20 of seed. Three fields then give about 170 and four about 230, so a grown family goes hungry every year, and a household of 6 with three fields eats about 90% of its need while the children are small. In the populous scenario a quarter of household-days in year 2 are hungry. Animals are meant to fill the gap (VB-048), but they are the last arch to start. A balance that works before animals keeps every task in between from being judged on a hungry baseline.

**Growth.** Births are close to the targets, but marriages need a place and no new places appear, so the founders stay at 9–21 people for 40–50 years (31 October: 9–14 at seed 7, with no marriage in 40 years). Expansion matters more to the run than anything else on the backlog.

**Pace.** At 1× a year takes 38 minutes. A run of 40–80 hours plays mostly at 3× and 10×, so what the player sees at those speeds matters most: the harvest, the meeting, a birth, a death. Rare, legible events (a notification, a line in the chronicle, a meeting with its vote shown) carry the game between them.

**Cost.** At 10× a game day passes in 4.8 s. The simulation takes about 0.06 s a day at 830 pawns (31 October, at `243d9dd`), about 1% of a core. The moving round takes about 1 s in one frame and is seen as a freeze once a year (VB-129). A budget per system makes this testable: steady state under 10% of real time at the fastest speed, and no single step over 60 ms (medium-y60 temporarily 400 ms until VB-201).

### Findings

1. **Expansion first.** Make land, claim farms, clear plots and build farmsteads before more social depth: growth is the spine of a run. (Backlog: VB-010, VB-033, VB-031, VB-032 at priority 1.)
2. **A food balance before animals.** Feed a household of 6 from 3–4 fields in an ordinary year, with a small surplus to carry a poor one; retune when animals arrive. (QUESTIONS.md.)
3. **A player role.** Proposal: the player follows one family line. They act through the head of the line as that pawn's source of commands (choose work, court, claim, argue at the meeting) and continue as the heir when the head dies. It uses the Decided command system and direct control, it gives inheritance and customs stakes, and it fits a run of several generations. (QUESTIONS.md.)
4. **Commands and save games before animals.** Herds act through commands (Agreed), and a run cannot last 40 hours without saves. Both are cheaper to build before more state exists.
5. **Make customs legible.** Show who argues for what, the vote at each meeting, and a pawn's attitudes in its panel; announce a change of practice as a notable event.
6. **A chronicle.** One typed, permanent record of events per pawn, household, farm and village, from which the log, the panels, notifications and the tests all read.
7. **Seasons on the map,** after the browser smoke test (VB-025) can catch drawing errors.
8. **A populous start with adult children,** so marriage and inheritance begin in year 1, not year 6.

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 0.4 (distance review) | 12 November 2026 | Kim's decisions in a review of distance against the historical record (walking was 26 to 29% of hands' working hours, about a tenth in the record): World and scale reads land at 150 m a hex (it was 100 m); Settlements and look, Generated villages: villages are laid out by their land, a farm at a time round the green, the fields beside the houses and outward of them, and the laid street is removed. Agreed and not yet built: walking at 12 tiles an hour; loads of 30 on the back, 90 on a hand cart and 300 on an ox cart, carts as household items that wear; fields beside houses in play |
| 0.4 (the archipelago editor) | 12 November 2026 | Kim's decisions in a session as the editor was built: The player, commands and views gains The archipelago editor (a second way into a game from the main menu: the generator's parameters, a terrain brush for cover and deposits, and settlement by a scenario or by hand, with villages, households, people, empty farms, ruins, greens, fields, meadows and roads placed and shown at once; Regenerate resets what was made by hand; Play begins on the world as shown; such a game is not saved yet). Starting a game: New archipelago is Play a Scenario, and no screen has a Back button, the Main menu button being at each screen's top right (was: Back returns one step). Saving names the new menu. What was chosen in building and not weighed by Kim is Proposed there |
| 0.4 (principles) | 12 November 2026 | Kim's decisions in a discussion of the open questions: Vision and scope gains Principles for decisions (hunger as an engine; the island grows without the player; parameters, not patches; history leaning to gameplay; detail where it is a decision; founders and populous as references). Balance loops and targets gains Growth (at least 1% a year, over most seeds), What is judged (island-wide numbers only) and Collapse and tuning. Customs may be added freely, with a later review. `AGENTS.md`, Deciding without Kim, says which questions still go to Kim. |
| 0.4 (slice 6 plan) | 11 November 2026 | Slice 6's plan (backlog VB-185), on Kim's answers in a session: Goods, production and animals gains The mill and the loom, the kiln and the quarry: two halves; skills (novice 60%, master 130%); wool to cloth and dress; who spins as a practice; the quern stone a good of place that wears out; a water mill where there is a river, with millstones and iron; iron in two steps, lifting the tools' ceiling; pots, peat, brick, tiles and lime; four grades of house, the stone house alone mortared. Tasks VB-360 to VB-371; VB-009, VB-093 and VB-121 rewritten, VB-144 confirmed |
| 0.4 (the ground) | 11 November 2026 | Kim's decisions in a session on the terrain: World and scale gains Ground (bedrock of six kinds; finite deposits of clay, bog iron, iron, copper, lead-silver, tin and gold, and of peat, flint and amber, with salt springs; each island draws its kinds by tuned chance; a few endless sources), and Goods of place gains In the ground. Generation and views only (task VB-357); Kim's answers the same day on what is known and found, bog iron growing back, quarrying by bedrock and what each kind is for (`QUESTION_ARCHIVE.md`) |
| 0.4 (crops, first part) | 11 November 2026 | Kim's answers in a discussion of crops, the scale of a hex, planting, yields and the weather (`QUESTION_ARCHIVE.md`, VB-345): Goods and the farming year gains Crops and rotations, with what crops are for, the head's choice by skill (on choices and timing only), seed as knowing a crop, fallow as rest, different starts a village (Decided), and a table of the first crops, barley, winter rye, peas and fallow (Proposed). World and scale gains Two readings of one grid (a site about 10 m, land about 100 m and 0.87 ha a hex; Agreed), and farmland's compression is corrected from "a few hundred times" to about 100 times in area. Second part, the same day: The rotation (at most four courses a field, a short list of rotations bounded by the household's seed, a farm's fields staggered, the village's usual rotation in the culture's year) and How the head chooses what to sow (a poor, an ordinary and a good head; a trial as a project; the player's verbs), Proposed, with a row in Work: opportunities, plans and tasks. Rye is 4:1 (Kim, 11 Nov). Third part, the same day: Kim decided that the player chooses its rotation freely (the other heads' short choice is for cost) and that the village's usual rotation is the one most farms hold, updated at the meeting. Seed (seed is the crop's own grain, held in subtypes, reserved by the plan, the last field's seed eaten last; a crop moves wherever grain moves) and The scenarios' crops (founders: the three farms barley and rye, the lone farm barley and peas; heirs and populous Proposed); Starting scenarios names the founders' two villages. Fourth part, the same day: Crops and the weather (a season's warmth and wetness and two frost days in place of the yearly factor; a draw for the archipelago a season until slice 10, then the weather itself a region; what barley, rye, peas and hay each read; Proposed). Kim: a backup household carries pea seed in founders (Decided); the order in which seed is eaten (Agreed). Last part, the same day: What crops touch, and the tasks VB-346 to VB-356 (ten to build and a wrap-up). Kim then accepted the ten points still Proposed as written (`QUESTION_ARCHIVE.md`, VB-345), which are now Agreed, and the tasks were released at priority 2. Kim: the weather is being built on a branch of its own, so it answers the crops' question if it lands first; losing the spring's forecast is fine for now. The plan task was renumbered from VB-342 to VB-345, two other branches having taken VB-342 to VB-344 |
| 0.4 (starting a game) | 11 November 2026 | Kim's decisions on a mock of the screens after New archipelago (`docs/mocks/setup.html`): The player, commands and views gains Starting a game, with ten principles for these screens (one choice made once; show it on the land; the game's own graphics; few words, none hidden; no invented measures; nothing moves under the pointer; only what exists; after the land is raised the game is the screen; the menu's family; the inputs by the button) and the two steps: the start (scenario cards, an annotated picture, who starts as farm cards or an age pyramid, story archetypes as a look) and whom to play (the map, a farm clicked for its household, a person for their details). Which pawn now chooses on the game itself; Starting scenarios points there |
| 0.4 (field work) | 11 November 2026 | Kim's answers to a review of what three fields cost a household (about 215 pawn-hours a year, under a fifth of two hands' time): Goods and the farming year gains Field work (reaping 15 and threshing 20 hours a field, weeding in two rounds) and Bringing in the harvest (by the load, 30 on the back and 90 on a cart); Tilling power is raised to 5 times a hoe. Tasks VB-333 to VB-336; VB-337 makes the reviews' two measurements tools |
| 0.4 (stocks audit) | 11 November 2026 | Kim's answers to an audit of the stored quantities nothing reads: Goods and the farming year gains Water (a day without it: no cooking and a little health; Decided); Land and ecology gains Stone (used for the better house, a cheap house can be upgraded, stone picked from stony meadows or quarried in hills and mountains; Decided); uncooked grain feeds 0.75 in every uncooked meal, confirmed with 29% of grain eaten uncooked today. Tasks VB-331 and VB-332; notes on VB-062, VB-306 and VB-327 |
| 0.4 (consistency review) | 10 November 2026 | Kim's answers to a review of the game's logic (are pawns placed without walking, is wood depleted plausibly, does the moving round fit the rest): Land and ecology gains The village's wood (an allotted area, a tree from a random tile of it; Decided) and Timber (Proposed); Goods and the farming year gains Out of firewood (cold, with mood and health, and no cooking; Decided); the numbers Agreed the same day (`QUESTION_ARCHIVE.md`, "Consistency review"), with three more answers: a move within a village is walked (VB-287), a job with no route by land is refused (VB-329), and a home that took in a spouse at a round gives no provisions in it (VB-330). Tasks VB-326 to VB-330; notes on VB-062, VB-091, VB-300 and VB-301 |
| 0.4 (slice 5 plan) | 11 November 2026 | Slice 5's plan (backlog VB-184), written while Kim was away, all Proposed: section 5's Bodies, succession and estates becomes Households and other bodies (the bodies question measured; who owes; a dissolved debtor; the alderman; class and what landed changes); section 6's Rights becomes Land and rights (own and use held apart, tenancy, foreclosure, splitting between heirs as a split of rights, land not sold); section 9 gains Loans, obligations and cases (obligations as one module, grain loans, interest, default, pressing, cases at the meeting, the remedies of "Debts are paid with", partial failure, debtors' politics, hired hands, what the player sees, the cost); section 10 gains slice 5's five practices. Questions in `QUESTIONS.md`, "VB-184: debt and land"; tasks VB-310 to VB-321 |
| 0.4 (markets review) | 10 November 2026 | Kim's answers to the markets review (`docs/review-markets.md`), ahead of slice 4's plan (VB-183): villages that are near and like-minded meet at a yearly gathering at a host village's centre, to hold their customs together, make marriages between villages and resolve border disputes, and the fair is held at it; pawns prepare and travel there in person; villages host and compete to host; villages differ in what their land lets them make, and there are more specialised jobs; the economy is barter until coin, and taxes drive the adoption of money. Written as section 11, The gathering and two rows of Towns and regions; section 9, The fair and the Money row; section 8, Goods of place and side crafts; with notes in sections 3, 6 (Borders, now Under revision) and 10. Everything beyond Kim's points is Proposed; what may be exchanged for what is Open. Kim's answers later the same day (`QUESTIONS.md`, VB-183): goods in three classes, with custom on exchanges across them; dried fish and tar first, and every good's worth grounded in a need or in standing (What each good is for); the hosting rule with its floor of three villages; a border case decided by the holders of the villages not party to it; the gathering rule for marriages as a first version, to be revamped with the dowry; keeping goods. Disposition between villages added as Proposed. Tasks VB-294 to VB-304. A third round the same day: side crafts and the disposition between villages Agreed; the gathering is after the harvest (winter days 1 to 3 Proposed), so after the meetings and the round; ale as slice 4's third good; a well-maintained house gives prestige up to a cap, which tar raises a little while slowing its decay; grain loans move to slice 5. Tasks VB-305 and VB-306. Slice 4's plan closed the same day (VB-183) with Kim's answers on its numbers (`QUESTION_ARCHIVE.md`, "VB-183"): winter days 1 to 3; a village's choice of gathering in hours of walking, at most a day's walk, on foot, so islands gather apart for now; lodging with kin, partners and in the host's barns; quanta and the worth table; need; loads and proposals; the keeping goods' cap; no labour days at the fair yet; the fishing boat; the numbers of the well-kept house and of ale; the slice's cost. Opinion's term in allowance, 10 rations either way, Agreed (VB-220). At the merge with Between villages (written the same day): the gathering reads its one measure of distance and its day's walk of 12 hours, and goers walk as journeys; marriages between villages follow Between villages, with a shared gathering counting as the visit and adding 0.5 to the score; one load, 30 rations on the back and 90 with a cart, for the fair and for kin help (`QUESTION_ARCHIVE.md`, "VB-298") |
| 0.4 (between villages) | 10 November 2026 | Kim's decision of 10 November: distance between villages governs what reaches between them, close villages mix easily, a long trip is not cheap, the pawn physically travels (section 5 gains Between villages, Decided as the principle, its rows Proposed by VB-281's plan with tasks VB-286 to VB-292 and five questions in `QUESTIONS.md`, "VB-281"; Leaving home, Marriage as a negotiation, Empty farms, Households short of people and Moving to new land point to it). Also recorded, Decided by Kim the same day: the round's starting village turns by the year (Leaving home, A village's round; VB-280); butter's source for a meal's variety is milk (Meals); a hungry household eats its seed as the last step and leaves fields unsown (Seed; VB-282) |
| 0.4 (meals) | 10 November 2026 | Kim's decision on VB-119's questions: a ration is only the unit of food; a household stores foods and meals; variety is judged in the pot; uncooked grain is eaten at a penalty (section 8, Food and Meals; backlog VB-259, VB-119) |
| 0.4 (slice 3 plan) | 10 November 2026 | Slice 3's plan (backlog VB-164): section 7 written with Kim's answers: a holder chooses in three layers (the culture's year as a template, foresight by skill, one project by values), traits as stand-ins until slice 7, planning days by diligence with a due-queue, four bases of eligibility, herding the only background work, reservations, sowing first as the template's order, the meeting's routines and a practice for a meeting that does not decide; no limit on idle hours (replaces the 40 to 60% target of 30 Oct); the player as head makes every choice of the plan |
| 0.4 (backlog review) | 10 November 2026 | Kim's decision in the backlog review of 10 November: parity of command (section 15): every act a pawn may take is the player's to command unless a gameplay reason is written against it; the player may have more options than the pawns' logic uses, never fewer (also target-v2, principle 15) |
| 0.4 (gameplay review) | 9 November 2026 | Kim's decisions on the gameplay review of 9 November (historical grounding and engagement): a marriage is a negotiation between two households in which the player takes part (Inheritance gains Marriage as a negotiation, its details Agreed the same day, VB-233 writing the tasks; replaces "no say until courting" and "marriage comes from courting"); the player steers by its pawn's position, and as head of a household directs it directly, placing fields (slice 3); the player may skip to the next event (VB-234); the chronicle is built with slice 2, apart from ambitions (VB-099); Swedish and continental customs may be mixed, engaging play deciding, and the founders scenario is a frontier settlement |
| 0.4 (slice 1, VB-217) | 8 November 2026 | Decided by Kim while building VB-217 (`QUESTION_ARCHIVE.md`, "VB-217"): two principles head The gift, Lumps and occasions and Goodwill is one decaying number; a balance is one number read from its value and when it last changed, with a half-life tunable from 2 to 20 years, dropped once under a ration when a pawn next deals, reaches its cap or dies; gratitude by size only, an old debt's souring left to stories; no reason or year on the panel; help in hunger asks at most once a season, for enough to reach the next harvest |
| 0.4 (slice 1 plan) | 8 November 2026 | Slice 1's plan (backlog VB-182): section 9 gains The gift. Agreed by Kim (8 November, `QUESTION_ARCHIVE.md`, "VB-182"): the floor at the seed reserve and 20 days of need; allowance as grain above the floor, less the holder's own reserve, plus goodwill's term; goodwill in customary rations, halving in 4 years, 32 counterparts a pawn; the debtor's gratitude and the creditor's souring over an old debt, switched on with slice 4, so slice 1 books and shows goodwill only; the two holders book, the village store and holderless households book nothing, half passes at a handover; the panel's balances and a holder's allowance; the player's gift, to any household and not bound by its pawn's allowance. Proposed: the gift as Exchange's mechanism and its acceptance. The Help in hunger row of section 8 is no longer under revision |
| 0.4 (slice 2 plan) | 8 November 2026 | Slice 2's plan (backlog VB-079): section 15 gains The player and what they see. Decided by Kim (7 and 8 November): the player plays by queueing commands that go before the pawn's own logic, with its role's automatic behaviour as the fallback and a switch to turn it off; needs and going home at dark go on; the meeting through advocacy only; the round's acts under the same rules as for any pawn; no say in marriage until courting; ambitions postponed; each save names its build, and autosave at the round waits until a save takes under 0.5 s. The queue, what a pawn may do here, what follows a death and what the player sees are Proposed |
| 0.4 (slice 0 plan) | 3 November 2026 | Slice 0's plan (backlog VB-181): the performance budget row of section 15 brought up to Kim's budget of 3 November and the yardstick that measures it; no other point changed |
| 0.4 (skeleton) | 3 November 2026 | Version 0.4 begun as a skeleton (backlog VB-191): v0.3 kept unchanged in `docs/design-v0.3.md`; its points carried over with their status into 16 numbered sections ordered as the player meets the world; Kim's decisions of 3 November recorded: the player inhabits a pawn (replacing the family line of 30 October), the scale of society, about 1,000 living on a medium map, the 24 decisions of the architecture conversation (`docs/architecture/target-v2.md`, section 8) and Kim's description of the game; points they change marked Under revision with the slice that rewrites them; new sections for exchange, goodwill and obligations, institutions and the world beyond, and balance loops |
| 0.3 (architecture) | 3 November 2026 | `docs/architecture/target-v2.md` made the architecture reference; a note in Status of this snapshot names the points it changes and the proposed version 0.4 (`docs/roadmap.md`); no Decided or Agreed point changed |
| 0.3 (review, 2 Nov, second pass) | 2 November 2026 | Kim's answers on the stability review: the means to marry (1.5 years of food), service for the lone holder, and the spacing of villages and farms kept, now Agreed; late marriage left to service (VB-090) and courting (VB-036). Kim's answers on the balance review: fields by labour, grain spoiling in store, haymaking to need, +0.04 a load of manure for now, remarriage and meat 15 kept and Agreed; hay in the barn spoils by winters held as grain does (new, VB-159); the soil's cap rises 0.1 a century of farming (VB-160); ewes' milk and wool as proposed (VB-144). Kim's answers on moving to new land: settlers' provisions raised from 36 to 42 days; who leaves and when, joining before founding, and soil 1.4 on fresh land kept, now Agreed; lone settlers and the founders' slow growth left to courting, occasions and the expansion wrap-up (VB-035) |
| 0.3 (review, 2 Nov) | 2 November 2026 | Review after the stability and expansion work (VB-146 to VB-154): the rules that keep households from dying out recorded in Inheritance and expansion (Households short of people); the profile report puts talk and contacts at 37% of a game day, so the tie cap (VB-127) is now a speed task; no Decided or Agreed point changed. See `REVIEW.md`, review of 2 November |
| 0.3 (claims review) | 1 November 2026 | A review of claims, ownership and territory against medieval Scandinavian land holding (`docs/review-claims.md`): Claims, ownership and territory gains Infield, outland and wilderness. Decided by Kim: the outland claimed by need at the meetings, a year and a day, borders settled by the Disputed claims custom and marked with cairns, border grudges, no taking in of another village's land, settlers in wilderness only, the commons wood in the village's land, stakes before clearing with contests, a birthright on empty farms, and land counted as the base for a later land tax. Numbers Proposed. Implement tasks VB-042, VB-004, VB-155 to VB-158 and VB-033 |
| 0.3 (expansion review) | 1 November 2026 | A review of crowded villages against medieval Scandinavian settlement (`docs/review-expansion.md`): Inheritance and expansion gains Moving to new land, and Land and ecology a row on fresh land. Decided by Kim: only landless adults leave; never-farmed ground yields more its first crops, in every scenario; settlers prefer small villages of 1 to 3 farms that are not crowded; new villages 10 to 30 steps from home. The rest Proposed. Implement tasks VB-146 to VB-150 |
| 0.3 (balance review) | 1 November 2026 | A review of performance, the food balance and the animals' economics against history (`docs/review-balance.md`), with milk and butter, manure and soil, and oxen built (VB-135, VB-137, VB-138). Decided: no fixed number of fields; a farm's fields are limited by its labour and its size. Proposed: about 2 fields a working adult (1.5 more with oxen), fields and meadows made in every scenario, poorer land only when meadow runs out; grain spoils in store (5%, 20%, 40% a year by years of need held; the village store 20%); haymaking only while hay is short of two winters' need; a dung heap that rots; widowed partners mind the age gap less. Questions in `QUESTIONS.md` |
| 0.3 (review, 1 Nov) | 1 November 2026 | Review after the animals' first batch (VB-131 to VB-134): Animals and hay now partly built; the cost, idle and growth findings restated in `REVIEW.md`; no Decided or Agreed point changed |
| 0.3 (animals review) | 31 October 2026 | A review of the animals design against medieval Swedish husbandry and the game (`docs/review-animals.md`). Agreed: a herd's cattle as named animals, sheep as counts; meat a cow 15, an ox 18, a sheep 3 (from 40 and 8); soil wear and manure with numbers; grazing pressure counted where herds graze; starting values for hay, breeding, meadows, haymaking, the byre and the autumn count, milk, herding and oxen (Animals, First version). Implement tasks VB-131 to VB-141 |
| 0.3 (review) | 31 October 2026 | Systems overview brought up to date after the paths, fords and layout work: walking, worn paths, food and cost rows; founders' hoarded grain and uneven hunger noted; the question of fords settled; no Decided or Agreed point changed. Rebased onto main the same day; its new tasks are VB-128 to VB-130. See `REVIEW.md`, review of 31 October |
| 0.3 (relationships review) | 31 October 2026 | A review of relationships and pawn interactions against RimWorld, Dwarf Fortress, Crusader Kings III and The Sims (`docs/review-relationships.md`). Decided: opinion as the sum of timed memories; one talk partner per pawn and hour, chosen by familiarity and liking; talk outcomes by a pair's compatibility; idle pawns seek those they like; familiarity (the tie) unchanged for now. Built in backlog VB-060, VB-061, VB-124 and VB-125 |
| 0.3 (job review, second pass) | 30 October 2026 | Brought in the answers to the second review of the job system (`QUESTION_ARCHIVE.md`, `REVIEW.md` Work and jobs, second pass): roles rank types of work; how busy the village should be; fishing and gathering, always posted, by urgency; mixed meals that go further, and fresh food that spoils; milling built with the food jobs; village work days and winter crafts; the interrupt rule's numbers kept, so a son rather than the farmer goes for wood |
| 0.3 (merge) | 30 October 2026 | Merged the design notes line (main) with the jobs review and the settled questions. Kim's choices where they differed: main's workday of 6:00–18:00 and dark of 4–8 hours by season, not a fixed night; worn paths drawn first (VB-094), with the speed-up as a follow-up (VB-110); snow on fixed dates until temperature exists (VB-083); terrain costs in the current route search now (VB-096), HPA\* only if needed (VB-097) |
| 0.3 (questions settled) | 30 October 2026 | Brought in Kim's answers to every open question (`QUESTION_ARCHIVE.md`): the player's role (a family line, relatives only, the line's prestige as score); commands; saving the whole world, with old saves easy to delete; field yield 100 and seed 25 and a health drain of 4; a farm's fields as one block within 4 steps; the own-heir custom and the better farm under "keeps"; service; courting numbers, with the yearly matchmaking kept for those not courting; populous adult children; legible customs; the whole household in field work; the bid floor, children's rates, help and interrupts; forest spread, empty fields, store views, the windmill, worn paths, seasons, 30× and uncapped, the performance budget, the founders' herds, firewood about five times, terrain costs with HPA\* |
| 0.3 (jobs review) | 30 October 2026 | Brought in Kim's answers from the review of work and jobs (`QUESTION_ARCHIVE.md`, `REVIEW.md` addendum): daylight by season (settled in the merge below: main's fixed 6:00–18:00 workday stands); children work from 7 at reduced efficiency; help between households, which builds relationships; the player steers the job system later and should influence the world through all systems. Proposed: hours of daylight, children's jobs and rates, rules for help, several hands per job, work beating idleness, interrupts |
| 0.3 (design notes) | 30 October 2026 | Kim's design notes: an uncapped speed; an option to run while the tab is not in focus; short nights in which pawns sleep less; a day and night cycle; weather with wind and rain, and seasons with temperature, acting on work and yields; rivers; worn paths that speed walking, so routes merge onto them; more varied, realistic generated villages that look grown and have paths. Added the section Weather, seasons and daylight; numbers and mechanisms Proposed. In a round of questions Kim then decided: speeds Pause, 1×, 3×, 10×, 30× and uncapped; work from 6:00 to 18:00; about 6 hours of dark, 4 at midsummer to 8 at midwinter; paths 5%, 15% and 30% faster |
| 0.3 (backlog sync) | 30 October 2026 | Brought in Kim's answers of 30 October (`QUESTION_ARCHIVE.md`): health; courting from 16 and pawn interactions with mood; meals, help in hunger and sowing first; roe deer, the founders' herds, food from animals and the byre; green and well built by the village, lone farms' village names, name generators; the Disputed claims custom; shares owed, splitting land, restoration hours; plots of a house and 1 field, two projects per village, 6 steps, revised hours and priorities; who may claim, claim expiry and disputes, first filters; the scope model Agreed; the founders' looser marriage limit |
| 0.3 (review) | 30 October 2026 | Added Systems overview (Proposed): the player's experience, simulation and presentation systems, and food balance, growth, pace and cost across them, with findings; no Decided or Agreed point changed |
| 0.3 (discussion) | 30 October 2026 | Yields rise slightly over the course of a game |
| 0.3 (discussion) | 29 October 2026 | Growth from natural births, with very limited immigration by boat in a later stage and 40 hours or more to full population; hunger can kill, mostly infants and the old; the heir-to-own-farm rule becomes a custom; the marriage limit is judged by degree, opens to closer kin when marriages are scarce, and never allows siblings; hunger also slows work and postpones marriages and births; children are spaced by explicit pregnancy and nursing; who eats first in a hungry household is a custom; degree is counted the civil way, with a fourth, loosest option allowing uncle–niece; starting values for births, hunger and the who-eats-first custom agreed, to be tuned for gameplay later; some births outside marriage; parents of young children favour feeding children first; plentiful spouses slowly tighten the marriage limit again; births outside marriage come from courting between pawns, and whether such children inherit is a custom; courting replaces the yearly matchmaking; the true father is recorded while pawns may believe otherwise |
| 0.3 (backlog sync) | 29 October 2026 | Brought in decisions recorded in BACKLOG.md: four map sizes and a generation screen, the Populous Villages scenario and shared generators, every farm in a village, standing houses for the founders, a 6-minute simulation step with its own 5-minute UI clock, and starting numbers for trees, stones, making fields, tilling, threshing, weeding and milling. Open questions marked where the backlog covers them |
| 0.3 | 29 October 2026 | Added Animals (cattle, sheep and one wild grazer; herds; the hard winter hay limit; ties to other systems), fields and meadows as built land that can be private or common, making hay meadows, and Starting scenarios (founders as the base and default, starting with as little land made as possible; the debug scenario moved here) |
| 0.2 | 29 October 2026 | Added long, multi-day work and processing, a 40–80 hour run length, Land and ecology, Claims, ownership and territory, and Commands, time steps and views. From this version on, each version is its own document |
| 0.1 | 29 October 2026 | First snapshot: world, time, people, economy and jobs, look, customs, inheritance and expansion, debug scenario |

Earlier versions: Village builder: game design snapshot v0.3 (`docs/design-v0.3.md`), v0.2, v0.1.
