# Review: what raised grain yields over the centuries, and a model for it

16 November 2026. The survey of VB-160 (plan, arch `animals`), phase one: a draft for Kim, who takes part in the design. It replaces nothing in `design.md` yet. The rule it is set against is the one Kim reopened on 5 November: the soil's cap (`SOIL.cap` 1.15, reached only by manure) rising by 0.1 a century of a village's years of farming, so that a well-dunged old farm out-yields a new one by about 10% after 100 years (`design.md`, Goods and the farming year, Yield over time; Decided (rise) 30 Oct, Agreed (rate) 2 Nov). Kim's objection: a gain should follow what the farmers do, not a village's age, and its size needs evidence.

How the evidence is marked. Every figure carries one of: **[checked]**, read in the source or in a secondary that quotes it, this session (the secondary named); **[memory]**, from the literature as I know it, not checked this session, with the source I would check; **[estimate]**, my own reckoning, with how it was reached. Where I am unsure a citation is exact (year, title), I say so. No citation here is made up; some are named with less than their full bibliographic detail, and those are flagged.

Contents: 1. The short answer. 2. The mechanisms, one by one. 3. What the game already holds. 4. The proposed model and the village-age rule against it. 5. Decisions taken without Kim. 6. Proposed text for `design.md`. 7. Implement tasks, sketched. 8. Design choices for Kim. 9. What I could not verify. Sources.

## 1. The short answer

