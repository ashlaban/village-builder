# Balance review: the cards

A card records one mechanism of the vision, checked against the design and the code, so that the balance map can be grounded in it. Cards 1 to 4
are finished and were drawn on draft 3 of the map; card 6 has its groundwork and Kim's answers; the rest are seeds. Written in the session of
12 November 2026 with Kim. `README.md` says how they are used and what to do next; `findings.md` holds the experiments that tested them.

**How a card is written.** Vision: the mechanism in Kim's words. Chain: its causal links, each built, planned (with its slice) or missing.
Brake: what is meant to balance it, and whether that exists. Macro quantity: the balance property it moves. Gap: where the design falls short
of the vision. Then Kim's decisions on it, and what the experiments found. A new card starts as a seed (one line and a first impression),
gets its groundwork (the code and the design read, the history and the game-design literature searched, above all the acoup blog), is
discussed with Kim, and only then goes on the map.

## The balance properties (draft, 12 November)

What Kim tunes toward. The first three were named by Kim; the list is a draft, and the experiments recast several (see README, Vocabulary).

| Property | Target | Measured today (populous small, 50 years) |
| --- | --- | --- |
| Population | About 1,000 on a medium map, held by loops, never a cap | Grows 1.2 to 2.2% a year |
| The split of people | 600 farming / 325 town and craft / 75 elite (12 to 15 households) | All farming |
| Land concentration | A band, unset | Land Gini 0.29 with no debt; no tenancy exists |
| Food produced (a farming household's output over its need) | 1.67 is the floor the split implies; 1.7 to 2.15 by rot and feasting | 1.64 to 1.86 counting fish, meat, milk and gathered food; 1.05 to 1.52 grain alone |
| Share extracted, and the split of the surplus (eaten, taken, feasted, sold, rots) | About 40% of output must leave the farm | Nothing taken or sold; about 22% of the grain harvest rots |
| Food kept a head (hunger when under need) | Above the floor for most households | Under 1% of households hungry; 18 to 28% produce under their need |
| Goodwill in circulation | Unset | About 88 rations outstanding a household; made only by help in hunger |
| Idle hours | A consequence, not a target; hours must remain for subsistence after owed work | 16 to 33% in summer and autumn, 59 to 70% in winter |
| Spread of customs | Two cultures, most different mid to late game | One culture; villages differ on 1 of 14 customs |

## Card 1: hunger to mobility (finished)

- **Vision (Kim):** hunger drives the economy of gifts and goodwill, which drives upward social mobility: peasants become landed elites by
  gathering land, wealth and prestige. Later this push is balanced by other forces.
- **Chain:** bad harvest → hunger → gifts of food asked of kin → goodwill owed to the giver → gratitude (opinion) and help returned: all
  built (`sim/help`, `sim/exchange`, `sim/relations`; VB-216, VB-217, VB-220, VB-222). Goodwill → prestige or land: missing. Prestige
  reads holder or not, age, the house and ale poured (`sim/society.js`, `prestigeParts`). The designed road to land is debt, slice 5: a
  grain loan when help falls short, default after two unpaid harvests, a case at the meeting, a field passes, the old family pays rent
  (a quarter of the harvest and 2 days); land → landed class → +0.2 prestige → the alderman's office → presiding over cases.
- **Brake:** built: gifts end the hunger that asked for them; goodwill halves in 4 years; no deal takes a giver below its floor. Planned
  (slice 5): debtors vote the debt custom toward labour, one field a hearing, tenants leave, heirs split land. Planned (slice 7): talk of
  hard dealing thins the creditor's voice.
- **Macro quantity:** the elite share (75 of 1,000); land concentration.
- **Gap:** giving earns no standing. Mobility comes from lending, so the gift economy and the road upward are two systems joined only by
  "help ran out".
- **Kim, 12 Nov:** patronage is added (card 3) to join them; feasting should be a driver of the goodwill economy (card 4).
- **Experiments:** at the game's food ratio the debt road gives 0 to 1 elite households in 150 years and starts only when the map is full;
  hard lenders, not generous households, become landed; kin help slows concentration; rent and interest are 6 to 10% of output; the
  goodwill road moved 70 fields in 250 years; office and a tithe give 12 to 15 elite households and nothing opposes them. Tenants leaving
  is no brake; debtors' politics is the steepest. The design's rule for `landed` miscounts. → VB-404.

## Card 2: population growth (finished)

- **Vision (Kim):** births and deaths carry growth; immigration and emigration are very limited (a merchant visits, an elite arrives with a
  retinue, a family of another culture settles; an elite recruits young adults for service, or people leave for better chances). Disease
  rises with crowding in towns and cities, so towns are sinks and the countryside a source; poor health and nourishment raise the risk.
  Hunger, disease and crowding lower fertility; varied food raises it, through health. Kim's summary of the levers: hunger feeds disease,
  which lowers growth; the age at marriage; fertility; nursing as a lever that regulates itself.
- **Chain, built:** deaths by an age curve (about 20% before 1, a third before 15), multiplied by hunger and poor health; 1% of births kill
  the mother (`sim/deaths.js`, `sim/hunger.js`). Births to married women living with their husband, by age, times (1 − hunger), with a
  pregnancy and a nursing gap (`sim/births.js`). Marriage from 18 and 20, needing a home that holds 1.5 years of food above its seed
  (`MARRIAGE.means`, `sim/matching.js`), and nobody marries at hunger 0.5 or more.
- **Chain, planned or missing:** disease (named the largest gap, not designed); the town (slice 9); the outside world (slice 8); an
  infant's death ending the nursing gap (missing); disease, crowding and varied food acting on fertility (missing).
- **Brake:** the marriage gate (built, by delay), hunger (built, rare), the vent of new land (built, early game), the town (planned).
- **Macro quantity:** population and its growth rate.
- **Gap:** the vision's town-as-sink rests on disease, the one undesigned piece; growth is checked today by a home to marry into.
- **From the reading (acoup, Life, Work, Death and the Peasant II, IIIa, IIIb):** marriage was the main valve in north-west Europe (women
  at about 25, a quarter to a third never marrying); fertility was partly chosen (about 5.8 live births a woman against 9 at the maximum);
  nursing gave 12 to 24 months without conception and ended with the infant's death; famine kills late and by disease, the young and the
  old first; deaths peak in the cold months; about a quarter of pregnancies end in miscarriage or stillbirth; about 2% of births killed
  the mother; service away from home delayed marriage; towns shrink also because migrants arrive young and single.
- **Kim, 12 Nov:** marriage as a balancing factor is wanted; nursing is to be surfaced as an important one; the outside world mostly fixed
  with some small adaptation.
- **Experiments:** a ceiling of 2.4% a year; 10 to 1,000 in 150 years needs 3.1%; founders reach about 1%. Marriage holds the population
  already; hunger touches under 1% of households. The means test is the master setpoint. The town does not slow growth: it decides where
  people live. Every recipe for zero growth has a human cost; marriage-held balance overshoots and echoes. Lever ranges are in
  `findings.md` and `figures/lever-ranges.png`. → VB-405.

## Card 3: a surplus that supports towns and an elite (finished)

- **Vision (Kim):** an agricultural base supports town life, a specialised economy and a land-owning elite, at 600 / 325 / 75. The small
  farming base is deliberate, to fit enough specialists and elite to play among into 1,000 people; the base yield may need to exceed 1.67
  for the island to hold robustly. Idle labour is what land-owners draw on: one use of it is work on their farms, and labour and time
  must be left for subsistence after their share. Fewer dedicated specialists, because farmers' slack hours make goods, is welcome.
  The game starts as a primitive society and grows into a city-state with satellites.
- **Chain, built:** fields, herds, fish and gathered food produce; grain rots in store (5% a year up to a year's need, 20% of the next
  year's worth, 40% of the rest); a quarter of a household's surplus goes to the village store each year.
- **Chain, planned:** rent (slice 5), tithe and tax (slice 8), the fair and goods worth working for (slice 4), households that buy their
  food (slice 9), crafts in the slack season (slice 6). A head's project for a surplus (VB-255) is not built.
- **Brake on extraction:** the floor (seed and 20 days of need) is the only hard limit; the rest is to be tuned rates and self-regulation
  (Proposed). A full tenant falls below need at a rent of 0.39 in a median year, 0.26 in a one-in-four bad year.
- **Macro quantity:** food produced; the share extracted; food kept a head; idle hours; the town and elite shares.
- **Gap:** farms have one reason to produce past their need (a project for the fair), and nothing turns grain into something that keeps.
- **From the reading (acoup, Bread I to IV; Peasant IVa to IVc, V):** 80 to 90% of people farmed and about 10% of output reached cities;
  peasants aim for "subsistence and a little more" and spread risk; a tithe is a tenth, tenants on shares kept 40 to 60%; at yields of
  6:1 farms use 56 to 70% of workdays, at 4:1 84 to 110%; grain keeps about a year; water carriage was 5 (river) to 20 (sea) times
  cheaper than land; the household's ratio of workers to mouths moves its surplus over a generation; big holders lent in bad years,
  they did not give; output can rest low (little trade) or high (markets and coin).
- **Kim, 12 Nov:** pull first (goods), then push (rent, tithe, tax); net surplus and the extracted share are the properties; servants
  are peasants and a retinue's members specialists or nobles; keeping as a late lever; patronage is added: where kin help falls short a
  rich household gives, and large one-sided goodwill is worked off as days on its farm and weighed in the debtor's vote.
- **Experiments:** the surplus may already exist (1.64 to 1.86) and about a fifth of the harvest rots; the target needs 1.7 to 2.15; rot
  is the decisive dial and the town the residual claimant; rent cannot feed an elite and a tithe overfeeds it; winter hours could replace
  about 91 of the 325; the wish for goods built the town in the model; patronage as worded is negligible. → VB-403, VB-404, VB-406, VB-407.

## Card 4: goodwill, barter and silver (finished)

- **Vision (Kim):** goods are exchanged for goods and decaying goodwill; elites and merchants use currency once it exists.
- **Chain, built:** the gift, and goodwill as one decaying number between two holders (halves in 4 years, at most 32 counterparts);
  goodwill and opinion both raise what a holder will give. Ale poured gives the host standing.
- **Chain, planned:** barter at the fair in whole quanta, the leftover booked as goodwill; strangers have none, so deals fail for want
  of change, and those failures are counted as the island's demand for money; keeping goods accepted beyond need; trade partners
  (slice 4). Silver by weight from ships, and a tax asked in silver that makes every taxed farm sell (slice 8).
- **Brake:** goodwill's decay; none designed on money.
- **Macro quantity:** goodwill in circulation; the split of the surplus.
- **Gap:** goodwill is made only in hunger; nothing happens to a household that takes and never returns; "silver thins reciprocity" had
  no mechanism; a collapse of money is not designed.
- **From the reading (acoup, Bread I and IV, Peasant IVc, the coinage post; Sahlins; Graeber):** reciprocity is insurance and eats the
  surplus ("you banquet your neighbors in the good years so they'll help you in the bad years"); closeness sets the terms (open-handed
  among kin, balanced with acquaintances, hard with strangers); credit came before coin; coin is a poor reserve for a peasant and fails
  when most needed; taxes in coin force farms into the market; monetisation is fragile; merchants are disliked; in Scandinavia silver
  went by weight beside coin for a long time.
- **Kim, 12 Nov:** coin opens trade with strangers and does not shrink the room for goodwill; feasting and good-year gifts are a driver
  of the goodwill economy; no strong view on whether money can collapse.
- **Agreed reading:** two circuits. Silver thins reciprocity by competing for the same surplus. A farm's spare food goes four ways
  (feasted, sold, taken, rots) beside what is eaten; animals count in the surplus and are placed later.
- **Experiments:** feasting mostly replaces rot; goodwill does not pile up with a few households (the top three hold 14 to 26%); goodwill
  nets out of every class account and lives in the spread between households; a silver tax is one sale counted as both taken and sold,
  and with arrears that become debt it was the strongest concentrator of land. → VB-407.

## Card 5: markets grow into towns (folded into cards 3 and 4)

- **Seed:** markets arise between villages and can grow into towns; a region holds a town and its villages, about two cities a map.
- **State:** not written as its own card: the gathering and the fair (slice 4), the trade loop (card 3) and silver (card 4) cover it.
  What remains for a card: what makes one gathering place become a town (centralisation and bypass in target-v2 6.1), and the two limits
  on a town's size (migrants over its excess of deaths; the surplus that reaches it over a person's need). The experiments found the
  second binds late (about year 154) and that the town has two setpoints for one stock (demography and food).

## Card 6: distance separates cultures, contact draws them together (groundwork done, discussed; not on the map)

- **Vision (Kim):** terrain and water separate cultures; inheritance and marriage rules differ between villages; values are held by
  individuals, institutions and social bodies. 12 Nov: about two distinct cultures on a map, most different from the middle to the late
  game and much more alike in the very late game; some scenarios start with different customs; hardship pushes on customs directly;
  like seeks like works through opinion (pawns whose customs differ think less of each other), not through hours added to a distance.
- **Chain, built:** attitudes on 15 customs, pulled toward contacts and anchored to upbringing; practice changes at the yearly meeting by
  a margin of about 25%; a village's tie to the culture's centre falls with distance; a weakly tied village that stays far from the
  culture's customs for 3 years splits off (`src/culture.js`). Self-interest and a shortage of spouses pull attitudes.
- **Chain, planned:** the gathering of near and like-minded villages (slice 4); doctrine of the Church (slice 8); boats (slice 10).
- **Macro quantity:** the gap in attitudes between the two largest blocks over time (its peak value and year); check: the share of
  marriages across the divide. Counting cultures is not tunable.
- **Gap:** at the calibrated pace only the easiest customs differ within a game's 150 years; the pull apart is designed and the pull
  together is thin; hardship barely moves custom; nothing pulls attitudes toward the practice in force.
- **From the reading:** separation alone is not enough, conformity must hold a group together inside (Henrich and Boyd 1998); where like
  seeks like, differences sharpen into blocks (Axelrod; Shennan, Crema and Kerig 2015); migrants conform, marriage mixes; institutions
  flatten from above (Swedish provincial laws differed, and the Church pushed against local custom); bigger groups move slower.
- **Culture's place on the map:** mostly as dials on other loops: the inheritance custom on land concentration and elite turnover,
  marriage rules on births, who eats first on child deaths, who speaks on debtors' politics; and a curve of its own on the era strip.
- **Experiments:** an opinion penalty keeps a difference and does not make one; two cultures need a seed (a different start, or different
  land); the link is a switch near penalty × distance = 1; the rise and fall appeared only with poorer land on one island, land running
  out pushing the heirs custom, and attitudes pulled toward the practice in force; the town and a Church doctrine made the fall; easy
  customs flicker and hard ones carry identity. Measured in the game: 29 to 46% of custom changes undo the one before; no run split.
- **Open, no task yet:** the opinion rule and its strength; the pull toward the practice in force; hardship's pushes; seeds by scenario.
  Slice 4's tasks VB-294 and VB-296 should read the row "Like seeks like" in `design.md` before they are built.

## Card 7: idle hours turn into crafts (seed)

- **Seed:** resources are extracted and refined through work; pawns plan simply, and specialised roles such as miller and baker emerge.
- **First impression:** slice 6 (the mill and the loom, skills, textiles as the sink for idle hours). The measurements change the
  premise: farmers are idle mostly in winter (59 to 70%) and little at the peaks, and walking takes a third of working hours. Winter
  hours could replace about 91 of the 325 townspeople. Groundwork to do: acoup, Clothing (spinning as most of the labour of cloth) and
  Peasant IVd and IVe (not yet read); what a part-time craft does to the count of specialists.

## Card 8: elite turnover (seed)

- **Seed:** estates split, lines die out, younger sons drop a stratum; an alderman's house rises and falls.
- **First impression:** named as a loop in target-v2 6.1 with the inheritance custom as its setpoint; no rules found. The experiments:
  fully partible inheritance cuts estates and pauperises; kin inheriting the land of households that die out concentrates land with no
  brake; the elite sends about 1.5 people a year down to the town in the target's accounts. Belongs with VB-404.

## Candidates the experiments raised (no card yet)

- **Reach.** Land within a day's walk of a village is what runs out (14% of a small map in use at year 50), and walking takes 30 to 47%
  of hours. A condition, in Kim's reading not a lever: it sets where every limit sits. What holds the farmers at 600 when land does
  not bind is open.
- **Disease.** The vision's sink; undesigned. In the models it changed little and the town did not slow growth, so its job is to set the
  town's size and its human cost, not the island's growth.
- **Animals as stored wealth.** A sixth outlet of the surplus; Kim: to be covered at an appropriate card (VB-407 places it).
- **The village store.** The largest single place grain rots (VB-406).
- **The household's life cycle.** The ratio of workers to mouths made as much difference to land concentration as yield did.
