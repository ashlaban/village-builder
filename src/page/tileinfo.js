// @sys page/tileinfo: the tile info panel
// ---- tile info ----
let tileWhere = ''; // the selected tile's column, row and region, for Debug
function showTile(i) {
  const box = $('tile');
  if (i < 0 || !w) {
    box.hidden = true;
    selVillage = -1;
    selFarm = -1;
    return;
  }
  const b = G.BIOMES[w.biome[i]],
    col = i % w.COLS,
    row = (i / w.COLS) | 0;
  let line;
  if (w.water[i]) {
    const d = w.csample(w.cdist, w.hx[i], w.hy[i]);
    const m = b.key === 'lake' ? 2 + 28 * (1 - Math.exp(-d / 70)) : 3 + 150 * (1 - Math.exp(-d / (150 * w.KS)));
    line = `Depth about ${Math.round(m)} m`;
  } else {
    const soil = w.hm[i] < 0.33 ? 'dry ground' : w.hm[i] < 0.56 ? 'fresh ground' : 'damp ground';
    line = `Elevation ${Math.max(2, Math.round(w.he[i] * 1400))} m, ${soil}`;
  }
  const rg = w.regions[w.region[i]];
  const where = rg.label ? `Tile ${col}, ${row} in region ${rg.label}` : `Tile ${col}, ${row}, open water`;
  const farm = settlementTileInfo(i),
    own = st ? Sim.ownerOf(st, i) : null,
    of = farm ? farm[2] : null;
  // the green stands for its village; a house for its farm, whose card is kept fresh while it is shown
  if (of && of.village !== undefined) {
    selVillage = of.village;
    selFarm = -1;
    showVillage(of.village);
    return;
  }
  selVillage = -1;
  selFarm = of && of.house ? of.farm : -1;
  const ownLine = own
    ? [
        own.type === 'village'
          ? `${st.villages[own.id].name} village`
          : `${st.farmsteads[st.households[own.id].farmstead].name} household`,
      ]
    : [];
  const cross = ['no crossing on foot here', 'a ford crosses it', 'a bridge crosses it'][w.crossing[i]];
  const perDay = w.worn ? w.wear[i] / 70 : 0; // a count kept up by n crossings a day settles at about 70 n
  const worn =
    w.worn && w.worn[i]
      ? [
          `${['', 'Trodden ground', 'A worn path', 'A lane'][w.worn[i]]}, ${
            perDay >= 0.75 ? `crossed about ${Math.round(perDay)} times a day` : 'little used now'
          }`,
        ]
      : [];
  const river = w.river[i]
    ? [`${Rivers.kind(w, i)} runs through; ${cross}`]
    : !w.water[i] && Sim.byRiver(w, i)
      ? [`By the river: a field here yields ${Math.round(Sim.RIVER.irrigation * 100)}% more`]
      : [];
  const claims = claimLines(i),
    cutBy = st && Sim.woodOf(st, i); // the village whose wood the tile is (VB-326)
  if (cutBy) claims.push(`Cut for firewood by ${cutBy.name}`);
  tileWhere = where; // the tile's place in numbers is Debug's (page/drawer), not the player's card's (VB-664)
  const strength = claimStats(i);
  if (farm) {
    const more = tileExtras(of);
    card(farm[0], [...farm[1], ...(of.house ? [] : ownLine), ...claims], '', {
      ...more,
      stats: (more.stats || '') + strength,
    });
  } else
    card(
      b.name,
      [
        line,
        ...river,
        ...worn,
        ...ownLine,
        ...claims,
        ...(w.treesMax[i] > 0 ? [`${Math.round(w.trees[i])} of ${w.treesMax[i]} trees`] : []),
        ...(w.stones[i] > 0 ? [`${w.stones[i] < 85 ? 'Few' : w.stones[i] < 170 ? 'Some' : 'Many'} stones`] : []),
        ...groundLines(i),
      ],
      '',
      { stats: strength },
    );
}
// ---- a field's crop, and the head's choice of it (VB-355; design.md, How the head chooses what to sow) ----
// A field's part of its tile's card, from Sim.fieldView: its crop (with its own icon), its course in the farm's rotation, what is sown on
// it next and when, and the grain of each crop its household holds against a field's seed, as stats above its soil; and for the played
// head of the farm, the choices: the farm's rotation, and this field's crop out of turn this year. A choice goes through the verb
// (Sim.head) and the verb answers: a choice it would refuse today is dimmed, with its reason as its title and, pressed, as the answer.
let fieldMsg = null; // the last choice's answer: {tile, text, bad}, shown on that field's card until another tile is shown
const cropName = (k) => (k === 'fallow' ? 'fallow' : k),
  cropIcon = (k) => (k === 'barley' ? 'grain' : k),
  cap = (s) => s[0].toUpperCase() + s.slice(1);
