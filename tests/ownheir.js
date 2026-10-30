// The ownHeir custom (VB-089): a first heir of their own parents' farm steps behind other relatives under "behind", and keeps their place under "keeps".
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, Culture = VB.culture;
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('OWNHEIR FAIL:', m); } };
const it = G.generate(7); let r; while (!(r = it.next()).done);
const st = Sim.seed(r.value, 7, 'heirs');
const nm = (id) => st.pawns[id].given, rank = (hh, ownHeir) => Sim.heirRanking(st, hh, { ...Sim.practice(st, st.farmsteads[hh.farmstead].village), ownHeir }).map(nm);
check(st.cenv.settlements.every((s) => Culture.DIMS[Culture.IDX.ownHeir] && Sim.practice(st, s.id).ownHeir === 'behind'), 'villages start on "behind"');
// Erik's household 3: Nils is the first heir of his parents' farm; Olof's household 4 (his uncle's) is the other farm in his line.
const own = st.households[3], uncle = st.households[4], f = st.farmsteads[uncle.farmstead];
check(nm(Sim.heirRanking(st, own)[0]) === 'Nils', 'Nils is first heir of his parents farm');
f.fields.push({ ...f.fields[0], id: f.fields.length }); // the uncle's farm has more fields than the parents'
const behind = rank(uncle, 'behind'), keeps = rank(uncle, 'keeps');
check(behind[0] === 'Per' && behind.indexOf('Nils') > behind.indexOf('Per'), `behind: ${behind}`);
check(keeps[0] === 'Nils', `keeps: ${keeps}`);
// with equal fields, the heir keeps the farm of their own parents and drops the claim on the uncle's
f.fields.pop();
check(!rank(uncle, 'keeps').includes('Nils') && rank(own, 'keeps')[0] === 'Nils', `keeps, equal fields: ${rank(uncle, 'keeps')}`);
if (failed) process.exitCode = 1; else console.log('ownheir ok');
