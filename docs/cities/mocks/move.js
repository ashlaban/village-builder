// Mock C for the town's plan (VB-189): makers who may move to where buyers come, and gatherings as the carrier of dealing.
// Throwaway research code, not game code; no test or tool reads it.
//   node docs/cities/mocks/move.js               every table of docs/cities/mock-town-emergence.md, part C (a minute and a half)
//   node docs/cities/mocks/move.js --only base|feedback|reach|lock|size|label|bad|sweep|days   (tables C1 to C9, in that order)
// Households stand at the villages of a real generated map (hours.json: the game's table of walking hours). Nobody calls a market
// (Kim, 16 November). Gatherings happen anyway: each village's meeting (autumn day 10), its three rites (spring day 1, summer day 6,
// winter day 7: VB-522) and the district's yearly gathering at a host's green (winter days 1 to 3: VB-294). Whoever is there deals on
// the green with whoever else is; a household may walk to another village's gathering day to deal, if its village's remembered share of
// wants met on that green pays the walk; a maker carries goods to a green where its remembered sales pay the walk. On any other day a
// household may walk to a named maker's house.
// A maker's household sizes its fields each spring against its head's estimate of all its food (cautious heads trust the craft's poor
// years, bold ones its mean). At the round a maker, and a would-be maker (a younger son with a craft and no holding), may ask for a plot
// in the village where its own estimate of custom is best: the households it believes would come there (those it has seen walk as far
// for its good, or who are known to go there already), shared with the makers of its craft already there; against the fields and kin
// it leaves, the carrying of its material from the nearest bog or clay, and the fields to be had there. One ask a year, concluded at the
// round; the receiving village always says yes (a toy: VB-697's alderman is not modelled).
// Numbers: numbers.js (GAME from the game and its plans, INVENTED.move made up).
const { GAME: G, INVENTED: I, rng, harvest, table, median, mean, opt } = require('./numbers.js');
const MAPS = require('./hours.json');
const X = I.move, GOODS = X.goods, CRAFTS = GOODS.filter((g) => g.craft);
const hourValue = G.idle.map((idle) => I.peakHourValue[1] * (1 - idle)), hourWorth = mean(hourValue); // an hour's worth by season, and over the year
const REACH = G.travel.dayWalk / 2; // there and back in a day
const need = G.household.hands * G.ration.adult + G.household.children * G.ration.child; // 216
const fieldHours = G.field.hours.reduce((s, h) => s + h, 0), fieldEst = G.field.yield * G.expect - G.field.seed; // 85 hours, 50 rations
const farmFields = (G.want * need) / (G.field.yield * G.expect); // 3.2 fields a farm
const plotFood = I.garden.food + X.plotCows * G.cow.food, plotHours = I.garden.hours + X.plotCows * G.cow.hayHours;
const pool = G.household.hands * G.adultHours - G.chores; // adult hours a maker's household has for fields and craft
const rate = (L) => G.skills.novice + (G.skills.master - G.skills.novice) * L;
// hours to make one purchase's worth at skill L, the material dug at the door (mock A's formulas)
const pieceHours = {
  smith: (L) => (G.bloom.smeltHours / rate(L) + G.bloom.ore * I.oreHoursPerLoad + G.bloom.wood * G.woodHoursPerLoad) / (1 + (G.bloom.masterYield - 1) * L),
  potter: (L) => ((G.pot.fireHours / rate(L) + I.oreHoursPerLoad + G.woodHoursPerLoad) / G.pot.perFiring) * 2,
  weaver: (L) => (G.cloth.spinHours * G.cloth.skeins + G.cloth.weaveHours) / rate(L),
};
const BR = [0.5, 1.5, 3, 6]; // a maker's experience of who buys, by the buyer's walk
const bracket = (h) => { for (let i = 0; i < BR.length; i++) if (h <= BR[i]) return i; return BR.length; };
const RATES = GOODS.reduce((s, g) => s + g.rate, 0);
const RITES = [0, 17, 42], MEETING = 33, GATHERING = [36, 37, 38]; // days of the year: spring 1, summer 6, winter 7; autumn 10; winter 1 to 3
const homeCraft = 242, farmWork = G.household.hands * G.adultHours * (1 - mean(G.idle)); // mock A, table A5: craft hours and hours worked a farm a year

