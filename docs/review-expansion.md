# Review: crowded villages and moving to new land

1 November 2026. A review of how villages grow today, and what happens when one runs out of room. It grounds a new rule in the history of medieval Scandinavian settlement: landless adults of a crowded village move out to found a farm of their own on new land, or join a small village nearby. It also shapes that rule for play. Kim answered four questions on 1 November 2026 (recorded under "Decisions"). The rule is built in VB-146 to VB-150.

Measurements are from `populous` on the small map (about 350–660 people) at seeds 7 and 42, and `founders` on the small map at seeds 7 and 42, at `91daa68`.

## 1. The state of the game

A landless adult can get a household of their own in one way only: the village clears a plot (VB-031) and builds its cottage (VB-032). Claiming an empty farm (VB-033) is a stub that returns null, service where labour is short (VB-090) is not built, and splitting land (VB-034) waits for VB-032's follow-ups. A plot needs a house tile and a field within 6 steps of the green (`findSite`, `src/sim/expansion.js`), and a village runs at most two plots at a time.

Nobody ever leaves their village, and no village is founded during play. Once the land within 6 steps is taken, the village's landless adults wait for life: under the default residence custom ("with the land") they cannot marry either.

### Measured

A village counts as **full** at the moving round when adults wait for land (in `st.demand`, with no plot) and `findSite` finds no room.

| Run | Years | Full villages (of 11) | Adults waiting with no room | Years with a full village |
| --- | --- | --- | --- | --- |
| populous small, seed 7 | 1 / 10 / 20 / 30 / 40 | 4 / 2 / 2 / 8 / 8 | 11 / 2 / 2 / 20 / 33 | 38 of 40 (543 person-years of waiting) |
| populous small, seed 42 | 1 / 5 / 15 / 20 | 4 / 3 / 5 / 5 | 18 / 13 / 16 / 12 | every year to year 20 |
| founders small, seeds 7 and 42 | 80 to 100 | none | none | never |

Populous villages are full from the first years; by year 30 most of them are, and the queue grows by about one adult a year per village. The founders never fill a village: they stay at 10–40 people, and at seed 42 they die out by year 80 (a demographic problem outside this review, noted for VB-035).

**Distance:** pawns walk 3 tiles an hour on meadow (`SPEED`), 2 in forest. A site 10–30 steps away is 3–10 hours' walk each way, so a new farm cannot be cleared from home: the settlers must live on the site.

## 2. History

