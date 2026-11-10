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
| Which pawn | At the start, any living adult, chosen from the pawn panel; each scenario suggests one (a holder in founders and heirs). After a death, the player chooses among the pawn's kin by blood or marriage, its household and its close ties, the heir first; if none is alive, any adult, and the chronicle marks the break | Decided, 3 Nov |
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

## 2. World, climate and travel

### World and scale

One finite, seeded archipelago of 280 × 200 hex tiles, each about 10–12 m across, so a house is one tile; distances, farmland and time are compressed rather than tiles mixed in size.

| Aspect | Design | Status |
| --- | --- | --- |
| Map | One finite archipelago per seed, regenerable | Decided |
| Tiles | Pointy-top hexes | Decided |
| Terrain | Deep sea, sea, shallows, lakes, sandy shore, meadow, heath, broadleaf forest, pine forest, marsh, hills, mountains, snowfields | Agreed |
| Mountains | Multi-tile rock relief; no peak glyphs | Decided |
| Rivers | The world has rivers | Decided, 30 Oct |
| River courses | Rivers rise in hills, mountains and marshes and run downhill to a lake or the sea, a few on each large island; brooks are narrow, larger rivers a tile wide; they carry fresh water and fish, drive water mills, and wet the ground along their banks, where hay grows well. Crossing is at fords and, later, bridges | Proposed |
| Tile scale | About 10–12 m per hex, a building plot; one house holds a family | Agreed |
| Mixed scale | By compression: distance about 10×, farmland a few hundred times, time compressed (see Time) | Agreed |
| Map size | Four sizes: Tiny 120 × 85, Small 180 × 130, Medium 280 × 200 (56,000 tiles, about 20,000 of them land; the earlier single size), Large 380 × 270 | Decided |
| Generation screen | The game opens on a screen to set map size, seed and starting scenario, then generates the map; the same seed, size and scenario always give the same world | Decided |
| Regions | Hexagonal patches of radius 7 (169 tiles, centres 13 tiles apart) | Agreed |
| Walking and terrain | Routes and walking cost by terrain: meadow, heath, shore and fields 1, forest 1.5, hills and marsh 2, mountains 3, snowfields closed, in the current route search (backlog VB-096). A step also costs more by its slope: 6 for each unit of elevation between its two tiles (elevation runs 0 to 1 over the land), at most 2, the same up and down, so routes keep to flat ground and a pawn walks slower on a steep step; a worn path does not flatten a slope (VB-271; the two numbers are `SLOPE` in `src/sim/rules.js`, to be tuned with the balance). Routes over regions (HPA\*) only if routes then cost too much (VB-097) | Agreed, 30 Oct; slopes Decided, 10 Nov |
| Uses of regions | Overview, territory, simplified simulation off screen, hierarchical pathfinding for 1,000 pawns (HPA\*, Botea, Müller and Schaeffer 2004) | Agreed |

#### Compression

- **Distance:** villages sit 13–15 tiles apart instead of a realistic 100–250 tiles (1–3 km).
- **Farmland:** a farm has 2–4 field tiles; a medieval household farmed about 12 ha, close to 1,000 hexes.
- **Rejected alternative:** a separate world map with local maps to enter (as in RimWorld or Dwarf Fortress). It only pays off with hundreds of settlements and breaks continuous scrolling.

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
- **The year's weather factor** (see Goods and the farming year) comes from the season's actual weather instead of a separate draw: a wet harvest or a dry early summer makes a poor year.
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
| Yearly round | Sowing in spring; haymaking in summer; harvest in early autumn; village meetings on autumn day 10; moving round on autumn day 11; the gathering of villages and its fair after the harvest (Decided, 10 Nov), on winter days 1 to 3 (Proposed; see The gathering) | Agreed |
| Stall period | Animals stand in the byre from about autumn day 9 to spring day 6, 21 of 48 days (see Animals) | Agreed |
| Pace of play | A year takes about 38 minutes at 1× and about 4 at 10× | Agreed, trade-off noted |

**Growth and time conflict.** Frontier populations with open land grew close to 3% a year from births. From 10 to 1,000 takes about 150 years, 5–6 generations, or roughly 10 hours at 10×. The game is meant to be slow: 40 hours or more to reach full population is fine, with growth from births and, in a later stage, very limited immigration by boat (Decided).

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
| Courting | Unmarried pawns may court from 16; marriage stays at 18 for women and 20 for men, and still needs a place to live and kin no closer than the limit. Hunger of 0.5 or more postpones the marriage, not the courting. About 5% of births at first come while courting, and about 3 in 4 such couples marry within the year if they can. The true father is recorded and, for now, known to all. A widow or widower minds the age gap half as much, so a widowed holder may marry a younger landless adult and bring the farm to the marriage (balance review; remarriage was common in pre-industrial Sweden, Lundh 2007) | Decided (from 16; true father), Agreed (rest), 30 Oct; Agreed (remarriage), 2 Nov; **Under revision** (VB-233): a marriage is negotiated between households, Decided 9 Nov, and courting moves the heads to negotiate, Agreed 9 Nov (Inheritance, Marriage as a negotiation) |
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

- **The moving round** follows the meetings each autumn: handovers and a fresh count of who wants to move out. It is also when households negotiate marriages (Marriage as a negotiation, below; Decided, 9 Nov). (Was, Decided 30 Oct: marriages come mostly from courting, at any time of year, and the yearly matchmaking stays for pawns who are not courting, as arranged marriages.)
- **Marriage** is negotiated between the two households (Decided, 9 Nov; was: comes from courting, at any time of year). It needs a place to live under the residence custom, and kin no closer than the custom's limit, by civil degree. Matches favour the same village and an age gap of about 3 years.
- **Wants to move out:** an adult of 18 or more with no farm, no spouse with a farm, and no place in line for one.
- **Service:** a landless adult may take service where labour is short: below 1 hand (members 14–59, not retired) per field. At the moving round unmarried landless adults from households above 1.5 hands per field go, oldest first, to the shortest household of their village, else of the nearest village within 15 steps; board and lodging only (backlog VB-090; Agreed, 30 Oct).
- **A start in life:** a cow and a few ewes from the family's share give a new household its start.

