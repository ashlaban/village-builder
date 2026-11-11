# Backlog

Open tasks of the village builder. Each task's file, `backlog/VB-NNN.md`, holds its full description; the tables here are the overview.

Done tasks: [`BACKLOG_ARCHIVE.md`](BACKLOG_ARCHIVE.md) · Questions for Kim: [`QUESTIONS.md`](QUESTIONS.md) · Slices and their order: [`docs/roadmap.md`](docs/roadmap.md)

On this page: [Ready](#ready) · [Waiting for Kim](#waiting-for-kim) · [Blocked](#blocked) · [Archs](#archs) · [How this backlog works](#how-this-backlog-works)

## Ready

The order tasks are taken in, the first first (`node tools/backlog.js next`). Sorted by priority (1 first), then ID.

| ID | Name | Arch | Pri | Size | Summary |
|----|------|------|-----|------|---------|
| [VB-123](backlog/VB-123.md) | Project plans: steps, reservations and reconsideration | year | 2 | M | The land project, the plot and the restoration become one project plan in st.plans, whose steps reserve what they spend and are reviewed when impossible. |
| [VB-136](backlog/VB-136.md) | Herding and grazing pressure | year | 2 | M | A herder takes the herds to pasture; grazing pressure and cattle lanes; unherded herds in the crops. |
| [VB-187](backlog/VB-187.md) | The gossip experiment: stories against opinion averaging, in a reduced scenario | talk | 2 | M | Stories against opinion averaging in a reduced scenario: spread, distortion and forgetting, before stories are built. |
| [VB-241](backlog/VB-241.md) | Refactor: the calendar, one ordered table of what runs each step, hour, day, season and year | between | 2 | M | What runs when is spread over a dozen date tests in eight modules; gather it in one ordered table in sim/clock, with behaviour unchanged. |
| [VB-257](backlog/VB-257.md) | The meeting sets the village's routines, and a practice for when it does not | year | 2 | M | The yearly meeting chooses at most four routines from the village work available; the fence is the first; a practice says what follows no decision. |
| [VB-327](backlog/VB-327.md) | An empty woodpile: a cold house, poorer health and no cooking | - | 2 | M | A household that cannot feed its hearth is cold: its members lose health and, with VB-062, mood, and it cannot cook, so grain is eaten uncooked and feeds less. |
| [VB-333](backlog/VB-333.md) | The harvest is the year's peak: reaping 15 hours a field and threshing 20 | - | 2 | S | Reaping rises from 5 to 15 hours a field and threshing from 6 to 20, so grain takes a larger share of the year and the harvest, not the spring, is its crowded time. |
| [VB-335](backlog/VB-335.md) | Sheaves come home by the load: 30 rations on the back, 90 on a cart | - | 2 | S | A field's harvest is carried in loads of the one size the fair and journeys use, three or four trips a field on the back or one with a cart and oxen, in place of one armful for the whole field. |
| [VB-337](backlog/VB-337.md) | Review tools: a household's hours by job, and the stocks nothing reads | - | 2 | M | Two reports that the consistency reviews of 10 and 11 November had to build by hand: work and walking hours by job kind for each household and season, and for each stored quantity what makes it, what uses it, what reads it and what happens at none. |
| [VB-009](backlog/VB-009.md) | Hand-quern milling and making rations | mill | 3 | M | Grind grain to flour on a hand quern and cook rations from it. |
| [VB-045](backlog/VB-045.md) | Overlay cached per map chunk | debt | 3 | S | Draw the Land overlay per map chunk and redraw only the chunks of st.landDirty. |
| [VB-055](backlog/VB-055.md) | TypeScript: real modules, typed state, a formatter and measures of width: survey and tasks | yardstick | 3 | S | The checker sees little through VB[...]; plan the move to modules and TypeScript in three steps, with a formatter, and caps on exports and function length in place of the 400-line cap. |
| [VB-106](backlog/VB-106.md) | Neighbours help with each other's work, and it builds ties | year | 3 | M | Idle adults may take a waiting field job of another household in their village; help raises tie and opinion. |
| [VB-141](backlog/VB-141.md) | Plan: customs of the animals | debt | 3 | S | Commons grazing, hunting rights, common hay, winter keep, village herd. |
| [VB-144](backlog/VB-144.md) | Ewes' milk and wool | mill | 3 | S | Ewes milked until summer's end, as 13th-century husbandry counted them; wool for the winter crafts. |
| [VB-160](backlog/VB-160.md) | Plan: what raised yields over the centuries, and a model for it | animals | 3 | S | Survey the historical causes of rising grain yields, their size and timescale, and propose a model in which a gain follows a change in farming; no code. |
| [VB-180](backlog/VB-180.md) | Wrap-up: state ownership and boundaries | ownership | 3 | S | Rerun the map, see what fell, review the external stress tests against the code. |
| [VB-215](backlog/VB-215.md) | Autosave at the moving round, once a save takes under 0.5 s | life | 3 | S | The page autosaves after the round once a save at `medium-ref` is under 0.5 s in Chromium; Kim's "build now, round later". |
| [VB-228](backlog/VB-228.md) | Refactor: each domain registers its own verbs | - | 3 | M | Verbs are registered at load by the module that carries them out, as rules are; `sim/commands` imports no domain and `later()` goes. |
| [VB-231](backlog/VB-231.md) | Refactor: the customs in force, read from the kernel layer | - | 3 | M | A kernel-layer `inForce` is the one door to custom; the four modules that index practice arrays ask it, and `culture` stays the only writer. |
| [VB-236](backlog/VB-236.md) | The route cache is cleared when a tile's cost changes | yardstick | 3 | S | The nightly selective refresh of 30,000 cached routes costs as much as the searches it saves: clear the cache on a change and lower its bound. |
| [VB-239](backlog/VB-239.md) | Saves: derived state by one rule, no empty movements, old formats refused | - | 3 | M | Caches leave a save in three ways, 13% of ledger entries move nothing, and load carries seven migrations for saves nobody holds: one rule each, and format 2. |
| [VB-246](backlog/VB-246.md) | A benchmark that shows the three engine workarounds still pay | yardstick | 3 | S | Three places are shaped by how V8 stores objects and compiles loops, each by a comment and one old measurement; a benchmark in verify notices when one stops helping. |
| [VB-247](backlog/VB-247.md) | A job names its farm, field and meadow by id | - | 3 | M | Jobs hold the farmstead, field, meadow and fence objects themselves, which is why the save codec must find shared objects; hold ids, and the codec's sharing pass can go. |
| [VB-276](backlog/VB-276.md) | Marriage terms: a dowry and a morning gift, booked in customary worth | fair | 3 | M | With slice 4's goods and worth: a dowry from the bride's side counted against her share of the inheritance, a morning gift from the groom's side that is hers if widowed; the player as head proposes and answers terms. |
| [VB-300](backlog/VB-300.md) | Dried fish: a food that keeps, made where there is water to fish | fair | 3 | M | A village within reach of fishing water dries its catch as a side craft; dried fish keeps, counts as a source in the pot, and is what such a village brings to the fair. |
| [VB-310](backlog/VB-310.md) | Refactor: Obligations as a module, the heirs' shares its first kind | debt | 3 | M | One module holds every explicit claim in a due-queue; the shares owed move in unchanged, golden unchanged. |
| [VB-311](backlog/VB-311.md) | Land rights: own and use held apart, st.owner the user's cache | debt | 3 | M | A holding's owner and its user may differ; only holdings held apart are recorded; golden unchanged until a tenancy exists. |
| [VB-313](backlog/VB-313.md) | Refactor: Decisions as a module, the meeting's votes asked through it | debt | 3 | M | Questions, procedures and ballots in one module; the custom votes go through it unchanged; ballots and margins kept. |
| [VB-324](backlog/VB-324.md) | Measure VB-245 on the late saves: the bench and the bands | yardstick | 3 | S | VB-245's late-save numbers, never run: tools/bench.js at medium-y5 and medium-ref, tools/bands.js, populous seeds 11 and 42 at 15 years. |
| [VB-329](backlog/VB-329.md) | No pawn walks where there is no route: a job with no way by land is refused | - | 3 | S | A pawn bids for no job it has no route to; the straight walk over water stays only as a counted error that an invariant holds at 0. |
| [VB-330](backlog/VB-330.md) | A home that took in a spouse at the round gives no settlers' provisions in it | - | 3 | S | The grain a marriage was allowed on is not given away the same afternoon: provisions skip households that gained a spouse in this round. |
| [VB-334](backlog/VB-334.md) | Weeding in two rounds a crop, of 5 hours each | - | 3 | S | A growing field is weeded twice, 5 hours a round, in place of a round of 2 hours every 6 days: the same care for half the walking. |
| [VB-336](backlog/VB-336.md) | The ox team's advantage: an ard tills several times faster than a hoe | - | 3 | S | The team's rate at hoeing and breaking rises from 2.5 to 5, so that keeping two oxen through the winter pays. |
| [VB-360](backlog/VB-360.md) | Skills: learnt by doing, faster with aptitude, fading unused | mill | 3 | M | A skill a craft and pawn from 0 to 1: a novice works at 60% and a master at 130%; halfway in 400 hours; a tenth lost a year unused, read in closed form. |
| [VB-361](backlog/VB-361.md) | Facilities: a registry of built things, raised in stages | mill | 3 | M | st.facilities holds built things on sites with an owner, a kind, a condition and building stages that are plan steps; the bloomery, the loom's house, kilns and mills use it. |
| [VB-367](backlog/VB-367.md) | Peat: cut in summer and burnt in place of wood | mill | 3 | S | A household short of wood near a peat bog cuts peat in summer; dried, two loads burn as one of wood. |

## Waiting for Kim

Status `needs-review`: each file lists the questions Kim must answer first, and [`QUESTIONS.md`](QUESTIONS.md) gathers them with proposed answers.

| ID | Name | Arch | Pri | Size | Summary |
|----|------|------|-----|------|---------|
| [VB-023](backlog/VB-023.md) | Sowing first: the seasonal plan's order for field work | year | 2 | S | A hoed field is sown before the next is hoed, so small households bring in some crop. |
| [VB-119](backlog/VB-119.md) | Mixed meals go further, and fresh food spoils | year | 2 | M | A meal from 2 sources needs 10% less food, from 3 or more 20% less; fish and gathered food spoil after 3 days; with milling (VB-009). |

## Blocked

By arch, in the order of the Archs table, then priority and ID. Each waits for the tasks in its `Waits for:` line (or for Kim).

| ID | Name | Arch | Pri | Size | Waits for | Summary |
|----|------|------|-----|------|-----------|---------|
| [VB-225](backlog/VB-225.md) | The release and the orphan branch of the fixtures deleted | yardstick | 1 | S | Kim | Since VB-272 nothing reads the release fixtures or the orphan branch fixtures: Kim deletes both. |
| [VB-166](backlog/VB-166.md) | A frame-time budget for the page, in headless Chromium | yardstick | 3 | S | Kim | Measure the page's frame times in headless Chromium, so a costly drawing change is caught when it lands. |
| [VB-292](backlog/VB-292.md) | The player's journey: the played pawn may make a visit | life | 3 | S | VB-289 | Parity of command: the visit the round's unmatched men make is the player's to order, for its pawn or, as head, for an unmarried son: a verb, an opportunity and a line in the pawn panel, at the same costs. |
| [VB-058](backlog/VB-058.md) | The village green and well, built by the village | year | 2 | M | VB-257, VB-123 | A village that gains a second farm lays out a green and digs a well; they are not created automatically. |
| [VB-253](backlog/VB-253.md) | The player as head: every choice of the plan as a command | year | 2 | M | VB-123 | Verbs for a target, the tile of the next field or meadow, the season's order and the project, under the holder's checks; the holder's rule where none is made. |
| [VB-254](backlog/VB-254.md) | Foresight: stand-in traits, a head's horizon and its bias | year | 2 | M | VB-023 | A head plans from an estimate of its needs: wits, husbandry and years as head set the horizon and a persistent bias; the poorest tenth leave the template's order. |
| [VB-255](backlog/VB-255.md) | Projects: a head with a surplus takes one, by its values | year | 2 | M | VB-123, VB-254 | With targets met and hands and stores to spare, a head takes one project from the menu (more fields, a claim, a farm or cottage for the heir, a barn), weighted by ambition and generosity. |
| [VB-256](backlog/VB-256.md) | The plan panel: a holder's plan read and changed in the page | year | 2 | M | VB-253, VB-255 | The household panel shows routines and targets, next steps, the project, reservations and who holds which task; the player as head changes them. |
| [VB-309](backlog/VB-309.md) | Held by kin when nobody can come: the farm in trust, its owner unchanged | year | 2 | M | Kim | a household short of people that nobody can come to moves to its nearest kin household, which works its farm in trust until the holder can return |
| [VB-100](backlog/VB-100.md) | Common fields worked by the village | year | 3 | M | VB-257 | A village with an empty store makes a common field; its harvest fills the store. |
| [VB-108](backlog/VB-108.md) | Wrap-up: the household's year | year | 3 | S | VB-023, VB-058, VB-100, VB-106, VB-119, VB-120, VB-123, VB-136, VB-162, VB-253, VB-254, VB-255, VB-256, VB-309 | Check slice 3 with long runs at four seeds: work with a date done in time, households no hungrier, planning cheap early and late; idle share reported. |
| [VB-120](backlog/VB-120.md) | Village work days | year | 3 | M | VB-257 | The meeting sets days when the whole village mends the fence or clears the commons; staying away costs prestige. |
| [VB-162](backlog/VB-162.md) | A village overview: food, people, idle hands and warnings | year | 3 | M | VB-256 | One panel per village: food against need, people by age, hungry households, idle hands, and warnings that name the households. |
| [VB-294](backlog/VB-294.md) | The gathering: villages choose where to meet, and one hosts | fair | 2 | M | VB-257, VB-278, VB-286 | Each village chooses at its autumn meeting the gathering it attends next year; fewer than three villages and it is not held; the district read from the choice. |
| [VB-295](backlog/VB-295.md) | Going to the gathering: a household plans it, packs and walks there | fair | 2 | M | VB-287, VB-294 | The gathering as an occasion: who goes and who stays, provisions and loads packed, the walk there and back, three days on the host's green. |
| [VB-302](backlog/VB-302.md) | The fair: barter between strangers at the gathering | fair | 2 | M | VB-295 | Swaps in whole quanta among those at a gathering: need accepts, customary worth books the residual as goodwill, partners first; deals failed for want of change counted. |
| [VB-296](backlog/VB-296.md) | Customs drawn together: those at a gathering meet, and their villages are tied | fair | 3 | S | VB-295 | Encounters among those on the green, with a cap a pawn; a gathering's villages count as tied at the culture's reckoning. |
| [VB-297](backlog/VB-297.md) | Border disputes between villages are resolved at the gathering | fair | 3 | S | VB-295, VB-313 | A dispute over a tile between two villages of one gathering is decided there by the holders of the other villages; cairns follow. |
| [VB-298](backlog/VB-298.md) | Marriages between villages are made at the gathering | fair | 3 | S | VB-295, VB-288, VB-289 | The matcher pairs pawns of different villages only if both were at one gathering within 3 years; reported: marriages across villages. |
| [VB-301](backlog/VB-301.md) | Tar: burnt in pine villages, needed for boats and timber | fair | 3 | M | VB-300 | A tar pit as a household's facility and tar burning as long work; boats need tarring and tarred timber needs less upkeep, so shore villages need the forest's good. |
| [VB-303](backlog/VB-303.md) | The gathering and the fair in the page: packing, the green, the report | fair | 3 | M | VB-302 | Loads and carts on the paths, the green full for three days, a gathering report in the log, and the player's doors: go or stay, propose a swap, a voice in a border case. |
| [VB-304](backlog/VB-304.md) | Wrap-up: the gathering and the fair | fair | 3 | S | VB-276, VB-296, VB-297, VB-298, VB-300, VB-301, VB-303 | Long runs of the slice as a whole: districts and hosts, marriages across villages, borders settled, what the fair moved and what failed for want of change; bands and tuning. |
| [VB-034](backlog/VB-034.md) | Splitting land between heirs | debt | 3 | M | VB-310, VB-311 | Under "land split between heirs" the fields are divided, so the custom stops behaving like a buy-out. |
| [VB-035](backlog/VB-035.md) | Wrap-up: debt and land | debt | 3 | S | VB-034, VB-044, VB-045, VB-082, VB-092, VB-095, VB-320, VB-321 | Slice 5's probes at four seeds (land Gini, tenancy share, landed per 1,000, elite turnover) against bands, with the expansion and claims wrap-ups merged in. |
| [VB-043](backlog/VB-043.md) | One scope model: a membership graph of entities | debt | 3 | M | Kim | The membership graph of typed edges, with scopes on it; as Membership's truth if Kim adopts it (measured 0.55 ms at year 12). |
| [VB-044](backlog/VB-044.md) | Overlay filters by scope, and claims on the overlay | debt | 3 | M | VB-043 | The ownership overlay can be filtered by any entity level and also shows claims. |
| [VB-082](backlog/VB-082.md) | Customs made legible: votes, leanings and causes | debt | 3 | M | VB-313 | Votes in the meeting log, leanings in the pawn panel, causes and changes announced. |
| [VB-092](backlog/VB-092.md) | Store views for households and villages | debt | 3 | M | VB-043 | A stores table for any household or village scope, on the VB-043 scope model. |
| [VB-095](backlog/VB-095.md) | Family tree by scope, fast at full scale | debt | 3 | M | VB-043 | The tree opens on a scope, folds the rest and draws only what is on screen. |
| [VB-312](backlog/VB-312.md) | Grain loans: borrowed when help falls short, repaid at the harvest | debt | 3 | M | VB-310 | A short household borrows from its village or its partners; repaid with a quarter more under a new practice; overdue and default. |
| [VB-314](backlog/VB-314.md) | The alderman: chosen at the meeting, presides, the village's agent | debt | 3 | S | VB-313 | The village's first office: chosen by a new practice, casts the deciding voice, books the village store's help to himself. |
| [VB-315](backlog/VB-315.md) | Default and cases at the meeting: pressing, the hearing, labour owed | debt | 3 | M | VB-254, VB-312, VB-314 | A defaulted loan is pressed, extended or forgiven; the meeting hears it by the village's procedure; labour is the first remedy. |
| [VB-316](backlog/VB-316.md) | Foreclosure: a field passes, and its old family farms it as tenants | debt | 3 | M | VB-311, VB-315 | Debts are paid with land: a field splits off to the creditor, the debtor stays as tenant and pays rent. |
| [VB-317](backlog/VB-317.md) | Tenancies over time: handover, end, letting again, marrying onto one | debt | 3 | M | VB-316 | A tenancy passes with its household or ends; the owner works or lets the land again; a vacant tenancy is a home. |
| [VB-318](backlog/VB-318.md) | Class: a derived view with hysteresis, and what landed changes | debt | 3 | S | VB-316 | Tenant, cottager, peasant, landed from rights, rents and stores, yearly a village a step; landed lowers field work and adds prestige. |
| [VB-319](backlog/VB-319.md) | Hired hands: a day's work for a wage at the peaks | debt | 3 | S | VB-310 | The hired basis: a holder short of hands at sowing, haymaking or harvest hires a landless adult of its village for 3 rations. |
| [VB-320](backlog/VB-320.md) | Debtors' politics: those who owe lean against the creditors' practices | debt | 3 | S | VB-316 | Self-interest on slice 5's practices by a household's position, the loop that opposes land concentration. |
| [VB-321](backlog/VB-321.md) | Debts, tenancies and cases in the page | debt | 3 | M | VB-082, VB-317, VB-318, VB-319 | Household panel lines, the overlay's tenancies, the case lines of the meeting log, and the player's verbs for loans and land. |
| [VB-093](backlog/VB-093.md) | A village windmill | mill | 3 | M | VB-009, VB-361, VB-364 | A village of 3 or more farms builds a windmill that grinds 5 times faster than the quern; other villages pay a toll. |
| [VB-121](backlog/VB-121.md) | Winter crafts: tools and fence poles | mill | 3 | M | VB-360, VB-364 | Tools wear with field work and are mended in winter; fence poles are cut in winter and used for mending. |
| [VB-362](backlog/VB-362.md) | Spinning and weaving: fleece to yarn to cloth, a loom, and who does it | mill | 3 | M | VB-144, VB-360 | Fleece is spun into yarn as background work indoors and yarn woven into cloth on a loom the household builds; a practice says whose work it is. |
| [VB-363](backlog/VB-363.md) | Dress: clothing wears out, and a worn dress costs health in winter and standing | mill | 3 | S | VB-362 | Each person wears a length of cloth out in about 3 years; without sound dress winter costs a little health and prestige falls. |
| [VB-364](backlog/VB-364.md) | The bloomery: bog ore smelted with wood to iron | mill | 3 | M | VB-360, VB-361 | A household with bog ore builds a bloomery and smelts ore and wood into iron blooms, the good tools are mended with. |
| [VB-365](backlog/VB-365.md) | Occupations: what a pawn is called by the hours it works, and slice 6a's report | mill | 3 | S | VB-362, VB-121, VB-093 | A derived view: a pawn whose craft hours of the last 3 years lead its work is called by it (the smith, the weaver, the miller), with hysteresis; and the first half's numbers. |
| [VB-366](backlog/VB-366.md) | Pots: fired clay keeps the store from damp and mice | mill | 3 | S | VB-360 | A household fires pots from clay in a pit; with pots, half of the grain store's yearly loss is saved; pots break, so the need lasts. |
| [VB-368](backlog/VB-368.md) | Kilns: brick and tiles from clay, and lime from limestone | mill | 3 | M | VB-361 | Two facility kinds a household or a village builds: a brick kiln fires clay into brick and roof tiles, a lime kiln burns limestone to lime; both eat wood. |
| [VB-369](backlog/VB-369.md) | The fine timber house: lumber on a dry stone foundation, a tiled or slate roof and a brick hearth | mill | 3 | M | VB-368 | The third grade of house: hewn lumber walls on the unmortared stone foundation, roofed with slate or tiles, with a brick hearth; more standing and less wear. |
| [VB-370](backlog/VB-370.md) | The stone house: mortared walls of stone or brick | mill | 3 | M | VB-369 | The fourth and most prestigious grade: walls of stone or brick laid in lime mortar. |
| [VB-371](backlog/VB-371.md) | Wrap-up: the mill and the loom, the kiln and the quarry (slice 6) | mill | 3 | M | VB-009, VB-093, VB-121, VB-144, VB-360, VB-361, VB-362, VB-363, VB-364, VB-365, VB-366, VB-367, VB-368, VB-369, VB-370 | Long runs of the whole slice against the design: idle hours by season, cloth, mills, iron, houses by grade, goods of place moving at the fair, and the cost lines. |
| [VB-036](backlog/VB-036.md) | Plan: relationships and courting | talk | 2 | S | VB-186 | Design courting, relationships and food help between kin, so the courting tasks can be written. |
| [VB-062](backlog/VB-062.md) | Mood and its modifiers, shown in the pawn panel | talk | 2 | M | VB-186 | Each pawn has a mood made of timed modifiers ("Talked with a friend +5"); the pawn panel lists them. |
| [VB-186](backlog/VB-186.md) | Plan: talk travels: traits, venues and stories (slice 7) | talk | 2 | S | VB-187 | Design traits, encounters at venues and stories, with lies and counter-stories, from the experiment. |
| [VB-040](backlog/VB-040.md) | Wrap-up: relationships and courting | talk | 3 | S | VB-036 | Long runs check marriage age, never-married share and help between kin against history; report. |
| [VB-063](backlog/VB-063.md) | Wrap-up: pawn interactions | talk | 3 | S | VB-062 | Check talk, relationships and mood at full scale; report cost and patterns. |
| [VB-188](backlog/VB-188.md) | Plan: the ship: the outside world, silver, institutions and disease (slice 8) | ship | 3 | S | VB-186 | Design ships, silver, the Church and the Crown, rank, tithe and tax, and disease by sea. |
| [VB-189](backlog/VB-189.md) | Plan: the town (slice 9) | town | 3 | S | VB-188 | Design the market place and the town: plots, food bought, the urban sink, tiers and regions. |
| [VB-083](backlog/VB-083.md) | Seasons on the map | roads | 3 | M | VB-190 | Seasonal tints and winter snow on the painted map. |
| [VB-097](backlog/VB-097.md) | Routes over regions (HPA*), if routes cost too much | roads | 3 | M | VB-190 | Measure route cost first; bound the cache, and build HPA* over regions only if needed. |
| [VB-115](backlog/VB-115.md) | Building bridges | roads | 3 | M | VB-190 | A village builds a bridge where a ford detour costs it most; needs timber and labour. |
| [VB-190](backlog/VB-190.md) | Plan: roads, boats and ice (slice 10) | roads | 3 | S | VB-189 | Design carts, sledges and boats, climate and ice, built ways, passage and upkeep. |
| [VB-277](backlog/VB-277.md) | The moving round a village a step: each village's marriages and handovers in its own six-minute step | between | 2 | M | VB-241 | The round matches the whole island's men in one step behind a dependency-tracked heir cache; each village's men now ask in their own step, in village id order, with heirs ranked afresh; behaviour changes, demography and numbers before and after. |
| [VB-278](backlog/VB-278.md) | The meetings a village a step: each village's meeting in its own six-minute step | between | 2 | M | VB-241 | VB-206's four stages run the whole island at once; each village now holds its meeting in its own step (its people's interests, its tie, its causes, its meeting), then the cultures' reckoning and the land meeting; draws reorder, so customs are calibrated before and after. |
| [VB-279](backlog/VB-279.md) | Refactor: the heir cache's end: roundHeirs, its watch and its family memo gone | between | 2 | S | VB-277 | With a village a step (VB-277), only countDemand still reads the round's dependency-tracked view; roundHeirs and heirRanking's watch and family parameters go, nested and ownFirstSet stay; behaviour unchanged. |
| [VB-286](backlog/VB-286.md) | Walking hours between villages: a table compiled a village a step | between | 2 | S | VB-241 | One measure of distance between two villages: the walking hours between their greens by the route search, a row a village refreshed yearly on autumn day 9 and at a founding, bounded at the route search's reach (67 h); no behaviour change. |
| [VB-287](backlog/VB-287.md) | Journeys: a pawn who moves to another village walks there, a leg a day | between | 2 | M | VB-286 | Moves between villages (a spouse, a servant, a guardian, a claimant, settlers, children) stop placing the pawn at its new home: it walks the route, 6:00 to 18:00 a day, sleeps where it stops, eats food carried; each leg is a due entry in st.journeys. |
| [VB-288](backlog/VB-288.md) | Distance governs the round's matching: women within reach, nearer ones preferred | between | 2 | M | VB-286, VB-277 | A village's round chooses among the women of villages within walking reach (by land, at most 67 h), and the score's village term becomes 2 x exp(-hours/8) in place of the culture tie; kin pressure counts partners within reach; behaviour changes, demography reported. |
| [VB-289](backlog/VB-289.md) | The suitor's visit: a match beyond a day's walk needs a winter journey first | between | 2 | M | VB-287, VB-288 | A man who found no one at his village's round may walk in winter to the nearest village beyond a day's walk that holds a free woman, at his household's cost in food and days; only villages he visited put their women in his pool at the next round, besides those within a day's walk. |
| [VB-290](backlog/VB-290.md) | The round's other acts reach by walking hours: claims, service, guardians and the tie | between | 2 | M | VB-286 | Claims on empty farms and service reach villages within a day's walk (12 h) in place of 15 hex steps; the nearest village for an orphan's service home, guardians and kin homes read hours; the tie to the centre reads the table in place of its own search. |
| [VB-291](backlog/VB-291.md) | Kin help over distance: a gift from far kin is carried on a journey | between | 2 | S | VB-287 | Kin within a day's walk give as today; kin further away are asked after the village store, and one of the giving household's adults carries the grain on a journey, so it arrives after the walk; kin over the sea are not asked. |
| [VB-280](backlog/VB-280.md) | The order of villages turns by the year, so no village always asks first | between | 3 | S | VB-277 | In village id order the first villages' men ask first every year; start the round's and the meetings' order at village year mod count, deterministic and without a new draw, if Kim agrees. |
| [VB-325](backlog/VB-325.md) | Wrap-up: between villages: distance and journeys | between | 3 | S | VB-241, VB-277, VB-278, VB-279, VB-280, VB-286, VB-287, VB-288, VB-289, VB-290, VB-291 | Long runs against the plan's numbers: marriages and kin gifts by walking hours, journeys a year, the round and meetings a village a step against 60 ms; bands added. |
| [VB-048](backlog/VB-048.md) | Wrap-up: tune yields and the food balance of a farm | animals | 3 | M | VB-091, VB-136, VB-139, VB-144, VB-160 | With animals in, tune field yield, fields per farm and food from animals so a family of 6 is fed in an ordinary year. |
| [VB-091](backlog/VB-091.md) | Forest spread into open land | animals | 3 | M | VB-136 | Open land next to forest goes to scrub and then woodland unless farming, mowing or grazing keeps it open. |
| [VB-139](backlog/VB-139.md) | Roe deer | animals | 3 | M | VB-136 | Deer stock per region, crop damage by broken fences, hunting. |
| [VB-331](backlog/VB-331.md) | A day without water: no cooking and a little health | - | 3 | S | VB-327 | A household that fetched no water that day cannot cook and its members lose a little health, as with an empty woodpile; today the water job is read by nothing. |

## Archs

The vertical slices of `docs/roadmap.md` in Kim's order, then the archs that run beside them: `between` (the tasks of slice 2's plan VB-281) and the two older archs with open tasks. Closed archs are in the archive.

| Key | Arch | Goal | Design ref |
|-----|------|------|------------|
| yardstick | Slice 0: the yardstick | Every later slice measured at its own cost, early and late in a run, cheaply: work counters, scaling and history checks, late-game fixtures, a bench history, the reduced-scenario harness with bands, the rules registry, indexes of the living; the moving round, the meetings and midnight under 60 ms, a bounded route cache and a bounded history. Since 7 November (Kim) the late reference is the first year populous medium reaches 1,000 living (`medium-ref`, VB-202), with 200 ms a game day for today's systems (`medium-y60` was dropped on 8 November, Kim, VB-202); VB-203 measures it and writes the closure table by system. | `docs/roadmap.md`, sections 3.0, 5 and 6 |
| life | Slice 2: a life | The player inhabits a pawn: chooses what it does from what it may do here, answers at the meeting, goes on as kin after its death, saves in the page, picks ambitions. | Vision and scope (Player role); roadmap 3.2 |
| year | Slice 3: the household's year | Work is available, not posted: plans (standing routines, seasonal plans, the meeting's yearly routines) make tasks that eligible pawns take; planning days; attention. | Work: opportunities, plans and tasks; roadmap 3.3 |
| fair | Slice 4: the autumn fair | Barter between villages in whole goods; need decides, customary worth books goodwill; grain loans as obligations. | Roadmap 3.4; `docs/review-cities.md`, phase 1 |
| debt | Slice 5: debt and land | Land rights with `own` and `use` apart; default, cases at the meeting, foreclosure into tenancy; the landed household; the bodies decision. | Claims, ownership and territory; Inheritance and expansion; roadmap 3.5 |
| mill | Slice 6: the mill and the loom | Facilities and construction as recipes, crafts and skills, the textile chain, occupations seen in hours worked. | Goods, production and animals; roadmap 3.6 |
| talk | Slice 7: talk travels | Traits, encounters at venues, stories, lies and counter-stories; talk cheaper than today. | People, households and family records; Customs and culture; roadmap 3.7 |
| ship | Slice 8: the ship | The outside world, silver, the Church and the Crown, rank, tithe and tax, disease by sea. | Roadmap 3.8; `docs/review-cities.md`, phases 3 and 5 |
| town | Slice 9: the town | Market places and towns, burgage plots, the urban sink, settlement tiers and regions. | Roadmap 3.9; `docs/review-cities.md`, phase 4 |
| roads | Slice 10: roads, boats and ice | Carts, sledges and boats, climate and ice, built ways, passage rights and upkeep. | World and scale; Weather, seasons and daylight; roadmap 3.10 |
| between | Between villages: distance and journeys | Open beside the slices since 11 November: the tasks slice 2's plan VB-281 wrote (10 Nov), which had no arch. The calendar as one table (VB-241); the moving round and the meetings a village a step (VB-277 to VB-280); one measure of distance, the walking hours between greens (VB-286); a pawn who moves walks there (VB-287); the match, claims, service and kin help by walking hours (VB-288 to VB-291); the wrap-up VB-325. The gathering (VB-294, VB-295) and the player's journey (VB-292) wait for it. | Between villages: distance and journeys (10 November); `backlog/VB-281.md`; roadmap 3.2 |
| animals | Animals and husbandry | Open beside the slices: VB-160, VB-139, VB-091 and the wrap-up VB-048 (after slice 6). Herds, hay meadows and the winter limit; the food balance of a farm, and yields tuned once animals are in. | Animals; Land and ecology |
| ownership | State ownership and boundaries | Open beside the slices: VB-173 to VB-179 are done (target-v2 found they fit it unchanged); the wrap-up VB-180 remains. Every piece of state the simulation keeps has one owning module, which alone writes it; other modules read it freely and change it through the owner's operations; a static check keeps it so, and the map of owners and dependencies stays current (architecture review, 3 November 2026, `docs/review-architecture.md`). | none |

