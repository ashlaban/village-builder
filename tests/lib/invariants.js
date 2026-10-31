// State invariants: checkState(st) returns a list of violations, each naming the record. A new state field or record gets its checks here.
function checkState(st) {
  const bad = [], N = st.w.N, tileOk = (i) => Number.isInteger(i) && i >= 0 && i < N;
  const within = (x, lo, hi) => Number.isFinite(x) && x >= lo && x <= hi;
  const memberOf = new Map();
  for (const h of st.households) {
    if (h.dissolved) { if (h.members.length) bad.push(`households[${h.id}]: dissolved but has members ${h.members}`); continue; }
    if (new Set(h.members).size !== h.members.length) bad.push(`households[${h.id}]: duplicate members ${h.members}`);
    for (const id of h.members) {
      const p = st.pawns[id];
      if (!p) { bad.push(`households[${h.id}]: member ${id} does not exist`); continue; }
      if (!p.alive) bad.push(`households[${h.id}]: member ${id} is dead`);
      if (memberOf.has(id)) bad.push(`pawns[${id}]: in households ${memberOf.get(id)} and ${h.id}`);
      memberOf.set(id, h.id);
    }
    if (h.holder !== null && !h.members.includes(h.holder)) bad.push(`households[${h.id}]: holder ${h.holder} is not a member`);
    if (h.holder !== null && st.pawns[h.holder] && !st.pawns[h.holder].alive) bad.push(`households[${h.id}]: holder ${h.holder} is dead`);
    for (const k of ['grain', 'wood', 'stone', 'rations', 'hungryDays']) if (!within(h[k], 0, 1e6)) bad.push(`households[${h.id}]: ${k} is ${h[k]}`);
    const f = st.farmsteads[h.farmstead];
    if (!f || f.household !== h.id) bad.push(`households[${h.id}]: farmstead ${h.farmstead} does not name it`);
  }
  for (const v of st.villages) if (!within(v.grain, 0, 1e6)) bad.push(`villages[${v.id}]: grain is ${v.grain}`);
  for (const p of st.pawns) {
    if (p.alive) {
      if (!memberOf.has(p.id)) bad.push(`pawns[${p.id}]: alive but in no household`);
      else if (p.household !== memberOf.get(p.id)) bad.push(`pawns[${p.id}]: household field ${p.household}, member of ${memberOf.get(p.id)}`);
      if (p.died !== null) bad.push(`pawns[${p.id}]: alive with died ${p.died}`);
      if (!within(p.buffer, 20, 60)) bad.push(`pawns[${p.id}]: buffer is ${p.buffer}`);
      if (!within(p.health, 0, 100)) bad.push(`pawns[${p.id}]: health is ${p.health}`);
    } else {
      if (memberOf.has(p.id)) bad.push(`pawns[${p.id}]: dead but in household ${memberOf.get(p.id)}`);
      if (p.died === null) bad.push(`pawns[${p.id}]: dead without a died time`);
    }
    if (!within(p.hunger, 0, 1)) bad.push(`pawns[${p.id}]: hunger is ${p.hunger}`);
    if (p.rel) checkRel(st, p, bad);
    if (p.kinPush !== null && !(typeof p.kinPush.to === 'string' && within(p.kinPush.w, 0, 1))) bad.push(`pawns[${p.id}]: kinPush is ${JSON.stringify(p.kinPush)}`);
  }
  const open = new Map();
  for (const u of st.unions) {
    if (u.end !== null && u.end < u.start) bad.push(`unions[${u.id}]: ends (${u.end}) before it starts (${u.start})`);
    if (u.end === null) for (const id of [u.a, u.b]) {
      if (open.has(id)) bad.push(`pawns[${id}]: open unions ${open.get(id)} and ${u.id}`);
      open.set(id, u.id);
    }
  }
  for (const f of st.farmsteads) {
    const want = f.household === null ? ['derelict', 'ruin'] : ['occupied'];
    if (!want.includes(f.state)) bad.push(`farmsteads[${f.id}]: state ${f.state} with household ${f.household}`);
    if (!tileOk(f.house)) bad.push(`farmsteads[${f.id}]: house tile ${f.house} out of range`);
    for (const fd of f.fields) if (!tileOk(fd.tile)) bad.push(`farmsteads[${f.id}]: field ${fd.id} tile ${fd.tile} out of range`);
    if (f.household !== null && st.owner) {
      if (st.owner[f.house] === 0) bad.push(`farmsteads[${f.id}]: house tile ${f.house} has no owner`);
      for (const fd of f.fields) if (st.owner[fd.tile] === 0) bad.push(`farmsteads[${f.id}]: field ${fd.id} tile ${fd.tile} has no owner`);
      for (const m of f.meadows || []) if (st.owner[m.tile] === 0 || !st.used.has(m.tile)) bad.push(`farmsteads[${f.id}]: meadow ${m.id} tile ${m.tile} unowned or unused`);
    }
  }
  // nothing is built on a river tile (VB-111): houses, fields, fields in the making, plots and greens
  const onRiver = (t) => tileOk(t) && st.w.river[t] > 0;
  for (const f of st.farmsteads) {
    if (onRiver(f.house)) bad.push(`farmsteads[${f.id}]: house on river tile ${f.house}`);
    for (const fd of f.fields) if (onRiver(fd.tile)) bad.push(`farmsteads[${f.id}]: field ${fd.id} on river tile ${fd.tile}`);
    if (f.project && onRiver(f.project.tile)) bad.push(`farmsteads[${f.id}]: new field on river tile ${f.project.tile}`);
    for (const m of f.meadows || []) if (onRiver(m.tile) || st.w.water[m.tile]) bad.push(`farmsteads[${f.id}]: meadow ${m.id} on river or water tile ${m.tile}`);
  }
  for (const v of st.villages) {
    if (v.green && onRiver(v.center)) bad.push(`villages[${v.id}]: green on river tile ${v.center}`);
    for (const pl of v.plots || []) for (const tr of pl.tiles) if (onRiver(tr.tile)) bad.push(`villages[${v.id}]: plot ${pl.id} on river tile ${tr.tile}`);
  }
  // worn paths (VB-094): counts finite and not negative, none on water; a stage from 0 to 3 that its count supports
  const { wear, worn } = st.w;
  if (wear) {
    let off = 0;
    for (let i = 0; i < N; i++) if (!(wear[i] >= 0) || worn[i] > 3 || (wear[i] > 0 && st.w.water[i]) || (worn[i] && !(wear[i] > 0))) off++;
    if (off) bad.push(`w.wear: ${off} tiles with a count or stage out of place`);
  }
  // jobs (VB-102): each worker of a job has it as its job, no worker twice, no more workers than the kind's hands
  for (const j of st.jobs.values()) {
    if (new Set(j.claims).size !== j.claims.length) bad.push(`jobs[${j.key}]: a worker listed twice in ${j.claims}`);
    if (j.claims.length > globalThis.VB['sim/kinds'].KINDS[j.kind].hands) bad.push(`jobs[${j.key}]: ${j.claims.length} workers, more than its hands`);
    for (const id of j.claims) {
      const a = st.agents[id];
      if (!a || a.job !== j) bad.push(`jobs[${j.key}]: worked by agent ${id}, whose job is ${a && a.job ? a.job.key : 'none'}`);
    }
  }
  for (const a of st.agents) if (a.job && !a.job.claims.includes(a.id)) bad.push(`agents[${a.id}]: job ${a.job.key} does not list it among its workers`);
  if (st.herds) checkHerds(st, bad);
  return bad;
}
// Herds (sim/herds, VB-131): each listed by its living household and no other, or emptied with no household; counts whole and not negative;
// cattle heads unique, of a known kind, born in the past; a household's hay and larder not negative.
function checkHerds(st, bad) {
  const { HERD } = VB['sim/rules'], seen = new Set(), whole = (n) => Number.isInteger(n) && n >= 0;
  for (const hd of st.herds) {
    const where = `herds[${hd.id}]`;
    if (hd.household === null) {
      if ((hd.head && hd.head.length) || hd.ewes || hd.rams || hd.lambs) bad.push(`${where}: animals but no household`);
      continue;
    }
    const hh = st.households[hd.household];
    if (!hh || hh.dissolved) bad.push(`${where}: household ${hd.household} missing or dissolved`);
    else if (hh.herds.filter((id) => id === hd.id).length !== 1) bad.push(`${where}: not listed once by household ${hd.household}`);
    if (!Number.isInteger(hd.home) || hd.home < 0 || hd.home >= st.w.N) bad.push(`${where}: home tile ${hd.home}`);
    if (hd.species === 'cattle') {
      for (const h of hd.head) {
        if (seen.has(h.id)) bad.push(`${where}: head ${h.id} twice`);
        seen.add(h.id);
        if (!(h.kind in HERD.hay) || h.kind === 'ewe' || h.kind === 'ram' || h.kind === 'lamb') bad.push(`${where}: head ${h.id} of kind ${h.kind}`);
        if (!(h.born <= st.t) || !['f', 'm'].includes(h.sex)) bad.push(`${where}: head ${h.id} born ${h.born}, sex ${h.sex}`);
      }
    } else if (hd.species === 'sheep') { for (const k of ['ewes', 'rams', 'lambs']) if (!whole(hd[k])) bad.push(`${where}: ${k} is ${hd[k]}`); }
    else bad.push(`${where}: species ${hd.species}`);
    // cull lists (sim/byre, VB-134) name animals that are there: a head of the herd, or no more sheep of a kind than the flock has
    const n = { ewe: hd.ewes, ram: hd.rams, lamb: hd.lambs };
    for (const e of hd.cull || []) {
      if (hd.species === 'cattle' ? !hd.head.some((h) => h.id === e.head) : !(n[e.sheep]-- > 0)) bad.push(`${where}: cull entry ${JSON.stringify(e)} names no animal`);
    }
    if (!whole(hd.lean || 0) || !whole(hd.unfed || 0)) bad.push(`${where}: lean ${hd.lean}, unfed ${hd.unfed}`);
  }
  for (const hh of st.households) {
    for (const id of hh.herds || []) if (!st.herds[id] || st.herds[id].household !== hh.id) bad.push(`households[${hh.id}]: lists herd ${id}, not its own`);
    if (!(hh.hay >= 0)) bad.push(`households[${hh.id}]: hay is ${hh.hay}`);
    for (const l of hh.larder || []) if (!(l.n > 0 && typeof l.kind === 'string' && Number.isFinite(l.until))) bad.push(`households[${hh.id}]: larder lot ${JSON.stringify(l)}`);
  }
}
// Relationship records (sim/relations): about a living other pawn, with known memories within their caps, and none for the dead.
function checkRel(st, p, bad) {
  const { SOCIAL } = VB['sim/rules'];
  if (!p.alive) { if (p.rel.size) bad.push(`pawns[${p.id}]: dead with ${p.rel.size} relationship records`); return; }
  for (const [j, r] of p.rel) {
    const where = `pawns[${p.id}].rel<${j}>`;
    if (j === p.id || !st.pawns[j]) bad.push(`${where}: no such other pawn`);
    if (![-1, 0, 1].includes(r.band)) bad.push(`${where}: band is ${r.band}`);
    const kinds = Object.keys(r.mem);
    if (!kinds.length) bad.push(`${where}: no memories`);
    for (const k of kinds) {
      const K = SOCIAL.memories[k], m = r.mem[k];
      if (!K) { bad.push(`${where}: unknown memory ${k}`); continue; }
      const lo = Math.min(0, K.cap), hi = Math.max(0, K.cap);
      if (!(Number.isFinite(m.v) && m.v >= lo - 1e-9 && m.v <= hi + 1e-9)) bad.push(`${where}: ${k} is ${m.v}, outside 0..${K.cap}`);
      if (!(m.t <= st.t)) bad.push(`${where}: ${k} remembered at ${m.t}, after now (${st.t})`);
    }
  }
}
module.exports = { checkState };
