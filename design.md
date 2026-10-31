# Village builder: game design snapshot v0.3

Oct 29, 2026 · @Kim

## Status of this snapshot

Version 0.3 records the game design as discussed up to 29 October 2026; it adds animals, fields and meadows as built land, and starting scenarios to version 0.2. It is a reference for later work, not the truth: where it and the game differ, either may be wrong, and any point can be reopened.

Each version is its own document and is left unchanged once a newer one exists: Village builder: game design snapshot v0.2, Village builder: game design snapshot v0.1.

Implementation details (rendering, code structure, performance) are left out, apart from the cost column of the Systems overview, which a review of 30 October 2026 added as a Proposed section. Numbers are design targets or starting values to tune, not fixed values.

| Label | Meaning |
| --- | --- |
| Decided | Stated by Kim |
| Agreed | Proposed in planning and accepted, or adopted without objection |
| Proposed | Suggested, not yet accepted |
| Open | Not decided |

## Vision and scope

A village builder on a generated hex archipelago, played at the level of individual pawns with family histories, for up to about 1,000 pawns.

| Aspect | Design | Status |
| --- | --- | --- |
| Genre | Village builder and colony simulation; pawns plan their own work | Decided |
| Population | Up to about 1,000 pawns; every pawn individually represented | Decided |
| Setting | Medieval Nordic peasant society, with inspiration from medieval Sweden | Decided |
| Look | Naturalistic, painterly hex terrain; medieval Swedish farmsteads | Decided |
| Society | Families, inheritance and customs that shift over generations | Decided |
| Pace | A game about incremental progress; one run lasts 40–80 hours | Decided |
| Start | Several starting scenarios; by default the founders arrive to almost unprepared land and spend the first year making fields and meadows | Decided |
| Player role | The player follows a family line: they act through the head of the line as that pawn's source of commands, argue at the meeting with its prestige, and plan their household's land and work. When the head dies they continue with a relative, by blood or marriage; with none left, the run ends. The score is the line's prestige over time, shown in the chronicle, with optional ambitions (hold three farms, change a custom, found a village). The player should be able to influence the world a lot, through all the systems, the job system among them. Built after commands and saving (backlog VB-079) | Decided, 30 Oct |

## World and scale

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
| Walking and terrain | Routes and walking cost by terrain: meadow, heath, shore and fields 1, forest 1.5, hills and marsh 2, mountains 3, snowfields closed, in the current route search (backlog VB-096); routes over regions (HPA\*) only if routes then cost too much (VB-097) | Agreed, 30 Oct |
| Uses of regions | Overview, territory, simplified simulation off screen, hierarchical pathfinding for 1,000 pawns (HPA\*, Botea, Müller and Schaeffer 2004) | Agreed |

### Compression

- **Distance:** villages sit 13–15 tiles apart instead of a realistic 100–250 tiles (1–3 km).
- **Farmland:** a farm has 2–4 field tiles; a medieval household farmed about 12 ha, close to 1,000 hexes.
- **Rejected alternative:** a separate world map with local maps to enter (as in RimWorld or Dwarf Fortress). It only pays off with hundreds of settlements and breaks continuous scrolling.

### Sizing at 1,000 pawns

| Unit | Size | People |
| --- | --- | --- |
| Farm | 3–5 tiles: a house and 2–4 fields | One household, 4–5 people |
| Village of 5 farms | 20–30 tiles, with well, hall and lanes | About 25 |
| Town with a market | 35–40 tiles: about 11 houses, a 7-tile market, workshops, streets | About 50, fed by surrounding villages |
| Whole population | About 1,000 built tiles plus 4,000–5,000 of woodlots, pasture, quarries and fishing | About 1,000 in 220 households and 25–30 settlements |

Hay meadows (see Animals) add 2–3 tiles to a farm that keeps animals, private or shared; the figures above predate them and need revising (Open).

## Time and calendar

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
| Yearly round | Sowing in spring; haymaking in summer; harvest in early autumn; village meetings on autumn day 10; moving round on autumn day 11 | Agreed |
| Stall period | Animals stand in the byre from about autumn day 9 to spring day 6, 21 of 48 days (see Animals) | Agreed |
| Pace of play | A year takes about 38 minutes at 1× and about 4 at 10× | Agreed, trade-off noted |

**Growth and time conflict.** Frontier populations with open land grew close to 3% a year from births. From 10 to 1,000 takes about 150 years, 5–6 generations, or roughly 10 hours at 10×. The game is meant to be slow: 40 hours or more to reach full population is fine, with growth from births and, in a later stage, very limited immigration by boat (Decided).

**Run length.** A single run should last 40–80 hours (Decided). At about 38 minutes a year, 150 years is about 95 hours at 1×, so a run would mostly play between 1× and 3×.

## Weather, seasons and daylight

