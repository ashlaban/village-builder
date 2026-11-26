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
const ADULT = 18; // a grown pawn: chosen first where the page picks one for the player
// Who may be played (VB-1121): any living pawn, a child too, the same rule wherever the player takes a pawn (Whom to play, the succession)
const mayPlay = (id) => !!st.pawns[id] && st.pawns[id].died === null;
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
  drink: 'Drink',
  argue: 'Argue for a cause',
  dropCause: 'Drop the cause',
  leave: 'Move out to new land',
  claim: 'Claim an empty farm',
  serve: 'Take service',
  give: 'Give grain',
  slander: 'Speak ill of someone',
  visit: 'Visit a village',
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
    const d = Customs.DIMS[c.args.dim];
    return `${d.label}: ${d.opts[c.args.option][1].toLowerCase()}`;
  }
  if (c.verb === 'dropCause') return `Drop the cause: ${Customs.DIMS[c.args.dim].label.toLowerCase()}`;
  if (c.verb === 'claim') return `Claim ${st.farmsteads[c.target].name}`;
  if (c.verb === 'give' && Number.isInteger(c.target))
    return `Give ${c.args.n} grain to ${st.farmsteads[st.households[c.target].farmstead].name}`;
  if (c.verb === 'call') return `Call at ${st.farmsteads[c.target].name}`;
  if (c.verb === 'slander' && Number.isInteger(c.target)) return `Speak ill of ${Sim.fullName(st.pawns[c.target])}`;
  if (c.verb === 'serve')
    return c.target === null ? 'Take service' : `Take service at ${holderName({ type: 'household', id: c.target })}`;
  return VERB_WORDS[c.verb] || c.verb;
}
const BASIS = { member: 'as a member', servant: 'as a servant', villager: 'as a villager', self: 'for yourself' };
// An opportunity the round carries out for a pawn that wishes it (roundBox): read-only, with the reason it may not be taken now or its basis.
function oppRow(o) {
  return `<li class="opp${o.why ? ' barred' : ''}"><span>${esc(commandWords(o))}</span><i>${esc(o.why || BASIS[o.basis])}</i></li>`;
}
// The moving round's acts (VB-212): the played pawn's wishes, on the pawn as every pawn's are (Sim.wishesOf, VB-680), set through Sim.wish
// and kept until changed. A wish may always be made; the round decides by its rules, so each act says what bars it now, the wishes counted in.
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
  // new land (VB-392): leading a party from a crowded village, or following a sibling who leads one
  const land = `${pick('settle', null, 'As you would')}${pick('settle', true, 'Lead or follow')}${pick('settle', false, 'Never')}`;
  h += `<h5>New land</h5><div class="switches">${land}</div>`;
  h += '<p class="hint">Only from a crowded village, with grain for the journey and land within reach.</p>';
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
const pc = (x) => `${Math.round(x * 100)}%`;
function causeNote(p) {
  const a = p.advocate;
  if (!a) return '<p class="hint">You argue no cause.</p>';
  const d = Customs.DIMS[a.dim],
    s = st.cenv.settlements[Sim.settlementIdOf(st, p)],
    sup = s && s.lastSupport;
  let h = `<p class="cause">You argue for “${esc(d.opts[a.opt][1])}” (${esc(d.label.toLowerCase())}) for ${Math.max(
    0,
    a.until - st.cenv.t,
  ).toFixed(1)} more years.`;
  if (sup) {
    const o = Customs.OFF[a.dim],
      x = s.practice[a.dim],
      cust = s.culture !== undefined ? st.cenv.cultures[s.culture].customs[a.dim] : x;
    const voices = Sim.membersOf(st, s.id).filter((q) => Sim.voiceOf(st, q, s) > 0).length;
    const need = x === a.opt ? 0 : Culture.fewVoices(voices) * Culture.margin(s, x, a.opt, cust);
    h +=
      x === a.opt
        ? ' It is the village practice.'
        : ` At the last meeting “${esc(d.opts[a.opt][1])}” had ${pc(sup[o + a.opt])} of the support against ` +
          `${pc(sup[o + x])} for “${esc(d.opts[x][1])}”, the practice; it needs ${pc(sup[o + x] * (1 + need))} of the voice to pass it.`;
    if (x !== a.opt) {
      const mark = [{ at: sup[o + x] * (1 + need) * 100, label: 'the share it needs', kind: 'head' }];
      h += `</p><div class="agenda-meters"><span>“${esc(d.opts[a.opt][1])}”</span>${meter({
        value: sup[o + a.opt] * 100,
        marks: mark,
        label: 'The cause',
        text: pc(sup[o + a.opt]),
      })}<span>“${esc(d.opts[x][1])}” (practice)</span>${meter({
        value: sup[o + x] * 100,
        label: 'The practice',
        text: pc(sup[o + x]),
      })}</div>`;
      return h;
    }
  } else h += ' The village has not met yet.';
  return `${h}</p>`;
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
    const next = Sim.successor(st, pl.pawn);
    if (pl.pawn === id)
      h = `<p class="hint">You played this pawn, who has died. ${
        next ? `You go on as ${esc(Sim.fullName(st.pawns[next.id]))}.` : 'The line has ended.'
      }</p>`;
    else if (next && next.id === id && pl.ended === null)
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
// What a yes to offer `oid` would bring, as pawn `by` reckons it (VB-1100; Sim.offerPreview: the offer settled on a copy of the state by
// the simulation's own rules), drawn before Yes and No, pictures before words: each who moves as its portrait, an arrow and the farm it
// goes to; each farm as its icon with its holder after (and the farm that holds it in trust, or empty); the home's first heir after; the
// home's food in days of need after, on the one meter, marked where it stands now. Computed once while the sheet is open (previews,
// cleared when it closes), never in a step.
const previews = new Map();
const farmOfHousehold = (h) => (h === null ? null : st.farmsteads[st.households[h].farmstead]);
function previewHTML(oid, by) {
  if (!previews.has(oid)) previews.set(oid, Sim.offerPreview(st, oid, by));
  const pv = previews.get(oid);
  if (!pv) return '';
  const name = (id) => Sim.fullName(st.pawns[id]),
    fname = (h) => (h === null ? 'no farm' : farmOfHousehold(h).name),
    farmPic = (h) => (h === null ? actIcon('no') : iconImg(farmIcon(farmOfHousehold(h)), 'fi'));
  const AS = { spouse: 'marries', child: 'a child, follows', ward: 'a ward, follows', kin: 'goes' };
  const moves = pv.moves
    .map((m) => {
      const said = `${name(m.pawn)}, ${st.pawns[m.pawn].age}, ${AS[m.as]} from ${fname(m.from)} to ${fname(m.to)}`;
      const pics = `${faceImg(m.pawn)}<span class="ico">${actIcon('walk')}</span>${farmPic(m.to)}`;
      return `<li class="pv-move" title="${esc(said)}" aria-label="${esc(said)}">${pics}</li>`;
    })
    .join('');
  const farms = pv.farms
    .map((f) => {
      const after = f.empty
        ? 'left empty'
        : f.trustee !== null
          ? `${name(f.holder)} holds it, ${fname(f.trustee)} keeps it in trust`
          : f.holder === f.before
            ? `${name(f.holder)} keeps it`
            : `${name(f.holder)} takes it over${f.guardian !== null ? `, ${name(f.guardian)} guardian` : ''}`;
      const said = `${fname(f.household)}: ${after}`,
        who = f.empty
          ? `<span class="ico">${actIcon('emptyfarm')}</span>`
          : faceImg(f.holder) +
            (f.trustee !== null ? `<span class="ico">${actIcon('home')}</span>${farmPic(f.trustee)}` : '');
      return `<li class="pv-farm" title="${esc(said)}" aria-label="${esc(said)}">${farmPic(f.household)}${who}</li>`;
    })
    .join('');
  const heir =
    pv.heir.after === null
      ? ''
      : `<li class="pv-heir" title="${esc(`First heir of ${fname(pv.home)} after: ${name(pv.heir.after)}`)}">${faceImg(pv.heir.after)}<small>heir</small></li>`;
  const food =
    pv.food.after === null
      ? ''
      : stat({
          icon: 'hunger',
          label: `Food at ${fname(pv.home)}`,
          value: `${pv.food.before ?? 0} → ${pv.food.after} days`,
          tone: pv.food.after < 30 ? 'warn' : '',
          meter: {
            value: pv.food.after,
            max: Math.max(Sim.YEAR_DAYS, pv.food.before ?? 0, pv.food.after), // a year of days, or more to show both
            text: `${pv.food.after} days after, ${pv.food.before ?? 0} now`,
            marks: [{ at: pv.food.before ?? 0, label: `now ${pv.food.before ?? 0} days` }],
          },
        });
  return (
    `<div class="preview" role="group" aria-label="What a yes would bring">` +
    `<p class="card-note">What a yes would bring, as ${esc(name(by))} reckons it${pv.lapses ? `: it would lapse, ${esc(pv.lapses)}` : ''}</p>` +
    (moves ? `<ul class="pv-row" aria-label="Who moves">${moves}</ul>` : '') +
    `<ul class="pv-row" aria-label="The farms after">${farms}${heir}</ul>${food}</div>`
  );
}
// The marriage offers that wait for the played pawn (VB-273), as questions above the queue, Yes and No calling Sim.answer; once the offer is
// answered or closed, how it ended (page/notices keeps offerEnd) until the next offer or the next moving round.
function offerBox(id, opps) {
  const asks = opps.filter((o) => o.when === 'offer').map((o) => o.offer);
  let h = '';
  for (const o of asks) {
    const one = (w) => `${esc(w.name)}, ${w.age}${w.farm ? `, of ${esc(w.farm)}` : ''}`;
    const match = o.basis === 'match',
      part =
        o.part === 'the one to marry'
          ? 'You are the one to marry.'
          : o.part === 'the one asked'
            ? 'You are the one asked.'
            : `You are head of the household of ${esc(Sim.fullName(st.pawns[o.for]))}.`;
    const said = o.answers.map((a) => `${esc(a.name)} said ${a.yes ? 'yes' : 'no'}`).join('; ');
    const title = match
      ? 'A match is offered'
      : o.basis === 'gift'
        ? 'A gift is offered'
        : o.basis === 'handover'
          ? 'The farm is handed on to you'
          : o.basis === 'inheritance'
            ? 'The farm is yours: take it up?'
            : 'You are asked';
    const body = match
      ? `${one(o.man)} and ${one(o.woman)} would marry and live at ${esc(o.farm)}.` +
        (o.terms
          ? ` Her side gives a dowry worth ${o.terms.dowry} rations; his books her a morning gift worth ${o.terms.gift}.`
          : '')
      : `${esc(o.text.charAt(0).toUpperCase() + o.text.slice(1))}.`;
    // the pawn's own judgement, as advice (principle "The future is someone's estimate": whose estimate it is)
    const advice =
      o.advice === null ? '' : ` ${esc(Sim.fullName(st.pawns[id]))} would answer ${o.advice ? 'yes' : 'no'}.`;
    h +=
      `<div class="offer" role="group" aria-label="${title}"><h3>${title}</h3>` +
      `<p>${body} ${part}</p>` +
      previewHTML(o.id, id) +
      `<p class="hint">${said ? `${said}. ` : ''}${o.daysLeft} ${
        o.daysLeft === 1 ? 'day' : 'days'
      } left; unanswered, it is answered as your pawn would.${advice}</p>` +
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
    pl = st && st.player,
    ctl = pl ? Sim.controlOf(st, pl.pawn) : null; // its switch, queue and last refusal (sim/controller)
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
  if (!sheet) {
    previews.clear(); // an offer's preview is reckoned again when the sheet is next shown
    return;
  }
  const p = st.pawns[id];
  let h = '';
  const hh = p.household !== null ? st.households[p.household] : null,
    f = hh ? st.farmsteads[hh.farmstead] : null;
  h += `<div class="play-head"><h3>You play ${esc(Sim.fullName(p))}</h3><button type="button" data-play="find">Find</button></div>`;
  // the pawn's levels and its household's supplies, as its card and the farm's show them (VB-664: one meter; VB-667: one supply component)
  h += `<div class="needs">${pawnStats(id)}${hh ? `<h3 class="card-sec">${esc(f.name)}</h3>${suppliesHTML(Sim.supplyOutlook(st, hh.id))}` : ''}</div>`;
  h += `<p class="doing">Doing: ${esc(Sim.describe(st, id))}</p>`;
  const why = Sim.reasonLine(st, id); // as its card says it (VB-1551)
  if (why) h += `<p class="doing reason">${esc(why)}</p>`;
  h += afterYouHTML(id, f);
  // what its last act brought, what moved its levels over its last days, and who of its household ails, as kin see it (VB-1118)
  const notes = Sim.sheetNotes(st);
  if (notes.ailing.length) h += `<p class="refused">${notes.ailing.map(esc).join(' ')}</p>`;
  if (notes.yielded) h += `<p class="doing">Last done: ${esc(notes.yielded)}</p>`;
  if (notes.moved.length) h += `<ul class="moved">${notes.moved.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>`;
  // its winter's visit (VB-292): planned, with the day it sets out; under way, with the days left by its own pack (principle "The future is someone's
  // estimate")
  const vs = Sim.visitState(st, id);
  if (vs) {
    const place = esc(st.villages[vs.village].name),
      c = Sim.cal(vs.due || 0);
    h += `<p class="doing">${
      vs.state === 'planned'
        ? `A visit to ${place} is planned: you set out on ${Sim.SEASONS[c.season].toLowerCase()} day ${c.sday + 1}.`
        : `On a visit to ${place}: ${vs.daysLeft} ${vs.daysLeft === 1 ? 'day' : 'days'} left, by your pack.`
    }</p>`;
  }
  h +=
    `<div class="switches"><button type="button" data-play="auto" aria-pressed="${ctl.auto}">Automatic behaviour ${ctl.auto ? 'on' : 'off'}</button>` +
    `<button type="button" data-play="follow" aria-pressed="${followPlayed}">Follow</button></div>`;
  h += offerBox(id, opps);
  h += '<h3>Queue</h3>';
  h += ctl.queue.length
    ? `<ol class="queue">${ctl.queue
        .map(
          (c, i) =>
            `<li><span>${esc(commandWords(c))}${c.begun !== null ? ' <i>under way</i>' : ''}</span>` +
            `<button type="button" data-play="unqueue" data-i="${i}" aria-label="Remove ${esc(commandWords(c))}">Remove</button></li>`,
        )
        .join('')}</ol>`
    : `<p class="hint">${
        ctl.auto
          ? 'Nothing queued: you do what your role would.'
          : 'Nothing queued, and your automatic behaviour is off: you wait, and go home at dark.'
      }</p>`;
  if (ctl.refused)
    h += `<p class="refused">Refused at ${clockOf(ctl.refused.t)}: ${esc(
      VERB_WORDS[ctl.refused.verb] || ctl.refused.verb,
    )}, ${esc(ctl.refused.why)}</p>`;
  h +=
    '<p class="hint">What you may do is in the bar over the dock: Myself, Household and Village. The cause you argue is under Agenda, in the dock.</p>';
  const rest = playMsg && playMsg.id === id ? `<p class="refused" role="status">${esc(playMsg.text)}</p>` : '';
  if (h + '\n' + rest !== playHTML) {
    playHTML = h + '\n' + rest;
    $('playTop').innerHTML = h;
    $('playRest').innerHTML = rest;
  }
}
// The camera brought to pawn id's farm (VB-1027): where a player starts, whatever errand the pawn is on at that hour.
function flyToFarmOf(id) {
  const f = farmOf(st.pawns[id]);
  if (f) flyTo(w.hx[f.house], w.hy[f.house]);
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
  } else if (act === 'auto') r = Sim.setAuto(st, !Sim.controlOf(st, st.player.pawn).auto);
  else if (act === 'answer') {
    r = Sim.answer(st, +b.dataset.offer, b.dataset.yes === 'true');
    watchOffers();
  } else if (act === 'follow') followPlayed = !followPlayed;
  else if (act === 'unqueue') r = Sim.unqueue(st, +b.dataset.i);
  else if (act === 'wish') r = Sim.wish(st, b.dataset.kind, JSON.parse(b.dataset.value));
  else if (act === 'visit') r = Sim.orderVisit(st, +b.dataset.who, +b.dataset.village);
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
  const [x, y] = Sim.placeOf(st, a); // a walker's place from its leg (VB-473)
  cam.x = a.inside ? w.hx[f.house] : x;
  cam.y = a.inside ? w.hy[f.house] : y;
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
// After the played pawn's death (VB-213, VB-1121): the page pauses once, and a box shows whom the player now plays, its successor by the
// customs (Sim.successor), read again twice a second, since the world does not wait. With no one of the line alive the game has ended:
// the box shows the line's summary (endSummary), with the way back to the main menu and to watching the island on. Called each frame
// (page/animate).
// Whom the player goes on as after its pawn (VB-1121), worked out beforehand, by its village's custom; a change of it (a birth, a death, a
// change of custom) is told on the sheet until another pawn is played.
let heirWas = { id: -1, heir: -1, note: '' };
function afterYouHTML(id, f) {
  const next = Sim.successor(st, id),
    heir = next ? next.id : null;
  if (heirWas.id !== id) heirWas = { id, heir, note: '' };
  else if (heirWas.heir !== heir) {
    heirWas.note =
      heir === null ? 'No one of your line is left now.' : `Your successor is now ${Sim.fullName(st.pawns[heir])}.`;
    heirWas.heir = heir;
  }
  const by = f ? ` by ${st.villages[f.village].name}'s custom` : '';
  return `<p class="posline">${sign('next')}<span>${
    next
      ? `After you: ${esc(Sim.fullName(st.pawns[heir]))}, your ${esc(next.why)}${esc(by)}`
      : 'After you: no one of your line; the game would end'
  }</span></p>${heirWas.note ? `<p class="refused" role="status">${esc(heirWas.note)}</p>` : ''}`;
}
// The successor's position as Whom to play shows it (holds a farm, first heir to one, a child, retired), the farms an heir is heir to named.
function successorPlace(id, why) {
  const k = positionName(id),
    farms = heirTo(id).map((f) => f.name);
  return k ? (farms.length ? `${k} to ${farms.join(', ')}` : k) : why;
}
function offerSuccession() {
  const box = $('succession'),
    pl = st && st.player,
    dead = pl && st.pawns[pl.pawn].died !== null ? pl.pawn : -1;
  const noSkip = played() < 0;
  if ($('skipBtn').hidden !== noSkip) $('skipBtn').hidden = noSkip; // Skip is offered while a pawn is played
  if ($('taskBtn').hidden !== noSkip) $('taskBtn').hidden = noSkip; // and Until my task ends (VB-477)
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
  const next = pl.ended === null ? Sim.successor(st, dead) : null;
  let h = `<span><b>${esc(Sim.fullName(st.pawns[dead]))} has died.</b></span>`;
  if (next) {
    const q = st.pawns[next.id];
    h += `<p>You now play ${esc(Sim.fullName(q))}, ${heShe(dead)} ${esc(next.why)}, ${Sim.age(st, q)}${
      q.age < ADULT ? `: a child, who ${esc(childLine(next.id))}` : ''
    }.</p><button type="button" class="primary" data-succeed="${next.id}">Go on as ${esc(q.given)}</button>`;
  } else h += endSummary(dead);
  if (h !== succHTML) {
    succHTML = h;
    box.innerHTML = h;
  }
  box.hidden = false;
}
const heShe = (id) => (st.pawns[id].sex === 'f' ? 'her' : 'his');
// What a child successor may do, and who holds the farm meanwhile and until when (the widow for life, kin in trust: the household's
// holder, or the trust the farm is held in), read from the state.
function childLine(id) {
  const p = st.pawns[id],
    hh = p.household !== null ? st.households[p.household] : null,
    holder = hh && hh.holder !== null && hh.holder !== id ? st.pawns[hh.holder] : null,
    grown = Math.ceil(ADULT - p.age);
  return `helps at home and may not marry, take service or claim land until grown, in ${grown} ${grown === 1 ? 'year' : 'years'}${
    holder ? `; ${Sim.fullName(holder)} holds ${farmOf(p) ? farmOf(p).name : 'the farm'} meanwhile` : ''
  }`;
}
// The end of the game (VB-1121): the line's pawns in order with their years, the farms they held, and the island's people and villages
// when the line began and now, from the record and the state; no score. Read once, when the box is drawn.
function endSummary(dead) {
  const evs = Sim.recordOf(st, { kinds: ['player'] }).filter((e) => e.text === 'Played by the player'),
    line = [];
  for (const e of evs) if (!line.includes(e.pawn)) line.push(e.pawn);
  if (!line.includes(dead)) line.push(dead);
  const t0 = evs.length ? evs[0].t : 0,
    yr = (t) => Sim.cal(t).year + 1,
    held = new Set(line),
    farms = [
      ...new Set(
        Sim.recordOf(st, { kinds: ['inherited', 'claim'] })
          .filter((e) => held.has(e.pawn) && e.farm !== undefined)
          .map((e) => st.farmsteads[e.farm].name),
      ),
    ];
  const at = (t) => st.pawns.filter((p) => p.born <= t && (p.died === null || p.died > t)).length;
  const villages = (t) =>
    st.villages.filter((v) => (v.founded === undefined || v.founded === null ? 0 : v.founded) <= t).length;
  const rows = line.map((id) => {
    const p = st.pawns[id];
    return `<li>${esc(Sim.fullName(p))} <i>year ${yr(p.born)} to ${p.died === null ? 'now' : `year ${yr(p.died)}`}</i></li>`;
  });
  const island = `${at(t0)} people in ${villages(t0)} villages when the line began, ${st.living.length} in ${st.villages.length} now`;
  return (
    `<p>No one of the line is left: the game has ended.</p><ol>${rows.join('')}</ol>` +
    `<p>Farms held: ${farms.length ? esc(farms.join(', ')) : 'none'}.</p><p>The island: ${island}.</p>` +
    '<button type="button" data-end="menu">Main menu</button><button type="button" data-end="watch">Watch the island</button>'
  );
}
$('succession').addEventListener('click', (e) => {
  const end = e.target.closest('button[data-end]');
  if (end && st) {
    Sim.uninhabit(st); // the ended line is let go: the island is watched on
    if (end.dataset.end === 'menu') showLanding();
    return;
  }
  const b = e.target.closest('button[data-succeed]');
  if (!b || !st) return;
  const id = +b.dataset.succeed,
    r = Sim.succeed(st, id);
  succAt = 0;
  if (r === true) {
    playMsg = null;
    focusPawn(id);
    openPanel('actions');
  } // refused only if it died meanwhile: the successor is read again at once
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
// `task`: until the played pawn's task ends (VB-477, Kim 15 Nov): the same skip, at the fastest, with the stops of Sim.taskStop beside its
// own (the end or cut of its leg or task, and what concerns its household). Not a verb: the run is the same with or without it.
function startSkip(task = false) {
  if (played() < 0 || building || skipping) return;
  const back = speed === 0 ? lastSpeed : speed;
  dropSkipNote();
  setSpeed(Infinity);
  lastSpeed = back === Infinity ? 1 : back; // Play after the stop resumes at the speed before the skip
  skipCursor = Sim.skipFrom(st, skipLast); // it goes on where the last skip stopped, if the game has stood since (VB-1108)
  taskCursor = task ? Sim.taskFrom(st) : null;
  $(task ? 'taskBtn' : 'skipBtn').setAttribute('aria-pressed', 'true');
}
function endSkip(stop) {
  const ev = stop.ev,
    id = st.player ? st.player.pawn : -1,
    f = ev && ev.farm !== undefined ? st.farmsteads[ev.farm] : null,
    task = !!taskCursor; // a run until the task ends (VB-477)
  setSpeed(0);
  if (stop.spot)
    flyTo(stop.spot.x, stop.spot.y); // a gathering as it begins (VB-1031): where its people stand
  else if (f) flyTo(w.hx[f.house], w.hy[f.house]);
  else if (stop.farm !== undefined) flyTo(w.hx[st.farmsteads[stop.farm].house], w.hy[st.farmsteads[stop.farm].house]);
  else if (ev && ev.pawn !== undefined && st.pawns[ev.pawn].died === null) focusPawn(ev.pawn);
  else if (id >= 0 && st.pawns[id].died === null) focusPawn(id);
  skipNote = document.createElement('button');
  skipNote.type = 'button';
  skipNote.className = 'toast panel skip-note';
  skipNote.id = 'skipNote';
  skipNote.dataset.why = stop.why;
  skipNote.stopEv = ev || null; // the notice of this event is this note, not a toast as well (VB-1101)
  const c = Sim.cal(st.t);
  skipNote.textContent = `${task ? 'Stopped' : 'Skip stopped'}, ${Sim.SEASONS[c.season]} day ${c.sday + 1}, year ${c.year}: ${stop.text}`;
  skipNote.addEventListener('click', dropSkipNote);
  $('toasts').appendChild(skipNote);
  if (stop.why === 'offer') showOffer(stop.offer); // the offer, where it is answered (VB-1100)
}
// The Queue sheet opened at offer `oid`, scrolled to it, so the player answers it there.
function showOffer(oid) {
  if (activePanel !== 'actions') openPanel('actions');
  renderActions();
  const b = document.querySelector(`[data-play="answer"][data-offer="${oid}"]`);
  if (b) b.closest('.offer').scrollIntoView({ block: 'nearest' });
}
$('skipBtn').addEventListener('click', () => {
  if (skipCursor) setSpeed(0);
  else startSkip();
});
$('taskBtn').addEventListener('click', () => {
  if (skipCursor) setSpeed(0);
  else startSkip(true);
});
