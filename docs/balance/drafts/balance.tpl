<title>Village Balance Map</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Source+Sans+3:wght@400;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: one reading column; the map and the tables break out wider and scroll on their own. */
:root {
  --bg: #f2f5f1; --surface: #ffffff; --fg: #1c2928; --muted: #5a6a67; --rule: #cfd8d3;
  --prop: #a8700a; --prop-fill: #fbf1d8; --plan: #2f658f; --gap: #a5432c;
  --display: "Bricolage Grotesque", "Segoe UI", system-ui, sans-serif;
  --body: "Source Sans 3", "Segoe UI", system-ui, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #141b1a; --surface: #1c2524; --fg: #e4ebe7; --muted: #9aaba6; --rule: #33413e;
  --prop: #e2b24c; --prop-fill: #3a2f12; --plan: #8dbbe0; --gap: #e88a72; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #141b1a; --surface: #1c2524; --fg: #e4ebe7; --muted: #9aaba6; --rule: #33413e;
  --prop: #e2b24c; --prop-fill: #3a2f12; --plan: #8dbbe0; --gap: #e88a72; color-scheme: dark }
body { background: var(--bg); color: var(--fg); font: 17px/1.55 var(--body);
  padding-block: 40px 72px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
main { max-width: 1120px; margin: 0 auto; display: flex; flex-direction: column; gap: 44px; }
section, header { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
h1 { font: 700 clamp(30px, 5vw, 44px)/1.08 var(--display); margin: 0; text-wrap: balance; letter-spacing: -0.01em; }
h2 { font: 700 24px/1.2 var(--display); margin: 0; text-wrap: balance; }
p, li { max-width: 68ch; margin: 0; }
ul { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 8px; }
.eyebrow { font: 500 12px var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.lede { font-size: 20px; line-height: 1.45; }
code { font: 500 .86em var(--mono); color: var(--muted); white-space: nowrap; }
strong { font-weight: 600; }
figure { margin: 0; display: flex; flex-direction: column; gap: 12px; }
.scroll { overflow-x: auto; background: var(--surface); border: 1px solid var(--rule); border-radius: 8px; }
.scroll svg { display: block; width: 100%; min-width: 1000px; height: auto; }
figcaption { color: var(--muted); font-size: 15px; max-width: 80ch; }
.key { display: flex; flex-wrap: wrap; gap: 8px 22px; font-size: 14px; color: var(--muted); }
.key span { display: inline-flex; align-items: center; gap: 8px; }
.sw { width: 30px; height: 14px; border-radius: 3px; border: 1.6px solid var(--fg); background: var(--surface); }
.sw.prop { border-color: var(--prop); background: var(--prop-fill); border-radius: 8px; border-width: 2.2px; }
.ln { width: 30px; height: 0; border-top: 2px solid var(--fg); } .ln.plan { border-top: 2px dashed var(--plan); } .ln.gap { border-top: 2.5px dotted var(--gap); }
.bd { width: 20px; height: 20px; border-radius: 50%; background: var(--fg); color: var(--bg); font: 700 12px var(--body); display: inline-flex; align-items: center; justify-content: center; }
.bd.r { background: var(--gap); }
#bm .n { fill: var(--surface); stroke: var(--fg); stroke-width: 1.5; }
#bm .n.prop { fill: var(--prop-fill); stroke: var(--prop); stroke-width: 2.6; }
#bm .n.plan { stroke: var(--plan); stroke-dasharray: 6 4; }
#bm .t { font: 700 13.5px var(--display); fill: var(--fg); } #bm .s { font: 400 11.5px var(--body); fill: var(--muted); }
#bm .l { font: 400 12.5px var(--body); fill: var(--muted); } #bm .l.p { fill: var(--plan); }
#bm .e { stroke: var(--fg); stroke-width: 1.6; } #bm .e.p { stroke: var(--plan); stroke-dasharray: 6 4; } #bm .e.g { stroke: var(--gap); stroke-width: 2; stroke-dasharray: 2 5; }
#bm .n.gapn { stroke: var(--gap); stroke-width: 2; stroke-dasharray: 2 5; }
#bm .tk { stroke: var(--fg); stroke-width: 1.6; } #bm .tk.p { stroke: var(--plan); } #bm .tk.g { stroke: var(--gap); }
#bm .f { stroke: var(--fg); stroke-width: 4.5; } #bm .f.p { stroke: var(--plan); stroke-dasharray: 9 5; }
#bm .fl { font: 600 12.5px var(--body); fill: var(--fg); font-style: italic; } #bm .sink { fill: var(--fg); }
#bm .hb { fill: var(--fg); } #bm .hp { fill: var(--plan); } #bm .hg { fill: var(--gap); }
#bm .sg { fill: var(--surface); stroke: var(--fg); stroke-width: 1.2; } #bm .sg.p { stroke: var(--plan); } #bm .sg.g { stroke: var(--gap); }
#bm .sgt { font: 700 13px var(--body); fill: var(--fg); } #bm .sgt.p { fill: var(--plan); } #bm .sgt.g { fill: var(--gap); }
#bm .lpB { fill: var(--fg); } #bm .lpR { fill: var(--gap); } #bm .lpt { font: 700 11.5px var(--body); fill: var(--bg); }
.tw { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; min-width: 680px; font-size: 15.5px; line-height: 1.4; }
th { text-align: left; font: 500 12px var(--mono); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); padding: 0 14px 8px 0; border-bottom: 1.5px solid var(--fg); }
td { vertical-align: top; padding: 10px 14px 10px 0; border-bottom: 1px solid var(--rule); }
td:first-child { font-weight: 600; }
.st { font: 500 12px var(--mono); white-space: nowrap; } .st.p { color: var(--plan); } .st.g { color: var(--gap); }
.note { color: var(--muted); font-size: 15px; }
.fw { width: 30px; height: 0; border-top: 4.5px solid var(--fg); } .dot { width: 14px; height: 14px; border-radius: 50%; background: var(--fg); }
.slow { display: inline-flex; gap: 3px; } .slow i { width: 0; height: 13px; border-left: 2px solid var(--fg); }
td .id { font: 500 12px var(--mono); color: var(--muted); margin-right: 6px; }
</style>
<main>
<header>
  <span class="eyebrow">Village builder · balance map · draft 1 · 12 November 2026</span>
  <h1>What holds the game in balance</h1>
  <p class="lede">Six properties to tune toward, and the levers that act on them. This draft is grounded in two cards, hunger to mobility and population growth. Six more cards are seeds and are not drawn yet.</p>
</header>

<figure>
  <div class="scroll">%%SVG%%</div>
  <div class="key">
    <span><i class="sw prop"></i>balance property</span>
    <span><i class="sw"></i>lever</span>
    <span><i class="ln"></i>built</span>
    <span><i class="ln plan"></i>planned</span>
    <span><i class="ln gap"></i>missing from the design</span>
    <span><i class="bd">B</i>loop that balances</span>
    <span><i class="bd r">R</i>loop that reinforces</span>
  </div>
  <figcaption>An arrow marked + pushes its target the same way; − pushes against it; ± is a steady push that does not respond to the island. Today population is held by four built loops: the hunger check, the marriage valve, kin help and the vent of new land. Everything that makes towns a sink and an elite possible is still dashed.</figcaption>
</figure>

<section>
  <h2>The balance properties</h2>
  <div class="tw"><table>
    <tr><th>Property</th><th>How it is measured</th><th>Target</th><th>Today</th></tr>
    <tr><td>Population</td><td>The living, and growth a year</td><td>About 1,000 on a medium map, held by loops, not a cap</td><td>Populous small doubles in 40 years (352 to 729)</td></tr>
    <tr><td>Food per head</td><td>Net food output over the farmers' own need</td><td>Near 1.67, to feed towns and an elite</td><td>1.1 to 1.5 measured</td></tr>
    <tr><td>Land per household</td><td>People per farm; landless adults</td><td>None set</td><td>Reported, no band</td></tr>
    <tr><td>Town and craft share</td><td>People living by specialised work</td><td>325 of 1,000</td><td>0: no towns or crafts yet</td></tr>
    <tr><td>Elite share</td><td>Landed and ranked households</td><td>75 of 1,000, about 12 to 15 households</td><td>0: no class yet</td></tr>
    <tr><td>Land concentration</td><td>Land Gini; share of farms under tenancy</td><td>A band, to be set in slice 5</td><td>Every farm is owned by those who work it</td></tr>
  </table></div>
  <p class="note">Waiting for their cards: idle hours (55 to 79% of adult hours today), the spread of customs between villages, goodwill against silver, and the route by which surplus leaves the farm.</p>
</section>

<section>
  <h2>The loops and pushes</h2>
  <div class="tw"><table>
    <tr><th>Name</th><th>Path</th><th>Kind</th><th>Range</th><th>Lag</th><th>Status</th></tr>
    <tr><td>Hunger check</td><td>More people, less food per head, hunger, more deaths and fewer conceptions</td><td>Balances</td><td>Wide: hunger multiplies the death risk up to 2.5 times and can stop conception</td><td>A season</td><td class="st">built</td></tr>
    <tr><td>Marriage valve</td><td>More people, less land per household, fewer homes with means, fewer marriages, fewer births</td><td>Balances</td><td>Wide in history (women marrying at 25, up to a third never). Narrow here: ages are fixed at 18 and 20</td><td>A generation</td><td class="st">gate built; age does not respond</td></tr>
    <tr><td>Nursing gap</td><td>A birth blocks the next for the nursing time; an infant's death should end it early</td><td>Balances, replaces losses only</td><td>Narrow: about 6 to 9 births a woman</td><td>A year or two</td><td class="st g">gap built; early end missing</td></tr>
    <tr><td>Vent of new land</td><td>Scarce land sends heirs to clear plots and found villages</td><td>Balances, until the wild land is gone</td><td>The whole map, once</td><td>Years</td><td class="st">built</td></tr>
    <tr><td>Kin help</td><td>Hunger asks, kin give, hunger ends; goodwill is booked</td><td>Balances between households</td><td>The giver's grain above seed and 20 days</td><td>A season</td><td class="st">built</td></tr>
    <tr><td>Disease</td><td>Hunger and crowding raise sickness, which raises deaths</td><td>Balances</td><td>Unknown</td><td>Months after a bad harvest</td><td class="st g">named, not designed</td></tr>
    <tr><td>Town sink</td><td>The unmarried and landless move to town, where crowding kills more than are born</td><td>Balances</td><td>Set by the town's size</td><td>Years</td><td class="st p">slice 9</td></tr>
    <tr><td>Estates</td><td>Hunger borrows, default passes a field, rent refills the store that lends</td><td>Reinforces</td><td>One field a hearing</td><td>Years</td><td class="st p">slice 5</td></tr>
    <tr><td>Brakes on estates</td><td>Debtors vote for labour as the remedy, heirs split land, tenants leave, talk thins the creditor's voice</td><td>Balances the estates loop</td><td>Unmeasured</td><td>Decades for the custom</td><td class="st p">slices 5, 7</td></tr>
    <tr><td>The outside world</td><td>A merchant, an elite with a retinue, a settling family; recruiting of young adults</td><td>Steady push, both ways</td><td>Very limited, by your decision</td><td>None</td><td class="st p">slice 8</td></tr>
  </table></div>
</section>

<section>
  <h2>What this draft already shows</h2>
  <ul>
    <li><strong>The fast brake is the cruel one.</strong> The only wide, built check on population is hunger. The gentler valve, marriage, has the gate but not the response, so tuning growth today means tuning how many go hungry.</li>
    <li><strong>The right half is all planned.</strong> Town share, elite share and land concentration have no built lever. Their targets cannot be tuned until slices 5 and 9 land.</li>
    <li><strong>Two red links.</strong> Hunger does not feed disease, and an infant's death does not shorten the nursing gap. Both are small to state and neither is in the design.</li>
    <li><strong>Food per head sits at the centre.</strong> It drives hunger now, and the seed card on surplus will hang the town and elite shares on it. Its target of 1.67 against 1.1 to 1.5 today is the largest known distance on the map.</li>
  </ul>
  <p class="note">Sources: <code>src/sim/births.js</code>, <code>src/sim/deaths.js</code>, <code>design.md</code> v0.4, target-v2 sections 6.1 and 6.3, and acoup, "Life, Work, Death and the Peasant", parts II to IIIb. Ranges without a number in the code are from the history, not from runs.</p>
</section>
</main>
