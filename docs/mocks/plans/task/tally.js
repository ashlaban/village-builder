// Study A, part 1 (P2): a tally over the real kinds. It loads VB['sim/kinds'].KINDS (reads only), lists for each kind the control fields it
// uses, and gives each, by hand, its methods in the eight primitives of design 2.2 (go, fetch, work, load, haul, unload, return, wait).
// Kinds that share a method are grouped under one shape. A kind that does not fit says why. It also sorts the 27 `deliver` hooks by what
// they do, since a hook that carries the work's effect does not fall away with the phases, it moves.
// node docs/mocks/plans/task/tally.js [--json FILE]
const path = require('path'), fs = require('fs'), root = path.join(__dirname, '../../../..');
const VB = require(path.join(root, 'src/load.js'));
const { KINDS } = VB['sim/kinds'];
const out = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;

// The control fields design 2.2 says fall away, and the other fields a kind keeps (not control: labels, effects, timing, ranks).
const CONTROL = ['load', 'stack', 'back', 'carry', 'to', 'deliver', 'again', 'stages', 'reload', 'setDown', 'fetch', 'setOut', 'carted', 'inside', 'trip'];

// Methods as data: a method is a row of [prim, place, thing?]. Places: site (the job's tile), home (the house or farm), store (the owner's
// store at home), pile (a pile at a tile), dest (the goal's store when it is not home: a building site, the green, the creditor).
const M = {
  workAt: [['go', 'site'], ['work', 'site']],
  workHome: [['go', 'home'], ['work', 'home']],
  inputThenWork: [['go', 'home'], ['load', 'store', 'input'], ['haul', 'site'], ['unload', 'site'], ['work', 'site']],
  gatherBack: [['go', 'site'], ['work', 'site'], ['load', 'site'], ['haul', 'home'], ['unload', 'store']],
  gatherCart: [['fetch', 'home', 'cart'], ['go', 'site'], ['work', 'site'], ['load', 'site'], ['haul', 'home'], ['unload', 'store'], ['return', 'home', 'cart']],
  pileCart: [['fetch', 'home', 'cart'], ['go', 'pile'], ['load', 'pile'], ['haul', 'dest'], ['unload', 'dest'], ['return', 'home', 'cart']],
  pileBack: [['go', 'pile'], ['load', 'pile'], ['haul', 'dest'], ['unload', 'dest']],
  cutStackCart: [['fetch', 'home', 'cart'], ['go', 'site'], ['work', 'site'], ['load', 'site'], ['haul', 'home'], ['unload', 'store'], ['return', 'home', 'cart']],
  waterBarrel: [['fetch', 'home', 'cart'], ['go', 'site'], ['load', 'site'], ['haul', 'dest'], ['unload', 'dest'], ['return', 'home', 'cart']],
  lead: [['go', 'site'], ['load', 'site', 'animal'], ['haul', 'home'], ['unload', 'store']],
  cartedOut: [['fetch', 'home', 'cart'], ['load', 'store', 'input'], ['haul', 'site'], ['work', 'site'], ['return', 'home', 'cart']],
  together: [['go', 'site'], ['wait', 'site', 'hands'], ['work', 'site']],
};
// Each kind: [shape name, methods (≤3), note]. 'misfit' marks what the eight primitives cannot say without a hook or a ninth primitive.
const BY = {};
const put = (ks, ms, note, misfit) => { for (const k of ks.split(' ')) BY[k] = { methods: ms, note: note || '', misfit: misfit || null }; };
put('plow reap weed clear break meadow reclaim rake mow grub mend green sweep raise repair foundation roof barnroof booth shelter byreroof timberroof raisestage mendfacility tarpit ditch reclaim', ['workAt'], 'work at the site; its stage or the land is the progress record');
put('milk slaughter shear fodder mendcart', ['workAt'], 'at the byre or farm: the walk is from wherever the pawn stands, often none');
put('cook brew thresh salt grind hewQuern mendtools cobble harness weave', ['workHome'], 'inside: the place is the house (the field `inside` becomes the place)');
put('sow burntar dry tarboat smelt', ['inputThenWork', 'workAt'], 'today the input (seed, firewood, fish, tar, ore) is taken from the store at `done`, a teleport; the method fetches it');
put('walls barnbase barnwalls boat cart loom byrewalls timberframe housewell well tarhouse', ['inputThenWork', 'workAt'], 'a stage needing timber or stone at the site: method 1 brings it, method 2 works once it lies there (the timber and wellstone kinds become method 1)');
put('fish rackfish gather hunt boilsalt', ['gatherBack'], 'no load out, a load home; the catch is made at the door today (deliver), so the effect must move to the work leg');
put('pick quarry dig', ['gatherCart', 'gatherBack'], 'a load home, on a cart where one is free');
put('wood', ['cutStackCart', 'gatherBack', 'pileBack'], 'cut and stacked while the cart has room and the pile is short (the `stack` branch of ended) = goal amount not met and cart room: next answers work again before haul; method 3 is fetchWood');
put('timber', ['gatherBack', 'pileBack'], 'logs to a building site: dest is the site');
put('haul hay leftTimber leftGrain wellstone', ['pileCart', 'pileBack'], 'a pile at a tile (stooks, hay cocks, a lying load, the stone store) to a store; `again` is the pile not yet empty');
put('fetchHaul fetchWood fetchHay fetchLeftTimber fetchLeftGrain fetchWellstone fetchLeftCart', ['pileBack'], 'not a kind any more: method 2 of its base kind, chosen because a pile lies at the tile');
put('water boothwater', ['waterBarrel', 'pileBack'], 'the barrel taken at the house (`setOut`) is fetch cart; set down mid-road there is no pile of water today (spilt, VB-1604)');
put('lead drove', ['lead'], 'the load walks: a cow led is a load whose pile is an animal standing at a tile');
put('leftCart', ['lead'], 'the cart and its team are the load; set down, it is a cart standing at a tile (as today, leftCart)');
put('manure', ['cartedOut', 'workAt'], 'dung from the byre carted to the field and spread; `carted` becomes return cart');
put('workfence workclear', ['together'], 'the work day waits for its hands: wait');
put('drink', ['workAt'], "the pawn's own drink at a source");
put('fell', ['workAt'], 'felling for land (sim/expansion): the felled timber is the tile\'s pile; its haul is wood\'s method 3');
put('firewood', ['workHome'], 'timber at the woodpile cut to firewood at the house: the last step of the design\'s firewood table');
put('restore', ['workAt'], "fits, but its effect founds a household and moves the actor: next must re-read the pawn after `work`", null);
put('blaze', ['workAt'], 'a trail is a project of one step a tile (sim/projects): go and work, repeated by the project');
put('herd', ['workAt'], 'held at the side for a day while other legs run (`held`, `attention`, the side slot): a charge, not a leg', 'a ninth primitive `mind` (a charge held across other legs) or the hook `held`');
put('spin', ['workHome'], 'worked at the side while minding (`attention`, `reach`, `rate`)', 'the same `mind`: work done at the side of another charge');

