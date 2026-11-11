// @sys page/play: playing a pawn (VB-210): Play as, the played pawn's part of its card and what it may do here, Walk here, Follow, its map mark;
// after its death, whom the player may go on as (VB-213)
  // ======== playing a pawn ========
  // Which pawn is played, its queue and its switch are the run's (st.player, written only through Sim.inhabit, uninhabit, queue, unqueue and
  // setAuto). Following it with the camera, choosing a tile to walk to and the last message are the page's own state, never saved.
  let followPlayed = false, walkPick = false, playMsg = null, playHTML = '', succFor = -1, succAt = 0, succHTML = '';
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
    leave: 'Move out to new land', claim: 'Claim an empty farm', serve: 'Take service', give: 'Give grain' };
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
    if (c.verb === 'give' && Number.isInteger(c.target)) return `Give ${c.args.n} grain to ${st.farmsteads[st.households[c.target].farmstead].name}`;
    if (c.verb === 'serve') return c.target === null ? 'Take service' : `Take service at ${holderName({ type: 'household', id: c.target })}`;
    return VERB_WORDS[c.verb] || c.verb;
  }
  const BASIS = { member: 'as a member', servant: 'as a servant', villager: 'as a villager', self: 'for itself' };
  // An opportunity: a button that queues it, or greyed with the reason it may not be taken now; read-only for the round's acts, which the
  // round carries out for a pawn that wishes them (roundBox).
  function oppRow(o, open) {
    const what = esc(commandWords(o)), note = esc(o.why || BASIS[o.basis]);
    if (!open) return `<li class="opp${o.why ? ' barred' : ''}"><span>${what}</span><i>${note}</i></li>`;
    const cmd = esc(JSON.stringify({ verb: o.verb, target: o.target, args: o.verb === 'argue' || o.verb === 'dropCause' ? o.args : undefined }));
    return `<li><button type="button" class="opp" data-play="do" data-cmd="${cmd}"${o.why ? ' disabled' : ''}>${what}<i>${note}</i></button></li>`;
  }
  // The moving round's acts (VB-212): the player's wishes for its pawn, st.player.wishes, set through Sim.wish and kept until changed. A
  // wish may always be made; the round decides by its rules, so each act says what bars it now, the wishes counted in.
  function roundBox(id, acts, wishes) {
    const pick = (kind, value, label, on = wishes[kind] === value) =>
      `<button type="button" data-play="wish" data-kind="${kind}" data-value="${esc(JSON.stringify(value))}" aria-pressed="${on}">${label}</button>`;
    const leave = acts.find((o) => o.verb === 'leave'), farms = acts.filter((o) => o.verb === 'claim'), serve = acts.filter((o) => o.verb === 'serve');
    const own = wishes.out === null ? '' : ` Left to itself it would ${leave.own ? `stay: ${esc(leave.own)}` : 'move out'}.`;
    let h = '<h4>At the moving round <span>its wishes; the round decides by its rules</span></h4>';
    if (Sim.spouseOf(st, id) !== null) h += '<p class="hint">A couple moves together, and its spouse has wishes of its own.</p>';
    h += `<h5>Moving out</h5><div class="switches">${pick('out', null, 'As it would')}${pick('out', true, 'Move out')}${pick('out', false, 'Stay')}</div>`;
    h += `<p class="hint">${leave.why ? `It stays now: ${esc(leave.why)}.` :
      'It is counted among those who want land: a farm, a plot, new land or service may come of it.'}${own}</p>`;
    h += `<h5>An empty farm</h5><div class="switches">${pick('claim', null, 'Any it may')}${pick('claim', false, 'None')}</div>`;
    h += farms.length ? `<ul class="opps">${farms.map((o) => `<li><button type="button" class="opp" data-play="wish" data-kind="claim" data-value="${
      o.target}" aria-pressed="${wishes.claim === o.target}">Only ${esc(st.farmsteads[o.target].name)}<i>${
      esc(o.why || 'the round gives it to the first claimant')}</i></button></li>`).join('')}</ul>`
      : '<p class="hint">No farm of its village stands empty.</p>';
    h += `<h5>Service</h5><div class="switches">${pick('serve', null, 'As it would', wishes.serve !== false)}${pick('serve', false, 'Decline')}</div>`;
    h += `<ul class="opps">${serve.map((o) => oppRow(o, false)).join('')}</ul>`;
    const partners = acts.filter((o) => o.verb === 'match' && o.target !== null);
    if (acts.some((o) => o.verb === 'match')) {
      h += `<h5>A match</h5><div class="switches">${pick('match', null, 'As it would')}${pick('match', false, 'Not this year')}</div>`;
      h += partners.length ? `<ul class="opps">${partners.map((o) => `<li><button type="button" class="opp" data-play="wish" data-kind="match" data-value="${
        o.target}" aria-pressed="${wishes.match === o.target}">${esc(o.partner.name)}, ${o.partner.age}<i>${
        esc(o.why || 'offered at the round, as its own yes')}</i></button></li>`).join('')}</ul>`
        : '<p class="hint">It knows no unmarried one it might wed.</p>';
    }
    return h;
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
  // The household's food in days of need: grain above the seed set aside, meals and the larder, over a day's rations of its living.
  function foodDays(hh) {
    let need = 0;
    for (const m of hh.members) { const q = st.pawns[m]; if (q.died === null) need += q.age >= 14 ? Sim.ECON.ration.adult : Sim.ECON.ration.child; }
    const food = Math.max(0, hh.grain - Sim.seedReserve(st, hh)) + hh.meals + Sim.larderOf(hh);
    return need > 0 ? Math.floor(food / need) : null;
  }
  // A pawn's card says only how it stands to the player (Kim, 10 Nov: the played pawn is fixed, and changes at its death or by the Debug
  // panel): the played pawn's card leads to its actions; after its death, its own card says so and a living pawn the player may go on
  // as offers it (the list is the succession box's, below).
  let cardPlayHTML = '';
  function renderPlay(id) {
    const p = st.pawns[id], pl = st.player;
    let h = '';
    if (pl && st.pawns[pl.pawn].died !== null) {
      const list = Sim.successors(st, pl.pawn), may = p.died === null && (list.length ? list.some((s) => s.id === id) : p.age >= ADULT);
      if (pl.pawn === id) h = '<p class="hint">You played this pawn, who has died. Choose who to go on as.</p>';
      else if (may) h = `<button type="button" class="primary" id="playAs" data-card="succeed">Go on as ${esc(Sim.fullName(p))}</button>`;
    } else if (pl && pl.pawn === id) h = '<p class="hint">You play this pawn. <button type="button" data-card="actions">Its actions</button></p>';
    if (h !== cardPlayHTML) { cardPlayHTML = h; $('cardPlay').innerHTML = h; }
    $('cardPlay').hidden = !h;
  }
  $('cardPlay').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-card]');
    if (!b || !st || selPawn < 0) return;
    if (b.dataset.card === 'actions') { openPanel('actions'); return; }
    const id = selPawn, r = Sim.succeed(st, id);
    succAt = 0; playMsg = r === true ? null : { id, text: r };
    if (r === true) openPanel('actions'); else showPawn(id);
  });
  // The marriage offers that wait for the played pawn (VB-273), as questions above the queue, Yes and No calling Sim.answer; once the offer is
  // answered or closed, how it ended (page/notices keeps offerEnd) until the next offer or the next moving round.
  function offerBox(id, opps) {
    const asks = opps.filter((o) => o.when === 'offer').map((o) => o.offer);
    let h = '';
    for (const o of asks) {
      const one = (w) => `${esc(w.name)}, ${w.age}${w.farm ? `, of ${esc(w.farm)}` : ''}`;
      const part = o.part === 'the one to marry' ? 'You are the one to marry.' : `You are head of the household of ${esc(Sim.fullName(st.pawns[o.for]))}.`;
      const said = o.answers.map((a) => `${esc(a.name)} said ${a.yes ? 'yes' : 'no'}`).join('; ');
      h += `<div class="offer" role="group" aria-label="A marriage offer"><h3>A match is offered</h3>`
        + `<p>${one(o.man)} and ${one(o.woman)} would marry and live at ${esc(o.farm)}. ${part}</p>`
        + `<p class="hint">${said ? `${said}. ` : ''}${o.daysLeft} ${o.daysLeft === 1 ? 'day' :
          'days'} left; unanswered, it is answered as it would be unplayed.</p>`
        + `<div class="switches"><button type="button" class="primary" data-play="answer" data-offer="${o.id}" data-yes="true">Yes</button>`
        + `<button type="button" data-play="answer" data-offer="${o.id}" data-yes="false">No</button></div></div>`;
    }
    if (offerEnd && offerEnd.pawn === id && st.t < offerEnd.until) h += `<p class="hint offer-end" role="status">${esc(offerEnd.text)}</p>`;
    return h;
  }
  // The Actions sheet (the bottom bar's Actions, shown while a pawn is played): all that the player does through its pawn. In two parts,
  // top and h, with the gift's box between them (below). Rebuilt while it is open, at most four times a second (page/animate), and
  // Sim.opportunities is called once per rebuild.
  function renderActions() {
    const id = played(), pl = st && st.player;
    if ($('actionsBtn').hidden !== id < 0) $('actionsBtn').hidden = id < 0;
    if (id < 0) { if (activePanel === 'actions') openPanel(null); return; }
    if (activePanel !== 'actions') return;
    const p = st.pawns[id];
    let h = '', top = '';
    const opps = Sim.opportunities(st, id);
    {
      const hh = p.household !== null ? st.households[p.household] : null, f = hh ? st.farmsteads[hh.farmstead] : null;
      const days = hh ? foodDays(hh) : null, wood = hh ? Math.round(hh.wood) : 0;
      const food = !hh ? '' : ` ${esc(f.name)}: food for ${days === null ? 'no one' : `${days} ${days === 1 ? 'day' : 'days'}`}, firewood ${wood} ${
        wood === 1 ? 'load' : 'loads'}.`;
      h += `<div class="play-head"><h3>You play ${esc(Sim.fullName(p))}</h3><button type="button" data-play="find">Find</button></div>`;
      h += `<p class="needs">Hunger ${Math.round(p.hunger * 100)}%, health ${Math.round(p.health)}.${food}</p>`;
      h += `<p class="doing">Doing: ${esc(Sim.describe(st, id))}</p>`;
      h += `<div class="switches"><button type="button" data-play="auto" aria-pressed="${pl.auto}">Automatic behaviour ${pl.auto ? 'on' : 'off'}</button>`
        + `<button type="button" data-play="follow" aria-pressed="${followPlayed}">Follow</button></div>`;
      h += offerBox(id, opps);
      h += '<h3>Queue</h3>';
      h += pl.queue.length ? `<ol class="queue">${pl.queue.map((c, i) =>
        `<li><span>${esc(commandWords(c))}${c.begun !== null ? ' <i>under way</i>' : ''}</span>`
        + `<button type="button" data-play="unqueue" data-i="${i}" aria-label="Remove ${esc(commandWords(c))}">Remove</button></li>`).join('')}</ol>`
        : `<p class="hint">${pl.auto ? 'Nothing queued: it does what its role would.' :
          'Nothing queued, and its automatic behaviour is off: it waits, and goes home at dark.'}</p>`;
      if (pl.refused) h += `<p class="refused">Refused at ${clockOf(pl.refused.t)}: ${esc(VERB_WORDS[pl.refused.verb] ||
        pl.refused.verb)}, ${esc(pl.refused.why)}</p>`;
      top = h; h = '';
      const groups = { work: [], going: [], causes: [], round: [] };
      for (const o of opps) {
        if (o.when === 'offer') continue;
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
      if (groups.round.length) h += roundBox(id, groups.round, pl.wishes);
    }
    if (playMsg && playMsg.id === id) h += `<p class="refused" role="status">${esc(playMsg.text)}</p>`;
    if (top + '\n' + h !== playHTML) { playHTML = top + '\n' + h; $('playTop').innerHTML = top; $('playRest').innerHTML = h; }
    renderGive(id);
  }
  // ---- the player's gift (VB-221): while it plays a holder, grain to any household, by the verb give; below the floor it is warned ----
  // The draft: to (a household id), n (whole rations), pick (the next click on the map chooses the household), warn (Sim.giftWarning's
  // answer, waiting for the player to confirm) and msg. The box is its own element beside the play box, redrawn only when its words
  // change and never while the player types in it, so the amount and the choice are not lost to the card's refresh.
  const newGift = () => ({ of: st, to: null, n: 10, pick: false, warn: null, msg: '' });
  let gift = newGift(), giveHTML = '';
  const householdName = (hh) => {
    const holder = hh.holder !== null ? Sim.fullName(st.pawns[hh.holder]) : 'no holder';
    return `${st.farmsteads[hh.farmstead].name} (${holder})`;
  };
  // The household the played pawn gives for, or null: the one it holds.
  const givesFor = (id) => (st.player && st.player.pawn === id && st.pawns[id].died === null ? Sim.holdingOf(st, id) : null);
  function renderGive(id, force = false) {
    const box = $('giveBox'), hh = givesFor(id);
    if (gift.of !== st) gift = newGift();
    if (!hh) { box.hidden = true; giveHTML = ''; gift.pick = false; return; }
    if (gift.to !== null && (st.households[gift.to].dissolved || gift.to === hh.id)) gift.to = null;
    const max = Math.max(0, Math.floor(hh.grain - Sim.seedReserve(st, hh))), f = st.farmsteads[hh.farmstead];
    const kin = Sim.kinHouseholds(st, hh), village = st.liveHouseholds.filter((k) => k !== hh.id && !kin.includes(k)
      && st.farmsteads[st.households[k].farmstead].village === f.village);
    const opt = (k) => `<option value="${k}">${esc(householdName(st.households[k]))}</option>`;
    const group = (label, ids) => (ids.length ? `<optgroup label="${label}">${ids.map(opt).join('')}</optgroup>` : '');
    const chosen = gift.to !== null && !kin.includes(gift.to) && !village.includes(gift.to) ? [gift.to] : [];
    const to = gift.to !== null ? st.households[gift.to] : null;
    let h = `<h3>Give grain</h3><p class="hint">${esc(f.name)} holds ${max} ${max === 1 ? 'ration' : 'rations'} of grain above its seed.</p>`;
    h += `<div class="give-row"><label>To <select id="giveTo"><option value="">Choose a household</option>${group('Kin', kin)}${
      group('Of the village', village)}${group('Chosen on the map', chosen)}</select></label>`
      + `<label>Rations <input id="giveN" type="number" inputmode="numeric" min="1" max="${max}" step="1"></label></div>`;
    if (to && to.holder === null) h += `<p class="hint">${esc(
      st.farmsteads[to.farmstead].name)} has no holder: the gift is given, but no goodwill is owed for it.</p>`;
    if (gift.warn) {
      const names = gift.warn.hungry.map((k) => Sim.fullName(st.pawns[k])).join(', ');
      h += `<p class="refused" role="alert">This leaves ${esc(f.name)} ${Math.ceil(
        gift.warn.below)} rations short of its floor, ${gift.warn.days} days of food `
        + `beside the seed. If food runs short, the last to be served ${gift.warn.hungry.length === 1 ? 'is' : 'are'} ${esc(names)}.</p>`
        + '<div class="switches"><button type="button" data-give="confirm">Give all the same</button>'
        + '<button type="button" data-give="cancel">Cancel</button></div>';
    } else {
      h += `<div class="switches"><button type="button" data-give="pick" aria-pressed="${gift.pick}">${
        gift.pick ? 'Click a farm or one of its people, or cancel' : 'Choose on the map'}</button>`
        + '<button type="button" class="primary" data-give="go">Give</button></div>';
    }
    if (gift.msg) h += `<p class="hint" role="status">${esc(gift.msg)}</p>`;
    box.hidden = false;
    if (h === giveHTML || (!force && box.contains(document.activeElement) && giveHTML)) return;
    giveHTML = h; box.innerHTML = h;
    $('giveTo').value = gift.to === null ? '' : String(gift.to); $('giveN').value = String(gift.n);
  }
  $('giveBox').addEventListener('change', (e) => {
    if (e.target.id === 'giveTo') { gift.to = e.target.value === '' ? null : +e.target.value; gift.warn = null; gift.msg = ''; renderGive(played(), true); }
  });
  $('giveBox').addEventListener('input', (e) => {
    if (e.target.id !== 'giveN') return;
    gift.n = +e.target.value;
    if (gift.warn || gift.msg) { gift.warn = null; gift.msg = ''; renderGive(played(), true); $('giveN').focus(); }
  });
  function queueGift(id) {
    const r = Sim.queue(st, { actor: id, verb: 'give', target: gift.to, args: { good: 'grain', n: gift.n } });
    gift.msg = r === true ? `Queued: ${gift.n} grain to ${st.farmsteads[st.households[gift.to].farmstead].name}.` : r;
    gift.warn = null;
  }
  $('giveBox').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-give]'), id = st ? played() : -1, hh = b && id >= 0 ? givesFor(id) : null;
    if (!hh) return;
    const act = b.dataset.give, max = Math.max(0, Math.floor(hh.grain - Sim.seedReserve(st, hh)));
    e.stopPropagation();
    gift.msg = '';
    if (act === 'pick') { gift.pick = !gift.pick; walkPick = false; }
    else if (act === 'cancel') gift.warn = null;
    else if (gift.to === null) gift.msg = 'Choose a household to give to.';
    else if (!(Number.isInteger(gift.n) && gift.n >= 1 && gift.n <= max)) gift.msg = `Give a whole number of rations, from 1 to ${max}.`;
    else if (act === 'confirm') queueGift(id);
    else { gift.warn = Sim.giftWarning(st, hh, gift.n); if (!gift.warn) queueGift(id); }
    renderActions(); renderGive(id, true);
  });
  // "Choose on the map": the next click names the household, by one of its people, its farm's name, or a tile of its land or its house
  // (page/tileinfo asks first). Anything else says so and waits for another click.
  function pickGift(pw, named, i) {
    const id = played(), own = givesFor(id);
    if (!own) { gift.pick = false; return; }
    const land = i >= 0 ? Sim.ownerOf(st, i) : null, house = i >= 0 ? st.farmsteads.find((f) => f.house === i) : null;
    const k = pw >= 0 ? st.pawns[pw].household : named && named.farm !== undefined ? st.farmsteads[named.farm].household
      : house ? house.household : land && land.type === 'household' ? land.id : null;
    if (k === null || k === undefined || st.households[k].dissolved ||
      k === own.id) gift.msg = 'No other household there: click a farm, its land or one of its people.';
    else { gift.to = k; gift.pick = false; gift.warn = null; gift.msg = ''; }
    renderGive(id, true);
  }
  function playAs(id) {
    const r = Sim.inhabit(st, id);
    playMsg = r === true ? null : { id, text: r }; walkPick = false;
    return r;
  }
  $('playBox').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-play]');
    const id = played();
    if (!b || !st || id < 0) return;
    const act = b.dataset.play;
    let r = true;
    if (act === 'find') { focusPawn(id); openPanel('actions'); }
    else if (act === 'auto') r = Sim.setAuto(st, !st.player.auto);
    else if (act === 'answer') { r = Sim.answer(st, +b.dataset.offer, b.dataset.yes === 'true'); watchOffers(); }
    else if (act === 'follow') followPlayed = !followPlayed;
    else if (act === 'walk') { walkPick = !walkPick; gift.pick = false; }
    else if (act === 'unqueue') r = Sim.unqueue(st, +b.dataset.i);
    else if (act === 'wish') r = Sim.wish(st, b.dataset.kind, JSON.parse(b.dataset.value));
    else if (act === 'do') {
      const c = JSON.parse(b.dataset.cmd);
      r = Sim.queue(st, { actor: id, verb: c.verb, target: c.target, args: c.verb === 'idle' ? { until: st.t + 1 } : c.args || null });
    }
    playMsg = r === true ? null : { id, text: r };
    renderActions();
  });
  // "Walk here": the next tile clicked on the map, if open; a closed one says why and waits for another (page/tileinfo asks first).
  function pickWalk(i) {
    const id = played();
    if (id < 0) { walkPick = false; return; }
    const o = i >= 0 ? Sim.opportunities(st, id, i).find((x) => x.verb === 'walkTo') : null;
    if (!o || o.why) playMsg = { id, text: `${o ? o.why : 'no one can walk there'}: choose an open tile` };
    else { const r = Sim.queue(st, { actor: id, verb: 'walkTo', target: i }); walkPick = false; playMsg = r === true ? null : { id, text: r }; }
    renderActions();
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
    const x = a.inside ? w.hx[f.house] : drawX[id], y = a.inside ? w.hy[f.house] - 16 : drawY[id] - 22 * PAWN_S * sizeAt(p.age);
    const tip = y - 3 * k, top = tip - 12 * k;
    playMark.poly([x, tip, x - 7 * k, top, x + 7 * k, top]).fill({ color: 0xf2c14e }).stroke({ width: 1.6 * k, color: 0x2c201c });
  }
  // After the played pawn's death (VB-213): the page pauses once, and a box offers those the player may go on as, the heir first, for as
  // long as the choice is open; the world does not wait, so the list is read again twice a second. With none alive, any adult's card
  // offers "Go on as", and the break is recorded. Called each frame (page/animate).
  function offerSuccession() {
    const box = $('succession'), pl = st && st.player, dead = pl && st.pawns[pl.pawn].died !== null ? pl.pawn : -1;
    const noSkip = played() < 0; if ($('skipBtn').hidden !== noSkip) $('skipBtn').hidden = noSkip; // Skip is offered while a pawn is played
    if (dead < 0) { if (!box.hidden) box.hidden = true; succFor = -1; return; }
    const now = performance.now();
    if (succFor !== dead) { succFor = dead; succAt = 0; followPlayed = false; walkPick = false; document.querySelector('[data-speed="0"]').click(); }
    if (now - succAt < 500 && !box.hidden) return;
    succAt = now;
    const list = Sim.successors(st, dead);
    let h = `<span><b>${esc(Sim.fullName(st.pawns[dead]))} has died.</b> ${list.length ? 'Go on as:'
      : 'None of its heirs, kin, household or friends is alive: a break in the line. Open any adult and choose “Go on as”.'}</span>`;
    if (list.length) h += `<ul>${list.map((s) => { const q = st.pawns[s.id]; return `<li><button type="button" data-succeed="${s.id}">${
      esc(Sim.fullName(q))}<i>${esc(s.why)}, ${Sim.age(st, q)}</i></button></li>`; }).join('')}</ul>`;
    if (h !== succHTML) { succHTML = h; box.innerHTML = h; }
    box.hidden = false;
  }
  $('succession').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-succeed]');
    if (!b || !st) return;
    const id = +b.dataset.succeed, r = Sim.succeed(st, id);
    succAt = 0;
    if (r === true) { playMsg = null; focusPawn(id); openPanel('actions'); } // refused only if it died meanwhile: the list is read again at once
  });
  // Skip to the next event (VB-234): the run goes ahead at the uncapped speed (page/speed asks Sim.skipStop after each step) until
  // something concerns the played pawn, at the latest the eve of the moving round; then the page pauses, the camera goes to what happened
  // and a note says why, until it is clicked or the next skip begins. The simulation does nothing differently for it.
  let skipNote = null;
  function dropSkipNote() { if (skipNote) { skipNote.remove(); skipNote = null; } }
  function startSkip() {
    if (played() < 0 || building || skipping) return;
    const back = speed === 0 ? lastSpeed : speed;
    dropSkipNote(); setSpeed(Infinity); lastSpeed = back === Infinity ? 1 : back; // Play after the stop resumes at the speed before the skip
    skipCursor = Sim.skipFrom(st); $('skipBtn').setAttribute('aria-pressed', 'true');
  }
  function endSkip(stop) {
    const ev = stop.ev, id = st.player ? st.player.pawn : -1, f = ev && ev.farm !== undefined ? st.farmsteads[ev.farm] : null;
    setSpeed(0);
    if (f) flyTo(w.hx[f.house], w.hy[f.house]);
    else if (ev && ev.pawn !== undefined && st.pawns[ev.pawn].died === null) focusPawn(ev.pawn);
    else if (id >= 0 && st.pawns[id].died === null) focusPawn(id);
    skipNote = document.createElement('button');
    skipNote.type = 'button'; skipNote.className = 'toast panel skip-note'; skipNote.id = 'skipNote'; skipNote.dataset.why = stop.why;
    const c = Sim.cal(st.t);
    skipNote.textContent = `Skip stopped, ${Sim.SEASONS[c.season]} day ${c.sday + 1}, year ${c.year}: ${stop.text}`;
    skipNote.addEventListener('click', dropSkipNote);
    $('toasts').appendChild(skipNote);
  }
  $('skipBtn').addEventListener('click', () => { if (skipCursor) setSpeed(0); else startSkip(); });
