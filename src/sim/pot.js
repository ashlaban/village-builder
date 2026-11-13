// @sys sim/pot: fresh food (fish, gathered food) held in batches by the day it came in and lost past its shelf life when the store is next
// touched; the pot, where the cook makes the coming day's meals from fresh food, dried fish and grain, and a pot of several foods goes further
// Design: design.md, Economy and jobs (Goods and the farming year: Mixed meals, Meals); VB-119 (Kim, 30 Oct, 10 and 11 Nov). Beside sim/stores,
// whose operations it moves food with (record, put, takeSpare, cookLarder), as sim/dig: the stores module is at the lint's size.
VB['sim/pot'] = (() => {
  const { DAY, FOODS, FISH, ECON, cal } = VB['sim/rules'];
  const Stores = VB['sim/stores'],
    { record, put, takeSpare, cookLarder, reserved, grainOf, mealsFrom } = Stores;
  // ---- fresh food (FOODS held 'fresh': fish, gathered food): batches {food, day (the game day it came in), qty (units)}, oldest first.
  // A batch older than its food's keeps is lost; nothing walks the households to spoil them: a batch's loss is read from its day when the
  // household's fresh store is next touched (settle: the catch, the pot, the meal; Rules for cost, 3), and freshHeld reads a stale batch as
  // gone before then. At most FRESH_CAP batches a food (a day's trips merge into one batch), so older ones are lost first. ----
  // @state household.fresh: the household's fresh food, a list of batches by day (each a food, its day and its amount in units); written only here.
  const FRESH_CAP = 4;
  const today = (st) => Math.floor(st.t / DAY);
  const stale = (st, b) => today(st) - b.day > FOODS[b.food].keeps;
  function setFresh(hh, list) {
    hh.fresh = list;
  }
  const openFresh = (hh) => {
    setFresh(hh, []);
  }; // an older save's household (sim/saves)
  function check(st, hh, n) {
    if (!Number.isFinite(n) || n < 0) throw new Error(`pot: invalid amount ${n}`);
    if (!hh || hh.dissolved || !('farmstead' in hh)) throw new Error("pot: fresh food is a living household's");
  }
  // Drops the batches past their shelf life, each noted as spoilage of its food.
  function settle(st, hh) {
    if (!hh.fresh.length) return;
    let lost = false;
    for (const b of hh.fresh)
      if (stale(st, b)) {
        record(st, hh, b.food, -b.qty, 'spoilage');
        lost = true;
      }
    if (lost)
      setFresh(
        hh,
        hh.fresh.filter((b) => !stale(st, b)),
      );
  }
  function putFresh(st, hh, food, n, why) {
    check(st, hh, n);
    if (!FOODS[food] || FOODS[food].held !== 'fresh') throw new Error(`pot: ${food} is not fresh food`);
    settle(st, hh);
    if (n <= 0) return 0;
    record(st, hh, food, n, why);
    const d = today(st),
      same = hh.fresh.find((b) => b.food === food && b.day === d);
    if (same) {
      same.qty += n;
      return n;
    }
    hh.fresh.push({ food, day: d, qty: n });
    const mine = hh.fresh.filter((b) => b.food === food);
    if (mine.length > FRESH_CAP) {
      // the oldest batch of the food is lost
      const old = mine[0];
      record(st, hh, food, -old.qty, 'spoilage');
      setFresh(
        hh,
        hh.fresh.filter((b) => b !== old),
      );
    }
    return n;
  }
  // Fresh food held, of one food or (food null) all, of the foods eaten uncooked only when raw; batches past their day do not count. Reads only.
  function freshHeld(st, hh, food = null, raw = false) {
    let s = 0;
    for (const b of hh.fresh)
      if ((food === null || b.food === food) && (!raw || FOODS[b.food].raw) && !stale(st, b)) s += b.qty;
    return s;
  }
  // Takes up to n units of fresh food, the oldest batches first (of one food, of any when food is null, of raw foods only when raw);
  // returns {food: n} taken, adding to `into` when given.
  function takeFresh(st, hh, n, why, food = null, raw = false, into = {}) {
    check(st, hh, n);
    settle(st, hh);
    let left = n;
    for (const b of hh.fresh) {
      if (left <= 1e-12) break;
      if ((food !== null && b.food !== food) || (raw && !FOODS[b.food].raw)) continue;
      const k = Math.min(b.qty, left);
      b.qty -= k;
      left -= k;
      record(st, hh, b.food, -k, why);
      into[b.food] = (into[b.food] || 0) + k;
    }
    if (hh.fresh.some((b) => b.qty <= 1e-9))
      setFresh(
        hh,
        hh.fresh.filter((b) => b.qty > 1e-9),
      );
    return into;
  }
  // ---- the pot (design.md, Meals): the cook makes up to `want` meals from the household's fresh food, what spoils first going in first,
  // then dried fish (VB-300), then grain above the seed reserve. A food is a source when it gives ECON.potShare of the pot's rations (grain
  // and flour one source; fresh and dried fish one, FOODS' source); a pot of k sources makes 1 / ECON.pot[k] times its rations in meals.
  // The cook fills the smallest pot that makes the meals wanted (a pot of 3 sources first, then 2, then 1), or, short of food, puts in all
  // there is. Dried fish is kept for the months without fresh fish (winter and spring before FISH.from, the fishing season's start): only
  // then does it go in, and only as much as makes fish a source of the pot, so that the store lasts the winter. ----
  const POT = { units: {}, sources: new Map() }; // scratch, reused: the pot allocates little on the cook's hour
  function sourcesOf(units) {
    const S = POT.sources;
    S.clear();
    let total = 0;
    for (const food in units) {
      const r = mealsFrom(food, units[food]);
      total += r;
      S.set(FOODS[food].source, (S.get(FOODS[food].source) || 0) + r);
    }
    let k = 0;
    for (const r of S.values()) if (r > 0 && r >= ECON.potShare * total - 1e-9) k++;
    return k;
  }
  const potFactor = (k) => ECON.pot[Math.min(k, ECON.pot.length - 1)];
  const iced = (st) => {
    const c = cal(st.t);
    return c.season === 3 || (c.season === 0 && c.sday < FISH.from);
  };
  function driedHeld(hh) {
    let s = 0;
    for (const l of hh.larder) if (l.kind === 'dried fish') s += l.n;
    return s;
  }
  // Fills `units` with a pot of `target` rations: fresh food oldest first, then dried fish (`lean`: only up to a fifth of the pot with the
  // fresh fish in it), then grain (spare at most). Returns the rations it could not fill. Reads only.
  function fill(st, hh, target, spare, dried, lean, units) {
    for (const k in units) delete units[k];
    let left = target;
    for (const b of hh.fresh) {
      if (left <= 1e-12) break;
      if (stale(st, b)) continue;
      const r = Math.min(mealsFrom(b.food, b.qty), left);
      units[b.food] = (units[b.food] || 0) + r / FOODS[b.food].worth;
      left -= r;
    }
    const d = Math.min(
      dried,
      left,
      lean ? Math.max(0, ECON.potShare * target - mealsFrom('fish', units.fish || 0)) : Infinity,
    );
    if (d > 0) {
      units['dried fish'] = d / FOODS['dried fish'].worth;
      left -= d;
    }
    const g = Math.min(spare, left / FOODS.grain.worth);
    if (g > 0) {
      units.grain = g;
      left -= mealsFrom('grain', g);
    }
    return left;
  }
  // Cooks the pot; returns its number of sources (0: nothing cooked).
  function pot(st, hh, want) {
    check(st, hh, want);
    settle(st, hh);
    const spare = Math.max(0, grainOf(hh) - reserved(st, hh, 'grain')),
      dried = hh.larder.length && iced(st) ? driedHeld(hh) : 0,
      units = POT.units;
    let k = 0;
    if (want > 0) {
      let done = false;
      for (let s = ECON.pot.length - 1; s >= 1 && !done; s--) {
        // the factor a pot of s sources needs; the last, a full pot of any
        const left = fill(st, hh, want * potFactor(s), spare, dried, s > 1, units);
        k = sourcesOf(units);
        done = left <= 1e-9 && (s === 1 || Math.min(k, ECON.pot.length - 1) === s);
      }
      if (!done) {
        fill(st, hh, Infinity, spare, dried, false, units);
        k = sourcesOf(units);
      } // short of food: all there is
    } else for (const f in units) delete units[f];
    let meals = 0,
      plain = 0;
    for (const food in units) {
      const n = units[food];
      if (!(n > 0)) continue;
      let got;
      if (food === 'grain') got = takeSpare(st, hh, n, 'cooking');
      else if (food === 'dried fish') {
        got = cookLarder(st, hh, food, n);
        plain += mealsFrom(food, got);
      } // its meals put, 1 to 1
      else got = takeFresh(st, hh, n, 'cooking', food)[food] || 0;
      meals += mealsFrom(food, got);
    }
    if (meals > plain) put(st, hh, 'meals', meals / potFactor(k) - plain, 'cooking');
    return meals > 0 ? k : 0;
  }
  // Something to cook: grain above the seed reserve, or fresh food (sim/kinds' cook is posted for it).
  const cookable = (st, hh) =>
    grainOf(hh) - reserved(st, hh, 'grain') > 0 || (hh.fresh.length > 0 && freshHeld(st, hh) > 0);
  // The household's spare food, in rations: grain above the seed reserve, cooked meals and fresh food (fishing's and gathering's urgency).
  const spareFood = (st, hh) =>
    Math.max(0, grainOf(hh) - reserved(st, hh, 'grain')) + hh.meals + (hh.fresh.length ? freshHeld(st, hh) : 0);
  return { FRESH_CAP, openFresh, settle, putFresh, freshHeld, takeFresh, pot, cookable, spareFood };
})();
