// The stocks map (VB-337): for each stored quantity of a household, a farm, a village and a tile, the modules that add to it, those that take
// from it, and those that read it without writing it; and, written by hand, what happens when there is none.
// node tools/stocks.js            a table a quantity, then the quantities read by nothing and those only shown
// node tools/stocks.js --json     the same as JSON
// Built on the writes map (tools/writes.js): its fields' write sites and read sites, by module and line, and the calls of sim/stores' operations
// (put, take, move, cook, sheaf, thresh, spoil, dug, start, brew, pour, spoilAle, villageDay) with their good and reason, found in the
// modules' syntax (acorn). A line is placed in its function (the innermost named one; a job kind's property as `kind.property`).
// - adds and takes: a store operation (by its good; a grain call is the village's when its holder or reason names a village), or a direct
//   write: `+=`, `++` and push add; `-=`, `--`, filter, splice, shift and pop take; `=` and `*=` set. A take is a use unless its reason
//   is a loss (spoilage, burn) or a transfer between holders (gift, share, handingOn, provisions, start), or, for a direct write, its
//   function is one of the line's `losses`.
// - reads: a read site in the simulation (not sim/stores, sim/saves or the generator) in a function that does not change the quantity;
//   reads in its own job kinds' `available` and `urgency` are not counted (they only refill it).
// - marked `read by nothing`: no read and no use in the simulation; `shown only`: besides, its own job kinds do not read it either and the
//   page shows it.
// The table QUANTITIES below is written by hand, a line a quantity with what its lack costs (`none`); every field of the `@state` lines of
// households, farms, villages and tiles is either in a line or in NOT_STOCKS, which tests/review-tools.js checks (npm test). A new stored
// quantity adds its line here, with its `none`.
require('./help.js')(__filename);
const fs = require('fs'), path = require('path'), acorn = require('acorn'), Writes = require('./writes.js');
const ROOT = path.join(__dirname, '..');