## How this backlog works

**Files and rows.** Each task has its own file, `backlog/VB-NNN.md`, which holds the full description and is the source of truth.
Its row here is the overview: when a task's name, arch, priority, size or what it waits for changes, update its row too; when its status
changes, move the row to that status's section. A new task takes the next free ID, gets a file and a row. Done tasks are moved, row unchanged, to `BACKLOG_ARCHIVE.md`;
their files stay in `backlog/`. Ready and Waiting for Kim are sorted by priority, then ID; Blocked by arch (in the order of the Archs table,
tasks outside every arch last), then priority, then ID; the archive by when a task was done, newest at the bottom.
`tests/backlog.js` checks that files and rows agree, and the order. `node tools/backlog.js` makes these moves from the task files
(`done`, `set`, `new`, `close-arch`, `sync`) and reads the backlog without these tables (`next`, `list`, `show`); `AGENTS.md`, Commands.

**Order and statuses.** Agents take only `Status: ready` tasks, in the Ready table's order: priority (1 first), then ID.
To change what runs first, change priorities; there is no other order. A task's notes say what it may run beside (tasks that edit the
same files run one at a time).
A task is `ready` only when it needs no design decision: the goal, numbers and acceptance criteria are all stated.
`needs-review` tasks list the questions Kim must answer first; [`QUESTIONS.md`](QUESTIONS.md) gathers the open questions of all tasks
in one place, with proposed answers, and answered ones move to [`QUESTION_ARCHIVE.md`](QUESTION_ARCHIVE.md).
A `blocked` task has a `Waits for:` line after `Status:`, naming the open tasks it waits for, or `Kim`, separated by ", " (`Waits for: VB-185, VB-009`).
That line, not the prose of the goal or notes, is what holds it: when a task is done, the tasks that wait for it drop it, and a task left
waiting for nothing is set `ready` (the check fails until it is). A task taken over by a slice waits for the slice's plan, which confirms,
rewrites or closes it. Only blocked tasks have the line.