### Marriage as a negotiation (9 November)

From the gameplay review of 9 November. A peasant marriage between landholding families was a settlement between two households, of people, land and goods, and it is the largest choice of a life; so it is a negotiation the player takes part in, not a match the round makes over its head. The first row is Kim's; the rest was proposed with it and accepted the same day (`QUESTION_ARCHIVE.md`, "VB-233"). VB-233 writes its tasks.

| Aspect | Design | Status |
| --- | --- | --- |
| The principle | A marriage is negotiated between two households, and the player takes part: for its own pawn, and as head of a household for the household's members | Decided, 9 Nov |
| Who negotiates | Each side's spokesman (*giftoman*): the head of the household the pawn lives in as a son or daughter of the house; an adult with no such head (a holder, a widow or widower, a servant, a cottager) speaks for itself | Agreed, 9 Nov |
| Consent | Both who are to marry must consent, as canon law asked; a pawn that refuses a match its head made loses some of the head's opinion. A cause for a custom ("Who makes a match": the heads; the heads with consent; the couple) is a candidate | Agreed, 9 Nov |
| The offer | First version: the round's matcher finds the pairs it finds today, and each becomes an offer that both sides answer; a side with no player answers yes, so a run with no player is unchanged. Later, heads look for matches themselves and weigh the other household's land, stores, standing and the tie between the two | Agreed, 9 Nov |
| Terms | First version: none beyond the means to marry and A start in life, above. With slice 4's goods and worth: a dowry (*hemföljd*), counted against the bride's share of the inheritance, and a morning gift (*morgongåva*) from the groom's side, hers if she is widowed; both booked in customary worth | Agreed, 9 Nov |
| Courting | Keeps its place from slice 7: a courting couple's wish is what moves their heads to negotiate, and is enough by itself for those who speak for themselves; a courted match the heads refuse may end in a birth outside marriage, or in the couple leaving for service | Agreed, 9 Nov |
| The player's doors | As the one to marry: a wish for a match (carried to the round as its other wishes are) and yes or no to an offer. As head: yes or no for a member, and, later, proposing a match and its terms. An offer is the first question asked through `Decisions.answer`; it stays open for 7 game days, the world does not wait, and unanswered the pawn answers as it would unplayed | Agreed, 9 Nov |

### Empty farms

- **Buildings** lose about 8% of their condition a year; below 40% the turf roof has fallen in, below 15% the farm is a ruin to rebuild.
- **Fields** turn to meadow within 1–2 years; near woodland, without grazing or farming, meadow goes on to scrub and young forest. Each stage needs a longer clearing job.
- **Claims** follow the claims custom, married couples before singles. A claim posts restoration jobs owned by the claimant's household; they move in once the roof is repaired. Agreed.
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
- **A servant for a lone holder.** A holder who lives alone takes in an unmarried landless adult of 18 to 50 from a household that keeps 2 working hands, in its village or within 15 steps.
- **Room.** A new village lies 5 steps or more from other farms and 12 from any village centre; a new farm needs 6 free farmable tiles within reach besides its first field.
- **Names on the map.** A village of two or more farms is labelled once; a lone farm's village bears its farm's name (VB-026).

### Moving to new land

When a village is full, its landless adults may leave to found a farm of their own on new land, or join a small village nearby: the daughter settlements (*torp*, *-ryd*, *-boda*) of the medieval colonisation of the outland. Review and sources: `docs/review-expansion.md`. (Decided, 1 Nov: who leaves, fresh land, small villages, distance; Agreed, 2 Nov: deciding, provisions, where, the bonus of fresh land; the rest Proposed)

