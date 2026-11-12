// @sys page/customs: the Customs tab of a village's card: its customs as a charter, who stands by which way, and why (VB-389, VB-391); the charter's sentences
  // ======== customs ========
  // The customs are told as sentences under four heads; the option in force is a phrase of its sentence, [before, {option: phrase}, after].
  const CHARTER = [['Land', ['claims', 'dispute', 'newLand']],
    ['Inheritance', ['handover', 'heirSex', 'birthOrder', 'heirCount', 'daughterShare', 'widow', 'ownHeir']],
    ['Household', ['residence', 'kinLimit', 'feedOrder']], ['Meeting', ['voice']]];
  const SAID = {
    claims: ['An empty farm goes to ', { kin: 'kin of the old family first', villagers: 'villagers first', anyone: 'anyone who claims it',
      assembly: 'whoever the meeting names' }, '.'],
    dispute: ['Where two claim the same land, ', { first: 'the first claim stands', strongest: 'the strongest claim stands',
      kin: 'kin of the last holder come first', meeting: 'the meeting decides' }, '.'],
    newLand: ['Newly cleared land ', { village: 'is allotted by the village', labour: 'goes to whoever worked most',
      intended: 'goes to whoever it was cleared for' }, '.'],
    handover: ['A farm passes on ', { death: 'at the holder’s death', marriage: 'when the heir marries', age60: 'when the holder turns 60' }, '.'],
    heirSex: ['', { sons: 'Only sons', sonsFirst: 'Sons before daughters', any: 'Any child', daughtersFirst: 'Daughters before sons' }, ' may inherit,'],
    birthOrder: ['and among them ', { eldest: 'the eldest', youngest: 'the youngest', chosen: 'the one the parent chooses' }, '.'],
    heirCount: ['', { one: 'One heir takes all', buyout: 'One heir buys out the rest', split: 'The land is split between the heirs' }, '.'],
    daughterShare: ['A daughter’s share is ', { equal: 'equal to a son’s', half: 'half a son’s' }, '.'],
    widow: ['A widow ', { life: 'keeps the farm for life', keep: 'keeps a right to her keep', outright: 'inherits outright' }, '.'],
    ownHeir: ['One who is first in line for their own parents’ farm ', { behind: 'steps behind other relatives',
      keeps: 'keeps their place' }, ' in the line of another.'],
    residence: ['A married couple lives ', { land: 'with whoever holds land', husband: 'at the husband’s home', wife: 'at the wife’s home' }, '.'],
    kinLimit: ['Kin may marry if they are ', { second: 'third cousins or further', first: 'second cousins or further',
      close: 'first cousins or further', uncle: 'uncle and niece or further' }, '.'],
    feedOrder: ['When food is short, ', { equal: 'all get equal shares', children: 'children eat first', workers: 'those who work eat first' }, '.'],
    voice: ['', { landholders: 'Landholders', heads: 'All household heads', adults: 'All adults' }, ' speak at the meeting.'],
  };
  const phraseOf = (k, j) => SAID[Culture.DIMS[k].key][1][Culture.DIMS[k].opts[j][0]];
  // A voice wavers when its first and second leanings are this close; a way that leads is contested within this of the share it must pass;
  // a strong voice has this many times an even share of the say; and so many faces stand by one way before a count.
  const WAVER = 0.15, NEAR = 0.1, STRONG = 1.5, FACES = 8;
  let customOpen = -1, customVoice = -1, customsOf = -1, charterStamp = '';
  // The village of the card, if it has customs of its own (a settlement of the culture model), else -1.
  const customsVillage = () => (st && selPawn < 0 && selVillage >= 0 && st.cenv.settlements[selVillage]
    && st.cenv.settlements[selVillage].id === selVillage ? selVillage : -1);
  // A village's customs as the meeting would find them today: for each, the practice x, the culture's custom, the way with most support y,
  // and its state: settled (the practice leads), lead (another leads, far from the share it must pass, Culture.meeting's rule), contested
  // (within NEAR of it) or turning (past it); and those with a voice, each by the way they favour most, the strongest voices first.
  function readCustoms(s) {
    const members = Sim.membersOf(st, s.id), voiced = members.filter((p) => p.alive && Sim.voiceOf(st, p, s) > 0);
    const say = (p) => Sim.voiceOf(st, p, s) * p.prestige, W = voiced.reduce((a, p) => a + say(p), 0);
    const S = Culture.support(st.cenv, members, (p) => Sim.voiceOf(st, p, s)).S, cu = st.cenv.cultures[s.culture], few = Culture.fewVoices(voiced.length);
    return { people: members.filter((p) => p.alive).length, voices: voiced.length, culture: cu, dims: Culture.DIMS.map((d, k) => {
      const o = Culture.OFF[k], n = d.opts.length, x = s.practice[k], cust = cu.customs[k];
      let y = 0; for (let j = 1; j < n; j++) if (S[o + j] > S[o + y]) y = j;
      const need = S[o + x] * (1 + few * Culture.margin(s, x, y, cust));
      const state = !voiced.length || y === x ? 'settled' : S[o + y] > need ? 'turning' : S[o + y] > need - NEAR ? 'contested' : 'lead';
      const who = voiced.map((p) => {
        let top = 0, next = -1;
        for (let j = 1; j < n; j++) if (p.att[o + j] > p.att[o + top]) top = j;
        for (let j = 0; j < n; j++) if (j !== top && (next < 0 || p.att[o + j] > p.att[o + next])) next = j;
        return { id: p.id, say: say(p) / W, top, next, lean: [p.att[o + top], p.att[o + next]], waver: p.att[o + top] - p.att[o + next] < WAVER };
      }).sort((a, b) => b.say - a.say || a.id - b.id);
      return { k, d, x, cust, y, state, differs: x !== cust, who };
    }) };
  }
  // The charter: the customs as sentences under their heads. pick(k) is the option told of custom k and mark(k) its phrase's mark; the open
  // custom's detail follows its paragraph. The phrases' ids take a prefix: the card's charter and the Culture pane's are in one document.
  function charterHTML(prefix, pick, mark, open, detail) {
    const said = (k) => `${SAID[Culture.DIMS[k].key][0]}<span role="button" tabindex="0" class="phrase ${mark(k)}" id="${prefix}${k}" data-phrase="${k}"
      aria-expanded="${k === open}">${phraseOf(k, pick(k))}</span>${SAID[Culture.DIMS[k].key][2]}`;
    return CHARTER.map(([head, keys]) => {
      const ks = keys.map((key) => Culture.IDX[key]);
      return `<h3>${head}</h3><p class="charter">${ks.map(said).join(' ')}</p>${ks.includes(open) ? detail(open) : ''}`;
    }).join('');
  }
  const markOf = (c) => (c.state === 'turning' || c.state === 'contested' ? c.state : c.differs ? 'differs' : '');
  // The note of a chosen voice (VB-391): how far they lean to their first and second way, and the strongest pull towards the first, as the
  // daily drift weighs them (sim/leanings): their own cause, what they learned young, those they deal with, a cause argued near them, their
  // interest.
  function voiceNote(c, f, s) {
    const me = played(), you = f.id === me, p = st.pawns[f.id], k = Culture.OFF[c.k] + f.top, pct = (v) => `${Math.round(v * 100)}%`;
    const near = Sim.membersOf(st, s.id).filter((q) => q.alive && q.age >= 12);
    const mean = near.length ? near.reduce((a, q) => a + q.att[k], 0) / near.length : null;
    const w = VB['sim/leanings'].pulls(p, c.k, f.top, (id) => st.pawns[id], mean, s.kind), name = (id) => esc(st.pawns[id].given);
    const best = ['upbringing', 'company', 'cause', 'interest'].reduce((x, y) => (w[y] > w[x] ? y : x));
    const why = w.own ? (you ? 'You argue this cause.' : 'Argues this cause.') : w[best] <= 0 ? `Nothing pulls ${you ? 'you' : 'them'} further this way.`
      : best === 'upbringing' ? 'Raised to it.' : best === 'interest' ? `It serves ${you ? 'your' : 'their'} interest.`
        : best === 'cause' ? (w.arguer === me ? 'Swayed by your cause.' : `Swayed by ${name(w.arguer)}’s cause.`)
          : w.friend === null ? `Those around ${you ? 'you' : 'them'} lean this way.`
            : w.friend === me ? 'Close to you, and you favour it.' : `Close to ${name(w.friend)}, who favours it.`;
    const who = you ? 'You lean' : `<button type="button" class="name" data-pawn="${f.id}">${esc(Sim.fullName(p))}</button> leans`;
    return `<p class="why">${who} ${pct(f.lean[0])} to “${esc(c.d.opts[f.top][1])}” and ${pct(f.lean[1])} to “${esc(c.d.opts[f.next][1])}”. ${why}</p>`;
  }
  // An opened custom: each way with its verdict and the faces of those who favour it most; a face is a button that shows its note.
  function standHTML(c, r, s) {
    const me = played(), cn = esc(r.culture.name), tag = (cls, text) => `<em class="tag ${cls}">${text}</em>`;
    const face = (f) => `<button type="button" class="voice${f.waver ? ' waver' : ''}" id="voice${f.id}" data-voice="${f.id}"
      aria-pressed="${f.id === customVoice}">${faceImg(f.id)}<b>${f.id === me ? 'You' : esc(st.pawns[f.id].given)}</b><small>${
      f.waver ? `wavering towards “${esc(c.d.opts[f.next][1])}”` : f.say > STRONG / r.voices ? 'a strong voice' : ''}</small></button>`;
    const verdict = (j) => (j === c.x ? tag('', 'In force') : '') + (j === c.cust && c.differs ? tag('custom', `${cn} custom`) : '')
      + (j !== c.y || c.state === 'settled' ? '' : c.state === 'lead' ? tag('gold', 'More support, but cannot win yet')
        : c.state === 'contested' ? tag('gold', 'Close to winning') : tag('red', 'Wins at the next meeting'));
    const chosen = c.who.find((f) => f.id === customVoice);
    return `<div class="stand" id="customStand"><p class="of">${esc(c.d.label)}</p>${c.d.opts.map((o, j) => {
      const w = c.who.filter((f) => f.top === j), more = w.length > FACES ? `<small class="rest">and ${w.length - FACES} more</small>` : '';
      return `<div class="way${j === c.x ? ' in' : ''}"><p>${esc(o[1])}${verdict(j)}</p>${w.length
        ? `<div class="faces">${w.slice(0, FACES).map(face).join('')}${more}</div>` : '<p class="none">No one stands here.</p>'}${
        chosen && chosen.top === j ? voiceNote(c, chosen, s) : ''}</div>`;
    }).join('')}<p class="note">${r.voices ? `${r.voices} of ${r.people} speak at the meeting, and each stands by the way they favour most. `
      + 'Those who waver are the ones to win over. Choose a face to see how far they lean, and why.' : 'No one here speaks at the meeting yet.'}</p></div>`;
  }
  // Drawn when the day, the village, a practice, the played pawn or the open phrase changes, not every frame.
  function renderCustoms(id) {
    const s = st.cenv.settlements[id];
    if (customsOf !== id) { customsOf = id; customOpen = customVoice = -1; }
    const stamp = [Math.floor(st.t / Sim.DAY), id, customOpen, customVoice, played(), s.practice, st.cenv.cultures[s.culture].customs].join(':');
    if (stamp === charterStamp) return;
    charterStamp = stamp;
    const r = readCustoms(s), days = nextMeeting(), cn = esc(r.culture.name);
    let h = `<h3 class="lead">The customs of ${esc(s.name)}</h3><p class="note">${esc(
      s.name)} follows the <button type="button" class="name" data-culture="${r.culture.id}">${cn} culture</button>. ${r.voices} of its ${
      r.people} people speak at the meeting, next in ${days} ${days === 1 ? 'day' : 'days'}. Choose a phrase to see who stands where.</p>`;
    h += charterHTML('phrase', (k) => r.dims[k].x, (k) => markOf(r.dims[k]), customOpen, (k) => standHTML(r.dims[k], r, s));
    h += `<p class="key"><span><span class="phrase differs">Differs</span> from ${cn} custom</span><span><span class="phrase contested">Contested</span></span>`
      + '<span><span class="phrase turning">Set to change</span></span></p>';
    updatePanelHTML($('tileCustoms'), h);
  }
  // A phrase opens and closes by a click, Enter or Space, and the opened custom is brought into view; a face shows and hides its note.
  function togglePhrase(e) {
    const p = e.target.closest('[data-phrase]'), v = e.target.closest('[data-voice]');
    const cu = e.target.closest('[data-culture]');
    if (cu && e.type === 'click') { openCulture(+cu.dataset.culture); return; }
    if (v && e.type === 'click') {
      customVoice = customVoice === +v.dataset.voice ? -1 : +v.dataset.voice;
      renderCustoms(customsOf);
      const again = $(`voice${v.dataset.voice}`), why = $('tileCustoms').querySelector('.why');
      if (again) again.focus({ preventScroll: true });
      if (why && why.scrollIntoView) why.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (!p || (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    customOpen = customOpen === +p.dataset.phrase ? -1 : +p.dataset.phrase; customVoice = -1;
    renderCustoms(customsOf);
    const again = $(`phrase${p.dataset.phrase}`), stand = $('customStand');
    if (again) again.focus({ preventScroll: true });
    if (stand && stand.scrollIntoView) stand.scrollIntoView({ block: 'nearest' });
  }
  $('tileCustoms').addEventListener('click', togglePhrase);
  $('tileCustoms').addEventListener('keydown', togglePhrase);
