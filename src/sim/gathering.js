// @sys sim/gathering: the gathering (VB-294; design.md, The gathering): at its autumn meeting a village with a green offers to host and every
//   village ranks the hosts it would walk to, by effective hours; once all have met, each goes to one gathering that stands (three villages
//   or more, the host among them, lodged by its farms); the district is the villages of one gathering, read from the choice
// @state village.gathering: null or absent (no choice made yet), else {chosen (the year of the meeting's last choice), by ('meeting' |
//   'asLastYear' | 'nothing'), hosting (the village offers to host that year's gathering), prefs[] (village ids of the hosts it would go to,
//   best first, each with a green and within a day's walk), year (the year of the winter the village's gathering is for), host (the village
//   whose gathering it attends that winter, or null for none; its own id when it hosts one that stands), ale (barrels its host poured at
//   the gathering it hosted that winter: 0 until VB-295 holds it)}. The meeting's verb `gathering` writes chosen, by, hosting and prefs
//   (setGathering); the evening's settling writes year, host and ale (settleGatherings); between the two, year and host are last year's.
VB['sim/gathering'] = (() => {
  const { settlement } = VB['sim/records'];
  const { GATHERING, TRAVEL, YEAR, SEASON_DAYS, DAY, cal } = VB['sim/rules'];
  const { hoursBetween, withinDay } = VB['sim/villagehours'];
  const { log } = VB['sim/records'];
  const { opinionOf } = VB['sim/relations'];
  const { kinHouseholds } = VB['sim/exchange'];
  const Green = VB['sim/green'];
  const { issue, register } = VB['sim/commands'];
  const Culture = VB['culture'];
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
      by = Culture.practiceOf(st.cenv.cultures[s.culture], 'noDecision');
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
  // gathering({offer, prefs, by}): the village's choice of gathering this year (VB-294): whether it offers to host, and the hosts it
  // would go to, best first; made by its meeting (by 'meeting') or, when it did not decide, by its culture's practice (sim/gathering)
  register('gathering', {
    check: (st, c) => settlement(st, c) || choiceWhy(st, c.actor.settlement, c.args),
    run: (st, c) => setGathering(st, c.actor.settlement, c.args),
  });
  return { chooseGathering, choiceWhy, setGathering, settleGatherings, district, gatherings, whenHeld, rank, canHost };
})();
