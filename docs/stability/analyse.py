"""Tables and figures for the stability review (docs/review-stability.md) from the probe's text output.
   python3 docs/stability/analyse.py docs/stability/runs/before docs/stability/runs/after --labels before after --fig docs/img/stability-runs.png
Each directory holds one file per run (small-7.txt ... tiny-42.txt), as written by docs/stability/probe.js. Prints, per decade end, the mean
over the runs of each measure (the small runs end at year 60, so years 70 and 80 are the four tiny runs only), and draws one panel per measure."""
import re, sys, argparse
p = argparse.ArgumentParser(); p.add_argument('dirs', nargs='+'); p.add_argument('--labels', nargs='+'); p.add_argument('--fig'); a = p.parse_args()
RUNS = ['small-7', 'small-42', 'tiny-3', 'tiny-7', 'tiny-11', 'tiny-42']
PAT = re.compile(r'y\s*(\d+) pop\s+(\d+) hh\s+(\d+) ones\s+(\d+) b/d/starve per1000 ([\d.]+)/([\d.]+)/([\d.]+) \((\d+)\) hungryDays/hh ([\d.]+) '
                 r'\| size%/hungry%/days 1:(\d+)/(\d+)/([\d.]+) .*?\| marr (\d+) fAge ([\d.]+|null) loneHold (\d+)\(m\d+\) nevMarr (\d+)/(\d+) '
                 r'single25-45 (\d+) landless (\d+)/(\d+) \| labels (\d+) distinct (\d+) rep (\d+) .*?\| vill (\d+) nn ([\d.]+|null) land% ([\d.]+) \| ([\d.]+) ms')
def parse(path):
    out = {}
    for line in open(path):
        m = PAT.match(line)
        if not m: continue
        g = m.groups(); f = lambda i: float(g[i]) if g[i] != 'null' else None
        out[int(g[0])] = dict(pop=int(g[1]), ones=100 * int(g[3]) / max(1, int(g[2])), births=f(4), deaths=f(5), starve=f(6), hdays=f(8),
            ones_hungry=int(g[10]), fage=f(13), lone=int(g[14]), nevmar=int(g[15]), w4554=int(g[16]), rep=int(g[22]), vill=int(g[23]),
            nn=f(24), land=f(25), ms=f(26))
    return out
data = [{r: parse(f'{d}/{r}.txt') for r in RUNS} for d in a.dirs]
for d in data:  # people indexed to year 10 in each run, so that the mean does not jump where the small runs end
    for r in RUNS:
        for y in d[r]: d[r][y]['popi'] = 100 * d[r][y]['pop'] / d[r][10]['pop']
labels = a.labels or a.dirs
MEASURES = [('popi', 'People (year 10 = 100)', '{:.0f}'), ('starve', 'Deaths from hunger per 1,000 a year', '{:.1f}'), ('hdays', 'Hungry days per household a year', '{:.2f}'),
            ('ones', 'Households of one, % of households', '{:.0f}'), ('ones_hungry', 'Households of one hungry in the year, %', '{:.0f}'),
            ('fage', "Women's mean age at first marriage", '{:.1f}'), ('births', 'Births per 1,000 a year', '{:.1f}'),
            ('rep', 'Repeated names on the map', '{:.0f}'), ('nn', 'Steps to the nearest village', '{:.1f}'), ('land', 'Farmable land in use, %', '{:.1f}')]
YEARS = [10, 20, 30, 40, 50, 60, 70, 80]
def mean(k, d, y):
    xs = [d[r][y][k] for r in RUNS if y in d[r] and d[r][y][k] is not None]
    return sum(xs) / len(xs) if xs else None
for k, title, fmt in MEASURES:
    print(f'\n{title} (mean of the runs)\n| Year | ' + ' | '.join(labels) + ' |\n|---|' + '---|' * len(labels))
    for y in YEARS:
        print(f'| {y} | ' + ' | '.join((fmt.format(v) if v is not None else '–') for v in (mean(k, d, y) for d in data)) + ' |')
# totals over each run: deaths from hunger (per-decade rates × 10 years × mean people, roughly), people at the end
print('\nPer run, at the end: people; mean deaths from hunger per 1,000 over the decades; households of one %; lone holders 20-50')
for r in RUNS:
    print(f'| {r} | ' + ' | '.join(f"{d[r][max(d[r])]['pop']}; {sum(x['starve'] for x in d[r].values()) / len(d[r]):.1f}; {d[r][max(d[r])]['ones']:.0f}%; {d[r][max(d[r])]['lone']}"
                                  for d in data) + ' |')
if a.fig:
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
    C = {'s1': '#2a78d6', 's2': '#eb6834', 's3': '#1baf7a', 'surface': '#fcfcfb', 'ink': '#0b0b0b', 'ink2': '#52514e', 'muted': '#898781', 'grid': '#e1e0d9', 'axis': '#c3c2b7'}
    cols = [C['s1'], C['s2'], C['s3']]
    show = [m for m in MEASURES if m[0] not in ('ones_hungry', 'land')]
    fig, axes = plt.subplots(2, 4, figsize=(13, 6.2), facecolor=C['surface'])
    for ax, (k, title, fmt) in zip(axes.flat, show):
        ax.set_facecolor(C['surface'])
        for i, d in enumerate(data):
            ys = [(y, mean(k, d, y)) for y in YEARS if mean(k, d, y) is not None]
            ax.plot([y for y, _ in ys], [v for _, v in ys], color=cols[i], lw=2, marker='o', ms=4, label=labels[i])
            y, v = ys[-1]; ax.annotate(labels[i], (y, v), xytext=(4, 0), textcoords='offset points', color=C['ink2'], fontsize=8, va='center')
        ax.set_title(title, fontsize=9.5, color=C['ink'], loc='left')
        ax.grid(axis='y', color=C['grid'], lw=0.8); ax.set_axisbelow(True)
        for s in ('top', 'right'): ax.spines[s].set_visible(False)
        for s in ('left', 'bottom'): ax.spines[s].set_color(C['axis'])
        ax.tick_params(colors=C['ink2'], labelsize=8); ax.set_xticks([10, 30, 50, 70]); ax.set_xlim(8, 88)
        if k in ('starve', 'hdays', 'rep', 'ones'): ax.set_ylim(bottom=0)
    axes.flat[0].legend(frameon=False, fontsize=8, loc='upper left')
    fig.supxlabel('Year (decade ends; years 70–80: the four tiny-map runs only)', fontsize=9, color=C['ink2'])
    fig.tight_layout(); fig.savefig(a.fig, dpi=110, facecolor=C['surface'])
    print('figure', a.fig)
