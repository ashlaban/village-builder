// @sys page/words: words: how pawns, households, farms and villages are described in the panels
// ---- words ----
const isWidow = (p) =>
  p.sex === 'f' &&
  Sim.spouseOf(st, p.id) === null &&
  st.unions.some((u) => (u.a === p.id || u.b === p.id) && u.end !== null);
const roleLine = (p) => {
  if (p.role === 'farmer' && p.sex === 'f')
    return isWidow(p) ? 'Widow holding the farm (änka)' : 'Holds the farm (bonde)';
  const r = Sim.ROLES[p.role];
  // the Swedish word is left out where it reads as an English one: a child's 'barn' beside the barn a farm may build (VB-664)
  return r.sv === 'barn' ? r.title : `${r.title} (${r.sv})`;
};
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const farmOf = (p) =>
  p.household !== null && st.households[p.household] ? st.farmsteads[st.households[p.household].farmstead] : null;
const heirTo = (id) =>
  st.households.filter((h) => !h.dissolved && Sim.heirRanking(st, h)[0] === id).map((h) => st.farmsteads[h.farmstead]);
function jobsLine(list) {
  if (!list.length) return 'none open';
  const n = {};
  for (const j of list) {
    const k = Sim.KINDS[j.kind].name;
    n[k] = n[k] || { open: 0, taken: 0 };
    n[k][j.claims.length ? 'taken' : 'open']++;
  }
  return Object.entries(n)
    .map(
      ([k, v]) =>
        `${k}${v.open + v.taken > 1 ? ` ×${v.open + v.taken}` : ''}${v.taken ? (v.open ? `, ${v.taken} under way` : ', under way') : ''}`,
    )
    .join('; ');
}
// A farm's fields counted by stage, in words: [[word, count]].
function fieldCounts(f) {
  const n = {},
    word = {
      stubble: 'stubble',
      plowed: 'hoed',
      sown: 'sown',
      young: 'sprouting',
      growing: 'growing',
      ripe: 'ripe',
      stooks: 'in stooks',
      fallow: 'gone to grass',
      scrub: 'gone to scrub',
    };
  for (const fd of f.fields) {
    const s = fd.stage === 'stooks' ? 'stooks' : cropStage(fd);
    n[s] = (n[s] || 0) + 1;
  }
  return Object.entries(n).map(([k, v]) => [word[k], v]);
}
const fieldSummary = (f) =>
  fieldCounts(f)
    .map(([word, v]) => `${v} ${word}`)
    .join(', ');
const hungerWord = (hh) =>
  hh.hunger <= 0 ? 'Fed' : hh.hunger < 0.25 ? 'Short of food' : hh.hunger < 0.6 ? 'Hungry' : 'Starving';
const hungerMark = (hh) => `<i class="mark ${hh.hunger <= 0 ? 'fed' : hh.hunger < 0.25 ? 'short' : 'hungry'}"></i>`;
const emptyYears = (f) => Math.max(0, Math.floor((st.t - f.emptySince) / Sim.YEAR));
let settlersHTML = '',
  peopleQuery = '';
