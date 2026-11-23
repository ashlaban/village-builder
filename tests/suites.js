// Explicit coverage tiers; see docs/testing.md. FAST is npm test; verify adds INTEGRATION; EXTENDED runs at night.
// A script of FAST or INTEGRATION takes under 5 seconds (the runner names those over); a longer one goes to EXTENDED until it is
// rebuilt on a small constructed state. The runner starts them in this order.
const FAST = [
  ['node', 'tests/build.js'],
  ['node', 'tests/format.js'],
  ['node', 'tests/marriage-demography.js'],
  ['node', 'tests/lintrules.js'],
  ['node', 'tests/source.js'],
  ['node', 'tests/backlog.js'],
  ['node', 'tests/fixture-tools.js'],
  ['node', 'tests/cost-rules.js'],
  ['node', 'tests/speed.js'],
  ['node', 'tests/pulls.js'],
  ['node', 'tests/customhold.js'],
  ['node', 'tests/decisions.js'],
  ['node', 'tests/alderman.js'], // VB-314: the village's alderman, chosen at its meeting
  ['node', 'tests/cacheowners.js'],
  ['node', 'tests/living.js'],
  ['node', 'tests/counters.js'],
  ['node', 'tests/player.js'],
  ['node', 'tests/outcomes.js'], // commands' three outcomes and the queue's assignments: release, reacquire, side work, saves (VB-1405)
  ['node', 'tests/crowding.js'], // a household's crowding, its factor and its refresh, on a constructed state (VB-766)
  ['node', 'tests/sheet.js'], // the played pawn's sheet: what a command brought, what moved its levels, an illness before it kills (VB-1118)
  ['node', 'tests/illness.js'], // illnesses that are survived: a course that passes, one turned by a draw, the roll's deaths kept (VB-1246)
  ['node', 'tests/wishes.js'],
  ['node', 'tests/wishlapse.js'],
  ['node', 'tests/roundoffers.js'],
  ['node', 'tests/handover.js'],
  ['node', 'tests/offerpreview.js'], // VB-1100: what a yes to an offer would bring, and the state after it
  ['node', 'tests/asking.js'],
  ['node', 'tests/suit.js'],
  ['node', 'tests/courting.js'],
  ['node', 'tests/outside.js'], // VB-555: a child on the way, the offer out of the round, the custom
  ['node', 'tests/succession.js'],
  ['node', 'tests/chronicle.js'],
  ['node', 'tests/opportunities.js'],
  ['node', 'tests/targets-tool.js'],
  ['node', 'tests/roadmap-tool.js'],
  ['node', 'tests/doc-tool.js'],
  ['node', 'tests/questions-tool.js'],
  ['node', 'tests/agent-usage.js'],
  ['node', 'tests/context-size.js'],
  ['node', 'tests/same-tool.js'],
  ['node', 'tests/wood.js'],
  ['node', 'tests/cold.js'],
  ['node', 'tests/mood.js'],
  ['node', 'tests/overview.js'],
  ['node', 'tests/outlook.js'],
  ['node', 'tests/yields.js'],
  ['node', 'tests/timber.js'],
  ['node', 'tests/cottageplan.js'], // VB-1411: a settler household's cottage a project plan beside its field's; each job ends its own; the roof ends the booth
  ['node', 'tests/sitelacks.js'], // VB-1407: one read of what a site lacks; a step carrying timber gets its trips; the walls by name; kept hours
  ['node', 'tests/beginend.js'], // VB-1408, VB-1414: one read of who may begin a small construction (its refusals); one way a step's job ends
  ['node', 'tests/smallplans.js'], // VB-1414: a cart, a boat, a tar pit beside a barn or a cottage: each posted, its own timber, its own end
  ['node', 'tests/stone.js'],
  ['node', 'tests/crops.js'],
  ['node', 'tests/seedorder.js'], // seed eaten last field last; a start in life and settlers take a field's seed of each crop (VB-352)
  ['node', 'tests/forest-spread.js'],
  ['node', 'tests/rye.js'],
  ['node', 'tests/weather.js'], // VB-354: the seasons' weather, each crop's reading, the thaw, the frost, the ripening
  ['node', 'tests/latitude.js'], // VB-807: the winter's dates by latitude, the bands, the growing year by world, dates falling, lat saved
  ['node', 'tests/peas.js'],
  ['node', 'tests/skills.js'], // time taken from causes: skill, a leg's mishap, the crop's size (VB-475)
  ['node', 'tests/estimate.js'], // the head's estimate: the causes reckoned by skill, the range, the day manned by it (VB-476)
  ['node', 'tests/crafts.js'], // crafts learnt by doing: halfway in 400 hours, a tenth a year, a novice's rate to a master's (VB-360)
  ['node', 'tests/rotations.js'],
  ['node', 'tests/sowing.js'],
  ['node', 'tests/foresight.js'],
  ['node', 'tests/kinds.js'],
  ['node', 'tests/routes.js'],
  ['node', 'tests/discomfort.js'], // VB-448: routes chosen by time weighed with discomfort; a bridge up to twice the time, load classes
  ['node', 'tests/oversea.js'], // VB-436: nobody is sent to a home over the sea
  ['node', 'tests/tiny.js'],
  ['node', 'tests/claims.js'],
  ['node', 'tests/territory.js'],
  ['node', 'tests/borders.js'],
  ['node', 'tests/farmclaims.js'],
  ['node', 'tests/ownership.js'],
  ['node', 'tests/ownershiprules.js'],
  ['node', 'tests/dependencies.js'],
  ['node', 'tests/lint.js'],
  ['node', 'tests/clock.js'],
  ['node', 'tests/spread.js'],
  ['node', 'tests/indexes.js'],
  ['node', 'tests/paths.js'],
  ['node', 'tests/reports.js'],
  ['node', 'tests/runner.js'],
  ['node', 'tests/continuity.js'],
  ['node', 'tests/legs.js'],
  ['node', 'tests/journeys.js'],
  ['node', 'tests/journeykinds.js'], // a journey's kinds: arrival, morning, death and change of home of each (sim/away JOURNEYS, VB-1409)
  ['node', 'tests/away.js'], // sleeping away from home: a lodger's stay, its pack and meals, a guest (VB-783)
  ['node', 'tests/booth.js'], // a booth: staked, raised in 12 hours with its wood, four beds, rots away (VB-784)
  ['node', 'tests/night.js'], // a night without a roof is cold and wet by the house's rule: the road in winter, a booth with wood (VB-785)
  ['node', 'tests/fetch.js'], // a gift fetched where it lies, a load a trip (VB-461)
  ['node', 'tests/rng.js'],
  ['node', 'tests/due.js'], // the due-queue helper on constructed lists: ties, an absent entry, an empty list, the take (VB-1473)
  ['node', 'tests/cowwant.js'],
  ['node', 'tests/quern.js'], // the hand quern (VB-009): grinding, the pot's flour, wear and hewing, on the probe's small state
  ['node', 'tests/accounts.js'], // VB-403: the balance accounts close, the people account too, and the run is unchanged
];
const INTEGRATION = [
  ['node', 'tests/events.js'],
  ['node', 'tests/grain.js'],
  ['node', 'tests/scaling.js'],
  ['node', '--expose-gc', 'tests/goods.js'],
  ['node', 'tests/tar.js'],
  ['node', 'tests/peat.js'],
  ['node', 'tests/causes.js'],
  ['node', 'tests/deaths.js'],
  ['node', 'tests/codec.js'],
  ['node', 'tests/skip.js'],
  ['node', 'tests/backlog-tool.js'],
  ['node', 'tests/inbox.js'],
  ['node', 'tests/waiting.js'],
  ['node', 'tests/brief-tool.js'],
  ['node', 'tests/guardians.js'],
  ['node', 'tests/holding.js'],
  ['node', 'tests/takenin.js'],
  ['node', 'tests/trust.js'],
  ['node', 'tests/obligations.js'],
  ['node', 'tests/days.js'],
  ['node', 'tests/labour.js'],
  ['node', 'tests/marriage.js'],
  ['node', 'tests/spacing.js'],
  ['node', 'tests/trees.js'],
  ['node', 'tests/climate.js'],
  ['node', 'tests/prospect.js'],
  ['node', 'tests/children.js'],
  ['node', 'tests/hands.js'],
  ['node', 'tests/tillcap.js'], // hoe and sow only what the hands can till (VB-1186)
  ['node', 'tests/helpers.js'], // help asked for: the ask, the answer, the hands lent and the tie by hours (VB-470)
  ['node', 'tests/help.js'], // food help, with VB-461's fetched gift (VB-889)
  ['node', 'tests/interrupts.js'],
  ['node', 'tests/day.js'],
  ['node', 'tests/ownheir.js'],
  ['node', 'tests/daylight.js'],
  ['node', 'tests/service.js'],
  ['node', 'tests/villagehours.js'],
  ['node', 'tests/roundreach.js'],
  ['node', 'tests/matchreach.js'],
  ['node', 'tests/means.js'], // VB-631: marriage.means, one formula for the gate and the words
  ['node', 'tests/service-marriage.js'], // VB-634: the master's house is no home; service is by the year
  ['node', 'tests/projects.js'],
  ['node', 'tests/routines.js'],
  ['node', 'tests/gathering.js'], // VB-294: the village's choice of gathering, who hosts and who goes
  ['node', 'tests/going.js'], // VB-295: going to the gathering: who goes, the lodging, the packing, the days on the green and home
  ['node', 'tests/fair.js'], // VB-302: the fair: loads packed, swaps weighed and settled, the residual booked, goods home and conserved
  ['node', 'tests/green.js'],
  ['node', 'tests/workdays.js'],
  ['node', 'tests/commons.js'],
  ['node', 'tests/cottage.js'],
  ['node', 'tests/relations.js'],
  ['node', 'tests/encounters.js'],
  ['node', 'tests/goodwill.js'],
  ['node', 'tests/meadows.js'],
  ['node', 'tests/milk.js'],
  ['node', 'tests/fish.js'],
  ['node', 'tests/house.js'],
  ['node', 'tests/pot.js'],
  ['node', 'tests/keeping.js'], // VB-683: one keeping rule a good, the larder's movements in the ledger
  ['node', 'tests/fresh.js'],
  ['node', 'tests/oxen.js'],
  ['node', 'tests/stakes.js'],
  ['node', 'tests/head.js'],
  ['node', 'tests/made-targets.js'],
  ['node', 'tests/asks.js'], // VB-699: the asks for goods, read by a head whose place makes them
  ['node', 'tests/traits.js'],
  ['node', 'tests/aims.js'],
  ['node', 'tests/traitacts.js'], // VB-520: what each trait does, chemistry, the quarrel
  ['node', 'tests/nursing.js'],
  ['node', 'tests/ale.js'],
  ['node', 'tests/attention.js'],
  ['node', 'tests/setdown.js'],
  ['node', 'tests/standingcart.js'], // VB-649: a dead carter's cart and team stand on the road
  ['node', 'tests/leftwood.js'], // VB-645: a dropped boat's timber lies at its shore
  ['node', 'tests/start.js'],
  ['node', 'tests/market.js'], // VB-778: the market town's start, a test bed
  ['node', 'tests/gossip.js'],
  ['node', 'tests/health.js'],
  ['node', 'tests/carts.js'],
  ['node', 'tests/extinctwood.js'],
  ['node', 'tests/deer.js'],
  // VB-853: the long save and load, and the year and the islands that clock, paths and indexes ran at night, on small states
  ['node', 'tests/saves.js'],
  ['node', 'tests/clock.js', '--integration'],
  ['node', 'tests/paths.js', '--integration'],
  ['node', 'tests/indexes.js', '--integration'],
  // VB-854: the household's rules, from meals to occasions, on small generated islands and constructed states
  ['node', 'tests/meals.js'],
  ['node', 'tests/stores.js'],
  ['node', 'tests/hunger.js'],
  ['node', 'tests/heirs.js'],
  ['node', 'tests/guardian.js'],
  ['node', 'tests/kinship.js'],
  ['node', 'tests/kinlimit.js'],
  ['node', 'tests/owners.js'],
  ['node', 'tests/plans.js'],
  ['node', 'tests/offers.js'],
  ['node', 'tests/advice.js'], // VB-1316: the retired's advice to its head, and a grandchild's match
  ['node', 'tests/exchange.js'],
  ['node', 'tests/occasions.js'],
  ['node', 'tests/gift.js'], // VB-460: the good-year gift, unasked, kin first, carried
  ['node', 'tests/feast.js'], // VB-458: the feast at a wedding or a funeral ale, its sitting, the meal eaten once, goodwill booked
  ['node', 'tests/call.js'], // VB-1119: a call at a farm (the verb, its week, the evening's ties, the match list)
  ['node', 'tests/aleevening.js'], // VB-522: the ale evening (who calls, who is asked, the barrel) and the season's rite (its leader, the ties)
  // VB-855: the farming year, from new fields to digging, on small generated islands and constructed states
  ['node', 'tests/newfields.js'],
  ['node', 'tests/fieldswanted.js'],
  ['node', 'tests/weeding.js'],
  ['node', 'tests/soil.js'],
  ['node', 'tests/tilth.js'],
  ['node', 'tests/surplus.js'],
  ['node', 'tests/hay.js'],
  ['node', 'tests/byre.js'],
  ['node', 'tests/cull.js'], // the cull is the head's, by the verb cull (VB-679)
  ['node', 'tests/stocking.js'],
  ['node', 'tests/matchby.js'],
  ['node', 'tests/keep.js'],
  ['node', 'tests/herds.js'],
  ['node', 'tests/herdlead.js'], // animals that change household are led home (VB-674)
  ['node', 'tests/herding.js'],
  ['node', 'tests/drying.js'],
  ['node', 'tests/forage.js'],
  ['node', 'tests/dig.js'],
  ['node', 'tests/saltpan.js'], // salt boiled at a spring, and the salting that uses it (VB-700)
  ['node', 'tests/ironwork.js'], // the tools' wear and rate, smelting bog ore and mending with iron (VB-701)
  // VB-856: land and geography, and the tools, on small generated islands and constructed states
  ['node', 'tests/rivers.js'],
  ['node', 'tests/stones.js'],
  ['node', 'tests/geology.js'],
  ['node', 'tests/layout.js'],
  ['node', 'tests/settle.js'],
  ['node', 'tests/plots.js'],
  ['node', 'tests/names.js'],
  ['node', 'tests/populous.js'],
  ['node', 'tests/tools.js'],
  ['node', 'tests/review-tools.js'],
  ['node', 'tests/review-hours.js'],
  ['node', 'tests/review-soil.js'],
  ['node', 'tests/bench.js'],
  ['node', 'tests/commands.js'],
  ['node', 'tests/record.js'],
  ['node', 'tests/regress.js'],
  ['node', 'tests/plaindata.js'],
  ['node', '--expose-gc', 'tests/registry.js'],
  ['node', 'tests/notable.js'],
  ['node', 'tests/manual.js'],
  ['node', 'tests/page.js'], // VB-409: the page in jsdom on a 36 by 26 island, a few days and each panel once; the tiny map's smoke at night
];
const EXTENDED = [
  // The slowest first, so that none starts last and runs on alone. First the long runs of whole islands, which load the late fixtures.
  ['node', 'tests/start.js', '--people'],
  ['node', 'tests/perf.js', '--engine'], // VB-246: the two engine workarounds against their plain forms (about 3 minutes: 12 runs of a year or less)
  ['node', 'tests/births.js'],
  ['node', 'tests/invariants.js'],
  ['node', 'tests/fixtures.js'],
  ['node', 'tests/history.js'],
  ['node', 'tests/bands.js'],
  ['node', 'tests/line.js'],
  // Generated islands and runs of years that a small state cannot show: statistics over seeds and whole islands (docs/testing.md).
  ['node', 'tests/smoke.js'], // the page on the tiny map, a year and the toasts; its quick case is tests/page.js in verify
  ['node', 'tests/populous.js', '--extended'], // the four map sizes: the population each seeds, the village size bands (VB-856)
  ['node', 'tests/tools.js', '--extended'], // the reports that take a run of their own each, and tools/balance.js (VB-856)
  ['node', 'tests/rivers.js', '--extended'], // the default island: ten sources or more, a course through a lake, 20 crossings (VB-856)
  ['node', 'tests/layout.js', '--extended'], // the default island, heirs three years and founders ten: a green laid in play (VB-856, VB-887)
  ['node', 'tests/paths.js', '--extended'], // a whole island's traffic: how many houses a year gives a way to their door (VB-853)
  ['node', 'tests/heirs.js', '--extended'], // the default island ten years on, and B3's crop at four seeds: a statistic over seeds (VB-854)
  ['node', 'tests/hunger.js', '--extended'], // three years of founders at seeds 7 and 42, reported: hungry days, deaths, marriages (VB-854)
  ['node', 'tests/soil.js', '--extended'], // founders on the small map ten years: the soil of farms with and without cattle (VB-855)
  // The page in real Chromium, one browser at a time.
  ['node', 'tests/browser.js'],
  ['node', 'tests/browser-saves.js'],
  ['node', 'tests/browser-start.js'],
  ['node', 'tests/browser-editor.js'],
  ['node', 'tests/browser-mobile.js'],
  ['node', 'tests/browser-speed.js'],
  ['node', 'tests/browser-gathering.js'], // a gathering while it is on: its notice, its mark and its card (VB-1031, VB-1032)
  ['node', 'tests/browser-fields.js'], // a field's card: crop, course, the head's rotation choices and their answers, winter rye (VB-1146)
  ['node', 'tests/browser-bonds.js'] // portraits: the bonds as badges (VB-1026), their words (VB-1033), ageing (VB-1029)
];
module.exports = { FAST, INTEGRATION, EXTENDED };
