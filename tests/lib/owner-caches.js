// Derive roles from the family records and member lists, independently of pawn.household and the spouse index.
function checkRoles(st, VB, { allowAgeLag = false } = {}) {
  const households = new Map(), spouses = new Map(), errors = [], YEAR = VB['sim/rules'].YEAR;
  for (const hh of st.households) if (!hh.dissolved) for (const id of hh.members) households.set(id, hh);
  for (const u of st.unions) if (u.end === null) { spouses.set(u.a, u.b); spouses.set(u.b, u.a); }
  for (const p of st.pawns) {
    if (p.died !== null) continue;
    const hh = households.get(p.id), age = Math.max(0, Math.floor((st.t - p.born) / YEAR));
    const holds = hh?.holder === p.id, marriedToHolder = hh && spouses.get(p.id) === hh.holder;
    const expected = holds ? 'farmer' : marriedToHolder ? (p.sex === 'f' ? 'wife' : 'farmer') :
      hh && p.retired ? 'retired' : age < 14 ? 'child' : !hh || p.servant ? (p.sex === 'f' && hh ? 'maid' : 'farmhand') :
      p.sex === 'f' ? 'daughter' : 'son';
    // Existing gameplay refreshes roles on social changes and at the annual round, not on the fourteenth birthday.
    const birthdayLag = allowAgeLag && age === 14 && !holds && !marriedToHolder && !p.retired && p.role === 'child';
    if (p.role !== expected && !birthdayLag) errors.push(`pawns[${p.id}]: role cache ${p.role}, expected ${expected}`);
  }
  return errors;
}
// Load before any source modules: every importer then receives the checked refreshRoles operation.
function loadWithRoleChecks() {
  const fs = require('fs'), path = require('path'), root = path.join(__dirname, '../..');
  for (const file of JSON.parse(fs.readFileSync(path.join(root, 'src/manifest.json'), 'utf8'))) {
    require(path.join(root, 'src', file));
    if (file === 'sim/heirs.js') {
      const heirs = globalThis.VB['sim/heirs'], refresh = heirs.refreshRoles;
      heirs.refreshRoles = (st) => {
        const result = refresh(st), errors = checkRoles(st, globalThis.VB);
        if (errors.length) throw new Error('role cache after refreshRoles:\n' + errors.join('\n'));
        return result;
      };
    }
  }
  return globalThis.VB;
}
module.exports = { checkRoles, loadWithRoleChecks };
