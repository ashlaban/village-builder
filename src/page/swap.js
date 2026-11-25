// @sys page/swap: the played pawn's swap at the fair (VB-303), the action bar's form: the dealer it deals with, both sides' goods, what it
// gives and asks for, the customary worth of each, the residual that would be booked, the floor's warning; offered through the queue
// ---- the swap: while the played pawn stands at a gathering with a load, goods from its load for goods from another dealer's ----
// The draft: with (a dealer's pawn id), give and want ({good, n quanta}), warn (Sim.swapTerms' warning, waiting for the player to confirm)
// and msg. Page state, never st: a view of Sim.fairSides, kept while the player chooses.
const newSwap = () => ({
  of: st,
  with: null,
  give: { good: null, n: 1 },
  want: { good: null, n: 1 },
  warn: null,
  msg: '',
});
let swap = newSwap();
const lumpWords = (x, n) => `${n} ${x.lump}${n === 1 ? '' : 's'}${x.lump === x.good ? '' : ` of ${x.good}`}`;
const goodsLine = (side) =>
  side.length ? side.map((x) => `${lumpWords(x, x.n)} (${+x.worth.toFixed(1)} each)`).join(', ') : 'nothing to deal';
// The draft made whole against the fair as it is now: a dealer still there, goods each side still holds, amounts within what it holds.
function swapDraft(sides) {
  if (swap.of !== st) swap = newSwap();
  if (!sides.dealers.some((d) => d.id === swap.with)) swap.with = sides.dealers.length ? sides.dealers[0].id : null;
  const other = sides.dealers.find((d) => d.id === swap.with),
    fit = (pick, side) => {
      const x = side.find((g) => g.good === pick.good) || side[0] || null;
      pick.good = x ? x.good : null;
      pick.n = x ? Math.max(1, Math.min(x.n, Number.isInteger(pick.n) ? pick.n : 1)) : 1;
      return x;
    };
  return { other, give: fit(swap.give, sides.mine), want: other ? fit(swap.want, other.goods) : null };
}
function swapHTML(id) {
  const sides = Sim.fairSides(st, id);
  if (!sides) return '<p class="act-empty">You deal at the fair while you stand at the gathering with a load.</p>';
  if (!sides.dealers.length) return '<p class="act-empty">No other dealer with a load is at the gathering now.</p>';
  const { other, give, want } = swapDraft(sides),
    name = (d) => {
      const hh = st.households[d.household];
      return `${Sim.fullName(st.pawns[d.id])}, of ${st.farmsteads[hh.farmstead].name}`;
    };
  let h =
    `<div class="act-form"><p class="hint">You carry ${esc(goodsLine(sides.mine))}.</p>` +
    `<label class="fl" for="swapWith">With</label><select id="swapWith">${sides.dealers
      .map((d) => `<option value="${d.id}"${d.id === swap.with ? ' selected' : ''}>${esc(name(d))}</option>`)
      .join('')}</select>` +
    `<p class="hint">${esc(Sim.fullName(st.pawns[other.id]))} carries ${esc(goodsLine(other.goods))}.</p>`;
  const pick = (key, side, x) =>
    `<label class="fl" for="swap${key}">${key === 'Give' ? 'You give' : 'You ask for'}</label><div class="stepper">` +
    `<select id="swap${key}">${side
      .map((g) => `<option value="${esc(g.good)}"${x && g.good === x.good ? ' selected' : ''}>${esc(g.good)}</option>`)
      .join('')}</select>` +
    `<button type="button" data-swap="less${key}" data-k="less${key}" aria-label="One less">${actIcon('minus')}</button>` +
    `<b class="swap-n">${(key === 'Give' ? swap.give : swap.want).n}</b>` +
    `<button type="button" data-swap="more${key}" data-k="more${key}" aria-label="One more">${actIcon('plus')}</button></div>`;
  if (!give || !want) return `${h}<p class="act-empty">One side has nothing to deal.</p></div>`;
  h += pick('Give', sides.mine, give) + pick('Want', other.goods, want);
  const gives = { good: give.good, n: swap.give.n },
    wants = { good: want.good, n: swap.want.n },
    t = Sim.swapTerms(st, id, other.id, gives, wants),
    who = Sim.fullName(st.pawns[other.id]),
    r = Math.round(Math.abs(t.residual) * 10) / 10;
  h +=
    `<h3 class="card-sec">By customary worth</h3><p>${esc(lumpWords(give, gives.n))}, worth ${+t.give.toFixed(1)} rations, for ` +
    `${esc(lumpWords(want, wants.n))}, worth ${+t.get.toFixed(1)}.</p><p class="hint">${
      r < 0.05
        ? 'Even: nothing is booked between you.'
        : t.residual > 0
          ? `${esc(who)} would owe you ${r} rations' worth: booked as goodwill.`
          : `You would owe ${esc(who)} ${r} rations' worth: booked as goodwill.`
    } ${esc(who)} answers by its household's need.</p>`;
  if (t.why) h += `<p class="refused" role="status">Not as it stands: ${esc(t.why)}.</p>`;
  else if (swap.warn)
    h +=
      `<p class="refused" role="alert">This leaves your household ${Math.ceil(swap.warn.below)} rations short of its floor.</p>` +
      '<div class="switches"><button type="button" class="primary" data-swap="confirm" data-k="confirm">Offer all the same</button>' +
      '<button type="button" data-swap="cancel" data-k="cancel">Cancel</button></div>';
  else
    h +=
      '<div class="switches"><button type="button" class="primary" data-swap="go" data-k="go">Offer the swap</button></div>';
  if (swap.msg) h += `<p class="refused" role="status">${esc(swap.msg)}</p>`;
  return `${h}</div>`;
}
$('actMenu').addEventListener('change', (e) => {
  const k = { swapWith: 'with', swapGive: 'give', swapWant: 'want' }[e.target.id];
  if (!k) return;
  if (k === 'with') swap.with = +e.target.value;
  else swap[k] = { good: e.target.value, n: 1 };
  swap.warn = null;
  swap.msg = '';
  barHTML = '';
  e.target.blur();
  renderActions();
});
// The form's buttons: one more or less of a side; the offer, by the verb offer on the basis swap (sim/fair), through the queue; under the
// floor, the warning first (The gift, The player's gift).
function swapClick(b, id) {
  const act = b.dataset.swap,
    sides = Sim.fairSides(st, id);
  swap.msg = '';
  if (!sides) return;
  const { other, give, want } = swapDraft(sides);
  if (act === 'lessGive' || act === 'moreGive') swap.give.n += act === 'lessGive' ? -1 : 1;
  else if (act === 'lessWant' || act === 'moreWant') swap.want.n += act === 'lessWant' ? -1 : 1;
  else if (act === 'cancel') swap.warn = null;
  else if (other && give && want) {
    const gives = { good: give.good, n: swap.give.n },
      wants = { good: want.good, n: swap.want.n },
      t = Sim.swapTerms(st, id, other.id, gives, wants);
    if (t.why) swap.msg = t.why;
    else if (act === 'go' && t.warning) swap.warn = t.warning;
    else {
      const r = Sim.queue(st, {
        actor: id,
        verb: 'offer',
        target: other.id,
        args: { basis: 'swap', gives, wants },
      });
      if (r === true) {
        barMsg = {
          text: `Queued: an offer of ${lumpWords(give, gives.n)} for ${lumpWords(want, wants.n)} to ${Sim.fullName(st.pawns[other.id])}.`,
        };
        barMenu.view = null;
      } else swap.msg = r;
      swap.warn = null;
    }
    return;
  }
  swap.warn = null;
}