// ---- the table, by hand: a line a stored quantity ----
// fields: the writes map's fields it is (entity.field); covers: other @state fields it stands for; good, holder: its sim/stores good and holder,
// when it moves through the stores; kinds: the job kinds that fill it; losses: functions ('module:function') whose direct takes lose it.
const QUANTITIES = [
  { id: 'grain', of: 'household', name: 'grain', unit: 'rations', fields: ['household.grain'], good: 'grain', holder: 'household', kinds: ['thresh'],
    none: 'meals and the larder feed the household; then the seed is eaten and fields go unsown; then its members go hungry, slow and lose '
      + 'health (sim/hunger), and it asks kin and the village for food (sim/help)' },
  { id: 'meals', of: 'household', name: 'meals', unit: 'rations', fields: ['household.meals'], good: 'meals', holder: 'household',
    kinds: ['cook', 'fish', 'gather'],
    covers: ['household.cookDay'],
    none: 'the household eats its grain uncooked, at the same ration (sim/hunger): nothing is lost by not cooking' },
  { id: 'sheaves', of: 'household', name: 'sheaves in the barn', unit: 'rations', fields: ['household.unthreshed'], good: 'sheaves', holder: 'household',
    kinds: ['haul'], none: 'nothing to thresh: the threshing job is not posted' },
  { id: 'larder', of: 'household', name: 'the larder (meat, salt meat, milk, butter)', unit: 'rations', fields: ['household.larder'],
    kinds: ['slaughter', 'salt', 'milk'],
    none: 'meals and grain feed the household alone' },
  { id: 'wood', of: 'household', name: 'the woodpile', unit: 'loads', fields: ['household.wood'], good: 'wood', holder: 'household', kinds: ['wood'],
    none: 'nothing: the day\'s fire takes what there is, and a cold house costs nothing (VB-327)' },
  { id: 'stone', of: 'household', name: 'the stone heap', unit: 'loads', fields: ['household.stone'], good: 'stone', holder: 'household',
    kinds: ['pick', 'quarry'],
    none: 'the house is not raised onto a stone foundation; stone is picked or quarried for it (sim/building, VB-332)' },
  { id: 'clay', of: 'household', name: 'clay and bog iron ore', unit: 'loads', fields: ['household.clay', 'household.bogOre'], good: 'clay',
    goods: ['clay', 'bogOre'],
    holder: 'household', kinds: ['dig'], covers: ['household.digAt'], none: 'nothing: nothing uses them until slice 6' },
  { id: 'ale', of: 'household', name: 'ale', unit: 'barrels', fields: ['household.ale'], good: 'ale', holder: 'household', kinds: ['brew'],
    covers: ['household.poured'], none: 'no barrel is poured at an occasion, and the host gains no standing by it (sim/society)' },
  { id: 'hay', of: 'household', name: 'hay in the barn', unit: 'units', fields: ['household.hay'], kinds: ['hay'], losses: ['sim/byre:spoilHay'],
    covers: ['household.haySpoilt', 'household.fodderDay'],
    none: 'stalled animals go unfed: they grow lean and, after HERD.starveDays, the weakest die (sim/byre); the autumn count culls to the hay (sim/byre)' },
  { id: 'manure', of: 'household', name: 'the manure heap', unit: 'loads', fields: ['household.manure'], kinds: ['manure'],
    none: 'fields are not manured: their soil is not raised (sim/fields)' },
  { id: 'water', of: 'household', name: 'the day\'s water', unit: 'a day\'s (fetched or not)', fields: ['household.waterDay'],
    kinds: ['water'],
    none: 'nothing: a day without water costs nothing (VB-331)' },
  { id: 'house', of: 'farm', name: 'house condition', unit: '0..1', fields: ['farmstead.condition'], kinds: ['repair', 'restore'],
    covers: ['farmstead.condAt', 'farmstead.tarredUntil'],
    none: 'a worn house gives less prestige (houseTerm, sim/rules); an empty farm wears to a ruin under 0.15 and takes its claimant '
      + 'more hours to restore (sim/farmclaims)' },
  { id: 'fence', of: 'farm', name: 'fence condition', unit: '0..1 a stretch', fields: ['fence.cond'], kinds: ['mend'],
    covers: ['farmstead.fence', 'village.fence'],
    none: 'nothing but the mending job: a broken fence keeps no animal out or in' },
  { id: 'villageGrain', of: 'village', name: 'the village store\'s grain', unit: 'rations', fields: ['village.grain'], good: 'grain', holder: 'village',
    kinds: [],
    none: 'a household short of food gets nothing from the village when its kin cannot help (sim/help)' },
  { id: 'trees', of: 'tile', name: 'a tile\'s trees', unit: 'trees', fields: ['w.trees'], kinds: ['fell', 'grub'], covers: ['w.treesMax'],
    none: 'a tile cut bare: firewood is cut on another tile of the village\'s wood; with none left, no firewood job is posted (sim/territory)' },
  { id: 'stones', of: 'tile', name: 'a tile\'s stones', unit: 'stones', fields: ['w.stones'], kinds: ['pick', 'clear'],
    none: 'nothing is lost: a tile without stones gives none to picking or clearing, and is cleared quicker and chosen sooner for a field or a meadow' },
  { id: 'fish', of: 'tile', name: 'a water tile\'s fish', unit: '0..1', fields: ['w.fish'], kinds: ['fish'], covers: ['w.fishDay'],
    none: 'the catch falls with the stock, down to nothing, and recovers (sim/fish)' },
  { id: 'forage', of: 'tile', name: 'a tile\'s wild food', unit: '0..1', fields: ['w.forage'], kinds: ['gather'], covers: ['w.forageYear'],
    none: 'gathering yields less, down to nothing, until the year\'s regrowth (sim/forage)' },
  { id: 'deposit', of: 'tile', name: 'a tile\'s deposit', unit: 'loads', fields: ['w.depositLeft'], kinds: ['dig'], covers: ['w.depositFull', 'w.dugDay'],
    none: 'nothing more is dug there; the household looks for other ground (sim/dig)' },
  { id: 'graze', of: 'tile', name: 'a tile\'s grazing pressure', unit: 'cow-hours, halving a year', fields: ['w.graze'], kinds: ['herd'],
    none: 'nothing until forest spread (VB-091) reads it: then ungrazed open land is not kept open and goes to scrub, and its trees are not '
      + 'thinned; a tile with less is the better pasture, so herds move on to it (sim/grazing)' },
];