- **Daughter settlements.** As the population grew in the early and high Middle Ages, the old villages' land became too tight, and new settlements were founded from them in their outland: the *torp* names of Denmark and southern Sweden, mostly from about 850 to 1350. High-medieval Danish laws used *thorp* for a new settlement formed from an older mother village, and the founder's own name was often the first element of the new name (Grøngaard Jeppesen, [*Kuml*](https://tidsskrift.dk/kuml/article/view/111333); [Names, University of Copenhagen](https://names.ku.dk/place-names/common_place-name_endings/roed/) on *-rød*, "clearing", of the same period). Swedish *-ryd* ("clearing") and *-boda* ("booths") names come from the same movement into the forest. Later scholars widen the picture: some *torp* were dispersed settlement in the outfield rather than planned daughters, and both kinds of move went on at once.
- **The outland** (*utmark*) was the village's land beyond the infield, used in common for grazing, wood and hay, and the place into which new farms were cleared.
- **New land yields well.** Permanent fields gave about four grains for each grain sown, and burnt-over forest land much more for its first crops ([ReSeed, *Variability and dynamics of Nordic rye*](https://reseed.uc.pt/index.php/2023/05/01/variability-and-dynamics-of-nordic-rye/)). Virgin or burnt ground holds a store of nutrients that a few crops use up.
- **Settling was encouraged.** Gustav Vasa offered freedom from tax to those who would start farms in the wilderness, since all land not used by villages and parishes fell to the Crown; settlers on Crown land later had 15–30 years free of rent, tithe and conscription, more where the land took more work to clear ([SLU repository](https://pub.epsilon.slu.se/id/document/2601); [Riksdag motion of 1904](https://weburn.kb.se/riks/tvåkammarriksdagen/pdf/web/1904/web_utl_1904__ak_tfu4_23/utl_1904__ak_tfu4_23.pdf)). This is post-medieval, but it shows new land as a deliberate outlet for people.
- **Frontier farms were fragile.** In Jämtland and Härjedalen many farms cleared about 1000 were abandoned about 1400, and roughly 20–40% of farms were deserted between 1350 and 1650 (Welinder, summarised in [SLU repository](https://pub.epsilon.slu.se/id/document/13083399)); in east-central Sweden about 1,500 holdings left empty in the late Middle Ages show up as *utjordar* in the 16th-century cadastres (Karsvall, [Uppsala thesis](https://www.avhandlingar.se/avhandling/06ac7a73a7/)). The newest farms on the poorest land emptied first.
- **Who went.** Settlers were younger sons and their families, often with a brother or sister; kin and neighbours followed a first settler, so a lone farm grew into a hamlet (this is the review's reading of the pattern, not a figure from a study).

## 3. Design

Kim's decisions are in the next section; the numbers are Proposed starting values, to tune in the wrap-up (VB-150).

**Crowded.** At the moving round, after plots are started, a village is crowded when adults of it wait for land (in `st.demand`, with no plot and no cottage coming) and `findSite` finds no room. The village records how many wait (`v.crowded`), and the panel says so.

**Deciding to leave.** Each waiting adult of 18–45 in a crowded village counts the moving rounds they have waited there (`p.landWait`). At each round they leave with a chance of 0.3 after the first, 0.6 after the second and 0.8 from the third, drawn from the seeded stream. Older waiters are asked first.

**The party.** The settler takes their spouse and their minor children in the same household. Each unmarried sibling of theirs who also waits in the same village follows with a chance of 0.5, at most 2; a follower lives in the new household as farmhand or maid and stays landless, so they can get the next farm in the new place.

**Provisions.** The party needs food until the next harvest (36 days of their rations) and seed for one field (25). They bring their stakes (shares already paid out), and their old households give the rest from grain above the shares reserve (`SHARES`), as far as they can, the settler's household first. If it is not enough they stay this year, and the log says why. The household also starts with firewood (`ECON.startWood`), as every new household does.

**Where.** In order:
1. **A small village nearby:** a village of 1 to 3 farms, other than their own, whose centre is within 30 walking steps of their village's centre and which is not crowded: `findSite` finds room, none of its own adults waits for land, and fewer than 2 plots and booths are under way there. Villages with living kin of the settler come first, then the nearest. The settlers build on the site `findSite` gives, so the village grows.
2. **A new village:** the best house site 10 to 30 walking steps from their village's centre, on meadow that nobody owns (as for generated villages and lone farms), at least 3 steps from any house, green or field, with a block of 3 free fields within reach (`placeFields`), none of them within 2 steps of another farm's house, green or field, and a wood within 24 steps. Sites score by the village-site score (land, wood, shore, river; `siteScore`) plus 3 times the fertility of the field block, less 0.15 a step. The fields must be at least 0.9 times as fertile, on average, as the fields of the home village: settlers go to good ground, and fresh land yields more its first years.
3. **Otherwise they stay** and wait another year.

**The booth.** The party moves at once. Their new farmstead stands on the site as a booth (*bod*) until its cottage is built: foundation 30 hours, walls 60, roof 30, as the household's own jobs. They live, eat, sleep, fetch water and cook there as on any farm; their first field, on the field tile the site search found, is cleared and broken as the household's field project, and more fields and meadows follow by the normal rules.

**The new village** is a village of one farm (Settlements and look): no green, no well, its fields unfenced. Its name follows the founder, as many *torp* did: the founder's given name in the genitive with *-torp*, *-ryd*, *-boda*, *-hult* or *-mark* (Erikstorp, Olofsboda, Anderstorp). It keeps its mother village's practice and culture; its tie to the culture's centre is computed as for any village, so a far daughter is weakly tied, drifts more easily and may split off as a culture of its own after generations. The village records where it came from and who founded it (`v.founded`).

**Fresh land.** A field broken on ground that was never farmed starts with soil 1.4 instead of 1.0, above the cap of 1.15 that manure can reach; each crop wears it by 0.08 as now, so the bonus is gone after about 4 crops. This applies to every new field in every scenario.

### Play

- **Legible pressure.** The village panel shows "crowded: 4 adults wait for land, no room to clear"; the log tells who leaves, with whom, where to and why someone could not go.
- **A story per settlement.** A founder with a name, a booth, a cottage rising, a first harvest on fresh land, a bride from the old village; siblings who follow and get the next farms.
- **Emergent shape.** Hamlets grow out of one farm by followers and their own plots, and a second farm lets the village lay out a green and well (VB-058). Daughter villages chain outwards, each a day's walk from its mother. Fresh land pays well, then wears down: a daughter on poor ground struggles when its bonus is spent and may empty, and its farm becomes an empty farm for claims (VB-033). Weakly tied daughters drift in their customs and may split off.
- **The ceiling.** When no site within 30 steps is good enough, nobody leaves: the island fills, and the landless serve, marry late or not at all, as in old Europe.

## 4. Decisions (Kim, 1 November 2026)

1. **Who leaves:** landless adults only, with spouse, minor children and siblings who follow; holders never leave their farms.
2. **Fresh land:** yes, a bonus on all never-farmed ground in every scenario, built as its own batch so its effect is measured apart.
3. **Small villages:** "newly founded" means any village of 1 to 3 farms that is not crowded, including the generated lone farms.
4. **Distance:** new villages 10 to 30 walking steps from home.

## 5. Tasks

| Task | What |
| --- | --- |
| VB-146 | Founding a new farm: crowded villages, the decision, the party, provisions, the site, the new village, the booth and its cottage |
| VB-147 | Settlers join small villages nearby before founding |
| VB-148 | The page: booths, new villages' labels, the crowded note and founding in the panels; `--report villages` in `tools/sim.js` |
| VB-149 | Fresh land yields more for its first crops |
| VB-150 | Wrap-up: long runs before and after |