The map has a day and night cycle, seasons with a temperature, and simple weather with wind and rain patterns. (Decided, 30 Oct.) How they show on the map and act on the simulation is Proposed.

| Aspect | Design | Status |
| --- | --- | --- |
| Day and night | Light changes over the day: dawn, full day, dusk and night are visible on the map | Decided, 30 Oct |
| Weather | Simple weather with wind and rain patterns | Decided, 30 Oct |
| Seasons | Seasons with temperature | Decided, 30 Oct |
| Seasons on the map | Seasons show on the map: spring green, autumn colour, snow and ice in winter; on fixed dates first, then following temperature (see Settlements and look; backlog VB-083) | Agreed, 30 Oct |
| Determinism | Weather comes from the world's seed, so the same seed gives the same weather | Proposed |

### Daylight (Decided, 30 Oct; the look at night Proposed)

- **Night is short:** dark from 22:00 to 4:00 at the equinoxes, with 2 hours of dusk and dawn (see Time and calendar).
- **The seasons move it a little:** the dark part runs from about 4 hours at midsummer to 8 at midwinter, a mild echo of Sweden's light summer nights and long winter dark that keeps winter nights short.
- **At night** the land darkens and cools in tone but stays readable; hearths glow through doorways and smoke holes, and the few pawns still out carry their own light.

### Temperature (Proposed)

- **One curve for the year,** cold in winter and warm in summer, plus spells of a few days warmer or colder than usual; high ground is colder.
- **Below freezing,** snow lies on land and lakes ice over; the snow and the season's colours on the map follow temperature, not fixed dates.
- **Firewood use** follows the temperature instead of a fixed winter-to-summer ratio.
- **Spring work** waits for thawed ground, and growth starts with the warmth; a late frost or an early one in autumn is the frost risk of the farming year (see Goods and the farming year).

### Wind and rain (Proposed)

- **Wind** has a direction and a strength for the whole archipelago that change slowly, mostly from the south-west and west, as in Scandinavia.
- **Rain** comes in fronts: large soft areas, a few regions wide, that drift across the map with the wind, so it can rain on one island and be dry on the next.
- **Rain stops** haymaking and the carrying in of sheaves, which need dry weather, and slows field work; hay rained on while drying loses value.
- **Wind** turns the windmill only above a set strength, carries smoke and moves the trees.
- **The year's weather factor** (see Goods and the farming year) comes from the season's actual weather instead of a separate draw: a wet harvest or a dry early summer makes a poor year.
- **A game day stands for about a week,** so a day's weather reads as a week's weather.

