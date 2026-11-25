// VB-781 (the plan, its review's F1 to F3): design.md, The walk weighed, agrees with the rules it reckons from. The farthest walk out of
// a kind that brings a load is reckoned home at the load's pace (TRAVEL.pace.back), REACH.out covers the farthest kind, the household's
// wood has one rule (no draw), and the cost a game day is the year's over YEAR_DAYS. Text and arithmetic only: the rule is not built yet
// (VB-1677, VB-1678); those tasks replace this check with their constructed states.
const fs = require('fs');
const path = require('path');
const VB = require('../src/load.js');
const { WORK, TRAVEL, YEAR_DAYS } = VB['sim/rules'];
const design = fs.readFileSync(path.join(__dirname, '..', 'design.md'), 'utf8');
const a = design.indexOf('### The walk weighed');
const s = design.slice(a, design.indexOf('\n### ', a + 5));
let bad = 0;
const ok = (c, m) => {
  if (!c) {
    bad++;
    console.error('walkweighed: ' + m);
  }
};
ok(a >= 0, 'design.md has no section The walk weighed');
const day = WORK[1] - WORK[0];
const laden = (work) => (day - work) / (1 + 1 / TRAVEL.pace.back);
const unladen = (work) => (day - work) / 2;
const row = (name) => (s.split('\n').find((l) => l.startsWith(`| ${name} |`)) || '');
// F1: the trip is walked home at the load's pace: the wood (felling 2 hours) at most 4.7 hours out on the back, not 5
ok(row('The rule').includes('`TRAVEL.pace`'), "The rule does not reckon the way home at the load's pace");
ok(row('The kinds it judges').includes(`the wood (\`WOOD.reach\` 12 and \`far\` 27; felling, 2 hours; a load, \`woodPerTrip\`; ${laden(2).toFixed(1)} on the back`), `the wood's farthest walk is not ${laden(2).toFixed(1)} hours on the back`);
const out = Math.max(unladen(2.5), laden(2));
ok(row('What bounds the search').includes('`REACH.out`, 5 hours') && 5 >= out, `REACH.out (5) does not cover the farthest kind (${out.toFixed(2)})`);
// F2: one rule for the household's wood: the nearest tile kept, no draw among the wood's tiles
ok(row('The wood').includes('the nearest tile of its village') && !/trip for wood is drawn/.test(s), "the household's wood has two rules");
// F3: the cost a game day is the year's over YEAR_DAYS
const perDay = Math.round(1.6e6 / YEAR_DAYS / 1000) * 1000;
ok(row('What bounds the search').includes(`${perDay.toLocaleString('en')} a game day of the year's ${YEAR_DAYS}`), `the cost a game day is not 1.6 million over ${YEAR_DAYS} (${perDay})`);
if (bad) process.exit(1);
console.log('walkweighed: ok');