// The deliver hooks sorted by hand (src/sim/*: each read): a plain unload of what is in hand; the work's effect made at the door; a target
// that is no store.
const DELIVER = {
  unload: ['haul', 'hay', 'leftTimber', 'leftGrain', 'fetchHaul', 'fetchWood', 'fetchHay', 'fetchLeftTimber', 'fetchLeftGrain', 'fetchWellstone', 'fetchLeftCart'],
  effectAtDoor: ['wood', 'timber', 'pick', 'quarry', 'dig', 'hunt', 'fish', 'gather', 'rackfish', 'boilsalt'],
  notAStore: ['water', 'boothwater', 'wellstone', 'lead', 'drove', 'leftCart'],
};
const DELIVER_WHAT = {
  wood: 'fellTree at the door: the tree falls when the load is home', timber: 'fellTree at the door, and the site credited', pick: 'the stones taken off the tile at the door',
  quarry: 'the rock kind read at the door', dig: 'digLoad at the door: the bog dug when the load is home', hunt: 'the hunt rolled at the door',
  fish: 'potCatch at the door', gather: 'gather(site) at the door', rackfish: 'catchOf at the door', boilsalt: "the fuel's tree felled and the salt made at the door",
  water: "the household's water cover (no store)", boothwater: "a booth's waterDay, and the carrier drinks", wellstone: 'stoneLaid on the project',
  lead: 'ledHome: the animal joins the herd', drove: 'ledHome', leftCart: 'the cart joins the farm',
};

const rows = [], fields = {}, misfits = [];
for (const [k, K] of Object.entries(KINDS)) {
  for (const [f, v] of Object.entries(K)) (fields[f] ||= { n: 0, fn: 0 }).n++, typeof v === 'function' && fields[f].fn++;
  const b = BY[k];
  if (!b) { misfits.push({ kind: k, why: 'not tallied' }); continue; }
  const ctl = CONTROL.filter((f) => K[f] !== undefined), fn = Object.keys(K).filter((f) => typeof K[f] === 'function');
  const steps = b.methods.map((m) => M[m].length);
  rows.push({ kind: k, shape: b.methods.join('+'), methods: b.methods.length, maxSteps: Math.max(...steps), control: ctl.join(' '), functions: fn.join(' '), note: b.note });
  if (b.misfit) misfits.push({ kind: k, why: b.misfit });
}
const fieldNames = Object.keys(fields), gone = fieldNames.filter((f) => CONTROL.includes(f));
const carrying = Object.keys(KINDS).filter((k) => ['back', 'carry', 'to', 'deliver'].some((f) => KINDS[k][f] !== undefined));
const shapes = {};
for (const r of rows) (shapes[r.shape] ||= []).push(r.kind);
const res = {
  kinds: Object.keys(KINDS).length, kindsAfter: Object.keys(KINDS).length - 7, fields: fieldNames.length, controlFieldsGone: gone.length,
  fieldsAfter: fieldNames.length - gone.length + 1, gone,
  kept: fieldNames.filter((f) => !CONTROL.includes(f)),
  shapes: Object.entries(shapes).map(([s, ks]) => ({ shape: s, steps: s.split('+').map((m) => M[m].length).join('/'), n: ks.length, kinds: ks.join(' ') })),
  maxMethods: Math.max(...rows.map((r) => r.methods)), maxSteps: Math.max(...rows.map((r) => r.maxSteps)),
  misfits, carrying: carrying.length,
  carryingMisfit: misfits.filter((m) => carrying.includes(m.kind)).map((m) => m.kind),
  deliver: Object.fromEntries(Object.entries(DELIVER).map(([g, ks]) => [g, ks.map((k) => k + (DELIVER_WHAT[k] ? ': ' + DELIVER_WHAT[k] : ''))])),
  deliverChecked: Object.values(DELIVER).flat().length === Object.keys(KINDS).filter((k) => KINDS[k].deliver).length,
  functionFields: Object.entries(fields).filter(([, v]) => v.fn).map(([f, v]) => `${f}:${v.fn}`).join(' '),
};
console.log(JSON.stringify(res, null, 1));
if (out) fs.writeFileSync(out, JSON.stringify({ ...res, rows }, null, 1));
