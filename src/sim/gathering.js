// @sys sim/gathering: the gathering (VB-294; design.md, The gathering): at its autumn meeting a village with a green offers to host and every
//   village ranks the hosts it would walk to, by effective hours; once all have met, each goes to one gathering that stands (three villages
//   or more, the host among them, lodged by its farms); the district is the villages of one gathering, read from the choice; going there (VB-295): each
//   household's plan of who goes and who
//   stays (the verbs goGathering and stayHome), the lodging of those who come from beyond two hours' walk, their packing the day before,
//   the three days on the host's green (occasions of kind 'gathering') and the ale its holders pour there
// @state village.gathering: null or absent (no choice made yet), else {chosen (the year of the meeting's last choice), by ('meeting' |
//   'asLastYear' | 'nothing'), hosting (the village offers to host that year's gathering), prefs[] (village ids of the hosts it would go to,
//   best first, each with a green and within a day's walk), year (the year of the winter the village's gathering is for), host (the village
//   whose gathering it attends that winter, or null for none; its own id when it hosts one that stands), ale (barrels its holders poured at
//   the gathering it hosted that winter, written at the end of each of its days), cases and matches (the border cases decided and the
//   matches made at the gathering it hosted that winter: 0 until the gathering hears them, VB-297 and VB-298; read by its report)}.
//   The meeting's verb `gathering` writes chosen, by, hosting and prefs (setGathering); the evening's settling writes year, host, ale,
//   cases and matches (settleGatherings); between the two, year and host are last year's.
// @state household.gathering: absent, or {year (the winter it is for), planned (its head has planned it), go[] (pawn ids of its members who
//   mean to go, in the order they chose), packed (the goers are lodged, and the choice is made), beds[] ([pawn, host household, in the barn] for each
//   goer lodged in the host village, from the
//   lodging until it packs)}: written by the verbs goGathering and stayHome (setGoing), the lodging and the packing, all here
VB['sim/gathering'] = (() => {
  const { settlement } = VB['sim/records'];
  const { GATHERING, TRAVEL, YEAR, SEASON_DAYS, DAY, WORK, MARRIAGE, HEALTH, BREW, cal } = VB['sim/rules'];
  const { age, spouseOf, unplanned, fullName, living } = VB['sim/records'];
  const { next: rnd } = VB['sim/rng'];
  const Traits = VB['sim/traits'],
    Stores = VB['sim/stores'];
  const { call, onEnd, VILLAGE_STEPS } = VB['sim/occasions'];
  const { pourAle } = VB['sim/feast'];
  const { book } = VB['sim/relations'];
  const { stayOf } = VB['sim/pose'];
  const { on, emit } = VB['sim/events'];
  const { hoursBetween, withinDay } = VB['sim/villagehours'];
  const { log } = VB['sim/records'];
  const { opinionOf } = VB['sim/relations'];
  const { kinHouseholds } = VB['sim/exchange'];
  const Green = VB['sim/green'];
  const { issue, register } = VB['sim/commands'];
  const Customs = VB['sim/customs'];
  const G = GATHERING;
  const choiceOf = (st, vid) => st.villages[vid].gathering || null;
  const farmsOf = (st, v) => Green.houses(st, v).length; // occupied farms: a household each
  // A village that can host: one with a green and people on its farms.
  const canHost = (st, v) => !!v.green && farmsOf(st, v) > 0;
  // The host village h's gathering last winter: was it held (h attended its own), and the ale poured at it.
  function lastOf(st, h, year) {
    const g = choiceOf(st, h);
    return g && g.year === year - 1 && g.host === h ? g : null;
  }
  // ---- a village's choice, at its meeting (sim/meetings, villageMeeting) ----
  // The pull of each other village on village v's holders, read from what they hold now (design.md, The gathering, Disposition between
  // villages; never stored): each holder's opinion of the holders of another village among those it knows (its ties, the memories it holds,
  // its goodwill balances: each capped), summed by village and divided by v's holders, so -1 to 1. A Map of village id to it.
  function dispositions(st, v, holders) {
    const sum = new Map(),
      seen = new Set();
    for (const a of holders) {
      const pa = st.pawns[a];
      seen.clear();
      for (const m of [pa.ties, pa.rel, pa.goodwill])
        if (m)
          for (const b of m.keys()) {
            if (seen.has(b)) continue;
            seen.add(b);
            VB.count.gatherDisposition++;
            const q = st.pawns[b];
            if (!q.alive || q.household === null) continue;
            const hh = st.households[q.household];
            if (hh.holder !== b) continue;
            const u = st.farmsteads[hh.farmstead].village;
            if (u === v.id) continue;
            sum.set(u, (sum.get(u) || 0) + opinionOf(st, a, b));
          }
    }
    const out = new Map();
    for (const [u, s] of sum) out.set(u, Math.max(-1, Math.min(1, s / holders.length)));
    return out;
  }
  // The households of kin of v's households (sim/exchange's kinHouseholds: parents, children, siblings) in other villages, counted by the
  // host those villages went to last winter. A Map of host id to the count.
  function kinByHost(st, v, households, year) {
    const out = new Map(),
      seen = new Set();
    for (const hh of households)
      for (const k of kinHouseholds(st, hh)) {
        VB.count.gatherKin++;
        if (seen.has(k)) continue;
        seen.add(k);
        const u = st.farmsteads[st.households[k].farmstead].village,
          g = choiceOf(st, u);
        if (u === v.id || !g || g.year !== year - 1 || g.host === null) continue;
        out.set(g.host, (out.get(g.host) || 0) + 1);
      }
    return out;
  }
  // Village v's effective hours to each village that can host within a day's walk (design.md, The gathering, How a village comes to host):
  // the walk between the greens (its own 0), less GATHERING.kin for each household of kin in the villages that went there last winter (at
  // most kinMax), less or plus up to `disposition` by the pull between the two villages, less `held` if it was held last winter, less up
  // to aleMax for the ale its host poured there. The hours added for customs that differ are not counted: opinion carries them (Kim, 12
  // Nov; VB-520, chemistry's customs term). [[hours, host id]] of those under TRAVEL.dayWalk, fewest first, then by id. One read of v's
  // row of st.villageHours (VB-286); no search.
  function rank(st, v, people) {
    const year = cal(st.t).year,
      households = [],
      holders = [];
    for (const p of people) {
      const hh = st.households[p.household];
      if (hh.holder === p.id) {
        holders.push(p.id);
        households.push(hh);
      }
    }
    const disp = holders.length ? dispositions(st, v, holders) : new Map(),
      kin = kinByHost(st, v, households, year),
      out = [];
    for (const h of st.villages) {
      VB.count.gatherChoice++;
      if (!withinDay(st, v.id, h.id) || !canHost(st, h)) continue;
      const last = lastOf(st, h.id, year);
      let e = hoursBetween(st, v.id, h.id);
      e -= Math.min(G.kinMax, G.kin * (kin.get(h.id) || 0));
      e -= G.disposition * (disp.get(h.id) || 0);
      if (last) e -= G.held + Math.min(G.aleMax, G.ale * (last.ale || 0));
      if (e < TRAVEL.dayWalk) out.push([e, h.id]);
    }
    return out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }
  // The meeting's choice for the coming winter (a question of its own, made as the routines are: QUESTION_ARCHIVE.md, "VB-294"): with a
  // quorum (`quorum`), the hosts it would go to, best first, and whether it offers to host, which it does when it has a green and would
  // itself go to none but its own; without one, its culture's practice for a meeting that did not decide: no gathering this winter
  // ('nothing'), or last year's choice again ('asLastYear'). Set by the meeting's verb `gathering` (sim/commands); until the alderman
  // (VB-314) the village's meeting is its actor, as for its routines.
  function chooseGathering(st, s, quorum, people) {
    const v = st.villages[s.id];
    if (!v) return;
    let by = 'meeting',
      prefs = [],
      hosting = false;
    if (quorum) {
      prefs = rank(st, v, people).map((x) => x[1]);
      hosting = prefs[0] === v.id;
    } else {
      by = Customs.practiceOf(st.cenv.cultures[s.culture], 'noDecision');
      const g = choiceOf(st, v.id);
      if (by === 'asLastYear' && g) {
        prefs = g.prefs.filter((h) => withinDay(st, v.id, h) && canHost(st, st.villages[h]));
        hosting = g.hosting && canHost(st, v);
      }
    }
    issue(st, { actor: { settlement: s.id }, verb: 'gathering', args: { hosting, prefs, by }, source: 'meeting' });
  }
  // Why a choice may not be village vid's, or null (the verb's check).
  function choiceWhy(st, vid, a) {
    if (!a || typeof a.hosting !== 'boolean' || !Array.isArray(a.prefs))
      return 'a choice is whether to host and a list of hosts';
    if (!['meeting', 'nothing', 'asLastYear'].includes(a.by)) return `a choice cannot be made by ${a.by}`;
    if (a.hosting && !canHost(st, st.villages[vid])) return `village ${vid} cannot host`;
    if (new Set(a.prefs).size !== a.prefs.length) return 'a host is named twice';
    for (const h of a.prefs) {
      if (!Number.isInteger(h) || !st.villages[h]) return `there is no village ${h}`;
      if (!st.villages[h].green) return `village ${h} has no green`;
      if (!withinDay(st, vid, h)) return `village ${h} is beyond a day's walk`;
    }
    return null;
  }
  // The choice becomes village vid's (the verb's act; the one writer of chosen, by, hosting and prefs).
  function setGathering(st, vid, a) {
    const v = st.villages[vid],
      was = v.gathering || { year: null, host: null, ale: 0 };
    v.gathering = { ...was, chosen: cal(st.t).year, by: a.by, hosting: a.hosting, prefs: [...a.prefs] };
  }
  // ---- the evening's settling, once every village has met (sim/meetings, culture step) ----
  // Which villages go to which gathering this winter (design.md, The gathering; the rules of who comes and lodging): each village goes to its
  // first host in the running (one that offered this year), and a host lodges GATHERING.lodge guests a farm, GATHERING.goers a household
  // of each village beyond homeHours' walk, the nearest first; one it cannot lodge goes to its next host. A gathering stands when its host
  // goes to its own and at least `least` villages do. While one does not, the smallest of those (the host with the fewer farms, then the
  // higher id, between equals) is out of the running and its villages choose again, each its next host in the running: every village with
  // a green offers and goes first to its own, so choosing again only once, among those that already stand, would leave every gathering
  // empty (VB-294's decision). Writes every village's year and host; logs each gathering that stands at its host. Work: villages times
  // the hosts each names, a round for each host put out of the running.
  function settleGatherings(st) {
    const year = cal(st.t).year,
      vs = st.villages,
      prefs = new Map(), // village id -> its hosts that offered, best first
      room = new Map(); // host id in the running -> the guests it lodges
    for (const v of vs) {
      const g = choiceOf(st, v.id);
      if (!g || g.chosen !== year) continue;
      const list = [];
      for (const h of g.prefs) {
        VB.count.gatherSettle++;
        const hg = choiceOf(st, h);
        if (hg && hg.chosen === year && hg.hosting && hg.prefs[0] === h && canHost(st, vs[h])) list.push(h);
      }
      prefs.set(v.id, list);
      if (list[0] === v.id) room.set(v.id, G.lodge * farmsOf(st, vs[v.id]));
    }
    const goers = (v) => G.goers * farmsOf(st, vs[v]);
    let at;
    for (;;) {
      const lists = new Map();
      for (const [v, list] of prefs)
        lists.set(
          v,
          list.filter((h) => room.has(h)),
        );
      at = assign(st, lists, room, goers);
      const count = new Map();
      for (const h of at.values()) count.set(h, (count.get(h) || 0) + 1);
      let out = null;
      for (const h of room.keys()) {
        const n = count.get(h) || 0;
        if (at.get(h) === h && n >= G.least) continue;
        const o = out === null ? null : [count.get(out) || 0, farmsOf(st, vs[out]), out];
        if (
          o === null ||
          n < o[0] ||
          (n === o[0] && (farmsOf(st, vs[h]) < o[1] || (farmsOf(st, vs[h]) === o[1] && h > o[2])))
        )
          out = h;
      }
      if (out === null) break;
      room.delete(out);
    }
    const held = new Map();
    for (const v of vs) {
      const g = choiceOf(st, v.id);
      if (!g) continue;
      const h = at.has(v.id) ? at.get(v.id) : null;
      g.year = year;
      g.host = h;
      g.ale = 0;
      g.cases = 0;
      g.matches = 0;
      if (h !== null) {
        if (!held.has(h)) held.set(h, []);
        held.get(h).push(v.id);
      }
    }
    for (const [h, ids] of [...held].sort((a, b) => a[0] - b[0])) {
      const names = ids.filter((x) => x !== h).map((x) => vs[x].name);
      log(
        st,
        `${vs[h].name} hosts the gathering this winter: ${names.join(', ')} ${names.length === 1 ? 'goes' : 'go'} there.`,
        { kind: 'gathering', village: h, n: ids.length },
      );
    }
  }
  // Deferred acceptance: each village of `lists` asks its first host left; each host takes those that ask, nearest first, those within
  // homeHours free and the others while their goers fit its room; a village turned away asks its next. Ends when none is turned away.
  // A Map of village id to the host that took it (villages turned away by all are left out).
  function assign(st, lists, room, goers) {
    const next = new Map();
    for (const v of lists.keys()) next.set(v, 0);
    for (;;) {
      const asks = new Map();
      for (const [v, list] of lists) {
        const i = next.get(v);
        if (i >= list.length) continue;
        const h = list[i];
        if (!asks.has(h)) asks.set(h, []);
        asks.get(h).push(v);
      }
      let turned = false;
      const at = new Map();
      for (const [h, vsAsk] of asks) {
        vsAsk.sort((a, b) => hoursBetween(st, a, h) - hoursBetween(st, b, h) || a - b);
        let r = room.has(h) ? room.get(h) : 0;
        for (const v of vsAsk) {
          VB.count.gatherSettle++;
          const free = hoursBetween(st, v, h) <= G.homeHours;
          if (free || goers(v) <= r) {
            if (!free) r -= goers(v);
            at.set(v, h);
          } else {
            next.set(v, next.get(v) + 1);
            turned = true;
          }
        }
      }
      if (!turned) return at;
    }
  }
  // ---- reads ----
  // The district of host h (design.md, The gathering, The district): the villages whose gathering this winter, or the last, is h's, h first.
  function district(st, h) {
    const g = choiceOf(st, h);
    if (!g || g.host !== h) return [];
    const out = [h];
    for (const v of st.villages) {
      const x = choiceOf(st, v.id);
      if (v.id !== h && x && x.year === g.year && x.host === h) out.push(v.id);
    }
    return out;
  }
  // The gatherings of the latest winter settled: [{host, year, villages (its district)}], by host id.
  function gatherings(st) {
    const out = [];
    for (const v of st.villages) {
      const g = choiceOf(st, v.id);
      if (g && g.host === v.id) out.push({ host: v.id, year: g.year, villages: district(st, v.id) });
    }
    return out;
  }
  // When host h's gathering is held in the winter of `year`: [start, end) in game hours. The date is a key of GATHERING.dates, `harvest`
  // (winter days 1 to 3, Decided 10 Nov) for every village today; VB-809 makes it the custom of the host's culture (`gatherDay`).
  const dateOf = () => G.dates.harvest;
  function whenHeld(st, h, year) {
    const d = dateOf(st, h),
      start = (year - 1) * YEAR + (d.season * SEASON_DAYS + d.from) * DAY;
    return [start, start + d.days * DAY];
  }
  // ---- going there (VB-295; design.md, The gathering: Going there, Who goes, Lodging) ----
  // The gathering village vid goes to this winter while it is still on or ahead: {host, year, start, end (game hours of its days), pack
  // (the day before, at the start of work: its goers set out), days}, else null.
  function ahead(st, vid) {
    if (vid === null) return null;
    const g = choiceOf(st, vid),
      year = cal(st.t).year;
    if (!g || g.year !== year || g.host === null) return null;
    const [start, end] = whenHeld(st, g.host, year);
    return st.t < end
      ? { host: g.host, year, start, end, pack: start - DAY + WORK[0], days: (end - start) / DAY }
      : null;
  }
  const villageOf = (st, hh) => (hh.farmstead === null ? null : st.farmsteads[hh.farmstead].village);
  // Goers of village v sleep at home when it is the host or within GATHERING.homeHours' walk of it.
  const sleepsHome = (st, v, h) => v === h || hoursBetween(st, v, h) <= G.homeHours;
  const planFor = (hh, year) => (hh.gathering && hh.gathering.year === year ? hh.gathering : null);
  // The household's plan for the winter's gathering, begun empty if it has none for that year (written only here).
  function planOf(hh, year) {
    if (!planFor(hh, year)) hh.gathering = { year, planned: false, packed: false, go: [], beds: [] };
    return hh.gathering;
  }
  // Whether one of household hh's adults (GATHERING.adult or more) stays at home, with `go` going and pawn `also` with them: the animals
  // are tended and the fire kept (design.md, Who goes: never everyone).
  function adultStays(st, hh, go, also) {
    for (const m of hh.members) {
      if (m === also || go.includes(m)) continue;
      const q = st.pawns[m];
      if (q.alive && age(st, q) >= G.adult) return true;
    }
    return false;
  }
  // Why pawn id may not choose to go to its village's gathering this winter, or null (the verb goGathering's check, alike for any pawn):
  // its household has a farm and its village a gathering still to pack for; it is old enough and not ill; it does not go already; an adult
  // of its household stays; and a household that lodges in the host village sends GATHERING.goers at most, the room the host counted.
  function goWhy(st, id) {
    const p = st.pawns[id],
      hh = p.household === null ? null : st.households[p.household];
    if (!hh || hh.dissolved || hh.farmstead === null) return `${fullName(p)} has no home to go out from`;
    const at = ahead(st, villageOf(st, hh));
    if (!at || st.t >= at.start) return `${fullName(p)}'s village has no gathering ahead to make ready for`;
    const plan = planFor(hh, at.year),
      go = plan ? plan.go : [];
    if (plan && plan.packed) return `${fullName(p)}'s household has packed for the gathering`;
    if (age(st, p) < G.wishAge) return `${fullName(p)} is too young to go`;
    if (p.health < HEALTH.riskBelow) return `${fullName(p)} is too ill to go`;
    if (go.includes(id)) return `${fullName(p)} goes already`;
    if (!adultStays(st, hh, go, id)) return 'an adult of the household stays with the animals and the fire';
    if (!sleepsHome(st, villageOf(st, hh), at.host) && go.length >= G.goers)
      return `a household lodged at the gathering sends ${G.goers} at most`;
    return null;
  }
  // Why pawn id may not choose to stay home, or null: it means to go, and its household has not packed yet.
  function stayWhy(st, id) {
    const p = st.pawns[id],
      hh = p.household === null ? null : st.households[p.household],
      at = hh ? ahead(st, villageOf(st, hh)) : null,
      plan = at ? planFor(hh, at.year) : null;
    if (!plan || !plan.go.includes(id)) return `${fullName(p)} is not going to a gathering`;
    return plan.packed ? `${fullName(p)}'s household has packed for the gathering` : null;
  }
  // Pawn id goes (or stays home): its household's plan names it among the goers, or no more (the verbs' act).
  function setGoing(st, id, go) {
    const hh = st.households[st.pawns[id].household],
      plan = planOf(hh, ahead(st, villageOf(st, hh)).year),
      i = plan.go.indexOf(id);
    if (go && i < 0) plan.go.push(id);
    if (!go && i >= 0) plan.go.splice(i, 1);
  }
  // The head plans who goes (design.md, Who goes), on its planning day between the meetings and the packing: the holder, its unmarried
  // of marrying age (the eldest first), and by wish the others of GATHERING.wishAge or more, at `wish` times (0.5 + sociability), each
  // through the verb, whose check keeps an adult at home and the lodged to `goers`. A party to a border case goes too once such a case
  // waits for the gathering (VB-297). The played pawn chooses for itself. Members of the household once.
  function planGoing(st, hh, at) {
    const plan = planOf(hh, at.year);
    if (plan.planned) return;
    plan.planned = true;
    const unwed = [],
      wish = [];
    for (const m of hh.members) {
      VB.count.gatherPlan++;
      const q = st.pawns[m];
      if (!q.alive || m === hh.holder) continue;
      const a = age(st, q);
      if (spouseOf(st, m) === null && !q.retired && a >= (q.sex === 'm' ? MARRIAGE.menFrom : MARRIAGE.womenFrom))
        unwed.push(m);
      else if (a >= G.wishAge && rnd(st.rng.gathering) < G.wish * (0.5 + Traits.of(st, m, 'sociability'))) wish.push(m);
    }
    unwed.sort((x, y) => st.pawns[x].born - st.pawns[y].born || x - y);
    const ids = hh.holder !== null && st.pawns[hh.holder].alive ? [hh.holder, ...unwed, ...wish] : [...unwed, ...wish];
    for (const id of ids) if (!unplanned(st, id)) issue(st, { actor: id, verb: 'goGathering', source: 'planner' });
  }
  on('planReviewed', (st, d) => {
    if (d.plan.holder.type !== 'household') return;
    const hh = st.households[d.plan.holder.id],
      at = hh.dissolved ? null : ahead(st, villageOf(st, hh));
    if (at && st.t < at.pack) planGoing(st, hh, at);
  });
  // The households of village v with a farm.
  function householdsOf(st, v) {
    const out = [];
    for (const fid of st.villages[v].farmsteads) {
      const f = st.farmsteads[fid];
      if (f.household !== null && !st.households[f.household].dissolved) out.push(st.households[f.household]);
    }
    return out;
  }
  // Its goers still to go: living members of the household, in the order they chose.
  const goersOf = (st, hh, plan) => plan.go.filter((id) => st.pawns[id].alive && st.pawns[id].household === hh.id);
  // The lodging for host h's gathering (design.md, Lodging; Agreed, 10 Nov): each goer of a village beyond homeHours, the nearest villages
  // first, gets a bed at a farm of the host village whose head will have it: with kin (its household's, sim/exchange kinHouseholds), else
  // with a pawn it holds a goodwill balance with (its partner), in the house while its GATHERING.house beds last and then in the barn;
  // else in a barn the host village gives (GATHERING.barn a farm), the farms in turn, and once the barns are full in the house beds kin left;
  // the farm's GATHERING.lodge in all, the room the settling counted. One with no bed stays home: nobody sleeps outdoors.
  // Writes each household's beds. Work: the goers, their kin households and counterparts (each capped), and the farms passed over.
  function lodging(st, h, at) {
    const room = new Map();
    for (const hh of householdsOf(st, h)) room.set(hh.id, [G.house, G.barn]);
    const guests = [];
    for (const v of district(st, h).sort((a, b) => hoursBetween(st, a, h) - hoursBetween(st, b, h) || a - b)) {
      if (sleepsHome(st, v, h)) continue;
      for (const hh of householdsOf(st, v)) {
        const plan = planFor(hh, at.year);
        if (!plan) continue;
        plan.beds = [];
        for (const id of goersOf(st, hh, plan)) guests.push([id, hh]);
      }
    }
    const bed = new Set();
    const welcome = (hid, id) => {
      const head = st.households[hid].holder;
      return head !== null && st.pawns[head].alive && opinionOf(st, head, id) >= 0;
    };
    // a bed for guest g at household hid's farm: in the house first for kin and partners, the barn first for the others
    const place = (g, hid, house) => {
      VB.count.gatherLodge++;
      const r = room.get(hid);
      if (!r || !welcome(hid, g[0])) return false;
      const [a, b] = house ? [0, 1] : [1, 0],
        k = r[a] > 0 ? a : r[b] > 0 ? b : -1;
      if (k < 0) return false;
      r[k]--;
      const hh = g[1];
      hh.gathering.beds.push([g[0], hid, k === 1]);
      bed.add(g[0]);
      return true;
    };
    for (const g of guests) for (const k of kinHouseholds(st, g[1])) if (place(g, k, true)) break;
    for (const g of guests) {
      const m = st.pawns[g[0]].goodwill;
      if (bed.has(g[0]) || !m) continue;
      for (const b of m.keys()) {
        const q = st.pawns[b];
        if (q.alive && q.household !== null && place(g, q.household, true)) break;
      }
    }
    const farms = [...room.keys()];
    let i = 0;
    for (const g of guests) {
      if (bed.has(g[0])) continue;
      while (i < farms.length && room.get(farms[i])[0] + room.get(farms[i])[1] === 0) i++;
      for (let k = i; k < farms.length; k++) if (place(g, farms[k], false)) break;
    }
    for (const [id] of guests) if (!bed.has(id)) setGoing(st, id, false); // no bed: it stays home
  }
  // The packing (the day before the gathering, from the start of work; sim/clock): at the first step every household not yet planned plans
  // and the goers of each gathering are lodged, the choice made (packed); then a village a step, the farthest first, its lodged goers pack (provisions
  // for the days
  // away, from the household's grain above its seed, sim/away's pack) and walk to their beds, and one whose household cannot spare its
  // pack stays home; at the last step each gathering's days are called on its host's green, for those who go from home and those lodged.
  // The goods a household means to exchange are the fair's (VB-302): its dealer loads them as it sets out ('gatheringSetOut').
  function packStep(st, n) {
    const year = cal(st.t).year,
      hosts = gatherings(st).filter((g) => g.year === year && st.t < whenHeld(st, g.host, year)[1]);
    if (!hosts.length) return;
    if (n === 0) {
      for (const g of hosts) {
        const at = ahead(st, g.host);
        for (const v of g.villages) for (const hh of householdsOf(st, v)) planGoing(st, hh, at);
        lodging(st, g.host, at);
        for (const v of g.villages) for (const hh of householdsOf(st, v)) planOf(hh, at.year).packed = true;
      }
      return;
    }
    const far = [];
    for (const g of hosts) for (const v of g.villages) if (!sleepsHome(st, v, g.host)) far.push([v, g.host]);
    far.sort((a, b) => hoursBetween(st, b[0], b[1]) - hoursBetween(st, a[0], a[1]) || a[0] - b[0]);
    if (n <= VILLAGE_STEPS) {
      far.forEach(([v, h], j) => {
        if (Math.floor((j * VILLAGE_STEPS) / Math.max(far.length, VILLAGE_STEPS)) === n - 1) pack(st, v, ahead(st, h));
      });
      return;
    }
    for (const g of hosts) callDays(st, g.host, ahead(st, g.host));
  }
  // Village v's lodged goers pack and set out for their beds (the verb lodge, sim/away: a guest in the host's house or barn until the
  // morning after the last day, on a pack for the nights away and the day home).
  function pack(st, v, at) {
    for (const hh of householdsOf(st, v)) {
      const plan = planFor(hh, at.year);
      if (!plan) continue;
      const set = []; // those of hh who set out now: an adult left the household since it planned, so one stays (design.md, Who goes)
      for (const [id, host, barn] of plan.beds) {
        const ok =
          st.pawns[id].alive &&
          st.pawns[id].household === hh.id &&
          adultStays(st, hh, set, id) &&
          issue(st, {
            actor: id,
            verb: 'lodge',
            target: st.farmsteads[st.households[host].farmstead].house,
            args: {
              why: 'gathering',
              days: at.days + 2,
              host,
              barn,
              until: at.end + WORK[0],
              walk: hoursBetween(st, v, at.host),
            },
            source: 'planner',
          }) === true;
        if (ok) set.push(id);
        else setGoing(st, id, false); // its dealer loads as its stay opens, at its house (lodged, below; VB-1175)
      }
      plan.beds = [];
    }
  }
  // Host h's days, one occasion a day on its green: each goer is asked, from home (the host's own and those within homeHours, their walk
  // by the table of walking hours) or from its bed in the host village (an hour's walk at most).
  function callDays(st, h, at) {
    const ids = [],
      hours = [];
    for (const v of district(st, h)) {
      const home = sleepsHome(st, v, h);
      for (const hh of householdsOf(st, v)) {
        const plan = planFor(hh, at.year);
        if (!plan) continue;
        for (const id of goersOf(st, hh, plan)) {
          const s = home ? null : stayOf(st, id);
          if (!home && !(s && s.why === 'gathering')) continue;
          ids.push(id);
          hours.push(home ? hoursBetween(st, v, h) : 1);
          if (home) emit(st, 'gatheringSetOut', { pawn: id, household: hh.id, until: at.end }); // from home each day
        }
      }
    }
    if (!ids.length) return;
    const c = st.villages[h].center,
      place = { village: h, farm: null, tile: c, x: st.w.hx[c], y: st.w.hy[c] + 6 };
    for (let k = 0; k < at.days; k++) call(st, 'gathering', at.start + k * DAY, place, ids, hours, []);
  }
  // The end of a day on the green (sim/occasions' end of kind 'gathering'): the host village's holders pour their ale for those present,
  // those with most first, a barrel for each BREW.guests (sim/feast's pourAle: each guest remembers the pourer, the pourer's standing
  // counts it); after the last day, each lodged guest who is not kin of its host books a gift of a ration a night to the host's holder
  // (the start of a partnership), and the log tells who came.
  function dayEnd(st, o, present) {
    const h = o.village,
      g = choiceOf(st, h),
      farms = [];
    for (const hh of householdsOf(st, h)) farms.push([Stores.aleOf(st, hh), st.farmsteads[hh.farmstead]]);
    farms.sort((a, b) => b[0] - a[0] || a[1].id - b[1].id);
    let need = Math.ceil(present.length / BREW.guests),
      barrels = 0;
    for (const [n, f] of farms) {
      if (need <= 0 || n <= 0) break;
      const k = pourAle(st, f, present, need);
      need -= k;
      barrels += k;
    }
    if (g) g.ale = (g.ale || 0) + barrels;
    if (st.occasions.some((x) => x.kind === 'gathering' && x.village === h)) return;
    const [a, b] = whenHeld(st, h, cal(st.t).year),
      nights = (b - a) / DAY + 1; // the night before and each of its days
    const from = new Set();
    for (const id of present) {
      const p = st.pawns[id];
      if (p.household === null) continue;
      from.add(villageOf(st, st.households[p.household]));
      const s = stayOf(st, id);
      if (!s || s.why !== 'gathering' || s.host === undefined) continue;
      const host = st.households[s.host],
        mine = st.households[p.household];
      if (host.dissolved || host.holder === null || mine.holder === null || mine.holder === host.holder) continue;
      if (!st.pawns[host.holder].alive || !st.pawns[mine.holder].alive || kinHouseholds(st, mine).includes(host.id))
        continue;
      book(st, host.holder, mine.holder, nights);
    }
    log(st, report(st, h, present.length, from), { kind: 'gatheringHeld', village: h, n: present.length });
  }
  // The gathering's report (VB-303; design.md, The gathering, What the player sees), the log's line at the end of its last day: who
  // hosted, which villages came (those of the people there that day), how many were there, the border cases decided and the matches made
  // (when there are any: VB-297 and VB-298 count them),
  // who dealt at its fair and what changed hands (sim/fair's count of the fair, st.fair: read, never written here; the fair has no line of
  // its own), what failed for want of change, the hard bargains, and the ale poured. Reads only.
  function report(st, h, n, from) {
    const g = choiceOf(st, h),
      year = cal(st.t).year,
      list = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`),
      count = (k, one, many) => `${k} ${k === 1 ? one : many}`;
    const came = [...from].filter((v) => v !== h).sort((a, b) => a - b),
      fair = st.fair && st.fair.fairs.find((r) => r.host === h && r.year === year);
    const moved = fair
        ? Object.keys(fair.worth)
            .map((x) => `${x} ${Math.round(fair.worth[x])}`)
            .join(', ')
        : '',
      deals = fair
        ? `; at the fair ${count(fair.dealers, 'came', 'came')} to deal, ${count(fair.deals, 'deal', 'deals')} made` +
          `${moved ? ` (rations' worth: ${moved})` : ''}, ${fair.noChange} failed for want of change, ` +
          `${count(fair.hard, 'hard bargain', 'hard bargains')}`
        : '; no fair was held',
      cases = (g && g.cases) || 0,
      matches = (g && g.matches) || 0,
      heard = [
        cases && count(cases, 'border case', 'border cases') + ' decided',
        matches && count(matches, 'match', 'matches') + ' made',
      ]
        .filter(Boolean)
        .join(', '),
      ale = g && g.ale ? `; ${g.ale === 1 ? 'a barrel' : g.ale + ' barrels'} of ale poured` : '';
    return (
      `The gathering at ${st.villages[h].name} ends: hosted by ${st.villages[h].name}` +
      `${came.length ? `, with ${list(came.map((v) => st.villages[v].name))}` : ''}; ${n} were there on its last day` +
      `${heard ? `; ${heard}` : ''}${deals}${ale}.`
    );
  }
  onEnd('gathering', { end: (st, o, pre, present) => dayEnd(st, o, present) });
  // A goer's stay at the gathering opens (sim/away's lodge, at its house: VB-1175): its dealer loads there (sim/fair, VB-302), until the
  // gathering's end (its stay's until is the morning after).
  on('lodged', (st, s) => {
    if (s.why === 'gathering')
      emit(st, 'gatheringSetOut', { pawn: s.pawn, household: st.pawns[s.pawn].household, until: s.until - WORK[0] });
  });
  // A death at home, or an adult gone to another household (sim/heirs' move: 'rehoused'), while household hh's goers lodge at the
  // gathering: if no adult is left at home, the first adult lodged there turns for home (the news is known at once: knowledge moves
  // without a carrier). `gone`: the pawn who is no longer at home.
  function homeLeft(st, hh, gone) {
    const plan = planFor(hh, cal(st.t).year);
    if (!plan || !plan.go.length) return;
    let home = false,
      back = null;
    for (const m of hh.members) {
      const q = st.pawns[m];
      if (m === gone || !q.alive || age(st, q) < G.adult) continue;
      const s = stayOf(st, m);
      if (!s || s.why !== 'gathering' || s.back) home = true;
      else if (back === null) back = m;
    }
    if (!home && back !== null) issue(st, { actor: back, verb: 'comeHome', source: 'pawn' });
  }
  on('died', (st, d) => {
    const p = st.pawns[d.pawn];
    if (p.household !== null) homeLeft(st, st.households[p.household], d.pawn);
  });
  on('rehoused', (st, d) => {
    if (d.old && !d.old.dissolved && d.old !== d.hh) homeLeft(st, d.old, d.a ? d.a.id : null);
  });
  // goGathering: go to the village's gathering this winter (VB-295): named among the household's goers, who pack the day before
  register('goGathering', {
    check: (st, c) => living(st, c.actor) || goWhy(st, c.actor),
    run: (st, c) => setGoing(st, c.actor, true),
  });
  // stayHome: stay at home from the village's gathering this winter (VB-295), until the household packs
  register('stayHome', {
    check: (st, c) => living(st, c.actor) || stayWhy(st, c.actor),
    run: (st, c) => setGoing(st, c.actor, false),
  });
  // gathering({offer, prefs, by}): the village's choice of gathering this year (VB-294): whether it offers to host, and the hosts it
  // would go to, best first; made by its meeting (by 'meeting') or, when it did not decide, by its culture's practice (sim/gathering)
  register('gathering', {
    check: (st, c) => settlement(st, c) || choiceWhy(st, c.actor.settlement, c.args),
    run: (st, c) => setGathering(st, c.actor.settlement, c.args),
  });
  return {
    chooseGathering,
    choiceWhy,
    setGathering,
    settleGatherings,
    district,
    gatherings,
    whenHeld,
    rank,
    canHost,
    ahead,
    packStep,
    goWhy,
  };
})();
