// @suite fast
// VB-1753: tests/played.js's count of the reads of who is played: through any name, or taken apart (st.player, view.player,
// const { player } = st), comments left out.
const assert = require('assert');
const { reads } = require('./played.js');
// The count itself: a read through another name, or taken apart, is a read.
assert.deepStrictEqual(
  [
    ...reads(
      'x.js',
      [
        'function a(st) {',
        '  const pl = view.player, me = st.player; // st.player in a comment',
        '}',
        'const b = (st) => {',
        '  const { t, player } = st;',
        '  if (x.playerish || y === 2) return;',
        '};',
      ].join('\n'),
    ),
  ],
  [
    ['x:a', 2],
    ['x:b', 1],
  ],
  'a read of who is played counted through any name',
);
console.log('played-reads.js: OK: a read of who is played counted through any name');