function fieldCard(i, fd, f) {
  const V = Sim.fieldView(st, i);
  if (!V) return { stats: [], list: '' };
  if (fieldMsg && fieldMsg.tile !== i) fieldMsg = null;
  const CROPS = VB['sim/rules'].CROPS,
    fallow = CROPS[V.crop].fallow,
    path = V.courses.map(cropName).join(', then ');
  const rows = [
    {
      icon: cropIcon(V.crop),
      label: fallow ? 'Resting' : 'Crop',
      value: fallow ? 'fallow' : V.crop,
      note: V.turn ? 'out of turn this year' : '',
      wide: true,
      title: fallow ? 'The field rests this year' : 'What the field bears this year',
    },
    {
      icon: 'field',
      label: 'Course',
      value: V.courses.length > 1 ? `${V.step + 1} of ${V.courses.length}` : 'every year',
      note: V.courses.length > 1 ? V.label : 'barley',
      wide: true,
      title: `The farm's rotation: ${path}${V.kept ? "; its head's choice" : ''}`,
    },
    V.next && {
      icon: 'seed',
      label: 'Sown next',
      value: V.next.crop,
      note: V.next.when,
      wide: true,
      title: 'The crop sown on this field next, and its sowing days',
    },
    ...V.seed.map((x) => ({
      icon: cropIcon(x.crop),
      label: `${cap(x.crop)} held`,
      value: Math.floor(x.held),
      note: x.held >= x.field ? `seed for ${Math.floor(x.held / x.field)} fields` : `a field takes ${x.field}`,
      tone: x.held >= x.field ? '' : 'warn',
      wide: true,
      title: `The ${x.crop} in the household's store: a field takes ${x.field} for seed`,
    })),
  ];
  const word =
    fallow && fd.stage === 'stubble' ? (fd.rest === 1 ? 'Fallow this year, tilled' : 'Fallow this year') : '';
  const mine = st.player && V.household !== null && st.households[V.household].holder === st.player.pawn;
  if (!mine) return { stats: rows, list: '', word };
  const btn = (data, icon, text, title, off, on) =>
    `<button type="button" class="plan-btn wide field-btn${on ? ' on' : ''}${off ? ' off' : ''}" ${Object.entries(data)
      .map(([k, v]) => `data-${k}="${esc(String(v))}"`)
      .join(
        ' ',
      )} aria-label="${esc(title)}" title="${esc(title)}"${on ? ' aria-pressed="true"' : ''}>${icon}${esc(text)}</button>`;
  const rotations = V.rotations
    .map((r) =>
      btn(
        { field: 'rotation', key: r.key },
        r.courses.map((k) => goodIcon(cropIcon(k))).join(''),
        r.label,
        r.why ? `${cap(r.label)}: ${r.why}` : `Farm ${r.label}: ${r.courses.map(cropName).join(', then ')}`,
        !!r.why,
        r.key === V.rotation,
      ),
    )
    .join('');
  const back = V.kept
    ? btn(
        { field: 'rotation', key: '' },
        '',
        'as the village does',
        "Leave the rotation to the household's rule again",
        false,
        false,
      )
    : '';
  const crops = V.crops
    .map((x) =>
      btn(
        { field: 'turn', crop: x.crop },
        goodIcon(cropIcon(x.crop)),
        cropName(x.crop),
        x.crop === V.crop
          ? `The field bears ${cropName(x.crop)} this year`
          : x.why
            ? `${cap(cropName(x.crop))}: ${x.why}`
            : CROPS[x.crop].fallow
              ? 'Rest this field this year'
              : `Sow this field with ${x.crop} this year`,
        !!x.why && x.crop !== V.crop,
        x.crop === V.crop,
      ),
    )
    .join('');
  const msg = fieldMsg
    ? `<p class="plan-msg${fieldMsg.bad ? ' bad' : ''}" role="status">${esc(fieldMsg.text)}</p>`
    : '';
  return {
    stats: rows,
    word,
    list:
      `${msg}<h3>The farm's rotation</h3><div class="field-ctl">${rotations}${back}</div>` +
      `<h3>This field, this year</h3><div class="field-ctl">${crops}</div>`,
  };
}
// A choice pressed on a field's card: the verb is issued for the played head, and its answer shown on the card.
function fieldChoice(e) {
  const b = e.target.closest('button[data-field]');
  if (!b || !st || sel < 0) return;
  const d = b.dataset,
    r =
      d.field === 'rotation'
        ? Sim.head(st, 'rotation', d.key ? { rotation: d.key, hold: true } : { rotation: null })
        : Sim.head(st, 'sowOutOfTurn', { tile: sel, crop: d.crop });
  fieldMsg = { tile: sel, text: r === true ? `Done: ${b.getAttribute('aria-label')}.` : cap(r) + '.', bad: r !== true };
  showTile(sel);
}
$('tileList').addEventListener('click', fieldChoice);
// What lies in the ground (gen/geology): the bedrock, and a deposit with the loads left in it. Nothing digs yet. An upland ore shows only
// as the viewer knows it (page/ground's depositShown).
function groundLines(i) {
  if (!w.rock || !w.rock[i]) return [];
  const how = w.deposit[i] ? depositShown(i) : 0,
    d = how ? w.deposit[i] : 0,
    left = st ? Sim.depositLeftNow(st, i) : w.depositLeft[i];
  return [
    `${Geo.ROCKS[w.rock[i]].name} bedrock`,
    ...(d
      ? [
          `${Geo.DEPOSITS[d].name}: ${left === Geo.ENDLESS ? 'more than can ever be dug' : `about ${left} loads`}${
            how === 2 ? ', which no village has found' : ''
          }`,
        ]
      : []),
  ];
}
// The claims on a tile (sim/claims) and its cairn (VB-157), one line each, for the tile panel.
function claimLines(i) {
  if (!st) return [];
  const who = (by) =>
    by.type === 'village'
      ? st.villages[by.id].name
      : by.type === 'household'
        ? st.farmsteads[st.households[by.id].farmstead].name
        : `the family of ${Sim.fullName(st.pawns[by.id])}`;
  const WHY = {
    outland: 'as outland',
    field: 'for a field',
    meadow: 'for a hay meadow',
    farm: 'to take the farm',
    birthright: 'by birthright',
  };
  const out = Sim.claimsOn(st, i).map((c) =>
    c.state === 'realised'
      ? `Held ${WHY[c.why]} by ${who(c.by)}${c.until !== null ? ` until year ${Math.floor(c.until / Sim.YEAR) + 1}` : ''}`
      : `Claimed by ${who(c.by)} ${WHY[c.why]}`,
  );
  const cairn = st.cairns && st.cairns.get(i);
  if (cairn)
    out.push(
      `A cairn between ${st.villages[cairn.a].name} and ${st.villages[cairn.b].name}, set in year ${Math.floor(cairn.t / Sim.YEAR) + 1}`,
    );
  return out;
}
// How strong each open claim on a tile is, on the one meter (VB-664), in the order of claimLines.
function claimStats(i) {
  if (!st) return '';
  const open = Sim.claimsOn(st, i).filter((c) => c.state !== 'realised');
  return open.length
    ? stats(
        open.map((c) => {
          const x = Math.round(Sim.claimStrength(st, c) * 100),
            by =
              c.by.type === 'village'
                ? st.villages[c.by.id].name
                : c.by.type === 'household'
                  ? st.farmsteads[st.households[c.by.id].farmstead].name
                  : Sim.fullName(st.pawns[c.by.id]);
          return {
            icon: 'tile',
            label: 'Claim',
            value: x,
            note: by,
            title: `How strong the claim of ${by} is`,
            meter: { value: x },
          };
        }),
      )
    : '';
}
function pick(sx, sy, inspect = true) {
  if (!w || document.body.classList.contains('ui-hidden') || startOpen()) return; // the start's picture is only dragged and zoomed
  if (choose) {
    if (inspect) chooseAt(sx, sy);
    return;
  } // whom to play takes the map's clicks (page/choose)
  if (!$('editor').hidden) {
    // the editor: no cards; the tile under the pointer is only marked
    const [ex, ey] = toWorld(sx, sy),
      t = loc(ex, ey, [0, 0]);
    if (t !== sel) {
      sel = t;
      selPawn = -1;
      hoverDirty = true;
    }
    return;
  }
  if (!inspect && tool && tool.kind === 'plan') {
    planPoint(loc(...toWorld(sx, sy), [0, 0])); // the plan's tool reads the tile pointed at into its banner (page/plan, VB-1027)
    return;
  }
  if (!inspect && (selectionPinned || barMenu || tool || (activePanel && activePanel !== 'tile'))) return; // no hover card over the action bar's list or tool
  if (inspect) selectionPinned = true;
  const [x, y] = toWorld(sx, sy),
    pw = pawnAt(x, y);
  if (inspect && tool) {
    toolTap(pw, labelAt(x, y), loc(x, y, [0, 0]));
    return;
  } // the action bar's tool waits for a tile (page/actbar)
  const og = inspect ? gatheringAt(x, y) : -1; // a gathering's mark, over its people's heads, opens its card (VB-1032, page/gathering)
  if (og >= 0) {
    selectGathering(og);
    return;
  }
  if (pw >= 0) {
    if (inspect || pw !== selPawn) selectPawn(pw, inspect);
    return;
  }
  const named = inspect ? labelAt(x, y) : null; // a click on a name on the map selects the village or the lone farm it names
  if (named) {
    if (named.village !== undefined) selectVillage(named.village, false);
    else selectFarm(named.farm, false);
    return;
  }
  const i = loc(x, y, [0, 0]);
  if (inspect || !activePanel) openPanel('tile');
  if (i !== sel || selPawn >= 0 || inspect) {
    selPawn = -1;
    sel = i;
    hoverDirty = true;
    showTile(i);
  }
}
function drawHover() {
  hoverG.clear();
  if (sel < 0 || !w || selPawn >= 0) return;
  const pts = [];
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 180) * (30 + 60 * k);
    pts.push(w.hx[sel] + Math.cos(a) * w.R, w.hy[sel] + Math.sin(a) * w.R);
  }
  hoverG
    .poly(pts)
    .fill({ color: 0xffffff, alpha: 0.14 })
    .stroke({ width: 2.4 / cam.z, color: 0xffffff, alpha: 0.95 });
}
