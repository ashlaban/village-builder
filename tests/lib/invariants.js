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
  for (const p of st.pawns) {
    if (p.alive) {
      if (!memberOf.has(p.id)) bad.push(`pawns[${p.id}]: alive but in no household`);
      else if (p.household !== memberOf.get(p.id)) bad.push(`pawns[${p.id}]: household field ${p.household}, member of ${memberOf.get(p.id)}`);
      if (p.died !== null) bad.push(`pawns[${p.id}]: alive with died ${p.died}`);
      if (!within(p.health, 0, 100)) bad.push(`pawns[${p.id}]: health is ${p.health}`);
    } else {
      if (memberOf.has(p.id)) bad.push(`pawns[${p.id}]: dead but in household ${memberOf.get(p.id)}`);
      if (p.died === null) bad.push(`pawns[${p.id}]: dead without a died time`);
    }
    if (!within(p.hunger, 0, 1)) bad.push(`pawns[${p.id}]: hunger is ${p.hunger}`);
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
    }
  }
  // nothing is built on a river tile (VB-111): houses, fields, fields in the making, plots and greens
  const onRiver = (t) => tileOk(t) && st.w.river[t] > 0;
  for (const f of st.farmsteads) {
    if (onRiver(f.house)) bad.push(`farmsteads[${f.id}]: house on river tile ${f.house}`);
    for (const fd of f.fields) if (onRiver(fd.tile)) bad.push(`farmsteads[${f.id}]: field ${fd.id} on river tile ${fd.tile}`);
    if (f.project && onRiver(f.project.tile)) bad.push(`farmsteads[${f.id}]: new field on river tile ${f.project.tile}`);
  }
  for (const v of st.villages) {
    if (v.green && onRiver(v.center)) bad.push(`villages[${v.id}]: green on river tile ${v.center}`);
    for (const pl of v.plots || []) for (const tr of pl.tiles) if (onRiver(tr.tile)) bad.push(`villages[${v.id}]: plot ${pl.id} on river tile ${tr.tile}`);
  }
  for (const j of st.jobs.values()) if (j.claim !== null) {
    const a = st.agents[j.claim];
    if (!a || a.job !== j) bad.push(`jobs[${j.key}]: claimed by agent ${j.claim}, whose job is ${a && a.job ? a.job.key : 'none'}`);
  }
  for (const a of st.agents) if (a.job && a.job.claim !== a.id) bad.push(`agents[${a.id}]: job ${a.job.key} is claimed by ${a.job.claim}`);
  return bad;
}
module.exports = { checkState };