1. **In the Nordic setting, yields per seed hardly rose between the high Middle Ages and the late 18th century.** Leijonhufvud (2001) and Hallberg et al. (2016), working on Swedish tithe series from the 1500s on, found it hard to discern any clear long-term rise in productivity before the late eighteenth century; Ljungqvist et al. (2023) report this and build their own analysis on detrended series for that reason **[checked, through Ljungqvist et al. 2023]**. The great rise came with the agrarian revolution of about 1750 to 1870: enclosure (*storskifte*, *enskifte*, *laga skifte*), clover and ley, the iron plough, drainage, the potato (Gadd 2000) **[memory]**.
2. **Before that, output grew mostly by more land, not by more grain an acre**, and by changes in what was grown (rye's spread, Myrdal 1997, 1999) **[memory]**. Where yields did change in the medieval centuries, the literature argues over why: Postan's thesis of falling yields as arable pushed out pasture and so manure (Postan 1966) against Campbell's reading that exhaustion is inferred, not measured, and that climate and markets matter more (Campbell 2000) **[checked, through Overton 2007 and search summaries]**.
3. **So a steady century-long rise is not the historical default; a rise earned by keeping more stock to the acre, and a fall when the fields outrun the meadows, both are.** The one mechanism with a measured century timescale is the slow build-up of organic matter in long-dunged soil (Rothamsted's Hoosfield: a plot dunged from 1852 to 1871 still held two-thirds more organic carbon than the unmanured plot in 2008 **[checked]**). That is the mechanism this review proposes in place of the village's age.
4. **The game already holds most of the state these mechanisms act through:** soil and manure a field, herds and hay, meadows competing with fields for land, rotations and fallow (VB-350, ready), crops (rye, peas), the weather (VB-354, ready). Tools and iron come with slice 6 (VB-121); drainage and the wetness of a place with slice 10. What is missing is a slow store in the soil, so the proposal is one new per-field value, read in closed form.

## 2. The mechanisms

The game's scale, for converting: a field is about 1.95 ha (`design.md`, World and scale); it gives 100 rations at soil, fertility and weather 1 for 25 of seed, a 4:1 yield ratio (Slicher van Bath 1963). A change of 0.1 in the yield ratio at 4:1 is 2.5 rations gross a field; a 10% change in the harvest is 10 rations gross and, the seed being fixed, about 13% of the 75 net.

### 2.1 Manure, and the ratio of meadow and stock to arable

**The mechanism.** In an infield–outfield system the field took no nutrients from anywhere but the meadow and the grazing: hay and grass fed the stock, and the stock's dung, gathered in the byre over winter, was carted to the fields (*äng är åkers moder*, the meadow is the mother of the field; Myrdal 1999 for the Swedish system) **[memory; the saying and Myrdal are already in `design.md`, Animals]**. Overton (2007) makes the point that matters for a model: animals do not make nutrients, they move them, from the meadow and outland to the field **[checked]**. So the yield of the arable is bounded by the ratio of meadow and grazing to arable, and by how many stock winter on it.

**Evidence and size.**
- Postan (1966) argued that as population grew in the 12th and 13th centuries, arable spread over pasture, stock and so manure fell, and yields fell; the evidence was mostly the Winchester accounts (Titow 1972), which show falling yields of spring grain in the later 13th century **[checked, through Overton 2007]**.
- Against it: Campbell (2000) notes that exhaustion has been inferred rather than measured **[checked, through Overton 2007]**. Newman and Harvey (1997) drew nutrient balances for Cuxham (Oxfordshire), 1320 to 1340: nitrogen and potassium accumulated while phosphorus was lost, and nitrogen imports (bought hay, legumes) made up only about a third of nitrogen's losses on their reckoning **[checked, through Overton 2007; the source's table not read]**. A working paper by Schneider (1990, Nuffield College, Oxford) found stocking rates and legumes had small or even negative effects on demesne grain yields **[checked only as a search summary: to be read before it is relied on]**. Campbell (2000) does find the intensive mixed farming of eastern Norfolk, heavy in stock, labour and legumes, among the highest yields of medieval England (Campbell 1983 for the case) **[memory]**.
- Size: none of these gives a clean elasticity of yield to stocking density that I could check. My estimate from the game's own numbers: a farm whose stock keeps its fields at the cap (1.15) out-yields one with none, its fields at the floor (0.75), by about 50%; the historical contrast between well- and poorly-stocked farms in one region was probably a fraction of that, of order 10 to 30% **[estimate; no source pins it]**.
- **Timescale:** the fast part (this year's dung, this year's crop) is a year or two; the slow part, below, decades to a century.

**The slow part: organic matter.** Dung does more than feed one crop: some of it stays as organic matter, which holds water and nutrients and releases them slowly, and builds up over decades under steady manuring. Rothamsted's Hoosfield barley experiment (from 1852) shows it plainly: in 2008 the topsoil (0 to 23 cm) held 3.53% organic carbon on the plot dunged every year since 1852, 1.36% on the plot dunged only from 1852 to 1871, and 0.82% on the unmanured plot (Rothamsted eRA, Hoosfield soil properties) **[checked]**. The dunged plot's carbon rose quickly for some decades and then slowly towards a level it had nearly reached after about a century (Jenkinson and Johnston 1977) **[memory]**; and the residue plot's carbon fell back over a century and more without reaching the control's. The dose, 35 t of dung a hectare a year **[checked]**, is several times any medieval rate (which I put at a few tonnes a hectare a year on a well-stocked infield, **[estimate]** from a cow's few tonnes of winter dung a year and a few hectares of arable a farm), so a medieval field moves on the same timescale but to a far smaller level. Long-dunged infield soils with deepened dark topsoil (anthrosols, the plaggen soils of the North Sea coast and the old infields of Norway and western Sweden) are the historical counterpart **[memory]**.

What this gives the game: **a slow pool, raised by the dung a field gets over decades and fading over decades when it stops**, the one mechanism with evidence on a century's timescale that is also tied to what the farmers do.

### 2.2 Fallow and rotation: one, two and three courses

**The mechanism.** A fallow year rests the field: weeds are ploughed in, some nitrogen is mineralised and, where the village grazes the fallow, dung falls on it. In the Nordic lands three systems stood side by side: one course (*ensäde*, the field cropped every year, its fertility kept by heavy dunging) in the west, the north and the forest districts; two courses (*tvåsäde*, a crop and a fallow) in the Mälaren valley and Östergötland, spreading there with winter rye from about the 12th century; three courses (*tresäde*) in Skåne and Denmark (Myrdal 1997, 1999; Myrdal and Morell 2011) **[memory]**.

**Evidence and size.** What the change from one to two or three courses did to the yield of a sown field is not well measured for the North **[memory: I know no Nordic series that separates it]**. What it did to a farm is clearer: two courses halve the land sown each year, so a farm under two courses yields more a sown acre but not necessarily more in all, and it needs less dung per acre of arable; three courses sow two-thirds. Lynn White (1962) made the three-course system and the heavy plough the engines of medieval growth; that reading has long been contested (for example in Sawyer and Hilton's review of 1963) **[memory]**. Boserup (1965) reads it the other way: fallow shortens as people press on land, and labour an acre rises **[memory]**. Legumes in the rotation (peas, beans) add nitrogen; clover, the great addition, came only in the 17th and 18th centuries and is put at some 60% more nitrogen for northern Europe's farming (Chorley 1981) **[checked, through Overton 2007]**.

**Timescale:** a rotation acts in its own years; its spread through a district took generations (rye and two courses in central Sweden, roughly the 11th to 13th centuries) **[memory]**.

**In the game:** VB-350 (ready) builds rotations; fallow mends soil +0.08 a year to 1.0, peas +0.04, and a three-course field wants a third of the dung (`design.md`, The first crops). So the gain rotation gives a field is already in the plan, emergent from what the head chooses, and needs no new rule. One gap is noted under 2.1: manure does not go above the cap, so a farm in three courses with stock to spare wastes its dung.

### 2.3 Tools: ard to plough, iron shares

**The mechanism.** The ard scratches the soil; the mouldboard plough turns it, burying weeds and stubble, and with ridges drains it. Iron on the share and the spade lets either cut deeper and last.

**Evidence and size.** In Sweden and Norway the ard (*årder*) remained the common tool of most districts into the early modern period; the wheeled mouldboard plough came to Denmark and Skåne in the high Middle Ages (Myrdal 1986, *Medeltidens åkerbruk*; Myrdal 1997) **[memory]**. Myrdal (1986, published in Swedish with an English summary under the title *Medieval arable farming in Sweden: technical change A.D. 1000–1520*) treats the period as one of real technical change: iron in the ard's share, the scythe and the harrow **[checked: the title; its contents memory]**. An experimental study at SLU, with replica ard shares, put the iron worn away ploughing a normal Uppland farm at a little over 1 kg a year **[checked, search summary; author not checked]**. I know of no study that measures a yield gain from the ard's iron share or from the plough in the North; the plough's advantages are argued as labour, heavy clay that the ard could not work, weed control and drainage by ridging **[memory]**.

**Timescale:** a tool is adopted in a year where it is available; its spread took centuries.

**In the game:** the ox team at the ard already speeds tilling (`design.md`, Tilling power); slice 6 builds tools that wear and iron that lifts their ceiling (VB-121: work at 70 to 100%). The design has Decided that skill acts on choices and timing only, never as a yield multiplier; tools are best read the same way: they act on time (a late sowing, a missed weeding round), which the game already turns into yield. A plough that buries weeds (a smaller cut a missed weeding round) is a possible later rule, out of reach before slice 6.

### 2.4 Seed selection and crop mix

**Seed.** Medieval farmers kept their own seed; landraces were adapted to their place over centuries, but I know of no evidence of deliberate selection that raised yields measurably before the 18th and 19th centuries **[memory]**. Seed was sometimes changed between farms or bought after a failure, but the gain is not measured. **No mechanism proposed** (Deciding without Kim, 7: detail that gives no decision).

**Crop mix.** The big change of the period is rye: winter rye spread in central Sweden with the two-course system, and gave more an acre on light soils and a crop in a different season from barley; oats spread later on poorer and wetter ground (Myrdal 1999; archaeobotany, for example Viklund 1998) **[memory]**. Its effect is on risk and the calendar more than on a field's yield ratio, which the game's crop table already treats so (rye at 4:1, the same as barley). **In the game:** the crops arch (VB-346 to VB-356) holds it; nothing new.

### 2.5 Drainage and clearing stones

**Stones.** Clearance cairns (*röjningsrösen*) from the Iron Age on show fields cleared of stones by hand **[memory]**. Clearing raises the area that can be tilled and the speed of tilling; it is a once-and-for-all gain made when a field is made. **In the game:** already so (Making a field: stones up to 20 hours, the stones become building material). Nothing new.

**Drainage.** Ridged fields and open ditches are medieval; systematic ditching and later tile drainage in Sweden belong mainly to the 18th and 19th centuries (Gadd 2000) **[memory]**. On wet clay the gain was large; I have no checked number **[estimate: a wet field might gain a quarter or more; not to be built on without a source]**. **In the game:** marsh fields have fertility 0.5 and a river's bank +0.2; the wetness of a place is listed as "not yet in" (`design.md`, Crops and the weather). Out of reach before slice 10; a later project (ditch a field) would raise a wet field's fertility.

### 2.6 Climate, the confound

The Medieval Climate Anomaly (about 950 to 1250) and the colder centuries after it (the Little Ice Age, from about 1300 or 1550, by the definition used, to about 1850) moved yields at the northern margin as much as any practice did **[memory; the dating differs between authors]**. For Sweden the year-to-year signal is mainly summer soil moisture: wetter summers gave larger tithes, and June to August temperature correlates negatively (Ljungqvist et al. 2023, on county tithe series from 1572, with earlier data from Leijonhufvud 2001 and Myrdal and Söderberg 1991) **[checked]**. A trend in yields over centuries in a historical series cannot be read apart from climate (and, for tithes, from a falling share of the harvest tithed; Leijonhufvud 2001, as reported there) **[checked, through Ljungqvist et al. 2023]**.

**In the game:** VB-354 (ready) gives each crop its own reading of a season's weather; slice 10 the weather a region. A slow drift of the climate is not designed; it would be the one rule that makes yields fall over centuries whatever the farmers do. It is Kim's choice (8, question 5).

**A citation to correct.** `design.md`, The first crops, cites "Climate of the Past 19, 2463, 2023, on Nordic rye" for rye's four grains to one. That article is Ljungqvist et al. (2023), "Climatic signatures in early modern European grain harvest yields": it uses tithe series for Sweden, not yield ratios, and gives no figure of four to one for rye **[checked]**. The four-to-one figure came from the ReSeed project's web page, "Variability and dynamics of Nordic rye" (2023), which `docs/review-expansion.md` cites. The design's line should cite the ReSeed page, or Slicher van Bath alone.

### 2.7 Summary

| Mechanism | Evidence | Size | Timescale | Game state it acts through | In reach |
| --- | --- | --- | --- | --- | --- |
| Manure, this year's | Myrdal 1999; Overton 2007 (moves nutrients) | Floor 0.75 to cap 1.15 today (the game's, not a source's) | 1 to 2 years | `fd.soil`, `hh.manure`, herds, hay | Built (VB-137) |
| Meadow and stock to arable | Postan 1966 against Campbell 2000; Newman and Harvey 1997; Schneider 1990 | Disputed; 10 to 30% between farms [estimate] | Decades, as land fills | Meadows, herds, fields competing for tiles | Built, emergent |
| Organic matter, the slow pool | Rothamsted Hoosfield [checked]; Jenkinson and Johnston 1977 | +0.05 to 0.15 of yield after a century of steady dung [estimate, scaled down from Hoosfield] | Decades to a century, both ways | Nothing yet: **the proposal** | New, small |
| Fallow and rotation | Myrdal 1997, 1999; White 1962 against its critics; Boserup 1965 | A sown field gains, the farm's total may not | Years; spread over generations | `fd.crop`, rotation (VB-350), fallow mend | VB-350, ready |
| Legumes, clover | Chorley 1981 via Overton 2007 | +60% nitrogen (clover, 17th to 18th c.) | Decades | Peas (VB-349) | Peas built; clover out of period |
| Ard to plough, iron | Myrdal 1986, 1997 | No measured yield gain; labour, heavy soils | Centuries to spread | Oxen (VB-138), tools (VB-121, slice 6) | Slice 6 |
| Seed selection | None found | None measured | | Seed is grain (crops arch) | Not proposed |
| Crop mix (rye, oats) | Myrdal 1999; Viklund 1998 | Risk and calendar, not ratio | Generations | Crops arch | Built or ready |
| Stones | Clearance cairns | Area and work, once | At making | Making a field | Built |
| Drainage | Gadd 2000 | Large on wet clay [estimate] | 18th to 19th c. mainly | Fertility, a place's wetness | Slice 10 |
| Climate | Ljungqvist et al. 2023; Leijonhufvud 2001 | Year to year: large; trend: confounds all | Decades to centuries | `st.weather`; VB-354; slice 10 | VB-354; drift not designed |

## 3. What the game already holds

Read from the code at `c3b11b5`.

- **Soil a field** (`src/sim/fields.js`, `src/sim/rules.js` `SOIL`): `fd.soil` multiplies the harvest at reaping (`reaped`: yield × `fd.fert` × `fd.soil` × `st.weather` × chance × weeding × trampling × browsing). Each crop wears it (`CROPS[crop].wear` 0.08 to `SOIL.floor` 0.75); peas mend +0.04 and fallow +0.08 a year to `SOIL.start` 1.0; manure raises it +0.04 a load to `SOIL.cap` 1.15, and only manure goes above 1.0. A field on ground never farmed starts at `SOIL.fresh` 1.4 (VB-149). `fd.fert` is the tile's biome (meadow 1, heath 0.65, hills 0.7, marsh 0.5) and +0.2 by a river.
- **Manure** (`src/sim/byre.js`): stall feeding adds 0.2 loads a head of cattle and 0.04 a sheep a stall day to `hh.manure` (21 stall days: about 4.2 loads a cow a winter); the heap loses half a year, in closed form a day; in spring days 1 to 6 the heap goes to the poorest unsown field **until it reaches the cap** (`manureWanted`, `manureDone`). Dung beyond what brings every field to the cap stays on the heap and rots. A field of barley every year needs 2 loads a year to stay at the cap; one in three courses, two-thirds of a load.
- **Herds and hay** (`src/sim/herds.js`, `src/sim/byre.js`, `src/sim/meadows.js`, `src/sim/grazing.js`): meadows made as built land, hay to two winters' need, the autumn count to the hay, so the meadow-to-stock-to-dung loop exists, and so does the competition of fields and meadows for the same tiles.
- **Rotations and crops** (VB-346 to VB-356): rye, peas and fallow rows are in `CROPS`; a field's rotation and step come with VB-350 (ready); the head's choice with VB-351 and on.
- **Weather**: one yearly factor `st.weather` today; VB-354 (ready) gives each crop its reading of a season.
- **Tools and iron**: not yet (VB-121, VB-364, slice 6).
- **What is missing:** any state that remembers a field's past beyond `fd.soil`; nothing records how long or how well a field has been dunged. The village has no age record either (`v.farmedSince` was proposed for the old rule and never built).

Out of reach before a later slice: tools and the plough (slice 6), drainage and a place's wetness (slice 10), a climate drift (slice 10, if Kim wants one), grazed fallow (left for later by the crops plan).

## 4. The proposed model: tilth, a slow pool built by dung

### 4.1 The rule

Each field holds a second, slow quantity beside its soil: **tilth**, the organic matter and good structure that years of dung leave in the ground. Names are proposals.

- **Gain.** Each load of manure spread on a field adds `TILTH.perLoad` to its tilth, whatever its soil.
- **Loss.** Tilth fades by itself, exponentially, with a time constant `TILTH.years` (in game years): organic matter is used by crops and decomposes whether or not the field is cropped.
- **Effect.** The harvest is multiplied by (1 + tilth), at reaping, beside the soil.
- **Read in closed form.** A field stores `tilth` and `tilthAt` (the tick it was last set); its value now is `tilth × exp(−(now − tilthAt) / (TILTH.years × YEAR))`. It is brought up to date only when manure is spread on it and read only at reaping: no pass over fields, no daily work (Rules for cost, 3).
- **No cap that binds.** The level is bounded by the dung a farm has: at a steady `L` loads a year, tilth tends to `L × perLoad × years`. An invariant bound (`TILTH.max`) catches errors and should never bind in play.

**Starting values** [estimate, chosen to match the Agreed size of the old rule, "about 10% after 100 years", but earned]: `perLoad` 0.0011, `years` 70. A field of barley every year, kept at the cap (2 loads a year), tends to 2 × 0.0011 × 70 = 0.154, and reaches 0.154 × (1 − e^(−100/70)) ≈ 0.117 after a century and about 0.07 after 40 years. When the dung stops, it loses half in about 49 years (70 × ln 2), as Hoosfield's residue plot keeps its lead for a century. `TILTH.max` 0.4.

In rations a field (meadow, weather 1, soil at the cap 1.15): 115 gross today; at tilth 0.117, 128.5, so +13.5 gross and +18% of the 75 net (the seed is fixed). The yield ratio goes from 4.6:1 to 5.1:1, within the range of three to six fold that I recall for the Nordic 16th and 17th centuries **[memory]**.

### 4.2 Where the dung goes (a gap in today's rule)

Today a field takes manure only up to the soil's cap, so a well-stocked farm, and every farm in two or three courses, throws dung away; and the old rule would raise the cap whether or not there was dung to fill it. With tilth, dung beyond the cap has a use. Proposed: in the spring spreading, once every unsown field is at the cap, the heap's remaining loads are spread over the fields at the cap, the one with the least tilth first, up to `TILTH.surplus` loads a field a year (2). The loads beyond the cap raise tilth only. It adds carting work (real work: the manure job already exists and the cart rates apply), and it makes the ratio of stock to arable matter above the cap, which is the historical mechanism. This is Kim's choice (8, question 3), since it changes how the existing manure job behaves.

With surplus spreading, a field of barley every year at 2 loads plus 2 surplus loads tends to 0.31 (so `TILTH.max` 0.4); a field in three courses on a farm with stock to spare gets its two-thirds of a load plus 2, about 0.21. Without surplus spreading, a three-course field gets two-thirds of a load a year and tends to 0.05: rotation would then cost tilth, which is backwards.

### 4.3 Who it touches, and what it does not do

- **No village age, no years of farming.** A farm that keeps stock and dungs its fields gains, over decades; one that has no cattle, or loses its meadows to fields, does not, and a field abandoned or no longer dunged fades. A village's yields can fall as it grows, if its fields outrun its meadows (Postan's mechanism, which the game already contains). A rise over a long game is then what the players' and heads' choices leave, not a schedule (Deciding without Kim, 8).
- **Skill is still never a multiplier.** A good head gains tilth only by the choices it makes (keeping stock, making meadow, spreading dung): the Decided rule on skill stands.
- **New fields.** A field broken on fresh ground starts at tilth 0 and soil 1.4: the fresh soil is the forest's store, used in a few crops; tilth is what dung builds after. A field broken again on old ground (`w.dev` set) has 0 too: the old farm's tilth went with its field record. (Keeping a tile's tilth when a field is abandoned and re-broken would need state on the tile; not proposed.)
- **Shares and inheritance.** The field record goes with the farm, so tilth is inherited with the land as the soil is. Nothing moves.
- **The hard rule.** Nothing teleports: tilth comes only from dung carted to the field by a pawn.
- **Acts.** No new verb: the manure job is the household head's existing act, chosen on the plan's day.

### 4.4 What the player sees

- **On the field's card**, beside "Soil" (the ground's worth) and "Condition" (worn or dunged, 100 unworn), a third row on the same meter: **"Old dung"** or **"Tilth"**, 0 to 40, with the soil icon's variant and the note "built by N years of dung" (the years read as tilth over this field's yearly gain at its current dung; no history is kept). Like is shown alike (rule 15): it is a level, so it is the meter.
- **On the farm's card**, the mean tilth of its fields, a meter, so the player compares farms at a glance; on the village card, the same, so an old, well-stocked village is seen against a young one.
- **No forecast.** The card shows what the field holds now, not what it will give (rule 14). A head's estimate of a field's yield (VB-351's) reads tilth as it reads soil, by its own bias.
- **No log lines**: tilth changes every spring on every dunged field; routine events are not recorded (Rules for cost, 8).

### 4.5 The village-age rule, set against it

| | Village age (the reopened rule) | Tilth (proposed) |
| --- | --- | --- |
| What raises yields | Years since the village began farming | Dung carted to the field, over decades |
| A farm without cattle | Gains like any other | Gains nothing |
| A village whose fields outrun its meadows | Gains | Falls back (fewer loads a field) |
| Historically | No source; a schedule | Hoosfield's timescale; the meadow's mother-of-the-field loop; Postan's mechanism both ways |
| Deciding without Kim, 8 | Sets the outcome (a patch) | A mechanism |
| Generated villages imagined old | Need a made-up start year | Start from their herds (8, question 4) |
| State | One number a village (`v.farmedSince`), saved | Two numbers a field (`tilth`, `tilthAt`), saved with the field |
| Build | XS: a field in `st`, `SOIL.cap` read through a function of the village | S: two field values, a closed-form read, the manure job's limit, a meter on two cards; M with surplus spreading |
| Run | A read at manuring | One `exp` at manuring and at reaping, a field a year: about 700 fields at `medium-ref` [estimate: about 170 farms × 4 fields], so some 1,500 reads a year; nothing daily |
| Save | One number a village | Two numbers a field; plain data; no `WORLD` entry (fields are saved with farmsteads) |

Both are cheap; the choice is between a schedule and a mechanism.

### 4.6 Measuring it (for the implement task)

Numbers before and after on populous small, seeds 3, 7, 11, 42, 30 years (the long game, since tilth takes decades) and founders small, the same seeds, 60 years: mean tilth by farm and by herd (cattle a field), harvest a field by decade, hungry household-years, loads spread a field-year (to the cap and beyond), and whether households, not only averages, are better off. A band for the wrap-up (`tests/lib/bands.js`, report): mean tilth of farms with cattle against farms without at year 30, which should differ by about 0.05 or more [estimate].

## 5. Decisions taken without Kim

Each is a decision under Deciding without Kim, with its reason; the close calls are among the questions in section 8.

1. **Survey scope: the Nordic lands first, England for the arguments.** The Nordic series (Swedish tithes) give the trend; the debate over manure and yields is English (Postan, Titow, Campbell, Overton), and its mechanisms carry. Principle 7: detail grounded in history where it gives a decision.
2. **Seed selection: no mechanism.** No evidence of a measurable gain in the period; seed already is grain and knowledge in the crops plan. Principle 7.
3. **Tools: no yield multiplier.** Tools act through time (slice 6's work rate) and so through timing and weeding, which the game already turns into yield; this mirrors the Decided rule that skill is never a yield multiplier. Principle 8 and the crops plan's "What skill never does". (A close call: see question 6.)
4. **Stones: nothing new.** Already a one-time cost of making a field.
5. **Rotation: nothing new beyond VB-350.** The fallow and pea mends already make rotation raise a sown field's soil; adding a yield bonus for a rotation would count it twice. Principle 3.
6. **The slow pool's form: exponential fade with one time constant, stored as value and time.** It is the simplest closed form (Rules for cost, 3) and matches a first-order reading of organic matter's turnover (a single pool, as in the simplest soil carbon models; Rothamsted's own RothC uses several pools, which is detail the game does not need) **[memory for RothC]**. Principle 3: two named tunables with physical meaning (a load's contribution, the turnover time).
7. **Starting values matched to the Agreed size** (about +10% after a century of good dunging), since that size was agreed on 2 Nov and the evidence neither confirms nor refutes it; the decay time from Hoosfield's century-scale persistence. Principle 10: the mechanism changes, the agreed size stays as its first parameterisation.
8. **Fresh land unchanged** (soil 1.4, tilth 0): the two are different stores, one used up, one built.
9. **Tilth not kept on the tile** when a field is abandoned: it would need tile state for a small effect. Principle 7.

## 6. Proposed text for `design.md`, Goods and the farming year, Yield over time

To replace the row "Yield over time" (and its citation fix in The first crops), once Kim has answered:

| Aspect | Design | Status |
| --- | --- | --- |
| Yield over time | Yields rise over a game only as the farmers earn it. A field holds its **tilth**, the organic matter that years of dung leave in the ground, beside its soil: each load of manure spread on it adds 0.0011, and it fades by itself with a time constant of 70 years, so a field kept dunged at 2 loads a year gains about 7% of yield in 40 years and 12% in a century, and keeps half its gain for about 50 years once the dung stops; the harvest is multiplied by (1 + tilth). Dung beyond what brings a field's soil to its cap is spread for tilth, up to 2 loads a field a year, the field with least tilth first. Nothing else raises yields by age: rotations (fallow and peas mend the soil), crops, timing and weeding are the head's choices, tools (slice 6) act on time, and a village whose fields outrun its meadows loses tilth as its dung a field falls (Postan 1966, against Campbell 2000; Rothamsted's Hoosfield for the century timescale; Swedish tithes show no clear rise before the late 18th century, Leijonhufvud 2001). The field's card shows tilth as a meter; farm and village cards its mean. Generated villages' fields start at the tilth their farm's starting herd would hold them at (`docs/review-yields.md`) | Decided (rise), 30 Oct; the mechanism Proposed, 16 Nov (VB-160), replacing the village's age (Agreed 2 Nov, reopened 5 Nov) |

And in The first crops, the rye bullet: "Late medieval Scandinavian rye is put at about four grains for one sown on permanent fields, and far more on burnt-over ground (the ReSeed project, 'Variability and dynamics of Nordic rye', 2023, a web summary; to be read in a published source)", in place of the Climate of the Past citation.

## 7. Implement tasks, sketched

Provisional IDs from the run's reservation; to be written with numbers and criteria once Kim has answered.

| ID | Title | Size | Criteria in brief |
| --- | --- | --- | --- |
| VB-717 | Tilth: a field's slow soil, built by dung | S | `TILTH` rules (`perLoad`, `years`, `max`); `fd.tilth`, `fd.tilthAt` (`@state`, invariants: 0 ≤ tilth ≤ max, `tilthAt` ≤ now; a `tools/stocks.js` line); gain at `manureDone`, read in closed form at `reaped`, harvest × (1 + tilth); no daily pass; a test on a constructed field (dung for 100 game years: 0.117 ± 0.005; stop for 49: half); numbers before and after, populous small and founders small, seeds 3, 7, 11, 42, 30 and 60 years |
| VB-718 | Surplus dung goes to tilth | S | `manureWanted` spreads the heap beyond the cap, least tilth first, up to `TILTH.surplus` a field a year; carting hours reported; loads rotted on the heap before and after; only if Kim says yes to question 3 |
| VB-719 | The scenarios' fields start with their tilth | XS | Generated villages and populous farms: tilth at the steady state of their starting herd's dung over their fields (or Kim's choice, question 4); founders' fields at 0; `same.js` unaffected elsewhere |
| VB-720 | Tilth on the field, farm and village cards | S | A meter row on the field's card beside Soil and Condition; the mean on farm and village cards, one presentation (rule 15); `node tests/smoke.js`, the browser test of cards; a screenshot under `docs/img/` |
| VB-721 | Report: dung, tilth and the meadow ratio | S | `tools/balance.js` (or `tools/sim.js --report soil`): loads a field-year, mean tilth by farm with and without cattle, meadow tiles to field tiles a village, harvest a field by decade; a `report` band for the wrap-up VB-048 |
| VB-722 | Draining a wet field (slice 10) | M, blocked | A ditching project on a wet field raises its fertility; waits for the wetness of a place (slice 10); needs a source for the size |
| VB-723 | The plough buries weeds (slice 6) | S, blocked | Only if Kim answers question 6 so: a household with a mouldboard plough (iron, slice 6) loses less to a missed weeding round |
| VB-724 | Climate drift (slice 10) | S, blocked | Only if Kim answers question 5 so: a slow drift in the season's warmth over centuries, read by the crops' existing readings |

And the backlog's own changes, for the orchestrator: VB-048's third criterion and its `Waits for:` line name VB-717 (and VB-718, VB-719), not VB-160; the rye citation in `design.md`.

## 8. Design choices for Kim

1. **What replaces the village's age?** (a) Tilth, a slow pool built by dung and fading over decades (proposed); (b) keep the village-age rule (cap +0.1 a century); (c) no long-run rule at all: yields move only by rotation, crops, dung to the cap and weather, as the Swedish tithe series suggest; (d) a cap that rises with a field's total dung ever received, never fading. *Proposed: (a). It ties the gain to dung, has a measured century timescale, and lets yields fall when fields outrun meadows; (c) is the most faithful to the Nordic trend but moves the Decided rise.*
2. **Its size and speed?** (a) +12% after a century at 2 loads a year, half lost in 50 years once dung stops (`perLoad` 0.0011, `years` 70; proposed); (b) faster and smaller, +8% within 30 years (`years` 30); (c) half the size, +6% a century. *Proposed: (a). It keeps the size agreed on 2 Nov, now earned, and the decay matches Hoosfield's century-long residue.*
3. **Does dung beyond the soil's cap go to tilth?** (a) Yes, up to 2 loads a field a year, least tilth first (proposed); (b) no, spreading stops at the cap as now; (c) yes, with no limit a field. *Proposed: (a). Without it a farm in three courses gains almost no tilth, and the stock-to-arable ratio stops mattering at the cap.*
4. **Where do the scenarios' fields start?** (a) At the steady state of their farm's starting herd (proposed); (b) at 0 everywhere; (c) a fixed 0.1 for generated villages, 0 for founders. *Proposed: (a). An old village is imagined as farmed with its herd; this places its tilth by a mechanism and needs no made-up age.*
5. **A climate drift as the confound?** (a) None: weather varies year to year about a fixed normal (proposed for now); (b) a slow cooling from the 14th century (the Little Ice Age), built with slice 10; (c) leave it to slice 10's plan. *Proposed: (a) with (c): the evidence is real but its size at the margin needs slice 10's regions; note it there.*
6. **Do tools raise yields?** (a) No: tools act on work time, and so through timing and weeding (proposed, as skill); (b) a plough with an iron share cuts the weeding loss (VB-723); (c) a small yield multiplier for iron. *Proposed: (a). No Nordic evidence measures a yield gain from the share or the plough; a multiplier would be a patch.*
7. **Drainage?** (a) A later project that raises a wet field's fertility, with slice 10 (proposed); (b) not at all. *Proposed: (a). It is a real land improvement and a decision for a head, but it needs the wetness of a place and a source for its size.*
8. **What is the meter called?** (a) "Tilth" (proposed); (b) "Old dung"; (c) "Humus". *Proposed: (a). A farmer's word for good, worked ground; "humus" is a later scientific word.*

## 9. What I could not verify

- The exact numbers of the classic yield-ratio studies (Slicher van Bath 1963; Titow 1972; Campbell 2000; Myrdal and Söderberg 1991) were not read this session; the ratios quoted are from memory and marked so.
- Schneider (1990) is known to me only from a search summary of a Nuffield College working paper; its finding (small or negative effects of stocking on yields) needs reading before it is relied on.
- Newman and Harvey (1997) and Chorley (1981) are cited through Overton (2007); their tables were not read.
- Hoosfield: the 2008 carbon values are checked; the time course (fast rise, then slower, near equilibrium in a century) and any residual yield effect are from memory (Jenkinson and Johnston 1977).
- The spread and dating of one, two and three courses in Sweden and of the plough in Denmark and Skåne are from memory of Myrdal's work; the 1986 book's title is checked, its contents not.
- The SLU experiment on ard-share wear: the finding is checked through a search summary; its author and year were not.
- I found no source that measures, for the medieval North, a yield difference between well- and poorly-dunged farms, or between ard and plough; the sizes in sections 2.1 and 4 are estimates.
- Leijonhufvud (2001), *Grepp om gärden*: I am confident of the author and year (Ljungqvist et al. 2023 cite them); the full title and the book itself were not checked.

## Sources

Checked this session (directly or through the secondary named):
- Ljungqvist, F. C., et al. (2023). Climatic signatures in early modern European grain harvest yields. *Climate of the Past* 19, 2463–2491. https://cp.copernicus.org/articles/19/2463/2023/
- Overton, M. (2007). Agronomy and agricultural history in England. In P. Robin, J.-P. Aeschlimann and C. Feller (eds), *Histoire et agronomie*, IRD Éditions, 247–258. https://books.openedition.org/irdeditions/4668 (for Postan 1966, Titow 1972, Campbell 2000, Newman and Harvey 1997, Chorley 1981).
- Rothamsted Research, electronic Rothamsted Archive: Hoosfield Spring Barley, soil chemical and physical properties. https://www.era.rothamsted.ac.uk/info/rhb2/hfsoils
- Myrdal, J. (1986). *Medeltidens åkerbruk: agrarteknik i Sverige ca 1000 till 1520* (English summary: *Medieval arable farming in Sweden: technical change A.D. 1000–1520*). Nordiska museet. (Title checked in the FAO AGRIS record; Swedish title from memory.)
- Myrdal, J. and Morell, M. (eds) (2011). *The Agrarian History of Sweden: From 4000 BC to AD 2000*. Nordic Academic Press (chapter 3, Myrdal, "Farming and feudalism, 1000–1700"; title checked).
- Myrdal, J. (1997). The agricultural transformation of Sweden, 1000–1300. In G. Astill and J. Langdon (eds), *Medieval Farming and Technology*, Brill, 147–171. (Title, pages checked; editors from memory.)
- Schneider (1990), Nuffield College economic history discussion paper 90 (search summary only). https://www.nuff.ox.ac.uk/economics/history/Paper90/schneider90.pdf
- ReSeed project (2023). Variability and dynamics of Nordic rye (web page, as cited in `docs/review-expansion.md`).

From memory, not checked this session:
- Slicher van Bath, B. H. (1963). *The Agrarian History of Western Europe, A.D. 500–1850*; and *Yield ratios, 810–1820* (A.A.G. Bijdragen 10, 1963).
- Postan, M. M. (1966). Medieval agrarian society in its prime: England. *Cambridge Economic History of Europe*, vol. 1, 2nd edn.
- Titow, J. Z. (1972). *Winchester Yields: A Study in Medieval Agricultural Productivity*.
- Campbell, B. M. S. (1983). Agricultural progress in medieval England: some evidence from eastern Norfolk. *Economic History Review* 36. Campbell (2000). *English Seigniorial Agriculture, 1250–1450*.
- Campbell, B. M. S. and Overton, M. (eds) (1991). *Land, Labour and Livestock* (with Shiel, R. S., Improving soil productivity in the pre-fertilizer era; record checked, contents not).
- Jenkinson, D. S. and Johnston, A. E. (1977). Soil organic matter in the Hoosfield continuous barley experiment. Rothamsted Report for 1976, part 2.
- Myrdal, J. (1999). *Jordbruket under feodalismen 1000–1700* (Det svenska jordbrukets historia, vol. 2).
- Gadd, C.-J. (2000). *Den agrara revolutionen 1700–1870* (Det svenska jordbrukets historia, vol. 3).
- Leijonhufvud, L. (2001). *Grepp om gärden* (dissertation, on Swedish tithes and harvests of the 16th century; full title not checked).
- Myrdal, J. and Söderberg, J. (1991). *Kontinuitetens dynamik: agrar ekonomi i 1500-talets Sverige*.
- Hallberg, E., et al. (2016), on Swedish harvests from tithes (cited by Ljungqvist et al. 2023; details not checked).
- White, L. Jr. (1962). *Medieval Technology and Social Change*; Sawyer, P. H. and Hilton, R. H. (1963), its review in *Past and Present*.
- Boserup, E. (1965). *The Conditions of Agricultural Growth*.
- Viklund, K. (1998). *Cereals, weeds and crop processing in Iron Age Sweden*.