| Aspect | Design | Status |
| --- | --- | --- |
| Crowded | At the moving round, after plots are started, a village is crowded when adults of it wait for land (no plot, no cottage coming) and no plot site can be found; the village panel shows how many wait | Proposed |
| Who leaves | Landless adults only, with their spouse, their minor children and siblings who follow; holders never leave their farms | Decided, 1 Nov |
| Deciding | A waiting adult of 18–45 in a crowded village leaves at a moving round with a chance of 0.3 after one round of waiting there, 0.6 after two, 0.8 from three; older waiters first. Each unmarried sibling also waiting there follows with a chance of 0.5, at most 2, as farmhand or maid, still landless | Agreed, 2 Nov |
| Provisions | Food until the next harvest and a week's margin (42 days of the party's rations; 36 left none) and seed for one field, from the party's stakes and then from their old households' grain above their own seed and food until the harvest (or the holder's buffer, if longer); short of it, they stay a year and the log says why | Agreed, 2 Nov (42 days) |
| Where | First a small village: one of 1 to 3 farms, within 30 walking steps of home, not crowded (room for a plot, none of its own adults waiting, fewer than 2 plots or booths under way), with kin first, then the nearest. Otherwise a new village, 10 to 30 walking steps from home | Decided (small villages, distance), 1 Nov; Agreed (rest), 2 Nov |
| The new site | Meadow nobody owns, at least 3 steps from any house, green or field, with a block of 3 free fields and a wood within reach; the best by land, wood, water and nearness, its fields at least 0.9 times as fertile as the home village's | Proposed |
| The booth | The party moves at once into a booth (*bod*) on the site and builds the cottage as its own household's work: foundation 30 hours, walls 60, roof 30; it clears its first field and makes more as any farm does | Proposed |
| The new village | A village of one farm, no green or well, named for its founder (Erikstorp, Olofsboda); it keeps its mother village's customs and culture and records where it came from; its tie to the centre is computed as for any village, so a far daughter drifts more easily and may split off | Proposed |
| Fresh land | A field broken on ground never farmed starts with soil 1.4, above manure's cap of 1.15, and wears 0.08 a crop as any field: on a manured farm it is down to the cap in about 3 crops; without manure it stays 0.4 ahead of an old field until both reach the floor (about 9 crops); in every scenario | Decided, 1 Nov (the bonus); Agreed, 2 Nov (soil 1.4); Proposed (wear) |

### Bodies, succession and estates (to be written: slice 5, VB-184)

| Aspect | Design | Status |
| --- | --- | --- |
| Bodies | Households, villages, parishes, courts, estates, workshops, crews and ships as bodies, with members along typed role edges; a body exists only when something needs its own identity. One membership graph with rules per kind is Proposed: it passed the succession probe (target-v2, section 9) | Open (Decided, 3 Nov: iterate before deciding) |
| The alderman's estate | A derived view first: the alderman is an implicit elite with no title; once a holder has rank, his estate is a body of its own | Decided, 3 Nov |
| Testament | Choosing an heir outside the custom's order only where custom allows a testament | Decided, 3 Nov |

## 6. Land, ecology and rights

### Land and ecology

Tiles carry their own state (trees, stones, grazing), and work, grazing or neglect moves them from one kind of land to another.

| Aspect | Design | Status |
| --- | --- | --- |
| Trees per tile | Each wooded tile holds a sensible number of trees, at full cover about 60 broadleaf or 80 pine (±20% per tile); cutting fells them one by one, one per firewood trip. A partly felled tile grows back to full in about 30 game years, by one growth model for all trees | Decided |
| Showing trees | Not every tree is drawn: a tile shows stages for about 100%, 75%, 50% and 25% of its trees remaining | Decided |
| Cleared woodland | At 0% trees the tile becomes meadow; regrowth applies only to tiles that still have trees | Decided |
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
| The commons wood | Chosen in the village's own land when it holds forest | Decided, 1 Nov |
| Stakes | A field or meadow project stakes an unrealised claim; breaking the ground makes it the household's; a household with no free tile within reach may contest a neighbour's claim weakened below half (about 18 months unworked); the custom decides and the loser remembers it ("Took our claim") | Decided, 1 Nov |
| Birthright | When a farm empties, its last holder's family keeps a birthright claim on it (*bördsrätt*) for 20 years, which puts them first under "kin first" (VB-033) | Decided, 1 Nov |
| Land and tax | The land each household and village holds, by ring and kind, is counted in one place, as the base for a land tax and for landholding elites later | Decided (as a base), 1 Nov |

#### One scope model for overlays, stores and trees (Agreed, 30 Oct)

- **A scope** is an entity level, the entities chosen, and a dimension (owns, claims, uses, works, is kin of). The same scope drives the ownership overlay, the store views and the family tree.
- **A membership graph** links the entities: pawn to household, household to village, village to culture; families cut across households. Each view asks the graph for the tiles, stores or people in scope.
- **Compact tile data:** one owner per tile, and claims as a short list per tile, since most tiles have none.
- **Cached overlay:** drawn per map chunk; when ownership or claims change, only the chunks they touch are redrawn.
- **Cheap filtering:** changing the filter recolours from the cached data; nothing is recomputed from the simulation.

### Rights (to be written: slice 5, VB-184)

| Aspect | Design | Status |
| --- | --- | --- |
| A bundle of rights | Land is held as a bundle of rights per holding (own, use, occupy, develop, graze, gather, fell, fish, pass), after Honoré (1961). A right may hang off another (a tenancy off the owner's right), so ownership can pass while tenancies stand; foreclosure usually changes who is owed, not who farms | Proposed (target-v2, section 4.3) |
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
| Built land | Fields and meadows have to be made by work before they produce; either can be private or common | Decided |
| Making a field | Claim the tile, clear scrub and stones (many stones make it slow, and the stones become building material), then break the ground. A household starts one field at a time when it needs more (2–4 per farm); the people who till do the work; a typical meadow tile takes about 50 work hours (scrub 10, stones up to 20, breaking 30). A farm's fields lie together as one contiguous block within 4 steps of the house, not necessarily next to it, in every scenario; a new field joins the block where a free tile touches it (backlog VB-109). Balance review, 1 Nov: no fixed number of fields: a household wants fields for its food but no more than its hands can till (about 2 a working adult, 1.5 more with a team of oxen); households in every scenario make fields and meadows; heath, hills or marsh are broken only when no meadow is free (`docs/review-balance.md`) | Decided, Agreed (hours); Decided (block), 30 Oct; Decided (no fixed cap; by labour and household size), 1 Nov; Agreed (numbers, poorer land), 2 Nov |
| Field cycle | Stubble, tilled over several days, sown, sprouting, growing with light upkeep, ripe, reaped into stooks, dried, threshed, grain stored | Decided (long work), Agreed (stages) |
| Seed | Sowing costs a quarter of the expected harvest, a 4:1 yield ratio as Slicher van Bath (1963) reports for medieval Europe; a household keeps back seed for all its fields before it eats | Agreed |
| Field yield | Before animals, a meadow field gives about 100 rations in an ordinary year, less 25 of seed, so 3 fields give about 218 and 4 about 290 and a family of 6 is fed from its own fields; populous households of 7 or more get a fourth field. Retuned when milk and meat arrive (backlog VB-080, VB-048) | Decided, 30 Oct |
| Meals | A household keeps a store of meals, cooked from its foods and counted in rations; each afternoon the cook makes the next day's meals, and may leave other work after 14:00 to do it; households start with 2 days of meals, so one missed cooking uses the buffer, not a hungry day. The cook puts in what spoils first. Variety is judged in the pot: a pot of 2 sources goes 10% further, of 3 or more 20%, a source being a food that gives at least a fifth of the pot (grain and flour are one source). A household with no meals eats its grain uncooked, at a penalty (starting value: 1.25 rations of grain for a ration of need) | Decided, 30 Oct; meals, the pot and the penalty Decided 10 Nov (Kim); the penalty's number Proposed |
| Food from the wild | Fishing in rivers, lakes and the sea from spring to autumn, and gathering berries, mushrooms and nuts in the woods in late summer and autumn. Both are always posted, with an urgency that is low while the household has food and high when it runs short, so they fill slack hours and answer a lean summer; each water or wood tile holds a stock that use lowers and time restores (backlog VB-117, VB-118) | Decided (by urgency), Proposed (numbers), 30 Oct |
| Mixed meals | Judged in the pot, at cooking (see Meals; 10 Nov). A day's meals cooked from 2 food sources needs 10% less food, from 3 or more 20% less; grain or flour, fish and gathered food are sources now, milk and meat with the animals. Fresh fish and gathered food are eaten first and spoil after 3 game days; drying and salting come later. Built with hand-quern milling (backlog VB-119, VB-009) | Decided, Agreed (numbers), 30 Oct |
| Help in hunger | A household short of food asks at most once a season, for enough to reach the next harvest (the start of autumn; in autumn, a season's need): its kin first, then the village store; if the gifts fall short, it waits for the next season. Each adult keeps a buffer of 20–60 days' food (drawn per pawn) before giving. The village store is filled with 25% of each household's surplus at the moving round. Help is a gift, and it raises the tie between the households and is booked as goodwill between their holders (see Exchange, goodwill and obligations, The gift); loans come with money | Decided (the store), Agreed (rest), 30 Oct; revised as a gift, 8 Nov (VB-182); once a season, until the harvest (Kim), 8 Nov |
| Soil | Each harvest wears a field down; manure from the byre restores it. Starting values: −0.08 a harvest to a floor of 0.75, +0.04 a load of manure to 1.15 (backlog VB-137). Balance review: the dung heap loses half of what lies on it in a year, and is carted before the hoe; +0.02 a load (so about 3 head of cattle, not 1.5, keep 3 fields) was tried and cost a quarter more hungry days, so +0.04 stays until herding (VB-136) and food from the wild (VB-117, VB-118) give farms more slack | Agreed; numbers Agreed, 31 Oct; Agreed (the heap rots; +0.04 for now), 2 Nov |
| Risk | Frost destroys whatever is left in the field; each year has a weather factor | Agreed |
| Yield over time | Yields rise slightly over the course of a game (better practice, tools and manuring); the soil's cap (1.15 from manure) rises by 0.1 a century of a village's years of farming, so a well-dunged old farm out-yields a new one by about 10% after 100 years (backlog VB-160) | Decided (rise), 30 Oct; Agreed (rate), 2 Nov |
| Tilling power | An ard drawn by a pair of oxen tills perhaps 2–3 times faster than a hoe | Agreed |

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

### Goods of place and side crafts (slice 4, 10 November)

Villages must differ before they need each other: where neighbours make the same things, a market has little to move
(`docs/review-markets.md`, sections 2.2 and 5). So some goods can be made only where the land gives them, and households make them
beside their farming, for the fair. The first row and the principle of the second are Kim's (10 November); the rest is the approach
proposed with them, for slice 4's plan (VB-183) to confirm.

| Aspect | Design | Status |
| --- | --- | --- |
| Local differences | Villages differ in what their land lets them make, and this is what draws them to deal with each other | Decided, 10 Nov |
| More specialised work | There are more specialised jobs, so that villagers can turn to producing more than their sustenance | Decided, 10 Nov (the need); Agreed, 10 Nov (side crafts and the ladder below) |
| Goods of place | A good of place needs a resource within a village's reach: fish (sea shore, lake or river), tar and charcoal (pine forest), bog iron (marsh, smelted with charcoal), stone for querns and whetstones (stone ground). A village without the resource cannot make the good and must get it by exchange. The plain's own goods are those every farm has: grain, butter, cattle, wool | Proposed |
| First goods | Slice 4 builds two: dried fish, a food that keeps and counts as a source in the pot (Mixed meals), and tar, for boats and timber (What each good is for, below); both need no facility beyond a drying rack and a tar pit (*tjärdal*). Iron waits for tools that wear (VB-121), stone for the mill (slice 6), salt and cloth of quality for the ship (slice 8) | Agreed, 10 Nov |
| Side crafts | A household stays a farm and takes up a side craft in its slack hours (*bisyssla*; the many trades of the Nordic peasant), as a kind of long work with its own job kinds. It is the sink the idle hours lack beside textiles (target-v2, section 5.6), and it needs no new kind of household | Agreed, 10 Nov |
| Why make more than is needed | The surplus is a holder's project (Work, the third layer: one project by values): a household aims its side craft at something it lacks and can only get at the fair: the other villages' goods, an animal, a dowry. Nobody produces for sale in general; with no coin there is nothing general to sell for | Proposed |
| Skill and tools | Hours at a craft raise the pawn's skill at it, and a craft's facility (a boat, a tar pit, later a smithy) is a lump one household builds and owns. Both make the household that began a craft better at it than its neighbours, so a village comes to have "the fisher" and "the tar burner" without any rule naming them (the derived roles of the vision) | Proposed |
| The ladder | Three steps, each needing a wider market than the last: a side craft (the yearly fair is enough); a craft household, which holds less land than it needs and lives partly by exchange (a fair twice a year or a monthly market); a specialist with a plot and no fields (a weekly market: see Towns and regions). A household moves up or down by what its craft brought it over the last years, with hysteresis | Proposed |
| A well-kept house | A well-maintained house gives its holder prestige, up to a cap: the first answer to what a better house brings its owner. The house has a condition that upkeep work raises and time wears down; prestige follows the condition, so it is earned by work and lost by neglect. Tar makes this source easier: a tarred house's cap is slightly higher and its condition decays a little more slowly. Numbers with slice 4's plan (VB-183): a cap of the size of a holder's other small terms, tar adding about a fifth to it and taking about a third off the decay | Decided, 10 Nov (prestige, the cap, tar's two effects); Proposed (numbers) |
| Cost | A side craft is ordinary jobs on a household's planning day; goods of place add one reach test per village and resource, refreshed when its land changes | Proposed |

**What each good is for.** A good has worth only through a need of pawns or households, or through standing (Kim, 10 November: Decided);
no good is wanted because a table says so. The goods of place, and the goods beside them that the gathering gives a use, with what
grounds each and when it could come. Dried fish and tar are Agreed for slice 4; the rest is Proposed.

| Good | Made where | What it is for | When |
| --- | --- | --- | --- |
| Dried fish | Sea shore, lake or river | Need: food that keeps through winter and spring, and a second source in the pot (Mixed meals) | Slice 4, on fishing (VB-117) |
| Tar | Pine forest | Need: a boat must be tarred or it leaks and is lost, so the fishers need the forest; tarred timber decays more slowly. Standing: through the well-kept house (below) | Slice 4 |
| Ale | Any village with grain to spare | Standing: what a host pours, at the gathering, a wedding or a funeral ale, is what its guests remember; a use for surplus grain other than letting it rot | Agreed, 10 Nov, for slice 4 |
| Furs and hides | Forest and wilderness with game | Need: winter dress and footwear. Standing: dress | With roe deer (VB-139) |
| Honey and wax | Broadleaf wood and meadow | Standing: mead at a feast; later wax for the Church | Slice 6 or 8 |
| Lumber and hewn stone | Pine forest; stone ground | Standing: the fancier houses of Long work need both, and a village without them must get them | Slice 6 |
| Querns and whetstones | Stone ground | Need: flour goes further than grain (Milling at home); edged tools | Slice 6 |
| Bog iron | Marsh, with charcoal from pine | Need: tools that wear and are mended (VB-121), so faster work | With VB-121 |
| Salt | Ships | Need: keeping meat, fish and butter | Slice 8 |
| Cloth | Every farm with sheep; fine cloth from ships | Need: dress. Standing: dyed and fine cloth. It keeps its worth | Slice 6; fine cloth slice 8 |


## 9. Exchange, goodwill and obligations

Help in hunger is the first exchange, a gift (The gift, below, from slice 1's plan, backlog VB-182; see also Goods and the farming
year). The fair, below, is barter between villages, begun on 10 November for slice 4's plan (VB-183), which writes the rest with slice 5's (VB-184).

| Aspect | Design | Status |
| --- | --- | --- |
| Goodwill | An opinion that is also a currency, in discrete units (helped build a house, gave a cow): its own measure on the relation between two pawns, tightly coupled to opinion by culture. It makes parties accept unfavourable terms, short of starving themselves; an unfavourable deal changes it in turn | Decided, 3 Nov |
| Value and acceptance | Customary worth decides what a deal was worth, possibly influenced by need; need decides whether it is accepted | Decided, 3 Nov |
| Booking | A deal's residual is booked between the two acting pawns only; a household's allowance in a deal is likewise its agent's, toward the other agent | Decided, 3 Nov |
| Goodwill at retirement | A share of the holder's goodwill passes to the new holder, set by custom | Decided, 3 Nov |
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
| Allowance | How much one agent would give up to another in one deal, in rations, never below 0: the giving household's grain above its floor; less the holder's own reserve beyond the floor, 0 to 40 days of the household's need, drawn per pawn (a stand-in for generosity until traits, slice 7); plus goodwill's term, what the giver owes the receiver less what the receiver owes beyond 30 days of its household's need, which slice 4 switches on. No kinship term until help reaches beyond kin; no custom term until a custom of helping exists. With goodwill's term off, a kin household gives what it gives today | Agreed, 8 Nov |
| Unit and decay | Customary rations; grain is worth 1 a ration until worth becomes a norm (slice 4). A balance is read from its value and when it last changed, so it decays with no step of its own: it halves in 4 years (tunable from 2 to 20). One under a ration counts as forgotten, and is dropped when either pawn next deals, reaches its cap, or dies. A pawn has at most 32 counterparts; the smallest balance goes to make room | Agreed, 8 Nov; one number decaying when read (Kim), 8 Nov |
| Goodwill and opinion | The debtor is grateful: +0.15 × s / (s + 20) for a balance of s rations, fading as the balance decays. How long a debt has stood, and an old debt souring the creditor, are for stories (slice 7), since a balance keeps no age. One set of values for every culture for now. Slice 4 switches this on with allowance's goodwill term; until then goodwill is booked and shown only. It replaces the memory "A gift of food" proposed for VB-039 | Agreed, 8 Nov; by size only (Kim: one number), 8 Nov |
| Who books | The two holders. The village store's gifts and its yearly filling book nothing until the village has an agent; a household without a holder books nothing. At a handover (a retirement, or a holder's death), half of the old holder's balances pass to the new holder, and a retired holder keeps the rest. Other deaths end a pawn's balances until a person's estate is designed (slice 5) | Agreed, 8 Nov |
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
| Deals between strangers | Two pawns who have not dealt before have no goodwill, so their allowance toward each other is near zero: a deal passes only when both gain by need, and many fail because the lumps do not fit. Deals that failed for want of change are counted, as the measure of how much the island wants money | Proposed (target-v2, section 5.2) |
| Trade partners | A deal leaves a small balance, and a balance is a reason to deal again: at the next fair a pawn proposes first to those it has a balance with. Over the years two holders of different villages become partners, and that tie is what later carries a loan, a lodging or a match between their children | Proposed |
| Keeping goods | To get round the double coincidence of wants, a few goods that keep and that every household can use (butter, dried fish, tar, cloth, a sheep) are accepted beyond the taker's own need, at their customary worth and up to a cap, to be passed on in a later deal. They are goods and nothing more; the one accepted most widely is the island's nearest thing to money before silver | Agreed, 10 Nov |
| What may be exchanged for what | Goods fall into three classes: food; animals, cloth and labour; land. Everything keeps a worth in rations, the one unit of account, and custom says which exchanges across classes are proper: within a class a swap is ordinary; grain for a cow in a good year is admired; a cow taken for grain in a dearth is allowed, and remembered as a hard bargain (target-v2, section 5.4); land is not offered at a fair at all, until slice 5's custom "Debts are paid with" allows it | Decided, 10 Nov (classes); Agreed, 10 Nov (the rules) |
| A small fair is the right result | Households that feed themselves and owe nothing bring only their margin. The fair grows when villages differ (Goods of place), when households owe (slice 5) and when they are taxed (slice 8); it is not tuned to move much grain before then | Proposed |
| Cost | Proposals in seeded order, each pawn to its partners first and then to a few others present, a fixed number a pawn: the work grows with those at the fair, not with their pairs | Proposed |

## 10. Customs and culture

One culture holds a single set of customs with a default when generated; members' attitudes drift every game day, villages change their practice only at a yearly meeting, and remote villages can drift off into new cultures. (Decided)

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

### Practice, norm and doctrine (to be written with slices 4, 5 and 8)

| Aspect | Design | Status |
| --- | --- | --- |
| Kinds of custom | Practice (a shared rule with options: today's customs), norm (a usual quantity learned from what people do, such as what a cow is worth), doctrine (an institution's rule on the keys it claims), and each culture's distribution of personal values | Proposed (target-v2, section 4.4) |
| Who holds values | Individuals, institutions (the Church) and social bodies (a village, a city, a court) | Decided, 3 Nov (Kim's description) |
| Doctrine against practice | A resolver tips practice to doctrine at some point; while a key is contested, attitudes change fast, and a splinter faction of the Church may form | Decided, 3 Nov |
| New customs | About ten new practices and four norms arrive with the slices that need them, each read through one door | Proposed (target-v2, section 4.4) |

## 11. Settlements, towns and regions

### Settlements and look

Villages are clusters of farmsteads around a green with a well sweep, fenced together; the buildings follow medieval Swedish practice rather than later Falu red farmhouses.

| Aspect | Design | Status |
| --- | --- | --- |
| Village | Farmsteads around a green with a well sweep (*brunnsvinge*); the infield fenced by a roundpole fence; a commons wood nearby | Decided (look), Agreed (layout) |
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
- **Varied forms:** irregular cluster villages (*klungbyar*), the most common form in medieval Sweden; row villages (*radbyar*) along a lane or a shore, as in the regulated villages of the plains (*solskifte*, in the provincial laws from the 13th century); and lone farms (*ensamgårdar*). Farms differ in age, size and number of buildings.
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
| How a village comes to host | At its autumn meeting a village with a green may offer to host; at the same meeting every village chooses the gathering it will attend that winter, a few days later, by its pull: nearness in travel hours, nearness in customs (hard customs count most), kin living in the villages that go there, the host holders' prestige and how last year's went and the disposition between the two villages (below). A village attends one gathering. A gathering that fewer than three villages choose is not held, and its villages choose again; a lone village far from any has none | Agreed, 10 Nov |
| Who gathers | Villages within a day's walk of the host (about 30 walking steps, or a boat crossing of the same cost: the question of boats is in VB-183), and close enough in customs to wish to: a village that has split from a culture (Meetings, culture and splits) is not drawn to its old gathering | Decided, 10 Nov (near and like-minded); Proposed (measures) |
| When | After the harvest (Kim, 10 Nov: days 6 to 8 of autumn are the middle of it). Fields sown in spring ripen from autumn day 3 to 12 and are then dried and threshed, so the first days free of it are winter days 1 to 3: the grain is in, the autumn slaughter is done (the count is on autumn day 8) and the animals stand in the byre, the first snow lies from day 2. It comes after the village meetings (autumn day 10) and the moving round (day 11), so each village goes to the gathering it chose at its meeting a few days before, and a border claim raised at a meeting is heard the same year | Decided, 10 Nov (after the harvest); Proposed (the days) |
| Going there | Pawns prepare and travel in person. The household plans it as an occasion (a kind of plan, Work): it chooses who goes, packs provisions for the days away and what it means to exchange, as loads (a back load, or a cart with oxen), and those who go walk there and back; those who stay keep the animals and the fire | Decided, 10 Nov (prepare and travel); Proposed (details) |
| Who goes | From each household: its holder or spokesman; its unmarried of marrying age; anyone party to a dispute; others as hands for the loads and by their own wish (sociability, until traits a stand-in). Never everyone: at least one adult stays | Proposed |
| Customs drawn together | Those present meet (encounters at a venue), and attitudes move by contact as they do within a village, so villages that gather drift toward each other and away from those that gather elsewhere. The culture's reckoning counts a gathering's villages as tied to each other; a culture that fills more than one gathering is a candidate to split along them | Decided, 10 Nov (the purpose); Proposed (the mechanism) |
| Marriages between villages | The gathering is where households of different villages can make a match: spokesmen (Inheritance, Marriage as a negotiation) negotiate there, and the round's matcher may pair pawns of different villages only if both were at the same gathering within the last few years. A match agreed there is concluded there, by the same acts the moving round uses, since the round is past (Proposed). Courting across villages starts there too, once courting exists. A first version (Kim, 10 Nov): it is to be revamped when the negotiation weighs terms such as the dowry (Marriage as a negotiation, Terms; VB-233) | Decided, 10 Nov (the purpose); Agreed as a first version, 10 Nov (the rule) |
| Borders | A dispute between two villages over a tile (Land, Infield, outland and wilderness) is brought to the gathering both attend and decided by the holders present from the other villages, under the Disputed claims custom of the gathering's villages; the cairns are raised after it. Two villages of different gatherings, or of none, settle it as now | Decided, 10 Nov (resolved at the gathering); Agreed, 10 Nov (who decides) |
| Disposition between villages | That others judge a border implies that villages stand in some relation to each other. It is read, never stored: the opinions and goodwill balances that the holders of one village already hold toward the holders of another (each pawn's counterparts are capped, so the reading is bounded), with the border grudges of 1 Nov among them. It leans a judge toward one party, weighs in a village's choice of gathering, and moves with what happens at one: a case lost, a match made, a fair deal or a hard one | Agreed, 10 Nov |
| The peace of the gathering | For its days no one presses a grudge: the host village's holders keep the peace and hear a quarrel over a deal on the spot. A breach is an event of the record, told in every village that was there | Proposed |
| What the host gains | Prestige for the host village's holders, and for the one who presides most, by the ale they pour (Goods, What each good is for); the trade nearest home; later, when there are obligations, a due from those who trade (slice 5 or 8). This is why villages compete, and the first step of the alderman's road (target-v2, section 7.1) | Proposed |
| The district | The villages of one gathering are a district (*bygd*, later *härad*): the first unit above the village, read from where villages go, never stored apart from that choice | Proposed |
| What the player sees | Households packing the day before; lines of walkers and carts on the paths to the host village; the green full for three days, with loads and animals set out; a report in the log (who came, what was settled, matches made, what changed hands). The player's pawn goes or stays by the player's choice and takes part in person: deals, a match for a child, a voice in a border case | Proposed |
| Cost | One choice a village a year; walking by a few pawns a household for a day each way, less than the moving round; encounters only among those on the green, with a cap a pawn; the gathering's days are entries in the due-queue | Proposed |

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
| Strata | 600 farming, 325 in towns and specialised work, 75 elite, per 1,000, at the end game; open to challenge. Proposed reading: a band for a developed island, not a quota, with strata counted by relation to production, not residence | Decided (the target), Proposed (the reading) |
| Bands | Full-simulation bands are reported nightly and never fail; reduced scenarios (a tiny map, a few years) are asserted and may fail outside their band | Decided, 3 Nov |
| Loops | About twenty loops, each declared with its stock, probe, setpoints and bands, calibrated fast loops first | Proposed (target-v2, section 6) |

## 14. Starting scenarios

There are several starting scenarios; the base and default one is the 10 founders, and unless a scenario says otherwise it starts with as few fields and meadows already made as possible, so the first year goes to making them. (Decided)

| Scenario | Start | Purpose | Status |
| --- | --- | --- | --- |
| Founders (base, default) | 10 unrelated founders: four couples, a farmhand and a maid; houses already standing, next to no fields or meadows made; a year's food and seed brought along; the land mass it needs scales with the map size. The marriage limit starts at “first cousins or further”, since the founders' grandchildren are mostly cousins | The normal game | Decided |
| Heirs and empty farms | Two established villages, three generations, adult heirs and younger siblings, an empty farm and a ruin | Exploring inheritance, expansion and customs | Decided |
| Populous Villages | Only villages, in three sizes: small 2–5 farms (about 60% of villages), medium 6–10 (about 30%), large 12–16 (about 10%). Households of 4–9 people, about 6: a couple, their children, sometimes a servant; children 2–3 years apart, the eldest up to 26, so about a third of households have a child of 18 or more (backlog VB-081; Agreed, 30 Oct). At most two generations made, no grandparents on record. 130–170 people on Tiny, 320–380 on Small, 800–950 on Medium and Large | A high population from the start | Decided (scenario, population), Agreed (village and household sizes) |

All scenarios build their villages and households through the same generators; a scenario only chooses what to build and where (Decided).

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
| Saving | Saves in the browser, in slots, and saving to and loading from a file. Each archipelago (scenario, seed and size) has one auto slot, written when the page is hidden, and three slots written by hand; a slot is overwritten in place and no other history of saves is kept. The auto slot is written at each moving round as well once a save at the late reference takes under 0.5 s (backlog VB-214, VB-215). The page opens on a landing page with New archipelago (the generation screen) and Load archipelago (the Saves overlay, apart from the menu and the generation screen); from a running game the menu's Main menu leads there, and the game stays, paused, until another is generated or loaded (Back to game). An archipelago's saves can be deleted at once; a loaded file starts playing and takes no slot until it is saved. Each save names the build that made it: a save from any other build is refused with a message, and the page makes it easy to delete it and start a new game. Within one build the world is regenerated from the save's seed and size, exactly, with the tiles the simulation changed saved | Agreed, 30 Oct; revised 7 and 8 Nov (Kim: the build named, the world regenerated within a build, autosave at the round once a save is under 0.5 s) and 10 Nov (Kim: slots in place of the last 3, the Saves overlay, the landing page, deleting an archipelago's saves) (was, Decided 30 Oct: autosave at each moving round; the whole world saved, not regenerated from its seed) |
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
| Marriage | The player has a say: a marriage is a negotiation between two households, and the player answers for its pawn, and as head for its household's members (Inheritance, Marriage as a negotiation; backlog VB-233) | Decided, 9 Nov (was, Decided 8 Nov: no say until courting, slice 7; the round matches the player's pawn as it matches anyone); how, Agreed 9 Nov (VB-233) |
| As head of the household | The player directs the household directly, as its holder would but by choice: it places the next field, meadow or building to be made, within the rules that bind any holder (claims, the farm's block of fields), and sets the season's work. Slice 3's plan (VB-164) designs it with the holder's plan | Decided (the principle), 9 Nov; how, to be written (slice 3) |
| Skip to the next event | The game is long, so the player may run ahead until something happens that concerns its pawn, and the page then pauses there, with the camera on what happened and a line saying why. It runs at the uncapped speed until an event that concerns the played pawn, its household or its line (a birth, marriage or death; a farm inherited, emptied or claimed; hunger in the household; a change of practice in its village), a question that waits for the player's answer, a refused command, an empty queue with the automatic behaviour off, or the eve of the moving round, so never longer than a year (backlog VB-234) | Decided (the principle), 9 Nov; Agreed (what stops it, the pause, the limit), 9 Nov |
| The chronicle | A History of each pawn, household, farm and village, read from the record of events, is built with slice 2 and apart from ambitions: it is the game's memory, and what the player reads its line's story in. A History tab in the pawn, household and village panels, newest first and filtered by kind; a farm's history follows the farm across households; the village log becomes a view of the same record (backlog VB-099) | Decided, 9 Nov (was: postponed with ambitions, 8 Nov); Agreed (the tab), 9 Nov |
| After a death | The page pauses and offers the successors of Which pawn (Vision and scope), the heir first; the world does not wait for the choice. A break in the line, when none is left, is recorded | Proposed (VB-079) |
| What the player sees | The pawn panel, while it plays a pawn: its hunger and health, its household's food in days of need and its firewood, what it is doing, the queue (each command can be removed), the automatic switch, the last refused command and why, what it may do here, and its cause with how the village leaned on it at the last meeting. A Follow switch keeps the camera on the pawn | Proposed (VB-079) |

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
- [ ] What hunger does: weakness, sickness, death, leaving. Decided: it can kill, mostly infants and the old, slows work, and postpones marriages and births, and who eats first is a custom; sickness and leaving still open.
- [x] Faster speeds or skipping nights, given that a generation takes hours of play. A slow game is intended: 40 hours or more to full population is fine (Decided), so growth no longer forces this. Decided (30 Oct): 30× and uncapped speeds, running in the background, and short nights with less sleep; nights are not skipped (backlog VB-084, VB-105).
- [ ] Cities: how they arise and how much faster they change customs.
- [ ] Trade and money.
- [x] Seasons on the map, such as snow in winter. Seasons with temperature, a day and night cycle, and wind and rain are Decided (30 Oct). Agreed (30 Oct): seasonal tints and snow on fixed dates first (backlog VB-083), following temperature once a temperature model exists (see Weather, seasons and daylight).
- [x] Rivers, which water mills need; the world does not generate them yet. Decided (30 Oct): the world has rivers; their courses are Proposed.
- [ ] How strongly weather acts on work and yields, and whether weather differs between islands.
- [x] Whether rivers can be waded anywhere or only at fords, and when bridges come. Decided (30 Oct): only at fords or bridges; the rule is built (VB-112), building bridges is VB-115.
- [ ] Whether animals wear paths as people do. (The speed of each stage is Decided, 30 Oct.)
- [ ] What a more prestigious house brings its owner. Partly decided (10 Nov): a well-maintained house gives prestige up to a cap, and tar helps (Goods of place and side crafts); what a fancier house adds is still open.
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
- [ ] Bodies: one membership graph with rules per kind, or a domain per kind (slice 5; Kim asked to iterate first).
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
| 0.4 (markets review) | 10 November 2026 | Kim's answers to the markets review (`docs/review-markets.md`), ahead of slice 4's plan (VB-183): villages that are near and like-minded meet at a yearly gathering at a host village's centre, to hold their customs together, make marriages between villages and resolve border disputes, and the fair is held at it; pawns prepare and travel there in person; villages host and compete to host; villages differ in what their land lets them make, and there are more specialised jobs; the economy is barter until coin, and taxes drive the adoption of money. Written as section 11, The gathering and two rows of Towns and regions; section 9, The fair and the Money row; section 8, Goods of place and side crafts; with notes in sections 3, 6 (Borders, now Under revision) and 10. Everything beyond Kim's points is Proposed; what may be exchanged for what is Open. Kim's answers later the same day (`QUESTIONS.md`, VB-183): goods in three classes, with custom on exchanges across them; dried fish and tar first, and every good's worth grounded in a need or in standing (What each good is for); the hosting rule with its floor of three villages; a border case decided by the holders of the villages not party to it; the gathering rule for marriages as a first version, to be revamped with the dowry; keeping goods. Disposition between villages added as Proposed. Tasks VB-272 to VB-282. A third round the same day: side crafts and the disposition between villages Agreed; the gathering is after the harvest (winter days 1 to 3 Proposed), so after the meetings and the round; ale as slice 4's third good; a well-maintained house gives prestige up to a cap, which tar raises a little while slowing its decay; grain loans move to slice 5. Tasks VB-283 and VB-284 |
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