**Flags.** When a task finds that a decided number or reference no longer holds, or that its change moves a budget line it does
not own, it raises it in the same PR: a question in `QUESTIONS.md` or a new task, and a line at the top of its notes that begins `Flag:`.
A sentence deep in the notes is not enough. On 5 and 6 November the late fixture's 2,492 living (against about 1,000) and VB-174's
ledgers adding half to the save were written in task files, and no one acted on them until the review of 7 November.

**Archs and phases.** An arch groups the tasks that build one part of the design. Its tasks go through three phases:
- **plan:** a plan task gathers the design questions; once Kim has answered them, it writes the arch's implement tasks with numbers and acceptance criteria, and sets them `ready`.
- **implement:** the tasks that build it, each small enough for one agent session (size S or M where possible).
- **wrap-up:** a task that checks the arch as a whole against the design with long runs, reports the numbers and proposes tuning. It is `blocked` until the arch's implement tasks are done.

Since 3 November 2026 the archs are the vertical slices of `docs/roadmap.md`, in the order Kim chose (slice 0 to slice 10). Each slice's plan task
is a design pass: it makes the slice's systems concrete, proposes its sections of `design.md` v0.4, and confirms, rewrites or closes the tasks
it took over from the earlier archs, which stay `blocked` until it has. A later slice's plan waits for the plan of the slice before it
(slices 1 and 2 run side by side); a slice's other tasks wait for its plan. The earlier archs are closed and kept in `BACKLOG_ARCHIVE.md` for their
done tasks; two, `ownership` and `animals`, still have open tasks that run beside the slices. A third arch beside them, `between` (11 November), holds the tasks of slice 2's plan VB-281.