function run(mapKey, seed, o = {}) {
  const P = { ...X, ...o }, m = MAPS.find((x) => x.key === mapKey), r = rng(seed), V = m.villages.length, years = o.years || 60;
  const H = m.hours.map((row, a) => row.map((h, b) => (a === b ? 0.1 : h === null ? Infinity : h)));
  const dens = o.density || 1, size = m.villages.map((v) => Math.max(1, Math.round(v.households * dens)));
  const potential = size.map((_, a) => size.reduce((s, n, b) => s + n * Math.exp(-H[a][b] / 3), 0));
  const within = (a, h) => size.reduce((s, n, b) => s + (H[a][b] <= h ? n : 0), 0);
  const ratio = o.ratio || G.farmRatio, budgetShare = o.budget ?? 1, walk = o.walk || 1, often = o.often || 1; // variants: the walk's cost and how often wants come, scaled
  // the map's deposits and its makers at the start are drawn from a stream of their own, so that runs can differ by chance alone
  const sr = rng(o.placeSeed ?? seed);
  const mat = { bog: size.map(() => sr() < (o.bog ?? G.place.bogIron)), clay: size.map(() => sr() < G.place.clay) };
  for (const k of ['bog', 'clay']) if (!mat[k].some((x) => x)) mat[k][Math.floor(sr() * V)] = true;
  const srcH = (g, a) => (g.mat ? Math.min(...mat[g.mat].map((has, b) => (has ? (a === b ? 0 : H[a][b]) : Infinity))) : 0);
  const extra = CRAFTS.map((g) => size.map((_, a) => (g.loads * 2 * srcH(g, a)) / P.loadsPerTrip)); // hours of carrying material a purchase, by village
  const hh = [], farmCount = size.slice();
  size.forEach((n, a) => { for (let k = 0; k < n; k++) hh.push({ v: a, id: hh.length, wants: [], need: need * (0.6 + 0.8 * r()), ratio: ratio[0] + (ratio[1] - ratio[0]) * r(), store: 0, budget: 0, fisher: m.villages[a].sea && r() < P.fishers, gath: false }); });
  const fishers = size.map((_, a) => hh.filter((h) => h.v === a && h.fisher).length);
  let slack = size.map((n) => P.landSlack * n * farmFields); // fields to be had at each village
  // makers
  const makers = []; let nextId = 0;
  const pickV = (ok) => { const w = size.map((n, a) => (ok(a) ? n : 0)), tot = w.reduce((s, x) => s + x, 0); let u = sr() * tot; for (let a = 0; a < V; a++) { u -= w[a]; if (u < 0) return a; } return 0; };
  const newMaker = (ci, v, held, R) => ({ id: nextId++, ci, v, origin: v, held, F: Math.min(held, 4), caution: R(), mem: [], cum: 0, L: 0, q: P.prior.slice(), exp: new Map(), since: 0, born: 0, lean: 0,
    sold: 0, n: 0, hoursCraft: 0, hoursLeft: 0, to: BR.map(() => 0).concat(0), gath: false, away: -1 });
  CRAFTS.forEach((g, ci) => { for (let k = 0; k < (o.makers ?? P.makers); k++) { const v = o.cluster ?? pickV((a) => !g.mat || mat[g.mat][a]); const k = newMaker(ci, v, 5, sr); k.farm = true; makers.push(k); farmCount[v] = Math.max(0, farmCount[v] - 1); } });
  // gatherings that happen anyway. The yearly gathering's hosts stand in for VB-294's choice: a village hosts if none of higher
  // potential within half a day does; every village goes to the nearest host within a day's walk; a host fewer than 3 villages chose is not held
  let hosts = []; const order = potential.map((p, a) => [p, a]).sort((x, y) => y[0] - x[0]).map((x) => x[1]);
  for (const a of order) if (size[a] >= 3 && !hosts.some((b) => H[a][b] <= REACH)) hosts.push(a);
  let hostOf = size.map(() => -1);
  for (let pass = 0; pass < 2; pass++) {
    hostOf = size.map((_, a) => { let best = -1; for (const b of hosts) if (H[a][b] <= G.travel.dayWalk && (best < 0 || H[a][b] < H[a][best])) best = b; return best; });
    hosts = hosts.filter((b) => hostOf.filter((x) => x === b).length >= G.gatherMin);
  }
  hostOf = hostOf.map((b) => (hosts.includes(b) ? b : -1));
  if (o.noGathering) { hosts = []; hostOf = hostOf.map(() => -1); }
  const green = size.map((n) => n >= 3), greenOf = size.map((_, a) => { if (green[a]) return a; let best = -1; for (let b = 0; b < V; b++) if (green[b] && H[a][b] <= 2 && (best < 0 || H[a][b] < H[a][best])) best = b; return best; });
  const reachV = size.map((_, a) => size.map((_, b) => b).filter((b) => H[a][b] <= REACH));
  const stagger = (a) => (o.stagger ? (a % 4) * 3 : 0); // a variant: each village's rite days fixed by its own custom, 0, 3, 6 or 9 days later
  // what is remembered: a village's share of wants met on a green's gathering days (by kind of day); the households of b seen at c in a year
  const est = size.map(() => size.map(() => [GOODS.map(() => I.prior), GOODS.map(() => I.prior)]));
  const visit = size.map((_, b) => size.map((_, c) => (b === c ? 1 : 0)));
  const stats = [], events = { asks: 0, moves: 0, founded: 0, noPlace: 0, quit: 0, ended: 0, movedHome: 0 };
  // what a maker leaves: a farm of its own is taken up by a farming household (its heir, or whoever claims it); fields had as a plot household go back to be had
  const farm = (v) => ({ v, id: hh.length, wants: [], need: need * (0.6 + 0.8 * r()), ratio: ratio[0] + (ratio[1] - ratio[0]) * r(), store: 0, budget: 0, fisher: false, gath: false });
  const release = (k) => { if (k.farm) { hh.push(farm(k.v)); farmCount[k.v]++; k.farm = false; } else slack[k.v] += k.held; };
  const sellersAt = () => { const s = size.map(() => CRAFTS.map(() => [])); for (const k of makers) s[k.v][k.ci].push(k); return s; };

  for (let y = 0; y < years; y++) {
    const hf = harvest(r);
    const surplus = size.map(() => 0); // what each village's farms make over their need this year
    for (const f of hh) {
      surplus[f.v] += Math.max(0, f.need * f.ratio * (hf / G.weather.mean) - f.need);
      f.store = Math.max(0, f.store + f.need * f.ratio * (hf / G.weather.mean) - f.need);
      f.store -= G.storeLoss[0] * Math.min(f.store, f.need) + G.storeLoss[1] * Math.min(Math.max(f.store - f.need, 0), f.need) + G.storeLoss[2] * Math.max(f.store - 2 * f.need, 0);
      f.budget = Math.max(0, f.store - I.reserve * f.need) * budgetShare; f.gath = r() < P.social.gathering;
    }
    const spare = size.map(() => 0); for (const f of hh) spare[f.v] += f.budget;
    // spring: each maker's head sizes its fields against its own estimate of all its food
    for (const k of makers) {
      const s = [...k.mem].sort((a, b) => a - b), poor = s.length >= 3 ? s[1] : 0, mn = s.length >= 3 ? mean(s) : s.length ? mean(s) * 0.5 : 0;
      k.estCraft = o.fields === 'need' ? 0 : k.caution * poor + (1 - k.caution) * mn;
      k.needNow = y - k.born < 8 && k.young ? P.youngNeed : need;
      k.F = Math.max(0, Math.min(k.held, Math.ceil((G.want * k.needNow - k.estCraft - plotFood) / fieldEst)));
      k.hoursLeft = pool - k.F * fieldHours - plotHours; k.sold = 0; k.n = 0; k.hoursCraft = 0; k.to.fill(0); k.gath = r() < P.social.gathering; k.soldGreen = 0;
      k.L = k.cum / (k.cum + G.skills.half);
    }
    const S = sellersAt(), has = size.map((_, a) => GOODS.map((g, gi) => (g.craft ? S[a][gi].length > 0 : g.sea ? fishers[a] > 0 : false)));
    // the year's gathering days
    const days = Array.from({ length: G.yearDays }, () => []);
    for (let a = 0; a < V; a++) {
      if (!farmCount[a] && !S[a].some((x) => x.length)) continue;
      const att = new Set([a]);
      days[MEETING].push({ g: a, cls: 0, kind: 'meeting', att, p: P.social.meeting });
      if (green[a]) { const at = new Set(); greenOf.forEach((g, b) => { if (g === a) at.add(b); }); for (const d of RITES) days[(d + stagger(a)) % G.yearDays].push({ g: a, cls: 0, kind: 'rite', att: at, p: P.social.rite }); }
      for (let k = 0; k < (o.ale || 0); k++) { const at = new Set(); let n = 0; for (let b = 0; b < V; b++) if (H[a][b] <= 1.5) { at.add(b); n += size[b]; } days[Math.floor(r() * G.yearDays)].push({ g: a, cls: 0, kind: 'ale', att: at, p: Math.min(1, P.social.ale / n) }); }
    }
    for (const b of hosts) { const att = new Set(); hostOf.forEach((x, a) => { if (x === b) att.add(a); }); for (const d of GATHERING) days[d].push({ g: b, cls: 1, kind: 'gathering', att, p: 1 }); }
    // each village's view of the calendar: the gatherings its people are at anyway, those within a day there and back, and what is coming
    const mine = days.map((evs) => size.map((_, v) => evs.map((_, e) => e).filter((e) => evs[e].att.has(v))));
    const near = days.map((evs) => size.map((_, v) => evs.map((_, e) => e).filter((e) => H[v][evs[e].g] <= REACH)));
    const soonFor = days.map((_, d) => { const out = size.map(() => []); for (let a = 1; a <= 12; a++) { const d2 = (d + a) % G.yearDays;
      for (const ev of days[d2]) for (const v of ev.att) out[v].push([ev, a]); } return out; });
    const Y = { y, hf, spare, surplus, dGreen: size.map(() => 0), dHouse: size.map(() => 0), greenDeals: size.map(() => 0), houseDeals: size.map(() => 0), outGreen: size.map(() => 0), worth: size.map(() => 0),
      born: 0, filled: 0, lapsed: 0, poor: 0, trips: size.map(() => size.map(() => 0)), greenDays: size.map(() => 0), byDay: o.byDay ? size.map(() => new Array(G.yearDays).fill(0)) : null };
    const sell = (h, k, g, gi, place) => { const ph = pieceHours[g.craft](k.L) + extra[k.ci][k.v]; h.budget -= g.worth; h.store -= g.worth; k.sold += g.worth; k.n++; k.hoursLeft -= ph; k.hoursCraft += ph; k.to[bracket(H[k.v][h.v])]++; Y.worth[place] += g.worth; };
    const maker = (list, g) => { const ok = list.filter((k) => k.hoursLeft >= pieceHours[g.craft](k.L) + extra[k.ci][k.v]); return ok.length ? ok[Math.floor(r() * ok.length)] : null; };
    for (let d = 0; d < G.yearDays; d++) {
      const now = y * G.yearDays + d, hv = hourValue[Math.floor(d / G.seasonDays)] * walk, today = days[d];
      // where each maker is today: on its own village's green, at a gathering it goes to anyway, or at a green its remembered sales pay the walk to
      const here = today.map(() => CRAFTS.map(() => [])), count = today.map(() => 0), fish = today.map((ev) => 0);
      for (const k of makers) {
        k.away = -1; let best = -1, bv = 0; const g = CRAFTS[k.ci];
        today.forEach((ev, e) => {
          const anyway = ev.g === k.v || (ev.att.has(k.v) && (ev.cls ? k.gath : true)), e0 = k.exp.get(ev.g * 2 + ev.cls) ?? 1;
          const val = e0 * g.worth * 0.8 - (anyway ? 0 : H[k.v][ev.g] > REACH ? Infinity : (2 * H[k.v][ev.g] + P.dealHours) * hv) + (anyway ? 0.01 : 0);
          if (val > bv) { bv = val; best = e; }
        });
        if (best >= 0) { here[best][k.ci].push(k); k.away = best; count[best]++; k.soldToday = 0; if (today[best].g !== k.v) Y.trips[k.v][today[best].g]++; }
      }
      const goers = today.map(() => []), dealtOut = new Map();
      for (const h of hh) {
        const u = r() * G.yearDays; // a want is born: one draw a household a day, the good by its rate
        if (u < RATES * often) { let gi = 0, c = GOODS[0].rate * often; while (u >= c) c += GOODS[++gi].rate * often; Y.born++; if (GOODS[gi].any && r() < 1 - Math.pow(1 - P.any, size[h.v] - 1)) Y.filled++; else h.wants.push({ gi, born: now }); }
        // is someone of the household at a gathering today anyway
        let social = -1;
        for (const e of mine[d][h.v]) { const ev = today[e]; if (ev.cls ? h.gath : r() < ev.p) { social = e; break; } }
        if (social >= 0) { goers[social].push(h); count[social]++; if (h.fisher) fish[social]++; if (today[social].g !== h.v) Y.trips[h.v][today[social].g]++; continue; }
        if (!h.wants.length) continue;
        const turn = (d + h.id) % 3 === 0; if (!turn && !today.length) continue;
        h.wants = h.wants.filter((w) => { const old = now - w.born >= G.yearDays; if (old) Y.lapsed++; return !old; });
        const live = h.wants.filter((w) => GOODS[w.gi].worth <= h.budget); if (!live.length) continue;
        const worth = (w, at) => GOODS[w.gi].gain * Math.max(0, 1 - GOODS[w.gi].wait * (at - w.born));
        let best = 0, how = null;
        if (turn) for (const a of reachV[h.v]) { let val = 0; for (const w of live) if (has[a][w.gi]) val += worth(w, now); if (!val) continue; val -= 2 * H[h.v][a] * hv; if (val > best) { best = val; how = { visit: a }; } }
        for (const e of near[d][h.v]) { const ev = today[e]; let val = -(2 * H[h.v][ev.g] + P.dealHours) * hv;
          for (const w of live) val += worth(w, now) * (GOODS[w.gi].craft && here[e][w.gi].length ? 1 : est[h.v][ev.g][ev.cls][w.gi]); if (val > best) { best = val; how = { ev: e }; } }
        let later = 0;
        for (const [ev, ahead] of soonFor[d][h.v]) { if (ev.cls && !h.gath) continue; // or wait for a gathering it will be at anyway, if it expects more of that
          let val = 0; for (const w of live) val += worth(w, now + ahead) * (has[ev.g][w.gi] && GOODS[w.gi].craft ? 1 : est[h.v][ev.g][ev.cls][w.gi]); if (val > later) later = val; }
        if (!how || best < later) continue;
        if (how.ev !== undefined) { goers[how.ev].push(h); count[how.ev]++; Y.trips[h.v][today[how.ev].g]++; continue; }
        // a walk to a named household: the makers and fishers who live at the village
        const a = how.visit; let n = 0;
        h.wants = h.wants.filter((w) => { const g = GOODS[w.gi]; if (g.worth > h.budget) return true; if (g.craft) { const k = maker(S[a][w.gi], g); if (!k) return true; sell(h, k, g, w.gi, a); } else if (g.sea && fishers[a]) { h.budget -= g.worth; h.store -= g.worth; Y.worth[a] += g.worth; } else return true; n++; return false; });
        if (n) { Y.filled += n; Y.houseDeals[a] += n; if (a !== h.v) { Y.trips[h.v][a]++; dealtOut.set(a, (dealtOut.get(a) || 0) + 1); } }
      }
      for (const [a, n] of dealtOut) if (n >= P.dealMin) { Y.dHouse[a]++; if (Y.byDay) Y.byDay[a][d] += n; }
      // the greens: whoever is there deals with whoever else is
      today.forEach((ev, e) => {
        const A = count[e], gp = ev.g, fishHere = fish[e] + 0; let dealt = 0, out = 0; const sellersDealt = new Set();
        for (const h of goers[e]) {
          let n = 0;
          h.wants = h.wants.filter((w) => { const g = GOODS[w.gi]; if (now - w.born >= G.yearDays) { Y.lapsed++; return false; } if (g.worth > h.budget) return true; let found = false;
            if (g.any) found = r() < 1 - Math.pow(1 - P.any, A - 1);
            else if (g.craft) { const k = maker(here[e][w.gi], g); if (k) { found = true; sell(h, k, g, w.gi, gp); k.soldToday++; k.soldGreen += g.worth; sellersDealt.add(k.id); } }
            else if (fishHere) { found = true; h.budget -= g.worth; h.store -= g.worth; Y.worth[gp] += g.worth; }
            est[h.v][gp][ev.cls][w.gi] = 0.7 * est[h.v][gp][ev.cls][w.gi] + 0.3 * (found ? 1 : 0); if (found) n++; return !found; });
          if (n) { dealt++; if (h.v !== gp) out++; Y.filled += n; Y.greenDeals[gp] += n; }
        }
        for (const list of here[e]) for (const k of list) k.exp.set(gp * 2 + ev.cls, 0.7 * (k.exp.get(gp * 2 + ev.cls) ?? 1) + 0.3 * k.soldToday);
        Y.greenDays[gp]++;
        if (dealt + sellersDealt.size >= P.dealMin) { Y.dGreen[gp]++; if (Y.byDay) Y.byDay[gp][d] += dealt; } Y.outGreen[gp] += out;
      });
    }
    // the year's end: what each maker's year gave, what was learned, who ends, who gives up; then the round
    const rival = (ci, c, self) => o.noRival ? 0 : makers.reduce((s, k) => s + (k === self || k.ci !== ci ? 0 : k.v === c ? 1 : H[k.v][c] <= 1.5 ? 0.5 : 0), 0);
    for (let b = 0; b < V; b++) for (let c = 0; c < V; c++) if (b !== c) visit[b][c] = 0.6 * visit[b][c] + 0.4 * Math.min(1, Y.trips[b][c] / Math.max(1, farmCount[b]));
    for (const k of makers) {
      const g = CRAFTS[k.ci];
      k.food = k.sold + k.F * (G.field.yield * hf - G.field.seed) + plotFood; k.craftShare = k.sold / Math.max(1, k.food);
      k.mem.push(k.sold); if (k.mem.length > I.memory) k.mem.shift(); k.cum = k.cum * (1 - G.skills.fade) + k.hoursCraft;
      const riv = 1 + rival(k.ci, k.v, k), inB = BR.map(() => 0).concat(0); for (let b = 0; b < V; b++) inB[bracket(H[k.v][b])] += farmCount[b];
      inB.forEach((n, i) => { if (n) k.q[i] = 0.5 * k.q[i] + 0.5 * Math.min(1, (k.to[i] * riv) / (n * g.rate * often)); });
      k.lean = k.food < P.hungry * k.needNow ? k.lean + 1 : 0;
    }
    const mk = (f) => size.map((_, a) => makers.filter((k) => k.v === a && f(k)).length);
    Object.assign(Y, { makers: mk(() => true), fieldFree: mk((k) => k.F === 0), half: mk((k) => k.craftShare > 0.5), landless: mk((k) => !k.held), hungry: mk((k) => k.food < P.hungry * k.needNow),
      craftHours: size.map((_, a) => makers.filter((k) => k.v === a).reduce((s, k) => s + k.hoursCraft, 0)), farmHours: size.map((_, a) => makers.filter((k) => k.v === a).reduce((s, k) => s + k.F * fieldHours + plotHours + G.chores, 0)),
      crafts: size.map((_, a) => new Set(makers.filter((k) => k.v === a).map((k) => k.ci)).size), craftFood: size.map((_, a) => makers.filter((k) => k.v === a).reduce((s, k) => s + k.sold, 0)), greenSold: makers.reduce((s, k) => s + k.soldGreen, 0), sold: makers.reduce((s, k) => s + k.sold, 0),
      foodShare: makers.length ? mean(makers.map((k) => k.food / k.needNow)) : NaN, foodPlot: mean(makers.filter((k) => !k.F).map((k) => k.food / k.needNow)), foodField: mean(makers.filter((k) => k.F).map((k) => k.food / k.needNow)), hungryPlot: mean(makers.filter((k) => !k.F).map((k) => (k.food < P.hungry * k.needNow ? 1 : 0))), farms: farmCount.slice(), ev: { ...events } });
    stats.push(Y);
    for (let i = makers.length - 1; i >= 0; i--) { const k = makers[i]; const end = r() < P.turnover, quit = !k.held && k.lean >= 2; if (end || quit) { release(k); makers.splice(i, 1); events[end ? 'ended' : 'quit']++; } }
    if (o.noMove && o.noEntry) continue;
    // a maker's estimate of its custom at c: the households it believes would come there for its good, shared with those of its craft there
    const custom = (k, c, noSelf) => { const g = CRAFTS[k.ci]; let n = 0;
      for (let b = 0; b < V; b++) { if (!farmCount[b]) continue; const far = k.q[bracket(H[c][b])]; n += farmCount[b] * g.rate * often * Math.max(far, o.noFeedback ? 0 : visit[b][c] * k.q[0]); }
      return n / (1 + rival(k.ci, c, noSelf ? null : k)); };
    const weigh = (k, c, home) => { const g = CRAFTS[k.ci], s = [...k.mem].sort((a, b) => a - b), trust = s.length >= 3 && mean(s) > 0 ? (k.caution * s[1] + (1 - k.caution) * mean(s)) / mean(s) : 1 - 0.4 * k.caution;
      const ph = pieceHours[g.craft](k.L) + extra[k.ci][c] * (o.matCost ?? 1); let n = custom(k, c) , fields = home ? k.held : 0;
      const craftMax = (pool - plotHours) / ph; n = Math.min(n, craftMax);
      const craft = n * g.worth * trust * (home ? 1 : P.newPlace), wantF = Math.max(0, Math.ceil((G.want * k.needNow - craft - plotFood) / fieldEst));
      const F = Math.min(wantF, home ? k.held : Math.floor(slack[c])), food = craft + F * fieldEst + plotFood, hours = n * ph + F * fieldHours + plotHours;
      return { c, F, food, u: Math.min(food, 1.5 * k.needNow) - hours * hourWorth - (c === k.origin ? 0 : P.kin * (o.kinCost ?? 1)), ok: food >= G.want * k.needNow && hours <= pool }; };
    if (!o.noMove) for (const k of [...makers].sort(() => r() - 0.5)) {
      if (y - k.since < 3) continue; k.needNow = need;
      const home = weigh(k, k.v, true); let best = null;
      for (let c = 0; c < V; c++) { if (c === k.v || H[k.v][c] > P.moveReach) continue; const w = weigh(k, c, false); if (w.ok && (!best || w.u > best.u)) best = w; }
      if (!best) continue; if (best.u > home.u) events.asks++;
      if (best.u > home.u + P.inertia * need) { release(k); slack[best.c] -= best.F; if (best.c === k.origin) events.movedHome++; k.v = best.c; k.held = best.F; k.since = y; k.exp = new Map(); events.moves++; }
    }
    if (!o.noEntry) for (let a = 0; a < V; a++) if (r() < Math.min(1, (o.entry ?? P.entry) * farmCount[a])) {
      const k = newMaker(Math.floor(r() * CRAFTS.length), a, 0, r); k.young = true; k.born = y + 1; k.needNow = P.youngNeed; k.since = y; let best = null;
      for (let c = 0; c < V; c++) { if (H[a][c] > P.moveReach || (o.noMove && c !== a)) continue; const w = weigh(k, c, false); if (w.ok && (!best || w.u > best.u)) best = w; }
      if (!best) { events.noPlace++; continue; }
      slack[best.c] -= best.F; k.v = best.c; k.held = best.F; makers.push(k); events.founded++;
    }
  }
  return { m, V, H, size, potential, within, stats, events, hosts, mat, makersLeft: makers, farmCount };
}

