// VB-284 (11 Nov 2026): the tables of docs/bench/food-balance.md from the JSON docs/bench/food-season.js prints, one file a seed.
// Usage: node docs/bench/food-season-report.js FROM TO fs-3.json fs-7.json ... (years FROM to TO; each a game year of 4 seasons of 12 days)
const fs = require('fs');
const [from, to] = [+process.argv[2], +process.argv[3]], files = process.argv.slice(4);
const runs = files.map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
const seasons = runs.flatMap((o) => o.seasons.filter((r) => r.y >= from && r.y <= to && r.days > 0).map((r) => ({ ...r, seed: o.seed })));
const years = runs.flatMap((o) => o.years_.filter((r) => r.y >= from && r.y <= to).map((r) => ({ ...r, seed: o.seed })));
const S = ['spring', 'summer', 'autumn', 'winter'], pct = (a, b) => (b > 0 ? (100 * a / b).toFixed(1) : '-');
// A table of a key by season: per cell the shortfall as a share of need (%) and the share of household-seasons with a hungry day (%).
function bySeason(title, key) {
  const g = new Map();
  for (const r of seasons) {
    const k = key(r); if (k === null) continue;
    if (!g.has(k)) g.set(k, S.map(() => ({ n: 0, need: 0, lack: 0, hungry: 0, days: 0, hdays: 0 })));
    const c = g.get(k)[r.s]; c.n++; c.need += r.needSum; c.lack += r.lack; c.hungry += r.hungry > 0 ? 1 : 0; c.days += r.days; c.hdays += r.hungry;
  }
  const lines = [`| ${title} | household-seasons | ${S.map((s) => s + ': short % of need (hungry %)').join(' | ')} | year: short % | hungry days a year |`,
    `|---|---:|${S.map(() => '---:').join('|')}|---:|---:|`];
  for (const [k, cs] of [...g].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const n = cs.reduce((s, c) => s + c.n, 0), need = cs.reduce((s, c) => s + c.need, 0), lack = cs.reduce((s, c) => s + c.lack, 0);
    const hd = cs.reduce((s, c) => s + c.hdays, 0) / (n / 4);
    lines.push(`| ${k} | ${n} | ${cs.map((c) => `${pct(c.lack, c.need)} (${pct(c.hungry, c.n)})`).join(' | ')} | ${pct(lack, need)} | ${hd.toFixed(1)} |`);
  }
  return `${lines.join('\n')}\n`;
}
const bin = (x, edges, labels) => { for (let i = 0; i < edges.length; i++) if (x < edges[i]) return labels[i]; return labels[edges.length]; };
let md = `Populous small, seeds ${runs.map((o) => o.seed).join(', ')}, years ${from} to ${to}: ${seasons.length} household-seasons, ${years.length} household-years.\n\n`;
md += bySeason('season (all)', () => 'all');
md += '\n' + bySeason('members', (r) => (r.members >= 8 ? '8+' : String(r.members)));
md += '\n' + bySeason('adults + children', (r) => `${Math.min(r.adults, 3)}${r.adults >= 3 ? '+' : ''} + ${Math.min(r.children, 4)}${r.children >= 4 ? '+' : ''}`);
md += '\n' + bySeason('fields', (r) => (r.fields >= 6 ? '6+' : String(r.fields)));
md += '\n' + bySeason('hands (14-59)', (r) => (r.hands >= 3 ? '3+' : String(r.hands)));
md += '\n' + bySeason('herd', (r) => (r.cattle === 0 && r.sheep === 0 ? 'none' : r.cattle === 0 ? 'sheep only' : r.cattle <= 2 ? 'cattle 1-2' : 'cattle 3+'));
md += '\n' + bySeason('need a field a day (rations)', (r) => (r.fields ? bin(r.need / r.fields, [0.75, 1, 1.25, 1.5], ['a <0.75', 'b 0.75-1', 'c 1-1.25', 'd 1.25-1.5', 'e 1.5+']) : 'f no field'));
md += '\n' + bySeason('hands a field', (r) => (r.fields ? bin(r.hands / r.fields, [0.34, 0.5, 0.75], ['a <0.34', 'b 0.34-0.5', 'c 0.5-0.75', 'd 0.75+']) : 'e no field'));
md += '\n' + bySeason('food held at the season\'s start (days of need)', (r) => (r.need ? bin(r.food / r.need, [12, 24, 48, 96], ['a <12', 'b 12-24', 'c 24-48', 'd 48-96', 'e 96+']) : null));
// the harvest: net of seed, by fields at the year's start, and per field reaped
const hg = new Map();
for (const r of years) {
  if (r.days < 4 * 12 - 1) continue; const k = r.start.fields >= 6 ? '6+' : String(r.start.fields);
  if (!hg.has(k)) hg.set(k, { n: 0, harvest: 0, reaped: 0, need: 0, hungry: 0 }); const c = hg.get(k);
  c.n++; c.harvest += r.harvest; c.reaped += r.reaped; c.need += r.start.need * 48; c.hungry += r.hungry > 0 ? 1 : 0;
}
md += '\n| fields (year\'s start; whole years) | household-years | fields reaped | harvest net of seed | net a field reaped | need at the start | harvest / need | hungry % |\n|---|---:|---:|---:|---:|---:|---:|---:|\n';
for (const [k, c] of [...hg].sort()) md += `| ${k} | ${c.n} | ${(c.reaped / c.n).toFixed(2)} | ${(c.harvest / c.n).toFixed(0)} | ${(c.harvest / Math.max(1, c.reaped)).toFixed(1)} | ${(c.need / c.n).toFixed(0)} | ${(c.harvest / Math.max(1, c.need)).toFixed(2)} | ${pct(c.hungry, c.n)} |\n`;
// the replay's rows: households hungry over 0.3 of their days in a year after year 3
const rows = years.filter((r) => r.row), mean = (f) => (rows.length ? rows.reduce((s, r) => s + f(r), 0) / rows.length : 0);
const short = rows.filter((r) => r.hungry > r.blocked);
md += `\nRows (hungry over 0.3 of its days, after year 3, 12 days or more): ${rows.length} (${rows.filter((r) => r.blocked > 0).length} with a day its stores covered, ${short.length} with a short day), `
  + `by seed ${runs.map((o) => `${o.seed}: ${rows.filter((r) => r.seed === o.seed).length}`).join(', ')}; `
  + `members ${mean((r) => r.start.members).toFixed(1)} (adults ${mean((r) => r.start.adults).toFixed(1)}, children ${mean((r) => r.start.children).toFixed(1)}, hands ${mean((r) => r.start.hands).toFixed(1)}), `
  + `fields ${mean((r) => r.start.fields).toFixed(1)}, cattle ${mean((r) => r.start.cattle).toFixed(1)}, sheep ${mean((r) => r.start.sheep).toFixed(1)}; `
  + `2+ adults and 2+ children: ${rows.filter((r) => r.start.adults >= 2 && r.start.children >= 2).length}; one adult at most: ${rows.filter((r) => r.start.adults <= 1).length}; `
  + `dissolved in the year: ${rows.filter((r) => r.dissolved).length}; hungry days by season ${[0, 1, 2, 3].map((s) => rows.reduce((a, r) => a + r.bySeason[s], 0)).join(' / ')} (spring / summer / autumn / winter); `
  + `distinct households ${new Set(rows.map((r) => r.seed + ':' + r.hh)).size}.\n`;
console.log(md);