A task file names its arch and phase in `Arch: <key>` and `Phase: plan|implement|wrap-up` lines after `Size:`; a task outside every arch
has neither, and its row shows `-` as its arch. The phase has no column: a plan task's name starts with "Plan:", a wrap-up's with "Wrap-up:",
and the check holds name and phase together. List an arch's tasks with `grep -l "^Arch: <key>" backlog/*.md`. A new arch gets a row in the Archs table;
an arch with no open tasks left moves to the archive's closed archs.

**Design refs** point to sections of `design.md` ("Village builder: game design snapshot v0.4"). Refs written before 3 November point to
v0.3's sections (`docs/design-v0.3.md`); v0.4 keeps v0.3's subsection names, so most still find their place (v0.4's Status of this snapshot
says where each section went).

**Refactor rules** (every task titled "Refactor:"):
- Behaviour is unchanged: `node tests/golden.js` passes with `tests/golden.json` (VB-011) unchanged, and the hard checks pass (`AGENTS.md`, Working rules). Rebuild `index.html` before committing.
- Code moves verbatim apart from the module wrapper, the dependency lines at its top and its return list. Lines over 160 characters in moved code are wrapped at statement or argument boundaries; nothing else is reformatted (`tools/wrap.js` does it, and `--compare` checks the build).
- No renames: functions, state fields and the `Sim`, `ArchGen` and `Culture` APIs keep their names, so backlog references and greps stay valid.
- A new module follows the VB-012 convention, starts with an `@sys` header (VB-013), is listed in `src/manifest.json` after every module it reads, and stays under 400 lines.

**Golden file, work counters and cost growth:** a task that changes behaviour or work counters on purpose re-records them and lists
the changes in its PR. Counters and cost growth are targets: they report their residual and never fail, and a change does not raise
a target to hide one (Kim, VB-261). A criterion worded as a line ("at most 30 ms", "verify passes") means: moved towards the target, its
residual reported, and who closes what is left named; "verify passes" means its hard checks pass. The commands and limits are in
`AGENTS.md` (Commands and Working rules).