const peopleFolds = new Set();
const foldOpen = (key) => peopleFolds.has(key);
function fold(key, title, body, cls = 'fold-section') {
  return `<details class="${cls}" data-fold="${key}"${foldOpen(key) ? ' open' : ''}><summary>${title}</summary>${body}</details>`;
}
function updatePanelHTML(box, html) {
  const scroll = box.closest('.sheet-content'),
    top = scroll ? scroll.scrollTop : 0;
  const focused = box.contains(document.activeElement) ? document.activeElement : null;
  const focusKey =
    focused &&
    (focused.closest('[data-pawn]')
      ? `[data-pawn="${focused.closest('[data-pawn]').dataset.pawn}"]`
      : focused.closest('[data-fold]')
        ? `[data-fold="${focused.closest('[data-fold]').dataset.fold}"] > summary`
        : null);
  box.innerHTML = html;
  if (focusKey) {
    const next = box.querySelector(focusKey);
    if (next) next.focus({ preventScroll: true });
  }
  if (scroll) scroll.scrollTop = top;
}
// The People sheet finds a person, a farm or a village (VB-664): a village's fold lists its farms and their people, each a row that
// opens its card, where it is told of (page/cards). The rows are the cards' own (farmRow, memberRow).
function renderSettlers() {
  if (!st || document.body.classList.contains('ui-hidden') || $('peopleSheet').classList.contains('collapsed')) return;
  const query = peopleQuery.trim().toLocaleLowerCase(),
    groups = new Map();
  let matches = 0,
    total = 0;
  for (const hh of st.households) {
    if (hh.dissolved) continue;
    total += hh.members.length;
    const f = st.farmsteads[hh.farmstead],
      v = st.villages[f.village];
    const whole = !query || `${f.name} ${v.name}`.toLocaleLowerCase().includes(query);
    const members = whole
      ? hh.members
      : hh.members.filter((id) => Sim.fullName(st.pawns[id]).toLocaleLowerCase().includes(query));
    if (!members.length) continue;
    matches += members.length;
    if (!groups.has(v.id)) groups.set(v.id, []);
    groups.get(v.id).push({ hh, f, members });
  }
  let h = '';
  for (const v of st.villages) {
    const households = groups.get(v.id) || [];
    if (!households.length && query) continue;
    const key = `village-${v.id}`,
      expanded = !!query || foldOpen(key);
    const population = households.reduce((sum, item) => sum + item.members.length, 0),
      meta = `${population} people · ${households.length} ${households.length === 1 ? 'household' : 'households'}`;
    const body = expanded
      ? row(`data-village="${v.id}"`, iconImg(villageIcon(v), 'mini'), v.name, 'The village', actIcon('next')) +
        households
          .map(({ f, members }) => `${farmRow(f)}<div class="finder-members">${members.map(memberRow).join('')}</div>`)
          .join('')
      : '';
    h += `<details class="village-block" data-fold="${key}"${expanded ? ' open' : ''}>
        <summary>${iconImg(villageIcon(v), 'mini')}${esc(v.name)}<span class="summary-meta">${meta}</span></summary>${body}</details>`;
  }
  // the village log: the last 40 of the record's events that are told to all (Sim.villageLog), with their names as links
  if (!query)
    h += fold(
      'recent',
      'Recent events',
      foldOpen('recent')
        ? '<div class="log">' +
            Sim.villageLog(st)
              .map((e) => {
                const c = Sim.cal(e.t);
                return `<p>Year ${c.year}, ${Sim.SEASONS[c.season]}: ${linkNames(e.text, e.ev)}</p>`;
              })
              .join('') +
            '</div>'
        : '',
    );
  if (!h) h = '<p>No matching people or households. Try another name.</p>';
  $('peopleCount').textContent = query
    ? `${matches} of ${total} people match`
    : `${total} people across ${st.villages.length} villages`;
  if (h !== settlersHTML) {
    settlersHTML = h;
    updatePanelHTML($('settlers'), h);
  }
}
$('peopleSearch').addEventListener('input', (e) => {
  peopleQuery = e.target.value;
  renderSettlers();
});
$('settlers').addEventListener(
  'toggle',
  (e) => {
    const key = e.target.dataset.fold;
    if (!key || (peopleQuery.trim() && /^(village|household)-/.test(key)) || foldOpen(key) === e.target.open) return;
    if (e.target.open) peopleFolds.add(key);
    else peopleFolds.delete(key);
    renderSettlers();
  },
  true,
);
function focusPawn(id) {
  const p = st.pawns[id];
  if (p.died !== null) {
    treeSel = id;
    openTree();
    return;
  }
  const a = st.agents[id],
    f = farmOf(p);
  const [x, y] = Sim.placeOf(st, a); // a walker's place from its leg (VB-473)
  flyTo(a.inside ? w.hx[f.house] : x, a.inside ? w.hy[f.house] : y);
  selectPawn(id);
}
function selectPawn(id, pinned = true) {
  selectionPinned = pinned;
  openPanel('tile');
  selPawn = id;
  sel = -1;
  hoverDirty = true;
  showPawn(id);
}
function showPawn(id) {
  $('personFamily').hidden = false;
  const p = st.pawns[id],
    f = farmOf(p);
  if (p.died !== null || !f) {
    card(Sim.fullName(p), ['Died'], '', { badge: faceImg(id, 'badge') });
    return;
  }
  const sp = Sim.spouseOf(st, id),
    kids = Sim.childrenOf(st, id).filter((c) => st.pawns[c].died === null);
  const holds = Sim.holdingOf(st, id),
    heirs = heirTo(id);
  const status = holds
    ? `Holds ${f.name}`
    : heirs.length
      ? `Heir to ${heirs.map((x) => x.name).join(' and ')}`
      : p.retired
        ? `Retired at ${f.name}`
        : p.age >= 18 && st.demand.includes(id)
          ? `Landless at ${f.name}, wants to move out`
          : `Lives at ${f.name}`;
  const rel =
    (sp !== null
      ? `${p.sex === 'f' ? 'Wife' : 'Husband'} of ${Sim.fullName(st.pawns[sp])}`
      : isWidow(p)
        ? 'Widowed'
        : 'Unmarried') +
    (p.pregnantUntil !== null
      ? ', expecting a child'
      : p.nursingUntil !== null && st.t < p.nursingUntil && (p.nursling === null || st.pawns[p.nursling].alive)
        ? p.nursling !== null
          ? `, nursing ${st.pawns[p.nursling].given}`
          : ', nursing a baby'
        : '');
  const v = st.villages[f.village];
  card(
    Sim.fullName(p),
    [
      `${roleLine(p)}, ${p.age}`,
      `${status}. ${rel}${kids.length ? `, ${kids.length} ${kids.length === 1 ? 'child' : 'children'}` : ''}`,
      p.stake
        ? `Share in hand: ${p.stake} rations${p.owed ? `, ${p.owed} still owed` : ''}`
        : p.advocate
          ? `Argues for: ${Culture.DIMS[p.advocate.dim].opts[p.advocate.opt][1].toLowerCase()}`
          : '',
      Sim.idleLine(st, id),
    ].filter(Boolean),
    Sim.describe(st, id),
    {
      badge: faceImg(id, 'badge'),
      stats: pawnStats(id) + traitsHTML(id),
      links: (sp !== null ? pawnChip(sp) : '') + farmChip(f) + villageChip(v),
    },
  );
  showRelations(id);
  renderPlay(id);
}
// A pawn's levels, the same wherever a pawn's state is shown (its card, the played pawn's sheet): health and hunger on the one meter,
// its household's cold, and its prestige. Prestige is a sum with no upper bound, so it is a number and no meter, its parts in the title
// (the exception VB-665 is to settle).
function pawnStats(id) {
  const p = st.pawns[id],
    hh = p.household !== null ? st.households[p.household] : null,
    hunger = Math.round(p.hunger * 100),
    health = Math.round(p.health);
  return stats([
    { icon: 'health', label: 'Health', value: health, tone: health < 50 ? 'bad' : '', meter: { value: health } },
    {
      icon: 'hunger',
      label: 'Hunger',
      value: hunger,
      tone: hunger >= 50 ? 'bad' : hunger >= 10 ? 'warn' : '',
      meter: { value: hunger },
    },
    hh && hh.cold > 0 ? { icon: 'cold', label: 'Cold', value: 'no firewood', tone: 'bad', wide: true } : null,
    p.age >= 16
      ? {
          icon: 'prestige',
          label: 'Prestige',
          value: p.prestige.toFixed(2),
          wide: true,
          title: `Prestige: ${Sim.prestigeParts(st, p)
            .map(([l, x]) => `${l.toLowerCase()} ${x.toFixed(2)}`)
            .join(', ')}`,
        }
      : null,
  ]);
}
// The people a pawn knows best, by tie, and any it dislikes besides: kin, the opinion in words and as a number, and its largest memory.
let relHTML = '';
const signed = (v) => `${v < 0 ? '−' : '+'}${Math.abs(Math.round(v * 100))}`;
function showRelations(id) {
  const all = Sim.relationsOf(st, id),
    list = all.slice(0, 5),
    cold = (o) => ['dislikes', 'enemy'].includes(Sim.opinionWord(o));
  for (const x of all.slice(5)) if (cold(x.opinion) && list.length < 7) list.push(x);
  const rows = list
    .map((x) => {
      const word = Sim.opinionWord(x.opinion),
        kin = Sim.standingWord(st, id, x.id),
        why = Sim.reasonsOf(st, id, x.id).find((r) => r.label !== kin);
      const detail = [kin, word === 'neutral' ? null : word, !kin && why ? why.label.toLowerCase() : null]
        .filter(Boolean)
        .join(' · ');
      const tone = x.opinion >= 0.25 ? 'pos' : cold(x.opinion) ? 'neg' : '';
      return `<button type="button" class="op" data-pawn="${x.id}">${faceImg(
        x.id,
        'mini',
      )}${esc(Sim.fullName(st.pawns[x.id]))}<i>${esc(detail)}</i>${meter({
        value: x.opinion * 100,
        signed: true,
        tone: tone === 'pos' ? 'good' : tone === 'neg' ? 'bad' : '',
        label: 'Opinion',
        text: signed(x.opinion),
      })}<b class="${tone}">${signed(x.opinion)}</b></button>`;
    })
    .join('');
  const owed = goodwillRows(id),
    h = (rows ? `<h3>Knows best</h3>${rows}` : '') + (owed ? `<h3>Owes and is owed</h3>${owed}` : '');
  if (h !== relHTML) {
    relHTML = h;
    $('tileRel').innerHTML = h;
  }
  $('tileRel').hidden = !h;
  $('relationsDetails').hidden = !h;
}
// A pawn's largest goodwill balances (VB-218; design.md, The gift: What the player sees), in whole rations; on a holder's panel, what
// it would give each counterpart's household, with the parts of its allowance on hover.
const rations = (n) => `${n} ${n === 1 ? 'ration' : 'rations'}`;
const part = (v) => {
  const r = Math.round(v);
  return r === 0 ? '0' : `${r < 0 ? '−' : '+'}${Math.abs(r)}`;
};
function goodwillRows(id) {
  return Sim.goodwillOf(st, id)
    .filter((x) => Math.abs(x.balance) >= 1)
    .slice(0, 5)
    .map((x) => {
      const name = esc(Sim.fullName(st.pawns[x.other])),
        n = rations(Math.round(Math.abs(x.balance)));
      const a = Sim.explainAllowance(st, id, x.other);
      const give = a ? `<i class="give">would give up to ${rations(Math.round(a.value))}</i>` : '';
      const why = a ? ` title="${esc(a.parts.map((q) => `${q.label} ${part(q.factor)}`).join(' · '))}"` : '';
      return `<button type="button" data-pawn="${x.other}"${why}>${x.balance > 0 ? `Is owed ${n} by ${name}` : `Owes ${name} ${n}`}${give}</button>`;
    })
    .join('');
}
// The selection card: a title, up to four lines and the rest, an activity, and `more`: a badge (portrait or icon), a kind under the title,
// links to what the selection belongs to, and a list of what it holds. Unpinned, under the pointer, it shows its summary only.
const cardShown = {};
function cardPart(id, html = '') {
  const el = $(id);
  if (cardShown[id] !== html) {
    cardShown[id] = html;
    el.innerHTML = html;
  }
  el.hidden = !html;
}
let cardOf = ''; // what the card shows; a card of something else opens at its top
function card(title, lines, activity = '', more = {}) {
  $('tileName').textContent = title;
  const of = `${selPawn}|${selVillage}|${selFarm}|${sel}`;
  if (of !== cardOf) {
    cardOf = of;
    $('tileDetails').scrollTop = 0;
  }
  cardPart('tileBadge', more.badge);
  cardPart('tileKind', more.kind ? esc(more.kind) : '');
  cardPart('tileStats', more.stats);
  cardPart('tileLinks', more.links);
  cardPart('tileList', more.list);
  $('tile').classList.toggle('peek', !selectionPinned);
  $('tileActivity').textContent = activity;
  $('tileActivity').hidden = !activity;
  ['tileElev', 'tileCoord', 'tileExtra', 'tileMore'].forEach((id, k) => {
    const el = $(id);
    el.textContent = lines[k] || '';
    el.hidden = !lines[k];
  });
  const rest = lines
    .slice(4)
    .map((line) => `<span>${esc(line)}</span>`)
    .join('');
  if ($('tileRest').innerHTML !== rest) $('tileRest').innerHTML = rest;
  $('personFamily').hidden = selPawn < 0;
  $('tileRel').hidden = true;
  $('relationsDetails').hidden = true;
  $('cardPlay').hidden = true;
  $('tile').hidden = activePanel !== 'tile';
  syncTabs();
}
function pawnAt(x, y) {
  if (!st || cam.z <= 0.28) return -1;
  let best = -1,
    bd = 1e9;
  for (const a of st.agents) {
    if (a.inside || st.pawns[a.id].died !== null) continue;
    const [ax, ay] = Sim.placeOf(st, a), // a walker's place from its leg (VB-473)
      dx = x - ax,
      dy = y - (ay - 9);
    if (
      Math.abs(dx) < (coarse ? Math.max(6, 22 / cam.z) : 6) &&
      Math.abs(dy) < (coarse ? Math.max(10, 22 / cam.z) : 10)
    ) {
      const d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        best = a.id;
      }
    }
  }
  return best;
}
function settlementTileInfo(i) {
  if (!st) return null;
  for (const f of st.farmsteads) {
    const v = st.villages[f.village].name,
      where = `${f.name}, ${v}`;
    if (f.house === i) {
      if (f.household === null)
        return [
          f.name,
          [`Empty for ${emptyYears(f)} years`, 'No heir took it; claims come in the next batch'],
          { farm: f.id, house: true },
        ];
      const hh = st.households[f.household];
      return [
        f.name,
        [`Held by ${Sim.fullName(st.pawns[hh.holder])}; ${hh.members.length} live here`],
        { farm: f.id, house: true },
      ];
    }
    const fd = f.fields.find((q) => q.tile === i);
    if (fd) {
      const word = {
        stubble: 'Stubble, waiting for spring',
        plowed: 'Hoed, ready for sowing',
        sown: 'Freshly sown',
        young: 'Sprouting',
        growing: 'Growing',
        ripe: 'Ripe for reaping',
        stooks: 'Sheaves drying in stooks',
        fallow: 'Untended, gone to grass',
        scrub: 'Untended, gone to scrub',
      }[fd.stage === 'stooks' ? 'stooks' : cropStage(fd)];
      // the soil as two levels on the one meter: what the ground is worth, and how its crops and its dung have left it (100 is unworn)
      const cond = Math.round(fd.soil * 100);
      return [
        `Field of ${where}`,
        [word, f.household === null ? 'No one works it' : 'Owned by the household'],
        {
          farm: f.id,
          stats: stats([
            {
              icon: 'soil',
              label: 'Soil',
              value: Math.round(fd.fert * 100),
              note: Sim.byRiver(w, i) ? 'watered by the river' : '',
              title: 'The quality of the soil',
              meter: { value: fd.fert * 100 },
            },
            {
              icon: 'field',
              label: 'Condition',
              value: cond,
              note: cond < 99 ? 'worn by its crops' : cond > 101 ? 'dunged' : '',
              tone: cond < 99 ? 'warn' : '',
              title: 'How the crops and the dung have left it: 100 is unworn',
              meter: { value: cond, max: 150, marks: [{ at: 100, label: 'unworn at 100' }] },
            },
          ]),
        },
      ];
    }
  }
  for (const f of st.farmsteads) {
    const m = f.meadows.find((q) => q.tile === i);
    if (!m) continue;
    const word = {
      grass: m.raked ? 'Grass growing, raked clean in spring' : 'Grass growing',
      mown: 'Mown; the hay is drying',
      aftermath: 'Aftermath: the hay is in',
    }[m.stage];
    return [
      `Hay meadow of ${f.name}, ${st.villages[f.village].name}`,
      [
        word,
        `About ${Math.round(30 * m.fert)} hay in an ordinary year${Sim.byRiver(w, i) ? ', wet ground by the river' : ''}`,
      ],
      { farm: f.id },
    ];
  }
  for (const v of st.villages) {
    if (v.center === i && v.green) return [`Village green of ${v.name}`, [], { village: v.id }];
    // a common field (VB-100): worked by the village, its harvest into the village store
    const fd = (v.commonFields || []).find((q) => q.tile === i);
    if (fd)
      return [
        `Common field of ${v.name}`,
        [
          `${fieldSummary({ fields: [fd] }).replace(/^1 /, '')}, worked by the village`,
          `Soil quality ${Math.round(fd.fert * 100)}%; its seed and its harvest are the village store's`,
        ],
        { village: v.id },
      ];
  }
  return null;
}
