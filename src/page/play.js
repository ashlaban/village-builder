// @sys page/play: playing a pawn (VB-210): Play as, the played pawn's part of its card and what it may do here, Walk here, Follow, its map mark
  // ======== playing a pawn ========
  // Which pawn is played, its queue and its switch are the run's (st.player, written only through Sim.inhabit, uninhabit, queue, unqueue and
  // setAuto). Following it with the camera, choosing a tile to walk to and the last message are the page's own state, never saved.
  let followPlayed = false, walkPick = false, playMsg = null, playHTML = '';
  const ADULT = 18; // who may be played: any living adult (design.md, Which pawn)
  const playMark = new PIXI.Graphics();
  L.hover.addChild(playMark);
  const played = () => (st && st.player && st.pawns[st.player.pawn].died === null ? st.player.pawn : -1);
  // The scenario's suggestion (design.md, Which pawn): the first holder of the first household; in populous, that is a holder too.
  function suggestedPawn() {
    for (const hh of st.households) {
      if (hh.dissolved || hh.holder === null) continue;
      const p = st.pawns[hh.holder];
      if (p.died === null && p.age >= ADULT) return p.id;
    }
    return -1;
  }
  const pad = (n) => String(n).padStart(2, '0');
  const clockOf = (t) => { const m = Math.floor(Sim.cal(t).hour * 60 + 1e-6); return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };
  const holderName = (o) => (!o ? '' : o.type === 'village' ? st.villages[o.id].name : st.farmsteads[st.households[o.id].farmstead].name);
  const VERB_WORDS = { work: 'Work', walkTo: 'Walk to a tile', goHome: 'Go home', idle: 'Idle', argue: 'Argue for a cause', dropCause: 'Drop the cause',
    leave: 'Move out to new land', claim: 'Claim an empty farm', serve: 'Take service' };
  // A command in words: a queued one, or an opportunity (which also has its kind and holder).
  function commandWords(c) {
    if (c.verb === 'work') {
      const j = st.jobs.get(c.target), kind = c.kind || (j && j.kind), owner = c.holder || (j && j.owner);
      return `${kind ? Sim.KINDS[kind].name : 'Work'}${owner ? ` for ${holderName(owner)}` : ''}`;
    }
    if (c.verb === 'idle') return c.args && c.when === undefined ? `Idle until ${clockOf(c.args.until)}` : 'Idle for an hour';
    if (c.verb === 'walkTo') return c.target === null ? 'Walk here' : 'Walk to a tile';
    if (c.verb === 'argue') { const d = Culture.DIMS[c.args.dim]; return `${d.label}: ${d.opts[c.args.option][1].toLowerCase()}`; }
    if (c.verb === 'dropCause') return `Drop the cause: ${Culture.DIMS[c.args.dim].label.toLowerCase()}`;
    if (c.verb === 'claim') return `Claim ${st.farmsteads[c.target].name}`;
    if (c.verb === 'serve') return c.target === null ? 'Take service' : `Take service at ${holderName({ type: 'household', id: c.target })}`;
    return VERB_WORDS[c.verb] || c.verb;
  }
  const BASIS = { member: 'as a member', servant: 'as a servant', villager: 'as a villager', self: 'for itself' };
  // An opportunity: a button that queues it, or greyed with the reason it may not be taken now; read-only where its verb is not yet the
  // player's (causes, VB-211; the round's acts, VB-212).
  function oppRow(o, open) {
    const what = esc(commandWords(o)), note = esc(o.why || BASIS[o.basis]);
    if (!open) return `<li class="opp${o.why ? ' barred' : ''}"><span>${what}</span><i>${note}</i></li>`;
    const cmd = esc(JSON.stringify({ verb: o.verb, target: o.target, args: o.verb === 'argue' || o.verb === 'dropCause' ? o.args : undefined }));
    return `<li><button type="button" class="opp" data-play="do" data-cmd="${cmd}"${o.why ? ' disabled' : ''}>${what}<i>${note}</i></button></li>`;
  }
  // The cause the pawn argues, when it ends, and how the village leaned on that custom at the last meeting: the cause's share of the support
  // against the practice's, and the margin it must pass (meeting: the practice's share times 1 + margin, more where there are few voices).
  function causeNote(p) {
    const a = p.advocate; if (!a) return '<p class="hint">It argues no cause.</p>';
    const d = Culture.DIMS[a.dim], s = st.cenv.settlements[Sim.settlementIdOf(st, p)], sup = s && s.lastSupport;
    let h = `<p class="cause">Argues for “${esc(d.opts[a.opt][1])}” (${esc(d.label.toLowerCase())}) for ${Math.max(0,
      a.until - st.cenv.t).toFixed(1)} more years.`;
    if (sup) {
      const o = Culture.OFF[a.dim], x = s.practice[a.dim], cust = s.culture !== undefined ? st.cenv.cultures[s.culture].customs[a.dim] : x;
      const need = x === a.opt ? 0 : x === cust ? Culture.P.margin + Culture.P.tieMargin * s.tie : a.opt === cust ? Culture.P.returnMargin : Culture.P.margin;
      h += x === a.opt ? ' It is the village practice.' : ` At the last meeting “${esc(d.opts[a.opt][1])}” had ${Math.round(sup[o + a.opt] * 100)}% of the `
        + `support against ${Math.round(sup[o + x] * 100)}% for “${esc(d.opts[x][1])}”, the practice; it must pass it by ${Math.round(need * 100)}%.`;
    } else h += ' The village has not met yet.';
    return `${h}</p>`;
  }
  // The household's food in days of need: grain above the seed set aside, cooked rations and the larder, over a day's rations of its living.
  function foodDays(hh) {
    let need = 0;
    for (const m of hh.members) { const q = st.pawns[m]; if (q.died === null) need += q.age >= 14 ? Sim.ECON.ration.adult : Sim.ECON.ration.child; }
    const food = Math.max(0, hh.grain - Sim.seedReserve(st, hh)) + hh.rations + Sim.larderOf(hh);
    return need > 0 ? Math.floor(food / need) : null;
  }
  // The played pawn's part of its card, after card() has hidden it: rebuilt with the card (at most four times a second, page/animate), and
  // Sim.opportunities is called once per rebuild, only for the played pawn.
  function renderPlay(id) {
    const p = st.pawns[id], pl = st.player;
    let h = '';
    if (!pl || pl.pawn !== id) {
      if (p.age >= ADULT) h = `<button type="button" class="primary" id="playAs" data-play="inhabit">Play as ${esc(Sim.fullName(p))}</button>`;
    } else {
      const hh = p.household !== null ? st.households[p.household] : null, f = hh ? st.farmsteads[hh.farmstead] : null;
      const days = hh ? foodDays(hh) : null, wood = hh ? Math.round(hh.wood) : 0;
      const food = !hh ? '' : ` ${esc(f.name)}: food for ${days === null ? 'no one' : `${days} ${days === 1 ? 'day' : 'days'}`}, firewood ${wood} ${
        wood === 1 ? 'load' : 'loads'}.`;
      h += `<div class="play-head"><h3>You play ${esc(Sim.fullName(p))}</h3><button type="button" data-play="stop">Stop playing</button></div>`;
      h += `<p class="needs">Hunger ${Math.round(p.hunger * 100)}%, health ${Math.round(p.health)}.${food}</p>`;
      h += `<p class="doing">Doing: ${esc(Sim.describe(st, id))}</p>`;
      h += `<div class="switches"><button type="button" data-play="auto" aria-pressed="${pl.auto}">Automatic behaviour ${pl.auto ? 'on' : 'off'}</button>`
        + `<button type="button" data-play="follow" aria-pressed="${followPlayed}">Follow</button></div>`;
      h += '<h3>Queue</h3>';
      h += pl.queue.length ? `<ol class="queue">${pl.queue.map((c, i) =>
        `<li><span>${esc(commandWords(c))}${c.begun !== null ? ' <i>under way</i>' : ''}</span>`
        + `<button type="button" data-play="unqueue" data-i="${i}" aria-label="Remove ${esc(commandWords(c))}">Remove</button></li>`).join('')}</ol>`
        : `<p class="hint">${pl.auto ? 'Nothing queued: it does what its role would.' :
          'Nothing queued, and its automatic behaviour is off: it waits, and goes home at dark.'}</p>`;
      if (pl.refused) h += `<p class="refused">Refused at ${clockOf(pl.refused.t)}: ${esc(VERB_WORDS[pl.refused.verb] ||
        pl.refused.verb)}, ${esc(pl.refused.why)}</p>`;
      const opps = Sim.opportunities(st, id), groups = { work: [], going: [], causes: [], round: [] };
      for (const o of opps) {
        const g = o.when === 'round' ? 'round' : o.verb === 'work' ? 'work' : o.verb === 'argue' || o.verb === 'dropCause' ? 'causes' : 'going';
        groups[g].push(o);
      }
      h += '<h3>What it may do here</h3>';
      h += `<h4>Work</h4>${groups.work.length ? `<ul class="opps">${groups.work.map((o) =>
        oppRow(o, true)).join('')}</ul>` : '<p class="hint">No work it may take.</p>'}`;
      h += `<h4>Going</h4><ul class="opps">${groups.going.map((o) =>
        oppRow(o, true)).join('')}<li><button type="button" class="opp" data-play="walk" aria-pressed="${
        walkPick}">${walkPick ? 'Choose an open tile on the map, or cancel' : 'Walk here'}<i>for itself</i></button></li></ul>`;
      if (groups.causes.length || p.advocate) h += `<h4>Causes</h4>${causeNote(p)}<ul class="opps">${groups.causes.map((o) =>
        oppRow(o, true)).join('')}</ul>`;
      if (groups.round.length) h += `<h4>At the moving round <span>shown only, for now</span></h4><ul class="opps">${groups.round.map((o) =>
        oppRow(o, false)).join('')}</ul>`;
    }
    if (playMsg && playMsg.id === id) h += `<p class="refused" role="status">${esc(playMsg.text)}</p>`;
    if (h !== playHTML) { playHTML = h; $('playBox').innerHTML = h; }
    $('playBox').hidden = !h;
  }
  function playAs(id) {
    const r = Sim.inhabit(st, id);
    playMsg = r === true ? null : { id, text: r }; walkPick = false; $('playOffer').hidden = true;
    return r;
  }
  $('playBox').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-play]');
    if (!b || !st || selPawn < 0) return;
    const id = selPawn, act = b.dataset.play;
    let r = true;
    if (act === 'inhabit') r = playAs(id);
    else if (act === 'stop') { r = Sim.uninhabit(st); followPlayed = false; walkPick = false; }
    else if (act === 'auto') r = Sim.setAuto(st, !st.player.auto);
    else if (act === 'follow') followPlayed = !followPlayed;
    else if (act === 'walk') walkPick = !walkPick;
    else if (act === 'unqueue') r = Sim.unqueue(st, +b.dataset.i);
    else if (act === 'do') {
      const c = JSON.parse(b.dataset.cmd);
      r = Sim.queue(st, { actor: id, verb: c.verb, target: c.target, args: c.verb === 'idle' ? { until: st.t + 1 } : c.args || null });
    }
    playMsg = r === true ? null : { id, text: r };
    showPawn(id);
  });
  // "Walk here": the next tile clicked on the map, if open; a closed one says why and waits for another (page/tileinfo asks first).
  function pickWalk(i) {
    const id = played();
    if (id < 0) { walkPick = false; return; }
    const o = i >= 0 ? Sim.opportunities(st, id, i).find((x) => x.verb === 'walkTo') : null;
    if (!o || o.why) playMsg = { id, text: `${o ? o.why : 'no one can walk there'}: choose an open tile` };
    else { const r = Sim.queue(st, { actor: id, verb: 'walkTo', target: i }); walkPick = false; playMsg = r === true ? null : { id, text: r }; }
    if (selPawn === id) showPawn(id);
  }
  // Follow: the camera stays on the played pawn, or its house while it is indoors; dragging the map lets go (page/input).
  function followCamera() {
    const id = played();
    if (id < 0) { followPlayed = false; return; }
    const a = st.agents[id], f = farmOf(st.pawns[id]);
    if (a.inside && !f) return;
    cam.x = a.inside ? w.hx[f.house] : a.x; cam.y = a.inside ? w.hy[f.house] : a.y; vel.x = vel.y = 0;
  }
  // The played pawn's mark on the map: a gold pointer over its head, or over its house while it is indoors, the same size on screen at
  // any zoom, so it can be found among the others and from afar.
  function drawPlayMark() {
    playMark.clear();
    const id = played();
    if (id < 0 || document.body.classList.contains('ui-hidden')) return;
    const p = st.pawns[id], a = st.agents[id], f = farmOf(p), k = 1 / Math.max(cam.z, 0.12);
    if (a.inside && !f) return;
    const x = a.inside ? w.hx[f.house] : a.x, y = a.inside ? w.hy[f.house] - 16 : a.y - 22 * PAWN_S * sizeAt(p.age);
    const tip = y - 3 * k, top = tip - 12 * k;
    playMark.poly([x, tip, x - 7 * k, top, x + 7 * k, top]).fill({ color: 0xf2c14e }).stroke({ width: 1.6 * k, color: 0x2c201c });
  }
  // A new game offers the scenario's suggestion; it goes when a pawn is played, a panel opens or another world is built.
  function offerPlay() {
    const id = suggestedPawn(), box = $('playOffer');
    if (id < 0) { box.hidden = true; return; }
    const f = farmOf(st.pawns[id]);
    box.dataset.pawn = String(id);
    $('playOfferText').textContent = `Play as ${Sim.fullName(st.pawns[id])}${f ? `, who holds ${f.name}` : ''}?`;
    box.hidden = false;
  }
  $('playOfferYes').addEventListener('click', () => {
    const id = +$('playOffer').dataset.pawn;
    if (!st || !st.pawns[id]) return;
    if (playAs(id) === true) focusPawn(id);
  });
  $('playOfferNo').addEventListener('click', () => { $('playOffer').hidden = true; });
