// The scenario "The market town" (VB-778): a populous island with plot households packed within 2 steps of each other, a test bed known to
// decay and no evidence that a town emerges. Checks its start on a small generated island: the plots, their closeness, what each holds, that
// it is not offered on the start screen, and that no rule outside the scenario reads the label.
const fs = require('fs');
const path = require('path');
const VB = require('../src/load.js');
const probe = require('./lib/probe.js');
const { TESTBED } = VB['sim/rules'];
const { hexSteps } = VB['sim/hex'];
let failed = 0;
const check = (ok, msg) => {
  if (!ok) {
    failed++;
    console.error(`MARKET FAIL: ${msg}`);
  }
};
for (const seed of [7, 42]) {
  const st = probe.scenario('market', seed),
    base = probe.scenario('populous', seed);
  check(st.scenario === 'market', `seed ${seed}: the state names its scenario`);
  const plots = st.farmsteads.filter((f) => f.id >= base.farmsteads.length && f.fields.length <= 1);
  check(plots.length >= 2 && plots.length <= TESTBED.plots, `seed ${seed}: ${plots.length} plot households laid`);
  for (const a of plots)
    for (const b of plots)
      check(hexSteps(st.w, a.house, b.house) <= 2, `seed ${seed}: plots ${a.id} and ${b.id} within 2 steps`);
  check(plots.every((f) => f.household !== null), `seed ${seed}: every plot is lived in`);
  check(
    st.record.some((e) => typeof e === 'object' && /not evidence that a town emerges/.test(e.text || '')),
    `seed ${seed}: the start's log says it is not evidence of a town`,
  );
}
const start = fs.readFileSync(path.join(__dirname, '../src/page/start.js'), 'utf8');
check(!/START_ORDER = \[[^\]]*market/.test(start), 'not offered on the start screen');
for (const f of fs.readdirSync(path.join(__dirname, '../src/sim')))
  if (f !== 'scenarios.js' && f !== 'rules.js')
    check(!/['"]market['"]/.test(fs.readFileSync(path.join(__dirname, '../src/sim', f), 'utf8')), `${f} reads the label`);
if (failed) process.exit(1);
console.log('market ok');
