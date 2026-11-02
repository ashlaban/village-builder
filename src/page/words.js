// @sys page/words: words: how pawns, households, farms and villages are described in the panels
  // ---- words ----
  const isWidow = (p) => p.sex === 'f' && Sim.spouseOf(st, p.id) === null && st.unions.some((u) => (u.a === p.id || u.b === p.id) && u.end !== null);
  const roleLine = (p) => {
    if (p.role === 'farmer' && p.sex === 'f') return isWidow(p) ? 'Widow holding the farm (änka)' : 'Holds the farm (bonde)';
    const r = Sim.ROLES[p.role]; return `${r.title} (${r.sv})`;
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const farmOf = (p) => (p.household !== null && st.households[p.household] ? st.farmsteads[st.households[p.household].farmstead] : null);
  const heirTo = (id) => st.households.filter((h) => !h.dissolved && Sim.heirRanking(st, h)[0] === id).map((h) => st.farmsteads[h.farmstead]);
  function jobsLine(list) {
    if (!list.length) return 'none open';
    const n = {};
    for (const j of list) { const k = Sim.KINDS[j.kind].name; n[k] = n[k] || { open: 0, taken: 0 }; n[k][j.claims.length ? 'taken' : 'open']++; }
    return Object.entries(n).map(([k, v]) =>
      `${k}${v.open + v.taken > 1 ? ` ×${v.open + v.taken}` : ''}${v.taken ? (v.open ? `, ${v.taken} under way` : ', under way') : ''}`).join('; ');
  }
  function fieldSummary(f) {
    const n = {}, word = {
      stubble: 'stubble', plowed: 'hoed', sown: 'sown', young: 'sprouting', growing: 'growing', ripe: 'ripe', stooks: 'in stooks', fallow: 'gone to grass',
      scrub: 'gone to scrub' };
    for (const fd of f.fields) { const s = fd.stage === 'stooks' ? 'stooks' : cropStage(fd); n[s] = (n[s] || 0) + 1; }
    return Object.entries(n).map(([k, v]) => `${v} ${word[k]}`).join(', ');
  }
  const emptyYears = (f) => Math.max(0, Math.floor((st.t - f.emptySince) / Sim.YEAR));
  let settlersHTML = '';
  function renderSettlers() {
    let h = '';
    const jobs = [...st.jobs.values()];
    const nm = (id) => `<button type="button" data-pawn="${id}">${esc(Sim.fullName(st.pawns[id]))}</button>`;
    for (const v of st.villages) {
      const vj = jobs.filter((j) => j.owner.type === 'village' && j.owner.id === v.id);
      const worst = Math.min(...v.fence.map((s) => s.cond));
      const out = st.demand.filter((id) => st.pawns[id].alive && Sim.settlementIdOf(st, st.pawns[id]) === v.id);
      const empties = st.farmsteads.filter((f) => f.village === v.id && f.household === null);
      const fenceText = v.fence.length ? `Fence in ${worst < 0.45 ? 'poor' : worst < 0.65 ? 'fair' : 'good'} repair.` : 'No fence yet.';
      h += `<div class="farm"><h2>${esc(v.name)} <span>village commons</span></h2><p>${fenceText} ${v.well ? 'Shared well and woods.' :
        'Shared woods.'}</p><p class="jobs">Jobs: ${esc(jobsLine(vj))}</p>`;
      // moving to new land (VB-148): where the village came from, the villages it gave rise to, and whether it is crowded
      if (v.founded) h += `<p>Founded in year ${Math.floor(v.founded.t / Sim.YEAR) +
        1} from ${esc(st.villages[v.founded.from].name)} by ${nm(v.founded.by)}.</p>`;
      const daughters = st.villages.filter((u) => u.founded && u.founded.from === v.id);
      if (daughters.length) h += `<p>Daughter villages: ${daughters.map((u) => esc(u.name)).join(', ')}.</p>`;
      if (v.crowded > 0) h += `<p>Crowded: ${v.crowded === 1 ? '1 adult waits' : `${v.crowded} adults wait`} for land, and there is no room to clear.</p>`;
      h += `<p>Wants to move out: ${out.length ? out.map(nm).join(', ') : 'nobody'}</p>`;
      for (const plot of v.plots.filter((q) => !q.done)) {
        h += `<p>Clearing a plot for ${nm(plot.intended)}: ${Math.round(Sim.plotProgress(st, plot) * 100)}% done</p>`;
      }
      for (const plot of v.plots.filter((q) => q.done)) {
        h += `<p>Plot cleared${plot.holder !== null ? `, for ${nm(plot.holder)}` : ''}; ${plot.cottage &&
          !plot.built ? `the cottage: ${['foundation', 'walls', 'roof'][plot.cottage.i]} is next` : 'the cottage is built'}.</p>`;
      }
      for (const f of empties) h += `<p>${esc(f.name)} stands empty, ${emptyYears(f)} years; buildings at ${Math.round(
        f.condition * 100)}%${f.state === 'ruin' ? ', a ruin' : ''}.</p>`;
      h += '</div>';
    }
    for (const hh of st.households) {
      if (hh.dissolved) continue;
      const f = st.farmsteads[hh.farmstead], v = st.villages[f.village];
      const hj = jobs.filter((j) => j.owner.type === 'household' && j.owner.id === hh.id), heirs = Sim.heirRanking(st, hh).slice(0, 2);
      h += `<div class="farm"><h2>${esc(f.name)} <span>in ${esc(v.name)}</span></h2>`;
      if (f.booth) h += `<p>Living in a booth; the cottage: ${['foundation', 'walls', 'roof'][f.booth.i]} is next.</p>`;
      h += `<p>Held by ${nm(hh.holder)}${heirs.length ? `; heir ${heirs.map(nm).join(', then ')}` : '; no heir'}</p>${hh.guardian !== undefined &&
        hh.guardian !== null ? `<p>Guardian: ${nm(hh.guardian)}</p>` : ''}`;
      h += `<p>Grain ${Math.round(hh.grain)} rations${Sim.seedReserve(st,
        hh) ? ` (${Sim.seedReserve(st,
        hh)} set aside as seed)` : ''}${hh.unthreshed.length ? `, ${Math.round(hh.unthreshed.reduce((s, n) => s + n,
        0))} unthreshed in sheaves` : ''}, firewood ${Math.round(hh.wood)} loads, stone ${hh.stone} loads${hh.hungryDays ? `, ${hh.hungryDays} hungry days` :
        ''}, ${hh.hunger <= 0 ? 'fed' : hh.hunger < 0.25 ? 'short' : hh.hunger < 0.6 ? 'hungry' : 'starving'}, lowest health ${Math.round(Math.min(100,
        ...hh.members.map((m) => st.pawns[m].health)))}</p>`;
      const herdText = Sim.describeHerds(st, hh);
      const lots = [['salt meat', 'salt meat'], ['meat', 'fresh meat'], ['butter', 'butter'], ['milk', 'milk']]
        .map(([k, word]) => [Sim.larderOf(hh, k), word]).filter(([n]) => n >= 0.5);
      const larder = lots.length ? `; larder ${lots.map(([n, word]) => `${Math.round(n)} ${word}`).join(', ')}` : '';
      if (herdText || hh.hay > 0 ||
        larder) h += `<p>${esc(herdText ||
        'No animals')}. Hay ${Math.round(hh.hay)}${herdText ? `, a winter needs ${Math.round(Sim.winterNeed(st, hh))}` : ''}${larder}</p>`;
      h += `<p>Fields: ${fieldSummary(f) ||
        'none'}${f.project ? (f.project.stage === 'meadow' ? '; clearing a new hay meadow' :
        `; new field in progress: ${f.project.stage === 'clear' ? 'clearing the ground' : 'breaking the ground'}`) : ''}${f.meadows.length ?
        `; ${f.meadows.length === 1 ? 'a hay meadow' : `${f.meadows.length} hay meadows`}` : ''}</p><p class="jobs">Jobs: ${esc(jobsLine(hj))}</p><ul>`;
      for (const id of hh.members) {
        const p = st.pawns[id];
        h += `<li>${nm(id)} ${p.age}, ${esc(Sim.ROLES[p.role] ? (p.role === 'farmer' &&
          p.sex === 'f' ? (isWidow(p) ? 'widow' : 'holder') : Sim.ROLES[p.role].title.toLowerCase()) : p.role)}<br><span class="doing">${esc(Sim.describe(st,
          id))}</span></li>`;
      }
      h += '</ul></div>';
    }
    h += '<div class="log"><h2>Recent</h2>' + st.events.slice(0, 6).map((e) => {
      const c = Sim.cal(e.t); return `<p>Year ${c.year}, ${Sim.SEASONS[c.season]}: ${esc(e.text)}</p>`; }).join('') + '</div>';
    if (h !== settlersHTML) { settlersHTML = h; $('settlers').innerHTML = h; }
  }
  function focusPawn(id) {
    const p = st.pawns[id]; if (p.died !== null) { treeSel = id; openTree(); return; }
    const a = st.agents[id], f = farmOf(p);
    const x = a.inside ? w.hx[f.house] : a.x, y = a.inside ? w.hy[f.house] : a.y, z1 = Math.max(cam.z, 1.5);
    intro = { t: 0, d: 1.1, x0: cam.x, y0: cam.y, z0: cam.z, x1: x, y1: y, z1, T: levelFor(z1, 1),
      rect: viewRect(LV[levelFor(z1, 1)].size * 0.25, { x, y, z: z1 }) };
    selectPawn(id);
  }
  $('settlers').addEventListener('click', (e) => { const b = e.target.closest('button[data-pawn]'); if (b) focusPawn(+b.dataset.pawn); });
  function selectPawn(id) { selPawn = id; sel = -1; hoverDirty = true; showPawn(id); }
  function showPawn(id) {
    const p = st.pawns[id], f = farmOf(p);
    if (p.died !== null || !f) { card(Sim.fullName(p), ['Died']); return; }
    const sp = Sim.spouseOf(st, id), kids = Sim.childrenOf(st, id).filter((c) => st.pawns[c].died === null);
    const holds = Sim.holdingOf(st, id), heirs = heirTo(id);
    const status = holds ? `Holds ${f.name}` : heirs.length ? `Heir to ${heirs.map((x) =>
      x.name).join(' and ')}` : p.retired ? `Retired at ${f.name}` : p.age >= 18 &&
      st.demand.includes(id) ? `Landless at ${f.name}, wants to move out` : `Lives at ${f.name}`;
    const rel = (sp !== null ? `${p.sex === 'f' ? 'Wife' : 'Husband'} of ${Sim.fullName(st.pawns[sp])}` : isWidow(p) ? 'Widowed' : 'Unmarried')
      + (p.pregnantUntil !== null ? ', expecting a child' : p.nursingUntil !== null && st.t < p.nursingUntil ? ', nursing a baby' : '');
    card(Sim.fullName(p),
      [`${roleLine(p)}, ${p.age}, health ${Math.round(p.health)}`,
      `${status}. ${rel}${kids.length ? `, ${kids.length} ${kids.length === 1 ? 'child' : 'children'}` : ''}`,
      p.stake ? `Share in hand: ${p.stake} rations${p.owed ? `, ${p.owed} still owed` : ''}` :
      (p.advocate ? `Argues for: ${Culture.DIMS[p.advocate.dim].opts[p.advocate.opt][1].toLowerCase()}` : ''), Sim.describe(st, id),
      Sim.idleLine(st, id)].filter(Boolean));
    showRelations(id);
  }
  // The people a pawn knows best, by tie, and any it dislikes besides: kin, the opinion in words and as a number, and its largest memory.
  let relHTML = '';
  const signed = (v) => `${v < 0 ? '−' : '+'}${Math.abs(Math.round(v * 100))}`;
  function showRelations(id) {
    const all = Sim.relationsOf(st, id), list = all.slice(0, 5), cold = (o) => ['dislikes', 'enemy'].includes(Sim.opinionWord(o));
    for (const x of all.slice(5)) if (cold(x.opinion) && list.length < 7) list.push(x);
    const rows = list.map((x) => {
      const word = Sim.opinionWord(x.opinion), kin = Sim.standingWord(st, id, x.id), why = Sim.reasonsOf(st, id, x.id).find((r) => r.label !== kin);
      const detail = [kin, word === 'neutral' ? null : word, !kin && why ? why.label.toLowerCase() : null].filter(Boolean).join(' · ');
      const tone = x.opinion >= 0.25 ? 'pos' : cold(x.opinion) ? 'neg' : '';
      return `<button type="button" data-pawn="${x.id}">${esc(Sim.fullName(st.pawns[x.id]))}<i>${esc(detail)}</i><b class="${tone}">${signed(
        x.opinion)}</b></button>`;
    }).join('');
    const h = rows ? `<h3>Knows best</h3>${rows}` : '';
    if (h !== relHTML) { relHTML = h; $('tileRel').innerHTML = h; }
    $('tileRel').hidden = !h;
  }
  $('tileRel').addEventListener('click', (e) => { const b = e.target.closest('button[data-pawn]'); if (b) focusPawn(+b.dataset.pawn); });
  function card(title, lines) {
    $('tileName').textContent = title;
    ['tileElev', 'tileCoord', 'tileExtra', 'tileMore'].forEach((id, k) => { const el = $(id); el.textContent = lines[k] || ''; el.hidden = !lines[k]; });
    $('tileRel').hidden = true; $('tile').hidden = false;
  }
  function pawnAt(x, y) {
    if (!st || cam.z <= 0.28) return -1;
    let best = -1, bd = 1e9;
    for (const a of st.agents) {
      if (a.inside || st.pawns[a.id].died !== null) continue;
      const dx = x - a.x, dy = y - (a.y - 9);
      if (Math.abs(dx) < 6 && Math.abs(dy) < 10) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = a.id; } }
    }
    return best;
  }
  function settlementTileInfo(i) {
    if (!st) return null;
    for (const f of st.farmsteads) {
      const v = st.villages[f.village].name, where = `${f.name}, ${v}`;
      if (f.house === i) {
        if (f.household === null) return [`${f.name}${v ? `, ${v}` : ''}`,
          [`Empty for ${emptyYears(f)} years: ${f.state === 'ruin' ? 'a ruin' : 'buildings at ' + Math.round(f.condition * 100) + '%'}`,
          'No heir took it; claims come in the next batch']];
        const hh = st.households[f.household], heirs = Sim.heirRanking(st, hh).slice(0, 3).map((q) => Sim.fullName(st.pawns[q]));
        return [`${f.name}${v ? `, ${v}` : ''}`,
          [`Held by ${Sim.fullName(st.pawns[hh.holder])}; ${hh.members.length} live here`,
          heirs.length ? `Heirs: ${heirs.join(', then ')}` : 'No heir in line']];
      }
      const fd = f.fields.find((q) => q.tile === i);
      if (fd) {
        const word = {
          stubble: 'Stubble, waiting for spring', plowed: 'Hoed, ready for sowing', sown: 'Freshly sown', young: 'Sprouting', growing: 'Growing',
          ripe: 'Ripe for reaping', stooks: 'Sheaves drying in stooks', fallow: 'Untended, gone to grass',
          scrub: 'Untended, gone to scrub' }[fd.stage === 'stooks' ? 'stooks' : cropStage(fd)];
        const wet = Sim.byRiver(w, i) ? ', watered by the river' : '';
        const worn = fd.soil < 0.99 ? `, worn to ${Math.round(fd.soil * 100)}% by its crops` : fd.soil > 1.01 ? `, dunged to ${Math.round(fd.soil * 100)}%` :
          '';
        return [`Field of ${where}`,
          [word, `Soil quality ${Math.round(fd.fert * 100)}%${wet}${worn}, ${f.household === null ? 'no one works it' : 'owned by the household'}`]];
      }
    }
    for (const f of st.farmsteads) {
      const m = f.meadows.find((q) => q.tile === i);
      if (!m) continue;
      const word = { grass: m.raked ? 'Grass growing, raked clean in spring' : 'Grass growing', mown: 'Mown; the hay is drying',
        aftermath: 'Aftermath: the hay is in' }[m.stage];
      return [`Hay meadow of ${f.name}, ${st.villages[f.village].name}`,
        [word, `About ${Math.round(30 * m.fert)} hay in an ordinary year${Sim.byRiver(w, i) ? ', wet ground by the river' : ''}`]];
    }
    for (const v of st.villages) if (v.center === i && v.green) return [`Village green of ${v.name}`, ['The well sweep and the green are village commons']];
    return null;
  }