// ---- the other fields of the @state lines, by hand: each with why it is not a stored quantity ----
const NOT_STOCKS = {
  'identity, links and membership': ['household.id', 'household.farmstead', 'household.members', 'household.holder', 'household.guardian', 'household.ward',
    'household.herds', 'household.dissolved', 'farmstead.id', 'farmstead.house', 'farmstead.village', 'farmstead.household', 'farmstead.name',
    'farmstead.line', 'farmstead.rowAngle', 'village.id', 'village.name', 'village.center', 'village.farmsteads', 'village.wood', 'village.plots'],
  'ledgers and statistics of what moved (sim/stores, sim/hunger)': ['household.ledger', 'household.totals', 'household.spoilt', 'household.hungryDays',
    'household.hunger', 'household.seedSeason', 'household.askedIn', 'household.milkDay', 'village.ledger', 'village.totals'],
  'land, buildings and their records (fields, meadows, a site\'s timber)': ['farmstead.fields', 'farmstead.meadows', 'farmstead.project', 'farmstead.claim',
    'farmstead.booth', 'household.pasture', 'farmstead.state', 'farmstead.grade', 'farmstead.emptySince', 'village.green', 'village.well', 'village.crowded', 'village.founded'],
  'the generated world': ['w.seed', 'w.name', 'w.R', 'w.COLS', 'w.ROWS', 'w.RR', 'w.W', 'w.H', 'w.HW', 'w.AP', 'w.N', 'w.STEP', 'w.CW', 'w.CH', 'w.KS',
    'w.elev',
    'w.shade', 'w.macro', 'w.cdist', 'w.chex', 'w.csample', 'w.hx', 'w.hy', 'w.he', 'w.hp', 'w.hm', 'w.wind', 'w.rain', 'w.biome', 'w.water', 'w.ocean',
      'w.hrnd',
    'w.landDist', 'w.nb', 'w.region', 'w.regions', 'w.tr', 'w.tg', 'w.tb', 'w.tile', 'w.river', 'w.riverTo', 'w.rock', 'w.deposit', 'w.vein', 'w.veinKind',
    'w.veinNear'],
  'ways (the wear of walking, fords and bridges)': ['w.wear', 'w.worn', 'w.crossing'],
};

// ---- the @state lines: the fields of households, farms, villages and tiles they name ----
const ENTITY = { household: 'household', farmstead: 'farmstead', village: 'village', w: 'w' };
const BLOCK = { 'st.households[]': 'household', 'st.farmsteads[]': 'farmstead', 'st.villages[]': 'village' };
// A header (`@state household.clay, household.bogOre:`, `@state w.trees,treesMax:`) names its fields; a record's block (`@state st.households[]:
// {...}` and its indented lines) names them in its text outside parentheses, kept where the code has such a field (the writes map).
function stateFields(known = null) {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/manifest.json'), 'utf8'));
  known = known || new Set(Writes.build().fields.map((f) => f.field));
  const out = new Map();
  for (const f of manifest) {
    const lines = fs.readFileSync(path.join(ROOT, 'src', f), 'utf8').split('\n');
    lines.forEach((line, i) => {
      const m = line.match(/\/\/ @state (\S[^:]*?):/);
      if (!m) return;
      const head = m[1].trim(), where = `src/${f}:${i + 1}`;
      if (BLOCK[head]) {
        const entity = BLOCK[head];
        let text = line.slice(line.indexOf(head) + head.length);
        for (let k = i + 1; k < lines.length && /^\s*\/\/\s{3}/.test(lines[k]) && !lines[k].includes('@state'); k++) text += ' ' + lines[k];
        for (let k = 0; k < 4; k++) text = text.replace(/\([^()]*\)/g, ' '); // parentheses are prose
        for (const word of new Set(text.match(/\b[a-z][A-Za-z0-9]*\b/g) || [])) if (known.has(`${entity}.${word}`)) out.set(`${entity}.${word}`, where);
        return;
      }
      let entity = null;
      for (const part of head.split(',').map((x) => x.trim())) {
        const dotted = part.match(/^([a-z]+)\.([A-Za-z_]\w*)/), bare = part.match(/^([A-Za-z_]\w*)/);
        if (dotted) {
          entity = ENTITY[dotted[1]] || null; if (entity) out.set(`${entity}.${dotted[2]}`, where);
          } else if (entity && bare) out.set(`${entity}.${bare[1]}`, where);
      }
    });
  }
  return out;
}