// ---- readings
const f1 = (x) => (Number.isFinite(x) ? (Math.round(x * 10) / 10).toFixed(1) : '-'), f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-'), pc = (x) => (Number.isFinite(x) ? Math.round(x * 100) + '%' : '-');
const top = (arr) => arr.indexOf(Math.max(...arr)), sum = (arr) => arr.reduce((s, x) => s + x, 0);
const lastN = (R, n = 10) => R.stats.slice(-n);
const avgV = (R, f, n = 10) => R.size.map((_, a) => mean(lastN(R, n).map((S) => f(S, a))));
// a place's share of work that is not farming (Kim: all craft hours count, a farm's own included): its farms' home craft and its makers' craft hours
const workShare = (S, a) => { const farms = S.farms[a], mk = S.makers[a]; const craft = farms * homeCraft + mk * homeCraft + S.craftHours[a], all = farms * (farmWork + homeCraft) + mk * homeCraft + S.craftHours[a] + S.farmHours[a]; return all ? craft / all : NaN; };
function read(R) {
  const makers = avgV(R, (S, a) => S.makers[a]), tp = top(makers), L = lastN(R);
  const all = sum(makers), dG = avgV(R, (S, a) => S.dGreen[a]), dH = avgV(R, (S, a) => S.dHouse[a]);
  return { R, tp, makers, households: sum(R.size), all, places: makers.filter((n) => n >= 3).length, big: makers.filter((n) => n >= 8).length, three: mean(L.map((S) => S.crafts.filter((n) => n >= 3).length)),
    topMakers: makers[tp], topShare: makers[tp] / (all || 1), dGreen: dG[tp], dHouse: dH[tp], maxGreen: Math.max(...dG), maxHouse: Math.max(...dH),
    topFieldFree: avgV(R, (S, a) => S.fieldFree[a])[tp], topHalf: avgV(R, (S, a) => S.half[a])[tp], fieldFree: mean(L.map((S) => sum(S.fieldFree))), half: mean(L.map((S) => sum(S.half))),
    filled: mean(L.map((S) => S.filled / (S.born || 1))), greenSold: mean(L.map((S) => S.greenSold / (S.sold || 1))), w: mean(L.map((S) => workShare(S, tp))),
    island: mean(L.map((S) => { let c = 0, t = 0; R.size.forEach((_, a) => { c += (S.farms[a] + S.makers[a]) * homeCraft + S.craftHours[a]; t += S.farms[a] * (farmWork + homeCraft) + S.makers[a] * homeCraft + S.craftHours[a] + S.farmHours[a]; }); return c / t; })) };
}
function many(mapKey, o = {}, seeds = 4) {
  const X = []; for (let s = 1; s <= seeds; s++) X.push(read(run(mapKey, s * 13, o)));
  const mn = (f) => mean(X.map(f));
  return { households: X[0].households, 'maker households': f1(mn((x) => x.all)), 'with no field': f1(mn((x) => x.fieldFree)), 'half fed by craft': f1(mn((x) => x.half)),
    'villages with 3 or more': f1(mn((x) => x.places)), 'with all three crafts': f1(mn((x) => x.three)), 'with 8 or more': f1(mn((x) => x.big)), 'at the fullest place': f1(mn((x) => x.topMakers)), 'its share of makers': pc(mn((x) => x.topShare)),
    'green dealing days there': f1(mn((x) => x.dGreen)), 'most at any green': f1(mn((x) => x.maxGreen)), 'busy house days, the most': f1(mn((x) => x.maxHouse)),
    'sold on greens': pc(mn((x) => x.greenSold)), 'wants filled': pc(mn((x) => x.filled)), 'work not farming there': Math.round(1000 * mn((x) => x.w)), island: Math.round(1000 * mn((x) => x.island)),
    'moves a maker in 30 years': f1(mn((x) => (x.R.events.moves / 60 / (x.all || 1)) * 30)), founded: f1(mn((x) => x.R.events.founded)), 'found no place': f1(mn((x) => x.R.events.noPlace)), 'gave up': f1(mn((x) => x.R.events.quit)) };
}
const only = opt('only', ''), BASE = 'populous-small-7-y30', MED = 'populous-medium-7-y0';
const show = (title, rows, first) => { console.log('\n' + title); table(rows, [first, ...Object.keys(rows[0]).filter((k) => k !== first)]); };
const on = (k) => !only || only === k;
const central = (key, d) => top(run(key, 1, { years: 1, density: d }).potential);