## People, households and family records

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
| Courting | Unmarried pawns may court from 16; marriage stays at 18 for women and 20 for men, and still needs a place to live and kin no closer than the limit. Hunger of 0.5 or more postpones the marriage, not the courting. About 5% of births at first come while courting, and about 3 in 4 such couples marry within the year if they can. The true father is recorded and, for now, known to all | Decided (from 16; true father), Agreed (rest), 30 Oct |
| Pawn interactions | Pawns who meet (working near each other, at the well, on the green, at home) may interact, each pair at most once a game hour; the first kind is talk. A relationship holds familiarity (the tie), an opinion from −1 to 1 and a courting flag; kin links stay in the family records. Talk shows as a short bubble near the camera, and the pawn panel lists mood modifiers such as “talked with a friend +5” | Decided (talk first; mood shown), Agreed (rest), 30 Oct |
| Stats and traits | Come later | Decided |
| Inherited traits | Whether founders get hidden values that children inherit (parents' average plus noise) | Open |
| Family tree | Generations in rows, spouses linked, children under their parents; the dead greyed, heirs marked; father, mother, spouse with kinship, children, siblings and life events per person | Decided (a view), Agreed (content) |

## Economy and jobs

Jobs come from things that need doing (a field, a meadow, a herd, a household, a fence), each with an owner that decides who may take it; pawns pick by role, matched best fit first.

### Goods and the farming year

| Aspect | Design | Status |
| --- | --- | --- |
| Food | Grain counted in rations: one adult's food for one day; a child eats half; milk, butter and meat add to them (see Animals) | Agreed |
| Fuel | Firewood in loads; winter use about five times summer (1.6 against 0.3 loads a day) | Agreed |
| Built land | Fields and meadows have to be made by work before they produce; either can be private or common | Decided |
| Making a field | Claim the tile, clear scrub and stones (many stones make it slow, and the stones become building material), then break the ground. A household starts one field at a time when it needs more (2–4 per farm); the people who till do the work; a typical meadow tile takes about 50 work hours (scrub 10, stones up to 20, breaking 30). A farm's fields lie together as one contiguous block within 4 steps of the house, not necessarily next to it, in every scenario; a new field joins the block where a free tile touches it (backlog VB-109) | Decided, Agreed (hours); Decided (block), 30 Oct |
| Field cycle | Stubble, tilled over several days, sown, sprouting, growing with light upkeep, ripe, reaped into stooks, dried, threshed, grain stored | Decided (long work), Agreed (stages) |
| Seed | Sowing costs a quarter of the expected harvest, a 4:1 yield ratio as Slicher van Bath (1963) reports for medieval Europe; a household keeps back seed for all its fields before it eats | Agreed |
| Field yield | Before animals, a meadow field gives about 100 rations in an ordinary year, less 25 of seed, so 3 fields give about 218 and 4 about 290 and a family of 6 is fed from its own fields; populous households of 7 or more get a fourth field. Retuned when milk and meat arrive (backlog VB-080, VB-048) | Decided, 30 Oct |
| Meals | A household keeps a store of rations, cooked from grain (later from flour); each afternoon the cook makes the next day's food, and may leave other work after 14:00 to do it; households start with 2 days of rations, so one missed cooking uses the buffer, not a hungry day | Decided, 30 Oct |
| Food from the wild | Fishing in rivers, lakes and the sea from spring to autumn, and gathering berries, mushrooms and nuts in the woods in late summer and autumn. Both are always posted, with an urgency that is low while the household has food and high when it runs short, so they fill slack hours and answer a lean summer; each water or wood tile holds a stock that use lowers and time restores (backlog VB-117, VB-118) | Decided (by urgency), Proposed (numbers), 30 Oct |
| Mixed meals | A day's meal drawn from 2 food sources needs 10% less food, from 3 or more 20% less; grain or flour, fish and gathered food are sources now, milk and meat with the animals. Fresh fish and gathered food are eaten first and spoil after 3 game days; drying and salting come later. Built with hand-quern milling (backlog VB-119, VB-009) | Decided, Agreed (numbers), 30 Oct |
| Help in hunger | A hungry household asks its kin, then the village store. Each adult keeps a buffer of 20–60 days' food (drawn per pawn) before giving. The village store is filled with 25% of each household's surplus at the moving round. Help is a gift, and it raises the tie between the households; loans come with money | Decided (the store), Agreed (rest), 30 Oct |
| Soil | Each harvest wears a field down; manure from the byre restores it | Agreed |
| Risk | Frost destroys whatever is left in the field; each year has a weather factor | Agreed |
| Yield over time | Yields rise slightly over the course of a game (better practice, tools and manuring); what drives the rise and by how much is open, and is tuned with the animals (backlog VB-048) | Decided (rise), Open (rate) |
| Tilling power | An ard drawn by a pair of oxen tills perhaps 2–3 times faster than a hoe | Agreed |

### Jobs, owners and roles

| Aspect | Design | Status |
| --- | --- | --- |
| Sources | Each field and meadow posts its stage's job; herds post herding, milking and feeding; households post firewood when low, water daily and cooking each afternoon; fences wear, faster in winter, and each stretch posts a mend job | Decided |
| Owners | Each job is owned by a household (its fields, meadows, herds, cooking, cooking) or a village (common fields and meadows, the village fence, also a one-farm village's fence); city commons later | Decided |
| Who may take a job | Members of the owning household, servants included, or adults of the owning village | Decided |
| Help between households | Adults of another household in the same village may help with a household's work, and the help builds the relationship between them; it is a gift, nothing is owed. Starting values: field, threshing and fence work that has waited 2 hours, by helpers with no work of their own; near kin and friends first (backlog VB-106) | Decided (help, relationships), Agreed (rules), 30 Oct |
| Commons | Village well, green, commons wood (*allmänning*), common fields and meadows, and the infield's roundpole fence (*gärdesgård*), kept by the village as medieval provincial laws such as Upplandslagen (1296) required | Decided (common land), Agreed (the rest) |
| Role priorities | Each role ranks job kinds; farmers favour fields, firewood and fences; the mistress of the house and maids favour water, cooking and milking; children fetch water, weed, help at the harvest and herd | Decided (by role, children's work), Agreed (rankings) |
| Types of work | Roles rank types of work (tilling, tending, harvest, threshing, wood, upkeep, household; more as kinds arrive) rather than each job kind, with exceptions for single kinds where a role differs; a new kind of an existing type needs no new rankings, and types are the natural unit for the player's steering later (backlog VB-116) | Agreed, 30 Oct |
| Matching | Idle pawns and open jobs are matched best fit first; a poor fit only takes a job that has waited two hours | Agreed |
| Work beats idling | A pawn takes any allowed job that suits its role rather than stand idle, however far or low in urgency, so every posted job gets done; firewood for the winter is laid in from summer (backlog VB-103) | Agreed, 30 Oct |
| Several hands | The whole household can take part in field, land and threshing work at once (tilling, sowing, weeding, reaping, carrying sheaves, threshing, clearing, breaking), ordered by role priority, each hand at full rate; cooking, water, firewood and mending take one pawn each (backlog VB-102) | Decided, 30 Oct |
| More urgent work | A pawn at work leaves its job, which keeps its progress, when another is much more urgent: checked each hour, at most one switch an hour, not while walking or carrying, never for a job finished within the hour; much more urgent is a bid above 1.5 times the current job's plus 1. So a farmer keeps hoeing when the woodpile runs low and a son or farmhand goes for wood. The cook's call after 14:00 stays its own rule (backlog VB-107; see Multi-day jobs) | Agreed, 30 Oct |
| How busy | The village is busy at the peaks, sowing and harvest (75–90% of adults' work hours), and partly idle in the slack seasons (40–60%); the new jobs are tuned against this, and spare time goes to talk once pawns talk (backlog VB-061). Measured on 30 Oct: 55–79% idle across the year (`REVIEW.md`, Work and jobs, second pass) | Decided, 30 Oct |
| Village work days | The meeting sets days on which the whole village works together: closing the infield fence before the animals go out, clearing the commons; a household that does not turn up loses standing (backlog VB-120) | Decided (work days), Proposed (rules) |
| Winter crafts | In winter men make and mend tools and cut fence poles indoors and in the woods (*slöjd*); field work wears tools and worn tools slow it; fences are mended with poles (backlog VB-121) | Decided (crafts), Proposed (numbers) |
| Player steering | The player can steer the job system, as part of influencing the world through all the systems; it comes after the player's role is settled | Decided (later), 30 Oct |
| Sowing first | A hoed field is sown before the next field is hoed, so a small household brings in some crop | Decided, 30 Oct |
| Multi-step jobs | Walk to the site, work, carry the load home (sheaves to the barn, hay to the hay barn, wood to the woodpile, water indoors) | Agreed |

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

- Grain still lacks outlets beyond feed and seed: storage losses, tithes or trade are needed.
- Hunger now has consequences (backlog VB-028): it can kill, mostly infants and the old, slows work, and postpones marriages and births; who eats first when food is short is a custom (Decided). Starting values: a year of hunger about doubles deaths, mostly infants and the old; work slows by up to 40%; marriages wait while hunger is at half or more (Agreed). Health (see People) adds a starving pawn's death within a season.
- A grown family eats more than 3–4 fields give after seed; see Systems overview, Food balance (Proposed).
- Money only makes sense once towns and markets exist.

## Land and ecology

Tiles carry their own state (trees, stones, grazing), and work, grazing or neglect moves them from one kind of land to another.

| Aspect | Design | Status |
| --- | --- | --- |
| Trees per tile | Each wooded tile holds a sensible number of trees, at full cover about 60 broadleaf or 80 pine (±20% per tile); cutting fells them one by one, one per firewood trip. A partly felled tile grows back to full in about 30 game years, by one growth model for all trees | Decided |
| Showing trees | Not every tree is drawn: a tile shows stages for about 100%, 75%, 50% and 25% of its trees remaining | Decided |
| Cleared woodland | At 0% trees the tile becomes meadow; regrowth applies only to tiles that still have trees | Decided |
| Stones | Meadow tiles track their stone content: every untouched meadow tile has some, and tiles near hills have more, the extra fading to nothing within about 2 tiles | Decided |
| Meadow to field | Breaking ground takes long where stones are many; the stones cleared become building material | Decided |
| Abandoned fields | An untended field becomes a stone-free meadow | Decided |
| Forest spread | Forest turns nearby meadow, and fields by way of meadow, into scrub and then woodland, unless grazing or farming keeps the land open. Built after grazing pressure: open land next to forest reaches scrub in 8 years and forest in 30; a field in use, a house, a green, a meadow mown that year, work in the last year or enough grazing keep it open; heath closes like meadow (backlog VB-091) | Decided; Agreed (rates), 30 Oct |
| Grazing | Herds of wild and domestic animals graze, and grazing pressure shapes the land (see Animals) | Decided |
| Worn paths | Where pawns walk often, trodden paths show in the world; a path speeds up walking, so routes prefer existing paths and pawns come to share them | Decided, 30 Oct |

### Making a hay meadow

A hay meadow is built land: it has to be found, claimed and prepared before it yields hay, and it can be private or common. (Decided; the steps are Agreed)

1. **Find a suitable tile:** open grass, a shore, or damp ground where hay grows well; northern Swedish farms also mowed mires and lakeshores.
2. **Claim it** as a tile claim, for the household or for the village.
3. **Clear it** of scrub and the worst stones, which takes longer on stony ground.
4. **Fence it into the infield** where animals graze nearby.
5. **Each spring, rake it clean** of twigs, leaves and fallen branches before the summer mowing (*fagning*).

After mowing, herds may graze the regrowth (*efterbete*). A meadow left unmown and ungrazed falls under the forest-spread rule.

### Worn paths

Paths are not built; they are worn into the land by people and animals walking. (Decided, 30 Oct; the speeds Decided; the counts, stages, fading and snow Agreed, 30 Oct; the rest Proposed.) Built in two steps: drawn first (backlog VB-094), then the faster walking and routes that prefer paths (VB-110), after terrain costs (VB-096).

1. **Each crossing counts:** every tile keeps a count of the pawns and animals that cross it, halving each game year so unused paths fade.
2. **Three stages:** trodden ground at a count of 50, a path at 200, a lane at 800, about 1, 4 and 16 crossings a day kept up.
3. **Faster walking:** walking is 5% faster on trodden ground, 15% on a path and 30% on a lane than on the bare terrain, so paths draw routes without lanes ruling all travel.
4. **Sharing paths:** route-finding counts the faster walking, so a pawn takes a path when it is quicker even if it is longer; routes merge, and the merged path wears deeper. Lanes form between farms, the well, the fields and the commons wood, as desire paths do.
5. **Land kept open:** grass does not grow back on a path, and forest does not spread onto one while it is used.
6. **Under snow,** lanes stay visible as trodden snow; paths and trodden ground are covered.

Villages had a village street (*bygata*) and fenced cattle lanes (*fägator*) that led the herds through the infield to the outland pastures; in the game such lanes are worn by use, not laid out.

### Grazing at low cost (Agreed, see Animals)

- **Herds, not individuals:** animals live as herds with a species, a count and a home range.
- **One number per tile:** grazing pressure, updated once a game day from the herds whose ranges cover the tile; about 56,000 values, a negligible cost.
- **Pressure feeds forest spread:** it decides whether meadow near woodland stays open, and heavy grazing thins it.
- **Near the camera:** each herd shows a handful of animal sprites wandering inside its range; the same few stand for the whole herd.
- **Farther out:** grazing shows only in the painted ground as shorter, browner grass, repainted for an area only when its pressure has changed enough.
- **Individuals where the story needs them:** a farm's pair of oxen; hunting and herding otherwise act on the herd.

## Animals

Hay sets how many animals a household can winter, and the animals give milk, meat, wool, draught and manure; the first version has cattle, sheep and one wild grazer, and a hard winter limit. (Decided: species, wild grazers only, hard limit. Mechanics: Agreed)

The old Swedish saying *äng är åkers moder*, “the meadow is the mother of the field”, sums up the loop: meadow hay fed the animals through winter and their manure fed the fields. Myrdal's volume on medieval farming in *Det svenska jordbrukets historia* (1999) describes it, with the fenced infield of fields and meadows and the open outfield where animals grazed in summer.

### Herds

| Herd | Made of | Gives | Needs | Status |
| --- | --- | --- | --- | --- |
| Cattle | Cows, a pair of oxen, young stock | Milk in summer (butter keeps for winter), calves in spring, meat at slaughter, manure, draught | Byre (*fähus*) space; about 1 hay unit per cow per stall day | Decided (species), Agreed (rest) |
| Sheep | Ewes, rams, lambs | Wool, lambs, meat, manure | About 0.2 hay units per head per stall day; graze heath and hills that cattle do poorly on | Decided (species), Agreed (rest) |
| Wild grazers | One species to start: roe deer, with elk perhaps later | Meat and hides when hunted | Forest edges and meadows; can damage crops | Decided (wild grazers only; roe deer, 30 Oct) |

- **Ownership:** each household owns its cattle herd and its sheep flock as two herds; only the oxen pair are individuals, since a job needs them.
- **The founders' herds:** not every farm keeps animals; at least one farm keeps a bull, since oxen are castrated, and at least one keeps a ram; a farm with sheep keeps 4 ewes (Decided, 30 Oct). Three of the four founders farms keep cattle (2 cows each, the first also a bull) and two keep sheep (4 ewes each, the first also a ram); one keeps neither. One pair of oxen in the group, at the bull's farm; the others hoe until they raise oxen from bull calves (Agreed, 30 Oct).
- **Food from animals:** a cow in milk gives 0.5 rations a day in summer, part of it kept as butter for winter (Agreed). Slaughter gives meat, a cow 40 rations' worth and a sheep 8, which a household job processes into rations that keep; stored rations spoil after a year (Decided, 30 Oct).
- **The byre** holds 6 cattle at first and is enlarged later by a building job (Agreed, 30 Oct).
- **Numbers** are starting values to tune.

### The year

- **Spring:** turn the herds out around spring day 6, cart the winter's manure to the fields, till with the oxen.
- **Summer:** daily herding and milking; haymaking as the main work.
- **Autumn:** after harvest, the household decides how many animals to keep against its stored hay; the rest are slaughtered for salted meat.
- **Winter:** daily feeding and mucking out in the byre, from about autumn day 9 to spring day 6, 21 of 48 days.

### Hay and the hard winter limit

- **Stored hay** is counted daily against the animals in the byre. (Decided)
- **When hay runs out,** the household slaughters in an emergency for lean meat; if nobody acts, animals die and give nothing. (Decided)
- **Hay comes from meadows** the household has made and claimed, and its share of common meadows (see Land and ecology). A meadow tile might yield about 30 hay units, enough for 1–1.5 cows over winter.
- **The first winter** of a new settlement needs a hay stock brought along, or the founders' animals die in their first season.

### Ties to existing systems

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

### Cost

About 440 domestic herds and up to 100 wild ones at full scale; daily grazing updates come to roughly 22,000 tile updates, and only a few dozen sprites are drawn near the camera.

### Later

Predators, pigs, horses, poultry, disease, breeding and traits, summer farms (*fäbod*), and leaf fodder from pollarded trees, which would tie trees per tile to the hay economy.

## Settlements and look

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

### Generated villages (Proposed)

- **Grown, not stamped:** the generator grows each village farm by farm by the rules of play: a household builds where a household in play would, takes fields near its house, and the village lays out a green and digs a well once it has two farms. A generated village and one grown over a run then look alike.
- **Worn in:** after the farms stand, the generator walks a few simulated years of daily trips (fields, well, wood, the neighbours) so the village starts with its paths and lanes.
- **Varied forms:** irregular cluster villages (*klungbyar*), the most common form in medieval Sweden; row villages (*radbyar*) along a lane or a shore, as in the regulated villages of the plains (*solskifte*, in the provincial laws from the 13th century); and lone farms (*ensamgårdar*). Farms differ in age, size and number of buildings.
- **Fitted to the land:** villages follow shores, slopes, rivers and the edge of the forest, and avoid stony and wet ground for houses.

## Customs and culture

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

### Pace

All customs change on the scale of generations; concentrated effort can do it within one; villages are stable and larger cultures slower (Decided). Current calibration, one generation taken as 30 years:

| Test | Easiest custom | Middle | Hardest |
| --- | --- | --- | --- |
| Natural drift, 300 people | About 3 generations | 4.6–5.7 generations | None within 200 years |
| A coalition with 20% of the voice | 1.1 generations | 1.4–1.7 generations | 2.1 generations |

A village with a 10% tie forms local practice after about 1.5 generations, against 2.1 for a 60% tie. Cultures of 100, 300 and 1,000 people first change in about 2.2, 2.8 and over 6.7 generations.

## Inheritance and expansion

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

- **The moving round** follows the meetings each autumn: handovers and a fresh count of who wants to move out. Marriages come mostly from courting, at any time of year; the yearly matchmaking stays at the moving round for pawns who are not courting, as arranged marriages (Decided, 30 Oct; it was to be replaced by courting).
- **Marriage** comes from courting, at any time of year (Decided). It needs a place to live under the residence custom, and kin no closer than the custom's limit, by civil degree. Matches favour the same village and an age gap of about 3 years.
- **Wants to move out:** an adult of 18 or more with no farm, no spouse with a farm, and no place in line for one.
- **Service:** a landless adult may take service where labour is short: below 1 hand (members 14–59, not retired) per field. At the moving round unmarried landless adults from households above 1.5 hands per field go, oldest first, to the shortest household of their village, else of the nearest village within 15 steps; board and lodging only (backlog VB-090; Agreed, 30 Oct).
- **A start in life:** a cow and a few ewes from the family's share give a new household its start.

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

## Claims, ownership and territory

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

### One scope model for overlays, stores and trees (Agreed, 30 Oct)

- **A scope** is an entity level, the entities chosen, and a dimension (owns, claims, uses, works, is kin of). The same scope drives the ownership overlay, the store views and the family tree.
- **A membership graph** links the entities: pawn to household, household to village, village to culture; families cut across households. Each view asks the graph for the tiles, stores or people in scope.
- **Compact tile data:** one owner per tile, and claims as a short list per tile, since most tiles have none.
- **Cached overlay:** drawn per map chunk; when ownership or claims change, only the chunks they touch are redrawn.
- **Cheap filtering:** changing the filter recolours from the cached data; nothing is recomputed from the simulation.

## Starting scenarios

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

## Commands, time steps and views

Every actor, pawn or not, acts through one command system, so the player or a debug tool can take direct control without changing the systems underneath. (Decided; close to implementation, kept here because it shapes the design)

| Aspect | Design | Status |
| --- | --- | --- |
| Unified commands | Pawns act only by issuing commands; planning chooses them, the simulation carries them out | Decided |
| Direct control | For debugging, the player can be wired in as a pawn's source of commands, with no change to the systems below | Decided |
| Non-person entities | The same holds for entities such as the village's yearly meeting and herds: their decisions are commands too | Decided (meeting), Agreed (herds) |
| Simulation step | The simulation advances in steps of at most 6 minutes of game time | Decided |
| Clock and picture | Neither the clock nor the picture needs to move in lock-step with the simulation steps, but both stay in sync with it. The clock is UI state of its own, derived from simulation time and shown in steps of at most 5 game minutes; UI state and simulation state are not automatically the same | Decided |
| Store views | Resource stores can be inspected for every level and dimension of entity: pawn, family, household, village, city, culture and more. First version: households and villages, in a Stores panel with food in days of need, no history (backlog VB-092) | Decided; Agreed (first version), 30 Oct |
| Commands | A command is a record of actor, verb, target and arguments, issued by a source (the planner, the player, a debug tool, the meeting); the simulation carries out commands and nothing else. First verbs: work, walk to, go home, idle. The job matcher is the first source; the meeting, the moving round and debug actions follow; herds wait for the animals arch. "Take control" on the pawn panel lets the player choose a pawn's next command (backlog VB-076) | Agreed, 30 Oct |
| Saving | Autosave in the browser at each moving round and when the page is hidden, keeping the last 3, and saving to and loading from a file. The whole world is saved, not regenerated from its seed. A save from another build is refused with a message, and the page makes it easy to delete it and start a new game (backlog VB-077) | Agreed; Decided (whole world, old saves), 30 Oct |
| Performance budget | The simulation stays under 10% of real time at the fastest speed on populous medium, and no single step, meeting or moving round takes over 50 ms; the verify run checks it (backlog VB-088) | Agreed, 30 Oct |
| Family tree | Shows the genealogy of any such entity, from one pawn to a whole culture | Decided |
| Performance | The family tree view must stay fast | Decided (requirement), Open (how) |

The debug panel's actions (kill, retire, argue for a custom) would become commands as well (Proposed).

### Keeping the family tree fast (Proposed)

- **Draw only what is on screen**, and fold distant branches until opened.
- **Lay out incrementally:** a birth or a marriage moves only its own branch.
- **Filter first:** a village's tree starts from its living members and reaches a set number of generations up and down.
- **Cache kinship:** coefficients are kept per pair and recomputed only along new lines of descent.

## Systems overview (Proposed, review of 30 October 2026)

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
| Work: jobs, matching, walking | The visible life of the village | Reading a village at a glance; watching a family get through the harvest | Role-based work fits medieval practice; walking ignores terrain (mountains cost the same as meadow); adults stand idle for a third to four fifths of work hours while work waits, and children never work | The hot loop: every idle pawn bids for every job; index jobs by owner | Built; gaps planned (work arch, VB-101 to VB-108) |
| Fields, grain and food | The material base and its scarcity | The harvest as the year's climax; a lean spring as drama | Seed at 4:1 fits Slicher van Bath; a farm feeds about 3.5 adult-equivalents, against 5–6 historically | Negligible | Built, short of food (see below) |
| Forest, wood and stones | Fuel, building, land-making | The commons wood visibly shrinking is a readable tragedy of the commons | Good; regrowth over 30 years | Negligible | Built |
| Making land: fields, meadows, plots | Incremental progress, growth | The game's "build" verb: land won by work, tile by tile | Good; hours scaled from history | Small | Planned (VB-010, VB-031) |
| Animals and hay | The second economy, the winter limit | The autumn decision of how many animals to keep is a real choice under risk | *Äng är åkers moder*; good | About 22,000 tile updates a day; small | Planned (VB-047) |
| Households and family records | The cast and its stories | The core of the fantasy | GEDCOM-like; good | Queries scan all records today (VB-052) | Built |
| Births, deaths, health | The cast changes | Death and birth are the main events | Matched to model life tables | Small | Built; health planned (VB-050) |
| Pawn interactions and courting | Ties, marriages, persuasion | Romance and friendship are what players retell | Courting at any time of year; good | Pairs by map bucket (VB-061) | Planned |
| Inheritance and succession | Who gets the farm, who must leave | The strongest system today: every death reshuffles a family | Close to Northwestern European practice | Ranks heirs across all farms (VB-052) | Built |
| Expansion: claims, plots, splitting | The release valve; growth | Seeing a younger son found a farm is the payoff of a generation | Hajnal's pattern needs land to marry | Small | Planned; without it the population stays flat |
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
| Speech bubbles, mood | Feedback on social life | Makes ties visible | — | Near the camera only | Planned (VB-061, VB-062) |
| Notifications | Drawing the eye to an event | A death, a marriage or a custom change otherwise passes unseen | — | Small | Missing |
| Worn paths | Showing where people walk | Lanes appear between farms, well and woods over years | Desire paths are real | One counter per tile, repainted with the chunk | Missing (Decided, 30 Oct; see Land and ecology) |

### Across systems

**Food balance.** A ration is one adult's food for a day; a child under 14 eats half. A household of 6 eats 192 rations a year with four young children and 288 when they are all over 14. A meadow field gives about 80 × 0.97 ≈ 78 in an ordinary year, less 20 of seed. Three fields then give about 170 and four about 230, so a grown family goes hungry every year, and a household of 6 with three fields eats about 90% of its need while the children are small. In the populous scenario a quarter of household-days in year 2 are hungry. Animals are meant to fill the gap (VB-048), but they are the last arch to start. A balance that works before animals keeps every task in between from being judged on a hungry baseline.

**Growth.** Births are close to the targets, but marriages need a place and no new places appear, so the founders stay at 13–21 people for 50 years. Expansion matters more to the run than anything else on the backlog.

**Pace.** At 1× a year takes 38 minutes. A run of 40–80 hours plays mostly at 3× and 10×, so what the player sees at those speeds matters most: the harvest, the meeting, a birth, a death. Rare, legible events (a notification, a line in the chronicle, a meeting with its vote shown) carry the game between them.

**Cost.** At 10× a game day passes in 4.8 s. The simulation takes about 0.2 s a day at 818 pawns, about 4% of a core. The yearly rounds take 1.6–2.6 s in one frame and are seen as a freeze. A budget per system makes this testable: steady state under 10% of real time at the fastest speed, and no single step over 50 ms.

### Findings

1. **Expansion first.** Make land, claim farms, clear plots and build farmsteads before more social depth: growth is the spine of a run. (Backlog: VB-010, VB-033, VB-031, VB-032 at priority 1.)
2. **A food balance before animals.** Feed a household of 6 from 3–4 fields in an ordinary year, with a small surplus to carry a poor one; retune when animals arrive. (QUESTIONS.md.)
3. **A player role.** Proposal: the player follows one family line. They act through the head of the line as that pawn's source of commands (choose work, court, claim, argue at the meeting) and continue as the heir when the head dies. It uses the Decided command system and direct control, it gives inheritance and customs stakes, and it fits a run of several generations. (QUESTIONS.md.)
4. **Commands and save games before animals.** Herds act through commands (Agreed), and a run cannot last 40 hours without saves. Both are cheaper to build before more state exists.
5. **Make customs legible.** Show who argues for what, the vote at each meeting, and a pawn's attitudes in its panel; announce a change of practice as a notable event.
6. **A chronicle.** One typed, permanent record of events per pawn, household, farm and village, from which the log, the panels, notifications and the tests all read.
7. **Seasons on the map,** after the browser smoke test (VB-025) can catch drawing errors.
8. **A populous start with adult children,** so marriage and inheritance begin in year 1, not year 6.

## Open questions and proposals

The player's role is the largest open question; most proposals concern growth, the economy and keeping views fast.

### Open

- [x] The player's role, and whether and how the player influences customs. Decided: the player follows a family line and argues at the meeting through its head (30 Oct; see Vision and scope).
- [x] Births: fertility, child mortality, spacing of children. Decided: spacing by explicit pregnancy and nursing; starting targets for fertility and child mortality Agreed.
- [ ] Stats and traits, and whether children inherit them.
- [ ] A historical division of labour by sex, or free job assignment by role only.
- [ ] What hunger does: weakness, sickness, death, leaving. Decided: it can kill, mostly infants and the old, slows work, and postpones marriages and births, and who eats first is a custom; sickness and leaving still open.
- [x] Faster speeds or skipping nights, given that a generation takes hours of play. A slow game is intended: 40 hours or more to full population is fine (Decided), so growth no longer forces this. Decided (30 Oct): 30× and uncapped speeds, running in the background, and short nights with less sleep; nights are not skipped (backlog VB-084, VB-105).
- [ ] Cities: how they arise and how much faster they change customs.
- [ ] Trade and money.
- [x] Seasons on the map, such as snow in winter. Seasons with temperature, a day and night cycle, and wind and rain are Decided (30 Oct). Agreed (30 Oct): seasonal tints and snow on fixed dates first (backlog VB-083), following temperature once a temperature model exists (see Weather, seasons and daylight).
- [x] Rivers, which water mills need; the world does not generate them yet. Decided (30 Oct): the world has rivers; their courses are Proposed.
- [ ] How strongly weather acts on work and yields, and whether weather differs between islands.
- [ ] Whether rivers can be waded anywhere or only at fords, and when bridges come.
- [ ] Whether animals wear paths as people do. (The speed of each stage is Decided, 30 Oct.)
- [ ] What a more prestigious house brings its owner.
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
- [ ] Claims on empty farms and cleared plots as tile claims. New fields are claimed by tile (Decided, VB-010); claims on empty farms are not yet a task.
- [ ] The debug panel's actions as commands.
- [ ] New customs: grazing on the commons, hunting rights, sharing hay from common meadows.
- [ ] The founders' first year as sketched under Starting scenarios, with a year's food, seed and a winter's hay brought along. Standing houses, a year's food and seed, and making fields are Decided (VB-010); hay meadows, hay and animals are not yet tasks.

## Change log

| Version | Date | Change |
| --- | --- | --- |
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

Earlier versions: Village builder: game design snapshot v0.2, Village builder: game design snapshot v0.1.
