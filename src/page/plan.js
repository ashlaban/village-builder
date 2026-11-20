// @sys page/plan: the Plan tab of a household's card (VB-256; design.md section 7, The plan panel): its targets, the season's routines in
// order, the next steps of its fields and their windows, the project, the named tiles and what is reserved; read-only, but for the played
// pawn that is its head, whose controls choose through the head's verbs (Sim.head, VB-253) and say why a choice is refused
// ======== the plan panel ========
// The page's own state: the last choice's answer (planMsg: {text, bad, key}), shown at the head of the tab until the next choice, until
// the plan next changes (key: what the plan held when the answer was first shown, planKey) or until the tab is closed (drawPlanMarks):
// an answer is of its moment (VB-1027). What the plan says of the year ahead is its head's reckoning (AGENTS.md, Deciding without Kim,
// 14): the targets are the head's, by its foresight and bias.
let planMsg = null;
// What the plan holds, as one string: its targets, named tiles, order and project. A change of it retires the answer shown.
const planKey = (V) =>
  JSON.stringify([
    Object.values(V.targets).map((t) => t.now),
    Object.values(V.goods || {}).map((g) => g.now),
    V.tiles,
    V.order,
    V.project,
    V.heldOff,
  ]);
// The tile a household's project works on (its open step's place), or -1: the page reads sim/projects, as the Reserved rows do.
function projectTile(hh) {
  const p = VB['sim/projects'].projectOf(st, 'household', hh.id),
    s = p ? p.steps[p.open] : null;
  return s && Number.isInteger(s.place) ? s.place : -1;
}
// A "Show on map" link to tile t (VB-894): the same wherever the tab names a tile.
const flyBtn = (t, of) => planBtn({ plan: 'fly', tile: t }, 'Show on map', `Fly to the ${of}'s tile on the map`);
// The step of a stepper, by target: hay in quarter winters, the woodpile by the load, fields and the cow whole; a made good by one unit.
const PLAN_STEP = { hay: 0.25, wood: 1, fields: 1, cow: 1 };
// A made good's icon and its name in a row (sim/targets' MADE): its good's icon where the store has one.
const MADE_ICON = {
  bogOre: 'ore',
  ale: 'ale',
  'salt meat': 'meat',
  'dried fish': 'fish',
  butter: 'butter',
  tar: 'tar',
  quern: 'quern',
};
const MADE_NAME = { bogOre: 'Bog ore' };
const fmtN = (x) => String(Math.round(x * 100) / 100);
// The played pawn is household hh's head: the only one whose tab has controls (for anyone else it is read-only).
const planMine = (hh) => !!st.player && hh.holder !== null && st.player.pawn === hh.holder;
// A button of the tab: a choice, its data, its label, and whether it may be pressed.
const planBtn = (data, text, label, on = true, cls = '') =>
  `<button type="button" class="plan-btn${cls ? ' ' + cls : ''}" ${Object.entries(data)
    .map(([k, v]) => `data-${k}="${esc(String(v))}"`)
    .join(' ')} aria-label="${esc(label)}" title="${esc(label)}"${on ? '' : ' disabled'}>${text}</button>`;
