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
  const hungerWord = (hh) => (hh.hunger <= 0 ? 'Fed' : hh.hunger < .25 ? 'Short of food' : hh.hunger < .6 ? 'Hungry' : 'Starving');
  const hungerMark = (hh) => `<i class="mark ${hh.hunger <= 0 ? 'fed' : hh.hunger < .25 ? 'short' : 'hungry'}"></i>`;
  const emptyYears = (f) => Math.max(0, Math.floor((st.t - f.emptySince) / Sim.YEAR));
  let settlersHTML = '', peopleQuery = '';
  const peopleFolds = new Set();
  const foldOpen = (key) => peopleFolds.has(key);
  function fold(key, title, body, cls = 'fold-section') {
    return `<details class="${cls}" data-fold="${key}"${foldOpen(key) ? ' open' : ''}><summary>${title}</summary>${body}</details>`;
  }
  function updatePanelHTML(box, html) {
    const scroll = box.closest('.sheet-content'), top = scroll ? scroll.scrollTop : 0;
    const focused = box.contains(document.activeElement) ? document.activeElement : null;
    const focusKey = focused && (focused.closest('[data-pawn]') ? `[data-pawn="${focused.closest('[data-pawn]').dataset.pawn}"]`
      : focused.closest('[data-fold]') ? `[data-fold="${focused.closest('[data-fold]').dataset.fold}"] > summary` : null);
    box.innerHTML = html;
    if (focusKey) { const next = box.querySelector(focusKey); if (next) next.focus({ preventScroll: true }); }
    if (scroll) scroll.scrollTop = top;
  }
  function renderSettlers() {
    if (!st || document.body.classList.contains('ui-hidden') || $('peopleSheet').classList.contains('collapsed')) return;
    const query = peopleQuery.trim().toLocaleLowerCase(), groups = new Map();
    let matches = 0, total = 0, jobsIndex = null;
    const nm = (id) => `<button type="button" data-pawn="${id}">${esc(Sim.fullName(st.pawns[id]))}</button>`;
    const jobsFor = (type, id) => {
      if (!jobsIndex) {
        jobsIndex = new Map();
        for (const job of st.jobs.values()) {
          const key = `${job.owner.type}:${job.owner.id}`;
          if (!jobsIndex.has(key)) jobsIndex.set(key, []);
          jobsIndex.get(key).push(job);
        }
      }
      return jobsLine(jobsIndex.get(`${type}:${id}`) || []);
    };
    for (const hh of st.households) {
      if (hh.dissolved) continue;
      total += hh.members.length;
      const f = st.farmsteads[hh.farmstead], v = st.villages[f.village];
      const whole = !query || `${f.name} ${v.name}`.toLocaleLowerCase().includes(query);
      const members = whole ? hh.members : hh.members.filter((id) => Sim.fullName(st.pawns[id]).toLocaleLowerCase().includes(query));
      if (!members.length) continue;
      matches += members.length;
      if (!groups.has(v.id)) groups.set(v.id, []);
      groups.get(v.id).push({ hh, f, members });
    }
    const household = ({ hh, f, members }) => {
      const key = `household-${hh.id}`, expanded = !!query || foldOpen(key);
      let body = '';
      if (expanded) {
        const heirs = Sim.heirRanking(st, hh).slice(0, 2);
        body += `<div class="farm"><p><button type="button" data-farm="${f.id}">Show ${esc(f.name)} on the map</button></p>
          <p>Held by ${nm(hh.holder)}${heirs.length ? `; heir ${heirs.map(nm).join(', then ')}` : '; no heir'}</p>`;
        if (hh.guardian != null) body += `<p>Guardian: ${nm(hh.guardian)}</p>`;
        if (f.booth) body += `<p>Living in a booth; the cottage: ${['foundation', 'walls', 'roof'][f.booth.i]} is next.</p>`;
        body += `<ul>${members.map((id) => {
          const pawn = st.pawns[id];
          return `<li>${faceImg(id, 'mini')}<div>${nm(id)} <span>${pawn.age}, ${esc(roleLine(pawn))}</span><br><span class="doing">${
            esc(Sim.describe(st, id))}</span></div></li>`;
        }).join('')}</ul>`;
        const suppliesKey = `supplies-${hh.id}`, fieldsKey = `fields-${hh.id}`, animalsKey = `animals-${hh.id}`;
        body += fold(suppliesKey, 'Supplies & health', foldOpen(suppliesKey) ?
          `<p>Grain ${Math.round(hh.grain)} rations; ${Sim.seedReserve(st, hh)} set aside as seed.</p>
          <p>Meals ${Math.round(hh.meals)} rations, cooked.</p>
          <p>${Math.round(hh.unthreshed.reduce((sum, n) => sum + n, 0))} unthreshed in sheaves.</p>
          <p>Firewood ${Math.round(hh.wood)} loads; stone ${hh.stone} loads.</p>
          <p>Dug: clay ${hh.clay || 0} loads; bog iron ore ${hh.bogOre || 0} loads.</p>
          <p>${hh.hungryDays} hungry days; lowest health ${Math.round(Math.min(100, ...hh.members.map((id) => st.pawns[id].health)))}.</p>` : '');
        body += fold(fieldsKey, 'Fields & work', foldOpen(fieldsKey) ?
          `<p>Fields: ${fieldSummary(f) || 'none'}; ${f.meadows.length} hay meadows.</p>
          ${f.project ? `<p>New ${f.project.stage === 'meadow' ? 'hay meadow' : 'field'} in progress: ${esc(f.project.stage)}.</p>` : ''}
          <p class="jobs">Jobs: ${esc(jobsFor('household', hh.id))}</p>` : '');
        let animals = '';
        if (foldOpen(animalsKey)) {
          const lots = [['salt meat', 'salt meat'], ['meat', 'fresh meat'], ['butter', 'butter'], ['milk', 'milk']]
            .map(([kind, label]) => [Sim.larderOf(hh, kind), label]).filter(([n]) => n >= .5);
          animals = `<p>${esc(Sim.describeHerds(st, hh) || 'No animals')}.</p>
            <p>Hay ${Math.round(hh.hay)}, ${Math.round(hh.haySpoilt || 0)} spoilt; a winter needs ${Math.round(Sim.winterNeed(st, hh))}.</p>
            <p>Larder: ${lots.length ? lots.map(([n, label]) => `${Math.round(n)} ${label}`).join(', ') : 'empty'}.</p>`;
        }
        body += fold(animalsKey, 'Animals & larder', animals) + '</div>';
      }
      return `<details class="household-block" data-fold="${key}"${expanded ? ' open' : ''}>
        <summary>${iconImg(farmIcon(f), 'mini')}${esc(f.name)}<span class="summary-meta">${hungerMark(hh)}${hh.members.length} people · ${
          hungerWord(hh)}</span></summary>${body}</details>`;
    };
    let h = '';
    for (const v of st.villages) {
      const households = groups.get(v.id) || [];
      if (!households.length && query) continue;
      const key = `village-${v.id}`, expanded = !!query || foldOpen(key);
      let body = '';
      if (expanded) {
        body = `<p><button type="button" data-village="${v.id}">Show ${esc(v.name)} on the map</button></p>`
          + households.map(household).join('');
        const commonsKey = `commons-${v.id}`;
        let commons = '';
        if (foldOpen(commonsKey)) {
          const worst = Math.min(...v.fence.map((fence) => fence.cond));
          const out = st.demand.filter((id) => st.pawns[id].alive && Sim.settlementIdOf(st, st.pawns[id]) === v.id);
          const empties = st.farmsteads.filter((f) => f.village === v.id && f.household === null);
          commons = `<div class="farm"><h2>${esc(v.name)} <span>village commons</span></h2>
            <p>${v.fence.length ? `Fence in ${worst < .45 ? 'poor' : worst < .65 ? 'fair' : 'good'} repair.` : 'No fence yet.'}
            ${v.well ? 'Shared well and woods.' : 'Shared woods.'}</p><p class="jobs">Jobs: ${esc(jobsFor('village', v.id))}</p>`;
          if (v.founded) commons += `<p>Founded in year ${Math.floor(v.founded.t / Sim.YEAR) + 1} from
            ${esc(st.villages[v.founded.from].name)} by ${nm(v.founded.by)}.</p>`;
          const daughters = st.villages.filter((u) => u.founded && u.founded.from === v.id);
          if (daughters.length) commons += `<p>Daughter villages: ${daughters.map((u) => esc(u.name)).join(', ')}.</p>`;
          if (v.crowded > 0) commons += `<p>Crowded: ${v.crowded} adults wait for land, and there is no room to clear.</p>`;
          commons += `<p>Wants to move out: ${out.length ? out.map(nm).join(', ') : 'nobody'}.</p>`;
          for (const plot of v.plots) {
            commons += !plot.done ? `<p>Clearing a plot for ${nm(plot.intended)}: ${Math.round(Sim.plotProgress(st, plot) * 100)}% done.</p>`
              : `<p>Plot cleared${plot.holder !== null ? `, for ${nm(plot.holder)}` : ''}; ${plot.cottage && !plot.built
                ? `the cottage: ${['foundation', 'walls', 'roof'][plot.cottage.i]} is next` : 'the cottage is built'}.</p>`;
          }
          for (const f of empties) commons += `<p>${esc(f.name)} stands empty, ${emptyYears(f)} years; buildings at
            ${Math.round(f.condition * 100)}%${f.state === 'ruin' ? ', a ruin' : ''}.</p>`;
          commons += '</div>';
        }
        body += fold(commonsKey, 'Village commons & expansion', commons);
      }
      const population = households.reduce((sum, item) => sum + item.members.length, 0);
      h += `<details class="village-block" data-fold="${key}"${expanded ? ' open' : ''}>
        <summary>${iconImg(villageIcon(v),
          'mini')}${esc(v.name)}<span class="summary-meta">${population} people · ${households.length} households</span></summary>${body}</details>`;
    }
    // the village log: the last 40 of the record's events that are told to all (Sim.villageLog), with their names as links
    if (!query) h += fold('recent', 'Recent events', foldOpen('recent') ? '<div class="log">' + Sim.villageLog(st).map((e) => {
      const c = Sim.cal(e.t); return `<p>Year ${c.year}, ${Sim.SEASONS[c.season]}: ${linkNames(e.text, e.ev)}</p>`;
    }).join('') + '</div>' : '');
    if (!h) h = '<p>No matching people or households. Try another name.</p>';
    $('peopleCount').textContent = query ? `${matches} of ${total} people match` : `${total} people across ${st.villages.length} villages`;
    if (h !== settlersHTML) { settlersHTML = h; updatePanelHTML($('settlers'), h); }
  }
  $('peopleSearch').addEventListener('input', (e) => { peopleQuery = e.target.value; renderSettlers(); });
  $('settlers').addEventListener('toggle', (e) => {
    const key = e.target.dataset.fold;
    if (!key || (peopleQuery.trim() && /^(village|household)-/.test(key)) || foldOpen(key) === e.target.open) return;
    if (e.target.open) peopleFolds.add(key); else peopleFolds.delete(key);
    renderSettlers();
  }, true);
  function focusPawn(id) {
    const p = st.pawns[id]; if (p.died !== null) { treeSel = id; openTree(); return; }
    const a = st.agents[id], f = farmOf(p);
    flyTo(a.inside ? w.hx[f.house] : a.x, a.inside ? w.hy[f.house] : a.y);
    selectPawn(id);
  }
  function selectPawn(id, pinned = true) { selectionPinned = pinned; openPanel('tile'); selPawn = id; sel = -1; hoverDirty = true; showPawn(id); }
  function showPawn(id) {
    $('personFamily').hidden = false;
    const p = st.pawns[id], f = farmOf(p);
    if (p.died !== null || !f) { card(Sim.fullName(p), ['Died'], '', { badge: faceImg(id, 'badge') }); return; }
    const sp = Sim.spouseOf(st, id), kids = Sim.childrenOf(st, id).filter((c) => st.pawns[c].died === null);
    const holds = Sim.holdingOf(st, id), heirs = heirTo(id);
    const status = holds ? `Holds ${f.name}` : heirs.length ? `Heir to ${heirs.map((x) =>
      x.name).join(' and ')}` : p.retired ? `Retired at ${f.name}` : p.age >= 18 &&
      st.demand.includes(id) ? `Landless at ${f.name}, wants to move out` : `Lives at ${f.name}`;
    const rel = (sp !== null ? `${p.sex === 'f' ? 'Wife' : 'Husband'} of ${Sim.fullName(st.pawns[sp])}` : isWidow(p) ? 'Widowed' : 'Unmarried')
      + (p.pregnantUntil !== null ? ', expecting a child' : p.nursingUntil !== null && st.t < p.nursingUntil ? ', nursing a baby' : '');
    const v = st.villages[f.village];
    card(Sim.fullName(p),
      [`${roleLine(p)}, ${p.age}, health ${Math.round(p.health)}`,
      `${status}. ${rel}${kids.length ? `, ${kids.length} ${kids.length === 1 ? 'child' : 'children'}` : ''}`,
      p.stake ? `Share in hand: ${p.stake} rations${p.owed ? `, ${p.owed} still owed` : ''}` :
      (p.advocate ? `Argues for: ${Culture.DIMS[p.advocate.dim].opts[p.advocate.opt][1].toLowerCase()}` : ''),
      p.age >= 16 ? `Prestige ${p.prestige.toFixed(2)}: ${Sim.prestigeParts(st, p).map(([l, v]) => `${l.toLowerCase()} ${v.toFixed(2)}`).join(', ')}` : '',
      Sim.idleLine(st, id)].filter(Boolean), Sim.describe(st, id), { badge: faceImg(id, 'badge'),
      links: (sp !== null ? pawnChip(sp) : '') + farmChip(f) + villageChip(v) });
    showRelations(id);
    renderPlay(id);
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
      return `<button type="button" data-pawn="${x.id}">${faceImg(x.id,
        'mini')}${esc(Sim.fullName(st.pawns[x.id]))}<i>${esc(detail)}</i><b class="${tone}">${signed(
        x.opinion)}</b></button>`;
    }).join('');
    const owed = goodwillRows(id), h = (rows ? `<h3>Knows best</h3>${rows}` : '') + (owed ? `<h3>Owes and is owed</h3>${owed}` : '');
    if (h !== relHTML) { relHTML = h; $('tileRel').innerHTML = h; }
    $('tileRel').hidden = !h; $('relationsDetails').hidden = !h;
  }
  // A pawn's largest goodwill balances (VB-218; design.md, The gift: What the player sees), in whole rations; on a holder's panel, what
  // it would give each counterpart's household, with the parts of its allowance on hover.
  const rations = (n) => `${n} ${n === 1 ? 'ration' : 'rations'}`;
  const part = (v) => { const r = Math.round(v); return r === 0 ? '0' : `${r < 0 ? '−' : '+'}${Math.abs(r)}`; };
  function goodwillRows(id) {
    return Sim.goodwillOf(st, id).filter((x) => Math.abs(x.balance) >= 1).slice(0, 5).map((x) => {
      const name = esc(Sim.fullName(st.pawns[x.other])), n = rations(Math.round(Math.abs(x.balance)));
      const a = Sim.explainAllowance(st, id, x.other);
      const give = a ? `<i class="give">would give up to ${rations(Math.round(a.value))}</i>` : '';
      const why = a ? ` title="${esc(a.parts.map((q) => `${q.label} ${part(q.factor)}`).join(' · '))}"` : '';
      return `<button type="button" data-pawn="${x.other}"${why}>${x.balance > 0 ? `Is owed ${n} by ${name}` : `Owes ${name} ${n}`}${give}</button>`;
    }).join('');
  }
  // The selection card: a title, up to four lines and the rest, an activity, and `more`: a badge (portrait or icon), a kind under the title,
  // links to what the selection belongs to, and a list of what it holds. Unpinned, under the pointer, it shows its summary only.
  const cardShown = {};
  function cardPart(id, html = '') {
    const el = $(id);
    if (cardShown[id] !== html) { cardShown[id] = html; el.innerHTML = html; }
    el.hidden = !html;
  }
  function card(title, lines, activity = '', more = {}) {
    $('tileName').textContent = title;
    cardPart('tileBadge', more.badge); cardPart('tileKind', more.kind ? esc(more.kind) : ''); cardPart('tileLinks', more.links);
    cardPart('tileList', more.list);
    $('tile').classList.toggle('peek', !selectionPinned);
    $('tileActivity').textContent = activity; $('tileActivity').hidden = !activity;
    ['tileElev', 'tileCoord', 'tileExtra', 'tileMore'].forEach((id, k) => {
      const el = $(id); el.textContent = lines[k] || ''; el.hidden = !lines[k];
    });
    const rest = lines.slice(4).map((line) => `<span>${esc(line)}</span>`).join('');
    if ($('tileRest').innerHTML !== rest) $('tileRest').innerHTML = rest;
    $('personFamily').hidden = selPawn < 0;
    $('tileRel').hidden = true; $('relationsDetails').hidden = true; $('cardPlay').hidden = true;
    $('tile').hidden = activePanel !== 'tile';
    syncTabs();
  }
  function pawnAt(x, y) {
    if (!st || cam.z <= 0.28) return -1;
    let best = -1, bd = 1e9;
    for (const a of st.agents) {
      if (a.inside || st.pawns[a.id].died !== null) continue;
      const dx = x - a.x, dy = y - (a.y - 9);
      if (Math.abs(dx) < (coarse ? Math.max(6, 22 / cam.z) : 6) && Math.abs(dy) < (coarse ? Math.max(10, 22 / cam.z) : 10)) {
        const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = a.id; } }
    }
    return best;
  }
  function settlementTileInfo(i) {
    if (!st) return null;
    for (const f of st.farmsteads) {
      const v = st.villages[f.village].name, where = `${f.name}, ${v}`;
      if (f.house === i) {
        if (f.household === null) return [f.name,
          [`Empty for ${emptyYears(f)} years: ${f.state === 'ruin' ? 'a ruin' : 'buildings at ' + Math.round(f.condition * 100) + '%'}`,
          'No heir took it; claims come in the next batch'], { farm: f.id, house: true }];
        const hh = st.households[f.household], heirs = Sim.heirRanking(st, hh).slice(0, 3).map((q) => Sim.fullName(st.pawns[q]));
        return [f.name,
          [`Held by ${Sim.fullName(st.pawns[hh.holder])}; ${hh.members.length} live here`,
          heirs.length ? `Heirs: ${heirs.join(', then ')}` : 'No heir in line',
          `${hungerWord(hh)}: ${Math.round(hh.grain)} rations of grain, ${Math.round(hh.wood)} loads of firewood`], { farm: f.id, house: true }];
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
          [word, `Soil quality ${Math.round(fd.fert * 100)}%${wet}${worn}, ${f.household === null ? 'no one works it' : 'owned by the household'}`], {
            farm: f.id }];
      }
    }
    for (const f of st.farmsteads) {
      const m = f.meadows.find((q) => q.tile === i);
      if (!m) continue;
      const word = { grass: m.raked ? 'Grass growing, raked clean in spring' : 'Grass growing', mown: 'Mown; the hay is drying',
        aftermath: 'Aftermath: the hay is in' }[m.stage];
      return [`Hay meadow of ${f.name}, ${st.villages[f.village].name}`,
        [word, `About ${Math.round(30 * m.fert)} hay in an ordinary year${Sim.byRiver(w, i) ? ', wet ground by the river' : ''}`], { farm: f.id }];
    }
    for (const v of st.villages) if (v.center === i && v.green) return [`Village green of ${v.name}`, [], { village: v.id }];
    return null;
  }

