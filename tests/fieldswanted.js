// VB-389: the fields a household wants are counted net of the seed a field takes back (FIELDS.want of rations at FIELDS.expect of the
// yield, less the seed): 2 adults and 2 children want 4 fields (3 before), a lone adult 2 (1 before); the hands still cap it.
const assert = require('assert');
const VB = require('../src/load.js');
const F = VB['sim/fields'], { age } = VB['sim/records'], { YEAR } = VB['sim/rules'];
const st = { pawns: [], t: 0 };
const mk = (years, big) => {
  st.pawns.push({ died: null, born: -years * YEAR });
  const p = st.pawns[st.pawns.length - 1];
  assert.strictEqual(age(st, p) >= 14, big, big ? 'an adult' : 'a child');
  return st.pawns.length - 1;
};
const family = { members: [mk(30, true), mk(30, true), mk(5, false), mk(5, false)] };
assert.strictEqual(F.fieldsWanted(st, family, 99), 4, 'two adults and two children want 4 fields');
assert.strictEqual(F.fieldsWanted(st, { members: [mk(30, true)] }, 99), 2, 'a lone adult wants 2 fields');
assert.strictEqual(F.fieldsWanted(st, family, 2), 2, 'the hands still cap it');
console.log('fieldswanted ok');