// A target's row: the store's level on the one meter, marked at the custom's value and at the head's target, the level against the target
// in words with its unit (o.per); for the head, a stepper and, while it has chosen one, a way back to its rule's. A target with no cap
// (Infinity: what the milk,
// the meat or the fuel pile gives) reads "no cap", and its stepper's lower step sets one at the bounds' top. o.flag: a target that is a
// yes or no (the cow wanted), its words in place of a meter: [none held and none wanted, none held and one wanted, some and no more, some
// and one more].
function targetRow(key, o, mine) {
  const t = o.t,
    fin = (x) => x !== null && x !== undefined && Number.isFinite(x),
    custom = fin(t.custom) ? t.custom : null,
    fmt = (x) => (fin(x) ? (o.fmt || fmtN)(x) : 'no cap');
  const max = Math.max(o.level, fin(t.now) ? t.now : t.bounds ? t.bounds[1] : 0, custom || 0, 1) * 1.25,
    marks = [];
  if (custom !== null) marks.push({ at: custom, kind: 'custom', label: `the custom: ${fmt(custom)}` });
  if (fin(t.now))
    marks.push({
      at: t.now,
      kind: 'head',
      label: `${t.chosen !== null ? 'the head chose' : "the head's target"}: ${fmt(t.now)}`,
    });
  // the level against the target, with its unit (o.per: "winters of the herds' need"); a yes-or-no target in its own words
  const wants = o.flag ? o.flag[(o.level > 0 ? 2 : 0) + (t.now ? 1 : 0)] : '';
  let h = stat({
    icon: o.icon,
    label: o.label,
    value: o.flag ? `${fmtN(o.level)}, ${wants}` : `${fmt(o.level)} / ${fmt(t.now)}`,
    note: [o.flag ? '' : o.per, t.chosen !== null ? 'chosen' : ''].filter(Boolean).join(', '),
    tone: !o.flag && o.level < t.now ? 'warn' : '',
    title: `${o.label}: ${o.unit}; held ${fmtN(o.level)}, the head's target ${fmt(t.now)}${
      custom !== null ? `, the custom's ${fmt(custom)}` : ''
    }`,
    meter: o.flag ? null : { value: o.level, max, marks },
    wide: true,
  });
  if (mine && t.bounds) {
    const step = o.step,
      [lo, hi] = t.bounds,
      down = fin(t.now) ? Math.max(lo, Math.round((t.now - step) / step) * step) : hi,
      up = fin(t.now) ? Math.min(hi, Math.round((t.now + step) / step) * step) : hi;
    h += `<span class="plan-ctl">${planBtn(
      { plan: 'target', store: key, n: down },
      '−',
      `Lower the ${o.label.toLowerCase()} target to ${fmt(down)}`,
      down < t.now,
    )}${planBtn({ plan: 'target', store: key, n: up }, '+', `Raise the ${o.label.toLowerCase()} target to ${fmt(up)}`, up > t.now)}${
      t.chosen !== null
        ? planBtn(
            { plan: 'target', store: key, n: 'null' },
            '↺',
            `Let the head's rule set the ${o.label.toLowerCase()} target`,
          )
        : ''
    }</span>`;
  }
  return `<div class="plan-row" data-target="${esc(key)}">${h}</div>`;
}
function targetsHTML(hh, V, mine) {
  const f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead],
    need = Sim.winterNeed(st, hh),
    cows = Sim.herdsOf(st, hh).reduce((n, herd) => n + (herd.head || []).filter((x) => x.kind === 'cow').length, 0),
    T = V.targets;
  const rows = [
    targetRow(
      'hay',
      {
        icon: 'hay',
        label: 'Hay',
        unit: "in winters of the herds' need",
        per: 'winters', // of the herds' need: the row's title says it whole
        level: need > 0 ? hh.hay / need : 0,
        t: T.hay,
        step: PLAN_STEP.hay,
        fmt: (x) => `${fmtN(x)}`,
      },
      mine,
    ),
    targetRow(
      'wood',
      {
        icon: 'wood',
        label: 'Firewood',
        unit: 'in loads, for this season',
        per: 'loads',
        level: hh.wood,
        t: T.wood,
        step: PLAN_STEP.wood,
        fmt: (x) => `${Math.round(x)}`,
      },
      mine,
    ),
    f
      ? targetRow(
          'fields',
          {
            icon: 'field',
            label: 'Fields',
            unit: 'fields',
            level: f.fields.length,
            t: T.fields,
            step: PLAN_STEP.fields,
          },
          mine,
        )
      : '',
    targetRow(
      'cow',
      {
        icon: 'beast',
        label: 'Cows',
        unit: 'whether a further milk cow is wanted',
        // with none held, with some: "2, no more wanted", never "2, none wanted" (which read as two unwanted)
        flag: ['none wanted', 'one wanted', 'no more wanted', 'one more wanted'],
        level: cows,
        t: T.cow,
        step: PLAN_STEP.cow,
      },
      mine,
    ),
  ];
  // the goods it makes (VB-698, VB-865): the head's target on each beside the need its rule reads
  const goods = Object.entries(V.goods || {}).map(([good, g]) =>
    targetRow(
      good,
      {
        icon: MADE_ICON[good] || good,
        label: MADE_NAME[good] || capital(good),
        unit: `in ${g.unit}s`,
        per: `${g.unit}s`,
        level: g.held,
        t: { now: g.now, custom: g.custom, chosen: g.chosen, bounds: g.bounds },
        step: 1,
      },
      mine,
    ),
  );
  return rows.join('') + section('Goods made') + goods.join('');
}
// The season's routines in the order they are done; the head moves one up or down (until the next season's plan is made). What the head
// orders, the season's work, is the list; what is done daily whatever the season's work (PLAN_DAILY: the kinds have no word for it, so
// the page names them, VB-1027) is folded under it, with the same controls, since the order is still the head's to change: a move is
// among a routine's own group, and passes over the other's.
const PLAN_DAILY = ['water', 'cook', 'fodder', 'milk'];
let planDailyOpen = false;
function routinesHTML(V, mine) {
  const by = V.orderBy === 'head' ? 'in the order the head chose' : "in the custom's order",
    at = V.order.map((k, i) => ({ k, i })),
    groups = [at.filter((x) => !PLAN_DAILY.includes(x.k)), at.filter((x) => PLAN_DAILY.includes(x.k))];
  const list = (g) =>
    '<ol class="plan-order">' +
    g
      .map(({ k, i }, n) => {
        const name = (Sim.KINDS[k] && Sim.KINDS[k].name) || k;
        return (
          `<li data-routine="${esc(k)}">${actIcon(KIND_ICON[k] || 'hoe')}<span>${esc(name)}</span>` +
          (mine
            ? `<span class="plan-ctl">${planBtn(
                { plan: 'order', from: i, to: n > 0 ? g[n - 1].i : i },
                '↑',
                `Move ${name} up`,
                n > 0,
              )}${planBtn(
                { plan: 'order', from: i, to: n < g.length - 1 ? g[n + 1].i : i },
                '↓',
                `Move ${name} down`,
                n < g.length - 1,
              )}</span>`
            : '') +
          `</li>`
        );
      })
      .join('') +
    '</ol>';
  const daily = groups[1].length
    ? `<details class="plan-daily"${planDailyOpen ? ' open' : ''}><summary>${esc(
        `Done daily: ${groups[1].map((x) => ((Sim.KINDS[x.k] && Sim.KINDS[x.k].name) || x.k).toLowerCase()).join(', ')}`,
      )}</summary>${list(groups[1])}</details>`
    : '';
  return `<p class="card-note">${esc(`${Sim.SEASONS[Sim.cal(st.t).season]}: ${by}`)}</p>` + list(groups[0]) + daily;
}
// When a crop's window is: its season and days, and whether it is open now, or how many days until it opens (the calendar's, not a guess).
function windowWords(w) {
  const c = Sim.cal(st.t),
    days = `${Sim.SEASONS[w[0]]} ${w[1] + 1}–${w[2] + 1}`;
  if (c.season === w[0] && c.sday >= w[1] && c.sday <= w[2]) return `${days}, open now`;
  const now = c.season * Sim.SEASON_DAYS + c.sday,
    at = w[0] * Sim.SEASON_DAYS + w[1],
    until = (at - now + Sim.YEAR_DAYS) % Sim.YEAR_DAYS;
  return `${days}, in ${until} ${until === 1 ? 'day' : 'days'}`;
}
// Each field's next step and its window: hoeing and sowing in the crop's window, the days grown toward ripe, reaping, threshing.
function stepsHTML(hh) {
  const f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
  if (!f || !f.fields.length) return '<p class="card-note">No fields.</p>';
  const CROPS = VB['sim/rules'].CROPS,
    day = Math.floor(st.t / Sim.DAY);
  const rows = f.fields.map((fd, i) => {
    const C = CROPS[fd.crop],
      label = `Field ${i + 1}`,
      crop = fd.crop;
    if (fd.stage === 'sown' || fd.stage === 'growing') {
      const g = Math.max(0, day - fd.sown);
      return {
        icon: 'field',
        label,
        value: `${Math.min(g, C.ripe)} of ${C.ripe} days`,
        note: `${crop} growing; reap when ripe`,
        meter: { value: Math.min(g, C.ripe), max: C.ripe, marks: [] },
        title: `${label}: ${crop}, sown ${g} days ago; ripe after ${C.ripe} days`,
      };
    }
    const [img, what] =
      fd.stage === 'ripe'
        ? ['mow', `reap the ${crop}`]
        : fd.stage === 'stooks'
          ? ['sack', `carry in and thresh the ${crop}`]
          : fd.stage === 'fallow' || fd.stage === 'scrub'
            ? ['spade', `reclaim it: gone to ${fd.stage === 'scrub' ? 'scrub' : 'grass'}`]
            : C.fallow
              ? ['hoe', `till it, fallow: ${windowWords(C.sow)}`]
              : fd.stage === 'plowed'
                ? ['sow', `sow ${crop}: ${windowWords(C.sow)}`]
                : ['hoe', `hoe, then sow ${crop}: ${windowWords(C.sow)}`];
    return { img: actIcon(img), label, value: '', note: what, wide: true, title: `${label}: ${what}` };
  });
  return `<div class="plan-steps">${stats(rows)}</div>`;
}
// The tiles the plan names for its next field and meadow, and the head's way to choose one on the map.
function tilesHTML(hh, V, mine) {
  const f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
  if (!f || f.household !== hh.id) return '';
  return ['field', 'meadow']
    .map((what) => {
      const t = V.tiles[what],
        name = what === 'field' ? 'Next field' : 'Next hay meadow',
        // the project under way is making one of this kind: the row below names its tile, and this one is the one after it
        making = t < 0 && V.project && V.project.what === what;
      const h = stat({
        icon: what === 'field' ? 'field' : 'meadow',
        label: name,
        value: t >= 0 ? '' : making ? 'after the one being made' : "the head's pick",
        note: t >= 0 ? `tile ${t}` : '',
        wide: true,
        title:
          t >= 0
            ? `${name}: the tile chosen`
            : making
              ? `${name}: one is being made (the project below shows where); the head picks the next one's tile when it wants one`
              : `${name}: the head picks its tile when it wants one`,
      });
      const fly = t >= 0 ? flyBtn(t, name.toLowerCase()) : '';
      const ctl = mine
        ? `<span class="plan-ctl">${fly}${planBtn(
            { plan: 'tile', what },
            'Choose the tile',
            `Choose the tile of the ${name.toLowerCase()} on the map`,
            true,
            'wide',
          )}${
            t >= 0
              ? planBtn({ plan: 'tile', what, clear: 1 }, '↺', `Let the head pick the ${name.toLowerCase()}'s tile`)
              : ''
          }</span>`
        : '';
      return `<div class="plan-row" data-tile="${what}">${h}${mine ? ctl : fly ? `<span class="plan-ctl">${fly}</span>` : ''}</div>`;
    })
    .join('');
}
// The project under way and its step, or none; the head begins one from the menu, gives it up, or holds off projects.
function projectHTML(hh, V, mine) {
  const pj = V.project,
    at = pj ? projectTile(hh) : -1,
    fly = at >= 0 ? `<span class="plan-ctl">${flyBtn(at, 'project')}</span>` : '';
  const h = pj
    ? stat({
        img: actIcon('spade'),
        label: `New ${pj.what === 'meadow' ? 'hay meadow' : pj.what}`,
        value: pj.step,
        note: at >= 0 ? `tile ${at}` : '',
        wide: true,
        title: "The household's project, its step under way and the tile it is on",
      })
    : stat({
        img: actIcon('spade'),
        label: 'Project',
        value: V.heldOff ? 'held off' : 'none',
        wide: true,
        title: V.heldOff ? 'The head holds off projects' : 'No project under way',
      });
  if (!mine) return `<div class="plan-row" data-project>${h}${fly}</div>`;
  const menu = pj
    ? planBtn({ plan: 'drop' }, 'Give it up', 'Give up the project under way', true, 'wide')
    : planBtn(
        { plan: 'project', what: 'field' },
        'Begin a field',
        'Begin a new field now, on the tile named or the head’s pick',
        true,
        'wide',
      ) +
      planBtn(
        { plan: 'project', what: 'meadow' },
        'Begin a meadow',
        'Begin a new hay meadow now, on the tile named or the head’s pick',
        true,
        'wide',
      );
  const hold = V.heldOff
    ? planBtn(
        { plan: 'project', what: 'null' },
        'Let the head begin them',
        "Let the head's rule begin projects again",
        true,
        'wide',
      )
    : planBtn({ plan: 'project', what: 'none' }, 'Hold off', 'Begin no project by the rule until told', true, 'wide');
  return `<div class="plan-row" data-project>${h}${fly}<span class="plan-ctl menu">${menu}${hold}</span></div>`;
}
// What is reserved, by good: the plan's own (the seed) and its projects' (what their steps will spend).
function reservedHTML(hh) {
  const plan = st.plans.households.get(hh.id),
    by = {};
  const add = (res, reasons, why) => {
    for (const good in res || {})
      if (res[good] > 1e-9) {
        const k = `${good}|${(reasons && reasons[good]) || why}`;
        by[k] = (by[k] || 0) + res[good];
      }
  };
  if (plan) add(plan.reserved, plan.reasons, 'seed');
  for (const p of VB['sim/projects'].projectsOf(st, 'household', hh.id)) add(p.reserved, p.reasons, 'build');
  const WHY = { seed: 'for seed', build: 'for the project', field: 'for a new field' };
  const rows = Object.entries(by).map(([k, n]) => {
    const [good, why] = k.split('|'),
      grain = good.startsWith('grain');
    return {
      icon: grain ? 'grain' : good,
      label: capital(grain ? good.split('/')[1] || 'grain' : good),
      value: Math.round(n),
      note: WHY[why] || why,
      title: `${Math.round(n)} ${good} held back ${WHY[why] || why}`,
    };
  });
  return rows.length ? stats(rows) : '<p class="card-note">Nothing reserved.</p>';
}
// The tab: read from the plan's view (Sim.headView) and the household's stores; null view, no plan.
function planTab(hh) {
  const V = Sim.headView(st, hh.id);
  if (!V) return '<p class="card-note">This household has no plan.</p>';
  const mine = planMine(hh),
    head = V.head ? Sim.fullName(st.pawns[V.head.pawn]) : null;
  if (planMsg) {
    const key = planKey(V);
    if (planMsg.key === undefined) planMsg.key = key;
    else if (planMsg.key !== key) planMsg = null; // the plan has changed since: the answer is of an earlier plan
  }
  const msg =
    mine && planMsg ? `<p class="plan-msg${planMsg.bad ? ' bad' : ''}" role="status">${esc(planMsg.text)}</p>` : '';
  return (
    msg +
    `<p class="card-note">${esc(
      head
        ? `${mine ? 'Your plan, as head' : `${head}'s plan`}: the targets by ${mine ? 'your' : 'the head’s'} reckoning.`
        : 'No head: the custom’s plan.',
    )}</p>` +
    section('Targets') +
    markKey() +
    targetsHTML(hh, V, mine) +
    section('This season') +
    routinesHTML(V, mine) +
    section('Next steps') +
    stepsHTML(hh) +
    tilesHTML(hh, V, mine) +
    section('Project') +
    projectHTML(hh, V, mine) +
    section('Reserved') +
    reservedHTML(hh)
  );
}
// A choice from the tab: through the head's verb, its answer kept to show; the tile's waits for a click on the map (the action bar's tool).
function planClick(b, hh) {
  const d = b.dataset;
  let r;
  if (d.plan === 'fly') {
    flyTo(w.hx[+d.tile], w.hy[+d.tile]);
    return;
  }
  if (d.plan === 'target') r = Sim.head(st, 'target', { store: d.store, n: d.n === 'null' ? null : +d.n });
  else if (d.plan === 'order') {
    const steps = Sim.headView(st, hh.id).order,
      [x] = steps.splice(+d.from, 1);
    steps.splice(+d.to, 0, x);
    r = Sim.head(st, 'order', { steps });
  } else if (d.plan === 'tile' && d.clear) r = Sim.head(st, 'tile', { what: d.what, tile: null });
  else if (d.plan === 'tile') {
    const { sites, why } = planSites(d.what, hh),
      title = d.what === 'field' ? 'The next field' : 'The next hay meadow';
    // no tile would do: said at once, with the rule's reason, and the tool stays out of hand (VB-1027)
    if (!sites.length) {
      planMsg = { text: `${title}: no tile will take it; ${why}.`, bad: true };
      return;
    }
    planMsg = null;
    startTool({
      kind: 'plan',
      what: d.what,
      farm: hh.farmstead,
      icon: 'spade',
      title,
      needs: 'a tile for it',
      keep: false,
      sites,
    });
    renderActions();
    return;
  } else if (d.plan === 'project') r = Sim.head(st, 'project', { what: d.what === 'null' ? null : d.what });
  else if (d.plan === 'drop') r = Sim.head(st, 'dropProject', {});
  else return;
  planMsg = r === true ? { text: `Done: ${b.getAttribute('aria-label')}.` } : { text: r, bad: true };
}
// The tiles that would take the next field or meadow, read once at the tool's start: those within the farm's reach (the walk of the rule,
// REACH_FIELD or REACH_MEADOW steps) that the rule's own check (fieldWhy, meadowWhy) lets through, the same as the verb's. With them, for
// when there is none, why: the rule's reason that refuses the most tiles within reach (the house's own tile aside), in the rule's words.
const PLAN_REACH = { field: 4, meadow: 6 };
function planSites(what, hh) {
  const f = st.farmsteads[hh.farmstead],
    why = what === 'field' ? VB['sim/fields'].fieldWhy : VB['sim/meadows'].meadowWhy,
    built = VB['sim/fields'].builtTiles(st),
    sites = [],
    reasons = new Map();
  for (const t of VB['sim/hex'].bfs(st.w, f.house, PLAN_REACH[what], VB['sim/walking'].walkable(st.w)).dist.keys()) {
    const r = why(st, f, hh, t, built);
    if (r === null) sites.push(t);
    else if (t !== f.house) reasons.set(r, (reasons.get(r) || 0) + 1);
  }
  const top = [...reasons].sort((a, b) => b[1] - a[1])[0];
  return { sites, why: top ? top[0] : 'no tile is within reach of the house' };
}
// The tiles the plan names, marked in the plan's colour while the farm's Plan tab is open (called each frame, page/animate); redrawn when
// they or the zoom change.
let planMarkKey = '';
const planG = new PIXI.Graphics();
L.hover.addChild(planG);
function drawPlanMarks() {
  const hh = cardTab === 'plan' && !$('tileHouse').hidden && st ? houseShown() : null,
    plan = hh && st.plans.households.get(hh.id),
    named = plan ? [plan.tiles.field, plan.tiles.meadow, projectTile(hh)].filter((t) => t >= 0) : [],
    key = named.length ? `${named.join(',')}|${cam.z.toFixed(3)}` : '';
  if (!hh && planMsg && !(tool && tool.kind === 'plan')) planMsg = null; // the tab is closed: its answer goes with it (VB-1027)
  if (key === planMarkKey) return;
  planMarkKey = key;
  planG.clear();
  for (const i of named)
    planG
      .poly(hexPoly(i, 0.9))
      .fill({ color: 0xffd23f, alpha: 0.25 })
      .stroke({ width: 3 / cam.z, color: 0xffd23f, alpha: 0.95 });
}
// the daily routines' fold is kept open or shut across the tab's redraws
$('tileHouse').addEventListener(
  'toggle',
  (e) => {
    if (e.target.matches && e.target.matches('details.plan-daily')) planDailyOpen = e.target.open;
  },
  true,
);
$('tileHouse').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-plan]'),
    hh = houseShown();
  if (!b || !hh || !st || b.disabled) return;
  planClick(b, hh);
  houseHTML = '';
  syncTabs();
});
// The tile pointed at while the plan's tool is in hand (page/tileinfo, pick): what it is, in the tool's banner, so that tiles are
// compared without putting the tool down (VB-1027). What is, not what will be: its fertility as a field (open meadow 100; the river's
// water counted), whether the river waters it, the walk from the house, and, where the rule would refuse it, why. The harvest it would
// give is an estimate, and plan mode's (VB-1026).
function planPoint(i) {
  if (i === tool.at) return;
  tool.at = i;
  tool.facts = '';
  if (i >= 0 && !w.water[i]) {
    const R = VB['sim/rules'],
      hh = st.households[st.farmsteads[tool.farm].household],
      f = st.farmsteads[tool.farm],
      d = VB['sim/hex'].bfs(st.w, f.house, PLAN_REACH[tool.what], VB['sim/walking'].walkable(st.w)).dist.get(i),
      why = (tool.what === 'field' ? VB['sim/fields'].fieldWhy : VB['sim/meadows'].meadowWhy)(st, f, hh, i);
    tool.facts = [
      G.BIOMES[w.biome[i]].name,
      R.farmable(w, i) ? `fertility ${Math.round(R.fertility(w, i) * 100)}` : '',
      Sim.byRiver(w, i) ? 'by the river' : '',
      d === undefined ? '' : `${d} ${d === 1 ? 'step' : 'steps'} from the house`,
      why === null ? 'would do' : why,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  paintBanner();
}
// A tap on the map while the plan's tool is in hand (page/actbar, toolTap): the tile named for the next field or meadow, or the refusal's
// reason in the banner and the tool kept for another tap; once named, the farm's card opens again on its Plan tab.
function planTap(i) {
  const t = tool,
    r = i < 0 ? 'no tile there' : Sim.head(st, 'tile', { what: t.what, tile: i });
  if (r !== true) {
    tool.msg = { text: r, bad: true };
    return;
  }
  tool = null;
  planMsg = { text: `The ${t.what === 'field' ? 'next field' : 'next hay meadow'} will be made on tile ${i}.` };
  cardTab = 'plan';
  houseHTML = '';
  selectFarm(t.farm, false);
}