// ---- the scan ----
const OPS = { put: 'add', take: 'take', move: 'move', cook: 'cook', sheaf: 'add', thresh: 'thresh', spoil: 'take', dug: 'add', start: 'start', brew: 'brew',
  pour: 'take', spoilAle: 'take', villageDay: 'take' };
const OP_GOODS = { dug: ['clay', 'bogOre'] };
const LOSS = new Set(['spoilage', 'burn']), TRANSFER = new Set(['gift', 'share', 'handingOn', 'provisions', 'start']);
const SKIP = new Set(['sim/stores', 'sim/saves']); // the stores' own operations, and saving
// A module's named functions, innermost by line: [{name, from, to}], a job kind's properties as `kind.property`
function functionsOf(src) {
  const ast = acorn.parse(src, { ecmaVersion: 'latest', locations: true }), out = [];
  const add = (name, node) => out.push({ name, from: node.loc.start.line, to: node.loc.end.line, size: node.end - node.start });
  const isFn = (n) => n && /Function/.test(n.type);
  (function walk(node, owner) {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'FunctionDeclaration' && node.id) add(node.id.name, node);
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && isFn(node.init)) add(node.id.name, node.init);
    if (node.type === 'Property' && node.key &&
      isFn(node.value)) add(owner ? `${owner}.${node.key.name || node.key.value}` : String(node.key.name || node.key.value), node.value);
    if (node.type === 'MethodDefinition') add(node.key.name, node.value);
    for (const [k, v] of Object.entries(node)) {
      if (k === 'loc') continue;
      const next = node.type === 'Property' && node.value && node.value.type === 'ObjectExpression' &&
        k === 'value' ? (node.key.name || node.key.value) : (node.type === 'Property' ? owner : owner);
      if (Array.isArray(v)) for (const x of v) walk(x, next); else if (v && typeof v === 'object') walk(v, next);
    }
  })(ast, null);
  const at = (line) => out.filter((f) => f.from <= line && line <= f.to).sort((a, b) => a.size - b.size)[0] || null;
  return { ast, at };
}
// sim/stores calls: [{mod, line, fn, op, goods [{good, sign, why}], village}]
function storeCalls(mod, src, fns) {
  const calls = [];
  (function walk(node) {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && node.callee.object.name === 'Stores' && OPS[node.callee.property.name]) {
      const op = node.callee.property.name, a = node.arguments, lit = (n) => (n && n.type === 'Literal' ? n.value : null);
      const reason = (n) => (!n ? null : n.type === 'Literal' ? n.value : n.type === 'ObjectExpression'
        ? lit((n.properties.find((p) => p.key && p.key.name === 'kind') || {}).value) : src.slice(n.start, n.end)); // a name: its text
      const text = src.slice(node.start, node.end), village = /vill|\bv\b/.test(text), line = node.loc.start.line, fn = fns.at(line);
      const g = (good, sign, why) => ({ good, goods: good === null ? OP_GOODS[op] || [] : [good], sign, why }); // a good by name: those the op may move
      let goods = [];
      if (op === 'put') goods = [g(lit(a[2]), +1, reason(a[4]))];
      else if (op === 'take') goods = [g(lit(a[2]), -1, reason(a[4]))];
      else if (op === 'move') goods = [g(lit(a[3]), 0, reason(a[5]))];
      else if (op === 'cook') goods = [g(lit(a[2]), -1, 'cooking'), g('meals', +1, 'cooking')];
      else if (op === 'sheaf') goods = [g('sheaves', +1, 'harvest')];
      else if (op === 'thresh') goods = [g('sheaves', -1, 'thresh'), g('grain', +1, 'thresh')];
      else if (op === 'spoil') goods = [g('grain', -1, 'spoilage')];
      else if (op === 'dug') goods = [g(lit(a[2]), +1, 'dig')];
      else if (op === 'start') goods = [g('grain', +1, 'provisions'), g('meals', +1, 'provisions')];
      else if (op === 'brew') goods = [g('grain', -1, 'brew'), g('ale', +1, 'brew')];
      else if (op === 'pour') goods = [g('ale', -1, 'pour')];
      else if (op === 'spoilAle') goods = [g('ale', -1, 'spoilage')];
      else if (op === 'villageDay') goods = [g('grain', -1, 'spoilage')];
      calls.push({ mod, line, fn: fn ? fn.name : '(module)', fnRange: fn, op, goods, village: village || op === 'villageDay' });
    }
    for (const [k, v] of Object.entries(node)) {
      if (k === 'loc') continue; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') walk(v); }
  })(fns.ast);
  return calls;
}
const ADD = new Set(['+=', '++', 'push', 'unshift']), TAKE = new Set(['-=', '--', 'filter', 'splice', 'shift', 'pop']);
function build() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/manifest.json'), 'utf8')).filter((f) => f !== 'vb.js');
  const keyOf = (f) => f.replace(/\.js$/, ''), map = Writes.build(), byField = new Map(map.fields.map((f) => [f.field, f]));
  // read sites by module, as the writes map finds them (its two passes: the functions' returns, then the reads)
  const sources = manifest.map((f) => ({ f, mod: keyOf(f), src: fs.readFileSync(path.join(ROOT, 'src', f), 'utf8') }));
  const returns = {};
  for (const s of sources) for (const [n, p] of Object.entries(Writes.scan('src/' + s.f, s.mod, {}).rets)) returns[s.mod + ':' + n] = p;
  const mods = new Map();
  for (const s of sources) {
    if (s.mod === 'gen' || s.mod.startsWith('gen/')) continue;
    const fns = functionsOf(s.src), scan = Writes.scan('src/' + s.f, s.mod, returns);
    mods.set(s.mod, { ...s, fns, reads: scan.reads.map((r) => ({ field: Writes.fieldOf(r.path), line: r.line })), calls: storeCalls(s.mod, s.src, fns) });
  }
  const rows = [];
  for (const q of QUANTITIES) {
    const goods = q.goods || (q.good ? [q.good] : []), mine = (c, x) => x.goods.some((g) => goods.includes(g)) &&
      (x.good !== 'grain' || c.village === (q.holder === 'village'));
    const adds = [], takes = [], sets = [], reads = [], changing = new Set(); // changing: functions ('mod:from') that change it
    const site = (mod, fn, extra) => ({ module: mod, fn: fn ? fn.name : '(module)', ...extra });
    for (const m of mods.values()) for (const c of m.calls) for (const x of c.goods) if (mine(c, x)) {
      changing.add(`${m.mod}:${c.fnRange ? c.fnRange.from : 0}`);
      const why = x.why || '?', use = !LOSS.has(why) && !TRANSFER.has(why);
      if (x.sign > 0) adds.push(site(m.mod, c.fnRange, { line: c.line, why }));
      else if (x.sign < 0) takes.push(site(m.mod, c.fnRange, { line: c.line, why, as: LOSS.has(why) ? 'loss' : TRANSFER.has(why) ? 'transfer' : 'use' }));
      else { adds.push(site(m.mod, c.fnRange, { line: c.line, why })); takes.push(site(m.mod, c.fnRange, { line: c.line, why, as: use ? 'use' : 'transfer' }));
        }
    }
    for (const field of q.fields) {
      const f = byField.get(field);
      for (const w of f ? f.writes : []) {
        if (SKIP.has(w.mod) || !mods.has(w.mod)) continue;
        const fn = mods.get(w.mod).fns.at(w.line), name = `${w.mod}:${fn ? fn.name : '(module)'}`;
        changing.add(`${w.mod}:${fn ? fn.from : 0}`);
        if (ADD.has(w.how)) adds.push(site(w.mod, fn, { line: w.line, how: w.how }));
        else if (TAKE.has(w.how)) takes.push(site(w.mod, fn, { line: w.line, how: w.how, as: (q.losses || []).includes(name) ? 'loss' : 'use' }));
        else sets.push(site(w.mod, fn, { line: w.line, how: w.how }));
      }
    }
    for (const m of mods.values()) {
      if (SKIP.has(m.mod)) continue;
      for (const r of m.reads) if (q.fields.includes(r.field)) {
        const fn = m.fns.at(r.line);
        if (changing.has(`${m.mod}:${fn ? fn.from : 0}`)) continue;
        const own = fn && /\.(available|urgency)$/.test(fn.name) && (q.kinds || []).includes(fn.name.split('.')[0]);
        reads.push(site(m.mod, fn, { line: r.line, own }));
      }
    }
    const shown = q.fields.some((field) => (byField.get(field) || { readers: [] }).readers.includes('page'));
    const used = reads.some((r) => !r.own) || takes.some((t) => t.as === 'use');
    const mark = used ? 'used' : reads.some((r) => r.own) || !shown ? 'read by nothing' : 'shown only';
    rows.push({ id: q.id, of: q.of, name: q.name, unit: q.unit, mark, shown, none: q.none, adds, takes, sets, reads });
  }
  return rows;
}
// one line a module: its functions, with the reasons of their store calls
function byModule(sites, withWhy) {
  const m = new Map();
  for (const s of sites) {
    const k = s.module.replace(/^sim\//, ''),
      label = `${s.fn}${withWhy && s.why ? ` (${s.why}${s.as && s.as !== 'use' ? `, ${s.as}` : ''})` : s.as && s.as !== 'use' ? ` (${s.as})` : ''}`;
    if (!m.has(k)) m.set(k, new Set()); m.get(k).add(label);
  }
  return [...m].map(([k, fs]) => `${k}: ${[...fs].join(', ')}`).join('; ') || '-';
}
function markdown(rows) {
  const out = ['# Stocks', '',
    'Each stored quantity: who adds to it, who takes from it (a use unless marked a loss or a transfer), who reads it without changing it,',
    'and what happens when there is none (by hand, tools/stocks.js). Reads in its own job kinds\' `available` and `urgency` are marked (own); `page`:',
    'the page script reads the field itself (it may show others through a Sim function).', ''];
  for (const r of rows) {
    out.push(`## ${r.name} (${r.of}, ${r.unit}): ${r.mark}`, '',
      `- adds: ${byModule(r.adds, true)}`, `- takes: ${byModule(r.takes, true)}`, `- sets: ${byModule(r.sets)}`,
      `- reads: ${[byModule(r.reads.map((x) => ({ ...x, fn: x.own ? `${x.fn} (own)` : x.fn }))), r.shown ? 'page' : '-'].filter((x) => x !== '-').join('; ') ||
        '-'}`,
      `- at none: ${r.none}`, '');
  }
  out.push(`Read by nothing: ${rows.filter((r) => r.mark === 'read by nothing').map((r) => r.name).join(', ') || 'none'}.`);
  out.push(`Shown only: ${rows.filter((r) => r.mark === 'shown only').map((r) => r.name).join(', ') || 'none'}.`);
  return out.join('\n');
}
if (require.main === module) {
  const rows = build();
  console.log(process.argv.includes('--json') ? JSON.stringify(rows, null, 1) : markdown(rows));
}
// The fields of the @state lines with no line in QUANTITIES and none in NOT_STOCKS; and the fields these name that no @state line does.
function unlisted(fields = stateFields()) {
  const listed = new Set([...QUANTITIES.flatMap((q) => [...q.fields, ...(q.covers || [])]), ...Object.values(NOT_STOCKS).flat()]);
  return { missing: [...fields.keys()].filter((f) => !listed.has(f)).map((f) => `${f} (${fields.get(f)})`),
    stale: [...listed].filter((f) => ENTITY[f.split('.')[0]] && !fields.has(f)) };
}
module.exports = { QUANTITIES, NOT_STOCKS, stateFields, unlisted, build, markdown };