if (on('base')) {
  console.log(`An hour's worth by season (rations): ${hourValue.map(f2).join(', ')}. A purchase takes a novice and a master: ${CRAFTS.map((g) => `${g.key} ${f1(pieceHours[g.craft](0))} to ${f1(pieceHours[g.craft](1))} h`).join(', ')}; carrying its material from a deposit 3 hours off adds ${CRAFTS.map((g) => `${g.key} ${f1(g.loads * 6)} h`).join(', ')}.`);
  console.log(`A farm gives a maker ${CRAFTS.map((g) => `${g.key} ${f1(g.rate * g.worth)}`).join(', ')} rations a year; a new household on a plot (need ${X.youngNeed}, a garden and ${X.plotCows} cows: ${Math.round(plotFood)}) lives by the custom of ${CRAFTS.map((g) => `${Math.round((G.want * X.youngNeed - plotFood) / (g.rate * g.worth))} farms (${g.key})`).join(', ')}.`);
  show('C1. Makers who may move, on each map (60 years, the last 10 counted, 4 seeds; 2 makers a craft at the start, a would-be maker a year per 100 farms)',
    [...MAPS.map((m) => ({ case: m.key, ...many(m.key) })), ...[2, 4].map((d) => ({ case: `${BASE} x ${d} households`, ...many(BASE, { density: d }) })), ...[2, 4].map((d) => ({ case: `${MED} x ${d} households`, ...many(MED, { density: d }) }))], 'case');
}
if (on('feedback')) {
  const rows = [];
  for (const [name, o] of [['as C1', {}], ['nobody moves; a would-be maker may only settle at home', { noMove: true }], ['makers judge a place by distance alone (not by who is seen to go there)', { noFeedback: true }],
    ['a maker does not count the makers of its craft already at a place', { noRival: true }], ['no yearly gathering', { noGathering: true }],
    ['all six first makers start in the most central village', { cluster: 'central' }], ['the same, and makers judge by distance alone', { cluster: 'central', noFeedback: true }], ['the same, and nobody moves', { cluster: 'central', noMove: true }]])
    for (const [key, d] of [[BASE, 1], [MED, 2]]) { const oo = { ...o, density: d }; if (o.cluster) oo.cluster = central(key, d); rows.push({ variant: name, map: `${key} x ${d}`, ...many(key, oo) }); }
  show('C2. Is it positive feedback: one thing changed at a time', rows, 'variant');
}
if (on('reach')) {
  // over all villages of all runs: the households within 3 hours' walk, against the makers who ended there
  const buckets = [[0, 20], [20, 40], [40, 80], [80, 160], [160, 320], [320, 1e9]], acc = buckets.map(() => ({ n: 0, makers: [], three: 0, any: 0, all3: 0, host: 0, hostMakers: [], dGreen: [], dHouse: [] }));
  for (const m of MAPS) for (const d of [1, 2, 4]) for (let s = 1; s <= 2; s++) { const R = run(m.key, s * 13, { density: d }), mk = avgV(R, (S, a) => S.makers[a]), dg = avgV(R, (S, a) => S.dGreen[a]), dh = avgV(R, (S, a) => S.dHouse[a]), cr = avgV(R, (S, a) => (S.crafts[a] >= 3 ? 1 : 0));
    R.size.forEach((_, a) => { const w = R.within(a, 3), b = acc[buckets.findIndex(([lo, hi]) => w >= lo && w < hi)]; b.n++; b.makers.push(mk[a]); if (mk[a] >= 3) b.three++; if (mk[a] >= 1) b.any++; b.all3 += cr[a]; if (R.hosts.includes(a)) { b.host++; b.hostMakers.push(mk[a]); } b.dGreen.push(dg[a]); b.dHouse.push(dh[a]); }); }
  show('C3. From what population within reach: the villages of all ten maps at 1, 2 and 4 times their households, 2 seeds each, by the households within 3 hours\' walk (years 51 to 60)',
    buckets.map(([lo, hi], i) => ({ 'households within 3 h': hi > 1e6 ? `${lo} and more` : `${lo} to ${hi}`, villages: acc[i].n, 'with a maker': pc(acc[i].any / acc[i].n), 'with 3 or more': pc(acc[i].three / acc[i].n), 'with all three crafts': pc(acc[i].all3 / acc[i].n), 'makers, mean': f1(mean(acc[i].makers)), 'makers, most': f1(Math.max(...acc[i].makers, 0)),
      'hosts of a gathering': acc[i].host, 'makers at a host, mean': f1(mean(acc[i].hostMakers)), 'green dealing days, mean': f1(mean(acc[i].dGreen)), 'busy house days, mean': f1(mean(acc[i].dHouse)) })), 'households within 3 h');
}
if (on('lock')) {
  const rows = [], N = 10;
  for (const [key, d] of [[BASE, 1], [BASE, 4], [MED, 2]]) {
    const R = []; for (let s = 1; s <= N; s++) R.push(run(key, s * 19, { placeSeed: 5, density: d }));
    const at = (x, y0, a) => mean(x.stats.slice(y0 - 5, y0).map((S) => S.makers[a]));
    const lead = (x, y0) => { const mk = x.size.map((_, a) => at(x, y0, a)); return Math.max(...mk) >= 2 ? top(mk) : -1; };
    const wins = {}; for (const x of R) { const a = lead(x, 60); if (a >= 0) wins[a] = (wins[a] || 0) + 1; }
    const x0 = R[0], rank = (a) => x0.potential.filter((p) => p > x0.potential[a]).length + 1, ord = Object.entries(wins).sort((a, b) => b[1] - a[1]);
    const sorted = x0.potential.map((p, a) => [p, a]).sort((a, b) => b[0] - a[0]), poor = sorted[Math.floor(sorted.length / 2)][1];
    const HS = []; for (let s = 1; s <= N; s++) HS.push(run(key, s * 19, { placeSeed: 5, density: d, cluster: poor }));
    rows.push({ map: `${key} x ${d}`, [`places that led at year 60, of ${N} runs`]: ord.map(([a, n]) => `${a} (rank ${rank(+a)}${x0.hosts.includes(+a) ? ', host' : ''}${x0.mat.bog[+a] ? ', bog' : ''}${x0.mat.clay[+a] ? ', clay' : ''}) ${n}`).join('; ') || 'none',
      'same place leads at years 20 and 60': R.filter((x) => lead(x, 20) >= 0 && lead(x, 20) === lead(x, 60)).length, 'at years 40 and 60': R.filter((x) => lead(x, 40) >= 0 && lead(x, 40) === lead(x, 60)).length, 'makers at the leader, year 60': f1(mean(R.map((x) => at(x, 60, lead(x, 60))))),
      'head start: all six first makers begin at': `${poor} (rank ${rank(poor)})`, 'it leads at year 20': HS.filter((x) => lead(x, 20) === poor).length, 'at year 60': HS.filter((x) => lead(x, 60) === poor).length,
      'makers there at years 10, 20, 40, 60': [10, 20, 40, 60].map((y0) => f1(mean(HS.map((x) => at(x, y0, poor))))).join(', '), 'of all makers at year 60': pc(mean(HS.map((x) => at(x, 60, poor) / sum(x.size.map((_, a) => at(x, 60, a)))))) });
  }
  show(`C4. Does it lock in: the same map, deposits and first makers, ${N} runs that differ only by chance; then all six first makers begun at a middling village`, rows, 'map');
}
if (on('size')) {
  const rows = [];
  for (const [key, d, o, name] of [[BASE, 1, {}, ''], [BASE, 4, {}, ''], [MED, 2, {}, ''], [MED, 4, {}, ''], [MED, 4, { cluster: 'central' }, ', the first makers begun together'], [BASE, 4, { ratio: [1.0, 1.25] }, ', a full island (1.0 to 1.25)'], [BASE, 4, { ratio: [1.0, 1.1] }, ', a lean island (1.0 to 1.1)'], [BASE, 4, { entry: 0.03 }, ', three times the would-be makers']]) {
    const oo = { density: d, ...o }; if (o.cluster) oo.cluster = central(key, d);
    const X = []; for (let s = 1; s <= 3; s++) X.push(read(run(key, s * 13, oo)));
    const mn = (f) => mean(X.map(f)), at = (x, f) => mean(lastN(x.R).map((S) => f(S, x.tp)));
    const inReach = (x, f) => mean(lastN(x.R).map((S) => x.R.size.reduce((s, _, b) => s + (x.R.H[x.tp][b] <= REACH ? f(S, b) : 0), 0)));
    const houses = Math.min(9, 2.5 + mn((x) => x.topMakers)), crowd = houses * G.household.people; // a house has at most about 9 houses within 2 steps (the draft plan's layout); a village house has about 15 people there already
    rows.push({ case: `${key} x ${d}${name}`, 'farms within a day there and back': Math.round(mn((x) => inReach(x, (S, b) => S.farms[b]))), 'maker households at the fullest place': f1(mn((x) => x.topMakers)), people: Math.round(mn((x) => x.topMakers) * G.household.people),
      'with no field': f1(mn((x) => x.topFieldFree)), 'part-farmers': pc(1 - mn((x) => x.topFieldFree) / (mn((x) => x.topMakers) || 1)), 'half fed by craft': f1(mn((x) => x.topHalf)),
      'rations their craft brought': Math.round(mn((x) => at(x, (S, a) => S.craftFood[a]))), 'all makers in reach': Math.round(mn((x) => inReach(x, (S, b) => S.craftFood[b]))), 'of what the farms in reach made over their need': pc(mn((x) => inReach(x, (S, b) => S.craftFood[b]) / inReach(x, (S, b) => S.surplus[b]))),
      'wants unmet': pc(1 - mn((x) => x.filled)), 'people within 2 steps of a town house': Math.round(crowd), 'crowding factor': f2(Math.min(2.5, 1 + 0.035 * Math.max(0, crowd - 36))) });
  }
  show('C5. How large the fullest place gets, and what stops it (3 seeds, years 51 to 60)', rows, 'case');
}
if (on('label')) {
  // every village-year of the last 30 years of the runs: what the label would read
  const dg = [], dh = [], ws = [], out = [], rowsT = [];
  const cases = [[BASE, 1], [BASE, 2], [BASE, 4], [MED, 1], [MED, 2], [MED, 4]];
  for (const [key, d] of cases) for (let s = 1; s <= 3; s++) { const R = run(key, s * 13, { density: d }); for (const S of R.stats.slice(-30)) R.size.forEach((_, a) => { if (S.farms[a] + S.makers[a] < 3) return; dg.push(S.dGreen[a]); dh.push(S.dHouse[a]); out.push(S.outGreen[a]); ws.push([workShare(S, a), S.makers[a]]); }); }
  const hist = (arr, cuts) => cuts.map((c, i) => ({ value: i + 1 < cuts.length ? (cuts[i + 1] - c > 1 ? `${c} to ${cuts[i + 1] - 1}` : `${c}`) : `${c} and more`, 'village-years': pc(arr.filter((x) => x >= c && (i + 1 >= cuts.length || x < cuts[i + 1])).length / arr.length) }));
  show(`C6a. Dealing days on the green a year, over ${dg.length} village-years (villages of 3 households or more; 6 cases, 3 seeds, years 31 to 60). A village has 4 gathering days of its own, a host 7`, hist(dg, [0, 1, 2, 3, 4, 5, 6, 7, 8]), 'value');
  show('C6b. Households of other villages that dealt on a village\'s green in a year, the same village-years', hist(out, [0, 1, 3, 6, 12, 24, 48, 96]), 'value');
  show('C6c. Busy house days a year (3 or more households of other villages dealt at houses there), the same village-years', hist(dh, [0, 1, 3, 6, 12, 24, 36]), 'value');
  show('C6d. Work that is not farming, per 1,000 of hours worked there (a farm\'s own crafts counted: 239), by the maker households living there',
    [0, 1, 2, 3, 5, 8, 12].map((c, i, arr) => { const sel = ws.filter(([, n]) => n >= c && (i + 1 >= arr.length || n < arr[i + 1])).map(([w]) => w).sort((a, b) => a - b); return { 'maker households': i + 1 < arr.length ? (arr[i + 1] - c > 1 ? `${c} to ${arr[i + 1] - 1}` : `${c}`) : `${c} and more`, 'village-years': sel.length, median: Math.round(1000 * median(sel)), 'nine in ten under': Math.round(1000 * sel[Math.floor(sel.length * 0.9)]), most: Math.round(1000 * Math.max(...sel)) }; }).filter((x) => x['village-years']), 'maker households');
  for (const [key, d, o, name] of [[BASE, 1, {}, ''], [BASE, 4, {}, ''], [MED, 2, {}, ''], [MED, 2, { cluster: 'central' }, ', first makers begun together']]) { const oo = { density: d, ...o }; if (o.cluster) oo.cluster = central(key, d); const R = run(key, 13, oo), x = read(R);
    for (let y0 = 0; y0 < 60; y0 += 10) { const L = R.stats.slice(y0, y0 + 10), at = (f) => mean(L.map((S) => f(S, x.tp)));
      rowsT.push({ place: `${key} x ${d}${name}, village ${x.tp}${R.hosts.includes(x.tp) ? ' (a host)' : ''}`, years: `${y0 + 1} to ${y0 + 10}`, 'maker households': f1(at((S, a) => S.makers[a])), 'no field': f1(at((S, a) => S.fieldFree[a])), 'green dealing days': f1(at((S, a) => S.dGreen[a])), 'households of other villages dealing on its green a year': f1(at((S, a) => S.outGreen[a])),
        'busy house days': f1(at((S, a) => S.dHouse[a])), 'rations\' worth dealt there': Math.round(at((S, a) => S.worth[a])), 'work not farming': Math.round(1000 * at(workShare)) }); } }
  show('C6e. What the label would read over time at the place that ends fullest (one run each, seed 13)', rowsT, 'place');
}
if (on('bad')) {
  const rows = [];
  for (const [key, d, o, name] of [[BASE, 4, {}, ''], [BASE, 4, { ratio: [1.0, 1.25] }, ', a full island (1.0 to 1.25)'], [BASE, 4, { ratio: [1.0, 1.25], fields: 'need' }, ', a full island, fields by need alone (as built)']]) {
    const acc = { good: [], bad: [], after: [] };
    for (let s = 1; s <= 6; s++) { const R = run(key, s * 13, { density: d, ...o }); R.stats.forEach((S, i) => { if (i < 20) return; const k = S.hf < 0.85 ? 'bad' : R.stats[i - 1].hf < 0.85 ? 'after' : 'good'; acc[k].push(S); }); }
    for (const k of ['good', 'bad', 'after']) { const L = acc[k]; rows.push({ case: `${key} x ${d}${name}`, year: k === 'bad' ? 'harvest under 0.85' : k === 'after' ? 'the year after one' : 'other years', years: L.length, 'maker households': f1(mean(L.map((S) => sum(S.makers)))),
      'rations by craft, a maker': Math.round(mean(L.map((S) => S.sold / (sum(S.makers) || 1)))), 'food over need: makers with fields': f2(mean(L.map((S) => S.foodField).filter(Number.isFinite))), 'with none': f2(mean(L.map((S) => S.foodPlot).filter(Number.isFinite))),
      'makers under 0.85 of need': pc(mean(L.map((S) => sum(S.hungry) / (sum(S.makers) || 1)))), 'of those with no field': pc(mean(L.map((S) => S.hungryPlot).filter(Number.isFinite))), 'wants filled': pc(mean(L.map((S) => S.filled / S.born))), 'green dealing days, island': f1(mean(L.map((S) => sum(S.dGreen)))), 'busy house days, island': f1(mean(L.map((S) => sum(S.dHouse)))) }); }
  }
  show('C7. A bad year (6 seeds, years 21 to 60): the harvest sets what the farms can spare in the same year', rows, 'case');
}
if (on('sweep')) {
  const rows = [], K = BASE, D = 2;
  for (const [name, o] of [['as C1', {}], ['material carried by cart, 3 loads a trip', { loadsPerTrip: 3 }], ['material carried at no cost', { matCost: 0, loadsPerTrip: 1e9 }],
    ['kin worth nothing', { kin: 0 }], ['kin worth 60 rations a year', { kin: 60 }], ['a move must better the year by 5% of need', { inertia: 0.05 }], ['by 40%', { inertia: 0.4 }],
    ['no field to be had anywhere', { landSlack: 0 }], ['fields free at 30% of those held', { landSlack: 0.3 }], ['a would-be maker per 300 farms a year', { entry: 0.0033 }], ['per 33 farms', { entry: 0.03 }],
    ['maker households end at 1% a year', { turnover: 0.01 }], ['at 6%', { turnover: 0.06 }], ['farms give a quarter of what they can spare', { budget: 0.25 }],
    ['farms make 1.0 to 1.25 of need', { ratio: [1.0, 1.25] }], ['1.0 to 1.1', { ratio: [1.0, 1.1] }], ['a head trusts a new place by half', { newPlace: 0.5 }],
    ['rites on each village\'s own days (0, 3, 6 or 9 days later)', { stagger: true }], ['6 ale evenings a village a year', { ale: 6 }], ['24 ale evenings', { ale: 24 }], ['fields by need alone (as built)', { fields: 'need' }],
    ['the walk costs 4 times as much', { walk: 4 }], ['wants come a quarter as often', { often: 0.25 }], ['wants come twice as often', { often: 2 }]])
    rows.push({ 'one thing changed': name, ...many(K, { density: D, ...o }, 3) });
  show(`C8. Sensitivity (${K} x ${D} households, 3 seeds)`, rows, 'one thing changed');
}
if (on('days')) {
  // which days of the year deal, at one place: the calendar the record would show
  for (const [key, d, o, name] of [[BASE, 4, {}, 'as C1'], [BASE, 4, { stagger: true }, 'rites on each village\'s own days'], [BASE, 4, { ale: 24 }, '24 ale evenings a village']]) {
    const R = run(key, 13, { density: d, byDay: true, ...o }), L = lastN(R), a = R.hosts[0], cal = Array.from({ length: G.yearDays }, (_, dd) => mean(L.map((S) => S.byDay[a][dd])));
    console.log(`\nC9. ${name}: households dealing at village ${a}, a host with ${f1(mean(L.map((S) => S.makers[a])))} maker households, by day of the year (years 51 to 60, mean on dealing days; . none, 1-9, # ten or more): spring | summer | autumn | winter`);
    console.log([0, 1, 2, 3].map((s) => cal.slice(s * 12, s * 12 + 12).map((n) => (n < 0.25 ? '.' : n >= 10 ? '#' : String(Math.max(1, Math.round(n))))).join('')).join(' | '));
  }
}
