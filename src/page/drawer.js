// @sys page/drawer: the customs and debug drawer
  // ======== customs and debug drawer ========
  let drawerTab = null, skipping = false, drawerHTML = '';
  const drawer = $('drawer'), BAR = ['#2f7d6b', '#c9a24a', '#a8604c', '#5a72a8'];
  function openDrawer(tab) {
    drawerTab = drawerTab === tab ? null : tab;
    drawer.hidden = !drawerTab;
    $('customsBtn').setAttribute('aria-pressed', String(drawerTab === 'customs'));
    $('debugBtn').setAttribute('aria-pressed', String(drawerTab === 'debug'));
    drawerHTML = ''; if (drawerTab === 'debug') buildDebug(); renderDrawer();
  }
  $('customsBtn').addEventListener('click', () => openDrawer('customs'));
  $('debugBtn').addEventListener('click', () => openDrawer('debug'));
  $('drawerClose').addEventListener('click', () => openDrawer(drawerTab));
  const optLabel = (d, j) => Culture.DIMS[d].opts[j][1];
  const nextMeeting = () => {
    const c = Sim.cal(st.t), target = 2 * Sim.SEASON_DAYS + 9; let days = target - c.doy; if (days < 0 || (days === 0 && c.hour >= 12)) days += Sim.YEAR_DAYS;
    return days; };
  function renderDrawer() {
    if (!drawerTab || !st) return;
    if (drawerTab === 'customs') {
      const env = st.cenv; let h = '<h2 class="dh">Customs</h2>';
      const days = nextMeeting();
      h += `<p class="dm">Attitudes drift every day; a village’s practice changes only at its meeting after harvest (next in ${days} ${days === 1 ? 'day' :
        'days'}), the culture’s customs only at the reckoning that follows.</p>`;
      for (const c of env.cultures) h += `<p class="dm"><strong>${esc(c.name)} culture</strong>, centred on ${esc(
        env.settlements[c.centres[0]].name)}${c.parent !== null ? `, split from ${esc(env.cultures[c.parent].name)}` : ''}.</p>`;
      const setts = env.settlements;
      for (const s of setts) {
        const voices = Sim.membersOf(st, s.id).filter((p) => Sim.voiceOf(st, p, s) > 0).length;
        h += `<p class="dm">${esc(s.name)}: ${Sim.membersOf(st, s.id).length} people, ${voices} with a voice; tie to the centre ${Math.round(
          s.tie * 100)}%${s.id !== env.cultures[s.culture].centres[0] ? `, ${Math.round((s.divergence ||
          0) * 100)}% apart in practice${s.fissionYears ? `, ${s.fissionYears} of ${Culture.P.fission.years} years towards a split` : ''}` : ''}.</p>`;
      }
      h += `<table class="cust"><thead><tr><th scope="col">Custom</th><th scope="col">Culture</th>${setts.map((s) =>
        `<th scope="col">${esc(s.name)}</th>`).join('')}</tr></thead><tbody>`;
      const sup = setts.map((s) => Culture.support(env, Sim.membersOf(st, s.id), (p) => Sim.voiceOf(st, p, s)).S);
      Culture.DIMS.forEach((d, k) => {
        const c = env.cultures[setts[0].culture], dots = Math.max(1, Math.round(d.m * 5));
        h += `<tr><th scope="row">${esc(d.label)}<br><span class="mall" title="How easily it changes">${'●'.repeat(dots)}${'○'.repeat(
          5 - dots)}</span></th><td>${esc(optLabel(k, c.customs[k]))}</td>`;
        setts.forEach((s, si) => {
          const cc = env.cultures[s.culture], dev = s.practice[k] !== cc.customs[k], o = Culture.OFF[k];
          const segs = d.opts.map((op, j) =>
            `<i style="width:${(sup[si][o + j] * 100).toFixed(1)}%;background:${BAR[j]}" title="${esc(op[1])}: ${Math.round(
            sup[si][o + j] * 100)}%"></i>`).join('');
          h += `<td class="${dev ? 'dev' : ''}">${esc(optLabel(k, s.practice[k]))}<div class="sbar" aria-hidden="true">${segs}</div></td>`;
        });
        h += '</tr>';
      });
      h += '</tbody></table><p class="dm">Bars show voice-weighted support for each option today, in the order: ' + ['first', 'second', 'third',
        'fourth'].map((n, j) => `<span class="sw" style="background:${BAR[j]}"></span>${n}`).join(' ') + ' option.</p>';
      h += '<h3 class="dh3">Meetings</h3>' + (st.meetingLog.length ? st.meetingLog.slice(0, 8).map((e) =>
        `<p class="dm">Year ${e.year}: ${esc(e.text)}</p>`).join('') : '<p class="dm">No meeting held yet.</p>');
      if (h !== drawerHTML) { drawerHTML = h; $('drawerBody').innerHTML = h; }
    } else updateDebug();
  }
  function buildDebug() {
    const dims = Culture.DIMS.map((d, k) => `<option value="${k}">${esc(d.label)}</option>`).join('');
    $('drawerBody').innerHTML = `<h2 class="dh">Debug</h2>
      <p class="dm" id="dbgWhen"></p>
      <div class="dbg-row"><button type="button" data-act="skip1">Skip a year</button><button type="button" data-act="skip10">Skip ten years</button></div>
      <div class="dbg-row"><button type="button" data-act="meet">Hold the meetings now</button><button
        type="button" data-act="move">Run the moving round</button></div>
      <p class="dm">Drift speed of attitudes</p>
      <div class="dbg-row" role="group" aria-label="Drift speed">${[1, 10, 100].map((m) =>
        `<button type="button" data-drift="${m}" aria-pressed="${st.driftMul === m}">×${m}</button>`).join('')}</div>
      <label class="dchk"><input type="checkbox" id="dbgDeaths" ${st.naturalDeaths ? 'checked' : ''}> Natural deaths</label>
      <h3 class="dh3">Selected person</h3>
      <p class="dm" id="dbgSel"></p>
      <div class="dbg-row"><button type="button" data-act="kill">Kill</button><button type="button" data-act="retire">Retire and hand over</button></div>
      <div class="dbg-row"><select id="advDim" aria-label="Custom">${dims}</select><select id="advOpt" aria-label="Option"></select></div>
      <div class="dbg-row"><button type="button" data-act="advP">Make them argue for it</button><button
        type="button" data-act="advV">Rally a fifth of the village</button></div>
      <h3 class="dh3">Wants to move out</h3><p class="dm" id="dbgOut"></p>
      <p class="dm" id="dbgMsg" aria-live="polite"></p>`;
    const fillOpts = () => {
      const k = +$('advDim').value; $('advOpt').innerHTML = Culture.DIMS[k].opts.map((o, j) => `<option value="${j}">${esc(o[1])}</option>`).join(''); };
    $('advDim').addEventListener('change', fillOpts); fillOpts();
    $('dbgDeaths').addEventListener('change', (e) => { st.naturalDeaths = e.target.checked; });
    updateDebug();
  }
  const selected = () => (selPawn >= 0 ? selPawn : treeSel >= 0 ? treeSel : -1);
  function updateDebug() {
    if (!$('dbgWhen')) return;
    const c = Sim.cal(st.t), days = nextMeeting();
    $('dbgWhen').textContent = skipping ? $('dbgWhen').textContent :
      `Year ${c.year}, ${Sim.SEASONS[c.season]} day ${c.sday + 1}. Next meetings in ${days} ${days === 1 ? 'day' : 'days'}.`;
    const id = selected(), p = id >= 0 ? st.pawns[id] : null;
    $('dbgSel').textContent = p ?
      `${Sim.fullName(p)}${p.died !== null ? ' (dead)' : `, ${p.age}, ${roleLine(p)}`}${p.advocate ? `; argues for “${optLabel(p.advocate.dim,
      p.advocate.opt).toLowerCase()}”` : ''}` : 'Select someone on the map, in the settlers list or in the family tree.';
    const out = st.demand.filter((q) => st.pawns[q].alive);
    $('dbgOut').textContent = out.length ? out.map((q) =>
      `${Sim.fullName(st.pawns[q])} (${st.pawns[q].age}, ${st.villages[Sim.settlementIdOf(st, st.pawns[q])].name})`).join(', ') : 'Nobody right now.';
  }
  const dmsg = (t) => { const m = $('dbgMsg'); if (m) m.textContent = t; };
  async function skipYears(n) {
    if (skipping) return;
    skipping = true;
    const days = n * Sim.YEAR_DAYS;
    for (let d = 0; d < days; d++) {
      Sim.advance(st, Sim.DAY);
      if (d % 4 === 3) { $('dbgWhen').textContent = `Skipping: day ${d + 1} of ${days}…`; await frame(); }
    }
    skipping = false; st.visualDirty = true; settlersHTML = ''; dmsg(`Skipped ${n} ${n === 1 ? 'year' : 'years'}.`); updateDebug();
  }
  drawer.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || !st || skipping) return;
    const id = selected(), p = id >= 0 ? st.pawns[id] : null;
    if (b.dataset.drift) {
      st.driftMul = +b.dataset.drift;
      drawer.querySelectorAll('[data-drift]').forEach((x) => x.setAttribute('aria-pressed', String(+x.dataset.drift === st.driftMul))); return; }
    switch (b.dataset.act) {
      case 'skip1': skipYears(1); break;
      case 'skip10': skipYears(10); break;
      case 'meet': Sim.holdMeetings(st); dmsg(st.meetingLog[0] ? st.meetingLog[0].text : ''); break;
      case 'move': Sim.movingRound(st); dmsg(`Moving round done; ${st.demand.length} want to move out.`); break;
      case 'kill': if (p && p.died === null) {
        Sim.killPawn(st, id, 'killed'); dmsg(`${Sim.fullName(p)} has died.`);
        if (selPawn === id) { selPawn = -1; $('tile').hidden = true; } } else dmsg('Select a living person first.'); break;
      case 'retire': {
        const hh = p ? Sim.holdingOf(st, id) : null;
        if (hh && Sim.retireHolder(st, hh.id)) dmsg(`${Sim.fullName(p)} hands over ${st.farmsteads[hh.farmstead].name}.`);
        else dmsg('Select someone who holds a farm and has an heir.'); break; }
      case 'advP': case 'advV': {
        if (!p || p.died !== null) { dmsg('Select a living person first.'); break; }
        const dim = +$('advDim').value, opt = +$('advOpt').value, until = st.cenv.t + 10;
        if (b.dataset.act === 'advP') { p.advocate = { dim, opt, until }; dmsg(`${Sim.fullName(p)} now argues for “${optLabel(dim, opt).toLowerCase()}”.`); }
        else {
          const s = st.cenv.settlements[Sim.settlementIdOf(st, p)],
            voiced = Sim.membersOf(st, s.id).filter((q) => Sim.voiceOf(st, q, s) > 0).sort((x, y) => y.prestige - x.prestige);
          const want = Math.max(1, Math.ceil(voiced.length * 0.2)); let n = 0;
          for (const q of voiced) { if (n >= want) break; q.advocate = { dim, opt, until }; n++; }
          dmsg(`${n} of ${voiced.length} voices in ${s.name} now argue for “${optLabel(dim, opt).toLowerCase()}”.`);
        }
        break;
      }
    }
    settlersHTML = ''; updateDebug();
  });

