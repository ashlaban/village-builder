// @sys page/play: playing a pawn (VB-210): Play as, the played pawn's part of its card, its sheet (its state and queue; its acts are the
// action bar's, page/actbar), Follow, its map mark; after its death, whom the player may go on as (VB-213)
// ======== playing a pawn ========
// Which pawn is played, its queue and its switch are the run's (st.player, written only through Sim.inhabit, uninhabit, queue, unqueue and
// setAuto). Following it with the camera and the last message are the page's own state, never saved.
let followPlayed = false,
  playMsg = null,
  playHTML = '',
  succFor = -1,
  succAt = 0,
  succHTML = '';
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
const clockOf = (t) => {
  const m = Math.floor(Sim.cal(t).hour * 60 + 1e-6);
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};
const holderName = (o) =>
  !o ? '' : o.type === 'village' ? st.villages[o.id].name : st.farmsteads[st.households[o.id].farmstead].name;
const VERB_WORDS = {
  work: 'Work',
  walkTo: 'Walk to a tile',
  goHome: 'Go home',
  idle: 'Idle',
  argue: 'Argue for a cause',
  dropCause: 'Drop the cause',
  leave: 'Move out to new land',
  claim: 'Claim an empty farm',
  serve: 'Take service',
  give: 'Give grain',
};
// A command in words: a queued one, or an opportunity (which also has its kind and holder).
function commandWords(c) {
  if (c.verb === 'work') {
    const j = st.jobs.get(c.target),
      kind = c.kind || (j && j.kind),
      owner = c.holder || (j && j.owner);
    return `${kind ? Sim.KINDS[kind].name : 'Work'}${owner ? ` for ${holderName(owner)}` : ''}`;
  }
  if (c.verb === 'idle')
    return c.args && c.when === undefined ? `Idle until ${clockOf(c.args.until)}` : 'Idle for an hour';
  if (c.verb === 'walkTo') return c.target === null ? 'Walk here' : 'Walk to a tile';
  if (c.verb === 'argue') {
    const d = Culture.DIMS[c.args.dim];
    return `${d.label}: ${d.opts[c.args.option][1].toLowerCase()}`;
  }
  if (c.verb === 'dropCause') return `Drop the cause: ${Culture.DIMS[c.args.dim].label.toLowerCase()}`;
  if (c.verb === 'claim') return `Claim ${st.farmsteads[c.target].name}`;
  if (c.verb === 'give' && Number.isInteger(c.target))
    return `Give ${c.args.n} grain to ${st.farmsteads[st.households[c.target].farmstead].name}`;
  if (c.verb === 'serve')
    return c.target === null ? 'Take service' : `Take service at ${holderName({ type: 'household', id: c.target })}`;
  return VERB_WORDS[c.verb] || c.verb;
}
const BASIS = { member: 'as a member', servant: 'as a servant', villager: 'as a villager', self: 'for yourself' };
// An opportunity the round carries out for a pawn that wishes it (roundBox): read-only, with the reason it may not be taken now or its basis.
function oppRow(o) {
  return `<li class="opp${o.why ? ' barred' : ''}"><span>${esc(commandWords(o))}</span><i>${esc(o.why || BASIS[o.basis])}</i></li>`;
}
// The moving round's acts (VB-212): the player's wishes for its pawn, st.player.wishes, set through Sim.wish and kept until changed. A
// wish may always be made; the round decides by its rules, so each act says what bars it now, the wishes counted in.
function roundBox(id, acts, wishes) {
  const pick = (kind, value, label, on = wishes[kind] === value) =>
    `<button type="button" data-play="wish" data-kind="${kind}" data-value="${esc(JSON.stringify(value))}" aria-pressed="${on}">${label}</button>`;
  const leave = acts.find((o) => o.verb === 'leave'),
    farms = acts.filter((o) => o.verb === 'claim'),
    serve = acts.filter((o) => o.verb === 'serve');
  const own =
    wishes.out === null ? '' : ` On your own you would ${leave.own ? `stay: ${esc(leave.own)}` : 'move out'}.`;
  let h = '<h4>At the moving round <span>your wishes; the round decides by its rules</span></h4>';
  if (Sim.spouseOf(st, id) !== null)
    h += '<p class="hint">A couple moves together, and your spouse has wishes too.</p>';
  h += `<h5>Moving out</h5><div class="switches">${pick('out', null, 'As you would')}${pick('out', true, 'Move out')}${pick('out', false, 'Stay')}</div>`;
  h += `<p class="hint">${
    leave.why
      ? `You stay now: ${esc(leave.why)}.`
      : 'You are counted among those who want land: a farm, a plot, new land or service may come of it.'
  }${own}</p>`;
  h += `<h5>An empty farm</h5><div class="switches">${pick('claim', null, 'Any you may')}${pick('claim', false, 'None')}</div>`;
  h += farms.length
    ? `<ul class="opps">${farms
        .map(
          (o) =>
            `<li><button type="button" class="opp" data-play="wish" data-kind="claim" data-value="${
              o.target
            }" aria-pressed="${wishes.claim === o.target}">Only ${esc(st.farmsteads[o.target].name)}<i>${esc(
              o.why || 'the round gives it to the first claimant',
            )}</i></button></li>`,
        )
        .join('')}</ul>`
    : '<p class="hint">No farm of your village stands empty.</p>';
  h += `<h5>Service</h5><div class="switches">${pick('serve', null, 'As you would', wishes.serve !== false)}${pick('serve', false, 'Decline')}</div>`;
  h += `<ul class="opps">${serve.map((o) => oppRow(o)).join('')}</ul>`;
  const partners = acts.filter((o) => o.verb === 'match' && o.target !== null);
  if (acts.some((o) => o.verb === 'match')) {
    h += `<h5>A match</h5><div class="switches">${pick('match', null, 'As you would')}${pick('match', false, 'Not this year')}</div>`;
    h += partners.length
      ? `<ul class="opps">${partners
          .map(
            (o) =>
              `<li><button type="button" class="opp" data-play="wish" data-kind="match" data-value="${
                o.target
              }" aria-pressed="${wishes.match === o.target}">${esc(o.partner.name)}, ${o.partner.age}<i>${esc(
                o.why || 'offered at the round, as your own yes',
              )}</i></button></li>`,
          )
          .join('')}</ul>`
      : '<p class="hint">You know no unmarried one you might wed.</p>';
  }
  return h;
}
// The cause the pawn argues, when it ends, and how the village leaned on that custom at the last meeting: the cause's share of the support
// against the practice's, and the margin it must pass (meeting: the practice's share times 1 + margin, more where there are few voices).
function causeNote(p) {
  const a = p.advocate;
  if (!a) return '<p class="hint">You argue no cause.</p>';
  const d = Culture.DIMS[a.dim],
    s = st.cenv.settlements[Sim.settlementIdOf(st, p)],
    sup = s && s.lastSupport;
  let h = `<p class="cause">You argue for “${esc(d.opts[a.opt][1])}” (${esc(d.label.toLowerCase())}) for ${Math.max(
    0,
    a.until - st.cenv.t,
  ).toFixed(1)} more years.`;
  if (sup) {
    const o = Culture.OFF[a.dim],
      x = s.practice[a.dim],
      cust = s.culture !== undefined ? st.cenv.cultures[s.culture].customs[a.dim] : x;
    const voices = Sim.membersOf(st, s.id).filter((q) => Sim.voiceOf(st, q, s) > 0).length;
    const need = x === a.opt ? 0 : Culture.fewVoices(voices) * Culture.margin(s, x, a.opt, cust);
    h +=
      x === a.opt
        ? ' It is the village practice.'
        : ` At the last meeting “${esc(d.opts[a.opt][1])}” had ${Math.round(sup[o + a.opt] * 100)}% of the ` +
          `support against ${Math.round(sup[o + x] * 100)}% for “${esc(d.opts[x][1])}”, the practice; it must pass it by ${Math.round(need * 100)}%.`;
  } else h += ' The village has not met yet.';
  return `${h}</p>`;
}
// The household's food in days of need: grain above the seed set aside, meals and the larder, over a day's rations of its living.
function foodDays(hh) {
  let need = 0;
  for (const m of hh.members) {
    const q = st.pawns[m];
    if (q.died === null) need += q.age >= 14 ? Sim.ECON.ration.adult : Sim.ECON.ration.child;
  }
  const food = Math.max(0, Sim.grainOf(hh) - Sim.seedReserve(st, hh)) + hh.meals + Sim.larderOf(hh);
  return need > 0 ? Math.floor(food / need) : null;
}
// A pawn's card says only how it stands to the player (Kim, 10 Nov: the played pawn is fixed, and changes at its death or by the Debug
// panel): the played pawn's card leads to its actions; after its death, its own card says so and a living pawn the player may go on
// as offers it (the list is the succession box's, below).
let cardPlayHTML = '';
function renderPlay(id) {
  const p = st.pawns[id],
    pl = st.player;
  let h = '';
  if (pl && st.pawns[pl.pawn].died !== null) {
    const list = Sim.successors(st, pl.pawn),
      may = p.died === null && (list.length ? list.some((s) => s.id === id) : p.age >= ADULT);
    if (pl.pawn === id) h = '<p class="hint">You played this pawn, who has died. Choose who to go on as.</p>';
    else if (may)
      h = `<button type="button" class="primary" id="playAs" data-card="succeed">Go on as ${esc(Sim.fullName(p))}</button>`;
  } else if (pl && pl.pawn === id)
    h = '<p class="hint">You play this pawn. <button type="button" data-card="actions">Your acts</button></p>';
  if (h !== cardPlayHTML) {
    cardPlayHTML = h;
    $('cardPlay').innerHTML = h;
  }
  $('cardPlay').hidden = !h;
}
$('cardPlay').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-card]');
  if (!b || !st || selPawn < 0) return;
  if (b.dataset.card === 'actions') {
    openBar(true);
    return;
  }
  const id = selPawn,
    r = Sim.succeed(st, id);
  succAt = 0;
  playMsg = r === true ? null : { id, text: r };
  if (r === true) openPanel('actions');
  else showPawn(id);
});
// The marriage offers that wait for the played pawn (VB-273), as questions above the queue, Yes and No calling Sim.answer; once the offer is
// answered or closed, how it ended (page/notices keeps offerEnd) until the next offer or the next moving round.
function offerBox(id, opps) {
  const asks = opps.filter((o) => o.when === 'offer').map((o) => o.offer);
  let h = '';
  for (const o of asks) {
    const one = (w) => `${esc(w.name)}, ${w.age}${w.farm ? `, of ${esc(w.farm)}` : ''}`;
    const part =
      o.part === 'the one to marry'
        ? 'You are the one to marry.'
        : `You are head of the household of ${esc(Sim.fullName(st.pawns[o.for]))}.`;
    const said = o.answers.map((a) => `${esc(a.name)} said ${a.yes ? 'yes' : 'no'}`).join('; ');
    h +=
      `<div class="offer" role="group" aria-label="A marriage offer"><h3>A match is offered</h3>` +
      `<p>${one(o.man)} and ${one(o.woman)} would marry and live at ${esc(o.farm)}. ${part}</p>` +
      `<p class="hint">${said ? `${said}. ` : ''}${o.daysLeft} ${
        o.daysLeft === 1 ? 'day' : 'days'
      } left; unanswered, it is answered as you would unplayed.</p>` +
      `<div class="switches"><button type="button" class="primary" data-play="answer" data-offer="${o.id}" data-yes="true">Yes</button>` +
      `<button type="button" data-play="answer" data-offer="${o.id}" data-yes="false">No</button></div></div>`;
  }
  if (offerEnd && offerEnd.pawn === id && st.t < offerEnd.until)
    h += `<p class="hint offer-end" role="status">${esc(offerEnd.text)}</p>`;
  return h;
}
// The played pawn's sheet (the action bar's Queue, VB-341): its state, its switches, the offers that wait for its answer, its queue and the
// last refusal; what it may do is the action bar's (page/actbar). Rebuilt while the sheet or the bar's list is open, at most four times a
// second (page/animate), and Sim.opportunities is called once per rebuild, for both.
function renderActions() {
  const id = played(),
    pl = st && st.player;
  if ($('actionsBtn').hidden !== id < 0) {
    $('actionsBtn').hidden = id < 0;
    $('agendaBtn').hidden = id < 0;
  }
  if (id < 0) {
    if (activePanel === 'actions') openPanel(null);
    closeBar();
    return;
  }
  const sheet = activePanel === 'actions',
    opps = sheet || barMenu || tool ? Sim.opportunities(st, id) : null;
  renderBar(id, opps);
  if (!sheet) return;
  const p = st.pawns[id];
  let h = '';
  const hh = p.household !== null ? st.households[p.household] : null,
    f = hh ? st.farmsteads[hh.farmstead] : null;
  const days = hh ? foodDays(hh) : null,
    wood = hh ? Math.round(hh.wood) : 0;
  const food = !hh
    ? ''
    : ` ${esc(f.name)}: food for ${days === null ? 'no one' : `${days} ${days === 1 ? 'day' : 'days'}`}, firewood ${wood} ${
        wood === 1 ? 'load' : 'loads'
      }.`;
  h += `<div class="play-head"><h3>You play ${esc(Sim.fullName(p))}</h3><button type="button" data-play="find">Find</button></div>`;
  h += `<p class="needs">Hunger ${Math.round(p.hunger * 100)}%, health ${Math.round(p.health)}.${food}</p>`;
  h += `<p class="doing">Doing: ${esc(Sim.describe(st, id))}</p>`;
  h +=
    `<div class="switches"><button type="button" data-play="auto" aria-pressed="${pl.auto}">Automatic behaviour ${pl.auto ? 'on' : 'off'}</button>` +
    `<button type="button" data-play="follow" aria-pressed="${followPlayed}">Follow</button></div>`;
  h += offerBox(id, opps);
  h += '<h3>Queue</h3>';
  h += pl.queue.length
    ? `<ol class="queue">${pl.queue
        .map(
          (c, i) =>
            `<li><span>${esc(commandWords(c))}${c.begun !== null ? ' <i>under way</i>' : ''}</span>` +
            `<button type="button" data-play="unqueue" data-i="${i}" aria-label="Remove ${esc(commandWords(c))}">Remove</button></li>`,
        )
        .join('')}</ol>`
    : `<p class="hint">${
        pl.auto
          ? 'Nothing queued: you do what your role would.'
          : 'Nothing queued, and your automatic behaviour is off: you wait, and go home at dark.'
      }</p>`;
  if (pl.refused)
    h += `<p class="refused">Refused at ${clockOf(pl.refused.t)}: ${esc(
      VERB_WORDS[pl.refused.verb] || pl.refused.verb,
    )}, ${esc(pl.refused.why)}</p>`;
  h +=
    '<p class="hint">What you may do is in the bar over the dock: Myself, Household and Village. The cause you argue is under Agenda, in the dock.</p>';
  const rest = playMsg && playMsg.id === id ? `<p class="refused" role="status">${esc(playMsg.text)}</p>` : '';
  if (h + '\n' + rest !== playHTML) {
    playHTML = h + '\n' + rest;
    $('playTop').innerHTML = h;
    $('playRest').innerHTML = rest;
  }
}
function playAs(id) {
  const r = Sim.inhabit(st, id);
  playMsg = r === true ? null : { id, text: r };
  endTool();
  return r;
}
// A button of the sheet or of the bar's lists marked data-play: a switch, an answer, a wish, or an opportunity to queue (data-cmd). The
// refusal, if any, is the sheet's message; the bar shows its own (page/actbar). True, or why not.
function playClick(b) {
  const id = played(),
    act = b.dataset.play;
  let r = true;
  if (act === 'find') {
    focusPawn(id);
    openPanel('actions');
  } else if (act === 'auto') r = Sim.setAuto(st, !st.player.auto);
  else if (act === 'answer') {
    r = Sim.answer(st, +b.dataset.offer, b.dataset.yes === 'true');
    watchOffers();
  } else if (act === 'follow') followPlayed = !followPlayed;
  else if (act === 'unqueue') r = Sim.unqueue(st, +b.dataset.i);
  else if (act === 'wish') r = Sim.wish(st, b.dataset.kind, JSON.parse(b.dataset.value));
  else if (act === 'do') {
    const c = JSON.parse(b.dataset.cmd);
    r = Sim.queue(st, {
      actor: id,
      verb: c.verb,
      target: c.target,
      args: c.verb === 'idle' ? { until: st.t + 1 } : c.args || null,
    });
  }
  playMsg = r === true ? null : { id, text: r };
  return r;
}
$('playBox').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-play]');
  if (!b || !st || played() < 0) return;
  playClick(b);
  renderActions();
});
// Follow: the camera stays on the played pawn, or its house while it is indoors; dragging the map lets go (page/input).
function followCamera() {
  const id = played();
  if (id < 0) {
    followPlayed = false;
    return;
  }
  const a = st.agents[id],
    f = farmOf(st.pawns[id]);
  if (a.inside && !f) return;
  cam.x = a.inside ? w.hx[f.house] : a.x;
  cam.y = a.inside ? w.hy[f.house] : a.y;
  vel.x = vel.y = 0;
}
// The played pawn's mark on the map: a gold pointer over its head, or over its house while it is indoors, the same size on screen at
// any zoom, so it can be found among the others and from afar.
function drawPlayMark() {
  playMark.clear();
  const id = played();
  if (id < 0 || document.body.classList.contains('ui-hidden')) return;
  const p = st.pawns[id],
    a = st.agents[id],
    f = farmOf(p),
    k = 1 / Math.max(cam.z, 0.12);
  if (a.inside && !f) return;
  const x = a.inside ? w.hx[f.house] : drawX[id],
    y = a.inside ? w.hy[f.house] - 16 : drawY[id] - 22 * PAWN_S * sizeAt(p.age);
  const tip = y - 3 * k,
    top = tip - 12 * k;
  playMark
    .poly([x, tip, x - 7 * k, top, x + 7 * k, top])
    .fill({ color: 0xf2c14e })
    .stroke({ width: 1.6 * k, color: 0x2c201c });
}
// After the played pawn's death (VB-213): the page pauses once, and a box offers those the player may go on as, the heir first, for as
// long as the choice is open; the world does not wait, so the list is read again twice a second. With none alive, any adult's card
// offers "Go on as", and the break is recorded. Called each frame (page/animate).
function offerSuccession() {
  const box = $('succession'),
    pl = st && st.player,
    dead = pl && st.pawns[pl.pawn].died !== null ? pl.pawn : -1;
  const noSkip = played() < 0;
  if ($('skipBtn').hidden !== noSkip) $('skipBtn').hidden = noSkip; // Skip is offered while a pawn is played
  if (dead < 0) {
    if (!box.hidden) box.hidden = true;
    succFor = -1;
    return;
  }
  const now = performance.now();
  if (succFor !== dead) {
    succFor = dead;
    succAt = 0;
    followPlayed = false;
    endTool();
    document.querySelector('[data-speed="0"]').click();
  }
  if (now - succAt < 500 && !box.hidden) return;
  succAt = now;
  const list = Sim.successors(st, dead);
  let h = `<span><b>${esc(Sim.fullName(st.pawns[dead]))} has died.</b> ${
    list.length
      ? 'Go on as:'
      : 'None of your heirs, kin, household or friends is alive: a break in the line. Open any adult and choose “Go on as”.'
  }</span>`;
  if (list.length)
    h += `<ul>${list
      .map((s) => {
        const q = st.pawns[s.id];
        return `<li><button type="button" data-succeed="${s.id}">${esc(
          Sim.fullName(q),
        )}<i>${esc(s.why)}, ${Sim.age(st, q)}</i></button></li>`;
      })
      .join('')}</ul>`;
  if (h !== succHTML) {
    succHTML = h;
    box.innerHTML = h;
  }
  box.hidden = false;
}
$('succession').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-succeed]');
  if (!b || !st) return;
  const id = +b.dataset.succeed,
    r = Sim.succeed(st, id);
  succAt = 0;
  if (r === true) {
    playMsg = null;
    focusPawn(id);
    openPanel('actions');
  } // refused only if it died meanwhile: the list is read again at once
});
// Skip to the next event (VB-234): the run goes ahead at the uncapped speed (page/speed asks Sim.skipStop after each step) until
// something concerns the played pawn, at the latest the eve of the moving round; then the page pauses, the camera goes to what happened
// and a note says why, until it is clicked or the next skip begins. The simulation does nothing differently for it.
let skipNote = null;
function dropSkipNote() {
  if (skipNote) {
    skipNote.remove();
    skipNote = null;
  }
}
function startSkip() {
  if (played() < 0 || building || skipping) return;
  const back = speed === 0 ? lastSpeed : speed;
  dropSkipNote();
  setSpeed(Infinity);
  lastSpeed = back === Infinity ? 1 : back; // Play after the stop resumes at the speed before the skip
  skipCursor = Sim.skipFrom(st);
  $('skipBtn').setAttribute('aria-pressed', 'true');
}
function endSkip(stop) {
  const ev = stop.ev,
    id = st.player ? st.player.pawn : -1,
    f = ev && ev.farm !== undefined ? st.farmsteads[ev.farm] : null;
  setSpeed(0);
  if (f) flyTo(w.hx[f.house], w.hy[f.house]);
  else if (ev && ev.pawn !== undefined && st.pawns[ev.pawn].died === null) focusPawn(ev.pawn);
  else if (id >= 0 && st.pawns[id].died === null) focusPawn(id);
  skipNote = document.createElement('button');
  skipNote.type = 'button';
  skipNote.className = 'toast panel skip-note';
  skipNote.id = 'skipNote';
  skipNote.dataset.why = stop.why;
  const c = Sim.cal(st.t);
  skipNote.textContent = `Skip stopped, ${Sim.SEASONS[c.season]} day ${c.sday + 1}, year ${c.year}: ${stop.text}`;
  skipNote.addEventListener('click', dropSkipNote);
  $('toasts').appendChild(skipNote);
}
$('skipBtn').addEventListener('click', () => {
  if (skipCursor) setSpeed(0);
  else startSkip();
});
