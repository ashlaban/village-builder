// @sys sim/stores: food quantities, paid stakes, movements and three-year household and village ledgers
VB['sim/stores'] = (() => {
  const { YEAR, YEAR_DAYS } = VB['sim/rules'];
  const KINDS = ['harvest', 'gift', 'meat', 'milk', 'butter', 'seed', 'meal', 'cooking', 'spoilage', 'share', 'handingOn', 'provisions', 'thresh'];
  function amount(n) { if (!Number.isFinite(n) || n < 0) throw new Error(`stores: invalid amount ${n}`); }
  function type(holder) {
    if (!holder || holder.dissolved) throw new Error('stores: missing or dissolved holder');
    return 'farmstead' in holder ? 'household' : 'center' in holder ? 'village' : 'pawn';
  }
  function villageEntry(v, entry) { if (!v.ledger) v.ledger = []; v.ledger.push(entry); }
  function record(st, holder, good, n, why) {
    amount(Math.abs(n));
    const detail = typeof why === 'string' ? { kind: why } : why;
    if (!detail || !KINDS.includes(detail.kind)) throw new Error('stores: unknown reason');
    const kind = type(holder), hh = kind === 'pawn' ? st.households[holder.household] : holder;
    if (hh) {
      const entry = { ...detail, t: st.t, n, good, ...(kind === 'pawn' ? { pawn: holder.id, stake: true } : {}) };
      if (kind === 'village') villageEntry(holder, entry);
      else { if (!hh.ledger) hh.ledger = []; hh.ledger.push(entry); }
    }
  }
  function field(holder, good) {
    const kind = type(holder);
    if (kind === 'pawn' && good === 'grain') return 'stake';
    if (good === 'grain' || kind === 'household' && good === 'rations') return good;
    throw new Error(`stores: ${kind} cannot hold ${good}`);
  }
  // Explicit writes keep the ownership scan aware of every stored quantity.
  const setStake = (p, n) => { p.stake = n; };
  const setVillage = (v, n) => { v.grain = n; };
  function setFood(hh, good, n) { if (good === 'grain') hh.grain = n; else hh.rations = n; }
  function set(holder, good, n) {
    const kind = type(holder);
    if (kind === 'pawn') setStake(holder, n);
    else if (kind === 'village') setVillage(holder, n);
    else setFood(holder, good, n);
  }
  function put(st, holder, good, n, why) {
    amount(n); const k = field(holder, good);
    record(st, holder, good, n, why); set(holder, good, (holder[k] || 0) + n); return n;
  }
  function take(st, holder, good, n, why) {
    amount(n); const k = field(holder, good), got = Math.min(holder[k] || 0, n);
    record(st, holder, good, -got, why); set(holder, good, (holder[k] || 0) - got); return got;
  }
  function move(st, from, to, good, n, why) {
    amount(n); field(from, good); field(to, good);
    const got = take(st, from, good, n, why); put(st, to, good, got, why); return got;
  }
  function cook(st, hh, n) { const got = take(st, hh, 'grain', n, 'cooking'); put(st, hh, 'rations', got, 'cooking'); }
  function sheaf(st, hh, n) {
    amount(n); record(st, hh, 'sheaves', n, 'harvest'); hh.unthreshed.push(n);
  }
  function thresh(st, hh) {
    type(hh); const n = hh.unthreshed.shift() || 0;
    record(st, hh, 'sheaves', -n, 'thresh'); put(st, hh, 'grain', n, 'thresh');
  }
  // Only a newly constructed household, before its members move in. Constructor supplies are replaced, not consumed.
  function start(st, hh, grain, rations = 0) {
    amount(grain); amount(rations); type(hh);
    hh.grain = grain; hh.rations = rations;
    record(st, hh, 'grain', grain, 'provisions'); record(st, hh, 'rations', rations, 'provisions');
  }
  function spoil(st, hh, n) {
    const lost = take(st, hh, 'grain', n, 'spoilage'); hh.spoilt = (hh.spoilt || 0) + lost;
  }
  function villageDay(st) {
    VB.count.storeWalk += st.villages.length;
    for (const v of st.villages) if (v.grain > 0) {
      // Keep the original multiplication, including its floating-point rounding.
      const after = v.grain * Math.pow(1 - st.ECON.villageStoreLoss, 1 / YEAR_DAYS);
      record(st, v, 'grain', after - v.grain, 'spoilage'); v.grain = after;
    }
  }
  function prune(st) {
    VB.count.storeWalk += st.households.length + st.villages.length;
    for (const hh of [...st.households, ...st.villages]) {
      VB.count.storeWalk += hh.ledger.length;
      hh.ledger = hh.ledger.filter((e) => st.t - e.t < YEAR * 3);
    }
  }
  return { KINDS, record, put, take, move, cook, sheaf, thresh, start, spoil, villageDay, prune };
})();
