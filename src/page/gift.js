// @sys page/gift: the player's gift (VB-221), the action bar's form (VB-341): who, how much, the floor's warning; the household chosen from a
// list or on the map
  // ---- the player's gift: while it plays a holder, grain to any household, by the verb give; below the floor it is warned ----
  // The draft: to (a household id), n (whole rations), warn (Sim.giftWarning's answer, waiting for the player to confirm) and msg. It is a view
  // of the bar's Household list (page/actbar), which is not redrawn while the player types in it, so the amount and the choice are kept.
  const newGift = () => ({ of: st, to: null, n: 10, warn: null, msg: '' });
  let gift = newGift();
  const householdName = (hh) => {
    const holder = hh.holder !== null ? Sim.fullName(st.pawns[hh.holder]) : 'no holder';
    return `${st.farmsteads[hh.farmstead].name} (${holder})`;
  };
  // The household the played pawn gives for, or null: the one it holds.
  const givesFor = (id) => (st.player && st.player.pawn === id && st.pawns[id].died === null ? Sim.holdingOf(st, id) : null);
  const giftMax = (hh) => Math.max(0, Math.floor(Sim.grainOf(hh) - Sim.seedReserve(st, hh)));
  // whom it may give to from the list: its kin's households, then the others of its village
  function giftChoices(hh) {
    const f = st.farmsteads[hh.farmstead], kin = Sim.kinHouseholds(st, hh);
    const village = st.liveHouseholds.filter((k) => k !== hh.id && !kin.includes(k) && st.farmsteads[st.households[k].farmstead].village === f.village);
    return { kin, village, all: [...kin, ...village] };
  }
  function giveHTML(id) {
    const hh = givesFor(id);
    if (gift.of !== st) gift = newGift();
    if (!hh) return '<p class="act-empty">Only the household\'s holder gives its grain.</p>';
    if (gift.to !== null && (st.households[gift.to].dissolved || gift.to === hh.id)) gift.to = null;
    const max = giftMax(hh), f = st.farmsteads[hh.farmstead], { kin, village } = giftChoices(hh);
    const opt = (k) => `<option value="${k}">${esc(householdName(st.households[k]))}</option>`;
    const group = (label, ids) => (ids.length ? `<optgroup label="${label}">${ids.map(opt).join('')}</optgroup>` : '');
    const chosen = gift.to !== null && !kin.includes(gift.to) && !village.includes(gift.to) ? [gift.to] : [];
    const to = gift.to !== null ? st.households[gift.to] : null;
    let h = `<div class="act-form"><p class="hint">${esc(f.name)} holds ${max} ${max === 1 ? 'ration' : 'rations'} of grain above its seed.</p>`;
    h += `<label class="fl" for="giveTo">To</label><div class="give-to"><select id="giveTo"><option value="">Choose a household</option>${group('Kin', kin)}${
      group('Of the village', village)}${group('Chosen on the map', chosen)}</select>`
      + '<button type="button" data-give="pick" data-k="pick">Choose on the map</button></div>';
    if (to && to.holder === null) h += `<p class="hint">${esc(
      st.farmsteads[to.farmstead].name)} has no holder: the gift is given, but no goodwill is owed for it.</p>`;
    h += '<label class="fl" for="giveN">How much, in rations</label><div class="stepper">'
      + `<button type="button" data-give="less" data-k="less" aria-label="Five rations less">${actIcon('minus')}</button>`
      + `<input id="giveN" type="number" inputmode="numeric" min="1" max="${max}" step="1">`
      + `<button type="button" data-give="more" data-k="more" aria-label="Five rations more">${actIcon('plus')}</button></div>`;
    if (gift.warn) {
      const names = gift.warn.hungry.map((k) => Sim.fullName(st.pawns[k])).join(', ');
      h += `<p class="refused" role="alert">This leaves ${esc(f.name)} ${Math.ceil(
        gift.warn.below)} rations short of its floor, ${gift.warn.days} days of food `
        + `beside the seed. If food runs short, the last to be served ${gift.warn.hungry.length === 1 ? 'is' : 'are'} ${esc(names)}.</p>`
        + '<div class="switches"><button type="button" class="primary" data-give="confirm" data-k="confirm">Give all the same</button>'
        + '<button type="button" data-give="cancel" data-k="cancel">Cancel</button></div>';
    } else h += '<div class="switches"><button type="button" class="primary" data-give="go" data-k="go">Add to the queue</button></div>';
    if (gift.msg) h += `<p class="refused" role="status">${esc(gift.msg)}</p>`;
    return `${h}</div>`;
  }
  $('actMenu').addEventListener('change', (e) => {
    if (e.target.id !== 'giveTo') return;
    gift.to = e.target.value === '' ? null : +e.target.value; gift.warn = null; gift.msg = ''; barHTML = ''; e.target.blur(); renderActions();
  });
  $('actMenu').addEventListener('input', (e) => { if (e.target.id === 'giveN') gift.n = +e.target.value; });
  // Add to the queue: a household chosen and a whole number of rations it has above the seed; below the floor, the warning first.
  function giveClick(b, id) {
    const hh = givesFor(id), act = b.dataset.give;
    if (!hh) return;
    const max = giftMax(hh);
    gift.msg = '';
    if (act === 'pick') { startTool({ kind: 'give', icon: 'gift', title: 'Give grain', needs: 'a farm, its land or one of its people', keep: false }); return; }
    if (act === 'less' || act === 'more') {
      gift.n = Math.max(1, Math.min(max, (Number.isInteger(gift.n) ? gift.n : 10) + (act === 'less' ? -5 : 5))); gift.warn = null; }
    else if (act === 'cancel') gift.warn = null;
    else if (gift.to === null) gift.msg = 'Choose a household to give to.';
    else if (!(Number.isInteger(gift.n) && gift.n >= 1 && gift.n <= max)) gift.msg = `Give a whole number of rations, from 1 to ${max}.`;
    else if (act === 'confirm') queueGift(id);
    else { gift.warn = Sim.giftWarning(st, hh, gift.n); if (!gift.warn) queueGift(id); }
  }
  function queueGift(id) {
    const r = Sim.queue(st, { actor: id, verb: 'give', target: gift.to, args: { good: 'grain', n: gift.n } });
    if (r === true) barMsg = { text: `Queued: ${gift.n} grain to ${st.farmsteads[st.households[gift.to].farmstead].name}.` };
    else gift.msg = r;
    gift.warn = null;
  }
  // "Choose on the map": the next click names the household, by one of its people, its farm's name, or a tile of its land or its house
  // (page/tileinfo asks first); the form opens again with it. Anything else says so and waits for another click.
  function pickGift(pw, named, i) {
    const own = givesFor(played());
    if (!own) { endTool(); return; }
    const land = i >= 0 ? Sim.ownerOf(st, i) : null, house = i >= 0 ? st.farmsteads.find((f) => f.house === i) : null;
    const k = pw >= 0 ? st.pawns[pw].household : named && named.farm !== undefined ? st.farmsteads[named.farm].household
      : house ? house.household : land && land.type === 'household' ? land.id : null;
    if (k === null || k === undefined || st.households[k].dissolved || k === own.id) {
      tool.msg = { text: 'No other household there: tap a farm, its land or one of its people', bad: true };
      return;
    }
    gift.to = k; gift.warn = null; gift.msg = ''; endTool();
    barOpen = true; barMenu = { g: 'house', view: 'give' }; barHTML = '';
  }
