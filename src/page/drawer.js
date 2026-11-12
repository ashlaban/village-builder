// @sys page/drawer: the customs, agenda and debug drawer
  // ======== customs and debug drawer ========
  let drawerTab = null, skipping = false;
  const drawer = $('drawer'), BAR = ['#2f7d6b', '#c9a24a', '#a8604c', '#5a72a8'];
  const DRAWER = { customs: { title: 'Customs', btn: 'customsBtn' }, agenda: { title: 'Agenda', btn: 'agendaBtn' },
    debug: { title: 'Debug', btn: 'debugBtn' } };
  function openDrawer(tab) {
    openPanel(activePanel === tab ? null : tab);
    $('drawerTitle').textContent = DRAWER[tab].title;
    $('drawerClose').setAttribute('aria-label', `Close ${DRAWER[tab].title.toLowerCase()}`);
    if (drawerTab === 'debug') buildDebug();
    if (drawerTab === 'agenda') { agendaMsg = null; agendaHTML = ''; $('drawerBody').innerHTML = '<div id="agendaContent" class="play agenda"></div>'; }
    if (drawerTab === 'customs') buildCustoms();
    renderDrawer();
  }
  $('customsBtn').addEventListener('click', () => openDrawer('customs'));
  $('debugBtn').addEventListener('click', () => openDrawer('debug'));
  $('agendaBtn').addEventListener('click', () => openDrawer('agenda'));
  $('drawerClose').addEventListener('click', () => { const tab = drawerTab; openPanel(null); $(DRAWER[tab].btn).focus(); });
  const optLabel = (d, j) => Culture.DIMS[d].opts[j][1];
  const nextMeeting = () => {
    const c = Sim.cal(st.t), target = 2 * Sim.SEASON_DAYS + 9; let days = target - c.doy; if (days < 0 || (days === 0 && c.hour >= 12)) days += Sim.YEAR_DAYS;
    return days; };
  let customVillage = 0, customsStamp = '', comparisonOpen = false;
  function buildCustoms() {
    const setts = st.cenv.settlements;
    if (!setts[customVillage]) customVillage = 0;
    $('drawerBody').innerHTML = `<label class="custom-picker">Village<select id="customVillage">${setts.map((s) =>
      `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label><div id="customContent"></div>
      <details id="customComparison"><summary>Compare all villages</summary><div id="customTable" class="table-scroll" tabindex="0"
      role="region" aria-label="Village customs comparison, scroll horizontally"></div></details>`;
    $('customVillage').value = String(customVillage);
    $('customVillage').addEventListener('change', (e) => { customVillage = +e.target.value; customsStamp = ''; renderDrawer(); });
    $('customComparison').open = comparisonOpen;
    $('customComparison').addEventListener('toggle', (e) => {
      comparisonOpen = e.target.open; customsStamp = ''; renderDrawer();
    });
    customsStamp = '';
  }
  function renderDrawer() {
    if (!drawerTab || !st || document.body.classList.contains('ui-hidden') || drawer.classList.contains('collapsed')) return;
    if (drawerTab === 'agenda') { renderAgenda(); return; }
    if (drawerTab !== 'customs') { updateDebug(); return; }
    if (!$('customContent')) buildCustoms();
    const env = st.cenv, setts = env.settlements;
    // Rebuild the selector when villages change, not every animation tick.
    if ($('customVillage').options.length !== setts.length) buildCustoms();
    const stamp = `${Math.floor(st.t / Sim.DAY)}:${customVillage}:${comparisonOpen}:${setts.map((s) => s.practice.join(',')).join(';')}`;
    if (stamp === customsStamp) return;
    customsStamp = stamp;
    const s = setts[customVillage], culture = env.cultures[s.culture], members = Sim.membersOf(st, s.id);
    const voices = members.filter((p) => Sim.voiceOf(st, p, s) > 0).length;
    const support = Culture.support(env, members, (p) => Sim.voiceOf(st, p, s)).S, days = nextMeeting();
    let h = `<p class="dm">${members.length} people · ${voices} with a voice · ${Math.round(s.tie * 100)}% tie to the culture’s centre.</p>
      <p class="dm"><strong>${esc(culture.name)} culture</strong>, centred on ${esc(setts[culture.centres[0]].name)}${culture.parent !== null
        ? `, split from ${esc(env.cultures[culture.parent].name)}` : ''}.</p>
      <p class="dm">Next village meetings in ${days} ${days === 1 ? 'day' : 'days'}. Attitudes drift daily; practice changes at the meeting after harvest.</p>`;
    if (s.id !== culture.centres[0]) h += `<p class="dm">${Math.round((s.divergence || 0) * 100)}% apart in practice${s.fissionYears
      ? `; ${s.fissionYears} of ${Culture.P.fission.years} years towards a split` : ''}.</p>`;
    Culture.DIMS.forEach((d, k) => {
      const differs = s.practice[k] !== culture.customs[k], offset = Culture.OFF[k], dots = Math.max(1, Math.round(d.m * 5));
      h += `<section class="custom-card" id="custom-${k}"><h3>${esc(d.label)}</h3><p class="${differs ? 'different' : ''}">Village: <strong>${esc(
        optLabel(k, s.practice[k]))}</strong></p><p class="dm">Culture: ${esc(optLabel(k, culture.customs[k]))}${differs ? ' · differs locally' : ''}</p>
        <div class="sbar" aria-hidden="true">${d.opts.map((option, j) =>
          `<i style="width:${(support[offset + j] * 100).toFixed(1)}%;background:${BAR[j]}"></i>`).join('')}</div>
        <p class="support">${d.opts.map((option, j) => `<span class="sw-item"><span class="sw"
          style="background:${BAR[j]}"></span>${esc(option[1])}: ${Math.round(support[offset + j] * 100)}%</span>`).join(
            ' · ')}</p><p class="support">Ease of change: ${'●'.repeat(dots)}${'○'.repeat(5 - dots)}</p></section>`;
    });
    h += '<h3 class="dh3">Meetings</h3>' + (st.meetingLog.length ? st.meetingLog.slice(0, 8).map((e) =>
      `<p class="dm">Year ${e.year}: ${esc(e.text)}</p>`).join('') : '<p class="dm">No meeting held yet.</p>');
    updatePanelHTML($('customContent'), h);
    if (comparisonOpen) {
      const sup = setts.map((v) => Culture.support(env, Sim.membersOf(st, v.id), (p) => Sim.voiceOf(st, p, v)).S);
      let table = `<table class="cust"><thead><tr><th scope="col">Custom</th>${setts.map((v) =>
        `<th scope="col">${esc(v.name)}<br>${esc(env.cultures[v.culture].name)} culture</th>`).join('')}</tr></thead><tbody>`;
      Culture.DIMS.forEach((d, k) => {
        table += `<tr><th scope="row">${esc(d.label)}</th>${setts.map((v, i) => {
          const c = env.cultures[v.culture], different = v.practice[k] !== c.customs[k];
          return `<td class="${different ? 'dev' : ''}">${esc(optLabel(k, v.practice[k]))}<br>Culture: ${esc(optLabel(k, c.customs[k]))}
            <div class="sbar" aria-hidden="true">${d.opts.map((option, j) => `<i style="width:${(sup[i][Culture.OFF[k] + j] * 100).toFixed(1)}%;
              background:${BAR[j]}"></i>`).join('')}</div></td>`;
        }).join('')}</tr>`;
      });
      $('customTable').innerHTML = table + '</tbody></table>';
    }
  }
  // ---- the agenda (the played pawn's cause): what it argues and until when, when it may take up another, the causes it may take up, by
  // custom, and who else of its village argues one. A cause is taken up or laid down by a queued command, as the pawn's other acts; the
  // village's leaning on each custom is the Customs tab's, which the links open at that custom. agendaMsg is the last click's answer. ----
  let agendaMsg = null, agendaHTML = '';
  const AGENDA_OTHERS = 6;
  const yrs = (x) => `${Math.max(0, x).toFixed(1)} ${Math.max(0, x).toFixed(1) === '1.0' ? 'year' : 'years'}`;
  function renderAgenda() {
    const id = played();
    if (id < 0) { openPanel(null); return; }
    const p = st.pawns[id], a = p.advocate, t = st.cenv.t, s = st.cenv.settlements[Sim.settlementIdOf(st, p)], wait = Culture.causeFree(p) - t;
    const link = (dim, text) => `<button type="button" class="linkish" data-agenda="customs" data-dim="${dim}">${esc(text)}</button>`;
    let h = agendaMsg ? `<p class="${agendaMsg.bad ? 'refused' : 'hint'}" role="status">${esc(agendaMsg.text)}</p>` : '';
    h += `<h3>Your agenda</h3>${causeNote(p)}`;
    if (a) {
      h += `<p class="hint">Taken up ${yrs(t - p.causeSince)} ago. ${wait > 0 ? `You may take up another in ${yrs(wait)}` : 'You may take up another now'}`
        + `; laying this one down does not shorten the wait.</p><div class="dbg-row"><button type="button" data-agenda="do" data-cmd="${
          esc(JSON.stringify({ verb: 'dropCause' }))}">Lay it down</button>${s ? link(a.dim, `${Culture.DIMS[a.dim].label} in ${s.name}`) : ''}</div>`;
    } else if (wait > 0) h += `<p class="hint">You may take up a cause in ${yrs(wait)}.</p>`;
    h += `<p class="hint">A cause is argued for ${Culture.P.causeEvery} years: it moves your own mind at once, and day by day the minds of those you have `
      + 'ties to, by your standing. The village decides at its yearly meeting.</p>';
    if (s) {
      const opps = Sim.opportunities(st, id).filter((o) => o.verb === 'argue');
      h += `<h3>Take up a cause${wait > 0 ? ` (in ${yrs(wait)})` : ''}</h3>`;
      Culture.DIMS.forEach((d, k) => {
        const mine = opps.filter((o) => o.args.dim === k);
        if (!mine.length) return;
        h += `<h4>${esc(d.label)}<span>now: ${link(k, d.opts[s.practice[k]][1])}</span></h4><div class="dbg-row">${mine.map((o) =>
          `<button type="button" data-agenda="do" data-cmd="${esc(JSON.stringify({ verb: 'argue', args: o.args }))}"${o.why
            ? ` aria-disabled="true" data-why="${esc(o.why)}" title="${esc(o.why)}"` : ''}${a && a.dim === k && a.opt === o.args.option
            ? ' aria-pressed="true"' : ''}>${esc(d.opts[o.args.option][1])}</button>`).join('')}</div>`;
      });
      const others = Sim.membersOf(st, s.id).filter((q) => q.alive && q.advocate && q.id !== id).sort((x, y) => y.prestige - x.prestige);
      h += `<h3>Also arguing in ${esc(s.name)}</h3>` + (others.length ? others.slice(0, AGENDA_OTHERS).map((q) =>
        `<p><button type="button" class="linkish" data-agenda="pawn" data-id="${q.id}">${esc(Sim.fullName(q))}</button>: ${
          esc(Culture.DIMS[q.advocate.dim].label.toLowerCase())}, ${esc(optLabel(q.advocate.dim, q.advocate.opt).toLowerCase())} (${
          yrs(q.advocate.until - t)} more)</p>`).join('') + (others.length > AGENDA_OTHERS ? `<p class="hint">And ${others.length
          - AGENDA_OTHERS} more of less standing.</p>` : '') : '<p class="hint">No one else argues a cause now.</p>');
    }
    if (h === agendaHTML) return;
    agendaHTML = h; updatePanelHTML($('agendaContent'), h);
  }
  function agendaClick(b) {
    const act = b.dataset.agenda;
    if (act === 'customs') {
      customVillage = Sim.settlementIdOf(st, st.pawns[played()]); openPanel(null); openDrawer('customs');
      const card = $(`custom-${b.dataset.dim}`); if (card && card.scrollIntoView) card.scrollIntoView({ block: 'start' });
      return;
    }
    if (act === 'pawn') { focusPawn(+b.dataset.id); return; }
    if (b.dataset.why) agendaMsg = { text: `${b.textContent}: ${b.dataset.why}.`, bad: true };
    else {
      const c = JSON.parse(b.dataset.cmd), r = Sim.queue(st, { actor: played(), verb: c.verb, args: c.args || null });
      agendaMsg = r === true ? { text: `Queued: ${commandWords(c)}. It is done when your pawn comes to it.` } : { text: r, bad: true };
    }
    renderAgenda();
  }
  function buildDebug() {
    const dims = Culture.DIMS.map((d, k) => `<option value="${k}">${esc(d.label)}</option>`).join('');
    $('drawerBody').innerHTML = `<p class="dm" id="dbgWhen"></p>
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
      <div class="dbg-row"><button type="button" data-act="play">Play as them</button><button type="button" data-act="unplay">Stop playing</button></div>
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
      p.advocate.opt).toLowerCase()}”` : ''}` : 'Select someone on the map, in the People panel or in the family records.';
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
      Sim.command(st, { actor: null, verb: 'skip', args: { hours: Sim.DAY }, source: 'debug' });
      if (d % 4 === 3) { $('dbgWhen').textContent = `Skipping: day ${d + 1} of ${days}…`; await frame(); }
    }
    skipping = false; st.visualDirty = true; settlersHTML = ''; dmsg(`Skipped ${n} ${n === 1 ? 'year' : 'years'}.`); updateDebug();
  }
  drawer.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || !st || skipping) return;
    if (b.dataset.agenda) { if (played() >= 0) agendaClick(b); return; }
    const id = selected(), p = id >= 0 ? st.pawns[id] : null;
    if (b.dataset.drift) {
      st.driftMul = +b.dataset.drift;
      drawer.querySelectorAll('[data-drift]').forEach((x) => x.setAttribute('aria-pressed', String(+x.dataset.drift === st.driftMul))); return; }
    switch (b.dataset.act) {
      case 'skip1': skipYears(1); break;
      case 'skip10': skipYears(10); break;
      case 'meet': Sim.holdMeetings(st); dmsg(st.meetingLog[0] ? st.meetingLog[0].text : ''); break;
      case 'move': Sim.movingRound(st); dmsg(`Moving round done; ${st.demand.length} want to move out.`); break;
      case 'play': {
        if (!p) { dmsg('Select a living person first.'); break; }
        const res = playAs(id);
        if (res === true) openPanel('actions'); else dmsg(`Not done: ${res}.`);
        break; }
      case 'unplay': {
        const res = Sim.uninhabit(st); followPlayed = false; endTool();
        dmsg(res === true ? 'No pawn is played.' : `Not done: ${res}.`); break; }
      case 'kill': {
        if (!p) { dmsg('Select a living person first.'); break; }
        const res = Sim.command(st, { actor: id, verb: 'kill', source: 'debug' });
        if (res !== true) { dmsg(`Not done: ${res}.`); break; }
        dmsg(`${Sim.fullName(p)} has died.`);
        if (selPawn === id) { selPawn = -1; $('tile').hidden = true; } break; }
      case 'retire': {
        if (!p) { dmsg('Select someone who holds a farm and has an heir.'); break; }
        const hh = Sim.holdingOf(st, id), res = Sim.command(st, { actor: id, verb: 'retire', source: 'debug' });
        dmsg(res === true ? `${Sim.fullName(p)} hands over ${st.farmsteads[hh.farmstead].name}.` : `Not done: ${res}.`); break; }
      case 'advP': case 'advV': {
        if (!p || p.died !== null) { dmsg('Select a living person first.'); break; }
        const dim = +$('advDim').value, opt = +$('advOpt').value, args = { dim, option: opt };
        if (b.dataset.act === 'advP') {
          const res = Sim.command(st, { actor: id, verb: 'argue', args, source: 'debug' });
          dmsg(res === true ? `${Sim.fullName(p)} now argues for “${optLabel(dim, opt).toLowerCase()}”.` : `Not done: ${res}.`);
        } else {
          const s = st.cenv.settlements[Sim.settlementIdOf(st, p)],
            res = Sim.command(st, { actor: { settlement: s.id }, verb: 'rally', args, source: 'debug' });
          const voiced = Sim.membersOf(st, s.id).filter((q) => Sim.voiceOf(st, q, s) > 0);
          const n = voiced.filter((q) => q.advocate && q.advocate.dim === dim && q.advocate.opt === opt).length;
          dmsg(res === true ? `${n} of ${voiced.length} voices in ${s.name} now argue for “${optLabel(dim, opt).toLowerCase()}”.` : `Not done: ${res}.`);
        }
        break;
      }
    }
    settlersHTML = ''; updateDebug();
  });

